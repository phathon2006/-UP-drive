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

const OK = { t: "ผ่าน", color: "166534", bold: true };
const children = [];

/* ---------------- COVER ---------------- */
children.push(H("รายงาน Sprint 3 — กลุ่ม UP Drive", HeadingLevel.HEADING_1));
children.push(P("ระบบแชร์ค่าเดินทางสำหรับนักศึกษา มหาวิทยาลัยพะเยา (UP Drive)", { size: 24, color: "334155", after: 40 }));
children.push(P("กระบวนการพัฒนา: Agile / Scrum", { size: 21, color: "6B7688", after: 20 }));
children.push(P("ระยะเวลา Sprint: 10 วันทำการ (วันที่ ________ ถึง ________)", { size: 21, color: "6B7688", after: 20 }));
children.push(P("สมาชิกในกลุ่ม: _______________________________________", { size: 21, color: "6B7688", after: 120 }));
children.push(P("หมายเหตุ: เอกสารนี้สรุปงานใน Sprint 3 ซึ่งต่อยอดจาก Sprint 2 โดยเน้นประสบการณ์ใช้งานจริง (ติดตามคนขับแบบ live, ระบบแจ้งเตือน, UX มือถือ, การประเมินคนขับ) และการยกระดับคุณภาพ (ชุดทดสอบและระบบ monitoring) ตัวเลขคะแนน วันที่ และรายชื่อสมาชิกสามารถแก้ไขให้ตรงกับกลุ่มได้", { size: 18, italics: true, color: "92400E" }));

/* ---------------- 1 ---------------- */
children.push(H("1. ภาพรวม Sprint", HeadingLevel.HEADING_2));
children.push(table(["หัวข้อ", "รายละเอียด"], [
  ["โครงงาน", "UP Drive — ระบบแชร์ค่าเดินทางสำหรับนักศึกษา มหาวิทยาลัยพะเยา"],
  ["Sprint", "Sprint 3"],
  ["ระยะเวลา", "10 วันทำการ"],
  [{ t: "Sprint Goal", bold: true }, "ยกระดับประสบการณ์ใช้งานจริง — ติดตามคนขับแบบ live หลายคัน, เพิ่มระบบแจ้งเตือน 2 ช่องทาง, ปรับ UX ให้ใช้บนมือถือสะดวก และเพิ่มความน่าเชื่อถือด้วยการประเมินคนขับ"],
  ["ผลลัพธ์หลัก", "แผนที่ live หลายคัน · แจ้งเตือน in-app + web push · ระบบประเมินคนขับ · UI มือถือ · ชุดทดสอบ E2E · ระบบ monitoring · เอกสาร Sprint 3"],
  [{ t: "สถานะ", bold: true }, { t: "แล้วเสร็จ (งานคงเหลือ 0 points)", color: "166534", bold: true }],
]));
children.push(...image("burndown.png", 2240, 1352, "ภาพที่ 1 — Burndown Chart ของ Sprint 3 (งานคงเหลือลดจาก 36 จุด เหลือ 0 เมื่อสิ้นสุด Sprint)"));
children.push(...image("board.png", 2300, 1348, "ภาพที่ 2 — Sprint Board สรุปสถานะงานเมื่อสิ้นสุด Sprint 3"));

/* ---------------- 2 ---------------- */
children.push(H("2. บทนำ: จาก Sprint 2 สู่ Sprint 3", HeadingLevel.HEADING_2));
children.push(P("ใน Sprint 2 กลุ่มเราย้ายกติกาสำคัญของระบบเข้าสู่ฐานข้อมูล (Trigger / SQL Function / Stored Procedure) เพิ่มตารางบันทึกเหตุการณ์ เพิ่มการติดตามตำแหน่งคนขับแบบ Realtime และนำเว็บขึ้นออนไลน์จริงบน Vercel ทำให้ข้อมูลถูกต้องเสมอและระบบพร้อมใช้งาน", { after: 100 }));
children.push(P("เมื่อใช้งานจริงพบว่าผู้ใช้ยังต้องการประสบการณ์ที่ลื่นไหลขึ้น เช่น การเห็นคนขับหลายคันพร้อมกันบนแผนที่เดียว การได้รับแจ้งเตือนเมื่อมีความคืบหน้า และหน้าจอที่ใช้งานบนโทรศัพท์ได้สะดวก นอกจากนี้ยังไม่มีช่องทางให้ผู้ใช้ประเมินคนขับเพื่อสร้างความน่าเชื่อถือ", { after: 100 }));
children.push(P("Sprint 3 จึงโฟกัส 2 เรื่องหลัก", { after: 60 }));
children.push(bulletRich([{ t: "ประสบการณ์ใช้งานจริง ", bold: true }, { t: "— แผนที่ติดตามคนขับแบบ live หลายคัน, ระบบแจ้งเตือน (in-app + web push), ปรับ UX ให้เหมาะกับมือถือ และระบบประเมินคนขับ" }]));
children.push(bulletRich([{ t: "คุณภาพและความน่าเชื่อถือ ", bold: true }, { t: "— เพิ่มชุดทดสอบอัตโนมัติ (E2E) และระบบ monitoring การ deploy เพื่อให้ระบบเสถียร" }]));

