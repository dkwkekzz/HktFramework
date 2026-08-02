// D3 검증 시나리오 3종 — 같은 종이 갈라지는가, 그리고 갈라짐이 공짜가 아닌가.

import { stateHash } from '@hkt/core/v1';
import { graphHash } from '@hkt/core/d1';
import { buildSpeciesGraph, specimenOf } from '@hkt/core/d2';
import {
  graphBirthOf,
  personalizeFromWorld,
  personalizeGraph,
  personalVerdict,
  variationsFor,
} from '@hkt/core/d3';

import {
  defineScenario,
  expectDeterministic,
  expectState,
  expectTrue,
  type Assertion,
} from '../src/index.ts';

import {
  BROKEN_VARIATIONS,
  bareInstance,
  greedyInstance,
  hunterArchetype,
  hunterBlueprint,
  priestInstance,
  S3_DEFINITIONS,
  trackerInstance,
  VEIL_INSTANCES,
  VEIL_VARIATIONS,
} from './d3-veil-variations.ts';

/** 이 장면의 개체는 전부 성체로 선다 — 단계가 시한을 흔드는 것은 D2 가 이미 보였다. */
const baseOf = (instance: typeof trackerInstance) =>
  buildSpeciesGraph(hunterArchetype, hunterBlueprint, graphBirthOf(instance, '성체'));

const options = { definitions: S3_DEFINITIONS };

