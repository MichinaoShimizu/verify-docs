import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  rmSync,
  symlinkSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DEFAULTS, verifyDocumentStructure } from './document-structure-verifier.mjs';

const SCRIPT = join(import.meta.dirname, 'document-structure-verifier.mjs');

function makeRepo(files) {
  const root = mkdtempSync(join(tmpdir(), 'verify-docs-test-'));
  for (const [path, content] of Object.entries(files)) {
    const full = join(root, path);
    mkdirSync(join(full, '..'), { recursive: true });
    writeFileSync(full, content);
  }
  return root;
}

function run(root, extraArgs = []) {
  return verifyDocumentStructure(root, { configPath: extraArgs.find((arg) => arg.startsWith('--config='))?.slice(9) });
}

function runError(root) {
  try {
    verifyDocumentStructure(root);
    assert.fail('expected verify-docs to fail');
  } catch (error) {
    return `設定エラー: ${error.message}`;
  }
}

test('clean repo passes', () => {
  const root = makeRepo({
    'README.md': '# Repo\n\n[docs](docs/guide.md)\n',
    'docs/guide.md': '# Guide\n\nSome content.\n',
  });
  const result = run(root);
  assert.deepEqual(result.violations, []);
  assert.deepEqual(result.summary.documents, { count: 2, bytes: 53, headings: 2, paragraphs: 2 });
  assert.deepEqual(result.summary.violations, { count: 0, byKind: {} });
  assert.equal(result.summary.largestSections[0].path, 'README.md');
  rmSync(root, { recursive: true, force: true });
});

test('installer default configuration contains every verifier default', () => {
  const configuration = JSON.parse(readFileSync(join(import.meta.dirname, '..', 'verify-docs.config.json'), 'utf8'));
  assert.deepEqual(configuration, DEFAULTS);
});

test('detects broken link', () => {
  const root = makeRepo({ 'README.md': '# Repo\n\n[missing](docs/missing.md)\n' });
  const violation = run(root).violations.find((f) => f.kind === 'link');
  assert.equal(violation.location.path, 'README.md');
  assert.equal(violation.location.start.line, 3);
  assert.deepEqual(violation.location.headingPath, ['Repo']);
  rmSync(root, { recursive: true, force: true });
});

test('checks image destinations and ignores external CommonMark autolinks', () => {
  const root = makeRepo({
    'README.md': '# Repo\n\n<https://example.com>\n\n![missing image](images/missing.png)\n',
  });
  const violations = run(root).violations;
  assert.equal(violations.length, 1);
  assert.equal(violations[0].kind, 'link');
  assert.equal(violations[0].target, 'images/missing.png');
  rmSync(root, { recursive: true, force: true });
});

test('ignores link syntax inside inline code and HTML comments', () => {
  const root = makeRepo({
    'README.md': '# Repo\n\n`[example](missing.md)`\n\n<!-- [example](also-missing.md) -->\n',
  });
  assert.deepEqual(run(root).violations, []);
  rmSync(root, { recursive: true, force: true });
});

test('supports balanced parentheses in inline link destinations', () => {
  const root = makeRepo({
    'README.md': '# Repo\n\n[guide](docs/guide_(draft).md)\n',
    'docs/guide_(draft).md': '# Guide\n',
  });
  assert.deepEqual(run(root).violations, []);
  rmSync(root, { recursive: true, force: true });
});

test('supports angle-bracket destinations with spaces and an optional title', () => {
  const root = makeRepo({
    'README.md': '# Repo\n\n[guide](<docs/guide draft.md> "Guide")\n',
    'docs/guide draft.md': '# Guide\n',
  });
  assert.deepEqual(run(root).violations, []);
  rmSync(root, { recursive: true, force: true });
});

test('supports full, collapsed, and shortcut reference links', () => {
  const root = makeRepo({
    'README.md': [
      '# Repo',
      '',
      '[Full][Guide Ref] [Guide Ref][] [Guide Ref]',
      '',
      '[guide ref]: docs/guide.md "Guide title"',
      '',
    ].join('\n'),
    'docs/guide.md': '# Guide\n',
  });
  assert.deepEqual(run(root).violations, []);
  rmSync(root, { recursive: true, force: true });
});

