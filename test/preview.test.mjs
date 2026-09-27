import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  contentTypeOf,
  resolveServePath,
  createPreviewServer,
  dependencySpecsFromWorkflow,
  vendoredVersionOf,
} from "../bin/preview.mjs";
import { buildDocsPagesYml, buildDependencySpecs, readPackageVersion } from "../bin/cli.mjs";

function makeSite() {
  const dir = mkdtempSync(join(tmpdir(), "tsuzuri-preview-"));
  mkdirSync(join(dir, "docs"));
  writeFileSync(join(dir, "index.html"), "<p>top</p>");
  writeFileSync(join(dir, "docs", "index.html"), "<p>docs</p>");
  writeFileSync(join(dir, "docs", "a b.html"), "<p>a</p>");
  writeFileSync(join(dir, "404.html"), "<p>not found</p>");
  return dir;
}

test("contentTypeOf: 拡張子で Content-Type を決める", () => {
  assert.equal(contentTypeOf("a/b.html"), "text/html; charset=utf-8");
  assert.equal(contentTypeOf("x.SVG"), "image/svg+xml");
  assert.equal(contentTypeOf("x.unknown"), "application/octet-stream");
});

test("resolveServePath: ディレクトリは index.html、エンコードを戻し、出力先の外は返さない", () => {
  const dir = makeSite();
  try {
    assert.equal(resolveServePath(dir, "/"), join(dir, "index.html"));
    assert.equal(resolveServePath(dir, "/docs/?x=1"), join(dir, "docs", "index.html"));
    assert.equal(resolveServePath(dir, "/docs/a%20b.html"), join(dir, "docs", "a b.html"));
    assert.equal(resolveServePath(dir, "/../etc/passwd"), null);
    assert.equal(resolveServePath(dir, "/%2e%2e/secret"), null);
    assert.equal(resolveServePath(dir, "/missing.html"), null);
    assert.equal(resolveServePath(dir, "/%E0%A4%A"), null);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("createPreviewServer: ページを返し、無いURLは 404.html、末尾の / が無いディレクトリは移動させる", async () => {
  const dir = makeSite();
  const server = createPreviewServer(dir);
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    let res = await fetch(`${base}/`);
    assert.equal(res.status, 200);
    assert.equal(await res.text(), "<p>top</p>");
    res = await fetch(`${base}/nope.html`);
    assert.equal(res.status, 404);
    assert.equal(await res.text(), "<p>not found</p>");
    res = await fetch(`${base}/docs`, { redirect: "manual" });
    assert.equal(res.status, 301);
    assert.equal(res.headers.get("location"), "/docs/");
    res = await fetch(`${base}/docs/a%20b.html`);
    assert.equal(res.status, 200);
  } finally {
    server.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

test("生成ワークフローから、ビルド用の依存とコピー済みのバージョンを読める", () => {
  const yml = buildDocsPagesYml();
  assert.deepEqual(dependencySpecsFromWorkflow(yml), buildDependencySpecs().split(" "));
  assert.equal(vendoredVersionOf(yml), readPackageVersion());
  assert.deepEqual(dependencySpecsFromWorkflow("no install"), []);
});
