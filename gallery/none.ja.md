---
title: None
theme: none.css
description: スタイル「None」の見本ページ
order: 90
---

# None

<a class="tsuzuri-button" href="../.github/tsuzuri/styles/none.css" download>none.css</a>

ベースだけを適用し、ブラウザ既定の見た目で表示します。`none.css`はコメントだけのCSSファイルです。

使うには、上のボタン([スタイルギャラリー](style-gallery.ja.md)でも可)で`none.css`をダウンロードし、`.github/tsuzuri/styles/`に置いて、
`.github/tsuzuri/config`で`THEME=none.css`を指定します。
1ページだけ使う場合は、そのページのfrontmatterに`theme: none.css`と書きます
([見た目を変える](../docs/guides/style.ja.md)参照)。

[← 90s](nineties.ja.md) ・ [スタイルギャラリー](style-gallery.ja.md) ・ [Tsuzuri →](tsuzuri.ja.md)

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

[← 90s](nineties.ja.md) ・ [スタイルギャラリー](style-gallery.ja.md) ・ [Tsuzuri →](tsuzuri.ja.md)
