#!/usr/bin/env node
// トップページのヒーローの画像(GitHub で見た README が、Tsuzuri の default のサイトに変わる GIF)を作り直す。
//   node scripts/make-hero-gif.mjs
//
// 作るもの(どれも 960×600。assets/hero/ に書き出す):
//   - readme-to-site-light.gif / readme-to-site-dark.gif: Before(GitHub の README)を上から下までスクロールし、
//     左から右へ After(サイト)に切り替えて、サイトを上から下までスクロールするアニメーション(約14秒。1つ 4MB 以下)
//   - readme-to-site-light.png / readme-to-site-dark.png: 動きを減らす設定の人向けの、Before と After の最初の画面を並べた止まった画像
//
// 前提:
//   - gifski が PATH にあること(macOS なら brew install gifski)
//   - Google Chrome があること。場所は環境変数 CHROME_PATH で変えられる(既定は macOS の /Applications の場所)
//   - Before は GitHub 上の assets/hero/demo/README.md(main ブランチ)を撮る。見本を変えたら、push してから実行する
//
// 見本(assets/hero/demo/)、default.css、base.css を変えたときに実行し、できた画像を同じコミットに入れる。

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import { serve, launchChrome, connect, openPage } from "./lib/browser-shot.mjs";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const DEMO_DIR = path.join(ROOT, "assets/hero/demo");
const OUT_DIR = path.join(ROOT, "assets/hero");
const BUILD_SCRIPT = path.join(ROOT, ".github/scripts/build-docs.mjs");
const STYLES_DIR = path.join(ROOT, "styles");
const BEFORE_URL = "https://github.com/akilasatolu/tsuzuri/blob/main/assets/hero/demo/README.md";

const SHOT = { width: 1280, height: 800 }; // Before・After を撮る画面の大きさ(16:10)
const FRAME = { width: 960, height: 600 }; // GIF の1コマの大きさ
const BEFORE_VIEW_HEIGHT = 1400; // Before の本文の高さを測るときの、最初の画面の高さ
const MAX_GIF_BYTES = 4 * 1024 * 1024; // GIF 1つの重さの上限
// 上限を超えたら、上から順に試す(fps を下げるときは、各区間の秒数を保ってコマの数を減らす)
const ATTEMPTS = [
  { fps: 10, quality: 100 },
  { fps: 10, quality: 90 },
  { fps: 8, quality: 90 },
];
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

// ---------- Before と After を撮る ----------
// Before: GitHub の README の本文の全体を1枚に撮る
async function captureBefore(page, scheme) {
  const measure = () =>
    page.evaluate(`(() => {
      const el = document.querySelector("article.markdown-body");
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x: r.left + window.scrollX, y: r.top + window.scrollY, width: r.width, height: r.height };
    })()`);
  // 幅は SHOT のまま(GitHub の配置は変わらない)。高さを、本文の下端が入るまで広げてから測り直す
  await page.setView({ width: SHOT.width, height: BEFORE_VIEW_HEIGHT }, scheme);
  await page.goto(BEFORE_URL, 3000);
  let rect = await measure();
  if (!rect) throw new Error(`GitHub の画面に README の本文(article.markdown-body)が見つかりません: ${BEFORE_URL}`);
  const viewHeight = Math.ceil(Math.max(BEFORE_VIEW_HEIGHT, rect.y + rect.height + 24));
  await page.setView({ width: SHOT.width, height: viewHeight }, scheme);
  await page.nextPaint();
  rect = await measure();
  // 本文の周りを 24px ずつ広げて撮る(GitHub のヘッダーとロゴは入らない)
  const clip = { x: rect.x - 24, y: rect.y - 24, width: rect.width + 48, height: rect.height + 48 };
  if (clip.x < 0 || clip.x + clip.width > SHOT.width || clip.y < 0 || clip.y + clip.height > viewHeight) {
    throw new Error(`GitHub の画面の配置が想定と違い、README の本文を撮れません: ${JSON.stringify(clip)}`);
  }
  return { png: await page.screenshot(clip), width: clip.width, height: clip.height };
}

