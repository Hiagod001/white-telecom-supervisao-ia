import { desc, eq } from "drizzle-orm";
import { getDb } from "../../../../db";
import { processDefinitions, processDocuments } from "../../../../db/schema";
import { requireAuth } from "../../../../lib/auth";

function routeError(error: unknown) {
  const message = error instanceof Error ? error.message : "Unexpected error";
  const cause = error && typeof error === "object" && "cause" in error
    ? (error as { cause?: { message?: string } }).cause?.message ?? ""
    : "";
  if (`${message} ${cause}`.includes("no such table")) {
    return "Banco D1 ainda nao esta migrado. Gere e publique as migracoes antes de usar processos reais.";
  }
  return message;
}

export async function GET(request: Request) {
  const auth = await requireAuth(request, ["Administrador", "Gestor"]);
  if (auth.response) return auth.response;
  try {
    const db = getDb();
    const [rows, documents] = await Promise.all([
      db.select().from(processDefinitions).orderBy(desc(processDefinitions.id)).limit(100),
      db.select().from(processDocuments).orderBy(desc(processDocuments.id)).limit(500),
    ]);

    return Response.json({
      processes: rows.map((row) => ({
        ...row,
        steps: JSON.parse(row.stepsJson),
        channels: JSON.parse(row.channelsJson),
        documents: documents.filter((document) => document.processId === row.id),
      })),
    });
  } catch (error) {
    return Response.json({ error: routeError(error) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await requireAuth(request, ["Administrador"]);
  if (auth.response) return auth.response;
  try {
    const payload = (await request.json()) as {
      name?: string;
      sector?: string;
      status?: string;
      objective?: string;
      instructions?: string;
      channels?: string[];
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
        instructions: payload.instructions?.trim() ?? "",
        status: payload.status ?? "Rascunho",
        channelsJson: JSON.stringify(payload.channels ?? []),
        stepsJson: JSON.stringify(payload.steps ?? []),
      })
      .returning();

    return Response.json(
      {
        process: {
          ...created,
          channels: JSON.parse(created.channelsJson),
          steps: JSON.parse(created.stepsJson),
          documents: [],
        },
      },
      { status: 201 },
    );
  } catch (error) {
    return Response.json({ error: routeError(error) }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const auth = await requireAuth(request, ["Administrador"]);
  if (auth.response) return auth.response;
  try {
    const payload = (await request.json()) as {
      id?: number;
      name?: string;
      sector?: string;
      status?: string;
      objective?: string;
      instructions?: string;
      channels?: string[];
      steps?: Array<{ name: string; weight: number; criterion: string }>;
    };
    if (!payload.id) {
      return Response.json({ error: "ID do processo e obrigatorio." }, { status: 400 });
    }

    const db = getDb();
    const [updated] = await db
      .update(processDefinitions)
      .set({
        name: payload.name?.trim(),
        sector: payload.sector,
        status: payload.status,
        objective: payload.objective?.trim(),
        instructions: payload.instructions?.trim(),
        channelsJson: payload.channels ? JSON.stringify(payload.channels) : undefined,
        stepsJson: payload.steps ? JSON.stringify(payload.steps) : undefined,
      })
      .where(eq(processDefinitions.id, payload.id))
      .returning();

    if (!updated) {
      return Response.json({ error: "Processo nao encontrado." }, { status: 404 });
    }
    return Response.json({ process: updated });
  } catch (error) {
    return Response.json({ error: routeError(error) }, { status: 500 });
  }
}
