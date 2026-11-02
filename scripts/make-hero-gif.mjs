#!/usr/bin/env node
// トップページのヒーローの画像(GitHub で見た README が、Tsuzuri の default のサイトに変わる GIF)を作り直す。
//   node scripts/make-hero-gif.mjs
//
// 作るもの(どれも 960×600。assets/hero/ に書き出す):
//   - readme-to-site-light.gif / readme-to-site-dark.gif: Before(GitHub の README)→ After(サイト)のアニメーション
//   - readme-to-site-light.png / readme-to-site-dark.png: 動きを減らす設定の人向けの、Before と After を並べた止まった画像
//
// 前提:
//   - gifski が PATH にあること(macOS なら brew install gifski)
//   - Google Chrome があること。場所は環境変数 CHROME_PATH で変えられる(既定は macOS の /Applications の場所)
//   - Before は GitHub 上の assets/hero/demo/README.md(main ブランチ)を撮る。見本を変えたら、push してから実行する
//
// 見本(assets/hero/demo/)、default.css、base.css を変えたときに実行し、できた画像を同じコミットに入れる。

import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";
import { fileURLToPath } from "node:url";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const DEMO_DIR = path.join(ROOT, "assets/hero/demo");
const OUT_DIR = path.join(ROOT, "assets/hero");
const BUILD_SCRIPT = path.join(ROOT, ".github/scripts/build-docs.mjs");
const STYLES_DIR = path.join(ROOT, "styles");
const BEFORE_URL = "https://github.com/akilasatolu/tsuzuri/blob/main/assets/hero/demo/README.md";
const CHROME_PATH = process.env.CHROME_PATH || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

const SHOT = { width: 1280, height: 800 }; // Before・After を撮る画面の大きさ(16:10)
const FRAME = { width: 960, height: 600 }; // GIF の1コマの大きさ
const BEFORE_VIEW_HEIGHT = 1400; // Before を撮るときの画面の高さ
const FPS = 10;
const FLAME = "#f97316"; // ロゴの炎の色(境目の線)

// 設定に関わる環境変数(test/golden.test.mjs の CONFIG_ENV_KEYS と同じ)。ビルドの前にすべて消してから、指定した値だけを入れる
const CONFIG_ENV_KEYS = [
  "ROOT_MD", "OUT_DIR", "STYLE_FILE", "BASE_PATH", "SITE_ORIGIN", "LANG", "LANGUAGES", "NAV_ENABLED",
  "FAVICON_FILE", "SITE_NAME", "CUSTOM_DOMAIN", "OGP_DEFAULT_IMAGE", "THEME", "STYLE_DIR", "STRICT_LINKS",
  "SITEMAP_JSON", "LAST_UPDATED", "EDIT_LINK", "REPO_LINK", "REPO_VERSION", "REPO_LICENSE", "LLMS_TXT",
];

// ---------- 見本のサイトをビルドする(test/golden.test.mjs の runGoldenBuild と同じ置き方) ----------
function buildDemoSite(workDir) {
  const siteSrc = path.join(workDir, "demo");
  fs.cpSync(DEMO_DIR, siteSrc, { recursive: true });
  fs.mkdirSync(path.join(siteSrc, "styles"), { recursive: true });
  fs.copyFileSync(path.join(STYLES_DIR, "base.css"), path.join(siteSrc, "styles", "base.css"));
  fs.mkdirSync(path.join(siteSrc, ".github", "tsuzuri", "styles"), { recursive: true });
  fs.copyFileSync(path.join(STYLES_DIR, "default.css"), path.join(siteSrc, ".github", "tsuzuri", "styles", "default.css"));
  const env = { ...process.env };
  for (const key of Object.keys(env)) {
    if (CONFIG_ENV_KEYS.includes(key) || key.startsWith("GITHUB_") || key.startsWith("GIT_")) delete env[key];
  }
  Object.assign(env, {
    ROOT_MD: "README.md",
    THEME: "default.css",
    NAV_ENABLED: "true",
    LANGUAGES: "en",
    SITE_NAME: "Pocket Timer",
    LAST_UPDATED: "false",
    EDIT_LINK: "false",
    REPO_LINK: "false",
    STRICT_LINKS: "true",
  });
  const result = spawnSync(process.execPath, [BUILD_SCRIPT], { cwd: siteSrc, env, encoding: "utf-8" });
  if (result.status !== 0) throw new Error(`見本のサイトのビルドに失敗しました\n${result.stdout}\n${result.stderr}`);
  return path.join(siteSrc, "_site");
}

