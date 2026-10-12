// build-html.mjs — สร้างสไลด์ HTML (พรีวิว + ใช้แคปเจอร์ภาพ)
// วิธีใช้: node build-html.mjs <outDir>
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { SLIDES, BRAND, META } from "./slides-data.mjs";

const OUT = process.argv[2] || ".";
mkdirSync(OUT, { recursive: true });
mkdirSync(join(OUT, "html"), { recursive: true });

const esc = (s) =>
  String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

const CSS = `
* { box-sizing: border-box; margin: 0; padding: 0; }
.page {
  position: relative;
  width: 1280px; height: 720px;
  background: ${"#" + BRAND.bg};
  font-family: "Noto Sans Thai", "Tahoma", "Segoe UI", sans-serif;
  color: #${BRAND.text};
  overflow: hidden;
}
.bar { position:absolute; top:0; left:0; right:0; height:16px; background:#${BRAND.primary}; }
.bar.accent { background: var(--accent); }
.hdr { position:absolute; top:42px; left:54px; right:54px; }
.hdr h2 { font-size:44px; color:#${BRAND.primaryDark}; font-weight:800; letter-spacing:.2px; }
.underline { width:130px; height:7px; border-radius:4px; background:#${BRAND.secondary}; margin-top:12px; }
.foot { position:absolute; left:54px; right:54px; bottom:20px; display:flex; justify-content:space-between; font-size:14px; color:#${BRAND.muted}; }

/* title slide */
.title-slide { background: linear-gradient(135deg, #${BRAND.primary}, #7C3AED); color:#fff; }
.title-slide .eyebrow { position:absolute; top:74px; left:54px; background:#${BRAND.secondary}; color:#3F2A00; font-weight:800; font-size:15px; padding:9px 20px; border-radius:999px; }
.title-slide h1 { position:absolute; top:150px; left:54px; font-size:96px; font-weight:900; letter-spacing:1px; }
.title-slide .sub { position:absolute; top:300px; left:56px; font-size:27px; color:#EDE9FE; max-width:900px; line-height:1.4; }
.title-slide .tags { position:absolute; top:400px; left:56px; font-size:21px; color:#FDE68A; letter-spacing:.5px; }
.title-slide .url { position:absolute; left:56px; bottom:52px; font-size:19px; font-weight:800; }
.title-slide .band { position:absolute; left:0; right:0; bottom:0; height:62px; background:rgba(64,22,129,.85); }

/* bullets */
.rows { position:absolute; top:150px; left:54px; right:54px; }
.row { display:flex; align-items:center; gap:16px; background:#fff; border:1px solid #${BRAND.border}; border-radius:16px; padding:12px 18px; margin-bottom:12px; box-shadow:0 6px 18px rgba(0,0,0,.04); }
.row .num { flex:0 0 auto; width:38px; height:38px; border-radius:10px; background:#${BRAND.primarySoft}; color:#${BRAND.primary}; font-weight:800; display:flex; align-items:center; justify-content:center; font-size:17px; }
.row .txt { font-size:20px; line-height:1.35; }

/* cards */
.cards { position:absolute; top:158px; left:54px; right:54px; display:flex; gap:26px; }
.card { flex:1; background:#fff; border:1px solid #${BRAND.border}; border-radius:18px; padding:0 0 20px; overflow:hidden; box-shadow:0 8px 24px rgba(0,0,0,.05); display:flex; flex-direction:column; }
.card .top { height:9px; background:#${BRAND.primary}; }
.card .icon { text-align:center; font-size:44px; margin:18px 0 6px; }
.card h3 { text-align:center; font-size:22px; color:#${BRAND.primaryDark}; margin:6px 14px 16px; }
.card ul { list-style:none; padding:0 22px; }
.card li { font-size:16px; line-height:1.4; margin-bottom:9px; padding-left:20px; position:relative; }
.card li:before { content:"•"; color:#${BRAND.primary}; position:absolute; left:4px; font-weight:900; }
.note { position:absolute; left:54px; right:54px; bottom:56px; text-align:center; font-size:16px; font-style:italic; color:#${BRAND.muted}; }

/* steps */
.steps { position:absolute; top:165px; left:54px; right:54px; display:flex; flex-wrap:wrap; gap:22px 22px; }
.step { width:calc((100% - 66px)/4); background:#fff; border:1px solid #${BRAND.border}; border-radius:16px; padding:16px; display:flex; align-items:center; gap:14px; box-shadow:0 6px 18px rgba(0,0,0,.04); }
.step .n { flex:0 0 auto; width:42px; height:42px; border-radius:12px; background:#${BRAND.primary}; color:#fff; font-weight:800; display:flex; align-items:center; justify-content:center; font-size:18px; }
.step .t { font-size:17px; font-weight:700; line-height:1.25; }

/* summary */
.sums { position:absolute; top:200px; left:54px; right:54px; display:flex; gap:26px; }
.sum { flex:1; background:#fff; border:1px solid #${BRAND.border}; border-radius:18px; overflow:hidden; box-shadow:0 8px 24px rgba(0,0,0,.05); padding-bottom:22px; }
.sum .top { height:9px; background:#${BRAND.success}; }
.sum .chk { text-align:center; font-size:44px; color:#${BRAND.success}; font-weight:900; margin:22px 0 8px; }
.sum h3 { text-align:center; font-size:21px; color:#${BRAND.primaryDark}; margin:6px 14px 10px; }
.sum p { text-align:center; font-size:17px; color:#${BRAND.text}; padding:0 22px; line-height:1.4; }
.finalurl { position:absolute; left:54px; right:54px; bottom:58px; text-align:center; font-size:21px; font-weight:800; color:#${BRAND.primary}; }
`;

