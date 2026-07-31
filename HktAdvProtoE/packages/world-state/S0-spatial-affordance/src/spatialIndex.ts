import type { EntityId, EntityStore } from '@hkt/k0-entity-state';
import { blockersInBox } from './collision.js';
import {
  assertLayout,
  boxOf,
  cellBox,
  cellKey,
  contains,
  distance,
  placedEntities,
  positionOf,
  toCell,
} from './transform.js';
import { POSITION_COMPONENT, type Cell, type RangeReport, type SpatialLayout, type Vec3 } from './types.js';

/**
 * Spatial Index — S0 이 소유하는 파생 상태.
 *
 * 세계의 진실은 K0 에 있고 이 색인은 **다시 계산할 수 있는 사본**이다. 그래서 저장하지 않고 매번
 * 세계에서 짓는다. K1 의 질의 계획과 같은 규율을 둔다 — 색인으로 좁힌 답은 전수 조회의 답과
 * **반드시 같아야 한다.** 다르면 그것은 최적화가 아니라 버그다.
 */
export class SpatialIndex {
  readonly layout: SpatialLayout;
  /** 칸 → 그 칸에 중심이 놓인 실체들 (id 오름차순) */
  readonly #buckets: ReadonlyMap<string, readonly EntityId[]>;
  /** 격자 밖에 있는 실체 (id 오름차순). 좁히기에서 빠지면 안 되므로 따로 들고 있는다. */
  readonly #outside: readonly EntityId[];
  /** 통과할 수 없는 칸 → 막은 실체들 (id 오름차순) */
  readonly #blocked: ReadonlyMap<string, readonly EntityId[]>;
  readonly total: number;

  private constructor(
    layout: SpatialLayout,
    buckets: ReadonlyMap<string, readonly EntityId[]>,
    outside: readonly EntityId[],
    blocked: ReadonlyMap<string, readonly EntityId[]>,
    total: number,
  ) {
    this.layout = layout;
    this.#buckets = buckets;
    this.#outside = outside;
    this.#blocked = blocked;
    this.total = total;
  }

  /** 세계에서 색인을 짓는다. 세계는 한 글자도 바뀌지 않는다. */
  static build(store: EntityStore, layout: SpatialLayout): SpatialIndex {
    assertLayout(layout);

    const buckets = new Map<string, EntityId[]>();
    const outside: EntityId[] = [];
    for (const entity of placedEntities(store)) {
      const point = positionOf(store, entity.id);
      if (!point) continue;
      const cell = toCell(layout, point);
      if (!contains(layout, cell)) {
        outside.push(entity.id);
        continue;
      }
      const key = cellKey(cell);
      const bucket = buckets.get(key);
      if (bucket) bucket.push(entity.id);
      else buckets.set(key, [entity.id]);
    }
    for (const bucket of buckets.values()) bucket.sort();

    // 막힌 칸은 장애물의 상자와 칸의 상자가 실제로 겹치는지로 정한다 —
    // 중심이 어느 칸에 있느냐로 정하면 두 칸에 걸친 벽의 한쪽이 뚫린다.
    const blocked = new Map<string, EntityId[]>();
    for (const cell of allCells(layout)) {
      const blockers = blockersInBox(store, cellBox(layout, cell), 'passage');
      if (blockers.length > 0) blocked.set(cellKey(cell), blockers);
    }

    return new SpatialIndex(layout, buckets, outside, blocked, store.withComponent(POSITION_COMPONENT).length);
  }

  /** 그 칸에 중심이 놓인 실체들. */
  at(cell: Cell): readonly EntityId[] {
    return this.#buckets.get(cellKey(cell)) ?? [];
  }

  /** 통과할 수 없는 칸인가. 격자 밖도 통과할 수 없다. */
  isBlocked(cell: Cell): boolean {
    return !contains(this.layout, cell) || this.#blocked.has(cellKey(cell));
  }

