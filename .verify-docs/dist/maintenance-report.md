# Maintenance Report

対象範囲: リポジトリ全体の Markdown 文書38件（`.verify-docs/` を除く）。

作業単位: リポジトリ全体の文書レビュー（量の削減）
開始: 2026-10-10T17:30:51+0900
最終更新: 2026-10-10T17:48:18+0900

## 実行履歴

| 試行 | 実行 | スキル | 主な変更 | 最終検査 |
| ---: | --- | --- | --- | --- |
| 1 | 17:30 | 文書構造是正スキル | 開始時の構造検査 | 違反0件 |
| 1 | 17:31 | 文書重複解消スキル | 15か所の重複を正本へポインタ化（132,164B→129,046B） | 違反0件 |
| 1 | 17:40 | 文書簡潔化スキル | 16文書の冗長表現を削減（129,046B→126,468B） | 違反0件 |
| 2 | 17:47 | 文書重複解消スキル・文書簡潔化スキル | 変更なし（収束） | 違反0件 |
| 2 | 17:48 | 文書構造是正スキル | 完了時の構造検査と自己検査 | 違反0件、自己検査成功 |

## 文書構造是正スキル

対象: リポジトリ全体の Markdown 文書38件（132164バイト）

- [x] 開始時の構造検査 — 2026-10-10 / `node scripts/document-structure-verifier.mjs --json` で違反0件。是正対象なし
- [x] 完了時の構造検査（dedupe-docs・tighten-docs 後） — 2026-10-10 / `node scripts/document-structure-verifier.mjs` で「文書構造: すべて通過」（38文書、違反0件）。`node --test scripts/*.test.mjs` 62件通過、`bash ci-selfcheck.sh` 成功

### 最終検査結果

実行: 2026-10-10T17:48:18+0900

| 観点 | 検査・保証内容 | 検査根拠 | 結果 |
| --- | --- | --- | --- |
| 参照整合性 | Markdownリンク・画像リンク・断片リンク、設定した `pathRoots` に一致するバッククォート内のパスが解決できる | `node scripts/document-structure-verifier.mjs` | リンク違反0件 |
| 孤立文書 | 入口文書または他の検査対象文書から到達できる | `node scripts/document-structure-verifier.mjs` | 孤立違反0件 |
| 文書サイズ | `maxDocBytes` 以下、または文書サイズ例外一覧に理由を記録済みである | `node scripts/document-structure-verifier.mjs` | サイズ違反0件 |
| 機械的重複 | 完全一致と、有効時の準一致の段落重複を検出・是正済みである | `node scripts/document-structure-verifier.mjs` | 重複違反0件 |

## 文書重複解消スキル

実行モード: 自律正本化

対象: リポジトリ全体の Markdown 文書38件（`.verify-docs/` を除く、開始時132,164バイト）

