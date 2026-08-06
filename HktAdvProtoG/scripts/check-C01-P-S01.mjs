// C01-P-S01 Step Gate 점검 + Lab 산출 + 완료 증거 생성.
// 사용: node scripts/check-C01-P-S01.mjs   (HktAdvProtoG/ 루트에서)
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { evaluateDependencies } from '../packages/dependencies/src/dependencyGraph.js';
import { buildC01DependencyGraph, C01_SUPPLIES } from '../packages/dependencies/src/c01Dependencies.js';
import { buildBaseScene, buildSituationScene } from '../packages/dependencies/src/c01Scenes.js';
import { planAll, expandCandidates, validateCatalog } from '../packages/possibilities/src/possibilityGraph.js';
import { C01_STRATEGIES } from '../packages/possibilities/src/c01Strategies.js';
import { buildEvidence, writeEvidence } from '../packages/verification/src/evidence.js';

const root = fileURLToPath(new URL('..', import.meta.url));
const cycleSpec = JSON.parse(readFileSync(`${root}/cycles/C01-border-canyon/CYCLE.json`, 'utf8'));
const results = [];
const check = (name, fn) => {
  try { results.push({ name, passed: true, detail: fn() }); }
  catch (e) { results.push({ name, passed: false, detail: e.message }); }
};

const byArchetype = (scene, a) => Object.values(scene.state.subjects).find((s) => s.archetype === a);
/** 압력 → 목적 → 전략 → 행동 계획 사슬을 사람이 읽을 형태로 (Lab 입력) */
const report = (scene, label) => {
  const evaluation = evaluateDependencies(buildC01DependencyGraph(scene), C01_SUPPLIES, scene);
  const { plans, hash } = planAll({ catalog: C01_STRATEGIES, ctx: scene, evaluation });
  return { label, hash, plans: plans.filter((p) => p.goal.kind) };
};
const apexScene = ({ herd, injury }) => {
  const scene = buildBaseScene();
  byArchetype(scene, 'herd-beast').population.count = herd;
  byArchetype(scene, 'apex-monster').attrs.injury = injury;
  return scene;
};
const planFor = (scene, archetype) =>
  report(scene, 'x').plans.find((p) => p.subject === byArchetype(scene, archetype).id);

check('전략 카탈로그 정합 (모든 전략에 수행 주체·원자 보유)', () => {
  const subjects = Object.values(buildBaseScene().state.subjects);
  const errors = validateCatalog(C01_STRATEGIES, subjects);
  if (errors.length) throw new Error(errors.join(' | '));
  const kinds = new Set(C01_STRATEGIES.map((s) => s.kind));
  return `전략 ${C01_STRATEGIES.length}건, 의존 계열 ${kinds.size}종 전부 대응`;
});

check('SC-C01-P4-01 조달 경로가 먹이량·위험 비용에서 계산', () => {
  const thick = planFor(apexScene({ herd: 6, injury: 5 }), 'apex-monster');
  const thin = planFor(apexScene({ herd: 1, injury: 5 }), 'apex-monster');
  if (thick.chosen.id !== 'P-HUNT-HERD') throw new Error(`무리 두터움 → ${thick.chosen.id}`);
  if (thin.chosen.id !== 'P-RAID-PASTURE') throw new Error(`무리 얇음 → ${thin.chosen.id}`);
  return `무리6 → ${thick.chosen.id}(${thick.chosen.score.toFixed(2)}) / 무리1 → ${thin.chosen.id}(${thin.chosen.score.toFixed(2)})`;
});

check('SC-C01-P-02 같은 계열이라도 원형마다 다른 전략', () => {
  const scene = buildBaseScene();
  const sets = ['apex-monster', 'herd-beast', 'villager'].map((a) =>
    [a, expandCandidates(C01_STRATEGIES, byArchetype(scene, a), 'prey').map((s) => s.id)]);
  const all = sets.flatMap(([, ids]) => ids);
  if (new Set(all).size !== all.length) throw new Error(`전략 중복: ${all.join(',')}`);
  return sets.map(([a, ids]) => `${a}[${ids.join(',')}]`).join(' ');
});

