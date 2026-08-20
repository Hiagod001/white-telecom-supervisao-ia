import { runtimeEnv } from "./runtime-env";

export type BlipCommand = {
  id?: string;
  to?: string;
  method: "get" | "set" | "delete";
  uri: string;
  type?: string;
  resource?: unknown;
};

export type BlipSourceConfig = {
  id: string;
  label: string;
  contractId: string;
  botId: string;
  authKey: string;
  endpoint: string;
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

function sourceConfig(source: {
  id?: string;
  label?: string;
  contractId?: string;
  botId?: string;
  authKey?: string;
}, fallbackContractId: string, index: number): BlipSourceConfig | null {
  const contractId = source.contractId?.trim() || fallbackContractId;
  const authKey = source.authKey?.trim() ?? "";
  const botId = source.botId?.trim() ?? "";
  if (!contractId || !/^[a-z0-9-]+$/i.test(contractId) || !authKey) return null;
  return {
    id: source.id?.trim() || botId || `blip-${index + 1}`,
    label: source.label?.trim() || botId || `Blip ${index + 1}`,
    contractId,
    botId,
    authKey,
    endpoint: `https://${contractId}.http.msging.net/commands`,
  };
}

export function getBlipSources() {
  const values = runtimeEnv();
  const contractId = values.BLIP_CONTRACT_ID?.trim() ?? "";

  if (values.BLIP_SOURCES_JSON?.trim()) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(values.BLIP_SOURCES_JSON);
    } catch {
      throw new Error("BLIP_SOURCES_JSON possui JSON invalido.");
    }
    if (!Array.isArray(parsed)) throw new Error("BLIP_SOURCES_JSON deve ser uma lista de conexoes.");
    const sources = parsed
      .map((value, index) => sourceConfig(value as Record<string, string>, contractId, index))
      .filter((value): value is BlipSourceConfig => Boolean(value));
    if (sources.length) return sources;
  }

  if (!contractId || !/^[a-z0-9-]+$/i.test(contractId)) {
    throw new Error("BLIP_CONTRACT_ID nao configurado ou invalido.");
  }
  const authKey = values.BLIP_AUTH_KEY?.trim() ?? "";
  if (!authKey) {
    throw new Error("BLIP_AUTH_KEY nao configurada no ambiente seguro.");
  }
  return [sourceConfig({
    id: values.BLIP_BOT_ID,
    label: values.BLIP_BOT_ID,
    botId: values.BLIP_BOT_ID,
    authKey,
  }, contractId, 0)!];
}

export function getBlipConfig() {
  return getBlipSources()[0];
}

export function hasOpenAiKey() {
  return Boolean(runtimeEnv().OPENAI_API_KEY?.trim());
}

export function getWebhookSecret() {
  return runtimeEnv().BLIP_WEBHOOK_SECRET?.trim() ?? "";
}

export async function sendBlipCommand<T>(command: BlipCommand, config = getBlipConfig()): Promise<T> {
  const authorization = /^Key\s+/i.test(config.authKey) ? config.authKey : `Key ${config.authKey}`;
  const response = await fetch(config.endpoint, {
    method: "POST",
    headers: {
      Authorization: authorization,
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

export async function listBlipAttendants(config = getBlipConfig(), skip = 0, take = 100) {
  const safeTake = Math.min(100, Math.max(1, take));
  const resource = await sendBlipCommand<BlipCollection<BlipAttendant>>({
    to: "postmaster@desk.msging.net",
    method: "get",
    uri: `/attendants?$skip=${Math.max(0, skip)}&$take=${safeTake}`,
  }, config);
  return collection<BlipAttendant>(resource);
}

export const SUPERVISION_BLIP_TEAMS = ["Suporte", "Comercial"] as const;

function supervisionTeams(teams: string[] | undefined) {
  return (teams ?? []).filter((team) =>
    SUPERVISION_BLIP_TEAMS.some((allowed) => allowed.localeCompare(team.trim(), "pt-BR", { sensitivity: "accent" }) === 0),
  );
}

export async function listSupervisionAttendants() {
  const sources = getBlipSources();
  const results = await Promise.all(sources.map(async (source) => {
    const collection = await listBlipAttendants(source, 0, 100);
    const attendants = collection.items
      .map((attendant) => ({ ...attendant, teams: supervisionTeams(attendant.teams) }))
      .filter((attendant) => attendant.identity && attendant.teams.length > 0);
    return { sourceId: source.id, sourceLabel: source.label, attendants };
  }));
  return results;
}

export function isBlipTicketImportEnabled() {
  return runtimeEnv().BLIP_TICKET_IMPORT_ENABLED?.trim().toLowerCase() === "true";
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

export async function getBlipTicketMessages(ticketId: string, refreshExpiredMedia = false, take = 100) {
  const safeTicketId = encodeURIComponent(ticketId);
  const safeTake = Math.min(100, Math.max(1, take));
  const refresh = refreshExpiredMedia ? "&refreshExpiredMedia=true" : "";
  const resource = await sendBlipCommand<BlipCollection<BlipMessage>>({
    to: "postmaster@desk.msging.net",
    method: "get",
    uri: `/tickets/${safeTicketId}/messages?getFromOwnerIfTunnel=true&$take=${safeTake}&$ascending=true${refresh}`,
  });
  return collection<BlipMessage>(resource);
}

export async function refreshBlipMediaUrl(ticketId: string, messageId: string) {
  const messages = await getBlipTicketMessages(ticketId, true, 100);
  const message = messages.items.find((item) => item.id === messageId);
  if (!message) throw new Error("A mensagem de audio nao foi localizada novamente na Blip.");
  const normalized = normalizeBlipMessage(message, ticketId);
  if (!normalized.mediaUri) throw new Error("A Blip nao retornou uma URL renovada para o audio.");
  return normalized.mediaUri;
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
