import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { Pool } from "pg";
import xlsx from "xlsx";

type NavigationSeed = {
  departmentName: string;
  building: string | null;
  floor: string | null;
  room: string | null;
  address: string | null;
  instructions: string | null;
};

type ServiceImportStats = {
  services: number;
  categories: number;
  aliases: number;
};

const databaseUrl =
  process.env.CHATBOT_DATABASE_URL ??
  "postgres://chatbot:chatbot@localhost:15433/chatbot";

const workbookPath = process.env.DATA_TIM_XLSX ?? path.resolve("data-tim.xlsx");
const navigationSeedPath = path.resolve("data/seeds/navigation-locations.json");

const pool = new Pool({ connectionString: databaseUrl });

function cleanText(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function nullableText(value: unknown): string | null {
  const text = cleanText(value);
  return text ? text : null;
}

function nullableNumber(value: unknown): number | null {
  const text = cleanText(value);
  if (!text) return null;
  const n = Number(text.replaceAll(",", ""));
  return Number.isFinite(n) ? n : null;
}

function parseBoolean(value: unknown): boolean {
  return cleanText(value).toLowerCase() === "yes";
}

function unique(values: Array<string | null | undefined>): string[] {
  return [...new Set(values.map((value) => cleanText(value)).filter(Boolean))];
}

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

function slugify(value: string): string {
  return normalizeText(value).replace(/\s+/g, "-");
}

function parentSttOf(stt: string | null): string | null {
  if (!stt?.includes(".")) return null;
  return stt.split(".")[0]?.trim() || null;
}

function buildServiceAliases(name: string): string[] {
  const normalizedName = normalizeText(name);
  const aliases = new Set<string>();

  if (normalizedName.includes("sieu am")) {
    aliases.add("siêu âm");
    aliases.add("ultrasound");
  }
  if (normalizedName.includes("x quang")) {
    aliases.add("x-quang");
    aliases.add("xray");
    aliases.add("x-ray");
  }
  if (normalizedName.includes("cong huong tu") || normalizedName.includes("mri")) {
    aliases.add("cộng hưởng từ");
    aliases.add("mri");
  }
  if (normalizedName.includes("cat lop") || normalizedName.includes("ct scanner")) {
    aliases.add("chụp ct");
    aliases.add("ct");
    aliases.add("ct scanner");
  }
  if (normalizedName.includes("dien tim")) {
    aliases.add("điện tim");
    aliases.add("ecg");
    aliases.add("ekg");
  }
  if (normalizedName.includes("co chan")) aliases.add("cổ chân");
  if (normalizedName.includes("tim")) aliases.add("tim mạch");

  return [...aliases];
}

function buildServiceContent(input: {
  name: string;
  category: string;
  parentName: string | null;
  facility1Price: number | null;
  facility2Price: number | null;
  note: string | null;
  aliases: string[];
}): string {
  return [
    `Tên: ${input.name}`,
    `Giá cơ sở 1: ${input.facility1Price === null ? "chưa có giá" : `${input.facility1Price} VNĐ`}`,
    `Giá cơ sở 2: ${input.facility2Price === null ? "chưa có giá" : `${input.facility2Price} VNĐ`}`,
    `Danh mục: ${input.category}`,
    input.parentName ? `Nhóm cha: ${input.parentName}` : null,
    input.aliases.length ? `Alias: ${input.aliases.join(", ")}` : null,
    input.note ? `Ghi chú: ${input.note}` : null,
  ]
    .filter(Boolean)
    .join("\n");
}

function stepsFromContent(content: string): string[] {
  return content
    .split(/\n+|(?:^|\s)(?=\d+[.)]\s)/)
    .map((step) => step.replace(/^\d+[.)]\s*/, "").trim())
    .filter(Boolean);
}

