#!/usr/bin/env node
/**
 * verify-docs —— 文書構造を検査する。
 *
 * 生成AIエージェントに読ませる CLAUDE.md / README.md / docs/ / .agents/skills/ のような
 * 階層的な文書群は、「必要な時にだけ必要な文書が読まれる」ように作っても、放っておくと
 * 3 つの壊れ方をする。
 *
 *   1. 参照が黙って切れる —— ファイルを動かす・消すと、リンクが死ぬ。誰も見ていないと
 *      気づかないまま古いパスを指し続ける。
 *   2. 1 文書が際限なく太る —— 「この話題のときに開く」という区切りを作っても、
 *      その1文書の中身が増え続けると、開いた瞬間に読む量が膨らんでいく。
 *   3. 同じ説明が複数の文書に重複する —— コピーしてから直すと、片方だけ更新されて
 *      矛盾した2つの説明が残る。太った文書を分割するときにも起きやすい。
 *
 * このスクリプトは3つとも検査する。DocumentStructureVerifier（このスクリプト）と、プレイブック
 * （見つかったものをどう直すか）は分けてある。プレイブックの手順は
 * `.agents/skills/verify-docs/SKILL.md`。
 *
 *   node scripts/document-structure-verifier.mjs
 *
 * 見ているもの:
 *   - マークダウンリンクの飛び先が実在するか（外部 URL は見ない）
 *   - 断片（`#見出し`）が、その文書の見出しに実在するか
 *   - 本文にバッククォートで書いたリポジトリ内のパスが実在するか
 *   - entryPoints・スキルの SKILL.md 以外の文書のうち、docsDir 配下の文書が
 *     どこかから参照されているか（孤立していないか）。エージェント設定用
 *     ディレクトリ配下で
 *     docsDir にもスキルディレクトリにも属さない文書（エージェント定義など）は
 *     孤立チェックの対象外（サイズ超過・重複チェックは対象。詳細は下記
 *     「検査対象の集め方」参照）
 *   - スキルの補助文書（references/ など）が、自分の SKILL.md から参照されているか
 *   - 各文書のバイト数が、決めた上限を超えていないか（文書サイズ例外一覧に書いた例外は除く）
 *   - 同じ段落（一定の長さ以上）が複数の文書にそのまま重複していないか
 *   - （既定オフ）句読点・敬体/常体だけが違う、ほぼ同じ段落が複数の文書に
 *     ないか（`checkNearDuplicates`。誤検知が増えやすいのでオプトイン）
 *
 * 検査対象の集め方:
 *   `excludePaths` に列挙したディレクトリを除き、リポジトリ全体の `*.md` を対象と
 *   する。`entryPoints`・`docsDir`・`skillsDir` は「その文書に何を期待するか」
 *   （孤立チェックの免除・SKILL.md との紐付けなど）を決めるだけで、検査対象への
 *   出し入れには使わない。**特定のディレクトリだけを見る方式（旧仕様）は、そこに
 *   置き忘れた文書が黙って検査から漏れる事故を招くため採用しない。**
 *
 *   ただし孤立チェックだけは対象の狭め方が異なる。`agentConfigDirs` 配下
 *   （`skillsDir` 自身の SKILL.md 一式を除く）で `docsDir` にも属さない文書
 *   （エージェント定義など、スキル以外の設定ファイル）は、走査（=リンク切れ・サイズ・重複の検査）
 *   には含まれたまま、孤立チェックのみ免除される。README・SKILL.md から参照
 *   されない運用が前提の設定ファイル群まで「孤立」として毎回検出し続けるのを
 *   避けるための意図的な例外であり、見落としではない。
 *
 * 設定（すべて省略可。既定値は DEFAULTS を見る）:
 *   verify-docs.config.json をリポジトリ直下に置くと読む。
 *
 *     {
 *       "entryPoints": ["README.md", "CLAUDE.md", "AGENTS.md"],
 *       "docsDir": "docs",
 *       "skillsDir": ".agents/skills",
 *       "pathRoots": ["src/", "docs/", "scripts/", ".agents/", ".claude/", ".kiro/", ".github/"],
 *       "agentConfigDirs": [".agents", ".claude", ".kiro"],
 *       "excludePaths": ["node_modules/", ".git/", "vendor/", "dist/", "build/", ".verify-docs/"],
 *       "maxDocBytes": 7000,
 *       "minDuplicateChars": 60,
 *       "checkDuplicates": true,
 *       "checkNearDuplicates": false,
 *       "sizeExceptionFile": "document-size-exceptions.json",
 *       "tighten": { "mode": "auto" },
 *       "dedupe": { "mode": "auto" }
 *     }
 *
 * 文書サイズ例外一覧（既定 document-size-exceptions.json）:
 *   既存リポジトリに後から入れると、すでに上限を超えている文書が見つかることがある。
 *   全部その場で分割できるとは限らないので、超過を **黙って見逃す代わりに、
 *   文書サイズ例外一覧に書いて明示的に「わかっていて残している」形にする。**
 *
 *     [
 *       { "path": "docs/deploy.md", "reason": "既存の肥大化ドキュメント。分割待ち" }
 *     ]
 *
 *   例外一覧に載っている文書は、超過していても検査は落とさない（かわりに一覧に出す）。
 *   ただし **すでに上限内に収まっている文書が例外一覧に残っていたら、それは検査を落とす**
 *   （直したのに消し忘れた借金は、借金のふりをして居座らせない）。
 *
 * 意図した重複を許すとき:
 *   免責文言・定型の注意書きなど、**わざと**複数の文書に同じ文を置きたいことがある。
 *   その段落の直前の行に `<!-- verify-docs:allow-duplicate -->` を置くと、
 *   その段落だけ重複検査から外れる。
 *
 * options:
 *   --root=<dir>    検査するリポジトリの根（既定: カレント）
 *   --config=<file> 設定ファイルの場所（既定: <root>/verify-docs.config.json）
 *   --json          結果を JSON で出す
 *   --changed-base=<ref> そのGit参照からの差分に関係する違反だけを報告する（移動元・削除済みパスも含む）
 *   --init-size-exceptions いま上限を超えている文書を全部例外一覧に書き出して終わる
 *                   （検査は走らせない）。既存リポジトリに導入する最初の1回に使う。
 *                   すでにファイルがあれば上書きせず失敗する（手で消してから）
 */