test('treats unresolved references as text and detects broken defined destinations', () => {
  const root = makeRepo({
    'README.md': [
      '# Repo',
      '',
      '[undefined][missing]',
      '[broken][guide]',
      '',
      '[guide]: docs/missing.md',
      '',
    ].join('\n'),
  });
  const violations = run(root).violations;
  assert.ok(!violations.some((violation) => violation.kind === 'link' && violation.reason.includes('定義がない')));
  assert.ok(violations.some((violation) => violation.kind === 'link' && violation.target === 'docs/missing.md'));
  rmSync(root, { recursive: true, force: true });
});

test('ignores link-like content in CommonMark code blocks and parses setext headings', () => {
  const root = makeRepo({
    'README.md': [
      '# Repo',
      '',
      '~~~markdown',
      '[fake](missing.md)',
      '~~~',
      '',
      '[guide](docs/guide.md#hello-code-world)',
      '',
    ].join('\n'),
    'docs/guide.md': 'Hello *Code* `World`\n---\n',
  });
  assert.deepEqual(run(root).violations, []);
  rmSync(root, { recursive: true, force: true });
});

test('detects missing fragment', () => {
  const root = makeRepo({ 'README.md': '# Repo\n\n[section](#nope)\n' });
  assert.ok(run(root).violations.some((f) => f.kind === 'fragment'));
  rmSync(root, { recursive: true, force: true });
});

test('recognizes HTML id and name anchors as fragment targets', () => {
  const root = makeRepo({
    'README.md': [
      '# Repo',
      '',
      '[step](#step1) [block](#install) [guide](docs/guide.md#legacy) [missing](#nowhere)',
      '',
      '## Step 1: Create a branch<a name="step1"></a>',
      '',
      '<div id="install">Install</div>',
      '',
      '```html',
      '<a id="nowhere"></a>',
      '```',
      '',
    ].join('\n'),
    'docs/guide.md': "# Guide\n\n<a id='legacy'></a>\n\nText.\n",
  });
  const fragments = run(root).violations.filter((f) => f.kind === 'fragment');
  assert.deepEqual(fragments.map((f) => f.target), ['#nowhere']);
  rmSync(root, { recursive: true, force: true });
});

test('HTML anchors do not shift GitHub duplicate-heading suffixes', () => {
  const root = makeRepo({
    'README.md': '# Repo\n\n<a id="setup"></a>\n\n## Setup\n\n## Setup\n\n[first](#setup) [second](#setup-1) [none](#setup-2)\n',
  });
  const fragments = run(root).violations.filter((f) => f.kind === 'fragment');
  assert.deepEqual(fragments.map((f) => f.target), ['#setup-2']);
  rmSync(root, { recursive: true, force: true });
});

test('builds fragment IDs exactly like GitHub (github-slugger)', () => {
  const root = makeRepo({
    'README.md': [
      '# Repo',
      '',
      '## Linting & Formatting',
      '',
      '## 🚀 Emoji 見出し',
      '',
      '## I ♥ unicode.',
      '',
      '## snake_case and हिन्दी',
      '',
      '[a](#linting--formatting) [b](#-emoji-見出し) [c](#i--unicode) [d](#snake_case-and-हिन्दी)',
      '[old-a](#linting-formatting) [old-b](#emoji-見出し)',
      '',
    ].join('\n'),
  });
  const fragments = run(root).violations.filter((f) => f.kind === 'fragment').map((f) => decodeURIComponent(f.target));
  assert.deepEqual(fragments, ['#linting-formatting', '#emoji-見出し']);
  rmSync(root, { recursive: true, force: true });
});

test('recognizes GitHub-style fragment IDs for duplicate headings', () => {
  const root = makeRepo({
    'README.md': '# Repo\n\n[second duplicate](docs/guide.md#section-2)\n',
    'docs/guide.md': [
      '# Guide',
      '## Section',
      '## Section',
      '## Section-1',
      '## Section',
      '',
    ].join('\n'),
  });
  assert.deepEqual(run(root).violations, []);
  rmSync(root, { recursive: true, force: true });
});

test('detects bad backtick path', () => {
  const root = makeRepo({ 'README.md': '# Repo\n\nSee `scripts/missing.mjs`.\n' });
  assert.ok(run(root).violations.some((f) => f.kind === 'path'));
  rmSync(root, { recursive: true, force: true });
});

test('detects orphan doc under docsDir', () => {
  const root = makeRepo({
    'README.md': '# Repo\n',
    'docs/orphan.md': '# Orphan\n',
  });
  const result = run(root);
  assert.ok(result.violations.some((f) => f.kind === 'orphan' && f.from === 'docs/orphan.md'));
  rmSync(root, { recursive: true, force: true });
});

