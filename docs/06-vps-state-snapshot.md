# คู่มือ: VPS State Snapshot (ก่อนติดตั้ง / ก่อน session ใหม่)

> **เป้าหมาย:** Script เดียวที่รันแล้วได้ข้อมูล VPS ครบทุกด้าน — copy-paste output ส่งให้ Claude ใน session ใหม่ → Claude รู้ context ทั้งหมดทันที ไม่ต้องเดา

---

## วิธีใช้

1. SSH เข้า VPS: `ssh root@72.62.64.163`
2. รัน script 1 command:
   ```bash
   /root/scripts/vps-snapshot.sh
   ```
3. Copy output ทั้งหมด → paste ในแชทกับ Claude พร้อมบอกว่าต้องการทำอะไร

---

## Script ปัจจุบัน (ติดตั้งไว้แล้วบน VPS)

Script อยู่ที่ `/root/scripts/vps-snapshot.sh` — รันได้เลย ไม่ต้องติดตั้งใหม่

---

## สร้าง Script ใหม่ (กรณี VPS ใหม่หรือ script หาย)

```bash
mkdir -p /root/scripts
cat > /root/scripts/vps-snapshot.sh << 'SNAPSHOT'
#!/bin/bash
echo "================================================================"
echo "  VPS STATE SNAPSHOT — $(date '+%Y-%m-%d %H:%M:%S %Z')"
echo "================================================================"

echo ""
echo "## 1. SYSTEM INFO"
echo "----------------------------------------------------------------"
echo "Hostname: $(hostname)"
echo "Public IP: $(curl -s4 ifconfig.me 2>/dev/null || echo 'N/A')"
echo "OS: $(lsb_release -ds 2>/dev/null || cat /etc/os-release | grep PRETTY_NAME | cut -d= -f2 | tr -d '"')"
echo "Kernel: $(uname -r)"
echo "Uptime: $(uptime -p)"

echo ""
echo "## 2. RESOURCES"
echo "----------------------------------------------------------------"
echo "CPU cores: $(nproc)"
free -h | grep -E "(Mem|Swap)"
df -h / /opt 2>/dev/null | grep -v "^Filesystem"

echo ""
echo "## 3. DOCKER CONTAINERS"
echo "----------------------------------------------------------------"
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Image}}\t{{.Ports}}"

echo ""
echo "## 4. VOLUMES + NETWORKS"
echo "----------------------------------------------------------------"
docker volume ls
echo ""
docker network ls --filter "type=custom"

echo ""
echo "## 5. PROJECTS (/opt)"
echo "----------------------------------------------------------------"
ls -la /opt/ 2>/dev/null

echo ""
echo "## 6. TRAEFIK ROUTES (HTTPS endpoints)"
echo "----------------------------------------------------------------"
grep -h "Host(" /opt/ai-stack/docker-compose.yml /opt/openclaw/docker-compose.yml /opt/hermes/docker-compose.yml /opt/mt5/docker-compose.yml /opt/paperclip/docker-compose.yml 2>/dev/null | grep -o 'Host(`[^`]*`)' | sort -u

echo ""
echo "## 7. OPEN PORTS"
echo "----------------------------------------------------------------"
ss -tlnp | awk 'NR>1 {print $4}' | sort -u

echo ""
echo "## 8. CRON JOBS"
echo "----------------------------------------------------------------"
crontab -l 2>/dev/null

