import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell,
  ImageRun, WidthType, ShadingType, AlignmentType, BorderStyle,
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
    spacing: { before: 200, after: 90 },
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
function bulletRich(runs) {
  return new Paragraph({
    bullet: { level: 0 },
    spacing: { after: 60, line: 276 },
    children: runs.map((r) => new TextRun({ text: r.t, font: r.mono ? MONO : FONT, size: 22, bold: r.bold, color: r.color })),
  });
}
function cellPara(text, opts = {}) {
  return new Paragraph({
    spacing: { after: 20, line: 240 },
    children: [new TextRun({ text: String(text), font: opts.mono ? MONO : FONT, size: 17, color: opts.color, italics: opts.italics, bold: opts.bold })],
  });
}
function cell(text, opts = {}) {
  return new TableCell({
    shading: opts.fill ? { type: ShadingType.SOLID, color: opts.fill, fill: opts.fill } : undefined,
    margins: { top: 30, bottom: 30, left: 70, right: 70 },
    children: [cellPara(text, opts)],
  });
}
function table(columns, rows) {
  const header = new TableRow({ tableHeader: true, children: columns.map((c) => cell(c, { bold: true, fill: "EEF2F7", color: "334155" })) });
  const body = rows.map((row) => new TableRow({
    children: row.map((c) => {
      if (c && typeof c === "object") return cell(c.t, { mono: c.mono, bold: c.bold, color: c.color, fill: c.fill });
      return cell(c);
    }),
  }));
  return new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [header, ...body] });
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
children.push(H("รายงาน Sprint 2 — กลุ่ม UP Drive", HeadingLevel.HEADING_1));
children.push(P("ระบบแชร์ค่าเดินทางสำหรับนักศึกษา มหาวิทยาลัยพะเยา (UP Drive)", { size: 24, color: "334155", after: 40 }));
children.push(P("กระบวนการพัฒนา: Agile / Scrum", { size: 21, color: "6B7688", after: 20 }));
children.push(P("ระยะเวลา Sprint: 10 วันทำการ (วันที่ ________ ถึง ________)", { size: 21, color: "6B7688", after: 20 }));
children.push(P("สมาชิกในกลุ่ม: _______________________________________", { size: 21, color: "6B7688", after: 120 }));
children.push(P("หมายเหตุ: เอกสารนี้สรุปงานที่กลุ่มทำจริงใน Sprint 2 (ย้ายกติกาสำคัญเข้าฐานข้อมูล, เพิ่มการติดตาม Realtime, deploy เว็บขึ้นออนไลน์) ตัวเลขคะแนน วันที่ และรายชื่อสมาชิกสามารถแก้ไขให้ตรงกับกลุ่มได้", { size: 18, italics: true, color: "92400E" }));

/* ---------------- 1 ---------------- */
children.push(H("1. ภาพรวม Sprint", HeadingLevel.HEADING_2));
children.push(table(["หัวข้อ", "รายละเอียด"], [
  ["โครงงาน", "UP Drive — ระบบแชร์ค่าเดินทางสำหรับนักศึกษา มหาวิทยาลัยพะเยา"],
  ["Sprint", "Sprint 2"],
  ["ระยะเวลา", "10 วันทำการ"],
  [{ t: "Sprint Goal", bold: true }, "ย้ายกติกาสำคัญของระบบเข้าสู่ฐานข้อมูล และเตรียมระบบให้พร้อมใช้งานจริงบนอินเทอร์เน็ต"],
  ["ผลลัพธ์หลัก", "Trigger 3 ตัว · SQL Function 3 ตัว · Stored Procedure 3 ตัว · ตาราง audit 1 ตาราง · Deploy บน Vercel · รายงาน 3 ฉบับ · สไลด์นำเสนอ 1 ชุด"],
  [{ t: "สถานะ", bold: true }, { t: "แล้วเสร็จ (งานคงเหลือ 0 points)", color: "166534", bold: true }],
]));
children.push(...image("burndown.png", 2240, 1352, "ภาพที่ 1 — Burndown Chart ของ Sprint 2 (งานคงเหลือลดจาก 40 จุด เหลือ 0 เมื่อสิ้นสุด Sprint)"));
children.push(...image("board.png", 2300, 1460, "ภาพที่ 2 — Sprint Board สรุปสถานะงานเมื่อสิ้นสุด Sprint 2"));

