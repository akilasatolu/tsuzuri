/**
 * config.mjs
 *
 * 環境変数から設定値を読み込み、バリデーションを行う純粋関数モジュール。
 * ファイルI/Oは行わず、不正な値が渡されても例外を投げずに console.warn を出しつつ
 * 安全なデフォルト値へフォールバックする(fail-open方針)。
 *
 * 設計書「主要データエンティティ > Configオブジェクト」「モジュール別詳細設計 >
 * config.mjs」節に基づく実装。
 */

import path from "node:path";
import { normalizeBasePath } from "./path-utils.mjs";

// frontmatterの `theme` キー(ページ単位のテーマ上書き)からも参照するため export する。
// この配列に含まれない値は「組み込みテーマ名ではなく、リポジトリルートからの
// 相対パスで指定された独自CSSファイル」とみなされる(build-docs.mjs側の判定基準)。
export const ALLOWED_THEMES = ["material", "glass", "neumorphism", "editorial", "minimal", "blueprint", "nineties", "none"];
const HOSTNAME_RE = /^[a-zA-Z0-9.-]+$/;
// BCP 47 形式の言語タグ(例: "ja" / "en" / "en-US" / "zh-Hant-TW")の簡易チェック。
// "en_US" のような書き間違いを弾く。
export const LANG_TAG_RE = /^[a-zA-Z]{2,3}(-[a-zA-Z0-9]{2,8})*$/;

/**
 * @typedef {object} Config
 * @property {string} rootMd
 * @property {string} outDir
 * @property {string} styleFile
 * @property {string} basePath
 * @property {string} siteOrigin
 * @property {string} lang - 基本言語(languages の先頭)
 * @property {string[]} languages - サイトの言語(1つ以上。先頭が基本言語)
 * @property {boolean} navEnabled
 * @property {boolean} strictLinks
 * @property {boolean} sitemapJson
 * @property {boolean} lastUpdated
 * @property {string} faviconFile
 * @property {string} siteName
 * @property {string} customDomain
 * @property {string} ogDefaultImage
 * @property {string} theme
 * @property {string} styleDir
 */

// 設定ファイル(.github/docs-pages.config)に書けるキー。ワークフローの Load config と同じ一覧
export const CONFIG_FILE_KEYS = [
  "TRIGGER_BRANCH",
  "ROOT_MD",
  "OUT_DIR",
  "STYLE_FILE",
  "LANGUAGES",
  "NAV_ENABLED",
  "FAVICON_FILE",
  "SITE_NAME",
  "CUSTOM_DOMAIN",
  "OGP_DEFAULT_IMAGE",
  "THEME",
  "STRICT_LINKS",
  "SITEMAP_JSON",
  "LAST_UPDATED",
];

// 設定ファイルの本文を { KEY: 値 } にする(ワークフローの Load config と同じ読み方)。
//   - "#" で始まる行と空行は読み飛ばす。値の前後の空白は取り除く
//   - 一覧にないキーは無視する
//   - LANG は廃止したキー。書かれていたら1回だけ警告して無視する
export function parseConfigText(text) {
  const values = {};
  let warnedLang = false;
  for (const rawLine of text.replace(/^\uFEFF/, "").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq < 0) continue;
    const key = line.slice(0, eq).trim();
    if (key === "LANG") {
      if (!warnedLang) {
        console.warn(
          "[config] LANG は廃止しました。LANGUAGES に書いてください(例: LANGUAGES=ja。先頭が基本言語)。この行は無視します。"
        );
        warnedLang = true;
      }
      continue;
    }
    if (CONFIG_FILE_KEYS.includes(key)) values[key] = line.slice(eq + 1).trim();
  }
  return values;
}

// 手元でビルドするときに、設定ファイルの値を環境変数の既定値として使う。
// GitHub Actions では、ワークフローが設定ファイルの値を環境変数で渡すので何もしない。
//   - 環境変数で指定したキーは、環境変数の値を優先する(試しに値を変えてビルドできるように)
//
// @param {NodeJS.ProcessEnv} env
// @param {Record<string, string>} fileValues - parseConfigText の結果
// @returns {NodeJS.ProcessEnv}
export function withConfigFileDefaults(env, fileValues) {
  if (env.GITHUB_ACTIONS === "true") return env;
  const merged = { ...env };
  for (const [key, value] of Object.entries(fileValues)) {
    if (env[key] === undefined) merged[key] = value;
  }
  return merged;
}

