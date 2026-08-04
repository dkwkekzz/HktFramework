// R6 검증 시나리오 3종 — 원한이 손이 되는가, 설 수 없는 의도가 막히는가, 고리가 닫히는가.

import { stateHash } from '@hkt/core/v1';
import { intentLine, intentQueueVerdict } from '@hkt/core/r6';

import {
  defineScenario,
  expectDeterministic,
  expectState,
  expectTrue,
  type Assertion,
} from '../src/index.ts';

import {
  AFTER_ATTEMPTS,
  AXIS_ROWS,
  BEFORE_ATTEMPTS,
  BROKEN_INTENTS,
  CHAIN_NOTES,
  CLOSED_NOTE,
  EMPTY_AUDIT,
  HAND_ROWS,
  IDEMPOTENT,
  IDLE_NOTE,
  INTENTS,
  LEDGER_AFTER,
  LEDGER_BEFORE,
  LOOP,
  LOOP_ROWS,
  MOVED_BY_RUMOR,
  MUTUAL_ATTEMPTS,
  NAMES,
  VEIL_AUDIT,
  VEIL_QUEUE,
} from './r6-veil-intents.ts';

const nameOf = (id: string): string => NAMES.get(id) ?? id;

/** 정상 — 말 한 마디가 셋의 손을 움직이고, 그 손이 사건이 되어 흔적을 남긴다. */
export const r6GrudgeBecomesAction = defineScenario({
  id: 'r6-grudge-becomes-action',
  module: 'R6',
  kind: 'normal',
  purpose:
    '소문을 듣기 전에는 목격자 셋에게 아는 상대조차 없다 — 밖에서 자국만 본 자에게는 지목이 없기 때문이다. 들은 뒤에는 셋 다 04 를 겨눈다. 그런데 원망한다고 손이 서는 것은 아니다: 넷이 원망하는데 빼앗는 손은 둘뿐이고, 그 둘의 의도가 사건이 되어 흔적을 남기면 고리가 닫힌다.',
  arrange: () => ({
    before: BEFORE_ATTEMPTS,
    after: AFTER_ATTEMPTS,
    hands: HAND_ROWS,
    axes: AXIS_ROWS,
    loop: LOOP_ROWS,
  }),
  act: ({ before, after, hands, axes, loop }) => ({
    // ① 말 한 마디가 손을 움직인다
    beforeKnown: before.map((entry) => [entry.label, entry.known]),
    afterKnown: after.map((entry) => [entry.label, entry.known]),
    beforeAimed: before.filter((entry) => entry.aim !== null).length,
    afterAimed: after.filter((entry) => entry.aim !== null).length,
    moved: MOVED_BY_RUMOR,
    blindReason: before.find((entry) => entry.known === 0)?.why ?? '',

    // ② 원망해도 못 내는 손이 있다
    resenting: hands.filter((row) => row.resents).length,
    standing: hands.filter((row) => row.stands).length,
    blockedHands: hands.filter((row) => row.resents && !row.stands).map((row) => row.label),
    blockedReason: hands.find((row) => row.resents && !row.stands)?.why ?? '',

    // ③ 축이 갈리면 상대가 갈린다
    axes: axes.map((row) => [row.label, row.againstAim, row.mutualAim]),
    splits: axes.filter((row) => row.split).length,
    mutualAimed: MUTUAL_ATTEMPTS.filter((entry) => entry.aim !== null).length,

    // ④ 고리가 닫힌다
    intents: INTENTS.length,
    loop: loop.map((row) => [row.label, row.aimedAt, row.enacted, row.phenomena]),
    channels: [...new Set(loop.flatMap((row) => row.channels))].sort(),
    ledger: [LEDGER_BEFORE, LEDGER_AFTER],
    events: LOOP.log.events.length,
    phenomena: LOOP.phenomena.length,
    rooted: LOOP.phenomena.every((entry) =>
      LOOP.log.events.some((event) => event.id === entry.causeEventId),
    ),
    violations: VEIL_AUDIT.violations.length,
    verdict: intentQueueVerdict(VEIL_AUDIT),
    chain: CHAIN_NOTES.map(([layer]) => layer),
  }),
  assert: (result): readonly Assertion[] => [
    expectState(
      '말을 듣기 전 목격자 셋에게는 아는 상대가 하나도 없다 — 밖에서 본 자에게는 지목이 없다',
      [
        ['몰이꾼 04', 1],
        ['상단 11', 2],
        ['몰이꾼 (자국을 쫓는 자들)', 0],
        ['사제 (어미를 섬기는 자들)', 0],
        ['상단 (고개를 넘는 자들)', 0],
      ],
      result.beforeKnown,
    ),
    expectState(
      '들은 뒤에는 셋 다 04 를 알게 된다',
      [
        ['몰이꾼 04', 1],
        ['상단 11', 2],
        ['몰이꾼 (자국을 쫓는 자들)', 1],
        ['사제 (어미를 섬기는 자들)', 1],
        ['상단 (고개를 넘는 자들)', 1],
      ],
      result.afterKnown,
    ),
    expectState('겨눈 자가 하나에서 넷으로 는다', [1, 4], [result.beforeAimed, result.afterAimed]),
    expectState('말 한 마디가 셋의 손을 움직였다', 3, result.moved),
    expectTrue(
      '못 겨눈 사유는 R6 의 것이 아니라 앞 계층이 남긴 것이다',
      result.blindReason.includes('기억이 짚은 자도 세계가 사이를 적어 둔 자도 없다'),
      result.blindReason,
    ),
    expectState('04 를 원망하는 것은 넷인데', 4, result.resenting),
    expectState('빼앗는 손이 서는 것은 둘뿐이다', 2, result.standing),
    expectState(
      '상단 둘은 원망해도 빼앗지 못한다 — 원한과 손은 다른 것이다',
      ['상단 11', '상단 (고개를 넘는 자들)'],
      result.blockedHands,
    ),
    expectTrue(
      '그 사유는 P2 가 닫은 손이다',
      result.blockedReason.includes('P2 문법이 닫았다'),
      result.blockedReason,
    ),
    expectState(
      '축이 갈리면 상대가 갈린다 — 04 는 등지는 손으로는 아무도, 내미는 손으로는 마을을 겨눈다',
      [
        ['몰이꾼 04', '(겨눌 상대 없음)', '마을 사람들'],
        ['상단 11', '몰이꾼 04', '(겨눌 상대 없음)'],
        ['몰이꾼 (자국을 쫓는 자들)', '몰이꾼 04', '(겨눌 상대 없음)'],
        ['사제 (어미를 섬기는 자들)', '몰이꾼 04', '(겨눌 상대 없음)'],
        ['상단 (고개를 넘는 자들)', '몰이꾼 04', '(겨눌 상대 없음)'],
      ],
      result.axes,
    ),
    expectState('다섯 다 두 축이 다른 상대를 가리킨다', 5, result.splits),
    expectState('내미는 손으로 겨눌 상대가 있는 것은 04 하나뿐이다', 1, result.mutualAimed),
    expectState('실제로 선 의도는 둘이고', 2, result.intents),
    expectState(
      '둘 다 사건이 되어 흔적을 셋씩 남긴다',
      [
        ['몰이꾼 (자국을 쫓는 자들)', '몰이꾼 04', true, 3],
        ['사제 (어미를 섬기는 자들)', '몰이꾼 04', true, 3],
      ],
      result.loop,
    ),
    expectState(
      '흔적은 세 통로로 난다 — 다시 읽힐 수 있는 모양이다',
      ['report', 'smell', 'trace'],
      result.channels,
    ),
    expectState('원장에 칸이 둘 는다 — 세계가 실제로 움직였다', [1, 3], result.ledger),
    expectState('사건 둘이 로그에 남고', 2, result.events),
    expectState('흔적 여섯이 세계에 선다', 6, result.phenomena),
    expectTrue('흔적마다 원인 사건을 댄다 — 고리가 이어진다', result.rooted, '전부 원인을 댄다'),
    expectState('감사가 짚는 어긋남은 없다', 0, result.violations),
    expectState(
      '고리를 이룬 계층 셋이 각자 한 줄씩 댄다',
      ['R4', 'R5', 'R6'],
      result.chain,
    ),
    expectState(
      '판정 한 줄이 의도·사건·흔적·아무것도 못 낸 주체를 함께 센다',
      '의도장이 성립한다 — 의도 2(겨눔 2) · 사건 2 · 흔적 낸 사건 2 · 아무것도 못 낸 주체 4',
      result.verdict,
    ),
    expectDeterministic('같은 겨울을 같은 손으로 내면 언제나 같은 의도다', () =>
      stateHash(VEIL_QUEUE.intents.map(intentLine)),
    ),
  ],
});

