---
title: 更新する
description: コマンド1つで最新のTsuzuriに更新する。設定ファイルと自分のカスタムスタイルは変わらない
order: 50
---

# 更新する

更新はコマンド1つです。設定ファイルと自分のスタイルは変わりません。

## 最新版に更新する(`--update`)

一度`init`したリポジトリのtsuzuriを最新版にするには、`--update`を付けて実行します。

```
npx github:akilasatolu/tsuzuri#v1 init --update
```

質問や上書き確認は一切なく、次のように動きます。

| ファイル | `--update`での扱い |
|---|---|
| `.github/workflows/tsuzuri-pages.yml` | 最新版で上書き |
| `.github/tsuzuri/`配下のビルドスクリプト・`base.css`・`default.css` | 最新版で上書き(新しく増えたファイルは追加。最新版で使われなくなった`lib/`配下のスクリプトは削除)。`default.css`は上書きされるので、編集したいときは別の名前にコピーする。`styles/`のCSSは削除されない |
| `.github/tsuzuri/config` | **変更しない**(v1.27.0までに作った設定ファイルの`LANG`も、`LANGUAGES`に書き換えない) |
| `styles/`に自分で置いたカスタムスタイル(ギャラリーからダウンロードしたものや、自作のもの) | **変更しない**(削除もしない。昔の`material.css`などもそのまま残る) |

v1.27.0までに作った設定ファイル(`LANG`だけで`LANGUAGES`が無いもの)で`--update`すると、
「Keys missing from the settings file」(設定ファイルに無い項目。`--lang ja`なら「設定ファイルに無い項目があります」)として`LANGUAGES`が案内されます。言語を書かないとサイトは英語になる
ので、日本語のサイトなら`LANGUAGES=ja`を書き足し、`LANG`の行は消してください
([設定リファレンス](../reference/configuration.ja.md#languages)参照)。

`--lang`は`--update`が書く内容を変えません。例外は1つで、`init --update --lang ja`のときは、メッセージが日本語になります。
上書きされるワークフロー・`.gitignore`・`package.json`・CSSは、`--lang`の有無で変わりません。

実行後、`git diff`で変更内容を確認してからコミット・pushしてください。
`.github/tsuzuri/config`が無いリポジトリ(まだ`init`していない)で実行すると、
何も書き込まずにエラー終了します。初回は`--update`を付けずに実行してください。

## バージョンの固定・更新

ビルドスクリプト本体は`init`実行時に`.github/tsuzuri/`配下へコピーされるため、
**一度生成した後は、利用者側で何もしない限りバージョンが自動的に変わることはありません**
(以前のバージョンの`uses: ...@v1`のように、ワークフロー実行のたびに自動で最新化される
仕組みではなくなりました)。

最新版のtsuzuriに更新したい場合は、`--update`を付けてセットアップコマンドを実行してください。
ワークフローとビルドスクリプト(`base.css`と`default.css`を含む)だけが最新版に上書きされ、`.github/tsuzuri/config`や
`styles/`に置いたカスタムスタイルはそのまま残ります(詳しくは上の「最新版に更新する(`--update`)」を参照)。

```sh
npx github:akilasatolu/tsuzuri#v1 init --update
```

ビルド用の依存(marked など)も、`.github/tsuzuri/package-lock.json`に書かれた版とハッシュで固定されています
(v1.7.0以降)。`--update`を実行するまで変わりません。

特定のバージョンに固定したい場合は、タグを指定します。`#v1`はv1系の最新版(互換性を保ったまま更新される)、
`#v1.2.0`のように完全なバージョンを指定すると、そのリリースに固定されます。

```sh
npx github:akilasatolu/tsuzuri#v1.2.0 init --update
```

## refを固定して実行する

`npx github:akilasatolu/tsuzuri init`のように`ref`(バージョンやブランチ・タグ)を省略すると、
既定ブランチ(`main`)の最新版(まだリリースしていない変更を含むことがあります)が実行されます。
普段は`#v1`を付けて実行してください。ローカルのキャッシュや`npx`自体の実装によっては
古いバージョンが実行されてしまう場合もあるため、リリース済みのバージョンに固定したい場合は、
次のように`#v1`のようなタグを明示して実行してください。

```
npx github:akilasatolu/tsuzuri#v1 init
```

`v1`は互換性を保ったまま最新化されるタグです(破壊的変更が入る場合のみ`v2`が新設されます)。
「実行するたびに挙動が変わってしまう/最新の変更が反映されない」といった場合は、
まずこの`#v1`指定を試してください。

## 次に読む

- [FAQ](../faq.ja.md): うまくいかないとき。
- [リファレンス](../reference/README.ja.md): 設定や仕様を調べる。
