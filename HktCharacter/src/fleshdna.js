// ============================================================================
//  fleshdna.js — 살 DNA: 직렬화 가능한 순수 데이터 + 순수 함수
//
//  살 형태 전체를 작은 JSON("살 DNA")으로 파라미터화한다. 뼈 scale(길이·골격)과
//  분리된 **살 채널** — 두께·형태만 소유하고 뼈 상태는 읽기만 한다.
//
//  ⚠️ three.js 를 import 하지 않는다 — Node 검증을 렌더러 없이 돌리기 위함.
//  세그먼트 규칙은 정규식 **소스 문자열**로 보관해 JSON 직렬화가 성립한다.
//
//  좌표·길이 단위는 전부 **미터** (키 1.7m 정규화 후 월드 기준).
// ============================================================================

const LUT_N = 33;                 // 프로파일 LUT 샘플 수 (32구간) — 핫루프는 선형 보간만
const FALLBACK_PROFILE = [[0, 0.04]]; // 매칭 실패 세그먼트 기본 반지름 (현 radiusFor 기본값)

// ---------------------------------------------------------------------------
//  F1 기본 인간형 DNA — 전부 상수 1점 프로파일(현 RADII 값 그대로).
//  이 단계에서는 화면 결과가 v4.2 와 동일해야 한다(회귀 기준). F2 에서 곡선
//  프로파일·flatten·cut 을 얹은 실제 인간형 테이블로 교체한다.
// ---------------------------------------------------------------------------
function baseSegments() {
  return [
    { match: 'thumb|index|middle|ring|pinky', profile: [[0, 0]] }, // 손가락 생략
    { match: 'end$',    profile: [[0, 0.02]] },                    // 리프 본 가늘게
    { match: 'head',    profile: [[0, 0.085]], group: 'head' },
    { match: 'neck',    profile: [[0, 0.045]], group: 'head' },
    { match: 'hips',    profile: [[0, 0.105]], group: 'torso' },
    { match: 'spine2',  profile: [[0, 0.105]], group: 'torso' },
    { match: 'spine1',  profile: [[0, 0.095]], group: 'torso' },
    { match: 'spine',   profile: [[0, 0.09]],  group: 'torso' },
    { match: 'shoulder', profile: [[0, 0.05]], group: 'arm' },
    { match: 'forearm', profile: [[0, 0.04]],  group: 'arm' },
    { match: 'arm',     profile: [[0, 0.048]], group: 'arm' },
    { match: 'hand',    profile: [[0, 0.035]], group: 'hand' },
    { match: 'upleg',   profile: [[0, 0.075]], group: 'leg' },
    { match: 'leg',     profile: [[0, 0.055]], group: 'leg' },
    { match: 'foot',    profile: [[0, 0.04]],  group: 'foot' },
    { match: 'toe',     profile: [[0, 0.03]],  group: 'foot' },
  ];
}

/** §5.4 기본 인간형 DNA 의 깊은 복사. */
export function defaultDna() {
  return {
    version: 1,
    name: 'humanlike',
    segments: baseSegments(),
    cuts: [],
    groups: { head: 1, torso: 1, arm: 1, hand: 1, leg: 1, foot: 1 },
  };
}

// ---------------------------------------------------------------------------
//  PCHIP (Fritsch–Carlson) — 단조 큐빅 Hermite 보간.
//  제어점을 정확히 통과(C¹ 연속) + 오버슈트 없음(반지름이 음수/융기로 튀지 않음).
//  Catmull-Rom 은 급변 구간에서 볼록 껍질 돌출을 만들 수 있어 배제한다.
// ---------------------------------------------------------------------------

