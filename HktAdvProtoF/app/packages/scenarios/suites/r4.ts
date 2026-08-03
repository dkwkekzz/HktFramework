// R4 검증 시나리오 3종 — 짐작이 갈리는가, 설 수 없는 믿음이 막히는가, 틀림이 허용되는가.

import { stateHash } from '@hkt/core/v1';
import { beliefGraphVerdict, beliefLine, guessVerdict } from '@hkt/core/r4';

import {
  defineScenario,
  expectDeterministic,
  expectState,
  expectTrue,
  type Assertion,
} from '../src/index.ts';

import {
  BELIEF_ROWS,
  BLIND_READING,
  BROKEN_BELIEFS,
  EMPTY_AUDIT,
  GUESSES,
  HARDENING,
  LATER_READINGS,
  LOOKS,
  READ_COUNTS,
  READINGS,
  READING_TABLE,
  STALE_BELIEFS,
  STANDING,
  TRUTH_CHECKS,
  UNBELIEVED,
  VEIL_AUDIT,
  VEIL_BELIEFS,
} from './r4-veil-beliefs.ts';

/** 정상 — 같은 자국 앞에서 셋의 짐작이 갈리고, 더 확신하는 자가 틀린다. */
export const r4SameTraceDifferentBeliefs = defineScenario({
  id: 'r4-same-trace-different-beliefs',
  module: 'R4',
  kind: 'normal',
  purpose:
    '같은 종·같은 눈·같은 자리에 선 셋이 같은 자국을 읽는데 짐작이 갈린다 — 후보는 통로가 정해 셋에게 같고 좁힘은 문법이 정해 셋이 다르다. 낼 손이 없는 일은 떠오르지도 않아 사제의 짐작에는 죽임이 없고, 그래서 사제는 더 좁게 짚어 더 확신하면서 틀린다.',
  arrange: () => ({
    guesses: GUESSES,
    looks: LOOKS,
    counts: READ_COUNTS,
    rows: BELIEF_ROWS,
    checks: TRUTH_CHECKS,
    audit: VEIL_AUDIT,
  }),
  act: ({ guesses, looks, counts, rows, checks, audit }) => ({
    // ① 후보표는 통로에서 나온다 (R4-a)
    guessesComplete: guesses.complete,
    guessLine: guessVerdict(guesses),
    byChannel: guesses.byChannel,
    sharp: [...guesses.sharp],
    unguessable: guesses.unguessable.length,

    // ② 셋이 같은 것을 읽는다 — 눈도 자리도 같기 때문이다
    walk: looks.map((look) => [look.tick, look.standing, look.read]),
    readCounts: counts.map(([label, read]) => [label, read]),

    // ③ 그런데 짚는 것이 갈린다
    suspected: rows.map((row) => [row.label, row.suspected]),
    missing: rows.map((row) => [row.label, [...row.missing]]),
    confidence: rows.map((row) => [row.label, Number(row.confidence.toFixed(3))]),

    // ④ 실제와 대조하면 하나가 빗나간다
    verdicts: rows.map((row) => [row.label, row.verdict]),
    wrongOnes: checks.filter((check) => check.verdict === 'wrong').map((check) => check.label),
    wrongNote: checks.find((check) => check.verdict === 'wrong')?.note ?? '',

    // ⑤ 믿음에는 진실이 실리지 않는다
    beliefKeys: Object.keys(VEIL_BELIEFS.beliefs[0] ?? {}).sort(),
    formed: READINGS.reduce((sum, reading) => sum + reading.formed, 0),
    reinforced: READINGS.reduce((sum, reading) => sum + reading.reinforced, 0),
    auditViolations: audit.violations.length,
    verdict: beliefGraphVerdict(audit),
  }),
  assert: (result): readonly Assertion[] => [
    expectTrue('통로 6종이 전부 후보를 갖는다', result.guessesComplete, result.guessLine),
    expectState(
      '통로마다 후보 수가 갈린다 — 소리는 하나, 자국·냄새는 열둘',
      { light: 11, sound: 1, trace: 12, smell: 12, psychic: 3, report: 9 },
      result.byChannel,
    ),
    expectState('원자 하나를 가리키는 통로는 소리뿐이다', ['sound'], result.sharp),
    expectState('열여섯 전부가 어느 통로로든 짐작된다', 0, result.unguessable),
    expectState(
      '셋이 겨울을 세 번 둘러본다 — 언제 보느냐가 무엇을 보느냐다',
      [
        [406, 3, 3],
        [409, 3, 6],
        [415, 6, 3],
      ],
      result.walk,
    ),
    expectState(
      '눈도 자리도 같으므로 읽는 것도 같다 — 갈리는 것은 손뿐이다',
      [
        ['몰이꾼 (자국을 쫓는 자들)', 3],
        ['사제 (어미를 섬기는 자들)', 3],
        ['상단 (고개를 넘는 자들)', 3],
      ],
      result.readCounts,
    ),
    expectState(
      '그런데 짚는 것이 갈린다 — 자국의 후보 열둘에서 각자 덜어 낸다',
      [
        ['몰이꾼 (자국을 쫓는 자들)', 12],
        ['사제 (어미를 섬기는 자들)', 11],
        ['상단 (고개를 넘는 자들)', 11],
      ],
      result.suspected,
    ),
    expectState(
      '무엇이 빠졌는지는 P2 금기가 정한 그대로다 — 사제에게서 죽임이, 상단에게서 빼앗기가',
      [
        ['몰이꾼 (자국을 쫓는 자들)', []],
        ['사제 (어미를 섬기는 자들)', ['destroy']],
        ['상단 (고개를 넘는 자들)', ['seize']],
      ],
      result.missing,
    ),
    expectState(
      '좁게 짚은 둘이 더 확신한다',
      [
        ['몰이꾼 (자국을 쫓는 자들)', 0.267],
        ['사제 (어미를 섬기는 자들)', 0.333],
        ['상단 (고개를 넘는 자들)', 0.333],
      ],
      result.confidence,
    ),
    expectState(
      '그런데 그 자국을 낸 것은 제거다 — 더 확신한 사제가 틀린다',
      [
        ['몰이꾼 (자국을 쫓는 자들)', 'narrowed'],
        ['사제 (어미를 섬기는 자들)', 'wrong'],
        ['상단 (고개를 넘는 자들)', 'narrowed'],
      ],
      result.verdicts,
    ),
    expectState('빗나간 것은 하나다', ['사제 (어미를 섬기는 자들)'], result.wrongOnes),
    expectTrue(
      '왜 빗나갔는지가 함께 남는다 — 낼 손이 없는 일은 떠오르지도 않는다',
      result.wrongNote.includes('떠오르지도 않는다'),
      result.wrongNote,
    ),
    expectState(
      '믿음이 싣는 것은 열네 자리뿐이다 — 누가 냈는지도 어느 자리였는지도 없다',
      [
        'aboutId',
        'assertion',
        'candidates',
        'channel',
        'confidence',
        'factors',
        'firstTick',
        'holderId',
        'id',
        'intensity',
        'kind',
        'lastTick',
        'narrowedBy',
        'observations',
        'placeId',
        'sourceIds',
        'suspected',
      ],
      result.beliefKeys,
    ),
    expectState('세 번의 둘러봄에서 아홉이 처음 서고', 9, result.formed),
    expectState('셋은 다시 읽어 굳는다', 3, result.reinforced),
    expectState('감사가 짚는 어긋남은 없다 — 빗나감은 어긋남이 아니다', 0, result.auditViolations),
    expectState(
      '판정 한 줄이 정확·좁히지 못함·빗나감을 함께 센다',
      '믿음 9 · 믿는 주체 3 · 정확 0 · 좁히지 못함 8 · 빗나감 1 · 아무도 믿지 않는 흔적 5',
      result.verdict,
    ),
    expectDeterministic('같은 자국을 같은 손으로 읽으면 언제나 같은 믿음이다', () =>
      stateHash(VEIL_BELIEFS.beliefs.map(beliefLine)),
    ),
  ],
});

