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
  // 미로의 식물 넷 (C008) — 구역의 이름표다. 색은 그 구역 바닥 zone 과 같은 값 계열이고
  // (region-presentation 의 CELL_ZONE_PRESENTATIONS), 밝은 쪽/그늘 쪽 두 값으로 입체를 준다.
  // 셋은 색상(hue)으로 갈리고 넷째는 색을 버리고 밝기로 갈린다 — 미로의 지면(어두운 초록)과
  // 방 바닥(어두운 보라) 어느 쪽과도 겹치지 않는 남은 자리가 그것뿐이기 때문이다
  // (SURFACE_COLORS 의 steep 가 무채색으로 나간 것과 같은 어법).
  a: '#4fd6cc', // A 구역의 식물 — 청록 (볕)
  A: '#237f79', // 청록 (그늘)
  n: '#ef86bb', // B 구역의 식물 — 자홍 (볕)
  N: '#8f3364', // 자홍 (그늘)
  o: '#f5b45c', // C 구역의 식물 — 호박 (볕)
  O: '#9a6220', // 호박 (그늘)
  y: '#f2e8cf', // D 구역의 식물 — 상아 (볕)
  Y: '#8b8064', // 상아 (그늘)
  v: '#2b2438', // 식물 넷의 공통 밑동 — 어디에 서든 지면에 닿는 그늘 한 줄
  // 재료 원천 넷의 색 (C011) — **두 계통을 색으로 먼저 가른다**: 생체 광석은 붉고(C·c·G),
  // 광식충 허물은 옅은 껍질색이다(m·k). 허물에 붉은 결 한 점(x)만 남겨 둔 것은 같은
  // 계통이라는 것이 색에서도 한 번 읽히게 하려는 것이다 (Play §4 의 추측).
  C: '#f2684a', // 생체 광석의 결정면 (볕) — 이 세계에서 가장 붉다
  c: '#a83526', // 생체 광석의 결정 (그늘)
  G: '#5b2118', // 광석의 가장 깊은 결 — 땅에 닿는 밑동
  m: '#dcc6a6', // 광식충 허물의 껍질 (볕) — 광석보다 옅다
  k: '#a89076', // 허물의 껍질 (그늘)
  x: '#c07a5c', // 허물에 남은 옅은 붉은 결
  u: '#7b5a39', // 나무 밑동·뿌리 (볕)
  U: '#523c26', // 나무 밑동·뿌리 (그늘)
  // 고갈된 원천의 두 색 (C012) — 있던 것이 없어진 자리의 색이다
  q: '#1b1a1f', // 파인 자리의 바닥 — 빛이 닿지 않는 구덩이 속 (이 표에서 가장 어둡다)
  g: '#8f8577', // 마른 빈 껍질의 속 — 터진 뿌리혹에 남은 것. 붉은 기가 빠진 값이다
  // 되돌아오는 중인 원천의 두 색 (C013) — **붉은 것이 일부만 돌아온** 값이다.
  // 남아 있는 것(C·c)보다 옅고 바닥난 것(붉은 기가 없다)보다 짙다 — 색 하나만 보아도
  // "다 온 것은 아니다" 가 읽힌다 (spec §5.6 예보 · SPEC-003).
  i: '#c05a44', // 다시 도는 결정·살 (볕)
  I: '#7e3a2c', // 다시 도는 결정·살 (그늘)
  // 원천 셋의 색 (C014) — **붉기의 사다리에 두 마디가 끼어든다**: 노두(C·c)가 여전히 가장
  // 붉고, 호수의 침전(E·X)이 그 다음이며, 물에 갈린 어귀의 알갱이(Q·p)가 가장 무디다
  // (D2 생체 광석 ③ "물에 갈리면 붉은빛을 잃는다"). 같은 재료의 세 순도가 색 하나로 읽힌다.
  // 거목균만은 이 사다리 밖이다 — 흰 균사이고, 붉어지는 것은 그것이 삭인 흙이다 (D2 거목균 ②).
  w: '#eef1e8', // 사체 위 흰 균사 (볕) — 백색 거목의 흰 줄기(T) 계열이되 살짝 눅눅하다
  z: '#b6bcaa', // 흰 균사 (그늘)
  j: '#3f342c', // 사체의 삭은 가죽 — 나무 밑동(U)보다 어둡고 붉은 기가 없다
  J: '#a89a84', // 사체에 드러난 뼈 — 마른 빈 껍질(g)의 밝은 쪽
  V: '#5f8f99', // 물빛 (얕은 쪽 · 볕) — 셔츠의 파랑(B)과 갈리도록 청록으로 눕혔다
  Z: '#31555f', // 물빛 (깊은 쪽 · 그늘)
  E: '#a35b46', // 호수 바닥의 침전 (볕) — 노두(C)만큼 붉지 않고 탁하다
  X: '#6b3527', // 침전 (그늘) — 결정의 그늘(c)과 가장 깊은 결(G) 사이
  Q: '#cba792', // 물에 갈린 알갱이 (볕) — 허물 껍질(m)보다 붉은 기가 조금 남았을 뿐이다
  p: '#96745f', // 갈린 알갱이 (그늘)
  f: '#6f6152', // 어귀의 젖은 퇴적선 — 물이 물러난 자리의 축축한 바닥
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

