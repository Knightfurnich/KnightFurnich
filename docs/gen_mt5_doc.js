const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  Header, Footer, AlignmentType, HeadingLevel, BorderStyle, WidthType,
  ShadingType, VerticalAlign, PageNumber, PageBreak, LevelFormat
} = require('C:/Users/USER/AppData/Roaming/npm/node_modules/docx');
const fs = require('fs');

// ── colours ──────────────────────────────────────────────────────────────────
const BLUE   = "1F497D";
const LBLUE  = "D6E4F0";
const DGRAY  = "404040";
const MGRAY  = "666666";
const LGRAY  = "F2F2F2";
const WHITE  = "FFFFFF";
const GREEN  = "E2EFDA";
const YELLOW = "FFF2CC";
const RED    = "FCE4D6";

// ── helpers ───────────────────────────────────────────────────────────────────
const cellBorder = (color = "CCCCCC") => {
  const b = { style: BorderStyle.SINGLE, size: 1, color };
  return { top: b, bottom: b, left: b, right: b };
};

function hdr(text, level = HeadingLevel.HEADING_1) {
  return new Paragraph({ heading: level, children: [new TextRun(text)] });
}

function body(text, opts = {}) {
  return new Paragraph({
    spacing: { after: 120 },
    children: [new TextRun({ text, font: "Arial", size: 22, color: DGRAY, ...opts })]
  });
}

function code(text) {
  return new Paragraph({
    spacing: { before: 60, after: 60 },
    shading: { fill: "F0F0F0", type: ShadingType.CLEAR },
    indent: { left: 360 },
    border: { left: { style: BorderStyle.SINGLE, size: 6, color: "888888", space: 8 } },
    children: [new TextRun({ text, font: "Courier New", size: 18, color: "333333" })]
  });
}

function spacer(lines = 1) {
  return new Paragraph({ spacing: { after: 160 * lines }, children: [] });
}

function pageBreak() {
  return new Paragraph({ children: [new PageBreak()] });
}

function label(text, fill = LBLUE) {
  return new Paragraph({
    spacing: { before: 180, after: 60 },
    shading: { fill, type: ShadingType.CLEAR },
    indent: { left: 0 },
    border: { left: { style: BorderStyle.SINGLE, size: 12, color: BLUE, space: 6 } },
    children: [new TextRun({ text, bold: true, font: "Arial", size: 22, color: BLUE })]
  });
}

function bullet(text) {
  return new Paragraph({
    numbering: { reference: "bullets", level: 0 },
    spacing: { after: 80 },
    children: [new TextRun({ text, font: "Arial", size: 22, color: DGRAY })]
  });
}

function headerRow(cells, widths) {
  return new TableRow({
    tableHeader: true,
    children: cells.map((txt, i) =>
      new TableCell({
        width: { size: widths[i], type: WidthType.DXA },
        shading: { fill: BLUE, type: ShadingType.CLEAR },
        margins: { top: 80, bottom: 80, left: 120, right: 120 },
        borders: cellBorder(BLUE),
        verticalAlign: VerticalAlign.CENTER,
        children: [new Paragraph({
          children: [new TextRun({ text: txt, bold: true, font: "Arial", size: 20, color: WHITE })]
        })]
      })
    )
  });
}

function dataRow(cells, widths, fill = WHITE) {
  return new TableRow({
    children: cells.map((txt, i) =>
      new TableCell({
        width: { size: widths[i], type: WidthType.DXA },
        shading: { fill, type: ShadingType.CLEAR },
        margins: { top: 80, bottom: 80, left: 120, right: 120 },
        borders: cellBorder("CCCCCC"),
        children: [new Paragraph({
          children: [new TextRun({ text: txt, font: "Arial", size: 20, color: DGRAY })]
        })]
      })
    )
  });
}

// ── DOCUMENT ─────────────────────────────────────────────────────────────────
const CONTENT_W = 9360; // US Letter 1-inch margins

