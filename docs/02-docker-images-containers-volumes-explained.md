# คู่มืออธิบาย Docker: Images, Containers, Volumes

> อธิบายความหมายและความสัมพันธ์ของ Docker components บน VPS

---

## ภาพรวมแนวคิด

| คำศัพท์ | เปรียบเทียบ | สถานะ |
|---------|-------------|-------|
| **Image** | สูตรอาหาร / template สำเร็จรูป | อ่านอย่างเดียว (read-only) |
| **Container** | อาหารที่ทำเสร็จ / instance ที่กำลังรัน | เปลี่ยนแปลงได้ |
| **Volume** | ตู้เก็บของถาวร | เก็บข้อมูลแม้ลบ container |

---

## 1. Images (Template)

Image คือแพ็กเกจสำเร็จรูปบรรจุ OS + โปรแกรม + dependencies ครบ พร้อมรัน

### Images ในระบบ (5 ตัว, รวม 7.4 GB)

| # | Image | ขนาด | ใช้ทำอะไร |
|---|-------|------|----------|
| 1 | `traefik:latest` | 245 MB | Reverse proxy + SSL auto-renewal |
| 2 | `docker.n8n.io/n8nio/n8n:latest` | 2.28 GB | Workflow automation (เหมือน Zapier) |
| 3 | `qdrant/qdrant:latest` | 285 MB | Vector database สำหรับ AI |
| 4 | `ghcr.io/hkuds/lightrag:latest` | 2.34 GB | RAG framework สำหรับ LLM |
| 5 | `gmag11/metatrader5_vnc:1.0` | 2.17 GB | MT5 + VNC web access |

### ทำไม image ถึงใหญ่?

แต่ละ image บรรจุ OS + Python/Node + dependencies ทั้งหมด ไม่ต้องติดตั้งเพิ่ม

### คำสั่งที่เกี่ยวข้อง

```bash
docker images                    # ดู image ทั้งหมด
docker pull <image>              # ดาวน์โหลด image
docker rmi <image>               # ลบ image
docker image prune               # ลบ image ที่ไม่ใช้
```

---

## 2. Containers (Running Instance)

Container คือ image ที่ถูกรัน = process ที่กำลังทำงาน

### Architecture ของระบบ

```
                    Internet (HTTPS)
                          ↓ port 443
                    ┌──────────────┐
                    │   traefik    │  (reverse proxy)
                    └──────┬───────┘
                           │
       ┌───────────────────┼───────────────────┬─────────────────┐
       ↓                   ↓                   ↓                 ↓
  ┌─────────┐         ┌─────────┐         ┌─────────┐      ┌─────────┐
  │  n8n    │         │ qdrant  │         │lightrag │      │   mt5   │
  │ (5678)  │         │ (6333)  │         │ (9621)  │      │ (3000)  │
  └─────────┘         └─────────┘         └─────────┘      └─────────┘
```

### Containers ในระบบ (5 ตัว, รวม 88 MB)

| Container | Domain | Internal Port |
|-----------|--------|--------------|
| traefik | (ฟัง 80, 443) | - |
| n8n | https://n8n.srv1637353.hstgr.cloud | 5678 |
| qdrant | https://qdrant.srv1637353.hstgr.cloud | 6333 |
| lightrag | https://lightrag.srv1637353.hstgr.cloud | 9621 |
| mt5 | https://mt5.srv1637353.hstgr.cloud | 3000 |

### ทำไม container ถึงเล็ก (88 MB)?

Container แชร์ image กับ disk หลัก เก็บแค่ส่วนที่เปลี่ยนไปจาก image

### คำสั่งที่เกี่ยวข้อง

```bash
docker ps                        # ดู container ที่รันอยู่
docker ps -a                     # ดูทั้งหมด (รวมที่หยุด)
docker logs <name>               # ดู log
docker logs <name> -f            # ดู log แบบ real-time
docker restart <name>            # restart
docker stop <name>               # หยุด
docker rm <name>                 # ลบ
docker exec -it <name> bash      # เข้าไปใน container
```

---

## 3. Volumes (Persistent Storage)

Volume คือพื้นที่เก็บข้อมูลถาวร "นอก" container

