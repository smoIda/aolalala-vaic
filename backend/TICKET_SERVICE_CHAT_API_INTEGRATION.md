# Hướng Dẫn Tích Hợp Ticket Service Với Chat API

Tài liệu này mô tả contract để hệ thống ticket bên ngoài tích hợp với `chatbot-api`.

Trong phase hiện tại, `chatbot-api` không ghi trực tiếp vào database ticket. Khi cần tạo ticket từ hội thoại, `chatbot-api` sẽ gọi HTTP API của ticket service thông qua biến môi trường `BACKOFFICE_API_URL`. Vì ticket là hệ thống khác, ticket service chỉ cần expose endpoint tương thích với contract dưới đây.

## Tổng Quan Luồng Xử Lý

```text
Người dùng
  |
  v
chatbot-api
  |
  |-- phân loại intent / điều phối flow chat
  |
  |-- nếu cần tạo ticket
  v
ticket-service bên ngoài
```

Quy ước quan trọng:

- `chatbot-api` là service gọi sang ticket service.
- Ticket service không cần kết nối database của chatbot.
- Ticket service không gọi `POST /chat` để tạo ticket.
- Chatbot chỉ cần URL API và internal API key của ticket service.
- Nếu ticket service không dùng path `POST /tickets`, cần thêm adapter hoặc config mới trong `chatbot-api`.

## Cấu Hình Chatbot

Trong môi trường chạy `chatbot-api`, cấu hình:

```bash
BACKOFFICE_API_URL=https://ticket-service.example.com
INTERNAL_API_KEY=replace-with-shared-internal-key
```

Tên biến `BACKOFFICE_API_URL` đang được dùng lại từ MVP hiện tại. Khi tách ticket thành hệ thống riêng, giá trị của biến này nên trỏ đến base URL của ticket service.

Ví dụ trong Docker network:

```bash
BACKOFFICE_API_URL=http://ticket-service:4000
INTERNAL_API_KEY=replace-with-shared-internal-key
```

## Authentication

Mỗi request từ `chatbot-api` sang ticket service sẽ gửi header:

```http
x-internal-api-key: replace-with-shared-internal-key
content-type: application/json
```

Ticket service phải validate `x-internal-api-key`.

Nếu key sai hoặc thiếu, trả về:

```http
HTTP/1.1 401 Unauthorized
content-type: application/json
```

```json
{
  "error": "unauthorized"
}
```

Khuyến nghị:

- Dùng HTTPS trên môi trường public/staging/production.
- Lưu key trong secret manager hoặc environment variable.
- Rotate key theo quy trình deploy.
- Không log raw API key.

## Endpoint Cần Expose

### Health Check

Endpoint này dùng để kiểm tra ticket service có sẵn sàng nhận request hay không.

```http
GET /health
```

Response thành công:

```json
{
  "ok": true,
  "service": "ticket-service"
}
```

### Create Ticket

`chatbot-api` sẽ gọi endpoint này khi người dùng chọn gửi yêu cầu tư vấn hoặc khi flow chat cần tạo ticket.

```http
POST /tickets
```

Headers:

```http
content-type: application/json
x-internal-api-key: replace-with-shared-internal-key
```

Request body:

```json
{
  "title": "Yêu cầu tư vấn y tế từ chatbot",
  "description": "Người dùng đau ngực và muốn hỏi bác sĩ",
  "priority": "high",
  "ticketType": "medical_consultation",
  "patientName": "Nguyễn Văn A",
  "patientPhone": "0900000000",
  "metadata": {
    "sessionId": "01J...",
    "context": {
      "symptom": "đau ngực",
      "symptoms": ["đau ngực"]
    }
  }
}
```

Field contract:

| Field | Type | Required | Ghi chú |
| --- | --- | --- | --- |
| `title` | string | Yes | Tiêu đề ticket hiển thị cho nhân viên xử lý. |
| `description` | string | Yes | Nội dung tóm tắt từ hội thoại. |
| `priority` | string | No | Hiện tại có thể nhận `normal`, `high`; ticket service có thể map sang priority nội bộ. |
| `ticketType` | string/null | No | Ví dụ `medical_consultation`. |
| `patientName` | string/null | No | Tên người dùng nếu chatbot thu thập được. |
| `patientPhone` | string/null | No | Số điện thoại nếu chatbot thu thập được. |
| `metadata` | object | No | Dữ liệu kỹ thuật để trace về chat session. Nên lưu nguyên object này nếu có thể. |

Response thành công nên trả về `201 Created`:

```json
{
  "ticket": {
    "id": "TK-20260718-0001",
    "status": "open",
    "priority": "high",
    "ticketType": "medical_consultation",
    "title": "Yêu cầu tư vấn y tế từ chatbot",
    "patientName": "Nguyễn Văn A",
    "patientPhone": "0900000000",
    "createdAt": "2026-07-18T03:00:00.000Z",
    "url": "https://ticket-service.example.com/tickets/TK-20260718-0001"
  }
}
```

`chatbot-api` sẽ đưa object `ticket` này vào action response của chat, vì vậy ticket service nên trả về các field cần cho frontend/backoffice hiển thị hoặc trace.

Response validation error:

```http
HTTP/1.1 400 Bad Request
content-type: application/json
```

```json
{
  "error": "invalid_request",
  "message": "title and description are required"
}
```

Response lỗi server:

```http
HTTP/1.1 500 Internal Server Error
content-type: application/json
```

```json
{
  "error": "ticket_create_failed",
  "message": "Cannot create ticket at this time"
}
```

