// View 단독 Fixture 테스트 — World 미기동 상태에서 Spec 해석만으로 검증한다.

import { describe, expect, it } from 'vitest';
import type { GameViewSnapshot } from '../../protocol/gameview';
import { interpretGameView } from '../gameview/interpret';
import { reasonText } from '../hud/reason-text';
import available from './fixtures/mining-available.fixture.json';
import depleted from './fixtures/deposit-depleted.fixture.json';
import outOfRange from './fixtures/out-of-range.fixture.json';

describe('interpretGameView', () => {
  it('mining-available fixture → 채굴 가능 상태 표현', () => {
    const scene = interpretGameView(available as GameViewSnapshot);

    expect(scene.entities.map((e) => e.spriteId)).toEqual([
      'player-character:idle',
      'resource-deposit:available',
    ]);
    expect(scene.hud.mineAvailable).toBe(true);
    expect(scene.hud.mineReason).toBeNull();
    expect(scene.mineTargetDepositId).toBe('deposit-1');
  });

  it('out-of-range fixture → moving 스프라이트 + 사유 표시', () => {
    const scene = interpretGameView(outOfRange as GameViewSnapshot);

    expect(scene.entities[0]?.spriteId).toBe('player-character:moving');
    expect(scene.hud.mineAvailable).toBe(false);
    expect(scene.hud.mineReason).toBe('out-of-range');
    expect(reasonText('out-of-range')).toContain('멀다');
  });

  it('deposit-depleted fixture → depleted 스프라이트 + 획득 불가 사유', () => {
    const scene = interpretGameView(depleted as GameViewSnapshot);

    expect(scene.entities[1]?.spriteId).toBe('resource-deposit:depleted');
    expect(scene.hud.depositRemaining).toBe(0);
    expect(scene.hud.stoneCount).toBe(5);
    expect(scene.hud.mineReason).toBe('deposit-depleted');
    expect(reasonText('deposit-depleted')).toContain('고갈');
  });
});
