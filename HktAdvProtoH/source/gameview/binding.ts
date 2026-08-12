// Observable Binding — cycles/C002/gameview/observable_bindings.yaml 구현 (Stage 12→13).
// 순수 함수: Observable Semantic → Rendering State. three.js/DOM 무의존이라
// Observable fixture 만으로 단독 테스트할 수 있다 (gameview-verify 요건).

import type { PlayerObservable } from './observable';

export interface CharacterRenderState {
  worldPosition: { x: number; z: number }; // ← Actor.Position
  mining: boolean; // ← Actor.CurrentAction == Mine
}

export interface DepositRenderState {
  id: string;
  worldPosition: { x: number; z: number }; // ← Deposit.Position
  depleted: boolean; // ← Deposit.ResourceAmount == 0
  amountLabel: string; // ← Deposit.ResourceAmount
  interactionRing: boolean; // ← MineStone.Availability (target 일치 시)
}

export interface HudRenderState {
  stoneCount: number; // ← Actor.Inventory.Stone
  interactionHint: string; // ← MineStone.Availability
  feedbackLine: string; // ← ActionResult / ResourceTransition
}

export interface RenderState {
  character: CharacterRenderState;
  deposits: DepositRenderState[];
  hud: HudRenderState;
}

const REASON_TEXT: Record<string, string> = {
  UNKNOWN_DEPOSIT: '아는 광맥이 없다',
  NO_MINING_TOOL: '곡괭이가 필요하다',
  OUT_OF_RANGE: '광맥에 더 가까이 가자',
  DEPOSIT_EMPTY: '광맥이 고갈되었다',
};

export function bindObservable(obs: PlayerObservable): RenderState {
  const availability = obs.mineAvailability;

  const deposits: DepositRenderState[] = obs.visibleDeposits.map((d) => ({
    id: d.id,
    worldPosition: { x: d.position.x, z: d.position.z },
    depleted: d.resourceAmount === 0,
    amountLabel: d.resourceAmount > 0 ? `돌 ${d.resourceAmount}` : '고갈',
    interactionRing: availability.status === 'AVAILABLE' && availability.target === d.id,
  }));

  let interactionHint = '';
  if (availability.status === 'AVAILABLE') {
    interactionHint = '[E] 채굴';
  } else if (availability.reason && availability.reason in REASON_TEXT) {
    interactionHint = REASON_TEXT[availability.reason]!;
  }

  let feedbackLine = '';
  if (obs.actionResult && obs.actionResult.command === 'CMD-MINE-V1') {
    if (obs.actionResult.result === 'SUCCESS' && obs.resourceTransition) {
      feedbackLine = `+${obs.resourceTransition.stoneAfter - obs.resourceTransition.stoneBefore} Stone 획득!`;
    } else if (obs.actionResult.result === 'FAILURE') {
      feedbackLine = REASON_TEXT[obs.actionResult.failureReason ?? ''] ?? '채굴 실패';
    }
  }

  return {
    character: {
      worldPosition: { x: obs.actor.position.x, z: obs.actor.position.z },
      mining: obs.actor.currentAction === 'Mine',
    },
    deposits,
    hud: {
      stoneCount: obs.actor.inventoryStone,
      interactionHint,
      feedbackLine,
    },
  };
}
