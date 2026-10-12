import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = process.argv[2] || join(__dirname, "out-func");
mkdirSync(OUT, { recursive: true });
mkdirSync(join(OUT, "screenshots"), { recursive: true });

const data = JSON.parse(readFileSync(join(__dirname, "results-func.json"), "utf8"));
const funcSql = readFileSync(join(__dirname, "functions.sql"), "utf8").trim();

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
function cell(col, val) {
  if (val === null) return `<td class="null">NULL</td>`;
  if (typeof val === "number") return `<td class="num">${val}</td>`;
  if (typeof val === "string" && /^[0-9a-f]{8}$/.test(val)) return `<td class="mono">${val}…</td>`;
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
:root{--ink:#1b2434;--muted:#6b7688;--line:#e2e8f0;--accent:#0d9488;--bg:#eef2f8;}
*{box-sizing:border-box;}
body{margin:0;background:var(--bg);color:var(--ink);font-family:"Segoe UI","Leelawadee UI","Noto Sans Thai",Tahoma,system-ui,sans-serif;line-height:1.6;}
.page{width:960px;margin:0 auto;background:#fff;padding:44px 52px;box-shadow:0 10px 40px rgba(15,23,42,.08);}
h1{font-size:30px;margin:0 0 6px;letter-spacing:-.3px;}
h2{font-size:21px;margin:38px 0 12px;padding-bottom:8px;border-bottom:2px solid var(--line);}
.sub{color:var(--muted);font-size:14px;margin:0;}
.kicker{display:inline-block;font-size:12px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:var(--accent);background:#ccfbf1;padding:4px 10px;border-radius:999px;}
hr{border:0;border-top:1px solid var(--line);margin:30px 0;}
p{margin:10px 0;} code{font-family:"Cascadia Code",Consolas,monospace;}
pre.sql{background:#1e2430;color:#e6edf3;border-radius:10px;padding:16px 18px;overflow:auto;font-size:12.5px;line-height:1.55;margin:10px 0;border:1px solid #0f172a;}
table.res{border-collapse:collapse;width:100%;margin:10px 0;font-size:13px;table-layout:fixed;}
table.res th{background:#eef2f7;text-align:left;padding:8px 10px;border:1px solid var(--line);font-weight:600;font-size:12px;color:#334155;word-break:break-word;}
table.res td{padding:7px 10px;border:1px solid var(--line);word-break:break-word;}
td.mono,.mono{font-family:"Cascadia Code",Consolas,monospace;font-size:12px;}
td.small{font-size:11px;color:#475569;font-family:"Cascadia Code",Consolas,monospace;}
td.num{font-family:"Cascadia Code",Consolas,monospace;font-weight:700;color:#166534;}
td.null,.muted{color:var(--muted);}
.caption{font-size:12.5px;color:var(--muted);margin:6px 0 0;}
.step{margin:18px 0 26px;}
.step .hd{display:flex;gap:10px;align-items:baseline;margin-bottom:4px;}
.step .no{flex:0 0 auto;width:26px;height:26px;border-radius:50%;background:var(--accent);color:#fff;font-size:13px;font-weight:700;display:inline-flex;align-items:center;justify-content:center;}
.step .ttl{font-weight:700;font-size:15px;}
.note{background:#ecfeff;border:1px solid #a5f3fc;border-radius:8px;padding:10px 14px;font-size:13.5px;color:#155e75;}
.lead{font-size:15px;color:#334155;}
ul{margin:8px 0 8px 4px;padding-left:20px;} li{margin:4px 0;}
.footer{margin-top:36px;padding-top:14px;border-top:1px solid var(--line);color:var(--muted);font-size:12.5px;}
.two{display:grid;grid-template-columns:1fr 1fr;gap:16px;}
.card{border:1px solid var(--line);border-radius:10px;padding:12px 14px;}
.card h4{margin:0 0 6px;font-size:14px;color:var(--accent);}
`;

const page = (title, inner, width = 960) =>
  `<!doctype html><html lang="th"><head><meta charset="utf-8"><title>${esc(title)}</title><style>${CSS}.page{width:${width}px;}</style></head><body><div class="page">${inner}</div></body></html>`;

const stepByNo = (n) => data.steps.find((s) => s.no === n);
function stepBlock(s) {
  if (!s) return "";
  return `<div class="step">
    <div class="hd"><span class="no">${s.no}</span><span class="ttl">${esc(s.title)}</span></div>
    ${sqlBlock(s.sql)}
    ${table(s.result)}
    ${s.note ? `<p class="note">${esc(s.note)}</p>` : ""}
  </div>`;
}

const overview = `
<span class="kicker">รายงาน SQL Function</span>
<h1>ระบบแชร์รถมหาวิทยาลัยพะเยา — UP Drive</h1>
<p class="sub">รายงานแสดง SQL Function ของกลุ่ม พร้อมผลการเรียกใช้งานจริง</p>
<hr>
<h2>1. SQL Function คืออะไร</h2>
<p class="lead"><b>SQL Function (ฟังก์ชัน)</b> คือชุดคำสั่ง SQL ที่ถูกเก็บไว้ในฐานข้อมูล ตั้งชื่อไว้ แล้ว
<b>เรียกใช้ซ้ำได้</b> ด้วยชื่อฟังก์ชัน พร้อมส่งค่า (parameter) เข้าไปได้ เหมือนฟังก์ชันในภาษาโปรแกรม
แต่ทำงานอยู่ที่ฐานข้อมูล</p>
<p>ข้อดีคือ เขียนตรรกะครั้งเดียว แล้วเรียกใช้ได้จากทุกที่ — จาก SQL Editor, จากฟังก์ชันอื่น
หรือจากแอปพลิเคชันผ่าน <code>supabase.rpc()</code></p>
<h2>2. ประเภทของฟังก์ชันที่ใช้ในงานนี้</h2>
<ul>
  <li><b>Scalar function</b> — คืนค่าเดี่ยว ๆ 1 ค่า เช่น <code>haversine_km()</code> คืนตัวเลขระยะทาง</li>
  <li><b>Table function</b> — คืนผลเป็นตาราง เรียกด้วย <code>select * from fn(...)</code> เช่น <code>find_candidate_groups()</code></li>
  <li>เขียนด้วยภาษา <b>SQL</b> (<code>language sql</code>) จึงอ่านง่ายและให้ฐานข้อมูล optimize เอง</li>
</ul>
<h2>3. ทำไมกลุ่มเราจึงเลือกเขียน Function</h2>
<p>เดิมตรรกะ "คำนวณระยะทาง" และ "จับคู่กลุ่มที่ใกล้ที่สุด" อยู่ที่โค้ดฝั่งเซิร์ฟเวอร์ (Node.js) กลุ่มเราย้ายมาเป็น
SQL Function เพื่อให้ฐานข้อมูลคำนวณได้เอง ใช้ซ้ำได้ทุกที่ และทดสอบได้ทันทีใน SQL Editor</p>
`;

const codeSection = `
<h2>4. โค้ด SQL Function ของกลุ่ม</h2>
<p>สคริปต์ทั้งหมดอยู่ในไฟล์ <code>functions.sql</code> — ประกอบด้วย 2 scalar function และ 1 table function</p>
<pre class="sql"><code>${esc(funcSql)}</code></pre>
<p class="caption">ภาพที่ 1 — โค้ด SQL Function ทั้ง 3 ตัวของกลุ่ม</p>
`;

const scalarSection = `
<h2>5. ผลการทดสอบ — Scalar Functions</h2>
${stepByNo(2) ? stepBlock(stepByNo(2)) : ""}
${stepByNo(3) ? stepBlock(stepByNo(3)) : ""}
<p class="caption">ภาพที่ 2 — ผลเรียก haversine_km() และ group_passenger_total()</p>
`;

const candidateSection = `
<h2>6. ผลการทดสอบ — Table Function (ตัวหลัก)</h2>
${stepByNo(4) ? stepBlock(stepByNo(4)) : ""}
${stepByNo(5) ? stepBlock(stepByNo(5)) : ""}
<p class="caption">ภาพที่ 3 — ผลเรียก find_candidate_groups() และการปรับ parameter</p>
`;

const listSection = `
<h2>7. รายการ SQL Function ทั้งหมดในฐานข้อมูล</h2>
<p>ตรวจสอบจาก <code>pg_proc</code> ร่วมกับ <code>pg_language</code> เพื่อยืนยันว่าฟังก์ชันถูกสร้างจริงและเขียนด้วยภาษา SQL</p>
${table(data.functions)}
<p class="caption">ภาพที่ 4 — ตารางแสดง SQL Function ทั้งหมด</p>
`;

const summarySection = `
<h2>8. สรุป</h2>
<ul>
  <li>กลุ่มเราเพิ่ม <b>SQL Function จำนวน 3 ตัว</b> (2 scalar + 1 table function) เขียนด้วยภาษา SQL</li>
  <li><code>haversine_km()</code> ใช้คำนวณระยะทางจริง — ทดสอบแล้วให้ผล 0.107 / 0.383 / 4.965 km ตรงตามพิกัด</li>
  <li><code>group_passenger_total()</code> นับผู้โดยสารรวมของกลุ่มได้ถูกต้อง และคืน 0 เมื่อกลุ่มว่าง</li>
  <li><code>find_candidate_groups()</code> คืนกลุ่มที่ใกล้ที่สุดพร้อมคะแนน และกรองกลุ่มที่ไกลเกินระยะได้จริง</li>
</ul>
<div class="footer">UP Drive — รายงาน SQL Function · ฐานข้อมูล: PostgreSQL / Supabase</div>
`;

const fullInner = overview + codeSection + scalarSection + candidateSection + listSection + summarySection;
writeFileSync(join(OUT, "report.html"), page("รายงาน SQL Function — UP Drive", fullInner), "utf8");

const splitIdx = funcSql.indexOf("-- FUNCTION 3:");
const code1 = funcSql.slice(0, splitIdx).trim();
const code2 = funcSql.slice(splitIdx).trim();
const codePart = (label, code) => `
<h2>4. โค้ด SQL Function ของกลุ่ม (${label})</h2>
<pre class="sql"><code>${esc(code)}</code></pre>`;

const figs = {
  "fig1-overview.html": page("overview", overview),
  "fig2a-code1.html": page("code1", codePart("1/2", code1), 900),
  "fig2b-code2.html": page("code2", codePart("2/2", code2), 900),
  "fig3-scalar.html": page("scalar", scalarSection),
  "fig4-candidates.html": page("candidates", candidateSection),
  "fig5-list.html": page("list", listSection),
};
for (const [name, html] of Object.entries(figs)) writeFileSync(join(OUT, name), html, "utf8");

console.log("written to " + OUT);
console.log(Object.keys(figs).concat("report.html").join("\n"));
