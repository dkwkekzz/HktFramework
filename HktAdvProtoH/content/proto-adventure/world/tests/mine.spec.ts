// RULE-MINE-001 · RULE-MINE-COMPLETE-001 World 단독 테스트 — Before → Input → Rule → After
// C002 CHANGED — 채굴은 즉시가 아니라 시간이 걸리는 행동이고, 완료 시점에 획득한다.

import { describe, expect, it } from 'vitest';
import type { GameViewSnapshot } from '../../protocol/gameview';
import { driveWorld, PLAYER, selectTarget } from './drive';

const solo = { npcs: [] };
const MINE_DURATION = 1.2;

// C020 CHANGED — 돌 전용 HUD 칸(`inventory.stone`)이 사라지고 소지품 목록이 그 자리를
// 대신한다. **읽는 자리만 바뀌고 값은 그대로다** — 이 파일의 기대값은 한 줄도 바뀌지 않았다.
// 지니지 않은 종류는 항목이 없으므로 0 으로 읽는다.
const stoneCount = (v: GameViewSnapshot) =>
  v.inventory.find((i) => i.kind === 'stone')?.count ?? 0;
const deposit = (v: GameViewSnapshot) => v.entities.find((e) => e.id === 'deposit-1');
const player = (v: GameViewSnapshot) => v.entities.find((e) => e.id === PLAYER);
const mine = (v: GameViewSnapshot) => v.interactions.find((i) => i.id === 'mine');

describe('RULE-MINE-001', () => {
  it('곡괭이 보유 + 인접 + 자원 있음 → 채굴 행동 진입 (아직 획득 없음)', () => {
    const world = driveWorld({
      ...solo,
      actorPosition: { x: 8, z: -5 }, // deposit(8,-6) 과 거리 1 <= InteractionRange 2
      depositAmount: 5,
    });

    selectTarget(world, 'deposit-1');
    const result = world.dispatch({ interactionId: 'mine' });

    expect(result).toEqual({ status: 'success', rule: 'RULE-MINE-001' });
    const view = world.observe();
    expect(player(view)?.state).toBe('mine');
    expect(stoneCount(view)).toBe(0); // 완료 전에는 획득하지 않는다
    expect(deposit(view)?.labelValue).toBe(5);
  });

  it('곡괭이 없음 → Failure(no-mining-tool), 상태 불변 + 사유 코드 투영', () => {
    // C022 — 이 검증의 관심은 도구가 없다는 것이므로 광맥의 양을 **명시한다**.
    // 세계를 띄우는 기본값(C022 에서 12 로 올랐다)을 따라다니지 않는다.
    const world = driveWorld({
      ...solo,
      actorPosition: { x: 8, z: -5 },
      actorItems: {},
      depositAmount: 5,
    });

    selectTarget(world, 'deposit-1');
    const result = world.dispatch({ interactionId: 'mine' });

    expect(result).toEqual({ status: 'failure', rule: 'RULE-MINE-001', reason: 'no-mining-tool' });
    const view = world.observe();
    expect(stoneCount(view)).toBe(0);
    expect(deposit(view)?.labelValue).toBe(5);
    expect(mine(view)?.reason).toBe('no-mining-tool');
    expect(player(view)?.state).toBe('idle');
  });

  it('거리 밖 → Failure(out-of-range)', () => {
    const world = driveWorld({ ...solo, actorPosition: { x: 0, z: 0 } }); // deposit 까지 10

    selectTarget(world, 'deposit-1');
    const result = world.dispatch({ interactionId: 'mine' });

    expect(result).toEqual({ status: 'failure', rule: 'RULE-MINE-001', reason: 'out-of-range' });
  });

  it('자원 고갈 → Failure(deposit-depleted), depleted 상태 관찰', () => {
    const world = driveWorld({ ...solo, actorPosition: { x: 8, z: -5 }, depositAmount: 0 });

    selectTarget(world, 'deposit-1');
    const result = world.dispatch({ interactionId: 'mine' });

    expect(result).toEqual({
      status: 'failure',
      rule: 'RULE-MINE-001',
      reason: 'deposit-depleted',
    });
    expect(deposit(world.observe())?.state).toBe('depleted');
  });
});

describe('RULE-MINE-COMPLETE-001', () => {
  it('채굴 행동이 소요 시간을 채우면 Stone 1 획득, Deposit 1 감소, 대기 복귀', () => {
    const world = driveWorld({ ...solo, actorPosition: { x: 8, z: -5 }, depositAmount: 5 });
    selectTarget(world, 'deposit-1');
    world.dispatch({ interactionId: 'mine' });

    world.tick(MINE_DURATION / 2);
    let view = world.observe();
    expect(player(view)?.state).toBe('mine');
    expect(player(view)?.progress).toBeCloseTo(0.5); // 진행도 관찰
    expect(stoneCount(view)).toBe(0);

    world.tick(MINE_DURATION / 2);
    view = world.observe();
    expect(player(view)?.state).toBe('idle');
    expect(stoneCount(view)).toBe(1);
    expect(deposit(view)?.labelValue).toBe(4);
  });

  it('마지막 1개를 캐면 available → depleted 로 전이', () => {
    const world = driveWorld({ ...solo, actorPosition: { x: 8, z: -5 }, depositAmount: 1 });
    expect(deposit(world.observe())?.state).toBe('available');

    selectTarget(world, 'deposit-1');
    world.dispatch({ interactionId: 'mine' });
    world.tick(MINE_DURATION);

    const view = world.observe();
    expect(deposit(view)?.state).toBe('depleted');
    expect(stoneCount(view)).toBe(1);
    expect(mine(view)?.available).toBe(false);
    expect(mine(view)?.reason).toBe('deposit-depleted');
  });

  it('C001 REGRESSION — 이동해서 광맥에 도달한 뒤 캐면 Stone 을 얻는다', () => {
    const world = driveWorld({ ...solo, actorPosition: { x: 0, z: 0 }, depositAmount: 5 });

    world.dispatch({ interactionId: 'move', position: { x: 8, z: -5 } });
    for (let i = 0; i < 90; i++) world.tick(1 / 30); // 3초 — 거리 약 9.4 도달 충분
    expect(player(world.observe())?.state).toBe('idle');

    selectTarget(world, 'deposit-1');
    expect(world.dispatch({ interactionId: 'mine' }).status).toBe(
      'success',
    );
    for (let i = 0; i < 45; i++) world.tick(1 / 30); // 1.5초 — MINE_DURATION 1.2 초과

    expect(stoneCount(world.observe())).toBe(1);
  });
});
