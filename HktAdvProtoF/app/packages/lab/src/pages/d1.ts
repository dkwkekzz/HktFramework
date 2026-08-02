// /lab/d1 — D1 의존 그래프 스키마.
//
// D0 의 화면은 목록이었다. 이 화면은 **모양**이다 — 몰이꾼 04 의 굶주림 하나에서 일곱 노드가
// 뻗어 나가는 그림이 가운데 놓이고, 그 그림이 곧 이 모듈의 내용이다.
//
// 그림 하나가 말하는 것:
//   ① 뿌리는 하나다 — 실제로 무너지는 자리(허기). 나머지 여섯은 전부 거기에 이어져 있다.
//   ② 한 사람의 굶주림이 일곱 종을 건드린다 — 식량만이 아니라 협곡·통행권·주기·앎·신뢰까지.
//   ③ 선의 모양이 기댐의 방식이다 — 소모는 파선, 허락은 점선, 되풀이는 긴 파선.
//
// 아래로는 노드·간선을 표로 펴고, 설 수 없는 그래프 열둘이 왜 막히는지를 편다.

import {
  BROKEN_GRAPHS,
  WINTER_GRAPH,
} from '@hkt/scenarios/suites/d1-winter-graph';
import { d1Scenarios } from '@hkt/scenarios/suites/d1';
import { runScenarios } from '@hkt/scenarios';
import {
  checkGraph,
  conditionSummary,
  EDGE_RELATIONS,
  graphHash,
  graphVerdict,
  nodeSummary,
  RELATION_SPECS,
  relationsFor,
  type DependencyEdge,
  type DependencyGraph,
} from '@hkt/core/d1';
import { DEPENDENCY_KINDS, kindGrounding, kindLabel } from '@hkt/core/d0';

import { pageView, lines, type PageSpec } from '../page.ts';
import { keyValueView } from '../renderers/diff.ts';
import { graphView, type GraphViewEdge, type GraphViewNode } from '../renderers/graph.ts';
import { suiteView } from '../renderers/scenario.ts';
import { h, type VElement } from '../vnode.ts';

/** D0 11종의 한국어 이름 — 범례가 읽히도록. */
const KIND_LABELS: Readonly<Record<string, string>> = Object.fromEntries(
  DEPENDENCY_KINDS.map((kind) => [kind, kindLabel(kind)]),
);

/** core 그래프를 렌더러가 받는 모양으로 옮긴다 — 렌더러는 core 타입을 모른다. */
function toView(graph: DependencyGraph, badIds: readonly string[] = []): {
  readonly nodes: readonly GraphViewNode[];
  readonly edges: readonly GraphViewEdge[];
} {
  return {
    nodes: graph.nodes.map((node) => ({
      id: node.id,
      label: node.label,
      kind: node.kind,
      hint: nodeSummary(node),
      root: graph.rootIds.includes(node.id),
      bad: badIds.includes(node.id),
    })),
    edges: graph.edges.map((edge) => ({
      from: edge.from,
      to: edge.to,
      relation: edge.relation,
      strength: edge.strength,
      bad: badIds.includes(edge.id),
    })),
  };
}

