// spectral.js — 렌즈 L-λ: 광자 파장(λ) → 스펙트럼 색 (읽기 전용 번역)
//
// 렌더 트랙의 author 금지선(RENDER.md §3): *어느 양이 색이 되는가* 를 고르는 건 읽기(허용).
//   여기선 시뮬이 내보낸 광자의 λ(=hc/ΔE, 준위 차에서 창발) 하나만 색으로 번역한다.
//   "빨강/파랑"을 종류별로 박지 않는다 — 실제 가시광 스펙트럼의 파장→색 곡선을 그대로 쓴다.
//
// 자연 단위(R=h=c=1)라 λ 는 nm 가 아니다(전이 1→0 λ≈1.33 … 3→2 λ≈20.6). 그래서
//   *측정된* λ 범위([lo,hi])를 가시광 창(400~700nm)에 선형 정규화한다 — 창은 데이터에서
//   재므로 author 가 아니다(원자 뷰어가 속도를 /1.6 로 정규화하는 것과 동형). 물리적 순서
//   (짧은 λ=고에너지=보라 ↔ 긴 λ=저에너지=빨강)는 보존된다.
;(function (root, factory) {
  const mod = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = mod;
  else (root.HGORender = root.HGORender || {}).spectral = mod;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  // 가시광 파장(nm) → RGB[0..255]. Dan Bruton 근사(물리 스펙트럼 곡선) — 색을 author 하지 않는다.
  function wavelengthToRGB(nm) {
    let r = 0, g = 0, b = 0;
    if (nm >= 380 && nm < 440) { r = -(nm - 440) / (440 - 380); b = 1; }
    else if (nm < 490) { g = (nm - 440) / (490 - 440); b = 1; }
    else if (nm < 510) { g = 1; b = -(nm - 510) / (510 - 490); }
    else if (nm < 580) { r = (nm - 510) / (580 - 510); g = 1; }
    else if (nm < 645) { r = 1; g = -(nm - 645) / (645 - 580); }
    else if (nm <= 780) { r = 1; }
    // 양 끝(보라·빨강) 강도 감쇠 — 실제 눈 감도 곡선
    let f = 1;
    if (nm < 420) f = 0.3 + 0.7 * (nm - 380) / (420 - 380);
    else if (nm > 700) f = 0.3 + 0.7 * (780 - nm) / (780 - 700);
    const gamma = 0.8;
    const adj = v => v <= 0 ? 0 : Math.round(255 * Math.pow(v * f, gamma));
    return [adj(r), adj(g), adj(b)];
  }

  // 측정된 λ 범위 [lo,hi] 를 가시광 창(violet 400 ↔ red 700)에 *선형* 정규화.
  //   파장 차를 보존(회절격자 분광기처럼 위치 ∝ λ) — 로그 압축은 간격을 왜곡(약한 author)하므로 안 쓴다.
  //   짧은 λ → 400(보라) / 긴 λ → 700(빨강) = 실제 스펙트럼 순서. 단일 선이면 중앙(녹색).
  function lambdaToNm(lambda, lo, hi) {
    if (!(hi > lo)) return 530;
    let t = (lambda - lo) / (hi - lo);
    t = Math.max(0, Math.min(1, t));
    return 400 + 300 * t;
  }

  // 광자 λ → RGB. 프레임의 측정 범위(range={lo,hi})로 정규화 후 스펙트럼 곡선 적용.
  function photonColor(lambda, range) {
    return wavelengthToRGB(lambdaToNm(lambda, range.lo, range.hi));
  }

  // 광자 배열에서 λ 범위를 *측정*(author 아님). 빈 배열이면 null.
  function measureRange(photons) {
    let lo = Infinity, hi = -Infinity;
    for (const p of photons) { if (p.lambda < lo) lo = p.lambda; if (p.lambda > hi) hi = p.lambda; }
    return (lo <= hi) ? { lo, hi } : null;
  }

  return { wavelengthToRGB, lambdaToNm, photonColor, measureRange };
});
