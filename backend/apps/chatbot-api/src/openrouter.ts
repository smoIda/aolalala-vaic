import { mkdir, appendFile } from "node:fs/promises";
import { dirname } from "node:path";
import { z } from "zod";

export const intentSchema = z.object({
  intent: z.enum([
    "hospital_information",
    "medical_consultation",
    "appointment",
    "emergency",
    "unknown",
  ]),
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
        "Schema: {\"intent\":\"hospital_information|medical_consultation|appointment|emergency|unknown\",\"confidence\":0..1,\"entities\":{},\"needsHuman\":boolean,\"emergencySignals\":[]}. " +
        "Nếu user hỏi danh sách dịch vụ, dịch vụ khám, giá dịch vụ hoặc chi phí thì intent là hospital_information. " +
        "Nếu user hỏi cách đăng ký khám, chỉ dẫn đăng ký khám, quy trình, thủ tục, các bước, hotline hoặc thông tin liên hệ đặt lịch thì intent là hospital_information. " +
        "Chỉ chọn appointment khi user thể hiện muốn thực hiện đặt lịch/hẹn khám ngay, ví dụ 'tôi muốn đặt lịch khám', 'đăng ký khám giúp tôi'. " +
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
    return { intent: "hospital_information", confidence: 0.72, entities: {}, needsHuman: false, emergencySignals: [] };
  }

  if (
    [
      "giá",
      "chi phí",
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
    return { intent: "hospital_information", confidence: 0.65, entities: {}, needsHuman: false, emergencySignals: [] };
  }

  if (["đặt lịch", "lịch khám", "booking", "hẹn khám"].some((word) => text.includes(word))) {
    return { intent: "appointment", confidence: 0.7, entities: {}, needsHuman: false, emergencySignals: [] };
  }

  if (["đau", "triệu chứng", "uống thuốc", "chẩn đoán"].some((word) => text.includes(word))) {
    return { intent: "medical_consultation", confidence: 0.65, entities: {}, needsHuman: true, emergencySignals: [] };
  }

  return { intent: "unknown", confidence: 0.4, entities: {}, needsHuman: false, emergencySignals: [] };
}
