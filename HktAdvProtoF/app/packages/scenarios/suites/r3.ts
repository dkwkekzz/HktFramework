// R3 검증 시나리오 3종 — 갈리는가, 설 수 없는 지각이 막히는가, 아무도 못 본 것이 허용되는가.

import { stateHash } from '@hkt/core/v1';
import { attenuationVerdict, perceptFieldVerdict, perceptLine } from '@hkt/core/r3';

import {
  defineScenario,
  expectDeterministic,
  expectState,
  expectTrue,
  type Assertion,
} from '../src/index.ts';

import {
  ATTENUATION,
  BROKEN_PERCEPTS,
  DISTANT_SWEEP,
  EMPTY_AUDIT,
  IDEMPOTENT,
  LOOK_TICK,
  LOOK_WALK,
  STANDING,
  UNWITNESSED,
  VEIL_AUDIT,
  VEIL_PERCEPTS,
  VEIL_SWEEPS,
  WITHOUT_DISTANCE,
  WITNESS_TABLE,
} from './r3-veil-perception.ts';

/** 정상 — 같은 흔적 앞에서 넷이 서로 다른 세계에 산다. */
export const r3SameTraceDifferentEyes = defineScenario({
  id: 'r3-same-trace-different-eyes',
  module: 'R3',
  kind: 'normal',
  purpose:
    'R2 가 놓은 흔적은 아직 아무의 것도 아니다 — 넷이 둘러보면 사냥꾼은 자국을, 장막벌레는 냄새를 읽고 둘이 읽는 것은 하나도 겹치지 않으며, 몸 없는 상단과 어머니신은 이 겨울에 무슨 일이 있었는지 끝내 모른다.',
  arrange: () => ({ sweeps: VEIL_SWEEPS, audit: VEIL_AUDIT, table: WITNESS_TABLE, attenuation: ATTENUATION }),
  act: ({ sweeps, audit, table, attenuation }) => {
    const hunter = sweeps[0] as (typeof sweeps)[number];
    const worm = sweeps[1] as (typeof sweeps)[number];
    const seen = new Set(hunter.percepts.map((percept) => percept.phenomenonId));
    const smelt = new Set(worm.percepts.map((percept) => percept.phenomenonId));

    return {
      // ① 차폐 감쇠표가 온전하다 (R3-a)
      attenuationComplete: attenuation.complete,
      attenuationLine: attenuationVerdict(attenuation),
      lightFactor: attenuation.byChannel['light'],
      soundFactor: attenuation.byChannel['sound'],
      immune: [...attenuation.immune].sort(),

      // ② 그 틱에 서 있던 흔적을 넷이 둘러본다
      standing: STANDING.length,
      perScene: sweeps.map((entry) => [entry.observer.label, entry.percepts.length]),

      // ③ 읽는 통로가 다르다 — 그리고 하나도 겹치지 않는다
      hunterChannels: [...new Set(hunter.percepts.map((percept) => percept.channel))],
      wormChannels: [...new Set(worm.percepts.map((percept) => percept.channel))],
      overlap: [...seen].filter((id) => smelt.has(id)).length,

      // ④ 몸 없는 자들은 보고만 받는데 그 보고가 문턱에 못 미친다
      blind: audit.blind,
      guildMisses: [...new Set((sweeps[2]?.attempts ?? []).map((attempt) => attempt.miss))],
      godMisses: [...new Set((sweeps[3]?.attempts ?? []).map((attempt) => attempt.miss))],

      // ⑤ 대조표 — 못 읽은 칸에는 왜 못 읽었는지가 선다
      rows: table.length,
      columns: Object.keys(table[0]?.byObserver ?? {}).length,
      missLabels: [
        ...new Set(
          table.flatMap((row) =>
            Object.values(row.byObserver).filter((cell) => Number.isNaN(Number(cell))),
          ),
        ),
      ].sort(),

      // ⑥ 지각에는 진실이 실리지 않는다
      perceptKeys: Object.keys(VEIL_PERCEPTS.percepts[0] ?? {}).sort(),
      auditViolations: audit.violations.length,
      verdict: perceptFieldVerdict(audit),
    };
  },
  assert: (result): readonly Assertion[] => [
    expectTrue('통로 6종이 전부 차폐 앞에서의 몫을 갖는다', result.attenuationComplete, result.attenuationLine),
    expectState('빛은 차폐에 가장 약하고', 1, result.lightFactor),
    expectState('소리는 절반만 든다 — 벽을 돌아온다', 0.5, result.soundFactor),
    expectState(
      '흔적·냄새·의념·보고는 가림막과 무관하다',
      ['psychic', 'report', 'smell', 'trace'],
      result.immune,
    ),
    expectState('그 틱에 서 있던 흔적은 여섯이다', 6, result.standing),
    expectState(
      '넷이 읽는 것이 갈린다',
      [
        ['몰이꾼 04 (사냥꾼·협곡)', 1],
        ['장막벌레 (짐승·협곡)', 2],
        ['상단 (조직·마을)', 0],
        ['어머니신 (신·마을)', 0],
      ],
      result.perScene,
    ),
    expectState('사냥꾼이 읽는 것은 자국이고', ['trace'], result.hunterChannels),
    expectState('벌레가 읽는 것은 냄새다', ['smell'], result.wormChannels),
    expectState('둘은 같은 협곡에 서 있는데 읽는 것이 하나도 겹치지 않는다', 0, result.overlap),
    expectState(
      '몸 없는 둘은 아무것도 읽지 못한다',
      ['상단 (조직·마을)', '어머니신 (신·마을)'],
      result.blind,
    ),
    expectState('상단은 통로 자체가 없어서', ['no-channel'], result.guildMisses),
    expectState('어머니신도 마찬가지다 — 이 겨울에 의념 잔향이 나지 않았다', ['no-channel'], result.godMisses),
    expectState('대조표는 흔적마다 한 줄이고', 6, result.rows),
    expectState('주체마다 한 칸이다', 4, result.columns),
    expectState(
      '못 읽은 칸에는 왜 못 읽었는지가 선다',
      ['너무 옅다', '통로 없음'],
      result.missLabels,
    ),
    expectState(
      '지각이 싣는 것은 아홉 자리뿐이다 — 어느 자리가 움직였는지도 누가 냈는지도 없다',
      ['ambiguity', 'atTick', 'channel', 'distance', 'id', 'intensity', 'phenomenonId', 'placeId', 'subjectId'],
      result.perceptKeys,
    ),
    expectState('감사가 짚는 어긋남은 없다', 0, result.auditViolations),
    expectState(
      '판정 한 줄이 넷을 함께 센다',
      '지각 3 · 무언가를 읽은 주체 2 · 아무것도 못 읽은 주체 2 · 아무도 못 본 흔적 3',
      result.verdict,
    ),
    expectDeterministic('같은 세계를 같은 눈으로 보면 언제나 같은 지각이다', () =>
      stateHash(VEIL_PERCEPTS.percepts.map(perceptLine)),
    ),
  ],
});

