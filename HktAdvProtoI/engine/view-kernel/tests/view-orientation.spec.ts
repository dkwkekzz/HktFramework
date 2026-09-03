// 시점 방향 단독 테스트 — 렌더러 없이 값으로만 검증한다.
// 04-gameview.spec.yaml 의 viewpoint.orientation 과 interactions.move.direction 이 검증 대상이다.

import { describe, expect, it } from 'vitest';
import {
  DEFAULT_ORIENTATION,
  TILT_MAX,
  TILT_MIN,
  clampTilt,
  screenSideValue,
  turned,
  VIEW_DISTANCE,
  viewForward,
  viewOffset,
  viewRight,
  worldDirection,
  wrapTurn,
} from '../camera/orientation';

const near = (a: number, b: number) => expect(a).toBeCloseTo(b, 6);
const QUARTER = Math.PI / 2;

describe('시점 방향 (viewpoint.orientation)', () => {
  it('기본 시점은 예전의 고정 오프셋(0, 7.5, 13)과 같은 자리를 만든다 — 회귀', () => {
    const offset = viewOffset(DEFAULT_ORIENTATION);
    near(offset.x, 0);
    near(offset.y, 7.5);
    expect(offset.z).toBeCloseTo(12.99, 2);
  });

  it('turn = 0 이면 -z 를 보고 화면 오른쪽은 +x 다', () => {
    near(viewForward(0).x, 0);
    near(viewForward(0).z, -1);
    near(viewRight(0).x, 1);
    near(viewRight(0).z, 0);
  });

  it('돌린 각은 유지되고 저절로 되돌아가지 않는다 (persists · autoReturn: false)', () => {
    let o = { ...DEFAULT_ORIENTATION };
    o = turned(o, 0.4, 0);
    const afterTurn = o.turn;
    o = turned(o, 0, 0); // 아무것도 하지 않은 프레임
    o = turned(o, 0, 0);
    expect(o.turn).toBe(afterTurn);
  });

  it('기우는 각은 한계 안에 머문다 (tilt.bounded) — 뒤집히지 않는다', () => {
    expect(clampTilt(-5)).toBe(TILT_MIN);
    expect(clampTilt(5)).toBe(TILT_MAX);
    const o = turned({ turn: 0, tilt: TILT_MAX }, 0, 10);
    expect(o.tilt).toBe(TILT_MAX);
    expect(turned({ turn: 0, tilt: TILT_MIN }, 0, -10).tilt).toBe(TILT_MIN);
  });

  it('방향의 변화는 이어져 있다 (continuity) — 접히는 지점에서도 건너뛰지 않는다', () => {
    // π 를 넘어가면 표현값은 -π 쪽으로 접히지만 바라보는 방향은 조금씩만 바뀐다.
    let o = { turn: Math.PI - 0.02, tilt: 0.5 };
    const before = viewForward(o.turn);
    o = turned(o, 0.04, 0);
    const after = viewForward(o.turn);
    expect(Math.abs(o.turn)).toBeLessThanOrEqual(Math.PI);
    const moved = Math.hypot(after.x - before.x, after.z - before.z);
    expect(moved).toBeLessThan(0.05); // 방향은 한 걸음만 움직였다
  });

  it('wrapTurn 은 (-π, π] 안으로 접는다', () => {
    near(wrapTurn(Math.PI * 2 + 0.5), 0.5);
    near(wrapTurn(-Math.PI * 2 - 0.5), -0.5);
  });

  // 시점 거리는 상수 하나다 — 무엇으로도 바꾸지 않는다.
  // Region 이 대륙급이 되어도 몸에서 떨어진 길이가 같아야 몸이 far plane 밖으로 나가지 않는다.
  it('거리는 몸에서 떨어진 길이 그대로다 — 어느 각에서 재도 VIEW_DISTANCE 다', () => {
    for (const o of [{ turn: 0, tilt: 0.2 }, { turn: -1.4, tilt: 0.9 }, { turn: 2.5, tilt: 1.2 }]) {
      const offset = viewOffset(o);
      near(Math.hypot(offset.x, offset.y, offset.z), VIEW_DISTANCE);
    }
  });

  it('시점은 몸을 두고 그 주위를 돈다 — 거리는 그대로고 자리만 바뀐다 (follows)', () => {
    const a = viewOffset({ turn: 0, tilt: 0.5 });
    const b = viewOffset({ turn: QUARTER, tilt: 0.5 });
    expect(Math.hypot(a.x, a.y, a.z)).toBeCloseTo(Math.hypot(b.x, b.y, b.z), 6);
    expect(Math.hypot(a.x - b.x, a.z - b.z)).toBeGreaterThan(1); // 자리는 달라졌다
  });
});

