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
- http://127.0.0.1:3200/?site=AC-0008&demo=1 （デモ 大鉄 大阪市。本番端末へ登録しない）
- http://127.0.0.1:3200/?site=AC-0009 （大島組 米岡橋梁下部工）
- http://127.0.0.1:3200/?site=AC-0010 （有限会社フジケン長崎 諫早市永昌町）
- http://127.0.0.1:3200/?site=AC-0011 （起産建設 博多区）
- http://127.0.0.1:3200/?site=AC-0012 （株式会社ヒカリ 丸亀市）
- http://127.0.0.1:3200/?site=AC-0013 （宮川興業 山本8号。本番サイネージは公開URLだけで動く。このPCの中継は不要）
- http://127.0.0.1:3200/?site=AC-0014 （デモ レンタルのニッケン 近江八幡。無償。表示は本番仕様。5面 640×128。本番端末へ登録しない）
- http://127.0.0.1:3200/?site=AC-0015 （井原工業 四国中央市川之江）
- http://127.0.0.1:3200/?site=AC-0016 （IHI瀧上特定建設工事共同企業体 神戸市東灘区）
- http://127.0.0.1:3200/?site=AC-0017 （株式会社ヒカリ 塩飽町）
- http://127.0.0.1:3200/?site=AC-0018 （五洋建設 品川区平塚）
- http://127.0.0.1:3200/?site=AC-0019 （戸田建設 東近江市 E3棟）
- http://127.0.0.1:3200/?site=AC-0020 （森下組 奈良市）
- http://127.0.0.1:3200/?site=AC-0021 （大鉄工業 奈良高架作業所）
- http://127.0.0.1:3200/?site=AC-0022 （松鶴建設 墨田区）
- http://127.0.0.1:3200/?site=AC-0023 （株式会社落合組 菊川市大石）
- http://127.0.0.1:3200/?site=AC-0024 （川崎重工 千葉・中部作業所。騒音・振動）
- http://127.0.0.1:3200/?site=AC-0025 （宇佐美工業 名古屋市・広域河川堀川浚渫工事）
- http://127.0.0.1:3200/?site=AC-0026 （日立プラントサービス 東広島市八本松町。5面）
- http://127.0.0.1:3200/?site=AC-0027&demo=1 （デモ カナモト 仙台営業所。5面。本番端末へ登録しない）
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
| AC-0008 | demo | 大鉄 / 大阪府大阪市。本番端末へ登録しない |
| AC-0009 | active | 株式会社大島組 / 〒943-0104 新潟県上越市鶴町52 |
| AC-0010 | active | 有限会社フジケン長崎 / 〒854-0072 長崎県諫早市永昌町５−２３ |
| AC-0011 | active | 起産建設株式会社 / 〒812-0041 福岡県福岡市博多区吉塚4丁目9-31 |
| AC-0012 | active | 株式会社ヒカリ / 〒763-0085 香川県丸亀市飯野町東分592-1 |
| AC-0013 | active | 宮川興業株式会社 / 広島県広島市安佐南区山本6丁目地内 |
| AC-0014 | demo | レンタルのニッケン / 滋賀県近江八幡市。5面。本番端末へ登録しない |
| AC-0015 | active | 井原工業株式会社 / 愛媛県四国中央市川之江 |
| AC-0016 | active | IHI瀧上特定建設工事共同企業体 / 兵庫県神戸市東灘区 |
| AC-0017 | active | 株式会社ヒカリ / 〒763-0024 香川県丸亀市塩飽町48-1 |
| AC-0018 | active | 五洋建設 / 〒142-0051 東京都品川区平塚３-９-１ |
| AC-0019 | active | 戸田建設 / 滋賀県東近江市東沖野丁目４－１ E3棟建設工事作業所 |
| AC-0020 | active | 株式会社森下組 / 奈良県奈良市 |
| AC-0021 | active | 大鉄工業株式会社 / 奈良県奈良市 奈良高架作業所 |
| AC-0022 | active | 松鶴建設株式会社 / 〒131-0031 東京都墨田区墨田4丁目12-8 |
| AC-0023 | active | 株式会社落合組 / 〒437-1524 静岡県菊川市大石（西嶺田） |
| AC-0024 | active | 川崎重工業株式会社 / 千葉県（中部作業所） |
| AC-0025 | active | 宇佐美工業株式会社 / 愛知県名古屋市・広域河川堀川浚渫工事 |
| AC-0026 | active | 株式会社日立プラントサービス / 広島県東広島市八本松町吉川2518 |
| AC-0027 | demo | 株式会社カナモト / 〒983-0007 宮城県仙台市宮城野区仙台港北1丁目2番地の5。5面。本番端末へ登録しない |

発行済み ID は再利用しない。追加するときは `sites/_template.json` を新しい番号へ複製する。環境クラウドの騒音・振動がある案件は `sites/_template-ssc.json` を複製し、地点と `edamSsc.idNum` を入れる。デモは別番号で `status: demo` とし、`demoSites` にだけ入れる。`?demo=1` は演出で、外してもその番号は本番にならない。

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
- AC-0013: https://digital-signage-led.github.io/alert-cube-candidate/?site=AC-0013 （端末はこのURLだけを開く。現地センサーは GitHub が10分ごとに更新し、端末が自分で読む）
- AC-0014: https://digital-signage-led.github.io/alert-cube-candidate/?site=AC-0014
- AC-0015: https://digital-signage-led.github.io/alert-cube-candidate/?site=AC-0015
- AC-0016: https://digital-signage-led.github.io/alert-cube-candidate/?site=AC-0016
- AC-0017: https://digital-signage-led.github.io/alert-cube-candidate/?site=AC-0017
- AC-0018: https://digital-signage-led.github.io/alert-cube-candidate/?site=AC-0018
- AC-0019: https://digital-signage-led.github.io/alert-cube-candidate/?site=AC-0019
- AC-0020: https://digital-signage-led.github.io/alert-cube-candidate/?site=AC-0020
- AC-0021: https://digital-signage-led.github.io/alert-cube-candidate/?site=AC-0021
- AC-0022: https://digital-signage-led.github.io/alert-cube-candidate/?site=AC-0022
- AC-0023: https://digital-signage-led.github.io/alert-cube-candidate/?site=AC-0023
- AC-0024: https://digital-signage-led.github.io/alert-cube-candidate/?site=AC-0024
- AC-0025: https://digital-signage-led.github.io/alert-cube-candidate/?site=AC-0025
- AC-0026: https://digital-signage-led.github.io/alert-cube-candidate/?site=AC-0026
- AC-0027: https://digital-signage-led.github.io/alert-cube-candidate/?site=AC-0027&demo=1
- AC-0000: https://digital-signage-led.github.io/alert-cube-candidate/?site=AC-0000
- コンテンツ一覧: https://digital-signage-led.github.io/alert-cube-candidate/contents/
