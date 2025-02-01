// db/drizzle.ts (server-side usage)
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export const dbRemote = drizzle(pool, { schema });

// Run migrations, if you want to do so at startup
// await migrate(dbRemote, { migrationsFolder: 'drizzle' });