test('scans the whole repo, not just entryPoints/docsDir/skillsDir (detects orphan elsewhere)', () => {
  const root = makeRepo({
    'README.md': '# Repo\n',
    'CONTRIBUTING.md': '# Contributing\n',
  });
  const result = run(root);
  assert.ok(result.violations.some((f) => f.kind === 'orphan' && f.from === 'CONTRIBUTING.md'));
  rmSync(root, { recursive: true, force: true });
});

test('excludePaths keeps excluded directories out of the scan entirely', () => {
  const root = makeRepo({
    'README.md': '# Repo\n',
    'node_modules/some-lib/README.md': '# Some lib\n[missing](missing.md)\n',
  });
  assert.deepEqual(run(root).violations, []);
  rmSync(root, { recursive: true, force: true });
});

test('node_modules and .git in excludePaths are excluded at any depth, other entries only from the root', () => {
  const broken = '# Broken\n[missing](missing.md)\n';
  const root = makeRepo({
    'README.md': '# Repo\n',
    'packages/a/node_modules/dep/README.md': broken,
    'packages/a/.git/info.md': broken,
    'scripts/build/README.md': broken,
    'build/out.md': broken,
  });
  const scanned = [...new Set(run(root).violations.map((f) => f.from))].sort();
  assert.deepEqual(scanned, ['scripts/build/README.md']);
  rmSync(root, { recursive: true, force: true });
});

test('excludePaths entries without a trailing slash also exclude files', () => {
  const shared = 'This paragraph is intentionally long enough to trigger duplicate detection logic here.';
  const root = makeRepo({
    'README.md': '# Repo\n',
    'packages/a/CHANGELOG.md': `# A\n\n${shared}\n`,
    'packages/b/CHANGELOG.md': `# B\n\n${shared}\n`,
    'docs/old.md': '# Old\n[missing](missing.md)\n',
    'packages/a/docs/old.md': '# Kept\n[missing](missing.md)\n',
    'dist/out.md': '# Out\n[missing](missing.md)\n',
    'verify-docs.config.json': JSON.stringify({ excludePaths: ['CHANGELOG.md', 'docs/old.md', 'dist'] }),
  });
  const scanned = [...new Set(run(root).violations.map((f) => f.from))].sort();
  assert.deepEqual(scanned, ['packages/a/docs/old.md']);
  rmSync(root, { recursive: true, force: true });
});

test('excludePaths entries starting with **/ match at any depth', () => {
  const broken = '# Broken\n[missing](missing.md)\n';
  const root = makeRepo({
    'README.md': '# Repo\n',
    'packages/a/src/__tests__/__fixtures__/base.md': broken,
    '__fixtures__/top.md': broken,
    'tests/format/js/README.md': broken,
    'other/tests/format/x.md': broken,
    'tests/formatter/keep.md': broken,
    'packages/b/NOTES.md': broken,
    'verify-docs.config.json': JSON.stringify({ excludePaths: ['**/__fixtures__/', '**/tests/format/', '**/b/NOTES.md'] }),
  });
  const scanned = [...new Set(run(root).violations.map((f) => f.from))].sort();
  assert.deepEqual(scanned, ['tests/formatter/keep.md']);
  rmSync(root, { recursive: true, force: true });
});

test('text output lists violation hotspots only when violations are numerous', () => {
  const files = { 'README.md': '# Repo\n' };
  for (let i = 0; i < 20; i++) files[`packages/a/__fixtures__/f${i}.md`] = `# F${i}\n`;
  files['docs/one.md'] = '# One\n';
  const many = makeRepo(files);
  const output = (() => {
    try { execFileSync('node', [SCRIPT, `--root=${many}`], { encoding: 'utf8', stdio: 'pipe' }); return ''; }
    catch (error) { return error.stderr; }
  })();
  assert.match(output, /違反の多いディレクトリ（上位5件）:\n  - packages\/a\/__fixtures__\/ — 20件（孤立 20）\n  - docs\/ — 1件（孤立 1）/);
  assert.match(output, /excludePaths/);
  rmSync(many, { recursive: true, force: true });

  const few = makeRepo({ 'README.md': '# Repo\n', 'docs/one.md': '# One\n' });
  const fewOutput = (() => {
    try { execFileSync('node', [SCRIPT, `--root=${few}`], { encoding: 'utf8', stdio: 'pipe' }); return ''; }
    catch (error) { return error.stderr; }
  })();
  assert.doesNotMatch(fewOutput, /違反の多いディレクトリ/);
  rmSync(few, { recursive: true, force: true });
});

