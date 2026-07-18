# Deploy Hert Hospital Platform lên Coolify

## Tổng quan

```
Internet
   │
   ▼
┌─────────────────────────────────────────────────┐
│  VPS (Ubuntu 22.04, 2GB+ RAM)                  │
│                                                 │
│  ┌───────────────────────────────────────────┐  │
│  │  Coolify (port 8000)                      │  │
│  │  ┌─────────────────────────────────────┐  │  │
│  │  │  Traefik (auto SSL, reverse proxy)  │  │  │
│  │  │  :80 → :443                         │  │  │
│  │  └─────────┬───────────┬───────────────┘  │  │
│  │            │           │                  │  │
│  │   ┌────────▼──┐  ┌────▼──────────┐       │  │
│  │   │ chatbot   │  │ backoffice    │       │  │
│  │   │ :3000     │  │ :4000         │       │  │
│  │   └─────┬─────┘  └──┬────────────┘       │  │
│  │         │           │                    │  │
│  │   ┌─────▼───────────▼──────────────┐     │  │
│  │   │  Docker Network: internal      │     │  │
│  │   │  ├─ hert-hospital-mcp :5000    │     │  │
│  │   │  ├─ chatbot-postgres :5432     │     │  │
│  │   │  └─ backoffice-postgres :5432  │     │  │
│  │   └────────────────────────────────┘     │  │
│  └───────────────────────────────────────────┘  │
└─────────────────────────────────────────────────┘
```

---

## Bước 1: Chuẩn bị VPS

### Yêu cầu tối thiểu

| Tài nguyên | Mức tối thiểu | Khuyến nghị |
|---|---|---|
| CPU | 1 core | 2 cores |
| RAM | 2 GB | 4 GB |
| Disk | 20 GB | 40 GB SSD |
| OS | Ubuntu 22.04 LTS | Ubuntu 24.04 LTS |
| Network | Port 80, 443, 8000 | Có domain riêng |

### Cài đặt Docker trên VPS

```bash
ssh root@your-vps-ip

# Update system
apt update && apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com | sh

# Verify
docker --version
docker compose version
```

---

## Bước 2: Cài Coolify

```bash
# Chạy installer chính thức
curl -fsSL https://cdn.coollabs.io/coolify/install.sh | bash

# Kiểm tra
docker ps | grep coolify
```

Truy cập Coolify:
```
http://your-vps-ip:8000
```

Đăng ký tài khoản admin lần đầu.

---

## Bước 3: Trỏ domain

Trong DNS provider (Cloudflare, Namecheap, v.v.):

| Type | Name | Value |
|---|---|---|
| A | `chatbot` | `your-vps-ip` |
| A | `backoffice` | `your-vps-ip` |
| A | `@` hoặc `app` | `your-vps-ip` |

Kết quả:
- `chatbot.yourdomain.com` → chatbot-api
- `backoffice.yourdomain.com` → backoffice-api

---

## Bước 4: Push code lên GitHub

```bash
# Trong project root
git init
git add .
git commit -m "init: hert hospital platform"

# Tạo repo trên GitHub, rồi push
git remote add origin git@github.com:your-org/vai.git
git push -u origin main
```

**File cần commit cho deploy:**
- `docker-compose.coolify.yml`
- `docker/production.Dockerfile`
- `sql/` (database migrations)
- `apps/`, `packages/`, `scripts/`, `data/`
- `package.json`, `package-lock.json`, `tsconfig.json`

---

## Bước 5: Tạo ứng dụng trong Coolify

### 5.1 — Thêm Docker Compose resource

1. Trong Coolify dashboard → **Add Resource**
2. Chọn **Docker Compose**
3. Chọn **Private repository** (hoặc Public) → kết nối GitHub
4. Chọn repo `vai`, branch `main`
5. **Base directory:** `/` (root)
6. **Docker Compose file:** `docker-compose.coolify.yml`

### 5.2 — Cấu hình Environment Variables

Trong Coolify > ứng dụng > **Environment Variables**, thêm từng biến:

```bash
# Database passwords (BẮT BUỘC — đổi giá trị thực)
CHATBOT_DB_PASSWORD=YourStrongPassword123!
BACKOFFICE_DB_PASSWORD=YourStrongPassword456!

# Internal API key
INTERNAL_API_KEY=your-random-internal-key-here

# Better Auth
BETTER_AUTH_SECRET=$(openssl rand -base64 48)
BETTER_AUTH_URL=https://backoffice.yourdomain.com

# OpenRouter AI
OPENROUTER_API_KEY=sk-or-v1-your-key-here
OPENROUTER_MODEL=~openai/gpt-latest
OPENROUTER_HTTP_REFERER=https://chatbot.yourdomain.com
OPENROUTER_APP_TITLE=Hert Hospital Chatbot

# AI Log
AI_PROVIDER_LOG_ENABLED=true
AI_PROVIDER_LOG_FILE=/app/logs/ai-provider.log
```

