// P0-b 원자별 세계 걸림 — 열여섯 칸이 이름뿐인 목록이 되지 않도록 각 원자를 세계에 못박는다.
//
// 목록은 쉽다. 그 목록으로 세계가 굴러가려면 각 칸이 다섯 가지에 답해야 한다:
//
//   ① 무엇에 손대는가   — 세계인가 앎인가 남과의 사이인가 나 자신인가 (`touches`)
//   ② 무엇을 바꾸는가   — O2 9영역의 실재하는 자리 (`writes`)
//   ③ 무엇을 치르는가   — 역시 실재하는 자리. 공짜 행동은 없다 (O0 verifiable-cost)
//   ④ 어느 의존에 닿는가 — D0 11종 중 무엇을 채우거나 지키거나 지우거나 벗어나는가
//   ⑤ 상대가 동의하는가  — 남이 끼는 원자만 갖는 축. 여기서 세계의 도덕이 갈린다
//
// ②·③을 못 대는 원자는 R2 가 세계 변경 요청으로 받을 수 없다 — 바꿀 자리도 깎을 자리도
// 없으면 그것은 말이지 행동이 아니다. 그래서 **아무 자리도 바꾸지 않는 원자와 아무것도 치르지
// 않는 원자는 거부한다.**
//
// 거꾸로도 본다. D0 가 확정한 열한 종 중 아무 원자도 채우지 못하는 종이 있으면, 그 의존은
// 어떤 행동으로도 갚을 수 없다 — 압력만 오르고 길이 없는 자리다. 그런 종이 실제로 둘 있고,
// 둘 다 근거가 있다: 시간은 기다릴 뿐이고(V1 틱), 규칙은 개인이 아니라 세계가 지닌다(W2).
// 그 둘은 예외로 **선언**되어야 하며, 선언 없이 비면 거부한다.
//
// 그리고 이 하위 작업의 두 문장:
//   **열여섯 중 열다섯은 대상을 먼저 봐야 한다.** 보지 않고 할 수 있는 것은 찾는 것 하나뿐이다
//   (O0 observed-manipulation 의 문법 층 선행 — 실행 층은 R3 이 갚는다).
//   **상대가 끼는 여섯은 셋씩 짝을 이룬다.** 물건을 주고받기와 빼앗기, 마음을 이유로와 두려움으로,
//   약속을 맺기와 어기기. 갈리는 것은 목적이 아니라 동의 하나다.

import { compareStrings, stableSort } from '../v1/stable-sort.ts';
import type { StateDomain } from '../o1/being.ts';
import { STATE_SCHEMA, type StateSchema } from '../o2/schema.ts';
import type { SlotRef } from '../o0/definition.ts';
import { DEPENDENCY_KINDS, type DependencyKind } from '../d0/kind.ts';
import { ACTION_ATOMS, atomLabel, type ActionAtom } from './atom.ts';
import { violateAtom, type ActionAtomViolation } from './violation.ts';

// 세계의 자리 하나(`{domain, path}`)는 O0 가 능력의 대가를 적을 때 이미 세웠다 — 그것을 그대로 쓴다.
// 다만 P0 는 실제 경로가 아니라 **자리 패턴**(`stock.{entity}`)을 담는다: 원자는 "누구의 무엇" 이
// 아니라 "어떤 자리" 를 여는 문법이기 때문이다. 누구의 자리인지는 요청(P0-c)이 채운다.
export type { SlotRef };

/** 원자가 손대는 곳. */
export const ATOM_TOUCHES = [
  'world', // 세계 자체 — 물건·자리·값
  'knowing', // 앎 — 누가 무엇을 아는가
  'between', // 남과의 사이 — 상대가 있어야 성립한다
  'self', // 나 자신 — 기대는 구조를 바꾼다
] as const;
export type AtomTouch = (typeof ATOM_TOUCHES)[number];

/** 상대의 동의 축 — `between` 원자만 갖는다. */
export const ATOM_CONSENTS = [
  'mutual', // 상대가 받아들여야 성립한다
  'against', // 상대의 뜻을 거슬러 성립한다
  'none', // 상대가 없다
] as const;
export type AtomConsent = (typeof ATOM_CONSENTS)[number];

