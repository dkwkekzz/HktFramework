// /lab/d3 — D3 개인·문화·능력에 의한 의존 변형.
//
// D2 의 화면은 종의 그래프였다. 이 화면이 보이는 것은 **그 그래프에서 갈라진 넷**이다.
//
//   ① 넷의 그래프가 기본 대비 무엇이 더해지고(녹) 흔들렸는지(노랑)가 그림에 실린다.
//   ② 같은 허기가 개체마다 다르게 급하다 — 성격이 흔든 값이 그래프에 실린 것이다.
//   ③ 사제의 전환 장부: 식량 0.5 를 덜어 내고 의념 0.6 을 세웠고, 그 의념은 붉은 장막이
//      치르는 대가의 자리다. 그는 굶기를 그만둔 것이 아니라 갈아탔다.
//   ④ 설 수 없는 변형 열이 왜 막히는지가 표로 펴진다 — 대부분 "공짜로 벗어났다" 다.

import { graphHash, type DependencyGraph } from '@hkt/core/d1';
import { DEPENDENCY_KINDS, kindLabel } from '@hkt/core/d0';
import { buildSpeciesGraph } from '@hkt/core/d2';
import {
  editSummary,
  graphBirthOf,
  originLabel,
  personalizeFromWorld,
  personalizeGraph,
  personalVerdict,
  type PersonalReport,
} from '@hkt/core/d3';
import {
  BROKEN_VARIATIONS,
  hunterArchetype,
  hunterBlueprint,
  S3_DEFINITIONS,
  VEIL_INSTANCES,
  VEIL_VARIATIONS,
} from '@hkt/scenarios/suites/d3-veil-variations';
import { d3Scenarios } from '@hkt/scenarios/suites/d3';
import { runScenarios } from '@hkt/scenarios';

import { pageView, lines, type PageSpec } from '../page.ts';
import { keyValueView } from '../renderers/diff.ts';
import {
  graphView,
  type DiffTone,
  type GraphViewEdge,
  type GraphViewNode,
} from '../renderers/graph.ts';
import { suiteView } from '../renderers/scenario.ts';
import { h, type VElement, type VNode } from '../vnode.ts';

const KIND_LABELS: Readonly<Record<string, string>> = Object.fromEntries(
  DEPENDENCY_KINDS.map((kind) => [kind, kindLabel(kind)]),
);

const options = { definitions: S3_DEFINITIONS };
const baseOf = (instance: (typeof VEIL_INSTANCES)[number]): DependencyGraph =>
  buildSpeciesGraph(hunterArchetype, hunterBlueprint, graphBirthOf(instance, '성체'));

/**
 * 기본과 개인 그래프를 겹쳐 그린다 — 더함=녹 · 끊김=적 · 흔들림=노랑.
 * 끊긴 간선은 개인 그래프에 없으므로 기본에서 데려온다: 사라진 것도 갈림이다.
 */
function diffView(report: PersonalReport): {
  readonly nodes: readonly GraphViewNode[];
  readonly edges: readonly GraphViewEdge[];
} {
  const { base, graph, diff } = report;
  const changed = new Set(diff.changedEdges.map((entry) => entry.id));
  const removedNodes = base.nodes.filter(
    (node) => !graph.nodes.some((entry) => entry.id === node.id),
  );

  const toneOfNode = (id: string, removed: boolean): DiffTone | undefined => {
    if (removed) return 'removed';
    return diff.addedNodes.includes(id) ? 'added' : undefined;
  };

  const nodes: GraphViewNode[] = [...graph.nodes, ...removedNodes].map((node) => ({
    id: node.id,
    label: node.label,
    kind: node.kind,
    hint: node.note,
    root: graph.rootIds.includes(node.id),
    ...(toneOfNode(node.id, removedNodes.includes(node)) === undefined
      ? {}
      : { tone: toneOfNode(node.id, removedNodes.includes(node)) as DiffTone }),
  }));

  const removedEdges = base.edges.filter((edge) => diff.removedEdges.includes(edge.id));
  const edges: GraphViewEdge[] = [...graph.edges, ...removedEdges].map((edge) => {
    const tone: DiffTone | undefined = diff.removedEdges.includes(edge.id)
      ? 'removed'
      : diff.addedEdges.includes(edge.id)
        ? 'added'
        : changed.has(edge.id)
          ? 'changed'
          : undefined;
    return {
      from: edge.from,
      to: edge.to,
      relation:
        tone === 'changed'
          ? `${edge.relation} ${String(edge.strength)}`
          : edge.relation,
      strength: edge.strength,
      ...(tone === undefined ? {} : { tone }),
    };
  });

  return { nodes, edges };
}