// 제어점 [[t,r],…] (t 오름차순 가정) → t∈[0,1] 을 33지점 균등 샘플한 Float32Array.
function samplePchip(points) {
  const lut = new Float32Array(LUT_N);
  const n = points.length;
  if (n === 0) return lut;
  if (n === 1) { lut.fill(points[0][1]); return lut; }

  const xs = points.map(p => p[0]);
  const ys = points.map(p => p[1]);
  // 구간 기울기
  const d = new Array(n - 1);
  for (let i = 0; i < n - 1; i++) {
    const h = xs[i + 1] - xs[i];
    d[i] = h > 1e-9 ? (ys[i + 1] - ys[i]) / h : 0;
  }
  // 접선 m — Fritsch–Carlson
  const m = new Array(n);
  m[0] = d[0];
  m[n - 1] = d[n - 2];
  for (let i = 1; i < n - 1; i++) {
    if (d[i - 1] * d[i] <= 0) {
      m[i] = 0; // 부호가 다르거나 0 → 극점, 접선 0 (오버슈트 봉쇄)
    } else {
      const h1 = xs[i] - xs[i - 1], h2 = xs[i + 1] - xs[i];
      const w1 = 2 * h2 + h1, w2 = h2 + 2 * h1;
      m[i] = (w1 + w2) / (w1 / d[i - 1] + w2 / d[i]); // 가중 조화평균
    }
  }

  for (let s = 0; s < LUT_N; s++) {
    const t = s / (LUT_N - 1);
    // t 가 속한 구간 찾기
    let i = 0;
    while (i < n - 2 && t > xs[i + 1]) i++;
    const h = xs[i + 1] - xs[i];
    if (h <= 1e-9) { lut[s] = ys[i]; continue; }
    const u = (t - xs[i]) / h;
    const u2 = u * u, u3 = u2 * u;
    // Hermite 기저
    const h00 = 2 * u3 - 3 * u2 + 1;
    const h10 = u3 - 2 * u2 + u;
    const h01 = -2 * u3 + 3 * u2;
    const h11 = u3 - u2;
    lut[s] = h00 * ys[i] + h10 * h * m[i] + h01 * ys[i + 1] + h11 * h * m[i + 1];
  }
  return lut;
}

// ---------------------------------------------------------------------------
//  compileDna — 정규식 컴파일 + simpleName→세그먼트 스펙 메모이즈 평가기.
// ---------------------------------------------------------------------------

/**
 * @param {object} dna 살 DNA
 * @returns {{ resolve(key:string): (object|null), invalidate():void, dna:object }}
 *   resolve(simpleKey) → { lut:Float32Array(33), rMax, flatten, blend, group, cuts[] }
 *   또는 null (r=0 세그먼트, 예: 손가락). LUT 는 profile×groups 를 미터 단위로 담는다.
 */
export function compileDna(dna) {
  let segs = null, cutSpecs = null, cache = null;

  function build() {
    segs = dna.segments.map(s => ({
      re: new RegExp(s.match, 'i'),
      profile: s.profile,
      flatten: s.flatten || null,
      blend: s.blend ?? 1,
      group: s.group || null,
    }));
    cutSpecs = (dna.cuts || []).map(c => ({
      re: new RegExp(c.match, 'i'),
      t: c.t ?? 0.5,
      offset: c.offset || [0, 0, 0],
      r: c.r ?? 0.05,
      strength: c.strength ?? 0.6,
    }));
    cache = new Map();
  }
  build();

  function resolve(key) {
    if (cache.has(key)) return cache.get(key);
    let spec = null;
    for (const s of segs) {
      if (s.re.test(key)) { spec = s; break; }
    }
    const profile = spec ? spec.profile : FALLBACK_PROFILE;
    const gMul = spec && spec.group ? (dna.groups[spec.group] ?? 1) : 1;
    const lut = samplePchip(profile);
    let rMax = 0;
    for (let i = 0; i < lut.length; i++) { lut[i] *= gMul; if (lut[i] > rMax) rMax = lut[i]; }
    if (rMax <= 1e-6) { cache.set(key, null); return null; } // r=0 → 살 생략
    const cuts = cutSpecs.filter(c => c.re.test(key));
    const out = {
      lut, rMax,
      flatten: spec ? spec.flatten : null,
      blend: spec ? spec.blend : 1,
      group: spec ? spec.group : null,
      cuts,
    };
    cache.set(key, out);
    return out;
  }

  return {
    dna,
    resolve,
    invalidate() { build(); }, // groups·segments 변경 시 캐시 무효화
  };
}

// ---------------------------------------------------------------------------
//  F4 — 보간 / 변이 / 직렬화 (프리셋과 함께 F4 에서 UI 연결)
// ---------------------------------------------------------------------------