// ── 재료의 원천 넷 (C011) ────────────────────────────────────────────
//
// 광맥 하나(stone-deposit)가 서 있던 자리를 대신한다. 넷은 같은 role('resource-source')
// 이므로 **그림이 유일한 구분**이다 — 세계 위에 이름표가 없고(C026 R4 · spec SPEC-008)
// 색으로만 갈라 두면 두 계통이 두 덩어리로 뭉쳐 보인다.
//
// 그래서 넷을 **실루엣부터** 갈랐다 (미로의 식물 넷이 두 축으로 갈린 것과 같은 어법).
//   흩어진 조각들(낮고 넓다) · 프레임을 두른 더미(인공물이 꽂혀 있다) ·
//   뾰족한 결정 무리(높고 각지다) · 굵은 뿌리에 달린 혹(둥근 덩이 하나)
// 짙기도 갈린다 — 노두가 가장 붉고, 허물이 가장 옅다 (D2 "광석보다 옅다").
//
// 남은 양을 그림이 말하지 않는다 — 몇 번 남았는지는 실려 오지 않는다. C012 부터 state 가
// 둘이 되므로(available · depleted) 형태마다 그림이 둘이고, 그 둘의 차이가 곧 자국이다.

// 나무 밑동에 흩어진 껍질 조각 — 서 있는 것이 아니라 **깔려 있다**. 넷 가운데 가장 낮고 넓다
const SOURCE_MOLT_LITTER = [
  '................',
  '................',
  '...uuuuuu.......',
  '..uUuuuuUu......',
  '..uUuuuuUu...m..',
  '..uUuuuuUu..mkx.',
  '..uUuuuuUu..mmk.',
  '..uuuuuuuu...kk.',
  '.uUUuuuuUUu.....',
  '...mkx..........',
  '..mmk.....mkx...',
  '..mkk....mmkk...',
  '.......mkx......',
  '..mk..mmkk......',
  '..kk...mkk..mk..',
  '................',
];

// 헐린 선광 더미 — 돌무더기에 **사람이 두고 간 것**이 섞였다: 부러진 삽 하나가 꽂혀 있고
// 나무틀이 더미를 두르고 있다. 자연 형태 넷 가운데 유일하게 직선(틀)을 가진 실루엣이다
const SOURCE_SPOIL_PILE = [
  '................',
  '.........W......',
  '........W.......',
  '.......W........',
  '......MM........',
  '.....MMM..R.....',
  '....RrMd.Rrr....',
  '...RrrrdrrrrR...',
  '..RrrdrrrxrrrR..',
  '..RrrrrdrrrrrR..',
  '.RrrdrrrrrdrrrR.',
  '.WWWWWWWWWWWWWW.',
  '.W.rrrdrrrrrr.W.',
  '.W.dddddddddd.W.',
  '.WWWWWWWWWWWWWW.',
  '................',
];

// 광맥의 노두 — 땅을 뚫고 솟은 결정 무리. 넷 가운데 가장 높고 가장 각지고 **가장 붉다**
const SOURCE_OUTCROP = [
  '................',
  '.......C........',
  '......CCc.......',
  '..C...CCc.......',
  '.CCc..CCCc...C..',
  '.CCc.CCCCc..CCc.',
  '.CCc.CCcCc..CCc.',
  'cCCc.CCcCcc.CCcc',
  'cCCccCCcCcc.CCcc',
  'cCCcCCCcCCccCCcc',
  'cGCcCGCcCGccGCcc',
  '.cGGcGGcGGccGGc.',
  '..cGGGGGGGGGGc..',
  '...cGGGGGGGGc...',
  '....GGGGGGGG....',
  '................',
];

