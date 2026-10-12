# UP Drive

ระบบแชร์ค่ารถสำหรับนักศึกษา มหาวิทยาลัยพะเยา

## วิธีรัน (ใช้ได้กับโค้ดล่าสุด)

### 1. ติดตั้ง dependencies
```bash
npm install
```

### 2. ตั้งค่า `.env`
```
PORT=3000
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_SECRET_KEY=your-secret-key
```

### 3. เตรียมฐานข้อมูล (Supabase)
- **ทดสอบ**: ใช้ `supabase.test.sql` (ปลอดภัย ไม่มีคำสั่งลบตาราง) — รันใน SQL Editor ของ project ทดสอบ
- **production**: ใช้ `supabase.sql` เฉพาะตอนสร้างฐานข้อมูลใหม่เท่านั้น (มีคำสั่ง DROP ตารางเดิม)

### 4. รันแบบเดิมเบรก แต่เปลี่ยน `.env` ให้ชี้ test DB — โปรเจกต์รันด้วย `npm start` ได้ปกติ เวลาเปิดไปที่ `http://localhost:3000`

### 5. สร้างข้อมูลทดสอบ (optional)
```bash
node scripts/seed.js
```
จะสร้างบัญชี `passenger@test.com` / `driver@test.com` (รหัส `123456`)

## Deploy ขึ้นออนไลน์ (Vercel — ฟรี, zero-config)

Vercel ตรวจจับ Express ได้อัตโนมัติ (entry ที่ `src/server.js`) และเสิร์ฟโฟลเดอร์ `public/`
ผ่าน CDN ให้เองโดยไม่ต้องตั้งค่า build

### ขั้นตอน (แนะนำ: deploy จาก GitHub)
1. สมัคร/เข้าสู่ระบบ [https://vercel.com](https://vercel.com) ด้วยบัญชี GitHub
2. ไปที่ [https://vercel.com/new](https://vercel.com/new) → **Import Git Repository** → เลือก repo `-UP-drive`
3. ปล่อยค่า build ให้ Vercel ตรวจอัตโนมัติ (ไม่ต้องตั้ง Build Command / Output Directory)
4. เปิด **Environment Variables** ใส่ 2 ค่า (คัดลอกจาก `.env`):
   - `SUPABASE_URL`
   - `SUPABASE_SECRET_KEY`
5. กด **Deploy** รอ ~1 นาที → ได้ URL เช่น `https://up-drive.vercel.app`

### หรือ deploy ผ่าน CLI
```bash
npm i -g vercel
vercel login
vercel            # preview deployment
vercel --prod     # production
```
จากนั้นตั้ง env: `vercel env add SUPABASE_URL` และ `vercel env add SUPABASE_SECRET_KEY`

### หมายเหตุการ deploy
- หน้าเว็บใช้ path แบบ relative (`/api/auth/login`) จึงย้าย host ได้เลยโดยไม่ต้องแก้โค้ด
- `express.static()` ถูก ignore บน Vercel — Vercel เสิร์ฟไฟล์ใน `public/` ผ่าน CDN เอง
- `src/server.js` มีทั้ง `app.listen` (รัน local) และ `module.exports = app` (ให้ Vercel เรียกเป็น function)
- กำหนด region เป็น `sin1` (Singapore) ใน `vercel.json` ให้โหลดเร็วขึ้นในไทย
- ครั้งแรกที่เปิดหน้าเว็บ ระบบจะ `prompt` ให้ใส่ Supabase URL / Publishable Key (เก็บใน localStorage)
- ⚠️ อย่า commit ไฟล์ `.env` (มี secret key) — ใช้ Environment Variables ของ Vercel แทน

## หมายเหตุ
- โปรเจกต์นี้ต้องรัน Node.js (`npm start` → `node src/server.js`) เพราะมี API server
- ไฟล์ใน `public/` ถูก serve ผ่าน Express — **ใช้กับ GitHub Pages ไม่ได้**
