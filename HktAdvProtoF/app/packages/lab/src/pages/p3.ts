// /lab/p3 — P3 가능성 그래프 지연 확장.
//
// 화면이 보여야 하는 것은 셋이다.
//
//   ① **선행 물결.** 원자 열여섯이 뿌리 하나(찾다)에서 물결 넷으로 선다. 세계를 보지 않고도
//      서는 표이고, 손으로 적은 것이 아니라 P0 걸림에서 계산된 것이다. 마지막 물결의 넷은
//      전부 남과 등지는 것들이다 — 그 자리를 세우는 것이 주고받기 하나이기 때문이다.
//   ② **전체 회색, 활성 발광.** 같은 갈래를 놓고 본 것이 다른 셋의 부분 그래프가 나란히 선다.
//      펴지 않은 가지는 사라지지 않고 회색으로 남는다 — 없는 길과 아직인 길은 다르다.
//   ③ **모르는 자만 다시 볼 수 있다.** 마비독을 아는 04 에게는 정보 갈래가 서지 않아 기억을
//      다시 볼 길이 없고, 모르는 04 에게만 찾기가 열려 아홉 갈래에 선행으로 걸린다.

import {
  BLIND,
  EXPANSION_CASES,
  REMEMBERING,
  SEEING,
  TRACKER_GRAPH,
  UNKNOWING_BLIND,
  UNKNOWING_REMEMBERING,
  type ExpansionCase,
} from '@hkt/scenarios/suites/p3-veil-expansion';
import { p3Scenarios } from '@hkt/scenarios/suites/p3';
import { runScenarios } from '@hkt/scenarios';
import { atomLabel } from '@hkt/core/p0';
import { directionLabel } from '@hkt/core/p1';
import {
  checkPrerequisites,
  contextSummary,
  contextVerdict,
  prerequisiteVerdict,
  sourceLabel,
  sourcesBefore,
  subgraphVerdict,
  UNSOURCED_SLOTS,
  type ExpansionContext,
  type PossibilitySubgraph,
} from '@hkt/core/p3';

import { pageView, lines, type PageSpec } from '../page.ts';
import { keyValueView } from '../renderers/diff.ts';
import { graphView } from '../renderers/graph.ts';
import { suiteView } from '../renderers/scenario.ts';
import { h, type VElement } from '../vnode.ts';

const prerequisites = checkPrerequisites();

/** ① 선행 물결 표 — 뿌리 하나에서 넷. */
function waveTable(): VElement {
  return h('table', { class: 'kv-table' }, [
    h('thead', {}, [
      h('tr', {}, [h('th', {}, ['물결']), h('th', {}, ['원자']), h('th', {}, ['무엇이 먼저인가'])]),
    ]),
    h(
      'tbody',
      {},
      prerequisites.waves.map((wave, index) =>
        h('tr', {}, [
          h('td', {}, [index === 0 ? '0 (뿌리)' : String(index)]),
          h('td', {}, [wave.map(atomLabel).join(' · ')]),
          h('td', {}, [
            index === 0
              ? '아무것도 — 보지 않고 할 수 있는 유일한 원자다'
              : ([...new Set(wave.flatMap((atom) => sourcesBefore(atom)))]
                  .map((atom) => atomLabel(atom))
                  .join(' · ') || '(선언된 예외뿐)'),
          ]),
        ]),
      ),
    ),
  ]);
}

/** 행동 밖에서 오는 자리 넷. */
function waivedTable(): VElement {
  return keyValueView(
    UNSOURCED_SLOTS.map((entry) => [
      `${entry.slot.domain}.${entry.slot.path}`,
      `${entry.reason} → ${entry.owedTo}`,
    ]),
  );
}

/** ② 부분 그래프 — 전체 회색, 활성 발광. */
function subgraphView(subgraph: PossibilitySubgraph): VElement {
  const targets = new Map(
    TRACKER_GRAPH.nodes.map((node) => [node.id, node.label] as const),
  );
  const nodes = [
    ...new Set(subgraph.all.map((possibility) => possibility.forDependencyId)),
  ].map((nodeId) => ({
    id: nodeId,
    label: targets.get(nodeId) ?? nodeId,
    kind: 'deficit',
    root: true,
    hint: '결핍 — 여기서 갈래가 뻗는다',
  }));
  const active = new Set(subgraph.activeIds);
  for (const possibility of subgraph.all) {
    nodes.push({
      id: possibility.id,
      label: directionLabel(possibility.direction),
      kind: active.has(possibility.id) ? 'active' : 'grey',
      root: false,
      hint: `${possibility.atoms.map((atom) => atomLabel(atom as 'seek')).join('·')}${
        possibility.preconditionIds.length > 0 ? ' — 선행 있음' : ''
      }`,
      ...(active.has(possibility.id) ? { tone: 'added' as const } : {}),
    });
  }
  const edges = subgraph.all.map((possibility) => ({
    from: possibility.forDependencyId,
    to: possibility.id,
    relation: active.has(possibility.id) ? '편다' : '회색',
    strength: active.has(possibility.id) ? 0.9 : 0.2,
    ...(active.has(possibility.id) ? { tone: 'added' as const } : {}),
  }));
  // 선행은 갈래끼리 잇는다 — "찾기가 먼저다" 가 선으로 보인다.
  for (const possibility of subgraph.all) {
    for (const precondition of possibility.preconditionIds) {
      edges.push({ from: precondition, to: possibility.id, relation: '먼저', strength: 0.6 });
    }
  }
  return graphView(
    nodes,
    edges,
    nodes.filter((node) => node.root).map((node) => node.id),
    { kinds: ['deficit', 'active', 'grey'] },
  );
}

