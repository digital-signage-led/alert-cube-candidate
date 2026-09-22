# Assets

V2.0の共通表示資産を管理する。

| 役割 | 現在の場所 | 将来の置き場 |
|---|---|---|
| 共通ロゴ | `images/logo.svg` | `assets/common/` |
| V2.0天気アイコン | `data/jma-weather-icons.js` | 気象庁コードから共通SVGを生成 |
| 案件専用 | なし | `assets/sites/AC-xxxx/` |

案件の logo path は `sites/AC-xxxx.json` の `logo.src` から参照する。

`images/jma-icons/` の旧配布SVGと、気象庁CDNの同一旧SVGは表示に使用しない。
