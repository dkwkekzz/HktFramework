// 손가락 조작 — 세계로 가는 것이 키보드일 때와 같은지가 이 검사의 요점이다.
// 조작 수단이 늘어도 세계가 받는 것은 달라지면 안 된다.

import { describe, expect, it } from 'vitest';
import {
  clampKnob,
  stickVector,
  STICK_DEADZONE,
  STICK_RADIUS,
} from '../input/touch';

describe('stickVector — 스틱을 민 방향', () => {
  it('가만히 있으면 아무 방향도 아니다', () => {
    expect(stickVector(0, 0)).toBeNull();
  });

  it('죽은 구역 안의 흔들림은 민 것이 아니다', () => {
    expect(stickVector(STICK_DEADZONE - 1, 0)).toBeNull();
    expect(stickVector(0, -(STICK_DEADZONE - 1))).toBeNull();
  });

  it('죽은 구역을 넘으면 민 것이다', () => {
    expect(stickVector(STICK_DEADZONE + 1, 0)).not.toBeNull();
  });

  it('화면에서 민 쪽과 세계에서 가는 쪽이 같은 규약이다 (keyboard.ts 와 동일)', () => {
    // 위로 밀면 앞으로 (KeyW = z:-1) · 아래로 밀면 뒤로 (KeyS = z:+1)
    expect(stickVector(0, -40)).toEqual({ x: 0, z: -1 });
    expect(stickVector(0, 40)).toEqual({ x: 0, z: 1 });
    // 오른쪽으로 밀면 오른쪽 (KeyD = x:+1) · 왼쪽이면 왼쪽 (KeyA = x:-1)
    expect(stickVector(40, 0)).toEqual({ x: 1, z: 0 });
    expect(stickVector(-40, 0)).toEqual({ x: -1, z: 0 });
  });

  it('얼마나 세게 밀었든 단위 벡터다 — 키보드가 주는 것과 같은 모양이어야 한다', () => {
    for (const [dx, dy] of [
      [30, 0],
      [400, 0],
      [50, 50],
      [-120, 37],
    ] as const) {
      const dir = stickVector(dx, dy)!;
      expect(Math.hypot(dir.x, dir.z)).toBeCloseTo(1, 10);
    }
  });

  it('대각으로 민 것은 키 둘을 함께 누른 것과 같은 벡터다', () => {
    // keyboard.ts 의 direction() 은 KeyW{0,-1} + KeyD{1,0} 을 더해 정규화한다.
    // 손가락으로 같은 쪽을 밀면 세계는 같은 것을 받아야 한다.
    const length = Math.sqrt(2);
    const byKey = { x: 1 / length, z: -1 / length };

    const byStick = stickVector(40, -40)!;
    expect(byStick.x).toBeCloseTo(byKey.x, 10);
    expect(byStick.z).toBeCloseTo(byKey.z, 10);
  });
});

describe('clampKnob — 손잡이가 놓이는 자리', () => {
  it('최대 거리 안에서는 손가락을 그대로 따라간다', () => {
    expect(clampKnob(10, -20)).toEqual({ x: 10, y: -20 });
  });

  it('최대 거리를 넘어가지 않는다', () => {
    const knob = clampKnob(500, 500);
    expect(Math.hypot(knob.x, knob.y)).toBeCloseTo(STICK_RADIUS, 10);
  });

  it('넘어가도 민 쪽은 그대로다', () => {
    const knob = clampKnob(0, 900);
    expect(knob.x).toBe(0);
    expect(knob.y).toBeCloseTo(STICK_RADIUS, 10);
  });
});
