// 월드 지도 렌더러 (기획서 §36.2, §37 / Phase-8 §8.1)
//
// SceneMap 의 속성을 **그대로** 그린다. 좌표는 이미 0~1 정규화되어 있으므로 픽셀 변환만 하고,
// 색은 colorKey 를 표에서 찾기만 한다 — 이 파일에 시뮬레이션 값 해석은 한 줄도 없다(§8.0).
import type { SceneMap, ScenePoint } from "../viewmodel/SceneViewModel";
import { colorOf } from "./palette";
import type { SceneSurface } from "./SceneSurface";

/** 정규화 좌표 → 픽셀 */
export function toPixel(surface: SceneSurface, point: ScenePoint): ScenePoint {
  return { x: point.x * surface.width, y: point.y * surface.height };
}

export class WorldMapRenderer {
  constructor(private readonly surface: SceneSurface) {}

  render(map: SceneMap): void {
    this.surface.clear();
    // 어두운 바탕 — 지역·개체가 그 위에 떠오른다
    this.surface.rect({ x: 0, y: 0, w: this.surface.width, h: this.surface.height, fill: colorOf("map-bg") });
    this.drawConnections(map);
    this.drawRegions(map);
  }

  private drawRegions(map: SceneMap): void {
    for (const region of map.regions) {
      const x = region.rect.x * this.surface.width;
      const y = region.rect.y * this.surface.height;
      const w = region.rect.w * this.surface.width;
      const h = region.rect.h * this.surface.height;

      // 기후는 바탕, 위험도는 테두리 — 두 색상 키가 각자 다른 자리를 갖는다(§36.2 "지역별 기후와 위험도")
      this.surface.rect({ x, y, w, h, fill: colorOf(region.climateKey) });
      // 고도는 음영으로 (§13 3D 데이터의 2D 표현)
      if (region.elevationShade > 0) {
        this.surface.rect({ x, y, w, h, fill: colorOf("marker-shadow"), alpha: region.elevationShade * 0.25 });
      }
      this.surface.rect({ x, y, w, h, stroke: colorOf(region.dangerKey), lineWidth: 2, alpha: 0.9 });
      // 이름표 하나만 — 상태 나열(배지·태그)은 패널·텍스트 렌더러의 몫이다
      this.surface.text({ x: x + 8, y: y + 14, text: region.label, size: 12, fill: colorOf("label") });
    }
  }

  private drawConnections(map: SceneMap): void {
    for (const connection of map.connections) {
      const from = toPixel(this.surface, connection.fromPoint);
      const to = toPixel(this.surface, connection.toPoint);
      // 길 — 어두운 바닥선 위에 위험도 색 점선. 수치 라벨은 지도에 싣지 않는다
      this.surface.line({ from, to, stroke: colorOf("marker-shadow"), width: 3 + connection.width * 5, alpha: 0.6 });
      this.surface.line({
        from,
        to,
        stroke: colorOf(connection.dangerKey),
        width: 1 + connection.width * 3,
        dashed: true,
        alpha: 0.8,
      });
    }
  }
}