/** 원자가 의존에 대해 하는 일. */
export const ATOM_BEARINGS = [
  'fill', // 빈 자리를 채운다
  'guard', // 채워진 자리가 깎이지 않게 막는다
  'clear', // 남의 자리를 지워 내 길을 연다
  'escape', // 그 의존에서 벗어난다
] as const;
export type AtomBearing = (typeof ATOM_BEARINGS)[number];

/** 원자 하나가 세계에 걸리는 방식. */
export interface AtomGrounding {
  readonly atom: ActionAtom;
  readonly touches: AtomTouch;
  readonly consent: AtomConsent;
  readonly bearing: AtomBearing;
  /** 무엇이 갖춰졌는지 읽어야 하는가 */
  readonly reads: readonly SlotRef[];
  /** 무엇을 바꾸겠다고 요청하는가 — 비면 행동이 아니다 */
  readonly writes: readonly SlotRef[];
  /** 무엇을 치르는가 — 비면 공짜다 (O0 verifiable-cost) */
  readonly pays: readonly SlotRef[];
  /** 어느 의존 종에 닿는가 (D0 11종). 벗어나는 원자는 종을 가리지 않으므로 비어 있다 */
  readonly kinds: readonly DependencyKind[];
  /** 대상이 저항할 수 있는가 (MasterPlan §19 규칙 엔진의 물음) */
  readonly resistable: boolean;
  /** 대상을 먼저 관측해야 하는가 (O0 observed-manipulation) */
  readonly requiresObservation: boolean;
  /** 바꾼 자리를 되돌릴 수 있는가 */
  readonly reversible: boolean;
  /** 동의 축을 뒤집으면 무엇이 되는가 — 짝이 없으면 null */
  readonly counterpart: ActionAtom | null;
  /** 왜 이렇게 걸리는가 — 근거 없는 걸림은 걸림이 아니다 */
  readonly note: string;
}

const slot = (domain: StateDomain, path: string): SlotRef => ({ domain, path });