describe('시점 기준 이동 (interactions.move.direction)', () => {
  const W = { x: 0, z: -1 };
  const D = { x: 1, z: 0 };

  it('turn = 0 에서는 지금까지와 같다 — 앞은 -z, 오른쪽은 +x (회귀)', () => {
    near(worldDirection(0, W).x, 0);
    near(worldDirection(0, W).z, -1);
    near(worldDirection(0, D).x, 1);
    near(worldDirection(0, D).z, 0);
  });

  it('시점을 돌리면 같은 키가 세계의 다른 방향이 된다', () => {
    const forward = worldDirection(QUARTER, W);
    near(forward.x, -1);
    near(forward.z, 0);
    const right = worldDirection(QUARTER, D);
    near(right.x, 0);
    near(right.z, -1);
  });

  it('앞은 언제나 시점이 보는 쪽이고, 오른쪽은 그 방향의 오른쪽이다', () => {
    for (const turn of [-2.3, -0.7, 0, 0.4, 1.9, 3.0]) {
      const forward = worldDirection(turn, W);
      near(forward.x, viewForward(turn).x);
      near(forward.z, viewForward(turn).z);
      const right = worldDirection(turn, D);
      near(right.x, viewRight(turn).x);
      near(right.z, viewRight(turn).z);
    }
  });

  it('환산 결과는 언제나 단위 방향이다 — 비스듬히 눌러도 빨라지지 않는다', () => {
    const diagonal = { x: Math.SQRT1_2, z: -Math.SQRT1_2 };
    const d = worldDirection(1.1, diagonal);
    near(Math.hypot(d.x, d.z), 1);
  });

  it('아무 방향도 아닌 입력은 방향이 되지 않는다', () => {
    const d = worldDirection(1.1, { x: 0, z: 0 });
    expect(d).toEqual({ x: 0, z: 0 });
  });
});

describe('몸 방향의 화면 좌우 (entities.character.facing.read)', () => {
  it('turn = 0 에서 +x 를 향한 몸은 오른쪽으로 읽힌다', () => {
    expect(screenSideValue(0, { x: 1, z: 0 })).toBeGreaterThan(0);
    expect(screenSideValue(0, { x: -1, z: 0 })).toBeLessThan(0);
  });

  it('같은 몸 방향이라도 시점을 반대로 돌리면 반대쪽으로 읽힌다', () => {
    const facing = { x: 1, z: 0 };
    const front = screenSideValue(0, facing);
    const behind = screenSideValue(Math.PI, facing);
    expect(front).toBeGreaterThan(0);
    expect(behind).toBeLessThan(0);
    near(front, -behind);
  });

  it('시점의 정면·정후면을 향한 몸은 좌우 어느 쪽도 아니다', () => {
    near(screenSideValue(0, { x: 0, z: -1 }), 0); // 시점이 보는 쪽으로 등을 돌린 몸
    near(screenSideValue(0, { x: 0, z: 1 }), 0); // 시점을 마주 본 몸
  });

  it('읽히는 좌우는 몸과 시점 사이의 관계다 — 시점이 90° 돌면 정면이던 몸이 좌우가 된다', () => {
    const facing = { x: 0, z: -1 };
    near(screenSideValue(0, facing), 0);
    expect(screenSideValue(QUARTER, facing)).toBeGreaterThan(0.99);
  });
});
