// 플레이 화면 렌더러 (Phase-9 §9.2) — 같은 SceneViewModel 을 소비하는 네 번째 렌더러.
//
// 카메라가 focusMarkerId(조작 중인 주체)를 중심에 두고 현재 지역을 확대한다 — MMORPG 의 캐릭터 중심 뷰.
// **이 파일도 SceneViewModel 밖의 타입을 import 하지 않는다**(§8.0 — 린트가 강제).
// pick() 은 표시 좌표의 역변환까지만 한다 — 무엇을 할지(이동·대상·통행)는 입력층(app)의 몫이다.
import type {
  SceneMap,
  SceneMapMarker,
  SceneMapRegion,
  ScenePoint,
  SceneViewModel,
} from "../viewmodel/SceneViewModel";
import { drawShape } from "./EntityRenderer";
import { channelStyleOf, colorOf } from "./palette";
import type { SceneSurface } from "./SceneSurface";

/** 픽킹 결과 — 마커 / 지역 게이트 / 빈 땅(지역 안 분율 좌표) */
export type PlayPick =
  | { kind: "marker"; id: string; label: string }
  | { kind: "gate"; toRegionId: string; open: boolean; label: string }
  | { kind: "ground"; regionId: string; fx: number; fy: number }
  | { kind: "none" };

export interface PlayRenderOptions {
  /** 대상으로 지정된 마커 — 선택 링을 그린다 */
  selectedId?: string;
  /** 마지막 이동 명령의 목적지 (지역 안 분율) — 자리 표식을 그린다 */
  destination?: { regionId: string; fx: number; fy: number };
}

interface GateSpot {
  toRegionId: string;
  open: boolean;
  label: string;
  point: ScenePoint; // 정규화 좌표
}

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 3;

export class PlaySceneRenderer {
  private zoom = 1;
  /** 마지막 프레임의 카메라 — pick() 이 같은 변환을 역으로 쓴다 */
  private center: ScenePoint = { x: 0.5, y: 0.5 };
  private scale = 1;
  private lastScene: SceneViewModel | undefined;
  private lastOptions: PlayRenderOptions = {};
  private gates: GateSpot[] = [];

  constructor(private readonly surface: SceneSurface) {}

