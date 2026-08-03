// /lab/p1 — P1 의존 대응 전략 생성.
//
// 화면이 보여야 하는 것은 셋이다.
//
//   ① **결핍 하나 앞에 갈래가 그림으로 뻗는다.** 가운데에 빈 자리가 서고, 거기서 일곱 방향이
//      뻗는다 — 열린 것은 색이 있고 막힌 것은 붉은 파선이다. 막힌 것을 숨기지 않는 것이 요점이다.
//   ② **결핍의 종이 갈래를 좁힌다.** 겨울 식량(자원) 앞에는 여섯이 열리고 겨울 움막(공간)
//      앞에는 셋만 열린다. 그 좁힘은 P1 이 정한 것이 아니라 D0·D1·P0 이 못박은 성질의 결과다.
//   ③ **일곱 중 하나는 아무에게도 열리지 않는다.** 겨루는 자를 볼 눈이 아직 없기 때문이고
//      (D5), 그 눈을 쥐여 주면 그 자리에서 열린다 — 문법은 이미 서 있다.

import {
  branchOf,
  BROKEN_EXPANSIONS,
  CRISIS_TICK,
  detachOn,
  HUNGER_ROOT,
  RIVAL_TREE,
  trackerTree,
  UNFILLABLE_CASES,
  VEIL_TREES,
} from '@hkt/scenarios/suites/p1-veil-strategies';
import { p1Scenarios } from '@hkt/scenarios/suites/p1';
import { runScenarios } from '@hkt/scenarios';
import { kindLabel } from '@hkt/core/d0';
import { atomLabel } from '@hkt/core/p0';
import {
  atomsOf,
  BLOCK_SPECS,
  BRANCH_RECONCILIATION,
  blockSpec,
  checkDirections,
  checkPossibilities,
  directionLabel,
  directionVerdict,
  expandStrategies,
  openOption,
  possibilityVerdict,
  STRATEGY_DIRECTION_SPECS,
  STRATEGY_DIRECTIONS,
  treeVerdict,
  WATER_BRANCHES,
  type StrategyBranch,
  type StrategyTree,
} from '@hkt/core/p1';

import { pageView, lines, type PageSpec } from '../page.ts';
import { keyValueView } from '../renderers/diff.ts';
import { graphView, type GraphViewEdge, type GraphViewNode } from '../renderers/graph.ts';
import { suiteView } from '../renderers/scenario.ts';
import { h, type VElement } from '../vnode.ts';

/**
 * 갈래 하나를 그림으로 — 가운데에 빈 자리, 거기서 일곱 방향이 뻗는다.
 * 열린 방향은 녹(더함), 막힌 방향은 붉은 파선(끊김)으로 그린다 (공용 그래프 뷰의 갈림 색).
 */
function branchGraph(branch: StrategyBranch): VElement {
  const rootId = `node:${branch.nodeId}`;
  const nodes: GraphViewNode[] = [
    {
      id: rootId,
      label: `${branch.label} (빈 자리)`,
      kind: branch.kind,
      root: true,
      hint: `${branch.dependedBy} 가 ${branch.relation} 로 기댄다 · 압력 ${branch.pressure.toFixed(2)} (${branch.level})`,
    },
    ...branch.options.map((option) => ({
      id: `${rootId}:${option.direction}`,
      label: option.open
        ? `${directionLabel(option.direction)} — ${option.atoms.map(atomLabel).join('·')}`
        : `${directionLabel(option.direction)} ✕`,
      kind: option.open ? 'open' : 'blocked',
      bad: !option.open,
      tone: option.open ? ('added' as const) : ('removed' as const),
      hint: option.why,
    })),
  ];
  const edges: GraphViewEdge[] = branch.options.map((option) => ({
    from: rootId,
    to: `${rootId}:${option.direction}`,
    relation: option.open ? '열림' : (option.blockedBy ?? '막힘'),
    strength: option.open ? 0.9 : 0.3,
    bad: !option.open,
    tone: option.open ? ('added' as const) : ('removed' as const),
  }));
  return graphView(nodes, edges, [rootId], { kinds: [branch.kind, 'open', 'blocked'] });
}

