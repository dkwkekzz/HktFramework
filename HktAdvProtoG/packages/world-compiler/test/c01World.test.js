import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeRequirements, mergeRequirements, proposeChange, validateWorld } from '../src/worldCompiler.js';
import { compileC01World, previewWorld, toWorldState, fitPopulationToWorld, FORAGE_SLACK } from '../src/c01World.js';
import { buildC01RequirementGraph } from '../../world-requirements/src/c01Requirements.js';
import { C01_STRATEGIES } from '../../possibilities/src/c01Strategies.js';
import { AxiomRegistry } from '../../ontology/src/axioms.js';
import { registerC01Axioms } from '../../ontology/src/c01Axioms.js';
import { defineC01Ontology } from '../../ontology/src/c01Ontology.js';
import { createInitialWorldState, validateWorldState } from '../../ontology/src/worldOntology.js';
import { createC01Cast } from '../../subjects/src/c01Subjects.js';
import { buildBaseScene } from '../../dependencies/src/c01Scenes.js';

const graph = buildC01RequirementGraph(C01_STRATEGIES);
const newWorld = (seed = 11) => compileC01World({ requirementGraph: graph, seed });
const axioms = () => registerC01Axioms(new AxiomRegistry());

test('SC-C01-W1-01: 여러 주체의 요구가 하나의 사냥터 구조로 병합된다', () => {
  const merged = mergeRequirements(normalizeRequirements(graph));
  // 같은 (종류, 대상) 요구는 하나로 합쳐진다 — 장소가 요구 수만큼 생기지 않는다
  const keys = merged.map((m) => `${m.kind}:${m.ref}`);
  assert.equal(new Set(keys).size, keys.length);

  const world = newWorld();
  assert.equal(Object.keys(world.places).length, 6, '장소 6종이 아님');
  for (const a of ['villager', 'hunters-guild', 'merchant', 'herd-beast', 'apex-monster', 'resource-colony'])
    assert.ok(merged.some((m) => m.actors.includes(a)), `${a} 의 요구가 세계에 반영되지 않음`);

  // 목장은 포식자와 주민이 함께 부른 하나의 장소다 (병합의 증거)
  const pasture = world.provenance('space', 'village-pasture');
  assert.ok(pasture.actors.includes('apex-monster') && pasture.actors.includes('villager'));
  assert.ok(pasture.calledBy.length >= 2);
});

test('완료 조건: 미리보기에 장소·경로가 요구 근거와 함께 나온다', () => {
  const preview = previewWorld(newWorld());
  const places = preview.rows.filter((r) => r.kind === 'place');
  assert.equal(places.length, 6);
  for (const row of places) {
    assert.ok(row.requirements.length > 0, `${row.element} 요구 근거 없음`);
    assert.ok(row.calledBy.length > 0, `${row.element} 호출 전략 없음`);
    assert.ok(row.actors.length > 0, `${row.element} 요구 주체 없음`);
    assert.ok(Number.isFinite(row.position.x) && Number.isFinite(row.position.y));
    assert.equal(row.state, 'canonical');
  }
  assert.ok(preview.rows.some((r) => r.kind === 'route' && r.connects?.length >= 2));
});

test('완료 조건: 초기 개체군 상태가 압축 역사로 설명된다 (W5)', () => {
  const world = newWorld();
  assert.ok(world.history.length >= 4);
  for (const h of world.history) {
    assert.ok(h.causes.length > 0, `${h.id} 원인 없음`);
    assert.ok(h.effects.length > 0, `${h.id} 결과 없음`);
    assert.ok(h.tick < 0, '압축 역사는 현재 이전이어야 한다');
  }
  // 무리가 왜 골짜기에 있는지, 포식자가 왜 그 안쪽에 있는지가 역사에 있다
  const text = world.history.map((h) => h.description).join(' ');
  assert.match(text, /무리/);
  assert.match(text, /포식 마물/);
  const herd = world.history.find((h) => h.effects.includes('region.places.herd-valley'));
  assert.ok(herd && herd.causes.includes('REQ-colony-site'), '무리 정착 역사가 군락 요구에서 나오지 않음');
});

test('근거 없는 세계 요소가 없다 — 임의 배치 금지 (lint)', () => {
  assert.deepEqual(validateWorld(newWorld()), []);
});

test('W6: 요구에서 불리지 않은 요소는 잠재로 남고 실체화되지 않는다', () => {
  const world = newWorld();
  assert.equal(world.classify('space', 'hunting-trail'), 'latent');
  assert.ok(!('hunting-trail' in world.routes), '잠재 요소가 실체화됨');
  assert.equal(world.classify('space', 'herd-valley'), 'canonical');
  assert.ok(previewWorld(world).rows.some((r) => r.element === 'hunting-trail' && r.state === 'latent'));
});

