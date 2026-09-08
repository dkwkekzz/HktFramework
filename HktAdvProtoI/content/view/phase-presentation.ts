// Phase Presentation — 방의 **지금 위상**을 땅에 그린다 (RoomNeverSame 실주행 판정 ADDED).
//
// Human 의 답: "밤낮은 보였는데 다른 변화는 모르겠다 — 확인해 볼 단서 자체가 없다." 철 · 소란 ·
// 지나가는 것 · 늘 서 있는 것 · 깨진 마디가 거는 덧씌움(C016~C021)은 여태 **판에서만** 읽혔다 —
// 그 자락에 서서 물어야 "위험 · 깊이" 한 줄이 섰다. 이제 그 자락이 땅에 선다: 위험은 붉은 띠,
// 깊어진 자락은 그 깊이의 색이다. 철이 바뀌면 방의 어느 자리가 달라졌는지가 걸어 보기 전에 읽힌다.
//
// **세계는 이것을 싣지 않는다.** 관찰자가 자기 content/regions 의 phases 와 봉투의 값
// 넷(clock.season · region.disturbance.phase · presences · 원천의 collapsedSites)으로 스스로
// 얻는다 — 땅 · 흔적 · 붕괴 · 통로를 스스로 얻는 C005~C013 의 규율 그대로다. 걸리는 차례도
// 세계의 것과 같다 (상시 → 철 → 깨어남 → 지나는 것 → 깨진 마디 · region-phase.ts). 그래서
// 판이 말하는 "걸린 것" 과 땅에 그려진 띠가 같은 데이터에서 나온다.
//
// **이름표는 없다** (C026 R4 — RULE-QUIET-GROUND-001). 무엇이 위험한지는 물었을 때 판이 답한다.

import type { SceneGroundZone } from '../../engine/view-kernel/scene/scene-state';
import { areasOf } from '../../engine/world-authoring/description';
import type { GameViewSnapshot, WorldClockView } from '../protocol/gameview';
import {
  DEPTH_LAYER,
  HAZARD_LAYER,
  PRESENCE_ROUTES,
  regionSpec,
  type HazardOverlay,
  type RegionPhase,
} from '../regions/index';
import { codeText } from './code-text';
import { depthPresentation } from './region-presentation';

/** 원천의 Semantic Role — 봉투에서 원천을 가려내는 값 (resource-reading 과 같다) */
const SOURCE_ROLE = 'resource-source';

/**
 * 위험 자락의 색 — **붉다.** 이 세계에서 붉은 것은 광석과 흙의 흔적뿐이고 둘 다 갈색 쪽으로
 * 눕힌 값이라(0x6b3524 · 0xf2684a), 여기는 채도를 올린 선홍으로 갈라 "여기가 지금 위험하다"
 * 가 흙의 붉음과 섞이지 않게 한다. 채움을 옅게 두는 것은 그 위에 선 원천과 몸을 덮지 않기
 * 위해서이고, 테두리를 굵게 세우는 것은 자락의 **경계**가 곧 "여기부터" 이기 때문이다.
 */
export const HAZARD_ZONE = {
  fill: 0xd63a3a,
  fillOpacity: 0.16,
  edge: 0xff5c5c,
  edgeOpacity: 0.85,
  edgeWidth: 0.9,
} as const;

/**
 * 깊어진 자락의 채움 짙기 — 방 바닥(0.3 안팎)보다 조금 진하다. 방 바닥 위에 **그 깊이의 색**을
 * 한 겹 더 얹는 것이므로, 방보다 한 단계 깊은 색이 그 자락에서만 이긴다.
 */
export const DEPTH_OVERLAY_FILL_OPACITY = 0.42;
export const DEPTH_OVERLAY_EDGE_WIDTH = 0.8;

/**
 * RULE-PHASE-ZONES-001 — 지금 걸린 덧씌움들을 땅의 구역으로.
 *
 * 걸리는 차례는 세계의 것 그대로다 (region-phase.ts activePhasesAt): 상시 → 철 → 깨어남 →
 * 지나는 것 → 깨진 마디. 깊이는 나중 것이 이기고(같은 area 를 둘이 밝히면 나중 색), 위험은
 * 걸린 것이 전부 서되 같은 area 는 한 번만 그린다 (두 번 그리면 짙기가 겹쳐 세계에 없는
 * 눈금이 생긴다). 때를 모르는 봉투 · 위상을 밝히지 않은 방은 빈 목록이다.
 */
