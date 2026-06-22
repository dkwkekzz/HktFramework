// htj-cooling.js — HTJ 열한째 법칙: 복사 냉각(열의 *출구*) = 뜨거운 물질이 *빛으로 식는다*(질량 보존).
//
//   step_0012 의 발열(점화)은 코어에 열을 *무한정* 쌓는다 — 복사가 없어 별이 끝없이 뜨거워진다(runaway).
//   현실의 별은 *빛난다* = 열을 공간으로 내버린다. 그래서 발열(source)↔복사(sink)가 균형 잡는
//   **정상상태 온도**에서 멈추고, 코어(계속 발열)는 뜨겁고 표면(미점화)은 식어 *지속하는 그래디언트*가 선다.
//   step_0005 의 경계 복사는 `energy`(=질량) 를 내보내 — 0006 의 energy=질량(E=mc²) 이후로는 "복사=질량
//   소실"이라 어긋난다. **빛은 질량이 아니라 *열(therm)* 에서 나와야 한다** → 이 법칙은 `therm` 만 줄인다.
//
//   법칙은 **광학적으로 얇은 회색 복사** 하나 — 모든 셀이 제 내부에너지에 비례해 열을 빛으로 방출:
//     u ← u·(1 − dt·coolRate)        (du/dt = −coolRate·u, 셀마다),   빛 = Σ dt·coolRate·u
//   빠져나간 열은 사라지지 않고 **`world.radiated` 장부**(빛으로 나간 총량)에 적재된다 → 세계 안 u 감소분 =
//   세계 밖 radiated 증가분(열 회계 보존). **energy(ρ)는 절대 안 건드린다** → 별이 빛을 내도 질량 보존
//   (step_0005 의 질량 소실 모순을 therm 으로 옮겨 닫는다 — step_0012 발열과 대칭: 발열은 u 의 source,
//   복사는 u 의 sink, 둘 다 ρ 불변).
//
//   못 박는 것 — **발열↔복사 균형의 정상상태(별이 안정적으로 빛난다)**:
//     · 점화 셀: u += dt·rate·ρ(발열) 와 u·(1−dt·coolRate)(복사) 가 균형 → T 가 *유한 평형*에 정착.
//       평형 온도 T* = rate(1−dt·coolRate)/coolRate — **밀도 ρ 와 무관**(무게가 달라도 같은 표면온도).
//       step_0012 의 무한 runaway 가 *유한 정상상태*로 닫힌다.
//     · 미점화 셀(돌): 발열이 없어 u 가 기하급수로 식어 0 으로 → *완전히 식는다*.
//     · 코어(발열 ON)는 뜨겁고 표면(발열 OFF)은 식어 → 둘 사이 **지속 그래디언트** = 빛나며 식는 별.
//
//   세계(법칙) 그 자체 — 렌더·캔버스·DOM 에 의존하지 않는다(Node 에서 그대로 돈다).
//   coolRate=0 또는 dt=0 → 항등(early return) — 가법성/회귀 0 가드. 발열·중력·열압력·점성·이류와 직교 공존.
//   dt·coolRate>1 이어도 factor 를 0 으로 클램프 → u 비음수 보장(과냉각으로 음수 안 됨, 결정론 유지).
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.HTJCooling = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const RHO = 'energy';                 // 질량 밀도 = 에너지(E=mc²) — 복사는 이걸 *안* 건드린다(질량 보존)
  const THERM = 'therm';                // 내부에너지 밀도 u(열) — 복사가 빼내는 곳
  const DEFAULT_COOL_RATE = 0.1;        // 질량당이 아니라 *열당* 복사율(노브): du/dt = −coolRate·u

  function ensure(world, name) { return world.fields[name] || world.addField(name, { type: Float64Array }); }

  // 복사 냉각 1스텝 — 모든 셀의 내부에너지 일부가 빛으로 빠져나간다: u ← u·(1−dt·coolRate). 질량(ρ)은 불변.
  //   빠져나간 열은 world.radiated(빛 장부)에 누적 → u 감소분 = radiated 증가분(열 회계 보존).
  //   coolRate=0 또는 dt=0 → 항등(early return, 회귀 0). dt·coolRate>1 → factor 0 클램프(u 비음수).
  function applyCooling(world, dt, opts) {
    opts = opts || {};
    const coolRate = opts.coolRate != null ? opts.coolRate : DEFAULT_COOL_RATE;
    if (dt == null) dt = 1;
    if (!coolRate || !dt) return world;                   // 노브=0 → 세계 불변
    if (coolRate < 0) throw new Error('applyCooling: coolRate must be ≥ 0');
    if (world.radiated == null) world.radiated = 0;       // 빛 장부(지연 초기화 — htj-world 불변)
    const k = dt * coolRate;
    const factor = k >= 1 ? 0 : 1 - k;                    // dt·coolRate>1 → 0 클램프(과냉각 음수 방지)
    const u = ensure(world, THERM), L = u.length, N = world.N;
    let emitted = 0, visited = 0;

    // ── 활성 블록 순회(opts.active) — 빈 블록을 *실제로 건너뛴다*(step_0018, 첫 실현 절감) ──
    //   복사는 per-cell(이웃 없음)이고 빈 셀(u=0)은 lost=0=무변화 → 활성 블록만 돌아도 *조밀과 비트 동일*.
    //   opts.active 생략 → 조밀 전-격자(아래) = byte 동일(회귀 0).
    if (opts.active) {
      const bs = opts.blockSize || 8;
      for (let b = 0; b < opts.active.length; b++) {
        const ox = opts.active[b][0], oy = opts.active[b][1], oz = opts.active[b][2];
        for (let lz = 0; lz < bs; lz++) { const z = oz + lz; if (z >= N) break;
          for (let ly = 0; ly < bs; ly++) { const y = oy + ly; if (y >= N) break;
            for (let lx = 0; lx < bs; lx++) { const x = ox + lx; if (x >= N) break;
              const i = (z * N + y) * N + x;
              const lost = u[i] * (1 - factor);
              u[i] -= lost; emitted += lost; visited++;
            }
          }
        }
      }
    } else {
      for (let i = 0; i < L; i++) {                        // 조밀 전-격자(기존 경로 = 회귀 0)
        const lost = u[i] * (1 - factor);                  // 이 셀이 빛으로 내보낸 열
        u[i] -= lost;                                      // = u[i] *= factor
        emitted += lost;
      }
      visited = L;
    }
    world.radiated += emitted;                            // 세계 밖으로 나간 총 빛(장부)
    if (opts.stats) opts.stats.cellsVisited = visited;    // 실측 작업량(방문 셀 수) — 절감 증거(선택)
    return world;
  }

  // 측정자 — 총 내부에너지(세계 안 열) / 평형 표면온도 예측(검증·문서 공유).
  function totalInternal(world) { const u = ensure(world, THERM); let s = 0; for (let i = 0; i < u.length; i++) s += u[i]; return s; }

  // 점화 셀의 발열↔복사 평형 온도 T*(이산 고정점). rate=발열률, coolRate=복사율, dt=스텝.
  //   u* = (u* + dt·rate·ρ)(1−dt·coolRate) 의 해 → T*=u*/ρ = rate(1−dt·coolRate)/coolRate (ρ 무관).
  function equilibriumT(rate, coolRate, dt) { return rate * (1 - dt * coolRate) / coolRate; }

  return { applyCooling, totalInternal, equilibriumT,
           RHO, THERM, DEFAULT_COOL_RATE, VERSION: 1 };
});
