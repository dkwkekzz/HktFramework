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
//  기본 인간형 DNA
//
//  ⚠️ F1 단계: profile 은 전부 상수 1점(현 RADII 값 그대로) — 화면 결과가 v4.2 와
//  같아야 한다(회귀 기준). 곡선·flatten·blend·bump/cut 은 F2 에서 채운다.
//  hips 행은 없다: 세그먼트는 부모→자식이고 hips 의 부모는 정적 노드라 hips 를
//  자식으로 하는 세그먼트가 존재하지 않는다 (§5.4).
// ---------------------------------------------------------------------------
function humanlikeDna() {
  return {
    version: 1,
    name: 'humanlike',
    // 위에서부터 첫 매칭 (RADII 규약: forearm 이 arm 보다, upleg 이 leg 보다 먼저)
    segments: [
      { match: 'thumb|index|middle|ring|pinky', profile: [[0, 0]] }, // 손가락 생략
      { match: 'end$', profile: [[0, 0.02]] },                       // 리프 가늘게
      { match: 'head', profile: [[0, 0.085]], group: 'head' },
      { match: 'neck', profile: [[0, 0.045]], group: 'head' },
      { match: 'spine2', profile: [[0, 0.105]], group: 'torso' },
      { match: 'spine1', profile: [[0, 0.095]], group: 'torso' },
      { match: 'spine', profile: [[0, 0.09]], group: 'torso' },
      { match: 'shoulder', profile: [[0, 0.05]], group: 'arm' },
      { match: 'forearm', profile: [[0, 0.04]], group: 'arm' },
      { match: 'arm', profile: [[0, 0.048]], group: 'arm' },
      { match: 'hand', profile: [[0, 0.035]], group: 'hand' },
      { match: 'upleg', profile: [[0, 0.075]], group: 'leg' },
      { match: 'leg', profile: [[0, 0.055]], group: 'leg' },
      { match: 'foot', profile: [[0, 0.04]], group: 'foot' },
      { match: 'toe', profile: [[0, 0.03]], group: 'foot' },
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
    const out = { lut, rMax, flatten: spec ? spec.flatten : null, blend: spec ? spec.blend : 1, group, spheres: segSpheres };
    cache.set(key, out);
    return out;
  }

  return { resolve, invalidate: () => cache.clear() };
}
