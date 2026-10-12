import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = process.argv[2] || join(__dirname, "out-proc");
mkdirSync(OUT, { recursive: true });
mkdirSync(join(OUT, "screenshots"), { recursive: true });

const data = JSON.parse(readFileSync(join(__dirname, "results-proc.json"), "utf8"));
const procSql = readFileSync(join(__dirname, "procedures.sql"), "utf8").trim();

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
function cell(col, val) {
  if (val === null) return `<td class="null">NULL</td>`;
  if (typeof val === "boolean") return `<td class="bool">${val}</td>`;
  if (typeof val === "number") return `<td class="num">${val}</td>`;
  if (typeof val === "string" && /^[0-9a-f]{8}$/.test(val)) return `<td class="mono">${val}…</td>`;
  if (typeof val === "string" && val.includes("#") && /ผู้ใช้ .*ไม่ใช่คนขับ/.test(val)) return `<td class="small">${esc(val)}</td>`;
  if (typeof val === "string" && val.length > 40) return `<td class="small">${esc(val)}</td>`;
  return `<td>${esc(val)}</td>`;
}
function table(r) {
  if (!r) return "";
  const head = r.columns.map((c) => `<th>${esc(c)}</th>`).join("");
  const rows = r.rows.length
    ? r.rows.map((row) => `<tr>${r.columns.map((c) => cell(c, row[c])).join("")}</tr>`).join("")
    : `<tr><td colspan="${r.columns.length}" class="muted">(ไม่มีแถว)</td></tr>`;
  return `<table class="res"><thead><tr>${head}</tr></thead><tbody>${rows}</tbody></table>`;
}
const sqlBlock = (sql) => `<pre class="sql"><code>${esc(sql)}</code></pre>`;

const CSS = `
:root{--ink:#1b2434;--muted:#6b7688;--line:#e2e8f0;--accent:#7c3aed;--bg:#eef2f8;}
*{box-sizing:border-box;}
body{margin:0;background:var(--bg);color:var(--ink);font-family:"Segoe UI","Leelawadee UI","Noto Sans Thai",Tahoma,system-ui,sans-serif;line-height:1.6;}
.page{width:960px;margin:0 auto;background:#fff;padding:44px 52px;box-shadow:0 10px 40px rgba(15,23,42,.08);}
h1{font-size:30px;margin:0 0 6px;letter-spacing:-.3px;}
h2{font-size:21px;margin:38px 0 12px;padding-bottom:8px;border-bottom:2px solid var(--line);}
.sub{color:var(--muted);font-size:14px;margin:0;}
.kicker{display:inline-block;font-size:12px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:var(--accent);background:#ede9fe;padding:4px 10px;border-radius:999px;}
hr{border:0;border-top:1px solid var(--line);margin:30px 0;}
p{margin:10px 0;} code{font-family:"Cascadia Code",Consolas,monospace;}
pre.sql{background:#231e30;color:#e6edf3;border-radius:10px;padding:16px 18px;overflow:auto;font-size:12.5px;line-height:1.55;margin:10px 0;border:1px solid #1b1526;}
table.res{border-collapse:collapse;width:100%;margin:10px 0;font-size:13px;table-layout:fixed;}
table.res th{background:#eef2f7;text-align:left;padding:8px 10px;border:1px solid var(--line);font-weight:600;font-size:12px;color:#334155;word-break:break-word;}
table.res td{padding:7px 10px;border:1px solid var(--line);word-break:break-word;}
td.mono,.mono{font-family:"Cascadia Code",Consolas,monospace;font-size:12px;}
td.small{font-size:11px;color:#475569;font-family:"Cascadia Code",Consolas,monospace;}
td.num{font-family:"Cascadia Code",Consolas,monospace;font-weight:700;color:#166534;}
td.bool{font-family:"Cascadia Code",Consolas,monospace;font-weight:700;color:#b45309;}
td.null,.muted{color:var(--muted);}
.caption{font-size:12.5px;color:var(--muted);margin:6px 0 0;}
.step{margin:18px 0 26px;}
.step .hd{display:flex;gap:10px;align-items:baseline;margin-bottom:4px;}
.step .no{flex:0 0 auto;width:26px;height:26px;border-radius:50%;background:var(--accent);color:#fff;font-size:13px;font-weight:700;display:inline-flex;align-items:center;justify-content:center;}
.step .ttl{font-weight:700;font-size:15px;}
.note{background:#f5f3ff;border:1px solid #ddd6fe;border-radius:8px;padding:10px 14px;font-size:13.5px;color:#5b21b6;}
.err{background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:10px 14px;font-size:13px;color:#991b1b;font-family:"Cascadia Code",Consolas,monospace;}
.lead{font-size:15px;color:#334155;}
ul{margin:8px 0 8px 4px;padding-left:20px;} li{margin:4px 0;}
.footer{margin-top:36px;padding-top:14px;border-top:1px solid var(--line);color:var(--muted);font-size:12.5px;}
`;

const page = (title, inner, width = 960) =>
  `<!doctype html><html lang="th"><head><meta charset="utf-8"><title>${esc(title)}</title><style>${CSS}.page{width:${width}px;}</style></head><body><div class="page">${inner}</div></body></html>`;

