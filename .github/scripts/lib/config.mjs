/**
 * config.mjs
 *
 * 環境変数から設定値を読み込み、バリデーションを行う純粋関数モジュール。
 * ファイルI/Oは行わず、不正な値が渡されても例外を投げずに console.warn を出しつつ
 * 安全なデフォルト値へフォールバックする(fail-open方針)。
 */

import path from "node:path";
import { normalizeBasePath, isStyleFileName } from "./path-utils.mjs";

// 組み込みテーマ名の一覧。frontmatterの `theme` キー(ページ単位のテーマ上書き)が組み込みテーマ名か
// を判定するため、build-docs.mjs からも参照するので export する。`.css` で終わる `theme` の値は
// 独自CSSのファイル名(.github/tsuzuri/styles/ の中)として build-docs.mjs が別に扱う。
// そのため、ここの名前は `.css` で終わってはいけない(test/config.test.mjs が確かめる)。
// `.css` で終わらず、この配列にも無い値は、警告してサイト全体のTHEMEにフォールバックする。
export const ALLOWED_THEMES = ["material", "glass", "neumorphism", "editorial", "minimal", "kintsugi", "blueprint", "nineties", "none"];
const HOSTNAME_RE = /^[a-zA-Z0-9.-]+$/;
// BCP 47 形式の言語タグ(例: "ja" / "en" / "en-US" / "zh-Hant-TW")の簡易チェック。
// "en_US" のような書き間違いを弾く。
export const LANG_TAG_RE = /^[a-zA-Z]{2,3}(-[a-zA-Z0-9]{2,8})*$/;

/**
 * @typedef {object} Config
 * @property {string} rootMd
 * @property {string} outDir
 * @property {string} styleFile - 独自CSSのファイル名(.github/tsuzuri/styles/ の中。空なら独自CSSを使わない)
 * @property {string} basePath
 * @property {string} siteOrigin
 * @property {string[]} languages - サイトの言語(1つ以上。先頭が基本言語)
 * @property {boolean} navEnabled
 * @property {boolean} strictLinks
 * @property {boolean} sitemapJson
 * @property {boolean} lastUpdated
 * @property {boolean} editLink
 * @property {boolean} repoLink
 * @property {boolean} llmsTxt
 * @property {string} repoVersion
 * @property {string} repoLicense
 * @property {string} faviconFile
 * @property {string} siteName
 * @property {string} customDomain
 * @property {string} ogDefaultImage
 * @property {string} theme
 * @property {string} styleDir
 */

// 利用者のリポジトリでの、Tsuzuri のファイルの置き場所
export const VENDOR_DIR = ".github/tsuzuri"; // ビルドスクリプト一式・組み込みテーマCSS・ビルド用の依存、設定ファイル(config)、独自CSS(styles/custom.css)
export const WORKFLOW_PATH = ".github/workflows/tsuzuri-pages.yml"; // 生成するワークフロー
export const CONFIG_FILE_PATH = `${VENDOR_DIR}/config`; // 設定ファイル(利用者が編集する。VENDOR_DIR の中で編集してよいのは、これと、styles/ に置く独自CSS(既定は custom.css)だけ。組み込みのテーマCSSとスクリプトは編集しない)

// 設定ファイル(.github/tsuzuri/config)に書けるキー。ワークフローの Load config と同じ一覧
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
  "EDIT_LINK",
  "REPO_LINK",
  "REPO_VERSION",
  "REPO_LICENSE",
  "LLMS_TXT",
];

