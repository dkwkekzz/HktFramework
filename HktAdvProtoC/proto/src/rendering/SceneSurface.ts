// 그리기 표면 (기획서 §37 rendering / Phase-8 §8.0)
//
// 렌더러는 Canvas 를 직접 만지지 않고 이 표면의 동사만 쓴다. 두 가지를 얻는다.
//  ① 표현 방식 교체가 이 파일 뒤로 격리된다 — Canvas → SVG → 3D 로 바뀌어도 렌더러는 그대로다.
//  ② 화면 없이 검증할 수 있다 — 기록 표면(RecordingSurface)에 같은 그림을 그려 눈으로 확인한다(§8 DoD).
//
// **이 디렉터리의 파일은 SceneViewModel 밖의 타입을 import 하지 않는다**(린트로 강제).
// Canvas 를 아는 유일한 자리는 이 파일의 createCanvasSurface 뿐이다.

export interface SurfaceRect {
  x: number;
  y: number;
  w: number;
  h: number;
  fill?: string;
  stroke?: string;
  lineWidth?: number;
  alpha?: number;
}

export interface SurfaceLine {
  from: { x: number; y: number };
  to: { x: number; y: number };
  stroke: string;
  width?: number;
  alpha?: number;
  dashed?: boolean;
}

export interface SurfaceCircle {
  x: number;
  y: number;
  r: number;
  fill?: string;
  stroke?: string;
  lineWidth?: number;
  alpha?: number;
}

export interface SurfacePoly {
  points: { x: number; y: number }[];
  fill?: string;
  stroke?: string;
  lineWidth?: number;
  alpha?: number;
}

export interface SurfaceText {
  x: number;
  y: number;
  text: string;
  fill?: string;
  size?: number;
  align?: "left" | "center" | "right";
  alpha?: number;
}

/** 렌더러가 쓸 수 있는 그리기 동사 전부 */
export interface SceneSurface {
  readonly width: number;
  readonly height: number;
  clear(): void;
  rect(spec: SurfaceRect): void;
  line(spec: SurfaceLine): void;
  circle(spec: SurfaceCircle): void;
  poly(spec: SurfacePoly): void;
  text(spec: SurfaceText): void;
}

// --- 기록 표면 ------------------------------------------------------------------------

export interface SurfaceOp {
  op: "clear" | "rect" | "line" | "circle" | "poly" | "text";
  detail: Record<string, unknown>;
}

/**
 * 그린 것을 그대로 적어 두는 표면.
 * "무엇이 화면에 실렸는가"를 브라우저 없이 판정하기 위한 것이다 — 눈 검증의 기계 대응물.
 */
export class RecordingSurface implements SceneSurface {
  readonly ops: SurfaceOp[] = [];

  constructor(
    readonly width = 800,
    readonly height = 600,
  ) {}

  clear(): void {
    this.ops.push({ op: "clear", detail: {} });
  }

  rect(spec: SurfaceRect): void {
    this.ops.push({ op: "rect", detail: { ...spec } });
  }

  line(spec: SurfaceLine): void {
    this.ops.push({ op: "line", detail: { ...spec } });
  }

  circle(spec: SurfaceCircle): void {
    this.ops.push({ op: "circle", detail: { ...spec } });
  }

  poly(spec: SurfacePoly): void {
    this.ops.push({ op: "poly", detail: { ...spec } });
  }

  text(spec: SurfaceText): void {
    this.ops.push({ op: "text", detail: { ...spec } });
  }

  /** 화면에 실린 문자열 전부 — 라벨 누락 판정에 쓴다 */
  texts(): string[] {
    return this.ops.filter((entry) => entry.op === "text").map((entry) => String(entry.detail["text"]));
  }

  countOf(op: SurfaceOp["op"]): number {
    return this.ops.filter((entry) => entry.op === op).length;
  }
}

// --- Canvas 표면 ----------------------------------------------------------------------

/** Canvas 2D 를 아는 유일한 자리. 다른 표현으로 갈아탈 때 교체되는 것도 이 함수 하나다. */
export function createCanvasSurface(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
): SceneSurface {
  const withAlpha = (alpha: number | undefined, draw: () => void): void => {
    if (alpha === undefined) {
      draw();
      return;
    }
    const previous = context.globalAlpha;
    context.globalAlpha = alpha;
    draw();
    context.globalAlpha = previous;
  };

  return {
    width,
    height,
    clear: () => {
      context.clearRect(0, 0, width, height);
    },
    rect: (spec) =>
      withAlpha(spec.alpha, () => {
        if (spec.fill !== undefined) {
          context.fillStyle = spec.fill;
          context.fillRect(spec.x, spec.y, spec.w, spec.h);
        }
        if (spec.stroke !== undefined) {
          context.strokeStyle = spec.stroke;
          context.lineWidth = spec.lineWidth ?? 1;
          context.strokeRect(spec.x, spec.y, spec.w, spec.h);
        }
      }),
    line: (spec) =>
      withAlpha(spec.alpha, () => {
        context.strokeStyle = spec.stroke;
        context.lineWidth = spec.width ?? 1;
        context.setLineDash(spec.dashed === true ? [4, 4] : []);
        context.beginPath();
        context.moveTo(spec.from.x, spec.from.y);
        context.lineTo(spec.to.x, spec.to.y);
        context.stroke();
        context.setLineDash([]);
      }),
    circle: (spec) =>
      withAlpha(spec.alpha, () => {
        context.beginPath();
        context.arc(spec.x, spec.y, Math.max(0.5, spec.r), 0, Math.PI * 2);
        if (spec.fill !== undefined) {
          context.fillStyle = spec.fill;
          context.fill();
        }
        if (spec.stroke !== undefined) {
          context.strokeStyle = spec.stroke;
          context.lineWidth = spec.lineWidth ?? 1;
          context.stroke();
        }
      }),
    poly: (spec) =>
      withAlpha(spec.alpha, () => {
        const first = spec.points[0];
        if (first === undefined) return;
        context.beginPath();
        context.moveTo(first.x, first.y);
        for (const point of spec.points.slice(1)) context.lineTo(point.x, point.y);
        context.closePath();
        if (spec.fill !== undefined) {
          context.fillStyle = spec.fill;
          context.fill();
        }
        if (spec.stroke !== undefined) {
          context.strokeStyle = spec.stroke;
          context.lineWidth = spec.lineWidth ?? 1;
          context.stroke();
        }
      }),
    text: (spec) =>
      withAlpha(spec.alpha, () => {
        context.fillStyle = spec.fill ?? "#222";
        context.font = `${spec.size ?? 11}px ui-monospace, monospace`;
        context.textAlign = spec.align ?? "left";
        context.textBaseline = "middle";
        context.fillText(spec.text, spec.x, spec.y);
      }),
  };
}
