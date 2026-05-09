# 13 - GitHub Setup Guide

## Overview

This document covers the GitHub setup for the Knight Furnich workspace on Windows 11.

- **GitHub Account:** Knightfurnich
- **Email:** support@knightfurnich.com
- **Repository:** https://github.com/Knightfurnich/KnightFurnich
- **Setup Date:** 2026-05-09

---

## Prerequisites

- Windows 11
- PowerShell
- Internet connection

---

## What Was Installed

| Tool | Version | Method |
|---|---|---|
| Git for Windows | 2.54.0 | Pre-installed |
| GitHub CLI (gh) | 2.92.0 | winget |

---

## Installation Steps

### 1. Install GitHub CLI

```powershell
winget install GitHub.cli --accept-package-agreements --accept-source-agreements
```

### 2. Configure Git Identity

```powershell
git config --global user.email "support@knightfurnich.com"
git config --global user.name "Knight Furnich"
```

Verify:

```powershell
git config --global --list
```

### 3. Authenticate GitHub CLI

```powershell
gh auth login
```

選択した設定:
- Account: **GitHub.com**
- Protocol: **HTTPS**
- Authenticate Git with credentials: **Yes**
- Auth method: **Login with a web browser**

Copy the one-time code shown → open browser → paste code → approve.

Verify login:

```powershell
gh auth status
```

Expected output:
```
github.com
  ✓ Logged in to github.com account Knightfurnich (keyring)
  - Active account: true
  - Git operations protocol: https
  - Token scopes: 'gist', 'read:org', 'repo', 'workflow'
```

### 4. Initialize Local Repository

```powershell
cd D:\ClaudeCodeWorkSpace
git init
```

### 5. Create Initial Commit

```powershell
git add .
git commit -m "Initial commit"
```

### 6. Create GitHub Repository and Push

```powershell
gh repo create KnightFurnich --public --source=. --push
```

This command:
- Creates the remote repository on GitHub
- Adds the remote origin URL
- Pushes all commits to GitHub

---

## Daily Workflow

### Save changes to GitHub

```powershell
git add .
git commit -m "describe what changed"
git push
```

### Check file status

```powershell
git status
```

### View commit history

```powershell
git log --oneline
```

### Pull latest changes (if working from multiple machines)

```powershell
git pull
```

---

## Repository Structure

```
D:\ClaudeCodeWorkSpace\
├── .claude/
│   └── settings.local.json
└── docs/
    ├── 01-migrate-docker-stack-to-new-vps.md
    ├── 02-docker-images-containers-volumes-explained.md
    ├── 03-mt5-installation.md
    ├── 04-ai-stack-installation-traefik-n8n-qdrant-lightrag.md
    ├── 05-openclaw-installation-line-telegram.md
    ├── 06-vps-state-snapshot.md
    ├── 07-hermes-installation.md
    ├── 08-backup-restore.md
    ├── 09-new-pc-setup.md
    ├── 10-paperclip-installation.md
    ├── 11-n8n-mcp-claude-code.md
    ├── 12-paperclip-mcp-claude-code.md
    ├── 13-github-setup.md        ← this file
    ├── MT5_Backup_Restore_Guide.docx
    └── gen_mt5_doc.js
```

---

## Notes

- **LF/CRLF warnings** during `git add` are normal on Windows — Git converts line endings automatically and does not affect functionality.
- **PATH refresh:** After installing GitHub CLI in a running PowerShell session, refresh PATH before using `gh`:
  ```powershell
  $env:PATH = [System.Environment]::GetEnvironmentVariable("PATH","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("PATH","User")
  ```
  New PowerShell sessions will pick up the PATH automatically.
- Token is stored securely in Windows Credential Manager (keyring).
