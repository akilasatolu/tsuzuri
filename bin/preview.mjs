// `npx github:akilasatolu/tsuzuri#v1 preview` の本体。
// 利用者のリポジトリにコピー済みのビルドスクリプト(.github/tsuzuri/)で、公開時と同じ設定のサイトを
// 手元にビルドし、簡易サーバーで表示する。
//   1. ビルド用の依存が .github/tsuzuri/node_modules に無ければ、ワークフローと同じ方法でインストールする
//      (.github/tsuzuri/package-lock.json があれば npm ci。無い古い版はワークフローに書かれた版を npm install)
//   2. .github/tsuzuri/build-docs.mjs を実行する(設定ファイルの値が使われる。BASE_PATH は付けない)
//   3. 出力先(OUT_DIR)を http://localhost:<port>/ で配信する
//   4. リポジトリのファイルが変わったら自動でビルドし直し、開いているページを再読み込みさせる
//      (--no-watch で止められる)
// 追加の npm 依存は使わない(node:http で配信し、変更は fs.watch で見張る)。

import { createServer } from "node:http";
import { existsSync, readFileSync, statSync, createReadStream, realpathSync, watch } from "node:fs";
import { join, resolve, sep, extname, relative } from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { parseConfigText } from "../.github/scripts/lib/config.mjs";

const VENDOR_DIR = ".github/tsuzuri";
const WORKFLOW_PATH = ".github/workflows/docs-pages.yml";

const CONTENT_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".bmp": "image/bmp",
  ".pdf": "application/pdf",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".ogg": "audio/ogg",
  ".zip": "application/zip",
};

/** 拡張子から Content-Type を決める(知らない拡張子はダウンロード扱い) */
export function contentTypeOf(filePath) {
  return CONTENT_TYPES[extname(filePath).toLowerCase()] ?? "application/octet-stream";
}

/**
 * リクエストのURLのパスを、配信するファイルの絶対パスにする。GitHub Pages と同じく、
 * ディレクトリは index.html を返す。出力先の外を指すもの・存在しないものは null。
 * @param {string} rootDir - 出力先ディレクトリの絶対パス
 * @param {string} urlPath - "/docs/a.html?x=1" など
 * @returns {string|null}
 */
