// Mine 불가 사유 → 플레이어 표시 문구 (Presentation 책임 — View 가 결정한다)

import type { MineFailureReason } from '../../protocol/gameview';

const REASON_TEXT: Record<MineFailureReason, string> = {
  'no-mining-tool': '곡괭이가 없다',
  'out-of-range': '광맥이 너무 멀다 — 가까이 이동하자',
  'deposit-depleted': '광맥이 고갈되었다',
};

export function reasonText(reason: MineFailureReason): string {
  return REASON_TEXT[reason];
}
