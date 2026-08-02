// /lab/d2 — D2 종 기본 의존 그래프 생성.
//
// D1 의 화면은 손으로 적은 그래프 하나였다. 이 화면이 보이는 것은 **종에서 나온 그래프**다.
//
//   ① 종 다섯이 각자의 기본 의존을 물려준다 — 사냥꾼은 셋으로 갈리고, 장막벌레는 하나로 합쳐진다.
//   ② 같은 종의 두 개체가 같은 모양을 받는다 — 이름은 같고 ID 만 다르다.
//   ③ 같은 설계도가 단계마다 다른 시한을 받는다 — 유체 20 · 성체 30 · 노체 40틱.
//   ④ 뿌리마다 채움이 있는지가 표로 판정된다 — 원문 D2 의 검증 조항.
//
// 아래로는 설 수 없는 설계도 열다섯이 왜 막히는지를 편다.

import { deterministicId } from '@hkt/core/v1';
import { conditionSummary, graphHash } from '@hkt/core/d1';
import { DEPENDENCY_KINDS, kindLabel } from '@hkt/core/d0';
import {
  blueprintVerdict,
  buildSpeciesGraph,
  checkBlueprint,
  checkBlueprints,
  graphShapeHash,
  specimenOf,
  supplySummary,
  type BlueprintReport,
  type SpeciesBlueprint,
} from '@hkt/core/d2';
import {
  BROKEN_BLUEPRINTS,
  hunterArchetype,
  hunterBlueprint,
  VEIL_BLUEPRINTS,
} from '@hkt/scenarios/suites/d2-veil-blueprints';
import { d2Scenarios } from '@hkt/scenarios/suites/d2';
import { runScenarios } from '@hkt/scenarios';

import { pageView, lines, type PageSpec } from '../page.ts';
import { keyValueView } from '../renderers/diff.ts';
import { graphView, type GraphViewEdge, type GraphViewNode } from '../renderers/graph.ts';
import { suiteView } from '../renderers/scenario.ts';
import { h, type VElement, type VNode } from '../vnode.ts';

/** D0 11종의 한국어 이름 — 범례가 읽히도록. */
const KIND_LABELS: Readonly<Record<string, string>> = Object.fromEntries(
  DEPENDENCY_KINDS.map((kind) => [kind, kindLabel(kind)]),
);

/** core 그래프를 렌더러가 받는 모양으로 옮긴다. */
function toView(report: BlueprintReport): {
  readonly nodes: readonly GraphViewNode[];
  readonly edges: readonly GraphViewEdge[];
} {
  const graph = report.graph;
  return {
    nodes: graph.nodes.map((node) => ({
      id: node.id,
      label: node.label,
      kind: node.kind,
      hint: `${kindLabel(node.kind)} · ${conditionSummary(node.condition)}`,
      root: graph.rootIds.includes(node.id),
      bad: report.paths.some((path) => path.rootId === node.id && !path.unbroken),
    })),
    edges: graph.edges.map((edge) => ({
      from: edge.from,
      to: edge.to,
      relation: `${edge.relation} ${String(edge.failureDelayTicks)}틱`,
      strength: edge.strength,
    })),
  };
}

/** 종 하나의 그래프 그림 한 덩이. */
function speciesGraph(report: BlueprintReport): VNode {
  const view = toView(report);
  return graphView(view.nodes, view.edges, report.graph.rootIds, {
    kinds: [...DEPENDENCY_KINDS],
    kindLabels: KIND_LABELS,
    caption: blueprintVerdict(report),
  });
}

