// ============================================================================
//  fleshdna.js — "살 게놈" : 주어진 스켈레톤에 SDF 살을 붙이는 규칙의 유전자 인코딩
//
//  근거 문서: HktCharacter/genome-encoding-principles.md (게놈 인코딩 설계 원리).
//  이 파일은 그 문서 설계를 "SDF 살" 도메인에 이식한 것이다. 핵심 명제:
//
//    표현은 수열이 아니라 (수열, 전개 규칙) 쌍이다. 정보의 대부분은 디코더에 있다.
//
//  ── 이 도메인이 원리 문서와 특별히 잘 맞는 이유 (§2 이산/연속 분리) ──
//  골격은 "로드하는 것이지 만드는 것이 아니다"(CLAUDE.md MUST). 즉 위상(L0 체제·
//  L1 구조 = 뼈 개수·계층)은 게놈 **밖**에 외부 고정돼 있다. 이것은 원리 문서가 이상적
//  이라 말한 "위상은 연속 게놈에 절대 넣지 마라"의 가장 깨끗한 실현이다. 따라서 이
//  게놈은 순수하게 **연속 층(L2 비례·L3 살·L4 표면)** 만 담는다 — 어떤 값이 와도 위상이
//  깨질 수 없으므로 폐쇄성이 구조적으로 보장된다.
//
//    L0 체제      = 로드된 스켈레톤 (게놈 밖 · 고정)
//    L1 구조      = 뼈 계층      (게놈 밖 · 고정)
//    L2 비례      = 뼈 scale     (main.js props 소유 — 길이/골격. 살 게놈은 안 건드림)
//    L3 살/채움   = ★ 이 게놈    (부위별 두께·프로파일 형태·flatten)
//    L4 표면      = ★ 이 게놈    (색)
//
//  ── 수열(genome) ──  정규화 유전자 벡터 [0,1]^N (바이트 등가). 짧다(~13개). 이 얇은
//     수열이 규칙의 *파라미터*일 뿐, 대상의 인코딩이 아니다. 정보는 아래 TEMPLATE(해부학
//     세그먼트 정의)와 decode 규칙에 있다.
//  ── 전개 규칙(decoder) ──  compileFlesh(genome) 이 TEMPLATE 을 유전자로 변조해
//     세그먼트별 반지름 LUT 를 굽는다. mcflesh.js 가 그 LUT 만 소비한다.
//
//  three.js 비의존 — Node 검증(tools/flesh-verify.mjs)을 렌더러 없이 돌리기 위함.
// ============================================================================

// ── 유틸: 클램프 · 결정론적 PRNG · 가우시안 ────────────────────────────────
const clamp01 = v => (v < 0 ? 0 : v > 1 ? 1 : v);
const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

