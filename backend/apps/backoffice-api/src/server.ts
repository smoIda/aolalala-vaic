import Fastify from "fastify";
import { fromNodeHeaders } from "better-auth/node";
import { z } from "zod";
import { auth } from "./auth.js";
import { closePool, pool } from "./db.js";

const internalApiKey = process.env.INTERNAL_API_KEY ?? "dev-internal-key";

const ticketSchema = z.object({
  source: z.string().default("chatbot"),
  priority: z.string().default("normal"),
  ticketType: z.string().nullable().optional(),
  title: z.string().min(1),
  description: z.string().min(1),
  patientName: z.string().nullable().optional(),
  patientPhone: z.string().nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).default({}),
});

const bookingSchema = z.object({
  source: z.string().default("chatbot"),
  patientName: z.string().nullable().optional(),
  patientPhone: z.string().nullable().optional(),
  department: z.string().nullable().optional(),
  preferredDate: z.string().nullable().optional(),
  preferredTime: z.string().nullable().optional(),
  note: z.string().nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).default({}),
});

function requireInternalKey(request: { headers: Record<string, unknown> }) {
  const provided = request.headers["x-internal-api-key"];
  return typeof provided === "string" && provided === internalApiKey;
}

const app = Fastify({ logger: true });

app.route({
  method: ["GET", "POST"],
  url: "/api/auth/*",
  async handler(request, reply) {
    try {
      const url = new URL(request.url, `http://${request.headers.host}`);
      const headers = fromNodeHeaders(request.headers);
      const req = new Request(url.toString(), {
        method: request.method,
        headers,
        ...(request.body ? { body: JSON.stringify(request.body) } : {}),
      });
      const response = await auth.handler(req);
      reply.status(response.status);
      response.headers.forEach((value, key) => reply.header(key, value));
      return reply.send(response.body ? await response.text() : null);
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({ error: "AUTH_FAILURE" });
    }
  },
});

app.get("/health", async () => {
  await pool.query("SELECT 1");
  return { ok: true, service: "backoffice-api" };
});

app.post("/tickets", async (request, reply) => {
  if (!requireInternalKey(request)) {
    return reply.status(401).send({ error: "unauthorized" });
  }

  const payload = ticketSchema.parse(request.body);
  const result = await pool.query(
    `INSERT INTO tickets
      (source, priority, ticket_type, title, description, patient_name, patient_phone, metadata)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING *`,
    [
      payload.source,
      payload.priority,
      payload.ticketType ?? null,
      payload.title,
      payload.description,
      payload.patientName ?? null,
      payload.patientPhone ?? null,
      payload.metadata,
    ],
  );

  return reply.status(201).send({ ticket: result.rows[0] });
});

app.get("/tickets", async (request, reply) => {
  if (!requireInternalKey(request)) {
    return reply.status(401).send({ error: "unauthorized" });
  }

  const result = await pool.query("SELECT * FROM tickets ORDER BY created_at DESC LIMIT 100");
  return { tickets: result.rows };
});

app.patch<{
  Params: { id: string };
  Body: { status?: string; priority?: string };
}>("/tickets/:id", async (request, reply) => {
  if (!requireInternalKey(request)) {
    return reply.status(401).send({ error: "unauthorized" });
  }

  const status = request.body?.status;
  const priority = request.body?.priority;
  const result = await pool.query(
    `UPDATE tickets
     SET status = coalesce($2, status), priority = coalesce($3, priority)
     WHERE id = $1
     RETURNING *`,
    [request.params.id, status ?? null, priority ?? null],
  );

  if (!result.rowCount) return reply.status(404).send({ error: "not_found" });
  return { ticket: result.rows[0] };
});

app.post("/bookings", async (request, reply) => {
  if (!requireInternalKey(request)) {
    return reply.status(401).send({ error: "unauthorized" });
  }

  const payload = bookingSchema.parse(request.body);
  const result = await pool.query(
    `INSERT INTO bookings
      (source, patient_name, patient_phone, department, preferred_date, preferred_time, note, metadata)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING *`,
    [
      payload.source,
      payload.patientName ?? null,
      payload.patientPhone ?? null,
      payload.department ?? null,
      payload.preferredDate ?? null,
      payload.preferredTime ?? null,
      payload.note ?? null,
      payload.metadata,
    ],
  );

  return reply.status(201).send({ booking: result.rows[0] });
});

app.get("/bookings", async (request, reply) => {
  if (!requireInternalKey(request)) {
    return reply.status(401).send({ error: "unauthorized" });
  }

  const result = await pool.query("SELECT * FROM bookings ORDER BY created_at DESC LIMIT 100");
  return { bookings: result.rows };
});

const port = Number(process.env.BACKOFFICE_PORT ?? 4000);

app.listen({ host: "0.0.0.0", port }).catch(async (error) => {
  app.log.error(error);
  await closePool();
  process.exit(1);
});
