// D2 검증 시나리오 3종 — 그래프가 정말 종에서 나오는가, 그리고 그 그래프가 종을 살게 하는가.

import { deterministicId, stateHash } from '@hkt/core/v1';
import { conditionSummary, graphHash } from '@hkt/core/d1';
import {
  blueprintVerdict,
  buildSpeciesGraph,
  checkBlueprint,
  checkBlueprints,
  graphShapeHash,
  specimenOf,
  speciesNeeds,
} from '@hkt/core/d2';

import {
  defineScenario,
  expectDeterministic,
  expectState,
  expectTrue,
  type Assertion,
} from '../src/index.ts';

import {
  BROKEN_BLUEPRINTS,
  guildBlueprint,
  guildArchetype,
  hunterArchetype,
  hunterBlueprint,
  veilWormArchetype,
  veilWormBlueprint,
  VEIL_BLUEPRINTS,
} from './d2-veil-blueprints.ts';

/** 정상 — 종 다섯이 각자의 그래프를 물려주고, 같은 종의 둘이 같은 모양을 받는다. */
export const d2SpeciesBaseGraphs = defineScenario({
  id: 'd2-species-base-graphs',
  module: 'D2',
  kind: 'normal',
  purpose:
    '종 다섯이 각자 기본 의존 그래프를 찍어 내고, 뿌리는 종이 말한 무너짐 그대로이며, 같은 종에서 태어난 둘은 ID 가 달라도 같은 모양을 받는다.',
  arrange: () => ({ entries: VEIL_BLUEPRINTS }),
  act: ({ entries }) => {
    const batch = checkBlueprints(entries);
    const hunter = checkBlueprint(hunterArchetype, hunterBlueprint);
    const worm = checkBlueprint(veilWormArchetype, veilWormBlueprint);

    // 같은 종에서 태어난 둘 — 몰이꾼 04 와 몰이꾼 07.
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

    // 뿌리의 조건은 종이 말한 것을 옮겨 적은 것이다 — 고쳐 적을 자리가 없다.
    const rootsMatchNeeds = hunter.paths.map((path) => {
      const node = hunter.graph.nodes.find((entry) => entry.id === path.rootId);
      const need = hunterArchetype.baseNeeds
        .concat(hunterBlueprint.lineage === null ? [] : [hunterBlueprint.lineage])
        .find((template) => `${template.slot.domain}.${template.slot.path}` === path.slot);
      return node === undefined || need === undefined || node.condition.kind !== 'slot'
        ? 'missing'
        : `${conditionSummary(node.condition)}|${need.slot.domain}.${need.slot.path}`;
    });

    return {
      // ① 다섯 종이 전부 선다
      complete: batch.complete,
      verdicts: batch.reports.map((report) => blueprintVerdict(report)),
      violations: batch.reports.flatMap((report) =>
        report.violations.map((violation) => violation.rule),
      ),

      // ② 사냥꾼 — 세 갈래로 갈린다
      hunterNodes: hunter.graph.nodes.length,
      hunterEdges: hunter.graph.edges.length,
      hunterRoots: hunter.paths.map((path) => `${path.label} (${path.serves})`),
      hunterChain: hunter.graph.edges.map((edge) => {
        const name = (id: string): string =>
          hunter.graph.nodes.find((node) => node.id === id)?.label ?? id;
        return `${name(edge.from)} --${edge.relation}--> ${name(edge.to)}`;
      }),
      hunterKinds: [...new Set(hunter.graph.nodes.map((node) => node.kind))],
      rootsMatchNeeds: rootsMatchNeeds.every((entry) => {
        const [condition, slot] = entry.split('|');
        return entry !== 'missing' && (condition ?? '').startsWith(`${slot ?? ''} `);
      }),

      // ③ 장막벌레 — 뿌리 하나가 생존과 대를 함께 떠받친다
      wormRoots: worm.paths.map((path) => path.serves),
      wormLineageLabel: worm.lineage?.label ?? null,
      wormNeedCount: speciesNeeds(veilWormArchetype, veilWormBlueprint).length,

      // ④ 몸 없는 셋은 대를 잇지 않는다
      lineages: batch.reports.map((report) => report.lineage?.slot ?? null),

      // ⑤ 생존·번식 경로가 하나도 끊기지 않는다
      unbroken: batch.reports.flatMap((report) => report.paths.map((path) => path.unbroken)),
      depths: batch.reports.map((report) =>
        Math.max(...report.paths.map((path) => path.depth)),
      ),

      // ⑥ 종은 모양을 물려준다 — 개체가 달라도 같은 모양, 다른 그래프
      sameShape: graphShapeHash(graph04) === graphShapeHash(graph07),
      differentGraph: graphHash(graph04) !== graphHash(graph07),
      sameLabels:
        graph04.nodes.map((node) => node.label).join() ===
        graph07.nodes.map((node) => node.label).join(),
      holdersDiffer:
        graph04.nodes.every((node) => node.subjectId === beater04.subjectId) &&
        graph07.nodes.every((node) => node.subjectId === beater07.subjectId),
    };
  },
  assert: (result): readonly Assertion[] => [
    expectState('종 다섯이 전부 살 수 있는 그래프를 물려준다', true, result.complete),
    expectState('거부 사유가 없다', [], result.violations),
    expectState('사냥꾼은 노드 아홉·간선 일곱', [9, 7], [result.hunterNodes, result.hunterEdges]),
    expectState(
      '사냥꾼의 무너짐은 셋으로 갈린다 — 굶는 것·다치는 것·대가 끊기는 것',
      ['주린 몸 (survival)', '성한 몸 (survival)', '대 이을 몸 (lineage)'],
      result.hunterRoots,
    ),
    expectState(
      '사슬이 종에서 그대로 나온다',
      [
        '주린 몸 --consumes--> 겨울 식량',
        '겨울 식량 --requires--> 사냥터',
        '사냥터 --authorized_by--> 고개 통행권',
        '사냥터 --sustained_by--> 장막이 걷히는 주기',
        '겨울 식량 --informed_by--> 마비독 감별',
        '성한 몸 --protected_by--> 겨울 움막',
        '대 이을 몸 --protected_by--> 겨울 움막',
      ],
      result.hunterChain,
    ),
    expectState(
      '한 종의 기본 의존이 여섯 종을 건드린다',
      ['body', 'resource', 'space', 'institution', 'time', 'information'],
      result.hunterKinds,
    ),
    expectState('뿌리의 조건은 종이 말한 자리 그대로다', true, result.rootsMatchNeeds),
    expectState('장막벌레는 뿌리 하나가 생존이자 대다', ['both'], result.wormRoots),
    expectState('그 뿌리가 곧 대 잇는 자리다', '스러지지 않는 군집', result.wormLineageLabel),
    expectState('무너지는 자리는 하나로 합쳐진다', 1, result.wormNeedCount),
    expectState(
      '몸 있는 둘만 대를 잇는다 — 조직·국가·신은 낳지 않는다',
      ['biological.fertility', 'ecological.population', null, null, null],
      result.lineages,
    ),
    expectTrue(
      '뿌리마다 채움이 있다 — 생존·번식 경로가 하나도 끊기지 않는다',
      result.unbroken.every((entry) => entry),
      result.unbroken,
    ),
    expectTrue(
      '사슬은 뿌리에서 한 단계 이상 뻗는다',
      result.depths.every((depth) => depth >= 1),
      result.depths,
    ),
    expectState('같은 종의 둘은 같은 모양을 받는다', true, result.sameShape),
    expectState('그러나 같은 그래프는 아니다 — 자리의 주인이 다르다', true, result.differentGraph),
    expectState('노드의 이름은 종의 것이므로 똑같다', true, result.sameLabels),
    expectState('노드는 전부 자기 주체의 것이다', true, result.holdersDiffer),
    expectDeterministic('같은 종을 100번 찍어도 같은 그래프다', () =>
      stateHash(
        VEIL_BLUEPRINTS.map((entry) =>
          graphHash(buildSpeciesGraph(entry.archetype, entry.blueprint, specimenOf(entry.archetype))),
        ),
      ),
    ),
  ],
});

