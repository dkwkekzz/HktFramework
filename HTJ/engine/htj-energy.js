// htj-energy.js — HTJ 의 첫 *동역학*: 에너지 장의 흐름 = 열역학 제2법칙(엔트로피 증가).
//
//   step_0001 은 무대(격자 + 정적 장)만 세웠다 — 법칙 0개. 이 모듈이 세계를 처음으로 *굴린다*.
//
//   법칙은 **확산(diffusion)** 하나 — 가장 단순한 국소 보존 흐름:
//     new_i = E_i + α · Σ_{이웃 j}(E_j − E_i)
//   이 한 줄이 두 열역학 법칙을 동시에 구현한다:
//     · 제1법칙(에너지 보존) — 닫힌 경계 + 대칭 flux. 한 셀이 잃은 만큼 이웃이 정확히 얻는다.
//       각 모서리 (i,j) 의 기여 (E_j−E_i)+(E_i−E_j)=0 → 총 에너지 불변.
//     · 제2법칙(엔트로피 증가) — 갱신 행렬 M 은 *이중확률*(행합=열합=1, α≤1/6 → 비음수).
//       이중확률 사상은 분포를 *섞어*(majorization) 샤논 엔트로피를 단조 증가시킨다 → 증명 가능.
//     평형: 연결된 격자에서 분포는 균일로 수렴 → 엔트로피 → ln(N³)(최대 무질서).
//
//   세계(법칙) 그 자체 — 렌더·캔버스·DOM 에 의존하지 않는다(Node 에서 그대로 돈다).
//   'energy' 장 위에서 돈다. 미래 step 은 이 흐름에 *맞서는* 비선형/경쟁 법칙을 얹어,
//   확산을 거스르고 스스로 유지되는 국소 패턴(= 원자)이 *창발*하게 한다(author 안 함).
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.HTJEnergy = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // α 안정 상한: 3D 6이웃 → α ≤ 1/6 이라야 대각(1−α·deg)≥0 (비음수·이중확률 보장).
  const ALPHA_MAX = 1 / 6;
  const DEFAULT_ALPHA = 1 / 7;   // 안정 상한 아래 기본값.
  const FIELD = 'energy';

  // 확산 1스텝(동시 갱신) — 더블버퍼로 결정론·순서 무관.
  //   닫힌 경계(no-flux): 경계 밖 이웃과는 교환하지 않는다 → 에너지가 상자를 안 떠난다(총량 보존).
  //   α=0 → 항등(early return) — 가법성/회귀 0 가드.
  //
  //   opts.active(step_0020) — *번지는* stencil 법칙을 활성 순회로 일반화한다(확장성 레버1).
  //     확산은 0 셀이 비-영 이웃의 flux 를 받아 *번진다* → 활성 블록만 돌면 경계 번짐을 놓친다.
  //     그래서 opts.active 에는 **active∪halo**(활성 블록 + 6-면 이웃 블록, ActiveSet.originsWithHalo)를
  //     넘긴다 — 번짐이 닿는 칸을 모두 덮어 *조밀과 비트 동일*. active∪halo 밖 셀은 자신·이웃이 모두 0 →
  //     확산 결과 불변(건너뛰어도 동일). 더블버퍼라 읽기는 옛 E, 쓰기는 처리 칸만 → 순서 무관.
  //     opts.active 생략 → 조밀 전-격자(기존 경로) = byte 동일(회귀 0).
  function diffuseEnergy(world, alpha, name, opts) {
    name = name || FIELD;
    if (alpha == null) alpha = DEFAULT_ALPHA;
    if (!alpha) return world;                         // 노브=0 → 세계 불변
    if (alpha < 0 || alpha > ALPHA_MAX) throw new Error('diffuseEnergy: alpha must be in [0, 1/6]');
    const N = world.N, E = world.fields[name], NN = N * N;
    let out = world.scratch[name];
    if (!out || out.length !== E.length) out = world.scratch[name] = new Float64Array(E.length);

    // 한 셀의 확산 갱신값(조밀·활성 공통) — out[i] = E[i] + α·Σ_{이웃}(E_j−E_i), no-flux 경계.
    function step(x, y, z) {
      const i = (z * N + y) * N + x, e = E[i];
      let flux = 0;
      if (x > 0)     flux += E[i - 1]  - e;
      if (x < N - 1) flux += E[i + 1]  - e;
      if (y > 0)     flux += E[i - N]  - e;
      if (y < N - 1) flux += E[i + N]  - e;
      if (z > 0)     flux += E[i - NN] - e;
      if (z < N - 1) flux += E[i + NN] - e;
      out[i] = e + alpha * flux;
    }

    if (opts && opts.active) {
      // ── 활성∪halo 순회 — 번짐이 닿는 블록만(조밀과 비트 동일) ──
      const bs = opts.blockSize || 8, active = opts.active;
      let visited = 0;
      for (let b = 0; b < active.length; b++) {                 // 1패스: 처리 칸만 새 값 계산(읽기=옛 E)
        const ox = active[b][0], oy = active[b][1], oz = active[b][2];
        for (let lz = 0; lz < bs; lz++) { const z = oz + lz; if (z >= N) break;
          for (let ly = 0; ly < bs; ly++) { const y = oy + ly; if (y >= N) break;
            for (let lx = 0; lx < bs; lx++) { const x = ox + lx; if (x >= N) break; step(x, y, z); visited++; }
          }
        }
      }
      for (let b = 0; b < active.length; b++) {                 // 2패스: 처리 칸만 써넣기(나머지는 불변=0)
        const ox = active[b][0], oy = active[b][1], oz = active[b][2];
        for (let lz = 0; lz < bs; lz++) { const z = oz + lz; if (z >= N) break;
          for (let ly = 0; ly < bs; ly++) { const y = oy + ly; if (y >= N) break;
            for (let lx = 0; lx < bs; lx++) { const x = ox + lx; if (x >= N) break; const i = (z * N + y) * N + x; E[i] = out[i]; }
          }
        }
      }
      if (opts.stats) opts.stats.cellsVisited = visited;
      return world;
    }

    for (let z = 0; z < N; z++)                                 // 조밀 전-격자(기존 경로 = 회귀 0)
      for (let y = 0; y < N; y++)
        for (let x = 0; x < N; x++) step(x, y, z);
    E.set(out);
    return world;
  }

  // 샤논 엔트로피 S = −Σ pᵢ ln pᵢ (pᵢ = Eᵢ/총에너지). 단위 nats.
  //   최소 0(에너지가 한 셀에 집중) ~ 최대 ln(점유 셀 수)(완전 균일). 제2법칙의 *측정자*.
  function entropy(world, name) {
    const E = world.fields[name || FIELD];
    let total = 0;
    for (let i = 0; i < E.length; i++) total += E[i];
    if (total <= 0) return 0;
    let S = 0;
    for (let i = 0; i < E.length; i++) {
      const p = E[i] / total;
      if (p > 0) S -= p * Math.log(p);
    }
    return S;
  }

  // 에너지 분산(균질도 측정) — 평형(균일)에 가까울수록 0 으로 수렴.
  function energyVariance(world, name) {
    const E = world.fields[name || FIELD], n = E.length;
    let mean = 0;
    for (let i = 0; i < n; i++) mean += E[i];
    mean /= n;
    let v = 0;
    for (let i = 0; i < n; i++) { const d = E[i] - mean; v += d * d; }
    return v / n;
  }

  // 데모 시드 — 중앙에 에너지를 집중(최소 엔트로피 출발점). half=0 → 단일 셀.
  //   법칙이 아니라 *정물*: 흐름을 눈에 보이게 하는 초기 조건.
  function seedHotSpot(world, opts) {
    opts = opts || {};
    const N = world.N, E = world.fields[opts.field || FIELD];
    E.fill(0);
    const E0 = opts.E0 != null ? opts.E0 : 1000;
    const half = opts.half != null ? opts.half : 0;     // 반폭(셀): 0 → 1셀, 1 → 3³ 정육면체
    const c = (N - 1) >> 1;
    const lo = Math.max(0, c - half), hi = Math.min(N - 1, c + half);
    const span = hi - lo + 1, n = span * span * span;
    const per = E0 / n;
    for (let z = lo; z <= hi; z++)
      for (let y = lo; y <= hi; y++)
        for (let x = lo; x <= hi; x++) E[(z * N + y) * N + x] = per;
    return world;
  }

  return { diffuseEnergy, entropy, energyVariance, seedHotSpot,
           ALPHA_MAX, DEFAULT_ALPHA, FIELD, VERSION: 3 };
});
