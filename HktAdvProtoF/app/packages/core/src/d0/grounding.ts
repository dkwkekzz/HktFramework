// D0-b 종별 세계 걸림 — 열한 칸이 이름뿐인 목록이 되지 않도록 각 종을 세계에 못박는다.
//
// 분류표는 쉽다. "자원·공간·환경…" 을 나열하는 것은 누구나 한다. 그러나 그 목록으로 세계가
// 굴러가려면 각 칸이 네 가지에 답해야 한다:
//
//   ① 대상이 세계의 무엇인가   — O1 12타입 중 무엇으로 서는가 (사물? 주체? 상태? 규칙?)
//   ② 충족을 어디서 읽는가     — O2 9영역 중 어느 자리를 봐야 "채워졌다" 를 판정하는가
//   ③ 쓰면 줄어드는가          — D1 간선 `consumes` 가 걸릴 수 있는 종인가
//   ④ 갈아탈 수 있는가         — P1 의 대체·위임이 성립하는 종인가
//
// ②를 못 대는 종은 D4 가 압력을 계산할 수 없다 — 읽을 자리가 없으면 결핍도 없다. 그래서
// **아무 자리도 읽지 않는 종은 거부한다.** 예외는 시간 하나뿐이고, 그것도 근거가 있다:
// 세계에 시간을 적을 자리가 O2 에 없다. 시간은 V1 틱에서 읽는다.
//
// 거꾸로도 본다. 세계에 자리가 있는데 아무 종도 그것에 기대지 않으면, 그 영역의 상태는
// 아무의 결핍도 만들지 못한다 — 장식이다. 그래서 9영역 커버리지도 함께 검사한다.
//
// 그리고 이 하위 작업의 한 문장: **의존의 종류는 대상이 정하는 것이 아니라 기대는 방식이 정한다.**
// 같은 규칙 하나라도 법으로 두르면 제도, 세계의 작동으로 기대면 규칙, 되풀이해야 유지되는
// 것으로 기대면 의례다. 그래서 `kindsAccepting` 은 하나가 아니라 여럿을 돌려준다 —
// 그중 무엇인지는 선언이 가르고, D0 는 그 선언이 거짓인 경우만 막는다.

import type { Id } from '../v1/id.ts';
import { compareStrings, stableSort } from '../v1/stable-sort.ts';
import {
  ENTITY_KINDS,
  STATE_DOMAINS,
  isEntity,
  isState,
  type EntityKind,
  type StateDomain,
} from '../o1/being.ts';
import { ONTOLOGY_KINDS, type OnticBase, type OntologyKind } from '../o1/kinds.ts';
import type { Dependency } from '../o1/demand.ts';
import { DEPENDENCY_KINDS, kindLabel, type DependencyKind } from './kind.ts';
import { violateKind, type DependencyKindViolation } from './violation.ts';

/** 대상을 가리키는 방식. */
export const TARGETING_MODES = [
  'named', // 그 대상이어야 한다 — 다른 것으로 바뀌면 이 의존이 아니다
  'anonymous', // 종류로만 걸린다 — 아무 식량이든
  'either', // 둘 다 가능하다 — 이 광맥이어도, 아무 광물이어도
  'none', // 가리킬 대상이 없다 (시간)
] as const;
export type TargetingMode = (typeof TARGETING_MODES)[number];

/** 종 하나가 세계에 걸리는 방식. */
export interface KindGrounding {
  readonly kind: DependencyKind;
  /** 대상이 O1 12타입 중 무엇으로 서는가. 시간은 비어 있다 */
  readonly targetKinds: readonly OntologyKind[];
  /** 대상이 사물이면 어느 사물인가 — `targetKinds` 에 Entity 가 있을 때만 채운다 */
  readonly targetEntityKinds: readonly EntityKind[];
  /** 충족을 어느 영역에서 읽는가 (O2 9영역) */
  readonly readDomains: readonly StateDomain[];
  /** 세계 상태가 아니라 V1 틱에서 읽는가 — 시간 종만 참 */
  readonly readsClock: boolean;
  readonly targeting: TargetingMode;
  /** 쓰면 그 대상이 줄어드는가 — D1 간선 `consumes` 의 전제 */
  readonly depletes: boolean;
  /** 남에게 맡기거나 넘겨받을 수 있는가 — P1 위임·대체의 전제 */
  readonly transferable: boolean;
  /** 왜 이렇게 걸리는가 — 근거 없는 걸림은 걸림이 아니다 */
  readonly note: string;
}

