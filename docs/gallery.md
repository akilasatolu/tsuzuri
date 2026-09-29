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
| [和(wa)](gallery/wa.md) | `THEME=wa` | 生成り地に墨色の文字、朱色の控えめなリンク。見出しは明朝体で、和紙のような落ち着いた紙面。ライト/ダークモードを自動で切り替える標準スタイル(既定)。 |
| [宙(sora)](gallery/sora.md) | `THEME=sora` | 宇宙がテーマ。星をちりばめた夜空の地に、星の光の水色と星雲の紫の差し色。常にダーク表示。星は控えめにして読みやすさを優先。 |
| [墨(sumi)](gallery/sumi.md) | `THEME=sumi` | OSの設定に関わらず常にダーク表示。墨色の地に温かみのある白い文字と、淡い青の差し色。夜間や長く読む資料向け。 |
| [藍(ai)](gallery/ai.md) | `THEME=ai` | 深い藍色を基調にした落ち着いた配色。藍色の見出し(下線・左の帯)と、藍白の見出し行・行の色分けの表で、マニュアル・仕様書向け。 |
| [朱(shu)](gallery/shu.md) | `THEME=shu` | 朱色を効かせた力強い配色。朱の太い下線・帯の見出しと、朱の見出し行の表。製品紹介・告知など印象を残したいページ向け。 |
| [装飾なし(none)](gallery/none.md) | `THEME=none` | テーマ層を適用せず、基礎CSSとブラウザ既定の見た目だけで表示。 |
| [独自CSSの例(このサイト)](gallery/custom.md) | `THEME=none`+`STYLE_FILE` | テーマを使わず、独自CSSだけで作ったこのサイト自身の見た目。 |

このサイト全体は、`THEME=none`と独自CSS(`STYLE_FILE`)で作っています。テーマの各ページは、
frontmatterの`theme`でそのページのテーマを指定し、`styleFile`で中身が空のCSSを指定して
サイトの独自CSSを当てないようにしています(組み込みテーマだけの見た目になります)。

```yaml
---
theme: wa
styleFile: .github/tsuzuri/styles/plain.css
---
```

設定方法は[テーマ・スタイル](theming.md)と[Frontmatterリファレンス](frontmatter.md#theme)を参照してください。

配色をさらに細かく調整したい場合は、`STYLE_FILE`で指定した独自CSSでCSS変数
(`--fg`・`--bg`・`--accent`など)を上書きできます。