// 設定ファイルの本文を { KEY: 値 } にする(ワークフローの Load config と同じ読み方)。
//   - "#" で始まる行と空行は読み飛ばす。値の前後の空白は取り除く
//   - 一覧にないキーは(警告なしで)無視する
export function parseConfigText(text) {
  const values = {};
  for (const rawLine of text.replace(/^\uFEFF/, "").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq < 0) continue;
    const key = line.slice(0, eq).trim();
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
  const styleFile = resolveStyleFile(env.STYLE_FILE);
  const siteOrigin = trimOr(env.SITE_ORIGIN, "");
  const faviconFile = trimOr(env.FAVICON_FILE, "");
  const ogDefaultImage = trimOr(env.OGP_DEFAULT_IMAGE, "");

  const basePath = normalizeBasePath((env.BASE_PATH ?? "").trim());

  // OS の環境変数 LANG("ja_JP.UTF-8" など)は読まない(言語は LANGUAGES だけで決まる)
  const languages = resolveLanguages(env.LANGUAGES);

  const navEnabled = parseBoolean("NAV_ENABLED", env.NAV_ENABLED);

  // true のとき、リンク切れ・拒否したリンクがあればビルドを失敗させる(公開を止める)
  const strictLinks = parseBoolean("STRICT_LINKS", env.STRICT_LINKS);

  // true のとき、デバッグ用の sitemap.json を出力先に書き出す(公開サイトに含まれる)。
  // リンク切れ・拒否したリンクのパス等も含むため、既定では出力しない。
  const sitemapJson = parseBoolean("SITEMAP_JSON", env.SITEMAP_JSON);

  // true のとき、各ページに git の履歴から求めた最終更新日を表示する
  const lastUpdated = parseBoolean("LAST_UPDATED", env.LAST_UPDATED);

  // true のとき、各ページの末尾に「このページを GitHub で編集」のリンクを付ける
  const editLink = parseBoolean("EDIT_LINK", env.EDIT_LINK);

  // 各ページの末尾に出すリポジトリ情報。GitHub のリポジトリへのリンク(true のとき)と、
  // 設定ファイルに書いた版・ライセンスの文字列(自動では求めない)。設定したものだけが出る
  const repoLink = parseBoolean("REPO_LINK", env.REPO_LINK);
  const repoVersion = resolveOneLine("REPO_VERSION", env.REPO_VERSION);
  const repoLicense = resolveOneLine("REPO_LICENSE", env.REPO_LICENSE);

  // 既定で有効(空・未設定は true)。true のとき、SITE_ORIGIN があれば llms.txt を出力先に作る。
  // false と、true・false 以外の不正な値(警告つき)は作らない
  const llmsTxt = parseBoolean("LLMS_TXT", env.LLMS_TXT, true);

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
    languages,
    navEnabled,
    strictLinks,
    sitemapJson,
    lastUpdated,
    editLink,
    repoLink,
    repoVersion,
    repoLicense,
    llmsTxt,
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

/**
 * 独自CSSのリポジトリの直下からのパス(.github/tsuzuri/styles/ の中のファイル)。
 * 設定 STYLE_FILE・frontmatter の styleFile・theme には、ファイル名だけを書く。
 * @param {string} name - isStyleFileName を満たすファイル名
 * @returns {string}
 */
export function styleFilePath(name) {
  return `${VENDOR_DIR}/styles/${name}`;
}

/**
 * STYLE_FILE を読む。未設定・空は既定の custom.css。独自CSSのファイル名として使えない値
 * (パス・.css で終わらない名前など)は、警告して "" にする(独自CSSを使わない)。
 * @param {string|undefined} raw
 * @returns {string}
 */
function resolveStyleFile(raw) {
  const name = trimOr(raw, "custom.css");
  if (isStyleFileName(name)) return name;
  console.warn(
    `[config] The value of STYLE_FILE is invalid ("${name}"). Write only a file name (e.g. custom.css)` +
      ` (it is read as a file in ${VENDOR_DIR}/styles/). The custom CSS is not used.`
  );
  return "";
}

// 値をtrimし、空ならデフォルト値を返す。未設定(undefined/null)も空扱い。
function trimOr(raw, fallback) {
  const trimmed = (raw ?? "").trim();
  return trimmed || fallback;
}

// true/false の設定値を読む。大文字小文字は区別しない。
// 省略(未設定・空文字)は emptyValue(既定は false)として黙って扱い、不正値のときだけ warn する。
// 不正値は emptyValue によらず false(公開するものを増やさない側)にする。
function parseBoolean(name, raw, emptyValue = false) {
  const trimmed = (raw ?? "").trim().toLowerCase();
  if (trimmed === "true") return true;
  if (trimmed === "false") return false;
  if (trimmed === "") return emptyValue;
  console.warn(
    `[config] The value of ${name} is invalid ("${raw ?? ""}"). Falling back to false.`
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
      console.warn(`[config] "${item}" in LANGUAGES is ignored because it is not a valid language tag.`);
      continue;
    }
    const lower = item.toLowerCase();
    if (seen.has(lower)) {
      console.warn(`[config] "${item}" in LANGUAGES is ignored because it is a duplicate.`);
      continue;
    }
    seen.add(lower);
    languages.push(item);
  }
  if (languages.length === 0) {
    console.warn('[config] LANGUAGES has no valid language tag. Using "en".');
    return ["en"];
  }
  return languages;
}

/**
 * 1行の文字列の設定値(REPO_VERSION など)を読む。前後の空白を取り、空なら空文字。
 * 制御文字(改行・タブを含む)があるか、長さが max を超えるときは、警告して空文字にする。
 * 文字種は絞らない(HTML に出すときは呼び出し側で escapeHtml を通す)。
 * @param {string} name - 設定キー名(警告に使う)
 * @param {string|undefined} raw
 * @param {number} [max]
 * @returns {string}
 */
export function resolveOneLine(name, raw, max = 64) {
  const trimmed = (raw ?? "").trim();
  if (!trimmed) return "";
  if (/\p{Cc}/u.test(trimmed)) {
    console.warn(`[config] The value of ${name} contains control characters such as line breaks or tabs. Falling back to an empty string.`);
    return "";
  }
  if (trimmed.length > max) {
    console.warn(`[config] The value of ${name} is too long (at most ${max} characters). Falling back to an empty string.`);
    return "";
  }
  return trimmed;
}

function resolveCustomDomain(raw) {
  const trimmed = (raw ?? "").trim();
  if (!trimmed) return "";
  if (HOSTNAME_RE.test(trimmed)) return trimmed;
  console.warn(
    `[config] The value of CUSTOM_DOMAIN is invalid ("${trimmed}"). Falling back to an empty string.`
  );
  return "";
}

// 省略(未設定・空文字)は既定値 "material" として黙って扱い、不正値のときだけ warn する。
function resolveTheme(raw) {
  const trimmed = (raw ?? "").trim();
  if (trimmed === "") return "material";
  if (ALLOWED_THEMES.includes(trimmed)) return trimmed;
  console.warn(
    `[config] The value of THEME is invalid ("${trimmed}"). Falling back to "material".`
  );
  return "material";
}
