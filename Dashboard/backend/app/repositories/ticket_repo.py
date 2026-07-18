"""Postgres-backed ticket repository for the dashboard."""

from __future__ import annotations

from datetime import datetime
from typing import Dict, List, Optional, Tuple

import psycopg
from psycopg.rows import dict_row
from psycopg.types.json import Jsonb

from ..config import DASHBOARD_DATABASE_URL, TICKET_ID_PREFIX
from ..models import Assignee, Note, Sender, Ticket, TicketStatus
from ..services.classifier import strip_accents


class TicketRepository:
    """Lưu trữ ticket trong Postgres, giữ nguyên interface cũ cho router/service."""

    def __init__(self) -> None:
        self._ensure_schema()

    def _connect(self):
        return psycopg.connect(DASHBOARD_DATABASE_URL, row_factory=dict_row)

    def _ensure_schema(self) -> None:
        with self._connect() as conn:
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS dashboard_tickets (
                  id TEXT PRIMARY KEY,
                  question TEXT NOT NULL,
                  full_question TEXT NOT NULL,
                  ticket_type TEXT NOT NULL,
                  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed')),
                  priority TEXT CHECK (priority IN ('cao', 'thuong', 'khan')),
                  data_form_code TEXT,
                  data_form_name TEXT,
                  sender JSONB NOT NULL,
                  assignee JSONB,
                  notes JSONB NOT NULL DEFAULT '[]'::jsonb,
                  suggested_action TEXT,
                  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
                  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
                )
                """
            )
            conn.execute("CREATE INDEX IF NOT EXISTS dashboard_tickets_status_idx ON dashboard_tickets(status)")
            conn.execute(
                "CREATE INDEX IF NOT EXISTS dashboard_tickets_ticket_type_idx ON dashboard_tickets(ticket_type)"
            )
            conn.execute(
                "CREATE INDEX IF NOT EXISTS dashboard_tickets_created_at_idx ON dashboard_tickets(created_at DESC)"
            )
            conn.execute("CREATE SEQUENCE IF NOT EXISTS dashboard_ticket_seq START WITH 1")
            conn.execute(
                """
                SELECT setval(
                  'dashboard_ticket_seq',
                  greatest(
                    coalesce((SELECT max((regexp_match(id, '[0-9]+$'))[1]::bigint) FROM dashboard_tickets), 0),
                    1
                  ),
                  coalesce((SELECT count(*) > 0 FROM dashboard_tickets), false)
                )
                """
            )
            conn.execute(
                """
                CREATE OR REPLACE FUNCTION touch_updated_at()
                RETURNS trigger AS $$
                BEGIN
                  NEW.updated_at = now();
                  RETURN NEW;
                END;
                $$ LANGUAGE plpgsql
                """
            )
            conn.execute("DROP TRIGGER IF EXISTS dashboard_tickets_touch_updated_at ON dashboard_tickets")
            conn.execute(
                """
                CREATE TRIGGER dashboard_tickets_touch_updated_at
                BEFORE UPDATE ON dashboard_tickets
                FOR EACH ROW EXECUTE FUNCTION touch_updated_at()
                """
            )

    def _row_to_ticket(self, row: dict) -> Ticket:
        return Ticket(
            id=row["id"],
            question=row["question"],
            full_question=row["full_question"],
            ticket_type=row["ticket_type"],
            status=row["status"],
            priority=row["priority"],
            data_form_code=row["data_form_code"],
            data_form_name=row["data_form_name"],
            created_at=self._format_created_at(row["created_at"]),
            sender=Sender(**row["sender"]),
            assignee=Assignee(**row["assignee"]) if row["assignee"] else None,
            notes=[Note(**note) for note in row["notes"]],
            suggested_action=row["suggested_action"],
        )

    @staticmethod
    def _format_created_at(value) -> str:
        if isinstance(value, datetime):
            return value.strftime("%Y-%m-%dT%H:%M:%S")
        return str(value)

    @staticmethod
    def _ticket_params(ticket: Ticket) -> dict:
        return {
            "id": ticket.id,
            "question": ticket.question,
            "full_question": ticket.full_question,
            "ticket_type": ticket.ticket_type,
            "status": ticket.status.value,
            "priority": ticket.priority.value if ticket.priority else None,
            "data_form_code": ticket.data_form_code,
            "data_form_name": ticket.data_form_name,
            "sender": Jsonb(ticket.sender.model_dump()),
            "assignee": Jsonb(ticket.assignee.model_dump()) if ticket.assignee else None,
            "notes": Jsonb([note.model_dump() for note in ticket.notes]),
            "suggested_action": ticket.suggested_action,
            "created_at": ticket.created_at,
        }

    def next_id(self) -> str:
        with self._connect() as conn:
            row = conn.execute("SELECT nextval('dashboard_ticket_seq') AS seq").fetchone()
        return f"{TICKET_ID_PREFIX}-{row['seq']:07d}"

    def get(self, ticket_id: str) -> Optional[Ticket]:
        with self._connect() as conn:
            row = conn.execute("SELECT * FROM dashboard_tickets WHERE id = %s", [ticket_id]).fetchone()
        return self._row_to_ticket(row) if row else None

    def list(
        self,
        *,
        q: Optional[str] = None,
        ticket_type: Optional[str] = None,
        status: Optional[str] = None,
        sort: str = "newest",
        page: int = 1,
        page_size: int = 10,
    ) -> Tuple[List[Ticket], int]:
        conditions = []
        params: list[object] = []

        if ticket_type:
            conditions.append("ticket_type = %s")
            params.append(ticket_type)

        if status:
            conditions.append("status = %s")
            params.append(status)

        where = f"WHERE {' AND '.join(conditions)}" if conditions else ""
        order = "ASC" if sort == "oldest" else "DESC"
        offset = max(page - 1, 0) * page_size

        with self._connect() as conn:
            if q:
                rows = conn.execute(
                    f"SELECT * FROM dashboard_tickets {where} ORDER BY created_at {order}, id {order}",
                    params,
                ).fetchall()
            else:
                total = conn.execute(f"SELECT count(*) AS total FROM dashboard_tickets {where}", params).fetchone()[
                    "total"
                ]
                rows = conn.execute(
                    f"""
                    SELECT *
                    FROM dashboard_tickets
                    {where}
                    ORDER BY created_at {order}, id {order}
                    LIMIT %s OFFSET %s
                    """,
                    [*params, page_size, offset],
                ).fetchall()

        if q:
            needle = strip_accents(q.strip())
            tickets = [self._row_to_ticket(row) for row in rows]
            filtered = [
                ticket
                for ticket in tickets
                if needle in strip_accents(ticket.id)
                or needle in strip_accents(ticket.question)
                or needle in strip_accents(ticket.full_question)
                or needle in strip_accents(ticket.sender.name)
            ]
            total = len(filtered)
            return filtered[offset : offset + page_size], total

        return [self._row_to_ticket(row) for row in rows], total

    def add(self, ticket: Ticket) -> Ticket:
        params = self._ticket_params(ticket)
        with self._connect() as conn:
            row = conn.execute(
                """
                INSERT INTO dashboard_tickets
                  (id, question, full_question, ticket_type, status, priority, data_form_code, data_form_name,
                   sender, assignee, notes, suggested_action, created_at)
                VALUES
                  (%(id)s, %(question)s, %(full_question)s, %(ticket_type)s, %(status)s, %(priority)s,
                   %(data_form_code)s, %(data_form_name)s, %(sender)s, %(assignee)s, %(notes)s,
                   %(suggested_action)s, %(created_at)s)
                RETURNING *
                """,
                params,
            ).fetchone()
        return self._row_to_ticket(row)

    def update_status(self, ticket_id: str, status: TicketStatus) -> Optional[Ticket]:
        with self._connect() as conn:
            row = conn.execute(
                "UPDATE dashboard_tickets SET status = %s WHERE id = %s RETURNING *",
                [status.value, ticket_id],
            ).fetchone()
        return self._row_to_ticket(row) if row else None

    def update_ticket_type(self, ticket_id: str, ticket_type: str) -> Optional[Ticket]:
        with self._connect() as conn:
            row = conn.execute(
                "UPDATE dashboard_tickets SET ticket_type = %s WHERE id = %s RETURNING *",
                [ticket_type, ticket_id],
            ).fetchone()
        return self._row_to_ticket(row) if row else None

    def add_note(self, ticket_id: str, note: Note) -> Optional[Ticket]:
        ticket = self.get(ticket_id)
        if ticket is None:
            return None

        notes = [existing.model_dump() for existing in ticket.notes]
        notes.append(note.model_dump())
        with self._connect() as conn:
            row = conn.execute(
                "UPDATE dashboard_tickets SET notes = %s WHERE id = %s RETURNING *",
                [Jsonb(notes), ticket_id],
            ).fetchone()
        return self._row_to_ticket(row) if row else None

    def update_assignee(self, ticket_id: str, assignee: Assignee) -> Optional[Ticket]:
        with self._connect() as conn:
            row = conn.execute(
                "UPDATE dashboard_tickets SET assignee = %s WHERE id = %s RETURNING *",
                [Jsonb(assignee.model_dump()), ticket_id],
            ).fetchone()
        return self._row_to_ticket(row) if row else None

    def stats(self) -> Dict[str, int]:
        with self._connect() as conn:
            row = conn.execute(
                """
                SELECT
                  count(*) AS total,
                  count(*) FILTER (WHERE status = 'completed') AS completed,
                  count(*) FILTER (WHERE status = 'pending') AS pending
                FROM dashboard_tickets
                """
            ).fetchone()
        return {"total": row["total"], "completed": row["completed"], "pending": row["pending"]}

    def ticket_types(self) -> List[str]:
        with self._connect() as conn:
            rows = conn.execute(
                "SELECT DISTINCT ticket_type FROM dashboard_tickets ORDER BY ticket_type"
            ).fetchall()
        return [row["ticket_type"] for row in rows]

ticket_repo = TicketRepository()
