import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { WorldOntology, createInitialWorldState, validateWorldState } from '../src/worldOntology.js';
import { defineC01Ontology } from '../src/c01Ontology.js';
import { AxiomRegistry, validateTransition } from '../src/axioms.js';
import { registerC01Axioms } from '../src/c01Axioms.js';

const root = fileURLToPath(new URL('../../..', import.meta.url));
const cycleSpec = JSON.parse(readFileSync(`${root}/cycles/C01-border-canyon/CYCLE.json`, 'utf8'));
const ontology = defineC01Ontology();

test('CYCLE.yaml 의 장소·경로·주체·자원·제작물 전부가 존재론 타입으로 표현된다 (완료 조건, Handoff: V-S01 실제 출력 소비)', () => {
  for (const id of cycleSpec.regionScope.places) assert.ok(ontology.has('place', id), `장소 누락: ${id}`);
  for (const id of cycleSpec.regionScope.movement) assert.ok(ontology.has('route', id), `경로 누락: ${id}`);
  for (const s of cycleSpec.subjectsAndFactions) assert.ok(ontology.has('subject-archetype', s.id), `주체 누락: ${s.id}`);
  for (const r of cycleSpec.playerRoles) assert.ok(ontology.has('player-role', r.id), `역할 누락: ${r.id}`);
  for (const id of cycleSpec.resourceEconomy.resources) assert.ok(ontology.has('resource', id), `자원 누락: ${id}`);
  for (const id of cycleSpec.resourceEconomy.crafts) assert.ok(ontology.has('craft-item', id), `제작물 누락: ${id}`);
});

test('SC-C01-O-01: 스키마 위반 세계 상태는 거부된다', () => {
  const good = createInitialWorldState(ontology);
  assert.deepEqual(validateWorldState(good, ontology), []);

  const badVersion = { ...structuredClone(good), schemaVersion: 99 };
  assert.ok(validateWorldState(badVersion, ontology).some((e) => e.includes('schemaVersion')));

  const badResource = structuredClone(good);
  badResource.resources['dragon-scale'] = 1;
  assert.ok(validateWorldState(badResource, ontology).some((e) => e.includes('미등록 자원')));

  const badQty = structuredClone(good);
  badQty.resources['hide'] = -3;
  assert.ok(validateWorldState(badQty, ontology).some((e) => e.includes('수량 불량')));

  const badPlace = structuredClone(good);
  badPlace.region.places['castle'] = {};
  assert.ok(validateWorldState(badPlace, ontology).some((e) => e.includes('미등록 장소')));

  const badSubject = structuredClone(good);
  badSubject.subjects['npc-1'] = { archetype: 'dragon' };
  assert.ok(validateWorldState(badSubject, ontology).some((e) => e.includes('미등록 원형')));

  const missingKey = structuredClone(good);
  delete missingKey.ownership;
  assert.ok(validateWorldState(missingKey, ontology).some((e) => e.includes('필수 키 누락')));
});

test('존재론 불량 요소는 등록 시점에 거부된다 (실패 경로)', () => {
  const o = new WorldOntology();
  assert.throws(() => o.addEntity('spaceship', { id: 'x' }), /미지 존재론 종류/);
  assert.throws(() => o.addEntity('place', { name: 'no-id' }), /id 필수/);
  assert.throws(() => o.addEntity('subject-archetype', { id: 's', actorKind: 'ghost' }), /actorKind 불량/);
  assert.throws(() => o.addEntity('craft-item', { id: 'free-lunch', inputs: [] }), /소비 입력이 필요/);
  o.addEntity('place', { id: 'p1' });
  assert.throws(() => o.addEntity('place', { id: 'p1' }), /중복 존재론 요소/);
});

test('스키마 상태 + 제작식은 보존 공리와 정합한다 (Handoff: O-S01 실제 출력 소비)', () => {
  const axioms = registerC01Axioms(new AxiomRegistry());
  const before = createInitialWorldState(ontology);
  before.resources['healing-herb'] = 2;
  const recipe = ontology.get('craft-item', 'healing-potion');
  const after = structuredClone(before);
  after.resources['healing-herb'] -= 2;

  const withCost = validateTransition({
    before, after,
    input: { events: [{ type: 'ItemCrafted', payload: { produces: [{ resource: 'healing-potion', qty: 1 }], consumes: recipe.inputs } }] },
  }, axioms);
  assert.equal(withCost.passed, true, JSON.stringify(withCost.violations));

  const freeLunch = validateTransition({
    before, after,
    input: { events: [{ type: 'ItemCrafted', payload: { produces: [{ resource: 'healing-potion', qty: 1 }] } }] },
  }, axioms);
  assert.ok(freeLunch.violations.some((v) => v.violationCode === 'CONSERVATION_NO_COST'));
});

test('존재론 스냅샷 해시는 결정적이다', () => {
  const a = defineC01Ontology().snapshot();
  const b = defineC01Ontology().snapshot();
  assert.equal(a.hash, b.hash);
  assert.equal(a['place'].length, 6);
  assert.equal(a['subject-archetype'].length, 7); // 원형 6 + player
  assert.equal(a['resource'].length, 6);
  assert.equal(a['craft-item'].length, 4);
});

test('사건 타입 어휘가 조회된다 (R 계층 소비 예정)', () => {
  assert.ok(ontology.has('event-type', 'ItemCrafted'));
  assert.ok(ontology.has('event-type', 'MonsterMoved'));
  assert.deepEqual(ontology.get('event-type', 'ResourceClaimed').requiredPayload, ['resource', 'by']);
  assert.equal(ontology.has('event-type', 'CastFireball'), false);
});
