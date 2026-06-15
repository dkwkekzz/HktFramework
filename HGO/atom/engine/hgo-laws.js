// hgo-laws.js — 진화하는 법칙 파이프라인 (append-only)
// 한 step = 힘 법칙 1개 + 노브 + LAW_ORDER 한 자리 (노브=0 → early-return = 회귀 0).
// step-0001(부트스트랩): 힘 법칙 0개 — 자유 운동(적분)만이 기질이다.
;(function (root, factory) {
  const K = (typeof require !== 'undefined') ? require('./hgo-kernel.js') : root.HGO.kernel;
  const mod = factory(K);
  if (typeof module !== 'undefined' && module.exports) module.exports = mod;
  else (root.HGO = root.HGO || {}).laws = mod;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (K) {
  'use strict';

  // 노브 기본값 — step 마다 *미존재 시 가법*으로만 추가(과거 장면 무영향).
  const DEFAULTS = { dt: 1.0, kEmit: 0 };

  // 자발 방출(step-0002): 들뜬 원자(x>0)가 확률 kEmit 로 한 준위 강하 → 광자 1개.
  //   닫힌 장부: 원자 들뜸 E ↓ = 광자 E ↑ (정확 쌍 거래, ΔE = levelE(x)−levelE(x−1)).
  //   국소: 그 원자 *혼자*로 판정(이웃·전역 조율자 0). 결정론: sim.rng(시드 의사난수)만.
  function emit(sim) {
    const k = sim.knobs.kEmit;
    if (!k) return;                  // 노브=0 → early-return = 회귀 0 (방출 항 꺼짐 → 직전 비트)
    const rng = sim.rng;
    if (!rng) return;                // 런타임 의사난수 없으면 방출 불가(Math.random 금지 — 결정론)
    for (const a of sim.atoms) {
      if ((a.x | 0) <= 0) continue;            // 바닥 상태는 방출 안 함
      if (rng() >= k) continue;                // 자발 방출 확률 kEmit
      const x0 = a.x | 0, x1 = x0 - 1;
      const dE = K.levelE(x0) - K.levelE(x1);  // 준위 차 = 광자 에너지 (λ author 안 함)
      a.x = x1;                                 // 한 준위 강하 (들뜸 E ↓)
      sim.photons.push({ E: dE, lambda: K.photonLambda(dE), rx: a.rx, ry: a.ry, from: x0, to: x1 });
    }
  }

  // 힘/상호작용 법칙 레지스트리 + 실행 순서. append-only — 노브=0 → 회귀 0.
  const LAWS = { emit };
  const LAW_ORDER = ['emit'];

  // 법칙 적용: 각 법칙이 원자 상태(v·x·…)를 고친다. 노브=0 인 항은 early-return.
  function applyForces(sim) {
    for (const name of LAW_ORDER) LAWS[name](sim);
  }

  function wrap(v, max) { v %= max; if (v < 0) v += max; return v === max ? 0 : v; } // [0,max) 보장 — 음수 wrap 의 부동소수 반올림이 정확히 max 를 내는 경우를 0 으로 접는다

  // 적분(기질): 자유 운동 — 위치 += 속도·dt, 토러스 경계 wrap.
  // 힘이 없으므로 v 불변 → 에너지·운동량 정확 보존(닫힌 장부 잔차 0).
  function integrate(sim) {
    const dt = sim.knobs.dt;
    for (const a of sim.atoms) {
      a.rx = wrap(a.rx + a.vx * dt, sim.W);
      a.ry = wrap(a.ry + a.vy * dt, sim.H);
    }
  }

  return { DEFAULTS, LAWS, LAW_ORDER, applyForces, integrate, wrap };
});
