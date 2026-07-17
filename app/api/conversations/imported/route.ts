import { desc, eq } from "drizzle-orm";
import { getDb } from "../../../../db";
import { blipMessages, blipTickets, conversationAnalyses } from "../../../../db/schema";
import { inferSector } from "../../../../lib/blip-storage";
import { requireAuth } from "../../../../lib/auth";

function resultValue(resultJson: string) {
  try {
    return JSON.parse(resultJson) as Record<string, unknown>;
  } catch {
    return {};
  }
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
      const messageCount = await db
        .select({ id: blipMessages.id })
        .from(blipMessages)
        .where(eq(blipMessages.ticketId, row.ticket.externalId));
      const start = new Date(row.ticket.openedAt);
      const end = new Date(row.ticket.closedAt ?? row.ticket.lastMessageAt ?? row.ticket.openedAt);
      const duration = Math.max(1, Math.round((end.getTime() - start.getTime()) / 60_000));
      const score = typeof analysis.overallScore === "number" ? analysis.overallScore : 0;
      const adherence = typeof analysis.adherence === "number" ? analysis.adherence : 0;
      const risks = Array.isArray(analysis.risks) ? analysis.risks.filter((item): item is string => typeof item === "string") : [];

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
        classification: typeof analysis.classification === "string" ? analysis.classification : "Aguardando analise",
        eligible: messageCount.length > 1,
        ineligibleReason: messageCount.length > 1 ? "" : "Historico insuficiente",
        score,
        adherence,
        sentiment: risks.length ? "Atencao" : "Baixa tensao",
        resolution: typeof analysis.resolution === "string" ? analysis.resolution : "Indeterminado",
        recurrences: 0,
        alerts: risks,
        reviewStatus: row.analysis?.status === "Concluida" ? "Pendente" : "Atribuido",
        confidence: row.analysis?.status === "Concluida" ? 0.9 : 0,
        processVersion: typeof analysis.processMatch === "string" ? analysis.processMatch : "Aguardando selecao",
        process: typeof analysis.processMatch === "string" ? analysis.processMatch : "Processo pendente",
        firstResponse: 0,
        responseTime: 0,
        isMultichannelCase: false,
        source: "Blip",
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