> **Mẹo:** Tạo `BETTER_AUTH_SECRET` bằng lệnh: `openssl rand -base64 48`

### 5.3 — Cấu hình Domains

Trong Coolify > ứng dụng:

**Service `chatbot-api`:**
1. Click vào service `chatbot-api`
2. **Domain:** `chatbot.yourdomain.com`
3. **Port:** `3000`
4. Enable **HTTPS** (Let's Encrypt auto)

**Service `backoffice-api`:**
1. Click vào service `backoffice-api`
2. **Domain:** `backoffice.yourdomain.com`
3. **Port:** `4000`
4. Enable **HTTPS**

> **Lưu ý:** `hert-hospital-mcp` và 2 database KHÔNG expose ra public. Chúng chỉ giao tiếp qua internal Docker network.

---

## Bước 6: Deploy

### 6.1 — Deploy lần đầu

Trong Coolify dashboard:
1. Click **Deploy** (hoặc **Deploy now**)
2. Chờ build + start tất cả containers (2-5 phút)

### 6.2 — Import dữ liệu

Sau khi deploy thành công, chạy import dữ liệu 1 lần:

```bash
# SSH vào VPS
ssh root@your-vps-ip

# Tìm container chatbot-api
docker ps | grep chatbot-api

# Chạy import (thay <container_id>)
docker exec -it <container_id> npx tsx scripts/import-data.ts
```

Hoặc dùng Coolify's **Tasks** > **Run command** trên service `chatbot-api`:
```
npx tsx scripts/import-data.ts
```

### 6.3 — Kiểm tra

```bash
# Health checks
curl https://chatbot.yourdomain.com/health
curl https://backoffice.yourdomain.com/health

# Test chatbot
curl -s https://chatbot.yourdomain.com/chat \
  -H 'content-type: application/json' \
  -d '{"message":"Giá khám bệnh bao nhiêu?"}'
```

---

## Bước 7: Tạo admin account (Better Auth)

```bash
curl -s https://backoffice.yourdomain.com/api/auth/sign-up/email \
  -H 'content-type: application/json' \
  -d '{
    "name": "Admin",
    "email": "admin@yourdomain.com",
    "password": "YourSecurePassword123!"
  }'
```

---

## Kiến trúc mạng trong Coolify

```
                    ┌──────────────────────┐
                    │   Coolify Proxy      │
                    │   (Traefik)          │
                    │   :80 / :443         │
                    └──┬──────────────┬────┘
                       │              │
         ┌─────────────▼──┐    ┌──────▼─────────────┐
         │ chatbot-api    │    │ backoffice-api     │
         │ :3000          │    │ :4000              │
         │ chatbot.domain │    │ backoffice.domain  │
         └───────┬────────┘    └──────┬─────────────┘
                 │                    │
    ┌────────────▼────────────────────▼────────────┐
    │         Network: internal                    │
    │                                              │
    │  ┌──────────────────┐                        │
    │  │ hert-hospital-mcp│◄── chatbot-api gọi     │
    │  │ :5000 (internal) │    qua internal net    │
    │  └────────┬─────────┘                        │
    │           │                                  │
    │  ┌────────▼─────────┐  ┌──────────────────┐  │
    │  │ chatbot-postgres │  │ backoffice-postgres│ │
    │  │ (knowledge DB)   │  │ (tickets/bookings) │ │
    │  └──────────────────┘  └──────────────────┘  │
    └──────────────────────────────────────────────┘
```

**Giao tiếp giữa các services:**
- `chatbot-api` → `hert-hospital-mcp`: qua `http://hert-hospital-mcp:5000` (internal)
- `chatbot-api` → `backoffice-api`: qua `http://backoffice-api:4000` (internal)
- `chatbot-api` → `chatbot-postgres`: qua internal network
- `backoffice-api` → `backoffice-postgres`: qua internal network
- Internet → `chatbot-api` / `backoffice-api`: qua Coolify proxy (HTTPS)

---

## Auto-deploy khi push code

Trong Coolify:
1. Vào ứng dụng > **Webhooks**
2. Copy **Deploy webhook URL**
3. Vào GitHub repo > **Settings** > **Webhooks** > **Add webhook**
4. Paste webhook URL, content type: `application/json`
5. Trigger: **Just the push event**

Mỗi lần push lên `main`, Coolify tự động rebuild + redeploy.

---

## Monitoring & Logs

### Xem logs trong Coolify
- Coolify dashboard > ứng dụng > **Logs**
- Chọn service để xem logs riêng

### Xem logs qua SSH
```bash
# Tất cả logs
docker compose -f docker-compose.coolify.yml logs -f

# Logs riêng chatbot
docker compose -f docker-compose.coolify.yml logs -f chatbot-api

# AI provider logs (nếu enabled)
docker exec <chatbot-container> cat /app/logs/ai-provider.log
```

### Health monitoring
```bash
# Cron job check health mỗi 5 phút
*/5 * * * * curl -sf https://chatbot.yourdomain.com/health > /dev/null || echo "ALERT: chatbot down" | mail -s "Alert" admin@yourdomain.com
```

---

## Backup database

### Script backup nhanh

```bash
#!/bin/bash
# backup.sh — Chạy trên VPS

BACKUP_DIR="/root/backups"
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p $BACKUP_DIR

# Backup chatbot DB
docker exec $(docker ps -qf "name=chatbot-postgres") \
  pg_dump -U chatbot chatbot | gzip > $BACKUP_DIR/chatbot_$DATE.sql.gz

# Backup backoffice DB
docker exec $(docker ps -qf "name=backoffice-postgres") \
  pg_dump -U backoffice backoffice | gzip > $BACKUP_DIR/backoffice_$DATE.sql.gz

# Xóa backup cũ hơn 7 ngày
find $BACKUP_DIR -name "*.sql.gz" -mtime +7 -delete

echo "Backup completed: $DATE"
```

```bash
# Chạy tự động mỗi ngày lúc 2h sáng
chmod +x backup.sh
echo "0 2 * * * /root/backup.sh >> /var/log/backup.log 2>&1" | crontab -
```

### Restore database

```bash
# Restore chatbot DB
gunzip -c chatbot_20260718_020000.sql.gz | \
  docker exec -i $(docker ps -qf "name=chatbot-postgres") \
  psql -U chatbot chatbot

# Sau đó chạy lại import nếu cần
docker exec -it <chatbot-api-container> npx tsx scripts/import-data.ts
```

---

## Xử lý sự cố

### Container không start

```bash
# Xem logs lỗi
docker compose -f docker-compose.coolify.yml logs <service-name>

# Restart 1 service
docker compose -f docker-compose.coolify.yml restart <service-name>

# Rebuild + restart
docker compose -f docker-compose.coolify.yml up -d --build <service-name>
```

### Database connection refused

```bash
# Kiểm tra DB có đang chạy
docker ps | grep postgres

# Kiểm tra health
docker exec <postgres-container> pg_isready -U chatbot -d chatbot

# Xem connection string trong env
docker exec <chatbot-api-container> env | grep DATABASE_URL
```

### 502 Bad Gateway

- Kiểm tra service có đang chạy: `docker ps`
- Kiểm tra port đúng trong Coolify domain config
- Kiểm tra network `coolify-proxy` có tồn tại: `docker network ls`

### OpenRouter API lỗi

```bash
# Kiểm tra API key
docker exec <chatbot-api-container> env | grep OPENROUTER

# Xem AI provider logs
docker exec <chatbot-api-container> cat /app/logs/ai-provider.log | tail -20
```

---

## Checklist trước khi go-live

- [ ] VPS đã cài Docker + Coolify
- [ ] Domain đã trỏ DNS về VPS
- [ ] Push code lên GitHub
- [ ] Tạo ứng dụng Coolify từ repo
- [ ] Set environment variables (passwords, API keys)
- [ ] Config domain + HTTPS cho chatbot-api
- [ ] Config domain + HTTPS cho backoffice-api
- [ ] Deploy thành công
- [ ] Chạy import dữ liệu (`npm run import:data`)
- [ ] Test health endpoints
- [ ] Test chatbot với 5 kịch bản (giá, tư vấn, đặt lịch, cấp cứu, unknown)
- [ ] Tạo admin account (Better Auth)
- [ ] Setup auto-deploy webhook
- [ ] Setup backup cron job
- [ ] Bật `AI_PROVIDER_LOG_ENABLED=true`
- [ ] Đổi tất cả password mặc định

---

## Chi phí ước tính

| Hạng mục | Provider | Chi phí/tháng |
|---|---|---|
| VPS 2GB RAM | DigitalOcean / Vultr / Hetzner | $6-12 |
| VPS 4GB RAM (khuyến nghị) | Hetzner CX22 | ~$5 |
| Domain | Cloudflare / Namecheap | $1-10/năm |
| OpenRouter API | Theo usage | ~$5-20 (tuỳ traffic) |
| **Tổng** | | **~$10-30/tháng** |

> **Hetzner** là lựa chọn tốt nhất về giá/hiệu năng cho EU. **DigitalOcean** cho US/Asia.

---

## Alternative: Deploy không cần Coolify

Nếu muốn đơn giản hơn nữa, chỉ cần VPS + Docker Compose:

```bash
# Trên VPS
git clone your-repo && cd vai
cp .env.production .env
# Chỉnh sửa .env

# Start tất cả
docker compose -f docker-compose.coolify.yml up -d --build

# Import data
docker compose -f docker-compose.coolify.yml run --rm import-data

# Setup Caddy làm reverse proxy (auto HTTPS)
# Cài Caddy, tạo Caddyfile:
cat > /etc/caddy/Caddyfile << 'EOF'
chatbot.yourdomain.com {
    reverse_proxy localhost:3000
}
backoffice.yourdomain.com {
    reverse_proxy localhost:4000
}
EOF

systemctl restart caddy
```

Cách này không có auto-deploy nhưng đủ dùng cho MVP/demo.
