# Hert Hospital Chatbot Platform — Tài liệu Dự án

## 1. Tổng quan dự án

**Tên dự án:** `hert-hospital-platform`
**Phiên bản:** 0.1.0 (MVP)
**Loại:** Monorepo (npm workspaces)
**Mục đích:** Chatbot bệnh viện tiếng Việt sử dụng AI (OpenRouter LLM), truy vấn dữ liệu nội bộ qua MCP, và quản lý ticket/booking qua backoffice.

**Công nghệ chính:**

| Tầng | Công nghệ |
|---|---|
| Runtime | Node.js + TypeScript (tsx) |
| Web Framework | Fastify 5 |
| Database | PostgreSQL 16 (2 instance riêng biệt) |
| AI Provider | OpenRouter API (GPT-latest) |
| Search / RAG | PostgreSQL `pg_trgm` (trigram similarity) |
| Auth | Better Auth (email/password) |
| Protocol | MCP (Model Context Protocol) SDK |
| Container | Docker Compose |
| API Docs | Bruno collection |
| Data Source | Excel workbook (`data-tim.xlsx`) |

---

## 2. Kiến trúc tổng thể

```
                         ┌──────────────────┐
                         │      User        │
                         └────────┬─────────┘
                                  │ POST /chat
                                  ▼
                    ┌───────────────────────────┐
                    │     chatbot-api (:3000)    │
                    │                           │
                    │  1. Intent Classification │
                    │     (OpenRouter / Fallback)│
                    │                           │
                    │  2. Route theo intent:    │
                    │     ├─ hospital_info ──► MCP retrieval
                    │     ├─ medical_consult ► Create ticket
                    │     ├─ appointment ────► Create booking
                    │     ├─ emergency ──────► Safety response
                    │     └─ unknown ────────► MCP fallback
                    │                           │
                    │  3. Grounded Answer Gen   │
                    │  4. Response Validation   │
                    │  5. Log to chat_logs      │
                    └──┬──────────┬─────────────┘
                       │          │
          ┌────────────┘          └────────────┐
          ▼                                    ▼
┌─────────────────────┐          ┌─────────────────────────┐
│  hert-hospital-mcp  │          │   backoffice-api (:4000) │
│  (:5000 → :15000)   │          │                         │
│                     │          │  POST /tickets           │
│  8 MCP search tools │          │  POST /bookings          │
│  (trigram search)   │          │  Better Auth endpoints   │
└──────────┬──────────┘          └──────────┬──────────────┘
           │                                │
           ▼                                ▼
┌─────────────────────┐          ┌─────────────────────────┐
│ chatbot-postgres    │          │ backoffice-postgres     │
│ (:15433)            │          │ (:15434)                │
│                     │          │                         │
│ • services          │          │ • tickets               │
│ • general_documents │          │ • bookings              │
│ • faq_documents     │          │ • users (Better Auth)   │
│ • ticket_label_rules│          │ • sessions              │
│ • navigation_locs   │          │                         │
│ • chat_logs         │          │                         │
└─────────────────────┘          └─────────────────────────┘
```

---

## 3. Services chi tiết

### 3.1 chatbot-api (Port 3000)

**Vai trò:** Endpoint công khai tiếp nhận tin nhắn từ user, phân loại intent, truy vấn dữ liệu, sinh câu trả lời AI, và điều phối tạo ticket/booking.

**Endpoints:**

| Method | Path | Mô tả |
|---|---|---|
| `GET` | `/health` | Kiểm tra trạng thái + kết nối DB |
| `POST` | `/chat` | Endpoint chính nhận tin nhắn và trả lời |

**Request body (`POST /chat`):**

```json
{
  "sessionId": "optional-session-id",
  "message": "Giá khám bệnh bao nhiêu?",
  "userProfile": {
    "name": "Nguyễn Văn A",
    "phone": "0900000000"
  }
}
```

**Response:**

