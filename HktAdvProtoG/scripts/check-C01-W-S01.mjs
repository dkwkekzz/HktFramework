// C01-W-S01 Step Gate 점검 + Lab 산출 + 완료 증거 생성.
// 사용: node scripts/check-C01-W-S01.mjs   (HktAdvProtoG/ 루트에서)
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { proposeChange, validateWorld, mergeRequirements, normalizeRequirements } from '../packages/world-compiler/src/worldCompiler.js';
import { compileC01World, previewWorld, toWorldState } from '../packages/world-compiler/src/c01World.js';
import { buildC01RequirementGraph } from '../packages/world-requirements/src/c01Requirements.js';
import { C01_STRATEGIES } from '../packages/possibilities/src/c01Strategies.js';
import { AxiomRegistry } from '../packages/ontology/src/axioms.js';
import { registerC01Axioms } from '../packages/ontology/src/c01Axioms.js';
import { defineC01Ontology } from '../packages/ontology/src/c01Ontology.js';
import { createInitialWorldState, validateWorldState } from '../packages/ontology/src/worldOntology.js';
import { buildBaseScene } from '../packages/dependencies/src/c01Scenes.js';
import { buildEvidence, writeEvidence } from '../packages/verification/src/evidence.js';

const root = fileURLToPath(new URL('..', import.meta.url));
const graph = buildC01RequirementGraph(C01_STRATEGIES);
const world = compileC01World({ requirementGraph: graph, seed: 11 });
const results = [];
const check = (name, fn) => {
  try { results.push({ name, passed: true, detail: fn() }); }
  catch (e) { results.push({ name, passed: false, detail: e.message }); }
};

check('SC-C01-W1-01 다중 주체 요구가 하나의 사냥터로 병합', () => {
  const merged = mergeRequirements(normalizeRequirements(graph));
  const keys = merged.map((m) => `${m.kind}:${m.ref}`);
  if (new Set(keys).size !== keys.length) throw new Error('병합 후에도 중복 요소가 남음');
  const missing = ['villager', 'hunters-guild', 'merchant', 'herd-beast', 'apex-monster', 'resource-colony']
    .filter((a) => !merged.some((m) => m.actors.includes(a)));
  if (missing.length) throw new Error(`요구가 반영되지 않은 주체: ${missing.join(',')}`);
  const pasture = world.provenance('space', 'village-pasture');
  return `요구 ${graph.requirements.length}건 → 세계 요소 ${merged.length}종, 목장은 ${pasture.actors.join('·')} 가 함께 부름`;
});

check('완료 조건 — 장소·경로가 요구 근거와 함께 미리보기에 표시', () => {
  const preview = previewWorld(world);
  const places = preview.rows.filter((r) => r.kind === 'place');
  const routes = preview.rows.filter((r) => r.kind === 'route');
  for (const row of places)
    if (!row.requirements.length || !row.calledBy.length) throw new Error(`${row.element} 근거 없음`);
  return `장소 ${places.length}종(전부 근거 보유), 경로 ${routes.filter((r) => r.state !== 'latent').length}종 실체화 + ${routes.filter((r) => r.state === 'latent').length}종 잠재`;
});

check('완료 조건 — 초기 상태가 압축 역사로 설명 (W5)', () => {
  if (!world.history.length) throw new Error('압축 역사 없음');
  for (const h of world.history) if (!h.causes.length || !h.effects.length) throw new Error(`${h.id} 원인·결과 누락`);
  return world.history.map((h) => `${h.id}(t${h.tick})`).join(' ');
});

check('근거 없는 세계 요소 없음 (lint)', () => {
  const errors = validateWorld(world);
  if (errors.length) throw new Error(errors.join(' | '));
  return `장소${Object.keys(world.places).length} 경로${Object.keys(world.routes).length} 규칙${Object.keys(world.rules).length} 자원${Object.keys(world.resources).length} 전부 근거 보유`;
});

