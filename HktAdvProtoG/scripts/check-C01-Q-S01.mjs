// C01-Q-S01 Step Gate 점검 + Lab 산출 + 완료 증거 생성.
// 사용: node scripts/check-C01-Q-S01.mjs   (HktAdvProtoG/ 루트에서)
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { validateRequirementGraph, scoreRequirements, explainRequirement } from '../packages/world-requirements/src/requirementGraph.js';
import { buildC01RequirementGraph, C01_PLACE_REQUIREMENT_IDS } from '../packages/world-requirements/src/c01Requirements.js';
import { C01_STRATEGIES } from '../packages/possibilities/src/c01Strategies.js';
import { defineC01Ontology } from '../packages/ontology/src/c01Ontology.js';
import { stockableIds } from '../packages/ontology/src/worldOntology.js';
import { buildBaseScene, buildSituationScene } from '../packages/dependencies/src/c01Scenes.js';
import { buildC01DependencyGraph, C01_SUPPLIES } from '../packages/dependencies/src/c01Dependencies.js';
import { evaluateDependencies } from '../packages/dependencies/src/dependencyGraph.js';
import { buildEvidence, writeEvidence } from '../packages/verification/src/evidence.js';

const root = fileURLToPath(new URL('..', import.meta.url));
const cycleSpec = JSON.parse(readFileSync(`${root}/cycles/C01-border-canyon/CYCLE.json`, 'utf8'));
const trace = JSON.parse(readFileSync(`${root}/cycles/C01-border-canyon/TRACE.graph.json`, 'utf8'));
const graph = buildC01RequirementGraph(C01_STRATEGIES);
const ontology = defineC01Ontology();
const results = [];
const check = (name, fn) => {
  try { results.push({ name, passed: true, detail: fn() }); }
  catch (e) { results.push({ name, passed: false, detail: e.message }); }
};

const scored = (scene) => scoreRequirements(graph, {
  evaluation: evaluateDependencies(buildC01DependencyGraph(scene), C01_SUPPLIES, scene),
  subjects: scene.state.subjects,
});

check('SC-C01-Q-01 모든 요구가 전략·의존 근거 보유 (미근거 = 오류)', () => {
  const errors = validateRequirementGraph(graph, C01_STRATEGIES);
  if (errors.length) throw new Error(errors.join(' | '));
  const byKind = {};
  for (const r of graph.requirements) byKind[r.kind] = (byKind[r.kind] ?? 0) + 1;
  return `요구 ${graph.requirements.length}건 (${Object.entries(byKind).map(([k, v]) => `${k}${v}`).join(' ')}), 성공 결과 ${graph.outcomes.length}건`;
});

check('완료 조건 — TRACE 요구 노드가 전부 Q 출력에 존재', () => {
  const traceReqs = trace.nodes.filter((n) => n.layer === 'requirement').map((n) => n.id);
  const ids = new Set(graph.requirements.map((r) => r.id));
  const missing = traceReqs.filter((t) => !ids.has(t));
  if (missing.length) throw new Error(`미표현: ${missing.join(',')}`);
  return `TRACE 요구 ${traceReqs.length}건 일치 (Q 는 ${graph.requirements.length}건으로 더 상세)`;
});

check('요구가 존재론 어휘를 가리킨다 (Handoff: O-S02)', () => {
  const stock = new Set(stockableIds(ontology));
  const bad = [];
  for (const r of graph.requirements) {
    if (r.kind === 'space' && !(ontology.has('place', r.ref) || ontology.has('route', r.ref))) bad.push(`space/${r.ref}`);
    if (r.kind === 'resource' && !stock.has(r.ref)) bad.push(`resource/${r.ref}`);
  }
  if (bad.length) throw new Error(`존재론에 없는 요구 대상: ${bad.join(', ')}`);
  return '공간·자원 요구 전부 존재론 등록 어휘';
});

