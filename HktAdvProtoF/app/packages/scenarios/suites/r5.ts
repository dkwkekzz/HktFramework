// R5 검증 시나리오 3종 — 지목이 말을 타는가, 설 수 없는 기억이 막히는가, 못 들은 말이 남는가.

import { stateHash } from '@hkt/core/v1';
import { memoryLedgerVerdict, memoryLine } from '@hkt/core/r5';

import {
  defineScenario,
  expectDeterministic,
  expectState,
  expectTrue,
  type Assertion,
} from '../src/index.ts';

import {
  AFTER_RUMOR,
  BEFORE_RUMOR,
  BLAME_CHECKS,
  BLIND_NOTE,
  BROKEN_MEMORIES,
  EMPTY_AUDIT,
  EMPTY_REGARD,
  FADE_ROWS,
  GRUDGE_AFTER,
  GRUDGE_BEFORE,
  HEARING_ROWS,
  HEARSAY_ROWS,
  IDEMPOTENT,
  LIVED,
  POINTED_ROWS,
  PUSH_TABLE,
  RETELL_ROWS,
  SEALINGS,
  SEEN_MEMORIES,
  SILENT_NOTE,
  STILL_BELIEFS,
  STORIES,
  STORY_VARIANTS,
  SUFFERED_ROWS,
  TOLD_MEMORIES,
  UNATTRIBUTED_MEMORIES,
  UNHEARD_TELLINGS,
  UNSPOKEN_MEMORIES,
  VEIL_AUDIT,
  VEIL_MEMORIES,
  WRONG_NOTE,
} from './r5-veil-memories.ts';

