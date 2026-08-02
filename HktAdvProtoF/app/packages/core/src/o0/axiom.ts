// O0-a 공리 확정 — 원문이 세 곳에 나눠 적은 "세계가 허용하는 것" 을 하나의 공리 집합으로 좁힌다.
//
// 원문은 최상위 제약을 세 번 적는데 목록이 서로 다르다:
//
//   ModulePlan O0        생명·의념 / 비용 / 흔적 / 신적 주체        (네 문장, "예시" 라고만 적혀 있다)
//   MasterPlan §3.1      universalInvariants 넷 + 존재 전제 + 의지장
//   MasterPlan §3.2      1계층 절대 불변 규칙 넷
//
// 겹치는 것도 있고 한쪽에만 있는 것도 있다. 어느 한쪽만 고르면 "원문에 있는데 공리에 없다" 가
// 반복되므로 O2-a 와 같은 태도를 취한다 — **대조 자체를 값으로 남긴다**. 원문 문장 16개는
// 하나도 빠짐없이 확정 공리로 해소되어야 하고, 해소 방식(같음·합침·재서술)과 근거가 여기 적힌다.
//
// 공리는 새 타입이 아니다. **근거가 자기 자신인 규칙**이다 — O1 Rule 의 `axiomId` 가 null 인
// 자리가 곧 공리의 자리다 (o1/operation.ts: "어느 공리에서 나왔는가. 근거 없는 규칙이면 null").
// 그래서 Axiom 은 Rule 을 확장하고, 세계의 모든 규칙은 이 여덟 중 하나로 거슬러 올라간다.

import { deterministicId, type Id } from '../v1/id.ts';
import { compareStrings, stableSort } from '../v1/stable-sort.ts';
import { classify } from '../o1/index.ts';
import type { Rule } from '../o1/operation.ts';

/** 공리 조항 8종 — 확정된 공리의 이름표. 검사기·프로브가 이 키로 붙는다. */
export const AXIOM_CLAUSES = [
  'psychic-life', // 생명은 의념을 발생시킨다
  'verifiable-cost', // 강한 의념 효과에는 검증 가능한 비용이 필요하다
  'observable-trace', // 모든 능력은 관찰 가능한 흔적을 남긴다
  'emergent-divinity', // 집단의 반복 행동은 독립된 신적 주체를 만들 수 있다
  'observed-manipulation', // 관측하지 못한 상태는 정밀하게 조작할 수 없다
  'stability-resistance', // 이미 안정된 상태일수록 변화시키기 어렵다
  'state-exclusion', // 동일 자리에 양립 불가능한 두 값이 함께 설 수 없다
  'caused-persistence', // 원인 없는 지속적 결과는 존재할 수 없다
] as const;
export type AxiomClause = (typeof AXIOM_CLAUSES)[number];

/** 세계에 들이려는 정의의 종류 — 원문 O0 검증 조항이 지목한 둘 (능력·생물). */
export const DEFINITION_KINDS = ['ability', 'species'] as const;
export type DefinitionKind = (typeof DEFINITION_KINDS)[number];

/**
 * 공리가 지금 실제로 강제되는 지점.
 * 공리를 값으로만 적어 두면 아무도 지키지 않는다 — 어느 관문이 막는지를 함께 적고,
 * 그 관문이 정말 막는지는 O0-c 프로브가 실행해서 확인한다.
 */
export interface EnforcementPoint {
  /** 어느 모듈의 어느 관문인가 (`O1.checkAffordance`) */
  readonly gate: string;
  /** 그 관문이 정말 막는지 실행해 보는 프로브 id (O0-c) */
  readonly probe: string;
  /** 무엇을 막는가 한 줄 */
  readonly note: string;
}

