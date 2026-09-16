import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { evaluateAutonomousOutput } from './evaluate-autonomous-output.mjs';

test('scores canonicalization, preservation, compression, and scope from a fixed oracle', () => {
  const baseline = mkdtempSync(join(tmpdir(), 'auto-eval-before-'));
  const output = mkdtempSync(join(tmpdir(), 'auto-eval-after-'));
  try {
    for (const root of [baseline, output]) mkdirSync(join(root, 'docs'));
    writeFileSync(join(baseline, 'README.md'), '# Home\n\n[old](docs/old.md)\n');
    writeFileSync(join(baseline, 'docs/new.md'), '# New\n\nKeep 30 seconds.\n');
    writeFileSync(join(baseline, 'docs/old.md'), '# Old\n\nKeep 30 seconds.\n');
    writeFileSync(join(output, 'README.md'), '# Home\n\n[new](docs/new.md)\n');
    writeFileSync(join(output, 'docs/new.md'), '# New\n\nKeep 30 seconds.\n');
    const result = evaluateAutonomousOutput({ baseline, output, manifest: { canonicalizations: [{ canonicalPath: 'docs/new.md', removedPath: 'docs/old.md' }], protectedFacts: ['30 seconds'], allowedChanges: ['README.md', 'docs/old.md'] } });
    assert.equal(result.canonicalization.precision, 1);
    assert.equal(result.canonicalization.recall, 1);
    assert.deepEqual(result.facts.missing, []);
    assert.equal(result.unexpectedChanges.length, 0);
    assert.ok(result.compression.reductionBytes > 0);
  } finally { rmSync(baseline, { recursive: true, force: true }); rmSync(output, { recursive: true, force: true }); }
});
