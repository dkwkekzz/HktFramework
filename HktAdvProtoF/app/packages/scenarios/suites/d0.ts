// D0 검증 시나리오 3종 — 열한 칸이 정말 세계에 걸리는가, 그리고 종을 가르는 것이 무엇인가.

import { stateHash } from '@hkt/core/v1';
import { STATE_DOMAINS } from '@hkt/core/o1';
import {
  checkDependencyTarget,
  checkGroundings,
  DEPENDENCY_KIND_SPECS,
  fitTarget,
  groundingVerdict,
  KIND_GROUNDINGS,
  kindGrounding,
  kindReconciliationVerdict,
  kindsAccepting,
  NODE_KIND_NAMES,
  reconcileKinds,
} from '@hkt/core/d0';

import {
  defineScenario,
  expectDeterministic,
  expectState,
  expectTrue,
  type Assertion,
} from '../src/index.ts';

import {
  altarVow,
  BROKEN_CASES,
  BROKEN_GROUNDINGS,
  DEPENDENCY_CASES,
  passageLaw,
  TARGET_CASES,
  veilLifted,
} from './d0-veil-targets.ts';

/** 정상 — 굶주림 하나 앞의 열 가지가 갈리고, 규칙 하나가 세 종으로 선다. */
export const d0OneRuleThreeKinds = defineScenario({
  id: 'd0-one-rule-three-kinds',
  module: 'D0',
  kind: 'normal',
  purpose:
    '원문 두 목록이 11종으로 해소되고, 열한 종이 9영역을 남김없이 읽고, 같은 고개 통행법 하나가 기대는 방식에 따라 제도·규칙·의례 셋으로 선다.',
  arrange: () => ({ targets: TARGET_CASES, dependencies: DEPENDENCY_CASES }),
  act: ({ targets, dependencies }) => {
    const reconciliation = reconcileKinds();
    const grounding = checkGroundings();

    return {
      // ① 원문 두 목록이 하나로 좁혀진다
      kinds: reconciliation.kinds,
      unresolved: reconciliation.unresolved,
      d0Only: reconciliation.d0Only,
      reconciliationVerdict: kindReconciliationVerdict(reconciliation),

      // ② 열한 종이 전부 읽을 자리를 댄다 — 시간만 틱을 읽는다
      uncoveredDomains: grounding.uncoveredDomains,
      clockReaders: KIND_GROUNDINGS.filter((entry) => entry.readsClock).map((e) => e.kind),
      groundingVerdict: groundingVerdict(grounding),

      // ③ 굶주림 하나 앞의 열 가지가 서로 다른 종으로 갈린다
      byTarget: targets.map((entry) => ({
        label: entry.label,
        kinds: kindsAccepting(entry.element),
      })),

      // ④ 같은 규칙 하나가 세 종으로 선다 — 대상이 아니라 기대는 방식이 종을 가른다
      lawKinds: kindsAccepting(passageLaw),
      lawFits: (['institution', 'rule', 'ritual'] as const).map(
        (kind) => fitTarget(kind, passageLaw).fits,
      ),
      vowKinds: kindsAccepting(altarVow),

      // ⑤ 실제 선언들이 관문을 지난다
      declared: dependencies.map((entry) => ({
        label: entry.label,
        violations: checkDependencyTarget(entry.dependency, entry.target).length,
      })),
    };
  },
  assert: (result): readonly Assertion[] => [
    expectState('확정 11종이 선다', 11, result.kinds.length),
    expectState('원문 D1 의 9개가 하나도 남지 않는다', [], result.unresolved),
    expectState('D0 목록에만 있는 종은 시간 하나다', ['time'], result.d0Only),
    expectState('9영역이 하나도 남김없이 읽힌다', [], result.uncoveredDomains),
    expectState('틱을 읽는 종은 시간뿐이다', ['time'], result.clockReaders),
    expectState(
      '굶주림 앞의 열 가지가 각자의 종으로 갈린다',
      [
        { label: '말린 고기', kinds: ['resource'] },
        { label: '붉은 장막 협곡', kinds: ['space'] },
        { label: '협곡 바닥의 온기', kinds: ['environment'] },
        { label: '제 몸의 허기', kinds: ['body'] },
        { label: '붉은 장막의 어미', kinds: ['subject'] },
        { label: '행상의 신뢰', kinds: ['relationship'] },
        { label: '마비독을 아는 것', kinds: ['information'] },
        { label: '고개 통행법', kinds: ['institution', 'rule', 'ritual'] },
        { label: '제단 서약', kinds: ['relationship', 'ritual'] },
        { label: '장막이 걷혔다(사건)', kinds: [] },
      ],
      result.byTarget,
    ),
    expectState('같은 법 하나가 세 종으로 선다', ['institution', 'rule', 'ritual'], result.lawKinds),
    expectState('셋 다 실제로 통과한다', [true, true, true], result.lawFits),
    expectState('약속 하나는 관계로도 의례로도 걸린다', ['relationship', 'ritual'], result.vowKinds),
    expectState(
      '몰이꾼이 선언한 넷이 모두 관문을 지난다',
      [0, 0, 0, 0],
      result.declared.map((entry) => entry.violations),
    ),
    expectTrue(
      '판정 두 줄이 무엇이 해소됐고 무엇이 걸렸는지 말한다',
      result.reconciliationVerdict.includes('11종으로 해소') &&
        result.groundingVerdict.includes('열한 종이 전부 세계에 걸린다'),
      [result.reconciliationVerdict, result.groundingVerdict],
    ),
    expectDeterministic('같은 분류를 100번 물어도 같은 답이다', () =>
      stateHash([reconcileKinds(), checkGroundings(), kindsAccepting(passageLaw)]),
    ),
  ],
});

