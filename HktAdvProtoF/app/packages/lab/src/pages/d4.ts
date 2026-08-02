// /lab/d4 — D4 의존 충족도 평가.
//
// D0~D3 의 화면은 전부 **모양**이었다. 이 화면에서 세계가 처음으로 값을 갖는다.
//
//   ① 지금의 세계 — 창고에 열 개, 몰이꾼은 협곡에, 사제의 의념은 이백.
//   ② 압력 게이지 — 뿌리마다 지금 얼마나 급한가가 막대와 5단계 색으로 선다.
//   ③ 창고가 비어 가는 열 틱 — 압력이 충족에서 붕괴까지 한 번도 내려가지 않고 오른다.
//   ④ 같은 세계, 다른 압력 — D3 의 갈림이 여기서 값이 된다.

import { countSlots, worldSlots } from '@hkt/core/o2';
import { kindLabel } from '@hkt/core/d0';
import type { DependencyGraph } from '@hkt/core/d1';
import {
  evaluatePressure,
  FULFILLMENT_LEVELS,
  LEVEL_LABELS,
  LEVEL_THRESHOLDS,
  pressureVerdict,
  snapshotOf,
  snapshotSummary,
  trendOf,
  type PressureReport,
} from '@hkt/core/d4';
import {
  BROKEN_READINGS,
  bareGraph,
  greedyGraph,
  NOW,
  priestGraph,
  sinceFor,
  STOCK_TREND,
  trackerGraph,
  TREND_SNAPSHOTS,
  worldAt,
} from '@hkt/scenarios/suites/d4-veil-world';
import { d4Scenarios } from '@hkt/scenarios/suites/d4';
import { runScenarios } from '@hkt/scenarios';

import { pageView, lines, type PageSpec } from '../page.ts';
import { keyValueView } from '../renderers/diff.ts';
import { gaugeView, levelLegend, trendView } from '../renderers/gauge.ts';
import { graphView, type GraphViewNode } from '../renderers/graph.ts';
import { suiteView } from '../renderers/scenario.ts';
import { h, type VElement, type VNode } from '../vnode.ts';

/** 5단계의 한국어 이름 — 그래프 범례가 이 이름을 쓴다. */
const LEVEL_NAMES: Readonly<Record<string, string>> = Object.fromEntries(
  FULFILLMENT_LEVELS.map((level) => [level, LEVEL_LABELS[level]]),
);

const INSTANCES: readonly { readonly name: string; readonly graph: DependencyGraph }[] = [
  { name: '사냥꾼 04 (겁 많고 빚졌다)', graph: trackerGraph },
  { name: '사냥꾼 11 (욕심이 많다)', graph: greedyGraph },
  { name: '사냥꾼 23 (맨몸)', graph: bareGraph },
  { name: '사냥꾼 31 (사제)', graph: priestGraph },
];

/** 압력이 칠해진 그래프 — 색이 갈래가 아니라 5단계다. */
function pressureGraph(report: PressureReport, graph: DependencyGraph): VNode {
  const nodes: readonly GraphViewNode[] = graph.nodes.map((node) => {
    const measured = report.nodes.find((entry) => entry.nodeId === node.id);
    const reading = report.readings.find((entry) => entry.nodeId === node.id);
    return {
      id: node.id,
      label: node.label,
      kind: measured?.level ?? 'met',
      hint: `${kindLabel(node.kind)} · 결핍 ${(reading?.deficit ?? 0).toFixed(2)} · 압력 ${(measured?.pressure ?? 0).toFixed(2)}`,
      root: graph.rootIds.includes(node.id),
    };
  });
  const edges = report.edges.map((entry) => {
    const edge = graph.edges.find((item) => item.id === entry.edgeId);
    return {
      from: edge?.from ?? '',
      to: edge?.to ?? '',
      relation: `${entry.pressure.toFixed(2)}`,
      strength: entry.pressure,
      ...(entry.level === 'collapsing' ? { bad: true } : {}),
    };
  });
  return graphView(nodes, edges, graph.rootIds, {
    kinds: [...FULFILLMENT_LEVELS],
    kindLabels: LEVEL_NAMES,
    caption: pressureVerdict(report),
  });
}

