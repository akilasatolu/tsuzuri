---
title: マテリアル(material)
theme: material
styleFile: .github/tsuzuri/styles/plain.css
description: Tsuzuriの組み込みテーマ「マテリアル(material)」の見本ページ
---

# マテリアル(material)

Material Design 3 風。青系の配色、角丸のカードと影、トーンのついたナビの選択。

このテーマをサイト全体で使うには、`.github/docs-pages.config`で`THEME=material`を指定します。
1ページだけ使う場合は、そのページのfrontmatterに`theme: material`と書きます
([テーマ・スタイル](../theming.ja.md)参照)。

[ギャラリー一覧](../gallery.ja.md) ・ [グラス(glass) →](glass.ja.md)

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

[ギャラリー一覧](../gallery.ja.md) ・ [グラス(glass) →](glass.ja.md)
