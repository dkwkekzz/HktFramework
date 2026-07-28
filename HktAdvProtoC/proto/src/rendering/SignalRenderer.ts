// 신호 렌더러 — 능력 효과·관찰 신호의 연출 (기획서 §42-8, §23 / Phase-8 §8.3)
//
// 연출은 신호 **속성에서만** 파생된다: channelKey 가 시각 언어를, intensity 가 세기를, ttl 이 잔광의 수명을 정한다.
// 별도 연출 스크립트도, 사건별 특수 처리도 없다.
import type { SceneMap, SceneSignal } from "../viewmodel/SceneViewModel";
import { channelStyleOf } from "./palette";
import { toPixel } from "./WorldMapRenderer";
import type { SceneSurface } from "./SceneSurface";

/** 파문의 최대 반지름(px) — intensity 1 일 때 */
const MAX_RIPPLE = 34;

export class SignalRenderer {
  constructor(private readonly surface: SceneSurface) {}

  render(map: SceneMap): void {
    for (const signal of map.signals) this.draw(signal);
  }

  private draw(signal: SceneSignal): void {
    const point = toPixel(this.surface, signal.point);
    const style = channelStyleOf(signal.channelKey);
    const intensity = Math.min(1, Math.max(0, signal.intensity));

    if (style.shape === "ripple") {
      // 파문 — 세기만큼 큰 원 세 겹, 안쪽이 진하다
      for (let ring = 1; ring <= 3; ring++) {
        this.surface.circle({
          x: point.x,
          y: point.y,
          r: (MAX_RIPPLE * intensity * ring) / 3,
          stroke: style.color,
          lineWidth: 1,
          alpha: intensity * (1 - (ring - 1) / 4),
        });
      }
      return;
    }
    if (style.shape === "glow") {
      // 잔광 — 채워진 원 하나
      this.surface.circle({
        x: point.x,
        y: point.y,
        r: MAX_RIPPLE * intensity * 0.6,
        fill: style.color,
        alpha: intensity * 0.45,
      });
      return;
    }
    // 아이콘 — 소문·보고처럼 자리가 아니라 존재가 중요한 채널
    this.surface.text({
      x: point.x + 10,
      y: point.y - 10,
      text: style.glyph,
      size: 10 + intensity * 6,
      fill: style.color,
      alpha: 0.4 + intensity * 0.6,
    });
  }
}
