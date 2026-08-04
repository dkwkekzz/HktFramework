// /lab/e0 — E0 상황 군집.
//
// 화면이 보여야 하는 것은 넷이다.
//
//   ① **세계의 대부분은 상황이 아니다.** 걸림 열셋 중 상황이 되는 것은 둘뿐이고, 여섯 자리는
//      혼자 걸렸으며, 여덟 주체 중 둘은 아무 상황에도 끼지 않는다.
//   ② **넷이 같은 고기 앞에 섰는데 서로를 알아본 쌍은 없다.** 여섯 쌍 전부 눈멂이다 —
//      D5 가 멈춘 자리가 여기서 값으로 보인다. 그중 하나는 **서로를 아는데도** 눈멂이다.
//   ③ **둘이 04 를 겨누는데 04 는 그 둘을 모른다.** 매복 둘이 선다.
//   ④ **장부 한 줄이 값을 가른다.** 겨눔은 하나도 바꾸지 않았는데 알아봄이 0 에서 둘이 되고
//      매복이 둘에서 하나로 준다 — 이 값이 E3 가 받을 정보 표면이다.

import {
  AFTER_AUDIT,
  AFTER_GRAPH,
  AFTER_PAIRS,
  AFTER_ROWS,
  ALONE_AUDIT,
  BEFORE,
  BEFORE_AUDIT,
  BEFORE_GRAPH,
  BEFORE_PAIRS,
  BEFORE_ROWS,
  BEFORE_VERDICT,
  BLIND_NOTE,
  BROKEN_SITUATIONS,
  EMPTY_AUDIT,
  GRAPH_NOTE,
  NO_OUTCOME_NOTE,
  SHIFT,
  SHIFT_NOTE,
  SOLITUDE_NOTE,
  SOLITUDE_ROWS,
  STAKES_BY_AXIS,
  SUBJECT_IDS,
  nameOf,
} from '@hkt/scenarios/suites/e0-veil-situations';
import { e0Scenarios } from '@hkt/scenarios/suites/e0';
import { runScenarios } from '@hkt/scenarios';
import type { SituationGraph } from '@hkt/core/e0';

import { pageView, lines, type PageSpec } from '../page.ts';
import { diffView, keyValueView } from '../renderers/diff.ts';
import { gaugeView } from '../renderers/gauge.ts';
import { graphView } from '../renderers/graph.ts';
import { suiteView } from '../renderers/scenario.ts';
import { h, type VElement } from '../vnode.ts';

/** 짧은 이름 — 자리의 이름이 길면 화면이 읽히지 않는다. */
const shortKey = (key: string): string => {
  const named = nameOf(key);
  return named === key && key.length > 26 ? `${key.slice(0, 24)}…` : named;
};

/** ①②③ 어느 자리에 몇이 걸렸고 그 안에서 무엇이 갈렸는가. */
function situationTable(rows: typeof BEFORE_ROWS): VElement {
  return h('table', { class: 'kv-table' }, [
    h('thead', {}, [
      h('tr', {}, [
        h('th', {}, ['축']),
        h('th', {}, ['자리']),
        h('th', {}, ['걸린 자들']),
        h('th', {}, ['쌍']),
        h('th', {}, ['알아봄']),
        h('th', {}, ['매복']),
        h('th', {}, ['눈멂']),
        h('th', {}, ['급함']),
      ]),
    ]),
    h(
      'tbody',
      {},
      rows.map((row) =>
        h('tr', { class: row.recognized > 0 ? 'ok' : row.ambushes > 0 ? 'warn' : '' }, [
          h('td', {}, [row.axisLabel]),
          h('td', {}, [shortKey(row.key)]),
          h('td', {}, [row.who.join(', ')]),
          h('td', {}, [String(row.pairs)]),
          h('td', {}, [String(row.recognized)]),
          h('td', {}, [String(row.ambushes)]),
          h('td', {}, [String(row.blind)]),
          h('td', {}, [row.urgency.toFixed(3)]),
        ]),
      ),
    ),
  ]);
}

