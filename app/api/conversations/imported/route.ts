import { asc, desc, eq } from "drizzle-orm";
import { getDb } from "../../../../db";
import { blipMessages, blipTickets, conversationAnalyses, processDefinitions } from "../../../../db/schema";
import { inferSector } from "../../../../lib/blip-storage";
import { requireAuth } from "../../../../lib/auth";

function resultValue(resultJson: string) {
  try {
    return JSON.parse(resultJson) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function processIds(value: string | undefined) {
  try {
    const parsed = JSON.parse(value ?? "[]");
    return Array.isArray(parsed) ? parsed.filter((item): item is number => Number.isInteger(item)) : [];
  } catch {
    return [];
  }
}

function removeTemporaryWording(value: string) {
  return value.replace(/processo piloto/gi, "processo de avaliação").replace(/piloto\s*-\s*/gi, "");
}

function maskIdentity(identity: string) {
  const local = identity.split("@")[0] ?? "";
  if (local.length < 5) return "***";
  return `${local.slice(0, 2)}***${local.slice(-2)}`;
}

export async function GET(request: Request) {
  const auth = await requireAuth(request);
  if (auth.response || !auth.user) return auth.response;
  try {
    const limit = Math.min(200, Math.max(1, Number(new URL(request.url).searchParams.get("limit") ?? 100)));
    const db = getDb();
    const definitions = await db.select().from(processDefinitions);
    const rows = await db
      .select({ ticket: blipTickets, analysis: conversationAnalyses })
      .from(blipTickets)
      .leftJoin(conversationAnalyses, eq(conversationAnalyses.ticketId, blipTickets.externalId))
      .orderBy(desc(blipTickets.openedAt))
      .limit(limit);

    const conversations = [];
    for (const row of rows) {
      if (auth.user.role === "Operador") {
        const identityMatch = Boolean(auth.user.attendantIdentity) && row.ticket.attendantIdentity === auth.user.attendantIdentity;
        const nameMatch = row.ticket.attendantName.trim().toLowerCase() === auth.user.name.trim().toLowerCase();
        if (!identityMatch && !nameMatch) continue;
      }
      const analysis = resultValue(row.analysis?.resultJson ?? "{}");
      const messages = await db
        .select({ id: blipMessages.id, role: blipMessages.role, storageDate: blipMessages.storageDate })
        .from(blipMessages)
        .where(eq(blipMessages.ticketId, row.ticket.externalId))
        .orderBy(asc(blipMessages.storageDate));
      const start = new Date(row.ticket.openedAt);
      const end = new Date(row.ticket.closedAt ?? row.ticket.lastMessageAt ?? row.ticket.openedAt);
      const duration = Math.max(1, Math.round((end.getTime() - start.getTime()) / 60_000));
      const score = typeof analysis.overallScore === "number" ? analysis.overallScore : 0;
      const adherence = typeof analysis.adherence === "number" ? analysis.adherence : 0;
      const risks = Array.isArray(analysis.risks) ? analysis.risks.filter((item): item is string => typeof item === "string").map(removeTemporaryWording) : [];
      const strengths = Array.isArray(analysis.strengths) ? analysis.strengths.filter((item): item is string => typeof item === "string") : [];
      const improvements = Array.isArray(analysis.improvements) ? analysis.improvements.filter((item): item is string => typeof item === "string") : [];
      const stepEvaluations = Array.isArray(analysis.stepEvaluations)
        ? analysis.stepEvaluations.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object").map((item) => ({
          name: typeof item.step === "string" ? removeTemporaryWording(item.step) : "Etapa sem nome",
          weight: 1,
          status: typeof item.status === "string" ? item.status : "Incerto",
          score: typeof item.score === "number" ? item.score : 0,
          evidence: typeof item.evidence === "string" ? removeTemporaryWording(item.evidence) : "Sem evidencia registrada.",
          guidance: "",
        }))
        : [];
      const firstClient = messages.find((message) => message.role === "client");
      const firstAttendant = firstClient
        ? messages.find((message) => message.role === "attendant" && new Date(message.storageDate).getTime() >= new Date(firstClient.storageDate).getTime())
        : undefined;
      const firstResponse = firstClient && firstAttendant
        ? Math.max(0, Math.round((new Date(firstAttendant.storageDate).getTime() - new Date(firstClient.storageDate).getTime()) / 60_000))
        : 0;
      const hasCompletedAnalysis = row.analysis?.status === "Concluida";
      const matchedProcesses = processIds(row.analysis?.processIdsJson)
        .map((id) => definitions.find((definition) => definition.id === id))
        .filter((definition): definition is typeof definitions[number] => Boolean(definition));
      const processLabel = matchedProcesses.length
        ? matchedProcesses.map((definition) => `${definition.name} ${definition.version}`).join(", ")
        : "Processo não cadastrado";

      conversations.push({
        id: row.ticket.externalId,
        protocol: row.ticket.sequentialId || row.ticket.externalId,
        start: start.toISOString(),
        end: end.toISOString(),
        client: row.ticket.customerName,
        maskedPhone: maskIdentity(row.ticket.customerIdentity),
        attendant: row.ticket.attendantName,
        team: row.ticket.team,
        sector: inferSector(row.ticket.team),
        channel: row.ticket.channel,
        duration,
        classification: typeof analysis.classification === "string" ? removeTemporaryWording(analysis.classification) : "Aguardando analise",
        eligible: messages.length > 1 && hasCompletedAnalysis,
        ineligibleReason: messages.length <= 1 ? "Historico insuficiente" : hasCompletedAnalysis ? "Elegivel para avaliacao" : "Analise pendente",
        score,
        adherence,
        sentiment: risks.length ? "Atencao" : "Baixa tensao",
        resolution: typeof analysis.resolution === "string" ? removeTemporaryWording(analysis.resolution) : "Indeterminado",
        recurrences: 0,
        alerts: risks,
        reviewStatus: "Pendente",
        confidence: 0,
        processVersion: processLabel,
        process: processLabel,
        firstResponse,
        responseTime: 0,
        isMultichannelCase: false,
        source: "Blip",
        ticketStatus: row.ticket.status,
        messageCount: messages.length,
        analysisStatus: row.analysis?.status ?? "Pendente",
        analysisModel: row.analysis?.model ?? "",
        analyzedAt: row.analysis?.analyzedAt ?? null,
        summary: typeof analysis.summary === "string" ? removeTemporaryWording(analysis.summary) : "",
        strengths: strengths.map(removeTemporaryWording),
        improvements: improvements.map(removeTemporaryWording),
        stepEvaluations,
      });
    }
    return Response.json({ conversations });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao carregar atendimentos Blip.";
    const cause = error && typeof error === "object" && "cause" in error
      ? (error as { cause?: { message?: string } }).cause?.message ?? ""
      : "";
    if (`${message} ${cause}`.includes("no such table")) return Response.json({ conversations: [] });
    return Response.json({ error: message }, { status: 500 });
  }
}
