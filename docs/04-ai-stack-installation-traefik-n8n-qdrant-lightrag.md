# คู่มือติดตั้ง AI Stack: Traefik + n8n + Qdrant + LightRAG

> **เป้าหมาย:** ติดตั้ง 4 containers ที่ทำงานร่วมกัน — Traefik (reverse proxy + SSL), n8n (workflow), Qdrant (vector DB), LightRAG (RAG framework)

---

## ข้อมูลอ้างอิง

- **VPS:** Hostinger Ubuntu 24.04 + Docker
- **Domain:** `srv1637353.hstgr.cloud` (เปลี่ยนตามของคุณ)
- **Project path:** `/opt/ai-stack/`
- **Stack name:** `ai-stack` (ใช้เป็น prefix ของ network และ volumes)

### URL ที่จะได้

| Service | URL |
|---------|-----|
| Traefik | (ฟัง port 80, 443 — auto SSL) |
| n8n | https://n8n.srv1637353.hstgr.cloud |
| Qdrant | https://qdrant.srv1637353.hstgr.cloud |
| LightRAG | https://lightrag.srv1637353.hstgr.cloud |

---

## ภาพรวม Architecture

```
Internet (HTTPS)
      ↓ port 443
   Traefik (reverse proxy + Let's Encrypt SSL)
      ↓ route by Host header
   ┌──────┬────────┬──────────┬──────────┬──────────┐
   ↓      ↓        ↓          ↓          ↓          ↓
  n8n  Qdrant   LightRAG   openclaw   hermes      mt5
       ↑           │
       └───────────┘
       (LightRAG ใช้ Qdrant เป็น vector store)
```

- **Traefik** ใช้ Docker labels ในการ auto-discover service และ route traffic
- **LightRAG depends_on Qdrant** — Qdrant ต้อง start ก่อน
- ทุก service อยู่ใน network `app_net` (ภายนอก Docker เห็นเป็น `ai-stack_app_net`)

---

# Step 1: เตรียม DNS Records

ก่อนติดตั้ง ตั้ง A records ทั้ง 3 ให้ชี้ไป VPS IP:

| Type | Name | Points to |
|------|------|-----------|
| A | `n8n.srv1637353.hstgr.cloud` | `<VPS_IP>` |
| A | `qdrant.srv1637353.hstgr.cloud` | `<VPS_IP>` |
| A | `lightrag.srv1637353.hstgr.cloud` | `<VPS_IP>` |

ตั้งใน hPanel → Domains → `multivps.cloud` → DNS

ตรวจสอบ:
```bash
dig n8n.srv1637353.hstgr.cloud +short
dig qdrant.srv1637353.hstgr.cloud +short
dig lightrag.srv1637353.hstgr.cloud +short
```

---

# Step 2: SSH เข้า VPS

```bash
ssh root@<VPS_IP>
```

---

# Step 3: เตรียมโฟลเดอร์ที่จำเป็น

## 3.1 สร้างโฟลเดอร์ project

```bash
mkdir -p /opt/ai-stack && cd /opt/ai-stack
```

## 3.2 สร้างโฟลเดอร์ Traefik dynamic config

```bash
mkdir -p /root/traefik-config
```

> โฟลเดอร์นี้ Traefik mount เข้าไปสำหรับเพิ่ม middleware/router แบบ dynamic — เริ่มต้นว่างได้

## 3.3 สร้างโฟลเดอร์ shared files สำหรับ n8n

```bash
mkdir -p /local-files
```

> n8n mount โฟลเดอร์นี้ที่ `/files` ภายใน container — ใช้แชร์ไฟล์ระหว่าง host กับ workflows

---

# Step 4: สร้างไฟล์ `.env`

