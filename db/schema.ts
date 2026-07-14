import { sql } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  role: text("role").notNull(),
  team: text("team").notNull().default("Operacao"),
  status: text("status").notNull().default("Ativo"),
  passwordHash: text("password_hash").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const processDefinitions = sqliteTable("process_definitions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  sector: text("sector").notNull(),
  status: text("status").notNull().default("Rascunho"),
  objective: text("objective").notNull().default(""),
  instructions: text("instructions").notNull().default(""),
  channelsJson: text("channels_json").notNull().default("[]"),
  stepsJson: text("steps_json").notNull().default("[]"),
  version: text("version").notNull().default("v1.0"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const processDocuments = sqliteTable("process_documents", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  processId: integer("process_id")
    .notNull()
    .references(() => processDefinitions.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  mimeType: text("mime_type").notNull(),
  size: integer("size").notNull(),
  storageKey: text("storage_key"),
  extractedText: text("extracted_text").notNull().default(""),
  status: text("status").notNull().default("Disponivel"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const integrations = sqliteTable("integrations", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  provider: text("provider").notNull(),
  status: text("status").notNull().default("Nao configurado"),
  configJson: text("config_json").notNull().default("{}"),
  lastSyncAt: text("last_sync_at"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const notificationEvents = sqliteTable("notification_events", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  title: text("title").notNull(),
  kind: text("kind").notNull(),
  targetView: text("target_view").notNull(),
  targetId: text("target_id"),
  unread: integer("unread", { mode: "boolean" }).notNull().default(true),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const actionLogs = sqliteTable("action_logs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  action: text("action").notNull(),
  targetType: text("target_type").notNull(),
  targetId: text("target_id").notNull(),
  note: text("note").notNull().default(""),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const blipAttendants = sqliteTable("blip_attendants", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  identity: text("identity").notNull().unique(),
  fullName: text("full_name").notNull().default(""),
  email: text("email").notNull().default(""),
  teamsJson: text("teams_json").notNull().default("[]"),
  status: text("status").notNull().default("Offline"),
  agentSlots: integer("agent_slots").notNull().default(0),
  ticketsInService: integer("tickets_in_service").notNull().default(0),
  lastServiceAt: text("last_service_at"),
  syncedAt: text("synced_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const blipTickets = sqliteTable("blip_tickets", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  externalId: text("external_id").notNull().unique(),
  sequentialId: text("sequential_id").notNull().default(""),
  customerIdentity: text("customer_identity").notNull(),
  customerName: text("customer_name").notNull().default("Cliente Blip"),
  attendantIdentity: text("attendant_identity").notNull().default(""),
  attendantName: text("attendant_name").notNull().default("Nao atribuido"),
  team: text("team").notNull().default("Atendimento"),
  status: text("status").notNull().default("Waiting"),
  channel: text("channel").notNull().default("WhatsApp"),
  openedAt: text("opened_at").notNull(),
  closedAt: text("closed_at"),
  lastMessageAt: text("last_message_at"),
  tagsJson: text("tags_json").notNull().default("[]"),
  rawJson: text("raw_json").notNull().default("{}"),
  syncedAt: text("synced_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const blipMessages = sqliteTable("blip_messages", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  externalId: text("external_id").notNull().unique(),
  ticketId: text("ticket_id").notNull(),
  customerIdentity: text("customer_identity").notNull().default(""),
  senderIdentity: text("sender_identity").notNull().default(""),
  senderName: text("sender_name").notNull().default(""),
  role: text("role").notNull(),
  contentType: text("content_type").notNull().default("text/plain"),
  contentText: text("content_text").notNull().default(""),
  mediaUri: text("media_uri"),
  storageDate: text("storage_date").notNull(),
  status: text("status").notNull().default("Recebida"),
  rawJson: text("raw_json").notNull().default("{}"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const blipSyncRuns = sqliteTable("blip_sync_runs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  status: text("status").notNull(),
  attendants: integer("attendants").notNull().default(0),
  tickets: integer("tickets").notNull().default(0),
  messages: integer("messages").notNull().default(0),
  details: text("details").notNull().default(""),
  startedAt: text("started_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  finishedAt: text("finished_at"),
});

export const conversationAnalyses = sqliteTable("conversation_analyses", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  ticketId: text("ticket_id").notNull().unique(),
  processIdsJson: text("process_ids_json").notNull().default("[]"),
  status: text("status").notNull().default("Pendente"),
  model: text("model").notNull().default(""),
  resultJson: text("result_json").notNull().default("{}"),
  error: text("error").notNull().default(""),
  analyzedAt: text("analyzed_at"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});
