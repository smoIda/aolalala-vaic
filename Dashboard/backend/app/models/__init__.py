"""Pydantic models (schema dữ liệu)."""

from .ticket import (
    Assignee,
    ClassifyRequest,
    ClassifyResult,
    Note,
    NoteCreate,
    Priority,
    Sender,
    StatsResponse,
    Ticket,
    TicketListResponse,
    TicketStatus,
    TicketUpdate,
)
from .user import (
    AuthResponse,
    FacebookLoginRequest,
    GoogleLoginRequest,
    LoginRequest,
    RegisterRequest,
    User,
    UserPublic,
)

__all__ = [
    "Sender",
    "Assignee",
    "Note",
    "NoteCreate",
    "Ticket",
    "TicketStatus",
    "Priority",
    "TicketUpdate",
    "ClassifyRequest",
    "ClassifyResult",
    "TicketListResponse",
    "StatsResponse",
    "User",
    "UserPublic",
    "RegisterRequest",
    "LoginRequest",
    "GoogleLoginRequest",
    "FacebookLoginRequest",
    "AuthResponse",
]
