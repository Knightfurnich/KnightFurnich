# คู่มือย้าย Docker Stack ไป VPS ใหม่ (Hostinger)

> **เป้าหมาย:** ย้าย 5 containers (traefik, n8n, qdrant, lightrag, mt5) พร้อมข้อมูลทั้งหมดจาก VPS เก่าไป VPS ใหม่

---

## ข้อมูลอ้างอิง

- **VPS เก่า:** `srv1637353.hstgr.cloud` (IP: `72.62.64.163`)
- **Domain:** `multivps.cloud`
- **Subdomains ที่ต้องอัพเดท DNS:**
  - mt5.srv1637353.hstgr.cloud
  - n8n.srv1637353.hstgr.cloud
  - qdrant.srv1637353.hstgr.cloud
  - lightrag.srv1637353.hstgr.cloud

---

## ภาพรวม

ต้องย้าย 3 ส่วน:

| ส่วน | ที่อยู่ | หมายเหตุ |
|------|--------|---------|
| Compose files | `/opt/ai-stack/`, `/opt/mt5/` | docker-compose.yml + .env |
| Docker volumes (4) | `ai-stack_traefik_data`, `ai-stack_n8n_data`, `ai-stack_qdrant_data`, `ai-stack_lightrag_data` | ข้อมูลของแต่ละ service |
| Bind mount (1) | `/opt/mt5/mt5-data` | ข้อมูล MT5 |

> Images และ Containers **ไม่ต้องย้าย** — VPS ใหม่จะ pull/สร้างใหม่

---

## Step 1: ซื้อ VPS ใหม่บน Hostinger

1. เข้า https://hpanel.hostinger.com → **VPS** → **Buy new VPS**
2. เลือก template: **"Ubuntu 24.04 with Docker and Traefik"** (เหมือนเดิม)
3. เลือก plan (แนะนำ KVM 2 หรือสูงกว่า)
4. หลัง provision จด **IP ใหม่** ไว้ → ในคู่มือนี้แทนด้วย `<NEW_IP>`

---

## Step 2: Backup ที่ VPS เก่า

### 2.1 SSH เข้า VPS เก่า

```bash
ssh root@72.62.64.163
```

### 2.2 หยุด container ทั้งหมด (เพื่อให้ data consistent)

```bash
cd /opt/ai-stack && docker compose down
cd /opt/mt5 && docker compose down
```

### 2.3 สร้างโฟลเดอร์ backup

```bash
mkdir -p /root/backup && cd /root/backup
```

### 2.4 Backup volumes ทั้ง 4 ตัว

```bash
for vol in ai-stack_traefik_data ai-stack_n8n_data ai-stack_qdrant_data ai-stack_lightrag_data; do
  docker run --rm \
    -v $vol:/data \
    -v /root/backup:/backup \
    alpine tar czf /backup/$vol.tar.gz -C /data .
done
```

### 2.5 Backup compose files และ MT5 bind mount

```bash
tar czf /root/backup/ai-stack-config.tar.gz -C /opt ai-stack
tar czf /root/backup/mt5-all.tar.gz -C /opt mt5
```

### 2.6 ตรวจสอบ

```bash
ls -lh /root/backup/
du -sh /root/backup/
```

---

## Step 3: โอนไฟล์ไป VPS ใหม่

### วิธี A — `scp` ตรงระหว่าง VPS

```bash
# ที่ VPS เก่า
scp /root/backup/*.tar.gz root@<NEW_IP>:/root/
```

### วิธี B — ผ่านเครื่อง Windows (ถ้าวิธี A ไม่ได้)

PowerShell บน Windows:
```powershell
mkdir C:\backup
scp root@72.62.64.163:/root/backup/*.tar.gz C:\backup\
scp C:\backup\*.tar.gz root@<NEW_IP>:/root/
```

---

## Step 4: Restore ที่ VPS ใหม่

### 4.1 SSH เข้า VPS ใหม่

```bash
ssh root@<NEW_IP>
```

### 4.2 หยุด Traefik default ที่มากับ template

```bash
docker ps
docker stop traefik && docker rm traefik
```

