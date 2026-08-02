// O0 검증 시나리오 3종 — 세계에 무엇이 설 수 있는지를 공리가 정하는가,
// 그리고 공리를 어기는 정의는 정말 걸리는가.

import { stateHash } from '@hkt/core/v1';
import { classify } from '@hkt/core/o1';
import {
  AXIOM_CLAUSES,
  AXIOM_RECONCILIATION,
  AXIOM_SET,
  axiomId,
  axiomOf,
  axiomSetReport,
  axiomSetVerdict,
  definitionVerdict,
  derivationOf,
  derivationReport,
  derivationVerdict,
  enforcementReport,
  enforcementVerdict,
  implementedClauses,
  MIN_DERIVATIONS,
  ORIGINAL_AXIOMS,
  STRONG_EFFECT_THRESHOLD,
  validateDefinition,
  validateDefinitions,
  type Axiom,
  type Definition,
} from '@hkt/core';

import {
  defineScenario,
  expectDeterministic,
  expectState,
  expectTrue,
  type Assertion,
} from '../src/index.ts';

import {
  BROKEN_DEFINITIONS,
  hunterSpecies,
  motherGodSpecies,
  toxinRead,
  veil,
  VEIL_DEFINITIONS,
} from './o0-veil-definitions.ts';

/** 정상 — 원문 세 목록이 공리 8개로 서고, 그 위에 정의 일곱이 선다. */
export const o0AxiomsStand = defineScenario({
  id: 'o0-definitions-stand',
  module: 'O0',
  kind: 'normal',
  purpose:
    '원문 16문장이 공리 8개로 해소되고, 그 공리 위에 능력 셋과 종 넷이 서며, 선언된 관문이 실제로 막는다.',
  arrange: () => ({ definitions: VEIL_DEFINITIONS, axioms: AXIOM_SET }),
  act: ({ definitions, axioms }) => {
    const set = axiomSetReport(axioms);
    const gate = validateDefinitions(definitions, axioms);
    const enforcement = enforcementReport(axioms);
    const derivation = derivationReport(definitions, axioms);

    return {
      set,
      setVerdict: axiomSetVerdict(set),
      accepted: gate.accepted.map((definition) => definition.name),
      rejected: gate.violations.map((violation) => `${violation.definitionName} ${violation.rule}`),
      // 정의는 새 타입이 아니다 — 전부 온전한 O1 Rule 이어야 한다.
      asRules: definitions.map((definition) => classify(definition).kind),
      enforcedClauses: enforcement.enforced,
      deferredClauses: enforcement.deferred,
      probes: enforcement.results.map((result) => `${result.probe} ${result.held ? '막음' : '뚫림'}`),
      gatesOutsideO0: enforcement.results.filter((result) => !result.gate.startsWith('O0.')).length,
      enforcementComplete: enforcement.complete,
      derivationComplete: derivation.complete,
      derivedPerClause: derivation.byClause
        .filter((entry) => entry.required)
        .map((entry) => `${entry.clause}:${String(entry.derived.length)}`),
      divinity: derivationOf(derivation, 'emergent-divinity')?.derived.map(
        (entry) => entry.definitionName,
      ),
      // O0 → O2 는 말이 아니라 자리로 이어진다.
      veilCost: veil.costs.map((cost) => `${cost.domain}.${cost.path}`),
      motherSlots: motherGodSpecies.slots.filter((slot) => slot.domain === 'transcendent').length,
    };
  },
  assert: (result): Assertion[] => [
    expectState('원문 16문장이 공리 8개로 해소된다', 16, ORIGINAL_AXIOMS.length),
    expectTrue('해소되지 않은 원문 문장도, 근거 없는 공리도 없다', result.set.complete, result.setVerdict),
    expectState('공리 조항은 여덟이다', AXIOM_CLAUSES.length, result.set.clauses.length),
    expectState('정의 일곱이 전부 선다', [...VEIL_DEFINITIONS].map((d) => d.name), result.accepted),
    expectState('걸린 정의가 하나도 없다', [], result.rejected),
    expectState(
      '정의는 새 타입이 아니다 — 전부 온전한 O1 Rule 이다',
      VEIL_DEFINITIONS.map(() => 'Rule'),
      result.asRules,
    ),
    expectState(
      '공리 여섯이 지금 실제로 막고 있다',
      [
        'psychic-life',
        'verifiable-cost',
        'observable-trace',
        'emergent-divinity',
        'state-exclusion',
        'caused-persistence',
      ],
      [...result.enforcedClauses],
    ),
    expectState(
      '아직 못 막는 둘은 갚을 모듈과 함께 남는다',
      ['observed-manipulation', 'stability-resistance'],
      [...result.deferredClauses],
    ),
    expectTrue(
      '선언된 관문이 하나도 빠짐없이 실제로 막는다',
      result.probes.every((probe) => probe.endsWith('막음')),
      result.probes,
    ),
    expectTrue(
      'O0 밖의 관문이 여섯 곳 — O1·O2 는 공리가 값으로 서기 전부터 그것을 강제하고 있었다',
      result.gatesOutsideO0 === 6,
      result.gatesOutsideO0,
    ),
    expectTrue('강제 대조가 완결이다', result.enforcementComplete),
    expectState(
      '정의 층위 공리 넷이 각각 둘 이상을 낳는다',
      ['psychic-life:4', 'verifiable-cost:2', 'observable-trace:3', 'emergent-divinity:2'],
      result.derivedPerClause,
    ),
    expectState(
      '같은 공리에서 서로 다른 두 신이 나온다 — 유래가 다르면 다른 신이다',
      ['붉은 장막의 어미', '길 위의 이름 없는 신'],
      result.divinity,
    ),
    expectTrue('도출 대조가 완결이다', result.derivationComplete),
    expectState('대능력의 대가는 O2 의 실제 자리를 깎는다', ['psychic.energy'], result.veilCost),
    expectTrue('신은 초월 영역에 자리를 갖는다', result.motherSlots >= 1, result.motherSlots),
    expectDeterministic('같은 정의 목록이면 같은 판정', () =>
      stateHash(validateDefinitions(VEIL_DEFINITIONS).violations),
    ),
    expectDeterministic('프로브는 순수하다 — 같은 관문에서 같은 결과', () =>
      stateHash(enforcementReport().results),
    ),
  ],
});

