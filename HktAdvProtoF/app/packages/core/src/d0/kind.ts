// D0-a 대상 11종 확정 — 원문이 두 곳에 다르게 적은 "무엇에 기댈 수 있는가" 를 하나로 좁힌다.
//
// 원문은 의존 대상을 두 번 나열하는데 목록이 서로 다르다:
//
//   ModulePlan D0   자원 공간 환경 신체 다른주체 관계 정보 제도 규칙 의례 시간   (11)
//   ModulePlan D1   resource state space subject relationship
//                   information institution rule ritual                         (9)
//
// O2-a 에서 상태 영역이 그랬듯 여기서도 어느 한쪽을 조용히 고르면 "원문에 있는데 코드에 없다"
// 가 반복된다. 그래서 **대조 자체를 값으로 남긴다** — D1 이 적은 노드 종류 9개는 하나도 빠짐없이
// 확정 종으로 해소되어야 하고, 해소 방식(같음·갈림·목록 밖)과 그 근거가 여기 적힌다.
//
// 확정 결과는 D0 의 11종이며, 이는 O1 이 이름표로만 먼저 고정해 둔 `DEPENDENCY_KINDS` 와 같다 —
// D0 는 그 이름표에 근거와 성격을 붙인다.
//
// 갈림 하나가 이 대조의 핵심이다: D1 의 `state` 는 **누구의 상태인지**를 적지 않는다.
// 밖의 상태(환경)와 내 몸의 상태(신체)는 채우는 방법이 전혀 다르다 — 기온은 옮겨 가거나 막을 뿐
// 바꿀 수 없고, 체력은 먹고 자면 스스로 돌아온다. 하나로 두면 D2 가 종의 기본 의존을 지을 때
// 어느 쪽인지 알 수 없다. 그래서 D0 는 `state` 를 둘로 가른다.

import { compareStrings, stableSort } from '../v1/stable-sort.ts';
import { DEPENDENCY_KINDS, type DependencyKind } from '../o1/demand.ts';
import { violateKind, type DependencyKindViolation } from './violation.ts';

export { DEPENDENCY_KINDS, type DependencyKind };

/** 확정된 종 하나 — 무엇에 기대는 것이고 원문 어디서 왔는가. */
export interface DependencyKindSpec {
  readonly kind: DependencyKind;
  /** 한국어 이름 (화면 표기) */
  readonly label: string;
  /** ModulePlan D0 목록이 쓴 이름 — 이 이름이 확정 종에 붙는다 */
  readonly originalName: string;
  /** ModulePlan D1 `DependencyNode.kind` 가 쓴 이름. 그 목록에 없으면 null */
  readonly nodeKind: string | null;
  /** 이 종이 담는 것 한 줄 */
  readonly holds: string;
  /** 붉은 장막 세계에서의 예 — 종이 무엇인지는 예 하나로 갈린다 */
  readonly example: string;
  /** 원문 근거 위치 */
  readonly source: string;
}

/** ModulePlan D1 `DependencyNode.kind` 가 나열한 9개 — 하나도 빠짐없이 해소되어야 한다. */
export const NODE_KIND_NAMES = [
  'resource',
  'state',
  'space',
  'subject',
  'relationship',
  'information',
  'institution',
  'rule',
  'ritual',
] as const;

/** D1 이 적은 이름이 확정 종으로 해소되는 방식. */
export type KindResolutionKind =
  | 'same' // 이름도 뜻도 같다
  | 'split'; // 하나로 적힌 것이 둘 이상으로 갈린다

/** D1 이름 하나의 해소 기록. */
export interface KindResolution {
  /** ModulePlan D1 이 쓴 노드 종류 이름 */
  readonly original: string;
  readonly resolution: KindResolutionKind;
  /** 어느 확정 종으로 갔는가 — 갈림이면 둘 이상 */
  readonly kinds: readonly DependencyKind[];
  /** 왜 그렇게 해소되는가 — 원문 근거를 든다 */
  readonly reason: string;
}

