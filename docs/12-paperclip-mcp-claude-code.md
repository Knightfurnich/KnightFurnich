# คู่มือเชื่อมต่อ Paperclip MCP กับ Claude Code

> **เป้าหมาย:** เชื่อมต่อ Paperclip instance เข้ากับ Claude Code ผ่าน MCP (Model Context Protocol) เพื่อให้ Claude Code สามารถจัดการ Issues, Agents, Approvals, Documents และอื่นๆ ใน Paperclip ได้โดยตรง

---

## ข้อมูลอ้างอิง

| รายการ | ค่า |
|--------|-----|
| Paperclip URL | `https://paperclip.srv1637353.hstgr.cloud` |
| Package | `@paperclipai/mcp-server` (npm) |
| Config file | `C:\Users\USER\.claude.json` |
| Company | AI-Innovation |
| Agent | Claude Code MCP |

---

## ข้อมูล Credentials

| รายการ | ค่า |
|--------|-----|
| Admin Email | `johnnopy9@gmail.com` |
| Admin Name | Aunop |
| Company ID | `db8b8070-94e4-4c60-a195-11bc2b559ff4` |
| Agent ID | `00ca1448-2142-4c82-8d7d-6fc74635c7e7` |
| API Key | `pcp_c70c1ddb3d639b6cce56161c2e47f22c88c009f523f595b3` |

---

## ขั้นตอนการติดตั้ง

### 1. สร้าง Agent ใน Paperclip (ถ้ายังไม่มี)

```bash
# Login ก่อน
SESSION=$(curl -s -X POST "https://paperclip.srv1637353.hstgr.cloud/api/auth/sign-in/email" \
  -H "Content-Type: application/json" \
  -d '{"email":"johnnopy9@gmail.com","password":"<password>"}' \
  | jq -r '.token')

# สร้าง Agent
curl -s -X POST "https://paperclip.srv1637353.hstgr.cloud/api/companies/<COMPANY_ID>/agents" \
  -H "Cookie: __Secure-paperclip-default.session_token=<SESSION>" \
  -H "Content-Type: application/json" \
  -H "Origin: https://paperclip.srv1637353.hstgr.cloud" \
  -d '{"name":"Claude Code MCP","description":"MCP agent for Claude Code integration"}'

# สร้าง API Key สำหรับ Agent
curl -s -X POST "https://paperclip.srv1637353.hstgr.cloud/api/agents/<AGENT_ID>/keys" \
  -H "Cookie: __Secure-paperclip-default.session_token=<SESSION>" \
  -H "Content-Type: application/json" \
  -H "Origin: https://paperclip.srv1637353.hstgr.cloud" \
  -d '{"name":"claude-code-mcp-key"}'
```

> **หมายเหตุ:** Login response จะมี cookie ชื่อ `__Secure-paperclip-default.session_token` ต้องใช้ cookie นี้ (ไม่ใช่ token ใน body) สำหรับ mutation requests

### 2. เพิ่ม Paperclip MCP ใน `~/.claude.json`

```json
{
  "mcpServers": {
    "paperclip": {
      "command": "C:\\Program Files\\nodejs\\npx.cmd",
      "args": ["-y", "@paperclipai/mcp-server"],
      "env": {
        "PAPERCLIP_API_URL": "https://paperclip.srv1637353.hstgr.cloud",
        "PAPERCLIP_API_KEY": "pcp_c70c1ddb3d639b6cce56161c2e47f22c88c009f523f595b3",
        "PAPERCLIP_COMPANY_ID": "db8b8070-94e4-4c60-a195-11bc2b559ff4",
        "PAPERCLIP_AGENT_ID": "00ca1448-2142-4c82-8d7d-6fc74635c7e7"
      }
    }
  }
}
```

### 3. Restart Claude Code

หลัง restart ควรเห็น `paperclip · ✓ connected` ใน `/mcp`

---

## Environment Variables ที่สำคัญ

| Variable | ค่า | หมายเหตุ |
|----------|-----|---------|
| `PAPERCLIP_API_URL` | URL ของ Paperclip instance | ต้องไม่มี trailing slash |
| `PAPERCLIP_API_KEY` | API key ของ Agent | สร้างจาก `/api/agents/{id}/keys` |
| `PAPERCLIP_COMPANY_ID` | ID ของ Company | optional แต่แนะนำให้ใส่ |
| `PAPERCLIP_AGENT_ID` | ID ของ Agent ที่สร้างไว้ | optional แต่แนะนำให้ใส่ |

---

## วิธีสร้าง API Key ใหม่ (กรณี key หมดอายุหรือ revoke)

1. Login ผ่าน API เพื่อรับ session token
2. POST ไปที่ `/api/agents/{AGENT_ID}/keys` พร้อม `Origin` header
3. นำ `token` ที่ได้ไปใส่ใน `PAPERCLIP_API_KEY`

