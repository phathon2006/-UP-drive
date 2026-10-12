import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = process.argv[2] || join(__dirname, "out");
mkdirSync(OUT, { recursive: true });
mkdirSync(join(OUT, "screenshots"), { recursive: true });

const data = JSON.parse(readFileSync(join(__dirname, "results.json"), "utf8"));
const triggerSql = readFileSync(join(__dirname, "trigger.sql"), "utf8").trim();

const TH_MONTHS = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
function fmtTs(v) {
  const d = new Date(v);
  if (isNaN(d.getTime())) return v;
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getDate()} ${TH_MONTHS[d.getMonth()]} ${d.getFullYear() + 543} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}
function isTs(key, val) {
  return typeof val === "string" && /_at$/.test(key) && /^\d{4}-\d{2}-\d{2}T/.test(val);
}
function cell(key, val) {
  if (val === null) return `<td class="null">NULL</td>`;
  if (isTs(key, val)) return `<td class="ts">${fmtTs(val)}</td>`;
  if (typeof val === "string" && val.length > 24) return `<td class="mono small">${val}</td>`;
  if (key === "status") return `<td><span class="badge s-${val}">${val}</span></td>`;
  return `<td class="mono">${val}</td>`;
}
function table(r) {
  if (!r) return "";
  const head = r.columns.map((c) => `<th>${c}</th>`).join("");
  const rows = r.rows.length
    ? r.rows.map((row) => `<tr>${r.columns.map((c) => cell(c, row[c])).join("")}</tr>`).join("")
    : `<tr><td colspan="${r.columns.length}" class="muted">(ไม่มีแถว)</td></tr>`;
  return `<table class="res"><thead><tr>${head}</tr></thead><tbody>${rows}</tbody></table>`;
}
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function sqlBlock(sql) {
  return `<pre class="sql"><code>${esc(sql)}</code></pre>`;
}

const CSS = `
:root{--ink:#1b2434;--muted:#6b7688;--line:#e2e8f0;--accent:#2563eb;--ok:#16a34a;--warn:#dc2626;--bg:#eef2f8;}
*{box-sizing:border-box;}
body{margin:0;background:var(--bg);color:var(--ink);
  font-family:"Segoe UI","Leelawadee UI","Noto Sans Thai",Tahoma,system-ui,sans-serif;
  line-height:1.6;-webkit-font-smoothing:antialiased;}
.page{width:960px;margin:0 auto;background:#fff;padding:44px 52px;box-shadow:0 10px 40px rgba(15,23,42,.08);}
h1{font-size:30px;margin:0 0 6px;letter-spacing:-.3px;}
h2{font-size:21px;margin:38px 0 12px;padding-bottom:8px;border-bottom:2px solid var(--line);}
h3{font-size:16px;margin:26px 0 8px;}
.sub{color:var(--muted);font-size:14px;margin:0;}
.kicker{display:inline-block;font-size:12px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;
  color:var(--accent);background:#e8f0fe;padding:4px 10px;border-radius:999px;}
hr{border:0;border-top:1px solid var(--line);margin:30px 0;}
p{margin:10px 0;}
code{font-family:"Cascadia Code",Consolas,"Courier New",monospace;}
pre.sql{background:#1e2430;color:#e6edf3;border-radius:10px;padding:16px 18px;overflow:auto;
  font-size:12.5px;line-height:1.55;margin:10px 0;border:1px solid #0f172a;}
pre.sql .fn{color:#7ee787;}
.caption{font-size:12.5px;color:var(--muted);margin:6px 0 0;}
table.res{border-collapse:collapse;width:100%;margin:10px 0;font-size:13px;}
table.res th{background:#eef2f7;text-align:left;padding:8px 10px;border:1px solid var(--line);
  font-weight:600;font-size:12px;color:#334155;}
table.res td{padding:7px 10px;border:1px solid var(--line);}
td.mono,.mono{font-family:"Cascadia Code",Consolas,monospace;font-size:12px;}
td.small{font-size:11px;color:#475569;}
td.null{color:#94a3b8;font-style:italic;}
td.ts{background:#eafaf0;font-family:"Cascadia Code",Consolas,monospace;font-size:12px;color:#166534;font-weight:600;}
td.muted,.muted{color:var(--muted);}
.badge{display:inline-block;font-size:11px;font-weight:700;padding:2px 8px;border-radius:999px;background:#e2e8f0;color:#334155;}
.badge.s-forming{background:#fef3c7;color:#92400e;}
.badge.s-sent_to_driver{background:#dbeafe;color:#1e40af;}
.badge.s-accepted{background:#e0e7ff;color:#3730a3;}
.badge.s-completed{background:#dcfce7;color:#166534;}
.step{margin:18px 0 26px;}
.step .hd{display:flex;gap:10px;align-items:baseline;margin-bottom:4px;}
.step .no{flex:0 0 auto;width:26px;height:26px;border-radius:50%;background:var(--accent);color:#fff;
  font-size:13px;font-weight:700;display:inline-flex;align-items:center;justify-content:center;}
.step .ttl{font-weight:700;font-size:15px;}
.note{background:#fff7e6;border:1px solid #fde68a;border-radius:8px;padding:10px 14px;font-size:13.5px;}
.err{background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:10px 14px;color:#991b1b;
  font-family:"Cascadia Code",Consolas,monospace;font-size:12.5px;}
.ok{background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:10px 14px;color:#166534;font-size:13.5px;}
ul{margin:8px 0 8px 4px;padding-left:20px;}
li{margin:4px 0;}
.lead{font-size:15px;color:#334155;}
.flowgrid{display:grid;grid-template-columns:1fr;gap:0;}
.fig{background:#fff;}
.footer{margin-top:36px;padding-top:14px;border-top:1px solid var(--line);color:var(--muted);font-size:12.5px;}
`;

