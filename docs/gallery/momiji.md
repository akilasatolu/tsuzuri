---
title: 紅葉(momiji)
theme: momiji
styleFile: .github/tsuzuri/styles/plain.css
description: Tsuzuriの組み込みテーマ「紅葉(momiji)」の見本ページ
---

# 紅葉(momiji)

秋の庭園がテーマ。生成りの地に紅葉の紅・橙・黄金。h2の印は紅葉の葉、h1の下に紅から黄金へ移る帯、ページの右上に散る紅葉。ライト/ダークモードを自動で切り替える。

このテーマをサイト全体で使うには、`.github/docs-pages.config`で`THEME=momiji`を指定します。
1ページだけ使う場合は、そのページのfrontmatterに`theme: momiji`と書きます
([テーマ・スタイル](../theming.md)参照)。

[← 竹(take)](take.md) ・ [ギャラリー一覧](../gallery.md) ・ [藤(fuji) →](fuji.md)

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

[← 竹(take)](take.md) ・ [ギャラリー一覧](../gallery.md) ・ [藤(fuji) →](fuji.md)
