#!/usr/bin/env node
/** Validate a pull request body against the repository delivery gate. */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const REQUIRED_SECTIONS = ['Summary', 'Evidence', 'Merge Danger'];

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
}

function stripHtmlComments(text) {
  let output = '';
  let index = 0;
  while (index < text.length) {
    if (text.startsWith('<!--', index)) {
      const end = text.indexOf('-->', index + 4);
      if (end === -1) break;
      index = end + 3;
      continue;
    }
    output += text[index];
    index += 1;
  }
  return output;
}

function sectionOf(body, name) {
  const heading = new RegExp(`^##\\s+${escapeRegExp(name)}\\s*$`, 'mu');
  const match = heading.exec(body);
  if (match === null) return undefined;
  const rest = body.slice(match.index + match[0].length);
  const next = /^##\s+\S/mu.exec(rest);
  return (next === null ? rest : rest.slice(0, next.index)).trim();
}

/**
 * Validate one PR body.
 * @param {string} body
 * @returns {{ ok: boolean, errors: string[] }}
 */
export function validatePrBody(body) {
  const errors = [];
  const cleaned = stripHtmlComments(String(body));
  if (cleaned.trim().length === 0) {
    return { ok: false, errors: ['PR body is empty'] };
  }

  for (const name of REQUIRED_SECTIONS) {
    if (sectionOf(cleaned, name) === undefined) {
      errors.push(`missing required section: ## ${name}`);
    }
  }
  if (errors.length > 0) return { ok: false, errors };

  const summary = sectionOf(cleaned, 'Summary') ?? '';
  if (summary.length < 10) errors.push('Summary is too short');

  const evidence = sectionOf(cleaned, 'Evidence') ?? '';
  const before = /\bBefore[ \t]*:[ \t]*(?:\*\*)?[ \t]*([^\n]*)/iu.exec(evidence);
  const after = /\bAfter[ \t]*:[ \t]*(?:\*\*)?[ \t]*([^\n]*)/iu.exec(evidence);
  if (before === null || before[1].trim().length === 0) {
    errors.push('Evidence must contain a non-empty Before: entry');
  }
  if (after === null || after[1].trim().length === 0) {
    errors.push('Evidence must contain a non-empty After: entry');
  }
  if (/\bTODO\b|\bTBD\b|待补充|待确认/iu.test(evidence)) {
    errors.push('Evidence still contains a placeholder');
  }

  const danger = sectionOf(cleaned, 'Merge Danger') ?? '';
  const door = /Door[ \t]*:[ \t]*(?:\*\*)?[ \t]*([^\n]*)/iu.exec(danger);
  if (door === null || !/(one-way|two-way|单向|双向)/iu.test(door[1])) {
    errors.push('Merge Danger must contain Door: one-way or Door: two-way');
  }
  const blast = /Blast Radius[ \t]*:[ \t]*(?:\*\*)?[ \t]*([^\n]*)/iu.exec(danger);
  if (blast === null || blast[1].trim().length === 0) {
    errors.push('Merge Danger must contain a non-empty Blast Radius:');
  }

  return { ok: errors.length === 0, errors };
}

function main() {
  const args = process.argv.slice(2);
  const bodyFileIndex = args.indexOf('--body-file');
  let body = process.env.PR_BODY ?? '';
  if (bodyFileIndex !== -1) {
    const file = args[bodyFileIndex + 1];
    if (file === undefined) {
      console.error('PR gate failed: --body-file requires a path');
      process.exitCode = 1;
      return;
    }
    body = readFileSync(file, 'utf8');
  }

  const result = validatePrBody(body);
  if (result.ok) {
    console.log('PR gate passed');
    return;
  }
  console.error(`PR gate failed: ${result.errors.length} error(s)`);
  for (const error of result.errors) console.error(`- ${error}`);
  process.exitCode = 1;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}
