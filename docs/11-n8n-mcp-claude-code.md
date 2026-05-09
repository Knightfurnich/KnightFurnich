# คู่มือเชื่อมต่อ n8n MCP กับ Claude Code

> **เป้าหมาย:** เชื่อมต่อ n8n instance เข้ากับ Claude Code ผ่าน MCP (Model Context Protocol) เพื่อให้ Claude Code สามารถจัดการ workflows ใน n8n ได้โดยตรง

---

## ข้อมูลอ้างอิง

| รายการ | ค่า |
|--------|-----|
| n8n URL | `https://n8n.srv1637353.hstgr.cloud` |
| Package | `n8n-mcp` (npm) |
| Config file | `C:\Users\USER\.claude.json` |

---

## ขั้นตอนการติดตั้ง

### 1. เปิดไฟล์ `~/.claude.json`

ไฟล์นี้เป็น config หลักของ Claude Code สำหรับ User MCPs  
(ไม่ใช่ `~/.claude/settings.json` — ตัวนั้นใช้สำหรับอย่างอื่น)

### 2. เพิ่ม n8n MCP ใน `mcpServers`

```json
{
  "mcpServers": {
    "n8n": {
      "command": "C:\\Program Files\\nodejs\\npx.cmd",
      "args": ["-y", "n8n-mcp"],
      "env": {
        "N8N_API_KEY": "<your-n8n-api-key>",
        "N8N_API_URL": "https://n8n.srv1637353.hstgr.cloud",
        "MCP_MODE": "stdio",
        "LOG_LEVEL": "error",
        "DISABLE_CONSOLE_OUTPUT": "true"
      }
    }
  }
}
```

### 3. Restart Claude Code

หลัง restart ควรเห็น `n8n · √ connected · 24 tools` ใน `/mcp`

---

## Environment Variables ที่สำคัญ

| Variable | ค่า | หมายเหตุ |
|----------|-----|---------|
| `N8N_API_KEY` | JWT token จาก n8n | Settings → API → Create API Key |
| `N8N_API_URL` | URL ของ n8n instance | ต้องไม่มี trailing slash |
| `MCP_MODE` | `stdio` | **สำคัญมาก** — ถ้าขาดตัวนี้ server จะ fail |
| `LOG_LEVEL` | `error` | ลด noise จาก logs |
| `DISABLE_CONSOLE_OUTPUT` | `true` | ป้องกัน debug output รบกวน stdout |

> ⚠️ **`MCP_MODE=stdio` คือสาเหตุหลักที่ทำให้ fail** — ถ้าไม่ set ค่านี้ debug logs จะถูกส่งไป stdout แล้วทำให้ JSON-RPC protocol เสีย Claude Code จะเห็นเป็น malformed response และ mark server ว่า failed

---

## วิธีสร้าง n8n API Key

1. เข้า n8n → **Settings** → **n8n API**
2. คลิก **Create an API key**
3. Copy key มาใส่ใน `N8N_API_KEY`

---

## Tools ที่ได้หลัง connect (24 tools)

| Tool | ทำอะไร |
|------|--------|
| `n8n_list_workflows` | ดูรายการ workflows ทั้งหมด |
| `n8n_get_workflow` | อ่าน workflow แบบ full detail |
| `n8n_create_workflow` | สร้าง workflow ใหม่ |
| `n8n_generate_workflow` | ให้ AI generate workflow จาก description |
| `n8n_update_full_workflow` | แก้ไข workflow ทั้ง workflow |
| `n8n_update_partial_workflow` | แก้ไข workflow เฉพาะส่วน |
| `n8n_delete_workflow` | ลบ workflow |
| `n8n_test_workflow` | ทดสอบ workflow |
| `n8n_executions` | ดู execution history |
| `n8n_validate_workflow` | validate workflow ก่อน deploy |
| `n8n_autofix_workflow` | ให้ AI แก้ปัญหาใน workflow อัตโนมัติ |
| `n8n_manage_credentials` | จัดการ credentials |
| `n8n_manage_datatable` | จัดการ data tables |
| `n8n_audit_instance` | ตรวจสอบ security ของ n8n instance |
| `n8n_health_check` | เช็คสถานะ n8n |
| `n8n_workflow_versions` | ดู version history |
| `n8n_deploy_template` | deploy จาก template |
| `search_nodes` | ค้นหา nodes |
| `search_templates` | ค้นหา templates |
| `get_node` | ดู node documentation |
| `get_template` | ดู template detail |
| `validate_node` | validate node config |
| `validate_workflow` | validate workflow schema |
| `tools_documentation` | ดู MCP tools documentation |

---

## Troubleshooting

### n8n · × failed

**สาเหตุที่พบบ่อย:**

1. **`MCP_MODE` ไม่ได้ set** → เพิ่ม `"MCP_MODE": "stdio"` ใน env
2. **ชื่อ env var ผิด** → ต้องใช้ `N8N_API_URL` (ไม่ใช่ `N8N_BASE_URL`)
3. **Package ไม่มีอยู่** → package ชื่อ `n8n-mcp` (ไม่ใช่ `@n8n/mcp-server`)
4. **แก้ไขผิด file** → ต้องแก้ `~/.claude.json` ไม่ใช่ `~/.claude/settings.json`

### ตรวจสอบว่า n8n API ใช้ได้

```powershell
Invoke-WebRequest -Uri "https://n8n.srv1637353.hstgr.cloud/api/v1/workflows" `
  -Headers @{ "X-N8N-API-KEY" = "<your-api-key>" } `
  -Method GET -UseBasicParsing
```

ถ้าได้ `Status: 200` = API ใช้ได้ ปัญหาอยู่ที่ MCP config

### ทดสอบ package ก่อน restart

```powershell
$env:N8N_API_KEY = "<your-api-key>"
$env:N8N_API_URL = "https://n8n.srv1637353.hstgr.cloud"
$env:MCP_MODE = "stdio"
& "C:\Program Files\nodejs\npx.cmd" -y n8n-mcp
# ถ้าขึ้น "stdin closed, shutting down..." = ปกติ (รอ input)
```

---

## Config สำเร็จรูปสมบูรณ์

```json
"n8n": {
  "command": "C:\\Program Files\\nodejs\\npx.cmd",
  "args": ["-y", "n8n-mcp"],
  "env": {
    "N8N_API_KEY": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "N8N_API_URL": "https://n8n.srv1637353.hstgr.cloud",
    "MCP_MODE": "stdio",
    "LOG_LEVEL": "error",
    "DISABLE_CONSOLE_OUTPUT": "true"
  }
}
```