/** 원자 16개의 세계 걸림. 순서는 `ACTION_ATOMS` 그대로다. */
export const ATOM_GROUNDINGS: readonly AtomGrounding[] = [
  {
    atom: 'seek',
    touches: 'knowing',
    consent: 'none',
    bearing: 'fill',
    reads: [slot('physical', 'distance.{entity}'), slot('physical', 'cover'), slot('ecological', 'habitat')],
    writes: [slot('informational', 'knows.{claim}'), slot('informational', 'certainty.{claim}')],
    pays: [slot('biological', 'vitality')],
    kinds: ['information'],
    resistable: true,
    requiresObservation: false,
    reversible: true,
    counterpart: 'conceal',
    note: '열여섯 중 유일하게 대상을 안 보고 할 수 있는 원자다 — 보는 일 자체를 만드는 원자이기 때문이다. 그래서 바꾸는 자리도 내 앎뿐이고, 은폐한 자가 이것을 막는다',
  },
  {
    atom: 'acquire',
    touches: 'world',
    consent: 'none',
    bearing: 'fill',
    reads: [slot('economic', 'stock.{entity}'), slot('physical', 'region'), slot('physical', 'distance.{entity}')],
    writes: [slot('economic', 'stock.{entity}'), slot('physical', 'region'), slot('biological', 'hunger')],
    pays: [slot('biological', 'vitality')],
    kinds: ['resource', 'space', 'body'],
    resistable: false,
    requiresObservation: true,
    reversible: true,
    counterpart: null,
    note: '이동·운송·섭식이 전부 이 원자다 — 자리를 바꾸는 일이기 때문이다. 주인이 있는 것에 손대면 그것은 빼앗다가 된다',
  },
  {
    atom: 'produce',
    touches: 'world',
    consent: 'none',
    bearing: 'fill',
    reads: [slot('economic', 'stock.{entity}'), slot('informational', 'knows.{claim}')],
    writes: [
      slot('economic', 'stock.{entity}'),
      slot('institutional', 'law.{rule}'),
      slot('physical', 'temperature'),
    ],
    pays: [slot('economic', 'stock.{entity}'), slot('biological', 'vitality')],
    kinds: ['resource', 'institution', 'environment'],
    resistable: false,
    requiresObservation: true,
    reversible: true,
    counterpart: null,
    note: '만들어지는 것은 다 생산이다 — 물건(재고)이든 법(제도)이든 온기(환경)든. 재료를 태우므로 치르는 자리가 바꾸는 자리와 같다',
  },
  {
    atom: 'exchange',
    touches: 'between',
    consent: 'mutual',
    bearing: 'fill',
    reads: [
      slot('economic', 'price.{entity}'),
      slot('economic', 'stock.{entity}'),
      slot('relational', 'trust.{subject}'),
    ],
    writes: [
      slot('economic', 'stock.{entity}'),
      slot('economic', 'flow.{entity}'),
      slot('relational', 'trust.{subject}'),
    ],
    pays: [slot('economic', 'stock.{entity}')],
    kinds: ['resource', 'information', 'institution'],
    resistable: true,
    requiresObservation: true,
    reversible: true,
    counterpart: 'seize',
    note: '주고받는다 — 물건뿐 아니라 앎도 통행권도 오간다. 치르는 것이 있으므로 관계가 쌓이고, 그래서 다음에도 오간다',
  },
  {
    atom: 'seize',
    touches: 'between',
    consent: 'against',
    bearing: 'fill',
    reads: [
      slot('economic', 'stock.{entity}'),
      slot('physical', 'region'),
      slot('institutional', 'law.{rule}'),
    ],
    writes: [
      slot('economic', 'stock.{entity}'),
      slot('physical', 'region'),
      slot('relational', 'grudge.{subject}'),
    ],
    pays: [slot('relational', 'trust.{subject}'), slot('biological', 'vitality')],
    kinds: ['resource', 'space'],
    resistable: true,
    requiresObservation: true,
    reversible: false,
    counterpart: 'exchange',
    note: '교환과 같은 자리를 바꾸고 동의 하나만 다르다. 가져온 것은 돌려줄 수 있어도 남은 원한은 지워지지 않는다 — 그래서 되돌릴 수 없다',
  },
  {
    atom: 'protect',
    touches: 'world',
    consent: 'none',
    bearing: 'guard',
    reads: [slot('physical', 'integrity'), slot('physical', 'cover'), slot('institutional', 'law.{rule}')],
    writes: [
      slot('physical', 'cover'),
      slot('institutional', 'law.{rule}'),
      slot('institutional', 'contraband.{entity}'),
    ],
    pays: [slot('biological', 'vitality'), slot('economic', 'stock.{entity}')],
    kinds: ['resource', 'space', 'institution', 'body'],
    resistable: false,
    requiresObservation: true,
    reversible: true,
    counterpart: 'destroy',
    note: '채우지 않는다 — 채워진 자리가 깎이는 것을 늦출 뿐이다. 그래서 지키기만 하는 주체는 굶는다',
  },
  {
    atom: 'destroy',
    touches: 'world',
    consent: 'none',
    bearing: 'clear',
    reads: [slot('physical', 'integrity'), slot('biological', 'vitality'), slot('ecological', 'population')],
    writes: [
      slot('physical', 'broken'),
      slot('biological', 'vitality'),
      slot('ecological', 'population'),
    ],
    pays: [slot('biological', 'vitality'), slot('economic', 'stock.{entity}')],
    kinds: ['environment', 'subject', 'space'],
    resistable: true,
    requiresObservation: true,
    reversible: false,
    counterpart: 'protect',
    note: '비우는 원자다 — 채우지 않지만 비면 누군가 채운다. 개체군을 줄이면 서식 압력이 내려간다는 것이 그 뜻이다',
  },
  {
    atom: 'conceal',
    touches: 'knowing',
    consent: 'none',
    bearing: 'guard',
    reads: [slot('informational', 'knows.{claim}'), slot('physical', 'cover')],
    writes: [
      slot('informational', 'secret.{claim}'),
      slot('informational', 'falsehood.{claim}'),
      slot('physical', 'cover'),
    ],
    pays: [slot('biological', 'vitality')],
    kinds: ['information', 'space', 'resource'],
    resistable: false,
    requiresObservation: true,
    reversible: true,
    counterpart: 'seek',
    note: '경쟁을 지우는 가장 싼 길이다 — 없애지 않고 알려지지 않게만 한다. 진짜 대가는 들켰을 때 치르며, 그것은 E 계층(발각 사건)이 맡는다',
  },
  {
    atom: 'investigate',
    touches: 'knowing',
    consent: 'none',
    bearing: 'fill',
    reads: [slot('physical', 'material'), slot('biological', 'toxicity'), slot('psychic', 'trace.{rule}')],
    writes: [
      slot('informational', 'certainty.{claim}'),
      slot('informational', 'falsehood.{claim}'),
      slot('informational', 'sourceOf.{claim}'),
    ],
    pays: [slot('biological', 'vitality')],
    kinds: ['information'],
    resistable: false,
    requiresObservation: true,
    reversible: true,
    counterpart: null,
    note: '찾다가 "어디" 라면 조사는 "무엇" 이다. 손에 닿는 것에서 성질과 흔적을 읽으므로 대상을 먼저 봐야 하고, 틀린 믿음을 거짓으로 표시할 수 있는 유일한 원자다. 규칙의 흔적을 읽지만 규칙 의존을 채우지는 못한다 — 아는 것과 서 있게 하는 것은 다르다',
  },
  {
    atom: 'persuade',
    touches: 'between',
    consent: 'mutual',
    bearing: 'fill',
    reads: [
      slot('relational', 'trust.{subject}'),
      slot('informational', 'knows.{claim}'),
      slot('psychic', 'conviction'),
    ],
    writes: [
      slot('informational', 'knows.{claim}'),
      slot('informational', 'certainty.{claim}'),
      slot('relational', 'reliance.{subject}'),
    ],
    pays: [slot('relational', 'trust.{subject}')],
    kinds: ['subject', 'relationship', 'information'],
    resistable: true,
    requiresObservation: true,
    reversible: true,
    counterpart: 'coerce',
    note: '말이 값을 갖는 것은 신뢰가 있기 때문이다 — 그래서 설득은 신뢰를 청구한다. 신뢰가 바닥난 자는 옳은 말을 해도 아무것도 얻지 못한다',
  },
  {
    atom: 'coerce',
    touches: 'between',
    consent: 'against',
    bearing: 'clear',
    reads: [
      slot('relational', 'fear.{subject}'),
      slot('physical', 'integrity'),
      slot('institutional', 'bounty'),
    ],
    writes: [
      slot('relational', 'fear.{subject}'),
      slot('relational', 'grudge.{subject}'),
      slot('institutional', 'contraband.{entity}'),
    ],
    pays: [slot('relational', 'trust.{subject}'), slot('biological', 'vitality')],
    kinds: ['subject', 'relationship', 'institution'],
    resistable: true,
    requiresObservation: true,
    reversible: false,
    counterpart: 'persuade',
    note: '설득과 같은 것을 노리고 동의 하나만 다르다. 두려움은 즉시 듣지만 남으므로 되돌릴 수 없다 — 통제·금기 부여가 이 원자다',
  },
  {
    atom: 'ally',
    touches: 'between',
    consent: 'mutual',
    bearing: 'fill',
    reads: [
      slot('relational', 'trust.{subject}'),
      slot('relational', 'belongsTo.{subject}'),
      slot('institutional', 'diplomacy.{subject}'),
    ],
    writes: [
      slot('relational', 'belongsTo.{subject}'),
      slot('relational', 'debt.{subject}'),
      slot('institutional', 'diplomacy.{subject}'),
    ],
    pays: [slot('relational', 'debt.{subject}')],
    kinds: ['subject', 'relationship', 'ritual'],
    resistable: true,
    requiresObservation: true,
    reversible: true,
    counterpart: 'betray',
    note: '아직 치르지 않은 것을 걸어 둘을 묶는다 — 약속은 미래의 빚이고, 그래서 치르는 자리가 빚이다. 그 약속이 O1 Commitment 로 서고 상태 전이는 E2 가 굴린다',
  },
  {
    atom: 'betray',
    touches: 'between',
    consent: 'against',
    bearing: 'clear',
    reads: [slot('relational', 'belongsTo.{subject}'), slot('relational', 'debt.{subject}')],
    writes: [
      slot('relational', 'trust.{subject}'),
      slot('relational', 'grudge.{subject}'),
      slot('relational', 'belongsTo.{subject}'),
    ],
    pays: [slot('relational', 'trust.{subject}'), slot('transcendent', 'legitimacy')],
    kinds: ['subject', 'relationship', 'ritual'],
    resistable: false,
    requiresObservation: true,
    reversible: false,
    counterpart: 'ally',
    note: '이미 안에 있는 자만 할 수 있고, 그래서 대상이 저항할 수 없는 유일한 원자다. 치르는 것은 신뢰와 정당성 둘이며 어느 쪽도 돌아오지 않는다',
  },
  {
    atom: 'adapt',
    touches: 'self',
    consent: 'none',
    bearing: 'escape',
    reads: [slot('biological', 'metabolism'), slot('biological', 'growthStage')],
    writes: [slot('biological', 'metabolism'), slot('biological', 'mutation.{rule}')],
    pays: [slot('biological', 'vitality'), slot('psychic', 'energy')],
    kinds: [],
    resistable: false,
    requiresObservation: true,
    reversible: true,
    counterpart: null,
    note: '기대는 자리는 그대로고 무게만 준다 — D3 변형 문법의 약화가 이 원자다. 어느 종의 의존이든 덜 쓸 수 있으므로 종을 가리지 않는다',
  },
  {
    atom: 'substitute',
    touches: 'self',
    consent: 'none',
    bearing: 'escape',
    reads: [slot('economic', 'stock.{entity}'), slot('informational', 'knows.{claim}')],
    writes: [
      slot('biological', 'mutation.{rule}'),
      slot('psychic', 'activeEffect.{rule}'),
      slot('economic', 'demand.{entity}'),
    ],
    pays: [slot('psychic', 'energy'), slot('biological', 'vitality')],
    kinds: [],
    resistable: false,
    requiresObservation: true,
    reversible: true,
    counterpart: null,
    note: '끊고 세운다 — D3 변형 문법의 끊음+더함이 이 원자다. 덜어 낸 무게만큼 다른 자리에 세워야 하며 그 장부는 D3 전환 검사가 잰다',
  },
  {
    atom: 'shed',
    touches: 'self',
    consent: 'none',
    bearing: 'escape',
    reads: [slot('biological', 'growthStage'), slot('psychic', 'energy')],
    writes: [
      slot('biological', 'growthStage'),
      slot('biological', 'mutation.{rule}'),
      slot('psychic', 'activeEffect.{rule}'),
    ],
    pays: [slot('psychic', 'energy'), slot('biological', 'vitality')],
    kinds: [],
    resistable: false,
    requiresObservation: true,
    reversible: false,
    counterpart: null,
    note: '그 자리를 아예 갖지 않는 존재가 된다. D3 은 개체가 뿌리를 지우지 못한다고 못박았다 — 탈피는 종의 자리 자체를 바꾸는 일이라 G3 성장·C 계층이 승인해야 성립한다',
  },
];

