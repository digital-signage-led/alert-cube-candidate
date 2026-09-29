# Alert Cube

このフォルダが Alert Cube の全体です。Smart Signage とは別です。

## 起動

```
npx --yes serve -l 3200
```

- http://127.0.0.1:3200/ （本番 AC-0001）
- http://127.0.0.1:3200/?site=AC-0001
- http://127.0.0.1:3200/?site=AC-0002 （ENEOS磯子 V2.0）
- http://127.0.0.1:3200/?site=AC-0003 （但南建設。本番URLは未切替）
- http://127.0.0.1:3200/?site=AC-0004 （佐藤工業 福山）
- http://127.0.0.1:3200/?site=AC-0005 （レイズネクスト 摂津）
- http://127.0.0.1:3200/?site=AC-0006 （錦建設 広島市中区）
- http://127.0.0.1:3200/?site=AC-0007 （佐々木建設 北島町）
- http://127.0.0.1:3200/?site=AC-0008&demo=1 （デモ 太陽建機レンタル 名古屋市。本番端末へ登録しない）
- http://127.0.0.1:3200/?site=AC-0009 （大島組 米岡橋梁下部工）
- http://127.0.0.1:3200/?site=AC-0010 （有限会社フジケン長崎 諫早市永昌町）
- http://127.0.0.1:3200/?site=AC-0011 （起産建設 博多区）
- http://127.0.0.1:3200/?site=AC-0012 （株式会社ヒカリ 丸亀市）
- http://127.0.0.1:3200/?site=AC-0013 （宮川興業 山本8号。現地は見守り伝書鳩。`node scripts/densho-proxy.js` を同時に起動）
- http://127.0.0.1:3200/?site=AC-0014 （デモ レンタルのニッケン 近江八幡。無償。表示は本番仕様。5面 640×128。本番端末へ登録しない）
- http://127.0.0.1:3200/?site=AC-0015 （井原工業 四国中央市川之江）
- http://127.0.0.1:3200/?site=AC-0000 （内部テスト。本番端末へ登録しない）
- http://127.0.0.1:3200/contents/ （V2.0コンテンツ確認一覧）
- http://127.0.0.1:3200/?offseason=1

## 中身

```
index.html          表示本体
offseason.html      期間外プレビュー
config/             本番 last-good site-config.js
scripts/            既存エンジン
styles/             フォント・警報CSS
images/             共通ロゴ
core/               起動・案件・ON/OFF・隔離
contents/           共通コンテンツ
services/           データ取得
data/               気象庁天気コード・地域
sites/              案件設定。index.json の production / test / demo で分ける
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
| AC-0003 | active | 但南建設株式会社 / 兵庫県朝来市生野町円山862-1 |
| AC-0004 | active | 佐藤工業 / 広島県福山市 |
| AC-0005 | active | レイズネクスト / 〒566-0044 大阪府摂津市西一津屋1-1 |
| AC-0006 | active | 錦建設株式会社 / 広島県広島市中区舟入本町7 |
| AC-0007 | active | 佐々木建設株式会社 / 徳島県板野郡北島町 |
| AC-0008 | demo | 太陽建機レンタル株式会社 / 愛知県名古屋市。本番端末へ登録しない |
| AC-0009 | active | 株式会社大島組 / 〒943-0104 新潟県上越市鶴町52 |
| AC-0010 | active | 有限会社フジケン長崎 / 〒854-0072 長崎県諫早市永昌町５−２３ |
| AC-0011 | active | 起産建設株式会社 / 〒812-0041 福岡県福岡市博多区吉塚4丁目9-31 |
| AC-0012 | active | 株式会社ヒカリ / 〒763-0085 香川県丸亀市飯野町東分592-1 |
| AC-0013 | active | 宮川興業株式会社 / 広島県広島市安佐南区山本6丁目地内 |
| AC-0014 | demo | レンタルのニッケン / 滋賀県近江八幡市。5面。本番端末へ登録しない |
| AC-0015 | active | 井原工業株式会社 / 愛媛県四国中央市川之江 |

発行済み ID は再利用しない。追加するときは `sites/_template.json` を新しい番号へ複製する。デモは別番号で `status: demo` とし、`demoSites` にだけ入れる。`?demo=1` は演出で、外してもその番号は本番にならない。

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
- AC-0003: https://digital-signage-led.github.io/alert-cube-candidate/?site=AC-0003
- AC-0004: https://digital-signage-led.github.io/alert-cube-candidate/?site=AC-0004
- AC-0005: https://digital-signage-led.github.io/alert-cube-candidate/?site=AC-0005
- AC-0006: https://digital-signage-led.github.io/alert-cube-candidate/?site=AC-0006
- AC-0007: https://digital-signage-led.github.io/alert-cube-candidate/?site=AC-0007
- AC-0008: https://digital-signage-led.github.io/alert-cube-candidate/?site=AC-0008&demo=1
- AC-0009: https://digital-signage-led.github.io/alert-cube-candidate/?site=AC-0009
- AC-0010: https://digital-signage-led.github.io/alert-cube-candidate/?site=AC-0010
- AC-0011: https://digital-signage-led.github.io/alert-cube-candidate/?site=AC-0011
- AC-0012: https://digital-signage-led.github.io/alert-cube-candidate/?site=AC-0012
- AC-0013: https://digital-signage-led.github.io/alert-cube-candidate/?site=AC-0013
- AC-0014: https://digital-signage-led.github.io/alert-cube-candidate/?site=AC-0014
- AC-0015: https://digital-signage-led.github.io/alert-cube-candidate/?site=AC-0015
- AC-0000: https://digital-signage-led.github.io/alert-cube-candidate/?site=AC-0000
- コンテンツ一覧: https://digital-signage-led.github.io/alert-cube-candidate/contents/
