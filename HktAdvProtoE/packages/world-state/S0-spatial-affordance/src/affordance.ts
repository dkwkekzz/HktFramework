import type { EntityId, EntityStore } from '@hkt/k0-entity-state';
import { evaluate } from '@hkt/k1-predicate-query';
import { blockersOnSegment } from './collision.js';
import { SpatialRejection } from './errors.js';
import { findPath } from './movement.js';
import type { SpatialIndex } from './spatialIndex.js';
import {
  boxDistance,
  boxOf,
  capabilitiesOf,
  cellCenter,
  contains,
  positionOf,
  reachOf,
  toCell,
} from './transform.js';
import {
  ACCESS_ISSUE,
  type AccessRejection,
  type Affordance,
  type AffordanceOffer,
  type Box,
  type Cell,
  type PathReport,
} from './types.js';

/**
 * Affordance — "지금 이 주체가 저것에 무엇을 할 수 있는가".
 *
 * ## 왜 S0 이 이것을 하는가
 *
 * 원문 「10」 S0 의 포함 항목은 `Transform · Spatial Index · Movement · Collision · Affordance` 다.
 * 앞의 넷은 마지막 하나를 위해 있다 — 거리와 충돌을 계산해 놓고 "그래서 집을 수 있는가"에 답하지
 * 않으면, 그 값들을 쓰는 쪽(U·G 페이즈)이 저마다 다른 규칙으로 다시 판정하게 된다.
 *
 * ## 거절은 네 갈래이고, 섞지 않는다
 *
 * ```text
 * 대상이 세계에 없다      E_UNKNOWN_TARGET   (사라진 것)
 * 조건이 어긋난다          E_CONDITION_UNMET  (열린 문은 다시 열 수 없다)
 * 능력이 없다              E_MISSING_CAPABILITY (손이 없으면 못 잡는다)
 * 닿을 수 없다             E_UNREACHABLE      (벽이 막는다)
 * ```
 *
 * 넷을 "불가능" 하나로 뭉치면 다음 행동이 나오지 않는다. **문이 막았다**를 알아야 문을 여는 목적이
 * 생기고, **손이 없다**를 알아야 도구를 찾는 목적이 생긴다(G 페이즈가 이 구분을 먹는다).
 */

export interface ResolveOptions {
  /** 이 동사들만 본다. 비어 있거나 없으면 전부 본다. */
  verbs?: readonly string[];
}

/** 주체 하나에게 지금 열려 있는 행동들 — 계약 순서(affordance 선언 순서)를 지킨다. */
export function resolveAffordances(
  store: EntityStore,
  index: SpatialIndex,
  actorId: EntityId,
  affordances: readonly Affordance[],
  options: ResolveOptions = {},
): AffordanceOffer[] {
  if (!store.has(actorId)) {
    throw new SpatialRejection(ACCESS_ISSUE.UNKNOWN_ACTOR, `actor/${actorId}`, `없는 주체다: ${actorId}`);
  }
  const actorPoint = positionOf(store, actorId);
  if (!actorPoint) {
    throw new SpatialRejection(
      ACCESS_ISSUE.NO_POSITION,
      `entity/${actorId}/components/position`,
      `주체 ${actorId} 가 공간에 없다 — 접근 가능성을 물을 수 없다`,
    );
  }

  const verbs = options.verbs && options.verbs.length > 0 ? new Set(options.verbs) : null;
  return affordances
    .filter((affordance) => verbs === null || verbs.has(affordance.verb))
    .map((affordance) => resolveOne(store, index, actorId, affordance));
}

