"""Cấu hình tập trung: đường dẫn, hằng số, nhãn hiển thị.

Gom mọi hằng số dùng chung ở một chỗ để dễ chỉnh sửa / mở rộng.
"""

from pathlib import Path
import os

# ---- Đường dẫn ----
BASE_DIR = Path(__file__).resolve().parent          # .../backend/app
DATA_DIR = BASE_DIR / "data"
SEED_TICKETS_FILE = DATA_DIR / "seed_tickets.json"
CLASSIFICATION_RULES_FILE = DATA_DIR / "classification_rules.json"

# Thư mục frontend (được mount phục vụ tĩnh). backend/ và frontend/ là 2 thư mục ngang hàng.
PROJECT_ROOT = BASE_DIR.parent.parent               # .../ThuTrang
FRONTEND_DIR = PROJECT_ROOT / "frontend"

# ---- Thông tin ứng dụng ----
APP_TITLE = "Hệ thống quản trị Ticket chatbot - BV Tim Mạch Hà Nội"
APP_DESCRIPTION = (
    "API quản lý ticket và engine phân loại câu hỏi chatbot theo bộ quy tắc "
    "gán nhãn của Bệnh viện Tim Mạch Hà Nội."
)
APP_VERSION = "1.0.0"

# ---- Nhãn trạng thái hiển thị (tiếng Việt) ----
STATUS_LABELS = {
    "pending": "Chưa hoàn thành",
    "completed": "Đã hoàn thành",
}

# ---- Nhãn mức ưu tiên hiển thị ----
PRIORITY_LABELS = {
    "cao": "Cao",
    "thuong": "Thường",
    "khan": "Khẩn",
}

# ---- Phân trang mặc định ----
DEFAULT_PAGE_SIZE = 10
MAX_PAGE_SIZE = 100

# ---- Sinh mã ticket ----
TICKET_ID_PREFIX = "TK"

# ---- Xác thực ----
# Endpoint chính thức của Google/Facebook để xác minh token do frontend gửi lên
# (backend gọi trực tiếp tới Google/Facebook, không tự chế xác thực).
GOOGLE_TOKENINFO_URL = "https://oauth2.googleapis.com/tokeninfo"
FACEBOOK_GRAPH_ME_URL = "https://graph.facebook.com/me"
AUTH_HTTP_TIMEOUT = 6  # giây, timeout khi gọi Google/Facebook để xác minh token

# Tài khoản quản trị mặc định (seed sẵn để đăng nhập ngay sau khi cài đặt).
DEFAULT_ADMIN_EMAIL = "admin@bvtimhanoi.vn"
DEFAULT_ADMIN_PASSWORD = "Admin@123"
DEFAULT_ADMIN_NAME = "Admin"
DEFAULT_ADMIN_ROLE = "Quản trị viên"

# Shared secret cho backend chatbot đẩy ticket vào dashboard.
INTERNAL_API_KEY = os.getenv("INTERNAL_API_KEY", "dev-internal-key")

# Dashboard dùng chung Postgres của backend chatbot để lưu ticket bền vững.
DASHBOARD_DATABASE_URL = os.getenv(
    "DASHBOARD_DATABASE_URL",
    "postgres://chatbot:chatbot@localhost:15433/chatbot",
)
