// viewer/htj-lod.js — 제너릭 "관찰자 거리 → DNA 발현 해상도" LOD (T3·확인용 렌더 도메인).
//
//   merge-dna.md §5 T3 — M3 reconstructShape(DNA→점 무리)·T2b pointCloudSurface(점→면)는 *모든* 개체를
//   같은 해상도로 발현했다. 세계가 커지면(청크 N↑) 전부 fine 으로 그리는 비용이 N 에 비례한다. 이 모듈은
//   SW4 적응 LOD(0039·물리)의 **렌더 판** = *발현 해상도를 관찰자 거리에 묶는다*: 가까운 청크는 fine(전체 점),
//   먼 청크는 coarse(decimate stride=2^L → 소수 점), 가장 먼 청크는 *민둥 구 1개*("hash 한 개 coarse"·§5 T3).
//   비용(발현 점 예산)이 *세계 크기*가 아니라 *관찰 영역*에 묶인다(0039/0015/0034 의 측정 계보·렌더 판).
//
//   순수·결정론·렌더 의존 0 — *어디에/얼마나 촘촘히* 그릴지만 계산하고 픽셀·음영색은 호출자가 입힌다.
//   관찰자(camera·거리)는 *확인용* 개념이라 engine 이 모르는 viewer 도메인(세계↔확인용 단방향·engine 변경 0).
//   reconstructShape(engine·htj-shapedna·DNA→점)를 *읽어* 거리별 해상도를 입힌다. 물리량 불변. UMD(브라우저·Node).
(function (root, factory) {
  'use strict';
  const api = factory(typeof require !== 'undefined' ? require : null, root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.HTJLod = api;
})(typeof self !== 'undefined' ? self : this, function (require, root) {
  'use strict';
  const D = require ? require('../engine/htj-shapedna.js') : (root && root.HTJShapeDNA);

  // 거리 → LOD 레벨. band 거리마다 한 레벨씩 거칠어짐(0..maxL). band<=0 → 항상 L0(fine·항등).
  function levelOf(dist, band, maxL) {
    if (!(band > 0)) return 0;
    const L = Math.floor(dist / band);
    return L < 0 ? 0 : (L > maxL ? maxL : L);
  }

  // 개체(청크) 배열 → 관찰자 거리별 해상도로 발현한 점 무리.
  //   entities: [{cx,cy,cz,radius,shapeHash}]  dict: {hash→canonical}  observer: {cx,cy,cz}
  //   opts: { band(거리/레벨·기본 0=fine 전부), maxL(최대 레벨·기본 4), ropt(reconstructShape 옵션) }
  //   반환: { cloud:[{cx,cy,cz,r}], levels:[L_i], counts:[점수_i], finePoints, totalPoints, fineCount }
  //     · L0(fine): reconstructShape 전체 점 그대로 · 0<L<maxL: stride=2^L decimate(반경 √stride 확대로 덮음)
  //     · L==maxL: *민둥 구 1개*(개체 중심·반경 = 가장 거친 발현 = "hash 한 개 coarse")
  function lodCloud(entities, dict, observer, opts) {
    opts = opts || {};
    const band = opts.band != null ? opts.band : 0;
    const maxL = opts.maxL != null ? opts.maxL : 4;
    const ropt = opts.ropt || null;
    const ox = observer ? (observer.cx || 0) : 0, oy = observer ? (observer.cy || 0) : 0, oz = observer ? (observer.cz || 0) : 0;
    const cloud = [], levels = [], counts = [];
    let finePoints = 0, fineCount = 0;
    for (const e of entities) {
      const dx = e.cx - ox, dy = e.cy - oy, dz = (e.cz || 0) - oz, dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
      const L = levelOf(dist, band, maxL);
      levels.push(L);
      let n = 0;
      if (L >= maxL && band > 0) {
        // 가장 거친 발현 = 민둥 구 1개(원래 합치기 전 단일 구·"hash 한 개 coarse").
        cloud.push({ cx: e.cx, cy: e.cy, cz: e.cz || 0, r: e.radius || 1 }); n = 1;
      } else {
        const pts = D ? D.reconstructShape(e, dict, ropt) : null;
        if (!pts) { cloud.push({ cx: e.cx, cy: e.cy, cz: e.cz || 0, r: e.radius || 1 }); n = 1; }  // DNA 없음 → 단일 구 폴백
        else if (L === 0) { for (const p of pts) cloud.push(p); n = pts.length; }                  // fine: 전체 점
        else {                                                                                       // coarse: stride decimate
          const stride = 1 << L, scale = Math.sqrt(stride);
          for (let i = 0; i < pts.length; i += stride) { const p = pts[i]; cloud.push({ cx: p.cx, cy: p.cy, cz: p.cz, r: (p.r || 1) * scale }); n++; }
        }
      }
      counts.push(n);
      if (L === 0) { finePoints += n; fineCount++; }
    }
    return { cloud, levels, counts, finePoints, totalPoints: cloud.length, fineCount };
  }

  return { lodCloud, levelOf, VERSION: 1 };
});
