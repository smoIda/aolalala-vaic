const backofficeApiUrl = process.env.BACKOFFICE_API_URL ?? "http://localhost:4000";
const internalApiKey = process.env.INTERNAL_API_KEY ?? "dev-internal-key";

export async function createTicket(input: {
  title: string;
  description: string;
  priority?: string;
  ticketType?: string | null;
  patientName?: string | null;
  patientPhone?: string | null;
  metadata?: Record<string, unknown>;
}) {
  const response = await fetch(`${backofficeApiUrl}/tickets`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-internal-api-key": internalApiKey,
    },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    throw new Error(`Backoffice ticket API failed with ${response.status}`);
  }

  return response.json();
}

export async function createBooking(input: {
  patientName?: string | null;
  patientPhone?: string | null;
  department?: string | null;
  preferredDate?: string | null;
  preferredTime?: string | null;
  note?: string | null;
  metadata?: Record<string, unknown>;
}) {
  const response = await fetch(`${backofficeApiUrl}/bookings`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-internal-api-key": internalApiKey,
    },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    throw new Error(`Backoffice booking API failed with ${response.status}`);
  }

  return response.json();
}