check('SC-C01-W-02/W-03 공리 위반·관찰 소급 변경 거부', () => {
  const w = compileC01World({ requirementGraph: graph, seed: 11 });
  w.markObserved(['region.places.apex-lair.position']);
  const before = w.hash();
  const rejected = proposeChange(w, {
    modifies: ['region.places.apex-lair.position'],
    creates: [{ kind: 'space', ref: 'apex-lair', attrs: { position: { x: 0, y: 0 } } }],
  }, registerC01Axioms(new AxiomRegistry()));
  if (rejected.accepted) throw new Error('관찰 요소 소급 변경이 통과됨');
  if (w.hash() !== before) throw new Error('거부된 제안이 세계를 바꿈');
  const accepted = proposeChange(w, {
    modifies: ['region.places.marsh-colony.density'],
    creates: [{ kind: 'space', ref: 'marsh-colony', attrs: { density: 3 } }],
  }, registerC01Axioms(new AxiomRegistry()));
  if (!accepted.accepted) throw new Error('관찰되지 않은 변경이 거부됨');
  return `거부 사유 ${rejected.report.violations[0].violationCode}, 미관찰 변경은 통과`;
});

check('W6 요소 분류 (잠재/정식/관찰)', () => {
  const w = compileC01World({ requirementGraph: graph, seed: 11 });
  if (w.classify('space', 'hunting-trail') !== 'latent') throw new Error('불리지 않은 경로가 잠재가 아님');
  if (w.classify('space', 'herd-valley') !== 'canonical') throw new Error('실체화된 장소가 정식이 아님');
  w.markObserved(['region.places.herd-valley.position']);
  if (w.classify('space', 'herd-valley') !== 'observed') throw new Error('관찰 후에도 정식으로 남음');
  return 'hunting-trail=latent, herd-valley=canonical→observed';
});

check('상태 스키마 전개 + 장면이 W 를 실제로 소비 (Handoff)', () => {
  const ontology = defineC01Ontology();
  const state = toWorldState(world, createInitialWorldState(ontology));
  const errors = validateWorldState(state, ontology);
  if (errors.length) throw new Error(errors.join(' | '));
  const scene = buildBaseScene();
  if (!scene.world) throw new Error('장면이 정식 세계를 들고 있지 않음');
  for (const id of Object.keys(scene.world.places))
    if (JSON.stringify(scene.state.region.places[id].position) !== JSON.stringify(scene.world.places[id].position))
      throw new Error(`${id} 배치가 W 출력과 다름`);
  return '장면의 지형·재고가 전부 W 산출과 일치';
});

check('결정성 + Lab 산출', () => {
  const a = compileC01World({ requirementGraph: graph, seed: 11 }).hash();
  const b = compileC01World({ requirementGraph: graph, seed: 11 }).hash();
  if (a !== b) throw new Error('같은 시드가 다른 세계를 냄');
  if (a === compileC01World({ requirementGraph: graph, seed: 12 }).hash()) throw new Error('시드가 세계를 바꾸지 않음');
  const dir = `${root}/apps/lab`;
  mkdirSync(dir, { recursive: true });
  writeFileSync(`${dir}/sample-world.json`, JSON.stringify({ label: 'C01 canonical world', worldHash: a, ...previewWorld(world) }, null, 2) + '\n');
  return `worldHash=${a}, apps/lab/sample-world.json`;
});

for (const r of results) console.log(`${r.passed ? 'PASS' : 'FAIL'}  ${r.name} — ${r.detail}`);
const failed = results.filter((r) => !r.passed).length;
if (!failed) {
  writeEvidence(`${root}/cycles/C01-border-canyon/evidence/C01-W-S01.json`, buildEvidence({
    step: 'C01-W-S01',
    status: 'STEP_VERIFIED_LOCAL',
    results: {
      worldHash: world.hash(),
      places: Object.keys(world.places),
      routes: Object.keys(world.routes),
      rules: Object.keys(world.rules),
      historyCount: world.history.length,
      checks: results,
    },
    artifacts: ['packages/world-compiler/src/worldCompiler.js', 'packages/world-compiler/src/c01World.js'],
    limitations: [
      'hunting-trail 은 요구에서 불리지 않아 잠재로 남는다 — 사냥로를 부르는 전략이 생기면 실체화된다',
      '공간 배치는 구역+시드 지터의 2D 좌표 — 지형·고저·가시성은 X 계층에서',
      '실체화표(장소 청사진·산출·규칙)는 손으로 적은 것 — 요구에서 불린 항목만 쓰이지만 수치 자체는 설계값',
      '압축 역사는 5건의 고정 서술 — 시드별 변주·주체별 기억은 R5 이후',
    ],
  }));
  console.log('evidence → cycles/C01-border-canyon/evidence/C01-W-S01.json');
}
console.log(`\n점검 ${results.length}항 중 ${results.length - failed}항 통과`);
process.exit(failed ? 1 : 0);
