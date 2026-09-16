# 設定ファイル

`.agents/skills/verify-docs/SKILL.md` から参照される。検査スクリプトの設定を変更するときに参照する。
文書サイズ例外一覧の形式は[文書サイズ例外一覧](document-size-exceptions.md)、準一致重複・意図した重複の許可方法は
[重複の扱い](duplicate-handling.md)を参照する。

## 文書構造検証設定

| 項目 | 値 |
| --- | --- |
| 和名 | 文書構造検証設定 |
| 英名 | DocumentStructureVerificationConfiguration |
| ファイル名 | `verify-docs.config.json` |
| リポジトリ内パス | なし（導入先の利用者が作成する） |
| 配布先パス | `verify-docs.config.json` |

リポジトリ直下に配置する。インストーラーは、導入先にこのファイルがなければ全項目を
既定値で埋めた整形済みJSONを作る。すでにある場合は上書きしない。手動導入などで
存在しない場合も、全項目が既定値で動作する。
設定項目名と意味は下表を正本とする。個別キーは他文書で列挙せず、キー追加時の
表への追記漏れは `document-structure-verifier.test.mjs` が機械的に検査する。

```json
{
  "entryPoints": ["README.md", "CLAUDE.md", "AGENTS.md"],
  "docsDir": "docs",
  "skillsDir": ".agents/skills",
  "pathRoots": ["src/", "docs/", "scripts/", ".agents/", ".claude/", ".kiro/", ".github/"],
  "agentConfigDirs": [".agents", ".claude", ".kiro"],
  "excludePaths": ["node_modules/", ".git/", "vendor/", "dist/", "build/", ".verify-docs/"],
  "maxDocBytes": 7000,
  "minDuplicateChars": 60,
  "checkDuplicates": true,
  "checkNearDuplicates": false,
  "sizeExceptionFile": "document-size-exceptions.json",
  "tighten": { "mode": "auto" },
  "dedupe": { "mode": "auto" }
}
```

| キー                  | 意味                                                                 |
| --------------------- | ---------------------------------------------------------------------- |
| `entryPoints`         | 索引となる文書。他から参照されていなくてよい起点（CLAUDE.md・AGENTS.md はルーティングテーブルに徹する。[agent-compatibility.md](agent-compatibility.md)を参照） |
| `docsDir`             | 話題ごとの詳細文書を配置するディレクトリ                             |
| `skillsDir`           | スキル定義を配置するディレクトリ（`<skillsDir>/<name>/SKILL.md` を想定）。既定は `.agents/skills`。存在しなければ `.claude/skills`、`.kiro/skills` の順に自動検出する |
| `pathRoots`           | 本文中のバッククォート表記をパスとして検査する接頭辞                 |
| `agentConfigDirs`     | スキル以外のエージェント設定文書を孤立チェックから除外するディレクトリ |
| `excludePaths`        | 検査対象から除外するディレクトリ（下記「検査対象の集め方」を参照）。既定に含まれる `.verify-docs/` は作業記録と保守報告の保管先（[作業記録と保守報告「作業記録」](work-records-and-report.md#作業記録)を参照） |
| `maxDocBytes`         | 1文書あたりの上限（バイト数）。超過時は分割するか文書サイズ例外一覧に記載する    |
| `minDuplicateChars`   | AST抽出した段落本文の最小文字数。値が小さいほど誤検知が増加する |
| `checkDuplicates`     | 完全一致の重複検査の有効・無効。既定は有効                           |
| `checkNearDuplicates` | 準一致の重複検査の有効・無効。既定は無効（下記「準一致重複」を参照） |
| `sizeExceptionFile`   | 文書サイズ例外一覧の配置先                                           |
| `tighten`.mode        | `tighten-docs` の実行モード。`safe` は意味保持、`auto` は自律圧縮。既定は `auto`。 |
| `dedupe`.mode         | `dedupe-docs` の実行モード。`safe` は既定外の正本選定、`auto` は自律正本化。既定は `auto`。 |

`tighten` と `dedupe` は `mode` だけを持つオブジェクトであり、値は `safe` または
`auto` に限る。設定があればスキルはその値を優先する。設定がない場合は `auto` とする。
利用者またはリポジトリが意味を変えない確認を優先する場合は、明示して `safe` を選ぶ。

入力値の制約は[設定ファイルの入力検証](config-validation.md)を参照。

検査対象、各上限の設定方針、入口文書とスキルの共用方法は
[検査対象と設定方針](scan-targets.md)を参照する。
