// 절차 생성 픽셀 스프라이트 — cycles/C002/gameview/asset_bindings.yaml 의 Asset Catalog.
// 외부 아트 리소스 없이 canvas 2D 로 그린다. World 의미와 무관한 표현 자유 영역.

export interface SpriteSource {
  canvas: HTMLCanvasElement;
  pixelWidth: number;
  pixelHeight: number;
}

const SCALE = 8; // 픽셀 아트 확대 배율

function makeCanvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const canvas = document.createElement('canvas');
  canvas.width = w * SCALE;
  canvas.height = h * SCALE;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  return [canvas, ctx];
}

function px(ctx: CanvasRenderingContext2D, x: number, y: number, color: string): void {
  ctx.fillStyle = color;
  ctx.fillRect(x * SCALE, y * SCALE, SCALE, SCALE);
}

function rect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  color: string,
): void {
  for (let ix = 0; ix < w; ix++) for (let iy = 0; iy < h; iy++) px(ctx, x + ix, y + iy, color);
}

// 곡괭이 든 캐릭터 — 16x20. swing=true 면 곡괭이를 치켜든 프레임.
function drawCharacter(swing: boolean): SpriteSource {
  const W = 16;
  const H = 20;
  const [canvas, ctx] = makeCanvas(W, H);

  const skin = '#e8b88a';
  const hair = '#5a3a22';
  const shirt = '#3f6fb5';
  const pants = '#54432f';
  const boots = '#2e2620';
  const wood = '#8a6238';
  const iron = '#b8bec6';

  // 머리
  rect(ctx, 6, 1, 4, 1, hair);
  rect(ctx, 5, 2, 6, 2, hair);
  rect(ctx, 5, 4, 6, 3, skin);
  px(ctx, 6, 5, '#222');
  px(ctx, 9, 5, '#222');
  // 몸통
  rect(ctx, 5, 7, 6, 5, shirt);
  // 팔 (왼팔 고정, 오른팔은 곡괭이 방향)
  rect(ctx, 4, 7, 1, 4, skin);
  // 다리
  rect(ctx, 5, 12, 2, 4, pants);
  rect(ctx, 9, 12, 2, 4, pants);
  rect(ctx, 5, 16, 2, 2, boots);
  rect(ctx, 9, 16, 2, 2, boots);

  if (swing) {
    // 치켜든 오른팔 + 머리 위 곡괭이
    rect(ctx, 11, 5, 1, 3, skin);
    rect(ctx, 12, 1, 1, 5, wood);
    rect(ctx, 10, 0, 5, 1, iron);
    px(ctx, 10, 1, iron);
    px(ctx, 14, 1, iron);
  } else {
    // 내린 오른팔 + 어깨에 걸친 곡괭이
    rect(ctx, 11, 7, 1, 4, skin);
    rect(ctx, 12, 4, 1, 6, wood);
    rect(ctx, 11, 3, 4, 1, iron);
    px(ctx, 14, 4, iron);
  }
  return { canvas, pixelWidth: W, pixelHeight: H };
}

// 광맥(돌무더기) — 18x14. depleted=true 면 회색·부서진 변형.
function drawDeposit(depleted: boolean): SpriteSource {
  const W = 18;
  const H = 14;
  const [canvas, ctx] = makeCanvas(W, H);

  const base = depleted ? '#6d6d6d' : '#8f8f98';
  const dark = depleted ? '#4f4f4f' : '#6a6a74';
  const light = depleted ? '#8a8a8a' : '#b9b9c2';
  const ore = depleted ? '#7a7a7a' : '#e8e4d2';

  // 바위 덩어리들
  rect(ctx, 2, 8, 6, 5, base);
  rect(ctx, 7, 6, 7, 7, base);
  rect(ctx, 5, 3, 6, 5, base);
  rect(ctx, 12, 9, 5, 4, dark);
  // 하이라이트
  rect(ctx, 6, 4, 2, 1, light);
  rect(ctx, 9, 7, 2, 1, light);
  if (!depleted) {
    // 박힌 원석 반짝임
    px(ctx, 7, 6, ore);
    px(ctx, 10, 9, ore);
    px(ctx, 4, 10, ore);
    px(ctx, 13, 10, ore);
  } else {
    // 부서진 틈
    px(ctx, 8, 5, '#333');
    px(ctx, 8, 6, '#333');
    px(ctx, 9, 10, '#333');
    rect(ctx, 3, 12, 12, 1, '#3c3c3c');
  }
  return { canvas, pixelWidth: W, pixelHeight: H };
}

// 텍스트 라벨 스프라이트 (남은 자원량 등)
export function drawLabel(text: string): SpriteSource {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 64;
  const ctx = canvas.getContext('2d')!;
  ctx.font = 'bold 28px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  const w = Math.min(240, ctx.measureText(text).width + 24);
  ctx.beginPath();
  ctx.roundRect((256 - w) / 2, 12, w, 40, 10);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.fillText(text, 128, 33);
  return { canvas, pixelWidth: 256, pixelHeight: 64 };
}

export const sprites = {
  characterIdle: (): SpriteSource => drawCharacter(false),
  characterSwing: (): SpriteSource => drawCharacter(true),
  depositFull: (): SpriteSource => drawDeposit(false),
  depositDepleted: (): SpriteSource => drawDeposit(true),
};
