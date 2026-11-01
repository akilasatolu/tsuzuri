---
title: スタイルギャラリー
description: Tsuzuriのスタイルの見た目を実際のページで比較でき、ダウンロードもできるスタイルギャラリー
order: 0
---

# スタイルギャラリー

Tsuzuriのスタイルの見た目を、実際に生成されたページで確認し、気に入ったものをダウンロードできます。
タイルをクリックすると、各スタイルで同じ見本(見出し・段落・リンク・リスト・表・コード・引用・画像)が並んだ
見本ページが開くので、見比べながら選んでください。スクリーンショットはスワイプするか、下のドットを押すと、
ライトとダークの見た目を見られます。ボタンから、CSSファイルをダウンロードできます。

## カスタムスタイルの使い方

1. 気に入ったスタイルのボタンから、CSSファイルをダウンロードする。
2. リポジトリの`.github/tsuzuri/styles/`に置く。
3. `.github/tsuzuri/config`の`THEME`を、そのファイル名に変える(例: `THEME=glass.css`)。

`default.css`はパッケージに入っているので、ダウンロードしなくても使えます(`init`が`.github/tsuzuri/styles/`に置きます)。
1ページだけで使う場合は、そのページのfrontmatterに`theme: glass.css`と書きます
([Frontmatterリファレンス](../docs/reference/frontmatter.ja.md#theme)・[見た目を変える](../docs/guides/style.ja.md)参照)。
配色をさらに細かく調整したい場合は、`default.css`を別の名前にコピーして、CSS変数(`--fg`・`--bg`・`--accent`など)を上書きし、
`THEME`に指定します([見た目を変える](../docs/guides/style.ja.md#自分でカスタムスタイルを作る)参照)。

## スタイル

<div class="tsuzuri-tiles">

<div class="tsuzuri-tile">

<div class="tsuzuri-carousel">
<img src="../assets/gallery/default-light.png" alt="Default(ライト)">
<img src="../assets/gallery/default-dark.png" alt="Default(ダーク)">
</div>

### [Default](default.ja.md)

<a class="tsuzuri-button" href="../.github/tsuzuri/styles/default.css" download>default.css</a>

</div>

<div class="tsuzuri-tile">

<div class="tsuzuri-carousel">
<img src="../assets/gallery/glass-light.png" alt="Glass(ライト)">
<img src="../assets/gallery/glass-dark.png" alt="Glass(ダーク)">
</div>

### [Glass](glass.ja.md)

<a class="tsuzuri-button" href="../.github/tsuzuri/styles/glass.css" download>glass.css</a>

</div>

<div class="tsuzuri-tile">

<div class="tsuzuri-carousel">
<img src="../assets/gallery/neumorphism-light.png" alt="Neumorphism(ライト)">
<img src="../assets/gallery/neumorphism-dark.png" alt="Neumorphism(ダーク)">
</div>

### [Neumorphism](neumorphism.ja.md)

<a class="tsuzuri-button" href="../.github/tsuzuri/styles/neumorphism.css" download>neumorphism.css</a>

</div>

<div class="tsuzuri-tile">

<div class="tsuzuri-carousel">
<img src="../assets/gallery/editorial-light.png" alt="Editorial(ライト)">
<img src="../assets/gallery/editorial-dark.png" alt="Editorial(ダーク)">
</div>

### [Editorial](editorial.ja.md)

<a class="tsuzuri-button" href="../.github/tsuzuri/styles/editorial.css" download>editorial.css</a>

</div>

<div class="tsuzuri-tile">

<div class="tsuzuri-carousel">
<img src="../assets/gallery/minimal-light.png" alt="Minimal(ライト)">
<img src="../assets/gallery/minimal-dark.png" alt="Minimal(ダーク)">
</div>

### [Minimal](minimal.ja.md)

<a class="tsuzuri-button" href="../.github/tsuzuri/styles/minimal.css" download>minimal.css</a>

</div>

<div class="tsuzuri-tile">

<div class="tsuzuri-carousel">
<img src="../assets/gallery/kintsugi-light.png" alt="Kintsugi(ライト)">
<img src="../assets/gallery/kintsugi-dark.png" alt="Kintsugi(ダーク)">
</div>

### [Kintsugi](kintsugi.ja.md)

<a class="tsuzuri-button" href="../.github/tsuzuri/styles/kintsugi.css" download>kintsugi.css</a>

</div>

<div class="tsuzuri-tile">

<div class="tsuzuri-carousel">
<img src="../assets/gallery/blueprint-light.png" alt="Blueprint(ライト)">
</div>

### [Blueprint](blueprint.ja.md)

<a class="tsuzuri-button" href="../.github/tsuzuri/styles/blueprint.css" download>blueprint.css</a>

</div>

<div class="tsuzuri-tile">

<div class="tsuzuri-carousel">
<img src="../assets/gallery/nineties-light.png" alt="90s(ライト)">
</div>

### [90s](nineties.ja.md)

<a class="tsuzuri-button" href="../.github/tsuzuri/styles/nineties.css" download>nineties.css</a>

</div>

<div class="tsuzuri-tile">

<div class="tsuzuri-carousel">
<img src="../assets/gallery/none-light.png" alt="None(ライト)">
</div>

### [None](none.ja.md)

<a class="tsuzuri-button" href="../.github/tsuzuri/styles/none.css" download>none.css</a>

</div>

<div class="tsuzuri-tile">

<div class="tsuzuri-carousel">
<img src="../assets/gallery/tsuzuri-light.png" alt="Tsuzuri(ライト)">
<img src="../assets/gallery/tsuzuri-dark.png" alt="Tsuzuri(ダーク)">
</div>

### [Tsuzuri](tsuzuri.ja.md)

<a class="tsuzuri-button" href="../.github/tsuzuri/styles/tsuzuri.css" download>tsuzuri.css</a>

</div>

</div>

## ユーザーのスタイル

ユーザーのスタイルは、まだありません。あなたのスタイルを載せたいときは、[お問い合わせ](../docs/contact.ja.md)を見てください。
