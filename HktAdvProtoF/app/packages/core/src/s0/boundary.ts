// S0-a 주체 경계와 그래프 자리 — "어디까지가 나인가" 와 "나는 무엇을 매달고 있는가".
//
// 원문 S0 의 인터페이스는 `boundaries` 로 시작해서 네 개의 `...GraphId` 로 끝난다.
// 그 두 끝이 여기 있다. 가운데(감지·의존·유지·능력)는 S0-b~d 가 채운다.
//
// **경계가 왜 먼저인가.** 주체는 상태를 갖지 않는다 — 상태는 언제나 "누구의" 값이고(O2 ofId),
// 조직·국가·신은 자기 몸이 없다. 국가의 허기는 어디에 적히는가? 경계가 그것을 답한다:
// 경계 안의 존재들이 이 주체가 걸려 있는 자리다. 경계 없는 주체는 세계에서 아무것도
// 잃지 않으므로 아무것도 걸지 않는다 — O0 "모든 변화에는 대가가 따른다" 가 그런 주체에게는
// 적용될 자리가 없다. 그래서 주체 종류마다 최소한의 경계를 요구한다.
//
// **그래프 ID 가 왜 유래에서 나와야 하는가.** 기억·믿음·의존·가능성은 아직 없는 계층(R5·R4·D·P)의
// 것이다. S0 은 그 자리만 연다. 자리를 열 때 ID 를 손으로 지으면 같은 주체가 실행마다 다른
// 그래프를 가리키게 되어 리플레이가 깨진다 — V1 의 태도 그대로, 식별자는 유래에서 나온다.

import { childId, idKind, type Id } from '../v1/id.ts';
import { SUBJECT_KINDS, type Subject, type SubjectKind } from '../o1/being.ts';
import { violateSubject, type SubjectRef, type SubjectViolation } from './violation.ts';

/** 경계의 종류 4종. */
export const BOUNDARY_KINDS = [
  'body', // 신체·본체 — 사람·생물이 걸려 있는 사물
  'territory', // 영역 — 조직·국가의 장소, 신의 신역
  'membership', // 구성원 — 조직·국가를 이루는 주체들
  'anchor', // 앵커 — 신이 세계에 걸린 지점 (O0 emergent-divinity)
] as const;
export type BoundaryKind = (typeof BOUNDARY_KINDS)[number];

/** 경계 대상이 어떤 존재여야 하는가 — V1 ID 접두사로 판별한다 (O2 HolderKind 와 같은 방식). */
export type BoundaryHolder = 'subject' | 'entity';

/** 경계 종류 하나의 선언. */
export interface BoundarySpec {
  readonly kind: BoundaryKind;
  /** 한국어 이름 (화면 표기) */
  readonly label: string;
  readonly holder: BoundaryHolder;
  /** 이 경계가 여는 것 한 줄 */
  readonly holds: string;
}

export const BOUNDARY_SPECS: readonly BoundarySpec[] = [
  {
    kind: 'body',
    label: '신체',
    holder: 'entity',
    holds: '이 주체가 깎이면 함께 깎이는 사물 — 생물 상태(체력·허기·독)가 적히는 자리',
  },
  {
    kind: 'territory',
    label: '영역',
    holder: 'entity',
    holds: '이 주체가 미치는 장소 — 통행·재고·생태 상태가 적히는 자리',
  },
  {
    kind: 'membership',
    label: '구성원',
    holder: 'subject',
    holds: '이 주체를 이루는 다른 주체 — 조직·국가는 구성원을 통해서만 세계에 닿는다',
  },
  {
    kind: 'anchor',
    label: '앵커',
    holder: 'entity',
    holds: '신이 세계에 걸린 지점 — 초월 상태(anchor·divineDomain)가 적히는 자리',
  },
];

/** 주체가 스스로 여는 범위 하나. */
export interface Boundary {
  readonly kind: BoundaryKind;
  /** 경계 안에 있는 것 — 종류는 BoundarySpec.holder 가 정한다 */
  readonly ofId: Id;
  /** 왜 이것이 이 주체의 경계인가 — 근거 없는 경계는 세계를 조용히 넓힌다 */
  readonly note: string;
}

/** 주체 종류마다 반드시 있어야 하는 경계. */
export interface BoundaryRequirement {
  readonly subjectKind: SubjectKind;
  readonly required: readonly BoundaryKind[];
  readonly reason: string;
}

