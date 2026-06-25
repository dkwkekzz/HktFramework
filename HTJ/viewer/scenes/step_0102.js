// viewer/scenes/step_0102.js — (조립) 강수 구동 비: 기후 precip 장(0097)이 SPH 입자를 *시간에 걸쳐* 떨군다.
//   0091/0096 은 물을 *균일 살포*해 한 번에 바다를 만들었다. 그러나 실제 물은 *기후가 만든다* — 습하고 따뜻한
//   곳에 비가 더 온다(0097 precip). 이 무대는 그 다리: 정적 장(precip)이 *동적 SPH 입자*를 낳는다(기후→물).
//   precip ∝ 확률로 셀을 골라 그 위에 빗방울(SPH)을 떨구고 → 중력+압력+점성+경계(0041/0046/0060)로 정착.
//   지형(salt 'TERR')과 강수(humidity salt 'H')는 *무상관* → 물이 모이는 곳의 기후 편향 = 순수 *소스* 결합.
//   engine 변경 0(조립·기존 SPH 법칙 + biomeField precip). 탑다운(x-y 맵·고도 음영+물 파랑). UMD(브라우저·Node).
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require);
  else { root.HTJScenes = root.HTJScenes || {}; root.HTJScenes['0102'] = factory(null); }
})(typeof self !== 'undefined' ? self : this, function (require) {
  const Sph = require ? require('../../engine/htj-sph.js') : self.HTJSph;
  const En = require ? require('../../engine/htj-entity.js') : self.HTJEntity;
  const Stream = require ? require('../htj-stream.js') : self.HTJStream;

  const R = 16, SCALE = 0.10, AMP = 6;                              // 완만한 지형(소스 결합 분리·flow 최소)
  const terr = (x, y) => AMP * Stream.fbm((x + 100) * SCALE, (y + 100) * SCALE, { salt: 'TERR', octaves: 4, gain: 0.55 });
  // 위도 온도대(0093)로 남북 기후 띠 — 적도(따뜻·습)→극(차가움·건조)으로 강수 띠가 또렷(시각·신호 강화).
  const bf = Stream.biomeField({ scale: SCALE, nTemp: 3, nHum: 3, octaves: 4, gain: 0.55, latAmp: 0.7, latPeriod: 64 });
  const precipAt = (x, y) => bf((x + 100), (y + 100)).precip;       // 기후 강수(humidity·effTemp 의 derived·0097)

  const G = 4, DT = 0.02, SUB = 60, BATCH = 10, RAINSTEPS = 24;     // advance 당 비 BATCH 방울·SUB SPH 서브스텝
  const popt = { stiffness: 80, h: 2.2, gamma: 2 }, vopt = { alpha: 3, beta: 3, h: 2.2, gamma: 2 }, bopt = { stiffness: 200, damp: 40, skin: 0.6 };
  const CAN = 40, SPAN = 40, SC = CAN / SPAN;

  // precip 누적 분포 — 셀을 precip 비례 확률로 뽑기 위한 CDF(결정론).
  function buildCDF() {
    const cells = [], DXY = 1.4; let tot = 0;
    for (let x = -R + 2; x <= R - 2 + 1e-9; x += DXY) for (let y = -R + 2; y <= R - 2 + 1e-9; y += DXY) {
      const p = precipAt(x, y); tot += p; cells.push({ x, y, cum: tot });
    }
    return { cells, tot };
  }

  function build(w) {
    const an = [], AR = 4, DXY = 2.0;
    for (let x = -R; x <= R + 1e-9; x += DXY) for (let y = -R; y <= R + 1e-9; y += DXY) an.push({ cx: x, cy: y, cz: terr(x, y) - AR, radius: AR });
    for (let t = -R; t <= R + 1e-9; t += 2.4) for (let z = 0; z <= AMP + 12; z += 3) {
      an.push({ cx: t, cy: -R - 2, cz: z, radius: 5 }); an.push({ cx: t, cy: R + 2, cz: z, radius: 5 });
      an.push({ cx: -R - 2, cy: t, cz: z, radius: 5 }); an.push({ cx: R + 2, cy: t, cz: z, radius: 5 });
    }
    w.__an = an; w.__water = []; w.__cdf = buildCDF(); w.__spawned = 0; w.__rain = 0;
    let seed = 7; w.__rnd = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  }
  function rain(w, n) {
    const { cells, tot } = w.__cdf;
    for (let i = 0; i < n; i++) {
      const u = w.__rnd() * tot; let lo = 0, hi = cells.length - 1;
      while (lo < hi) { const mid = (lo + hi) >> 1; if (cells[mid].cum < u) lo = mid + 1; else hi = mid; }
      const c = cells[lo], jx = (w.__rnd() - .5) * 1.2, jy = (w.__rnd() - .5) * 1.2;
      w.__water.push({ cx: c.x + jx, cy: c.y + jy, cz: AMP + 10, mass: 1, px: 0, py: 0, pz: 0, density: 0, internalE: 0, KEcm: 0, energy: 0, radius: 1 });
      w.__spawned++; w.__rain++;
    }
  }
  function sim(w) {
    if (w.__rainOn) rain(w, BATCH);
    for (let s = 0; s < SUB; s++) {
      Sph.sphPressureForce(w.__water, DT, popt); Sph.sphViscosity(w.__water, DT, vopt);
      for (const p of w.__water) p.pz -= p.mass * G * DT;
      Sph.sphBoundaryForce(w.__water, w.__an, DT, bopt);
      En.stepEntities(w.__water, DT);
    }
  }

  return {
    label: 'step_0102 — (조립) 강수 구동 비: 기후 precip 장이 SPH 빗방울을 떨궈 물이 동적으로 생긴다',
    title: 'HTJ — 강수 구동 비: 정적 강수장(0097)이 동적 SPH 입자를 낳는다(습한 기후=더 많은 물)',
    sub: '0091/0096 은 물을 균일 살포했다. 여기선 기후 강수장 precip(0097)이 SPH 빗방울을 precip∝확률로 떨군다(기후→물). 지형(salt TERR)·강수(salt H)는 무상관 → 물 편향=순수 소스 결합. 비→정착→더 비옴. engine 변경 0.',
    mode: 'energy', dynamics: true, render: 'points',
    defaults: {},

    init(w) { build(w); w.__rainOn = true; },
    advance(w, p) { const t = (w.__t = (w.__t || 0) + 1); w.__rainOn = t <= RAINSTEPS; sim(w); },

    makeWorld() { return { N: CAN }; },
    frames: [2, 8, 14, 24],
    // 배경 = 강수장(건조=어두운 갈색 → 습=초록)·물 = 파랑. 물이 *초록(습한) 띠*에 모이는지 눈으로.
    captureOpts: { N: CAN, color: (v) => v >= 1.5 ? [55, 120, 220] : [95 - v * 55, 70 + v * 120, 45 + v * 25] },
    toFrame(w) {
      const pts = []; const G2 = 30;
      let pmin = Infinity, pmax = -Infinity; const grid = [];
      for (let j = 0; j < G2; j++) for (let i = 0; i < G2; i++) {
        const x = -R + (i / (G2 - 1)) * 2 * R, y = -R + (j / (G2 - 1)) * 2 * R, pr = precipAt(x, y);
        grid.push([x, y, pr]); if (pr < pmin) pmin = pr; if (pr > pmax) pmax = pr;
      }
      const span = (pmax - pmin) || 1;
      for (const [x, y, pr] of grid) pts.push({ cx: (x + SPAN / 2) * SC, cy: (SPAN / 2 - y) * SC, r: 0.62, v: (pr - pmin) / span });   // 0(건조)..1(습)
      for (const p of w.__water) pts.push({ cx: (p.cx + SPAN / 2) * SC, cy: (SPAN / 2 - p.cy) * SC, r: 0.7, v: 1.6 });
      return { pts, count: w.__water.length, spawned: w.__spawned };
    },

    note: '<b>물은 *기후가 만든다* — 정적 강수장(0097 precip)이 *동적 SPH 빗방울*을 낳는다(기후→물의 다리).</b> 0091/0096 은 물을 *균일 살포*해 한 번에 바다를 만들었다. 그러나 실세계 물은 균일하지 않다 — 습하고 따뜻한 곳에 비가 더 온다. 이 무대는 그 결합을 잇는 <b>조립</b>이다(engine 변경 0): 강수장 <code>precip = humidity^0.7·(floor+(1−floor)·effTemp)</code>(0097)에 *비례하는 확률*로 셀을 골라(CDF 역추출) 그 위에 빗방울(SPH 입자)을 떨군다 → 중력+압력(0041)+점성(0046)+경계 접촉(0060)으로 흘러 정착. <b>핵심 분리</b>: 지형(노이즈 salt <code>TERR</code>)과 강수(humidity salt <code>H</code>)를 *무상관*으로 둬, 물이 모이는 곳의 기후 편향이 순수 *소스* 결합(지형 분지가 끌어모은 게 아님)임을 보장. <b>측정(verify)</b>: ① <b>기후 소스 결합</b> 습한 절반(precip 상위) 물량 / 건조한 절반 물량 > 1.3 — 비가 기후를 따라 온다 ② corr(precip, 물밀도) > 0 ③ <b>생성 장부 보존</b> Σ떨군 비 = Σ입자 질량(빗방울은 사라지지 않음) ④ 결정론. <b>흐름</b>(capture 4 프레임·탑다운): 배경은 강수장 음영(밝을수록 습). 빗방울(파랑)이 처음엔 흩뿌려지다가 *밝은(습한) 영역에 더 짙게* 쌓인다 — 기후 지도가 물 지도로. <b>큰 그림</b>: 0101 의 *정적 통합 뷰*를 *동적 SPH 물*로 — PW(딛고 사는 환경) 디딤돌. <b>원칙 준수</b>: precip 은 generic derived 장·비는 generic SPH 입자(타입 0·engine 변경 0). <b>정직한 한계</b>: 완만 지형(소스 분리 위해 flow 최소)·유한 비·증발/유출 없음(정상상태는 0105). 다음: 경사 위 흐르는 강(0103)·차오르는 호수(0104).'
  };
});
