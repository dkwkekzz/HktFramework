// E0-a 단위 테스트 — 걸림이 한 평면에 놓이고, 사람 축이 처음 열린다.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { deterministicId } from '../../src/v1/index.ts';
import type { ActiveGoal } from '../../src/p4/index.ts';
import type { ActionIntent } from '../../src/r6/index.ts';
import type { DependencyConflict } from '../../src/d5/index.ts';
import {
  STAKE_AXES,
  checkStakes,
  stakeAxisLabel,
  stakeIdOf,
  stakeKeyOf,
  stakeLine,
  stakeSlotKeyOf,
  stakesByKey,
  stakesFrom,
  stakesFromConflict,
  stakesFromGoal,
  stakesFromIntent,
  stakesOf,
  type SituationStake,
} from '../../src/e0/index.ts';

const actorId = deterministicId('subject', 'person', '몰이꾼 04');
const rivalId = deterministicId('subject', 'person', '상단 11');
const thirdId = deterministicId('subject', 'person', '사제 02');
const meatId = deterministicId('entity', 'thing', '말린 고기');

const intentOf = (overrides: Partial<ActionIntent> = {}): ActionIntent =>
  ({
    kind: 'Affordance',
    id: deterministicId('affordance', String(overrides.providerId ?? actorId), 'goal', '430'),
    providerId: actorId,
    action: 'seize',
    requires: [],
    yields: [],
    cost: 1,
    tick: 430,
    atom: 'seize',
    goalId: 'possibility:겨울 식량',
    stepOrder: 0,
    aim: {
      counterpartId: rivalId,
      axis: 'grudge',
      value: 0.6,
      via: 'attribution',
      note: '기억이 그를 짚었다',
    },
    proposal: {
      atom: 'seize',
      actorId,
      targetIds: [rivalId],
      changes: [{ domain: 'economic', holderId: rivalId, path: `stock.${meatId}` }],
      payments: [{ domain: 'biological', holderId: actorId, path: 'vitality' }],
      observedIds: [rivalId],
    },
    note: '',
    ...overrides,
  }) as ActionIntent;

const conflictOf = (overrides: Partial<DependencyConflict> = {}): DependencyConflict =>
  ({
    id: deterministicId('conflict', 'target', meatId),
    contestId: deterministicId('contest', 'target', meatId),
    axis: 'target',
    key: meatId,
    label: '말린 고기',
    scope: 'between',
    reason: 'scarcity',
    sides: [
      { claimId: 'claim:a', subjectId: actorId, nodeId: 'n1', label: '겨울 식량', band: { kind: 'is', value: 1 }, substitutability: 0.2, pressure: 0.8 },
      { claimId: 'claim:b', subjectId: rivalId, nodeId: 'n2', label: '겨울 식량', band: { kind: 'is', value: 1 }, substitutability: 0.2, pressure: 0.5 },
    ],
    severity: 0.8,
    note: '세계에 하나뿐인데 둘이 본다',
    ...overrides,
  }) as DependencyConflict;

const goalOf = (subjectId: string, score: number): ActiveGoal =>
  ({
    subjectId,
    tick: 430,
    nodeId: 'possibility:겨울 식량',
    label: '겨울 식량',
    direction: 'fulfill',
    viaAtom: 'seize',
    score,
    commitmentInertia: 0,
    heldTicks: 0,
    changed: true,
    change: 'first',
    note: '가장 급하다',
  }) as unknown as ActiveGoal;

describe('E0-a 걸림의 축', () => {
  test('축은 넷이고 사람 축이 그중 하나다', () => {
    assert.deepEqual([...STAKE_AXES], ['slot', 'target', 'subject', 'goal']);
    assert.equal(stakeAxisLabel('subject'), '사람');
  });

  test('묶음의 이름은 축과 자리를 함께 진다 — 축이 다르면 같은 문자라도 다른 자리다', () => {
    assert.equal(stakeKeyOf({ axis: 'subject', key: rivalId }), `subject:${rivalId}`);
    assert.notEqual(
      stakeKeyOf({ axis: 'subject', key: rivalId }),
      stakeKeyOf({ axis: 'target', key: rivalId }),
    );
  });

  test('자리 축의 이름 형식은 D5 의 것과 같다', () => {
    assert.equal(
      stakeSlotKeyOf({ domain: 'economic', holderId: rivalId, path: 'stock.x' }),
      `economic.${rivalId}.stock.x`,
    );
  });

  test('같은 유래는 같은 id 를 낸다 (V1 결정적 ID)', () => {
    assert.equal(
      stakeIdOf(actorId, 'subject', rivalId, 'src'),
      stakeIdOf(actorId, 'subject', rivalId, 'src'),
    );
    assert.notEqual(
      stakeIdOf(actorId, 'subject', rivalId, 'src'),
      stakeIdOf(rivalId, 'subject', actorId, 'src'),
    );
  });
});