```json
{
  "session": {
    "id": "backend-generated-session-id",
    "status": "active",
    "currentFlow": null,
    "currentState": null,
    "context": {}
  },
  "intent": {
    "intent": "hospital_information",
    "confidence": 0.95,
    "entities": {},
    "needsHuman": false,
    "emergencySignals": []
  },
  "response": "Theo dữ liệu nội bộ hiện có:\n...",
  "action": { "type": "information_provided" }
}
```

**Files:**

| File | Mô tả |
|---|---|
| `src/server.ts` | Fastify server, route `/chat`, logic điều phối intent |
| `src/openrouter.ts` | Intent classification + grounded answer generation qua OpenRouter |
| `src/mcp-client.ts` | HTTP client gọi MCP server, format context |
| `src/backoffice-client.ts` | HTTP client gọi backoffice-api tạo ticket/booking |
| `src/validator.ts` | Response validator — chặn nội dung y tế không an toàn |

### 3.2 backoffice-api (Port 4000)

**Vai trò:** Quản lý ticket (yêu cầu tư vấn y tế), booking (đặt lịch khám), và authentication cho admin.

**Endpoints:**

| Method | Path | Auth | Mô tả |
|---|---|---|---|
| `GET` | `/health` | — | Health check |
| `POST` | `/tickets` | `x-internal-api-key` | Tạo ticket mới |
| `GET` | `/tickets` | `x-internal-api-key` | Danh sách 100 ticket gần nhất |
| `PATCH` | `/tickets/:id` | `x-internal-api-key` | Cập nhật trạng thái/ưu tiên ticket |
| `POST` | `/bookings` | `x-internal-api-key` | Tạo booking mới |
| `GET` | `/bookings` | `x-internal-api-key` | Danh sách 100 booking gần nhất |
| `*` | `/api/auth/*` | — | Better Auth (sign-up, sign-in, session) |

**Auth mechanism:**
- Business endpoints dùng shared secret `INTERNAL_API_KEY` qua header `x-internal-api-key`
- Better Auth cung cấp email/password auth cho admin UI (sign-up, sign-in, session management)

### 3.3 hert-hospital-mcp (Port 5000 → host 15000)

**Vai trò:** MCP server cung cấp 8 công cụ tìm kiếm (retrieval) từ dữ liệu nội bộ bệnh viện, sử dụng PostgreSQL trigram similarity.

**Chế độ hoạt động:**
- **HTTP mode** (Docker): Fastify HTTP server, mỗi tool là 1 endpoint `POST /tools/:toolName`
- **stdio mode** (local): Standard MCP transport cho MCP client

**MCP Tools:**

| Tool | Bảng dữ liệu | Mô tả |
|---|---|---|
| `search_faq` | `faq_documents` | Tìm câu hỏi thường gặp |
| `search_department` | `navigation_locations` | Tìm khoa/phòng ban |
| `search_doctor` | — | Stub (chưa có dữ liệu bác sĩ) |
| `search_service` | `services` | Tìm dịch vụ y tế |
| `search_price` | `services` | Tìm giá dịch vụ |
| `search_policy` | `general_documents` | Tìm quy trình/chính sách |
| `search_navigation` | `navigation_locations` | Tìm vị trí/dẫn đường |
| `search_ticket_rules` | `ticket_label_rules` | Tìm rule phân loại ticket |

**Cơ chế tìm kiếm:**
```sql
SELECT *, similarity(search_text, $1) AS score
FROM {table}
WHERE search_text ILIKE '%' || $1 || '%'
   OR similarity(search_text, $1) > 0.08
ORDER BY score DESC
LIMIT $2
```

### 3.4 Các service hỗ trợ

| Service | Port | Mô tả |
|---|---|---|
| `chatbot-postgres` | 15433 | Database chứa dữ liệu kiến thức + chat logs |
| `backoffice-postgres` | 15434 | Database chứa tickets, bookings, auth |
| `adminer` | 18080 | GUI quản lý cả 2 database |

---

## 4. Cơ sở dữ liệu

### 4.1 Chatbot Database

