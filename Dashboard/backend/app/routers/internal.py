"""Internal endpoints used by trusted backend services."""

import json
from datetime import datetime

from fastapi import APIRouter, Header, HTTPException

from ..config import INTERNAL_API_KEY
from ..models import InternalTicketCreate, Note, Priority, Sender, Ticket, TicketStatus
from ..repositories import ticket_repo

router = APIRouter(prefix="/api/internal", tags=["internal"])


def require_internal_key(x_internal_api_key: str | None) -> None:
    if x_internal_api_key != INTERNAL_API_KEY:
        raise HTTPException(status_code=401, detail="unauthorized")


def normalize_priority(priority: str | None) -> Priority | None:
    if not priority:
        return None

    value = priority.strip().lower()
    if value in {"high", "cao"}:
        return Priority.cao
    if value in {"urgent", "critical", "khan", "khẩn"}:
        return Priority.khan
    if value in {"normal", "medium", "thuong", "thường"}:
        return Priority.thuong
    return None


def metadata_notes(metadata: dict) -> list[Note]:
    if not metadata:
        return []

    return [
        Note(
            author="Chatbot",
            role="System",
            content=json.dumps(metadata, ensure_ascii=False),
            created_at=datetime.now().strftime("%Y-%m-%dT%H:%M:%S"),
        ),
    ]


@router.post("/tickets", response_model=Ticket, summary="Internal chatbot ticket creation")
def create_internal_ticket(
    payload: InternalTicketCreate,
    x_internal_api_key: str | None = Header(default=None),
) -> Ticket:
    require_internal_key(x_internal_api_key)

    sender = Sender(
        name=payload.patient_name or "Khách chatbot",
        email=payload.patient_email or "chatbot@internal.local",
        phone=payload.patient_phone,
    )
    ticket = Ticket(
        id=ticket_repo.next_id(),
        question=payload.title.strip(),
        full_question=payload.description.strip(),
        ticket_type=payload.ticket_type or "Yêu cầu từ chatbot",
        status=TicketStatus.pending,
        priority=normalize_priority(payload.priority),
        data_form_code=None,
        data_form_name=None,
        created_at=datetime.now().strftime("%Y-%m-%dT%H:%M:%S"),
        sender=sender,
        notes=metadata_notes(payload.metadata),
        suggested_action="Chatbot đã thu thập thông tin và tạo ticket nội bộ.",
    )
    return ticket_repo.add(ticket)
