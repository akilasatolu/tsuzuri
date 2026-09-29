---
title: 歌舞伎(kabuki)
theme: kabuki
styleFile: .github/tsuzuri/styles/plain.css
description: Tsuzuriの組み込みテーマ「歌舞伎(kabuki)」の見本ページ
---

# 歌舞伎(kabuki)

歌舞伎がテーマ。定式幕の黒・柿色・萌葱色と、隈取の紅。明朝体の太い見出しに、定式幕の三色の帯と縦縞。表の見出し行は黒。ライト/ダークモードを自動で切り替える。

このテーマをサイト全体で使うには、`.github/docs-pages.config`で`THEME=kabuki`を指定します。
1ページだけ使う場合は、そのページのfrontmatterに`theme: kabuki`と書きます
([テーマ・スタイル](../theming.md)参照)。

[← 藍(ai)](ai.md) ・ [ギャラリー一覧](../gallery.md) ・ [装飾なし(none) →](none.md)

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

[← 藍(ai)](ai.md) ・ [ギャラリー一覧](../gallery.md) ・ [装飾なし(none) →](none.md)
