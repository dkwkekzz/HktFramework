import { VEIL_BLUEPRINTS } from './packages/scenarios/suites/d2-veil-blueprints.ts';
const seen = new Map<string, string[]>();
for (const entry of VEIL_BLUEPRINTS as any[]) {
  const sp = entry.archetype.name;
  for (const s of entry.blueprint.supplies ?? []) {
    const t = s.target;
    const key = t ? `${t.name}:${String(t.id).slice(-6)}` : '(종류만)';
    const holder = JSON.stringify(s.condition?.holder ?? null);
    const slot = s.condition?.slot ? `${s.condition.slot.domain}.${s.condition.slot.path}` : s.condition?.kind;
    seen.set(key, [...(seen.get(key) ?? []), `${sp}/${s.label} [${slot} @${holder}] sub=${s.substitutability}`]);
  }
}
for (const [k, v] of seen) { if (v.length > 1) { console.log('SHARED', k); for (const x of v) console.log('    ', x); } }
console.log('--- all targets ---');
for (const [k, v] of seen) console.log(k.padEnd(28), v.length, v.map(x=>x.split('/')[0]).join(','));
