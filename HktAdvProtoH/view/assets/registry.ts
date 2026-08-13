// Asset Registry — Semantic Role(:State) 을 절차 생성 픽셀아트 스프라이트로 매핑한다.
// 16x16 픽셀 그리드를 문자열로 정의하고 Canvas 에 그린다 (외부 이미지 파일 없음).

const PALETTE: Record<string, string> = {
  '?': '#c0397a', // 미등록 역할 대체 표현
  '#': '#f2f4f8',
  H: '#6b4a2b', // 머리카락
  h: '#5a3d22',
  F: '#f0c8a0', // 피부
  B: '#3d6fb4', // 셔츠
  b: '#325c96',
  P: '#2a2a35', // 바지·윤곽
  W: '#8a5a2b', // 곡괭이 자루
  M: '#b8bec8', // 곡괭이 날
  R: '#8d919b', // 바위 밝음
  r: '#6f737d', // 바위 중간
  d: '#55585f', // 바위 어두움
  D: '#3f4147', // 고갈 바위
  e: '#33343a',
  '.': '',
};

const PLAYER_IDLE = [
  '......HHH.......',
  '.....HHHHH...M..',
  '.....hFFFh..MM..',
  '.....hFFFh...W..',
  '......FFF...W...',
  '....BBBBBB.W....',
  '...BBBBBBBWW....',
  '...B.BBBBW.B....',
  '...B.BBBB..B....',
  '.....bbbb.......',
  '.....bbbb.......',
  '.....P..P.......',
  '.....P..P.......',
  '.....P..P.......',
  '....PP..PP......',
  '................',
];

const PLAYER_MOVING = [
  '......HHH.......',
  '.....HHHHH...M..',
  '.....hFFFh..MM..',
  '.....hFFFh...W..',
  '......FFF...W...',
  '....BBBBBB.W....',
  '...BBBBBBBWW....',
  '...B.BBBBW.B....',
  '...B.BBBB..B....',
  '.....bbbb.......',
  '.....bbbb.......',
  '....P....P......',
  '....P....P......',
  '...P......P.....',
  '..PP......PP....',
  '................',
];

const DEPOSIT_AVAILABLE = [
  '................',
  '................',
  '................',
  '......RRr.......',
  '.....RRRrr......',
  '....RRrRrrr.....',
  '....RrrrrrdRR...',
  '...RRrRrrrdRRr..',
  '...RrrrrdrrRrr..',
  '..RRrrRrrrrrrd..',
  '..Rrrrrrdrrrrd..',
  '..rrrdrrrrdrrd..',
  '.rrrrrrrrrrrrdd.',
  '.dddddddddddddd.',
  '................',
  '................',
];

const DEPOSIT_DEPLETED = [
  '................',
  '................',
  '................',
  '................',
  '................',
  '......DD........',
  '.....DDDe.......',
  '....DDeDDD......',
  '...DDDDeDDe.....',
  '...DeDDDDDDe....',
  '..DDDDeDDDeDD...',
  '..DeDDDDeDDDe...',
  '.DDDDeDDDDDeDD..',
  '.eeeeeeeeeeeee..',
  '................',
  '................',
];

// 미등록 역할용 대체 표현 — 엔진은 모르는 world 를 만나도 멈추지 않고 이것을 그린다
const PLACEHOLDER = [
  '................',
  '..??????????????',
  '..?############?',
  '..?#..######..#?',
  '..?#.######.#.#?',
  '..?#.#####.##.#?',
  '..?#.####.###.#?',
  '..?#.###.####.#?',
  '..?#.##..#####.?',
  '..?#.##.######.?',
  '..?#.##.######.?',
  '..?#....######.?',
  '..?#.##.######.?',
  '..?############?',
  '..??????????????',
  '................',
];

export const PLACEHOLDER_SPRITE = 'unknown-role';

const PIXEL_MAPS: Record<string, string[]> = {
  [PLACEHOLDER_SPRITE]: PLACEHOLDER,
  'player-character:idle': PLAYER_IDLE,
  'player-character:moving': PLAYER_MOVING,
  'resource-deposit:available': DEPOSIT_AVAILABLE,
  'resource-deposit:depleted': DEPOSIT_DEPLETED,
};

// 역할별 표시 크기 — 에셋 데이터일 뿐 게임 로직이 아니다. 모르는 역할은 기본값으로 그린다.
const ROLE_SCALE: Record<string, number> = {
  'player-character': 2.6,
  'resource-deposit': 3.4,
};
const DEFAULT_ROLE_SCALE = 3.0;

/** 등록된 에셋인가 — 없으면 호출자가 대체 표현을 고른다 */
export function hasSprite(spriteId: string): boolean {
  return spriteId in PIXEL_MAPS;
}

/** 스프라이트 키(`role` 또는 `role:state`) 의 표시 크기 */
export function spriteScale(spriteId: string): number {
  const role = spriteId.split(':')[0] ?? spriteId;
  return ROLE_SCALE[role] ?? DEFAULT_ROLE_SCALE;
}

const SCALE = 8; // 16px 그리드 → 128px 캔버스 (Nearest 필터로 픽셀 느낌 유지)
const cache = new Map<string, HTMLCanvasElement>();

export function spriteCanvas(spriteId: string): HTMLCanvasElement {
  const cached = cache.get(spriteId);
  if (cached) return cached;

  // 모르는 키가 와도 멈추지 않는다 — 대체 표현을 그린다 (어떤 world 라도 그린다는 뜻)
  const map = PIXEL_MAPS[spriteId] ?? PIXEL_MAPS[PLACEHOLDER_SPRITE];
  if (!map) throw new Error('대체 스프라이트가 등록되어 있지 않다');

  const canvas = document.createElement('canvas');
  canvas.width = 16 * SCALE;
  canvas.height = 16 * SCALE;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2d context 생성 실패');

  map.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const color = PALETTE[row[x] ?? '.'];
      if (!color) continue;
      ctx.fillStyle = color;
      ctx.fillRect(x * SCALE, y * SCALE, SCALE, SCALE);
    }
  });

  cache.set(spriteId, canvas);
  return canvas;
}

export const REGISTERED_SPRITE_IDS = Object.keys(PIXEL_MAPS);
