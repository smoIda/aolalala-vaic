# Hert Hospital Chatbot Platform

MVP chatbot bệnh viện dùng Fastify, OpenRouter, MCP retrieval và 2 Postgres database riêng. Hệ thống được đóng gói bằng Docker Compose để chạy local nhanh cho demo/hackathon.

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
  |-- Medical consultation -> backoffice-api -> backoffice-postgres
  |-- Appointment -> backoffice-api -> backoffice-postgres
  |-- Emergency -> trả hướng dẫn cấp cứu, không chờ RAG
```

LLM không quyết định business logic. Backend đọc intent và tự switch flow. MCP chỉ làm retrieval từ dữ liệu nội bộ.

## Stack

- Node.js + TypeScript
- Fastify cho `chatbot-api` và `backoffice-api`
- Better Auth cho Backoffice auth
- Postgres 16 cho 2 database riêng
- MCP TypeScript SDK cho `hert-hospital-mcp`
- OpenRouter qua REST API `https://openrouter.ai/api/v1/chat/completions`
- Docker Compose
- Adminer cho GUI database
- Bruno cho API docs/test collection

## Services

| Service | URL | Mục đích |
| --- | --- | --- |
| `chatbot-api` | `http://localhost:3000` | API chatbot public |
| `backoffice-api` | `http://localhost:4000` | Auth, ticket, booking |
| `hert-hospital-mcp` | `http://localhost:15000` | HTTP wrapper cho MCP retrieval trong Docker |
| `adminer` | `http://localhost:18080` | GUI xem Postgres |
| `chatbot-postgres` | host `15433` | Knowledge DB, Excel import, chat logs |
| `backoffice-postgres` | host `15434` | Auth, tickets, bookings |

Trong Docker network, Postgres vẫn chạy port nội bộ `5432`.

## Setup Nhanh

```bash
npm install
cp .env.example .env
docker compose up -d --build
npm run import:data
```

Kiểm tra health:

```bash
curl -s http://localhost:3000/health
curl -s http://localhost:4000/health
curl -s http://localhost:15000/health
```

## Import Dữ Liệu Nội Bộ

File nguồn hiện tại: `data-tim.xlsx`.

Import mặc định dùng local Postgres port `15433`:

```bash
npm run import:data
```

Nếu cần override:

```bash
CHATBOT_DATABASE_URL=postgres://chatbot:chatbot@localhost:15433/chatbot npm run import:data
```

Importer sẽ reset và import lại các bảng knowledge:

- `services`: từ sheet `Bảng giá dịch vụ`
- `general_documents`: từ `Quy trình đón tiếp bệnh nhân` và `Liên hệ đặt lịch khám`
- `faq_documents`: sinh từ nội dung quy trình/liên hệ
- `ticket_label_rules`: từ sheet `Rule label ticket`
- `navigation_locations`: seed thủ công từ `data/seeds/navigation-locations.json`

Workbook hiện chưa có sheet sơ đồ/vị trí phòng khám chi tiết, nên navigation đang là seed tối thiểu.

## Biến Môi Trường

File mẫu: `.env.example`.

Các biến chính:

```bash
OPENROUTER_API_KEY=
OPENROUTER_MODEL=~openai/gpt-latest
OPENROUTER_HTTP_REFERER=http://localhost:3000
OPENROUTER_APP_TITLE=Hert Hospital Chatbot
AI_PROVIDER_LOG_ENABLED=false
AI_PROVIDER_LOG_FILE=/app/logs/ai-provider.log

CHATBOT_DATABASE_URL=postgres://chatbot:chatbot@chatbot-postgres:5432/chatbot
BACKOFFICE_DATABASE_URL=postgres://backoffice:backoffice@backoffice-postgres:5432/backoffice

MCP_HTTP_URL=http://hert-hospital-mcp:5000
BACKOFFICE_API_URL=http://backoffice-api:4000
INTERNAL_API_KEY=dev-internal-key

BETTER_AUTH_SECRET=replace-with-a-long-random-secret
BETTER_AUTH_URL=http://localhost:4000
```

