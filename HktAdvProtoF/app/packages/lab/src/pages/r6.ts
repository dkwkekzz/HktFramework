// /lab/r6 — R6 행동 의도 생성.
//
// 화면이 보여야 하는 것은 넷이다.
//
//   ① **말 한 마디가 셋의 손을 움직인다.** 소문을 듣기 전 목격자 셋에게는 **아는 상대조차 없다** —
//      밖에서 자국만 본 자에게는 지목이 없기 때문이다(R4). 들은 뒤에는 셋 다 04 를 안다.
//   ② **원망해도 못 내는 손이 있다.** 넷이 04 를 원망하는데 빼앗는 손이 서는 것은 둘뿐이다 —
//      상단 둘은 P2 가 그 손을 닫아 두었다. **원한과 손은 다른 것이다.**
//   ③ **축이 갈리면 상대가 갈린다.** 04 는 등지는 손으로는 아무도 겨누지 못하고 내미는 손으로는
//      마을을 겨눈다.
//   ④ **고리가 닫힌다.** 두 의도가 사건이 되고 흔적 여섯이 나 다시 읽힐 수 있게 된다.

import {
  AFTER_ATTEMPTS,
  AXIS_ROWS,
  BEFORE_ATTEMPTS,
  BROKEN_INTENTS,
  CHAIN_NOTES,
  CLOSED_NOTE,
  HAND_ROWS,
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
} from '@hkt/scenarios/suites/r6-veil-intents';
import { r6Scenarios } from '@hkt/scenarios/suites/r6';
import { runScenarios } from '@hkt/scenarios';
import { atomLabel } from '@hkt/core/p0';
import { intentQueueVerdict } from '@hkt/core/r6';

import { pageView, lines, type PageSpec } from '../page.ts';
import { diffView, keyValueView } from '../renderers/diff.ts';
import { gaugeView } from '../renderers/gauge.ts';
import { suiteView } from '../renderers/scenario.ts';
import { timelineView } from '../renderers/timeline.ts';
import { h, type VElement } from '../vnode.ts';

const nameOf = (id: string): string => NAMES.get(id) ?? id;

/** ① 말 한 마디가 무엇을 바꾸는가. */
function rumorTable(): VElement {
  return h('table', { class: 'kv-table' }, [
    h('thead', {}, [
      h('tr', {}, [
        h('th', {}, ['누구']),
        h('th', {}, ['듣기 전 아는 상대']),
        h('th', {}, ['들은 뒤 아는 상대']),
        h('th', {}, ['듣기 전 겨눔']),
        h('th', {}, ['들은 뒤 겨눔']),
      ]),
    ]),
    h(
      'tbody',
      {},
      AFTER_ATTEMPTS.map((after, index) => {
        const before = BEFORE_ATTEMPTS[index];
        const moved = before?.aim === null && after.aim !== null;
        return h('tr', { class: moved ? 'ok' : '' }, [
          h('td', {}, [after.label]),
          h('td', {}, [String(before?.known ?? 0)]),
          h('td', {}, [String(after.known)]),
          h('td', {}, [before?.aim === null ? '—' : nameOf(before?.aim.counterpartId ?? '')]),
          h('td', {}, [after.aim === null ? '—' : nameOf(after.aim.counterpartId)]),
        ]);
      }),
    ),
  ]);
}

/** ② 원망과 손은 다른 것이다. */
function handTable(): VElement {
  return h('table', { class: 'kv-table' }, [
    h('thead', {}, [
      h('tr', {}, [
        h('th', {}, ['누구']),
        h('th', {}, ['원망하는가']),
        h('th', {}, ['빼앗는 손이 서는가']),
        h('th', {}, ['그의 손 (P2)']),
        h('th', {}, ['사유']),
      ]),
    ]),
    h(
      'tbody',
      {},
      HAND_ROWS.map((row) =>
        h('tr', { class: row.stands ? 'ok' : row.resents ? 'warn' : '' }, [
          h('td', {}, [row.label]),
          h('td', {}, [row.resents ? '원망한다' : '아니다']),
          h('td', {}, [row.stands ? '선다' : '서지 않는다']),
          h('td', {}, [row.tells]),
          h('td', {}, [row.why]),
        ]),
      ),
    ),
  ]);
}

/** ③ 축이 갈리면 상대가 갈린다. */
function axisTable(): VElement {
  return h('table', { class: 'kv-table' }, [
    h('thead', {}, [
      h('tr', {}, [
        h('th', {}, ['누구']),
        h('th', {}, ['등지는 손 (원한)']),
        h('th', {}, ['내미는 손 (신뢰)']),
        h('th', {}, ['갈리는가']),
      ]),
    ]),
    h(
      'tbody',
      {},
      AXIS_ROWS.map((row) =>
        h('tr', { class: row.split ? 'warn' : '' }, [
          h('td', {}, [row.label]),
          h('td', {}, [row.againstAim]),
          h('td', {}, [row.mutualAim]),
          h('td', {}, [row.split ? '갈린다' : '같다']),
        ]),
      ),
    ),
  ]);
}