> **สำคัญ:** Paperclip ใช้ CSRF protection — mutation requests ทุกตัวต้องมี `Origin: https://paperclip.srv1637353.hstgr.cloud` header มิฉะนั้นจะได้รับ error "Board mutation requires trusted browser origin"

---

## Tools ที่ได้หลัง connect (39 tools)

| Tool | ทำอะไร |
|------|--------|
| `paperclipMe` | ดูข้อมูล user ปัจจุบัน |
| `paperclipListAgents` | ดูรายการ Agents ทั้งหมด |
| `paperclipGetAgent` | ดู Agent แบบ full detail |
| `paperclipListIssues` | ดูรายการ Issues |
| `paperclipGetIssue` | ดู Issue แบบ full detail |
| `paperclipCreateIssue` | สร้าง Issue ใหม่ |
| `paperclipUpdateIssue` | แก้ไข Issue |
| `paperclipCheckoutIssue` | Checkout Issue เพื่อทำงาน |
| `paperclipReleaseIssue` | Release Issue หลังทำงานเสร็จ |
| `paperclipListComments` | ดูรายการ Comments |
| `paperclipAddComment` | เพิ่ม Comment |
| `paperclipGetComment` | ดู Comment detail |
| `paperclipListProjects` | ดูรายการ Projects |
| `paperclipGetProject` | ดู Project detail |
| `paperclipListGoals` | ดูรายการ Goals |
| `paperclipGetGoal` | ดู Goal detail |
| `paperclipListApprovals` | ดูรายการ Approvals |
| `paperclipGetApproval` | ดู Approval detail |
| `paperclipCreateApproval` | สร้าง Approval ใหม่ |
| `paperclipApprovalDecision` | ตัดสินใจ Approve/Reject |
| `paperclipLinkIssueApproval` | Link Issue กับ Approval |
| `paperclipUnlinkIssueApproval` | Unlink Issue กับ Approval |
| `paperclipListIssueApprovals` | ดู Approvals ของ Issue |
| `paperclipGetApprovalIssues` | ดู Issues ของ Approval |
| `paperclipListApprovalComments` | ดู Comments ใน Approval |
| `paperclipAddApprovalComment` | เพิ่ม Comment ใน Approval |
| `paperclipListDocuments` | ดูรายการ Documents |
| `paperclipGetDocument` | ดู Document detail |
| `paperclipUpsertIssueDocument` | สร้าง/แก้ไข Document ของ Issue |
| `paperclipListDocumentRevisions` | ดู revision history ของ Document |
| `paperclipRestoreIssueDocumentRevision` | Restore Document กลับ revision เก่า |
| `paperclipSuggestTasks` | แนะนำ Tasks สำหรับ Issue |
| `paperclipRequestConfirmation` | ขอ confirmation จาก user |
| `paperclipAskUserQuestions` | ถาม user เพิ่มเติม |
| `paperclipGetHeartbeatContext` | ดู context ของ heartbeat run |
| `paperclipInboxLite` | ดู inbox แบบย่อ |
| `paperclipGetIssueWorkspaceRuntime` | ดู workspace runtime ของ Issue |
| `paperclipControlIssueWorkspaceServices` | ควบคุม workspace services |
| `paperclipWaitForIssueWorkspaceService` | รอ workspace service ให้พร้อม |
| `paperclipApiRequest` | เรียก Paperclip REST API โดยตรง (escape hatch) |

---

## Troubleshooting

### paperclip · × failed

**สาเหตุที่พบบ่อย:**

1. **API Key หมดอายุหรือถูก revoke** → สร้าง key ใหม่ผ่าน API
2. **Package ไม่ install** → รัน `npx -y @paperclipai/mcp-server` ครั้งแรกอาจใช้เวลา
3. **PAPERCLIP_API_URL ผิด** → ต้องไม่มี trailing slash
4. **Paperclip service down** → เช็ค `docker logs paperclip-paperclip-1` บน VPS

### ตรวจสอบ API Key ใช้ได้

```bash
curl -s "https://paperclip.srv1637353.hstgr.cloud/api/companies" \
  -H "Authorization: Bearer pcp_c70c1ddb3d639b6cce56161c2e47f22c88c009f523f595b3"
```

ถ้าได้ข้อมูล company = API key ใช้ได้

---

## Config สำเร็จรูปสมบูรณ์

```json
"paperclip": {
  "command": "C:\\Program Files\\nodejs\\npx.cmd",
  "args": ["-y", "@paperclipai/mcp-server"],
  "env": {
    "PAPERCLIP_API_URL": "https://paperclip.srv1637353.hstgr.cloud",
    "PAPERCLIP_API_KEY": "pcp_c70c1ddb3d639b6cce56161c2e47f22c88c009f523f595b3",
    "PAPERCLIP_COMPANY_ID": "db8b8070-94e4-4c60-a195-11bc2b559ff4",
    "PAPERCLIP_AGENT_ID": "00ca1448-2142-4c82-8d7d-6fc74635c7e7"
  }
}
```

---

*อัพเดทล่าสุด: 2026-05-08*
