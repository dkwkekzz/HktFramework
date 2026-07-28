// 개체 렌더러 (기획서 §36.2 "이동 중인 주체"·"자원 분포", §42-8 / Phase-8 §8.3)
//
// 마커의 shapeKey 를 도형으로, colorKey 를 색으로 옮기기만 한다 — 개체는 글자가 아니라
// **그림자를 가진 입체 도형**(구체·결정·피라미드·큐브·깃발)으로 보인다.
// 종족·조직이 늘어나도 이 파일은 바뀌지 않는다 — 늘어나는 것은 빌더가 만드는 키와 이 표의 항목이다.
import type { SceneMapMarker, SceneMap, ScenePoint } from "../viewmodel/SceneViewModel";
import { colorOf } from "./palette";
import { toPixel } from "./WorldMapRenderer";
import type { SceneSurface } from "./SceneSurface";

/** shapeKey → 그리기 절차. 항목 추가가 곧 새 외형 추가다 — 빌더·코어에는 diff 가 없다(§8.0) */
type ShapeDrawer = (surface: SceneSurface, p: ScenePoint, s: number, fill: string, alpha: number) => void;

const SHAPES: Record<string, ShapeDrawer> = {
  /** 구체 — 몸통 + 왼쪽 위 하이라이트로 공처럼 보인다 */
  "shape-sphere": (surface, p, s, fill, alpha) => {
    surface.circle({ x: p.x, y: p.y, r: s, fill, stroke: colorOf("marker-rim"), lineWidth: 1.5, alpha });
    surface.circle({
      x: p.x - s * 0.35,
      y: p.y - s * 0.35,
      r: s * 0.3,
      fill: colorOf("marker-highlight"),
      alpha: alpha * 0.45,
    });
  },
  /** 결정 — 다이아 실루엣 + 밝은 왼쪽 면(파셋) */
  "shape-crystal": (surface, p, s, fill, alpha) => {
    const top = { x: p.x, y: p.y - s * 1.25 };
    const right = { x: p.x + s * 0.75, y: p.y };
    const bottom = { x: p.x, y: p.y + s * 1.25 };
    const left = { x: p.x - s * 0.75, y: p.y };
    surface.poly({ points: [top, right, bottom, left], fill, stroke: colorOf("marker-rim"), lineWidth: 1, alpha });
    surface.poly({ points: [top, left, bottom], fill: colorOf("marker-highlight"), alpha: alpha * 0.22 });
  },
  /** 피라미드 — 삼각 실루엣 + 오른쪽 면 음영 */
  "shape-pyramid": (surface, p, s, fill, alpha) => {
    const apex = { x: p.x, y: p.y - s * 1.1 };
    const rightBase = { x: p.x + s, y: p.y + s * 0.75 };
    const leftBase = { x: p.x - s, y: p.y + s * 0.75 };
    surface.poly({ points: [apex, rightBase, leftBase], fill, stroke: colorOf("marker-rim"), lineWidth: 1.5, alpha });
    surface.poly({
      points: [apex, rightBase, { x: p.x, y: p.y + s * 0.75 }],
      fill: colorOf("marker-shadow"),
      alpha: alpha * 0.25,
    });
  },
  /** 큐브 — 정면 + 밝은 윗면의 2.5D */
  "shape-cube": (surface, p, s, fill, alpha) => {
    surface.rect({
      x: p.x - s * 0.6,
      y: p.y - s * 0.3,
      w: s * 1.2,
      h: s * 0.9,
      fill,
      stroke: colorOf("marker-rim"),
      lineWidth: 1,
      alpha,
    });
    surface.poly({
      points: [
        { x: p.x - s * 0.6, y: p.y - s * 0.3 },
        { x: p.x - s * 0.25, y: p.y - s * 0.65 },
        { x: p.x + s * 0.95, y: p.y - s * 0.65 },
        { x: p.x + s * 0.6, y: p.y - s * 0.3 },
      ],
      fill: colorOf("marker-highlight"),
      alpha: alpha * 0.28,
    });
  },
  /** 깃발 — 조직의 거점 표식 */
  "shape-banner": (surface, p, s, fill, alpha) => {
    surface.line({
      from: { x: p.x, y: p.y - s * 1.4 },
      to: { x: p.x, y: p.y + s * 0.6 },
      stroke: colorOf("label"),
      width: 1.5,
      alpha,
    });
    surface.poly({
      points: [
        { x: p.x, y: p.y - s * 1.4 },
        { x: p.x + s * 1.1, y: p.y - s * 1.02 },
        { x: p.x, y: p.y - s * 0.65 },
      ],
      fill,
      stroke: colorOf("marker-rim"),
      lineWidth: 1,
      alpha,
    });
    surface.circle({ x: p.x, y: p.y + s * 0.6, r: s * 0.22, fill: colorOf("label"), alpha });
  },
};