// After: サイトのトップを開き、ページ自体を positions(0〜1 の割合)の位置へスクロールしながら画面を撮る。
// ナビ(position: sticky)は画面に残ったまま、本文だけが流れる
async function captureAfter(page, scheme, siteUrl, positions) {
  await page.setView(SHOT, scheme);
  await page.goto(siteUrl, 1000);
  const max = await page.evaluate(`Math.max(0, document.documentElement.scrollHeight - ${SHOT.height})`);
  const shots = [];
  for (const t of positions) {
    await page.evaluate(`window.scrollTo({ top: ${Math.round(t * max)}, behavior: "instant" })`);
    await page.nextPaint();
    shots.push(await page.screenshot());
  }
  return shots;
}

// ---------- コマを作る ----------
const dataUrl = (png) => `data:image/png;base64,${png.toString("base64")}`;
const FONT = `-apple-system, BlinkMacSystemFont, "Segoe UI", "Helvetica Neue", Arial, sans-serif`;
const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);

// Before は横幅を FRAME に縮めた全体の画像を、--by(px)だけ上にずらしてスクロールを表す。
// After はコマごとに src を、その位置で撮った画面に替える
function frameHtml(before, afterTop) {
  return `<!doctype html><html><head><meta charset="utf-8"><style>
html, body { margin: 0; width: ${FRAME.width}px; height: ${FRAME.height}px; overflow: hidden; background: #000; }
body { --p: 0; --a: 1; --line: 0; --label-after: 0; --by: 0; font-family: ${FONT}; }
.layer { position: absolute; inset: 0; width: ${FRAME.width}px; height: ${FRAME.height}px; overflow: hidden; }
#before img { display: block; width: ${FRAME.width}px; height: auto; transform: translateY(calc(var(--by) * -1px)); }
#after { object-fit: cover; object-position: top; clip-path: inset(0 calc(100% - var(--p) * 100%) 0 0); opacity: var(--a); }
#line { position: absolute; top: 0; bottom: 0; left: calc(var(--p) * 100% - 1.5px); width: 3px; background: ${FLAME}; opacity: var(--line); }
.label { position: absolute; right: 16px; bottom: 16px; padding: 6px 14px; border-radius: 999px; font-size: 15px; font-weight: 600; color: #fff; background: rgba(15, 23, 42, 0.85); }
#label-before { opacity: calc(1 - var(--label-after)); }
#label-after { opacity: var(--label-after); }
</style></head><body>
<div id="before" class="layer"><img src="${dataUrl(before)}" alt=""></div>
<img id="after" class="layer" src="${dataUrl(afterTop)}" alt="">
<div id="line"></div>
<div id="label-before" class="label">README.md on GitHub</div>
<div id="label-after" class="label">Your site, built by Tsuzuri</div>
</body></html>`;
}