/** 실패 — 설 수 없는 걸림과 어긋난 선언이 각자의 사유로 거부된다. */
export const d0BrokenKindsRejected = defineScenario({
  id: 'd0-broken-kinds-rejected',
  module: 'D0',
  kind: 'failure',
  purpose:
    '읽을 자리 없는 종·아무도 기대지 않는 영역·선언과 어긋난 대상이 각각 자기 사유와 경로로 거부되고, 어긋난 선언은 무엇으로 적어야 하는지까지 말한다.',
  arrange: () => ({ groundings: BROKEN_GROUNDINGS, declarations: BROKEN_CASES }),
  act: ({ groundings, declarations }) => ({
    groundings: groundings.map((entry) => {
      const report = checkGroundings(entry.patch(KIND_GROUNDINGS));
      return {
        broke: entry.broke,
        expected: entry.expected,
        actual: report.violations[0]?.rule ?? '(통과해 버렸다)',
        complete: report.complete,
      };
    }),
    declarations: declarations.map((entry) => {
      const fit = fitTarget(entry.kind, entry.target, '$.graph.nodes[0]');
      return {
        broke: entry.broke,
        expected: entry.expected,
        actual: fit.violations[0]?.rule ?? '(통과해 버렸다)',
        fits: fit.fits,
        path: fit.violations[0]?.path ?? '',
        accepting: fit.accepting,
      };
    }),
  }),
  assert: (result): readonly Assertion[] => [
    expectState(
      '무너진 걸림 아홉이 전부 예상한 사유로 걸린다',
      result.groundings.map((entry) => entry.expected),
      result.groundings.map((entry) => entry.actual),
    ),
    expectState(
      '무너진 걸림은 하나도 온전하다고 판정되지 않는다',
      result.groundings.map(() => false),
      result.groundings.map((entry) => entry.complete),
    ),
    expectState(
      '어긋난 선언 아홉이 전부 예상한 사유로 걸린다',
      result.declarations.map((entry) => entry.expected),
      result.declarations.map((entry) => entry.actual),
    ),
    expectState(
      '어긋난 선언은 하나도 맞다고 판정되지 않는다',
      result.declarations.map(() => false),
      result.declarations.map((entry) => entry.fits),
    ),
    expectState(
      '고칠 자리가 경로로 실린다',
      '$.graph.nodes[0].targetId',
      result.declarations[0]?.path,
    ),
    expectState(
      '장소를 자원이라 적으면 공간으로 적으라고 말한다',
      ['space'],
      result.declarations[0]?.accepting,
    ),
    expectDeterministic('거부 사유는 반복해도 같다', () =>
      stateHash(BROKEN_CASES.map((entry) => fitTarget(entry.kind, entry.target).violations)),
    ),
  ],
});

