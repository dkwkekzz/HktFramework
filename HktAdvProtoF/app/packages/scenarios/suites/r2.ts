// R2 검증 시나리오 3종 — 흔적이 나는가, 원인 없는 흔적이 막히는가, 침묵이 허용되는가.

import { stateHash } from '@hkt/core/v1';
import {
  fieldVerdict,
  leakVerdict,
  phenomenonLine,
  standingAt,
  type WorldPhenomenon,
} from '@hkt/core/r2';

import {
  defineScenario,
  expectDeterministic,
  expectState,
  expectTrue,
  type Assertion,
} from '../src/index.ts';

import {
  BROKEN_PHENOMENA,
  DECAY_WALK,
  LEAK_REPORT,
  NOW,
  SILENT_SEEK,
  UNSEALED_WORLD,
  VEIL_AUDIT,
  VEIL_FIELD,
  VEIL_LOG,
  VEIL_SCENES,
  actorId,
  rivalId,
} from './r2-veil-phenomena.ts';

const channelsOf = (phenomena: readonly WorldPhenomenon[]): readonly string[] => [
  ...new Set(phenomena.map((phenomenon) => phenomenon.channel)),
];

/** 정상 — 겨울이 흔적을 남기고, 앎만은 남기지 않는다. */
export const r2EventsLeaveTraces = defineScenario({
  id: 'r2-events-leave-traces',
  module: 'R2',
  kind: 'normal',
  purpose:
    'R1 의 다섯 사건은 세계를 바꿨을 뿐 아무도 보지 못했다 — 같은 다섯을 흔적으로 읽으면 통로 넷으로 열다섯이 나고, 그중 앎에서 나온 것은 하나도 없다. 새는 것은 그것을 얻느라 닳은 몸뿐이다.',
  arrange: () => ({ field: VEIL_FIELD, scenes: VEIL_SCENES, audit: VEIL_AUDIT, leak: LEAK_REPORT }),
  act: ({ field, scenes, audit, leak }) => {
    const seek = scenes[0] as (typeof scenes)[number];
    const strike = scenes[4] as (typeof scenes)[number];
    const onRival = strike.phenomena.filter((phenomenon) => phenomenon.holderId === rivalId);
    const onSelf = strike.phenomena.filter(
      (phenomenon) => phenomenon.holderId === actorId && phenomenon.path === 'vitality',
    );

    return {
      // ① 세계의 표면이 온전하다 (R2-a)
      leakComplete: leak.complete,
      movable: leak.movable,
      sealedSlots: leak.sealed.length,
      unusedChannels: leak.unusedChannels,
      leakLine: leakVerdict(leak),

      // ② 다섯 사건이 흔적을 남긴다
      perScene: scenes.map((scene) => [scene.label, scene.phenomena.length]),
      total: field.phenomena.length,
      channels: channelsOf(field.phenomena),

      // ③ 앎은 새지 않는다 — 찾다에서 나온 것은 몸의 자국뿐이다
      seekChannels: channelsOf(seek.phenomena),
      seekPaths: [...new Set(seek.phenomena.map((phenomenon) => phenomenon.path))],
      seekSealed: seek.sealedSlots.length,
      seekSealedIsKnowing: seek.sealedSlots.every((slot) => slot.startsWith('informational.')),
      knowingLeaks: field.phenomena.filter((phenomenon) => phenomenon.domain === 'informational')
        .length,

      // ④ 그 자국은 거의 아무것도 말해 주지 않는다
      bodyAmbiguity: Number((seek.phenomena[0]?.ambiguity ?? 0).toFixed(2)),
      stockAmbiguity: Number(
        (
          field.phenomena.find((phenomenon) => phenomenon.domain === 'economic')?.ambiguity ?? 0
        ).toFixed(2),
      ),

      // ⑤ 어떤 흔적은 사라지지 않는다
      rivalPermanent: onRival.every((phenomenon) => phenomenon.decaysAtTick === null),
      rivalCount: onRival.length,
      selfDecays: onSelf.every((phenomenon) => phenomenon.decaysAtTick !== null),
      permanent: audit.permanent,

      // ⑥ 모든 흔적이 사건을 가리키고, 모든 사건이 흔적을 남겼다
      allCaused: field.phenomena.every(
        (phenomenon) => VEIL_LOG.byId.get(phenomenon.causeEventId) !== undefined,
      ),
      witnessed: audit.witnessed,
      auditViolations: audit.violations.length,
      verdict: fieldVerdict(audit),
    };
  },
  assert: (result): readonly Assertion[] => [
    expectTrue('세계의 표면이 온전하다 — 원자가 움직이는 자리가 전부 답을 갖는다', result.leakComplete, result.leakLine),
    expectState('그 자리는 서른이다 (P0-b 걸림에서 세어 온다)', 30, result.movable),
    expectState('그중 일곱은 새지 않는다 — 전부 선언된 예외다', 7, result.sealedSlots),
    expectState('O1 이 연 통로 6종이 전부 쓰인다', [], result.unusedChannels),
    expectState(
      '다섯 사건이 각각 흔적을 남긴다',
      [
        ['마비독을 알아본다', 2],
        ['협곡에서 고기를 가져온다', 3],
        ['마을과 주고받는다', 2],
        ['사흘치를 먹는다', 3],
        ['상단 11 을 친다', 5],
      ],
      result.perScene,
    ),
    expectState('겨울이 남긴 흔적은 열다섯이다', 15, result.total),
    expectState('통로 넷을 탄다 — 빛·냄새·흔적·보고', ['light', 'report', 'smell', 'trace'], [...result.channels].sort()),
    expectState('마비독을 알아본 일에서 새는 것은 몸의 자국뿐이다', ['smell', 'trace'], result.seekChannels),
    expectState('그 자리는 체력이다 — 알아낸 내용이 아니다', ['vitality'], result.seekPaths),
    expectState('알아낸 것 자체는 새지 않는 자리로 남는다', 1, result.seekSealed),
    expectTrue('그 자리는 정보 영역이다', result.seekSealedIsKnowing, result.seekSealedIsKnowing),
    expectState('열다섯 중 앎에서 나온 흔적은 하나도 없다', 0, result.knowingLeaks),
    expectState('몸의 자국은 열여섯 중 열둘이 남길 수 있다 — 거의 아무것도 말해 주지 않는다', 0.73, result.bodyAmbiguity),
    expectState('재고의 자국은 여섯 중 하나다 — 줄었다는 것만 보인다', 0.33, result.stockAmbiguity),
    expectState('상단 11 의 몸에 난 흔적은 둘이고', 2, result.rivalCount),
    expectTrue('그 둘은 사라지지 않는다 (P0-b reversible: false)', result.rivalPermanent, result.rivalPermanent),
    expectTrue('그 일을 하느라 닳은 제 몸의 자국은 삭는다', result.selfDecays, result.selfDecays),
    expectState('사라지지 않는 흔적은 그 둘뿐이다', 2, result.permanent),
    expectTrue('모든 흔적이 로그의 사건을 가리킨다', result.allCaused, result.allCaused),
    expectState('다섯 사건이 전부 흔적을 남겼다', 5, result.witnessed),
    expectState('감사가 짚는 어긋남은 없다', 0, result.auditViolations),
    expectState(
      '판정 한 줄이 그것을 말한다',
      '흔적 15 · 흔적을 남긴 사건 5 · 흔적 없이 지나간 사건 0 · 사라지지 않는 흔적 2',
      result.verdict,
    ),
    expectDeterministic('같은 겨울은 언제나 같은 흔적을 남긴다', () =>
      stateHash(VEIL_FIELD.phenomena.map(phenomenonLine)),
    ),
  ],
});

