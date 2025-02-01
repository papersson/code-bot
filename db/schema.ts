// db/schema.ts
import { pgTable, serial, varchar, integer, timestamp, text } from "drizzle-orm/pg-core";

export const chats = pgTable("chats", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id", { length: 255 }),
  projectId: integer("project_id"),
  projectDescriptionId: integer("project_desc_id"),
  createdAt: timestamp("created_at"),
  updatedAt: timestamp("updated_at")
});

export const chatMessages = pgTable("chat_messages", {
  id: serial("id").primaryKey(),
  chatId: integer("chat_id"),
  sender: varchar("sender", { length: 255 }),
  content: text("content"),
  createdAt: timestamp("created_at"),
  updatedAt: timestamp("updated_at")
});

export const projects = pgTable("projects", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }),
  description: text("description"),
  createdAt: timestamp("created_at"),
  updatedAt: timestamp("updated_at")
});

export const projectDescriptions = pgTable("project_descriptions", {
  id: serial("id").primaryKey(),
  language: varchar("language", { length: 255 }),
  frameworks: text("frameworks"),
  metadata: text("metadata"),
  createdAt: timestamp("created_at"),
  updatedAt: timestamp("updated_at")
});