/** 실패 — 아홉이 각자의 사유로, 각자의 자리에서 걸린다. */
export const r6GroundlessIntentRejected = defineScenario({
  id: 'r6-groundless-intent-rejected',
  module: 'R6',
  kind: 'failure',
  purpose:
    '겨눌 상대가 없는 손은 겨눔의 자리에서, 문법이 닫은 원자·빈 계획·막힌 걸음·상대 없는 원자에 적은 상대·자기 자신·공짜 요청은 의도를 세우는 자리에서, 한 틱에 둘·세계가 서기 전의 의도는 고리에서 걸린다.',
  arrange: () => ({ cases: BROKEN_INTENTS }),
  act: ({ cases }) => ({
    rules: cases.map((entry) => [entry.expected, entry.at, entry.rules.includes(entry.expected)]),
    messages: cases.every((entry) => entry.messages.every((message) => message.length > 0)),
    aimlessMessage: cases.find((entry) => entry.expected === 'aimless-intent')?.messages[0] ?? '',
    grammarMessage:
      cases.find((entry) => entry.expected === 'ungrammatical-intent')?.messages[0] ?? '',
    freeMessage: cases.find((entry) => entry.expected === 'malformed-request')?.messages[0] ?? '',
    queueMessage: cases.find((entry) => entry.expected === 'unqueued-intent')?.messages[0] ?? '',
  }),
  assert: (result): readonly Assertion[] => [
    expectState(
      '설 수 없는 아홉이 각자의 사유로, 각자의 자리에서 걸린다',
      [
        ['aimless-intent', 'aim', true],
        ['ungrammatical-intent', 'form', true],
        ['no-step', 'form', true],
        ['blocked-step', 'form', true],
        ['targetless-atom', 'form', true],
        ['self-aimed', 'form', true],
        ['malformed-request', 'form', true],
        ['unqueued-intent', 'loop', true],
        ['uncaused-event', 'loop', true],
      ],
      result.rules,
    ),
    expectTrue('거부는 사유와 함께 남는다 — 던지지 않는다', result.messages, result.messages),
    expectTrue(
      '겨눌 상대가 없다는 것이 무엇인지가 사유에 적힌다',
      result.aimlessMessage.includes('겨눌 상대가 없다'),
      result.aimlessMessage,
    ),
    expectTrue(
      '닫힌 손은 P2 가 닫았다는 것이 사유에 적힌다 — R6 가 닫은 것이 아니다',
      result.grammarMessage.includes('P2 문법이 닫았다'),
      result.grammarMessage,
    ),
    expectTrue(
      '공짜 요청은 P0-c 관문이 잡는다 — R6 가 다시 판정하지 않는다',
      result.freeMessage.includes('P0-c 관문'),
      result.freeMessage,
    ),
    expectTrue(
      '한 틱에 둘을 내면 어느 것이 나가는지 정해지지 않는다는 것이 사유에 적힌다',
      result.queueMessage.includes('정해지지 않는다'),
      result.queueMessage,
    ),
  ],
});

