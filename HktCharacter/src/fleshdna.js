// ============================================================================
//  fleshdna.js — 살 DNA 스키마 + 순수 함수 (three.js 비의존)
//
//  살 형태 전체를 작은 JSON("살 DNA")으로 파라미터화한다. 이 파일은 순수 데이터 +
//  순수 함수만 둔다 — Node 검증(tools/flesh-verify.mjs)을 렌더러 없이 돌리기 위함.
//  좌표·길이 단위는 미터(키 1.7m 정규화 후 월드 기준).
//
//  매칭 규약 (FLESH-PLAN §3.1) — **부모 키**: 세그먼트는 부모 원점→자식 원점을 잇고,
//  그 구간이 덮는 해부학 부위는 부모 뼈의 스팬이다. 그래서 세그먼트 규칙은 부모 뼈
//  simpleName 으로 매칭하고, 다자식 부모(hips·spine2·hand)는 선택 필드 child(자식 이름
//  정규식)로 구분한다. 위에서부터 첫 매칭 승.
// ============================================================================

export const LUT_N = 33; // profile 사전 샘플 지점 수 (핫루프는 LUT 선형 보간만)

// ---------------------------------------------------------------------------
//  기본 인간형 DNA (FLESH-PLAN §5.4) — Y Bot 기준 자연스러운 인체 실루엣 출발점.
//  flatten.dir 는 바인드 포즈 월드 기준 단위벡터(전방 +z, 좌우 x, 상하 y).
// ---------------------------------------------------------------------------
function humanlikeSegments() {
  return [
    { match: 'thumb|index|middle|ring|pinky', profile: [[0, 0]] },                  // 손가락 생략
    { match: 'head', profile: [[0, 0.08], [0.45, 0.095], [1, 0.04]], flatten: { dir: [0, 0, 1], f: 0.95 }, blend: 1, group: 'head' },   // 두개골(바닥→정수리)
    { match: 'neck', profile: [[0, 0.045], [1, 0.042]], blend: 1.4, group: 'head' },                                                     // 목 — 승모근 완만 fold
    { match: 'spine2', child: 'neck', profile: [[0, 0.09], [0.5, 0.105], [1, 0.095]], flatten: { dir: [0, 0, 1], f: 0.7 }, blend: 1, group: 'torso' },  // 흉곽 — 가장 납작
    { match: 'spine2', child: 'shoulder', profile: [[0, 0.05], [1, 0.045]], blend: 1.2, group: 'arm' },                                  // 쇄골 웹
    { match: 'spine1', profile: [[0, 0.09], [0.5, 0.06], [1, 0.085]], flatten: { dir: [0, 0, 1], f: 0.72 }, blend: 1, group: 'torso' },  // 허리 S커브 잘록
    { match: 'spine', profile: [[0, 0.095], [1, 0.08]], flatten: { dir: [0, 0, 1], f: 0.78 }, blend: 1, group: 'torso' },                // 하복부
    { match: 'hips', child: 'spine', profile: [[0, 0.105], [1, 0.09]], flatten: { dir: [0, 0, 1], f: 0.8 }, blend: 1, group: 'torso' },  // 골반→몸통 연결
    { match: 'hips', child: 'upleg', profile: [[0, 0.095], [1, 0.085]], blend: 1, group: 'torso' },                                      // 골반 좌우 폭
    { match: 'shoulder', profile: [[0, 0.045], [1, 0.052]], blend: 1, group: 'arm' },                                                    // 삼각근
    { match: 'forearm', profile: [[0, 0.042], [0.3, 0.046], [1, 0.028]], blend: 1, group: 'arm' },                                       // 전완 볼록→손목 수렴
    { match: 'arm', profile: [[0, 0.048], [0.45, 0.052], [1, 0.04]], blend: 1, group: 'arm' },                                           // 위팔 이두 볼록
    { match: 'hand', profile: [[0, 0.028], [0.5, 0.036], [1, 0.024]], flatten: { dir: [0, 0, 1], f: 0.55 }, blend: 1, group: 'hand' },   // 손바닥 패들
    { match: 'upleg', profile: [[0, 0.09], [0.35, 0.078], [1, 0.05]], blend: 1, group: 'leg' },                                          // 허벅지 테이퍼
    { match: 'leg', profile: [[0, 0.052], [0.35, 0.06], [1, 0.032]], blend: 1, group: 'leg' },                                           // 종아리 볼록→발목 수렴
    { match: 'foot', profile: [[0, 0.035], [1, 0.03]], flatten: { dir: [0, 1, 0], f: 0.6 }, blend: 1, group: 'foot' },                   // 발등 납작(상하)
    { match: 'toe', profile: [[0, 0.025], [1, 0.018]], flatten: { dir: [0, 1, 0], f: 0.6 }, blend: 1, group: 'foot' },                   // 발끝
  ];
}

