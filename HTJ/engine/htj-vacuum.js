// htj-vacuum.js — HTJ 확장성 S2 의 *진공 전이 규칙*: 너무 옅으면 0 으로 흡수(질량은 보존).
//
//   step_0016 이 희소 블록 컨테이너(engine/htj-sparse.js)를 세웠다 — 비-영 블록만 할당 → 비용이
//   *점유*에 비례. 그러나 정직한 한계가 남았다: **파이프라인 별(가우시안)은 꼬리가 전 격자를
//   비-영으로 채워**(exp(-r²)>0 어디서나) 점유 512/512 = 희소 이득 0. 희소 컨테이너가 *실제로*
//   이득을 내려면 옅은 진공을 *정확한 0* 으로 만들어야 한다(design/scalability.md §2 레버1 "대가/주의":
//   "임계 미만이면 0 으로 흡수, 흡수량은 이웃으로 분배해 보존").
//
//   법칙은 **밀도 임계 흡수** 하나 — 옅은 셀(0<ρ<eps)의 질량을 *가장 밀한 이웃*으로 통째 옮기고 0 으로:
//     · 가장 밀한 이웃(6-이웃 중 max ρ, 동률은 최저 인덱스) 이 *자기보다 밀할 때만* 기부 →
//       질량이 *밀한 쪽(안쪽)으로만* 흐른다(옆으로 뒤섞지 않음). 가우시안 꼬리가 바깥부터 벗겨져
//       진공이 자라난다. 국소 최대인 고립 옅은 덩어리(더 밀한 이웃 없음)는 *그대로 둔다*(갈 곳 없음).
//     · 더블버퍼(스냅샷에서 판정) → 순서 무관·결정론. 기부=full ρ 이동 → 보존(기계 정밀도 이내).
//
//   세계(법칙) 그 자체 — 렌더·캔버스·DOM 에 의존하지 않는다(Node 에서 그대로 돈다).
//   eps=0 또는 null → 항등(early return) — 가법성/회귀 0 가드. 다른 법칙과 직교 공존.
//   *주의(정직)*: 이 규칙은 밀도(=질량) 장만 옮긴다 — 운동량 동반 수송은 후속(S2 둘째 단위 일반화에서
//   advect 와 합류). 그래서 "near-vacuum 을 vacuum 으로 보는" 물리적 정규화이자 희소화의 전이 규칙이다.
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.HTJVacuum = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const FIELD = 'energy';            // 밀도=질량 장(E=mc²) — 흡수 대상
  const DEFAULT_EPS = 1e-3;          // 진공 임계(노브): ρ<eps 옅은 셀을 흡수

  // 진공 흡수 1스텝 — 옅은 셀(0<ρ<eps)의 질량을 더 밀한 이웃으로 옮기고 0 으로(질량 보존).
  //   eps=0/null → 항등(early return, 회귀 0). 더블버퍼 → 결정론.
  //
  //   opts.scalars(step_0024) — 옅은 셀이 흡수될 때 *함께 이동할* 장 목록(운동량 mom_x/y/z·내부E therm 등).
  //     기부는 full 이동(셀이 정확히 0 이 됨) → 동반 장도 full 이동(i 의 값 통째 → bj). 그래야 질량을 *비울
  //     때* 운동량·에너지도 같이 흘러 보존된다(step_0017 정직한 한계 "운동량 동반 안 함" 을 닫음 — 별을
  //     희소화해도 물리 일관). opts.scalars 없으면 미동작 → 기존(밀도장만) 경로 byte 동일(회귀 0).
  function applyVacuum(world, opts) {
    opts = opts || {};
    const eps = opts.eps != null ? opts.eps : DEFAULT_EPS;
    const name = opts.field || FIELD;
    if (!eps) return world;                              // 노브=0 → 세계 불변
    if (eps < 0) throw new Error('applyVacuum: eps must be ≥ 0');
    const N = world.N, NN = N * N, R = world.fields[name];
    if (!R) return world;
    let out = world.scratch[name];
    if (!out || out.length !== R.length) out = world.scratch[name] = new Float64Array(R.length);
    out.set(R);                                          // 스냅샷 복사(판정은 R, 기록은 out)
    // 동반 수송 장(운동량·내부E 등) — 각자 더블버퍼(스냅샷 S, 기록 so). 기부 i→bj 매핑은 R(밀도)이 정한다.
    const carry = [];
    if (opts.scalars) for (const sn of opts.scalars) {
      const S = world.fields[sn]; if (!S) continue;
      const key = '__vac_' + sn;
      let so = world.scratch[key];
      if (!so || so.length !== S.length) so = world.scratch[key] = new Float64Array(S.length);
      so.set(S);
      carry.push({ S, so });
    }

    for (let z = 0; z < N; z++)
      for (let y = 0; y < N; y++)
        for (let x = 0; x < N; x++) {
          const i = (z * N + y) * N + x, v = R[i];
          if (v <= 0 || v >= eps) continue;             // 옅은(0<ρ<eps) 셀만 흡수 후보
          // 가장 밀한 이웃 찾기(스냅샷 R 기준, 동률=최저 인덱스 = 첫 발견).
          let bj = -1, bv = v;                           // 자기보다 *밀할 때만* 기부(bv 초기값=v)
          if (x > 0     && R[i - 1]  > bv) { bv = R[i - 1];  bj = i - 1; }
          if (x < N - 1 && R[i + 1]  > bv) { bv = R[i + 1];  bj = i + 1; }
          if (y > 0     && R[i - N]  > bv) { bv = R[i - N];  bj = i - N; }
          if (y < N - 1 && R[i + N]  > bv) { bv = R[i + N];  bj = i + N; }
          if (z > 0     && R[i - NN] > bv) { bv = R[i - NN]; bj = i - NN; }
          if (z < N - 1 && R[i + NN] > bv) { bv = R[i + NN]; bj = i + NN; }
          if (bj < 0) continue;                          // 더 밀한 이웃 없음(고립 국소 최대) → 그대로
          out[i] -= v;                                   // 옅은 셀 비움(받은 게 없으면 정확히 0)
          out[bj] += v;                                  // 더 밀한 이웃이 통째 흡수(질량 보존)
          for (let c = 0; c < carry.length; c++) {       // 동반 장도 full 이동(스냅샷 기준 → 보존)
            const q = carry[c].S[i]; carry[c].so[bj] += q; carry[c].so[i] -= q;
          }
        }
    R.set(out);
    for (let c = 0; c < carry.length; c++) carry[c].S.set(carry[c].so);
    return world;
  }

  // 측정자 — 총 질량(보존 확인) / 비-영 셀 수(진공화 진행) / 정확한 0 셀 수.
  function totalMass(world, name) { const R = world.fields[name || FIELD]; let s = 0; for (let i = 0; i < R.length; i++) s += R[i]; return s; }
  function nonzeroCount(world, name) { const R = world.fields[name || FIELD]; let c = 0; for (let i = 0; i < R.length; i++) if (R[i] !== 0) c++; return c; }
  function exactZeroCount(world, name) { const R = world.fields[name || FIELD]; let c = 0; for (let i = 0; i < R.length; i++) if (R[i] === 0) c++; return c; }

  return { applyVacuum, totalMass, nonzeroCount, exactZeroCount, FIELD, DEFAULT_EPS, VERSION: 1 };
});
