import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { extractProseBlocks } from './markdown-structure.mjs';

const SCRIPT = join(import.meta.dirname, 'document-structure-extractor.mjs');

function withTempRepo(run) {
  const root = mkdtempSync(join(tmpdir(), 'document-structure-extractor-'));
  try {
    run(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

test('extracts CommonMark prose with heading context, source positions, and raw byte counts', () => {
  const source = '---\nname: sample\n---\n\n# はじめに\n\n説明 **重要** と `code`。\n\n## 詳細\n\n> 引用文\n\n- 箇条書き\n\n```md\nコード内の段落\n```\n';
  const result = extractProseBlocks(source);

  assert.deepEqual(result.headings.map(({ level, text }) => ({ level, text })), [
    { level: 1, text: 'はじめに' },
    { level: 2, text: '詳細' },
  ]);
  assert.deepEqual(result.headings[1].headingPath, ['はじめに', '詳細']);
  assert.equal(result.headings[1].endLine, 18);
  const firstHeadingOffset = source.indexOf('# はじめに');
  const secondHeadingOffset = source.indexOf('## 詳細');
  assert.equal(result.headings[0].bytes, Buffer.byteLength(source.slice(firstHeadingOffset), 'utf8'));
  assert.equal(result.headings[1].bytes, Buffer.byteLength(source.slice(secondHeadingOffset), 'utf8'));
  assert.deepEqual(result.headings.map(({ paragraphCount }) => paragraphCount), [3, 2]);
  assert.deepEqual(result.blocks.map(({ headingPath, text }) => ({ headingPath, text })), [
    { headingPath: ['はじめに'], text: '説明 重要 と code。' },
    { headingPath: ['はじめに', '詳細'], text: '引用文' },
    { headingPath: ['はじめに', '詳細'], text: '箇条書き' },
  ]);
  assert.deepEqual(result.blocks.map(({ sourcepos }) => sourcepos.start.line), [7, 11, 13]);
  for (const block of result.blocks) {
    assert.equal(block.bytes, Buffer.byteLength(block.source, 'utf8'));
  }
  assert.ok(result.blocks.every(({ text }) => !text.includes('コード内')));
  assert.equal(result.bytes, Buffer.byteLength(source, 'utf8'));
});

test('CLI returns multiple requested documents as JSON with repository-relative paths', () => {
  withTempRepo((root) => {
    mkdirSync(join(root, 'docs'));
    writeFileSync(join(root, 'README.md'), '# Home\n\nWelcome.\n');
    writeFileSync(join(root, 'docs', 'guide.md'), '## Guide\n\nRead this.\n');
    const output = execFileSync('node', [SCRIPT, '--root=.', 'README.md', 'docs/guide.md'], {
      cwd: root,
      encoding: 'utf8',
    });
    const documents = JSON.parse(output);
    assert.ok(documents.every(({ kind }) => kind === 'DocumentStructureSnapshot'));
    assert.deepEqual(documents.map(({ path }) => path), ['README.md', 'docs/guide.md']);
    assert.equal(documents[1].blocks[0].headingPath.join('/'), 'Guide');
    assert.equal(documents[1].headings[0].bytes, Buffer.byteLength('## Guide\n\nRead this.\n', 'utf8'));
    assert.equal(documents[1].headings[0].paragraphCount, 1);
  });
});

test('CLI --format=tsv prints one block per line with tabs and newlines flattened', () => {
  withTempRepo((root) => {
    writeFileSync(join(root, 'README.md'), '# Home\n\n## Setup\n\nFirst line\nsecond\tline.\n');
    const output = execFileSync('node', [SCRIPT, '--root=.', '--format=tsv', 'README.md'], { cwd: root, encoding: 'utf8' });
    const [header, ...rows] = output.trimEnd().split('\n');
    assert.equal(header, 'path\tline\tbytes\theadingPath\ttext');
    assert.equal(rows.length, 1);
    const [path, line, bytes, headingPath, text] = rows[0].split('\t');
    assert.deepEqual([path, line, headingPath, text], ['README.md', '5', 'Home > Setup', 'First line second line.']);
    assert.ok(Number(bytes) > 0);
    try {
      execFileSync('node', [SCRIPT, '--format=xml', 'README.md'], { cwd: root, encoding: 'utf8', stdio: 'pipe' });
      assert.fail('expected --format=xml to be rejected');
    } catch (error) {
      assert.equal(error.status, 2);
    }
  });
});

test('CLI --format=pairs lists paraphrase candidates across documents, most similar first', () => {
  withTempRepo((root) => {
    mkdirSync(join(root, 'docs'), { recursive: true });
    writeFileSync(join(root, 'README.md'), '# Home\n\nThe installer copies the scripts and the skills into the repository and adds an ignore rule.\n');
    writeFileSync(join(root, 'docs/install.md'), '# Install\n\nThe installer copies scripts and skills into your repository and adds one ignore rule.\n\nUnrelated paragraph about configuring the maximum document size in bytes.\n');
    const output = execFileSync('node', [SCRIPT, '--root=.', '--format=pairs', 'README.md', 'docs/install.md'], { cwd: root, encoding: 'utf8' });
    const [header, ...rows] = output.trimEnd().split('\n');
    assert.equal(header, 'similarity\tcontainment\tleft\tright\tleftText\trightText');
    assert.equal(rows.length, 1);
    const [similarity, , left, right] = rows[0].split('\t');
    assert.deepEqual([left, right], ['README.md:3', 'docs/install.md:3']);
    assert.ok(Number(similarity) >= 0.3);
  });
});

test('section metrics stop at the next heading of the same or higher level', () => {
  const source = '# First\n\nFirst section.\n\n## Child\n\nChild section.\n\n# Second\n\nSecond section.\n';
  const result = extractProseBlocks(source);
  const firstOffset = source.indexOf('# First');
  const secondOffset = source.indexOf('# Second');
  const childOffset = source.indexOf('## Child');

  assert.deepEqual(result.headings.map(({ paragraphCount }) => paragraphCount), [2, 1, 1]);
  assert.equal(
    result.headings[0].bytes,
    Buffer.byteLength(source.slice(firstOffset, secondOffset), 'utf8'),
  );
  assert.equal(
    result.headings[1].bytes,
    Buffer.byteLength(source.slice(childOffset, secondOffset), 'utf8'),
  );
  assert.equal(result.headings[2].bytes, Buffer.byteLength(source.slice(secondOffset), 'utf8'));
});

test('CLI rejects paths outside the selected root', () => {
  withTempRepo((root) => {
    assert.throws(
      () => execFileSync('node', [SCRIPT, '--root=.', '../outside.md'], {
        cwd: root,
        encoding: 'utf8',
        stdio: 'pipe',
      }),
      (error) => `${error.stderr}`.includes('リポジトリ外のパス'),
    );
  });
});

test('CLI rejects missing files and non-Markdown paths', () => {
  withTempRepo((root) => {
    for (const path of ['missing.md', 'notes.txt']) {
      assert.throws(
        () => execFileSync('node', [SCRIPT, '--root=.', path], {
          cwd: root,
          encoding: 'utf8',
          stdio: 'pipe',
        }),
      );
    }
  });
});