/** 경계 — 대상 없는 종, 아무 종도 받지 않는 원소, 대조표의 양끝. */
export const d0Boundary = defineScenario({
  id: 'd0-boundary',
  module: 'D0',
  kind: 'boundary',
  purpose:
    '가리킬 대상이 없는 종은 시간 하나뿐이고, 어느 종도 받지 않는 원소가 있으며, 원문 목록과 확정 목록의 개수가 어긋나지 않는다.',
  arrange: () => ({ empty: [] as const }),
  act: () => {
    const reconciliation = reconcileKinds();
    const time = kindGrounding('time');
    return {
      // 양끝 — 원문 9 vs 확정 11, 갈림 하나가 그 차이의 전부는 아니다(시간이 더 있다)
      originalCount: NODE_KIND_NAMES.length,
      settledCount: DEPENDENCY_KIND_SPECS.length,
      splitGain: reconciliation.kinds.length - NODE_KIND_NAMES.length,
      domainCount: STATE_DOMAINS.length,

      // 대상이 없는 종 — 시간 하나
      timeTargets: time?.targetKinds ?? null,
      timeReadsClock: time?.readsClock ?? null,
      timeWithTarget: fitTarget('time', passageLaw).fits,
      timeWithoutTarget: fitTarget('time', null).fits,

      // 어느 종도 받지 않는 원소 — 사건은 기댈 대상이 아니다
      eventKinds: kindsAccepting(veilLifted),

      // 종류로만 걸리는 것과 그 대상이어야 하는 것의 갈림
      anonymousOk: fitTarget('resource', null).fits,
      namedNeedsTarget: fitTarget('subject', null).fits,

      // 빈 분류는 종이 없다고 말한다
      emptyVerdict: kindReconciliationVerdict(reconcileKinds([], [], [])),
    };
  },
  assert: (result): readonly Assertion[] => [
    expectState('원문 D1 은 9개를 적었다', 9, result.originalCount),
    expectState('확정은 11종이다', 11, result.settledCount),
    expectState('갈림 하나와 D0 전용 하나가 그 차이 둘이다', 2, result.splitGain),
    expectState('세계의 영역은 9개 그대로다', 9, result.domainCount),
    expectState('시간은 가리킬 대상이 없다', [], result.timeTargets),
    expectState('시간만 틱을 읽는다', true, result.timeReadsClock),
    expectState('시간에 대상을 달면 서지 않는다', false, result.timeWithTarget),
    expectState('시간은 대상 없이 선다', true, result.timeWithoutTarget),
    expectState('사건은 어느 종도 받지 않는다', [], result.eventKinds),
    expectState('종류로만 걸리는 종은 대상 없이 선다', true, result.anonymousOk),
    expectState('그 대상이어야 하는 종은 대상 없이 서지 못한다', false, result.namedNeedsTarget),
    expectTrue('빈 분류는 종이 없다고 말한다', result.emptyVerdict.includes('확정 종이 없다'), result.emptyVerdict),
  ],
});

export const d0Scenarios = [d0OneRuleThreeKinds, d0BrokenKindsRejected, d0Boundary];