/** 아무 원자도 채우지 못하는 의존 종 — 선언된 예외. */
export interface UnfillableKind {
  readonly kind: DependencyKind;
  readonly reason: string;
  /** 누가 이 자리를 갚는가 */
  readonly owedTo: string;
}

export const UNFILLABLE_KINDS: readonly UnfillableKind[] = [
  {
    kind: 'time',
    reason:
      '기다리는 것은 행동이 아니다 — 아무도 주기를 앞당기지 못한다. 충족은 V1 틱에서 읽는다 (D0 가 이미 대상 없는 종으로 못박았다)',
    owedTo: 'V1 틱 — 갚을 모듈이 아니라 흐름 자체다',
  },
  {
    kind: 'rule',
    reason:
      '규칙은 개인이 채우는 것이 아니라 세계가 지닌다. 조사로 규칙을 알 수는 있어도(investigate) 서 있게 만들 수는 없다',
    owedTo: 'W2 규칙 실체화 — 규칙이 세계 상태가 되는 자리',
  },
];

/** 원자의 걸림 하나를 찾는다. */
export function atomGrounding(atom: ActionAtom): AtomGrounding | null {
  return ATOM_GROUNDINGS.find((entry) => entry.atom === atom) ?? null;
}

/** 자리 하나를 문자열로 — 화면·사유·서명이 같은 문자열을 쓴다. */
export function slotText(ref: SlotRef): string {
  return `${ref.domain}.${ref.path}`;
}