check('모든 장소가 요구에서 불린다 — 임의 배치 없음', () => {
  const referenced = new Set(graph.requirements.filter((r) => r.kind === 'space').map((r) => r.ref));
  const orphan = ontology.idsByKind('place').filter((p) => !referenced.has(p));
  if (orphan.length) throw new Error(`요구 근거 없는 장소: ${orphan.join(',')}`);
  const routes = ontology.idsByKind('route').filter((r) => referenced.has(r));
  return `장소 ${ontology.idsByKind('place').length}종 전부 근거 보유, 경로 ${routes.length}/${ontology.idsByKind('route').length}종`;
});

check('Q2 중요도가 세계 상태에서 온다 (균형 0 → 위기 상승)', () => {
  const base = scored(buildBaseScene());
  if (base.requirements.some((r) => r.importance > 0)) throw new Error('균형 장면에서 중요도 발생');
  const st01 = scored(buildSituationScene('ST-C01-01'));
  const top = st01.requirements.filter((r) => r.importance > 0).slice(0, 3);
  if (!top.length) throw new Error('ST-C01-01 에서 중요도가 오르지 않음');
  return top.map((r) => `${r.id}(${r.importance})`).join(' ');
});

check('Q3 근거 사슬 + Lab 산출', () => {
  const dir = `${root}/apps/lab`;
  mkdirSync(dir, { recursive: true });
  const withChains = (scene, label) => {
    const s = scored(scene);
    return {
      label,
      requirements: s.requirements.map((r) => ({ ...r, chains: explainRequirement(graph, r.id).chains })),
    };
  };
  writeFileSync(`${dir}/sample-requirements-base.json`, JSON.stringify(withChains(buildBaseScene(), 'base'), null, 2) + '\n');
  for (const st of cycleSpec.situations)
    writeFileSync(`${dir}/sample-requirements-${st.id}.json`, JSON.stringify(withChains(buildSituationScene(st.id), st.id), null, 2) + '\n');
  return `apps/lab/sample-requirements-{base,ST-C01-0*}.json — 예: ${explainRequirement(graph, 'REQ-pasture').chains[0]}`;
});

check('결정성 (같은 카탈로그 → 같은 요구 해시, 입력 순서 무관)', () => {
  const a = buildC01RequirementGraph(C01_STRATEGIES).hash;
  const b = buildC01RequirementGraph([...C01_STRATEGIES].reverse()).hash;
  if (a !== b) throw new Error('입력 순서가 결과를 바꾼다');
  return `requirementHash=${a}`;
});

for (const r of results) console.log(`${r.passed ? 'PASS' : 'FAIL'}  ${r.name} — ${r.detail}`);
const failed = results.filter((r) => !r.passed).length;
if (!failed) {
  writeEvidence(`${root}/cycles/C01-border-canyon/evidence/C01-Q-S01.json`, buildEvidence({
    step: 'C01-Q-S01',
    status: 'STEP_VERIFIED_LOCAL',
    results: {
      requirementCount: graph.requirements.length,
      outcomeCount: graph.outcomes.length,
      requirementHash: graph.hash,
      placeRequirementIds: Object.values(C01_PLACE_REQUIREMENT_IDS),
      checks: results,
    },
    artifacts: ['packages/world-requirements/src/requirementGraph.js', 'packages/world-requirements/src/c01Requirements.js'],
    limitations: [
      'hunting-trail 은 아직 어떤 전략도 부르지 않는다 — 사냥로의 공간 근거는 X 계층에서',
      '요구 매핑표(대상→장소·행동→규칙)는 손으로 적은 것 — A 계층이 후보를 낼 때 이 표가 검증 기준이 된다',
      '중요도는 현재 tick 압력의 합 — 장기 누적·역사 가중은 W5(압축 역사) 이후',
      'Q 는 요구만 낸다. 병합·실체화(어느 장소를 몇 개 놓을지)는 W 의 몫',
    ],
  }));
  console.log('evidence → cycles/C01-border-canyon/evidence/C01-Q-S01.json');
}
console.log(`\n점검 ${results.length}항 중 ${results.length - failed}항 통과`);
process.exit(failed ? 1 : 0);