/** ④ 고리 — 의도에서 흔적까지 (공용 렌더러 ④). */
function loopTimeline(): VElement {
  return timelineView(
    [
      {
        order: 1,
        label: '원한이 선다 (R5)',
        kind: 'cost',
        note: '겪은 11 이 04 를 짚고, 그 지목이 말을 타고 셋에게 건넜다',
        badge: `${String(MOVED_BY_RUMOR)} 의 손이 움직였다`,
      },
      ...LOOP_ROWS.map((row, index) => ({
        order: 2 + index,
        label: `${row.label} 이 ${row.atom} 를 낸다`,
        kind: 'goal',
        note: `${row.aimedAt} 를 겨눈다 · 흔적 ${String(row.phenomena)}(${row.channels.join('·')})`,
        badge: row.enacted ? '사건이 되었다' : '사건이 되지 못했다',
        emphasis: true,
      })),
      {
        order: 2 + LOOP_ROWS.length,
        label: '흔적이 다시 읽힐 수 있게 된다 (R2 → R3)',
        kind: 'observation',
        note: `흔적 ${String(LOOP.phenomena.length)} 이 세계에 서고 전부 원인 사건을 댄다`,
        badge: '고리가 닫혔다',
      },
    ],
    { caption: '결핍 → 목적 → 계획 → 의도 → 사건 → 흔적 → 지각 → 믿음 → 기억·사이 → 다시 의도' },
  );
}

/** 겨눔의 크기 — 무엇을 보고 골랐는가. */
function aimGauge(): VElement {
  const rows = AFTER_ATTEMPTS.flatMap((entry) =>
    entry.candidates.map((candidate) => ({
      label: `${entry.label} → ${nameOf(candidate.subjectId)}`,
      value: Math.min(1, Math.abs(candidate.value) * 20),
      level: candidate.chosen ? 'critical' : 'met',
      detail: `${candidate.axis} ${candidate.value.toFixed(3)} · ${candidate.via === 'attribution' ? '기억이 짚었다' : '세계가 적어 두었다'}`,
      hint: candidate.note,
    })),
  );
  return gaugeView(rows, {
    caption: '겨눔의 재료 — 막대는 값을 20배로 늘려 그린 것이다 (붉은 것이 골린 상대)',
  });
}

