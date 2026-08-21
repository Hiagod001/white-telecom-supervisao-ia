import { eq } from "drizzle-orm";
import { getDb } from "../db";
import { blipAttendants, blipMessages, blipTickets, conversationAnalyses } from "../db/schema";
import {
  attendantStatus,
  normalizeBlipMessage,
  type BlipAttendant,
  type BlipMessage,
  type BlipTicket,
} from "./blip";

function channelFromIdentity(identity: string, provider = "") {
  const value = `${identity} ${provider}`.toLowerCase();
  if (value.includes("whatsapp") || value.includes("wa.gw")) return "WhatsApp";
  if (value.includes("telegram")) return "Telegram";
  if (value.includes("messenger")) return "Messenger";
  if (value.includes("instagram")) return "Instagram";
  if (value.includes("blipchat") || value.includes("0mn.io")) return "Blip Chat";
  return "Chat";
}

export function inferSector(team: string) {
  const value = team.toLowerCase();
  if (/comercial|venda|sales|lead/.test(value)) return "Comercial";
  if (/retenc|cancel|churn/.test(value)) return "Retencao";
  return "Atendimento";
}

function tagLabels(tags: BlipTicket["tags"]) {
  return (tags ?? []).map((tag) => {
    if (typeof tag === "string") return tag;
    return tag.label ?? tag.value ?? "";
  }).filter(Boolean);
}

export async function upsertBlipAttendant(attendant: BlipAttendant) {
  const db = getDb();
  const values = {
    identity: attendant.identity,
    fullName: attendant.fullName ?? attendant.email ?? attendant.identity,
    email: attendant.email ?? "",
    teamsJson: JSON.stringify(attendant.teams ?? []),
    status: attendantStatus(attendant.status),
    agentSlots: Number(attendant.agentSlots ?? 0),
    ticketsInService: Number(attendant.ticketsInService ?? 0),
    lastServiceAt: attendant.lastServiceDate ?? null,
    syncedAt: new Date().toISOString(),
  };

  await db.insert(blipAttendants).values(values).onConflictDoUpdate({
    target: blipAttendants.identity,
    set: values,
  });
}

export async function upsertBlipTicket(ticket: BlipTicket) {
  const db = getDb();
  const team = ticket.team ?? ticket.queue ?? "Atendimento";
  const attendantIdentity = ticket.agentIdentity ?? ticket.attendantIdentity ?? "";
  const attendantName = ticket.agentName ?? ticket.attendantName ?? (attendantIdentity || "Nao atribuido");
  const openedAt = ticket.openDate ?? ticket.storageDate ?? new Date().toISOString();
  const values = {
    externalId: ticket.id,
    sequentialId: String(ticket.sequentialId ?? ""),
    customerIdentity: ticket.customerIdentity,
    customerName: ticket.customerName ?? String(ticket.customerIdentity).split("@")[0] ?? "Cliente Blip",
    attendantIdentity,
    attendantName,
    team,
    status: ticket.status ?? "Waiting",
    channel: channelFromIdentity(ticket.customerIdentity, ticket.provider ?? ""),
    openedAt,
    closedAt: ticket.closeDate ?? null,
    lastMessageAt: ticket.lastMessageDate ?? openedAt,
    tagsJson: JSON.stringify(tagLabels(ticket.tags)),
    rawJson: JSON.stringify(ticket),
    syncedAt: new Date().toISOString(),
  };

  await db.insert(blipTickets).values(values).onConflictDoUpdate({
    target: blipTickets.externalId,
    set: values,
  });

  await db.insert(conversationAnalyses).values({
    ticketId: ticket.id,
    status: "Pendente",
  }).onConflictDoNothing({ target: conversationAnalyses.ticketId });
}

export async function upsertBlipMessage(message: BlipMessage, ticketId = "") {
  const db = getDb();
  const normalized = normalizeBlipMessage(message, ticketId);
  const safeTicketId = normalized.ticketId || `thread:${normalized.customerIdentity || normalized.senderIdentity}`;
  const values = { ...normalized, ticketId: safeTicketId };

  await db.insert(blipMessages).values(values).onConflictDoUpdate({
    target: blipMessages.externalId,
    set: {
      status: normalized.status,
      mediaUri: normalized.mediaUri,
      rawJson: normalized.rawJson,
    },
  });
  return values;
}

export async function findTicket(externalId: string) {
  const db = getDb();
  const [ticket] = await db
    .select()
    .from(blipTickets)
    .where(eq(blipTickets.externalId, externalId))
    .limit(1);
  return ticket;
}
