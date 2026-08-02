// D4 검증 시나리오 3종 — 세계가 값을 가지면 의존이 압력이 된다.

import { stateHash } from '@hkt/core/v1';
import {
  atTick,
  evaluatePressure,
  LEVEL_LABELS,
  levelOf,
  pressureVerdict,
  snapshotOf,
  trendOf,
} from '@hkt/core/d4';

import {
  defineScenario,
  expectDeterministic,
  expectState,
  expectTrue,
  type Assertion,
} from '../src/index.ts';

import {
  BROKEN_READINGS,
  bareGraph,
  greedyGraph,
  HUNGER_SINCE,
  NOW,
  priestGraph,
  sinceFor,
  STOCK_TREND,
  trackerGraph,
  TREND_SNAPSHOTS,
  worldAt,
} from './d4-veil-world.ts';

/** 정상 — 창고가 비어 가고 압력이 오른다. 같은 세계에서도 넷의 급함은 갈린다. */
export const d4HungerRises = defineScenario({
  id: 'd4-hunger-rises',
  module: 'D4',
  kind: 'normal',
  purpose:
    '재고가 조건 위에 있는 동안 압력은 0 이고(목적이 생기지 않는다), 재고가 줄고 결핍이 이어질수록 압력이 단조 증가해 충족→불안정→결핍→위기→붕괴로 오른다. 같은 세계에서도 개체마다 압력이 다르다.',
  arrange: () => ({ graph: trackerGraph, line: TREND_SNAPSHOTS }),
  act: ({ graph, line }) => {
    const since = sinceFor(graph);
    const trend = trendOf(graph, line, '주린 몸', { since });
    const scarce = worldAt(NOW + 21, 0);

    // 같은 세계·같은 시각에 넷의 굶주림 압력을 나란히 잰다.
    const hungerOf = (target: typeof graph): number => {
      const report = evaluatePressure(target, scarce, { since: sinceFor(target) });
      return Number(
        (report.roots.find((node) => node.label === '주린 몸')?.pressure ?? 0).toFixed(3),
      );
    };

    const full = evaluatePressure(graph, line[0] as (typeof line)[number], { since });
    const starving = evaluatePressure(graph, line[line.length - 1] as (typeof line)[number], {
      since,
    });
    const worstEdge = starving.edges.reduce((best, entry) =>
      entry.pressure > best.pressure ? entry : best,
    );

    return {
      // ① 채워져 있으면 압력이 없다
      fullHunger: full.roots.find((node) => node.label === '주린 몸')?.pressure ?? -1,
      fullLevel: full.roots.find((node) => node.label === '주린 몸')?.level ?? '',
      fullVerdict: pressureVerdict(full),

      // ② 재고가 줄고 결핍이 이어지면 압력이 오른다
      stocks: STOCK_TREND.map((entry) => entry.stock),
      levels: trend.map((point) => point.level),
      pressures: trend.map((point) => Number(point.pressure.toFixed(3))),
      monotone: trend.every(
        (point, index) => index === 0 || point.pressure >= (trend[index - 1]?.pressure ?? 0),
      ),
      driver: [...new Set(trend.filter((point) => point.pressure > 0).map((point) => point.driver))],
      unmetTicks: trend.map((point) => point.unmetTicks),

      // ③ 곱의 네 자리가 그대로 남는다
      formula: [
        worstEdge.strength,
        worstEdge.deficit,
        worstEdge.urgency,
        Number(worstEdge.failureRisk.toFixed(3)),
      ],
      formulaHolds:
        Number(worstEdge.pressure.toFixed(6)) ===
        Number(
          (
            worstEdge.strength *
            worstEdge.deficit *
            worstEdge.urgency *
            worstEdge.failureRisk
          ).toFixed(6),
        ),

      // ④ 같은 세계, 다른 압력 — D3 의 갈림이 여기서 값으로 드러난다
      hungerByInstance: [
        hungerOf(trackerGraph),
        hungerOf(greedyGraph),
        hungerOf(bareGraph),
        hungerOf(priestGraph),
      ],
      // 사제는 굶어도 덜 급하다 — 의념이 절반을 대신하고, 그 의념은 아직 차 있다
      priestSpring:
        evaluatePressure(priestGraph, scarce, { since: sinceFor(priestGraph) }).readings.find(
          (reading) => reading.label === '의념의 샘',
        )?.met ?? false,

      // ⑤ 한 몸이 두 곳에 있을 수 없다 — 협곡에 있으면 움막은 비어 있다 (D5 가 볼 다툼)
      hutDeficit:
        full.readings.find((reading) => reading.label === '겨울 움막')?.deficit ?? -1,
      groundMet: full.readings.find((reading) => reading.label === '사냥터')?.met ?? false,
    };
  },
  assert: (result): readonly Assertion[] => [
    expectState('재고가 충분하면 압력이 0 이다', 0, result.fullHunger),
    expectState('그때 굶주림은 충족이다', 'met', result.fullLevel),
    expectTrue(
      '그래도 판정 한 줄은 지금 가장 급한 것을 가리킨다 — 창고는 넉넉해도 들 곳이 없다',
      result.fullVerdict.includes('성한 몸'),
      result.fullVerdict,
    ),
    expectState(
      '창고는 사흘마다 둘씩 줄고 바닥난 뒤로는 시간만 흐른다',
      [10, 8, 6, 4, 2, 0, 0, 0, 0, 0],
      result.stocks,
    ),
    expectState(
      '압력은 충족에서 시작해 붕괴까지 오른다',
      [
        'met',
        'met',
        'met',
        'met',
        'unstable',
        'deficient',
        'critical',
        'critical',
        'collapsing',
        'collapsing',
      ],
      result.levels,
    ),
    expectTrue('한 번도 내려가지 않는다', result.monotone, result.pressures),
    expectState('압력을 끌어올린 것은 겨울 식량이다', ['겨울 식량'], result.driver),
    expectState(
      '결핍이 이어진 틱이 함께 자란다',
      [0, 0, 0, 0, 0, 3, 9, 15, 21, 30],
      result.unmetTicks,
    ),
    expectState('곱의 네 자리가 그대로 남는다', [0.95, 1, 1, 1], result.formula),
    expectState('그리고 곱이 실제로 압력이다', true, result.formulaHolds),
    expectState(
      '같은 세계·같은 시각인데 넷의 굶주림이 다르다',
      [0.306, 0.172, 0.245, 0.116],
      result.hungerByInstance,
    ),
    expectState('사제가 덜 급한 까닭 — 의념이 아직 차 있다', true, result.priestSpring),
    expectState('협곡에 있으므로 겨울 움막은 완전히 비어 있다', 1, result.hutDeficit),
    expectState('그리고 사냥터는 채워져 있다 — 한 몸은 한 곳에만 있다', true, result.groundMet),
    expectDeterministic('같은 세계를 100번 재도 같은 압력이다', () =>
      stateHash(
        TREND_SNAPSHOTS.map(
          (snapshot) =>
            evaluatePressure(trackerGraph, snapshot, { since: sinceFor(trackerGraph) }).hash,
        ),
      ),
    ),
  ],
});

