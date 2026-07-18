"""Endpoint xác thực: đăng ký, đăng nhập (local/Google/Facebook), thông tin bản thân, đăng xuất."""

from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from ..dependencies import get_current_user
from ..models import (
    AuthResponse,
    FacebookLoginRequest,
    GoogleLoginRequest,
    LoginRequest,
    RegisterRequest,
    User,
    UserPublic,
)
from ..repositories import user_repo
from ..services import auth_service

router = APIRouter(prefix="/api/auth", tags=["auth"])
_bearer_scheme = HTTPBearer(auto_error=False)


def _to_public(user: User) -> UserPublic:
    return UserPublic(id=user.id, name=user.name, email=user.email, role=user.role, provider=user.provider)


@router.post("/register", response_model=AuthResponse, summary="Đăng ký tài khoản mới (email/mật khẩu)")
def register(payload: RegisterRequest) -> AuthResponse:
    if user_repo.get_by_email(payload.email) is not None:
        raise HTTPException(status_code=409, detail="Email này đã được đăng ký")
    user = user_repo.create_local_user(name=payload.name, email=payload.email, password=payload.password)
    token = user_repo.create_session(user)
    return AuthResponse(token=token, user=_to_public(user))


@router.post("/login", response_model=AuthResponse, summary="Đăng nhập bằng email/mật khẩu")
def login(payload: LoginRequest) -> AuthResponse:
    user = user_repo.get_by_email(payload.email)
    if user is None or user.password_hash is None:
        raise HTTPException(status_code=401, detail="Email hoặc mật khẩu không đúng")
    if not auth_service.verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Email hoặc mật khẩu không đúng")
    token = user_repo.create_session(user)
    return AuthResponse(token=token, user=_to_public(user))


@router.post("/login/google", response_model=AuthResponse, summary="Đăng nhập bằng tài khoản Google")
def login_google(payload: GoogleLoginRequest) -> AuthResponse:
    info = auth_service.verify_google_id_token(payload.id_token)
    user = user_repo.find_or_create_oauth_user(provider="google", email=info["email"], name=info["name"])
    token = user_repo.create_session(user)
    return AuthResponse(token=token, user=_to_public(user))


@router.post("/login/facebook", response_model=AuthResponse, summary="Đăng nhập bằng tài khoản Facebook")
def login_facebook(payload: FacebookLoginRequest) -> AuthResponse:
    info = auth_service.verify_facebook_access_token(payload.access_token)
    user = user_repo.find_or_create_oauth_user(provider="facebook", email=info["email"], name=info["name"])
    token = user_repo.create_session(user)
    return AuthResponse(token=token, user=_to_public(user))


@router.get("/me", response_model=UserPublic, summary="Thông tin tài khoản đang đăng nhập")
def me(current_user: User = Depends(get_current_user)) -> UserPublic:
    return _to_public(current_user)


@router.post("/logout", summary="Đăng xuất (hủy token hiện tại)")
def logout(credentials: HTTPAuthorizationCredentials | None = Depends(_bearer_scheme)) -> dict:
    if credentials:
        user_repo.delete_session(credentials.credentials)
    return {"status": "ok"}
