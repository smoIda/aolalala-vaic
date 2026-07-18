import { API_URL } from "./constants";

export async function transcribeVoice(audio: Blob): Promise<{ transcript: string }> {
  const response = await fetch(`${API_URL}/voice`, {
    method: "POST",
    headers: {
      "Content-Type": audio.type || "application/octet-stream",
    },
    body: audio,
  });

  if (!response.ok) {
    throw new Error("Failed to transcribe voice");
  }

  return response.json();
}