  /** 그 칸을 막은 실체들 (오름차순). 막히지 않았으면 빈 배열이다. */
  blockersAt(cell: Cell): readonly EntityId[] {
    return this.#blocked.get(cellKey(cell)) ?? [];
  }

  /** 격자 밖에 있는 실체들 — 반경 질의에서 빠뜨리지 않기 위해 드러내 둔다. */
  outsideGrid(): readonly EntityId[] {
    return this.#outside;
  }

  /**
   * 중심에서 반경 안에 있는 실체들 (id 오름차순).
   *
   * 색인으로 훑을 칸을 좁힌다. 반경이 격자보다 크면 좁히는 의미가 없으므로 전수로 간다 —
   * "좁혔다"는 사실을 이유(`reason`)에 남겨, 답이 이상할 때 계획부터 의심할 수 있게 한다.
   */
  within(store: EntityStore, center: Vec3, radius: number): RangeReport {
    if (!Number.isFinite(radius) || radius < 0) {
      return { matched: [], cellsScanned: 0, scanned: 0, total: this.total, reason: '반경이 음수이거나 무한하다' };
    }

    const span = Math.ceil(radius / this.layout.cellSize);
    const middle = toCell(this.layout, center);
    const candidates: EntityId[] = [...this.#outside];
    let cellsScanned = 0;

    for (let ix = middle.ix - span; ix <= middle.ix + span; ix += 1) {
      for (let iy = middle.iy - span; iy <= middle.iy + span; iy += 1) {
        for (let iz = middle.iz - span; iz <= middle.iz + span; iz += 1) {
          const cell = { ix, iy, iz };
          if (!contains(this.layout, cell)) continue;
          cellsScanned += 1;
          candidates.push(...this.at(cell));
        }
      }
    }

    const matched = [...new Set(candidates)]
      .filter((id) => withinRadius(store, id, center, radius))
      .sort();

    return {
      matched,
      cellsScanned,
      scanned: candidates.length,
      total: this.total,
      reason: `반경 ${radius}m → 칸 ${cellsScanned}개 · 격자 밖 ${this.#outside.length}개를 함께 본다`,
    };
  }

  /** 색인을 쓰지 않고 세계 전체를 훑은 답. `within` 과 반드시 같아야 한다. */
  static withinByFullScan(store: EntityStore, center: Vec3, radius: number): EntityId[] {
    if (!Number.isFinite(radius) || radius < 0) return [];
    return placedEntities(store)
      .map((entity) => entity.id)
      .filter((id) => withinRadius(store, id, center, radius))
      .sort();
  }
}

/**
 * 반경 안인가 — 실체의 **상자**까지의 거리로 잰다.
 *
 * 중심 사이의 거리로 재면 길이 10m 인 벽이 "반경 3m 안에 없다"가 되어, 코앞의 벽을 못 보는
 * 주체가 생긴다. 크기가 없는 실체는 상자가 점이므로 중심 거리와 같은 값이 나온다.
 */
function withinRadius(store: EntityStore, id: EntityId, center: Vec3, radius: number): boolean {
  const box = boxOf(store, id);
  if (!box) return false;
  const nearest = {
    x: Math.min(Math.max(center.x, box.min.x), box.max.x),
    y: Math.min(Math.max(center.y, box.min.y), box.max.y),
    z: Math.min(Math.max(center.z, box.min.z), box.max.z),
  };
  return distance(center, nearest) <= radius;
}

/** 격자의 모든 칸 — 언제나 같은 순서(ix → iy → iz)로 돈다. */
export function* allCells(layout: SpatialLayout): Generator<Cell> {
  for (let ix = 0; ix < layout.size.x; ix += 1) {
    for (let iy = 0; iy < layout.size.y; iy += 1) {
      for (let iz = 0; iz < layout.size.z; iz += 1) {
        yield { ix, iy, iz };
      }
    }
  }
}