// 環境変数オブジェクトから設定値を読み込み、検証・デフォルト適用を行う。
// 例外を投げず、ファイルI/O も行わない純粋関数。
//
// @param {NodeJS.ProcessEnv} env
// @returns {Config}
export function loadConfig(env = process.env) {
  // "./README.md" や "docs\\index.md" のような書き方でも、リンクから解決したパス("README.md")と
  // 同じ表記になるよう正規化する(そうしないと起点ページが別のページとして二重に扱われる)。
  const rootMd = normalizeRootMd(trimOr(env.ROOT_MD, "README.md"));
  const outDir = trimOr(env.OUT_DIR, "_site");
  // init が生成する設定ファイルと同じ既定値(組み込みテーマCSSと同じディレクトリの custom.css)
  const styleFile = trimOr(env.STYLE_FILE, ".github/tsuzuri/styles/custom.css");
  const siteOrigin = trimOr(env.SITE_ORIGIN, "");
  const faviconFile = trimOr(env.FAVICON_FILE, "");
  const ogDefaultImage = trimOr(env.OGP_DEFAULT_IMAGE, "");

  const basePath = normalizeBasePath((env.BASE_PATH ?? "").trim());

  // OS の環境変数 LANG("ja_JP.UTF-8" など)は読まない(設定キー LANG は廃止した)
  const languages = resolveLanguages(env.LANGUAGES);
  const lang = languages[0];

  const navEnabled = parseBoolean("NAV_ENABLED", env.NAV_ENABLED);

  // true のとき、リンク切れ・拒否したリンクがあればビルドを失敗させる(公開を止める)
  const strictLinks = parseBoolean("STRICT_LINKS", env.STRICT_LINKS);

  // true のとき、デバッグ用の sitemap.json を出力先に書き出す(公開サイトに含まれる)。
  // リンク切れ・拒否したリンクのパス等も含むため、既定では出力しない。
  const sitemapJson = parseBoolean("SITEMAP_JSON", env.SITEMAP_JSON);

  // true のとき、各ページに git の履歴から求めた最終更新日を表示する
  const lastUpdated = parseBoolean("LAST_UPDATED", env.LAST_UPDATED);

  const siteName = resolveSiteName(env);

  const customDomain = resolveCustomDomain(env.CUSTOM_DOMAIN);

  const theme = resolveTheme(env.THEME);

  const styleDir = trimOr(env.STYLE_DIR, "styles");

  return {
    rootMd,
    outDir,
    styleFile,
    basePath,
    siteOrigin,
    lang,
    languages,
    navEnabled,
    strictLinks,
    sitemapJson,
    lastUpdated,
    faviconFile,
    siteName,
    customDomain,
    ogDefaultImage,
    theme,
    styleDir,
  };
}

function normalizeRootMd(raw) {
  const normalized = path.posix.normalize(raw.replace(/\\/g, "/")).replace(/^(\.\/)+/, "").replace(/^\/+/, "");
  return normalized || "README.md";
}

// 値をtrimし、空ならデフォルト値を返す。未設定(undefined/null)も空扱い。
function trimOr(raw, fallback) {
  const trimmed = (raw ?? "").trim();
  return trimmed || fallback;
}

// true/false の設定値を読む。大文字小文字は区別しない。
// 省略(未設定・空文字)は既定値 false として黙って扱い、不正値のときだけ warn する。
function parseBoolean(name, raw) {
  const trimmed = (raw ?? "").trim().toLowerCase();
  if (trimmed === "true") return true;
  if (trimmed === "false" || trimmed === "") return false;
  console.warn(
    `[config] ${name} の値が不正です("${raw ?? ""}")。false にフォールバックします。`
  );
  return false;
}

function resolveSiteName(env) {
  const siteName = (env.SITE_NAME ?? "").trim();
  if (siteName) return siteName;
  const repo = (env.GITHUB_REPOSITORY ?? "").trim();
  if (repo) {
    const name = repo.split("/")[1];
    if (name) return name;
  }
  return "";
}

/**
 * LANGUAGES を読む。常に1つ以上の言語タグの配列を返す(先頭が基本言語)。
 *   - カンマで分け、各要素の前後の空白を取り除き、空の要素は捨てる。何も無ければ ["en"](警告なし)
 *   - 言語タグとして不正な要素・大文字小文字を区別せず重複する要素は、警告して捨てる
 *   - 残りが0なら警告して ["en"]
 * @param {string|undefined} raw - env.LANGUAGES
 * @returns {string[]}
 */
export function resolveLanguages(raw) {
  const items = (raw ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item !== "");
  if (items.length === 0) return ["en"];
  const languages = [];
  const seen = new Set();
  for (const item of items) {
    if (!LANG_TAG_RE.test(item)) {
      console.warn(`[config] LANGUAGES の "${item}" は言語タグとして不正なため無視します。`);
      continue;
    }
    const lower = item.toLowerCase();
    if (seen.has(lower)) {
      console.warn(`[config] LANGUAGES の "${item}" が重複しているため無視します。`);
      continue;
    }
    seen.add(lower);
    languages.push(item);
  }
  if (languages.length === 0) {
    console.warn('[config] LANGUAGES に正しい言語タグがありません。"en" にします。');
    return ["en"];
  }
  return languages;
}

function resolveCustomDomain(raw) {
  const trimmed = (raw ?? "").trim();
  if (!trimmed) return "";
  if (HOSTNAME_RE.test(trimmed)) return trimmed;
  console.warn(
    `[config] CUSTOM_DOMAIN の値が不正です("${trimmed}")。空文字にフォールバックします。`
  );
  return "";
}

// 省略(未設定・空文字)は既定値 "material" として黙って扱い、不正値のときだけ warn する。
function resolveTheme(raw) {
  const trimmed = (raw ?? "").trim();
  if (trimmed === "") return "material";
  if (ALLOWED_THEMES.includes(trimmed)) return trimmed;
  console.warn(
    `[config] THEME の値が不正です("${trimmed}")。"material" にフォールバックします。`
  );
  return "material";
}
