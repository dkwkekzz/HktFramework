// Cycle Scope — "특정 Cycle 까지의 게임" 실행 범위 테스트
// 게이트 로직 자체는 합성 Registry 로 검증한다 (없는 Cycle 을 실제 Registry 에 만들지 않는다).

import { describe, expect, it } from 'vitest';
import { RULE_MINE, RULE_MOVE, RULE_MOVE_PROGRESS } from '../../protocol/semantic-id';
import { createWorld } from '../index';
import { CYCLE_REGISTRY, type CycleEntry } from '../cycle/registry';
import { latestCycleId, listCycles, resolveCycleScope, UnknownCycleError } from '../cycle/scope';

// 두 Cycle 짜리 합성 Registry — 뒤 Cycle 이 잘려나가는지 확인하기 위한 것
const FAKE_REGISTRY: readonly CycleEntry[] = [
  { id: 'X001', dir: 'X001-first', title: '첫 Cycle', rules: [RULE_MOVE, RULE_MOVE_PROGRESS] },
  { id: 'X002', dir: 'X002-second', title: '둘째 Cycle', rules: [RULE_MINE] },
];

describe('resolveCycleScope', () => {
  it('미지정 / latest → 마지막 Cycle 까지 (현재 게임 전체)', () => {
    for (const input of [undefined, null, '', '  ', 'latest', 'LATEST']) {
      const scope = resolveCycleScope(input, FAKE_REGISTRY);
      expect(scope.target).toBe('X002');
      expect(scope.cycles).toEqual(['X001', 'X002']);
      expect(scope.isLatest).toBe(true);
    }
  });

  it('과거 Cycle 지정 → 그 Cycle 까지만 포함하고 이후 Rule 은 배제한다', () => {
    const scope = resolveCycleScope('X001', FAKE_REGISTRY);

    expect(scope.cycles).toEqual(['X001']);
    expect(scope.isLatest).toBe(false);
    expect(scope.has('X001')).toBe(true);
    expect(scope.has('X002')).toBe(false);
    expect(scope.allowsRule(RULE_MOVE)).toBe(true);
    expect(scope.allowsRule(RULE_MINE)).toBe(false); // X002 가 도입한 Rule
  });

  it('Cycle Id · 디렉터리 이름 · 대소문자를 모두 같은 Cycle 로 받는다', () => {
    for (const input of ['X001', 'x001', 'X001-first', 'x001-FIRST']) {
      expect(resolveCycleScope(input, FAKE_REGISTRY).target).toBe('X001');
    }
  });

  it('등록되지 않은 Rule 은 어떤 Scope 에서도 실행되지 않는다', () => {
    expect(resolveCycleScope('latest', FAKE_REGISTRY).allowsRule('RULE-NOT-REGISTERED')).toBe(false);
  });

  it('알 수 없는 Cycle → 조용히 최신으로 넘어가지 않고 던진다', () => {
    expect(() => resolveCycleScope('C999', FAKE_REGISTRY)).toThrow(UnknownCycleError);
    expect(() => resolveCycleScope('C999', FAKE_REGISTRY)).toThrow(/X001, X002/);
  });
});

describe('실제 Cycle Registry', () => {
  it('Cycle Id 는 중복 없이 진행 순서대로 나열되어 있다', () => {
    const ids = listCycles().map((c) => c.id);
    expect(ids.length).toBeGreaterThan(0);
    expect(new Set(ids).size).toBe(ids.length);
    expect([...ids].sort()).toEqual(ids);
    expect(latestCycleId()).toBe(ids[ids.length - 1]);
  });

  it('현재 구현된 Rule 은 모두 어느 Cycle 엔가 등록되어 있다', () => {
    const registered = new Set(CYCLE_REGISTRY.flatMap((c) => c.rules));
    for (const rule of [RULE_MOVE, RULE_MOVE_PROGRESS, RULE_MINE]) {
      expect(registered.has(rule)).toBe(true);
    }
  });

  it('최신 Cycle 로 실행하면 현재 게임 전체가 굴러간다 (C001 Regression)', () => {
    const world = createWorld({ upToCycle: latestCycleId(), actorPosition: { x: 8, z: -5 } });

    expect(world.scope.isLatest).toBe(true);
    expect(world.dispatch({ type: 'mine', depositId: 'deposit-1' })).toEqual({
      status: 'success',
      rule: RULE_MINE,
    });
  });
});

describe('World 실행 범위', () => {
  it('Scope 밖 Rule 요청 → 상태를 바꾸지 않고 out-of-cycle-scope 실패', () => {
    // X001 까지만 굴리는 World — Mine 은 X002 의 가능성이라 아직 존재하지 않는다
    const world = createWorld({
      upToCycle: 'X001',
      cycleRegistry: FAKE_REGISTRY,
      actorPosition: { x: 8, z: -5 },
    });

    const before = world.projectPlayerView();
    const result = world.dispatch({ type: 'mine', depositId: 'deposit-1' });

    expect(result).toEqual({ status: 'failure', rule: RULE_MINE, reason: 'out-of-cycle-scope' });
    const after = world.projectPlayerView();
    expect(after.hud.inventory.stone).toBe(before.hud.inventory.stone);
    expect(after.entities.deposit.remaining).toBe(before.entities.deposit.remaining);
  });

  it('Scope 안 Rule 은 그대로 굴러간다 (같은 World 의 Move)', () => {
    const world = createWorld({ upToCycle: 'X001', cycleRegistry: FAKE_REGISTRY });

    expect(world.dispatch({ type: 'move', target: { x: 6, z: 0 } })).toEqual({
      status: 'success',
      rule: RULE_MOVE,
    });
    world.tick(1.1);
    expect(world.projectPlayerView().entities.player.position.x).toBeCloseTo(6);
  });

  it('시간 진행 법칙도 Scope 밖이면 멈춘다', () => {
    const onlyMoveRequest: readonly CycleEntry[] = [
      { id: 'X001', dir: 'X001-first', title: '이동 요청만', rules: [RULE_MOVE] },
    ];
    const world = createWorld({ cycleRegistry: onlyMoveRequest });

    world.dispatch({ type: 'move', target: { x: 6, z: 0 } });
    world.tick(1.1);

    expect(world.projectPlayerView().entities.player.position.x).toBe(0); // 진행 법칙 없음
  });
});