describe('E0-a 다툼에서 펴는 걸림', () => {
  test('다투는 자마다 하나씩 나고 급함은 D5 가 잰 값 그대로다', () => {
    const stakes = stakesFromConflict(conflictOf());
    assert.equal(stakes.length, 2);
    assert.deepEqual(
      stakes.map((stake) => stake.subjectId).sort(),
      [actorId, rivalId].sort(),
    );
    assert.ok(stakes.every((stake) => stake.urgency === 0.8));
    assert.ok(stakes.every((stake) => stake.axis === 'target'));
    assert.ok(stakes.every((stake) => !stake.aimed));
  });

  test('같은 주체가 두 번 적혀 있어도 걸림은 하나다', () => {
    const conflict = conflictOf({
      sides: [
        { claimId: 'claim:a', subjectId: actorId, nodeId: 'n1', label: 'x', band: { kind: 'is', value: 1 }, substitutability: 0, pressure: 0.8 },
        { claimId: 'claim:b', subjectId: actorId, nodeId: 'n2', label: 'y', band: { kind: 'is', value: 1 }, substitutability: 0, pressure: 0.4 },
      ],
    } as Partial<DependencyConflict>);
    assert.equal(stakesFromConflict(conflict).length, 1);
  });
});

describe('E0-a 의도에서 펴는 걸림 — 사람 축이 열린다', () => {
  test('바꾸려는 칸과 겨눈 상대가 함께 선다', () => {
    const stakes = stakesFromIntent(intentOf(), 0.6);
    const axes = stakes.map((stake) => stake.axis).sort();
    assert.deepEqual(axes, ['slot', 'subject', 'subject']);
    const aimed = stakes.find((stake) => stake.axis === 'subject' && stake.aimed);
    assert.equal(aimed?.key, rivalId);
    assert.equal(aimed?.urgency, 0.6);
  });

  test('겨눔 하나가 걸림 둘을 낸다 — 겨누는 자와 겨눔당하는 자가 같은 자리에 선다', () => {
    const stakes = stakesFromIntent(intentOf(), 0.6);
    const onRival = stakes.filter((stake) => stake.axis === 'subject' && stake.key === rivalId);
    assert.equal(onRival.length, 2);
    assert.deepEqual(
      onRival.map((stake) => [stake.subjectId, stake.aimed, stake.urgency]),
      [
        [actorId, true, 0.6],
        [rivalId, false, 0],
      ],
    );
  });

  test('겨눈 상대를 대상 축으로 또 세우지 않는다 — 한 겨눔이 두 번 세면 안 된다', () => {
    const stakes = stakesFromIntent(intentOf());
    assert.equal(stakes.filter((stake) => stake.axis === 'target').length, 0);
  });

  test('상대를 겨누지 않는 의도는 사람 축을 열지 않는다', () => {
    const stakes = stakesFromIntent(
      intentOf({
        aim: null,
        atom: 'acquire',
        action: 'acquire',
        proposal: {
          atom: 'acquire',
          actorId,
          targetIds: [meatId],
          changes: [{ domain: 'economic', holderId: actorId, path: `stock.${meatId}` }],
          payments: [],
          observedIds: [meatId],
        },
      } as Partial<ActionIntent>),
    );
    assert.equal(stakes.filter((stake) => stake.axis === 'subject').length, 0);
    assert.equal(stakes.filter((stake) => stake.axis === 'target').length, 1);
  });

  test('치르는 자리는 걸림이 아니다 — 남이 함께 보는 것이 아니다', () => {
    const stakes = stakesFromIntent(intentOf());
    assert.equal(stakes.filter((stake) => stake.key.includes('vitality')).length, 0);
  });
});

describe('E0-a 목적에서 펴는 걸림', () => {
  test('같은 가능성 노드를 좇는 둘은 같은 자리에 모인다', () => {
    const stakes = [...stakesFromGoal(goalOf(actorId, 0.7)), ...stakesFromGoal(goalOf(rivalId, 0.5))];
    const keys = new Set(stakes.map(stakeKeyOf));
    assert.equal(keys.size, 1);
    assert.deepEqual(
      stakes.map((stake) => stake.urgency),
      [0.7, 0.5],
    );
  });
});