```bash
cat > /opt/ai-stack/.env << 'EOF'
# Domain & SSL
DOMAIN_NAME=srv1637353.hstgr.cloud
GENERIC_TIMEZONE=Asia/Bangkok
SSL_EMAIL=your-email@example.com

# Qdrant
QDRANT_API_KEY=replace_with_your_qdrant_api_key

# LightRAG
LIGHTRAG_API_KEY=replace_with_your_lightrag_api_key
LIGHTRAG_AUTH_ACCOUNTS=admin:ChangeMeStrongPassword!
LIGHTRAG_TOKEN_SECRET=replace_with_a_long_random_secret

# OpenAI / LLM
OPENAI_API_KEY=sk-proj-REPLACE_WITH_YOUR_KEY
LLM_MODEL=gpt-5.4
EMBEDDING_MODEL=text-embedding-3-small
EMBEDDING_DIM=1536
LLM_BINDING_HOST=https://api.phaya.io/v1
EMBEDDING_BINDING_HOST=https://api.phaya.io/v1
EOF
```

## คำอธิบายตัวแปร

| ตัวแปร | คำอธิบาย |
|--------|---------|
| `DOMAIN_NAME` | base domain (subdomain จะถูกเติมหน้าโดย compose: `n8n.${DOMAIN_NAME}`) |
| `GENERIC_TIMEZONE` | timezone ของ n8n |
| `SSL_EMAIL` | email สำหรับ Let's Encrypt — ใช้รับ noti หมดอายุ |
| `QDRANT_API_KEY` | API key สำหรับ Qdrant — ตั้งเองได้ random string |
| `LIGHTRAG_API_KEY` | API key สำหรับ LightRAG (สร้าง random string) |
| `LIGHTRAG_AUTH_ACCOUNTS` | format: `username:password` สำหรับ login web UI |
| `LIGHTRAG_TOKEN_SECRET` | secret สำหรับ JWT token (ต้องเป็น string ยาว random) |
| `OPENAI_API_KEY` | OpenAI API key — ใช้กับทั้ง LLM และ embedding |
| `LLM_MODEL` | LLM model name |
| `EMBEDDING_MODEL` | embedding model |
| `EMBEDDING_DIM` | dimension ของ embedding (text-embedding-3-small = 1536) |
| `LLM_BINDING_HOST` | API endpoint ของ LLM provider |
| `EMBEDDING_BINDING_HOST` | API endpoint ของ embedding provider |

## วิธีสร้าง random secrets

```bash
# สร้าง random API key (32 chars)
openssl rand -hex 32

# สร้าง LIGHTRAG_TOKEN_SECRET (64 chars)
openssl rand -base64 48
```

> ⚠️ **อย่า commit `.env` ลง git** — มี secrets ทั้งหมด

---

# Step 5: สร้างไฟล์ `docker-compose.yml`