#### Bảng `services` — Bảng giá dịch vụ
| Cột | Kiểu | Mô tả |
|---|---|---|
| `id` | BIGSERIAL PK | |
| `source_row` | INTEGER | Số dòng trong Excel |
| `stt` | TEXT | Số thứ tự |
| `equivalent_code` | TEXT | Mã dịch vụ |
| `name` | TEXT NOT NULL | Tên dịch vụ |
| `price_base_1` | NUMERIC | Giá cơ sở 1 |
| `price_base_2` | NUMERIC | Giá cơ sở 2 |
| `category` | TEXT | Nhóm dịch vụ |
| `note` | TEXT | Ghi chú |
| `search_text` | GENERATED | `name + category + note + code` |

**Index:** GIN trigram trên `search_text`

#### Bảng `general_documents` — Tài liệu quy trình, liên hệ
| Cột | Kiểu | Mô tả |
|---|---|---|
| `id` | BIGSERIAL PK | |
| `source_sheet` | TEXT | Tên sheet nguồn |
| `title` | TEXT NOT NULL | Tiêu đề |
| `content` | TEXT NOT NULL | Nội dung |
| `document_type` | TEXT | `process` / `contact` / `general` |
| `search_text` | GENERATED | `title + content + type` |

#### Bảng `faq_documents` — Câu hỏi thường gặp
| Cột | Kiểu | Mô tả |
|---|---|---|
| `id` | BIGSERIAL PK | |
| `source_document_id` | BIGINT FK → `general_documents(id)` | Liên kết tài liệu gốc |
| `question` | TEXT NOT NULL | Câu hỏi |
| `answer` | TEXT NOT NULL | Câu trả lời |
| `category` | TEXT | Phân loại |
| `search_text` | GENERATED | `question + answer + category` |

#### Bảng `ticket_label_rules` — Rule phân loại ticket
| Cột | Kiểu | Mô tả |
|---|---|---|
| `id` | BIGSERIAL PK | |
| `rule_group` | TEXT | Nhóm rule |
| `event_name` | TEXT NOT NULL | Tên sự kiện |
| `keywords` | TEXT | Từ khóa kích hoạt |
| `need_ticket` | BOOLEAN | Có cần tạo ticket không |
| `priority` | TEXT | Mức ưu tiên |
| `chatbot_action` | TEXT | Hành động chatbot |
| `ticket_type` | TEXT | Loại ticket |
| `search_text` | GENERATED | Concat các trường |

#### Bảng `navigation_locations` — Vị trí khoa/phòng
| Cột | Kiểu | Mô tả |
|---|---|---|
| `id` | BIGSERIAL PK | |
| `department_name` | TEXT NOT NULL | Tên khoa/phòng |
| `building` | TEXT | Tòa nhà |
| `floor` | TEXT | Tầng |
| `room` | TEXT | Phòng |
| `address` | TEXT | Địa chỉ |
| `instructions` | TEXT | Hướng dẫn dẫn đường |
| `search_text` | GENERATED | Concat các trường |

#### Bảng `chat_logs` — Nhật ký hội thoại
| Cột | Kiểu | Mô tả |
|---|---|---|
| `id` | BIGSERIAL PK | |
| `session_id` | TEXT | Session tracking |
| `user_message` | TEXT NOT NULL | Tin nhắn user |
| `detected_intent` | TEXT | Intent phát hiện được |
| `confidence` | NUMERIC | Độ tin cậy |
| `response_text` | TEXT | Câu trả lời |
| `created_at` | TIMESTAMPTZ | Thời gian |

### 4.2 Backoffice Database

#### Bảng `tickets`
| Cột | Kiểu | Mô tả |
|---|---|---|
| `id` | BIGSERIAL PK | |
| `external_ref` | TEXT UNIQUE | Tham chiếu ngoài |
| `source` | TEXT | Nguồn (chatbot/manual) |
| `status` | TEXT | `open` / `in_progress` / `closed` |
| `priority` | TEXT | `low` / `normal` / `high` / `urgent` |
| `ticket_type` | TEXT | Loại ticket |
| `title` | TEXT NOT NULL | Tiêu đề |
| `description` | TEXT NOT NULL | Nội dung |
| `patient_name` | TEXT | Tên bệnh nhân |
| `patient_phone` | TEXT | SĐT bệnh nhân |
| `metadata` | JSONB | Dữ liệu bổ sung |
| `created_at` | TIMESTAMPTZ | |
| `updated_at` | TIMESTAMPTZ | Auto-update trigger |

