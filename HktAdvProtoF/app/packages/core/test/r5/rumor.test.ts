// R5-c 단위 테스트 — 말은 흔적이 되고, 내용은 좁혀지고, 지목은 그대로 실린다.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { deterministicId } from '../../src/v1/index.ts';
import { buildGrammar, type PossibilityGrammar } from '../../src/p2/index.ts';
import type { ActionAtom } from '../../src/p0/index.ts';
import { TRACE_LIFESPAN } from '../../src/r2/index.ts';
import type { Percept } from '../../src/r3/index.ts';
import type { WorldEvent } from '../../src/r1/index.ts';
import {
  auditMemories,
  checkHearsay,
  compareBlame,
  hear,
  liveMemory,
  openMemoryLedger,
  openRumorField,
  recordMemories,
  recordTelling,
  rumorDecay,
  speak,
  storiesOf,
  storyVariants,
  unattributed,
  unheard,
  unspoken,
  type Memory,
  type MemoryViolation,
  type Telling,
} from '../../src/r5/index.ts';

const strikerId = deterministicId('subject', 'person', '몰이꾼 04');
const victimId = deterministicId('subject', 'person', '상단 11');
const priestId = deterministicId('subject', 'person', '사제');
const traderId = deterministicId('subject', 'person', '이웃 상단');
const hamletId = deterministicId('entity', 'place', '마을');

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

const lived = (): Memory => liveMemory(strike, victimId, null).memory as Memory;

const spoken = (tick = 420) =>
  speak({
    memory: lived(),
    speakerId: victimId,
    tick,
    placeId: hamletId,
    causeEventId: strike.id,
    actualAtom: strike.atom,
    actualActorId: strikerId,
  });

const perceptOf = (listenerId: string, phenomenonId: string, overrides: Partial<Percept> = {}): Percept => ({
  id: deterministicId('percept', listenerId, phenomenonId),
  subjectId: listenerId,
  phenomenonId,
  channel: 'report',
  intensity: 0.5,
  placeId: hamletId,
  distance: 0,
  atTick: 421,
  ambiguity: 0.5,
  ...overrides,
});

const rulesOf = (violations: readonly MemoryViolation[]): readonly string[] => [
  ...new Set(violations.map((violation) => violation.rule)),
];

describe('R5-c 말은 흔적이 된다', () => {
  test('말하면 report 통로의 흔적이 나고 세기는 말하는 자의 확신이다', () => {
    const result = spoken();
    const phenomenon = result.phenomenon as NonNullable<typeof result.phenomenon>;
    assert.equal(phenomenon.channel, 'report');
    assert.equal(phenomenon.domain, 'informational');
    assert.ok(phenomenon.path.startsWith('rumorSpread.'));
    assert.equal(phenomenon.intensity, lived().carried, '힘줘 말하는 것과 좁게 말하는 것은 다르다');
    assert.ok((result.telling as Telling).confidence < phenomenon.intensity, '말에 실리는 확신은 좁혀진 값이다');
    assert.equal(phenomenon.causeEventId, strike.id, '흔적은 원인 없이 나지 않는다');
  });

  test('말은 사라지지 않는 자국이 되지 않는다 — 정보 자리는 되돌릴 수 있다', () => {
    const phenomenon = spoken().phenomenon as NonNullable<ReturnType<typeof spoken>['phenomenon']>;
    assert.notEqual(phenomenon.decaysAtTick, null);
    assert.equal(phenomenon.decaysAtTick, rumorDecay(420, phenomenon.intensity));
    assert.ok((phenomenon.decaysAtTick as number) <= 420 + TRACE_LIFESPAN);
  });

  test('지니지 않은 기억은 말할 수 없다', () => {
    const result = speak({
      memory: lived(),
      speakerId: priestId,
      tick: 420,
      placeId: hamletId,
      causeEventId: strike.id,
      actualAtom: strike.atom,
      actualActorId: strikerId,
    });
    assert.equal(result.telling, null);
    assert.deepEqual(rulesOf(result.violations), ['unspoken-telling']);
  });

  test('아직 오지 않은 일은 말할 수 없다', () => {
    const result = spoken(400);
    assert.equal(result.telling, null);
    assert.deepEqual(rulesOf(result.violations), ['future-memory']);
  });
});

