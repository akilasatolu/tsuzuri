---
title: カスタムスタイルの例(このサイト)
description: このサイト自身のカスタムスタイルで作った、このサイト自身の見た目の見本ページ
---

# カスタムスタイルの例(このサイト)

このサイト自身のカスタムスタイル(`custom.css`)で作った見た目です。
このサイト全体がこの見た目になっています。Tsuzuri(綴り)の名前とロゴをそのまま形にした「スレッド」のデザインで、
本文の左にページを綴じる1本の糸が通り、h1 はロゴの中心のような灯った点から、h2 は糸の上の結び目になります。
糸は読み進めるほど上から炎の色に染まり、結び目は読んだ章まで灯るので、どこまで読んだかが分かります。
ナビは、ページどうしが線でつながる木の形です。

使っているCSSは[custom.css](https://github.com/akilasatolu/tsuzuri/blob/main/.github/tsuzuri/styles/custom.css)です。
書き方は[スタイル(Theming)](../theming.ja.md#自分でカスタムスタイルを作る)を参照してください。
自分のサイトで使うには、[ギャラリー](../gallery.ja.md#tsuzuriこのサイト)で`custom.css`をダウンロードし、
`.github/tsuzuri/styles/`に置いて、`THEME=custom.css`にします。

[← 装飾なし(none)](none.ja.md) ・ [ギャラリー一覧](../gallery.ja.md)

## 見出しレベル2

段落のテキストです。**太字**、*斜体*、~~取り消し線~~、`インラインコード`、
[サイト内リンク](../getting-started.ja.md)、[外部リンク](https://github.com/akilasatolu/tsuzuri)を含みます。
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

![Tsuzuriのロゴ](../../assets/favicon.svg)

[← 装飾なし(none)](none.ja.md) ・ [ギャラリー一覧](../gallery.ja.md)