/** 실패 — 일곱이 각자의 사유로 거부된다. */
export const d4BrokenReadingsRejected = defineScenario({
  id: 'd4-broken-readings-rejected',
  module: 'D4',
  kind: 'failure',
  purpose:
    '스키마를 어긴 값·같은 자리의 두 값·틱이 아닌 지금·아직 오지 않은 결핍·없는 노드·세계에 없는 조건이 각자의 사유·경로로 거부된다.',
  arrange: () => ({ entries: BROKEN_READINGS }),
  act: ({ entries }) =>
    entries.map((entry) => {
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
        where: first?.label ?? '',
      };
    }),
  assert: (result): readonly Assertion[] => [
    expectState(
      '무너진 읽기 일곱이 전부 예상한 사유로 걸린다',
      result.map((entry) => entry.expected),
      result.map((entry) => entry.actual),
    ),
    expectTrue(
      '어디를 고쳐야 하는지가 경로로 실린다',
      result.every((entry) => entry.path.startsWith('$')),
      result.map((entry) => entry.path),
    ),
    expectDeterministic('거부 사유는 반복해도 같다', () =>
      stateHash(
        BROKEN_READINGS.map((entry) => {
          const built = snapshotOf(entry.slots, entry.tick);
          return [
            built.violations,
            evaluatePressure(
              entry.graph,
              built.snapshot,
              entry.since === undefined ? {} : { since: entry.since },
            ).violations,
          ];
        }),
      ),
    ),
  ],
});