/** 종 11개의 세계 걸림. 순서는 `DEPENDENCY_KINDS` 그대로다. */
export const KIND_GROUNDINGS: readonly KindGrounding[] = [
  {
    kind: 'resource',
    targetKinds: ['Entity'],
    targetEntityKinds: ['material', 'object'],
    readDomains: ['economic', 'ecological'],
    readsClock: false,
    targeting: 'either',
    depletes: true,
    transferable: true,
    note: '창고의 재고와 서식지의 고갈로 읽는다. 먹으면 없어지므로 되풀이해서 다시 걸린다 — 굶주림이 끝나지 않는 이유다',
  },
  {
    kind: 'space',
    targetKinds: ['Entity'],
    targetEntityKinds: ['place', 'structure'],
    readDomains: ['physical'],
    readsClock: false,
    targeting: 'named',
    depletes: false,
    transferable: false,
    note: '거기 있는가·닿을 수 있는가로 읽는다(위치·거리·차폐). 장소는 써도 없어지지 않는다 — 다만 붐빈다(D5 경합)',
  },
  {
    kind: 'environment',
    targetKinds: ['State'],
    targetEntityKinds: [],
    readDomains: ['physical', 'ecological'],
    readsClock: false,
    targeting: 'either',
    depletes: false,
    transferable: false,
    note: '장소가 지닌 값(온도·개체군·수용력)으로 읽는다. 넘겨받을 수 없다 — 옮겨 가거나 막을 뿐이다',
  },
  {
    kind: 'body',
    targetKinds: ['State'],
    targetEntityKinds: [],
    readDomains: ['biological'],
    readsClock: false,
    targeting: 'named',
    depletes: true,
    transferable: false,
    note: '내 몸의 값(체력·허기·독)으로 읽는다. 쓰면 깎이지만 먹고 자면 스스로 돌아온다 — 그것이 환경과 갈리는 자리다',
  },
  {
    kind: 'subject',
    targetKinds: ['Subject'],
    targetEntityKinds: [],
    readDomains: ['physical', 'biological'],
    readsClock: false,
    targeting: 'named',
    depletes: false,
    transferable: false,
    note: '그가 살아 있고 닿는 곳에 있는가로 읽는다. 아무나로 바뀌어도 되면 그것은 주체 의존이 아니라 자원·관계 의존이다',
  },
  {
    kind: 'relationship',
    targetKinds: ['State', 'Commitment'],
    targetEntityKinds: [],
    readDomains: ['relational'],
    readsClock: false,
    targeting: 'named',
    depletes: true,
    transferable: false,
    note: '나와 그 사이의 값(신뢰·빚·소속)이나 둘이 맺은 약속으로 읽는다. 청구할수록 깎인다 — 그래서 소모된다',
  },
  {
    kind: 'information',
    targetKinds: ['State', 'Claim'],
    targetEntityKinds: [],
    readDomains: ['informational'],
    readsClock: false,
    targeting: 'either',
    depletes: false,
    transferable: true,
    note: '아는가·얼마나 확신하는가로 읽는다. 나눠 줘도 내가 잃지 않는 유일한 종이다 — 그래서 퍼지고, 퍼지면 값이 떨어진다',
  },
  {
    kind: 'institution',
    targetKinds: ['State', 'Rule'],
    targetEntityKinds: [],
    readDomains: ['institutional'],
    readsClock: false,
    targeting: 'either',
    depletes: false,
    transferable: true,
    note: '법·자격·통행권으로 읽는다. 누군가 주고 누군가 뺏을 수 있다 — 그래서 제도는 목적의 표적이 된다',
  },
  {
    kind: 'rule',
    targetKinds: ['Rule'],
    targetEntityKinds: [],
    readDomains: ['psychic', 'transcendent'],
    readsClock: false,
    targeting: 'named',
    depletes: false,
    transferable: false,
    note: '그 규칙이 아직 서 있는가로 읽는다 — 조건 충족·활성 효과(의념), 신역·정당성(초월). 능력자는 자기 능력을 성립시키는 규칙에 기댄다',
  },
  {
    kind: 'ritual',
    targetKinds: ['Rule', 'Commitment'],
    targetEntityKinds: [],
    readDomains: ['psychic', 'transcendent'],
    readsClock: false,
    targeting: 'either',
    depletes: false,
    transferable: true,
    note: '되풀이가 남긴 값(숭배량·신념 압력)으로 읽는다. 남이 대신 치를 수 있다 — 그래서 사제가 생긴다',
  },
  {
    kind: 'time',
    targetKinds: [],
    targetEntityKinds: [],
    readDomains: [],
    readsClock: true,
    targeting: 'none',
    depletes: false,
    transferable: false,
    note: '세계에 시간을 적을 자리가 O2 에 없다 — 충족은 V1 틱에서 읽는다. 가리킬 대상이 없고 아무 자리도 읽지 않는 유일한 종이다',
  },
];