- [x] 開始時の機械的重複の確認 — 2026-10-10 / `node scripts/document-structure-verifier.mjs` で「文書構造: すべて通過」。`[重複]`・`[準一致重複]` なし
- [x] [.agents/skills/dedupe-docs/SKILL.md](../../.agents/skills/dedupe-docs/SKILL.md) — 2026-10-10 / 「実行モード」の既定値・safe の戻し方の再説明を、正本 [docs/autonomous-canonicalization.md](../../docs/autonomous-canonicalization.md) へのポインタに置換（6,993B→6,865B）。モード名と既定の `auto` はポインタ文に保持
- [x] [.agents/skills/tighten-docs/SKILL.md](../../.agents/skills/tighten-docs/SKILL.md) — 2026-10-10 / 「実行モード」の再説明を正本 [docs/autonomous-compression.md](../../docs/autonomous-compression.md) へのポインタに置換。「2. 冗長表現削減」の導入説明・節結合・断片リンク付け替えの再説明を、正本 [docs/patterns-duplication-and-style.md](../../docs/patterns-duplication-and-style.md) 「文書単位の冗長性」へのポインタに置換（6,947B→6,408B）。文書間作業の除外は「不変条件」「制約と対象外」に残存
- [x] [.agents/skills/verify-docs/SKILL.md](../../.agents/skills/verify-docs/SKILL.md) — 2026-10-10 / 入口として各正本へのポインタのみ。再説明なし。変更なし
- [x] [AGENTS.md](../../AGENTS.md) — 2026-10-10 / 利用者の必須要件で、導入器の管理ブロックと同文。[docs/routine-document-changes.md](../../docs/routine-document-changes.md) と重なるが、利用者が明示した規則のため保護対象として変更なし。[CONTRIBUTING.md](../../CONTRIBUTING.md)「開発セッションの開始」とも重なるが、同様に保護
- [x] [CLAUDE.md](../../CLAUDE.md) — 2026-10-10 / `@AGENTS.md` の取り込みのみ。変更なし
- [x] [CONTRIBUTING.md](../../CONTRIBUTING.md) — 2026-10-10 / スキル補助文書の配布手順の再説明を [docs/skill-references.md](../../docs/skill-references.md) へ統合しポインタ化。`DEFAULTS` キーの記載先の再説明を [docs/config.md](../../docs/config.md) へのポインタに置換し、テスト名は保持（4,186B→3,854B）
- [x] [README.md](../../README.md) — 2026-10-10 / 自律モード設定の JSON 例・既定値の再説明と、インストーラーの設定生成の再説明を削除し、「設定ファイル」節の正本 [docs/config.md](../../docs/config.md) へのポインタに統合（6,888B→6,557B）。既定 `auto` と `safe` の選択条件は導線として保持
- [x] [docs/adoption.md](../../docs/adoption.md) — 2026-10-10 / 「CIに組み込む」の重複是正手順の要約を [docs/remediation.md](../../docs/remediation.md)「3. 重複特定」へのポインタに置換（「例外化しない」は保持）。「文書サイズ例外の管理」の運用規則を正本 [docs/document-size-exceptions.md](../../docs/document-size-exceptions.md) へ移動しポインタ化（2,493B→2,114B）。見出しと CONTRIBUTING.md からの断片リンクは維持
- [x] [docs/advanced-usage.md](../../docs/advanced-usage.md) — 2026-10-10 / 「正本候補の機械判定」の `facts` と出力判定の再説明を、正本 [docs/canonical-selection.md](../../docs/canonical-selection.md)「判定器への入力」へのポインタに置換（3,199B→2,930B）。コマンドは保持
- [x] [docs/agent-compatibility.md](../../docs/agent-compatibility.md) — 2026-10-10 / 旧位置の「SKILL.md「1. 入口軽量化」」を、正本 [docs/remediation.md](../../docs/remediation.md)「1. 入口軽量化」へのリンクに付け替え（2,243B→2,297B）
- [x] [docs/agent-execution.md](../../docs/agent-execution.md) — 2026-10-10 / 「safe と auto」冒頭の既定値・safe の選び方を、正本 [docs/config.md](../../docs/config.md) へのポインタに置換（2,085B→2,019B）。auto でも解除しない保護対象の文は、verify-docs から自律モード資料へリンクできない配布制約のため保持
- [x] [docs/autonomous-canonicalization.md](../../docs/autonomous-canonicalization.md) — 2026-10-10 / 「既定のモード」の safe 時の規則を、正本 [docs/canonical-selection.md](../../docs/canonical-selection.md) と [docs/judgement-and-escalation.md](../../docs/judgement-and-escalation.md) へのポインタに置換（4,607B→4,307B）
- [x] [docs/autonomous-compression.md](../../docs/autonomous-compression.md) — 2026-10-10 / tighten-docs の自律圧縮の正本。[docs/work-records-and-report.md](../../docs/work-records-and-report.md) の重複段落の統合先。変更なし
- [x] [docs/canonical-selection.md](../../docs/canonical-selection.md) — 2026-10-10 / safe 時の正本選定の正本。変更なし
- [x] [docs/ci-integration.md](../../docs/ci-integration.md) — 2026-10-10 / CI 構成例の正本。導入先へ配布する文書のため YAML を保持。変更なし
- [x] [docs/config-validation.md](../../docs/config-validation.md) — 2026-10-10 / 入力制約の正本。変更なし
- [x] [docs/config.md](../../docs/config.md) — 2026-10-10 / 設定の正本。README.md・CONTRIBUTING.md・agent-execution.md からのポインタ先。変更なし
- [x] [docs/document-size-exceptions.md](../../docs/document-size-exceptions.md) — 2026-10-10 / [docs/adoption.md](../../docs/adoption.md) から運用規則（際限なく増やした場合の影響と退行の目安）を受け入れて正本化（2,784B→2,947B）。文書内の `--init-size-exceptions` の二重説明は同一文書内のため tighten-docs の候補として残置
- [x] [docs/duplicate-handling.md](../../docs/duplicate-handling.md) — 2026-10-10 / 準一致重複・意図した重複の正本。remediation.md からのポインタ先。変更なし
- [x] [docs/judgement-and-escalation.md](../../docs/judgement-and-escalation.md) — 2026-10-10 / safe 時の判断の正本。末尾の allow-duplicate の項は利用者回答の条件を含む要約で、短く固有の「統合の対象からも外す」を持つため保持。変更なし
- [x] [docs/maintenance-report-format.md](../../docs/maintenance-report-format.md) — 2026-10-10 / 自律モードの `実行モード` 行は報告上の配置（表の前）を定める固有情報のため保持。変更なし
- [x] [docs/mode-comparison.md](../../docs/mode-comparison.md) — 2026-10-10 / 構造検査の保証範囲の文は比較固有の観点（対象読者への適合、例外・免責）を持ち、tighten-docs に検証器の責務資料を新たに到達させないため保持。変更なし
- [x] [docs/object-naming.md](../../docs/object-naming.md) — 2026-10-10 / 命名規約の正本。重複なし。変更なし
- [x] [docs/operations.md](../../docs/operations.md) — 2026-10-10 / 運用オブジェクトの定義と CI 検査観点。他文書と読者・粒度が異なる。変更なし
- [x] [docs/patterns-duplication-and-style.md](../../docs/patterns-duplication-and-style.md) — 2026-10-10 / 末尾の文書間作業・モード別の扱いの再説明を、tighten-docs の `SKILL.md`「不変条件」「2. 冗長表現削減」への案内に置換（3,773B→3,503B）
- [x] [docs/patterns-markdown.md](../../docs/patterns-markdown.md) — 2026-10-10 / パターン一覧。重複なし。変更なし
- [x] [docs/patterns-wording.md](../../docs/patterns-wording.md) — 2026-10-10 / パターン一覧。重複なし。変更なし
- [x] [docs/progressive-disclosure.md](../../docs/progressive-disclosure.md) — 2026-10-10 / 入口・正本・ポインタの規約の正本。remediation.md「1. 入口軽量化」と観点が重なるが、規約と手順で役割が異なるため保持。変更なし
- [x] [docs/remediation.md](../../docs/remediation.md) — 2026-10-10 / 「3. 重複特定」の意図した重複・準一致重複の要約を、正本 [docs/duplicate-handling.md](../../docs/duplicate-handling.md) の各節へのポインタに置換（4,398B→4,207B）。要約側に欠けていた利用者回答の条件は正本側で適用される
- [x] [docs/routine-document-changes.md](../../docs/routine-document-changes.md) — 2026-10-10 / 「無駄を減らすレビュー」の4工程の再説明を [docs/workflow.md](../../docs/workflow.md)「同梱スキルだけを使う場合」へのポインタに置換（実行順は保持）。workflow.md「再検証する位置」の理由を「反復検証」へ統合して正本化。完了報告の保証範囲を [docs/verification-boundaries.md](../../docs/verification-boundaries.md) へのポインタに置換（5,896B→5,991B）
- [x] [docs/scan-targets.md](../../docs/scan-targets.md) — 2026-10-10 / `minDuplicateChars` の数え方の再説明を、既存の [docs/duplicate-handling.md](../../docs/duplicate-handling.md) へのポインタ文に統合（3,545B→3,499B）。既定値60と設定方針は保持
- [x] [docs/skill-references.md](../../docs/skill-references.md) — 2026-10-10 / [CONTRIBUTING.md](../../CONTRIBUTING.md) から配布用 `references/` の求め方と自己検査コマンドを受け入れて正本化（961B→1,340B）
- [x] [docs/structure.md](../../docs/structure.md) — 2026-10-10 / 評価セットの用途・配布有無の要約を、正本 [evals/README.md](../../evals/README.md) へのポインタに置換（4,829B→4,637B）。文書構造検証器の定義文と表の行の重なりは同一文書内のため tighten-docs の候補として残置
- [x] [docs/verification-boundaries.md](../../docs/verification-boundaries.md) — 2026-10-10 / 検証器の保証範囲の正本。routine-document-changes.md からのポインタ先。変更なし
- [x] [docs/work-record-lifecycle.md](../../docs/work-record-lifecycle.md) — 2026-10-10 / 作業単位の正本。重複なし。変更なし
- [x] [docs/work-records-and-report.md](../../docs/work-records-and-report.md) — 2026-10-10 / 自律圧縮・自律正本化の `回答待ち` と記録項目の2段落を、各スキルの自律モード資料への案内1文に置換（6,749B→6,216B）。配布制約（verify-docs から canonical-selection.md へ到達させない）のためリンクは置かない。テストで保護された `回答待ち` 規則は保持
- [x] [docs/workflow.md](../../docs/workflow.md) — 2026-10-10 / 「再検証する位置」の理由を [docs/routine-document-changes.md](../../docs/routine-document-changes.md)「反復検証」へ移動しポインタ化（4,827B→4,594B）
- [x] [evals/README.md](../../evals/README.md) — 2026-10-10 / 評価セットの正本。structure.md からのポインタ先。変更なし

