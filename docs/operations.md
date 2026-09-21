# Alert Cube 運用

## 現状

- 開発中バージョン: このワークスペース（channel = development）
- 本番反映済み案件: なし（このワークスペースは未公開）
- 本番案件: AC-0001（デジタルサイネージ / 〒559-0066 大阪市住之江区新北島1-9-13）
- 内部テスト: AC-0000（本番端末へ登録しない）

## 既存URL

端末に入っている URL はそのまま使う。

- `index.html`（DEFAULT = AC-0001）
- `index.html?offseason=1`
- `offseason.html`
- `index.html?native640=1`
- `index.html?embed=1`

追加（任意）:

- `/?site=AC-0001`
- `/?site=AC-0000`（内部テスト）

ローカル serve では `/index.html?site=` だとクエリが落ちることがある。

## 段階リリース

1. `node tests/alert-cube-core.test.js` と `node tests/foundation.test.js`
2. `/?site=AC-0000` で全共通コンテンツを確認
3. `/?site=AC-0001` または `/` で本番設定を目視
4. 内部実機
5. 少数本番
6. 全対象

## Rollback（コード）

データ Fallback とは別。直前リリースへ戻す。

## Fallback（データ）

気象庁・環境省が落ちても、localStorage の直前成功観測を表示する。期限切れは最新扱いにしない。

## 共通コンテンツ更新

台風は `scripts/alert-cube-typhoon.js` が正本。案件ごとのコピーは置かない。

修正 → 構文確認 → AC-0000 → 実機 → 承認後に Typhoon=ON の本番案件へ。

共通更新で `sites/AC-*.json` の地域・ON/OFF・ロゴは上書きしない。

## 季節

1. 安全系の明示 ON/OFF
2. 案件の明示 ON/OFF
3. `season.override`
4. 環境省 inService / カレンダー

## 将来 Server

`services/remote.js` の `siteConfigUrl` を `{ type: 'api', path: '/api/sites/{id}' }` に変える。いまは GitHub Pages の静的 JSON。