/** 시드 PRNG — mulberry32. 재현 가능한 변이용. */
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Box–Muller 표준정규 (rng: ()=>[0,1)). */
function gaussian(rng) {
  let u = 0, v = 0;
  while (u < 1e-12) u = rng();
  v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/** 숫자 리프 전체 선형 보간. 세그먼트는 match 문자열로 짝짓기. (F4) */
export function lerpDna(a, b, t) {
  const out = JSON.parse(JSON.stringify(t < 0.5 ? a : b)); // 비숫자·불일치 항목의 기본
  out.name = `${a.name}→${b.name}`;
  // groups
  for (const k in out.groups) {
    if (a.groups[k] != null && b.groups[k] != null)
      out.groups[k] = a.groups[k] + (b.groups[k] - a.groups[k]) * t;
  }
  // 세그먼트 — match 기준 짝짓기
  const bByMatch = new Map(b.segments.map(s => [s.match, s]));
  out.segments = a.segments.map(sa => {
    const sb = bByMatch.get(sa.match);
    if (!sb) return JSON.parse(JSON.stringify(t < 0.5 ? sa : sa)); // 불일치 → a 유지
    const seg = JSON.parse(JSON.stringify(sa));
    // profile 제어점 짝짓기 (개수 같을 때만 리프 보간, 다르면 t<0.5 규칙)
    if (sa.profile.length === sb.profile.length) {
      seg.profile = sa.profile.map((pa, i) => {
        const pb = sb.profile[i];
        return [pa[0] + (pb[0] - pa[0]) * t, pa[1] + (pb[1] - pa[1]) * t];
      });
    } else {
      seg.profile = JSON.parse(JSON.stringify(t < 0.5 ? sa.profile : sb.profile));
    }
    // flatten f 보간
    if (sa.flatten && sb.flatten) {
      seg.flatten = {
        dir: t < 0.5 ? sa.flatten.dir.slice() : sb.flatten.dir.slice(),
        f: sa.flatten.f + (sb.flatten.f - sa.flatten.f) * t,
      };
    }
    if (sa.blend != null && sb.blend != null)
      seg.blend = sa.blend + (sb.blend - sa.blend) * t;
    return seg;
  });
  // b 에만 있는 세그먼트는 t≥0.5 면 추가
  if (t >= 0.5) {
    const aMatches = new Set(a.segments.map(s => s.match));
    for (const sb of b.segments)
      if (!aMatches.has(sb.match)) out.segments.push(JSON.parse(JSON.stringify(sb)));
  }
  return out;
}

/**
 * 시드 변이 — profile r·flatten f 를 ×(1+N(0,amount)) 로 흔든다.
 * r 은 [0.5,1.8]×원본 클램프. (F4)
 */
export function mutateDna(dna, seed, amount) {
  const rng = mulberry32(seed);
  const out = JSON.parse(JSON.stringify(dna));
  out.name = `${dna.name}#${seed}`;
  for (const s of out.segments) {
    s.profile = s.profile.map(([t, r]) => {
      if (r <= 0) return [t, r]; // 생략 세그먼트(손가락)는 그대로
      const f = 1 + gaussian(rng) * amount;
      return [t, Math.max(0.5 * r, Math.min(1.8 * r, r * f))];
    });
    if (s.flatten) {
      const f = s.flatten.f * (1 + gaussian(rng) * amount);
      s.flatten = { ...s.flatten, f: Math.max(0.3, Math.min(1, f)) };
    }
  }
  return out;
}

/** JSON 문자열로 직렬화. (F4) */
export function serializeDna(dna) {
  return JSON.stringify(dna, null, 2);
}

/** JSON → DNA + version/스키마 검증. 실패 시 throw. (F4) */
export function parseDna(json) {
  const dna = typeof json === 'string' ? JSON.parse(json) : json;
  if (!dna || typeof dna !== 'object') throw new Error('DNA: 객체가 아님');
  if (dna.version !== 1) throw new Error(`DNA: 지원하지 않는 version ${dna.version}`);
  if (!Array.isArray(dna.segments)) throw new Error('DNA: segments 배열 없음');
  for (const s of dna.segments) {
    if (typeof s.match !== 'string') throw new Error('DNA: segment.match 문자열 아님');
    if (!Array.isArray(s.profile) || !s.profile.length)
      throw new Error(`DNA: "${s.match}" profile 비어 있음`);
    try { new RegExp(s.match); } catch { throw new Error(`DNA: "${s.match}" 정규식 오류`); }
  }
  if (!dna.groups || typeof dna.groups !== 'object') dna.groups = {};
  if (!Array.isArray(dna.cuts)) dna.cuts = [];
  return dna;
}
