// V4 완료 증거 — 완료를 임의로 선언하지 못하게 한다.
//
// 규칙 하나: **status 는 증거가 정한다.** 사람이나 에이전트가 계약에 VERIFIED 를 적는 것은
// 주장일 뿐이고, 그 주장은 증거 파일과 대조돼야 성립한다 (원문 V4).
//
// 증거는 소스 해시를 품는다 — 소스가 바뀌면 증거는 자동으로 낡은 것(stale)이 되어
// 완료 주장이 무너진다. "고쳐 놓고 예전 증거로 완료를 유지하는" 경로를 막는 장치다.

import { stateHash } from '@hkt/core/v1';

import type { ModuleContract, ModuleStatus } from './contract.ts';

/** 검증 항목 하나의 결과. */
export type CheckResult = 'passed' | 'failed' | 'manual';

/** 증거를 만들기 위해 실제로 수행한 검증의 산출물. */
export interface EvidenceInput {
  /** `<ID>-<name>` 형태의 모듈 이름 */
  readonly module: string;
  /** 검증 대상 소스의 내용 해시 */
  readonly sourceHash: string;
  readonly unitTests: { readonly result: CheckResult; readonly total: number; readonly passed: number };
  /** 같은 입력 반복 실행이 하나로 모이는가 */
  readonly propertyTests: CheckResult;
  /** V3 Lab 확인 — Lab 이 없는 동안은 'manual' */
  readonly labScenarios: CheckResult;
  /** 시나리오 스위트 결과 */
  readonly scenarios: {
    readonly total: number;
    readonly passed: number;
    readonly failed: number;
    /** 정상·실패·경계 3종을 모두 갖추고 전부 통과했는가 */
    readonly coverageComplete: boolean;
    /** 시나리오별 통과 여부 */
    readonly byId: Readonly<Record<string, 'passed' | 'failed'>>;
  };
  /** 리플레이 해시 — 같은 검증을 다시 돌렸을 때 나온 결과 해시 */
  readonly replayHash: string;
  /** 증거를 만든 스크립트·Lab 대체 경로 등 자유 기록 (직렬화 가능해야 한다) */
  readonly detail?: Readonly<Record<string, unknown>>;
}

/** 완료 증거 — 원문 V4 형식. */
export interface Evidence {
  readonly module: string;
  readonly sourceHash: string;
  readonly unitTests: CheckResult;
  readonly propertyTests: CheckResult;
  readonly labScenarios: CheckResult;
  readonly integrationScenario: CheckResult;
  readonly replayHash: string;
  readonly status: ModuleStatus;
  /** VERIFIED 가 아니라면 왜 아닌가 */
  readonly blockers: readonly string[];
  readonly detail: Readonly<Record<string, unknown>>;
}

/**
 * 검증 산출물에서 증거를 만든다.
 * status 는 인자로 받지 않는다 — 산출물이 status 를 결정한다.
 */
export function buildEvidence(input: EvidenceInput): Evidence {
  const blockers: string[] = [];

  if (input.unitTests.result !== 'passed') {
    blockers.push(
      `단위 테스트가 통과하지 않았다 (${String(input.unitTests.passed)}/${String(input.unitTests.total)})`,
    );
  }
  if (input.unitTests.total === 0) {
    blockers.push('단위 테스트가 하나도 없다');
  }
  if (input.propertyTests === 'failed') {
    blockers.push('반복 실행이 하나로 모이지 않는다 — 결정성 미확보');
  }
  if (input.scenarios.total === 0) {
    blockers.push('시나리오가 하나도 없다 — 시나리오 없는 모듈은 완료할 수 없다');
  }
  if (input.scenarios.failed > 0) {
    const failing = Object.entries(input.scenarios.byId)
      .filter(([, result]) => result === 'failed')
      .map(([id]) => id);
    blockers.push(`통과하지 못한 시나리오가 있다 — ${failing.join(', ')}`);
  }
  if (!input.scenarios.coverageComplete) {
    blockers.push('정상·실패·경계 3종 커버리지가 완결되지 않았다');
  }
  if (input.replayHash === '') {
    blockers.push('리플레이 해시가 없다');
  }
  if (input.labScenarios === 'failed') {
    blockers.push('Lab 확인이 실패했다');
  }

  const integrationScenario: CheckResult =
    input.scenarios.total === 0 ? 'failed' : input.scenarios.failed === 0 ? 'passed' : 'failed';

  return {
    module: input.module,
    sourceHash: input.sourceHash,
    unitTests: input.unitTests.result,
    propertyTests: input.propertyTests,
    labScenarios: input.labScenarios,
    integrationScenario,
    replayHash: input.replayHash,
    status: blockers.length === 0 ? 'VERIFIED' : 'IMPLEMENTED',
    blockers,
    detail: {
      ...(input.detail ?? {}),
      tests: { total: input.unitTests.total, passed: input.unitTests.passed },
      scenarios: {
        total: input.scenarios.total,
        passed: input.scenarios.passed,
        failed: input.scenarios.failed,
        coverageComplete: input.scenarios.coverageComplete,
        byId: input.scenarios.byId,
      },
    },
  };
}

