# エージェント間の互換構成

入口文書とスキルを Claude Code・Codex・Kiro などで共有する場合に参照する。

## 入口文書の既定値

`entryPoints` の既定値には `CLAUDE.md` と `AGENTS.md` の両方を含める。
いずれもエージェント向け入口ファイルという同一の役割を持つ。重複を避ける
場合は AGENTS.md を正本とし、CLAUDE.md から `@AGENTS.md` で取り込む。
片方しか無いリポジトリでも既定値のまま動作する（存在しない側は
`entryPoints.filter(existsSync)`
により自然に除外される）。

共通する原則の詳細は
[文書構造の是正手順「1. 入口軽量化」](remediation.md#1-入口軽量化)を参照する。本検査はサイズと重複のみを検査するため、「ルーティングテーブル
に徹しているか」は人が判定する。

## スキルディレクトリ

`.agents/skills/` は Agent Skills 対応エージェント向けの正本である。導入先に
`.claude/skills/` がなければ、導入器は同梱スキルごとに正本へのシンボリックリンクを
作る。既存の実体ディレクトリがあっても、そのディレクトリは置き換えず、同梱スキル
だけを追加する。同名の既存スキルがある場合、導入器は停止する。Windows で
シンボリックリンクを利用できない場合は、`.agents/skills/` の同梱スキルを
`.claude/skills/` へコピーする。既存の `.claude/skills` 構成も
[文書構造検証器](verification-boundaries.md#検証器とプレイブックの責務)が自動認識する。

Kiro は `AGENTS.md` を直接読み、スキルは `.kiro/skills/` から読み込む。導入器は
同梱スキルごとに`.agents/skills/`へのシンボリックリンクを作るため、既存の
`.kiro/skills/`内のスキルを置き換えない。同名の既存スキルがある場合、導入器は
停止する。シンボリックリンクを利用できない場合は、同梱スキルを
`.kiro/skills/` にコピーする。既存の `.kiro/skills` 構成も
[文書構造検証器](verification-boundaries.md#検証器とプレイブックの責務)が自動認識する。
