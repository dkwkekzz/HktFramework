// D2-b 채움 갈래 — 종의 빈칸이 개체의 자리로 채워지고, 시한은 한 번만 적힌다.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { deterministicId } from '../../src/v1/index.ts';
import {
  checkSupplySpecs,
  fillsRoot,
  fillsSupply,
  resolveCondition,
  resolveEffects,
  resolveHolder,
  specimenOf,
  supplyEdgeFrom,
  supplyNodeFrom,
  supplySummary,
  type SpeciesGraphViolation,
  type SupplySpec,
} from '../../src/d2/index.ts';

import { beast, beastBlueprint, berryId, berrySupply, denSupply, hungerRoot, fertilityRoot } from './fixture.ts';

const where = specimenOf(beast);
const roots = [hungerRoot, fertilityRoot];
const villageId = deterministicId('subject', 'organization', '골짜기 마을');

function rules(supplies: readonly SupplySpec[]): readonly string[] {
  const out: SpeciesGraphViolation[] = [];
  checkSupplySpecs({ speciesId: beast.id, name: beast.name }, supplies, roots, out);
  return out.map((violation) => violation.rule);
}

describe('D2-b 빈칸 채우기', () => {
  test('자리의 주인은 셋 중 하나로만 적히고 태어날 때 채워진다', () => {
    assert.equal(resolveHolder({ of: 'self' }, where), where.subjectId);
    assert.equal(resolveHolder({ of: 'body' }, where), where.bodyId);
    assert.equal(resolveHolder({ of: 'other', id: villageId }, where), villageId);
    // 몸 없는 종에게 몸을 적으면 자기에게 적힌다 — S1 instantiateNeeds 와 같은 태도.
    assert.equal(
      resolveHolder({ of: 'body' }, { subjectId: where.subjectId, bodyId: null }),
      where.subjectId,
    );
  });

  test('틱 조건은 개체와 무관하므로 그대로 지난다', () => {
    const clock = { kind: 'clock' as const, everyTicks: 12, withinTicks: 3 };
    assert.deepEqual(resolveCondition(clock, where), clock);
  });

  test('채움 노드는 종의 이름을 쓰고 개체의 ID 를 받는다', () => {
    const node = supplyNodeFrom(berrySupply, where);
    assert.equal(node.label, '겨울 열매');
    assert.equal(node.subjectId, where.subjectId);
    assert.equal(node.condition.kind === 'slot' && node.condition.holderId, where.subjectId);
    assert.equal(node.target?.id, berryId);
  });

  test('끊김의 흔적도 개체의 자리로 옮겨진다', () => {
    const [effect] = resolveEffects(berrySupply.failureEffects, where);
    assert.equal(effect?.holderId, where.subjectId);
    assert.deepEqual(effect?.change, { kind: 'delta', by: 0.2 });
  });

  test('시한은 단계의 대사가 나눈다 — 유체는 더 빨리 끊긴다', () => {
    const from = supplyNodeFrom(denSupply, where);
    const to = supplyNodeFrom(berrySupply, where);
    const timing = { urgency: 0.5, baseDelayTicks: 30 };
    const young = supplyEdgeFrom(from, to, berrySupply, timing, beast.lifecycle.stages[0] ?? null, where);
    const adult = supplyEdgeFrom(from, to, berrySupply, timing, beast.lifecycle.stages[1] ?? null, where);
    const ageless = supplyEdgeFrom(from, to, berrySupply, timing, null, where);

    assert.equal(young.failureDelayTicks, 15); // 대사 2
    assert.equal(adult.failureDelayTicks, 30); // 대사 1
    assert.equal(ageless.failureDelayTicks, 30); // 늙지 않는 종은 기준 그대로
    assert.equal(young.urgency, 0.5);
  });
});

describe('D2-b 채움 검사', () => {
  test('온전한 채움은 아무것도 걸리지 않는다', () => {
    assert.deepEqual(rules(beastBlueprint.supplies), []);
  });

  test('없는 것을 채우면 거부된다', () => {
    assert.deepEqual(
      rules([{ ...berrySupply, fills: [{ kind: 'supply', label: '여름 열매' }] , urgency: 0.5, baseDelayTicks: 5 }]),
      ['dangling-fill'],
    );
    assert.deepEqual(
      rules([
        {
          ...berrySupply,
          fills: [{ kind: 'root', slot: { domain: 'ecological', path: 'population' } }],
        },
      ]),
      ['dangling-fill'],
    );
  });

  test('자기 자신을 채우는 것은 채움이 아니다', () => {
    assert.deepEqual(
      rules([
        { ...berrySupply, fills: [{ kind: 'supply', label: '겨울 열매' }], urgency: 0.5, baseDelayTicks: 5 },
      ]),
      ['dangling-fill'],
    );
  });

  test('아무것도 채우지 않는 채움은 거부된다', () => {
    assert.deepEqual(rules([{ ...berrySupply, fills: [] }]), ['fillless-supply']);
  });

  test('같은 이름의 채움이 둘이면 거부된다', () => {
    assert.deepEqual(rules([berrySupply, berrySupply]), ['duplicate-supply']);
  });

  test('뿌리를 채우면서 시한을 적으면 거부된다 — 종이 이미 말했다', () => {
    assert.deepEqual(rules([{ ...berrySupply, urgency: 0.1 }]), ['overridden-need-timing']);
    assert.deepEqual(rules([{ ...berrySupply, baseDelayTicks: 9 }]), ['overridden-need-timing']);
  });

  test('뿌리 밖의 채움은 시한을 스스로 적어야 한다', () => {
    assert.deepEqual(
      rules([berrySupply, { ...denSupply, fills: [{ kind: 'supply', label: '겨울 열매' }] }]),
      ['bare-supply-timing'],
    );
  });

  test('무엇을 채우는지가 한 줄로 읽힌다', () => {
    assert.equal(fillsRoot(berrySupply), true);
    assert.equal(fillsSupply(berrySupply), false);
    assert.match(supplySummary(berrySupply), /biological\.hunger --consumes--> \[자원\] 겨울 열매/);
  });
});
