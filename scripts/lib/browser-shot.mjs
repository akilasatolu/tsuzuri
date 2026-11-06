// scripts/ の画像を作るスクリプト(make-hero-gif.mjs、make-gallery-shots.mjs)で共通に使う、
// ビルドしたサイトの配信と、Chrome(DevTools Protocol)で画面を撮る処理。
//   - Google Chrome があること。場所は環境変数 CHROME_PATH で変えられる(既定は macOS の /Applications の場所)

import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { spawn } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";

export const CHROME_PATH = process.env.CHROME_PATH || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

// ---------- ビルドしたサイトを 127.0.0.1 の空いているポートで配信する ----------
export const CONTENT_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".xml": "application/xml",
  ".txt": "text/plain; charset=utf-8",
};

export function serve(siteDir) {
  const server = http.createServer((req, res) => {
    const urlPath = decodeURIComponent(new URL(req.url, "http://127.0.0.1").pathname);
    let file = path.join(siteDir, urlPath);
    if (!file.startsWith(siteDir)) {
      res.writeHead(403).end();
      return;
    }
    if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, "index.html");
    if (!fs.existsSync(file)) {
      res.writeHead(404).end();
      return;
    }
    res.writeHead(200, { "content-type": CONTENT_TYPES[path.extname(file)] ?? "application/octet-stream" });
    res.end(fs.readFileSync(file));
  });
  return new Promise((resolve) => server.listen(0, "127.0.0.1", () => resolve(server)));
}

// ---------- Chrome を起動し、DevTools Protocol(CDP)でつなぐ ----------
export async function launchChrome(profileDir) {
  const chrome = spawn(
    CHROME_PATH,
    [
      "--headless=new",
      "--disable-gpu",
      "--hide-scrollbars",
      "--no-first-run",
      "--no-default-browser-check",
      "--remote-debugging-port=0",
      `--user-data-dir=${profileDir}`,
      "about:blank",
    ],
    { stdio: "ignore" },
  );
  const portFile = path.join(profileDir, "DevToolsActivePort");
  for (let i = 0; i < 150 && !fs.existsSync(portFile); i++) await sleep(100);
  if (!fs.existsSync(portFile)) {
    chrome.kill();
    throw new Error(`Chrome を起動できませんでした(${CHROME_PATH})。CHROME_PATH で場所を指定してください`);
  }
  const [port, wsPath] = fs.readFileSync(portFile, "utf-8").trim().split("\n");
  return { chrome, wsUrl: `ws://127.0.0.1:${port}${wsPath}` };
}

export async function connect(wsUrl) {
  const ws = new WebSocket(wsUrl);
  await new Promise((resolve, reject) => {
    ws.onopen = resolve;
    ws.onerror = () => reject(new Error("DevTools Protocol につなげませんでした"));
  });
  let lastId = 0;
  const pending = new Map();
  const waiters = [];
  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    if (msg.id !== undefined && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) reject(new Error(`${msg.error.message}`));
      else resolve(msg.result);
      return;
    }
    for (const w of [...waiters]) {
      if (w.method === msg.method && w.sessionId === msg.sessionId) {
        waiters.splice(waiters.indexOf(w), 1);
        w.resolve(msg.params);
      }
    }
  };
  const send = (method, params = {}, sessionId) =>
    new Promise((resolve, reject) => {
      const id = ++lastId;
      pending.set(id, { resolve, reject });
      ws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
    });
  const once = (method, sessionId, timeoutMs = 30000) =>
    Promise.race([
      new Promise((resolve) => waiters.push({ method, sessionId, resolve })),
      sleep(timeoutMs).then(() => {
        throw new Error(`${method} を待つあいだに時間切れになりました`);
      }),
    ]);
  return { ws, send, once };
}

// 1つのタブ(ページ)を開き、操作の関数を返す
export async function openPage(cdp) {
  const { targetId } = await cdp.send("Target.createTarget", { url: "about:blank" });
  const { sessionId } = await cdp.send("Target.attachToTarget", { targetId, flatten: true });
  const send = (method, params) => cdp.send(method, params, sessionId);
  await send("Page.enable");
  await send("Runtime.enable");
  const evaluate = async (expression) => {
    const { result, exceptionDetails } = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
    if (exceptionDetails) throw new Error(`ページの中の処理に失敗しました: ${exceptionDetails.text}`);
    return result.value;
  };
  return {
    async setView({ width, height }, scheme) {
      await send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: false });
      await send("Emulation.setEmulatedMedia", {
        features: [
          { name: "prefers-color-scheme", value: scheme },
          { name: "prefers-reduced-motion", value: "no-preference" },
        ],
      });
    },
    async goto(url, waitMs) {
      const loaded = cdp.once("Page.loadEventFired", sessionId);
      await send("Page.navigate", { url });
      await loaded;
      await sleep(waitMs);
    },
    async setContent(html) {
      await this.goto("about:blank", 0);
      const { frameTree } = await send("Page.getFrameTree");
      await send("Page.setDocumentContent", { frameId: frameTree.frame.id, html });
      // すべての画像が描けるようになるまで待つ
      await evaluate("Promise.all([...document.images].map((img) => img.decode()))");
    },
    evaluate,
    async screenshot(clip) {
      const params = { format: "png" };
      if (clip) params.clip = { ...clip, scale: 1 };
      const { data } = await send("Page.captureScreenshot", params);
      return Buffer.from(data, "base64");
    },
    // 次の描画が終わるまで待つ
    nextPaint: () => evaluate("new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))"),
  };
}