/** 정상 — 겪은 자 하나가 짚고, 그 지목이 말을 타고 셋에게 간다. */
export const r5HearsayCarriesBlame = defineScenario({
  id: 'r5-hearsay-carries-blame',
  module: 'R5',
  kind: 'normal',
  purpose:
    '제 자리가 움직인 자만 상대를 짚는다 — 같은 사건을 본 셋은 무언가 있었다는 것만 안다. 그 지목이 말을 타면 겪지 않은 셋도 04 를 원망하게 되는데, 내용은 각자의 손이 좁히고 지목만은 좁혀지지 않는다.',
  arrange: () => ({
    sufferedRows: SUFFERED_ROWS,
    sealings: SEALINGS,
    hearing: HEARING_ROWS,
    hearsay: HEARSAY_ROWS,
    stories: STORIES,
    blames: BLAME_CHECKS,
    before: GRUDGE_BEFORE,
    after: GRUDGE_AFTER,
  }),
  act: ({ sufferedRows, sealings, hearing, hearsay, stories, blames, before, after }) => ({
    // ① 겪은 자만 짚는다
    suffered: sufferedRows.map((row) => [row.label, row.suffered]),
    livedCandidates: LIVED.candidates.length,
    livedSuspected: LIVED.suspected.length,
    livedBlames: LIVED.attribution?.subjectId !== undefined,
    livedConfidence: Number(LIVED.confidence.toFixed(3)),

    // ② 본 것은 굳어 기억이 되되 지목이 없다
    sealed: SEEN_MEMORIES.length,
    unsealed: STILL_BELIEFS.length,
    sealingReasons: [...new Set(sealings.map((entry) => (entry.memory === null ? '남았다' : '굳었다')))].sort(),
    seenBlames: SEEN_MEMORIES.filter((memory) => memory.attribution !== null).length,

    // ③ 말은 흔적이 되고 귀 있는 자만 듣는다
    heard: hearing.map((row) => [row.label, row.heard]),
    deafMessage: hearing.find((row) => !row.heard)?.message ?? '',

    // ④ 내용은 갈리고 지목은 갈리지 않는다
    hearsay: hearsay.map((row) => [row.label, row.said, row.kept, [...row.dropped]]),
    allBlame: hearsay.every((row) => row.blames !== null),
    hops: [...new Set(hearsay.map((row) => row.hops))],

    // ⑤ 하나의 사건이 여러 이야기가 된다
    stories: stories.length,
    variants: STORY_VARIANTS,
    storyBlames: [...new Set(stories.map((story) => story.blames))].length,
    storyWidths: [...new Set(stories.map((story) => story.suspected.length))].sort(),

    // ⑥ 지목은 맞은 채로 건넌다
    verdicts: blames.map((check) => check.verdict),

    // ⑦ 원망하는 자가 하나에서 넷이 된다
    grudgeBefore: before.map((row) => [row.label, Number(row.value.toFixed(3))]),
    grudgeAfter: after.map((row) => [row.label, Number(row.value.toFixed(3))]),
    writtenBefore: before.map((row) => row.written),
    writtenAfter: after.map((row) => row.written),
    relBefore: BEFORE_RUMOR.relationships.length,
    relAfter: AFTER_RUMOR.relationships.length,
    verdict: memoryLedgerVerdict(VEIL_AUDIT),
  }),
  assert: (result): readonly Assertion[] => [
    expectState(
      '그 사건을 겪은 것은 몸이 깎인 11 하나뿐이다 — 손으로 낸 자도 본 자들도 아니다',
      [
        ['상단 11 (몸이 깎였다)', true],
        ['몰이꾼 04 (제 손으로 냈다)', false],
        ['몰이꾼 (자국을 쫓는 자들) (협곡에서 보았다)', false],
        ['사제 (어미를 섬기는 자들) (협곡에서 보았다)', false],
        ['상단 (고개를 넘는 자들) (협곡에서 보았다)', false],
      ],
      result.suffered,
    ),
    expectTrue('11 은 누가 했는지 안다', result.livedBlames, '지목이 붙었다'),
    expectState('그런데 무엇으로 당했는지는 열둘 중 하나다', 12, result.livedCandidates),
    expectState('제 손이 하나를 덜어 내 열하나가 남고', 11, result.livedSuspected),
    expectState('그래서 확신은 0.333 에서 멈춘다 — 겪었다고 확신 1 이 되지는 않는다', 0.333, result.livedConfidence),
    expectState('본 자들의 믿음 아홉 중 여섯이 굳어 기억이 되고', 6, result.sealed),
    expectState('셋은 남는다 — 사라지지 않는 자국은 가서 보면 되기 때문이다', 3, result.unsealed),
    expectState('굳음과 남음이 사유와 함께 갈린다', ['굳었다', '남았다'], result.sealingReasons),
    expectState('본 것에는 지목이 하나도 붙지 않는다 — R4 가 남긴 자리 그대로다', 0, result.seenBlames),
    expectState(
      '말은 셋에게 닿고 귀 없는 하나에게는 닿지 않는다',
      [
        ['몰이꾼 (자국을 쫓는 자들)', true],
        ['사제 (어미를 섬기는 자들)', true],
        ['상단 (고개를 넘는 자들)', true],
        ['마을 어귀의 장막벌레 (귀가 없다)', false],
      ],
      result.heard,
    ),
    expectTrue(
      '못 들은 사유는 R5 의 것이 아니라 R3 감지의 것이다',
      result.deafMessage.includes('보고 통로가 없다'),
      result.deafMessage,
    ),
    expectState(
      '같은 말을 듣고 사제만 죽임을 덜어 낸다 — 낼 손이 없는 일은 남의 말에서도 떠오르지 않는다',
      [
        ['몰이꾼 (자국을 쫓는 자들)', 11, 11, []],
        ['사제 (어미를 섬기는 자들)', 11, 10, ['destroy']],
        ['상단 (고개를 넘는 자들)', 11, 11, []],
      ],
      result.hearsay,
    ),
    expectTrue('그런데 셋 다 04 를 짚는다 — 지목은 좁혀지지 않는다', result.allBlame, '셋 다 지목을 받았다'),
    expectState('셋 다 한 입을 거쳤다', [1], result.hops),
    expectState('그 사건에서 네 이야기가 갈라지고', 4, result.stories),
    expectState('내용으로는 둘로 갈린다 — 사제만 다르다', 2, result.variants),
    expectState('그러나 누구 탓인지는 하나다', 1, result.storyBlames),
    expectState('내용의 넓이는 열과 열하나로 갈린다', [10, 11], result.storyWidths),
    expectState(
      '넷의 지목이 전부 맞다 — 겪은 자가 짚은 것이 그대로 건넜기 때문이다',
      ['right', 'right', 'right', 'right'],
      result.verdicts,
    ),
    expectState(
      '말하기 전에 04 를 원망하는 것은 겪은 11 하나뿐이고',
      [['상단 11', 0.03]],
      result.grudgeBefore,
    ),
    expectState(
      '말한 뒤에는 넷이 된다 — 겪지 않은 셋이 들어서 원망한다',
      [
        ['상단 11', 0.03],
        ['몰이꾼 (자국을 쫓는 자들)', 0.03],
        ['사제 (어미를 섬기는 자들)', 0.033],
        ['상단 (고개를 넘는 자들)', 0.03],
      ],
      result.grudgeAfter,
    ),
    expectState('세계의 장부에는 그 원한이 하나도 적혀 있지 않다', [0], [
      ...new Set([...result.writtenBefore, ...result.writtenAfter]),
    ]),
    expectState('움직인 사이는 셋에서 열둘로 는다', [3, 12], [result.relBefore, result.relAfter]),
    expectState(
      '판정 한 줄이 뿌리별 수와 지목·못 들은 말을 함께 센다',
      '기억장이 성립한다 — 기억 10(겪음 1 · 봄 6 · 들음 3) · 지목 4 · 지목 없음 6 · 못 들은 말 1',
      result.verdict,
    ),
    expectDeterministic('같은 겨울을 같은 손으로 기억하면 언제나 같은 장부다', () =>
      stateHash(VEIL_MEMORIES.memories.map(memoryLine)),
    ),
  ],
});

