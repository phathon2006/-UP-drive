// build-pptx.mjs — สร้างไฟล์ PowerPoint (.pptx) จาก slides-data.mjs
// วิธีใช้: node build-pptx.mjs <outFile.pptx>
import pptxgen from "pptxgenjs";
import { SLIDES, BRAND, META } from "./slides-data.mjs";

const OUT = process.argv[2] || "UP-Drive-Slides.pptx";
const FONT = "Tahoma";

const pptx = new pptxgen();
pptx.layout = "LAYOUT_16x9"; // 10 x 5.625 in
pptx.author = "UP Drive";
pptx.company = "University of Phayao";
pptx.title = "UP Drive — ปัญหา ผู้ใช้ ฟีเจอร์";

const W = 10;
const H = 5.625;
const M = 0.55;
const CW = W - M * 2;

const hex = (c) => c;

function bg(slide, color) {
  slide.background = { color };
}

function footer(slide, page) {
  slide.addText(META.footer, {
    x: M, y: H - 0.42, w: CW - 0.9, h: 0.3,
    fontSize: 9, color: BRAND.muted, fontFace: FONT, align: "left", valign: "middle",
  });
  slide.addText(`${page}`, {
    x: W - M - 0.8, y: H - 0.42, w: 0.8, h: 0.3,
    fontSize: 9, color: BRAND.muted, fontFace: FONT, align: "right", valign: "middle",
  });
}

function header(slide, emoji, title, accent = BRAND.primary) {
  slide.addShape(pptx.ShapeType.rect, {
    x: 0, y: 0, w: W, h: 0.13, fill: { color: accent }, line: { color: accent, width: 0 },
  });
  slide.addText(`${emoji ? emoji + "  " : ""}${title}`, {
    x: M, y: 0.32, w: CW, h: 0.72,
    fontSize: 26, bold: true, color: BRAND.primaryDark, fontFace: FONT,
    align: "left", valign: "middle",
  });
  slide.addShape(pptx.ShapeType.rect, {
    x: M, y: 1.06, w: 1.15, h: 0.055, fill: { color: BRAND.secondary }, line: { color: BRAND.secondary, width: 0 },
  });
}

function card(slide, x, y, w, h, opts = {}) {
  slide.addShape(pptx.ShapeType.roundRect, {
    x, y, w, h, rectRadius: 0.08,
    fill: { color: opts.fill || BRAND.card },
    line: { color: opts.line || BRAND.border, width: 1 },
    shadow: { type: "outer", color: "9CA3AF", opacity: 0.25, blur: 6, offset: 2, angle: 90 },
  });
}

/* ---------------- SLIDE RENDERERS ---------------- */

function renderTitle(slide) {
  const s = SLIDES[0];
  bg(slide, BRAND.primary);
  slide.addShape(pptx.ShapeType.rect, {
    x: 0, y: H - 0.55, w: W, h: 0.55, fill: { color: BRAND.primaryDark }, line: { color: BRAND.primaryDark, width: 0 },
  });
  slide.addShape(pptx.ShapeType.roundRect, {
    x: M, y: 0.65, w: 2.6, h: 0.42, rectRadius: 0.2,
    fill: { color: BRAND.secondary }, line: { color: BRAND.secondary, width: 0 },
  });
  slide.addText(s.eyebrow, {
    x: M, y: 0.65, w: 2.6, h: 0.42, fontSize: 12, bold: true, color: "3F2A00",
    fontFace: FONT, align: "center", valign: "middle",
  });
  slide.addText(s.title, {
    x: M, y: 1.35, w: CW, h: 1.15, fontSize: 60, bold: true, color: "FFFFFF",
    fontFace: FONT, align: "left", valign: "middle", charSpacing: 1,
  });
  slide.addText(s.subtitle, {
    x: M, y: 2.6, w: CW - 0.5, h: 0.7, fontSize: 20, color: "EDE9FE",
    fontFace: FONT, align: "left", valign: "middle",
  });
  slide.addText(s.tags.join("     "), {
    x: M, y: 3.55, w: CW, h: 0.5, fontSize: 16, color: "FDE68A",
    fontFace: FONT, align: "left", valign: "middle",
  });
  slide.addText(META.url, {
    x: M, y: H - 0.5, w: CW, h: 0.4, fontSize: 13, color: "FFFFFF",
    fontFace: FONT, align: "left", valign: "middle", bold: true,
  });
}

function renderBullets(slide, s, page) {
  bg(slide, BRAND.bg);
  header(slide, s.emoji, s.title, s.accent || BRAND.primary);

  const startY = 1.32;
  const availH = H - startY - 0.6;
  const n = s.items.length;
  const rowH = Math.min(0.62, availH / n);

  s.items.forEach((t, i) => {
    const y = startY + i * rowH;
    const h = rowH - 0.08;
    card(slide, M, y, CW, h, { fill: BRAND.card, line: BRAND.border });
    slide.addShape(pptx.ShapeType.roundRect, {
      x: M + 0.12, y: y + 0.09, w: 0.34, h: h - 0.18, rectRadius: 0.05,
      fill: { color: BRAND.primarySoft }, line: { color: BRAND.primarySoft, width: 0 },
    });
    slide.addText(`${i + 1}`, {
      x: M + 0.12, y: y + 0.09, w: 0.34, h: h - 0.18,
      fontSize: 12, bold: true, color: BRAND.primary, fontFace: FONT, align: "center", valign: "middle",
    });
    slide.addText(t, {
      x: M + 0.58, y: y, w: CW - 0.75, h,
      fontSize: 14.5, color: BRAND.text, fontFace: FONT, align: "left", valign: "middle",
    });
  });
  footer(slide, page);
}

