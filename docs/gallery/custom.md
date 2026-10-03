---
title: 独自CSSの例(このサイト)
description: THEME=noneと独自CSS(STYLE_FILE)だけで作った、このサイト自身の見た目の見本ページ
---

# 独自CSSの例(このサイト)

組み込みテーマを使わず(`THEME=none`)、`STYLE_FILE`の独自CSSだけで作った見た目です。
このサイト全体がこの見た目になっています。Tsuzuri(綴り)の名前とロゴをそのまま形にした「スレッド」のデザインで、
本文の左にページを綴じる1本の糸が通り、h1 はロゴの中心のような灯った点から、h2 は糸の上の結び目になります。
糸は読み進めるほど上から炎の色に染まり、結び目は読んだ章まで灯るので、どこまで読んだかが分かります。
ナビは、ページどうしが線でつながる木の形です。

使っているCSSは[custom.css](https://github.com/akilasatolu/tsuzuri/blob/docs/.github/tsuzuri/styles/custom.css)です。
書き方は[テーマ・スタイル](../theming.md#独自cssでカスタマイズする)を参照してください。

[← 装飾なし(none)](none.md) ・ [ギャラリー一覧](../gallery.md)

## 見出しレベル2

段落のテキストです。**太字**、*斜体*、~~取り消し線~~、`インラインコード`、
[サイト内リンク](../getting-started.md)、[外部リンク](https://github.com/akilasatolu/tsuzuri)を含みます。
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
| `THEME` | `material` | 組み込みテーマ名 |
| `NAV_ENABLED` | `false` | ナビゲーションの表示 |
| `LANG` | `ja` | `<html lang>`の値 |

```js
// コードブロック
import { marked } from "marked";
console.log(marked.parse("# Hello Tsuzuri"));
```

---

![Tsuzuriのロゴ](../../assets/favicon.svg)

[← 装飾なし(none)](none.md) ・ [ギャラリー一覧](../gallery.md)
