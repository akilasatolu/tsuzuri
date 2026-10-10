/**
 * path-utils.mjs
 *
 * パスの正規化・外部リンク判定・リポジトリ相対パス解決・サイト絶対パス変換を
 * 担当するモジュール。
 *
 * 既存 build-docs.mjs (旧45〜110行目相当) からロジック変更なしで移動したもの:
 *   normalizeBasePath / isExternal / isMarkdownPath / isImagePath / splitHref
 *
 * セキュリティ強化のため仕様変更したもの:
 *   resolveRepoRel — 戻り値を判別可能なユニオン型に変更し、
 *     パストラバーサル・デコードエラーを「辿らない」方針で明示的に拒否する。
 *   toSiteAbsHref — basePath を明示引数化(モジュール内グローバル定数への
 *     依存を排除)。
 */

import fs from "node:fs";
import path from "node:path";

const posix = path.posix;

// 例: "/my-repo" ・ "my-repo" ・ "" のいずれで渡されても正規化する
export function normalizeBasePath(raw) {
  let p = raw.trim();
  if (!p) return "";
  if (!p.startsWith("/")) p = "/" + p;
  p = p.replace(/\/+$/, ""); // 末尾スラッシュ除去
  return p;
}

export function isExternal(link) {
  if (!link) return true;
  if (/^[a-z][a-z0-9+.-]*:/i.test(link)) return true; // http:, https:, mailto:, tel: ...
  if (link.startsWith("//")) return true; // protocol-relative
  return false;
}

export function isMarkdownPath(p) {
  return /\.md$/i.test(p);
}

export function isImagePath(p) {
  return /\.(png|jpe?g|gif|svg|webp|bmp|ico)$/i.test(p);
}

// "." で始まるディレクトリにあってもサイトにコピーする、動画・音声・文書の拡張子
// (設定ファイルなどを誤って公開しないよう、それ以外は "." で始まるパスならコピーしない)
const PUBLISHABLE_IN_DOT_DIR = /\.(pdf|mp4|webm|mov|m4v|mp3|m4a|wav|ogg|oga)$/i;

// Markdown・画像以外で、リンクされていればサイトにコピーするファイル(PDF・zip等)か。
//   - 拡張子の無いパスは対象外(`docs/` のようなディレクトリへのリンクの可能性があるため)
//   - "." で始まるファイル(.env 等)は対象外。"." で始まるディレクトリ(.github/ 等)の中のファイルは、
//     動画・音声・PDF だけを対象にする(誤って設定ファイルなどを公開しないため)
export function isLinkedFilePath(p) {
  if (isMarkdownPath(p)) return false;
  const segs = p.split("/");
  if (segs[segs.length - 1].startsWith(".")) return false;
  if (segs.some((seg) => seg.startsWith(".")) && !PUBLISHABLE_IN_DOT_DIR.test(p)) return false;
  return posix.extname(p) !== "";
}

// href/src を { pathPart, rest } に分解する。rest には #anchor や ?query を含む
export function splitHref(href) {
  let cut = href.length;
  const hashIdx = href.indexOf("#");
  const qIdx = href.indexOf("?");
  if (hashIdx >= 0) cut = Math.min(cut, hashIdx);
  if (qIdx >= 0) cut = Math.min(cut, qIdx);
  return { pathPart: href.slice(0, cut), rest: href.slice(cut) };
}

// <img>・<source> の srcset 属性(上限付きで、入れ子の量指定子は使わない)。値は二重引用符か単一引用符で囲まれたもの。
// link-extractor.mjs の extractRawHtmlLinks と html-renderer.mjs の preprocessRawHtmlPaths が使う(g フラグ付き。exec で使うときは new RegExp で複製する)
export const SRCSET_ATTR = /(<(?:img|source)\b[^>]{0,2000}?\ssrcset=)(?:"([^"]{0,4000})"|'([^']{0,4000})')/gi;

