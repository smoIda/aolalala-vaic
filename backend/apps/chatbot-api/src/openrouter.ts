import { mkdir, appendFile } from "node:fs/promises";
import { dirname } from "node:path";
import { z } from "zod";
import { timeoutSignal } from "./timeout.js";

export const intentSchema = z.object({
  intent: z.enum([
    "hospital_information",
    "department_information",
    "service_price",
    "navigation",
    "doctor_availability",
    "medical_consultation",
    "appointment",
    "emergency",
    "unknown",
  ]),
  flow: z.string().nullable().optional(),
  action: z.string().nullable().optional(),
  need_context: z.boolean().default(false),
  confidence: z.number().min(0).max(1),
  entities: z.record(z.string(), z.unknown()).default({}),
  needsHuman: z.boolean().default(false),
  emergencySignals: z.array(z.string()).default([]),
});

export type IntentResult = z.infer<typeof intentSchema>;

type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

type RecentChatMessage = {
  role: "user" | "assistant" | "tool";
  content: string;
};

const apiKey = process.env.OPENROUTER_API_KEY;
const model = process.env.OPENROUTER_MODEL ?? "~openai/gpt-latest";
const referer = process.env.OPENROUTER_HTTP_REFERER ?? "http://localhost:3000";
const appTitle = process.env.OPENROUTER_APP_TITLE ?? "Hert Hospital Chatbot";
const aiProviderLogEnabled = ["1", "true", "yes", "on"].includes(
  (process.env.AI_PROVIDER_LOG_ENABLED ?? "").toLowerCase(),
);
const aiProviderLogFile = process.env.AI_PROVIDER_LOG_FILE ?? "/app/logs/ai-provider.log";

export async function classifyIntent(message: string): Promise<IntentResult> {
  if (!apiKey) return fallbackIntent(message);

  const text = await callOpenRouter([
    {
      role: "system",
      content:
        "Bạn là intent classifier cho chatbot bệnh viện. Chỉ trả JSON hợp lệ, không markdown. " +
        "Schema: {\"intent\":\"hospital_information|department_information|service_price|navigation|doctor_availability|medical_consultation|appointment|emergency|unknown\",\"flow\":\"...\",\"action\":\"...\",\"need_context\":boolean,\"confidence\":0..1,\"entities\":{},\"needsHuman\":boolean,\"emergencySignals\":[]}. " +
        "Nếu user hỏi địa chỉ bệnh viện hoặc thông tin chung thì hospital_information. " +
        "Nếu user hỏi khoa ở đâu hoặc khoa có khám không thì department_information. " +
        "Nếu user hỏi BHYT, bảo hiểm y tế, chuyển tuyến, chuyển viện, giấy chuyển tuyến, đúng tuyến hoặc đơn thuốc khi khám thì hospital_information với flow insurance_inquiry và action search_policy. " +
        "Nếu user hỏi giá, chi phí hoặc dịch vụ bao nhiêu tiền thì service_price. " +
        "Nếu user hỏi đường đi, phòng/tòa/tầng, đang ở cổng chính hoặc cần đến phòng thì navigation. " +
        "Nếu user hỏi bác sĩ nào, lịch bác sĩ, sáng mai có bác sĩ không thì doctor_availability. " +
        "Chỉ chọn appointment khi user thể hiện muốn thực hiện đặt lịch/hẹn khám ngay, ví dụ 'tôi muốn đặt lịch khám', 'đăng ký khám giúp tôi'. " +
        "Nếu user mô tả triệu chứng như đau ngực, khó thở, sốt, đau bụng thì medical_consultation; nếu dữ dội/cấp cứu/khó thở nặng thì emergency. " +
        "Không trả lời câu hỏi của user.",
    },
    {
      role: "user",
      content: `Classify this Vietnamese hospital chatbot message:\n${message}`,
    },
  ]);

  return intentSchema.parse(JSON.parse(extractJson(text)));
}

