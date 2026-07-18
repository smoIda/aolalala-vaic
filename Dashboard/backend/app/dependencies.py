"""FastAPI dependencies dùng chung (hiện tại: xác thực người dùng)."""

from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from .models import User
from .repositories import user_repo

_bearer_scheme = HTTPBearer(
    scheme_name="Bearer",
    description="Token nhận được từ /api/auth/login, /api/auth/register hoặc /api/auth/login/google|facebook",
    auto_error=False,
)


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer_scheme),
) -> User:
    """Lấy user hiện tại từ header `Authorization: Bearer <token>`.

    Ném 401 nếu thiếu token hoặc token không hợp lệ/đã đăng xuất.
    """
    if credentials is None:
        raise HTTPException(status_code=401, detail="Thiếu token xác thực")
    user = user_repo.get_user_by_token(credentials.credentials)
    if user is None:
        raise HTTPException(status_code=401, detail="Token không hợp lệ hoặc đã hết hạn")
    return user