/** 실패 — 열다섯이 각자의 사유로, 각자의 자리에서 걸린다. */
export const r5GroundlessMemoryRejected = defineScenario({
  id: 'r5-groundless-memory-rejected',
  module: 'R5',
  kind: 'failure',
  purpose:
    '겪지 않은 지목·아직 서 있는 자국의 기억·지니지 않은 기억을 말하는 것·듣지 않은 말은 세우는 자리에서, 짐작에서 나온 지목·바랜 확신·근거 없는 기억·주인 없는 기억·아직 오지 않은 일·후보 밖의 짚음·실린 진실·넓어진 말·진해진 말·지목 없는 사이·없는 축은 검사에서 걸린다.',
  arrange: () => ({ cases: BROKEN_MEMORIES }),
  act: ({ cases }) => ({
    rules: cases.map((entry) => [entry.expected, entry.at, entry.rules.includes(entry.expected)]),
    messages: cases.every((entry) => entry.messages.every((message) => message.length > 0)),
    livedMessage: cases.find((entry) => entry.expected === 'unlived-attribution')?.messages[0] ?? '',
    sealMessage: cases.find((entry) => entry.expected === 'unsealed-memory')?.messages[0] ?? '',
    guessMessage: cases.find((entry) => entry.expected === 'guessed-attribution')?.messages[0] ?? '',
    driftMessage: cases.find((entry) => entry.expected === 'memory-drift')?.messages[0] ?? '',
    heardMessage: cases.find((entry) => entry.expected === 'unheard-telling')?.messages[0] ?? '',
    regardMessage: cases.find((entry) => entry.expected === 'unattributed-regard')?.messages[0] ?? '',
  }),
  assert: (result): readonly Assertion[] => [
    expectState(
      '설 수 없는 열다섯이 각자의 사유로, 각자의 자리에서 걸린다',
      [
        ['unlived-attribution', 'form', true],
        ['unsealed-memory', 'form', true],
        ['guessed-attribution', 'audit', true],
        ['memory-drift', 'audit', true],
        ['groundless-memory', 'audit', true],
        ['unheld-memory', 'audit', true],
        ['future-memory', 'audit', true],
        ['memory-truth-copied', 'audit', true],
        ['memory-truth-copied', 'audit', true],
        ['unspoken-telling', 'form', true],
        ['unheard-telling', 'form', true],
        ['widened-hearsay', 'audit', true],
        ['louder-hearsay', 'audit', true],
        ['unattributed-regard', 'audit', true],
        ['unknown-axis', 'audit', true],
      ],
      result.rules,
    ),
    expectTrue('거부는 사유와 함께 남는다 — 던지지 않는다', result.messages, result.messages),
    expectTrue(
      '겪지 않았다는 것이 무엇인지가 사유에 적힌다 — 자리를 바꾸지 않은 사건이다',
      result.livedMessage.includes('자리를 바꾸지 않았다'),
      result.livedMessage,
    ),
    expectTrue(
      '왜 아직 기억이 아닌지가 사유에 적힌다 — 가서 보면 된다',
      result.sealMessage.includes('다시 볼 수 있으므로 믿음이다'),
      result.sealMessage,
    ),
    expectTrue(
      '본 자가 왜 짚을 수 없는지가 사유에 적힌다',
      result.guessMessage.includes('알 길이 없다'),
      result.guessMessage,
    ),
    expectTrue(
      '기억이 바래지 않는다는 것이 사유에 적힌다',
      result.driftMessage.includes('기억은 바래지 않는다'),
      result.driftMessage,
    ),
    expectTrue(
      'R4 의 벽이 그대로 서 있다는 것이 사유에 적힌다 — 근거는 제 귀에 닿은 것뿐이다',
      result.heardMessage.includes('제 귀에 닿은 것'),
      result.heardMessage,
    ),
    expectTrue(
      '지목 없는 기억이 왜 밀 수 없는지가 사유에 적힌다',
      result.regardMessage.includes('누구인지 모르면'),
      result.regardMessage,
    ),
  ],
});