> สำคัญ: ลบ container แล้วข้อมูลใน container หาย — แต่ volume ยังอยู่

### Volumes ในระบบ (4 ตัว, รวม 467 MB)

| # | Volume | เก็บอะไร |
|---|--------|---------|
| 1 | `ai-stack_traefik_data` | SSL certificates ของ Let's Encrypt |
| 2 | `ai-stack_n8n_data` | Workflows, credentials, executions, encryption key |
| 3 | `ai-stack_qdrant_data` | Vector embeddings |
| 4 | `ai-stack_lightrag_data` | Knowledge graph |

> MT5 ไม่ใช้ named volume — ใช้ **bind mount** `/opt/mt5/mt5-data` (1.3 GB) แทน

### Named Volume vs Bind Mount

| | Named Volume | Bind Mount |
|---|-------------|-----------|
| ตัวอย่าง | `ai-stack_n8n_data` | `/opt/mt5/mt5-data` |
| ที่อยู่จริง | `/var/lib/docker/volumes/...` | path ที่กำหนดเอง |
| Docker จัดการ | ใช่ | ไม่ |
| Backup ง่าย | ใช้ docker cp | copy folder ตรงๆ |

### คำสั่งที่เกี่ยวข้อง

```bash
docker volume ls                                          # ดู volume ทั้งหมด
docker volume inspect <name>                              # ดูรายละเอียด
docker volume rm <name>                                   # ลบ
docker volume prune                                       # ลบที่ไม่ใช้

# Backup volume
docker run --rm -v <vol>:/data -v $(pwd):/backup \
  alpine tar czf /backup/<vol>.tar.gz -C /data .

# Restore volume
docker run --rm -v <vol>:/data -v $(pwd):/backup \
  alpine sh -c "cd /data && tar xzf /backup/<vol>.tar.gz"
```

---

## ความสัมพันธ์ทั้งหมด

```
   Docker Hub
       ↓ (pull)
    Image (template, read-only)
       ↓ (run)
    Container (running instance)
       ↓ (read/write)
    Volume (persistent data)
```

### ตัวอย่างกับ n8n

1. Pull image `n8nio/n8n` จาก Docker Hub
2. รันเป็น container ชื่อ `n8n`
3. เก็บ workflows ใน volume `ai-stack_n8n_data`
4. ถ้าอัพเดท n8n → ลบ container เก่า สร้างใหม่ → workflows **ยังอยู่** เพราะอยู่ใน volume

---

## สถานะของระบบ "Healthy"

ตรวจสอบด้วย:
```bash
docker system df
```

ผลลัพธ์ที่ดี:
```
TYPE            TOTAL     ACTIVE    SIZE      RECLAIMABLE
Images          5         5         7.4GB     0B (0%)
Containers      5         5         88MB      0B (0%)
Local Volumes   4         4         467MB     0B (0%)
```

ความหมาย:
- **Active = Total** → ทุกชิ้นใช้งาน
- **Reclaimable 0B** → ไม่มีของเสีย/ขยะ

ถ้ามี image ที่ไม่ active = มีของรกในระบบ ลบได้ด้วย `docker image prune`

---

## คำสั่งทำความสะอาดที่ปลอดภัย

```bash
# ลบ volume ที่ไม่ผูกกับ container
docker volume prune -f

# ลบ image ที่ไม่ใช้
docker image prune -f

# ลบ container ที่หยุดแล้ว
docker container prune -f

# ดู disk usage
docker system df
```

> คำสั่งห้ามใช้: `docker system prune -a` (จะลบ image ทั้งหมด ทำให้ container restart ไม่ขึ้น)

---

## Quick Reference

| ต้องการ | คำสั่ง |
|---------|--------|
| ดู container ทั้งหมด | `docker ps -a` |
| ดู logs | `docker logs <name> --tail 50 -f` |
| Restart container | `docker restart <name>` |
| ดู disk usage | `docker system df` |
| ลบ container ที่หยุด | `docker container prune` |
| ลบ image ไม่ใช้ | `docker image prune` |
| Restart stack | `cd /opt/<stack> && docker compose down && docker compose up -d` |
