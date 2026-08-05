// C01-D-S01 Step Gate 점검 + Lab 산출 + 완료 증거 생성.
// 사용: node scripts/check-C01-D-S01.mjs   (HktAdvProtoG/ 루트에서)
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { evaluateDependencies, detectConflicts, validateDependencyGraph } from '../packages/dependencies/src/dependencyGraph.js';
import { buildC01DependencyGraph, C01_SUPPLIES } from '../packages/dependencies/src/c01Dependencies.js';
import { buildBaseScene, buildSituationScene, DEFAULT_SEED } from '../packages/dependencies/src/c01Scenes.js';
import { buildEvidence, writeEvidence } from '../packages/verification/src/evidence.js';

const root = fileURLToPath(new URL('..', import.meta.url));
const cycleSpec = JSON.parse(readFileSync(`${root}/cycles/C01-border-canyon/CYCLE.json`, 'utf8'));
const results = [];
const check = (name, fn) => {
  try { results.push({ name, passed: true, detail: fn() }); }
  catch (e) { results.push({ name, passed: false, detail: e.message }); }
};

const label = (scene, id) => {
  const s = scene.state.subjects[id];
  return s.role ? `${s.role}(플레이어)` : s.archetype;
};
/** Lab 이 읽는 형태로 압력·충돌에 사람이 읽을 이름을 붙인다 */
const report = (scene, name) => {
  const deps = buildC01DependencyGraph(scene);
  const ev = evaluateDependencies(deps, C01_SUPPLIES, scene);
  const conflicts = detectConflicts(deps, C01_SUPPLIES, scene);
  return {
    label: name,
    pressures: ev.pressures.map((p) => ({ ...p, holderLabel: label(scene, p.holder) })),
    conflicts: conflicts.map((c) => ({ ...c, claimants: c.claimants.map((x) => ({ ...x, holderLabel: label(scene, x.holder) })) })),
    byHolder: ev.byHolder,
    hash: ev.hash,
  };
};

let base, collapsed;
check('의존 그래프 정합 (모든 대상에 공급자)', () => {
  base = buildBaseScene();
  const errors = validateDependencyGraph(buildC01DependencyGraph(base), C01_SUPPLIES);
  if (errors.length) throw new Error(errors.join(' | '));
  return `의존 ${buildC01DependencyGraph(base).length}건, 대상 ${Object.keys(C01_SUPPLIES).length}종`;
});

check('기준 장면 균형 — 시드 1~25 전부 압력 0·충돌 0 (대조군, I-1 회귀)', () => {
  for (let seed = 1; seed <= 25; seed++) {
    const r = report(buildBaseScene(seed), `base-${seed}`);
    const max = Math.max(...Object.values(r.byHolder).map((h) => h.maxPressure));
    if (max !== 0) throw new Error(`seed ${seed} 기준 장면 압력 ${max}`);
    if (r.conflicts.length) throw new Error(`seed ${seed} 기준 장면 충돌 ${r.conflicts.map((c) => c.target).join(',')}`);
  }
  return `25 시드 균형, 기본 시드 pressureHash=${report(base, 'base').hash}`;
});

check('SC-C01-D4-01 상태 변화에 따른 압력 갱신 (무리 붕괴 → 포식 마물 먹이 압력)', () => {
  collapsed = buildBaseScene();
  Object.values(collapsed.state.subjects).find((s) => s.archetype === 'herd-beast').population.count = 0;
  const apexId = Object.values(base.state.subjects).find((s) => s.archetype === 'apex-monster').id;
  const b = report(base, 'base').byHolder[apexId];
  const a = report(collapsed, 'herd-collapsed').byHolder[apexId];
  if (!(a.kinds.prey > b.kinds.prey)) throw new Error('먹이 압력이 오르지 않음');
  if (a.dominant !== 'prey') throw new Error(`지배 결핍 ${a.dominant}`);
  return `apex prey 압력 ${b.kinds.prey.toFixed(2)} → ${a.kinds.prey.toFixed(2)}, dominant=${a.dominant}`;
});