export function defaultDna() {
  return {
    version: 1,
    name: 'humanlike',
    segments: humanlikeSegments(),
    bumps: [],
    cuts: [],
    groups: { head: 1, torso: 1, arm: 1, hand: 1, leg: 1, foot: 1 },
  };
}

export const GROUP_KEYS = ['head', 'torso', 'arm', 'hand', 'leg', 'foot'];
export const GROUP_LABELS = { head: '머리', torso: '몸통', arm: '팔', hand: '손', leg: '다리', foot: '발' };

// ---------------------------------------------------------------------------
//  PCHIP (Fritsch–Carlson) — 단조 큐빅 Hermite. 제어점을 정확히 통과하고
//  오버슈트가 없어(반지름 음수/융기 방지) 프로파일 곡선에 안전하다 (§5.1).
// ---------------------------------------------------------------------------
function pchipTangents(xs, ys) {
  const n = xs.length;
  const m = new Array(n).fill(0);
  if (n === 1) return m;
  const d = new Array(n - 1);
  for (let k = 0; k < n - 1; k++) d[k] = (ys[k + 1] - ys[k]) / (xs[k + 1] - xs[k]);
  m[0] = d[0];
  m[n - 1] = d[n - 2];
  for (let k = 1; k < n - 1; k++) {
    if (d[k - 1] * d[k] <= 0) { m[k] = 0; continue; } // 부호 반전·평탄 → 극점 → 접선 0
    const h1 = xs[k] - xs[k - 1], h2 = xs[k + 1] - xs[k];
    const w1 = 2 * h2 + h1, w2 = h2 + 2 * h1; // 가중 조화평균 (F-C 오버슈트 봉쇄)
    m[k] = (w1 + w2) / (w1 / d[k - 1] + w2 / d[k]);
  }
  return m;
}

// [t,r] 제어점 배열 → t∈[0,1] 균등 LUT(길이 LUT_N). 점 1개면 상수.
export function sampleProfileLut(profile) {
  const xs = profile.map(p => p[0]);
  const ys = profile.map(p => p[1]);
  const lut = new Float32Array(LUT_N);
  if (profile.length === 1) { lut.fill(ys[0]); return lut; }
  const m = pchipTangents(xs, ys);
  let seg = 0;
  for (let i = 0; i < LUT_N; i++) {
    const t = i / (LUT_N - 1);
    if (t <= xs[0]) { lut[i] = ys[0]; continue; }
    if (t >= xs[xs.length - 1]) { lut[i] = ys[ys.length - 1]; continue; }
    while (seg < xs.length - 2 && t > xs[seg + 1]) seg++;
    const h = xs[seg + 1] - xs[seg];
    const s = (t - xs[seg]) / h;
    const s2 = s * s, s3 = s2 * s;
    const h00 = 2 * s3 - 3 * s2 + 1, h10 = s3 - 2 * s2 + s;
    const h01 = -2 * s3 + 3 * s2, h11 = s3 - s2;
    lut[i] = h00 * ys[seg] + h10 * h * m[seg] + h01 * ys[seg + 1] + h11 * h * m[seg + 1];
  }
  return lut;
}

// LUT 선형 보간 — 핫루프용. t∈[0,1].
export function lutAt(lut, t) {
  if (t <= 0) return lut[0];
  if (t >= 1) return lut[LUT_N - 1];
  const s = t * (LUT_N - 1), i = s | 0;
  return lut[i] + (lut[i + 1] - lut[i]) * (s - i);
}

function maxOf(arr) { let m = 0; for (let i = 0; i < arr.length; i++) if (arr[i] > m) m = arr[i]; return m; }

