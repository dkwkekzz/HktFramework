// htj-lod.js — HTJ 확장성 레버 3(관찰자 중심 LOD): 보는 곳만 정밀, 멀수록 거칠게.
//
//   design/scalability.md §2 레버3·§4 S7. 법칙이 (중력 제외) 국소라 공간을 타일로 쪼개 해상도를 다르게
//   줄 수 있다. 관찰자 근처는 고해상(fine), 멀수록 거친 블록 평균(coarse) → **시뮬 비용이 세계 크기가
//   아니라 "관찰되는 국소"에 묶인다**(레버3 의 핵심). S2(희소)·S5(승격)·S6(전역 중력) 위에서 세계 크기를
//   비용에서 분리하는 마지막 레버.
//
//   downsample(field,N,bs): bs³ 블록을 1 값(블록 합)으로 — 거친 표현(셀 수 bs³ 배 절감). Σ 보존.
//   upsample(coarse,N,bs): 거친 값을 블록 안에 균일 분배 — 다시 fine. Σ 보존(형상은 손실=근사 LOD).
//   lodLevels / effectiveCellCount: 관찰자 거리로 블록별 해상도(near=fine·far=coarse) + 유효 셀 수
//     (=fine 셀 + coarse 블록) → 세계 N 키워도 관찰자 국소 fine 예산은 일정(비용 평탄).
//
//   세계(스케줄러) 그 자체 — 렌더·캔버스·DOM 에 의존하지 않는다(Node 에서 그대로 돈다). 순수 함수.
//   가로지르는 제약(design §5): LOD 는 *손실 근사*라 결과를 바꾼다 → "동일 LOD 정책 → 동일 결과"의 약한
//   결정론으로 본다(downsample/upsample 은 결정론·Σ 보존). 결정론 영향 임계(radius 등)는 시뮬 상수성.
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.HTJLOD = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function blocksPerAxis(N, bs) { return Math.ceil(N / bs); }

  // 다운샘플 — bs³ 블록을 1 값(블록 합)으로. 반환 Float64Array(nbx³). Σ 보존(블록 합의 합 = 전체 합).
  function downsample(field, N, bs) {
    const nbx = blocksPerAxis(N, bs), coarse = new Float64Array(nbx * nbx * nbx);
    for (let z = 0; z < N; z++) for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const v = field[(z * N + y) * N + x]; if (v === 0) continue;
      const bk = (((z / bs) | 0) * nbx + ((y / bs) | 0)) * nbx + ((x / bs) | 0);
      coarse[bk] += v;
    }
    return coarse;
  }

  // 업샘플 — 거친 블록 값을 블록 안 셀에 *균일* 분배(셀당 = 블록합/블록셀수). Σ 보존(형상 손실=근사).
  //   경계 블록(N%bs≠0)은 실제 셀 수로 나눠 누설 0.
  function upsample(coarse, N, bs) {
    const nbx = blocksPerAxis(N, bs), fine = new Float64Array(N * N * N);
    // 블록별 실제 셀 수.
    for (let bz = 0; bz < nbx; bz++) for (let by = 0; by < nbx; by++) for (let bx = 0; bx < nbx; bx++) {
      const bk = (bz * nbx + by) * nbx + bx, total = coarse[bk]; if (total === 0) continue;
      const x0 = bx * bs, y0 = by * bs, z0 = bz * bs;
      const xe = Math.min(x0 + bs, N), ye = Math.min(y0 + bs, N), ze = Math.min(z0 + bs, N);
      const ncells = (xe - x0) * (ye - y0) * (ze - z0), per = total / ncells;
      for (let z = z0; z < ze; z++) for (let y = y0; y < ye; y++) for (let x = x0; x < xe; x++) fine[(z * N + y) * N + x] = per;
    }
    return fine;
  }

  // 관찰자 거리별 블록 LOD 레벨 — near(중심 거리 ≤ radius 블록): 0(fine) · far: 1(coarse).
  //   반환 Uint8Array(nbx³). (다단계는 radius 배열로 확장 가능 — 이 단위는 2단계.)
  function lodLevels(N, bs, observer, radius) {
    const nbx = blocksPerAxis(N, bs), lv = new Uint8Array(nbx * nbx * nbx);
    const obx = observer[0] / bs, oby = observer[1] / bs, obz = observer[2] / bs, r2 = radius * radius;
    for (let bz = 0; bz < nbx; bz++) for (let by = 0; by < nbx; by++) for (let bx = 0; bx < nbx; bx++) {
      const dx = bx + 0.5 - obx, dy = by + 0.5 - oby, dz = bz + 0.5 - obz;
      lv[(bz * nbx + by) * nbx + bx] = (dx * dx + dy * dy + dz * dz <= r2) ? 0 : 1;
    }
    return lv;
  }

  // 유효 셀 수 — fine 블록은 bs³ 셀, coarse 블록은 1 셀(블록 평균). 관찰자 국소 fine + 나머지 coarse.
  //   세계 N 을 키워도 fine 예산(near 블록 수·bs³)은 일정 → 비용이 관찰되는 국소에 묶임(레버3 핵심).
  function effectiveCellCount(N, bs, observer, radius) {
    const lv = lodLevels(N, bs, observer, radius), nbx = blocksPerAxis(N, bs);
    let fine = 0, coarse = 0;
    for (let bz = 0; bz < nbx; bz++) for (let by = 0; by < nbx; by++) for (let bx = 0; bx < nbx; bx++) {
      const bk = (bz * nbx + by) * nbx + bx;
      const x0 = bx * bs, y0 = by * bs, z0 = bz * bs;
      const ncells = (Math.min(x0 + bs, N) - x0) * (Math.min(y0 + bs, N) - y0) * (Math.min(z0 + bs, N) - z0);
      if (lv[bk] === 0) fine += ncells; else coarse += 1;
    }
    return { fine, coarse, effective: fine + coarse, dense: N * N * N };
  }

  return { downsample, upsample, lodLevels, effectiveCellCount, blocksPerAxis, VERSION: 1 };
});
