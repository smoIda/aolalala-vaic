"""Điểm khởi tạo ứng dụng FastAPI.

- Đăng ký CORS (cho phép chạy frontend ở cổng/domain khác nếu muốn).
- Include các router API dưới tiền tố ``/api``.
- Mount thư mục ``frontend/`` phục vụ tĩnh tại ``/`` -> chỉ cần 1 lệnh chạy cả
  API lẫn giao diện. Swagger UI tại ``/docs``.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from .config import APP_DESCRIPTION, APP_TITLE, APP_VERSION, FRONTEND_DIR
from .routers import auth, classify, meta, tickets


def create_app() -> FastAPI:
    app = FastAPI(title=APP_TITLE, description=APP_DESCRIPTION, version=APP_VERSION)

    # CORS: mở cho mọi origin trong môi trường dev.
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=False,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # API routers (auth công khai; tickets/classify/meta yêu cầu đăng nhập)
    app.include_router(auth.router)
    app.include_router(tickets.router)
    app.include_router(classify.router)
    app.include_router(meta.router)

    @app.get("/api/health", tags=["meta"], summary="Kiểm tra API sống")
    def health() -> dict:
        return {"status": "ok", "app": APP_TITLE, "version": APP_VERSION}

    # Phục vụ frontend tĩnh tại "/" (đăng ký sau cùng để không che các route /api).
    if FRONTEND_DIR.is_dir():
        app.mount("/", StaticFiles(directory=str(FRONTEND_DIR), html=True), name="frontend")

    return app


app = create_app()