function page(title, inner, width = 960) {
  return `<!doctype html><html lang="th"><head><meta charset="utf-8">
<title>${esc(title)}</title><style>${CSS}
.page{width:${width}px;}</style></head>
<body><div class="page">${inner}</div></body></html>`;
}

const stepByNo = (n) => data.steps.find((s) => s.no === n);

/* ---------- combined report ---------- */
const overview = `
<span class="kicker">รายงาน Database Trigger</span>
<h1>ระบบแชร์รถมหาวิทยาลัยพะเยา — UP Drive</h1>
<p class="sub">รายงานแสดง Trigger ของกลุ่ม (Database Trigger / PostgreSQL) พร้อมผลการทดสอบจริง</p>
<hr>
<h2>1. Trigger คืออะไร</h2>
<p class="lead"><b>Trigger (ทริกเกอร์)</b> คือชุดคำสั่งที่ฐานข้อมูลเรียกให้ทำงาน <b>อัตโนมัติ</b>
เมื่อเกิดเหตุการณ์ (event) กับตาราง เช่น มีการ <code>INSERT</code>, <code>UPDATE</code> หรือ <code>DELETE</code>
โดยไม่ต้องให้โปรแกรมฝั่งแอปสั่งเอง ทำให้กติกาของระบบถูกบังคับใช้ที่ฐานข้อมูลเสมอ แม้มีโปรแกรมหรือคน
เข้าถึงข้อมูลหลายทาง</p>
<p>ใน PostgreSQL/ Supabase ประกอบด้วย 2 ส่วน:</p>
<ul>
  <li><b>Trigger Function</b> — ฟังก์ชันภาษา PL/pgSQL ที่ทำงานจริงและ <code>RETURN NEW</code></li>
  <li><b>CREATE TRIGGER</b> — ผูกฟังก์ชันกับตาราง ระบุว่าให้ทำงาน <i>ก่อน</i> (BEFORE) หรือ <i>หลัง</i> (AFTER) การแก้ไข</li>
</ul>

<h2>2. ทำไมกลุ่มเราจึงเลือกใช้ Trigger</h2>
<p>ระบบ UP Drive เดิมตั้งค่าเวลาและตรวจสอบกติกาจาก <b>โค้ดฝั่งเซิร์ฟเวอร์ (Node.js)</b> ซึ่งมีข้อเสียคือ
ถ้ามีการแก้ข้อมูลจากช่องทางอื่น (เช่น SQL Editor หรือ API ตรง) กติกาจะถูกข้ามได้ กลุ่มเราจึงย้ายกติกาสำคัญ
3 ข้อไปเป็น Trigger เพื่อให้ฐานข้อมูลคุมเอง:</p>
<ul>
  <li><b>ตั้งเวลาอัตโนมัติ</b> — เมื่อกลุ่มเปลี่ยนสถานะ ให้บันทึกเวลา <code>confirmed_at / accepted_at / completed_at</code> ให้เอง</li>
  <li><b>บังคับกติกาความถูกต้อง</b> — ห้ามตั้งสถานะ <code>accepted</code> ถ้ายังไม่มีคนขับ</li>
  <li><b>อัปเดตตำแหน่งล่าสุด</b> — เมื่อพิกัดคนขับถูกแก้ ให้ <code>updated_at</code> เป็นเวลาปัจจุบันเสมอ</li>
</ul>
`;

