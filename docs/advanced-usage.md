# 文書構造検証器のCLIリファレンス

## 文書構造の検査

[文書構造検証器](structure.md#文書構造検証器)を実行する。

```bash
node scripts/document-structure-verifier.mjs
```

## PR差分の検査

基準ブランチから変更したパスに関係する違反だけを失敗として返す。リンク解決などは
リポジトリ全体を解析するため、変更していない文書へのリンク切れも、変更で起きた場合は
検出する。Gitで文書を移動した場合は、移動元・移動先の両方を変更パスとして扱うため、
移動元を参照したままの文書も検出できる。

```bash
node scripts/document-structure-verifier.mjs --changed-base=origin/main
```

## 既存の違反を基準にした検査

開始前から違反が残っている文書群で、作業が新たな違反を生んでいないかを確かめる。
開始時の `--json` 出力を保存し、作業後に `--baseline` で渡すと、基準にある違反
（種別・発生元・対象が同じもの）を除いた新たな違反だけを失敗として返す。

```bash
node scripts/document-structure-verifier.mjs --json > /tmp/verify-docs-baseline.json
node scripts/document-structure-verifier.mjs --baseline=/tmp/verify-docs-baseline.json
```

## 文書構造スナップショットのJSON出力

[文書構造抽出器](structure.md#文書構造抽出器)は、文書重複解消スキル／文書簡潔化スキルで対象文書を調べるときに使う。
意味的な重複や冗長性は判定しない。

```bash
node scripts/document-structure-extractor.mjs --root=. README.md docs/guide.md
```

各指定文書について、DocumentStructureSnapshot（文書構造スナップショット）として見出し階層・段落・位置・バイト数を返す。出力項目の使い方は各スキルの手順を参照。

## 既存のサイズ超過の例外記録

既存文書に違反があるリポジトリでは、最初に次を実行する。

```bash
node scripts/document-structure-verifier.mjs --init-size-exceptions
```

## 文書構造検証レポートのJSON出力

```bash
node scripts/document-structure-verifier.mjs --json
```

## 大規模コーパスの性能・構造検出精度ベンチマーク

実在の文書を複製せず、指定した文書数と段落数のMarkdownコーパスを一時ディレクトリに
生成して測定する。生成器は、完全一致重複、断片リンク切れ、ファイルリンク切れ、孤立文書を
`issues`件ずつ意図的に含める。出力の`accuracy`は、この既知の構造違反に対する適合率・再現率である。
意味的重複の正本化や冗長性の判断は採点しない。

```bash
node scripts/benchmark-document-structure.mjs --documents=1000 --paragraphs=20 --issues=100 --runs=11
```

`verification`は文書構造検証器、`extraction`はdedupe-docs・tighten-docsで使う構造抽出の
準備を測る。`runs`回の結果から最小値・中央値・p95・平均・最大値をJSONで返す。

## 正本候補の機械判定

[正本候補の選定規約](canonical-selection.md)に従い、比較した二つの候補をJSONで渡す。入力の`facts`と出力の判定は[判定器への入力](canonical-selection.md#判定器への入力)を参照する。

```bash
node scripts/select-canonical.mjs candidate-pair.json
```