#### Bảng `bookings`
| Cột | Kiểu | Mô tả |
|---|---|---|
| `id` | BIGSERIAL PK | |
| `source` | TEXT | Nguồn |
| `status` | TEXT | `requested` / `confirmed` / `cancelled` |
| `patient_name` | TEXT | Tên bệnh nhân |
| `patient_phone` | TEXT | SĐT bệnh nhân |
| `department` | TEXT | Khoa muốn khám |
| `preferred_date` | TEXT | Ngày mong muốn |
| `preferred_time` | TEXT | Giờ mong muốn |
| `note` | TEXT | Ghi chú |
| `metadata` | JSONB | Dữ liệu bổ sung |
| `created_at` | TIMESTAMPTZ | |
| `updated_at` | TIMESTAMPTZ | Auto-update trigger |

**Trigger:** `touch_updated_at()` tự động cập nhật `updated_at` khi có UPDATE trên `tickets` và `bookings`.

---

## 5. Luồng hoạt động chi tiết

### 5.1 Phân loại Intent (Intent Classification)

```
User message
     │
     ▼
┌─────────────────────────┐
│ Có OPENROUTER_API_KEY?  │
└────┬───────────────┬────┘
  Có │               │ Không
     ▼               ▼
┌─────────┐   ┌──────────────┐
│ OpenRouter│   │ Fallback     │
│ LLM call │   │ Heuristic    │
│ (JSON    │   │ (keyword     │
│  schema) │   │  matching)   │
└────┬────┘   └──────┬───────┘
     │               │
     ▼               ▼
┌─────────────────────────┐
│ Zod validate kết quả    │
│ → IntentResult          │
└─────────────────────────┘
```

**5 intent categories:**

| Intent | Mô tả | Hành động |
|---|---|---|
| `hospital_information` | Hỏi thông tin bệnh viện (giá, dịch vụ, quy trình, địa chỉ) | RAG retrieval → Grounded answer |
| `medical_consultation` | Hỏi về triệu chứng, bệnh lý, tư vấn y tế | Tạo ticket priority=high |
| `appointment` | Muốn đặt lịch khám ngay | Tạo booking |
| `emergency` | Tín hiệu cấp cứu (khó thở, đau ngực dữ dội, 115) | Trả lời hướng dẫn cấp cứu, không RAG |
| `unknown` | Không xác định | Thử RAG FAQ fallback |

**Fallback heuristic (không cần API key):**
- Ưu tiên 1: Phát hiện từ khóa cấp cứu → `emergency` (confidence 0.8)
- Ưu tiên 2: Từ khóa đặt lịch + từ khóa hướng dẫn → `hospital_information` (0.72)
- Ưu tiên 3: Từ khóa thông tin chung (giá, dịch vụ, khoa, bảo hiểm) → `hospital_information` (0.65)
- Ưu tiên 4: Từ khóa đặt lịch đơn thuần → `appointment` (0.7)
- Ưu tiên 5: Từ khóa triệu chứng/đau → `medical_consultation` (0.65)
- Default: `unknown` (0.4)

### 5.2 RAG Retrieval Flow

```
User message + Intent = hospital_information / unknown
     │
     ▼
┌──────────────────────────────────┐
│ selectHospitalTool()             │
│ Chọn MCP tool theo từ khóa:     │
│  "dịch vụ" → search_service     │
│  "giá"     → search_price       │
│  "ở đâu"   → search_navigation  │
│  "quy trình" → search_policy    │
│  "ticket"  → search_ticket_rules│
│  default   → search_faq         │
└──────────┬───────────────────────┘
           │ POST /tools/{toolName}
           ▼
┌──────────────────────────────────┐
│ MCP Server                       │
│  1. normalizeServiceQuery()      │
│     (bỏ từ dừng: "giá", "chi    │
│      phí", "danh sách"...)      │
│  2. SQL trigram similarity       │
│  3. Return top-K results         │
└──────────┬───────────────────────┘
           │
           ▼
┌──────────────────────────────────┐
│ formatContext()                  │
│ Format kết quả thành text block  │
│ [1] Title\nSource\nContent       │
└──────────┬───────────────────────┘
           │
           ▼
┌──────────────────────────────────┐
│ generateGroundedAnswer()         │
│ Gửi context + question → LLM    │
│ System prompt: "Chỉ trả lời     │
│ dựa trên Context"                │
└──────────┬───────────────────────┘
           │
           ▼
┌──────────────────────────────────┐
│ validateResponse()               │
│ Chặn câu trả lời chứa:          │
│  "bạn bị", "chẩn đoán",         │
│  "uống thuốc", "kê đơn"         │
│  Tên bệnh cụ thể                 │
│ Nếu vi phạm → override response │
└──────────────────────────────────┘
```

