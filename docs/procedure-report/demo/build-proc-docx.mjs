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

const data = JSON.parse(readFileSync(join(__dirname, "results-proc.json"), "utf8"));
const procSql = readFileSync(join(REPO, "procedures.sql"), "utf8").trim();

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
    shading: { type: ShadingType.SOLID, color: "231E30", fill: "231E30" },
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
          if (typeof v === "boolean") return cell(v, { mono: true, bold: true, color: "B45309" });
          if (typeof v === "number") return cell(v, { mono: true, bold: true, color: "166534" });
          if (typeof v === "string" && /^[0-9a-f]{8}$/.test(v)) return cell(v + "…", { mono: true });
          return cell(v, { mono: true });
        }),
      }))
    : [new TableRow({ children: [cell("(ไม่มีแถว)", { color: "6B7688" })] })];
  return [new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [header, ...rows] })];
}

const MAXW = 662, MAXH = 800;
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
    new Paragraph({ spacing: { before: 140, after: 40 }, children: [new TextRun({ text: `ขั้นที่ ${s.no} — ${s.title}`, font: FONT, size: 21, bold: true, color: "6D28D9" })] }),
    codeBlock(s.sql),
  ];
  if (s.error) {
    out.push(new Paragraph({
      shading: { type: ShadingType.SOLID, color: "FEF2F2", fill: "FEF2F2" },
      spacing: { after: 100 },
      children: [new TextRun({ text: "ERROR: " + s.error, font: MONO, size: 17, color: "991B1B" })],
    }));
  } else {
    out.push(...resultTable(s.result));
    if (s.result2) {
      out.push(P("และตาราง event log:", { size: 18, color: "6B7688" }));
      out.push(...resultTable(s.result2));
    }
  }
  if (s.note) out.push(P(s.note, { size: 19, color: "5B21B6" }));
  out.push(new Paragraph({ spacing: { after: 40 } }));
  return out;
}

const children = [];

// ---- cover ----
children.push(H("รายงาน Stored Procedure — กลุ่ม UP Drive", HeadingLevel.HEADING_1));
children.push(P("ระบบแชร์ค่ารถสำหรับนักศึกษา มหาวิทยาลัยพะเยา (UP Drive)", { size: 24, color: "334155", after: 40 }));
children.push(P("ฐานข้อมูล: PostgreSQL ผ่าน Supabase", { size: 21, color: "6B7688", after: 20 }));
children.push(P("หัวข้อรายงาน: Stored Procedure ของกลุ่ม", { size: 21, color: "6B7688", after: 20 }));
children.push(P("สมาชิกในกลุ่ม: _______________________", { size: 21, color: "6B7688", after: 120 }));
children.push(P("หมายเหตุ: รูปในรายงานนี้เป็นผลการ CALL procedure จริงบน PostgreSQL 16 (จำลองด้วย PGlite/WASM) ด้วย SQL ชุดเดียวกับที่ใช้บน Supabase", { size: 18, italics: true, color: "92400E" }));
children.push(...image("01-overview.png", 960, 821, "ภาพที่ 1 — ภาพรวมรายงาน"));

// ---- 1 ----
children.push(H("1. Stored Procedure คืออะไร", HeadingLevel.HEADING_2));
children.push(P("Stored Procedure (โปรแกรมเก็บไว้ในฐานข้อมูล) คือชุดคำสั่งที่เก็บไว้ในฐานข้อมูล ตั้งชื่อไว้ แล้วเรียกใช้ด้วยคำสั่ง CALL ต่างจาก SQL Function ตรงที่ procedure ไม่คืนค่าเป็นผลลัพธ์ของคำสั่ง แต่ทำงานเป็นชุด (หลายคำสั่ง) และส่งค่ากลับทาง parameter ได้"));