/* ---------------- 2 ---------------- */
children.push(H("2. บทนำ: จาก Sprint 1 สู่ Sprint 2", HeadingLevel.HEADING_2));
children.push(P("ใน Sprint 1 กลุ่มเราสร้างส่วนหลักของแอปพลิเคชันให้ใช้งานได้ครบวงจร ได้แก่ การสมัคร/เข้าสู่ระบบ, การประกาศเส้นทางความต้องการเดินทางพร้อมปักหมุดจุดรับ–ส่งบนแผนที่ (GPS), การจับคู่ผู้โดยสารที่ไปทางเดียวกันเป็นกลุ่ม และหน้า Dashboard สำหรับคนขับ พร้อมแผนที่และประวัติการเดินทาง", { after: 100 }));
children.push(P("อย่างไรก็ตาม ใน Sprint 1 ตรรกะสำคัญหลายอย่างยังอยู่ที่โค้ดฝั่งเซิร์ฟเวอร์ (Node.js) เช่น การตั้งเวลา confirmed_at / accepted_at / completed_at และการตรวจว่ากลุ่มมีคนขับหรือยัง ทำให้ถ้ามีการแก้ข้อมูลผ่านช่องทางอื่น (เช่น Supabase SQL Editor) กติกาเหล่านั้นจะถูกข้ามได้", { after: 100 }));
children.push(P("Sprint 2 จึงโฟกัส 2 เรื่องหลัก:", { bold: true, after: 60 }));
children.push(bulletRich([{ t: "ความถูกต้องของข้อมูล", bold: true }, { t: " — ย้ายกติกาสำคัญเข้าฐานข้อมูลด้วย Database Trigger, SQL Function และ Stored Procedure พร้อมเพิ่มตารางบันทึกเหตุการณ์ (audit log)" }]));
children.push(bulletRich([{ t: "ความพร้อมใช้งานจริง", bold: true }, { t: " — เพิ่มการติดตามตำแหน่งคนขับแบบ Realtime และ deploy เว็บขึ้นออนไลน์ พร้อมชุดทดสอบและเอกสารประกอบ" }]));

/* ---------------- 3 ---------------- */
children.push(H("3. Sprint Goal และขอบเขตงาน", HeadingLevel.HEADING_2));
children.push(new Paragraph({
  shading: { type: ShadingType.SOLID, color: "F3F0FF", fill: "F3F0FF" },
  spacing: { before: 60, after: 140, line: 276 },
  border: { left: { style: BorderStyle.SINGLE, size: 18, color: PURPLE, space: 8 } },
  children: [
    new TextRun({ text: "Sprint Goal: ", font: FONT, bold: true, size: 22, color: PURPLE }),
    new TextRun({ text: "ทำให้ข้อมูลของระบบถูกต้องเสมอไม่ว่าจะแก้จากช่องทางใด โดยย้ายกติกาสำคัญเข้าฐานข้อมูล และนำระบบขึ้นออนไลน์ให้ใช้งานได้จริง", font: FONT, size: 22 }),
  ],
}));
children.push(H3("อยู่ในขอบเขต (In scope)"));
children.push(bullet("Database Trigger 3 ตัว — เติมเวลาและบังคับกติกาความถูกต้องอัตโนมัติ"));
children.push(bullet("SQL Function 3 ตัว — คำนวณระยะทาง (Haversine), นับผู้โดยสารรวม, หากลุ่มที่ใกล้ที่สุด"));
children.push(bullet("Stored Procedure 3 ตัว — รับงาน / ยกเลิกกลุ่ม / ปิดกลุ่มที่ค้าง พร้อมบันทึก event log"));
children.push(bullet("การติดตามตำแหน่งคนขับแบบ Realtime"));
children.push(bullet("Deploy เว็บขึ้นออนไลน์ (Vercel) และชุดทดสอบ + เอกสาร"));
children.push(H3("นอกขอบเขต (Out of scope)"));
children.push(bullet("ระบบชำระเงิน/กระเป๋าเงิน"));
children.push(bullet("ระบบแจ้งเตือนแบบ push notification (เลื่อนไป Sprint ถัดไป)"));

/* ---------------- 4 ---------------- */
children.push(H("4. Sprint Backlog", HeadingLevel.HEADING_2));
children.push(P("รายการงานที่วางแผนและทำเสร็จใน Sprint 2 (คะแนนรวม 40 points)", { after: 100 }));
children.push(table(["รหัส", "งาน", "รายละเอียด", "คะแนน", "สถานะ"], [
  ["S2-01", "ออกแบบ schema / วิเคราะห์กติกา", "วิเคราะห์กติกาที่ควรย้ายเข้าฐานข้อมูล และออกแบบตาราง event log", "5", { t: "เสร็จ", color: "166534", bold: true }],
  ["S2-02", "Database Trigger 3 ตัว", "เติมเวลา / บังคับกติกา / อัปเดตพิกัดคนขับ", "5", { t: "เสร็จ", color: "166534", bold: true }],
  ["S2-03", "SQL Function 3 ตัว", "haversine_km, group_passenger_total, find_candidate_groups", "5", { t: "เสร็จ", color: "166534", bold: true }],
  ["S2-04", "Stored Procedure 3 ตัว", "sp_accept / sp_cancel / sp_expire", "5", { t: "เสร็จ", color: "166534", bold: true }],
  ["S2-05", "ตาราง audit ride_group_events", "บันทึกเหตุการณ์สำคัญของกลุ่มเดินทาง", "2", { t: "เสร็จ", color: "166534", bold: true }],
  ["S2-06", "ติดตามตำแหน่ง Realtime", "แสดง/รับตำแหน่งคนขับแบบเรียลไทม์ด้วย Supabase Realtime", "4", { t: "เสร็จ", color: "166534", bold: true }],
  ["S2-07", "Deploy ขึ้น Vercel", "ตั้งค่า environment, region sin1 (Singapore)", "4", { t: "เสร็จ", color: "166534", bold: true }],
  ["S2-08", "รายงาน 3 ฉบับ", "Trigger / Function / Procedure พร้อมภาพผลทดสอบจริง", "3", { t: "เสร็จ", color: "166534", bold: true }],
  ["S2-09", "สไลด์นำเสนอ", "ปัญหา / ผู้ใช้ / ฟีเจอร์ (pptx + PDF)", "2", { t: "เสร็จ", color: "166534", bold: true }],
  ["S2-10", "E2E test + คู่มือ", "แผนทดสอบกรณี CRUD ของ ride request และ README", "3", { t: "เสร็จ", color: "166534", bold: true }],
  ["S2-11", "เอกสาร Sprint 2", "เอกสารฉบับนี้", "2", { t: "เสร็จ", color: "166534", bold: true }],
]));