export function phaseZones(snapshot: GameViewSnapshot): SceneGroundZone[] {
  const regionId = snapshot.region.id;
  const spec = regionSpec(regionId);
  if (!spec) return [];
  const active = activePhases(snapshot);
  if (active.length === 0) return [];

  const zones: SceneGroundZone[] = [];

  // 깊이 — op id → 지금 읽히는 깊이 (나중 것이 이긴다)
  const depthByOp = new Map<string, string>();
  for (const phase of active) for (const entry of phase.depthOverlay ?? []) depthByOp.set(entry.areaId, entry.depth);
  if (depthByOp.size > 0) {
    for (const area of areasOf(spec.space, DEPTH_LAYER)) {
      const depth = depthByOp.get(area.id);
      if (depth === undefined) continue;
      const p = depthPresentation(depth);
      zones.push({
        id: `phase-depth:${regionId}:${area.id}`,
        shape: area.shape,
        fill: { color: p.fill, opacity: DEPTH_OVERLAY_FILL_OPACITY },
        edge: { color: p.edge, opacity: p.edgeOpacity, width: DEPTH_OVERLAY_EDGE_WIDTH },
      });
    }
  }

  // 위험 — op id 마다 한 번
  const hazardOps = new Set<string>();
  for (const phase of active) for (const entry of phase.hazardExtend ?? []) hazardOps.add(entry.areaId);
  if (hazardOps.size > 0) {
    for (const area of areasOf(spec.space, HAZARD_LAYER)) {
      if (!hazardOps.has(area.id)) continue;
      zones.push({
        id: `phase-hazard:${regionId}:${area.id}`,
        shape: area.shape,
        fill: { color: HAZARD_ZONE.fill, opacity: HAZARD_ZONE.fillOpacity },
        edge: { color: HAZARD_ZONE.edge, opacity: HAZARD_ZONE.edgeOpacity, width: HAZARD_ZONE.edgeWidth },
      });
    }
  }
  return zones;
}

/**
 * 지금 이 방에 걸린 덧씌움들 — 세계의 activePhasesAt 과 **같은 차례**로 같은 데이터를 읽는다.
 * 세계가 싣는 값 넷(철 · 위상 · 지나는 것 · 깨진 마디)이 여기서 데이터와 만난다.
 */
export function activePhases(snapshot: GameViewSnapshot): RegionPhase[] {
  const regionId = snapshot.region.id;
  const spec = regionSpec(regionId);
  const phases = spec?.phases;
  const active: RegionPhase[] = [];
  if (phases) {
    if (phases.standing) active.push(phases.standing);
    const season = snapshot.clock?.season;
    const seasonal = season === undefined ? undefined : phases.seasons?.[season];
    if (seasonal) active.push(seasonal);
    if (snapshot.region.disturbance?.phase === 'awake' && phases.awake) active.push(phases.awake);
  }
  // 지나는 것 — 경로 데이터가 밝힌 자락. 세계는 코드와 선의 이름만 싣고, 어느 자락이 걸리는지는
  // 경로 데이터(presence-routes)가 안다 (그 방 Description 에 없는 op id 는 아래에서 아무것도 덮지 않는다)
  for (const passing of snapshot.presences ?? []) {
    for (const route of PRESENCE_ROUTES) {
      if (route.presence !== passing.presence) continue;
      const hazards = route.effectWhilePassing?.hazardExtend;
      if (hazards && hazards.length > 0) active.push({ hazardExtend: hazards });
    }
  }
  // 깨진 마디 — 원천이 밝힌 마디마다의 자락 가운데 지금 깨진 마디의 것
  if (spec?.resourceEcology) {
    const broken: HazardOverlay[] = [];
    for (const entity of snapshot.entities) {
      if (entity.role !== SOURCE_ROLE || !entity.collapsedSites) continue;
      const source = spec.resourceEcology.sources.find((s) => s.id === entity.id);
      if (!source?.depletedHazards) continue;
      for (const site of entity.collapsedSites) {
        const overlay = source.depletedHazards[site];
        if (overlay) broken.push(overlay);
      }
    }
    if (broken.length > 0) active.push({ hazardExtend: broken });
  }
  return active;
}

// ── 때가 바뀌는 순간의 한 마디 (RoomNeverSame 실주행 판정 ADDED) ────────────
//
// 세계는 "언제 바뀌는지" 를 싣지 않는다 (T8). 그래도 **바뀐 순간**은 관찰자가 알 수 있다 —
// 직전 봉투와 지금 봉투의 때가 다르면 그것이 바뀐 순간이다 (방에 들어선 순간을 regionEntryTitle
// 이 같은 방식으로 아는 것과 같다). 하늘빛이 이미 그것을 말하지만, 무엇이 바뀌었는지(철인가
// 낮밤인가)를 말 한 줄로 못 박는다 — 그래야 그 뒤 달라진 땅의 띠와 원천이 "그것 때문" 으로 잇힌다.

/** 직전 때와 지금 때를 견주어 바뀌었으면 그 말을, 아니면 아무것도 돌려주지 않는다 */
export function clockChangeNotice(
  previous: WorldClockView | undefined,
  next: WorldClockView | undefined,
): string | undefined {
  if (!previous || !next) return undefined;
  if (previous.season !== next.season) {
    return codeText('clock.turned.season', codeText(SEASON_TEXT_CODES[next.season] ?? next.season));
  }
  if (previous.dayPhase !== next.dayPhase) {
    return codeText(next.dayPhase === 'NIGHT' ? 'clock.turned.night' : 'clock.turned.day');
  }
  return undefined;
}

/** 철 코드 → 문구 코드 — hud-presentation 의 SEASON_CODES 와 같은 표다 (같은 말을 두 곳에서 짓지 않는다) */
const SEASON_TEXT_CODES: Readonly<Record<string, string>> = {
  STILL: 'clock.season.still',
  SEEP: 'clock.season.seep',
  LONG_NIGHT: 'clock.season.long-night',
  TURN: 'clock.season.turn',
};
