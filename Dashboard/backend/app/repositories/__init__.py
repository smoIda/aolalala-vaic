"""Tầng lưu trữ dữ liệu (data access)."""

from .ticket_repo import ticket_repo
from .user_repo import user_repo

__all__ = ["ticket_repo", "user_repo"]
