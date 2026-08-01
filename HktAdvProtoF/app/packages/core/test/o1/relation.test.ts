// O1-c 단위 테스트 — 관계 3종 (Claim · Commitment · Affordance).
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { deterministicId } from '../../src/v1/index.ts';
import {
  classify,
  COMMITMENT_STATES,
  isAffordance,
  isClaim,
  isCommitment,
  isOverdue,
  type Affordance,
  type Claim,
  type Commitment,
  type State,
} from '../../src/o1/index.ts';

const hunterId = deterministicId('subject', 'person', '사냥꾼 04');
const merchantId = deterministicId('subject', 'person', '행상 02');
const herbId = deterministicId('entity', 'material', '붉은 장막');
const rumorId = deterministicId('phenomenon', 'report', '시장의 소문 77');

/** 실제 세계의 사실 — 붉은 장막은 마비독을 품는다. */
const toxinState: State = {
  kind: 'State',
  id: deterministicId('state', herbId, 'biological.toxin'),
  domain: 'biological',
  ofId: herbId,
  path: 'toxin',
  value: '마비독',
};

/** 사냥꾼이 믿는 것 — 소문을 근거로 "치유 효과" 라고 여긴다. 실제와 다르다. */
const healingClaim: Claim = {
  kind: 'Claim',
  id: deterministicId('claim', hunterId, herbId, 'effect'),
  holderId: hunterId,
  aboutId: herbId,
  assertion: '붉은 장막은 치유 효과가 있다',
  confidence: 0.61,
  sourceIds: [rumorId],
};

const deal: Commitment = {
  kind: 'Commitment',
  id: deterministicId('commitment', hunterId, merchantId, 'herb-delivery'),
  fromId: hunterId,
  toId: merchantId,
  obligation: '붉은 장막 다섯 다발을 가져온다',
  reward: '은화 20닢',
  dueTick: 40,
  state: 'accepted',
  breachEffect: '행상이 사냥꾼의 신용을 낮추고 시장에 소문을 낸다',
};

const gather: Affordance = {
  kind: 'Affordance',
  id: deterministicId('affordance', herbId, 'acquire'),
  providerId: herbId,
  action: 'acquire',
  requires: ['둥지 반경에 접근할 수 있다'],
  yields: ['붉은 장막 1다발'],
  cost: 2,
};

function reasons(value: unknown): string[] {
  return classify(value).violations.map((violation) => `${violation.rule} ${violation.path}`);
}

describe('Claim', () => {
  test('온전한 주장은 Claim 으로 분류된다', () => {
    assert.equal(classify(healingClaim).kind, 'Claim');
    assert.ok(isClaim(healingClaim));
  });

  test('실제 상태와 달라도 온전한 원소다 — 틀린 믿음이 곧 콘텐츠다', () => {
    assert.equal(classify(toxinState).kind, 'State');
    assert.equal(classify(healingClaim).kind, 'Claim');
    assert.notEqual(healingClaim.assertion, toxinState.value);
    // 같은 대상에 대한 주장이라는 사실은 id 로 이어져 있다 (R4 가 실제 vs 믿음 diff 를 그린다).
    assert.equal(healingClaim.aboutId, toxinState.ofId);
  });

  test('확신 1 도 허용된다 — 확신은 진실성이 아니다', () => {
    assert.equal(classify({ ...healingClaim, confidence: 1 }).kind, 'Claim');
    assert.deepEqual(reasons({ ...healingClaim, confidence: 1.5 }), ['bad-field $.confidence']);
    assert.deepEqual(reasons({ ...healingClaim, confidence: -0.1 }), ['bad-field $.confidence']);
  });

  test('근거 없는 믿음도 주장이다 — 다만 근거가 없다는 사실이 남는다', () => {
    const hunch = { ...healingClaim, sourceIds: [] };
    assert.equal(classify(hunch).kind, 'Claim');
    assert.equal(hunch.sourceIds.length, 0);
    assert.deepEqual(reasons({ ...healingClaim, sourceIds: ['소문'] }), ['bad-field $.sourceIds[0]']);
  });

  test('믿는 주체와 대상은 비울 수 없다', () => {
    assert.deepEqual(reasons({ ...healingClaim, holderId: null }), ['bad-field $.holderId']);
    assert.deepEqual(reasons({ ...healingClaim, assertion: '' }), ['bad-field $.assertion']);
  });
});

