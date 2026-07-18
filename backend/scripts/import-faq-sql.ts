import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { Pool } from "pg";

const databaseUrl =
  process.env.CHATBOT_DATABASE_URL ??
  "postgres://chatbot:chatbot@localhost:15433/chatbot";

const faqSqlPath = process.env.FAQ_SQL_PATH ?? path.resolve("data/seeds/faq.sql");
const pool = new Pool({ connectionString: databaseUrl });

function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .replace(/đ/g, "d")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function rebuildFaqIndex() {
  await pool.query("DELETE FROM knowledge_index WHERE entity_type = 'faq'");
  await pool.query(`
    INSERT INTO knowledge_index
      (entity_type, entity_id, title, content, tags, search_text, normalized_search_text, source, source_row, status)
    SELECT
      'faq',
      id,
      question,
      answer,
      tags,
      concat_ws(E'\\n', question, answer, array_to_string(tags, ' ')),
      '',
      source,
      source_row,
      status
    FROM faqs
  `);

  const rows = await pool.query<{ id: string; search_text: string }>(
    "SELECT id, search_text FROM knowledge_index WHERE entity_type = 'faq'",
  );
  for (const row of rows.rows) {
    await pool.query("UPDATE knowledge_index SET normalized_search_text = $1 WHERE id = $2", [
      normalizeText(row.search_text),
      row.id,
    ]);
  }
}

async function main() {
  if (!fs.existsSync(faqSqlPath)) {
    throw new Error(`FAQ SQL file not found: ${faqSqlPath}`);
  }

  const sql = fs.readFileSync(faqSqlPath, "utf8");
  await pool.query("BEGIN");
  try {
    await pool.query("DELETE FROM knowledge_index WHERE entity_type = 'faq'");
    await pool.query(sql);
    await pool.query("DROP INDEX IF EXISTS faqs_tags_idx");
    await pool.query("CREATE INDEX faqs_tags_idx ON faqs USING gin(tags)");
    await rebuildFaqIndex();
    await pool.query("COMMIT");

    const result = await pool.query<{ faqs: string; indexed: string }>(`
      SELECT
        (SELECT count(*) FROM faqs)::text AS faqs,
        (SELECT count(*) FROM knowledge_index WHERE entity_type = 'faq')::text AS indexed
    `);
    console.log(JSON.stringify(result.rows[0], null, 2));
  } catch (error) {
    await pool.query("ROLLBACK");
    throw error;
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
