// Engine Physics — 솔버 단독 테스트 (P6 ADDED).
//
// 어느 팩도 import 하지 않는다 — 게임 명사 없이 수식의 성질만 검증한다.
// 팩들의 결합 동작(능력치·피해·경계)은 각 팩의 테스트가 이미 감당한다.

import { describe, expect, it } from 'vitest';
import type { KineticBody } from '../body';
import { integrateMomentum } from '../momentum';
import { resolveCirclePush } from '../push';
import { integrateSeek } from '../seek';
import { applyRadialImpulse, arcSweepCollider, circleHits } from '../sweep';
import { CENTER_EPSILON, distance, normalized, normalizedOrFixed } from '../vec';

function body(x: number, z: number, radius = 0.5, mass = 1): KineticBody {
  return { position: { x, z }, velocity: { x: 0, z: 0 }, bodyRadius: radius, bodyMass: mass };
}

describe('vec — 방향과 거리', () => {
  it('영벡터에는 방향이 없다', () => {
    expect(normalized(0, 0)).toBeNull();
    expect(normalized(CENTER_EPSILON / 2, 0)).toBeNull();
  });

  it('중심 일치 시 고정 방향(+x)이다 — 결정론', () => {
    expect(normalizedOrFixed(0, 0)).toEqual({ x: 1, z: 0 });
  });

  it('거리는 대칭이다', () => {
    const a = { x: 1, z: 2 };
    const b = { x: 4, z: 6 };
    expect(distance(a, b)).toBe(5);
    expect(distance(b, a)).toBe(5);
  });
});

describe('seek — 목표점 추적 적분', () => {
  it('걸음보다 멀면 방향으로 걸음만큼 간다', () => {
    const walker = body(0, 0);
    const step = integrateSeek(walker, { x: 10, z: 0 }, 1);
    expect(step.arrived).toBe(false);
    expect(walker.position.x).toBeCloseTo(1);
  });

  it('걸음 안이면 목표에 스냅하고 도착한다', () => {
    const walker = body(9.5, 0);
    const step = integrateSeek(walker, { x: 10, z: 0 }, 1);
    expect(step.arrived).toBe(true);
    expect(walker.position).toEqual({ x: 10, z: 0 });
  });

  it('적분 전 변위를 돌려준다 — 몸 돌리기의 기준이 된다', () => {
    const walker = body(0, 0);
    const step = integrateSeek(walker, { x: 3, z: 4 }, 1);
    expect(step.dx).toBe(3);
    expect(step.dz).toBe(4);
  });
});

describe('push — 원 밀어내기', () => {
  it('겹치지 않으면 아무 일도 없다', () => {
    const a = body(0, 0);
    const b = body(2, 0);
    expect(resolveCirclePush([a, b], 60, 1 / 30)).toBe(0);
    expect(a.velocity).toEqual({ x: 0, z: 0 });
  });

  it('겹치면 서로 반대 방향으로 밀린다 — 힘의 크기는 같다 (제3법칙)', () => {
    const a = body(0, 0);
    const b = body(0.6, 0);
    expect(resolveCirclePush([a, b], 60, 1 / 30)).toBe(1);
    expect(a.velocity.x).toBeLessThan(0);
    expect(b.velocity.x).toBeGreaterThan(0);
    expect(a.velocity.x).toBeCloseTo(-b.velocity.x);
  });

  it('무거운 몸이 덜 밀린다 (제2법칙)', () => {
    const light = body(0, 0, 0.5, 1);
    const heavy = body(0.6, 0, 0.5, 4);
    resolveCirclePush([light, heavy], 60, 1 / 30);
    expect(Math.abs(light.velocity.x)).toBeCloseTo(Math.abs(heavy.velocity.x) * 4);
  });

  it('중심 일치 시 앞선 쪽이 -x 로 밀린다 — 같은 입력이면 언제나 같은 결과다', () => {
    const a = body(0, 0);
    const b = body(0, 0);
    resolveCirclePush([a, b], 60, 1 / 30);
    expect(a.velocity.x).toBeLessThan(0);
    expect(b.velocity.x).toBeGreaterThan(0);
  });
});

describe('momentum — 관성 적분', () => {
  it('속도만큼 움직이고 마찰로 잦아든다', () => {
    const b = body(0, 0);
    b.velocity.x = 3;
    integrateMomentum([b], 6, 0.02, 1 / 30);
    expect(b.position.x).toBeCloseTo(0.1);
    expect(b.velocity.x).toBeLessThan(3);
  });

  it('정지 판정 속도 아래로 잦아들면 완전히 멈춘다', () => {
    const b = body(0, 0);
    b.velocity.x = 0.01;
    integrateMomentum([b], 6, 0.02, 1 / 30);
    expect(b.velocity).toEqual({ x: 0, z: 0 });
  });

  it('경계를 넘으면 경계에 고정되고 그 축의 속도가 0 이 된다', () => {
    const b = body(9.9, 0);
    b.velocity.x = 30;
    integrateMomentum([b], 0, 0, 1 / 30, { minX: -10, maxX: 10, minZ: -10, maxZ: 10 });
    expect(b.position.x).toBe(10);
    expect(b.velocity.x).toBe(0);
  });

  it('경계가 없으면 어디까지든 간다', () => {
    const b = body(9.9, 0);
    b.velocity.x = 30;
    integrateMomentum([b], 0, 0, 1 / 30);
    expect(b.position.x).toBeGreaterThan(10);
  });
});

describe('sweep — 호 스윕과 접촉·충격', () => {
  const spec = { arc: Math.PI / 2, tipRadius: 0.7, reach: 1.3, begin: 0.25, end: 0.75 };

  it('진행도에 따라 +arc/2 에서 -arc/2 로 쓸고 지나간다', () => {
    const facing = { x: 0, z: 1 };
    const start = arcSweepCollider({ x: 0, z: 0 }, facing, 0.25, spec);
    const mid = arcSweepCollider({ x: 0, z: 0 }, facing, 0.5, spec);
    const end = arcSweepCollider({ x: 0, z: 0 }, facing, 0.75, spec);
    expect(mid.center.x).toBeCloseTo(0); // 한가운데에서는 정면
    expect(mid.center.z).toBeCloseTo(spec.reach);
    expect(start.center.x).toBeCloseTo(-end.center.x); // 시작과 끝은 좌우 대칭
  });

  it('활성 구간 밖에서는 경계 각에 고정되고 비활성이다', () => {
    const facing = { x: 0, z: 1 };
    const before = arcSweepCollider({ x: 0, z: 0 }, facing, 0.1, spec);
    const atBegin = arcSweepCollider({ x: 0, z: 0 }, facing, 0.25, spec);
    expect(before.active).toBe(false);
    expect(atBegin.active).toBe(true);
    expect(before.center.x).toBeCloseTo(atBegin.center.x);
  });

  it('접촉은 구 반경 + 몸 반경 안이다', () => {
    expect(circleHits({ x: 0, z: 0 }, 0.7, body(1.1, 0, 0.5))).toBe(true);
    expect(circleHits({ x: 0, z: 0 }, 0.7, body(1.3, 0, 0.5))).toBe(false);
  });

  it('충격은 기점에서 멀어지는 방향이고 질량에 반비례한다', () => {
    const target = body(1, 0, 0.5, 2);
    applyRadialImpulse({ x: 0, z: 0 }, target, 8);
    expect(target.velocity.x).toBeCloseTo(4);
    expect(target.velocity.z).toBeCloseTo(0);
  });
});