/** 확정 11종. 순서는 O1 `DEPENDENCY_KINDS` 그대로다 — 화면·해시가 흔들리지 않게. */
export const DEPENDENCY_KIND_SPECS: readonly DependencyKindSpec[] = [
  {
    kind: 'resource',
    label: '자원',
    originalName: '자원 의존',
    nodeKind: 'resource',
    holds: '먹고 쓰고 태워 없애는 것 — 식량·물·광물·연료',
    example: '사냥꾼의 허기는 마을 창고의 말린 고기 재고에 걸린다',
    source: 'ModulePlan D0 자원 의존 + D1 kind resource',
  },
  {
    kind: 'space',
    label: '공간',
    originalName: '공간 의존',
    nodeKind: 'space',
    holds: '있어야 할 자리 — 거처·사냥터·통로·영역',
    example: '몰이꾼은 장막이 걷힌 협곡 어귀에 있어야 사냥을 시작할 수 있다',
    source: 'ModulePlan D0 공간 의존 + D1 kind space',
  },
  {
    kind: 'environment',
    label: '환경',
    originalName: '환경 의존',
    nodeKind: 'state',
    holds: '내 밖에서 나를 둘러싼 상태 — 기온·대기·수원·개체군',
    example: '장막벌레는 협곡 바닥의 온기가 식으면 굳는다 — 온기는 누구의 것도 아니다',
    source:
      'ModulePlan D0 환경 의존 + D1 kind state 의 갈림. 밖의 상태는 옮겨 가거나 막을 뿐 채울 수 없다',
  },
  {
    kind: 'body',
    label: '신체',
    originalName: '신체 의존',
    nodeKind: 'state',
    holds: '내 몸이 지녀야 할 상태 — 기관·체력·수면·독',
    example: '몰이꾼의 눈이 멀면 붉은 빛을 읽을 통로 자체가 닫힌다 (S1 기관이 감각을 연다)',
    source:
      'ModulePlan D0 신체 의존 + D1 kind state 의 갈림. 내 몸의 상태는 먹고 자면 스스로 돌아온다',
  },
  {
    kind: 'subject',
    label: '주체',
    originalName: '다른 주체 의존',
    nodeKind: 'subject',
    holds: '그 사람·그 집단이 있어야 한다 — 아무나로 바뀌면 이 의존이 아니다',
    example: '어미를 섬기는 자들은 붉은 장막의 어미가 살아 있어야 선다',
    source: 'ModulePlan D0 다른 주체 의존 + D1 kind subject',
  },
  {
    kind: 'relationship',
    label: '관계',
    originalName: '관계 의존',
    nodeKind: 'relationship',
    holds: '나와 그 사이에 놓인 값 — 신뢰·소속·빚·약속',
    example: '상단은 고개 너머 마을의 신뢰가 남아 있어야 외상을 받는다',
    source: 'ModulePlan D0 관계 의존 + D1 kind relationship',
  },
  {
    kind: 'information',
    label: '정보',
    originalName: '정보 의존',
    nodeKind: 'information',
    holds: '알아야 하는 것 — 위치·방법·소문·비밀',
    example: '몰이꾼은 어느 약초가 마비독인지 알아야 굶주림을 독으로 갚지 않는다',
    source: 'ModulePlan D0 정보 의존 + D1 kind information',
  },
  {
    kind: 'institution',
    label: '제도',
    originalName: '제도 의존',
    nodeKind: 'institution',
    holds: '누가 허락했는가 — 소유권·자격·통행권·보호',
    example: '협곡을 낀 나라의 통행권이 없으면 고개는 열려 있어도 못 넘는다',
    source: 'ModulePlan D0 제도 의존 + D1 kind institution',
  },
  {
    kind: 'rule',
    label: '규칙',
    originalName: '규칙 의존',
    nodeKind: 'rule',
    holds: '세계가 그렇게 작동해야 한다 — 능력을 성립시키는 규칙 자체',
    example: '사제의 장막 부름은 "의념은 대가를 요구한다" 는 규칙이 서 있어야 능력이 된다',
    source: 'ModulePlan D0 규칙 의존 + D1 kind rule',
  },
  {
    kind: 'ritual',
    label: '의례',
    originalName: '의례 의존',
    nodeKind: 'ritual',
    holds: '되풀이해야 유지되는 것 — 제사·숭배·서약의 갱신',
    example: '어미의 제단은 열흘마다 제물을 받아야 숭배량이 마르지 않는다',
    source: 'ModulePlan D0 의례 의존 + D1 kind ritual',
  },
  {
    kind: 'time',
    label: '시간',
    originalName: '시간 의존',
    nodeKind: null,
    holds: '기다려야 오는 것 — 주기·기한·냉각. 채울 수 없고 흐르기를 기다릴 뿐이다',
    example: '붉은 장막은 열두 틱마다 걷힌다 — 아무도 그 시각을 앞당기지 못한다',
    source:
      'ModulePlan D0 시간 의존 (D1 노드 종류 목록에는 없다) + Q0 요구 8종의 time. 대상이 없는 유일한 종이다',
  },
];

