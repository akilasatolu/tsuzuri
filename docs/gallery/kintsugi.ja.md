---
title: 金継ぎ(kintsugi)
theme: kintsugi
styleFile: .github/tsuzuri/styles/plain.css
description: Tsuzuriの組み込みテーマ「金継ぎ(kintsugi)」の見本ページ
---

# 金継ぎ(kintsugi)

割れた器を漆と金で継ぐ「金継ぎ」のスタイル。白磁のようなカードに金の継ぎ目が走り、コードブロックは漆の黒。ライト表示は白磁、ダーク表示は黒漆。

このテーマをサイト全体で使うには、`.github/docs-pages.config`で`THEME=kintsugi`を指定します。
1ページだけ使う場合は、そのページのfrontmatterに`theme: kintsugi`と書きます
([テーマ・スタイル](../theming.ja.md)参照)。

[← ミニマル(minimal)](minimal.ja.md) ・ [ギャラリー一覧](../gallery.ja.md) ・ [ブループリント(blueprint) →](blueprint.ja.md)

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
| `THEME` | `material` | 組み込みテーマ名 |
| `NAV_ENABLED` | `false` | ナビゲーションの表示 |
| `LANGUAGES` | `en` | サイトの言語(`<html lang>`の値) |

```js
// コードブロック
import { marked } from "marked";
console.log(marked.parse("# Hello Tsuzuri"));
```

---

![Tsuzuriのロゴ](../../assets/favicon.svg)

[← ミニマル(minimal)](minimal.ja.md) ・ [ギャラリー一覧](../gallery.ja.md) ・ [ブループリント(blueprint) →](blueprint.ja.md)