check('I-2 조합의 사냥 질서(hunt-order)가 의존으로 표현 — 균형 0, 과잉에서 상승', () => {
  const lines = [];
  for (let seed = 1; seed <= 25; seed++) {
    const guildId = Object.values(buildBaseScene(seed).state.subjects).find((s) => s.archetype === 'hunters-guild').id;
    const balanced = report(buildBaseScene(seed), `base-${seed}`).byHolder[guildId].kinds.habitat ?? 0;
    if (balanced !== 0) throw new Error(`seed ${seed} 균형 장면인데 사냥 질서 압력 ${balanced}`);
    const over = report(buildSituationScene('ST-C01-02', seed), `over-${seed}`).byHolder[guildId];
    if (!(over.kinds.habitat > 0)) throw new Error(`seed ${seed} 무리 과잉인데 사냥 질서 압력 0`);
    if (over.dominant !== 'habitat') throw new Error(`seed ${seed} 조합의 지배 결핍 ${over.dominant}`);
    if (seed === DEFAULT_SEED) lines.push(`균형 0 → 과잉 ${over.kinds.habitat.toFixed(2)}(dominant=habitat)`);
  }
  // 목초 여유 경합이 무리 자체 경합에서 조합을 포함한 다자 경합으로 바뀐다
  const scene = buildSituationScene('ST-C01-02');
  const forage = report(scene, 'over').conflicts.find((c) => c.target === 'herd-valley-forage');
  if (!forage || forage.selfContention) throw new Error('목초 여유가 아직 무리 자체 경합이다 — 조합이 빠졌다');
  return `${lines[0]}, 목초 여유 ${forage.supply} 대 신청 ${forage.totalDemand} — ${forage.claimants.length}자 경합 (x25 시드)`;
});

check('구간 1 종료 조건 — 5개 Situation 의 경합 자원이 시드 1~25 전부에서 D5 충돌로 표현', () => {
  const lines = [];
  for (const st of cycleSpec.situations) {
    for (let seed = 1; seed <= 25; seed++) {
      const targets = report(buildSituationScene(st.id, seed), st.id).conflicts.map((c) => c.target);
      const missing = st.contestedResources.filter((t) => !targets.includes(t));
      if (missing.length) throw new Error(`seed ${seed} ${st.id} 미표현: ${missing.join(',')}`);
    }
    lines.push(`${st.id}[${st.contestedResources.join('+')}]`);
  }
  return `${lines.join(' ')} (x25 시드)`;
});

check('Lab 산출 (압력 전후 비교·장면별 충돌)', () => {
  const dir = `${root}/apps/lab`;
  mkdirSync(dir, { recursive: true });
  writeFileSync(`${dir}/sample-pressure.json`, JSON.stringify(report(base, 'base'), null, 2) + '\n');
  writeFileSync(`${dir}/sample-pressure-collapsed.json`, JSON.stringify(report(collapsed, 'herd-collapsed'), null, 2) + '\n');
  for (const st of cycleSpec.situations)
    writeFileSync(`${dir}/sample-conflicts-${st.id}.json`, JSON.stringify(report(buildSituationScene(st.id), st.id), null, 2) + '\n');
  return 'apps/lab/sample-pressure{,-collapsed}.json + 장면별 sample-conflicts-ST-C01-0*.json';
});

for (const r of results) console.log(`${r.passed ? 'PASS' : 'FAIL'}  ${r.name} — ${r.detail}`);
const failed = results.filter((r) => !r.passed).length;
if (!failed) {
  writeEvidence(`${root}/cycles/C01-border-canyon/evidence/C01-D-S01.json`, buildEvidence({
    step: 'C01-D-S01',
    status: 'STEP_VERIFIED_LOCAL',
    results: {
      dependencyCount: buildC01DependencyGraph(base).length,
      basePressureHash: report(base, 'base').hash,
      situationsCovered: cycleSpec.situations.map((s) => s.id),
      checks: results,
    },
    artifacts: [
      'packages/dependencies/src/dependencyGraph.js',
      'packages/dependencies/src/c01Dependencies.js',
      'packages/dependencies/src/c01Scenes.js',
    ],
    limitations: [
      '할당 우선순위는 의존 id 안정 정렬 — 누가 먼저 굶는지의 실제 경쟁 해소는 E3 의 몫',
      '공급 함수의 지형 상수(목초 수용력·둥지 산출)는 장면 데이터 — W 계층이 실체화하면 대체된다',
      'Situation 판정·발생은 E0 — D5 는 충돌 구조만 낸다',
      '장면 프리셋(c01Scenes)은 검증용 초기 조건 — 런타임 경로 아님',
    ],
  }));
  console.log('evidence → cycles/C01-border-canyon/evidence/C01-D-S01.json');
}
console.log(`\n점검 ${results.length}항 중 ${results.length - failed}항 통과`);
process.exit(failed ? 1 : 0);