async function ensureKnowledgeSchema() {
  await pool.query(`
    CREATE EXTENSION IF NOT EXISTS pg_trgm;
    CREATE EXTENSION IF NOT EXISTS pgcrypto;

    DROP TABLE IF EXISTS knowledge_index CASCADE;
    DROP TABLE IF EXISTS solution_outputs CASCADE;
    DROP TABLE IF EXISTS service_aliases CASCADE;
    DROP TABLE IF EXISTS service_metadata CASCADE;
    DROP TABLE IF EXISTS services CASCADE;
    DROP TABLE IF EXISTS service_categories CASCADE;
    DROP TABLE IF EXISTS information_items CASCADE;
    DROP TABLE IF EXISTS locations CASCADE;
    DROP TABLE IF EXISTS processes CASCADE;
    DROP TABLE IF EXISTS preparations CASCADE;
    DROP TABLE IF EXISTS faqs CASCADE;
    DROP TABLE IF EXISTS general_documents CASCADE;
    DROP TABLE IF EXISTS faq_documents CASCADE;
    DROP TABLE IF EXISTS navigation_locations CASCADE;

    CREATE TABLE service_categories (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE services (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      source_row INTEGER NOT NULL,
      stt TEXT,
      code VARCHAR,
      name TEXT NOT NULL,
      normalized_name TEXT NOT NULL,
      category_id UUID NOT NULL REFERENCES service_categories(id),
      parent_id UUID REFERENCES services(id) ON DELETE SET NULL,
      facility_1_price NUMERIC,
      facility_2_price NUMERIC,
      note TEXT,
      status BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE INDEX services_normalized_name_trgm_idx ON services USING gin (normalized_name gin_trgm_ops);
    CREATE INDEX services_category_id_idx ON services(category_id);
    CREATE INDEX services_parent_id_idx ON services(parent_id);

    CREATE TABLE service_aliases (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      service_id UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
      keyword TEXT NOT NULL,
      normalized_keyword TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (service_id, normalized_keyword)
    );

    CREATE INDEX service_aliases_normalized_keyword_trgm_idx ON service_aliases USING gin (normalized_keyword gin_trgm_ops);
    CREATE INDEX service_aliases_service_id_idx ON service_aliases(service_id);

    CREATE TABLE information_items (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      tags TEXT[] NOT NULL DEFAULT '{}',
      metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
      status BOOLEAN NOT NULL DEFAULT true,
      source TEXT NOT NULL,
      source_row INTEGER,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE INDEX information_items_tags_idx ON information_items USING gin(tags);

    CREATE TABLE locations (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      title TEXT NOT NULL,
      building TEXT,
      floor TEXT,
      room TEXT,
      department TEXT,
      address TEXT,
      instructions TEXT,
      tags TEXT[] NOT NULL DEFAULT '{}',
      status BOOLEAN NOT NULL DEFAULT true,
      source TEXT NOT NULL DEFAULT 'manual_seed',
      source_row INTEGER,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE INDEX locations_tags_idx ON locations USING gin(tags);

    CREATE TABLE processes (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      steps JSONB NOT NULL DEFAULT '[]'::jsonb,
      tags TEXT[] NOT NULL DEFAULT '{}',
      status BOOLEAN NOT NULL DEFAULT true,
      source TEXT NOT NULL,
      source_row INTEGER,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE INDEX processes_tags_idx ON processes USING gin(tags);

    CREATE TABLE preparations (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      tags TEXT[] NOT NULL DEFAULT '{}',
      metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
      status BOOLEAN NOT NULL DEFAULT true,
      source TEXT NOT NULL,
      source_row INTEGER,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE INDEX preparations_tags_idx ON preparations USING gin(tags);

    CREATE TABLE faqs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      question TEXT NOT NULL,
      answer TEXT NOT NULL,
      tags TEXT[] NOT NULL DEFAULT '{}',
      metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
      status BOOLEAN NOT NULL DEFAULT true,
      source TEXT NOT NULL,
      source_row INTEGER,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE INDEX faqs_tags_idx ON faqs USING gin(tags);

    CREATE TABLE knowledge_index (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      entity_type TEXT NOT NULL,
      entity_id UUID NOT NULL,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      tags TEXT[] NOT NULL DEFAULT '{}',
      search_text TEXT NOT NULL,
      normalized_search_text TEXT NOT NULL,
      embedding DOUBLE PRECISION[],
      status BOOLEAN NOT NULL DEFAULT true,
      source TEXT NOT NULL,
      source_row INTEGER,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE INDEX knowledge_index_entity_idx ON knowledge_index(entity_type, entity_id);
    CREATE INDEX knowledge_index_type_status_idx ON knowledge_index(entity_type, status);
    CREATE INDEX knowledge_index_tags_idx ON knowledge_index USING gin(tags);
    CREATE INDEX knowledge_index_search_text_trgm_idx ON knowledge_index USING gin(search_text gin_trgm_ops);
    CREATE INDEX knowledge_index_normalized_search_text_trgm_idx ON knowledge_index USING gin(normalized_search_text gin_trgm_ops);
    CREATE INDEX knowledge_index_search_text_fts_idx ON knowledge_index USING gin (to_tsvector('simple', search_text));

    CREATE TABLE solution_outputs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      intent TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      output_schema JSONB NOT NULL DEFAULT '{}'::jsonb,
      template TEXT NOT NULL,
      enabled BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE(intent, entity_type)
    );
  `);
}