function slideInner(s, page) {
  if (s.kind === "title") {
    return `
    <div class="page title-slide">
      <div class="eyebrow">${esc(s.eyebrow)}</div>
      <h1>${esc(s.title)}</h1>
      <div class="sub">${esc(s.subtitle)}</div>
      <div class="tags">${esc(s.tags.join("   "))}</div>
      <div class="band"></div>
      <div class="url">${esc(META.url)}</div>
    </div>`;
  }

  const accentStyle = s.accent ? ` style="--accent:#${s.accent}"` : "";
  const headerHtml = `
    <div class="bar ${s.accent ? "accent" : ""}"${accentStyle}></div>
    <div class="hdr"><h2>${s.emoji ? esc(s.emoji) + " " : ""}${esc(s.title)}</h2><div class="underline"></div></div>`;

  let body = "";
  if (s.kind === "bullets") {
    body = `<div class="rows">${s.items
      .map((t, i) => `<div class="row"><div class="num">${i + 1}</div><div class="txt">${esc(t)}</div></div>`)
      .join("")}</div>`;
  } else if (s.kind === "cards") {
    body =
      `<div class="cards">` +
      s.cards
        .map(
          (c) =>
            `<div class="card"><div class="top"></div><div class="icon">${esc(c.icon)}</div><h3>${esc(c.title)}</h3><ul>${c.lines
              .map((l) => `<li>${esc(l)}</li>`)
              .join("")}</ul></div>`
        )
        .join("") +
      `</div>` +
      (s.note ? `<div class="note">${esc(s.note)}</div>` : "");
  } else if (s.kind === "steps") {
    body = `<div class="steps">${s.steps
      .map((t, i) => `<div class="step"><div class="n">${i + 1}</div><div class="t">${esc(t)}</div></div>`)
      .join("")}</div>`;
  } else if (s.kind === "summary") {
    body =
      `<div class="sums">` +
      s.items
        .map((it) => `<div class="sum"><div class="top"></div><div class="chk">✓</div><h3>${esc(it[0])}</h3><p>${esc(it[1])}</p></div>`)
        .join("") +
      `</div>` +
      `<div class="finalurl">${esc(META.url)}</div>`;
  }

  return `<div class="page">${headerHtml}${body}
    <div class="foot"><span>${esc(META.footer)}</span><span>${page}</span></div>
  </div>`;
}

function doc(inner, extraCss = "") {
  return `<!DOCTYPE html>
<html lang="th"><head><meta charset="utf-8">
<meta name="viewport" content="width=1280">
<title>UP Drive — สไลด์</title>
<style>${CSS}${extraCss}</style>
</head><body>${inner}</body></html>`;
}

// 1) ไฟล์แยกต่อสไลด์ (สำหรับแคปเจอร์)
SLIDES.forEach((s, i) => {
  const inner = slideInner(s, i + 1).trim();
  writeFileSync(join(OUT, "html", `slide-${i + 1}.html`), doc(inner), "utf8");
});

// 2) ไฟล์รวม (พรีวิว/พิมพ์ PDF)
const all = SLIDES.map((s, i) => slideInner(s, i + 1).trim()).join("\n");
const stackCss = `
  body { background:#111827; padding:40px 0; display:flex; flex-direction:column; align-items:center; gap:34px; }
  .page { box-shadow:0 20px 50px rgba(0,0,0,.5); }
  @media print {
    body { background:#fff; padding:0; gap:0; }
    .page { box-shadow:none; page-break-after:always; }
    @page { size: 1280px 720px; margin:0; }
  }
`;
writeFileSync(join(OUT, "slides.html"), doc(all, stackCss), "utf8");

console.log("WROTE " + join(OUT, "slides.html") + " + " + SLIDES.length + " individual html files");
