// R5-b 단위 테스트 — 기억이 사이를 밀고, 지목 없는 기억은 아무도 밀지 못한다.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { deterministicId } from '../../src/v1/index.ts';
import { ACTION_ATOMS } from '../../src/p0/index.ts';
import { assembleWorld, slotStateId, type WorldState } from '../../src/o2/index.ts';
import type { State } from '../../src/o1/index.ts';
import type { WorldEvent } from '../../src/r1/index.ts';
import {
  RELATION_AXES,
  axisPush,
  axisRange,
  checkRegard,
  liveMemory,
  memoryPush,
  pushTable,
  regardLedger,
  regardOf,
  writtenRegard,
  type Memory,
  type MemoryViolation,
  type Relationship,
} from '../../src/r5/index.ts';

const strikerId = deterministicId('subject', 'person', '몰이꾼 04');
const victimId = deterministicId('subject', 'person', '상단 11');
const bystanderId = deterministicId('subject', 'person', '사제');

const slot = (domain: State['domain'], ofId: string, path: string, value: State['value']): State => ({
  kind: 'State',
  id: slotStateId(domain, ofId, path),
  domain,
  ofId,
  path,
  value,
});

/** 세계는 04 와 11 사이에 신뢰 0.5 만 적어 두었다 — 원한 자리는 비어 있다. */
const world: WorldState = assembleWorld([
  slot('relational', victimId, `trust.${strikerId}`, 0.5),
]).world;

const strike: WorldEvent = {
  kind: 'Event',
  id: deterministicId('event', '친다'),
  tick: 415,
  name: '상단 11 을 친다',
  actorId: strikerId,
  changedStateIds: [],
  causeIds: [],
  atom: 'destroy',
  targetIds: [victimId],
  effects: [
    { kind: 'change', domain: 'biological', holderId: victimId, path: 'vitality', from: 0.8, to: 0.2 },
  ],
};

const lived = (): Memory => liveMemory(strike, victimId, null).memory as Memory;

const rulesOf = (violations: readonly MemoryViolation[]): readonly string[] => [
  ...new Set(violations.map((violation) => violation.rule)),
];

describe('R5-b 축과 방향은 앞 계층이 정한다', () => {
  test('축은 O2 relational 여섯이다 — 소속은 값이 아니라 빠진다', () => {
    assert.deepEqual([...RELATION_AXES], ['trust', 'fear', 'respect', 'reliance', 'grudge', 'debt']);
  });

  test('폭은 O2 가 정한다 — 신뢰만 음수로 간다', () => {
    assert.deepEqual(axisRange('trust'), { min: -1, max: 1 });
    assert.deepEqual(axisRange('grudge'), { min: 0, max: 1 });
    // 빚은 상한이 사실상 열려 있어(0~10억) 사이로 읽을 때는 있다·없다로 본다
    assert.deepEqual(axisRange('debt'), { min: 0, max: 1 });
  });

  test('세우면 +1, 치르면 −1 — P0-b 걸림 그대로다', () => {
    assert.equal(axisPush('exchange', 'trust'), 1); // 주고받기는 신뢰를 세운다
    assert.equal(axisPush('seize', 'trust'), -1); // 빼앗기는 신뢰를 치른다
    assert.equal(axisPush('seize', 'grudge'), 1); // 그리고 원한을 세운다
    assert.equal(axisPush('coerce', 'fear'), 1);
  });

  test('배신은 신뢰에 방향이 없다 — 그 자리를 쓰면서 동시에 치른다', () => {
    assert.equal(axisPush('betray', 'trust'), 0);
    assert.equal(axisPush('betray', 'grudge'), 1);
  });

  test('원한은 쌓이기만 한다 — 열여섯 중 그것을 치르는 원자가 하나도 없다', () => {
    const paying = ACTION_ATOMS.filter((atom) => axisPush(atom, 'grudge') < 0);
    assert.deepEqual([...paying], []);
    const building = ACTION_ATOMS.filter((atom) => axisPush(atom, 'grudge') > 0);
    assert.deepEqual([...building], ['seize', 'coerce', 'betray']);
  });

  test('제거는 사이를 하나도 건드리지 않는다', () => {
    const row = pushTable(['destroy'])[0];
    assert.equal(row?.touches, 0);
  });
});