export const BOUNDARY_REQUIREMENTS: readonly BoundaryRequirement[] = [
  {
    subjectKind: 'person',
    required: ['body'],
    reason: '사람은 몸으로 세계에 걸린다 — 허기·부상이 적힐 자리가 없으면 무엇도 잃지 않는다.',
  },
  {
    subjectKind: 'creature',
    required: ['body'],
    reason: '생물도 같다. 서식지(territory)는 종에 따라 있을 수도 없을 수도 있으므로 요구하지 않는다.',
  },
  {
    subjectKind: 'organization',
    required: ['membership'],
    reason:
      '조직은 몸이 없다 — 구성원을 통해서만 세계에 닿는다. 근거지(territory)는 유랑 조직이 있으므로 요구하지 않는다.',
  },
  {
    subjectKind: 'nation',
    required: ['membership', 'territory'],
    reason:
      '국가는 영역과 구성원 둘 다로 정의된다 — 영역 없는 국가는 조직이고, 구성원 없는 영역은 장소일 뿐이다.',
  },
  {
    subjectKind: 'god',
    required: ['anchor'],
    reason:
      'O0 emergent-divinity 가 이미 요구한다 — 세계에 걸리지 않은 신은 아무것도 바꾸지 못한다. 신역(territory)은 앵커에서 자란다.',
  },
];

/** 주체가 매다는 그래프 4종 — 원문 S0 의 네 `...GraphId`. */
export const SUBJECT_GRAPH_KINDS = ['memory', 'belief', 'dependency', 'possibility'] as const;
export type SubjectGraphKind = (typeof SUBJECT_GRAPH_KINDS)[number];

/** 주체에 매달린 그래프 자리 4종. 채우는 것은 뒷 계층이고, S0 은 자리를 연다. */
export interface SubjectGraphIds {
  readonly memoryStoreId: Id;
  readonly beliefGraphId: Id;
  readonly dependencyGraphId: Id;
  readonly possibilityGraphId: Id;
}

/** 그래프 자리 하나의 선언 — 어느 질문에 답하고 누가 채우는가. */
export interface SubjectGraphSpec {
  readonly kind: SubjectGraphKind;
  readonly field: keyof SubjectGraphIds;
  readonly label: string;
  /** 원문 S0 다섯 질문 중 어느 것을 여는 자리인가 */
  readonly question: string;
  /** 이 자리를 실제로 채우는 모듈 */
  readonly owner: string;
}

export const SUBJECT_GRAPH_SPECS: readonly SubjectGraphSpec[] = [
  {
    kind: 'memory',
    field: 'memoryStoreId',
    label: '기억 저장소',
    question: '무엇을 기억하는가?',
    owner: 'R5',
  },
  {
    kind: 'belief',
    field: 'beliefGraphId',
    label: '믿음 그래프',
    question: '무엇을 감지하는가? (감지한 것이 쌓이는 곳)',
    owner: 'R4',
  },
  {
    kind: 'dependency',
    field: 'dependencyGraphId',
    label: '의존 그래프',
    question: '무엇에 의존하는가?',
    owner: 'D1~D4',
  },
  {
    kind: 'possibility',
    field: 'possibilityGraphId',
    label: '가능성 그래프',
    question: '무엇을 할 수 있는가?',
    owner: 'P3',
  },
];

/**
 * 주체 ID 에서 그래프 4종의 ID 를 만든다.
 * 같은 주체면 언제나 같은 네 ID — 그래야 리플레이가 성립한다 (V1).
 */
export function subjectGraphIds(subjectId: Id): SubjectGraphIds {
  return {
    memoryStoreId: childId(subjectId, 'memory', 'memory'),
    beliefGraphId: childId(subjectId, 'belief', 'belief'),
    dependencyGraphId: childId(subjectId, 'dependency', 'dependency'),
    possibilityGraphId: childId(subjectId, 'possibility', 'possibility'),
  };
}

/** 경계 종류 하나의 선언을 찾는다. */
export function boundarySpec(kind: BoundaryKind): BoundarySpec | null {
  return BOUNDARY_SPECS.find((spec) => spec.kind === kind) ?? null;
}

/** 주체 종류가 요구하는 경계. 선언이 없으면 빈 목록. */
export function requiredBoundaries(subjectKind: SubjectKind): readonly BoundaryKind[] {
  return (
    BOUNDARY_REQUIREMENTS.find((entry) => entry.subjectKind === subjectKind)?.required ?? []
  );
}

/** 경계 하나를 사람이 읽는 한 줄로. */
export function boundaryLabel(boundary: Boundary): string {
  return `${boundarySpec(boundary.kind)?.label ?? boundary.kind}=${boundary.ofId}`;
}

/**
 * 이 보유자가 주체의 경계 안인가 — O2 상태의 `ofId` 를 그대로 물어볼 수 있다.
 * 주체 자신은 언제나 자기 경계 안이다 (관계·정보 상태는 주체 자신에게 적힌다).
 */
export function withinBoundary(
  subject: SubjectRef,
  boundaries: readonly Boundary[],
  holderId: Id,
): boolean {
  if (holderId === subject.id) return true;
  return boundaries.some((boundary) => boundary.ofId === holderId);
}

/** 경계 안에 든 모든 보유자 ID — 주체 자신이 먼저, 그 뒤는 선언 순서. */
export function boundaryHolders(
  subject: SubjectRef,
  boundaries: readonly Boundary[],
): readonly Id[] {
  const out: Id[] = [subject.id];
  for (const boundary of boundaries) {
    if (!out.includes(boundary.ofId)) out.push(boundary.ofId);
  }
  return out;
}

