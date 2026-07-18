import { timeoutSignal } from "./timeout.js";

const dashboardApiUrl = process.env.DASHBOARD_API_URL ?? "http://localhost:8000/api/internal";
const internalApiKey = process.env.INTERNAL_API_KEY ?? "dev-internal-key";

export async function createDashboardTicket(input: {
  title: string;
  description: string;
  priority?: string;
  ticketType?: string | null;
  patientName?: string | null;
  patientPhone?: string | null;
  patientEmail?: string | null;
  metadata?: Record<string, unknown>;
}) {
  const response = await fetch(`${dashboardApiUrl}/tickets`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-internal-api-key": internalApiKey,
    },
    body: JSON.stringify({
      title: input.title,
      description: input.description,
      priority: input.priority,
      ticket_type: input.ticketType,
      patient_name: input.patientName,
      patient_phone: input.patientPhone,
      patient_email: input.patientEmail,
      metadata: input.metadata ?? {},
    }),
    signal: timeoutSignal(),
  });

  if (!response.ok) {
    throw new Error(`Dashboard ticket API failed with ${response.status}`);
  }

  return response.json();
}
