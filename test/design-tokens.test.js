import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';

const require = createRequire(import.meta.url);
const pkg = require('../package.json');

function loadClientBundle() {
  let definition;
  const sandbox = {
    window: {
      __ModuleLoader__: {
        load(value) { definition = value; },
      },
    },
  };
  vm.runInNewContext(readFileSync('client.js', 'utf8'), sandbox);
  return definition;
}

const BUNDLED_FONTS = [
  'inter-300-latin.woff2',
  'inter-400-latin.woff2',
  'inter-500-latin.woff2',
  'geist-mono-400-latin.woff2',
];

test('the package publishes the bundled latin woff2 files', () => {
  assert.equal(pkg.files.includes('lib/fonts/*.woff2'), true, 'package files must publish lib/fonts');
  for (const file of BUNDLED_FONTS) {
    assert.equal(existsSync('lib/fonts/' + file), true, 'lib/fonts/' + file + ' must ship with the package');
  }
});

test('the settings page injects the dsw2 tokens and redirects the dsw aliases', () => {
  const source = readFileSync('client.js', 'utf8');
  assert.equal(source.includes('--dsw2-eggshell: #fdfcfc'), true, 'light page canvas comes from DESIGN.md');
  assert.equal(source.includes('--dsw2-violet-spark: #0447ff'), true, 'violet spark is the single interactive accent');
  assert.equal(source.includes('--dsw-alias-bg-layer-1: var(--dsw2-eggshell)'), true, 'bg-layer-1 redirect');
  assert.equal(source.includes('--dsw-alias-card-fill: var(--dsw2-warm-taupe)'), true, 'card-fill redirect');
  assert.equal(source.includes('--dsw-alias-state-business-primary: var(--dsw2-violet-spark)'), true, 'business accent redirect');
  assert.equal(source.includes('--dsw-alias-state-error-primary: var(--dsw2-ember-orange)'), true, 'error accent redirect');
});

test('dark tokens follow the host theme attribute with the warm-black derivation', () => {
  const source = readFileSync('client.js', 'utf8');
  assert.equal(source.includes('body[data-ds-dark-theme] {'), true, 'dark tokens hang off the host theme attribute');
  assert.equal(source.includes('--dsw2-eggshell: #1c1a17'), true, 'dark canvas is warm black, not cold black');
  assert.equal(source.includes('--dsw2-violet-spark: #6690ff'), true, 'dark violet lifts one step for contrast');
});

test('display headings use the whisper weight with optical tracking', () => {
  const source = readFileSync('client.js', 'utf8');
  assert.equal(source.includes('--dsw2-font-display'), true, 'display family stack is declared');
  assert.equal(source.includes("letterSpacing: '-0.02em'"), true, 'display tracking follows DESIGN.md');
  assert.equal(/heading: \{\n        margin: 0,\n        fontSize: '18px',\n        fontWeight: 300,/u.test(source), true, 'the page heading ships at weight 300');
});

test('font faces point at the same-origin font route with swap', () => {
  const source = readFileSync('client.js', 'utf8');
  for (const file of BUNDLED_FONTS) {
    assert.equal(source.includes('url("/dsh-web-search/fonts/' + file + '")'), true, '@font-face must reference ' + file);
  }
  assert.equal(source.includes('font-display: swap'), true, 'font faces swap to keep first paint fast');
});

test('the font route serves bundled files same-origin', async () => {
  const { registerFontRoutes } = await import('../lib/fonts-routes.js');
  let registered;
  const webCtx = { webServer: { register: (options) => { registered = options; return () => {}; } } };
  registerFontRoutes({ inject: (names, fn) => { assert.deepEqual(names, ['webServer']); fn(webCtx); } });
  assert.equal(registered.path, '/dsh-web-search/fonts');
  const responses = [];
  const makeRes = () => {
    const res = { statusCode: 0, headers: null, body: null };
    res.writeHead = (status, headers) => { res.statusCode = status; res.headers = headers; };
    res.end = (body) => { res.body = body; };
    return res;
  };
  const sameOrigin = {
    method: 'GET',
    headers: { host: '127.0.0.1:1810', 'sec-fetch-site': 'same-origin' },
    socket: { remoteAddress: '127.0.0.1' },
  };
  const ok = makeRes();
  await registered.handler({ ...sameOrigin, url: '/dsh-web-search/fonts/inter-400-latin.woff2' }, ok);
  assert.equal(ok.statusCode, 200);
  assert.equal(ok.headers['content-type'], 'font/woff2');
  assert.equal(ok.body.slice(0, 4).toString('latin1'), 'wOF2', 'the served bytes are a real woff2 file');

  const forbidden = makeRes();
  await registered.handler({
    ...sameOrigin,
    headers: { host: '127.0.0.1:1810', origin: 'http://evil.example' },
    url: '/dsh-web-search/fonts/inter-400-latin.woff2',
  }, forbidden);
  assert.equal(forbidden.statusCode, 403, 'cross-origin requests are rejected');

  const unknown = makeRes();
  await registered.handler({ ...sameOrigin, url: '/dsh-web-search/fonts/secret.txt' }, unknown);
  assert.equal(unknown.statusCode, 404, 'files outside the bundled list are rejected');

  const post = makeRes();
  await registered.handler({ ...sameOrigin, method: 'POST', url: '/dsh-web-search/fonts/inter-400-latin.woff2' }, post);
  assert.equal(post.statusCode, 405, 'only GET and HEAD are served');
});
