// /lab/r5 — R5 기억과 관계.
//
// 화면이 보여야 하는 것은 넷이다.
//
//   ① **겪은 자만 짚는다.** 같은 사건 앞에 다섯을 세우면 제 자리가 움직인 하나만 상대를 짚고
//      나머지 넷은 무언가 있었다는 것만 안다 — 손으로 낸 자조차 겪은 것이 아니다.
//   ② **다시 볼 수 없게 된 것이 기억이 된다.** 본 자들의 믿음 아홉 중 여섯이 굳고 셋은 남는다.
//   ③ **지목이 말을 탄다.** 내용은 듣는 자의 손이 좁히는데 지목은 좁혀지지 않는다 — 그래서
//      **무슨 일이 있었는지는 모르는데 누구 탓인지는 아는** 사람이 생긴다.
//   ④ **적힌 사이와 지닌 사이가 갈린다.** 세계의 장부에는 아무것도 없는데 넷이 04 를 원망한다.

import {
  AFTER_RUMOR,
  AXES,
  BEFORE_RUMOR,
  BLAME_CHECKS,
  BLIND_NOTE,
  BROKEN_MEMORIES,
  FADE_ROWS,
  FIRST_TELLING,
  GRUDGE_AFTER,
  GRUDGE_BEFORE,
  HEARING_ROWS,
  HEARSAY_ROWS,
  LABELS,
  LIVED,
  POINTED_ROWS,
  PUSH_TABLE,
  RETELL_ROWS,
  SEALINGS,
  SEEN_MEMORIES,
  SECOND_TELLING,
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
  actorId,
} from '@hkt/scenarios/suites/r5-veil-memories';
import { r5Scenarios } from '@hkt/scenarios/suites/r5';
import { runScenarios } from '@hkt/scenarios';
import { atomLabel } from '@hkt/core/p0';
import { axisLabel, groundLabel, memoryLedgerVerdict, type Memory } from '@hkt/core/r5';

import { pageView, lines, type PageSpec } from '../page.ts';
import { diffView, keyValueView } from '../renderers/diff.ts';
import { gaugeView } from '../renderers/gauge.ts';
import { graphView, type GraphViewEdge, type GraphViewNode } from '../renderers/graph.ts';
import { suiteView } from '../renderers/scenario.ts';
import { timelineView } from '../renderers/timeline.ts';
import { h, type VElement } from '../vnode.ts';

const nameOf = (id: string): string => LABELS.get(id) ?? id;

/** ① 누가 겪었는가 — 다섯 중 하나뿐이다. */
function sufferedTable(): VElement {
  return h('table', { class: 'kv-table' }, [
    h('thead', {}, [
      h('tr', {}, [h('th', {}, ['누구']), h('th', {}, ['겪었는가']), h('th', {}, ['왜'])]),
    ]),
    h(
      'tbody',
      {},
      SUFFERED_ROWS.map((row) =>
        h('tr', { class: row.suffered ? 'ok' : '' }, [
          h('td', {}, [row.label]),
          h('td', {}, [row.suffered ? '겪었다 — 짚을 수 있다' : '아니다 — 누구인지 모른다']),
          h('td', {}, [row.why]),
        ]),
      ),
    ),
  ]);
}

/** 겪은 기억 하나 — 지목은 확실하고 내용은 짐작이다. */
function livedCard(): VElement {
  return keyValueView([
    ['누구를 짚는가', `${nameOf(LIVED.attribution?.subjectId ?? '')} (겪어서 안다)`],
    ['무엇이 있었나', `열여섯 중 ${String(LIVED.candidates.length)} 이 후보이고 제 손이 ${String(LIVED.candidates.length - LIVED.suspected.length)} 을 덜어 ${String(LIVED.suspected.length)} 이 남는다`],
    ['제 어느 자리가 움직였나', LIVED.slot ?? '(없다)'],
    ['확신', `${LIVED.confidence.toFixed(3)} — 물려받은 ${LIVED.carried.toFixed(2)} 이 좁힘에 잘렸다`],
    ['언제의 일인가', `틱 ${String(LIVED.atTick)} · 그 순간 굳었다 (다시 겪을 수 없다)`],
    ['거친 입', `${String(LIVED.hops)} — 제 몸으로 안 것이다`],
  ]);
}

