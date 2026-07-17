import { getDb } from "../../../db";
import { actionLogs, notificationEvents } from "../../../db/schema";
import { requireAuth } from "../../../lib/auth";

function routeError(error: unknown) {
  const message = error instanceof Error ? error.message : "Unexpected error";
  if (message.includes("no such table")) {
    return "Banco D1 ainda nao esta migrado. A acao foi aplicada na tela, mas nao foi gravada.";
  }
  return message;
}

export async function POST(request: Request) {
  const auth = await requireAuth(request);
  if (auth.response || !auth.user) return auth.response;
  try {
    const payload = (await request.json()) as {
      action?: string;
      targetType?: string;
      targetId?: string;
      note?: string;
    };
    const action = payload.action?.trim() ?? "";
    const targetType = payload.targetType?.trim() ?? "";
    const targetId = payload.targetId?.trim() ?? "";

    const operatorActions = ["feedback", "contest", "mark_notification_read", "open_ticket"];
    if (auth.user.role === "Operador" && !operatorActions.includes(action)) {
      return Response.json({ error: "Seu perfil nao pode executar esta acao." }, { status: 403 });
    }

    if (!action || !targetType || !targetId) {
      return Response.json(
        { error: "action, targetType e targetId sao obrigatorios." },
        { status: 400 },
      );
    }

    const db = getDb();
    const [log] = await db
      .insert(actionLogs)
      .values({
        action,
        targetType,
        targetId,
        note: payload.note ?? "",
        actorUserId: auth.user.id,
        actorName: auth.user.name,
      })
      .returning();

    if (action === "mark_notification_read") {
      await db
        .insert(notificationEvents)
        .values({
          title: `Notificacao lida: ${targetId}`,
          kind: "read",
          targetView: "alerts",
          targetId,
          unread: false,
        })
        .returning();
    }

    return Response.json({ action: log }, { status: 201 });
  } catch (error) {
    return Response.json({ error: routeError(error) }, { status: 500 });
  }
}
