/* step-0008 패널 — 결정화·풍화(저장체=평형 개체 + 첫 비가역 문턱).
 * step-0007 패널을 복사해 새 노브 행 1개(결정화)와 새 통계 행 1개(저장체 R)와 저장체 오버레이(drawHook)를 더했다.
 * 시뮬 동작은 step-0008/sim-core.js(window.HWS8)에서 온다. 브라우저: window.HWS_PANEL_0008 / Node: module.exports */
(function (global) {
  'use strict';
  function fmtMin(sim) { var mn = Infinity, E = sim.E; for (var i = 0; i < E.length; i++) if (E[i] < mn) mn = E[i]; return mn; }

  var panel = {
    coreGlobal: 'HWS8',
    title: 'HWS step-0008 — 흐름량이 굳으면 <span style="color:#c89b6a">저장체</span>가 된다: 첫 평형 개체 + 비가역 문턱',
    subtitle: 'E 가 문턱(crystThresh)을 넘으면 일부가 *굳어* 저장체 R 이 된다(E→R). R 은 확산·증발하지 않아 <b>흐름이 끊겨도 존재</b>한다(저장체=평형 개체). 결정화는 빠르고 문턱 위에서만, 풍화(R→E)는 느리고 무조건 — 이 비대칭이 래칫을 만든다(개체는 비가역, 세계는 느린 순환). <code>node step-0008/verify.js</code> 로 회귀·장부·결정론·저장·문턱 검증. (척추 SPINE.md 첫 적용 — 소산 일색이던 세계에 평형 극단을 더한다.)',
    overlays: { sourceSink: true, pools: true, life: true, centroid: true, sparkline: true },
    poolOpts: { minE: 1.5, prom: 0.3 },

    controls: [
      { items: [
        { kind: 'check', id: 'drive', label: '구동', param: 'drive', def: true },
        { kind: 'check', id: 'auto', label: '자동 명암', def: true, view: true, title: '드러난 흐름을 보이게 — 화면 밝기를 현재 최대 E 에 맞춰 정규화' }
      ]},
      { items: [
        { kind: 'check', id: 'agg', label: '응집(고임)', def: true, gateFor: 'kA' },
        { kind: 'slider', id: 'kA', label: 'kA', param: 'kA', min: 0, max: 0.6, step: 0.01, def: 0.45, fixed: 2, gateBy: 'agg', gateOff: 0 }
      ]},
      { items: [
        { kind: 'check', id: 'life', label: '생명', param: 'life', def: true },
        { kind: 'slider', id: 'kL', label: '흡수 kL', param: 'kL', min: 0.01, max: 0.2, step: 0.005, def: 0.05, fixed: 3 }
      ]},
      { items: [
        { kind: 'check', id: 'repro', label: '번식', param: 'repro', def: true },
        { kind: 'slider', id: 'mDiv', label: '분열 mDiv', param: 'mDiv', min: 0.6, max: 3, step: 0.1, def: 1.2, fixed: 1 }
      ]},
      { items: [
        { kind: 'check', id: 'move', label: '이동(주화성)', param: 'move', def: true },
        { kind: 'slider', id: 'mThr', label: '임계 mThr', param: 'moveThresh', min: 0, max: 0.2, step: 0.005, def: 0.02, fixed: 3 }
      ]},
      { items: [
        { kind: 'check', id: 'base', label: '기초대사비', def: true, gateFor: 'baseCost', title: '생물량과 무관한 절대 생존 비용.' },
        { kind: 'slider', id: 'baseCost', label: 'baseCost', param: 'baseCost', min: 0, max: 0.2, step: 0.005, def: 0.08, fixed: 3, gateBy: 'base', gateOff: 0 }
      ]},
      { items: [
        { kind: 'check', id: 'wander', label: '떠도는 자원', def: true, gateFor: 'srcJump', title: 'source 가 주기적으로 +x 로 재배치. 0 = 정적(step-0006). 결정화는 정적 강한 고임에서 더 잘 보인다(끄고 관찰 권장).' },
        { kind: 'slider', id: 'srcJump', label: '점프 srcJump', param: 'srcJump', min: 0, max: 12, step: 1, def: 6, fixed: 0, gateBy: 'wander', gateOff: 0 },
        { kind: 'slider', id: 'srcPeriod', label: '주기', param: 'srcPeriod', min: 30, max: 400, step: 10, def: 150, fixed: 0 }
      ]},
      { items: [
        { kind: 'check', id: 'cryst', label: '결정화(저장)', def: true, gateFor: 'kCryst', title: 'E>crystThresh 인 셀의 초과분이 굳어 저장체 R 로(E→R). 0 = step-0007(저장체 없음). R 은 확산·증발 안 함 — 흐름 끊겨도 남는다. 풍화로 천천히 E 로 되돌아온다.' },
        { kind: 'slider', id: 'kCryst', label: '결정화 kCryst', param: 'kCryst', min: 0, max: 0.05, step: 0.005, def: 0.01, fixed: 3, gateBy: 'cryst', gateOff: 0, title: '결정화율(빠름).' },
        { kind: 'slider', id: 'crystThresh', label: '문턱 cTh', param: 'crystThresh', min: 1, max: 5, step: 0.1, def: 3.0, fixed: 1, title: '결정화 문턱 — E 가 이 값을 넘는 셀만 굳는다(질적 경계). 들판 최대(≈4) 위로 올리면 아무것도 안 굳는다.' },
        { kind: 'slider', id: 'kWeather', label: '풍화 kW', param: 'kWeather', min: 0, max: 0.002, step: 0.0001, def: 0.0003, fixed: 4, title: '풍화율(느림). R→E 로 되돌리는 세계척도 순환의 back-path. 0 이면 저장체 영구 고정.' }
      ]},
      { items: [
        { kind: 'select', id: 'click', label: '클릭 동작', role: 'click', options: [['life', '생명 놓기'], ['harvest', '수확']], def: 'life' },
        { kind: 'button', id: 'seed1', label: '강한 고임에 씨앗 ×1', action: 'seedPools1' },
        { kind: 'button', id: 'seedLife', label: '×3', action: 'seedPools3' },
        { kind: 'button', id: 'kill', label: '전멸', action: 'kill' }
      ]}
    ],

    /* 저장체 오버레이 — R>eps 인 셀을 호박색 사각으로(밝기 ∝ R). 흐르는 E(배경) 위에 굳은 저장체를 겹쳐 보인다. */
    drawHook: function (ctx, c) {
      var R = c.sim.R, W = c.sim.p.W, H = c.sim.p.H, SCALE = c.SCALE;
      for (var y = 0; y < H; y++) {
        for (var x = 0; x < W; x++) {
          var r = R[y * W + x];
          if (r > 0.05) {
            var a = r / 20; if (a > 0.85) a = 0.85;
            ctx.fillStyle = 'rgba(200,155,106,' + a.toFixed(3) + ')';
            ctx.fillRect(x * SCALE, y * SCALE, SCALE, SCALE);
          }
        }
      }
    },

    stats: [
      { label: 'tick', get: function (c) { return String(c.sim.tick); } },
      { label: 'sumE', get: function (c) { return c.m.sumE.toFixed(2); } },
      { label: 'maxE / minE', get: function (c) { return c.m.maxE.toFixed(3) + ' / ' + fmtMin(c.sim).toFixed(3); } },
      { label: '<span style="color:#c89b6a">저장체 R</span> (총량 / 굳은 셀)', get: function (c) { var r = c.core.measureStore(c.sim, 0.01); return r.total.toFixed(1) + ' / ' + r.cells; } },
      { label: '<span class="src">source x</span>', get: function (c) { return c.sim.p.source.x + ' (y' + c.sim.p.source.y + ')'; } },
      { label: '<span class="pool">고임 수</span> / <span class="life">개체수</span> / M', get: function (c) { return c.pools.length + ' / ' + c.sim.agents.length + ' / ' + c.led.biomass.toFixed(2); } },
      { label: '누적 결정화 / 풍화', get: function (c) { return c.sim.crystallized.toFixed(0) + ' / ' + c.sim.weathered.toFixed(0); } },
      { label: '누적 출생 / 사망 / 이동', get: function (c) { return c.sim.births + ' / ' + c.sim.deaths + ' / ' + c.sim.moves; } },
      { label: '장부 잔차', get: function (c) { var r = c.led.residual; return { text: r.toExponential(3) + (r < 1e-6 ? ' PASS' : ' FAIL'), cls: r < 1e-6 ? 'pass' : 'fail' }; } },
      { label: 'sumE / M / R (장부)', get: function (c) { return c.led.sumE.toFixed(1) + ' / ' + c.led.biomass.toFixed(1) + ' / ' + c.led.store.toFixed(1); } }
    ],

    legend:
      '<span class="src">●</span> source &nbsp; <span class="snk">●</span> sink &nbsp; <span class="pool">○</span> 고임 &nbsp; <span class="life">●</span> 생명 &nbsp; <span style="color:#c89b6a">■</span> 저장체 &nbsp; <span style="color:#ff5fd0">✛</span> 무게중심<br>' +
      '<b>저장체</b>: E 가 문턱(cTh)을 넘은 강한 고임 핵이 굳어 저장체 R 이 된다. <b>구동을 끄면</b> 흐르는 고임은 빠르게 사라져도 저장체는 <b>남는다</b>(평형 vs 소산). 풍화로 천천히 E 로 되돌아온다(세계척도 순환).<br>' +
      '<b>회귀</b>: 결정화 끄면(kCryst=0) step-0007 과 비트 동일. <b>문턱</b>: cTh 를 들판 최대(≈4) 위로 올리면 아무것도 안 굳는다. 잔차 &lt;1e-6 이면 <span class="pass">PASS</span>. (떠도는 자원 끄고 관찰하면 저장체가 또렷.)',

    actions: {
      seedPools1: function (api) {
        var pools = api.core.detectPools(api.sim, { minE: 1.5, prom: 0.3 });
        if (pools.length) { api.core.spawnAgent(api.sim, pools[0].x, pools[0].y); api.toast('강한 고임에 씨앗 1'); }
        else api.toast('놓을 고임이 없다 — 먼저 고임을 키우세요');
      },
      seedPools3: function (api) {
        var pools = api.core.detectPools(api.sim, { minE: 1.5, prom: 0.3 });
        var n = Math.min(3, pools.length);
        for (var i = 0; i < n; i++) api.core.spawnAgent(api.sim, pools[i].x, pools[i].y);
        api.toast(n ? ('강한 고임 ' + n + '곳에 씨앗 출생') : '놓을 고임이 없다 — 먼저 고임을 키우세요');
      },
      kill: function (api) {
        var ag = api.sim.agents;
        for (var i = 0; i < ag.length; i++) { api.sim.E[ag[i].center] += ag[i].m; api.sim.deaths++; }
        api.sim.agents = [];
        api.toast('전멸 — 생물량을 터로 분해(장부 유지)');
      }
    },

    clickModes: {
      life: function (api, cx, cy) {
        var a = api.core.spawnAgent(api.sim, cx, cy);
        api.toast('생명 출생 (' + cx + ',' + cy + ') 생물량 ' + a.m.toFixed(2) + (a.m < api.sim.p.mDeath ? ' — 자원 부족, 곧 굶어 죽는다' : ''));
      },
      harvest: function (api, cx, cy) {
        var removed = api.core.harvest(api.sim, cx, cy, 3);
        api.toast('수확 (' + cx + ',' + cy + ') −' + removed.toFixed(1) + ' E → 장부 sunk');
      }
    }
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = panel;
  else global.HWS_PANEL_0008 = panel;
})(typeof window !== 'undefined' ? window : globalThis);
