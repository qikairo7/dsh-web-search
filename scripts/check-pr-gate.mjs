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

function sectionStart(body, name) {
  const heading = new RegExp(`^##\\s+${escapeRegExp(name)}\\s*$`, 'mu');
  return heading.exec(body)?.index;
}

function sectionOf(body, name) {
  const start = sectionStart(body, name);
  if (start === undefined) return undefined;
  const rest = body.slice(start);
  const headingEnd = rest.indexOf('\n');
  const contentStart = headingEnd === -1 ? rest.length : headingEnd + 1;
  const content = rest.slice(contentStart);
  const next = /^##\s+\S/mu.exec(content);
  return (next === null ? content : content.slice(0, next.index)).trim();
}

function hasPlaceholder(value) {
  return /\bTODO\b|\bTBD\b|待补充|待确认/iu.test(value);
}

function lastNonEmptyLine(value) {
  const lines = value.trimEnd().split(/\r?\n/u);
  return lines.at(-1)?.trim() ?? '';
}

const BADGE_LINE = /^\[!\[[^\]]*\]\(https:\/\/img\.shields\.io\/badge\/powered_by-dsh-[^)]+\)\]\(https:\/\/github\.com\/deepseek-ai\/deepseek-harness\)$/u;

/**
 * Validate one PR body.
 * @param {string} body
 * @returns {{ ok: boolean, errors: string[] }}
 */
export function validatePrBody(body, options = {}) {
  const author = typeof options.author === 'string' ? options.author : '';
  const isAutomatedAuthor = /\[bot\]$/iu.test(author)
    || /^(?:dependabot|renovate)(?:\[bot\])?$/iu.test(author);
  const errors = [];
  const cleaned = stripHtmlComments(String(body));
  if (cleaned.trim().length === 0) {
    return { ok: false, errors: ['PR body is empty'] };
  }

  for (const name of REQUIRED_SECTIONS) {
    if (sectionStart(cleaned, name) === undefined) {
      errors.push(`missing required section: ## ${name}`);
    }
  }
  if (errors.length > 0) return { ok: false, errors };

  const starts = REQUIRED_SECTIONS.map((name) => sectionStart(cleaned, name));
  if (starts.some((start, index) => index > 0 && start <= starts[index - 1])) {
    errors.push('sections must appear in order: ## Summary, ## Evidence, ## Merge Danger');
  }

  const summary = sectionOf(cleaned, 'Summary') ?? '';
  if (summary.length < 10) errors.push('Summary is too short');
  if (hasPlaceholder(summary)) errors.push('Summary still contains a placeholder');

  const evidence = sectionOf(cleaned, 'Evidence') ?? '';
  const before = /\bBefore[ \t]*:[ \t]*(?:\*\*)?[ \t]*([^\n]*)/iu.exec(evidence);
  const after = /\bAfter[ \t]*:[ \t]*(?:\*\*)?[ \t]*([^\n]*)/iu.exec(evidence);
  if (before === null || before[1].trim().length === 0) {
    errors.push('Evidence must contain a non-empty Before: entry');
  }
  if (after === null || after[1].trim().length === 0) {
    errors.push('Evidence must contain a non-empty After: entry');
  }
  if (hasPlaceholder(evidence)) {
    errors.push('Evidence still contains a placeholder');
  }

  const danger = sectionOf(cleaned, 'Merge Danger') ?? '';
  const door = /Door[ \t]*:[ \t]*(?:\*\*)?[ \t]*([^\n]*)/iu.exec(danger);
  const doorValue = door?.[1].trim().toLowerCase() ?? '';
  if (!['one-way', 'two-way', '单向', '双向'].includes(doorValue)) {
    errors.push('Merge Danger must contain Door: one-way or Door: two-way');
  }
  const blast = /Blast Radius[ \t]*:[ \t]*(?:\*\*)?[ \t]*([^\n]*)/iu.exec(danger);
  if (blast === null || blast[1].trim().length === 0) {
    errors.push('Merge Danger must contain a non-empty Blast Radius:');
  } else if (hasPlaceholder(blast[1])) {
    errors.push('Blast Radius still contains a placeholder');
  }

  if (!isAutomatedAuthor && !BADGE_LINE.test(lastNonEmptyLine(cleaned))) {
    errors.push('PR body must end with the powered by dsh badge');
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

  const result = validatePrBody(body, { author: process.env.PR_AUTHOR ?? '' });
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
