/* step-0016 패널 — 생명 유전(inherit: genotype↔대사 결합, SPINE §다섯째 축 "유전↔생명 결합").
 * step-0015 패널을 잇되 새 노브 행 1개(생명 유전 kInherit·inheritMu·inheritCost)를 더했다. 시뮬 로직은 engine/hws-laws.js 의 inherit 법칙(LAW_ORDER ⑧b).
 * 표준 시나리오: step-0015 그대로(별 내생 구동·자기제한·연소 FSM·활성도 계량·R-주형 복제) + 생명 유전 on(kInherit 1). 브라우저: window.HWS_PANEL_0016 */
(function (global) {
  'use strict';
  function stateCounts(sim) { var c = [0, 0, 0], st = sim.stars || []; for (var i = 0; i < st.length; i++) { var s = st[i].state; c[s === undefined ? 1 : s]++; } return c; }
  /* 유전형 색(태그 1..4) — R 과 생명이 *같은* 색계로(genotype 통일). 적합도는 태그와 함께 오른다(tag4 최강). */
  var GENE_COL = [null, [232, 96, 96], [120, 200, 96], [96, 168, 232], [200, 112, 224]];   // 0=무유전, 1 red·2 green·3 blue·4 purple
  function geneStat(sim) {   // R 유전형(step-0015)
    var G = sim.G, p = sim.p, nG = p.geneTypes, by = new Array(nG + 1).fill(0), total = 0, i;
    for (i = 0; i < G.length; i++) { var g = G[i]; if (g !== 0) { by[g]++; total++; } }
    return { by: by, total: total };
  }
  function lifeGeneStat(sim) {   // 생명 유전형(step-0016) — 태그별 개체 수 + 평균 적합도
    var ag = sim.agents, p = sim.p, nG = p.geneTypes, by = new Array(nG + 1).fill(0), total = 0, i;
    for (i = 0; i < ag.length; i++) { var g = ag[i].g; if (g) { by[g]++; total++; } }
    var num = 0; for (var t = 1; t <= nG; t++) num += by[t] * (p.geneFit0 + p.geneFitStep * (t - 1));
    return { by: by, total: total, meanFit: total ? num / total : 0 };
  }

  var panel = {
    coreGlobal: 'HWS_SIM',
    title: 'HWS step-0016 — 생명 <span style="color:#78c860">유전</span>: genotype↔대사 결합(inherit)',
    subtitle: 'step-0015 가 유전을 <b>R(저장 극단)</b>에 깔았다("유전이 개체보다 먼저"). 이 step 은 그 genotype 을 <b>생명의 대사 엔진(m)에 단단히 묶는다</b> — 생명 = 자기복제 광물(genotype)을 소산 엔진(대사)에 묶어 활성도 <b>가운데</b> 선 것(SPINE §다섯째 축, 주요 전이 사다리 다음 칸). 세 결합: <b>부트스트랩</b>(생명이 제가 선 R-genotype 을 읽어 제 유전형으로 — Cairns-Smith), <b>상속</b>(분열 자식이 인접 부모 태그를 물려받음 ±변이), <b>표현형→대사</b>(저적합일수록 차등 대사세 → 고적합이 <b>생명 개체군에서</b> 선택). 유전형은 <b>이산</b> 속성(a.g) — 다양성은 병렬 필드 아닌 속성(단일 척추). 표현형세는 <b>실제 변환</b>(닫힌 장부)이되 도는 churn 을 깨지 않는다(전체 스택 약한 결합). <code>node step-0016/verify.js</code> 로 회귀·장부·결정론·heredity·select·sustain 검증.',
    overlays: { sourceSink: false, pools: true, life: true, centroid: true, sparkline: true },
    poolOpts: { minE: 1.5, prom: 0.3 },

    controls: [
      { items: [
        { kind: 'check', id: 'drive', label: '외부 source', param: 'drive', def: false, title: '고정 외부 source(step-0007). 기본 off — 별이 내생 구동.' },
        { kind: 'check', id: 'auto', label: '자동 명암', def: true, view: true, title: '화면 밝기를 현재 최대 E 에 맞춰 정규화' }
      ]},
      { items: [
        { kind: 'check', id: 'inheritc', label: '생명 유전(genotype↔대사)', def: true, gateFor: 'kInherit', title: '생명이 R-genotype 을 부트스트랩·분열 상속(±변이)하고, fit(태그)→대사세로 선택된다. 0 = step-0015(생명 유전 없음).' },
        { kind: 'slider', id: 'kInherit', label: 'kInherit', param: 'kInherit', min: 0, max: 1, step: 1, def: 1, fixed: 0, gateBy: 'inheritc', gateOff: 0 },
        { kind: 'slider', id: 'inheritMu', label: '생명 변이율 mu', param: 'inheritMu', min: 0, max: 0.1, step: 0.005, def: 0.01, fixed: 3, title: '분열 상속 복제오류율 — 자식 태그가 이 확률로 ±1 이웃 태그로(변이). 0 = 순수 클론 계통.' },
        { kind: 'slider', id: 'inheritCost', label: '표현형 결합', param: 'inheritCost', min: 0, max: 0.4, step: 0.01, def: 0.02, fixed: 2, title: '차등 대사세 = 이값·(1−fit(태그))·m. 클수록 선택 강함. 전체 스택 기본 0.02(약함, churn 보존). 0 = 중립(유전형 무비용).' }
      ]},
      { items: [
        { kind: 'check', id: 'templatec', label: '복제(R-주형)', def: true, gateFor: 'kTemplate', title: '유전형 R 주형이 이웃 E→R 을 촉매하며 태그를 복사(step-0015). 생명은 이 R-genotype 에서 부트스트랩한다.' },
        { kind: 'slider', id: 'kTemplate', label: 'kTemplate', param: 'kTemplate', min: 0, max: 1, step: 1, def: 1, fixed: 0, gateBy: 'templatec', gateOff: 0 },
        { kind: 'slider', id: 'geneMu', label: 'R 변이율 mu', param: 'geneMu', min: 0, max: 0.1, step: 0.005, def: 0.01, fixed: 3, title: 'R-주형 복제오류율(step-0015).' },
        { kind: 'slider', id: 'geneFitStep', label: '적합도 기울기', param: 'geneFitStep', min: 0, max: 0.3, step: 0.01, def: 0.15, fixed: 2, title: 'fit(tag)=geneFit0+이값·(tag−1). R·생명 공유 맵. 0 = 중립(선택 없음).' }
      ]},
      { items: [
        { kind: 'check', id: 'fluxc', label: '활성도 계량(flux)', def: true, gateFor: 'kFlux', title: '매 tick |dE/dt| 를 활성도 필드 A 로 적분(step-0014, 읽기 전용).' },
        { kind: 'slider', id: 'kFlux', label: 'kFlux', param: 'kFlux', min: 0, max: 1, step: 1, def: 1, fixed: 0, gateBy: 'fluxc', gateOff: 0 },
        { kind: 'slider', id: 'aFlux', label: 'EMA aFlux', param: 'aFlux', min: 0.02, max: 0.5, step: 0.02, def: 0.1, fixed: 2 }
      ]},
      { items: [
        { kind: 'check', id: 'fsmc', label: '연소 FSM(별)', def: true, gateFor: 'kFSM', title: '별을 living→burning→ash 이산 FSM 으로(step-0013).' },
        { kind: 'slider', id: 'kFSM', label: 'kFSM', param: 'kFSM', min: 0, max: 1, step: 1, def: 1, fixed: 0, gateBy: 'fsmc', gateOff: 0 },
        { kind: 'slider', id: 'burnOn', label: '점화 burnOn', param: 'burnOn', min: 0.3, max: 1.5, step: 0.05, def: 0.6, fixed: 2 },
        { kind: 'slider', id: 'burnOff', label: '소진 burnOff', param: 'burnOff', min: 0.1, max: 1.2, step: 0.05, def: 0.4, fixed: 2 }
      ]},
      { items: [
        { kind: 'check', id: 'crowdc', label: '자기제한(밀도)', def: true, gateFor: 'kCrowd', title: '국소 밀도가 높으면 추가 대사세 → carrying capacity(step-0012).' },
        { kind: 'slider', id: 'kCrowd', label: 'kCrowd', param: 'kCrowd', min: 0, max: 0.6, step: 0.02, def: 0.20, fixed: 2, gateBy: 'crowdc', gateOff: 0 }
      ]},
      { items: [
        { kind: 'check', id: 'ignite', label: '구동 내생화(별)', def: true, gateFor: 'kIgnite', title: 'R 누적 핵에서 별 점화·서행(step-0011). 0 = 별 없음.' },
        { kind: 'slider', id: 'kIgnite', label: 'kIgnite', param: 'kIgnite', min: 0, max: 1, step: 1, def: 1, fixed: 0, gateBy: 'ignite', gateOff: 0 },
        { kind: 'slider', id: 'starRate', label: '별 주입 rate', param: 'starRate', min: 0.02, max: 0.15, step: 0.01, def: 0.06, fixed: 2 },
        { kind: 'slider', id: 'ignThresh', label: '점화 문턱(R)', param: 'ignThresh', min: 0.5, max: 4, step: 0.1, def: 1.5, fixed: 1 }
      ]},
      { items: [
        { kind: 'check', id: 'life', label: '생명', param: 'life', def: true },
        { kind: 'slider', id: 'kL', label: '흡수 kL', param: 'kL', min: 0.01, max: 0.2, step: 0.005, def: 0.05, fixed: 3 },
        { kind: 'slider', id: 'baseCost', label: 'baseCost', param: 'baseCost', min: 0, max: 0.2, step: 0.005, def: 0.05, fixed: 3 },
        { kind: 'check', id: 'tumble', label: '탐사(탈출)', def: true, gateFor: 'pTumble' },
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
        { kind: 'check', id: 'cryst', label: '결정화(R)', def: true, gateFor: 'kCryst', title: '별이 주입한 E 가 굳어 R 로 — 복제·생명 부트스트랩의 기질.' },
        { kind: 'slider', id: 'kCryst', label: 'kCryst', param: 'kCryst', min: 0, max: 0.05, step: 0.005, def: 0.01, fixed: 3, gateBy: 'cryst', gateOff: 0 }
      ]},
      { items: [
        { kind: 'select', id: 'click', label: '클릭 동작', role: 'click', options: [['gene', '유전 씨앗(R)'], ['lifegene', '유전 생명 놓기'], ['star', '별 점화'], ['life', '생명 놓기'], ['rock', '둑 쌓기(R)'], ['harvest', '수확']], def: 'lifegene' },
        { kind: 'button', id: 'seedLifeGene', label: '유전 생명 ×2(저·고적합)', action: 'seedLifeGenes' },
        { kind: 'button', id: 'seedGene', label: '유전 씨앗 R ×2', action: 'seedGenes' },
        { kind: 'button', id: 'seedStar', label: '별 씨앗 ×6', action: 'seedStars' },
        { kind: 'button', id: 'seedLife', label: '생명 ×5', action: 'seedLife' },
        { kind: 'button', id: 'kill', label: '생명 전멸', action: 'kill' }
      ]}
    ],

    /* 오버레이 — 유전형 R(태그별 색) + 무유전 R(호박색) + 활성도 A(청록 글로우) + 별 + *유전 생명*(태그색 점). 생명이 genotype 을 *이고 다닌다*. */
    drawHook: function (ctx, c) {
      var sim = c.sim, R = sim.R, G = sim.G, W = sim.p.W, H = sim.p.H, SCALE = c.SCALE, N = W * H, i;
      if (sim.p.kFlux !== 0 && sim.fluxInit) {
        var A = sim.A, mxA = 0; for (i = 0; i < N; i++) if (A[i] > mxA) mxA = A[i];
        if (mxA > 1e-6) {
          for (var ya = 0; ya < H; ya++) for (var xa = 0; xa < W; xa++) {
            var av = A[ya * W + xa]; if (av < mxA * 0.08) continue;
            var aa = av / mxA; if (aa > 1) aa = 1;
            ctx.fillStyle = 'rgba(70,224,200,' + (0.30 * aa).toFixed(3) + ')';
            ctx.fillRect(xa * SCALE, ya * SCALE, SCALE, SCALE);
          }
        }
      }
      var mxR = 0; for (i = 0; i < N; i++) if (R[i] > mxR) mxR = R[i];
      var satR = mxR > 1.5 ? mxR : 1.5;
      for (var y = 0; y < H; y++) for (var x = 0; x < W; x++) {
        var idx = y * W + x, r = R[idx]; if (r <= 0.05) continue;
        var a = r / satR; if (a > 0.85) a = 0.85;
        var g = G[idx], col = GENE_COL[g];
        if (col) ctx.fillStyle = 'rgba(' + col[0] + ',' + col[1] + ',' + col[2] + ',' + a.toFixed(3) + ')';   // 유전형 클론 색(R)
        else ctx.fillStyle = 'rgba(200,155,106,' + (a * 0.8).toFixed(3) + ')';                                  // 무유전 R(호박)
        ctx.fillRect(x * SCALE, y * SCALE, SCALE, SCALE);
      }
      var st = sim.stars || [], f0 = sim.p.starFuel0 || 500;
      for (var s = 0; s < st.length; s++) {
        var stt = st[s], sx = (stt.x + 0.5) * SCALE, sy = (stt.y + 0.5) * SCALE, rad = (sim.p.starR + 0.5) * SCALE;
        var br = Math.min(1, stt.fuel / f0), state = stt.state === undefined ? 1 : stt.state;
        var c0, c1, c2, core;
        if (state === 0) { c0 = 'rgba(255,150,60,' + (0.30 + 0.25 * br).toFixed(2) + ')'; c1 = 'rgba(220,110,40,' + (0.18 * br).toFixed(2) + ')'; c2 = 'rgba(180,80,30,0)'; core = 'rgba(255,190,120,0.9)'; }
        else if (state === 1) { c0 = 'rgba(255,250,220,' + (0.55 + 0.4 * br).toFixed(2) + ')'; c1 = 'rgba(255,210,110,' + (0.30 * br).toFixed(2) + ')'; c2 = 'rgba(255,180,60,0)'; core = 'rgba(255,255,245,0.95)'; }
        else { c0 = 'rgba(150,150,160,0.35)'; c1 = 'rgba(110,110,120,0.18)'; c2 = 'rgba(90,90,100,0)'; core = 'rgba(180,180,190,0.85)'; }
        var grd = ctx.createRadialGradient(sx, sy, 0, sx, sy, rad);
        grd.addColorStop(0, c0); grd.addColorStop(0.5, c1); grd.addColorStop(1, c2);
        ctx.fillStyle = grd; ctx.beginPath(); ctx.arc(sx, sy, rad, 0, 6.2832); ctx.fill();
        ctx.fillStyle = core; ctx.beginPath(); ctx.arc(sx, sy, 2.2, 0, 6.2832); ctx.fill();
      }
      /* 유전 생명 — 각 에이전트를 제 유전형 색 점으로(genotype 을 이고 다니는 vehicle). 무유전 생명은 흰 점. */
      var ag = sim.agents;
      for (var k = 0; k < ag.length; k++) {
        var ai = ag[k], col2 = GENE_COL[ai.g], lx = (ai.x + 0.5) * SCALE, ly = (ai.y + 0.5) * SCALE;
        ctx.fillStyle = col2 ? 'rgba(' + col2[0] + ',' + col2[1] + ',' + col2[2] + ',0.95)' : 'rgba(245,245,245,0.9)';
        ctx.beginPath(); ctx.arc(lx, ly, Math.max(1.6, SCALE * 0.33), 0, 6.2832); ctx.fill();
      }
    },

    stats: [
      { label: 'tick', get: function (c) { return String(c.sim.tick); } },
      { label: 'sumE', get: function (c) { return c.m.sumE.toFixed(2); } },
      { label: '<span style="color:#78c860">생명 유전형</span> (점유 / 변이)', get: function (c) { var s = c.sim, gs = lifeGeneStat(s); return gs.total + ' / ' + (s.inheritMut || 0); } },
      { label: '<span style="color:#78c860">생명 평균 적합도</span> (선택↑)', get: function (c) { var gs = lifeGeneStat(c.sim); return gs.total ? gs.meanFit.toFixed(3) : '—'; } },
      { label: '<span style="color:#c89b6a">R 유전형</span> (점유칸 / 복제)', get: function (c) { var s = c.sim, gs = geneStat(s); return gs.total + ' / ' + s.geneReps; } },
      { label: '<span style="color:#57e0c8">활성도 A</span> (총량 / 최고)', get: function (c) { var s = c.sim; return (s.fluxInit ? s.fluxSum.toFixed(1) : '—') + ' / ' + (s.fluxInit ? s.fluxPeak.toFixed(3) : '—'); } },
      { label: '별 <span style="color:#ff9a3c">living</span>/<span style="color:#fff7d2">burning</span>/<span style="color:#aab">ash</span>', get: function (c) { var k = stateCounts(c.sim); return k[0] + ' / ' + k[1] + ' / ' + k[2]; } },
      { label: '<span class="pool">고임</span> / <span class="life">개체수</span> / M', get: function (c) { return c.pools.length + ' / ' + c.sim.agents.length + ' / ' + c.led.biomass.toFixed(2); } },
      { label: '누적 출생 / 사망', get: function (c) { return c.sim.births + ' / ' + c.sim.deaths; } },
      { label: '장부 잔차', get: function (c) { var r = c.led.residual; return { text: r.toExponential(3) + (r < 1e-6 ? ' PASS' : ' FAIL'), cls: r < 1e-6 ? 'pass' : 'fail' }; } }
    ],

    legend:
      '<span style="color:#e86060">●</span>tag1(저적합) <span style="color:#78c860">●</span>tag2 <span style="color:#60a8e8">●</span>tag3 <span style="color:#c870e0">●</span>tag4(고적합) — 유전 생명 &nbsp; <span style="color:#c89b6a">■</span>R(유전형/무유전) &nbsp; <span style="color:#57e0c8">■</span>활성도 A &nbsp; <span style="color:#fff7d2">★</span>별<br>' +
      '<b>생명 유전</b>: "유전 생명 ×2" 를 놓고 보라. 각 생명이 제 유전형 색을 *이고 다니며* 분열로 자식에 물려준다(상속). 변이율 mu=0 이면 순수 클론 계통(fidelity 1.00).<br>' +
      '<b>선택·적응</b>: 고적합(tag4, 보라)이 저적합(tag1, 빨강)보다 덜 내(차등 대사세) 더 많이 번진다 — *생명 개체군에서* 선택. "표현형 결합"을 올리면 선택이 강해진다. 우측 "생명 평균 적합도" 가 시간에 오른다(변이 켠 채로). <code>verify select</code>: ratio~3.3·적응 +0.31.<br>' +
      '<b>부트스트랩</b>: 별→결정화로 R-genotype 이 생기면 그 위에 선 생명이 유전형을 *읽어* 단단히 묶는다(생명↔광물, Cairns-Smith). 전체 스택은 약한 결합이라 churn 을 안 깬다(<code>verify sustain</code>). 잔차 &lt;1e-6 이면 <span class="pass">PASS</span>.',

    actions: {
      seedLifeGenes: function (api) {
        var s = api.sim, lo = api.core.spawnAgent(s, 22, 32), hi = api.core.spawnAgent(s, 42, 32);
        lo.g = 1; hi.g = 4; api.toast('유전 생명 ×2 — 저적합 tag1(빨강) · 고적합 tag4(보라). 번식·선택을 지켜보라');
      },
      seedGenes: function (api) { api.core.spawnGene(api.sim, 20, 20, 2, 1, 1.0); api.core.spawnGene(api.sim, 44, 44, 2, 4, 1.0); api.toast('유전 씨앗 R ×2 — 생명이 그 위에서 부트스트랩'); },
      seedStars: function (api) { for (var i = 0; i < 6; i++) api.core.spawnStar(api.sim, (i * 53) % api.sim.p.W, (i * 29) % api.sim.p.H); api.toast('별 ×6 점화'); },
      seedLife: function (api) { var pools = api.core.detectPools(api.sim, { minE: 1.5, prom: 0.3 }), n = Math.min(5, pools.length); for (var i = 0; i < n; i++) api.core.spawnAgent(api.sim, pools[i].x, pools[i].y); api.toast(n ? ('강한 고임 ' + n + '곳에 생명') : '놓을 고임이 없다 — 별을 켜세요'); },
      kill: function (api) { var ag = api.sim.agents; for (var i = 0; i < ag.length; i++) { api.sim.E[ag[i].center] += ag[i].m; api.sim.deaths++; } api.sim.agents = []; api.toast('생명 전멸(장부 유지)'); }
    },

    clickModes: {
      lifegene: function (api, cx, cy) { var tag = 1 + ((api.sim.tick + cx + cy) % api.sim.p.geneTypes), a = api.core.spawnAgent(api.sim, cx, cy); a.g = tag; api.toast('유전 생명 (' + cx + ',' + cy + ') tag ' + tag + ' — genotype 을 이고 번식한다'); },
      gene: function (api, cx, cy) { var tag = 1 + ((api.sim.tick + cx + cy) % api.sim.p.geneTypes); api.core.spawnGene(api.sim, cx, cy, 1, tag, 1.0); api.toast('유전 씨앗 R (' + cx + ',' + cy + ') tag ' + tag); },
      star: function (api, cx, cy) { var s = api.core.spawnStar(api.sim, cx, cy); api.toast('별 점화 (' + cx + ',' + cy + ') 연료 ' + s.fuel.toFixed(0)); },
      life: function (api, cx, cy) { var a = api.core.spawnAgent(api.sim, cx, cy); api.toast('생명 출생 (' + cx + ',' + cy + ') m ' + a.m.toFixed(2)); },
      harvest: function (api, cx, cy) { var rm = api.core.harvest(api.sim, cx, cy, 3); api.toast('수확 −' + rm.toFixed(1) + ' E → sunk'); },
      rock: function (api, cx, cy) { var added = api.core.paintStore(api.sim, cx, cy, 2, 5); api.toast('둑 쌓기 +' + added.toFixed(0) + ' R(무유전)'); }
    }
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = panel;
  else global.HWS_PANEL_0016 = panel;
})(typeof window !== 'undefined' ? window : globalThis);
