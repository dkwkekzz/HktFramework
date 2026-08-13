// Cycle Module 조립 테스트 — 특정 Cycle 까지의 게임 재생이 가능한가.

import { describe, expect, it } from 'vitest';
import { CYCLE_IDS } from '../cycles/index';
import { createWorld } from '../index';

describe('Cycle Module 조립', () => {
  it('기본 조립 = 등록된 전체 Cycle (최신 게임)', () => {
    const world = createWorld();
    expect(world.cycles).toEqual(CYCLE_IDS);
  });

  it('upToCycle=C001-stone-mining → C001 까지의 게임이 완전히 플레이 가능하다', () => {
    const world = createWorld({
      upToCycle: 'C001-stone-mining',
      actorPosition: { x: 8, z: -5 },
    });

    expect(world.cycles).toEqual(['C001-stone-mining']);
    const result = world.dispatch({ interactionId: 'mine', targetEntityId: 'deposit-1' });
    expect(result.status).toBe('success');
    const view = world.projectPlayerView();
    expect(view.specId).toBe('VIEW-STONE-MINING-001');
    expect(view.hud.find((h) => h.id === 'inventory.stone')?.value).toBe(1);
  });

  it('알 수 없는 Cycle → 등록 목록과 함께 즉시 실패한다', () => {
    expect(() => createWorld({ upToCycle: 'C999-unknown' })).toThrowError(/알 수 없는 Cycle/);
  });

  it('조립되지 않은 interaction 요청 → unknown-interaction 거부', () => {
    const world = createWorld({ upToCycle: 'C001-stone-mining' });
    const result = world.dispatch({ interactionId: 'craft' });
    expect(result).toEqual({ status: 'failure', rule: 'DISPATCH', reason: 'unknown-interaction' });
  });
});
