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

// href/src を { pathPart, rest } に分解する。rest には #anchor や ?query を含む
export function splitHref(href) {
  let cut = href.length;
  const hashIdx = href.indexOf("#");
  const qIdx = href.indexOf("?");
  if (hashIdx >= 0) cut = Math.min(cut, hashIdx);
  if (qIdx >= 0) cut = Math.min(cut, qIdx);
  return { pathPart: href.slice(0, cut), rest: href.slice(cut) };
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

// 出力 HTML に書き込む最終的な絶対パスを組み立てる
// (.md は .html に変換したうえで basePath を先頭に付与する)
//
// @param {string} fromRel
// @param {string} rawHref
// @param {string} basePath
// @returns {string}
export function toSiteAbsHref(fromRel, rawHref, basePath) {
  const resolved = resolveRepoRel(fromRel, rawHref);
  if (resolved.rejected) return rawHref; // 外部リンク・アンカー・拒否されたリンクはそのまま
  let { repoRel, rest } = resolved;
  if (isMarkdownPath(repoRel)) {
    repoRel = repoRel.replace(/\.md$/i, ".html");
  }
  return `${basePath}/${repoRel}${rest}`;
}