test('uses legacy .claude/skills when .agents/skills is absent', () => {
  const root = makeRepo({
    'README.md': '# Repo\n',
    '.claude/skills/example/SKILL.md': '# Example\n\n[reference](references/guide.md)\n',
    '.claude/skills/example/references/guide.md': '# Guide\n',
  });
  assert.deepEqual(run(root).violations, []);
  rmSync(root, { recursive: true, force: true });
});

test('uses .kiro/skills when other skill directories are absent', () => {
  const root = makeRepo({
    'README.md': '# Repo\n',
    '.kiro/skills/example/SKILL.md': '# Example\n\n[reference](references/guide.md)\n',
    '.kiro/skills/example/references/guide.md': '# Guide\n',
  });
  assert.deepEqual(run(root).violations, []);
  rmSync(root, { recursive: true, force: true });
});

test('does not scan a symlinked compatibility skill directory twice', () => {
  const root = makeRepo({
    'README.md': '# Repo\n',
    '.agents/skills/example/SKILL.md': '# Example\n\n[reference](references/guide.md)\n',
    '.agents/skills/example/references/guide.md': '# Guide\n',
  });
  mkdirSync(join(root, '.claude'), { recursive: true });
  symlinkSync('../.agents/skills', join(root, '.claude/skills'), 'dir');
  mkdirSync(join(root, '.kiro'), { recursive: true });
  symlinkSync('../.agents/skills', join(root, '.kiro/skills'), 'dir');
  assert.deepEqual(run(root).violations, []);
  rmSync(root, { recursive: true, force: true });
});

test('skill references reachable through other references of the same skill are not orphans', () => {
  const root = makeRepo({
    'README.md': '# Repo\n',
    '.agents/skills/example/SKILL.md': '# Example\n\n[first](references/first.md)\n',
    '.agents/skills/example/references/first.md': '# First\n\n[second](second.md)\n',
    '.agents/skills/example/references/second.md': '# Second\n',
    '.agents/skills/example/references/unreachable.md': '# Unreachable\n\n[second](second.md)\n',
    '.agents/skills/other/SKILL.md': '# Other\n\n[foreign](../example/references/foreign.md)\n',
    '.agents/skills/example/references/foreign.md': '# Foreign\n',
  });
  const orphans = run(root).violations.filter((f) => f.kind === 'orphan').map((f) => f.from).sort();
  assert.deepEqual(orphans, [
    '.agents/skills/example/references/foreign.md',
    '.agents/skills/example/references/unreachable.md',
  ]);
  rmSync(root, { recursive: true, force: true });
});

test('orphanExemptPaths exempts only the orphan check', () => {
  const root = makeRepo({
    'README.md': '# Repo\n',
    'website/docs/intro.md': '# Intro\n\n[missing](missing.md)\n',
    'website/docs/guide/setup.md': '# Setup\n',
    'website/blog/post.md': '# Post\n',
    'verify-docs.config.json': JSON.stringify({ orphanExemptPaths: ['website/docs/'] }),
  });
  const found = run(root).violations.map((f) => `${f.kind}:${f.from}`).sort();
  assert.deepEqual(found, ['link:website/docs/intro.md', 'orphan:website/blog/post.md']);
  rmSync(root, { recursive: true, force: true });
});

test('agent configuration docs are exempt from orphan checks', () => {
  const root = makeRepo({
    'README.md': '# Repo\n',
    '.agents/rules/local.md': '# Local agent rule\n',
    '.claude/rules/local.md': '# Local Claude rule\n',
    '.kiro/steering/local.md': '# Local Kiro rule\n',
  });
  assert.deepEqual(run(root).violations, []);
  rmSync(root, { recursive: true, force: true });
});

test('flags oversized doc and honors sizeExceptions exemption', () => {
  const big = '# Big\n\n' + 'x'.repeat(40000) + '\n';
  const root = makeRepo({
    'README.md': '# Repo\n\n[big](docs/big.md)\n',
    'docs/big.md': big,
  });
  const violation = run(root).violations.find((f) => f.kind === 'size');
  assert.equal(violation.bytes, Buffer.byteLength(big, 'utf8'));
  assert.equal(violation.limit, 7000);

  writeFileSync(
    join(root, 'document-size-exceptions.json'),
    JSON.stringify([{ path: 'docs/big.md', reason: 'test' }]),
  );
  assert.ok(!run(root).violations.some((f) => f.kind === 'size'));
  rmSync(root, { recursive: true, force: true });
});

