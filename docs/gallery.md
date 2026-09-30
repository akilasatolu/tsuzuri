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
| [グラス(glass)](gallery/glass.md) | `THEME=glass` | Glassmorphism。ゆっくり揺れて流れるオーロラの地に、色がそのまま透ける薄い透明なガラスのカード。 |
| [ニューモーフィズム(neumorphism)](gallery/neumorphism.md) | `THEME=neumorphism` | Neumorphism。地と同じ色の部品が、光と影で浮き出したりへこんだりする。 |
| [エディトリアル(editorial)](gallery/editorial.md) | `THEME=editorial` | 雑誌や上質なドキュメントのような、文字組と余白で見せるスタイル。大きな明朝体の見出しと章の番号、朱色の差し色。 |
| [ミニマル(minimal)](gallery/minimal.md) | `THEME=minimal` | Vercel や Linear のドキュメントのような、白・黒・グレーだけの落ち着いた見た目。リンクだけ青。 |
| [ターミナル(terminal)](gallery/terminal.md) | `THEME=terminal` | コマンドラインの画面のような、黒い画面に等幅の文字、プロンプト付きの見出しと点滅するカーソル。常にダーク表示。 |
| [ブループリント(blueprint)](gallery/blueprint.md) | `THEME=blueprint` | 設計図(青焼き)のような、青い地に白い方眼と細線、寸法線付きの見出し。常に同じ表示。 |
| [ノート(notebook)](gallery/notebook.md) | `THEME=notebook` | 罫線ノートのページに、蛍光ペンの見出しと付箋のような引用。学習サイト向けのやさしい見た目。 |
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