/** 자리 목록을 정렬해 한 줄로 — 서명 비교용. */
function slotSignature(refs: readonly SlotRef[]): string {
  return stableSort(refs.map(slotText), compareStrings).join('|');
}

/** 걸림 하나의 서명 — 축·자리·대가가 모두 같은 원자는 하나로 접힌다. */
export function groundingSignature(grounding: AtomGrounding): string {
  return [
    grounding.touches,
    grounding.consent,
    grounding.bearing,
    slotSignature(grounding.writes),
    slotSignature(grounding.pays),
  ].join(' / ');
}

/** 걸림 검사 결과 — 열여섯 칸이 전부 세계에 닿아 있는가. */
export interface AtomGroundingReport {
  /** 걸림이 없는 원자 */
  readonly ungrounded: readonly ActionAtom[];
  /** 두 번 적힌 원자 */
  readonly duplicates: readonly ActionAtom[];
  /** 서명이 겹쳐 하나로 접히는 원자 쌍 (`a↔b`) */
  readonly redundant: readonly string[];
  /** 아무 원자도 채우지 못하는 종 — 예외로 선언된 것만 남는다 */
  readonly unfillable: readonly DependencyKind[];
  /** 종별로 그것을 채우는 원자들 */
  readonly byKind: Readonly<Record<string, readonly ActionAtom[]>>;
  /** 손대는 곳별 원자 수 */
  readonly byTouch: Readonly<Record<string, readonly ActionAtom[]>>;
  /** 동의 축으로 짝지어진 쌍 (`a↔b`) */
  readonly pairs: readonly string[];
  /** 보지 않고 할 수 있는 원자 */
  readonly blindAtoms: readonly ActionAtom[];
  readonly violations: readonly ActionAtomViolation[];
  readonly complete: boolean;
}