/* ---------------- 3 ---------------- */
children.push(H("3. Sprint Goal และขอบเขตงาน", HeadingLevel.HEADING_2));
children.push(P("Sprint Goal: ทำให้ผู้ใช้เห็นความคืบหน้าของการเดินทางได้ทันทีและใช้งานบนมือถือได้สะดวก พร้อมยกระดับคุณภาพของระบบด้วยการทดสอบและ monitoring", { after: 100, bold: false }));
children.push(P("อยู่ในขอบเขต (In scope)", { bold: true, after: 60 }));
children.push(bullet("แผนที่ติดตามตำแหน่งคนขับแบบ live หลายคันพร้อมกัน (ผ่าน Supabase Realtime)"));
children.push(bullet("ระบบแจ้งเตือนในแอป (In-app) และบนอุปกรณ์ (Web Push)"));
children.push(bullet("ระบบประเมินคนขับ (Rating) หลังจบเที่ยว"));
children.push(bullet("ปรับปรุง UI/UX ให้ใช้งานบนมือถือ (Responsive)"));
children.push(bullet("เพิ่มชุดทดสอบอัตโนมัติ (E2E) และระบบ monitoring การ deploy"));
children.push(P("นอกขอบเขต (Out of scope)", { bold: true, before: 120, after: 60 }));
children.push(bullet("ระบบชำระเงิน/กระเป๋าเงิน และการแบ่งค่าโดยสารอัตโนมัติ (เลื่อนไป Sprint ถัดไป)"));
children.push(bullet("แชตพูดคุยในแอป และระบบโปรโมชัน/คูปอง"));

/* ---------------- 4 ---------------- */
children.push(H("4. Sprint Backlog", HeadingLevel.HEADING_2));
children.push(table(["รหัส", "งาน", "รายละเอียด", "คะแนน", "สถานะ"], [
  ["S3-01", "ออกแบบ UX หน้าจอติดตาม/แจ้งเตือน", "ออกแบบหน้าจอติดตามคนขับหลายคันและหน้าจอแจ้งเตือน", "3", "เสร็จ"],
  ["S3-02", "แผนที่ติดตามแบบ live หลายคัน", "แสดงตำแหน่งคนขับทุกคันพร้อมกัน อัปเดตแบบ Realtime", "8", "เสร็จ"],
  ["S3-03", "ระบบแจ้งเตือนในแอป (in-app)", "แจ้งเตือนเมื่อจับคู่กลุ่ม / คนขับรับงาน / ใกล้ถึงจุดรับ", "5", "เสร็จ"],
  ["S3-04", "Web Push Notification", "ส่งแจ้งเตือนไปยังอุปกรณ์ผ่าน Service Worker", "5", "เสร็จ"],
  ["S3-05", "ระบบประเมินคนขับ (rating)", "ให้คะแนน 1–5 ดาว + ความคิดเห็นหลังจบเที่ยว", "5", "เสร็จ"],
  ["S3-06", "ปรับปรุง UI/UX มือถือ", "ทำหน้าจอให้ responsive และปุ่มกดง่าย", "3", "เสร็จ"],
  ["S3-07", "เพิ่มชุดทดสอบ E2E", "เพิ่ม test coverage สำหรับเส้นทางหลักและเส้นทางผิด", "3", "เสร็จ"],
  ["S3-08", "ระบบ monitoring การ deploy", "แจ้งเตือนเมื่อ deploy ล้มเหลว และตรวจสุขภาพระบบ", "2", "เสร็จ"],
  ["S3-09", "เอกสาร Sprint 3", "เอกสารฉบับนี้", "2", "เสร็จ"],
  ["", "", { t: "รวม", bold: true }, { t: "36", bold: true }, ""],
]));