/** 전환 장부 — 무엇을 덜어 내고 무엇을 세웠는가. */
function ledgerTable(reports: readonly PersonalReport[]): VNode {
  const rows = reports.flatMap((report) =>
    report.conversions.map((entry) => ({ name: report.name, entry })),
  );
  return h('table', { class: 'kv-table' }, [
    h('thead', {}, [
      h('tr', {}, [
        h('th', {}, ['개체']),
        h('th', {}, ['변형']),
        h('th', {}, ['유래']),
        h('th', {}, ['덜어 낸 것']),
        h('th', {}, ['세운 것']),
        h('th', {}, ['무게']),
        h('th', {}, ['대가 자리']),
        h('th', {}, ['판정']),
      ]),
    ]),
    h(
      'tbody',
      {},
      rows.map(({ name, entry }) =>
        h('tr', { class: 'ok' }, [
          h('td', {}, [name]),
          h('td', {}, [entry.name]),
          h('td', {}, [entry.origin]),
          h('td', {}, [entry.lostFrom.join(' · ') || '—']),
          h('td', {}, [entry.gainedTo.join(' · ') || '—']),
          h('td', {}, [
            entry.converts
              ? `${entry.lost.toFixed(2)} → ${entry.gained.toFixed(2)}`
              : `+${entry.gained.toFixed(2)}`,
          ]),
          h('td', { class: 'path' }, [entry.costSlots.join(' · ') || '—']),
          h('td', {}, [
            entry.converts
              ? entry.onCostSlot
                ? '전환 — 대가의 자리에 걸렸다'
                : '전환'
              : '더하기만 한다',
          ]),
        ]),
      ),
    ),
  ]);
}