/* ---------------- 5 ---------------- */
children.push(H("5. งานที่ส่งมอบ (Increment)", HeadingLevel.HEADING_2));
children.push(P("Sprint 2 ส่งมอบงานฐานข้อมูล 3 กลุ่ม (รวม 9 วัตถุ) + การติดตาม Realtime + การ deploy จริง รายละเอียดดังนี้", { after: 100 }));

children.push(H3("5.1 โครงสร้างฐานข้อมูล (ER Diagram)"));
children.push(P("แผนภาพความสัมพันธ์ระหว่างตาราง (Entity–Relationship Diagram) ของฐานข้อมูล 7 ตารางหลัก ได้แก่ profiles, ride_groups, ride_requests, ride_group_members, ride_routes, driver_locations และตารางบันทึกเหตุการณ์ ride_group_events โดยใช้สัญลักษณ์ Crow's Foot แสดงความสัมพันธ์แบบหนึ่ง-ต่อ-หลาย (1:N) และหนึ่ง-ต่อ-หนึ่ง (1:1)", { after: 100 }));
children.push(...image("er-diagram.png", 2400, 2722, "ภาพที่ 3 — ER Diagram ของฐานข้อมูล UP Drive (7 ตารางหลัก + ตาราง audit log)"));

children.push(P("ตารางสรุปโครงสร้างฐานข้อมูล (Schema Summary) — ภาพรวมหน้าที่และความสัมพันธ์ของแต่ละตาราง", { bold: true, after: 70 }));
children.push(table(["ตาราง", "หน้าที่", "คีย์หลัก", "คีย์นอก (อ้างอิง)", "คอลัมน์"], [
  ["profiles", "ข้อมูลบัญชีผู้ใช้ (ผู้โดยสาร/คนขับ) ผูกกับระบบล็อกอิน", { t: "id", mono: true }, "— (อ้าง auth.users)", "6"],
  ["ride_groups", "กลุ่มเดินทาง ตั้งแต่เริ่มรวมคนจนจบงาน", { t: "id", mono: true }, "leader_id, driver_id → profiles", "9"],
  ["ride_requests", "คำขอเดินทางของผู้โดยสารหนึ่งคน พร้อมพิกัดต้นทาง–ปลายทาง", { t: "id", mono: true }, "passenger_id → profiles, group_id → ride_groups", "14"],
  ["ride_group_members", "สมาชิกในกลุ่ม (เชื่อม กลุ่ม ↔ คำขอ ↔ ผู้โดยสาร)", { t: "id", mono: true }, "group_id → ride_groups, ride_request_id → ride_requests, passenger_id → profiles", "7"],
  ["ride_routes", "เส้นทาง/ระยะทางของกลุ่ม (1 กลุ่ม : 1 เส้นทาง)", { t: "id", mono: true }, "group_id → ride_groups (UNIQUE)", "6"],
  ["driver_locations", "พิกัดล่าสุดของคนขับ สำหรับติดตามแบบ Realtime", { t: "id", mono: true }, "driver_id → profiles (UNIQUE)", "8"],
  ["ride_group_events", "บันทึกเหตุการณ์ของกลุ่ม (audit log)", { t: "id", mono: true }, "group_id → ride_groups, actor_id → profiles", "6"],
]));

