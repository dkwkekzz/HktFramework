// 태어남 World 단독 테스트 — RULE-WORLD-GENESIS-001
//
// C-TERRAIN-003 Implements
//            INTENT-ENERGY-COMES-FIRST-001 · INTENT-PLACES-ARE-DERIVED-001 ·
//            INTENT-THE-PAST-IS-COMPUTED-001 · INTENT-SAME-SEED-SAME-WORLD-001 ·
//            INTENT-THE-STAGE-IS-NOT-ALL-VEIN-001 ·
//            INTENT-BIRTH-DOES-NOT-CHANGE-THE-TURNING-001 (회귀 — terrain.spec 의
//            규칙 검사들이 자체 자리로 그대로 도는 것이 그 증거다)
//
// 규칙 자체는 bornGroundZones 를 직접 부르고, 세계에 얹히는 것은 driveWorld 로 본다.

import { describe, expect, it } from 'vitest';
import { bornGroundZones, QUIET_BODY_RADIUS, type QuietSpot } from '../rules/world-genesis';
import { GROUND_LAWS } from '../semantic/terrain';
import {
  DEFAULT_GENESIS_SEED,
  INTERACTION_RANGE,
  SPAWN_POINTS,
  WORLD_BOUNDS,
} from '../semantic/world-state';
import { driveWorld } from './drive';

const dist = (a: { x: number; z: number }, b: { x: number; z: number }) =>
  Math.hypot(a.x - b.x, a.z - b.z);

// 기본 배치의 조용한 자리들 — index.ts 가 실제 배치에서 계산하는 그 목록과 같은 점들.
// (붙박이의 좌표가 바뀌면 이 목록도 그 검사에서 함께 어긋난다 — terrain.spec 회귀 참조)
const QUIET: QuietSpot[] = [
  ...SPAWN_POINTS.map((p) => ({ center: p, radius: QUIET_BODY_RADIUS })),
  { center: { x: -10, z: -8 }, radius: QUIET_BODY_RADIUS },
  { center: { x: -13, z: -8 }, radius: QUIET_BODY_RADIUS },
  { center: { x: -7, z: -8 }, radius: QUIET_BODY_RADIUS },
  { center: { x: -10, z: -12 }, radius: QUIET_BODY_RADIUS },
  { center: { x: -10, z: -8 }, radius: 7.0 },
  { center: { x: 12, z: 8 }, radius: QUIET_BODY_RADIUS },
  { center: { x: 4, z: 12 }, radius: QUIET_BODY_RADIUS },
  { center: { x: 8, z: -6 }, radius: INTERACTION_RANGE },
];

const LAW = GROUND_LAWS['heat-binding'];

describe('INTENT-SAME-SEED-SAME-WORLD-001 — 씨앗이 세계를 정한다', () => {
  it('같은 씨앗이면 같은 세계다 — 배치·지닌 것·단계까지 전부', () => {
    for (const seed of [1, 7, 1234, 0x5eed]) {
      expect(bornGroundZones(seed, WORLD_BOUNDS, QUIET)).toEqual(
        bornGroundZones(seed, WORLD_BOUNDS, QUIET),
      );
    }
  });

  it('다른 씨앗이면 다른 땅이다', () => {
    const a = bornGroundZones(1, WORLD_BOUNDS, QUIET);
    const b = bornGroundZones(2, WORLD_BOUNDS, QUIET);
    expect(a).not.toEqual(b);
  });

  it('세계로 띄워도 같다 — 관찰이 태어난 그대로를 싣는다', () => {
    const zones = driveWorld({ npcs: [] }).observe().ground.zones;
    const born = bornGroundZones(DEFAULT_GENESIS_SEED, WORLD_BOUNDS, QUIET);
    expect(zones.map((z) => ({ id: z.id, phase: z.phase, center: z.center }))).toEqual(
      born.map((z) => ({ id: z.id, phase: z.phase, center: z.center })),
    );
  });

  it('띄우는 쪽이 밝힌 씨앗이 세계에 남는다 — 재현의 근거', () => {
    const world = driveWorld({ npcs: [], genesisSeed: 42 });
    expect(world.observe().ground.genesisSeed).toBe(42);
  });
});

