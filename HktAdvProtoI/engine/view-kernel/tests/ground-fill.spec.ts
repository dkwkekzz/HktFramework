// 지면 구역의 채움 — 지형을 따라가는가.
//
// 요점 하나: 드리우기는 **이미 있는 vertex 만** 올리므로, 면이 미리 잘게 나뉘어 있지 않으면
// 꼭짓점만 올라간 기울어진 판이 되어 지형을 뚫고 떠오른다. 그래서 검사는 "꼭짓점"이 아니라
// **모든 vertex** 가 그 자리의 지면에 붙는가다.

import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { createGroundFill, type GroundFillShape } from '../terrain/ground-fill';

const LIFT = 0.06;
const STEP = 1;

/** 서쪽에서 동쪽으로 기울어진 지면 */
const slope = (x: number, z: number) => x * 0.5 + z * 0.25;

/**
 * 가운데가 솟은 지면 — 네 꼭짓점만 올린 판으로는 절대 따라갈 수 없다.
 * (기울기만 있는 지면은 판으로도 맞아떨어져 결함이 드러나지 않는다)
 */
const bump = (x: number, z: number) => 6 * Math.exp(-(x * x + z * z) / 200);

function positionsOf(geometry: THREE.BufferGeometry) {
  return geometry.getAttribute('position');
}

/**
 * 면이 지면에서 얼마나 떠 있는가 — vertex 와 **삼각형 안쪽**(무게중심)을 함께 잰다.
 * vertex 만 재면 결함이 잡히지 않는다: 드리우기는 있는 vertex 를 늘 정확히 올리고,
 * 떠오르는 것은 그 사이의 면이기 때문이다.
 */
function worstDrift(
  geometry: THREE.BufferGeometry,
  heightAt: (x: number, z: number) => number,
): number {
  const position = positionsOf(geometry);
  const index = geometry.getIndex()!;
  let worst = 0;
  for (let i = 0; i < position.count; i++) {
    const expected = heightAt(position.getX(i), position.getZ(i)) + LIFT;
    worst = Math.max(worst, Math.abs(position.getY(i) - expected));
  }
  const at = (i: number) =>
    new THREE.Vector3(position.getX(i), position.getY(i), position.getZ(i));
  for (let t = 0; t < index.count; t += 3) {
    const middle = at(index.getX(t))
      .add(at(index.getX(t + 1)))
      .add(at(index.getX(t + 2)))
      .multiplyScalar(1 / 3);
    worst = Math.max(worst, Math.abs(middle.y - (heightAt(middle.x, middle.z) + LIFT)));
  }
  return worst;
}

function longestEdge(geometry: THREE.BufferGeometry): number {
  const position = positionsOf(geometry);
  const index = geometry.getIndex()!;
  const at = (i: number) =>
    new THREE.Vector3(position.getX(i), position.getY(i), position.getZ(i));
  let worst = 0;
  for (let t = 0; t < index.count; t += 3) {
    const [a, b, c] = [at(index.getX(t)), at(index.getX(t + 1)), at(index.getX(t + 2))];
    worst = Math.max(worst, a.distanceTo(b), b.distanceTo(c), c.distanceTo(a));
  }
  return worst;
}

const square: GroundFillShape = {
  kind: 'polygon',
  points: [
    { x: -20, z: -20 },
    { x: 20, z: -20 },
    { x: 20, z: 20 },
    { x: -20, z: 20 },
  ],
};

