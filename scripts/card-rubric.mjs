/** Pure four-dimension rubric for task cards and skills: role, task, constraints, examples.
 * Kept free of IO so the scoring and the rendered table can be unit-tested. */

const hasHeading = (text, pattern) =>
  text.split(/\r?\n/).some((line) => {
    const heading = line.match(/^#{1,6}\s+(.*)$/);
    return heading !== null && pattern.test(heading[1]);
  });

// Role can be stated up front or in a dedicated section; accepting only one shape would flag valid cards.
const roleSignals = (text) => hasHeading(text, /角色|身份/) || /你是|你作为|作为一名|扮演|you are|act as/i.test(text);

// Only an explicit task section or cue counts; prose that mentions work in passing must not score a task.
const taskSignals = (text) => hasHeading(text, /任务|目标|职责|goal|task/i) || /^(?:任务|目标)[：:]/m.test(text);

// shortcut: constraints are scored as the named section issue #200 asks about — scattered modal words in prose are too noisy to detect reliably; upgrade to semantic detection if that changes.
const constraintsSignals = (text) => hasHeading(text, /约束|纪律|规则|禁忌|禁止|限制|dos|don'ts|constraints/i);

// A bare fenced block is often just a command sample; only an explicit example cue counts.
const examplesSignals = (text) =>
  hasHeading(text, /示例|例子|样例|范例|example/i) ||
  (/(?:^|\n)\s*```/.test(text) && /示例|例如|例[：:]|example/i.test(text));

/** Score one card's text across the four dimensions. Each dimension is 0 or 1. */
export function scoreCard(text) {
  const role = roleSignals(text);
  const task = taskSignals(text);
  const constraints = constraintsSignals(text);
  const examples = examplesSignals(text);
  const total = [role, task, constraints, examples].filter(Boolean).length;
  return { role, task, constraints, examples, total };
}

const mark = (value) => (value ? '✓' : '✗');

/** Render a markdown table, one row per card, columns for each dimension plus the total. */
export function formatRubricTable(rows) {
  const lines = [
    '| 文件 | 角色 | 任务 | 约束 | 示例 | 合计 |',
    '| --- | --- | --- | --- | --- | --- |',
  ];
  for (const { name, scores } of rows) {
    lines.push(
      `| ${name} | ${mark(scores.role)} | ${mark(scores.task)} | ${mark(scores.constraints)} | ${mark(scores.examples)} | ${scores.total}/4 |`,
    );
  }
  return lines.join('\n');
}
