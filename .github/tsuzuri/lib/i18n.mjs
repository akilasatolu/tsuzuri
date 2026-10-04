/**
 * i18n.mjs
 *
 * サイトの画面に出る文言(メニュー・検索・前後のページ・脚注・注意書き・404 など)を、
 * 言語ごとの表としてまとめたモジュール。
 *
 *   - UI_STRINGS: 言語ごとの文言の表(今は en・ja)。表に無い言語は英語の文言になる
 *   - resolveUiLang(tag): 言語タグ(<html lang> の値など)から表のキーを選ぶ
 *     (小文字で完全一致 → 先頭の部分(ja-JP → ja)→ "en")
 *   - runtimeStrings・RUNTIME_PICK_SOURCE: 閲覧時のスクリプト(コピー・表示切り替えのボタン)に
 *     埋め込むための表と、<html lang> から表を選ぶ関数のソース
 *   - createLangContext({ languages, rootMd }): 言語の決まり(ページの言語・言語の印・出力先・
 *     URL の先頭・フォルダの入口の名前)。言語が1つなら何もしない版
 *   - buildTranslationIndex(rels, ctx): 集めたページから翻訳の対応表を作る
 *     (言語版の対応・各言語のトップ・フォルダの入口・重複 excluded・印の無い方 shadowed)
 *
 * 言語を足すときは、UI_STRINGS にその言語の表(キーは en と同じもの)を足す。
 */

export const UI_STRINGS = deepFreeze({
  en: {
    menu: "Menu",
    navLabel: "Site pages",
    searchPlaceholder: "Search this site",
    searchEmpty: "No results",
    pagerPrev: "Previous",
    pagerNext: "Next",
    pagerNav: "Previous and next pages",
    toc: "Contents",
    anchorLabel: 'Link to "{text}"',
    lastUpdated: "Last updated",
    skip: "Skip to content",
    footnotes: "Footnotes",
    footnoteBack: "Back to reference {0}", // {0} は marked-footnote が置き換える
    alerts: { note: "Note", tip: "Tip", important: "Important", warning: "Warning", caution: "Caution" },
    notFound: {
      title: "Page not found",
      body: "The page you are looking for may have been moved or deleted, or the URL may be incorrect.",
      back: "Back to the top page",
    },
    copy: "Copy",
    copied: "Copied",
    copyFailed: "Copy failed",
    toLight: "Switch to light mode",
    toDark: "Switch to dark mode",
    langMenu: "Language",
    langSwitchTo: "Switch language to {name}",
    langUntranslated: "This page is not available in {name}. Opens the {name} top page.",
  },
  ja: {
    menu: "メニュー",
    navLabel: "サイト内ページ",
    searchPlaceholder: "サイト内を検索",
    searchEmpty: "見つかりませんでした",
    pagerPrev: "前のページ",
    pagerNext: "次のページ",
    pagerNav: "前後のページ",
    toc: "目次",
    anchorLabel: "「{text}」へのリンク",
    lastUpdated: "最終更新",
    skip: "本文へスキップ",
    footnotes: "脚注",
    footnoteBack: "本文の参照箇所 {0} に戻る",
    alerts: { note: "補足", tip: "ヒント", important: "重要", warning: "警告", caution: "注意" },
    notFound: {
      title: "ページが見つかりません",
      body: "お探しのページは、移動または削除されたか、URLが間違っている可能性があります。",
      back: "トップページへ戻る",
    },
    copy: "コピー",
    copied: "コピーしました",
    copyFailed: "コピーできませんでした",
    toLight: "ライト表示に切り替える",
    toDark: "ダーク表示に切り替える",
    langMenu: "言語",
    langSwitchTo: "{name}に切り替える",
    langUntranslated: "このページの{name}版はありません。{name}のトップページを開きます。",
  },
});

/** 表に無い言語のときに使う文言の言語 */
export const FALLBACK_UI_LANG = "en";

/**
 * 言語タグから表のキーを選ぶ。完全一致(大文字・小文字は区別しない)→ 先頭の部分(ja-JP → ja)→ "en"。
 * @param {string} [tag] 言語タグ(例: "ja", "ja-JP", "en-US")
 * @param {object} [table] 文言の表(省略時は UI_STRINGS。テストで差し替えられるようにしている)
 * @returns {string} 表のキー
 */
