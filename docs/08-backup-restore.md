# คู่มือ: Backup & Restore — VPS srv1637353

> อัปเดตล่าสุด: 2026-05-06

---

## Overview

| Type | Script | Schedule | Retention |
|---|---|---|---|
| Weekly | `/root/scripts/backup-weekly.sh` | ทุกพุธ 03:00 UTC | 10 copies |
| Monthly | `/root/scripts/backup-monthly.sh` | ปลายเดือน 03:00 UTC | 12 months |
| MT5 | ไม่มี (manual เท่านั้น) | — | — |

**Backup location:**
- Weekly: `/root/backups/weekly/<YYYYMMDD_HHMMSS>/`
- Monthly: `/root/backups/monthly/<YYYYMM>/`
- Log: `/root/backups/backup.log`

---

## สิ่งที่ถูก Backup

### Config Directories (ทุก script)
| ไฟล์ | ขนาดโดยประมาณ |
|---|---|
| `openclaw-config.tar.gz` | ~4 KB |
| `ai-stack-config.tar.gz` | ~4 KB |
| `paperclip-config.tar.gz` | ~57 MB |
| `hermes-config.tar.gz` | ~220 MB (มี `.git` อยู่ด้วย) |

### Docker Volumes (ทุก script)
| Volume | ขนาดโดยประมาณ |
|---|---|
| `openclaw_openclaw_data.tar.gz` | ~5 MB |
| `ai-stack_lightrag_data.tar.gz` | ~4 KB |
| `ai-stack_n8n_data.tar.gz` | ~1.2 MB |
| `ai-stack_qdrant_data.tar.gz` | ~464 KB |
| `ai-stack_traefik_data.tar.gz` | ~44 KB |
| `paperclip_paperclip-data.tar.gz` | ~20 MB |
| `paperclip_paperclip-pgdata.tar.gz` | ~8 MB |

---

## Cron Jobs

```
0 3 * * 3   /root/scripts/backup-weekly.sh
0 3 28-31 * * [ "$(date -d tomorrow +\%d)" = "01" ] && /root/scripts/backup-monthly.sh
```

เช็ค cron ปัจจุบัน:
```bash
crontab -l
```

---

## Features ของ Scripts

- **Logging** — ทุก step log ไปที่ `/root/backups/backup.log` พร้อม timestamp
- **Integrity check** — `tar -tzf` ตรวจสอบทุกไฟล์หลัง backup สำเร็จ ถ้า corrupt → exit 1
- **Rotation** — weekly เก็บ 10 copies, monthly เก็บ 12 months โดยนับจำนวน directory จริง

---

## Restore Procedure

### ขั้นตอนทั่วไป

```bash
# 1. เช็ค backup ที่มี
ls -lt /root/backups/weekly/
ls -lt /root/backups/monthly/

# 2. เลือก backup date
BACKUP=/root/backups/weekly/20260506_103722
```

### openclaw

```bash
cd /opt/openclaw && docker compose down
tar xzf $BACKUP/openclaw-config.tar.gz -C /opt/
docker run --rm -v openclaw_openclaw_data:/target -v $BACKUP:/src alpine \
  sh -c "cd /target && tar xzf /src/openclaw_openclaw_data.tar.gz --strip-components=1"
cd /opt/openclaw && docker compose up -d
```

### ai-stack (n8n + qdrant + lightrag + traefik)

```bash
cd /opt/ai-stack && docker compose down
tar xzf $BACKUP/ai-stack-config.tar.gz -C /opt/
for vol in ai-stack_n8n_data ai-stack_qdrant_data ai-stack_lightrag_data ai-stack_traefik_data; do
  docker run --rm -v $vol:/target -v $BACKUP:/src alpine \
    sh -c "cd /target && tar xzf /src/${vol}.tar.gz --strip-components=1"
done
cd /opt/ai-stack && docker compose up -d
```

### paperclip + postgres

```bash
cd /opt/paperclip && docker compose down
tar xzf $BACKUP/paperclip-config.tar.gz -C /opt/
for vol in paperclip_paperclip-data paperclip_paperclip-pgdata; do
  docker run --rm -v $vol:/target -v $BACKUP:/src alpine \
    sh -c "cd /target && tar xzf /src/${vol}.tar.gz --strip-components=1"
done
cd /opt/paperclip && docker compose up -d
```

### hermes

```bash
cd /opt/hermes && docker compose down
tar xzf $BACKUP/hermes-config.tar.gz -C /opt/
cd /opt/hermes && docker compose up -d
```

### MT5 (manual)

```bash
# Stop container
docker stop mt5

# Restore data จาก tar.gz ที่มีใน /root/backups/weekly/<date>/
# หรือจาก snapshot ที่เคย backup ไว้ใน /opt/mt5/backups/ (ก่อนลบ cron)
tar xzf <backup_file>.tar.gz -C /opt/mt5/

# Start container
docker start mt5
```

---

## Backup Verification (Manual)

```bash
# เช็ค integrity ทุกไฟล์ใน backup ล่าสุด
for f in /root/backups/weekly/$(ls -t /root/backups/weekly/ | head -1)/*.tar.gz; do
  tar -tzf "$f" > /dev/null 2>&1 && echo "OK $f" || echo "CORRUPT $f"
done
```

---

## ดู Log

```bash
tail -50 /root/backups/backup.log
```

---

## สิ่งที่ยังไม่ได้ทำ (Future)

- **Off-site backup** — Backblaze B2 หรือ S3 (sync หลัง backup เสร็จ)
- **Encryption** — `openssl enc -aes-256-cbc` สำหรับ `.env` ที่มี API keys (ค้างเรื่อง key management)
- **Test Restore** — ทดสอบ restore จริงบน VPS ใหม่
