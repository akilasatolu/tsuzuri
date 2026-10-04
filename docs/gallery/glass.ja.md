---
title: グラス(glass)
theme: glass
styleFile: .github/tsuzuri/styles/plain.css
description: Tsuzuriの組み込みテーマ「グラス(glass)」の見本ページ
---

# グラス(glass)

Glassmorphism。ゆっくり揺れて流れるオーロラの地に、色がそのまま透ける薄い透明なガラスのカード。

このテーマをサイト全体で使うには、`.github/docs-pages.config`で`THEME=glass`を指定します。
1ページだけ使う場合は、そのページのfrontmatterに`theme: glass`と書きます
([テーマ・スタイル](../theming.ja.md)参照)。

[← マテリアル(material)](material.ja.md) ・ [ギャラリー一覧](../gallery.ja.md) ・ [ニューモーフィズム(neumorphism) →](neumorphism.ja.md)

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

[← マテリアル(material)](material.ja.md) ・ [ギャラリー一覧](../gallery.ja.md) ・ [ニューモーフィズム(neumorphism) →](neumorphism.ja.md)