test('SC-C01-W-02: 공리를 위반하는 세계 제안은 거부된다', () => {
  const world = newWorld();
  world.markObserved(['region.places.apex-lair.position']);
  const before = world.hash();
  const { accepted, report } = proposeChange(world, {
    modifies: ['region.places.apex-lair.position'],
    creates: [{ kind: 'space', ref: 'apex-lair', attrs: { position: { x: 0.1, y: 0.1 } } }],
  }, axioms());
  assert.equal(accepted, false);
  assert.ok(report.violations.some((v) => v.violationCode === 'OBSERVED_RETROACTIVE_CHANGE'));
  assert.equal(world.hash(), before, '거부된 제안이 세계를 바꿨다');
});

test('SC-C01-W-03: 관찰되지 않은 요소의 변경은 통과하고 반영된다', () => {
  const world = newWorld();
  world.markObserved(['region.places.apex-lair.position']);
  const { accepted } = proposeChange(world, {
    modifies: ['region.places.marsh-colony.density'],
    creates: [{ kind: 'space', ref: 'marsh-colony', attrs: { density: 3 } }],
  }, axioms());
  assert.equal(accepted, true);
  assert.equal(world.places['marsh-colony'].density, 3);

  // 관찰한 뒤에는 같은 변경도 거부된다
  world.markObserved(['region.places.marsh-colony.density']);
  const second = proposeChange(world, {
    modifies: ['region.places.marsh-colony.density'],
    creates: [{ kind: 'space', ref: 'marsh-colony', attrs: { density: 9 } }],
  }, axioms());
  assert.equal(second.accepted, false);
  assert.equal(world.places['marsh-colony'].density, 3, '관찰 후 소급 변경이 반영됨');
});

test('개체군은 세계 용량 안에 들어간다 (W3·W4 → S 되먹임)', () => {
  const ontology = defineC01Ontology();
  const world = newWorld();
  const { subjects } = createC01Cast(11, ontology);
  fitPopulationToWorld(world, subjects);
  const herd = Object.values(subjects).find((s) => s.archetype === 'herd-beast');
  const capacity = world.places['herd-valley'].carryingCapacity;
  assert.ok(herd.population.count <= capacity - FORAGE_SLACK,
    `개체수 ${herd.population.count} 가 용량 ${capacity} − 여유 ${FORAGE_SLACK} 를 넘음`);
});

test('정식 세계가 상태 스키마로 펼쳐진다 (Handoff: O-S02 → R/X/N)', () => {
  const ontology = defineC01Ontology();
  const state = toWorldState(newWorld(), createInitialWorldState(ontology));
  assert.deepEqual(validateWorldState(state, ontology), []);
  assert.equal(Object.keys(state.region.places).length, 6);
  assert.ok(state.resources['healing-herb'] > 0 && state.resources.hide > 0);
});

test('장면이 W 출력을 실제로 소비한다 — 세계가 바뀌면 장면도 바뀐다 (Handoff)', () => {
  const scene = buildBaseScene();
  assert.ok(scene.world, '장면에 정식 세계가 없다');
  for (const id of Object.keys(scene.world.places))
    assert.deepEqual(scene.state.region.places[id].position, scene.world.places[id].position);
  assert.equal(scene.state.resources.hide, scene.world.resources.hide);
  // 시드가 다르면 배치도 달라진다 (좌표 하드코딩이 아님)
  const other = buildBaseScene(12);
  assert.notDeepEqual(other.state.region.places['apex-lair'].position, scene.state.region.places['apex-lair'].position);
});

test('같은 요구·시드 → 같은 세계 해시 (결정성)', () => {
  assert.equal(newWorld(11).hash(), newWorld(11).hash());
  assert.notEqual(newWorld(11).hash(), newWorld(12).hash());
});

test('요구 없는 세계는 비어 있다 — 요소는 요구에서만 나온다 (실패 경로)', () => {
  const empty = compileC01World({ requirementGraph: { requirements: [] }, seed: 11 });
  assert.deepEqual(Object.keys(empty.places), []);
  assert.deepEqual(Object.keys(empty.routes), []);
  assert.deepEqual(Object.keys(empty.rules), []);
  assert.deepEqual(empty.history, [], '근거 없는 역사가 생성됨');
  assert.deepEqual(validateWorld(empty), []);
});
