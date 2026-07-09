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
    shoulderX: 0.04, shoulderY: 0.075,
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
    // ---- 두상 (subBones 와 세트) -------------------------------------------
    // 얼굴 평면: flatten2 f<0 = one-sided — 앞(+z) 반만 납작, 뒤통수는 원형 유지.
    // 두개골을 이루는 캡슐(Skull·HeadTop·Occiput)이 같은 평면을 공유해야 이음새가 없다.
    // Head 관절 자체는 가는 목-스텁(r 0.032) — 목→머리 테이퍼 콘이 턱밑을 삼키지 않게.
    { match: 'Skull',    r: 0.086, group: 'head', k: 0.065, flatten: { dir: [1, 0, 0], f: 0.89 }, flatten2: { dir: [0, 0, 1], f: -0.82 } }, // 두개골 본체
    { match: 'Occiput',  r: 0.060, group: 'head', k: 0.065, flatten: { dir: [1, 0, 0], f: 0.89 }, flatten2: { dir: [0, 0, 1], f: -0.82 } }, // 뒤통수
    { match: 'JawSide',  r: 0.042, group: 'head' },                    // 귀밑점/뺨 (link 없음 — 앵커. 정면 뺨 폭 담당)
    { match: 'JawTip',   r: 0.011, group: 'head', k: 0.048 },          // 턱끝 — 두개골 하단에 매끈히 붙되 뾰족함 유지
    { match: 'HeadTop',  r: 0.084, group: 'head', k: 0.065, flatten: { dir: [1, 0, 0], f: 0.89 }, flatten2: { dir: [0, 0, 1], f: -0.82 } }, // 정수리
    { match: 'Head',     r: 0.032, group: 'head' },
    { match: 'Shoulder', r: 0.035, group: 'chest' },
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
  // 가상 하위 뼈 — 부모 관절 로컬 오프셋(m)으로 세분화 체인을 합성 (애니메이션 무영향).
  // 두께/디테일은 rules 의 이름 매칭으로 결정 — grammar 원칙 그대로.
  subBones: [
    // 두개골 본체 — Head 관절(목 스텁) 위 (측면 시트: 눈높이 앞면 ~0.128, 뒤통수 ~-0.046)
    { name: 'Skull',   parent: 'Head', offset: [0, 0.028, 0.006] },
    // 뒤통수 — 두개골 중심에서 뒤로 (시트 측면의 후두 돌출)
    { name: 'Occiput', parent: 'Skull', offset: [0, 0.004, -0.046] },
    // 턱 — 귀밑 앵커(link 없음)에서 턱끝으로 수렴하는 좌우 쐐기 → 각진 턱선 + 뾰족한 턱
    { name: 'JawSide', parent: 'Head', offset: [0.056, -0.028, 0.016], mirrorX: true, link: false },
    { name: 'JawTip',  parent: 'JawSide', offset: [-0.050, -0.052, 0.040], mirrorX: true },
  ],
  // 볼륨 헬퍼 — joint 로컬 공간(m): +x=캐릭터 왼쪽, +y=위, +z=정면
  extras: [
    // 가슴 (Spine2 기준, 좌우 대칭 — 측면 돌출이 시트의 특징. k 는 좌우 캡슐
    // 경계 주름이 정면 음영에 안 뜨는 하한 — 실루엣엔 안 잡힌다, 눈 검증 항목)
    // 시트 측면: 가슴은 아래로 처지고(b.y 낮게) 밑가슴→배로 곡선이 이어진다
    { joint: 'Spine2', mirrorX: true, a: [0.042, -0.030, 0.046], b: [0.050, -0.064, 0.096], ra: 0.042, rb: 0.054, k: 0.11, group: 'chest' },
    // 승모근 — 목밑에서 어깨로 흐르는 경사 (시트의 수평 어깨선. 목이 덜 앙상해 보인다)
    { joint: 'Spine2', mirrorX: true, a: [0.012, 0.088, 0.004], b: [0.062, 0.058, 0.0], ra: 0.020, rb: 0.026, group: 'chest' },
    // 목덜미 — 목 뒤를 따라 오르는 승모근 상부 (측면 뒷목/후면 목 폭. 시트 잔차 지도 대응)
    { joint: 'Neck', a: [0.0, 0.005, -0.012], b: [0.0, 0.055, -0.028], ra: 0.024, rb: 0.016, group: 'chest' },
    // 둔부 (Hips 기준, 좌우 대칭 — 뒤로 볼록. 시트 측면 등 라인은 수직에 가까우니 과하게 뒤로 빼지 않는다)
    { joint: 'Hips', mirrorX: true, a: [0.048, 0.005, 0.002], b: [0.055, -0.055, -0.012], ra: 0.056, rb: 0.058, group: 'hips' },
    // 아랫배 — 시트 측면의 완만한 복부 전방 곡선 (둔부를 앞으로 당긴 만큼 앞폭을 채운다)
    { joint: 'Hips', a: [0.0, 0.015, 0.048], b: [0.0, -0.045, 0.068], ra: 0.050, rb: 0.048, group: 'hips' },
    // 골반 옆폭 (Hips → 고관절 옆라인)
    { joint: 'Hips', mirrorX: true, a: [0.042, -0.01, 0.0], b: [0.068, -0.065, 0.0], ra: 0.048, rb: 0.048, group: 'hips' },
    // 종아리 (Leg=무릎 아래 — 캡슐 선형 테이퍼로는 안 나오는 볼록 실루엣.
    // 후면 뷰가 과폭이라 반지름은 절제 — 볼록함은 뒤(z-) 방향 위주)
    { joint: 'Leg', mirrorJoints: true, a: [0.0, -0.08, -0.006], b: [0.0, -0.15, -0.012], ra: 0.034, rb: 0.030, group: 'legs' },
    // 뒤꿈치 (후면에서 발이 바닥까지 닿아 보이게 + 측면 힐 라인)
    { joint: 'Foot', mirrorJoints: true, a: [0.0, -0.02, -0.01], b: [0.0, -0.052, -0.018], ra: 0.018, rb: 0.013, group: 'legs' },
    // 손바닥 (손가락 미표시 시에도 손목에서 끊기지 않게 — 손 로컬 +x = 팔 방향.
    // 3뷰 잔차 지도 공통 돌출부라 슬림하게)
    { joint: 'Hand', mirrorJoints: true, a: [0.0, 0.0, 0.0], b: [0.058, 0.0, 0.004], ra: 0.012, rb: 0.0075, group: 'arms' },
  ],
  defaults: { k: 0.05 }, // 가는 팔·목이 살아남아야 하는 체형 — smin 좁게
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