```bash
cat > /opt/ai-stack/docker-compose.yml << 'EOF'
services:
  traefik:
    image: traefik:latest
    container_name: traefik
    restart: always
    command:
      - "--providers.docker=true"
      - "--providers.docker.exposedbydefault=false"
      - "--entrypoints.web.address=:80"
      - "--entrypoints.web.http.redirections.entryPoint.to=websecure"
      - "--entrypoints.web.http.redirections.entryPoint.scheme=https"
      - "--entrypoints.websecure.address=:443"
      - "--certificatesresolvers.mytlschallenge.acme.tlschallenge=true"
      - "--certificatesresolvers.mytlschallenge.acme.email=${SSL_EMAIL}"
      - "--certificatesresolvers.mytlschallenge.acme.storage=/letsencrypt/acme.json"
      - "--providers.file.directory=/etc/traefik/dynamic"
      - "--providers.file.watch=true"
    ports:
      - "80:80"
      - "443:443"
    extra_hosts:
      - "host.docker.internal:host-gateway"
    volumes:
      - traefik_data:/letsencrypt
      - /var/run/docker.sock:/var/run/docker.sock:ro
      - /root/traefik-config:/etc/traefik/dynamic:ro
    networks:
      - app_net

  n8n:
    image: docker.n8n.io/n8nio/n8n
    container_name: n8n
    restart: always
    environment:
      - N8N_HOST=n8n.${DOMAIN_NAME}
      - N8N_PORT=5678
      - N8N_PROTOCOL=https
      - NODE_ENV=production
      - WEBHOOK_URL=https://n8n.${DOMAIN_NAME}/
      - GENERIC_TIMEZONE=${GENERIC_TIMEZONE}
      - N8N_PROXY_HOPS=1
    labels:
      - traefik.enable=true
      - traefik.http.routers.n8n.rule=Host(`n8n.${DOMAIN_NAME}`)
      - traefik.http.routers.n8n.entrypoints=websecure
      - traefik.http.routers.n8n.tls=true
      - traefik.http.routers.n8n.tls.certresolver=mytlschallenge
      - traefik.http.middlewares.n8n.headers.SSLRedirect=true
      - traefik.http.middlewares.n8n.headers.STSSeconds=315360000
      - traefik.http.middlewares.n8n.headers.browserXSSFilter=true
      - traefik.http.middlewares.n8n.headers.contentTypeNosniff=true
      - traefik.http.middlewares.n8n.headers.forceSTSHeader=true
      - traefik.http.middlewares.n8n.headers.SSLHost=${DOMAIN_NAME}
      - traefik.http.middlewares.n8n.headers.STSIncludeSubdomains=true
      - traefik.http.middlewares.n8n.headers.STSPreload=true
      - traefik.http.routers.n8n.middlewares=n8n@docker
      - traefik.http.services.n8n.loadbalancer.server.port=5678
    volumes:
      - n8n_data:/home/node/.n8n
      - /local-files:/files
    networks:
      - app_net

  qdrant:
    image: qdrant/qdrant:v1.16.1
    container_name: qdrant
    restart: always
    environment:
      - QDRANT__SERVICE__API_KEY=${QDRANT_API_KEY}
    labels:
      - traefik.enable=true
      - traefik.http.routers.qdrant.rule=Host(`qdrant.${DOMAIN_NAME}`)
      - traefik.http.routers.qdrant.entrypoints=websecure
      - traefik.http.routers.qdrant.tls=true
      - traefik.http.routers.qdrant.tls.certresolver=mytlschallenge
      - traefik.http.services.qdrant.loadbalancer.server.port=6333
    volumes:
      - qdrant_data:/qdrant/storage
    networks:
      - app_net

  lightrag:
    image: ghcr.io/hkuds/lightrag:latest
    container_name: lightrag
    restart: always
    depends_on:
      - qdrant
    environment:
      - LIGHTRAG_API_KEY=${LIGHTRAG_API_KEY}
      - AUTH_ACCOUNTS=${LIGHTRAG_AUTH_ACCOUNTS}
      - TOKEN_SECRET=${LIGHTRAG_TOKEN_SECRET}
      - LLM_BINDING=openai
      - LLM_MODEL=${LLM_MODEL}
      - LLM_BINDING_HOST=${LLM_BINDING_HOST}
      - LLM_BINDING_API_KEY=${OPENAI_API_KEY}
      - EMBEDDING_BINDING=openai
      - EMBEDDING_MODEL=${EMBEDDING_MODEL}
      - EMBEDDING_DIM=${EMBEDDING_DIM}
      - EMBEDDING_BINDING_HOST=${EMBEDDING_BINDING_HOST}
      - EMBEDDING_BINDING_API_KEY=${OPENAI_API_KEY}
      - OPENAI_BASE_URL=${LLM_BINDING_HOST}
      - LIGHTRAG_VECTOR_STORAGE=QdrantVectorDBStorage
      - QDRANT_URL=http://qdrant:6333
      - QDRANT_API_KEY=${QDRANT_API_KEY}
    labels:
      - traefik.enable=true
      - traefik.http.routers.lightrag.rule=Host(`lightrag.${DOMAIN_NAME}`)
      - traefik.http.routers.lightrag.entrypoints=websecure
      - traefik.http.routers.lightrag.tls=true
      - traefik.http.routers.lightrag.tls.certresolver=mytlschallenge
      - traefik.http.services.lightrag.loadbalancer.server.port=9621
    volumes:
      - lightrag_data:/app/data/rag_storage
    networks:
      - app_net

volumes:
  traefik_data:
  n8n_data:
  qdrant_data:
  lightrag_data:

networks:
  app_net:
    driver: bridge
EOF
```

