// R5-a 단위 테스트 — 다시 볼 수 없게 된 것이 기억이 되고, 겪은 자만 상대를 짚는다.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { deterministicId } from '../../src/v1/index.ts';
import { buildGrammar, type PossibilityGrammar } from '../../src/p2/index.ts';
import type { ActionAtom } from '../../src/p0/index.ts';
import type { WorldEvent } from '../../src/r1/index.ts';
import type { WorldPhenomenon } from '../../src/r2/index.ts';
import type { Belief } from '../../src/r4/index.ts';
import {
  MEMORY_TRUTH_FIELDS,
  checkMemory,
  liveMemory,
  livedSlots,
  memoryConfidence,
  memoryIdOf,
  narrowingCap,
  sealAll,
  sealMemory,
  suffered,
  type Memory,
  type MemoryViolation,
} from '../../src/r5/index.ts';

const strikerId = deterministicId('subject', 'person', '몰이꾼 04');
const victimId = deterministicId('subject', 'person', '상단 11');
const canyonId = deterministicId('entity', 'place', '협곡');
const traceId = deterministicId('phenomenon', '자국');

const eventOf = (overrides: Partial<WorldEvent> = {}): WorldEvent => ({
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
    { kind: 'payment', domain: 'biological', holderId: strikerId, path: 'vitality', from: 0.7, to: 0.6 },
  ],
  ...overrides,
});

const beliefOf = (overrides: Partial<Belief> = {}): Belief => ({
  kind: 'Claim',
  id: deterministicId('claim', victimId, traceId),
  holderId: victimId,
  aboutId: traceId,
  assertion: '무언가 있었다',
  confidence: 0.4,
  sourceIds: [deterministicId('percept', victimId, traceId)],
  channel: 'trace',
  placeId: canyonId,
  candidates: ['destroy', 'seize', 'protect'],
  suspected: ['destroy', 'seize', 'protect'],
  narrowedBy: 'none',
  observations: 1,
  firstTick: 415,
  lastTick: 415,
  intensity: 0.6,
  factors: [],
  ...overrides,
});

const phenomenonOf = (overrides: Partial<WorldPhenomenon> = {}): WorldPhenomenon => ({
  kind: 'Phenomenon',
  id: traceId,
  channel: 'trace',
  causeEventId: deterministicId('event', '친다'),
  placeId: canyonId,
  intensity: 0.6,
  decaysAtTick: 427,
  atom: 'destroy',
  atTick: 415,
  actorId: strikerId,
  domain: 'biological',
  holderId: victimId,
  path: 'vitality',
  effectKind: 'change',
  ambiguity: 0.73,
  ...overrides,
});

const bareGrammar = (denied: readonly ActionAtom[] = []): PossibilityGrammar => {
  const base = buildGrammar({
    archetype: {
      id: deterministicId('species', '사람'),
      name: '사람',
      subjectKind: 'person',
    } as never,
  });
  if (denied.length === 0) return base;
  return {
    ...base,
    allowed: base.allowed.filter((atom) => !denied.includes(atom)),
    denied: [...base.denied, ...denied],
  };
};

const graphOf = (beliefs: readonly Belief[]) => ({
  beliefs,
  bySubject: new Map(),
  byPhenomenon: new Map(),
});

const rulesOf = (violations: readonly MemoryViolation[]): readonly string[] => [
  ...new Set(violations.map((violation) => violation.rule)),
];

