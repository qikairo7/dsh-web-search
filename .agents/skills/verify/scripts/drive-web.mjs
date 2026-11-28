#!/usr/bin/env node
/**
 * Drive the installed plugin's auto search and fetch providers, keyless.
 *
 * Reads the isolated DSH_HOME the verification run created, imports the plugin
 * from the one-shot profile, and calls the auto router directly with a minimal
 * ctx stub. Exit code 0 means the three layers passed; non-zero means at least
 * one failed. The three layers: Chinese search, English search, one fetch.
 *
 * Nothing is written outside the temporary DSH_HOME, and nothing is cleaned up
 * here — the caller owns the teardown.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { mkdir, symlink } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

const CALL_TIMEOUT_MS = 30_000;
const PKG_NAME = '@qikairo7/dsh-web-search';
const FETCH_URL = 'https://nodejs.org/api/path.html';
/** keyless fallback and the paid tail: a run answered only by these failed. */
const FALLBACK_PROVIDERS = ['bing', 'tavily', 'firecrawl'];

const note = (line) => process.stdout.write(`${line}\n`);

/** Walk up from this script to the repo root, identified by the package name. */
function findRepoRoot() {
  let dir = path.dirname(fileURLToPath(import.meta.url));
  for (let hop = 0; hop < 8; hop += 1) {
    const pkgPath = path.join(dir, 'package.json');
    if (existsSync(pkgPath)) {
      try {
        if (JSON.parse(readFileSync(pkgPath, 'utf8'))?.name === PKG_NAME) return dir;
      } catch { /* not a package.json, keep walking */ }
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  throw new Error('找不到仓库根（未遇到 @qikairo7/dsh-web-search 的 package.json）');
}

/** Locate the one-shot DSH_HOME the launch step created. */
function findIsolatedHome(repoRoot) {
  const candidates = [
    process.env.DSH_HOME,
    path.join(repoRoot, '.agents', 'verify-home'),
  ].filter((value) => typeof value === 'string' && value.length > 0);
  for (const candidate of candidates) {
    const profiles = path.join(candidate, 'profiles');
    if (!existsSync(profiles)) continue;
    const names = readdirSync(profiles).filter((name) => {
      return existsSync(path.join(profiles, name, 'node_modules', '@qikairo7', 'dsh-web-search'));
    });
    if (names.length > 0) return { home: candidate, profile: names[0] };
  }
  throw new Error(
    `找不到装好插件的一次性 profile。查过：${candidates.join('、')}。`
    + ' 先按 SKILL.md 的 Launch 起好实例，并把 DSH_HOME 指到那个目录。',
  );
}

/**
 * `dsh plugin add` installs the plugin body and its dependencies; peer
 * dependencies are injected by the host at runtime, so a standalone import is
 * missing them. Junction the same versions from the repo's node_modules.
 */
async function linkPeerDependencies(repoRoot, profileNodeModules) {
  const scoped = path.join(profileNodeModules, '@deepseek-ai');
  await mkdir(scoped, { recursive: true });
  const patched = [];
  for (const peer of ['dsh-web', 'dsh-credentials', 'dsh-tools', 'dsh-tool-web', 'cordis']) {
    const source = path.join(repoRoot, 'node_modules', '@deepseek-ai', peer);
    if (!existsSync(source)) throw new Error(`仓库 node_modules 缺 peer 包 @deepseek-ai/${peer}，先 pnpm install`);
    const target = path.join(scoped, peer);
    if (!existsSync(target)) {
      await symlink(source, target, 'junction');
      patched.push(peer);
    }
  }
  return patched;
}

/** Minimal ctx stub: catches registrations, resolves no credentials, records the provider trail. */
function makeStubCtx() {
  const registered = { search: [], fetch: [], tools: [] };
  const trails = [];
  const logger = {
    debug(message) {
      if (typeof message === 'string' && message.startsWith('provider trail ')) {
        try { trails.push(JSON.parse(message.slice('provider trail '.length))); } catch { /* not JSON */ }
      }
    },
    warn() {}, info() {}, error() {},
  };
  const ctx = {
    web: {
      registerSearchProvider(provider) { registered.search.push(provider); },
      registerFetchProvider(provider) { registered.fetch.push(provider); },
    },
    credentials: { resolve: async () => undefined },
    tools: { register(definition) { registered.tools.push(definition.name); } },
    inject() { /* the management routes live in the real instance */ },
    get() { return undefined; },
    logger: () => logger,
  };
  return { ctx, registered, trails };
}

function topThree(result) {
  return (result?.sources ?? []).slice(0, 3).map((source, index) => {
    const title = typeof source.title === 'string' && source.title.length > 0 ? source.title : '(无标题)';
    const snippet = source.snippet ?? source.summary ?? '';
    return `${index + 1}. ${title} | ${source.url} | snippet:${String(snippet).length}`;
  });
}

/** Judge one search result: non-empty, fields present, answered by a real backend. */
function judgeSearch(label, result, trail, failures) {
  const sources = result?.sources ?? [];
  const top = sources.slice(0, 3);
  const withUrl = top.filter((s) => typeof s?.url === 'string' && /^https?:/u.test(s.url)).length;
  const withTitle = top.filter((s) => typeof s?.title === 'string' && s.title.length > 0).length;
  const withSnippet = top.filter((s) => {
    const snippet = s?.snippet ?? s?.summary;
    return typeof snippet === 'string' && snippet.length > 0;
  }).length;
  const answered = trail?.answered ?? [];
  if (sources.length === 0) failures.push(`${label}: 搜索结果为空`);
  if (withUrl === 0) failures.push(`${label}: 前三条没有合法 URL`);
  if (withTitle === 0) failures.push(`${label}: 前三条没有标题`);
  if (withSnippet === 0) failures.push(`${label}: 前三条没有摘要`);
  if (answered.length > 0 && !answered.some((name) => !FALLBACK_PROVIDERS.includes(name))) {
    failures.push(`${label}: 只有兜底信源应答 (${answered.join(', ')})`);
  }
  return { total: sources.length, withUrl, withTitle, withSnippet, answered };
}

async function main() {
  const failures = [];
  const repoRoot = findRepoRoot();
  const { home, profile } = findIsolatedHome(repoRoot);
  note(`[1/4] 仓库 ${repoRoot}`);
  note(`[1/4] 一次性 DSH_HOME ${home} | profile ${profile}`);

  const pkgDir = path.join(home, 'profiles', profile, 'node_modules', '@qikairo7', 'dsh-web-search');
  const profileNodeModules = path.join(home, 'profiles', profile, 'node_modules');
  const patched = await linkPeerDependencies(repoRoot, profileNodeModules);
  note(`[1/4] 补链 junction（来自仓库 node_modules）：${patched.join(', ') || '（无）'}`);

  const entryPath = path.join(pkgDir, 'lib', 'index.js');
  const mod = await import(pathToFileURL(entryPath).href);
  const { ctx, registered, trails } = makeStubCtx();
  // Enrichment off: quality mode would fetch the top results for evidence, which
  // would spend more of each backend's call budget than this check allows.
  mod.apply(ctx, { enrichEnabled: false });
  const autoSearch = registered.search.find((provider) => provider.id === 'auto');
  const autoFetch = registered.fetch.find((provider) => provider.id === 'auto');
  if (autoSearch === undefined || autoFetch === undefined) {
    throw new Error(
      `ctx 桩没接住 auto 注册：search=[${registered.search.map((p) => p.id).join(',')}] `
      + `fetch=[${registered.fetch.map((p) => p.id).join(',')}]`,
    );
  }
  note(`[2/4] 注册成功 search=[${registered.search.map((p) => p.id).join(',')}] fetch=[${registered.fetch.map((p) => p.id).join(',')}] tools=${registered.tools.length}个`);

  const runSearch = async (label, query) => {
    const trailBefore = trails.length;
    const result = await autoSearch.search({ query, maxResults: 10 }, AbortSignal.timeout(CALL_TIMEOUT_MS));
    const trail = [...trails.slice(trailBefore)].reverse().find((entry) => entry.capability === 'search');
    const judged = judgeSearch(label, result, trail, failures);
    note(`\n--- ${label}（"${query}"）：${judged.total} 条，answered=[${judged.answered.join(',')}]，前3字段 title/url/snippet=${judged.withTitle}/${judged.withUrl}/${judged.withSnippet}`);
    for (const line of topThree(result)) note(line);
  };

  await runSearch('searchZh', 'Node.js 文件读取');
  await runSearch('searchEn', 'site:nodejs.org fs.readFile');

  note('\n--- fetch ---');
  const fetched = await autoFetch.fetch({ url: FETCH_URL }, AbortSignal.timeout(CALL_TIMEOUT_MS), { order: ['http'] });
  let text = typeof fetched?.body?.content === 'string' ? fetched.body.content : '';
  if (fetched?.body?.kind === 'html') {
    const clean = await import(pathToFileURL(path.join(pkgDir, 'lib', 'clean.js')).href);
    text = clean.htmlToText(text);
  }
  note(`HTTP ${fetched?.statusCode} kind=${fetched?.body?.kind} 正文 ${text.trim().length} 字符`);
  note(text.trim().slice(0, 300));
  if (fetched?.statusCode !== 200) failures.push(`fetch: HTTP ${fetched?.statusCode}（期望 200）`);
  if (text.trim().length === 0) failures.push('fetch: 正文为空');

  note('\n===== 判定 =====');
  if (failures.length > 0) {
    for (const failure of failures) note(`FAIL: ${failure}`);
    note('RESULT: FAIL');
    process.exitCode = 1;
    return;
  }
  note('RESULT: PASS');
}

process.on('unhandledRejection', (reason) => {
  note(`UNHANDLED: ${String(reason?.stack ?? reason)}`);
  process.exitCode = 1;
});

await main();