export async function generateGroundedAnswer(message: string, context: string): Promise<string> {
  if (!apiKey) {
    return context
      ? `Theo dữ liệu nội bộ hiện có:\n${context.slice(0, 1200)}`
      : "Tôi chưa có thông tin";
  }

  const text = await callOpenRouter([
    {
      role: "system",
      content:
        "Bạn là trợ lý bệnh viện. Chỉ được trả lời dựa trên Context. " +
        "Nếu Context không đủ thì nói \"Tôi chưa có thông tin\". " +
        "Không chẩn đoán bệnh, không kê đơn, không suy diễn ngoài tài liệu.",
    },
    {
      role: "user",
      content: `Context:\n${context}\n\nQuestion:\n${message}`,
    },
  ]);

  return text.trim() || "Tôi chưa có thông tin";
}

export async function generateSessionRecallAnswer(
  currentQuestion: string,
  recentMessages: RecentChatMessage[],
): Promise<string> {
  const previousUserMessages = recentMessages.filter((message) => message.role === "user");

  if (!previousUserMessages.length) {
    return "Tôi chưa có câu hỏi trước đó trong phiên chat này.";
  }

  if (!apiKey) {
    return `Câu hỏi trước của bạn là: ${previousUserMessages[previousUserMessages.length - 1].content}`;
  }

  const text = await callOpenRouter([
    {
      role: "system",
      content:
        "Bạn là trợ lý bệnh viện. Chỉ trả lời dựa trên Recent Conversation. " +
        "Nếu user hỏi câu hỏi trước/tin nhắn trước, hãy trả lời ngắn gọn nội dung user đã hỏi trước đó. " +
        "Không dùng kiến thức ngoài hội thoại, không chẩn đoán, không kê đơn.",
    },
    {
      role: "user",
      content: `Recent Conversation:\n${formatRecentConversation(recentMessages)}\n\nCurrent Question:\n${currentQuestion}`,
    },
  ]);

  return text.trim() || "Tôi chưa có câu hỏi trước đó trong phiên chat này.";
}

export async function generateSessionSummary(input: {
  previousSummary?: string | null;
  recentMessages: RecentChatMessage[];
  currentFlow: string | null;
  currentState: string | null;
  context: Record<string, unknown>;
  intent: Record<string, unknown>;
  action: Record<string, unknown> | null;
}): Promise<string> {
  if (!apiKey) return fallbackSessionSummary(input);

  const text = await callOpenRouter([
    {
      role: "system",
      content:
        "Bạn cập nhật bộ nhớ ngắn hạn cho chatbot bệnh viện. " +
        "Chỉ tóm tắt facts về nhu cầu, chủ đề đã hỏi, lựa chọn và workflow state của user. " +
        "Không chẩn đoán, không kê đơn, không thêm thông tin ngoài hội thoại. " +
        "Trả về tiếng Việt, tối đa 5 bullet ngắn, dưới 900 ký tự.",
    },
    {
      role: "user",
      content: [
        `Previous Summary:\n${input.previousSummary || "none"}`,
        `Conversation State:\nFlow: ${input.currentFlow ?? "none"}\nState: ${input.currentState ?? "none"}\nContext: ${JSON.stringify(input.context)}`,
        `Intent: ${JSON.stringify(input.intent)}`,
        `Action: ${JSON.stringify(input.action)}`,
        `Recent Conversation:\n${formatRecentConversation(input.recentMessages)}`,
      ].join("\n\n"),
    },
  ]);

  return compactSummary(text) || fallbackSessionSummary(input);
}

