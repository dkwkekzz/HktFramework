// ============================================================================
//  fleshdna.js — 살 DNA 스키마 + 순수 함수 (three.js 비의존)
//
//  살 DNA = 살 형태 전체를 서술하는 작은 JSON. "두께·형태"만 소유하고 뼈 상태는
//  읽지도 않는다(살 채널 분리 — docs/FLESH-PLAN.md §1). 이 파일은 렌더러 없이
//  Node 검증(tools/flesh-verify.mjs)에서 그대로 임포트 가능해야 하므로 three 를
//  import 하지 않는다 — 순수 데이터 + 순수 함수만 둔다.
//
//  세그먼트 = 부모 뼈 → 자식 뼈. match 는 자식 이름(simpleName)에 대한 정규식
//  소스 문자열, profile 은 [t,r] 제어점 배열(t=부모0→자식1, r=살 반지름 m).
//  compileDna 가 profile 을 PCHIP(단조 큐빅) 로 33-지점 LUT 에 구워, 핫루프는
//  LUT 선형 보간만 하게 한다.
// ============================================================================

import { ybotDna } from './ybotDna.js'; // 자동 생성 (tools/flesh-fit.mjs) — Y Bot 메시 역산

export const LUT_N = 33;           // profile 사전 샘플 지점 수 (t=0..1, 32 구간)
const FALLBACK_R = 0.04;           // match 실패 시 기본 반지름 (현 radiusFor 기본값)

// ---------------------------------------------------------------------------
//  PCHIP (Fritsch–Carlson) — 단조 큐빅 Hermite 보간
//  제어점을 정확히 통과 + C¹ 연속 + **오버슈트 없음**(반지름이 음수/융기로 튀지
//  않음 — legacy round-cone 볼록 껍질 사고 방지). Catmull-Rom 을 쓰지 않는 이유.
// ---------------------------------------------------------------------------

// 내부 구간 접선: 인접 기울기 부호가 다르거나 0 이면 0(극점), 아니면 가중 조화평균.
function pchipSlopes(ts, rs) {
  const n = ts.length;
  const m = new Float64Array(n);
  if (n === 1) return m;                 // 상수 프로파일 — 접선 0
  const d = new Float64Array(n - 1);     // 구간 기울기
  for (let k = 0; k < n - 1; k++) d[k] = (rs[k + 1] - rs[k]) / (ts[k + 1] - ts[k]);
  if (n === 2) { m[0] = m[1] = d[0]; return m; } // 선형
  for (let k = 1; k < n - 1; k++) {
    if (d[k - 1] * d[k] <= 0) { m[k] = 0; continue; }
    const h0 = ts[k] - ts[k - 1], h1 = ts[k + 1] - ts[k];
    const w1 = 2 * h1 + h0, w2 = h0 + 2 * h1;
    m[k] = (w1 + w2) / (w1 / d[k - 1] + w2 / d[k]); // F-C 가중 조화평균
  }
  // 끝점 — 비대칭 3점 공식 후 오버슈트 클램프(scipy pchip 방식)
  m[0] = edgeSlope(ts[1] - ts[0], ts[2] - ts[1], d[0], d[1]);
  m[n - 1] = edgeSlope(ts[n - 1] - ts[n - 2], ts[n - 2] - ts[n - 3], d[n - 2], d[n - 3]);
  return m;
}

function edgeSlope(h0, h1, d0, d1) {
  let m = ((2 * h0 + h1) * d0 - h0 * d1) / (h0 + h1);
  if (m * d0 <= 0) m = 0;                                   // 부호 뒤집힘 → 평평
  else if (d0 * d1 <= 0 && Math.abs(m) > 3 * Math.abs(d0)) m = 3 * d0; // 과증폭 클램프
  return m;
}

// profile([t,r][]) → Float32Array(LUT_N). t 도메인 밖은 끝값으로 클램프.
export function bakeLut(profile) {
  const pts = profile.slice().sort((a, b) => a[0] - b[0]);
  const ts = pts.map(p => p[0]), rs = pts.map(p => p[1]);
  const m = pchipSlopes(ts, rs);
  const lut = new Float32Array(LUT_N);
  const n = ts.length;
  for (let i = 0; i < LUT_N; i++) {
    const t = i / (LUT_N - 1);
    if (t <= ts[0]) { lut[i] = rs[0]; continue; }
    if (t >= ts[n - 1]) { lut[i] = rs[n - 1]; continue; }
    let k = 0; while (k < n - 1 && t > ts[k + 1]) k++;
    const h = ts[k + 1] - ts[k], s = (t - ts[k]) / h;
    const s2 = s * s, s3 = s2 * s;
    const h00 = 2 * s3 - 3 * s2 + 1, h10 = s3 - 2 * s2 + s;
    const h01 = -2 * s3 + 3 * s2, h11 = s3 - s2;
    lut[i] = h00 * rs[k] + h10 * h * m[k] + h01 * rs[k + 1] + h11 * h * m[k + 1];
  }
  return lut;
}