function resolveOne(
  store: EntityStore,
  index: SpatialIndex,
  actorId: EntityId,
  affordance: Affordance,
): AffordanceOffer {
  assertAffordance(affordance);

  const refusals: AccessRejection[] = [];
  const targetId = affordance.targetEntityId;
  const base: AffordanceOffer = {
    affordanceId: affordance.id,
    verb: affordance.verb,
    targetEntityId: targetId,
    available: false,
    cost: { ...affordance.estimatedCost },
    path: null,
    distance: null,
    visible: false,
    lineBlockers: [],
    refusals,
  };

  if (!store.has(targetId)) {
    refusals.push(refusal(ACCESS_ISSUE.UNKNOWN_TARGET, `entity/${targetId}`, `세계에 없는 대상이다: ${targetId}`));
    return base;
  }
  const targetBox = boxOf(store, targetId);
  if (!targetBox) {
    refusals.push(
      refusal(
        ACCESS_ISSUE.NO_POSITION,
        `entity/${targetId}/components/position`,
        `대상 ${targetId} 가 공간에 없다`,
      ),
    );
    return base;
  }

  // --- 조건 (K1 이 판정한다. 조건식 자체가 잘못되었으면 여기서 예외가 올라간다) ---
  const verdict = evaluate(
    store,
    affordance.condition,
    { actor: actorId, target: targetId },
    `affordance/${affordance.id}/condition`,
  );
  if (!verdict.passed) {
    refusals.push({
      code: ACCESS_ISSUE.CONDITION_UNMET,
      path: `affordance/${affordance.id}/condition`,
      message: `조건이 어긋난다: ${verdict.causes.map((cause) => `${cause.at} — ${cause.reason}`).join(' · ')}`,
      blockedBy: [],
      causes: verdict.causes,
    });
  }

  // --- 능력 ---
  const owned = new Set(capabilitiesOf(store, actorId));
  const missing = [...affordance.requiredCapabilities].filter((name) => !owned.has(name)).sort();
  if (missing.length > 0) {
    refusals.push(
      refusal(
        ACCESS_ISSUE.MISSING_CAPABILITY,
        `affordance/${affordance.id}/requiredCapabilities`,
        `${actorId} 에게 없는 능력이다: ${missing.join(', ')} (가진 것: ${[...owned].sort().join(', ') || '없음'})`,
      ),
    );
  }

  // --- 공간 ---
  const actorBox = boxOf(store, actorId) as Box;
  const actorPoint = positionOf(store, actorId) as { x: number; y: number; z: number };
  const targetPoint = positionOf(store, targetId) as { x: number; y: number; z: number };
  const straight = boxDistance(actorBox, targetBox);
  const lineBlockers = blockersOnSegment(store, actorPoint, targetPoint, 'passage', [actorId, targetId]);
  const visible = blockersOnSegment(store, actorPoint, targetPoint, 'sight', [actorId, targetId]).length === 0;

  const reach = reachOf(store, actorId);
  const search = searchReach(store, index, actorId, targetId, targetBox, reach);
  const path = search.report;
  if (!path.found) {
    const blockedBy = path.blockedBy.length > 0 ? path.blockedBy : lineBlockers;
    refusals.push({
      // 격자 안에 설 자리 자체가 없는 것은 "막혔다"가 아니라 **배치가 세계를 담지 못한다**는 뜻이다.
      code: search.candidates === 0 ? ACCESS_ISSUE.OUTSIDE_GRID : ACCESS_ISSUE.UNREACHABLE,
      path: `entity/${targetId}`,
      message:
        straight <= reach && lineBlockers.length > 0
          ? `거리 ${round(straight)}m 는 손이 닿지만 ${lineBlockers.join(', ')} 가 사이를 막는다`
          : `닿는 자리까지 길이 없다 — ${path.reason}${blockedBy.length > 0 ? ` (막은 것: ${blockedBy.join(', ')})` : ''}`,
      blockedBy,
      causes: [],
    });
  }

  const cost = { ...affordance.estimatedCost };
  if (path.found && path.cost > 0) {
    cost['movement'] = (cost['movement'] ?? 0) + path.cost;
  }

  return {
    ...base,
    available: refusals.length === 0,
    cost,
    path,
    distance: straight,
    visible,
    lineBlockers,
  };
}

/** 손이 닿는 자리를 찾은 결과. 길이 없을 때 **왜 없는지**를 가르기 위해 후보 수까지 함께 돌려준다. */
export interface ReachSearch {
  report: PathReport;
  /** 격자 안에서 대상에 손이 닿을 만한 자리 수 (막혔는지와 무관하게 센다) */
  candidates: number;
  /** 그 자리들을 쓸 수 없게 만든 실체들 (오름차순) */
  denied: EntityId[];
}

/**
 * 대상에 손이 닿는 자리까지의 길.
 *
 * 도착지는 "대상이 있는 칸"이 아니라 **손이 닿는 칸들**이다. 대상 자신이 벽일 수도 있으므로
 * (문을 여는 장면이 그렇다) 대상 칸으로 걸어 들어가는 것을 도착 조건으로 삼을 수 없다.
 *
 * 닿는 자리가 하나도 남지 않는 경우가 있다 — 대상이 사방으로 둘러싸인 때다. 그때 "길이 없다"만
 * 돌려주면 무엇이 막았는지 이름이 사라진다. 그래서 **후보를 지운 실체들을 모아 둔다**(`denied`).
 */