/** 고리의 걸음마다 무엇이 났는가. */
function loopTable(): VElement {
  return h('table', { class: 'kv-table' }, [
    h('thead', {}, [
      h('tr', {}, [
        h('th', {}, ['누구']),
        h('th', {}, ['원자']),
        h('th', {}, ['겨눈 상대']),
        h('th', {}, ['사건이 되었는가']),
        h('th', {}, ['흔적']),
        h('th', {}, ['통로']),
      ]),
    ]),
    h(
      'tbody',
      {},
      LOOP_ROWS.map((row) =>
        h('tr', { class: row.enacted && row.phenomena > 0 ? 'ok' : 'warn' }, [
          h('td', {}, [row.label]),
          h('td', {}, [row.atom]),
          h('td', {}, [row.aimedAt]),
          h('td', {}, [row.enacted ? '되었다' : '아니다']),
          h('td', {}, [String(row.phenomena)]),
          h('td', {}, [row.channels.join(', ')]),
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
      BROKEN_INTENTS.map((entry) =>
        h('tr', { class: entry.rules.includes(entry.expected) ? 'ok' : 'bad' }, [
          h('td', {}, [entry.broke]),
          h('td', {}, [
            entry.at === 'aim' ? '겨눔' : entry.at === 'form' ? '의도 세우기' : '고리',
          ]),
          h('td', {}, [entry.expected]),
          h('td', {}, [entry.rules.join(', ')]),
          h('td', {}, [entry.messages[0] ?? '']),
        ]),
      ),
    ),
  ]);
}

export function r6Page(): VElement {
  const suite = runScenarios(r6Scenarios);
  const spec: PageSpec = {
    id: 'R6',
    title: '행동 의도 생성',
    purpose:
      '활성 목적과 계획을 실제 세계 행동으로 제출한다 — 그리고 겨눌 상대를 사이가 고르게 한다. 원한이 손이 되면 단계 3 의 고리가 닫힌다.',
    verdict: {
      passed: suite.passed === suite.total && VEIL_AUDIT.violations.length === 0,
      label: `의도 ${String(VEIL_AUDIT.queued)}(겨눔 ${String(VEIL_AUDIT.aimed)}) · 사건 ${String(VEIL_AUDIT.enacted)} · 흔적 ${String(LOOP.phenomena.length)} · 소문이 움직인 손 ${String(MOVED_BY_RUMOR)} · 아무것도 못 낸 주체 ${String(VEIL_AUDIT.idle.length)} · 시나리오 ${String(suite.passed)}/${String(suite.total)}`,
    },
    sections: {
      input: [
        lines(
          'R5 장면 그대로 — 겪은 11 과 들은 셋이 04 를 원망하고, 세계의 장부에는 그 원한이 적혀 있지 않다.',
          '더한 것은 넷의 계획뿐이다 (빼앗기 한 걸음 · 주고받기 한 걸음). 계획의 형식은 P5, 요청의 형식은 P0-c 가 이미 갖고 있다.',
          'R6 가 새로 정하는 것은 둘이다 — ① 겨눌 수 있는 것은 아는 상대뿐이다 ② 누구를 겨누는가는 사이가 고른다.',
        ),
        keyValueView([
          ['상대가 필요한 원자', '여섯 — P0-b touches: between 이 갈라 두었다 (나머지 열은 자리와 물건을 겨눈다)'],
          ['등지는 손이 보는 축', '원한 — P0-b 가 빼앗기·협박·배신을 전부 원한을 세우는 원자로 적어 두었다'],
          ['내미는 손이 보는 축', '신뢰 — P4-b 가 쓴 동의 축 그대로다'],
          ['바꿀 자리·치를 자리', '호출자가 준다 — 효과의 양은 E2·G 가 갚는다는 R1 의 선언 그대로'],
        ]),
      ],
      process: [
        rumorTable(),
        h('p', {}, [
          `말을 듣기 전 목격자 셋에게는 **아는 상대가 하나도 없다** — 밖에서 자국만 본 자에게는 지목이 없고(R4 가 actorId 를 싣지 않는다), 세계도 그들 사이를 적어 두지 않았다. 들은 뒤에는 셋 다 04 를 안다. **말 한 마디가 ${String(MOVED_BY_RUMOR)} 의 손을 움직였다.**`,
        ]),
        aimGauge(),
      ],
      candidates: [
        handTable(),
        h('p', {}, [
          '넷이 04 를 원망하는데 빼앗는 손이 서는 것은 둘뿐이다. 상단 둘은 P2 가 "다음 겨울에 문이 닫히기 때문" 이라고 그 손을 닫아 두었다 — 원망한다고 아무 손이나 나가지는 않는다. **원한과 손은 다른 것이다.**',
        ]),
        axisTable(),
        h('p', {}, [
          `축이 갈리면 상대가 갈린다. 04 는 원한이 선 상대가 없어 등지는 손으로는 아무도 겨누지 못하는데, 내미는 손으로는 마을을 겨눈다(세계가 그 신뢰를 적어 두었다). 나머지 넷은 반대다 — 원망할 사람은 있는데 손 내밀 사람이 없다. 겨울이 그런 계절이다. 내미는 손으로 겨눌 상대가 있는 것은 ${String(MUTUAL_ATTEMPTS.filter((entry) => entry.aim !== null).length)} 뿐이다.`,
        ]),
      ],
      selection: [
        keyValueView(
          INTENTS.map((intent) => [
            nameOf(intent.providerId),
            `${atomLabel(intent.atom)} → ${nameOf(intent.aim?.counterpartId ?? '')} (${intent.aim?.note ?? ''})`,
          ]),
        ),
        loopTimeline(),
        loopTable(),
      ],
      beforeAfter: [
        diffView(
          { '원장의 칸': LEDGER_BEFORE, '사건': 0, '흔적': 0 },
          {
            '원장의 칸': LEDGER_AFTER,
            '사건': LOOP.log.events.length,
            '흔적': LOOP.phenomena.length,
          },
          { leftLabel: '의도를 내기 전', rightLabel: '고리를 돌린 뒤' },
        ),
        h('p', {}, [CLOSED_NOTE]),
      ],
      failure: [
        brokenTable(),
        keyValueView([
          [`아무 의도도 내지 못한 주체 ${String(VEIL_AUDIT.idle.length)}`, IDLE_NOTE],
          [
            '아무 흔적도 안 낸 사건',
            `${String(VEIL_AUDIT.silent)} — 앎만 움직인 사건은 조용하다 (R2-c 가 이미 사실로 센 자리)`,
          ],
        ]),
      ],
      causality: [
        keyValueView(CHAIN_NOTES.map(([layer, note]) => [layer, note])),
        lines(
          '겨눌 상대를 R6 가 지어내지 않는다 — 아는 상대는 R5 지목과 세계의 장부 둘에서만 오고, 고르는 축은 P0-b 동의 축이 정한다.',
          '낼 수 있는 손도 R6 가 정하지 않는다 — P2 문법이 닫은 것은 여기서도 서지 못한다.',
          '요청이 설 수 있는지는 P0-c 가, 사건이 설 수 있는지는 R1 이, 무엇이 새는지는 R2-a 가 정한다 — R6 는 잇기만 한다.',
          '그래서 고리는 주장이 아니라 검사다: 이어지지 않으면 그 사실이 값으로 남는다.',
          intentQueueVerdict(VEIL_AUDIT),
        ),
        suiteView(suite),
      ],
    },
  };
  return pageView(spec);
}