---

# Step 6: ตรวจสอบไฟล์

```bash
ls -la /opt/ai-stack/
```

ต้องเห็น:
```
.env
docker-compose.yml
```

ตรวจ syntax ของ compose:
```bash
cd /opt/ai-stack
docker compose config
```

ถ้าไม่มี error = ใช้ได้

---

# Step 7: รัน Stack

```bash
cd /opt/ai-stack
docker compose up -d
```

จะเห็น Docker pull image ทั้ง 4 ตัว (รวม ~5 GB) ใช้เวลา 3-5 นาที

ตรวจสอบ:
```bash
docker compose ps
```

ต้องเห็น 4 containers รันอยู่: `traefik`, `n8n`, `qdrant`, `lightrag`

---

# Step 8: ตรวจสอบ logs

```bash
# Traefik
docker logs traefik --tail 50

# n8n
docker logs n8n --tail 50

# Qdrant
docker logs qdrant --tail 50

# LightRAG
docker logs lightrag --tail 50
```

ดู logs ของทั้ง stack:
```bash
docker compose logs -f
```

---

# Step 9: รอ SSL Certificate

Traefik ใช้ **TLS Challenge** ขอ cert จาก Let's Encrypt:
- ใช้เวลา 1-2 นาทีแรก
- ต้องเปิด port 443 และ DNS ชี้ถูก
- ตรวจสอบ:

```bash
docker logs traefik | grep -i acme
```

ถ้าสำเร็จจะเห็น `obtained certificate`

---

# Step 10: เข้าใช้งาน

| Service | URL | Login |
|---------|-----|-------|
| n8n | https://n8n.srv1637353.hstgr.cloud | Setup ครั้งแรก (สร้าง owner account) |
| Qdrant | https://qdrant.srv1637353.hstgr.cloud/dashboard | API key ใน `.env` |
| LightRAG | https://lightrag.srv1637353.hstgr.cloud | ตาม `LIGHTRAG_AUTH_ACCOUNTS` |

---

# คำสั่งจัดการ Stack

| ต้องการ | คำสั่ง |
|---------|--------|
| ดู status | `cd /opt/ai-stack && docker compose ps` |
| Start ทั้งหมด | `cd /opt/ai-stack && docker compose up -d` |
| Stop ทั้งหมด | `cd /opt/ai-stack && docker compose down` |
| Restart ทั้งหมด | `cd /opt/ai-stack && docker compose restart` |
| Restart เฉพาะ service | `docker restart n8n` |
| ดู logs ทั้งหมด | `cd /opt/ai-stack && docker compose logs -f` |
| ดู logs เฉพาะ service | `docker logs n8n -f` |
| Recreate (หลังแก้ .env) | `cd /opt/ai-stack && docker compose up -d --force-recreate` |
| Update images | ⚠️ ดู **"การ Update Images อย่างปลอดภัย"** ก่อนรันทุกครั้ง |

---

## การ Update Images อย่างปลอดภัย

> ⚠️ **ห้ามรัน `docker compose pull` โดยตรง** เพราะ Qdrant server อาจ update ไป minor version ใหม่ที่ไม่ compatible กับ qdrant-client ใน LightRAG

### ขั้นตอน

**1. เช็ค qdrant-client version ใน LightRAG ก่อน**

```bash
docker exec lightrag pip show qdrant-client | grep Version
```

ตัวอย่าง output: `Version: 1.15.1`

**2. คำนวณ Qdrant server version ที่รองรับ**

กฎ: major version ต้องเท่ากัน, minor version ต่างกันได้ไม่เกิน 1

| qdrant-client | Qdrant server ที่ใช้ได้ |
|---|---|
| 1.15.x | v1.14.x, v1.15.x, v1.16.x |
| 1.16.x | v1.15.x, v1.16.x, v1.17.x |

**3. Pin version ใน docker-compose.yml**

```yaml
qdrant:
  image: qdrant/qdrant:v1.16.1  # ← pin version ตาม client ที่รองรับ
```