/** 트리 하나를 표로 — 어느 자리가 얼마나 급하고 몇 갈래가 열렸는가. */
function treeTable(tree: StrategyTree): VElement {
  return h('table', { class: 'kv-table' }, [
    h('thead', {}, [
      h('tr', {}, [
        h('th', {}, ['빈 자리']),
        h('th', {}, ['종']),
        h('th', {}, ['누가 기대는가']),
        h('th', {}, ['압력']),
        h('th', {}, ['열린 갈래']),
        h('th', {}, ['막힌 갈래']),
      ]),
    ]),
    h(
      'tbody',
      {},
      tree.branches.map((branch) =>
        h('tr', { class: branch.open.length > 3 ? 'ok' : '' }, [
          h('td', {}, [branch.label]),
          h('td', {}, [kindLabel(branch.kind as never)]),
          h('td', {}, [`${branch.dependedBy} (${branch.relation})`]),
          h('td', {}, [`${branch.pressure.toFixed(2)} ${branch.level}`]),
          h('td', {}, [branch.open.map(directionLabel).join(' · ')]),
          h('td', {}, [
            branch.options
              .filter((option) => !option.open)
              .map((option) => `${directionLabel(option.direction)}(${option.blockedBy ?? ''})`)
              .join(' · '),
          ]),
        ]),
      ),
    ),
  ]);
}