const doc = new Document({
  numbering: {
    config: [{
      reference: "bullets",
      levels: [{ level: 0, format: LevelFormat.BULLET, text: "•", alignment: AlignmentType.LEFT,
        style: { paragraph: { indent: { left: 720, hanging: 360 } } } }]
    }]
  },
  styles: {
    default: { document: { run: { font: "Arial", size: 22 } } },
    paragraphStyles: [
      { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 36, bold: true, font: "Arial", color: BLUE },
        paragraph: { spacing: { before: 360, after: 180 }, outlineLevel: 0,
          border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: "AAAAAA", space: 4 } } } },
      { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 28, bold: true, font: "Arial", color: BLUE },
        paragraph: { spacing: { before: 280, after: 120 }, outlineLevel: 1 } },
      { id: "Heading3", name: "Heading 3", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 24, bold: true, font: "Arial", color: MGRAY },
        paragraph: { spacing: { before: 200, after: 80 }, outlineLevel: 2 } },
    ]
  },
  sections: [{
    properties: {
      page: {
        size: { width: 12240, height: 15840 },
        margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 }
      }
    },
    headers: {
      default: new Header({ children: [
        new Paragraph({
          border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: "CCCCCC", space: 4 } },
          children: [
            new TextRun({ text: "MT5 Container — Backup & Restore Guide", font: "Arial", size: 18, color: MGRAY }),
            new TextRun({ text: "\tv1.0  │  confidential", font: "Arial", size: 18, color: "AAAAAA" }),
          ],
          tabStops: [{ type: "right", position: 8640 }]
        })
      ]})
    },
    footers: {
      default: new Footer({ children: [
        new Paragraph({
          alignment: AlignmentType.CENTER,
          border: { top: { style: BorderStyle.SINGLE, size: 4, color: "CCCCCC", space: 4 } },
          children: [
            new TextRun({ text: "Page ", font: "Arial", size: 18, color: MGRAY }),
            new TextRun({ children: [PageNumber.CURRENT], font: "Arial", size: 18, color: MGRAY }),
            new TextRun({ text: " of ", font: "Arial", size: 18, color: MGRAY }),
            new TextRun({ children: [PageNumber.TOTAL_PAGES], font: "Arial", size: 18, color: MGRAY }),
          ]
        })
      ]})
    },
    children: [

      // ══════════════════ COVER PAGE ══════════════════
      spacer(4),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 120 },
        children: [new TextRun({ text: "MT5 CONTAINER", font: "Arial", size: 72, bold: true, color: BLUE })]
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 240 },
        children: [new TextRun({ text: "Backup & Restore Guide", font: "Arial", size: 48, color: MGRAY })]
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        border: { bottom: { style: BorderStyle.SINGLE, size: 8, color: BLUE, space: 4 } },
        spacing: { after: 240 },
        children: []
      }),
      spacer(1),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 80 },
        children: [new TextRun({ text: "Version 1.0", font: "Arial", size: 24, color: MGRAY })]
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 80 },
        children: [new TextRun({ text: "6 May 2026", font: "Arial", size: 24, color: MGRAY })]
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 80 },
        children: [new TextRun({ text: "srv1637353.hstgr.cloud  │  72.62.64.163", font: "Arial", size: 22, color: MGRAY })]
      }),
      spacer(3),

      new Table({
        width: { size: 7200, type: WidthType.DXA },
        columnWidths: [3600, 3600],
        rows: [
          new TableRow({ children: [
            new TableCell({
              width: { size: 3600, type: WidthType.DXA },
              shading: { fill: BLUE, type: ShadingType.CLEAR },
              margins: { top: 120, bottom: 120, left: 200, right: 200 },
              borders: cellBorder(BLUE),
              children: [new Paragraph({ children: [new TextRun({ text: "Server", bold: true, font: "Arial", size: 20, color: WHITE })] })]
            }),
            new TableCell({
              width: { size: 3600, type: WidthType.DXA },
              shading: { fill: LGRAY, type: ShadingType.CLEAR },
              margins: { top: 120, bottom: 120, left: 200, right: 200 },
              borders: cellBorder("CCCCCC"),
              children: [new Paragraph({ children: [new TextRun({ text: "srv1637353.hstgr.cloud", font: "Arial", size: 20, color: DGRAY })] })]
            })
          ]}),
          new TableRow({ children: [
            new TableCell({
              width: { size: 3600, type: WidthType.DXA },
              shading: { fill: BLUE, type: ShadingType.CLEAR },
              margins: { top: 120, bottom: 120, left: 200, right: 200 },
              borders: cellBorder(BLUE),
              children: [new Paragraph({ children: [new TextRun({ text: "Container", bold: true, font: "Arial", size: 20, color: WHITE })] })]
            }),
            new TableCell({
              width: { size: 3600, type: WidthType.DXA },
              shading: { fill: LGRAY, type: ShadingType.CLEAR },
              margins: { top: 120, bottom: 120, left: 200, right: 200 },
              borders: cellBorder("CCCCCC"),
              children: [new Paragraph({ children: [new TextRun({ text: "gmag11/metatrader5_vnc:1.0", font: "Arial", size: 20, color: DGRAY })] })]
            })
          ]}),
          new TableRow({ children: [
            new TableCell({
              width: { size: 3600, type: WidthType.DXA },
              shading: { fill: BLUE, type: ShadingType.CLEAR },
              margins: { top: 120, bottom: 120, left: 200, right: 200 },
              borders: cellBorder(BLUE),
              children: [new Paragraph({ children: [new TextRun({ text: "OS", bold: true, font: "Arial", size: 20, color: WHITE })] })]
            }),
            new TableCell({
              width: { size: 3600, type: WidthType.DXA },
              shading: { fill: LGRAY, type: ShadingType.CLEAR },
              margins: { top: 120, bottom: 120, left: 200, right: 200 },
              borders: cellBorder("CCCCCC"),
              children: [new Paragraph({ children: [new TextRun({ text: "Ubuntu 24.04 LTS", font: "Arial", size: 20, color: DGRAY })] })]
            })
          ]}),
        ]
      }),

      pageBreak(),

      // ══════════════════ 1. OVERVIEW ══════════════════
      hdr("1. System Overview"),

      body("This document describes the backup and restore procedures for the MetaTrader 5 (MT5) container running on Hostinger VPS. The system uses Docker Compose with Traefik as a reverse proxy."),

      spacer(),
      hdr("Architecture", HeadingLevel.HEADING_2),

      new Table({
        width: { size: CONTENT_W, type: WidthType.DXA },
        columnWidths: [2500, 6860],
        rows: [
          headerRow(["Component", "Details"], [2500, 6860]),
          dataRow(["VPS Host",       "srv1637353.hstgr.cloud  (72.62.64.163)"], [2500, 6860], WHITE),
          dataRow(["OS",             "Ubuntu 24.04 LTS with Docker & Traefik"], [2500, 6860], LGRAY),
          dataRow(["Container Name", "mt5"], [2500, 6860], WHITE),
          dataRow(["Image",          "gmag11/metatrader5_vnc:1.0"], [2500, 6860], LGRAY),
          dataRow(["Web Access",     "https://mt5.srv1637353.hstgr.cloud  (port 3000 via Traefik HTTPS)"], [2500, 6860], WHITE),
          dataRow(["Compose File",   "/opt/mt5/docker-compose.yml"], [2500, 6860], LGRAY),
          dataRow(["Data Volume",    "/opt/mt5/mt5-data  →  /config (inside container)"], [2500, 6860], WHITE),
          dataRow(["Backup Storage", "/opt/mt5/backups/"], [2500, 6860], LGRAY),
          dataRow(["Backup Scripts", "/opt/mt5/backup.sh  |  /opt/mt5/restore.sh"], [2500, 6860], WHITE),
        ]
      }),

      spacer(),
      hdr("Volume Mount", HeadingLevel.HEADING_2),
      body("The MT5 data directory is mounted as a Docker volume. All MetaTrader 5 settings, profiles, MQL scripts, expert advisors, and logs are stored here and persisted across container restarts."),
      code("# docker-compose.yml volume definition"),
      code("volumes:"),
      code("  - ./mt5-data:/config"),

      pageBreak(),

      // ══════════════════ 2. BACKUP ══════════════════
      hdr("2. Backup System"),

      hdr("2.1 Schedule", HeadingLevel.HEADING_2),
      body("Backups run automatically via system cron on the following schedule:"),
      spacer(),

      new Table({
        width: { size: CONTENT_W, type: WidthType.DXA },
        columnWidths: [2800, 2000, 4560],
        rows: [
          headerRow(["Cron Expression", "Frequency", "Description"], [2800, 2000, 4560]),
          dataRow(["0 2 1,16 * *", "Bi-weekly", "MT5 backup — runs on 1st and 16th of every month at 02:00 UTC"], [2800, 2000, 4560], LGRAY),
        ]
      }),

      spacer(),
      hdr("2.2 Retention Policy", HeadingLevel.HEADING_2),
      body("The system automatically rotates old backups after each run:"),
      bullet("Keeps the 6 most recent backup files"),
      bullet("Older files are deleted automatically"),
      bullet("6 bi-weekly backups ≈ 3 months of history"),
      spacer(),

      hdr("2.3 Backup Process", HeadingLevel.HEADING_2),
      body("Each backup run follows these steps in order:"),
      spacer(),

      new Table({
        width: { size: CONTENT_W, type: WidthType.DXA },
        columnWidths: [720, 2500, 6140],
        rows: [
          headerRow(["Step", "Action", "Detail"], [720, 2500, 6140]),
          dataRow(["1", "Stop container",    "docker stop mt5  —  ensures data consistency"], [720, 2500, 6140], WHITE),
          dataRow(["2", "Create archive",    "tar -czf mt5_backup_YYYYMMDD_HHMMSS.tar.gz /opt/mt5/mt5-data"], [720, 2500, 6140], LGRAY),
          dataRow(["3", "Start container",   "docker start mt5  —  resumes MT5 service"], [720, 2500, 6140], WHITE),
          dataRow(["4", "Rotate old files",  "Deletes backups beyond the 6-file retention limit"], [720, 2500, 6140], LGRAY),
          dataRow(["5", "Write log",         "Appends timestamped result to /opt/mt5/backups/backup.log"], [720, 2500, 6140], WHITE),
        ]
      }),

      spacer(),
      body("Example backup filename and size from first run:"),
      code("mt5_backup_20260506_035054.tar.gz   (701 MB)"),

      spacer(),
      hdr("2.4 Run Backup Manually", HeadingLevel.HEADING_2),
      body("To trigger an immediate backup outside of the cron schedule:"),
      code("/opt/mt5/backup.sh"),
      spacer(),
      body("Monitor progress in real time:"),
      code("tail -f /opt/mt5/backups/backup.log"),

      pageBreak(),

      // ══════════════════ 3. RESTORE ══════════════════
      hdr("3. Restore Procedure"),

      new Paragraph({
        spacing: { before: 120, after: 160 },
        shading: { fill: YELLOW, type: ShadingType.CLEAR },
        border: { left: { style: BorderStyle.SINGLE, size: 12, color: "E6A817", space: 6 } },
        indent: { left: 240 },
        children: [new TextRun({ text: "⚠️  WARNING: Restore will OVERWRITE all current MT5 data. The script prompts for confirmation before proceeding. Make sure you have selected the correct backup file.", font: "Arial", size: 20, color: "7D4E00" })]
      }),

      spacer(),
      hdr("3.1 Restore Latest Backup", HeadingLevel.HEADING_2),
      body("If no filename is specified, the script automatically selects the most recent backup:"),
      code("/opt/mt5/restore.sh"),

      spacer(),
      hdr("3.2 Restore Specific Backup", HeadingLevel.HEADING_2),
      body("To restore from a particular backup file, pass the full path as an argument:"),
      code("/opt/mt5/restore.sh /opt/mt5/backups/mt5_backup_YYYYMMDD_HHMMSS.tar.gz"),
      spacer(),
      body("Example:"),
      code("/opt/mt5/restore.sh /opt/mt5/backups/mt5_backup_20260506_035054.tar.gz"),

      spacer(),
      hdr("3.3 Restore Process", HeadingLevel.HEADING_2),

      new Table({
        width: { size: CONTENT_W, type: WidthType.DXA },
        columnWidths: [720, 2500, 6140],
        rows: [
          headerRow(["Step", "Action", "Detail"], [720, 2500, 6140]),
          dataRow(["1", "Show info",        "Displays backup filename and target directory"], [720, 2500, 6140], WHITE),
          dataRow(["2", "Confirm prompt",   'User must type "y" to continue, any other input cancels'], [720, 2500, 6140], LGRAY),
          dataRow(["3", "Stop container",   "docker stop mt5"], [720, 2500, 6140], WHITE),
          dataRow(["4", "Clear data dir",   "rm -rf /opt/mt5/mt5-data"], [720, 2500, 6140], LGRAY),
          dataRow(["5", "Extract archive",  "tar -xzf backup.tar.gz -C /opt/mt5"], [720, 2500, 6140], WHITE),
          dataRow(["6", "Start container",  "docker start mt5  —  MT5 resumes with restored data"], [720, 2500, 6140], LGRAY),
        ]
      }),

      spacer(),
      hdr("3.4 List Available Backups", HeadingLevel.HEADING_2),
      code("ls -lh /opt/mt5/backups/mt5_backup_*.tar.gz"),

      pageBreak(),

      // ══════════════════ 4. LOGS ══════════════════
      hdr("4. Logs"),

      body("All backup and restore operations are logged with timestamps to a single log file:"),
      code("cat /opt/mt5/backups/backup.log"),
      spacer(),
      body("Follow log in real time:"),
      code("tail -f /opt/mt5/backups/backup.log"),
      spacer(),
      body("Example log output:"),
      code("[2026-05-06 03:50:54] === MT5 Backup Started ==="),
      code("[2026-05-06 03:50:54] Stopping MT5 container..."),
      code("[2026-05-06 03:50:58] Creating archive: /opt/mt5/backups/mt5_backup_20260506_035054.tar.gz"),
      code("[2026-05-06 03:51:48] Backup successful: ...mt5_backup_20260506_035054.tar.gz (701M)"),
      code("[2026-05-06 03:51:48] Starting MT5 container..."),
      code("[2026-05-06 03:51:48] Backups on disk: 1"),
      code("[2026-05-06 03:51:48] === MT5 Backup Completed ==="),

      pageBreak(),

      // ══════════════════ 5. CRON JOBS ══════════════════
      hdr("5. Cron Jobs on This Server"),

      body("The following cron jobs are registered under the root user on this VPS:"),
      spacer(),

      new Table({
        width: { size: CONTENT_W, type: WidthType.DXA },
        columnWidths: [2400, 1600, 5360],
        rows: [
          headerRow(["Schedule", "Frequency", "Script / Description"], [2400, 1600, 5360]),
          dataRow(["0 3 * * 3",       "Weekly",     "/root/scripts/backup-weekly.sh  —  runs every Wednesday at 03:00 UTC"], [2400, 1600, 5360], WHITE),
          dataRow(["0 3 28-31 * *",   "Monthly",    "/root/scripts/backup-monthly.sh  —  runs on last day of each month at 03:00 UTC"], [2400, 1600, 5360], LGRAY),
          dataRow(["0 2 1,16 * *",    "Bi-weekly",  "/opt/mt5/backup.sh  —  MT5 data backup on 1st and 16th at 02:00 UTC"], [2400, 1600, 5360], GREEN),
        ]
      }),

      spacer(),
      body("To view or edit cron jobs:"),
      code("crontab -l          # list all cron jobs"),
      code("crontab -e          # edit cron jobs"),

      pageBreak(),

      // ══════════════════ 6. TROUBLESHOOTING ══════════════════
      hdr("6. Troubleshooting"),

      hdr("6.1 Container Does Not Start After Restore", HeadingLevel.HEADING_2),

      new Paragraph({
        spacing: { before: 120, after: 160 },
        shading: { fill: RED, type: ShadingType.CLEAR },
        border: { left: { style: BorderStyle.SINGLE, size: 12, color: "C0392B", space: 6 } },
        indent: { left: 240 },
        children: [new TextRun({ text: "Symptom: docker start mt5 returns an error or container exits immediately.", font: "Arial", size: 20, color: "7D0000" })]
      }),

      body("Diagnosis steps:"),
      code("docker logs mt5                          # view container error output"),
      code("docker inspect mt5 | grep -i status      # check container state"),
      code("ls -la /opt/mt5/mt5-data/                # verify data directory exists"),
      spacer(),
      body("If the data directory is missing or empty, re-run the restore with the correct backup file:"),
      code("/opt/mt5/restore.sh /opt/mt5/backups/mt5_backup_YYYYMMDD_HHMMSS.tar.gz"),

      spacer(),
      hdr("6.2 Backup File Is Corrupted", HeadingLevel.HEADING_2),

      new Paragraph({
        spacing: { before: 120, after: 160 },
        shading: { fill: RED, type: ShadingType.CLEAR },
        border: { left: { style: BorderStyle.SINGLE, size: 12, color: "C0392B", space: 6 } },
        indent: { left: 240 },
        children: [new TextRun({ text: "Symptom: tar extraction fails with an error during restore.", font: "Arial", size: 20, color: "7D0000" })]
      }),

      body("Test backup file integrity before restoring:"),
      code("tar -tzf /opt/mt5/backups/mt5_backup_YYYYMMDD_HHMMSS.tar.gz > /dev/null && echo OK || echo CORRUPTED"),
      spacer(),
      body("If the file is corrupted, restore from the next most recent backup:"),
      code("ls -lht /opt/mt5/backups/mt5_backup_*.tar.gz   # list by newest first"),

      spacer(),
      hdr("6.3 Disk Space Check", HeadingLevel.HEADING_2),
      body("MT5 backup files are ~700 MB each. With 6-file retention, expect ~4.2 GB used. Monitor disk:"),
      code("df -h /opt/mt5/backups/                  # check disk usage"),
      code("du -sh /opt/mt5/backups/*                # per-file size"),

      pageBreak(),

      // ══════════════════ 7. SCRIPT REFERENCE ══════════════════
      hdr("7. Script Reference"),

      hdr("7.1 backup.sh  —  /opt/mt5/backup.sh", HeadingLevel.HEADING_2),

      ...[
        "#!/bin/bash",
        "CONTAINER_NAME=\"mt5\"",
        "BACKUP_DIR=\"/opt/mt5/backups\"",
        "TIMESTAMP=$(date +\"%Y%m%d_%H%M%S\")",
        "BACKUP_FILE=\"$BACKUP_DIR/mt5_backup_$TIMESTAMP.tar.gz\"",
        "KEEP_LAST=6",
        "LOG_FILE=\"/opt/mt5/backups/backup.log\"",
        "",
        "log() {",
        "  echo \"[$(date '+%Y-%m-%d %H:%M:%S')] $1\" | tee -a \"$LOG_FILE\"",
        "}",
        "",
        "mkdir -p \"$BACKUP_DIR\"",
        "log \"=== MT5 Backup Started ===\"",
        "log \"Stopping MT5 container...\"",
        "docker stop \"$CONTAINER_NAME\"",
        "",
        "log \"Creating archive: $BACKUP_FILE\"",
        "tar -czf \"$BACKUP_FILE\" -C /opt/mt5 mt5-data",
        "",
        "if [ $? -eq 0 ]; then",
        "  SIZE=$(du -sh \"$BACKUP_FILE\" | cut -f1)",
        "  log \"Backup successful: $BACKUP_FILE ($SIZE)\"",
        "else",
        "  log \"ERROR: Backup failed!\"",
        "  docker start \"$CONTAINER_NAME\"",
        "  exit 1",
        "fi",
        "",
        "log \"Starting MT5 container...\"",
        "docker start \"$CONTAINER_NAME\"",
        "",
        "log \"Rotating old backups (keeping last $KEEP_LAST)...\"",
        "ls -t \"$BACKUP_DIR\"/mt5_backup_*.tar.gz 2>/dev/null | tail -n +$((KEEP_LAST + 1)) | xargs -r rm -f",
        "log \"Backups on disk: $(ls \"$BACKUP_DIR\"/mt5_backup_*.tar.gz 2>/dev/null | wc -l)\"",
        "log \"=== MT5 Backup Completed ===\"",
      ].map(line => code(line === "" ? " " : line)),

      spacer(),
      hdr("7.2 restore.sh  —  /opt/mt5/restore.sh", HeadingLevel.HEADING_2),

      ...[
        "#!/bin/bash",
        "CONTAINER_NAME=\"mt5\"",
        "BACKUP_DIR=\"/opt/mt5/backups\"",
        "LOG_FILE=\"/opt/mt5/backups/backup.log\"",
        "",
        "log() {",
        "  echo \"[$(date '+%Y-%m-%d %H:%M:%S')] $1\" | tee -a \"$LOG_FILE\"",
        "}",
        "",
        "if [ -n \"$1\" ]; then",
        "  BACKUP_FILE=\"$1\"",
        "else",
        "  BACKUP_FILE=$(ls -t \"$BACKUP_DIR\"/mt5_backup_*.tar.gz 2>/dev/null | head -1)",
        "  if [ -z \"$BACKUP_FILE\" ]; then",
        "    echo \"ERROR: No backup files found in $BACKUP_DIR\"",
        "    exit 1",
        "  fi",
        "  echo \"No file specified. Using latest: $BACKUP_FILE\"",
        "fi",
        "",
        "[ ! -f \"$BACKUP_FILE\" ] && echo \"ERROR: File not found: $BACKUP_FILE\" && exit 1",
        "",
        "echo \"  Backup file : $BACKUP_FILE\"",
        "echo \"  Target dir  : /opt/mt5/mt5-data\"",
        "read -p \"Proceed? This will OVERWRITE current MT5 data. [y/N] \" CONFIRM",
        "[[ \"$CONFIRM\" != \"y\" && \"$CONFIRM\" != \"Y\" ]] && echo \"Restore cancelled.\" && exit 0",
        "",
        "log \"=== MT5 Restore Started ===\"",
        "docker stop \"$CONTAINER_NAME\"",
        "rm -rf /opt/mt5/mt5-data",
        "tar -xzf \"$BACKUP_FILE\" -C /opt/mt5",
        "",
        "if [ $? -eq 0 ]; then",
        "  log \"Restore successful.\"",
        "else",
        "  log \"ERROR: Restore failed! Container left stopped.\"",
        "  exit 1",
        "fi",
        "",
        "docker start \"$CONTAINER_NAME\"",
        "log \"=== MT5 Restore Completed ===\"",
      ].map(line => code(line === "" ? " " : line)),

    ]
  }]
});

Packer.toBuffer(doc).then(buffer => {
  fs.writeFileSync("C:/Users/USER/TradingView/docs/MT5_Backup_Restore_Guide.docx", buffer);
  console.log("Done: MT5_Backup_Restore_Guide.docx");
});
