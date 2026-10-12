import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell,
  ImageRun, WidthType, ShadingType, AlignmentType,
} from "docx";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO = process.argv[2];
const OUT = process.argv[3] || join(REPO, "report.docx");

const FONT = "Tahoma";
const MONO = "Consolas";
const PURPLE = "5B21B6";
const INK = "1B2434";

function P(text, opts = {}) {
  return new Paragraph({
    spacing: { after: opts.after ?? 80, before: opts.before ?? 0, line: 276 },
    alignment: opts.align,
    children: [new TextRun({ text, font: opts.font || FONT, size: opts.size ?? 22, bold: opts.bold, italics: opts.italics, color: opts.color })],
  });
}
function H(text, level) {
  return new Paragraph({
    heading: level,
    spacing: { before: level === HeadingLevel.HEADING_1 ? 0 : 260, after: 120 },
    children: [new TextRun({ text, font: FONT, bold: true, color: INK })],
  });
}
function H3(text) {
  return new Paragraph({
    spacing: { before: 220, after: 90 },
    children: [new TextRun({ text, font: FONT, bold: true, size: 23, color: PURPLE })],
  });
}
function bullet(text) {
  return new Paragraph({
    bullet: { level: 0 },
    spacing: { after: 60, line: 276 },
    children: [new TextRun({ text, font: FONT, size: 22 })],
  });
}
function cellPara(text, opts = {}) {
  return new Paragraph({
    spacing: { after: 20, line: 240 },
    children: [new TextRun({ text: String(text), font: opts.mono ? MONO : FONT, size: opts.size ?? 17, color: opts.color, italics: opts.italics, bold: opts.bold })],
  });
}
function cell(text, opts = {}) {
  return new TableCell({
    shading: opts.fill ? { type: ShadingType.SOLID, color: opts.fill, fill: opts.fill } : undefined,
    margins: { top: 30, bottom: 30, left: 70, right: 70 },
    children: [cellPara(text, opts)],
  });
}
function table(columns, rows, opts = {}) {
  const header = new TableRow({ tableHeader: true, children: columns.map((c) => cell(c, { bold: true, fill: "EEF2F7", color: "334155" })) });
  const body = rows.map((row) => new TableRow({
    children: row.map((c) => {
      if (c && typeof c === "object") return cell(c.t, { mono: c.mono, bold: c.bold, color: c.color, fill: c.fill, size: c.size });
      return cell(c);
    }),
  }));
  return new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [header, ...body] });
}
function code(lines) {
  return new Paragraph({
    spacing: { after: 0, before: 0, line: 240 },
    children: lines.flatMap((l, i) => [
      new TextRun({ text: l, font: MONO, size: 16, color: "1F2937", break: i === 0 ? 0 : 1 }),
    ]),
  });
}

const MAXW = 662, MAXH = 760;
function image(file, w, h, caption, maxh = MAXH) {
  const scale = Math.min(MAXW / w, maxh / h);
  const buf = readFileSync(join(REPO, "screenshots", file));
  return [
    new Paragraph({
      spacing: { before: 120, after: 40 },
      alignment: AlignmentType.CENTER,
      children: [new ImageRun({ type: "png", data: buf, transformation: { width: Math.round(w * scale), height: Math.round(h * scale) } })],
    }),
    P(caption, { size: 17, italics: true, color: "6B7688", align: AlignmentType.CENTER, after: 160 }),
  ];
}

const children = [];

