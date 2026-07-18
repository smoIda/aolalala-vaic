# Hướng Dẫn Client Gọi Chat API

Tài liệu này dành cho frontend/mobile app hoặc hệ thống client cần tích hợp với `chatbot-api`.

Client chỉ cần gọi `POST /chat` để gửi tin nhắn và lưu `session.id` từ response để tiếp tục cùng một cuộc hội thoại. Mọi xử lý intent, flow đặt lịch, tạo ticket, search dữ liệu nội bộ và gọi service khác đều nằm ở backend.

## Base URL

Local:

```text
http://localhost:3000
```

Staging/production:

```text
https://chat-api.example.com
```

## Health Check

```http
GET /health
```

Response:

```json
{
  "ok": true,
  "service": "chatbot-api"
}
```

## Gửi Tin Nhắn Chat

```http
POST /chat
content-type: application/json
```

Request body:

```json
{
  "sessionId": "optional-existing-session-id",
  "userId": "optional-client-user-id",
  "message": "Tôi muốn đặt lịch khám tim mạch",
  "userProfile": {
    "name": "Nguyễn Văn A",
    "phone": "0900000000"
  }
}
```

Field request:

| Field | Type | Required | Ghi chú |
| --- | --- | --- | --- |
| `message` | string | Yes | Nội dung người dùng gửi. Không được rỗng. |
| `sessionId` | string | No | Gửi khi muốn tiếp tục hội thoại cũ. Lấy từ `response.session.id`. |
| `userId` | string | No | ID người dùng ở hệ thống client nếu có login. Chỉ cần gửi khi tạo session mới. |
| `userProfile.name` | string | No | Tên người dùng, giúp chatbot không phải hỏi lại khi tạo booking/ticket. |
| `userProfile.phone` | string | No | Số điện thoại, giúp chatbot không phải hỏi lại khi tạo booking/ticket. |

Không gửi field `id`. API hiện chỉ nhận `sessionId`; nếu gửi `id`, API sẽ trả lỗi `invalid_session_field`.

## Response Chuẩn

Mọi response thành công từ `POST /chat` có dạng:

```json
{
  "session": {
    "id": "c0c87d19-3f8f-4e31-9a7f-7fd59d9d722a",
    "status": "active",
    "currentFlow": "appointment",
    "currentState": "waiting_date",
    "context": {
      "department": "Tim mạch",
      "patient_name": "Nguyễn Văn A",
      "patient_phone": "0900000000"
    }
  },
  "intent": {
    "intent": "appointment",
    "confidence": 0.91,
    "entities": {
      "department": "Tim mạch"
    }
  },
  "response": "Anh/chị Nguyễn Văn A, anh/chị muốn khám ngày nào?",
  "action": {
    "type": "session_state_updated",
    "flow": "appointment",
    "state": "waiting_date"
  }
}
```

Field response:

| Field | Type | Ghi chú |
| --- | --- | --- |
| `session.id` | string | ID hội thoại. Client phải lưu lại để gửi ở request tiếp theo. |
| `session.status` | string | Trạng thái session. Hiện thường là `active`. |
| `session.currentFlow` | string/null | Flow hiện tại, ví dụ `appointment`, `medical_consultation`, `navigation`, `service`, `hospital_information`, `insurance_inquiry`. |
| `session.currentState` | string/null | State đang chờ người dùng trả lời, ví dụ `waiting_date`, `waiting_patient_phone`. |
| `session.context` | object | Bộ nhớ hội thoại phía backend. Client có thể dùng để debug, nhưng không nên phụ thuộc chặt vào schema này. |
| `intent` | object | Intent được backend detect. Schema có thể mở rộng theo model/classifier. |
| `response` | string | Nội dung chatbot cần hiển thị cho người dùng. |
| `action` | object/null | Hành động backend vừa thực hiện hoặc state update. Dùng để trigger UI nếu cần. |

Client nên hiển thị text trong field `response`. Không dùng `intent` hoặc `session.context` để tự suy luận câu trả lời thay backend.

## Cách Quản Lý Session

### Tạo session mới