  setZoom(zoom: number): void {
    this.zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom));
    if (this.lastScene !== undefined) this.render(this.lastScene, this.lastOptions);
  }

  zoomBy(factor: number): void {
    this.setZoom(this.zoom * factor);
  }

  get currentZoom(): number {
    return this.zoom;
  }

  // --- 카메라 변환 ---------------------------------------------------------------------

  private toScreen(p: ScenePoint): ScenePoint {
    return {
      x: (p.x - this.center.x) * this.scale + this.surface.width / 2,
      y: (p.y - this.center.y) * this.scale + this.surface.height / 2,
    };
  }

  private toNormalized(px: number, py: number): ScenePoint {
    return {
      x: (px - this.surface.width / 2) / this.scale + this.center.x,
      y: (py - this.surface.height / 2) / this.scale + this.center.y,
    };
  }

  private focusMarker(map: SceneMap): SceneMapMarker | undefined {
    const id = map.focusMarkerId;
    if (id === undefined) return undefined;
    return (
      map.markers.find((m) => m.id === id) ??
      map.places.find((m) => m.id === id) ??
      map.resources.find((m) => m.id === id)
    );
  }

  // --- 렌더 ----------------------------------------------------------------------------

  render(scene: SceneViewModel, options: PlayRenderOptions = {}): void {
    this.lastScene = scene;
    this.lastOptions = options;
    const { surface } = this;
    surface.clear();
    surface.rect({ x: 0, y: 0, w: surface.width, h: surface.height, fill: colorOf("map-bg") });

    const map = scene.map;
    const focus = this.focusMarker(map);
    const region = map.regions.find((r) => r.id === focus?.regionId) ?? map.regions[0];
    if (region === undefined || focus === undefined) {
      surface.text({
        x: surface.width / 2,
        y: surface.height / 2,
        text: "관찰자 없음 — 주체를 조작해야 세계가 보인다 (§7.2)",
        size: 14,
        align: "center",
        fill: colorOf("label"),
      });
      return;
    }

    // 카메라: 조작 주체 중심, 현재 지역이 뷰포트의 ~85% 를 채우는 배율 × 사용자 줌
    this.scale =
      Math.min(surface.width / Math.max(0.05, region.rect.w), surface.height / Math.max(0.05, region.rect.h)) *
      0.85 *
      this.zoom;
    this.center = { ...focus.point };

    // 지역 바닥 — 현재 지역이 아니면 가라앉힌다(카메라의 초점을 화면이 말한다)
    for (const r of map.regions) {
      const a = this.toScreen({ x: r.rect.x, y: r.rect.y });
      const w = r.rect.w * this.scale;
      const h = r.rect.h * this.scale;
      const isCurrent = r.id === region.id;
      surface.rect({
        x: a.x,
        y: a.y,
        w,
        h,
        fill: colorOf(r.climateKey),
        stroke: colorOf(r.dangerKey),
        lineWidth: isCurrent ? 2.5 : 1,
        alpha: isCurrent ? 1 : 0.35,
      });
      surface.text({
        x: a.x + 10,
        y: a.y + 16,
        text: r.label,
        size: isCurrent ? 14 : 11,
        fill: colorOf(isCurrent ? "label" : "label-dim"),
        alpha: isCurrent ? 1 : 0.6,
      });
    }

    // 지역 게이트 (§13 연결) — 현재 지역 경계 위, 이웃 방향
    this.gates = collectGates(map, region);
    for (const gate of this.gates) {
      const p = this.toScreen(gate.point);
      surface.circle({
        x: p.x,
        y: p.y,
        r: 11,
        fill: colorOf("map-bg"),
        stroke: colorOf(gate.open ? "gauge-ok" : "danger-extreme"),
        lineWidth: 2,
      });
      surface.text({
        x: p.x,
        y: p.y,
        text: gate.open ? "⇄" : "✕",
        size: 12,
        align: "center",
        fill: colorOf(gate.open ? "gauge-ok" : "danger-extreme"),
      });
      surface.text({
        x: p.x,
        y: p.y + 20,
        text: gate.label,
        size: 10,
        align: "center",
        fill: colorOf("label-dim"),
      });
    }

    // 사건 링 (§36.2)
    for (const overlay of map.overlays) {
      const p = this.toScreen(overlay.point);
      surface.circle({
        x: p.x,
        y: p.y,
        r: Math.max(8, overlay.radius * this.scale),
        stroke: colorOf(overlay.colorKey),
        lineWidth: overlay.ongoing ? 2 : 1,
        alpha: 0.35 + overlay.intensity * 0.45,
      });
    }

    // 신호 파문 (§8.3)
    for (const signal of map.signals) {
      const style = channelStyleOf(signal.channelKey);
      const p = this.toScreen(signal.point);
      surface.circle({
        x: p.x,
        y: p.y,
        r: 6 + (1 - signal.intensity) * 14,
        stroke: style.color,
        lineWidth: 1,
        alpha: signal.intensity * 0.7,
      });
    }

    // 이동 목적지 표식 — 입력층이 준 마지막 명령의 자리
    const destination = options.destination;
    if (destination !== undefined) {
      const destRegion = map.regions.find((r) => r.id === destination.regionId);
      if (destRegion !== undefined) {
        const n = {
          x: destRegion.rect.x + destination.fx * destRegion.rect.w,
          y: destRegion.rect.y + destination.fy * destRegion.rect.h,
        };
        const p = this.toScreen(n);
        const f = this.toScreen(focus.point);
        surface.line({ from: f, to: p, stroke: colorOf("label-dim"), width: 1, alpha: 0.5, dashed: true });
        surface.circle({ x: p.x, y: p.y, r: 6, stroke: colorOf("marker-highlight"), lineWidth: 1.5, alpha: 0.9 });
        surface.circle({ x: p.x, y: p.y, r: 2, fill: colorOf("marker-highlight"), alpha: 0.9 });
      }
    }

    // 마커 — 조직·장소·자원은 배경 층, 주체는 그 위 (EntityRenderer 와 같은 위계)
    const drawLayer = (markers: SceneMapMarker[], alpha: number): void => {
      for (const marker of markers) this.drawMarker(marker, alpha, options.selectedId);
    };
    drawLayer(map.factions, 0.75);
    drawLayer(map.places, 0.85);
    drawLayer(map.resources, 0.9);
    drawLayer(map.markers, 1);

    this.drawMinimap(map, focus);

    // 시각·배속 — 플레이 화면의 최소 상태줄
    surface.text({
      x: 10,
      y: surface.height - 12,
      text: `${scene.clock} · ×${scene.speed}`,
      size: 12,
      fill: colorOf("label"),
    });
  }

  private drawMarker(marker: SceneMapMarker, alpha: number, selectedId?: string): void {
    const point = this.toScreen(marker.point);
    const { surface } = this;
    if (point.x < -40 || point.y < -40 || point.x > surface.width + 40 || point.y > surface.height + 40) return;
    // 화면 확대에 맞춰 커진다 — 지역이 화면을 채울 때 마커가 점으로 남지 않게 한다
    const size = Math.max(6, marker.size * Math.min(surface.width, surface.height) * this.zoom * 2.4);

    surface.circle({
      x: point.x,
      y: point.y + size * (0.6 + marker.elevationShade * 0.4),
      r: size * 0.75,
      fill: colorOf("marker-shadow"),
      alpha: alpha * 0.35,
    });
    drawShape(surface, marker.shapeKey, point, size, colorOf(marker.colorKey), alpha);

    if (marker.emphasized === true) {
      surface.circle({ x: point.x, y: point.y, r: size * 1.6, stroke: colorOf("marker-highlight"), lineWidth: 1.5, alpha: 0.85 });
    }
    // 대상 선택 링 — 강조(자기 자신)와 다른 색으로 구분한다
    if (selectedId !== undefined && marker.id === selectedId) {
      surface.circle({ x: point.x, y: point.y, r: size * 1.9, stroke: colorOf("gauge-ok"), lineWidth: 2, alpha: 0.95 });
    }

    if (marker.gauge !== undefined) {
      const barW = size * 2;
      const barH = Math.max(2.5, size * 0.22);
      const barY = point.y - size * 1.9;
      surface.rect({ x: point.x - barW / 2, y: barY, w: barW, h: barH, fill: colorOf("gauge-back"), alpha });
      surface.rect({ x: point.x - barW / 2, y: barY, w: barW * marker.gauge.value, h: barH, fill: colorOf(marker.gauge.colorKey), alpha });
    }

    this.surface.text({
      x: point.x,
      y: point.y + size * 1.9,
      text: marker.label,
      size: 11,
      align: "center",
      fill: colorOf("label"),
      alpha: alpha * 0.9,
    });
  }

  /** 우상단 미니맵 — 전 지역 + 현재 위치. MMORPG 관례의 축소 지도 */
  private drawMinimap(map: SceneMap, focus: SceneMapMarker): void {
    const { surface } = this;
    const w = 150;
    const h = 96;
    const x0 = surface.width - w - 10;
    const y0 = 10;
    surface.rect({ x: x0, y: y0, w, h, fill: colorOf("map-bg"), stroke: colorOf("label-dim"), lineWidth: 1, alpha: 0.9 });
    for (const region of map.regions) {
      surface.rect({
        x: x0 + region.rect.x * w,
        y: y0 + region.rect.y * h,
        w: region.rect.w * w,
        h: region.rect.h * h,
        fill: colorOf(region.climateKey),
        alpha: region.id === focus.regionId ? 0.95 : 0.5,
      });
    }
    surface.circle({ x: x0 + focus.point.x * w, y: y0 + focus.point.y * h, r: 3, fill: colorOf("marker-highlight") });
  }

  // --- 픽킹 ----------------------------------------------------------------------------

  /** 화면 좌표 → 무엇을 짚었는가. 역변환은 마지막 프레임의 카메라를 쓴다 */
  pick(px: number, py: number): PlayPick {
    const scene = this.lastScene;
    if (scene === undefined) return { kind: "none" };
    const map = scene.map;

    // 마커 우선(주체 > 자원 > 장소 > 조직) — 겹치면 사람이 먼저 잡힌다
    const layers = [map.markers, map.resources, map.places, map.factions];
    for (const layer of layers) {
      let best: { marker: SceneMapMarker; distance: number } | undefined;
      for (const marker of layer) {
        const p = this.toScreen(marker.point);
        const size = Math.max(6, marker.size * Math.min(this.surface.width, this.surface.height) * this.zoom * 2.4);
        const radius = Math.max(14, size * 1.8);
        const distance = Math.hypot(px - p.x, py - p.y);
        if (distance <= radius && (best === undefined || distance < best.distance)) {
          best = { marker, distance };
        }
      }
      if (best !== undefined) return { kind: "marker", id: best.marker.id, label: best.marker.label };
    }

    // 게이트
    for (const gate of this.gates) {
      const p = this.toScreen(gate.point);
      if (Math.hypot(px - p.x, py - p.y) <= 18) {
        return { kind: "gate", toRegionId: gate.toRegionId, open: gate.open, label: gate.label };
      }
    }

    // 빈 땅 — 어느 지역 안인가
    const n = this.toNormalized(px, py);
    for (const region of map.regions) {
      const { rect } = region;
      if (n.x >= rect.x && n.x <= rect.x + rect.w && n.y >= rect.y && n.y <= rect.y + rect.h) {
        return {
          kind: "ground",
          regionId: region.id,
          fx: (n.x - rect.x) / rect.w,
          fy: (n.y - rect.y) / rect.h,
        };
      }
    }
    return { kind: "none" };
  }
}