### 正本化の一覧

| 元文書 | 正本 | 移動・置換した内容 |
| --- | --- | --- |
| [README.md](../../README.md) | [docs/config.md](../../docs/config.md) | 自律モード設定例・既定値・設定生成の再説明 |
| [CONTRIBUTING.md](../../CONTRIBUTING.md) | [docs/skill-references.md](../../docs/skill-references.md)、[docs/config.md](../../docs/config.md) | 配布用 `references/` の生成手順、`DEFAULTS` キーの記載先 |
| [docs/adoption.md](../../docs/adoption.md) | [docs/document-size-exceptions.md](../../docs/document-size-exceptions.md)、[docs/remediation.md](../../docs/remediation.md) | 文書サイズ例外の運用規則、重複の是正方法の要約 |
| [docs/advanced-usage.md](../../docs/advanced-usage.md) | [docs/canonical-selection.md](../../docs/canonical-selection.md) | 判定器の入力と出力の説明 |
| [docs/agent-execution.md](../../docs/agent-execution.md) | [docs/config.md](../../docs/config.md) | 既定値と `safe` の選び方 |
| [docs/autonomous-canonicalization.md](../../docs/autonomous-canonicalization.md) | [docs/canonical-selection.md](../../docs/canonical-selection.md)、[docs/judgement-and-escalation.md](../../docs/judgement-and-escalation.md) | `safe` 時の正本選定と質問の規則 |
| [.agents/skills/dedupe-docs/SKILL.md](../../.agents/skills/dedupe-docs/SKILL.md) | [docs/autonomous-canonicalization.md](../../docs/autonomous-canonicalization.md) | 実行モードの既定値と戻し方 |
| [.agents/skills/tighten-docs/SKILL.md](../../.agents/skills/tighten-docs/SKILL.md) | [docs/autonomous-compression.md](../../docs/autonomous-compression.md)、[docs/patterns-duplication-and-style.md](../../docs/patterns-duplication-and-style.md) | 実行モードの既定値と戻し方、文書単位の冗長性の判断 |
| [docs/patterns-duplication-and-style.md](../../docs/patterns-duplication-and-style.md) | [.agents/skills/tighten-docs/SKILL.md](../../.agents/skills/tighten-docs/SKILL.md) | 文書間作業の除外とモード別の扱い |
| [docs/remediation.md](../../docs/remediation.md) | [docs/duplicate-handling.md](../../docs/duplicate-handling.md) | 意図した重複・準一致重複の要約 |
| [docs/routine-document-changes.md](../../docs/routine-document-changes.md) | [docs/workflow.md](../../docs/workflow.md)、[docs/verification-boundaries.md](../../docs/verification-boundaries.md) | 4工程の役割、検証器の保証範囲 |
| [docs/workflow.md](../../docs/workflow.md) | [docs/routine-document-changes.md](../../docs/routine-document-changes.md) | 再検証の位置と理由 |
| [docs/scan-targets.md](../../docs/scan-targets.md) | [docs/duplicate-handling.md](../../docs/duplicate-handling.md) | `minDuplicateChars` を数える段落本文 |
| [docs/structure.md](../../docs/structure.md) | [evals/README.md](../../evals/README.md) | 評価セットの用途と配布有無 |
| [docs/work-records-and-report.md](../../docs/work-records-and-report.md) | [docs/autonomous-compression.md](../../docs/autonomous-compression.md)、[docs/autonomous-canonicalization.md](../../docs/autonomous-canonicalization.md) | 自律モードの `回答待ち` と記録項目 |

