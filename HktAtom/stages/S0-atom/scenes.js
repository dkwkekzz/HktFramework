// scenes.js — 장면(초기 조건) 명세. 차원은 장면이 정한다 (z 동결은 장면 속성).
//
// 세부 단계 ①: 이상 기체(맥스웰 초기 p·힘 0)로 무대·장부·수치 불변식을 검증한다.
// 노브(상자 크기·입자 수·초기 온도)는 여기 상수 — 수식형이 아니므로 조정은 step 기록으로 충분.

(function () {
  'use strict';
  const isNode = typeof module !== 'undefined' && module.exports;
  const E = isNode ? require('./engine.js') : window.HktS0Engine;

  // 종 레지스트리 — ①은 가상 원소 1종(질량만 의미). ③에서 Z·occ 로 확장.
  const SPECIES = { X: { mass: 1.0, radius: 0.5, color: '#5ab' } };

  // 맥스웰 분포 초기 운동량: 각 활성 성분 p_k ~ Normal(0, √(m·T₀)).
  // 이후 총 운동량(무게중심 표류)을 정확히 0 으로 뺀다 — 장부 P 검사를 깨끗하게.
  function maxwellInit(world, T0, rng) {
    const P = E.V.zero();
    for (const a of world.atoms) {
      const m = world.mass[a.sp];
      const s = Math.sqrt(m * T0);
      a.p.x = s * E.gaussian(rng);
      a.p.y = s * E.gaussian(rng);
      a.p.z = world.frozenZ ? 0 : s * E.gaussian(rng);
      E.V.addInto(P, a.p);
    }
    const n = world.atoms.length;
    if (n > 0) {  // 무게중심 표류 제거 → 총 P = 0
      for (const a of world.atoms) {
        a.p.x -= P.x / n; a.p.y -= P.y / n;
        if (!world.frozenZ) a.p.z -= P.z / n;
      }
    }
  }

  // 격자 위 초기 배치 (겹침 방지 — ①은 힘이 없지만 뷰어 가독성·후속 단계 습관)
  function latticePlace(world, N, rng) {
    const L = world.box.L;
    const per = Math.ceil(Math.sqrt(N));           // z 동결 → xy 격자
    const gx = L.x / per, gy = L.y / per;
    let k = 0;
    for (let i = 0; i < per && k < N; i++) {
      for (let j = 0; j < per && k < N; j++, k++) {
        const jitter = 0.15;
        const r = E.V.make(
          (i + 0.5 + (rng() - 0.5) * jitter) * gx,
          (j + 0.5 + (rng() - 0.5) * jitter) * gy,
          0
        );
        world.atoms.push(E.makeAtom('X', r, E.V.zero()));
      }
    }
  }

  // s01-ideal-gas: 주기 상자·z 동결·이상 기체. 무대·장부·dt 불변식의 기본 장면.
  function idealGas(opts) {
    const o = opts || {};
    const rng = o.rng || E.makeRng(o.seed || 12345);
    const N = o.N || 64;
    const T0 = o.T0 != null ? o.T0 : 1.0;
    const L = o.L || 20;
    const world = E.makeWorld({
      dt: o.dt != null ? o.dt : 0.01,
      box: { L: E.V.make(L, L, L), bc: o.bc || 'periodic' },
      frozenZ: o.frozenZ !== false,
      mass: { X: SPECIES.X.mass },
      // ①은 힘 0 (기본 zeroForces) — computeForces 미지정
    });
    latticePlace(world, N, rng);
    maxwellInit(world, T0, rng);
    E.recomputeLedger(world);
    world._meta = { name: 's01-ideal-gas', T0, N };
    return world;
  }

  // s01-open-box: 열린 경계 — 탈출 회계 확인용. 입자가 상자 밖으로 탄도 비행해 나간다.
  function openBox(opts) {
    const o = opts || {};
    return idealGas(Object.assign({ bc: 'open', T0: 2.0, seed: o.seed || 777, N: o.N || 64 }, o, { bc: 'open' }));
  }

  const SCENES = {
    's01-ideal-gas': idealGas,
    's01-open-box': openBox,
  };

  function build(name, opts) {
    const f = SCENES[name];
    if (!f) throw new Error('알 수 없는 장면: ' + name);
    return f(opts);
  }

  const api = { SPECIES, SCENES, build, idealGas, openBox, maxwellInit };
  if (isNode) module.exports = api;
  else window.HktS0Scenes = api;
})();
