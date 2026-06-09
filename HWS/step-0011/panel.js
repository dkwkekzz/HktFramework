/* step-0011 패널 — 구동 내생화(별: R 누적 핵에서 점화하는 내생 주입원, 연료 소진까지 서행).
 * step-0010 패널을 잇되 코어를 공유 엔진(window.HWS_SIM = engine/hws-{kernel,laws,sim}.js)으로 갈아끼우고,
 * 새 노브 행 1개(별/구동 내생화)·통계·오버레이·씨앗 버튼을 더했다. 시뮬 로직은 engine/hws-laws.js 의 ignite 법칙.
 * 표준 시나리오: 외부 source off(별이 유일 구동). 브라우저: window.HWS_PANEL_0011 / Node: module.exports */
(function (global) {
  'use strict';
  function fmtMin(sim) { var mn = Infinity, E = sim.E; for (var i = 0; i < E.length; i++) if (E[i] < mn) mn = E[i]; return mn; }

  var panel = {
    coreGlobal: 'HWS_SIM',
    title: 'HWS step-0011 — 구동 <span style="color:#ffd86b">내생화</span>(별): 봉우리가 떠돌고 명멸한다',
    subtitle: '외부 고정 source 를 끄고, <b>별</b>(R 누적 핵에서 점화하는 <b>내생 주입원</b>)이 구동한다 — 연료(외부 질량)를 E 로 주입하며 <b>서행</b>(채식지)하고 소진하면 꺼진다(소산 극단). 영구 전역 봉우리가 사라져 개체군이 수렴할 곳을 잃는다 → step-0010 후반 동결이 풀린다(churn 폭발·무게중심 떠돎). <code>node step-0011/verify.js</code> 로 회귀·장부·결정론·churn(가설)·collapse(한계) 검증. <b>정직</b>: churn 은 *끝없지 않다* — 생명이 이동 채식지에서 과증식→공멸(overshoot-collapse). 방향성 추적이 다음 조각.',
    overlays: { sourceSink: false, pools: true, life: true, centroid: true, sparkline: true },
    poolOpts: { minE: 1.5, prom: 0.3 },

    controls: [
      { items: [
        { kind: 'check', id: 'drive', label: '외부 source', param: 'drive', def: false, title: '고정 외부 source(step-0007). 이 step 의 핵심은 *끈 채* 별이 내생 구동하는 것 — 기본 off.' },
        { kind: 'check', id: 'auto', label: '자동 명암', def: true, view: true, title: '드러난 흐름을 보이게 — 화면 밝기를 현재 최대 E 에 맞춰 정규화' }
      ]},
      { items: [
        { kind: 'check', id: 'ignite', label: '구동 내생화(별)', def: true, gateFor: 'kIgnite', title: 'R 누적 핵에서 별이 점화해 연료를 E 로 주입하며 서행(소산 극단). 0 = step-0010(외부 source 만, 별 없음 — 켜면 외부 source 도 함께 켜라).' },
        { kind: 'slider', id: 'kIgnite', label: 'kIgnite', param: 'kIgnite', min: 0, max: 1, step: 1, def: 1, fixed: 0, gateBy: 'ignite', gateOff: 0 }
      ]},
      { items: [
        { kind: 'slider', id: 'starRate', label: '별 주입 rate', param: 'starRate', min: 0.02, max: 0.15, step: 0.01, def: 0.06, fixed: 2, title: '셀당/tick 당 방출 disc 주입(외부 source.rate 동급). injected 로 추적.' },
        { kind: 'slider', id: 'starFuel0', label: '연료 fuel0', param: 'starFuel0', min: 100, max: 1500, step: 50, def: 500, fixed: 0, title: '별 연료(외부 질량). 소진까지 ≈ fuel/(rate·disc) tick 산다(서행 수명).' },
        { kind: 'slider', id: 'drift', label: '서행 주기', param: 'starDriftPeriod', min: 4, max: 60, step: 2, def: 20, fixed: 0, title: '이 tick 마다 봉우리가 한 칸 이동(클수록 느림 — 생명이 따라올 수 있게).' }
      ]},
      { items: [
        { kind: 'slider', id: 'ignThresh', label: '점화 문턱', param: 'ignThresh', min: 0.5, max: 4, step: 0.1, def: 1.5, fixed: 1, title: '셀 R 이 이 값을 넘으면 점화(붕괴해 별이 서는 강고임 핵).' },
        { kind: 'slider', id: 'starCap', label: '별 상한', param: 'starCap', min: 1, max: 16, step: 1, def: 10, fixed: 0, title: '동시 별 수 상한 — 여럿이라 항상 가까이 채식지.' },
        { kind: 'slider', id: 'starR', label: '방출 반경', param: 'starR', min: 1, max: 5, step: 1, def: 3, fixed: 0, title: '별이 연료를 주입하는 disc 반경(넓을수록 생명이 채식하기 좋음).' }
      ]},
      { items: [
        { kind: 'check', id: 'life', label: '생명', param: 'life', def: true },
        { kind: 'slider', id: 'kL', label: '흡수 kL', param: 'kL', min: 0.01, max: 0.2, step: 0.005, def: 0.05, fixed: 3 },
        { kind: 'slider', id: 'baseCost', label: 'baseCost', param: 'baseCost', min: 0, max: 0.2, step: 0.005, def: 0.05, fixed: 3, title: '절대 생존 비용. 내생 풍요에 맞춘 문턱(step-0010 은 0.08).' }
      ]},
      { items: [
        { kind: 'check', id: 'tumble', label: '탐사(탈출)', def: true, gateFor: 'pTumble', title: '갇힌 굶주린 생명이 의사난수 한 칸(step-0010).' },
        { kind: 'slider', id: 'pTumble', label: 'pTumble', param: 'pTumble', min: 0, max: 1, step: 0.05, def: 1.0, fixed: 2, gateBy: 'tumble', gateOff: 0 },
        { kind: 'check', id: 'move', label: '이동', param: 'move', def: true },
        { kind: 'check', id: 'repro', label: '번식', param: 'repro', def: true }
      ]},
      { items: [
        { kind: 'check', id: 'agg', label: '응집', def: true, gateFor: 'kA' },
        { kind: 'slider', id: 'kA', label: 'kA', param: 'kA', min: 0, max: 0.6, step: 0.01, def: 0.45, fixed: 2, gateBy: 'agg', gateOff: 0 },
        { kind: 'check', id: 'stage', label: '무대(기복)', def: true, gateFor: 'kRelief', title: '퇴적 R 이 흐름을 휜다(step-0009).' },
        { kind: 'slider', id: 'kRelief', label: 'kRelief', param: 'kRelief', min: 0, max: 3, step: 0.1, def: 1.0, fixed: 1, gateBy: 'stage', gateOff: 0 }
      ]},
      { items: [
        { kind: 'check', id: 'cryst', label: '결정화(R)', def: true, gateFor: 'kCryst', title: '별이 주입한 E 가 굳어 R 로 — 다음 별의 점화 연료(R 누적 핵).' },
        { kind: 'slider', id: 'kCryst', label: 'kCryst', param: 'kCryst', min: 0, max: 0.05, step: 0.005, def: 0.01, fixed: 3, gateBy: 'cryst', gateOff: 0 },
        { kind: 'slider', id: 'crystThresh', label: '문턱 cTh', param: 'crystThresh', min: 1, max: 5, step: 0.1, def: 2.0, fixed: 1 },
        { kind: 'slider', id: 'kWeather', label: '풍화 kW', param: 'kWeather', min: 0, max: 0.002, step: 0.0001, def: 0.0003, fixed: 4 }
      ]},
      { items: [
        { kind: 'select', id: 'click', label: '클릭 동작', role: 'click', options: [['star', '별 점화'], ['life', '생명 놓기'], ['rock', '둑 쌓기(R)'], ['harvest', '수확']], def: 'star' },
        { kind: 'button', id: 'seedStar', label: '별 씨앗 ×6', action: 'seedStars' },
        { kind: 'button', id: 'seedLife', label: '강한 고임에 생명 ×5', action: 'seedLife' },
        { kind: 'button', id: 'kill', label: '생명 전멸', action: 'kill' }
      ]}
    ],

    /* 오버레이 — 저장체 R(호박색, step-0010) + 별(밝은 백황색 코어, 반경 ∝ 방출반경·밝기 ∝ 연료). */
    drawHook: function (ctx, c) {
      var sim = c.sim, R = sim.R, W = sim.p.W, H = sim.p.H, SCALE = c.SCALE, N = W * H, i;
      var mxR = 0; for (i = 0; i < N; i++) if (R[i] > mxR) mxR = R[i];
      var satR = mxR > 1.5 ? mxR : 1.5;
      for (var y = 0; y < H; y++) for (var x = 0; x < W; x++) {
        var r = R[y * W + x];
        if (r > 0.05) { var a = r / satR; if (a > 0.8) a = 0.8; ctx.fillStyle = 'rgba(200,155,106,' + a.toFixed(3) + ')'; ctx.fillRect(x * SCALE, y * SCALE, SCALE, SCALE); }
      }
      var st = sim.stars || [], f0 = sim.p.starFuel0 || 500;
      for (var s = 0; s < st.length; s++) {
        var sx = (st[s].x + 0.5) * SCALE, sy = (st[s].y + 0.5) * SCALE, rad = (sim.p.starR + 0.5) * SCALE;
        var br = Math.min(1, st[s].fuel / f0);
        var g = ctx.createRadialGradient(sx, sy, 0, sx, sy, rad);
        g.addColorStop(0, 'rgba(255,250,220,' + (0.55 + 0.4 * br).toFixed(2) + ')');
        g.addColorStop(0.5, 'rgba(255,210,110,' + (0.30 * br).toFixed(2) + ')');
        g.addColorStop(1, 'rgba(255,180,60,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(sx, sy, rad, 0, 6.2832); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,245,0.95)'; ctx.beginPath(); ctx.arc(sx, sy, 2.2, 0, 6.2832); ctx.fill();
      }
    },

    stats: [
      { label: 'tick', get: function (c) { return String(c.sim.tick); } },
      { label: 'sumE', get: function (c) { return c.m.sumE.toFixed(2); } },
      { label: 'maxE / minE', get: function (c) { return c.m.maxE.toFixed(3) + ' / ' + fmtMin(c.sim).toFixed(3); } },
      { label: '<span style="color:#ffd86b">별 수</span> / 누적 점화 / 소진', get: function (c) { return c.sim.stars.length + ' / ' + c.sim.starBirths + ' / ' + c.sim.starDeaths; } },
      { label: '누적 주입(별 연소) = injected', get: function (c) { return c.sim.burned.toFixed(0) + ' / ' + c.sim.injected.toFixed(0); } },
      { label: '<span style="color:#c89b6a">저장체 R</span> (총량 / 굳은 셀)', get: function (c) { var r = c.core.measureStore(c.sim, 0.01); return r.total.toFixed(1) + ' / ' + r.cells; } },
      { label: '<span class="pool">고임</span> / <span class="life">개체수</span> / M', get: function (c) { return c.pools.length + ' / ' + c.sim.agents.length + ' / ' + c.led.biomass.toFixed(2); } },
      { label: '누적 출생 / 사망 / 이동 / 탐사', get: function (c) { return c.sim.births + ' / ' + c.sim.deaths + ' / ' + c.sim.moves + ' / ' + c.sim.tumbles; } },
      { label: '장부 잔차', get: function (c) { var r = c.led.residual; return { text: r.toExponential(3) + (r < 1e-6 ? ' PASS' : ' FAIL'), cls: r < 1e-6 ? 'pass' : 'fail' }; } }
    ],

    legend:
      '<span style="color:#fff7d2">★</span> 별(내생 구동·서행) &nbsp; <span style="color:#c89b6a">■</span> 저장체 R(=연료·언덕) &nbsp; <span class="pool">○</span> 고임 &nbsp; <span class="life">●</span> 생명 &nbsp; <span style="color:#ff5fd0">✛</span> 무게중심<br>' +
      '<b>구동 내생화</b>: 외부 source 없이도 별이 R 누적 핵에서 점화해(별 씨앗 ×6 또는 잠시 두면 자생) 연료를 E 로 주입하며 <b>서행</b>한다. 생명을 심어 보라("생명 ×5") — 떠도는 별을 쫓아 <b>끝없이 churn</b>한다(step-0010 후반 동결 해소·무게중심 떠돎). 별을 끄면(kIgnite=0, 외부 source 켜고) step-0010.<br>' +
      '<b>정직한 한계</b>: 한참 두면 생명이 과증식해 E 를 과소비 → 별 연료(R) 형성을 억제 → 별·생명이 <b>공멸</b>한다(overshoot-collapse, ~1.3만 tick). 끝없는 churn 은 생명의 <b>방향성 드리프트 추적</b>이 더 필요하다(다음). 잔차 &lt;1e-6 이면 <span class="pass">PASS</span>.',

    actions: {
      seedStars: function (api) { for (var i = 0; i < 6; i++) api.core.spawnStar(api.sim, (i * 53) % api.sim.p.W, (i * 29) % api.sim.p.H); api.toast('별 ×6 점화(외부 질량 연료)'); },
      seedLife: function (api) {
        var pools = api.core.detectPools(api.sim, { minE: 1.5, prom: 0.3 }), n = Math.min(5, pools.length);
        for (var i = 0; i < n; i++) api.core.spawnAgent(api.sim, pools[i].x, pools[i].y);
        api.toast(n ? ('강한 고임 ' + n + '곳에 생명') : '놓을 고임이 없다 — 별을 켜 풍경을 달구세요');
      },
      kill: function (api) { var ag = api.sim.agents; for (var i = 0; i < ag.length; i++) { api.sim.E[ag[i].center] += ag[i].m; api.sim.deaths++; } api.sim.agents = []; api.toast('생명 전멸(장부 유지)'); }
    },

    clickModes: {
      star: function (api, cx, cy) { var s = api.core.spawnStar(api.sim, cx, cy); api.toast('별 점화 (' + cx + ',' + cy + ') 연료 ' + s.fuel.toFixed(0)); },
      life: function (api, cx, cy) { var a = api.core.spawnAgent(api.sim, cx, cy); api.toast('생명 출생 (' + cx + ',' + cy + ') m ' + a.m.toFixed(2)); },
      harvest: function (api, cx, cy) { var rm = api.core.harvest(api.sim, cx, cy, 3); api.toast('수확 −' + rm.toFixed(1) + ' E → sunk'); },
      rock: function (api, cx, cy) { var added = api.core.paintStore(api.sim, cx, cy, 2, 5); api.toast('둑 쌓기 +' + added.toFixed(0) + ' R (별 점화 연료가 된다)'); }
    }
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = panel;
  else global.HWS_PANEL_0011 = panel;
})(typeof window !== 'undefined' ? window : globalThis);