作成・削除した文書・ディレクトリ: なし。各文書は読者経路が異なり、統合しても読む量が減らないため、文書の統合・削除は行わなかった。

合計サイズ: 132,164B → 129,046B（3,118B、2.4%削減）。配布用 `references/` の文書集合は3スキルとも変更前と同一。

保護対象: 数値（`maxDocBytes` 7000、`minDuplicateChars` 60 など）、コマンド、設定値、テスト名、リンク、法的・安全・契約上の注意、[AGENTS.md](../../AGENTS.md) の利用者規則。

残したリスク:

- 入口・要約側の言い換え（例: 4工程の各役割の補足、`safe` の説明）を削除したため、読者は正本を開くまで細部を得ない。正本に同等以上の事実があることを原文照合で確認した
- [docs/work-records-and-report.md](../../docs/work-records-and-report.md) と [docs/patterns-duplication-and-style.md](../../docs/patterns-duplication-and-style.md) の案内は、配布制約のためリンクではなく文書名による案内とした
- 未解決の矛盾（変更せず記録）: [docs/routine-document-changes.md](../../docs/routine-document-changes.md)「反復検証」末尾は判断できない候補で「利用者へ質問する」とするが、[AGENTS.md](../../AGENTS.md) は「保護対象として記録して処理を完走する」とする。値が矛盾するため一方を選ばなかった
- 同一文書内の重なり（[docs/structure.md](../../docs/structure.md) の検証器定義と表、[docs/document-size-exceptions.md](../../docs/document-size-exceptions.md) の `--init-size-exceptions` の二重説明、[README.md](../../README.md) 冒頭と Skills 表）は tighten-docs の候補として残した

### 試行2

実行: 2026-10-10T17:47:19+0900（試行1の dedupe-docs・tighten-docs 適用後の作業ツリーが対象。38文書・126,468B）

- [x] 試行1の編集で生じた重複の確認 — 2026-10-10 / ポインタ直後の要約、同一正本への二重ポインタ、ポインタだけの節を、変更された21文書の原文で照合した。[README.md](../../README.md)「設定ファイル」と [docs/agent-execution.md](../../docs/agent-execution.md)「safe と auto」の要約は試行1で導線・配布制約として保持済み。[docs/workflow.md](../../docs/workflow.md)「再検証する位置」と [docs/adoption.md](../../docs/adoption.md)「CIへの組み込み」「文書サイズ例外の管理」は、文書内で唯一の案内で、後者は [CONTRIBUTING.md](../../CONTRIBUTING.md) の断片リンク先のため保持。変更なし
- [x] 試行1で見落とした候補の確認 — 2026-10-10 / 全文書の文単位の一致を照合した。一致は各 `SKILL.md` の前提条件・完了基準（スキルごとに単独で配布されるため各スキルに必要）、[AGENTS.md](../../AGENTS.md) と [docs/routine-document-changes.md](../../docs/routine-document-changes.md)（利用者規則と導入器の管理ブロック。保護対象）、[docs/autonomous-canonicalization.md](../../docs/autonomous-canonicalization.md) と [docs/autonomous-compression.md](../../docs/autonomous-compression.md)・[docs/judgement-and-escalation.md](../../docs/judgement-and-escalation.md)（スキルごとの並行資料で配布範囲が異なる）だけで、明確な重複はない。[docs/workflow.md](../../docs/workflow.md) の `"dedupe": { "mode": "safe" }` の文は設定値を含み、契約テストの照合対象のため保持。変更なし