/** 실패 — 아홉 가지가 각자의 사유로, 각자의 단계에서 걸린다. */
export const r2CauselessPhenomenonRejected = defineScenario({
  id: 'r2-causeless-phenomenon-rejected',
  module: 'R2',
  kind: 'failure',
  purpose:
    '일으킨 자 없는 사건·원인 없는 흔적·표면의 구멍·자리 없는 흔적은 흔적이 나기 전에, 로그에 없는 원인·봉인된 자리의 누출·움직이지 않은 자리의 흔적·흔적 없이 새 나간 변화는 현상장 감사에서 걸린다.',
  arrange: () => ({ cases: BROKEN_PHENOMENA }),
  act: ({ cases }) => ({
    rules: cases.map((entry) => [entry.expected, entry.at, entry.rules.includes(entry.expected)]),
    stages: cases.map((entry) => entry.at),
    messages: cases.every((entry) => entry.messages.every((message) => message.length > 0)),
    sealedMessage:
      cases.find((entry) => entry.expected === 'sealed-leak')?.messages[0] ?? '',
    missingMessage:
      cases.find((entry) => entry.expected === 'missing-trace')?.messages[0] ?? '',
    naturalMessage:
      cases.find((entry) => entry.broke.includes('자연 발생'))?.messages[0] ?? '',
  }),
  assert: (result): readonly Assertion[] => [
    expectState(
      '설 수 없는 아홉이 각자의 사유로 걸린다',
      [
        ['causeless-phenomenon', 'emit', true],
        ['causeless-phenomenon', 'emit', true],
        ['unchanneled-slot', 'emit', true],
        ['placeless-phenomenon', 'emit', true],
        ['causeless-phenomenon', 'audit', true],
        ['unlogged-cause', 'audit', true],
        ['sealed-leak', 'audit', true],
        ['still-phenomenon', 'audit', true],
        ['missing-trace', 'audit', true],
      ],
      result.rules,
    ),
    expectState(
      '넷은 흔적이 나기 전에, 다섯은 현상장을 감사할 때 걸린다',
      ['emit', 'emit', 'emit', 'emit', 'audit', 'audit', 'audit', 'audit', 'audit'],
      result.stages,
    ),
    expectTrue('거부는 사유와 함께 남는다 — 던지지 않는다', result.messages, result.messages),
    expectTrue(
      '봉인이 뚫리면 아무것도 숨길 수 없다는 것이 사유에 적힌다',
      result.sealedMessage.includes('아무도 아무것도 숨길 수 없다'),
      result.sealedMessage,
    ),
    expectTrue(
      '흔적 없이 새 나간 변화는 "세계가 소리 없이 바뀌었다" 로 지목된다',
      result.missingMessage.includes('세계가 소리 없이 바뀌었다'),
      result.missingMessage,
    ),
    expectTrue(
      '자연 발생의 흔적은 R1 이 유예한 그 자리로 되돌려진다 (W2)',
      result.naturalMessage.includes('W2'),
      result.naturalMessage,
    ),
  ],
});