/** 계약이 주장한 완료가 증거로 뒷받침되는가. */
export interface PromotionCheck {
  readonly allowed: boolean;
  readonly reasons: readonly string[];
}

/**
 * VERIFIED 전이 게이트.
 * @param currentSourceHash 지금 소스의 해시. 증거의 sourceHash 와 다르면 증거는 낡았다.
 */
export function canPromote(
  contract: ModuleContract,
  evidence: Evidence | null,
  currentSourceHash: string | null = null,
): PromotionCheck {
  const reasons: string[] = [];

  if (evidence === null) {
    reasons.push('증거 파일이 없다 — 완료 선언은 증거로만 한다');
    return { allowed: false, reasons };
  }
  if (evidence.status !== 'VERIFIED') {
    reasons.push(...evidence.blockers.map((blocker) => `증거가 완료를 뒷받침하지 않는다 — ${blocker}`));
    if (evidence.blockers.length === 0) {
      reasons.push(`증거 status 가 ${evidence.status} 다`);
    }
  }
  if (currentSourceHash !== null && currentSourceHash !== evidence.sourceHash) {
    reasons.push(
      `소스가 증거 이후로 바뀌었다 — 증거 ${evidence.sourceHash.slice(0, 12)} · 현재 ${currentSourceHash.slice(0, 12)}`,
    );
  }
  if (contract.scenarios.length === 0) {
    reasons.push('계약에 시나리오가 없다');
  }

  return { allowed: reasons.length === 0, reasons };
}

/** 증거가 지금 소스에 대한 것인가. */
export function isFresh(evidence: Evidence, currentSourceHash: string): boolean {
  return evidence.sourceHash === currentSourceHash;
}

/** 증거 파일의 내용 해시 — 증거 자체가 손대졌는지 비교할 때 쓴다. */
export function evidenceHash(evidence: Evidence): string {
  return stateHash(evidence);
}

/** 모듈별 통과 대시보드 — V3 Lab diff 뷰의 텍스트판. */
export function formatDashboard(
  rows: readonly { readonly id: string; readonly evidence: Evidence | null; readonly claimed: ModuleStatus }[],
): string {
  const mark = (result: CheckResult | undefined): string =>
    result === 'passed' ? '✔' : result === 'manual' ? '△' : '✘';

  const lines: string[] = [];
  lines.push('모듈  주장          단위 속성 Lab 통합  증거 status   판정');
  for (const row of rows) {
    const evidence = row.evidence;
    const verdict =
      evidence === null
        ? '증거 없음 ✘'
        : row.claimed === 'VERIFIED' && evidence.status !== 'VERIFIED'
          ? '주장 기각 ✘'
          : evidence.status === 'VERIFIED'
            ? '완료 ✔'
            : '진행 중 —';
    lines.push(
      `${row.id.padEnd(5)} ${row.claimed.padEnd(13)} ${mark(evidence?.unitTests).padStart(2)}  ${mark(evidence?.propertyTests).padStart(2)}  ${mark(evidence?.labScenarios).padStart(2)}  ${mark(evidence?.integrationScenario).padStart(2)}   ${(evidence?.status ?? '—').padEnd(12)} ${verdict}`,
    );
    for (const blocker of evidence?.blockers ?? []) {
      lines.push(`        └ ${blocker}`);
    }
  }
  lines.push('');
  lines.push('△ = 수동 확인 — 브라우저 Lab 에서 눈으로 본다 (자동 확인은 아직 없다)');
  return lines.join('\n');
}