children.push(P("รายละเอียดคอลัมน์ทั้งหมด (Data Dictionary)", { bold: true, before: 140, after: 70 }));
children.push(table(["ตาราง", "คอลัมน์", "ชนิดข้อมูล", "คีย์ / ข้อกำหนด"], [
  ["profiles", { t: "id", mono: true }, "uuid", "PK · อ้าง auth.users(id)"],
  ["", { t: "name", mono: true }, "text", "NOT NULL"],
  ["", { t: "phone", mono: true }, "text", "—"],
  ["", { t: "role", mono: true }, "text", "NOT NULL · CHECK (passenger, driver)"],
  ["", { t: "vehicle_seats", mono: true }, "integer", "NOT NULL · DEFAULT 4 · CHECK 1–10"],
  ["", { t: "created_at", mono: true }, "timestamptz", "NOT NULL · DEFAULT now()"],
  ["ride_groups", { t: "id", mono: true }, "uuid", "PK · DEFAULT gen_random_uuid()"],
  ["", { t: "leader_id", mono: true }, "uuid", "FK → profiles(id) · NOT NULL"],
  ["", { t: "target_passengers", mono: true }, "integer", "NOT NULL · CHECK 1–10"],
  ["", { t: "status", mono: true }, "text", "NOT NULL · DEFAULT 'forming' · CHECK (forming, sent_to_driver, accepted, completed, cancelled)"],
  ["", { t: "driver_id", mono: true }, "uuid", "FK → profiles(id) · เป็น NULL ได้"],
  ["", { t: "created_at", mono: true }, "timestamptz", "NOT NULL · DEFAULT now()"],
  ["", { t: "confirmed_at", mono: true }, "timestamptz", "เติมอัตโนมัติโดย Trigger"],
  ["", { t: "accepted_at", mono: true }, "timestamptz", "เติมอัตโนมัติโดย Trigger"],
  ["", { t: "completed_at", mono: true }, "timestamptz", "เติมอัตโนมัติโดย Trigger"],
  ["ride_requests", { t: "id", mono: true }, "uuid", "PK · DEFAULT gen_random_uuid()"],
  ["", { t: "passenger_id", mono: true }, "uuid", "FK → profiles(id) · NOT NULL"],
  ["", { t: "group_id", mono: true }, "uuid", "FK → ride_groups(id) · ON DELETE SET NULL"],
  ["", { t: "origin_text", mono: true }, "text", "NOT NULL"],
  ["", { t: "destination_text", mono: true }, "text", "NOT NULL"],
  ["", { t: "origin_detail", mono: true }, "text", "—"],
  ["", { t: "destination_detail", mono: true }, "text", "—"],
  ["", { t: "origin_lat", mono: true }, "double precision", "NOT NULL"],
  ["", { t: "origin_lng", mono: true }, "double precision", "NOT NULL"],
  ["", { t: "destination_lat", mono: true }, "double precision", "NOT NULL"],
  ["", { t: "destination_lng", mono: true }, "double precision", "NOT NULL"],
  ["", { t: "target_passengers", mono: true }, "integer", "NOT NULL · CHECK 1–10"],
  ["", { t: "status", mono: true }, "text", "NOT NULL · DEFAULT 'searching' · CHECK (searching, matched, sent_to_driver, accepted, completed, cancelled)"],
  ["", { t: "created_at", mono: true }, "timestamptz", "NOT NULL · DEFAULT now()"],
  ["ride_group_members", { t: "id", mono: true }, "uuid", "PK · DEFAULT gen_random_uuid()"],
  ["", { t: "group_id", mono: true }, "uuid", "FK → ride_groups(id) · NOT NULL · ON DELETE CASCADE · UNIQUE(group_id, passenger_id), UNIQUE(group_id, ride_request_id)"],
  ["", { t: "ride_request_id", mono: true }, "uuid", "FK → ride_requests(id) · NOT NULL · ON DELETE CASCADE"],
  ["", { t: "passenger_id", mono: true }, "uuid", "FK → profiles(id) · NOT NULL · ON DELETE CASCADE"],
  ["", { t: "party_size", mono: true }, "integer", "NOT NULL · DEFAULT 1 · CHECK 1–10"],
  ["", { t: "confirmed", mono: true }, "boolean", "NOT NULL · DEFAULT false"],
  ["", { t: "joined_at", mono: true }, "timestamptz", "NOT NULL · DEFAULT now()"],
  ["ride_routes", { t: "id", mono: true }, "uuid", "PK · DEFAULT gen_random_uuid()"],
  ["", { t: "group_id", mono: true }, "uuid", "FK → ride_groups(id) · NOT NULL · UNIQUE · ON DELETE CASCADE"],
  ["", { t: "distance_meters", mono: true }, "double precision", "—"],
  ["", { t: "duration_seconds", mono: true }, "double precision", "—"],
  ["", { t: "geometry", mono: true }, "jsonb", "—"],
  ["", { t: "created_at", mono: true }, "timestamptz", "NOT NULL · DEFAULT now()"],
  ["driver_locations", { t: "id", mono: true }, "uuid", "PK · DEFAULT gen_random_uuid()"],
  ["", { t: "driver_id", mono: true }, "uuid", "FK → profiles(id) · NOT NULL · UNIQUE · ON DELETE CASCADE"],
  ["", { t: "latitude", mono: true }, "double precision", "NOT NULL"],
  ["", { t: "longitude", mono: true }, "double precision", "NOT NULL"],
  ["", { t: "heading", mono: true }, "double precision", "—"],
  ["", { t: "speed", mono: true }, "double precision", "—"],
  ["", { t: "accuracy", mono: true }, "double precision", "—"],
  ["", { t: "updated_at", mono: true }, "timestamptz", "NOT NULL · DEFAULT now() · อัปเดตโดย Trigger"],
  ["ride_group_events", { t: "id", mono: true }, "bigserial", "PK (running number)"],
  ["", { t: "group_id", mono: true }, "uuid", "FK → ride_groups(id) · NOT NULL · ON DELETE CASCADE"],
  ["", { t: "actor_id", mono: true }, "uuid", "FK → profiles(id) · เป็น NULL ได้"],
  ["", { t: "event", mono: true }, "text", "NOT NULL"],
  ["", { t: "detail", mono: true }, "text", "—"],
  ["", { t: "created_at", mono: true }, "timestamptz", "NOT NULL · DEFAULT now()"],
]));