/** 실패 — 아홉 가지가 각자의 사유로, 각자의 자리에서 걸린다. */
export const r3UnsensedPhenomenonRejected = defineScenario({
  id: 'r3-unsensed-phenomenon-rejected',
  module: 'R3',
  kind: 'failure',
  purpose:
    '세계에 선 곳 없는 관측자와 어긋난 감쇠표는 감지 자리에서, 진실이 실린 지각·없는 흔적·부풀린 세기·통로 밖 감지·프로필 없는 주체·삭은 흔적의 지각은 검사에서 걸린다.',
  arrange: () => ({ cases: BROKEN_PERCEPTS }),
  act: ({ cases }) => ({
    rules: cases.map((entry) => [entry.expected, entry.at, entry.rules.includes(entry.expected)]),
    stages: cases.map((entry) => entry.at),
    messages: cases.every((entry) => entry.messages.every((message) => message.length > 0)),
    leakMessage: cases.find((entry) => entry.expected === 'truth-leak')?.messages[0] ?? '',
    intensityMessage: cases.find((entry) => entry.expected === 'bad-intensity')?.messages[0] ?? '',
    placelessMessage:
      cases.find((entry) => entry.expected === 'placeless-observer')?.messages[0] ?? '',
  }),
  assert: (result): readonly Assertion[] => [
    expectState(
      '설 수 없는 아홉이 각자의 사유로 걸린다',
      [
        ['truth-leak', 'audit', true],
        ['phantom-percept', 'audit', true],
        ['bad-intensity', 'audit', true],
        ['unknown-channel', 'audit', true],
        ['placeless-observer', 'perceive', true],
        ['unprofiled-subject', 'audit', true],
        ['stale-percept', 'audit', true],
        ['bad-attenuation', 'perceive', true],
        ['bad-attenuation', 'perceive', true],
      ],
      result.rules,
    ),
    expectTrue('거부는 사유와 함께 남는다 — 던지지 않는다', result.messages, result.messages),
    expectTrue(
      '진실이 실리면 왜 안 되는지가 사유에 적힌다',
      result.leakMessage.includes('본 순간 다 알아 버려'),
      result.leakMessage,
    ),
    expectTrue(
      '거리와 차폐는 깎기만 한다는 것이 사유에 적힌다',
      result.intensityMessage.includes('깎기만 한다'),
      result.intensityMessage,
    ),
    expectTrue(
      '세계에 서 있지 않은 자는 거리를 잴 수 없다',
      result.placelessMessage.includes('선 곳이 없다'),
      result.placelessMessage,
    ),
  ],
});