export function resolveUiLang(tag, table = UI_STRINGS) {
  const t = String(tag ?? "").toLowerCase();
  const keys = Object.keys(table);
  const find = (want) => (want ? keys.find((k) => k.toLowerCase() === want) : undefined);
  return find(t) ?? find(t.split("-")[0]) ?? FALLBACK_UI_LANG;
}

/**
 * その言語の文言の表。
 * @param {string} [tag]
 * @returns {typeof UI_STRINGS.en}
 */
export function uiStrings(tag) {
  return UI_STRINGS[resolveUiLang(tag)];
}

/**
 * 文言の中の "{name}"・"{text}" などを vars の値に置き換える。
 * vars に無い名前({0} など)はそのまま残す。
 * @param {string} template
 * @param {Record<string, unknown>} [vars]
 * @returns {string}
 */
export function formatUi(template, vars = {}) {
  return String(template).replace(/\{([^{}]+)\}/g, (whole, name) =>
    Object.hasOwn(vars, name) ? String(vars[name]) : whole
  );
}

/**
 * 言語の表示名(その言語自身の書き方。先頭は大文字。例: fr → Français)。
 * 分からないとき(不正なタグなど)はタグそのまま。
 * @param {string} tag
 * @returns {string}
 */
export function languageName(tag) {
  try {
    const name = new Intl.DisplayNames([tag], { type: "language" }).of(tag);
    if (!name) return tag;
    const [first, ...rest] = name;
    return first.toLocaleUpperCase(tag) + rest.join("");
  } catch {
    return tag;
  }
}

/**
 * 閲覧時のスクリプトに埋め込む用: 指定したキーだけを言語ごとに抜き出した表。
 * 例: runtimeStrings(["copy", "copied"]) → { en: { copy: "Copy", copied: "Copied" }, ja: { … } }
 * @param {string[]} keys
 * @param {object} [table] 文言の表(省略時は UI_STRINGS)
 * @returns {Record<string, Record<string, unknown>>}
 */
export function runtimeStrings(keys, table = UI_STRINGS) {
  const out = {};
  for (const [lang, strings] of Object.entries(table)) {
    out[lang] = {};
    for (const key of keys) {
      if (Object.hasOwn(strings, key)) out[lang][key] = strings[key];
    }
  }
  return out;
}

/**
 * 閲覧時のスクリプトに埋め込む「<html lang> から表を選ぶ」関数のソース文字列。
 * 関数は (表, 言語タグ) を受け取り、選んだ表のキーを返す(選び方は resolveUiLang と同じ)。
 * 使い方の例:
 *   const S = ${JSON.stringify(runtimeStrings([...]))};
 *   const s = S[(${RUNTIME_PICK_SOURCE})(S, document.documentElement.lang)];
 */
export const RUNTIME_PICK_SOURCE = `(table, tag) => {
  const t = String(tag == null ? "" : tag).toLowerCase();
  const keys = Object.keys(table);
  const find = (want) => (want ? keys.find((k) => k.toLowerCase() === want) : undefined);
  const hit = find(t) || find(t.split("-")[0]);
  return hit === undefined ? ${JSON.stringify(FALLBACK_UI_LANG)} : hit;
}`;

// ---------------------------------------------------------------------------
// 言語の決まり(LangContext)
//
// 「ページが何語か・翻訳の元の名前・出力先・URL の先頭」を決めるのはここだけ。
// ほかのモジュールは createLangContext の戻り値を呼ぶだけにする。
// ---------------------------------------------------------------------------

/** ファイル名を「名前.<言語の印>.md」に分ける(拡張子は大文字・小文字を区別しない) */
const MARKER_RE = /^(.*)\.([A-Za-z0-9-]+)\.md$/i;

/**
 * @typedef {object} DirIndexNames
 * @property {(name: string) => boolean} isReadme その名前が、その言語の「README 型」のフォルダの入口か
 * @property {(name: string) => boolean} isIndex その名前が、その言語の「index 型」のフォルダの入口か
 */