const FALLBACK_LUT = bakeLut([[0, FALLBACK_R]]);

// ---------------------------------------------------------------------------
//  기본 인간형 DNA (§5.4 형태 어휘)
//
//  profile 곡선(PCHIP)·flatten(타원 단면)·blend(세그먼트 블렌드 폭)으로 직선
//  테이퍼 로봇 실루엣을 사람 실루엣으로 끌어올린다. 관절 융기(메타볼 가산 고유)는
//  관절 쪽 끝 제어점 r 을 낮춰 데이터로 상쇄(팔꿈치·무릎). flatten dir 은 바인드
//  월드 기준 단위벡터(전방 +z, 좌우 x, 상하 y). hips 행은 없다(§5.4 — 부모가 정적
//  노드라 hips 를 자식으로 하는 세그먼트가 없음; 골반 볼륨은 spine·upleg 의 t=0).
// ---------------------------------------------------------------------------
function humanlikeDna() {
  return {
    version: 1,
    name: 'humanlike',
    // 위에서부터 첫 매칭 (forearm 이 arm 보다, upleg 이 leg 보다, spine2/1 이 spine 보다 먼저)
    segments: [
      { match: 'thumb|index|middle|ring|pinky', profile: [[0, 0]] },      // 손가락 생략
      // head→HeadTop_End 세그먼트(≈18.5cm)가 **두개골** 본체다(neck→head 는 턱·상부 목).
      { match: 'headtop|head.*end', profile: [[0, 0.058], [0.45, 0.092], [0.8, 0.088], [1, 0.05]], flatten: { dir: [0, 0, 1], f: 0.92 }, group: 'head' }, // 두개골(둥근)
      { match: 'end$', profile: [[0, 0.02]] },                            // 리프 가늘게(손끝·발끝)
      { match: 'head', profile: [[0, 0.05], [1, 0.058]], flatten: { dir: [0, 0, 1], f: 0.95 }, group: 'head' }, // 턱·상부 목 → 두개골 연결
      { match: 'neck', profile: [[0, 0.05], [1, 0.042]], blend: 1.4, group: 'head' },                                                     // 목—승모근 fold
      { match: 'spine2', profile: [[0, 0.095], [0.6, 0.105], [1, 0.09]], flatten: { dir: [0, 0, 1], f: 0.75 }, group: 'torso' },          // 흉곽 — 가장 납작
      { match: 'spine1', profile: [[0, 0.08], [0.5, 0.075], [1, 0.09]], flatten: { dir: [0, 0, 1], f: 0.8 }, group: 'torso' },            // 허리 S커브 잘록
      { match: 'spine', profile: [[0, 0.105], [1, 0.085]], flatten: { dir: [0, 0, 1], f: 0.8 }, group: 'torso' },                         // 골반 중심→하복부
      { match: 'shoulder', profile: [[0, 0.045], [1, 0.05]], blend: 1.2, group: 'arm' },                                                  // 어깨 웹
      { match: 'forearm', profile: [[0, 0.045], [0.3, 0.048], [1, 0.03]], group: 'arm' },                                                 // 전완 볼록→손목
      { match: 'arm', profile: [[0, 0.042], [0.4, 0.05], [1, 0.042]], group: 'arm' },                                                     // 상완 이두
      { match: 'hand', profile: [[0, 0.03], [0.5, 0.038], [1, 0.025]], flatten: { dir: [0, 0, 1], f: 0.55 }, group: 'hand' },             // 손바닥 패들
      { match: 'upleg', profile: [[0, 0.085], [0.4, 0.075], [1, 0.055]], group: 'leg' },                                                  // 허벅지 테이퍼
      { match: 'leg', profile: [[0, 0.055], [0.35, 0.062], [1, 0.035]], group: 'leg' },                                                   // 종아리 볼록→발목
      { match: 'foot', profile: [[0, 0.045], [0.55, 0.05], [1, 0.042]], flatten: { dir: [0, 1, 0], f: 0.5 }, group: 'foot' },             // 발 — 납작하고 통통(첨탑 방지)
      { match: 'toe', profile: [[0, 0.038], [1, 0.03]], flatten: { dir: [0, 1, 0], f: 0.5 }, group: 'foot' },                            // 발끝(둥글게)
    ],
    bumps: [],
    cuts: [],
    groups: { head: 1, torso: 1, arm: 1, hand: 1, leg: 1, foot: 1 },
  };
}