/** 실패 — 열다섯이 각자의 사유로 거부된다. */
export const d2BrokenBlueprintsRejected = defineScenario({
  id: 'd2-broken-blueprints-rejected',
  module: 'D2',
  kind: 'failure',
  purpose:
    '채울 것 없는 무너짐·대를 잇지 않는 종·늙지 않는데 낳는 종·시한을 두 번 적은 채움·맴도는 채움이 각자의 사유·경로로 거부된다.',
  arrange: () => ({ entries: BROKEN_BLUEPRINTS }),
  act: ({ entries }) =>
    entries.map((entry) => {
      const report = checkBlueprint(entry.archetype, entry.blueprint);
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
      '무너진 설계도 열다섯이 전부 예상한 사유로 걸린다',
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
      '그래프의 사유는 D1 관문에서 온다 — 판정자는 하나다',
      result
        .filter((entry) => entry.expected === 'broken-graph')
        .every((entry) => entry.actual === 'broken-graph'),
      result.filter((entry) => entry.expected === 'broken-graph').map((entry) => entry.path),
    ),
    expectDeterministic('거부 사유는 반복해도 같다', () =>
      stateHash(
        BROKEN_BLUEPRINTS.map(
          (entry) => checkBlueprint(entry.archetype, entry.blueprint).violations,
        ),
      ),
    ),
  ],
});

