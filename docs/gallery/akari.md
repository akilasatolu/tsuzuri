---
title: 灯(akari)
theme: akari
styleFile: .github/tsuzuri/styles/plain.css
description: Tsuzuriの組み込みテーマ「灯(akari)」の見本ページ
---

# 灯(akari)

暗闇に灯る灯籠がテーマ。夜の闇の地に、灯籠の炎の灯り(芯の淡い黄から橙・紅へ)を淡くにじませる。見出しの印は小さな灯籠の形で、炎が揺らぐようにかすかに明滅する。常にダーク表示。

このテーマをサイト全体で使うには、`.github/docs-pages.config`で`THEME=akari`を指定します。
1ページだけ使う場合は、そのページのfrontmatterに`theme: akari`と書きます
([テーマ・スタイル](../theming.md)参照)。

[← 月(tsuki)](tsuki.md) ・ [ギャラリー一覧](../gallery.md) ・ [雪(yuki) →](yuki.md)

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

[← 月(tsuki)](tsuki.md) ・ [ギャラリー一覧](../gallery.md) ・ [雪(yuki) →](yuki.md)