test('flags stale sizeExceptions entries', () => {
  const root = makeRepo({
    'README.md': '# Repo\n\n[small](docs/small.md)\n',
    'docs/small.md': '# Small\n',
    'document-size-exceptions.json': JSON.stringify([{ path: 'docs/small.md', reason: 'stale' }]),
  });
  assert.ok(run(root).violations.some((f) => f.kind === 'stale-size-exception'));
  rmSync(root, { recursive: true, force: true });
});

test('reports invalid config values without a stack trace', () => {
  const root = makeRepo({
    'README.md': '# Repo\n',
    'verify-docs.config.json': JSON.stringify({ unexpected: true }),
  });
  const output = runError(root);
  assert.match(output, /設定エラー: 未対応の設定キー: unexpected/);
  assert.doesNotMatch(output, /at .*verify-docs\.mjs/);
  rmSync(root, { recursive: true, force: true });

  const wrongType = makeRepo({
    'README.md': '# Repo\n',
    'verify-docs.config.json': JSON.stringify({ maxDocBytes: '7000' }),
  });
  assert.match(runError(wrongType), /maxDocBytes は正の整数/);
  rmSync(wrongType, { recursive: true, force: true });

  const malformed = makeRepo({
    'README.md': '# Repo\n',
    'verify-docs.config.json': '{ not valid json',
  });
  assert.match(runError(malformed), /設定エラー: verify-docs.config.json を読み込めない/);
  rmSync(malformed, { recursive: true, force: true });
});

test('accepts safe and auto maintenance modes and rejects invalid mode settings', () => {
  const root = makeRepo({
    'README.md': '# Repo\n',
    'verify-docs.config.json': JSON.stringify({
      tighten: { mode: 'auto' },
      dedupe: { mode: 'safe' },
    }),
  });
  assert.deepEqual(run(root).violations, []);
  rmSync(root, { recursive: true, force: true });

  const invalidMode = makeRepo({
    'README.md': '# Repo\n',
    'verify-docs.config.json': JSON.stringify({ tighten: { mode: 'fast' } }),
  });
  assert.match(runError(invalidMode), /tighten\.mode は safe または auto/);
  rmSync(invalidMode, { recursive: true, force: true });

  const invalidNestedKey = makeRepo({
    'README.md': '# Repo\n',
    'verify-docs.config.json': JSON.stringify({ dedupe: { mode: 'auto', delete: true } }),
  });
  assert.match(runError(invalidNestedKey), /dedupe には mode だけを指定できます/);
  rmSync(invalidNestedKey, { recursive: true, force: true });
});

test('validates document-size-exception fields and duplicate paths', () => {
  const root = makeRepo({
    'README.md': '# Repo\n',
    'document-size-exceptions.json': JSON.stringify([
      { path: 'docs/large.md', reason: 'legacy' },
      { path: 'docs/large.md', reason: 'duplicate' },
    ]),
  });
  assert.match(runError(root), /重複した path/);
  rmSync(root, { recursive: true, force: true });

  const invalid = makeRepo({
    'README.md': '# Repo\n',
    'document-size-exceptions.json': JSON.stringify([{ path: '../outside.md', reason: 'unsafe' }]),
  });
  assert.match(runError(invalid), /相対パス/);
  rmSync(invalid, { recursive: true, force: true });

  const missingReason = makeRepo({
    'README.md': '# Repo\n',
    'document-size-exceptions.json': JSON.stringify([{ path: 'docs/large.md' }]),
  });
  assert.match(runError(missingReason), /reason は空でない文字列/);
  rmSync(missingReason, { recursive: true, force: true });
});

test('detects duplicate paragraphs across docs', () => {
  const shared =
    'This paragraph is intentionally long enough to trigger duplicate detection logic here.';
  const root = makeRepo({
    'README.md': '# Repo\n\n[a](docs/a.md)\n[b](docs/b.md)\n',
    'docs/a.md': `# A\n\n${shared}\n`,
    'docs/b.md': `# B\n\n${shared}\n`,
  });
  const violation = run(root).violations.find((f) => f.kind === 'duplicate');
  assert.deepEqual(violation.location.headingPath, ['A']);
  assert.equal(violation.location.start.line, 3);
  assert.deepEqual(
    violation.occurrences.map(({ location }) => location.path).sort(),
    ['docs/a.md', 'docs/b.md'],
  );
  rmSync(root, { recursive: true, force: true });
});

