# คู่มือ: ตั้งค่า PC ใหม่ + Claude Code + Hostinger MCP

> **เป้าหมาย:** หลังจากเปลี่ยน PC ใหม่ — ทำตาม doc นี้ทีละขั้นแล้วจะกลับมาทำงานได้เหมือนเดิมทุกอย่าง

---

## ข้อมูล Infrastructure ปัจจุบัน (อ้างอิง)

| รายการ | ค่า |
|---|---|
| **VPS ID** | 1637353 |
| **Hostname** | `srv1637353.hstgr.cloud` |
| **IP (IPv4)** | `72.62.64.163` |
| **IP (IPv6)** | `2a02:4780:5e:64f9::1` |
| **Plan** | KVM 2 (2 CPU / 8 GB RAM / 100 GB disk) |
| **OS Template** | Ubuntu 24.04 with Docker and Traefik |
| **Data Center ID** | 21 |
| **Subscription ID** | `AzZsbyVISpOszCeN3` |
| **Nameservers** | `153.92.2.6` / `1.1.1.1` |
| **Firewall** | `web-only` (id: 283226) — TCP 22, 80, 443 open |

### Services บน VPS

| Subdomain | Service | Path |
|---|---|---|
| `n8n.srv1637353.hstgr.cloud` | n8n | `/opt/ai-stack/` |
| `qdrant.srv1637353.hstgr.cloud` | Qdrant | `/opt/ai-stack/` |
| `lightrag.srv1637353.hstgr.cloud` | LightRAG | `/opt/ai-stack/` |
| `openclaw.srv1637353.hstgr.cloud` | OpenClaw | `/opt/openclaw/` |
| `mt5.srv1637353.hstgr.cloud` | MetaTrader 5 | `/opt/mt5/` |
| `hermes.srv1637353.hstgr.cloud` | Hermes Agent | `/opt/hermes/` |

> **certresolver ใช้ชื่อ:** `mytlschallenge`
> **Shared network:** `ai-stack_app_net` (external)

---

## Step 1: ติดตั้ง Software หลัก

### 1.1 Node.js (จำเป็นสำหรับ Hostinger MCP)

1. ดาวน์โหลด Node.js LTS จาก https://nodejs.org
2. ติดตั้งด้วย default settings
3. ตรวจสอบ:
   ```
   node --version   → v26.x.x หรือสูงกว่า
   npx --version    → 11.x.x หรือสูงกว่า
   ```

### 1.2 Git + SSH

```powershell
# ติดตั้ง Git จาก https://git-scm.com
# ตรวจสอบ
git --version
```

สร้าง SSH key สำหรับ VPS:
```powershell
ssh-keygen -t ed25519 -C "your-email@example.com"
# Key จะอยู่ที่ C:\Users\<username>\.ssh\id_ed25519.pub
```

Copy public key ไปใส่ VPS:
```powershell
# Copy key
Get-Content C:\Users\<username>\.ssh\id_ed25519.pub
# แล้ว paste ใน VPS ที่ ~/.ssh/authorized_keys
# หรือใช้ Hostinger MCP: VPS_createPublicKeyV1
```

### 1.3 Claude Code (VS Code Extension)

1. ติดตั้ง VS Code จาก https://code.visualstudio.com
2. ใน Extensions → ค้นหา **"Claude Code"** โดย Anthropic → Install
3. Login ด้วย Anthropic account

---

## Step 2: สร้าง Workspace

```powershell
mkdir D:\ClaudeCodeWorkSpace
cd D:\ClaudeCodeWorkSpace
```

