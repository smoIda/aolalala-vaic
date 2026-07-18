"""Định nghĩa schema dữ liệu bằng Pydantic.

Các model này vừa dùng để validate input/output của API, vừa là "hợp đồng"
dữ liệu giữa backend và frontend.
"""

from enum import Enum
from typing import List, Optional

from pydantic import BaseModel, Field


class TicketStatus(str, Enum):
    """Trạng thái xử lý ticket."""

    pending = "pending"        # Chưa hoàn thành
    completed = "completed"    # Đã hoàn thành


class Priority(str, Enum):
    """Mức ưu tiên theo bộ quy tắc PDF."""

    cao = "cao"        # Cao
    thuong = "thuong"  # Thường
    khan = "khan"      # Khẩn


class Sender(BaseModel):
    """Người gửi ticket."""

    name: str = Field(..., description="Họ tên người gửi")
    email: str = Field(..., description="Email người gửi")
    phone: Optional[str] = Field(default=None, description="Số điện thoại người gửi")


class Assignee(BaseModel):
    """Người xử lý (nhân viên/bác sĩ được phân công) ticket."""

    name: str = Field(..., description="Họ tên người xử lý")
    role: Optional[str] = Field(default=None, description="Chức danh, ví dụ 'Bác sĩ Tim mạch'")
    email: Optional[str] = Field(default=None, description="Email người xử lý")
    phone: Optional[str] = Field(default=None, description="Số điện thoại người xử lý")


class Note(BaseModel):
    """Một dòng trao đổi nội bộ trong ticket."""

    author: str = Field(..., description="Tên người viết ghi chú")
    role: Optional[str] = Field(default=None, description="Chức danh người viết, nếu có")
    content: str = Field(..., description="Nội dung trao đổi")
    created_at: str = Field(..., description="Thời điểm tạo, định dạng YYYY-MM-DDTHH:MM")


class Ticket(BaseModel):
    """Một ticket đầy đủ."""

    id: str = Field(..., description="Mã ticket, ví dụ TK-2024001")
    question: str = Field(..., description="Câu hỏi chuyên môn (rút gọn để hiển thị)")
    full_question: str = Field(..., description="Nội dung câu hỏi đầy đủ")
    ticket_type: str = Field(..., description="Loại ticket / nhóm event")
    status: TicketStatus = Field(default=TicketStatus.pending)
    priority: Optional[Priority] = Field(default=None, description="Mức ưu tiên")
    data_form_code: Optional[str] = Field(default=None, description="Mã Data Form, ví dụ DF-H02")
    data_form_name: Optional[str] = Field(default=None, description="Tên Data Form")
    created_at: str = Field(..., description="Thời điểm tạo, định dạng YYYY-MM-DDTHH:MM")
    sender: Sender
    assignee: Optional[Assignee] = Field(default=None, description="Người được phân công xử lý")
    notes: List[Note] = Field(default_factory=list, description="Danh sách trao đổi nội bộ")
    suggested_action: Optional[str] = Field(
        default=None, description="Hành động gợi ý của chatbot theo quy tắc"
    )


class TicketUpdate(BaseModel):
    """Body cho PATCH cập nhật ticket (mọi trường đều tùy chọn)."""

    status: Optional[TicketStatus] = None
    ticket_type: Optional[str] = None


class InternalTicketCreate(BaseModel):
    """Body nội bộ để chatbot backend tạo ticket trong dashboard."""

    title: str = Field(..., min_length=1)
    description: str = Field(..., min_length=1)
    priority: Optional[str] = None
    ticket_type: Optional[str] = None
    patient_name: Optional[str] = None
    patient_phone: Optional[str] = None
    patient_email: Optional[str] = None
    metadata: dict = Field(default_factory=dict)


class NoteCreate(BaseModel):
    """Body cho POST thêm trao đổi nội bộ."""

    content: str = Field(..., min_length=1)
    author: str = Field(default="Admin", description="Tên người viết, mặc định Admin")
    role: Optional[str] = Field(default="Quản trị viên")


class ClassifyRequest(BaseModel):
    """Body cho POST /api/classify."""

    question: str = Field(..., min_length=1, description="Câu hỏi của khách gửi tới chatbot")
    sender: Optional[Sender] = Field(
        default=None, description="Thông tin người gửi (nếu có) để tạo ticket"
    )
    create_ticket: bool = Field(
        default=True,
        description="Có tạo ticket khi quy tắc yêu cầu hay không (mặc định True)",
    )


class ClassifyResult(BaseModel):
    """Kết quả phân loại một câu hỏi."""

    group: str = Field(..., description="Nhóm event khớp được")
    ticket_type: str = Field(..., description="Nhãn loại ticket")
    need_ticket: bool = Field(..., description="Có cần tạo ticket không")
    is_emergency: bool = Field(..., description="Có phải cảnh báo khẩn cấp không")
    priority: Optional[Priority] = None
    data_form_code: Optional[str] = None
    data_form_name: Optional[str] = None
    chatbot_action: str = Field(..., description="Pre-action / action của chatbot")
    matched_keyword: Optional[str] = Field(
        default=None, description="Keyword đã khớp (None nếu rơi vào fallback)"
    )
    created_ticket: Optional[Ticket] = Field(
        default=None, description="Ticket được tạo nếu need_ticket và create_ticket=True"
    )


class TicketListResponse(BaseModel):
    """Phản hồi danh sách ticket có phân trang."""

    items: List[Ticket]
    total: int
    page: int
    page_size: int


class StatsResponse(BaseModel):
    """Thống kê tổng quan cho 3 thẻ trên dashboard."""

    total: int
    pending: int
    completed: int