/** ② 굳은 것과 남은 것. */
function sealingTable(): VElement {
  return h('table', { class: 'kv-table' }, [
    h('thead', {}, [
      h('tr', {}, [
        h('th', {}, ['누구']),
        h('th', {}, ['통로']),
        h('th', {}, ['굳었는가']),
        h('th', {}, ['사유']),
      ]),
    ]),
    h(
      'tbody',
      {},
      SEALINGS.map((sealing) =>
        h('tr', { class: sealing.memory === null ? '' : 'ok' }, [
          h('td', {}, [nameOf(sealing.belief.holderId)]),
          h('td', {}, [sealing.belief.channel]),
          h('td', {}, [sealing.memory === null ? '아직 믿음이다' : '기억이 되었다']),
          h('td', {}, [sealing.reason]),
        ]),
      ),
    ),
  ]);
}

/** ③ 누가 듣고 누가 못 듣는가. */
function hearingTable(rows: typeof HEARING_ROWS, title: string): VElement {
  return h('table', { class: 'kv-table' }, [
    h('caption', {}, [title]),
    h('thead', {}, [
      h('tr', {}, [h('th', {}, ['누구']), h('th', {}, ['들었는가']), h('th', {}, ['사유'])]),
    ]),
    h(
      'tbody',
      {},
      rows.map((row) =>
        h('tr', { class: row.heard ? 'ok' : '' }, [
          h('td', {}, [row.label]),
          h('td', {}, [row.heard ? '들었다' : '못 들었다']),
          h('td', {}, [row.message]),
        ]),
      ),
    ),
  ]);
}

/** 내용은 갈리고 지목은 갈리지 않는다. */
function hearsayTable(): VElement {
  return h('table', { class: 'kv-table' }, [
    h('thead', {}, [
      h('tr', {}, [
        h('th', {}, ['들은 자']),
        h('th', {}, ['들은 내용']),
        h('th', {}, ['지닌 내용']),
        h('th', {}, ['덜어 낸 것']),
        h('th', {}, ['누구 탓']),
        h('th', {}, ['확신']),
        h('th', {}, ['그의 손']),
      ]),
    ]),
    h(
      'tbody',
      {},
      HEARSAY_ROWS.map((row) =>
        h('tr', { class: row.kept < row.said ? 'warn' : '' }, [
          h('td', {}, [row.label]),
          h('td', {}, [String(row.said)]),
          h('td', {}, [String(row.kept)]),
          h('td', {}, [row.dropped.length === 0 ? '(없다)' : row.dropped.map(atomLabel).join('·')]),
          h('td', {}, [row.blames === null ? '모른다' : nameOf(row.blames)]),
          h('td', {}, [row.confidence.toFixed(3)]),
          h('td', {}, [row.tells]),
        ]),
      ),
    ),
  ]);
}

/** 하나의 사건이 여러 이야기가 된다 (원문 §20). */
function storyTable(): VElement {
  return h('table', { class: 'kv-table' }, [
    h('thead', {}, [
      h('tr', {}, [
        h('th', {}, ['누구']),
        h('th', {}, ['무엇으로 아는가']),
        h('th', {}, ['거친 입']),
        h('th', {}, ['무엇이 있었나']),
        h('th', {}, ['누구 탓']),
        h('th', {}, ['그의 이야기']),
      ]),
    ]),
    h(
      'tbody',
      {},
      STORIES.map((story) =>
        h('tr', { class: story.blames === null ? '' : 'ok' }, [
          h('td', {}, [story.label]),
          h('td', {}, [groundLabel(story.ground)]),
          h('td', {}, [String(story.hops)]),
          h('td', {}, [`${String(story.suspected.length)} 중 하나`]),
          h('td', {}, [story.blames === null ? '모른다' : nameOf(story.blames)]),
          h('td', {}, [story.line]),
        ]),
      ),
    ),
  ]);
}

