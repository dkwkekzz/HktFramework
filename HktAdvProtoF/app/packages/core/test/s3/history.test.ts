// S3-a 과거 사건 — 흔적 없는 과거는 과거가 아니다.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { deterministicId } from '../../src/v1/index.ts';
import { classify } from '../../src/o1/index.ts';
import {
  checkHistory,
  historyResidue,
  historySummary,
  pastEventId,
  pastEventOf,
  residueKey,
  residueState,
  residueSummary,
  type InstanceRef,
  type InstanceViolation,
  type PastEvent,
  type Residue,
} from '../../src/s3/index.ts';

const hunterId = deterministicId('subject', 'veil', '사냥꾼 04');
const villagersId = deterministicId('subject', 'organization', '아랫마을 사람들');
const partnerId = deterministicId('subject', 'veil', '사냥꾼 07');
const bodyId = deterministicId('entity', 'veil', '사냥꾼 04의 몸');

const hunter: InstanceRef = { id: hunterId, name: '사냥꾼 04' };
const BORN_AT = 400;

/** 마을에 빚을 졌다 — 지금 `relational.debt.{subject}` 에 남는다. */
const debtEvent: PastEvent = {
  tick: 120,
  name: '겨울에 마을 창고를 열었다',
  actorId: villagersId,
  causes: [],
  residue: [
    {
      slot: { domain: 'relational', path: `debt.${villagersId}` },
      holderId: hunterId,
      value: 40,
    },
  ],
};

/** 협곡에서 동료를 잃었다 — 원한과 신뢰가 함께 움직인다. */
const lossEvent: PastEvent = {
  tick: 260,
  name: '협곡에서 07 을 잃었다',
  actorId: null,
  causes: ['겨울에 마을 창고를 열었다'],
  residue: [
    {
      slot: { domain: 'relational', path: `grudge.${partnerId}` },
      holderId: hunterId,
      value: 0.6,
    },
    {
      slot: { domain: 'biological', path: 'vitality' },
      holderId: hunterId,
      value: 0.7,
    },
  ],
};

const HISTORY: readonly PastEvent[] = [debtEvent, lossEvent];

function check(
  history: readonly PastEvent[],
  bornAtTick = BORN_AT,
): readonly InstanceViolation[] {
  const out: InstanceViolation[] = [];
  checkHistory(hunter, history, bornAtTick, out);
  return out;
}

