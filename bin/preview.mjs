// `npx github:akilasatolu/tsuzuri#v1 preview` の本体。
// 利用者のリポジトリにコピー済みのビルドスクリプト(.github/tsuzuri/)で、公開時と同じ設定のサイトを
// 手元にビルドし、簡易サーバーで表示する。
//   1. ビルド用の依存が .github/tsuzuri/node_modules に無ければ、ワークフローと同じ版をインストールする
//   2. .github/tsuzuri/build-docs.mjs を実行する(設定ファイルの値が使われる。BASE_PATH は付けない)
//   3. 出力先(OUT_DIR)を http://localhost:<port>/ で配信する
// 追加の npm 依存は使わない(node:http で配信する)。

import { createServer } from "node:http";
import { existsSync, readFileSync, statSync, createReadStream, realpathSync } from "node:fs";
import { join, resolve, sep, extname } from "node:path";
import { spawnSync } from "node:child_process";
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

/**
 * 出力先ディレクトリを配信するサーバーを作る(listen は呼び出し側で行う)。
 * 見つからないURLには 404.html(あれば)を 404 で返す。
 * @param {string} rootDir
 */
export function createPreviewServer(rootDir) {
  return createServer((req, res) => {
    if (req.method !== "GET" && req.method !== "HEAD") {
      res.writeHead(405).end();
      return;
    }
    const urlPath = req.url || "/";
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
    res.writeHead(status, { "Content-Type": contentTypeOf(file), "Cache-Control": "no-store" });
    if (req.method === "HEAD") {
      res.end();
      return;
    }
    createReadStream(file).pipe(res);
  });
}

/**
 * 生成済みワークフローの「Install build dependency」の行から、ビルド用の依存("marked@x.y.z ...")を読む。
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

/**
 * preview コマンド本体。
 * @param {{ cwd: string, port: number, version: string, log?: Function, warn?: Function }} opts
 * @returns {Promise<import("node:http").Server | null>} 配信を始めたサーバー(失敗したときは null)
 */
export async function runPreview({ cwd, port, version, log = console.log, warn = console.warn }) {
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

  // 1. ビルド用の依存
  if (!existsSync(join(cwd, VENDOR_DIR, "node_modules", "marked"))) {
    const specs = dependencySpecsFromWorkflow(workflowText);
    if (!specs.length) {
      warn(`${WORKFLOW_PATH} からビルド用の依存を読み取れませんでした。init --update で作り直してください。`);
      return null;
    }
    log(`ビルド用の依存をインストールします(${VENDOR_DIR}/node_modules): ${specs.join(" ")}`);
    const npm = spawnSync(
      "npm",
      ["install", "--prefix", VENDOR_DIR, ...specs, "--no-save", "--no-audit", "--no-fund", "--ignore-scripts"],
      { cwd, stdio: "inherit", shell: process.platform === "win32" }
    );
    if (npm.status !== 0) {
      warn("依存のインストールに失敗しました。");
      return null;
    }
  }

  // 2. ビルド(公開時と同じ設定。手元では BASE_PATH を付けず、サイトのURLも使わない)
  const env = { ...process.env, BASE_PATH: "", SITE_ORIGIN: "" };
  delete env.GITHUB_ACTIONS;
  const build = spawnSync(process.execPath, [script], { cwd, env, stdio: "inherit" });
  if (build.status !== 0) {
    warn("ビルドに失敗しました(上のメッセージを確認してください)。");
    return null;
  }

  // 3. 配信
  const configAbs = join(cwd, ".github", "docs-pages.config");
  const config = existsSync(configAbs) ? parseConfigText(readFileSync(configAbs, "utf-8")) : {};
  const outDir = resolve(cwd, config.OUT_DIR || "_site");
  const server = createPreviewServer(outDir);
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
  log("Markdown を変更したら、もう一度 preview を実行してください。終了するには Ctrl+C を押します。");
  return server;
}