import { execFileSync } from 'node:child_process';
import { existsSync, lstatSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { extractProseBlocks, markdownText, parseMarkdown, sourcePosition } from './markdown-structure.mjs';

let ROOT;
let configOption;

export const DEFAULTS = {
  entryPoints: ['README.md', 'CLAUDE.md', 'AGENTS.md'],
  docsDir: 'docs',
  skillsDir: '.agents/skills',
  pathRoots: ['src/', 'docs/', 'scripts/', '.agents/', '.claude/', '.kiro/', '.github/'],
  agentConfigDirs: ['.agents', '.claude', '.kiro'],
  excludePaths: ['node_modules/', '.git/', 'vendor/', 'dist/', 'build/', '.verify-docs/'],
  maxDocBytes: 7000,
  minDuplicateChars: 60,
  checkDuplicates: true,
  checkNearDuplicates: false,
  sizeExceptionFile: 'document-size-exceptions.json',
  tighten: { mode: 'auto' },
  dedupe: { mode: 'auto' },
};

function readJson(path, label) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch (error) {
    throw new Error(`${label} を読み込めない: ${error.message}`);
  }
}

const CONFIG_TYPES = {
  entryPoints: 'string[]',
  docsDir: 'path',
  skillsDir: 'path',
  pathRoots: 'string[]',
  agentConfigDirs: 'string[]',
  excludePaths: 'string[]',
  maxDocBytes: 'positive integer',
  minDuplicateChars: 'positive integer',
  checkDuplicates: 'boolean',
  checkNearDuplicates: 'boolean',
  sizeExceptionFile: 'path',
  tighten: 'mode',
  dedupe: 'mode',
};

function validateRelativePath(value, label) {
  if (
    typeof value !== 'string'
    || value.trim() === ''
    || value.startsWith('/')
    || /^[A-Za-z]:[\\/]/.test(value)
    || value.split(/[\\/]/).includes('..')
  ) {
    throw new Error(`${label} はリポジトリ内の相対パスにしてください`);
  }
}

function validateConfig(config) {
  if (!config || typeof config !== 'object' || Array.isArray(config)) {
    throw new Error('verify-docs.config.json はJSONオブジェクトである必要があります');
  }
  for (const key of Object.keys(config)) {
    if (!Object.hasOwn(CONFIG_TYPES, key)) throw new Error(`未対応の設定キー: ${key}`);
    const type = CONFIG_TYPES[key];
    const value = config[key];
    if (type === 'path') validateRelativePath(value, key);
    else if (type === 'mode') {
      if (!value || typeof value !== 'object' || Array.isArray(value)) {
        throw new Error(`${key} は mode を持つオブジェクトにしてください`);
      }
      if (Object.keys(value).some((nestedKey) => nestedKey !== 'mode')) {
        throw new Error(`${key} には mode だけを指定できます`);
      }
      if (!['safe', 'auto'].includes(value.mode)) {
        throw new Error(`${key}.mode は safe または auto にしてください`);
      }
    } else if (type === 'string[]') {
      if (!Array.isArray(value) || value.some((item) => typeof item !== 'string' || item.trim() === '')) {
        throw new Error(`${key} は空でない文字列の配列にしてください`);
      }
      if (['entryPoints', 'pathRoots', 'agentConfigDirs', 'excludePaths'].includes(key)) {
        value.forEach((item, index) => validateRelativePath(item, `${key}[${index}]`));
      }
    } else if (type === 'positive integer') {
      if (!Number.isSafeInteger(value) || value <= 0) throw new Error(`${key} は正の整数にしてください`);
    } else if (typeof value !== type) {
      throw new Error(`${key} は ${type} にしてください`);
    }
  }
  return config;
}

