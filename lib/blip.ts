import { env } from "cloudflare:workers";

type RuntimeEnv = Record<string, string | undefined>;

export type BlipCommand = {
  id?: string;
  to?: string;
  method: "get" | "set" | "delete";
  uri: string;
  type?: string;
  resource?: unknown;
};

export type BlipCollection<T> = {
  total: number;
  items: T[];
};

export type BlipAttendant = {
  identity: string;
  fullName?: string;
  email?: string;
  teams?: string[];
  status?: string | number;
  lastServiceDate?: string;
  agentSlots?: number;
  ticketsInService?: number;
};

export type BlipTicket = {
  id: string;
  sequentialId?: string | number;
  customerIdentity: string;
  customerName?: string;
  agentIdentity?: string;
  attendantIdentity?: string;
  agentName?: string;
  attendantName?: string;
  team?: string;
  queue?: string;
  status?: string;
  provider?: string;
  storageDate?: string;
  closeDate?: string;
  lastMessageDate?: string;
  tags?: Array<string | { label?: string; value?: string }>;
  [key: string]: unknown;
};

export type BlipMessage = {
  id?: string;
  from?: string;
  to?: string;
  type?: string;
  content?: unknown;
  metadata?: Record<string, unknown>;
  extras?: Record<string, unknown>;
  storageDate?: string;
  status?: string;
  [key: string]: unknown;
};

function runtimeEnv() {
  return env as unknown as RuntimeEnv;
}

export function getBlipConfig() {
  const values = runtimeEnv();
  const contractId = values.BLIP_CONTRACT_ID?.trim() ?? "";
  const authKey = values.BLIP_AUTH_KEY?.trim() ?? "";
  const botId = values.BLIP_BOT_ID?.trim() ?? "";

  if (!contractId || !/^[a-z0-9-]+$/i.test(contractId)) {
    throw new Error("BLIP_CONTRACT_ID nao configurado ou invalido.");
  }
  if (!authKey) {
    throw new Error("BLIP_AUTH_KEY nao configurada no ambiente seguro.");
  }

  return {
    contractId,
    authKey,
    botId,
    endpoint: `https://${contractId}.http.msging.net/commands`,
  };
}

export function hasOpenAiKey() {
  return Boolean(runtimeEnv().OPENAI_API_KEY?.trim());
}

export function getWebhookSecret() {
  return runtimeEnv().BLIP_WEBHOOK_SECRET?.trim() ?? "";
}

