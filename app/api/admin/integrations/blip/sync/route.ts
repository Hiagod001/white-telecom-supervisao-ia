import { eq } from "drizzle-orm";
import { getDb } from "../../../../../../db";
import { blipSyncRuns } from "../../../../../../db/schema";
import { listSupervisionAttendants } from "../../../../../../lib/blip";
import { upsertBlipAttendant } from "../../../../../../lib/blip-storage";
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
    const [run] = await db
      .insert(blipSyncRuns)
      .values({ status: "Executando" })
      .returning({ id: blipSyncRuns.id });
    runId = run.id;

    const sources = await listSupervisionAttendants();
    let attendantCount = 0;
    for (const source of sources) {
      for (const attendant of source.attendants) {
        await upsertBlipAttendant(attendant);
        attendantCount += 1;
      }
    }

    await db
      .update(blipSyncRuns)
      .set({
        status: "Concluido",
        attendants: attendantCount,
        tickets: 0,
        messages: 0,
        details: `Somente agentes de Suporte e Comercial. Fontes: ${sources.map((source) => source.sourceLabel).join(", ")}.`,
        finishedAt: new Date().toISOString(),
      })
      .where(eq(blipSyncRuns.id, runId));

    return Response.json({
      synchronized: true,
      attendants: attendantCount,
      tickets: 0,
      messages: 0,
      analysisQueued: 0,
      ticketImportEnabled: false,
      sources: sources.map((source) => ({
        id: source.sourceId,
        label: source.sourceLabel,
        attendants: source.attendants.length,
      })),
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