/** 경계 — 선 곳 하나, 적히지 않은 거리 하나, 그리고 아무도 보지 못한 것. */
export const r3Boundary = defineScenario({
  id: 'r3-boundary',
  module: 'R3',
  kind: 'boundary',
  purpose:
    '같은 눈이라도 마을에 서 있으면 협곡의 가림막이 빛을 죽이고 자국은 도달 거리에서 걸려 아무것도 읽지 못한다. 거리를 아예 적지 않으면 협곡은 없는 곳이 된다. 그리고 아무도 보지 못한 흔적은 위반이 아니다.',
  arrange: () => ({
    distant: DISTANT_SWEEP,
    noDistance: WITHOUT_DISTANCE,
    unwitnessed: UNWITNESSED,
    walk: LOOK_WALK,
    empty: EMPTY_AUDIT,
  }),
  act: ({ distant, noDistance, unwitnessed, walk, empty }) => ({
    // ① 같은 눈, 다른 자리
    distantPercepts: distant.percepts.length,
    distantMisses: [...new Set(distant.attempts.map((attempt) => attempt.miss))].sort(),
    lightKilled: distant.attempts
      .filter((attempt) => attempt.phenomenon.channel === 'light')
      .map((attempt) => Number(attempt.reach.intensity.toFixed(3))),
    traceUnattenuated: distant.attempts
      .filter((attempt) => attempt.phenomenon.channel === 'trace')
      .every((attempt) => attempt.reach.intensity === attempt.phenomenon.intensity),

    // ② 적히지 않은 거리는 없는 거리다
    noDistancePercepts: noDistance.percepts.length,
    noDistanceUnreachable: !Number.isFinite(noDistance.attempts[0]?.reach.distance ?? 0),

    // ③ 아무도 보지 못한 흔적 — 위반이 아니다
    unwitnessed: unwitnessed.length,
    unwitnessedChannels: [...new Set(unwitnessed.map((entry) => entry.channel))].sort(),
    auditClean: VEIL_AUDIT.complete,

    // ④ 시간이 지나면 읽을 것도 준다
    walk: walk.map((entry) => [entry.tick, entry.standing, entry.percepts]),

    // ⑤ 빈 지각장과 두 번 담기
    emptyRecorded: empty.recorded,
    emptyComplete: empty.complete,
    idempotent: IDEMPOTENT,
  }),
  assert: (result): readonly Assertion[] => [
    expectState('마을에 선 같은 눈은 아무것도 읽지 못한다', 0, result.distantPercepts),
    expectState(
      '빛은 옅어져서, 자국은 멀어서, 냄새는 통로가 없어서 걸린다',
      ['no-channel', 'too-faint', 'too-far'],
      result.distantMisses,
    ),
    expectState(
      '협곡의 가림막이 빛 0.18·0.11 을 0.109·0.067 로 깎는다',
      [0.109, 0.067],
      result.lightKilled,
    ),
    expectTrue(
      '자국은 가림막에 깎이지 않는다 — 대신 도달 거리가 5m 다',
      result.traceUnattenuated,
      result.traceUnattenuated,
    ),
    expectState('거리를 적지 않으면 아무것도 읽지 못하고', 0, result.noDistancePercepts),
    expectTrue(
      '그 거리는 닿지 않는 값이다 — 적히지 않은 거리는 없는 거리다',
      result.noDistanceUnreachable,
      result.noDistanceUnreachable,
    ),
    expectState('아무도 보지 못한 흔적이 셋 남는다', 3, result.unwitnessed),
    expectState('빛 둘과 자국 하나다', ['light', 'trace'], result.unwitnessedChannels),
    expectTrue('그런데 감사는 그것을 위반으로 세지 않는다', result.auditClean, result.auditClean),
    expectState(
      '흔적이 삭으면 읽을 것도 준다 — 다만 사라지지 않는 자국은 언제 와도 읽힌다',
      [
        [400, 0, 0],
        [406, 3, 2],
        [415, 6, 3],
        [425, 2, 2],
        [900, 2, 2],
      ],
      result.walk,
    ),
    expectState('빈 지각장은 아무것도 담지 않고', 0, result.emptyRecorded),
    expectTrue('그대로 감사를 지난다', result.emptyComplete, result.emptyComplete),
    expectTrue('같은 지각을 두 번 담아도 늘지 않는다', result.idempotent, result.idempotent),
  ],
});

export const r3Scenarios = [r3SameTraceDifferentEyes, r3UnsensedPhenomenonRejected, r3Boundary];
