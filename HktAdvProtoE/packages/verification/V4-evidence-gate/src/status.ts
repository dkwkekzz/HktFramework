/**
 * 검증 상태 (원문 「4. 검증 상태」).
 *
 * 상태는 **손으로 적는 값이 아니다.** 게이트 판정 결과에서만 나온다 — 원문 「23」이 금지하는
 * "증거 없이 VERIFIED 표시"를 코드 차원에서 불가능하게 만드는 것이 이 파일의 목적이다.
 */

export const STATUS_LADDER = [
  'BLOCKED',
  'SPECIFIED',
  'TEST_READY',
  'IMPLEMENTED',
  'UNIT_PASS',
  'LAB_PASS',
  'SLICE_PASS',
  'VERIFIED',
  'FROZEN',
] as const;

export type VerificationStatus = (typeof STATUS_LADDER)[number];

/**
 * 명시적 실패 표기.
 *
 * 원문 「4」의 사다리에는 없다. 원문 「22」의 `markExplicitFailure(moduleId, "retry_budget_exhausted")`
 * 에 해당하는, 사다리 **밖**의 표기다. 사다리 값과 섞어 순서를 매기지 않는다.
 */
export const FAILED = 'FAILED' as const;

export type EvidenceStatus = VerificationStatus | typeof FAILED;

export function isLadderStatus(value: string): value is VerificationStatus {
  return (STATUS_LADDER as readonly string[]).includes(value);
}

/** 사다리에서의 높이. 사다리 밖의 값은 -1 이다. */
export function statusRank(status: string): number {
  return (STATUS_LADDER as readonly string[]).indexOf(status);
}

/** 두 상태 중 낮은 쪽. 천장을 씌울 때 쓴다. */
export function lowerOf(a: VerificationStatus, b: VerificationStatus): VerificationStatus {
  return statusRank(a) <= statusRank(b) ? a : b;
}

export function isAtLeast(status: string, floor: VerificationStatus): boolean {
  const rank = statusRank(status);
  return rank >= 0 && rank >= statusRank(floor);
}
