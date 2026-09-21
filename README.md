# Alert Cube

このフォルダが Alert Cube の全体です。Smart Signage とは別です。

## 起動

```
npx --yes serve -l 3200
```

- http://127.0.0.1:3200/ （本番 AC-0001）
- http://127.0.0.1:3200/?site=AC-0001
- http://127.0.0.1:3200/?site=AC-0002 （ENEOS磯子 V2.0）
- http://127.0.0.1:3200/?site=AC-0000 （内部テスト。本番端末へ登録しない）
- http://127.0.0.1:3200/?offseason=1

## 中身

```
index.html          表示本体
offseason.html      期間外プレビュー
config/             本番 last-good site-config.js
scripts/            既存エンジン
styles/             フォント・警報CSS
images/             ロゴ・気象庁アイコン
core/               起動・案件・ON/OFF・隔離
contents/           共通コンテンツ
services/           データ取得
data/               天気コード・地域
sites/              AC-0000 テスト / AC-0001以降 本番案件
custom/             案件専用
safety/             Version / Fallback / Retry / Rollback
docs/               運用
```

## 案件

| ID | status | 内容 |
|---|---|---|
| AC-0000 | test | 内部システムテスト。本番端末へ登録しない |
| AC-0001 | active | デジタルサイネージ / 〒559-0066 大阪市住之江区新北島1-9-13 |
| AC-0002 | active | エネオス株式会社 / 横浜市磯子区鳳町1番1号 |

発行済み ID は再利用しない。追加するときは `sites/_template.json` を新しい番号へ複製する。

## テスト

```
node tests/alert-cube-core.test.js
node tests/foundation.test.js
node tests/data-flow.test.js
node tests/visual-live.js http://127.0.0.1:3200
```

## プレビュー用 GitHub Pages（現行本番ではない）

端末の本番URLはまだ差し替えない。

- リポジトリ: https://github.com/digital-signage-led/alert-cube-candidate
- AC-0001: https://digital-signage-led.github.io/alert-cube-candidate/
- AC-0001: https://digital-signage-led.github.io/alert-cube-candidate/?site=AC-0001
- AC-0002: https://digital-signage-led.github.io/alert-cube-candidate/?site=AC-0002
- AC-0000: https://digital-signage-led.github.io/alert-cube-candidate/?site=AC-0000
