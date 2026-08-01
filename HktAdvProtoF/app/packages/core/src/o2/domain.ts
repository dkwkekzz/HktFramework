// O2-a 영역 확정 — 원문이 두 곳에서 다르게 적은 상태 영역을 하나로 좁힌다.
//
// 원문은 상태 영역을 두 번 나열하는데 목록이 서로 다르다:
//
//   MasterPlan §12.1   physical biological ability social institutional
//                      economic informational spatial historical
//   ModulePlan O2      물리 생물 생태 관계 제도 경제 정보 의념 초월
//
// 둘 다 "9영역" 이라 부르지만 겹치는 것은 6개뿐이다. 어느 한쪽을 조용히 고르면
// 나중에 "원문에 있는데 스키마에 없다" 가 반복된다. 그래서 **대조 자체를 값으로 남긴다** —
// MasterPlan 이 쓴 이름 9개는 하나도 빠짐없이 확정 영역으로 해소되어야 하고,
// 해소 방식(같음·개명·흡수·영역 아님)과 그 근거가 여기 적힌다.
//
// 확정 결과는 ModulePlan O2 의 9영역이며, 이는 O1 이 이름표로만 먼저 고정해 둔
// `STATE_DOMAINS` 와 같다 — O2 는 그 이름표에 근거와 필드 트리를 붙인다.

import { compareStrings, stableSort } from '../v1/stable-sort.ts';
import { STATE_DOMAINS, type StateDomain } from '../o1/being.ts';

export { STATE_DOMAINS, type StateDomain };

/** 상태를 지닐 수 있는 존재의 종류 — V1 ID 접두사로 판별한다 (O1 Subject/Entity). */
export const HOLDER_KINDS = ['subject', 'entity', 'any'] as const;
export type HolderKind = (typeof HOLDER_KINDS)[number];

/** 확정된 영역 하나 — 무엇을 담는 영역이고 원문 어디서 왔는가. */
export interface DomainSpec {
  readonly domain: StateDomain;
  /** 한국어 이름 (화면 표기) */
  readonly label: string;
  /** 이 영역이 담는 것 한 줄 */
  readonly holds: string;
  /** 원문 근거 위치 */
  readonly source: string;
}

/** MasterPlan §12.1 의 이름이 확정 영역으로 해소되는 방식. */
export type ResolutionKind =
  | 'same' // 이름도 뜻도 같다
  | 'renamed' // 같은 것을 다른 이름으로 불렀다
  | 'absorbed' // 다른 영역의 하위로 들어간다
  | 'not-a-domain'; // 상태 영역이 아니다 — 다른 계층이 담는다

/** 원문 이름 하나의 해소 기록. */
export interface DomainResolution {
  /** MasterPlan §12.1 이 쓴 필드 이름 */
  readonly original: string;
  readonly resolution: ResolutionKind;
  /** 어느 확정 영역으로 갔는가. 'not-a-domain' 이면 null */
  readonly domain: StateDomain | null;
  /** 왜 그렇게 해소되는가 — 원문 근거를 든다 */
  readonly reason: string;
}

/** MasterPlan §12.1 이 나열한 상태 영역 9개 — 하나도 빠짐없이 해소되어야 한다. */
export const MASTERPLAN_DOMAINS = [
  'physical',
  'biological',
  'ability',
  'social',
  'institutional',
  'economic',
  'informational',
  'spatial',
  'historical',
] as const;