/** 자리가 O2 스키마에 실재하는가 — 패턴 그대로 선언됐어야 한다. */
function slotExists(schema: StateSchema, ref: SlotRef): boolean {
  return schema.fields.some((field) => field.domain === ref.domain && field.path === ref.path);
}

/** 열여섯 원자의 걸림을 검사한다. 던지지 않는다 — 어긋남은 값으로 남는다. */
export function checkAtomGroundings(
  groundings: readonly AtomGrounding[] = ATOM_GROUNDINGS,
  exceptions: readonly UnfillableKind[] = UNFILLABLE_KINDS,
  schema: StateSchema = STATE_SCHEMA,
): AtomGroundingReport {
  const violations: ActionAtomViolation[] = [];
  const grounded = groundings.map((entry) => entry.atom);

  const ungrounded = ACTION_ATOMS.filter((atom) => !grounded.includes(atom));
  for (const atom of ungrounded) {
    violateAtom(
      violations,
      atom,
      'ungrounded-atom',
      '$.groundings',
      `${atom} 이 무엇을 읽고 바꾸고 치르는지를 대지 못한다 — 이름뿐인 원자는 요청이 되지 못한다`,
    );
  }

  const duplicates = stableSort(
    grounded.filter((atom, index) => grounded.indexOf(atom) !== index),
    compareStrings,
  );
  for (const atom of duplicates) {
    violateAtom(violations, atom, 'ungrounded-atom', '$.groundings', `${atom} 의 걸림이 두 번 적혔다`);
  }

  for (const [index, entry] of groundings.entries()) {
    const at = `$.groundings[${String(index)}]`;

    if (entry.writes.length === 0) {
      violateAtom(
        violations,
        entry.atom,
        'changeless-atom',
        `${at}.writes`,
        `${atomLabel(entry.atom)} 가 아무 자리도 바꾸지 않는다 — 세계를 바꾸지 않는 것은 행동이 아니라 말이다`,
      );
    }
    if (entry.pays.length === 0) {
      violateAtom(
        violations,
        entry.atom,
        'costless-atom',
        `${at}.pays`,
        `${atomLabel(entry.atom)} 가 아무것도 치르지 않는다 — 공짜 행동은 세계를 붕괴시킨다 (O0 verifiable-cost)`,
      );
    }

    for (const [field, refs] of [
      ['reads', entry.reads],
      ['writes', entry.writes],
      ['pays', entry.pays],
    ] as const) {
      for (const [slotIndex, ref] of refs.entries()) {
        if (!slotExists(schema, ref)) {
          violateAtom(
            violations,
            entry.atom,
            'phantom-slot',
            `${at}.${field}[${String(slotIndex)}]`,
            `세계에 없는 자리 ${slotText(ref)} 를 ${field === 'pays' ? '치른다' : field === 'writes' ? '바꾼다' : '읽는다'} 고 적었다 — 확인할 수 없는 자리는 자리가 아니다`,
          );
        }
      }
    }

    // 동의 축은 상대가 끼는 원자만 갖는다.
    if (entry.touches === 'between' && entry.consent === 'none') {
      violateAtom(
        violations,
        entry.atom,
        'consentless-encounter',
        `${at}.consent`,
        `${atomLabel(entry.atom)} 는 상대가 있어야 성립하는데 동의 축이 비었다 — 받아들이는지 거스르는지가 이 원자를 가른다`,
      );
    }
    if (entry.touches !== 'between' && entry.consent !== 'none') {
      violateAtom(
        violations,
        entry.atom,
        'consent-without-other',
        `${at}.consent`,
        `${atomLabel(entry.atom)} 에는 동의할 상대가 없는데 동의 축 ${JSON.stringify(entry.consent)} 를 적었다`,
      );
    }

    // 닿는 의존 — 벗어나는 원자만 종을 가리지 않는다.
    if (entry.bearing === 'escape' && entry.kinds.length > 0) {
      violateAtom(
        violations,
        entry.atom,
        'kindful-escape',
        `${at}.kinds`,
        `${atomLabel(entry.atom)} 는 벗어나는 원자인데 종을 지목했다 — 벗어남은 어느 종의 의존에도 걸린다`,
      );
    }
    if (entry.bearing !== 'escape' && entry.kinds.length === 0) {
      violateAtom(
        violations,
        entry.atom,
        'aimless-atom',
        `${at}.kinds`,
        `${atomLabel(entry.atom)} 가 어느 의존에도 닿지 않는다 — 아무 결핍도 건드리지 못하는 행동은 아무도 고르지 않는다`,
      );
    }
    for (const [kindIndex, kind] of entry.kinds.entries()) {
      if (!(DEPENDENCY_KINDS as readonly string[]).includes(kind)) {
        violateAtom(
          violations,
          entry.atom,
          'aimless-atom',
          `${at}.kinds[${String(kindIndex)}]`,
          `D0 11종에 없는 의존 종 ${JSON.stringify(kind)} 에 닿는다고 적었다`,
        );
      }
    }

    // 보지 않고 바꿀 수 있는 것은 내 앎뿐이다 (O0 observed-manipulation).
    if (!entry.requiresObservation) {
      const outside = entry.writes.filter((ref) => ref.domain !== 'informational');
      if (outside.length > 0) {
        violateAtom(
          violations,
          entry.atom,
          'blind-manipulation',
          `${at}.writes`,
          `${atomLabel(entry.atom)} 는 대상을 안 봐도 된다면서 ${slotText(outside[0] as SlotRef)} 를 바꾼다 — 관측하지 못한 상태는 정밀하게 조작할 수 없다 (O0 observed-manipulation)`,
        );
      }
    }
  }

  // 짝은 서로를 가리켜야 한다.
  const byAtom = new Map(groundings.map((entry) => [entry.atom, entry]));
  const pairs: string[] = [];
  for (const [index, entry] of groundings.entries()) {
    if (entry.counterpart === null) continue;
    const other = byAtom.get(entry.counterpart);
    if (other === undefined || other.counterpart !== entry.atom) {
      violateAtom(
        violations,
        entry.atom,
        'broken-pair',
        `$.groundings[${String(index)}].counterpart`,
        `${atomLabel(entry.atom)} 는 ${entry.counterpart} 를 짝으로 가리키는데 그쪽은 ${other === undefined ? '걸림 자체가 없다' : `${String(other.counterpart)} 를 가리킨다`}`,
      );
      continue;
    }
    if (entry.atom < other.atom) pairs.push(`${entry.atom}↔${other.atom}`);
  }

  // 서명이 같은 둘은 하나로 접힌다 — 16 이 최소 집합이라는 주장의 근거.
  const redundant: string[] = [];
  const signatures = new Map<string, ActionAtom>();
  for (const [index, entry] of groundings.entries()) {
    const signature = groundingSignature(entry);
    const first = signatures.get(signature);
    if (first === undefined) {
      signatures.set(signature, entry.atom);
      continue;
    }
    redundant.push(`${first}↔${entry.atom}`);
    violateAtom(
      violations,
      entry.atom,
      'redundant-atom',
      `$.groundings[${String(index)}]`,
      `${atomLabel(entry.atom)} 와 ${atomLabel(first)} 가 축·바꾸는 자리·치르는 자리까지 모두 같다 — 둘은 한 원자다`,
    );
  }

  // 채울 수 없는 종 — 예외로 선언되지 않았으면 거부한다.
  const byKind: Record<string, ActionAtom[]> = {};
  for (const kind of DEPENDENCY_KINDS) byKind[kind] = [];
  for (const entry of groundings) {
    if (entry.bearing !== 'fill') continue;
    for (const kind of entry.kinds) byKind[kind]?.push(entry.atom);
  }
  const declared = new Map(exceptions.map((entry) => [entry.kind, entry]));
  const unfillable: DependencyKind[] = [];
  for (const kind of DEPENDENCY_KINDS) {
    const fillers = byKind[kind] ?? [];
    if (fillers.length > 0) {
      if (declared.has(kind)) {
        violateAtom(
          violations,
          fillers[0] ?? '',
          'stale-exception',
          '$.unfillable',
          `${kind} 를 채울 수 없다고 적어 놓고 ${fillers.join(', ')} 가 채운다 — 예외가 낡았다`,
        );
      }
      continue;
    }
    unfillable.push(kind);
    if (!declared.has(kind)) {
      violateAtom(
        violations,
        '',
        'unfillable-kind',
        '$.unfillable',
        `${kind} 의존을 채우는 원자가 하나도 없다 — 압력만 오르고 갚을 길이 없는 자리다. 정말 그렇다면 예외로 선언하고 누가 갚는지를 적어라`,
      );
    }
  }

  const byTouch: Record<string, ActionAtom[]> = {};
  for (const touch of ATOM_TOUCHES) byTouch[touch] = [];
  for (const entry of groundings) byTouch[entry.touches]?.push(entry.atom);

  const blindAtoms = groundings
    .filter((entry) => !entry.requiresObservation)
    .map((entry) => entry.atom);

  return {
    ungrounded,
    duplicates,
    redundant,
    unfillable,
    byKind,
    byTouch,
    pairs,
    blindAtoms,
    violations,
    complete: groundings.length > 0 && violations.length === 0,
  };
}