// ---------------------------------------------------------------------------
//  compileDna — 정규식 컴파일 + `부모>자식` 키→스펙 메모이즈 캐시.
//  resolve(parentKey, childKey) → { lut, rMax, flatten, blend, group, spheres[] } | null(r=0).
//  groups 배율은 resolve 시점에 LUT·구 반지름에 곱해 반영, groups 변경 시 invalidate().
// ---------------------------------------------------------------------------
export function compileDna(dna) {
  const segs = dna.segments.map(s => ({
    spec: s,
    re: new RegExp(s.match, 'i'),
    childRe: s.child ? new RegExp(s.child, 'i') : null,
    baseLut: sampleProfileLut(s.profile),
  }));
  // bump/cut → 부호 붙은 구 리스트. match(+child)·t 로 세그먼트에 귀속.
  const compileSpheres = (list, sign) => (list || []).map(b => ({
    re: new RegExp(b.match, 'i'),
    childRe: b.child ? new RegExp(b.child, 'i') : null,
    t: b.t ?? 0.5,
    offset: b.offset ? b.offset.slice() : [0, 0, 0],
    r: b.r ?? 0.04,
    strength: (b.strength ?? 1) * sign,
    mirror: !!b.mirror,
  }));
  const spheres = [...compileSpheres(dna.bumps, +1), ...compileSpheres(dna.cuts, -1)];
  const cache = new Map();

  function build(parentKey, childKey) {
    let hit = null;
    for (const s of segs) {
      if (!s.re.test(parentKey)) continue;
      if (s.childRe && !s.childRe.test(childKey)) continue;
      hit = s; break;
    }
    if (!hit) hit = { spec: {}, baseLut: sampleProfileLut([[0, 0.04]]), re: null, childRe: null }; // fallback
    const g = hit.spec.group ? (dna.groups?.[hit.spec.group] ?? 1) : 1;
    const lut = new Float32Array(LUT_N);
    for (let i = 0; i < LUT_N; i++) lut[i] = hit.baseLut[i] * g;
    const rMax = maxOf(lut);
    if (rMax <= 1e-6) return null; // r=0 세그먼트(손가락 등) — 살 생략
    // 이 세그먼트에 귀속되는 구(bump/cut) 수집 + mirror 전개
    const segSpheres = [];
    for (const sp of spheres) {
      if (!sp.re.test(parentKey)) continue;
      if (sp.childRe && !sp.childRe.test(childKey)) continue;
      const push = off => segSpheres.push({ t: sp.t, offset: [off[0] * g, off[1] * g, off[2] * g], r: sp.r * g, strength: sp.strength });
      push(sp.offset);
      if (sp.mirror) push([sp.offset[0], -sp.offset[1], sp.offset[2]]);
    }
    return {
      lut, rMax,
      flatten: hit.spec.flatten ? { dir: hit.spec.flatten.dir.slice(), f: hit.spec.flatten.f } : null,
      blend: hit.spec.blend ?? 1,
      group: hit.spec.group ?? null,
      spheres: segSpheres,
    };
  }

  return {
    resolve(parentKey, childKey) {
      const key = parentKey + '>' + childKey;
      if (cache.has(key)) return cache.get(key);
      const r = build(parentKey, childKey);
      cache.set(key, r);
      return r;
    },
    invalidate() { cache.clear(); },
  };
}

// ---------------------------------------------------------------------------
//  F4 — 보간 · 변이 · 직렬화
// ---------------------------------------------------------------------------

// 숫자 리프 선형 보간. 세그먼트는 match 문자열로 짝짓기 — 불일치는 t<0.5 면 a, 아니면 b.
export function lerpDna(a, b, t) {
  const out = deepCopy(a);
  out.name = t < 0.5 ? a.name : b.name;
  const bByMatch = new Map(b.segments.map(s => [s.match, s]));
  out.segments = a.segments.map(sa => {
    const sb = bByMatch.get(sa.match);
    if (!sb) return deepCopy(t < 0.5 ? sa : sa); // a 유지
    return lerpSegment(sa, sb, t);
  });
  // b 에만 있는 세그먼트는 t≥0.5 면 추가
  if (t >= 0.5) {
    const aMatches = new Set(a.segments.map(s => s.match));
    for (const sb of b.segments) if (!aMatches.has(sb.match)) out.segments.push(deepCopy(sb));
  }
  out.groups = {};
  for (const k of GROUP_KEYS) out.groups[k] = lerp(a.groups?.[k] ?? 1, b.groups?.[k] ?? 1, t);
  out.bumps = lerpSpheres(a.bumps, b.bumps, t);
  out.cuts = lerpSpheres(a.cuts, b.cuts, t);
  return out;
}

