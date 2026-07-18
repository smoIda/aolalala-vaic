"""Nghiệp vụ ghép nối engine phân loại với kho ticket.

Chịu trách nhiệm: khi có câu hỏi mới -> phân loại -> (nếu cần) tạo ticket và lưu.
Tách khỏi router để logic nghiệp vụ có thể tái sử dụng/kiểm thử độc lập.
"""

from __future__ import annotations

from datetime import datetime
from typing import Optional

from ..models import ClassifyResult, Priority, Sender, Ticket, TicketStatus
from ..repositories import ticket_repo
from .classifier import classify


def _truncate(text: str, limit: int = 90) -> str:
    """Rút gọn câu hỏi để hiển thị ở cột danh sách."""
    text = " ".join(text.split())
    return text if len(text) <= limit else text[: limit - 1].rstrip() + "…"


def classify_question(
    question: str,
    sender: Optional[Sender] = None,
    create_ticket: bool = True,
) -> ClassifyResult:
    """Phân loại câu hỏi; tạo ticket nếu quy tắc yêu cầu và ``create_ticket`` bật.

    - Trường hợp khẩn cấp: KHÔNG bao giờ tạo ticket (chỉ cảnh báo).
    - Nhóm không cần ticket (thông tin cơ bản, lịch trống real-time): không tạo.
    """
    result = classify(question)

    created: Optional[Ticket] = None
    should_create = (
        create_ticket
        and result["need_ticket"]
        and not result["is_emergency"]
    )

    if should_create:
        effective_sender = sender or Sender(name="Khách ẩn danh", email="unknown@chatbot.local")
        priority_value = result.get("priority")
        ticket = Ticket(
            id=ticket_repo.next_id(),
            question=_truncate(question),
            full_question=question.strip(),
            ticket_type=result["ticket_type"],
            status=TicketStatus.pending,
            priority=Priority(priority_value) if priority_value else None,
            data_form_code=result.get("data_form_code"),
            data_form_name=result.get("data_form_name"),
            created_at=datetime.now().strftime("%Y-%m-%dT%H:%M:%S"),
            sender=effective_sender,
            suggested_action=result.get("chatbot_action"),
        )
        created = ticket_repo.add(ticket)

    return ClassifyResult(
        group=result["group"],
        ticket_type=result["ticket_type"],
        need_ticket=result["need_ticket"],
        is_emergency=result["is_emergency"],
        priority=Priority(result["priority"]) if result.get("priority") else None,
        data_form_code=result.get("data_form_code"),
        data_form_name=result.get("data_form_name"),
        chatbot_action=result["chatbot_action"],
        matched_keyword=result.get("matched_keyword"),
        created_ticket=created,
    )
