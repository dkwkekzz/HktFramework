// O0-c 강제 지점 프로브 — 공리가 지금 정말로 막고 있는지 실행해서 확인한다.
//
// 공리를 값으로 적어 두는 것만으로는 아무 일도 일어나지 않는다. O0-a 는 공리마다
// "어느 관문이 막는가"(`Axiom.enforcedBy`)를 **선언**했을 뿐이고, 선언은 검사되지 않으면
// 곧 거짓말이 된다. 그래서 선언된 관문마다 프로브를 하나씩 붙인다 —
// 공리를 어기는 값을 실제로 그 관문에 넣어 보고, 거부가 나오는지 본다.
//
// 프로브는 O0 밖의 관문도 겨눈다. O1 이 어포던스 비용 0 을 막고, 현상에 원인을 요구하고,
// O2 가 같은 자리의 두 번째 값을 막는 것은 전부 **공리를 강제하고 있었던 것**이다 —
// 그때는 공리가 값으로 서 있지 않았을 뿐이다. O0 는 그 사실을 되짚어 표로 세운다.
//
// 아직 아무도 막지 못하는 공리(관측·안정도)는 사라지지 않는다. 갚을 모듈과 함께 남아,
// R3·W2 가 설 때 프로브가 붙어야 할 자리를 가리킨다.

import { deterministicId } from '../v1/id.ts';
import { classify } from '../o1/index.ts';
import { assembleWorld, slotStateId } from '../o2/world.ts';
import { fieldsOf, STATE_SCHEMA } from '../o2/schema.ts';
import { AXIOM_SET, type Axiom, type AxiomClause } from './axiom.ts';
import {
  hasSlot,
  validateDefinition,
  type AbilityDefinition,
  type SpeciesDefinition,
} from './definition.ts';

/** 프로브 한 번의 결과. */
export interface ProbeOutcome {
  /** 공리가 지켜졌는가 */
  readonly held: boolean;
  /** 실제로 무엇이 돌아왔는가 — 어긋났을 때 눈으로 고칠 수 있어야 한다 */
  readonly observed: string;
}

/** 관문 하나를 겨누는 프로브. */
export interface Probe {
  readonly id: string;
  /** 무엇을 넣는가 */
  readonly given: string;
  /** 무엇이 일어나야 하는가 */
  readonly expects: string;
  readonly run: () => ProbeOutcome;
}

const probeSubjectId = deterministicId('subject', 'person', '프로브 대상');
const probePlaceId = deterministicId('entity', 'place', '프로브 장소');
const probeRuleId = deterministicId('rule', 'ability', '프로브 능력');

/** 프로브가 쓰는 결함 능력 — 흔적도 대가도 없는 대능력. */
const brokenAbility: AbilityDefinition = {
  kind: 'Rule',
  id: probeRuleId,
  definitionKind: 'ability',
  domain: 'psychic',
  name: '프로브 능력',
  when: ['프로브가 돈다'],
  then: ['세계가 크게 바뀐다'],
  axiomId: null,
  supportIds: [],
  strength: 0.9,
  costs: [],
  traces: [],
};

/** 프로브가 쓰는 결함 종 — 의념도 유래도 없는 것. */
const brokenSpecies: SpeciesDefinition = {
  kind: 'Rule',
  id: deterministicId('rule', 'species', '프로브 종'),
  definitionKind: 'species',
  domain: 'biological',
  name: '프로브 종',
  when: ['프로브가 돈다'],
  then: ['종이 하나 선다'],
  axiomId: null,
  supportIds: [],
  subjectKind: 'person',
  alive: true,
  slots: [{ domain: 'biological', path: 'hunger' }],
  originId: null,
};

/** 정의가 그 사유로 거부되는가. */
function rejects(definition: Parameters<typeof validateDefinition>[0], rule: string): ProbeOutcome {
  const found = validateDefinition({ ...definition, axiomId: null }).filter(
    (violation) => violation.rule !== 'ungrounded-definition',
  );
  const held = found.some((violation) => violation.rule === rule);
  return {
    held,
    observed: found.length === 0 ? '(아무것도 걸리지 않았다)' : found.map((v) => v.rule).join(', '),
  };
}

/** 존재론이 그 값을 거부하는가. */
function rejectsOntic(value: unknown, path: string): ProbeOutcome {
  const result = classify(value);
  const held = result.kind === null && result.violations.some((violation) => violation.path === path);
  return {
    held,
    observed:
      result.kind !== null
        ? `(통과해 버렸다 — ${result.kind})`
        : result.violations.map((violation) => `${violation.path} ${violation.message}`).join(' · '),
  };
}

