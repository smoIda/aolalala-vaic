export const requestTimeoutMs = Number(process.env.CHATBOT_REQUEST_TIMEOUT_MS ?? 10_000);

export function timeoutSignal(timeoutMs = requestTimeoutMs): AbortSignal {
  return AbortSignal.timeout(timeoutMs);
}
