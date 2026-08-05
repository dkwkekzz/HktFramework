// 구간 2 (전략과 세계 생성) 묶음 검증 — P-S01·Q-S01·W-S01.
// 개별 Step 점검(check-C01-*.mjs)이 "그 Step 이 자기 주장을 지키는가"를 본다면,
// 이 스크립트는 "구간 전체가 재현되는가 · 모듈이 정말 앞 모듈 산출로 굴러가는가"를 본다.
//   ① 동결 해시 대조 — 커밋된 증거의 해시를 재계산으로 맞춘다 (주장이 아니라 재현)
//   ② Handoff 반사실 — 앞 모듈 입력을 바꾸면 뒤 모듈 산출이 실제로 바뀐다 (하드코딩 우회 탐지)
//   ③ 결정성 — 같은 시드 반복 동일, 다른 시드는 구조 동일·좌표만 상이
// 사용: node scripts/check-segment-2.mjs   (HktAdvProtoG/ 루트에서)
import { fileURLToPath } from 'node:url';
import { defineC01Ontology } from '../packages/ontology/src/c01Ontology.js';
import { AxiomRegistry } from '../packages/ontology/src/axioms.js';
import { registerC01Axioms } from '../packages/ontology/src/c01Axioms.js';
import { createC01Cast } from '../packages/subjects/src/c01Subjects.js';
import { evaluateDependencies } from '../packages/dependencies/src/dependencyGraph.js';
import { buildC01DependencyGraph, C01_SUPPLIES } from '../packages/dependencies/src/c01Dependencies.js';
import { buildBaseScene, buildSituationScene } from '../packages/dependencies/src/c01Scenes.js';
import { planAll } from '../packages/possibilities/src/possibilityGraph.js';
import { C01_STRATEGIES } from '../packages/possibilities/src/c01Strategies.js';
import { buildC01RequirementGraph } from '../packages/world-requirements/src/c01Requirements.js';
import { compileC01World } from '../packages/world-compiler/src/c01World.js';
import { buildPhenomenonCatalog } from '../packages/runtime/src/phenomena.js';
import { buildEvidence, writeEvidence } from '../packages/verification/src/evidence.js';

const root = fileURLToPath(new URL('..', import.meta.url));

/**
 * 동결 해시 — 구간 1·2 가 닫힌 시점의 값. 이 값이 흔들리면 상류 모듈이 조용히 바뀐 것이다.
 * 의도한 변경이라면 그 Step 의 증거를 갱신한 뒤 여기도 함께 고친다 (그 자체가 리뷰 지점).
 */
const FROZEN = {
  // C01-O-S01 공리 레지스트리. I-5 로 보존 공리가 비용 어휘를 넓히며 갱신됐다
  // (재고만 → 재고·산지 산출·개체군, 그리고 실제 상태 변화로 재는 뒷받침 검사)
  registryHash: 'e37e07f09095f7a6',
  ontologyHash: 'ad1590bf20bcaffb',   // C01-O-S02 존재론
  castHash: '44b0b0ce93d081f1',       // C01-S-S01 표준 배역 (시드 11)
  // C01-D-S01 기준 장면 압력. 두 번 갱신됐다 —
  //   bce1764b284c89db → 0b7ba374ba3c41e7  W-S01 에서 장면이 W 산출을 소비 (STATE.md 기록 누락, I-4)
  //   0b7ba374ba3c41e7 → 48dd56b636f4ba9f  I-2 로 조합의 hunt-order 의존이 추가됨
  pressureHash: '48dd56b636f4ba9f',
  // C01-P-S01 ST-01 행동 계획. I-2 를 거치고도 불변 — 무리 붕괴 장면의 판단은 그대로다
  planHash: 'c9259bbfcdda3de8',
  // C01-Q-S01 세계 요구 그래프. I-2 에서 P-CULL-CONTRACT 의 대상이
  // village-safety → herd-valley-forage 로 바뀌며 근거 사슬이 옮겨졌다
  requirementHash: '6b48208894d77879',
  // C01-W-S01 정식 세계 (시드 11). I-5 에서 장소가 산지 산출(yields)을 싣게 되며 갱신됐다 —
  // 땅이 낼 수 있는 양이 세계 상태에 없으면 채집이 무엇을 덜어내는지 말할 수 없다
  worldHash: '0841d01ae8668d58',
};

const results = [];
const check = (name, fn) => {
  try { results.push({ name, passed: true, detail: fn() }); }
  catch (e) { results.push({ name, passed: false, detail: e.message }); }
};
const eq = (label, actual, expected) => {
  if (actual !== expected) throw new Error(`${label} 불일치 — 기대 ${expected} / 실제 ${actual}`);
};

