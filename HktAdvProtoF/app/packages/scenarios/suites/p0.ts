// P0 검증 시나리오 3종 — 열여섯이 정말 최소이고, 정말 세계에 닿고, 정말 요청을 가르는가.

import { stateHash } from '@hkt/core/v1';
import { DEPENDENCY_KINDS } from '@hkt/core/d0';
import {
  ACTION_ATOMS,
  ATOM_GROUNDINGS,
  atomGrounding,
  atomGroundingVerdict,
  atomReconciliationVerdict,
  atomsFilling,
  atomResolutionOf,
  checkAtomAffordance,
  checkAtomGroundings,
  fitAction,
  P1_DIRECTIONS,
  P2_EXAMPLES,
  reconcileAtoms,
  UNFILLABLE_KINDS,
  UNUSED_ATOM_DEBT,
} from '@hkt/core/p0';

import {
  defineScenario,
  expectDeterministic,
  expectState,
  expectTrue,
  type Assertion,
} from '../src/index.ts';

import {
  BROKEN_PROPOSALS,
  closedFor,
  CRISIS_PRESSURE,
  CRISIS_WORLD,
  pathsFor,
  subjectPaths,
  VEIL_PROPOSALS,
} from './p0-veil-actions.ts';

/** 정상 — 원문이 흩어 적은 행동이 열여섯으로 환원되고, 굶주림 하나 앞에서 길이 갈린다. */
export const p0SixteenAtoms = defineScenario({
  id: 'p0-sixteen-atoms',
  module: 'P0',
  kind: 'normal',
  purpose:
    '원문 P1 방향 7 · P2 예시 15 가 16원자로 남김없이 환원되고, 열여섯이 전부 세계의 실재하는 자리를 바꾸고 치르며, 같은 굶주림 앞에서 개체마다 다른 길이 열린다.',
  arrange: () => ({ world: CRISIS_WORLD, proposals: VEIL_PROPOSALS }),
  act: ({ proposals }) => {
    const reconciliation = reconcileAtoms();
    const grounding = checkAtomGroundings();

    return {
      // ① 원문 세 목록이 열여섯으로 환원된다
      atoms: reconciliation.atoms,
      unresolved: reconciliation.unresolved,
      compounds: reconciliation.compounds,
      unusedAtoms: reconciliation.unusedAtoms,
      reconciliationVerdict: atomReconciliationVerdict(reconciliation),

      // ② 열여섯이 전부 세계에 걸린다
      byTouch: Object.fromEntries(
        Object.entries(grounding.byTouch).map(([key, list]) => [key, list.length]),
      ),
      pairs: grounding.pairs,
      blindAtoms: grounding.blindAtoms,
      unfillable: grounding.unfillable,
      groundingVerdict: atomGroundingVerdict(grounding),

      // ③ 굶주림(자원 의존) 하나 앞에 아홉이 놓이고 일곱은 놓이지 않는다
      openPaths: pathsFor('resource').map((path) => `${path.atom}:${path.bearing}`),
      closedPaths: closedFor('resource'),

      // ④ 같은 결핍인데 넷이 다른 길을 갖는다 — 세계가 문법 위에서 고른다
      peak: Number(CRISIS_PRESSURE.peak.toFixed(2)),
      peakLevel: CRISIS_PRESSURE.peakLevel,
      subjects: subjectPaths().map((entry) => ({
        label: entry.label,
        payable: entry.payable,
        escapes: entry.escapes,
      })),

      // ⑤ 실제 요청 다섯이 관문을 지난다
      proposals: proposals.map((entry) => ({
        atom: entry.proposal.atom,
        fits: fitAction(entry.proposal).fits,
      })),
    };
  },
  assert: (result): readonly Assertion[] => [
    expectState('확정 16원자가 선다', 16, result.atoms.length),
    expectState('원문 P1·P2 의 스물둘이 하나도 남지 않는다', [], result.unresolved),
    expectState(
      'P2 예시 중 여섯은 조합이라 새 행동이 아니다',
      ['사냥', '독점', '통제', '의례 요구', '금기 부여', '영역 변형'],
      result.compounds,
    ),
    expectState(
      '손대는 곳 넷이 열여섯을 나눈다 — 세계 4 · 앎 3 · 사이 6 · 자기 3',
      { world: 4, knowing: 3, between: 6, self: 3 },
      result.byTouch,
    ),
    expectState(
      '동의 하나로 갈리는 짝이 다섯 선다',
      ['exchange↔seize', 'destroy↔protect', 'conceal↔seek', 'coerce↔persuade', 'ally↔betray'],
      result.pairs,
    ),
    expectState('보지 않고 할 수 있는 것은 찾는 것 하나뿐이다', ['seek'], result.blindAtoms),
    expectState('아무 원자도 채우지 못하는 종은 규칙과 시간 둘뿐이다', ['rule', 'time'], result.unfillable),
    expectState(
      '굶주림 앞에 아홉이 놓인다 — 채움 넷·지킴 둘·벗어남 셋',
      [
        'acquire:fill',
        'produce:fill',
        'exchange:fill',
        'seize:fill',
        'protect:guard',
        'conceal:guard',
        'adapt:escape',
        'substitute:escape',
        'shed:escape',
      ],
      result.openPaths,
    ),
    expectState(
      '나머지 일곱은 이 결핍과 무관하다 — 굶주림은 설득으로 채워지지 않는다',
      ['seek', 'destroy', 'investigate', 'persuade', 'coerce', 'ally', 'betray'],
      result.closedPaths,
    ),
    expectState('그때 굶주림은 위기다', 'critical', result.peakLevel),
    expectState(
      '같은 굶주림 앞에서 넷의 길이 갈린다 — 빚진 자에게 남은 것은 협곡뿐이고 벗어날 수 있는 것은 사제뿐이다',
      [
        { label: '몰이꾼 04 (빚 40)', payable: ['acquire'], escapes: [] },
        {
          label: '몰이꾼 11 (욕심)',
          payable: ['acquire', 'produce', 'exchange', 'seize'],
          escapes: [],
        },
        { label: '몰이꾼 23 (맨몸)', payable: ['acquire', 'seize'], escapes: [] },
        {
          label: '사제 31 (의념 200)',
          payable: ['acquire', 'seize'],
          escapes: ['adapt', 'substitute', 'shed'],
        },
      ],
      result.subjects,
    ),
    expectState(
      '요청 다섯이 모두 선다 — 아직 아무것도 못 본 채로도 찾는 것만은 할 수 있다',
      [true, true, true, true, true],
      result.proposals.map((entry) => entry.fits),
    ),
    expectTrue(
      '판정 두 줄이 무엇이 환원됐고 무엇이 걸렸는지 말한다',
      result.reconciliationVerdict.includes('16원자로 환원됐다') &&
        result.groundingVerdict.includes('열여섯이 전부 세계에 걸린다'),
      [result.reconciliationVerdict, result.groundingVerdict],
    ),
    expectDeterministic('같은 문법을 100번 물어도 같은 답이다', () =>
      stateHash([reconcileAtoms(), checkAtomGroundings(), pathsFor('resource'), subjectPaths()]),
    ),
  ],
});

