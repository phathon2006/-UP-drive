import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell,
  WidthType, ShadingType, AlignmentType,
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
    spacing: { after: opts.after ?? 80, before: opts.before ?? 0, line: 288 },
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
function lead(text) {
  return new Paragraph({
    spacing: { before: 160, after: 60, line: 288 },
    children: [new TextRun({ text, font: FONT, size: 22, bold: true, color: "334155" })],
  });
}
function bullet(text, level = 0) {
  return new Paragraph({
    bullet: { level },
    spacing: { after: 60, line: 288 },
    children: [new TextRun({ text, font: FONT, size: 22 })],
  });
}
function bulletRich(runs, level = 0) {
  return new Paragraph({
    bullet: { level },
    spacing: { after: 60, line: 288 },
    children: runs.map((r) => new TextRun({ text: r.t, font: r.mono ? MONO : FONT, size: 22, bold: r.bold, color: r.color })),
  });
}
function cellPara(text, opts = {}) {
  return new Paragraph({
    spacing: { after: 20, line: 260 },
    children: [new TextRun({ text: String(text), font: opts.mono ? MONO : FONT, size: 18, color: opts.color, bold: opts.bold, italics: opts.italics })],
  });
}
function cell(text, opts = {}) {
  return new TableCell({
    shading: opts.fill ? { type: ShadingType.SOLID, color: opts.fill, fill: opts.fill } : undefined,
    margins: { top: 40, bottom: 40, left: 90, right: 90 },
    children: [cellPara(text, opts)],
  });
}
function table(columns, rows) {
  const header = new TableRow({ tableHeader: true, children: columns.map((c) => cell(c, { bold: true, fill: "EEF2F7", color: "334155" })) });
  const body = rows.map((row) => new TableRow({
    children: row.map((c) => (c && typeof c === "object") ? cell(c.t, { mono: c.mono, bold: c.bold, color: c.color }) : cell(c)),
  }));
  return new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [header, ...body] });
}

const children = [];

/* ---------------- HEADER ---------------- */
children.push(H("ข้อกำหนดขอบเขตของงาน (Terms of Reference : TOR)", HeadingLevel.HEADING_1));
children.push(P("", { after: 20 }));
children.push(P("โครงการ: ระบบ UP Drive — แอปพลิเคชันแชร์ค่าเดินทางสำหรับนักศึกษา มหาวิทยาลัยพะเยา", { size: 23, color: "334155", after: 60 }));
children.push(P("ผู้ทำงาน: ______________________________ รหัสนิสิต ______________________", { size: 21, color: "6B7688", after: 20 }));
children.push(P("____________________ ______________________________ รหัสนิสิต ______________________", { size: 21, color: "6B7688", after: 140 }));

/* ---------------- 1 ---------------- */
children.push(H("1. ความเป็นมา", HeadingLevel.HEADING_2));
children.push(P("ปัจจุบันนักศึกษามหาวิทยาลัยพะเยาส่วนใหญ่เดินทางระหว่างที่พัก (ในตัวเมืองพะเยาและชุมชนรอบมหาวิทยาลัย) กับมหาวิทยาลัยด้วยรถยนต์ส่วนตัวหรือรถจักรยานยนต์ โดยมักเดินทางเพียงคนเดียวในแต่ละเที่ยว ส่งผลให้สิ้นเปลืองค่าเชื้อเพลิงและค่าใช้จ่ายในการเดินทางเป็นรายวัน อีกทั้งยังเพิ่มปริมาณรถบนท้องถนนและบริเวณทางเข้ามหาวิทยาลัย แม้ว่านักศึกษาหลายคนจะมีเส้นทางและช่วงเวลาเดินทางที่ใกล้เคียงกันก็ตาม", { after: 100 }));
children.push(P("ที่ผ่านมาการรวมกลุ่มเดินทางอาศัยการสื่อสารผ่านกลุ่มแชตหรือโซเชียลมีเดีย ซึ่งไม่มีระบบจัดการข้อมูล ไม่สามารถจับคู่เส้นทางที่ใกล้เคียงกันได้อย่างมีประสิทธิภาพ ไม่มีข้อมูลยืนยันตัวตนของผู้ร่วมเดินทาง และไม่มีการติดตามสถานะหรือตำแหน่งการเดินทางที่ชัดเจน ทำให้การรวมกลุ่มทำได้ยากและขาดความน่าเชื่อถือ", { after: 100 }));
children.push(P("ด้วยเหตุผลดังกล่าว จึงมีความจำเป็นต้องพัฒนาแอปพลิเคชัน “UP Drive” ซึ่งเป็นระบบแชร์ค่าเดินทาง (Carpooling) บนเว็บแอปพลิเคชัน ที่ช่วยให้นักศึกษาประกาศเส้นทางความต้องการเดินทาง จับคู่ผู้ที่ไปทางเดียวกันเป็นกลุ่ม มอบหมายให้คนขับรับงาน และติดตามตำแหน่งแบบเรียลไทม์ เพื่อลดค่าใช้จ่ายในการเดินทาง ลดปริมาณรถ และเพิ่มความสะดวกและความปลอดภัยในการเดินทางร่วมกัน", { after: 100 }));

