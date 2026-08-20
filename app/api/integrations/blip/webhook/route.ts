import { getWebhookSecret, isBlipTicketImportEnabled, type BlipMessage, type BlipTicket } from "../../../../../lib/blip";
import { upsertBlipMessage, upsertBlipTicket } from "../../../../../lib/blip-storage";

function routeError(error: unknown) {
  const message = error instanceof Error ? error.message : "Unexpected error";
  if (message.includes("no such table")) {
    return "Banco D1 ainda nao esta migrado para a integracao Blip.";
  }
  return message;
}

function asRecord(value: unknown) {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

function ticketFromPayload(payload: Record<string, unknown>) {
  const type = typeof payload.type === "string" ? payload.type : "";
  if (!type.includes("iris.ticket")) return null;
  const content = asRecord(payload.content);
  if (!content || typeof content.id !== "string" || typeof content.customerIdentity !== "string") return null;
  return content as unknown as BlipTicket;
}

export async function POST(request: Request) {
  try {
    const expectedSecret = getWebhookSecret();
    const receivedSecret = request.headers.get("x-uai-blip-secret") ?? "";
    if (!expectedSecret) {
      return Response.json({ error: "Webhook Blip nao configurado." }, { status: 503 });
    }
    if (receivedSecret !== expectedSecret) {
      return Response.json({ error: "Assinatura do webhook invalida." }, { status: 401 });
    }

    if (!isBlipTicketImportEnabled()) {
      return Response.json({
        accepted: true,
        ignored: true,
        reason: "Importacao de tickets aguardando a publicacao dos processos.",
      });
    }

    const body = await request.json();
    const items = Array.isArray(body) ? body : [body];
    let messages = 0;
    let tickets = 0;
    let ignored = 0;

    for (const item of items) {
      const payload = asRecord(item);
      if (!payload) {
        ignored += 1;
        continue;
      }

      const ticket = ticketFromPayload(payload);
      if (ticket) {
        await upsertBlipTicket(ticket);
        tickets += 1;
        continue;
      }

      if (typeof payload.type === "string") {
        await upsertBlipMessage(payload as BlipMessage);
        messages += 1;
      } else {
        ignored += 1;
      }
    }

    return Response.json({ accepted: true, messages, tickets, ignored });
  } catch (error) {
    return Response.json({ error: routeError(error) }, { status: 500 });
  }
}
