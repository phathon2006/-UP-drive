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

## หมายเหตุ
- โปรเจกต์นี้ต้องรัน Node.js (`npm start` → `node src/server.js`) เพราะมี API server
- ไฟล์ใน `public/` ถูก serve ผ่าน Express — **ใช้กับ GitHub Pages ไม่ได้**