/** 실패 — 설 수 없는 요청 아홉이 각자의 사유와 경로로 거부된다. */
export const p0BrokenActionsRejected = defineScenario({
  id: 'p0-broken-actions-rejected',
  module: 'P0',
  kind: 'failure',
  purpose:
    '16종 밖의 행동·원자가 열지 않은 변경·대가 없는 요청·남에게 겨눈 자기 원자·보지 못한 대상의 조작이 각각 자기 사유와 경로로 거부된다.',
  arrange: () => ({ proposals: BROKEN_PROPOSALS, groundings: ATOM_GROUNDINGS }),
  act: ({ proposals, groundings }) => ({
    proposals: proposals.map((entry) => {
      const fit = fitAction(entry.proposal, '$.plan.steps[0]');
      return {
        broke: entry.broke,
        expected: entry.expected,
        actual: fit.violations[0]?.rule ?? '(통과해 버렸다)',
        fits: fit.fits,
        path: fit.violations[0]?.path ?? '',
      };
    }),
    // 걸림 자체가 무너지는 경우 — 공짜 원자와 보지 않고 세계를 바꾸는 원자
    freeAtom: checkAtomGroundings(
      groundings.map((entry) => (entry.atom === 'seize' ? { ...entry, pays: [] } : entry)),
    ).violations[0]?.rule,
    blindAtom: checkAtomGroundings(
      groundings.map((entry) =>
        entry.atom === 'destroy' ? { ...entry, requiresObservation: false } : entry,
      ),
    ).violations[0]?.rule,
    // O1 이 열어 둔 자리가 닫혔는가
    affordance: checkAtomAffordance({ id: 'affordance:0', action: 'gather' })[0]?.rule,
  }),
  assert: (result): readonly Assertion[] => [
    expectState(
      '무너진 요청 아홉이 전부 예상한 사유로 걸린다',
      result.proposals.map((entry) => entry.expected),
      result.proposals.map((entry) => entry.actual),
    ),
    expectState(
      '무너진 요청은 하나도 선다고 판정되지 않는다',
      result.proposals.map(() => false),
      result.proposals.map((entry) => entry.fits),
    ),
    expectState('고칠 자리가 경로로 실린다', '$.plan.steps[0].atom', result.proposals[0]?.path),
    expectState('공짜로 빼앗는 원자는 거부된다', 'costless-atom', result.freeAtom),
    expectState('보지 않고 부수는 원자는 공리가 막는다', 'blind-manipulation', result.blindAtom),
    expectState('16종 밖의 이름을 여는 어포던스도 거부된다', 'unknown-action', result.affordance),
  ],
});