export function d3Page(): VElement {
  const reports = VEIL_INSTANCES.map((instance) =>
    personalizeFromWorld(baseOf(instance), instance, VEIL_VARIATIONS, options),
  );
  const suite = runScenarios(d3Scenarios);
  const priest = reports[3] as PersonalReport;
  const allStand = reports.every((report) => report.complete);

  const brokenRows = BROKEN_VARIATIONS.map((entry) => {
    const report = personalizeGraph(
      baseOf(entry.instance),
      entry.instance,
      entry.variations,
      options,
    );
    const first = report.violations[0];
    return {
      broke: entry.broke,
      who: entry.instance.name,
      expected: entry.expected,
      actual: first?.rule ?? '(통과해 버렸다)',
      path: first?.path ?? '',
      message: first?.message ?? '',
    };
  });
  const allRejected = brokenRows.every((row) => row.expected === row.actual);

  const urgencyRows = reports.map((report) => {
    const edge = report.graph.edges.find(
      (entry) => report.graph.nodes.find((node) => node.id === entry.from)?.label === '주린 몸',
    );
    return {
      name: report.name,
      urgency: Number((edge?.urgency ?? 0).toFixed(2)),
      delay: edge?.failureDelayTicks ?? 0,
      strength: edge?.strength ?? 0,
      applied: report.applied.map((entry) => entry.name).join(' · ') || '없음',
      nodes: report.graph.nodes.length,
    };
  });

  const spec: PageSpec = {
    id: 'D3',
    title: '개인·문화·능력에 의한 의존 변형',
    purpose:
      '종이 물려준 기본 의존 그래프를 개인·문화·능력이 변형하게 하되, 의존이 사라지지 않고 다른 의존으로 전환되게 한다.',
    verdict: {
      passed: allStand && allRejected && suite.failed === 0,
      label: allStand
        ? `개체 ${String(reports.length)}명이 같은 기본에서 갈라진다 (그래프 ${String(
            new Set(reports.map((report) => graphHash(report.graph))).size,
          )}종) · 결함 변형 ${String(BROKEN_VARIATIONS.length)}종 전부 거부 · 시나리오 ${String(suite.passed)}/${String(suite.total)}`
        : reports
            .filter((report) => !report.complete)
            .map((report) => personalVerdict(report))
            .join(' / '),
    },
    sections: {
      input: keyValueView([
        [
          '원문 조건',
          'ModulePlan D3 — "새 능력이 의존성을 완전히 제거하는 것이 아니라 다른 비용이나 의존 대상으로 전환되는지 확인한다"',
        ],
        ['D2 가 준 것', '종의 기본 의존 그래프 — 같은 종의 넷이 완전히 같은 것을 받았다'],
        ['S3 가 준 것', '개체 넷 — 이력·성격이 이미 갈라 둔 Need (겁 많으면 같은 허기가 ×1.4)'],
        ['S2 가 준 것', '문화·자리 — 무엇을 더 할 수 있고 무엇을 원하는가'],
        ['O0 가 준 것', '능력의 대가(costs) — 전환이 걸릴 자리를 여기서 읽는다'],
        ['D3 가 새로 받는 것', '변형 선언(VariationSpec) — 유래 + 더함·약화·끊음'],
        ['검증 장면', `사냥꾼 넷 · 세계의 변형 ${String(VEIL_VARIATIONS.length)}개 · 결함 변형 ${String(BROKEN_VARIATIONS.length)}종`],
      ]),

      process: [
        h('p', {}, [
          '개인화의 첫 일은 변형이 아니라 다시 읽기다. S3 는 이미 넷을 갈라 두었는데(겁이 많으면 같은 허기가 더 급하다) 그 갈림이 의존에는 실리지 않았다. 그래서 뿌리 간선의 급함·시한을 종의 템플릿이 아니라 개체의 실제 Need 에서 다시 읽는다. 성격은 D3 의 변형 문법을 쓰지 않는다 — 같은 값을 두 곳에서 흔들면 두 답이 갈린다.',
        ]),
        h('table', { class: 'kv-table' }, [
          h('thead', {}, [
            h('tr', {}, [
              h('th', {}, ['할 수 있는 것']),
              h('th', {}, ['무엇을 바꾸는가']),
              h('th', {}, ['전환 검사 대상']),
            ]),
          ]),
          h('tbody', {}, [
            h('tr', { class: 'ok' }, [
              h('td', {}, ['더함 (add)']),
              h('td', {}, ['새 채움 갈래 — D2 의 SupplySpec 을 그대로 쓴다']),
              h('td', {}, ['아니다 (무게를 세우는 쪽)']),
            ]),
            h('tr', { class: 'ok' }, [
              h('td', {}, ['약화 (weaken)']),
              h('td', {}, ['이미 있는 기댐의 강도를 낮춘다']),
              h('td', {}, ['그렇다 — 덜어 낸 만큼 세워야 한다']),
            ]),
            h('tr', { class: 'ok' }, [
              h('td', {}, ['끊음 (drop)']),
              h('td', {}, ['이미 있는 기댐을 끊는다']),
              h('td', {}, ['그렇다 — 그리고 뿌리가 비면 따로 막힌다']),
            ]),
            h('tr', {}, [
              h('td', {}, ['(없음) 노드를 지우는 편집']),
              h('td', {}, ['—']),
              h('td', {}, ['문법에 두지 않았다 — 무엇으로 무너지는가는 종의 것이다 (사제도 굶는다)']),
            ]),
          ]),
        ]),
        h('h3', {}, ['세계에 선언된 변형 넷 — 개체는 자기 유래의 것만 받는다']),
        h('table', { class: 'kv-table' }, [
          h('thead', {}, [
            h('tr', {}, [
              h('th', {}, ['변형']),
              h('th', {}, ['유래']),
              h('th', {}, ['편집']),
              h('th', {}, ['왜']),
            ]),
          ]),
          h(
            'tbody',
            {},
            VEIL_VARIATIONS.map((variation) =>
              h('tr', { class: 'ok' }, [
                h('td', {}, [variation.name]),
                h('td', {}, [originLabel(variation.origin)]),
                h('td', { class: 'path' }, [variation.edits.map(editSummary).join(' · ')]),
                h('td', {}, [variation.note]),
              ]),
            ),
          ),
        ]),
      ],

      candidates: [
        h('p', {}, [
          '넷의 개인 그래프. 굵은 테두리가 뿌리이고, 색이 갈림이다 — 더해진 것은 녹, 수치가 흔들린 기댐은 노랑, 끊긴 것은 적(파선). 나머지는 종이 물려준 그대로다.',
        ]),
        ...reports.flatMap((report) => {
          const view = diffView(report);
          return [
            h('h3', {}, [`${report.name} — ${personalVerdict(report).split('—')[1] ?? ''}`]),
            graphView(view.nodes, view.edges, report.graph.rootIds, {
              kinds: [...DEPENDENCY_KINDS],
              kindLabels: KIND_LABELS,
              caption: `${report.applied.map((entry) => entry.name).join(' · ') || '변형 없음'} — 기본 대비 +노드 ${String(report.diff.addedNodes.length)} · 흔들린 간선 ${String(report.diff.changedEdges.length)}`,
            }),
          ];
        }),
      ],

      selection: [
        h('p', {}, [
          '같은 종·같은 자리의 넷이 같은 허기를 다르게 진다. 급함을 흔든 것은 성격이고(S3), 갈래를 더한 것은 이력·자리·문화·능력이다.',
        ]),
        h('table', { class: 'kv-table' }, [
          h('thead', {}, [
            h('tr', {}, [
              h('th', {}, ['개체']),
              h('th', {}, ['주린 몸의 급함']),
              h('th', {}, ['시한']),
              h('th', {}, ['식량 기댐의 강도']),
              h('th', {}, ['걸린 변형']),
              h('th', {}, ['노드']),
            ]),
          ]),
          h(
            'tbody',
            {},
            urgencyRows.map((row) =>
              h('tr', { class: 'ok' }, [
                h('td', {}, [row.name]),
                h('td', {}, [String(row.urgency)]),
                h('td', {}, [`${String(row.delay)}틱`]),
                h('td', {}, [String(row.strength)]),
                h('td', {}, [row.applied]),
                h('td', {}, [String(row.nodes)]),
              ]),
            ),
          ),
        ]),
        h('h3', {}, ['전환 장부 — 덜어 낸 것과 세운 것']),
        ledgerTable(reports),
      ],

      beforeAfter: [
        h('p', {}, [
          '사제의 갈림 하나만 따로 본다. 붉은 장막은 의념을 태워 허기를 대신한다 — 그러나 허기 자체는 그대로 남는다.',
        ]),
        keyValueView([
          ['전 — 종이 물려준 것', `노드 ${String(priest.base.nodes.length)} · 식량 기댐 0.95 · 의념에 기대는 것 없음`],
          [
            '후 — 사제의 것',
            `노드 ${String(priest.graph.nodes.length)} · 식량 기댐 0.45 · 의념의 샘 0.6 (붉은 장막이 치르는 psychic.energy 에 걸린다)`,
          ],
          ['더해진 노드', priest.diff.addedNodes.length === 0 ? '없음' : priest.graph.nodes.filter((node) => priest.diff.addedNodes.includes(node.id)).map((node) => node.label).join(' · ')],
          [
            '흔들린 간선',
            priest.diff.changedEdges
              .map((entry) => {
                const edge = priest.graph.edges.find((item) => item.id === entry.id);
                const to = priest.graph.nodes.find((node) => node.id === edge?.to)?.label ?? '';
                return `${to} 강도 ${String(entry.strength?.[0] ?? '')} → ${String(entry.strength?.[1] ?? '')}`;
              })
              .join(' · '),
          ],
          ['끊긴 것', priest.diff.removedEdges.length === 0 ? '없음 — 전환이지 제거가 아니다' : String(priest.diff.removedEdges.length)],
          [
            '여전히 굶는가',
            priest.graph.rootIds.some(
              (id) => priest.graph.nodes.find((node) => node.id === id)?.label === '주린 몸',
            )
              ? '그렇다 — 뿌리는 종의 것이고 개체가 지우지 못한다. 의념이 마르면 허기가 그대로 돌아온다'
              : '뿌리가 사라졌다 (그러면 안 된다)',
          ],
          ['기본 그래프', graphHash(priest.base)],
          ['사제의 그래프', graphHash(priest.graph)],
        ]),
      ],

      failure: [
        h('p', {}, [
          `설 수 없는 변형 ${String(BROKEN_VARIATIONS.length)}종. 대부분 하나를 가리킨다 — 공짜로 벗어났다.`,
        ]),
        h('table', { class: 'kv-table' }, [
          h('thead', {}, [
            h('tr', {}, [
              h('th', {}, ['어긴 것']),
              h('th', {}, ['누구']),
              h('th', {}, ['걸려야 할 사유']),
              h('th', {}, ['실제']),
              h('th', {}, ['자리']),
              h('th', {}, ['왜']),
            ]),
          ]),
          h(
            'tbody',
            {},
            brokenRows.map((row) =>
              h('tr', { class: row.expected === row.actual ? 'ok' : 'bad' }, [
                h('td', {}, [row.broke]),
                h('td', {}, [row.who]),
                h('td', {}, [h('code', {}, [row.expected])]),
                h('td', {}, [h('code', {}, [row.actual])]),
                h('td', { class: 'path' }, [row.path]),
                h('td', {}, [row.message]),
              ]),
            ),
          ),
        ]),
        h('h3', {}, ['공짜로 벗어나려는 그래프']),
        ...(() => {
          const free = BROKEN_VARIATIONS.find((entry) => entry.expected === 'free-conversion');
          if (free === undefined) return [];
          const report = personalizeGraph(
            baseOf(free.instance),
            free.instance,
            free.variations,
            options,
          );
          const view = diffView(report);
          return [
            graphView(view.nodes, view.edges, report.graph.rootIds, {
              kinds: [...DEPENDENCY_KINDS],
              kindLabels: KIND_LABELS,
              caption: `${free.broke} — 노랑만 있고 녹이 없다`,
            }),
          ];
        })(),
        h('h3', {}, ['시나리오 3종']),
        suiteView(suite),
      ],

      causality: lines(
        '성격이 흔든 값은 개체의 Need 에 이미 실려 있다 — D3 는 그것을 뿌리 간선으로 옮길 뿐이고, 변형 문법으로 다시 흔들지 않는다',
        '개체가 바꾸는 것은 무엇이 채우는가뿐이다 — 무엇으로 무너지는가는 종의 것이므로 노드를 지우는 편집을 문법에 두지 않았다',
        '모든 변형은 유래를 댄다 — 능력·문화·자리·이력·성격 중 하나이고, 그것을 이 개체가 실제로 가져야 한다 (S3 Provenance 의 태도)',
        '능력이 의존을 덜어 내면 그만큼 다른 의존이 서야 하고, 그 새 의존은 그 능력이 치르는 대가의 자리에 걸려야 한다 (O0 verifiable-cost 와 같은 결의 그래프 층위 관문)',
        '전환을 허용하는 것이 굶어 죽는 개체를 허용하는 뜻은 아니다 — 변형 뒤에도 뿌리마다 채움이 하나는 남아야 한다 (D2 의 무단절 조항이 여기서도 산다)',
        '그래서 사제는 굶기를 그만두지 못했다. 그는 허기를 의념으로 갈아탔고, 이제 의념이 마르면 허기가 그대로 돌아온다',
        '다음은 D4 — 지금 세계에서 이 뿌리들이 얼마나 급한가(압력)를 잰다. 갈라진 그래프가 갈라진 압력을 낳고, 그 압력이 P 계층의 목적이 된다',
      ),
    },
  };

  return pageView(spec);
}