/**
 * @typedef {object} LangContext
 * @property {boolean} enabled 多言語(言語2つ以上)か
 * @property {string} rootMd 起点として設定された名前(ROOT_MD。例 "README.md"・"docs/README.md")
 * @property {string} base 基本言語(LANGUAGES の先頭)
 * @property {string[]} languages 言語の一覧(1言語では [base])
 * @property {(tag: string) => string} prefixOf その言語の URL の先頭("" か "en"・"pt-br" など)
 * @property {(rel: string) => string} langOf ページの言語
 * @property {(rel: string) => string | null} markerOf ファイル名の言語の印(LANGUAGES に書かれた形)。無ければ null
 * @property {(rel: string) => string} baseRelOf 言語の印を取った名前(拡張子は .md にそろえる)
 * @property {(name: string, baseName: string, tag: string) => boolean} isVariantName
 *   name が baseName の tag 版の印付きの名前か(大文字・小文字は区別しない)
 * @property {(tag: string) => DirIndexNames} dirIndexNames その言語のフォルダの入口の名前の判定
 * @property {(tag: string) => string[]} candidates
 *   フォルダへのリンクで入口を探す順の名前の一覧(代表の綴り。実際の照合は大文字・小文字を区別せずに行う)
 * @property {(rel: string) => string} outputHtmlRel 出力先(outputRelOf をかける前)
 */

/**
 * 言語の決まりを作る。言語が1つなら「何もしない版」(URL・出力先は今と同じ。基本言語の印だけ取る)。
 * @param {{ languages: string[], rootMd: string }} config
 *   languages は1つ以上の言語タグ、rootMd は空でない文字列(ROOT_MD)。そうでなければ TypeError
 * @returns {LangContext}
 */
export function createLangContext({ languages, rootMd }) {
  if (!Array.isArray(languages) || languages.length === 0 || languages.some((t) => typeof t !== "string" || !t)) {
    throw new TypeError("createLangContext: languages には1つ以上の言語タグが必要です");
  }
  if (typeof rootMd !== "string" || !rootMd) {
    throw new TypeError("createLangContext: rootMd には起点のファイル名(空でない文字列)が必要です");
  }
  const enabled = languages.length > 1;
  const base = languages[0];
  const langs = enabled ? [...languages] : [base];
  // 小文字 → LANGUAGES に書かれた形(同じものが2回あれば先の方)
  const byLower = new Map();
  for (const tag of langs) {
    if (!byLower.has(tag.toLowerCase())) byLower.set(tag.toLowerCase(), tag);
  }
  /** LANGUAGES に書かれた形に直す。知らない言語なら null */
  const canonical = (tag) => byLower.get(String(tag ?? "").toLowerCase()) ?? null;

  const splitRel = (rel) => {
    const i = rel.lastIndexOf("/");
    return { dir: i < 0 ? "" : rel.slice(0, i + 1), name: rel.slice(i + 1) };
  };

  /** ファイル名の言語の印と、印を取った名前の部分 */
  const parseName = (name) => {
    const m = MARKER_RE.exec(name);
    if (!m) return null;
    const tag = canonical(m[2]);
    return tag ? { stem: m[1], tag } : null;
  };

  const markerOf = (rel) => parseName(splitRel(rel).name)?.tag ?? null;
  const langOf = (rel) => markerOf(rel) ?? base;
  const baseRelOf = (rel) => {
    const { dir, name } = splitRel(rel);
    const parsed = parseName(name);
    return parsed ? `${dir}${parsed.stem}.md` : rel;
  };

  const prefixOf = (tag) => {
    if (!enabled) return "";
    const t = canonical(tag) ?? String(tag);
    return t === base ? "" : t.toLowerCase();
  };

  const isVariantName = (name, baseName, tag) => {
    const t = canonical(tag);
    if (!t) return false;
    const stem = String(baseName).replace(/\.md$/i, "");
    return String(name).toLowerCase() === `${stem}.${t}.md`.toLowerCase();
  };

  const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  // 印付きの入口: readme.<tag>.md は全体を大文字・小文字無視。index.<tag>.md は index だけ小文字固定
  const markedReadme = (t) => new RegExp(`^readme\\.${escapeRe(t)}\\.md$`, "i");
  const markedIndexRest = (t) => new RegExp(`^${escapeRe(t)}\\.md$`, "i");

  const dirIndexNames = (tag) => {
    const t = canonical(tag) ?? base;
    const readmeRe = markedReadme(t);
    const indexRestRe = markedIndexRest(t);
    const isMarkedReadme = (name) => readmeRe.test(name);
    const isMarkedIndex = (name) => name.startsWith("index.") && indexRestRe.test(name.slice("index.".length));
    if (t === base) {
      // 基本言語: 印付きに加えて、今の README.md(大文字・小文字無視)・index.md(小文字だけ)
      return {
        isReadme: (name) => isMarkedReadme(name) || /^readme\.md$/i.test(name),
        isIndex: (name) => isMarkedIndex(name) || name === "index.md",
      };
    }
    return { isReadme: isMarkedReadme, isIndex: isMarkedIndex };
  };

  const candidates = (tag) => {
    const t = canonical(tag) ?? base;
    const marked = (x) => [`README.${x}.md`, `index.${x}.md`];
    const list = [
      ...marked(t),
      ...marked(base),
      "README.md",
      "readme.md",
      "index.md",
      ...langs.filter((x) => x !== t && x !== base).flatMap(marked),
    ];
    return [...new Set(list)];
  };

  const outputHtmlRel = (rel) => {
    const html = baseRelOf(rel).replace(/\.md$/i, ".html");
    const prefix = prefixOf(langOf(rel));
    return prefix ? `${prefix}/${html}` : html;
  };

  return Object.freeze({
    enabled,
    rootMd,
    base,
    languages: Object.freeze(langs),
    prefixOf,
    langOf,
    markerOf,
    baseRelOf,
    isVariantName,
    dirIndexNames,
    candidates,
    outputHtmlRel,
  });
}

