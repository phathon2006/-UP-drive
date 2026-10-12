# สคริปต์สร้างรายงาน Sprint 2 (Word)

สคริปต์นี้สร้าง `../report.docx` จากเนื้อหาในตัวสคริปต์ และดึงภาพจากโฟลเดอร์ `../screenshots/`

## ไฟล์
| ไฟล์ | หน้าที่ |
|------|---------|
| `build-sprint2-docx.mjs` | สร้างไฟล์ Word `report.docx` (ใช้ไลบรารี `docx`) |

## วิธีใช้
```bash
# 1) ติดตั้งไลบรารี (ครั้งแรก)
npm install docx

# 2) สร้างไฟล์ Word
node build-sprint2-docx.mjs "../"
```

## แก้ไขเนื้อหา
แก้ข้อความต่าง ๆ ในไฟล์ `build-sprint2-docx.mjs` (ส่วน `children.push(...)`) แล้วรันคำสั่งข้างบนใหม่

## ภาพที่ใช้ (อยู่ใน `../screenshots/`)
| ไฟล์ | ที่มา |
|------|------|
| `burndown.png`, `board.png`, `deploy-health.png` | สร้างจาก `../fig-*.html` (แคปเจอร์ด้วย Chrome headless) |
| `trigger-timestamps.png`, `trigger-guard.png` | คัดจากรายงาน Trigger |
| `func-scalar.png`, `func-candidates.png` | คัดจากรายงาน SQL Function |
| `proc-accept.png`, `proc-events.png` | คัดจากรายงาน Stored Procedure |

## สร้างภาพ burndown / board / deploy ใหม่
เปิดไฟล์ `../fig-*.html` แล้วแคปเจอร์องค์ประกอบ `.page` ด้วย Chrome headless (ดูตัวอย่างสคริปต์ใน `docs/slides/demo/shot.mjs`)
