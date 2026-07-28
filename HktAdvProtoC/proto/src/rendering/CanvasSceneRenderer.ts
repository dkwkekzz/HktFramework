// Canvas 장면 렌더러 (기획서 §37 / Phase-8 §8.1)
//
// 네 렌더러(지도·개체·신호·사건)를 층으로 겹쳐 한 장면을 그린다.
// 입력은 SceneViewModel 하나뿐이고, 모드도 시뮬레이션 타입도 모른다.
import type { SceneViewModel } from "../viewmodel/SceneViewModel";
import { EntityRenderer } from "./EntityRenderer";
import { EventOverlayRenderer } from "./EventOverlay";
import { LabelLayout } from "./LabelLayout";
import { SignalRenderer } from "./SignalRenderer";
import { WorldMapRenderer } from "./WorldMapRenderer";
import type { SceneSurface } from "./SceneSurface";

export class CanvasSceneRenderer {
  private readonly map: WorldMapRenderer;
  private readonly entities: EntityRenderer;
  private readonly signals: SignalRenderer;
  private readonly overlays: EventOverlayRenderer;

  constructor(private readonly surface: SceneSurface) {
    this.map = new WorldMapRenderer(surface);
    this.entities = new EntityRenderer(surface);
    this.signals = new SignalRenderer(surface);
    this.overlays = new EventOverlayRenderer(surface);
  }

  render(scene: SceneViewModel): void {
    // 라벨 배치기는 프레임마다 새로 만든다 — 먼저 그리는 층(지역 → 개체 → 사건)이 자리를 선점한다
    const labels = new LabelLayout(this.surface.width, this.surface.height);
    this.map.render(scene.map, labels);
    this.signals.render(scene.map);
    this.entities.render(scene.map, labels);
    this.overlays.render(scene.map, labels);
    // 시각은 지도의 일부다 — 배속과 함께 좌상단에 (§36.2 시간 배속 조절)
    this.surface.text({
      x: 8,
      y: this.surface.height - 10,
      text: `${scene.clock} · ×${scene.speed} · ${scene.map.legend.map((badge) => `${badge.key} ${badge.value}`).join(" · ")}`,
      size: 11,
      fill: "#dfe6f2",
    });
  }
}