echo ""
echo "## 9. BACKUPS"
echo "----------------------------------------------------------------"
du -sh /root/backups/*/ 2>/dev/null

echo ""
echo "## 10. CONFIG FILES"
echo "----------------------------------------------------------------"
for f in /opt/openclaw/.env /opt/openclaw/docker-compose.yml \
          /opt/ai-stack/.env /opt/ai-stack/docker-compose.yml \
          /opt/hermes/.env /opt/hermes/docker-compose.yml \
          /opt/mt5/docker-compose.yml \
          /opt/paperclip/docker-compose.yml; do
  [ -f "$f" ] && echo "OK $f" || echo "MISSING $f"
done

echo ""
echo "================================================================"
echo "  END OF SNAPSHOT"
echo "================================================================"
SNAPSHOT

chmod +x /root/scripts/vps-snapshot.sh
/root/scripts/vps-snapshot.sh
```

---

## Sections ที่ได้จาก Snapshot

| Section | ข้อมูล |
|---|---|
| 1. SYSTEM INFO | hostname, IP, OS, kernel, uptime |
| 2. RESOURCES | CPU, RAM, disk |
| 3. DOCKER CONTAINERS | ทุก container + status + image + ports |
| 4. VOLUMES + NETWORKS | Docker volumes และ custom networks |
| 5. PROJECTS (/opt) | folders ใน /opt |
| 6. TRAEFIK ROUTES | subdomains ที่ใช้งานอยู่ |
| 7. OPEN PORTS | ports ที่ listen อยู่ |
| 8. CRON JOBS | scheduled tasks |
| 9. BACKUPS | ขนาด backup files |
| 10. CONFIG FILES | ตรวจสอบ .env + docker-compose.yml ทุก project |

---

## Subdomains ที่ใช้แล้ว (ปัจจุบัน)

| Subdomain | Service | Project |
|---|---|---|
| `n8n.srv1637353.hstgr.cloud` | n8n | `/opt/ai-stack/` |
| `qdrant.srv1637353.hstgr.cloud` | Qdrant | `/opt/ai-stack/` |
| `lightrag.srv1637353.hstgr.cloud` | LightRAG | `/opt/ai-stack/` |
| `openclaw.srv1637353.hstgr.cloud` | OpenClaw | `/opt/openclaw/` |
| `mt5.srv1637353.hstgr.cloud` | MetaTrader 5 | `/opt/mt5/` |
| `hermes.srv1637353.hstgr.cloud` | Hermes Agent | `/opt/hermes/` |
| `paperclip.srv1637353.hstgr.cloud` | Paperclip | `/opt/paperclip/` |

> ก่อนเพิ่ม service ใหม่ — เช็คว่า subdomain ไม่ซ้ำจาก section 6 ของ snapshot

---

## Deep State Commands (เฉพาะ service)

### OpenClaw
```bash
docker ps | grep openclaw
docker logs openclaw --tail 20
```

### AI Stack (n8n / Qdrant / LightRAG)
```bash
docker ps | grep -E "(n8n|qdrant|lightrag|traefik)"
curl -s http://localhost:6333/collections 2>/dev/null | head -5
curl -sI http://localhost:9621/health 2>/dev/null | head -1
```

### MT5
```bash
docker ps | grep mt5
docker logs mt5 --tail 20
```

### Hermes
```bash
docker ps | grep hermes
docker logs hermes --tail 20
docker logs hermes-dashboard --tail 10
```

---

## Workflow ตัวอย่าง: เริ่ม Session ใหม่

```bash
# 1. SSH เข้า VPS
ssh root@72.62.64.163

# 2. รัน snapshot
/root/scripts/vps-snapshot.sh
```

Copy output ทั้งหมด → paste ในแชทพร้อมบอกเป้าหมาย:

```
นี่คือสถานะ VPS ปัจจุบัน อยากติดตั้ง <ชื่อ service>:

[paste output ทั้งหมด]
```

---

## Tips

- **รัน snapshot ก่อนทำงานทุกครั้ง** — รู้สถานะจริง ไม่เดา
- **Paste output ทั้งหมด** — Claude อ่าน context ได้ครบ
- **ระบุเป้าหมาย session** — "อยากเพิ่ม XYZ" / "อยากแก้ปัญหา ABC"
- **certresolver บน VPS นี้ใช้ชื่อ `mytlschallenge`** (ไม่ใช่ `letsencrypt`)
- **Network ที่ใช้ร่วมกัน:** `ai-stack_app_net` (external)