function renderCards(slide, s, page) {
  bg(slide, BRAND.bg);
  header(slide, s.emoji, s.title);

  const n = s.cards.length;
  const gap = 0.28;
  const cw = (CW - gap * (n - 1)) / n;
  const y = 1.45;
  const ch = H - y - 0.95;

  s.cards.forEach((c, i) => {
    const x = M + i * (cw + gap);
    card(slide, x, y, cw, ch, { fill: BRAND.card, line: BRAND.border });
    slide.addShape(pptx.ShapeType.rect, {
      x, y, w: cw, h: 0.08, fill: { color: BRAND.primary }, line: { color: BRAND.primary, width: 0 },
    });
    slide.addText(c.icon, {
      x: x + 0.1, y: y + 0.2, w: cw - 0.2, h: 0.7, fontSize: 30,
      fontFace: FONT, align: "center", valign: "middle",
    });
    slide.addText(c.title, {
      x: x + 0.14, y: y + 0.95, w: cw - 0.28, h: 0.55, fontSize: 15, bold: true,
      color: BRAND.primaryDark, fontFace: FONT, align: "center", valign: "middle",
    });
    const runs = c.lines.map((t) => ({ text: t, options: { bullet: { code: "2022", indent: 12 }, breakLine: true, paraSpaceAfter: 6 } }));
    slide.addText(runs, {
      x: x + 0.22, y: y + 1.55, w: cw - 0.44, h: ch - 1.7,
      fontSize: 12, color: BRAND.text, fontFace: FONT, align: "left", valign: "top", lineSpacingMultiple: 1.1,
    });
  });

  if (s.note) {
    slide.addText(s.note, {
      x: M, y: H - 0.85, w: CW, h: 0.35, fontSize: 12, italic: true,
      color: BRAND.muted, fontFace: FONT, align: "center", valign: "middle",
    });
  }
  footer(slide, page);
}

function renderSteps(slide, s, page) {
  bg(slide, BRAND.bg);
  header(slide, s.emoji, s.title);

  const cols = 4;
  const rows = Math.ceil(s.steps.length / cols);
  const gapX = 0.22;
  const gapY = 0.35;
  const cw = (CW - gapX * (cols - 1)) / cols;
  const ch = 0.95;
  const startY = 1.55;

  s.steps.forEach((t, i) => {
    const r = Math.floor(i / cols);
    const c = i % cols;
    const x = M + c * (cw + gapX);
    const y = startY + r * (ch + gapY);
    card(slide, x, y, cw, ch, { fill: BRAND.card, line: BRAND.border });
    slide.addShape(pptx.ShapeType.roundRect, {
      x: x + 0.14, y: y + 0.14, w: 0.42, h: 0.42, rectRadius: 0.08,
      fill: { color: BRAND.primary }, line: { color: BRAND.primary, width: 0 },
    });
    slide.addText(`${i + 1}`, {
      x: x + 0.14, y: y + 0.14, w: 0.42, h: 0.42, fontSize: 14, bold: true,
      color: "FFFFFF", fontFace: FONT, align: "center", valign: "middle",
    });
    slide.addText(t, {
      x: x + 0.62, y: y + 0.1, w: cw - 0.74, h: ch - 0.2,
      fontSize: 12.5, bold: true, color: BRAND.text, fontFace: FONT, align: "left", valign: "middle",
    });
  });
  footer(slide, page);
}

function renderSummary(slide, s, page) {
  bg(slide, BRAND.bg);
  header(slide, s.emoji, s.title);

  const n = s.items.length;
  const gap = 0.28;
  const cw = (CW - gap * (n - 1)) / n;
  const y = 1.8;
  const ch = H - y - 1.05;

  s.items.forEach((it, i) => {
    const x = M + i * (cw + gap);
    card(slide, x, y, cw, ch, { fill: BRAND.card, line: BRAND.border });
    slide.addShape(pptx.ShapeType.rect, {
      x, y, w: cw, h: 0.08, fill: { color: BRAND.success }, line: { color: BRAND.success, width: 0 },
    });
    slide.addText("✓", {
      x, y: y + 0.25, w: cw, h: 0.6, fontSize: 30, bold: true,
      color: BRAND.success, fontFace: FONT, align: "center", valign: "middle",
    });
    slide.addText(it[0], {
      x: x + 0.12, y: y + 1.0, w: cw - 0.24, h: 0.55, fontSize: 15, bold: true,
      color: BRAND.primaryDark, fontFace: FONT, align: "center", valign: "middle",
    });
    slide.addText(it[1], {
      x: x + 0.14, y: y + 1.6, w: cw - 0.28, h: ch - 1.75, fontSize: 12,
      color: BRAND.text, fontFace: FONT, align: "center", valign: "top",
    });
  });

  slide.addText(META.url, {
    x: M, y: H - 0.95, w: CW, h: 0.4, fontSize: 14, bold: true,
    color: BRAND.primary, fontFace: FONT, align: "center", valign: "middle",
  });
  footer(slide, page);
}

/* ---------------- BUILD ---------------- */

SLIDES.forEach((s, idx) => {
  const slide = pptx.addSlide();
  const page = idx + 1;
  if (s.kind === "title") renderTitle(slide);
  else if (s.kind === "bullets") renderBullets(slide, s, page);
  else if (s.kind === "cards") renderCards(slide, s, page);
  else if (s.kind === "steps") renderSteps(slide, s, page);
  else if (s.kind === "summary") renderSummary(slide, s, page);
});

await pptx.writeFile({ fileName: OUT });
console.log("WROTE " + OUT + " (" + SLIDES.length + " slides)");