// 거목의 부푼 뿌리혹 — 굵은 뿌리 하나가 비스듬히 내려와 **둥근 덩이 하나**로 부풀었다.
// 각진 노두와 정반대의 실루엣이고, 붉은 것이 광석이 아니라 살아 있는 것에 붙어 있다
const SOURCE_ROOT_NODULE = [
  '................',
  '..u.............',
  '..uU............',
  '..uU............',
  '..uUu...........',
  '..uuUu..........',
  '...uuUuu........',
  '....uuUCCc......',
  '.....uCCCCCc....',
  '....CCCCCCCCc...',
  '...CCCCCcCCCCc..',
  '...CCCcCCCcCCc..',
  '...cCCCCCCCcCc..',
  '....cCCCCCCcuUu.',
  '.....ccCCccuuUUu',
  '................',
];

// ── 고갈된 원천 넷 (C012 ADDED) ──────────────────────────────────────
//
// 같은 자리에 선 것이 **바뀌었다**는 것이 한눈에 갈려야 한다 (spec SPEC-004 — Play A.2).
// 그래서 넷 다 available 과 **실루엣부터** 다르다. 넷을 잇는 규칙 하나는
// "있던 것이 없어졌다" 다 — 솟은 것이 내려앉고, 부푼 것이 갈라지고, 뭉친 것이 흩어지고,
// 쌓인 것이 낮아진다. 색은 붉은 것(C·c)이 빠지고 그늘(q·G·k·d)이 남는 쪽으로 움직인다.
//
// **남은 양을 말하지 않는다.** 몇 번 캤는지도 언제 돌아오는지도 실려 오지 않으므로,
// 그림도 "지금 여기에 없다" 까지만 말한다 (spec Observable "싣지 않는다").

// 노두가 무너져 구덩이가 되었다 — 솟은 결정이 사라지고 부서진 조각과 팬 자국만 남는다.
// 가장 높고 각지던 것이 가장 낮고 오목한 것이 된다 (available 과 정확히 반대의 실루엣)
const SOURCE_OUTCROP_DEPLETED = [
  '................',
  '................',
  '..cc......c.....',
  '.ddddddddddddd..',
  'dDDeeeeeeeeeDDd.',
  'dDeeqqqqqqqeeDd.',
  'dDeqqqqqqqqqeDd.',
  'dDeqqqcqqqqqeDd.',
  'dDeqqqqqqqcqeDd.',
  'dDeqqqqqqqqqeDd.',
  'dDeeqqqqqqqeeDd.',
  '.dDDeeeeeeeDDd..',
  '..dddDDDDDddd...',
  '....c...cc......',
  '................',
  '................',
];

// 뿌리혹이 터진 자국 — 뿌리는 그대로 내려오는데 둥근 덩이가 가운데서 갈라지고
// 빈 껍질(g)만 남았다. 붉은 알맹이(C)가 하나도 없고 갈라진 틈으로 속이 비어 보인다
const SOURCE_ROOT_NODULE_DEPLETED = [
  '................',
  '..u.............',
  '..uU............',
  '..uU............',
  '..uUu...........',
  '..uuUu..........',
  '...uuUuu........',
  '....uuUc...c....',
  '.....cGg...gGc..',
  '....cGgq...qgGc.',
  '...cGgqq...qqgG.',
  '...cGgqqqqqqgGc.',
  '....cGgqqqqgGc..',
  '.....cGgggGcuUu.',
  '......ccccc.uUUu',
  '................',
];

// 무더기가 흩어졌다 — 나무 밑동은 그대로인데 조각이 성기게 흩어지고 붉은 결(x)이 없다.
// 뭉쳐 있던 덩어리가 낱낱으로 벌어진 것이 available 과 갈리는 자리다
const SOURCE_MOLT_LITTER_DEPLETED = [
  '................',
  '................',
  '...uuuuuu.......',
  '..uUuuuuUu......',
  '..uUuuuuUu......',
  '..uUuuuuUu...k..',
  '..uUuuuuUu......',
  '..uuuuuuuu..k...',
  '.uUUuuuuUUu.....',
  '...mk...........',
  '..k.......mk....',
  '.........k......',
  '......mk........',
  '..k.........mk..',
  '.....k....k.....',
  '................',
];

// 더미가 헐렸다 — 무너져 낮아지고 나무틀(W)이 드러났다. 솟아 있던 돌무더기와 꽂힌 삽이
// 사라지고 틀의 기둥·가로대만 남는다: 넷 가운데 유일한 직선이 이제 실루엣의 전부다
const SOURCE_SPOIL_PILE_DEPLETED = [
  '................',
  '................',
  '................',
  '................',
  '................',
  '.W............W.',
  '.W............W.',
  '.W...rd.......W.',
  '.W..RrrdR.....W.',
  '.WWWWWWWWWWWWWW.',
  '.W..rd...drr..W.',
  '.W.rrrdd.ddrr.W.',
  '.W.dddddddddd.W.',
  '.WWWWWWWWWWWWWW.',
  '..d..r......d...',
  '................',
];

