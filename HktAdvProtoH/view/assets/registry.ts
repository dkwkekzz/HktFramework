// Asset Registry — Semantic Role(:State) 을 절차 생성 스프라이트로 매핑한다.
// 외부 이미지 파일 없이 Canvas 로 그린다 (spriteId → HTMLCanvasElement).

type Painter = (ctx: CanvasRenderingContext2D, size: number) => void;

const SPRITE_SIZE = 128;

function paintPlayer(ctx: CanvasRenderingContext2D, s: number, moving: boolean): void {
  const cx = s / 2;
  // 몸통
  ctx.fillStyle = '#3b6ea5';
  ctx.fillRect(cx - s * 0.1, s * 0.4, s * 0.2, s * 0.35);
  // 머리
  ctx.fillStyle = '#f0c8a0';
  ctx.beginPath();
  ctx.arc(cx, s * 0.3, s * 0.12, 0, Math.PI * 2);
  ctx.fill();
  // 다리 (moving 이면 벌림)
  ctx.strokeStyle = '#2a2a35';
  ctx.lineWidth = s * 0.05;
  ctx.beginPath();
  const spread = moving ? 0.12 : 0.05;
  ctx.moveTo(cx, s * 0.75);
  ctx.lineTo(cx - s * spread, s * 0.95);
  ctx.moveTo(cx, s * 0.75);
  ctx.lineTo(cx + s * spread, s * 0.95);
  ctx.stroke();
  // 곡괭이
  ctx.strokeStyle = '#8a5a2b';
  ctx.lineWidth = s * 0.04;
  ctx.beginPath();
  ctx.moveTo(cx + s * 0.1, s * 0.55);
  ctx.lineTo(cx + s * 0.32, s * 0.25);
  ctx.stroke();
  ctx.strokeStyle = '#9aa0a8';
  ctx.lineWidth = s * 0.05;
  ctx.beginPath();
  ctx.arc(cx + s * 0.32, s * 0.28, s * 0.1, Math.PI * 0.9, Math.PI * 1.9);
  ctx.stroke();
}

function paintDeposit(ctx: CanvasRenderingContext2D, s: number, depleted: boolean): void {
  const rock = depleted ? '#4a4a50' : '#7d8089';
  const vein = depleted ? '#4a4a50' : '#cfd4dc';
  ctx.fillStyle = rock;
  ctx.beginPath();
  ctx.moveTo(s * 0.15, s * 0.9);
  ctx.lineTo(s * 0.3, s * 0.45);
  ctx.lineTo(s * 0.5, s * 0.25);
  ctx.lineTo(s * 0.72, s * 0.5);
  ctx.lineTo(s * 0.85, s * 0.9);
  ctx.closePath();
  ctx.fill();
  if (!depleted) {
    ctx.fillStyle = vein;
    for (const [x, y] of [[0.42, 0.55], [0.55, 0.42], [0.62, 0.65], [0.35, 0.72]]) {
      ctx.beginPath();
      ctx.arc(s * x!, s * y!, s * 0.05, 0, Math.PI * 2);
      ctx.fill();
    }
  } else {
    // 고갈 — 균열 표현
    ctx.strokeStyle = '#2e2e33';
    ctx.lineWidth = s * 0.02;
    ctx.beginPath();
    ctx.moveTo(s * 0.5, s * 0.3);
    ctx.lineTo(s * 0.45, s * 0.6);
    ctx.lineTo(s * 0.55, s * 0.88);
    ctx.stroke();
  }
}

const PAINTERS: Record<string, Painter> = {
  'player-character:idle': (ctx, s) => paintPlayer(ctx, s, false),
  'player-character:moving': (ctx, s) => paintPlayer(ctx, s, true),
  'resource-deposit:available': (ctx, s) => paintDeposit(ctx, s, false),
  'resource-deposit:depleted': (ctx, s) => paintDeposit(ctx, s, true),
};

const cache = new Map<string, HTMLCanvasElement>();

export function spriteCanvas(spriteId: string): HTMLCanvasElement {
  const cached = cache.get(spriteId);
  if (cached) return cached;

  const painter = PAINTERS[spriteId];
  if (!painter) throw new Error(`등록되지 않은 sprite: ${spriteId}`);

  const canvas = document.createElement('canvas');
  canvas.width = SPRITE_SIZE;
  canvas.height = SPRITE_SIZE;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2d context 생성 실패');
  painter(ctx, SPRITE_SIZE);
  cache.set(spriteId, canvas);
  return canvas;
}

export const REGISTERED_SPRITE_IDS = Object.keys(PAINTERS);