試行2の変更: なし。文書の変更がなく、`verify-docs` が通過したため収束。

### 最終検査結果

実行: 2026-10-10T17:47:19+0900（試行2）

実行モード: 自律正本化

| 観点 | 検査・保証内容 | 検査根拠 | 結果 |
| --- | --- | --- | --- |
| 意味的重複 | 言い換えによる同一の主張・手順・判断基準を確認した | 原文と `node scripts/document-structure-extractor.mjs` の抽出結果（38文書・450段落）の照合 | 試行1で15文書を正本化・ポインタ化。試行2は変更なし |
| 正本の配置 | 統合対象は詳細度と読者に合う文書を正本にした | 正本と統合元の原文、`node scripts/prepare-skill-distribution.mjs --output=…` による配布範囲の比較 | 是正済み。配布範囲は変更なし |
| ポインタ | 統合元から正本への案内が解決でき、内容を重ねていない | `node scripts/document-structure-verifier.mjs --json` | リンク違反0件・違反合計0件（試行1後38文書・129,046B、試行2時点126,468B） |
| 利用者の判断 | 自律正本化モードで対象内を処理した | 一時作業記録 | 回答待ちなし。矛盾1件を記録して保持（試行2で新たな判断なし） |
| テストと自己検査 | 契約テストと配布物の自己検査を通過した | `node --test scripts/*.test.mjs`、`bash ci-selfcheck.sh` | 試行2: 62件中62件通過、自己検査は終了コード0 |

## 文書簡潔化スキル

実行モード: 自律圧縮

対象: リポジトリ全体の Markdown 文書38件（`.verify-docs/` を除く）。開始サイズは dedupe-docs 完了後・本スキルの編集前の作業ツリーで測定した。範囲は同一文書内の冗長表現・同役割の節に限り、文書間の移動・正本化は行わない。

