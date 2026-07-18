import { Pool } from "pg";

export const pool = new Pool({
  connectionString:
    process.env.CHATBOT_DATABASE_URL ??
    "postgres://chatbot:chatbot@localhost:15433/chatbot",
});

export async function closePool() {
  await pool.end();
}
