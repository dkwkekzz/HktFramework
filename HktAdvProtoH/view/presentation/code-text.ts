// 의미 코드 → 플레이어 표시 문구 (결정 Layer 데이터).
// World 는 코드만 보낸다 — 불가 사유 코드, 행동 코드 등. 문구는 여기서 정한다.
// 미등록 코드는 코드 그대로 표시된다 — 표현 누락이 게임을 멈추지 않는다.

const CODE_TEXT: Record<string, string> = {
  // 불가 사유 (C001)
  'no-mining-tool': '곡괭이가 없다',
  'out-of-range': '너무 멀다 — 가까이 이동하자',
  'deposit-depleted': '광맥이 고갈되었다',
  // 불가 사유 (C002)
  'action-busy': '지금 하는 행동이 끝나야 한다',
  'no-target': '대상이 없다',
  'out-of-bounds': '더 갈 수 없는 곳이다',
  // 행동 코드 (C002)
  idle: '대기',
  move: '이동',
  attack: '공격',
  mine: '채굴',
};

export function codeText(code: string): string {
  return CODE_TEXT[code] ?? code;
}
