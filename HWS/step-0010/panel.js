/* step-0010 패널 — 확률적 탐사(run-and-tumble: 갇힌 굶주린 생명이 의사난수 방향으로 한 칸).
 * step-0009 패널을 복사해 새 노브 행 1개(탐사 pTumble)와 통계 1개(누적 탐사)를 더했다.
 * 시뮬 동작은 step-0010/sim-core.js(window.HWS10)에서 온다. 브라우저: window.HWS_PANEL_0010 / Node: module.exports */
(function (global) {
  'use strict';
  function fmtMin(sim) { var mn = Infinity, E = sim.E; for (var i = 0; i < E.length; i++) if (E[i] < mn) mn = E[i]; return mn; }

  var panel = {
    coreGlobal: 'HWS10',
    title: 'HWS step-0010 — 확률적 <span style="color:#7fd0ff">탐사</span>(run-and-tumble): 생명이 옅은 골짜기를 건넌다',
    subtitle: '갇힌(국소 최대) <b>굶주린</b> 생명이 의사난수 방향으로 한 칸 — 옅은 골짜기를 건너 다음 고임을 찾는다(<b>tumble</b>). 구배가 있으면 greedy 가 등반(<b>run</b>), 없으면 무작위 — 필드 E 의 운동(advection+확산)을 생물량이 물려받는다. 무작위는 <b>구배와 무상관</b>일 뿐 결정론(시드 의사난수)이다. <code>node step-0010/verify.js</code> 로 회귀·장부·결정론·탈출(escape)·생존/한계(churn) 검증. <b>정직</b>: 정적 source 에선 개체군이 source(전역 끌개)로 수렴해 끝없는 churn 은 안 됨 — 구동 내생화 필요(§다음).',
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
        { kind: 'check', id: 'wander', label: '떠도는 자원', def: false, gateFor: 'srcJump', title: 'source 가 주기적으로 +x 로 재배치(step-0007 외부 sawtooth). 0 = 정적. 이 step 의 핵심은 *끈 채*(정적 source)에서도 풍경이 스스로 움직이는 것 — 기본 off.' },
        { kind: 'slider', id: 'srcJump', label: '점프 srcJump', param: 'srcJump', min: 0, max: 12, step: 1, def: 6, fixed: 0, gateBy: 'wander', gateOff: 0 },
        { kind: 'slider', id: 'srcPeriod', label: '주기', param: 'srcPeriod', min: 30, max: 400, step: 10, def: 150, fixed: 0 }
      ]},
      { items: [
        { kind: 'check', id: 'cryst', label: '결정화(저장)', def: true, gateFor: 'kCryst', title: 'E>crystThresh 인 셀의 초과분이 굳어 저장체 R 로(E→R). 0 = 저장체 없음. 풍화로 천천히 E 로 되돌아온다.' },
        { kind: 'slider', id: 'kCryst', label: '결정화 kCryst', param: 'kCryst', min: 0, max: 0.05, step: 0.005, def: 0.01, fixed: 3, gateBy: 'cryst', gateOff: 0, title: '결정화율(빠름).' },
        { kind: 'slider', id: 'crystThresh', label: '문턱 cTh', param: 'crystThresh', min: 1, max: 5, step: 0.1, def: 2.0, fixed: 1, title: '결정화 문턱 — E 가 이 값을 넘는 셀만 굳는다. 기복 on 이면 E 가 문턱 위에 머물지 못하므로 고임 범위(1.5~3) 안에 둬야 래칫이 계속 돈다(step-0009 표준 2.0).' },
        { kind: 'slider', id: 'kWeather', label: '풍화 kW', param: 'kWeather', min: 0, max: 0.002, step: 0.0001, def: 0.0003, fixed: 4, title: '풍화율(느림). R→E 로 되돌리는 세계척도 순환의 back-path.' }
      ]},
      { items: [
        { kind: 'check', id: 'stage', label: '무대(기복)', def: true, gateFor: 'kRelief', title: '퇴적 R 이 바닥을 올려 흐름이 굳은 땅을 비켜간다(h=E+kRelief·R 의 내리막으로 확산). 0 = step-0008(비활성 저장 — 흐름이 R 을 무시하고 통과).' },
        { kind: 'slider', id: 'kRelief', label: '기복 kRelief', param: 'kRelief', min: 0, max: 3, step: 0.1, def: 1.0, fixed: 1, gateBy: 'stage', gateOff: 0, title: '기복 가중 — 1 이면 3D 지형 높이(E+R)가 곧 흐름 퍼텐셜.' }
      ]},
      { items: [
        { kind: 'check', id: 'tumble', label: '탐사(run-and-tumble)', def: true, gateFor: 'pTumble', title: '갇힌(이동 불가=국소 최대) 굶주린(예측 흡수<비용) 생명이 의사난수 방향으로 한 칸 — 옅은 골짜기를 건너 다음 고임 탐색. 0 = step-0009(greedy 만 — 갇히면 제자리). 방향은 시드 의사난수(결정론 유지).' },
        { kind: 'slider', id: 'pTumble', label: '탐사 pTumble', param: 'pTumble', min: 0, max: 1, step: 0.05, def: 1.0, fixed: 2, gateBy: 'tumble', gateOff: 0, title: 'tumble 확률 — 갇힌·굶주린 매 tick 이 확률로 의사난수 한 칸. 1 = 무조건. (run-and-tumble 의 tumble rate.)' }
      ]},
      { items: [
        { kind: 'select', id: 'click', label: '클릭 동작', role: 'click', options: [['life', '생명 놓기'], ['rock', '둑 쌓기(저장체)'], ['harvest', '수확']], def: 'life' },
        { kind: 'button', id: 'seed1', label: '강한 고임에 씨앗 ×1', action: 'seedPools1' },
        { kind: 'button', id: 'seedLife', label: '×3', action: 'seedPools3' },
        { kind: 'button', id: 'kill', label: '전멸', action: 'kill' }
      ]}
    ],

    /* 저장체 오버레이 — R>eps 인 셀을 호박색 사각으로(밝기 ∝ R). 흐르는 E(배경) 위에 굳은 저장체를 겹쳐 보인다.
     * 기복(step-0009)에선 R 이 셀당 ~3 으로 얇게 펴지므로 포화점을 이 프레임 maxR 에 적응(고정 /20 은 너무 옅음).
     * step-0008 의 농축 퇴적(R~5)이든 step-0009 의 얇은 퇴적이든 강한 둑이 또렷 — 3D 의 uSatR 와 같은 정신. */
    drawHook: function (ctx, c) {
      var R = c.sim.R, W = c.sim.p.W, H = c.sim.p.H, SCALE = c.SCALE, N = W * H, i;
      var mxR = 0; for (i = 0; i < N; i++) if (R[i] > mxR) mxR = R[i];
      var satR = mxR > 1.5 ? mxR : 1.5;
      for (var y = 0; y < H; y++) {
        for (var x = 0; x < W; x++) {
          var r = R[y * W + x];
          if (r > 0.05) {
            var a = r / satR; if (a > 0.85) a = 0.85;
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
      { label: '누적 출생 / 사망 / 이동(run) / <span style="color:#7fd0ff">탐사(tumble)</span>', get: function (c) { return c.sim.births + ' / ' + c.sim.deaths + ' / ' + c.sim.moves + ' / ' + c.sim.tumbles; } },
      { label: '장부 잔차', get: function (c) { var r = c.led.residual; return { text: r.toExponential(3) + (r < 1e-6 ? ' PASS' : ' FAIL'), cls: r < 1e-6 ? 'pass' : 'fail' }; } },
      { label: 'sumE / M / R (장부)', get: function (c) { return c.led.sumE.toFixed(1) + ' / ' + c.led.biomass.toFixed(1) + ' / ' + c.led.store.toFixed(1); } }
    ],

    legend:
      '<span class="src">●</span> source &nbsp; <span class="snk">●</span> sink &nbsp; <span class="pool">○</span> 고임 &nbsp; <span class="life">●</span> 생명 &nbsp; <span style="color:#c89b6a">■</span> 저장체(=언덕) &nbsp; <span style="color:#ff5fd0">✛</span> 무게중심<br>' +
      '<b>탐사(run-and-tumble)</b>: 생명에 씨앗을 놓아 보라(또는 "씨앗 ×3"). 고임이 옅어지거나 떠나면 굶주린 생명이 <b>의사난수 방향으로 한 칸</b>(tumble) — 옅은 골짜기를 건너 다음 고임을 찾는다(greedy=국소 최대 함정 해소). 잘 먹는 정착 생명은 탐사하지 않는다. 탐사를 끄면(pTumble=0) step-0009 와 비트 동일(갇히면 제자리).<br>' +
      '<b>무대</b>: 퇴적(호박색)이 쌓이면 언덕이 되어 흐름이 비켜간다 — 고임이 옆으로 옮겨간다(정적 source 인데 풍경이 움직인다). <b>정직한 한계</b>: 탐사가 국소 함정은 풀지만, 정적 source 에선 개체군이 <b>source(영구 전역 끌개)로 수렴</b>해 끝없는 churn 은 안 된다 — 떠도는 자원을 켜 보라(외부 운동) 또는 다음 step(구동 내생화). 잔차 &lt;1e-6 이면 <span class="pass">PASS</span>.',

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
      },
      rock: function (api, cx, cy) {
        var added = api.core.paintStore(api.sim, cx, cy, 2, 5);
        api.toast('둑 쌓기 (' + cx + ',' + cy + ') +' + added.toFixed(0) + ' R (E0 보정 — 장부 유지)' + (api.sim.p.kRelief === 0 ? ' — 무대 off: 흐름이 그냥 통과한다' : ''));
      }
    }
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = panel;
  else global.HWS_PANEL_0010 = panel;
})(typeof window !== 'undefined' ? window : globalThis);