### 5.3 Tạo Ticket (Medical Consultation)

```
User: "Tôi đau ngực, muốn hỏi bác sĩ"
     │
     ▼
Intent = medical_consultation (needsHuman = true)
     │
     ▼
chatbot-api → POST backoffice-api/tickets
     Headers: x-internal-api-key: dev-internal-key
     Body: {
       title: "Tư vấn y tế",
       description: "Tôi đau ngực, muốn hỏi bác sĩ",
       priority: "high",
       ticketType: "medical_consultation",
       patientName: "Nguyễn Văn A",
       patientPhone: "0900000000",
       metadata: { intent: {...} }
     }
     │
     ▼
backoffice-postgres: INSERT INTO tickets
     │
     ▼
Response → User:
  "Tôi không thể chẩn đoán hay tư vấn qua chat.
   Tôi đã ghi nhận yêu cầu để nhân viên y tế liên hệ."
  action: { type: "ticket_created", ticket: {...} }
```

### 5.4 Tạo Booking (Appointment)

```
User: "Tôi muốn đặt lịch khám tim mạch"
     │
     ▼
Intent = appointment (KHÔNG phải guidance question)
     │
     ▼
chatbot-api → POST backoffice-api/bookings
     Headers: x-internal-api-key: dev-internal-key
     Body: {
       patientName: "Nguyễn Văn B",
       patientPhone: "0911111111",
       department: "Tim mạch",
       note: "Tôi muốn đặt lịch khám tim mạch",
       metadata: { intent: {...} }
     }
     │
     ▼
backoffice-postgres: INSERT INTO bookings
     │
     ▼
Response → User:
  "Tôi đã ghi nhận đăng ký đặt lịch khám.
   Bệnh viện sẽ xác nhận lịch hẹn trước khi thực hiện."
  action: { type: "booking_requested", booking: {...} }
```

**Phân biệt appointment vs hospital_information cho đặt lịch:**
- Nếu message chứa TỪ khóa đặt lịch ("đặt lịch", "đăng ký khám") + TỪ khóa hướng dẫn ("quy trình", "thủ tục", "các bước", "hotline") → `hospital_information` (trả lời RAG về quy trình)
- Nếu chỉ chứa từ khóa đặt lịch mà không hỏi hướng dẫn → `appointment` (tạo booking)

### 5.5 Emergency Flow

```
User: "Tôi khó thở và đau ngực dữ dội"
     │
     ▼
Intent = emergency (confidence 0.8, needsHuman = true)
     emergencySignals: ["khó thở", "đau ngực dữ dội"]
     │
     ▼
KHÔNG gọi RAG, KHÔNG tạo ticket
     │
     ▼
Response → User:
  "Đây có thể là tình trạng cấp cứu. Vui lòng gọi 115
   hoặc đến cơ sở y tế gần nhất ngay lập tức."
```

---

## 6. Kịch bản chạy (Scenarios)

### 6.1 Setup lần đầu

```bash
# 1. Clone và cài dependencies
npm install

# 2. Tạo file env
cp .env.example .env
# Chỉnh sửa OPENROUTER_API_KEY nếu có

# 3. Khởi động Docker Compose
docker compose up -d --build

# 4. Import dữ liệu từ Excel
npm run import:data

# 5. Kiểm tra
curl -s http://localhost:3000/health
curl -s http://localhost:4000/health
curl -s http://localhost:15000/health
```