function loadConfig() {
  const path = configOption ?? join(ROOT, 'verify-docs.config.json');
  const detectedSkillsDir = [DEFAULTS.skillsDir, '.claude/skills', '.kiro/skills'].find((dir) =>
    existsSync(join(ROOT, dir)),
  );
  const defaults = detectedSkillsDir
    ? { ...DEFAULTS, skillsDir: detectedSkillsDir }
    : DEFAULTS;
  if (!existsSync(path)) return defaults;
  const user = readJson(path, 'verify-docs.config.json');
  if (!user || typeof user !== 'object' || Array.isArray(user)) {
    throw new Error('verify-docs.config.json はJSONオブジェクトである必要があります');
  }
  return validateConfig({ ...defaults, ...user });
}

function loadSizeExceptions(config) {
  const path = join(ROOT, config.sizeExceptionFile);
  if (!existsSync(path)) return new Map();
  const list = readJson(path, config.sizeExceptionFile);
  if (!Array.isArray(list)) throw new Error(`${config.sizeExceptionFile} は配列である必要があります`);
  const entries = new Map();
  for (const [index, entry] of list.entries()) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      throw new Error(`${config.sizeExceptionFile}[${index}] はオブジェクトである必要があります`);
    }
    const keys = Object.keys(entry);
    if (keys.some((key) => !['path', 'reason', 'section'].includes(key))) {
      throw new Error(`${config.sizeExceptionFile}[${index}] は path・reason・section だけを指定できます`);
    }
    validateRelativePath(entry.path, `${config.sizeExceptionFile}[${index}].path`);
    if (typeof entry.reason !== 'string' || entry.reason.trim() === '') {
      throw new Error(`${config.sizeExceptionFile}[${index}].reason は空でない文字列にしてください`);
    }
    if (entry.section !== undefined) {
      const section = entry.section;
      if (!section || typeof section !== 'object' || Array.isArray(section)) {
        throw new Error(`${config.sizeExceptionFile}[${index}].section はオブジェクトにしてください`);
      }
      const sectionKeys = Object.keys(section);
      if (sectionKeys.some((key) => !['headingPath', 'startLine', 'endLine', 'bytes'].includes(key))) {
        throw new Error(`${config.sizeExceptionFile}[${index}].section に未対応の項目があります`);
      }
      if (!Array.isArray(section.headingPath) || section.headingPath.length === 0 ||
          section.headingPath.some((heading) => typeof heading !== 'string' || heading.trim() === '')) {
        throw new Error(`${config.sizeExceptionFile}[${index}].section.headingPath は空でない見出し文字列の配列にしてください`);
      }
      for (const key of ['startLine', 'endLine', 'bytes']) {
        if (!Number.isSafeInteger(section[key]) || section[key] <= 0) {
          throw new Error(`${config.sizeExceptionFile}[${index}].section.${key} は正の整数にしてください`);
        }
      }
      if (section.endLine < section.startLine) {
        throw new Error(`${config.sizeExceptionFile}[${index}].section.endLine は startLine 以降にしてください`);
      }
    }
    if (entries.has(entry.path)) throw new Error(`${config.sizeExceptionFile} に重複した path があります: ${entry.path}`);
    entries.set(entry.path, entry);
  }
  return entries;
}

