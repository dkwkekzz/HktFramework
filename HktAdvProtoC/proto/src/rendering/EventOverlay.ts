// 사건 오버레이 (기획서 §36.2 "현재 발생 중인 사건", §37 / Phase-8 §8.1)
//
// 사건의 자리·반경·강도·시급도는 모두 빌더가 만든 속성이다. 여기서는 그것을 원과 글리프로 옮긴다.
import type { SceneMap, SceneOverlay } from "../viewmodel/SceneViewModel";
import { colorOf, glyphOf } from "./palette";
import { toPixel } from "./WorldMapRenderer";
import type { SceneSurface } from "./SceneSurface";

export class EventOverlayRenderer {
  constructor(private readonly surface: SceneSurface) {}

  render(map: SceneMap): void {
    for (const overlay of map.overlays) this.draw(overlay);
  }

  private draw(overlay: SceneOverlay): void {
    const point = toPixel(this.surface, overlay.point);
    const radius = overlay.radius * Math.min(this.surface.width, this.surface.height);
    const color = colorOf(overlay.colorKey);

    // 반경 — 사건이 미치는 자리
    this.surface.circle({
      x: point.x,
      y: point.y,
      r: radius,
      fill: color,
      alpha: 0.12 + overlay.intensity * 0.2,
    });
    // 진행 중인 사건은 실선 테두리, 종결된 사건은 옅은 테두리 (ongoing 은 빌더가 판정한 속성이다)
    this.surface.circle({
      x: point.x,
      y: point.y,
      r: radius,
      stroke: color,
      lineWidth: overlay.ongoing ? 2 : 1,
      alpha: overlay.ongoing ? 0.5 + overlay.urgency * 0.5 : 0.3,
    });
    this.surface.text({
      x: point.x,
      y: point.y - radius - 14,
      text: `${glyphOf(overlay.symbolKey)} ${overlay.label}`,
      size: 11,
      align: "center",
      fill: "#222",
    });
    this.surface.text({
      x: point.x,
      y: point.y - radius - 2,
      text: `참여 ${overlay.participantCount} · 시급 ${overlay.urgency.toFixed(2)}`,
      size: 9,
      align: "center",
      fill: "#555",
    });
  }
}
