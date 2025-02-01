import { pgTable, serial, text, timestamp, integer } from "drizzle-orm/pg-core";

// ProjectDescription
export const ProjectDescription = pgTable("project_description", {
  id: serial("id").primaryKey(),
  language: text("language").notNull(),
  frameworks: text("frameworks"),
  metadata: text("metadata"),
});

// A Chat session (each conversation)
export const Chat = pgTable("chat", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(), // ID from NextAuth user
  // Link to a project description if desired (nullable)
  projectDescriptionId: integer("project_description_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// A ChatMessage associated with a Chat session
export const ChatMessage = pgTable("chat_message", {
  id: serial("id").primaryKey(),
  chatId: integer("chat_id").references(() => Chat.id),
  sender: text("sender").notNull(), // "user" or "bot"
  content: text("content").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// A Project groups chat sessions together
export const Project = pgTable("project", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
