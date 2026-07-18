import { pool } from "./db.js";

export type SearchResult = {
  title: string;
  content: string;
  source: string;
  score?: number;
  metadata?: Record<string, unknown>;
};

type KnowledgeType = "information" | "process" | "service" | "location" | "preparation" | "faq";

type SearchOptions = {
  query: string;
  limit?: number;
  type?: KnowledgeType | KnowledgeType[];
};

function normalizeLimit(limit?: number): number {
  if (!limit || !Number.isFinite(limit)) return 5;
  return Math.max(1, Math.min(Math.trunc(limit), 20));
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

function normalizeServiceQuery(query: string): string {
  const normalized = normalizeText(query);
  const genericWords = [
    "gia",
    "bao gia",
    "chi phi",
    "bao nhieu tien",
    "danh sach",
    "dich vu",
    "kham",
  ];
  const cleaned = genericWords
    .reduce((text, word) => text.replace(new RegExp(`(^|\\s)${word}(?=\\s|$)`, "gu"), " "), normalized)
    .replace(/\s+/g, " ")
    .trim();

  return cleaned || normalized || query;
}

function normalizeProcessQuery(query: string): string {
  const normalized = normalizeText(query);
  const genericWords = ["quy trinh", "thu tuc", "cac buoc", "nhu nao", "the nao"];
  const cleaned = genericWords
    .reduce((text, word) => text.replace(new RegExp(`(^|\\s)${word}(?=\\s|$)`, "gu"), " "), normalized)
    .replace(/\s+/g, " ")
    .trim();

  return cleaned || normalized || query;
}

function asTypes(type?: KnowledgeType | KnowledgeType[]): KnowledgeType[] | null {
  if (!type) return null;
  return Array.isArray(type) ? type : [type];
}

export async function searchKnowledge({ query, limit, type }: SearchOptions): Promise<SearchResult[]> {
  const normalizedQuery = normalizeText(query);
  return searchKnowledgeRows({ query, normalizedQuery, tokens: queryTokens(normalizedQuery), limit, types: asTypes(type) });
}

export async function searchFaq({ query, limit }: SearchOptions) {
  return searchKnowledge({ query, limit, type: "faq" });
}

export async function searchDepartment({ query, limit }: SearchOptions) {
  return searchNavigation({ query, limit });
}

export async function searchDoctor({ query, limit }: SearchOptions) {
  const normalizedQuery = normalizeText(query);
  const doctors: SearchResult[] = [
    {
      title: "BS Nguyễn Văn A",
      content:
        "Chuyên khoa: Tim mạch\nLịch demo: sáng mai 08:00-11:00\nĐịa điểm: Phòng 201, Tòa A, tầng 2",
      source: "demo_doctor_schedule",
      score: 1,
      metadata: {
        doctor_name: "BS Nguyễn Văn A",
        department: "Tim mạch",
        available_time: "sáng mai 08:00-11:00",
        room: "Phòng 201",
        building: "Tòa A",
        floor: "Tầng 2",
      },
    },
    {
      title: "BS Trần Văn B",
      content:
        "Chuyên khoa: Tim mạch\nLịch demo: sáng mai 09:00-11:30\nĐịa điểm: Phòng 201, Tòa A, tầng 2",
      source: "demo_doctor_schedule",
      score: 0.95,
      metadata: {
        doctor_name: "BS Trần Văn B",
        department: "Tim mạch",
        available_time: "sáng mai 09:00-11:30",
        room: "Phòng 201",
        building: "Tòa A",
        floor: "Tầng 2",
      },
    },
  ];

  const filtered = normalizedQuery.includes("tim") || normalizedQuery.includes("sang mai")
    ? doctors
    : doctors.map((doctor) => ({ ...doctor, score: 0.7 }));

  return filtered.slice(0, normalizeLimit(limit));
}

export async function searchPrice({ query, limit }: SearchOptions) {
  const serviceQuery = normalizeServiceQuery(query);
  return searchKnowledgeRows({
    query: serviceQuery,
    normalizedQuery: normalizeText(serviceQuery),
    tokens: queryTokens(normalizeText(serviceQuery)),
    limit,
    types: ["service"],
  });
}

export async function searchService({ query, limit }: SearchOptions) {
  const serviceQuery = normalizeServiceQuery(query);
  return searchKnowledgeRows({
    query: serviceQuery,
    normalizedQuery: normalizeText(serviceQuery),
    tokens: queryTokens(normalizeText(serviceQuery)),
    limit,
    types: ["service"],
  });
}

export async function searchPolicy({ query, limit }: SearchOptions) {
  return searchKnowledge({ query, limit, type: ["process", "information", "faq", "preparation"] });
}

export async function searchNavigation({ query, limit }: SearchOptions) {
  return searchKnowledge({ query, limit, type: "location" });
}

export async function searchProcess({ query, limit }: SearchOptions) {
  const processQuery = normalizeProcessQuery(query);
  return searchKnowledgeRows({
    query: processQuery,
    normalizedQuery: normalizeText(processQuery),
    tokens: queryTokens(normalizeText(processQuery)),
    limit,
    types: ["process"],
  });
}

export async function searchPreparation({ query, limit }: SearchOptions) {
  return searchKnowledge({ query, limit, type: "preparation" });
}

export async function searchTicketRules({ query, limit }: SearchOptions) {
  const result = await pool.query<SearchResult>(
    `SELECT
       event_name AS title,
       concat_ws(E'\\n',
         'Nhóm: ' || coalesce(rule_group, ''),
         'Keywords: ' || coalesce(keywords, ''),
         'Cần ticket: ' || need_ticket::text,
         'Mức ưu tiên: ' || coalesce(priority, ''),
         'Action: ' || coalesce(chatbot_action, ''),
         'Ticket type: ' || coalesce(ticket_type, '')
       ) AS content,
       'ticket_label_rules' AS source,
       similarity(search_text, $1) AS score
     FROM ticket_label_rules
     WHERE search_text ILIKE '%' || $1 || '%'
        OR similarity(search_text, $1) > 0.08
     ORDER BY score DESC, id ASC
     LIMIT $2`,
    [query, normalizeLimit(limit)],
  );

  return result.rows;
}

async function searchKnowledgeRows(input: {
  query: string;
  normalizedQuery: string;
  tokens: string[];
  limit?: number;
  types: KnowledgeType[] | null;
}): Promise<SearchResult[]> {
  const result = await pool.query<SearchResult>(
    `WITH alias_summary AS (
       SELECT
         service_id,
         array_agg(keyword ORDER BY keyword) AS aliases,
         max(similarity(normalized_keyword, $1)) AS alias_score,
         bool_or(normalized_keyword = $1) AS exact_alias_match,
         bool_or(normalized_keyword ILIKE '%' || $1 || '%') AS alias_contains_match
       FROM service_aliases
       GROUP BY service_id
     )
     SELECT
       k.title,
       k.content,
       'knowledge_index' AS source,
       greatest(
         similarity(k.normalized_search_text, $1),
         similarity(k.search_text, $2),
         coalesce(a.alias_score, 0),
         ts_rank_cd(to_tsvector('simple', k.search_text), plainto_tsquery('simple', $2)),
         (
           SELECT count(*)::real / greatest(coalesce(array_length($5::text[], 1), 0), 1)
           FROM unnest($5::text[]) token
           WHERE k.normalized_search_text ~ ('(^| )' || token || '( |$)')
         )
       ) AS score,
       CASE
         WHEN k.entity_type = 'service' THEN jsonb_build_object(
           'entity_type', k.entity_type,
           'id', s.id,
           'code', s.code,
           'name', s.name,
           'category', jsonb_build_object('id', c.id, 'name', c.name, 'slug', c.slug),
           'parent', CASE WHEN p.id IS NULL THEN NULL ELSE jsonb_build_object('id', p.id, 'name', p.name) END,
           'facility_1_price', s.facility_1_price,
           'facility_2_price', s.facility_2_price,
           'note', s.note,
           'aliases', coalesce(a.aliases, ARRAY[]::text[])
         )
         WHEN k.entity_type = 'location' THEN jsonb_build_object(
           'entity_type', k.entity_type,
           'id', l.id,
           'department', l.department,
           'building', l.building,
           'floor', l.floor,
           'room', l.room,
           'address', l.address,
           'instructions', l.instructions,
           'tags', l.tags
         )
         WHEN k.entity_type = 'process' THEN jsonb_build_object(
           'entity_type', k.entity_type,
           'id', pr.id,
           'steps', pr.steps,
           'tags', pr.tags
         )
         WHEN k.entity_type = 'preparation' THEN prep.metadata || jsonb_build_object(
           'entity_type', k.entity_type,
           'id', prep.id,
           'tags', prep.tags
         )
         WHEN k.entity_type = 'faq' THEN f.metadata || jsonb_build_object(
           'entity_type', k.entity_type,
           'id', f.id,
           'question', f.question,
           'tags', f.tags
         )
         WHEN k.entity_type = 'information' THEN i.metadata || jsonb_build_object(
           'entity_type', k.entity_type,
           'id', i.id,
           'tags', i.tags
         )
         ELSE jsonb_build_object('entity_type', k.entity_type, 'id', k.entity_id)
       END AS metadata
     FROM knowledge_index k
     LEFT JOIN services s ON k.entity_type = 'service' AND s.id = k.entity_id
     LEFT JOIN service_categories c ON c.id = s.category_id
     LEFT JOIN services p ON p.id = s.parent_id
     LEFT JOIN alias_summary a ON a.service_id = s.id
     LEFT JOIN locations l ON k.entity_type = 'location' AND l.id = k.entity_id
     LEFT JOIN processes pr ON k.entity_type = 'process' AND pr.id = k.entity_id
     LEFT JOIN preparations prep ON k.entity_type = 'preparation' AND prep.id = k.entity_id
     LEFT JOIN faqs f ON k.entity_type = 'faq' AND f.id = k.entity_id
     LEFT JOIN information_items i ON k.entity_type = 'information' AND i.id = k.entity_id
     WHERE k.status = true
       AND ($3::text[] IS NULL OR k.entity_type = ANY($3::text[]))
       AND (
         k.normalized_search_text ILIKE '%' || $1 || '%'
         OR k.search_text ILIKE '%' || $2 || '%'
         OR $2 = ANY(k.tags)
         OR coalesce(a.alias_contains_match, false)
         OR similarity(k.normalized_search_text, $1) > 0.08
         OR similarity(k.search_text, $2) > 0.08
         OR coalesce(a.alias_score, 0) > 0.08
         OR to_tsvector('simple', k.search_text) @@ plainto_tsquery('simple', $2)
         OR EXISTS (
           SELECT 1
           FROM unnest($5::text[]) token
           WHERE k.normalized_search_text ~ ('(^| )' || token || '( |$)')
         )
       )
     ORDER BY
       (
         SELECT count(*)
         FROM unnest($5::text[]) token
         WHERE k.normalized_search_text ~ ('(^| )' || token || '( |$)')
       ) DESC,
       CASE
         WHEN k.normalized_search_text = $1 OR coalesce(a.exact_alias_match, false) THEN 0
         WHEN k.normalized_search_text ILIKE '%' || $1 || '%' OR coalesce(a.alias_contains_match, false) THEN 1
         WHEN k.search_text ILIKE '%' || $2 || '%' THEN 2
         ELSE 3
       END,
       coalesce(a.alias_score, 0) DESC,
       similarity(k.normalized_search_text, $1) DESC,
       similarity(k.search_text, $2) DESC,
       k.source_row ASC
     LIMIT $4`,
    [input.normalizedQuery, input.query, input.types, normalizeLimit(input.limit), input.tokens],
  );

  return result.rows;
}

function queryTokens(normalizedQuery: string): string[] {
  return normalizedQuery
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 2);
}

export const tools = {
  search_knowledge: searchKnowledge,
  search_faq: searchFaq,
  search_department: searchDepartment,
  search_doctor: searchDoctor,
  search_service: searchService,
  search_price: searchPrice,
  search_policy: searchPolicy,
  search_navigation: searchNavigation,
  search_process: searchProcess,
  search_preparation: searchPreparation,
  search_ticket_rules: searchTicketRules,
};

export type ToolName = keyof typeof tools;

export function isToolName(value: string): value is ToolName {
  return value in tools;
}
