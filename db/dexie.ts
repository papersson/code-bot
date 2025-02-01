// db/dexie.ts
"use client";

import Dexie, { Table } from "dexie";

export interface Chat {
  id?: number;
  userId: string;
  name?: string;                      // <-- New: name/title for the chat
  projectId?: number | null;         
  projectDescriptionId?: number | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface ChatMessage {
  id?: number;
  chatId: number;
  sender: string;  // "user" or "bot"
  content: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface Project {
  id?: number;
  name: string;
  description?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface ProjectDescription {
  id?: number;
  language: string;
  frameworks?: string;
  metadata?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

class LocalDB extends Dexie {
  chats!: Table<Chat>;
  chatMessages!: Table<ChatMessage>;
  projects!: Table<Project>;
  projectDescriptions!: Table<ProjectDescription>;

  constructor() {
    super("LocalFirstChatDB");

    this.version(1).stores({
      chats:
        "++id, userId, projectId, projectDescriptionId", 
      chatMessages:
        "++id, chatId, sender",
      projects:
        "++id, name",
      projectDescriptions:
        "++id, language"
    });
  }
}

export const db = new LocalDB();

export async function clearAllLocalData() {
  await Promise.all([
    db.chats.clear(),
    db.chatMessages.clear(),
    db.projects.clear(),
    db.projectDescriptions.clear(),
  ]);
}
