// P4-a 단위 테스트 — 치를 것이 없을 때 막힌 것인지 브레이크가 없는 것인지.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { stateHash } from '../../src/v1/index.ts';
import { assembleWorld, STATE_SCHEMA, type WorldState } from '../../src/o2/index.ts';
import { UNSOURCED_SLOTS } from '../../src/p3/index.ts';
import {
  bestPayment,
  holdingOf,
  MEASURABLE_SPAN,
  payabilityOf,
  payabilityVerdict,
  PAYMENT_VERDICTS,
} from '../../src/p4/index.ts';

import { berryId, neighborId, plain, worldAt } from '../p3/fixture.ts';

/** 굴짐승 01 의 지금 — 창고에 열매 넷, 몸은 성하고, 이웃과의 사이가 적혀 있다. */
const stocked = worldAt(4);
/** 같은 세계에서 창고만 빈 것 */
const empty = worldAt(0);

/** 몸이 다 닳은 세계 — 체력만 0 으로 바꾼다. */
function drained(world: WorldState): WorldState {
  return {
    ...world,
    biological: {
      ...world.biological,
      [plain.id]: { ...world.biological?.[plain.id], vitality: 0 },
    },
  } as WorldState;
}

const spec = (world: WorldState) => ({ actorId: plain.id, world });

describe('P4-a 재료 선행 판정', () => {
  test('창고가 비면 주고받기는 막힌다 — 그 자리를 세우는 원자가 있기 때문이다', () => {
    const full = payabilityOf('exchange', spec(stocked));
    assert.equal(full.verdict, 'payable');

    const report = payabilityOf('exchange', spec(empty));
    assert.equal(report.verdict, 'blocked');
    // 먼저 할 일은 P4 가 정하지 않는다 — P3-a 가 계산해 둔 것 그대로다.
    assert.deepEqual([...report.blockedBy].sort(), ['acquire', 'produce', 'seize']);
    assert.equal(report.complete, true);
  });

  test('몸이 다 닳아도 획득은 막히지 않는다 — 브레이크가 없을 뿐이다', () => {
    const report = payabilityOf('acquire', spec(drained(empty)));
    assert.equal(report.verdict, 'unbraked');
    assert.deepEqual(report.blockedBy, []);
    assert.deepEqual(report.unbrakedSlots, ['biological.vitality']);
    // 막지 않는 대신 값이 남는다 — 다 닳은 몸으로 내는 것이 가장 마른 자리다.
    assert.equal(report.drain, 1);
  });

  test('같은 원자라도 세계가 다르면 마름이 다르다 — 체력 0.7 은 0.3 만큼만 마르다', () => {
    const report = payabilityOf('acquire', spec(stocked));
    assert.equal(report.verdict, 'unbraked');
    assert.equal(Math.round(report.drain * 100), 30);
  });

  test('브레이크 없는 자리 넷은 P3-a 가 선언한 그 넷이다', () => {
    const declared = new Set(UNSOURCED_SLOTS.map((entry) => `${entry.slot.domain}.${entry.slot.path}`));
    const seen = new Set<string>();
    for (const atom of ['seek', 'ally', 'betray', 'substitute'] as const) {
      for (const slot of payabilityOf(atom, spec(stocked)).unbrakedSlots) seen.add(slot);
    }
    assert.equal(seen.size, 4);
    for (const slot of seen) assert.ok(declared.has(slot), slot);
  });

  test('신뢰는 양의 쪽만 치른다 — 불신을 내줄 수는 없다', () => {
    // 이웃과의 사이가 0.4 로 적힌 세계에서는 설득이 선다.
    assert.equal(payabilityOf('persuade', spec(stocked)).verdict, 'payable');

    const distrusted = {
      ...stocked,
      relational: {
        ...stocked.relational,
        [plain.id]: { ...stocked.relational?.[plain.id], [`trust.${neighborId}`]: -0.6 },
      },
    } as WorldState;
    const report = payabilityOf('persuade', spec(distrusted));
    assert.equal(report.verdict, 'blocked');
    assert.deepEqual(report.blockedBy, ['exchange']);
  });

  test('세계가 상한을 열어 둔 자리는 잔량을 재지 않는다 — 있다·없다만 안다', () => {
    const held = holdingOf(stocked, plain.id, { domain: 'economic', path: 'stock.{entity}' });
    assert.equal(held.measurable, false);
    assert.equal(held.remaining, 1);

    const body = holdingOf(stocked, plain.id, { domain: 'biological', path: 'vitality' });
    assert.equal(body.measurable, true);
    assert.equal(body.remaining, 0.7);
    // 재고의 상한은 한계가 아니라 자리 표시다 — 잴 수 있는 폭을 넘는다.
    assert.ok(1000000000 > MEASURABLE_SPAN);
  });

  test('패턴 자리는 가장 넉넉한 곳으로 잰다 — 하나라도 넉넉하면 그것으로 치른다', () => {
    const held = holdingOf(empty, plain.id, { domain: 'economic', path: 'stock.{entity}' });
    assert.equal(held.remaining, 0);
    assert.equal(
      holdingOf(stocked, plain.id, { domain: 'economic', path: `stock.${berryId}` }).remaining,
      1,
    );
  });

  test('갈래는 가장 나은 원자로 선다 — 순서열은 P5 의 몫이다', () => {
    // 겨울 식량을 채우는 셋: 획득·주고받기·빼앗기. 창고가 비면 앞의 하나만 선다.
    const best = bestPayment(['acquire', 'exchange', 'seize'], spec(empty));
    assert.equal(best?.atom, 'acquire');
    assert.equal(best?.verdict, 'unbraked');

    // 세계가 바뀌어도 고르는 규칙은 같다 — 덜 막히고 덜 마른 것.
    const rich = bestPayment(['seize', 'exchange'], spec(stocked));
    assert.equal(rich?.atom, 'exchange');
  });

  test('걸림 없는 원자와 세계에 없는 자리는 각각의 사유로 걸린다', () => {
    const ghost = payabilityOf('없는원자' as 'seek', spec(stocked));
    assert.deepEqual(
      ghost.violations.map((violation) => violation.rule),
      ['absent-grounding'],
    );
    assert.equal(ghost.complete, false);
    assert.ok(payabilityVerdict(ghost).includes('absent-grounding'));

    // 자리를 하나도 적지 않은 세계 스키마를 주면, 치를 자리 자체가 없는 것이 된다.
    const nowhere = payabilityOf('acquire', {
      ...spec(stocked),
      schema: { ...STATE_SCHEMA, fields: [] },
    });
    assert.deepEqual(
      [...new Set(nowhere.violations.map((violation) => violation.rule))],
      ['unslotted-payment'],
    );
  });

  test('아무것도 적히지 않은 세계에서도 던지지 않는다 — 판정이 값으로 남는다', () => {
    const bare = assembleWorld([]).world;
    const report = payabilityOf('exchange', spec(bare));
    assert.equal(report.verdict, 'blocked');
    assert.equal(report.requirements[0]?.held, null);
    assert.equal(report.complete, true);
  });

  test('같은 재료면 같은 판정이다', () => {
    const once = stateHash(payabilityOf('seize', spec(stocked)));
    assert.equal(once, stateHash(payabilityOf('seize', spec(stocked))));
    assert.equal(PAYMENT_VERDICTS.length, 3);
  });
});
