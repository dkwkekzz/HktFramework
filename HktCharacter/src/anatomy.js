// ============================================================================
//  anatomy.js — 근육 아틀라스 (해부학 레퍼런스 기반 데이터)
//
//  파이프라인 2단계(근육)의 유일한 데이터 소스. 각 근육은 어느 뼈에서 시작(origin)
//  해 어느 뼈에 붙는가(insertion)를 **부착 패치(AttachmentPatch)** 로 표현한다 —
//  설계서 §7.1·§9.5. 부착은 월드 좌표가 아니라 "뼈 + 그 뼈 원점에서의 프레임
//  오프셋"으로 저장하므로, 뼈 길이·비율이 달라져도 부착 관계가 깨지지 않는다.
//  (WP-01: AttachmentPatch-lite 승격. 상세: docs/WORKPLAN.md)
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
//  데이터 모델 (MuscleSpec-lite, 설계서 §7.1·§7.2·§23):
//   근육 = {
//     origins:[AttachmentPatch], insertions:[AttachmentPatch],  // 부착(다두근은 2+)
//     architecture,          // §8 근육 형태 원형 (현재 전부 Fusiform, WP-03 에서 다양화)
//     along, span, r, taper, bulge,  // 벨리 형상 (r=최대 반지름, taper=양끝 비율)
//   }
//   AttachmentPatch = { bone, off:{a,l}, role }
//     - bone: 부착 뼈(Mixamo simpleName). off: 그 뼈 원점에서 벨리 프레임 오프셋(m).
//       a = 전(+)/후(-), l = 측면. 좌우는 프레임의 lat 이 자동 대칭(muscles.js).
//     - role: 'origin' | 'insertion'. 부착 반지름은 patchRadius(def)=r×taper 로 파생.
// ============================================================================

// 전면(anterior) 월드 방향. Mixamo 리그가 +Z 를 바라본다는 가정 — 앞/뒤가
// 뒤집혀 보이면 이 값의 부호만 바꾸면 전신 전·후면 근육이 함께 교정된다.
export const FACING = 1;

// 정중선(centerline) 뼈 — 좌우 전개 시 접두어를 붙이지 않는다. 나머지(arm/leg 등)만
// left/right 를 붙인다. 예: 대흉근은 흉골(spine2, 정중선)에서 시작해 상완골(arm, 좌우)에
// 붙으므로 origin.bone='spine2'(그대로) · insertion.bone='leftarm'/'rightarm'.
const CENTERLINE = new Set(['hips', 'spine', 'spine1', 'spine2', 'neck', 'head']);
const sided = (name, pre) => (CENTERLINE.has(name) ? name : pre + name);

// 부착 패치 생성 헬퍼. off 는 벨리 프레임에서의 (전후 a, 측면 l) 오프셋(m).
//  t: 앵커 뼈 원점→그 뼈의 자식 뼈 방향(distal)으로의 위치(0=피벗, 0.3=뼈의 30% 지점).
//  근육이 관절을 넘어가게 하는 핵심 — 정지부를 원위 뼈 아래로 내리면 관절 굴곡이
//  실제로 근육을 짧게 만들어 부피 보존 bulge 가 발동한다(설계서 §10·Phase1 완료조건).
const O = (bone, a, l, t = 0) => ({ bone, off: { a, l }, t, role: 'origin' });
const I = (bone, a, l, t = 0) => ({ bone, off: { a, l }, t, role: 'insertion' });

// 부착 패치의 footprint 반지름(m) = 벨리 최대 반지름 × 양끝 taper 비율.
// (벨리 양 끝이 실제로 그 반지름으로 좁아지므로 힘줄·부착 면적의 근사다.) 설계서 §7.1.
export const patchRadius = def => +(def.r * def.taper).toFixed(4);

// 방추형 스웹 프로필(설계서 §7.2·§8·§23): 기시→정지로 가는 반지름 배율(0..1, 최대 1).
// 가는 힘줄 끝(0.12) → 중앙 근복 벌크(1.0) → 가는 끝. 단일 타원체가 아니라 이 프로필을
// 중심선 위로 스웹해 근육이 "가늘고 길게" 보이게 한다(WP-03 ①). 근육이 def.profile 로
// 개별 지정하지 않으면 이 기본값을 쓴다. 벌크는 중앙에서 살짝 기시 쪽으로 치우친다.
export const DEFAULT_FUSIFORM = [0.12, 0.5, 0.85, 1.0, 0.92, 0.6, 0.16];