describe('S3-a 과거 사건 — 지나온 것은 지금의 자리에만 남는다', () => {
  test('온전한 이력은 그대로 선다', () => {
    assert.deepEqual(check(HISTORY), []);
  });

  test('이력은 O1 Event 가 된다 — 개체의 과거도 세계의 사건과 같은 모양이다', () => {
    const event = pastEventOf(hunterId, lossEvent, HISTORY);
    assert.equal(classify(event).kind, 'Event');
    assert.equal(event.tick, 260);
    assert.equal(event.actorId, null);
    assert.equal(event.changedStateIds.length, 2, '두 자리를 바꿨다');
    assert.deepEqual(event.causeIds, [pastEventId(hunterId, debtEvent)], '앞선 사건이 원인이 된다');
    // 같은 개체·같은 시각·같은 이름이면 언제나 같은 사건이다
    assert.equal(event.id, pastEventOf(hunterId, lossEvent, HISTORY).id);
    // 다른 개체의 같은 일은 다른 사건이다
    assert.notEqual(event.id, pastEventId(partnerId, lossEvent));
  });

  test('남긴 값은 O1 State 가 된다 — 세계에 적힐 실제 모양', () => {
    const residue = lossEvent.residue[0];
    assert.ok(residue !== undefined);
    const state = residueState(residue);
    assert.equal(classify(state).kind, 'State');
    assert.equal(state.ofId, hunterId);
    assert.equal(state.value, 0.6);
    assert.equal(state.domain, 'relational');
  });

  test('이력 전부가 남긴 값이 모인다 — 뒤가 앞을 덮는다', () => {
    const residue = historyResidue(HISTORY);
    assert.equal(residue.length, 3, '세 자리에 남는다');

    const healed: PastEvent = {
      ...lossEvent,
      tick: 300,
      name: '겨울을 넘기고 빚을 갚았다',
      causes: ['협곡에서 07 을 잃었다'],
      residue: [{ ...(debtEvent.residue[0] as Residue), value: 0 }],
    };
    const after = historyResidue([...HISTORY, healed]);
    assert.equal(after.length, 3, '자리는 늘지 않는다');
    assert.equal(
      after.find((entry) => entry.slot.path.startsWith('debt.'))?.value,
      0,
      '뒤의 사건이 앞의 값을 덮는다',
    );
    assert.deepEqual(historyResidue([]), []);
  });

  test('흔적 없는 과거는 과거가 아니다', () => {
    const violations = check([{ ...debtEvent, residue: [] }]);
    assert.equal(violations.length, 1);
    assert.equal(violations[0]?.rule, 'traceless-past');
    assert.equal(violations[0]?.path, '$.history[0].residue');
    assert.equal(violations[0]?.subjectName, '사냥꾼 04');
  });

  test('아직 오지 않은 일은 이력이 아니다', () => {
    const violations = check([{ ...debtEvent, tick: BORN_AT + 1 }]);
    assert.equal(violations[0]?.rule, 'future-past');
    assert.equal(violations[0]?.path, '$.history[0].tick');
    // 지금 이 순간(bornAtTick)의 일은 이력으로 인정된다
    assert.deepEqual(check([{ ...debtEvent, tick: BORN_AT }]), []);
  });

  test('이력은 시간 순으로 적힌다', () => {
    const violations = check([lossEvent, { ...debtEvent, causes: [] }]);
    assert.ok(violations.some((violation) => violation.rule === 'unordered-history'));
  });

  test('원인은 앞에 있어야 한다', () => {
    assert.equal(
      check([{ ...debtEvent, causes: ['겨울에 마을 창고를 열었다'] }])[0]?.rule,
      'self-caused-past',
    );
    assert.equal(check([{ ...debtEvent, causes: ['없던 일'] }])[0]?.rule, 'bad-past-event');
    // 뒤의 사건을 원인으로 삼아도 앞에 없으므로 걸린다
    assert.equal(
      check([{ ...debtEvent, causes: ['협곡에서 07 을 잃었다'] }, lossEvent])[0]?.rule,
      'bad-past-event',
    );
  });

  test('세계에 없는 자리에는 과거도 남지 않는다', () => {
    const residue = debtEvent.residue[0];
    assert.ok(residue !== undefined);
    assert.equal(
      check([
        {
          ...debtEvent,
          residue: [{ ...residue, slot: { domain: 'relational', path: 'nostalgia.someone' } }],
        },
      ])[0]?.rule,
      'phantom-slot',
    );
    assert.equal(
      check([
        {
          ...debtEvent,
          residue: [
            {
              ...residue,
              slot: {
                domain: 'historical' as Residue['slot']['domain'],
                path: 'memory',
              },
            },
          ],
        },
      ])[0]?.rule,
      'phantom-slot',
    );
  });

  test('남긴 값은 그 자리의 값 모양을 지킨다', () => {
    const residue = lossEvent.residue[0];
    assert.ok(residue !== undefined);
    assert.equal(check([{ ...lossEvent, causes: [], residue: [{ ...residue, value: 3 }] }])[0]?.rule, 'bad-residue');
    assert.equal(
      check([{ ...lossEvent, causes: [], residue: [{ ...residue, value: '깊다' }] }])[0]?.rule,
      'bad-residue',
    );
  });

  test('그 보유자가 가질 수 없는 자리에는 남지 않는다', () => {
    const residue = debtEvent.residue[0];
    assert.ok(residue !== undefined);
    // 빚은 주체의 자리다 — 몸(entity)에게 적을 수 없다
    assert.equal(
      check([{ ...debtEvent, residue: [{ ...residue, holderId: bodyId }] }])[0]?.rule,
      'foreign-residue',
    );
  });

  test('같은 자리에 두 과거가 다른 값을 남기면 지금을 알 수 없다', () => {
    const residue = debtEvent.residue[0];
    assert.ok(residue !== undefined);
    const contested: PastEvent = {
      ...lossEvent,
      causes: [],
      residue: [{ ...residue, value: 90 }],
    };
    const violations = check([debtEvent, contested]);
    assert.equal(violations[0]?.rule, 'duplicate-residue');
    assert.match(violations[0]?.message ?? '', /40.*90|90.*40/);

    // 같은 값이면 덮는 것이므로 다툼이 아니다
    assert.deepEqual(
      check([debtEvent, { ...lossEvent, causes: [], residue: [{ ...residue }] }]),
      [],
    );
  });

  test('자리 열쇠는 누구의 어느 자리인가로 만들어진다', () => {
    const residue = debtEvent.residue[0];
    assert.ok(residue !== undefined);
    assert.equal(residueKey(residue), `relational.${hunterId}.debt.${villagersId}`);
    assert.notEqual(residueKey(residue), residueKey({ ...residue, holderId: partnerId }));
  });

  test('사람이 읽는 줄로 접힌다', () => {
    assert.equal(historySummary([]), '지고 온 것이 없다');
    assert.match(historySummary(HISTORY), /120틱 겨울에 마을 창고를 열었다 \(1자리\) → 260틱/);
    assert.equal(residueSummary([]), '남은 것이 없다');
    assert.match(residueSummary(historyResidue(HISTORY)), /vitality = 0.7/);
  });

  test('빈 이력은 아무것도 막지 않는다 — 지고 온 것 없이도 개체는 선다', () => {
    assert.deepEqual(check([]), []);
  });
});
