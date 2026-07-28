// 개체 검색 (기획서 §21 TargetQuery, §11 TargetSelector 의 Phase 1 부분집합)
// 모든 결과는 id 사전순으로 정렬해 돌려준다 — 순회 순서가 결과를 바꾸지 않게 하는 결정론 규약.
import { distance3d, type EntityState, type EntityType } from "../../shared/state";
import type { TargetQuery } from "./types";
import type { WorldRuntime } from "./WorldRuntime";

export function allEntities(runtime: WorldRuntime): EntityState[] {
  return Object.keys(runtime.state.entities)
    .sort()
    .map((id) => runtime.state.entities[id]!);
}

export function entitiesByType(runtime: WorldRuntime, type: EntityType): EntityState[] {
  return allEntities(runtime).filter((e) => e.type === type);
}

export function entitiesWithTag(runtime: WorldRuntime, tag: string): EntityState[] {
  return allEntities(runtime).filter((e) => e.tags.includes(tag));
}

export function agentEntities(runtime: WorldRuntime): EntityState[] {
  return entitiesByType(runtime, "agent");
}

/** 같은 지역 안에서 반경 이내의 개체 (거리는 3D 유클리드 — Phase-1 §1.4) */
export function entitiesNear(
  runtime: WorldRuntime,
  entityId: string,
  radius: number,
  filter: (entity: EntityState) => boolean,
): EntityState[] {
  const origin = runtime.store.entity(entityId).position;
  if (origin === undefined) return [];
  return allEntities(runtime).filter((candidate) => {
    if (candidate.id === entityId) return false;
    if (candidate.position === undefined) return false;
    if (candidate.position.regionId !== origin.regionId) return false;
    if (distance3d(origin, candidate.position) > radius) return false;
    return filter(candidate);
  });
}

export interface TargetSearchOptions {
  /**
   * 사거리 제한을 무시한다 — "다가가면 가능해지는 대상" 후보 생성용 (§27-5).
   * 지역 경계는 query.crossRegionApproach 가 허용할 때만 함께 무시한다.
   */
  ignoreDistance?: boolean;
}

/** §21 targetQuery 해석 */
export function findTargets(
  runtime: WorldRuntime,
  actorId: string,
  query: TargetQuery,
  options: TargetSearchOptions = {},
): EntityState[] {
  switch (query.kind) {
    case "none":
      return [];
    case "self":
      return [runtime.store.entity(actorId)];
    case "entity_tag": {
      if (query.tag === undefined) return [];
      const actor = runtime.store.entity(actorId);
      // 접근 후보를 만들 때도 지역 경계는 crossRegionApproach 가 허용할 때만 넘는다
      const sameRegionRequired =
        query.sameRegion === true && !(options.ignoreDistance === true && query.crossRegionApproach === true);
      return entitiesWithTag(runtime, query.tag).filter((candidate) => {
        if (query.excludeSelf === true && candidate.id === actorId) return false;
        if (candidate.position === undefined) return false;
        if (actor.position === undefined) return false;
        if (sameRegionRequired && candidate.position.regionId !== actor.position.regionId) {
          return false;
        }
        const limit =
          options.ignoreDistance === true ? query.approachMaxDistance : query.maxDistance;
        if (limit !== undefined) {
          if (candidate.position.regionId !== actor.position.regionId) return false;
          if (distance3d(actor.position, candidate.position) > limit) return false;
        }
        return true;
      });
    }
  }
}