/** 프로브 표 — 공리의 `enforcedBy.probe` 가 이 키를 가리킨다. */
const PROBES: readonly Probe[] = [
  {
    id: 'o0-psychic-life',
    given: '의념 자리 없이 살아 있는 종 정의',
    expects: 'mindless-life 로 거부',
    run: () => rejects(brokenSpecies, 'mindless-life'),
  },
  {
    id: 'o0-verifiable-cost',
    given: '강도 0.9 인데 아무것도 치르지 않는 능력 정의',
    expects: 'free-strong-effect 로 거부',
    run: () => rejects(brokenAbility, 'free-strong-effect'),
  },
  {
    id: 'o0-observable-trace',
    given: '흔적을 남기지 않는 능력 정의',
    expects: 'traceless-ability 로 거부',
    run: () => rejects(brokenAbility, 'traceless-ability'),
  },
  {
    id: 'o0-emergent-divinity',
    given: '유래 없는 신 정의',
    expects: 'ungrounded-god 로 거부',
    run: () =>
      rejects(
        {
          ...brokenSpecies,
          subjectKind: 'god',
          slots: [
            { domain: 'psychic', path: 'energy' },
            { domain: 'transcendent', path: 'anchor' },
          ],
        },
        'ungrounded-god',
      ),
  },
  {
    id: 'o1-affordance-cost',
    given: '비용 0 인 어포던스',
    expects: 'O1 이 $.cost 로 거부',
    run: () =>
      rejectsOntic(
        {
          kind: 'Affordance',
          id: deterministicId('affordance', '프로브 공짜 행동'),
          providerId: probePlaceId,
          action: 'gather',
          requires: [],
          yields: ['약초'],
          cost: 0,
        },
        '$.cost',
      ),
  },
  {
    id: 'o1-causeless-phenomenon',
    given: '원인 사건 없는 현상',
    expects: 'O1 이 $.causeEventId 로 거부',
    run: () =>
      rejectsOntic(
        {
          kind: 'Phenomenon',
          id: deterministicId('phenomenon', '프로브 잔향'),
          channel: 'psychic',
          causeEventId: null,
          placeId: probePlaceId,
          intensity: 0.5,
          decaysAtTick: null,
        },
        '$.causeEventId',
      ),
  },
  {
    id: 'o1-changeless-event',
    given: '아무 상태도 바꾸지 않는 사건',
    expects: 'O1 이 $.changedStateIds 로 거부',
    run: () =>
      rejectsOntic(
        {
          kind: 'Event',
          id: deterministicId('event', '프로브 사건'),
          tick: 0,
          name: '아무 일도 일어나지 않았다',
          actorId: probeSubjectId,
          changedStateIds: [],
          causeIds: [],
        },
        '$.changedStateIds',
      ),
  },
  {
    id: 'o2-duplicate-state',
    given: '같은 자리(biological.hunger)에 값 둘',
    expects: 'O2 조립이 duplicate-state 로 뒤를 막는다',
    run: () => {
      const id = slotStateId('biological', probeSubjectId, 'hunger');
      const state = {
        kind: 'State' as const,
        id,
        domain: 'biological' as const,
        ofId: probeSubjectId,
        path: 'hunger',
        value: 0.7,
      };
      const assembled = assembleWorld([state, { ...state, value: 0.1 }]);
      const rules = assembled.violations.map((violation) => violation.rule);
      return {
        held: rules.includes('duplicate-state') && assembled.accepted.length === 1,
        observed:
          rules.length === 0
            ? `(둘 다 들어갔다 — 자리 ${String(assembled.accepted.length)}개)`
            : rules.join(', '),
      };
    },
  },
  {
    id: 'o2-trace-slot',
    given: 'O2 스키마에서 능력 흔적의 자리를 찾는다',
    expects: 'psychic.trace.{rule} 이 실재한다',
    run: () => {
      const held = hasSlot(STATE_SCHEMA, 'psychic', 'trace.{rule}');
      return { held, observed: held ? 'psychic.trace.{rule}' : '(자리가 없다)' };
    },
  },
  {
    id: 'o2-transcendent-slot',
    given: 'O2 스키마에서 신이 걸릴 자리를 찾는다',
    expects: 'transcendent 영역에 앵커·숭배량이 실재한다',
    run: () => {
      const paths = fieldsOf(STATE_SCHEMA, 'transcendent').map((field) => field.path);
      const held = paths.includes('anchor') && paths.includes('worship');
      return { held, observed: paths.length === 0 ? '(빈 영역이다)' : paths.join(' ') };
    },
  },
];

/** 프로브 하나를 id 로 찾는다. */
export function probeOf(id: string): Probe | null {
  return PROBES.find((probe) => probe.id === id) ?? null;
}

/** 프로브 실행 결과 한 줄 — 어느 공리의 어느 관문이 무엇을 막았는가. */
export interface ProbeResult {
  readonly clause: AxiomClause;
  readonly gate: string;
  readonly probe: string;
  readonly given: string;
  readonly expects: string;
  readonly observed: string;
  readonly held: boolean;
}

