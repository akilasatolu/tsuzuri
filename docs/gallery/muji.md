---
title: 無地(muji)
theme: muji
styleFile: .github/tsuzuri/styles/plain.css
description: Tsuzuriの組み込みテーマ「無地(muji)」の見本ページ
---

# 無地(muji)

色を使わない白と黒だけの最小構成。見出し・ナビ・コードは等幅フォント、本文は読みやすいゴシック体。技術文書・README集向け。

このテーマをサイト全体で使うには、`.github/docs-pages.config`で`THEME=muji`を指定します。
1ページだけ使う場合は、そのページのfrontmatterに`theme: muji`と書きます
([テーマ・スタイル](../theming.md)参照)。

[← 和(wa)](wa.md) ・ [ギャラリー一覧](../gallery.md) ・ [墨(sumi) →](sumi.md)

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

[← 和(wa)](wa.md) ・ [ギャラリー一覧](../gallery.md) ・ [墨(sumi) →](sumi.md)