children.push(H3("5.2 Database Trigger (3 ตัว)"));
children.push(table(["#", "ชื่อ Trigger", "ตาราง", "Event / Timing", "หน้าที่"], [
  ["1", { t: "trg_ride_groups_status_timestamps", mono: true }, "ride_groups", "BEFORE UPDATE", "เติม confirmed_at / accepted_at / completed_at อัตโนมัติเมื่อสถานะเปลี่ยน"],
  ["2", { t: "trg_ride_groups_driver_rules", mono: true }, "ride_groups", "BEFORE UPDATE", "บล็อก (RAISE EXCEPTION) ถ้าตั้งสถานะ accepted แต่ยังไม่มีคนขับ"],
  ["3", { t: "trg_driver_locations_touch", mono: true }, "driver_locations", "BEFORE UPDATE", "อัปเดต updated_at ทุกครั้งที่พิกัดคนขับเปลี่ยน"],
]));

children.push(H3("5.3 SQL Function (3 ตัว)"));
children.push(table(["#", "ชื่อฟังก์ชัน", "ประเภท", "หน้าที่"], [
  ["1", { t: "haversine_km(lat1,lng1,lat2,lng2)", mono: true }, "Scalar", "คำนวณระยะทางระหว่างพิกัด 2 จุด (km) ด้วยสูตร Haversine"],
  ["2", { t: "group_passenger_total(group_id)", mono: true }, "Scalar", "นับจำนวนผู้โดยสารรวมของกลุ่ม (ผลรวม party_size)"],
  ["3", { t: "find_candidate_groups(...)", mono: true }, "Table", "หากลุ่มที่กำลังรวมคนซึ่งใกล้คำขอใหม่ คืนเป็นตารางพร้อมคะแนน (score)"],
]));

children.push(H3("5.4 Stored Procedure (3 ตัว)"));
children.push(table(["#", "ชื่อ Procedure", "หน้าที่"], [
  ["1", { t: "sp_accept_ride_group(group_id, driver_id)", mono: true }, "คนขับรับงาน: ตรวจเงื่อนไข → มอบหมายคนขับ → ตั้งสถานะ accepted → บันทึก event"],
  ["2", { t: "sp_cancel_ride_group(group_id, actor_id, reason)", mono: true }, "ยกเลิกกลุ่ม: ตั้งสถานะ cancelled → คืนคนขับ → บันทึก event"],
  ["3", { t: "sp_expire_stale_groups(older_than)", mono: true }, "งานประจำ: ปิดกลุ่มที่รวมคนเกินเวลาที่กำหนด แล้วบันทึก event (คืนจำนวนทาง INOUT)"],
]));

children.push(H3("5.5 ตารางบันทึกเหตุการณ์ (ride_group_events)"));
children.push(P("ตารางใหม่ที่ใช้เก็บเหตุการณ์สำคัญของกลุ่มเดินทาง (accepted / cancelled / expired) โดยถูกเขียนอัตโนมัติจาก Stored Procedure ทำให้ตรวจสอบย้อนหลังได้ว่ากลุ่มหนึ่ง ๆ เกิดอะไรขึ้นเมื่อไร และใครเป็นผู้ทำ", { after: 100 }));

children.push(H3("5.6 การติดตามตำแหน่งแบบ Realtime"));
children.push(P("คนขับส่งพิกัดปัจจุบันเข้าตาราง driver_locations และ Trigger จะอัปเดต updated_at ให้เอง ฝั่งผู้โดยสารติดตามการเปลี่ยนแปลงแบบ Realtime ผ่าน Supabase Realtime จึงเห็นตำแหน่งคนขับที่อัปเดตโดยไม่ต้องรีเฟรชหน้า", { after: 100 }));

children.push(H3("5.7 Deploy ขึ้นออนไลน์ (Vercel)"));
children.push(P("นำเว็บแอป (Node.js + Express) ขึ้นโฮสต์บน Vercel โดยตั้งค่า environment variables (SUPABASE_URL, SUPABASE_SECRET_KEY) และกำหนด region เป็น Singapore (sin1) เพื่อให้ตอบสนองเร็วในไทย ผลลัพธ์คือระบบออนไลน์จริงที่เข้าถึงได้จากทุกที่", { after: 100 }));