// srcset 属性の値の中の、候補の URL を fn で置き換えた文字列を返す。記述子(1x・480w など)と区切りは元のまま。
// HTML の仕様どおり1文字ずつ読む(空白とカンマを飛ばす → 空白までを URL とする → URL の末尾のカンマは区切り →
// カンマまでを記述子とする)。そのため "a.png,b.png"(空白なし)は1つの URL で、"data:image/png;base64,AAA= 1x" の
// データ URL のカンマでも分かれない。正規表現では分けない。
//
// @param {string} value
// @param {(url: string) => string} fn
// @returns {string}
export function mapSrcsetUrls(value, fn) {
  const isSpace = (c) => c === " " || c === "\t" || c === "\n" || c === "\f" || c === "\r";
  let out = "";
  let i = 0;
  const n = value.length;
  while (i < n) {
    let j = i;
    while (j < n && (isSpace(value[j]) || value[j] === ",")) j++;
    out += value.slice(i, j);
    i = j;
    if (i >= n) break;
    while (j < n && !isSpace(value[j])) j++;
    let url = value.slice(i, j);
    // 末尾のカンマは、後ろから数える(正規表現の /,+$/ は、カンマが続く入力で処理時間が2乗に伸びる)
    let k = url.length;
    while (k > 0 && url[k - 1] === ",") k--;
    const commas = url.slice(k);
    url = url.slice(0, k);
    out += fn(url) + commas;
    i = j;
    if (!commas) {
      // 記述子。次のカンマまで
      while (j < n && value[j] !== ",") j++;
      out += value.slice(i, j);
      i = j;
    }
  }
  return out;
}

/**
 * @typedef {{ repoRel: string, rest: string }} ResolvedRepoRel
 * @typedef {{ rejected: true, reason: "external" | "anchor" | "path-traversal" | "decode-error" }} RejectedRepoRel
 */

// リンク・画像パスを「リポジトリルートからの相対パス (posix, 先頭スラッシュなし)」に解決する。
// 外部リンク・アンカーのみのリンク・パストラバーサルを試みるリンク・デコード不能な
// リンクは、いずれも { rejected: true, reason } を返し、呼び出し側で理由を区別できる
// ようにする(旧仕様は null を返すのみで理由を区別できなかった)。
// Markdown 内で "/foo/bar.md" のように絶対パスで書かれていた場合は、
// リポジトリルート起点の相対パスとして扱う（＝先頭の "/" を取り除くだけ）。
// 相対パスで書かれていた場合は、参照元ファイルのディレクトリを基準に解決する。
//
// @param {string} fromRel
// @param {string} rawHref
// @returns {ResolvedRepoRel | RejectedRepoRel}
export function resolveRepoRel(fromRel, rawHref) {
  if (isExternal(rawHref)) return { rejected: true, reason: "external" };

  const { pathPart, rest } = splitHref(rawHref);
  if (!pathPart) return { rejected: true, reason: "anchor" };

  let decoded;
  try {
    decoded = decodeURIComponent(pathPart);
  } catch {
    return { rejected: true, reason: "decode-error" };
  }
  if (!decoded) return { rejected: true, reason: "anchor" };

  let repoRel;
  if (decoded.startsWith("/")) {
    repoRel = posix.normalize(decoded.slice(1));
  } else {
    const fromDir = posix.dirname(fromRel);
    repoRel = posix.normalize(posix.join(fromDir === "." ? "" : fromDir, decoded));
  }

  if (repoRel === ".." || repoRel.startsWith("../") || posix.isAbsolute(repoRel)) {
    return { rejected: true, reason: "path-traversal" };
  }

  return { repoRel, rest };
}

// リポジトリ内のパスを、サイト(出力先)でのパスにする。"." で始まる要素(".github" など)は
// 先頭に "_" を付ける(例: ".github/logo.png" → "_.github/logo.png")。GitHub Pages に上げる
// 成果物(actions/upload-pages-artifact)は "." で始まるファイル・ディレクトリを含めないため、
// そのままの名前で出力するとサイトに載らない。
export function outputRelOf(repoRel) {
  return repoRel
    .split("/")
    .map((seg) => (seg.startsWith(".") && seg !== "." && seg !== ".." ? `_${seg}` : seg))
    .join("/");
}

// URLのパス部分を要素ごとにパーセントエンコードする("/" はそのまま)。
// ファイル名の "#"・"?"・"%"・空白などが、URLの区切りと誤解されないようにする。
export function encodeUrlPath(p) {
  return p.split("/").map(encodeURIComponent).join("/");
}

