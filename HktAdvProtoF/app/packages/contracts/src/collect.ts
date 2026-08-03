// V4 증거 수집 순서 — 증거는 **검증 전량이 끝난 뒤에 일괄로** 기록된다.
//
// 순서가 규칙인 이유: 증거 파일은 다른 모듈의 **검사 재료**다.
// Lab 은 증거를 스냅샷(`lab/src/data.generated.ts`)으로 굳혀 브라우저에 싣고, 그 스냅샷이
// 낡았는지를 V3 의 단위 테스트가 검사한다. 수집 루프 안에서 모듈마다 증거를 즉시 쓰면
// 앞 모듈의 기록이 뒤 모듈의 재료를 낡게 만들어, 아무것도 고장 나지 않았는데 뒤 모듈만
// IMPLEMENTED 로 내려앉는다 — 실제로 일어난 V3 강등 사건(#662)이 이 순서 버그였다.
//
// 그래서 수집은 두 마당으로 나뉜다: **검증 전량 → 기록 전량.**
// 그 순서가 지켜졌는지는 추적(`EvidenceTrace`)으로 남아 눈으로 확인된다.

import type { Evidence } from './evidence.ts';

/** 모듈 하나의 검증 — 실제 검사를 수행하고 증거를 만든다. 여기서 파일을 쓰지 않는다. */
export interface EvidenceJob {
  readonly id: string;
  readonly verify: () => Evidence;
}

/** 검증이 끝난 모듈 하나의 증거. */
export interface EvidenceRecord {
  readonly id: string;
  readonly evidence: Evidence;
}

/** 증거를 남기는 곳 — 파일이든 메모리든. */
export type EvidenceSink = (record: EvidenceRecord) => void;

/** 수집 중에 실제로 일어난 일 한 줄. */
export interface EvidenceStep {
  readonly phase: 'verify' | 'record';
  readonly module: string;
}

/** 검증·기록이 일어난 순서 그대로의 기록. */
export type EvidenceTrace = readonly EvidenceStep[];

export interface Collection {
  readonly records: readonly EvidenceRecord[];
  readonly trace: EvidenceTrace;
}

/**
 * 증거 수집 — 검증을 전부 마친 뒤에만 기록한다.
 *
 * `sink` 는 작업당 정확히 한 번, **모든 `verify` 가 끝난 뒤에** 불린다.
 * 검증 중에 던져진 예외는 그대로 올라간다 — 반쯤 기록된 증거를 남기지 않기 위해서다.
 */
export function collectEvidence(jobs: readonly EvidenceJob[], sink: EvidenceSink): Collection {
  const records: EvidenceRecord[] = [];
  const trace: EvidenceStep[] = [];

  // ① 검증 마당 — 디스크는 그대로다. 모든 모듈이 같은 재료를 본다.
  for (const job of jobs) {
    const evidence = job.verify();
    records.push({ id: job.id, evidence });
    trace.push({ phase: 'verify', module: job.id });
  }

  // ② 기록 마당 — 이제서야 재료가 바뀐다. 이 뒤에 검증하는 모듈은 없다.
  for (const record of records) {
    sink(record);
    trace.push({ phase: 'record', module: record.id });
  }

  return { records, trace };
}

/**
 * 기록이 검증보다 앞선 지점 — 온전한 수집이면 비어 있다.
 * 즉시 기록(옛 순서)의 추적을 넣으면 어느 검증이 어느 기록보다 뒤였는지 짚어 준다.
 */
export function recordingOrderViolations(trace: EvidenceTrace): readonly string[] {
  const violations: string[] = [];
  const recorded: string[] = [];

  for (const step of trace) {
    if (step.phase === 'record') {
      recorded.push(step.module);
      continue;
    }
    for (const earlier of recorded) {
      violations.push(`${step.module} 검증이 ${earlier} 기록보다 뒤다 — 낡은 재료로 검증된다`);
    }
  }

  return violations;
}

/** 추적 한 줄 요약 — 터미널·Lab 에서 같은 문장을 쓴다. */
export function formatTrace(trace: EvidenceTrace): string {
  const verified = trace.filter((step) => step.phase === 'verify').length;
  const recorded = trace.filter((step) => step.phase === 'record').length;
  const violations = recordingOrderViolations(trace);
  return `검증 ${String(verified)}줄 → 기록 ${String(recorded)}줄 · 순서 위반 ${String(violations.length)}건`;
}
