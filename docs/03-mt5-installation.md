# MT5 Container — Complete Guide

> ครอบคลุม: Installation · DNS · Firewall · Backup · Restore · Troubleshooting

---

## Server Info

| Item | Value |
|------|-------|
| Provider | Hostinger (VPS ID: 1637353) |
| Hostname | `srv1637353.hstgr.cloud` |
| IP | `72.62.64.163` |
| OS | Ubuntu 24.04 LTS with Docker & Traefik |
| Plan | KVM 2 — 2 vCPU, 8 GB RAM, 100 GB disk |
| SSH | `ssh root@72.62.64.163` |

---

## Architecture

```
Internet → Hostinger Firewall (port 22, 80, 443)
                  ↓
            Ubuntu VPS (72.62.64.163)
                  ↓
            Docker Engine
                  ↓
         ai-stack_app_net (shared network)
                  ↓
            ┌──────────────┐
            │   traefik    │  ← รับ HTTPS, ออก SSL cert อัตโนมัติ
            └──────┬───────┘
                   │ route by Host header
   ┌───────┬───────┼────────────┐
   ↓       ↓       ↓            ↓
  n8n   qdrant  lightrag       mt5
                        (mt5.srv1637353.hstgr.cloud)
```

### File Structure บน VPS

```
/opt/
├── ai-stack/
│   └── docker-compose.yml      (n8n, qdrant, lightrag, traefik)
└── mt5/
    ├── .env                    (MT5_USER, MT5_PASSWORD)
    ├── docker-compose.yml
    ├── mt5-data/               (MT5 config + EA + login data = volume mount)
    └── backups/
        ├── mt5_backup_*.tar.gz
        └── backup.log
```

---

## Part 1: DNS Setup

### เพิ่ม A Record

| Type | Name | Points to | TTL |
|------|------|-----------|-----|
| A | `mt5.srv1637353.hstgr.cloud` | `72.62.64.163` | 14400 |

**ผ่าน hPanel:**
1. เข้า https://hpanel.hostinger.com → **Domains** → domain → **DNS / Nameservers**
2. **Add new record** → กรอกตามตารางด้านบน → **Save**

**ผ่าน Hostinger MCP:**
ใช้ tool `DNS_updateDNSRecordsV1`

### ตรวจสอบ DNS

```bash
dig mt5.srv1637353.hstgr.cloud +short
# ต้องได้: 72.62.64.163
```

> DNS propagate ใช้เวลา 5–30 นาที

---

## Part 2: Installation

### 2.1 ตรวจสอบ Traefik และ network

```bash
docker ps | grep traefik
docker network ls | grep ai-stack
```

ต้องเห็น `traefik` รันอยู่และมี network `ai-stack_app_net`

### 2.2 สร้างโฟลเดอร์

```bash
mkdir -p /opt/mt5 && cd /opt/mt5
```

### 2.3 สร้างไฟล์ `.env`

```bash
cat > .env << 'EOF'
MT5_USER=admin
MT5_PASSWORD=ChangeMe123!
EOF
```

> เปลี่ยน `ChangeMe123!` เป็นรหัสที่ปลอดภัย (16+ ตัวอักษร) ก่อนเสมอ

### 2.4 สร้างไฟล์ `docker-compose.yml`

```bash
cat > docker-compose.yml << 'EOF'
version: '3.8'

services:
  mt5:
    image: gmag11/metatrader5_vnc:1.0
    container_name: mt5
    restart: always
    networks:
      - ai-stack_app_net
    environment:
      - CUSTOM_USER=${MT5_USER}
      - PASSWORD=${MT5_PASSWORD}
    volumes:
      - ./mt5-data:/config
    labels:
      - "traefik.enable=true"
      - "traefik.docker.network=ai-stack_app_net"
      - "traefik.http.routers.mt5.rule=Host(`mt5.srv1637353.hstgr.cloud`)"
      - "traefik.http.routers.mt5.entrypoints=websecure"
      - "traefik.http.routers.mt5.tls=true"
      - "traefik.http.routers.mt5.tls.certresolver=mytlschallenge"
      - "traefik.http.routers.mt5.middlewares=mt5@docker"
      - "traefik.http.services.mt5.loadbalancer.server.port=3000"
      - "traefik.http.middlewares.mt5.headers.SSLRedirect=true"
      - "traefik.http.middlewares.mt5.headers.STSSeconds=315360000"
      - "traefik.http.middlewares.mt5.headers.STSIncludeSubdomains=true"
      - "traefik.http.middlewares.mt5.headers.STSPreload=true"
      - "traefik.http.middlewares.mt5.headers.forceSTSHeader=true"
      - "traefik.http.middlewares.mt5.headers.browserXSSFilter=true"
      - "traefik.http.middlewares.mt5.headers.contentTypeNosniff=true"

networks:
  ai-stack_app_net:
    external: true
EOF
```