export function d1Page(): VElement {
  const report = checkGraph(WINTER_GRAPH);
  const suite = runScenarios(d1Scenarios);
  const view = toView(WINTER_GRAPH);
  const nameOf = (id: string): string =>
    WINTER_GRAPH.nodes.find((node) => node.id === id)?.label ?? id;

  /** 맴도는 그래프 하나를 골라 그림으로도 보인다 — 사유는 그림에서 더 잘 보인다. */
  const looping = BROKEN_GRAPHS.find((entry) => entry.expected === 'dependency-cycle');
  const loopingReport = looping === undefined ? null : checkGraph(looping.graph);
  const loopingView =
    looping === undefined
      ? null
      : toView(
          looping.graph,
          (loopingReport?.cycle ?? []).concat(
            looping.graph.edges
              .filter(
                (edge) =>
                  (loopingReport?.cycle ?? []).includes(edge.from) &&
                  (loopingReport?.cycle ?? []).includes(edge.to),
              )
              .map((edge) => edge.id),
          ),
        );

  const brokenRows = BROKEN_GRAPHS.map((entry) => {
    const result = checkGraph(entry.graph);
    const first = result.violations[0];
    return {
      broke: entry.broke,
      expected: entry.expected,
      actual: first?.rule ?? '(통과해 버렸다)',
      path: first?.path ?? '',
      where: first?.label ?? '',
      message: first?.message ?? '',
    };
  });
  const allRejected = brokenRows.every((row) => row.expected === row.actual);

  const spec: PageSpec = {
    id: 'D1',
    title: '의존 그래프 스키마',
    purpose:
      '확정된 의존 대상 열한 종을 노드로 세우고, 그 노드들을 무엇으로 잇는지(관계 7종)를 확정한다.',
    verdict: {
      passed: report.complete && allRejected && suite.failed === 0,
      label: report.complete
        ? `${graphVerdict(report)} · 결함 그래프 ${String(BROKEN_GRAPHS.length)}종 전부 거부 · 시나리오 ${String(suite.passed)}/${String(suite.total)}`
        : graphVerdict(report),
    },
    sections: {
      input: keyValueView([
        ['원문 서식', 'ModulePlan D1 — DependencyNode{id, kind, desiredCondition} · DependencyEdge{relation, strength, urgency, substitutability, failureDelayTicks, failureEffects}'],
        ['D0 가 준 것', `종 ${String(DEPENDENCY_KINDS.length)}개와 그 성격 — 대상이 O1 의 무엇인지·어디서 읽는지·쓰면 주는지·갈아탈 수 있는지`],
        ['O2 가 준 것', '9영역 57자리 — 노드의 조건과 끊김의 흔적은 전부 여기에 적힌다'],
        ['S0-c 가 준 것', 'Band — 자리가 어디에 있어야 하는가 (범위 또는 딱 그 값). 같은 것을 두 번 만들지 않는다'],
        ['검증 장면', `몰이꾼 04 의 겨울 — 노드 ${String(WINTER_GRAPH.nodes.length)} · 간선 ${String(WINTER_GRAPH.edges.length)}`],
        ['결함 그래프', `${String(BROKEN_GRAPHS.length)}종`],
      ]),

      process: [
        h('p', {}, [
          '원문은 조건을 PredicateSpec 이라는 이름으로만 남겼다. 마음대로 술어 언어를 만들면 세계에 없는 것을 조건으로 걸 수 있으므로, 조건은 이미 있는 두 가지로만 적는다 — O2 의 실재하는 자리 + S0-c 의 Band, 그리고 시간 종만 쓰는 V1 틱.',
        ]),
        h('table', { class: 'kv-table' }, [
          h('thead', {}, [
            h('tr', {}, [
              h('th', {}, ['관계']),
              h('th', {}, ['뜻']),
              h('th', {}, ['걸 수 있는 종']),
              h('th', {}, ['왜 그 종들인가']),
            ]),
          ]),
          h(
            'tbody',
            {},
            RELATION_SPECS.map((relation) =>
              h('tr', { class: relation.targetKinds.length === 0 ? '' : 'ok' }, [
                h('td', {}, [h('code', {}, [relation.relation])]),
                h('td', {}, [relation.label]),
                h('td', {}, [
                  relation.targetKinds.length === 0
                    ? '열한 종 전부'
                    : relation.targetKinds.map(kindLabel).join(' · '),
                ]),
                h('td', {}, [relation.note]),
              ]),
            ),
          ),
        ]),
        h('h3', {}, ['D0 의 성격이 여기서 강제된다']),
        lines(
          `소모는 D0 가 쓰면 준다고 적은 셋에만 걸린다 — ${DEPENDENCY_KINDS.filter((kind) => kindGrounding(kind)?.depletes === true).map(kindLabel).join(' · ')}`,
          `그 대상이어야 하는 종(${DEPENDENCY_KINDS.filter((kind) => kindGrounding(kind)?.targeting === 'named').map(kindLabel).join(' · ')})에는 "무엇으로든 대체 가능" 을 적을 수 없다`,
          `시간에 걸 수 있는 관계는 둘뿐이고(${relationsFor('time').join(' · ')}) 조금도 갈아탈 수 없다 — 기다리는 것 말고 방법이 없다`,
          '끊겨도 세계의 자리에 아무것도 남지 않는 간선은 거부된다 — 눈치채지 못하는 결핍은 목적을 만들지 못한다',
        ),
      ],

      candidates: [
        h('p', {}, [
          '몰이꾼 04 의 겨울. 뿌리는 굵은 테두리 하나 — 실제로 무너지는 자리(허기)다. 색은 D0 11종, 선 모양은 관계 7종, 굵기는 강도.',
        ]),
        graphView(view.nodes, view.edges, WINTER_GRAPH.rootIds, {
          kinds: [...DEPENDENCY_KINDS],
          kindLabels: KIND_LABELS,
          legend: true,
          caption: `${WINTER_GRAPH.name} — 해시 ${graphHash(WINTER_GRAPH).slice(0, 12)}`,
        }),
        h('h3', {}, ['노드 — 무엇에 기대고, 무엇이 충족인가']),
        h('table', { class: 'kv-table' }, [
          h('thead', {}, [
            h('tr', {}, [
              h('th', {}, ['노드']),
              h('th', {}, ['종']),
              h('th', {}, ['대상']),
              h('th', {}, ['충족 조건']),
              h('th', {}, ['왜']),
            ]),
          ]),
          h(
            'tbody',
            {},
            WINTER_GRAPH.nodes.map((node) =>
              h('tr', { class: WINTER_GRAPH.rootIds.includes(node.id) ? 'ok' : '' }, [
                h('td', {}, [node.label]),
                h('td', {}, [kindLabel(node.kind)]),
                h('td', {}, [node.target?.name ?? '종류로만']),
                h('td', {}, [conditionSummary(node.condition)]),
                h('td', {}, [node.note]),
              ]),
            ),
          ),
        ]),
      ],

      selection: [
        h('p', {}, [
          '간선 — 어떻게 기대는가, 끊기면 언제 무엇이 남는가. 굶주림 하나가 일곱 종을 건드리고, 그 하나하나가 다른 방식으로 끊긴다.',
        ]),
        h('table', { class: 'kv-table' }, [
          h('thead', {}, [
            h('tr', {}, [
              h('th', {}, ['기댐']),
              h('th', {}, ['강도']),
              h('th', {}, ['급함']),
              h('th', {}, ['대체']),
              h('th', {}, ['끊김까지']),
              h('th', {}, ['그때 세계에 남는 것']),
            ]),
          ]),
          h(
            'tbody',
            {},
            WINTER_GRAPH.edges.map((edge: DependencyEdge) =>
              h('tr', { class: 'ok' }, [
                h('td', {}, [`${nameOf(edge.from)} --${edge.relation}--> ${nameOf(edge.to)}`]),
                h('td', {}, [String(edge.strength)]),
                h('td', {}, [String(edge.urgency)]),
                h('td', {}, [String(edge.substitutability)]),
                h('td', {}, [`${String(edge.failureDelayTicks)}틱`]),
                h('td', {}, [
                  edge.failureEffects
                    .map(
                      (effect) =>
                        `${effect.slot.domain}.${effect.slot.path.split('.')[0] ?? ''} ${
                          effect.change.kind === 'delta'
                            ? `${effect.change.by > 0 ? '+' : ''}${String(effect.change.by)}`
                            : `= ${String(effect.change.value)}`
                        }`,
                    )
                    .join(' · '),
                ]),
              ]),
            ),
          ),
        ]),
      ],

      beforeAfter: [
        h('p', {}, [
          'D0 이후로 열한 종이 확정됐지만 그것은 목록이었다. D1 이후로는 그 종들이 이어져 "이것이 끊기면 저것이 무너진다" 가 계산 가능해진다.',
        ]),
        keyValueView([
          ['전 — D0 이 남긴 것', `기댈 수 있는 대상 ${String(DEPENDENCY_KINDS.length)}종과 각 종의 성격. 아직 이어지지 않았다`],
          ['후 — D1 이 더한 것', `노드(종 + 대상 + 조건) · 간선(관계 ${String(EDGE_RELATIONS.length)}종 + 네 수치 + 끊김의 흔적) · 그래프(뿌리·도달·해시)`],
          ['그래프 해시', `${graphHash(WINTER_GRAPH)} — 적은 순서를 뒤집어도 같은 값이다`],
          [
            '순서를 뒤집으면',
            graphHash(WINTER_GRAPH) ===
            graphHash({
              ...WINTER_GRAPH,
              nodes: [...WINTER_GRAPH.nodes].reverse(),
              edges: [...WINTER_GRAPH.edges].reverse(),
            })
              ? '같은 해시 — 순서는 뜻이 아니다'
              : '해시가 흔들렸다',
          ],
          ['아직 없는 것', 'D2 — 이 그래프를 손으로 적지 않고 종 원형에서 찍어 내는 일. 그때 뿌리가 실제 Need 와 맞는지도 함께 본다'],
        ]),
      ],

      failure: [
        h('p', {}, [
          '설 수 없는 그래프 열둘. 절반은 D0 가 못박은 성격을 어겨서, 절반은 그래프의 모양이 무너져서 막힌다.',
        ]),
        h('table', { class: 'kv-table' }, [
          h('thead', {}, [
            h('tr', {}, [
              h('th', {}, ['어긴 것']),
              h('th', {}, ['걸려야 할 사유']),
              h('th', {}, ['실제']),
              h('th', {}, ['자리']),
              h('th', {}, ['어디서']),
              h('th', {}, ['왜']),
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
                h('td', { class: 'path' }, [row.path]),
                h('td', {}, [row.where]),
                h('td', {}, [row.message]),
              ]),
            ),
          ),
        ]),
        ...(loopingView === null || looping === undefined
          ? []
          : [
              h('h3', {}, ['맴도는 의존은 그림에서 더 잘 보인다']),
              graphView(loopingView.nodes, loopingView.edges, looping.graph.rootIds, {
                kinds: [...DEPENDENCY_KINDS],
                kindLabels: KIND_LABELS,
                caption: `${looping.broke} — ${(loopingReport?.cycle ?? []).map(nameOf).join(' → ')}`,
              }),
            ]),
        h('h3', {}, ['시나리오 3종']),
        suiteView(suite),
      ],

      causality: lines(
        '노드의 조건은 그 종이 읽는 자리여야 한다 — D0 의 readDomains 가 여기서 강제된다. 자원 노드가 남의 신뢰로 채워지면 그것은 자원 의존이 아니다',
        '대상 검사는 새로 만들지 않는다 — D0 의 fitTarget 이 이미 답하므로 그대로 부른다. 같은 판정을 두 번 만들면 두 답이 갈린다',
        '관계 7종은 이름만 다른 일곱 개의 requires 가 아니다 — 무엇에 그 방식으로 기댈 수 있는지가 종마다 갈리고, 그 갈림이 세계의 인과를 만든다',
        '끊김은 언제나 세계의 자리에 흔적을 남긴다 (O0: 큰 변화는 흔적을 남긴다) — 흔적 없는 끊김은 아무도 눈치채지 못하고, 눈치채지 못하는 결핍은 목적을 만들지 못한다',
        '그래프는 무너지는 자리에서 시작한다 — 뿌리에서 닿지 않는 의존은 D4 가 압력을 계산해도 아무 무너짐에도 기여하지 못한다',
        '한 주체 안의 순환은 금지하고 주체 사이의 맞물림은 D5 에 넘긴다 — 마을은 사냥꾼에, 사냥꾼은 마을에 기대는 것이 세계의 실제 모습이다',
        '순서는 뜻이 아니다 — 같은 그래프는 어떤 순서로 적혀도 같은 해시다. D3 의 변형 diff 가 이 값에 기댄다',
        '다음은 D2 — 이 그래프를 손으로 적지 않고 종 원형(S1)에서 찍어 내고, 생존·번식 경로가 끊기지 않는지 본다',
      ),
    },
  };

  return pageView(spec);
}
