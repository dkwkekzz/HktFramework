// O1-e 개념 커버리지 — "원문의 모든 개념이 하나 이상의 존재론 타입으로 표현되는가" 를 센다.
//
// 두 방향을 함께 본다. 한쪽만 보면 존재론이 조용히 무너진다:
//   ① 덮이지 않은 개념 — 12타입으로 적을 수 없는 개념이 남아 있다 (존재론이 모자라다)
//   ② 쓰이지 않는 타입 — 아무 개념도 쓰지 않는 타입이 있다 (존재론이 과하다)
//
// 판정은 값으로만 한다. 여기서 던지지 않고, 무엇이 왜 비었는지를 보고서로 돌려준다.

import { compareStrings, stableSort } from '../v1/stable-sort.ts';
import { ONTOLOGY_KINDS, isOntologyKind, type OntologyKind } from './kinds.ts';

/** 원문 개념 하나와, 그것이 환원되는 존재론 타입들. */
export interface ConceptEntry {
  /** kebab-case 식별자 */
  readonly id: string;
  /** 원문이 쓴 개념 이름 */
  readonly concept: string;
  /** 원문 위치 (`MasterPlan §5.2`) — 되짚을 수 있어야 한다 */
  readonly source: string;
  /** 하나 이상의 존재론 타입 */
  readonly kinds: readonly OntologyKind[];
  /** 어떻게 환원되는가 한 줄 */
  readonly note: string;
}

/** 개념 하나의 판정. */
export interface ConceptCoverage {
  readonly conceptId: string;
  readonly kinds: readonly OntologyKind[];
  /** 12타입 중 하나 이상으로 덮였는가 */
  readonly covered: boolean;
}

/** 커버리지 보고서 — Lab 커버리지 표가 그대로 이 값을 그린다. */
export interface CoverageReport {
  readonly total: number;
  readonly covered: number;
  readonly entries: readonly ConceptCoverage[];
  /** 어떤 타입으로도 적히지 않은 개념 */
  readonly unmapped: readonly string[];
  /** 12타입 밖의 이름을 쓴 개념 (`개념id:이름`) */
  readonly unknownKinds: readonly string[];
  /** 같은 id 를 두 번 등록한 개념 */
  readonly duplicateIds: readonly string[];
  /** 타입별로 그 타입을 쓰는 개념 id 들 */
  readonly byKind: Readonly<Record<OntologyKind, readonly string[]>>;
  /** 아무 개념도 쓰지 않는 타입 — 존재론이 과하다는 신호 */
  readonly unusedKinds: readonly OntologyKind[];
  /** 이름표만 있고 필드가 없는 타입 */
  readonly notImplementedKinds: readonly OntologyKind[];
  /** 위 네 가지가 모두 비어야 완결이다 */
  readonly complete: boolean;
}

/**
 * 카탈로그를 12타입에 대조한다.
 * @param entries     원문 개념 목록
 * @param implemented 필드까지 정의된 타입 (o1/index.ts 의 implementedKinds())
 */
export function checkCoverage(
  entries: readonly ConceptEntry[],
  implemented: readonly OntologyKind[],
): CoverageReport {
  const byKind = Object.fromEntries(ONTOLOGY_KINDS.map((kind) => [kind, [] as string[]])) as Record<
    OntologyKind,
    string[]
  >;
  const unmapped: string[] = [];
  const unknownKinds: string[] = [];
  const duplicateIds: string[] = [];
  const seen = new Set<string>();
  const coverage: ConceptCoverage[] = [];

  for (const entry of entries) {
    if (seen.has(entry.id)) duplicateIds.push(entry.id);
    seen.add(entry.id);

    const known: OntologyKind[] = [];
    for (const kind of entry.kinds) {
      if (isOntologyKind(kind)) {
        known.push(kind);
        byKind[kind].push(entry.id);
      } else {
        unknownKinds.push(`${entry.id}:${String(kind)}`);
      }
    }
    if (known.length === 0) unmapped.push(entry.id);
    coverage.push({ conceptId: entry.id, kinds: known, covered: known.length > 0 });
  }

  // 화면·해시가 등록 순서에 흔들리지 않게 정렬한다 (V1 안정 정렬).
  for (const kind of ONTOLOGY_KINDS) {
    byKind[kind] = stableSort(byKind[kind], compareStrings);
  }

  const unusedKinds = ONTOLOGY_KINDS.filter((kind) => byKind[kind].length === 0);
  const notImplementedKinds = ONTOLOGY_KINDS.filter((kind) => !implemented.includes(kind));

  return {
    total: entries.length,
    covered: coverage.filter((entry) => entry.covered).length,
    entries: coverage,
    unmapped,
    unknownKinds,
    duplicateIds,
    byKind,
    unusedKinds,
    notImplementedKinds,
    complete:
      entries.length > 0 &&
      unmapped.length === 0 &&
      unknownKinds.length === 0 &&
      duplicateIds.length === 0 &&
      unusedKinds.length === 0 &&
      notImplementedKinds.length === 0,
  };
}

/** 보고서를 한 줄 판정으로 접는다 — 터미널·배지용. */
export function coverageVerdict(report: CoverageReport): string {
  if (report.complete) {
    return `개념 ${String(report.total)}종 전부가 12타입으로 덮였고, 남는 타입이 없다`;
  }
  const reasons: string[] = [];
  if (report.total === 0) reasons.push('카탈로그가 비었다');
  if (report.unmapped.length > 0) reasons.push(`미분류 개념 ${report.unmapped.join(', ')}`);
  if (report.unknownKinds.length > 0) reasons.push(`12타입 밖 이름 ${report.unknownKinds.join(', ')}`);
  if (report.duplicateIds.length > 0) reasons.push(`중복 개념 id ${report.duplicateIds.join(', ')}`);
  if (report.unusedKinds.length > 0) reasons.push(`쓰이지 않는 타입 ${report.unusedKinds.join(', ')}`);
  if (report.notImplementedKinds.length > 0) {
    reasons.push(`필드 없는 타입 ${report.notImplementedKinds.join(', ')}`);
  }
  return reasons.join(' · ');
}