/** 종의 걸림 하나를 찾는다. */
export function kindGrounding(kind: DependencyKind): KindGrounding | null {
  return KIND_GROUNDINGS.find((entry) => entry.kind === kind) ?? null;
}

/** 걸림 검사 결과 — 열한 칸이 전부 세계에 닿아 있는가. */
export interface GroundingReport {
  /** 걸림이 없는 종 */
  readonly ungrounded: readonly DependencyKind[];
  /** 두 번 적힌 종 */
  readonly duplicates: readonly DependencyKind[];
  /** 아무 종도 읽지 않는 영역 — 세계에 자리가 있는데 아무도 기대지 않는다 */
  readonly uncoveredDomains: readonly StateDomain[];
  /** 영역별로 그것을 읽는 종들 */
  readonly byDomain: Readonly<Record<string, readonly DependencyKind[]>>;
  readonly violations: readonly DependencyKindViolation[];
  readonly complete: boolean;
}

/** 열한 칸이 세계에 온전히 걸리는가. 던지지 않는다 — 어긋남은 값으로 남는다. */
export function checkGroundings(
  groundings: readonly KindGrounding[] = KIND_GROUNDINGS,
  kinds: readonly DependencyKind[] = DEPENDENCY_KINDS,
): GroundingReport {
  const violations: DependencyKindViolation[] = [];
  const listed = groundings.map((entry) => entry.kind);

  const ungrounded = kinds.filter((kind) => !listed.includes(kind));
  for (const kind of ungrounded) {
    violateKind(
      violations,
      kind,
      'unreadable-kind',
      '$.groundings',
      `${kindLabel(kind)} 가 세계의 무엇에 걸리는지 적히지 않았다 — D2 는 이 종으로 아무것도 짓지 못한다`,
    );
  }

  const duplicates = stableSort(
    listed.filter((kind, index) => listed.indexOf(kind) !== index),
    compareStrings,
  );
  for (const kind of duplicates) {
    violateKind(violations, kind, 'duplicate-kind', '$.groundings', `${kind} 의 걸림이 두 번 적혔다`);
  }

  for (const [index, entry] of groundings.entries()) {
    const path = `$.groundings[${String(index)}]`;

    for (const target of entry.targetKinds) {
      if (!ONTOLOGY_KINDS.includes(target)) {
        violateKind(
          violations,
          entry.kind,
          'phantom-target-kind',
          `${path}.targetKinds`,
          `O1 12타입에 없는 대상이다 — ${JSON.stringify(target)}`,
        );
      }
    }
    for (const entityKind of entry.targetEntityKinds) {
      if (!ENTITY_KINDS.includes(entityKind)) {
        violateKind(
          violations,
          entry.kind,
          'phantom-target-kind',
          `${path}.targetEntityKinds`,
          `사물 6종에 없는 사물이다 — ${JSON.stringify(entityKind)}`,
        );
      }
    }
    if (entry.targetEntityKinds.length > 0 && !entry.targetKinds.includes('Entity')) {
      violateKind(
        violations,
        entry.kind,
        'phantom-target-kind',
        `${path}.targetEntityKinds`,
        '사물을 대상으로 받지 않는 종이 사물 종류를 적었다',
      );
    }
    if (entry.targetKinds.includes('Entity') && entry.targetEntityKinds.length === 0) {
      violateKind(
        violations,
        entry.kind,
        'phantom-target-kind',
        `${path}.targetEntityKinds`,
        '사물을 대상으로 받는데 어느 사물인지 적지 않았다 — 장소와 광물은 채우는 방법이 다르다',
      );
    }

    for (const domain of entry.readDomains) {
      if (!STATE_DOMAINS.includes(domain)) {
        violateKind(
          violations,
          entry.kind,
          'phantom-domain',
          `${path}.readDomains`,
          `O2 9영역에 없는 자리를 읽는다 — ${JSON.stringify(domain)}`,
        );
      }
    }
    if (entry.readDomains.length === 0 && !entry.readsClock) {
      violateKind(
        violations,
        entry.kind,
        'unreadable-kind',
        `${path}.readDomains`,
        `${kindLabel(entry.kind)} 는 충족을 읽을 자리가 없다 — 읽을 자리가 없으면 결핍도 없고, D4 는 압력을 계산하지 못한다`,
      );
    }
    if (entry.readDomains.length > 0 && entry.readsClock) {
      violateKind(
        violations,
        entry.kind,
        'unreadable-kind',
        `${path}.readsClock`,
        '세계의 자리와 틱을 함께 읽는다 — 어느 쪽이 충족을 정하는지 알 수 없다',
      );
    }

    if (entry.targeting === 'none') {
      if (entry.targetKinds.length > 0) {
        violateKind(
          violations,
          entry.kind,
          'unwanted-target',
          `${path}.targetKinds`,
          '가리킬 대상이 없다고 적어 놓고 대상 종류를 들었다',
        );
      }
    } else if (entry.targetKinds.length === 0) {
      violateKind(
        violations,
        entry.kind,
        'targetless-kind',
        `${path}.targetKinds`,
        `${kindLabel(entry.kind)} 가 무엇을 가리키는지 적지 않았다 — 대상 없는 의존은 시간뿐이다`,
      );
    }

    if (entry.note === '') {
      violateKind(
        violations,
        entry.kind,
        'unsourced-kind',
        `${path}.note`,
        '왜 그렇게 걸리는지 적지 않았다 — 근거 없는 걸림은 걸림이 아니다',
      );
    }
  }

  const byDomain: Record<string, readonly DependencyKind[]> = {};
  for (const domain of STATE_DOMAINS) {
    byDomain[domain] = groundings
      .filter((entry) => entry.readDomains.includes(domain))
      .map((entry) => entry.kind);
  }
  const uncoveredDomains = STATE_DOMAINS.filter((domain) => (byDomain[domain] ?? []).length === 0);
  for (const domain of uncoveredDomains) {
    violateKind(
      violations,
      '',
      'uncovered-domain',
      '$.groundings',
      `세계에 ${domain} 자리가 있는데 아무 종도 그것에 기대지 않는다 — 아무의 결핍도 만들지 않는 영역은 장식이다`,
    );
  }

  return {
    ungrounded,
    duplicates,
    uncoveredDomains,
    byDomain,
    violations,
    complete: groundings.length > 0 && violations.length === 0,
  };
}