/** 말이 한 입을 건널 때마다 옅어진다 — 전달 사슬(공용 렌더러 ④). */
function chainTimeline(): VElement {
  return timelineView(
    [
      {
        order: 1,
        label: `${nameOf(FIRST_TELLING.speakerId)} 이 말한다`,
        kind: 'goal',
        note: `세기 ${FADE_ROWS[0]?.intensity.toFixed(2) ?? ''} · 내용 ${String(FIRST_TELLING.claim.length)} · 지목 ${nameOf(FIRST_TELLING.attribution?.subjectId ?? '')}`,
        badge: `${String(FADE_ROWS[0]?.heardBy ?? 0)} 이 들었다`,
        emphasis: true,
      },
      ...HEARSAY_ROWS.map((row, index) => ({
        order: 2 + index,
        label: `${row.label} 이 듣는다`,
        kind: 'observation',
        note: `내용 ${String(row.said)} → ${String(row.kept)} · 지목은 그대로`,
        badge: row.dropped.length === 0 ? '덜어 낸 것 없음' : `${row.dropped.map(atomLabel).join('·')} 을 덜어 냈다`,
      })),
      {
        order: 2 + HEARSAY_ROWS.length,
        label: `${nameOf(SECOND_TELLING.speakerId)} 이 다시 말한다`,
        kind: 'cost',
        note: `세기 ${FADE_ROWS[1]?.intensity.toFixed(3) ?? ''} — 문턱 0.5 에 못 미친다`,
        badge: '아무도 듣지 못한다',
      },
    ],
    { caption: '말은 한 입을 건널 때마다 옅어지고 두 입을 못 넘는다' },
  );
}

/** ④ 관계망 — 지닌 사이 (공용 렌더러 ②). */
function regardGraph(ledger: typeof AFTER_RUMOR, caption: string): VElement {
  const ids = [
    ...new Set([
      ...ledger.relationships.map((entry) => entry.fromId),
      ...ledger.relationships.map((entry) => entry.toId),
    ]),
  ];
  const nodes: readonly GraphViewNode[] = ids.map((id) => ({
    id,
    label: nameOf(id),
    kind: id === actorId ? 'blamed' : 'holder',
    root: id === actorId,
    hint: id === actorId ? '원망을 받는 자리' : '사이를 지닌 자',
  }));
  const edges: readonly GraphViewEdge[] = ledger.relationships
    .filter((entry) => entry.axis === 'grudge' || entry.axis === 'trust')
    .map((entry) => ({
      from: entry.fromId,
      to: entry.toId,
      relation: `${axisLabel(entry.axis)} ${entry.value.toFixed(2)}`,
      strength: Math.min(1, Math.abs(entry.carried) * 20),
      tone: entry.axis === 'grudge' ? ('removed' as const) : ('changed' as const),
    }));
  return graphView(nodes, edges, [actorId], {
    kinds: ['blamed', 'holder'],
    kindLabels: { blamed: '원망받는 자', holder: '사이를 지닌 자' },
    legend: true,
    caption,
  });
}

/** 원망의 크기 — 게이지. */
function grudgeGauge(): VElement {
  return gaugeView(
    GRUDGE_AFTER.map((row) => ({
      label: row.label,
      value: Math.min(1, row.value * 20),
      level: row.value > 0.032 ? 'critical' : 'deficient',
      detail: `원한 ${row.value.toFixed(3)} (적힌 것 ${row.written.toFixed(2)}) · 근거 ${String(row.traces.length)}`,
      hint: row.traces.map((trace) => trace.line).join(' / '),
    })),
    { caption: '04 를 향한 원한 — 막대는 값을 20배로 늘려 그린 것이다 (실제 값은 오른쪽)' },
  );
}

/** 원자가 사이를 어느 쪽으로 미는가 — 전부 P0-b 에서 읽어 온 표다. */
function pushTableView(): VElement {
  return h('table', { class: 'kv-table' }, [
    h('thead', {}, [
      h('tr', {}, [h('th', {}, ['원자']), ...AXES.map((axis) => h('th', {}, [axisLabel(axis)]))]),
    ]),
    h(
      'tbody',
      {},
      PUSH_TABLE.map((row) =>
        h('tr', { class: row.touches === 0 ? '' : 'ok' }, [
          h('td', {}, [atomLabel(row.atom)]),
          ...AXES.map((axis) =>
            h('td', {}, [row.pushes[axis] > 0 ? '＋' : row.pushes[axis] < 0 ? '−' : '·']),
          ),
        ]),
      ),
    ),
  ]);
}