/* ---------------- COVER ---------------- */
children.push(H("เอกสารโครงสร้างฐานข้อมูล (Database Schema)", HeadingLevel.HEADING_1));
children.push(P("ระบบ UP Drive — ระบบแชร์ค่าเดินทางสำหรับนักศึกษา มหาวิทยาลัยพะเยา", { size: 24, color: "334155", after: 40 }));
children.push(P("ฐานข้อมูล: PostgreSQL (Supabase)", { size: 21, color: "6B7688", after: 20 }));
children.push(P("ไฟล์ Schema: supabase.sql · ไฟล์ทดสอบ: supabase.test.sql", { size: 21, color: "6B7688", after: 20 }));
children.push(P("วันที่จัดทำ: ____________________", { size: 21, color: "6B7688", after: 120 }));
children.push(P("เอกสารนี้อธิบายโครงสร้างฐานข้อมูลทั้งหมดของระบบ UP Drive ได้แก่ ตาราง คอลัมน์ ชนิดข้อมูล คีย์ ความสัมพันธ์ ดัชนี ความปลอดภัย (RLS) และวัตถุฐานข้อมูลเชิงโปรแกรม พร้อมภาคผนวกโค้ด DDL", { size: 18, italics: true, color: "92400E" }));

/* ---------------- 1 ---------------- */
children.push(H("1. ภาพรวมฐานข้อมูล", HeadingLevel.HEADING_2));
children.push(table(["หัวข้อ", "รายละเอียด"], [
  ["ระบบจัดการฐานข้อมูล", "PostgreSQL (โฮสต์บน Supabase)"],
  ["จำนวนตาราง", "7 ตารางหลัก + 1 ตารางบันทึกเหตุการณ์ (ride_group_events)"],
  ["จำนวนคอลัมน์รวม", "56 คอลัมน์"],
  ["Primary Key", "ทุกตารางใช้คอลัมน์ id (uuid หรือ bigserial)"],
  ["Foreign Key", "11 ความสัมพันธ์"],
  ["ดัชนี (Index)", "8 ดัชนี สำหรับคอลัมน์ที่ถูกค้นบ่อย"],
  ["ความปลอดภัย", "เปิด Row Level Security (RLS) 6 ตารางหลัก + 6 policies"],
  ["Database Trigger", "3 ตัว (บังคับกติกาและเติมเวลาอัตโนมัติ)"],
  ["SQL Function", "3 ตัว (คำนวณระยะทาง/นับผู้โดยสาร/หากลุ่มใกล้)"],
  ["Stored Procedure", "3 ตัว (รับงาน/ยกเลิกกลุ่ม/ปิดกลุ่มค้าง)"],
]));

/* ---------------- 2 ---------------- */
children.push(H("2. แผนภาพความสัมพันธ์ (ER Diagram)", HeadingLevel.HEADING_2));
children.push(P("แผนภาพแสดง 7 ตารางหลักและความสัมพันธ์ระหว่างกัน ด้วยสัญลักษณ์ Crow's Foot (หนึ่ง-ต่อ-หลาย และ หนึ่ง-ต่อ-หนึ่ง)", { after: 80 }));
children.push(...image("er-diagram.png", 2400, 2722, "ภาพที่ 1 — ER Diagram ของฐานข้อมูล UP Drive"));

/* ---------------- 3 ---------------- */
children.push(H("3. ตารางสรุปโครงสร้าง (Schema Summary)", HeadingLevel.HEADING_2));
children.push(table(["ตาราง", "หน้าที่", "คีย์หลัก", "คีย์นอก (อ้างอิง)", "คอลัมน์"], [
  ["profiles", "ข้อมูลบัญชีผู้ใช้ (ผู้โดยสาร/คนขับ) ผูกกับระบบล็อกอิน", { t: "id", mono: true }, "— (อ้าง auth.users)", "6"],
  ["ride_groups", "กลุ่มเดินทาง ตั้งแต่เริ่มรวมคนจนจบงาน", { t: "id", mono: true }, "leader_id, driver_id → profiles", "9"],
  ["ride_requests", "คำขอเดินทางของผู้โดยสารหนึ่งคน พร้อมพิกัดต้นทาง–ปลายทาง", { t: "id", mono: true }, "passenger_id → profiles, group_id → ride_groups", "14"],
  ["ride_group_members", "สมาชิกในกลุ่ม (เชื่อม กลุ่ม ↔ คำขอ ↔ ผู้โดยสาร)", { t: "id", mono: true }, "group_id → ride_groups, ride_request_id → ride_requests, passenger_id → profiles", "7"],
  ["ride_routes", "เส้นทาง/ระยะทางของกลุ่ม (1 กลุ่ม : 1 เส้นทาง)", { t: "id", mono: true }, "group_id → ride_groups (UNIQUE)", "6"],
  ["driver_locations", "พิกัดล่าสุดของคนขับ สำหรับติดตามแบบ Realtime", { t: "id", mono: true }, "driver_id → profiles (UNIQUE)", "8"],
  ["ride_group_events", "บันทึกเหตุการณ์ของกลุ่ม (audit log)", { t: "id", mono: true }, "group_id → ride_groups, actor_id → profiles", "6"],
]));

