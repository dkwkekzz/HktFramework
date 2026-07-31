import { describe, expect, it } from 'vitest';
import {
  SpatialIndex,
  SpatialRejection,
  boxesIntersect,
  boxesOverlap,
  boxDistance,
  buildWorld,
  cellBox,
  cellCenter,
  cellKey,
  contains,
  findPath,
  parseCellKey,
  positionOf,
  reachOf,
  capabilitiesOf,
  segmentHitsBox,
  toCell,
} from '../../src/index.js';
import type { Box, SpatialLayout } from '../../src/index.js';
import { COMPONENT_DEFINITIONS, LAYOUT, TWO_ROOMS } from '../../scenarios/fixtures.js';

const box = (minX: number, minY: number, maxX: number, maxY: number): Box => ({
  min: { x: minX, y: minY, z: -1 },
  max: { x: maxX, y: maxY, z: 1 },
});

describe('상자와 선분', () => {
  it('겹치는 상자와 닿기만 한 상자를 구분한다', () => {
    expect(boxesOverlap(box(0, 0, 1, 1), box(1, 0, 2, 1))).toBe(true);
    // 벽에 등을 붙이고 서는 것은 통과가 아니다 — 경계선만 닿은 것은 겹침이 아니다.
    expect(boxesIntersect(box(0, 0, 1, 1), box(1, 0, 2, 1))).toBe(false);
    expect(boxesIntersect(box(0, 0, 1, 1), box(0.9, 0, 2, 1))).toBe(true);
  });

  it('상자 사이 거리는 겹치면 0, 떨어지면 표면 사이 거리다', () => {
    expect(boxDistance(box(0, 0, 1, 1), box(0.5, 0.5, 2, 2))).toBe(0);
    expect(boxDistance(box(0, 0, 1, 1), box(4, 0, 5, 1))).toBe(3);
    expect(boxDistance(box(0, 0, 1, 1), box(4, 4, 5, 5))).toBeCloseTo(Math.hypot(3, 3), 12);
  });

  it('선분이 상자를 뚫는지 정확히 본다 — 표본이 아니라 구간 교집합으로', () => {
    const wall = box(3.5, -0.5, 4.5, 4.5);
    expect(segmentHitsBox({ x: 1, y: 2, z: 0 }, { x: 6, y: 2, z: 0 }, wall)).toBe(true);
    expect(segmentHitsBox({ x: 1, y: 2, z: 0 }, { x: 3, y: 2, z: 0 }, wall)).toBe(false);
    // 표본을 찍었다면 놓쳤을 얇은 벽
    const paper = box(3.999, -1, 4.001, 5);
    expect(segmentHitsBox({ x: 0, y: 2, z: 0 }, { x: 8, y: 2, z: 0 }, paper)).toBe(true);
  });

  it('상자를 스치듯 지나가는 선분은 뚫은 것이 아니다', () => {
    const wall = box(3.5, 0, 4.5, 4);
    // y = 4 는 상자의 경계선 — 안으로 들어가지 않는다
    expect(segmentHitsBox({ x: 0, y: 4, z: 0 }, { x: 8, y: 4, z: 0 }, wall)).toBe(false);
    expect(segmentHitsBox({ x: 0, y: 3.9, z: 0 }, { x: 8, y: 3.9, z: 0 }, wall)).toBe(true);
  });

  it('선분이 상자 안에서 끝나면 뚫은 것이다', () => {
    const wall = box(3.5, 0, 4.5, 4);
    expect(segmentHitsBox({ x: 0, y: 2, z: 0 }, { x: 4, y: 2, z: 0 }, wall)).toBe(true);
    // 상자 앞에서 멈추면 아니다
    expect(segmentHitsBox({ x: 0, y: 2, z: 0 }, { x: 3.4, y: 2, z: 0 }, wall)).toBe(false);
  });
});

describe('격자 변환', () => {
  it('세계 좌표와 칸이 서로를 되짚는다', () => {
    for (const cell of [
      { ix: 0, iy: 0, iz: 0 },
      { ix: 4, iy: 2, iz: 0 },
      { ix: 8, iy: 4, iz: 0 },
    ]) {
      expect(toCell(LAYOUT, cellCenter(LAYOUT, cell))).toEqual(cell);
      expect(parseCellKey(cellKey(cell))).toEqual(cell);
    }
  });

  it('칸의 상자는 칸 크기만 하고 중심에 놓인다', () => {
    const cellShape = cellBox(LAYOUT, { ix: 4, iy: 2, iz: 0 });
    expect(cellShape.min).toEqual({ x: 3.5, y: 1.5, z: -0.5 });
    expect(cellShape.max).toEqual({ x: 4.5, y: 2.5, z: 0.5 });
  });

  it('격자 밖은 담기지 않는다', () => {
    expect(contains(LAYOUT, { ix: 8, iy: 4, iz: 0 })).toBe(true);
    expect(contains(LAYOUT, { ix: 9, iy: 0, iz: 0 })).toBe(false);
    expect(contains(LAYOUT, { ix: -1, iy: 0, iz: 0 })).toBe(false);
  });

  it('잘못된 배치는 거짓이 아니라 거부다', () => {
    const bad = (patch: Partial<SpatialLayout>): SpatialLayout => ({ ...LAYOUT, ...patch });
    const store = buildWorld({ components: COMPONENT_DEFINITIONS, operations: TWO_ROOMS });
    expect(() => SpatialIndex.build(store, bad({ cellSize: 0 }))).toThrow(SpatialRejection);
    expect(() => SpatialIndex.build(store, bad({ size: { x: 0, y: 1, z: 1 } }))).toThrow(SpatialRejection);
    expect(() => SpatialIndex.build(store, bad({ size: { x: 1.5, y: 1, z: 1 } }))).toThrow(SpatialRejection);
  });
});

