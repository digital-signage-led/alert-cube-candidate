# Alert Cube MASTER PRODUCTION

このファイルを本番運用の最上位仕様とする。

## 役割

| 対象 | 役割 |
|---|---|
| AC-0000 | 内部システムテスト（status=test）。本番端末へ登録しない |
| AC-0001以降 | 本番案件。IDは再利用しない |
| `sites/` | 案件設定の正本 |
| `sites/index.json` | 案件一覧・status の正本 |
| `contents/` | 共通Content（案件コピー禁止） |
| Git Tag / Commit | 過去Version |
| Last Known Good | 障害時のデータ復旧 |

## Project Lifecycle

`test` / `active` / `suspended` / `ended` / `archived`

`test` と `active` だけが定期 fetch を行う。

## Content Lifecycle

`active` / `deprecated` / `retired` / `deleted`

即削除しない。使用案件0件を確認してから削除する。

## デザイン

現在動いている表示を正とする。WBGT/気温の実装色は `scripts/alert-cube-core.js` を維持する。

## 本番切替

ユーザーの明示承認があるまで、既存公開URLを変更しない。