/** 경계 — 단계가 시한을 나누고, 가장 작은 설계도가 서고, 늙지 않는 종은 대가 없다. */
export const d2Boundary = defineScenario({
  id: 'd2-boundary',
  module: 'D2',
  kind: 'boundary',
  purpose:
    '같은 종·같은 설계도가 단계마다 다른 시한을 받고, 한 채움이 두 무너짐을 떠받칠 때 시한은 각각의 무너짐이 정하며, 뿌리 하나·채움 하나짜리 설계도도 선다.',
  arrange: () => ({ archetype: hunterArchetype, blueprint: hunterBlueprint }),
  act: ({ archetype, blueprint }) => {
    const stages = ['유체', '성체', '노체'].map((stage) => {
      const graph = buildSpeciesGraph(archetype, blueprint, {
        ...specimenOf(archetype),
        stage,
      });
      const hungerEdge = graph.edges.find(
        (edge) => graph.nodes.find((node) => node.id === edge.from)?.label === '주린 몸',
      );
      const lineageEdge = graph.edges.find(
        (edge) => graph.nodes.find((node) => node.id === edge.from)?.label === '대 이을 몸',
      );
      const groundEdge = graph.edges.find(
        (edge) => graph.nodes.find((node) => node.id === edge.to)?.label === '사냥터',
      );
      return {
        stage,
        hunger: hungerEdge?.failureDelayTicks ?? 0,
        lineage: lineageEdge?.failureDelayTicks ?? 0,
        ground: groundEdge?.failureDelayTicks ?? 0,
        shape: graphShapeHash(graph),
      };
    });

    // 한 채움(겨울 움막)이 두 무너짐을 떠받친다 — 시한은 각각이 정한다.
    const adult = buildSpeciesGraph(archetype, blueprint, {
      ...specimenOf(archetype),
      stage: '성체',
    });
    const hutEdges = adult.edges
      .filter((edge) => adult.nodes.find((node) => node.id === edge.to)?.label === '겨울 움막')
      .map((edge) => ({
        from: adult.nodes.find((node) => node.id === edge.from)?.label ?? '',
        delay: edge.failureDelayTicks,
        urgency: edge.urgency,
      }));

    // 가장 작은 설계도 — 뿌리 하나, 채움 하나. 늙지 않는 종이므로 대도 없다.
    const smallest = checkBlueprint(guildArchetype, {
      ...guildBlueprint,
      supplies: guildBlueprint.supplies.filter((supply) => supply.label === '약초 자생지'),
    });

    return {
      stageDelays: stages.map((entry) => [entry.stage, entry.hunger, entry.lineage] as const),
      // 대사가 나누는 것은 뿌리에 걸린 시한만이 아니다 — 사슬 안쪽도 같이 흔들린다
      groundDelays: stages.map((entry) => entry.ground),
      sameShapeAcrossStages: new Set(stages.map((entry) => entry.shape)).size,
      hutEdges,
      smallestStands: smallest.complete,
      smallestNodes: smallest.graph.nodes.length,
      smallestDepth: smallest.paths[0]?.depth ?? 0,
      smallestLineage: smallest.lineage,
    };
  },
  assert: (result): readonly Assertion[] => [
    expectState(
      '같은 종·같은 설계도가 단계마다 다른 시한을 받는다 — 유체는 빨리 태우고 빨리 무너진다',
      [
        ['유체', 20, 267],
        ['성체', 30, 400],
        ['노체', 40, 533],
      ],
      result.stageDelays.map((entry) => [entry[0], entry[1], entry[2]]),
    ),
    expectState('사슬 안쪽의 시한도 대사가 나눈다', [4, 6, 8], result.groundDelays),
    expectTrue(
      '그래도 모양은 단계마다 다르다 — 시한이 모양의 일부이기 때문이다',
      result.sameShapeAcrossStages === 3,
      result.sameShapeAcrossStages,
    ),
    expectState(
      '한 움막이 두 무너짐을 떠받치고, 시한과 급함은 각각의 무너짐이 정한다',
      [
        { from: '성한 몸', delay: 1, urgency: 1 },
        { from: '대 이을 몸', delay: 400, urgency: 0.2 },
      ],
      result.hutEdges,
    ),
    expectState('뿌리 하나·채움 하나짜리 설계도도 선다', true, result.smallestStands),
    expectState('노드는 둘, 사슬은 한 단계', [2, 1], [result.smallestNodes, result.smallestDepth]),
    expectState('늙지 않는 종에는 대가 없다', null, result.smallestLineage),
  ],
});

export const d2Scenarios = [d2SpeciesBaseGraphs, d2BrokenBlueprintsRejected, d2Boundary];