async function getOrCreateCategory(cache: Map<string, string>, name: string): Promise<string> {
  const slug = slugify(name);
  const cached = cache.get(slug);
  if (cached) return cached;

  const result = await pool.query<{ id: string }>(
    `INSERT INTO service_categories (name, slug)
     VALUES ($1, $2)
     ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name, updated_at = now()
     RETURNING id`,
    [name, slug],
  );

  const id = result.rows[0].id;
  cache.set(slug, id);
  return id;
}

async function importServices(workbook: xlsx.WorkBook): Promise<ServiceImportStats> {
  const sheet = workbook.Sheets["Bảng giá dịch vụ "];
  if (!sheet) throw new Error("Missing sheet: Bảng giá dịch vụ ");

  const rows = xlsx.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
  const categoryCache = new Map<string, string>();
  const categoryNames = new Set<string>();
  const parentByCategoryAndStt = new Map<string, { id: string; name: string }>();
  let services = 0;
  let aliases = 0;

  for (const [index, row] of rows.entries()) {
    const name = cleanText(row["Dịch vụ kỹ thuật"]);
    if (!name) continue;

    const sourceRow = index + 2;
    const stt = nullableText(row["STT"]);
    const code = nullableText(row["Mã tương đương"]);
    const category = nullableText(row["Danh mục"]) ?? "Chưa phân loại";
    const note = nullableText(row["Ghi chú"]);
    const facility1Price = nullableNumber(row["Cơ sở 1"]);
    const facility2Price = nullableNumber(row["Cơ sở 2"]);
    const categoryId = await getOrCreateCategory(categoryCache, category);
    const categoryKey = slugify(category);
    const parent = parentSttOf(stt) ? parentByCategoryAndStt.get(`${categoryKey}:${parentSttOf(stt)}`) : null;
    const serviceAliases = buildServiceAliases(name);

    const result = await pool.query<{ id: string }>(
      `INSERT INTO services
        (source_row, stt, code, name, normalized_name, category_id, parent_id, facility_1_price, facility_2_price, note)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING id`,
      [
        sourceRow,
        stt,
        code,
        name,
        normalizeText(name),
        categoryId,
        parent?.id ?? null,
        facility1Price,
        facility2Price,
        note,
      ],
    );

    const serviceId = result.rows[0].id;
    if (stt && !stt.includes(".")) {
      parentByCategoryAndStt.set(`${categoryKey}:${stt}`, { id: serviceId, name });
    }

    for (const alias of serviceAliases) {
      await pool.query(
        `INSERT INTO service_aliases (service_id, keyword, normalized_keyword)
         VALUES ($1, $2, $3)
         ON CONFLICT (service_id, normalized_keyword) DO NOTHING`,
        [serviceId, alias, normalizeText(alias)],
      );
      aliases++;
    }

    categoryNames.add(category);
    services++;
  }

  return { services, categories: categoryNames.size, aliases };
}

