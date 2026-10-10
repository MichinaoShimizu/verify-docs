import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { findMissingContent } from './check-preserved-content.mjs';

const SCRIPT = new URL('./check-preserved-content.mjs', import.meta.url).pathname;

test('reports code blocks, code spans and URLs that disappeared from every document', () => {
  const before = [{
    path: 'docs/cli.md',
    source: '# CLI\n\nUse `--cache` with [docs](https://example.com/cache).\n\n```bash\nprettier --check .\n```\n\n```json\n{ "a": 1 }\n```\n',
  }];
  const after = [
    { path: 'docs/cli.md', source: '# CLI\n\nUse `--cache`.\n\n```json\n{ "a": 1,\n  "b": 2 }\n```\n' },
    { path: 'docs/other.md', source: '# Other\n\n```sh\nprettier --check .\n```\n' },
  ];
  const { counts, missing } = findMissingContent(before, after);
  assert.deepEqual(counts, { codeBlock: 2, codeSpan: 1, url: 1 });
  assert.deepEqual(missing.map(({ kind, line, value }) => [kind, line, value]), [
    ['url', 3, 'https://example.com/cache'],
    ['codeBlock', 9, '{ "a": 1 }'],
  ]);
});

test('per-file mode reports values whose count dropped in a document that still exists', () => {
  const before = [
    { path: 'docs/a.md', source: '# A\n\nUse `--cache` here and `--cache` there.\n' },
    { path: 'docs/b.md', source: '# B\n\nAlso `--cache`.\n' },
    { path: 'docs/old.md', source: '# Old\n\nRun `npm test`.\n' },
  ];
  const after = [
    { path: 'docs/a.md', source: '# A\n\nUse `--cache` here.\n' },
    { path: 'docs/b.md', source: '# B\n\nAlso `--cache`.\n' },
    { path: 'docs/new.md', source: '# New\n\nRun `npm test`.\n' },
  ];
  assert.deepEqual(findMissingContent(before, after).missing, []);
  const { counts, missing } = findMissingContent(before, after, { perFile: true });
  assert.deepEqual(counts, { codeBlock: 0, codeSpan: 4, url: 0 });
  assert.deepEqual(missing.map(({ path, value }) => [path, value]), [['docs/a.md', '--cache']]);
});

test('compares the working tree with a git revision and exits 1 when content is missing', () => {
  const root = mkdtempSync(join(tmpdir(), 'preserved-content-'));
  try {
    const git = (...args) => execFileSync('git', ['-C', root, ...args], { stdio: 'pipe' });
    git('init', '-q');
    writeFileSync(join(root, 'README.md'), '# Repo\n\nRun `npm test` and `npm run lint`.\n');
    git('add', '.');
    git('-c', 'user.name=t', '-c', 'user.email=t@example.com', 'commit', '-qm', 'init');
    writeFileSync(join(root, 'README.md'), '# Repo\n\nRun `npm test`.\n');
    const result = spawnSync('node', [SCRIPT, '--base=HEAD', `--root=${root}`], { encoding: 'utf8' });
    assert.equal(result.status, 1);
    assert.match(result.stdout, /\[コードスパン\] README\.md:3 — npm run lint/);
    writeFileSync(join(root, 'README.md'), '# Repo\n\nRun `npm test` and `npm run lint` first.\n');
    const kept = spawnSync('node', [SCRIPT, '--base=HEAD', `--root=${root}`], { encoding: 'utf8' });
    assert.equal(kept.status, 0);
    assert.match(kept.stdout, /保護内容: すべて残っている/);
    assert.equal(spawnSync('node', [SCRIPT, `--root=${root}`], { encoding: 'utf8' }).status, 2);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('also checks extensions added in verify-docs.config.json', () => {
  const root = mkdtempSync(join(tmpdir(), 'preserved-content-'));
  try {
    const git = (...args) => execFileSync('git', ['-C', root, ...args], { stdio: 'pipe' });
    git('init', '-q');
    writeFileSync(join(root, 'verify-docs.config.json'), JSON.stringify({ extensions: ['.md', '.markdown'] }));
    writeFileSync(join(root, 'guide.markdown'), '# Guide\n\nRun `npm run build`.\n');
    git('add', '.');
    git('-c', 'user.name=t', '-c', 'user.email=t@example.com', 'commit', '-qm', 'init');
    writeFileSync(join(root, 'guide.markdown'), '# Guide\n\nBuild it.\n');
    const result = spawnSync('node', [SCRIPT, '--base=HEAD', `--root=${root}`], { encoding: 'utf8' });
    assert.equal(result.status, 1);
    assert.match(result.stdout, /\[コードスパン\] guide\.markdown:3 — npm run build/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
