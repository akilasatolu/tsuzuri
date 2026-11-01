---
title: Kintsugi
theme: kintsugi.css
description: スタイル「Kintsugi」の見本ページ
order: 60
---

# Kintsugi

<a class="tzr-button" href="../.github/tsuzuri/styles/kintsugi.css" download>kintsugi.css</a>

割れた器を漆と金で継ぐ「金継ぎ」のスタイル。白磁のようなカードに金の継ぎ目が走り、コードブロックは漆の黒。ライト表示は白磁、ダーク表示は黒漆。

使うには、上のボタン([スタイルギャラリー](style-gallery.ja.md)でも可)で`kintsugi.css`をダウンロードし、`.github/tsuzuri/styles/`に置いて、
`.github/tsuzuri/config`で`THEME=kintsugi.css`を指定します。
1ページだけ使う場合は、そのページのfrontmatterに`theme: kintsugi.css`と書きます
([見た目を変える](../docs/guides/style.ja.md)参照)。

[← Minimal](minimal.ja.md) ・ [スタイルギャラリー](style-gallery.ja.md) ・ [Blueprint →](blueprint.ja.md)

## 見出しレベル2

段落のテキストです。**太字**、*斜体*、~~取り消し線~~、`インラインコード`、
[サイト内リンク](../docs/getting-started.ja.md)、[外部リンク](https://github.com/akilasatolu/tsuzuri)を含みます。
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

![Tsuzuriのロゴ](../assets/favicon.svg)

[← Minimal](minimal.ja.md) ・ [スタイルギャラリー](style-gallery.ja.md) ・ [Blueprint →](blueprint.ja.md)
