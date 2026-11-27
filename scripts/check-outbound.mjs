#!/usr/bin/env node
/** Outbound-text gate: an @-addressed comment must open with the right handle,
 * avoid internal vocabulary, and use Chinese quotes and punctuation.
 * Exit 1 means the text must not be sent; the check and the send run as two steps. */

import { readFileSync } from 'node:fs';

const BANNED = ['主会话', '子代理', '接手', '三权分立', '机器人'];
const USAGE = '用法: node scripts/check-outbound.mjs <正文文件> [--at <被@的账号>]';
const DASH_RE = /—|–|(?<![\w@])-(?![\w>/.-])/;

/** One problem per line; an empty list means the text may be sent. */
function inspect(text, at) {
  const problems = [];
  if (!text.startsWith('@')) {
    problems.push('开头不是 @对方');
  } else if (at && !text.startsWith(`@${at} `)) {
    problems.push(`开头是 ${text.slice(0, text.indexOf(' '))}，应为 @${at}`);
  }
  for (const word of BANNED) {
    if (text.includes(word)) problems.push(`含禁用词「${word}」`);
  }
  // Fenced blocks are quoted commands, not prose; quotes and dashes inside them are fine.
  const prose = text.replace(/```[\s\S]*?```/g, '');
  if (!/[「」]/.test(prose) && /["“”]/.test(prose)) {
    problems.push('有 ASCII 或弯引号，应为「」');
  }
  if (DASH_RE.test(prose.replace(/https?:\/\/\S+/g, ''))) {
    problems.push('有破折号或连接用的连字符');
  }
  return problems;
}

const [file, flag, at] = process.argv.slice(2);
if (!file) {
  console.log(USAGE);
  process.exit(2);
}
const problems = inspect(readFileSync(file, 'utf8'), flag === '--at' && at ? at : null);
for (const problem of problems) console.log(`红  ${problem}`);
console.log(problems.length > 0 ? `不过，${problems.length} 处` : '过');
process.exit(problems.length > 0 ? 1 : 0);