/** 공리 하나 — 근거가 자기 자신인 규칙 (O1 Rule 의 확장). */
export interface Axiom extends Rule {
  readonly clause: AxiomClause;
  /** O0 가 직접 검사하는 정의의 종류. 비어 있으면 정의 층위에서는 검사하지 않는다 */
  readonly appliesTo: readonly DefinitionKind[];
  /** 지금 이 공리를 막고 있는 관문들 */
  readonly enforcedBy: readonly EnforcementPoint[];
  /** 아직 아무도 막지 못하면 어느 모듈이 갚는가. 이미 막고 있으면 null */
  readonly deferredTo: string | null;
  /** 원문 근거 위치 */
  readonly sources: readonly string[];
}

/** 공리 하나의 ID — 유래(문장)에서 나온다 (V1 결정적 ID). */
export function axiomId(clause: AxiomClause): Id {
  return deterministicId('axiom', clause);
}

/** 확정 공리 8개. 순서는 AXIOM_CLAUSES 그대로다 — 화면·해시가 흔들리지 않게. */
export const AXIOM_SET: readonly Axiom[] = [
  {
    kind: 'Rule',
    id: axiomId('psychic-life'),
    clause: 'psychic-life',
    domain: 'psychic',
    name: '생명은 의념을 발생시킨다',
    when: ['정의가 생명을 세운다 — 사람과 생물은 언제나 생명이다'],
    then: [
      '그 종은 의념 영역의 자리를 하나 이상 갖는다',
      '의념 없는 생명은 세계에 설 수 없다',
      '사람과 생물은 생명이 아니라고 선언될 수 없다',
    ],
    axiomId: null, // 공리는 자기 자신이 근거다
    appliesTo: ['species'],
    enforcedBy: [
      {
        gate: 'O0.checkDefinition:psychic-life',
        probe: 'o0-psychic-life',
        note: '의념 자리 없는 생명 정의를 거부한다',
      },
    ],
    deferredTo: null,
    sources: ['ModulePlan O0 예시 ①', 'MasterPlan §3.1 의지장(will_field)'],
  },
  {
    kind: 'Rule',
    id: axiomId('verifiable-cost'),
    clause: 'verifiable-cost',
    domain: 'psychic',
    name: '강한 의념 효과에는 검증 가능한 비용이 필요하다',
    when: ['능력의 효과 강도가 임계를 넘는다'],
    then: [
      '그 능력은 비용을 하나 이상 치른다',
      '비용은 세계에 실재하는 자리를 깎는다 — 확인할 수 없는 대가는 대가가 아니다',
      '공짜로 큰 변화를 일으키는 능력은 세계에 설 수 없다',
    ],
    axiomId: null,
    appliesTo: ['ability'],
    enforcedBy: [
      {
        gate: 'O0.checkDefinition:verifiable-cost',
        probe: 'o0-verifiable-cost',
        note: '비용 없는 대능력·세계에 없는 자리를 깎는 비용을 거부한다',
      },
      {
        gate: 'O1.checkAffordance',
        probe: 'o1-affordance-cost',
        note: '행동 층위에서 비용 0 어포던스를 거부한다',
      },
    ],
    deferredTo: null,
    sources: [
      'ModulePlan O0 예시 ②',
      'MasterPlan §3.1 universalInvariants.cost',
      'MasterPlan §3.1 존재 전제 뒷절 (강한 의지와 조건이 예외를 만든다)',
      'MasterPlan §3.2 1계층 · 6계층',
    ],
  },
  {
    kind: 'Rule',
    id: axiomId('observable-trace'),
    clause: 'observable-trace',
    domain: 'psychic',
    name: '모든 능력은 관찰 가능한 흔적을 남긴다',
    when: ['능력이 정의된다'],
    then: [
      '그 능력은 흔적을 하나 이상 남긴다',
      '흔적은 현상 통로 6종 중 하나를 타고 세계에 실재하는 자리에 적힌다',
      '흔적 없는 능력은 세계에 설 수 없다 — 아무도 그것이 일어났음을 알 수 없기 때문이다',
    ],
    axiomId: null,
    appliesTo: ['ability'],
    enforcedBy: [
      {
        gate: 'O0.checkDefinition:observable-trace',
        probe: 'o0-observable-trace',
        note: '흔적 없는 능력·세계에 적히지 않는 흔적을 거부한다',
      },
      {
        gate: 'O2.STATE_SCHEMA:psychic.trace.{rule}',
        probe: 'o2-trace-slot',
        note: '흔적이 적힐 자리가 스키마에 실재한다',
      },
    ],
    deferredTo: null,
    sources: [
      'ModulePlan O0 예시 ③',
      'MasterPlan §3.1 universalInvariants.consequence',
      'MasterPlan §3.1 존재 전제 앞절 (생명은 가능성을 흔적으로 남긴다)',
    ],
  },
  {
    kind: 'Rule',
    id: axiomId('emergent-divinity'),
    clause: 'emergent-divinity',
    domain: 'transcendent',
    name: '집단의 반복 행동은 독립된 신적 주체를 만들 수 있다',
    when: ['정의가 신적 주체를 세운다'],
    then: [
      '그 신은 자기를 낳은 집단의 반복 행동을 유래로 지목한다',
      '그 신은 초월 영역의 자리를 하나 이상 갖는다',
      '유래 없는 신은 세계에 설 수 없다',
      '신이 아닌 종은 집단의 반복 행동을 유래로 들 수 없다',
    ],
    axiomId: null,
    appliesTo: ['species'],
    enforcedBy: [
      {
        gate: 'O0.checkDefinition:emergent-divinity',
        probe: 'o0-emergent-divinity',
        note: '유래 없는 신·초월 자리 없는 신을 거부한다',
      },
      {
        gate: 'O2.STATE_SCHEMA:transcendent',
        probe: 'o2-transcendent-slot',
        note: '앵커·숭배량이 놓일 자리가 스키마에 실재한다',
      },
    ],
    deferredTo: null,
    sources: ['ModulePlan O0 예시 ④'],
  },
  {
    kind: 'Rule',
    id: axiomId('observed-manipulation'),
    clause: 'observed-manipulation',
    domain: 'informational',
    name: '관측하지 못한 상태는 정밀하게 조작할 수 없다',
    when: ['주체가 관측한 적 없는 상태를 정밀하게 바꾸려 한다'],
    then: ['정밀한 조작은 성립하지 않는다 — 관측 없이는 대략적 결과만 남는다'],
    axiomId: null,
    appliesTo: [], // 정의 층위가 아니라 행동 판정 층위의 공리다
    enforcedBy: [],
    deferredTo: 'R3 지각 프로파일 — 감지되지 않은 현상은 주체의 조작 대상에서 빠진다',
    sources: [
      'MasterPlan §3.1 universalInvariants.information',
      'MasterPlan §3.2 1계층 (정보가 없는 대상은 정밀하게 조작할 수 없다)',
    ],
  },
  {
    kind: 'Rule',
    id: axiomId('stability-resistance'),
    clause: 'stability-resistance',
    domain: 'physical',
    name: '이미 안정된 상태일수록 변화시키기 어렵다',
    when: ['바꾸려는 자리의 구조 안정성이 높다'],
    then: ['그것을 바꾸는 데 드는 비용이 커진다'],
    axiomId: null,
    appliesTo: [],
    enforcedBy: [],
    deferredTo: 'W2 규칙 실체화 — 안정도가 변화 비용에 곱해진다',
    sources: ['MasterPlan §3.1 universalInvariants.resistance'],
  },
  {
    kind: 'Rule',
    id: axiomId('state-exclusion'),
    clause: 'state-exclusion',
    domain: 'physical',
    name: '동일 자리에 양립 불가능한 두 값이 함께 설 수 없다',
    when: ['같은 영역·보유자·경로에 값이 둘 놓이려 한다'],
    then: [
      '뒤에 온 값이 막힌다 — 세계는 한 자리에 하나의 값만 갖는다',
      '값을 바꾸려면 사건(R1)을 거쳐야 한다',
    ],
    axiomId: null,
    appliesTo: [],
    enforcedBy: [
      {
        gate: 'O2.assembleWorld',
        probe: 'o2-duplicate-state',
        note: '같은 자리의 두 번째 값을 duplicate-state 로 막는다',
      },
    ],
    deferredTo: null,
    sources: ['MasterPlan §3.2 1계층 (동일 공간에 양립 불가능한 상태가 동시에 존재할 수 없다)'],
  },
  {
    kind: 'Rule',
    id: axiomId('caused-persistence'),
    clause: 'caused-persistence',
    domain: 'physical',
    name: '원인 없는 지속적 결과는 존재할 수 없다',
    when: ['세계에 지속되는 결과가 남는다'],
    then: [
      '그 결과는 자기를 낳은 원인을 지목할 수 있다',
      '아무 상태도 바꾸지 않은 일은 사건이 아니다',
    ],
    axiomId: null,
    appliesTo: [],
    enforcedBy: [
      {
        gate: 'O1.checkPhenomenon',
        probe: 'o1-causeless-phenomenon',
        note: '원인 사건 없는 현상을 거부한다',
      },
      {
        gate: 'O1.checkEvent',
        probe: 'o1-changeless-event',
        note: '아무 상태도 바꾸지 않는 사건을 거부한다',
      },
    ],
    deferredTo: null,
    sources: ['MasterPlan §3.2 1계층 (원인 없는 지속적 결과는 존재할 수 없다)'],
  },
];