/* ---------------- 4 ---------------- */
children.push(H("4. รายละเอียดคอลัมน์ (Data Dictionary)", HeadingLevel.HEADING_2));
children.push(P("คำอธิบายคอลัมน์ทั้งหมด แยกรายตาราง", { after: 80 }));

function dict(title, rows) {
  children.push(H3(title));
  children.push(table(["คอลัมน์", "ชนิดข้อมูล", "คีย์ / ข้อกำหนด"], rows));
}

dict("4.1 profiles", [
  [{ t: "id", mono: true }, "uuid", "PK · อ้าง auth.users(id) · ON DELETE CASCADE"],
  [{ t: "name", mono: true }, "text", "NOT NULL"],
  [{ t: "phone", mono: true }, "text", "—"],
  [{ t: "role", mono: true }, "text", "NOT NULL · CHECK (passenger, driver)"],
  [{ t: "vehicle_seats", mono: true }, "integer", "NOT NULL · DEFAULT 4 · CHECK 1–10"],
  [{ t: "created_at", mono: true }, "timestamptz", "NOT NULL · DEFAULT now()"],
]);

dict("4.2 ride_groups", [
  [{ t: "id", mono: true }, "uuid", "PK · DEFAULT gen_random_uuid()"],
  [{ t: "leader_id", mono: true }, "uuid", "FK → profiles(id) · NOT NULL"],
  [{ t: "target_passengers", mono: true }, "integer", "NOT NULL · CHECK 1–10"],
  [{ t: "status", mono: true }, "text", "NOT NULL · DEFAULT 'forming' · CHECK (forming, sent_to_driver, accepted, completed, cancelled)"],
  [{ t: "driver_id", mono: true }, "uuid", "FK → profiles(id) · เป็น NULL ได้"],
  [{ t: "created_at", mono: true }, "timestamptz", "NOT NULL · DEFAULT now()"],
  [{ t: "confirmed_at", mono: true }, "timestamptz", "เติมอัตโนมัติโดย Trigger"],
  [{ t: "accepted_at", mono: true }, "timestamptz", "เติมอัตโนมัติโดย Trigger"],
  [{ t: "completed_at", mono: true }, "timestamptz", "เติมอัตโนมัติโดย Trigger"],
]);

dict("4.3 ride_requests", [
  [{ t: "id", mono: true }, "uuid", "PK · DEFAULT gen_random_uuid()"],
  [{ t: "passenger_id", mono: true }, "uuid", "FK → profiles(id) · NOT NULL"],
  [{ t: "group_id", mono: true }, "uuid", "FK → ride_groups(id) · ON DELETE SET NULL"],
  [{ t: "origin_text", mono: true }, "text", "NOT NULL"],
  [{ t: "destination_text", mono: true }, "text", "NOT NULL"],
  [{ t: "origin_detail", mono: true }, "text", "—"],
  [{ t: "destination_detail", mono: true }, "text", "—"],
  [{ t: "origin_lat", mono: true }, "double precision", "NOT NULL"],
  [{ t: "origin_lng", mono: true }, "double precision", "NOT NULL"],
  [{ t: "destination_lat", mono: true }, "double precision", "NOT NULL"],
  [{ t: "destination_lng", mono: true }, "double precision", "NOT NULL"],
  [{ t: "target_passengers", mono: true }, "integer", "NOT NULL · CHECK 1–10"],
  [{ t: "status", mono: true }, "text", "NOT NULL · DEFAULT 'searching' · CHECK (searching, matched, sent_to_driver, accepted, completed, cancelled)"],
  [{ t: "created_at", mono: true }, "timestamptz", "NOT NULL · DEFAULT now()"],
]);

