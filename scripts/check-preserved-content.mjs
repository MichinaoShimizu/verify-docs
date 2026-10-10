#!/usr/bin/env node

/* 自律圧縮・自律正本化の後に、基準コミットの文書にあったコードブロック・コードスパン・URL が
 * 作業後の文書群のどこかに残っているかを照合する。文章の言い換えは判定しない。消えた内容を
 * 機械的に洗い出し、復元するか意図した削除として記録するかをエージェントに判断させるためである。 */

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseMarkdown } from './markdown-structure.mjs';

const USAGE = [
  'Usage: node scripts/check-preserved-content.mjs --base=<git-rev> [--root=<dir>] [--json] [<file.md>...]',
  'List code blocks, code spans and URLs in the Markdown at <git-rev> that no longer appear in any Markdown in the working tree.',
  'Pass files to limit the check to those documents at <git-rev> (for example, the documents you edited).',
  'Exits 1 when something is missing: restore it, or record why it was removed on purpose.',
].join('\n');

const KINDS = { codeBlock: 'コードブロック', codeSpan: 'コードスパン', url: 'URL' };
const URL_PATTERN = /https?:\/\/[^\s<>()[\]"'`]+/g;

const normalizeBlock = (text) => text.split(/\r?\n/).map((line) => line.trimEnd()).join('\n').trim();
const isMarkdown = (path) => path.toLowerCase().endsWith('.md') && !/(^|\/)(node_modules|\.git|\.verify-docs)\//.test(path);

/** 文書から照合対象（コードブロック・コードスパン・URL）を出現行つきで取り出す。 */
export function extractPreservedContent(source) {
  const items = [];
  const walker = parseMarkdown(source).walker();
  for (let event = walker.next(); event; event = walker.next()) {
    const { node, entering } = event;
    if (!entering) continue;
    const line = node.sourcepos?.[0]?.[0] ?? node.parent?.sourcepos?.[0]?.[0] ?? 0;
    if (node.type === 'code_block') {
      const value = normalizeBlock(node.literal ?? '');
      if (value) items.push({ kind: 'codeBlock', value, line });
    } else if (node.type === 'code') {
      const value = (node.literal ?? '').trim();
      if (value) items.push({ kind: 'codeSpan', value, line });
    } else if ((node.type === 'link' || node.type === 'image') && /^https?:\/\//.test(node.destination ?? '')) {
      items.push({ kind: 'url', value: node.destination, line });
    } else if (node.type === 'text' || node.type === 'html_block' || node.type === 'html_inline') {
      for (const [url] of (node.literal ?? '').matchAll(URL_PATTERN)) items.push({ kind: 'url', value: url.replace(/[.,;:]+$/, ''), line });
    }
  }
  return items;
}

/** 基準側の各項目が、作業後の文書群のどこかに残っているかを照合する。 */
export function findMissingContent(before, after) {
  const remaining = { codeBlock: [], codeSpan: new Set(), url: new Set() };
  for (const { source } of after) {
    for (const { kind, value } of extractPreservedContent(source)) {
      if (kind === 'codeBlock') remaining.codeBlock.push(value);
      else remaining[kind].add(value);
    }
  }
  const counts = { codeBlock: 0, codeSpan: 0, url: 0 };
  const missing = [];
  const reported = new Set();
  for (const { path, source } of before) {
    for (const { kind, value, line } of extractPreservedContent(source)) {
      counts[kind] += 1;
      // コードブロックは、より大きなブロックへ統合された場合も残っているとみなす。
      const kept = kind === 'codeBlock' ? remaining.codeBlock.some((block) => block.includes(value)) : remaining[kind].has(value);
      const identity = JSON.stringify([kind, value]);
      if (kept || reported.has(identity)) continue;
      reported.add(identity);
      missing.push({ kind, path, line, value });
    }
  }
  return { counts, missing };
}

function git(root, args) {
  return execFileSync('git', ['-C', root, ...args], { maxBuffer: 1 << 28 }).toString('utf8');
}

if (process.argv[1] && resolve(process.argv[1]) === new URL(import.meta.url).pathname) {
  const args = process.argv.slice(2);
  if (args.includes('--help') || args.includes('-h')) {
    console.log(USAGE);
    process.exit(0);
  }
  const unknown = args.filter((arg) => arg.startsWith('-') && !/^--(base|root)=/.test(arg) && arg !== '--json');
  const base = args.find((arg) => arg.startsWith('--base='))?.slice('--base='.length);
  if (unknown.length || !base) {
    console.error(`${unknown.length ? `不明な引数: ${unknown.join(' ')}` : '--base=<git-rev> を指定してください'}\n${USAGE}`);
    process.exit(2);
  }
  const root = resolve(args.find((arg) => arg.startsWith('--root='))?.slice('--root='.length) ?? '.');
  const only = new Set(args.filter((arg) => !arg.startsWith('-')));

  let before;
  let after;
  try {
    const basePaths = git(root, ['ls-tree', '-r', '-z', '--name-only', base]).split('\0').filter(isMarkdown);
    before = basePaths
      .filter((path) => only.size === 0 || only.has(path))
      .map((path) => ({ path, source: git(root, ['show', `${base}:${path}`]) }));
    after = git(root, ['ls-files', '-z', '--cached', '--others', '--exclude-standard'])
      .split('\0')
      .filter((path) => isMarkdown(path) && existsSync(resolve(root, path)))
      .map((path) => ({ path, source: readFileSync(resolve(root, path), 'utf8') }));
  } catch (error) {
    console.error(`git から文書を読めません: ${error.message.split('\n')[0]}`);
    process.exit(2);
  }

  const { counts, missing } = findMissingContent(before, after);
  if (args.includes('--json')) {
    console.log(JSON.stringify({ kind: 'PreservedContentReport', base, documents: before.length, counts, missing }, null, 2));
  } else {
    console.log(
      `保護内容の照合: 基準 ${base} の文書 ${before.length} 件から` +
        `${KINDS.codeBlock} ${counts.codeBlock}・${KINDS.codeSpan} ${counts.codeSpan}・${KINDS.url} ${counts.url} 件を照合`,
    );
    for (const { kind, path, line, value } of missing) {
      const excerpt = value.replace(/\s+/g, ' ');
      console.log(`  [${KINDS[kind]}] ${path}:${line} — ${excerpt.length > 80 ? `${excerpt.slice(0, 80)}…` : excerpt}`);
    }
    console.log(
      missing.length
        ? `消えた内容 ${missing.length} 件。復元するか、意図した削除なら作業記録に理由を書く`
        : '保護内容: すべて残っている',
    );
  }
  process.exit(missing.length ? 1 : 0);
}