export async function sendBlipCommand<T>(command: BlipCommand): Promise<T> {
  const config = getBlipConfig();
  const response = await fetch(config.endpoint, {
    method: "POST",
    headers: {
      Authorization: `Key ${config.authKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      id: command.id ?? crypto.randomUUID(),
      ...command,
    }),
  });

  if (!response.ok) {
    throw new Error(`Blip respondeu HTTP ${response.status}.`);
  }

  const payload = (await response.json()) as {
    status?: string;
    reason?: { description?: string };
    resource?: T;
  };

  if (payload.status === "failure") {
    throw new Error(payload.reason?.description ?? "Comando recusado pela Blip.");
  }

  return payload.resource as T;
}

function collection<T>(value: unknown): BlipCollection<T> {
  const resource = value as Partial<BlipCollection<T>> | undefined;
  return {
    total: Number(resource?.total ?? resource?.items?.length ?? 0),
    items: Array.isArray(resource?.items) ? resource.items : [],
  };
}

export async function listBlipAttendants() {
  const resource = await sendBlipCommand<BlipCollection<BlipAttendant>>({
    to: "postmaster@desk.msging.net",
    method: "get",
    uri: "/attendants",
  });
  return collection<BlipAttendant>(resource);
}

export async function listBlipTickets(skip = 0, take = 50) {
  const safeTake = Math.min(100, Math.max(1, take));
  const resource = await sendBlipCommand<BlipCollection<BlipTicket>>({
    to: "postmaster@desk.msging.net",
    method: "get",
    uri: `/tickets?$skip=${Math.max(0, skip)}&$take=${safeTake}`,
  });
  return collection<BlipTicket>(resource);
}

export async function getBlipThread(customerIdentity: string, take = 100) {
  const identity = encodeURIComponent(customerIdentity);
  const safeTake = Math.min(100, Math.max(1, take));

  try {
    const resource = await sendBlipCommand<BlipCollection<BlipMessage>>({
      to: "postmaster@desk.msging.net",
      method: "get",
      uri: `/threads-merged/${identity}?$take=${safeTake}&direction=desc&refreshExpiredMedia=true`,
      type: "application/vnd.iris.thread-message+json",
    });
    return collection<BlipMessage>(resource);
  } catch {
    const resource = await sendBlipCommand<BlipCollection<BlipMessage>>({
      method: "get",
      uri: `/threads/${identity}?$take=${safeTake}&direction=desc&refreshExpiredMedia=true`,
    });
    return collection<BlipMessage>(resource);
  }
}

export function attendantStatus(status: string | number | undefined) {
  const labels: Record<string, string> = {
    "0": "Offline",
    "1": "Pausa",
    "2": "Online",
    "3": "Invisivel",
  };
  return labels[String(status ?? "0")] ?? String(status ?? "Offline");
}

function extraString(extras: Record<string, unknown> | undefined, keys: string[]) {
  for (const key of keys) {
    const value = extras?.[key];
    if (typeof value === "string" && value.trim()) return value;
  }
  return "";
}

function messageContent(content: unknown, contentType: string) {
  if (typeof content === "string") {
    return { text: content, mediaUri: null as string | null };
  }
  if (!content || typeof content !== "object") {
    return { text: "Mensagem sem conteudo textual", mediaUri: null as string | null };
  }

  const object = content as Record<string, unknown>;
  const uri = typeof object.uri === "string" ? object.uri : null;
  const title = [object.title, object.text, object.caption, object.fileName]
    .find((value) => typeof value === "string") as string | undefined;

  if (title) return { text: title, mediaUri: uri };
  if (contentType.includes("audio")) return { text: "Mensagem de audio", mediaUri: uri };
  if (contentType.includes("image")) return { text: "Imagem enviada", mediaUri: uri };
  if (contentType.includes("document") || contentType.includes("file")) {
    return { text: "Documento enviado", mediaUri: uri };
  }
  return { text: JSON.stringify(object), mediaUri: uri };
}

export function normalizeBlipMessage(message: BlipMessage, fallbackTicketId = "") {
  const extras = message.extras ?? message.metadata;
  const envelopeType = message.type ?? "text/plain";
  const mediaType = message.content && typeof message.content === "object" && typeof (message.content as { type?: unknown }).type === "string"
    ? (message.content as { type: string }).type
    : "";
  const contentType = envelopeType.includes("media-link") && mediaType ? mediaType : envelopeType;
  const messageKind = extraString(extras, ["#messageKind", "messageKind"]).toLowerCase();
  const stateId = extraString(extras, ["#stateId", "stateId"]);
  const ticketFromState = stateId.startsWith("desk:") ? stateId.slice(5) : "";
  const ticketId = extraString(extras, ["#ticketId", "ticketId", "ticket"]) || ticketFromState || fallbackTicketId;
  const senderIdentity = message.from ?? "";
  const isSystem = contentType.includes("iris.ticket") || contentType.includes("notification");
  const isOutgoing = messageKind === "response" || senderIdentity.includes("@desk.msging.net");
  const role = isSystem ? "system" : isOutgoing ? "attendant" : "client";
  const customerIdentity = extraString(extras, ["#customerIdentity", "customerIdentity"])
    || (role === "client" ? message.from ?? "" : message.to ?? "");
  const content = messageContent(message.content, contentType);

  return {
    externalId: message.id ?? crypto.randomUUID(),
    ticketId,
    customerIdentity,
    senderIdentity,
    senderName: extraString(extras, ["#agentName", "agentName", "senderName"]),
    role,
    contentType,
    contentText: content.text,
    mediaUri: content.mediaUri,
    storageDate: extraString(extras, ["#envelope.storageDate", "envelope.storageDate"]) || message.storageDate || new Date().toISOString(),
    status: message.status ?? "Recebida",
    rawJson: JSON.stringify(message),
  };
}