/** 확정 9영역. 순서는 O1 `STATE_DOMAINS` 그대로다 — 화면·해시가 흔들리지 않게. */
export const DOMAIN_SPECS: readonly DomainSpec[] = [
  {
    domain: 'physical',
    label: '물리',
    holds: '위치·속도·온도·구조 안정성·물질 구성·파손·차폐, 그리고 장소 사이의 거리',
    source: 'MasterPlan §12.1 물리 상태 + spatial 흡수',
  },
  {
    domain: 'biological',
    label: '생물',
    holds: '체력·대사·허기·질병·독성·번식·성장 단계·변이',
    source: 'MasterPlan §12.1 생물 상태',
  },
  {
    domain: 'ecological',
    label: '생태',
    holds: '개체군·서식지·먹이사슬 압력·수용력·고갈',
    source: 'ModulePlan O2 생태 상태 (MasterPlan §20 생태 연쇄)',
  },
  {
    domain: 'relational',
    label: '관계',
    holds: '신뢰·공포·존경·의존·원한·빚·소속',
    source: 'MasterPlan §12.1 관계 상태(social)',
  },
  {
    domain: 'institutional',
    label: '제도',
    holds: '법·자격·통행권·현상금·금지 물품·외교 관계',
    source: 'MasterPlan §12.1 제도 상태',
  },
  {
    domain: 'economic',
    label: '경제',
    holds: '재고·가격·수요·유통량',
    source: 'MasterPlan §12.1 economic + ModulePlan O2 경제 상태',
  },
  {
    domain: 'informational',
    label: '정보',
    holds: '누가 무엇을 아는가·확실성·출처·소문 전파·거짓 정보·비밀',
    source: 'MasterPlan §12.1 정보 상태',
  },
  {
    domain: 'psychic',
    label: '의념',
    holds: '의념 에너지·활성 효과·조건 충족·능력 흔적·영역 간섭·신념 압력',
    source: 'MasterPlan §12.1 능력 상태(ability) + ModulePlan O2 의념 상태',
  },
  {
    domain: 'transcendent',
    label: '초월',
    holds: '앵커·신역 강도·정당성·숭배량',
    source: 'ModulePlan O2 초월 상태 (MasterPlan §1 초월적 존재)',
  },
];

/**
 * MasterPlan §12.1 의 이름 9개가 확정 영역으로 어떻게 해소되는가.
 * 이 표가 비면 "원문에 있는데 스키마에 없다" 를 아무도 못 잡는다.
 */
export const DOMAIN_RECONCILIATION: readonly DomainResolution[] = [
  {
    original: 'physical',
    resolution: 'same',
    domain: 'physical',
    reason: '두 목록이 같은 이름으로 같은 것을 가리킨다.',
  },
  {
    original: 'biological',
    resolution: 'same',
    domain: 'biological',
    reason: '두 목록이 같은 이름으로 같은 것을 가리킨다.',
  },
  {
    original: 'ability',
    resolution: 'absorbed',
    domain: 'psychic',
    reason:
      '능력은 의념에서 나온다 — O0 공리 "생명은 의념을 발생시킨다" · "모든 능력은 관찰 가능한 흔적을 남긴다". 능력 상태 5종(에너지·활성 효과·조건 충족·흔적·영역 간섭)은 의념 영역의 필드로 들어간다.',
  },
  {
    original: 'social',
    resolution: 'renamed',
    domain: 'relational',
    reason:
      'MasterPlan 은 필드 이름을 social 로 적고 본문 제목은 "관계 상태" 로 적는다. 담는 것(신뢰·공포·존경·의존·원한·빚·소속)이 같으므로 관계로 통일한다.',
  },
  {
    original: 'institutional',
    resolution: 'same',
    domain: 'institutional',
    reason: '두 목록이 같은 이름으로 같은 것을 가리킨다.',
  },
  {
    original: 'economic',
    resolution: 'same',
    domain: 'economic',
    reason: '두 목록이 같은 이름으로 같은 것을 가리킨다.',
  },
  {
    original: 'informational',
    resolution: 'same',
    domain: 'informational',
    reason: '두 목록이 같은 이름으로 같은 것을 가리킨다.',
  },
  {
    original: 'spatial',
    resolution: 'absorbed',
    domain: 'physical',
    reason:
      'MasterPlan 물리 상태가 이미 "위치" 를 담는다 — 공간을 따로 두면 위치가 두 영역에 갈라져 적힌다. 장소 사이의 거리도 물리 영역의 필드로 들어간다.',
  },
  {
    original: 'historical',
    resolution: 'not-a-domain',
    domain: null,
    reason:
      '역사는 지금의 값이 아니라 지나간 사건의 나열이다 — 사건 로그는 R1 이 담고, 역사가 지금 남긴 것(원한·명성·유적·부채)은 각 영역의 필드로 이미 서 있다. 상태 영역으로 두면 같은 사실이 두 번 적힌다.',
  },
];

/** ModulePlan O2 만 나열한 영역 — MasterPlan §12.1 목록에 없어서 근거를 따로 든다. */
export const MODULEPLAN_ONLY: readonly StateDomain[] = ['ecological', 'transcendent'];