## Chat API Response Sau Khi Tạo Ticket

Client chat vẫn chỉ gọi `chatbot-api`.

Request từ UI/app:

```http
POST /chat
content-type: application/json
```

```json
{
  "sessionId": "existing-session-id",
  "message": "Tôi đồng ý gửi yêu cầu tư vấn",
  "userProfile": {
    "name": "Nguyễn Văn A",
    "phone": "0900000000"
  }
}
```

Sau khi ticket service tạo ticket thành công, `chatbot-api` trả về dạng:

```json
{
  "sessionId": "existing-session-id",
  "message": "Tôi đã tạo yêu cầu tư vấn cho bệnh viện. Bộ phận chuyên môn sẽ liên hệ lại với anh/chị.",
  "intent": "medical_consultation",
  "confidence": 0.9,
  "action": {
    "type": "ticket_created",
    "ticket": {
      "id": "TK-20260718-0001",
      "status": "open",
      "url": "https://ticket-service.example.com/tickets/TK-20260718-0001"
    }
  }
}
```

Frontend/chat client nên dùng `action.type === "ticket_created"` để biết ticket đã được tạo thành công.

## Idempotency Và Duplicate Ticket

Contract hiện tại chưa gửi header `Idempotency-Key`. Để giảm duplicate, ticket service nên dùng `metadata.sessionId` kết hợp với `ticketType` và thời gian tạo để detect request lặp.

Khuyến nghị cho ticket service:

- Lưu `metadata.sessionId`.
- Lưu raw `metadata.context` để trace.
- Nếu cùng một `sessionId` tạo cùng `ticketType` trong thời gian ngắn, có thể trả về ticket đã tồn tại thay vì tạo mới.
- Nếu cần idempotency chính thức, cần bổ sung `Idempotency-Key` vào `chatbot-api`.

## Timeout Và Retry

`chatbot-api` đang gọi ticket service bằng HTTP request có timeout. Ticket service nên:

- Trả response nhanh, lý tưởng dưới 3 giây.
- Không xử lý quá lâu trong request tạo ticket.
- Nếu cần enrich/assign ticket, nên tạo ticket trước rồi xử lý async sau.
- Đảm bảo create ticket là operation an toàn khi bị retry.

Nếu ticket service trả non-2xx, `chatbot-api` xem là lỗi tạo ticket.

## Mapping Dữ Liệu Gợi Ý

Ticket service có thể map payload vào model nội bộ như sau:

| Chatbot payload | Ticket system |
| --- | --- |
| `title` | subject/title |
| `description` | description/body |
| `priority` | priority/severity |
| `ticketType` | category/type |
| `patientName` | requester/customer name |
| `patientPhone` | requester/customer phone |
| `metadata.sessionId` | external conversation id |
| `metadata.context` | raw chatbot context/custom fields |

## Curl Test

Test trực tiếp ticket service:

```bash
curl -s https://ticket-service.example.com/health
```

```bash
curl -s https://ticket-service.example.com/tickets \
  -H 'content-type: application/json' \
  -H 'x-internal-api-key: replace-with-shared-internal-key' \
  -d '{
    "title": "Yêu cầu tư vấn y tế từ chatbot",
    "description": "Người dùng đau ngực và muốn hỏi bác sĩ",
    "priority": "high",
    "ticketType": "medical_consultation",
    "patientName": "Nguyễn Văn A",
    "patientPhone": "0900000000",
    "metadata": {
      "sessionId": "test-session-001",
      "context": {
        "symptom": "đau ngực"
      }
    }
  }'
```

Test end-to-end qua chatbot:

```bash
curl -s http://localhost:3000/chat \
  -H 'content-type: application/json' \
  -d '{
    "message": "Tôi đau ngực, muốn hỏi bác sĩ",
    "userProfile": {
      "name": "Nguyễn Văn A",
      "phone": "0900000000"
    }
  }'
```

Nếu chatbot hỏi tiếp lựa chọn, gửi tiếp cùng `sessionId` trong response:

```bash
curl -s http://localhost:3000/chat \
  -H 'content-type: application/json' \
  -d '{
    "sessionId": "SESSION_ID_FROM_PREVIOUS_RESPONSE",
    "message": "2"
  }'
```

## Checklist Cho Team Ticket

- Expose `GET /health`.
- Expose `POST /tickets`.
- Validate `x-internal-api-key`.
- Chấp nhận JSON fields: `title`, `description`, `priority`, `ticketType`, `patientName`, `patientPhone`, `metadata`.
- Trả `201` với object `{ "ticket": ... }` khi tạo thành công.
- Lưu `metadata.sessionId` để trace về hội thoại chatbot.
- Đảm bảo endpoint tạo ticket trả response nhanh và không tạo duplicate khi request bị retry.
- Cung cấp base URL để cấu hình vào `BACKOFFICE_API_URL` của `chatbot-api`.

## Những Điểm Cần Thống Nhất Nếu Contract Khác

Nếu ticket service hiện có không khớp contract trên, cần thống nhất các điểm sau trước khi nối production:

- Path tạo ticket có phải `POST /tickets` không.
- Header auth có dùng `x-internal-api-key` không.
- Field bắt buộc trong ticket service là gì.
- Response có wrapper `{ "ticket": ... }` hay không.
- Ticket ID field tên là `id`, `code`, hay `externalRef`.
- Có cần callback/update status ngược về chatbot không.

Nếu có khác biệt, nên tạo adapter trong `chatbot-api` thay vì bắt ticket service đổi toàn bộ domain model nội bộ.
