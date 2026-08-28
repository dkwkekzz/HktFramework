// Asset Registry — spriteId 를 절차 생성 픽셀아트 Canvas 로 그리는 기계장치.
//
// P3 CHANGED — 어떤 그림들이 있는지(팔레트·픽셀 그리드 표)는 컨텐츠 팩이 소유하고,
// 조립 루트(app)가 registerSprites 로 등록한다. 여기는 그리는 방법과
// 미등록 spriteId 의 placeholder 만 소유한다 — 새 Cycle 의 role 이 아직 등록되지
// 않아도 게임이 멈추지 않고 일단 그려진다 (엔진의 "그대로 그린다" 성질).

/** 팩이 등록하는 스프라이트 표 — 16x16 문자열 그리드와 문자별 색 */
export interface SpriteSheet {
  palette: Record<string, string>;
  maps: Record<string, string[]>;
}

let registered: SpriteSheet = { palette: {}, maps: {} };

export function registerSprites(sheet: SpriteSheet): void {
  registered = sheet;
  cache.clear();
}

// 미등록 spriteId 용 placeholder — 물음표 액자. 색은 엔진 자신의 것이다.
const PLACEHOLDER_PALETTE: Record<string, string> = {
  M: '#b8bec8',
  e: '#33343a',
  '.': '',
};

const PLACEHOLDER = [
  '................',
  '.MMMMMMMMMMMMM..',
  '.M..........eM..',
  '.M.ee....ee.eM..',
  '.M.ee....ee.eM..',
  '.M..........eM..',
  '.M..........eM..',
  '.M....ee....eM..',
  '.M...e..e...eM..',
  '.M..e....e..eM..',
  '.M..........eM..',
  '.MeeeeeeeeeeeM..',
  '.MMMMMMMMMMMMM..',
  '................',
  '................',
  '................',
];

const SCALE = 8; // 16px 그리드 → 128px 캔버스 (Nearest 필터로 픽셀 느낌 유지)
const cache = new Map<string, HTMLCanvasElement>();

export function spriteCanvas(spriteId: string): HTMLCanvasElement {
  const cached = cache.get(spriteId);
  if (cached) return cached;

  const map = registered.maps[spriteId] ?? PLACEHOLDER;
  const palette = registered.maps[spriteId] ? registered.palette : PLACEHOLDER_PALETTE;

  const canvas = document.createElement('canvas');
  canvas.width = 16 * SCALE;
  canvas.height = 16 * SCALE;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2d context 생성 실패');

  map.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const color = palette[row[x] ?? '.'];
      if (!color) continue;
      ctx.fillStyle = color;
      ctx.fillRect(x * SCALE, y * SCALE, SCALE, SCALE);
    }
  });

  cache.set(spriteId, canvas);
  return canvas;
}