// ── 되돌아오는 중인 원천 넷 (C013 ADDED) ────────────────────────────
//
// **available · depleted 와 실루엣부터 갈린다** (spec SPEC-003 — 형태마다 그림이 셋이고
// 그 셋이 눈으로 갈린다). 넷을 잇는 규칙 하나는 "없던 것이 다시 오는 중이다" 다 —
// 무너진 자리에 작은 결정이 돋고, 터진 껍질에서 혹이 다시 부풀고, 흩어진 조각이 다시
// 모이고, 헐린 더미가 다시 드러난다. 자국(구덩이 · 터진 껍질 · 나무틀)은 **그대로 남아**
// 그 위에 새것이 얹히므로, 이것이 되돌아온 것이 아니라 되돌아오는 **중**임이 읽힌다.
//
// 색은 붉은 것(C·c)이 일부만 돌아온 값(i·I)이다 — available 보다 옅고 depleted 보다 짙다.
//
// **얼마나 남았는지 말하지 않는다.** 진행도 남은 시간도 실려 오지 않으므로(spec Observable),
// 그림도 "지금 되돌아오는 중이다" 까지만 말한다.

// 구덩이에 작은 결정이 돋는다 — 파인 자리(테두리 · 팬 바닥)는 그대로인데 그 안에서
// 결정 둘이 솟아 아직 테두리 높이를 넘지 못했다. 솟은 무리(available)도 빈 구멍(depleted)도 아니다
const SOURCE_OUTCROP_RECOVERING = [
  '................',
  '................',
  '..cc......c.....',
  '.ddddddddddddd..',
  'dDDeeeeeeeeeDDd.',
  'dDeeqiqqqqqeeDd.',
  'dDeqqiIqqqqqeDd.',
  'dDeqqiIqqqqqeDd.',
  'dDeqqiIqqiIqeDd.',
  'dDeqiiIqqiIIeDd.',
  'dDeeiiIqqiIeeDd.',
  '.dDDeeeeeeeDDd..',
  '..dddDDDDDddd...',
  '....c...cc......',
  '................',
  '................',
];

// 터진 껍질 안에서 혹이 다시 부푼다 — 갈라진 껍질(c·G·g)은 그대로 남고 그 속의 빈 자리
// 대신 작은 덩이가 차 오른다. available 의 꽉 찬 큰 덩이보다 작고, depleted 의 빈 속과 다르다
const SOURCE_ROOT_NODULE_RECOVERING = [
  '................',
  '..u.............',
  '..uU............',
  '..uU............',
  '..uUu...........',
  '..uuUu..........',
  '...uuUuu........',
  '....uuUc...c....',
  '.....cGg...gGc..',
  '....cGgq.i.qgGc.',
  '...cGgqqiIiqqgG.',
  '...cGgqiIIiqgGc.',
  '....cGgiIIigGc..',
  '.....cGgggGcuUu.',
  '......ccccc.uUUu',
  '................',
];

// 흩어진 조각이 다시 모인다 — 낱낱으로 벌어져 있던 것(depleted)이 둘씩 셋씩 붙기 시작하고
// 붉은 결(x)이 한 점 돌아왔다. 아직 available 의 두꺼운 무더기는 아니다
const SOURCE_MOLT_LITTER_RECOVERING = [
  '................',
  '................',
  '...uuuuuu.......',
  '..uUuuuuUu......',
  '..uUuuuuUu......',
  '..uUuuuuUu...k..',
  '..uUuuuuUu..mk..',
  '..uuuuuuuu...k..',
  '.uUUuuuuUUu.....',
  '...mk...........',
  '..mkx.....mk....',
  '...kk....mkk....',
  '.......mk.......',
  '..mk...mkk......',
  '...k....kk..mk..',
  '................',
];

// 헐린 더미가 다시 드러난다 — 나무틀(W)은 그대로인데 가로대 위로 돌무더기가 다시 쌓여
// 올라왔다. 꽂힌 삽(available 의 그 직선)은 아직 없고, 틀만 남은 것(depleted)도 아니다
const SOURCE_SPOIL_PILE_RECOVERING = [
  '................',
  '................',
  '................',
  '................',
  '................',
  '.W....Rr......W.',
  '.W...RrrdR....W.',
  '.W..RrrdrrrR..W.',
  '.W.RrrdrrxrrR.W.',
  '.WWWWWWWWWWWWWW.',
  '.W.rrrdrrrdrr.W.',
  '.W.rrdrrrrrdr.W.',
  '.W.dddddddddd.W.',
  '.WWWWWWWWWWWWWW.',
  '..d..r......d...',
  '................',
];

