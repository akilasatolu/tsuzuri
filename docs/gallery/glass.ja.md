---
title: グラス(glass)
theme: glass.css
styleFile: plain.css
description: カスタムスタイル「グラス(glass)」の見本ページ
---

# グラス(glass)

Glassmorphism。ゆっくり揺れて流れるオーロラの地に、色がそのまま透ける薄い透明なガラスのカード。

使うには、[ギャラリー](../gallery.ja.md#グラスglass)で`glass.css`をダウンロードし、`.github/tsuzuri/styles/`に置いて、
`.github/tsuzuri/config`で`THEME=glass.css`を指定します。
1ページだけ使う場合は、そのページのfrontmatterに`theme: glass.css`と書きます
([スタイル(Theming)](../theming.ja.md)参照)。

[← デフォルト(default)](default.ja.md) ・ [ギャラリー一覧](../gallery.ja.md) ・ [ニューモーフィズム(neumorphism) →](neumorphism.ja.md)

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
| `THEME` | `default.css` | カスタムスタイルのファイル名 |
| `NAV_ENABLED` | `false` | ナビゲーションの表示 |
| `LANGUAGES` | `en` | サイトの言語(`<html lang>`の値) |

```js
// コードブロック
import { marked } from "marked";
console.log(marked.parse("# Hello Tsuzuri"));
```

---

![Tsuzuriのロゴ](../../assets/favicon.svg)

[← デフォルト(default)](default.ja.md) ・ [ギャラリー一覧](../gallery.ja.md) ・ [ニューモーフィズム(neumorphism) →](neumorphism.ja.md)