// ---------------------------------------------------------------------------
// 翻訳の対応表(TranslationIndex)
// ---------------------------------------------------------------------------

/**
 * @typedef {object} TranslationIndex
 * @property {Map<string, Map<string, string>>} byBase 元の名前 → (言語 → rel)。言語は languages の順。
 *   印付きは元の名前を大文字・小文字無視で組に入れるので、キーは組で最初に決まった綴り
 * @property {(rel: string) => Map<string, string>} alternatesOf
 *   そのページの全言語版(languages の順。残したページなら自分を含む。excluded・shadowed の rel なら
 *   残した方の組が返り、自分は含まれない)。知らない rel なら空の Map
 * @property {(tag: string) => string | null} rootOf その言語のトップページ(ROOT_MD の、その言語の版)
 * @property {(dir: string, tag: string) => { rel: string, kind: "index" | "readme" } | null} dirIndexOf
 *   そのフォルダの、その言語の入口("." はサイト直下)
 * @property {Array<{ rel: string, keptRel: string }>} excluded 重複で外したもの(後に見つかった方)
 * @property {Array<{ rel: string, keptRel: string }>} shadowed 基本言語の印付きがあるため使わない印の無いファイル
 */

/**
 * 集めたページから翻訳の対応表を作る。
 * - 同じ元の名前・同じ言語の印付きどうしは先に見つかった方を残し、後の方を excluded に入れる。
 * - 基本言語の印付きと印の無いものが両方あれば、見つかった順に関係なく印付きを残し、印の無い方を shadowed に入れる。
 * @param {Iterable<string>} rels visitedMd のキー(見つかった順)
 * @param {LangContext} ctx createLangContext の戻り値
 * @returns {TranslationIndex}
 */
