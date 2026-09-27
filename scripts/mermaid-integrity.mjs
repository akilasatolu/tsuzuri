#!/usr/bin/env node
// 生成ページが CDN から読み込む mermaid のファイルのハッシュ(SRI の integrity)を求める。
//   node scripts/mermaid-integrity.mjs          … 今の MERMAID_VERSION のファイルのハッシュを表示する
//                                                 (MERMAID_VERSION を上げたら、表示された値を MERMAID_INTEGRITY に書く)
//   node scripts/mermaid-integrity.mjs --check  … MERMAID_INTEGRITY が実際のファイルと一致するか確かめる(CI 用)

import { createHash } from "node:crypto";
import { MERMAID_URL, MERMAID_INTEGRITY } from "../.github/scripts/lib/html-renderer.mjs";

const res = await fetch(MERMAID_URL);
if (!res.ok) {
  console.error(`${MERMAID_URL} を取得できませんでした(HTTP ${res.status})`);
  process.exit(1);
}
const actual = `sha384-${createHash("sha384").update(Buffer.from(await res.arrayBuffer())).digest("base64")}`;

if (process.argv.includes("--check")) {
  if (actual !== MERMAID_INTEGRITY) {
    console.error(
      `MERMAID_INTEGRITY が ${MERMAID_URL} の実際のハッシュと一致しません。\n` +
        `  書かれている値: ${MERMAID_INTEGRITY}\n  実際の値:       ${actual}\n` +
        "MERMAID_VERSION を上げた場合は、html-renderer.mjs の MERMAID_INTEGRITY を実際の値に更新してください。"
    );
    process.exit(1);
  }
  console.log(`OK: ${MERMAID_URL} のハッシュは MERMAID_INTEGRITY と一致しています。`);
} else {
  console.log(actual);
}