children.push(H3("5.8 เอกสารและสื่อนำเสนอ"));
children.push(bullet("รายงาน 3 ฉบับ: Database Trigger / SQL Function / Stored Procedure (พร้อมภาพผลการรันจริง)"));
children.push(bullet("สไลด์นำเสนอโครงงาน (ปัญหา / ผู้ใช้ / ฟีเจอร์) ทั้งไฟล์ PowerPoint และ PDF"));
children.push(bullet("คู่มือ README และไฟล์ SQL สำหรับสร้างฐานข้อมูล (supabase.sql, supabase.test.sql)"));

/* ---------------- 6 ---------------- */
children.push(H("6. ผลการทดสอบ (หลักฐาน)", HeadingLevel.HEADING_2));
children.push(P("ทุกหัวข้อทดสอบด้วย SQL ชุดเดียวกับที่ใช้บน Supabase บน PostgreSQL 16 (จำลองด้วย PGlite/WASM) และทดสอบระบบที่ deploy จริงบน Vercel", { italics: true, size: 19, color: "6B7688", after: 120 }));

children.push(H3("6.1 Database Trigger"));
children.push(...image("trigger-timestamps.png", 1200, 1779, "ภาพที่ 4 — Trigger เติมเวลา confirmed_at / accepted_at / completed_at อัตโนมัติตามสถานะ"));
children.push(...image("trigger-guard.png", 1200, 824, "ภาพที่ 5 — ฐานข้อมูลปฏิเสธ (ERROR) เมื่อตั้งสถานะ accepted โดยไม่มีคนขับ"));
children.push(table(["กรณีทดสอบ", "ผลลัพธ์ที่ได้", "ผล"], [
  ["เปลี่ยนสถานะ forming → sent_to_driver", "confirmed_at ถูกเติมอัตโนมัติ", { t: "ผ่าน", color: "166534", bold: true }],
  ["เปลี่ยนสถานะ → accepted / completed", "accepted_at / completed_at ถูกเติมอัตโนมัติ", { t: "ผ่าน", color: "166534", bold: true }],
  ["แก้ฟิลด์อื่น (target_passengers)", "ค่าเวลาเดิมไม่ถูกเขียนทับ", { t: "ผ่าน", color: "166534", bold: true }],
  ["ตั้ง accepted โดยไม่มีคนขับ", "ถูกบล็อกด้วย ERROR", { t: "ผ่าน", color: "166534", bold: true }],
  ["แก้พิกัดคนขับ", "updated_at อัปเดตเอง", { t: "ผ่าน", color: "166534", bold: true }],
]));

children.push(H3("6.2 SQL Function"));
children.push(...image("func-scalar.png", 1920, 1684, "ภาพที่ 6 — ผลของ haversine_km() และ group_passenger_total()"));
children.push(...image("func-candidates.png", 1920, 1704, "ภาพที่ 7 — ผลของ find_candidate_groups() เรียงตามคะแนน และกรองกลุ่มที่ไกลเกินระยะ"));
children.push(table(["กรณีทดสอบ", "ผลลัพธ์ที่ได้", "ผล"], [
  ["haversine_km() กับพิกัดที่ทราบค่า", "ได้ 0.107 / 0.383 / 4.965 km ตรงตามพิกัด", { t: "ผ่าน", color: "166534", bold: true }],
  ["group_passenger_total()", "กลุ่ม A = 3 (party_size), กลุ่มว่าง = 0", { t: "ผ่าน", color: "166534", bold: true }],
  ["find_candidate_groups() ระยะ 4 km", "คืนเฉพาะกลุ่มที่ใกล้ พร้อมคะแนน เรียงถูกต้อง", { t: "ผ่าน", color: "166534", bold: true }],
  ["ปรับรัศมีเป็น 0.3 km", "เหลือเฉพาะกลุ่มที่ใกล้ที่สุด (รับ parameter ได้จริง)", { t: "ผ่าน", color: "166534", bold: true }],
]));

children.push(H3("6.3 Stored Procedure"));
children.push(...image("proc-accept.png", 1920, 1792, "ภาพที่ 8 — CALL sp_accept_ride_group() แล้วข้อมูลถูกต้อง"));
children.push(...image("proc-events.png", 1920, 1308, "ภาพที่ 9 — event log บันทึกเหตุการณ์อัตโนมัติครบถ้วน"));
children.push(table(["กรณีทดสอบ", "ผลลัพธ์ที่ได้", "ผล"], [
  ["คนขับรับงาน (ปกติ)", "สถานะ = accepted, มีคนขับ, มี event accepted", { t: "ผ่าน", color: "166534", bold: true }],
  ["รับงานซ้ำ", "ถูกปฏิเสธ: กลุ่มสถานะ accepted รับงานไม่ได้", { t: "ผ่าน", color: "166534", bold: true }],
  ["ให้ผู้โดยสารรับงานแทนคนขับ", "ถูกปฏิเสธ: ผู้ใช้ไม่ใช่คนขับ", { t: "ผ่าน", color: "166534", bold: true }],
  ["ยกเลิกกลุ่ม", "สถานะ = cancelled, คืนคนขับ, มี event cancelled", { t: "ผ่าน", color: "166534", bold: true }],
  ["ปิดกลุ่มที่ค้าง (expire)", "คืนค่า 1 ทาง INOUT, มี event expired", { t: "ผ่าน", color: "166534", bold: true }],
]));

