import { desc } from "drizzle-orm";
import { getDb } from "../../../../db";
import { processDefinitions } from "../../../../db/schema";

function routeError(error: unknown) {
  const message = error instanceof Error ? error.message : "Unexpected error";
  if (message.includes("no such table")) {
    return "Banco D1 ainda nao esta migrado. Gere e publique as migracoes antes de usar processos reais.";
  }
  return message;
}

export async function GET() {
  try {
    const db = getDb();
    const rows = await db
      .select()
      .from(processDefinitions)
      .orderBy(desc(processDefinitions.id))
      .limit(100);

    return Response.json({ processes: rows });
  } catch (error) {
    return Response.json({ error: routeError(error) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as {
      name?: string;
      sector?: string;
      status?: string;
      objective?: string;
      steps?: Array<{ name: string; weight: number; criterion: string }>;
    };
    const name = payload.name?.trim() ?? "";
    const sector = payload.sector?.trim() ?? "Atendimento";
    const objective = payload.objective?.trim() ?? "";

    if (!name || !objective) {
      return Response.json(
        { error: "Nome e objetivo do processo sao obrigatorios." },
        { status: 400 },
      );
    }

    const db = getDb();
    const [created] = await db
      .insert(processDefinitions)
      .values({
        name,
        sector,
        objective,
        status: payload.status ?? "Rascunho",
        stepsJson: JSON.stringify(payload.steps ?? []),
      })
      .returning();

    return Response.json({ process: created }, { status: 201 });
  } catch (error) {
    return Response.json({ error: routeError(error) }, { status: 500 });
  }
}
