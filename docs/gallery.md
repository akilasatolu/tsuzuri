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
| [和(wa)](gallery/wa.md) | `THEME=wa` | 生成り地に墨色の文字、朱色の控えめなリンク。ライト/ダークモードを自動で切り替える標準スタイル(既定)。 |
| [無地(muji)](gallery/muji.md) | `THEME=muji` | 装飾を極力削った、モノスペースフォント中心の最小構成。 |
| [墨(sumi)](gallery/sumi.md) | `THEME=sumi` | OSの設定に関わらず常にダーク表示。リンクは下側の罫線で表現。 |
| [藍(ai)](gallery/ai.md) | `THEME=ai` | 深い藍色を基調にした落ち着いた配色。見出しに下線的な強調。 |
| [朱(shu)](gallery/shu.md) | `THEME=shu` | 朱色を効かせた力強い配色。太字の見出しと太めの下線のリンク。 |
| [装飾なし(none)](gallery/none.md) | `THEME=none` | テーマ層を適用せず、基礎CSSとブラウザ既定の見た目だけで表示。 |

各ページは、frontmatterの`theme`キーでそのページだけテーマを切り替えて作っています
(サイト全体のテーマは`wa`のままです)。設定方法は[テーマ・スタイル](theming.md)と
[Frontmatterリファレンス](frontmatter.md#theme)を参照してください。

配色をさらに細かく調整したい場合は、`STYLE_FILE`で指定した独自CSSでCSS変数
(`--fg`・`--bg`・`--accent`など)を上書きできます。