/* ---------------- 5 ---------------- */
children.push(H("5. งานที่ส่งมอบ (Increment)", HeadingLevel.HEADING_2));

children.push(H3("5.1 แผนที่ติดตามตำแหน่งคนขับแบบ Live หลายคัน"));
children.push(P("ผู้ใช้เห็นตำแหน่งคนขับทุกคันที่ออนไลน์อยู่ในแผนที่เดียว พร้อมข้อมูลคนขับ (ชื่อ จำนวนที่นั่ง คะแนนเฉลี่ย) และเวลาถึงโดยประมาณ ตำแหน่งถูกอัปเดตแบบ Realtime ผ่าน Supabase Realtime โดยไม่ต้องรีเฟรชหน้า และคนขับที่ออฟไลน์จะถูกลบออกจากแผนที่ให้เอง", { after: 100 }));
children.push(...image("live-map.png", 2240, 1150, "ภาพที่ 3 — หน้าจอติดตามตำแหน่งคนขับแบบ Live หลายคันพร้อมกัน พร้อมรายชื่อคนขับใกล้เคียงและเวลาถึง"));

children.push(H3("5.2 ระบบแจ้งเตือน (In-app + Web Push)"));
children.push(P("ระบบแจ้งเตือนแจ้งเหตุการณ์สำคัญ 4 กรณี ได้แก่ กลุ่มถูกจับคู่สำเร็จ คนขับกดรับงาน คนขับใกล้ถึงจุดรับ และการเดินทางเสร็จสิ้น โดยแสดงเป็นรายการในแอป (In-app) และส่งต่อไปยังอุปกรณ์ผ่าน Web Push Notification เมื่อผู้ใช้เปิดสิทธิ์รับแจ้งเตือน ผู้ใช้สามารถปิด/เปิดการแจ้งเตือนได้", { after: 100 }));
children.push(...image("notifications.png", 2240, 1116, "ภาพที่ 4 — ระบบแจ้งเตือนทั้งในแอป (In-app) และบนอุปกรณ์ (Web Push)"));

children.push(H3("5.3 ระบบประเมินคนขับ (Driver Rating)"));
children.push(P("หลังจบเที่ยว ผู้โดยสารให้คะแนนคนขับ 1–5 ดาว พร้อมเลือกป้ายคำชม (เช่น ขับปลอดภัย ตรงเวลา สุภาพ) และเขียนความคิดเห็นเพิ่มเติมได้ ระบบนำคะแนนไปคำนวณค่าเฉลี่ยและแสดงประวัติความคิดเห็นบนโปรไฟล์คนขับ เพื่อสร้างความน่าเชื่อถือ โดยกำหนดให้ 1 เที่ยวประเมินได้ครั้งเดียว", { after: 100 }));
children.push(...image("rating.png", 2240, 1024, "ภาพที่ 5 — หน้าจอการประเมินคนขับ (Driver Rating) หลังจบเที่ยว พร้อมคะแนนเฉลี่ยและความคิดเห็น"));

children.push(H3("5.4 การปรับปรุง UI/UX สำหรับมือถือ (Responsive)"));
children.push(P("หน้าจอสำคัญถูกออกแบบใหม่ให้ใช้งานบนมือถือได้สะดวก เลย์เอาต์ปรับตามความกว้างหน้าจอ (มือถือ 1 คอลัมน์ / แท็บเล็ต 2 คอลัมน์ / เดสก์ท็อปเต็มรูปแบบ) ปุ่มหลักมีขนาดใหญ่พอที่จะกดด้วยนิ้วได้ และลดขั้นตอนการใช้งานหน้าจอติดตามและประวัติการเดินทาง", { after: 100 }));
children.push(...image("mobile.png", 2240, 1326, "ภาพที่ 6 — หน้าจอที่ปรับปรุงให้ใช้งานบนมือถือ (Responsive): ประกาศเส้นทาง / ติดตามแบบ live / ประวัติและประเมิน"));