/** 걸림 검사를 한 줄 판정으로 접는다. */
export function groundingVerdict(report: GroundingReport): string {
  if (report.complete) {
    const covered = STATE_DOMAINS.length - report.uncoveredDomains.length;
    return `열한 종이 전부 세계에 걸린다 (9영역 중 ${String(covered)}개가 읽히고, 시간만 틱을 읽는다)`;
  }
  const reasons: string[] = [];
  if (report.ungrounded.length > 0) reasons.push(`걸림 없는 종 ${report.ungrounded.join(', ')}`);
  if (report.duplicates.length > 0) reasons.push(`두 번 적힌 종 ${report.duplicates.join(', ')}`);
  if (report.uncoveredDomains.length > 0) {
    reasons.push(`아무도 기대지 않는 영역 ${report.uncoveredDomains.join(', ')}`);
  }
  const rest = report.violations
    .filter(
      (violation) =>
        violation.rule !== 'uncovered-domain' &&
        violation.rule !== 'duplicate-kind' &&
        !(violation.rule === 'unreadable-kind' && violation.path === '$.groundings'),
    )
    .map((violation) => `${violation.kind}: ${violation.rule}`);
  reasons.push(...[...new Set(rest)]);
  return reasons.join(' · ');
}

/** 이 원소를 대상으로 받을 수 있는 종들 — 하나가 아니라 여럿일 수 있다. */
export function kindsAccepting(target: OnticBase): readonly DependencyKind[] {
  return KIND_GROUNDINGS.filter((entry) => fitReason(entry, target) === null).map(
    (entry) => entry.kind,
  );
}

