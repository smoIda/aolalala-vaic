# Deploy toàn bộ app lên 1 VPS (Oracle Cloud Free Tier)

Deploy cả stack — **frontend + chatbot-api + MCP + Postgres + Voice STT** — lên
một VPS miễn phí, một entrypoint HTTPS duy nhất qua Caddy. Không cần mua domain.

```
Internet ──HTTPS──▶ Caddy (:443, auto Let's Encrypt)
                      ├─ /        ▶ frontend  (Next.js :3000)
                      └─ /api/*   ▶ chatbot-api (Fastify :3000)  ─┬─▶ hert-hospital-mcp :5000
                                                                  ├─▶ chatbot-postgres :5432
                                                                  └─▶ soniox-stt :8001 (Python)
```

Chỉ Caddy mở cổng ra ngoài (80/443). Postgres, MCP, STT nằm trong mạng nội bộ.

---

## Bước 1 — Tạo VPS Oracle Cloud (Always Free)

1. Đăng ký https://www.oracle.com/cloud/free/ (cần thẻ để xác minh, **không bị trừ tiền** với gói Always Free).
2. **Create Instance**:
   - Image: **Canonical Ubuntu 24.04**
   - Shape: **VM.Standard.A1.Flex** (ARM) — chọn **2–4 OCPU, 12–24 GB RAM** (đều free).
     - Nếu báo hết capacity ARM, thử region/AD khác, hoặc dùng tạm **VM.Standard.E2.1.Micro** (AMD, 1GB — hơi chật cho cả stack).
   - Thêm SSH key của bạn.
3. Sau khi tạo, ghi lại **Public IP** (ví dụ `140.238.1.23`).

### Mở cổng 80/443

Oracle chặn mặc định, phải mở ở **2 nơi**:

**a) VCN Security List / Network Security Group** (trong console Oracle):
- Ingress rule: Source `0.0.0.0/0`, TCP, port **80** và **443**.

**b) Firewall trong máy** (Ubuntu image của Oracle bật iptables sẵn):
```bash
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 80 -j ACCEPT
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 443 -j ACCEPT
sudo netfilter-persistent save
```

---

## Bước 2 — Cài Docker

```bash
ssh ubuntu@<PUBLIC_IP>

sudo apt update && sudo apt upgrade -y
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER
newgrp docker          # nạp lại group, khỏi cần logout
docker --version && docker compose version
```

---

## Bước 3 — Lấy code lên VPS

```bash
# Cách A: clone từ GitHub (khuyến nghị)
git clone <your-repo-url> app && cd app

# Cách B: copy từ máy bạn lên (chạy ở máy local)
#   scp -r ./aolala ubuntu@<PUBLIC_IP>:~/app
```

> Đảm bảo repo có: `docker-compose.vps.yml`, `Caddyfile`, `.env.vps.example`,
> `frontend/`, `backend/`.

---

## Bước 4 — Cấu hình `.env`

```bash
cp .env.vps.example .env
nano .env
```

Bắt buộc điền:

| Biến | Giá trị |
|---|---|
| `SITE_ADDRESS` | `<IP-với-dấu-gạch>.sslip.io`, ví dụ IP `140.238.1.23` → `140-238-1-23.sslip.io` |
| `SONIOX_API_KEY` | Key từ https://console.soniox.com |
| `CHATBOT_DB_PASSWORD` | Đặt mật khẩu mạnh |
| `OPENROUTER_API_KEY` | Key OpenRouter (chatbot cần để trả lời) |

> **sslip.io** tự phân giải `140-238-1-23.sslip.io → 140.238.1.23`, không phải đăng ký gì.
> Muốn tên đẹp hơn thì dùng DuckDNS: tạo `yourname.duckdns.org` trỏ về IP, rồi đặt `SITE_ADDRESS=yourname.duckdns.org`.

---

## Bước 5 — Build & chạy

```bash
docker compose -f docker-compose.vps.yml up -d --build
```

Lần đầu build ~5–10 phút (frontend Next.js + cài deps). Theo dõi:

```bash
docker compose -f docker-compose.vps.yml ps
docker compose -f docker-compose.vps.yml logs -f caddy      # xem Caddy cấp cert
```

### Import dữ liệu (chạy 1 lần)

```bash
docker compose -f docker-compose.vps.yml --profile setup run --rm import-data
```

---

## Bước 6 — Kiểm tra

```bash
# Từ máy bạn hoặc trên VPS
curl -k https://140-238-1-23.sslip.io/api/health           # {"ok":true,...} (cần Postgres)
curl -k https://140-238-1-23.sslip.io/api/chat \
  -H 'content-type: application/json' \
  -d '{"message":"Giá khám tim mạch bao nhiêu?"}'
```

Rồi mở trình duyệt: **https://140-238-1-23.sslip.io** → bấm mic → nói → text hiện ra.

> Lần đầu Caddy xin cert Let's Encrypt mất ~10–30s; nếu gặp lỗi cert, đợi chút rồi F5.
> Mic của trình duyệt **chỉ hoạt động trên HTTPS** — nên phải dùng `SITE_ADDRESS` có tên miền (sslip.io/DuckDNS), không dùng IP trần.

---

## Vận hành

```bash
# Xem log 1 service
docker compose -f docker-compose.vps.yml logs -f chatbot-api

# Cập nhật code mới
git pull
docker compose -f docker-compose.vps.yml up -d --build

# Restart / dừng
docker compose -f docker-compose.vps.yml restart chatbot-api
docker compose -f docker-compose.vps.yml down          # dừng (giữ data)
```

### Backup Postgres

```bash
docker compose -f docker-compose.vps.yml exec chatbot-postgres \
  pg_dump -U chatbot chatbot | gzip > backup_$(date +%F).sql.gz
```

---

## Xử lý sự cố

| Triệu chứng | Cách xử lý |
|---|---|
| Không vào được `https://...` | Kiểm tra đã mở port 80/443 ở **cả** Security List lẫn iptables (Bước 1) |
| Caddy không cấp được cert | Xem `logs -f caddy`. Port 80 phải mở (Let's Encrypt validate qua HTTP). Đợi rate-limit nếu thử nhiều lần |
| Mic báo lỗi/không xin quyền | Phải là HTTPS + hostname; IP trần không được. Cấp quyền micro cho trang |
| Voice trả lỗi | `logs -f soniox-stt` — thường do `SONIOX_API_KEY` sai/thiếu |
| Chatbot trả lời kém | Thiếu `OPENROUTER_API_KEY` |
| Tạo ticket/đặt lịch lỗi | Cần `DASHBOARD_API_URL` trỏ tới dashboard thật (không có trong repo này). Chat/voice vẫn chạy bình thường |
| RAM thiếu (shape Micro 1GB) | Dùng shape ARM A1 nhiều RAM hơn, hoặc thêm swap: `sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile && sudo mkswap /swapfile && sudo swapon /swapfile` |

---

## Ghi chú kiến trúc

- **Same-origin API**: frontend build với `NEXT_PUBLIC_API_URL=/api` (đường dẫn tương đối). Browser gọi `/api/chat`, Caddy strip `/api` rồi forward tới `chatbot-api`. Đổi IP/domain **không cần build lại** frontend — chỉ đổi `SITE_ADDRESS` rồi `up -d`.
- **Bảo mật**: chỉ Caddy publish cổng. Postgres/MCP/STT không expose ra host.
- **ARM64**: mọi image (node, python, caddy, postgres) đều có bản arm64 nên chạy tốt trên Oracle A1.
```
