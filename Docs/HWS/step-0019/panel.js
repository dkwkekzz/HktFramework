/* step-0019 패널 — 개체↔대사 차등 결합(share: kin 생물량 m 공유 → 개체 단위 생존 → kin selection 선택압, SPINE §다섯째 축 "개체를 중립에서 적응으로").
 * step-0018 패널을 잇되 새 노브 행 1개(생물량 공유 kShare)를 더했다. 시뮬 로직은 engine/hws-laws.js 의 share 법칙(LAW_ORDER ⑥d, crowd 뒤·생명 앞).
 * 표준 시나리오: step-0018 그대로(별·자기제한·연소 FSM·계량·복제·생명 유전·차등 응집·막 결합) + 생물량 공유 on(kShare 0.5, 균일 협동). 브라우저: window.HWS_PANEL_0019 */
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
    title: 'HWS step-0019 — <span style="color:#e0c060">공유</span>: 개체↔대사 차등 결합(share)',
    subtitle: 'step-0018 의 막(couple)은 <b>필드 E</b> 를 kin 끼리 *균일하게* 공유해 개체에 <b>개체군 이득</b>(공유 larder → carrying capacity↑·개체 커짐)을 줬으나 — 모두 똑같이 공유(분업 없음)라 <b>선택압은 0</b>이었다(개체군 이득 ≠ 개체군 선택). 이 step 은 그 larder 를 <b>차등</b>으로 만든다: kin 끼리 공유하는 것을 *E* 가 아니라 <b>생물량 m</b>(사망/번식을 직접 가르는 양)으로, 강도를 <b>유전형의 함수</b>(coop)로. 협동 유전형은 사망 직전 kin 을 제 잉여로 떠받쳐(표적 구조) 차등 생존 → <b>kin selection 선택압</b>. <i>단 kin 이 뭉쳐야</i> 작동(Hamilton rb&gt;c). 개체성을 <b>중립에서 적응으로</b>. <code>node step-0019/verify.js</code> 로 회귀·장부·결정론·kin·sustain 검증.',
    overlays: { sourceSink: false, pools: true, life: true, centroid: true, sparkline: true },
    poolOpts: { minE: 1.5, prom: 0.3 },

    controls: [
      { items: [
        { kind: 'check', id: 'drive', label: '외부 source', param: 'drive', def: false, title: '고정 외부 source(step-0007). 기본 off — 별이 내생 구동.' },
        { kind: 'check', id: 'auto', label: '자동 명암', def: true, view: true, title: '화면 밝기를 현재 최대 E 에 맞춰 정규화' }
      ]},
      { items: [
        { kind: 'check', id: 'sharec', label: '생물량 공유(개체↔대사)', def: true, gateFor: 'kShare', title: '같은 유전형(kin) 4-인접 생명끼리 *생물량 m* 을 공유 — 협동 유전형이 사망 직전 kin 을 제 잉여로 떠받친다(표적 구조 → 개체 단위 생존). 0 = step-0018(공유는 E 만, m 선택압 없음).' },
        { kind: 'slider', id: 'kShare', label: 'kShare', param: 'kShare', min: 0, max: 1, step: 0.05, def: 0.5, fixed: 2, gateBy: 'sharec', gateOff: 0, title: 'kin m 구조 강도(0~1). 협동자가 굶주린 kin 을 떠받쳐 차등 생존(kin selection). 전체 스택은 균일 협동(coopFit0=1).' }
      ]},
      { items: [
        { kind: 'check', id: 'couplec', label: '막/flux 결합(개체↔도메인)', def: true, gateFor: 'kMembrane', title: '같은 유전형(kin) 4-인접 생명끼리 필드 E 를 공유·재분배 → 액적 내부 균질·경계 단차(막) 창발. 0 = step-0017(측정 윤곽일 뿐 — 막 없음).' },
        { kind: 'slider', id: 'kMembrane', label: 'kMembrane', param: 'kMembrane', min: 0, max: 1, step: 0.05, def: 0.5, fixed: 2, gateBy: 'couplec', gateOff: 0, title: 'kin 쌍 E 균등화 강도(0~1). 0=무공유, 1=완전 균등화. 클수록 막이 또렷·내부 균질.' }
      ]},
      { items: [
        { kind: 'check', id: 'adhesionc', label: '차등 응집(개체↔액적)', def: true, gateFor: 'kAdhesion', title: '같은 유전형(kin) 생명끼리 모이고 다른 태그는 밀어낸다(Steinberg DAH) → 표면장력 액적(개체). 0 = step-0016(응집 없음 — 0-D 점).' },
        { kind: 'slider', id: 'kAdhesion', label: 'kAdhesion', param: 'kAdhesion', min: 0, max: 1, step: 1, def: 1, fixed: 0, gateBy: 'adhesionc', gateOff: 0 },
        { kind: 'slider', id: 'adhesionLambda', label: '이종 반발 λ', param: 'adhesionLambda', min: 0, max: 3, step: 0.1, def: 1.0, fixed: 1, title: '응집 점수 = kin − λ·타. 클수록 이종 분리가 날카롭다(표면장력↑).' },
        { kind: 'slider', id: 'adhesionGain', label: '이동 문턱 gain', param: 'adhesionGain', min: 0, max: 2, step: 0.1, def: 0.5, fixed: 1, title: '후보 칸 점수가 머무름보다 이만큼 커야 옮긴다(jitter 방지·안정 액적).' }
      ]},
      { items: [
        { kind: 'check', id: 'inheritc', label: '생명 유전(genotype↔대사)', def: true, gateFor: 'kInherit', title: '생명이 R-genotype 을 부트스트랩·분열 상속(±변이)하고, fit(태그)→대사세로 선택된다(step-0016). kin 을 정의해 응집·막의 토대.' },
        { kind: 'slider', id: 'kInherit', label: 'kInherit', param: 'kInherit', min: 0, max: 1, step: 1, def: 1, fixed: 0, gateBy: 'inheritc', gateOff: 0 },
        { kind: 'slider', id: 'inheritMu', label: '생명 변이율 mu', param: 'inheritMu', min: 0, max: 0.1, step: 0.005, def: 0.01, fixed: 3, title: '분열 상속 복제오류율 — 자식 태그가 이 확률로 ±1 이웃 태그로(변이). 0 = 순수 클론 계통.' },
        { kind: 'slider', id: 'inheritCost', label: '표현형 결합', param: 'inheritCost', min: 0, max: 0.4, step: 0.01, def: 0.02, fixed: 2, title: '차등 대사세 = 이값·(1−fit(태그))·m. 전체 스택 기본 0.02(약함, churn 보존).' }
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
        { kind: 'check', id: 'agg', label: '응집(E)', def: true, gateFor: 'kA' },
        { kind: 'slider', id: 'kA', label: 'kA', param: 'kA', min: 0, max: 0.6, step: 0.01, def: 0.45, fixed: 2, gateBy: 'agg', gateOff: 0 }
      ]},
      { items: [
        { kind: 'check', id: 'stage', label: '무대(기복)', def: true, gateFor: 'kRelief', title: '퇴적 R 이 흐름을 휜다(step-0009).' },
        { kind: 'slider', id: 'kRelief', label: 'kRelief', param: 'kRelief', min: 0, max: 3, step: 0.1, def: 1.0, fixed: 1, gateBy: 'stage', gateOff: 0 },
        { kind: 'check', id: 'cryst', label: '결정화(R)', def: true, gateFor: 'kCryst', title: '별이 주입한 E 가 굳어 R 로 — 복제·생명 부트스트랩의 기질.' },
        { kind: 'slider', id: 'kCryst', label: 'kCryst', param: 'kCryst', min: 0, max: 0.05, step: 0.005, def: 0.01, fixed: 3, gateBy: 'cryst', gateOff: 0 }
      ]},
      { items: [
        { kind: 'select', id: 'click', label: '클릭 동작', role: 'click', options: [['lifegene', '유전 생명 놓기'], ['gene', '유전 씨앗(R)'], ['star', '별 점화'], ['life', '생명 놓기'], ['rock', '둑 쌓기(R)'], ['harvest', '수확']], def: 'lifegene' },
        { kind: 'button', id: 'seedSortMix', label: '혼합 군집(저·고적합 ×다수)', action: 'seedSortMix' },
        { kind: 'button', id: 'seedLifeGene', label: '유전 생명 ×2', action: 'seedLifeGenes' },
        { kind: 'button', id: 'seedStar', label: '별 씨앗 ×6', action: 'seedStars' },
        { kind: 'button', id: 'seedLife', label: '생명 ×5', action: 'seedLife' },
        { kind: 'button', id: 'kill', label: '생명 전멸', action: 'kill' }
      ]}
    ],

    /* 오버레이 — 유전형 R(태그별 색) + 활성도 A + 별 + *유전 생명*(태그색 점) + *개체 윤곽*(다세포 kin 액적 = flux 결합 도메인). 막(경계 단차)은 바닥 E 하이트필드에 창발한다(렌즈가 공짜로 그림). */
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
      /* 개체 윤곽 — 같은 유전형 4-인접 생명 쌍을 선으로 잇는다(연결 성분 = 표면장력 액적 = flux 결합 도메인). 이 선 안에서 kin 끼리 E 를 공유(막). */
      var ag = sim.agents, occ = {};
      for (var k0 = 0; k0 < ag.length; k0++) { if (ag[k0].g) occ[ag[k0].center] = ag[k0].g; }
      ctx.lineWidth = Math.max(1, SCALE * 0.3);
      for (var k1 = 0; k1 < ag.length; k1++) {
        var ai = ag[k1], gg = ai.g; if (!gg) continue;
        var col2 = GENE_COL[gg], lx = (ai.x + 0.5) * SCALE, ly = (ai.y + 0.5) * SCALE;
        var rgt = ai.center - (ai.center % W) + (ai.x + 1) % W, dwn = ((ai.y + 1) % H) * W + ai.x;
        if (occ[rgt] === gg) { ctx.strokeStyle = 'rgba(' + col2[0] + ',' + col2[1] + ',' + col2[2] + ',0.6)'; ctx.beginPath(); ctx.moveTo(lx, ly); ctx.lineTo(((ai.x + 1) % W + 0.5) * SCALE, ly); ctx.stroke(); }
        if (occ[dwn] === gg) { ctx.strokeStyle = 'rgba(' + col2[0] + ',' + col2[1] + ',' + col2[2] + ',0.6)'; ctx.beginPath(); ctx.moveTo(lx, ly); ctx.lineTo(lx, ((ai.y + 1) % H + 0.5) * SCALE); ctx.stroke(); }
      }
      /* 유전 생명 점 — 각 에이전트를 제 유전형 색 점으로(genotype 을 이고 다니는 vehicle). 무유전 생명은 흰 점. */
      for (var k = 0; k < ag.length; k++) {
        var a2 = ag[k], col3 = GENE_COL[a2.g], lx2 = (a2.x + 0.5) * SCALE, ly2 = (a2.y + 0.5) * SCALE;
        ctx.fillStyle = col3 ? 'rgba(' + col3[0] + ',' + col3[1] + ',' + col3[2] + ',0.95)' : 'rgba(245,245,245,0.9)';
        ctx.beginPath(); ctx.arc(lx2, ly2, Math.max(1.6, SCALE * 0.33), 0, 6.2832); ctx.fill();
      }
    },

    stats: [
      { label: 'tick', get: function (c) { return String(c.sim.tick); } },
      { label: 'sumE', get: function (c) { return c.m.sumE.toFixed(2); } },
      { label: '<span style="color:#57e0c8">막 지수</span> (경계/내부 ΔE)', get: function (c) { var m = window.HWS_SIM.measureMembrane(c.sim); return m.intraPairs ? m.index.toFixed(2) : '—'; } },
      { label: '<span style="color:#78c860">개체</span> (수 / 평균 / 최대 세포)', get: function (c) { var o = window.HWS_SIM.measureOrganisms(c.sim); return o.nOrg + ' / ' + o.meanSize.toFixed(1) + ' / ' + o.maxSize; } },
      { label: '<span style="color:#78c860">kin 접촉 비율</span> (정렬↑)', get: function (c) { var o = window.HWS_SIM.measureOrganisms(c.sim); return o.tagged ? o.kinFrac.toFixed(3) : '—'; } },
      { label: '생명 유전형 (점유 / 변이)', get: function (c) { var s = c.sim, gs = lifeGeneStat(s); return gs.total + ' / ' + (s.inheritMut || 0); } },
      { label: '별 <span style="color:#ff9a3c">living</span>/<span style="color:#fff7d2">burning</span>/<span style="color:#aab">ash</span>', get: function (c) { var k = stateCounts(c.sim); return k[0] + ' / ' + k[1] + ' / ' + k[2]; } },
      { label: '<span class="pool">고임</span> / <span class="life">개체수</span> / M', get: function (c) { return c.pools.length + ' / ' + c.sim.agents.length + ' / ' + c.led.biomass.toFixed(2); } },
      { label: '누적 출생 / 사망 / E공유 / <span style="color:#e0c060">m공유</span>', get: function (c) { return c.sim.births + ' / ' + c.sim.deaths + ' / ' + (c.sim.coupled || 0).toFixed(0) + ' / ' + (c.sim.shared || 0).toFixed(0); } },
      { label: '장부 잔차', get: function (c) { var r = c.led.residual; return { text: r.toExponential(3) + (r < 1e-6 ? ' PASS' : ' FAIL'), cls: r < 1e-6 ? 'pass' : 'fail' }; } }
    ],

    legend:
      '<span style="color:#e86060">●</span>tag1(저적합) <span style="color:#78c860">●</span>tag2 <span style="color:#60a8e8">●</span>tag3 <span style="color:#c870e0">●</span>tag4(고적합) — 유전 생명, 같은 색 선으로 이으면 <b>한 개체</b>(flux 결합 도메인) &nbsp; <span style="color:#c89b6a">■</span>R &nbsp; <span style="color:#57e0c8">■</span>활성도 A &nbsp; <span style="color:#fff7d2">★</span>별<br>' +
      '<b>생물량 공유(개체↔대사)</b>: step-0018 막은 *필드 E* 를 kin 끼리 공유해 개체군 *이득*만 줬다(선택압 0). 이 step 은 *생물량 m* 을 <b>차등</b>(유전형의 함수 coop)으로 공유 — 협동 유전형이 사망 직전 kin 을 제 잉여로 떠받쳐(표적 구조) <b>차등 생존</b> → <b>kin selection 선택압</b>. 우측 "m공유" 가 누적량. "kShare" 를 올리면 굶주린 kin 이 더 떠받쳐진다.<br>' +
      '<b>Hamilton (rb&gt;c)</b>: 협동은 *kin 이 뭉쳐야*(높은 혈연도) 작동한다 — <code>verify kin</code>: 뭉치면 협동 *지속*(Δ+0.02)·흩어지면 *사라짐*(Δ−0.26, 낭비된 이타). 혈연도가 협동의 운명을 가른다(개체를 <b>중립에서 적응으로</b>). 공유는 *실제 m 재분배*지만 쌍 거래(나간 만큼 들어옴)라 churn 을 안 깬다(<code>verify sustain</code>·잔차 &lt;1e-6 <span class="pass">PASS</span>). "생물량 공유" 체크를 끄면 step-0018(공유는 E 만)로.',

    actions: {
      seedSortMix: function (api) {
        var s = api.sim, n = 0;
        for (var y = 20; y < 44; y++) for (var x = 20; x < 44; x++) {
          var h = api.core.tumbleHash(x, y, s.tick, s.seed);
          if ((h >>> 28) < 7) { var a = api.core.spawnAgent(s, x, y); a.g = ((h >>> 20) & 1) ? 4 : 1; n++; }
        }
        api.toast('혼합 군집 ' + n + '개체 — 차등 응집이 같은 색끼리 액적으로 정렬하고, 막 결합이 그 안에서 E 를 공유한다(막 창발)');
      },
      seedLifeGenes: function (api) {
        var s = api.sim, lo = api.core.spawnAgent(s, 22, 32), hi = api.core.spawnAgent(s, 42, 32);
        lo.g = 1; hi.g = 4; api.toast('유전 생명 ×2 — 저적합 tag1(빨강) · 고적합 tag4(보라)');
      },
      seedStars: function (api) { for (var i = 0; i < 6; i++) api.core.spawnStar(api.sim, (i * 53) % api.sim.p.W, (i * 29) % api.sim.p.H); api.toast('별 ×6 점화'); },
      seedLife: function (api) { var pools = api.core.detectPools(api.sim, { minE: 1.5, prom: 0.3 }), n = Math.min(5, pools.length); for (var i = 0; i < n; i++) api.core.spawnAgent(api.sim, pools[i].x, pools[i].y); api.toast(n ? ('강한 고임 ' + n + '곳에 생명') : '놓을 고임이 없다 — 별을 켜세요'); },
      kill: function (api) { var ag = api.sim.agents; for (var i = 0; i < ag.length; i++) { api.sim.E[ag[i].center] += ag[i].m; api.sim.deaths++; } api.sim.agents = []; api.toast('생명 전멸(장부 유지)'); }
    },

    clickModes: {
      lifegene: function (api, cx, cy) { var tag = 1 + ((api.sim.tick + cx + cy) % api.sim.p.geneTypes), a = api.core.spawnAgent(api.sim, cx, cy); a.g = tag; api.toast('유전 생명 (' + cx + ',' + cy + ') tag ' + tag + ' — kin 끼리 응집해 개체로, 그 안에서 E 공유(막)'); },
      gene: function (api, cx, cy) { var tag = 1 + ((api.sim.tick + cx + cy) % api.sim.p.geneTypes); api.core.spawnGene(api.sim, cx, cy, 1, tag, 1.0); api.toast('유전 씨앗 R (' + cx + ',' + cy + ') tag ' + tag); },
      star: function (api, cx, cy) { var s = api.core.spawnStar(api.sim, cx, cy); api.toast('별 점화 (' + cx + ',' + cy + ') 연료 ' + s.fuel.toFixed(0)); },
      life: function (api, cx, cy) { var a = api.core.spawnAgent(api.sim, cx, cy); api.toast('생명 출생 (' + cx + ',' + cy + ') m ' + a.m.toFixed(2)); },
      harvest: function (api, cx, cy) { var rm = api.core.harvest(api.sim, cx, cy, 3); api.toast('수확 −' + rm.toFixed(1) + ' E → sunk'); },
      rock: function (api, cx, cy) { var added = api.core.paintStore(api.sim, cx, cy, 2, 5); api.toast('둑 쌓기 +' + added.toFixed(0) + ' R(무유전)'); }
    }
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = panel;
  else global.HWS_PANEL_0019 = panel;
})(typeof window !== 'undefined' ? window : globalThis);
