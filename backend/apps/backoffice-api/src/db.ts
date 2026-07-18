import { Pool } from "pg";

export const pool = new Pool({
  connectionString:
    process.env.BACKOFFICE_DATABASE_URL ??
    "postgres://backoffice:backoffice@localhost:15434/backoffice",
});

export async function closePool() {
  await pool.end();
}
