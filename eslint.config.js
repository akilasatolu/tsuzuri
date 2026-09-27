// ESLint flat config (ESM)
//
// 方針(設計書「OSS化に伴うCI設計」節): eslint:recommended をベースに、
// ESM/Node.js向けの最小限の設定を追加するミニマル構成。独自ルールの作り込みは行わない。
//
// eslint:recommended 相当を有効化するため、公式パッケージ `@eslint/js` の
// js.configs.recommended を使用する。Node.js標準グローバルは `globals` パッケージの
// globals.node を使用する(手動列挙はしない)。
import js from "@eslint/js";
import globals from "globals";

export default [
  {
    ignores: ["node_modules/**", "docs/**", "_site/**"],
  },
  js.configs.recommended,
  {
    files: ["**/*.js", "**/*.mjs", "test/**/*.mjs", ".github/scripts/**/*.mjs"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: globals.node,
    },
    rules: {},
  },
];