**4. Pull และ recreate**

```bash
cd /opt/ai-stack
docker compose pull qdrant   # pull เฉพาะ qdrant (ถ้าต้องการ update)
docker compose up -d --force-recreate qdrant
docker compose restart lightrag
```

---

# โครงสร้างไฟล์/Volumes ที่สร้างขึ้น

```
/opt/ai-stack/
├── .env                       (secrets, config)
└── docker-compose.yml

/root/traefik-config/          (Traefik dynamic config — เริ่มต้นว่าง)
/local-files/                  (แชร์ไฟล์กับ n8n)

Docker Volumes (managed by Docker):
├── ai-stack_traefik_data      (Let's Encrypt certs)
├── ai-stack_n8n_data          (workflows, credentials, encryption key)
├── ai-stack_qdrant_data       (vector embeddings)
└── ai-stack_lightrag_data     (knowledge graph)

Docker Network:
└── ai-stack_app_net           (bridge — services สื่อสารกันผ่าน network นี้)
```

---

# Troubleshooting

## SSL ออกไม่ได้

```bash
docker logs traefik | grep -i error
```

สาเหตุที่พบบ่อย:
- DNS ยังไม่ propagate
- Port 443 ถูก block (firewall)
- Email format ผิดใน `SSL_EMAIL`

## n8n เปิดไม่ได้

```bash
docker logs n8n --tail 100
```

ถ้าเห็น error เกี่ยวกับ encryption key:
```bash
# ตรวจสอบ permissions
docker exec n8n ls -la /home/node/.n8n
```

## LightRAG upload documents show "Failed"

สาเหตุ: qdrant-client ใน LightRAG image (v1.15.x) ไม่ compatible กับ Qdrant server version ใหม่กว่า (minor version ต่างกันเกิน 1)
- ใช้ `qdrant/qdrant:v1.16.1` (pin version) แทน `latest` เสมอ
- ห้าม `docker compose pull` ถ้า LightRAG image ยังเป็น version เดิม เพราะ Qdrant server จะ update แต่ client ใน LightRAG ไม่ตาม

## LightRAG fail to start

```bash
docker logs lightrag --tail 100
```

- ตรวจ Qdrant พร้อมหรือยัง: `docker logs qdrant`
- ตรวจ OpenAI API key valid: `curl -H "Authorization: Bearer $OPENAI_API_KEY" https://api.openai.com/v1/models`

## Container restart วน

```bash
docker compose ps
docker logs <container_name> --tail 100
```

ดู exit code และ error message

## Disk เต็ม

```bash
docker system df
docker system prune       # ปลอดภัย — ลบเฉพาะที่ไม่ใช้
```

---

# Security Best Practices

1. **เปลี่ยน secrets ทั้งหมดใน `.env`** ก่อนเริ่มใช้งาน
2. **ใช้รหัสผ่านยาว** สำหรับ `LIGHTRAG_AUTH_ACCOUNTS`
3. **เปิด firewall** เปิดเฉพาะ port 22, 80, 443
4. **อย่า expose port** ของ qdrant/lightrag/n8n ตรง — ใช้ผ่าน Traefik เท่านั้น
5. **Backup volumes** เป็นประจำ — โดยเฉพาะ `n8n_data` (มี encryption key)
6. **Rotate API keys** เป็นระยะ
7. **Monitor logs** ของ Traefik หาความพยายาม brute force

---

# สั่ง Backup ทั้ง stack

```bash
mkdir -p /root/backup
cd /opt/ai-stack
docker compose down

for vol in ai-stack_traefik_data ai-stack_n8n_data ai-stack_qdrant_data ai-stack_lightrag_data; do
  docker run --rm \
    -v $vol:/data \
    -v /root/backup:/backup \
    alpine tar czf /backup/$vol.tar.gz -C /data .
done

tar czf /root/backup/ai-stack-config.tar.gz -C /opt ai-stack
docker compose up -d
```

> ดูคู่มือย้าย VPS ฉบับสมบูรณ์ใน `01-migrate-docker-stack-to-new-vps.md`
