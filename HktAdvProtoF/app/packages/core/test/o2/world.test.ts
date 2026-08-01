// O2-c 단위 테스트 — 상태 원소 ↔ 9영역 세계 트리.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { deterministicId, stateHash } from '../../src/v1/index.ts';
import { classify, STATE_DOMAINS, type State } from '../../src/o1/index.ts';
import {
  assembleWorld,
  countSlots,
  describeDiff,
  disassembleWorld,
  emptyWorld,
  readHolder,
  readSlot,
  slotStateId,
  worldDiff,
  worldHolders,
  worldSlots,
} from '../../src/o2/index.ts';

const hunterId = deterministicId('subject', 'person', '사냥꾼 04');
const merchantId = deterministicId('subject', 'person', '행상 02');
const herbId = deterministicId('entity', 'material', '붉은 장막');
const nestId = deterministicId('entity', 'place', '붉은 장막 둥지');

function state(domain: State['domain'], ofId: string, path: string, value: State['value']): State {
  return {
    kind: 'State',
    id: slotStateId(domain, ofId, path),
    domain,
    ofId,
    path,
    value,
  };
}

const SCENE: readonly State[] = [
  state('biological', hunterId, 'hunger', 0.7),
  state('biological', hunterId, 'vitality', 0.55),
  state('physical', hunterId, 'region', nestId),
  state('relational', hunterId, `trust.${merchantId}`, -0.4),
  state('economic', hunterId, `stock.${herbId}`, 2),
  state('biological', herbId, 'toxin', '마비독'),
  state('biological', herbId, 'toxicity', 0.8),
  state('physical', nestId, 'cover', 0.9),
];

describe('세계 조립', () => {
  const { world, accepted, violations } = assembleWorld(SCENE);

  test('빈 세계도 9영역이 서 있다', () => {
    const empty = emptyWorld();
    assert.deepEqual(Object.keys(empty), [...STATE_DOMAINS]);
    assert.equal(countSlots(empty), 0);
    assert.deepEqual([...worldHolders(empty)], []);
  });

  test('장면의 상태 전부가 자리를 얻는다', () => {
    assert.deepEqual([...violations], []);
    assert.equal(accepted.length, SCENE.length);
    assert.equal(countSlots(world), SCENE.length);
  });

  test('값은 영역·보유자·경로로 읽힌다', () => {
    assert.equal(readSlot(world, 'biological', hunterId, 'hunger'), 0.7);
    assert.equal(readSlot(world, 'physical', hunterId, 'region'), nestId);
    assert.equal(readSlot(world, 'biological', hunterId, 'nothing'), null);
    assert.equal(readSlot(world, 'transcendent', hunterId, 'legitimacy'), null);
  });

  test('한 보유자의 한 영역을 통째로 본다', () => {
    assert.deepEqual(readHolder(world, 'biological', hunterId), { hunger: 0.7, vitality: 0.55 });
    assert.deepEqual(readHolder(world, 'biological', merchantId), {});
  });

  test('보유자는 영역을 가로질러 한 번씩 센다', () => {
    assert.deepEqual([...worldHolders(world)], [hunterId, herbId, nestId].sort());
  });

  test('자리 목록은 영역·보유자·경로 순으로 고정된다', () => {
    const slots = worldSlots(world);
    const domains = slots.map((slot) => slot.domain);
    // STATE_DOMAINS 순서를 거스르지 않는다.
    const order = domains.map((domain) => STATE_DOMAINS.indexOf(domain));
    assert.deepEqual(order, [...order].sort((a, b) => a - b));
    // 같은 입력이면 같은 세계 해시 (V1 결정성).
    assert.equal(stateHash(world), stateHash(assembleWorld(SCENE).world));
    // 입력 순서를 뒤집어도 같은 세계다.
    assert.equal(stateHash(world), stateHash(assembleWorld([...SCENE].reverse()).world));
  });
});

