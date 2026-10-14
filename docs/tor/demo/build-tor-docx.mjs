import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  Document, Packer, Paragraph, TextRun, HeadingLevel,
} from "docx";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO = process.argv[2];
const OUT = process.argv[3] || join(REPO, "report.docx");

const FONT = "Tahoma";
const INK = "1B2434";

function P(text, opts = {}) {
  return new Paragraph({
    spacing: { after: opts.after ?? 80, before: opts.before ?? 0, line: 288 },
    alignment: opts.align,
    indent: opts.indent,
    children: [new TextRun({ text, font: FONT, size: opts.size ?? 22, bold: opts.bold, italics: opts.italics, color: opts.color })],
  });
}
function H(text, level) {
  return new Paragraph({
    heading: level,
    spacing: { before: level === HeadingLevel.HEADING_1 ? 0 : 260, after: 120 },
    children: [new TextRun({ text, font: FONT, bold: true, color: INK })],
  });
}
function lead(text) {
  return new Paragraph({
    spacing: { before: 150, after: 50, line: 288 },
    children: [new TextRun({ text, font: FONT, size: 22, bold: true, color: "334155" })],
  });
}
function bullet(text) {
  return new Paragraph({
    bullet: { level: 0 },
    spacing: { after: 60, line: 288 },
    children: [new TextRun({ text, font: FONT, size: 22 })],
  });
}

const children = [];

/* ---------------- HEADER (ตามเทมเพลต) ---------------- */
children.push(H("ข้อกำหนดขอบเขตของงาน (Terms of Reference : TOR)", HeadingLevel.HEADING_1));
children.push(P("", { after: 30 }));
children.push(P("โครงการ: ระบบ UP Drive — แอปพลิเคชันแชร์ค่าเดินทางสำหรับนักศึกษา มหาวิทยาลัยพะเยา", { after: 60 }));
children.push(P("ผู้ทำงาน: ______________________________ รหัสนิสิต ______________________", { after: 20 }));
children.push(P("________________ ______________________________ รหัสนิสิต ______________________", { after: 140 }));

/* ---------------- 1. ความเป็นมา ---------------- */
children.push(H("1. ความเป็นมา", HeadingLevel.HEADING_2));
children.push(P("ความเป็นมา: ปัจจุบันนักศึกษามหาวิทยาลัยพะเยาส่วนใหญ่เดินทางระหว่างที่พัก (ในตัวเมืองพะเยาและชุมชนรอบมหาวิทยาลัย) กับมหาวิทยาลัยด้วยรถยนต์ส่วนตัวหรือรถจักรยานยนต์ โดยมักเดินทางเพียงคนเดียวในแต่ละเที่ยว ส่งผลให้สิ้นเปลืองค่าเชื้อเพลิงและค่าใช้จ่ายในการเดินทางเป็นรายวัน อีกทั้งยังเพิ่มปริมาณรถบนท้องถนนและบริเวณทางเข้ามหาวิทยาลัย แม้ว่านักศึกษาหลายคนจะมีเส้นทางและช่วงเวลาเดินทางที่ใกล้เคียงกันก็ตาม ที่ผ่านมาการรวมกลุ่มเดินทางอาศัยการสื่อสารผ่านกลุ่มแชตหรือโซเชียลมีเดีย ซึ่งไม่มีระบบจัดการข้อมูล ไม่สามารถจับคู่เส้นทางที่ใกล้เคียงกันได้อย่างมีประสิทธิภาพ ไม่มีข้อมูลยืนยันตัวตนของผู้ร่วมเดินทาง และไม่มีการติดตามสถานะหรือตำแหน่งการเดินทางที่ชัดเจน จึงเห็นควรพัฒนาแอปพลิเคชัน “UP Drive” ซึ่งเป็นระบบแชร์ค่าเดินทาง (Carpooling) บนเว็บแอปพลิเคชัน ที่ช่วยให้นักศึกษาประกาศเส้นทางความต้องการเดินทาง จับคู่ผู้ที่ไปทางเดียวกันเป็นกลุ่ม มอบหมายให้คนขับรับงาน และติดตามตำแหน่งแบบเรียลไทม์ เพื่อลดค่าใช้จ่ายในการเดินทาง ลดปริมาณรถ และเพิ่มความสะดวกและความปลอดภัยในการเดินทางร่วมกัน", { after: 100 }));

/* ---------------- 2. ขอบเขตการดำเนินงาน ---------------- */
children.push(H("2. ขอบเขตการดำเนินงาน (Scope of Work)", HeadingLevel.HEADING_2));
children.push(P("ผู้ทำงานจะต้องดำเนินการพัฒนาแอปพลิเคชันและระบบที่เกี่ยวข้อง โดยมีรายละเอียดดังนี้:", { after: 100 }));

children.push(lead("2.1 แพลตฟอร์มที่รองรับ"));
children.push(P("Web-application รองรับเว็บเบราว์เซอร์มาตรฐาน (Chrome, Edge, Safari, Firefox)", { after: 100 }));

children.push(lead("2.2 คุณลักษณะและฟังก์ชันการทำงานหลัก (Core Features)"));

children.push(P("ระบบยืนยันตัวตนและการจัดการบัญชี (Authentication & User Profile):", { bold: true, before: 100, after: 40 }));
children.push(bullet("การลงทะเบียนและเข้าสู่ระบบ (Email/Password, เบอร์โทรศัพท์ผ่าน OTP, หรือ Social Login)"));
children.push(bullet("การจัดการข้อมูลส่วนตัว และการเปลี่ยนรหัสผ่าน"));
children.push(bullet("ระบบกำหนดสิทธิ์การใช้งาน (Role-Based Access Control)"));

children.push(P("ระบบการทำงานหลักของแอปพลิเคชัน (Main Modules):", { bold: true, before: 140, after: 40 }));
children.push(bullet("ระบบประกาศและค้นหาคำขอเดินทาง พร้อมจับคู่ผู้โดยสารที่ไปทางเดียวกันเป็นกลุ่ม (ระบุต้นทาง–ปลายทาง พิกัดบนแผนที่ GPS และจำนวนผู้ร่วมเดินทาง)"));
children.push(bullet("ระบบมอบหมายงานให้คนขับและการจัดการสถานะการเดินทาง (คนขับกดรับงาน พร้อมอัปเดตสถานะกลุ่มตลอดวงจร forming → sent_to_driver → accepted → completed / cancelled)"));
children.push(bullet("ระบบติดตามตำแหน่งคนขับแบบ Realtime และประวัติการเดินทาง (แสดงตำแหน่งบนแผนที่แบบเรียลไทม์ พร้อมเส้นทางและระยะทาง)"));

children.push(P("ระบบการแจ้งเตือน (Notifications):", { bold: true, before: 140, after: 40 }));
children.push(bullet("รองรับ Push Notifications และ In-app Notifications"));

children.push(P("ระบบจัดการหลังบ้าน (Admin Web Management):", { bold: true, before: 140, after: 40 }));
children.push(bullet("ระบบดูภาพรวมและสถิติ (Dashboard & Analytics)"));
children.push(bullet("ระบบจัดการข้อมูลผู้ใช้งานและเนื้อหา (Content/User Management)"));
children.push(bullet("ระบบออกรายงาน (Export ข้อมูลเป็น Excel / PDF)"));

const doc = new Document({
  styles: { default: { document: { run: { font: FONT, size: 22 } } } },
  sections: [{ children }],
});

const buf = await Packer.toBuffer(doc);
writeFileSync(OUT, buf);
console.log("wrote " + OUT + " (" + buf.length + " bytes)");
