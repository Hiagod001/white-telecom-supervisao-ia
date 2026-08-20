import { desc, eq } from "drizzle-orm";
import { getDb } from "../../../../db";
import {
  blipMessages,
  blipTickets,
  conversationAnalyses,
  processDefinitions,
  processDocuments,
  tasks,
} from "../../../../db/schema";
import { requireAuth } from "../../../../lib/auth";
import { inferSector } from "../../../../lib/blip-storage";
import { askSupervisionAgent, type AgentChatMessage } from "../../../../lib/openai-agent";

type AnalysisResult = {
  overallScore?: number;
  adherence?: number;
  classification?: string;
  resolution?: string;
  summary?: string;
  risks?: string[];
  processMatch?: string;
};

function parseJson<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function periodDays(period: string) {
  if (period === "Hoje") return 1;
  if (period === "Semana atual" || period === "7 dias") return 7;
  if (period === "14 dias") return 14;
  if (period === "Mes atual") return 30;
  return 90;
}

function average(values: number[]) {
  return values.length ? values.reduce((total, value) => total + value, 0) / values.length : 0;
}

function compactText(value: string, limit: number) {
  return value.replace(/\s+/g, " ").trim().slice(0, limit);
}

function routeError(error: unknown) {
  const message = error instanceof Error ? error.message : "Falha inesperada no agente.";
  const cause = error && typeof error === "object" && "cause" in error
    ? (error as { cause?: { message?: string } }).cause?.message ?? ""
    : "";
  if (`${message} ${cause}`.includes("no such table")) return "O banco ainda nao esta preparado para o agente.";
  return message;
}

