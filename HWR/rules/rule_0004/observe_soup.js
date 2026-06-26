// observe_soup — 원시 수프를 굴려 *무엇이 창발했는지* 통계로 본다(뷰어와 같은 엔진·규칙).
//   node rules/rule_0004/observe_soup.js [틱수]
import { stepWorld } from '../../engine.js';
import r1 from '../rule_0001/rule_0001.js';
import r2 from '../rule_0002/rule_0002.js';
import r3 from '../rule_0003/rule_0003.js';
import r4 from '../rule_0004/rule_0004.js';
import scn from './scenario_soup.js';

const rules = [r1, r2, r3, r4];
const params = Object.assign({ dt: 1 }, r1.defaults, r2.defaults, r3.defaults, r4.defaults);
const TICKS = parseInt(process.argv[2], 10) || 600;

const SYM = { 1: 'H', 6: 'C', 7: 'N', 8: 'O', 10: 'Ne', 11: 'Na', 12: 'Mg', 17: 'Cl' };
const sym = z => SYM[z] || `Z${z}`;

// 분자 화학식 — 구성 원자 Z 다중집합 → "H2O" 식(Hill: C, H, 그 외 알파벳)
function formula(parts) {
  const c = new Map();
  for (const p of parts) if (p.Z != null) c.set(p.Z, (c.get(p.Z) || 0) + 1);
  const order = [...c.keys()].sort((a, b) => {
    const rank = z => (z === 6 ? 0 : z === 1 ? 1 : 2);
    return rank(a) - rank(b) || sym(a).localeCompare(sym(b));
  });
  return order.map(z => sym(z) + (c.get(z) > 1 ? c.get(z) : '')).join('');
}
const ionLabel = e => sym(e.Z) + (e.q > 0 ? '+'.repeat(e.q) : '-'.repeat(-e.q));

const w = scn.setup();
const n0 = w.elements.length;
const roster = new Map();
for (const e of w.elements) roster.set(e.Z, (roster.get(e.Z) || 0) + 1);

console.log(`■ 초기: 원자 ${n0}개  [${[...roster].map(([z, n]) => `${sym(z)}×${n}`).join(', ')}]`);
console.log(`■ ${TICKS}틱 굴림 (엔진+rule_0001~0004, 뷰어와 동일)\n`);

for (let i = 0; i < TICKS; i++) stepWorld(w, rules, params);

// 분류: 분자(공유, parts) / 이온(자유 원자 q≠0) / 비활성·미결합 자유 원자(q=0)
const molecules = new Map();   // 화학식 → 개수
const ions = new Map();        // 이온표기 → 개수
const free = new Map();        // 미결합 자유 원자 → 개수
let qsum = 0, msum = 0;
for (const e of w.elements) {
  qsum += e.q || 0; msum += e.m || 0;
  if (Array.isArray(e.parts) && e.parts.length > 1) {
    const f = formula(e.parts);
    molecules.set(f, (molecules.get(f) || 0) + 1);
  } else if ((e.q || 0) !== 0) {
    ions.set(ionLabel(e), (ions.get(e) ? ions.get(e) : 0) + 0);  // placeholder
    ions.set(ionLabel(e), (ions.get(ionLabel(e)) || 0) + 1);
  } else {
    free.set(sym(e.Z), (free.get(sym(e.Z)) || 0) + 1);
  }
}

const tally = (title, map) => {
  const ent = [...map].sort((a, b) => b[1] - a[1]);
  console.log(`${title} (${ent.reduce((s, [, n]) => s + n, 0)}):`);
  console.log('  ' + (ent.length ? ent.map(([k, n]) => `${k}×${n}`).join(', ') : '—'));
};

console.log(`■ 결과: ${n0} → ${w.elements.length} 개체\n`);
tally('▸ 분자 (공유 결합 — 정확한 조성)', molecules);
tally('▸ 이온 (전자 주고받음 — 전자기력에 묶임)', ions);
tally('▸ 자유 원자 (미결합 — 비활성 Ne 포함)', free);
console.log(`\n■ 보존 점검: Σ질량=${msum} (초기와 동일해야), Σ전하=${qsum} (0 이어야)`);