async function importProcess(workbook: xlsx.WorkBook): Promise<number> {
  const sheet = workbook.Sheets["Quy trình đón tiếp bệnh nhân"];
  if (!sheet) throw new Error("Missing sheet: Quy trình đón tiếp bệnh nhân");

  const rows = xlsx.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "" });
  let currentTitle = "Quy trình đón tiếp bệnh nhân";
  let count = 0;

  for (const [index, row] of rows.entries()) {
    const first = cleanText(row[0]);
    const second = cleanText(row[1]);
    if (!first && !second) continue;

    if (first && !second) {
      currentTitle = first;
      continue;
    }

    const title = first || currentTitle;
    const content = second || first;
    if (!content) continue;
    const tags = unique(["quy trình", "khám", title, currentTitle]);

    await pool.query(
      `INSERT INTO processes (title, content, steps, tags, source, source_row)
       VALUES ($1, $2, $3::jsonb, $4, $5, $6)`,
      [title, content, JSON.stringify(stepsFromContent(content)), tags, "Quy trình đón tiếp bệnh nhân", index + 1],
    );
    await pool.query(
      `INSERT INTO faqs (question, answer, tags, metadata, source, source_row)
       VALUES ($1, $2, $3, $4::jsonb, $5, $6)`,
      [`${title} là gì?`, content, tags, JSON.stringify({ linked_type: "process" }), "Quy trình đón tiếp bệnh nhân", index + 1],
    );

    count++;
  }

  return count;
}

async function importContactInfo(workbook: xlsx.WorkBook): Promise<{ information: number; faqs: number }> {
  const sheet = workbook.Sheets["Liên hệ đặt lịch khám"];
  if (!sheet) throw new Error("Missing sheet: Liên hệ đặt lịch khám");

  const rows = xlsx.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "" });
  let information = 0;
  let faqs = 0;

  for (const [index, row] of rows.entries()) {
    const content = cleanText(row[0]);
    if (!content) continue;

    const title = index === 0 ? "Lưu ý đặt lịch khám" : `Thông tin liên hệ ${index}`;
    const normalized = normalizeText(`${title} ${content}`);
    const tags = unique([
      "liên hệ",
      "đặt lịch",
      "hotline",
      normalized.includes("bao hiem") ? "bảo hiểm" : null,
      normalized.includes("dien thoai") ? "điện thoại" : null,
      title,
    ]);

    await pool.query(
      `INSERT INTO information_items (title, content, tags, metadata, source, source_row)
       VALUES ($1, $2, $3, $4::jsonb, $5, $6)`,
      [title, content, tags, JSON.stringify({ document_type: "contact" }), "Liên hệ đặt lịch khám", index + 1],
    );
    await pool.query(
      `INSERT INTO faqs (question, answer, tags, metadata, source, source_row)
       VALUES ($1, $2, $3, $4::jsonb, $5, $6)`,
      [title, content, tags, JSON.stringify({ linked_type: "information" }), "Liên hệ đặt lịch khám", index + 1],
    );
    information++;
    faqs++;
  }

  return { information, faqs };
}

