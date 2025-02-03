import { pgTable, serial, text, varchar, integer, timestamp, boolean } from "drizzle-orm/pg-core";

// 1) Chats
export const chats = pgTable("chats", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id", { length: 255 }).notNull(),
  name: varchar("name", { length: 255 }),
  projectId: integer("project_id"),
  projectDescriptionId: integer("project_description_id"),
  createdAt: timestamp("created_at", { withTimezone: false }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: false }).defaultNow().notNull(),
  // For local-first syncing:
  syncedAt: timestamp("synced_at", { withTimezone: false }),
  deleted: boolean("deleted").default(false).notNull(),
});

// 2) Chat Messages
export const chatMessages = pgTable("chat_messages", {
  id: serial("id").primaryKey(),
  chatId: integer("chat_id").notNull(),
  sender: varchar("sender", { length: 50 }).notNull(), // e.g. "user" / "bot"
  content: text("content").notNull(),
  createdAt: timestamp("created_at", { withTimezone: false }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: false }).defaultNow().notNull(),
  // Sync fields
  syncedAt: timestamp("synced_at", { withTimezone: false }),
  deleted: boolean("deleted").default(false).notNull(),
});

// 3) Projects
export const projects = pgTable("projects", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  createdAt: timestamp("created_at", { withTimezone: false }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: false }).defaultNow().notNull(),
  // Sync fields
  syncedAt: timestamp("synced_at", { withTimezone: false }),
  deleted: boolean("deleted").default(false).notNull(),
});

// 4) Project Descriptions
export const projectDescriptions = pgTable("project_descriptions", {
  id: serial("id").primaryKey(),
  language: varchar("language", { length: 100 }).notNull(),
  frameworks: text("frameworks"),
  metadata: text("metadata"),
  createdAt: timestamp("created_at", { withTimezone: false }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: false }).defaultNow().notNull(),
  // Sync fields
  syncedAt: timestamp("synced_at", { withTimezone: false }),
  deleted: boolean("deleted").default(false).notNull(),
});