### 2.5 รัน Container

```bash
docker compose up -d
```

> ครั้งแรก Docker pull image (~600 MB) ใช้เวลา 1–3 นาที

### 2.6 ตรวจสอบสถานะ

```bash
docker ps | grep mt5
docker logs mt5 -f        # กด Ctrl+C เพื่อหยุด
```

### 2.7 เข้าใช้งาน

รอ 1–2 นาทีให้ Traefik ออก SSL cert แล้วเปิด browser:

```
https://mt5.srv1637353.hstgr.cloud
```

- Username: `admin`
- Password: ตามที่ตั้งใน `.env`

> First run: MT5 ติดตั้งตัวเองใน container อีก ~5 นาที

---

## Part 3: Firewall Setup

ใช้ **Hostinger Firewall** (network level — ปลอดภัยกว่า ufw)

```
https://hpanel.hostinger.com/vps/1637353/security/firewall
```

1. **Create firewall** → ชื่อ `web-only`
2. เพิ่ม rules:

| Action | Protocol | Port | Source |
|--------|----------|------|--------|
| Accept | TCP | 22 | any — SSH |
| Accept | TCP | 80 | any — HTTP (Let's Encrypt challenge) |
| Accept | TCP | 443 | any — HTTPS |

3. **Activate** บน VPS

> อย่าเปิด port 3000 ตรง — ใช้เฉพาะผ่าน Traefik (HTTPS)

---

## Part 4: Container Management

| ต้องการ | คำสั่ง |
|---------|--------|
| ดูสถานะ | `docker ps \| grep mt5` |
| ดู logs | `docker logs mt5 --tail 50 -f` |
| Start | `docker start mt5` |
| Stop | `docker stop mt5` |
| Restart | `docker restart mt5` |
| หยุดทั้ง stack | `cd /opt/mt5 && docker compose down` |
| เริ่มใหม่ทั้ง stack | `cd /opt/mt5 && docker compose up -d` |
| Recreate (หลังแก้ .env) | `cd /opt/mt5 && docker compose up -d --force-recreate` |
| อัพเดท image | `cd /opt/mt5 && docker compose pull && docker compose up -d` |

---

## Part 5: Backup System

### Scripts

| Script | Path |
|--------|------|
| Backup | `/opt/mt5/backup.sh` |
| Restore | `/opt/mt5/restore.sh` |
| Log | `/opt/mt5/backups/backup.log` |
| Storage | `/opt/mt5/backups/` |

### Cron Schedule

| Expression | Frequency | Job |
|------------|-----------|-----|
| `0 2 1,16 * *` | Bi-weekly | MT5 backup — วันที่ 1 และ 16 ของทุกเดือน เวลา 02:00 UTC |
| `0 3 * * 3` | Weekly | `/root/scripts/backup-weekly.sh` |
| `0 3 28-31 * *` | Monthly | `/root/scripts/backup-monthly.sh` |

### Retention Policy

- เก็บ **6 ไฟล์ล่าสุด** (~3 เดือน)
- ไฟล์เก่าถูกลบอัตโนมัติหลัง backup แต่ละครั้ง
- ขนาดเฉลี่ยต่อไฟล์: ~701 MB → รวม ~4.2 GB

### Backup Process

1. `docker stop mt5` — หยุด container เพื่อความสมบูรณ์ของข้อมูล
2. `tar -czf mt5_backup_YYYYMMDD_HHMMSS.tar.gz /opt/mt5/mt5-data`
3. `docker start mt5` — เริ่ม container ใหม่
4. ลบไฟล์เกิน 6 ชุด
5. บันทึก log

### รัน Backup ด้วยตนเอง

```bash
/opt/mt5/backup.sh
```

### ดู Log

```bash
tail -f /opt/mt5/backups/backup.log
cat /opt/mt5/backups/backup.log
```

### ดูรายการ Backup

```bash
ls -lht /opt/mt5/backups/mt5_backup_*.tar.gz
```

---

## Part 6: Restore

> ⚠️ **WARNING:** Restore จะ **OVERWRITE** ข้อมูลใน `/opt/mt5/mt5-data` ทั้งหมด
> Script จะถามยืนยัน `[y/N]` ก่อนดำเนินการเสมอ

### Restore ล่าสุด

```bash
/opt/mt5/restore.sh
```

### Restore ไฟล์ที่ระบุ

```bash
/opt/mt5/restore.sh /opt/mt5/backups/mt5_backup_YYYYMMDD_HHMMSS.tar.gz
```

### Restore Process

1. แสดงข้อมูล backup file และ target directory
2. รอ confirm `y` จากผู้ใช้
3. `docker stop mt5`
4. `rm -rf /opt/mt5/mt5-data`
5. `tar -xzf backup.tar.gz -C /opt/mt5`
6. `docker start mt5`

### ตรวจสอบความสมบูรณ์ก่อน Restore

```bash
tar -tzf /opt/mt5/backups/mt5_backup_YYYYMMDD_HHMMSS.tar.gz > /dev/null && echo OK || echo CORRUPTED
```

---

## Part 7: Troubleshooting

### MT5 เปิดไม่ได้ — SSL Error

```bash
docker logs traefik --tail 50 | grep -i mt5
dig mt5.srv1637353.hstgr.cloud +short        # ต้องได้ 72.62.64.163
```

### Container start ไม่ขึ้น

```bash
docker logs mt5
ls -la /opt/mt5/mt5-data/                    # ตรวจ data dir
docker inspect mt5 | grep -i status
```

### Container ไม่ start หลัง Restore

```bash
docker logs mt5
# ถ้า data dir หาย ให้ restore ใหม่จากไฟล์ที่ถูกต้อง
/opt/mt5/restore.sh /opt/mt5/backups/mt5_backup_YYYYMMDD_HHMMSS.tar.gz
```

### Backup ไฟล์เสีย

```bash
# ทดสอบก่อน restore
tar -tzf /opt/mt5/backups/mt5_backup_YYYYMMDD_HHMMSS.tar.gz > /dev/null && echo OK || echo CORRUPTED

# ดูไฟล์ทั้งหมด เรียงจากใหม่ไปเก่า
ls -lht /opt/mt5/backups/mt5_backup_*.tar.gz
```

### Disk Space

```bash
df -h /opt/mt5/
du -sh /opt/mt5/backups/*
```

### Reset MT5 (เริ่มต้นใหม่ทั้งหมด)

```bash
cd /opt/mt5
docker compose down
rm -rf mt5-data
docker compose up -d
```

> ⚠️ จะลบ config, EA, broker login ของ MT5 ทั้งหมด ทำเฉพาะเมื่อจำเป็นจริงๆ

---

## Security Best Practices

1. เปลี่ยน `MT5_PASSWORD` ใน `.env` เป็นรหัส 16+ ตัวอักษร
2. เปิด 2FA ใน MT5 broker
3. Backup `/opt/mt5/mt5-data` ก่อนทำการเปลี่ยนแปลงสำคัญทุกครั้ง
4. อย่าเปิด port 3000 ตรง — ใช้เฉพาะผ่าน Traefik (HTTPS)
5. ตั้ง Snapshot อัตโนมัติบน Hostinger เป็น safety net เพิ่มเติม

---

## Other Services on This VPS (ai-stack)

| Container | Image | Port | Purpose |
|-----------|-------|------|---------|
| `traefik` | traefik:latest | 80, 443 | Reverse proxy + SSL |
| `n8n` | docker.n8n.io/n8nio/n8n | 5678 | Workflow automation |
| `lightrag` | ghcr.io/hkuds/lightrag:latest | 9621 | RAG engine |
| `qdrant` | qdrant/qdrant:latest | 6333–6334 | Vector database |

Compose file: `/opt/ai-stack/docker-compose.yml`

---

## Change Log

| Date | Change |
|------|--------|
| 2026-05-06 | Initial setup: MT5 container deployed, DNS configured, firewall set, backup/restore scripts created, bi-weekly cron registered (first backup: 701 MB) |
