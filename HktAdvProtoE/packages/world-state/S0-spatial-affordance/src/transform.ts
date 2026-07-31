import type { EntityId, EntityState, EntityStore, JsonObject } from '@hkt/k0-entity-state';
import { SpatialRejection } from './errors.js';
import {
  ACCESS_ISSUE,
  BARRIER_COMPONENT,
  CAPABILITY_COMPONENT,
  EXTENT_COMPONENT,
  POSITION_COMPONENT,
  REACH_COMPONENT,
  type Barrier,
  type Box,
  type Cell,
  type SpatialLayout,
  type Vec3,
} from './types.js';

/**
 * Transform — 세계에서 좌표를 읽는 유일한 자리.
 *
 * S0 은 자기 좌표를 들고 있지 않는다. 위치는 K0 의 `position` 컴포넌트에만 있고, 여기서는 그것을
 * 읽기만 한다. 그래야 "화면이 옮긴 위치"와 "세계가 아는 위치"가 갈라지지 않는다(원본 18.4).
 */

export function readVec3(data: JsonObject | null, at: string): Vec3 | null {
  if (!data) return null;
  const x = data['x'];
  const y = data['y'];
  const z = data['z'];
  if (typeof x !== 'number' || typeof y !== 'number' || typeof z !== 'number') return null;
  if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) {
    throw new SpatialRejection(ACCESS_ISSUE.NO_POSITION, at, `좌표가 유한한 수가 아니다: ${JSON.stringify(data)}`);
  }
  return { x, y, z };
}

/** 실체의 위치. `position` 컴포넌트가 없으면 `null` — 공간에 없는 것도 세계의 사실이다. */
export function positionOf(store: EntityStore, id: EntityId): Vec3 | null {
  return readVec3(store.component(id, POSITION_COMPONENT), `entity/${id}/components/${POSITION_COMPONENT}`);
}

/** 실체의 반-크기. 없으면 점(0,0,0)이다. */
export function extentOf(store: EntityStore, id: EntityId): Vec3 {
  const extent = readVec3(store.component(id, EXTENT_COMPONENT), `entity/${id}/components/${EXTENT_COMPONENT}`);
  if (!extent) return { x: 0, y: 0, z: 0 };
  return { x: Math.abs(extent.x), y: Math.abs(extent.y), z: Math.abs(extent.z) };
}

/** 실체가 차지하는 상자. 위치가 없으면 `null`. */
export function boxOf(store: EntityStore, id: EntityId): Box | null {
  const center = positionOf(store, id);
  if (!center) return null;
  const half = extentOf(store, id);
  return {
    min: { x: center.x - half.x, y: center.y - half.y, z: center.z - half.z },
    max: { x: center.x + half.x, y: center.y + half.y, z: center.z + half.z },
  };
}

/** 실체의 장애물 선언. `barrier` 컴포넌트가 없으면 아무것도 막지 않는다. */
export function barrierOf(store: EntityStore, id: EntityId): Barrier | null {
  const data = store.component(id, BARRIER_COMPONENT);
  if (!data) return null;
  const solid = data['solid'];
  const opaque = data['opaque'];
  if (typeof solid !== 'boolean' || typeof opaque !== 'boolean') {
    throw new SpatialRejection(
      ACCESS_ISSUE.BAD_LAYOUT,
      `entity/${id}/components/${BARRIER_COMPONENT}`,
      `barrier 는 solid·opaque 를 참·거짓으로 가져야 한다: ${JSON.stringify(data)}`,
    );
  }
  return { solid, opaque };
}

/** 주체가 가진 능력 이름 (오름차순·중복 없음). 컴포넌트가 없으면 빈 목록이다. */
export function capabilitiesOf(store: EntityStore, id: EntityId): string[] {
  const data = store.component(id, CAPABILITY_COMPONENT);
  const names = data?.['names'];
  if (!Array.isArray(names)) return [];
  return [...new Set(names.filter((name): name is string => typeof name === 'string'))].sort();
}

/** 주체가 제자리에서 닿는 거리. 컴포넌트가 없으면 0 — 닿으려면 붙어야 한다. */
export function reachOf(store: EntityStore, id: EntityId): number {
  const data = store.component(id, REACH_COMPONENT);
  const max = data?.['max'];
  return typeof max === 'number' && Number.isFinite(max) && max >= 0 ? max : 0;
}