/** 실패 — 열하나가 각자의 사유로, 각자의 자리에서 걸린다. */
export const r4GroundlessBeliefRejected = defineScenario({
  id: 'r4-groundless-belief-rejected',
  module: 'R4',
  kind: 'failure',
  purpose:
    '짐작할 수 없는 통로의 지각과 남의 눈으로 굳히는 일은 믿음을 세우는 자리에서, 실린 진실·근거 없는 믿음·빌린 근거·후보 밖의 짚음·늘린 후보·손으로 고친 확신·범위 밖 확신·과한 확신·주인 없는 믿음은 검사에서 걸린다.',
  arrange: () => ({ cases: BROKEN_BELIEFS }),
  act: ({ cases }) => ({
    rules: cases.map((entry) => [entry.expected, entry.at, entry.rules.includes(entry.expected)]),
    messages: cases.every((entry) => entry.messages.every((message) => message.length > 0)),
    leakMessage: cases.find((entry) => entry.expected === 'truth-copied')?.messages[0] ?? '',
    driftMessage: cases.find((entry) => entry.expected === 'confidence-drift')?.messages[0] ?? '',
    capMessage: cases.find((entry) => entry.expected === 'overconfident-belief')?.messages[0] ?? '',
    foreignMessage: cases.find((entry) => entry.expected === 'foreign-belief')?.messages[0] ?? '',
  }),
  assert: (result): readonly Assertion[] => [
    expectState(
      '설 수 없는 열하나가 각자의 사유로 걸린다',
      [
        ['truth-copied', 'audit', true],
        ['unperceived-belief', 'audit', true],
        ['foreign-belief', 'audit', true],
        ['off-candidate-belief', 'audit', true],
        ['off-candidate-belief', 'audit', true],
        ['confidence-drift', 'audit', true],
        ['bad-confidence', 'audit', true],
        ['overconfident-belief', 'audit', true],
        ['unheld-belief', 'audit', true],
        ['unknown-channel', 'form', true],
        ['foreign-belief', 'form', true],
      ],
      result.rules,
    ),
    expectTrue('거부는 사유와 함께 남는다 — 던지지 않는다', result.messages, result.messages),
    expectTrue(
      '진실이 실리면 왜 안 되는지가 사유에 적힌다',
      result.leakMessage.includes('한 틱 늦은 전지'),
      result.leakMessage,
    ),
    expectTrue(
      '확신은 손으로 적는 값이 아니라는 것이 사유에 적힌다',
      result.driftMessage.includes('좁힘·세기·반복에서 나오는 값'),
      result.driftMessage,
    ),
    expectTrue(
      '좁힘이 상한이라는 것이 사유에 적힌다',
      result.capMessage.includes('좁힘이 허락한'),
      result.capMessage,
    ),
    expectTrue(
      '남의 눈을 빌릴 수 없는 이유가 사유에 적힌다 — 소문은 아직 없다',
      result.foreignMessage.includes('소문'),
      result.foreignMessage,
    ),
  ],
});

