// viewer/scenes/step_0067.js — 매끄러운 퇴적: 정착 퇴적물이 *매끄러운 둔덕*으로 쌓인다(T1 동적 지형 확장).
//
//   step_0066("지형이 자란다")의 정직한 한계 = 표면이 구 상단 max 라 *울퉁(개별 봉우리)*. 이 step 은 그
//   퇴적 delta 를 terrainSurface(smooth) 로 확산 이완해 *이어진 매끄러운 둔덕*으로 만든다 — base 지형 불변·
//   Σ퇴적부피 보존·일방 퇴적(깎임 아님). 장면은 0066 과 같되 rebuildSurface 가 smooth>0 으로 표면을 뽑는다.
//
//   장면 통일(design/scene-unify.md) — 이 한 벌을 viewer 라이브와 tools/htj-render-capture.js(헤드리스 PNG)가
//   함께 읽는다. 확인용 도구라 engine 을 *읽기만* 한다(세계↔확인용 단방향). UMD(브라우저·Node 양립).
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require);
  else { root.HTJScenes = root.HTJScenes || {}; root.HTJScenes['0067'] = factory(null); }
})(typeof self !== 'undefined' ? self : this, function (require) {
  const E = require ? require('../../engine/htj-entity.js') : self.HTJEntity;
  const T = require ? require('../../engine/htj-terrain.js') : self.HTJTerrain;

  const SMOOTH = 24;            // 퇴적 delta 확산 이완 반복(매끄러움 세기·0=0066 울퉁)

  // 카펫 앵커 + 정착 자유 구체를 terrainSurface(smooth) 로 환원 — 0066 과 동일하되 *매끄러운 퇴적*.
  function rebuildSurface(w) {
    const es = w.__entities, topZ = w.__topZ, sp = (e) => Math.hypot(e.px, e.py, e.pz) / e.mass;
    const deposits = [], flying = [];
    for (const e of es) {
      if (e.anchored) continue;
      if (sp(e) < 0.5 && (e.cz - topZ) < w.N * 0.12) deposits.push({ cx: e.cx, cy: e.cy, cz: e.cz, radius: e.radius });
      else flying.push({ cx: e.cx, cy: e.cy, cz: e.cz, radius: e.radius, peak: 0.7 });
    }
    w.__surface = T.terrainSurface(w.__carpet, { up: w.__up, deposits, smooth: SMOOTH });   // ← 새 노브: 매끄러운 퇴적
    let hMax = -Infinity; for (const h of w.__surface.heights) if (h > hMax) hMax = h; w.__hMax = hMax;
    w.__flying = flying;
    w.__depositCount = w.__surface.depositCount;
  }

  return {
    label: 'step_0067 — 매끄러운 퇴적(정착물이 매끄러운 둔덕으로 쌓임)',
    title: 'HTJ — 매끄러운 퇴적: 퇴적 delta 를 확산 이완해 울퉁한 구 봉우리를 매끄러운 둔덕으로',
    sub: 'step_0066 의 울퉁한 퇴적 표면(구 상단 max)을 terrainSurface(smooth)로 이완 — base 지형 불변·Σ퇴적부피 보존·일방 퇴적. (design/scene-unify.md 시나리오 1벌 — viewer 라이브·헤드리스 캡처 공용)',
    mode: 'energy', dynamics: true, render: 'terrain',
    defaults: { colorScale: 'relative', view: 'energy' },

    init(w) {
      const N = w.N, cen = (N - 1) / 2;
      const Rf = N * 1.4, AR = N * 0.05, sr = N * 0.022, SPC = N * 0.06, Wt = N * 0.34;
      const bowl = (x, y) => N * 0.0010 * (x * x + y * y) - N * 0.10;
      const topZ = cen + N * 0.12;
      const mk = (cx, cy, cz, mass, r, anc) => ({ cx, cy, cz, mass, px: 0, py: 0, pz: 0, Lx: 0, Ly: 0, Lz: 0,
        KEcm: 0, internalKE: 0, internalE: 0, energy: 0, cells: (4 * Math.PI / 3) * r * r * r, radius: r, temp: 0, peak: 0.5, anchored: !!anc });
      const ents = [mk(cen, cen, topZ - Rf, 1e9, Rf, true)];
      const carpet = [];
      for (let gx = -Wt; gx <= Wt; gx += SPC) for (let gy = -Wt; gy <= Wt; gy += SPC) { const e = mk(cen + gx, cen + gy, topZ + bowl(gx, gy), 1, AR, true); ents.push(e); carpet.push({ cx: e.cx, cy: e.cy, cz: e.cz }); }
      const gold = Math.PI * (3 - Math.sqrt(5));
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

    // ── 헤드리스 캡처(범용 러너가 읽음) ──
    makeWorld() { return { N: 40 }; },
    frames: [1, 400, 1200, 3000],
    captureOpts: { N: 64 },
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

    note: '<b>매끄러운 퇴적 — 정착물이 *울퉁한 구 봉우리*가 아니라 *이어진 매끄러운 둔덕*으로 쌓인다.</b> step_0066("지형이 자란다")은 정착 자유 구체를 표면에 max-splat 해 계곡을 차오르게 했지만, 표면이 *구 하나하나의 둥근 상단*이라 톱니처럼 울퉁했다(정직한 한계). 이 step 은 <code>terrainSurface(smooth)</code>로 그 <b>퇴적 delta(쌓인 물질)를 확산 이완</b>한다: 인접 정점끼리 높이를 조금씩 나눠(쌍대칭 확산) 봉우리를 둔덕으로 편다. <b>base 지형은 불변</b>(평활은 delta 에만)·<b>Σ퇴적 부피 보존</b>(확산은 옮길 뿐 더하거나 빼지 않음)·<b>일방 퇴적</b>(λ≤¼ convex 결합 → 음수 delta 없음 = 깎임 아님). 흐름(capture 4 패널): 맨 사발 → 구체 정착 → 표면이 차오르되 <b>매끄럽게</b>. <b>세계↔확인용 단방향</b>: 정착은 기존 entity 물리(engine·보존)·표면은 그 결과를 *읽어* 이완(terrainSurface 가법·smooth=0 → 0066 표면 byte 동일·회귀0)→engine 물리 <b>불변</b>(렌더 트랙). 정직한 한계: 평활은 등방 확산(이방·경사 보존 평활 아님)·여전히 단일 패치(광활=TW4)·침식(역퇴적·물↔지형 왕복)은 후속. 다음: 침식 또는 T2 지형 DNA 배선(K≪N).'
  };
});
