// htj-radiate.js — HTJ 셋째 법칙: 에너지의 *출구* = 경계 복사(sink, 세계 밖 차가운 우주로).
//
//   step_0004 의 별은 *한 번 터지고 꺼지는 섬광*이었다 — 닫힌 상자엔 에너지가 빠져나갈 곳이 없어,
//   방출된 에너지가 상자를 균일하게 채우면(열적 죽음) 중심도 더 안 밝아 "빛나지 않는다".
//   "별은 어떻게 *계속* 빛나는가?" 의 답: **우주가 차가운 sink 라서.** 별은 에너지를 공간으로
//   *내버리고*, 그래서 source(별)↔sink(우주) 사이에 영구 그래디언트(뜨거운 중심→차가운 바깥)가 선다.
//
//   법칙은 **경계 복사** 하나 — 상자의 바깥 껍질 셀의 에너지 일부가 세계 밖으로 빠져나간다:
//     Eᵢ ← Eᵢ·(1−rate)   (경계 셀만),   leaked = Σ rate·Eᵢ
//   빠져나간 양은 사라지지 않고 **`world.radiated` 장부**에 적재된다 →
//   상자 안 에너지는 더는 불변이 아니지만(열린 계), 총 회계 **Σ(potential)+Σ(energy)+radiated 는 보존**.
//   (step_0002 의 닫힌 상자가 *열린* 상자가 되는 첫 다리 — 다만 빠져나간 에너지를 끝까지 추적한다.)
//
//   세계(법칙) 그 자체 — 렌더·캔버스·DOM 에 의존하지 않는다(Node 에서 그대로 돈다).
//   rate=0 → 항등(early return). 미래 step 은 복사된 에너지(빛)를 *다른 곳에서 흡수*시켜 닫을 수 있다.
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.HTJRadiate = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const FIELD = 'energy';
  const DEFAULT_RATE = 0.2;       // 경계 셀이 한 스텝에 우주로 내보내는 비율.

  // 복사 1스텝 — 경계(바깥 껍질) 셀의 에너지 일부가 세계 밖으로 빠져나간다(sink).
  //   빠져나간 양은 world.radiated 에 누적 → Σ(P+E+radiated) 보존.
  //   rate=0 → 항등(early return). rate∈(0,1] 이라야 에너지 비음수 유지.
  function radiate(world, rate, opts) {
    opts = opts || {};
    const name = opts.field || FIELD;
    if (rate == null) rate = DEFAULT_RATE;
    if (!rate) return world;                            // 노브=0 → 세계 불변
    if (rate < 0 || rate > 1) throw new Error('radiate: rate must be in [0, 1]');
    if (world.radiated == null) world.radiated = 0;     // 복사 장부(지연 초기화 — htj-world 불변)
    const N = world.N, E = world.fields[name];
    let leaked = 0;
    for (let z = 0; z < N; z++)
      for (let y = 0; y < N; y++)
        for (let x = 0; x < N; x++) {
          if (x === 0 || y === 0 || z === 0 || x === N - 1 || y === N - 1 || z === N - 1) {
            const i = (z * N + y) * N + x, d = rate * E[i];
            E[i] -= d;                                  // 경계 셀에서 에너지가 빠져나간다
            leaked += d;
          }
        }
    world.radiated += leaked;                           // 세계 밖으로 나간 총량(장부)
    return world;
  }

  // 총 회계 — Σ(potential) + Σ(energy) + radiated. 보존 검증용(닫힌 우주 전체).
  function totalAccount(world) {
    let s = world.total('energy') + (world.radiated || 0);
    if (world.fields.potential) s += world.total('potential');
    return s;
  }

  return { radiate, totalAccount, FIELD, DEFAULT_RATE, VERSION: 1 };
});