// mulberry32 — 시드 재현 가능한 PRNG (변이·랜덤 개체용)
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
// Box-Muller 표준정규
function gauss(rng) {
  let u = 0, v = 0;
  while (u === 0) u = rng();
  while (v === 0) v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

// ── 층별 돌연변이율 (원리 문서 §3: 상위 층일수록 낮게) ──────────────────────
// 이 게놈은 L2~L4 만 담으므로 L0/L1 은 참고용(게놈 밖이라 실사용 안 됨).
export const LAYER_RATE = { L0: 0.001, L1: 0.02, L2: 0.15, L3: 0.15, L4: 0.3 };

// ── 유전자 명세 (GENE_SPEC) ──────────────────────────────────────────────
//  수열의 각 칸이 무엇인지. 순서는 **부위 그룹별로 인접**하게 둔다 — 조합성(§1)을 위해
//  크로스오버가 그룹 경계에서 일어나게 하기 위함. 각 유전자는 clamp 범위 [lo,hi] 로만
//  해석된다(§4 폐쇄성): 양 극단이 모두 유효 → 임의 수열이 항상 유효한 몸을 낳는다.
//
//  key      : 의미 · layer : 돌연변이 층 · lo/hi : clamp 범위 · def : 기본 표현형 값
//  shape 계열(0..1, def 0.5) 은 프로파일 중간 제어점의 "볼록/오목 과장" 노브(관절 끝점은
//  고정 → 관절 연속성 보존). thick 계열은 부위 두께 배율.
//  ※ 전역 "벌크" 유전자는 두지 않는다 — 모든 부위를 곱하는 전역 유전자는 부위를 서로
//    얽어 조합성(부위 이식)을 깨뜨린다(감사에서 확인됨). "전체 크기"는 부위 두께 유전자의
//    동조 이동으로, 골격 크기는 뼈 scale(L2, main.js)로 표현한다 — 채널이 깨끗해진다.
export const GENE_SPEC = [
  // 머리
  { key: 'head.thick',    layer: 'L3', group: 'head',   lo: 0.60, hi: 1.60, def: 1.00 },
  { key: 'head.shape',    layer: 'L3', group: 'head',   lo: 0.00, hi: 1.00, def: 0.50 },
  // 몸통
  { key: 'torso.thick',   layer: 'L3', group: 'torso',  lo: 0.60, hi: 1.60, def: 1.00 },
  { key: 'torso.shape',   layer: 'L3', group: 'torso',  lo: 0.00, hi: 1.00, def: 0.50 }, // 허리 잘록
  { key: 'torso.flatten', layer: 'L3', group: 'torso',  lo: 0.00, hi: 1.00, def: 0.50 }, // 앞뒤 납작
  // 팔
  { key: 'arm.thick',     layer: 'L3', group: 'arm',    lo: 0.60, hi: 1.60, def: 1.00 },
  { key: 'arm.shape',     layer: 'L3', group: 'arm',    lo: 0.00, hi: 1.00, def: 0.50 }, // 이두 볼록
  // 손
  { key: 'hand.thick',    layer: 'L3', group: 'hand',   lo: 0.60, hi: 1.60, def: 1.00 },
  // 다리
  { key: 'leg.thick',     layer: 'L3', group: 'leg',    lo: 0.60, hi: 1.60, def: 1.00 },
  { key: 'leg.shape',     layer: 'L3', group: 'leg',    lo: 0.00, hi: 1.00, def: 0.50 }, // 종아리 볼록
  // 발
  { key: 'foot.thick',    layer: 'L3', group: 'foot',   lo: 0.60, hi: 1.60, def: 1.00 },
  // 표면 (L4 — 다른 층에 영향 없음). hue 는 좁은 살색 대역(비순환·매끄럽게).
  { key: 'surface.hue',   layer: 'L4', group: 'surface', lo: 0.02, hi: 0.12, def: 0.07 },
  { key: 'surface.tone',  layer: 'L4', group: 'surface', lo: 0.00, hi: 1.00, def: 0.55 },
];
export const GENOME_LEN = GENE_SPEC.length;

// 그룹이 바뀌는 인접 경계 인덱스 = 조합성 크로스오버 지점 (§1 · §3)
export const GROUP_BOUNDARIES = (() => {
  const b = [];
  for (let i = 1; i < GENE_SPEC.length; i++)
    if (GENE_SPEC[i].group !== GENE_SPEC[i - 1].group) b.push(i);
  return b;
})();

// ── 해부학 세그먼트 TEMPLATE (디코더의 정보 거처) ───────────────────────────
//  뼈 simpleName(콜론·mixamorig 접두 제거 소문자) 정규식 → 그 뼈가 그리는 살.
//  위에서부터 첫 매칭 (forearm 이 arm 보다, upleg 이 leg 보다 먼저). 프로파일 [t,r] 은
//  세그먼트 축 위치 t∈[0,1] 에서의 살 반지름(m). r 은 대략 현 mcflesh RADII 를 기준으로
//  잡은 인간형 출발점 — 기본 게놈(모든 두께=1·형태 중립)이면 낯익은 실루엣이 나온다.
//  flatten.dir = 바인드 월드 기준 단위벡터(전방 +z), f = 그 방향 반경 배율(≤1 납작).
const T = ([re, group, ctrl, flatten = null, blend = 1]) => ({
  re, key: re.source, group, ctrl, flatten, blend,
});
const TEMPLATE = [
  T([/thumb|index|middle|ring|pinky/, 'hand', [[0, 0], [1, 0]]]),              // 손가락 생략
  T([/end$/, 'foot', [[0, 0.02], [1, 0.018]]]),                               // 리프 본
  T([/head/, 'head', [[0, 0.08], [0.45, 0.095], [1, 0.05]], { dir: [0, 0, 1], f: 0.95 }]),
  T([/neck/, 'head', [[0, 0.05], [1, 0.045]], null, 1.4]),
  T([/hips/, 'torso', [[0, 0.105], [1, 0.10]], { dir: [0, 0, 1], f: 0.85 }]),
  T([/spine2/, 'torso', [[0, 0.09], [0.5, 0.105], [1, 0.10]], { dir: [0, 0, 1], f: 0.72 }]),
  T([/spine1/, 'torso', [[0, 0.10], [0.5, 0.086], [1, 0.095]], { dir: [0, 0, 1], f: 0.75 }]), // 허리 S커브
  T([/spine/, 'torso', [[0, 0.095], [1, 0.09]], { dir: [0, 0, 1], f: 0.80 }]),
  T([/shoulder/, 'arm', [[0, 0.05], [1, 0.05]]]),
  T([/forearm/, 'arm', [[0, 0.042], [0.3, 0.046], [1, 0.03]]]),               // 전완 볼록→손목
  T([/arm/, 'arm', [[0, 0.048], [0.45, 0.053], [1, 0.042]]]),                 // 위팔 이두
  T([/hand/, 'hand', [[0, 0.032], [0.5, 0.036], [1, 0.026]], { dir: [0, 0, 1], f: 0.55 }]),
  T([/upleg/, 'leg', [[0, 0.09], [0.35, 0.08], [1, 0.055]]]),                 // 허벅지 테이퍼
  T([/leg/, 'leg', [[0, 0.055], [0.35, 0.063], [1, 0.035]]]),                 // 종아리 볼록→발목
  T([/foot/, 'foot', [[0, 0.04], [1, 0.032]], { dir: [0, 1, 0], f: 0.6 }]),
  T([/toe/, 'foot', [[0, 0.03], [1, 0.02]], { dir: [0, 1, 0], f: 0.6 }]),
];
// 세그먼트 부위별 대표 길이(m, 키 1.7 기준) — 형태→기능(§6) 부피 적분용 참조 치수.
// 실뷰어는 실제 뼈 길이를 재서 넘길 수 있으나(형태=기능), 검증/기본은 이 명목값을 쓴다.
const SEG_LEN = { head: 0.22, torso: 0.55, arm: 0.58, hand: 0.18, leg: 0.82, foot: 0.24 };
const SAMPLES = 33; // 프로파일 LUT 샘플 수 (핫루프는 LUT 선형 보간만)

// ── PCHIP (Fritsch–Carlson) — 단조 큐빅 Hermite, 오버슈트 없음 (§5.1) ────────
function pchipSlopes(xs, ys) {
  const n = xs.length, d = new Array(n - 1), m = new Array(n);
  for (let i = 0; i < n - 1; i++) d[i] = (ys[i + 1] - ys[i]) / (xs[i + 1] - xs[i]);
  m[0] = d[0]; m[n - 1] = d[n - 2];
  for (let i = 1; i < n - 1; i++) {
    if (d[i - 1] * d[i] <= 0) m[i] = 0;
    else {
      const w1 = 2 * (xs[i + 1] - xs[i]) + (xs[i] - xs[i - 1]);
      const w2 = (xs[i + 1] - xs[i]) + 2 * (xs[i] - xs[i - 1]);
      m[i] = (w1 + w2) / (w1 / d[i - 1] + w2 / d[i]);
    }
  }
  return m;
}
function bakeLUT(ctrl) {
  const xs = ctrl.map(p => p[0]), ys = ctrl.map(p => p[1]);
  const lut = new Float32Array(SAMPLES);
  if (xs.length === 1) { lut.fill(Math.max(0, ys[0])); return lut; }
  const m = pchipSlopes(xs, ys);
  for (let s = 0; s < SAMPLES; s++) {
    const x = s / (SAMPLES - 1);
    let k = 0; while (k < xs.length - 2 && x > xs[k + 1]) k++;
    const h = xs[k + 1] - xs[k], t = (x - xs[k]) / h;
    const t2 = t * t, t3 = t2 * t;
    const h00 = 2 * t3 - 3 * t2 + 1, h10 = t3 - 2 * t2 + t;
    const h01 = -2 * t3 + 3 * t2, h11 = t3 - t2;
    lut[s] = Math.max(0, h00 * ys[k] + h10 * h * m[k] + h01 * ys[k + 1] + h11 * h * m[k + 1]);
  }
  return lut;
}

// shape 유전자(s∈[-1,1]) 적용: 중간 제어점의 "끝점 잇는 직선 대비 편차"를 ×(1+s).
// 양끝(관절)은 그대로 → 인접 세그먼트 연속성 보존. r 은 0.004m 하한 클램프(폐쇄성).
function applyShape(ctrl, s) {
  if (ctrl.length < 3 || s === 0) return ctrl;
  const t0 = ctrl[0][0], t1 = ctrl[ctrl.length - 1][0];
  const r0 = ctrl[0][1], r1 = ctrl[ctrl.length - 1][1];
  return ctrl.map(([t, r], i) => {
    if (i === 0 || i === ctrl.length - 1) return [t, r];
    const base = r0 + (r1 - r0) * ((t - t0) / (t1 - t0 || 1));
    return [t, Math.max(0.004, base + (r - base) * (1 + s))];
  });
}

// ── 게놈 → 유전자 값 (clamp 범위 매핑) ─────────────────────────────────────
function readGenes(genome) {
  const o = {};
  for (let i = 0; i < GENE_SPEC.length; i++) {
    const g = GENE_SPEC[i];
    o[g.key] = g.lo + clamp01(genome[i] ?? 0) * (g.hi - g.lo);
  }
  return o;
}

// HSL→RGB (표면색) — 살구빛 기본. hue 0.07·tone 0.55 ≈ 원 mcflesh 색과 유사.
function decodeColor(genes) {
  const h = genes['surface.hue'], l = 0.35 + genes['surface.tone'] * 0.35, sat = 0.35;
  const c = (1 - Math.abs(2 * l - 1)) * sat, x = c * (1 - Math.abs(((h * 6) % 2) - 1)), mm = l - c / 2;
  let r = 0, g = 0, b = 0; const seg = Math.floor(h * 6) % 6;
  if (seg === 0) [r, g, b] = [c, x, 0]; else if (seg === 1) [r, g, b] = [x, c, 0];
  else if (seg === 2) [r, g, b] = [0, c, x]; else if (seg === 3) [r, g, b] = [0, x, c];
  else if (seg === 4) [r, g, b] = [x, 0, c]; else [r, g, b] = [c, 0, x];
  return { r: clamp01(r + mm), g: clamp01(g + mm), b: clamp01(b + mm) };
}

// ── 전개: compileFlesh(genome) → 세그먼트 LUT 평가기 (mcflesh 가 소비) ───────
export function compileFlesh(genome) {
  const genes = readGenes(genome);
  const segments = TEMPLATE.map(seg => {
    const thick = genes[seg.group + '.thick'] ?? 1;
    const shapeGene = genes[seg.group + '.shape'];
    const s = shapeGene === undefined ? 0 : (shapeGene * 2 - 1); // 0..1 → -1..1
    const ctrl2 = applyShape(seg.ctrl, s).map(([t, r]) => [t, r * thick]);
    const lut = bakeLUT(ctrl2);
    let rMax = 0; for (const v of lut) if (v > rMax) rMax = v;
    let flatten = null;
    if (seg.flatten) {
      // torso.flatten 유전자만 flatten 배율(0.75~1.25)로 변조, 나머지는 템플릿 f.
      const mult = seg.group === 'torso' ? 0.75 + genes['torso.flatten'] * 0.5 : 1;
      flatten = { dir: seg.flatten.dir, f: clamp(seg.flatten.f * mult, 0.45, 1.0) };
    }
    return { re: seg.re, key: seg.key, group: seg.group, lut, rMax, flatten, blend: seg.blend };
  });
  const color = decodeColor(genes);
  const bySimple = new Map(); // 이름 매칭 메모이즈 (핫루프)
  const resolve = name => {
    if (bySimple.has(name)) return bySimple.get(name);
    let hit = null;
    for (const s of segments) if (s.re.test(name)) { hit = s.rMax > 1e-5 ? s : null; break; }
    bySimple.set(name, hit);
    return hit;
  };
  return { segments, color, genes, resolve };
}

// ── 기본 / 랜덤 게놈 ────────────────────────────────────────────────────────
export const defaultGenome = () =>
  GENE_SPEC.map(g => clamp01((g.def - g.lo) / (g.hi - g.lo)));

export function randomGenome(rng = Math.random) {
  return GENE_SPEC.map(() => rng());
}

// ── 변이 · 크로스오버 · 보간 (진화 연산) ────────────────────────────────────
// 층별 돌연변이율 반영 — 상위 층일수록 작게 흔든다 (§3).
export function mutateGenome(genome, seed = 1, amount = 1) {
  const rng = typeof seed === 'function' ? seed : mulberry32(seed);
  return genome.map((v, i) => {
    const rate = LAYER_RATE[GENE_SPEC[i].layer] ?? 0.15;
    return clamp01(v + gauss(rng) * rate * amount);
  });
}
// 조합성: 크로스오버는 그룹 경계에서만(mode 'boundary') 일어나야 부위가 통째로 상속된다.
//  'uniform' = 유전자별 독립 선택(부위를 산산조각내는 최대 교란 재조합) — 조합성 감사의
//  대조군. 'point' = 무작위 단일 지점(그룹을 가로지를 수 있음).
export function crossoverGenome(a, b, seed = 1, { mode = 'boundary' } = {}) {
  const rng = typeof seed === 'function' ? seed : mulberry32(seed);
  if (mode === 'uniform') return a.map((v, i) => (rng() < 0.5 ? v : b[i]));
  const cuts = mode === 'boundary' ? GROUP_BOUNDARIES : a.map((_, i) => i).slice(1);
  const cut = cuts.length ? cuts[Math.floor(rng() * cuts.length)] : 1;
  return a.map((v, i) => (i < cut ? v : b[i]));
}
export const lerpGenome = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);