function lerpSegment(sa, sb, t) {
  const out = deepCopy(sa);
  // profile 은 제어점 수가 같을 때만 값 보간, 다르면 t<0.5 면 a
  if (sa.profile.length === sb.profile.length) {
    out.profile = sa.profile.map((p, i) => [lerp(p[0], sb.profile[i][0], t), lerp(p[1], sb.profile[i][1], t)]);
  } else if (t >= 0.5) {
    out.profile = deepCopy(sb.profile);
  }
  if (sa.flatten && sb.flatten) out.flatten = { dir: sa.flatten.dir.map((d, i) => lerp(d, sb.flatten.dir[i], t)), f: lerp(sa.flatten.f, sb.flatten.f, t) };
  else if (t >= 0.5 && sb.flatten) out.flatten = deepCopy(sb.flatten);
  if (sa.blend != null || sb.blend != null) out.blend = lerp(sa.blend ?? 1, sb.blend ?? 1, t);
  return out;
}

function lerpSpheres(a, b, t) {
  // 개수/순서 일치 가정 — 다르면 우세한 쪽 유지 (bump/cut 은 프리셋마다 다를 수 있음)
  if (!a?.length && !b?.length) return [];
  if (a?.length !== b?.length) return deepCopy(t < 0.5 ? (a || []) : (b || []));
  return a.map((sa, i) => {
    const sb = b[i], out = deepCopy(sa);
    out.t = lerp(sa.t ?? 0.5, sb.t ?? 0.5, t);
    out.r = lerp(sa.r ?? 0.04, sb.r ?? 0.04, t);
    out.strength = lerp(sa.strength ?? 1, sb.strength ?? 1, t);
    if (sa.offset && sb.offset) out.offset = sa.offset.map((v, k) => lerp(v, sb.offset[k], t));
    return out;
  });
}

