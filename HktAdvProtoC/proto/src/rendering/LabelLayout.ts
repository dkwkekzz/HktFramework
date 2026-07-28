// 라벨 배치기 — 겹치는 이름표를 위·아래로 밀어 빈 자리를 찾는다 (Phase-8 §8.0)
//
// "어디에 글자를 둘 것인가"는 순수한 표현의 문제이므로 rendering/ 안에서 끝난다.
// 한 프레임마다 새로 만들어 쓴다 — 먼저 놓인 라벨(지역 → 개체 → 사건 순)이 자리를 선점한다.

export interface PlacedLabel {
  x: number;
  y: number;
}

interface LabelRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** ui-monospace 근사 폭 — 한글·한자는 전각(≈size), 나머지는 반각(≈0.62·size) */
function estimateWidth(text: string, size: number): number {
  let width = 0;
  for (const ch of text) width += (ch.codePointAt(0) ?? 0) > 0x2e80 ? size : size * 0.62;
  return width;
}

function intersects(a: LabelRect, b: LabelRect): boolean {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}

/** 앵커에서 시작해 시도하는 세로 밀림 순서 — 가까운 자리부터 */
const OFFSET_STEPS = [0, 1, -1, 2, -2, 3, -3, 4, -4];

export class LabelLayout {
  private readonly placed: LabelRect[] = [];

  constructor(
    private readonly width: number,
    private readonly height: number,
  ) {}

  /**
   * 원하는 자리에 라벨을 놓되, 이미 놓인 라벨과 겹치면 위·아래로 밀어 빈 줄을 찾는다.
   * 화면 밖으로 나가는 라벨은 안쪽으로 끌어온다. 전부 겹치면 원래 자리를 쓴다(라벨은 반드시 그려진다).
   */
  place(x: number, y: number, text: string, size: number, align: "left" | "center" | "right" = "left"): PlacedLabel {
    const w = estimateWidth(text, size);
    const h = size + 3;
    let left = align === "center" ? x - w / 2 : align === "right" ? x - w : x;
    // 화면 밖 방지 — 라벨을 안쪽으로 끌어오고 앵커도 같이 움직인다
    const shift = left < 2 ? 2 - left : left + w > this.width - 2 ? this.width - 2 - (left + w) : 0;
    left += shift;
    const anchorX = x + shift;

    for (const step of OFFSET_STEPS) {
      const candidateY = Math.min(this.height - h / 2, Math.max(h / 2, y + step * (h + 1)));
      const rect: LabelRect = { x: left, y: candidateY - h / 2, w, h };
      if (this.placed.some((entry) => intersects(entry, rect))) continue;
      this.placed.push(rect);
      return { x: anchorX, y: candidateY };
    }
    this.placed.push({ x: left, y: y - h / 2, w, h });
    return { x: anchorX, y };
  }
}
