import { existsSync } from 'node:fs';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const errors = [];

const required = [
  'AGENTS.md',
  'CODING_STANDARDS.md',
  'README.md',
  'README.zh.md',
  'GLOSSARY.md',
  'CONTRIBUTING.md',
  'CONTRIBUTING.zh.md',
  'SAFETY.md',
  'SAFETY.zh.md',
  'SECURITY.md',
  'SECURITY.zh.md',
  'TRADEMARKS.md',
  'TRADEMARKS.zh.md',
  'THIRD_PARTY_NOTICES.md',
  'LICENSE',
  'CHANGELOG.md',
  'BENCHMARK.md',
  'docs/agents/issue-tracker.md',
  'docs/cookbook/raising-summary-cap.md',
  'docs/AGENTS.md',
  'docs/architecture.md',
  'docs/configuration.md',
  'docs/dsh-host-contract.md',
  'docs/development.md',
  'docs/testing.md',
  'docs/pr-gate.md',
  'docs/cookbook/adding-a-provider.md',
  'docs/defensive-patterns.md',
  '.agents/notes/README.md',
  'scripts/doc-budgets.json',
];
for (const file of required) {
  if (!existsSync(path.join(root, file))) errors.push(`missing required doc: ${file}`);
}

const budgets = JSON.parse(await readFile(path.join(root, 'scripts/doc-budgets.json'), 'utf8'));
for (const [file, limit] of Object.entries(budgets)) {
  const fullPath = path.join(root, file);
  if (!existsSync(fullPath)) continue;
  const text = await readFile(fullPath, 'utf8');
  const count = Array.from(text).length;
  if (count > limit) errors.push(`${file}: ${count} chars > budget ${limit}`);
}

async function sourceFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...(await sourceFiles(fullPath)));
    else if (entry.name.endsWith('.js')) files.push(fullPath);
  }
  return files;
}

async function markdownFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (['.git', 'node_modules', '.research'].includes(entry.name)) continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...(await markdownFiles(fullPath)));
    else if (entry.name.endsWith('.md')) files.push(path.relative(root, fullPath).replaceAll('\\', '/'));
  }
  return files;
}

const markdown = await markdownFiles(root);
for (const file of markdown) {
  const text = await readFile(path.join(root, file), 'utf8');
  const lines = text.split(/\r?\n/);

  const fenceCount = lines.filter((line) => /^```/.test(line)).length;
  if (fenceCount % 2 !== 0) errors.push(`${file}: unbalanced code fences`);

  lines.forEach((line, index) => {
    if (/\s+$/.test(line)) errors.push(`${file}:${index + 1}: trailing whitespace`);
    if (/[A-Za-z]:\\Users\\[^<]/u.test(line)) {
      errors.push(`${file}:${index + 1}: absolute Windows user path`);
    }
  });

  for (const match of text.matchAll(/\]\(([^)]+)\)/g)) {
    const target = match[1];
    if (/^(https?:|mailto:|#)/.test(target)) continue;
    const clean = decodeURIComponent(target.split('#')[0]);
    if (clean.length === 0) continue;
    if (!existsSync(path.resolve(path.dirname(path.join(root, file)), clean))) {
      errors.push(`${file}: broken relative link: ${target}`);
    }
  }
}

const architecture = await readFile(path.join(root, 'docs/architecture.md'), 'utf8');
const documentedModules = new Set(
  [...architecture.matchAll(/`(lib\/[^`]+)`/g)].map((match) => match[1]),
);
const wildcardModules = [...documentedModules]
  .filter((modulePath) => modulePath.endsWith('/*.js'))
  .map((modulePath) => modulePath.slice(0, -4));
for (const file of await sourceFiles(path.join(root, 'lib'))) {
  const relativePath = path.relative(root, file).replaceAll('\\', '/');
  if (
    !documentedModules.has(relativePath) &&
    !wildcardModules.some((prefix) => relativePath.startsWith(prefix))
  ) {
    errors.push(`${relativePath}: missing from docs/architecture.md module map`);
  }
}

// Chinese prose keeps one physical line per paragraph. Skip headings, lists, tables, quotes, and fences.
const chineseDocs = new Set([
  'README.zh.md',
  'AGENTS.md',
  'CODING_STANDARDS.md',
  'CONTRIBUTING.md',
  'BENCHMARK.md',
  'docs/AGENTS.md',
  'docs/architecture.md',
  'docs/development.md',
  'docs/testing.md',
  'docs/cookbook/adding-a-provider.md',
  'docs/defensive-patterns.md',
  '.agents/notes/README.md',
]);
for (const file of chineseDocs) {
  const lines = (await readFile(path.join(root, file), 'utf8')).split(/\r?\n/);
  let inFence = false;
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index].trim();
    if (/^```/.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (inFence || line.length === 0 || /^(#|\||-|\d+\.|>)/.test(line)) continue;
    const next = (lines[index + 1] ?? '').trim();
    if (
      /[\u4e00-\u9fff]$/.test(line) &&
      /^[\u4e00-\u9fffA-Za-z0-9`]/.test(next) &&
      !/^(#|\||-|\d+\.|>)/.test(next)
    ) {
      errors.push(`${file}:${index + 1}: Chinese paragraph has a hard wrap`);
    }
  }
}