describe('R5-a 겪은 자만 누구인지 안다', () => {
  test('남이 낸 사건이 내 자리를 바꿨으면 겪은 것이다', () => {
    assert.equal(suffered(eventOf(), victimId), true);
  });

  test('제 손으로 낸 사건은 겪음이 아니다 — 그것은 한 일이다', () => {
    assert.equal(suffered(eventOf(), strikerId), false);
  });

  test('내 자리를 하나도 바꾸지 않은 사건은 겪은 것이 아니다', () => {
    const bystanderId = deterministicId('subject', 'person', '사제');
    assert.equal(suffered(eventOf(), bystanderId), false);
    assert.deepEqual(livedSlots(eventOf(), bystanderId), []);
  });

  test('겪지 않은 사건으로 지목을 세우면 unlived-attribution 으로 걸린다', () => {
    const result = liveMemory(eventOf(), strikerId, null);
    assert.equal(result.memory, null);
    assert.deepEqual(rulesOf(result.violations), ['unlived-attribution']);
  });

  test('겪음이 주는 것은 지목뿐이다 — 무엇이었는지는 여전히 짐작이다', () => {
    const result = liveMemory(eventOf(), victimId, null);
    const memory = result.memory as Memory;
    assert.equal(memory.attribution?.subjectId, strikerId);
    assert.equal(memory.attribution?.source, 'lived');
    assert.equal(memory.ground, 'lived');
    assert.equal(memory.hops, 0);
    // 제 몸이 깎인 것은 알아도 무엇이 깎았는지는 후보로 남는다
    assert.ok(memory.candidates.length > 1, '후보가 하나로 좁혀지지 않는다');
    assert.ok(memory.suspected.includes('destroy'));
  });

  test('겪은 자도 제 문법이 좁힌다 — 죽이지 않는 자에게는 그 후보가 없다', () => {
    const wide = liveMemory(eventOf(), victimId, null).memory as Memory;
    const priestly = liveMemory(eventOf(), victimId, bareGrammar(['destroy'])).memory as Memory;
    assert.ok(wide.suspected.includes('destroy'));
    assert.equal(priestly.suspected.includes('destroy'), false);
    assert.equal(priestly.narrowedBy, 'grammar');
    // 좁혀졌으므로 확신이 오른다 — 그러나 그는 틀린다 (실제는 제거였다)
    assert.ok(priestly.confidence > wide.confidence);
  });

  test('확신은 좁힘을 넘지 못한다 — 겪었어도 흐린 것은 흐리다', () => {
    const memory = liveMemory(eventOf(), victimId, null).memory as Memory;
    assert.equal(memory.carried, 1);
    assert.equal(memory.confidence, narrowingCap(memory.suspected));
    assert.ok(memory.confidence < 1, '겪었다고 확신 1 이 되지는 않는다');
  });

  test('제 자리가 무엇이었는지는 제가 안다 — 그것은 제 장부다', () => {
    const memory = liveMemory(eventOf(), victimId, null).memory as Memory;
    assert.equal(memory.slot, 'biological.vitality');
    for (const field of MEMORY_TRUTH_FIELDS) {
      assert.equal(Object.hasOwn(memory, field), false, `${field} 가 기억에 실렸다`);
    }
  });
});

describe('R5-a 다시 볼 수 없게 된 믿음이 기억이다', () => {
  test('사라지지 않는 자국의 믿음은 기억이 되지 않는다 — 가서 보면 된다', () => {
    const sealed = sealMemory(beliefOf(), phenomenonOf({ decaysAtTick: null }));
    assert.equal(sealed.memory, null);
    assert.deepEqual(rulesOf(sealed.violations), ['unsealed-memory']);
  });

  test('자국이 삭으면 굳는다 — 굳는 틱은 자국이 삭은 틱이다', () => {
    const memory = sealMemory(beliefOf(), phenomenonOf()).memory as Memory;
    assert.equal(memory.ground, 'seen');
    assert.equal(memory.sealedAtTick, 427);
    assert.equal(memory.atTick, 415);
  });

  test('본 것에는 지목이 붙지 않는다 — 그것이 R4 가 남긴 자리다', () => {
    const memory = sealMemory(beliefOf(), phenomenonOf()).memory as Memory;
    assert.equal(memory.attribution, null);
  });

  test('기억은 바래지 않는다 — 믿음의 확신을 그대로 진다', () => {
    const belief = beliefOf({ confidence: 0.31, suspected: ['destroy'] });
    const memory = sealMemory(belief, phenomenonOf()).memory as Memory;
    assert.equal(memory.carried, 0.31);
    assert.equal(memory.confidence, memoryConfidence(0.31, ['destroy']));
  });

  test('sealAll 은 R4-c 가 고른 것에서만 굳힌다 — 서 있는 자국은 남긴다', () => {
    const standingId = deterministicId('phenomenon', '서 있는 자국');
    const field = {
      phenomena: [
        phenomenonOf(),
        phenomenonOf({ id: standingId, decaysAtTick: 500 }),
      ],
    } as never;
    const result = sealAll(
      graphOf([beliefOf(), beliefOf({ id: 'b2', aboutId: standingId })]) as never,
      field,
      430,
    );
    assert.equal(result.memories.length, 1, '삭은 자국 하나만 굳는다');
    assert.equal(result.memories[0]?.aboutId, traceId);
    const kept = result.sealings.find((sealing) => sealing.memory === null);
    assert.ok(kept?.reason.includes('아직 서 있다'));
  });
});

