// GameView Binding 테스트 — Observable fixture 만으로 기대 Visual 재현 (World 실행 없음).
// VIEW-MINING-001 의 모든 Visual Meaning 을 fixture 로 검증한다.
import { describe, expect, it } from 'vitest';
import { bindObservable } from '../gameview/binding';
import type { PlayerObservable } from '../gameview/observable';

function fixture(overrides?: Partial<PlayerObservable>): PlayerObservable {
  return {
    actor: { position: { x: 2, z: 3 }, inventoryStone: 0, currentAction: 'Idle' },
    visibleDeposits: [{ id: 'deposit-1', position: { x: 4, z: 3 }, resourceAmount: 5 }],
    mineAvailability: { status: 'UNAVAILABLE', target: 'deposit-1', reason: 'OUT_OF_RANGE' },
    actionResult: null,
    resourceTransition: null,
    ...overrides,
  };
}

describe('Observable → RenderState binding (VIEW-MINING-001)', () => {
  it('Actor.Position → character.worldPosition', () => {
    const rs = bindObservable(fixture());
    expect(rs.character.worldPosition).toEqual({ x: 2, z: 3 });
  });

  it('Visual Meaning: Mining — Actor.CurrentAction == Mine → character.mining', () => {
    expect(bindObservable(fixture()).character.mining).toBe(false);
    const mining = fixture({
      actor: { position: { x: 2, z: 3 }, inventoryStone: 1, currentAction: 'Mine' },
    });
    expect(bindObservable(mining).character.mining).toBe(true);
  });

  it('Visual Meaning: DepletedResource — ResourceAmount == 0 → depleted 스프라이트 + 고갈 라벨', () => {
    const depleted = fixture({
      visibleDeposits: [{ id: 'deposit-1', position: { x: 4, z: 3 }, resourceAmount: 0 }],
    });
    const rs = bindObservable(depleted);
    expect(rs.deposits[0]!.depleted).toBe(true);
    expect(rs.deposits[0]!.amountLabel).toBe('고갈');
  });

  it('Visual Meaning: RemainingResource — ResourceAmount → amountLabel', () => {
    const rs = bindObservable(fixture());
    expect(rs.deposits[0]!.amountLabel).toBe('돌 5');
  });

  it('Visual Meaning: OwnedStoneAmount — Inventory.Stone → hud.stoneCount', () => {
    const rs = bindObservable(
      fixture({ actor: { position: { x: 0, z: 0 }, inventoryStone: 3, currentAction: 'Idle' } }),
    );
    expect(rs.hud.stoneCount).toBe(3);
  });

  it('Visual Meaning: InteractableTarget — AVAILABLE → 대상 광맥 강조 링 + [E] 힌트', () => {
    const available = fixture({
      mineAvailability: { status: 'AVAILABLE', target: 'deposit-1' },
    });
    const rs = bindObservable(available);
    expect(rs.deposits[0]!.interactionRing).toBe(true);
    expect(rs.hud.interactionHint).toBe('[E] 채굴');
  });

  it('UNAVAILABLE 사유가 힌트로 표현된다 (OUT_OF_RANGE)', () => {
    const rs = bindObservable(fixture());
    expect(rs.deposits[0]!.interactionRing).toBe(false);
    expect(rs.hud.interactionHint).toContain('가까이');
  });

  it('Visual Meaning: ActionFeedback — 채굴 성공 + ResourceTransition → 획득 피드백', () => {
    const rs = bindObservable(
      fixture({
        actionResult: { command: 'CMD-MINE-V1', result: 'SUCCESS' },
        resourceTransition: {
          depositId: 'deposit-1',
          depositBefore: 5,
          depositAfter: 4,
          stoneBefore: 0,
          stoneAfter: 1,
        },
      }),
    );
    expect(rs.hud.feedbackLine).toBe('+1 Stone 획득!');
  });

  it('Visual Meaning: ActionFeedback — 채굴 실패 사유 표시 (DEPOSIT_EMPTY)', () => {
    const rs = bindObservable(
      fixture({
        actionResult: { command: 'CMD-MINE-V1', result: 'FAILURE', failureReason: 'DEPOSIT_EMPTY' },
      }),
    );
    expect(rs.hud.feedbackLine).toContain('고갈');
  });

  it('VisibleDeposit — 관측된 Deposit 만 렌더 상태에 존재한다', () => {
    const rs = bindObservable(fixture({ visibleDeposits: [] }));
    expect(rs.deposits).toHaveLength(0);
  });
});
