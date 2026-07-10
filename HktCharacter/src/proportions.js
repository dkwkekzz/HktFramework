// ===========================================================================
//  HktCharacter · 비율 프로파일 (proportion profiles)
//
//  살 grammar 를 하드코딩 함수에서 "데이터"로 승격한 층. 프로파일 하나가
//  캐릭터 한 벌의 비율을 온전히 기술한다 — 이후 비율 변경은 여기 수치만 만지면 된다.
//
//  프로파일 구조:
//    · skeleton : built-in 리그의 치수(뼈 길이/폭, 단위 m). 외부 FBX 는 자체
//                 뼈 길이를 쓰므로 이 절은 built-in 리그에만 적용된다.
//    · rules    : 이름 → 살 반지름. 위에서 아래로 첫 매치 승리 (기존 grammar 와
//                 동일한 의미론). match 가 '=' 로 시작하면 정확 일치, 아니면 부분 문자열.
//                 group 은 UI 그룹 배율(groupMul)의 키 — 그룹 단위 실시간 튜닝용.
//    · fallback : 미지의 뼈 기본 반지름 (임의 리그도 깨지지 않음 — 설계 결정).
//    · extras   : 캡슐 체인만으로는 안 나오는 볼륨(가슴·둔부·종아리 등)을
//                 관절 로컬 오프셋 세그먼트로 추가. mirrorX 면 x 부호 반전 쌍 생성.
//                 관절 이름은 접두어 제거 후 매칭 → 외부 Mixamo 리그에도 그대로 붙는다.
//
//  Detail 층 (rules/extras 공통 선택 필드) — 캡슐+전역 smin 매체의 한계 돌파:
//    · k        : 이 세그먼트의 blend 폭. 작으면 날카롭게 붙는다 (미지정 = 전역 uK).
//    · flatten  : { dir:[x,y,z], f } — 관절 로컬 dir 방향으로 f 배 납작화(타원 단면).
//                 dir 은 관절 회전을 따라간다. 예: 흉곽 [0,0,1](앞뒤 납작), 머리 [1,0,0].
//    · op:'cut' : (extras 전용) 더하지 않고 깎는다(smooth-subtraction) — 주름/파임.
//
//  ⚠ grammar 는 계속 "이름 기반" — 특정 리그에 하드코딩하지 않는다 (설계 결정).
// ===========================================================================

// 그룹 키 목록 — UI 슬라이더와 1:1. 새 그룹을 추가하면 main.js 가 자동 인식한다.
export const GROUPS = [
  ['head',  '머리'],
  ['chest', '가슴'],
  ['waist', '허리'],
  ['hips',  '엉덩이'],
  ['arms',  '팔'],
  ['legs',  '다리'],
];

// ---------------------------------------------------------------------------
//  표준 프로파일 — 기존 하드코딩 값 보존 (비교/회귀 기준)
// ---------------------------------------------------------------------------
const STANDARD = {
  name: '표준',
  skeleton: {
    hipsY: 0.98,                    // 루트(골반) 높이
    spineLens: [0.11, 0.12, 0.12],  // Spine → Spine1 → Spine2 간격
    neckLen: 0.12, neckZ: 0.01,
    headLen: 0.07, headZ: 0.01,
    headTopLen: 0.15, headTopZ: 0.02,
    shoulderX: 0.05, shoulderY: 0.09, // Spine2 → Shoulder
    armX: 0.13,                     // Shoulder → Arm (어깨 폭 절반의 나머지)
    upperArmLen: 0.28, foreArmLen: 0.25,
    upLegX: 0.09, upLegY: -0.06,    // Hips → UpLeg (골반 폭)
    thighLen: 0.42, shinLen: 0.42,
    footDrop: 0.07, toeZ: 0.14,
    fingers: [['Thumb', 0.55, 0.03], ['Index', 0.14, 0.04], ['Middle', -0.02, 0.045], ['Ring', -0.16, 0.04], ['Pinky', -0.30, 0.032]],
  },
  rules: [
    { match: '=Hips',    r: 0.135, group: 'hips'  },
    { match: 'Spine2',   r: 0.15,  group: 'chest' },
    { match: 'Spine1',   r: 0.14,  group: 'waist' },
    { match: 'Spine',    r: 0.13,  group: 'waist' },
    { match: 'Neck',     r: 0.055, group: 'chest' },
    { match: 'HeadTop',  r: 0.065, group: 'head'  },
    { match: '_End',     r: 0.065, group: 'head'  },
    { match: 'Head',     r: 0.12,  group: 'head'  },
    { match: 'Shoulder', r: 0.055, group: 'chest' },
    { match: 'ForeArm',  r: 0.05,  group: 'arms'  },
    { match: 'Arm',      r: 0.062, group: 'arms'  },
    { match: 'Hand',     r: 0.05,  group: 'arms'  },
    { match: 'UpLeg',    r: 0.10,  group: 'legs'  },
    { match: 'Leg',      r: 0.078, group: 'legs'  },
    { match: 'ToeBase',  r: 0.035, group: 'legs'  },
    { match: 'Toe',      r: 0.035, group: 'legs'  },
    { match: 'Foot',     r: 0.052, group: 'legs'  },
    { match: 'Thumb',    r: 0.014, group: 'arms'  },
    { match: 'Index',    r: 0.014, group: 'arms'  },
    { match: 'Middle',   r: 0.014, group: 'arms'  },
    { match: 'Ring',     r: 0.014, group: 'arms'  },
    { match: 'Pinky',    r: 0.014, group: 'arms'  },
    { match: 'Finger',   r: 0.014, group: 'arms'  },
  ],
  fallback: 0.05,
  extras: [],
  defaults: { k: 0.12 }, // 프리셋 권장 smin
  pose: { armDown: 1.30 }, // built-in 클립 휴식 팔 각도 (rad, T-pose 기준)
};

