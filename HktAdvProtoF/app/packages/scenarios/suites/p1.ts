// P1 검증 시나리오 3종 — 방향이 정말 좁혀지는가, 막힘이 정말 사유를 대는가.

import { stateHash } from '@hkt/core/v1';
import { expandStrategies, openOption } from '@hkt/core/p1';
import {
  atomsOf,
  BLOCK_SPECS,
  branchResolutionOf,
  checkDirections,
  checkOptions,
  checkPossibilities,
  directionVerdict,
  possibilityVerdict,
  STRATEGY_DIRECTION_SPECS,
  STRATEGY_DIRECTIONS,
  treeVerdict,
  WATER_BRANCHES,
} from '@hkt/core/p1';

import {
  defineScenario,
  expectDeterministic,
  expectState,
  expectTrue,
  type Assertion,
} from '../src/index.ts';

import {
  branchOf,
  BROKEN_EXPANSIONS,
  detachOn,
  HUNGER_ROOT,
  RIVAL_TREE,
  trackerTree,
  UNFILLABLE_CASES,
  VEIL_TREES,
} from './p1-veil-strategies.ts';

/** 정상 — 원문 일곱 갈래가 방향으로 접히고, 결핍의 종이 갈래를 좁힌다. */
export const p1SevenDirections = defineScenario({
  id: 'p1-seven-directions',
  module: 'P1',
  kind: 'normal',
  purpose:
    '원문 물 부족 일곱 갈래가 방향 다섯으로 접히고, 방향마다의 원자가 P0 환원표와 일치하며, 같은 겨울에서 결핍의 종에 따라 열리는 갈래가 갈린다.',
  arrange: () => ({ trees: VEIL_TREES, branches: WATER_BRANCHES }),
  act: ({ trees }) => {
    const directions = checkDirections();
    return {
      // ① 원문 일곱 갈래가 방향으로 접힌다
      directionCount: directions.directions.length,
      unresolved: directions.unresolved,
      waterDirections: WATER_BRANCHES.map((entry) => branchResolutionOf(entry.name)?.direction),
      unusedDirections: directions.unusedDirections,
      needOthers: directions.needOthers,
      directionVerdict: directionVerdict(directions),

      // ② 방향의 원자는 P0 이 배정한 그대로다
      fulfillAtoms: atomsOf('fulfill'),
      reduceAtoms: atomsOf('reduce'),

      // ③ 결핍의 종이 갈래를 좁힌다 — 자원 여섯, 공간 셋
      foodOpen: branchOf(trackerTree, '겨울 식량')?.open ?? [],
      shelterOpen: branchOf(trackerTree, '겨울 움막')?.open ?? [],
      shelterBlocked:
        branchOf(trackerTree, '겨울 움막')
          ?.options.filter((option) => !option.open)
          .map((option) => option.blockedBy) ?? [],

      // ④ 같은 세계인데 누구에게 무엇이 먼저인지가 갈린다
      leading: trees.map((entry) => ({
        label: entry.label,
        first: entry.tree.branches[0]?.label,
        level: entry.tree.branches[0]?.level,
      })),

      // ⑤ 열린 갈래가 전부 O1 원소로 선다
      possibilities: checkPossibilities(trackerTree).possibilities.length,
      possibilityVerdict: possibilityVerdict(checkPossibilities(trackerTree)),
      treeVerdict: treeVerdict(trackerTree),
    };
  },
  assert: (result): readonly Assertion[] => [
    expectState('확정 방향 7종이 선다', 7, result.directionCount),
    expectState('원문 일곱 갈래가 하나도 남지 않는다', [], result.unresolved),
    expectState(
      '찾다·구매·훔치다는 같은 충족으로, 나머지는 각자의 방향으로 접힌다',
      ['fulfill', 'fulfill', 'fulfill', 'produce', 'substitute', 'reduce', 'removeDependency'],
      result.waterDirections,
    ),
    expectState(
      '원문 예시가 쓰지 않은 둘은 남이 있어야 열리는 둘이다',
      ['delegate', 'removeRival'],
      result.unusedDirections,
    ),
    expectState('그 둘이 곧 남을 건드리는 방향이다', result.needOthers, result.unusedDirections),
    expectState('충족은 네 원자를 준다 (P0 배정 그대로)', ['seek', 'acquire', 'exchange', 'seize'], result.fulfillAtoms),
    expectState('감소는 적응 하나뿐이다', ['adapt'], result.reduceAtoms),
    expectState(
      '겨울 식량(자원) 앞에는 여섯이 열린다',
      ['fulfill', 'substitute', 'reduce', 'produce', 'delegate', 'removeDependency'],
      result.foodOpen,
    ),
    expectState(
      '겨울 움막(공간) 앞에는 셋만 열린다 — 장소는 만들 수도 맡길 수도 덜 쓸 수도 없다',
      ['fulfill', 'substitute', 'removeDependency'],
      result.shelterOpen,
    ),
    expectState(
      '그 넷이 막힌 사유는 전부 앞 계층이 못박은 성질이다',
      ['nothing-to-reduce', 'unproducible-kind', 'untransferable', 'no-known-rival'],
      result.shelterBlocked,
    ),
    expectState(
      '같은 겨울인데 04 만 굶주림이 먼저다',
      [
        { label: '몰이꾼 04 (빚 40)', first: '겨울 식량', level: 'critical' },
        { label: '몰이꾼 11 (욕심)', first: '겨울 움막', level: 'deficient' },
        { label: '몰이꾼 23 (맨몸)', first: '겨울 움막', level: 'deficient' },
        { label: '사제 31 (의념 200)', first: '겨울 움막', level: 'deficient' },
      ],
      result.leading,
    ),
    expectState('열린 갈래 아홉이 전부 O1 Possibility 로 선다', 9, result.possibilities),
    expectTrue(
      '판정 세 줄이 무엇이 접혔고 무엇이 열렸는지 말한다',
      result.directionVerdict.includes('P0 원자에 묶였다') &&
        result.treeVerdict.includes('가장 급한 것은 겨울 식량') &&
        result.possibilityVerdict.includes('O1 Possibility 로 선다'),
      [result.directionVerdict, result.treeVerdict, result.possibilityVerdict],
    ),
    expectDeterministic('같은 세계를 100번 물어도 같은 트리다', () =>
      stateHash(VEIL_TREES.map((entry) => entry.tree.hash)),
    ),
  ],
});