describe('R5-c 내용은 좁혀지고 지목은 그대로 실린다', () => {
  test('들으면 기억이 서고 거친 입이 하나 는다', () => {
    const said = spoken();
    const telling = said.telling as Telling;
    const heard = hear(perceptOf(priestId, telling.phenomenonId), telling, null).memory as Memory;
    assert.equal(heard.ground, 'told');
    assert.equal(heard.hops, 1);
    assert.equal(heard.holderId, priestId);
    assert.deepEqual([...heard.candidates], [...telling.claim]);
  });

  test('낼 손이 없는 일은 남의 말에서도 떠오르지 않는다', () => {
    const telling = spoken().telling as Telling;
    const wide = hear(perceptOf(priestId, telling.phenomenonId), telling, null).memory as Memory;
    const priestly = hear(
      perceptOf(priestId, telling.phenomenonId),
      telling,
      bareGrammar(['destroy', 'seize']),
    ).memory as Memory;
    assert.ok(wide.suspected.includes('destroy'));
    assert.equal(priestly.suspected.includes('destroy'), false);
    assert.equal(priestly.narrowedBy, 'grammar');
  });

  test('무슨 일이 있었는지는 모르는데 누구 탓인지는 안다', () => {
    const telling = spoken().telling as Telling;
    const heard = hear(
      perceptOf(priestId, telling.phenomenonId),
      telling,
      bareGrammar(['destroy', 'seize']),
    ).memory as Memory;
    assert.equal(heard.attribution?.subjectId, strikerId, '지목은 좁혀지지 않는다');
    assert.equal(heard.attribution?.source, 'told');
    assert.deepEqual([...(heard.attribution?.viaIds ?? [])], [victimId]);
    assert.ok(heard.suspected.length > 1, '무엇이었는지는 여전히 여럿이다');
  });

  test('거쳐서 진해질 수는 없다 — 말한 자의 확신과 귀에 닿은 세기 중 작은 쪽이다', () => {
    const telling = spoken().telling as Telling;
    const loud = hear(perceptOf(priestId, telling.phenomenonId, { intensity: 1 }), telling, null)
      .memory as Memory;
    const faint = hear(perceptOf(priestId, telling.phenomenonId, { intensity: 0.05 }), telling, null)
      .memory as Memory;
    assert.equal(loud.carried, telling.confidence);
    assert.equal(faint.carried, 0.05);
    assert.ok(faint.confidence < loud.confidence);
  });

  test('듣지 않은 말에서는 기억이 서지 않는다 — R4 의 벽은 그대로다', () => {
    const telling = spoken().telling as Telling;
    const result = hear(perceptOf(priestId, '다른 흔적'), telling, null);
    assert.equal(result.memory, null);
    assert.deepEqual(rulesOf(result.violations), ['unheard-telling']);
  });

  test('제 말을 제가 들어 기억을 세울 수는 없다', () => {
    const telling = spoken().telling as Telling;
    const result = hear(perceptOf(victimId, telling.phenomenonId), telling, null);
    assert.equal(result.memory, null);
    assert.deepEqual(rulesOf(result.violations), ['unheard-telling']);
  });

  test('거쳐서 넓히거나 지목을 바꾸면 걸린다', () => {
    const telling = spoken().telling as Telling;
    const heard = hear(perceptOf(priestId, telling.phenomenonId), telling, null).memory as Memory;
    const widened: Memory = { ...heard, suspected: [...heard.suspected, 'persuade'] };
    const louder: Memory = { ...heard, carried: 1 };
    const reblamed: Memory = {
      ...heard,
      attribution: { ...(heard.attribution as NonNullable<Memory['attribution']>), subjectId: priestId },
    };
    const check = (memory: Memory) => {
      const out: MemoryViolation[] = [];
      checkHearsay(memory, telling, out);
      return rulesOf(out);
    };
    assert.ok(check(widened).includes('widened-hearsay'));
    assert.ok(check(louder).includes('louder-hearsay'));
    assert.ok(check(reblamed).includes('guessed-attribution'));
    assert.deepEqual(check(heard), []);
  });
});

