import { eq } from "drizzle-orm";
import { getDb } from "../../../../../../db";
import { blipSyncRuns } from "../../../../../../db/schema";
import { getBlipThread, hasOpenAiKey, listBlipAttendants, listBlipTickets } from "../../../../../../lib/blip";
import { upsertBlipAttendant, upsertBlipMessage, upsertBlipTicket } from "../../../../../../lib/blip-storage";
import { requireAuth } from "../../../../../../lib/auth";

function routeError(error: unknown) {
  const message = error instanceof Error ? error.message : "Unexpected error";
  const cause = error && typeof error === "object" && "cause" in error
    ? (error as { cause?: { message?: string } }).cause?.message ?? ""
    : "";
  if (`${message} ${cause}`.includes("no such table")) {
    return "Banco D1 ainda nao esta migrado para sincronizar a Blip.";
  }
  return message;
}

export async function POST(request: Request) {
  const auth = await requireAuth(request, ["Administrador"]);
  if (auth.response) return auth.response;
  const db = getDb();
  let runId = 0;
  try {
    const payload = (await request.json().catch(() => ({}))) as { limit?: number };
    const limit = Math.min(50, Math.max(1, Number(payload.limit ?? 20)));
    const [run] = await db
      .insert(blipSyncRuns)
      .values({ status: "Executando" })
      .returning({ id: blipSyncRuns.id });
    runId = run.id;

    const attendants = await listBlipAttendants();
    for (const attendant of attendants.items) {
      if (attendant.identity) await upsertBlipAttendant(attendant);
    }

    const ticketCollection = await listBlipTickets(0, limit);
    let messageCount = 0;
    let ticketCount = 0;
    const failures: string[] = [];

    for (const ticket of ticketCollection.items) {
      if (!ticket.id || !ticket.customerIdentity) continue;
      await upsertBlipTicket(ticket);
      ticketCount += 1;
      try {
        const thread = await getBlipThread(ticket.customerIdentity, 100);
        for (const message of [...thread.items].reverse()) {
          await upsertBlipMessage(message, ticket.id);
          messageCount += 1;
        }
      } catch (error) {
        failures.push(`${ticket.id}: ${error instanceof Error ? error.message : "historico indisponivel"}`);
      }
    }

    await db
      .update(blipSyncRuns)
      .set({
        status: failures.length ? "Concluido com avisos" : "Concluido",
        attendants: attendants.items.length,
        tickets: ticketCount,
        messages: messageCount,
        details: failures.slice(0, 10).join("\n"),
        finishedAt: new Date().toISOString(),
      })
      .where(eq(blipSyncRuns.id, runId));

    return Response.json({
      synchronized: true,
      attendants: attendants.items.length,
      tickets: ticketCount,
      messages: messageCount,
      analysisQueued: ticketCount,
      openAiReady: hasOpenAiKey(),
      warnings: failures.length,
    });
  } catch (error) {
    if (runId) {
      await db
        .update(blipSyncRuns)
        .set({
          status: "Erro",
          details: routeError(error),
          finishedAt: new Date().toISOString(),
        })
        .where(eq(blipSyncRuns.id, runId))
        .catch(() => undefined);
    }
    return Response.json({ error: routeError(error) }, { status: 500 });
  }
}