children.push(H3("6.4 การ Deploy จริง (Production)"));
children.push(...image("deploy-health.png", 2000, 998, "ภาพที่ 10 — ตรวจสอบเซิร์ฟเวอร์ที่ deploy จริง: /api/health ตอบ ok และหน้าเว็บหลักโหลดได้ (HTTP 200)"));
children.push(table(["รายการตรวจสอบ", "ผลลัพธ์", "ผล"], [
  ["GET /api/health", { t: "{\"ok\":true,\"message\":\"UP-Drive server is running\"}", mono: true }, { t: "ผ่าน", color: "166534", bold: true }],
  ["GET / (หน้าเว็บหลัก)", "HTTP 200", { t: "ผ่าน", color: "166534", bold: true }],
  ["เชื่อมต่อฐานข้อมูล Supabase", "เรียก POST /api/auth/login ได้ (ฐานข้อมูลตอบสนอง)", { t: "ผ่าน", color: "166534", bold: true }],
  ["Region", "Singapore (sin1)", { t: "ผ่าน", color: "166534", bold: true }],
]));

children.push(H3("6.5 ชุดทดสอบอัตโนมัติ (E2E)"));
children.push(P("ทดสอบวงจรของคำขอเดินทาง (ride request) ตามแผนในไฟล์ TEST-PLAN.md ด้วยสคริปต์อัตโนมัติ", { after: 80 }));
children.push(table(["รหัส", "การทดสอบ", "ผลที่คาดหวัง"], [
  ["TC-01", "สร้างคำขอเดินทางด้วยข้อมูลถูกต้อง", "HTTP 201, ได้ ride id และ passenger id"],
  ["TC-02", "อ่านคำขอที่สร้างใน TC-01", "HTTP 200, ค่าตรงกับที่สร้าง"],
  ["TC-03", "ยกเลิกคำขอนั้น", "HTTP 200, สถานะกลายเป็น cancelled"],
  ["TC-04", "สร้างคำขอโดยไม่มีต้นทาง", "HTTP 400, ไม่มีข้อมูลถูกสร้าง"],
]));

/* ---------------- 7 ---------------- */
children.push(H("7. Definition of Done", HeadingLevel.HEADING_2));
children.push(P("งานจะถือว่า \"เสร็จ\" เมื่อผ่านเงื่อนไขต่อไปนี้", { after: 80 }));
children.push(bullet("โค้ด SQL รันผ่านจริงบน PostgreSQL ไม่มี error"));
children.push(bullet("มีกรณีทดสอบที่ยืนยันทั้งเส้นทางที่ถูกต้องและเส้นทางที่ผิด (guard / validation)"));
children.push(bullet("มีภาพผลการรันจริงประกอบในเอกสาร"));
children.push(bullet("โค้ดถูกใส่ในไฟล์ schema จริงของโปรเจกต์ (supabase.sql) พร้อมใช้งานเมื่อสร้างฐานข้อมูลใหม่"));
children.push(bullet("ฟีเจอร์ที่เกี่ยวกับผู้ใช้ถูกทดสอบบนเว็บที่ deploy จริงแล้ว"));
children.push(bullet("เพื่อนร่วมกลุ่มทบทวน (review) และ merge เข้า branch main แล้ว"));

/* ---------------- 8 ---------------- */
children.push(H("8. Sprint Review (ผลการนำเสนอ)", HeadingLevel.HEADING_2));
children.push(P("สิ่งที่นำเสนอต่ออาจารย์/เพื่อนร่วมชั้นเมื่อสิ้นสุด Sprint", { after: 80 }));
children.push(bullet("สาธิตการ deploy จริง: เปิดเว็บ https://up-drive.vercel.app และทดสอบการเข้าสู่ระบบ"));
children.push(bullet("สาธิต Trigger: เปลี่ยนสถานะกลุ่มแล้วเห็นเวลาถูกเติมเอง และการถูกบล็อกเมื่อตั้ง accepted โดยไม่มีคนขับ"));
children.push(bullet("สาธิต Function: เรียก find_candidate_groups() แล้วเห็นผลการจับคู่พร้อมคะแนน"));
children.push(bullet("สาธิต Procedure: เรียก sp_accept_ride_group() แล้วเห็นสถานะเปลี่ยนพร้อม event log"));
children.push(bullet("นำเสนอสไลด์สรุป ปัญหา / ผู้ใช้ / ฟีเจอร์ ของโครงงาน"));