/** 실패 — 공리를 어긴 정의는 세계에 들어가지 못하고, 어디가 왜 틀렸는지가 함께 나온다. */
export const o0ViolationsRejected = defineScenario({
  id: 'o0-violations-rejected',
  module: 'O0',
  kind: 'failure',
  purpose:
    'O1 로서는 온전한 규칙도 공리를 어기면 거부되고, 공리를 빼면 그 정의가 그대로 통과한다 — 공리가 곧 관문이다.',
  arrange: () => ({ good: VEIL_DEFINITIONS, bad: BROKEN_DEFINITIONS }),
  act: ({ good, bad }) => {
    const gate = validateDefinitions([...good, ...bad.map((entry) => entry.value)]);

    // 흔적 공리를 빼면 흔적 없는 능력이 그대로 통과한다 — 막는 것은 공리 자신이다.
    const withoutTrace: readonly Axiom[] = AXIOM_SET.filter(
      (axiom) => axiom.clause !== 'observable-trace',
    );
    const traceless = bad.find((entry) => entry.expected === 'traceless-ability') as {
      readonly value: Definition;
    };
    // 흔적 공리를 빼는 실험이므로 근거는 다른 공리로 옮겨 둔다 —
    // 그러지 않으면 "공리가 사라졌다" 가 아니라 "없는 공리를 근거로 들었다" 가 걸린다.
    const neutral: Definition = {
      ...traceless.value,
      axiomId: axiomId('verifiable-cost'),
      supportIds: [],
    };

    return {
      rejected: bad.map((entry) => ({
        broke: entry.broke,
        expected: entry.expected,
        actual: validateDefinition(entry.value)[0]?.rule ?? '(통과해 버렸다)',
      })),
      // 결함 정의 중 몇이 O1 을 통과하는가 — O0 가 없으면 그대로 세계에 들어갔을 정의들이다.
      o1Verdicts: bad.map((entry) => classify(entry.value).kind),
      caughtOnlyByO0: bad.filter((entry) => classify(entry.value).kind === 'Rule').length,
      standing: gate.accepted.length,
      blocked: gate.rejected.length,
      wheres: gate.violations.map((violation) => violation.path),
      verdict: definitionVerdict(gate),
      // 공리를 빼면 관문도 사라진다
      tracelessWithAxiom: validateDefinition(neutral).map((violation) => violation.rule),
      tracelessWithoutAxiom: validateDefinition(neutral, withoutTrace).map(
        (violation) => violation.rule,
      ),
      // 어긴 정의는 도출로도 세지 않는다
      derivationRejected: derivationReport([...good, traceless.value]).rejected,
      // 선언과 실제가 어긋나면 강제 대조가 무너진다
      lyingComplete: enforcementReport(
        AXIOM_SET.map((axiom) =>
          axiom.clause === 'state-exclusion'
            ? { ...axiom, enforcedBy: [{ gate: 'O2.assembleWorld', probe: '없는프로브', note: '' }] }
            : axiom,
        ),
      ).missingProbes,
    };
  },
  assert: (result): Assertion[] => [
    expectState(
      '결함 정의 14종이 각자의 사유로 걸린다',
      result.rejected.map((entry) => `${entry.broke} → ${entry.expected}`),
      result.rejected.map((entry) => `${entry.broke} → ${entry.actual}`),
    ),
    expectState(
      '열넷 중 열셋은 O1 로서 온전한 Rule 이다 — 무너진 규칙 하나만 O1 이 먼저 막는다',
      13,
      result.caughtOnlyByO0,
    ),
    expectState('공리 위에 선 것만 남는다', VEIL_DEFINITIONS.length, result.standing),
    expectState('결함 정의는 하나도 들어가지 못한다', BROKEN_DEFINITIONS.length, result.blocked),
    expectTrue(
      '거부 사유는 고칠 자리를 그대로 가리킨다',
      result.wheres.every((where) => where.startsWith('$.')),
      result.wheres,
    ),
    expectTrue('판정 문장이 무엇에 걸렸는지 말해 준다', result.verdict.includes('막혔다'), result.verdict),
    expectState(
      '흔적 공리가 있으면 흔적 없는 능력은 걸린다',
      ['traceless-ability'],
      result.tracelessWithAxiom,
    ),
    expectState(
      '그 공리를 빼면 같은 정의가 그대로 통과한다 — 막는 것은 코드가 아니라 공리다',
      [],
      result.tracelessWithoutAxiom,
    ),
    expectState(
      '어긴 정의는 도출로도 세지 않는다',
      ['자국 없는 감별'],
      [...result.derivationRejected],
    ),
    expectState(
      '없는 프로브를 선언하면 강제 대조가 그 자리를 지목한다',
      ['state-exclusion→없는프로브'],
      [...result.lyingComplete],
    ),
  ],
});