/** 원문이 최상위 제약으로 적은 문장 하나. */
export interface OriginalAxiom {
  readonly id: string;
  readonly text: string;
  readonly source: string;
}

/** 원문 문장이 확정 공리로 해소되는 방식. */
export type AxiomResolutionKind =
  | 'same' // 같은 말을 그대로 공리로 세웠다
  | 'merged' // 더 넓은/좁은 다른 문장과 한 공리로 합쳤다
  | 'restated'; // 서술문을 검사 가능한 조항으로 다시 적었다

/** 원문 문장 하나의 해소 기록. */
export interface AxiomResolution {
  readonly original: string; // OriginalAxiom.id
  readonly resolution: AxiomResolutionKind;
  readonly clause: AxiomClause;
  readonly reason: string;
}

/**
 * 원문이 최상위 제약으로 적은 문장 16개.
 * 여기 없는 문장은 대조되지 않는다 — 원문을 다시 읽을 때마다 이 목록이 늘어난다 (O1 카탈로그와 같은 태도).
 */
export const ORIGINAL_AXIOMS: readonly OriginalAxiom[] = [
  { id: 'mp-o0-1', text: '생명은 의념을 발생시킨다.', source: 'ModulePlan O0 예시' },
  { id: 'mp-o0-2', text: '강한 의념 효과에는 검증 가능한 비용이 필요하다.', source: 'ModulePlan O0 예시' },
  { id: 'mp-o0-3', text: '모든 능력은 관찰 가능한 흔적을 남긴다.', source: 'ModulePlan O0 예시' },
  {
    id: 'mp-o0-4',
    text: '집단의 반복 행동은 독립된 신적 주체를 만들 수 있다.',
    source: 'ModulePlan O0 예시',
  },
  {
    id: 'seed-medium',
    text: '의지장 — 생명체의 생존 의지, 기억, 자기 인식이 세계에 영향을 줄 수 있게 하는 매개.',
    source: 'MasterPlan §3.1 metaphysicalMediums',
  },
  {
    id: 'seed-premise-trace',
    text: '모든 생명은 자신의 가능성을 세계에 흔적으로 남긴다.',
    source: 'MasterPlan §3.1 existentialPremise 앞절',
  },
  {
    id: 'seed-premise-exception',
    text: '강한 의지와 조건은 현실의 작동 방식에 제한적인 예외를 만든다.',
    source: 'MasterPlan §3.1 existentialPremise 뒷절',
  },
  {
    id: 'inv-cost',
    text: '지속적인 변화에는 비용이 필요하다.',
    source: 'MasterPlan §3.1 universalInvariants.cost',
  },
  {
    id: 'inv-information',
    text: '관측하지 못한 상태를 완전히 이용할 수 없다.',
    source: 'MasterPlan §3.1 universalInvariants.information',
  },
  {
    id: 'inv-resistance',
    text: '이미 안정된 상태일수록 변화시키기 어렵다.',
    source: 'MasterPlan §3.1 universalInvariants.resistance',
  },
  {
    id: 'inv-consequence',
    text: '큰 변화는 반드시 다른 영역에 흔적을 남긴다.',
    source: 'MasterPlan §3.1 universalInvariants.consequence',
  },
  { id: 'l1-cost', text: '변화에는 비용이 필요하다.', source: 'MasterPlan §3.2 1계층' },
  {
    id: 'l1-information',
    text: '정보가 없는 대상은 정밀하게 조작할 수 없다.',
    source: 'MasterPlan §3.2 1계층',
  },
  {
    id: 'l1-exclusion',
    text: '동일 공간에 양립 불가능한 상태가 동시에 존재할 수 없다.',
    source: 'MasterPlan §3.2 1계층',
  },
  {
    id: 'l1-causality',
    text: '원인 없는 지속적 결과는 존재할 수 없다.',
    source: 'MasterPlan §3.2 1계층',
  },
  {
    id: 'l6-personal',
    text: '개별 주체가 스스로에게 부과한 조건과 대가를 통해 제한적인 예외를 만든다.',
    source: 'MasterPlan §3.2 6계층',
  },
];

