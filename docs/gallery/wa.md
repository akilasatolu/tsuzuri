---
title: 和(wa)
theme: wa
styleFile: .github/tsuzuri/styles/plain.css
description: Tsuzuriの組み込みテーマ「和(wa)」の見本ページ
---

# 和(wa)

墨絵と江戸がテーマの標準スタイル(既定)。和紙の地に墨一色を基本にし、差し色は江戸の朱の落款だけ。h1の下に筆で払った墨の線と朱の落款、h2の左に縦の筆跡、h3に朱の角印。ライト/ダークモードを自動で切り替える。

このテーマをサイト全体で使うには、`.github/docs-pages.config`で`THEME=wa`を指定します。
1ページだけ使う場合は、そのページのfrontmatterに`theme: wa`と書きます
([テーマ・スタイル](../theming.md)参照)。

[ギャラリー一覧](../gallery.md) ・ [桜(sakura) →](sakura.md)

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

[ギャラリー一覧](../gallery.md) ・ [桜(sakura) →](sakura.md)