/** 그 종의 의존을 채울 수 있는 원자들. */
export function atomsFilling(
  kind: DependencyKind,
  groundings: readonly AtomGrounding[] = ATOM_GROUNDINGS,
): readonly ActionAtom[] {
  return groundings
    .filter((entry) => entry.bearing === 'fill' && entry.kinds.includes(kind))
    .map((entry) => entry.atom);
}

/** 그 종의 의존에 어떻게든 닿는 원자들 — 채우거나 지키거나 지우거나 벗어난다. */
export function atomsTouching(
  kind: DependencyKind,
  groundings: readonly AtomGrounding[] = ATOM_GROUNDINGS,
): readonly ActionAtom[] {
  return groundings
    .filter((entry) => entry.bearing === 'escape' || entry.kinds.includes(kind))
    .map((entry) => entry.atom);
}

/** 걸림을 한 줄 판정으로 접는다 — 터미널·배지용. */
export function atomGroundingVerdict(report: AtomGroundingReport): string {
  if (report.complete) {
    return `열여섯이 전부 세계에 걸린다 (짝 ${String(report.pairs.length)}쌍 · 보지 않고 되는 원자 ${String(report.blindAtoms.length)} · 채울 수 없는 종 ${String(report.unfillable.length)} — 전부 선언된 예외)`;
  }
  const reasons: string[] = [];
  if (report.ungrounded.length > 0) reasons.push(`걸림 없는 원자 ${report.ungrounded.join(', ')}`);
  if (report.redundant.length > 0) reasons.push(`접히는 원자 ${report.redundant.join(', ')}`);
  if (report.unfillable.length > 0) {
    reasons.push(`채울 수 없는 종 ${report.unfillable.join(', ')}`);
  }
  const rest = [...new Set(report.violations.map((violation) => violation.rule))];
  if (reasons.length === 0) return `걸림이 막혔다 — ${rest.join(', ')}`;
  return reasons.join(' · ');
}

/** 화면·터미널이 함께 쓰는 요약 줄. */
export function atomGroundingSummary(report: AtomGroundingReport): readonly string[] {
  return [
    `손대는 곳: ${ATOM_TOUCHES.map((touch) => `${touch} ${String((report.byTouch[touch] ?? []).length)}`).join(' · ')}`,
    `동의로 갈리는 짝: ${report.pairs.join(' · ')}`,
    `보지 않고 되는 원자: ${report.blindAtoms.length === 0 ? '(없다)' : report.blindAtoms.join(', ')}`,
    `채울 수 없는 종: ${report.unfillable.length === 0 ? '(없다)' : report.unfillable.join(', ')}`,
  ];
}