### 6.2 Kịch bản 1: Hỏi giá dịch vụ

**Input:**
```bash
curl -s http://localhost:3000/chat \
  -H 'content-type: application/json' \
  -d '{"message":"Giá khám bệnh bao nhiêu?"}'
```

**Luồng xử lý:**
1. Intent classifier → `hospital_information` (confidence ~0.9)
2. `selectHospitalTool()` → `search_price` (vì chứa từ "giá")
3. MCP `search_price` → tìm trong bảng `services` với query "khám bệnh"
4. Format context → gửi LLM tạo câu trả lời grounded
5. Validate response → trả về kết quả

**Kết quả mong đợi:**
```json
{
  "intent": { "intent": "hospital_information", "confidence": 0.9 },
  "response": "Theo dữ liệu nội bộ:\n[1] Khám bệnh - Giá: ...\n...",
  "action": { "type": "information_provided" }
}
```

### 6.3 Kịch bản 2: Tư vấn y tế → tạo ticket

**Input:**
```bash
curl -s http://localhost:3000/chat \
  -H 'content-type: application/json' \
  -d '{"message":"Tôi đau ngực, muốn hỏi bác sĩ","userProfile":{"name":"Nguyễn Văn A","phone":"0900000000"}}'
```

**Luồng xử lý:**
1. Intent classifier → `medical_consultation` (needsHuman = true)
2. Gọi `createTicket()` → POST backoffice-api/tickets
3. Ghi log vào `chat_logs`
4. Validate response → chặn nội dung chẩn đoán

**Kết quả mong đợi:**
```json
{
  "intent": { "intent": "medical_consultation", "needsHuman": true },
  "response": "Tôi không thể chẩn đoán hay tư vấn qua chat. Tôi đã ghi nhận yêu cầu để nhân viên y tế liên hệ.",
  "action": { "type": "ticket_created", "ticket": { "id": 1, "status": "open", "priority": "high" } }
}
```

### 6.4 Kịch bản 3: Đặt lịch khám → tạo booking

**Input:**
```bash
curl -s http://localhost:3000/chat \
  -H 'content-type: application/json' \
  -d '{"message":"Tôi muốn đặt lịch khám tim mạch","userProfile":{"name":"Nguyễn Văn B","phone":"0911111111"}}'
```

**Luồng xử lý:**
1. Intent classifier → `appointment`
2. Kiểm tra `isAppointmentGuidanceQuestion()` → false (không chứa từ khóa hướng dẫn)
3. Gọi `createBooking()` → POST backoffice-api/bookings
4. Ghi log vào `chat_logs`

**Kết quả mong đợi:**
```json
{
  "intent": { "intent": "appointment" },
  "response": "Tôi đã ghi nhận đăng ký đặt lịch khám. Bệnh viện sẽ xác nhận lịch hẹn trước khi thực hiện.",
  "action": { "type": "booking_requested", "booking": { "id": 1, "status": "requested" } }
}
```

### 6.5 Kịch bản 4: Cấp cứu

**Input:**
```bash
curl -s http://localhost:3000/chat \
  -H 'content-type: application/json' \
  -d '{"message":"Tôi khó thở và đau ngực dữ dội"}'
```

**Luồng xử lý:**
1. Intent classifier → `emergency` (confidence 0.8, emergencySignals: ["khó thở", "đau ngực dữ dội"])
2. KHÔNG gọi RAG, KHÔNG tạo ticket/booking
3. Trả lời trực tiếp hướng dẫn cấp cứu

**Kết quả mong đợi:**
```json
{
  "intent": { "intent": "emergency", "needsHuman": true, "emergencySignals": ["khó thở", "đau ngực dữ dội"] },
  "response": "Đây có thể là tình trạng cấp cứu. Vui lòng gọi 115 hoặc đến cơ sở y tế gần nhất ngay lập tức.",
  "action": { "type": "emergency_guidance" }
}
```

### 6.6 Kịch bản 5: Hỏi quy trình đặt lịch (RAG)

