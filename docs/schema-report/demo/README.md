# Schema Report (Word) — วิธีสร้าง

ไฟล์นี้ใช้สร้าง `../report.docx` (เอกสารโครงสร้างฐานข้อมูล Database Schema)

## ต้องมี
- Node.js 18+ และแพ็กเกจ `docx`

## วิธีรัน
จากโฟลเดอร์ที่มี `node_modules/docx`:

```bash
node build-schema-docx.mjs "<path ไปยัง docs/schema-report>" "<path เอาต์พุต.docx>"
```

- อาร์กิวเมนต์ที่ 1 = โฟลเดอร์รายงาน (จะอ่านภาพจาก `<โฟลเดอร์>/screenshots`)
- อาร์กิวเมนต์ที่ 2 (ไม่บังคับ) = ไฟล์ .docx ปลายทาง (ค่าเริ่มต้น `<โฟลเดอร์>/report.docx`)

## แก้เนื้อหา
แก้ที่ `build-schema-docx.mjs` แล้วรันใหม่ — เนื้อหาทั้งหมด (ตาราง/คอลัมน์/DDL) อยู่ในไฟล์นี้

## แหล่งข้อมูล
ข้อมูล schema มาจาก `supabase.sql` (ตาราง คอลัมน์ คีย์ index policy trigger/function/procedure)