/** 경계 — 아무것도 못 낸 주체, 빈 의도장, 같은 것을 두 번 담기, 그리고 고리가 검사인 이유. */
export const r6Boundary = defineScenario({
  id: 'r6-boundary',
  module: 'R6',
  kind: 'boundary',
  purpose:
    '아무 의도도 내지 못한 주체가 넷 남는데 위반이 아니다 — 겨눌 상대가 없거나 손이 닫혀 있을 뿐이고 세계는 아무도 손대지 않는 틱에도 굴러간다. 빈 의도장은 아무것도 내지 않고, 같은 의도를 두 번 담아도 큐는 그대로다.',
  arrange: () => ({
    audit: VEIL_AUDIT,
    empty: EMPTY_AUDIT,
    loop: LOOP,
  }),
  act: ({ audit, empty, loop }) => ({
    idle: audit.idle.map(nameOf).sort(),
    idleNote: IDLE_NOTE.startsWith('아니다'),
    queued: audit.queued,
    aimed: audit.aimed,
    enacted: audit.enacted,
    witnessed: audit.witnessed,
    silent: audit.silent,
    emptyQueued: empty.queued,
    emptyViolations: empty.violations.length,
    emptyIdle: empty.idle.length,
    idempotent: IDEMPOTENT,
    // 고리는 검사다 — 걸음마다 사건과 흔적이 실제로 붙어 있다
    steps: loop.steps.length,
    everyStepRooted: loop.steps.every(
      (step) => step.event !== null && step.phenomena.length > 0,
    ),
    closedNote: CLOSED_NOTE.includes('주장이 아니라 검사다'),
    sealed: [...new Set(loop.steps.flatMap((step) => step.sealedSlots))].length,
  }),
  assert: (result): readonly Assertion[] => [
    expectState(
      '아무 의도도 내지 못한 넷이 남는다 — 겨눌 상대가 없거나 손이 닫혔다',
      ['마을 사람들', '몰이꾼 04', '상단 (고개를 넘는 자들)', '상단 11'],
      result.idle,
    ),
    expectTrue('그것은 위반이 아니라 사실이다', result.idleNote, IDLE_NOTE),
    expectState('큐에 담긴 의도는 둘이고 둘 다 겨눔이 있다', [2, 2], [result.queued, result.aimed]),
    expectState('둘 다 사건이 되었고', 2, result.enacted),
    expectState('둘 다 흔적을 냈다', 2, result.witnessed),
    expectState('아무 흔적도 안 낸 사건은 없다', 0, result.silent),
    expectState('빈 의도장은 아무것도 담지 않고', 0, result.emptyQueued),
    expectState('아무 어긋남도 내지 않으며', 0, result.emptyViolations),
    expectState('그때는 다섯 다 아무것도 내지 못한 것이 된다', 6, result.emptyIdle),
    expectTrue('같은 의도를 두 번 담아도 큐는 그대로다', result.idempotent, '같은 큐다'),
    expectState('고리는 두 걸음이고', 2, result.steps),
    expectTrue(
      '걸음마다 사건과 흔적이 실제로 붙어 있다 — 주장이 아니라 검사다',
      result.everyStepRooted,
      '전부 이어졌다',
    ),
    expectTrue('그 이유가 한 줄로 적혀 있다', result.closedNote, CLOSED_NOTE),
    expectState(
      '이번 걸음들에는 봉인된 자리가 없다 — 원한도 몸도 밖으로 샌다 (R2-a 표 그대로)',
      0,
      result.sealed,
    ),
  ],
});

export const r6Scenarios = [r6GrudgeBecomesAction, r6GroundlessIntentRejected, r6Boundary];
