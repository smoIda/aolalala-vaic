# Hert Hospital Chatbot Platform

Backend chatbot bệnh viện dùng Fastify, OpenRouter, MCP retrieval và Postgres cho dữ liệu tri thức/chat session. Ticket được đẩy sang app `Dashboard/` qua internal API, không còn chạy `backoffice-api` riêng trong thư mục `backend`.

## Kiến Trúc

```text
User
  |
  v
chatbot-api
  |
  |-- Intent classification bằng OpenRouter nếu có OPENROUTER_API_KEY
  |-- Fallback heuristic nếu chưa cấu hình OpenRouter
  |
  |-- Hospital information -> hert-hospital-mcp -> chatbot-postgres
  |-- Medical consultation -> Dashboard /api/internal/tickets
  |-- Appointment -> Dashboard /api/internal/tickets
  |-- Emergency -> trả hướng dẫn cấp cứu, không tạo ticket
```

LLM không quyết định business logic. Backend đọc intent và tự switch flow. MCP chỉ làm retrieval từ dữ liệu nội bộ.

## Services

| Service | URL | Mục đích |
| --- | --- | --- |
| `chatbot-api` | `http://localhost:3000` | API chatbot public |
| `hert-hospital-mcp` | `http://localhost:15000` | HTTP wrapper cho MCP retrieval trong Docker |
| `adminer` | `http://localhost:18080` | GUI xem Postgres |
| `chatbot-postgres` | host `15433` | Knowledge DB, chat sessions, chat logs |
| `Dashboard` | `http://localhost:8000` | Ticket system |

## Setup Nhanh

Từ root project:

```bash
make up
```

Hoặc chỉ backend:

```bash
cd backend
npm install
docker compose up -d --build
npm run import:data
```

Dashboard cần chạy để chatbot tạo ticket:

```bash
cd ../Dashboard
make up
```

Dashboard lưu ticket vào cùng `chatbot-postgres`, nên backend DB cần chạy trước dashboard.

## Biến Môi Trường

Các biến chính:

```bash
OPENROUTER_API_KEY=
OPENROUTER_MODEL=~openai/gpt-latest
OPENROUTER_HTTP_REFERER=http://localhost:3000
OPENROUTER_APP_TITLE=Hert Hospital Chatbot
AI_PROVIDER_LOG_ENABLED=false
AI_PROVIDER_LOG_FILE=/app/logs/ai-provider.log

CHATBOT_DATABASE_URL=postgres://chatbot:chatbot@chatbot-postgres:5432/chatbot
MCP_HTTP_URL=http://hert-hospital-mcp:5000
DASHBOARD_API_URL=http://host.docker.internal:8000/api/internal
INTERNAL_API_KEY=dev-internal-key
```

Khi chạy local ngoài Docker, `DASHBOARD_API_URL` có thể là:

```bash
DASHBOARD_API_URL=http://localhost:8000/api/internal
```

`INTERNAL_API_KEY` phải trùng với biến cùng tên bên `Dashboard`.
Dashboard Docker mặc định dùng `DASHBOARD_DATABASE_URL=postgres://chatbot:chatbot@host.docker.internal:15433/chatbot`.

## API Chính

Health:

```bash
curl -s http://localhost:3000/health
curl -s http://localhost:15000/health
```

Hỏi giá:

```bash
curl -s http://localhost:3000/chat \
  -H 'content-type: application/json' \
  -d '{"message":"Giá khám bệnh bao nhiêu?"}'
```

Tư vấn y tế, sau đó user chọn gửi yêu cầu tư vấn và cung cấp đủ họ tên + số điện thoại thì chatbot tạo ticket trong Dashboard:

```bash
curl -s http://localhost:3000/chat \
  -H 'content-type: application/json' \
  -d '{"message":"Tôi đau ngực, muốn hỏi bác sĩ","userProfile":{"name":"Nguyễn Văn A","phone":"0900000000"}}'
```

Đặt lịch cũng được ghi nhận thành ticket trong Dashboard:

```bash
curl -s http://localhost:3000/chat \
  -H 'content-type: application/json' \
  -d '{"message":"Tôi muốn đặt lịch khám tim mạch","userProfile":{"name":"Nguyễn Văn B","phone":"0911111111"}}'
```

Cấp cứu:

```bash
curl -s http://localhost:3000/chat \
  -H 'content-type: application/json' \
  -d '{"message":"Tôi khó thở và đau ngực dữ dội"}'
```

## Verification

Typecheck:

```bash
npm run typecheck
```