// ---- 2 ----
children.push(H("2. ข้อแตกต่างจาก SQL Function", HeadingLevel.HEADING_2));
children.push(new Table({
  width: { size: 100, type: WidthType.PERCENTAGE },
  rows: [
    new TableRow({ tableHeader: true, children: [cell("หัวข้อ", { bold: true, fill: "EEF2F7" }), cell("Stored Procedure", { bold: true, fill: "EEF2F7" }), cell("Function", { bold: true, fill: "EEF2F7" })] }),
    new TableRow({ children: [cell("การเรียกใช้"), cell("CALL proc(...)", { mono: true }), cell("อยู่ใน select / นิพจน์", { mono: true })] }),
    new TableRow({ children: [cell("ค่าที่คืน"), cell("ไม่คืนผ่าน select — คืนทาง INOUT/OUT"), cell("คืนค่าเดี่ยวหรือตาราง")] }),
    new TableRow({ children: [cell("การทำงาน"), cell("หลายคำสั่ง + จัดการ transaction ได้"), cell("มักเป็นคำสั่งเดียว/อ่านค่า")] }),
    new TableRow({ children: [cell("เหมาะกับ"), cell("งานที่เปลี่ยนข้อมูลหลายขั้นตอน (business action)"), cell("การคำนวณ/คิวรีที่เรียกซ้ำ")] }),
  ],
}));

// ---- 3 ----
children.push(H("3. เหตุผลที่กลุ่มเลือกเขียน Procedure", HeadingLevel.HEADING_2));
children.push(P("งานอย่าง \"คนขับรับงาน\" หรือ \"ยกเลิกกลุ่ม\" ต้องทำหลายขั้นตอนติดกัน (ตรวจเงื่อนไข + อัปเดตสถานะ + บันทึก log) เดิมโค้ดฝั่งเซิร์ฟเวอร์ต้องยิงหลายคิวรีและเสี่ยงที่ข้อมูลจะไม่ตรงกัน กลุ่มเราจึงย้ายมาเป็น Stored Procedure ให้ทำทั้งชุดในคำสั่งเดียวที่ฐานข้อมูล รับประกันความถูกต้องของข้อมูล"));

// ---- 4 ----
children.push(H("4. Stored Procedure ทั้ง 3 ตัวของกลุ่ม", HeadingLevel.HEADING_2));
children.push(new Table({
  width: { size: 100, type: WidthType.PERCENTAGE },
  rows: [
    new TableRow({ tableHeader: true, children: [cell("#", { bold: true, fill: "EEF2F7" }), cell("ชื่อ Procedure", { bold: true, fill: "EEF2F7" }), cell("หน้าที่", { bold: true, fill: "EEF2F7" })] }),
    new TableRow({ children: [cell("1"), cell("sp_accept_ride_group(group_id, driver_id)", { mono: true }), cell("คนขับรับงาน: ตรวจเงื่อนไข -> มอบหมายคนขับ -> ตั้งสถานะ accepted -> บันทึก event")] }),
    new TableRow({ children: [cell("2"), cell("sp_cancel_ride_group(group_id, actor_id, reason)", { mono: true }), cell("ยกเลิกกลุ่ม: ตั้งสถานะ cancelled -> คืนคนขับ -> บันทึก event")] }),
    new TableRow({ children: [cell("3"), cell("sp_expire_stale_groups(older_than)", { mono: true }), cell("งานประจำ: ปิดกลุ่มที่รวมคนเกินเวลาที่กำหนด แล้วบันทึก event")] }),
  ],
}));
children.push(P("โค้ด Stored Procedure ทั้งหมด (ไฟล์ procedures.sql)", { bold: true, before: 140 }));
children.push(codeBlock(procSql));
children.push(...image("02-code-1.png", 900, 1734, "ภาพที่ 2 — โค้ดส่วนที่ 1 (ตาราง event log และ procedure 1)", 800));
children.push(...image("02-code-2.png", 900, 1754, "ภาพที่ 3 — โค้ดส่วนที่ 2 (procedure 2 และ 3)", 800));