const ontology = defineC01Ontology();
const evaluationOf = (scene) => evaluateDependencies(buildC01DependencyGraph(scene), C01_SUPPLIES, scene);
/** 동결 planHash 의 출처와 같은 장면 — ST-C01-01 (굶주린 포식 마물이 목장으로 접근) */
const st01Scene = () => buildSituationScene('ST-C01-01');

const requirementGraph = buildC01RequirementGraph(C01_STRATEGIES);

// ① 동결 해시 대조 — 구간 1 상류부터 구간 2 산출까지 한 줄로 재현한다
check('동결 해시 재현 — 공리·존재론·배역·압력 (구간 1 상류)', () => {
  const axioms = new AxiomRegistry();
  registerC01Axioms(axioms);
  eq('registryHash', axioms.snapshot().hash, FROZEN.registryHash);
  eq('ontologyHash', ontology.snapshot().hash, FROZEN.ontologyHash);
  eq('castHash', createC01Cast(11, ontology).castHash, FROZEN.castHash);
  eq('pressureHash', evaluationOf(buildBaseScene()).hash, FROZEN.pressureHash);
  return `registry=${FROZEN.registryHash} ontology=${FROZEN.ontologyHash} cast=${FROZEN.castHash} pressure=${FROZEN.pressureHash}`;
});

check('동결 해시 재현 — 계획·요구·세계 (구간 2 산출)', () => {
  const scene = st01Scene();
  eq('planHash', planAll({ catalog: C01_STRATEGIES, ctx: scene, evaluation: evaluationOf(scene) }).hash, FROZEN.planHash);
  eq('requirementHash', requirementGraph.hash, FROZEN.requirementHash);
  eq('worldHash', compileC01World({ requirementGraph, seed: 11 }).hash(), FROZEN.worldHash);
  return `plan=${FROZEN.planHash} requirement=${FROZEN.requirementHash} world=${FROZEN.worldHash}`;
});

// ② Handoff 반사실 — 앞 모듈 산출을 바꿨는데 뒤 모듈이 그대로면 그 경로는 가짜다
check('Handoff D→P — 압력이 없으면 목적도 없다 (P 가 D 산출을 실제로 읽는다)', () => {
  const balanced = buildBaseScene();
  const goalsAtBalance = planAll({ catalog: C01_STRATEGIES, ctx: balanced, evaluation: evaluationOf(balanced) })
    .plans.filter((p) => p.goal.kind);
  const stressed = st01Scene();
  const goalsAtStress = planAll({ catalog: C01_STRATEGIES, ctx: stressed, evaluation: evaluationOf(stressed) })
    .plans.filter((p) => p.goal.kind);
  if (goalsAtBalance.length) throw new Error(`균형 장면에 목적 ${goalsAtBalance.length}건 — 압력 없이 목적이 생겼다`);
  if (!goalsAtStress.length) throw new Error('압력 장면에 목적 0건 — P 가 D 산출을 읽지 않는다');
  return `균형 목적 0건 → 압력 목적 ${goalsAtStress.length}건 (${goalsAtStress.map((p) => p.goal.kind).join(',')})`;
});

check('Handoff P→Q — 전략을 줄이면 요구도 줄어든다 (Q 가 P 카탈로그를 실제로 읽는다)', () => {
  const full = new Set(requirementGraph.requirements.map((r) => r.id));
  const one = C01_STRATEGIES.find((s) => s.id === 'P-RAID-PASTURE');
  if (!one) throw new Error('기준 전략 P-RAID-PASTURE 없음');
  const partial = buildC01RequirementGraph([one]);
  const partialIds = partial.requirements.map((r) => r.id);
  if (!partialIds.length) throw new Error('전략 1건에서 요구가 나오지 않는다');
  if (partialIds.length >= full.size) throw new Error(`부분 카탈로그 요구 ${partialIds.length}건 ≥ 전체 ${full.size}건`);
  const outside = partialIds.filter((id) => !full.has(id));
  if (outside.length) throw new Error(`전체에 없는 요구가 나왔다: ${outside.join(',')}`);
  return `전략 30건 → 요구 ${full.size}건 / 전략 1건(P-RAID-PASTURE) → 요구 ${partialIds.length}건 (${partialIds.join(',')})`;
});