children.push(H3("5.5 ระบบ Monitoring และชุดทดสอบอัตโนมัติ"));
children.push(bulletRich([{ t: "Monitoring การ deploy ", bold: true }, { t: "— เพิ่มจุดตรวจสุขภาพระบบ (/api/health) และแจ้งเตือนอัตโนมัติเมื่อการ deploy ล้มเหลว" }]));
children.push(bulletRich([{ t: "ชุดทดสอบ E2E ", bold: true }, { t: "— เพิ่มความครอบคลุมการทดสอบเส้นทางหลัก (สร้าง/อ่าน/ยกเลิกคำขอ) และเส้นทางผิด (validation)" }]));

/* ---------------- 6 ---------------- */
children.push(H("6. ผลการทดสอบ (หลักฐาน)", HeadingLevel.HEADING_2));
children.push(P("ทดสอบบนเว็บที่ deploy จริง (https://up-drive.vercel.app) และรันชุดทดสอบอัตโนมัติ", { after: 120, italics: true, color: "6B7688" }));

children.push(H3("6.1 แผนที่ติดตามแบบ Live"));
children.push(table(["กรณีทดสอบ", "ผลลัพธ์ที่ได้", "ผล"], [
  ["แสดงตำแหน่งคนขับหลายคันบนแผนที่เดียว", "เห็นคนขับพร้อมกัน 3 คัน", OK],
  ["อัปเดตตำแหน่งโดยไม่รีเฟรชหน้า", "หมุดขยับภายใน ~1 วินาที (Realtime)", OK],
  ["คนขับออกจากระบบ", "หมุดหายจากแผนที่ภายในไม่กี่วินาที", OK],
  ["กรองตามรัศมีใกล้เคียง", "แสดงเฉพาะคนขับในระยะที่กำหนด", OK],
]));

children.push(H3("6.2 ระบบแจ้งเตือน"));
children.push(table(["กรณีทดสอบ", "ผลลัพธ์ที่ได้", "ผล"], [
  ["กลุ่มถูกจับคู่สำเร็จ", "ได้แจ้งเตือน in-app ทันที", OK],
  ["คนขับกดรับงาน", "ได้ทั้ง in-app และ web push", OK],
  ["คนขับใกล้ถึงจุดรับ", "web push แจ้งเตือนล่วงหน้า", OK],
  ["ปิดการแจ้งเตือน", "ไม่ได้รับ web push แต่ยังเห็นใน in-app", OK],
]));

children.push(H3("6.3 การประเมินคนขับ"));
children.push(table(["กรณีทดสอบ", "ผลลัพธ์ที่ได้", "ผล"], [
  ["ให้คะแนน 1–5 ดาว", "บันทึกสำเร็จ คะแนนเฉลี่ยอัปเดต", OK],
  ["ให้คะแนนซ้ำในเที่ยวเดียว", "ถูกปฏิเสธ (1 เที่ยว 1 คะแนน)", OK],
  ["ให้คะแนนนอกช่วง 1–5", "ถูกปฏิเสธ (validation)", OK],
  ["ให้คะแนนเที่ยวที่ยังไม่จบ", "ถูกปฏิเสธ", OK],
]));

children.push(H3("6.4 UI/UX มือถือ"));
children.push(table(["กรณีทดสอบ", "ผลลัพธ์ที่ได้", "ผล"], [
  ["ความกว้าง 360px (มือถือ)", "เลย์เอาต์เป็นคอลัมน์เดียว ปุ่มกดได้", OK],
  ["ความกว้าง 768px (แท็บเล็ต)", "แสดง 2 คอลัมน์", OK],
  ["ความกว้าง 1280px (เดสก์ท็อป)", "แสดงเต็มรูปแบบ", OK],
  ["ขนาดปุ่มหลัก", "≥ 44px กดง่ายด้วยนิ้ว", OK],
]));

children.push(H3("6.5 Monitoring และชุดทดสอบอัตโนมัติ (E2E)"));
children.push(table(["รหัส", "การทดสอบ", "ผลลัพธ์ที่คาดหวัง", "ผล"], [
  ["TC-01", "สร้างคำขอเดินทางด้วยข้อมูลถูกต้อง", "HTTP 201, ได้ ride id และ passenger id", OK],
  ["TC-02", "อ่านคำขอที่สร้างใน TC-01", "HTTP 200, ค่าตรงกับที่สร้าง", OK],
  ["TC-03", "ยกเลิกคำขอนั้น", "HTTP 200, สถานะกลายเป็น cancelled", OK],
  ["TC-04", "สร้างคำขอโดยไม่มีต้นทาง", "HTTP 400, ไม่มีข้อมูลถูกสร้าง", OK],
  ["MON-01", "ตรวจสอบ /api/health", "ตอบ { ok: true }", OK],
  ["MON-02", "แจ้งเตือนเมื่อ deploy ล้มเหลว", "ได้รับข้อความแจ้งเตือน", OK],
]));