test('identical skill reference copies are compared once, diverged copies are reported', () => {
  const shared =
    'This paragraph is intentionally long enough to trigger duplicate detection logic here.';
  const files = {
    'README.md': '# Repo\n',
    '.agents/skills/a/SKILL.md': '# A\n\n[guide](references/guide.md)\n',
    '.agents/skills/b/SKILL.md': '# B\n\n[guide](references/guide.md)\n',
    '.agents/skills/a/references/guide.md': `# Guide\n\n${shared}\n`,
    '.agents/skills/b/references/guide.md': `# Guide\n\n${shared}\n`,
  };
  const identical = makeRepo(files);
  assert.deepEqual(run(identical).violations, []);
  rmSync(identical, { recursive: true, force: true });

  const diverged = makeRepo({
    ...files,
    '.agents/skills/b/references/guide.md': `# Guide\n\n${shared}\n\nEdited only in b.\n`,
  });
  assert.ok(run(diverged).violations.some((f) => f.kind === 'duplicate'));
  rmSync(diverged, { recursive: true, force: true });

  const elsewhere = makeRepo({ ...files, 'docs/copy.md': `# Copy\n\n${shared}\n`, 'README.md': '# Repo\n\n[copy](docs/copy.md)\n' });
  const violation = run(elsewhere).violations.find((f) => f.kind === 'duplicate');
  assert.deepEqual(
    violation.occurrences.map(({ location }) => location.path).sort(),
    ['.agents/skills/a/references/guide.md', 'docs/copy.md'],
  );
  rmSync(elsewhere, { recursive: true, force: true });
});

test('AST duplicate comparison ignores inline emphasis differences', () => {
  const root = makeRepo({
    'README.md': '# Repo\n\n[a](docs/a.md)\n[b](docs/b.md)\n',
    'docs/a.md': '# A\n\nThis sentence contains **important wording** that should count as the same prose.\n',
    'docs/b.md': '# B\n\nThis sentence contains important wording that should count as the same prose.\n',
    'verify-docs.config.json': JSON.stringify({ minDuplicateChars: 10 }),
  });
  assert.ok(run(root).violations.some((f) => f.kind === 'duplicate'));
  rmSync(root, { recursive: true, force: true });
});

test('AST duplicate comparison distinguishes link destinations and code spans', () => {
  const root = makeRepo({
    'README.md': '# Repo\n\n[a](docs/a.md)\n[b](docs/b.md)\n',
    'docs/a.md': '# A\n\nThis sentence has a [long linked phrase with matching text](https://one.example/path) and enough prose.\n\nThis sentence keeps `code literal` distinct from plain prose in a paragraph.\n',
    'docs/b.md': '# B\n\nThis sentence has a [long linked phrase with matching text](https://two.example/path) and enough prose.\n\nThis sentence keeps code literal distinct from plain prose in a paragraph.\n',
    'verify-docs.config.json': JSON.stringify({ minDuplicateChars: 10, checkNearDuplicates: true }),
  });
  const violations = run(root).violations;
  assert.ok(!violations.some((f) => f.kind === 'duplicate'));
  assert.ok(!violations.some((f) => f.kind === 'near-duplicate'));
  rmSync(root, { recursive: true, force: true });
});

test('AST duplicate comparison finds prose in list and blockquote paragraphs', () => {
  const shared = 'This paragraph is long enough to identify the same content across block containers.';
  const root = makeRepo({
    'README.md': '# Repo\n\n[a](docs/a.md)\n[b](docs/b.md)\n',
    'docs/a.md': `# A\n\n- ${shared}\n`,
    'docs/b.md': `# B\n\n> ${shared}\n`,
  });
  assert.ok(run(root).violations.some((f) => f.kind === 'duplicate'));
  rmSync(root, { recursive: true, force: true });
});

test('AST duplicate extraction continues to exclude pipe-table rows and code blocks', () => {
  const row = '| This table row is long enough to pass the duplicate detection character limit | Value |';
  const code = 'This code-only paragraph should never count as prose in duplicate comparisons.';
  const root = makeRepo({
    'README.md': '# Repo\n\n[a](docs/a.md)\n[b](docs/b.md)\n',
    'docs/a.md': `# A\n\n${row}\n\n\n    ${code}\n`,
    'docs/b.md': `# B\n\n${row}\n\n\n    ${code}\n`,
  });
  assert.ok(!run(root).violations.some((f) => f.kind === 'duplicate'));
  rmSync(root, { recursive: true, force: true });
});