// ── 직렬화 : 수열을 바이트로 (유한 수열임을 명시) ───────────────────────────
export function serializeGenome(genome) {
  let hex = '';
  for (const v of genome) hex += Math.round(clamp01(v) * 255).toString(16).padStart(2, '0');
  return hex;
}
export function parseGenome(str) {
  const s = String(str).trim().replace(/[^0-9a-f]/gi, '');
  const out = [];
  for (let i = 0; i < GENOME_LEN; i++) {
    const byte = parseInt(s.substr(i * 2, 2), 16);
    out.push(Number.isFinite(byte) ? byte / 255 : (GENE_SPEC[i].def - GENE_SPEC[i].lo) / (GENE_SPEC[i].hi - GENE_SPEC[i].lo));
  }
  return out;
}

// ── 폐쇄성 판정 — 디코드 결과가 항상 유효한가 (§1) ──────────────────────────
export function isValidPhenotype(compiled) {
  if (!compiled || !compiled.segments) return false;
  for (const s of compiled.segments) {
    if (!(s.rMax >= 0) || s.rMax > 0.5) return false; // NaN/음수/폭주 반지름 거부
    for (const v of s.lut) if (!Number.isFinite(v) || v < 0 || v > 0.5) return false;
    if (s.flatten && !(s.flatten.f > 0 && s.flatten.f <= 1)) return false;
  }
  const c = compiled.color;
  return [c.r, c.g, c.b].every(v => v >= 0 && v <= 1);
}

