# คู่มือติดตั้ง OpenClaw + LINE + Telegram บน Hostinger VPS

> **เป้าหมาย:** ติดตั้ง OpenClaw AI assistant gateway พร้อม LINE และ Telegram channels หลังบ้าน Traefik (HTTPS) สำหรับใช้เป็น customer service bot

---

## ข้อมูลอ้างอิง

- **VPS:** Hostinger Ubuntu 24.04 + Docker + Traefik
- **IP:** `72.62.64.163`
- **Domain:** `srv1637353.hstgr.cloud`
- **URL:** `https://openclaw.srv1637353.hstgr.cloud`
- **Project:** `/opt/openclaw/`
- **Image:** `ghcr.io/openclaw/openclaw:latest`
- **Network:** `ai-stack_app_net` (ใช้ร่วมกับ Traefik)
- **Volume:** `openclaw_openclaw_data`
- **Container name:** `openclaw`

---

## ภาพรวม Architecture

```
ลูกค้า (LINE / Telegram)
        ↓
Internet HTTPS port 443
        ↓
Hostinger Firewall (allow 80, 443)
        ↓
Traefik (reverse proxy + Let's Encrypt SSL)
        ↓
openclaw container (port 18789)
   ├── Telegram channel (long polling)
   └── LINE channel (webhook → /line/webhook)
        ↓
LLM (OpenRouter / OpenAI / Gemini)
```

---

# Phase 1: เตรียม Prerequisites

## 1.1 API Keys (เตรียมล่วงหน้าบนเครื่อง Windows)

| # | ค่า | ขอที่ |
|---|-----|-------|
| 1 | OpenAI API key | https://platform.openai.com/api-keys |
| 2 | OpenRouter API key | https://openrouter.ai/keys |
| 3 | Gemini API key | https://aistudio.google.com/app/apikey |
| 4 | Telegram Bot token | https://t.me/BotFather → `/newbot` |
| 5 | LINE Channel access token + secret | https://developers.line.biz/console/ → Messaging API |

> เก็บใน Notepad/Password manager — จะใช้ใน Phase 4

## 1.2 DNS Record

เพิ่ม A record ที่ Hostinger DNS (`multivps.cloud`):

| Type | Name | Points to | TTL |
|------|------|-----------|-----|
| A | `openclaw.srv1637353.hstgr.cloud` | `72.62.64.163` | 14400 |

---

# Phase 2: SSH + เตรียมโฟลเดอร์

## 2.1 SSH

```bash
ssh root@72.62.64.163
```

## 2.2 สร้างโฟลเดอร์

```bash
mkdir -p /opt/openclaw && cd /opt/openclaw
```

## 2.3 Generate Gateway Token

```bash
openssl rand -hex 32
```

**คัดลอก output 64-char เก็บไว้** (เรียกว่า `<GATEWAY_TOKEN>`)

---

# Phase 3: สร้างไฟล์ Config

## 3.1 สร้าง `.env` (โครงสร้าง multi-account)

> ใช้ pattern `ACCOUNT1/2/3_*` รองรับการเพิ่มบัญชีในอนาคต

```bash
cat > /opt/openclaw/.env << 'EOF'
# ============ Models ============
OPENCLAW_PRIMARY_MODEL=openrouter/google/gemini-2.5-flash
OPENCLAW_FALLBACK_MODEL=openrouter/anthropic/claude-sonnet-4-6

# ============ Gateway ============
OPENCLAW_GATEWAY_TOKEN=REPLACE_WITH_GATEWAY_TOKEN

# ============ Provider API Keys ============
OPENAI_API_KEY=REPLACE_WITH_OPENAI_KEY
OPENROUTER_API_KEY=REPLACE_WITH_OPENROUTER_KEY
GEMINI_API_KEY=REPLACE_WITH_GEMINI_KEY

# ============ Account 1: FastBuilt-48hr ============
ACCOUNT1_NAME=FastBuilt-48hr
ACCOUNT1_TELEGRAM_BOT_TOKEN=REPLACE_WITH_TELEGRAM_TOKEN
ACCOUNT1_LINE_CHANNEL_ACCESS_TOKEN=REPLACE_WITH_LINE_ACCESS_TOKEN
ACCOUNT1_LINE_CHANNEL_SECRET=REPLACE_WITH_LINE_SECRET

# ============ Account 2: (รอเพิ่ม) ============
ACCOUNT2_NAME=Knightfurinch-Knightfurnich
ACCOUNT2_TELEGRAM_BOT_TOKEN=
ACCOUNT2_LINE_CHANNEL_ACCESS_TOKEN=
ACCOUNT2_LINE_CHANNEL_SECRET=

# ============ Account 3: (รอเพิ่ม) ============
ACCOUNT3_NAME=NopAssistant-Openclaw
ACCOUNT3_TELEGRAM_BOT_TOKEN=
ACCOUNT3_LINE_CHANNEL_ACCESS_TOKEN=
ACCOUNT3_LINE_CHANNEL_SECRET=
EOF
```

แก้ไขค่าจริง:

```bash
nano /opt/openclaw/.env
```

(ใช้ Ctrl+O save, Ctrl+X exit)

ตรวจสอบไม่มี `REPLACE_` เหลือ:

```bash
grep "REPLACE_" /opt/openclaw/.env
```

ต้อง **ไม่มี output** = OK

## 3.2 สร้าง `docker-compose.yml`

```bash
cat > /opt/openclaw/docker-compose.yml << 'EOF'
services:
  openclaw:
    image: ghcr.io/openclaw/openclaw:latest
    container_name: openclaw
    restart: always
    user: root
    networks:
      - ai-stack_app_net
    volumes:
      - openclaw_openclaw_data:/root/.openclaw
    command:
      - node
      - openclaw.mjs
      - gateway
      - --port
      - "18789"
      - --verbose
    labels:
      - "traefik.enable=true"
      - "traefik.docker.network=ai-stack_app_net"
      - "traefik.http.routers.openclaw.rule=Host(`openclaw.srv1637353.hstgr.cloud`)"
      - "traefik.http.routers.openclaw.entrypoints=websecure"
      - "traefik.http.routers.openclaw.tls=true"
      - "traefik.http.routers.openclaw.tls.certresolver=mytlschallenge"
      - "traefik.http.services.openclaw.loadbalancer.server.port=18789"

volumes:
  openclaw_openclaw_data:
    external: true

networks:
  ai-stack_app_net:
    external: true
EOF
```

> หมายเหตุ:
> - ใช้ `user: root` เพื่อให้เขียน config ได้
> - `bind: lan` ถูกตั้งใน onboard step
> - Volume `openclaw_openclaw_data` เป็น external — สร้างจาก onboard step

---

# Phase 4: Onboard (Generate Base Config)

## 4.1 Pull image

```bash
docker pull ghcr.io/openclaw/openclaw:latest
```

## 4.2 Run onboard non-interactive

```bash
cd /opt/openclaw
set -a && . ./.env && set +a

docker run --rm --user root \
  -v openclaw_openclaw_data:/root/.openclaw \
  ghcr.io/openclaw/openclaw:latest \
  node openclaw.mjs onboard \
    --non-interactive \
    --accept-risk \
    --mode local \
    --flow quickstart \
    --gateway-bind lan \
    --gateway-port 18789 \
    --gateway-auth token \
    --gateway-token "$OPENCLAW_GATEWAY_TOKEN" \
    --auth-choice openrouter-api-key \
    --openrouter-api-key "$OPENROUTER_API_KEY" \
    --openai-api-key "$OPENAI_API_KEY" \
    --gemini-api-key "$GEMINI_API_KEY" \
    --no-install-daemon \
    --skip-channels \
    --skip-skills \
    --skip-search \
    --skip-ui \
    --skip-health \
    --secret-input-mode plaintext 2>&1
```