// ── 원천 셋의 그림 아홉 (C014 ADDED) ─────────────────────────────────
//
// 넷이 일곱이 된다. 넷을 갈랐던 규율을 그대로 잇는다 — 세계 위에 이름표가 없으므로
// (RULE-QUIET-GROUND-001) 그림이 유일한 구분이고, 셋도 **실루엣부터** 갈린다:
//   낮고 넓은 사체 위에 퍼진 흰 실 · 물이 물러난 어귀의 퇴적선과 잔알갱이 ·
//   물에 잠긴 웅덩이 하나에 가라앉은 탁한 층
// 앞의 넷 가운데 물에 잠긴 것도, 흰 것도 없었다 — 그 둘이 셋을 넷과 먼저 가른다.
//
// 세 state 의 규율도 그대로다. depleted 는 "있던 것이 없어졌다"(실이 걷히고 · 퇴적선이
// 지워지고 · 침전이 걷힌다), recovering 은 "없던 것이 다시 오는 중이다" 이고 자국은
// 그대로 남은 채 그 위에 새것이 얹힌다.
//
// 색의 양도 available > recovering > depleted 로 간다. 다만 그 색이 셋마다 제 것이다 —
// 균사는 이 표에서 **유일하게 붉지 않고**(w·z), 어귀의 알갱이는 물에 갈려 붉은빛을
// 잃었으며(Q·p), 호수의 침전만 탁한 붉은(E·X)을 지닌다.
//
// **얼마나 남았는지도 언제 오는지도 말하지 않는다** — 흐름의 주기도 남은 시간도
// 실려 오지 않는다 (spec Observable "싣지 않는다").

// 사체 위 흰 균사 — 삭은 가죽 덩이(j) 위로 갈비뼈(J)가 드러나고 그 위를 흰 실(w·z)이
// 넓게 덮었다. 넷 가운데 가장 낮고 넓던 허물 조각보다도 낮게 눕고, 흩어진 조각이 아니라
// **하나의 덩이**를 덮은 그물이다
const SOURCE_NEST_MYCELIUM = [
  '................',
  '.......w........',
  '....w..w...w....',
  '..w.wzw.w.wzw...',
  '.wzwwzwwwwwzww..',
  '.wwzjjwjjwjjzww.',
  'wwzjJjjJjjJjjzww',
  '.wjJjjJjjJjjJjw.',
  '..jjJjjJjjJjjj..',
  '..jjjjjjjjjjjj..',
  '...jjjjjjjjjj...',
  '..w..jjjjjj..w..',
  '.wzw........wzw.',
  '..w..........w..',
  '................',
  '................',
];

// 균사가 걷혔다 — 흰 실이 한 올도 없고 사체만 내려앉았다. 덮여 있던 것이 벗겨지면서
// 실루엣이 낮고 좁아진다 (덮개가 사라진 자리가 곧 자국이다)
const SOURCE_NEST_MYCELIUM_DEPLETED = [
  '................',
  '................',
  '................',
  '................',
  '................',
  '....jjjjjjjj....',
  '..jjJjjJjjJjjj..',
  '.jJjjJjjJjjJjjj.',
  '.jjJjjJjjJjjJjj.',
  '..jjjjjjjjjjjj..',
  '...jjjjjjjjjj...',
  '....jjjjjjjj....',
  '................',
  '................',
  '................',
  '................',
];

// 실이 다시 뻗는다 — 내려앉은 사체(depleted 의 그것 그대로)는 자국으로 남고 그 위로
// 흰 실 몇 올만 돋았다. available 의 덮은 그물도, 한 올도 없는 것도 아니다
const SOURCE_NEST_MYCELIUM_RECOVERING = [
  '................',
  '................',
  '................',
  '.......w........',
  '....w..z...w....',
  '....jjjjjjjj....',
  '..jjJjjJjjJjjj..',
  '.jJjjJjjJjjJjjj.',
  '.jjJjjJjjJjjJjj.',
  '..jjjjjjjjjjjj..',
  '...jjjjjjjjjj...',
  '....jjjjjjjj....',
  '.....w....z.....',
  '................',
  '................',
  '................',
];

