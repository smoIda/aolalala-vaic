import process from "node:process";
import { Pool } from "pg";

const databaseUrl =
  process.env.CHATBOT_DATABASE_URL ??
  "postgres://chatbot:chatbot@localhost:15433/chatbot";

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

async function indexProcess(id: string) {
  const row = await pool.query<{
    id: string;
    title: string;
    content: string;
    tags: string[];
    source: string;
    source_row: number | null;
    status: boolean;
  }>("SELECT id, title, content, tags, source, source_row, status FROM processes WHERE id = $1", [id]);
  const item = row.rows[0];
  const searchText = [item.title, item.content, item.tags.join(" ")].join("\n");
  await pool.query(
    `INSERT INTO knowledge_index
      (entity_type, entity_id, title, content, tags, search_text, normalized_search_text, source, source_row, status)
     VALUES ('process', $1, $2, $3, $4, $5, $6, $7, $8, $9)
     ON CONFLICT DO NOTHING`,
    [item.id, item.title, item.content, item.tags, searchText, normalizeText(searchText), item.source, item.source_row, item.status],
  );
}

async function indexPreparation(id: string) {
  const row = await pool.query<{
    id: string;
    title: string;
    content: string;
    tags: string[];
    source: string;
    source_row: number | null;
    status: boolean;
  }>("SELECT id, title, content, tags, source, source_row, status FROM preparations WHERE id = $1", [id]);
  const item = row.rows[0];
  const searchText = [item.title, item.content, item.tags.join(" ")].join("\n");
  await pool.query(
    `INSERT INTO knowledge_index
      (entity_type, entity_id, title, content, tags, search_text, normalized_search_text, source, source_row, status)
     VALUES ('preparation', $1, $2, $3, $4, $5, $6, $7, $8, $9)
     ON CONFLICT DO NOTHING`,
    [item.id, item.title, item.content, item.tags, searchText, normalizeText(searchText), item.source, item.source_row, item.status],
  );
}

async function indexFaq(id: string) {
  const row = await pool.query<{
    id: string;
    question: string;
    answer: string;
    tags: string[];
    source: string;
    source_row: number | null;
    status: boolean;
  }>("SELECT id, question, answer, tags, source, source_row, status FROM faqs WHERE id = $1", [id]);
  const item = row.rows[0];
  const searchText = [item.question, item.answer, item.tags.join(" ")].join("\n");
  await pool.query(
    `INSERT INTO knowledge_index
      (entity_type, entity_id, title, content, tags, search_text, normalized_search_text, source, source_row, status)
     VALUES ('faq', $1, $2, $3, $4, $5, $6, $7, $8, $9)
     ON CONFLICT DO NOTHING`,
    [item.id, item.question, item.answer, item.tags, searchText, normalizeText(searchText), item.source, item.source_row, item.status],
  );
}