/** 경계 — 임계 그 자체 · 빈 목록 · 유예된 공리 · 검사기 없는 조항에서도 판정이 흔들리지 않는다. */
export const o0Boundary = defineScenario({
  id: 'o0-boundary',
  module: 'O0',
  kind: 'boundary',
  purpose: '강도 임계 · 빈 정의 목록 · 유예된 공리 · 검사기 없는 조항의 끝에서도 판정이 흔들리지 않는다.',
  arrange: () => ({ threshold: STRONG_EFFECT_THRESHOLD }),
  act: ({ threshold }) => {
    const passes = (definition: Definition): boolean => validateDefinition(definition).length === 0;

    return {
      // 임계 그 자체는 강하지 않다 — 넘어야 대가를 요구한다.
      atThreshold: passes({ ...veil, strength: threshold, costs: [] }),
      justOver: passes({ ...veil, strength: threshold + Number.EPSILON * 4, costs: [] }),
      atZero: passes({ ...veil, strength: 0, costs: [] }),
      atOne: passes({ ...veil, strength: 1, costs: [{ domain: 'psychic', path: 'energy', amount: 1 }] }),
      // 흔적은 매개 자리로도 실제 경로로도 적힌다.
      paramTrace: passes(veil),
      // 자리를 하나도 갖지 않은 종 — 살아 있으면 걸리고, 아니면 선다.
      livingWithoutSlots: passes({ ...hunterSpecies, slots: [] }),
      lifelessWithoutSlots: passes({
        ...hunterSpecies,
        subjectKind: 'organization',
        alive: false,
        slots: [],
      }),
      // 빈 목록들
      emptyGate: validateDefinitions([]).complete,
      emptyDerivation: derivationReport([]).complete,
      emptySet: axiomSetReport([], ORIGINAL_AXIOMS, AXIOM_RECONCILIATION).complete,
      emptyEnforcement: enforcementReport([]).complete,
      // 정의 층위 검사기가 붙지 않은 조항 넷 — 정의를 아무리 넣어도 여기서는 아무 말도 하지 않는다.
      clausesWithChecker: implementedClauses(),
      clausesWithoutChecker: AXIOM_CLAUSES.filter(
        (clause) => !implementedClauses().includes(clause),
      ),
      appliesToEmpty: AXIOM_SET.filter((axiom) => axiom.appliesTo.length === 0).map(
        (axiom) => axiom.clause,
      ),
      // 유예된 공리는 사라지지 않는다 — 갚을 모듈이 적혀 있다.
      deferredNotes: enforcementReport()
        .deferred.map((clause) => axiomOf(clause)?.deferredTo ?? '')
        .map((note) => note.slice(0, 2)),
      // 근거를 스스로 가리키는 공리는 없다 — 공리의 근거는 자기 자신(null)이다.
      selfGrounded: AXIOM_SET.every((axiom) => axiom.axiomId === null),
      // 도출 하한
      minDerivations: MIN_DERIVATIONS,
      soloClause: derivationReport([toxinRead, hunterSpecies, motherGodSpecies]).monotone,
      // 같은 공리를 두 번 근거로 들어도 도출은 정의 수를 넘지 않는다.
      doubleCited: derivationReport([
        { ...toxinRead, supportIds: [axiomId('observable-trace')] },
        veil,
      ]).byClause.find((entry) => entry.clause === 'observable-trace')?.diverse,
    };
  },
  assert: (result): Assertion[] => [
    expectState('임계 그 자체는 강하지 않다 — 넘어야 대가를 요구한다', [true, false], [
      result.atThreshold,
      result.justOver,
    ]),
    expectState('강도 양끝도 자리로서는 온전하다', [true, true], [result.atZero, result.atOne]),
    expectTrue('흔적은 매개 자리(trace.{rule})에 자기 규칙 ID 로 적힌다', result.paramTrace),
    expectState('살아 있으면 자리 없이 설 수 없고, 생명이 아니면 설 수 있다', [false, true], [
      result.livingWithoutSlots,
      result.lifelessWithoutSlots,
    ]),
    expectState('빈 목록은 어느 대조에서도 완결이 아니다 — 아무것도 확인하지 않은 것이다', [
      false,
      false,
      false,
      false,
    ], [result.emptyGate, result.emptyDerivation, result.emptySet, result.emptyEnforcement]),
    expectState(
      '정의 층위 검사기는 네 조항에만 붙는다',
      ['psychic-life', 'verifiable-cost', 'observable-trace', 'emergent-divinity'],
      [...result.clausesWithChecker],
    ),
    expectState(
      '나머지 네 조항은 정의가 아니라 다른 층위에서 걸린다',
      [...result.clausesWithoutChecker],
      [...result.appliesToEmpty],
    ),
    expectState('유예된 공리는 갚을 모듈을 적어 둔다', ['R3', 'W2'], result.deferredNotes),
    expectTrue('공리의 근거는 자기 자신이다 — 공리를 낳는 공리는 없다', result.selfGrounded),
    expectState('도출 하한은 둘이다', 2, result.minDerivations),
    expectState(
      '하한에 못 미친 공리는 단조로 남는다',
      ['observable-trace', 'emergent-divinity'],
      [...result.soloClause],
    ),
    expectTrue('같은 공리를 대표·지원으로 겹쳐 들어도 도출은 정의 수로 센다', result.doubleCited === true),
    expectDeterministic('같은 공리 집합이면 같은 판정', () => stateHash(axiomSetReport())),
    expectDeterministic('같은 정의면 같은 도출 대조', () =>
      stateHash(derivationReport(VEIL_DEFINITIONS).byClause),
    ),
  ],
});

export const o0Scenarios = [o0AxiomsStand, o0ViolationsRejected, o0Boundary] as const;
