// 월드 지도 빌더 (기획서 §36.2, §13, §42-8 / Phase-8 §8.1·§8.3)
//
// **3D→2D 톱다운 투영과 정규화가 여기서 끝난다.** 렌더러는 RegionDefinition 도 Position 도 모르고,
// 0~1 좌표·색상 키·심볼 키만 받는다. 이후 3D 렌더러로 교체해도 빌더는 속성 추가만 한다(§8.0).
import type { ObservationEffect, RegionDefinition, WorldDefinition } from "../core/world/types";
import type { WorldRuntime } from "../core/world/WorldRuntime";
import { findPlayerId, playerStateOf } from "../core/agents/PlayerAgent";
import { BeliefView } from "../core/agents/BeliefView";
import { getEventViewFor } from "../core/events/EventViews";
import type { EntityState, Position } from "../shared/state";
import type { RawWorldChange } from "../shared/change";
import { TICKS_PER_HOUR } from "../shared/time";
import {
  createEmptyMap,
  type SceneBadge,
  type SceneMap,
  type SceneMapConnection,
  type SceneMapMarker,
  type SceneMapRegion,
  type SceneOverlay,
  type ScenePoint,
  type SceneRect,
  type SceneSignal,
  type SceneViewMode,
} from "./SceneViewModel";

/** 지도 빌더의 시점 — 모드는 렌더러의 분기가 아니라 빌더의 입력이다 (§8.0) */
export interface SceneViewContext {
  mode: SceneViewMode;
  /** 플레이어 모드의 기준 주체 (없으면 조작 중인 주체를 찾는다) */
  observerId?: string;
}

/** 신호를 화면에 남겨 두는 시간 — 잔광의 수명(§8.3 ttl) */
export const SIGNAL_DISPLAY_WINDOW = TICKS_PER_HOUR;

/** 지역 사각형 사이의 여백 (정규화 단위) */
const REGION_GAP = 0.04;

// --- 투영 (§13 → §36.2) ---------------------------------------------------------------

/**
 * 지역들의 톱다운 배치.
 * 기획서에 지역의 절대 좌표는 없다(연결 그래프 + 지역 내 지역좌표뿐) — 그래서 배치는 표시의 문제이고,
 * **결정론적 격자**로 고정한다. 지역 id 사전순 → 좌→우, 위→아래. 같은 세계면 항상 같은 지도가 나온다.
 */
export class MapProjection {
  private readonly rects = new Map<string, SceneRect>();
  private readonly regions = new Map<string, RegionDefinition>();

  constructor(definition: WorldDefinition) {
    const ordered = [...definition.spaces.regions].sort((a, b) => a.id.localeCompare(b.id));
    const columns = Math.max(1, Math.ceil(Math.sqrt(ordered.length)));
    const rows = Math.max(1, Math.ceil(ordered.length / columns));
    const cellW = (1 - REGION_GAP * (columns + 1)) / columns;
    const cellH = (1 - REGION_GAP * (rows + 1)) / rows;

    ordered.forEach((region, index) => {
      const column = index % columns;
      const row = Math.floor(index / columns);
      this.regions.set(region.id, region);
      this.rects.set(region.id, {
        x: REGION_GAP + column * (cellW + REGION_GAP),
        y: REGION_GAP + row * (cellH + REGION_GAP),
        w: cellW,
        h: cellH,
      });
    });
  }

  rectOf(regionId: string): SceneRect | undefined {
    return this.rects.get(regionId);
  }

  regionOf(regionId: string): RegionDefinition | undefined {
    return this.regions.get(regionId);
  }