// 깊은 복사 (JSON 라운드트립 — 전 필드가 직렬화 가능해야 한다는 스키마 계약의 검산 겸용)
export function defaultDna() {
  return JSON.parse(JSON.stringify(humanlikeDna()));
}

// ---------------------------------------------------------------------------
//  프리셋 (F4) — 개성 있는 체형의 출발점. 이름으로 깊은 복사본을 돌려준다.
// ---------------------------------------------------------------------------
export const PRESET_NAMES = ['y-bot', 'humanlike', 'stylized-f', 'slim', 'bulk', 'robot'];

function withSeg(dna, match, patch) {
  const s = dna.segments.find(x => x.match === match);
  if (s) Object.assign(s, patch);
  return dna;
}

export function presetDna(name) {
  const d = defaultDna();
  d.name = name;
  switch (name) {
    case 'y-bot': return JSON.parse(JSON.stringify(ybotDna)); // Y Bot 메시에서 역산한 형태
    case 'humanlike': return d;
    case 'stylized-f': // §5.7 스타일라이즈드 여성 체형 (잘록 허리·넓은 골반·가슴/둔부 bump)
      withSeg(d, 'spine2', { profile: [[0, 0.082], [0.55, 0.092], [1, 0.08]], flatten: { dir: [0, 0, 1], f: 0.66 } });   // 흉곽 좁고 납작
      withSeg(d, 'spine1', { profile: [[0, 0.07], [0.5, 0.052], [1, 0.078]], flatten: { dir: [0, 0, 1], f: 0.72 } });    // 잘록 허리
      withSeg(d, 'spine', { profile: [[0, 0.098], [1, 0.078]], flatten: { dir: [0, 0, 1], f: 0.78 } });                  // 골반→하복부
      withSeg(d, 'shoulder', { profile: [[0, 0.04], [1, 0.044]], blend: 1.15 });                                         // 좁은 어깨
      withSeg(d, 'arm', { profile: [[0, 0.038], [0.4, 0.045], [1, 0.038]] });                                            // 가는 상완
      withSeg(d, 'forearm', { profile: [[0, 0.04], [0.3, 0.043], [1, 0.026]] });                                         // 가는 전완·손목
      withSeg(d, 'upleg', { profile: [[0, 0.092], [0.35, 0.08], [1, 0.05]] });                                           // 허벅지 굵고 무릎 가늘게
      withSeg(d, 'leg', { profile: [[0, 0.05], [0.3, 0.06], [1, 0.028]] });                                              // 종아리 볼록·발목 가늘게
      withSeg(d, 'neck', { profile: [[0, 0.043], [1, 0.035]], blend: 1.35 });                                            // 가늘고 긴 목
      withSeg(d, 'headtop|head.*end', { profile: [[0, 0.054], [0.45, 0.085], [0.8, 0.083], [1, 0.048]], flatten: { dir: [0, 0, 1], f: 0.9 } }); // 갸름한 두개골
      d.bumps = [
        { match: 'spine2', t: 0.5, offset: [0.05, 0.035, 0], r: 0.05, strength: 1.0, mirror: true },  // 가슴 (전방+좌우)
        { match: 'upleg', t: 0.12, offset: [-0.05, 0, 0.01], r: 0.058, strength: 1.0 },               // 둔부 (후방)
        { match: 'leg', t: 0.32, offset: [-0.02, 0, 0], r: 0.03, strength: 0.5 },                       // 종아리 뒤
      ];
      return d;
    case 'slim': // 전 그룹 0.85 + 허리 잘록 강화
      for (const k in d.groups) d.groups[k] = 0.85;
      withSeg(d, 'spine1', { profile: [[0, 0.075], [0.5, 0.056], [1, 0.082]], flatten: { dir: [0, 0, 1], f: 0.78 } });
      return d;
    case 'bulk': // torso/arm 1.25 + 어깨 blend↑
      d.groups.torso = 1.25; d.groups.arm = 1.25;
      withSeg(d, 'shoulder', { profile: [[0, 0.05], [1, 0.058]], blend: 1.4 });
      return d;
    case 'robot': // 전부 상수 profile (F1 회귀형) — 로봇 원기둥
      for (const s of d.segments) {
        const rs = s.profile.map(p => p[1]);
        s.profile = [[0, Math.max(...rs)]];
        delete s.flatten;
      }
      return d;
    default: return d;
  }
}