// 좌우 공용 템플릿을 L/R 두 항목으로 전개한다. 각 패치 bone 을 side 접두어로 사이드화하고
// (정중선 뼈는 그대로), lat 오프셋은 프레임이 자동 대칭한다.
function pair(t) {
  const mk = (side, pre) => ({
    ...t, id: `${t.id}.${side}`, side,
    origins: t.origins.map(p => ({ ...p, bone: sided(p.bone, pre) })),
    insertions: t.insertions.map(p => ({ ...p, bone: sided(p.bone, pre) })),
    wrap: t.wrap ? { ...t.wrap, joint: sided(t.wrap.joint, pre) } : undefined,
    jointInf: t.jointInf ? { ...t.jointInf, joint: sided(t.jointInf.joint, pre) } : undefined,
  });
  return [mk('L', 'left'), mk('R', 'right')];
}

// r/off 단위는 미터 (캐릭터 키 ≈ 1.7m 기준).
const CENTER = [
  // 복직근 — 골반에서 흉곽 전면까지 몸통 앞면의 판.
  { id: 'rectusAbdominis', kr: '복직근', side: 'C', architecture: 'Sheet',
    origins: [O('hips', 0.10, 0)], insertions: [I('spine1', 0.10, 0)],
    along: 0.05, span: 0.62, r: 0.085, taper: 0.55, bulge: 0.10 },
];

const PAIRED = [
  // ---- 몸통 (넓적한 근육 = Fan/Sheet: 판·부채꼴로 납작하게) ----------------
  //  대흉근: 흉골에서 부채꼴로 퍼져 상완골로 수렴 → Fan. 흉곽에 납작하게 눌린다.
  { id: 'pectoralis', kr: '대흉근', architecture: 'Fan',
    origins: [O('spine2', 0.11, 0.02)], insertions: [I('arm', 0.11, 0.02)],
    along: 0.1, span: 0.7, r: 0.085, taper: 0.5, bulge: 0.18 },
  { id: 'latissimus', kr: '광배근', architecture: 'Fan',
    origins: [O('spine', -0.10, 0.05)], insertions: [I('arm', -0.10, 0.05)],
    along: 0.15, span: 0.75, r: 0.09, taper: 0.45, bulge: 0.12 },
  { id: 'trapezius', kr: '승모근', architecture: 'Fan',
    origins: [O('neck', -0.05, 0)], insertions: [I('shoulder', -0.05, 0)],
    along: 0, span: 0.9, r: 0.06, taper: 0.55, bulge: 0.10 },
  { id: 'oblique', kr: '외복사근', architecture: 'Sheet',
    origins: [O('hips', 0.03, 0.10)], insertions: [I('spine1', 0.03, 0.10)],
    along: 0.05, span: 0.6, r: 0.06, taper: 0.6, bulge: 0.10 },
  // ---- 목 ---------------------------------------------------------------
  { id: 'scm', kr: '흉쇄유돌근', architecture: 'Fusiform',
    origins: [O('head', 0.05, 0.03)], insertions: [I('spine2', 0.05, 0.03)],
    along: 0.1, span: 0.7, r: 0.024, taper: 0.6, bulge: 0.08 },
  // ---- 어깨 -------------------------------------------------------------
  { id: 'deltoid', kr: '삼각근', architecture: 'Fusiform',
    origins: [O('arm', 0, 0.055)], insertions: [I('forearm', 0, 0.055)],
    along: -0.28, span: 0.5, r: 0.06, taper: 0.5, bulge: 0.15 },
  // ---- 상완 (관절 통과: 정지부를 전완 아래로 내려 팔꿈치 굴곡에 반응) ----------
  //  이두근: 어깨(견갑골 근사)→요골. 정지부 t=0.30 로 전완을 넘어가므로 팔을 굽히면
  //  원점−정지 거리가 줄어 짧아지고 굵어진다. along 음수로 벨리 덩어리는 상완에 유지.
  //  이두근: 정지부가 전완을 넘어가고(t=0.30) 팔꿈치 **전방**을 wrap 으로 우회한다(§6·§7.5).
  //  굴곡 시 전방 경로가 짧아져 단축·굵어짐(부피 보존). wrap 이 깊은 굴곡에서 뼈 관통을 막는다.
  { id: 'biceps', kr: '상완이두근', architecture: 'Fusiform',
    origins: [O('arm', 0.045, 0, 0)], insertions: [I('forearm', 0.045, 0, 0.30)],
    wrap: { joint: 'forearm', face: 'ant', clearance: 0.02 },
    along: -0.20, span: 0.58, r: 0.048, taper: 0.4, bulge: 0.32 },
  //  삼두근: 이두의 **길항근**(§10.5). 팔꿈치 후방 wrap 으로 관통을 막고(§6), **기능 근육
  //  jointInf**(§7.4·§10.1)로 굴곡 시 신장한다 — 길이를 관절 굴곡각의 함수로 잇는다(momentArm).
  { id: 'triceps', kr: '상완삼두근', architecture: 'Fusiform',
    origins: [O('arm', -0.045, 0)], insertions: [I('forearm', -0.045, 0)],
    wrap: { joint: 'forearm', face: 'post', clearance: 0.02 },
    jointInf: { joint: 'forearm', antagonist: true, gain: 0.12 },
    along: 0.02, span: 0.65, r: 0.052, taper: 0.45, bulge: 0.22 },
  // ---- 전완 -------------------------------------------------------------
  { id: 'forearm', kr: '전완근군', architecture: 'Fusiform',
    origins: [O('forearm', 0.01, 0)], insertions: [I('hand', 0.01, 0)],
    along: -0.1, span: 0.7, r: 0.05, taper: 0.4, bulge: 0.15 },
  // ---- 둔부 -------------------------------------------------------------
  // 대둔근: 넓지만 두툼 → Fan 이되 depth(d) 를 높여 덜 납작하게.
  { id: 'gluteus', kr: '대둔근', architecture: 'Fan', w: 1.35, d: 0.7,
    origins: [O('hips', -0.09, 0.05)], insertions: [I('upleg', -0.09, 0.05)],
    along: 0.2, span: 0.6, r: 0.09, taper: 0.6, bulge: 0.12 },
  // ---- 대퇴 -------------------------------------------------------------
  { id: 'quadriceps', kr: '대퇴사두근', architecture: 'Fusiform',
    origins: [O('upleg', 0.07, 0)], insertions: [I('leg', 0.07, 0)],
    along: 0.05, span: 0.72, r: 0.095, taper: 0.5, bulge: 0.22 },
  { id: 'hamstrings', kr: '햄스트링', architecture: 'Fusiform',
    origins: [O('upleg', -0.06, 0)], insertions: [I('leg', -0.06, 0)],
    along: 0.05, span: 0.72, r: 0.085, taper: 0.5, bulge: 0.16 },
  { id: 'adductor', kr: '내전근군', architecture: 'Fusiform',
    origins: [O('hips', 0.02, -0.07)], insertions: [I('leg', 0.02, -0.07)],
    along: 0.3, span: 0.55, r: 0.06, taper: 0.55, bulge: 0.12 },
  // ---- 하퇴 -------------------------------------------------------------
  { id: 'gastrocnemius', kr: '비복근', architecture: 'Fusiform',
    origins: [O('leg', -0.05, 0)], insertions: [I('foot', -0.05, 0)],
    along: -0.18, span: 0.55, r: 0.06, taper: 0.45, bulge: 0.28 },
  { id: 'tibialis', kr: '전경골근', architecture: 'Fusiform',
    origins: [O('leg', 0.045, 0.01)], insertions: [I('foot', 0.045, 0.01)],
    along: -0.1, span: 0.6, r: 0.035, taper: 0.5, bulge: 0.12 },
];

