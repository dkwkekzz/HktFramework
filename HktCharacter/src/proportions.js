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
    neckLen: 0.09, neckZ: 0.01,     // 목밑 1.29 ≈ 어깨선
    headLen: 0.17, headZ: 0.01,     // 두개골 중심 1.46 — 구 아래끝(턱) ~1.36, 목이 드러난다
    headTopLen: 0.06, headTopZ: 0.0,
    shoulderX: 0.04, shoulderY: 0.06,
    armX: 0.085,                    // 어깨 폭 절반 ≈ 0.125 + 삼각근 살 → 전체 ~0.36
    upperArmLen: 0.25, foreArmLen: 0.23,
    upLegX: 0.08, upLegY: -0.07,    // 고관절 0.81 (골반 최광부)
    thighLen: 0.35, shinLen: 0.37,  // 무릎 0.46 · 발목 0.09
    footDrop: 0.055, toeZ: 0.13,
    fingers: [['Thumb', 0.55, 0.025], ['Index', 0.14, 0.034], ['Middle', -0.02, 0.038], ['Ring', -0.16, 0.034], ['Pinky', -0.30, 0.027]],
  },
  rules: [
    { match: '=Hips',    r: 0.100, group: 'hips'  },
    { match: 'Spine2',   r: 0.092, group: 'chest' }, // 흉곽 — 가슴 볼륨은 extras 담당
    { match: 'Spine1',   r: 0.082, group: 'waist' },
    { match: 'Spine',    r: 0.080, group: 'waist' }, // 허리 최협부 — 전체 폭 ~0.19
    { match: 'Neck',     r: 0.026, group: 'chest' },
    { match: 'HeadTop',  r: 0.102, group: 'head'  }, // 'HeadTop_End' 포함 — 정수리
    { match: 'Head',     r: 0.105, group: 'head'  }, // 두상 폭 ~0.21 — 정수리까지 둥근 두개골
    { match: 'Shoulder', r: 0.038, group: 'chest' },
    { match: 'ForeArm',  r: 0.024, group: 'arms'  },
    { match: 'Arm',      r: 0.030, group: 'arms'  },
    { match: 'Hand',     r: 0.019, group: 'arms'  },
    { match: 'UpLeg',    r: 0.076, group: 'legs'  }, // 허벅지 상단 — 골반 폭에도 기여
    { match: 'Leg',      r: 0.046, group: 'legs'  }, // 무릎
    { match: 'ToeBase',  r: 0.026, group: 'legs'  },
    { match: 'Toe',      r: 0.026, group: 'legs'  }, // 'Toe_End' 포함 (아래 '_End' 보다 먼저)
    { match: 'Foot',     r: 0.025, group: 'legs'  }, // 발목 — 가늘게
    { match: '_End',     r: 0.020, group: 'arms'  }, // 그 밖의 말단 nub (임의 리그) — 작게
    { match: 'Thumb',    r: 0.010, group: 'arms'  },
    { match: 'Index',    r: 0.010, group: 'arms'  },
    { match: 'Middle',   r: 0.010, group: 'arms'  },
    { match: 'Ring',     r: 0.010, group: 'arms'  },
    { match: 'Pinky',    r: 0.010, group: 'arms'  },
    { match: 'Finger',   r: 0.010, group: 'arms'  },
  ],
  fallback: 0.04,
  // 볼륨 헬퍼 — joint 로컬 공간(m): +x=캐릭터 왼쪽, +y=위, +z=정면
  extras: [
    // 가슴 (Spine2 기준, 좌우 대칭)
    { joint: 'Spine2', mirrorX: true, a: [0.042, -0.035, 0.045], b: [0.050, -0.07, 0.082], ra: 0.048, rb: 0.058, group: 'chest' },
    // 둔부 (Hips 기준, 좌우 대칭 — 뒤로 볼록)
    { joint: 'Hips', mirrorX: true, a: [0.050, 0.005, -0.025], b: [0.058, -0.055, -0.048], ra: 0.062, rb: 0.070, group: 'hips' },
    // 골반 옆폭 (Hips → 고관절 옆라인, 시트의 최광부 0.33 확보)
    { joint: 'Hips', mirrorX: true, a: [0.045, -0.01, 0.0], b: [0.078, -0.065, 0.0], ra: 0.052, rb: 0.052, group: 'hips' },
    // 종아리 (Leg=무릎 아래 — 캡슐 선형 테이퍼로는 안 나오는 볼록 실루엣)
    { joint: 'Leg', mirrorJoints: true, a: [0.0, -0.08, -0.006], b: [0.0, -0.15, -0.012], ra: 0.038, rb: 0.034, group: 'legs' },
    // 손바닥 (손가락 미표시 시에도 손목에서 끊기지 않게 — 손 로컬 +x = 팔 방향)
    { joint: 'Hand', mirrorJoints: true, a: [0.0, 0.0, 0.0], b: [0.075, 0.0, 0.005], ra: 0.019, rb: 0.013, group: 'arms' },
  ],
  defaults: { k: 0.05 }, // 가는 팔·목이 살아남아야 하는 체형 — smin 좁게
  pose: { armDown: 1.33 }, // 시트처럼 팔을 늘어뜨림 (1.4+ 는 손이 골반 SDF 에 융착)
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