/** 쌍마다 무엇이 갈리는가 — 겨눔 셋 × 앎 셋. */
function pairTable(pairs: typeof BEFORE_PAIRS): VElement {
  const aimText = (aim: string): string =>
    aim === 'mutual' ? '서로 겨눈다' : aim === 'one-sided' ? '한쪽만 겨눈다' : '아무도 겨누지 않는다';
  const awarenessText = (awareness: string): string =>
    awareness === 'both' ? '둘 다 안다' : awareness === 'one-way' ? '한쪽만 안다' : '아무도 모른다';
  return h('table', { class: 'kv-table' }, [
    h('thead', {}, [
      h('tr', {}, [
        h('th', {}, ['어디서']),
        h('th', {}, ['누구']),
        h('th', {}, ['누구']),
        h('th', {}, ['겨눔']),
        h('th', {}, ['앎']),
        h('th', {}, ['매복']),
      ]),
    ]),
    h(
      'tbody',
      {},
      pairs.map((pair) =>
        h('tr', { class: pair.aim === 'mutual' ? 'ok' : pair.ambush ? 'warn' : '' }, [
          h('td', {}, [pair.where.length > 24 ? `${pair.where.slice(0, 22)}…` : pair.where]),
          h('td', {}, [pair.left]),
          h('td', {}, [pair.right]),
          h('td', {}, [aimText(pair.aim)]),
          h('td', {}, [awarenessText(pair.awareness)]),
          h('td', {}, [pair.ambush ? '매복' : '—']),
        ]),
      ),
    ),
  ]);
}

/** 상황 클러스터 맵 — **주체↔주체** (공용 렌더러 ②). D5 이분 그래프가 긋지 않은 선이다. */
function clusterMap(graph: SituationGraph, caption: string): VElement {
  const nodes = graph.nodes.map((node) => ({
    id: node.id,
    label: `${nameOf(node.id)} (상황 ${String(node.situations)})`,
    kind: node.aimedAt > 0 ? 'aimed-at' : node.aiming > 0 ? 'aiming' : 'standing',
    hint: `겨눈 ${String(node.aiming)} · 겨눔당한 ${String(node.aimedAt)}`,
    root: node.aimedAt > 0,
  }));
  // 같은 두 사람 사이에 상황이 여럿이면 선도 여럿이다 — 어느 자리의 선인지가 이름에 적힌다.
  // **화살은 겨눔의 방향이다** — 한쪽만 겨누는 쌍에서는 겨누는 자에서 겨눔당하는 자로 간다.
  const edges = graph.edges.map((edge) => {
    const aimerId = edge.aim === 'one-sided' ? (edge.aimerIds[0] ?? edge.leftId) : edge.leftId;
    const otherId = aimerId === edge.leftId ? edge.rightId : edge.leftId;
    return {
      from: aimerId,
      to: otherId,
      relation:
        edge.aim === 'mutual' ? '서로 겨눔' : edge.ambush ? '매복' : edge.aim === 'one-sided' ? '한쪽 겨눔' : '눈멂',
      strength: edge.aim === 'mutual' ? 1 : edge.aim === 'one-sided' ? 0.6 : 0.2,
      bad: edge.ambush,
    };
  });
  // 겨누는 자를 왼쪽에 둔다 — 그래야 화살이 한 방향으로 흐르고 그림이 읽힌다.
  const rootIds = graph.nodes
    .filter((node) => node.aiming > 0 && node.aimedAt === 0)
    .map((node) => node.id);
  return graphView(nodes, edges, rootIds, {
    kinds: ['aimed-at', 'aiming', 'standing'],
    kindLabels: {
      'aimed-at': '겨눔당하는 자',
      aiming: '겨누는 자',
      standing: '같은 자리에 서 있을 뿐',
    },
    legend: true,
    caption,
  });
}

/** 걸림이 어느 축에서 났는가 — 사람 축이 E0 가 새로 연 것이다. */
function axisGauge(): VElement {
  const total = BEFORE.stakes.length;
  const rows = [
    ['slot', '자리 — 세계의 한 칸'],
    ['target', '대상 — 세계에 하나뿐인 것'],
    ['subject', '사람 — E0 가 새로 연 축'],
    ['goal', '목적 — 같은 가능성 노드'],
  ].map(([axis, label]) => {
    const count = STAKES_BY_AXIS[axis as string] ?? 0;
    return {
      label: label as string,
      value: total === 0 ? 0 : count / total,
      level: axis === 'subject' ? 'critical' : 'met',
      detail: `${String(count)} / ${String(total)}`,
      hint: axis === 'subject' ? 'D5 이분 그래프가 긋지 않은 선이 여기서 난다' : '',
    };
  });
  return gaugeView(rows, { caption: '걸림 열셋이 어느 축에 놓였는가 (붉은 것이 사람 축)' });
}