**Input:**
```bash
curl -s http://localhost:3000/chat \
  -H 'content-type: application/json' \
  -d '{"message":"Hướng dẫn cách đăng ký khám bệnh"}'
```

**Luồng xử lý:**
1. Intent classifier → `hospital_information` (vì chứa cả "đăng ký khám" + "hướng dẫn")
2. `selectHospitalTool()` → `search_policy` (từ khóa "hướng dẫn", "đăng ký")
3. MCP `search_policy` → tìm trong `general_documents`
4. Format context → LLM grounded answer → validate

### 6.7 Kịch bản 6: Không có OpenRouter API key

**Khi `OPENROUTER_API_KEY` rỗng:**
1. Intent classification dùng fallback heuristic (keyword matching)
2. Grounded answer = raw context (cắt 1200 ký tự) hoặc "Tôi chưa có thông tin"
3. Hệ thống vẫn hoạt động nhưng kém chính xác hơn

### 6.8 Kịch bản 7: Local development (không dùng Docker)

```bash
# Cần Postgres đang chạy (có thể dùng Docker cho DB)
docker compose up -d chatbot-postgres backoffice-postgres

# Chạy các service local
npm run dev:mcp        # MCP server (stdio mode mặc định)
npm run dev:backoffice # Backoffice API
npm run dev:chatbot    # Chatbot API

# MCP HTTP mode local
MCP_TRANSPORT=http MCP_HTTP_PORT=5000 npm run dev:mcp
```

---

## 7. Import dữ liệu

**Nguồn:** `data-tim.xlsx` (Excel workbook) + `data/seeds/navigation-locations.json`

**Script:** `scripts/import-data.ts`

**Quy trình (trong 1 transaction):**

```
1. TRUNCATE tất cả 5 bảng (RESTART IDENTITY CASCADE)
     │
     ▼
2. Import services từ sheet "Bảng giá dịch vụ"
   → 2946 bản ghi
     │
     ▼
3. Import process docs từ sheet "Quy trình đón tiếp bệnh nhân"
   → general_documents (type=process) + faq_documents liên kết
   → 41 bản ghi
     │
     ▼
4. Import contact info từ sheet "Liên hệ đặt lịch khám"
   → general_documents (type=contact) + faq_documents liên kết
   → 7 bản ghi
     │
     ▼
5. Import ticket rules từ sheet "Rule label ticket"
   → 21 bản ghi
     │
     ▼
6. Import navigation seeds từ JSON
   → 3 bản ghi (Cơ sở 1, Cơ sở 2, Phòng khám đa khoa)
```

**Lệnh chạy:**
```bash
npm run import:data

# Override connection string:
CHATBOT_DATABASE_URL=postgres://chatbot:chatbot@localhost:15433/chatbot npm run import:data
```

---

## 8. Phân tích thiết kế

### 8.1 Ưu điểm

|Aspect|Chi tiết|
|---|---|
|**Tách biệt database**|Chatbot DB và Backoffice DB riêng biệt, không coupled trực tiếp|
|**Safety-first**|Validator chặn nội dung chẩn đoán/kê đơn, emergency luôn trả hướng dẫn an toàn|
|**Graceful degradation**|Hoạt động không cần OpenRouter API key (fallback heuristic)|
|**MCP abstraction**|MCP server có thể phục vụ bất kỳ MCP client nào, không chỉ chatbot|
|**Dual transport**|MCP hỗ trợ cả stdio (native MCP) và HTTP (REST)|
|**Audit trail**|Mọi tương tác chat được ghi vào `chat_logs`|
|**Service-to-service auth**|Internal API key đơn giản cho môi trường dev/demo|

### 8.2 Hạn chế & Hướng cải tiến

