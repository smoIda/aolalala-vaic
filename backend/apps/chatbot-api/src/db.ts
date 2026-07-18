import { Pool } from "pg";

export const pool = new Pool({
  connectionString:
    process.env.CHATBOT_DATABASE_URL ??
    "postgres://chatbot:chatbot@localhost:15433/chatbot",
  connectionTimeoutMillis: Number(process.env.CHATBOT_DB_TIMEOUT_MS ?? 10_000),
  query_timeout: Number(process.env.CHATBOT_DB_TIMEOUT_MS ?? 10_000),
  statement_timeout: Number(process.env.CHATBOT_DB_TIMEOUT_MS ?? 10_000),
});

export async function closePool() {
  await pool.end();
}
