import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "@shared/schema";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// En Vercel cada invocación puede correr en una instancia Lambda distinta:
// mantener el pool pequeño evita agotar el pooler de Supabase (puerto 6543)
// cuando hay varias instancias "calientes" a la vez. En Railway/local, con un
// único proceso de larga duración, un pool mayor aprovecha mejor la conexión.
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: Number(process.env.DB_POOL_MAX) || (process.env.VERCEL ? 1 : 10),
  idleTimeoutMillis: 30_000,
});
export const db = drizzle(pool, { schema });