// ── 표현형 특징 벡터 — 지역성/다양성 측정용 (도메인 d_p) ─────────────────────
export function phenotypeFeatures(compiled) {
  const f = [];
  for (const s of compiled.segments) {
    const N1 = s.lut.length - 1;
    // 프로파일을 3지점(양끝+중간) 샘플 — shape 유전자(중간 편차)까지 특징에 실린다.
    f.push(s.lut[0], s.lut[(N1 / 2) | 0], s.lut[N1]);
    f.push(s.flatten ? s.flatten.f : 1); // 단면 납작도
  }
  f.push(compiled.color.r, compiled.color.g, compiled.color.b);
  return f;
}
export function phenotypeDistance(ca, cb) {
  const fa = phenotypeFeatures(ca), fb = phenotypeFeatures(cb);
  let s = 0; for (let i = 0; i < fa.length; i++) { const d = fa[i] - fb[i]; s += d * d; }
  return Math.sqrt(s);
}

// ── 형태 = 기능 (§6) — 스탯을 게놈이 아니라 표현형에서 *읽어낸다* ────────────
//  부피 = Σ 부위 (π · 평균 r² · 부위 길이). 능력은 부피/길이의 함수.
//  lengths: { head,torso,arm,hand,leg,foot } 부위 총길이(m). 생략 시 명목값(키 1.7).
export function deriveStats(compiled, lengths = SEG_LEN) {
  const volByGroup = {};
  for (const s of compiled.segments) {
    if (s.rMax < 1e-5) continue;
    let r2 = 0; for (const v of s.lut) r2 += v * v; r2 /= s.lut.length;
    const flat = s.flatten ? s.flatten.f : 1;   // 타원 단면 → 면적 ×f
    const len = (SEG_LEN[s.group] ?? 0.3) / countGroup(s.group); // 세그먼트 몫
    const scale = (lengths[s.group] ?? SEG_LEN[s.group] ?? 0.3) / (SEG_LEN[s.group] ?? 0.3);
    volByGroup[s.group] = (volByGroup[s.group] || 0) + Math.PI * r2 * flat * len * scale;
  }
  const volume = Object.values(volByGroup).reduce((a, b) => a + b, 0);
  const legLen = lengths.leg ?? SEG_LEN.leg, armLen = lengths.arm ?? SEG_LEN.arm;
  const DENSITY = 1000;                    // kg/m³ (물 근사)
  const mass = volume * DENSITY;
  const refMass = 0.06 * DENSITY;          // 기준 개체 질량 (스케일 앵커)
  return {
    volume,
    mass,
    health: Math.round(mass * 4),                                   // 부피 → 체력
    speed: +(6.0 * legLen / Math.sqrt(Math.max(mass, 1e-3) / refMass)).toFixed(2), // 다리 길이↑·무거우면↓
    power: Math.round((volByGroup.arm || 0) * DENSITY * 30),        // 팔 부피 → 위력
    reach: +armLen.toFixed(2),                                      // 팔 길이 → 사거리
  };
}
function countGroup(group) {
  let n = 0; for (const s of TEMPLATE) if (s.group === group) n++;
  return n || 1;
}

export { SAMPLES, SEG_LEN, TEMPLATE };
