# Hệ thống quản trị Ticket chatbot — BV Tim Mạch Hà Nội

Dashboard quản trị ticket cho hệ thống chatbot của bệnh viện, kèm **engine phân loại**
câu hỏi theo bộ quy tắc gán nhãn ticket (keyword → loại ticket / mức ưu tiên / Data Form /
có cần tạo ticket / cảnh báo khẩn cấp).

Source code tách bạch **frontend** (HTML/CSS/JavaScript thuần, ES modules) và
**backend** (Python + FastAPI), tổ chức module hóa để dễ bảo trì và mở rộng.

## Cấu trúc thư mục

```
ThuTrang/
├── backend/          # API + engine phân loại (FastAPI)
│   ├── app/
│   │   ├── main.py           # khởi tạo app, CORS, mount frontend tĩnh
│   │   ├── config.py         # hằng số, đường dẫn, nhãn hiển thị
│   │   ├── models/           # Pydantic schema
│   │   ├── data/             # seed_tickets.json + classification_rules.json
│   │   ├── repositories/     # kho ticket + kho user in-memory
│   │   ├── services/         # classifier (rule engine), ticket_service, auth_service
│   │   ├── dependencies.py   # get_current_user (bảo vệ API bằng Bearer token)
│   │   └── routers/          # /api/auth, /api/tickets, /api/classify, /api/meta
│   ├── requirements.txt
│   └── run.py
└── frontend/         # Giao diện dashboard
    ├── index.html
    ├── css/          # variables + base + components
    └── js/           # config, api, auth, state, utils, components/, main.js
```

## Yêu cầu

- Python 3.10+ (khuyến nghị dùng virtualenv/conda)

## Cài đặt & chạy

```bash
cd backend
pip install -r requirements.txt
python run.py
```

Hoặc:

```bash
cd backend
uvicorn app.main:app --reload
```

Mở trình duyệt:

- **Dashboard:** http://127.0.0.1:8000/
- **API docs (Swagger):** http://127.0.0.1:8000/docs

> Backend phục vụ luôn frontend nên chỉ cần **một lệnh**. Muốn chạy frontend riêng
> (vd `python -m http.server` trong thư mục `frontend/`), sửa `API_BASE_URL` trong
> `frontend/js/config.js` thành `http://127.0.0.1:8000` (CORS đã bật sẵn).

## Đăng nhập

Dashboard **yêu cầu đăng nhập** — mọi API ticket/classify/meta đều được bảo vệ bằng Bearer
token ở backend (không chỉ chặn ở giao diện).

**Tài khoản quản trị mặc định** (seed sẵn, đăng nhập được ngay sau khi cài đặt):
- Email: `admin@bvtimhanoi.vn`
- Mật khẩu: `Admin@123`

Ngoài ra có thể **Đăng ký** tài khoản mới ngay trên màn hình đăng nhập (email + mật khẩu).
Tài khoản lưu **in-memory** giống ticket — mất khi restart server, trừ tài khoản admin mặc
định sẽ luôn được seed lại.

### Bật đăng nhập Google / Facebook

Mặc định 2 nút này ở trạng thái "chưa cấu hình" (không giả vờ hoạt động khi chưa có
Client ID/App ID thật). Để bật:

1. **Google** — vào [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
   → tạo *OAuth client ID* loại **Web application** → thêm
   `http://localhost:8000` và `http://127.0.0.1:8000` vào *Authorized JavaScript origins* →
   copy **Client ID**, dán vào `GOOGLE_CLIENT_ID` trong `frontend/js/config.js`.
2. **Facebook** — vào [Meta for Developers](https://developers.facebook.com/apps/) → tạo app
   loại **Consumer** → bật sản phẩm **Facebook Login** → thêm `http://localhost:8000` vào
   *App Domains* / *Valid OAuth Redirect URIs* → copy **App ID**, dán vào `FACEBOOK_APP_ID`
   trong `frontend/js/config.js`.

Backend xác minh token bằng cách gọi thẳng tới endpoint chính thức của Google
(`oauth2.googleapis.com/tokeninfo`) và Facebook (`graph.facebook.com/me`) — không tự chế
cơ chế xác thực.

## API chính

| Method | Endpoint                     | Mô tả                                              |
|--------|------------------------------|----------------------------------------------------|
| POST   | `/api/auth/register`         | Đăng ký tài khoản mới (email/mật khẩu)             |
| POST   | `/api/auth/login`            | Đăng nhập email/mật khẩu                           |
| POST   | `/api/auth/login/google`     | Đăng nhập bằng Google (nhận `id_token` từ frontend)|
| POST   | `/api/auth/login/facebook`   | Đăng nhập bằng Facebook (nhận `access_token`)      |
| GET    | `/api/auth/me`                | Thông tin tài khoản đang đăng nhập                 |
| POST   | `/api/auth/logout`           | Đăng xuất (hủy token)                              |
| GET    | `/api/tickets` 🔒             | Danh sách ticket (`q`, `type`, `status`, `sort`, `page`, `page_size`) |
| GET    | `/api/tickets/stats` 🔒       | Thống kê: tổng / chưa hoàn thành / đã hoàn thành   |
| GET    | `/api/tickets/{id}` 🔒        | Chi tiết một ticket                                |
| PATCH  | `/api/tickets/{id}` 🔒        | Đổi trạng thái và/hoặc loại ticket                 |
| POST   | `/api/tickets/{id}/notes` 🔒  | Thêm trao đổi nội bộ                               |
| PATCH  | `/api/tickets/{id}/assignee` 🔒 | Phân công người xử lý                            |
| POST   | `/api/classify` 🔒            | Phân loại câu hỏi, tạo ticket nếu quy tắc yêu cầu  |
| GET    | `/api/meta/ticket-types` 🔒   | Danh sách loại ticket cho dropdown lọc             |

🔒 = cần header `Authorization: Bearer <token>` (lấy từ các endpoint `/api/auth/*`).

### Ví dụ phân loại

```bash
# 1) Đăng nhập lấy token
TOKEN=$(curl -s -X POST http://127.0.0.1:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@bvtimhanoi.vn","password":"Admin@123"}' | python -c "import sys,json;print(json.load(sys.stdin)['token'])")

# 2) Gọi endpoint phân loại kèm token
curl -X POST http://127.0.0.1:8000/api/classify \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"question":"Tôi bị đau ngực khó thở, có cần đi khám không?"}'
```

Kết quả: loại `Tư vấn y tế chuyên môn`, ưu tiên `cao`, `DF-H02`, tạo ticket mới.

Câu có dấu hiệu cấp cứu (vd `"đau ngực dữ dội, khó thở cấp, ngất xỉu"`) →
`is_emergency = true`, **không** tạo ticket, trả cảnh báo gọi 115.

## Bộ quy tắc phân loại

Toàn bộ quy tắc nằm ở `backend/app/data/classification_rules.json` (mã hóa từ tài liệu
*Rule label ticket*). Muốn thêm/sửa nhóm, keyword, mức ưu tiên hay Data Form → chỉnh file
JSON này, không cần sửa code.

## Lưu ý

- Dữ liệu ticket lưu **in-memory**, seed 8 ticket mẫu; restart server sẽ reset về trạng thái
  ban đầu. Đổi sang SQLite/PostgreSQL sau này chỉ cần thay lớp `repositories/ticket_repo.py`,
  giữ nguyên interface.
- Tài khoản người dùng cũng lưu **in-memory** (`repositories/user_repo.py`), cùng lý do trên;
  tài khoản admin mặc định được seed lại mỗi lần khởi động.
- Chuông thông báo (góc phải header) chỉ hiện chấm vàng khi có ticket mới xuất hiện kể từ lần
  xem gần nhất (theo dõi bằng tập ID ticket đã xem, lưu ở `localStorage` trình duyệt) — tự
  poll lại mỗi 45 giây.
