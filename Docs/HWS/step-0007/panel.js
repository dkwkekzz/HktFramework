/* step-0007 패널 — 떠도는 자원(source 주기적 재배치)으로 정착 동결을 푸는 step.
 * step-0006 패널(engine/validate/step-0006.panel.js)을 복사해 새 노브 행 1개(떠도는 자원)와
 *   새 통계 행 1개(무게중심→source 추적거리)를 더했다. 시뮬 동작은 step-0007/sim-core.js(window.HWS7)에서 온다.
 * 브라우저: window.HWS_PANEL_0007 / Node: module.exports */
(function (global) {
  'use strict';
  function fmtMin(sim) { var mn = Infinity, E = sim.E; for (var i = 0; i < E.length; i++) if (E[i] < mn) mn = E[i]; return mn; }

  var panel = {
    coreGlobal: 'HWS7',
    title: 'HWS step-0007 — <span class="src">떠도는 자원</span>, <span class="life">생명</span>이 끝없이 추적하며 churn 한다',
    subtitle: 'source 가 주기적으로 +x 로 재배치(srcJump=6칸/srcPeriod=150tick)되어 고임이 세계를 떠돈다. 개체군은 추적해야 살고(이동 on), 못 따라가면 굶어 죽는다. 매 재배치가 비평형 transient(뒤처진 개체 아사 + 따라잡은 개체 분열)를 만들어 <b>정착 동결이 풀린다</b>. <code>node step-0007/verify.js</code> 로 회귀·장부·결정론·추적·churn·추격 검증.',
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
        { kind: 'check', id: 'base', label: '기초대사비', def: true, gateFor: 'baseCost', title: '생물량과 무관한 절대 생존 비용. 0 = step-0005(문턱 없음).' },
        { kind: 'slider', id: 'baseCost', label: 'baseCost', param: 'baseCost', min: 0, max: 0.2, step: 0.005, def: 0.08, fixed: 3, gateBy: 'base', gateOff: 0 }
      ]},
      { items: [
        { kind: 'check', id: 'wander', label: '떠도는 자원', def: true, gateFor: 'srcJump', title: 'source 가 srcPeriod tick 마다 srcJump 칸씩 +x 로 재배치된다(토러스). 0 = step-0006(정적 자원, 정착 동결). srcJump≈1 은 ≈연속 표류라 갈릴레이 동결을 못 풀고, ≈6 이라야 churn 이 지속된다.' },
        { kind: 'slider', id: 'srcJump', label: '점프 srcJump', param: 'srcJump', min: 0, max: 12, step: 1, def: 6, fixed: 0, gateBy: 'wander', gateOff: 0, title: '재배치 1회당 +x 이동 칸수. 1≈연속표류(동결), 6=churn, 10+=점프 과대로 멸종.' },
        { kind: 'slider', id: 'srcPeriod', label: '주기', param: 'srcPeriod', min: 30, max: 400, step: 10, def: 150, fixed: 0, title: '재배치 주기(tick). 짧을수록 자주 떠돈다.' }
      ]},
      { items: [
        { kind: 'select', id: 'click', label: '클릭 동작', role: 'click', options: [['life', '생명 놓기'], ['harvest', '수확']], def: 'life' },
        { kind: 'button', id: 'seed1', label: '강한 고임에 씨앗 ×1', action: 'seedPools1' },
        { kind: 'button', id: 'seedLife', label: '×3', action: 'seedPools3' },
        { kind: 'button', id: 'kill', label: '전멸', action: 'kill' }
      ]}
    ],

    stats: [
      { label: 'tick', get: function (c) { return String(c.sim.tick); } },
      { label: 'sumE', get: function (c) { return c.m.sumE.toFixed(2); } },
      { label: 'maxE / minE', get: function (c) { return c.m.maxE.toFixed(3) + ' / ' + fmtMin(c.sim).toFixed(3); } },
      { label: '<span class="src">source x</span> (떠도는 고임)', get: function (c) { return c.sim.p.source.x + ' (y' + c.sim.p.source.y + ')'; } },
      { label: '<span class="pool">고임 수</span> (source 밖 봉우리)', get: function (c) { return String(c.pools.length); } },
      { label: '<span class="life">개체수</span> / 총 생물량 M', get: function (c) { return (c.sim.agents.length) + ' / ' + c.led.biomass.toFixed(2); } },
      { label: '무게중심→source <b>추적거리</b>', get: function (c) { var t = c.core.trackDist(c.sim); return t == null ? '-' : t.toFixed(2); } },
      { label: '누적 출생 / 사망 / 이동', get: function (c) { return c.sim.births + ' / ' + c.sim.deaths + ' / ' + c.sim.moves; } },
      { label: '대사 소산 (기초대사 포함)', get: function (c) { return c.sim.metabolized.toFixed(1); } },
      { label: '장부 잔차', get: function (c) { var r = c.led.residual; return { text: r.toExponential(3) + (r < 1e-6 ? ' PASS' : ' FAIL'), cls: r < 1e-6 ? 'pass' : 'fail' }; } },
      { label: 'injected / evap / sunk / metab', get: function (c) { var s = c.sim; return s.injected.toFixed(1) + ' / ' + s.evaporated.toFixed(1) + ' / ' + s.sunk.toFixed(1) + ' / ' + s.metabolized.toFixed(1); } }
    ],

    legend:
      '<span class="src">●</span> source(떠돎 6칸/150tick) &nbsp; <span class="snk">●</span> sink(48,48,r4) &nbsp; <span class="pool">○</span> 고임 &nbsp; <span class="life">●</span> 생명 &nbsp; <span style="color:#ff5fd0">✛</span> 무게중심<br>' +
      '<b>① churn</b>: 떠도는 자원 위에선 정착 후에도 출생·사망이 멈추지 않는다(매 재배치가 재점화). <b>②</b> 이동 off 면 뒤처져 멸종. <b>③</b> 무게중심이 source 를 추적.<br>' +
      '<b>회귀</b>: srcJump=0 이면 step-0006(정적·동결)과 비트 동일. srcJump=1(≈연속표류)도 동결 — 이산 점프라야 churn(갈릴레이). 잔차 &lt;1e-6 이면 <span class="pass">PASS</span>.',

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
  else global.HWS_PANEL_0007 = panel;
})(typeof window !== 'undefined' ? window : globalThis);