export class EntityRenderer {
  constructor(private readonly surface: SceneSurface) {}

  render(map: SceneMap): void {
    // 자원·장소는 배경 층, 주체는 그 위 — 겹칠 때 사람이 먼저 보인다
    for (const marker of map.places) this.drawMarker(marker, 0.8);
    for (const marker of map.resources) this.drawMarker(marker, 0.9);
    for (const marker of map.markers) this.drawMarker(marker, 1);
  }

  private drawMarker(marker: SceneMapMarker, alpha: number): void {
    const point = toPixel(this.surface, marker.point);
    const size = marker.size * Math.min(this.surface.width, this.surface.height);

    // 이동 중이면 목적지까지 궤적을 남긴다 (§36.2)
    if (marker.moving && marker.moveTo !== undefined) {
      const to = toPixel(this.surface, marker.moveTo);
      this.surface.line({ from: point, to, stroke: colorOf(marker.colorKey), width: 1, alpha: 0.5, dashed: true });
    }

    // 접지 그림자 — 도형이 지도 위에 "서 있게" 한다. 고도가 높을수록 그림자가 멀어진다(§13 음영)
    this.surface.circle({
      x: point.x,
      y: point.y + size * (0.6 + marker.elevationShade * 0.4),
      r: size * 0.75,
      fill: colorOf("marker-shadow"),
      alpha: alpha * 0.35,
    });

    const draw = SHAPES[marker.shapeKey] ?? SHAPES["shape-sphere"];
    draw?.(this.surface, point, size, colorOf(marker.colorKey), alpha);

    // 강조 링 — 조작 중인 주체 등, "지금 이 개체"의 표식
    if (marker.emphasized === true) {
      this.surface.circle({
        x: point.x,
        y: point.y,
        r: size * 1.6,
        stroke: colorOf("marker-highlight"),
        lineWidth: 1.5,
        alpha: 0.85,
      });
    }

    // 상태 게이지 — 수치 해석은 빌더가 끝냈고 여기서는 바 하나를 그린다
    if (marker.gauge !== undefined) {
      const barW = size * 2;
      const barH = Math.max(2.5, size * 0.24);
      const barY = point.y - size * 1.9;
      this.surface.rect({ x: point.x - barW / 2, y: barY, w: barW, h: barH, fill: colorOf("gauge-back"), alpha });
      this.surface.rect({
        x: point.x - barW / 2,
        y: barY,
        w: barW * marker.gauge.value,
        h: barH,
        fill: colorOf(marker.gauge.colorKey),
        alpha,
      });
    }

    // 이름표만 남긴다 — 상태 나열(배지)은 관찰 패널·텍스트 렌더러의 몫이다
    this.surface.text({
      x: point.x,
      y: point.y + size * 1.9,
      text: marker.label,
      size: 10,
      align: "center",
      fill: colorOf("label"),
      alpha: alpha * 0.9,
    });
  }
}
