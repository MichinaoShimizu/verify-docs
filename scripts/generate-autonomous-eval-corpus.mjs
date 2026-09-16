#!/usr/bin/env node

import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const rootArg = process.argv.find((arg) => arg.startsWith('--root='));
const clustersArg = process.argv.find((arg) => arg.startsWith('--clusters='));
if (!rootArg) throw new Error('--root=PATH is required');
const root = resolve(rootArg.slice(7));
const clusters = Number(clustersArg?.slice(11) ?? 30);
if (!Number.isInteger(clusters) || clusters < 1) throw new Error('clusters must be positive');
const baseline = join(root, 'baseline');
const reference = join(root, 'reference-output');
rmSync(root, { recursive: true, force: true });
for (const target of [baseline, reference]) mkdirSync(join(target, 'docs'), { recursive: true });
const canonicalizations = [];
const allowedChanges = ['README.md'];
const requiredFacts = [];
const protectedFacts = [];
const baselineLinks = [];
const referenceLinks = [];
for (let index = 1; index <= clusters; index += 1) {
  const id = String(index).padStart(3, '0');
  const guide = `docs/guide-${id}.md`;
  const legacy = `docs/legacy-${id}.md`;
  const operations = `docs/operations-${id}.md`;
  const deploy = `docs/deploy-${id}.md`;
  const fact = `設定${id}を変更した後も検証器を再実行する`;
  const protectedFact = `タイムアウトは${index + 20}秒`;
  const common = `利用者は導入前にバックアップを作成し、パッケージを導入してから検証器を実行する。`;
  writeFileSync(join(baseline, guide), `# 導入 ${id}\n\n${common}\n`);
  writeFileSync(join(baseline, legacy), `# 旧導入 ${id}\n\n${common}\n\n${fact}。\n`);
  writeFileSync(join(baseline, operations), `# 運用 ${id}\n\n運用担当者は障害対応時に復旧手順を確認する。導入利用者とは対象読者が異なる。\n`);
  writeFileSync(join(baseline, deploy), `# デプロイ ${id}\n\n本番モードを使う。${protectedFact}。再試行の順序は変更しない。\n\n本番モードを使う。${protectedFact}。再試行の順序は変更しない。\n`);
  writeFileSync(join(reference, guide), `# 導入 ${id}\n\n${common} ${fact}。\n`);
  writeFileSync(join(reference, operations), readFileSync(join(baseline, operations), 'utf8'));
  writeFileSync(join(reference, deploy), `# デプロイ ${id}\n\n本番モードを使う。${protectedFact}。再試行の順序は変更しない。\n`);
  baselineLinks.push(`[導入 ${id}](${guide})`, `[旧導入 ${id}](${legacy})`, `[運用 ${id}](${operations})`, `[デプロイ ${id}](${deploy})`);
  referenceLinks.push(`[導入 ${id}](${guide})`, `[運用 ${id}](${operations})`, `[デプロイ ${id}](${deploy})`);
  canonicalizations.push({ canonicalPath: guide, removedPath: legacy });
  allowedChanges.push(guide, legacy, deploy);
  requiredFacts.push(fact);
  protectedFacts.push(protectedFact, '再試行の順序は変更しない');
}
writeFileSync(join(baseline, 'README.md'), `# 評価コーパス\n\n${baselineLinks.join('\n')}\n`);
writeFileSync(join(reference, 'README.md'), `# 評価コーパス\n\n${referenceLinks.join('\n')}\n`);
writeFileSync(join(root, 'oracle.json'), JSON.stringify({ canonicalizations, requiredFacts, protectedFacts, allowedChanges }, null, 2));
console.log(JSON.stringify({ baseline, reference, oracle: join(root, 'oracle.json'), documents: clusters * 4 + 1 }, null, 2));
