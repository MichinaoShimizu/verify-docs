# 導入・検査・CI の運用オブジェクト

[README.md](../README.md)から参照される。導入先で直接使う導入器、自己検査、CI
テンプレートを定義する。

## 文書検証パッケージ導入器

| 項目 | 値 |
| --- | --- |
| 和名 | 文書検証パッケージ導入器 |
| 英名 | VerifyDocsInstaller |
| ファイル名 | `install.sh` |
| リポジトリ内パス | `install.sh` |
| 配布先パス | なし（導入時に取得して実行する） |

verify-docs パッケージ一式を導入先のリポジトリへ配置する。

## 文書検証パッケージ自己検査

| 項目 | 値 |
| --- | --- |
| 和名 | 文書検証パッケージ自己検査 |
| 英名 | VerifyDocsSelfCheck |
| ファイル名 | `ci-selfcheck.sh` |
| リポジトリ内パス | `ci-selfcheck.sh` |
| 配布先パス | なし（パッケージ開発時だけ実行する） |

パッケージ自身の検証器・抽出器・スキル契約・評価・導入器を検査する。

## CI の検査観点

このリポジトリの CI は、導入先の文書を検証するワークフローとは別に、配布物自身の構成と導入経路を検査する。

| 検査観点 | 検査する内容 | ジョブ |
| --- | --- | --- |
| 文書内リンク | Markdown のリンク先、画像のリンク先、見出しアンカー。 | `verify-docs-root-check`、`verify-docs-self-check` |
| 文書の到達性 | 設定された入口から参照されない Markdown 文書。 | `verify-docs-root-check`、`verify-docs-self-check` |
| 文書サイズ | 末端節のサイズ制限と、例外設定の妥当性・鮮度。 | `verify-docs-root-check`、`verify-docs-self-check` |
| 段落の重複 | 文書間の完全一致段落と、設定時の近似重複段落。 | `verify-docs-root-check`、`verify-docs-self-check` |
| 文書構造検査器 | CommonMark の解釈、設定エラー、変更範囲の検査、CLI の JSON 出力と終了コード。 | `verify-docs-self-check` |
| 文書構造抽出器 | 見出し文脈、行番号、バイト数を含む Markdown の抽出と、CLI の入力制約。 | `verify-docs-self-check` |
| 構造検査用 fixture | 意図的に入れた構造違反を検出し、違反のない fixture を通過させること。 | `verify-docs-self-check` |
| 正本選択 | 事実の包含、判断が必要な組み合わせ、値の競合を区別すること。 | `verify-docs-self-check` |
| スキル契約と評価 fixture | 重複整理・推敲の契約と、CI の合否に含めない評価ケースの構成。 | `verify-docs-self-check` |
| ソーススキルの文書参照 | 各 `SKILL.md` が `docs/` の必要な文書を解決できること。 | `verify-docs-self-check` |
| 配布用スキル | アーカイブから `references/` を生成し、生成後のローカル参照とシンボリックリンクを解決できること。 | `verify-docs-self-check` |
| 導入器の基本動作 | ローカル配布物からの導入、再導入、導入ログ、作業記録だけを `.gitignore` に追加すること。 | `verify-docs-self-check` |
| 導入後の実行ファイル | 導入済みの構造検査器、抽出器、正本選択器を実行できること。 | `verify-docs-self-check` |
| 導入後の配布範囲 | 必要な `references/` は配置し、不要な `references/` と `evals/` は配置しないこと。 | `verify-docs-self-check` |
| エージェント互換リンク | Claude/Kiro 用スキルリンクを作り、既存の別スキルは残すこと。 | `verify-docs-self-check` |
| 導入時の競合 | 既存の異なるファイルまたは同名の Kiro スキルを上書きせず、導入を停止すること。 | `verify-docs-self-check` |
| 最低対応版 | 導入器が受け付ける最低版の Node.js 22.0.0 で、自己検査一式を実行できること。 | `verify-docs-minimum-node` |
| 公開導入経路 | 公開済み `main` の raw `install.sh` と同じ ref のアーカイブから導入でき、導入後の構造検査器を実行できること。 | `remote-install-smoke` |
| 公開導入後の配置 | 公開導入先で `references/` を生成し、`docs/` 全体を配置しないこと。 | `remote-install-smoke` |

pull request の `ci` 完了後には、同じ PR 内の bot コメントを更新する。報告用 workflow は完了済み CI の情報だけを GitHub API で読み、PR のコードを checkout・実行しない。

このCIは実ホストでスキルを起動すること、利用者の文書内容が正しいこと、Node.js 23以上の各版で動くことまでは確認しない。前者はホストごとの手動確認、後者は対象リポジトリ側の検証、Node.js 23以上は対応版ごとの追加検証が必要である。

## 文書構造検証ワークフロー

| 項目 | 値 |
| --- | --- |
| 和名 | 文書構造検証ワークフロー |
| 英名 | DocumentStructureVerificationWorkflow |
| ファイル名 | `verify-docs.yml` |
| リポジトリ内パス | `.github/workflows/verify-docs.yml` |
| 配布先パス | `.github/workflows/verify-docs.yml` |

導入先の pull request で文書構造検証器を実行する GitHub Actions テンプレートである。
導入器はこのテンプレートをコピーしないため、導入先で必要な場合は手動で配置する。