/** 정상 — 같은 기본 그래프에서 넷이 갈리고, 사제의 식량 의존이 의념으로 전환된다. */
export const d3PersonalGraphs = defineScenario({
  id: 'd3-personal-graphs',
  module: 'D3',
  kind: 'normal',
  purpose:
    '같은 종·같은 기본 그래프를 받은 넷이 이력·성격·자리·문화·능력으로 갈라지고, 사제의 식량 의존은 사라지는 것이 아니라 의념 의존으로 전환된다.',
  arrange: () => ({ instances: VEIL_INSTANCES, variations: VEIL_VARIATIONS }),
  act: ({ instances, variations }) => {
    const reports = instances.map((instance) =>
      personalizeFromWorld(baseOf(instance), instance, variations, options),
    );
    const [tracker, greedy, bare, priest] = reports;
    const priestReport = priest as NonNullable<typeof priest>;
    const conversion = priestReport.conversions.find((entry) => entry.converts);
    const labels = (report: NonNullable<typeof priest>): readonly string[] =>
      report.graph.nodes.map((node) => node.label);

    return {
      // ① 넷이 전부 선다
      complete: reports.every((report) => report.complete),
      verdicts: reports.map((report) => personalVerdict(report)),
      violations: reports.flatMap((report) =>
        report.violations.map((violation) => violation.rule),
      ),

      // ② 넷의 그래프가 서로 다르다 — 같은 종에서 나왔는데
      hashes: new Set(reports.map((report) => graphHash(report.graph))).size,
      nodeCounts: reports.map((report) => report.graph.nodes.length),
      applied: reports.map((report) => report.applied.map((entry) => entry.name)),

      // ③ 성격이 흔든 급함이 그래프에 실린다 — 04 는 더 급하고 11 은 덜 급하다
      hungerUrgency: reports.map((report) => {
        const edge = report.graph.edges.find(
          (entry) =>
            report.graph.nodes.find((node) => node.id === entry.from)?.label === '주린 몸',
        );
        return Number((edge?.urgency ?? 0).toFixed(2));
      }),
      hungerDelay: reports.map((report) => {
        const edge = report.graph.edges.find(
          (entry) =>
            report.graph.nodes.find((node) => node.id === entry.from)?.label === '주린 몸',
        );
        return edge?.failureDelayTicks ?? 0;
      }),
      retuned: reports.map((report) => report.retunes.filter((entry) => entry.moved).length),

      // ④ 사제의 전환 — 줄어든 무게만큼 새 의존이 섰고, 그것은 능력의 대가 자리에 걸린다
      conversionLost: Number((conversion?.lost ?? 0).toFixed(2)),
      conversionGained: Number((conversion?.gained ?? 0).toFixed(2)),
      conversionCostSlots: conversion?.costSlots ?? [],
      conversionOnCost: conversion?.onCostSlot ?? false,
      foodStrength: (priest as NonNullable<typeof priest>).graph.edges
        .filter(
          (edge) =>
            priestReport.graph.nodes.find((node) => node.id === edge.to)?.label === '겨울 식량',
        )
        .map((edge) => edge.strength),
      priestHasSpring: labels(priestReport).includes('의념의 샘'),
      // 사제도 여전히 굶는다 — 뿌리는 종의 것이고 개체가 지우지 못한다
      priestStillHungers: priestReport.graph.rootIds.some(
        (id) => priestReport.graph.nodes.find((node) => node.id === id)?.label === '주린 몸',
      ),

      // ⑤ 갈림이 무엇에서 왔는가
      trackerAdded: (tracker as NonNullable<typeof tracker>).diff.addedNodes.length,
      trackerLabels: labels(tracker as NonNullable<typeof tracker>).filter(
        (label) => !labels(bare as NonNullable<typeof bare>).includes(label),
      ),
      bareLabels: labels(bare as NonNullable<typeof bare>).filter(
        (label) => !labels(priestReport).includes(label),
      ),
      greedyChanged: (greedy as NonNullable<typeof greedy>).diff.changedEdges.length,
    };
  },
  assert: (result): readonly Assertion[] => [
    expectState('넷이 전부 선다', true, result.complete),
    expectState('거부 사유가 없다', [], result.violations),
    expectState('같은 종에서 나왔는데 그래프는 넷 다 다르다', 4, result.hashes),
    expectState(
      '갈림이 유래별로 붙는다',
      [
        ['빚진 자의 겨울', '등을 맡길 짝'],
        ['등을 맡길 짝'],
        ['등을 맡길 짝'],
        ['장막으로 배를 채운다', '어미께 올리는 제사'],
      ],
      result.applied,
    ),
    expectState('노드 수도 갈린다', [11, 10, 10, 11], result.nodeCounts),
    expectState(
      '같은 허기가 개체마다 다르게 급하다 — 성격이 흔든 값이 그래프에 실린다',
      [1, 0.56, 0.8, 0.8],
      result.hungerUrgency,
    ),
    expectState(
      '그러나 시한은 넷이 같다 — 성격은 급함을 흔들 뿐 몸이 버티는 시간은 흔들지 못한다 (S3 tunes 는 need-urgency 만 연다)',
      [30, 30, 30, 30],
      result.hungerDelay,
    ),
    expectState('다시 읽힌 뿌리는 흔들린 개체에만 있다', [1, 1, 0, 0], result.retuned),
    expectState('사제는 식량 의존의 절반을 덜어 냈다', 0.5, result.conversionLost),
    expectState('그만큼 새 의존이 섰다', 0.6, result.conversionGained),
    expectState(
      '그리고 그것은 그 능력이 치르는 자리에 걸린다',
      ['psychic.energy'],
      result.conversionCostSlots,
    ),
    expectState('대가 자리에 걸렸는가', true, result.conversionOnCost),
    expectState('식량 의존은 사라지지 않고 약해졌을 뿐이다', [0.45], result.foodStrength),
    expectState('의념의 샘이 새로 섰다', true, result.priestHasSpring),
    expectState('사제도 여전히 굶는다 — 뿌리는 개체가 지우지 못한다', true, result.priestStillHungers),
    expectState('빚진 04 에게만 마을이 붙는다', ['마을의 참을성'], result.trackerLabels),
    expectState('몰이꾼에게만 짝이 붙는다', ['등을 맡길 짝'], result.bareLabels),
    expectTrue(
      '욕심 많은 11 은 더한 것 없이 수치만 흔들렸다',
      result.greedyChanged >= 1 && result.trackerAdded >= 1,
      [result.greedyChanged, result.trackerAdded],
    ),
    expectDeterministic('같은 개체를 100번 개인화해도 같은 그래프다', () =>
      stateHash(
        VEIL_INSTANCES.map((instance) =>
          graphHash(
            personalizeFromWorld(baseOf(instance), instance, VEIL_VARIATIONS, options).graph,
          ),
        ),
      ),
    ),
  ],
});

/** 실패 — 열이 각자의 사유로 거부된다. */
export const d3BrokenVariationsRejected = defineScenario({
  id: 'd3-broken-variations-rejected',
  module: 'D3',
  kind: 'failure',
  purpose:
    '공짜 전환·가벼운 전환·대가 없는 능력의 전환·유래 없는 변형·없는 기댐의 편집·무너짐을 끊는 변형이 각자의 사유·경로로 거부된다.',
  arrange: () => ({ entries: BROKEN_VARIATIONS }),
  act: ({ entries }) =>
    entries.map((entry) => {
      const report = personalizeGraph(
        baseOf(entry.instance),
        entry.instance,
        entry.variations,
        options,
      );
      const first = report.violations[0];
      return {
        broke: entry.broke,
        expected: entry.expected,
        actual: first?.rule ?? '(통과해 버렸다)',
        complete: report.complete,
        path: first?.path ?? '',
        where: first?.at ?? '',
      };
    }),
  assert: (result): readonly Assertion[] => [
    expectState(
      '무너진 변형 열이 전부 예상한 사유로 걸린다',
      result.map((entry) => entry.expected),
      result.map((entry) => entry.actual),
    ),
    expectState(
      '하나도 온전하다고 판정되지 않는다',
      result.map(() => false),
      result.map((entry) => entry.complete),
    ),
    expectTrue(
      '어디를 고쳐야 하는지가 경로로 실린다',
      result.every((entry) => entry.path.startsWith('$')),
      result.map((entry) => entry.path),
    ),
    expectTrue(
      '전환이 걸린 자리는 변형의 편집 목록을 가리킨다',
      result
        .filter((entry) => entry.expected.endsWith('-conversion'))
        .every((entry) => entry.path.includes('$.variations[0]')),
      result.filter((entry) => entry.expected.endsWith('-conversion')).map((entry) => entry.path),
    ),
    expectDeterministic('거부 사유는 반복해도 같다', () =>
      stateHash(
        BROKEN_VARIATIONS.map(
          (entry) =>
            personalizeGraph(baseOf(entry.instance), entry.instance, entry.variations, options)
              .violations,
        ),
      ),
    ),
  ],
});

