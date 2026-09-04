// World Semantic — Terrain (C006 ADDED)
//
// 세계가 처음으로 땅을 든다. Region 의 Description 을 규칙 표(content/regions/terrain-rules)로
// 컴파일한 결과이며, 세계 규칙이 자리로 묻는 세 가지 — 통행 가능한가 · 막혔다면 왜 · 그 자리에
// 걸린 조건이 무엇인가 — 를 답한다.
//
// **세계 State 가 아니다.** 저장되지 않고 스냅샷에도 실리지 않는다 — 컴파일은 순수하므로
// 같은 Description 은 언제나 같은 격자를 준다. 되살린 세계도 같은 데이터에서 같은 땅을 다시
// 만든다 (C006 spec SPEC-010). semantic/region.ts 가 REGION_SPECS 를 다루는 방식과 같은 성격의
// 유도된 사실이다.
//
// 방마다 한 번만 컴파일해 들고 있는다 (아래 캐시). Description 을 모르는 id 는 땅이 없다 —
// null 이고, 그런 방에서는 이동이 C005 까지와 똑같이 extent 만으로 판정된다 (SPEC-009).

import { compileRegion } from '../../../engine/world-authoring/compile';
import type { CompiledWorldTerrain } from '../../../engine/world-authoring/compiled';
import {
  blockedReasonAt,
  isTraversableAt,
  tagsAt,
} from '../../../engine/world-authoring/query';
import {
  BLOCK_STEEP,
  BLOCK_WATER,
  COMPILE_RULES,
  CONDITION_PREFIX,
  SETTLEMENT_LAYER,
  regionSpec,
} from '../../regions';
import type { WorldPosition } from './position';

/** 이 세계의 표(BLOCK_RULES)가 적어 둔 사유는 둘뿐이다 — 기반은 불투명 문자열로만 돌려준다 */
export type TerrainBlockReason = typeof BLOCK_STEEP | typeof BLOCK_WATER;

// 방 하나당 컴파일 한 번. 값이 null 이면 "Description 을 모르는 id" 이고, 그것도 답이므로
// 함께 담는다 (모르는 id 를 물을 때마다 regionSpec 을 다시 훑지 않게).
const COMPILED = new Map<string, CompiledWorldTerrain | null>();

/**
 * RULE-TERRAIN-COMPILE-001 — 세계가 그 방의 땅을 든다.
 *
 * 세계가 서거나 되살아난 뒤 처음 물을 때 컴파일하고, 그 뒤로는 같은 격자를 돌려준다.
 * 컴파일이 순수하므로 언제 만들든 결과는 같다 (SPEC-006 경계 · 결정론).
 */
export function regionTerrain(regionId: string): CompiledWorldTerrain | null {
  const cached = COMPILED.get(regionId);
  if (cached !== undefined) return cached;
  const spec = regionSpec(regionId);
  const terrain = spec ? compileRegion(spec.space, COMPILE_RULES).world : null;
  COMPILED.set(regionId, terrain);
  return terrain;
}

/**
 * 그 자리에 몸을 둘 수 있는가 — 땅이 없는 방은 언제나 참이다 (땅이 없는 것은 막는 것이 아니다).
 * RULE-MOVE-001 의 새 전제가 이것을 읽는다.
 */
export function isTraversable(regionId: string, position: WorldPosition): boolean {
  const terrain = regionTerrain(regionId);
  if (!terrain) return true;
  return isTraversableAt(terrain, position.x, position.z);
}

/** 막혔다면 그 사유, 아니면 null. 사유의 문구는 View 의 것이고 여기 있는 것은 코드다 */
export function blockedReason(regionId: string, position: WorldPosition): TerrainBlockReason | null {
  const terrain = regionTerrain(regionId);
  if (!terrain) return null;
  return blockedReasonAt(terrain, position.x, position.z) as TerrainBlockReason | null;
}

/**
 * RULE-SAFEBY-001 — 그 자리에 걸린 "왜 여기가 안전한가" 의 코드들.
 *
 * settlement layer 의 area 가운데 condition 접두사가 붙은 것만 고른다 — 같은 layer 의 도시는
 * 사람이 사는 자리이지 안전의 사유가 아니다. 겹치면 전부 낸다(하나로 줄이지 않는다) 그리고
 * 순서는 ops 순서 그대로다 (SPEC-007 경계 · 결정론).
 */
export function conditionTagsAt(regionId: string, position: WorldPosition): string[] {
  const terrain = regionTerrain(regionId);
  if (!terrain) return [];
  return tagsAt(terrain, position.x, position.z, SETTLEMENT_LAYER).filter((tag) =>
    tag.startsWith(CONDITION_PREFIX),
  );
}