test('allow-duplicate marker suppresses duplicate check', () => {
  const shared =
    'This paragraph is intentionally long enough to trigger duplicate detection logic here.';
  const root = makeRepo({
    'README.md': '# Repo\n\n[a](docs/a.md)\n[b](docs/b.md)\n',
    'docs/a.md': `# A\n\n${shared}\n`,
    'docs/b.md': `# B\n\n<!-- verify-docs:allow-duplicate -->\n\n${shared}\n`,
  });
  assert.ok(!run(root).violations.some((f) => f.kind === 'duplicate'));
  rmSync(root, { recursive: true, force: true });
});

test('near-duplicate check is opt-in and off by default', () => {
  const root = makeRepo({
    'README.md': '# Repo\n\n[a](docs/a.md)\n[b](docs/b.md)\n',
    'docs/a.md': '# A\n\nこのツールは文書の構造を検査します。参照切れとサイズ超過を見ます。\n',
    'docs/b.md': '# B\n\nこのツールは文書の構造を検査する。参照切れとサイズ超過を見る。\n',
  });
  assert.ok(!run(root).violations.some((f) => f.kind === 'near-duplicate'));
  rmSync(root, { recursive: true, force: true });
});

test('near-duplicate check catches punctuation and register (敬体/常体) variants when enabled', () => {
  const root = makeRepo({
    'README.md': '# Repo\n\n[a](docs/a.md)\n[b](docs/b.md)\n',
    'docs/a.md': '# A\n\nこのツールは文書の構造を検査します。参照切れとサイズ超過を見ます。\n',
    'docs/b.md': '# B\n\nこのツールは文書の構造を検査する。参照切れとサイズ超過を見る。\n',
    'verify-docs.config.json': JSON.stringify({ checkNearDuplicates: true, minDuplicateChars: 10 }),
  });
  assert.ok(run(root).violations.some((f) => f.kind === 'near-duplicate'));
  rmSync(root, { recursive: true, force: true });
});

test('near-duplicate check does not double-report exact duplicates', () => {
  const shared =
    'This paragraph is intentionally long enough to trigger duplicate detection logic here.';
  const root = makeRepo({
    'README.md': '# Repo\n\n[a](docs/a.md)\n[b](docs/b.md)\n',
    'docs/a.md': `# A\n\n${shared}\n`,
    'docs/b.md': `# B\n\n${shared}\n`,
    'verify-docs.config.json': JSON.stringify({ checkNearDuplicates: true }),
  });
  const violations = run(root).violations;
  assert.ok(violations.some((f) => f.kind === 'duplicate'));
  assert.ok(!violations.some((f) => f.kind === 'near-duplicate'));
  rmSync(root, { recursive: true, force: true });
});

test('near-duplicate check respects allow-duplicate marker', () => {
  const root = makeRepo({
    'README.md': '# Repo\n\n[a](docs/a.md)\n[b](docs/b.md)\n',
    'docs/a.md': '# A\n\nこのツールは文書の構造を検査します。参照切れとサイズ超過を見ます。\n',
    'docs/b.md':
      '# B\n\n<!-- verify-docs:allow-duplicate -->\n\nこのツールは文書の構造を検査する。参照切れとサイズ超過を見る。\n',
    'verify-docs.config.json': JSON.stringify({ checkNearDuplicates: true, minDuplicateChars: 10 }),
  });
  assert.ok(!run(root).violations.some((f) => f.kind === 'near-duplicate'));
  rmSync(root, { recursive: true, force: true });
});

test('every DEFAULTS key is documented in config.md (prevents doc drift when a key is added)', () => {
  const script = readFileSync(SCRIPT, 'utf8');
  const defaultsBlock = script.match(/const DEFAULTS = \{([\s\S]*?)\n\};/)[1];
  const keys = [...defaultsBlock.matchAll(/^\s*(\w+):/gm)].map((m) => m[1]);
  assert.ok(keys.length > 0, 'failed to extract DEFAULTS keys from document-structure-verifier.mjs');

  const configMd = readFileSync(
    join(import.meta.dirname, '../docs/config.md'),
    'utf8',
  );
  for (const key of keys) {
    assert.ok(configMd.includes(`\`${key}\``), `config.md is missing documentation for "${key}"`);
  }
});

