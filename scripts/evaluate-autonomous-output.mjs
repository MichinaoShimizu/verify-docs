#!/usr/bin/env node

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

function files(root, directory = '') {
  const current = join(root, directory);
  return readdirSync(current, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return files(root, path);
    return entry.name.endsWith('.md') ? [path] : [];
  });
}

function text(root, path) {
  const full = join(root, path);
  return existsSync(full) ? readFileSync(full, 'utf8') : '';
}

function bytes(root, paths) {
  return paths.reduce((total, path) => total + Buffer.byteLength(text(root, path), 'utf8'), 0);
}

function ratio(numerator, denominator) {
  return denominator === 0 ? null : numerator / denominator;
}

export function evaluateAutonomousOutput({ baseline, output, manifest }) {
  const baselineFiles = files(baseline);
  const outputFiles = files(output);
  const changed = new Set([...baselineFiles, ...outputFiles].filter((path) => text(baseline, path) !== text(output, path)));
  const expected = manifest.canonicalizations ?? [];
  const removedFiles = baselineFiles.filter((path) => !outputFiles.includes(path));
  const canonical = expected.map(({ canonicalPath, removedPath }) => ({
    canonicalPath,
    removedPath,
    correct: existsSync(join(output, canonicalPath)) && !existsSync(join(output, removedPath)),
  }));
  const facts = [...(manifest.requiredFacts ?? []), ...(manifest.protectedFacts ?? [])].map((value) => ({
    value,
    preserved: outputFiles.some((path) => text(output, path).includes(value)),
  }));
  const allowed = new Set(manifest.allowedChanges ?? baselineFiles);
  const unexpectedChanges = [...changed].filter((path) => !allowed.has(path));
  const correct = canonical.filter((entry) => entry.correct).length;
  const expectedRemovals = new Set(expected.map((entry) => entry.removedPath));
  const falsePositiveRemovals = removedFiles.filter((path) => !expectedRemovals.has(path));
  const performed = correct + falsePositiveRemovals.length;
  return {
    kind: 'AutonomousMaintenanceEvaluation',
    documents: { before: baselineFiles.length, after: outputFiles.length },
    canonicalization: { expected: expected.length, performed, correct, precision: ratio(correct, performed), recall: ratio(correct, expected.length), falsePositiveRemovals, details: canonical },
    facts: { required: manifest.requiredFacts?.length ?? 0, protected: manifest.protectedFacts?.length ?? 0, preserved: facts.filter((entry) => entry.preserved).length, total: facts.length, missing: facts.filter((entry) => !entry.preserved).map((entry) => entry.value) },
    compression: { beforeBytes: bytes(baseline, baselineFiles), afterBytes: bytes(output, outputFiles), reductionBytes: bytes(baseline, baselineFiles) - bytes(output, outputFiles), reductionRate: ratio(bytes(baseline, baselineFiles) - bytes(output, outputFiles), bytes(baseline, baselineFiles)) },
    changedPaths: [...changed].sort(),
    unexpectedChanges,
  };
}

function option(name) {
  const value = process.argv.find((arg) => arg.startsWith(`--${name}=`));
  if (!value) throw new Error(`--${name}=PATH is required`);
  return resolve(value.slice(name.length + 3));
}

if (process.argv[1] && resolve(process.argv[1]) === new URL(import.meta.url).pathname) {
  const baseline = option('baseline');
  const output = option('output');
  const manifest = JSON.parse(readFileSync(option('manifest'), 'utf8'));
  console.log(JSON.stringify(evaluateAutonomousOutput({ baseline, output, manifest }), null, 2));
}
