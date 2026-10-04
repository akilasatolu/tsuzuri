// ビルド用の依存の package.json・package-lock.json の完成品(templates/tsuzuri/)を、
// 本体の package.json・package-lock.json から作り直す。
// 本体の依存(marked・highlight.js・marked-footnote)を更新したら実行してコミットする。
//
//   node scripts/build-lockfiles.mjs
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { PACKAGE_ROOT, BUILD_LOCKFILES_DIR, buildBuildLockfiles } from "../bin/cli.mjs";

const files = buildBuildLockfiles(PACKAGE_ROOT);
if (!files) throw new Error("package-lock.json が見つかりません");
const dir = join(PACKAGE_ROOT, BUILD_LOCKFILES_DIR);
mkdirSync(dir, { recursive: true });
writeFileSync(join(dir, "package.json"), files.packageJson);
writeFileSync(join(dir, "package-lock.json"), files.packageLock);
console.log(`${BUILD_LOCKFILES_DIR}/package.json・package-lock.json を作り直しました`);
