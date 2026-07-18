"""Kho lưu trữ tài khoản người dùng + session token in-memory (mock).

Cùng triết lý với ``ticket_repo``: dữ liệu reset khi restart server. Seed sẵn
một tài khoản quản trị mặc định để có thể đăng nhập ngay sau khi cài đặt.
"""

from __future__ import annotations

import uuid
from typing import Dict, Optional

from ..config import (
    DEFAULT_ADMIN_EMAIL,
    DEFAULT_ADMIN_NAME,
    DEFAULT_ADMIN_PASSWORD,
    DEFAULT_ADMIN_ROLE,
)
from ..models import User
from ..services.auth_service import hash_password


class UserRepository:
    """Lưu trữ tài khoản + session trong bộ nhớ tiến trình."""

    def __init__(self) -> None:
        self._users: Dict[str, User] = {}  # key: email (lowercase)
        self._sessions: Dict[str, str] = {}  # token -> email
        self._seed_default_admin()

    def _seed_default_admin(self) -> None:
        admin = User(
            id=str(uuid.uuid4()),
            name=DEFAULT_ADMIN_NAME,
            email=DEFAULT_ADMIN_EMAIL,
            role=DEFAULT_ADMIN_ROLE,
            provider="local",
            password_hash=hash_password(DEFAULT_ADMIN_PASSWORD),
        )
        self._users[admin.email.lower()] = admin

    # ---- Truy vấn ----
    def get_by_email(self, email: str) -> Optional[User]:
        return self._users.get(email.strip().lower())

    def get_by_id(self, user_id: str) -> Optional[User]:
        return next((u for u in self._users.values() if u.id == user_id), None)

    # ---- Ghi ----
    def create_local_user(self, name: str, email: str, password: str, role: str = "Nhân viên") -> User:
        user = User(
            id=str(uuid.uuid4()),
            name=name.strip(),
            email=email.strip().lower(),
            role=role,
            provider="local",
            password_hash=hash_password(password),
        )
        self._users[user.email] = user
        return user

    def find_or_create_oauth_user(self, provider: str, email: str, name: str, role: str = "Nhân viên") -> User:
        existing = self.get_by_email(email)
        if existing:
            return existing
        user = User(
            id=str(uuid.uuid4()),
            name=name.strip() or email.split("@")[0],
            email=email.strip().lower(),
            role=role,
            provider=provider,
            password_hash=None,
        )
        self._users[user.email] = user
        return user

    # ---- Session ----
    def create_session(self, user: User) -> str:
        token = uuid.uuid4().hex
        self._sessions[token] = user.email
        return token

    def get_user_by_token(self, token: str) -> Optional[User]:
        email = self._sessions.get(token)
        return self.get_by_email(email) if email else None

    def delete_session(self, token: str) -> None:
        self._sessions.pop(token, None)


# Instance dùng chung toàn ứng dụng
user_repo = UserRepository()