  /** 3D 위치 → 정규화 2D 점. z 는 좌표에서 빠지고 elevation 속성으로 따로 실린다 */
  project(position: Position): ScenePoint | undefined {
    const rect = this.rects.get(position.regionId);
    const region = this.regions.get(position.regionId);
    if (rect === undefined || region === undefined) return undefined;
    const width = region.bounds.width > 0 ? region.bounds.width : 1;
    const height = region.bounds.height > 0 ? region.bounds.height : 1;
    const clamp01 = (value: number): number => (value < 0 ? 0 : value > 1 ? 1 : value);
    return {
      x: rect.x + clamp01(position.x / width) * rect.w,
      y: rect.y + clamp01(position.y / height) * rect.h,
    };
  }

  /** 고도 음영 0~1 — 지역 depth 대비 z */
  shade(position: Position): number {
    const region = this.regions.get(position.regionId);
    const depth = region === undefined || region.bounds.depth <= 0 ? 1 : region.bounds.depth;
    const value = position.z / depth;
    return value < 0 ? 0 : value > 1 ? 1 : value;
  }

  /** 지역 중심 — 연결선의 끝점 */
  center(regionId: string): ScenePoint | undefined {
    const rect = this.rects.get(regionId);
    return rect === undefined ? undefined : { x: rect.x + rect.w / 2, y: rect.y + rect.h / 2 };
  }

  /** 지역 반경 대비 정규화 — 사건 반경(3D 거리)을 화면 반경으로 옮긴다 */
  normalizeRadius(regionId: string, radius: number): number {
    const rect = this.rects.get(regionId);
    const region = this.regions.get(regionId);
    if (rect === undefined || region === undefined) return 0.02;
    const span = Math.max(region.bounds.width, region.bounds.height, 1);
    return Math.min(0.5, Math.max(0.01, (radius / span) * Math.max(rect.w, rect.h)));
  }
}

// --- 색상 키·심볼 키 (수치 해석은 전부 여기서) ------------------------------------------

export function dangerKey(danger: number): string {
  if (danger >= 75) return "danger-extreme";
  if (danger >= 50) return "danger-high";
  if (danger >= 25) return "danger-mid";
  return "danger-low";
}

/** 기후 색상 키 — 지역 태그와 상태에서 파생 (기획서 §13 지역 태그) */
export function climateKey(tags: string[], states: Record<string, unknown>): string {
  if (tags.includes("frozen") || tags.includes("cold")) return "climate-cold";
  if (tags.includes("arid") || tags.includes("desert")) return "climate-arid";
  if (tags.includes("wild") || tags.includes("forest")) return "climate-wild";
  if (tags.includes("settlement") || tags.includes("safe")) return "climate-settled";
  const abundance = states["food_abundance"];
  if (typeof abundance === "number" && abundance >= 200) return "climate-wild";
  return "climate-temperate";
}

/**
 * 심볼 키 (§42-8 캐릭터 아이콘).
 * 종족·조직·유형 태그를 키로 옮기기만 한다 — 키→글리프 매핑은 렌더러의 표(교체 가능)다.
 */
export function symbolKeyOf(entity: EntityState, speciesId?: string): string {
  if (entity.type === "faction") return "symbol-faction";
  if (entity.type === "resource") return "symbol-resource";
  if (entity.type === "location") return "symbol-place";
  if (entity.tags.includes("player")) return "symbol-player";
  if (entity.tags.includes("beast") || entity.tags.includes("creature")) return "symbol-beast";
  if (speciesId !== undefined && speciesId.length > 0) return `symbol-species.${speciesId.split(".").pop()}`;
  return "symbol-agent";
}

function colorKeyOf(entity: EntityState, states: Record<string, unknown>): string {
  const health = states["health"];
  if (typeof health === "number" && health < 30) return "state-critical";
  const fear = states["fear"];
  if (typeof fear === "number" && fear >= 70) return "state-afraid";
  if (entity.tags.includes("hostile") || entity.tags.includes("beast")) return "state-hostile";
  return "state-normal";
}

function badge(key: string, value: unknown): SceneBadge | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value === "number") {
    return { key, value: Number.isInteger(value) ? String(value) : value.toFixed(1) };
  }
  return { key, value: String(value) };
}