/** 경계 — 다시 읽는 일, 상한에 닿은 확신, 삭은 자국, 아무도 믿지 않는 것, 빈 그래프. */
export const r4Boundary = defineScenario({
  id: 'r4-boundary',
  module: 'R4',
  kind: 'boundary',
  purpose:
    '두 번 읽으면 확신이 오르되 좁힘이 허락한 데까지만 오른다. 자국이 삭아도 믿음은 남고, 아무도 아무것도 믿지 않는 흔적이 남으며, 아무것도 읽지 못한 자에게는 믿음이 서지 않는다 — 넷 다 위반이 아니다.',
  arrange: () => ({
    hardening: HARDENING,
    stale: STALE_BELIEFS,
    unbelieved: UNBELIEVED,
    blind: BLIND_READING,
    empty: EMPTY_AUDIT,
    table: READING_TABLE,
  }),
  act: ({ hardening, stale, unbelieved, blind, empty, table }) => ({
    // ① 두 번 읽으면 오른다 — 다만 상한까지만
    hardening: hardening.map((row) => [
      row.label,
      row.observations,
      Number(row.first.toFixed(3)),
      Number(row.confidence.toFixed(3)),
      row.capped,
    ]),
    rose: hardening.filter((row) => row.confidence > row.first).length,
    cappedCount: hardening.filter((row) => row.capped).length,
    suspectedUnchanged: hardening.every((row) => row.observations >= 1),

    // ② 자국은 삭아도 믿음은 남는다
    stale: stale.length,
    staleChannels: [...new Set(stale.map((belief) => belief.channel))].sort(),
    auditStale: VEIL_AUDIT.stale,
    auditClean: VEIL_AUDIT.complete,

    // ③ 아무도 아무것도 믿지 않는 흔적
    unbelieved: unbelieved.length,
    unbelievedChannels: [...new Set(unbelieved.map((phenomenon) => phenomenon.channel))].sort(),
    standing: STANDING.length,

    // ④ 아무것도 읽지 못한 자에게는 믿음이 서지 않는다
    blindBeliefs: blind.beliefs.length,
    blindViolations: blind.violations.length,

    // ⑤ 빈 그래프와 한참 뒤 다시 읽기
    emptyRecorded: empty.recorded,
    emptyComplete: empty.complete,
    laterFormed: LATER_READINGS.reduce((sum, reading) => sum + reading.formed, 0),
    laterReinforced: LATER_READINGS.reduce((sum, reading) => sum + reading.reinforced, 0),

    // ⑥ 대조표는 흔적마다 한 줄이고 읽히지 않은 줄도 빠지지 않는다
    rows: table.length,
    believedRows: table.filter((row) => row.believedBy > 0).length,
    columns: Object.keys(table[0]?.byBeliever ?? {}).length,
  }),
  assert: (result): readonly Assertion[] => [
    expectState(
      '두 번 본 빛은 확신이 오르고, 한 번 본 자국은 그대로다',
      [
        ['몰이꾼 (자국을 쫓는 자들)', 2, 0.262, 0.333, true],
        ['사제 (어미를 섬기는 자들)', 2, 0.295, 0.379, false],
        ['상단 (고개를 넘는 자들)', 2, 0.295, 0.379, false],
        ['몰이꾼 (자국을 쫓는 자들)', 1, 0.267, 0.267, true],
        ['사제 (어미를 섬기는 자들)', 1, 0.333, 0.333, true],
        ['상단 (고개를 넘는 자들)', 1, 0.333, 0.333, true],
      ],
      result.hardening,
    ),
    expectState('두 번 읽어 확신이 오른 것은 셋이고', 3, result.rose),
    expectState(
      '그중 하나는 좁힘이 허락한 데서 멈춘다 — 열둘 중 하나인 것은 두 번 봐도 열둘 중 하나다',
      4,
      result.cappedCount,
    ),
    expectState('세 번째 둘러봄에서 이미 삭은 자국의 믿음이 여섯 남는다', 6, result.stale),
    expectState('그것은 빛으로 읽은 것들이다', ['light'], result.staleChannels),
    expectState('감사도 그것을 값으로 센다', 6, result.auditStale),
    expectTrue('그런데 위반으로는 세지 않는다', result.auditClean, result.auditClean),
    expectState('그 틱에 서 있는 흔적은 여섯인데', 6, result.standing),
    expectState('그중 다섯에는 아무 믿음도 서지 않았다', 5, result.unbelieved),
    expectState(
      '빛 둘·냄새 둘·자국 하나다 — 셋의 눈에 닿지 않았다',
      ['light', 'smell', 'trace'],
      result.unbelievedChannels,
    ),
    expectState('아무것도 읽지 못한 자에게는 믿음이 하나도 서지 않고', 0, result.blindBeliefs),
    expectState('그것은 어긋남도 아니다', 0, result.blindViolations),
    expectState('빈 믿음 그래프는 아무것도 담지 않고', 0, result.emptyRecorded),
    expectTrue('그대로 감사를 지난다', result.emptyComplete, result.emptyComplete),
    expectState('한참 뒤 다시 봐도 새 믿음은 서지 않고', 0, result.laterFormed),
    expectState('사라지지 않는 자국의 믿음만 다시 굳는다', 3, result.laterReinforced),
    expectState('대조표는 흔적마다 한 줄이고', 15, result.rows),
    expectState('그중 셋만 누군가의 믿음을 받는다', 3, result.believedRows),
    expectState('주체마다 한 칸이다', 3, result.columns),
  ],
});

export const r4Scenarios = [r4SameTraceDifferentBeliefs, r4GroundlessBeliefRejected, r4Boundary];
