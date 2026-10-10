# 構造解析と機械検査

[README.md](../README.md)から参照される。CommonMark ASTを使った構造解析、
文書構造検証器、文書構造抽出器、JSON出力、既存リポジトリ導入時の文書サイズ例外の初期化を扱う。

## オブジェクトの定義

### 文書構造検証器

| 項目 | 値 |
| --- | --- |
| 和名 | 文書構造検証器 |
| 英名 | DocumentStructureVerifier |
| ファイル名 | `document-structure-verifier.mjs` |
| リポジトリ内パス | `scripts/document-structure-verifier.mjs` |
| 配布先パス | `scripts/document-structure-verifier.mjs` |

Markdown文書のリポジトリ内参照の整合性・文書サイズ・段落重複を検査する。外部 URL は
ネットワークアクセスを伴うため検査しない。

### 文書構造抽出器

| 項目 | 値 |
| --- | --- |
| 和名 | 文書構造抽出器 |
| 英名 | DocumentStructureExtractor |
| ファイル名 | `document-structure-extractor.mjs` |
| リポジトリ内パス | `scripts/document-structure-extractor.mjs` |
| 配布先パス | `scripts/document-structure-extractor.mjs` |

Markdown文書の見出し・段落・位置・バイト数を抽出する。

### 正本候補選定器

| 項目 | 値 |
| --- | --- |
| 和名 | 正本候補選定器 |
| 英名 | CanonicalCandidateSelector |
| ファイル名 | `select-canonical.mjs` |
| リポジトリ内パス | `scripts/select-canonical.mjs` |
| 配布先パス | `scripts/select-canonical.mjs` |

比較済みの事実と文書の役割から、正本を自動選定できる候補だけを返す。事実が矛盾する場合や、双方に固有の事実がある場合は選定しない。

### 保護内容照合器

| 項目 | 値 |
| --- | --- |
| 和名 | 保護内容照合器 |
| 英名 | PreservedContentChecker |
| ファイル名 | `check-preserved-content.mjs` |
| リポジトリ内パス | `scripts/check-preserved-content.mjs` |
| 配布先パス | `scripts/check-preserved-content.mjs` |

基準コミットの文書にあったコードブロック・コードスパン・URL のうち、作業後の文書群のどこにも
残っていないものを列挙する。文章の言い換えは判定しない。

### Markdown構造解析器

| 項目 | 値 |
| --- | --- |
| 和名 | Markdown構造解析器 |
| 英名 | MarkdownStructureAnalyzer |
| ファイル名 | `markdown-structure.mjs` |
| リポジトリ内パス | `scripts/markdown-structure.mjs` |
| 配布先パス | `scripts/markdown-structure.mjs` |

CommonMark ASTを解析し、文書構造検証器と文書構造抽出器へ構造情報を提供する。

## CommonMark AST解析

Markdownは正規表現ではなく、同梱の CommonMark.js で AST（構文木）に解析する。
見出し階層、段落、リンク・画像の宛先、ソース位置を構文に沿って取得するため、
コード領域やコメント内のリンク風テキストを誤検出しない。

| 構成要素 | 提供すること |
| --- | --- |
| Markdown構造解析器 | 上記の構造情報を AST から取り出す。 |
| 文書構造検証器 | リポジトリ内参照の切れ、孤立文書、**ファイル単位**のサイズ超過、AST抽出した同一段落の重複を検出する。違反箇所の行・列・見出し階層、文書・違反種別の集計、分割検討用の大きい葉セクションも出力する。 |
| 文書構造抽出器 | 抽出結果を DocumentStructureSnapshot（文書構造スナップショット）としてJSONで出力する。文書重複解消スキルと文書簡潔化スキルが、対象を漏れなく確認するための共通入力になる。 |

## スキルの契約テスト

文書重複解消スキル・文書簡潔化スキルの意味判断はCIで自動判定しない。代わりに
自己検査ではfixtureを使い、共通の文書構造検証器の通過、正本へのポインタ化、必須情報の保持、
サイズ変化と実行結果の保守報告への記録を契約として検証する。意味的な重複や文章品質の
最終判断は、人またはエージェントがレビューする。

意味判断を比較するための小さな評価fixtureは[スキル判断の評価セット](../evals/README.md)を
参照する。

## 機械可読出力と文書サイズ例外の初期化

`node scripts/document-structure-verifier.mjs --json` は、文書数・構造集計・違反種別ごとの件数・
大きい葉セクション・文書サイズ例外を機械可読な形式で出力する。スキル別の実行結果は、
この出力を根拠として記録する。

`node scripts/document-structure-verifier.mjs --init-size-exceptions` は、既存のサイズ超過文書を理由と
分割候補の節情報付きで文書サイズ例外一覧へ記録する。すべてを導入初日に
分割できない既存リポジトリでも、超過を明示して段階的に是正できる。