function badgesOf(states: Record<string, unknown>, keys: string[]): SceneBadge[] {
  const badges: SceneBadge[] = [];
  for (const key of keys) {
    const entry = badge(key, states[key]);
    if (entry !== undefined) badges.push(entry);
  }
  return badges;
}

// --- 마커 -----------------------------------------------------------------------------

function markerOf(
  runtime: WorldRuntime,
  projection: MapProjection,
  entity: EntityState,
  badgeKeys: string[],
): SceneMapMarker | undefined {
  if (entity.position === undefined) return undefined;
  const point = projection.project(entity.position);
  if (point === undefined) return undefined;
  const speciesId = entity.states["species_id"];
  const label = runtime.definition.bootstrap.entities.find((e) => e.id === entity.id)?.name ?? entity.id;
  const marker: SceneMapMarker = {
    id: entity.id,
    label,
    symbolKey: symbolKeyOf(entity, typeof speciesId === "string" ? speciesId : undefined),
    colorKey: colorKeyOf(entity, entity.states),
    point,
    regionId: entity.position.regionId,
    elevation: entity.position.z,
    elevationShade: projection.shade(entity.position),
    moving: false,
    badges: badgesOf(entity.states, badgeKeys),
    tags: [...entity.tags],
  };

  // 이동 중인 주체 (§36.2) — 행동의 movement 정책이 곧 "지금 움직이고 있다"의 근거다
  const scheduled = runtime.state.agentRuntimes[entity.id]?.currentAction;
  if (scheduled !== null && scheduled !== undefined) {
    const action = runtime.index.actions.get(scheduled.actionId);
    if (action?.movement === "to_target") {
      const targetId = scheduled.targetIds[0];
      const targetPosition = targetId === undefined ? undefined : runtime.store.findEntity(targetId)?.position;
      const to = targetPosition === undefined ? undefined : projection.project(targetPosition);
      if (to !== undefined) {
        marker.moving = true;
        marker.moveTo = to;
      }
    }
  }
  return marker;
}

// --- 신호 (§8.3) ----------------------------------------------------------------------

/**
 * 관찰 신호·능력 효과의 표시 속성.
 * 신호 자체는 인식 단계에서 소비되므로(§23), 표시는 **신호를 낸 행동의 선언**(visibleSignals /
 * 능력의 observableSignals)과 그 행동이 남긴 change 를 맞춰 복원한다 — 별도 연출 스크립트는 없다.
 */
function signalsFrom(
  runtime: WorldRuntime,
  projection: MapProjection,
  changes: RawWorldChange[],
): SceneSignal[] {
  const now = runtime.state.simulationTime;
  const signals: SceneSignal[] = [];
  const seen = new Set<string>();

  for (const change of changes) {
    const age = now - change.time;
    if (age < 0 || age > SIGNAL_DISPLAY_WINDOW) continue;
    const effects: ObservationEffect[] = [];
    for (const tag of change.tags) {
      const action = runtime.index.actions.get(tag);
      if (action !== undefined) effects.push(...action.visibleSignals);
    }
    if (effects.length === 0) continue;

    const originId = change.sourceId;
    const position =
      originId === undefined ? undefined : runtime.store.findEntity(originId)?.position;
    const point = position === undefined ? undefined : projection.project(position);
    if (point === undefined || position === undefined) continue;

    for (const effect of effects) {
      const id = `${change.id}.${effect.signalId}`;
      if (seen.has(id)) continue;
      seen.add(id);
      for (const channel of effect.channels) {
        signals.push({
          id: `${id}.${channel}`,
          channelKey: channel,
          intensity: Math.min(1, Math.max(0, effect.strength / 100)) * (1 - age / SIGNAL_DISPLAY_WINDOW),
          point,
          regionId: position.regionId,
          ttl: SIGNAL_DISPLAY_WINDOW - age,
          label: effect.signalId,
          tags: [...effect.tags],
        });
      }
    }
  }
  return signals.sort((a, b) => (b.intensity === a.intensity ? a.id.localeCompare(b.id) : b.intensity - a.intensity));
}

