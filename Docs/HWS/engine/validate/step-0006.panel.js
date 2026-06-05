/* step-0006 패널 — 닫힌 step-0006.html 의 인라인 UI 를 *선언적 패널*로 재현(검증용).
 * 목적: 공통 엔진(engine/hws-ui.js)이 step-0006 의 컨트롤·통계·동작·파라미터 매핑을
 *   바이트 동일한 시뮬 동작으로 재현하는지 확인한다. 닫힌 step-0006/ 파일은 손대지 않는다.
 * 이 패널이 곧 step-0007 panel.js 의 출발 템플릿이다(여기에 새 노브 한 줄만 더하면 된다).
 * 브라우저: window.HWS_PANEL_0006 / Node: module.exports */
(function (global) {
  'use strict';
  function fmtMin(sim) { var mn = Infinity, E = sim.E; for (var i = 0; i < E.length; i++) if (E[i] < mn) mn = E[i]; return mn; }

  var panel = {
    coreGlobal: 'HWS6',
    title: 'HWS step-0006 (엔진 재현) — 기초대사비, 자원이 <span class="life">생명</span>을 공간적으로 가른다',
    subtitle: '닫힌 step-0006 의 인라인 UI 를 공통 엔진 + 선언적 패널로 재현 — 같은 sim-core.js 를 그대로 로드하므로 시뮬 동작은 비트 동일. <code>node engine/validate/verify-engine.js</code> 로 파라미터 매핑·결정론 검증.',
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
        { kind: 'check', id: 'base', label: '기초대사비', def: true, gateFor: 'baseCost', title: '생물량과 무관한 절대 생존 비용. 0 = step-0005(문턱 없음). 높일수록 옅은 곳의 생명이 굶어 죽고 진짜 고임에만 산다.' },
        { kind: 'slider', id: 'baseCost', label: 'baseCost', param: 'baseCost', min: 0, max: 0.2, step: 0.005, def: 0.08, fixed: 3, gateBy: 'base', gateOff: 0 }
      ]},
      { items: [
        { kind: 'select', id: 'click', label: '클릭 동작', role: 'click', options: [['life', '생명 놓기'], ['harvest', '수확']], def: 'life' },
        { kind: 'button', id: 'seed1', label: '강한 고임에 씨앗 ×1', action: 'seedPools1' },
        { kind: 'button', id: 'seedLife', label: '×3', action: 'seedPools3' },
        { kind: 'button', id: 'kill', label: '전멸', action: 'kill' }
      ]},
      { items: [
        { kind: 'button', id: 'seedThin', label: '⌖ 마른 비탈에 씨앗 (떠나야 산다)', action: 'seedThin', title: 'source 봉우리에서 거리 12 인 옅은 비탈에 씨앗을 놓는다. 이동 on 이면 봉우리로 기어 올라가 살고, 이동 끄면 그 자리에서 굶어 죽는다.' },
        { kind: 'button', id: 'moveSrc', label: '↦ source 옮기기', action: 'moveSrc', title: 'source 를 16칸 옆으로 옮긴다 — 옛 자리는 마르고 새 자리에 자원이 찬다.' }
      ]}
    ],

    stats: [
      { label: 'tick', get: function (c) { return String(c.sim.tick); } },
      { label: 'sumE', get: function (c) { return c.m.sumE.toFixed(2); } },
      { label: 'maxE / minE', get: function (c) { return c.m.maxE.toFixed(3) + ' / ' + fmtMin(c.sim).toFixed(3); } },
      { label: '<span class="pool">고임 수</span> (source 밖 봉우리)', get: function (c) { return String(c.pools.length); } },
      { label: '<span class="life">개체수</span> / 총 생물량 M', get: function (c) { return (c.sim.agents.length) + ' / ' + c.led.biomass.toFixed(2); } },
      { label: '누적 출생 / 사망 / 이동', get: function (c) { return c.sim.births + ' / ' + c.sim.deaths + ' / ' + c.sim.moves; } },
      { label: '대사 소산 (기초대사 포함)', get: function (c) { return c.sim.metabolized.toFixed(1); } },
      { label: '장부 잔차', get: function (c) { var r = c.led.residual; return { text: r.toExponential(3) + (r < 1e-6 ? ' PASS' : ' FAIL'), cls: r < 1e-6 ? 'pass' : 'fail' }; } },
      { label: 'injected / evap / sunk / metab', get: function (c) { var s = c.sim; return s.injected.toFixed(1) + ' / ' + s.evaporated.toFixed(1) + ' / ' + s.sunk.toFixed(1) + ' / ' + s.metabolized.toFixed(1); } }
    ],

    legend:
      '<span class="src">●</span> source(16,16,r3) &nbsp; <span class="snk">●</span> sink(48,48,r4) &nbsp; <span class="pool">○</span> 고임 &nbsp; <span class="life">●</span> 생명(크기 ∝ 생물량)<br>' +
      '<b>회귀</b>: baseCost=0 이면 step-0005(이동·번식)와 비트 동일. 잔차 &lt;1e-6 이면 <span class="pass">PASS</span>.',

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
      },
      seedThin: function (api) {
        var tx = (api.sim.p.source.x + 12) % api.W, ty = api.sim.p.source.y;
        api.core.spawnAgent(api.sim, tx, ty);
        api.toast('마른 비탈(' + tx + ',' + ty + ') 씨앗 — 이동 on: 올라가 산다 / off: 굶어 죽는다', 3000);
      },
      moveSrc: function (api) {
        var nx = (api.sim.p.source.x + 16) % api.W, ny = api.sim.p.source.y;
        api.core.setSource(api.sim, { x: nx, y: ny });
        api.toast('source → (' + nx + ',' + ny + ') — 옛 자리는 마르고 새 자리에 자원이 찬다', 3000);
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
  else global.HWS_PANEL_0006 = panel;
})(typeof window !== 'undefined' ? window : globalThis);
