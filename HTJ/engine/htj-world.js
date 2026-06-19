// htj-world.js — HTJ 세계의 *기반 무대*: 격자 + 그 위에 사는 장(fields).
//
//   세계 = N³ 셀 격자(공간) 위에 이름 붙은 **장(field)** 들이 산다.
//   장 = 셀마다 값 하나를 갖는 배열(예: energy = 연속 에너지 밀도, Float64).
//   격자는 *위치*만 정하고, 무엇이 거기 있는지는 장이 정한다. 새 물리량은 장을 더해 표현한다.
//
//   원자·물질 같은 구조는 *사전 배열로 박지 않는다* — 장의 동역학이 굴러간 결과로 *창발*한다.
//
//   결정론(같은 seed/같은 연산 → 같은 세계) + 장-단위 결정론 지문(fingerprint)을 못 박는다.
//   브라우저(viewer.html)·Node(verify.js) 양쪽에서 동일하게 동작(UMD).
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.HTJWorld = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // 결정론 PRNG (mulberry32) — seed 같으면 항상 같은 난수열.
  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // 세계 = N³ 격자 + 이름 붙은 장들. 기본 장 'energy'(Float64) 를 갖고 시작한다.
  function createWorld(N) {
    N = N | 0;
    if (N <= 0) throw new Error('createWorld: N must be > 0');
    const SIZE = N * N * N;
    const fields = Object.create(null);            // 이름 → 셀별 값 배열(TypedArray)
    const scratch = Object.create(null);           // 동시 갱신용 더블버퍼(장별)

    const world = {
      N,
      fields,
      scratch,
      // ── 격자 기하: 전단사 인덱싱. z 가 가장 바깥(slab), 그 안에 y(row), x(col). ──
      index(x, y, z) { return (z * N + y) * N + x; },
      coords(i) { const x = i % N; const y = ((i - x) / N) % N; const z = (i - x - y * N) / (N * N); return [x, y, z]; },
      inBounds(x, y, z) { return x >= 0 && y >= 0 && z >= 0 && x < N && y < N && z < N; },

      // ── 장 관리 ──
      // 새 장을 격자 위에 만든다. opts.type=TypedArray 생성자(기본 Float64Array), opts.fill=초기값.
      addField(name, opts) {
        opts = opts || {};
        const Type = opts.type || Float64Array;
        const a = new Type(SIZE);
        if (opts.fill) a.fill(opts.fill);
        fields[name] = a;
        return a;
      },
      field(name) { return fields[name]; },
      get(name, x, y, z) { return fields[name][(z * N + y) * N + x]; },
      set(name, x, y, z, v) { fields[name][(z * N + y) * N + x] = v; },
      clear(name) { fields[name].fill(0); },

      // ── 장 측정자 ──
      total(name) { const a = fields[name]; let s = 0; for (let i = 0; i < a.length; i++) s += a[i]; return s; },
      count(name, eps) { const a = fields[name]; eps = eps || 0; let c = 0; for (let i = 0; i < a.length; i++) if (a[i] > eps) c++; return c; },
      max(name) { const a = fields[name]; let m = -Infinity; for (let i = 0; i < a.length; i++) if (a[i] > m) m = a[i]; return m; },
      min(name) { const a = fields[name]; let m = Infinity; for (let i = 0; i < a.length; i++) if (a[i] < m) m = a[i]; return m; },

      // 결정론 지문 — 장 바이트열 FNV-1a 32bit. 같은 장이면 같은 값(검증·회귀 가드용).
      fingerprint(name) {
        const a = fields[name];
        const bytes = new Uint8Array(a.buffer, a.byteOffset, a.byteLength);
        let h = 0x811c9dc5;
        for (let i = 0; i < bytes.length; i++) { h ^= bytes[i]; h = Math.imul(h, 0x01000193); }
        return h >>> 0;
      }
    };
    world.addField('energy', { type: Float64Array });   // 기본 장: 연속 에너지 밀도
    return world;
  }

  // 데모 시드 — 중심의 공(ball)을 장에 채운다(법칙 아님, 무대를 눈에 보이게 하는 정물).
  //   동심 3띠로 값 1/2/3 부여 → 렌더러가 색으로 구분해 3D voxel 모양이 또렷이 보인다.
  //   결과는 결정론적(같은 N → 같은 공). 기본 대상 장은 'energy'.
  function seedBall(world, opts) {
    opts = opts || {};
    const name = opts.field || 'energy';
    const N = world.N, a = world.fields[name];
    const c = (N - 1) / 2;
    const r = opts.r != null ? opts.r : N * 0.42;
    a.fill(0);
    for (let z = 0; z < N; z++)
      for (let y = 0; y < N; y++)
        for (let x = 0; x < N; x++) {
          const dx = x - c, dy = y - c, dz = z - c;
          const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
          if (d <= r) {
            const t = d / r;                     // 0(중심)~1(표면)
            a[(z * N + y) * N + x] = t < 0.55 ? 3 : t < 0.82 ? 2 : 1;
          }
        }
    return world;
  }

  return { mulberry32, createWorld, seedBall, VERSION: 2 };
});
