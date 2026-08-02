// D2-a 뿌리 만들기 — 뿌리는 종이 말한 것을 옮겨 적을 뿐 고쳐 적지 않는다.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { instantiateNeeds } from '../../src/s1/index.ts';
import { nodeIdOf } from '../../src/d1/index.ts';
import {
  checkRootSpecs,
  rootNodeFrom,
  rootSummary,
  slotKey,
  specimenOf,
  type SpeciesGraphViolation,
  type SpeciesNeed,
} from '../../src/d2/index.ts';

import { beast, fertility, fertilityRoot, hunger, hungerRoot } from './fixture.ts';

const where = specimenOf(beast);
const needs: readonly SpeciesNeed[] = [
  { template: hunger, serves: 'survival' },
  { template: fertility, serves: 'lineage' },
];

function rules(specs: readonly (typeof hungerRoot)[], list = needs): readonly string[] {
  const out: SpeciesGraphViolation[] = [];
  checkRootSpecs({ speciesId: beast.id, name: beast.name }, specs, list, out);
  return out.map((violation) => violation.rule);
}

describe('D2-a 뿌리 노드', () => {
  test('뿌리의 조건은 종의 무너짐을 그대로 옮긴다', () => {
    const [need] = instantiateNeeds([hunger], where, beast.lifecycle.stages[0] ?? null);
    const node = rootNodeFrom(hungerRoot, hunger, need!, where.subjectId);

    assert.equal(node.id, nodeIdOf(where.subjectId, 'body', '주린 몸'));
    assert.equal(node.condition.kind, 'slot');
    if (node.condition.kind !== 'slot') return;
    assert.deepEqual(node.condition.slot, hunger.slot);
    assert.deepEqual(node.condition.band, hunger.band);
    assert.equal(node.condition.holderId, where.subjectId);
  });

  test('몸에 적히는 무너짐은 몸이 자리의 주인이 된다', () => {
    const bodyNeed = { ...hunger, holder: 'body' as const };
    const [need] = instantiateNeeds([bodyNeed], where, null);
    const node = rootNodeFrom(hungerRoot, bodyNeed, need!, where.subjectId);

    assert.equal(node.condition.kind === 'slot' && node.condition.holderId, where.bodyId);
  });

  test('그 자리의 값 자체를 가리키면 대상은 그 자리의 상태다', () => {
    const [need] = instantiateNeeds([hunger], where, null);
    const node = rootNodeFrom(hungerRoot, hunger, need!, where.subjectId);
    assert.equal(node.target?.ontology, 'State');
    assert.equal(node.target?.domain, 'biological');
    assert.equal(node.target?.name, slotKey(hunger.slot));

    const bare = rootNodeFrom({ ...hungerRoot, targetsOwnState: false }, hunger, need!, where.subjectId);
    assert.equal(bare.target, null);
  });
});

describe('D2-a 뿌리 검사', () => {
  test('무너짐마다 뿌리 하나면 아무것도 걸리지 않는다', () => {
    assert.deepEqual(rules([hungerRoot, fertilityRoot]), []);
  });

  test('뿌리 없는 무너짐은 지목된다', () => {
    assert.deepEqual(rules([hungerRoot]), ['unrooted-need']);
  });

  test('종이 말하지 않은 자리의 뿌리는 거부된다', () => {
    const phantom = { ...hungerRoot, slot: { domain: 'psychic' as const, path: 'conviction' } };
    assert.deepEqual(rules([hungerRoot, fertilityRoot, phantom]), ['phantom-root']);
  });

  test('같은 자리에 뿌리가 둘이면 거부된다', () => {
    const twin = { ...hungerRoot, label: '또 다른 주림' };
    assert.deepEqual(rules([hungerRoot, fertilityRoot, twin]), ['duplicate-root']);
  });

  test('이름과 근거가 없는 뿌리는 거부된다', () => {
    assert.deepEqual(rules([{ ...hungerRoot, label: '', note: '' }, fertilityRoot]), [
      'bad-blueprint',
      'bad-blueprint',
    ]);
  });

  test('뿌리 한 줄에 무엇을 떠받치는지가 실린다', () => {
    assert.match(rootSummary(hungerRoot, 'survival'), /신체.*주린 몸.*biological\.hunger.*생존/);
    assert.match(rootSummary(fertilityRoot, 'both'), /생존·대/);
  });
});
