import type { EntityId } from '@hkt/k0-entity-state';
import type { SpatialIndex } from './spatialIndex.js';
import { cellKey, contains, parseCellKey, sameCell } from './transform.js';
import type { Cell, PathReport, SpatialLayout } from './types.js';

/**
 * Movement — 격자 위의 최단 경로.
 *
 * ## 왜 6방향인가
 *
 * 대각선을 허용하면 두 벽이 만나는 모서리를 **사선으로 빠져나간다.** 그것을 막으려면 "양옆이 모두
 * 뚫려 있을 때만 대각선"이라는 예외를 하나 더 두어야 하고, 예외는 언젠가 빠뜨린다. 축 정렬 여섯
 * 방향만 쓰면 "막힌 칸에 들어가지 않는다" 한 줄이 모서리 통과까지 함께 막는다.
 *
 * ## 왜 결정적인가
 *
 * 같은 비용의 칸이 여럿일 때 어느 것을 먼저 펼치느냐가 결과 경로를 바꾼다. 그래서 대기열에서
 * 꺼낼 때 **비용 → ix → iy → iz** 순서로 못을 박았다. `Map` 의 삽입 순서 같은 우연에 기대지 않는다(GI-12).
 */

/** 이웃 여섯 방향 — 언제나 이 순서다. */
const STEPS: readonly Cell[] = [
  { ix: -1, iy: 0, iz: 0 },
  { ix: 1, iy: 0, iz: 0 },
  { ix: 0, iy: -1, iz: 0 },
  { ix: 0, iy: 1, iz: 0 },
  { ix: 0, iy: 0, iz: -1 },
  { ix: 0, iy: 0, iz: 1 },
];

export interface PathOptions {
  /** 도착으로 인정할 칸들. 비어 있으면 길이 없다. */
  goals: readonly Cell[];
  /**
   * 출발 칸이 막혀 있어도 출발은 허용한다.
   * 큰 물체 옆에 붙어 선 주체는 자기 칸이 이미 벽의 상자와 겹칠 수 있기 때문이다.
   */
  allowBlockedStart?: boolean;
}

/**
 * 출발 칸에서 도착 칸들 중 가장 가까운 곳까지의 길.
 *
 * 모든 걸음의 비용이 같으므로 너비 우선이 곧 최단이다. 우선순위 대기열의 비교 규칙을 따로 두는
 * 대신 **비용이 같은 것끼리 좌표로 정렬**해, 같은 세계면 언제나 같은 길이 나오게 했다.
 */
export function findPath(index: SpatialIndex, from: Cell, options: PathOptions): PathReport {
  const layout: SpatialLayout = index.layout;
  const goals = options.goals.filter((cell) => contains(layout, cell));
  const goalKeys = new Set(goals.map(cellKey));

  const startBlocked = index.isBlocked(from);
  if (!contains(layout, from)) {
    return blocked([], 0, `출발 칸 (${cellKey(from)}) 이 격자 밖이다`);
  }
  if (startBlocked && options.allowBlockedStart !== true) {
    return blocked([...index.blockersAt(from)], 0, `출발 칸 (${cellKey(from)}) 이 막혀 있다`);
  }
  if (goalKeys.size === 0) {
    return blocked([], 0, '격자 안에 도착 칸이 없다');
  }
  if (goalKeys.has(cellKey(from))) {
    return { found: true, cells: [from], cost: 0, expanded: 1, blockedBy: [], reason: '이미 도착 칸에 서 있다' };
  }

  const cameFrom = new Map<string, string | null>([[cellKey(from), null]]);
  let frontier: Cell[] = [from];
  let expanded = 0;
  /** 도달 가능한 영역에 맞닿아 있으면서 막힌 칸들 — 길이 없을 때 "무엇이 막았나"의 답이다. */
  const touchedBlockers = new Set<EntityId>();

  while (frontier.length > 0) {
    // 같은 비용의 칸들을 좌표 순서로 펼친다 — 순서가 결과를 바꾸지 않게.
    const layer = [...frontier].sort(compareCells);
    frontier = [];

    for (const cell of layer) {
      expanded += 1;
      for (const step of STEPS) {
        const next: Cell = { ix: cell.ix + step.ix, iy: cell.iy + step.iy, iz: cell.iz + step.iz };
        if (!contains(layout, next)) continue;
        const key = cellKey(next);
        if (cameFrom.has(key)) continue;
        if (index.isBlocked(next)) {
          for (const blocker of index.blockersAt(next)) touchedBlockers.add(blocker);
          continue;
        }
        cameFrom.set(key, cellKey(cell));
        if (goalKeys.has(key)) {
          const cells = trace(cameFrom, key);
          return {
            found: true,
            cells,
            cost: (cells.length - 1) * layout.cellSize,
            expanded,
            blockedBy: [],
            reason: `${cells.length - 1}걸음 · 칸 ${expanded}개를 펼쳤다`,
          };
        }
        frontier.push(next);
      }
    }
  }

  return blocked(
    [...touchedBlockers].sort(),
    expanded,
    `칸 ${expanded}개를 펼쳤지만 도착 칸에 닿지 못했다`,
  );
}

