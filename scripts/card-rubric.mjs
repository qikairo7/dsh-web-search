/** Pure four-dimension rubric for task cards and skills: role, task, constraints, examples.
 * Kept free of IO so the scoring and the rendered table can be unit-tested. */

const hasHeading = (text, pattern) =>
  text.split(/\r?\n/).some((line) => {
    const heading = line.match(/^#{1,6}\s+(.*)$/);
    return heading !== null && pattern.test(heading[1]);
  });

// A card states its role up front ("你是 reviewer"), or names a 角色/身份 section.
const roleSignals = (text) => hasHeading(text, /角色|身份/) || /你是|你作为|作为一名|扮演|you are|act as/i.test(text);

// 任务/目标/职责 heading, or an explicit task line, marks the job to do.
const taskSignals = (text) => hasHeading(text, /任务|目标|职责|goal|task/i) || /^(?:任务|目标)[：:]/m.test(text);

// 约束/Dos/Don'ts section heading marks the constraints block.
// shortcut: heading-based only — scattered modal words in prose do not count, so the
// reminder tracks a named section (issue's "约束节") rather than defensive prose density.
const constraintsSignals = (text) => hasHeading(text, /约束|纪律|规则|禁忌|禁止|限制|dos|don'ts|constraints/i);

// 示例/例子/范例 heading, or a fenced block introduced as an example.
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
