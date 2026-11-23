/** Refresh the committed 50-row public benchmark fixture from the public rows API. */

import { writeFile } from 'node:fs/promises';

const SAMPLE_SIZE = Number(process.env.SAMPLE_SIZE ?? 50);

async function loadRows(dataset, config, split) {
  const rows = [];
  for (let offset = 0; offset < SAMPLE_SIZE; offset += 100) {
    const url = `https://datasets-server.huggingface.co/rows?dataset=${encodeURIComponent(dataset)}&config=${encodeURIComponent(config)}&split=${encodeURIComponent(split)}&offset=${offset}&length=${Math.min(100, SAMPLE_SIZE - offset)}`;
    const response = await fetch(url, { signal: AbortSignal.timeout(60_000) });
    const text = await response.text();
    if (!response.ok) throw new Error(`HTTP ${response.status}: ${text.slice(0, 160)}`);
    const data = JSON.parse(text);
    if (!Array.isArray(data.rows)) throw new Error(`no rows: ${text.slice(0, 160)}`);
    rows.push(...data.rows.map((entry) => entry.row));
  }
  return rows;
}

const framesRows = await loadRows('google/frames-benchmark', 'default', 'test');
const webwalkerRows = await loadRows('callanwu/WebWalkerQA', 'default', 'main');
const fixture = {
  'google/frames-benchmark|default|test': framesRows.map((row) => ({
    Prompt: row.Prompt,
    Answer: row.Answer,
    wiki_links: row.wiki_links,
  })),
  'callanwu/WebWalkerQA|default|main': webwalkerRows.map((row) => ({
    question: row.question,
    answer: row.answer,
    info: row.info,
  })),
};
const target = new URL('./fixtures/public-benchmark-sample.json', import.meta.url);
await writeFile(target, `${JSON.stringify(fixture, null, 2)}\n`, 'utf8');
console.log(`updated ${target.pathname} (${framesRows.length} FRAMES, ${webwalkerRows.length} WebWalkerQA)`);
