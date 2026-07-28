// 월드 지도 렌더러 (기획서 §36.2, §37 / Phase-8 §8.1)
//
// SceneMap 의 속성을 **그대로** 그린다. 좌표는 이미 0~1 정규화되어 있으므로 픽셀 변환만 하고,
// 색은 colorKey 를 표에서 찾기만 한다 — 이 파일에 시뮬레이션 값 해석은 한 줄도 없다(§8.0).
import type { SceneMap, SceneMapRegion, ScenePoint } from "../viewmodel/SceneViewModel";
import { colorOf } from "./palette";
import type { SceneSurface } from "./SceneSurface";

/** 정규화 좌표 → 픽셀 */
export function toPixel(surface: SceneSurface, point: ScenePoint): ScenePoint {
  return { x: point.x * surface.width, y: point.y * surface.height };
}

function regionLabel(region: SceneMapRegion): string {
  const badges = region.badges.map((badge) => `${badge.key} ${badge.value}`).join(" · ");
  return badges.length === 0 ? region.label : `${region.label} — ${badges}`;
}

export class WorldMapRenderer {
  constructor(private readonly surface: SceneSurface) {}

  render(map: SceneMap): void {
    this.surface.clear();
    this.drawRegions(map);
    this.drawConnections(map);
  }

  private drawRegions(map: SceneMap): void {
    for (const region of map.regions) {
      const x = region.rect.x * this.surface.width;
      const y = region.rect.y * this.surface.height;
      const w = region.rect.w * this.surface.width;
      const h = region.rect.h * this.surface.height;

      // 기후는 바탕, 위험도는 테두리 — 두 색상 키가 각자 다른 자리를 갖는다(§36.2 "지역별 기후와 위험도")
      this.surface.rect({ x, y, w, h, fill: colorOf(region.climateKey) });
      this.surface.rect({ x, y, w, h, stroke: colorOf(region.dangerKey), lineWidth: 3 });
      // 고도는 음영으로 (§13 3D 데이터의 2D 표현)
      if (region.elevationShade > 0) {
        this.surface.rect({ x, y, w, h, fill: "#2b2b2b", alpha: region.elevationShade * 0.18 });
      }
      this.surface.text({ x: x + 8, y: y + 14, text: regionLabel(region), size: 12, fill: "#333" });
      this.surface.text({
        x: x + 8,
        y: y + 30,
        text: `고도 ${region.elevation} · ${region.tags.join(" ")}`,
        size: 10,
        fill: "#555",
      });
    }
  }

  private drawConnections(map: SceneMap): void {
    for (const connection of map.connections) {
      const from = toPixel(this.surface, connection.fromPoint);
      const to = toPixel(this.surface, connection.toPoint);
      this.surface.line({
        from,
        to,
        stroke: colorOf(connection.dangerKey),
        width: 1 + connection.width * 5,
        dashed: true,
      });
      this.surface.text({
        x: (from.x + to.x) / 2,
        y: (from.y + to.y) / 2 - 6,
        text: connection.label,
        size: 10,
        align: "center",
        fill: "#666",
      });
    }
  }
}
