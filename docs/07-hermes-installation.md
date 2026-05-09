# คู่มือติดตั้ง Hermes Agent บน Hostinger VPS

> **เป้าหมาย:** ติดตั้ง Hermes AI Agent (Nous Research) พร้อม Telegram channel หลังบ้าน Traefik (HTTPS) สำหรับใช้เป็น personal AI assistant

---

## ข้อมูลอ้างอิง

- **VPS:** Hostinger Ubuntu 24.04 + Docker + Traefik
- **IP:** `72.62.64.163`
- **Domain:** `srv1637353.hstgr.cloud`
- **URL:** `https://hermes.srv1637353.hstgr.cloud`
- **Project:** `/opt/hermes/`
- **Image:** build จาก source `https://github.com/NousResearch/hermes-agent`
- **Network:** `ai-stack_app_net` (ใช้ร่วมกับ Traefik)
- **Data:** `/opt/hermes/data/` → `/opt/data` inside container
- **Container gateway:** `hermes`
- **Container dashboard:** `hermes-dashboard`

---

## ภาพรวม Architecture

```
User (Telegram / Web Browser)
        ↓
Internet HTTPS port 443
        ↓
Traefik (reverse proxy + SSL)
        ↓
hermes-dashboard (port 9119) ← Web UI
hermes gateway               ← AI agent + Telegram bot
        ↓
LLM Providers (OpenRouter / Google / Groq)
```

---

## Services

| Container | Role | Port |
|---|---|---|
| `hermes` | AI agent gateway + Telegram polling | — |
| `hermes-dashboard` | Web UI | 9119 (internal) |

---

## ขั้นตอนติดตั้ง (ครั้งแรก)

### 1. Clone repo และสร้าง data directory

```bash
git clone https://github.com/NousResearch/hermes-agent /opt/hermes
mkdir -p /opt/hermes/data
chown -R 10000:10000 /opt/hermes/data
```

### 2. สร้าง `.env`

```bash
cat > /opt/hermes/.env << 'EOF'
# LLM Providers
OPENROUTER_API_KEY=sk-or-v1-...
GOOGLE_API_KEY=AIzaSy...
GROQ_API_KEY=gsk_...

# User mapping
HERMES_UID=10000
HERMES_GID=10000

# Telegram
TELEGRAM_BOT_TOKEN=<token จาก @BotFather>
TELEGRAM_ALLOWED_USERS=<user_id1>,<user_id2>,<user_id3>
TELEGRAM_REPLY_TO_MODE=off
EOF
```

> **หมายเหตุ:** `TELEGRAM_REPLY_TO_MODE=off` ปิด quote bubble ใน Telegram  
> ค่าที่รองรับ: `off` | `first` (default) | `all`

### 3. สร้าง `docker-compose.yml`

```bash
cat > /opt/hermes/docker-compose.yml << 'EOF'
services:
  gateway:
    build: .
    image: hermes-agent
    container_name: hermes
    restart: unless-stopped
    volumes:
      - /opt/hermes/data:/opt/data
    env_file:
      - .env
    networks:
      - ai-stack_app_net
    command: ["gateway", "run"]

  dashboard:
    image: hermes-agent
    container_name: hermes-dashboard
    restart: unless-stopped
    depends_on:
      - gateway
    volumes:
      - /opt/hermes/data:/opt/data
    env_file:
      - .env
    networks:
      - ai-stack_app_net
    command: ["dashboard", "--host", "0.0.0.0", "--no-open", "--insecure"]
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.hermes.rule=Host(`hermes.srv1637353.hstgr.cloud`)"
      - "traefik.http.routers.hermes.entrypoints=websecure"
      - "traefik.http.routers.hermes.tls.certresolver=mytlschallenge"
      - "traefik.http.services.hermes.loadbalancer.server.port=9119"

networks:
  ai-stack_app_net:
    external: true
EOF
```

### 4. Build image (ใช้เวลา ~5-10 นาที)

```bash
cd /opt/hermes && docker compose build
```

### 5. Start containers

```bash
docker compose up -d
```

### 6. ตรวจสอบ

