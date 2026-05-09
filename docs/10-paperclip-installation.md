# คู่มือ: Paperclip Installation

> **Paperclip** — AI-powered document/data management service พร้อม Web UI  
> **URL:** https://paperclip.srv1637353.hstgr.cloud  
> **Mode:** Authenticated + Private  

---

## ข้อมูลอ้างอิง

| รายการ | ค่า |
|---|---|
| **Path** | `/opt/paperclip/` |
| **Subdomain** | `paperclip.srv1637353.hstgr.cloud` |
| **Internal Port** | 3100 |
| **Database** | PostgreSQL 17 (Alpine) |
| **Network** | `ai-stack_app_net` (external, shared) |
| **Compose file** | `/opt/paperclip/docker-compose.yml` |

---

## Services (Docker Containers)

| Container | Image | Role |
|---|---|---|
| `paperclip-paperclip-1` | paperclip-paperclip (custom build) | App server |
| `paperclip-paperclip-db-1` | postgres:17-alpine | Database |

---

## Environment Variables

ไฟล์: `/opt/paperclip/.env`

```env
BETTER_AUTH_SECRET=<secret>
PAPERCLIP_PUBLIC_URL=https://paperclip.srv1637353.hstgr.cloud
PAPERCLIP_TELEMETRY_DISABLED=1
DO_NOT_TRACK=1
OPENAI_API_KEY=<your-openai-key>
ANTHROPIC_API_KEY=<your-anthropic-key>
```

> ⚠️ `ANTHROPIC_API_KEY` ยังว่างอยู่ — ถ้าต้องการใช้ Claude ต้องเพิ่ม key

---

## Docker Compose

```yaml
services:
  paperclip-db:
    image: postgres:17-alpine
    restart: unless-stopped
    environment:
      POSTGRES_USER: paperclip
      POSTGRES_PASSWORD: paperclip
      POSTGRES_DB: paperclip
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U paperclip -d paperclip"]
      interval: 2s
      timeout: 5s
      retries: 30
    volumes:
      - paperclip-pgdata:/var/lib/postgresql/data
    networks:
      - app_net

  paperclip:
    build:
      context: .
      dockerfile: Dockerfile
    restart: unless-stopped
    environment:
      DATABASE_URL: postgres://paperclip:paperclip@paperclip-db:5432/paperclip
      PORT: "3100"
      SERVER_UI: "true"
      PAPERCLIP_DEPLOYMENT_MODE: authenticated
      PAPERCLIP_DEPLOYMENT_EXPOSURE: private
      PAPERCLIP_PUBLIC_URL: ${PAPERCLIP_PUBLIC_URL}
      BETTER_AUTH_SECRET: ${BETTER_AUTH_SECRET}
      PAPERCLIP_TELEMETRY_DISABLED: "1"
      OPENAI_API_KEY: ${OPENAI_API_KEY}
      ANTHROPIC_API_KEY: ${ANTHROPIC_API_KEY}
      DO_NOT_TRACK: "1"
    volumes:
      - paperclip-data:/paperclip
    depends_on:
      paperclip-db:
        condition: service_healthy
    networks:
      - app_net
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.paperclip.rule=Host(`paperclip.srv1637353.hstgr.cloud`)"
      - "traefik.http.routers.paperclip.entrypoints=websecure"
      - "traefik.http.routers.paperclip.tls.certresolver=mytlschallenge"
      - "traefik.http.services.paperclip.loadbalancer.server.port=3100"

volumes:
  paperclip-pgdata:
  paperclip-data:

networks:
  app_net:
    external: true
    name: ai-stack_app_net
```

---

## การติดตั้ง (กรณี VPS ใหม่)

```bash
# 1. Clone หรือ copy โฟลเดอร์
mkdir -p /opt/paperclip
cd /opt/paperclip

# 2. สร้าง .env
cat > .env << 'EOF'
BETTER_AUTH_SECRET=<generate-new-secret>
PAPERCLIP_PUBLIC_URL=https://paperclip.srv1637353.hstgr.cloud
PAPERCLIP_TELEMETRY_DISABLED=1
DO_NOT_TRACK=1
OPENAI_API_KEY=<your-openai-key>
ANTHROPIC_API_KEY=<your-anthropic-key>
EOF

# 3. Start services
docker compose up -d

# 4. ตรวจสอบ
docker ps | grep paperclip
```

---

## Backup & Restore

### Backup
```bash
# Backup database
docker exec paperclip-paperclip-db-1 pg_dump -U paperclip paperclip > /root/backups/paperclip-db.sql

# Backup volumes
docker run --rm \
  -v paperclip_paperclip-data:/data \
  -v /root/backups:/backup \
  alpine tar czf /backup/paperclip-data.tar.gz -C /data .
```

### Restore
```bash
# Restore database
cat /root/backups/paperclip-db.sql | docker exec -i paperclip-paperclip-db-1 psql -U paperclip paperclip

# Restore volumes
docker run --rm \
  -v paperclip_paperclip-data:/data \
  -v /root/backups:/backup \
  alpine sh -c "cd /data && tar xzf /backup/paperclip-data.tar.gz"
```

---

## Troubleshooting

```bash
# ดู logs
docker logs paperclip-paperclip-1 --tail 50
docker logs paperclip-paperclip-db-1 --tail 20

# Restart
cd /opt/paperclip && docker compose restart

# Rebuild (หลังแก้ code)
cd /opt/paperclip && docker compose up -d --build
```

---

## หมายเหตุ

- **`ANTHROPIC_API_KEY` ว่างอยู่** — เพิ่ม key ใน `.env` ถ้าต้องการใช้ Claude features
- Build จาก Dockerfile ใน `/opt/paperclip/` (custom image ไม่ได้ pull จาก registry)
- ใช้ network `ai-stack_app_net` ร่วมกับ n8n, qdrant, lightrag, traefik

---

*อัพเดทล่าสุด: 2026-05-08*
