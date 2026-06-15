// scenes.js — 장면 레지스트리 (append-only)
// 한 step = 장면 한 항. 이 한 항이 검증·골든 해시·시각화 셋 모두의 단일 출처(DRY, SPINE §6.1).
//   { id, title, desc, ticks, init(rng,K)→spec, watch(sim,K)→{지표}, assert(ctx,K)→[{name,pass,value}] }
;(function (root, factory) {
  const K = (typeof require !== 'undefined') ? require('./hgo-kernel.js') : root.HGO.kernel;
  const mod = factory(K);
  if (typeof module !== 'undefined' && module.exports) module.exports = mod;
  else (root.HGO = root.HGO || {}).scenes = mod;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (K) {
  'use strict';

  // 원소는 author 한 타입이 아니라 (Z,N) 다발의 값일 뿐 (SPINE §3 요건1).
  // 수소·헬륨·탄소·산소 = 양성자 수의 위치.
  const ELEMENTS = [{ Z: 1, N: 0 }, { Z: 2, N: 2 }, { Z: 6, N: 6 }, { Z: 8, N: 8 }];

  const SCENES = {
    'step-0001': {
      id: 'step-0001',
      title: '원자가 존재하고 떠다닌다 (자유 운동)',
      desc: '개별 원자(보존량 다발: Z·N·e·들뜸·위치·속도)를 빈 토러스 무대에 띄워 ' +
            '상호작용 없이 자유 운동시킨다. 힘 0 — 무대 + 규칙 0. ' +
            '닫힌 장부(전하 Q·바리온 B·렙톤 L·에너지 E)와 결정론을 앵커로 박는다.',
      ticks: 50,

      init(rng, K) {
        const W = 100, H = 100, n = 40, atoms = [];
        for (let i = 0; i < n; i++) {
          const el = ELEMENTS[(rng() * ELEMENTS.length) | 0];
          const ion = rng() < 0.2 ? 1 : 0;           // 20% 이온화: 전자 1 제거 → 전하 Q≠0
          atoms.push({
            Z: el.Z, N: el.N, e: el.Z - ion, x: 0,    // x = 전자 들뜸 준위(step-0002 부터 씀)
            rx: rng() * W, ry: rng() * H,
            vx: rng() * 2 - 1, vy: rng() * 2 - 1,      // 속도 [-1,1] — 운동에너지 = 온도
          });
        }
        return { W, H, atoms, knobs: { dt: 1.0 } };
      },

      watch(sim, K) {
        const L = K.ledger(sim);
        let speed = 0; for (const a of sim.atoms) speed += Math.hypot(a.vx, a.vy);
        return {
          atoms: sim.atoms.length,
          Q: L.Q, B: L.B, L: L.L, E: +L.E.toFixed(3),
          meanSpeed: +(speed / sim.atoms.length).toFixed(4),
        };
      },

      // 가설: 원자가 결정론적으로 *움직였고*, 무대(토러스) 안에 머문다.
      // ctx 는 verify 가 채운다: { meanDisp, allBounded, maxCoord, hashChanged }
      assert(ctx, K) {
        return [
          { name: '원자가 움직임(상태 변화·평균 변위>0)', pass: ctx.hashChanged && ctx.meanDisp > 0, value: +ctx.meanDisp.toFixed(3) },
          { name: '무대 경계 유지(토러스 안)', pass: ctx.allBounded, value: +ctx.maxCoord.toFixed(2) },
        ];
      },
    },
  };

  return { SCENES, ELEMENTS };
});