// ---------------------------------------------------------------------------
//  레퍼런스 프로파일 — 첨부 캐릭터 시트(약 6등신 애니메 여성 체형) 기준.
//  전신 ~1.60m, 머리 단위 ~0.26m. 좁은 어깨 · 잘록한 허리 · 넓은 골반 ·
//  가는 팔/목 · 통통한 허벅지 → 발목으로 갈수록 급한 테이퍼.
//  수치 출처: 시트의 랜드마크 비율 (정수리 1.00 / 턱 0.84 / 어깨 0.80 /
//  가슴 0.72 / 허리 0.61 / 골반 최광 0.51 / 가랑이 0.46 / 무릎 0.29 / 발목 0.06)
// ---------------------------------------------------------------------------
const REFERENCE = {
  name: '레퍼런스',
  skeleton: {
    hipsY: 0.88,
    spineLens: [0.10, 0.10, 0.12],  // 허리(Spine) 0.98 · 명치 1.08 · 흉곽 1.20
    // ⚠ 이하 수치 다수는 eval/optimize.mjs 좌표 하강 결과 (dense 라인 손실 기준) —
    //   손으로 크게 벗어나게 만지지 말고, 바꾸면 npm run eval + optimize --baseline 로 확인.
    spineZ: [0.014, 0.0, -0.008],   // 몸통 전방 정렬 — 시트 측면은 등이 수직에 가깝다 (중심선 지표 기준)
    neckLen: 0.09, neckZ: 0.012,    // 목밑 1.29 ≈ 어깨선 — 목은 앞으로 기움 (throat 가 턱보다 안 나가게)
    headLen: 0.17, headZ: 0.012,    // 두개골 중심 1.46 — 전방 돌출은 Skull subBone 이 아니라 여기서 막는다
    headTopLen: 0.06, headTopZ: 0.0,
    shoulderX: 0.04, shoulderY: 0.085, // 시트 어깨 경사선이 렌더보다 높다 — loft 전환 때 +0.01 (폭 지표 f 0.19 행)
    armX: 0.095,                    // 어깨 폭 절반 ≈ 0.135 + 삼각근 살
    upperArmLen: 0.25, foreArmLen: 0.245,
    upLegX: 0.08, upLegY: -0.07,    // 고관절 0.81 (골반 최광부)
    kneeX: 0.052, ankleX: 0.042,    // 시트처럼 다리가 발목으로 갈수록 안쪽 수렴
    upLegZ: 0.040, kneeZ: 0.034, ankleZ: 0.004, // 다리를 골반보다 앞에, 발목은 복귀 — 시트 측면 중심선 정렬
    thighLen: 0.37, shinLen: 0.36,  // 무릎 0.46 · 발목 0.09
    footDrop: 0.055, toeZ: 0.084,
    fingers: [['Thumb', 0.55, 0.025], ['Index', 0.14, 0.034], ['Middle', -0.02, 0.038], ['Ring', -0.16, 0.034], ['Pinky', -0.30, 0.027]],
  },
  rules: [
    { match: '=Hips',    r: 0.083, group: 'hips'  },
    // 흉곽: 앞뒤로 납작한 타원 단면 — 정면 폭은 살리고 측면 깊이는 얇게 (시트 특징)
    { match: 'Spine2',   r: 0.055, group: 'chest', flatten: { dir: [0, 0, 1], f: 0.92 } },
    // 허리·골반: 뒤(-z) 반만 납작 = 요추 아치 — 시트 측면의 등 안쪽 곡선 (배는 그대로)
    { match: 'Spine1',   r: 0.0625, group: 'waist', flatten: { dir: [1, 0, 0], f: 0.92 }, flatten2: { dir: [0, 0, -1], f: -0.62 } },
    { match: 'Spine',    r: 0.072, group: 'waist', flatten: { dir: [1, 0, 0], f: 0.92 }, flatten2: { dir: [0, 0, -1], f: -0.62 } }, // 허리 최협부
    { match: 'Neck',     r: 0.0255, group: 'chest' },
    // ---- 두상: loft 절(Head/HeadTop_End 스택)이 대체 — 아래 규칙은 loft 가 없는
    //      리그(HeadTop_End 부재 등)의 캡슐 폴백용 최소치만 남긴다.
    { match: 'HeadTop',  r: 0.084, group: 'head' },
    { match: 'Head',     r: 0.032, group: 'head' },
    // 어깨 경사 상단(승모근~삼각근 이음) — r 이 크면 팔 캡슐(0.027)과의 단차가
    // 어깨 끝 스파이크로 뜬다(교훈) — 완만한 테이퍼 + k 로 부드러운 웰드
    { match: 'Shoulder', r: 0.039, k: 0.06, group: 'chest' },
    // 팔 캡슐: 전역 k(0.05)로 이으면 팔꿈치·손목마다 k/4(1.2cm) 웰드 lump 가 뜬다(교훈)
    { match: 'ForeArm',  r: 0.0265, k: 0.022, group: 'arms' },
    { match: 'Arm',      r: 0.0285, k: 0.03, group: 'arms'  },
    { match: 'Hand',     r: 0.0125, k: 0.02, group: 'arms'  },
    { match: 'UpLeg',    r: 0.070, group: 'legs'  }, // 허벅지 상단 — 골반 폭에도 기여
    { match: 'Leg',      r: 0.042, group: 'legs'  }, // 무릎
    // 발: 발목·발등에서 굵고 발끝으로 테이퍼 — 역순이면 곤봉/말굽이 된다(교훈)
    { match: 'ToeBase',  r: 0.019, group: 'legs'  },
    { match: 'Toe',      r: 0.013, group: 'legs'  }, // 'Toe_End' 포함 (아래 '_End' 보다 먼저)
    { match: 'Foot',     r: 0.024, group: 'legs'  }, // 발목~발등
    { match: '_End',     r: 0.018, group: 'arms'  }, // 그 밖의 말단 nub (임의 리그) — 작게
    { match: 'Thumb',    r: 0.010, group: 'arms'  },
    { match: 'Index',    r: 0.010, group: 'arms'  },
    { match: 'Middle',   r: 0.010, group: 'arms'  },
    { match: 'Ring',     r: 0.010, group: 'arms'  },
    { match: 'Pinky',    r: 0.010, group: 'arms'  },
    { match: 'Finger',   r: 0.010, group: 'arms'  },
  ],
  fallback: 0.04,
  // (subBones 두상 세분화는 loft 절의 Head/HeadTop_End 스택이 대체 — 제거됨.
  //  블렌드 융기 없는 매끈한 두상은 원판 로프트가 구성상 보장한다.)
  // 볼륨 헬퍼 — joint 로컬 공간(m): +x=캐릭터 왼쪽, +y=위, +z=정면
  // ⚠ 목덜미·아랫배·골반옆·종아리 헬퍼는 loft 스택이 흡수해 제거됨 (fit-loft "접힌 extras").
  extras: [
    // 가슴 (Spine2 기준, 좌우 대칭 — 측면 돌출이 시트의 특징. k 를 크게 하면 좌우가
    // 한 판으로 융합돼 "가슴판"이 된다(교훈) — 분리 유지 하한까지 낮춤. 눈 검증 항목)
    // 시트 측면: 가슴은 아래로 처지고(b.y 낮게) 밑가슴→배로 곡선이 이어진다
    { joint: 'Spine2', mirrorX: true, a: [0.044, -0.030, 0.046], b: [0.054, -0.064, 0.092], ra: 0.046, rb: 0.050, k: 0.055, group: 'chest' },
    // 승모근 — 목밑에서 어깨로 흐르는 경사 (시트의 어깨 경사선. loft 전환 때 위로/넓게 —
    // 목 loft(k 0.05)와의 smin 웹이 f≈0.19 행의 어깨선 폭을 만든다)
    { joint: 'Spine2', mirrorX: true, a: [0.010, 0.115, 0.002], b: [0.075, 0.070, 0.0], ra: 0.026, rb: 0.030, k: 0.06, group: 'chest' },
    // 둔부 (Hips 기준, 좌우 대칭 — 뒤로 볼록. 시트 측면 허리→둔부→허벅지 S커브의 몸통.
    // loft 골반은 가랑이 돔 클램프로 뒤(-z) 살이 얕다 — 둔부 볼륨은 사실상 이 extra 의 몫)
    { joint: 'Hips', mirrorX: true, a: [0.046, 0.0, -0.008], b: [0.050, -0.088, -0.034], ra: 0.050, rb: 0.062, k: 0.06, group: 'hips' },
    // 뒤꿈치 (후면에서 발이 바닥까지 닿아 보이게 + 측면 힐 라인)
    { joint: 'Foot', mirrorJoints: true, a: [0.0, -0.02, -0.01], b: [0.0, -0.052, -0.018], ra: 0.018, rb: 0.015, group: 'legs' },
    // 손바닥 (손가락 미표시 시에도 손목에서 끊기지 않게 — 손 로컬 +x = 팔 방향.
    // 3뷰 잔차 지도 공통 돌출부라 슬림하게)
    { joint: 'Hand', mirrorJoints: true, a: [0.0, 0.0, 0.0], b: [0.058, 0.0, 0.004], ra: 0.0105, rb: 0.007, k: 0.02, group: 'arms' },
  ],
  // ---- 원판 로프트(disk-loft) 살 층 — eval/fit-loft.mjs 가 시트에서 피팅 (LOFT-PLAN) ----
  // 뼈(자식 관절 simple name, Left/Right 접두어 없이 매칭) → 원판 스택.
  // t: 뼈 축 위치(0=부모,1=자식,범위 밖=연장) · rx: 좌우 반경 · zf/zb: 앞/뒤 경계(관절 로컬 z)
  // xo: 단면 중심 좌우 오프셋(다리 — 미러 시 부호 반전) · disks:[] = 그 뼈 살 생략(UpLeg)
  // k: 이 스택의 smin fold 폭 (목 = 승모근·어깨와의 웹 — 어깨 경사선)
  // 재피팅: node eval/fit-loft.mjs --stage all (하위 단계 분할 실행은 파일 머리말 참조)
  loft: {
    'Spine': { group: 'waist', disks: [
      { t: -1.3143, rx: 0.0136, zf: 0.0567, zb: 0.051 },
      { t: -1.1214, rx: 0.0329, zf: 0.0622, zb: 0.0427 },
      { t: -0.9286, rx: 0.0521, zf: 0.0719, zb: 0.0335 },
      { t: -0.7357, rx: 0.0714, zf: 0.0831, zb: 0.0227 },
      { t: -0.5429, rx: 0.0907, zf: 0.0938, zb: 0.0103 },
      { t: -0.35, rx: 0.11, zf: 0.1026, zb: -0.0053 },
      { t: -0.1571, rx: 0.1293, zf: 0.1113, zb: -0.0222 },
      { t: 0.0357, rx: 0.1478, zf: 0.1204, zb: -0.0388 },
      { t: 0.2286, rx: 0.1423, zf: 0.1161, zb: -0.0415 },
      { t: 0.4214, rx: 0.1362, zf: 0.1119, zb: -0.0446 },
      { t: 0.6143, rx: 0.1276, zf: 0.1077, zb: -0.0468 },
      { t: 0.8071, rx: 0.1207, zf: 0.1044, zb: -0.0449 },
      { t: 1, rx: 0.1175, zf: 0.1035, zb: -0.0433 },
    ] },
    'Spine1': { group: 'waist', disks: [
      { t: 0, rx: 0.1069, zf: 0.1008, zb: -0.0308 },
      { t: 0.2, rx: 0.1065, zf: 0.1008, zb: -0.034 },
      { t: 0.4, rx: 0.106, zf: 0.0929, zb: -0.0401 },
      { t: 0.6, rx: 0.1019, zf: 0.0849, zb: -0.0408 },
      { t: 0.8, rx: 0.0982, zf: 0.0819, zb: -0.0345 },
      { t: 1, rx: 0.0946, zf: 0.0844, zb: -0.031 },
    ] },
    'Spine2': { group: 'chest', disks: [
      { t: 0, rx: 0.0878, zf: 0.0909, zb: -0.034 },
      { t: 0.1667, rx: 0.0871, zf: 0.0906, zb: -0.0382 },
      { t: 0.3333, rx: 0.0868, zf: 0.0904, zb: -0.0466 },
      { t: 0.5, rx: 0.0898, zf: 0.0913, zb: -0.051 },
      { t: 0.6667, rx: 0.0943, zf: 0.0922, zb: -0.0556 },
      { t: 0.8333, rx: 0.0988, zf: 0.0946, zb: -0.0598 },
      { t: 1, rx: 0.1009, zf: 0.0956, zb: -0.06 },
    ] },
    'Neck': { group: 'chest', k: 0.05, disks: [
      { t: 0, rx: 0.1036, zf: 0.0756, zb: -0.0643 },
      { t: 0.25, rx: 0.1036, zf: 0.073, zb: -0.0642 },
      { t: 0.5, rx: 0.1036, zf: 0.0684, zb: -0.0641 },
      { t: 0.75, rx: 0.1036, zf: 0.0647, zb: -0.064 },
      { t: 1, rx: 0.1036, zf: 0.0631, zb: -0.064 },
    ] },
    'Head': { group: 'head', k: 0.025, disks: [
      { t: 0, rx: 0.0938, zf: 0.0472, zb: -0.0718 },
      { t: 0.1, rx: 0.0899, zf: 0.0406, zb: -0.071 },
      { t: 0.2, rx: 0.0821, zf: 0.0294, zb: -0.0693 },
      { t: 0.3, rx: 0.0686, zf: 0.0196, zb: -0.0673 },
      { t: 0.4, rx: 0.0534, zf: 0.0213, zb: -0.0658 },
      { t: 0.5, rx: 0.0407, zf: 0.0406, zb: -0.0653 },
      { t: 0.6, rx: 0.0381, zf: 0.0629, zb: -0.0655 },
      { t: 0.7, rx: 0.0465, zf: 0.0822, zb: -0.0681 },
      { t: 0.8, rx: 0.0588, zf: 0.0889, zb: -0.0744 },
      { t: 0.9, rx: 0.0764, zf: 0.0955, zb: -0.0802 },
      { t: 1, rx: 0.0837, zf: 0.0979, zb: -0.0841 },
    ] },
    // 두정: round-cone 은 "구 껍질" — 마지막 원판의 구형 돔이 정수리를 그린다 (fit 이
    // crown 높이에 정확히 맞춰 자름. 급한 테이퍼 원판을 더 얹으면 두정이 솟는다 — 교훈)
    'HeadTop_End': { group: 'head', disks: [
      { t: 0, rx: 0.101, zf: 0.0936, zb: -0.1029 },
      { t: 0.24, rx: 0.101, zf: 0.0925, zb: -0.1073 },
      { t: 0.48, rx: 0.1002, zf: 0.0904, zb: -0.1146 },
      { t: 0.72, rx: 0.0987, zf: 0.0883, zb: -0.1187 },
      { t: 0.96, rx: 0.0973, zf: 0.0904, zb: -0.1204 },
      { t: 1.2, rx: 0.0872, zf: 0.0841, zb: -0.1082 },
    ] },
    // 허벅지: 상단은 돔 가드로 잘림(새들백 방지 — 힙 크레스트 위 실루엣은 골반 loft 담당),
    // k0 = 골반 살과의 관절 경계 blend
    'Leg': { group: 'legs', k0: 0.04, disks: [
      { t: -0.04, rx: 0.0761, zf: 0.0664, zb: -0.0422, xo: 0.0028 },
      { t: 0.04, rx: 0.0729, zf: 0.0708, zb: -0.0485, xo: 0.006 },
      { t: 0.12, rx: 0.0704, zf: 0.0741, zb: -0.0541, xo: 0.0078 },
      { t: 0.2, rx: 0.0684, zf: 0.075, zb: -0.0581, xo: 0.0083 },
      { t: 0.28, rx: 0.066, zf: 0.0727, zb: -0.0615, xo: 0.0072 },
      { t: 0.36, rx: 0.0626, zf: 0.0678, zb: -0.0642, xo: 0.0057 },
      { t: 0.44, rx: 0.0585, zf: 0.062, zb: -0.064, xo: 0.0038 },
      { t: 0.52, rx: 0.0542, zf: 0.0559, zb: -0.0609, xo: 0.0018 },
      { t: 0.6, rx: 0.0503, zf: 0.0505, zb: -0.0564, xo: -0.0003 },
      { t: 0.68, rx: 0.0473, zf: 0.0459, zb: -0.0535, xo: -0.002 },
      { t: 0.76, rx: 0.0461, zf: 0.0426, zb: -0.053, xo: -0.001 },
      { t: 0.84, rx: 0.0461, zf: 0.0406, zb: -0.0541, xo: 0.0016 },
      { t: 1, rx: 0.0466, zf: 0.0399, zb: -0.0549, xo: 0.0041 },
    ] },
    'Foot': { group: 'legs', disks: [
      { t: 0, rx: 0.047, zf: 0.0258, zb: -0.0658, xo: 0.0126 },
      { t: 0.0746, rx: 0.0472, zf: 0.0255, zb: -0.0653, xo: 0.0121 },
      { t: 0.1492, rx: 0.0471, zf: 0.0248, zb: -0.0642, xo: 0.0113 },
      { t: 0.2238, rx: 0.046, zf: 0.024, zb: -0.0626, xo: 0.0106 },
      { t: 0.2985, rx: 0.0434, zf: 0.0232, zb: -0.0608, xo: 0.0099 },
      { t: 0.3731, rx: 0.0397, zf: 0.0224, zb: -0.059, xo: 0.0086 },
      { t: 0.4477, rx: 0.0354, zf: 0.0216, zb: -0.0573, xo: 0.0073 },
      { t: 0.5223, rx: 0.0315, zf: 0.0208, zb: -0.0555, xo: 0.0061 },
      { t: 0.5969, rx: 0.0284, zf: 0.02, zb: -0.0537, xo: 0.0052 },
      { t: 0.6715, rx: 0.0263, zf: 0.0192, zb: -0.052, xo: 0.0046 },
      { t: 0.7462, rx: 0.0252, zf: 0.0185, zb: -0.0503, xo: 0.0041 },
      { t: 0.8208, rx: 0.0251, zf: 0.0182, zb: -0.0489, xo: 0.0036 },
      { t: 0.8954, rx: 0.0254, zf: 0.0184, zb: -0.0479, xo: 0.0031 },
      { t: 0.97, rx: 0.0256, zf: 0.0186, zb: -0.0474, xo: 0.0029 },
    ] },
    'UpLeg': { group: 'legs', disks: [] }, // 골반·허벅지 loft 가 대체 — 캡슐 억제
  },
  defaults: { k: 0.05 }, // 가는 팔·목이 살아남아야 하는 체형 — smin 좁게 (loft 내부는 스택별 k)
  // 시트 A-포즈: 팔은 몸에 붙이고 전완만 살짝 밖, 팔 전체가 살짝 앞으로 늘어져
  // 손이 허벅지 "앞"에 온다 (시트 측면 — 중심선 지표의 허리~무릎 밴드가 이걸 본다)
  pose: { armDown: 1.525, foreArmOut: 0.14, handIn: 0.50, footSplay: 0.12, armFwd: 0.12, foreArmFwd: 0.20 },
};

export const PROFILES = { standard: STANDARD, reference: REFERENCE };

// ---------------------------------------------------------------------------
//  조회 헬퍼 — 접두어 제거된 이름(simpleName) 을 받는다.
// ---------------------------------------------------------------------------
export function matchRule(profile, simpleName) {
  for (const rule of profile.rules) {
    if (rule.match[0] === '='
      ? simpleName === rule.match.slice(1)
      : simpleName.indexOf(rule.match) >= 0) return rule;
  }
  return null;
}