- [x] [README.md](../../README.md) — 2026-10-10 / 冒頭段落の3スキルへのリンクと自律モード2文を削除し、Skills 表へ一本化（重複する参照案内）。Skills 表の verify-docs「構造を確認し、必要な変更をMarkdown文書へ反映する」と、tighten-docs「意味を変えずに削れる冗長な表現を見つける」を隣接項目へ統合。「使えるようになる」→「使える」。意味変更リスク: 中（冒頭だけを読む読者は自律モードの存在を表まで読まないと知らない。表に同じ事実あり）
- [x] [docs/patterns-duplication-and-style.md](../../docs/patterns-duplication-and-style.md) — 2026-10-10 / 「同義語の重ね書き」と「重言」の相互説明を1か所に集約。重言の例7件を3件に削減（重複例示）。意味変更リスク: 低〜中（例の網羅性が下がる）
- [x] [.agents/skills/dedupe-docs/SKILL.md](../../.agents/skills/dedupe-docs/SKILL.md) — 2026-10-10 / 「前提条件」の同語反復文（文書構造是正スキル自体の規約は文書構造是正スキルの規約を参照する）を削除。「4. 是正後再検査」の言い換えの後半文と、「完了基準」の括弧内言い換え注釈を削除。frontmatter は変更なし。意味変更リスク: 低
- [x] [docs/adoption.md](../../docs/adoption.md) — 2026-10-10 / 参照だけの見出し「保守報告の作業単位」を削除（断片リンクの参照元なし。[docs/work-record-lifecycle.md](../../docs/work-record-lifecycle.md) は [docs/work-records-and-report.md](../../docs/work-records-and-report.md) から到達）。「文書サイズ例外の管理」の定義文（正本と重複）を削り、ポインタ1文に短縮。見出しは CONTRIBUTING.md の断片リンク先のため保持。「全て抽出し…書き出す」→「全て…書き出す」。意味変更リスク: 低
- [x] [docs/routine-document-changes.md](../../docs/routine-document-changes.md) — 2026-10-10 / 「反復検証」の「既定の `auto` では…保護対象を除く候補を処理する」を削除（同文書「無駄を減らすレビュー」の自律モードの記述と重複）。冒頭の目的文、反復検証の理由文（「〜ためである」）、測定の注記（「であり」）を簡潔化。意味変更リスク: 低（`auto` の扱いは同文書の前節に残る）
- [x] [docs/structure.md](../../docs/structure.md) — 2026-10-10 / 文書構造検証器の定義文と表の行の重複を解消: 外部 URL を検査しない理由を定義文へ寄せ、表の行から削除。Markdown構造解析器・文書構造抽出器の表の行から、直前の本文と同じ項目の列挙を削除。「そのもの」「継続して評価する」を簡潔化。意味変更リスク: 低〜中（表だけを読む読者は外部 URL の扱いを定義文で確認する必要がある）
- [x] [docs/document-size-exceptions.md](../../docs/document-size-exceptions.md) — 2026-10-10 / `--init-size-exceptions` の二重説明を末尾段落の1か所へ統合（コマンドは完全形で保持、「手動でも記述できる」も保持）。`reason` 項目の2文を1文に結合。意味変更リスク: 低
- [x] [docs/config.md](../../docs/config.md) — 2026-10-10 / 表の後の「`mode` だけを持つオブジェクトであり、値は `safe` または `auto` に限る」を削除（表の行と [docs/config-validation.md](../../docs/config-validation.md) の入力制約で同じ事実を示す）。既定 `auto` と `safe` を選ぶ条件の2文を結合。見出し「文書構造検証設定」は維持。意味変更リスク: 低〜中（入力制約は直後のリンク先に残る）
- [x] [docs/work-records-and-report.md](../../docs/work-records-and-report.md) — 2026-10-10 / 「対応する\n対応する」の連続誤字を修正。リンク作成例の後の「同じ基準でリンク先を組み立てる」を削除。テストで保護された文言（`現在の会話で利用者に質問する`、`保守報告は未解決の判断を埋める場所ではない`）は変更なし。意味変更リスク: 低
- [x] [.agents/skills/tighten-docs/SKILL.md](../../.agents/skills/tighten-docs/SKILL.md) — 2026-10-10 / 「制約と対象外」の文書間作業の項目本文を「不変条件」への参照に置換（同文書内の重複）。「不変条件」は [docs/patterns-duplication-and-style.md](../../docs/patterns-duplication-and-style.md) の案内先のため保持。frontmatter は変更なし。意味変更リスク: 低
- [x] [docs/advanced-usage.md](../../docs/advanced-usage.md) — 2026-10-10 / 文書構造抽出器の出力内容の二重説明（見出し階層と段落のJSON出力）を後段の一文へ一本化。意味変更リスク: 低
- [x] [docs/object-naming.md](../../docs/object-naming.md) — 2026-10-10 / 「定義文書での記載」の3項目を一組で示す規則の二重記載を1文へ統合。意味変更リスク: 低
- [x] [docs/duplicate-handling.md](../../docs/duplicate-handling.md) — 2026-10-10 / 理由併記の推奨文を簡潔化。テストで保護された改行位置を含む2文は変更なし。意味変更リスク: 低
- [x] [docs/agent-compatibility.md](../../docs/agent-compatibility.md) — 2026-10-10 / 「自体は機械では判定できず、人が検出する」→「は人が判定する」。意味変更リスク: 低
- [x] [CONTRIBUTING.md](../../CONTRIBUTING.md) — 2026-10-10 / 「実行すればよい」→「実行する」。テスト名・コマンドは変更なし。意味変更リスク: 低
- [x] [docs/remediation.md](../../docs/remediation.md) — 2026-10-10 / 「削減自体は」→「削減は」。手順1〜6の順序と見出しは変更なし。意味変更リスク: 低
- [x] [.agents/skills/verify-docs/SKILL.md](../../.agents/skills/verify-docs/SKILL.md) — 2026-10-10 / 「不変条件」は保護対象（免責・一字一句規則）。他は入口としてのポインタで、同一文書内の冗長なし。変更なし
- [x] [AGENTS.md](../../AGENTS.md) — 2026-10-10 / 利用者の必須要件で導入器の管理ブロックと同文。保護対象として変更なし
- [x] [CLAUDE.md](../../CLAUDE.md) — 2026-10-10 / `@AGENTS.md` の取り込みのみ。変更なし
- [x] [docs/agent-execution.md](../../docs/agent-execution.md) — 2026-10-10 / 手順は順序が保護対象。保護対象の列挙は配布制約で残された文。変更なし
- [x] [docs/autonomous-canonicalization.md](../../docs/autonomous-canonicalization.md) — 2026-10-10 / 契約テストが改行位置を含めて照合する文言が大半。変更なし
- [x] [docs/autonomous-compression.md](../../docs/autonomous-compression.md) — 2026-10-10 / 契約テストが照合する文言と保護規則のみ。変更なし
- [x] [docs/canonical-selection.md](../../docs/canonical-selection.md) — 2026-10-10 / 条件列挙と判定器の入出力。同一文書内の冗長なし。変更なし
- [x] [docs/ci-integration.md](../../docs/ci-integration.md) — 2026-10-10 / YAML とコマンドが主体。変更なし
- [x] [docs/config-validation.md](../../docs/config-validation.md) — 2026-10-10 / 入力制約の正本で、設定値は保護対象。変更なし
- [x] [docs/judgement-and-escalation.md](../../docs/judgement-and-escalation.md) — 2026-10-10 / 契約テストの照合文言を含む判断規則。変更なし
- [x] [docs/maintenance-report-format.md](../../docs/maintenance-report-format.md) — 2026-10-10 / 報告様式と計算式。同一文書内の冗長なし。変更なし
- [x] [docs/mode-comparison.md](../../docs/mode-comparison.md) — 2026-10-10 / 比較手順の順序・計算式・テスト照合文言。変更なし
- [x] [docs/operations.md](../../docs/operations.md) — 2026-10-10 / 表のジョブ名は識別子で保護対象。変更なし
- [x] [docs/patterns-markdown.md](../../docs/patterns-markdown.md) — 2026-10-10 / パターン一覧。冗長なし。変更なし
- [x] [docs/patterns-wording.md](../../docs/patterns-wording.md) — 2026-10-10 / パターン一覧。冗長なし。変更なし
- [x] [docs/progressive-disclosure.md](../../docs/progressive-disclosure.md) — 2026-10-10 / 契約テストの照合文言を多数含む規約。変更なし
- [x] [docs/scan-targets.md](../../docs/scan-targets.md) — 2026-10-10 / 設定方針の理由（意図的な例外）を含む。数値60を含む文は保護。変更なし
- [x] [docs/skill-references.md](../../docs/skill-references.md) — 2026-10-10 / 配布手順とリンク一覧。リンクは配布範囲を決めるため保持。変更なし
- [x] [docs/verification-boundaries.md](../../docs/verification-boundaries.md) — 2026-10-10 / 2段落のみ。変更なし
- [x] [docs/work-record-lifecycle.md](../../docs/work-record-lifecycle.md) — 2026-10-10 / 作業単位の定義。冗長なし。変更なし
- [x] [docs/workflow.md](../../docs/workflow.md) — 2026-10-10 / 依頼例と契約テストの照合文言。「再検証する位置」は dedupe-docs が作ったポインタのため保持。変更なし
- [x] [evals/README.md](../../evals/README.md) — 2026-10-10 / 短い正本。変更なし

