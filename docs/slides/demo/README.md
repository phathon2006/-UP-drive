# สคริปต์สร้างสไลด์ UP Drive

สคริปต์เหล่านี้สร้างสไลด์ (`.pptx` และ HTML) จากข้อมูลชุดเดียวใน `slides-data.mjs`

## ไฟล์
| ไฟล์ | หน้าที่ |
|------|---------|
| `slides-data.mjs` | เนื้อหาสไลด์ทั้งหมด (แก้ข้อความที่นี่) |
| `build-pptx.mjs` | สร้าง `UP-Drive-Slides.pptx` (ใช้ไลบรารี `pptxgenjs`) |
| `build-html.mjs` | สร้าง `slides.html` + ไฟล์แยก `html/slide-N.html` |
| `shot.mjs` | แคปเจอร์สไลด์ HTML เป็น PNG ด้วย Chrome headless |

## วิธีใช้
```bash
# 1) ติดตั้งไลบรารี (ครั้งแรก)
npm install pptxgenjs

# 2) สร้าง HTML + PPTX
node build-html.mjs "../"
node build-pptx.mjs "../UP-Drive-Slides.pptx"

# 3) แคปเจอร์ภาพ (ต้องมี pair JSON: [{file, out}])
node shot.mjs "../screenshots" pairs.json
```

## แก้ไขเนื้อหา
แก้ที่ `slides-data.mjs` แล้วรันคำสั่งข้างบนใหม่ ทั้ง HTML และ PPTX จะอัปเดตตรงกัน

ชนิดสไลด์ที่รองรับ: `title`, `bullets`, `cards`, `steps`, `summary`