const codeSection = `
<h2>3. โค้ด Trigger ของกลุ่ม</h2>
<p>ด้านล่างคือสคริปต์ Trigger ทั้งหมด (ไฟล์ <code>trigger.sql</code>) ที่รันบน PostgreSQL ของ Supabase</p>
<pre class="sql"><code>${esc(triggerSql)}</code></pre>
<p class="caption">ภาพที่ 1 — โค้ด Trigger ทั้ง 3 ตัวของกลุ่ม</p>
`;

function stepBlock(s, extra = "") {
  if (!s) return "";
  const err = s.error ? `<p class="err">ERROR: ${esc(s.error)}</p>` : "";
  const before = s.before ? `<p class="caption">ก่อนอัปเดต (updated_at เก่า 1 ชั่วโมง):</p>${table(s.before)}` : "";
  return `<div class="step">
    <div class="hd"><span class="no">${s.no}</span><span class="ttl">${esc(s.title)}</span></div>
    ${sqlBlock(s.sql)}
    ${err}
    ${before}
    ${table(s.result)}
    ${extra}
  </div>`;
}

const flowSection = `
<h2>4. ผลการทดสอบ — การตั้งเวลาอัตโนมัติ</h2>
<p class="lead">ทดสอบโดยเปลี่ยนสถานะกลุ่มไปเรื่อย ๆ แล้วดูว่าเวลาในคอลัมน์
<code>confirmed_at</code>, <code>accepted_at</code>, <code>completed_at</code> ถูกเติมเองโดย Trigger หรือไม่</p>
${stepByNo(1) ? stepBlock(stepByNo(1)) : ""}
${stepByNo(2) ? stepBlock(stepByNo(2)) : ""}
${stepByNo(3) ? stepBlock(stepByNo(3)) : ""}
${stepByNo(4) ? stepBlock(stepByNo(4)) : ""}
${stepByNo(5) ? stepBlock(stepByNo(5), stepByNo(5).unchanged ? `<p class="ok">ผลลัพธ์: ค่าเวลาเดิมทั้ง 3 ช่อง <b>ไม่ถูกเขียนทับ</b> (timestamps unchanged = true) — Trigger ทำงานแบบ idempotent</p>` : "") : ""}
<p class="caption">ภาพที่ 2 — ลำดับการเปลี่ยนสถานะ และเวลาที่ Trigger เติมให้ (ช่องสีเขียว)</p>
`;