/** 경계 — 변형 0개, 미세한 약화, 대 잇는 뿌리, 남의 그래프. */
export const d3Boundary = defineScenario({
  id: 'd3-boundary',
  module: 'D3',
  kind: 'boundary',
  purpose:
    '변형이 하나도 없으면 기본 그래프 그대로이고, 아주 작은 약화도 전환을 요구하며, 대 잇는 뿌리는 다시 읽히지 않고, 남의 그래프는 개인화되지 않는다.',
  arrange: () => ({ instance: bareInstance, priest: priestInstance }),
  act: ({ instance, priest }) => {
    const base = baseOf(instance);
    const empty = personalizeGraph(base, instance, [], options);

    // 아주 작은 약화도 전환이다 — 0.95 → 0.94.
    const sliver = personalizeGraph(
      baseOf(priest),
      priest,
      [
        {
          id: 'sliver',
          name: '아주 조금 덜 먹는다',
          origin: { kind: 'capability', abilityId: (priest.capabilities[0] ?? '') as never },
          edits: [
            {
              kind: 'weaken',
              from: '주린 몸',
              to: '겨울 식량',
              relation: 'consumes',
              strength: 0.94,
            },
          ],
          note: '한 숟갈만 덜 먹는다',
        },
      ],
      options,
    );

    // 종의 표본 그래프로 개인화하면 그것은 이 개체의 것이 아니다.
    const foreign = personalizeGraph(
      buildSpeciesGraph(hunterArchetype, hunterBlueprint, specimenOf(hunterArchetype)),
      instance,
      [],
      options,
    );

    return {
      emptyStands: empty.complete,
      emptySame: graphHash(empty.graph) === graphHash(base),
      emptyApplied: empty.applied.length,
      // 뿌리 셋 중 개체가 무너지는 자리는 둘 — 대 이을 몸은 종이 끊기는 자리다
      roots: base.rootIds.length,
      retuned: empty.retunes.length,
      retunedLabels: empty.retunes.map((entry) => entry.label),
      sliverRule: sliver.violations[0]?.rule ?? '(통과해 버렸다)',
      sliverLost: Number((sliver.conversions[0]?.lost ?? 0).toFixed(2)),
      foreignRule: foreign.violations[0]?.rule ?? '(통과해 버렸다)',
      // 세계의 변형 중 이 개체가 가진 것을 고르는 일은 언제나 같은 답을 준다
      chosen: variationsFor(instance, VEIL_VARIATIONS).map((entry) => entry.id),
    };
  },
  assert: (result): readonly Assertion[] => [
    expectState('변형이 없어도 개인 그래프는 선다', true, result.emptyStands),
    expectState('그리고 기본 그래프와 같다', true, result.emptySame),
    expectState('적용된 변형은 0개', 0, result.emptyApplied),
    expectState('뿌리는 셋이지만 다시 읽히는 것은 둘이다', [3, 2], [result.roots, result.retuned]),
    expectState(
      '대 이을 몸은 개체의 무너짐이 아니므로 빠진다',
      ['주린 몸', '성한 몸'],
      result.retunedLabels,
    ),
    expectState('0.01 만큼만 덜어 내도 전환을 요구한다', 'free-conversion', result.sliverRule),
    expectState('그 무게는 0.01 이다', 0.01, result.sliverLost),
    expectState('남의 그래프는 개인화되지 않는다', 'foreign-base', result.foreignRule),
    expectState('맨몸의 23 이 고르는 변형은 자리의 것 하나뿐이다', ['beater-pair'], result.chosen),
  ],
});

export const d3Scenarios = [d3PersonalGraphs, d3BrokenVariationsRejected, d3Boundary];