describe('RULE-WORLD-GENESIS-001 — 태어남의 구조', () => {
  // 씨앗 스무 개로 구조 불변식을 본다 — 특정 세계가 아니라 규칙을 검사한다.
  const SEEDS = Array.from({ length: 20 }, (_, i) => i + 1);

  it('맥의 범위는 무대를 벗어나지 않는다', () => {
    for (const seed of SEEDS) {
      for (const z of bornGroundZones(seed, WORLD_BOUNDS, QUIET)) {
        expect(z.center.x).toBeGreaterThanOrEqual(WORLD_BOUNDS.minX + z.radius);
        expect(z.center.x).toBeLessThanOrEqual(WORLD_BOUNDS.maxX - z.radius);
        expect(z.center.z).toBeGreaterThanOrEqual(WORLD_BOUNDS.minZ + z.radius);
        expect(z.center.z).toBeLessThanOrEqual(WORLD_BOUNDS.maxZ - z.radius);
      }
    }
  });

  it('어떤 씨앗도 조용한 자리를 품지 못한다 — INTENT-THE-STAGE-IS-NOT-ALL-VEIN-001', () => {
    for (const seed of SEEDS) {
      for (const z of bornGroundZones(seed, WORLD_BOUNDS, QUIET)) {
        for (const q of QUIET) {
          expect(dist(z.center, q.center)).toBeGreaterThan(z.radius + q.radius);
        }
      }
    }
  });

  it('맥은 흩어진 점이 아니라 이어진 밭이다 — 둘째부터는 이웃 거리에 선다', () => {
    for (const seed of SEEDS) {
      const zones = bornGroundZones(seed, WORLD_BOUNDS, QUIET);
      for (const z of zones.slice(1)) {
        const neighbor = zones.some(
          (other) => other !== z && Math.abs(dist(z.center, other.center) - LAW.veinStride) < 1e-9,
        );
        expect(neighbor).toBe(true);
      }
    }
  });

  it('가장 찬 맥이 포화되어 뿜으며 태어난다 — 오늘의 해숨구멍 (BT §5.3)', () => {
    for (const seed of SEEDS) {
      const zones = bornGroundZones(seed, WORLD_BOUNDS, QUIET);
      if (zones.length === 0) continue;
      const venting = zones.filter((z) => z.phase === 'venting');
      expect(venting).toHaveLength(1);
      expect(venting[0]!.kept).toBe(LAW.saturation);
      for (const z of zones) {
        expect(z.kept).toBeGreaterThanOrEqual(0);
        expect(z.kept).toBeLessThanOrEqual(LAW.saturation);
      }
    }
  });
});

describe('기본 씨앗의 세계 — 03 BALANCE 2 를 이 검사가 지킨다', () => {
  // DEFAULT_GENESIS_SEED 를 바꾸려면 이 조건들을 다시 만족하는 값이어야 한다.
  const zones = bornGroundZones(DEFAULT_GENESIS_SEED, WORLD_BOUNDS, QUIET);

  it('맥 넷이 서고 하나가 뿜는 중이다', () => {
    expect(zones).toHaveLength(LAW.veins);
    expect(zones.filter((z) => z.phase === 'venting')).toHaveLength(1);
  });

  it('시작 자리에서 걸어 닿는 거리에 맥의 밭이 있다 — 한 판 안에서 겪을 수 있다', () => {
    const near = Math.min(...zones.map((z) => dist(z.center, { x: 0, z: 0 })));
    expect(near).toBeGreaterThanOrEqual(8);
    expect(near).toBeLessThanOrEqual(16);
  });

  it('가로지르기 검사가 설 자리가 있다 — 덜 찬 먼 맥 (terrain.spec 이 쓴다)', () => {
    const venting = zones.find((z) => z.phase === 'venting')!;
    const target = zones.filter(
      (z) =>
        z.phase === 'binding' &&
        z.kept <= LAW.saturation * 0.6 &&
        dist(z.center, venting.center) >= 7,
    );
    expect(target.length).toBeGreaterThan(0);
  });
});