ผลลัพธ์ที่ต้องเห็น:
```
Updated ~/.openclaw/openclaw.json
Workspace OK: ~/.openclaw/workspace
Sessions OK: ~/.openclaw/agents/main/sessions
```

> ⚠️ **สำคัญ:** อย่ารัน `docker compose down -v` หรือ `docker volume rm openclaw_openclaw_data` หลัง onboard — จะลบ config ทิ้ง

## 4.3 ตรวจ config ที่ generate

```bash
docker run --rm --user root \
  -v openclaw_openclaw_data:/root/.openclaw \
  ghcr.io/openclaw/openclaw:latest \
  cat /root/.openclaw/openclaw.json
```

---

# Phase 5: Start Container + Enable Plugins

## 5.1 Start container

```bash
cd /opt/openclaw
docker compose up -d
docker logs openclaw --tail 30
```

ตรวจว่า gateway start สำเร็จ — ต้องเห็น `gateway ready`

## 5.2 ตรวจ HTTPS routing

```bash
curl -I https://openclaw.srv1637353.hstgr.cloud
```

ต้องได้ `HTTP/2 200`

## 5.3 Enable telegram + line plugins

```bash
docker exec openclaw node openclaw.mjs plugins enable telegram
docker exec openclaw node openclaw.mjs plugins enable line
```

## 5.4 Restart container

```bash
docker restart openclaw && sleep 5
```

## 5.5 ตรวจ plugins enabled

```bash
docker exec openclaw node openclaw.mjs plugins list 2>&1 | grep -iE "(telegram|line)"
```

ต้องเห็นทั้ง 2 ตัวเป็น `enabled`

---

# Phase 6: Add Channels (Account 1)

## 6.1 Source .env

```bash
cd /opt/openclaw && set -a && . .env && set +a
```

## 6.2 Add Telegram

```bash
docker exec openclaw node openclaw.mjs channels add \
  --channel telegram \
  --account fastbuilt-48hr \
  --token "$ACCOUNT1_TELEGRAM_BOT_TOKEN" \
  --name "$ACCOUNT1_NAME"
```

ผล: `Added Telegram account "fastbuilt-48hr".`

## 6.3 Add LINE (สำคัญ — pattern แตกต่าง!)

> ⚠️ LINE plugin **ไม่ยอมรับ `--token` หรือ `--secret`** — ต้องใช้ `--token-file`/`--secret-file` แล้วเปลี่ยนเป็น plaintext ทีหลัง

### 6.3.1 เขียน token + secret ลง temp file

```bash
echo -n "$ACCOUNT1_LINE_CHANNEL_ACCESS_TOKEN" | docker exec -i openclaw sh -c 'cat > /tmp/line-token.txt && chmod 600 /tmp/line-token.txt'
echo -n "$ACCOUNT1_LINE_CHANNEL_SECRET" | docker exec -i openclaw sh -c 'cat > /tmp/line-secret.txt && chmod 600 /tmp/line-secret.txt'
```

### 6.3.2 Add LINE

```bash
docker exec openclaw node openclaw.mjs channels add \
  --channel line \
  --account fastbuilt-48hr \
  --token-file /tmp/line-token.txt \
  --secret-file /tmp/line-secret.txt \
  --name "$ACCOUNT1_NAME"
```

### 6.3.3 ลบ temp file

```bash
docker exec openclaw rm -f /tmp/line-token.txt /tmp/line-secret.txt
```

### 6.3.4 แก้ config เป็น plaintext (จำเป็น เพราะ /tmp หายเมื่อ restart)

```bash
docker exec openclaw node openclaw.mjs config set \
  "channels.line.accounts.fastbuilt-48hr.channelAccessToken" "$ACCOUNT1_LINE_CHANNEL_ACCESS_TOKEN"

docker exec openclaw node openclaw.mjs config set \
  "channels.line.accounts.fastbuilt-48hr.channelSecret" "$ACCOUNT1_LINE_CHANNEL_SECRET"

docker exec openclaw node openclaw.mjs config unset \
  "channels.line.accounts.fastbuilt-48hr.tokenFile"

docker exec openclaw node openclaw.mjs config unset \
  "channels.line.accounts.fastbuilt-48hr.secretFile"

docker exec openclaw node openclaw.mjs config set \
  "channels.line.accounts.fastbuilt-48hr.name" "$ACCOUNT1_NAME"
```

## 6.4 Restart + Verify

```bash
docker restart openclaw && sleep 5
docker exec openclaw node openclaw.mjs channels list
```

ต้องเห็น:

```
✅ Telegram fastbuilt-48hr (FastBuilt-48hr): configured, token=config, enabled
✅ LINE fastbuilt-48hr (FastBuilt-48hr): configured, token=config, enabled
```

---

# Phase 7: Setup LINE Webhook

ที่ **LINE Developers Console** → channel ของคุณ → tab **Messaging API**:

1. **Webhook URL:**
   ```
   https://openclaw.srv1637353.hstgr.cloud/line/webhook
   ```
2. กด **Update** → กด **Verify** (ต้องเห็น "Success")
3. **Use webhook:** เปิด ON
4. **Auto-reply messages:** ปิด OFF (ป้องกัน LINE auto-reply ชนกับ bot)
5. **Greeting messages:** ตั้งตามต้องการ

---

# Phase 8: ทดสอบ

## 8.1 Telegram

1. ค้นหา bot ใน Telegram (ตาม username ที่ตั้งกับ BotFather)
2. ส่งข้อความ `สวัสดี`
3. bot จะตอบกลับพร้อม **Pairing code** (ครั้งแรกที่ user ใหม่ใช้งาน — ถ้า dmPolicy=pairing)
4. Approve บน VPS:
   ```bash
   docker exec openclaw node openclaw.mjs pairing approve telegram <CODE>
   ```

> ⚠️ ถ้าต้องการให้ลูกค้าใหม่ใช้งานได้เลยโดยไม่ต้อง approve ดู Phase 8.3

## 8.2 LINE

1. LINE Console → tab Messaging API → scan QR code "Add friend"
2. Add bot เป็นเพื่อน
3. ส่งข้อความ `สวัสดี`
4. bot จะตอบกลับพร้อม **Pairing code**
5. Approve บน VPS:
   ```bash
   docker exec openclaw node openclaw.mjs pairing approve line <CODE>
   ```

## 8.3 dmPolicy — ความหมายจริง (สำคัญ!)

> ⚠️ **ค้นพบจากการทดสอบจริง:** `dmPolicy: open` **ไม่ได้แปลว่า "เปิดให้ทุกคน"** อย่างที่ชื่อบอก

| dmPolicy | พฤติกรรมจริง |
|----------|--------------|
| `pairing` | User ใหม่ส่งข้อความ → bot ตอบ pairing code → owner approve → คุยได้ ✅ **เหมาะ customer bot** |
| `open` | เฉพาะ user ใน `allowFrom` list คุยได้ทันที (ไม่ต้อง pair) — **คนนอก list ถูก block เงียบ** |
| `allowlist` | เหมือน `open` แต่ explicit (block คนนอก list) |
| `disabled` | ปิด DM ทั้งหมด |

**สำหรับ customer service bot (จำนวนลูกค้ามาก ไม่รู้จักล่วงหน้า) → ใช้ `pairing`**

```bash
docker exec openclaw node openclaw.mjs config set "channels.telegram.accounts.<account-id>.dmPolicy" "pairing"
docker exec openclaw node openclaw.mjs config set "channels.line.accounts.<account-id>.dmPolicy" "pairing"
docker restart openclaw && sleep 5
```

**สำหรับ internal team (รู้จัก users ทั้งหมด) → ใช้ `open` + `allowFrom`**