dict("4.4 ride_group_members", [
  [{ t: "id", mono: true }, "uuid", "PK · DEFAULT gen_random_uuid()"],
  [{ t: "group_id", mono: true }, "uuid", "FK → ride_groups(id) · NOT NULL · ON DELETE CASCADE · UNIQUE(group_id, passenger_id), UNIQUE(group_id, ride_request_id)"],
  [{ t: "ride_request_id", mono: true }, "uuid", "FK → ride_requests(id) · NOT NULL · ON DELETE CASCADE"],
  [{ t: "passenger_id", mono: true }, "uuid", "FK → profiles(id) · NOT NULL · ON DELETE CASCADE"],
  [{ t: "party_size", mono: true }, "integer", "NOT NULL · DEFAULT 1 · CHECK 1–10"],
  [{ t: "confirmed", mono: true }, "boolean", "NOT NULL · DEFAULT false"],
  [{ t: "joined_at", mono: true }, "timestamptz", "NOT NULL · DEFAULT now()"],
]);

dict("4.5 ride_routes", [
  [{ t: "id", mono: true }, "uuid", "PK · DEFAULT gen_random_uuid()"],
  [{ t: "group_id", mono: true }, "uuid", "FK → ride_groups(id) · NOT NULL · UNIQUE · ON DELETE CASCADE"],
  [{ t: "distance_meters", mono: true }, "double precision", "—"],
  [{ t: "duration_seconds", mono: true }, "double precision", "—"],
  [{ t: "geometry", mono: true }, "jsonb", "—"],
  [{ t: "created_at", mono: true }, "timestamptz", "NOT NULL · DEFAULT now()"],
]);

dict("4.6 driver_locations", [
  [{ t: "id", mono: true }, "uuid", "PK · DEFAULT gen_random_uuid()"],
  [{ t: "driver_id", mono: true }, "uuid", "FK → profiles(id) · NOT NULL · UNIQUE · ON DELETE CASCADE"],
  [{ t: "latitude", mono: true }, "double precision", "NOT NULL"],
  [{ t: "longitude", mono: true }, "double precision", "NOT NULL"],
  [{ t: "heading", mono: true }, "double precision", "—"],
  [{ t: "speed", mono: true }, "double precision", "—"],
  [{ t: "accuracy", mono: true }, "double precision", "—"],
  [{ t: "updated_at", mono: true }, "timestamptz", "NOT NULL · DEFAULT now() · อัปเดตโดย Trigger"],
]);

dict("4.7 ride_group_events (audit log)", [
  [{ t: "id", mono: true }, "bigserial", "PK (running number)"],
  [{ t: "group_id", mono: true }, "uuid", "FK → ride_groups(id) · NOT NULL · ON DELETE CASCADE"],
  [{ t: "actor_id", mono: true }, "uuid", "FK → profiles(id) · เป็น NULL ได้"],
  [{ t: "event", mono: true }, "text", "NOT NULL"],
  [{ t: "detail", mono: true }, "text", "—"],
  [{ t: "created_at", mono: true }, "timestamptz", "NOT NULL · DEFAULT now()"],
]);