check('ST-C01-01 에 복수 해결 경로 (토벌·유인·먹이 회복·방어)', () => {
  const scene = buildSituationScene('ST-C01-01');
  const guild = byArchetype(scene, 'hunters-guild');
  const hunter = Object.values(scene.state.subjects).find((s) => s.role === 'hunter');
  const villager = byArchetype(scene, 'villager');
  const families = new Set([
    ...expandCandidates(C01_STRATEGIES, guild, 'safety'),
    ...expandCandidates(C01_STRATEGIES, hunter, 'reputation'),
    ...expandCandidates(C01_STRATEGIES, villager, 'safety'),
  ].map((s) => s.interventionFamily).filter(Boolean));
  for (const f of ['subjugate', 'lure-away-with-bait', 'restore-prey-base', 'defend-pasture'])
    if (!families.has(f)) throw new Error(`개입군 누락: ${f} (있는 것: ${[...families].join(',')})`);
  return [...families].sort().join(', ');
});

check('압력 → 목적 → 전략 → 행동 계획 사슬 (Situation 별 산출)', () => {
  const dir = `${root}/apps/lab`;
  mkdirSync(dir, { recursive: true });
  const lines = [];
  for (const st of cycleSpec.situations) {
    const r = report(buildSituationScene(st.id), st.id);
    writeFileSync(`${dir}/sample-plans-${st.id}.json`, JSON.stringify(r, null, 2) + '\n');
    lines.push(`${st.id}:${r.plans.length}건`);
  }
  writeFileSync(`${dir}/sample-plans-apex-thin.json`, JSON.stringify(report(apexScene({ herd: 1, injury: 5 }), 'apex-thin'), null, 2) + '\n');
  writeFileSync(`${dir}/sample-plans-apex-thick.json`, JSON.stringify(report(apexScene({ herd: 6, injury: 5 }), 'apex-thick'), null, 2) + '\n');
  return `${lines.join(' ')} + apex-thin/thick 대조`;
});

check('결정성 (같은 상태 → 같은 계획 해시)', () => {
  const a = report(buildSituationScene('ST-C01-01'), 'a').hash;
  const b = report(buildSituationScene('ST-C01-01'), 'b').hash;
  if (a !== b) throw new Error('계획 해시 불일치');
  return `planHash=${a}`;
});

for (const r of results) console.log(`${r.passed ? 'PASS' : 'FAIL'}  ${r.name} — ${r.detail}`);
const failed = results.filter((r) => !r.passed).length;
if (!failed) {
  writeEvidence(`${root}/cycles/C01-border-canyon/evidence/C01-P-S01.json`, buildEvidence({
    step: 'C01-P-S01',
    status: 'STEP_VERIFIED_LOCAL',
    results: {
      strategyCount: C01_STRATEGIES.length,
      st01PlanHash: report(buildSituationScene('ST-C01-01'), 'x').hash,
      checks: results,
    },
    artifacts: ['packages/possibilities/src/possibilityGraph.js', 'packages/possibilities/src/c01Strategies.js'],
    limitations: [
      '균형 장면에서는 결핍이 없어 목적이 활성화되지 않는다 — 항상적 유지 행동은 C 계층 기저 행동으로 다룬다',
      '전략 이득은 요구 대비 단일 tick 추정 — 다단계 계획·연쇄 효과는 E/G 에서',
      '조절 계약은 여유가 막 마르기 시작할 때 점수가 음수다 — 이득 > 0 이라 선택은 되지만 "달리 방법이 없어서"에 가깝다. 과잉이 깊어지면 이득이 커져 점수가 양수로 돌아선다 (I-2)',
      '선택은 점수 최대 1개 — 동시 다중 전략·파티 분업은 E1/E2 에서',
    ],
  }));
  console.log('evidence → cycles/C01-border-canyon/evidence/C01-P-S01.json');
}
console.log(`\n점검 ${results.length}항 중 ${results.length - failed}항 통과`);
process.exit(failed ? 1 : 0);