describe('세계에서 읽는 값', () => {
  const store = buildWorld({ components: COMPONENT_DEFINITIONS, operations: TWO_ROOMS });

  it('위치가 없는 것은 null 이고 빈 좌표가 아니다', () => {
    expect(positionOf(store, 'hunter')).toEqual({ x: 1, y: 2, z: 0 });
    expect(positionOf(store, 'no_such_entity')).toBeNull();
  });

  it('닿는 거리와 능력은 없으면 0 과 빈 목록이다 — 조용히 넉넉해지지 않는다', () => {
    expect(reachOf(store, 'hunter')).toBe(1);
    expect(reachOf(store, 'sealed_relic')).toBe(0);
    expect(capabilitiesOf(store, 'hunter')).toEqual(['grasp', 'walk']);
    expect(capabilitiesOf(store, 'sealed_relic')).toEqual([]);
  });
});

describe('색인과 경로', () => {
  const store = buildWorld({ components: COMPONENT_DEFINITIONS, operations: TWO_ROOMS });
  const index = SpatialIndex.build(store, LAYOUT);

  it('벽이 걸친 칸은 모두 막힌다 — 중심이 놓인 칸만이 아니다', () => {
    for (let iy = 0; iy <= 4; iy += 1) {
      expect(index.isBlocked({ ix: 4, iy, iz: 0 }), `(4,${iy})`).toBe(true);
    }
    expect(index.blockersAt({ ix: 4, iy: 0, iz: 0 })).toEqual(['stone_wall_south']);
    expect(index.blockersAt({ ix: 4, iy: 2, iz: 0 })).toEqual(['oak_door']);
  });

  it('격자 밖은 통과할 수 없다', () => {
    expect(index.isBlocked({ ix: 9, iy: 0, iz: 0 })).toBe(true);
  });

  it('같은 칸이 출발이자 도착이면 0 걸음이다', () => {
    const report = findPath(index, { ix: 1, iy: 2, iz: 0 }, { goals: [{ ix: 1, iy: 2, iz: 0 }] });
    expect(report.found).toBe(true);
    expect(report.cost).toBe(0);
    expect(report.cells).toEqual([{ ix: 1, iy: 2, iz: 0 }]);
  });

  it('길이 막히면 무엇이 막았는지 이름이 남는다', () => {
    const report = findPath(index, { ix: 1, iy: 2, iz: 0 }, { goals: [{ ix: 6, iy: 2, iz: 0 }] });
    expect(report.found).toBe(false);
    expect(report.cells).toEqual([]);
    expect(report.cost).toBe(0);
    expect(report.blockedBy).toEqual(['oak_door', 'stone_wall_north', 'stone_wall_south']);
  });

  it('도착 칸이 없거나 격자 밖이면 길이 아니라 거절이다', () => {
    expect(findPath(index, { ix: 1, iy: 2, iz: 0 }, { goals: [] }).found).toBe(false);
    expect(findPath(index, { ix: 1, iy: 2, iz: 0 }, { goals: [{ ix: 99, iy: 0, iz: 0 }] }).found).toBe(false);
    expect(findPath(index, { ix: 99, iy: 0, iz: 0 }, { goals: [{ ix: 1, iy: 2, iz: 0 }] }).reason).toContain('격자 밖');
  });

  it('막힌 칸에서 출발하는 것은 허락을 받아야 한다', () => {
    const onTheDoor = { ix: 4, iy: 2, iz: 0 };
    expect(findPath(index, onTheDoor, { goals: [{ ix: 1, iy: 2, iz: 0 }] }).found).toBe(false);
    expect(
      findPath(index, onTheDoor, { goals: [{ ix: 1, iy: 2, iz: 0 }], allowBlockedStart: true }).found,
    ).toBe(true);
  });

  it('색인과 전수 조회는 같은 답을 낸다', () => {
    const center = { x: 1, y: 2, z: 0 };
    for (const radius of [0, 0.5, 1, 1.5, 3, 7, 40]) {
      expect(index.within(store, center, radius).matched, `반경 ${radius}`).toEqual(
        SpatialIndex.withinByFullScan(store, center, radius),
      );
    }
  });

  it('음수 반경은 아무것도 찾지 않는다', () => {
    expect(index.within(store, { x: 1, y: 2, z: 0 }, -1).matched).toEqual([]);
    expect(SpatialIndex.withinByFullScan(store, { x: 1, y: 2, z: 0 }, -1)).toEqual([]);
  });
});