async function callOpenRouter(messages: ChatMessage[]): Promise<string> {
  const startedAt = Date.now();
  const requestBody = {
    model,
    messages,
  };

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`,
      "HTTP-Referer": referer,
      "X-OpenRouter-Title": appTitle,
    },
    body: JSON.stringify(requestBody),
    signal: timeoutSignal(),
  });

  const responseText = await response.text();
  const responseBody = parseJsonOrText(responseText);

  await logAiProviderExchange({
    timestamp: new Date().toISOString(),
    provider: "openrouter",
    endpoint: "https://openrouter.ai/api/v1/chat/completions",
    durationMs: Date.now() - startedAt,
    request: requestBody,
    response: {
      ok: response.ok,
      status: response.status,
      statusText: response.statusText,
      body: responseBody,
    },
  });

  if (!response.ok) {
    throw new Error(`OpenRouter API failed with ${response.status}: ${responseText}`);
  }

  const payload = responseBody as {
    choices?: Array<{ message?: { content?: string | null } }>;
  };

  return payload.choices?.[0]?.message?.content ?? "";
}

function parseJsonOrText(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function formatRecentConversation(messages: RecentChatMessage[]): string {
  return messages.map((message) => `${message.role}: ${message.content}`).join("\n");
}

function fallbackSessionSummary(input: {
  previousSummary?: string | null;
  recentMessages: RecentChatMessage[];
  currentFlow: string | null;
  currentState: string | null;
  context: Record<string, unknown>;
}) {
  const facts = new Set<string>();
  const topics = collectSummaryTopics(input.previousSummary ?? "", input.context);
  if (topics.length) facts.add(`Các chủ đề đã hỏi: ${topics.join(", ")}.`);
  const lastUser = [...input.recentMessages].reverse().find((message) => message.role === "user")?.content;
  const lastAssistant = [...input.recentMessages].reverse().find((message) => message.role === "assistant")?.content;
  const contextFacts = [
    input.currentFlow ? `Flow hiện tại: ${input.currentFlow}${input.currentState ? `/${input.currentState}` : ""}.` : null,
    lastUser ? `Tin user gần nhất: ${lastUser}` : null,
    getContextString(input.context, "last_department") || getContextString(input.context, "department")
      ? `Chuyên khoa liên quan: ${getContextString(input.context, "department") ?? getContextString(input.context, "last_department")}.`
      : null,
    getContextString(input.context, "last_service") ? `Dịch vụ liên quan: ${getContextString(input.context, "last_service")}.` : null,
    getContextString(input.context, "last_topic") ? `User đã hỏi về ${getContextString(input.context, "last_topic")}.` : null,
    lastAssistant ? `Phản hồi gần nhất: ${lastAssistant.slice(0, 180)}` : null,
  ];

  for (const fact of contextFacts) {
    if (fact) facts.add(fact);
  }
  for (const line of (input.previousSummary ?? "").split("\n")) {
    const fact = line.trim();
    if (fact) facts.add(fact);
  }

  return compactSummary([...facts].join("\n"));
}

function collectSummaryTopics(previousSummary: string, context: Record<string, unknown>) {
  const topics = new Set<string>();
  for (const topic of previousSummary.matchAll(/(?:User đã hỏi về|Chuyên khoa liên quan:|Các chủ đề đã hỏi:)\s*([^.\n]+)/g)) {
    for (const item of topic[1].split(",")) {
      const normalized = item.trim();
      if (normalized) topics.add(normalized);
    }
  }
  for (const key of ["last_topic", "department", "last_department", "last_service"]) {
    const value = getContextString(context, key);
    if (value) topics.add(value);
  }
  return [...topics].slice(0, 6);
}

function compactSummary(value: string) {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 5)
    .join("\n")
    .slice(0, 900)
    .trim();
}

function getContextString(context: Record<string, unknown>, key: string): string | null {
  const value = context[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

async function logAiProviderExchange(entry: Record<string, unknown>) {
  if (!aiProviderLogEnabled) return;

  try {
    await mkdir(dirname(aiProviderLogFile), { recursive: true });
    await appendFile(aiProviderLogFile, `${JSON.stringify(entry)}\n`, "utf8");
  } catch (error) {
    console.warn("Failed to write AI provider log", error);
  }
}

function extractJson(text: string): string {
  const trimmed = text.trim();
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) return trimmed;

  const match = trimmed.match(/\{[\s\S]*\}/);
  if (!match) throw new Error(`OpenRouter did not return JSON: ${trimmed}`);
  return match[0];
}

function fallbackIntent(message: string): IntentResult {
  const text = message.toLowerCase();
  const emergencyWords = ["cấp cứu", "khó thở", "đau ngực dữ dội", "ngất", "115"];
  const appointmentGuidanceWords = [
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

  if (emergencyWords.some((word) => text.includes(word))) {
    return {
      intent: "emergency",
      flow: "emergency",
      action: "emergency_guidance",
      need_context: false,
      confidence: 0.8,
      entities: {},
      needsHuman: true,
      emergencySignals: emergencyWords.filter((word) => text.includes(word)),
    };
  }

  if (
    ["đăng ký khám", "đặt lịch", "lịch khám", "hẹn khám"].some((word) => text.includes(word)) &&
    appointmentGuidanceWords.some((word) => text.includes(word))
  ) {
    return {
      intent: "hospital_information",
      flow: "hospital_information",
      action: "answer_policy",
      need_context: true,
      confidence: 0.72,
      entities: {},
      needsHuman: false,
      emergencySignals: [],
    };
  }

  if (["bác sĩ", "bac si", "bs ", "bác sỹ"].some((word) => text.includes(word))) {
    return {
      intent: "doctor_availability",
      flow: "doctor",
      action: "search_doctor",
      need_context: true,
      confidence: 0.74,
      entities: {},
      needsHuman: false,
      emergencySignals: [],
    };
  }

  if (isInsuranceInquiry(text)) {
    return {
      intent: "hospital_information",
      flow: "insurance_inquiry",
      action: "search_policy",
      need_context: true,
      confidence: 0.72,
      entities: { topic: "BHYT" },
      needsHuman: false,
      emergencySignals: [],
    };
  }

  if (["giá", "chi phí", "bao nhiêu tiền"].some((word) => text.includes(word))) {
    return {
      intent: "service_price",
      flow: "service",
      action: "search_price",
      need_context: true,
      confidence: 0.72,
      entities: {},
      needsHuman: false,
      emergencySignals: [],
    };
  }

  if (["phòng", "tầng", "cổng", "đường đi", "hướng dẫn đường", "đến phòng", "ở đâu"].some((word) => text.includes(word))) {
    return {
      intent: text.includes("khoa") ? "department_information" : "navigation",
      flow: "navigation",
      action: "search_navigation",
      need_context: true,
      confidence: 0.7,
      entities: {},
      needsHuman: false,
      emergencySignals: [],
    };
  }

  if (
    [
      "dịch vụ",
      "danh sách dịch vụ",
      "khoa",
      "ở đâu",
      "quy trình",
      "bảo hiểm",
      "hotline",
      "hướng dẫn",
      "chỉ dẫn",
    ].some((word) => text.includes(word))
  ) {
    return {
      intent: "hospital_information",
      flow: "hospital_information",
      action: "search_knowledge",
      need_context: true,
      confidence: 0.65,
      entities: {},
      needsHuman: false,
      emergencySignals: [],
    };
  }

  if (["đặt lịch", "lịch khám", "booking", "hẹn khám"].some((word) => text.includes(word))) {
    return {
      intent: "appointment",
      flow: "appointment",
      action: "collect_appointment",
      need_context: true,
      confidence: 0.7,
      entities: {},
      needsHuman: false,
      emergencySignals: [],
    };
  }

  if (["đau", "triệu chứng", "uống thuốc", "chẩn đoán"].some((word) => text.includes(word))) {
    return {
      intent: "medical_consultation",
      flow: "medical_consultation",
      action: "triage_options",
      need_context: true,
      confidence: 0.65,
      entities: {},
      needsHuman: true,
      emergencySignals: [],
    };
  }

  return {
    intent: "unknown",
    flow: null,
    action: null,
    need_context: true,
    confidence: 0.4,
    entities: {},
    needsHuman: false,
    emergencySignals: [],
  };
}

function isInsuranceInquiry(text: string): boolean {
  return [
    "bhyt",
    "bảo hiểm",
    "bao hiem",
    "bảo hiểm y tế",
    "bao hiem y te",
    "chuyển tuyến",
    "chuyen tuyen",
    "chuyển viện",
    "chuyen vien",
    "giấy chuyển tuyến",
    "giay chuyen tuyen",
    "giấy chuyển viện",
    "giay chuyen vien",
    "phiếu chuyển viện",
    "phieu chuyen vien",
    "đúng tuyến",
    "dung tuyen",
    "đơn thuốc",
    "don thuoc",
  ].some((word) => text.includes(word));
}
