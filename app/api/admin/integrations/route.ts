import { desc } from "drizzle-orm";
import { getDb } from "../../../../db";
import { integrations } from "../../../../db/schema";

function routeError(error: unknown) {
  const message = error instanceof Error ? error.message : "Unexpected error";
  if (message.includes("no such table")) {
    return "Banco D1 ainda nao esta migrado. Gere e publique as migracoes antes de salvar integracoes.";
  }
  return message;
}

export async function GET() {
  try {
    const db = getDb();
    const rows = await db
      .select()
      .from(integrations)
      .orderBy(desc(integrations.id))
      .limit(50);

    return Response.json({ integrations: rows });
  } catch (error) {
    return Response.json({ error: routeError(error) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as {
      provider?: string;
      status?: string;
      config?: Record<string, string>;
    };
    const provider = payload.provider?.trim() ?? "";

    if (!provider) {
      return Response.json({ error: "Provider e obrigatorio." }, { status: 400 });
    }

    const db = getDb();
    const [created] = await db
      .insert(integrations)
      .values({
        provider,
        status: payload.status ?? "Configurado",
        configJson: JSON.stringify(payload.config ?? {}),
      })
      .returning();

    return Response.json({ integration: created }, { status: 201 });
  } catch (error) {
    return Response.json({ error: routeError(error) }, { status: 500 });
  }
}