/** 근거 하나를 표로. */
function contextTable(context: ExpansionContext): VElement {
  return keyValueView([
    ['판정', contextVerdict(context)],
    ...contextSummary(context).map((line): readonly [string, string] => {
      const cut = line.indexOf(':');
      return [line.slice(0, cut), line.slice(cut + 1).trim()];
    }),
  ]);
}

/** 근거별 부분 그래프 카드. */
function caseCard(entry: ExpansionCase): VElement {
  return h('div', { class: 'case' }, [
    h('h3', {}, [entry.label]),
    h('p', { class: 'tells' }, [entry.tells]),
    h('p', {}, [subgraphVerdict(entry.subgraph)]),
    subgraphView(entry.subgraph),
  ]);
}

/** 사유별 갈래 수 비교. */
function reasonTable(cases: readonly ExpansionCase[]): VElement {
  const reasons = ['blind', 'seen', 'remembered', 'kindOnly', 'unreached', 'unsupplied', 'closed'];
  return h('table', { class: 'kv-table' }, [
    h('thead', {}, [
      h('tr', {}, [h('th', {}, ['근거']), ...reasons.map((reason) => h('th', {}, [reason]))]),
    ]),
    h(
      'tbody',
      {},
      cases.map((entry) =>
        h('tr', {}, [
          h('td', {}, [entry.label]),
          ...reasons.map((reason) => {
            const count = entry.subgraph.trace.byReason[reason] ?? 0;
            return h('td', { class: count === 0 ? '' : reason === 'unreached' ? '' : 'ok' }, [
              String(count),
            ]);
          }),
        ]),
      ),
    ),
  ]);
}

