#!/usr/bin/env node

import { existsSync, readFileSync } from 'node:fs';
import { isAbsolute, relative, resolve } from 'node:path';
import { extractProseBlocks, findSimilarBlocks, hasMarkdownExtension, markdownExtensions } from './markdown-structure.mjs';

const args = process.argv.slice(2);
const rootOption = args.find((arg) => arg.startsWith('--root='));
const ROOT = resolve(process.cwd(), rootOption?.slice('--root='.length) ?? '.');
const formatOption = args.find((arg) => arg.startsWith('--format='));
const format = formatOption?.slice('--format='.length) ?? 'json';
const paths = args.filter((arg) => !arg.startsWith('--'));

if (args.includes('--help') || args.includes('-h')) {
  console.log('Usage: node scripts/document-structure-extractor.mjs [--root=<dir>] [--format=json|tsv|pairs] <file.md>...');
  console.log('Extract CommonMark headings and prose paragraphs as JSON with source lines and byte counts.');
  console.log('--format=tsv prints one block per line (path, line, bytes, heading path, text) for reviewing many documents.');
  console.log('--format=pairs lists paragraph pairs in different documents whose wording overlaps (candidate paraphrases), most similar first.');
  process.exit(0);
}

if (!['json', 'tsv', 'pairs'].includes(format)) {
  console.error(`--format は json・tsv・pairs のいずれかにしてください: ${format}`);
  process.exit(2);
}

if (paths.length === 0) {
  console.error('少なくとも1つのMarkdownファイルを指定してください（--help を参照）。');
  process.exit(2);
}

const documents = [];
const extensions = markdownExtensions(ROOT);
for (const path of paths) {
  const absolute = resolve(ROOT, path);
  const relativePath = relative(ROOT, absolute);
  if (relativePath === '..' || relativePath.startsWith(`..${process.platform === 'win32' ? '\\' : '/'}`) || isAbsolute(relativePath)) {
    console.error(`リポジトリ外のパスは指定できません: ${path}`);
    process.exit(2);
  }
  if (!hasMarkdownExtension(absolute, extensions)) {
    console.error(`Markdownファイルを指定してください: ${path}`);
    process.exit(2);
  }
  if (!existsSync(absolute)) {
    console.error(`ファイルがありません: ${path}`);
    process.exit(2);
  }

  const source = readFileSync(absolute, 'utf8');
  documents.push({
    kind: 'DocumentStructureSnapshot',
    path: relativePath,
    ...extractProseBlocks(source),
  });
}

const cell = (value) => String(value).replace(/[\t\r\n]+/g, ' ');

if (format === 'pairs') {
  // 文書間の言い換え候補。類似度・包含率の高い順に、両側の位置と本文の冒頭を並べる。
  const excerpt = (text) => (text.length > 120 ? `${text.slice(0, 120)}…` : text);
  console.log(['similarity', 'containment', 'left', 'right', 'leftText', 'rightText'].join('\t'));
  for (const { similarity, containment, left, right } of findSimilarBlocks(documents)) {
    console.log([
      similarity.toFixed(2),
      containment.toFixed(2),
      `${left.path}:${left.block.sourcepos.start.line}`,
      `${right.path}:${right.block.sourcepos.start.line}`,
      excerpt(left.block.text),
      excerpt(right.block.text),
    ].map(cell).join('\t'));
  }
} else if (format === 'tsv') {
  // 多数の文書を棚卸しするときの一覧。1ブロック1行で、本文中のタブと改行は空白にする。
  console.log(['path', 'line', 'bytes', 'headingPath', 'text'].join('\t'));
  for (const document of documents) {
    for (const block of document.blocks) {
      console.log([
        document.path,
        block.sourcepos.start.line,
        block.bytes,
        block.headingPath.join(' > '),
        block.text,
      ].map(cell).join('\t'));
    }
  }
} else {
  console.log(JSON.stringify(documents, null, 2));
}