async function importTicketRules(workbook: xlsx.WorkBook): Promise<number> {
  const sheet = workbook.Sheets["Rule label ticket"];
  if (!sheet) throw new Error("Missing sheet: Rule label ticket");

  await pool.query(`
    CREATE TABLE IF NOT EXISTS ticket_label_rules (
      id BIGSERIAL PRIMARY KEY,
      source_row INTEGER NOT NULL,
      rule_group TEXT,
      event_name TEXT NOT NULL,
      keywords TEXT,
      need_ticket BOOLEAN NOT NULL DEFAULT false,
      priority TEXT,
      channel TEXT,
      chatbot_action TEXT,
      data_form TEXT,
      ticket_type TEXT,
      search_text TEXT GENERATED ALWAYS AS (
        coalesce(rule_group, '') || ' ' || coalesce(event_name, '') || ' ' || coalesce(keywords, '') || ' ' ||
        coalesce(chatbot_action, '') || ' ' || coalesce(ticket_type, '')
      ) STORED
    );
  `);
  await pool.query("TRUNCATE ticket_label_rules RESTART IDENTITY CASCADE");

  const rows = xlsx.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
  let lastGroup: string | null = null;
  let count = 0;

  for (const [index, row] of rows.entries()) {
    const eventName = cleanText(row["Event (Trường hợp)"]);
    if (!eventName) continue;

    const group: string | null = nullableText(row["Nhóm"]) ?? lastGroup;
    if (group) lastGroup = group;

    await pool.query(
      `INSERT INTO ticket_label_rules
        (source_row, rule_group, event_name, keywords, need_ticket, priority, channel, chatbot_action, data_form, ticket_type)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        index + 2,
        group,
        eventName,
        nullableText(row["Keywords"]),
        parseBoolean(row["Cần Ticket?"]),
        nullableText(row["Mức ưu tiên"]),
        nullableText(row["Channel"]),
        nullableText(row["Pre-action / Action của Chatbot"]),
        nullableText(row["Data Form"]),
        nullableText(row["Ticket type (nhãn)"]),
      ],
    );
    count++;
  }

  return count;
}

async function importNavigationSeeds(): Promise<number> {
  const raw = fs.readFileSync(navigationSeedPath, "utf8");
  const rows = JSON.parse(raw) as NavigationSeed[];

  for (const [index, row] of rows.entries()) {
    const title = `Đường đến ${row.departmentName}`;
    const tags = unique([row.departmentName, row.building, row.floor, row.room, "đường đi", "ở đâu"]);
    await pool.query(
      `INSERT INTO locations
        (title, building, floor, room, department, address, instructions, tags, source, source_row)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        title,
        row.building,
        row.floor,
        row.room,
        row.departmentName,
        row.address,
        row.instructions,
        tags,
        "navigation_seed",
        index + 1,
      ],
    );
  }

  return rows.length;
}

async function seedSolutionOutputs(): Promise<number> {
  const rows = [
    {
      intent: "service_price",
      entityType: "service",
      template: "Trả lời tên dịch vụ, giá cơ sở 1, giá cơ sở 2, ghi chú nếu có.",
      schema: {
        required: ["name", "facility_1_price", "facility_2_price"],
      },
    },
    {
      intent: "navigation",
      entityType: "location",
      template: "Trả lời đường đi ngắn gọn kèm tòa, tầng, phòng nếu có.",
      schema: {
        required: ["department", "building", "floor", "room", "instructions"],
      },
    },
    {
      intent: "process",
      entityType: "process",
      template: "Trả lời theo các bước từ nội dung quy trình.",
      schema: {
        required: ["title", "content", "steps"],
      },
    },
  ];

  for (const row of rows) {
    await pool.query(
      `INSERT INTO solution_outputs (intent, entity_type, output_schema, template)
       VALUES ($1, $2, $3::jsonb, $4)
       ON CONFLICT (intent, entity_type)
       DO UPDATE SET output_schema = EXCLUDED.output_schema, template = EXCLUDED.template, enabled = true, updated_at = now()`,
      [row.intent, row.entityType, JSON.stringify(row.schema), row.template],
    );
  }

  return rows.length;
}