/** 실패 — 설 수 없는 전개와 설 수 없는 방향이 각자의 사유와 경로로 거부된다. */
export const p1BrokenExpansionsRejected = defineScenario({
  id: 'p1-broken-expansions-rejected',
  module: 'P1',
  kind: 'failure',
  purpose:
    '남의 압력·남의 노드·없는 자리·빈 전개가 각자의 사유로 거부되고, P0 환원표와 어긋난 방향·사유 없는 차단·원자 없는 열림이 함께 거부된다.',
  arrange: () => ({ expansions: BROKEN_EXPANSIONS, specs: STRATEGY_DIRECTION_SPECS }),
  act: ({ expansions, specs }) => {
    const sound = branchOf(trackerTree, '겨울 식량')?.options ?? [];
    return {
      expansions: expansions.map((entry) => {
        const tree = expandStrategies(entry.graph, entry.report);
        return {
          broke: entry.broke,
          expected: entry.expected,
          actual: tree.violations[0]?.rule ?? '(통과해 버렸다)',
          message: tree.violations[0]?.message ?? '',
        };
      }),

      // 방향이 P0 과 어긋나는 순간 거부된다 — 두 곳에 같은 것을 적으면 갈라지기 때문이다
      drift: checkDirections(
        specs.map((spec) =>
          spec.direction === 'reduce' ? { ...spec, originalName: '적게 먹는다' } : spec,
        ),
      ).violations[0]?.rule,
      // P0 이 "방향이 아니다" 라고 환원한 문장을 방향으로 적어도 거부된다
      notADirection: checkDirections(
        specs.map((spec) => (spec.direction === 'produce' ? { ...spec, originalName: '법제화' } : spec)),
      ).violations[0]?.rule,

      // 갈래 판정이 무너지는 경우
      unreasoned: checkOptions(
        sound.map((option) =>
          option.direction === 'removeRival' ? { ...option, blockedBy: null } : option,
        ),
      )[0]?.rule,
      atomless: checkOptions(
        sound.map((option) => (option.open ? { ...option, atoms: [] } : option)),
      )[0]?.rule,
      unowed: checkOptions(
        sound.map((option) =>
          option.direction === 'removeRival' ? { ...option, owedTo: null } : option,
        ),
      )[0]?.rule,
    };
  },
  assert: (result): readonly Assertion[] => [
    expectState(
      '무너진 전개 넷이 전부 예상한 사유로 걸린다',
      result.expansions.map((entry) => entry.expected),
      result.expansions.map((entry) => entry.actual),
    ),
    expectTrue(
      '사유마다 무엇이 어긋났는지 문장이 남는다',
      result.expansions.every((entry) => entry.message.length > 0),
      result.expansions.map((entry) => entry.message),
    ),
    expectState('P0 환원표에 없는 문장을 쓰면 원자를 찾지 못한다', 'direction-atom-drift', result.drift),
    expectState('방향이 아닌 것을 방향으로 적어도 걸린다', 'direction-atom-drift', result.notADirection),
    expectState('사유 없는 차단은 임의의 규칙이다', 'unreasoned-block', result.unreasoned),
    expectState('원자 없는 열림은 열린 것이 아니다', 'open-without-atom', result.atomless),
    expectState('갚을 자리를 안 적은 차단도 걸린다', 'unowed-block', result.unowed),
  ],
});