変更しなかった保護対象: 数値（`maxDocBytes` 7000、`minDuplicateChars` 60、Node.js 22.0.0 など）、コマンド、コードブロック、設定キー・値、ファイルパス、リンク先、テスト名、断片リンク先の見出し、法的・安全・契約上の注意、各 `SKILL.md` の frontmatter `description`、手順の順序、[AGENTS.md](../../AGENTS.md)。新たな Markdown リンクは追加していない。配布用 `references/` の文書集合は3スキルとも変更前と同一。

残したリスク:

- [README.md](../../README.md) の冒頭から自律モードの説明を除いたため、自律モードの存在は Skills 表で知る
- [docs/routine-document-changes.md](../../docs/routine-document-changes.md)「反復検証」の「同じ候補が繰り返し残り…利用者へ質問する」は `auto` の完走規則（同文書前節・[AGENTS.md](../../AGENTS.md)）と食い違って読めるが、意味の変更に当たるため本スキルでは変更していない

### 試行2

実行: 2026-10-10T17:47:19+0900（dedupe-docs 試行2 の後。dedupe-docs 試行2 は変更なし）

- [x] 全38文書の同一文書内の冗長確認 — 2026-10-10 / 試行1の編集で生じた参照だけの節、重複する参照案内、隣接する同役割の文を照合した。[docs/workflow.md](../../docs/workflow.md)「再検証する位置」と [docs/adoption.md](../../docs/adoption.md) のポインタ節は文書内で唯一の案内（参照だけの見出しの削除条件「既出の文書へのリンクを繰り返す」に当たらない）。[docs/config.md](../../docs/config.md) の表の後の文は `safe` を選ぶ条件の正本で、[README.md](../../README.md)・[docs/agent-execution.md](../../docs/agent-execution.md) からの案内先のため保持。その他は試行1で保護対象・変更なしと記録済みで、新たな理由はない。変更なし

試行2の変更: なし。各ファイルの最終サイズは試行1と同一。

### ファイル別サイズ

