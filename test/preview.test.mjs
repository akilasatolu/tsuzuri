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
  shouldRebuildFor,
  RELOAD_EVENTS_PATH,
  browserCommand,
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
  // v1.6.0 以前のワークフロー(npm install の行に版を並べていた)から読む
  const legacy = `        run: npm install --prefix .github/tsuzuri ${buildDependencySpecs()} --no-save --no-audit --no-fund --ignore-scripts\n`;
  assert.deepEqual(dependencySpecsFromWorkflow(legacy), buildDependencySpecs().split(" "));
  assert.equal(vendoredVersionOf(yml), readPackageVersion());
  assert.deepEqual(dependencySpecsFromWorkflow("no install"), []);
});

test("shouldRebuildFor: 出力先・.git・node_modules の変更ではビルドし直さない", () => {
  assert.equal(shouldRebuildFor("README.md", "_site"), true);
  assert.equal(shouldRebuildFor("docs/a.md", "_site"), true);
  assert.equal(shouldRebuildFor("_site/index.html", "_site"), false);
  assert.equal(shouldRebuildFor("_site", "_site"), false);
  assert.equal(shouldRebuildFor("_site2/x.md", "_site"), true);
  assert.equal(shouldRebuildFor(".git/index", "_site"), false);
  assert.equal(shouldRebuildFor(".github/tsuzuri/node_modules/marked/x.js", "_site"), false);
});

test("liveReload: HTML に再読み込みのスクリプトを入れ、notifyReload で通知する", async () => {
  const dir = makeSite();
  const server = createPreviewServer(dir, { liveReload: true });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const html = await (await fetch(`${base}/`)).text();
    assert.match(html, new RegExp(`EventSource\\("${RELOAD_EVENTS_PATH}"\\)`));
    const controller = new AbortController();
    const res = await fetch(`${base}${RELOAD_EVENTS_PATH}`, { signal: controller.signal });
    assert.equal(res.headers.get("content-type"), "text/event-stream");
    const reader = res.body.getReader();
    await reader.read(); // ": connected"
    server.notifyReload();
    const { value } = await reader.read();
    assert.match(new TextDecoder().decode(value), /data: reload/);
    controller.abort();
  } finally {
    server.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

test("browserCommand: OS ごとにブラウザを開くコマンドを選ぶ", () => {
  const url = "http://localhost:4000/";
  assert.deepEqual(browserCommand(url, "darwin"), ["open", [url]]);
  assert.deepEqual(browserCommand(url, "win32"), ["cmd", ["/c", "start", "", url]]);
  assert.deepEqual(browserCommand(url, "linux"), ["xdg-open", [url]]);
});