/** 원문 문장 16개가 확정 공리 8개로 어떻게 해소되는가. 이 표가 비면 공리는 근거 없는 발명이 된다. */
export const AXIOM_RECONCILIATION: readonly AxiomResolution[] = [
  {
    original: 'mp-o0-1',
    resolution: 'same',
    clause: 'psychic-life',
    reason: '그대로 공리로 세운다 — 생명과 의념을 잇는 유일한 문장이다.',
  },
  {
    original: 'seed-medium',
    resolution: 'restated',
    clause: 'psychic-life',
    reason:
      '의지장은 "생명의 의지가 세계에 닿는 매개" 다 — 매개의 존재는 곧 생명이 의념을 발생시킨다는 말이므로 같은 공리로 접는다.',
  },
  {
    original: 'mp-o0-2',
    resolution: 'same',
    clause: 'verifiable-cost',
    reason: '그대로 공리로 세운다. "검증 가능한" 을 "세계에 실재하는 자리를 깎는다" 로 읽는다.',
  },
  {
    original: 'inv-cost',
    resolution: 'merged',
    clause: 'verifiable-cost',
    reason: '의념 효과는 지속적 변화의 한 종류다 — 더 넓은 문장이 좁은 문장을 덮는다.',
  },
  {
    original: 'l1-cost',
    resolution: 'merged',
    clause: 'verifiable-cost',
    reason: '§3.1 invariants.cost 와 같은 말이다 — 원문이 두 곳에 같은 규칙을 적었다.',
  },
  {
    original: 'seed-premise-exception',
    resolution: 'restated',
    clause: 'verifiable-cost',
    reason:
      '"강한 의지와 조건이 예외를 만든다" 에서 조건이 곧 대가다 — 조건 없는 예외를 막는 쪽으로 다시 적는다.',
  },
  {
    original: 'l6-personal',
    resolution: 'merged',
    clause: 'verifiable-cost',
    reason: '6계층 개인 능력 규칙은 "스스로 부과한 조건과 대가" 를 말한다 — 비용 공리의 개인 층위 적용이다.',
  },
  {
    original: 'mp-o0-3',
    resolution: 'same',
    clause: 'observable-trace',
    reason: '그대로 공리로 세운다. "관찰 가능한" 을 "현상 통로 + 세계의 자리" 로 읽는다.',
  },
  {
    original: 'inv-consequence',
    resolution: 'merged',
    clause: 'observable-trace',
    reason: '"큰 변화는 다른 영역에 흔적을 남긴다" 는 능력에 한정하지 않은 같은 요구다.',
  },
  {
    original: 'seed-premise-trace',
    resolution: 'restated',
    clause: 'observable-trace',
    reason:
      '생명이 가능성을 흔적으로 남긴다는 서술을 "흔적 없는 능력은 서지 못한다" 는 검사 조항으로 다시 적는다.',
  },
  {
    original: 'mp-o0-4',
    resolution: 'same',
    clause: 'emergent-divinity',
    reason: '그대로 공리로 세운다. "만들 수 있다" 는 허용이지만, 허용된 것에도 유래는 있어야 한다.',
  },
  {
    original: 'inv-information',
    resolution: 'same',
    clause: 'observed-manipulation',
    reason: '그대로 공리로 세운다 — 정보 없는 조작을 막는 유일한 문장이다.',
  },
  {
    original: 'l1-information',
    resolution: 'merged',
    clause: 'observed-manipulation',
    reason: '§3.1 invariants.information 과 같은 말이다 — 원문이 두 곳에 같은 규칙을 적었다.',
  },
  {
    original: 'inv-resistance',
    resolution: 'same',
    clause: 'stability-resistance',
    reason: '그대로 공리로 세운다 — 안정도와 변화 비용을 잇는 유일한 문장이다.',
  },
  {
    original: 'l1-exclusion',
    resolution: 'restated',
    clause: 'state-exclusion',
    reason:
      '"동일 공간" 을 O2 의 자리(영역·보유자·경로)로 좁혀 적는다 — 공간만으로는 무엇이 겹치는지 검사할 수 없다.',
  },
  {
    original: 'l1-causality',
    resolution: 'same',
    clause: 'caused-persistence',
    reason: '그대로 공리로 세운다 — O1 이 현상·사건에 이미 걸어 둔 요구의 근거다.',
  },
];