const stepByNo = (n) => data.steps.find((s) => s.no === n);
function stepBlock(s) {
  if (!s) return "";
  let body = "";
  if (s.error) body = `<p class="err">ERROR: ${esc(s.error)}</p>`;
  else {
    body = table(s.result);
    if (s.result2) body += `<p class="sub-note" style="font-size:12.5px;color:#6b7688;margin:6px 0 2px;">และตาราง event log:</p>` + table(s.result2);
  }
  return `<div class="step">
    <div class="hd"><span class="no">${s.no}</span><span class="ttl">${esc(s.title)}</span></div>
    ${sqlBlock(s.sql)}
    ${body}
    ${s.note ? `<p class="note">${esc(s.note)}</p>` : ""}
  </div>`;
}

const overview = `
<span class="kicker">รายงาน Stored Procedure</span>
<h1>ระบบแชร์รถมหาวิทยาลัยพะเยา — UP Drive</h1>
<p class="sub">รายงานแสดง Stored Procedure ของกลุ่ม พร้อมผลการเรียกใช้งานจริง</p>
<hr>
<h2>1. Stored Procedure คืออะไร</h2>
<p class="lead"><b>Stored Procedure (โปรแกรมเก็บไว้ในฐานข้อมูล)</b> คือชุดคําสั่งที่เก็บไว้ในฐานข้อมูล
ตั้งชื่อไว้ แล้วเรียกใช้ด้วยคําสั่ง <code>CALL</code> ต่างจาก SQL Function ตรงที่ procedure
<b>ไม่คืนค่าเป็นผลลัพธ์ของคําสั่ง</b> แต่ทํางานเป็นชุด (หลายคําสั่ง) และส่งค่ากลับทาง parameter ได้</p>
<h2>2. ข้อแตกต่างจาก SQL Function</h2>
<table class="res">
  <thead><tr><th>หัวข้อ</th><th>Stored Procedure</th><th>Function</th></tr></thead>
  <tbody>
    <tr><td>การเรียกใช้</td><td>CALL proc(...)</td><td>อยู่ใน select / นิพจน์</td></tr>
    <tr><td>ค่าที่คืน</td><td>ไม่คืนผ่าน select — คืนทาง INOUT/OUT</td><td>คืนค่าเดี่ยวหรือตาราง</td></tr>
    <tr><td>การทํางาน</td><td>หลายคําสั่ง + จัดการ transaction ได้</td><td>มักเป็นคําสั่งเดียว/อ่านค่า</td></tr>
    <tr><td>เหมาะกับ</td><td>งานที่เปลี่ยนข้อมูลหลายขั้นตอน (business action)</td><td>การคํานวณ/คิวรีที่เรียกซ้ํา</td></tr>
  </tbody>
</table>
<h2>3. ทําไมกลุ่มเราจึงเลือกเขียน Procedure</h2>
<p>งานอย่าง "คนขับรับงาน" หรือ "ยกเลิกกลุ่ม" ต้องทําหลายขั้นตอนติดกัน (ตรวจเงื่อนไข + อัปเดตสถานะ +
บันทึก log) เดิมโค้ดฝั่งเซิร์ฟเวอร์ต้องยิงหลายคิวรีและเสี่ยงที่ข้อมูลจะไม่ตรงกัน กลุ่มเราจึงย้ายมาเป็น
Stored Procedure ให้ทําทั้งชุดในคําสั่งเดียวที่ฐานข้อมูล รับประกันความถูกต้องของข้อมูล</p>
`;

const splitIdx = procSql.indexOf("-- PROCEDURE 2:");
const code1 = procSql.slice(0, splitIdx).trim();
const code2 = procSql.slice(splitIdx).trim();
const codeSection = `
<h2>4. โค้ด Stored Procedure ของกลุ่ม</h2>
<p>สคริปต์ทั้งหมดอยู่ในไฟล์ <code>procedures.sql</code> — ประกอบด้วย 3 procedure</p>
<pre class="sql"><code>${esc(procSql)}</code></pre>
`;
const codePart = (label, code) => `
<h2>4. โค้ด Stored Procedure ของกลุ่ม (${label})</h2>
<pre class="sql"><code>${esc(code)}</code></pre>`;

const sectionProcTable = `
<h2>4. Stored Procedure ทั้ง 3 ตัวของกลุ่ม</h2>
<table class="res">
  <thead><tr><th>#</th><th>ชื่อ Procedure</th><th>หน้าที่</th></tr></thead>
  <tbody>
    <tr><td>1</td><td class="mono">sp_accept_ride_group(group_id, driver_id)</td><td>คนขับรับงาน: ตรวจเงื่อนไข -> มอบหมายคนขับ -> ตั้งสถานะ accepted -> บันทึก event</td></tr>
    <tr><td>2</td><td class="mono">sp_cancel_ride_group(group_id, actor_id, reason)</td><td>ยกเลิกกลุ่ม: ตั้งสถานะ cancelled -> คืนคนขับ -> บันทึก event</td></tr>
    <tr><td>3</td><td class="mono">sp_expire_stale_groups(older_than)</td><td>งานประจํา: ปิดกลุ่มที่รวมคนเกินเวลาที่กําหนด แล้วบันทึก event</td></tr>
  </tbody>
</table>
`;