describe('createGroundFill — 채움이 지면에 붙는다', () => {
  it('솟은 지형 위에서 면 안쪽까지 지면에 붙는다 — 꼭짓점만이 아니다', () => {
    const geometry = createGroundFill(square, { step: STEP, lift: LIFT, heightAt: bump });
    // 꼭짓점 넷으로 남지 않았다 — 안쪽에 vertex 가 생겼다
    expect(positionsOf(geometry).count).toBeGreaterThan(100);
    expect(worstDrift(geometry, bump)).toBeLessThan(0.05);
  });

  it('나누지 않으면 면이 떠오른다 — 고친 것이 바로 그것이다', () => {
    // 눈금을 면보다 크게 주면 나누지 않는다 = 꼭짓점 넷짜리 판 (고치기 전의 채움)
    const slab = createGroundFill(square, { step: 1000, lift: LIFT, heightAt: bump });
    expect(positionsOf(slab).count).toBe(4);
    expect(worstDrift(slab, bump)).toBeGreaterThan(3); // 미터 단위로 떠 있다
  });

  it('기울기만 있는 지형에서도 안쪽이 붙는다', () => {
    const geometry = createGroundFill(square, { step: STEP, lift: LIFT, heightAt: slope });
    expect(worstDrift(geometry, slope)).toBeLessThan(1e-4);
  });

  it('나뉜 눈금은 테두리와 같다 — 그보다 긴 변이 남지 않는다', () => {
    const geometry = createGroundFill(square, { step: STEP, lift: LIFT, heightAt: slope });
    expect(longestEdge(geometry)).toBeLessThanOrEqual(STEP + 1e-6);
  });

  it('원판도 안쪽까지 나뉘어 지면에 붙는다', () => {
    const circle: GroundFillShape = { kind: 'circle', center: { x: 3, z: -4 }, radius: 12 };
    const geometry = createGroundFill(circle, { step: STEP, lift: LIFT, heightAt: bump });
    expect(worstDrift(geometry, bump)).toBeLessThan(0.05);
    expect(longestEdge(geometry)).toBeLessThanOrEqual(STEP + 1e-6);
    // 세계 좌표다 — mesh 를 옮기지 않아도 제자리에 있다
    const position = positionsOf(geometry);
    let minX = Infinity;
    let maxX = -Infinity;
    for (let i = 0; i < position.count; i++) {
      minX = Math.min(minX, position.getX(i));
      maxX = Math.max(maxX, position.getX(i));
    }
    expect(minX).toBeCloseTo(3 - 12, 1);
    expect(maxX).toBeCloseTo(3 + 12, 1);
  });

  it('오목한 폴리곤도 채운다 — 삼각분할은 three 의 것을 쓴다', () => {
    const bent: GroundFillShape = {
      kind: 'polygon',
      points: [
        { x: 0, z: 0 },
        { x: 10, z: 0 },
        { x: 10, z: 4 },
        { x: 4, z: 4 },
        { x: 4, z: 10 },
        { x: 0, z: 10 },
      ],
    };
    const geometry = createGroundFill(bent, { step: STEP, lift: LIFT, heightAt: bump });
    expect(worstDrift(geometry, bump)).toBeLessThan(0.05);
    // 오목한 자리(6, 6) 는 폴리곤 밖이다 — 채움이 거기까지 번지지 않는다
    const position = positionsOf(geometry);
    let outside = 0;
    for (let i = 0; i < position.count; i++) {
      if (position.getX(i) > 4.001 && position.getZ(i) > 4.001) outside++;
    }
    expect(outside).toBe(0);
  });

  it('땅이 없을 때(높이 0)는 띄운 평면 그대로다', () => {
    const flat = () => 0;
    const geometry = createGroundFill(square, { step: STEP, lift: LIFT, heightAt: flat });
    const position = positionsOf(geometry);
    for (let i = 0; i < position.count; i++) expect(position.getY(i)).toBeCloseTo(LIFT, 6);
  });

  it('눈금보다 작은 면은 나누지 않는다 — 전과 같은 삼각형이다', () => {
    const tiny: GroundFillShape = {
      kind: 'polygon',
      points: [
        { x: 0, z: 0 },
        { x: 0.5, z: 0 },
        { x: 0.5, z: 0.5 },
      ],
    };
    const geometry = createGroundFill(tiny, { step: STEP, lift: LIFT, heightAt: slope });
    expect(positionsOf(geometry).count).toBe(3);
    expect(geometry.getIndex()!.count).toBe(3);
  });

  it('나눈 vertex 를 이웃과 나눠 갖는다 — 같은 자리가 둘이 되지 않는다 (틈 없음)', () => {
    const geometry = createGroundFill(square, { step: STEP, lift: LIFT, heightAt: slope });
    const position = positionsOf(geometry);
    const seen = new Set<string>();
    for (let i = 0; i < position.count; i++) {
      seen.add(`${position.getX(i)}|${position.getZ(i)}`);
    }
    expect(seen.size).toBe(position.count);
  });

  it('삼각형이 뒤집히지 않는다 — 나눈 뒤에도 위를 향한다', () => {
    const geometry = createGroundFill(square, { step: STEP, lift: LIFT, heightAt: () => 0 });
    const position = positionsOf(geometry);
    const index = geometry.getIndex()!;
    const at = (i: number) =>
      new THREE.Vector3(position.getX(i), position.getY(i), position.getZ(i));
    for (let t = 0; t < index.count; t += 3) {
      const a = at(index.getX(t));
      const b = at(index.getX(t + 1));
      const c = at(index.getX(t + 2));
      const normal = b.clone().sub(a).cross(c.clone().sub(a));
      expect(normal.y).toBeGreaterThan(0);
    }
  });
});
