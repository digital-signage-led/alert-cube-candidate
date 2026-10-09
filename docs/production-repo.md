# 本番候補 Repository

このフォルダが本番運用候補である。現行本番URLの切替は未実施。

## SITE_CFG スナップショット（修正済み）

`index.html` が起動時に `window.SignageConfig` を const で固定し、`applyToGlobals` が別オブジェクトへ差し替えていた。
そのため `/?site=AC-0000` でも工程・地点ラベルが AC-0001 のまま残ることがあった。

修正: `siteCfg_()` で常に現行設定を読む。`applyToGlobals` は既存オブジェクトを更新する。`bootAsync` 完了後に `refreshSiteDerived_()` する。

## 新規本番案件

1. 未使用の次番号を発行する（再利用しない。デモ番号は使わない）
2. `sites/_template.json` を `sites/AC-xxxx.json` に複製
3. 会社名・地点・ON/OFF を書く（`status: active`）
4. `sites/index.json` の `sites` / `productionSites` に追加
5. `/?site=AC-xxxx` で確認 → 実機 → 承認後に端末登録

## 新規デモ案件

1. 未使用の次番号をデモ専用として発行する（再利用しない。あとから `productionSites` へ移さない）
2. `sites/_template.json` を `sites/AC-xxxx.json` に複製
3. `status: demo`、`projectName` は「デモ …」とする。AC-0000 は上書きしない
4. `sites/index.json` の `sites` / `demoSites` に追加する。`productionSites` には入れない
5. 見せるときは `/?site=AC-xxxx&demo=1`。端末には登録しない。AC-0008 は例外で、デモカーのシリーズ2として本番URLも使う

## 案件終了

1. `status` を `ended` にする（JSON と index.json）
2. 端末URLを外す
3. 定期 fetch は status により止まる
4. GAS 外部停止は参照0件確認後に人手
5. `archived` へ。ファイルは残す