export async function POST(request: Request) {
  const auth = await requireAuth(request);
  if (auth.response || !auth.user) return auth.response;

  try {
    const payload = (await request.json()) as {
      question?: string;
      sector?: string;
      period?: string;
      history?: AgentChatMessage[];
    };
    const question = payload.question?.trim() ?? "";
    const sector = ["Atendimento", "Comercial", "Retencao"].includes(payload.sector ?? "")
      ? payload.sector as "Atendimento" | "Comercial" | "Retencao"
      : "Atendimento";
    const period = payload.period?.trim() || "Mes atual";

    if (question.length < 2 || question.length > 2_000) {
      return Response.json({ error: "A pergunta deve ter entre 2 e 2.000 caracteres." }, { status: 400 });
    }

    const db = getDb();
    const [ticketRows, processRows, documentRows, taskRows] = await Promise.all([
      db
        .select({ ticket: blipTickets, analysis: conversationAnalyses })
        .from(blipTickets)
        .leftJoin(conversationAnalyses, eq(conversationAnalyses.ticketId, blipTickets.externalId))
        .orderBy(desc(blipTickets.openedAt))
        .limit(300),
      db.select().from(processDefinitions).orderBy(desc(processDefinitions.id)).limit(100),
      db.select().from(processDocuments).orderBy(desc(processDocuments.id)).limit(300),
      db.select().from(tasks).orderBy(desc(tasks.updatedAt)).limit(200),
    ]);

    const since = Date.now() - periodDays(period) * 86_400_000;
    const visibleRows = ticketRows.filter(({ ticket }) => {
      if (new Date(ticket.openedAt).getTime() < since) return false;
      if (inferSector(ticket.team) !== sector) return false;
      if (auth.user.role !== "Operador") return true;
      const identityMatch = Boolean(auth.user.attendantIdentity) && ticket.attendantIdentity === auth.user.attendantIdentity;
      const nameMatch = ticket.attendantName.trim().toLowerCase() === auth.user.name.trim().toLowerCase();
      return identityMatch || nameMatch;
    });

    const analyzed = visibleRows.map(({ ticket, analysis }) => ({
      ticket,
      analysis,
      result: parseJson<AnalysisResult>(analysis?.resultJson ?? "{}", {}),
    }));
    const concluded = analyzed.filter((row) => row.analysis?.status === "Concluida");
    const scores = concluded.map((row) => row.result.overallScore).filter((value): value is number => typeof value === "number");
    const adherences = concluded.map((row) => row.result.adherence).filter((value): value is number => typeof value === "number");

    const attendants = new Map<string, typeof concluded>();
    for (const row of concluded) {
      const current = attendants.get(row.ticket.attendantName) ?? [];
      current.push(row);
      attendants.set(row.ticket.attendantName, current);
    }
    const ranking = Array.from(attendants.entries()).map(([name, rows]) => {
      const rowScores = rows.map((row) => row.result.overallScore).filter((value): value is number => typeof value === "number");
      const rowAdherence = rows.map((row) => row.result.adherence).filter((value): value is number => typeof value === "number");
      const resolved = rows.filter((row) => /resolvid|concluid|retid|venda concluida/i.test(row.result.resolution ?? row.result.classification ?? "")).length;
      return {
        name,
        analyzed: rows.length,
        averageScore: Number(average(rowScores).toFixed(1)),
        averageAdherence: Math.round(average(rowAdherence)),
        positiveOutcomes: resolved,
      };
    }).sort((left, right) => right.averageScore - left.averageScore || right.averageAdherence - left.averageAdherence);

    const classificationCounts = new Map<string, number>();
    for (const row of concluded) {
      const classification = row.result.classification || "Sem classificacao";
      classificationCounts.set(classification, (classificationCounts.get(classification) ?? 0) + 1);
    }

    const alerts = concluded.flatMap((row) => (row.result.risks ?? []).map((risk) => ({
      protocol: row.ticket.sequentialId || row.ticket.externalId,
      attendant: row.ticket.attendantName,
      risk: compactText(risk, 300),
      score: row.result.overallScore ?? null,
      date: row.ticket.openedAt,
    }))).slice(0, 30);

    const normalizedQuestion = question.toLowerCase();
    const processDetailRequested = /process|roteiro|script|regra|document|procedimento|etapa/.test(normalizedQuestion);
    const applicableProcesses = processRows.filter((process) =>
      process.status === "Publicado" && (process.sector === sector || process.sector === "Todos"),
    );
    const processContext = applicableProcesses.map((process) => ({
      id: process.id,
      name: process.name,
      status: process.status,
      version: process.version,
      objective: compactText(process.objective, 1_000),
      instructions: compactText(process.instructions, 1_500),
      channels: parseJson<string[]>(process.channelsJson, []),
      steps: parseJson<Array<{ name: string; weight: number; criterion: string }>>(process.stepsJson, []).map((step) => ({
        name: step.name,
        weight: step.weight,
        criterion: compactText(step.criterion, 500),
      })),
      documents: documentRows.filter((document) => document.processId === process.id).map((document) => ({
        name: document.name,
        status: document.status,
        content: processDetailRequested ? compactText(document.extractedText, 4_000) : undefined,
      })),
    }));

    const visibleTasks = auth.user.role === "Operador"
      ? taskRows.filter((task) => task.owner.trim().toLowerCase() === auth.user.name.trim().toLowerCase())
      : taskRows;
    const taskSummary = Array.from(new Set(visibleTasks.map((task) => task.status))).map((status) => ({
      status,
      count: visibleTasks.filter((task) => task.status === status).length,
    }));

    const referenced = analyzed.find(({ ticket }) => {
      const candidates = [ticket.externalId, ticket.sequentialId].filter(Boolean).map((value) => value.toLowerCase());
      return candidates.some((value) => normalizedQuestion.includes(value));
    });
    let conversationDetail: Record<string, unknown> | null = null;
    if (referenced) {
      const messages = await db
        .select()
        .from(blipMessages)
        .where(eq(blipMessages.ticketId, referenced.ticket.externalId))
        .orderBy(desc(blipMessages.storageDate))
        .limit(120);
      conversationDetail = {
        protocol: referenced.ticket.sequentialId || referenced.ticket.externalId,
        attendant: referenced.ticket.attendantName,
        channel: referenced.ticket.channel,
        date: referenced.ticket.openedAt,
        analysis: referenced.result,
        transcript: messages.reverse().map((message) => ({
          at: message.storageDate,
          role: message.role,
          sender: message.senderName || message.senderIdentity,
          text: compactText(message.contentText, 1_000),
        })),
      };
    }

    const roleScope = auth.user.role === "Operador"
      ? `Somente atendimentos e tarefas de ${auth.user.name}`
      : `Visao operacional do perfil ${auth.user.role}`;
    const context = {
      scope: {
        role: auth.user.role,
        user: auth.user.name,
        team: auth.user.team,
        access: roleScope,
        sector,
        period,
        periodDays: periodDays(period),
      },
      dataAvailability: {
        synchronizedAttendances: visibleRows.length,
        concludedAnalyses: concluded.length,
        pendingAnalyses: visibleRows.length - concluded.length,
        note: visibleRows.length ? "Dados reais sincronizados da operacao" : "Nao ha atendimentos reais sincronizados neste recorte",
      },
      metrics: {
        attendances: visibleRows.length,
        analyzed: concluded.length,
        averageScore: Number(average(scores).toFixed(1)),
        averageAdherence: Math.round(average(adherences)),
        alerts: alerts.length,
      },
      ranking: auth.user.role === "Operador" ? ranking.slice(0, 1) : ranking.slice(0, 25),
      classifications: Array.from(classificationCounts.entries()).map(([name, count]) => ({ name, count })),
      alerts,
      tasks: { total: visibleTasks.length, byStatus: taskSummary },
      processes: processContext,
      conversation: conversationDetail,
      sourceCatalog: [
        "Atendimentos sincronizados da Blip",
        "Analises de qualidade da OpenAI",
        "Processos publicados da Uai Telecom",
        "Tarefas operacionais",
      ],
    };

    const result = await askSupervisionAgent({
      question,
      history: Array.isArray(payload.history)
        ? payload.history.filter((message): message is AgentChatMessage =>
          Boolean(message) && ["user", "assistant"].includes(message.role) && typeof message.content === "string",
        )
        : [],
      businessContext: context,
    });

    return Response.json({ ...result.answer, model: result.model, usage: result.usage });
  } catch (error) {
    const message = routeError(error);
    const status = message.includes("OPENAI_API_KEY") ? 503 : 500;
    return Response.json({ error: message }, { status });
  }
}
