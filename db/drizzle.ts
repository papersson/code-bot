import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

// Create a connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Drizzle connection
export const dbNode = drizzle(pool, { schema });

// Now you can `import { dbNode } from "@/db/drizzle";` in your sync route