for (const file of markdown.filter(
  (name) =>
    name.startsWith('.agents/notes/') &&
    name !== '.agents/notes/README.md' &&
    !name.endsWith('/AGENTS.md'),
)) {
  const text = await readFile(path.join(root, file), 'utf8');
  const folder = file.split('/')[2];
  const status = text.match(/^Status: (.+)$/m)?.[1]?.trim();
  const expectedStatus = {
    proposed: 'proposed',
    implemented: 'implemented',
    rejected: 'rejected',
    archived: 'implemented',
  }[folder];
  if (!/^# Agent Note: .+$/m.test(text)) errors.push(`${file}: missing "# Agent Note: <title>"`);
  if (expectedStatus === undefined || status === undefined || !status.startsWith(expectedStatus)) {
    errors.push(`${file}: Status does not match lifecycle folder ${folder}`);
  }
  const sections =
    folder === 'implemented' || folder === 'archived'
      ? ['Problem', 'Decision', 'Alternatives considered', 'Consequences']
      : folder === 'proposed'
        ? ['Problem', 'Proposal', 'Alternatives considered', 'Acceptance criteria', 'Risks']
        : ['Problem', 'Proposal', 'Alternatives considered'];
  for (const section of sections) {
    if (!text.includes(`## ${section}`)) errors.push(`${file}: missing section ## ${section}`);
  }
}

const { DEFAULT_SETTINGS: defaults, SETTINGS_SPEC: settingsSpec } = await import(
  pathToFileURL(path.join(root, 'lib/settings.js')).href
);
const configKeys = settingsSpec.map((field) => field.key);
if (configKeys.length === 0) errors.push('lib/index.js: no Config fields found');

const defaultByPath = (path) => path.split('.').reduce((value, key) => value[key], defaults);
const expectedDefaults = Object.fromEntries(
  settingsSpec.map((field) => {
    const value = defaultByPath(field.path);
    return [field.key, field.kind === 'order' ? value.join(',') : value];
  }),
);

for (const file of ['docs/configuration.md']) {
  const text = await readFile(path.join(root, file), 'utf8');
  for (const key of configKeys) {
    if (!text.includes('`' + key + '`')) errors.push(`${file}: missing Config field ${key}`);
  }
  for (const [, key, value] of text.matchAll(/^\| `([^`]+)` \| `([^`]*)` \|/gm)) {
    if (key in expectedDefaults && String(expectedDefaults[key]) !== value) {
      errors.push(`${file}: default for ${key} is ${value}, expected ${expectedDefaults[key]}`);
    }
  }
}

const readmeEn = await readFile(path.join(root, 'README.md'), 'utf8');
const readmeZh = await readFile(path.join(root, 'README.zh.md'), 'utf8');
const headingLevels = (text) =>
  text
    .split(/\r?\n/)
    .filter((line) => /^#{1,6} /.test(line))
    .map((line) => line.match(/^#{1,6}/)[0].length);
const fenceInfos = (text) =>
  text
    .split(/\r?\n/)
    .filter((line) => /^```/.test(line))
    .map((line) => line.replace(/^```/, '').trim());
const configRows = (text) => [...text.matchAll(/^\| `([^`]+)` \| `([^`]*)` \|/gm)].length;
const providerRows = (text) => [...text.matchAll(/^\| `([a-z-]+)` \|/gm)].map((match) => match[1]);
const tableRows = (text) => text.split(/\r?\n/).filter((line) => /^\|/.test(line)).length;

for (const [name, left, right] of [
  ['heading levels', headingLevels(readmeEn), headingLevels(readmeZh)],
  ['code fences', fenceInfos(readmeEn), fenceInfos(readmeZh)],
  ['table row count', tableRows(readmeEn), tableRows(readmeZh)],
]) {
  if (JSON.stringify(left) !== JSON.stringify(right)) {
    errors.push(`README pair mismatch: ${name}`);
  }
}
if (configRows(readmeEn) !== configRows(readmeZh)) {
  errors.push('README pair mismatch: config table row count');
}
const providersEn = providerRows(readmeEn);
const providersZh = providerRows(readmeZh);
if (JSON.stringify(providersEn) !== JSON.stringify(providersZh)) {
  errors.push('README pair mismatch: provider table rows');
}

if (errors.length > 0) {
  console.error(`docs:check failed (${errors.length})`);
  for (const error of errors) console.error(`- ${error}`);
  process.exitCode = 1;
} else {
  console.log(
    `docs:check passed: ${markdown.length} markdown files, ${Object.keys(budgets).length} budgets, ${configKeys.length} config fields`,
  );
}
