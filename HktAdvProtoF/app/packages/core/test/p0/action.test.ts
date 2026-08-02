// P0-c 단위 테스트 — 원자가 허락하지 않은 요청은 세계에 닿지 못한다.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { deterministicId } from '../../src/v1/index.ts';
import {
  actionFitVerdict,
  affordanceAtom,
  changeText,
  checkAtomAffordance,
  fitAction,
  type ActionProposal,
} from '../../src/p0/index.ts';

const hunterId = deterministicId('subject', '몰이꾼 04');
const traderId = deterministicId('subject', '고개를 넘는 상단');
const meatId = deterministicId('entity', '말린 고기');
const canyonId = deterministicId('entity', '붉은 협곡');

/** 상단에게서 고기를 사는 요청 — 값을 치르고 받는다. */
const buyMeat: ActionProposal = {
  atom: 'exchange',
  actorId: hunterId,
  targetIds: [traderId],
  changes: [
    { domain: 'economic', holderId: hunterId, path: `stock.${meatId}` },
    { domain: 'relational', holderId: hunterId, path: `trust.${traderId}` },
  ],
  payments: [{ domain: 'economic', holderId: hunterId, path: `stock.${canyonId}` }],
  observedIds: [traderId],
};

describe('설 수 있는 요청', () => {
  test('값을 치르고 받는 요청은 선다', () => {
    const fit = fitAction(buyMeat);
    assert.deepEqual(fit.violations, []);
    assert.equal(fit.fits, true);
    assert.equal(fit.atom, 'exchange');
    assert.match(actionFitVerdict(fit), /교환 로 설 수 있는 요청이다/);
  });

  test('자기 몸을 바꾸는 요청은 대상이 없어도 선다', () => {
    const fit = fitAction({
      atom: 'adapt',
      actorId: hunterId,
      targetIds: [],
      changes: [{ domain: 'biological', holderId: hunterId, path: 'metabolism' }],
      payments: [{ domain: 'biological', holderId: hunterId, path: 'vitality' }],
      observedIds: [],
    });
    assert.equal(fit.fits, true);
  });

  test('아직 아무것도 못 본 채로도 찾는 것만은 할 수 있다', () => {
    const fit = fitAction({
      atom: 'seek',
      actorId: hunterId,
      targetIds: [canyonId],
      changes: [
        {
          domain: 'informational',
          holderId: hunterId,
          path: `knows.${deterministicId('claim', '둥지가 협곡 안쪽에 있다')}`,
        },
      ],
      payments: [{ domain: 'biological', holderId: hunterId, path: 'vitality' }],
      observedIds: [],
    });
    assert.equal(fit.fits, true);
  });
});

describe('설 수 없는 요청', () => {
  test('16원자 밖의 행동은 받지 않는다 — 사냥은 조합이지 원자가 아니다', () => {
    const fit = fitAction({ ...buyMeat, atom: 'hunt' });
    assert.equal(fit.fits, false);
    assert.equal(fit.atom, null);
    assert.equal(fit.violations[0]?.rule, 'unknown-action');
    assert.match(fit.violations[0]?.message ?? '', /조합/);
  });

  test('아무것도 바꾸지 않겠다는 요청은 아무 일도 일으키지 않는다', () => {
    const fit = fitAction({ ...buyMeat, changes: [] });
    assert.equal(fit.violations[0]?.rule, 'changeless-action');
  });

  test('그 원자가 열지 않은 자리는 바꾸지 못한다', () => {
    const fit = fitAction({
      ...buyMeat,
      changes: [{ domain: 'biological', holderId: traderId, path: 'vitality' }],
    });
    assert.equal(fit.violations[0]?.rule, 'off-atom-change');
    assert.match(fit.violations[0]?.message ?? '', /교환 로는/);
  });

  test('세계에 없는 자리는 바꾸지도 치르지도 못한다', () => {
    const fit = fitAction({
      ...buyMeat,
      changes: [{ domain: 'economic', holderId: hunterId, path: 'karma' }],
    });
    assert.equal(fit.violations[0]?.rule, 'phantom-slot');
    assert.match(changeText({ domain: 'economic', holderId: hunterId, path: 'karma' }), /karma$/);
  });

  test('대가를 적지 않은 요청은 공짜 행동이다', () => {
    const fit = fitAction({ ...buyMeat, payments: [] });
    assert.equal(fit.violations[0]?.rule, 'unpaid-action');
    assert.match(fit.violations[0]?.message ?? '', /verifiable-cost/);
  });

  test('엉뚱한 자리를 내밀어 치른 척할 수 없다', () => {
    const fit = fitAction({
      ...buyMeat,
      payments: [{ domain: 'biological', holderId: hunterId, path: 'vitality' }],
    });
    assert.equal(fit.violations[0]?.rule, 'off-atom-payment');
  });

  test('상대가 있어야 하는 원자에 대상이 없으면 걸린다', () => {
    const fit = fitAction({ ...buyMeat, targetIds: [] });
    assert.equal(fit.violations[0]?.rule, 'targetless-action');
  });

  test('남을 대신 적응시킬 수는 없다', () => {
    const fit = fitAction({
      atom: 'adapt',
      actorId: hunterId,
      targetIds: [traderId],
      changes: [{ domain: 'biological', holderId: traderId, path: 'metabolism' }],
      payments: [{ domain: 'biological', holderId: hunterId, path: 'vitality' }],
      observedIds: [traderId],
    });
    const rules = fit.violations.map((violation) => violation.rule);
    assert.deepEqual(rules, ['self-atom-on-other', 'self-atom-on-other']);
  });

  test('보지 못한 것은 빼앗지 못한다 — 먼저 찾아야 한다', () => {
    const fit = fitAction({
      atom: 'seize',
      actorId: hunterId,
      targetIds: [traderId],
      changes: [{ domain: 'economic', holderId: traderId, path: `stock.${meatId}` }],
      payments: [{ domain: 'relational', holderId: hunterId, path: `trust.${traderId}` }],
      observedIds: [],
    });
    assert.equal(fit.violations[0]?.rule, 'unobserved-action');
    assert.match(fit.violations[0]?.message ?? '', /observed-manipulation/);
    assert.equal(fit.violations.length, 2); // 겨눈 대상과 바꿀 자리의 주인 둘 다
  });

  test('경로는 요청 안의 어디가 막혔는지까지 말한다', () => {
    const fit = fitAction({ ...buyMeat, payments: [] }, '$.plan.steps[2]');
    assert.equal(fit.violations[0]?.path, '$.plan.steps[2].payments');
  });
});

describe('O1 이 열어 둔 자리를 닫는다', () => {
  const affordanceId = deterministicId('affordance', '협곡의 사체');

  test('어포던스의 행동이 원자면 통과한다', () => {
    assert.deepEqual(checkAtomAffordance({ id: affordanceId, action: 'acquire' }), []);
    assert.equal(affordanceAtom({ action: 'acquire' }), 'acquire');
  });

  test('16종 밖의 이름을 여는 어포던스는 거부된다', () => {
    const violations = checkAtomAffordance({ id: affordanceId, action: 'gather' });
    assert.equal(violations[0]?.rule, 'unknown-action');
    assert.equal(violations[0]?.path, '$.affordance.action');
    assert.equal(affordanceAtom({ action: 'gather' }), null);
  });
});