export function p1Page(): VElement {
  const directions = checkDirections();
  const suite = runScenarios(p1Scenarios);
  const possibilities = checkPossibilities(trackerTree);

  const food = branchOf(trackerTree, '겨울 식량');
  const shelter = branchOf(trackerTree, '겨울 움막');

  const brokenRows = BROKEN_EXPANSIONS.map((entry) => {
    const tree = expandStrategies(entry.graph, entry.report);
    const first = tree.violations[0];
    return {
      broke: entry.broke,
      expected: entry.expected,
      actual: first?.rule ?? '(통과해 버렸다)',
      path: first?.path ?? '',
      message: first?.message ?? '',
    };
  });
  const allRejected = brokenRows.every((row) => row.expected === row.actual);

  const spec: PageSpec = {
    id: 'P1',
    title: '의존 대응 전략 생성',
    purpose:
      '결핍된 의존마다 대응 방향 7종을 전개하고, 열리지 않는 방향은 왜 막혔는지를 함께 남긴다.',
    verdict: {
      passed:
        directions.complete &&
        possibilities.complete &&
        allRejected &&
        trackerTree.violations.length === 0 &&
        suite.failed === 0,
      label: directions.complete
        ? `${directionVerdict(directions)} · ${treeVerdict(trackerTree)} · 시나리오 ${String(suite.passed)}/${String(suite.total)}`
        : directionVerdict(directions),
    },
    sections: {
      input: keyValueView([
        ['원문 방향', `ModulePlan P1 — 7종 (${STRATEGY_DIRECTION_SPECS.map((entry) => entry.label).join(' · ')})`],
        ['원문 예시', `물 부족 ${String(WATER_BRANCHES.length)}갈래 — 새 방향이 아니라 방향의 실례여야 한다`],
        ['O1 이 고정한 이름표', 'Possibility.direction 7종 — P1 은 여기에 원자와 열림 조건을 붙인다'],
        ['P0 이 넘긴 것', '방향별 원자 배정 (DIRECTION_RECONCILIATION) — P1 은 다시 적지 않고 읽어 온다'],
        [
          'D4 가 넘긴 것',
          `${String(CRISIS_TICK)}틱의 압력 보고 — 몰이꾼 04 의 빈 자리 ${String(trackerTree.branches.length)}곳`,
        ],
        ['막힘 사유', `${String(BLOCK_SPECS.length)}종 — 전부 앞 계층이 못박은 성질에서 나온다`],
        ['결함 전개', `${String(BROKEN_EXPANSIONS.length)}종`],
      ]),

      process: [
        h('p', {}, [
          '원문은 방향 일곱을 나열한 뒤 물 부족 예시로 일곱 갈래를 든다. 그 갈래들을 방향에 붙여 보면 드러나는 것이 있다 — 다섯 방향만 쓰이고 둘이 비어 있다. 비어 있는 둘은 남이 있어야 성립하는 방향이고, 물 부족 예시에는 남이 없다.',
        ]),
        h('table', { class: 'kv-table' }, [
          h('thead', {}, [
            h('tr', {}, [
              h('th', {}, ['원문이 든 갈래']),
              h('th', {}, ['방향']),
              h('th', {}, ['원자']),
              h('th', {}, ['왜']),
            ]),
          ]),
          h(
            'tbody',
            {},
            BRANCH_RECONCILIATION.map((entry) =>
              h('tr', { class: entry.direction === 'fulfill' ? 'ok' : '' }, [
                h('td', {}, [h('code', {}, [entry.original])]),
                h('td', {}, [directionLabel(entry.direction)]),
                h('td', {}, [atomLabel(entry.atom)]),
                h('td', {}, [entry.reason]),
              ]),
            ),
          ),
        ]),
        h('p', {}, [
          `원문 예시가 한 번도 쓰지 않은 방향: ${directions.unusedDirections.map(directionLabel).join(' · ')} — 그 둘이 정확히 "남이 있어야 열리는" 방향이다.`,
        ]),
      ],

      candidates: [
        h('p', {}, [
          '확정 7방향 — 방향은 행동이 아니라 행동을 고르는 틀이다. 그래서 방향마다 원자가 붙고, 그 배정은 P0 환원표에서 읽어 온다 (여기에 다시 적으면 두 곳이 갈라진다).',
        ]),
        h('table', { class: 'kv-table' }, [
          h('thead', {}, [
            h('tr', {}, [
              h('th', {}, ['방향']),
              h('th', {}, ['하는 일']),
              h('th', {}, ['무엇을 겨누는가']),
              h('th', {}, ['혼자 되는가']),
              h('th', {}, ['원자 (P0)']),
              h('th', {}, ['언제 막히는가']),
            ]),
          ]),
          h(
            'tbody',
            {},
            STRATEGY_DIRECTION_SPECS.map((entry) => {
              const blocks = BLOCK_SPECS.filter((block) =>
                blockedByOf(entry.direction).includes(block.reason),
              );
              return h('tr', { class: 'ok' }, [
                h('td', {}, [entry.label]),
                h('td', {}, [entry.does]),
                h('td', {}, [entry.aimsAt]),
                h('td', {}, [entry.reach === 'alone' ? '된다' : '남이 있어야 한다']),
                h('td', {}, [atomsOf(entry.direction).map(atomLabel).join(' · ')]),
                h('td', {}, [blocks.map((block) => block.reason).join(' · ')]),
              ]);
            }),
          ),
        ]),
        h('h3', {}, ['막힘 사유 여덟 — 전부 앞 계층에서 온다']),
        lines(
          ...BLOCK_SPECS.map(
            (block) =>
              `${block.reason} — ${block.says}${block.owedTo === null ? '' : ` (갚을 자리: ${block.owedTo})`}`,
          ),
        ),
      ],

      selection: [
        h('p', {}, [
          `몰이꾼 04 의 지금(${String(CRISIS_TICK)}틱). 빈 자리가 둘이고, 그 둘 앞에 놓인 갈래의 수가 다르다 — **결핍의 종이 갈래를 좁힌다.**`,
        ]),
        treeTable(trackerTree),
        h('h3', {}, [`겨울 식량(자원) 앞 — ${String(food?.open.length ?? 0)}갈래가 열린다`]),
        food === null ? h('p', { class: 'empty' }, ['(빈 자리가 없다)']) : branchGraph(food),
        h('h3', {}, [`겨울 움막(공간) 앞 — ${String(shelter?.open.length ?? 0)}갈래만 열린다`]),
        shelter === null ? h('p', { class: 'empty' }, ['(빈 자리가 없다)']) : branchGraph(shelter),
        h('p', {}, [
          '장소는 만들 수 없고(생산 원자가 닿지 않는 종), 남에게 맡길 수 없고(D0 넘겨받을 수 없는 종), 덜 쓸 수도 없다(써서 없애는 기댐이 아니다). 셋 다 P1 이 새로 정한 규칙이 아니라 앞 계층이 이미 못박은 성질이다 — 그래서 같은 사람이라도 무엇이 비었는지에 따라 할 수 있는 일이 달라진다.',
        ]),
        h('h3', {}, ['같은 겨울, 네 사람의 갈래']),
        h('table', { class: 'kv-table' }, [
          h('thead', {}, [
            h('tr', {}, [
              h('th', {}, ['누구']),
              h('th', {}, ['가장 급한 빈 자리']),
              h('th', {}, ['그 앞에 열린 갈래']),
              h('th', {}, ['열린 갈래 합']),
              h('th', {}, ['한 번도 안 열린 방향']),
            ]),
          ]),
          h(
            'tbody',
            {},
            VEIL_TREES.map((entry) => {
              const first = entry.tree.branches[0];
              return h('tr', { class: first?.level === 'critical' ? 'ok' : '' }, [
                h('td', {}, [entry.label]),
                h('td', {}, [
                  first === undefined
                    ? '(없다)'
                    : `${first.label} — ${first.pressure.toFixed(2)} ${first.level}`,
                ]),
                h('td', {}, [(first?.open ?? []).map(directionLabel).join(' · ')]),
                h('td', {}, [
                  String(
                    Object.values(entry.tree.openCounts).reduce((sum, count) => sum + count, 0),
                  ),
                ]),
                h('td', {}, [entry.tree.neverOpen.map(directionLabel).join(' · ') || '(없다)']),
              ]);
            }),
          ),
        ]),
        h('p', {}, [
          '넷 다 같은 세계에 서 있는데 04 만 굶주림이 먼저다 — 창고가 비고 마을의 신뢰가 남지 않아 압력이 위기로 올라섰기 때문이다. 나머지 셋은 겨울 움막이 먼저이고, 그 앞에는 세 갈래뿐이다.',
        ]),
      ],

      beforeAfter: [
        h('p', {}, [
          'P0 까지 세운 것은 "무엇을 할 수 있는가" 였다. 열여섯이 놓였지만 어느 것도 이 결핍을 가리키지 않았다. P1 이후로는 결핍마다 갈래가 서고, 그 갈래가 O1 Possibility 로 세계에 남는다.',
        ]),
        keyValueView([
          ['전 — P0 이 남긴 것', '행동 원자 16종과 그 걸림. 결핍과는 아직 이어지지 않았다'],
          [
            '후 — P1 이 더한 것',
            `방향 ${String(directions.directions.length)}종 × 열림 판정 + 대응 트리(압력 순) + ${String(possibilities.possibilities.length)}개의 O1 Possibility`,
          ],
          ['갈래가 서는 자리', 'O1 Possibility{subjectId, forDependencyId, direction, atoms} — 새 타입을 만들지 않았다'],
          [
            '선행 조건은 아직 비어 있다',
            'Possibility.preconditionIds 는 P3(지연 확장)이 채운다 — "먼저 찾아야 빼앗을 수 있다" 가 그 자리다',
          ],
          [
            '고르는 일은 P4 의 몫',
            `지금은 열린 갈래를 전부 세운다. 그중 하나를 고르는 것(압력·성공률·비용·위험·가치관)은 P4 다`,
          ],
          [
            '트리 해시',
            `${trackerTree.hash.slice(0, 16)}… — 같은 세계·같은 그래프면 언제나 같다 (V1 결정성)`,
          ],
        ]),
      ],

      failure: [
        h('p', {}, [
          '설 수 없는 전개는 조용히 통과하지 않는다. 그리고 **막힌 갈래도 사라지지 않는다** — 무엇을 할 수 없는지가 그 주체를 말하기 때문이다.',
        ]),
        h('table', { class: 'kv-table' }, [
          h('thead', {}, [
            h('tr', {}, [
              h('th', {}, ['무엇을 어겼나']),
              h('th', {}, ['예상 사유']),
              h('th', {}, ['실제']),
              h('th', {}, ['어디']),
              h('th', {}, ['뭐라고 하는가']),
            ]),
          ]),
          h(
            'tbody',
            {},
            brokenRows.map((row) =>
              h('tr', { class: row.expected === row.actual ? 'ok' : 'bad' }, [
                h('td', {}, [row.broke]),
                h('td', {}, [h('code', {}, [row.expected])]),
                h('td', {}, [h('code', {}, [row.actual])]),
                h('td', {}, [h('code', {}, [row.path])]),
                h('td', {}, [row.message]),
              ]),
            ),
          ),
        ]),
        h('h3', {}, ['채울 길이 아예 없는 결핍 둘 · 버릴 수 없는 뿌리 하나']),
        h('table', { class: 'kv-table' }, [
          h('thead', {}, [
            h('tr', {}, [
              h('th', {}, ['자리']),
              h('th', {}, ['방향']),
              h('th', {}, ['막힘']),
              h('th', {}, ['누가 갚는가']),
            ]),
          ]),
          h(
            'tbody',
            {},
            [
              ...UNFILLABLE_CASES.map((entry) => {
                const option = openOption('fulfill', entry.node, null, false);
                return { label: entry.label, direction: '충족', option };
              }),
              {
                label: `${HUNGER_ROOT.label} (종이 물려준 뿌리)`,
                direction: '의존 제거',
                option: detachOn(HUNGER_ROOT, true),
              },
            ].map((row) =>
              h('tr', {}, [
                h('td', {}, [row.label]),
                h('td', {}, [row.direction]),
                h('td', {}, [
                  `${row.option.blockedBy ?? ''} — ${blockSpec(row.option.blockedBy as never)?.says ?? ''}`,
                ]),
                h('td', {}, [row.option.owedTo ?? '(갚을 자리가 없다 — 세계가 그러하다)']),
              ]),
            ),
          ),
        ]),
        h('h3', {}, ['일곱 중 하나는 아직 아무에게도 열리지 않는다']),
        keyValueView([
          [
            '지금',
            `${trackerTree.neverOpen.map(directionLabel).join(' · ') || '(없다)'} — 같은 것을 원하는 자를 볼 눈이 세계에 없다`,
          ],
          ['그 눈을 쥐여 주면', `${RIVAL_TREE.neverOpen.length === 0 ? '열리지 않는 방향이 사라진다' : '여전히 막힌다'} — 문법은 이미 서 있고, 값이 없을 뿐이다`],
          ['갚을 모듈', blockSpec('no-known-rival')?.owedTo ?? ''],
        ]),
        suiteView(suite),
      ],

      causality: [
        lines(
          '원문 P1 방향 7 + 물 부족 예시 7갈래 → 방향 확정 (P1-a) · 원자는 P0 환원표에서 읽어 온다',
          '방향 × 결핍 → 열림 판정 (P1-b): 갈아탐=D1 간선 · 소모=D1 관계 · 생산 가능=P0 원자 · 넘김=D0 종 · 뿌리=D2·D3',
          'D4 압력 보고 → 빈 자리만 골라 갈래를 얹는다 (P1-c) — 결핍 0 인 자리는 아무 목적도 만들지 않는다',
          '열린 갈래 → O1 Possibility 로 세계에 남는다 (막힌 갈래는 원소가 되지 않고 사유만 남는다)',
          '급함은 이 자리에 기댄 쪽에서 읽는다 — 창고가 비는 것이 아니라 그 창고에 기댄 몸이 아프다',
          '남은 자리 → P2 가 주체 유형별로 갈래를 다시 좁히고, P3 이 지금 관련된 것만 펼치고, P4 가 하나를 고른다',
          '경쟁 제거는 D5(단계 3)가 서야 값이 들어온다 — 지금은 문법만 서 있다',
        ),
      ],
    },
  };

  return pageView(spec);
}

/** 그 방향이 막힐 수 있는 사유들 — 화면 표의 "언제 막히는가" 열. */
function blockedByOf(direction: (typeof STRATEGY_DIRECTIONS)[number]): readonly string[] {
  switch (direction) {
    case 'fulfill':
      return ['no-target', 'no-filling-atom'];
    case 'substitute':
      return ['not-substitutable'];
    case 'reduce':
      return ['nothing-to-reduce'];
    case 'produce':
      return ['unproducible-kind'];
    case 'delegate':
      return ['untransferable'];
    case 'removeRival':
      return ['no-known-rival'];
    case 'removeDependency':
      return ['species-root'];
  }
}