/** 평균으로 읽는 것과 지목해 읽는 것. */
function pointedTable(): VElement {
  return h('table', { class: 'kv-table' }, [
    h('thead', {}, [
      h('tr', {}, [
        h('th', {}, ['누구']),
        h('th', {}, ['축']),
        h('th', {}, ['P4-b 방식 (적힌 것들의 평균)']),
        h('th', {}, ['R5 방식 (04 를 지목해)']),
        h('th', {}, ['갈림']),
      ]),
    ]),
    h(
      'tbody',
      {},
      POINTED_ROWS.map((row) =>
        h('tr', { class: Math.abs(row.gap) > 1e-9 ? 'warn' : '' }, [
          h('td', {}, [row.label]),
          h('td', {}, [axisLabel(row.axis)]),
          h('td', {}, [row.average.toFixed(3)]),
          h('td', {}, [row.pointed.toFixed(3)]),
          h('td', {}, [row.gap.toFixed(3)]),
        ]),
      ),
    ),
  ]);
}

/** 지목을 실제와 대조한다 — 감사만 본다. */
function blameTable(): VElement {
  return h('table', { class: 'kv-table' }, [
    h('thead', {}, [
      h('tr', {}, [
        h('th', {}, ['누구']),
        h('th', {}, ['짚은 자']),
        h('th', {}, ['실제']),
        h('th', {}, ['거친 입']),
        h('th', {}, ['판정']),
        h('th', {}, ['한 줄']),
      ]),
    ]),
    h(
      'tbody',
      {},
      BLAME_CHECKS.map((check) =>
        h('tr', { class: check.verdict === 'right' ? 'ok' : 'warn' }, [
          h('td', {}, [check.label]),
          h('td', {}, [nameOf(check.blames)]),
          h('td', {}, [nameOf(check.actual)]),
          h('td', {}, [String(check.hops)]),
          h('td', {}, [check.verdict === 'right' ? '맞았다' : '빗나갔다']),
          h('td', {}, [check.note]),
        ]),
      ),
    ),
  ]);
}

/** 설 수 없는 것들. */
function brokenTable(): VElement {
  return h('table', { class: 'kv-table' }, [
    h('thead', {}, [
      h('tr', {}, [
        h('th', {}, ['무엇을 어겼나']),
        h('th', {}, ['어디서']),
        h('th', {}, ['기대 사유']),
        h('th', {}, ['실제 사유']),
        h('th', {}, ['한 줄']),
      ]),
    ]),
    h(
      'tbody',
      {},
      BROKEN_MEMORIES.map((entry) =>
        h('tr', { class: entry.rules.includes(entry.expected) ? 'ok' : 'bad' }, [
          h('td', {}, [entry.broke]),
          h('td', {}, [entry.at === 'form' ? '세우는 자리' : '검사']),
          h('td', {}, [entry.expected]),
          h('td', {}, [entry.rules.join(', ')]),
          h('td', {}, [entry.messages[0] ?? '']),
        ]),
      ),
    ),
  ]);
}

/** 사실이지 위반이 아닌 것들. */
function factTable(): VElement {
  return h('table', { class: 'kv-table' }, [
    h('thead', {}, [
      h('tr', {}, [h('th', {}, ['무엇']), h('th', {}, ['몇']), h('th', {}, ['어긋남인가'])]),
    ]),
    h('tbody', {}, [
      h('tr', {}, [
        h('td', {}, ['아무도 듣지 못한 말']),
        h('td', {}, [String(UNHEARD_TELLINGS.length)]),
        h('td', {}, [SILENT_NOTE]),
      ]),
      h('tr', {}, [
        h('td', {}, ['지목 없는 기억']),
        h('td', {}, [String(UNATTRIBUTED_MEMORIES.length)]),
        h('td', {}, [BLIND_NOTE]),
      ]),
      h('tr', {}, [
        h('td', {}, ['빗나갈 수 있는 지목']),
        h('td', {}, [String(BLAME_CHECKS.filter((check) => check.verdict === 'wrong').length)]),
        h('td', {}, [WRONG_NOTE]),
      ]),
      h('tr', {}, [
        h('td', {}, ['아무도 말하지 않은 기억']),
        h('td', {}, [String(UNSPOKEN_MEMORIES.length)]),
        h('td', {}, ['아니다 — 품고만 있는 것이 대부분이다']),
      ]),
    ]),
  ]);
}