async function rebuildKnowledgeIndex(): Promise<number> {
  await pool.query("TRUNCATE knowledge_index");

  await pool.query(`
    INSERT INTO knowledge_index (entity_type, entity_id, title, content, tags, search_text, normalized_search_text, source, source_row, status)
    SELECT
      'service',
      s.id,
      s.name,
      concat_ws(E'\\n',
        'Tên: ' || s.name,
        'Giá cơ sở 1: ' || coalesce(s.facility_1_price::text || ' VNĐ', 'chưa có giá'),
        'Giá cơ sở 2: ' || coalesce(s.facility_2_price::text || ' VNĐ', 'chưa có giá'),
        'Danh mục: ' || c.name,
        CASE WHEN p.name IS NOT NULL THEN 'Nhóm cha: ' || p.name END,
        CASE WHEN array_length(coalesce(a.aliases, ARRAY[]::text[]), 1) IS NOT NULL THEN 'Alias: ' || array_to_string(a.aliases, ', ') END,
        CASE WHEN s.note IS NOT NULL THEN 'Ghi chú: ' || s.note END
      ),
      coalesce(a.aliases, ARRAY[]::text[]) || ARRAY[s.name, c.name],
      concat_ws(E'\\n',
        s.name,
        c.name,
        p.name,
        array_to_string(coalesce(a.aliases, ARRAY[]::text[]), ' '),
        s.note,
        s.code
      ),
      $1,
      'services',
      s.source_row,
      s.status
    FROM services s
    JOIN service_categories c ON c.id = s.category_id
    LEFT JOIN services p ON p.id = s.parent_id
    LEFT JOIN (
      SELECT service_id, array_agg(keyword ORDER BY keyword) AS aliases
      FROM service_aliases
      GROUP BY service_id
    ) a ON a.service_id = s.id
  `, [""]);

  const serviceIndexRows = await pool.query<{ id: string; search_text: string }>(
    "SELECT id, search_text FROM knowledge_index WHERE normalized_search_text = ''",
  );
  for (const row of serviceIndexRows.rows) {
    await pool.query("UPDATE knowledge_index SET normalized_search_text = $1 WHERE id = $2", [
      normalizeText(row.search_text),
      row.id,
    ]);
  }

  const entityInserts = [
    {
      type: "information",
      sql: `SELECT id, title, content, tags, concat_ws(E'\\n', title, content, array_to_string(tags, ' ')) AS search_text, source, source_row, status FROM information_items`,
    },
    {
      type: "location",
      sql: `SELECT id, title, concat_ws(E'\\n', instructions, address, building, floor, room, department) AS content, tags, concat_ws(E'\\n', title, instructions, address, building, floor, room, department, array_to_string(tags, ' ')) AS search_text, source, source_row, status FROM locations`,
    },
    {
      type: "process",
      sql: `SELECT id, title, content, tags, concat_ws(E'\\n', title, content, array_to_string(tags, ' ')) AS search_text, source, source_row, status FROM processes`,
    },
    {
      type: "preparation",
      sql: `SELECT id, title, content, tags, concat_ws(E'\\n', title, content, array_to_string(tags, ' ')) AS search_text, source, source_row, status FROM preparations`,
    },
    {
      type: "faq",
      sql: `SELECT id, question AS title, answer AS content, tags, concat_ws(E'\\n', question, answer, array_to_string(tags, ' ')) AS search_text, source, source_row, status FROM faqs`,
    },
  ];

  for (const item of entityInserts) {
    const rows = await pool.query<{
      id: string;
      title: string;
      content: string;
      tags: string[];
      search_text: string;
      source: string;
      source_row: number | null;
      status: boolean;
    }>(item.sql);
    for (const row of rows.rows) {
      await pool.query(
        `INSERT INTO knowledge_index
          (entity_type, entity_id, title, content, tags, search_text, normalized_search_text, source, source_row, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [item.type, row.id, row.title, row.content, row.tags, row.search_text, normalizeText(row.search_text), row.source, row.source_row, row.status],
      );
    }
  }

  const result = await pool.query<{ count: string }>("SELECT count(*) FROM knowledge_index");
  return Number(result.rows[0].count);
}

async function main() {
  if (!fs.existsSync(workbookPath)) {
    throw new Error(`Workbook not found: ${workbookPath}`);
  }

  const workbook = xlsx.readFile(workbookPath);

  await pool.query("BEGIN");
  try {
    await ensureKnowledgeSchema();

    const serviceImport = await importServices(workbook);
    const processes = await importProcess(workbook);
    const contact = await importContactInfo(workbook);
    const ticketRules = await importTicketRules(workbook);
    const navigation = await importNavigationSeeds();
    const solutionOutputs = await seedSolutionOutputs();
    const knowledgeIndex = await rebuildKnowledgeIndex();

    await pool.query("COMMIT");
    console.log(
      JSON.stringify(
        {
          ...serviceImport,
          processes,
          preparations: 0,
          information: contact.information,
          faqs: contact.faqs + processes,
          ticketRules,
          navigation,
          solutionOutputs,
          knowledgeIndex,
        },
        null,
        2,
      ),
    );
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