/** 경계 — 못 들은 말, 말하지 않은 기억, 지목 없는 기억, 빈 장부, 그리고 P4 가 읽던 자리. */
export const r5Boundary = defineScenario({
  id: 'r5-boundary',
  module: 'R5',
  kind: 'boundary',
  purpose:
    '한 입을 거친 말은 문턱 아래로 떨어져 아무에게도 닿지 않는다 — R5 가 정한 것이 아니라 R4 의 좁힘 상한과 R3 의 문턱이 만나 그렇게 된다. 못 들은 말·말하지 않은 기억·지목 없는 기억은 전부 위반이 아니라 사실이고, 빈 장부는 아무것도 내지 않는다.',
  arrange: () => ({
    fade: FADE_ROWS,
    retell: RETELL_ROWS,
    pushes: PUSH_TABLE,
    pointed: POINTED_ROWS,
    empty: EMPTY_AUDIT,
  }),
  act: ({ fade, retell, pushes, pointed, empty }) => ({
    // ① 말은 한 입을 건널 때마다 옅어지고 두 입을 못 넘는다
    fade: fade.map((row) => [row.step, Number(row.intensity.toFixed(3)), row.heardBy]),
    retellHeard: retell.filter((row) => row.heard).length,
    retellMessage: retell.find((row) => row.message.includes('문턱'))?.message ?? '',

    // ② 못 들은 말·말하지 않은 기억·지목 없는 기억은 사실이다
    unheard: UNHEARD_TELLINGS.length,
    unspoken: UNSPOKEN_MEMORIES.length,
    unattributed: UNATTRIBUTED_MEMORIES.length,
    violations: VEIL_AUDIT.violations.length,
    told: TOLD_MEMORIES.length,
    notes: [SILENT_NOTE, BLIND_NOTE, WRONG_NOTE].every((note) => note.startsWith('아니다')),

    // ③ 원한은 쌓이기만 한다 — P0-b 를 그대로 읽은 표다
    grudgeBuilders: pushes.filter((row) => row.pushes.grudge > 0).map((row) => row.atom),
    grudgeSpenders: pushes.filter((row) => row.pushes.grudge < 0).map((row) => row.atom),
    untouched: pushes.filter((row) => row.touches === 0).length,
    betrayTrust: pushes.find((row) => row.atom === 'betray')?.pushes.trust ?? null,

    // ④ 평균으로 읽는 것과 지목해 읽는 것이 갈린다 (P4 가 남긴 부채)
    pointedGaps: pointed.filter((row) => Math.abs(row.gap) > 1e-9).length,
    pointedTotal: pointed.length,
    averagesZero: pointed.every((row) => row.average === 0),

    // ⑤ 빈 장부
    emptyRecorded: empty.recorded,
    emptyViolations: empty.violations.length,
    emptyRegard: EMPTY_REGARD.relationships.length,
    idempotent: IDEMPOTENT,
  }),
  assert: (result): readonly Assertion[] => [
    expectState(
      '겪은 자의 말은 세기 1 로 나서 셋에게 닿고, 한 입을 거친 말은 0.333 으로 떨어져 아무에게도 닿지 않는다',
      [
        ['① 겪은 자가 말한다 (11)', 1, 3],
        ['② 들은 자가 다시 말한다 (사제)', 0.333, 0],
      ],
      result.fade,
    ),
    expectState('두 번째 말을 들은 자는 없다', 0, result.retellHeard),
    expectTrue(
      '그 사유는 R5 의 것이 아니라 R3 의 문턱이다',
      result.retellMessage.includes('문턱 0.5 에 못 미친다'),
      result.retellMessage,
    ),
    expectState('아무도 듣지 못한 말이 하나 남고', 1, result.unheard),
    expectState('아무도 말하지 않은 기억이 여덟이며', 8, result.unspoken),
    expectState('지목 없는 기억이 여섯이다 — 본 자들은 누구인지 모른다', 6, result.unattributed),
    expectState('들어서 선 기억은 셋뿐이다', 3, result.told),
    expectState('그런데 감사는 그중 어느 것도 위반으로 세지 않는다', 0, result.violations),
    expectTrue('셋 다 "아니다" 로 시작하는 한 줄을 갖는다', result.notes, '사실이지 위반이 아니다'),
    expectState(
      '원한을 세우는 원자는 셋뿐이고',
      ['seize', 'coerce', 'betray'],
      result.grudgeBuilders,
    ),
    expectState('그것을 치르는 원자는 하나도 없다 — 원한은 쌓이기만 한다', [], result.grudgeSpenders),
    expectState(
      '사이를 하나도 건드리지 않는 원자가 열하나다 — 동맹까지 그렇다(빚을 지면서 갚아 방향이 없다)',
      11,
      result.untouched,
    ),
    expectState('배신은 신뢰에 방향이 없다 — 그 자리를 쓰면서 동시에 치른다', 0, result.betrayTrust),
    expectTrue(
      'P4-b 가 읽던 평균은 전부 0 이다 — 세계의 장부에 그들 사이가 적혀 있지 않기 때문이다',
      result.averagesZero,
      '평균 0',
    ),
    expectState('그런데 지목해 읽으면 여덟 자리가 전부 갈린다', 8, result.pointedGaps),
    expectState('여덟 자리를 재었다', 8, result.pointedTotal),
    expectState('빈 기억장은 아무것도 담지 않고', 0, result.emptyRecorded),
    expectState('아무 어긋남도 내지 않으며', 0, result.emptyViolations),
    expectState('기억이 없으면 사이도 하나도 움직이지 않는다', 0, result.emptyRegard),
    expectTrue('같은 기억을 두 번 담아도 장부는 그대로다', result.idempotent, '같은 장부다'),
  ],
});

export const r5Scenarios = [r5HearsayCarriesBlame, r5GroundlessMemoryRejected, r5Boundary];
