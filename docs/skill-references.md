# スキル補助文書の正本

[README.md](../README.md)から参照される。`docs/` 内のスキル補助文書はここを正本とし、
ソースの各 `SKILL.md` はここを直接参照する。`install.sh` は
`prepare-skill-distribution.mjs` を実行し、各スキルから到達可能な文書だけを配布用の
`references/` へコピーして、配布版の `SKILL.md` のリンクを書き換える。到達可能な文書は、
ソースの各 `SKILL.md` が `docs/` へ張ったリンクを起点に再帰的に求める。配布用の
`references/` はインストール時だけ一時生成し、リポジトリには含めない。

`docs/` 内のスキル補助文書を変更した場合は、自己検査で
`node scripts/prepare-skill-distribution.mjs` を実行する。

## 文書重複解消スキル

- [判定と利用者への質問](judgement-and-escalation.md)
- [正本候補の選定規約](canonical-selection.md)
- [自律正本化モード](autonomous-canonicalization.md)
- [文書保守モードの比較](mode-comparison.md)

## 文書簡潔化スキル

- [語句・文法のパターン](patterns-wording.md)
- [重複・文体のパターン](patterns-duplication-and-style.md)
- [Markdown表現のパターン](patterns-markdown.md)
- [文書保守モードの比較](mode-comparison.md)