// ページ(リポジトリ内の .md のパス)の、サイト上の絶対パス。ナビ・前後ページのリンク用。
export function pageHref(rel, basePath) {
  return `${basePath}/${encodeUrlPath(outputRelOf(rel.replace(/\.md$/i, ".html")))}`;
}

// 出力 HTML に書き込む最終的な絶対パスを組み立てる
// (.md は .html に変換し、outputRelOf・encodeUrlPath を通したうえで basePath を先頭に付与する)
//
// @param {string} fromRel
// @param {string} rawHref
// @param {string} basePath
// @returns {string}
//
// ディレクトリへのリンク("/"・"./"・"docs/" など)は、末尾の "/" を保ったまま
// `${basePath}/` ・ `${basePath}/docs/` のように組み立てる(ディレクトリの index.html を開く)。
export function toSiteAbsHref(fromRel, rawHref, basePath) {
  const resolved = resolveRepoRel(fromRel, rawHref);
  if (resolved.rejected) return rawHref; // 外部リンク・アンカー・拒否されたリンクはそのまま
  let { repoRel, rest } = resolved;
  // posix.normalize は末尾の "/" を残す("docs/"・"./")ため、いったん取り除いて付け直す
  repoRel = repoRel.replace(/\/+$/, "");
  if (repoRel === "." || repoRel === "") return `${basePath}/${rest}`;
  if (isMarkdownPath(repoRel)) {
    repoRel = repoRel.replace(/\.md$/i, ".html");
  }
  const trailingSlash = splitHref(rawHref).pathPart.endsWith("/") ? "/" : "";
  return `${basePath}/${encodeUrlPath(outputRelOf(repoRel))}${trailingSlash}${rest}`;
}

function isInsideDir(dir, target) {
  return target === dir || target.startsWith(dir.endsWith(path.sep) ? dir : dir + path.sep);
}

// リポジトリルートからの相対パス(設定ファイルやfrontmatterで指定されたもの)を絶対パスに
// 解決する。解決結果がリポジトリルートの外を指す場合は null を返す。
//   - "../" や絶対パスでルート外を指すもの(字句上の判定)
//   - シンボリックリンクをたどった実体がルート外にあるもの(realpathでの判定)
// のどちらも拒否する。ファイルが存在しない場合は字句上の判定だけを行い、
// 存在チェックは呼び出し側に任せる。
//
// @param {string} repoRoot - リポジトリルートの絶対パス
// @param {string} relPath
// @param {(p: string) => string} [realpath] - DI: テスト用(既定 fs.realpathSync)
// @returns {string|null}
export function resolveInsideRepo(repoRoot, relPath, realpath = fs.realpathSync) {
  const root = path.resolve(repoRoot);
  const abs = path.resolve(root, relPath);
  if (!isInsideDir(root, abs)) return null;

  let realRoot;
  try {
    realRoot = realpath(root);
  } catch {
    realRoot = root;
  }
  let realAbs;
  try {
    realAbs = realpath(abs);
  } catch {
    return abs; // 存在しないファイル。存在チェックは呼び出し側で行う
  }
  return isInsideDir(realRoot, realAbs) ? abs : null;
}

/**
 * git のリモートURL(https・ssh のどちらの形式でも)から、ブラウザで開く GitHub のリポジトリのURLを作る。
 * 例: "git@github.com:owner/repo.git" → "https://github.com/owner/repo"
 * GitHub 以外(ホスト名に "github" を含まない。GitLab 等)や、解釈できない場合は "" を返す
 * (作るURLが GitHub の /blob/・/tree/ 形式のため)。GitHub Enterprise のホストは対象に含める。
 * @param {string} remote
 * @returns {string}
 */
export function webUrlFromGitRemote(remote) {
  const url = (remote || "").trim();
  const patterns = [
    /^git@([^:/]+):(.+?)(?:\.git)?\/?$/,
    /^ssh:\/\/(?:[^@/]+@)?([^/:]+)(?::\d+)?\/(.+?)(?:\.git)?\/?$/,
    /^https?:\/\/(?:[^@/]+@)?([^/]+)\/(.+?)(?:\.git)?\/?$/,
  ];
  for (const re of patterns) {
    const m = url.match(re);
    if (m) return /github/i.test(m[1]) ? `https://${m[1]}/${m[2]}` : "";
  }
  return "";
}
