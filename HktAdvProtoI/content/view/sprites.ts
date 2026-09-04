// Sprite Sheet — 이 팩의 Semantic Role(:State) 절차 생성 픽셀아트 표 (P3 CHANGED).
// 16x16 픽셀 그리드를 문자열로 정의한다 (외부 이미지 파일 없음).
// Canvas 로 그리는 기계장치는 engine/view-kernel/assets/registry.ts 가 소유하며,
// 조립 루트(app)가 이 표를 registerSprites 로 등록한다.

import type { SpriteSheet } from '../../engine/view-kernel/assets/registry';

const PALETTE: Record<string, string> = {
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
  S: '#e8dcbf', // 팻말 판 테두리
  s: '#f6efdc', // 팻말 판 면
  K: '#4a4f58', // 빗장·자물쇠 고리의 쇠 (어두움)
  T: '#f4f1e8', // 백색 거목의 흰 줄기 (볕 쪽)
  t: '#cdc6b6', // 백색 거목의 흰 줄기 (그늘 쪽)
  L: '#9fb98c', // 거목의 잎
  l: '#7e9a6d', // 거목의 잎 가장자리
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

// 곡괭이를 치켜든 자세 — 공격·채굴처럼 "휘두르는" 행동의 절차 그림
const PLAYER_SWING = [
  '.........M......',
  '......HHHMM.....',
  '.....HHHHHW.....',
  '.....hFFFhW.....',
  '.....hFFFW......',
  '......FFFW......',
  '....BBBBBB......',
  '...BBBBBBBB.....',
  '...B.BBBBB.B....',
  '...B.BBBBB.B....',
  '.....bbbb.......',
  '.....bbbb.......',
  '....P....P......',
  '....P....P......',
  '...PP....PP.....',
  '................',
];

// 자율 캐릭터의 기본 그림 — 모션 데이터가 주입되면 그쪽이 우선한다
const WANDERER_IDLE = [
  '................',
  '................',
  '................',
  '.....RRRRR......',
  '...RRrrrrrRR....',
  '..RrrrrrrrrrR...',
  '..Rrr.rrr.rrR...',
  '..RrrrrrrrrrR...',
  '..Rrrr.r.rrrR...',
  '..RrrrrrrrrrR...',
  '.RrrrrrrrrrrrR..',
  '.RrrrrrrrrrrrR..',
  '.dddddddddddddd.',
  '................',
  '................',
  '................',
];

const WANDERER_MOVE = [
  '................',
  '................',
  '................',
  '................',
  '.....RRRRR......',
  '...RRrrrrrRR....',
  '..RrrrrrrrrrR...',
  '..Rrr.rrr.rrR...',
  '..RrrrrrrrrrR...',
  '..Rrrr.r.rrrR...',
  '.RrrrrrrrrrrrR..',
  '.RrrrrrrrrrrrR..',
  '.RrrrrrrrrrrrR..',
  '.dddddddddddddd.',
  '................',
  '................',
];

const WANDERER_ATTACK = [
  '................',
  '................',
  '.....MMMMM......',
  '...MMrrrrrMM....',
  '..MrrrrrrrrrM...',
  '..Mrr.rrr.rrM...',
  '..MrrrrrrrrrM...',
  '..Mrrr.r.rrrM...',
  '..MrrrrrrrrrM...',
  '.MrrrrrrrrrrrM..',
  '.MrrrrrrrrrrrM..',
  '.MrrrrrrrrrrrM..',
  '.eeeeeeeeeeeeee.',
  '................',
  '................',
  '................',
];

// 뒤로 젖혀진 자세 — 맞았을 때의 절차 그림 (hit)
const PLAYER_STAGGER = [
  '................',
  '.......HHH......',
  '......HHHHH.....',
  '......hFFFh.M...',
  '.......FFF.MM...',
  '....BBBBBB.W....',
  '...BBBBBBBW.....',
  '..B..BBBBB......',
  '..B..BBBB.......',
  '.....bbbb.......',
  '....bbbb........',
  '....P...P.......',
  '...P.....P......',
  '...P......P.....',
  '..PP......PP....',
  '................',
];

const WANDERER_HIT = [
  '................',
  '................',
  '................',
  '................',
  '......ddddd.....',
  '....ddrrrrrdd...',
  '...drrrrrrrrrd..',
  '...drr.rrr.rrd..',
  '...drrrrrrrrrd..',
  '...drrr.r.rrrd..',
  '..drrrrrrrrrrrd.',
  '..drrrrrrrrrrrd.',
  '..eeeeeeeeeeeee.',
  '................',
  '................',
  '................',
];

// 방의 출구 표식 (C001) — 팻말 하나. 글자가 없다: 목적지 이름은 실리지 않는다.
// 전이 종류별 색은 tint 로 곱해지므로 여기는 밝은 바탕으로 둔다 (S · W).
const REGION_EXIT_OPEN = [
  '................',
  '....SSSSSSSSS...',
  '...SSssssssssSS.',
  '...SsssssssssssS',
  '...SSssssssssSS.',
  '....SSSSSSSSS...',
  '.......WW.......',
  '.......WW.......',
  '.......WW.......',
  '.......WW.......',
  '.......WW.......',
  '.......WW.......',
  '.......WW.......',
  '......hWWh......',
  '.....dhhhhd.....',
  '................',
];

// 닫힌 출구 표식 (C002) — 같은 팻말에 **빗장이 가로지르고 자물쇠가 걸려 있다**.
// 열린 표식과 실루엣부터 다르다: 판을 관통하는 가로 쇠막대 하나 + 자루에 걸린 자물쇠.
// 여기에도 글자는 없다 — 잠겼다는 것만 보이고 그 너머가 어디인지는 여전히 실리지 않는다.
const REGION_EXIT_LOCKED = [
  '................',
  '....SSSSSSSSS...',
  '...SSssssssssSS.',
  'KKKKKKKKKKKKKKKK',
  '...SSssssssssSS.',
  '....SSSSSSSSS...',
  '.......WW.......',
  '......KKKK......',
  '.....KKWWKK.....',
  '....MMMMMMMM....',
  '....MMMKKMMM....',
  '....MMMMKMMM....',
  '....MMMMMMMM....',
  '......hWWh......',
  '.....dhhhhd.....',
  '................',
];

// 백색 거목 (C006) — L2-World-Concept §3 의 정식 이름. **흰 줄기**가 이 그림의 전부다:
// 팻말(S·s)이나 바위(R·r)와 실루엣이 아니라 **색**부터 갈려야 한다 — 방 어디서 보아도
// "저것이 그 나무" 로 읽히는 것이 이 표식의 일이다 (Concept §3: 백색 거목 → 포식자가 접근하지 않음).
//
// 줄기를 화면 왼쪽이 볕(T) · 오른쪽이 그늘(t)로 갈라 원기둥으로 서게 하고, 밑동에서 두 칸씩
// 벌려 뿌리가 땅을 붙든 것으로 읽히게 했다 — 표식이 지면에 *꽂힌* 것이 아니라 *자란* 것으로
// 보여야 한다. 잎은 은녹색이다: 지면의 평지 색(0x4e7a3e)보다 밝고 채도가 낮아 위에서 내려다볼 때
// 땅에 묻히지 않으면서, 흰 줄기의 주인공 자리를 뺏지 않는다.
//
// 줄기·잎이 16px 폭의 절반 남짓만 쓰는 것은 뜻이 있다 — terrain-presentation 이 이 그림을
// 정사각 worldHeight(17)로 세우므로, 폭까지 꽉 채우면 도시와 조건 area 를 그림이 덮는다.
const WHITE_GIANT_TREE = [
  '......lLLl......',
  '....llLLLLll....',
  '...lLLLLLLLLl...',
  '..lLLLLLLLLLLl..',
  '..lLLLLLLLLLLl..',
  '..lLLLLLLLLLLl..',
  '...lLLLLLLLLl...',
  '....llLLLLll....',
  '......TTtt......',
  '......TTtt......',
  '......TTtt......',
  '......TTtt......',
  '......TTtt......',
  '.....TTTttt.....',
  '....TTTTtttt....',
  '..TTTTTTtttttt..',
];

const PIXEL_MAPS: Record<string, string[]> = {
  'region-exit:open': REGION_EXIT_OPEN,
  'region-exit:locked': REGION_EXIT_LOCKED,
  'player-pickaxe:idle': PLAYER_IDLE,
  'player-pickaxe:move': PLAYER_MOVING,
  'player-pickaxe:moving': PLAYER_MOVING, // 예전 이름 — 계속 유효하다
  'player-pickaxe:attack': PLAYER_SWING,
  'player-pickaxe:mine': PLAYER_SWING,
  'player-pickaxe:hit': PLAYER_STAGGER,
  'wanderer:idle': WANDERER_IDLE,
  'wanderer:move': WANDERER_MOVE,
  'wanderer:attack': WANDERER_ATTACK,
  'wanderer:hit': WANDERER_HIT,
  // 땅에 서는 표식 — 존재가 아니라 지형 instance 다 (역할:상태 가 아니라 layer:이름 으로 부른다)
  'landmark:white-giant-tree': WHITE_GIANT_TREE,
  'stone-deposit:available': DEPOSIT_AVAILABLE,
  'stone-deposit:depleted': DEPOSIT_DEPLETED,
};

/** 이 팩의 스프라이트 표 — 조립 루트가 engine 의 registerSprites 에 넘긴다 */
export const SPRITE_SHEET: SpriteSheet = { palette: PALETTE, maps: PIXEL_MAPS };

export const REGISTERED_SPRITE_IDS = Object.keys(PIXEL_MAPS);