export function resolveServePath(rootDir, urlPath) {
  let decoded;
  try {
    decoded = decodeURIComponent(urlPath.split(/[?#]/)[0]);
  } catch {
    return null;
  }
  const root = resolve(rootDir);
  let abs = resolve(root, `.${decoded.startsWith("/") ? "" : "/"}${decoded}`);
  if (abs !== root && !abs.startsWith(root + sep)) return null;
  if (existsSync(abs) && statSync(abs).isDirectory()) abs = join(abs, "index.html");
  if (!existsSync(abs) || !statSync(abs).isFile()) return null;
  // シンボリックリンクで出力先の外のファイルを返さない
  const real = realpathSync(abs);
  const realRoot = realpathSync(root);
  return real === realRoot || real.startsWith(realRoot + sep) ? abs : null;
}

// 自動再読み込み用の URL と、HTML に差し込むスクリプト(ビルドし直したら通知を受けて再読み込みする)
export const RELOAD_EVENTS_PATH = "/__tsuzuri/events";
export const RELOAD_SCRIPT = `<script>new EventSource("${RELOAD_EVENTS_PATH}").onmessage = () => location.reload();</script>`;

/**
 * 出力先ディレクトリを配信するサーバーを作る(listen は呼び出し側で行う)。
 * 見つからないURLには 404.html(あれば)を 404 で返す。
 * liveReload のときは、HTML に RELOAD_SCRIPT を差し込み、server.notifyReload() で開いているページを再読み込みさせる。
 * @param {string} rootDir
 * @param {{ liveReload?: boolean }} [options]
 */
export function createPreviewServer(rootDir, { liveReload = false } = {}) {
  const clients = new Set();
  const server = createServer((req, res) => {
    if (req.method !== "GET" && req.method !== "HEAD") {
      res.writeHead(405).end();
      return;
    }
    const urlPath = req.url || "/";
    if (liveReload && urlPath === RELOAD_EVENTS_PATH) {
      res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-store", Connection: "keep-alive" });
      res.write(": connected\n\n");
      clients.add(res);
      req.on("close", () => clients.delete(res));
      return;
    }
    // "/docs" のようにディレクトリを末尾の "/" なしで開いたときは、"/docs/" に移動させる(相対リンクのため)
    const bare = urlPath.split(/[?#]/)[0];
    if (!bare.endsWith("/")) {
      const index = resolveServePath(rootDir, bare);
      if (index && index.endsWith(`${sep}index.html`) && !bare.endsWith("/index.html")) {
        res.writeHead(301, { Location: `${bare}/` }).end();
        return;
      }
    }
    let status = 200;
    let file = resolveServePath(rootDir, urlPath);
    if (!file) {
      status = 404;
      file = resolveServePath(rootDir, "/404.html");
    }
    if (!file) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" }).end("Not Found");
      return;
    }
    const type = contentTypeOf(file);
    if (liveReload && type.startsWith("text/html")) {
      const html = readFileSync(file, "utf-8");
      const body = html.includes("</body>") ? html.replace("</body>", `${RELOAD_SCRIPT}\n</body>`) : html + RELOAD_SCRIPT;
      res.writeHead(status, { "Content-Type": type, "Cache-Control": "no-store" });
      res.end(req.method === "HEAD" ? undefined : body);
      return;
    }
    res.writeHead(status, { "Content-Type": type, "Cache-Control": "no-store" });
    if (req.method === "HEAD") {
      res.end();
      return;
    }
    createReadStream(file).pipe(res);
  });
  server.notifyReload = () => {
    for (const client of clients) client.write("data: reload\n\n");
  };
  // 再読み込みの接続が残っていても、close() で止められるようにする
  const close = server.close.bind(server);
  server.close = (callback) => {
    for (const client of clients) client.end();
    clients.clear();
    return close(callback);
  };
  return server;
}

/**
 * ファイルの変更で、ビルドし直すべきか。出力先・.git・依存(node_modules)の中の変更は無視する。
 * @param {string} relPath - リポジトリの直下からのパス
 * @param {string} outDirRel - 出力先(リポジトリの直下からのパス)
 */
export function shouldRebuildFor(relPath, outDirRel) {
  const p = relPath.split(sep).join("/");
  if (!p || p.startsWith("../")) return false;
  const out = outDirRel.split(sep).join("/").replace(/\/+$/, "");
  if (p === out || p.startsWith(`${out}/`)) return false;
  return !p.split("/").some((seg) => seg === ".git" || seg === "node_modules");
}

/**
 * v1.6.0 以前の生成済みワークフローの「Install build dependency」の行から、ビルド用の依存("marked@x.y.z ...")を読む。
 * コピー済みのビルドスクリプトと同じ版を入れるため、CLI 自身の版ではなくワークフローの記載を使う。
 * @param {string} workflowText
 * @returns {string[]}
 */
export function dependencySpecsFromWorkflow(workflowText) {
  const m = workflowText.match(/npm install --prefix \S+ ((?:[\w@./-]+@[\w.-]+ ?)+)/);
  return m ? m[1].trim().split(/\s+/) : [];
}

/** 生成済みワークフローの先頭のコメントから、コピー済みの tsuzuri のバージョンを読む */
export function vendoredVersionOf(workflowText) {
  return workflowText.match(/^# tsuzuri v(\d+\.\d+\.\d+) /m)?.[1] ?? "";
}

function buildEnv() {
  // 公開時と同じ設定。手元では BASE_PATH を付けず、サイトのURLも使わない
  const env = { ...process.env, BASE_PATH: "", SITE_ORIGIN: "" };
  delete env.GITHUB_ACTIONS;
  return env;
}

/**
 * preview コマンド本体。
 * @param {{ cwd: string, port: number, version: string, watch?: boolean, log?: Function, warn?: Function }} opts
 * @returns {Promise<import("node:http").Server | null>} 配信を始めたサーバー(失敗したときは null)
 */
export async function runPreview({ cwd, port, version, watch: watchFiles = true, log = console.log, warn = console.warn }) {
  const script = join(cwd, VENDOR_DIR, "build-docs.mjs");
  if (!existsSync(script)) {
    warn(`${VENDOR_DIR}/build-docs.mjs がありません。先に init を実行してください(リポジトリの直下で実行します)。`);
    return null;
  }
  const workflowAbs = join(cwd, WORKFLOW_PATH);
  const workflowText = existsSync(workflowAbs) ? readFileSync(workflowAbs, "utf-8") : "";
  const vendored = vendoredVersionOf(workflowText);
  if (vendored && vendored !== version) {
    warn(
      `⚠ このリポジトリのビルドスクリプトは v${vendored} です(このコマンドは v${version})。` +
        `公開時と同じ v${vendored} でビルドします。最新にするには init --update を実行してください。`
    );
  }

  // 1. ビルド用の依存(ワークフローと同じ方法で入れる)
  if (!existsSync(join(cwd, VENDOR_DIR, "node_modules", "marked"))) {
    let npmArgs;
    if (existsSync(join(cwd, VENDOR_DIR, "package-lock.json"))) {
      // v1.7.0 以降: package-lock.json のとおりに入れる(中身のハッシュが違えば止まる)
      npmArgs = ["ci", "--prefix", VENDOR_DIR, "--ignore-scripts", "--no-audit", "--no-fund"];
      log(`ビルド用の依存をインストールします(${VENDOR_DIR}/package-lock.json のとおり)`);
    } else {
      const specs = dependencySpecsFromWorkflow(workflowText);
      if (!specs.length) {
        warn(`${WORKFLOW_PATH} からビルド用の依存を読み取れませんでした。init --update で作り直してください。`);
        return null;
      }
      npmArgs = ["install", "--prefix", VENDOR_DIR, ...specs, "--no-save", "--no-audit", "--no-fund", "--ignore-scripts"];
      log(`ビルド用の依存をインストールします(${VENDOR_DIR}/node_modules): ${specs.join(" ")}`);
    }
    const npm = spawnSync("npm", npmArgs, { cwd, stdio: "inherit", shell: process.platform === "win32" });
    if (npm.status !== 0) {
      warn("依存のインストールに失敗しました。");
      return null;
    }
  }

  // 2. ビルド
  const build = spawnSync(process.execPath, [script], { cwd, env: buildEnv(), stdio: "inherit" });
  if (build.status !== 0) {
    warn("ビルドに失敗しました(上のメッセージを確認してください)。");
    return null;
  }

  // 3. 配信
  const configAbs = join(cwd, ".github", "docs-pages.config");
  const config = existsSync(configAbs) ? parseConfigText(readFileSync(configAbs, "utf-8")) : {};
  const outDir = resolve(cwd, config.OUT_DIR || "_site");
  const server = createPreviewServer(outDir, { liveReload: watchFiles });
  await new Promise((resolveListen, rejectListen) => {
    server.once("error", rejectListen);
    server.listen(port, "127.0.0.1", resolveListen);
  }).catch((err) => {
    if (err.code === "EADDRINUSE") {
      throw new Error(`ポート ${port} は使用中です。--port で別の番号を指定してください(例: --port 4001)`, { cause: err });
    }
    throw err;
  });
  log(`\nプレビュー: http://localhost:${server.address().port}/`);

  // 4. 変更を見張って、ビルドし直す(続けて変更されたときは、まとめて1回にする)
  if (watchFiles) {
    const outDirRel = relative(cwd, outDir);
    let timer = null;
    let building = false;
    let pending = false;
    const rebuild = () => {
      if (building) {
        pending = true;
        return;
      }
      building = true;
      log("\n変更を検知したので、ビルドし直します…");
      const child = spawn(process.execPath, [script], { cwd, env: buildEnv(), stdio: "inherit" });
      child.on("close", (code) => {
        building = false;
        if (code === 0) {
          server.notifyReload();
          log("ビルドし直しました(開いているページを再読み込みします)。");
        } else {
          warn("ビルドに失敗しました。直してから保存すると、もう一度ビルドします。");
        }
        if (pending) {
          pending = false;
          rebuild();
        }
      });
    };
    try {
      const watcher = watch(cwd, { recursive: true }, (_event, filename) => {
        if (!filename || !shouldRebuildFor(String(filename), outDirRel)) return;
        clearTimeout(timer);
        timer = setTimeout(rebuild, 300);
      });
      server.on("close", () => watcher.close());
      log("ファイルを保存すると、自動でビルドし直してページを再読み込みします。終了するには Ctrl+C を押します。");
    } catch (err) {
      warn(`ファイルの変更を見張れませんでした(${err.message})。変更したら preview を実行し直してください。`);
    }
  } else {
    log("Markdown を変更したら、もう一度 preview を実行してください。終了するには Ctrl+C を押します。");
  }
  return server;
}