```bash
docker exec openclaw node openclaw.mjs config set \
  "channels.telegram.accounts.<account-id>.dmPolicy" "open"

docker exec openclaw node openclaw.mjs config set \
  "channels.telegram.accounts.<account-id>.allowFrom" \
  '["TELEGRAM_USER_ID_1","TELEGRAM_USER_ID_2"]'

docker restart openclaw && sleep 5
```

> 💡 OpenClaw ไม่มี wildcard `["*"]` — ต้องระบุ user ID แต่ละคน

---

# Phase 8B: ตั้งค่า Web UI (Control UI)

> Web UI อยู่ที่ `https://openclaw.srv1637353.hstgr.cloud` — ใช้จัดการ bot, ดู sessions, แก้ config ผ่านหน้าเว็บ

## 8B.1 เปิด Web UI ให้เข้าได้จาก HTTPS

ค่า default อนุญาตแค่ `localhost` — ต้องเพิ่ม HTTPS URL:

```bash
docker exec openclaw node openclaw.mjs config set \
  "gateway.controlUi.allowedOrigins" \
  '["http://localhost:18789","http://127.0.0.1:18789","https://openclaw.srv1637353.hstgr.cloud"]'

docker restart openclaw && sleep 5
```

## 8B.2 ปิด Device Pairing ของ Web UI (ใช้ token แทน)

ค่า default ทุก browser ใหม่ต้องผ่าน device pairing ก่อน — เปลี่ยนให้ใครที่รู้ gateway token เข้าได้เลย:

```bash
docker exec openclaw node openclaw.mjs config set \
  "gateway.controlUi.dangerouslyDisableDeviceAuth" true

docker restart openclaw && sleep 5
```

> ⚠️ ชื่อ key มีคำว่า `dangerously` แต่ปลอดภัยได้เพราะมี HTTPS + gateway token protect อยู่แล้ว

## 8B.3 ตรวจสอบ config

```bash
docker exec openclaw node openclaw.mjs config get "gateway.controlUi" 2>&1
```

ต้องเห็น:
```json
{
  "allowedOrigins": [
    "http://localhost:18789",
    "http://127.0.0.1:18789",
    "https://openclaw.srv1637353.hstgr.cloud"
  ],
  "dangerouslyDisableDeviceAuth": true
}
```

## 8B.4 วิธีเข้า Web UI

1. เปิด browser → `https://openclaw.srv1637353.hstgr.cloud`
2. ใส่ gateway token (64-char hex จาก `.env`)
3. เข้าได้เลย — ไม่ต้อง device pairing

---

# Phase 9: เพิ่ม Account ใหม่ในอนาคต

## 9.1 เพิ่ม Account 2

แก้ `.env` ใส่ค่าให้ `ACCOUNT2_*`:

```bash
nano /opt/openclaw/.env
```

Reload + add channels:

```bash
cd /opt/openclaw && set -a && . .env && set +a

# Telegram
docker exec openclaw node openclaw.mjs channels add \
  --channel telegram \
  --account knightfurnich \
  --token "$ACCOUNT2_TELEGRAM_BOT_TOKEN" \
  --name "$ACCOUNT2_NAME"

# LINE - ใช้ pattern เดียวกับ 6.3
echo -n "$ACCOUNT2_LINE_CHANNEL_ACCESS_TOKEN" | docker exec -i openclaw sh -c 'cat > /tmp/line-token.txt'
echo -n "$ACCOUNT2_LINE_CHANNEL_SECRET" | docker exec -i openclaw sh -c 'cat > /tmp/line-secret.txt'

docker exec openclaw node openclaw.mjs channels add \
  --channel line \
  --account knightfurnich \
  --token-file /tmp/line-token.txt \
  --secret-file /tmp/line-secret.txt \
  --name "$ACCOUNT2_NAME"

docker exec openclaw rm -f /tmp/line-token.txt /tmp/line-secret.txt

# แก้ LINE เป็น plaintext
docker exec openclaw node openclaw.mjs config set "channels.line.accounts.knightfurnich.channelAccessToken" "$ACCOUNT2_LINE_CHANNEL_ACCESS_TOKEN"
docker exec openclaw node openclaw.mjs config set "channels.line.accounts.knightfurnich.channelSecret" "$ACCOUNT2_LINE_CHANNEL_SECRET"
docker exec openclaw node openclaw.mjs config unset "channels.line.accounts.knightfurnich.tokenFile"
docker exec openclaw node openclaw.mjs config unset "channels.line.accounts.knightfurnich.secretFile"

docker restart openclaw
```

ทำเหมือนกันสำหรับ Account 3 (`ACCOUNT3_*`, `--account nopassistant`)

---

# คำสั่งจัดการ OpenClaw (Quick Reference) 🛠️

> **โน้ต:** คำสั่งทั้งหมดในนี้ต้องรันบน VPS หลัง SSH เข้าไปแล้ว (`ssh root@72.62.64.163`)
> Pattern หลัก: `docker exec openclaw node openclaw.mjs <command>` = สั่งงาน OpenClaw CLI ภายใน container

---

## 🔧 หมวด 1: Container Lifecycle (จัดการ Docker)

| งาน | คำสั่ง | คำอธิบาย |
|-----|--------|----------|
| ดู status | `docker ps \| grep openclaw` | ดูว่า container รันอยู่ไหม + uptime |
| ดู status (ละเอียด) | `docker inspect openclaw --format '{{.State.Status}} ({{.State.Health.Status}})'` | แสดง state + health (running/healthy) |
| ดู logs แบบ follow | `docker logs openclaw -f` | ดู logs สด ๆ (Ctrl+C เพื่อออก) — ใช้ตอน debug |
| ดู logs ย้อนหลัง 30 บรรทัด | `docker logs openclaw --tail 30` | ดู logs ล่าสุดเร็ว ๆ |
| ดู logs เฉพาะ error | `docker logs openclaw 2>&1 \| grep -iE "(error\|fail\|warn)"` | กรองเฉพาะ error/warning |
| Restart container | `docker restart openclaw && sleep 5` | รีบูต container — ใช้หลังแก้ config |
| Stop | `cd /opt/openclaw && docker compose down` | หยุด container (config + data ยังอยู่) |
| Start | `cd /opt/openclaw && docker compose up -d` | สั่งให้รันใหม่ในโหมด background |
| ดูการใช้ resource | `docker stats openclaw --no-stream` | แสดง CPU/RAM/Network ปัจจุบัน |
| เข้า shell ใน container | `docker exec -it openclaw bash` | เข้าไปทำงานใน container (debug ลึก) |
| Update image ใหม่ | `cd /opt/openclaw && docker pull ghcr.io/openclaw/openclaw:latest && docker compose up -d` | ดึง image ใหม่ + recreate (config คงอยู่) |

> ⚠️ **ห้ามรัน:** `docker compose down -v` หรือ `docker volume rm openclaw_openclaw_data` — จะลบ config + chat sessions ทิ้ง

---

## 📡 หมวด 2: Channels (จัดการ Telegram / LINE / Discord)

| งาน | คำสั่ง | คำอธิบาย |
|-----|--------|----------|
| ดู channels ทั้งหมด | `docker exec openclaw node openclaw.mjs channels list` | แสดง bot ทุกตัวพร้อมสถานะ (configured/enabled) |
| ดู channel status (real-time) | `docker exec openclaw node openclaw.mjs channels status` | แสดงว่า bot online ไหม + ข้อความที่ผ่านมา |
| ดู config channel ทั้งหมด | `docker exec openclaw node openclaw.mjs config get "channels.telegram.accounts.<id>"` | ดู config ของ Telegram bot ตัวเดียว |
| ดู config LINE | `docker exec openclaw node openclaw.mjs config get "channels.line.accounts.<id>"` | ดู config ของ LINE bot ตัวเดียว |
| Disable channel ชั่วคราว | `docker exec openclaw node openclaw.mjs config set "channels.telegram.accounts.<id>.enabled" false` | ปิด bot โดยไม่ลบ config |
| Enable channel | `docker exec openclaw node openclaw.mjs config set "channels.telegram.accounts.<id>.enabled" true` | เปิด bot กลับ |
| ลบ channel | `docker exec openclaw node openclaw.mjs config unset "channels.telegram.accounts.<id>"` | ลบ bot ออกถาวร (ทำหลังจาก stop ก่อน) |