/** D1 이 적은 9개가 확정 종으로 어떻게 해소되는가. */
export const KIND_RECONCILIATION: readonly KindResolution[] = [
  {
    original: 'resource',
    resolution: 'same',
    kinds: ['resource'],
    reason: '두 목록이 같은 이름으로 같은 것을 가리킨다.',
  },
  {
    original: 'state',
    resolution: 'split',
    kinds: ['environment', 'body'],
    reason:
      'D1 은 "상태에 의존한다" 라고만 적고 누구의 상태인지를 적지 않는다. 밖의 상태(기온·수원)는 옮겨 가거나 막을 뿐이고 내 몸의 상태(체력·수면)는 스스로 돌아온다 — 채우는 방법이 다르므로 D2 가 종의 기본 의존을 지을 때 갈라져 있어야 한다. D0 목록이 이미 환경·신체로 갈라 적었다.',
  },
  {
    original: 'space',
    resolution: 'same',
    kinds: ['space'],
    reason: '두 목록이 같은 이름으로 같은 것을 가리킨다.',
  },
  {
    original: 'subject',
    resolution: 'same',
    kinds: ['subject'],
    reason: 'D0 은 "다른 주체 의존" 으로 풀어 적었을 뿐 같은 것이다.',
  },
  {
    original: 'relationship',
    resolution: 'same',
    kinds: ['relationship'],
    reason: '두 목록이 같은 이름으로 같은 것을 가리킨다.',
  },
  {
    original: 'information',
    resolution: 'same',
    kinds: ['information'],
    reason: '두 목록이 같은 이름으로 같은 것을 가리킨다.',
  },
  {
    original: 'institution',
    resolution: 'same',
    kinds: ['institution'],
    reason: '두 목록이 같은 이름으로 같은 것을 가리킨다.',
  },
  {
    original: 'rule',
    resolution: 'same',
    kinds: ['rule'],
    reason: '두 목록이 같은 이름으로 같은 것을 가리킨다.',
  },
  {
    original: 'ritual',
    resolution: 'same',
    kinds: ['ritual'],
    reason: '두 목록이 같은 이름으로 같은 것을 가리킨다.',
  },
];

/** D0 목록에만 있고 D1 노드 종류 목록에는 없는 종 — 근거를 따로 든다. */
export const D0_ONLY_KINDS: readonly DependencyKind[] = ['time'];

/** 대조 결과 — 확정 11종이 원문 양쪽으로부터 온전히 서는가. */
export interface KindReconciliationReport {
  readonly kinds: readonly DependencyKind[];
  /** 해소되지 않은 D1 이름 */
  readonly unresolved: readonly string[];
  /** 확정 11종에 없는 곳으로 해소된 이름 (`이름→종`) */
  readonly danglingTargets: readonly string[];
  /** 근거(source)·담는 것(holds)·예(example)가 빈 종 */
  readonly unsourced: readonly DependencyKind[];
  /** DEPENDENCY_KIND_SPECS 에 없는 O1 이름표 — 이름만 있고 정의가 없다 */
  readonly undefinedKinds: readonly DependencyKind[];
  /** 두 번 적힌 종 */
  readonly duplicateKinds: readonly DependencyKind[];
  /** D1 목록에 없어서 근거를 따로 든 종 */
  readonly d0Only: readonly DependencyKind[];
  /** 스펙이 `nodeKind` 로 가리켰는데 D1 목록에 없는 이름 (`종→이름`) */
  readonly phantomNodeKinds: readonly string[];
  /** 두 목록이 겹치는 이름 */
  readonly sharedNames: readonly string[];
  readonly violations: readonly DependencyKindViolation[];
  readonly complete: boolean;
}

