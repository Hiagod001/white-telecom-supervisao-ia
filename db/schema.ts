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
  stepsJson: text("steps_json").notNull().default("[]"),
  version: text("version").notNull().default("v1.0"),
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