const acceptSection = `
<h2>6. ผลการทดสอบ — คนขับรับงาน (Procedure 1)</h2>
${stepByNo(2) ? stepBlock(stepByNo(2)) : ""}
${stepByNo(3) ? stepBlock(stepByNo(3)) : ""}
${stepByNo(4) ? stepBlock(stepByNo(4)) : ""}
${stepByNo(5) ? stepBlock(stepByNo(5)) : ""}
<p class="caption">ภาพที่ 4 — ผลเรียก sp_accept_ride_group() และการตรวจเงื่อนไข</p>
`;

const lifecycleSection = `
<h2>7. ผลการทดสอบ — ยกเลิกกลุ่มและงานประจํา (Procedure 2-3)</h2>
${stepByNo(6) ? stepBlock(stepByNo(6)) : ""}
${stepByNo(7) ? stepBlock(stepByNo(7)) : ""}
${stepByNo(8) ? stepBlock(stepByNo(8)) : ""}
${stepByNo(9) ? stepBlock(stepByNo(9)) : ""}
${stepByNo(10) ? stepBlock(stepByNo(10)) : ""}
<p class="caption">ภาพที่ 5 — ผลเรียก sp_cancel_ride_group() และ sp_expire_stale_groups()</p>
`;

const listSection = `
<h2>8. รายการ Stored Procedure ทั้งหมดในฐานข้อมูล</h2>
<p>ตรวจสอบจากตารางระบบ <code>pg_proc</code> โดยเลือกเฉพาะ <code>prokind = 'p'</code> (procedure)</p>
${table(data.procedures)}
<p class="caption">ภาพที่ 6 — ตารางแสดง Stored Procedure ทั้งหมด</p>
`;

const summarySection = `
<h2>9. สรุป</h2>
<ul>
  <li>กลุ่มเราเพิ่ม <b>Stored Procedure จำนวน 3 ตัว</b> เรียกใช้ด้วยคําสั่ง <code>CALL</code></li>
  <li>ทดสอบแล้ว procedure ทํางานหลายขั้นตอนในคําสั่งเดียวได้จริง พร้อมบันทึก event log อัตโนมัติ</li>
  <li>การตรวจเงื่อนไขทํางานถูกต้อง: รับงานซ้ำถูกปฏิเสธ, ผู้โดยสารรับงานแทนคนขับถูกปฏิเสธ</li>
  <li>งานประจํา <code>sp_expire_stale_groups()</code> ปิดกลุ่มที่ค้างเกินเวลาได้ถูกต้อง และคืนจํานวนผ่าน INOUT</li>
</ul>
<div class="footer">UP Drive — รายงาน Stored Procedure · ฐานข้อมูล: PostgreSQL / Supabase</div>
`;

const fullInner = overview + sectionProcTable + codeSection + acceptSection + lifecycleSection + listSection + summarySection;
writeFileSync(join(OUT, "report.html"), page("รายงาน Stored Procedure — UP Drive", fullInner), "utf8");

const subSection = (title, nos, caption) => `
<h2>${title}</h2>
${nos.map((n) => stepBlock(stepByNo(n))).join("")}
<p class="caption">${caption}</p>`;

const figs = {
  "fig1-overview.html": page("overview", overview),
  "fig2a-code1.html": page("code1", codePart("1/2", code1), 900),
  "fig2b-code2.html": page("code2", codePart("2/2", code2), 900),
  "fig3a-accept.html": page("accept", subSection("6. ผลการทดสอบ — คนขับรับงานสําเร็จ (Procedure 1)", [2, 3], "ภาพที่ 4 — CALL sp_accept_ride_group() แล้วข้อมูลถูกต้อง")),
  "fig3b-guard.html": page("guard", subSection("6.1 การตรวจเงื่อนไข (guard) ของ Procedure 1", [4, 5], "ภาพที่ 5 — procedure ปฏิเสธคําสั่งที่ไม่ผ่านเงื่อนไข")),
  "fig4a-cancel.html": page("cancel", subSection("7. ผลการทดสอบ — ยกเลิกกลุ่ม (Procedure 2)", [6, 7], "ภาพที่ 6 — CALL sp_cancel_ride_group()")),
  "fig4b-expire.html": page("expire", subSection("7.1 งานประจําปิดกลุ่มที่ค้าง (Procedure 3)", [8, 9], "ภาพที่ 7 — CALL sp_expire_stale_groups()")),
  "fig4c-events.html": page("events", subSection("7.2 ตรวจสอบ event log ที่ procedure บันทึกไว้", [10], "ภาพที่ 8 — สถานะสุดท้ายและ event log ทั้งหมด")),
  "fig5-list.html": page("list", listSection),
};
for (const [name, html] of Object.entries(figs)) writeFileSync(join(OUT, name), html, "utf8");

console.log("written to " + OUT);
console.log(Object.keys(figs).concat("report.html").join("\n"));
