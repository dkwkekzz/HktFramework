// htj-world.js — HTJ 세계의 *기반 무대*: 셀로 구성된 3D 공간.
//
//   아직 법칙(동역학)은 없다. 이 모듈은 세계의 *기질*만 제공한다:
//     - N³ 셀 격자(공간) + 전단사 인덱싱
//     - 결정론 PRNG(같은 seed → 같은 세계) + 결정론 지문(fingerprint)
//     - 관찰용 데모 시드(seedBall) — 법칙이 아니라 *정물*(기반 무대를 눈에 보이게)
//
//   브라우저(viewer.html)·Node(verify.js) 양쪽에서 동일하게 동작(UMD).
//   미래 step 은 이 위에 *보존되는 양*과 *국소 갱신 법칙*을 가법적으로 얹는다.
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

  // 세계 = N³ 셀 격자. 각 셀은 uint8 값(0 = 빈 공간). 값의 *의미*는 미래 법칙이 정한다.
  function createWorld(N) {
    N = N | 0;
    if (N <= 0) throw new Error('createWorld: N must be > 0');
    const cells = new Uint8Array(N * N * N);
    return {
      N,
      cells,
      // 전단사 인덱싱: (x,y,z) ↔ i. z 가 가장 바깥(slab), 그 안에 y(row), x(col).
      index(x, y, z) { return (z * N + y) * N + x; },
      coords(i) { const x = i % N; const y = ((i - x) / N) % N; const z = (i - x - y * N) / (N * N); return [x, y, z]; },
      inBounds(x, y, z) { return x >= 0 && y >= 0 && z >= 0 && x < N && y < N && z < N; },
      get(x, y, z) { return cells[(z * N + y) * N + x]; },
      set(x, y, z, v) { cells[(z * N + y) * N + x] = v & 0xff; },
      clear() { cells.fill(0); },
      count() { let c = 0; for (let i = 0; i < cells.length; i++) if (cells[i]) c++; return c; },
      // 결정론 지문 — FNV-1a 32bit. 같은 셀 배열이면 같은 값(검증·회귀 가드용).
      fingerprint() {
        let h = 0x811c9dc5;
        for (let i = 0; i < cells.length; i++) { h ^= cells[i]; h = Math.imul(h, 0x01000193); }
        return h >>> 0;
      }
    };
  }

  // 데모 시드 — 중심의 공(ball)을 채운다(법칙 아님, 기반 무대를 눈에 보이게 하는 정물).
  //   동심 3띠로 값 1/2/3 부여 → 렌더러가 색으로 구분해 3D voxel 모양이 또렷이 보인다.
  //   seed 인자는 받지만 결과는 결정론적(같은 N → 같은 공). 미래 step 은 seed 로 분포를 흩뿌린다.
  function seedBall(world, opts) {
    opts = opts || {};
    const N = world.N;
    const c = (N - 1) / 2;
    const r = opts.r != null ? opts.r : N * 0.42;
    world.clear();
    for (let z = 0; z < N; z++)
      for (let y = 0; y < N; y++)
        for (let x = 0; x < N; x++) {
          const dx = x - c, dy = y - c, dz = z - c;
          const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
          if (d <= r) {
            const t = d / r;                     // 0(중심)~1(표면)
            world.set(x, y, z, t < 0.55 ? 3 : t < 0.82 ? 2 : 1);
          }
        }
    return world;
  }

  return { mulberry32, createWorld, seedBall, VERSION: 1 };
});
