// Place Reading — 지목한 **자리 하나**의 사실을 모은다 (C026 ADDED · spec R2).
//
// 세계에 아무것도 묻지 않는다 (SPEC-006 — 패킷도 왕복도 0). 사실은 두 곳에서만 온다.
//   봉투에서            방 id · 깊이 태그 · 규칙을 품은 방의 State (region.state)
//   내 Description 에서  표면 · 통행 · 막힌 사유 · 그 점에 걸린 area · 통로의 열림
//
// 뒤의 것을 세계도 **같은 함수를 같은 데이터로** 부른다 (content/world/semantic/terrain.ts 와
// engine/world-authoring/query 의 isTraversableAt · blockedReasonAt · tagsAt). 그래서 지목해서
// 얻은 답과 걸어가서 얻은 답이 갈릴 수 없다 (SPEC-002 경계).
//
// 이 파일은 **줄을 만들지 않는다** — 순서도 이름도 색도 target-frame-presentation 의 표가
// 정한다. 여기 있는 것은 "그 자리에 무엇이 참인가" 뿐이다.

import { descriptionHash } from '../../engine/world-authoring/description';
import { blockedReasonAt, isTraversableAt, surfaceAt, tagsAt } from '../../engine/world-authoring/query';
import type { GameViewSnapshot } from '../protocol/gameview';
import { TRACE_LAYER, regionSpec } from '../regions/index';
import { SETTLEMENT_LAYER } from './biome-rules';
import { CELL_LAYER, openPassageTags } from './region-presentation';
import { regionTerrain } from './terrain-presentation';

/** 그 점에 걸린 area — layer 마다 한 묶음이고, 겹치면 **전부** 담는다 (SPEC-003) */
export interface PlaceAreas {
  layer: string;
  tags: string[];
}

/** 통로 하나의 지금 — 열림 · 닫힘 · 모름(null). 모름을 닫힘으로 읽지 않는다 */
export interface PlacePassage {
  tag: string;
  open: boolean | null;
}

/** 땅에서 유도한 사실 — hash 가 어긋나면 이 묶음 자체가 없다 (SPEC-005) */
export interface PlaceGround {
  /** 표면 태그(의미 코드) — 격자 밖이면 없다 */
  surface?: string;
  traversable: boolean;
  /** 막혔다면 그 사유 코드 */
  blockedReason?: string;
  /** 걸린 area 들 — 빈 layer 는 담기지 않는다 */
  areas: PlaceAreas[];
  /** 그 점을 덮는 통로들 — 규칙 없는 방에서는 빈 배열이다 */
  passages: PlacePassage[];
}

export interface PlaceReading {
  /** 어디인가 — 봉투의 region.id */
  regionId: string;
  /** 깊이 태그(의미 코드) — 봉투의 hud region.depth */
  depth?: string;
  /** 세계가 보낸 hash 와 내 Description 의 hash 가 다른가 */
  mismatched: boolean;
  /** 땅이 어떤가 · 무엇이 걸렸나 — 어긋났거나 모르는 방이면 없다 */
  ground?: PlaceGround;
  /**
   * 규칙을 품은 방의 지금 State — **품지 않은 방에는 없다** (C026 SPEC-004 경계).
   *
   * C028 CHANGED — 마지막 재배열의 세계 시각이 함께 실린다 (spec R5). 봉투가 C008 부터
   * 이미 싣고 있던 값이고 여태 2.2초 맥동만 읽고 있었다. **한 번도 재배열되지 않은 방에는
   * 그 값이 없다** — 0 으로 지어내지 않는다 (SPEC-007 경계). 얼마 전인지는 표현이 잰다
   * (압력의 비율을 표현이 재는 것과 같은 규율).
   */
  rule?: {
    pattern: string;
    pressure: number;
    pressureLimit: number;
    rearrangedAt?: number;
  };
}

const DEPTH_HUD_ID = 'region.depth';

/**
 * RULE-PLACE-READING-001 — 자리 하나의 사실 (spec R2).
 *
 * 순서는 이 함수가 정하지 않는다. 지어내지도 않는다 — 모르는 것은 자리째 없다.
 */
export function readPlace(
  snapshot: GameViewSnapshot,
  point: { x: number; z: number },
): PlaceReading {
  const regionId = snapshot.region.id;
  const depth = snapshot.hud.find((h) => h.id === DEPTH_HUD_ID)?.value;
  const state = snapshot.region.state;
  const base: PlaceReading = {
    regionId,
    ...(typeof depth === 'string' ? { depth } : {}),
    mismatched: false,
    // 규칙 State 는 **봉투의 것**이므로 hash 가 어긋나도 그대로 선다 —
    // 어긋난 것은 내 땅이지 세계가 말한 값이 아니다
    ...(state
      ? {
          rule: {
            pattern: state.pattern,
            pressure: state.pressure,
            pressureLimit: state.pressureLimit,
            // 재배열이 한 번도 없었으면 봉투에도 없다 — 없는 채로 둔다 (SPEC-007 경계)
            ...(state.rearrangedAt === undefined ? {} : { rearrangedAt: state.rearrangedAt }),
          },
        }
      : {}),
  };

  const spec = regionSpec(regionId);
  // 모르는 방이면 땅이 없다 — 게임은 돌고 그 줄만 서지 않는다 (C001 부터의 폴백 규칙)
  if (!spec) return base;
  // 세계와 다른 땅을 보고 있다 — 땅에서 유도한 것을 답으로 내놓지 않는다 (SPEC-005)
  if (descriptionHash(spec.space) !== snapshot.region.hash) return { ...base, mismatched: true };

  const compiled = regionTerrain(regionId);
  if (!compiled) return base;
  const world = compiled.world;

  const areas: PlaceAreas[] = [];
  // TRACE_LAYER 가 셋째다 (C011) — 물으면 그 자리의 흙도 답한다. 지면에는 글자가 없으므로
  // (C026 R4) 흔적이 무슨 단계인지는 **물었을 때만** 말이 된다. 겹치면 전부 담긴다 —
  // 여기서 가장 짙은 것 하나로 줄이지 않는다: 줄을 만드는 것은 이 파일의 일이 아니다
  for (const layer of [SETTLEMENT_LAYER, CELL_LAYER, TRACE_LAYER]) {
    const tags = tagsAt(world, point.x, point.z, layer);
    if (tags.length > 0) areas.push({ layer, tags });
  }

  // 통로의 열림 판정은 **region-presentation 의 표 읽기 그대로다** — 두 벌로 만들면
  // 판이 말하는 것과 바닥에 그려진 것이 갈린다 (spec: 같은 규칙이어야 한다)
  const open = spec.rule ? openPassageTags(spec, snapshot.region.state?.pattern) : null;
  const passages: PlacePassage[] = (
    spec.rule ? tagsAt(world, point.x, point.z, spec.rule.passageLayer) : []
  ).map((tag) => ({ tag, open: open === null ? null : open.has(tag) }));

  const surface = surfaceAt(world, point.x, point.z);
  const reason = blockedReasonAt(world, point.x, point.z);
  return {
    ...base,
    ground: {
      ...(surface === null ? {} : { surface }),
      traversable: isTraversableAt(world, point.x, point.z),
      ...(reason === null ? {} : { blockedReason: reason }),
      areas,
      passages,
    },
  };
}