### 4.3 แตก compose files

```bash
cd /opt
tar xzf /root/ai-stack-config.tar.gz
tar xzf /root/mt5-all.tar.gz
```

### 4.4 สร้าง network

```bash
docker network create ai-stack_app_net
```

### 4.5 Restore volumes ทั้ง 4 ตัว

```bash
for vol in ai-stack_traefik_data ai-stack_n8n_data ai-stack_qdrant_data ai-stack_lightrag_data; do
  docker volume create $vol
  docker run --rm \
    -v $vol:/data \
    -v /root:/backup \
    alpine sh -c "cd /data && tar xzf /backup/$vol.tar.gz"
done
```

### 4.6 Start ai-stack

```bash
cd /opt/ai-stack
docker compose up -d
```

### 4.7 Start MT5

```bash
cd /opt/mt5
docker compose up -d
```

### 4.8 ตรวจสอบ

```bash
docker ps
```

ต้องเห็น 5 containers รันอยู่: `traefik`, `n8n`, `qdrant`, `lightrag`, `mt5`

---

## Step 5: อัพเดท DNS Records

ที่ Hostinger hPanel → **Domains** → `multivps.cloud` → **DNS / Nameservers**

อัพเดท A records ทั้ง 4 ให้ชี้ไป `<NEW_IP>`:

| Name | Type | จาก | เป็น |
|------|------|-----|------|
| mt5.srv1637353.hstgr.cloud | A | 72.62.64.163 | `<NEW_IP>` |
| n8n.srv1637353.hstgr.cloud | A | 72.62.64.163 | `<NEW_IP>` |
| qdrant.srv1637353.hstgr.cloud | A | 72.62.64.163 | `<NEW_IP>` |
| lightrag.srv1637353.hstgr.cloud | A | 72.62.64.163 | `<NEW_IP>` |

---

## Step 6: ตั้ง Firewall ที่ VPS ใหม่

hPanel → VPS → VPS ใหม่ → **Settings → Security → Firewall**

สร้าง firewall ใหม่ + เพิ่ม rules:

| Protocol | Port | Source |
|----------|------|--------|
| TCP | 22 | any |
| TCP | 80 | any |
| TCP | 443 | any |

แล้วกด **Activate**

---

## Step 7: ตรวจสอบทุก Service

รอ DNS propagate (5–30 นาที) แล้วเปิด:
- https://mt5.srv1637353.hstgr.cloud
- https://n8n.srv1637353.hstgr.cloud
- https://qdrant.srv1637353.hstgr.cloud
- https://lightrag.srv1637353.hstgr.cloud

ถ้า SSL error → รอ 1-2 นาทีให้ Traefik ขอ cert ใหม่

---

## Step 8: ปิด VPS เก่า

หลัง confirm ว่า VPS ใหม่ใช้งานได้ครบ 1-2 วัน:

1. Snapshot VPS เก่าเก็บไว้
2. Cancel subscription ใน hPanel

---

## ข้อควรระวัง

| เรื่อง | คำเตือน |
|--------|--------|
| Downtime | ระบบจะ down ระหว่าง Step 2.2 ถึง Step 4.8 (~30-60 นาที) |
| SSL | Traefik ขอ cert ใหม่ ใช้เวลา 1-2 นาที |
| DNS TTL | บาง record TTL 14400 = propagate ช้า ควรลด TTL เป็น 300 ก่อนย้าย 1 วัน |
| n8n encryption key | อยู่ใน volume — ต้องย้ายมาด้วยไม่งั้น credentials เปิดไม่ได้ |

---

## Troubleshooting

### Container start ไม่ขึ้น

```bash
docker logs <container_name> --tail 50
```

### Traefik ไม่ออก SSL

```bash
docker logs traefik | grep -i error
```

ตรวจสอบว่า DNS ชี้ถูกแล้ว:
```bash
dig mt5.srv1637353.hstgr.cloud
```

### Volume restore ไม่ครบ

ตรวจสอบขนาด:
```bash
du -sh /var/lib/docker/volumes/ai-stack_*
```
