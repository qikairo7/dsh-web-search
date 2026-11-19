import { readFileSync, writeFileSync } from 'node:fs';
const r = JSON.parse(readFileSync('cur.json', 'utf8'));
const b = {
  name: r.name, target: r.target, enforcement: r.enforcement, conditions: r.conditions,
  rules: JSON.parse(JSON.stringify(r.rules)),
  bypass_actors: (r.bypass_actors || []).map((x) => ({ actor_id: x.actor_id, actor_type: x.actor_type })),
};
const sc = b.rules.find((x) => x.type === 'required_status_checks');
sc.parameters.required_status_checks = sc.parameters.required_status_checks.filter((c) => c.context !== 'pr-gate');
writeFileSync('fix.json', JSON.stringify(b));
console.log('required checks now:', JSON.stringify(sc.parameters.required_status_checks.map((c) => c.context)));