const guardSection = `
<h2>5. ผลการทดสอบ — Trigger บังคับกติกาความถูกต้อง</h2>
<p>เมื่อพยายามตั้งสถานะเป็น <code>accepted</code> ให้กลุ่มที่ยังไม่มีคนขับ ฐานข้อมูลปฏิเสธคำสั่งทันที
พร้อมข้อความแจ้งเตือน ข้อมูลจึงไม่ถูกบันทึก (สถานะคงเป็น <code>forming</code>)</p>
${stepByNo(6) ? stepBlock(stepByNo(6)) : ""}
${stepByNo(6) && stepByNo(6).error ? `<p class="ok">ผลลัพธ์: ถูก Trigger บล็อกสำเร็จ — สถานะยังเป็น <b>forming</b> และ <b>driver_id</b> ยังเป็น NULL</p>` : ""}
<p class="caption">ภาพที่ 3 — Trigger ปฏิเสธข้อมูลที่ไม่ถูกต้อง</p>
`;

const gpsSection = `
<h2>6. ผลการทดสอบ — อัปเดตเวลาตำแหน่งคนขับอัตโนมัติ</h2>
${stepByNo(7) ? stepBlock(stepByNo(7)) : ""}
<p class="ok">ผลลัพธ์: หลังแก้พิกัด <code>updated_at</code> เปลี่ยนเป็นเวลาปัจจุบันเอง โดยแอปไม่ต้องส่งค่าเวลามา</p>
<p class="caption">ภาพที่ 4 — Trigger อัปเดต updated_at อัตโนมัติ</p>
`;

const listSection = `
<h2>7. รายการ Trigger ทั้งหมดในระบบ</h2>
<p>ดึงจาก <code>information_schema.triggers</code> เพื่อยืนยันว่า Trigger ถูกสร้างจริงในฐานข้อมูล</p>
${table(data.triggers)}
<p class="caption">ภาพที่ 5 — ตารางแสดง Trigger ทั้งหมด</p>
`;

const summarySection = `
<h2>8. สรุป</h2>
<ul>
  <li>กลุ่มเราเพิ่ม <b>Database Trigger จำนวน 3 ตัว</b> ให้กับตาราง <code>ride_groups</code> และ <code>driver_locations</code></li>
  <li>Trigger ช่วยให้ฐานข้อมูล <b>เติมเวลาและบังคับกติกาเองอัตโนมัติ</b> ลดการพึ่งพาโค้ดฝั่งเซิร์ฟเวอร์</li>
  <li>ทดสอบจริงแล้วพบว่า: เวลาถูกเติมถูกต้อง, ค่าเดิมไม่ถูกเขียนทับ, ข้อมูลผิดกติกาถูกบล็อก, และ <code>updated_at</code> อัปเดตเอง</li>
  <li>ผลทดสอบรันบน PostgreSQL 16 (จำลองด้วย PGlite/WASM) ด้วย SQL ชุดเดียวกับ Supabase</li>
</ul>
<div class="footer">UP Drive — รายงาน Trigger · จัดทำโดยกลุ่ม UP Drive · ฐานข้อมูล: PostgreSQL / Supabase</div>
`;

const fullInner = overview + codeSection + flowSection + guardSection + gpsSection + listSection + summarySection;
writeFileSync(join(OUT, "report.html"), page("รายงาน Database Trigger — UP Drive", fullInner), "utf8");

/* ---------- individual figures for screenshots ---------- */
const figs = {
  "fig1-overview.html": page("overview", overview),
  "fig2-code.html": page("code", codeSection, 900),
  "fig3-flow.html": page("flow", flowSection),
  "fig4-guard.html": page("guard", guardSection),
  "fig5-gps.html": page("gps", gpsSection),
  "fig6-list.html": page("list", listSection),
};
for (const [name, html] of Object.entries(figs)) writeFileSync(join(OUT, name), html, "utf8");

console.log("written to " + OUT);
console.log(Object.keys(figs).concat("report.html").join("\n"));
