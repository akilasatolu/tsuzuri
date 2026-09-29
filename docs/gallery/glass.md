---
title: グラス(glass)
theme: glass
styleFile: .github/tsuzuri/styles/plain.css
description: Tsuzuriの組み込みテーマ「グラス(glass)」の見本ページ
---

# グラス(glass)

Glassmorphism。色とりどりの光の地に、すりガラスのような半透明のカード。

このテーマをサイト全体で使うには、`.github/docs-pages.config`で`THEME=glass`を指定します。
1ページだけ使う場合は、そのページのfrontmatterに`theme: glass`と書きます
([テーマ・スタイル](../theming.md)参照)。

[← グレイン(grainy)](grainy.md) ・ [ギャラリー一覧](../gallery.md) ・ [ニューモーフィズム(neumorphism) →](neumorphism.md)

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
| `THEME` | `wa` | 組み込みテーマ名 |
| `NAV_ENABLED` | `false` | ナビゲーションの表示 |
| `LANG` | `ja` | `<html lang>`の値 |

```js
// コードブロック
import { marked } from "marked";
console.log(marked.parse("# Hello Tsuzuri"));
```

---

![Tsuzuriのロゴ](../../assets/favicon.svg)

[← グレイン(grainy)](grainy.md) ・ [ギャラリー一覧](../gallery.md) ・ [ニューモーフィズム(neumorphism) →](neumorphism.md)
