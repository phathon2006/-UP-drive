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

const data = JSON.parse(readFileSync(join(__dirname, "results-func.json"), "utf8"));
const funcSql = readFileSync(join(REPO, "functions.sql"), "utf8").trim();

const FONT = "Tahoma";
const MONO = "Consolas";

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
    children: [new TextRun({ text, font: FONT, bold: true, color: "1B2434" })],
  });
}
function bullet(text) {
  return new Paragraph({
    bullet: { level: 0 },
    spacing: { after: 60, line: 276 },
    children: [new TextRun({ text, font: FONT, size: 22 })],
  });
}
function codeBlock(text) {
  const lines = text.split("\n");
  const children = lines.map((ln, i) =>
    new TextRun({ text: ln, font: MONO, size: 15, color: "E6EDF3", break: i === 0 ? 0 : 1 })
  );
  return new Paragraph({
    shading: { type: ShadingType.SOLID, color: "1E2430", fill: "1E2430" },
    spacing: { before: 80, after: 140, line: 220 },
    children,
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
function resultTable(r) {
  if (!r) return [];
  const header = new TableRow({ tableHeader: true, children: r.columns.map((c) => cell(c, { bold: true, fill: "EEF2F7", color: "334155" })) });
  const rows = r.rows.length
    ? r.rows.map((row) => new TableRow({
        children: r.columns.map((c) => {
          const v = row[c];
          if (v === null) return cell("NULL", { color: "94A3B8", italics: true, mono: true });
          if (typeof v === "number") return cell(v, { mono: true, bold: true, color: "166534" });
          if (typeof v === "string" && /^[0-9a-f]{8}$/.test(v)) return cell(v + "…", { mono: true });
          return cell(v, { mono: true });
        }),
      }))
    : [new TableRow({ children: [cell("(ไม่มีแถว)", { color: "6B7688" })] })];
  return [new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [header, ...rows] })];
}

const MAXW = 620, MAXH = 780;
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

const stepByNo = (n) => data.steps.find((s) => s.no === n);
function stepBlock(s) {
  if (!s) return [];
  const out = [
    new Paragraph({ spacing: { before: 140, after: 40 }, children: [new TextRun({ text: `ขั้นที่ ${s.no} — ${s.title}`, font: FONT, size: 21, bold: true, color: "0F766E" })] }),
    codeBlock(s.sql),
    ...resultTable(s.result),
  ];
  if (s.note) out.push(P(s.note, { size: 19, color: "155E75" }));
  out.push(new Paragraph({ spacing: { after: 40 } }));
  return out;
}

const children = [];

// ---- cover ----
children.push(H("รายงาน SQL Function — กลุ่ม UP Drive", HeadingLevel.HEADING_1));
children.push(P("ระบบแชร์ค่ารถสำหรับนักศึกษา มหาวิทยาลัยพะเยา (UP Drive)", { size: 24, color: "334155", after: 40 }));
children.push(P("ฐานข้อมูล: PostgreSQL ผ่าน Supabase", { size: 21, color: "6B7688", after: 20 }));
children.push(P("หัวข้อรายงาน: SQL Function ของกลุ่ม", { size: 21, color: "6B7688", after: 20 }));
children.push(P("สมาชิกในกลุ่ม: _______________________", { size: 21, color: "6B7688", after: 120 }));
children.push(P("หมายเหตุ: รูปในรายงานนี้เป็นผลการเรียกใช้ฟังก์ชันจริงบน PostgreSQL 16 (จำลองด้วย PGlite/WASM) ด้วย SQL ชุดเดียวกับที่ใช้บน Supabase", { size: 18, italics: true, color: "92400E" }));
children.push(...image("01-overview.png", 960, 738, "ภาพที่ 1 — ภาพรวมรายงาน"));

// ---- 1 ----
children.push(H("1. SQL Function คืออะไร", HeadingLevel.HEADING_2));
children.push(P("SQL Function (ฟังก์ชัน) คือชุดคำสั่ง SQL ที่ถูกเก็บไว้ในฐานข้อมูล ตั้งชื่อไว้ แล้วเรียกใช้ซ้ำได้ด้วยชื่อฟังก์ชัน พร้อมส่งค่า (parameter) เข้าไปได้ เหมือนฟังก์ชันในภาษาโปรแกรม แต่ทำงานอยู่ที่ฐานข้อมูล"));
children.push(P("ข้อดีคือ เขียนตรรกะครั้งเดียว แล้วเรียกใช้ได้จากทุกที่ — จาก SQL Editor, จากฟังก์ชันอื่น หรือจากแอปพลิเคชันผ่าน supabase.rpc()"));

// ---- 2 ----
children.push(H("2. ประเภทของฟังก์ชันที่ใช้ในงานนี้", HeadingLevel.HEADING_2));
children.push(bullet("Scalar function — คืนค่าเดี่ยว 1 ค่า เช่น haversine_km() คืนตัวเลขระยะทาง"));
children.push(bullet("Table function — คืนผลเป็นตาราง เรียกด้วย select * from fn(...) เช่น find_candidate_groups()"));
children.push(bullet("เขียนด้วยภาษา SQL (language sql) จึงอ่านง่ายและให้ฐานข้อมูลจัดการ optimize เอง"));

// ---- 3 ----
children.push(H("3. เหตุผลที่กลุ่มเลือกเขียน Function", HeadingLevel.HEADING_2));
children.push(P("เดิมตรรกะการคำนวณระยะทางและการจับคู่กลุ่มที่ใกล้ที่สุดอยู่ที่โค้ดฝั่งเซิร์ฟเวอร์ (Node.js) กลุ่มเราย้ายมาเป็น SQL Function เพื่อให้ฐานข้อมูลคำนวณได้เอง ใช้ซ้ำได้ทุกที่ และทดสอบได้ทันทีใน SQL Editor"));

// ---- 4 ----
children.push(H("4. SQL Function ทั้ง 3 ตัวของกลุ่ม", HeadingLevel.HEADING_2));
children.push(new Table({
  width: { size: 100, type: WidthType.PERCENTAGE },
  rows: [
    new TableRow({ tableHeader: true, children: [cell("#", { bold: true, fill: "EEF2F7" }), cell("ชื่อฟังก์ชัน", { bold: true, fill: "EEF2F7" }), cell("ประเภท", { bold: true, fill: "EEF2F7" }), cell("หน้าที่", { bold: true, fill: "EEF2F7" })] }),
    new TableRow({ children: [cell("1"), cell("haversine_km(lat1,lng1,lat2,lng2)", { mono: true }), cell("scalar"), cell("คำนวณระยะทางระหว่างพิกัด 2 จุด (กิโลเมตร) ด้วยสูตร Haversine")] }),
    new TableRow({ children: [cell("2"), cell("group_passenger_total(group_id)", { mono: true }), cell("scalar"), cell("นับจำนวนผู้โดยสารรวมของกลุ่ม (ผลรวม party_size)")] }),
    new TableRow({ children: [cell("3"), cell("find_candidate_groups(...)", { mono: true }), cell("table (set-returning)"), cell("หากลุ่มที่กำลังรวมคนซึ่งใกล้คำขอเดินทางใหม่ แล้วคืนเป็นตารางพร้อมคะแนน")] }),
  ],
}));
children.push(P("โค้ด SQL Function ทั้งหมด (ไฟล์ functions.sql)", { bold: true, before: 140 }));
children.push(codeBlock(funcSql));
children.push(...image("02-code-1.png", 900, 1347, "ภาพที่ 2 — โค้ดฟังก์ชันส่วนที่ 1 (haversine_km และ group_passenger_total)", 820));
children.push(...image("02-code-2.png", 900, 1102, "ภาพที่ 3 — โค้ดฟังก์ชันส่วนที่ 2 (find_candidate_groups)", 820));

// ---- 5 ----
children.push(H("5. ผลการทดสอบ — Scalar Functions", HeadingLevel.HEADING_2));
children.push(P("เรียก haversine_km() เพื่อวัดระยะทางจากจุดรับของผู้โดยสารใหม่ไปยังแต่ละกลุ่ม และเรียก group_passenger_total() เพื่อนับผู้โดยสารในแต่ละกลุ่ม"));
children.push(...stepBlock(stepByNo(2)));
children.push(...stepBlock(stepByNo(3)));
children.push(...image("03-scalar.png", 960, 842, "ภาพที่ 4 — ผลเรียก haversine_km() และ group_passenger_total()"));

// ---- 6 ----
children.push(H("6. ผลการทดสอบ — Table Function (ตัวหลัก)", HeadingLevel.HEADING_2));
children.push(P("เรียก find_candidate_groups() เพื่อหากลุ่มที่ใกล้คำขอเดินทางใหม่ โดยคืนผลเป็นตารางพร้อมคะแนน (ยิ่งน้อย = ยิ่งใกล้) กลุ่ม B ถูกตัดออกเพราะจุดรับไกลเกิน 4 km และเมื่อปรับรัศมีให้แคบลง ผลลัพธ์ก็เปลี่ยนตาม parameter"));
children.push(...stepBlock(stepByNo(4)));
children.push(...stepBlock(stepByNo(5)));
children.push(...image("04-candidates.png", 960, 852, "ภาพที่ 5 — ผลเรียก find_candidate_groups() และการปรับ parameter"));

// ---- 7 ----
children.push(H("7. รายการ SQL Function ทั้งหมดในฐานข้อมูล", HeadingLevel.HEADING_2));
children.push(P("ตรวจสอบจากตารางระบบ pg_proc ร่วมกับ pg_language เพื่อยืนยันว่าฟังก์ชันถูกสร้างจริงและเขียนด้วยภาษา SQL"));
children.push(...resultTable(data.functions));
children.push(...image("05-list.png", 960, 580, "ภาพที่ 6 — ตารางแสดง SQL Function ทั้งหมด"));

// ---- 8 ----
children.push(H("8. วิธีทดสอบซ้ำใน Supabase (เก็บภาพหน้าจอเอง)", HeadingLevel.HEADING_2));
children.push(P("1. เปิด Supabase → SQL Editor ของโปรเจกต์", { after: 40 }));
children.push(P("2. เปิดไฟล์ test-function.sql คัดลอกทั้งไฟล์วางแล้วกด Run", { after: 40 }));
children.push(P("3. สคริปต์จะสร้างฟังก์ชัน แล้วรันทดสอบทีละข้อ (มี select คั่นให้เห็นผลแต่ละข้อ)", { after: 40 }));
children.push(P("4. แคปหน้าจอผลลัพธ์ในแต่ละข้อ", { after: 40 }));
children.push(P("หมายเหตุ: ถ้าต้องการเรียกจากแอป ให้ใช้ supabase.rpc('haversine_km', { lat1, lng1, lat2, lng2 })", { italics: true, color: "6B7688" }));

// ---- 9 ----
children.push(H("9. สรุป", HeadingLevel.HEADING_2));
children.push(bullet("กลุ่มเราเพิ่ม SQL Function จำนวน 3 ตัว (2 scalar + 1 table function) เขียนด้วยภาษา SQL"));
children.push(bullet("haversine_km() คำนวณระยะทางจริงได้ถูกต้อง ทดสอบให้ผล 0.107 / 0.383 / 4.965 km ตรงตามพิกัด"));
children.push(bullet("group_passenger_total() นับผู้โดยสารรวมของกลุ่มได้ถูกต้อง และคืน 0 เมื่อกลุ่มว่าง"));
children.push(bullet("find_candidate_groups() คืนกลุ่มที่ใกล้ที่สุดพร้อมคะแนน และกรองกลุ่มที่ไกลเกินระยะได้จริงตาม parameter"));

const doc = new Document({
  styles: { default: { document: { run: { font: FONT, size: 22, color: "1B2434" } } } },
  sections: [{
    properties: { page: { margin: { top: 1000, bottom: 1000, left: 1000, right: 1000 } } },
    children,
  }],
});

const buf = await Packer.toBuffer(doc);
writeFileSync(OUT, buf);
console.log("wrote " + OUT + " (" + buf.length + " bytes)");