function blocked(blockedBy: EntityId[], expanded: number, reason: string): PathReport {
  return { found: false, cells: [], cost: 0, expanded, blockedBy, reason };
}

function trace(cameFrom: ReadonlyMap<string, string | null>, goalKey: string): Cell[] {
  const path: Cell[] = [];
  let cursor: string | null = goalKey;
  while (cursor !== null && cursor !== undefined) {
    path.push(parseCellKey(cursor));
    cursor = cameFrom.get(cursor) ?? null;
  }
  return path.reverse();
}

function compareCells(a: Cell, b: Cell): number {
  if (a.ix !== b.ix) return a.ix - b.ix;
  if (a.iy !== b.iy) return a.iy - b.iy;
  return a.iz - b.iz;
}

/** 경로가 실제로 이어져 있고 막힌 칸을 밟지 않았는지 — 출력만 보고 다시 확인한다. */
export function auditPath(index: SpatialIndex, path: PathReport): string[] {
  const problems: string[] = [];
  if (!path.found) {
    if (path.cells.length > 0) problems.push('길을 못 찾았다면서 칸이 들어 있다');
    if (path.cost !== 0) problems.push('길을 못 찾았는데 비용이 0 이 아니다');
    return problems;
  }

  const expectedCost = (path.cells.length - 1) * index.layout.cellSize;
  if (Math.abs(path.cost - expectedCost) > 1e-9) {
    problems.push(`비용 ${path.cost} 가 걸음수×칸크기 ${expectedCost} 와 다르다`);
  }

  path.cells.forEach((cell, position) => {
    if (!contains(index.layout, cell)) problems.push(`${cellKey(cell)} 이 격자 밖이다`);
    // 출발 칸은 이미 벽에 붙어 있을 수 있다 — 나머지 칸은 예외 없이 뚫려 있어야 한다.
    if (position > 0 && index.isBlocked(cell)) {
      problems.push(`${cellKey(cell)} 은 ${index.blockersAt(cell).join(', ')} 가 막은 칸이다`);
    }
    if (position === 0) return;
    const previous = path.cells[position - 1] as Cell;
    const gap = Math.abs(previous.ix - cell.ix) + Math.abs(previous.iy - cell.iy) + Math.abs(previous.iz - cell.iz);
    if (gap !== 1) problems.push(`${cellKey(previous)} → ${cellKey(cell)} 은 한 걸음이 아니다`);
  });

  if (path.cells.some((cell, position) => path.cells.findIndex((other) => sameCell(other, cell)) !== position)) {
    problems.push('같은 칸을 두 번 지난다');
  }

  return problems;
}