// ---------------------------------------------------------------------------
//  lerp / mutate / serialize (F4)
// ---------------------------------------------------------------------------
const lnum = (x, y, t) => x + (y - x) * t;
const clamp = (v, lo, hi) => v < lo ? lo : v > hi ? hi : v;

// 두 DNA 의 숫자 리프 선형 보간. 세그먼트는 match 문자열로 짝짓기 — 불일치 항목은
// t<0.5 면 a, 아니면 b 것 유지. 체형 모핑 데모 겸 창발 재료(§7).
export function lerpDna(a, b, t) {
  const pick = t < 0.5 ? a : b;
  const out = { version: 1, name: `${a.name}~${b.name}`, segments: [], bumps: [], cuts: [], groups: {} };
  const gk = new Set([...Object.keys(a.groups || {}), ...Object.keys(b.groups || {})]);
  for (const k of gk) out.groups[k] = lnum(a.groups?.[k] ?? 1, b.groups?.[k] ?? 1, t);
  const bByMatch = new Map((b.segments || []).map(s => [s.match, s]));
  const aMatches = new Set((a.segments || []).map(s => s.match));
  for (const sa of (a.segments || [])) {
    const sb = bByMatch.get(sa.match);
    if (sb) out.segments.push(lerpSeg(sa, sb, t));
    else if (t < 0.5) out.segments.push(JSON.parse(JSON.stringify(sa)));
  }
  for (const sb of (b.segments || [])) if (!aMatches.has(sb.match) && t >= 0.5) out.segments.push(JSON.parse(JSON.stringify(sb)));
  out.bumps = JSON.parse(JSON.stringify(pick.bumps || [])); // bump/cut 은 match+t 짝짓기 애매 → pick 쪽 유지
  out.cuts = JSON.parse(JSON.stringify(pick.cuts || []));
  return out;
}

function lerpSeg(sa, sb, t) {
  const out = { match: sa.match };
  out.profile = sa.profile.length === sb.profile.length
    ? sa.profile.map((p, i) => [lnum(p[0], sb.profile[i][0], t), lnum(p[1], sb.profile[i][1], t)])
    : JSON.parse(JSON.stringify((t < 0.5 ? sa : sb).profile));
  if (sa.flatten && sb.flatten) out.flatten = { dir: sa.flatten.dir.map((d, i) => lnum(d, sb.flatten.dir[i], t)), f: lnum(sa.flatten.f, sb.flatten.f, t) };
  else { const f = (t < 0.5 ? sa : sb).flatten; if (f) out.flatten = JSON.parse(JSON.stringify(f)); }
  if (sa.blend != null || sb.blend != null) out.blend = lnum(sa.blend ?? 1, sb.blend ?? 1, t);
  const g = (t < 0.5 ? sa : sb).group; if (g) out.group = g;
  return out;
}