Ở tin nhắn đầu tiên, không gửi `sessionId`:

```bash
curl -s http://localhost:3000/chat \
  -H 'content-type: application/json' \
  -d '{
    "message": "Tôi muốn đặt lịch khám tim mạch",
    "userProfile": {
      "name": "Nguyễn Văn A",
      "phone": "0900000000"
    }
  }'
```

API sẽ tạo session mới và trả về:

```json
{
  "session": {
    "id": "c0c87d19-3f8f-4e31-9a7f-7fd59d9d722a",
    "status": "active",
    "currentFlow": "appointment",
    "currentState": "waiting_date",
    "context": {
      "department": "Tim mạch",
      "patient_name": "Nguyễn Văn A",
      "patient_phone": "0900000000"
    }
  },
  "intent": {
    "intent": "appointment",
    "confidence": 0.91
  },
  "response": "Anh/chị Nguyễn Văn A, anh/chị muốn khám ngày nào?",
  "action": {
    "type": "session_state_updated",
    "flow": "appointment",
    "state": "waiting_date"
  }
}
```

Client cần lưu:

```text
sessionId = response.session.id
```

### Tiếp tục session cũ

Ở các tin nhắn tiếp theo, gửi lại `sessionId`:

```bash
curl -s http://localhost:3000/chat \
  -H 'content-type: application/json' \
  -d '{
    "sessionId": "c0c87d19-3f8f-4e31-9a7f-7fd59d9d722a",
    "message": "Sáng mai"
  }'
```

Response có thể chuyển sang state tiếp theo:

```json
{
  "session": {
    "id": "c0c87d19-3f8f-4e31-9a7f-7fd59d9d722a",
    "status": "active",
    "currentFlow": "appointment",
    "currentState": "waiting_time",
    "context": {
      "department": "Tim mạch",
      "date": "ngày mai",
      "patient_name": "Nguyễn Văn A",
      "patient_phone": "0900000000"
    }
  },
  "intent": {
    "intent": "appointment",
    "confidence": 0.86
  },
  "response": "Anh/chị Nguyễn Văn A, anh/chị muốn khám vào khung giờ nào?",
  "action": {
    "type": "session_state_updated",
    "flow": "appointment",
    "state": "waiting_time"
  }
}
```

### Khi session không tồn tại

Nếu client gửi `sessionId` không tồn tại:

```http
HTTP/1.1 404 Not Found
content-type: application/json
```

```json
{
  "error": "session_not_found",
  "message": "Chat session not found."
}
```

Client nên tạo hội thoại mới bằng cách gọi lại `POST /chat` không có `sessionId`.

## Action Types Quan Trọng

`action.type` giúp client biết backend vừa làm gì. Client không bắt buộc phải xử lý tất cả action, nhưng nên dùng các action quan trọng để hiển thị trạng thái phù hợp.

| `action.type` | Ý nghĩa | Gợi ý xử lý UI |
| --- | --- | --- |
| `session_state_updated` | Backend đang chờ người dùng trả lời thêm thông tin. | Hiển thị `response` bình thường và giữ session. |
| `mcp_search` | Backend đã search dữ liệu nội bộ để trả lời. | Hiển thị `response`. |
| `unknown_intent_mcp_fallback` | Intent không rõ, backend fallback sang search knowledge. | Hiển thị `response`. |
| `emergency_response` | Nội dung có dấu hiệu cấp cứu. | Có thể highlight cảnh báo/call hotline. |
| `hotline_guidance` | Backend hướng dẫn gọi hotline/cấp cứu. | Có thể hiển thị nút gọi hotline. |
| `ticket_created` | Đã tạo ticket tư vấn/yêu cầu hỗ trợ. | Hiển thị trạng thái tạo ticket thành công. |
| `booking_requested` | Đã ghi nhận yêu cầu đặt lịch. | Hiển thị trạng thái đặt lịch đang chờ xác nhận. |
| `session_recall` | Người dùng hỏi lại nội dung trước đó. | Hiển thị `response`. |

## Ví Dụ Flow Đặt Lịch

Tin nhắn 1:

```json
{
  "message": "Tôi muốn đặt lịch khám tim mạch",
  "userProfile": {
    "name": "Nguyễn Văn A",
    "phone": "0900000000"
  }
}
```

Response:

```json
{
  "session": {
    "id": "session-001",
    "status": "active",
    "currentFlow": "appointment",
    "currentState": "waiting_date",
    "context": {
      "department": "Tim mạch",
      "patient_name": "Nguyễn Văn A",
      "patient_phone": "0900000000"
    }
  },
  "intent": {
    "intent": "appointment",
    "confidence": 0.9
  },
  "response": "Anh/chị Nguyễn Văn A, anh/chị muốn khám ngày nào?",
  "action": {
    "type": "session_state_updated",
    "flow": "appointment",
    "state": "waiting_date"
  }
}
```

Tin nhắn 2:

```json
{
  "sessionId": "session-001",
  "message": "Sáng mai"
}
```

Response:

```json
{
  "session": {
    "id": "session-001",
    "status": "active",
    "currentFlow": "appointment",
    "currentState": "waiting_time",
    "context": {
      "department": "Tim mạch",
      "date": "ngày mai",
      "time": "sáng",
      "patient_name": "Nguyễn Văn A",
      "patient_phone": "0900000000"
    }
  },
  "intent": {
    "intent": "appointment",
    "confidence": 0.86
  },
  "response": "Anh/chị Nguyễn Văn A, anh/chị muốn khám vào khung giờ nào?",
  "action": {
    "type": "session_state_updated",
    "flow": "appointment",
    "state": "waiting_time"
  }
}
```

Tin nhắn cuối khi đủ thông tin:

```json
{
  "sessionId": "session-001",
  "message": "9 giờ"
}
```

Response:

```json
{
  "session": {
    "id": "session-001",
    "status": "active",
    "currentFlow": null,
    "currentState": null,
    "context": {
      "department": "Tim mạch",
      "date": "ngày mai",
      "time": "9 giờ",
      "patient_name": "Nguyễn Văn A",
      "patient_phone": "0900000000",
      "last_booking": {
        "booking": {
          "id": 123,
          "status": "requested"
        }
      }
    }
  },
  "intent": {
    "intent": "appointment",
    "confidence": 0.82
  },
  "response": "Tôi đã ghi nhận yêu cầu đặt lịch. Bệnh viện sẽ xác nhận lịch hẹn trước khi cuộc hẹn có hiệu lực.",
  "action": {
    "type": "booking_requested",
    "booking": {
      "booking": {
        "id": 123,
        "status": "requested"
      }
    }
  }
}
```

## Ví Dụ Flow Tạo Ticket Tư Vấn

Tin nhắn 1:

```json
{
  "message": "Tôi đau ngực, muốn hỏi bác sĩ",
  "userProfile": {
    "name": "Nguyễn Văn A",
    "phone": "0900000000"
  }
}
```

Response có thể hỏi người dùng chọn phương án:

```json
{
  "session": {
    "id": "session-002",
    "status": "active",
    "currentFlow": "medical_consultation",
    "currentState": "waiting_consultation_choice",
    "context": {
      "symptom": "đau ngực",
      "symptoms": ["đau ngực"],
      "patient_name": "Nguyễn Văn A",
      "patient_phone": "0900000000"
    }
  },
  "intent": {
    "intent": "medical_consultation",
    "confidence": 0.9
  },
  "response": "Tôi không thể chẩn đoán bệnh qua chat, nhưng có thể hỗ trợ:\n1. Đặt lịch khám\n2. Gửi yêu cầu tư vấn tới bệnh viện\n3. Gọi hotline/cấp cứu nếu triệu chứng nghiêm trọng\n\nAnh/chị muốn chọn phương án nào?",
  "action": {
    "type": "session_state_updated",
    "flow": "medical_consultation",
    "state": "waiting_consultation_choice"
  }
}
```

Người dùng chọn gửi yêu cầu tư vấn:

```json
{
  "sessionId": "session-002",
  "message": "2"
}
```

Response sau khi tạo ticket:

```json
{
  "session": {
    "id": "session-002",
    "status": "active",
    "currentFlow": null,
    "currentState": null,
    "context": {
      "symptom": "đau ngực",
      "symptoms": ["đau ngực"],
      "patient_name": "Nguyễn Văn A",
      "patient_phone": "0900000000",
      "last_ticket": {
        "ticket": {
          "id": 456,
          "status": "open"
        }
      }
    }
  },
  "intent": {
    "intent": "medical_consultation",
    "confidence": 0.88
  },
  "response": "Tôi đã tạo yêu cầu tư vấn cho bệnh viện. Bộ phận chuyên môn sẽ liên hệ lại với anh/chị.",
  "action": {
    "type": "ticket_created",
    "ticket": {
      "ticket": {
        "id": 456,
        "status": "open"
      }
    }
  }
}
```

## Ví Dụ Hỏi Thông Tin/Giá Dịch Vụ

Request:

```json
{
  "message": "Giá khám tim mạch bao nhiêu?"
}
```

Response:

```json
{
  "session": {
    "id": "session-003",
    "status": "active",
    "currentFlow": "service",
    "currentState": null,
    "context": {
      "last_topic": "Tim mạch",
      "last_department": "Tim mạch",
      "department": "Tim mạch"
    }
  },
  "intent": {
    "intent": "service_price",
    "confidence": 0.9
  },
  "response": "Chi phí khám Tim mạch là ...",
  "action": {
    "type": "mcp_search",
    "toolName": "search_price",
    "validationReason": null
  }
}
```

## Error Responses

### Request sai schema

Ví dụ thiếu `message` hoặc `message` rỗng:

```http
HTTP/1.1 400 Bad Request
content-type: application/json
```

```json
{
  "error": "invalid_request",
  "details": {}
}
```

### Gửi nhầm field `id`

```http
HTTP/1.1 400 Bad Request
content-type: application/json
```

```json
{
  "error": "invalid_session_field",
  "message": "Use sessionId to continue a chat session."
}
```

### Session không tồn tại

```http
HTTP/1.1 404 Not Found
content-type: application/json
```

```json
{
  "error": "session_not_found",
  "message": "Chat session not found."
}
```

### Lỗi server hoặc lỗi service phụ thuộc

Nếu backend gặp lỗi khi gọi AI provider, MCP, ticket service hoặc booking service:

```http
HTTP/1.1 500 Internal Server Error
content-type: application/json
```

Response lỗi 500 có thể theo format mặc định của Fastify. Client nên hiển thị thông báo chung như:

```text
Hệ thống đang bận, vui lòng thử lại sau.
```

## Khuyến Nghị Cho Client

- Luôn lưu `session.id` sau response đầu tiên.
- Luôn gửi lại `sessionId` khi người dùng tiếp tục cùng một hội thoại.
- Hiển thị trực tiếp field `response` cho người dùng.
- Dùng `action.type` để hiển thị trạng thái đặc biệt như tạo ticket, đặt lịch, hotline.
- Không phụ thuộc chặt vào schema của `session.context`; field này là bộ nhớ nội bộ và có thể mở rộng.
- Nếu nhận `session_not_found`, tạo session mới bằng cách gửi request không có `sessionId`.
- Nếu người dùng bấm "bắt đầu lại", xóa `sessionId` đang lưu ở client.
- Không gửi thông tin nhạy cảm ngoài dữ liệu cần thiết cho tư vấn/đặt lịch.
- Debounce hoặc disable nút gửi trong lúc chờ response để tránh gửi trùng tin nhắn.

## Checklist Tích Hợp

- Gọi được `GET /health`.
- Gửi được tin nhắn đầu tiên không có `sessionId`.
- Lưu được `session.id` từ response.
- Gửi được tin nhắn tiếp theo với `sessionId`.
- Hiển thị đúng field `response`.
- Xử lý được `action.type = "ticket_created"`.
- Xử lý được `action.type = "booking_requested"`.
- Xử lý được lỗi `invalid_request`, `invalid_session_field`, `session_not_found`.
- Có fallback UI khi API trả lỗi 500 hoặc timeout.