check('Handoff Q→W — 요구가 없으면 세계도 없다 (청사진 하드코딩 우회 없음)', () => {
  const empty = compileC01World({ requirementGraph: { requirements: [], outcomes: [] }, seed: 11 });
  const leaked = [
    ...Object.keys(empty.places).map((k) => `place/${k}`),
    ...Object.keys(empty.routes).map((k) => `route/${k}`),
    ...Object.keys(empty.rules).map((k) => `rule/${k}`),
    ...Object.keys(empty.resources).map((k) => `resource/${k}`),
  ];
  if (leaked.length) throw new Error(`요구 없이 실체화된 요소: ${leaked.join(',')}`);
  if (empty.history.length) throw new Error(`요구 없이 남은 압축 역사: ${empty.history.length}건`);
  const real = compileC01World({ requirementGraph, seed: 11 });
  return `요구 0건 → 세계 요소 0종·역사 0건 / 요구 ${requirementGraph.requirements.length}건 → 장소 ${Object.keys(real.places).length}·경로 ${Object.keys(real.routes).length}·규칙 ${Object.keys(real.rules).length}·자원 ${Object.keys(real.resources).length}`;
});

check('미소비 출력 없음 — Q 의 성공 결과가 R 의 현상으로 소비된다 (I-3)', () => {
  const catalog = buildPhenomenonCatalog(requirementGraph);
  const fromQ = [...new Set(requirementGraph.outcomes.map((o) => o.behavior))].sort();
  const consumed = catalog.entries.map((e) => e.behavior).sort();
  const missing = fromQ.filter((b) => !consumed.includes(b));
  if (missing.length) throw new Error(`R 이 소비하지 않는 Q 행동: ${missing.join(',')}`);
  const dead = consumed.filter((b) => !fromQ.includes(b));
  if (dead.length) throw new Error(`Q 가 내지 않은 현상: ${dead.join(',')}`);
  return `성공 결과 ${requirementGraph.outcomes.length}건 → 행동 ${consumed.length}종이 전부 현상으로 소비됨 (미소비 0)`;
});

// ③ 결정성 — 시드는 좌표 지터에만 쓰이고 구조는 요구에서 나온다
check('결정성 — 같은 시드 반복 동일, 다른 시드는 구조 동일·해시 상이', () => {
  const a = compileC01World({ requirementGraph, seed: 11 });
  const b = compileC01World({ requirementGraph, seed: 11 });
  if (a.hash() !== b.hash()) throw new Error(`같은 시드에서 해시 상이: ${a.hash()} vs ${b.hash()}`);
  const shape = (w) => `${Object.keys(w.places).length}/${Object.keys(w.routes).length}/${Object.keys(w.rules).length}`;
  const seen = new Map();
  for (const seed of [7, 11, 42, 99]) {
    const w = compileC01World({ requirementGraph, seed });
    if (shape(w) !== shape(a)) throw new Error(`시드 ${seed} 에서 세계 구조가 달라짐: ${shape(w)} != ${shape(a)}`);
    seen.set(seed, w.hash());
  }
  if (new Set(seen.values()).size !== seen.size) throw new Error('서로 다른 시드가 같은 해시 — 시드가 반영되지 않는다');
  return `구조 ${shape(a)} 고정, 시드별 해시 ${[...seen].map(([s, h]) => `${s}:${h.slice(0, 8)}`).join(' ')}`;
});

const passed = results.filter((r) => r.passed).length;
for (const r of results) console.log(`${r.passed ? 'PASS' : 'FAIL'}  ${r.name} — ${r.detail}`);
console.log(`\n구간 2 묶음 검증 ${results.length}항 중 ${passed}항 통과`);

const evidence = buildEvidence({
  step: 'C01-SEGMENT-2',
  status: passed === results.length ? 'SEGMENT_VERIFIED_LOCAL' : 'SEGMENT_FAILED',
  results: { frozen: FROZEN, checks: results },
  artifacts: [
    'packages/possibilities/src/c01Strategies.js',
    'packages/world-requirements/src/c01Requirements.js',
    'packages/world-compiler/src/c01World.js',
    'scripts/check-segment-2.mjs',
  ],
  limitations: [
    'Q 의 성공 결과는 R-S01 의 현상 카탈로그가 소비한다 (I-3 닫힘) — 다만 아직 아무도 그 현상을 지각하지 않는다 (R-S02)',
    '구간 2 의 플레이어 가시 기여는 아직 간접이다 — 실제 표면은 X 계층(구간 5)에서 확인된다',
    '동결 해시는 시드 11 기준 — 다른 시드는 구조만 검사하고 값은 고정하지 않는다',
  ],
});
writeEvidence(`${root}/cycles/C01-border-canyon/evidence/C01-SEGMENT-2.json`, evidence);
console.log('evidence → cycles/C01-border-canyon/evidence/C01-SEGMENT-2.json');
if (passed !== results.length) process.exit(1);
