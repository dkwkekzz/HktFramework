// ============================================================================
//  anatomy.js — 근육 아틀라스 (해부학 레퍼런스 기반 데이터)
//
//  파이프라인 2단계(근육)의 유일한 데이터 소스. 각 항목은 "이 근육이 어느 뼈에서
//  시작(origin)해 어느 뼈에 붙는가(insertion)"를 Mixamo 뼈 이름으로 근사한다.
//  실제 해부학의 기시/정지 뼈를 스켈레톤에서 가장 가까운 관절로 매핑했다 —
//  주석의 (기시→정지)가 근거, from/to 가 그 근사다.
//
//  레퍼런스:
//   - Deltoid: 쇄골 외측·견봉·견갑극 → 상완골 삼각근조면 (Kenhub / AnatomyZone).
//   - Biceps brachii: 견갑골 → 요골조면, 상완 전면 벨리 (Kenhub).
//   - Triceps brachii: 견갑골·상완골 후면 → 주두. 상완 후면.
//   - Pectoralis major: 쇄골·흉골·늑연골 → 상완골 대결절 (Kenhub / Wikipedia).
//   - Latissimus dorsi: 하부 흉추·요추·장골 → 상완골 결절간구.
//   - Trapezius(상부): 후두골·경추 → 쇄골 외측·견봉.
//   - Rectus abdominis: 치골 → 5~7 늑연골·검상돌기 (복직근, 몸통 전면).
//   - External oblique: 하부 늑골 → 장골능·백선 (외복사근, 몸통 측면).
//   - Sternocleidomastoid: 흉골·쇄골 → 유양돌기 (목 전측면).
//   - Gluteus maximus: 장골·천골 → 대퇴골 둔근조면·장경인대.
//   - Quadriceps femoris: 장골·대퇴골 → 슬개골·경골조면 (대퇴 전면 4두).
//   - Hamstrings: 좌골결절 → 경골·비골 (대퇴 후면).
//   - Adductor group: 치골·좌골 → 대퇴골 조선 (대퇴 내측).
//   - Gastrocnemius: 대퇴골 내·외측과 → 종골(아킬레스건) (하퇴 후면).
//   - Tibialis anterior: 경골 외측 → 설상골·중족골 (정강이 전면).
//
//  좌표 프레임(muscles.js 가 계산): 벨리 축 A = normalize(to-from).
//   off = { a, l }  — a: 전(+)/후(-) 오프셋(m), l: 측면 오프셋(m). 좌우는
//   lat = cross(A, anterior) 가 팔·다리 방향(±)에 따라 자동으로 뒤집혀 대칭이 된다.
//   along: 벨리 중심을 축을 따라 이동(-0.5~0.5, 0=중점). span: 벨리 반길이 비율(축길이×).
//   r: 벨리 최대 반지름(m), taper: 양끝 반지름 비율, bulge: 수축 시 두꺼워지는 정도.
// ============================================================================

// 전면(anterior) 월드 방향. Mixamo 리그가 +Z 를 바라본다는 가정 — 앞/뒤가
// 뒤집혀 보이면 이 값의 부호만 바꾸면 전신 전·후면 근육이 함께 교정된다.
export const FACING = 1;

// 정중선(centerline) 뼈 — 좌우 전개 시 접두어를 붙이지 않는다. 나머지(arm/leg 등)만
// left/right 를 붙인다. 예: 대흉근은 흉골(spine2, 정중선)에서 시작해 상완골(arm, 좌우)에
// 붙으므로 from='spine2'(그대로) · to='leftarm'/'rightarm'.
const CENTERLINE = new Set(['hips', 'spine', 'spine1', 'spine2', 'neck', 'head']);
const sided = (name, pre) => (CENTERLINE.has(name) ? name : pre + name);

// 좌우 공용 템플릿을 L/R 두 항목으로 전개한다. lat 오프셋은 프레임이 자동 대칭.
function pair(t) {
  const mk = (side, pre) => ({
    ...t, id: `${t.id}.${side}`, side,
    from: sided(t.from, pre), to: sided(t.to, pre),
  });
  return [mk('L', 'left'), mk('R', 'right')];
}

// r/off 단위는 미터 (캐릭터 키 ≈ 1.7m 기준).
const CENTER = [
  // 복직근 — 골반에서 흉곽 전면까지 몸통 앞면의 판.
  { id: 'rectusAbdominis', kr: '복직근', side: 'C', from: 'hips', to: 'spine1',
    off: { a: 0.10, l: 0 }, along: 0.05, span: 0.62, r: 0.085, taper: 0.55, bulge: 0.10 },
];