**ตัวอย่าง output `channels list` ที่ควรเห็น:**
```
✅ Telegram fastbuilt-48hr (FastBuilt-48hr): configured, token=config, enabled
✅ LINE fastbuilt-48hr (FastBuilt-48hr): configured, token=config, enabled
```

> หาก `not configured` แสดงว่า token ไม่อยู่ใน config — ดู Troubleshooting

---

## 🔌 หมวด 3: Plugins (เปิด/ปิด ความสามารถ)

| งาน | คำสั่ง | คำอธิบาย |
|-----|--------|----------|
| ดู plugins ทั้งหมด | `docker exec openclaw node openclaw.mjs plugins list` | แสดง plugins + สถานะ enabled/disabled |
| ดูเฉพาะที่ enabled | `docker exec openclaw node openclaw.mjs plugins list 2>&1 \| grep -i enabled` | กรองเฉพาะที่เปิดอยู่ |
| Enable plugin | `docker exec openclaw node openclaw.mjs plugins enable <name>` | เปิดใช้งาน (ต้อง restart หลังเปิด) |
| Disable plugin | `docker exec openclaw node openclaw.mjs plugins disable <name>` | ปิดใช้งาน |

**Plugins สำคัญ:**

| Plugin | หน้าที่ |
|--------|---------|
| `telegram` | Telegram channel — **ต้องเปิด** ถ้าใช้ Telegram |
| `line` | LINE channel — **ต้องเปิด** ถ้าใช้ LINE |
| `openrouter` | OpenRouter LLM provider — **ต้องเปิด** ถ้าใช้ OpenRouter |
| `memory-core` | บอทจำ context การสนทนา (default ON) |
| `talk-voice` | รองรับ voice message |
| `browser` | บอทเปิดหน้าเว็บได้ |
| `file-transfer` | บอทรับ-ส่งไฟล์ได้ |

---

## ⚙️ หมวด 4: Config (อ่าน/แก้ openclaw.json)

| งาน | คำสั่ง | คำอธิบาย |
|-----|--------|----------|
| ดู config file ทั้งไฟล์ | `docker exec --user root openclaw cat /root/.openclaw/openclaw.json` | ดู JSON ทั้งหมด (token redacted) |
| ดู config file (เฉพาะส่วน) | `docker exec --user root openclaw cat /root/.openclaw/openclaw.json \| jq '.channels'` | ใช้ jq filter เฉพาะส่วน |
| Get value | `docker exec openclaw node openclaw.mjs config get "<dot.path>"` | อ่านค่าตาม dot path |
| Set value | `docker exec openclaw node openclaw.mjs config set "<dot.path>" "<value>"` | ตั้งค่า (auto-backup .bak) |
| Unset value | `docker exec openclaw node openclaw.mjs config unset "<dot.path>"` | ลบ key ออก |
| ดู file path | `docker exec openclaw node openclaw.mjs config file` | บอก path config ที่ active |
| ดู schema (JSON) | `docker exec openclaw node openclaw.mjs config schema` | ดู valid keys ทั้งหมด (ใหญ่มาก) |
| ค้น schema | `docker exec openclaw node openclaw.mjs config schema 2>&1 \| grep -A2 "<keyword>"` | ค้นหา key ใน schema |
| Validate config | `docker exec openclaw node openclaw.mjs config validate` | ตรวจว่า config ถูกต้องตาม schema |
| Backup config | `docker exec --user root openclaw cp /root/.openclaw/openclaw.json /root/.openclaw/openclaw.json.backup-$(date +%Y%m%d)` | สำรองก่อนแก้ใหญ่ |

**Config paths ที่ใช้บ่อย:**

| Path | ความหมาย | ค่าตัวอย่าง |
|------|----------|------------|
| `agents.defaults.model.primary` | LLM model หลัก | `openrouter/google/gemini-2.5-flash` |
| `agents.defaults.workspace` | โฟลเดอร์ workspace | `/root/.openclaw/workspace` |
| `gateway.port` | Port ที่ gateway listen | `18789` |
| `gateway.bind` | Network binding | `lan` / `localhost` |
| `gateway.auth.token` | Token ของ gateway | (64-char hex) |
| `channels.telegram.enabled` | เปิด/ปิด Telegram โดยรวม | `true` / `false` |
| `channels.telegram.accounts.<id>.enabled` | เปิด/ปิด bot ตัวเดียว | `true` / `false` |
| `channels.telegram.accounts.<id>.botToken` | Telegram bot token | (จาก BotFather) |
| `channels.telegram.accounts.<id>.dmPolicy` | นโยบาย DM | `open` / `pairing` |
| `channels.telegram.accounts.<id>.groupPolicy` | นโยบายกรุ๊ป | `open` / `allowlist` |
| `channels.telegram.accounts.<id>.name` | ชื่อ display | `FastBuilt-48hr` |
| `channels.line.accounts.<id>.channelAccessToken` | LINE access token | (จาก LINE Console) |
| `channels.line.accounts.<id>.channelSecret` | LINE channel secret | (จาก LINE Console) |
| `channels.line.accounts.<id>.dmPolicy` | นโยบาย DM | `open` / `pairing` |
| `plugins.entries.<name>.enabled` | เปิด/ปิด plugin | `true` / `false` |
| `session.dmScope` | ขอบเขต session DM | `per-channel-peer` |
| `tools.profile` | Tool profile | `coding` / `assistant` |
| `commands.ownerAllowFrom` | User ที่อนุญาต admin commands | `["telegram:7843550069"]` |
| `gateway.controlUi.allowedOrigins` | Origins ที่เข้า Web UI ได้ | `["https://openclaw.srv1637353.hstgr.cloud"]` |
| `gateway.controlUi.dangerouslyDisableDeviceAuth` | ปิด device pairing ของ Web UI | `true` |

---

## 🖥️ หมวด 5: Web UI / Devices (Control Panel)

> Web UI = หน้าเว็บจัดการ OpenClaw ที่ `https://openclaw.srv1637353.hstgr.cloud`

| งาน | คำสั่ง | คำอธิบาย |
|-----|--------|----------|
| ดู devices ที่ pending/paired | `docker exec openclaw node openclaw.mjs devices list` | รายการ browser/device ที่รอ approve |
| Approve device | `docker exec openclaw node openclaw.mjs devices approve <requestId>` | อนุมัติ device ให้เข้า Web UI ได้ |
| Reject device | `docker exec openclaw node openclaw.mjs devices reject <requestId>` | ปฏิเสธ device |
| ลบ device ที่ paired แล้ว | `docker exec openclaw node openclaw.mjs devices remove <deviceId>` | kick device ออก |
| ล้าง devices ทั้งหมด | `docker exec openclaw node openclaw.mjs devices clear` | ⚠️ ล้าง paired devices ทุกตัว |
| เปิด Web UI โดยไม่ต้อง pairing | `docker exec openclaw node openclaw.mjs config set "gateway.controlUi.dangerouslyDisableDeviceAuth" true` | ใครรู้ token เข้าได้เลย |

**Workflow เมื่อ browser ใหม่เข้า Web UI (กรณี dangerouslyDisableDeviceAuth=false):**
```
1. เปิด https://openclaw.srv1637353.hstgr.cloud → ใส่ token
2. หน้าจอแสดง "device pairing required (requestId: xxxx-xxxx)"
3. รันบน VPS: docker exec openclaw node openclaw.mjs devices approve <requestId>
4. Refresh browser → เข้าได้
```