// コマごとの値(b: Before のスクロールの割合、s: After の画面の番号、p: After が現れた割合、a: After の不透明度、line: 境目の線)。
// 区間の秒数は fps によらず同じ。ラベルは重ねず、After が半分を超えたところで切り替える
function timeline(fps) {
  const n = (sec) => Math.max(1, Math.round(sec * fps));
  const scroll = n(4.0);
  const states = [];
  const push = (count, fn) => {
    for (let i = 1; i <= count; i++) states.push(fn(i, count));
  };
  push(n(1.0), () => ({ b: 0, s: 0, p: 0, a: 1, line: 0 })); // Before の上で止まる
  push(scroll, (i, c) => ({ b: ease(i / c), s: 0, p: 0, a: 1, line: 0 })); // Before を下までスクロール
  push(n(1.0), () => ({ b: 1, s: 0, p: 0, a: 1, line: 0 })); // Before の下で止まる
  push(n(0.5), (i, c) => ({ b: 1 - ease(i / c), s: 0, p: 0, a: 1, line: 0 })); // Before の上へ戻る
  push(n(0.8), (i, c) => ({ b: 0, s: 0, p: ease(i / c), a: 1, line: i < c ? 1 : 0 })); // 左から右へ After に切り替える
  push(n(1.0), () => ({ b: 0, s: 0, p: 1, a: 1, line: 0 })); // After の上で止まる
  push(scroll, (i) => ({ b: 0, s: i, p: 1, a: 1, line: 0 })); // After を下までスクロール
  push(n(1.0), () => ({ b: 0, s: scroll, p: 1, a: 1, line: 0 })); // After の下で止まる
  push(n(0.5), (i, c) => ({ b: 0, s: scroll, p: 1, a: 1 - i / c, line: 0 })); // Before の上へクロスフェードで戻る
  // After を撮る位置(0 = 上、1 = 下)。s 番目のコマは positions[s] の画面を使う
  const positions = [0];
  for (let i = 1; i <= scroll; i++) positions.push(ease(i / scroll));
  return { states, positions };
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

// アニメーションのコマを書き出し、GIF にする。上限を超えたら ATTEMPTS の次を試す
async function makeGif(page, scheme, before, siteUrl, workDir) {
  // Before をどれだけスクロールできるか(横幅を FRAME に縮めたあとの高さ − FRAME の高さ。短ければ 0)
  const beforeMax = Math.max(0, (before.height * FRAME.width) / before.width - FRAME.height);
  const gif = path.join(OUT_DIR, `readme-to-site-${scheme}.gif`);
  for (const { fps, quality } of ATTEMPTS) {
    const { states, positions } = timeline(fps);
    const afterShots = await captureAfter(page, scheme, siteUrl, positions);
    await page.setView(FRAME, scheme);
    await page.setContent(frameHtml(before.png, afterShots[0]));
    const framesDir = fs.mkdtempSync(path.join(workDir, `frames-${scheme}-`));
    const files = [];
    let shown = 0;
    for (const [i, st] of states.entries()) {
      const src = st.s !== shown ? JSON.stringify(dataUrl(afterShots[st.s])) : "null";
      shown = st.s;
      await page.evaluate(`(async () => {
        const img = document.getElementById("after");
        const src = ${src};
        if (src) {
          img.src = src;
          await img.decode();
        }
        const s = document.body.style;
        s.setProperty("--by", "${(st.b * beforeMax).toFixed(2)}");
        s.setProperty("--p", "${st.p}");
        s.setProperty("--a", "${st.a}");
        s.setProperty("--line", "${st.line}");
        s.setProperty("--label-after", "${st.p * st.a >= 0.5 ? 1 : 0}");
      })()`);
      const file = path.join(framesDir, `${String(i).padStart(3, "0")}.png`);
      await page.nextPaint();
      fs.writeFileSync(file, await page.screenshot());
      files.push(file);
    }
    const args = ["--fps", String(fps), "--quality", String(quality), "--width", String(FRAME.width), "-o", gif, ...files];
    const result = spawnSync("gifski", args, { encoding: "utf-8" });
    if (result.error) throw new Error(`gifski を実行できませんでした(${result.error.message})。gifski を入れてください(macOS なら brew install gifski)`);
    if (result.status !== 0) throw new Error(`gifski が失敗しました\n${result.stderr}`);
    const size = fs.statSync(gif).size;
    console.log(`${path.relative(ROOT, gif)}: fps ${fps}, quality ${quality}, ${states.length} frames, ${size} bytes`);
    if (size <= MAX_GIF_BYTES) return { gif, afterTop: afterShots[0] };
  }
  throw new Error(`GIF が ${MAX_GIF_BYTES} bytes を超えました(${scheme})。設定を見直してください`);
}

async function makeOutputs(page, scheme, before, siteUrl, workDir) {
  const { gif, afterTop } = await makeGif(page, scheme, before, siteUrl, workDir);
  // 動きを減らす設定の人向けの、止まった画像(Before は全体の画像の上の部分だけが写る)
  await page.setView(FRAME, scheme);
  await page.setContent(stillHtml(before.png, afterTop, scheme));
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
      written.push(...(await makeOutputs(page, scheme, before, siteUrl, workDir)));
    }
    for (const file of written) console.log(`${path.relative(ROOT, file)}: ${fs.statSync(file).size} bytes`);
  } finally {
    cdp?.ws.close();
    // Chrome が終わるのを待ってから消す(終わる前に消すと、Chrome が書いているプロフィールが残って失敗する)
    if (chrome && chrome.exitCode === null && chrome.signalCode === null) {
      const exited = new Promise((resolve) => chrome.once("exit", resolve));
      chrome.kill();
      await exited;
    }
    server?.close();
    fs.rmSync(workDir, { recursive: true, force: true, maxRetries: 5 });
  }
}

main().catch((err) => {
  console.error(err.message);
  process.exitCode = 1;
});
