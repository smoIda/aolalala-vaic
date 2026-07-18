const unsafeMedicalClaims = [
  "bạn bị",
  "anh bị",
  "chị bị",
  "nhồi máu cơ tim",
  "kê đơn",
];

const unsafeMedicalPatterns = [
  /\b(chẩn đoán|chan doan)\b.{0,40}\b(bạn|anh|chị|bệnh|mắc|bị)\b/i,
  /\b(bạn|anh|chị)\b.{0,40}\b(cần|nên|hãy)\b.{0,40}\b(uống thuốc|dùng thuốc)\b/i,
];

export function validateResponse(answer: string, context: string) {
  const lower = answer.toLowerCase();
  const hasUnsafeMedicalClaim =
    unsafeMedicalClaims.some((word) => lower.includes(word)) ||
    unsafeMedicalPatterns.some((pattern) => pattern.test(lower));
  const saysUnknown = lower.includes("tôi chưa có thông tin");

  if (hasUnsafeMedicalClaim) {
    return {
      ok: false,
      reason: "unsafe_medical_claim",
      answer: "Tôi không thể chẩn đoán hoặc kê đơn qua chat. Tôi sẽ tạo ticket để nhân viên y tế hỗ trợ bạn.",
    };
  }

  if (!context.trim() && !saysUnknown) {
    return {
      ok: false,
      reason: "missing_context",
      answer: "Tôi chưa có thông tin",
    };
  }

  return { ok: true, reason: null, answer };
}