describe('R5-a 설 수 없는 기억이 걸린다', () => {
  const good = (): Memory => liveMemory(eventOf(), victimId, null).memory as Memory;

  const check = (memory: Memory, tick?: number): readonly string[] => {
    const out: MemoryViolation[] = [];
    checkMemory(memory, out, tick === undefined ? {} : { tick });
    return rulesOf(out);
  };

  test('선 기억은 아무 사유도 내지 않는다', () => {
    assert.deepEqual(check(good()), []);
  });

  test('근거 없이 선 기억', () => {
    assert.ok(check({ ...good(), sourceIds: [] }).includes('groundless-memory'));
  });

  test('지닌 자가 없는 기억', () => {
    assert.ok(check({ ...good(), holderId: '' }).includes('unheld-memory'));
  });

  test('아직 오지 않은 일의 기억', () => {
    assert.ok(check(good(), 400).includes('future-memory'));
  });

  test('손으로 고친 확신 — 기억은 바래지 않는다', () => {
    assert.ok(check({ ...good(), confidence: 0.99 }).includes('memory-drift'));
  });

  test('본 것만으로 상대를 짚으면 guessed-attribution', () => {
    const seen = sealMemory(beliefOf(), phenomenonOf()).memory as Memory;
    const forged: Memory = {
      ...seen,
      attribution: {
        subjectId: strikerId,
        source: 'told',
        eventId: null,
        viaIds: [strikerId],
        note: '',
      },
    };
    assert.ok(check(forged).includes('guessed-attribution'));
  });

  test('들었다는데 거쳐 온 입이 없으면 걸린다', () => {
    const forged: Memory = {
      ...good(),
      ground: 'told',
      hops: 1,
      attribution: { subjectId: strikerId, source: 'told', eventId: null, viaIds: [], note: '' },
    };
    assert.ok(check(forged).includes('guessed-attribution'));
  });

  test('후보 밖의 원자를 짚으면 진실이 실린 것이다', () => {
    assert.ok(check({ ...good(), suspected: ['persuade'] }).includes('memory-truth-copied'));
  });

  test('믿음에 없던 진실이 실리면 걸린다', () => {
    const leaked = { ...good(), actorId: strikerId } as unknown as Memory;
    assert.ok(check(leaked).includes('memory-truth-copied'));
  });

  test('제 눈으로 본 것에 거친 입이 붙으면 걸린다', () => {
    assert.ok(check({ ...good(), hops: 2 }).includes('hopless-chain'));
  });

  test('같은 지닌 자·같은 뿌리면 같은 기억이다 (V1 결정적 id)', () => {
    assert.equal(memoryIdOf(victimId, traceId), memoryIdOf(victimId, traceId));
    assert.notEqual(memoryIdOf(victimId, traceId), memoryIdOf(strikerId, traceId));
  });
});