/** 원문 두 목록을 확정 종에 대조한다. 던지지 않는다 — 어긋남은 값으로 남는다. */
export function reconcileKinds(
  specs: readonly DependencyKindSpec[] = DEPENDENCY_KIND_SPECS,
  originals: readonly string[] = NODE_KIND_NAMES,
  resolutions: readonly KindResolution[] = KIND_RECONCILIATION,
): KindReconciliationReport {
  const violations: DependencyKindViolation[] = [];
  const defined = specs.map((spec) => spec.kind);
  const resolvedNames = new Set(resolutions.map((entry) => entry.original));

  const unresolved = originals.filter((name) => !resolvedNames.has(name));
  for (const name of unresolved) {
    violateKind(
      violations,
      '',
      'unresolved-original',
      '$.reconciliation',
      `원문 D1 이 적은 노드 종류 ${JSON.stringify(name)} 가 확정 11종 어디로도 가지 않았다 — 원문에 있는데 코드에 없다`,
    );
  }

  const danglingTargets: string[] = [];
  for (const entry of resolutions) {
    for (const kind of entry.kinds) {
      if (!defined.includes(kind)) {
        danglingTargets.push(`${entry.original}→${kind}`);
        violateKind(
          violations,
          kind,
          'dangling-resolution',
          '$.reconciliation',
          `${entry.original} 를 확정 11종에 없는 ${JSON.stringify(kind)} 로 보냈다`,
        );
      }
    }
    if (entry.kinds.length === 0) {
      danglingTargets.push(`${entry.original}→(없음)`);
      violateKind(
        violations,
        '',
        'dangling-resolution',
        '$.reconciliation',
        `${entry.original} 를 아무 종으로도 보내지 않았다 — 해소가 아니라 삭제다`,
      );
    }
  }

  const duplicateKinds = stableSort(
    defined.filter((kind, index) => defined.indexOf(kind) !== index),
    compareStrings,
  );
  for (const kind of duplicateKinds) {
    violateKind(violations, kind, 'duplicate-kind', '$.specs', `${kind} 가 두 번 적혔다`);
  }

  const undefinedKinds = DEPENDENCY_KINDS.filter((kind) => !defined.includes(kind));
  for (const kind of undefinedKinds) {
    violateKind(
      violations,
      kind,
      'undefined-kind',
      '$.specs',
      `O1 이 이름표로 고정한 ${kind} 에 정의가 없다 — 이름만 있는 칸은 D2 가 채우지 못한다`,
    );
  }

  const unsourced: DependencyKind[] = [];
  for (const [index, spec] of specs.entries()) {
    const missing = [
      spec.source === '' ? 'source' : '',
      spec.holds === '' ? 'holds' : '',
      spec.example === '' ? 'example' : '',
      spec.originalName === '' ? 'originalName' : '',
    ].filter((field) => field !== '');
    if (missing.length > 0) {
      unsourced.push(spec.kind);
      violateKind(
        violations,
        spec.kind,
        'unsourced-kind',
        `$.specs[${String(index)}].${missing[0] ?? ''}`,
        `${spec.kind} 가 ${missing.join('·')} 를 대지 못한다 — 근거 없는 종은 지어낸 것이다`,
      );
    }
  }

  const phantomNodeKinds: string[] = [];
  for (const [index, spec] of specs.entries()) {
    if (spec.nodeKind !== null && !originals.includes(spec.nodeKind)) {
      phantomNodeKinds.push(`${spec.kind}→${spec.nodeKind}`);
      violateKind(
        violations,
        spec.kind,
        'unsourced-kind',
        `$.specs[${String(index)}].nodeKind`,
        `원문 D1 목록에 없는 이름 ${JSON.stringify(spec.nodeKind)} 를 근거로 든다`,
      );
    }
  }

  const d0Only = specs.filter((spec) => spec.nodeKind === null).map((spec) => spec.kind);
  const sharedNames = stableSort(
    originals.filter((name) => (DEPENDENCY_KINDS as readonly string[]).includes(name)),
    compareStrings,
  );

  return {
    kinds: defined,
    unresolved,
    danglingTargets,
    unsourced,
    undefinedKinds,
    duplicateKinds,
    d0Only,
    phantomNodeKinds,
    sharedNames,
    violations,
    complete: specs.length > 0 && violations.length === 0,
  };
}

/** 대조를 한 줄 판정으로 접는다 — 터미널·배지용. */
export function kindReconciliationVerdict(report: KindReconciliationReport): string {
  if (report.complete) {
    return `원문 두 목록이 ${String(report.kinds.length)}종으로 해소됐다 (겹침 ${String(report.sharedNames.length)} · 갈림 1 · D0 목록에만 있는 종 ${String(report.d0Only.length)})`;
  }
  const reasons: string[] = [];
  if (report.kinds.length === 0) reasons.push('확정 종이 없다');
  if (report.unresolved.length > 0) reasons.push(`해소되지 않은 원문 이름 ${report.unresolved.join(', ')}`);
  if (report.danglingTargets.length > 0) {
    reasons.push(`없는 종으로 보낸 이름 ${report.danglingTargets.join(', ')}`);
  }
  if (report.unsourced.length > 0) reasons.push(`근거 없는 종 ${report.unsourced.join(', ')}`);
  if (report.undefinedKinds.length > 0) {
    reasons.push(`이름만 있는 종 ${report.undefinedKinds.join(', ')}`);
  }
  if (report.duplicateKinds.length > 0) {
    reasons.push(`두 번 적힌 종 ${report.duplicateKinds.join(', ')}`);
  }
  if (report.phantomNodeKinds.length > 0) {
    reasons.push(`원문에 없는 이름을 든 종 ${report.phantomNodeKinds.join(', ')}`);
  }
  return reasons.join(' · ');
}

/** 종 정의 하나를 찾는다. */
export function kindSpec(kind: DependencyKind): DependencyKindSpec | null {
  return DEPENDENCY_KIND_SPECS.find((spec) => spec.kind === kind) ?? null;
}

/** 문자열이 확정 11종 중 하나인가. */
export function isDependencyKind(value: unknown): value is DependencyKind {
  return typeof value === 'string' && (DEPENDENCY_KINDS as readonly string[]).includes(value);
}

/** 종의 한국어 이름 — 화면·사유 문장용. */
export function kindLabel(kind: DependencyKind): string {
  return kindSpec(kind)?.label ?? kind;
}