// --- 오버레이 (§36.2 발생 중 사건) ----------------------------------------------------

function overlaysOf(
  runtime: WorldRuntime,
  projection: MapProjection,
  observerId: string | undefined,
): SceneOverlay[] {
  const overlays: SceneOverlay[] = [];
  const now = runtime.state.simulationTime;
  for (const event of runtime.state.events.events) {
    if (observerId !== undefined && !getEventViewFor(runtime, observerId, event.id).known) continue;
    const regionId = event.locationId;
    if (regionId === undefined) continue;
    const center = projection.center(regionId);
    if (center === undefined) continue;

    // 사건의 자리는 참여자들의 평균 위치다 — 지역 중심보다 사건이 벌어진 자리에 가깝다
    const points: ScenePoint[] = [];
    for (const participantId of event.participants) {
      const position = runtime.store.findEntity(participantId)?.position;
      const point = position === undefined ? undefined : projection.project(position);
      if (point !== undefined) points.push(point);
    }
    const point =
      points.length === 0
        ? center
        : {
            x: points.reduce((sum, p) => sum + p.x, 0) / points.length,
            y: points.reduce((sum, p) => sum + p.y, 0) / points.length,
          };

    const pattern = runtime.definition.eventPatterns.find((entry) => entry.id === event.patternId);
    const window = pattern?.timeWindow ?? 1;
    const urgency =
      event.status === "concluded" ? 0 : Math.max(0, 1 - (now - event.lastChangeAt) / (window * 2));
    overlays.push({
      eventId: event.id,
      label: event.title,
      symbolKey: `event.${event.type}`,
      colorKey: event.status === "concluded" ? "event-closed" : dangerKey(Math.min(100, event.significance / 5)),
      point,
      radius: projection.normalizeRadius(regionId, pattern?.locationRadius ?? 30),
      intensity: Math.min(1, event.significance / 600),
      urgency,
      participantCount: event.participants.length,
      ongoing: event.status === "ongoing",
    });
  }
  return overlays.sort((a, b) =>
    b.intensity === a.intensity ? a.eventId.localeCompare(b.eventId) : b.intensity - a.intensity,
  );
}

// --- 지도 (§36.2 전 항목) --------------------------------------------------------------

const AGENT_BADGE_KEYS = ["health", "hunger", "fear", "stress", "current_action"];
const RESOURCE_BADGE_KEYS = ["quantity", "quality", "rarity"];
const PLACE_BADGE_KEYS = ["danger", "shelter_quality"];
const REGION_BADGE_KEYS = ["danger", "food_abundance", "ability_residue", "temperature"];

/**
 * §36.2 의 표시 재료 전부.
 * 플레이어 모드에서는 **플레이어가 발견한 것만** 실린다 — 판단은 Phase 7 지식 필터가 이미 했고,
 * 여기서는 그 집합으로 걸러 옮기기만 한다(§8.0 "모드는 빌더의 입력이다").
 */
