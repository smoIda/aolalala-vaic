import { randomUUID } from "node:crypto";
import { pool } from "./db.js";

export type ChatRole = "user" | "assistant" | "tool";

export type ChatSession = {
  id: string;
  userId: string | null;
  status: string;
  currentFlow: string | null;
  currentState: string | null;
  context: Record<string, unknown>;
};

export type ChatMessage = {
  role: ChatRole;
  content: string;
  toolName: string | null;
};

export class SessionNotFoundError extends Error {
  constructor(sessionId: string) {
    super(`Chat session not found: ${sessionId}`);
    this.name = "SessionNotFoundError";
  }
}

type ChatSessionRow = {
  id: string;
  user_id: string | null;
  status: string;
  current_flow: string | null;
  current_state: string | null;
  context: unknown;
};

type ChatMessageRow = {
  role: ChatRole;
  content: string;
  tool_name: string | null;
};

export async function loadOrCreateSession(sessionId?: string, userId?: string | null): Promise<ChatSession> {
  if (sessionId) {
    const existing = await pool.query<ChatSessionRow>("SELECT * FROM chat_sessions WHERE id = $1", [sessionId]);
    if (existing.rows[0]) return mapSession(existing.rows[0]);
    throw new SessionNotFoundError(sessionId);
  }

  const id = randomUUID();
  const result = await pool.query<ChatSessionRow>(
    `INSERT INTO chat_sessions (id, user_id)
     VALUES ($1, $2)
     RETURNING *`,
    [id, userId ?? null],
  );

  return mapSession(result.rows[0]);
}

export async function updateSession(
  sessionId: string,
  input: {
    status?: string;
    currentFlow?: string | null;
    currentState?: string | null;
    context?: Record<string, unknown>;
  },
): Promise<ChatSession> {
  const result = await pool.query<ChatSessionRow>(
    `UPDATE chat_sessions
     SET status = coalesce($2, status),
         current_flow = $3,
         current_state = $4,
         context = coalesce($5::jsonb, context)
     WHERE id = $1
     RETURNING *`,
    [
      sessionId,
      input.status ?? null,
      input.currentFlow ?? null,
      input.currentState ?? null,
      input.context ? JSON.stringify(input.context) : null,
    ],
  );

  if (!result.rows[0]) throw new Error(`Chat session not found: ${sessionId}`);
  return mapSession(result.rows[0]);
}

export async function appendMessage(
  sessionId: string,
  role: ChatRole,
  content: string,
  input?: {
    toolName?: string | null;
    metadata?: Record<string, unknown>;
  },
) {
  await pool.query(
    `INSERT INTO chat_messages (session_id, role, content, tool_name, metadata)
     VALUES ($1, $2, $3, $4, $5::jsonb)`,
    [sessionId, role, content, input?.toolName ?? null, JSON.stringify(input?.metadata ?? {})],
  );
}

export async function getRecentMessages(sessionId: string, limit = 5): Promise<ChatMessage[]> {
  const result = await pool.query<ChatMessageRow>(
    `SELECT role, content, tool_name
     FROM chat_messages
     WHERE session_id = $1
     ORDER BY created_at DESC, id DESC
     LIMIT $2`,
    [sessionId, limit],
  );

  return result.rows.reverse().map((row) => ({
    role: row.role,
    content: row.content,
    toolName: row.tool_name,
  }));
}

function mapSession(row: ChatSessionRow): ChatSession {
  return {
    id: row.id,
    userId: row.user_id,
    status: row.status,
    currentFlow: row.current_flow,
    currentState: row.current_state,
    context: isRecord(row.context) ? row.context : {},
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