|Aspect|Chi tiết|Gợi ý|
|---|---|---|
|**Search quality**|Dùng trigram similarity, không hiểu ngữ nghĩa|Nâng cấp vector embeddings (pgvector)|
|**Doctor data**|`search_doctor` là stub, chưa có dữ liệu|Bổ sung bảng doctors + import|
|**Navigation data**|Chỉ 3 seed entries, thiếu chi tiết|Bổ sung sơ đồ bệnh viện|
|**Auth cho business endpoints**|Dùng shared key, không có RBAC|Tích hợp Better Auth session cho CRUD|
|**Session management**|Chatbot chưa có conversation history/multi-turn|Thêm session store + context window|
|**Rate limiting**|Chưa có giới hạn request|Thêm rate limiter cho public API|
|**Error handling**|Chưa có retry mechanism cho OpenRouter|Thêm circuit breaker + retry queue|

### 8.3 Nguyên tắc thiết kế chính

1. **LLM không quyết định business logic** — Backend đọc intent và tự switch flow, không để AI tự chọn hành động
2. **MCP chỉ làm retrieval** — MCP server chỉ đọc dữ liệu nội bộ, không ghi/ghi đè
3. **Chatbot không ghi trực tiếp vào Backoffice DB** — Luôn gọi qua Backoffice API
4. **Response validator là tầng bảo vệ cuối** — Chặn nội dung y tế nguy hiểm trước khi đến user
5. **Excel là source of truth** — Dữ liệu bệnh viện được quản lý trong Excel, import vào DB

---

## 9. Biến môi trường

```bash
# OpenRouter AI
OPENROUTER_API_KEY=                    # Nếu trống → fallback heuristic
OPENROUTER_MODEL=~openai/gpt-latest
OPENROUTER_HTTP_REFERER=http://localhost:3000
OPENROUTER_APP_TITLE=Hert Hospital Chatbot

# AI Provider Logging
AI_PROVIDER_LOG_ENABLED=false          # true → ghi JSONL request/response
AI_PROVIDER_LOG_FILE=/app/logs/ai-provider.log

# Database
CHATBOT_DATABASE_URL=postgres://chatbot:chatbot@chatbot-postgres:5432/chatbot
BACKOFFICE_DATABASE_URL=postgres://backoffice:backoffice@backoffice-postgres:5432/backoffice

# Service URLs (Docker internal)
MCP_HTTP_URL=http://hert-hospital-mcp:5000
BACKOFFICE_API_URL=http://backoffice-api:4000
INTERNAL_API_KEY=dev-internal-key

# Better Auth
BETTER_AUTH_SECRET=replace-with-a-long-random-secret
BETTER_AUTH_URL=http://localhost:4000

# Ports
CHATBOT_PORT=3000
BACKOFFICE_PORT=4000
MCP_HTTP_PORT=5000

# MCP Transport
MCP_TRANSPORT=http                     # http | stdio
```

---

## 10. Port mapping

| Service | Host Port | Container Port | Mô tả |
|---|---|---|---|
| chatbot-api | 3000 | 3000 | API chatbot public |
| backoffice-api | 4000 | 4000 | Auth, ticket, booking |
| hert-hospital-mcp | 15000 | 5000 | MCP HTTP wrapper |
| adminer | 18080 | 8080 | Database GUI |
| chatbot-postgres | 15433 | 5432 | Knowledge DB |
| backoffice-postgres | 15434 | 5432 | Operational DB |

---

## 11. Kiểm tra nhanh (Verification)

```bash
# Typecheck
npm run typecheck

# Smoke test
docker compose ps
curl -s http://localhost:3000/health
curl -s http://localhost:4000/health
curl -s http://localhost:15000/health

# Test các intent
curl -s http://localhost:3000/chat -H 'content-type: application/json' -d '{"message":"Giá khám bệnh bao nhiêu?"}'
curl -s http://localhost:3000/chat -H 'content-type: application/json' -d '{"message":"Tôi đau ngực"}'
curl -s http://localhost:3000/chat -H 'content-type: application/json' -d '{"message":"Tôi muốn đặt lịch khám"}'
curl -s http://localhost:3000/chat -H 'content-type: application/json' -d '{"message":"Tôi khó thở và đau ngực dữ dội"}'

# MCP tools
curl -s http://localhost:15000/tools/search_price -H 'content-type: application/json' -d '{"query":"khám bệnh","limit":5}'

# Reset database
docker compose down -v && docker compose up -d --build && npm run import:data
```