const memorySummary = (memories: readonly Memory[]): readonly (readonly [string, unknown])[] =>
  memories.map((memory) => [
    `${nameOf(memory.holderId)} · ${groundLabel(memory.ground)}`,
    `${String(memory.suspected.length)} 중 하나 · 확신 ${memory.confidence.toFixed(3)} · ${memory.attribution === null ? '누군지 모른다' : `${nameOf(memory.attribution.subjectId)} 탓`}`,
  ]);

export function r5Page(): VElement {
  const suite = runScenarios(r5Scenarios);
  const spec: PageSpec = {
    id: 'R5',
    title: '기억과 관계',
    purpose:
      '과거 사건과 대상 관계가 이후 판단에 영향을 주게 한다 — 그리고 남의 말이 근거가 되게 한다. 겪은 자만 누구인지 알고, 그 지목이 말을 타면 겪지 않은 자도 원망하게 된다.',
    verdict: {
      passed: suite.passed === suite.total && VEIL_AUDIT.violations.length === 0,
      label: `기억 ${String(VEIL_MEMORIES.memories.length)}(겪음 ${String(VEIL_AUDIT.byGround.lived)} · 봄 ${String(VEIL_AUDIT.byGround.seen)} · 들음 ${String(VEIL_AUDIT.byGround.told)}) · 지목 ${String(VEIL_AUDIT.attributed)} · 이야기 ${String(STORIES.length)}갈래 중 ${String(STORY_VARIANTS)}종 · 못 들은 말 ${String(VEIL_AUDIT.unheard)} · 시나리오 ${String(suite.passed)}/${String(suite.total)}`,
    },
    sections: {
      input: [
        lines(
          'R1 로그의 다섯째 사건 — 몰이꾼 04 가 상단 11 을 친다 (제거). 11 의 몸이 0.8 → 0.2 로 깎였다.',
          'R2 현상장 · R3 감지 프로필 · R4 믿음 그래프 아홉 — 전부 앞 계층이 만든 것을 그대로 쓴다.',
          'R5 가 더한 것은 둘뿐이다 — 마을에 선 11 과 귀 없는 이웃 하나(장막벌레).',
        ),
        sufferedTable(),
        livedCard(),
      ],
      process: [
        lines(
          'R5 가 새로 정하는 것은 셋뿐이다 — ① 다시 볼 수 없게 된 믿음이 기억이다 ② 겪은 자만 누구인지 안다 ③ 말은 흔적이 되고, 말에는 지목이 실린다.',
          '나머지는 전부 읽어 온다 — 후보는 R2, 좁힘은 R4 문법, 축은 O2 relational, 미는 방향은 P0-b 걸림, 크기는 R4 확신.',
        ),
        sealingTable(),
        h('p', {}, [
          `본 자들의 믿음 아홉 중 ${String(SEEN_MEMORIES.length)} 이 굳어 기억이 되고 ${String(STILL_BELIEFS.length)} 은 남는다 — 사라지지 않는 자국은 백 틱이 지나도 가서 보면 되기 때문이다. 그리고 굳은 여섯 어디에도 지목은 없다.`,
        ]),
        pushTableView(),
        h('p', {}, [
          '위 표는 R5 가 고른 것이 아니라 P0-b 걸림을 그대로 읽은 것이다. 원한을 세우는 원자는 셋(빼앗기·협박·배신)뿐이고 그것을 치르는 원자는 하나도 없다 — 원한은 쌓이기만 한다. 배신은 신뢰를 쓰면서 동시에 치러 방향이 없고, 제거는 사이를 하나도 건드리지 않는다.',
        ]),
      ],
      candidates: [
        hearingTable(HEARING_ROWS, '① 겪은 자가 말한다 — 누가 듣는가'),
        h('p', {}, [
          '귀 없는 이웃이 못 듣는 사유는 R5 의 것이 아니라 R3 감지의 것이다 — 장막벌레에게 열린 통로는 냄새와 의념뿐이다(S1).',
        ]),
        hearsayTable(),
        h('p', {}, [
          '같은 말을 듣고 사제만 죽임을 덜어 낸다 — 낼 손이 없는 일은 남의 말에서도 떠오르지 않는다(P2 금기 · R4 좁힘 그대로). 그런데 셋 다 04 를 짚는다: 지목은 고를 것이 없는 한 마디라 편향이 낄 자리가 없다.',
        ]),
        chainTimeline(),
        hearingTable(RETELL_ROWS, '② 들은 자가 다시 말한다 — 아무도 듣지 못한다'),
      ],
      selection: [
        storyTable(),
        h('p', {}, [
          `그 사건 하나에서 ${String(STORIES.length)} 개의 이야기가 갈라지고 내용으로는 ${String(STORY_VARIANTS)} 종이 된다(원문 §20). 그런데 누구 탓인지는 하나다 — 무슨 일이 있었는지는 모르는데 누구 탓인지는 아는 사람이 ${String(TOLD_MEMORIES.length)} 생겼다.`,
        ]),
        regardGraph(AFTER_RUMOR, '지닌 사이 — 04 를 향한 신뢰(노랑)와 원한(붉음)'),
        grudgeGauge(),
      ],
      beforeAfter: [
        diffView(
          {
            '04 를 원망하는 자': GRUDGE_BEFORE.map((row) => row.label),
            '움직인 사이': BEFORE_RUMOR.relationships.length,
            '아무도 밀지 못한 짝': BEFORE_RUMOR.untouched.length,
          },
          {
            '04 를 원망하는 자': GRUDGE_AFTER.map((row) => row.label),
            '움직인 사이': AFTER_RUMOR.relationships.length,
            '아무도 밀지 못한 짝': AFTER_RUMOR.untouched.length,
          },
          { leftLabel: '말하기 전', rightLabel: '말한 뒤' },
        ),
        h('p', {}, [
          '말 한 마디에 원망하는 자가 하나에서 넷이 된다. 그런데 세계의 장부(O2 relational)에는 그들 사이에 아무것도 적혀 있지 않다 — R5 는 세계를 쓰지 않는다(writes: []). 갈리는 것이 이 계층의 전부다.',
        ]),
        pointedTable(),
        h('p', {}, [
          'P4-b 는 사이를 "적힌 상대들의 평균" 으로 읽는다(P4 가 남긴 부채: "상대를 지목하는 것은 D5·R 의 몫"). 여기서는 두 값을 나란히 놓아 보이기만 한다 — P4 를 고치지 않는다. 그것을 실제로 먹이는 것은 R6 의 일이다.',
        ]),
        keyValueView(memorySummary(VEIL_MEMORIES.memories)),
      ],
      failure: [
        brokenTable(),
        h('p', {}, ['설 수 없는 것들은 던지지 않는다 — 사유가 값으로 남는다.']),
        factTable(),
      ],
      causality: [
        blameTable(),
        lines(
          '지목은 짐작에서 나오지 않는다 — R4 는 믿음에 actorId 를 싣지 않는다(truth-copied). 그래서 밖에서 본 자는 끝내 누구인지 모른다.',
          '남의 말이 근거가 되지만 R4 의 벽은 그대로 선다 — 듣는 자가 딛고 서는 것은 여전히 제 지각이다(foreign-belief).',
          '말이 옅어지는 것도 R5 가 정하지 않았다 — R4 의 좁힘 상한이 min 을 지나며 저절로 그렇게 되고, 문턱은 R3 이 정한다.',
          '거짓말은 아직 없다 — 말하는 자는 제 기억을 그대로 말한다. 기만은 E1 의 자리다.',
          '기억이 목적을 바꾸는 것은 R6 다 — R5 는 사이를 값으로 세우는 데까지다.',
          memoryLedgerVerdict(VEIL_AUDIT),
        ),
        suiteView(suite),
      ],
    },
  };
  return pageView(spec);
}