// ---- 6 ----
children.push(H("6. ผลการทดสอบ — คนขับรับงาน (Procedure 1)", HeadingLevel.HEADING_2));
children.push(...stepBlock(stepByNo(2)));
children.push(...stepBlock(stepByNo(3)));
children.push(...image("03a-accept.png", 960, 896, "ภาพที่ 4 — CALL sp_accept_ride_group() แล้วข้อมูลถูกต้อง"));
children.push(P("6.1 การตรวจเงื่อนไข (guard)", { bold: true, size: 23, before: 200 }));
children.push(P("procedure จะปฏิเสธคำสั่งที่ไม่ผ่านเงื่อนไข เช่น รับงานซ้ำ หรือให้ผู้โดยสารรับงานแทนคนขับ"));
children.push(...stepBlock(stepByNo(4)));
children.push(...stepBlock(stepByNo(5)));
children.push(...image("03b-guard.png", 960, 716, "ภาพที่ 5 — procedure ปฏิเสธคำสั่งที่ไม่ผ่านเงื่อนไข"));

// ---- 7 ----
children.push(H("7. ผลการทดสอบ — ยกเลิกกลุ่ม (Procedure 2)", HeadingLevel.HEADING_2));
children.push(...stepBlock(stepByNo(6)));
children.push(...stepBlock(stepByNo(7)));
children.push(...image("04a-cancel.png", 960, 863, "ภาพที่ 6 — CALL sp_cancel_ride_group()"));
children.push(P("7.1 งานประจำปิดกลุ่มที่ค้าง (Procedure 3)", { bold: true, size: 23, before: 200 }));
children.push(...stepBlock(stepByNo(8)));
children.push(...stepBlock(stepByNo(9)));
children.push(...image("04b-expire.png", 960, 756, "ภาพที่ 7 — CALL sp_expire_stale_groups()"));
children.push(P("7.2 ตรวจสอบ event log", { bold: true, size: 23, before: 200 }));
children.push(...stepBlock(stepByNo(10)));
children.push(...image("04c-events.png", 960, 654, "ภาพที่ 8 — สถานะสุดท้ายและ event log ทั้งหมด"));

// ---- 8 ----
children.push(H("8. รายการ Stored Procedure ทั้งหมดในฐานข้อมูล", HeadingLevel.HEADING_2));
children.push(P("ตรวจสอบจากตารางระบบ pg_proc โดยเลือกเฉพาะ prokind = 'p' (procedure)"));
children.push(...resultTable(data.procedures));
children.push(...image("05-list.png", 960, 454, "ภาพที่ 9 — ตารางแสดง Stored Procedure ทั้งหมด"));

// ---- 9 ----
children.push(H("9. วิธีทดสอบซ้ำใน Supabase (เก็บภาพหน้าจอเอง)", HeadingLevel.HEADING_2));
children.push(P("1. เปิด Supabase → SQL Editor ของโปรเจกต์", { after: 40 }));
children.push(P("2. เปิดไฟล์ test-procedure.sql คัดลอกทั้งไฟล์วางแล้วกด Run", { after: 40 }));
children.push(P("3. สคริปต์จะสร้าง procedure แล้วรันทดสอบทีละขั้น (มี select คั่นให้เห็นผลแต่ละขั้น)", { after: 40 }));
children.push(P("4. แคปหน้าจอผลลัพธ์ในแต่ละขั้น (รวมข้อความ ERROR ของขั้นที่ถูกปฏิเสธ)", { after: 40 }));
children.push(P("หมายเหตุ: เรียกจากแอปได้ด้วย supabase.rpc('sp_accept_ride_group', { p_group_id, p_driver_id })", { italics: true, color: "6B7688" }));

// ---- 10 ----
children.push(H("10. สรุป", HeadingLevel.HEADING_2));
children.push(bullet("กลุ่มเราเพิ่ม Stored Procedure จำนวน 3 ตัว เรียกใช้ด้วยคำสั่ง CALL"));
children.push(bullet("ทดสอบแล้ว procedure ทำงานหลายขั้นตอนในคำสั่งเดียวได้จริง พร้อมบันทึก event log อัตโนมัติ"));
children.push(bullet("การตรวจเงื่อนไขทำงานถูกต้อง: รับงานซ้ำถูกปฏิเสธ, ผู้โดยสารรับงานแทนคนขับถูกปฏิเสธ"));
children.push(bullet("งานประจำ sp_expire_stale_groups() ปิดกลุ่มที่ค้างเกินเวลาได้ถูกต้อง และคืนจำนวนผ่าน INOUT"));

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
