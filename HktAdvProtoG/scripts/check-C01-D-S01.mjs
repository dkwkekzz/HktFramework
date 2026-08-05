// C01-D-S01 Step Gate 점검 + Lab 산출 + 완료 증거 생성.
// 사용: node scripts/check-C01-D-S01.mjs   (HktAdvProtoG/ 루트에서)
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { evaluateDependencies, detectConflicts, validateDependencyGraph } from '../packages/dependencies/src/dependencyGraph.js';
import { buildC01DependencyGraph, C01_SUPPLIES } from '../packages/dependencies/src/c01Dependencies.js';
import { buildBaseScene, buildSituationScene } from '../packages/dependencies/src/c01Scenes.js';
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

check('기준 장면 균형 — 압력 0, 충돌 0 (대조군)', () => {
  const r = report(base, 'base');
  const max = Math.max(...Object.values(r.byHolder).map((h) => h.maxPressure));
  if (max !== 0) throw new Error(`기준 장면 압력 ${max}`);
  if (r.conflicts.length) throw new Error(`기준 장면 충돌 ${r.conflicts.map((c) => c.target).join(',')}`);
  return `pressureHash=${r.hash}`;
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

check('구간 1 종료 조건 — 5개 Situation 의 경합 자원이 전부 D5 충돌로 표현', () => {
  const lines = [];
  for (const st of cycleSpec.situations) {
    const scene = buildSituationScene(st.id);
    const targets = report(scene, st.id).conflicts.map((c) => c.target);
    const missing = st.contestedResources.filter((t) => !targets.includes(t));
    if (missing.length) throw new Error(`${st.id} 미표현: ${missing.join(',')}`);
    lines.push(`${st.id}[${st.contestedResources.join('+')}]`);
  }
  return lines.join(' ');
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
