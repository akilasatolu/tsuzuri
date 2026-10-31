---
title: ギャラリー(Gallery)
description: Tsuzuriのカスタムスタイルの見た目を実際のページで比較でき、ダウンロードもできるギャラリー
order: 10
---

# ギャラリー(Gallery)

Tsuzuriのカスタムスタイルの見た目を、実際に生成されたページで確認し、気に入ったものをダウンロードできます。
タイルをクリックすると、各スタイルで同じ見本(見出し・段落・リンク・リスト・表・コード・引用・画像)が並んだ
見本ページが開くので、見比べながら選んでください。スクリーンショットの下の矢印やドットで、ライトとダークの見た目を
見られます。タイルのボタンから、CSSファイルをダウンロードできます。

## カスタムスタイルの使い方

1. 気に入ったスタイルのタイルにあるボタンから、CSSファイルをダウンロードする。
2. リポジトリの`.github/tsuzuri/styles/`に置く。
3. `.github/tsuzuri/config`の`THEME`を、そのファイル名に変える(例: `THEME=glass.css`)。

`default.css`はパッケージに入っているので、ダウンロードしなくても使えます(`init`が`.github/tsuzuri/styles/`に置きます)。
1ページだけで使う場合は、そのページのfrontmatterに`theme: glass.css`と書きます
([Frontmatterリファレンス](../docs/reference/frontmatter.ja.md#theme)・[見た目を変える](../docs/guides/style.ja.md)参照)。
配色をさらに細かく調整したい場合は、`default.css`を別の名前にコピーして、CSS変数(`--fg`・`--bg`・`--accent`など)を上書きし、
`THEME`に指定します([見た目を変える](../docs/guides/style.ja.md#自分でカスタムスタイルを作る)参照)。

## Tsuzuriのスタイル

<div class="tsuzuri-tiles">

<div class="tsuzuri-tile">

<div class="tsuzuri-carousel">
<img src="../assets/gallery/default-light.png" alt="default(ライト)">
<img src="../assets/gallery/default-dark.png" alt="default(ダーク)">
</div>

### [デフォルト(default)](default.ja.md)

Material Design 3 風の標準スタイル(既定)。青系の配色、角丸のカードと影、トーンのついたナビの選択。ライト/ダークモードを自動で切り替える。

パッケージに入っているので、ダウンロードしなくても使えます。ボタンでコピーを取れます。

<a class="tsuzuri-button" href="../.github/tsuzuri/styles/default.css" download>ダウンロード: default.css</a>

</div>

<div class="tsuzuri-tile">

<div class="tsuzuri-carousel">
<img src="../assets/gallery/glass-light.png" alt="glass(ライト)">
<img src="../assets/gallery/glass-dark.png" alt="glass(ダーク)">
</div>

### [グラス(glass)](glass.ja.md)

Glassmorphism。ゆっくり揺れて流れるオーロラの地に、色がそのまま透ける薄い透明なガラスのカード。

<a class="tsuzuri-button" href="../.github/tsuzuri/styles/glass.css" download>ダウンロード: glass.css</a>

</div>

<div class="tsuzuri-tile">

<div class="tsuzuri-carousel">
<img src="../assets/gallery/neumorphism-light.png" alt="neumorphism(ライト)">
<img src="../assets/gallery/neumorphism-dark.png" alt="neumorphism(ダーク)">
</div>

### [ニューモーフィズム(neumorphism)](neumorphism.ja.md)

Neumorphism。地と同じ色の部品が、光と影で浮き出したりへこんだりする。

<a class="tsuzuri-button" href="../.github/tsuzuri/styles/neumorphism.css" download>ダウンロード: neumorphism.css</a>

</div>

<div class="tsuzuri-tile">

<div class="tsuzuri-carousel">
<img src="../assets/gallery/editorial-light.png" alt="editorial(ライト)">
<img src="../assets/gallery/editorial-dark.png" alt="editorial(ダーク)">
</div>

### [エディトリアル(editorial)](editorial.ja.md)

雑誌や上質なドキュメントのような、文字組と余白で見せるスタイル。大きな明朝体の見出しと章の番号、朱色の差し色。

<a class="tsuzuri-button" href="../.github/tsuzuri/styles/editorial.css" download>ダウンロード: editorial.css</a>

</div>

<div class="tsuzuri-tile">

<div class="tsuzuri-carousel">
<img src="../assets/gallery/minimal-light.png" alt="minimal(ライト)">
<img src="../assets/gallery/minimal-dark.png" alt="minimal(ダーク)">
</div>

### [ミニマル(minimal)](minimal.ja.md)

Vercel や Linear のドキュメントのような、白・黒・グレーだけの落ち着いた見た目。リンクだけ青。

<a class="tsuzuri-button" href="../.github/tsuzuri/styles/minimal.css" download>ダウンロード: minimal.css</a>

</div>

<div class="tsuzuri-tile">

<div class="tsuzuri-carousel">
<img src="../assets/gallery/kintsugi-light.png" alt="kintsugi(ライト)">
<img src="../assets/gallery/kintsugi-dark.png" alt="kintsugi(ダーク)">
</div>

### [金継ぎ(kintsugi)](kintsugi.ja.md)

割れた器を漆と金で継ぐ「金継ぎ」のスタイル。白磁のようなカードに金の継ぎ目が走り、コードブロックは漆の黒。ライト表示は白磁、ダーク表示は黒漆。

<a class="tsuzuri-button" href="../.github/tsuzuri/styles/kintsugi.css" download>ダウンロード: kintsugi.css</a>

</div>

<div class="tsuzuri-tile">

<div class="tsuzuri-carousel">
<img src="../assets/gallery/blueprint-light.png" alt="blueprint">
</div>

### [ブループリント(blueprint)](blueprint.ja.md)

設計図(青焼き)のような、青い地に白い方眼と細線、寸法線付きの見出し。常に同じ表示。

<a class="tsuzuri-button" href="../.github/tsuzuri/styles/blueprint.css" download>ダウンロード: blueprint.css</a>

</div>

<div class="tsuzuri-tile">

<div class="tsuzuri-carousel">
<img src="../assets/gallery/nineties-light.png" alt="nineties">
</div>

### [90年代(nineties)](nineties.ja.md)

90s Nostalgia。Windows 95 風の青緑のデスクトップと灰色のウィンドウ、立体のボタン。ライト表示のみ。

<a class="tsuzuri-button" href="../.github/tsuzuri/styles/nineties.css" download>ダウンロード: nineties.css</a>

</div>

<div class="tsuzuri-tile">

<div class="tsuzuri-carousel">
<img src="../assets/gallery/none-light.png" alt="none">
</div>

### [装飾なし(none)](none.ja.md)

ベースだけを適用し、ブラウザ既定の見た目で表示します。`none.css`はコメントだけのCSSファイルです。

<a class="tsuzuri-button" href="../.github/tsuzuri/styles/none.css" download>ダウンロード: none.css</a>

</div>

<div class="tsuzuri-tile">

<div class="tsuzuri-carousel">
<img src="../assets/gallery/tsuzuri-light.png" alt="tsuzuri(ライト)">
<img src="../assets/gallery/tsuzuri-dark.png" alt="tsuzuri(ダーク)">
</div>

### [Tsuzuri(このサイト)](tsuzuri.ja.md)

このサイト自身の見た目。自分用のカスタムスタイルだけで作っています。

<a class="tsuzuri-button" href="../.github/tsuzuri/styles/tsuzuri.css" download>ダウンロード: tsuzuri.css</a>

</div>

</div>

## ユーザーが掲載したスタイル

ユーザーが掲載したスタイルは、まだありません。掲載したいときは、[掲載・お問い合わせ](../docs/contact.ja.md)を見てください。