/** 대조 결과 — 확정 9영역이 원문 양쪽으로부터 온전히 서는가. */
export interface ReconciliationReport {
  readonly domains: readonly StateDomain[];
  /** 해소되지 않은 MasterPlan 이름 */
  readonly unresolved: readonly string[];
  /** 확정 영역에 없는 곳으로 해소된 이름 (`이름→영역`) */
  readonly danglingTargets: readonly string[];
  /** 근거(source)가 비어 있는 확정 영역 */
  readonly unsourced: readonly StateDomain[];
  /** DOMAIN_SPECS 에 없는 STATE_DOMAINS 이름 — 이름표만 있고 정의가 없다 */
  readonly undefinedDomains: readonly StateDomain[];
  /** DOMAIN_SPECS 가 두 번 적은 영역 */
  readonly duplicateDomains: readonly StateDomain[];
  /** 두 목록이 겹치는 이름 */
  readonly sharedNames: readonly string[];
  readonly complete: boolean;
}

/** 원문 두 목록을 확정 영역에 대조한다. 던지지 않는다 — 어긋남은 값으로 남는다. */
export function reconcileDomains(
  specs: readonly DomainSpec[] = DOMAIN_SPECS,
  originals: readonly string[] = MASTERPLAN_DOMAINS,
  resolutions: readonly DomainResolution[] = DOMAIN_RECONCILIATION,
): ReconciliationReport {
  const defined = specs.map((spec) => spec.domain);
  const resolvedNames = new Set(resolutions.map((entry) => entry.original));

  const unresolved = originals.filter((name) => !resolvedNames.has(name));

  const danglingTargets: string[] = [];
  for (const entry of resolutions) {
    if (entry.domain !== null && !defined.includes(entry.domain)) {
      danglingTargets.push(`${entry.original}→${entry.domain}`);
    }
  }

  const duplicateDomains = stableSort(
    defined.filter((domain, index) => defined.indexOf(domain) !== index),
    compareStrings,
  );
  const undefinedDomains = STATE_DOMAINS.filter((domain) => !defined.includes(domain));
  const unsourced = specs
    .filter((spec) => spec.source === '' || spec.holds === '')
    .map((spec) => spec.domain);
  const sharedNames = stableSort(
    originals.filter((name) => (STATE_DOMAINS as readonly string[]).includes(name)),
    compareStrings,
  );

  return {
    domains: defined,
    unresolved,
    danglingTargets,
    unsourced,
    undefinedDomains,
    duplicateDomains,
    sharedNames,
    complete:
      specs.length > 0 &&
      unresolved.length === 0 &&
      danglingTargets.length === 0 &&
      unsourced.length === 0 &&
      undefinedDomains.length === 0 &&
      duplicateDomains.length === 0,
  };
}

/** 대조를 한 줄 판정으로 접는다 — 터미널·배지용. */
export function reconciliationVerdict(report: ReconciliationReport): string {
  if (report.complete) {
    return `원문 두 목록이 ${String(report.domains.length)}영역으로 해소됐다 (겹침 ${String(report.sharedNames.length)} · 나머지는 개명·흡수·영역 아님으로 설명됨)`;
  }
  const reasons: string[] = [];
  if (report.domains.length === 0) reasons.push('확정 영역이 없다');
  if (report.unresolved.length > 0) reasons.push(`해소되지 않은 원문 이름 ${report.unresolved.join(', ')}`);
  if (report.danglingTargets.length > 0) {
    reasons.push(`없는 영역으로 보낸 이름 ${report.danglingTargets.join(', ')}`);
  }
  if (report.unsourced.length > 0) reasons.push(`근거 없는 영역 ${report.unsourced.join(', ')}`);
  if (report.undefinedDomains.length > 0) {
    reasons.push(`이름표만 있는 영역 ${report.undefinedDomains.join(', ')}`);
  }
  if (report.duplicateDomains.length > 0) {
    reasons.push(`두 번 적힌 영역 ${report.duplicateDomains.join(', ')}`);
  }
  return reasons.join(' · ');
}

/** 영역 정의 하나를 찾는다. */
export function domainSpec(domain: StateDomain): DomainSpec | null {
  return DOMAIN_SPECS.find((spec) => spec.domain === domain) ?? null;
}

/** 문자열이 확정 9영역 중 하나인가. */
export function isStateDomain(value: unknown): value is StateDomain {
  return typeof value === 'string' && (STATE_DOMAINS as readonly string[]).includes(value);
}
