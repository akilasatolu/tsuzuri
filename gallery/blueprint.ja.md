---
title: ブループリント(blueprint)
theme: blueprint.css
description: カスタムスタイル「ブループリント(blueprint)」の見本ページ
nav: false
---

# ブループリント(blueprint)

設計図(青焼き)のような、青い地に白い方眼と細線、寸法線付きの見出し。常に同じ表示。

使うには、[ギャラリー](README.ja.md#ブループリントblueprint)で`blueprint.css`をダウンロードし、`.github/tsuzuri/styles/`に置いて、
`.github/tsuzuri/config`で`THEME=blueprint.css`を指定します。
1ページだけ使う場合は、そのページのfrontmatterに`theme: blueprint.css`と書きます
([見た目を変える](../docs/guides/style.ja.md)参照)。

[← 金継ぎ(kintsugi)](kintsugi.ja.md) ・ [ギャラリー一覧](README.ja.md) ・ [90年代(nineties) →](nineties.ja.md)

## 見出しレベル2

段落のテキストです。**太字**、*斜体*、~~取り消し線~~、`インラインコード`、
[サイト内リンク](../docs/getting-started.ja.md)、[外部リンク](https://github.com/akilasatolu/tsuzuri)を含みます。
長めの文章が続いたときの行送りや文字の読みやすさも、このあたりで確認できます。

### 見出しレベル3

- 箇条書きの項目1
- 箇条書きの項目2
  - 入れ子の項目

1. 番号付きリスト1
2. 番号付きリスト2

#### 見出しレベル4

> 引用ブロックです。ほかのドキュメントからの引用や、補足の説明に使います。

| 設定キー | 既定値 | 説明 |
|---|---|---|
| `THEME` | `default.css` | カスタムスタイルのファイル名 |
| `NAV_ENABLED` | `false` | ナビゲーションの表示 |
| `LANGUAGES` | `en` | サイトの言語(`<html lang>`の値) |

```js
// コードブロック
import { marked } from "marked";
console.log(marked.parse("# Hello Tsuzuri"));
```

---

![Tsuzuriのロゴ](../assets/favicon.svg)

[← 金継ぎ(kintsugi)](kintsugi.ja.md) ・ [ギャラリー一覧](README.ja.md) ・ [90年代(nineties) →](nineties.ja.md)
