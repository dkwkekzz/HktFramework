// RULE-MINE-001 · RULE-MINE-COMPLETE-001 World 단독 테스트 — Before → Input → Rule → After
// 채취는 즉시가 아니라 시간이 걸리는 행동이고, 완료 시점에 획득한다.
//
// C011 CHANGED — 대상이 광맥(Deposit)에서 **방이 낳는 원천**(Resource Source)이 되었다.
// 자리는 배치 손잡이가 아니라 content/regions 의 데이터에서 온다 (FOREST_EDGE 의 MOLT_LITTER
// 가 (-8, 6) 에 선다). 얻는 것은 돌이 아니라 그 원천의 재료다.
// 고갈은 이 Cycle 에 없다 — phase 와 채취 단위는 C012 가 함께 세운다.

import { describe, expect, it } from 'vitest';
import { ORE_EATER_MOLT } from '../../regions';
import type { GameViewSnapshot } from '../../protocol/gameview';
import { driveWorld, PLAYER } from './drive';

const solo = { npcs: [], actorRegion: 'FOREST_EDGE' };
const MINE_DURATION = 1.2;

/** 숲 가장자리의 허물 — 자리는 content/regions/forest-edge.ts 가 소유한다 */
const SOURCE = 'MOLT_LITTER';
/** 그 자리에서 거리 1 — InteractionRange 2 안이다 */
const NEAR = { x: -8, z: 5 };

const materialCount = (v: GameViewSnapshot) =>
  v.hud.find((h) => h.id === `inventory.${ORE_EATER_MOLT}`)?.value;
const source = (v: GameViewSnapshot) => v.entities.find((e) => e.id === SOURCE);
const player = (v: GameViewSnapshot) => v.entities.find((e) => e.id === PLAYER);
const mine = (v: GameViewSnapshot) => v.interactions.find((i) => i.id === 'mine');

describe('RULE-MINE-001', () => {
  it('곡괭이 보유 + 인접 → 채취 행동 진입 (아직 획득 없음)', () => {
    const world = driveWorld({ ...solo, actorPosition: NEAR });

    const result = world.dispatch({ interactionId: 'mine', targetEntityId: SOURCE });

    expect(result).toEqual({ status: 'success', rule: 'RULE-MINE-001' });
    const view = world.observe();
    expect(player(view)?.state).toBe('mine');
    // 완료 전에는 획득하지 않는다 — 지니지 않은 재료의 HUD 자리는 아예 없다
    expect(materialCount(view)).toBeUndefined();
    expect(source(view)?.role).toBe('resource-source');
  });

  it('곡괭이 없음 → Failure(no-mining-tool), 상태 불변 + 사유 코드 투영', () => {
    const world = driveWorld({ ...solo, actorPosition: NEAR, actorItems: {} });

    const result = world.dispatch({ interactionId: 'mine', targetEntityId: SOURCE });

    expect(result).toEqual({ status: 'failure', rule: 'RULE-MINE-001', reason: 'no-mining-tool' });
    const view = world.observe();
    expect(materialCount(view)).toBeUndefined();
    expect(mine(view)?.reason).toBe('no-mining-tool');
    expect(player(view)?.state).toBe('idle');
  });

  it('거리 밖 → Failure(out-of-range)', () => {
    const world = driveWorld({ ...solo, actorPosition: { x: 0, z: 0 } }); // 원천까지 10

    const result = world.dispatch({ interactionId: 'mine', targetEntityId: SOURCE });

    expect(result).toEqual({ status: 'failure', rule: 'RULE-MINE-001', reason: 'out-of-range' });
  });

  it('세계가 모르는 원천 → Failure(unknown-source)', () => {
    const world = driveWorld({ ...solo, actorPosition: NEAR });

    const result = world.dispatch({ interactionId: 'mine', targetEntityId: 'NO_SUCH_SOURCE' });

    expect(result).toEqual({ status: 'failure', rule: 'RULE-MINE-001', reason: 'unknown-source' });
  });
});

describe('RULE-MINE-COMPLETE-001', () => {
  it('채취 행동이 소요 시간을 채우면 그 원천의 재료 1 획득, 대기 복귀', () => {
    const world = driveWorld({ ...solo, actorPosition: NEAR });
    world.dispatch({ interactionId: 'mine', targetEntityId: SOURCE });

    world.tick(MINE_DURATION / 2);
    let view = world.observe();
    expect(player(view)?.state).toBe('mine');
    expect(player(view)?.progress).toBeCloseTo(0.5); // 진행도 관찰
    expect(materialCount(view)).toBeUndefined();

    world.tick(MINE_DURATION / 2);
    view = world.observe();
    expect(player(view)?.state).toBe('idle');
    expect(materialCount(view)).toBe(1);
  });

  it('회귀 — 이동해서 원천에 도달한 뒤 캐면 재료를 얻는다', () => {
    const world = driveWorld({ ...solo, actorPosition: { x: 0, z: 0 } });

    world.dispatch({ interactionId: 'move', position: NEAR });
    for (let i = 0; i < 120; i++) world.tick(1 / 30); // 4초 — 거리 약 9.4 도달 충분
    expect(player(world.observe())?.state).toBe('idle');

    expect(world.dispatch({ interactionId: 'mine', targetEntityId: SOURCE }).status).toBe(
      'success',
    );
    for (let i = 0; i < 45; i++) world.tick(1 / 30); // 1.5초 — MINE_DURATION 1.2 초과

    expect(materialCount(world.observe())).toBe(1);
  });
});
