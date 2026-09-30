---
title: テーマギャラリー(Gallery)
description: Tsuzuriの組み込みテーマの見た目を実際のページで比較できるギャラリー
---

# テーマギャラリー(Gallery)

Tsuzuriの組み込みテーマの見た目を、実際に生成されたページで確認できます。
各ページには同じ見本(見出し・段落・リンク・リスト・表・コード・引用・画像)が
並んでいるので、見比べながらテーマを選んでください。

| テーマ | 設定値 | 特徴 |
|---|---|---|
| [マテリアル(material)](gallery/material.md) | `THEME=material` | Material Design 3 風の標準スタイル(既定)。青系の配色、角丸のカードと影、トーンのついたナビの選択。ライト/ダークモードを自動で切り替える。 |
| [グラス(glass)](gallery/glass.md) | `THEME=glass` | Glassmorphism。丸い色の形を置いた淡い地に、形がぼやけて透けるすりガラスのような半透明のカード。 |
| [ニューモーフィズム(neumorphism)](gallery/neumorphism.md) | `THEME=neumorphism` | Neumorphism。地と同じ色の部品が、光と影で浮き出したりへこんだりする。 |
| [フロスト(frosted)](gallery/frosted.md) | `THEME=frosted` | Frosted Glass。白く曇った厚いすりガラスと細かな霜のざらつき、氷の青。 |
| [90年代(nineties)](gallery/nineties.md) | `THEME=nineties` | 90s Nostalgia。Windows 95 風の青緑のデスクトップと灰色のウィンドウ、立体のボタン。ライト表示のみ。 |
| [装飾なし(none)](gallery/none.md) | `THEME=none` | テーマ層を適用せず、基礎CSSとブラウザ既定の見た目だけで表示。 |
| [独自CSSの例(このサイト)](gallery/custom.md) | `THEME=none`+`STYLE_FILE` | テーマを使わず、独自CSSだけで作ったこのサイト自身の見た目。 |

このサイト全体は、`THEME=none`と独自CSS(`STYLE_FILE`)で作っています。テーマの各ページは、
frontmatterの`theme`でそのページのテーマを指定し、`styleFile`で中身が空のCSSを指定して
サイトの独自CSSを当てないようにしています(組み込みテーマだけの見た目になります)。

```yaml
---
theme: material
styleFile: .github/tsuzuri/styles/plain.css
---
```

設定方法は[テーマ・スタイル](theming.md)と[Frontmatterリファレンス](frontmatter.md#theme)を参照してください。

配色をさらに細かく調整したい場合は、`STYLE_FILE`で指定した独自CSSでCSS変数
(`--fg`・`--bg`・`--accent`など)を上書きできます。
