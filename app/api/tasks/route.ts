import { desc, eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { tasks } from "../../../db/schema";

type TaskStatus = "Pendente" | "Em andamento" | "Resolvida" | "Cancelada";
type TaskPriority = "Baixa" | "Media" | "Alta" | "Critica";

function routeError(error: unknown) {
  const message = error instanceof Error ? error.message : "Erro inesperado";
  const cause = error && typeof error === "object" && "cause" in error
    ? (error as { cause?: { message?: string } }).cause?.message ?? ""
    : "";
  if (`${message} ${cause}`.includes("no such table")) {
    return "Banco D1 ainda nao esta migrado para tarefas.";
  }
  return message;
}

function validStatus(value: string): value is TaskStatus {
  return ["Pendente", "Em andamento", "Resolvida", "Cancelada"].includes(value);
}

function validPriority(value: string): value is TaskPriority {
  return ["Baixa", "Media", "Alta", "Critica"].includes(value);
}

export async function GET() {
  try {
    const db = getDb();
    const rows = await db.select().from(tasks).orderBy(desc(tasks.updatedAt)).limit(500);
    return Response.json({ tasks: rows });
  } catch (error) {
    const message = routeError(error);
    if (message.includes("ainda nao esta migrado")) return Response.json({ tasks: [] });
    return Response.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as {
      title?: string;
      description?: string;
      owner?: string;
      priority?: string;
      dueDate?: string | null;
      sourceType?: string;
      sourceId?: string | null;
      sourceTitle?: string;
      conversationId?: string | null;
      createdBy?: string;
    };
    const title = payload.title?.trim() ?? "";
    const description = payload.description?.trim() ?? "";
    const owner = payload.owner?.trim() ?? "";
    const priority = payload.priority?.trim() ?? "Media";

    if (!title || !description || !owner) {
      return Response.json({ error: "Titulo, descricao e responsavel sao obrigatorios." }, { status: 400 });
    }
    if (!validPriority(priority)) {
      return Response.json({ error: "Prioridade invalida." }, { status: 400 });
    }

    const db = getDb();
    const [created] = await db.insert(tasks).values({
      title,
      description,
      owner,
      priority,
      dueDate: payload.dueDate || null,
      sourceType: payload.sourceType?.trim() || "Manual",
      sourceId: payload.sourceId || null,
      sourceTitle: payload.sourceTitle?.trim() || "",
      conversationId: payload.conversationId || null,
      createdBy: payload.createdBy?.trim() || "Hiago Nunes",
    }).returning();

    return Response.json({ task: created }, { status: 201 });
  } catch (error) {
    return Response.json({ error: routeError(error) }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const payload = (await request.json()) as {
      id?: number;
      title?: string;
      description?: string;
      owner?: string;
      priority?: string;
      status?: string;
      dueDate?: string | null;
      resolutionNote?: string;
    };
    if (!payload.id) return Response.json({ error: "ID da tarefa e obrigatorio." }, { status: 400 });
    if (payload.status && !validStatus(payload.status)) {
      return Response.json({ error: "Status invalido." }, { status: 400 });
    }
    if (payload.priority && !validPriority(payload.priority)) {
      return Response.json({ error: "Prioridade invalida." }, { status: 400 });
    }
    if (payload.status === "Resolvida" && !payload.resolutionNote?.trim()) {
      return Response.json({ error: "Informe como a tarefa foi resolvida." }, { status: 400 });
    }

    const db = getDb();
    const [updated] = await db.update(tasks).set({
      title: payload.title?.trim(),
      description: payload.description?.trim(),
      owner: payload.owner?.trim(),
      priority: payload.priority,
      status: payload.status,
      dueDate: payload.dueDate === undefined ? undefined : payload.dueDate || null,
      resolutionNote: payload.resolutionNote?.trim(),
      updatedAt: new Date().toISOString(),
      completedAt: payload.status === "Resolvida" ? new Date().toISOString() : payload.status ? null : undefined,
    }).where(eq(tasks.id, payload.id)).returning();

    if (!updated) return Response.json({ error: "Tarefa nao encontrada." }, { status: 404 });
    return Response.json({ task: updated });
  } catch (error) {
    return Response.json({ error: routeError(error) }, { status: 500 });
  }
}
