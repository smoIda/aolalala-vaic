"""Kho lưu trữ ticket in-memory (mock).

Nạp dữ liệu seed từ ``seed_tickets.json`` vào bộ nhớ và cung cấp các thao tác
CRUD + lọc/sắp xếp/phân trang + thống kê. Dữ liệu reset mỗi lần khởi động lại
server (đúng theo lựa chọn "JSON / in-memory mock").

Được thiết kế như một lớp có instance singleton ``ticket_repo`` để router/service
dùng chung. Muốn đổi sang SQLite/Postgres sau này chỉ cần thay lớp này, giữ
nguyên interface.
"""

from __future__ import annotations

import json
import re
from typing import Dict, List, Optional, Tuple

from ..config import SEED_TICKETS_FILE, TICKET_ID_PREFIX
from ..models import Assignee, Note, Ticket, TicketStatus
from ..services.classifier import strip_accents


class TicketRepository:
    """Lưu trữ ticket trong bộ nhớ tiến trình."""

    def __init__(self) -> None:
        self._tickets: List[Ticket] = []
        self._max_seq: int = 0
        self.load_seed()

    # ---- Nạp dữ liệu ----
    def load_seed(self) -> None:
        """(Re)nạp dữ liệu mẫu từ file JSON vào bộ nhớ."""
        with open(SEED_TICKETS_FILE, "r", encoding="utf-8") as f:
            raw = json.load(f)
        self._tickets = [Ticket(**item) for item in raw]
        self._max_seq = max((self._extract_seq(t.id) for t in self._tickets), default=0)

    @staticmethod
    def _extract_seq(ticket_id: str) -> int:
        """Lấy phần số cuối trong mã ticket, ví dụ 'TK-2024007' -> 2024007."""
        match = re.search(r"(\d+)$", ticket_id)
        return int(match.group(1)) if match else 0

    # ---- Sinh mã ----
    def next_id(self) -> str:
        """Sinh mã ticket kế tiếp, giữ format 7 chữ số như dữ liệu mẫu."""
        self._max_seq += 1
        return f"{TICKET_ID_PREFIX}-{self._max_seq:07d}"

    # ---- Truy vấn ----
    def get(self, ticket_id: str) -> Optional[Ticket]:
        return next((t for t in self._tickets if t.id == ticket_id), None)

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
        """Lọc + sắp xếp + phân trang. Trả về (danh sách trang hiện tại, tổng đã lọc)."""
        items = list(self._tickets)

        # Lọc theo từ khóa (không phân biệt dấu) trên mã + câu hỏi + tên người gửi
        if q:
            needle = strip_accents(q.strip())
            items = [
                t
                for t in items
                if needle in strip_accents(t.id)
                or needle in strip_accents(t.question)
                or needle in strip_accents(t.full_question)
                or needle in strip_accents(t.sender.name)
            ]

        # Lọc theo loại ticket
        if ticket_type:
            items = [t for t in items if t.ticket_type == ticket_type]

        # Lọc theo trạng thái
        if status:
            items = [t for t in items if t.status.value == status]

        # Sắp xếp theo ngày tạo (ISO YYYY-MM-DD nên so sánh chuỗi là đủ).
        # Khi trùng ngày: giữ ID tăng dần (002 trước 003). Sort ổn định của Python
        # cho phép xếp theo id trước, rồi xếp theo ngày sau.
        reverse = sort != "oldest"
        items.sort(key=lambda t: t.id)
        items.sort(key=lambda t: t.created_at, reverse=reverse)

        total = len(items)

        # Phân trang
        if page_size > 0:
            start = (page - 1) * page_size
            items = items[start : start + page_size]

        return items, total

    # ---- Ghi ----
    def add(self, ticket: Ticket) -> Ticket:
        """Thêm ticket mới vào đầu danh sách (mới nhất)."""
        self._tickets.insert(0, ticket)
        seq = self._extract_seq(ticket.id)
        self._max_seq = max(self._max_seq, seq)
        return ticket

    def update_status(self, ticket_id: str, status: TicketStatus) -> Optional[Ticket]:
        ticket = self.get(ticket_id)
        if ticket is None:
            return None
        ticket.status = status
        return ticket

    def update_ticket_type(self, ticket_id: str, ticket_type: str) -> Optional[Ticket]:
        ticket = self.get(ticket_id)
        if ticket is None:
            return None
        ticket.ticket_type = ticket_type
        return ticket

    def add_note(self, ticket_id: str, note: Note) -> Optional[Ticket]:
        ticket = self.get(ticket_id)
        if ticket is None:
            return None
        ticket.notes.append(note)
        return ticket

    def update_assignee(self, ticket_id: str, assignee: Assignee) -> Optional[Ticket]:
        ticket = self.get(ticket_id)
        if ticket is None:
            return None
        ticket.assignee = assignee
        return ticket

    # ---- Thống kê ----
    def stats(self) -> Dict[str, int]:
        total = len(self._tickets)
        completed = sum(1 for t in self._tickets if t.status == TicketStatus.completed)
        return {
            "total": total,
            "completed": completed,
            "pending": total - completed,
        }

    def ticket_types(self) -> List[str]:
        """Danh sách các loại ticket đang có (giữ thứ tự xuất hiện) cho dropdown lọc."""
        seen: List[str] = []
        for t in self._tickets:
            if t.ticket_type not in seen:
                seen.append(t.ticket_type)
        return seen


# Instance dùng chung toàn ứng dụng
ticket_repo = TicketRepository()
