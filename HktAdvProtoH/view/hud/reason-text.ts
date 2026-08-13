// 불가 사유 코드 → 플레이어 표시 문구 (엔진 데이터 — 새 Cycle 은 항목 추가만).
// 미등록 코드는 코드 그대로 표시된다 — 표현 누락이 게임을 멈추지 않는다.

const REASON_TEXT: Record<string, string> = {
  'no-mining-tool': '곡괭이가 없다',
  'out-of-range': '광맥이 너무 멀다 — 가까이 이동하자',
  'deposit-depleted': '광맥이 고갈되었다',
};

export function reasonText(reason: string): string {
  return REASON_TEXT[reason] ?? reason;
}
