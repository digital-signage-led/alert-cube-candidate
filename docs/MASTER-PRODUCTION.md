# Alert Cube MASTER PRODUCTION

このファイルを本番運用の最上位仕様とする。

## 役割

| 対象 | 役割 |
|---|---|
| AC-0000 | 内部システムテスト（`testSites`、status=test）。本番端末へ登録しない |
| AC-0001以降の顧客番号 | 本番案件（`productionSites`、status=active）。IDは再利用しない |
| デモ専用番号 | デモ案件（`demoSites`、status=demo）。本番端末へ登録しない。本番へ転用しない。例外は AC-0008（デモカー・シリーズ2。デモと本番の混合） |
| `sites/` | 案件設定の正本。本番・テスト・デモを同じフォルダに置く |
| `sites/index.json` | 案件一覧・status の正本。`productionSites` / `testSites` / `demoSites` で分ける |
| `contents/` | 共通Content（案件コピー禁止） |
| Git Tag / Commit | 過去Version |
| Last Known Good | 障害時のデータ復旧 |

## Project Lifecycle

`test` / `demo` / `active` / `suspended` / `ended` / `archived`

`test` と `demo` と `active` だけが定期 fetch を行う。`test` は AC-0000 のみ。`demo` は AC-0000 以外のデモ専用番号のみ。

`?demo=1` は熱中症・台風・警報を順に見せる演出であり、`status` は変えない。外すとその地点の実データ表示に戻る。本番かどうかは `site=` の番号と、その番号が `productionSites` にあるかで決まる。

## Content Lifecycle

`active` / `deprecated` / `retired` / `deleted`

即削除しない。使用案件0件を確認してから削除する。

## デザイン

現在動いている表示を正とする。WBGT/気温の実装色は `scripts/alert-cube-core.js` を維持する。

## 本番切替

ユーザーの明示承認があるまで、既存公開URLを変更しない。