/** 무단절 판정표 한 줄 — 게이지 최소판 (D4 에서 제대로 세운다). */
function pathRows(reports: readonly BlueprintReport[]): VNode {
  return h('table', { class: 'kv-table' }, [
    h('thead', {}, [
      h('tr', {}, [
        h('th', {}, ['종']),
        h('th', {}, ['뿌리']),
        h('th', {}, ['무너지는 자리']),
        h('th', {}, ['떠받치는 것']),
        h('th', {}, ['채움']),
        h('th', {}, ['사슬 깊이']),
        h('th', {}, ['시한']),
        h('th', {}, ['판정']),
      ]),
    ]),
    h(
      'tbody',
      {},
      reports.flatMap((report) =>
        report.paths.map((path) =>
          h('tr', { class: path.unbroken ? 'ok' : 'bad' }, [
            h('td', {}, [report.speciesName]),
            h('td', {}, [path.label]),
            h('td', { class: 'path' }, [path.slot]),
            h('td', {}, [
              path.serves === 'both' ? '생존·대' : path.serves === 'lineage' ? '대' : '생존',
            ]),
            h('td', {}, [`${String(path.supplied)}갈래`]),
            h('td', {}, [String(path.depth)]),
            h('td', {}, [`${String(path.collapseAfterTicks)}틱`]),
            h('td', {}, [path.unbroken ? '끊기지 않는다' : '끊겼다']),
          ]),
        ),
      ),
    ),
  ]);
}