// 시드 PRNG(mulberry32) — 재현 가능한 변이.
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function gaussian(rng) { // Box-Muller
  let u = 0, v = 0;
  while (u === 0) u = rng();
  while (v === 0) v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

// profile r·flatten f 를 ×(1 + N(0,amount)) 변이, r 은 [0.5,1.8]×원본 클램프.
export function mutateDna(dna, seed, amount = 0.12) {
  const rng = mulberry32(seed);
  const out = deepCopy(dna);
  out.name = `${dna.name || 'dna'}~${seed}`;
  for (const s of out.segments) {
    for (const p of s.profile) {
      if (p[1] <= 1e-6) continue; // r=0 은 그대로(손가락 생략 유지)
      const orig = p[1];
      p[1] = clamp(p[1] * (1 + amount * gaussian(rng)), orig * 0.5, orig * 1.8);
    }
    if (s.flatten) s.flatten.f = clamp(s.flatten.f * (1 + amount * gaussian(rng)), 0.4, 1);
  }
  return out;
}

// JSON 입출력 + version/스키마 검증.
export function serializeDna(dna) { return JSON.stringify(dna, null, 2); }

export function parseDna(json) {
  const dna = typeof json === 'string' ? JSON.parse(json) : json;
  if (!dna || typeof dna !== 'object') throw new Error('DNA 가 객체가 아님');
  if (dna.version !== 1) throw new Error(`지원하지 않는 DNA version: ${dna.version}`);
  if (!Array.isArray(dna.segments) || !dna.segments.length) throw new Error('segments 누락');
  for (const s of dna.segments) {
    if (typeof s.match !== 'string') throw new Error('segment.match 문자열 아님');
    if (!Array.isArray(s.profile) || !s.profile.length) throw new Error(`profile 누락: ${s.match}`);
  }
  // 누락 필드 기본값 채우기
  if (!dna.groups) dna.groups = {};
  for (const k of GROUP_KEYS) if (dna.groups[k] == null) dna.groups[k] = 1;
  if (!dna.bumps) dna.bumps = [];
  if (!dna.cuts) dna.cuts = [];
  return dna;
}

// ---------------------------------------------------------------------------
//  F4 — 프리셋. 전부 humanlike 를 출발점으로 파생 (창발 재료).
// ---------------------------------------------------------------------------
function setProfile(dna, match, child, profile) {
  const s = dna.segments.find(s => s.match === match && (child == null || s.child === child));
  if (s) s.profile = profile;
}
function setFlattenF(dna, match, child, f) {
  const s = dna.segments.find(s => s.match === match && (child == null || s.child === child));
  if (s && s.flatten) s.flatten.f = f;
}

// stylized-f — §5.7 레퍼런스 여성 체형. 잘록한 허리·넓은 골반·가슴/둔부 bump.
function stylizedFDna() {
  const d = defaultDna();
  d.name = 'stylized-f';
  setProfile(d, 'spine1', null, [[0, 0.075], [0.5, 0.058], [1, 0.082]]);  // 잘록한 허리
  setProfile(d, 'spine', null, [[0, 0.09], [1, 0.08]]);                    // 하복부·힙 S커브
  setProfile(d, 'hips', 'upleg', [[0, 0.105], [1, 0.098]]);                // 넓은 골반
  setProfile(d, 'upleg', null, [[0, 0.098], [0.35, 0.082], [1, 0.05]]);    // 굵은 허벅지
  setProfile(d, 'leg', null, [[0, 0.052], [0.35, 0.06], [1, 0.03]]);       // 가는 발목
  setProfile(d, 'forearm', null, [[0, 0.04], [0.3, 0.044], [1, 0.026]]);   // 가는 손목
  setProfile(d, 'neck', null, [[0, 0.045], [1, 0.036]]);                   // 가늘고 긴 목
  setProfile(d, 'head', null, [[0, 0.075], [0.5, 0.098], [1, 0.045]]);     // 큰 두개골·작은 턱
  setFlattenF(d, 'spine2', 'neck', 0.68);
  setFlattenF(d, 'spine1', null, 0.7);
  setFlattenF(d, 'spine', null, 0.75);
  d.bumps = [
    { match: 'spine2', child: 'neck', t: 0.55, offset: [0.055, 0.045, 0], r: 0.045, strength: 0.9, mirror: true }, // 가슴 ×2
    { match: 'upleg', t: 0.1, offset: [-0.055, 0, 0], r: 0.055, strength: 0.9 },                                    // 둔부(좌우 세그먼트 각각)
    { match: 'leg', t: 0.3, offset: [-0.018, 0, 0], r: 0.028, strength: 0.5 },                                      // 종아리 뒤 볼록
  ];
  return d;
}

// slim — 전 그룹 0.85 + 허리 잘록 강화.
function slimDna() {
  const d = defaultDna();
  d.name = 'slim';
  for (const k of GROUP_KEYS) d.groups[k] = 0.85;
  d.groups.head = 1;
  setProfile(d, 'spine1', null, [[0, 0.085], [0.5, 0.052], [1, 0.08]]);
  return d;
}

// bulk — torso/arm 두껍게 + 어깨 blend↑.
function bulkDna() {
  const d = defaultDna();
  d.name = 'bulk';
  d.groups.torso = 1.25; d.groups.arm = 1.25; d.groups.leg = 1.12;
  const sh = d.segments.find(s => s.match === 'shoulder');
  if (sh) sh.blend = 1.3;
  setProfile(d, 'arm', null, [[0, 0.056], [0.45, 0.06], [1, 0.045]]);
  setProfile(d, 'spine2', 'neck', [[0, 0.1], [0.5, 0.115], [1, 0.1]]);
  return d;
}

// robot — 전부 상수 profile (F1 회귀형, 직선 테이퍼 원기둥).
function robotDna() {
  const d = defaultDna();
  d.name = 'robot';
  for (const s of d.segments) {
    if (s.profile.some(p => p[1] <= 1e-6)) continue;              // r=0 유지
    const avg = s.profile.reduce((a, p) => a + p[1], 0) / s.profile.length;
    s.profile = [[0, avg]];
    delete s.flatten;
  }
  d.bumps = []; d.cuts = [];
  return d;
}

export const PRESETS = [
  { name: 'humanlike', make: defaultDna },
  { name: 'stylized-f', make: stylizedFDna },
  { name: 'slim', make: slimDna },
  { name: 'bulk', make: bulkDna },
  { name: 'robot', make: robotDna },
];

export function presetDna(name) {
  const p = PRESETS.find(p => p.name === name);
  return p ? p.make() : defaultDna();
}

// ---------------------------------------------------------------------------
//  헬퍼
// ---------------------------------------------------------------------------
function lerp(a, b, t) { return a + (b - a) * t; }
function clamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); }
export function deepCopy(o) { return JSON.parse(JSON.stringify(o)); }
