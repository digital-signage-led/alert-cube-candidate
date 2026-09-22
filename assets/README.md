# Assets

V2.0の共通表示資産を管理する。

| 役割 | 現在の場所 | 将来の置き場 |
|---|---|---|
| 共通ロゴ | `images/logo.svg` | `assets/common/` |
| V2.0天気アイコン | `data/jma-weather-icons.js` | 気象庁公式CDNの現行SVG |
| 案件専用 | なし | `assets/sites/AC-xxxx/` |

案件の logo path は `sites/AC-xxxx.json` の `logo.src` から参照する。

旧ローカル複製は使用せず、V2.0は気象庁公式CDNを直接参照する。独自アイコンと白い背景装飾は追加しない。