export function verifyDocumentStructure(root, { configPath, initSizeExceptions = false, changedBase } = {}) {
  ROOT = resolve(root);
  const changed = changedBase === undefined ? null : changedPathsSince(changedBase);
  const changedPaths = changed?.paths ?? null;
  configOption = configPath;
  const config = loadConfig();
  const sizeExceptions = loadSizeExceptions(config);

/** 実体のない書き方。手順の説明で使うので、パスとしては見ない。 */
const PLACEHOLDER = /[<>*…]|\.\.\./;

const violations = [];
const fail = (kind, from, target, reason, detail = {}) =>
  violations.push({ kind, from, target, reason, ...detail });

/* ---------- 対象の文書を集める ---------- */

/* entryPoints・docsDir・skillsDir に置き忘れると検査から漏れてしまうため（本ツール
 * 自体がこれで CONTRIBUTING.md の重複を見逃した）、リポジトリ全体の *.md を対象に
 * 走査する。`excludePaths` に列挙したディレクトリ配下のみ除外する（既定は
 * node_modules・.git・vendor・dist・build）。 */

const isExcluded = (relDir) =>
  config.excludePaths.some((prefix) => `${relDir}/`.startsWith(prefix));

function walk(dir, hits = []) {
  if (!existsSync(dir)) return hits;
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const rel = relative(ROOT, full);
    const info = lstatSync(full);
    // 互換用の別名を二重走査しない。リンク先の正本側を検査する。
    if (info.isSymbolicLink()) continue;
    if (info.isDirectory()) {
      if (isExcluded(rel)) continue;
      walk(full, hits);
    } else if (name.endsWith('.md')) {
      hits.push(rel);
    }
  }
  return hits;
}

function changedPathsSince(base) {
  const output = execFileSync(
    'git',
    ['-C', ROOT, 'diff', '--name-status', '-z', '--find-renames', '--diff-filter=ACMRD', `${base}...HEAD`],
  ).toString('utf8');
  const fields = output.split('\0');
  const paths = new Set();
  const renames = [];
  for (let index = 0; index < fields.length - 1;) {
    const status = fields[index++];
    if (status.startsWith('R') || status.startsWith('C')) {
      const from = fields[index++];
      const to = fields[index++];
      paths.add(from);
      paths.add(to);
      if (status.startsWith('R')) renames.push({ from, to });
      continue;
    }
    paths.add(fields[index++]);
  }
  return { paths, renames };
}

const documents = [...new Set(walk(ROOT))].sort();
const documentSet = new Set(documents);

function sizeExceptionSection(source) {
  const { headings } = extractProseBlocks(source);
  if (headings.length === 0) return undefined;
  // 文書全体を表す先頭の見出しより、分割の単位になりやすい末端節を優先する。
  const leaves = headings.filter((heading) =>
    !headings.some((other) =>
      other.headingPath.length > heading.headingPath.length
      && other.headingPath.slice(0, heading.headingPath.length).every((part, index) =>
        part === heading.headingPath[index],
      ),
    ),
  );
  const section = [...leaves].sort((a, b) => b.bytes - a.bytes || a.sourcepos.start.line - b.sourcepos.start.line)[0];
  return {
    headingPath: section.headingPath,
    startLine: section.sourcepos.start.line,
    endLine: section.endLine,
    bytes: section.bytes,
  };
}

/* ---------- --init-size-exceptions: 既存リポジトリへの導入 ---------- */

if (initSizeExceptions) {
  const sizeExceptionPath = join(ROOT, config.sizeExceptionFile);
  if (existsSync(sizeExceptionPath)) {
    const error = new Error(`${config.sizeExceptionFile} はすでにある。上書きしない。手で消してからやり直す。`);
    error.exitCode = 1;
    throw error;
  }

  const overSize = documents
    .map((doc) => ({
      path: doc,
      bytes: Buffer.byteLength(readFileSync(join(ROOT, doc), 'utf8'), 'utf8'),
    }))
    .filter(({ bytes }) => bytes > config.maxDocBytes)
    .map(({ path, bytes }) => {
      const section = sizeExceptionSection(readFileSync(join(ROOT, path), 'utf8'));
      return {
        path,
        reason: `導入時点ですでに上限超過（${bytes} バイト）。分割するかここに理由を書き直す`,
        ...(section ? { section } : {}),
      };
    });

  writeFileSync(sizeExceptionPath, JSON.stringify(overSize, null, 2) + '\n');
  return { initializedSizeExceptions: { path: config.sizeExceptionFile, count: overSize.length } };
}

/* ---------- 見出しから断片を作る（GitHub と同じ規則） ---------- */

const slug = (heading) =>
  heading
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s_-]/gu, '')
    .trim()
    .replace(/\s+/g, '-');

