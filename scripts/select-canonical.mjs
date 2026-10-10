#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import { basename, resolve } from 'node:path';

const ROLES = new Set(['entry', 'detail']);

function validateCandidate(candidate, label) {
  if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) {
    throw new Error(`${label} must be an object`);
  }
  if (typeof candidate.id !== 'string' || candidate.id === '') throw new Error(`${label}.id must be a non-empty string`);
  if (typeof candidate.path !== 'string' || candidate.path === '') throw new Error(`${label}.path must be a non-empty string`);
  if (!ROLES.has(candidate.role)) throw new Error(`${label}.role must be entry or detail`);
  if (candidate.explicitCanonical !== undefined && typeof candidate.explicitCanonical !== 'boolean') {
    throw new Error(`${label}.explicitCanonical must be boolean`);
  }
  if (!candidate.facts || typeof candidate.facts !== 'object' || Array.isArray(candidate.facts)) {
    throw new Error(`${label}.facts must be an object`);
  }
  for (const [key, value] of Object.entries(candidate.facts)) {
    if (key === '' || typeof value !== 'string' || value === '') {
      throw new Error(`${label}.facts must contain non-empty string keys and values`);
    }
  }
}

function comparedFacts(left, right) {
  const leftOnly = [];
  const rightOnly = [];
  const conflicts = [];
  for (const [key, value] of Object.entries(left.facts)) {
    if (!(key in right.facts)) leftOnly.push(key);
    else if (right.facts[key] !== value) conflicts.push(key);
  }
  for (const key of Object.keys(right.facts)) {
    if (!(key in left.facts)) rightOnly.push(key);
  }
  return { leftOnly: leftOnly.sort(), rightOnly: rightOnly.sort(), conflicts: conflicts.sort() };
}

function canBeCanonical(candidate, otherOnly, conflicts, other) {
  if (conflicts.length > 0 || otherOnly.length > 0) return false;
  if (candidate.explicitCanonical) return !other.explicitCanonical;
  return candidate.role === 'detail' && other.role === 'entry';
}

/**
 * Selects a canonical document only when it contains every fact from the other
 * candidate and has explicit authority or the detail role. It never resolves
 * conflicting facts or cases where both candidates contain unique facts.
 */
export function selectCanonical(left, right) {
  validateCandidate(left, 'left');
  validateCandidate(right, 'right');
  if (left.id === right.id) throw new Error('left.id and right.id must differ');
  const evidence = comparedFacts(left, right);

  if (evidence.conflicts.length > 0) {
    return { decision: 'conflict', evidence };
  }
  const leftWins = canBeCanonical(left, evidence.rightOnly, evidence.conflicts, right);
  const rightWins = canBeCanonical(right, evidence.leftOnly, evidence.conflicts, left);
  if (leftWins === rightWins) {
    return { decision: 'decision-required', evidence };
  }
  const canonical = leftWins ? left : right;
  const pointer = leftWins ? right : left;
  return {
    decision: 'auto-canonical',
    canonical: { id: canonical.id, path: canonical.path },
    pointer: { id: pointer.id, path: pointer.path },
    evidence,
  };
}

function main() {
  const inputPath = process.argv[2];
  if (inputPath === '--help' || inputPath === '-h') {
    console.log('Usage: node scripts/select-canonical.mjs <candidate-pair.json>');
    return 0;
  }
  if (!inputPath || process.argv.length !== 3) {
    console.error('Usage: node scripts/select-canonical.mjs <candidate-pair.json>');
    return 2;
  }
  try {
    const input = JSON.parse(readFileSync(resolve(inputPath), 'utf8'));
    console.log(JSON.stringify(selectCanonical(input.left, input.right), null, 2));
    return 0;
  } catch (error) {
    console.error(`Canonical selection failed: ${error.message}`);
    return 2;
  }
}

if (process.argv[1] && basename(process.argv[1]) === 'select-canonical.mjs') {
  process.exitCode = main();
}