/** 공리별 강제 상태. */
export interface ClauseEnforcement {
  readonly clause: AxiomClause;
  /** 이 공리를 막는 관문 수 */
  readonly gates: number;
  /** 전부 실제로 막았는가 */
  readonly enforced: boolean;
  /** 아직 못 막으면 갚을 모듈. 막고 있으면 null */
  readonly deferredTo: string | null;
}

/** 공리 집합이 지금 세계에서 실제로 강제되고 있는가. */
export interface EnforcementReport {
  readonly results: readonly ProbeResult[];
  readonly clauses: readonly ClauseEnforcement[];
  /** 선언은 됐는데 프로브가 없는 강제 지점 (`조항→프로브id`) */
  readonly missingProbes: readonly string[];
  /** 실행했는데 막지 못한 관문 (`조항→관문`) */
  readonly brokenGates: readonly string[];
  /** 지금 실제로 강제되는 공리 */
  readonly enforced: readonly AxiomClause[];
  /** 아직 강제되지 않고 뒤로 미뤄진 공리 */
  readonly deferred: readonly AxiomClause[];
  /** 어느 공리도 가리키지 않는 프로브 — 죽은 프로브다 */
  readonly orphanProbes: readonly string[];
  readonly complete: boolean;
}

/** 선언된 강제 지점을 전부 실행한다. 던지지 않는다 — 어긋남은 값으로 남는다. */
export function enforcementReport(axioms: readonly Axiom[] = AXIOM_SET): EnforcementReport {
  const results: ProbeResult[] = [];
  const clauses: ClauseEnforcement[] = [];
  const missingProbes: string[] = [];
  const brokenGates: string[] = [];
  const claimed = new Set<string>();

  for (const axiom of axioms) {
    let allHeld = axiom.enforcedBy.length > 0;
    for (const point of axiom.enforcedBy) {
      claimed.add(point.probe);
      const probe = probeOf(point.probe);
      if (probe === null) {
        missingProbes.push(`${axiom.clause}→${point.probe}`);
        allHeld = false;
        continue;
      }
      const outcome = probe.run();
      results.push({
        clause: axiom.clause,
        gate: point.gate,
        probe: probe.id,
        given: probe.given,
        expects: probe.expects,
        observed: outcome.observed,
        held: outcome.held,
      });
      if (!outcome.held) {
        brokenGates.push(`${axiom.clause}→${point.gate}`);
        allHeld = false;
      }
    }
    clauses.push({
      clause: axiom.clause,
      gates: axiom.enforcedBy.length,
      enforced: allHeld,
      deferredTo: allHeld ? null : axiom.deferredTo,
    });
  }

  const orphanProbes = PROBES.filter((probe) => !claimed.has(probe.id)).map((probe) => probe.id);
  const enforced = clauses.filter((entry) => entry.enforced).map((entry) => entry.clause);
  const deferred = clauses
    .filter((entry) => !entry.enforced && entry.deferredTo !== null)
    .map((entry) => entry.clause);

  return {
    results,
    clauses,
    missingProbes,
    brokenGates,
    enforced,
    deferred,
    orphanProbes,
    complete:
      axioms.length > 0 &&
      missingProbes.length === 0 &&
      brokenGates.length === 0 &&
      orphanProbes.length === 0 &&
      enforced.length + deferred.length === axioms.length,
  };
}

/** 강제 판정을 한 줄로 접는다 — 터미널·배지용. */
export function enforcementVerdict(report: EnforcementReport): string {
  if (report.complete) {
    return `공리 ${String(report.enforced.length + report.deferred.length)}개 중 ${String(report.enforced.length)}개가 관문 ${String(report.results.length)}곳에서 실제로 막고 있다 (미강제 ${String(report.deferred.length)}개는 갚을 모듈이 적혀 있다)`;
  }
  const reasons: string[] = [];
  if (report.results.length === 0 && report.missingProbes.length === 0) {
    reasons.push('실행한 프로브가 없다');
  }
  if (report.missingProbes.length > 0) {
    reasons.push(`프로브 없는 강제 지점 ${report.missingProbes.join(', ')}`);
  }
  if (report.brokenGates.length > 0) reasons.push(`막지 못한 관문 ${report.brokenGates.join(', ')}`);
  if (report.orphanProbes.length > 0) {
    reasons.push(`아무 공리도 가리키지 않는 프로브 ${report.orphanProbes.join(', ')}`);
  }
  const unaccounted = report.clauses.filter(
    (entry) => !entry.enforced && entry.deferredTo === null,
  );
  if (unaccounted.length > 0) {
    reasons.push(`강제도 유예도 없는 공리 ${unaccounted.map((entry) => entry.clause).join(', ')}`);
  }
  return reasons.join(' · ');
}