/* ---------------- 5 ---------------- */
children.push(H("5. ความสัมพันธ์ระหว่างตาราง (Foreign Keys)", HeadingLevel.HEADING_2));
children.push(table(["จาก (ตาราง.คอลัมน์)", "ไปยัง", "ความสัมพันธ์", "ON DELETE"], [
  [{ t: "ride_groups.leader_id", mono: true }, { t: "profiles.id", mono: true }, "N : 1", "—"],
  [{ t: "ride_groups.driver_id", mono: true }, { t: "profiles.id", mono: true }, "N : 1 (เป็น NULL ได้)", "—"],
  [{ t: "ride_requests.passenger_id", mono: true }, { t: "profiles.id", mono: true }, "N : 1", "—"],
  [{ t: "ride_requests.group_id", mono: true }, { t: "ride_groups.id", mono: true }, "N : 1 (เป็น NULL ได้)", "SET NULL"],
  [{ t: "ride_group_members.group_id", mono: true }, { t: "ride_groups.id", mono: true }, "N : 1", "CASCADE"],
  [{ t: "ride_group_members.ride_request_id", mono: true }, { t: "ride_requests.id", mono: true }, "N : 1", "CASCADE"],
  [{ t: "ride_group_members.passenger_id", mono: true }, { t: "profiles.id", mono: true }, "N : 1", "CASCADE"],
  [{ t: "ride_routes.group_id", mono: true }, { t: "ride_groups.id", mono: true }, "1 : 1 (UNIQUE)", "CASCADE"],
  [{ t: "driver_locations.driver_id", mono: true }, { t: "profiles.id", mono: true }, "1 : 1 (UNIQUE)", "CASCADE"],
  [{ t: "ride_group_events.group_id", mono: true }, { t: "ride_groups.id", mono: true }, "N : 1", "CASCADE"],
  [{ t: "ride_group_events.actor_id", mono: true }, { t: "profiles.id", mono: true }, "N : 1 (เป็น NULL ได้)", "—"],
]));

/* ---------------- 6 ---------------- */
children.push(H("6. ดัชนี (Index)", HeadingLevel.HEADING_2));
children.push(table(["ชื่อ Index", "ตาราง", "คอลัมน์"], [
  [{ t: "idx_ride_requests_passenger", mono: true }, "ride_requests", { t: "passenger_id", mono: true }],
  [{ t: "idx_ride_requests_group", mono: true }, "ride_requests", { t: "group_id", mono: true }],
  [{ t: "idx_ride_requests_status", mono: true }, "ride_requests", { t: "status", mono: true }],
  [{ t: "idx_ride_groups_status", mono: true }, "ride_groups", { t: "status", mono: true }],
  [{ t: "idx_ride_groups_driver", mono: true }, "ride_groups", { t: "driver_id", mono: true }],
  [{ t: "idx_group_members_group", mono: true }, "ride_group_members", { t: "group_id", mono: true }],
  [{ t: "idx_group_members_passenger", mono: true }, "ride_group_members", { t: "passenger_id", mono: true }],
  [{ t: "idx_driver_locations_driver", mono: true }, "driver_locations", { t: "driver_id", mono: true }],
]));

/* ---------------- 7 ---------------- */
children.push(H("7. ความปลอดภัยระดับแถว (Row Level Security)", HeadingLevel.HEADING_2));
children.push(P("เปิด RLS กับ 6 ตารางหลัก และกำหนด policy สำหรับการอ่าน (SELECT) ให้ผู้ใช้เห็นเฉพาะข้อมูลที่เกี่ยวข้องกับตนเอง", { after: 80 }));
children.push(table(["ตาราง", "Policy", "เงื่อนไขการเข้าถึง (สรุป)"], [
  [{ t: "profiles", mono: true }, { t: "profiles_select_authenticated", mono: true }, "ผู้ใช้เห็นข้อมูลโปรไฟล์ของตัวเอง (auth.uid() = id)"],
  [{ t: "ride_groups", mono: true }, { t: "groups_select_members_or_drivers", mono: true }, "เห็นเมื่อเป็นคนขับของกลุ่ม หรือสถานะ sent_to_driver หรือเป็นสมาชิกของกลุ่ม"],
  [{ t: "ride_requests", mono: true }, { t: "requests_select_owner_or_group_member", mono: true }, "เห็นเมื่อเป็นเจ้าของคำขอ หรือเป็นสมาชิกกลุ่ม หรือเป็นคนขับที่เกี่ยวข้อง"],
  [{ t: "ride_group_members", mono: true }, { t: "members_select_group_users", mono: true }, "เห็นเมื่อเป็นสมาชิกของกลุ่ม หรือเป็นคนขับของกลุ่มนั้น"],
  [{ t: "ride_routes", mono: true }, { t: "routes_select_group_users", mono: true }, "เห็นเมื่อเป็นคนขับหรือสมาชิกของกลุ่มนั้น"],
  [{ t: "driver_locations", mono: true }, { t: "driver_locations_select_group_users", mono: true }, "เห็นเมื่อเป็นคนขับเอง หรือเป็นสมาชิกของกลุ่มที่คนขับนั้นรับงานแล้ว (accepted/completed)"],
]));

