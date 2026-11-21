#!/usr/bin/env node
/** Freshness gate: the provider table in docs/subsystems/providers.md must equal
 * what scripts/generate-provider-table.mjs renders from lib/catalog.js. A hand
 * edit or a catalog change without `pnpm docs:gen` fails with the drifting line. */

import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { checkRegionDrift, renderProviderTable } from './generate-provider-table.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const file = resolve(root, 'docs/subsystems/providers.md');
const text = await readFile(file, 'utf8');
const result = checkRegionDrift(text, renderProviderTable());
if (!result.ok) {
  console.error(`doc freshness check failed: ${result.message}`);
  process.exitCode = 1;
} else {
  console.log('doc freshness ok: provider table matches lib/catalog.js');
}