export const MUSCLES = [...CENTER, ...PAIRED.flatMap(pair)];

// 체형 프리셋(설계서 §5.2·G2): 같은 골격에서 아래 파라미터만 바꿔 다른 체형을 만든다.
//  muscle:   근육 반지름 배율(근육량)
//  fat:      피부 균일 두께 m(지방층, §9.10 GlobalFat)
//  transfer: 피부 전달률 ∈[0,1](§11 MuscleSeparation) — 근육 분리를 피부에 얼마나 또렷이 드러낼지.
//  fascia:   Laplacian 스무딩 반복(§9.10) — 지방·근막이 표면을 매끄럽게 하는 정도.
//  근거(§21.5): 마른·근육질은 피하지방이 얇아 근육 분리가 또렷(transfer↑·fascia↓), 비만은
//  지방·근막이 근육 골을 메워 매끄럽다(fat↑·fascia↑). MuscleLayer.build(rig, profile) 로 주입.
export const BODY_PRESETS = {
  마른:   { muscle: 0.78, fat: 0.0,   transfer: 0.85, fascia: 1 },
  평균:   { muscle: 1.0,  fat: 0.02,  transfer: 0.5,  fascia: 2 },
  근육질: { muscle: 1.42, fat: 0.006, transfer: 1.0,  fascia: 1 },
  비만:   { muscle: 0.95, fat: 0.075, transfer: 0.3,  fascia: 6 },
};

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