export function p3Page(): VElement {
  const suite = runScenarios(p3Scenarios);
  const passed = suite.failed === 0 && prerequisites.complete;
  const cases = [...EXPANSION_CASES, UNKNOWING_REMEMBERING, UNKNOWING_BLIND];

  const spec: PageSpec = {
    id: 'P3',
    title: '가능성 그래프 지연 확장',
    purpose:
      '모든 가능성을 미리 만들지 않고, 지금 보이는 것·기억·관계에 걸린 부분만 펼친다 — 펴지 않은 가지는 사라지지 않고 회색으로 남는다.',
    verdict: {
      passed,
      label: passed
        ? `선행 물결 ${String(prerequisites.waves.length)} · 근거 넷 · 부분 그래프 ${String(cases.length)}장면 · 시나리오 ${String(suite.passed)}/${String(suite.total)}`
        : '검증 실패',
    },
    sections: {
      input: [
        h('p', {}, [
          'P2 까지 오면 갈래는 이 종·이 문화가 낼 수 있는 것까지 좁혀져 있다. 그래도 여전히 **할 수 있는 것 전부**다. P3 이 받는 것은 그 갈래와, 이 주체가 지금 딛고 선 근거 넷이다.',
        ]),
        keyValueView([
          ['갈래 (P2 NarrowedTree)', `몰이꾼 04 의 열린 갈래 ${String(EXPANSION_CASES[0]?.subgraph.all.length ?? 0)}`],
          ['근거 ① 봄', '세계에 실재해야 한다 — 없는 자리를 본다고 하면 거부한다'],
          ['근거 ② 기억', '실재를 요구하지 않는다 — 지금과 어긋나면 stale 로 남는다'],
          ['근거 ③ 사이', '손으로 주지 않는다 — 세계의 relational 자리에서 읽는다'],
          ['근거 ④ 능력', '세계가 배정하고 문법이 실제로 실어 나른 것만'],
          ['원자 선행 (P3-a)', prerequisiteVerdict(prerequisites)],
        ]),
      ],

      process: [
        h('p', {}, [
          '무엇이 먼저인가는 손으로 적지 않는다. P0 걸림(읽는 자리·바꾸는 자리·치르는 자리)에서 계산되고, 요구는 하나라도 서면 열리므로 선행은 순서가 아니라 **물결**로 나온다.',
        ]),
        waveTable(),
        h('p', {}, [
          '마지막 물결의 넷(빼앗다·설득·협박·배신)은 전부 남과의 사이를 치르는데, 그 자리를 세우는 것은 주고받기 하나다 — **등지는 행동은 쌓인 것이 있어야 치를 수 있다.** 그리고 아무 원자도 세우지 못하는 자리가 넷 남는다.',
        ]),
        waivedTable(),
      ],

      candidates: [
        h('p', {}, [
          '같은 갈래를 놓고 근거만 다른 다섯 장면. 녹색이 지금 편 것, 회색이 아직인 것이다 — 회색은 사라진 것이 아니다.',
        ]),
        ...cases.map(caseCard),
      ],

      selection: [
        h('p', {}, [
          '펴고 안 편 사유가 갈래마다 남는다. 같은 04 인데 본 것이 다르면 표가 통째로 바뀐다.',
        ]),
        reasonTable(cases),
        h('p', {}, [
          '**아는 04 는 기억에 갇힌다.** 마비독을 알기 때문에 그의 그래프에는 정보 의존이 결핍되지 않았고, 그래서 찾기를 내는 갈래가 서지 않는다 — 기억으로만 아는 것을 다시 볼 길이 없다. 모르는 04 에게만 그 갈래가 서고, 그것이 아홉 갈래의 선행이 된다.',
        ]),
      ],

      beforeAfter: [
        h('p', {}, [
          'P1·P2 가 넘긴 `Possibility.preconditionIds` 는 비어 있었다. P3 이후로는 찬다 — 다만 P3 이 새로 정한 것은 없다.',
        ]),
        keyValueView([
          ['전 — P2 가 남긴 것', '좁혀진 갈래. 무엇이 먼저인지는 아무도 몰랐고 선행은 비어 있었다'],
          ['후 — P3 이 더한 것', '근거 넷 + 활성 판정 + 선행이 채워진 부분 그래프'],
          ['본 04 의 근거', contextVerdict(SEEING)],
          ['기억으로만 아는 04', contextVerdict(REMEMBERING)],
          ['아무것도 못 본 04', contextVerdict(BLIND)],
          ['선행의 두 조건', '이미 선 갈래여야 하고, 스스로 서는 갈래여야 한다 — 사슬은 한 칸이다'],
          ['먼저 찾아야 빼앗을 수 있다', sourcesBefore('seize').map(atomLabel).join(' · ')],
        ]),
        h('p', {}, ['근거 넷의 출처 이름: ', ['percept', 'memory', 'relationship', 'capability']
          .map((source) => sourceLabel(source as 'percept'))
          .join(' · ')]),
        contextTable(SEEING),
      ],

      failure: [
        h('p', {}, [
          '근거가 거짓이면 조용히 통과하지 않는다. 관측은 세계를 새로 여는 유일한 통로이므로 거기서 거짓을 허용하면 아무 대상이나 만들어진다.',
        ]),
        lines(
          'unsourced-cost — 치르거나 읽어야 할 자리를 아무 원자도 세우지 못하는데 예외 선언이 없다',
          'stale-cost-exception — 세울 수 없다고 적어 놓고 실제로는 세우는 원자가 있다',
          'rootless-atoms — 뿌리가 없다 (찾다가 눈을 잃으면 세계가 시작하지 못한다)',
          'unreachable-atom — 뿌리에서 닿지 않는다',
          'self-only-source — 그 자리를 세우는 것이 자기 자신뿐이다',
          'phantom-percept — 세계에 없는 자리를 지금 본다고 한다',
          'future-memory — 아직 오지 않은 시각의 기억을 든다',
          'ungranted-capability — 배정 없는 능력 · 문법이 실어 주지 않은 능력',
          'absent-subject — 근거의 주인이 세계에 한 번도 적히지 않았다',
          'unknown-branch-node — 갈래가 선 노드가 의존 그래프에 없다',
          'dangling-precondition — 선행이 이 그래프에 서 있지 않거나 자기 자신이다',
        ),
        suiteView(suite),
      ],

      causality: [
        lines(
          'P0 걸림(reads/writes/pays·requiresObservation·bearing) → 원자 선행 (P3-a) — 손으로 적지 않는다',
          'O2 세계 + P2 문법 → 근거 넷을 한 모양으로 (P3-b) — 사이는 세계에서 읽고 능력은 문법을 지난다',
          'P2 좁혀진 갈래 × 근거 → 활성 부분 그래프 + preconditionIds (P3-c)',
          '찾기는 자원이 아니라 정보 결핍을 채운다 → 정보 의존이 있어야 기억을 다시 볼 수 있다',
          '다음 → P4 가 편 것 중 하나를 고르고(관성), P5 가 그것을 원자 시퀀스로 분해한다',
          '남은 자리: 재료 선행(치를 것이 있는가)은 여기서 걸지 않는다 — 막힌 것인지 브레이크가 없는 것인지는 P4 가 판정한다',
          '남은 자리: 관측은 아직 문법 층이다 — 실제로 무엇을 보는지는 R3 이 세운다',
        ),
      ],
    },
  };

  return pageView(spec);
}
