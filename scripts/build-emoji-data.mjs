#!/usr/bin/env node
// 絵文字のショートコード(:tada: など)の表 .github/scripts/lib/emoji-data.mjs を、devDependencies の gemoji から作り直す。
//   node scripts/build-emoji-data.mjs
//
// 表は配布対象(.github/scripts/)に入れてコミットしておき、gemoji 自体は利用者に配らない(開発用の依存のまま)。
// gemoji を更新したら、このスクリプトを実行して、emoji-data.mjs の差分を同じPRに入れる(手順は README.md)。
// 名前の順に並べて書き出すので、gemoji の中身が同じなら、何度作り直しても同じファイルになる。

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { nameToEmoji } from "gemoji";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
export const OUTPUT = path.join(ROOT, ".github/scripts/lib/emoji-data.mjs");

/**
 * emoji-data.mjs の中身(文字列)を作る。
 * @returns {string}
 */
export function buildEmojiData() {
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, "node_modules/gemoji/package.json"), "utf-8"));
  const names = Object.keys(nameToEmoji).sort();
  for (const name of names) {
    // emoji.mjs の正規表現 [a-z0-9_+-]{1,40} に合わない名前があると、その絵文字は変換されない
    if (!/^[a-z0-9_+-]{1,40}$/.test(name)) throw new Error(`ショートコードの名前が想定の形ではありません: ${name}`);
  }
  const lines = names.map((name) => `  ${JSON.stringify(name)}: ${JSON.stringify(nameToEmoji[name])},`);
  return [
    "// 絵文字のショートコード(:tada: など)から文字への表。",
    `// 出どころ: gemoji ${pkg.version}(MIT License, https://github.com/wooorm/gemoji)の nameToEmoji。`,
    "// 手で編集しない。`node scripts/build-emoji-data.mjs` で作り直す。",
    "export const EMOJI = {",
    ...lines,
    "};",
    "",
  ].join("\n");
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  fs.writeFileSync(OUTPUT, buildEmojiData());
  console.log(`書き出しました: ${path.relative(ROOT, OUTPUT)}`);
}