export function buildTranslationIndex(rels, ctx) {
  if (!ctx || typeof ctx.langOf !== "function" || typeof ctx.rootMd !== "string") {
    throw new TypeError("buildTranslationIndex: ctx には createLangContext の戻り値が必要です");
  }
  const list = [...rels];
  // 元の名前(拡張子は .md にそろえる。cli.MD と cli.ja.md は同じ出力先になるため)
  const keyOf = (rel) => ctx.baseRelOf(rel).replace(/\.md$/i, ".md");
  const canonical = (tag) => {
    const t = String(tag ?? "").toLowerCase();
    return ctx.languages.find((x) => x.toLowerCase() === t) ?? null;
  };

  /** @type {Map<string, { key: string, tag: string, marked: boolean, index: number }>} */
  const info = new Map();
  for (const rel of list) {
    if (info.has(rel)) continue;
    info.set(rel, { key: keyOf(rel), tag: ctx.langOf(rel), marked: ctx.markerOf(rel) !== null, index: info.size });
  }

  // 組(同じページの言語版の集まり)を決める。
  // - 印の無いファイルは元の名前の完全一致だけで組にする(CLI.md と cli.md は今までどおり別のページ)。
  // - 印付きは完全一致の組を優先し、無ければ大文字・小文字を区別せず一致する組(見つかった順で最初)に入れる。
  //   crawler が翻訳を isVariantName(大文字・小文字無視)で探すのと合わせるため。
  /** @type {Map<string, { first: number, rels: string[] }>} 組の名前 → 組 */
  const groups = new Map();
  const findGroup = (key) => {
    if (groups.has(key)) return key;
    const lower = key.toLowerCase();
    let best = null;
    for (const [k, g] of groups) {
      if (k.toLowerCase() === lower && (best === null || g.first < groups.get(best).first)) best = k;
    }
    return best;
  };
  const join = (rel, groupKey) => {
    const meta = info.get(rel);
    if (!groups.has(groupKey)) groups.set(groupKey, { first: meta.index, rels: [] });
    const g = groups.get(groupKey);
    g.first = Math.min(g.first, meta.index);
    g.rels.push(rel);
    meta.group = groupKey;
  };
  for (const [rel, meta] of info) if (!meta.marked) join(rel, meta.key);
  for (const [rel, meta] of info) if (meta.marked) join(rel, findGroup(meta.key) ?? meta.key);

  // 組と言語ごとに、残すファイルを決める(印付きの最初 → 無ければ印の無いものの最初)
  /** @type {Map<string, Map<string, string>>} 組の名前 → (言語 → 残す rel)。組は見つかった順 */
  const keptByKey = new Map();
  for (const [key] of [...groups].sort((a, b) => a[1].first - b[1].first)) keptByKey.set(key, new Map());
  for (const [rel, { group: key, tag, marked }] of info) {
    const group = keptByKey.get(key);
    const cur = group.get(tag);
    if (cur === undefined || (marked && !info.get(cur).marked)) group.set(tag, rel);
  }

  // 残さなかったものを、見つかった順に excluded・shadowed に振り分ける
  const excluded = [];
  const shadowed = [];
  const kept = new Set();
  for (const [rel, { group: key, tag, marked }] of info) {
    const keptRel = keptByKey.get(key).get(tag);
    if (keptRel === rel) kept.add(rel);
    else if (!marked && info.get(keptRel).marked) shadowed.push({ rel, keptRel });
    else excluded.push({ rel, keptRel });
  }

  /** @type {Map<string, Map<string, string>>} */
  const byBase = new Map();
  for (const [key, group] of keptByKey) {
    byBase.set(key, new Map(ctx.languages.filter((t) => group.has(t)).map((t) => [t, group.get(t)])));
  }

  const alternatesOf = (rel) => {
    const meta = info.get(rel);
    return new Map(meta ? byBase.get(meta.group) : []);
  };

  // ROOT_MD の元の名前の組(完全一致を優先し、無ければ大文字・小文字を区別せずに探す)
  const rootKey = findGroup(keyOf(ctx.rootMd));
  const rootOf = (tag) => {
    const t = canonical(tag);
    return (t && rootKey !== null && byBase.get(rootKey).get(t)) || null;
  };

  // フォルダ → そのフォルダに直接ある、残したファイル(見つかった順)
  const keptByDir = new Map();
  for (const rel of kept) {
    const i = rel.lastIndexOf("/");
    const dir = i < 0 ? "" : rel.slice(0, i);
    if (!keptByDir.has(dir)) keptByDir.set(dir, []);
    keptByDir.get(dir).push({ rel, name: rel.slice(i + 1), marked: info.get(rel).marked });
  }

  const dirIndexOf = (dir, tag) => {
    const t = canonical(tag);
    if (!t) return null;
    const d = String(dir ?? "").replace(/\/+$/, "");
    const files = keptByDir.get(d === "." ? "" : d) ?? [];
    const names = ctx.dirIndexNames(t);
    // index 型を優先。型ごとに印付きを優先し、無ければ印の無いもの
    for (const [kind, test] of [["index", names.isIndex], ["readme", names.isReadme]]) {
      const hits = files.filter((f) => test(f.name));
      const hit = hits.find((f) => f.marked) ?? hits[0];
      if (hit) return { rel: hit.rel, kind };
    }
    return null;
  };

  return Object.freeze({ byBase, alternatesOf, rootOf, dirIndexOf, excluded, shadowed });
}

function deepFreeze(obj) {
  for (const value of Object.values(obj)) {
    if (value && typeof value === "object") deepFreeze(value);
  }
  return Object.freeze(obj);
}