describe('R5-b 기억이 사이를 민다', () => {
  test('지목 없는 기억은 아무도 밀지 못한다', () => {
    const anonymous: Memory = { ...lived(), attribution: null };
    for (const axis of RELATION_AXES) assert.equal(memoryPush(anonymous, axis), 0);
  });

  test('겪은 기억은 흐리게 민다 — 무엇이었는지 모르므로 후보 평균이다', () => {
    const memory = lived();
    const grudge = memoryPush(memory, 'grudge');
    const trust = memoryPush(memory, 'trust');
    assert.ok(grudge > 0, '원한은 오른다');
    assert.ok(trust < 0, '신뢰는 내린다');
    // 열두 후보 중 원한을 세우는 것은 둘뿐이다 — 그래서 밀림이 약하다
    assert.ok(grudge < 0.1, `흐린 원한이다 — ${grudge.toFixed(3)}`);
  });

  test('맞은 자의 원한은 "맞았다" 가 아니라 "빼앗김이었을 수도 있다" 에서 온다', () => {
    const memory = lived();
    assert.ok(memory.suspected.includes('destroy'));
    assert.equal(axisPush('destroy', 'grudge'), 0);
    assert.ok(memory.suspected.some((atom) => axisPush(atom, 'grudge') > 0));
  });

  test('적힌 사이와 지닌 사이가 갈린다', () => {
    const pairs = regardOf([lived()], world, victimId, strikerId);
    const trust = pairs.find((entry) => entry.axis === 'trust') as Relationship;
    const grudge = pairs.find((entry) => entry.axis === 'grudge') as Relationship;
    assert.equal(trust.written, 0.5, '세계가 적어 둔 값');
    assert.ok(trust.value < 0.5, '지닌 신뢰는 그보다 낮다');
    assert.equal(grudge.written, 0, '세계의 장부에 원한은 없다');
    assert.ok(grudge.drift > 0, '그런데 그는 원한을 지녔다');
  });

  test('세계가 정한 폭 밖으로는 나가지 않는다', () => {
    const many = Array.from({ length: 40 }, (_, index) => ({
      ...lived(),
      id: `m${String(index)}`,
    }));
    const grudge = regardOf(many, world, victimId, strikerId).find(
      (entry) => entry.axis === 'grudge',
    ) as Relationship;
    assert.ok(grudge.value <= 1, '원한은 1 을 넘지 않는다');
    assert.ok(grudge.carried > 1, '민 값 자체는 폭보다 크다 — 자르는 것은 세계다');
  });

  test('적히지 않은 사이는 없는 사이다 (D3 와 같은 태도)', () => {
    assert.equal(writtenRegard(world, strikerId, victimId, 'trust'), 0);
  });

  test('장부는 아무도 밀지 못한 짝을 사실로 센다', () => {
    const ledger = regardLedger([lived()], world, [strikerId, victimId, bystanderId]);
    assert.ok(ledger.relationships.length > 0);
    assert.ok(ledger.drifted.length > 0);
    // 겪은 11 → 04 하나만 움직이고 나머지 다섯 짝은 그대로다
    assert.equal(ledger.untouched.length, 5);
  });

  test('자기 자신에 대한 사이는 세지 않는다', () => {
    const ledger = regardLedger([lived()], world, [victimId]);
    assert.deepEqual(ledger.relationships, []);
    assert.deepEqual(ledger.untouched, []);
  });
});

describe('R5-b 설 수 없는 사이가 걸린다', () => {
  const good = (): Relationship =>
    regardOf([lived()], world, victimId, strikerId).find(
      (entry) => entry.axis === 'grudge',
    ) as Relationship;

  const check = (relationship: Relationship, memories: readonly Memory[] = [lived()]) => {
    const out: MemoryViolation[] = [];
    checkRegard(relationship, memories, out);
    return rulesOf(out);
  };

  test('선 사이는 아무 사유도 내지 않는다', () => {
    assert.deepEqual(check(good()), []);
  });

  test('손으로 고친 값은 regard-drift 로 걸린다', () => {
    assert.ok(check({ ...good(), carried: 0.9 }).includes('regard-drift'));
  });

  test('O2 가 적어 두지 않은 축은 unknown-axis 로 걸린다', () => {
    const forged = { ...good(), axis: 'envy' } as unknown as Relationship;
    assert.deepEqual(check(forged), ['unknown-axis']);
  });

  test('자기 자신에 대한 사이는 self-regard 로 걸린다', () => {
    assert.ok(check({ ...good(), toId: victimId }).includes('self-regard'));
  });

  test('세계가 정한 폭 밖의 값은 걸린다', () => {
    assert.ok(check({ ...good(), value: 3 }).includes('regard-out-of-range'));
  });

  test('지목 없는 기억이 밀면 unattributed-regard 로 걸린다', () => {
    const anonymous: Memory = { ...lived(), attribution: null };
    assert.ok(check(good(), [anonymous]).includes('unattributed-regard'));
  });
});
