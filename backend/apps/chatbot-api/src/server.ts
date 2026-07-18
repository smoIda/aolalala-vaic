import Fastify from "fastify";
import { z } from "zod";
import { createBooking, createTicket } from "./backoffice-client.js";
import { closePool, pool } from "./db.js";
import { classifyIntent, generateGroundedAnswer } from "./openrouter.js";
import { callMcpTool, formatContext } from "./mcp-client.js";
import { validateResponse } from "./validator.js";

const chatSchema = z.object({
  sessionId: z.string().optional(),
  message: z.string().min(1),
  userProfile: z
    .object({
      name: z.string().optional(),
      phone: z.string().optional(),
    })
    .optional(),
});

const app = Fastify({ logger: true });

app.get("/health", async () => {
  await pool.query("SELECT 1");
  return { ok: true, service: "chatbot-api" };
});

app.post("/chat", async (request, reply) => {
  const input = chatSchema.parse(request.body);
  const intent = await classifyIntent(input.message);

  let responseText: string;
  let context = "";
  let action: Record<string, unknown> | null = null;

  if (intent.intent === "emergency") {
    responseText =
      "Nếu đây là tình huống cấp cứu, vui lòng gọi 115 hoặc đến cơ sở y tế gần nhất ngay. " +
      "Chatbot không thay thế hỗ trợ cấp cứu trực tiếp.";
    action = { type: "emergency_response", signals: intent.emergencySignals };
  } else if (intent.intent === "medical_consultation") {
    const ticket = await createTicket({
      title: "Yêu cầu tư vấn y tế từ chatbot",
      description: input.message,
      priority: "high",
      ticketType: "medical_consultation",
      patientName: input.userProfile?.name ?? null,
      patientPhone: input.userProfile?.phone ?? null,
      metadata: { intent },
    });
    responseText =
      "Tôi không thể chẩn đoán hoặc tư vấn điều trị qua chat. Tôi đã ghi nhận yêu cầu để bộ phận chuyên môn hỗ trợ.";
    action = { type: "ticket_created", ticket };
  } else if (intent.intent === "appointment") {
    if (isAppointmentGuidanceQuestion(input.message)) {
      const toolName = "search_policy";
      const results = await callMcpTool(toolName, input.message, 5);
      context = formatContext(results);
      const answer = await generateGroundedAnswer(input.message, context);
      const validation = validateResponse(answer, context);
      responseText = validation.answer;
      action = { type: "mcp_search", toolName, validationReason: validation.reason };
    } else {
      const booking = await createBooking({
        patientName: input.userProfile?.name ?? null,
        patientPhone: input.userProfile?.phone ?? null,
        department: typeof intent.entities.department === "string" ? intent.entities.department : null,
        note: input.message,
        metadata: { intent },
      });
      responseText =
        "Tôi đã ghi nhận yêu cầu đặt lịch. Bệnh viện sẽ xác nhận lịch hẹn trước khi cuộc hẹn có hiệu lực.";
      action = { type: "booking_requested", booking };
    }
  } else if (intent.intent === "hospital_information") {
    const toolName = selectHospitalTool(input.message);
    const limit = toolName === "search_service" ? 10 : 5;
    const results = await callMcpTool(toolName, input.message, limit);
    context = formatContext(results);
    const answer = await generateGroundedAnswer(input.message, context);
    const validation = validateResponse(answer, context);
    responseText = validation.answer;
    action = { type: "mcp_search", toolName, validationReason: validation.reason };
  } else {
    const results = await callMcpTool("search_knowledge", input.message, 5);
    context = formatContext(results);
    const answer = await generateGroundedAnswer(input.message, context);
    const validation = validateResponse(answer, context);
    responseText = validation.answer;
    action = {
      type: "unknown_intent_mcp_fallback",
      toolName: "search_knowledge",
      validationReason: validation.reason,
    };
  }

  await pool.query(
    `INSERT INTO chat_logs (session_id, user_message, detected_intent, confidence, response_text)
     VALUES ($1, $2, $3, $4, $5)`,
    [input.sessionId ?? null, input.message, intent.intent, intent.confidence, responseText],
  );

  return reply.send({
    intent,
    response: responseText,
    action,
  });
});

function selectHospitalTool(message: string): string {
  const text = message.toLowerCase();
  if (["dịch vụ", "danh sách dịch vụ"].some((word) => text.includes(word))) return "search_service";
  if (["giá", "chi phí", "bao nhiêu tiền"].some((word) => text.includes(word))) return "search_price";
  if (["ở đâu", "tầng", "phòng", "khoa"].some((word) => text.includes(word))) return "search_navigation";
  if (["mang gì", "chuẩn bị", "giấy tờ"].some((word) => text.includes(word))) return "search_preparation";
  if (["quy trình", "thủ tục", "bước"].some((word) => text.includes(word))) return "search_process";
  if (isAppointmentGuidanceQuestion(message) || ["quy trình", "thủ tục", "bước"].some((word) => text.includes(word))) {
    return "search_policy";
  }
  if (["ticket", "hồ sơ", "kết quả xét nghiệm"].some((word) => text.includes(word))) return "search_ticket_rules";
  return "search_knowledge";
}

function isAppointmentGuidanceQuestion(message: string): boolean {
  const text = message.toLowerCase();
  const appointmentWords = ["đăng ký khám", "đặt lịch", "lịch khám", "hẹn khám"];
  const guidanceWords = [
    "chỉ dẫn",
    "hướng dẫn",
    "quy trình",
    "thủ tục",
    "các bước",
    "cách đăng ký",
    "làm sao đăng ký",
    "làm thế nào đăng ký",
    "liên hệ đặt lịch",
    "hotline",
  ];

  return appointmentWords.some((word) => text.includes(word)) && guidanceWords.some((word) => text.includes(word));
}

const port = Number(process.env.CHATBOT_PORT ?? 3000);

app.listen({ host: "0.0.0.0", port }).catch(async (error) => {
  app.log.error(error);
  await closePool();
  process.exit(1);
});