/** 공리 집합이 온전한가 — 원문을 다 담았고, 근거 없는 공리·아무도 안 지키는 공리가 없는가. */
export interface AxiomSetReport {
  readonly clauses: readonly AxiomClause[];
  /** 대조한 원문 문장 수 — 0 이면 아무것도 확인하지 않은 것이다 */
  readonly originalsChecked: number;
  /** 해소되지 않은 원문 문장 */
  readonly unresolved: readonly string[];
  /** 확정 공리에 없는 조항으로 해소된 문장 (`문장→조항`) */
  readonly danglingTargets: readonly string[];
  /** 어느 원문 문장도 해소되어 오지 않은 공리 — 근거 없는 발명이다 */
  readonly ungroundedAxioms: readonly AxiomClause[];
  /** 두 번 적힌 조항 */
  readonly duplicateClauses: readonly AxiomClause[];
  /** O1 Rule 로서 온전하지 않은 공리 (`조항 → 경로 사유`) */
  readonly malformed: readonly string[];
  /** 강제 지점도 없고 갚을 모듈도 안 적힌 공리 — 아무도 지키지 않는 공리다 */
  readonly unenforced: readonly AxiomClause[];
  /** 아직 강제하지 못해 뒤로 미룬 공리 (갚을 모듈이 적혀 있다) */
  readonly deferred: readonly AxiomClause[];
  readonly complete: boolean;
}