/** 걸림 하나가 이 원소를 받는가. 받으면 null, 아니면 사유 한 줄. */
function fitReason(grounding: KindGrounding, target: OnticBase): string | null {
  if (!grounding.targetKinds.includes(target.kind)) {
    if (grounding.targetKinds.length === 0) {
      return `${kindLabel(grounding.kind)} 에는 가리킬 대상이 없다 — ${target.kind} 을 걸 수 없다`;
    }
    return `${kindLabel(grounding.kind)} 의 대상은 [${grounding.targetKinds.join(' ')}] 중 하나여야 한다 — ${target.kind}`;
  }
  if (isEntity(target) && !grounding.targetEntityKinds.includes(target.entityKind)) {
    return `${kindLabel(grounding.kind)} 는 [${grounding.targetEntityKinds.join(' ')}] 사물에 걸린다 — ${target.entityKind} 는 다른 종의 대상이다`;
  }
  if (isState(target) && !grounding.readDomains.includes(target.domain)) {
    return `${kindLabel(grounding.kind)} 는 [${grounding.readDomains.join(' ')}] 자리를 읽는다 — ${target.domain} 상태는 이 종이 읽지 않는다`;
  }
  return null;
}

/** 선언한 종과 실제 대상이 맞는가. */
export interface TargetFit {
  readonly kind: DependencyKind;
  readonly targetId: Id | null;
  readonly fits: boolean;
  /** 이 원소를 받을 수 있는 다른 종들 — 어긋났을 때 무엇으로 적어야 하는지 알려 준다 */
  readonly accepting: readonly DependencyKind[];
  readonly violations: readonly DependencyKindViolation[];
}

/**
 * 선언한 종이 이 대상을 받을 수 있는가.
 * 대상이 null 이면 종류로만 걸린 의존이다 — 그때는 가리킴 방식만 본다.
 */
export function fitTarget(
  kind: DependencyKind,
  target: OnticBase | null,
  path = '$',
): TargetFit {
  const violations: DependencyKindViolation[] = [];
  const grounding = kindGrounding(kind);

  if (grounding === null) {
    violateKind(
      violations,
      kind,
      'undefined-kind',
      `${path}.dependencyKind`,
      `확정 11종에 없는 종이다 — ${JSON.stringify(kind)}`,
    );
    return { kind, targetId: target?.id ?? null, fits: false, accepting: [], violations };
  }

  if (target === null) {
    if (grounding.targeting === 'named') {
      violateKind(
        violations,
        kind,
        'kind-target-mismatch',
        `${path}.targetId`,
        `${kindLabel(kind)} 는 그 대상이어야 하는 의존이다 — 종류로만 걸 수 없다. ${grounding.note}`,
      );
    }
    return {
      kind,
      targetId: null,
      fits: violations.length === 0,
      accepting: [],
      violations,
    };
  }

  if (grounding.targeting === 'none') {
    violateKind(
      violations,
      kind,
      'unwanted-target',
      `${path}.targetId`,
      `${kindLabel(kind)} 에는 가리킬 대상이 없다 — ${target.kind} ${target.id} 를 걸어도 아무도 그것을 채우지 못한다`,
    );
    return { kind, targetId: target.id, fits: false, accepting: kindsAccepting(target), violations };
  }

  const reason = fitReason(grounding, target);
  if (reason !== null) {
    const accepting = kindsAccepting(target);
    const rule =
      isState(target) && grounding.targetKinds.includes('State')
        ? 'off-domain-state'
        : 'kind-target-mismatch';
    violateKind(
      violations,
      kind,
      rule,
      `${path}.targetId`,
      accepting.length === 0
        ? reason
        : `${reason} (이 대상은 [${accepting.join(' ')}] 로 걸 수 있다)`,
    );
    return { kind, targetId: target.id, fits: false, accepting, violations };
  }

  return { kind, targetId: target.id, fits: true, accepting: kindsAccepting(target), violations };
}

/**
 * O1 `Dependency` 하나가 선언한 종과 대상이 맞는가.
 * 대상 원소는 세계에서 찾아 넘긴다 — 못 찾으면 null 을 넘긴다(종류로만 걸린 의존과 같다).
 */
export function checkDependencyTarget(
  dependency: Dependency,
  target: OnticBase | null,
  path = '$',
): readonly DependencyKindViolation[] {
  return fitTarget(dependency.dependencyKind, dependency.targetId === null ? null : target, path)
    .violations;
}

/** 걸림 하나를 한 줄로 접는다 — 분류표용. */
export function groundingSummary(grounding: KindGrounding): string {
  const where = grounding.readsClock ? 'V1 틱' : grounding.readDomains.join('·');
  const what =
    grounding.targetKinds.length === 0 ? '대상 없음' : grounding.targetKinds.join('·');
  const flags = [
    grounding.depletes ? '쓰면 준다' : '줄지 않는다',
    grounding.transferable ? '갈아탈 수 있다' : '갈아탈 수 없다',
  ];
  return `${what} → ${where} (${flags.join(' · ')})`;
}