/* ---------------- 9 ---------------- */
children.push(H("9. Sprint Retrospective", HeadingLevel.HEADING_2));
children.push(table(["สิ่งที่ทำได้ดี", "สิ่งที่ควรปรับปรุง", "จะทำใน Sprint ถัดไป"], [
  ["ย้ายกติกาสำคัญเข้าฐานข้อมูลสำเร็จ ทำให้ข้อมูลถูกต้องไม่ว่าแก้จากทางไหน", "ช่วงแรกใช้เวลาออกแบบ schema นาน งานจึงเริ่มช้ากว่าอุดมคติ 2 วัน", "แบ่งงานออกแบบให้เล็กลงและประเมินเวลาเผื่อมากขึ้น"],
  ["มีการทดสอบจริงพร้อมภาพหลักฐานทุกหัวข้อ", "เอกสารและภาพประกอบใช้เวลามาก ควรทำไปพร้อมกับงาน", "เขียนเอกสารประกอบทันทีหลังปิดงานแต่ละชิ้น"],
  ["Deploy จริงและทดสอบบน production ได้", "ควรมีระบบแจ้งเตือนเมื่อ deploy ล้มเหลว", "ตั้งค่า monitoring/แจ้งเตือนการ deploy"],
]));

/* ---------------- 10 ---------------- */
children.push(H("10. ปัญหาและอุปสรรค", HeadingLevel.HEADING_2));
children.push(table(["ปัญหา", "วิธีแก้ไข"], [
  ["ตรรกะสำคัญอยู่ที่โค้ดฝั่งแอป ทำให้กติกาถูกข้ามได้เมื่อแก้ข้อมูลตรง", "ย้ายกติกาเข้าฐานข้อมูลด้วย Trigger และ Procedure"],
  ["การรับงาน/ยกเลิกกลุ่มเดิมยิงหลายคำสั่ง เสี่ยงข้อมูลไม่ตรงกัน", "รวมเป็น Stored Procedure เดียว จัดการใน transaction และใช้ FOR UPDATE ล็อกแถว"],
  ["หน้าจอผู้ใช้อัปเดตช้ากว่าข้อมูลจริง", "ใช้ Supabase Realtime ติดตามการเปลี่ยนแปลงของตำแหน่งคนขับ"],
  ["ไม่เคยมีประสบการณ์ deploy ขึ้นโฮสต์จริง", "ศึกษาการ deploy แบบ zero-config ของ Vercel และทดสอบ /api/health หลัง deploy"],
]));

/* ---------------- 11 ---------------- */
children.push(H("11. แผน Sprint ถัดไป (Sprint 3)", HeadingLevel.HEADING_2));
children.push(bullet("แผนที่ติดตามตำแหน่งคนขับแบบ live หลายคันพร้อมกัน"));
children.push(bullet("ระบบแจ้งเตือน (push notification) เมื่อคนขับรับงานหรือใกล้ถึงจุดรับ"));
children.push(bullet("ปรับปรุง UI/UX ให้ใช้งานบนมือถือสะดวกขึ้น และเพิ่มการประเมินคนขับ"));
children.push(bullet("เพิ่ม test coverage และระบบ monitoring ของการ deploy"));

/* ---------------- 12 ---------------- */
children.push(H("12. สรุป", HeadingLevel.HEADING_2));
children.push(bullet("Sprint 2 ทำสำเร็จตาม Sprint Goal: ย้ายกติกาสำคัญเข้าฐานข้อมูลและนำระบบขึ้นออนไลน์จริง"));
children.push(bullet("ส่งมอบงานฐานข้อมูล 9 วัตถุ (Trigger 3 · Function 3 · Procedure 3) พร้อมตาราง audit"));
children.push(bullet("ทดสอบครบทั้งเส้นทางถูกต้องและเส้นทางผิด ได้ผลผ่านทุกกรณี พร้อมภาพหลักฐาน"));
children.push(bullet("ระบบพร้อมใช้งานจริงที่ https://up-drive.vercel.app และมีชุดทดสอบ + เอกสารประกอบครบ"));

/* ---------------- 13 ---------------- */
children.push(H("13. ภาคผนวก — ลิงก์และไฟล์ที่เกี่ยวข้อง", HeadingLevel.HEADING_2));
children.push(table(["รายการ", "ที่อยู่ / ไฟล์"], [
  ["เว็บไซต์ที่ deploy จริง", { t: "https://up-drive.vercel.app", mono: true }],
  ["ซอร์สโค้ด (GitHub)", { t: "github.com/phathon2006/-UP-drive", mono: true }],
  ["Schema ฐานข้อมูล", { t: "supabase.sql / supabase.test.sql", mono: true }],
  ["รายงาน Trigger", { t: "docs/trigger-report/report.docx", mono: true }],
  ["รายงาน Function", { t: "docs/function-report/report.docx", mono: true }],
  ["รายงาน Procedure", { t: "docs/procedure-report/report.docx", mono: true }],
  ["สไลด์นำเสนอ", { t: "docs/slides/UP-Drive-Slides.pptx (.pdf)", mono: true }],
  ["แผนทดสอบ", { t: "TEST-PLAN.md", mono: true }],
]));

const doc = new Document({
  styles: { default: { document: { run: { font: FONT, size: 22, color: INK } } } },
  sections: [{
    properties: { page: { margin: { top: 1000, bottom: 1000, left: 1000, right: 1000 } } },
    children,
  }],
});

const buf = await Packer.toBuffer(doc);
writeFileSync(OUT, buf);
console.log("wrote " + OUT + " (" + buf.length + " bytes)");