/* ---------------- 8 ---------------- */
children.push(H("8. วัตถุฐานข้อมูลเชิงโปรแกรม", HeadingLevel.HEADING_2));
children.push(H3("8.1 Database Trigger (3 ตัว)"));
children.push(table(["#", "ชื่อ Trigger", "ตาราง", "Event", "หน้าที่"], [
  ["1", { t: "trg_ride_groups_status_timestamps", mono: true }, "ride_groups", "BEFORE UPDATE", "เติม confirmed_at / accepted_at / completed_at อัตโนมัติเมื่อสถานะเปลี่ยน"],
  ["2", { t: "trg_ride_groups_driver_rules", mono: true }, "ride_groups", "BEFORE UPDATE", "บล็อก (RAISE EXCEPTION) ถ้าตั้งสถานะ accepted แต่ยังไม่มีคนขับ"],
  ["3", { t: "trg_driver_locations_touch", mono: true }, "driver_locations", "BEFORE UPDATE", "อัปเดต updated_at ทุกครั้งที่พิกัดคนขับเปลี่ยน"],
]));
children.push(H3("8.2 SQL Function (3 ตัว)"));
children.push(table(["#", "ชื่อฟังก์ชัน", "ประเภท", "หน้าที่"], [
  ["1", { t: "haversine_km(lat1,lng1,lat2,lng2)", mono: true }, "Scalar", "คำนวณระยะทางระหว่างพิกัด 2 จุด (km)"],
  ["2", { t: "group_passenger_total(group_id)", mono: true }, "Scalar", "นับจำนวนผู้โดยสารรวมของกลุ่ม (ผลรวม party_size)"],
  ["3", { t: "find_candidate_groups(...)", mono: true }, "Table", "หากลุ่มที่กำลังรวมคนซึ่งใกล้คำขอใหม่ พร้อมคะแนน (score)"],
]));
children.push(H3("8.3 Stored Procedure (3 ตัว)"));
children.push(table(["#", "ชื่อ Procedure", "หน้าที่"], [
  ["1", { t: "sp_accept_ride_group(group_id, driver_id)", mono: true }, "คนขับรับงาน: ตรวจเงื่อนไข → มอบหมายคนขับ → ตั้งสถานะ accepted → บันทึก event"],
  ["2", { t: "sp_cancel_ride_group(group_id, actor_id, reason)", mono: true }, "ยกเลิกกลุ่ม: ตั้งสถานะ cancelled → คืนคนขับ → บันทึก event"],
  ["3", { t: "sp_expire_stale_groups(older_than)", mono: true }, "งานประจำ: ปิดกลุ่มที่รวมคนเกินเวลา แล้วบันทึก event (คืนจำนวนทาง INOUT)"],
]));

/* ---------------- 9 ---------------- */
children.push(H("9. ภาคผนวก — โค้ด DDL (CREATE TABLE)", HeadingLevel.HEADING_2));
children.push(P("โค้ด SQL สำหรับสร้างตารางทั้งหมด (ตัดส่วน DROP / policy / วัตถุอื่น ๆ ออกเพื่อความกระชับ ดูฉบับเต็มได้ในไฟล์ supabase.sql)", { size: 19, italics: true, color: "6B7688", after: 120 }));