// 어귀의 알갱이 — 위쪽에서 물(V·Z)이 비스듬히 들어오고, 물이 물러난 자리에 젖은
// 퇴적선(f)이 한 줄 그어지고, 그 아래로 잔알갱이가 낮게 깔렸다. 노두처럼 솟지 않고
// 뿌리혹처럼 뭉치지 않는다 — **가로 한 줄**이 이 그림의 실루엣이다
const SOURCE_RIVER_GRAIN = [
  '..ZZVZZVZZVZZ...',
  '.ZVZZVZZVZZVZZV.',
  'ZVZZVZZVZZVZZVZZ',
  '.VZZVZZVZZVZZVZ.',
  '..ZVZZVZZVZZVZ..',
  '.ffffffffffffff.',
  '..QpQ..Qp..QpQ..',
  '.pQQpQ.pQQ.pQQp.',
  '.QpQQpQQpQQpQQp.',
  'QpQQpQQpQQpQQpQQ',
  '.pQQpQQpQQpQQpQ.',
  '..QppQ..QppQ....',
  '...Qp....pQ..Qp.',
  '.....Q......p...',
  '................',
  '................',
];

// 퇴적선이 지워졌다 — 물이 한 뼘 더 내려와 그 자리를 덮고, 그어져 있던 줄이 성긴
// 젖은 자국 몇 점으로만 남는다. 가로 한 줄이 사라진 것이 available 과 갈리는 자리다
const SOURCE_RIVER_GRAIN_DEPLETED = [
  '..ZZVZZVZZVZZ...',
  '.ZVZZVZZVZZVZZV.',
  'ZVZZVZZVZZVZZVZZ',
  '.VZZVZZVZZVZZVZ.',
  '..ZVZZVZZVZZVZ..',
  '.VZV.VZ.VZV.ZV..',
  '..f..ff...f..f..',
  '....f....f......',
  '.f.....f.....f..',
  '....f.......f...',
  '..f......f......',
  '.......f........',
  '................',
  '................',
  '................',
  '................',
];

// 퇴적선이 다시 그어진다 — 줄이 아직 군데군데 끊겼고 알갱이도 성기다. 물의 자리는
// 그대로이고 그 아래만 채워지는 중이다 (available 의 두꺼운 층은 아직 아니다)
const SOURCE_RIVER_GRAIN_RECOVERING = [
  '..ZZVZZVZZVZZ...',
  '.ZVZZVZZVZZVZZV.',
  'ZVZZVZZVZZVZZVZZ',
  '.VZZVZZVZZVZZVZ.',
  '..ZVZZVZZVZZVZ..',
  '.ff.fff.ffff.ff.',
  '..Qp....Qp......',
  '.pQ...Qp...pQ...',
  '..QpQ..QQ..QpQ..',
  '.Qp..Qp..Qp..Qp.',
  '...Q...p...Q....',
  '......Qp........',
  '................',
  '................',
  '................',
  '................',
];

// 호수 바닥의 침전 — 물에 잠긴 웅덩이 하나(둥근 실루엣)의 아래 두 몫이 탁한 붉은
// 층으로 찼다. 일곱 가운데 **물속에 있는 유일한 것**이고, 그 색은 노두보다 무디되
// 어귀의 알갱이보다는 짙다 — 같은 재료의 세 순도가 여기서 가운데다
const SOURCE_SILT_BED = [
  '................',
  '....ZZVZZVZZ....',
  '..ZZVZZVZZVZZV..',
  '.ZVZZVZZVZZVZZV.',
  '.VZZVZZVZZVZZVZ.',
  'ZZVZZEEZZVZZVZZV',
  'ZVZEEEEEEZZVZZVZ',
  'ZZEEXEEEEEEZZVZZ',
  'ZEEEXEEEXEEEEZZV',
  'ZEEEXEEEXEEEXEEZ',
  '.EEXEEEXEEEXEEE.',
  '.EXEEXEEEXEEEXE.',
  '..XEEXEEEXEEXE..',
  '..XXEXXEEXXEXX..',
  '...XXXXXXXXXX...',
  '.....XXXXXX.....',
];