describe('왕복', () => {
  test('조립했다가 분해하면 처음 원소로 돌아온다', () => {
    const { world } = assembleWorld(SCENE);
    const back = disassembleWorld(world);
    const key = (s: State): string => `${s.domain}.${s.ofId}.${s.path}`;
    assert.deepEqual(
      back.map(key).sort(),
      SCENE.map(key).sort(),
    );
    assert.equal(
      stateHash([...back].sort((a, b) => key(a).localeCompare(key(b)))),
      stateHash([...SCENE].sort((a, b) => key(a).localeCompare(key(b)))),
    );
  });

  test('분해된 원소는 전부 온전한 O1 State 다', () => {
    const back = disassembleWorld(assembleWorld(SCENE).world);
    for (const item of back) assert.equal(classify(item).kind, 'State', item.path);
  });

  test('ID 는 유래에서 다시 만들어진다 — 몇 번을 분해해도 같다', () => {
    const world = assembleWorld(SCENE).world;
    assert.equal(stateHash(disassembleWorld(world)), stateHash(disassembleWorld(world)));
    assert.equal(
      slotStateId('biological', hunterId, 'hunger'),
      deterministicId('state', hunterId, 'biological.hunger'),
    );
  });

  test('다시 조립해도 같은 세계다', () => {
    const world = assembleWorld(SCENE).world;
    const again = assembleWorld(disassembleWorld(world)).world;
    assert.equal(stateHash(world), stateHash(again));
  });
});

describe('조립의 관문', () => {
  test('스키마를 어긴 상태는 트리에 들어가지 않는다', () => {
    const { world, accepted, violations } = assembleWorld([
      ...SCENE,
      state('biological', hunterId, 'hungry', 0.7), // 없는 자리
      state('biological', herbId, 'hunger', 0.2), // 사물의 허기
      state('relational', hunterId, `trust.${herbId}`, 0.5), // 사물을 신뢰
      state('biological', hunterId, 'vitality', 4), // 범위 밖
    ]);
    assert.equal(accepted.length, SCENE.length);
    assert.equal(countSlots(world), SCENE.length);
    assert.deepEqual(
      violations.map((v) => v.rule),
      ['unknown-path', 'bad-holder', 'bad-parameter', 'out-of-range'],
    );
    // 거부돼도 자리 이름은 그대로 나온다 — 어디를 고쳐야 하는지 보이게.
    assert.equal(violations[0]?.where, `biological.${hunterId}.hungry`);
  });

  test('같은 자리에 값이 둘이면 먼저 온 값을 지키고 뒤를 막는다', () => {
    const { world, violations } = assembleWorld([
      state('biological', hunterId, 'hunger', 0.7),
      state('biological', hunterId, 'hunger', 0.2),
    ]);
    assert.equal(readSlot(world, 'biological', hunterId, 'hunger'), 0.7);
    assert.deepEqual(
      violations.map((v) => v.rule),
      ['duplicate-state'],
    );
    assert.match(violations[0]?.message ?? '', /R1/);
  });

  test('전부 어긴 목록은 빈 세계를 만든다', () => {
    const { world, violations } = assembleWorld([state('biological', hunterId, 'hungry', 1)]);
    assert.equal(countSlots(world), 0);
    assert.equal(stateHash(world), stateHash(emptyWorld()));
    assert.equal(violations.length, 1);
  });
});

describe('전후 비교', () => {
  const before = assembleWorld(SCENE).world;

  test('바뀐 값·생긴 자리·사라진 자리가 각각 나온다', () => {
    const after = assembleWorld([
      ...SCENE.filter((s) => s.path !== 'vitality').map((s) =>
        s.path === 'hunger' && s.ofId === hunterId ? state('biological', hunterId, 'hunger', 0.9) : s,
      ),
      state('psychic', hunterId, 'conviction', 0.3),
    ]).world;

    const diff = worldDiff(before, after);
    assert.deepEqual(diff.map((entry) => entry.change).sort(), ['added', 'changed', 'removed']);
    const changed = diff.find((entry) => entry.change === 'changed');
    assert.equal(changed?.where, `biological.${hunterId}.hunger`);
    assert.equal(changed?.before, 0.7);
    assert.equal(changed?.after, 0.9);
    assert.equal(describeDiff(changed as never), `biological.${hunterId}.hunger 0.7 → 0.9`);
  });

  test('같은 세계면 차이가 없다', () => {
    assert.deepEqual([...worldDiff(before, before)], []);
    assert.deepEqual([...worldDiff(emptyWorld(), emptyWorld())], []);
  });

  test('빈 세계와의 비교는 전부 생김·전부 사라짐이다', () => {
    const added = worldDiff(emptyWorld(), before);
    assert.equal(added.length, SCENE.length);
    assert.ok(added.every((entry) => entry.change === 'added' && entry.before === null));
    const removed = worldDiff(before, emptyWorld());
    assert.ok(removed.every((entry) => entry.change === 'removed' && entry.after === null));
  });

  test('차이 순서는 자리 이름으로 고정된다', () => {
    const after = assembleWorld([]).world;
    const diff = worldDiff(before, after);
    assert.deepEqual(
      diff.map((entry) => entry.where),
      [...diff.map((entry) => entry.where)].sort(),
    );
  });
});
