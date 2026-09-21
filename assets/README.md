# Assets

表示を壊さないため、現行の実体は移動していない。

| 役割 | 現在の場所 | 将来の置き場 |
|---|---|---|
| 共通ロゴ | `images/logo.svg` | `assets/common/` |
| 天気アイコン（ローカル30種） | `images/jma-icons/` | `assets/common/weather-icons/` |
| 表示用天気アイコン | 気象庁 CDN | 共通参照のまま |
| 案件専用 | なし | `assets/sites/AC-xxxx/` |

案件の logo path は `sites/AC-xxxx.json` の `logo.src` から参照する。