// 침전이 걷혔다 — 같은 웅덩이인데 탁한 층이 한 점도 없고 맨 바닥(d·D·e)이 드러났다.
// 물빛이 위에서 아래까지 닿는다: 잠겨 있던 것이 사라진 자리를 물이 대신 채운다
const SOURCE_SILT_BED_DEPLETED = [
  '................',
  '....ZZVZZVZZ....',
  '..ZZVZZVZZVZZV..',
  '.ZVZZVZZVZZVZZV.',
  '.VZZVZZVZZVZZVZ.',
  'ZZVZZVZZVZZVZZVZ',
  'ZVZZVZZVZZVZZVZZ',
  'VZZVZZVZZVZZVZZV',
  'ZZVZZVZZVZZVZZVZ',
  'ZVZZVZZVZZVZZVZZ',
  '.ddDdddDddDdddd.',
  '.DeeDeeeDeeeDeD.',
  '..eeeeeeeeeeee..',
  '..eDeeeeDeeeDe..',
  '...dDdDddDdDd...',
  '.....dddddd.....',
];

// 다시 가라앉는 중이다 — 헐벗은 바닥(depleted 의 그것 그대로)은 자국으로 남고 그 위에
// 얇은 층이 한 줄 앉았으며, 물속에는 아직 내려오는 알갱이가 떠 있다. 두툼한 층도,
// 한 점도 없는 것도 아니다
const SOURCE_SILT_BED_RECOVERING = [
  '................',
  '....ZZVZZVZZ....',
  '..ZZVZZVZZVZZV..',
  '.ZVZZVEZVZZVZZV.',
  '.VZZVZZVZZEZZVZ.',
  'ZZVZZVZZVZZVZEVZ',
  'ZVZZEZZVZZVZZVZZ',
  'VZZVZZVZEVZZVZZV',
  'ZZVZEVZZVZZVZZVZ',
  'ZEEXEEEXEEEXEEEZ',
  '.ddDdddDddDdddd.',
  '.DeeDeeeDeeeDeD.',
  '..eeeeeeeeeeee..',
  '..eDeeeeDeeeDe..',
  '...dDdDddDdDd...',
  '.....dddddd.....',
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

// ── 미로의 식물 넷 (C008) ─────────────────────────────────────────────
//
// 재배열이 건드리지 않는 유일한 것이다 (spec R3 RULE-STABLE-PLANT-CLUE-001) — 그래서
// **관찰의 기준점**이고, 이 넷이 서로 갈리지 않으면 이 Play 자체가 성립하지 않는다
// ("지도는 못 그려도 이름표는 읽는다" — Play §5.3).
//
// 그래서 넷을 **두 축으로** 갈랐다. 색이 겹쳐 보이는 거리에서도 실루엣이 답하고,
// 실루엣이 뭉개지는 거리에서도 색이 답한다.
//   실루엣  말린 새순(좁고 높다) · 갓(넓고 낮다) · 곧은 기둥 셋(세로 줄) · 늘어진 방울 셋(아치)
//   색      청록 · 자홍 · 호박 · 상아 — 그 구역 바닥 zone 과 같은 계열이다
//
// 넷 다 밑동을 공통 어두운 색(v) 한 줄로 두어 "땅에 자란 것" 으로 읽히게 했다
// (백색 거목이 밑동을 벌려 뿌리로 읽히게 한 것과 같은 이유).

// A 구역 — 돌돌 말린 새순. 넷 가운데 가장 좁고 높다
const CLUE_COIL_FERN = [
  '................',
  '.....aaaa.......',
  '....aa..aa......',
  '...aa.aa.aa.....',
  '...aa.aa.aa.....',
  '....aa..aa......',
  '.....aaaAA......',
  '........AA......',
  '........AA......',
  '.......AAA......',
  '.......AA.......',
  '......AAA.......',
  '......AA........',
  '......AA........',
  '.....vAAv.......',
  '.....vvvv.......',
];

// B 구역 — 넓은 갓 하나. 넷 가운데 가장 넓고 낮다 (새순과 정반대의 실루엣)
const CLUE_CAP_BLOOM = [
  '................',
  '................',
  '................',
  '.....nnnnnn.....',
  '...nnnnnnnnnn...',
  '..nnnnnnnnnnnn..',
  '..nNnnnnnnnnNn..',
  '..NNNNNNNNNNNN..',
  '.....NN..NN.....',
  '......N..N......',
  '......N..N......',
  '......N..N......',
  '......N..N......',
  '.....NN..NN.....',
  '....vvvvvvvv....',
  '................',
];

// C 구역 — 곧은 가시 기둥 셋. 둥근 것 둘 사이에서 **직선**으로 갈린다
const CLUE_SPINE_STALK = [
  '................',
  '.......o........',
  '...o...o...o....',
  '...o...o...o....',
  '..Oo...oO..oO...',
  '...o...o...o....',
  '...oO..o..Oo....',
  '...o...o...o....',
  '..Oo...oO..oO...',
  '...o...o...o....',
  '...o...o...o....',
  '...oO..o..Oo....',
  '...o...o...o....',
  '..Oo...O...oO...',
  '..OOOOOOOOOOO...',
  '...vvvvvvvvv....',
];

// D 구역 — 아치에 매달린 방울 셋. 위가 벌어지고 아래가 늘어진다 (앞의 셋과 무게가 반대다)
const CLUE_BELL_VINE = [
  '................',
  '.....YYYYY......',
  '...YY.....YY....',
  '..Y.........Y...',
  '..Y....Y....Y...',
  '..Y....Y....Y...',
  '..y....y....y...',
  '.yyy..yyy..yyy..',
  '.yyy..yyy..yyy..',
  '..y....y....y...',
  '.......Y........',
  '.......Y........',
  '.......Y........',
  '.......Y........',
  '......YYY.......',
  '.....vvvvv......',
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
  // 미로의 식물 넷 (C008) — 같은 어법의 지형 instance 다. 이름은 **그림의 이름**이지
  // 세계의 이름이 아니다 (세계가 붙인 clue 태그는 데이터의 것이고, 어느 그림을 세울지는
  // terrain-presentation 의 표가 정한다 — 핵심 원칙 2).
  'clue:coil-fern': CLUE_COIL_FERN,
  'clue:cap-bloom': CLUE_CAP_BLOOM,
  'clue:spine-stalk': CLUE_SPINE_STALK,
  'clue:bell-vine': CLUE_BELL_VINE,
  // 재료의 원천 넷 (C011) — 키는 `<sprite>:<state>` 이고 state 는 'available' 하나뿐이다.
  // 어느 그림을 세울지는 role-presentation 의 spriteByKind 가 kind 로 고른다
  'source:molt-litter:available': SOURCE_MOLT_LITTER,
  'source:spoil-pile:available': SOURCE_SPOIL_PILE,
  'source:outcrop:available': SOURCE_OUTCROP,
  'source:root-nodule:available': SOURCE_ROOT_NODULE,
  // 고갈된 뒤의 넷 (C012) — 같은 키에 state 만 바뀐다. 자국은 세계의 phase 에서 오고,
  // 어느 그림을 세울지는 지금까지대로 kind 가 고른다 (resolve 의 `${sprite}:${state}`)
  'source:molt-litter:depleted': SOURCE_MOLT_LITTER_DEPLETED,
  'source:spoil-pile:depleted': SOURCE_SPOIL_PILE_DEPLETED,
  'source:outcrop:depleted': SOURCE_OUTCROP_DEPLETED,
  'source:root-nodule:depleted': SOURCE_ROOT_NODULE_DEPLETED,
  // 되돌아오는 중의 넷 (C013) — 다시 같은 키에 state 만 바뀐다. 세계가 싣는 state 가
  // 셋이 되었을 뿐이고(available · depleted · recovering), 고르는 규칙은 그대로다
  'source:molt-litter:recovering': SOURCE_MOLT_LITTER_RECOVERING,
  'source:spoil-pile:recovering': SOURCE_SPOIL_PILE_RECOVERING,
  'source:outcrop:recovering': SOURCE_OUTCROP_RECOVERING,
  'source:root-nodule:recovering': SOURCE_ROOT_NODULE_RECOVERING,
  // 원천 셋의 아홉 (C014) — 표가 넷에서 일곱이 될 뿐, 키의 어법도 고르는 규칙도 그대로다
  'source:nest-mycelium:available': SOURCE_NEST_MYCELIUM,
  'source:nest-mycelium:depleted': SOURCE_NEST_MYCELIUM_DEPLETED,
  'source:nest-mycelium:recovering': SOURCE_NEST_MYCELIUM_RECOVERING,
  'source:river-grain:available': SOURCE_RIVER_GRAIN,
  'source:river-grain:depleted': SOURCE_RIVER_GRAIN_DEPLETED,
  'source:river-grain:recovering': SOURCE_RIVER_GRAIN_RECOVERING,
  'source:silt-bed:available': SOURCE_SILT_BED,
  'source:silt-bed:depleted': SOURCE_SILT_BED_DEPLETED,
  'source:silt-bed:recovering': SOURCE_SILT_BED_RECOVERING,
};

/** 이 팩의 스프라이트 표 — 조립 루트가 engine 의 registerSprites 에 넘긴다 */
export const SPRITE_SHEET: SpriteSheet = { palette: PALETTE, maps: PIXEL_MAPS };

export const REGISTERED_SPRITE_IDS = Object.keys(PIXEL_MAPS);