// ---------- ビルドしたサイトを 127.0.0.1 の空いているポートで配信する ----------
const CONTENT_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".xml": "application/xml",
  ".txt": "text/plain; charset=utf-8",
};

function serve(siteDir) {
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
async function launchChrome(profileDir) {
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

async function connect(wsUrl) {
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
async function openPage(cdp) {
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

// ---------- Before と After を撮る ----------
async function captureBefore(page, scheme) {
  // 幅は SHOT のまま(GitHub の配置は変わらない)、高さだけ広げ、撮る範囲が画面の中に収まるようにする
  await page.setView({ width: SHOT.width, height: BEFORE_VIEW_HEIGHT }, scheme);
  await page.goto(BEFORE_URL, 3000);
  const rect = await page.evaluate(`(() => {
    const el = document.querySelector("article.markdown-body");
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: r.left + window.scrollX, y: r.top + window.scrollY, width: r.width };
  })()`);
  if (!rect) throw new Error(`GitHub の画面に README の本文(article.markdown-body)が見つかりません: ${BEFORE_URL}`);
  // 本文の周りを 24px ずつ広げ、16:10 で撮る(GitHub のヘッダーとロゴは入らない)
  const width = rect.width + 48;
  const clip = { x: rect.x - 24, y: rect.y - 24, width, height: (width * 10) / 16 };
  if (clip.x < 0 || clip.x + clip.width > SHOT.width || clip.y < 0 || clip.y + clip.height > BEFORE_VIEW_HEIGHT) {
    throw new Error(`GitHub の画面の配置が想定と違い、README の本文を撮れません: ${JSON.stringify(clip)}`);
  }
  return page.screenshot(clip);
}

async function captureAfter(page, scheme, siteUrl) {
  await page.setView(SHOT, scheme);
  await page.goto(siteUrl, 1000);
  return page.screenshot();
}

// ---------- コマを作る ----------
const dataUrl = (png) => `data:image/png;base64,${png.toString("base64")}`;
const FONT = `-apple-system, BlinkMacSystemFont, "Segoe UI", "Helvetica Neue", Arial, sans-serif`;

function frameHtml(before, after) {
  return `<!doctype html><html><head><meta charset="utf-8"><style>
html, body { margin: 0; width: ${FRAME.width}px; height: ${FRAME.height}px; overflow: hidden; background: #000; }
body { --p: 0; --a: 1; --line: 0; --label-after: 0; font-family: ${FONT}; }
.layer { position: absolute; inset: 0; width: ${FRAME.width}px; height: ${FRAME.height}px; object-fit: cover; object-position: top; }
#after { clip-path: inset(0 calc(100% - var(--p) * 100%) 0 0); opacity: var(--a); }
#line { position: absolute; top: 0; bottom: 0; left: calc(var(--p) * 100% - 1.5px); width: 3px; background: ${FLAME}; opacity: var(--line); }
.label { position: absolute; right: 16px; bottom: 16px; padding: 6px 14px; border-radius: 999px; font-size: 15px; font-weight: 600; color: #fff; background: rgba(15, 23, 42, 0.85); }
#label-before { opacity: calc(1 - var(--label-after)); }
#label-after { opacity: var(--label-after); }
</style></head><body>
<img id="before" class="layer" src="${dataUrl(before)}" alt="">
<img id="after" class="layer" src="${dataUrl(after)}" alt="">
<div id="line"></div>
<div id="label-before" class="label">README.md on GitHub</div>
<div id="label-after" class="label">Your site, built by Tsuzuri</div>
</body></html>`;
}

// コマごとの値(p: After が現れた割合、a: After の不透明度、line: 境目の線)。
// ラベルは重ねず、After が半分を超えたところで切り替える
function frameStates() {
  const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);
  const states = [];
  for (let i = 0; i < 15; i++) states.push({ p: 0, a: 1, line: 0 }); // 1.5秒: Before
  for (let i = 1; i <= 8; i++) states.push({ p: ease(i / 8), a: 1, line: i < 8 ? 1 : 0 }); // 0.8秒: 左から右へ After
  for (let i = 0; i < 30; i++) states.push({ p: 1, a: 1, line: 0 }); // 3秒: After
  for (let i = 1; i <= 5; i++) states.push({ p: 1, a: 1 - i / 5, line: 0 }); // 0.5秒: Before へ戻る
  return states;
}

function stillHtml(before, after, scheme) {
  const dark = scheme === "dark";
  const bg = dark ? "#0d1117" : "#f6f8fa";
  const fg = dark ? "#e6edf3" : "#1f2328";
  return `<!doctype html><html><head><meta charset="utf-8"><style>
html, body { margin: 0; width: ${FRAME.width}px; height: ${FRAME.height}px; overflow: hidden; background: ${bg}; color: ${fg}; font-family: ${FONT}; }
.row { display: flex; align-items: center; justify-content: center; gap: 20px; height: 100%; }
figure { margin: 0; width: 400px; }
img { display: block; width: 400px; height: 250px; object-fit: cover; object-position: top; border-radius: 10px; box-shadow: 0 6px 24px rgba(0, 0, 0, ${dark ? 0.5 : 0.18}); }
figcaption { margin-top: 12px; font-size: 15px; font-weight: 600; text-align: center; }
.arrow { font-size: 40px; font-weight: 700; color: ${FLAME}; }
</style></head><body><div class="row">
<figure><img src="${dataUrl(before)}" alt=""><figcaption>README.md on GitHub</figcaption></figure>
<div class="arrow">→</div>
<figure><img src="${dataUrl(after)}" alt=""><figcaption>Your site, built by Tsuzuri</figcaption></figure>
</div></body></html>`;
}

async function makeOutputs(page, scheme, before, after, workDir) {
  // アニメーションのコマ
  await page.setView(FRAME, scheme);
  await page.setContent(frameHtml(before, after));
  const framesDir = path.join(workDir, `frames-${scheme}`);
  fs.mkdirSync(framesDir);
  const files = [];
  for (const [i, s] of frameStates().entries()) {
    await page.evaluate(`(() => {
      const st = document.body.style;
      st.setProperty("--p", "${s.p}");
      st.setProperty("--a", "${s.a}");
      st.setProperty("--line", "${s.line}");
      st.setProperty("--label-after", "${s.p * s.a >= 0.5 ? 1 : 0}");
    })()`);
    await page.nextPaint();
    const file = path.join(framesDir, `${String(i).padStart(3, "0")}.png`);
    fs.writeFileSync(file, await page.screenshot());
    files.push(file);
  }
  const gif = path.join(OUT_DIR, `readme-to-site-${scheme}.gif`);
  const result = spawnSync("gifski", ["--fps", String(FPS), "--quality", "100", "--width", String(FRAME.width), "-o", gif, ...files], {
    encoding: "utf-8",
  });
  if (result.error) throw new Error(`gifski を実行できませんでした(${result.error.message})。gifski を入れてください(macOS なら brew install gifski)`);
  if (result.status !== 0) throw new Error(`gifski が失敗しました\n${result.stderr}`);

  // 動きを減らす設定の人向けの、止まった画像
  await page.setContent(stillHtml(before, after, scheme));
  const png = path.join(OUT_DIR, `readme-to-site-${scheme}.png`);
  fs.writeFileSync(png, await page.screenshot());
  return [gif, png];
}

// ---------- 全体の流れ ----------
async function main() {
  const workDir = fs.mkdtempSync(path.join(os.tmpdir(), "tsuzuri-hero-"));
  let server;
  let chrome;
  let cdp;
  try {
    const siteDir = buildDemoSite(workDir);
    server = await serve(siteDir);
    const siteUrl = `http://127.0.0.1:${server.address().port}/`;
    const profileDir = path.join(workDir, "chrome-profile");
    fs.mkdirSync(profileDir);
    const launched = await launchChrome(profileDir);
    chrome = launched.chrome;
    cdp = await connect(launched.wsUrl);
    const page = await openPage(cdp);
    const written = [];
    for (const scheme of ["light", "dark"]) {
      const before = await captureBefore(page, scheme);
      const after = await captureAfter(page, scheme, siteUrl);
      written.push(...(await makeOutputs(page, scheme, before, after, workDir)));
    }
    for (const file of written) console.log(`${path.relative(ROOT, file)}: ${fs.statSync(file).size} bytes`);
  } finally {
    cdp?.ws.close();
    chrome?.kill();
    server?.close();
    fs.rmSync(workDir, { recursive: true, force: true });
  }
}

main().catch((err) => {
  console.error(err.message);
  process.exitCode = 1;
});