> 💡 ถ้าต้องการให้ทุก browser เข้าได้ด้วย token เพียงอย่างเดียว ใช้ `dangerouslyDisableDeviceAuth: true`

---

## 🔐 หมวด 7: Pairing (จัดการ User Access)

> ใช้เมื่อ `dmPolicy=pairing` — ทุก user ใหม่ต้องถูก approve ก่อน chat ได้

| งาน | คำสั่ง | คำอธิบาย |
|-----|--------|----------|
| Approve Telegram user | `docker exec openclaw node openclaw.mjs pairing approve telegram <CODE>` | อนุมัติ user (CODE 8 ตัวอักษร) |
| Approve LINE user | `docker exec openclaw node openclaw.mjs pairing approve line <CODE>` | อนุมัติ user LINE |
| ดู approved Telegram | `docker exec --user root openclaw cat /root/.openclaw/credentials/telegram-<account-id>-allowFrom.json` | รายการ user ID ที่ approve แล้ว |
| ดู approved LINE | `docker exec --user root openclaw cat /root/.openclaw/credentials/line-<account-id>-allowFrom.json` | รายการ user LINE ID |
| ดู approved owners (commands) | `docker exec openclaw node openclaw.mjs config get "commands.ownerAllowFrom"` | คนที่รัน admin commands ได้ |
| ลบ approval ของ user | ลบไฟล์ใน `credentials/` + unset `commands.ownerAllowFrom` | ดูหัวข้อ "ลบ approval" ด้านล่าง |

**สำคัญ — Approved senders เก็บใน 2 ที่:**

| ที่เก็บ | ใช้เพื่อ |
|---------|---------|
| `/root/.openclaw/credentials/<channel>-<account>-allowFrom.json` | Routing chat — ตัดสินว่า user คนนี้คุยได้ไหม |
| `commands.ownerAllowFrom` ใน `openclaw.json` | สิทธิ์ admin commands (เช่น `/pair`, `/voice`) |

**คำสั่ง `pairing approve <channel> <code>` จะอัปเดตทั้ง 2 ที่อัตโนมัติ**

**Workflow ของ Pairing (เมื่อ dmPolicy=pairing):**

```
1. User ใหม่ส่งข้อความหา bot ครั้งแรก
2. Bot ตอบ: "OpenClaw: access not configured.
            Your userId: ...
            Pairing code: ABC12XYZ
            Ask owner to approve with: openclaw pairing approve <channel> ABC12XYZ"
3. Owner รัน: docker exec openclaw node openclaw.mjs pairing approve <channel> ABC12XYZ
4. User ส่งข้อความใหม่ → bot ตอบปกติ
```

**ลบ approval (กรณีต้องการ revoke user):**

```bash
# 1. ดู allowFrom file ปัจจุบัน
docker exec --user root openclaw cat /root/.openclaw/credentials/telegram-fastbuilt-48hr-allowFrom.json

# 2. แก้ไฟล์เอาเฉพาะ user ID ที่จะลบออก
docker exec --user root openclaw sh -c 'echo "{\"version\":1,\"allowFrom\":[]}" > /root/.openclaw/credentials/telegram-fastbuilt-48hr-allowFrom.json'

# 3. (ถ้าต้องการ) ลบจาก ownerAllowFrom ด้วย
docker exec openclaw node openclaw.mjs config unset "commands.ownerAllowFrom"

# 4. Restart
docker restart openclaw && sleep 5
```

**Reset ทั้งหมด (กลับเป็น factory pairing flow):**

```bash
docker exec --user root openclaw rm -f \
  /root/.openclaw/credentials/telegram-fastbuilt-48hr-allowFrom.json \
  /root/.openclaw/credentials/line-fastbuilt-48hr-allowFrom.json
docker exec openclaw node openclaw.mjs config unset "commands.ownerAllowFrom"
docker restart openclaw && sleep 5
```

---

## 🤖 หมวด 8: Model (เปลี่ยน LLM)

| งาน | คำสั่ง | คำอธิบาย |
|-----|--------|----------|
| ตรวจ model ที่ใช้อยู่ | `docker logs openclaw --tail 100 \| grep "agent model"` | ดู log บรรทัด `agent model: ...` |
| เปลี่ยน primary model | `docker exec openclaw node openclaw.mjs config set "agents.defaults.model.primary" "<model-id>"` | ตั้งโมเดลหลัก (ต้อง restart) |
| Apply การเปลี่ยน | `docker restart openclaw && sleep 5 && docker logs openclaw --tail 20 \| grep model` | restart + verify ว่าโมเดลใหม่ active |

**Model IDs ที่ใช้ได้ (OpenRouter):**

| Model | ID | ลักษณะ | ราคาประมาณ |
|-------|----|---------|-----------|
| Gemini 2.5 Flash | `openrouter/google/gemini-2.5-flash` | เร็ว ราคาถูก ใช้ทั่วไปได้ดี | $0.075/1M in |
| Gemini 2.5 Pro | `openrouter/google/gemini-2.5-pro` | คิดละเอียดกว่า | $1.25/1M in |
| Claude Sonnet 4.6 | `openrouter/anthropic/claude-sonnet-4-6` | ดีที่สุดด้านโค้ด/วิเคราะห์ | $3/1M in |
| Claude Haiku 4.5 | `openrouter/anthropic/claude-haiku-4-5` | เร็วที่สุด ราคาถูก | $0.25/1M in |
| GPT-4o | `openrouter/openai/gpt-4o` | OpenAI flagship | $2.50/1M in |
| GPT-4o Mini | `openrouter/openai/gpt-4o-mini` | ราคาประหยัด | $0.15/1M in |
| Auto (เลือกอัตโนมัติ) | `openrouter/auto` | OpenRouter เลือกให้ | varies |

> 💡 ตรวจราคาล่าสุด: https://openrouter.ai/models

---

## 💬 หมวด 9: Sessions (Chat History)

| งาน | คำสั่ง | คำอธิบาย |
|-----|--------|----------|
| ดู session ทั้งหมด | `docker exec --user root openclaw ls /root/.openclaw/agents/main/sessions/` | list sessions ที่มี |
| ดู session ของ user | `docker exec --user root openclaw ls /root/.openclaw/agents/main/sessions/ \| grep <user-id>` | กรองเฉพาะ user |
| ลบ session ของ user | `docker exec --user root openclaw rm -rf /root/.openclaw/agents/main/sessions/<session-id>` | reset chat history |
| ลบ session ทั้งหมด | `docker exec --user root openclaw sh -c 'rm -rf /root/.openclaw/agents/main/sessions/*'` | ⚠️ ลบทั้งระบบ |

---

## 🛠️ หมวด 10: Diagnostic / Health Check

| งาน | คำสั่ง | คำอธิบาย |
|-----|--------|----------|
| ตรวจ HTTPS | `curl -I https://openclaw.srv1637353.hstgr.cloud` | ต้องได้ `HTTP/2 200` |
| ตรวจ DNS | `dig openclaw.srv1637353.hstgr.cloud +short` | ต้องได้ `72.62.64.163` |
| ตรวจ LINE webhook | `curl -X POST https://openclaw.srv1637353.hstgr.cloud/line/webhook` | ต้องไม่ 404 (ปกติได้ 401/400 = ok) |
| ตรวจ gateway ready | `docker logs openclaw 2>&1 \| grep "gateway ready"` | ต้องเห็น 1 บรรทัด = OK |
| ตรวจ plugin loaded | `docker logs openclaw 2>&1 \| grep "loaded.*plugin"` | ดูจำนวน plugins ที่ load สำเร็จ |
| ตรวจ memory usage | `docker stats openclaw --no-stream --format "{{.MemUsage}}"` | ดู RAM ใช้เท่าไร |
| ตรวจ disk volume | `docker exec --user root openclaw du -sh /root/.openclaw` | ขนาด config + sessions |