describe('E0-a 한 평면에 늘어놓기', () => {
  test('세 갈래가 한 평면에 놓이고 순서는 결정적이다', () => {
    const spec = {
      conflicts: [conflictOf()],
      intents: [intentOf()],
      goals: [goalOf(actorId, 0.7)],
    };
    const first = stakesFrom(spec);
    const again = stakesFrom(spec);
    assert.deepEqual(first, again);
    assert.deepEqual([...new Set(first.map((stake) => stake.axis))].sort(), [
      'goal',
      'slot',
      'subject',
      'target',
    ]);
  });

  test('의도의 급함은 그 의도가 나온 목적의 점수에서 온다 — E0 가 지어내지 않는다', () => {
    const stakes = stakesFrom({ intents: [intentOf()], goals: [goalOf(actorId, 0.7)] });
    const aimed = stakes.find((stake) => stake.axis === 'subject');
    assert.equal(aimed?.urgency, 0.7);
  });

  test('목적을 못 찾으면 급함은 0 이다 — 짐작하지 않는다', () => {
    const stakes = stakesFrom({ intents: [intentOf()] });
    assert.ok(stakes.every((stake) => stake.urgency === 0));
  });

  test('같은 걸림은 한 번만 선다', () => {
    const intent = intentOf();
    const stakes = stakesFrom({ intents: [intent, intent] });
    assert.equal(new Set(stakes.map((stake) => stake.id)).size, stakes.length);
  });

  test('빈 재료는 빈 평면이다', () => {
    assert.deepEqual(stakesFrom({}), []);
  });

  test('자리별로 누가 걸렸는지 묶인다', () => {
    const stakes = stakesFrom({
      intents: [intentOf(), intentOf({ providerId: thirdId, proposal: { ...intentOf().proposal, actorId: thirdId } } as Partial<ActionIntent>)],
    });
    const byKey = stakesByKey(stakes);
    // 겨누는 둘 + 겨눔당하는 11 자신 = 셋이 한 자리에 선다.
    const aimedAtRival = byKey.get(`subject:${rivalId}`) ?? [];
    assert.equal(aimedAtRival.length, 3);
    assert.deepEqual(stakesOf(stakes, thirdId).length > 0, true);
  });
});

describe('E0-a 걸림 검사', () => {
  const stakeOf = (overrides: Partial<SituationStake> = {}): SituationStake => ({
    id: 'stake:x',
    subjectId: actorId,
    axis: 'subject',
    key: rivalId,
    label: '',
    via: 'intent',
    sourceId: 'affordance:x',
    urgency: 0,
    aimed: true,
    note: '',
    ...overrides,
  });

  test('설 수 있는 걸림에는 위반이 없다', () => {
    assert.deepEqual(checkStakes([stakeOf()]), []);
  });

  test('자기 자신을 겨눈 사람 축은 걸린다', () => {
    const violations = checkStakes([stakeOf({ key: actorId })]);
    assert.deepEqual(
      violations.map((violation) => violation.rule),
      ['self-aimed-stake'],
    );
  });

  test('겨눔이 아닌 자기 자리는 걸리지 않는다 — 겨눔당한 자 자신이다', () => {
    assert.deepEqual(checkStakes([stakeOf({ key: actorId, aimed: false })]), []);
  });

  test('누가 걸렸는지 · 어느 자리인지 없으면 걸린다', () => {
    const violations = checkStakes([stakeOf({ subjectId: '', key: '' })]);
    assert.deepEqual(
      violations.map((violation) => violation.rule).sort(),
      ['holderless-stake', 'keyless-stake'],
    );
  });

  test('급함을 다시 재면 걸린다 — D5 가 잰 값과 달라진다', () => {
    const conflict = conflictOf();
    const stakes = stakesFromConflict(conflict).map((stake) => ({ ...stake, urgency: 0.99 }));
    const violations = checkStakes(stakes, { conflicts: [conflict] });
    assert.ok(violations.every((violation) => violation.rule === 'urgency-drift'));
    assert.equal(violations.length, 2);
  });

  test('P4 점수와 다른 목적 걸림도 걸린다', () => {
    const goal = goalOf(actorId, 0.7);
    const stakes = stakesFromGoal(goal).map((stake) => ({ ...stake, urgency: 0.1 }));
    assert.deepEqual(
      checkStakes(stakes, { goals: [goal] }).map((violation) => violation.rule),
      ['urgency-drift'],
    );
  });

  test('축 밖의 걸림은 걸린다', () => {
    const violations = checkStakes([stakeOf({ axis: 'weather' as never })]);
    assert.ok(violations.some((violation) => violation.rule === 'unknown-axis'));
  });

  test('사람이 읽는 한 줄이 난다', () => {
    assert.match(stakeLine(stakeOf({ urgency: 0.5 })), /사람/);
  });
});
