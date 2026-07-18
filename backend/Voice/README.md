# Soniox STT cho Chatbot (Voice → Text)

Module Python nhỏ gọn giúp biến **giọng nói của người dùng thành văn bản**, dùng làm
**input cho chatbot**, bằng [Soniox Speech-to-Text API](https://soniox.com/docs/stt/rt/real-time-transcription).

Một class `SonioxSTT` duy nhất phục vụ **cả hai kịch bản**:

| Kịch bản | Hàm | Khi nào dùng |
|----------|-----|--------------|
| **File / Push-to-talk** | `transcribe_file()` | Người dùng thu âm/upload một đoạn → lấy text hoàn chỉnh |
| **Microphone real-time** | `transcribe_microphone()` | Lắng nghe liên tục; mỗi lượt nói xong → đẩy text vào chatbot |

Luồng tổng thể:

```
🎤 Giọng nói  ──►  Soniox STT  ──►  📝 Văn bản  ──►  🤖 Chatbot  ──►  (câu trả lời)
   (user)          (module này)      (input)         (của bạn)
```

---

## 0. Đã có sẵn: HTTP service cho nút mic trên chatbot

`server.py` bọc sẵn `SonioxSTT.transcribe_audio_bytes` thành một endpoint HTTP
(`POST /voice`, nhận raw audio bytes, trả `{"transcript": "..."}"`). Backend
Node/Fastify (`apps/chatbot-api`) có route `POST /voice` proxy sang service
này (biến môi trường `SONIOX_SERVICE_URL`, mặc định `http://localhost:8001`).
Nút mic trên chatbot ở frontend gọi `${API_URL}/voice` (qua backend chính),
backend chính forward sang service này.

Chạy service (cần Python + pip riêng, không nằm trong `npm run dev:chatbot`):

```bash
cd backend/Voice
pip install -r requirements.txt
export SONIOX_API_KEY=<key>      # Windows: setx SONIOX_API_KEY "<key>"
python server.py                  # lắng nghe :8001 (đổi bằng SONIOX_SERVICE_PORT)
```

---

## 1. Cài đặt

```bash
pip install websockets            # bắt buộc
pip install sounddevice numpy     # chỉ cần cho chế độ microphone
```

Lấy API key tại [console.soniox.com](https://console.soniox.com) rồi export:

```bash
export SONIOX_API_KEY=<key_của_bạn>
```

> Windows (PowerShell): `setx SONIOX_API_KEY "<key>"` rồi mở lại terminal.
> Chế độ microphone dùng `sounddevice` (cần PortAudio; trên macOS/Windows cài kèm pip,
> trên Linux có thể cần `sudo apt install libportaudio2`).

Chạy thử:

```bash
python soniox_stt.py path/to/audio.mp3   # nhận diện một file
python soniox_stt.py                      # trợ lý giọng nói (cần mic)
```

---

## 2. Dùng nhanh

### Push-to-talk (một file audio)

```python
from soniox_stt import SonioxSTT

stt = SonioxSTT(language_hints=["vi", "en"])
text = stt.transcribe_file("cau_hoi.mp3")
print(text)          # -> đưa chuỗi này vào chatbot của bạn
```

### Trợ lý giọng nói (microphone real-time)

```python
from soniox_stt import SonioxSTT

def on_utterance(user_text: str):
    reply = my_chatbot(user_text)   # gọi chatbot của bạn
    print("🤖", reply)

stt = SonioxSTT(language_hints=["vi", "en"])
stt.transcribe_microphone(on_utterance=on_utterance)   # chạy tới khi Ctrl+C
```

---

## 3. Xử lý & chuẩn hoá text — phần quan trọng nhất

Với STT, "xử lý text" gồm **hai phía**: (a) *đầu vào* — cấu hình để Soniox nhận
đúng chữ ngay từ đầu, và (b) *đầu ra* — ghép/làm sạch token thành câu sạch cho chatbot.

### 3.1. Token → transcript: cách ghép chữ

Soniox không trả về câu nguyên khối, mà trả về **luồng token** (từ, tiểu-từ, hoặc
dấu cách). Mỗi token có cờ `is_final`:

| Loại token | `is_final` | Ý nghĩa |
|------------|:----------:|---------|
| **Tạm** | `false` | Text đoán nhanh, **có thể đổi/biến mất** khi nghe thêm. Chỉ để hiển thị live |
| **Chốt** | `true` | Đã cố định, ghép vào transcript |

Cách ghép đúng là **nối trực tiếp** `token.text` (spacing nằm sẵn trong token), **không**
dùng `" ".join(...)`. Module đã làm sẵn việc này và cắt bỏ khoảng trắng thừa.

Ngoài ra Soniox chèn **token điều khiển** — module tự lọc bỏ, không đưa vào text:

| Token | Xuất hiện khi | Module xử lý |
|-------|---------------|--------------|
| `<end>` | Endpoint detection: người dùng nói xong một lượt | Dùng làm tín hiệu "chốt lượt" → gọi `on_utterance`, **không** thêm vào text |
| `<fin>` | Manual finalization đã hoàn tất | Bỏ qua |

### 3.2. Endpoint detection — biết khi nào người dùng nói xong

Đây là mấu chốt của trợ lý giọng nói: **khi nào thì đẩy text vào chatbot?**

Bật `enable_endpoint_detection` (chế độ mic bật sẵn), Soniox dùng *semantic
endpointing* — dựa vào ngắt nghỉ, ngữ điệu, ngữ cảnh — để đoán người dùng đã nói
xong một câu, rồi phát ra token `<end>`. Module gom mọi token final kể từ `<end>`
lần trước thành một câu và gọi `on_utterance(câu_đó)`.

```
"Đặt cho tôi vé đi Đà Nẵng"   <end>   "ngày mai lúc 8 giờ"   <end>
        └── on_utterance("Đặt cho tôi vé đi Đà Nẵng")   └── on_utterance("ngày mai lúc 8 giờ")
```

> **Lưu ý đánh đổi:** endpoint càng "nhạy" thì độ trễ càng thấp nhưng độ chính xác
> có thể giảm nhẹ (model có ít thời gian sửa lại transcript hơn), và câu dài dễ bị
> cắt thành nhiều mảnh. Có thể tinh chỉnh qua `max_endpoint_delay_ms`,
> `endpoint_sensitivity` trong config nếu cần.

### 3.3. Cải thiện độ chính xác đầu vào — `language_hints` & `context`

Đây là "xử lý text" *chủ động*: bảo Soniox **kỳ vọng** những gì, để nó nhận đúng.

**`language_hints`** — gợi ý ngôn ngữ. Với tiếng Việt dùng `["vi"]`; nếu người dùng
hay chêm tiếng Anh, dùng `["vi", "en"]`:

```python
SonioxSTT(language_hints=["vi", "en"])
```

**`context`** — cung cấp thuật ngữ, tên riêng, ngữ cảnh để nhận đúng những từ hiếm/dễ sai:

```python
stt = SonioxSTT(
    language_hints=["vi"],
    context={
        "general": [{"key": "domain", "value": "ngân hàng"}],
        "terms": ["Techcombank", "OTP", "sao kê", "phong toả tài khoản"],
    },
)
```

Ví dụ tác dụng: không có context, "Techcombank" có thể ra "tếch com banh". Có context,
Soniox ưu tiên nhận đúng thuật ngữ bạn khai báo. Rất hữu ích cho chatbot theo lĩnh vực
(y tế, tài chính, nội bộ công ty...).

### 3.4. Làm sạch trước khi feed chatbot

Module tự chuẩn hoá nhẹ: gộp khoảng trắng thừa, cắt đầu/cuối. Soniox **đã tự chấm
câu và viết hoa**, nên thường bạn không cần xử lý thêm. Một mẹo nên có ở phía bạn:

```python
def on_utterance(text: str):
    text = text.strip()
    if not text:          # người dùng im lặng / chỉ có tạp âm -> bỏ qua
        return
    reply = my_chatbot(text)
```

---

## 4. Cấu hình `SonioxSTT`

| Tham số | Mặc định | Ghi chú |
|---------|----------|---------|
| `api_key` | đọc từ `SONIOX_API_KEY` | Nên để trong biến môi trường, đừng hard-code |
| `model` | `"stt-rt-v5"` | Model real-time |
| `language_hints` | `None` | Ví dụ `["vi"]`, `["vi","en"]` — xem mục 3.3 |
| `context` | `None` | Thuật ngữ/ngữ cảnh để nhận đúng — xem mục 3.3 |
| `enable_speaker_diarization` | `False` | Gán nhãn người nói (`speaker`). *Lưu ý:* bật cùng endpoint detection sẽ giảm độ chính xác phân biệt người nói |

Tham số của từng hàm:

- `transcribe_file(path, chunk_size=8192, on_partial=None)` → trả về `str`
- `transcribe_audio_bytes(audio_bytes, ...)` → như trên nhưng nhận thẳng bytes
- `transcribe_microphone(on_utterance, on_partial=None, sample_rate=16000, stop_event=None)` → chạy vòng lặp

---

## 5. Ví dụ tích hợp thực tế

### 5.1. Web: nhận audio upload → text → chatbot

```python
from soniox_stt import SonioxSTT

stt = SonioxSTT(language_hints=["vi", "en"])

@app.post("/voice")
def handle_voice(request):
    audio_bytes = request.files["audio"].read()   # wav/mp3/... từ client
    user_text = stt.transcribe_audio_bytes(audio_bytes)
    if not user_text:
        return {"error": "Không nghe rõ, bạn nói lại giúp nhé."}
    reply = my_chatbot(user_text)
    return {"transcript": user_text, "reply": reply}
```

### 5.2. Trợ lý giọng nói đầy đủ (mic → chatbot, có hiển thị live)

```python
from soniox_stt import SonioxSTT

def my_chatbot(text: str) -> str:
    # thay bằng LLM / chatbot của bạn
    return f"Bạn vừa nói: {text}"

def on_utterance(user_text: str):
    print(f"\n👤 {user_text}")
    print(f"🤖 {my_chatbot(user_text)}")

def on_partial(partial: str):
    print(f"   …{partial}", end="\r")   # chữ tạm khi đang nói

stt = SonioxSTT(
    language_hints=["vi", "en"],
    context={"terms": ["đặt lịch", "hủy đơn", "hoàn tiền"]},
)
stt.transcribe_microphone(on_utterance=on_utterance, on_partial=on_partial)
```

### 5.3. Dừng vòng lặp mic từ code (dùng `stop_event`)

```python
import threading
from soniox_stt import SonioxSTT

stop = threading.Event()
stt = SonioxSTT(language_hints=["vi"])

t = threading.Thread(
    target=stt.transcribe_microphone,
    kwargs={"on_utterance": print, "stop_event": stop},
)
t.start()

# ... khi muốn dừng:
stop.set()
t.join()
```

---

## 6. Lưu ý khi lên production

- **Bảo mật key:** nếu stream mic *trực tiếp từ trình duyệt*, **đừng** nhúng
  `SONIOX_API_KEY` vào client. Dùng *temporary API key* cấp từ server của bạn.
  Kiến trúc an toàn hơn: client gửi audio về server của bạn → server proxy lên Soniox.
- **Keepalive:** nếu có quãng im lặng dài (không gửi audio), WebSocket có thể timeout;
  gửi message `{"type": "keepalive"}` để giữ kết nối.
- **Giới hạn phiên:** mỗi kết nối hỗ trợ tối đa ~300 phút audio; phiên dài cần mở lại
  kết nối mới.
- **Push-to-talk chính xác hơn:** nếu app có nút "nhấn-giữ để nói", cân nhắc *manual
  finalization* (`{"type": "finalize"}`) thay cho endpoint detection để chốt đúng lúc
  người dùng thả nút.
- **Chi phí:** STT tính theo giờ audio — real-time (streaming) khoảng **0,12 USD/giờ**,
  async (file) khoảng **0,10 USD/giờ**. (Bạn bị tính theo *độ dài stream*, kể cả lúc im lặng.)

---

## 7. Xử lý lỗi thường gặp

| Triệu chứng | Nguyên nhân & cách xử lý |
|-------------|--------------------------|
| `RuntimeError: Thiếu SONIOX_API_KEY` | Chưa export biến môi trường |
| `Chế độ microphone cần: pip install sounddevice numpy` | Thiếu thư viện thu âm |
| `Soniox lỗi 401 (unauthenticated)` | API key sai/thiếu |
| `Soniox lỗi 400 ... Missing audio format` | Với PCM thô phải khai `audio_format`, `sample_rate`, `num_channels` (mic mode đã set sẵn) |
| Text rỗng | Người dùng im lặng, hoặc tạp âm — kiểm tra `if not text` trước khi gọi chatbot |
| Nhận sai thuật ngữ/tên riêng | Thêm vào `context["terms"]` và set `language_hints` |
| Câu bị cắt vụn thành nhiều lượt | Endpoint quá nhạy — tăng `max_endpoint_delay_ms` |

---

## 8. Tham khảo

- Real-time transcription: <https://soniox.com/docs/stt/rt/real-time-transcription>
- Endpoint detection: <https://soniox.com/docs/stt/rt/endpoint-detection>
- Manual finalization: <https://soniox.com/docs/stt/rt/manual-finalization>
- Context (thuật ngữ/ngữ cảnh): <https://soniox.com/docs/stt/concepts/context>
- Language hints: <https://soniox.com/docs/stt/concepts/language-hints>
- WebSocket API reference: <https://soniox.com/docs/api-reference/stt/websocket-api>
- Bảng giá: <https://soniox.com/pricing>
