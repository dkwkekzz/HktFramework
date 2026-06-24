// viewer/scenes/step_0066.js — 장면 통일(U1) 파일럿: step_0066 "지형이 자란다" 시나리오를 *1벌* 로.
//
//   design/scene-unify.md 의 시나리오 SSOT 모듈 형식. 한 step 의 장면이 여기 한 곳에만 산다:
//     · init(w)/advance(w,p) = 세계 셋업·법칙(viewer 라이브 STEPS 와 동일 본문)
//     · frames/toFrame(w)    = 헤드리스 캡처가 읽을 "world → 그릴 점들"(per-step capture.js 대체)
//     · makeWorld()          = 헤드리스 전용 world(브라우저는 viewer 의 HTJWorld 를 쓰고 이건 무시)
//
//   이걸 viewer.html(브라우저·라이브)과 tools/htj-render-capture.js(Node·PNG)가 *함께* 읽는다.
//   확인용 도구다 — engine 을 *읽기만* 한다(세계↔확인용 단방향). UMD 라 브라우저·Node 양립.
//
//   주: step_0066 폴더(닫힘·불변)는 건드리지 않는다 — 이 모듈은 *새 파일*(파일럿 시범)이고,
//   viewer 의 인라인 0066 을 이 모듈이 대신 제공한다(같은 본문). 실제 채택은 다음 step 부터.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require);
  else { root.HTJScenes = root.HTJScenes || {}; root.HTJScenes['0066'] = factory(null); }
})(typeof self !== 'undefined' ? self : this, function (require) {
  // require 있으면 Node(engine require), 없으면 브라우저 전역(window.HTJ*).
  const E = require ? require('../../engine/htj-entity.js') : self.HTJEntity;
  const T = require ? require('../../engine/htj-terrain.js') : self.HTJTerrain;

  // 카펫 앵커 + 정착(느린·내려앉은) 자유 구체를 terrainSurface 로 환원(퇴적 발현). viewer 보조함수 인라인.
  function rebuildSurface(w) {
    const es = w.__entities, topZ = w.__topZ, sp = (e) => Math.hypot(e.px, e.py, e.pz) / e.mass;
    const deposits = [], flying = [];
    for (const e of es) {
      if (e.anchored) continue;
      if (sp(e) < 0.5 && (e.cz - topZ) < w.N * 0.12) deposits.push({ cx: e.cx, cy: e.cy, cz: e.cz, radius: e.radius });   // 정착(느림·내려앉음)
      else flying.push({ cx: e.cx, cy: e.cy, cz: e.cz, radius: e.radius, peak: 0.7 });                                    // 낙하 중(viewer 오버레이용)
    }
    w.__surface = T.terrainSurface(w.__carpet, { up: w.__up, deposits });
    let hMax = -Infinity; for (const h of w.__surface.heights) if (h > hMax) hMax = h; w.__hMax = hMax;   // viewer drawSurface heightMax
    w.__flying = flying;
    w.__depositCount = w.__surface.depositCount;
  }

  return {
    label: 'step_0066 — 지형이 자란다 [통일 파일럿]',
    title: 'HTJ — 지형이 자란다: 정착한 자유 구체(퇴적물)가 지형 표면이 된다',
    sub: '자유 구체가 계곡으로 굴러 정착하면 그 퇴적물이 표면 위에 얹혀 계곡이 차오른다. (design/scene-unify.md 시나리오 통일 U1 파일럿 — viewer 라이브·헤드리스 캡처가 이 한 벌을 함께 읽는다)',
    mode: 'energy', dynamics: true, render: 'terrain',
    defaults: { colorScale: 'relative', view: 'energy' },

    init(w) {
      const N = w.N, cen = (N - 1) / 2;
      const Rf = N * 1.4, AR = N * 0.05, sr = N * 0.022, SPC = N * 0.06, Wt = N * 0.34;
      const bowl = (x, y) => N * 0.0010 * (x * x + y * y) - N * 0.10;     // 가운데 낮은 사발(계곡)
      const topZ = cen + N * 0.12;
      const mk = (cx, cy, cz, mass, r, anc) => ({ cx, cy, cz, mass, px: 0, py: 0, pz: 0, Lx: 0, Ly: 0, Lz: 0,
        KEcm: 0, internalKE: 0, internalE: 0, energy: 0, cells: (4 * Math.PI / 3) * r * r * r, radius: r, temp: 0, peak: 0.5, anchored: !!anc });
      const ents = [mk(cen, cen, topZ - Rf, 1e9, Rf, true)];             // 바닥 구(중력원·가둠)
      const carpet = [];
      for (let gx = -Wt; gx <= Wt; gx += SPC) for (let gy = -Wt; gy <= Wt; gy += SPC) { const e = mk(cen + gx, cen + gy, topZ + bowl(gx, gy), 1, AR, true); ents.push(e); carpet.push({ cx: e.cx, cy: e.cy, cz: e.cz }); }
      const gold = Math.PI * (3 - Math.sqrt(5));                         // 자유 구체(퇴적 재료)
      for (let i = 0; i < 150; i++) { const rr = Math.sqrt((i + 0.5) / 150) * Wt * 0.5, th = gold * i; ents.push(mk(cen + Math.cos(th) * rr, cen + Math.sin(th) * rr, topZ + N * 0.18 + (i % 8) * sr * 0.5, 60, sr, false)); }
      w.__entities = ents; w.__saved = ents.map(e => ({ cx: e.cx, cy: e.cy, cz: e.cz })); w.__carpet = carpet; w.__topZ = topZ; w.__Rf = Rf; w.__up = 4;
      w.__gopt = { G: 0.2 * Rf * Rf / 1e9, soft: N * 0.06 }; w.__copt = { k: 40, cDamp: 25 }; w.__fopt = { k: 40, mu: 0.9 }; w.__ropt = { k: 40, muRoll: 1.2 };
      rebuildSurface(w);
    },

    advance(w) {
      if (!w.__entities) return;
      const es = w.__entities;
      E.applyEntityGravity(es, 0.12, w.__gopt); E.applyEntityContact(es, 0.12, w.__copt);
      E.applyEntityFriction(es, 0.12, w.__fopt); E.applyEntityRollingResistance(es, 0.12, w.__ropt);
      E.stepEntities(es, 0.12);
      const sv = w.__saved;
      for (let i = 0; i < es.length; i++) if (es[i].anchored) { es[i].cx = sv[i].cx; es[i].cy = sv[i].cy; es[i].cz = sv[i].cz; es[i].px = es[i].py = es[i].pz = 0; es[i].Lx = es[i].Ly = es[i].Lz = 0; }
      rebuildSurface(w);
    },

    // ── 헤드리스 캡처(per-step capture.js 대체) ──
    makeWorld() { return { N: 40 }; },          // 헤드리스 전용 world(브라우저는 자기 HTJWorld 사용)
    frames: [1, 400, 1200, 3000],               // 캡처할 step 마크(시간 경과 4 패널)
    captureOpts: { N: 64 },                     // htj-capture 패널 좌표 폭(toFrame 이 [0,64]로 그림)
    // world → 그릴 점들: 가운데 y 행 x-z 단면. 표면(법선 음영)부터 base 까지 채움 band(계곡이 차오름).
    toFrame(w) {
      const surf = w.__surface, J0 = surf.ny >> 1;
      const Nc = 64, pad = Nc * 0.08, xspan = (surf.nx - 1) * surf.dx;
      const sc = (Nc - 2 * pad) / xspan, OX = pad - surf.x0 * sc, OZ = Nc * 0.34, BASE = Nc * 0.96;
      const Lv = [0.45, 1.0, 0.6], Lm = Math.hypot(Lv[0], Lv[1], Lv[2]), Ln = [Lv[0] / Lm, Lv[1] / Lm, Lv[2] / Lm];
      const pts = [];
      for (let I = 0; I < surf.nx; I++) {
        const k = J0 * surf.nx + I, cz = surf.heights[k], n = surf.normals[k];
        const sx = OX + (surf.x0 + I * surf.dx) * sc;
        const top = OZ - (cz - w.__topZ) * sc, s = 0.45 + 0.55 * Math.max(0, n.x * Ln[0] + n.y * Ln[1] + n.z * Ln[2]);
        for (let py = top; py <= BASE; py += 0.8) { const depth = 1 - (py - top) / (BASE - top + 1e-9); pts.push({ cx: sx, cy: py, r: 0.5, v: s * (0.45 + 0.55 * depth) }); }
      }
      return { pts, depositCount: surf.depositCount };
    },

    note: '<b>지형이 *자란다* — 정착한 자유 구체(퇴적물)가 지형 표면이 되어 계곡이 차오른다.</b> 자유 구체가 중력+접촉+마찰+구름 저항(0059 물리)으로 계곡으로 굴러 <b>정착</b>하면, terrainSurface 가 그 정착 퇴적물을 표면에 splat(max="물질이 위에 쌓임")해 표면이 들어올려진다. <b>[통일 파일럿]</b> 이 장면 정의는 <code>viewer/scenes/step_0066.js</code> 한 곳에만 있고, viewer(라이브)와 <code>tools/htj-render-capture.js</code>(헤드리스 PNG)가 *같은 한 벌* 을 읽는다(design/scene-unify.md U1). 닫은 step_0066 폴더는 불변 — 이건 시범용 새 파일.'
  };
});