const ddl = [
  "create table public.profiles (",
  "  id uuid primary key references auth.users(id) on delete cascade,",
  "  name text not null,",
  "  phone text,",
  "  role text not null check (role in ('passenger', 'driver')),",
  "  vehicle_seats integer not null default 4 check (vehicle_seats between 1 and 10),",
  "  created_at timestamptz not null default now()",
  ");",
  "",
  "create table public.ride_groups (",
  "  id uuid primary key default gen_random_uuid(),",
  "  leader_id uuid not null references public.profiles(id),",
  "  target_passengers integer not null check (target_passengers between 1 and 10),",
  "  status text not null default 'forming' check (status in ('forming','sent_to_driver','accepted','completed','cancelled')),",
  "  driver_id uuid references public.profiles(id),",
  "  created_at timestamptz not null default now(),",
  "  confirmed_at timestamptz,",
  "  accepted_at timestamptz,",
  "  completed_at timestamptz",
  ");",
  "",
  "create table public.ride_requests (",
  "  id uuid primary key default gen_random_uuid(),",
  "  passenger_id uuid not null references public.profiles(id),",
  "  group_id uuid references public.ride_groups(id) on delete set null,",
  "  origin_text text not null,",
  "  destination_text text not null,",
  "  origin_detail text,",
  "  destination_detail text,",
  "  origin_lat double precision not null,",
  "  origin_lng double precision not null,",
  "  destination_lat double precision not null,",
  "  destination_lng double precision not null,",
  "  target_passengers integer not null check (target_passengers between 1 and 10),",
  "  status text not null default 'searching' check (status in ('searching','matched','sent_to_driver','accepted','completed','cancelled')),",
  "  created_at timestamptz not null default now()",
  ");",
  "",
  "create table public.ride_group_members (",
  "  id uuid primary key default gen_random_uuid(),",
  "  group_id uuid not null references public.ride_groups(id) on delete cascade,",
  "  ride_request_id uuid not null references public.ride_requests(id) on delete cascade,",
  "  passenger_id uuid not null references public.profiles(id) on delete cascade,",
  "  party_size integer not null default 1 check (party_size between 1 and 10),",
  "  confirmed boolean not null default false,",
  "  joined_at timestamptz not null default now(),",
  "  unique(group_id, passenger_id),",
  "  unique(group_id, ride_request_id)",
  ");",
  "",
  "create table public.ride_routes (",
  "  id uuid primary key default gen_random_uuid(),",
  "  group_id uuid not null references public.ride_groups(id) on delete cascade,",
  "  distance_meters double precision,",
  "  duration_seconds double precision,",
  "  geometry jsonb,",
  "  created_at timestamptz not null default now(),",
  "  unique(group_id)",
  ");",
  "",
  "create table public.driver_locations (",
  "  id uuid primary key default gen_random_uuid(),",
  "  driver_id uuid not null references public.profiles(id) on delete cascade,",
  "  latitude double precision not null,",
  "  longitude double precision not null,",
  "  heading double precision,",
  "  speed double precision,",
  "  accuracy double precision,",
  "  updated_at timestamptz not null default now(),",
  "  unique(driver_id)",
  ");",
  "",
  "create table public.ride_group_events (",
  "  id bigserial primary key,",
  "  group_id uuid not null references public.ride_groups(id) on delete cascade,",
  "  actor_id uuid references public.profiles(id),",
  "  event text not null,",
  "  detail text,",
  "  created_at timestamptz not null default now()",
  ");",
];

for (const line of ddl) children.push(code([line]));

const doc = new Document({
  styles: { default: { document: { run: { font: FONT, size: 22 } } } },
  sections: [{ children }],
});

const buf = await Packer.toBuffer(doc);
writeFileSync(OUT, buf);
console.log("wrote " + OUT + " (" + buf.length + " bytes)");
