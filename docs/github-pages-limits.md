# GitHub / GitHub Pages 制限（確認日: 2026-09-21）

公式:

- Pages ソースリポジトリ推奨: 1 GB
- 公開サイト上限: 1 GB
- 帯域: 月 100 GB（ソフト）
- デプロイタイムアウト: 10 分
- ビルド: 時 10 回（ソフト。Actions 公開時は対象外）
- 通常 Git ファイル: 50 MiB で警告、100 MiB で拒否

出典: https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits
出典: https://docs.github.com/en/repositories/working-with-files/managing-large-files/about-large-files-on-github

## Alert Cube 安全目標（公式上限ではない）

- 公開サイト: 500 MB 以下
- Repository: 500 MB 以下
- 単一ファイル: 10 MB 以下
- 50 MiB 以上の通常ファイルを避ける
- 100 MiB 以上の通常 Git 管理ファイルを作らない
