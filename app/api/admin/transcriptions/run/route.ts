import { asc, eq, like } from "drizzle-orm";
import { getDb } from "../../../../../db";
import {
  audioTranscriptions,
  blipMessages,
  blipTickets,
  conversationAnalyses,
} from "../../../../../db/schema";
import { requireAuth } from "../../../../../lib/auth";
import { getBlipTicketMessages, normalizeBlipMessage, type BlipTicket } from "../../../../../lib/blip";
import { transcribeBlipAudio } from "../../../../../lib/openai-transcription";

function routeError(error: unknown) {
  const message = error instanceof Error ? error.message : "Falha inesperada.";
  const cause = error && typeof error === "object" && "cause" in error
    ? (error as { cause?: { message?: string } }).cause?.message ?? ""
    : "";
  if (`${message} ${cause}`.includes("no such table")) {
    return "Banco ainda nao foi migrado para a fila de transcricoes.";
  }
  return message;
}

async function audioRows() {
  const db = getDb();
  return db
    .select()
    .from(blipMessages)
    .where(like(blipMessages.contentType, "%audio%"))
    .orderBy(asc(blipMessages.storageDate));
}

async function transcriptionStats() {
  const db = getDb();
  const [messages, rows] = await Promise.all([
    audioRows(),
    db.select().from(audioTranscriptions),
  ]);
  const totals = rows.reduce<Record<string, number>>((result, row) => {
    result[row.status] = (result[row.status] ?? 0) + 1;
    return result;
  }, {});
  return {
    total: messages.length,
    pending: messages.length - (totals.Concluida ?? 0),
    processing: totals.Processando ?? 0,
    completed: totals.Concluida ?? 0,
    failed: totals.Erro ?? 0,
  };
}

export async function GET(request: Request) {
  const auth = await requireAuth(request, ["Administrador", "Gestor"]);
  if (auth.response) return auth.response;
  try {
    return Response.json({ stats: await transcriptionStats() });
  } catch (error) {
    const message = routeError(error);
    if (message.includes("ainda nao foi migrado")) {
      return Response.json({ stats: { total: 0, pending: 0, processing: 0, completed: 0, failed: 0 } });
    }
    return Response.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await requireAuth(request, ["Administrador"]);
  if (auth.response) return auth.response;
  try {
    const payload = await request.json().catch(() => ({})) as { limit?: number };
    const limit = Math.min(10, Math.max(1, Number(payload.limit ?? 5)));
    const db = getDb();
    const messages = await audioRows();
    const tickets = await db.select().from(blipTickets);
    const ticketById = new Map(tickets.map((ticket) => [ticket.externalId, {
      ...(JSON.parse(ticket.rawJson) as Partial<BlipTicket>),
      id: ticket.externalId,
      customerIdentity: ticket.customerIdentity,
    }]));

    for (const message of messages) {
      await db.insert(audioTranscriptions).values({
        messageId: message.externalId,
        ticketId: message.ticketId,
        status: message.contentText.startsWith("[Audio transcrito]") ? "Concluida" : "Pendente",
        transcript: message.contentText.startsWith("[Audio transcrito]")
          ? message.contentText.replace(/^\[Audio transcrito\]\s*/, "")
          : "",
      }).onConflictDoNothing({ target: audioTranscriptions.messageId });
    }

    const rows = await db.select().from(audioTranscriptions).orderBy(asc(audioTranscriptions.id));
    const messageById = new Map(messages.map((message) => [message.externalId, message]));
    const queue = rows
      .filter((row) => row.status !== "Concluida" && messageById.has(row.messageId))
      .slice(0, limit);
    const refreshedTickets = new Map<string, Promise<Map<string, string>>>();
    const results: Array<{ messageId: string; ticketId: string; status: string; error?: string }> = [];

    const refreshedMedia = (ticketId: string) => {
      if (!refreshedTickets.has(ticketId)) {
        const ticket = ticketById.get(ticketId);
        if (!ticket) throw new Error(`Ticket ${ticketId} nao encontrado no banco.`);
        refreshedTickets.set(ticketId, getBlipTicketMessages(ticket, true, 100).then((collection) => new Map(
          collection.items.map((item) => {
            const normalized = normalizeBlipMessage(item, ticketId);
            return [normalized.externalId, normalized.mediaUri ?? ""];
          }),
        )));
      }
      return refreshedTickets.get(ticketId)!;
    };

    for (const row of queue) {
      const message = messageById.get(row.messageId)!;
      await db.update(audioTranscriptions).set({
        status: "Processando",
        error: "",
        attempts: row.attempts + 1,
        updatedAt: new Date().toISOString(),
      }).where(eq(audioTranscriptions.id, row.id));

      try {
        const media = await refreshedMedia(row.ticketId);
        const mediaUri = media.get(row.messageId);
        if (!mediaUri) throw new Error("A Blip nao retornou uma URL renovada para esta mensagem.");
        await db.update(blipMessages).set({ mediaUri }).where(eq(blipMessages.id, message.id));

        const transcription = await transcribeBlipAudio(mediaUri, message.contentType);
        const now = new Date().toISOString();
        await db.update(audioTranscriptions).set({
          status: "Concluida",
          model: transcription.model,
          transcript: transcription.text,
          error: "",
          updatedAt: now,
          transcribedAt: now,
        }).where(eq(audioTranscriptions.id, row.id));
        await db.update(blipMessages).set({
          contentText: `[Audio transcrito] ${transcription.text}`,
          mediaUri,
        }).where(eq(blipMessages.id, message.id));
        await db.update(conversationAnalyses).set({
          status: "Pendente",
          error: "",
          updatedAt: now,
        }).where(eq(conversationAnalyses.ticketId, row.ticketId));
        results.push({ messageId: row.messageId, ticketId: row.ticketId, status: "Concluida" });
      } catch (error) {
        const messageText = routeError(error);
        await db.update(audioTranscriptions).set({
          status: "Erro",
          error: messageText.slice(0, 1_000),
          updatedAt: new Date().toISOString(),
        }).where(eq(audioTranscriptions.id, row.id));
        results.push({ messageId: row.messageId, ticketId: row.ticketId, status: "Erro", error: messageText });
      }
    }

    return Response.json({ processed: queue.length, results, stats: await transcriptionStats() });
  } catch (error) {
    return Response.json({ error: routeError(error) }, { status: 500 });
  }
}
