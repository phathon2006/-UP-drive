import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell,
  ImageRun, WidthType, ShadingType, AlignmentType, BorderStyle,
} from "docx";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO = process.argv[2] || join(__dirname, "out");
const OUT = process.argv[3] || join(REPO, "report.docx");

const data = JSON.parse(readFileSync(join(__dirname, "results.json"), "utf8"));
const triggerSql = readFileSync(join(REPO, "trigger.sql"), "utf8").trim();

const TH_MONTHS = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
const FONT = "Tahoma";
const MONO = "Consolas";
const pad = (n) => String(n).padStart(2, "0");
function fmtTs(v) {
  const d = new Date(v);
  if (isNaN(d.getTime())) return v;
  return `${d.getDate()} ${TH_MONTHS[d.getMonth()]} ${d.getFullYear() + 543} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}
const isTs = (k, v) => typeof v === "string" && /_at$/.test(k) && /^\d{4}-\d{2}-\d{2}T/.test(v);

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
    new TextRun({ text: ln, font: MONO, size: 17, color: "E6EDF3", break: i === 0 ? 0 : 1 })
  );
  return new Paragraph({
    shading: { type: ShadingType.SOLID, color: "1E2430", fill: "1E2430" },
    spacing: { before: 80, after: 140, line: 240 },
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
          if (isTs(c, v)) return cell(fmtTs(v), { mono: true, color: "166534", fill: "EAFAF0", bold: true });
          return cell(v, { mono: true });
        }),
      }))
    : [new TableRow({ children: [cell("(ไม่มีแถว)", { color: "6B7688" })] })];
  return [new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [header, ...rows] })];
}

const MAXW = 600, MAXH = 740;
function image(file, w, h, caption) {
  const scale = Math.min(MAXW / w, MAXH / h);
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
function stepBlock(s, extra) {
  if (!s) return [];
  const out = [
    new Paragraph({ spacing: { before: 140, after: 40 }, children: [new TextRun({ text: `ขั้นที่ ${s.no} — ${s.title}`, font: FONT, size: 21, bold: true, color: "2563EB" })] }),
    codeBlock(s.sql),
  ];
  if (s.error) {
    out.push(new Paragraph({
      shading: { type: ShadingType.SOLID, color: "FEF2F2", fill: "FEF2F2" },
      spacing: { after: 100 },
      children: [new TextRun({ text: "ERROR: " + s.error, font: MONO, size: 17, color: "991B1B", break: 0 })],
    }));
  }
  if (s.before) {
    out.push(P("ก่อนอัปเดต (updated_at เก่า 1 ชั่วโมง):", { size: 18, color: "6B7688" }));
    out.push(...resultTable(s.before));
  }
  out.push(...resultTable(s.result));
  if (extra) out.push(P(extra, { size: 19, color: "166534" }));
  out.push(new Paragraph({ spacing: { after: 40 } }));
  return out;
}

const children = [];

// cover
children.push(H("รายงาน Database Trigger — กลุ่ม UP Drive", HeadingLevel.HEADING_1));
children.push(P("ระบบแชร์ค่ารถสำหรับนักศึกษา มหาวิทยาลัยพะเยา (UP Drive)", { size: 24, color: "334155", after: 40 }));
children.push(P("ฐานข้อมูล: PostgreSQL ผ่าน Supabase", { size: 21, color: "6B7688", after: 20 }));
children.push(P("หัวข้อรายงาน: Trigger ของกลุ่ม (Database Trigger)", { size: 21, color: "6B7688", after: 20 }));
children.push(P("สมาชิกในกลุ่ม: _______________________", { size: 21, color: "6B7688", after: 120 }));
children.push(P("หมายเหตุ: รูปในรายงานนี้เป็นผลการรันจริงของสคริปต์ Trigger บน PostgreSQL 16 (จำลองด้วย PGlite/WASM) ด้วย SQL ชุดเดียวกับที่ใช้บน Supabase", { size: 18, italics: true, color: "92400E" }));
children.push(...image("01-overview.png", 960, 717, "ภาพที่ 1 — ภาพรวมรายงาน"));

// 1
children.push(H("1. Trigger คืออะไร", HeadingLevel.HEADING_2));
children.push(P("Trigger (ทริกเกอร์) คือชุดคำสั่งที่ฐานข้อมูลเรียกให้ทำงานอัตโนมัติ เมื่อเกิดเหตุการณ์กับตาราง ได้แก่ INSERT, UPDATE หรือ DELETE โดยไม่ต้องมีคำสั่งจากฝั่งแอปพลิเคชันเลย"));
children.push(P("ใน PostgreSQL (และ Supabase) Trigger ประกอบด้วย 2 ส่วนที่ทำงานคู่กัน:"));
children.push(new Table({
  width: { size: 100, type: WidthType.PERCENTAGE },
  rows: [
    new TableRow({ tableHeader: true, children: [cell("ส่วน", { bold: true, fill: "EEF2F7" }), cell("หน้าที่", { bold: true, fill: "EEF2F7" })] }),
    new TableRow({ children: [cell("Trigger Function"), cell("ฟังก์ชันภาษา PL/pgSQL ที่ทำงานจริง เข้าถึงแถวก่อนแก้ (OLD) และแถวหลังแก้ (NEW) แล้ว RETURN NEW")] }),
    new TableRow({ children: [cell("CREATE TRIGGER"), cell("ผูกฟังก์ชันเข้ากับตาราง ระบุ timing ว่า BEFORE (ก่อนบันทึก) หรือ AFTER (หลังบันทึก) และผูกกับ event ใด")] }),
  ],
}));
children.push(P("Timing ที่สำคัญ", { bold: true, before: 140 }));
children.push(bullet("BEFORE — แก้ค่าใน NEW ก่อนบันทึก (ใช้เติมเวลา/ตรวจกติกา) หรือ RAISE EXCEPTION เพื่อยกเลิกคำสั่ง"));
children.push(bullet("AFTER — ทำงานหลังจากบันทึกแล้ว (ใช้ log หรืออัปเดตตารางอื่น)"));
children.push(bullet("FOR EACH ROW — ทำงานทุกแถวที่ถูกแก้"));

// 2
children.push(H("2. เหตุผลที่กลุ่มเลือกใช้ Trigger", HeadingLevel.HEADING_2));
children.push(P("ระบบ UP Drive เดิมตั้งค่าเวลาและตรวจกติกาจากโค้ดฝั่งเซิร์ฟเวอร์ (Node.js):"));
children.push(bullet("ตอนยืนยันสมาชิกครบ โค้ดฝั่งเซิร์ฟเวอร์เป็นคนสั่ง UPDATE ... SET confirmed_at = now() เอง"));
children.push(bullet("ตอนคนขับรับงาน/เดินทางเสร็จ ก็เป็นโค้ดฝั่งแอปที่ตั้งเวลา accepted_at / completed_at"));
children.push(bullet("ไม่มีอะไรกันการตั้งสถานะ accepted ให้กลุ่มที่ยังไม่มีคนขับ"));
children.push(P("ปัญหา: ถ้ามีการแก้ข้อมูลผ่านช่องทางอื่น (Supabase SQL Editor, Table Editor หรือ API ตรง) กติกาจะถูกข้ามได้ เพราะตรรกะอยู่ที่ตัวแอป ไม่ได้อยู่ที่ฐานข้อมูล", { color: "334155" }));
children.push(P("แนวทางของกลุ่ม: ย้ายกติกาสำคัญเข้าไปอยู่ที่ฐานข้อมูลด้วย Trigger 3 ตัว เพื่อให้ข้อมูลถูกต้องเสมอไม่ว่าจะแก้จากทางไหน"));

// 3
children.push(H("3. Trigger ทั้ง 3 ตัวของกลุ่ม", HeadingLevel.HEADING_2));
children.push(new Table({
  width: { size: 100, type: WidthType.PERCENTAGE },
  rows: [
    new TableRow({ tableHeader: true, children: [cell("#", { bold: true, fill: "EEF2F7" }), cell("ชื่อ Trigger", { bold: true, fill: "EEF2F7" }), cell("ตาราง", { bold: true, fill: "EEF2F7" }), cell("Timing", { bold: true, fill: "EEF2F7" }), cell("หน้าที่", { bold: true, fill: "EEF2F7" })] }),
    new TableRow({ children: [cell("1"), cell("trg_ride_groups_status_timestamps", { mono: true }), cell("ride_groups", { mono: true }), cell("BEFORE UPDATE", { mono: true }), cell("เติม confirmed_at / accepted_at / completed_at อัตโนมัติเมื่อสถานะเปลี่ยน")] }),
    new TableRow({ children: [cell("2"), cell("trg_ride_groups_driver_rules", { mono: true }), cell("ride_groups", { mono: true }), cell("BEFORE UPDATE", { mono: true }), cell("บล็อก (RAISE EXCEPTION) ถ้าตั้ง accepted แต่ยังไม่มีคนขับ")] }),
    new TableRow({ children: [cell("3"), cell("trg_driver_locations_touch", { mono: true }), cell("driver_locations", { mono: true }), cell("BEFORE UPDATE", { mono: true }), cell("อัปเดต updated_at เป็นเวลาปัจจุบันทุกครั้งที่พิกัดเปลี่ยน")] }),
  ],
}));
children.push(P("โค้ด Trigger ทั้งหมด (ไฟล์ trigger.sql)", { bold: true, before: 140 }));
children.push(codeBlock(triggerSql));
children.push(P("จุดออกแบบที่สำคัญ", { bold: true, before: 140 }));
children.push(bullet("ใช้ is distinct from เพื่อทำงานเฉพาะตอนสถานะเปลี่ยนจริง ไม่ทำงานตอนแก้ฟิลด์อื่น"));
children.push(bullet("ใช้เงื่อนไข ... is null เพื่อไม่เขียนทับเวลาเดิม (idempotent) กดซ้ำก็ได้ค่าเดิม"));
children.push(bullet("เป็น BEFORE UPDATE จึงแก้ค่า NEW ได้โดยตรงก่อนข้อมูลถูกบันทึก"));

// 4
children.push(H("4. ผลการทดสอบ", HeadingLevel.HEADING_2));
children.push(P("4.1 การตั้งเวลาอัตโนมัติ (Trigger 1)", { bold: true, size: 23 }));
children.push(P("ทดสอบเปลี่ยนสถานะกลุ่มตามลำดับ forming → sent_to_driver → accepted → completed แล้วดูว่าเวลาถูกเติมเองหรือไม่"));
children.push(...stepBlock(stepByNo(1)));
children.push(...stepBlock(stepByNo(2)));
children.push(...stepBlock(stepByNo(3)));
children.push(...stepBlock(stepByNo(4)));
children.push(...stepBlock(stepByNo(5), stepByNo(5) && stepByNo(5).unchanged ? "ผลลัพธ์: ค่าเวลาเดิมทั้ง 3 ช่องไม่ถูกเขียนทับ (timestamps unchanged = true)" : ""));
children.push(...image("03-status-timestamps.png", 960, 1423, "ภาพที่ 2 — ลำดับการเปลี่ยนสถานะ และเวลาที่ Trigger เติมให้"));

children.push(P("4.2 Trigger บังคับกติกาความถูกต้อง (Trigger 2)", { bold: true, size: 23, before: 200 }));
children.push(P("เมื่อพยายามตั้งสถานะเป็น accepted ให้กลุ่มที่ยังไม่มีคนขับ ฐานข้อมูลปฏิเสธคำสั่งทันที ข้อมูลไม่ถูกบันทึก (สถานะคงเป็น forming)"));
children.push(...stepBlock(stepByNo(6)));
children.push(...image("04-enforce-validation.png", 960, 614, "ภาพที่ 3 — Trigger ปฏิเสธข้อมูลที่ไม่ถูกต้อง"));

children.push(P("4.3 อัปเดตพิกัดคนขับ (Trigger 3)", { bold: true, size: 23, before: 200 }));
children.push(...stepBlock(stepByNo(7)));
children.push(...image("05-driver-location.png", 960, 607, "ภาพที่ 4 — Trigger อัปเดต updated_at อัตโนมัติ"));

children.push(P("4.4 รายการ Trigger ทั้งหมดในฐานข้อมูล", { bold: true, size: 23, before: 200 }));
children.push(...resultTable(data.triggers));
children.push(...image("06-trigger-list.png", 960, 386, "ภาพที่ 5 — ตารางแสดง Trigger ทั้งหมด"));

// 5
children.push(H("5. วิธีทดสอบซ้ำใน Supabase (เก็บภาพหน้าจอเอง)", HeadingLevel.HEADING_2));
children.push(P("1. เปิด Supabase → SQL Editor ของโปรเจกต์", { after: 40 }));
children.push(P("2. เปิดไฟล์ test-trigger.sql คัดลอกทั้งไฟล์วางแล้วกด Run", { after: 40 }));
children.push(P("3. สคริปต์จะสร้าง Trigger แล้วรันทดสอบทีละขั้น (มี select คั่นให้เห็นผลแต่ละขั้น)", { after: 40 }));
children.push(P("4. แคปหน้าจอผลลัพธ์ในแต่ละข้อ (ตารางผลลัพธ์ + ข้อความ ERROR ของข้อ 5)", { after: 40 }));
children.push(P("5. ตอนจบให้รันคำสั่ง delete ในข้อ 7 เพื่อลบข้อมูลทดสอบ", { after: 40 }));
children.push(P("หมายเหตุ: สคริปต์ทดสอบใช้ profile ที่มีอยู่จริงในระบบ ถ้าไม่มีให้รัน node scripts/seed.js ก่อน", { italics: true, color: "6B7688" }));
children.push(P("Trigger ทั้งชุดถูกใส่ไว้ใน schema จริงของโปรเจกต์แล้ว คือ supabase.sql และ supabase.test.sql หัวข้อ TRIGGERS", { before: 80 }));

// 6
children.push(H("6. สรุป", HeadingLevel.HEADING_2));
children.push(bullet("กลุ่มเราเพิ่ม Database Trigger จำนวน 3 ตัว ให้ตาราง ride_groups และ driver_locations"));
children.push(bullet("Trigger ช่วยให้ฐานข้อมูลเติมเวลาและบังคับกติกาเองอัตโนมัติ ลดการพึ่งพาโค้ดฝั่งเซิร์ฟเวอร์ และป้องกันข้อมูลผิดพลาดไม่ว่าจะแก้จากช่องทางใด"));
children.push(bullet("จากผลการทดสอบจริง: เวลาถูกเติมถูกต้องตามสถานะ, ค่าเดิมไม่ถูกเขียนทับ, ข้อมูลที่ผิดกติกาถูกบล็อกด้วย ERROR และ updated_at ของตำแหน่งคนขับอัปเดตเอง"));

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