async function main() {
  await pool.query("BEGIN");
  try {
    await pool.query("DELETE FROM knowledge_index WHERE source = 'demo_seed'");
    await pool.query("DELETE FROM knowledge_index ki WHERE ki.entity_type = 'faq' AND NOT EXISTS (SELECT 1 FROM faqs f WHERE f.id = ki.entity_id)");
    await pool.query("DELETE FROM knowledge_index ki WHERE ki.entity_type = 'process' AND NOT EXISTS (SELECT 1 FROM processes p WHERE p.id = ki.entity_id)");
    await pool.query("DELETE FROM knowledge_index ki WHERE ki.entity_type = 'preparation' AND NOT EXISTS (SELECT 1 FROM preparations p WHERE p.id = ki.entity_id)");
    await pool.query("DELETE FROM faqs WHERE source = 'demo_seed'");
    await pool.query("DELETE FROM processes WHERE source = 'demo_seed'");
    await pool.query("DELETE FROM preparations WHERE source = 'demo_seed'");

    const processRows = [
      {
        title: "Quy trình khám ngoại trú",
        steps: [
          "Đăng ký thông tin hoặc xuất trình lịch hẹn tại quầy tiếp đón.",
          "Cung cấp CCCD, thẻ BHYT nếu có và giấy tờ chuyển tuyến nếu áp dụng.",
          "Thanh toán hoặc xác nhận bảo lãnh/BHYT theo hướng dẫn.",
          "Đo sinh hiệu và chờ gọi vào phòng khám.",
          "Bác sĩ khám, chỉ định cận lâm sàng nếu cần.",
          "Thực hiện xét nghiệm/chẩn đoán hình ảnh và quay lại phòng khám nhận kết luận.",
          "Nhận đơn thuốc, hướng dẫn tái khám hoặc hoàn tất hồ sơ ra về.",
        ],
        tags: ["quy trình", "khám ngoại trú", "đăng ký khám", "khám bệnh", "outpatient"],
      },
      {
        title: "Quy trình đặt lịch khám",
        steps: [
          "Liên hệ kênh đặt lịch của bệnh viện hoặc cung cấp thông tin qua chatbot.",
          "Cung cấp họ tên, số điện thoại, chuyên khoa hoặc nhu cầu khám.",
          "Bệnh viện xác nhận thời gian hẹn trước khi lịch có hiệu lực.",
          "Đến bệnh viện trước giờ hẹn để hoàn tất thủ tục tiếp đón.",
        ],
        tags: ["quy trình", "đặt lịch", "đăng ký khám", "hẹn khám", "hotline"],
      },
    ];
    const preparationRows = [
      {
        title: "Đi khám lần đầu cần mang gì",
        content:
          "Người bệnh nên mang CCCD hoặc giấy tờ tùy thân, thẻ BHYT nếu có, giấy chuyển tuyến nếu khám BHYT đúng tuyến, kết quả khám hoặc xét nghiệm cũ, đơn thuốc đang dùng và số điện thoại liên hệ.",
        tags: ["mang gì", "chuẩn bị", "đi khám", "lần đầu", "bảo hiểm", "BHYT", "CCCD"],
      },
      {
        title: "Đi tái khám cần mang gì",
        content:
          "Khi tái khám, người bệnh nên mang giấy hẹn tái khám, sổ khám hoặc hồ sơ bệnh án liên quan, kết quả xét nghiệm/chẩn đoán hình ảnh gần nhất, đơn thuốc đang dùng, CCCD và thẻ BHYT nếu có.",
        tags: ["mang gì", "chuẩn bị", "tái khám", "giấy hẹn", "hồ sơ"],
      },
    ];

    let processes = 0;
    let preparations = 0;
    let faqs = 0;

    for (const row of processRows) {
      const content = row.steps.map((step, index) => `${index + 1}. ${step}`).join("\n");
      const result = await pool.query<{ id: string }>(
        `INSERT INTO processes (title, content, steps, tags, source, source_row)
         VALUES ($1, $2, $3::jsonb, $4, 'demo_seed', NULL)
         RETURNING id`,
        [row.title, content, JSON.stringify(row.steps), row.tags],
      );
      await indexProcess(result.rows[0].id);

      const faq = await pool.query<{ id: string }>(
        `INSERT INTO faqs (question, answer, tags, metadata, source, source_row)
         VALUES ($1, $2, $3, $4::jsonb, 'demo_seed', NULL)
         RETURNING id`,
        [`${row.title} như thế nào?`, content, row.tags, JSON.stringify({ linked_type: "process", demo_seed: true })],
      );
      await indexFaq(faq.rows[0].id);
      processes++;
      faqs++;
    }

    for (const row of preparationRows) {
      const result = await pool.query<{ id: string }>(
        `INSERT INTO preparations (title, content, tags, metadata, source, source_row)
         VALUES ($1, $2, $3, $4::jsonb, 'demo_seed', NULL)
         RETURNING id`,
        [row.title, row.content, row.tags, JSON.stringify({ demo_seed: true })],
      );
      await indexPreparation(result.rows[0].id);

      const faq = await pool.query<{ id: string }>(
        `INSERT INTO faqs (question, answer, tags, metadata, source, source_row)
         VALUES ($1, $2, $3, $4::jsonb, 'demo_seed', NULL)
         RETURNING id`,
        [`${row.title}?`, row.content, row.tags, JSON.stringify({ linked_type: "preparation", demo_seed: true })],
      );
      await indexFaq(faq.rows[0].id);
      preparations++;
      faqs++;
    }

    await pool.query("COMMIT");
    console.log(JSON.stringify({ processes, preparations, faqs }, null, 2));
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