/** 원문 문장 목록을 확정 공리에 대조한다. 던지지 않는다 — 어긋남은 값으로 남는다. */
export function axiomSetReport(
  axioms: readonly Axiom[] = AXIOM_SET,
  originals: readonly OriginalAxiom[] = ORIGINAL_AXIOMS,
  resolutions: readonly AxiomResolution[] = AXIOM_RECONCILIATION,
): AxiomSetReport {
  const clauses = axioms.map((axiom) => axiom.clause);
  const resolvedIds = new Set(resolutions.map((entry) => entry.original));

  const unresolved = originals
    .filter((original) => !resolvedIds.has(original.id))
    .map((original) => original.id);

  const knownIds = new Set(originals.map((original) => original.id));
  const danglingTargets: string[] = [];
  const grounded = new Set<AxiomClause>();
  for (const entry of resolutions) {
    if (!clauses.includes(entry.clause)) {
      danglingTargets.push(`${entry.original}→${entry.clause}`);
      continue;
    }
    // 원문에 없는 문장을 근거로 든 해소도 근거가 되지 못한다.
    if (knownIds.has(entry.original)) grounded.add(entry.clause);
  }

  const duplicateClauses = stableSort(
    clauses.filter((clause, index) => clauses.indexOf(clause) !== index),
    compareStrings,
  );

  const malformed: string[] = [];
  for (const axiom of axioms) {
    for (const violation of classify(axiom).violations) {
      malformed.push(`${axiom.clause} → ${violation.path} ${violation.message}`);
    }
    if (axiom.sources.length === 0) malformed.push(`${axiom.clause} → 원문 근거가 없다`);
  }

  const unenforced = axioms
    .filter((axiom) => axiom.enforcedBy.length === 0 && axiom.deferredTo === null)
    .map((axiom) => axiom.clause);
  const deferred = axioms
    .filter((axiom) => axiom.enforcedBy.length === 0 && axiom.deferredTo !== null)
    .map((axiom) => axiom.clause);
  const ungroundedAxioms = clauses.filter((clause) => !grounded.has(clause));

  return {
    clauses,
    originalsChecked: originals.length,
    unresolved,
    danglingTargets,
    ungroundedAxioms,
    duplicateClauses,
    malformed,
    unenforced,
    deferred,
    complete:
      axioms.length > 0 &&
      originals.length > 0 &&
      unresolved.length === 0 &&
      danglingTargets.length === 0 &&
      ungroundedAxioms.length === 0 &&
      duplicateClauses.length === 0 &&
      malformed.length === 0 &&
      unenforced.length === 0,
  };
}