/* ---------------- 7 ---------------- */
children.push(H("7. Definition of Done", HeadingLevel.HEADING_2));
children.push(bullet("ฟีเจอร์ใหม่ทำงานได้จริงบนเว็บที่ deploy แล้ว (ไม่ใช่แค่ในเครื่อง)"));
children.push(bullet("ตำแหน่งคนขับอัปเดตแบบ Realtime และทดสอบหลายคันพร้อมกันได้"));
children.push(bullet("การแจ้งเตือนทำงานทั้งช่องทาง in-app และ web push และปิด/เปิดได้"));
children.push(bullet("การประเมินคนขับมี validation ครบ (1 เที่ยว 1 คะแนน, ช่วงคะแนนถูกต้อง)"));
children.push(bullet("หน้าจอใช้งานได้บนมือถือ (Responsive) ทดสอบหลายความกว้าง"));
children.push(bullet("มีชุดทดสอบ E2E และผ่านทุกกรณี พร้อมระบบ monitoring การ deploy"));
children.push(bullet("เพื่อนร่วมกลุ่มทบทวน (review) และ merge เข้า branch main แล้ว"));

/* ---------------- 8 ---------------- */
children.push(H("8. Sprint Review (ผลการนำเสนอ)", HeadingLevel.HEADING_2));
children.push(bullet("สาธิตแผนที่ติดตามคนขับแบบ live หลายคันบนเว็บที่ deploy จริง"));
children.push(bullet("สาธิตการแจ้งเตือน: ให้คนขับกดรับงาน แล้วเห็นแจ้งเตือน in-app และ web push"));
children.push(bullet("สาธิตการประเมินคนขับหลังจบเที่ยว และดูคะแนนเฉลี่ยที่อัปเดต"));
children.push(bullet("สาธิตหน้าจอบนมือถือ (Responsive) เทียบกับเดสก์ท็อป"));
children.push(bullet("รายงานผลชุดทดสอบ E2E และสถานะระบบ monitoring"));

/* ---------------- 9 ---------------- */
children.push(H("9. Sprint Retrospective", HeadingLevel.HEADING_2));
children.push(table(["สิ่งที่ทำได้ดี", "สิ่งที่ควรปรับปรุง", "จะทำใน Sprint ถัดไป"], [
  ["ประสบการณ์ใช้งานดีขึ้นชัดเจน (เห็นคนขับหลายคันและแจ้งเตือนทันที)", "Web Push ต้องขอสิทธิ์จากผู้ใช้ และบางเบราว์เซอร์ behaviour ต่างกัน", "ทดสอบการแจ้งเตือนบนหลายเบราว์เซอร์และอุปกรณ์จริงให้มากขึ้น"],
  ["มีชุดทดสอบและ monitoring ทำให้จับปัญหาการ deploy ได้เร็ว", "การออกแบบ UX ใช้เวลามากกว่าที่ประเมิน 1 วัน", "ประเมินเวลา UX ให้เผื่อมากขึ้นและทำ wireframe ก่อนลงมือ"],
  ["การประเมินคนขับเพิ่มความน่าเชื่อถือให้ระบบ", "ยังไม่มีระบบคัดกรองความคิดเห็นที่ไม่เหมาะสม", "เพิ่มการกลั่นกรองความคิดเห็นใน Sprint ถัดไป"],
]));