/** 경계 — 아무 흔적도 남기지 않는 사건, 그리고 시간이 지운 것. */
export const r2Boundary = defineScenario({
  id: 'r2-boundary',
  module: 'R2',
  kind: 'boundary',
  purpose:
    '앎만 움직인 사건은 세계를 바꾸고도 아무 흔적을 남기지 않으며 그것은 위반이 아니다 — 봉인을 걷으면 남의 확신이 그대로 읽히는 세계가 된다. 그리고 흔적은 삭는다: 열다섯이 나도 한참 뒤에 서 있는 것은 둘뿐이다.',
  arrange: () => ({ silent: SILENT_SEEK, walk: DECAY_WALK, field: VEIL_FIELD, contrast: UNSEALED_WORLD }),
  act: ({ silent, walk, field, contrast }) => ({
    // ① 완전한 침묵 — 세계는 바뀌는데 아무것도 나지 않는다
    silentPhenomena: silent.emitted.phenomena.length,
    silentSealed: silent.emitted.sealedSlots.length,
    silentViolations: silent.emitted.violations.length,
    silentIsFact: silent.audit.violations.length,
    silentNames: silent.silent.map((event) => event.name),
    silentListed: silent.audit.silent,

    // ② 그 침묵은 봉인이 지키는 것이다
    sealedCount: contrast.sealed.phenomena.length,
    leakingCount: contrast.leaking.phenomena.length,
    leakedDomains: [
      ...new Set(contrast.leaking.phenomena.map((phenomenon) => phenomenon.domain)),
    ].sort(),

    // ③ 흔적은 삭는다 — 다만 어떤 것은 삭지 않는다
    walk: walk.map((entry) => [entry.tick, entry.standing.length]),
    lastStanding: [
      ...new Set((walk.at(-1)?.standing ?? []).map((phenomenon) => phenomenon.holderId)),
    ],
    lastAmbiguity: Number(((walk.at(-1)?.standing[0]?.ambiguity) ?? 0).toFixed(2)),

    // ④ 아직 나지 않은 흔적은 서 있지 않다
    beforeAll: standingAt(field, NOW).length,

    // ⑤ 사건 하나짜리 로그도, 빈 현상장도 감사를 지난다
    emptyFieldEmptyLog: silent.audit.recorded,
  }),
  assert: (result): readonly Assertion[] => [
    expectState('앎만 움직인 사건은 아무 흔적도 내지 않는다', 0, result.silentPhenomena),
    expectState('움직인 자리는 새지 않는 자리 하나뿐이었다', 1, result.silentSealed),
    expectState('그것은 위반이 아니다 — 흔적이 나지 않은 것에 사유는 없다', 0, result.silentViolations),
    expectState('감사도 그것을 위반으로 세지 않는다', 0, result.silentIsFact),
    expectState('다만 조용히 지나갔다는 사실은 값으로 남는다', ['아무도 모르게 알아본다'], result.silentNames),
    expectState('감사가 그 사건을 이름으로 짚는다', ['찾다 — 아무도 모르게 알아본다'], result.silentListed),
    expectState('봉인된 세계에서 찾다는 몸의 자국 둘만 남기는데', 2, result.sealedCount),
    expectState('봉인을 걷고 통로를 내주면 셋이 된다', 3, result.leakingCount),
    expectState(
      '늘어난 하나가 정보 영역이다 — 남의 확신이 그대로 읽히는 세계다',
      ['biological', 'informational'],
      result.leakedDomains,
    ),
    expectState(
      '흔적은 삭는다 — 열다섯이 나도 한참 뒤에 서 있는 것은 둘뿐이다',
      [
        [403, 2],
        [409, 3],
        [415, 6],
        [425, 2],
        [900, 2],
      ],
      result.walk,
    ),
    expectState('그 둘은 상단 11 의 몸에 난 자국이다', [rivalId], result.lastStanding),
    expectState('그런데 그 자국조차 누가 냈는지는 말해 주지 않는다', 0.73, result.lastAmbiguity),
    expectState('첫 사건이 나기 전에는 아무 흔적도 서 있지 않다', 0, result.beforeAll),
    expectState('빈 현상장은 아무것도 담지 않은 채로 감사를 지난다', 0, result.emptyFieldEmptyLog),
  ],
});

export const r2Scenarios = [r2EventsLeaveTraces, r2CauselessPhenomenonRejected, r2Boundary];