**Output ที่ "ทุกอย่างปกติ" จะเห็น (จาก `docker logs openclaw --tail 30`):**

```
[plugins] loaded 8 plugin(s) (8 attempted) in 1475.4ms
[gateway] agent model: openrouter/google/gemini-2.5-flash (thinking=medium, fast=off)
[gateway] http server listening (8 plugins: ...)
[gateway] starting channels and sidecars...
[telegram] [fastbuilt-48hr] starting provider (@NOPAssistantBot)
[line] [fastbuilt-48hr] starting LINE provider (...)
[gateway] ready
[heartbeat] started
```

---

## 💾 หมวด 11: Backup + Reboot ปลอดภัย

> ก่อน reboot VPS หรือทำ maintenance ครั้งใหญ่ → **backup volume + config files ก่อนเสมอ**

### Volumes ทั้งหมดที่เกี่ยวข้อง (full stack ของ VPS)

```bash
docker volume ls
```

ในระบบนี้จะเห็น 5 volumes:

| Volume | Container | เก็บข้อมูล |
|--------|-----------|-----------|
| `openclaw_openclaw_data` | openclaw | Config + sessions + credentials + plugins |
| `ai-stack_n8n_data` | n8n | Workflows + credentials |
| `ai-stack_qdrant_data` | qdrant | Vector embeddings |
| `ai-stack_lightrag_data` | lightrag | Knowledge graph + cache |
| `ai-stack_traefik_data` | traefik | SSL certs (Let's Encrypt) |

### Script Backup ครบทุก service

```bash
BACKUP_DIR=/root/backups/$(date +%Y%m%d-%H%M%S)
mkdir -p $BACKUP_DIR

# 1. Backup config files (host filesystem)
cp -a /opt/openclaw $BACKUP_DIR/
cp -a /opt/ai-stack $BACKUP_DIR/

# 2. Backup ทั้ง 5 Docker volumes
for vol in openclaw_openclaw_data ai-stack_lightrag_data ai-stack_n8n_data ai-stack_qdrant_data ai-stack_traefik_data; do
  echo "Backing up $vol..."
  docker run --rm \
    -v $vol:/data \
    -v $BACKUP_DIR:/backup \
    ubuntu tar czf /backup/$vol.tar.gz -C / data
done

# 3. ดูผล
ls -lh $BACKUP_DIR/
du -sh $BACKUP_DIR
```

ขนาด backup โดยประมาณ: ~6-10 MB (ตาม chat history + workflows)

### Reboot VPS ปลอดภัย

```bash
# 1. Backup ก่อน (รัน script ด้านบน)
# 2. Reboot
reboot
# 3. รอ ~1-2 นาที แล้ว SSH กลับเข้ามา
# 4. ตรวจ containers ทั้งหมด
docker ps --format "table {{.Names}}\t{{.Status}}"
```

ทุก container ที่มี `restart: always` ใน docker-compose.yml จะ auto-start เอง — **ไม่ต้องสั่ง start ด้วยตัวเอง**

### Restore จาก backup (กรณีมีปัญหา)

```bash
# สมมติ backup อยู่ที่ /root/backups/20260506-023536
BACKUP_DIR=/root/backups/20260506-023536

# 1. Stop ทุก container
cd /opt/openclaw && docker compose down
cd /opt/ai-stack && docker compose down

# 2. Restore config files
cp -a $BACKUP_DIR/openclaw /opt/
cp -a $BACKUP_DIR/ai-stack /opt/

# 3. Restore volumes (ทำทีละตัว)
for vol in openclaw_openclaw_data ai-stack_lightrag_data ai-stack_n8n_data ai-stack_qdrant_data ai-stack_traefik_data; do
  docker volume rm $vol 2>/dev/null || true
  docker volume create $vol
  docker run --rm \
    -v $vol:/data \
    -v $BACKUP_DIR:/backup \
    ubuntu sh -c "cd / && tar xzf /backup/$vol.tar.gz"
done

# 4. Start
cd /opt/ai-stack && docker compose up -d
cd /opt/openclaw && docker compose up -d
```

### Auto Backup ด้วย Cron (ตั้งจริงแล้วในระบบนี้)

> ระบบนี้ตั้งไว้ 2 schedules: weekly (ทุกพุธ) + monthly (สิ้นเดือน) — เก็บ weekly 4 ตัว + monthly 12 เดือน

#### สร้าง Weekly script

```bash
mkdir -p /root/scripts
cat > /root/scripts/backup-weekly.sh << 'EOF'
#!/bin/bash
BACKUP_DIR=/root/backups/weekly/$(date +%Y%m%d)
mkdir -p $BACKUP_DIR

cp -a /opt/openclaw $BACKUP_DIR/ 2>/dev/null
cp -a /opt/ai-stack $BACKUP_DIR/ 2>/dev/null

for vol in openclaw_openclaw_data ai-stack_lightrag_data ai-stack_n8n_data ai-stack_qdrant_data ai-stack_traefik_data; do
  docker run --rm -v $vol:/data -v $BACKUP_DIR:/backup ubuntu tar czf /backup/$vol.tar.gz -C / data 2>/dev/null
done

# เก็บ weekly 4 ตัวล่าสุด (~1 เดือน)
find /root/backups/weekly -maxdepth 1 -type d -mtime +28 -exec rm -rf {} \;

echo "[$(date)] Weekly backup done: $BACKUP_DIR" >> /root/backups/backup.log
EOF
chmod +x /root/scripts/backup-weekly.sh
```

#### สร้าง Monthly script

```bash
cat > /root/scripts/backup-monthly.sh << 'EOF'
#!/bin/bash
BACKUP_DIR=/root/backups/monthly/$(date +%Y%m)
mkdir -p $BACKUP_DIR

cp -a /opt/openclaw $BACKUP_DIR/ 2>/dev/null
cp -a /opt/ai-stack $BACKUP_DIR/ 2>/dev/null

for vol in openclaw_openclaw_data ai-stack_lightrag_data ai-stack_n8n_data ai-stack_qdrant_data ai-stack_traefik_data; do
  docker run --rm -v $vol:/data -v $BACKUP_DIR:/backup ubuntu tar czf /backup/$vol.tar.gz -C / data 2>/dev/null
done

# เก็บ monthly 12 เดือนล่าสุด
find /root/backups/monthly -maxdepth 1 -type d -mtime +365 -exec rm -rf {} \;

echo "[$(date)] Monthly backup done: $BACKUP_DIR" >> /root/backups/backup.log
EOF
chmod +x /root/scripts/backup-monthly.sh
```

#### ติดตั้ง crontab

```bash
(crontab -l 2>/dev/null; cat << 'EOF'
0 3 * * 3 /root/scripts/backup-weekly.sh
0 3 28-31 * * [ "$(date -d tomorrow +\%d)" = "01" ] && /root/scripts/backup-monthly.sh
EOF
) | crontab -

crontab -l
```

#### ตาราง Schedule + คำอธิบาย Cron Syntax

| Schedule | Cron expression | เวลารัน |
|----------|-----------------|---------|
| Weekly | `0 3 * * 3` | ทุกวันพุธ ตี 3:00 |
| Monthly | `0 3 28-31 * * [ "$(date -d tomorrow +\%d)" = "01" ] && ...` | สิ้นเดือนของทุกเดือน ตี 3:00 |

**Cron 5 ฟิลด์:** `<นาที> <ชั่วโมง> <วันที่> <เดือน> <วันสัปดาห์>`
- วันสัปดาห์: `0`=อา, `1`=จ, `2`=อ, `3`=พ, `4`=พฤ, `5`=ศ, `6`=ส

**Trick "สิ้นเดือน":** Cron ไม่มี syntax ตรงๆ → รันวันที่ 28-31 แล้วเช็ค `date -d tomorrow +%d == "01"`
- ก.พ. ปกติ: 28 รัน (พรุ่งนี้ = 1 มี.ค.)
- ก.พ. อธิกสุรทิน: 29 รัน (พรุ่งนี้ = 1 มี.ค.)
- เม.ย./มิ.ย./ก.ย./พ.ย.: 30 รัน
- เดือนอื่น: 31 รัน

> ⚠️ ใน crontab ต้อง escape `%` เป็น `\%` (ปกติ `%` คือ input separator ของ cron)

#### ดู / แก้ / ลบ cron

```bash
crontab -l                # ดู cron jobs ปัจจุบัน
crontab -e                # แก้ cron (เปิด editor)
crontab -r                # ⚠️ ลบ cron ทั้งหมด
```

#### ดู logs ของ backup

```bash
cat /root/backups/backup.log              # ประวัติ backup
ls -lh /root/backups/weekly/              # weekly archives
ls -lh /root/backups/monthly/             # monthly archives
du -sh /root/backups/                     # ขนาดรวม
```

---

## 🔄 หมวด 12: Workflow ที่ใช้บ่อย (Recipes)

### A. แก้ config + apply

```bash
# 1. แก้ค่า
docker exec openclaw node openclaw.mjs config set "<path>" "<value>"

# 2. Restart
docker restart openclaw && sleep 5

# 3. ตรวจ logs
docker logs openclaw --tail 20
```

### B. เปลี่ยน Model ใหม่

```bash
docker exec openclaw node openclaw.mjs config set "agents.defaults.model.primary" "openrouter/anthropic/claude-haiku-4-5"
docker restart openclaw && sleep 5
docker logs openclaw --tail 30 | grep "agent model"
# ต้องเห็น: agent model: openrouter/anthropic/claude-haiku-4-5
```

### C. เพิ่ม channel ใหม่ (Telegram)

```bash
cd /opt/openclaw && set -a && . .env && set +a

docker exec openclaw node openclaw.mjs channels add \
  --channel telegram \
  --account <new-account-id> \
  --token "$ACCOUNT2_TELEGRAM_BOT_TOKEN" \
  --name "$ACCOUNT2_NAME"

# ตั้ง dmPolicy เป็น open
docker exec openclaw node openclaw.mjs config set \
  "channels.telegram.accounts.<new-account-id>.dmPolicy" "open"

docker restart openclaw && sleep 5
docker exec openclaw node openclaw.mjs channels list
```

### D. Backup ก่อนแก้ใหญ่

```bash
# Backup config
docker exec --user root openclaw cp /root/.openclaw/openclaw.json \
  /root/.openclaw/openclaw.json.backup-$(date +%Y%m%d-%H%M%S)

# Backup .env
cp /opt/openclaw/.env /opt/openclaw/.env.backup-$(date +%Y%m%d)

# Backup volume (เต็ม)
docker run --rm -v openclaw_openclaw_data:/data -v $(pwd):/backup \
  ubuntu tar czf /backup/openclaw-backup-$(date +%Y%m%d).tar.gz /data
```

### E. กู้คืน config จาก backup

```bash
docker exec --user root openclaw cp \
  /root/.openclaw/openclaw.json.backup-<DATE> \
  /root/.openclaw/openclaw.json

docker restart openclaw
```

### F. Debug bot ไม่ตอบ

```bash
# 1. ดู container ทำงานไหม
docker ps | grep openclaw

# 2. ดู logs ล่าสุด
docker logs openclaw --tail 50

# 3. ตรวจ channels
docker exec openclaw node openclaw.mjs channels list

# 4. ตรวจ plugins
docker exec openclaw node openclaw.mjs plugins list 2>&1 | grep enabled

# 5. ตรวจ webhook URL ตอบไหม (LINE)
curl -I https://openclaw.srv1637353.hstgr.cloud/line/webhook

# 6. ลอง restart
docker restart openclaw && sleep 5

# 7. Watch logs สด ๆ ขณะส่งข้อความ
docker logs openclaw -f
```

### G. ดู API key ที่ตั้งไว้ (มาทำ rotation)

```bash
# Token จะ redact ในไฟล์ — ต้องดูจาก .env แทน
cat /opt/openclaw/.env | grep -E "(API_KEY|TOKEN)"
```

### H. ลบ Account / Bot ออกถาวร

```bash
# 1. Disable ก่อน
docker exec openclaw node openclaw.mjs config set \
  "channels.telegram.accounts.<id>.enabled" false

# 2. Restart เพื่อให้ bot หยุดทำงาน
docker restart openclaw && sleep 3

# 3. ลบ config
docker exec openclaw node openclaw.mjs config unset \
  "channels.telegram.accounts.<id>"

# 4. Restart อีกครั้ง
docker restart openclaw
```

---

## 📜 หมวด 13: One-liners (Copy-paste ใช้งานได้เลย)

```bash
# Health check ครบทุกอย่างใน command เดียว
docker ps | grep openclaw && \
  curl -sI https://openclaw.srv1637353.hstgr.cloud | head -1 && \
  docker exec openclaw node openclaw.mjs channels list && \
  docker logs openclaw --tail 5 | grep -i "model\|ready"

# Restart + รอจน ready แล้ว tail logs
docker restart openclaw && sleep 5 && docker logs openclaw --tail 20

# ดู channels + plugins รวบยอด
docker exec openclaw node openclaw.mjs channels list && echo "---" && \
  docker exec openclaw node openclaw.mjs plugins list 2>&1 | grep -i enabled
```

---

# Troubleshooting

## ❌ "Gateway start blocked: existing config is missing gateway.mode"

**สาเหตุ:** Schema ไม่ตรง  
**แก้:** ใช้ `onboard` generate config ใหม่ตาม Phase 4.2

## ❌ "Channel line does not support add"

**สาเหตุ:** LINE plugin ไม่ enabled  
**แก้:**
```bash
docker exec openclaw node openclaw.mjs plugins enable line
docker restart openclaw
```

## ❌ "Telegram add success" แต่ `channels list` ไม่เห็น

**สาเหตุ:** Telegram plugin ไม่ enabled (default ปิด)  
**แก้:**
```bash
docker exec openclaw node openclaw.mjs plugins enable telegram
docker restart openclaw
```

## ❌ LINE add แล้วแสดง "not configured, token=none"

**สาเหตุ:** Token ถูกเก็บเป็น file reference (`/tmp/*`) ที่หายเมื่อ restart  
**แก้:** ใช้ `config set channelAccessToken/channelSecret` ตาม Phase 6.3.4

## ❌ "Permission denied" ตอน apt-get install

**สาเหตุ:** Container รันด้วย non-root user  
**แก้:** เพิ่ม `user: root` ใน docker-compose.yml

## ❌ HTTPS error / SSL certificate

**สาเหตุ:** Traefik ยังไม่ออก cert (DNS ยังไม่ propagate)  
**แก้:** รอ 1-2 นาที + ตรวจ DNS:
```bash
dig openclaw.srv1637353.hstgr.cloud +short
```

## ❌ LINE webhook verify ไม่ผ่าน

**สาเหตุ:**
- Container ไม่ทำงาน → `docker ps`
- LINE plugin ไม่ enabled → check Phase 5.5
- Channel secret ผิด → ตรวจค่าใน .env vs LINE Console

## ❌ Web UI: "origin not allowed"

**สาเหตุ:** URL ของ browser ไม่อยู่ใน `allowedOrigins`  
**แก้:**
```bash
docker exec openclaw node openclaw.mjs config set \
  "gateway.controlUi.allowedOrigins" \
  '["http://localhost:18789","http://127.0.0.1:18789","https://openclaw.srv1637353.hstgr.cloud"]'
docker restart openclaw
```

## ❌ Web UI: "device pairing required (requestId: xxxx)"

**สาเหตุ:** Browser ใหม่ต้องถูก approve ก่อน (default behavior)  
**แก้ Option A** — Approve browser นั้นครั้งเดียว:
```bash
docker exec openclaw node openclaw.mjs devices approve <requestId>
```
**แก้ Option B** — ปิด device pairing ทั้งหมดถาวร:
```bash
docker exec openclaw node openclaw.mjs config set \
  "gateway.controlUi.dangerouslyDisableDeviceAuth" true
docker restart openclaw
```

## ❌ Web UI: "Unknown command: openclaw device-pair"

**สาเหตุ:** Command ผิด — ชื่อ plugin คือ `device-pair` แต่ CLI command คือ `devices`  
**แก้:** ใช้ `devices` แทน:
```bash
docker exec openclaw node openclaw.mjs devices approve <requestId>
docker exec openclaw node openclaw.mjs devices list
```

## ❌ config set "models.primary" / "models.fallback" → "Unrecognized key"

**สาเหตุ:** Path ผิด — model config อยู่ใน `agents.defaults.model` ไม่ใช่ `models`  
**แก้:** ใช้ path ที่ถูกต้อง:
```bash
docker exec openclaw node openclaw.mjs config set "agents.defaults.model.primary" "openrouter/google/gemini-2.5-flash"
```
> หมายเหตุ: `agents.defaults.model.fallback` ไม่มีใน schema — ไม่มี fallback model config

## ❌ ตั้ง dmPolicy=open แล้วทุกคนถูก block (`Blocked unauthorized sender`)

**สาเหตุ:** `dmPolicy: open` ไม่ได้แปลว่า "เปิดให้ทุกคน" — มันหมายถึง "เปิดให้คนใน `allowFrom` list"  
**แก้ Option A** — ถ้าเป็น customer bot (ไม่รู้จัก users ล่วงหน้า): ใช้ `dmPolicy: pairing` แทน:
```bash
docker exec openclaw node openclaw.mjs config set "channels.telegram.accounts.<id>.dmPolicy" "pairing"
docker exec openclaw node openclaw.mjs config unset "channels.telegram.accounts.<id>.allowFrom"
docker restart openclaw
```
**แก้ Option B** — ถ้ารู้จัก users: เพิ่ม IDs เข้า allowFrom:
```bash
docker exec openclaw node openclaw.mjs config set \
  "channels.telegram.accounts.<id>.allowFrom" \
  '["USER_ID_1","USER_ID_2"]'
docker restart openclaw
```

## ❌ ลบ approval แล้วยัง block ไม่ได้ (user ยังคุยได้)

**สาเหตุ:** Approved senders เก็บใน 2 ที่ — `commands.ownerAllowFrom` และไฟล์ใน `credentials/`  
**แก้:** ต้องลบทั้ง 2 ที่:
```bash
# 1. ลบไฟล์ allowFrom credentials
docker exec --user root openclaw rm /root/.openclaw/credentials/telegram-<account>-allowFrom.json
docker exec --user root openclaw rm /root/.openclaw/credentials/line-<account>-allowFrom.json

# 2. ลบจาก config
docker exec openclaw node openclaw.mjs config unset "commands.ownerAllowFrom"

# 3. Restart
docker restart openclaw
```

---

# Security Checklist

- [ ] Revoke API keys ที่หลุดในแชท (OpenAI, OpenRouter, Gemini, Telegram, LINE)
- [ ] เปลี่ยน gateway token ใหม่ทุก 90 วัน
- [ ] Backup `/opt/openclaw/.env` ในที่ปลอดภัย (password manager)
- [ ] Backup volume `openclaw_openclaw_data` เป็นประจำ
- [ ] เปิด Hostinger firewall เปิดเฉพาะ port 22, 80, 443
- [ ] LINE `dmPolicy: open` = ระวัง spam → ตั้ง rate limit
- [ ] ตั้ง budget alert ที่ OpenAI/OpenRouter dashboard

---

# โครงสร้างไฟล์สุดท้าย

```
/opt/openclaw/
├── .env                       (secrets, multi-account config)
├── .env.bak                   (backup จาก migration)
└── docker-compose.yml

Docker Volume:
└── openclaw_openclaw_data     (config + sessions + workspace)

DNS Records:
└── openclaw.srv1637353.hstgr.cloud → 72.62.64.163

LINE Webhook:
└── https://openclaw.srv1637353.hstgr.cloud/line/webhook
```

---

# สรุปสถานะ ณ จุดที่หยุดสำหรับ session ใหม่

## ✅ ทำเสร็จแล้ว

- [x] DNS record `openclaw.srv1637353.hstgr.cloud` → VPS IP
- [x] Container `openclaw` รันบน Traefik network (HTTPS works)
- [x] Onboard generate base config ที่ schema ถูกต้อง
- [x] Plugins `telegram` + `line` + `openrouter` enabled
- [x] Telegram channel `fastbuilt-48hr` (FastBuilt-48hr) — `configured, enabled`
- [x] LINE channel `fastbuilt-48hr` (FastBuilt-48hr) — `configured, enabled`
- [x] LINE webhook verified ที่ LINE Developers Console
- [x] Primary model = `openrouter/google/gemini-2.5-flash`
- [x] dmPolicy = `pairing` (ทั้ง Telegram + LINE) — customer ใหม่ส่งข้อความ → ได้ pairing code → owner approve
- [x] ทดสอบส่งข้อความผ่าน Telegram ✅ และ LINE ✅ (ทั้ง flow approved + flow pairing ใหม่)
- [x] `.env` structure ACCOUNT1/2/3 (Account 1 มีค่าครบ, 2/3 รอเพิ่ม)
- [x] Web UI เปิดได้จาก `https://openclaw.srv1637353.hstgr.cloud` ด้วย gateway token
- [x] `gateway.controlUi.allowedOrigins` เพิ่ม HTTPS URL แล้ว
- [x] `gateway.controlUi.dangerouslyDisableDeviceAuth = true` (ไม่ต้อง device pairing)
- [x] เข้าใจกลไก dmPolicy ถูกต้อง: `open` = allowFrom เท่านั้น, `pairing` = scale ได้สำหรับ customer
- [x] เข้าใจที่เก็บ approved senders: `credentials/<channel>-<account>-allowFrom.json` + `commands.ownerAllowFrom`
- [x] Auto backup ตั้งใน cron: weekly (ทุกพุธ 03:00) + monthly (สิ้นเดือน 03:00)
- [x] ทดสอบ reboot VPS — ทุก container auto-start ผ่าน `restart: always`

## ⏳ ยังเหลือ

- [ ] ตั้ง System Prompt ให้ bot รู้จักตัวเอง (ชื่อ/บริษัท/หน้าที่)
- [ ] เพิ่ม Account 2 (Knightfurnich) — Telegram + LINE (Phase 9)
- [ ] เพิ่ม Account 3 (NopAssistant) — Telegram + LINE (Phase 9)

## 📝 Context สำหรับ Session ใหม่

```
OpenClaw setup Account 1 (FastBuilt-48hr) เสร็จสมบูรณ์แล้ว
- Container healthy บน https://openclaw.srv1637353.hstgr.cloud
- Telegram (@NOPAssistantBot) + LINE ทำงานปกติ
- Web UI เปิดได้จากทุก browser ด้วย gateway token (ไม่ต้อง device pairing)
- Model: openrouter/google/gemini-2.5-flash
- dmPolicy: pairing — ลูกค้าใหม่ส่ง pairing code มา owner approve ผ่าน CLI
- ขั้นตอนถัดไป: ตั้ง System Prompt + เพิ่ม Account 2/3
- ดูคู่มือฉบับเต็มที่ docs/05-openclaw-installation-line-telegram.md
```