// 시드 PRNG(mulberry32) + Box-Muller 가우시안으로 profile r·flatten f 변이.
// r 은 [0.5, 1.8]×원본 클램프. 같은 (dna, seed) → 같은 결과(재현 가능).
function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
function gauss(rng) {
  let u = 0, v = 0; while (u === 0) u = rng(); while (v === 0) v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

export function mutateDna(dna, seed, amount = 0.12) {
  const rng = mulberry32(seed >>> 0);
  const out = JSON.parse(JSON.stringify(dna));
  out.name = `${dna.name}*${seed}`;
  for (const s of out.segments) {
    for (const p of s.profile) {
      if (p[1] <= 0) continue; // r=0(손가락) 유지
      const orig = p[1];
      p[1] = clamp(orig * (1 + gauss(rng) * amount), 0.5 * orig, 1.8 * orig);
    }
    if (s.flatten) s.flatten.f = clamp(s.flatten.f * (1 + gauss(rng) * amount), 0.3, 1);
  }
  return out;
}

export function serializeDna(dna) { return JSON.stringify(dna, null, 2); }

// JSON 입력 → DNA. version/스키마 검증. 실패 시 throw.
export function parseDna(json) {
  const d = typeof json === 'string' ? JSON.parse(json) : json;
  if (d.version !== 1) throw new Error(`지원하지 않는 DNA version: ${d.version}`);
  if (!Array.isArray(d.segments) || !d.segments.length) throw new Error('segments 배열이 비었거나 없음');
  for (const s of d.segments) {
    if (typeof s.match !== 'string') throw new Error('세그먼트 match 문자열 아님');
    if (!Array.isArray(s.profile) || !s.profile.length) throw new Error(`세그먼트 ${s.match} profile 오류`);
  }
  if (!d.groups) d.groups = { head: 1, torso: 1, arm: 1, hand: 1, leg: 1, foot: 1 };
  if (!d.bumps) d.bumps = [];
  if (!d.cuts) d.cuts = [];
  return d;
}

// ---------------------------------------------------------------------------
//  compileDna — 정규식 컴파일 + simpleName→세그먼트 스펙 메모이즈 평가기
//
//  resolve(simpleKey) → { lut, rMax, flatten, blend, group, spheres } | null(r=0).
//    lut     : Float32Array(LUT_N) — groups 배율까지 반영된 최종 반지름(m)
//    rMax    : lut 최댓값(m) — bbox 산정용(핫루프에서 BLEND·blend·gs 곱)
//    flatten : { dir:[x,y,z], f } | null (타원 단면)
//    blend   : 세그먼트별 블렌드 폭 배율
//    group   : groups 키 | null
//    spheres : 이 세그먼트에 걸리는 bump/cut → { t, offset:[3], r, strength(부호) }
//  groups 배율은 resolve 시점에 lut 에 곱혀 캐시된다. groups 변경 시 invalidate().
// ---------------------------------------------------------------------------
export function compileDna(dna) {
  const specs = (dna.segments || []).map(s => ({
    re: new RegExp(s.match),
    flatten: s.flatten ? { dir: s.flatten.dir.slice(), f: s.flatten.f } : null,
    blend: s.blend ?? 1,
    group: s.group || null,
    offset: s.offset ? s.offset.slice() : null, // [u,v,축] m — 캡슐을 뼈에서 스킨 중심선으로 이동
    baseLut: bakeLut(s.profile),   // groups 미적용 원본 (배율은 resolve 에서)
  }));

  // bump(+) / cut(−) 를 부호 붙은 구 리스트 하나로 컴파일 (mirror 쌍 자동 전개)
  const spheres = [];
  const addSphere = (spec, sign) => {
    const t = spec.t ?? 0.5, off = spec.offset.slice();
    const r = spec.r, strength = sign * (spec.strength ?? 1);
    spheres.push({ re: new RegExp(spec.match), t, offset: off, r, strength });
    if (spec.mirror) { const o = off.slice(); o[1] = -o[1]; spheres.push({ re: new RegExp(spec.match), t, offset: o, r, strength }); }
  };
  for (const b of (dna.bumps || [])) addSphere(b, +1);
  for (const c of (dna.cuts || [])) addSphere(c, -1);

  const groups = dna.groups || {};
  const cache = new Map();

  function resolve(key) {
    if (cache.has(key)) return cache.get(key);
    const spec = specs.find(s => s.re.test(key));
    const baseLut = spec ? spec.baseLut : FALLBACK_LUT;
    const group = spec ? spec.group : null;
    const mul = group ? (groups[group] ?? 1) : 1;
    const lut = new Float32Array(LUT_N);
    let rMax = 0;
    for (let i = 0; i < LUT_N; i++) { const v = baseLut[i] * mul; lut[i] = v; if (v > rMax) rMax = v; }
    if (rMax <= 1e-9) { cache.set(key, null); return null; } // r=0 → 살 생략
    const segSpheres = spheres
      .filter(sp => sp.re.test(key))
      .map(sp => ({ t: sp.t, offset: sp.offset, r: sp.r, strength: sp.strength }));
    const out = { lut, rMax, flatten: spec ? spec.flatten : null, blend: spec ? spec.blend : 1, group, offset: spec ? spec.offset : null, spheres: segSpheres };
    cache.set(key, out);
    return out;
  }

  return { resolve, invalidate: () => cache.clear() };
}