describe('Commitment', () => {
  test('온전한 약속은 Commitment 로 분류된다', () => {
    assert.equal(classify(deal).kind, 'Commitment');
    assert.ok(isCommitment(deal));
  });

  test('다섯 상태 전이 모두 통과한다', () => {
    assert.deepEqual(
      [...COMMITMENT_STATES],
      ['proposed', 'accepted', 'fulfilled', 'breached', 'expired'],
    );
    for (const state of COMMITMENT_STATES) {
      assert.equal(classify({ ...deal, state }).kind, 'Commitment', state);
    }
  });

  test('위반 결과 없는 약속은 약속이 아니다', () => {
    assert.deepEqual(reasons({ ...deal, breachEffect: '' }), ['bad-field $.breachEffect']);
  });

  test('자기 자신과는 약속할 수 없다 — 위반을 물을 상대가 없다', () => {
    assert.deepEqual(reasons({ ...deal, toId: hunterId }), ['bad-field $.toId']);
  });

  test('기한이 지난 약속은 값으로 구별된다', () => {
    assert.ok(!isOverdue(deal, 40));
    assert.ok(isOverdue(deal, 41));
    // 이미 끝난 약속은 늦을 수 없다.
    assert.ok(!isOverdue({ ...deal, state: 'fulfilled' }, 99));
    assert.ok(!isOverdue({ ...deal, dueTick: null }, 99));
  });

  test('기한 없는 약속은 dueTick 이 null 이다', () => {
    assert.equal(classify({ ...deal, dueTick: null }).kind, 'Commitment');
    assert.deepEqual(reasons({ ...deal, dueTick: -1 }), ['bad-field $.dueTick']);
  });
});

describe('Affordance', () => {
  test('온전한 어포던스는 Affordance 로 분류된다', () => {
    assert.equal(classify(gather).kind, 'Affordance');
    assert.ok(isAffordance(gather));
  });

  test('비용 없는 가능성은 거부된다 — 공짜 행동은 세계를 붕괴시킨다', () => {
    assert.deepEqual(reasons({ ...gather, cost: 0 }), ['bad-field $.cost']);
    assert.deepEqual(reasons({ ...gather, cost: -1 }), ['bad-field $.cost']);
    assert.equal(classify({ ...gather, cost: 0.01 }).kind, 'Affordance');
  });

  test('얻는 것 없는 어포던스는 아무도 고르지 않는다', () => {
    assert.deepEqual(reasons({ ...gather, yields: [] }), ['bad-field $.yields']);
  });

  test('선행 조건은 비어 있어도 된다 — 조건 없이 가능한 행동도 있다', () => {
    assert.equal(classify({ ...gather, requires: [] }).kind, 'Affordance');
    assert.deepEqual(reasons({ ...gather, requires: undefined }), ['missing-field $.requires']);
  });

  test('제공자는 결정적 ID 여야 한다', () => {
    assert.deepEqual(reasons({ ...gather, providerId: '붉은 장막' }), ['bad-field $.providerId']);
  });
});

describe('관계 3종이 한 장면에서 만난다', () => {
  test('틀린 주장 · 기한 있는 약속 · 비용 있는 어포던스가 서로 다른 값으로 선다', () => {
    const nodes = [healingClaim, deal, gather] as const;
    assert.deepEqual(
      nodes.map((node) => classify(node).kind),
      ['Claim', 'Commitment', 'Affordance'],
    );
    // 셋 다 사냥꾼 하나를 둘러싸고 걸린다 — 믿음, 약속, 가능한 행동.
    assert.equal(healingClaim.holderId, hunterId);
    assert.equal(deal.fromId, hunterId);
    assert.equal(gather.providerId, healingClaim.aboutId);
  });
});
