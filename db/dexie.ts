"use client";

import Dexie, { Table } from "dexie";

export interface Chat {
  id?: number;
  userId: string;
  name?: string;
  projectId?: number | null;
  projectDescriptionId?: number | null;
  createdAt?: Date;
  updatedAt?: Date;

  // For syncing:
  syncedAt?: Date | null;
  deleted?: boolean;
}

export interface ChatMessage {
  id?: number;
  chatId: number;
  sender: string;  // "user" or "bot"
  content: string;
  createdAt?: Date;
  updatedAt?: Date;

  // For syncing:
  syncedAt?: Date | null;
  deleted?: boolean;
}

export interface Project {
  id?: number;
  name: string;
  description?: string | null;
  createdAt?: Date;
  updatedAt?: Date;

  syncedAt?: Date | null;
  deleted?: boolean;
}

export interface ProjectDescription {
  id?: number;
  language: string;
  frameworks?: string;
  metadata?: string;
  createdAt?: Date;
  updatedAt?: Date;

  syncedAt?: Date | null;
  deleted?: boolean;
}

class LocalDB extends Dexie {
  chats!: Table<Chat>;
  chatMessages!: Table<ChatMessage>;
  projects!: Table<Project>;
  projectDescriptions!: Table<ProjectDescription>;

  constructor() {
    super("LocalFirstChatDB");

    // If you want to add new indexes for your new fields, you can do so here.
    // The simplest is just to keep the default store definitions.
    this.version(2).stores({
      chats: "++id, userId, projectId",
      chatMessages: "++id, chatId, sender",
      projects: "++id, name",
      projectDescriptions: "++id, language",
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