test('--init-size-exceptions writes sizeExceptions file for oversized docs and refuses to overwrite', () => {
  const big = '# Big\n\n## Split here\n\n' + 'x'.repeat(40000) + '\n';
  const root = makeRepo({
    'README.md': '# Repo\n\n[big](docs/big.md)\n',
    'docs/big.md': big,
  });
  verifyDocumentStructure(root, { initSizeExceptions: true });
  const written = JSON.parse(readFileSync(join(root, 'document-size-exceptions.json'), 'utf8'));
  assert.equal(written.length, 1);
  assert.equal(written[0].path, 'docs/big.md');
  assert.deepEqual(written[0].section.headingPath, ['Big', 'Split here']);
  assert.equal(written[0].section.startLine, 3);
  assert.ok(written[0].section.bytes > 40000);

  assert.throws(() =>
    verifyDocumentStructure(root, { initSizeExceptions: true }),
  );
  rmSync(root, { recursive: true, force: true });
});

test('changed-base reports only violations related to changed paths', () => {
  const root = makeRepo({
    'README.md': '# Repo\n\n[legacy](docs/legacy-missing.md)\n[current](docs/current.md)\n',
    'docs/current.md': '# Current\n',
  });
  execFileSync('git', ['init', '-q', root]);
  execFileSync('git', ['-C', root, 'add', '.']);
  execFileSync('git', ['-C', root, '-c', 'commit.gpgsign=false', '-c', 'user.name=test', '-c', 'user.email=test@example.com', 'commit', '-qm', 'initial']);
  writeFileSync(join(root, 'docs/current.md'), '# Current\n\n[missing](new-missing.md)\n');
  execFileSync('git', ['-C', root, 'add', '.']);
  execFileSync('git', ['-C', root, '-c', 'commit.gpgsign=false', '-c', 'user.name=test', '-c', 'user.email=test@example.com', 'commit', '-qm', 'change']);

  const result = verifyDocumentStructure(root, { changedBase: 'HEAD~1' });
  assert.deepEqual(result.changed.paths, ['docs/current.md']);
    assert.equal(result.kind, 'DocumentStructureVerificationReport');
    assert.equal(result.violations.length, 1);
  assert.equal(result.violations[0].from, 'docs/current.md');
  assert.equal(result.violations[0].kind, 'link');
  rmSync(root, { recursive: true, force: true });
});

test('changed-base reports unchanged links to a renamed document', () => {
  const root = makeRepo({
    'README.md': '# Repo\n\n[guide](docs/guide.md)\n',
    'docs/guide.md': '# Guide\n',
  });
  execFileSync('git', ['init', '-q', root]);
  execFileSync('git', ['-C', root, 'add', '.']);
  execFileSync('git', ['-C', root, '-c', 'commit.gpgsign=false', '-c', 'user.name=test', '-c', 'user.email=test@example.com', 'commit', '-qm', 'initial']);
  execFileSync('git', ['-C', root, 'mv', 'docs/guide.md', 'docs/getting-started.md']);
  execFileSync('git', ['-C', root, '-c', 'commit.gpgsign=false', '-c', 'user.name=test', '-c', 'user.email=test@example.com', 'commit', '-am', 'rename']);

  const result = verifyDocumentStructure(root, { changedBase: 'HEAD~1' });
  assert.deepEqual(result.changed.paths, ['docs/getting-started.md', 'docs/guide.md']);
  assert.deepEqual(result.changed.renames, [{ from: 'docs/guide.md', to: 'docs/getting-started.md' }]);
  const linkViolation = result.violations.find((violation) => violation.kind === 'link');
  assert.equal(linkViolation.from, 'README.md');
  assert.equal(linkViolation.target, 'docs/guide.md');
  assert.ok(result.violations.some((violation) =>
    violation.kind === 'orphan' && violation.from === 'docs/getting-started.md',
  ));
  rmSync(root, { recursive: true, force: true });
});

test('CLI prints JSON and preserves the violation exit code', () => {
  const root = makeRepo({ 'README.md': '# Repo\n\n[missing](docs/missing.md)\n' });
  try {
    execFileSync('node', [SCRIPT, `--root=${root}`, '--json'], { encoding: 'utf8', stdio: 'pipe' });
    assert.fail('expected CLI to report the broken link');
  } catch (error) {
    assert.equal(error.status, 1);
    const report = JSON.parse(error.stdout);
    assert.equal(report.violations[0].kind, 'link');
  }
  rmSync(root, { recursive: true, force: true });
});