export function d2Page(): VElement {
  const batch = checkBlueprints(VEIL_BLUEPRINTS);
  const suite = runScenarios(d2Scenarios);
  const hunter = batch.reports[0] as BlueprintReport;

  // 같은 종의 두 개체 — 이름은 같고 자리의 주인만 다르다.
  const beater04 = {
    subjectId: deterministicId('subject', 'person', '몰이꾼 04'),
    bodyId: deterministicId('entity', 'body', '몰이꾼 04 의 몸'),
  };
  const beater07 = {
    subjectId: deterministicId('subject', 'person', '몰이꾼 07'),
    bodyId: deterministicId('entity', 'body', '몰이꾼 07 의 몸'),
  };
  const graph04 = buildSpeciesGraph(hunterArchetype, hunterBlueprint, beater04);
  const graph07 = buildSpeciesGraph(hunterArchetype, hunterBlueprint, beater07);

  // 같은 설계도, 다른 단계 — 대사가 시한을 나눈다.
  const stageRows = ['유체', '성체', '노체'].map((stage) => {
    const graph = buildSpeciesGraph(hunterArchetype, hunterBlueprint, {
      ...specimenOf(hunterArchetype),
      stage,
    });
    const delayOf = (label: string): number =>
      graph.edges.find(
        (edge) => graph.nodes.find((node) => node.id === edge.from)?.label === label,
      )?.failureDelayTicks ?? 0;
    const chainDelay =
      graph.edges.find(
        (edge) => graph.nodes.find((node) => node.id === edge.to)?.label === '사냥터',
      )?.failureDelayTicks ?? 0;
    const stageSpec = hunterArchetype.lifecycle.stages.find((entry) => entry.stage === stage);
    return {
      stage,
      metabolism: stageSpec?.metabolism ?? 1,
      hunger: delayOf('주린 몸'),
      vitality: delayOf('성한 몸'),
      lineage: delayOf('대 이을 몸'),
      ground: chainDelay,
    };
  });

  const brokenRows = BROKEN_BLUEPRINTS.map((entry) => {
    const report = checkBlueprint(entry.archetype, entry.blueprint as SpeciesBlueprint);
    const first = report.violations[0];
    return {
      broke: entry.broke,
      expected: entry.expected,
      actual: first?.rule ?? '(통과해 버렸다)',
      path: first?.path ?? '',
      where: first?.at ?? '',
      message: first?.message ?? '',
    };
  });
  const allRejected = brokenRows.every((row) => row.expected === row.actual);

  const spec: PageSpec = {
    id: 'D2',
    title: '종 기본 의존 그래프 생성',
    purpose:
      '종 원형에서 그 종의 모든 개체가 물려받는 기본 의존 그래프를 찍어 내고, 생존·번식 경로가 끊기지 않게 한다.',
    verdict: {
      passed: batch.complete && allRejected && suite.failed === 0,
      label: batch.complete
        ? `종 ${String(batch.reports.length)}개가 각자의 그래프를 물려준다 (뿌리 ${String(
            batch.reports.reduce((sum, report) => sum + report.paths.length, 0),
          )}개 전부 채워짐) · 결함 설계도 ${String(BROKEN_BLUEPRINTS.length)}종 전부 거부 · 시나리오 ${String(suite.passed)}/${String(suite.total)}`
        : `막힌 종 ${String(batch.broken.length)}개 — ${batch.broken.map((report) => blueprintVerdict(report)).join(' / ')}`,
    },
    sections: {
      input: keyValueView([
        ['원문 조건', 'ModulePlan D2 — "종 하나를 생성하면 생존과 번식에 필요한 의존 경로가 끊기지 않아야 한다"'],
        [
          'S1 이 준 것',
          '종의 무너짐(NeedTemplate) — 자리·범위·급함·기준 시한. 그리고 생애: 대사가 시한을 나눈다',
        ],
        ['D0 가 준 것', `기댈 수 있는 대상 ${String(DEPENDENCY_KINDS.length)}종과 그 성격`],
        ['D1 이 준 것', '노드·간선·그래프의 모양과 유일한 판정자 checkGraph'],
        ['D2 가 새로 받는 것', '설계도(SpeciesBlueprint) — 뿌리의 종 · 대를 잇는 자리 · 채움 갈래'],
        ['검증 장면', `붉은 장막 세계의 종 ${String(VEIL_BLUEPRINTS.length)}개 (사람·생물·조직·국가·신)`],
        ['결함 설계도', `${String(BROKEN_BLUEPRINTS.length)}종`],
      ]),

      process: [
        h('p', {}, [
          'D1 까지의 그래프는 전부 손으로 적힌 것이었다. 손으로 적으면 같은 종에서 태어난 둘이 서로 다른 것에 기대도 막을 수 없고, 무너진다고 말해 놓고 채울 길이 없는 종도 설 수 있다. D2 가 못박는 것은 하나다 — 무엇에 기대는지는 종이 정한다.',
        ]),
        h('table', { class: 'kv-table' }, [
          h('thead', {}, [
            h('tr', {}, [
              h('th', {}, ['그래프의 자리']),
              h('th', {}, ['누가 정하는가']),
              h('th', {}, ['왜']),
            ]),
          ]),
          h('tbody', {}, [
            h('tr', { class: 'ok' }, [
              h('td', {}, ['뿌리의 자리·범위']),
              h('td', {}, ['종 (S1 NeedTemplate)']),
              h('td', {}, ['설계도에 고쳐 적을 자리를 두지 않았다 — 막는 것이 아니라 적을 수 없게 한 것이다']),
            ]),
            h('tr', { class: 'ok' }, [
              h('td', {}, ['뿌리의 종(11종)·대상']),
              h('td', {}, ['설계도']),
              h('td', {}, ['같은 자리라도 기대는 방식이 종을 가른다 (D0) — 다만 거짓이면 D1 이 막는다']),
            ]),
            h('tr', { class: 'ok' }, [
              h('td', {}, ['채움의 자리 주인']),
              h('td', {}, ['개체 (self · body · named)']),
              h('td', {}, ['종은 "누구의" 를 모른다 — 태어날 때 채워진다 (S1-d 와 같은 태도)']),
            ]),
            h('tr', { class: 'ok' }, [
              h('td', {}, ['뿌리에 걸린 시한·급함']),
              h('td', {}, ['종 ÷ 단계의 대사']),
              h('td', {}, ['두 번 적을 수 있게 두면 두 답이 갈린다 — 채움이 적으면 거부된다']),
            ]),
            h('tr', { class: 'ok' }, [
              h('td', {}, ['그래프가 온전한가']),
              h('td', {}, ['D1 checkGraph']),
              h('td', {}, ['판정자는 하나여야 한다 — D2 는 그 사유를 broken-graph 로 안고 옮긴다']),
            ]),
          ]),
        ]),
        h('h3', {}, ['사냥꾼의 설계도 — 채움 갈래']),
        h('table', { class: 'kv-table' }, [
          h('thead', {}, [
            h('tr', {}, [
              h('th', {}, ['채움']),
              h('th', {}, ['무엇을 채우는가']),
              h('th', {}, ['강도']),
              h('th', {}, ['대체']),
              h('th', {}, ['시한']),
              h('th', {}, ['왜']),
            ]),
          ]),
          h(
            'tbody',
            {},
            hunterBlueprint.supplies.map((supply) =>
              h('tr', { class: 'ok' }, [
                h('td', {}, [supply.label]),
                h('td', { class: 'path' }, [supplySummary(supply)]),
                h('td', {}, [String(supply.strength)]),
                h('td', {}, [String(supply.substitutability)]),
                h('td', {}, [
                  supply.baseDelayTicks === null
                    ? '종이 말한 것 (뿌리)'
                    : `${String(supply.baseDelayTicks)}틱 ÷ 대사`,
                ]),
                h('td', {}, [supply.note]),
              ]),
            ),
          ),
        ]),
      ],

      candidates: [
        h('p', {}, [
          '종 다섯이 각자 물려주는 기본 의존. 굵은 테두리가 뿌리(종이 말한 무너짐)이고, 선 위의 숫자는 이 단계의 몸으로 끊기기까지의 틱이다.',
        ]),
        ...batch.reports.flatMap((report) => [
          h('h3', {}, [`${report.speciesName} — ${blueprintVerdict(report).split('—')[1] ?? ''}`]),
          speciesGraph(report),
        ]),
      ],

      selection: [
        h('p', {}, [
          '같은 종에서 태어난 둘. 이름도 사슬도 수치도 똑같고, 다른 것은 자리의 주인뿐이다 — 종은 모양을 물려준다.',
        ]),
        keyValueView([
          ['몰이꾼 04 의 모양', graphShapeHash(graph04)],
          ['몰이꾼 07 의 모양', graphShapeHash(graph07)],
          [
            '같은 모양인가',
            graphShapeHash(graph04) === graphShapeHash(graph07)
              ? '같다 — 종이 물려준 것이기 때문이다'
              : '흔들렸다',
          ],
          ['몰이꾼 04 의 그래프', graphHash(graph04)],
          ['몰이꾼 07 의 그래프', graphHash(graph07)],
          [
            '같은 그래프인가',
            graphHash(graph04) === graphHash(graph07)
              ? '같다 (그러면 안 된다)'
              : '다르다 — 자리의 주인이 다르므로 노드 ID 가 갈린다',
          ],
          [
            '노드 이름',
            graph04.nodes.map((node) => node.label).join(' · '),
          ],
        ]),
        h('h3', {}, ['같은 설계도, 다른 단계 — 대사가 종 전체의 시간을 흔든다']),
        h('table', { class: 'kv-table' }, [
          h('thead', {}, [
            h('tr', {}, [
              h('th', {}, ['단계']),
              h('th', {}, ['대사']),
              h('th', {}, ['주린 몸 → 겨울 식량']),
              h('th', {}, ['성한 몸 → 겨울 움막']),
              h('th', {}, ['대 이을 몸 → 겨울 움막']),
              h('th', {}, ['겨울 식량 → 사냥터']),
            ]),
          ]),
          h(
            'tbody',
            {},
            stageRows.map((row) =>
              h('tr', { class: 'ok' }, [
                h('td', {}, [row.stage]),
                h('td', {}, [`×${String(row.metabolism)}`]),
                h('td', {}, [`${String(row.hunger)}틱`]),
                h('td', {}, [`${String(row.vitality)}틱`]),
                h('td', {}, [`${String(row.lineage)}틱`]),
                h('td', {}, [`${String(row.ground)}틱`]),
              ]),
            ),
          ),
        ]),
      ],

      beforeAfter: [
        h('p', {}, [
          '원문 D2 의 검증 조항이 이 표다 — 뿌리마다 채우는 것이 있는가, 그리고 늙는 종은 대를 잇는가.',
        ]),
        pathRows(batch.reports),
        keyValueView([
          ['전 — D1 이 남긴 것', '그래프의 모양. 뿌리가 실제 무너짐과 맞는지는 아무도 보지 않았다'],
          [
            '후 — D2 가 더한 것',
            '종에서 찍어 내는 생성기 · 뿌리↔무너짐 1:1 · 생존·번식 무단절 판정 · 모양 해시',
          ],
          [
            '갈리는 것',
            `사냥꾼은 굶는 것·다치는 것·대가 끊기는 것이 세 자리로 갈리고(뿌리 ${String(hunter.paths.length)}), 장막벌레는 군집 하나가 지금과 다음 세대를 함께 떠받친다`,
          ],
          ['아직 없는 것', 'D3 — 개인·문화·능력이 이 기본 그래프를 변형하는 일. D4 — 지금 세계에서 이 뿌리들이 얼마나 급한가'],
        ]),
      ],

      failure: [
        h('p', {}, [
          `설 수 없는 설계도 ${String(BROKEN_BLUEPRINTS.length)}종. 절반은 종이 말한 것과 어긋나서, 절반은 그 그래프로는 종이 살 수 없어서 막힌다.`,
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
        h('h3', {}, ['채울 것 없는 무너짐은 그림에서 붉게 선다']),
        ...(() => {
          const starved = BROKEN_BLUEPRINTS.find((entry) => entry.expected === 'unsupplied-need');
          if (starved === undefined) return [];
          const report = checkBlueprint(starved.archetype, starved.blueprint as SpeciesBlueprint);
          return [speciesGraph(report)];
        })(),
        h('h3', {}, ['시나리오 3종']),
        suiteView(suite),
      ],

      causality: lines(
        '뿌리는 종이 말한 무너짐을 옮겨 적을 뿐이다 — 설계도에 조건을 적을 자리를 두지 않았으므로, 종과 어긋난 뿌리는 만들어질 수 없다',
        '무엇에 기대는지는 종이 정하고, 누구의 자리인지는 개체가 채운다 — 그래서 같은 종의 둘은 언제나 같은 모양을 받는다',
        '시한은 종의 기준 시한 ÷ 단계의 대사다 (S1-c) — 하나의 수가 그래프 전체의 시간을 흔든다. 유체는 같은 그래프를 더 짧은 시한으로 받는다',
        '한 채움이 두 무너짐을 떠받치면 시한과 급함은 각각의 무너짐이 정한다 — 같은 움막이 몸에는 즉각이고 대에는 400틱이다',
        '늙는 종은 대를 이어야 한다 — 몸이 있으면 수명이 있고(S1-c), 수명이 있는데 대가 없으면 세계에서 사라진다. 늙지 않는 것들은 낳지 않고 세워지고 흩어진다',
        '찍어 낸 그래프의 판정은 D1 이 한다 — D2 는 사유를 broken-graph 로 안고 옮긴다. 판정자가 둘이면 두 답이 갈린다',
        '사냥터와 겨울 움막은 같은 자리(physical.region)를 서로 다른 값으로 요구한다 — 한 몸이 두 곳에 있을 수 없다는 것은 D5 가 볼 다툼이다',
        '다음은 D3 — 개인·문화·능력이 이 기본 그래프를 변형한다. 그때 기준이 되는 것이 여기서 찍어 낸 그래프다',
      ),
    },
  };

  return pageView(spec);
}
