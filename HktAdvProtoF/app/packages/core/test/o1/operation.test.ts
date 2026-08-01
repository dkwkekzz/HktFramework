// O1-b 단위 테스트 — 작동 3종 (Rule · Event · Phenomenon).
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { deterministicId } from '../../src/v1/index.ts';
import {
  classify,
  isEvent,
  isPhenomenon,
  isRule,
  PHENOMENON_CHANNELS,
  type Event,
  type Phenomenon,
  type Rule,
} from '../../src/o1/index.ts';

const hunterId = deterministicId('subject', 'person', '사냥꾼 04');
const nestId = deterministicId('entity', 'place', '붉은 장막 둥지');
const hungerStateId = deterministicId('state', hunterId, 'biological.hunger');

const toxinRule: Rule = {
  kind: 'Rule',
  id: deterministicId('rule', 'ecology', '붉은 장막 독성'),
  domain: 'ecological',
  name: '붉은 장막은 마비독을 품는다',
  when: ['붉은 장막이 둥지 반경에서 자란다'],
  then: ['섭취한 주체의 biological.paralysis 가 오른다'],
  axiomId: null,
};

const forageEvent: Event = {
  kind: 'Event',
  id: deterministicId('event', 12, hunterId, 'forage'),
  tick: 12,
  name: '사냥꾼이 붉은 장막을 채집했다',
  actorId: hunterId,
  changedStateIds: [hungerStateId],
  causeIds: [toxinRule.id],
};

const rustle: Phenomenon = {
  kind: 'Phenomenon',
  id: deterministicId('phenomenon', forageEvent.id, 'sound'),
  channel: 'sound',
  causeEventId: forageEvent.id,
  placeId: nestId,
  intensity: 0.4,
  decaysAtTick: 15,
};

function reasons(value: unknown): string[] {
  return classify(value).violations.map((violation) => `${violation.rule} ${violation.path}`);
}

describe('Rule', () => {
  test('온전한 규칙은 Rule 로 분류된다', () => {
    assert.equal(classify(toxinRule).kind, 'Rule');
    assert.ok(isRule(toxinRule));
  });

  test('조건 없는 규칙은 거부된다 — 항상 발동하는 규칙은 규칙이 아니다', () => {
    assert.deepEqual(reasons({ ...toxinRule, when: [] }), ['bad-field $.when']);
  });

  test('효과 없는 규칙은 거부된다 — 세계를 바꾸지 않는다', () => {
    assert.deepEqual(reasons({ ...toxinRule, then: [] }), ['bad-field $.then']);
  });

  test('공리를 근거로 달 수 있다 (O0)', () => {
    const axiomId = deterministicId('axiom', '생명은 의념을 발생시킨다');
    assert.equal(classify({ ...toxinRule, axiomId }).kind, 'Rule');
    assert.deepEqual(reasons({ ...toxinRule, axiomId: '공리1' }), ['bad-field $.axiomId']);
  });

  test('영역과 서술을 어기면 경로와 함께 거부된다', () => {
    assert.deepEqual(reasons({ ...toxinRule, domain: 'magical' }), ['bad-field $.domain']);
    assert.deepEqual(reasons({ ...toxinRule, when: '독성' }), ['bad-field $.when']);
    assert.deepEqual(reasons({ ...toxinRule, then: [''] }), ['bad-field $.then[0]']);
  });
});

describe('Event', () => {
  test('온전한 사건은 Event 로 분류된다', () => {
    assert.equal(classify(forageEvent).kind, 'Event');
    assert.ok(isEvent(forageEvent));
  });

  test('상태를 하나도 바꾸지 않으면 사건이 아니다', () => {
    assert.deepEqual(reasons({ ...forageEvent, changedStateIds: [] }), [
      'bad-field $.changedStateIds',
    ]);
  });

  test('자연 발생 사건은 행위자가 없다', () => {
    assert.equal(classify({ ...forageEvent, actorId: null }).kind, 'Event');
  });

  test('최초 사건은 원인이 비어 있을 수 있다 — 없는 것과 안 적은 것은 다르다', () => {
    assert.equal(classify({ ...forageEvent, causeIds: [] }).kind, 'Event');
    assert.deepEqual(reasons({ ...forageEvent, causeIds: undefined }), [
      'missing-field $.causeIds',
    ]);
  });

  test('틱은 0 이상의 정수다 — 시간은 되돌지 않는다', () => {
    assert.equal(classify({ ...forageEvent, tick: 0 }).kind, 'Event');
    assert.deepEqual(reasons({ ...forageEvent, tick: -1 }), ['bad-field $.tick']);
    assert.deepEqual(reasons({ ...forageEvent, tick: 1.5 }), ['bad-field $.tick']);
  });

  test('바뀐 상태 목록의 항목도 결정적 ID 여야 한다', () => {
    assert.deepEqual(reasons({ ...forageEvent, changedStateIds: [hungerStateId, '허기'] }), [
      'bad-field $.changedStateIds[1]',
    ]);
  });
});

describe('Phenomenon', () => {
  test('온전한 현상은 Phenomenon 으로 분류된다', () => {
    assert.equal(classify(rustle).kind, 'Phenomenon');
    assert.ok(isPhenomenon(rustle));
  });

  test('여섯 통로 모두 통과한다', () => {
    assert.equal(PHENOMENON_CHANNELS.length, 6);
    for (const channel of PHENOMENON_CHANNELS) {
      assert.equal(classify({ ...rustle, channel }).kind, 'Phenomenon', channel);
    }
  });

  test('원인 없는 현상은 없다 — 사건 id 는 비울 수 없다', () => {
    assert.deepEqual(reasons({ ...rustle, causeEventId: null }), ['bad-field $.causeEventId']);
    assert.deepEqual(reasons({ ...rustle, causeEventId: undefined }), [
      'missing-field $.causeEventId',
    ]);
  });

  test('세기는 0~1 이다 — 감지 임계와 비교되어야 한다', () => {
    assert.equal(classify({ ...rustle, intensity: 0 }).kind, 'Phenomenon');
    assert.equal(classify({ ...rustle, intensity: 1 }).kind, 'Phenomenon');
    assert.deepEqual(reasons({ ...rustle, intensity: 1.2 }), ['bad-field $.intensity']);
    assert.deepEqual(reasons({ ...rustle, intensity: '강함' }), ['bad-field $.intensity']);
  });

  test('사라지지 않는 흔적은 소멸 틱이 null 이다', () => {
    assert.equal(classify({ ...rustle, decaysAtTick: null }).kind, 'Phenomenon');
    assert.deepEqual(reasons({ ...rustle, decaysAtTick: -3 }), ['bad-field $.decaysAtTick']);
  });
});

describe('규칙 → 사건 → 현상 사슬', () => {
  test('셋이 id 로 이어져 "왜 이 소리가 났는가" 를 되짚을 수 있다', () => {
    assert.equal(rustle.causeEventId, forageEvent.id);
    assert.ok(forageEvent.causeIds.includes(toxinRule.id));
    assert.ok(forageEvent.changedStateIds.includes(hungerStateId));
    for (const node of [toxinRule, forageEvent, rustle]) {
      assert.equal(classify(node).kind, node.kind);
    }
  });

  test('사슬의 어느 고리를 끊어도 그 고리에서 걸린다', () => {
    assert.deepEqual(reasons({ ...rustle, causeEventId: forageEvent.id.replace(':', '_') }), [
      'bad-field $.causeEventId',
    ]);
  });
});
