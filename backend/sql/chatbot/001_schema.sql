CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS service_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS services (
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

CREATE INDEX IF NOT EXISTS services_normalized_name_trgm_idx ON services USING gin (normalized_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS services_category_id_idx ON services(category_id);
CREATE INDEX IF NOT EXISTS services_parent_id_idx ON services(parent_id);

CREATE TABLE IF NOT EXISTS service_aliases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  keyword TEXT NOT NULL,
  normalized_keyword TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (service_id, normalized_keyword)
);

CREATE INDEX IF NOT EXISTS service_aliases_normalized_keyword_trgm_idx ON service_aliases USING gin (normalized_keyword gin_trgm_ops);
CREATE INDEX IF NOT EXISTS service_aliases_service_id_idx ON service_aliases(service_id);

CREATE TABLE IF NOT EXISTS information_items (
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

CREATE INDEX IF NOT EXISTS information_items_tags_idx ON information_items USING gin(tags);

CREATE TABLE IF NOT EXISTS locations (
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

CREATE INDEX IF NOT EXISTS locations_tags_idx ON locations USING gin(tags);

CREATE TABLE IF NOT EXISTS processes (
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

CREATE INDEX IF NOT EXISTS processes_tags_idx ON processes USING gin(tags);

CREATE TABLE IF NOT EXISTS preparations (
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

CREATE INDEX IF NOT EXISTS preparations_tags_idx ON preparations USING gin(tags);

CREATE TABLE IF NOT EXISTS faqs (
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

CREATE INDEX IF NOT EXISTS faqs_tags_idx ON faqs USING gin(tags);

CREATE TABLE IF NOT EXISTS knowledge_index (
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

CREATE INDEX IF NOT EXISTS knowledge_index_entity_idx ON knowledge_index(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS knowledge_index_type_status_idx ON knowledge_index(entity_type, status);
CREATE INDEX IF NOT EXISTS knowledge_index_tags_idx ON knowledge_index USING gin(tags);
CREATE INDEX IF NOT EXISTS knowledge_index_search_text_trgm_idx ON knowledge_index USING gin(search_text gin_trgm_ops);
CREATE INDEX IF NOT EXISTS knowledge_index_normalized_search_text_trgm_idx ON knowledge_index USING gin(normalized_search_text gin_trgm_ops);
CREATE INDEX IF NOT EXISTS knowledge_index_search_text_fts_idx ON knowledge_index USING gin (to_tsvector('simple', search_text));

CREATE TABLE IF NOT EXISTS solution_outputs (
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

CREATE INDEX IF NOT EXISTS ticket_label_rules_search_trgm_idx ON ticket_label_rules USING gin (search_text gin_trgm_ops);

CREATE TABLE IF NOT EXISTS chat_logs (
  id BIGSERIAL PRIMARY KEY,
  session_id TEXT,
  user_message TEXT NOT NULL,
  detected_intent TEXT,
  confidence NUMERIC,
  response_text TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