const PAIRED = [
  // ---- 몸통 -------------------------------------------------------------
  { id: 'pectoralis', kr: '대흉근', from: 'spine2', to: 'arm',
    off: { a: 0.11, l: 0.02 }, along: 0.1, span: 0.7, r: 0.085, taper: 0.5, bulge: 0.18 },
  { id: 'latissimus', kr: '광배근', from: 'spine', to: 'arm',
    off: { a: -0.10, l: 0.05 }, along: 0.15, span: 0.75, r: 0.09, taper: 0.45, bulge: 0.12 },
  { id: 'trapezius', kr: '승모근', from: 'neck', to: 'shoulder',
    off: { a: -0.05, l: 0 }, along: 0, span: 0.9, r: 0.06, taper: 0.55, bulge: 0.10 },
  { id: 'oblique', kr: '외복사근', from: 'hips', to: 'spine1',
    off: { a: 0.03, l: 0.10 }, along: 0.05, span: 0.6, r: 0.06, taper: 0.6, bulge: 0.10 },
  // ---- 목 ---------------------------------------------------------------
  { id: 'scm', kr: '흉쇄유돌근', from: 'head', to: 'spine2',
    off: { a: 0.05, l: 0.03 }, along: 0.1, span: 0.7, r: 0.024, taper: 0.6, bulge: 0.08 },
  // ---- 어깨 -------------------------------------------------------------
  { id: 'deltoid', kr: '삼각근', from: 'arm', to: 'forearm',
    off: { a: 0, l: 0.055 }, along: -0.28, span: 0.5, r: 0.06, taper: 0.5, bulge: 0.15 },
  // ---- 상완 -------------------------------------------------------------
  { id: 'biceps', kr: '상완이두근', from: 'arm', to: 'forearm',
    off: { a: 0.045, l: 0 }, along: 0.02, span: 0.62, r: 0.048, taper: 0.45, bulge: 0.32 },
  { id: 'triceps', kr: '상완삼두근', from: 'arm', to: 'forearm',
    off: { a: -0.045, l: 0 }, along: 0.02, span: 0.65, r: 0.052, taper: 0.45, bulge: 0.22 },
  // ---- 전완 -------------------------------------------------------------
  { id: 'forearm', kr: '전완근군', from: 'forearm', to: 'hand',
    off: { a: 0.01, l: 0 }, along: -0.1, span: 0.7, r: 0.05, taper: 0.4, bulge: 0.15 },
  // ---- 둔부 -------------------------------------------------------------
  { id: 'gluteus', kr: '대둔근', from: 'hips', to: 'upleg',
    off: { a: -0.09, l: 0.05 }, along: 0.35, span: 0.55, r: 0.09, taper: 0.6, bulge: 0.12 },
  // ---- 대퇴 -------------------------------------------------------------
  { id: 'quadriceps', kr: '대퇴사두근', from: 'upleg', to: 'leg',
    off: { a: 0.07, l: 0 }, along: 0.05, span: 0.72, r: 0.095, taper: 0.5, bulge: 0.22 },
  { id: 'hamstrings', kr: '햄스트링', from: 'upleg', to: 'leg',
    off: { a: -0.06, l: 0 }, along: 0.05, span: 0.72, r: 0.085, taper: 0.5, bulge: 0.16 },
  { id: 'adductor', kr: '내전근군', from: 'hips', to: 'leg',
    off: { a: 0.02, l: -0.07 }, along: 0.3, span: 0.55, r: 0.06, taper: 0.55, bulge: 0.12 },
  // ---- 하퇴 -------------------------------------------------------------
  { id: 'gastrocnemius', kr: '비복근', from: 'leg', to: 'foot',
    off: { a: -0.05, l: 0 }, along: -0.18, span: 0.55, r: 0.06, taper: 0.45, bulge: 0.28 },
  { id: 'tibialis', kr: '전경골근', from: 'leg', to: 'foot',
    off: { a: 0.045, l: 0.01 }, along: -0.1, span: 0.6, r: 0.035, taper: 0.5, bulge: 0.12 },
];

export const MUSCLES = [...CENTER, ...PAIRED.flatMap(pair)];

// 뼈 자체도 피부 필드에 기여한다(살이 얇은 정강이·손·발·머리를 채운다).
// 각 항목: 뼈 세그먼트(bone → child) 를 감싸는 얇은 캡슐 반지름.
export const BONE_PADDING = [
  { re: /^head$/, r: 0.095 },
  { re: /^neck$/, r: 0.05 },
  { re: /^spine2$/, r: 0.11 },
  { re: /^spine1$/, r: 0.10 },
  { re: /^spine$/, r: 0.10 },
  { re: /^hips$/, r: 0.11 },
  { re: /shoulder$/, r: 0.05 },
  { re: /^(left|right)arm$/, r: 0.045 },
  { re: /forearm$/, r: 0.038 },
  { re: /^(left|right)hand$/, r: 0.035 },
  { re: /upleg$/, r: 0.075 },
  { re: /^(left|right)leg$/, r: 0.05 },
  { re: /foot$/, r: 0.04 },
];