/* ---------------- 2 ---------------- */
children.push(H("2. ขอบเขตการดำเนินงาน (Scope of Work)", HeadingLevel.HEADING_2));
children.push(P("ผู้ทำงานจะต้องดำเนินการพัฒนาแอปพลิเคชันและระบบที่เกี่ยวข้อง โดยมีรายละเอียดดังนี้:", { after: 100 }));

children.push(H3("2.1 แพลตฟอร์มที่รองรับ"));
children.push(P("Web-application รองรับเว็บเบราว์เซอร์มาตรฐาน (Chrome, Edge, Safari, Firefox) และออกแบบหน้าจอให้แสดงผลได้ดีบนอุปกรณ์มือถือ (Responsive) โดยทำงานร่วมกับฐานข้อมูล PostgreSQL บน Supabase และติดตั้งบนผู้ให้บริการคลาวด์ (Deploy ออนไลน์จริง)", { after: 100 }));

children.push(H3("2.2 คุณลักษณะและฟังก์ชันการทำงานหลัก (Core Features)"));

children.push(lead("(1) ระบบยืนยันตัวตนและการจัดการบัญชี (Authentication & User Profile)"));
children.push(bullet("การลงทะเบียนและเข้าสู่ระบบด้วยอีเมลและรหัสผ่าน (Email/Password)"));
children.push(bullet("การจัดการข้อมูลส่วนตัว (ชื่อ เบอร์โทรศัพท์ และข้อมูลยานพาหนะ) และการเปลี่ยนรหัสผ่าน"));
children.push(bullet("ระบบกำหนดสิทธิ์การใช้งานตามบทบาท (Role-Based Access Control) แยกผู้ใช้ออกเป็นผู้โดยสาร (passenger) และคนขับ (driver)"));
children.push(bullet("การควบคุมความปลอดภัยระดับแถว (Row Level Security) ให้ผู้ใช้เข้าถึงเฉพาะข้อมูลที่เกี่ยวข้องกับตนเอง"));

children.push(lead("(2) ระบบการทำงานหลักของแอปพลิเคชัน (Main Modules)"));
children.push(bulletRich([{ t: "ระบบประกาศและค้นหาคำขอเดินทาง", bold: true }, { t: " — ผู้โดยสารระบุต้นทาง–ปลายทาง พิกัดบนแผนที่ (GPS) และจำนวนผู้ร่วมเดินทาง" }]));
children.push(bulletRich([{ t: "ระบบจับคู่กลุ่มอัตโนมัติ", bold: true }, { t: " — จับคู่ผู้โดยสารที่ไปทางเดียวกันเป็นกลุ่ม โดยคำนวณระยะทางและจัดอันดับกลุ่มที่ใกล้ที่สุด" }]));
children.push(bulletRich([{ t: "ระบบมอบหมายงานให้คนขับ", bold: true }, { t: " — คนขับดูกลุ่มที่รอรับงานและกดรับงาน พร้อมอัปเดตสถานะกลุ่มตลอดวงจร (forming → sent_to_driver → accepted → completed / cancelled)" }]));
children.push(bulletRich([{ t: "ระบบติดตามตำแหน่งแบบ Realtime", bold: true }, { t: " — แสดงตำแหน่งคนขับบนแผนที่แบบเรียลไทม์ พร้อมเส้นทางและระยะทางของกลุ่ม" }]));
children.push(bulletRich([{ t: "ระบบประวัติการเดินทาง", bold: true }, { t: " — แสดงรายการและสถานะการเดินทางที่ผ่านมาของผู้ใช้" }]));

children.push(lead("(3) ระบบการแจ้งเตือน (Notifications)"));
children.push(bullet("การแจ้งเตือนในแอป (In-app Notifications) เมื่อกลุ่มถูกจับคู่ มีคนขับรับงาน หรือสถานะการเดินทางเปลี่ยน โดยอัปเดตแบบเรียลไทม์ผ่าน Supabase Realtime"));
children.push(bullet("การแจ้งเตือนบนอุปกรณ์ (Push Notifications) สำหรับเหตุการณ์สำคัญ เช่น เมื่อคนขับรับงานหรือใกล้ถึงจุดรับ"));

children.push(lead("(4) ระบบจัดการหลังบ้าน (Admin Web Management)"));
children.push(bullet("ระบบดูภาพรวมและสถิติ (Dashboard & Analytics) — จำนวนกลุ่ม/เที่ยวการเดินทาง อัตราการจับคู่สำเร็จ และสถิติการใช้งาน"));
children.push(bullet("ระบบจัดการข้อมูลผู้ใช้งานและเนื้อหา (Content / User Management)"));
children.push(bullet("ระบบออกรายงาน (Export ข้อมูลเป็น Excel / PDF)"));

const doc = new Document({
  styles: { default: { document: { run: { font: FONT, size: 22 } } } },
  sections: [{ children }],
});

const buf = await Packer.toBuffer(doc);
writeFileSync(OUT, buf);
console.log("wrote " + OUT + " (" + buf.length + " bytes)");
