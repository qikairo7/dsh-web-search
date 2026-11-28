#!/usr/bin/env node
/** Outbound-text gate: an @-addressed comment must open with the right handle,
 * avoid internal vocabulary, and use Chinese quotes and punctuation.
 * Exit 1 means the text must not be sent; the check and the send run as two steps.
 *
 * Scope: the main form is a comment whose first token is @对方. A title opens with
 * 「【」 and a PR body with 「##」, so neither passes as-is: prepend `@对方 ` to the
 * whole text and check that, and the rest of it is still checked like a comment.
 * --at takes the handle with or without its @, and a newline right after the
 * handle counts as the closing space. */

import { readFileSync } from 'node:fs';

const BANNED = ['主会话', '子代理', '接手', '三权分立', '机器人'];
const USAGE = '用法: node scripts/check-outbound.mjs <正文文件> [--at <被@的账号>]';
const DASH_RE = /—|–|(?<![\w@])-(?![\w>/.-])/;
// A line-leading " - " is a Markdown list marker, punctuation rather than a dash.
const LIST_MARKER_RE = /^[ \t]*-(?= )/gm;
const URL_RE = /https?:\/\/\S+/g;

/** One problem per line; an empty list means the text may be sent. */
function inspect(rawText, at) {
  const problems = [];
  const text = rawText.replace(/\r\n/g, '\n');
  const opener = text.split(/\s/)[0];
  if (!text.startsWith('@')) {
    problems.push('开头不是 @对方');
  } else if (at && opener !== `@${at}`) {
    problems.push(`开头是 ${opener}，应为 @${at}`);
  }
  for (const word of BANNED) {
    if (text.includes(word)) problems.push(`含禁用词「${word}」`);
  }
  // Fenced blocks are quoted commands, not prose; quotes and dashes inside them are fine.
  const prose = text.replace(/```[\s\S]*?```/g, '');
  if (/["“”]/.test(prose)) {
    problems.push('有 ASCII 或弯引号，应为「」');
  }
  if (DASH_RE.test(prose.replace(URL_RE, '').replace(LIST_MARKER_RE, ''))) {
    problems.push('有破折号或连接用的连字符');
  }
  return problems;
}

const args = process.argv.slice(2);
const atFlag = args.indexOf('--at');
const atValue = atFlag === -1 ? null : args[atFlag + 1];
if (atFlag !== -1 && !atValue) {
  console.log('参数错误：--at 后面缺账号');
  console.log(USAGE);
  process.exit(2);
}
const rest = atFlag === -1 ? args : [...args.slice(0, atFlag), ...args.slice(atFlag + 2)];
const [file] = rest;
if (!file) {
  console.log(USAGE);
  process.exit(2);
}
const problems = inspect(readFileSync(file, 'utf8'), atValue ? atValue.replace(/^@/, '') : null);
for (const problem of problems) console.log(`红  ${problem}`);
console.log(problems.length > 0 ? `不过，${problems.length} 处` : '过');
process.exit(problems.length > 0 ? 1 : 0);