export function d4Page(): VElement {
  const suite = runScenarios(d4Scenarios);
  const since = sinceFor(trackerGraph);

  const full = worldAt(NOW, 10); // 창고가 넉넉한 지금
  const scarce = worldAt(NOW + 21, 0); // 엿새째 바닥난 창고
  const fullReport = evaluatePressure(trackerGraph, full, { since });
  const scarceReport = evaluatePressure(trackerGraph, scarce, { since });

  const trend = trendOf(trackerGraph, TREND_SNAPSHOTS, '주린 몸', { since });
  const monotone = trend.every(
    (point, index) => index === 0 || point.pressure >= (trend[index - 1]?.pressure ?? 0),
  );

  const byInstance = INSTANCES.map((entry) => {
    const report = evaluatePressure(entry.graph, scarce, { since: sinceFor(entry.graph) });
    const hunger = report.roots.find((node) => node.label === '주린 몸');
    const foodEdge = report.edges.find((edge) => edge.to === '겨울 식량');
    return {
      name: entry.name,
      pressure: hunger?.pressure ?? 0,
      level: hunger?.level ?? 'met',
      strength: foodEdge?.strength ?? 0,
      urgency: foodEdge?.urgency ?? 0,
      risk: foodEdge?.failureRisk ?? 0,
    };
  });

  const brokenRows = BROKEN_READINGS.map((entry) => {
    const built = snapshotOf(entry.slots, entry.tick);
    const report = evaluatePressure(
      entry.graph,
      built.snapshot,
      entry.since === undefined ? {} : { since: entry.since },
    );
    const first = [...built.violations, ...report.violations][0];
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
    id: 'D4',
    title: '의존 충족도 평가',
    purpose:
      '지금 세계에서 각 의존이 얼마나 채워졌는지 재어 압력을 계산하고 충족 5단계를 판정한다.',
    verdict: {
      passed: monotone && allRejected && suite.failed === 0 && fullReport.violations.length === 0,
      label: `창고가 비어 가는 ${String(STOCK_TREND.length)}틱 동안 압력이 ${trend[0]?.pressure.toFixed(2) ?? ''} → ${trend[trend.length - 1]?.pressure.toFixed(2) ?? ''} 로 한 번도 내려가지 않고 오른다 · 결함 읽기 ${String(BROKEN_READINGS.length)}종 전부 거부 · 시나리오 ${String(suite.passed)}/${String(suite.total)}`,
    },
    sections: {
      input: [
        keyValueView([
          ['원문 식', 'Pressure = Strength × Deficit × Urgency × FailureRisk → 충족·불안정·결핍·위기·붕괴'],
          ['D1~D3 이 준 것', '강도·급함·시한 — 개체마다 갈라진 개인 의존 그래프'],
          ['O2 가 준 것', '9영역 자리와 값의 폭 — 결핍을 폭으로 나누어야 서로 견줄 수 있다'],
          ['S3 가 준 것', '개체가 지고 온 값(residue) — 세계의 첫 값이 된다'],
          ['D4 가 새로 받는 것', '지금의 세계(WorldSnapshot) + 결핍이 시작된 시각'],
          ['지금의 세계', snapshotSummary(full)],
          ['엿새 뒤', snapshotSummary(scarce)],
        ]),
        h('h3', {}, ['지금 세계에 적힌 값 — 사냥꾼 04 의 자리']),
        h('table', { class: 'kv-table' }, [
          h('thead', {}, [
            h('tr', {}, [h('th', {}, ['자리']), h('th', {}, ['지금 값']), h('th', {}, ['엿새 뒤'])]),
          ]),
          h(
            'tbody',
            {},
            worldSlots(full.world)
              .filter((slot) => slot.ofId === trackerGraph.subjectId)
              .map((slot) => {
                const later = worldSlots(scarce.world).find(
                  (entry) =>
                    entry.ofId === slot.ofId &&
                    entry.domain === slot.domain &&
                    entry.path === slot.path,
                );
                const changed = String(later?.value) !== String(slot.value);
                return h('tr', { class: changed ? '' : 'ok' }, [
                  h('td', { class: 'path' }, [`${slot.domain}.${slot.path.split('.')[0] ?? ''}`]),
                  h('td', {}, [String(slot.value)]),
                  h('td', {}, [
                    `${String(later?.value ?? '—')}${changed ? ' (줄었다)' : ''}`,
                  ]),
                ]);
              }),
          ),
        ]),
      ],

      process: [
        h('p', {}, [
          '조건은 지금까지 참·거짓으로만 읽혔다. 압력은 정도를 요구한다 — 재고가 하나 모자란 것과 창고가 텅 빈 것은 같은 결핍이 아니다. 그래서 결핍을 거리로 읽고, 자리마다 단위가 다르므로 그 자리가 가질 수 있는 값의 폭으로 나눈다.',
        ]),
        h('table', { class: 'kv-table' }, [
          h('thead', {}, [
            h('tr', {}, [
              h('th', {}, ['조건']),
              h('th', {}, ['결핍을 읽는 법']),
              h('th', {}, ['예']),
            ]),
          ]),
          h('tbody', {}, [
            h('tr', { class: 'ok' }, [
              h('td', {}, ['범위 (사흘치 이상)']),
              h('td', {}, ['벗어난 거리 ÷ 벗어날 수 있는 최대 거리']),
              h('td', {}, ['재고 2 → (3-2)/3 = 0.33 · 재고 0 → 1']),
            ]),
            h('tr', { class: 'ok' }, [
              h('td', {}, ['딱 그 값 (그 협곡)']),
              h('td', {}, ['같으면 0, 다르면 1']),
              h('td', {}, ['통행권은 절반만 있을 수 없다']),
            ]),
            h('tr', { class: 'ok' }, [
              h('td', {}, ['시계 (12틱마다 3틱)']),
              h('td', {}, ['창을 쓰고 있으면 0, 놓쳤으면 다음 창까지의 기다림']),
              h('td', {}, ['세계가 비어도 시간만은 읽힌다']),
            ]),
            h('tr', { class: 'ok' }, [
              h('td', {}, ['빈 자리']),
              h('td', {}, ['1 — 아무도 적지 않은 것은 채워지지 않은 것이다']),
              h('td', {}, ['아직 세계에 없는 것']),
            ]),
          ]),
        ]),
        h('h3', {}, ['그리고 시간이 위험이 된다']),
        lines(
          'FailureRisk = (1 + 결핍이 이어진 틱) ÷ (끊김까지의 시한 + 1)',
          '결핍이 시작된 순간에도 0 이 아니다 — 비어 있는 것은 언제나 조금은 위험하다',
          '같은 결핍이라도 시한이 짧을수록 처음부터 위험하다 — 체력(1틱)은 0.5 에서, 허기(30틱)는 0.032 에서 시작한다',
          `5단계의 문턱: 충족 0 · 불안정 ≤${String(LEVEL_THRESHOLDS.unstable)} · 결핍 ≤${String(LEVEL_THRESHOLDS.deficient)} · 위기 ≤${String(LEVEL_THRESHOLDS.critical)} · 그 위는 붕괴`,
        ),
        levelLegend(
          FULFILLMENT_LEVELS.map((level) => ({ level, label: LEVEL_LABELS[level] })),
        ),
      ],

      candidates: [
        h('p', {}, [
          '사냥꾼 04 의 지금. 창고는 넉넉하지만 그는 협곡에 있고, 겨울 움막(아랫마을)은 비어 있다 — 한 몸이 두 곳에 있을 수 없기 때문이다 (D5 가 볼 다툼).',
        ]),
        gaugeView(
          fullReport.roots.map((node) => ({
            label: node.label,
            value: node.pressure,
            level: node.level,
            levelLabel: LEVEL_LABELS[node.level],
            detail:
              fullReport.edges.find((edge) => edge.edgeId === node.worstEdgeId)?.to ?? '채워졌다',
            hint: `결핍 ${node.deficit.toFixed(2)}`,
          })),
          { caption: `${String(NOW)}틱 — 창고에 열 개가 있다` },
        ),
        h('h3', {}, ['엿새 뒤 — 창고가 바닥나고 결핍이 스물한 틱째 이어진다']),
        gaugeView(
          scarceReport.roots.map((node) => ({
            label: node.label,
            value: node.pressure,
            level: node.level,
            levelLabel: LEVEL_LABELS[node.level],
            detail:
              scarceReport.edges.find((edge) => edge.edgeId === node.worstEdgeId)?.to ?? '채워졌다',
            hint: `결핍 ${node.deficit.toFixed(2)}`,
          })),
          { caption: pressureVerdict(scarceReport) },
        ),
        h('h3', {}, ['그래프 전체가 5단계로 칠해진다']),
        pressureGraph(scarceReport, trackerGraph),
      ],

      selection: [
        h('p', {}, [
          '같은 세계·같은 시각인데 넷의 굶주림이 다르다. 곱의 네 자리 중 셋을 D3 이 이미 갈라 두었기 때문이다 — 겁 많은 04 는 급함 1, 욕심 많은 11 은 0.56, 사제는 식량 기댐 자체가 0.45 다.',
        ]),
        gaugeView(
          byInstance.map((entry) => ({
            label: entry.name,
            value: entry.pressure,
            level: entry.level,
            levelLabel: LEVEL_LABELS[entry.level],
            detail: `강도 ${entry.strength.toFixed(2)} × 결핍 1 × 급함 ${entry.urgency.toFixed(2)} × 위험 ${entry.risk.toFixed(2)}`,
          })),
          { caption: `${String(NOW + 21)}틱 — 창고는 넷 다 비었다` },
        ),
        keyValueView([
          [
            '사제가 덜 급한 까닭',
            `의념의 샘이 아직 차 있다 (${
              evaluatePressure(priestGraph, scarce, { since: sinceFor(priestGraph) }).readings.find(
                (reading) => reading.label === '의념의 샘',
              )?.met === true
                ? '충족'
                : '비었다'
            }) — 그는 굶기를 그만둔 것이 아니라 절반을 의념으로 갈아탔다 (D3)`,
          ],
          [
            '그러나 의념이 마르면',
            '식량 기댐 0.45 가 그대로 남고, 의념의 샘까지 비어 압력이 둘로 늘어난다 — 전환은 벗어남이 아니다',
          ],
        ]),
      ],

      beforeAfter: [
        h('p', {}, [
          '창고가 사흘마다 둘씩 줄고, 바닥난 뒤로는 시간만 흐른다. 원문 D4 의 두 조건이 이 줄에서 확인된다 — 충분하면 압력이 0 이고, 줄면 점진적으로 오른다.',
        ]),
        trendView(
          trend.map((point, index) => ({
            label: `${String(point.tick)}틱`,
            value: point.pressure,
            level: point.level,
            hint: `재고 ${String(STOCK_TREND[index]?.stock ?? 0)} · 결핍 ${point.deficit.toFixed(2)} · 이어진 틱 ${String(point.unmetTicks)}`,
          })),
          { caption: '주린 몸의 압력 — 왼쪽이 지금, 오른쪽이 마흔두 틱 뒤' },
        ),
        h('table', { class: 'kv-table' }, [
          h('thead', {}, [
            h('tr', {}, [
              h('th', {}, ['틱']),
              h('th', {}, ['재고']),
              h('th', {}, ['결핍']),
              h('th', {}, ['이어진 틱']),
              h('th', {}, ['위험']),
              h('th', {}, ['압력']),
              h('th', {}, ['단계']),
            ]),
          ]),
          h(
            'tbody',
            {},
            trend.map((point, index) => {
              const report = evaluatePressure(
                trackerGraph,
                TREND_SNAPSHOTS[index] as (typeof TREND_SNAPSHOTS)[number],
                { since },
              );
              const edge = report.edges.find((entry) => entry.to === '겨울 식량');
              return h('tr', { class: point.level === 'met' ? 'ok' : '' }, [
                h('td', {}, [String(point.tick)]),
                h('td', {}, [String(STOCK_TREND[index]?.stock ?? 0)]),
                h('td', {}, [point.deficit.toFixed(2)]),
                h('td', {}, [String(point.unmetTicks)]),
                h('td', {}, [(edge?.failureRisk ?? 0).toFixed(3)]),
                h('td', {}, [point.pressure.toFixed(3)]),
                h('td', {}, [LEVEL_LABELS[point.level]]),
              ]);
            }),
          ),
        ]),
        keyValueView([
          ['전 — D3 이 남긴 것', '개체마다 갈라진 그래프. 모양뿐이고 값은 없었다'],
          [
            '후 — D4 가 더한 것',
            `지금의 세계(자리 ${String(countSlots(full.world))}개) · 결핍 읽기 · 압력과 5단계 · 추이`,
          ],
          ['한 번도 내려가지 않는가', monotone ? '그렇다 — 단조 증가' : '내려간 지점이 있다'],
          ['다음', 'P 계층 — 압력이 목적이 된다. 채워진 의존은 아무 목적도 만들지 않는다'],
        ]),
      ],

      failure: [
        h('p', {}, [
          `잴 수 없는 읽기 ${String(BROKEN_READINGS.length)}종. 결핍은 어긋남이 아니지만(굶주림은 세계의 사실이다), 세계에 들어갈 수 없는 값과 앞뒤가 맞지 않는 시각은 막힌다.`,
        ]),
        h('table', { class: 'kv-table' }, [
          h('thead', {}, [
            h('tr', {}, [
              h('th', {}, ['어긴 것']),
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
                h('td', {}, [h('code', {}, [row.expected])]),
                h('td', {}, [h('code', {}, [row.actual])]),
                h('td', { class: 'path' }, [row.path]),
                h('td', {}, [row.message]),
              ]),
            ),
          ),
        ]),
        h('h3', {}, ['시나리오 3종']),
        suiteView(suite),
      ],

      causality: lines(
        '세계를 새로 짓지 않았다 — O2 의 조립 관문과 S3 의 residue 를 이어 붙였을 뿐이다. 개체는 빈손으로 서지 않는다: 지고 온 빚과 원한이 세계의 첫 값이 된다',
        '결핍은 거리이고, 거리는 그 자리의 폭으로 나뉜다 — 그래야 재고(개)와 허기(비율)를 같은 축에서 견줄 수 있다',
        '압력은 곱이다. 그래서 결핍이 0 이면 압력도 0 이고, 채워진 의존은 아무 목적도 만들지 않는다 (원문 D4 조건)',
        '시간이 곱의 넷째 자리다 — 같은 결핍이라도 오래 이어질수록, 시한이 짧을수록 급하다. 값이 그대로여도 압력은 오른다',
        '압력은 간선의 것이고 노드는 자기를 채우는 기댐 중 가장 급한 것으로 칠해진다 — 한 사람의 굶주림은 그를 채우는 것들 중 가장 빈 것이 정한다',
        '같은 세계에서도 개체마다 압력이 다르다 — D3 이 갈라 둔 급함과 강도가 여기서 값이 된다. 세계는 하나인데 급함은 저마다다',
        'D4 는 세계를 읽기만 한다 — 값을 바꾸는 것은 사건(R1)의 몫이다. 그래서 여기서 나온 압력은 아직 아무것도 움직이지 않는다',
        '다음은 P 계층 — 이 압력에서 가능성과 목적이 자란다. 목적은 지어내는 것이 아니라 비어 있는 자리에서 나온다',
      ),
    },
  };

  return pageView(spec);
}
