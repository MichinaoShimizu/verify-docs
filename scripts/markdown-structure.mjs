import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';

const commonmark = createRequire(import.meta.url)('./vendor/commonmark.cjs');

function maskFrontMatter(source) {
  return source.replace(/^---[ \t]*\r?\n[\s\S]*?^(?:---|\.\.\.)[ \t]*(?:\r?\n|$)/m, (block) =>
    block.replace(/[^\r\n]/g, ' '),
  );
}

/**
 * 抽出器・保護内容照合器が Markdown として扱う拡張子。.md・.mdx に加え、
 * verify-docs.config.json の extensions に足した拡張子（.markdown など）も含める。
 */
export function markdownExtensions(root) {
  const extensions = new Set(['.md', '.mdx']);
  const configPath = join(root, 'verify-docs.config.json');
  if (!existsSync(configPath)) return extensions;
  try {
    const { extensions: configured } = JSON.parse(readFileSync(configPath, 'utf8'));
    if (Array.isArray(configured)) {
      for (const extension of configured) if (typeof extension === 'string') extensions.add(extension.toLowerCase());
    }
  } catch {
    // 設定の誤りは検証器が報告する。ここでは既定の拡張子で続ける。
  }
  return extensions;
}

export function hasMarkdownExtension(path, extensions) {
  const lower = path.toLowerCase();
  return [...extensions].some((extension) => lower.endsWith(extension));
}

export function parseMarkdown(source) {
  return new commonmark.Parser().parse(maskFrontMatter(source));
}

export function markdownText(node) {
  let text = '';
  for (let child = node.firstChild; child; child = child.next) {
    if (child.type === 'text' || child.type === 'code') text += child.literal ?? '';
    else if (child.type === 'softbreak' || child.type === 'linebreak') text += ' ';
    else if (child.type !== 'html_inline' && child.firstChild) text += markdownText(child);
  }
  return text;
}

export function markdownInlineSignature(node) {
  const signature = [];
  const stack = [node];
  while (stack.length) {
    const current = stack.pop();
    if (current.type === 'code') signature.push(['code', current.literal ?? '']);
    else if (current.type === 'link' || current.type === 'image') {
      signature.push([current.type, current.destination ?? '', current.title ?? '']);
    }
    const children = [];
    for (let child = current.firstChild; child; child = child.next) children.push(child);
    stack.push(...children.reverse());
  }
  return JSON.stringify(signature);
}

export function sourcePosition(node) {
  const [[startLine, startColumn], [endLine, endColumn]] = node.sourcepos;
  return {
    start: { line: startLine, column: startColumn },
    end: { line: endLine, column: endColumn },
  };
}

export function extractProseBlocks(
  source,
  { includeSignatures = false, tree = parseMarkdown(source) } = {},
) {
  const lineStarts = [0];
  for (let index = 0; index < source.length; index++) {
    if (source[index] === '\n') lineStarts.push(index + 1);
  }

  const headings = [];
  const outline = [];
  const blocks = [];
  const walker = tree.walker();
  let event;
  while ((event = walker.next())) {
    const node = event.node;
    if (!event.entering) continue;

    if (node.type === 'heading') {
      const text = markdownText(node).replace(/\s+/g, ' ').trim();
      while (headings.length && headings.at(-1).level >= node.level) headings.pop();
      const activeHeading = { level: node.level, text };
      headings.push(activeHeading);
      const heading = {
        level: node.level,
        text,
        headingPath: headings.map(({ text: heading }) => heading),
        sourcepos: sourcePosition(node),
        paragraphCount: 0,
      };
      activeHeading.outline = heading;
      outline.push(heading);
      continue;
    }

    if (node.type !== 'paragraph') continue;
    const text = markdownText(node).replace(/\s+/g, ' ').trim();
    if (!text) continue;

    const position = sourcePosition(node);
    const startOffset = lineStarts[position.start.line - 1];
    const nextLineStart = lineStarts[position.end.line];
    const endOffset = nextLineStart === undefined ? source.length : nextLineStart - 1;
    const sourceText = source.slice(startOffset, endOffset);
    const block = {
      type: 'paragraph',
      headingPath: headings.map(({ text: heading }) => heading),
      sourcepos: position,
      bytes: Buffer.byteLength(sourceText, 'utf8'),
      text,
      source: sourceText,
    };
    if (includeSignatures) block.signature = markdownInlineSignature(node);
    blocks.push(block);
    // Paragraph counts include descendants, and Markdown heading depth is at most six.
    for (const heading of headings) heading.outline.paragraphCount++;
  }

  for (let index = 0; index < outline.length; index++) {
    const heading = outline[index];
    let nextSection = index + 1;
    while (nextSection < outline.length && outline[nextSection].level > heading.level) nextSection++;
    const endLine = outline[nextSection]?.sourcepos.start.line ?? Number.POSITIVE_INFINITY;
    const startOffset = lineStarts[heading.sourcepos.start.line - 1];
    const endOffset = Number.isFinite(endLine) ? lineStarts[endLine - 1] : source.length;
    heading.bytes = Buffer.byteLength(source.slice(startOffset, endOffset), 'utf8');
    heading.endLine = Number.isFinite(endLine)
      ? endLine - 1
      : source.split(/\r?\n/).length;
  }

  return {
    bytes: Buffer.byteLength(source, 'utf8'),
    headings: outline,
    blocks,
  };
}

/*
 * 文書間で言い換えの可能性がある段落の組を、文字3-gramの重なりで候補として挙げる。
 * 意味の判定はしない。全段落を読み比べる代わりに、読む候補を絞るための一覧である。
 * どの文書にも出る定型の3-gramは候補を増やすだけなので索引に入れない。
 */
export function findSimilarBlocks(documents, { minSimilarity = 0.3, minContainment = 0.6, minChars = 40 } = {}) {
  const normalize = (text) => text.replace(/[\s、。,.:：「」『』（）()]/g, '');
  const blocks = documents.flatMap(({ path, blocks: documentBlocks }) =>
    documentBlocks.map((block) => ({ path, block, normalized: normalize(block.text) })));
  const grams = blocks.map(({ normalized }) => {
    const set = new Set();
    for (let index = 0; index + 3 <= normalized.length; index++) set.add(normalized.slice(index, index + 3));
    return set;
  });
  const frequency = new Map();
  for (const set of grams) for (const gram of set) frequency.set(gram, (frequency.get(gram) ?? 0) + 1);
  const commonLimit = Math.max(20, Math.ceil(blocks.length * 0.02));
  const index = new Map();
  blocks.forEach(({ normalized }, position) => {
    if (normalized.length < minChars) return;
    for (const gram of grams[position]) {
      if (frequency.get(gram) > commonLimit) continue;
      if (!index.has(gram)) index.set(gram, []);
      index.get(gram).push(position);
    }
  });
  const pairs = [];
  blocks.forEach(({ path, normalized }, left) => {
    if (normalized.length < minChars) return;
    const shared = new Map();
    for (const gram of grams[left]) {
      for (const right of index.get(gram) ?? []) {
        if (right > left && blocks[right].path !== path) shared.set(right, (shared.get(right) ?? 0) + 1);
      }
    }
    for (const [right, count] of shared) {
      const sizes = [grams[left].size, grams[right].size];
      const similarity = count / (sizes[0] + sizes[1] - count);
      const containment = count / Math.min(...sizes);
      if (similarity >= minSimilarity || containment >= minContainment) {
        pairs.push({ similarity, containment, left: blocks[left], right: blocks[right] });
      }
    }
  });
  return pairs.sort((a, b) => b.similarity - a.similarity || b.containment - a.containment);
}
