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

import { normalizeBasePath } from "./path-utils.mjs";

// frontmatterの `theme` キー(ページ単位のテーマ上書き)からも参照するため export する。
// この配列に含まれない値は「組み込みテーマ名ではなく、リポジトリルートからの
// 相対パスで指定された独自CSSファイル」とみなされる(build-docs.mjs側の判定基準)。
export const ALLOWED_THEMES = ["wa", "muji", "sumi", "ai", "shu", "none"];
const HOSTNAME_RE = /^[a-zA-Z0-9.-]+$/;

/**
 * @typedef {object} Config
 * @property {string} rootMd
 * @property {string} outDir
 * @property {string} styleFile
 * @property {string} basePath
 * @property {string} siteOrigin
 * @property {string} lang
 * @property {boolean} navEnabled
 * @property {string} faviconFile
 * @property {string} siteName
 * @property {string} customDomain
 * @property {string} ogDefaultImage
 * @property {string} theme
 * @property {string} styleDir
 */

// 環境変数オブジェクトから設定値を読み込み、検証・デフォルト適用を行う。
// 例外を投げず、ファイルI/O も行わない純粋関数。
//
// @param {NodeJS.ProcessEnv} env
// @returns {Config}
export function loadConfig(env = process.env) {
  const rootMd = trimOr(env.ROOT_MD, "README.md");
  const outDir = trimOr(env.OUT_DIR, "_site");
  const styleFile = trimOr(env.STYLE_FILE, ".github/docs-pages.style.css");
  const siteOrigin = trimOr(env.SITE_ORIGIN, "");
  const faviconFile = trimOr(env.FAVICON_FILE, "");
  const ogDefaultImage = trimOr(env.OGP_DEFAULT_IMAGE, "");

  const basePath = normalizeBasePath((env.BASE_PATH ?? "").trim());

  const lang = trimOr(env.LANG, "ja");

  const navEnabled = parseNavEnabled(env.NAV_ENABLED);

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
    navEnabled,
    faviconFile,
    siteName,
    customDomain,
    ogDefaultImage,
    theme,
    styleDir,
  };
}

// 値をtrimし、空ならデフォルト値を返す。未設定(undefined/null)も空扱い。
function trimOr(raw, fallback) {
  const trimmed = (raw ?? "").trim();
  return trimmed || fallback;
}

function parseNavEnabled(raw) {
  const trimmed = (raw ?? "").trim().toLowerCase();
  if (trimmed === "true") return true;
  if (trimmed === "false") return false;
  console.warn(
    `[config] NAV_ENABLED の値が不正です("${raw ?? ""}")。false にフォールバックします。`
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

function resolveCustomDomain(raw) {
  const trimmed = (raw ?? "").trim();
  if (!trimmed) return "";
  if (HOSTNAME_RE.test(trimmed)) return trimmed;
  console.warn(
    `[config] CUSTOM_DOMAIN の値が不正です("${trimmed}")。空文字にフォールバックします。`
  );
  return "";
}

function resolveTheme(raw) {
  const trimmed = (raw ?? "").trim();
  if (ALLOWED_THEMES.includes(trimmed)) return trimmed;
  console.warn(
    `[config] THEME の値が不正です("${trimmed}")。"wa" にフォールバックします。`
  );
  return "wa";
}
