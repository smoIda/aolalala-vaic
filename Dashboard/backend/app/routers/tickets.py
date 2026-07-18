"""Endpoint quản lý ticket: danh sách, thống kê, chi tiết, cập nhật, ghi chú, phân công."""

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query

from ..config import DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE
from ..dependencies import get_current_user
from ..models import (
    Assignee,
    Note,
    NoteCreate,
    StatsResponse,
    Ticket,
    TicketListResponse,
    TicketUpdate,
)
from ..repositories import ticket_repo

router = APIRouter(prefix="/api/tickets", tags=["tickets"], dependencies=[Depends(get_current_user)])


@router.get("", response_model=TicketListResponse, summary="Danh sách ticket (lọc/sắp xếp/phân trang)")
def list_tickets(
    q: str | None = Query(default=None, description="Tìm theo mã, câu hỏi hoặc tên người gửi"),
    type: str | None = Query(default=None, description="Lọc theo loại ticket"),
    status: str | None = Query(default=None, description="pending | completed"),
    sort: str = Query(default="newest", pattern="^(newest|oldest)$", description="newest | oldest"),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=DEFAULT_PAGE_SIZE, ge=1, le=MAX_PAGE_SIZE),
) -> TicketListResponse:
    items, total = ticket_repo.list(
        q=q, ticket_type=type, status=status, sort=sort, page=page, page_size=page_size
    )
    return TicketListResponse(items=items, total=total, page=page, page_size=page_size)


@router.get("/stats", response_model=StatsResponse, summary="Thống kê tổng/chưa/đã hoàn thành")
def get_stats() -> StatsResponse:
    return StatsResponse(**ticket_repo.stats())


@router.get("/{ticket_id}", response_model=Ticket, summary="Chi tiết một ticket")
def get_ticket(ticket_id: str) -> Ticket:
    ticket = ticket_repo.get(ticket_id)
    if ticket is None:
        raise HTTPException(status_code=404, detail=f"Không tìm thấy ticket {ticket_id}")
    return ticket


@router.patch("/{ticket_id}", response_model=Ticket, summary="Cập nhật trạng thái và/hoặc loại ticket")
def update_ticket(ticket_id: str, payload: TicketUpdate) -> Ticket:
    if ticket_repo.get(ticket_id) is None:
        raise HTTPException(status_code=404, detail=f"Không tìm thấy ticket {ticket_id}")

    ticket = None
    if payload.status is not None:
        ticket = ticket_repo.update_status(ticket_id, payload.status)
    if payload.ticket_type is not None:
        ticket = ticket_repo.update_ticket_type(ticket_id, payload.ticket_type)
    return ticket if ticket is not None else ticket_repo.get(ticket_id)


@router.post("/{ticket_id}/notes", response_model=Ticket, summary="Thêm trao đổi nội bộ")
def add_note(ticket_id: str, payload: NoteCreate) -> Ticket:
    note = Note(
        author=payload.author,
        role=payload.role,
        content=payload.content.strip(),
        created_at=datetime.now().strftime("%Y-%m-%dT%H:%M:%S"),
    )
    ticket = ticket_repo.add_note(ticket_id, note)
    if ticket is None:
        raise HTTPException(status_code=404, detail=f"Không tìm thấy ticket {ticket_id}")
    return ticket


@router.patch("/{ticket_id}/assignee", response_model=Ticket, summary="Phân công người xử lý")
def update_assignee(ticket_id: str, payload: Assignee) -> Ticket:
    ticket = ticket_repo.update_assignee(ticket_id, payload)
    if ticket is None:
        raise HTTPException(status_code=404, detail=f"Không tìm thấy ticket {ticket_id}")
    return ticket
