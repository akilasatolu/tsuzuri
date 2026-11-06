#!/usr/bin/env node
// ギャラリーのスクリーンショット(assets/gallery/<スタイル>-<light|dark>.png)を撮り直す。
//   node scripts/make-gallery-shots.mjs
//
// 作るもの(どれも 1280×800。assets/gallery/ に上書きする):
//   - このサイトの gallery/<スタイル>.html(英語のページ)の最初の画面を、ライトとダークで撮ったもの
//     ライトとダーク: default、glass、neumorphism、editorial、minimal、kintsugi、tsuzuri
//     ライトだけ: blueprint、nineties、none
//
// 前提:
//   - Google Chrome があること。場所は環境変数 CHROME_PATH で変えられる(既定は macOS の /Applications の場所)
//   - .github/tsuzuri/node_modules があること(ビルドの依存。cd .github/tsuzuri && npm ci)
//
// スタイル(.github/tsuzuri/styles/、styles/base.css)やナビ・ギャラリーのページを変えたときに実行し、
// できた画像を同じコミットに入れる。

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import { serve, launchChrome, connect, openPage } from "./lib/browser-shot.mjs";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const OUT_DIR = path.join(ROOT, "assets/gallery");
const SHOT = { width: 1280, height: 800 };

// 撮るスタイルと配色(今ある画像と同じ組み合わせ)
const SHOTS = [
  ...["default", "glass", "neumorphism", "editorial", "minimal", "kintsugi", "tsuzuri"].flatMap((style) => [
    { style, scheme: "light" },
    { style, scheme: "dark" },
  ]),
  ...["blueprint", "nineties", "none"].map((style) => ({ style, scheme: "light" })),
];

// 設定に関わる環境変数(test/golden.test.mjs の CONFIG_ENV_KEYS と同じ)。ビルドの前にすべて消す
const CONFIG_ENV_KEYS = [
  "ROOT_MD", "OUT_DIR", "STYLE_FILE", "BASE_PATH", "SITE_ORIGIN", "LANG", "LANGUAGES", "NAV_ENABLED",
  "FAVICON_FILE", "SITE_NAME", "CUSTOM_DOMAIN", "OGP_DEFAULT_IMAGE", "THEME", "STYLE_DIR", "STRICT_LINKS",
  "SITEMAP_JSON", "LAST_UPDATED", "EDIT_LINK", "REPO_LINK", "REPO_VERSION", "REPO_LICENSE", "LLMS_TXT",
];

// ---------- このサイトを、リポジトリの写しでビルドする ----------
function buildSite(workDir) {
  const siteSrc = path.join(workDir, "repo");
  // .git、node_modules、_site は写さない(ただし .github/tsuzuri/node_modules はビルドの依存なので写す)
  const skip = new Set([".git", "_site", "node_modules"]);
  fs.cpSync(ROOT, siteSrc, {
    recursive: true,
    filter: (src) => {
      const rel = path.relative(ROOT, src);
      if (rel === path.join(".github", "tsuzuri", "node_modules") || rel.startsWith(path.join(".github", "tsuzuri", "node_modules") + path.sep)) return true;
      return !rel.split(path.sep).some((part) => skip.has(part));
    },
  });
  const env = { ...process.env };
  for (const key of Object.keys(env)) {
    if (CONFIG_ENV_KEYS.includes(key) || key.startsWith("GITHUB_") || key.startsWith("GIT_")) delete env[key];
  }
  // .git が無いので、git の情報を使う項目は切る。ほかは .github/tsuzuri/config のまま
  Object.assign(env, { LAST_UPDATED: "false", EDIT_LINK: "false", REPO_LINK: "false" });
  const script = path.join(siteSrc, ".github", "tsuzuri", "build-docs.mjs");
  const result = spawnSync(process.execPath, [script], { cwd: siteSrc, env, encoding: "utf-8" });
  if (result.status !== 0) throw new Error(`サイトのビルドに失敗しました\n${result.stdout}\n${result.stderr}`);
  return path.join(siteSrc, "_site");
}

// ---------- 全体の流れ ----------
async function main() {
  const workDir = fs.mkdtempSync(path.join(os.tmpdir(), "tsuzuri-gallery-"));
  let server;
  let chrome;
  let cdp;
  try {
    const siteDir = buildSite(workDir);
    server = await serve(siteDir);
    const siteUrl = `http://127.0.0.1:${server.address().port}/`;
    const profileDir = path.join(workDir, "chrome-profile");
    fs.mkdirSync(profileDir);
    const launched = await launchChrome(profileDir);
    chrome = launched.chrome;
    cdp = await connect(launched.wsUrl);
    const page = await openPage(cdp);
    for (const { style, scheme } of SHOTS) {
      const url = `${siteUrl}gallery/${style}.html`;
      await page.setView(SHOT, scheme);
      await page.goto(url, 1000);
      await page.nextPaint();
      const file = path.join(OUT_DIR, `${style}-${scheme}.png`);
      fs.writeFileSync(file, await page.screenshot());
      console.log(`${path.relative(ROOT, file)}: ${fs.statSync(file).size} bytes`);
    }
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
