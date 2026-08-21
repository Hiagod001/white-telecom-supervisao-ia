export type BlipTicketWindow = {
  id?: string;
  openDate?: string;
  storageDate?: string;
  closeDate?: string;
};

export type BlipTicketMessage = {
  id?: string;
  date?: string;
  storageDate?: string;
  direction?: string;
  type?: string;
  metadata?: Record<string, unknown>;
  extras?: Record<string, unknown>;
};

function metadataValue(message: BlipTicketMessage, key: string) {
  const value = (message.metadata ?? message.extras)?.[key];
  return typeof value === "string" ? value : "";
}

function messageDate(message: BlipTicketMessage) {
  return message.date
    || message.storageDate
    || metadataValue(message, "#envelope.storageDate")
    || metadataValue(message, "envelope.storageDate");
}

function timestamp(value: string | undefined) {
  if (!value) return Number.NaN;
  return new Date(value).getTime();
}

export function filterBlipTicketMessages(
  ticket: BlipTicketWindow,
  items: BlipTicketMessage[],
  ticketId: string,
  now = new Date(),
) {
  const startDate = ticket.openDate || ticket.storageDate;
  const endDate = ticket.closeDate || now.toISOString();
  const start = timestamp(startDate);
  const end = timestamp(endDate);

  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) {
    throw new Error(`Ticket ${ticketId} possui uma janela de atendimento invalida.`);
  }

  const messages = items.filter((item) => {
    if (!item) return false;
    const date = timestamp(messageDate(item));
    if (!Number.isFinite(date) || date < start || date > end) return false;

    const direction = item.direction?.toLowerCase();
    if (direction === "sent") {
      const emitter = metadataValue(item, "#messageEmitter");
      const messageTicketId = metadataValue(item, "#message.ticketId");
      return emitter.toLowerCase() === "human" && messageTicketId === ticketId;
    }

    if (direction === "received") {
      return item.type !== "application/vnd.iris.ticket+json";
    }

    return false;
  });

  messages.sort((left, right) => timestamp(messageDate(left)) - timestamp(messageDate(right)));

  return {
    ticketId,
    startDate: startDate!,
    endDate,
    total: messages.length,
    items: messages,
  };
}