/** 경계 — 아무 갈래도 열리지 않는 결핍, 뿌리의 의존 제거, 아직 눈이 없는 경쟁 제거. */
export const p1Boundary = defineScenario({
  id: 'p1-boundary',
  module: 'P1',
  kind: 'boundary',
  purpose:
    '채울 원자가 없는 종(규칙)과 대상이 없는 종(시간)이 각자의 사유로 막히고, 뿌리는 버리지 못하며, 경쟁 제거는 겨루는 자를 쥐여 주는 순간 열린다.',
  arrange: () => ({ cases: UNFILLABLE_CASES }),
  act: ({ cases }) => ({
    // ① 채울 길이 아예 없는 종 둘
    unfillable: cases.map((entry) => ({
      label: entry.label,
      blockedBy: openOption('fulfill', entry.node, null, false).blockedBy,
      owedTo: openOption('fulfill', entry.node, null, false).owedTo,
    })),

    // ② 뿌리는 버리지 못하고 사슬 안쪽은 버릴 수 있다
    rootDetach: detachOn(HUNGER_ROOT, true).blockedBy,
    rootOwedTo: detachOn(HUNGER_ROOT, true).owedTo,
    leafDetach: detachOn(HUNGER_ROOT, false).open,

    // ③ 겨루는 눈이 없으면 늘 막히고, 쥐여 주면 그 자리에서 열린다
    neverOpen: trackerTree.neverOpen,
    withRivalNeverOpen: RIVAL_TREE.neverOpen,
    rivalOpened: RIVAL_TREE.openCounts['removeRival'],
    rivalAtoms:
      branchOf(RIVAL_TREE, '겨울 식량')?.options.find(
        (option) => option.direction === 'removeRival',
      )?.atoms ?? [],

    // ④ 막힘 사유 여덟 중 셋만 뒤에서 갚을 수 있다
    owed: BLOCK_SPECS.filter((spec) => spec.owedTo !== null).map((spec) => spec.reason),

    // ⑤ 일곱은 언제나 일곱으로 선다 — 막힌 것도 자리를 지킨다
    optionCounts: trackerTree.branches.map((branch) => branch.options.length),
    directionCount: STRATEGY_DIRECTIONS.length,
  }),
  assert: (result): readonly Assertion[] => [
    expectState(
      '시간은 대상이 없어서, 규칙은 채울 원자가 없어서 막힌다',
      [
        { label: '붉은 장막의 주기 (시간)', blockedBy: 'no-target', owedTo: null },
        {
          label: '의념은 대가를 요구한다 (규칙)',
          blockedBy: 'no-filling-atom',
          owedTo: 'W2 규칙 실체화 — 규칙이 세계 상태가 되면 그때 채울 길이 생긴다',
        },
      ],
      result.unfillable,
    ),
    expectState('굶주림 자체는 버릴 수 없다', 'species-root', result.rootDetach),
    expectState(
      '버릴 수 있게 되는 것은 G3 성장 이후다',
      'G3 성장 — 종의 자리 자체를 바꾸는 탈피는 그쪽이 승인한다',
      result.rootOwedTo,
    ),
    expectTrue('같은 자리라도 사슬 안쪽이면 버릴 수 있다', result.leafDetach, result.leafDetach),
    expectState('지금 세계에서 경쟁 제거는 아무에게도 열리지 않는다', ['removeRival'], result.neverOpen),
    expectState('겨루는 자를 쥐여 주면 열리지 않는 방향이 사라진다', [], result.withRivalNeverOpen),
    expectState('그때 열리는 자리는 빈 자리 둘 전부다', 2, result.rivalOpened),
    expectState(
      '경쟁 제거가 주는 원자는 제거·협박·은폐 셋이다',
      ['destroy', 'coerce', 'conceal'],
      result.rivalAtoms,
    ),
    expectState(
      '뒤에서 갚을 수 있는 사유는 셋뿐이다',
      ['no-filling-atom', 'no-known-rival', 'species-root'],
      result.owed,
    ),
    expectState(
      '어느 결핍 앞에서도 방향은 일곱으로 선다',
      result.optionCounts.map(() => result.directionCount),
      result.optionCounts,
    ),
  ],
});

export const p1Scenarios = [p1SevenDirections, p1BrokenExpansionsRejected, p1Boundary];