export function buildMapView(runtime: WorldRuntime, context: SceneViewContext): SceneMap {
  const projection = new MapProjection(runtime.definition);
  const observerId =
    context.mode === "player" ? (context.observerId ?? findPlayerId(runtime)) : undefined;
  const player = observerId === undefined ? undefined : playerStateOf(runtime, observerId);
  /**
   * 플레이어 시점은 **Phase 7 지식 필터를 가진 주체**의 시점이다.
   * 보는 사람이 없으면(또는 그가 조작 중인 주체가 아니면) 관찰된 세계도 없다 —
   * 여기서 빈 지도를 돌려주는 것이, 시점만 바꿔 놓고 실제 세계를 그려 버리는 사고를 막는다.
   */
  if (context.mode === "player" && player === undefined) {
    return { ...createEmptyMap(), legend: [{ key: "관찰자", value: "없음" }] };
  }
  const beliefView = observerId === undefined ? undefined : new BeliefView(runtime, observerId);
  const discovered = player === undefined ? undefined : new Set(player.discoveredEntityIds);

  const visible = (entity: EntityState): boolean => {
    if (discovered === undefined) return true;
    if (!discovered.has(entity.id)) return false;
    // 위치는 감각이다 — 지금 감각이 닿는 주체만 지도에 찍힌다 (§7.2 와 같은 규약)
    if (entity.type !== "agent") return true;
    if (entity.id === observerId) return true;
    return beliefView?.inSensoryRange(entity.id) ?? false;
  };

  const regions: SceneMapRegion[] = [];
  for (const region of [...runtime.definition.spaces.regions].sort((a, b) => a.id.localeCompare(b.id))) {
    const rect = projection.rectOf(region.id);
    if (rect === undefined) continue;
    const entity = runtime.store.findEntity(region.id);
    // 지역의 형상·연결은 지도 지식이다(§22 findPossibleTargets 와 같은 규약) — 모드와 무관하게 실린다
    const states = entity?.states ?? region.baseStates;
    const danger = typeof states["danger"] === "number" ? (states["danger"] as number) : 0;
    regions.push({
      id: region.id,
      label: region.name,
      rect,
      climateKey: climateKey(region.tags, states),
      dangerKey: dangerKey(danger),
      elevation: region.bounds.depth,
      elevationShade: Math.min(1, region.bounds.depth / 100),
      badges: badgesOf(states, REGION_BADGE_KEYS),
      tags: [...region.tags],
    });
  }

  const connections: SceneMapConnection[] = [];
  for (const connection of runtime.definition.spaces.connections) {
    const from = projection.center(connection.from);
    const to = projection.center(connection.to);
    if (from === undefined || to === undefined) continue;
    connections.push({
      from: connection.from,
      to: connection.to,
      fromPoint: from,
      toPoint: to,
      dangerKey: dangerKey(connection.danger),
      width: Math.min(1, connection.capacity / 40),
      label: `이동 ${connection.travelCost} · 위험 ${connection.danger}`,
    });
  }

  const markers: SceneMapMarker[] = [];
  const resources: SceneMapMarker[] = [];
  const places: SceneMapMarker[] = [];
  for (const entity of Object.values(runtime.state.entities).sort((a, b) => a.id.localeCompare(b.id))) {
    if (!visible(entity)) continue;
    if (entity.type === "agent") {
      const marker = markerOf(runtime, projection, entity, AGENT_BADGE_KEYS);
      if (marker !== undefined) markers.push(marker);
      continue;
    }
    if (entity.type === "resource") {
      const marker = markerOf(runtime, projection, entity, RESOURCE_BADGE_KEYS);
      if (marker !== undefined) resources.push(marker);
      continue;
    }
    // 지역 개체(region 태그)는 사각형으로 그려지므로 마커가 아니다 — 장소만 찍는다
    if (entity.type === "location" && !entity.tags.includes("region")) {
      const marker = markerOf(runtime, projection, entity, PLACE_BADGE_KEYS);
      if (marker !== undefined) places.push(marker);
    }
  }

  // 신호도 아는 자리에서만 보인다 — 플레이어 모드에서는 발견한 지역의 신호만 남는다
  const signals = signalsFrom(runtime, projection, runtime.state.changeLog).filter(
    (signal) => player === undefined || player.discoveredLocationIds.includes(signal.regionId),
  );

  return {
    regions,
    connections,
    markers,
    resources,
    places,
    overlays: overlaysOf(runtime, projection, observerId),
    signals,
    legend: [
      { key: "지역", value: String(regions.length) },
      { key: "주체", value: String(markers.length) },
      { key: "자원", value: String(resources.length) },
      { key: "장소", value: String(places.length) },
      { key: "신호", value: String(signals.length) },
    ],
  };
}
