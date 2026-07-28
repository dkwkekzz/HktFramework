// 개체 렌더러 (기획서 §36.2 "이동 중인 주체"·"자원 분포", §42-8 캐릭터 아이콘 / Phase-8 §8.3)
//
// 마커의 symbolKey 를 글리프로, colorKey 를 색으로 옮기기만 한다.
// 종족·조직이 늘어나도 이 파일은 바뀌지 않는다 — 늘어나는 것은 빌더가 만드는 키와 palette 의 표다.
import type { SceneMap, SceneMapMarker } from "../viewmodel/SceneViewModel";
import { colorOf, glyphOf } from "./palette";
import { toPixel } from "./WorldMapRenderer";
import type { SceneSurface } from "./SceneSurface";

export class EntityRenderer {
  constructor(private readonly surface: SceneSurface) {}

  render(map: SceneMap): void {
    // 자원·장소는 배경 층, 주체는 그 위 — 겹칠 때 사람이 먼저 보인다
    for (const marker of map.resources) this.drawMarker(marker, 9, 0.85);
    for (const marker of map.places) this.drawMarker(marker, 9, 0.7);
    for (const marker of map.markers) this.drawMarker(marker, 13, 1);
  }

  private drawMarker(marker: SceneMapMarker, size: number, alpha: number): void {
    const point = toPixel(this.surface, marker.point);

    // 이동 중이면 목적지까지 궤적을 남긴다 (§36.2)
    if (marker.moving && marker.moveTo !== undefined) {
      const to = toPixel(this.surface, marker.moveTo);
      this.surface.line({ from: point, to, stroke: colorOf(marker.colorKey), width: 1, alpha: 0.4, dashed: true });
    }

    // 고도는 마커 아래 음영으로 (지역 음영과 같은 언어)
    if (marker.elevationShade > 0) {
      this.surface.circle({
        x: point.x,
        y: point.y + 3,
        r: size * 0.6,
        fill: "#2b2b2b",
        alpha: marker.elevationShade * 0.35,
      });
    }
    this.surface.text({
      x: point.x,
      y: point.y,
      text: glyphOf(marker.symbolKey),
      size,
      align: "center",
      fill: colorOf(marker.colorKey),
      alpha,
    });
    this.surface.text({
      x: point.x,
      y: point.y + size,
      text: marker.label,
      size: 10,
      align: "center",
      fill: "#333",
      alpha,
    });
    const badges = marker.badges.map((badge) => `${badge.key} ${badge.value}`).join(" ");
    if (badges.length > 0) {
      this.surface.text({
        x: point.x,
        y: point.y + size + 12,
        text: badges,
        size: 9,
        align: "center",
        fill: "#666",
        alpha,
      });
    }
  }
}