Clone หรือ copy โฟลเดอร์ `docs\` มาด้วย (มี doc ทุกอย่างอยู่ในนั้น)

---

## Step 3: ตั้งค่า Hostinger MCP

### 3.1 API Token
```
API Token: 54N78cbQIVErnlukHsBAuZWdaa43ClANrFxj5u6Q2da2b7ec
```
> ⚠️ ถ้า token หมดอายุหรือถูก revoke → ไปออกใหม่ที่ https://hpanel.hostinger.com → API

### 3.2 เพิ่ม MCP ใน `~/.claude.json`

เปิดไฟล์ `C:\Users\<username>\.claude.json` แล้วเพิ่ม key `mcpServers` ที่ต้นไฟล์ (หลัง `{` แรก):

```json
{
  "mcpServers": {
    "hostinger-mcp": {
      "command": "C:\\Program Files\\nodejs\\npx.cmd",
      "args": ["hostinger-api-mcp@latest"],
      "env": {
        "API_TOKEN": "54N78cbQIVErnlukHsBAuZWdaa43ClANrFxj5u6Q2da2b7ec"
      }
    }
  },
  ...ส่วนที่เหลือของไฟล์...
}
```

> **หมายเหตุ:** ต้องใช้ full path `C:\\Program Files\\nodejs\\npx.cmd` เพราะ Claude Code ไม่ได้ inherit PATH ของ Windows ทั้งหมด

### 3.3 ตรวจสอบว่า Server เริ่มได้

ทดสอบใน PowerShell:
```powershell
$env:API_TOKEN = "54N78cbQIVErnlukHsBAuZWdaa43ClANrFxj5u6Q2da2b7ec"
& "C:\Program Files\nodejs\npx.cmd" hostinger-api-mcp@latest
# ควรเห็น: MCP Server starting on stdio transport
# และ: Registered 118 tools
```

### 3.4 Restart Claude Code

ปิด VS Code แล้วเปิดใหม่ → Hostinger MCP จะ load อัตโนมัติ (118 tools)

---

## Step 4: ตั้งค่า `~/.claude/settings.json`

สร้างไฟล์ `C:\Users\<username>\.claude\settings.json`:

```json
{
  "mcpServers": {
    "hostinger-mcp": {
      "command": "C:\\Program Files\\nodejs\\npx.cmd",
      "args": ["hostinger-api-mcp@latest"],
      "env": {
        "API_TOKEN": "54N78cbQIVErnlukHsBAuZWdaa43ClANrFxj5u6Q2da2b7ec"
      }
    }
  }
}
```

> **Note:** ใส่ทั้งใน `.claude.json` (หลัก) และ `settings.json` (สำรอง) เพื่อให้แน่ใจว่า Claude Code โหลดได้

---

## Step 5: ทดสอบว่าทุกอย่าง Work

### ทดสอบ VPS Connection (ผ่าน Hostinger MCP)
บอก Claude ว่า:
```
ดึงข้อมูล VPS ทั้งหมดของฉัน
```
ควรเห็น VPS id 1637353 / IP 72.62.64.163

### ทดสอบ SSH
```powershell
ssh root@72.62.64.163
/root/scripts/vps-snapshot.sh
```

---

## Step 6: Workspace Docs Reference

| ไฟล์ | เนื้อหา |
|---|---|
| `docs/01-migrate-docker-stack-to-new-vps.md` | วิธีย้าย Docker stack ไป VPS ใหม่ |
| `docs/02-docker-images-containers-volumes-explained.md` | อธิบาย Docker concepts |
| `docs/03-mt5-installation.md` | ติดตั้ง MetaTrader 5 |
| `docs/04-ai-stack-installation-traefik-n8n-qdrant-lightrag.md` | ติดตั้ง AI Stack |
| `docs/05-openclaw-installation-line-telegram.md` | ติดตั้ง OpenClaw |
| `docs/06-vps-state-snapshot.md` | Script snapshot สถานะ VPS |
| `docs/07-hermes-installation.md` | ติดตั้ง Hermes Agent |
| `docs/08-backup-restore.md` | Backup & Restore |
| `docs/09-new-pc-setup.md` | ไฟล์นี้ — PC setup guide |

---

## Troubleshooting

### Hostinger MCP ไม่ขึ้นหลัง restart
1. ตรวจสอบว่า `mcpServers` อยู่ใน `~/.claude.json` (ไม่ใช่แค่ `settings.json`)
2. ตรวจสอบ path: `C:\Program Files\nodejs\npx.cmd` ต้องมีอยู่จริง
3. ทดสอบ npx ใน PowerShell ก่อน

### npx ไม่พบ
```powershell
Get-Command npx | Select-Object -ExpandProperty Source
# ถ้าไม่เจอ → ติดตั้ง Node.js ใหม่
```

### SSH เข้า VPS ไม่ได้
- ตรวจสอบ Firewall ที่ hPanel — port 22 ต้องเปิด
- Firewall name: `web-only` (id: 283226)
- ใช้ Hostinger MCP: `VPS_getFirewallDetailsV1` เพื่อตรวจสอบ

### ต่ออายุ API Token
1. ไปที่ https://hpanel.hostinger.com → Profile → API
2. สร้าง token ใหม่
3. อัพเดทใน `~/.claude.json` และ `~/.claude/settings.json`

---

## Quick Commands (หลัง setup เสร็จ)

```powershell
# SSH เข้า VPS
ssh root@72.62.64.163

# ดู snapshot สถานะ VPS
/root/scripts/vps-snapshot.sh

# ดู Docker containers
docker ps

# ดู logs service ใดก็ได้
docker logs <container_name> --tail 50
```

---

## Hostinger MCP Tools หลักที่ใช้บ่อย

| Tool | ใช้ทำอะไร |
|---|---|
| `VPS_getVirtualMachinesV1` | ดูรายการ VPS ทั้งหมด |
| `VPS_getVirtualMachineDetailsV1` | ดูรายละเอียด VPS |
| `VPS_restartVirtualMachineV1` | Restart VPS |
| `VPS_createSnapshotV1` | สร้าง snapshot |
| `VPS_getFirewallListV1` | ดู firewall rules |
| `DNS_getDNSRecordsV1` | ดู DNS records ของ domain |
| `DNS_updateDNSRecordsV1` | แก้ไข DNS records |
| `VPS_getMetricsV1` | ดู CPU/RAM/bandwidth metrics |
| `VPS_getBackupsV1` | ดูรายการ backups |

---

*อัพเดทล่าสุด: 2026-05-08*