describe('R5-c 하나의 사건이 여러 이야기가 된다', () => {
  /** 11 이 말하고 사제가 듣고, 사제가 다시 말하고 이웃 상단이 듣는다. */
  const chain = () => {
    const first = spoken();
    let rumors = recordTelling(
      openRumorField(),
      first.telling as Telling,
      first.phenomenon as NonNullable<typeof first.phenomenon>,
    );
    const priestly = hear(
      perceptOf(priestId, (first.telling as Telling).phenomenonId),
      first.telling as Telling,
      bareGrammar(['destroy', 'seize']),
    ).memory as Memory;
    const second = speak({
      memory: priestly,
      speakerId: priestId,
      tick: 424,
      placeId: hamletId,
      causeEventId: strike.id,
      actualAtom: strike.atom,
      actualActorId: strikerId,
    });
    rumors = recordTelling(
      rumors,
      second.telling as Telling,
      second.phenomenon as NonNullable<typeof second.phenomenon>,
    );
    const distant = hear(
      perceptOf(traderId, (second.telling as Telling).phenomenonId, { atTick: 425 }),
      second.telling as Telling,
      bareGrammar(['coerce']),
    ).memory as Memory;
    return { rumors, memories: [lived(), priestly, distant] };
  };

  test('거칠수록 입이 늘고 이야기가 갈린다', () => {
    const { memories } = chain();
    assert.deepEqual(
      memories.map((memory) => memory.hops),
      [0, 1, 2],
    );
    const stories = storiesOf(memories, [strike.id]);
    assert.equal(stories.length, 3);
    assert.equal(storyVariants(stories), 3, '셋이 서로 다른 이야기를 지녔다');
  });

  test('셋 다 04 를 짚는다 — 지목만은 거쳐도 줄지 않는다', () => {
    const { memories } = chain();
    const stories = storiesOf(memories, [strike.id]);
    assert.deepEqual(
      stories.map((story) => story.blames),
      [strikerId, strikerId, strikerId],
    );
  });

  test('내용은 거칠수록 줄어든다', () => {
    const { memories } = chain();
    const widths = memories.map((memory) => memory.suspected.length);
    assert.ok(widths[0] !== undefined && widths[1] !== undefined && widths[2] !== undefined);
    assert.ok((widths[1] as number) < (widths[0] as number), '한 입 거치며 좁아진다');
    assert.ok((widths[2] as number) < (widths[1] as number), '두 입 거치며 더 좁아진다');
  });

  test('지목은 맞은 채로 두 입을 건넌다 — 그래서 겪지 않은 둘도 04 를 원망한다', () => {
    const { memories } = chain();
    const ledger = recordMemories(openMemoryLedger(), memories);
    const checks = compareBlame(ledger, new Map([[strike.id, strikerId]]));
    assert.equal(checks.length, 3);
    assert.deepEqual(
      checks.map((check) => check.verdict),
      ['right', 'right', 'right'],
    );
  });

  test('틀린 지목은 위반이 아니라 사실로 센다', () => {
    const { memories, rumors } = chain();
    const ledger = recordMemories(openMemoryLedger(), memories);
    const checks = compareBlame(ledger, new Map([[strike.id, priestId]]));
    assert.deepEqual(
      checks.map((check) => check.verdict),
      ['wrong', 'wrong', 'wrong'],
    );
    const audit = auditMemories({
      ledger,
      rumors,
      heardPhenomenonIds: rumors.phenomena.map((phenomenon) => phenomenon.id),
      tick: 430,
    });
    assert.deepEqual(audit.violations, [], '빗나간 지목은 감사가 세지 않는다');
  });
});

describe('R5-c 기억장 감사 — 사실 쪽이 절반이다', () => {
  test('빈 기억장은 아무 어긋남도 내지 않는다', () => {
    const audit = auditMemories({
      ledger: openMemoryLedger(),
      rumors: openRumorField(),
      heardPhenomenonIds: [],
      tick: 430,
    });
    assert.equal(audit.recorded, 0);
    assert.deepEqual(audit.violations, []);
  });

  test('아무도 듣지 못한 말은 위반이 아니라 사실이다', () => {
    const said = spoken();
    const rumors = recordTelling(
      openRumorField(),
      said.telling as Telling,
      said.phenomenon as NonNullable<typeof said.phenomenon>,
    );
    const ledger = recordMemories(openMemoryLedger(), [lived()]);
    const audit = auditMemories({ ledger, rumors, heardPhenomenonIds: [], tick: 430 });
    assert.equal(audit.unheard, 1);
    assert.deepEqual(audit.violations, []);
    assert.equal(unheard(rumors, []).length, 1);
  });

  test('아무도 말하지 않은 기억이 대부분이다', () => {
    const ledger = recordMemories(openMemoryLedger(), [lived()]);
    assert.equal(unspoken(ledger, openRumorField()).length, 1);
  });

  test('지목 없는 기억은 사실로 센다', () => {
    const anonymous: Memory = { ...lived(), id: 'anon', attribution: null, ground: 'seen', slot: null };
    const ledger = recordMemories(openMemoryLedger(), [anonymous]);
    assert.equal(unattributed(ledger).length, 1);
    assert.equal(ledger.memories.length, 1);
  });

  test('같은 id 는 늘어나지 않고 갈아 끼워진다', () => {
    const ledger = recordMemories(openMemoryLedger(), [lived()]);
    const again = recordMemories(ledger, [lived()]);
    assert.equal(again.memories.length, 1);
  });

  test('들었다는데 소문장에 그 말이 없으면 걸린다', () => {
    const orphan: Memory = { ...lived(), ground: 'told', hops: 1, sourceIds: ['없는 말'] };
    const ledger = recordMemories(openMemoryLedger(), [orphan]);
    const audit = auditMemories({
      ledger,
      rumors: openRumorField(),
      heardPhenomenonIds: [],
      tick: 430,
    });
    assert.ok(rulesOf(audit.violations).includes('unheard-telling'));
  });
});
