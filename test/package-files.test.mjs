import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));

// `npx github:akilasatolu/tsuzuri init` で利用者の手元に入る中身(package.json の files)を確かめる。
// 実行に要るものだけを入れ、テスト・保存した出力・開発用のファイルは入れない。
function packedFiles() {
  const result = spawnSync("npm", ["pack", "--dry-run", "--json", "--ignore-scripts"], {
    cwd: ROOT,
    encoding: "utf-8",
  });
  assert.equal(result.status, 0, result.stderr);
  return JSON.parse(result.stdout)[0].files.map((f) => f.path);
}

test("利用者に入る中身: 実行に要るファイルがあり、テストや開発用のファイルは無い", () => {
  const files = packedFiles();
  for (const required of [
    "package.json",
    "bin/cli.mjs",
    "bin/preview.mjs",
    ".github/scripts/build-docs.mjs",
    ".github/scripts/lib/config.mjs",
    ".github/scripts/lib/i18n.mjs",
    "styles/base.css",
    "styles/material.css",
    "templates/.github/workflows/docs-pages.yml",
    // npm はルートの package-lock.json を必ず外すので、init が使う完成品はこちらで届ける
    "templates/tsuzuri/package.json",
    "templates/tsuzuri/package-lock.json",
  ]) {
    assert.ok(files.includes(required), `${required} が入っていない`);
  }
  for (const prefix of ["test/", "scripts/", "deps/", ".github/workflows/", "eslint.config.js"]) {
    assert.deepEqual(files.filter((f) => f.startsWith(prefix)), [], `${prefix} が入っている`);
  }
});