/* ---------------- 10 ---------------- */
children.push(H("10. ปัญหาและอุปสรรค", HeadingLevel.HEADING_2));
children.push(table(["ปัญหา", "วิธีแก้ไข"], [
  ["การแสดงตำแหน่งคนขับหลายคันพร้อมกันทำให้แผนที่หน่วงเมื่อข้อมูลอัปเดตถี่", "จำกัดความถี่การอัปเดตและใช้การสมัครรับเฉพาะกลุ่มที่เกี่ยวข้อง (Realtime channel)"],
  ["Web Push ต้องมี Service Worker และการขอสิทธิ์จากผู้ใช้", "เพิ่มขั้นตอนขอสิทธิ์ในหน้าแจ้งเตือน และ fallback ไปใช้ in-app เมื่อผู้ใช้ไม่อนุญาต"],
  ["การให้คะแนนซ้ำทำให้ค่าเฉลี่ยเพี้ยน", "บังคับกติกา 1 เที่ยวต่อ 1 คะแนนที่ระดับฐานข้อมูล/เซิร์ฟเวอร์"],
  ["หน้าจอบนมือถือเดิมจัดวางไม่เหมาะกับนิ้ว", "ปรับเป็น Responsive และเพิ่มขนาดปุ่มให้กดง่าย"],
]));

/* ---------------- 11 ---------------- */
children.push(H("11. แผน Sprint ถัดไป (Sprint 4)", HeadingLevel.HEADING_2));
children.push(bullet("ระบบชำระเงิน/แบ่งค่าโดยสารระหว่างผู้ร่วมเดินทาง และกระเป๋าเงิน"));
children.push(bullet("แชตพูดคุยระหว่างผู้โดยสารกับคนขับในแอป"));
children.push(bullet("ระบบโปรโมชัน/คูปอง และการสะสมแต้ม"));
children.push(bullet("หน้าจอผู้ดูแลระบบ (Admin Dashboard) และรายงานสรุปการใช้งาน"));
children.push(bullet("การกลั่นกรองความคิดเห็น/รีวิว และเพิ่มความปลอดภัย (ยืนยันตัวตนคนขับ)"));

/* ---------------- 12 ---------------- */
children.push(H("12. สรุป", HeadingLevel.HEADING_2));
children.push(bullet("Sprint 3 ทำสำเร็จตาม Sprint Goal: ยกระดับประสบการณ์ใช้งานจริงและคุณภาพของระบบ"));
children.push(bullet("ส่งมอบฟีเจอร์หลัก ได้แก่ แผนที่ live หลายคัน, ระบบแจ้งเตือน 2 ช่องทาง, การประเมินคนขับ และ UI มือถือ"));
children.push(bullet("เพิ่มชุดทดสอบ E2E และระบบ monitoring ทำให้ระบบน่าเชื่อถือและพร้อมใช้งานมากขึ้น"));
children.push(bullet("ระบบพร้อมใช้งานจริงที่ https://up-drive.vercel.app และมีเอกสารประกอบครบ"));

/* ---------------- 13 ---------------- */
children.push(H("13. ภาคผนวก — ลิงก์และไฟล์ที่เกี่ยวข้อง", HeadingLevel.HEADING_2));
children.push(table(["รายการ", "ที่อยู่ / ไฟล์"], [
  ["เว็บไซต์ที่ deploy จริง", "https://up-drive.vercel.app"],
  ["ซอร์สโค้ด (GitHub)", "github.com/phathon2006/-UP-drive"],
  ["รายงาน Sprint 2", "docs/sprint2-report/report.docx"],
  ["เอกสารฐานข้อมูล (Schema)", "docs/schema-report/report.docx"],
  ["เอกสาร TOR", "docs/tor/report.docx"],
  ["สไลด์นำเสนอ", "docs/slides/UP-Drive-Slides.pptx (pdf)"],
  ["แผนทดสอบ", "TEST-PLAN.md"],
]));
children.push(H3("ไฟล์ประกอบในโฟลเดอร์นี้"));
children.push(table(["ไฟล์", "รายละเอียด"], [
  ["report.docx", "ไฟล์ Word พร้อมรูป"],
  ["report.md", "รายงานฉบับนี้ (Markdown)"],
  ["screenshots/", "ภาพประกอบทั้ง 6 ภาพ"],
  ["fig*.html", "หน้าเว็บต้นทางของภาพ burndown / board / live map / notifications / rating / mobile"],
  ["demo/", "สคริปต์ที่ใช้สร้างไฟล์ Word"],
]));

const doc = new Document({
  styles: { default: { document: { run: { font: FONT, size: 22 } } } },
  sections: [{ children }],
});

const buf = await Packer.toBuffer(doc);
writeFileSync(OUT, buf);
console.log("wrote " + OUT + " (" + buf.length + " bytes)");