/** 공리 집합 판정을 한 줄로 접는다 — 터미널·배지용. */
export function axiomSetVerdict(report: AxiomSetReport): string {
  if (report.complete) {
    return `원문 ${String(report.originalsChecked)}문장이 공리 ${String(report.clauses.length)}개로 해소됐다 (미강제 ${String(report.deferred.length)}개는 갚을 모듈이 적혀 있다)`;
  }
  const reasons: string[] = [];
  if (report.clauses.length === 0) reasons.push('공리가 하나도 없다');
  if (report.originalsChecked === 0) reasons.push('대조할 원문 문장이 없다');
  if (report.unresolved.length > 0) reasons.push(`해소되지 않은 원문 문장 ${report.unresolved.join(', ')}`);
  if (report.danglingTargets.length > 0) {
    reasons.push(`없는 조항으로 보낸 문장 ${report.danglingTargets.join(', ')}`);
  }
  if (report.ungroundedAxioms.length > 0) {
    reasons.push(`원문 근거 없는 공리 ${report.ungroundedAxioms.join(', ')}`);
  }
  if (report.duplicateClauses.length > 0) {
    reasons.push(`두 번 적힌 조항 ${report.duplicateClauses.join(', ')}`);
  }
  if (report.malformed.length > 0) reasons.push(`결함 공리 ${report.malformed.join(' / ')}`);
  if (report.unenforced.length > 0) {
    reasons.push(`아무도 지키지 않는 공리 ${report.unenforced.join(', ')}`);
  }
  return reasons.join(' · ');
}

/** 조항으로 공리 하나를 찾는다. */
export function axiomOf(clause: AxiomClause, axioms: readonly Axiom[] = AXIOM_SET): Axiom | null {
  return axioms.find((axiom) => axiom.clause === clause) ?? null;
}

/** ID 로 공리 하나를 찾는다 — 정의가 든 근거를 되짚을 때. */
export function axiomById(id: Id, axioms: readonly Axiom[] = AXIOM_SET): Axiom | null {
  return axioms.find((axiom) => axiom.id === id) ?? null;
}

/** 문자열이 확정 조항 8종 중 하나인가. */
export function isAxiomClause(value: unknown): value is AxiomClause {
  return typeof value === 'string' && (AXIOM_CLAUSES as readonly string[]).includes(value);
}

/** 원문 문장 하나가 어느 공리로 갔는가 (화면 대조표용). */
export function resolutionOf(
  originalId: string,
  resolutions: readonly AxiomResolution[] = AXIOM_RECONCILIATION,
): AxiomResolution | null {
  return resolutions.find((entry) => entry.original === originalId) ?? null;
}