```bash
docker ps | grep hermes
docker logs hermes --tail 20
docker logs hermes-dashboard --tail 20
```

---

## การ config Telegram

### หา Telegram User ID
1. เปิด Telegram → search **@userinfobot**
2. ส่งข้อความอะไรก็ได้
3. bot ตอบกลับพร้อม **Id:** ตัวเลข — นั่นคือ user ID

### เพิ่ม User ใหม่
```bash
# แก้ไข .env
nano /opt/hermes/.env
# เพิ่ม user ID ใน TELEGRAM_ALLOWED_USERS=id1,id2,id3

# Recreate gateway เพื่อโหลด config ใหม่
cd /opt/hermes && docker compose up -d --force-recreate gateway
```

### สร้าง Telegram Bot ใหม่
1. ไปที่ **@BotFather** ใน Telegram
2. ส่ง `/newbot`
3. ตั้งชื่อ bot
4. นำ token ที่ได้ใส่ใน `TELEGRAM_BOT_TOKEN`

> ⚠️ **สำคัญ:** 1 bot token ใช้ได้กับ 1 service เท่านั้น  
> ห้ามใช้ token เดียวกับ openclaw หรือ service อื่น

---

## Environment Variables หลัก

### LLM Providers

| Variable | Provider |
|---|---|
| `OPENROUTER_API_KEY` | OpenRouter (รองรับหลาย model) |
| `GOOGLE_API_KEY` / `GEMINI_API_KEY` | Google Gemini |
| `GROQ_API_KEY` | Groq (ฟรี) |
| `OPENAI_API_KEY` | OpenAI |

### Telegram

| Variable | ความหมาย |
|---|---|
| `TELEGRAM_BOT_TOKEN` | Token จาก @BotFather |
| `TELEGRAM_ALLOWED_USERS` | User IDs ที่อนุญาต (comma-separated) |
| `TELEGRAM_REPLY_TO_MODE` | `off` / `first` / `all` (quote behavior) |
| `TELEGRAM_HOME_CHANNEL` | Channel ID สำหรับส่ง cron messages |
| `GATEWAY_ALLOW_ALL_USERS` | `true` = เปิดให้ทุกคนใช้ได้ (ไม่แนะนำ) |

### Platform อื่นที่รองรับ (native)
- Slack: `SLACK_BOT_TOKEN`, `SLACK_APP_TOKEN`
- WhatsApp: `WHATSAPP_ENABLED`
- Email: `EMAIL_ADDRESS`, `EMAIL_PASSWORD`, `EMAIL_IMAP_HOST`
- Microsoft Teams: `TEAMS_CLIENT_ID`, `TEAMS_CLIENT_SECRET`

> **LINE:** ไม่รองรับ native — ต้องใช้ n8n เป็น bridge

---

## การ Update Hermes

```bash
cd /opt/hermes

# Pull source ใหม่
git pull

# Build image ใหม่
docker compose build

# Restart
docker compose down && docker compose up -d
```

---

## Commands ที่ใช้บ่อย

```bash
# ดู status
docker ps | grep hermes

# ดู logs gateway
docker logs hermes --tail 50 -f

# ดู logs dashboard
docker logs hermes-dashboard --tail 50 -f

# Restart gateway (หลังแก้ .env)
cd /opt/hermes && docker compose up -d --force-recreate gateway

# Restart ทั้งหมด
cd /opt/hermes && docker compose down && docker compose up -d

# ดู .env ปัจจุบัน
cat /opt/hermes/.env
```

---

## Traefik Labels

certresolver บน VPS นี้ใช้ชื่อ **`mytlschallenge`** (ไม่ใช่ `letsencrypt`)

```yaml
- "traefik.http.routers.hermes.tls.certresolver=mytlschallenge"
```

---

## ข้อมูล Credentials ปัจจุบัน

| Item | Value |
|---|---|
| Web UI | `https://hermes.srv1637353.hstgr.cloud` |
| Telegram Bot | `@<ชื่อ bot ที่ตั้ง>` |
| Allowed Telegram User | `7843550069` |
| Data directory | `/opt/hermes/data/` |
