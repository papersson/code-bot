// db/drizzle.ts
"use client";

import initSqlJs from "sql.js";
import localforage from "localforage";
import { drizzle } from "drizzle-orm";               // <— from "drizzle-orm"
import { createSqliteDialect } from "drizzle-orm/sqlite-core"; // <— from "drizzle-orm/sqlite-core"
import * as schema from "./schema";
import { SQLJsDriver } from "./sqlJsDriver";

// We'll store the DB as a Uint8Array in IndexedDB
const DB_NAME = "local-first-chatbot-db";

// Our singleton Drizzle instance
let dbSingleton: ReturnType<typeof drizzle> | null = null;

/**
 * Attempts to load an existing DB from IndexedDB.
 * If none is found, create a brand-new in-memory sql.js Database.
 */
async function loadOrCreateDatabase(SQL: typeof import("sql.js")) {
  const storedData = await localforage.getItem<Uint8Array>(DB_NAME);
  if (storedData) {
    // Load from persisted Uint8Array
    return new SQL.Database(storedData);
  }
  // Otherwise brand new
  return new SQL.Database();
}

/**
 * getDb():
 *  - Initializes sql.js
 *  - Loads or creates the DB
 *  - Wraps it in a custom driver + a Drizzle SQLite dialect
 *  - Returns the Drizzle instance
 */
export async function getDb() {
  if (dbSingleton) return dbSingleton;

  // Initialize sql.js from /public/sql-wasm.wasm
  const SQL = await initSqlJs({
    locateFile: () => "/sql-wasm.wasm",
  });

  // Load or create the underlying sql.js Database
  const sqlJsDb = await loadOrCreateDatabase(SQL);

  // Build the custom driver
  const driver = new SQLJsDriver(sqlJsDb);

  // Create the dialect for "drizzle-orm/sqlite-core"
  const sqliteDialect = createSqliteDialect({ driver });

  // Finally, create the Drizzle instance
  dbSingleton = drizzle(sqliteDialect, { schema });

  return dbSingleton;
}

/**
 * Persist the current DB to IndexedDB.
 */
export async function persistDatabase() {
  if (!dbSingleton) return;

  // The underlying sql.js Database is in our custom driver:
  // Access it via dbSingleton.__driver.db
  const driver = dbSingleton.__driver as SQLJsDriver;
  const sqlJsDb = driver.db;

  // Export current DB state
  const binaryData = sqlJsDb.export();

  // Store in IndexedDB
  await localforage.setItem(DB_NAME, binaryData);
}
