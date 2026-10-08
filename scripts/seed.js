/*
 * seed.js — สร้างข้อมูลทดสอบผ่าน API
 *
 * วิธีใช้:
 *   1. ตั้งค่า .env ให้ชี้ไป Supabase project ทดสอบ
 *   2. รัน server ก่อน: npm start
 *   3. รันสคริปต์นี้: node scripts/seed.js
 *
 * จะสร้างบัญชีทดสอบ:
 *   - passenger@test.com / 123456
 *   - driver@test.com    / 123456
 */

const BASE =
    process.env.SEED_BASE_URL ||
    "http://localhost:3000";

async function post(path, body, token) {
    const res = await fetch(
        `${BASE}${path}`,
        {
            method: "POST",
            headers: {
                "Content-Type":
                    "application/json",
                ...(token
                    ? {
                          Authorization:
                              `Bearer ${token}`
                      }
                    : {})
            },
            body: JSON.stringify(body)
        }
    );

    const data = await res
        .json()
        .catch(() => ({}));

    if (!res.ok) {
        console.warn(
            `${path}:`,
            data.error || res.status
        );
    }

    return data;
}

async function main() {
    console.log("🌱 Seeding test data...");

    await post("/api/auth/register", {
        name: "ผู้โดยสารทดสอบ",
        email: "passenger@test.com",
        phone: "0811111111",
        password: "123456",
        role: "passenger"
    });

    await post("/api/auth/register", {
        name: "คนขับทดสอบ",
        email: "driver@test.com",
        phone: "0822222222",
        password: "123456",
        role: "driver",
        vehicleSeats: 4
    });

    const login = await post(
        "/api/auth/login",
        {
            email: "passenger@test.com",
            password: "123456"
        }
    );

    if (login.session) {
        await post(
            "/api/rides",
            {
                origin_text:
                    "หอพักทดสอบ ม.พะเยา",
                destination_text:
                    "มหาวิทยาลัยพะเยา",
                origin_detail:
                    "หน้าประตูหอพัก",
                destination_detail:
                    "อาคารเรียนรวม",
                origin_lat: 19.02843,
                origin_lng: 99.89624,
                destination_lat: 19.0345,
                destination_lng: 99.903,
                target_passengers: 2
            },
            login.session.access_token
        );

        console.log(
            "✅ สร้างคำขอเดินทางตัวอย่างแล้ว"
        );
    }

    console.log("🎉 Seed เสร็จ");
}

main().catch(console.error);
