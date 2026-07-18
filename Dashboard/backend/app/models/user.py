"""Schema dữ liệu cho tài khoản người dùng và xác thực."""

from typing import Optional

from pydantic import BaseModel, EmailStr, Field


class User(BaseModel):
    """Tài khoản nội bộ (bao gồm cả thông tin nhạy cảm), chỉ dùng trong backend."""

    id: str
    name: str
    email: str
    role: str = "Quản trị viên"
    provider: str = "local"  # local | google | facebook
    password_hash: Optional[str] = Field(default=None, description="None nếu đăng nhập qua Google/Facebook")


class UserPublic(BaseModel):
    """Thông tin người dùng an toàn để trả về frontend (không có password_hash)."""

    id: str
    name: str
    email: str
    role: str
    provider: str


class RegisterRequest(BaseModel):
    """Body cho POST /api/auth/register."""

    name: str = Field(..., min_length=1)
    email: EmailStr
    password: str = Field(..., min_length=6, description="Tối thiểu 6 ký tự")


class LoginRequest(BaseModel):
    """Body cho POST /api/auth/login."""

    email: EmailStr
    password: str


class GoogleLoginRequest(BaseModel):
    """Body cho POST /api/auth/login/google."""

    id_token: str = Field(..., description="ID token do Google Identity Services trả về ở frontend")


class FacebookLoginRequest(BaseModel):
    """Body cho POST /api/auth/login/facebook."""

    access_token: str = Field(..., description="Access token do Facebook Login SDK trả về ở frontend")


class AuthResponse(BaseModel):
    """Phản hồi sau khi đăng nhập/đăng ký thành công."""

    token: str
    user: UserPublic
