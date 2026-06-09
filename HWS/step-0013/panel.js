/* step-0013 패널 — 별 연소 FSM(living→burning→ash: 이산 비가역 문턱, SPINE 결정3 완전판).
 * step-0012 패널을 잇되 새 노브 행 1개(연소 FSM kFSM·livingFrac·burnOn·burnOff)를 더했다. 시뮬 로직은 engine/hws-laws.js 의 combust 법칙.
 * 표준 시나리오: 외부 source off(별 내생 구동) + 자기제한 on + 연소 FSM on(kFSM 1, livingFrac 0.55, burnOn 0.6, burnOff 0.4). 브라우저: window.HWS_PANEL_0013 */
(function (global) {
  'use strict';
  function fmtMin(sim) { var mn = Infinity, E = sim.E; for (var i = 0; i < E.length; i++) if (E[i] < mn) mn = E[i]; return mn; }
  function stateCounts(sim) { var c = [0, 0, 0], st = sim.stars || []; for (var i = 0; i < st.length; i++) { var s = st[i].state; c[s === undefined ? 1 : s]++; } return c; }

  var panel = {
    coreGlobal: 'HWS_SIM',
    title: 'HWS step-0013 — 별 연소 <span style="color:#ff9a3c">FSM</span>: living→burning→ash, 문턱에서 딱 뒤집힌다',
    subtitle: '별의 alive→dead proto-FSM(점화→소진) <b>가운데 burning 을 끼워</b> 이산 3-상태 FSM 을 완성한다(SPINE 결정3): <b>living</b>(갓 점화 kindling, 저활성·정지) →[핫코어 ≥ burnOn]→ <b>burning</b>(전율·서행) →[연료 소진 또는 핫코어 &lt; burnOff]→ <b>ash</b>(주입 0·불응기·제거). 전이는 <b>문턱에서 딱 뒤집힘</b>(연속 변조 아님)이고 <b>비가역</b>. 활성도(주입 throughput)는 그 위 연속 측정 — 라벨은 편의지 진실의 출처가 아니다. 히스테리시스(burnOn&gt;burnOff)로 안 떨리고(anti-chatter), timescale 분리(빠른 점화·느린 소진)로 이산성이 창발(흥분성 매질/이완 진동). <code>node step-0013/verify.js</code> 로 회귀·장부·결정론·fsm(a/b/c)·sustain 검증.',
    overlays: { sourceSink: false, pools: true, life: true, centroid: true, sparkline: true },
    poolOpts: { minE: 1.5, prom: 0.3 },

    controls: [
      { items: [
        { kind: 'check', id: 'drive', label: '외부 source', param: 'drive', def: false, title: '고정 외부 source(step-0007). 기본 off — 별이 내생 구동.' },
        { kind: 'check', id: 'auto', label: '자동 명암', def: true, view: true, title: '화면 밝기를 현재 최대 E 에 맞춰 정규화' }
      ]},
      { items: [
        { kind: 'check', id: 'fsmc', label: '연소 FSM(별)', def: true, gateFor: 'kFSM', title: '별을 living→burning→ash 이산 FSM 으로. 0 = step-0012(점화→full rate→소진, 중간 burning 없음).' },
        { kind: 'slider', id: 'kFSM', label: 'kFSM', param: 'kFSM', min: 0, max: 1, step: 1, def: 1, fixed: 0, gateBy: 'fsmc', gateOff: 0 },
        { kind: 'slider', id: 'livingFrac', label: 'living 배수', param: 'livingFrac', min: 0.1, max: 1, step: 0.05, def: 0.55, fixed: 2, title: 'living(kindling) 주입율 배수. burning=1, ash=0. 낮을수록 kindling 이 약하다.' },
        { kind: 'slider', id: 'burnOn', label: '점화 burnOn', param: 'burnOn', min: 0.3, max: 1.5, step: 0.05, def: 0.6, fixed: 2, title: '핫코어(disc 평균 E)가 이 값 이상이면 living→burning SNAP(히스테리시스 상문턱·빠른 변수).' },
        { kind: 'slider', id: 'burnOff', label: '소진 burnOff', param: 'burnOff', min: 0.1, max: 1.2, step: 0.05, def: 0.4, fixed: 2, title: '핫코어가 이 값 미만으로 식으면 burning→ash 조기 quench(히스테리시스 하문턱<상). 보통은 연료 소진이 끈다.' }
      ]},
      { items: [
        { kind: 'check', id: 'crowdc', label: '자기제한(밀도)', def: true, gateFor: 'kCrowd', title: '국소 밀도가 높으면 추가 대사세 → carrying capacity(step-0012).' },
        { kind: 'slider', id: 'kCrowd', label: 'kCrowd', param: 'kCrowd', min: 0, max: 0.6, step: 0.02, def: 0.20, fixed: 2, gateBy: 'crowdc', gateOff: 0 },
        { kind: 'slider', id: 'crowdR', label: '밀도 반경', param: 'crowdR', min: 1, max: 5, step: 1, def: 3, fixed: 0, title: '밀도 측정 반경(=starR 채식지 척도).' }
      ]},
      { items: [
        { kind: 'check', id: 'ignite', label: '구동 내생화(별)', def: true, gateFor: 'kIgnite', title: 'R 누적 핵에서 별 점화·서행(step-0011). 0 = 별 없음.' },
        { kind: 'slider', id: 'kIgnite', label: 'kIgnite', param: 'kIgnite', min: 0, max: 1, step: 1, def: 1, fixed: 0, gateBy: 'ignite', gateOff: 0 },
        { kind: 'slider', id: 'starRate', label: '별 주입 rate', param: 'starRate', min: 0.02, max: 0.15, step: 0.01, def: 0.06, fixed: 2, title: 'burning 셀당/tick 주입(living=×livingFrac). injected 로 추적.' },
        { kind: 'slider', id: 'drift', label: '서행 주기', param: 'starDriftPeriod', min: 4, max: 60, step: 2, def: 20, fixed: 0, title: 'burning 만 떠돈다(이 tick 마다 한 칸). living(kindling)은 정지.' }
      ]},
      { items: [
        { kind: 'slider', id: 'starFuel0', label: '연료 fuel0', param: 'starFuel0', min: 100, max: 1500, step: 50, def: 500, fixed: 0, title: '별 연료(외부 질량). 소진하면 ash.' },
        { kind: 'slider', id: 'ignThresh', label: '점화 문턱(R)', param: 'ignThresh', min: 0.5, max: 4, step: 0.1, def: 1.5, fixed: 1, title: '셀 R 이 이 값을 넘으면 별 *siting*(강고임 핵). burnOn 과 다른 층 — siting vs flashover.' },
        { kind: 'slider', id: 'starCap', label: '별 상한', param: 'starCap', min: 1, max: 16, step: 1, def: 10, fixed: 0 },
        { kind: 'slider', id: 'starR', label: '방출 반경', param: 'starR', min: 1, max: 5, step: 1, def: 3, fixed: 0 }
      ]},
      { items: [
        { kind: 'check', id: 'life', label: '생명', param: 'life', def: true },
        { kind: 'slider', id: 'kL', label: '흡수 kL', param: 'kL', min: 0.01, max: 0.2, step: 0.005, def: 0.05, fixed: 3 },
        { kind: 'slider', id: 'baseCost', label: 'baseCost', param: 'baseCost', min: 0, max: 0.2, step: 0.005, def: 0.05, fixed: 3 },
        { kind: 'check', id: 'tumble', label: '탐사(탈출)', def: true, gateFor: 'pTumble', title: '갇힌 굶주린 생명이 의사난수 한 칸(step-0010).' },
        { kind: 'slider', id: 'pTumble', label: 'pTumble', param: 'pTumble', min: 0, max: 1, step: 0.05, def: 1.0, fixed: 2, gateBy: 'tumble', gateOff: 0 }
      ]},
      { items: [
        { kind: 'check', id: 'move', label: '이동', param: 'move', def: true },
        { kind: 'check', id: 'repro', label: '번식', param: 'repro', def: true },
        { kind: 'check', id: 'agg', label: '응집', def: true, gateFor: 'kA' },
        { kind: 'slider', id: 'kA', label: 'kA', param: 'kA', min: 0, max: 0.6, step: 0.01, def: 0.45, fixed: 2, gateBy: 'agg', gateOff: 0 }
      ]},
      { items: [
        { kind: 'check', id: 'stage', label: '무대(기복)', def: true, gateFor: 'kRelief', title: '퇴적 R 이 흐름을 휜다(step-0009).' },
        { kind: 'slider', id: 'kRelief', label: 'kRelief', param: 'kRelief', min: 0, max: 3, step: 0.1, def: 1.0, fixed: 1, gateBy: 'stage', gateOff: 0 },
        { kind: 'check', id: 'cryst', label: '결정화(R)', def: true, gateFor: 'kCryst', title: '별이 주입한 E 가 굳어 R 로 — 다음 별 siting 연료.' },
        { kind: 'slider', id: 'kCryst', label: 'kCryst', param: 'kCryst', min: 0, max: 0.05, step: 0.005, def: 0.01, fixed: 3, gateBy: 'cryst', gateOff: 0 },
        { kind: 'slider', id: 'crystThresh', label: '문턱 cTh', param: 'crystThresh', min: 1, max: 5, step: 0.1, def: 2.0, fixed: 1 }
      ]},
      { items: [
        { kind: 'select', id: 'click', label: '클릭 동작', role: 'click', options: [['star', '별 점화'], ['life', '생명 놓기'], ['rock', '둑 쌓기(R)'], ['harvest', '수확']], def: 'star' },
        { kind: 'button', id: 'seedStar', label: '별 씨앗 ×6', action: 'seedStars' },
        { kind: 'button', id: 'seedLife', label: '강한 고임에 생명 ×5', action: 'seedLife' },
        { kind: 'button', id: 'kill', label: '생명 전멸', action: 'kill' }
      ]}
    ],

    /* 오버레이 — 저장체 R(호박색) + 별(상태별 색: living=어둑한 주황 kindling, burning=밝은 백황 blaze, ash=잿빛 ember). */
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
        var stt = st[s], sx = (stt.x + 0.5) * SCALE, sy = (stt.y + 0.5) * SCALE, rad = (sim.p.starR + 0.5) * SCALE;
        var br = Math.min(1, stt.fuel / f0), state = stt.state === undefined ? 1 : stt.state;
        var c0, c1, c2, core;
        if (state === 0) {        // living(kindling) — 어둑한 주황(낮은 활성)
          c0 = 'rgba(255,150,60,' + (0.30 + 0.25 * br).toFixed(2) + ')'; c1 = 'rgba(220,110,40,' + (0.18 * br).toFixed(2) + ')'; c2 = 'rgba(180,80,30,0)'; core = 'rgba(255,190,120,0.9)';
        } else if (state === 1) { // burning — 밝은 백황(전율)
          c0 = 'rgba(255,250,220,' + (0.55 + 0.4 * br).toFixed(2) + ')'; c1 = 'rgba(255,210,110,' + (0.30 * br).toFixed(2) + ')'; c2 = 'rgba(255,180,60,0)'; core = 'rgba(255,255,245,0.95)';
        } else {                  // ash(ember) — 잿빛(주입 0)
          c0 = 'rgba(150,150,160,0.35)'; c1 = 'rgba(110,110,120,0.18)'; c2 = 'rgba(90,90,100,0)'; core = 'rgba(180,180,190,0.85)';
        }
        var g = ctx.createRadialGradient(sx, sy, 0, sx, sy, rad);
        g.addColorStop(0, c0); g.addColorStop(0.5, c1); g.addColorStop(1, c2);
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(sx, sy, rad, 0, 6.2832); ctx.fill();
        ctx.fillStyle = core; ctx.beginPath(); ctx.arc(sx, sy, 2.2, 0, 6.2832); ctx.fill();
      }
    },

    stats: [
      { label: 'tick', get: function (c) { return String(c.sim.tick); } },
      { label: 'sumE', get: function (c) { return c.m.sumE.toFixed(2); } },
      { label: 'maxE / minE', get: function (c) { return c.m.maxE.toFixed(3) + ' / ' + fmtMin(c.sim).toFixed(3); } },
      { label: '별 <span style="color:#ff9a3c">living</span>/<span style="color:#fff7d2">burning</span>/<span style="color:#aab">ash</span>', get: function (c) { var k = stateCounts(c.sim); return k[0] + ' / ' + k[1] + ' / ' + k[2]; } },
      { label: '누적 점화 / 소진', get: function (c) { return c.sim.starBirths + ' / ' + c.sim.starDeaths; } },
      { label: '누적 주입(별 연소) = injected', get: function (c) { return c.sim.burned.toFixed(0) + ' / ' + c.sim.injected.toFixed(0); } },
      { label: '<span style="color:#c89b6a">저장체 R</span> (총량 / 굳은 셀)', get: function (c) { var r = c.core.measureStore(c.sim, 0.01); return r.total.toFixed(1) + ' / ' + r.cells; } },
      { label: '<span class="pool">고임</span> / <span class="life">개체수</span> / M', get: function (c) { return c.pools.length + ' / ' + c.sim.agents.length + ' / ' + c.led.biomass.toFixed(2); } },
      { label: '누적 출생 / 사망', get: function (c) { return c.sim.births + ' / ' + c.sim.deaths; } },
      { label: '장부 잔차', get: function (c) { var r = c.led.residual; return { text: r.toExponential(3) + (r < 1e-6 ? ' PASS' : ' FAIL'), cls: r < 1e-6 ? 'pass' : 'fail' }; } }
    ],

    legend:
      '<span style="color:#ff9a3c">★</span> living(kindling·저활성·정지) &nbsp; <span style="color:#fff7d2">★</span> burning(전율·서행) &nbsp; <span style="color:#aab">★</span> ash(ember·주입0·불응기) &nbsp; <span style="color:#c89b6a">■</span> 저장체 R &nbsp; <span class="life">●</span> 생명<br>' +
      '<b>이산 FSM</b>: 별 씨앗 ×6 + 생명 ×5 를 놓고 보라. 갓 점화한 별은 <b>어둑한 주황(living)</b> 으로 제자리에서 달궈지다가 핫코어가 burnOn 을 넘으면 <b>밝은 백황(burning)</b> 으로 *딱* 뒤집혀 서행하고, 연료가 다하거나 심하게 잠식되면 <b>잿빛(ash)</b> 으로 꺼져 잠시 머물다 사라진다. 색이 *연속 변조*가 아니라 *계단*으로 바뀜에 주목.<br>' +
      '<b>히스테리시스</b>: 점화(burnOn)와 소진(burnOff) 문턱을 벌리면(폭&gt;0) 경계에서 안 떨린다(anti-chatter). burnOn 을 낮추면 더 쉽게 burning 으로, burnOff 를 높이면 더 자주 조기 ash. <b>kFSM 끄면</b> step-0012(중간 burning 없이 점화→full rate→소진)로 돌아간다. 잔차 &lt;1e-6 이면 <span class="pass">PASS</span>.',

    actions: {
      seedStars: function (api) { for (var i = 0; i < 6; i++) api.core.spawnStar(api.sim, (i * 53) % api.sim.p.W, (i * 29) % api.sim.p.H); api.toast('별 ×6 점화(living kindling 으로 시작)'); },
      seedLife: function (api) {
        var pools = api.core.detectPools(api.sim, { minE: 1.5, prom: 0.3 }), n = Math.min(5, pools.length);
        for (var i = 0; i < n; i++) api.core.spawnAgent(api.sim, pools[i].x, pools[i].y);
        api.toast(n ? ('강한 고임 ' + n + '곳에 생명') : '놓을 고임이 없다 — 별을 켜 풍경을 달구세요');
      },
      kill: function (api) { var ag = api.sim.agents; for (var i = 0; i < ag.length; i++) { api.sim.E[ag[i].center] += ag[i].m; api.sim.deaths++; } api.sim.agents = []; api.toast('생명 전멸(장부 유지)'); }
    },

    clickModes: {
      star: function (api, cx, cy) { var s = api.core.spawnStar(api.sim, cx, cy); api.toast('별 점화 (' + cx + ',' + cy + ') 연료 ' + s.fuel.toFixed(0) + ' — living 으로 시작'); },
      life: function (api, cx, cy) { var a = api.core.spawnAgent(api.sim, cx, cy); api.toast('생명 출생 (' + cx + ',' + cy + ') m ' + a.m.toFixed(2)); },
      harvest: function (api, cx, cy) { var rm = api.core.harvest(api.sim, cx, cy, 3); api.toast('수확 −' + rm.toFixed(1) + ' E → sunk'); },
      rock: function (api, cx, cy) { var added = api.core.paintStore(api.sim, cx, cy, 2, 5); api.toast('둑 쌓기 +' + added.toFixed(0) + ' R (별 siting 연료가 된다)'); }
    }
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = panel;
  else global.HWS_PANEL_0013 = panel;
})(typeof window !== 'undefined' ? window : globalThis);