/** 경계 — 결핍의 양끝, 시한 1틱, 빈 세계, 5단계의 문턱. */
export const d4Boundary = defineScenario({
  id: 'd4-boundary',
  module: 'D4',
  kind: 'boundary',
  purpose:
    '결핍은 0 과 1 사이에서만 움직이고, 압력 0 은 채워졌을 때뿐이며, 시한이 1틱인 무너짐은 첫 틱부터 절반의 위험을 지고, 아무것도 적히지 않은 세계에서는 모든 의존이 완전히 비어 있다.',
  arrange: () => ({ graph: trackerGraph }),
  act: ({ graph }) => {
    const empty = snapshotOf([], NOW).snapshot;
    const emptyReport = evaluatePressure(graph, empty);
    const full = evaluatePressure(graph, worldAt(NOW, 10));
    const scarce = evaluatePressure(graph, worldAt(NOW + 15, 0), { since: sinceFor(graph) });

    // 시한이 1틱인 무너짐(체력)은 첫 틱부터 절반이다.
    const vitalityEdge = full.edges.find((entry) => entry.from === '성한 몸');

    return {
      // 빈 세계 — 자리를 읽는 노드는 전부 완전히 비어 있고, 시계만은 세계 없이도 읽힌다
      emptyDeficits: [
        ...new Set(
          emptyReport.readings
            .filter((reading) => reading.reason !== 'waiting')
            .map((reading) => reading.deficit),
        ),
      ],
      emptyReasons: [...new Set(emptyReport.readings.map((reading) => reading.reason))].sort(),
      emptyClock: Number(
        (emptyReport.readings.find((reading) => reading.reason === 'waiting')?.deficit ?? -1).toFixed(
          2,
        ),
      ),
      emptyPeakLevel: emptyReport.peakLevel,

      // 결핍의 양끝
      deficitRange: [
        Math.min(...scarce.readings.map((reading) => reading.deficit)),
        Math.max(...scarce.readings.map((reading) => reading.deficit)),
      ],
      // 압력 0 은 채워졌을 때뿐이다 — 아주 작은 결핍도 불안정이다
      zeroOnlyWhenMet: full.edges.every(
        (entry) => (entry.pressure === 0) === (entry.deficit === 0),
      ),
      thresholds: [levelOf(0), levelOf(0.000001), levelOf(1)],

      // 시한이 짧을수록 처음부터 위험하다
      vitalityDelay: vitalityEdge?.failureDelayTicks ?? 0,
      vitalityRisk: Number((vitalityEdge?.failureRisk ?? 0).toFixed(3)),
      hungerRisk: Number(
        (full.edges.find((entry) => entry.to === '겨울 식량')?.failureRisk ?? 0).toFixed(3),
      ),

      // 시간만 흘러도 압력은 오른다 — 값이 그대로여도 결핍은 늙는다
      sameWorldLater: [
        Number(
          (scarce.roots.find((node) => node.label === '주린 몸')?.pressure ?? 0).toFixed(3),
        ),
        Number(
          (
            evaluatePressure(graph, atTick(worldAt(NOW + 15, 0), NOW + 42), {
              since: sinceFor(graph),
            }).roots.find((node) => node.label === '주린 몸')?.pressure ?? 0
          ).toFixed(3),
        ),
      ],
      levelNames: [LEVEL_LABELS.met, LEVEL_LABELS.collapsing],
    };
  },
  assert: (result): readonly Assertion[] => [
    expectState('빈 세계에서는 자리를 읽는 의존이 전부 완전히 비어 있다', [1], result.emptyDeficits),
    expectState(
      '까닭은 둘 — 아무도 적지 않았거나, 시계의 창을 기다리거나',
      ['unwritten', 'waiting'],
      result.emptyReasons,
    ),
    expectState('시간만은 세계가 비어도 읽힌다', 0.89, result.emptyClock),
    expectState(
      '그런데도 가장 급한 것은 붕괴가 아니다 — 비어 있음과 무너짐 사이에는 시간이 있다',
      'deficient',
      result.emptyPeakLevel,
    ),
    expectState('결핍은 0 과 1 사이에서만 움직인다', [0, 1], result.deficitRange),
    expectState('압력 0 은 결핍 0 일 때뿐이다', true, result.zeroOnlyWhenMet),
    expectState('아주 작은 압력도 충족이 아니다', ['met', 'unstable', 'collapsing'], result.thresholds),
    expectState('체력은 한 틱 만에 무너진다', 1, result.vitalityDelay),
    expectState('그래서 첫 틱부터 절반의 위험이다', 0.5, result.vitalityRisk),
    expectState('서른 틱을 버티는 허기는 0.032 에서 시작한다', 0.032, result.hungerRisk),
    expectTrue(
      '값이 그대로여도 시간이 흐르면 압력은 오른다',
      (result.sameWorldLater[1] ?? 0) > (result.sameWorldLater[0] ?? 0),
      result.sameWorldLater,
    ),
    expectState('단계의 이름은 한국어로 읽힌다', ['충족', '붕괴'], result.levelNames),
  ],
});

export const d4Scenarios = [d4HungerRises, d4BrokenReadingsRejected, d4Boundary];
