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
    { match: 'Shoulder', r: 0.043, group: 'chest' }, // 어깨 경사 상단(승모근~삼각근 이음) — loft 전환 때 상향
    { match: 'ForeArm',  r: 0.0265, group: 'arms' },
    { match: 'Arm',      r: 0.027, group: 'arms'  },
    { match: 'Hand',     r: 0.014, group: 'arms'  },
    { match: 'UpLeg',    r: 0.070, group: 'legs'  }, // 허벅지 상단 — 골반 폭에도 기여
    { match: 'Leg',      r: 0.042, group: 'legs'  }, // 무릎
    { match: 'ToeBase',  r: 0.020, group: 'legs'  },
    { match: 'Toe',      r: 0.020, group: 'legs'  }, // 'Toe_End' 포함 (아래 '_End' 보다 먼저)
    { match: 'Foot',     r: 0.018, group: 'legs'  }, // 발목 — 가늘게
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
    // 가슴 (Spine2 기준, 좌우 대칭 — 측면 돌출이 시트의 특징. k 는 좌우 캡슐
    // 경계 주름이 정면 음영에 안 뜨는 하한 — 실루엣엔 안 잡힌다, 눈 검증 항목)
    // 시트 측면: 가슴은 아래로 처지고(b.y 낮게) 밑가슴→배로 곡선이 이어진다
    { joint: 'Spine2', mirrorX: true, a: [0.042, -0.030, 0.046], b: [0.050, -0.064, 0.096], ra: 0.042, rb: 0.054, k: 0.11, group: 'chest' },
    // 승모근 — 목밑에서 어깨로 흐르는 경사 (시트의 어깨 경사선. loft 전환 때 위로/넓게 —
    // 목 loft(k 0.05)와의 smin 웹이 f≈0.19 행의 어깨선 폭을 만든다)
    { joint: 'Spine2', mirrorX: true, a: [0.010, 0.115, 0.002], b: [0.075, 0.070, 0.0], ra: 0.026, rb: 0.032, group: 'chest' },
    // 둔부 (Hips 기준, 좌우 대칭 — 뒤로 볼록. 시트 측면 등 라인은 수직에 가까우니 과하게 뒤로 빼지 않는다)
    { joint: 'Hips', mirrorX: true, a: [0.048, 0.005, 0.002], b: [0.055, -0.055, -0.012], ra: 0.056, rb: 0.058, group: 'hips' },
    // 뒤꿈치 (후면에서 발이 바닥까지 닿아 보이게 + 측면 힐 라인)
    { joint: 'Foot', mirrorJoints: true, a: [0.0, -0.02, -0.01], b: [0.0, -0.052, -0.018], ra: 0.018, rb: 0.013, group: 'legs' },
    // 손바닥 (손가락 미표시 시에도 손목에서 끊기지 않게 — 손 로컬 +x = 팔 방향.
    // 3뷰 잔차 지도 공통 돌출부라 슬림하게)
    { joint: 'Hand', mirrorJoints: true, a: [0.0, 0.0, 0.0], b: [0.058, 0.0, 0.004], ra: 0.012, rb: 0.0075, group: 'arms' },
  ],
  // ---- 원판 로프트(disk-loft) 살 층 — eval/fit-loft.mjs 가 시트에서 피팅 (LOFT-PLAN) ----
  // 뼈(자식 관절 simple name, Left/Right 접두어 없이 매칭) → 원판 스택.
  // t: 뼈 축 위치(0=부모,1=자식,범위 밖=연장) · rx: 좌우 반경 · zf/zb: 앞/뒤 경계(관절 로컬 z)
  // xo: 단면 중심 좌우 오프셋(다리 — 미러 시 부호 반전) · disks:[] = 그 뼈 살 생략(UpLeg)
  // k: 이 스택의 smin fold 폭 (목 = 승모근·어깨와의 웹 — 어깨 경사선)
  // 재피팅: node eval/fit-loft.mjs --stage all (하위 단계 분할 실행은 파일 머리말 참조)
  loft: {
    'Spine': { group: 'waist', disks: [
      { t: -2.0136, rx: 0.0111, zf: 0.0106, zb: 0.0001 },
      { t: -1.664, rx: 0.0372, zf: 0.0231, zb: 0.0002 },
      { t: -1.3143, rx: 0.0743, zf: 0.0355, zb: 0.0003 },
      { t: -1.1214, rx: 0.0841, zf: 0.0438, zb: -0.0082 },
      { t: -0.9286, rx: 0.102, zf: 0.0741, zb: -0.0229 },
      { t: -0.7357, rx: 0.1155, zf: 0.102, zb: -0.0355 },
      { t: -0.5429, rx: 0.112, zf: 0.1253, zb: -0.0427 },
      { t: -0.35, rx: 0.1088, zf: 0.1242, zb: -0.0469 },
      { t: -0.1571, rx: 0.1028, zf: 0.1205, zb: -0.0496 },
      { t: 0.0357, rx: 0.0976, zf: 0.1128, zb: -0.0523 },
      { t: 0.2286, rx: 0.0923, zf: 0.1086, zb: -0.0535 },
      { t: 0.4214, rx: 0.0886, zf: 0.1044, zb: -0.0532 },
      { t: 0.6143, rx: 0.0856, zf: 0.1017, zb: -0.0514 },
      { t: 0.8071, rx: 0.0841, zf: 0.099, zb: -0.0485 },
      { t: 1, rx: 0.0833, zf: 0.0977, zb: -0.0471 },
    ] },
    'Spine1': { group: 'waist', disks: [
      { t: 0, rx: 0.0822, zf: 0.0941, zb: -0.0484 },
      { t: 0.2, rx: 0.081, zf: 0.0918, zb: -0.0477 },
      { t: 0.4, rx: 0.0799, zf: 0.0888, zb: -0.0475 },
      { t: 0.6, rx: 0.0791, zf: 0.0858, zb: -0.0448 },
      { t: 0.8, rx: 0.0784, zf: 0.0828, zb: -0.0482 },
      { t: 1, rx: 0.0777, zf: 0.0806, zb: -0.0504 },
    ] },
    'Spine2': { group: 'chest', disks: [
      { t: 0, rx: 0.0757, zf: 0.0778, zb: -0.0511 },
      { t: 0.1667, rx: 0.0745, zf: 0.0763, zb: -0.0499 },
      { t: 0.3333, rx: 0.0715, zf: 0.0732, zb: -0.0474 },
      { t: 0.5, rx: 0.069, zf: 0.0693, zb: -0.0508 },
      { t: 0.6667, rx: 0.0675, zf: 0.0671, zb: -0.0547 },
      { t: 0.8333, rx: 0.0675, zf: 0.067, zb: -0.0576 },
      { t: 1, rx: 0.0675, zf: 0.0676, zb: -0.0584 },
    ] },
    'Neck': { group: 'chest', k: 0.05, disks: [
      { t: 0, rx: 0.0653, zf: 0.0645, zb: -0.0637 },
      { t: 0.25, rx: 0.0615, zf: 0.0613, zb: -0.0595 },
      { t: 0.5, rx: 0.0555, zf: 0.0566, zb: -0.0565 },
      { t: 0.75, rx: 0.0495, zf: 0.0538, zb: -0.0491 },
      { t: 1, rx: 0.0473, zf: 0.0533, zb: -0.0481 },
    ] },
    'Head': { group: 'head', k: 0.025, disks: [
      { t: 0, rx: 0.0428, zf: 0.0449, zb: -0.0629 },
      { t: 0.1, rx: 0.0413, zf: 0.0363, zb: -0.0635 },
      { t: 0.2, rx: 0.0433, zf: 0.0242, zb: -0.064 },
      { t: 0.3, rx: 0.0434, zf: 0.0379, zb: -0.0645 },
      { t: 0.4, rx: 0.042, zf: 0.0455, zb: -0.064 },
      { t: 0.5, rx: 0.0508, zf: 0.0664, zb: -0.0641 },
      { t: 0.6, rx: 0.054, zf: 0.0693, zb: -0.0652 },
      { t: 0.7, rx: 0.0655, zf: 0.0872, zb: -0.0693 },
      { t: 0.8, rx: 0.0672, zf: 0.0956, zb: -0.0778 },
      { t: 0.9, rx: 0.0835, zf: 0.0967, zb: -0.0894 },
      { t: 1, rx: 0.0908, zf: 0.0972, zb: -0.0964 },
    ] },
    // 두정: round-cone 은 "구 껍질" — 마지막 원판의 구형 돔이 정수리를 그린다 (fit 이
    // crown 높이에 정확히 맞춰 자름. 급한 테이퍼 원판을 더 얹으면 두정이 솟는다 — 교훈)
    'HeadTop_End': { group: 'head', disks: [
      { t: 0, rx: 0.1009, zf: 0.0912, zb: -0.1075 },
      { t: 0.24, rx: 0.1019, zf: 0.0927, zb: -0.1111 },
      { t: 0.48, rx: 0.0997, zf: 0.0885, zb: -0.1165 },
      { t: 0.72, rx: 0.0976, zf: 0.0912, zb: -0.1196 },
      { t: 0.96, rx: 0.091, zf: 0.0882, zb: -0.1149 },
    ] },
    'Leg': { group: 'legs', disks: [
      { t: 0.04, rx: 0.0757, zf: 0.0708, zb: -0.0643, xo: 0.0052 },
      { t: 0.12, rx: 0.0739, zf: 0.0695, zb: -0.0625, xo: 0.0058 },
      { t: 0.2, rx: 0.0654, zf: 0.0673, zb: -0.0606, xo: 0.0051 },
      { t: 0.28, rx: 0.0649, zf: 0.0661, zb: -0.0571, xo: 0.0059 },
      { t: 0.36, rx: 0.0628, zf: 0.0654, zb: -0.0598, xo: 0.006 },
      { t: 0.44, rx: 0.0587, zf: 0.0639, zb: -0.0605, xo: 0.0041 },
      { t: 0.52, rx: 0.054, zf: 0.0591, zb: -0.0606, xo: 0.0017 },
      { t: 0.6, rx: 0.0498, zf: 0.053, zb: -0.055, xo: -0.0003 },
      { t: 0.68, rx: 0.0467, zf: 0.0475, zb: -0.0515, xo: -0.0022 },
      { t: 0.76, rx: 0.0465, zf: 0.0433, zb: -0.0514, xo: -0.0049 },
      { t: 0.84, rx: 0.0432, zf: 0.0455, zb: -0.0513, xo: 0.0001 },
      { t: 1, rx: 0.0423, zf: 0.0468, zb: -0.052, xo: 0.0019 },
    ] },
    'Foot': { group: 'legs', disks: [
      { t: 0, rx: 0.0411, zf: 0.0526, zb: -0.05, xo: 0.0104 },
      { t: 0.0746, rx: 0.0435, zf: 0.0522, zb: -0.0498, xo: 0.0105 },
      { t: 0.1492, rx: 0.0475, zf: 0.0513, zb: -0.0493, xo: 0.0101 },
      { t: 0.2238, rx: 0.047, zf: 0.0505, zb: -0.0488, xo: 0.0103 },
      { t: 0.2985, rx: 0.0444, zf: 0.0496, zb: -0.0484, xo: 0.0095 },
      { t: 0.3731, rx: 0.04, zf: 0.0488, zb: -0.0479, xo: 0.0079 },
      { t: 0.4477, rx: 0.0358, zf: 0.048, zb: -0.0474, xo: 0.0066 },
      { t: 0.5223, rx: 0.0317, zf: 0.0471, zb: -0.047, xo: 0.0052 },
      { t: 0.5969, rx: 0.0285, zf: 0.0463, zb: -0.0465, xo: 0.0048 },
      { t: 0.6715, rx: 0.0254, zf: 0.0454, zb: -0.046, xo: 0.0046 },
      { t: 0.7462, rx: 0.0243, zf: 0.0446, zb: -0.0456, xo: 0.0043 },
      { t: 0.8208, rx: 0.0248, zf: 0.0437, zb: -0.0451, xo: 0.0035 },
      { t: 0.8954, rx: 0.0254, zf: 0.043, zb: -0.0446, xo: 0.0016 },
      { t: 0.97, rx: 0.0256, zf: 0.0426, zb: -0.0443, xo: 0.0007 },
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
