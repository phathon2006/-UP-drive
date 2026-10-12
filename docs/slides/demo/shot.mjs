import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync, rmSync, readFileSync } from "node:fs";
import { join } from "node:path";

const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const PORT = 9333;
const PROFILE = join(process.env.TEMP || ".", "opencode-cdp-profile");

const dir = process.argv[2];
const pairs = JSON.parse(readFileSync(process.argv[3], "utf8").replace(/^\uFEFF/, "")); // [{file, out}]

rmSync(PROFILE, { recursive: true, force: true });
mkdirSync(dir, { recursive: true });

const chrome = spawn(CHROME, [
  "--headless=new",
  "--disable-gpu",
  "--hide-scrollbars",
  "--no-first-run",
  "--no-default-browser-check",
  "--force-device-scale-factor=1",
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
async function closeTab(id) {
  try { await fetch(`http://127.0.0.1:${PORT}/json/close/${id}`); } catch {}
}

function cdp(wsUrl) {
  const ws = new WebSocket(wsUrl);
  let id = 0;
  const pending = new Map();
  const events = [];
  const waiters = [];
  ws.addEventListener("message", (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) reject(new Error(JSON.stringify(msg.error)));
      else resolve(msg.result);
    } else if (msg.method) {
      events.push(msg);
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
    const w = { method, resolve };
    waiters.push(w);
    setTimeout(() => reject(new Error("timeout waiting " + method)), timeout);
  });
  return { ws, ready, send, waitEvent };
}

const out = [];
try {
  await waitPort();
  for (const { file, out: png } of pairs) {
    const url = "file:///" + file.replace(/\\/g, "/").replace(/^\/+/, "");
    const tab = await newTab(url);
    const c = cdp(tab.webSocketDebuggerUrl);
    await c.ready;
    await c.send("Page.enable");
    await c.send("Runtime.enable");
    await c.send("Emulation.setDeviceMetricsOverride", { width: 1000, height: 1000, deviceScaleFactor: 1, mobile: false });
    await c.waitEvent("Page.loadEventFired").catch(() => {});
    await sleep(500);
    const ev = await c.send("Runtime.evaluate", {
      expression: "(()=>{const e=document.querySelector('.page')||document.body;const r=e.getBoundingClientRect();return JSON.stringify({x:Math.floor(r.x),y:Math.floor(r.y),w:Math.ceil(r.width),h:Math.ceil(r.height)});})()",
      returnByValue: true,
    });
    const dom = JSON.parse(ev.result.value);
    const width = Math.ceil(dom.w);
    const height = Math.ceil(dom.h);
    const shot = await c.send("Page.captureScreenshot", {
      format: "png",
      captureBeyondViewport: true,
      clip: { x: dom.x, y: dom.y, width, height, scale: 2 },
    });
    writeFileSync(png, Buffer.from(shot.data, "base64"));
    out.push({ png, width: width * 2, height: height * 2 });
    c.ws.close();
    await closeTab(tab.id);
  }
} finally {
  chrome.kill();
}
console.log(JSON.stringify(out, null, 2));