/** 설 수 없는 상황들. */
function brokenTable(): VElement {
  return h('table', { class: 'kv-table' }, [
    h('thead', {}, [
      h('tr', {}, [h('th', {}, ['무엇']), h('th', {}, ['사유']), h('th', {}, ['걸리는가']), h('th', {}, ['왜'])]),
    ]),
    h(
      'tbody',
      {},
      BROKEN_SITUATIONS.map((entry) =>
        h('tr', { class: entry.caught ? 'ok' : 'bad' }, [
          h('td', {}, [entry.label]),
          h('td', {}, [entry.rule]),
          h('td', {}, [entry.caught ? '걸린다' : '못 잡는다']),
          h('td', {}, [entry.why]),
        ]),
      ),
    ),
  ]);
}

export function e0Page(): VElement {
  const suite = runScenarios(e0Scenarios);
  const spec: PageSpec = {
    id: 'E0',
    title: '상황 군집',
    purpose:
      '같은 공간·자원·대상·사람에 걸린 목적과 의도들을 하나의 상황으로 묶고, 그 안에서 누가 누구를 알아보는가를 값으로 세운다. 겹쳤다고 서로를 아는 것은 아니다.',
    verdict: {
      passed:
        suite.passed === suite.total &&
        BEFORE_AUDIT.violations.length === 0 &&
        AFTER_AUDIT.violations.length === 0,
      label: `상황 ${String(BEFORE_AUDIT.situations)} · 쌍 ${String(BEFORE_AUDIT.pairs)} (알아봄 ${String(BEFORE_AUDIT.recognized)} · 매복 ${String(BEFORE_AUDIT.ambushes)} · 눈멂 ${String(BEFORE_AUDIT.blind)}) · 혼자 걸린 자리 ${String(BEFORE_AUDIT.solitudes)} · 아무 상황에도 없는 주체 ${String(BEFORE_AUDIT.calm)} · 시나리오 ${String(suite.passed)}/${String(suite.total)}`,
    },
    sections: {
      input: [
        lines(
          'D5 장면의 다툼 다섯과 R6 장면의 의도 둘을 한 세계에 겹쳐 놓은 것이 전부다 — 새로 지은 세계도 기억도 의도도 없다.',
          'D5 는 넷을 고기 하나 앞에 세웠지만 주체끼리는 잇지 않았다 ("누가 누구와 싸우는지는 서로를 봐야 알고, 상황으로 묶는 것은 E0 다").',
          'R6 는 원한을 손으로 만들었지만 의도는 한 사람의 것이었다 — 둘이 같은 사람을 겨눠도 그것을 보는 눈이 없었다.',
          'E0 가 새로 정하는 것은 둘뿐이다: ① 혼자 걸린 자리는 상황이 아니다 ② 겹쳤다고 서로를 아는 것은 아니다.',
        ),
        keyValueView([
          ['무엇을 겨누는가', 'R6 ActionIntent.aim · proposal.changes · targetIds — E0 는 겨눔을 고르지 않는다'],
          ['무엇을 다투는가', 'D5 DependencyConflict — 급함(severity)도 그대로 옮긴다, 다시 재지 않는다'],
          ['누구를 아는가', 'R6 knownCounterparts — R5 지목 + 세계에 적힌 사이. E0 는 앎을 다시 재지 않는다'],
          ['E0 가 더하는 것', '묶는 규칙과 쌍의 이름 — 겨눔 셋(서로·한쪽·눈멂) × 앎 셋(둘 다·한쪽·아무도)'],
        ]),
      ],
      process: [
        axisGauge(),
        h('p', {}, [
          `걸림 ${String(BEFORE.stakes.length)} 이 한 평면에 놓인다. 그중 **사람 축**이 E0 가 새로 연 것이다 — R6 가 "누구를 겨누는가" 를 세운 덕에 겨눔이 곧 사람이라는 자리에 건 걸림이 된다. 겨눔 하나는 걸림 둘을 낸다: 겨누는 자의 것과 **겨눔당하는 자의 것**이다. 뒤엣것이 없으면 "둘이 04 를 겨눈다" 가 04 없는 상황이 된다.`,
        ]),
        keyValueView([
          [`걸림 ${String(BEFORE.stakes.length)}`, `상황이 되는 것은 ${String(BEFORE_AUDIT.situations)} 뿐이다`],
          [`혼자 걸린 자리 ${String(SOLITUDE_ROWS.length)}`, SOLITUDE_NOTE],
          [
            `아무 상황에도 끼지 않은 주체 ${String(BEFORE_AUDIT.calm)} / ${String(SUBJECT_IDS.length)}`,
            '세계는 아무도 부딪히지 않는 자리를 늘 갖는다 — 위반이 아니라 사실이다',
          ],
        ]),
      ],
      candidates: [
        situationTable(BEFORE_ROWS),
        h('p', {}, [
          `넷이 같은 고기 앞에 섰는데 여섯 쌍 **전부 눈멂**이다 — D5 가 멈춘 자리가 여기서 값으로 보인다. 그런데 04 를 겨눈 둘과 04 자신이 선 자리에서는 쌍 셋 중 둘이 **매복**이다: 겨누는 쪽은 언제나 상대를 알지만(R6 "겨눌 수 있는 것은 아는 상대뿐") 겨눔당하는 쪽은 모를 수 있다.`,
        ]),
        pairTable(BEFORE_PAIRS),
        h('p', {}, [BLIND_NOTE]),
      ],
      selection: [
        clusterMap(BEFORE_GRAPH, '상황 클러스터 맵 — 노드는 전부 주체이고 선은 주체↔주체로 간다 (붉은 파선 = 매복)'),
        h('p', {}, [GRAPH_NOTE]),
      ],
      beforeAfter: [
        diffView(
          {
            '04 가 아는 상대': SHIFT.knownBefore,
            '상황': SHIFT.situationsBefore,
            '서로 알아본 쌍': SHIFT.recognizedBefore,
            '매복': SHIFT.ambushBefore,
          },
          {
            '04 가 아는 상대': SHIFT.knownAfter,
            '상황': SHIFT.situationsAfter,
            '서로 알아본 쌍': SHIFT.recognizedAfter,
            '매복': SHIFT.ambushAfter,
          },
          { leftLabel: '04 의 장부가 비어 있을 때', rightLabel: '장부에 한 줄이 적힌 뒤' },
        ),
        h('p', {}, [SHIFT_NOTE]),
        situationTable(AFTER_ROWS),
        clusterMap(AFTER_GRAPH, '장부 한 줄 뒤 — 매복이던 선 하나가 서로 겨눔이 된다'),
        keyValueView(
          AFTER_PAIRS.filter((pair) => pair.aim === 'mutual').map((pair) => [
            `${pair.left} ↔ ${pair.right}`,
            pair.note,
          ]),
        ),
      ],
      failure: [
        brokenTable(),
        keyValueView([
          ['E0 는 이기는 자를 정하지 않는다', NO_OUTCOME_NOTE],
          [
            '빈 재료',
            `상황 ${String(EMPTY_AUDIT.situations)} · 위반 ${String(EMPTY_AUDIT.violations.length)} — 아무 일도 없는 것은 위반이 아니다`,
          ],
          [
            '의도 하나뿐일 때',
            `상황 ${String(ALONE_AUDIT.situations)} · 매복 ${String(ALONE_AUDIT.ambushes)} · 혼자 걸린 자리 ${String(ALONE_AUDIT.solitudes)} — 남을 겨누면 상황은 이미 선다, 겨눔당한 자가 그 자리에 서 있기 때문이다`,
          ],
        ]),
      ],
      causality: [
        keyValueView([
          ['D5 → E0', '"이 대상 앞에 이들이 함께 서 있다" 까지가 D5 다 — 주체끼리 잇는 선은 여기서 그어진다'],
          ['R6 → E0', '겨눔은 R6 가 골랐다 — E0 는 그 겨눔들이 같은 자리에 걸리는 것을 볼 뿐이다'],
          ['R5·R4 → E0', '누가 누구를 아는가는 지목과 세계의 장부에서 온다 — E0 는 앎을 다시 재지 않는다'],
          ['E0 → E1', '요청인지 협박인지 거래인지를 고르는 것은 E1 이다 — E0 는 그 선택이 놓일 자리까지다'],
          ['E0 → E3', '매복(정보 비대칭)이 판정의 입력이 된다 — "정보 상태만 바꿔 승패가 뒤집히는 장면" 의 그 정보다'],
        ]),
        lines(
          '급함을 E0 가 재지 않는다 — D5 severity·P4 score 를 그대로 옮기고, 다르면 urgency-drift 로 걸린다.',
          '앎도 E0 가 재지 않는다 — R6 knownCounterparts 가 유일한 자다.',
          '빠뜨린 상황은 검사로 잡는다 — 둘이 걸렸는데 상황장에 없으면 missing-situation 이다 (D5-c missing-contest 와 같은 자리).',
          BEFORE_VERDICT,
        ),
        suiteView(suite),
      ],
    },
  };
  return pageView(spec);
}
