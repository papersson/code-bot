// db/dexie.ts
"use client";

import Dexie, { Table } from "dexie";

/** 
 * Define TypeScript interfaces that match our local storage shape.
 * They can mirror (or differ from) your Drizzle/SQL schema if you like.
 */
export interface Chat {
  id?: number;         // Primary key (auto-increment)
  userId: string;      // The user's email or ID
  createdAt?: Date;
}

export interface ChatMessage {
  id?: number;         // Primary key (auto-increment)
  chatId: number;      // foreign key to Chat.id
  sender: string;      // "user" or "bot"
  content: string;
  createdAt?: Date;
}

export interface Project {
  id?: number;         // PK
  name: string;
  description?: string | null;
  createdAt?: Date;
}

export interface ProjectDescription {
  id?: number;         // PK
  language: string;
  frameworks?: string;
  metadata?: string;
}

/** Our Dexie DB class */
class LocalDB extends Dexie {
  // Dexie 'Table' definitions
  chats!: Table<Chat>;
  chatMessages!: Table<ChatMessage>;
  projects!: Table<Project>;
  projectDescriptions!: Table<ProjectDescription>;

  constructor() {
    super("LocalFirstChatDB");

    this.version(1).stores({
      // "++id" => auto-increment primary key
      chats: "++id, userId",
      chatMessages: "++id, chatId, sender",
      projects: "++id, name",
      projectDescriptions: "++id, language"
    });

    // Optionally, add a migration for older versions if needed.
    // this.version(2).stores({ ... }).upgrade(tx => { ... });
  }
}

// Export a singleton DB instance
export const db = new LocalDB();

// For convenience, if you want a "sync" or "persist" function:
export async function clearAllLocalData() {
  // Danger: clears all your local data
  await Promise.all([
    db.chats.clear(),
    db.chatMessages.clear(),
    db.projects.clear(),
    db.projectDescriptions.clear(),
  ]);
}