/** 경계 — 채울 수 없는 종, 짝 없는 원자, 아직 쓰이지 않은 원자, 축의 양끝. */
export const p0Boundary = defineScenario({
  id: 'p0-boundary',
  module: 'P0',
  kind: 'boundary',
  purpose:
    '아무 원자도 채우지 못하는 종 둘이 예외로 선언돼 있고, 짝 없는 여섯과 아직 쓰이지 않은 둘이 각자의 자리를 대며, 벗어나는 셋만 종을 가리지 않는다.',
  arrange: () => ({ kinds: DEPENDENCY_KINDS, atoms: ACTION_ATOMS }),
  act: ({ kinds, atoms }) => ({
    // ① 채울 수 없는 둘은 갚을 자리를 댄다
    unfillable: UNFILLABLE_KINDS.map((entry) => ({ kind: entry.kind, owedTo: entry.owedTo })),
    fillableCount: kinds.filter((kind) => atomsFilling(kind).length > 0).length,

    // ② 짝 없는 원자 — 뒤집을 동의가 없는 것들
    unpaired: atoms.filter((atom) => atomGrounding(atom)?.counterpart === null),

    // ③ 원문이 아직 쓰지 않은 원자 둘은 갚을 모듈을 댄다
    unused: reconcileAtoms().unusedAtoms.map((atom) => ({ atom, owedTo: UNUSED_ATOM_DEBT[atom] })),

    // ④ 벗어나는 셋만 종을 가리지 않는다
    escapes: atoms.filter((atom) => atomGrounding(atom)?.bearing === 'escape'),
    kindfulEscapes: atoms.filter(
      (atom) =>
        atomGrounding(atom)?.bearing === 'escape' && (atomGrounding(atom)?.kinds.length ?? 0) > 0,
    ),

    // ⑤ 저항할 수 없는 원자 하나 · 되돌릴 수 없는 원자 다섯
    unresistable: atoms.filter(
      (atom) => atomGrounding(atom)?.resistable === false && atomGrounding(atom)?.touches === 'between',
    ),
    irreversible: atoms.filter((atom) => atomGrounding(atom)?.reversible === false),

    // ⑥ 원문 목록의 크기 — 방향 7 · 예시 15
    originalCounts: [P1_DIRECTIONS.length, P2_EXAMPLES.length],
    hunting: atomResolutionOf('사냥')?.atoms ?? [],
  }),
  assert: (result): readonly Assertion[] => [
    expectState(
      '채울 수 없는 둘은 누가 갚는지를 댄다',
      [
        { kind: 'time', owedTo: 'V1 틱 — 갚을 모듈이 아니라 흐름 자체다' },
        { kind: 'rule', owedTo: 'W2 규칙 실체화 — 규칙이 세계 상태가 되는 자리' },
      ],
      result.unfillable,
    ),
    expectState('열한 종 중 아홉은 채우는 원자를 갖는다', 9, result.fillableCount),
    expectState(
      '짝 없는 여섯 — 뒤집을 동의가 없는 것들',
      ['acquire', 'produce', 'investigate', 'adapt', 'substitute', 'shed'],
      result.unpaired,
    ),
    expectState(
      '아직 쓰이지 않은 둘은 R4·E2 에 자리를 예약한다',
      ['investigate', 'betray'],
      result.unused.map((entry) => entry.atom),
    ),
    expectTrue(
      '그 둘 다 갚을 모듈을 댄다',
      result.unused.every((entry) => (entry.owedTo ?? '').length > 0),
      result.unused,
    ),
    expectState('벗어나는 셋만 종을 가리지 않는다', ['adapt', 'substitute', 'shed'], result.escapes),
    expectState('종을 지목하는 벗어남은 하나도 없다', [], result.kindfulEscapes),
    expectState('상대가 끼는 여섯 중 저항할 수 없는 것은 배신 하나다', ['betray'], result.unresistable),
    expectState(
      '되돌릴 수 없는 다섯 — 원한·부서짐·두려움·배신·탈피',
      ['seize', 'destroy', 'coerce', 'betray', 'shed'],
      result.irreversible,
    ),
    expectState('원문이 적은 방향 7 · 예시 15', [7, 15], result.originalCounts),
    expectState('사냥은 세 원자가 이어 붙은 것이다', ['seek', 'destroy', 'acquire'], result.hunting),
  ],
});

export const p0Scenarios = [p0SixteenAtoms, p0BrokenActionsRejected, p0Boundary];
