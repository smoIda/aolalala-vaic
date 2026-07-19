# Deploy toàn bộ stack lên 1 VPS trống

Toàn bộ hệ thống — **frontend, chatbot-api, MCP, Postgres, Voice STT, Dashboard** — trên một VPS duy nhất. Một entrypoint HTTPS (Caddy) điều phối mọi traffic.

```
Internet ──HTTPS──▶ Caddy (:443, auto Let's Encrypt)
                       ├─ /           ▶ frontend         (Next.js :3000)
                       ├─ /api/*      ▶ chatbot-api      (Fastify :3000)
                       └─ /dashboard/*▶ dashboard        (FastAPI :8000)

Nội bộ Docker network:
  chatbot-api ──▶ hert-hospital-mcp :5000
  chatbot-api ──▶ soniox-stt :8001
  chatbot-api ──▶ chatbot-postgres :5432
  hert-hospital-mcp ──▶ chatbot-postgres :5432
  dashboard ──▶ chatbot-postgres :5432
```

Chỉ Caddy mở cổng 80/443. Postgres, MCP, STT, Dashboard nằm trong mạng nội bộ Docker.

---

## Mục lục

1. [Tạo VPS](#bước-1--tạo-vps)
2. [Cài Docker](#bước-2--cài-docker)
3. [Lấy code](#bước-3--lấy-code-lên-vps)
4. [Cấu hình .env](#bước-4--cấu-hình-env)
5. [Build & chạy](#bước-5--build--chạy)
6. [Kiểm tra](#bước-6--kiểm-tra)
7. [Vận hành](#vận-hành)
8. [Xử lý sự cố](#xử-lý-sự-cố)

---

## Bước 1 — Tạo VPS

### Oracle Cloud Free Tier (khuyến nghị)

1. Đăng ký https://www.oracle.com/cloud/free/ (cần thẻ xác minh, **không trừ tiền** gói Always Free).
2. **Create Instance**:
   - Image: **Canonical Ubuntu 24.04**
   - Shape: **VM.Standard.A1.Flex** (ARM) — **4 OCPU, 24 GB RAM** (đều free).
   - Nếu hết capacity ARM, dùng tạm **VM.Standard.E2.1.Micro** (AMD, 1GB — cần thêm swap).
   - Thêm SSH key.
3. Ghi lại **Public IP** (ví dụ `140.238.1.23`).

### VPS khác (Viettel, AWS, DigitalOcean...)

- Ubuntu 22.04/24.04, tối thiểu **2 CPU, 4 GB RAM** (khuyến nghị 4 CPU, 8 GB).
- Mở port 80, 443 trong security group / firewall.

### Mở cổng 80/443

**Oracle Cloud — mở ở 2 nơi:**

**a) VCN Security List / Network Security Group** (trong console Oracle):
- Ingress rule: Source `0.0.0.0/0`, TCP, port **80** và **443**.

**b) Firewall trong máy** (Ubuntu Oracle bật iptables sẵn):
```bash
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 80 -j ACCEPT
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 443 -j ACCEPT
sudo netfilter-persistent save
```

**VPS khác:** mở port 80/443 trong panel quản lý (thường mặc định đã mở).

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

# Cách B: copy từ máy local
# scp -r ./aolalala ubuntu@<PUBLIC_IP>:~/app
```

Cấu trúc cần có:
```
app/
├── docker-compose.vps.yml
├── Caddyfile
├── .env.vps.example
├── frontend/          # Next.js chatbot UI
├── backend/           # chatbot-api + MCP + Voice STT
│   ├── apps/chatbot-api/
│   ├── packages/hert-hospital-mcp/
│   ├── Voice/         # Soniox STT wrapper
│   ├── docker/
│   └── sql/
└── Dashboard/         # FastAPI ticket management
    ├── backend/
    └── frontend/
```

---

## Bước 4 — Cấu hình `.env`

```bash
cp .env.vps.example .env
nano .env
```

### Biến bắt buộc

| Biến | Mô tả | Ví dụ |
|---|---|---|
| `SITE_ADDRESS` | Domain/IP để Caddy cấp HTTPS cert | `140-238-1-23.sslip.io` |
| `SONIOX_API_KEY` | Key Soniox Speech-to-Text | Lấy từ https://console.soniox.com |
| `CHATBOT_DB_PASSWORD` | Mật khẩu Postgres | Đổi khác default! |
| `OPENROUTER_API_KEY` | Key OpenRouter (LLM) | Lấy từ https://openrouter.ai |
| `INTERNAL_API_KEY` | Shared secret giữa chatbot-api ↔ dashboard | Random string |

### Cách chọn `SITE_ADDRESS`

| Cách | Giá trị | Ghi chú |
|---|---|---|
| sslip.io (nhanh nhất) | `140-238-1-23.sslip.io` | Thay `.` bằng `-` trong IP. Free, không đăng ký. |
| DuckDNS (tên đẹp) | `yourname.duckdns.org` | Tạo free tại duckdns.org, trỏ A record về IP |
| Domain riêng | `chatbot.yourdomain.com` | Trỏ A record về IP VPS |
| HTTP only (test) | `:80` | Không có HTTPS, mic trình duyệt không hoạt động |

> **Mic trình duyệt chỉ hoạt động trên HTTPS** — bắt buộc phải có hostname (sslip.io/DuckDNS/domain), không dùng IP trần.

---

## Bước 5 — Build & chạy

```bash
docker compose -f docker-compose.vps.yml up -d --build
```

Lần đầu build ~5–15 phút. Theo dõi:

```bash
# Xem trạng thái các container
docker compose -f docker-compose.vps.yml ps

# Xem log (chờ Caddy cấp cert)
docker compose -f docker-compose.vps.yml logs -f caddy
```

### Import dữ liệu ban đầu (chạy 1 lần)

```bash
docker compose -f docker-compose.vps.yml --profile setup run --rm import-data
```

---

## Bước 6 — Kiểm tra

### Health check

```bash
# Từ máy local hoặc trên VPS
curl -k https://<SITE_ADDRESS>/api/health
# → {"ok":true,...}

curl -k https://<SITE_ADDRESS>/dashboard/api/health
# → {"status":"ok","app":"...","version":"1.0.0"}
```

### Test chatbot

```bash
curl -k https://<SITE_ADDRESS>/api/chat \
  -H 'content-type: application/json' \
  -d '{"message":"Giá khám tim mạch bao nhiêu?"}'
```

### Truy cập trình duyệt

| URL | Chức năng |
|---|---|
| `https://<SITE_ADDRESS>/` | Chatbot UI (khách hàng) |
| `https://<SITE_ADDRESS>/dashboard/` | Dashboard quản trị ticket |

> **Đăng nhập Dashboard:** Email `admin@bvtimhanoi.vn` / Mật khẩu `Admin@123` (đổi ngay sau lần đầu).

---

## Vận hành

### Xem log

```bash
# Tất cả services
docker compose -f docker-compose.vps.yml logs -f

# Một service
docker compose -f docker-compose.vps.yml logs -f chatbot-api
docker compose -f docker-compose.vps.yml logs -f dashboard
docker compose -f docker-compose.vps.yml logs -f caddy
```

### Cập nhật code

```bash
git pull
docker compose -f docker-compose.vps.yml up -d --build
```

### Restart một service

```bash
docker compose -f docker-compose.vps.yml restart chatbot-api
```

### Dừng / khởi động lại

```bash
docker compose -f docker-compose.vps.yml down          # dừng (giữ data)
docker compose -f docker-compose.vps.yml up -d         # khởi động lại
```

### Backup Postgres

```bash
docker compose -f docker-compose.vps.yml exec chatbot-postgres \
  pg_dump -U chatbot chatbot | gzip > backup_$(date +%F).sql.gz
```

### Restore Postgres

```bash
gunzip -c backup_2025-01-15.sql.gz | \
  docker compose -f docker-compose.vps.yml exec -T chatbot-postgres \
  psql -U chatbot chatbot
```

### Cleanup disk

```bash
# Xóa image/container cũ
docker system prune -f
docker volume prune -f   # CẨN TRỌNG: chỉ xóa volume không còn container dùng
```

---

## Xử lý sự cố

| Triệu chứng | Nguyên nhân & xử lý |
|---|---|
| Không vào được `https://...` | Mở port 80/443 ở **cả** Security List lẫn iptables (Bước 1) |
| Caddy không cấp cert | `logs -f caddy`. Port 80 phải mở. Đợi rate-limit nếu thử nhiều lần |
| Mic không hoạt động | Phải HTTPS + hostname (không dùng IP trần). Cấp quyền mic cho trang |
| Voice trả lỗi | `logs -f soniox-stt` — `SONIOX_API_KEY` sai/thiếu |
| Chatbot trả lời kém | Thiếu `OPENROUTER_API_KEY` hoặc model sai |
| Dashboard 502 | `logs -f dashboard` — kiểm tra `DASHBOARD_DATABASE_URL`, Postgres đã sẵn sàng chưa |
| Ticket tạo lỗi | `DASHBOARD_API_URL` trong chatbot-api phải trỏ `http://dashboard:8000/api/internal` |
| RAM thiếu (shape Micro 1GB) | Thêm swap: `sudo fallocate -l 4G /swapfile && sudo chmod 600 /swapfile && sudo mkswap /swapfile && sudo swapon /swapfile` |
| Disk đầy | `docker system prune -a` và xóa log cũ trong `/app/logs` |
| Build lỗi ARM64 | Mọi image (node, python, caddy, postgres) đều có bản arm64, chạy tốt trên Oracle A1 |

---

## Kiến trúc chi tiết

### Routing qua Caddy

| Path | Service | Ghi chú |
|---|---|---|
| `/` | frontend (Next.js :3000) | Chatbot UI |
| `/api/*` | chatbot-api (Fastify :3000) | Strip `/api` prefix |
| `/dashboard/*` | dashboard (FastAPI :8000) | Strip `/dashboard` prefix |

### Services trong Docker network `appnet`

| Service | Port nội bộ | Expose ra host? |
|---|---|---|
| caddy | 80, 443 | **Có** (entrypoint) |
| frontend | 3000 | Không |
| chatbot-api | 3000 | Không (qua Caddy) |
| hert-hospital-mcp | 5000 | Không |
| soniox-stt | 8001 | Không |
| chatbot-postgres | 5432 | Không |
| dashboard | 8000 | Không (qua Caddy) |

### Same-origin API

Frontend build với `NEXT_PUBLIC_API_URL=/api` (đường dẫn tương đối). Browser gọi `/api/chat`, Caddy strip `/api` rồi forward tới `chatbot-api`. Đổi IP/domain **không cần build lại** frontend — chỉ đổi `SITE_ADDRESS` rồi `up -d`.

### Dữ liệu bền vững (Docker volumes)

| Volume | Chức năng |
|---|---|
| `chatbot-pg-data` | Postgres data (knowledge, tickets, users) |
| `ai-logs` | Log AI provider requests |
| `caddy-data` | TLS certificates |
| `caddy-config` | Caddy config cache |

---

## Monitoring cơ bản

### Kiểm tra nhanh

```bash
# Trạng thái container
docker compose -f docker-compose.vps.yml ps

# Tài nguyên
docker stats --no-stream

# Disk usage
docker system df
```

### Auto-restart

Mọi service đều có `restart: unless-stopped` — tự khởi động lại khi crash hoặc VPS reboot.

### Theo dõi log bằng cron

```bash
# Lưu log hàng ngày
0 0 * * * cd ~/app && docker compose -f docker-compose.vps.yml logs --since=24h > /var/log/app-$(date +\%F).log
```