/** 현재 지역에 닿은 연결의 게이트 자리 — 이웃 방향으로 경계와 만나는 점 */
function collectGates(map: SceneMap, region: SceneMapRegion): GateSpot[] {
  const gates: GateSpot[] = [];
  const center: ScenePoint = { x: region.rect.x + region.rect.w / 2, y: region.rect.y + region.rect.h / 2 };
  for (const connection of map.connections) {
    const touches = connection.from === region.id || connection.to === region.id;
    if (!touches) continue;
    const toRegionId = connection.from === region.id ? connection.to : connection.from;
    const other = map.regions.find((r) => r.id === toRegionId);
    if (other === undefined) continue;
    const target: ScenePoint = { x: other.rect.x + other.rect.w / 2, y: other.rect.y + other.rect.h / 2 };
    gates.push({
      toRegionId,
      open: connection.openToViewer,
      label: `${other.label}로`,
      point: boundaryPoint(region.rect, center, target),
    });
  }
  // 같은 이웃으로 길이 여럿이면 열린 것을 앞세운다(게이트 아이콘은 한 자리에 하나)
  const seen = new Map<string, GateSpot>();
  for (const gate of gates.sort((a, b) => Number(b.open) - Number(a.open))) {
    if (!seen.has(gate.toRegionId)) seen.set(gate.toRegionId, gate);
  }
  return [...seen.values()];
}

/** 사각형 중심에서 target 방향 반직선이 경계와 만나는 점 (살짝 안쪽) */
function boundaryPoint(rect: { x: number; y: number; w: number; h: number }, center: ScenePoint, target: ScenePoint): ScenePoint {
  const dx = target.x - center.x;
  const dy = target.y - center.y;
  if (dx === 0 && dy === 0) return center;
  const half = { x: rect.w / 2, y: rect.h / 2 };
  const tx = dx === 0 ? Number.POSITIVE_INFINITY : (half.x * 0.92) / Math.abs(dx);
  const ty = dy === 0 ? Number.POSITIVE_INFINITY : (half.y * 0.92) / Math.abs(dy);
  const t = Math.min(tx, ty);
  return { x: center.x + dx * t, y: center.y + dy * t };
}