export function distance(a: Vec3, b: Vec3): number {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
}

/** 두 상자 사이의 최단 거리. 겹치면 0 이다. 큰 물체의 표면까지 재려면 이 값이 필요하다. */
export function boxDistance(a: Box, b: Box): number {
  const gap = (aMin: number, aMax: number, bMin: number, bMax: number): number =>
    Math.max(0, aMin - bMax, bMin - aMax);
  return Math.hypot(
    gap(a.min.x, a.max.x, b.min.x, b.max.x),
    gap(a.min.y, a.max.y, b.min.y, b.max.y),
    gap(a.min.z, a.max.z, b.min.z, b.max.z),
  );
}

// ---------------------------------------------------------------------------
// 격자 변환
// ---------------------------------------------------------------------------

export function assertLayout(layout: SpatialLayout): void {
  if (!Number.isFinite(layout.cellSize) || layout.cellSize <= 0) {
    throw new SpatialRejection(
      ACCESS_ISSUE.BAD_LAYOUT,
      'layout/cellSize',
      `칸 크기는 0 보다 큰 유한한 수여야 한다: ${layout.cellSize}`,
    );
  }
  for (const axis of ['x', 'y', 'z'] as const) {
    const count = layout.size[axis];
    if (!Number.isInteger(count) || count < 1) {
      throw new SpatialRejection(
        ACCESS_ISSUE.BAD_LAYOUT,
        `layout/size/${axis}`,
        `칸 수는 1 이상의 정수여야 한다: ${count}`,
      );
    }
  }
}

/** 세계 좌표 → 칸. 격자 밖이어도 계산은 하고, 담기는지는 `contains` 가 본다. */
export function toCell(layout: SpatialLayout, point: Vec3): Cell {
  const axis = (value: number, origin: number): number =>
    Math.round((value - origin) / layout.cellSize);
  return {
    ix: axis(point.x, layout.origin.x),
    iy: axis(point.y, layout.origin.y),
    iz: axis(point.z, layout.origin.z),
  };
}

/** 칸 → 그 칸의 중심 좌표. */
export function cellCenter(layout: SpatialLayout, cell: Cell): Vec3 {
  return {
    x: layout.origin.x + cell.ix * layout.cellSize,
    y: layout.origin.y + cell.iy * layout.cellSize,
    z: layout.origin.z + cell.iz * layout.cellSize,
  };
}

/** 칸이 차지하는 상자. */
export function cellBox(layout: SpatialLayout, cell: Cell): Box {
  const center = cellCenter(layout, cell);
  const half = layout.cellSize / 2;
  return {
    min: { x: center.x - half, y: center.y - half, z: center.z - half },
    max: { x: center.x + half, y: center.y + half, z: center.z + half },
  };
}

export function contains(layout: SpatialLayout, cell: Cell): boolean {
  return (
    cell.ix >= 0 &&
    cell.iy >= 0 &&
    cell.iz >= 0 &&
    cell.ix < layout.size.x &&
    cell.iy < layout.size.y &&
    cell.iz < layout.size.z
  );
}

/** 칸의 정규 이름. 집합·지도의 열쇠로 쓴다 — 순서가 흔들리지 않게 고정 폭이 아니라 구분자를 쓴다. */
export function cellKey(cell: Cell): string {
  return `${cell.ix},${cell.iy},${cell.iz}`;
}

export function parseCellKey(key: string): Cell {
  const parts = key.split(',').map((part) => Number(part));
  return { ix: parts[0] as number, iy: parts[1] as number, iz: parts[2] as number };
}

export function sameCell(a: Cell, b: Cell): boolean {
  return a.ix === b.ix && a.iy === b.iy && a.iz === b.iz;
}

/** 위치를 가진 실체만 id 오름차순으로. 공간 판정의 모집단이다. */
export function placedEntities(store: EntityStore): EntityState[] {
  return store
    .withComponent(POSITION_COMPONENT)
    .map((id) => store.require(id))
    .sort((a, b) => (a.id < b.id ? -1 : 1));
}