/** コードブロックの中は本文ではないので、見出しもリンクも拾わない。重複検査にも使う。 */
function stripFences(text) {
  let inFence = false;
  return text
    .split('\n')
    .map((line) => {
      if (/^\s*```/.test(line)) {
        inFence = !inFence;
        return '';
      }
      return inFence ? '' : line;
    })
    .join('\n');
}

const bodies = new Map();
const sources = new Map();
const syntaxTrees = new Map();
const structures = new Map();
const fragments = new Map();

for (const doc of documents) {
  const source = readFileSync(join(ROOT, doc), 'utf8');
  const tree = parseMarkdown(source);
  sources.set(doc, source);
  syntaxTrees.set(doc, tree);
  structures.set(doc, extractProseBlocks(source, { tree }));
  const body = stripFences(source);
  bodies.set(doc, body);
  const ids = new Set();
  const walker = tree.walker();
  let event;
  while ((event = walker.next())) {
    if (!event.entering || event.node.type !== 'heading') continue;
    const base = slug(markdownText(event.node));
    let id = base;
    let suffix = 1;
    while (ids.has(id)) id = `${base}-${suffix++}`;
    ids.add(id);
  }
  fragments.set(doc, ids);
}

function locationFor(doc, position) {
  if (!position) return undefined;
  const heading = structures.get(doc).headings
    .filter(({ sourcepos }) => sourcepos.start.line <= position.start.line)
    .at(-1);
  return {
    path: doc,
    ...position,
    ...(heading ? { headingPath: heading.headingPath } : {}),
  };
}

// CommonMark のインラインノード（link / image）は sourcepos を持たないため、
// 位置を持つ親の段落・見出しまで遡る。
function nodePosition(node) {
  for (let current = node; current; current = current.parent) {
    if (current.sourcepos) return sourcePosition(current);
  }
  return undefined;
}

/* ---------- 1. マークダウンリンクと断片 ---------- */

const referenced = new Set();
const referencedBy = new Map();

function noteReference(target, from) {
  const normalized = target.replace(/\/$/, '');
  if (!documentSet.has(normalized)) return;
  referenced.add(normalized);
  if (!referencedBy.has(normalized)) referencedBy.set(normalized, new Set());
  referencedBy.get(normalized).add(from);
}

function decodeLinkPart(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

for (const doc of documents) {
  const from = dirname(join(ROOT, doc));
  const walker = syntaxTrees.get(doc).walker();
  let event;
  while ((event = walker.next())) {
    const node = event.node;
    if (!event.entering || !['link', 'image'].includes(node.type)) continue;
    const target = node.destination;
    if (!target || /^[A-Za-z][A-Za-z0-9+.-]*:/.test(target)) continue;

    const [rawPath, rawFragment] = target.split('#');
    const path = decodeLinkPart(rawPath);
    const fragment = rawFragment === undefined ? undefined : decodeLinkPart(rawFragment);

    if (path === '') {
      if (fragment && !fragments.get(doc).has(fragment.toLowerCase())) {
        fail('fragment', doc, target, `この文書に見出し「${fragment}」がない`, {
          location: locationFor(doc, nodePosition(node)),
        });
      }
      continue;
    }

    const full = resolve(from, path);
    if (!existsSync(full)) {
      fail('link', doc, target, '飛び先のファイルがない', {
        location: locationFor(doc, nodePosition(node)),
      });
      continue;
    }
    noteReference(relative(ROOT, full), doc);

    if (!fragment) continue;
    const targetDoc = relative(ROOT, full);
    if (!fragments.has(targetDoc)) continue;
    if (!fragments.get(targetDoc).has(fragment.toLowerCase())) {
      fail('fragment', doc, target, `${targetDoc} に見出し「${fragment}」がない`, {
        location: locationFor(doc, nodePosition(node)),
      });
    }
  }
}

/* ---------- 2. バッククォートで書いたパス ---------- */

for (const doc of documents) {
  for (const [, token] of bodies.get(doc).matchAll(/`([^`\n]+)`/g)) {
    const path = token.trim().replace(/[、。）)]+$/, '');
    if (!config.pathRoots.some((root) => path.startsWith(root))) continue;
    if (PLACEHOLDER.test(path)) continue;

    if (!existsSync(join(ROOT, path.replace(/\/$/, '')))) {
      fail('path', doc, path, 'この場所にファイルもディレクトリもない');
      continue;
    }
    noteReference(path, doc);
  }
}

/* ---------- 3. 孤立した文書 ---------- */

const skillDoc = (doc) => {
  const prefix = `${config.skillsDir}/`;
  if (!doc.startsWith(prefix)) return null;
  const rest = doc.slice(prefix.length);
  const slash = rest.indexOf('/');
  if (slash === -1) return null;
  return [rest.slice(0, slash), rest.slice(slash + 1)];
};

for (const doc of documents) {
  if (config.entryPoints.includes(doc)) continue;

  const skill = skillDoc(doc);
  if (skill) {
    const [name, rest] = skill;
    if (rest === 'SKILL.md') continue;
    const owner = `${config.skillsDir}/${name}/SKILL.md`;
    if (referencedBy.get(doc)?.has(owner)) continue;
    fail('orphan', doc, doc, `${owner} から参照されていない（SKILL.md の目次に載せる）`);
    continue;
  }

  if (config.agentConfigDirs.some((dir) => doc.startsWith(`${dir.replace(/\/$/, '')}/`))) {
    // エージェント設定ディレクトリ配下の SKILL.md 以外の設定ファイルなどは対象外
    if (!doc.startsWith(config.docsDir)) continue;
  }
  if (referenced.has(doc)) continue;
  fail('orphan', doc, doc, 'どの文書からも参照されていない（README か関連する文書から指す）');
}

/* ---------- 4. 文書のサイズ ---------- */

for (const doc of documents) {
  const bytes = Buffer.byteLength(readFileSync(join(ROOT, doc), 'utf8'), 'utf8');
  const exempt = sizeExceptions.get(doc);

  if (bytes > config.maxDocBytes && !exempt) {
    const sections = structures.get(doc).headings
      .filter(({ headingPath }) => headingPath.length > 1)
      .sort((a, b) => b.bytes - a.bytes || a.sourcepos.start.line - b.sourcepos.start.line)
      .slice(0, 3)
      .map(({ headingPath, sourcepos, endLine, bytes: sectionBytes }) => ({
        headingPath,
        startLine: sourcepos.start.line,
        endLine,
        bytes: sectionBytes,
      }));
    fail(
      'size',
      doc,
      doc,
      `${bytes} バイト（上限 ${config.maxDocBytes}）。話題ごとに分けて互いにリンクするか、` +
        `${config.sizeExceptionFile} に理由つきで書いて明示的に借金にする`,
      { bytes, limit: config.maxDocBytes, sections },
    );
  }

  if (exempt && bytes <= config.maxDocBytes) {
    fail(
      'stale-size-exception',
      config.sizeExceptionFile,
      doc,
      `もう上限内に収まっている（${bytes} バイト）。${config.sizeExceptionFile} から消す`,
    );
  }
}

for (const path of sizeExceptions.keys()) {
  if (!documentSet.has(path)) {
    fail('stale-size-exception', config.sizeExceptionFile, path, 'この文書がもう無い。エントリを消す');
  }
}

/* ---------- 5. 文書間の重複 ---------- */

/* コピーしてから片方だけ直すと、矛盾した説明が残る。ASTから抽出した段落本文が
 * 完全一致する組（強調などの書式差は無視）を見つけ、1か所にまとめるよう促す。
 * 短い共通の言い回しまで拾うと誤検知だらけになるので、`minDuplicateChars` 未満の
 * 段落・見出し・表の行は見ない。 */

const ALLOW_MARKER = '<!-- verify-docs:allow-duplicate -->';

/** 見出し・表・意図した重複（allow-duplicate）を除いた、比較対象の段落だけを集める。 */
function collectParagraphs() {
  const hits = [];
  for (const doc of documents) {
    const source = sources.get(doc);
    const lines = source.split(/\r?\n/);
    const { blocks } = extractProseBlocks(source, {
      includeSignatures: true,
      tree: syntaxTrees.get(doc),
    });
    for (const block of blocks) {
      if (block.source.trimStart().startsWith('|')) continue;

      let previousLine = block.sourcepos.start.line - 2;
      while (previousLine >= 0 && lines[previousLine].trim() === '') previousLine--;
      if (previousLine >= 0 && lines[previousLine].trim() === ALLOW_MARKER) continue;

      const normalized = block.text.replace(/\s+/g, ' ').trim();
      if (normalized.length < config.minDuplicateChars) continue;

      hits.push({ doc, normalized, signature: block.signature, block });
    }
  }
  return hits;
}

const paragraphs = config.checkDuplicates || config.checkNearDuplicates ? collectParagraphs() : [];

if (config.checkDuplicates) {
  const paragraphGroups = new Map();
  for (const { doc, normalized, signature, block } of paragraphs) {
    const identity = JSON.stringify([normalized, signature]);
    if (!paragraphGroups.has(identity)) paragraphGroups.set(identity, { normalized, occurrences: [] });
    paragraphGroups.get(identity).occurrences.push({ doc, block });
  }

  for (const { normalized, occurrences } of paragraphGroups.values()) {
    const uniqueDocs = [...new Set(occurrences.map(({ doc }) => doc))].sort();
    if (uniqueDocs.length < 2) continue;
    const [first, ...rest] = uniqueDocs;
    const snippet = normalized.length > 50 ? `${normalized.slice(0, 50)}…` : normalized;
    const firstOccurrence = occurrences.find(({ doc }) => doc === first);
    fail(
      'duplicate',
      first,
      rest.join(', '),
      `同じ説明が重複している（「${snippet}」）。1か所にまとめて他方からリンクする。` +
        `意図した重複なら段落の前に ${ALLOW_MARKER} を置く`,
      {
        location: locationFor(first, firstOccurrence.block.sourcepos),
        occurrences: occurrences.map(({ doc, block }) => ({
          location: locationFor(doc, block.sourcepos),
        })),
      },
    );
  }
}

/* ---------- 5b. 準一致重複（句読点・敬体/常体レベルの表記ゆれ） ---------- */

/* 完全一致より緩めると誤検知が増えるので、既定オフ（config.checkNearDuplicates）。
 * 吸収するのは「句読点の全角/半角」と「代表的な敬体/常体の語尾」だけで、
 * 意味的な類似判定（embedding など）はしない。完全一致で既に拾える組は
 * 二重報告しない（texts.size >= 2 のときだけ「表記ゆれで一致した」とみなす）。 */

const STYLE_ENDINGS = [
  [/ではありません/g, 'ではない'],
  [/ございます/g, 'ある'],
  [/でした/g, 'だった'],
  [/でしょう/g, 'だろう'],
  [/ましょう/g, 'よう'],
  [/ません/g, 'ない'],
  [/します/g, 'する'],
  [/です/g, 'だ'],
  [/ます/g, 'る'],
];

function fuzzyNormalize(text) {
  let s = text;
  for (const [pattern, replacement] of STYLE_ENDINGS) s = s.replace(pattern, replacement);
  return s
    .replace(/[，,]/g, '、')
    .replace(/[．.]/g, '。')
    .replace(/[！!]/g, '!')
    .replace(/[？?]/g, '?')
    .replace(/\s+/g, '');
}

if (config.checkNearDuplicates) {
  const fuzzyGroups = new Map();
  for (const { doc, normalized, signature, block } of paragraphs) {
    const fuzzy = fuzzyNormalize(normalized);
    if (fuzzy.length < config.minDuplicateChars) continue;

    const identity = JSON.stringify([fuzzy, signature]);
    if (!fuzzyGroups.has(identity)) fuzzyGroups.set(identity, { texts: new Set(), docs: new Map() });
    const group = fuzzyGroups.get(identity);
    group.texts.add(normalized);
    if (!group.docs.has(doc)) group.docs.set(doc, { normalized, block });
  }

  for (const [fuzzy, group] of fuzzyGroups) {
    if (group.docs.size < 2) continue;
    if (group.texts.size < 2) continue; // 完全一致（5.）で既に報告済み

    const [first, ...rest] = [...group.docs.keys()].sort();
    const snippet = fuzzy.length > 50 ? `${fuzzy.slice(0, 50)}…` : fuzzy;
    fail(
      'near-duplicate',
      first,
      rest.join(', '),
      `句読点・敬体/常体だけが違う、ほぼ同じ説明が複数の文書にある（正規化後: 「${snippet}」）。` +
        `1か所にまとめて他方からリンクするか、意図した表記差なら段落の前に ${ALLOW_MARKER} を置く`,
      { location: locationFor(first, group.docs.get(first).block.sourcepos) },
    );
  }
}

/* ---------- 報告 ---------- */

const documentMetrics = [...structures.entries()].map(([path, structure]) => ({
  path,
  bytes: structure.bytes,
  headings: structure.headings.length,
  paragraphs: structure.blocks.length,
}));
const leafSections = [...structures.entries()].flatMap(([path, structure]) => {
  const headings = structure.headings;
  return headings.flatMap((heading, index) => {
    if (headings[index + 1]?.level > heading.level) return [];
    return [{
      path,
      headingPath: heading.headingPath,
      startLine: heading.sourcepos.start.line,
      endLine: heading.endLine,
      bytes: heading.bytes,
      paragraphCount: heading.paragraphCount,
    }];
  });
});
const changedScopeIncludesEverything = changedPaths?.has('verify-docs.config.json') || changedPaths?.has(config.sizeExceptionFile);
function violationTouchesChangedPath(violation) {
  if (!changedPaths || changedScopeIncludesEverything) return true;
  const paths = [violation.from, violation.target, violation.location?.path];
  for (const occurrence of violation.occurrences ?? []) paths.push(occurrence.location?.path);
  return paths.filter(Boolean).some((path) => changedPaths.has(path.split('#', 1)[0]));
}
const scopedViolations = violations.filter(violationTouchesChangedPath);
const violationsByKind = Object.fromEntries(
  [...new Set(scopedViolations.map(({ kind }) => kind))]
    .sort()
    .map((kind) => [kind, scopedViolations.filter((violation) => violation.kind === kind).length]),
);
const summary = {
  documents: {
    count: documentMetrics.length,
    bytes: documentMetrics.reduce((sum, document) => sum + document.bytes, 0),
    headings: documentMetrics.reduce((sum, document) => sum + document.headings, 0),
    paragraphs: documentMetrics.reduce((sum, document) => sum + document.paragraphs, 0),
  },
  sizeExceptions: {
    count: sizeExceptions.size,
    entries: [...sizeExceptions.values()],
  },
  violations: {
    count: scopedViolations.length,
    byKind: violationsByKind,
  },
  largestSections: leafSections
    .sort((a, b) => b.bytes - a.bytes || a.path.localeCompare(b.path) || a.startLine - b.startLine)
    .slice(0, 5),
};

const verificationReport = {
  kind: 'DocumentStructureVerificationReport',
  summary,
  violations: scopedViolations,
  ...(changedPaths ? {
    changed: {
      base: changedBase,
      paths: [...changedPaths].sort(),
      ...(changed.renames.length ? { renames: changed.renames } : {}),
    },
  } : {}),
};

return verificationReport;
}

export function printVerificationReport(verificationReport, { json = false } = {}) {
if (json) {
  console.log(JSON.stringify(verificationReport, null, 2));
} else {
  const { summary, violations } = verificationReport;
  const label = {
    link: 'リンク切れ',
    fragment: '断片',
    path: 'パス参照',
    orphan: '孤立',
    size: 'サイズ超過',
    duplicate: '重複',
    'near-duplicate': '準一致重複',
    'stale-size-exception': '文書サイズ例外の掃除',
  };
  console.log(
    `文書 ${summary.documents.count} 件（見出し ${summary.documents.headings} 件・` +
    `段落 ${summary.documents.paragraphs} 件・${summary.documents.bytes} バイト、文書サイズ例外 ${summary.sizeExceptions.count} 件）を検査`,
  );
  if (summary.largestSections.length > 0) {
    console.log('\n大きい節（末端節・上位5件）:');
    for (const section of summary.largestSections) {
      console.log(
        `  - ${section.path}:${section.startLine}-${section.endLine} / ` +
        `${section.headingPath.join(' > ')} — ${section.bytes} バイト、${section.paragraphCount} 段落`,
      );
    }
  }
  if (summary.sizeExceptions.entries.length > 0) {
    console.log('\n文書サイズ例外:');
    for (const entry of summary.sizeExceptions.entries) {
      const section = entry.section
        ? ` / ${entry.section.headingPath.join(' > ')} (${entry.section.startLine}-${entry.section.endLine}行、${entry.section.bytes} バイト)`
        : '';
      console.log(`  - ${entry.path}${section} — ${entry.reason}`);
    }
  }
  if (violations.length > 0) {
    const kinds = Object.entries(summary.violations.byKind)
      .map(([kind, count]) => `${label[kind]} ${count}件`)
      .join('・');
    console.error(`\n文書構造の検査に失敗（${violations.length}件: ${kinds}）:`);
    for (const f of violations) {
      const where = f.location
        ? ` (${f.location.path}:${f.location.start.line}:${f.location.start.column}` +
          `${f.location.headingPath?.length ? ` / ${f.location.headingPath.join(' > ')}` : ''})`
        : '';
      console.error(`  - [${label[f.kind]}] ${f.from} → ${f.target}${where} — ${f.reason}`);
    }
  } else {
    console.log('\n文書構造: すべて通過');
  }
}
}

function main() {
  const args = process.argv.slice(2);
  const flag = (name) => args.includes(`--${name}`);
  const option = (name, fallback) => {
    const hit = args.find((arg) => arg.startsWith(`--${name}=`));
    return hit === undefined ? fallback : hit.slice(name.length + 3);
  };
  const root = resolve(process.cwd(), option('root', '.'));
  const configPath = option('config', undefined);

  try {
    const result = verifyDocumentStructure(root, {
      configPath,
      initSizeExceptions: flag('init-size-exceptions'),
      changedBase: option('changed-base', undefined),
    });
    if (result.initializedSizeExceptions) {
      const { path, count } = result.initializedSizeExceptions;
      console.log(
        `${path} を作った（${count} 件）。\n` +
          '理由を書き直し、以後は新しく足す・書き足す文書から上限を守ること。' +
          'リストは減らす方向にだけ動かす。',
      );
      return 0;
    }
    printVerificationReport(result, { json: flag('json') });
    return result.violations.length > 0 ? 1 : 0;
  } catch (error) {
    if (error.exitCode !== undefined) {
      console.error(error.message);
      return error.exitCode;
    }
    console.error(`設定エラー: ${error.message}`);
    return 2;
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = main();
}