| ファイル | 開始時点 | 最終 | 削減バイト数 | 開始時点からの削減率 |
| --- | ---: | ---: | ---: | ---: |
| [README.md](../../README.md) | 6,557B | 5,823B | 734B | 11.2% |
| [docs/patterns-duplication-and-style.md](../../docs/patterns-duplication-and-style.md) | 3,503B | 3,217B | 286B | 8.2% |
| [.agents/skills/dedupe-docs/SKILL.md](../../.agents/skills/dedupe-docs/SKILL.md) | 6,865B | 6,602B | 263B | 3.8% |
| [docs/adoption.md](../../docs/adoption.md) | 2,114B | 1,874B | 240B | 11.4% |
| [docs/routine-document-changes.md](../../docs/routine-document-changes.md) | 5,991B | 5,802B | 189B | 3.2% |
| [docs/structure.md](../../docs/structure.md) | 4,637B | 4,461B | 176B | 3.8% |
| [docs/document-size-exceptions.md](../../docs/document-size-exceptions.md) | 2,947B | 2,797B | 150B | 5.1% |
| [docs/config.md](../../docs/config.md) | 4,675B | 4,538B | 137B | 2.9% |
| [docs/work-records-and-report.md](../../docs/work-records-and-report.md) | 6,216B | 6,101B | 115B | 1.9% |
| [.agents/skills/tighten-docs/SKILL.md](../../.agents/skills/tighten-docs/SKILL.md) | 6,408B | 6,328B | 80B | 1.2% |
| [docs/advanced-usage.md](../../docs/advanced-usage.md) | 2,930B | 2,874B | 56B | 1.9% |
| [docs/object-naming.md](../../docs/object-naming.md) | 2,630B | 2,578B | 52B | 2.0% |
| [docs/duplicate-handling.md](../../docs/duplicate-handling.md) | 2,811B | 2,762B | 49B | 1.7% |
| [docs/agent-compatibility.md](../../docs/agent-compatibility.md) | 2,297B | 2,261B | 36B | 1.6% |
| [CONTRIBUTING.md](../../CONTRIBUTING.md) | 3,854B | 3,845B | 9B | 0.2% |
| [docs/remediation.md](../../docs/remediation.md) | 4,207B | 4,201B | 6B | 0.1% |
| [.agents/skills/verify-docs/SKILL.md](../../.agents/skills/verify-docs/SKILL.md) | 6,965B | 6,965B | 0B | 0.0% |
| [AGENTS.md](../../AGENTS.md) | 4,345B | 4,345B | 0B | 0.0% |
| [CLAUDE.md](../../CLAUDE.md) | 11B | 11B | 0B | 0.0% |
| [docs/agent-execution.md](../../docs/agent-execution.md) | 2,019B | 2,019B | 0B | 0.0% |
| [docs/autonomous-canonicalization.md](../../docs/autonomous-canonicalization.md) | 4,307B | 4,307B | 0B | 0.0% |
| [docs/autonomous-compression.md](../../docs/autonomous-compression.md) | 2,218B | 2,218B | 0B | 0.0% |
| [docs/canonical-selection.md](../../docs/canonical-selection.md) | 3,261B | 3,261B | 0B | 0.0% |
| [docs/ci-integration.md](../../docs/ci-integration.md) | 720B | 720B | 0B | 0.0% |
| [docs/config-validation.md](../../docs/config-validation.md) | 804B | 804B | 0B | 0.0% |
| [docs/judgement-and-escalation.md](../../docs/judgement-and-escalation.md) | 2,083B | 2,083B | 0B | 0.0% |
| [docs/maintenance-report-format.md](../../docs/maintenance-report-format.md) | 5,603B | 5,603B | 0B | 0.0% |
| [docs/mode-comparison.md](../../docs/mode-comparison.md) | 3,301B | 3,301B | 0B | 0.0% |
| [docs/operations.md](../../docs/operations.md) | 5,398B | 5,398B | 0B | 0.0% |
| [docs/patterns-markdown.md](../../docs/patterns-markdown.md) | 1,112B | 1,112B | 0B | 0.0% |
| [docs/patterns-wording.md](../../docs/patterns-wording.md) | 2,060B | 2,060B | 0B | 0.0% |
| [docs/progressive-disclosure.md](../../docs/progressive-disclosure.md) | 4,390B | 4,390B | 0B | 0.0% |
| [docs/scan-targets.md](../../docs/scan-targets.md) | 3,499B | 3,499B | 0B | 0.0% |
| [docs/skill-references.md](../../docs/skill-references.md) | 1,340B | 1,340B | 0B | 0.0% |
| [docs/verification-boundaries.md](../../docs/verification-boundaries.md) | 532B | 532B | 0B | 0.0% |
| [docs/work-record-lifecycle.md](../../docs/work-record-lifecycle.md) | 938B | 938B | 0B | 0.0% |
| [docs/workflow.md](../../docs/workflow.md) | 4,594B | 4,594B | 0B | 0.0% |
| [evals/README.md](../../evals/README.md) | 904B | 904B | 0B | 0.0% |

合計: 129,046B → 126,468B（2,578B、2.0%削減）。

### 最終検査結果

実行: 2026-10-10T17:47:19+0900（試行2）

実行モード: 自律圧縮

| 観点 | 検査・保証内容 | 検査根拠 | 結果 |
| --- | --- | --- | --- |
| 意味変更リスク | 変更箇所ごとのリスクを上記に記録した。数値・コマンド・設定値・手順順序・免責文言・法的・安全・契約上の注意は変更していない | 変更前後の原文照合（`git diff`） | 記録済み（意味の保持は保証しない）。試行2は変更なし |
| 語句と文法 | 冗長な可能表現、冗長接続表現、形式的な言い回し、連続誤字を確認した | 典型パターンと原文 | 是正済み |
| 重複と文体 | 同一文書内の同役割の説明、重複例示、括弧内言い換え注釈、参照だけの見出しを確認した | 典型パターンと原文 | 是正済み |
| Markdown表現 | 空行、強調、リンクテキスト、表、装飾の冗長さを確認した | 典型パターンと原文 | 通過 |
| リンク・構文 | リンク・断片リンク・孤立・サイズ・機械的重複 | `node scripts/document-structure-verifier.mjs` | 「文書構造: すべて通過」 |
| 契約テスト | スキル契約・検証器・抽出器などのテスト | `node --test scripts/*.test.mjs` | 62件中62件通過 |
| 自己検査 | 配布物・導入器・配布範囲 | `bash ci-selfcheck.sh` | 終了コード0 |