/** 주체 신원 자체가 읽히는가 — 여기가 무너지면 뒤의 검사는 사유를 두 겹으로 쌓는다. */
export function checkSubjectRef(subject: SubjectRef, out: SubjectViolation[]): boolean {
  const before = out.length;
  if (idKind(subject.id) !== 'subject') {
    violateSubject(
      out,
      subject,
      'bad-subject',
      '$.id',
      `주체의 ID 는 subject 종류의 V1 결정적 ID 여야 한다 — ${JSON.stringify(subject.id)}`,
    );
  }
  if (typeof subject.name !== 'string' || subject.name === '') {
    violateSubject(out, subject, 'bad-subject', '$.name', '이름 없는 주체는 화면에 설 수 없다');
  }
  if (!SUBJECT_KINDS.includes(subject.subjectKind)) {
    violateSubject(
      out,
      subject,
      'bad-subject',
      '$.subjectKind',
      `주체 종류는 [${SUBJECT_KINDS.join(' ')}] 중 하나여야 한다 — ${JSON.stringify(subject.subjectKind)}`,
    );
  }
  return out.length === before;
}

/**
 * 경계 목록이 이 주체에게 온전한가.
 * 결함 있는 경계는 경계로 세지 않는다 — 몸을 잘못 지목한 사람은 몸이 없는 사람이다.
 */
export function checkBoundaries(
  subject: SubjectRef,
  boundaries: readonly Boundary[],
  out: SubjectViolation[],
): void {
  const sound = new Set<BoundaryKind>();

  for (const [index, boundary] of boundaries.entries()) {
    const path = `$.boundaries[${String(index)}]`;
    const before = out.length;
    const spec = boundarySpec(boundary.kind);
    if (spec === null) {
      violateSubject(
        out,
        subject,
        'bad-boundary',
        `${path}.kind`,
        `경계 종류는 [${BOUNDARY_KINDS.join(' ')}] 중 하나여야 한다 — ${JSON.stringify(boundary.kind)}`,
      );
      continue;
    }
    if (boundary.note === '') {
      violateSubject(
        out,
        subject,
        'bad-boundary',
        `${path}.note`,
        `근거 없는 ${spec.label} 경계는 세계를 조용히 넓힌다 — 왜 이것이 자기인지 적어야 한다`,
      );
    }
    const kind = idKind(boundary.ofId);
    if (kind === null) {
      violateSubject(
        out,
        subject,
        'bad-boundary',
        `${path}.ofId`,
        `경계 대상은 V1 결정적 ID 여야 한다 — ${JSON.stringify(boundary.ofId)}`,
      );
      continue;
    }
    if (kind !== spec.holder) {
      violateSubject(
        out,
        subject,
        'foreign-boundary',
        `${path}.ofId`,
        `${spec.label} 경계는 ${spec.holder} 를 받는다 — ${kind} 가 왔다`,
      );
    }
    // 자기 자신을 구성원으로 삼으면 조직은 자기 안에서 끝없이 되돌아간다.
    if (boundary.ofId === subject.id) {
      violateSubject(
        out,
        subject,
        'bad-boundary',
        `${path}.ofId`,
        '주체는 자기 자신을 경계로 삼을 수 없다 — 자기는 이미 자기 안이다',
      );
    }
    if (out.length === before) sound.add(boundary.kind);
  }

  for (const kind of requiredBoundaries(subject.subjectKind)) {
    if (sound.has(kind)) continue;
    const requirement = BOUNDARY_REQUIREMENTS.find(
      (entry) => entry.subjectKind === subject.subjectKind,
    );
    violateSubject(
      out,
      subject,
      'unbounded-subject',
      '$.boundaries',
      `${subject.subjectKind} 에게는 ${boundarySpec(kind)?.label ?? kind} 경계가 필요하다 — ${requirement?.reason ?? ''}`,
    );
  }
}

/** 매달린 그래프 ID 4종이 이 주체에서 유래했는가. */
export function checkGraphIds(
  subject: SubjectRef,
  ids: SubjectGraphIds,
  out: SubjectViolation[],
): void {
  const expected = subjectGraphIds(subject.id);
  for (const spec of SUBJECT_GRAPH_SPECS) {
    const given = ids[spec.field];
    const want = expected[spec.field];
    if (given === want) continue;
    violateSubject(
      out,
      subject,
      'manufactured-graph',
      `$.${spec.field}`,
      `${spec.label} 는 주체에서 유래해야 한다 (subjectGraphIds) — ${want} 가 와야 하는데 ${JSON.stringify(given)} 가 왔다`,
    );
  }
}

/** O1 Subject 를 S0 가 다루는 신원으로 좁힌다. */
export function subjectRef(subject: Subject): SubjectRef {
  return { id: subject.id, name: subject.name, subjectKind: subject.subjectKind };
}