Khi `AI_PROVIDER_LOG_ENABLED=true`, `chatbot-api` ghi JSONL request/response gửi tới OpenRouter vào `./logs/ai-provider.log` trên máy host.

Nếu chưa có `OPENROUTER_API_KEY`, chatbot vẫn chạy bằng fallback classifier. Fallback chỉ dùng keyword heuristic, nên độ hiểu intent sẽ kém hơn OpenRouter. Với intent `unknown`, API vẫn thử MCP fallback trước khi trả `Tôi chưa có thông tin`.

Sau khi sửa `.env`:

```bash
docker compose up -d --build
```

## API Chính

### Chatbot

Health:

```bash
curl -s http://localhost:3000/health
```

Hỏi giá:

```bash
curl -s http://localhost:3000/chat \
  -H 'content-type: application/json' \
  -d '{"message":"Giá khám bệnh bao nhiêu?"}'
```

Tư vấn y tế, tạo ticket:

```bash
curl -s http://localhost:3000/chat \
  -H 'content-type: application/json' \
  -d '{"message":"Tôi đau ngực, muốn hỏi bác sĩ","userProfile":{"name":"Nguyễn Văn A","phone":"0900000000"}}'
```

Đặt lịch, tạo booking:

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

### MCP HTTP Wrapper

Trong Docker, MCP service expose HTTP wrapper ở host port `15000`. Core MCP vẫn hỗ trợ stdio khi chạy local.

Search giá:

```bash
curl -s http://localhost:15000/tools/search_price \
  -H 'content-type: application/json' \
  -d '{"query":"khám bệnh","limit":5}'
```

Search danh sách dịch vụ:

```bash
curl -s http://localhost:15000/tools/search_service \
  -H 'content-type: application/json' \
  -d '{"query":"khám bệnh","limit":10}'
```

Search quy trình/chính sách:

```bash
curl -s http://localhost:15000/tools/search_policy \
  -H 'content-type: application/json' \
  -d '{"query":"đặt lịch khám","limit":5}'
```

Search rule ticket:

```bash
curl -s http://localhost:15000/tools/search_ticket_rules \
  -H 'content-type: application/json' \
  -d '{"query":"kết quả xét nghiệm của tôi","limit":5}'
```

MCP tools hiện có:

- `search_faq`
- `search_department`
- `search_doctor`
- `search_service`
- `search_price`
- `search_policy`
- `search_navigation`
- `search_ticket_rules`

`search_doctor` hiện trả unsupported vì chưa có dữ liệu bác sĩ.

### Backoffice

Health:

```bash
curl -s http://localhost:4000/health
```

List tickets:

```bash
curl -s http://localhost:4000/tickets \
  -H 'x-internal-api-key: dev-internal-key'
```

Create ticket:

```bash
curl -s http://localhost:4000/tickets \
  -H 'content-type: application/json' \
  -H 'x-internal-api-key: dev-internal-key' \
  -d '{"title":"Test ticket","description":"Nội dung ticket","priority":"normal","ticketType":"manual_test"}'
```

List bookings:

```bash
curl -s http://localhost:4000/bookings \
  -H 'x-internal-api-key: dev-internal-key'
```

Create booking:

```bash
curl -s http://localhost:4000/bookings \
  -H 'content-type: application/json' \
  -H 'x-internal-api-key: dev-internal-key' \
  -d '{"patientName":"Test Booking","patientPhone":"0911111111","department":"Tim mạch","preferredDate":"2026-07-20","preferredTime":"09:00"}'
```

Better Auth endpoints được mount tại:

```text
http://localhost:4000/api/auth/*
```

Ví dụ sign up:

```bash
curl -s http://localhost:4000/api/auth/sign-up/email \
  -H 'content-type: application/json' \
  -d '{"name":"Admin Test","email":"admin@example.com","password":"change-me-123456"}'
```

## Bruno API Docs

Open folder này trong Bruno:

```text
bruno/Hert-Hospital-Platform
```

Collection đã có:

- `Chatbot`: health, price, medical consultation, appointment, emergency
- `MCP`: health, search price, search policy, search ticket rules
- `Backoffice`: health, list/create tickets, list/create bookings
- `Auth`: Better Auth sign up/sign in

Variables nằm ở cả:

- `bruno/Hert-Hospital-Platform/collection.bru`
- `bruno/Hert-Hospital-Platform/environments/Local.bru`

Nếu Bruno báo `Invalid URL` với `{{chatbot_url}}/health`, hãy mở đúng folder root `bruno/Hert-Hospital-Platform` và reload collection.

## Database GUI

Open Adminer:

```text
http://localhost:18080

  System: PostgreSQL
  Server: chatbot-postgres
  Username: chatbot
  Password: chatbot
  Database: chatbot

  Backoffice DB:

  System: PostgreSQL
  Server: backoffice-postgres
  Username: backoffice
  Password: backoffice
  Database: backoffice
```

Chatbot DB:

- System: `PostgreSQL`
- Server: `chatbot-postgres`
- Username: `chatbot`
- Password: `chatbot`
- Database: `chatbot`

Backoffice DB:

- System: `PostgreSQL`
- Server: `backoffice-postgres`
- Username: `backoffice`
- Password: `backoffice`
- Database: `backoffice`

## Local Development Không Dùng Docker

Vẫn cần Postgres đang chạy. Có thể dùng Postgres từ Docker Compose rồi chạy service local:

```bash
npm install
npm run dev:mcp
npm run dev:backoffice
npm run dev:chatbot
```

MCP stdio mode cho MCP client local:

```bash
MCP_TRANSPORT=stdio npm run dev:mcp
```

MCP HTTP mode local:

```bash
MCP_TRANSPORT=http MCP_HTTP_PORT=5000 npm run dev:mcp
```

## Verification

Typecheck:

```bash
npm run typecheck
```

Smoke test sau setup:

```bash
docker compose ps
npm run import:data
curl -s http://localhost:3000/health
curl -s http://localhost:4000/health
curl -s http://localhost:15000/health
```

Kết quả import gần nhất:

- `services`: 2946
- `processDocs`: 41
- `contactDocs`: 7
- `ticketRules`: 21
- `navigation`: 3

## Troubleshooting

### Bruno báo `Invalid URL`

Mở đúng folder root:

```text
bruno/Hert-Hospital-Platform
```

Không mở folder con như `Chatbot` hoặc `Backoffice`. Sau đó reload collection hoặc chọn environment `Local`.

### Chatbot trả `intent: unknown`

Nếu chưa có `OPENROUTER_API_KEY`, hệ thống dùng fallback heuristic. Thêm `OPENROUTER_API_KEY` vào `.env` để OpenRouter classify intent tốt hơn:

```bash
OPENROUTER_API_KEY=your-key
docker compose up -d --build
```

### Port bị chiếm

Các host port đang dùng:

- `3000`: chatbot
- `4000`: backoffice
- `15000`: MCP HTTP wrapper
- `18080`: Adminer
- `15433`: chatbot Postgres
- `15434`: backoffice Postgres

Nếu đụng port, sửa mapping trong `docker-compose.yml`.

### Reset database local

Lệnh này xóa volume DB local:

```bash
docker compose down -v
docker compose up -d --build
npm run import:data
```

## Ghi Chú Thiết Kế

- Chatbot không ghi trực tiếp vào Backoffice DB.
- Chatbot gọi Backoffice API qua `x-internal-api-key`.
- MCP chỉ đọc dữ liệu nội bộ từ `chatbot-postgres`.
- Backoffice giữ auth/ticket/booking riêng trong `backoffice-postgres`.
- Response validator chặn các câu trả lời có dấu hiệu chẩn đoán/kê đơn.
- Dữ liệu vị trí phòng/khoa chuyên khoa cần bổ sung thêm nếu muốn trả lời navigation chi tiết hơn.