export function searchReach(
  store: EntityStore,
  index: SpatialIndex,
  actorId: EntityId,
  targetId: EntityId,
  targetBox: Box,
  reach: number,
): ReachSearch {
  const layout = index.layout;
  const actorPoint = positionOf(store, actorId);
  if (!actorPoint) {
    return {
      report: { found: false, cells: [], cost: 0, expanded: 0, blockedBy: [], reason: '주체가 공간에 없다' },
      candidates: 0,
      denied: [],
    };
  }
  const from = toCell(layout, actorPoint);

  const goals: Cell[] = [];
  const denied = new Set<EntityId>();
  let candidates = 0;
  const margin = reach + layout.cellSize;
  const low = toCell(layout, { x: targetBox.min.x - margin, y: targetBox.min.y - margin, z: targetBox.min.z - margin });
  const high = toCell(layout, { x: targetBox.max.x + margin, y: targetBox.max.y + margin, z: targetBox.max.z + margin });

  for (let ix = low.ix; ix <= high.ix; ix += 1) {
    for (let iy = low.iy; iy <= high.iy; iy += 1) {
      for (let iz = low.iz; iz <= high.iz; iz += 1) {
        const cell: Cell = { ix, iy, iz };
        if (!contains(layout, cell)) continue;
        const center = cellCenter(layout, cell);
        const stand: Box = { min: center, max: center };
        if (boxDistance(stand, targetBox) > reach) continue;
        candidates += 1;

        // 주체가 이미 서 있는 칸은 막혀 있어도 도착지로 인정한다 — 지금 서 있으니 설 수 있다.
        const standing = cell.ix === from.ix && cell.iy === from.iy && cell.iz === from.iz;
        if (index.isBlocked(cell) && !standing) {
          for (const blocker of index.blockersAt(cell)) denied.add(blocker);
          continue;
        }
        // 그 자리에서 실제로 손이 닿는가 — 대상 자신은 세지 않는다(문을 여는 손은 문을 통과하지 않는다).
        const between = blockersOnSegment(store, center, centerOf(targetBox), 'passage', [actorId, targetId]);
        if (between.length > 0) {
          for (const blocker of between) denied.add(blocker);
          continue;
        }
        goals.push(cell);
      }
    }
  }

  if (goals.length === 0) {
    return {
      report: {
        found: false,
        cells: [],
        cost: 0,
        expanded: 0,
        blockedBy: [...denied].sort(),
        reason:
          candidates === 0
            ? `대상 ${targetId} 에 손이 닿을 만한 자리가 격자 안에 없다 (닿는 거리 ${reach}m)`
            : `대상 ${targetId} 에 손이 닿는 자리 ${candidates}곳이 모두 막혀 있다`,
      },
      candidates,
      denied: [...denied].sort(),
    };
  }

  return { report: findPath(index, from, { goals, allowBlockedStart: true }), candidates, denied: [...denied].sort() };
}

/** 길만 필요할 때 쓰는 얇은 겉껍질. */
export function pathToReach(
  store: EntityStore,
  index: SpatialIndex,
  actorId: EntityId,
  targetId: EntityId,
  targetBox: Box,
  reach: number,
): PathReport {
  return searchReach(store, index, actorId, targetId, targetBox, reach).report;
}

function centerOf(box: Box): { x: number; y: number; z: number } {
  return {
    x: (box.min.x + box.max.x) / 2,
    y: (box.min.y + box.max.y) / 2,
    z: (box.min.z + box.max.z) / 2,
  };
}

function refusal(
  code: AccessRejection['code'],
  path: string,
  message: string,
  blockedBy: EntityId[] = [],
): AccessRejection {
  return { code, path, message, blockedBy, causes: [] };
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}

/** 계약이 요구하는 칸이 비어 있으면 거부한다 — 조건도 비용도 없는 행동은 "무엇이든 공짜"가 된다(GI-06). */
export function assertAffordance(affordance: Affordance): void {
  const at = `affordance/${String(affordance.id)}`;
  if (typeof affordance.id !== 'string' || affordance.id === '') {
    throw new SpatialRejection(ACCESS_ISSUE.BAD_AFFORDANCE, at, 'affordance 에 id 가 없다');
  }
  if (typeof affordance.verb !== 'string' || affordance.verb === '') {
    throw new SpatialRejection(ACCESS_ISSUE.BAD_AFFORDANCE, `${at}/verb`, 'affordance 에 verb 가 없다');
  }
  if (typeof affordance.targetEntityId !== 'string' || affordance.targetEntityId === '') {
    throw new SpatialRejection(ACCESS_ISSUE.BAD_AFFORDANCE, `${at}/targetEntityId`, 'affordance 에 대상이 없다');
  }
  if (affordance.condition === null || typeof affordance.condition !== 'object') {
    throw new SpatialRejection(ACCESS_ISSUE.BAD_AFFORDANCE, `${at}/condition`, 'affordance 에 조건식이 없다');
  }
  if (!Array.isArray(affordance.requiredCapabilities)) {
    throw new SpatialRejection(
      ACCESS_ISSUE.BAD_AFFORDANCE,
      `${at}/requiredCapabilities`,
      'requiredCapabilities 는 배열이어야 한다 (없으면 빈 배열)',
    );
  }
  const cost = affordance.estimatedCost;
  if (cost === null || typeof cost !== 'object' || Array.isArray(cost) || Object.keys(cost).length === 0) {
    throw new SpatialRejection(
      ACCESS_ISSUE.BAD_AFFORDANCE,
      `${at}/estimatedCost`,
      '비용이 하나도 없는 행동은 둘 수 없다 — 강력한 효과에는 비용·조건·노출·위험 중 하나 이상이 있어야 한다(GI-06)',
    );
  }
  for (const [key, value] of Object.entries(cost)) {
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
      throw new SpatialRejection(
        ACCESS_ISSUE.BAD_AFFORDANCE,
        `${at}/estimatedCost/${key}`,
        `비용은 0 이상의 유한한 수여야 한다: ${JSON.stringify(value)}`,
      );
    }
  }
}
