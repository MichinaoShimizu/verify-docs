# AGENTS.md

本リポジトリで作業する生成AIエージェント向けの参照先一覧。
理由や手順は記載せず、参照先の指示に限定する。

## 必須要件

本リポジトリの公開物である verify-docs の skill・実行ファイル・文書・fixture・
自己検査はルートに置く。

- ドキュメントの分割・移動は移動とポインタ化のみ。要約・言い換えによる
  内容変更は禁止。

<!-- verify-docs:required-skill:start -->
## Markdown文書の変更

Markdown文書を追加・更新・削除・レビューする際は、必ず`verify-docs`を使う。変更後に
`node scripts/document-structure-verifier.mjs`を実行し、結果を報告する。文書の追加、移動、
分割、削除、複数文書の変更、または違反の是正は、verify-docsの完全是正手順に従う。

文書レビュー、複数のMarkdown文書の追加・更新・削除、または検証でサイズ超過・重複が
見つかった回は、`verify-docs`、`dedupe-docs`、`tighten-docs`、最終`verify-docs`の順に
実行する。dedupe-docsとtighten-docsは既定の自律モードで、判断待ちを理由に止めずに
編集、再検証、報告まで完走する。数値、コマンド、設定値、法的・安全・契約上の注意は保護する。

文書を変更した各工程の直後に`verify-docs`を再実行する。違反が残れば、その違反を生んだ
工程へ戻って是正し、通過するまで次の工程または完了報告へ進まない。

無駄を減らすレビューでは、dedupe-docsとtighten-docsの一巡を、文書の変更がなくなり
verify-docsが通過するまで繰り返す。同じ候補を繰り返しても変更できない、または判断が
必要な場合も、保護対象として記録して処理を完走する。

Markdownが100文書以上ある場合、文書を100件以下の読解単位に分けて記録する。ただし
verify-docsによる機械検証は開始時と完了時に全件へ実行し、任意の抽出や一部の通過だけで
完了にしない。dedupe-docsの候補と判断は単一の作業記録へ集約し、読解単位をまたぐ候補も
比較する。
<!-- verify-docs:required-skill:end -->

## セッションの開始

- Git リポジトリで新規タスクを開始する場合は、共有 checkout ではなく新規 worktree を使用する。
- 新規タスク用 worktree は `bash scripts/start-worktree.sh <task-name>` で作成する。
- 同コマンドが報告した `origin/main` の SHA と、作成した worktree の HEAD が一致することを確認してから作業する。
- 他の worktree、共有 checkout、または他セッションが持つ未コミット変更を変更しない。
- 共有 checkout の `main` に対する `reset`、`checkout`、`merge` は、利用者が明示的に依頼した場合だけ行う。
- タスク専用 worktree は、変更の統合または不要化を確認した後、対象 worktree がクリーンであることを確認して削除する。進行中・レビュー待ち・未マージの変更がある worktree は削除しない。

## PR作成

- PR本文・Issue本文などの複数行テキストを、シェルのコマンド引数へ直接埋め込まない。
- 本文は`--body-file`で渡す。Markdownのバッククォート、`$()`、引用符をシェル展開させない。
- PRの作成・更新直後に`gh pr view --json body`で本文を読み返し、意図しない展開や検査ログの混入がないことを確認する。

## 参照先

| 話題                                             | 行き先                                          |
| ------------------------------------------------ | ------------------------------------------------ |
| verify-docs の使い方                            | [README.md](README.md)                          |
| ドキュメント構造の検査（参照切れ・サイズ超過・重複） | [docs/structure.md](docs/structure.md) |
| 文書の分割・移動・正本化・ポインタ化            | [docs/progressive-disclosure.md](docs/progressive-disclosure.md) |
| CI の中身                                        | [.github/workflows/ci.yml](.github/workflows/ci.yml) |
