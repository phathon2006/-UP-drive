// mkpdf.mjs — พิมพ์สไลด์ HTML เป็นไฟล์ PDF (Chrome headless)
// วิธีใช้: node mkpdf.mjs <slides.html> <out.pdf>
import { spawn } from "node:child_process";
import { writeFileSync, rmSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";

const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const PORT = Number(process.env.CDP_PORT || 9345);
const PROFILE = join(process.env.TEMP || ".", "opencode-cdp-pdf-profile");

const htmlFile = process.argv[2];
const outPdf = process.argv[3];

mkdirSync(dirname(outPdf), { recursive: true });
rmSync(PROFILE, { recursive: true, force: true });

const chrome = spawn(CHROME, [
  "--headless=new",
  "--disable-gpu",
  "--no-first-run",
  "--no-default-browser-check",
  `--remote-debugging-port=${PORT}`,
  `--user-data-dir=${PROFILE}`,
  "about:blank",
], { stdio: "ignore" });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitPort() {
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${PORT}/json/version`);
      if (r.ok) return await r.json();
    } catch {}
    await sleep(300);
  }
  throw new Error("chrome devtools not ready");
}

async function newTab(url) {
  const r = await fetch(`http://127.0.0.1:${PORT}/json/new?${encodeURIComponent(url)}`, { method: "PUT" });
  return await r.json();
}

function cdp(wsUrl) {
  const ws = new WebSocket(wsUrl);
  let id = 0;
  const pending = new Map();
  const waiters = [];
  ws.addEventListener("message", (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) reject(new Error(JSON.stringify(msg.error)));
      else resolve(msg.result);
    } else if (msg.method) {
      for (let i = waiters.length - 1; i >= 0; i--) {
        if (waiters[i].method === msg.method) { waiters[i].resolve(msg); waiters.splice(i, 1); }
      }
    }
  });
  const ready = new Promise((res, rej) => {
    ws.addEventListener("open", res);
    ws.addEventListener("error", rej);
  });
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const mid = ++id;
    pending.set(mid, { resolve, reject });
    ws.send(JSON.stringify({ id: mid, method, params }));
  });
  const waitEvent = (method, timeout = 15000) => new Promise((resolve, reject) => {
    waiters.push({ method, resolve });
    setTimeout(() => reject(new Error("timeout waiting " + method)), timeout);
  });
  return { ws, ready, send, waitEvent };
}

try {
  await waitPort();
  const url = "file:///" + htmlFile.replace(/\\/g, "/").replace(/^\/+/, "");
  const tab = await newTab(url);
  const c = cdp(tab.webSocketDebuggerUrl);
  await c.ready;
  await c.send("Page.enable");
  await c.waitEvent("Page.loadEventFired").catch(() => {});
  await sleep(700);
  const res = await c.send("Page.printToPDF", {
    landscape: true,
    printBackground: true,
    preferCSSPageSize: true,
    marginTop: 0, marginBottom: 0, marginLeft: 0, marginRight: 0,
  });
  writeFileSync(outPdf, Buffer.from(res.data, "base64"));
  c.ws.close();
} finally {
  chrome.kill();
}
console.log("WROTE " + outPdf);
