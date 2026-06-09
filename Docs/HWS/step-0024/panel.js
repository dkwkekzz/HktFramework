/* step-0024 패널 — 곡률 기반 표면장력(tension: 막을 경계 곡률로 편향 → 액적의 E-형태가 둥글어진다. 형태 사다리 R2, INTERPRET §5).
 * step-0023 패널을 잇되 새 노브 행 1개(곡률 표면장력 kTension)를 더했다. 시뮬 로직은 engine/hws-laws.js 의 tension 법칙(LAW_ORDER ⑥a2, adhere 뒤·couple 앞 — E-막에 Young-Laplace 곡률 구배).
 * 표준 시나리오: step-0023 그대로(별·…·세포 분화·계통 격리·정착) + 곡률 표면장력 on(kTension 1). 브라우저: window.HWS_PANEL_0024 */
(function (global) {
  'use strict';
  function stateCounts(sim) { var c = [0, 0, 0], st = sim.stars || []; for (var i = 0; i < st.length; i++) { var s = st[i].state; c[s === undefined ? 1 : s]++; } return c; }
  /* 유전형 색(태그 1..4) — R 과 생명이 *같은* 색계로(genotype 통일). 적합도는 태그와 함께 오른다(tag4 최강). */
  var GENE_COL = [null, [232, 96, 96], [120, 200, 96], [96, 168, 232], [200, 112, 224]];   // 0=무유전, 1 red·2 green·3 blue·4 purple
  function lifeGeneStat(sim) {   // 생명 유전형(step-0016) — 태그별 개체 수 + 평균 적합도
    var ag = sim.agents, p = sim.p, nG = p.geneTypes, by = new Array(nG + 1).fill(0), total = 0, i;
    for (i = 0; i < ag.length; i++) { var g = ag[i].g; if (g) { by[g]++; total++; } }
    var num = 0; for (var t = 1; t <= nG; t++) num += by[t] * (p.geneFit0 + p.geneFitStep * (t - 1));
    return { by: by, total: total, meanFit: total ? num / total : 0 };
  }

  var panel = {
    coreGlobal: 'HWS_SIM',
    title: 'HWS step-0024 — <span style="color:#46e0c8">곡률 기반 표면장력</span>: 막을 경계 곡률로 편향(tension)',
    subtitle: '형태 사다리 R1(step-0017 응집 + step-0018 막)이 개체를 <b>표면장력 액적</b>으로 빚어 막을 <b>바닥 E 하이트필드</b>에 새겼다. 그런데 <i>position</i> 곡률(셀을 옮겨 둥글리기)은 응집(Steinberg 차등접착=표면장력)과 redundant 다 — 응집이 이미 액적을 둥글리고, 보존적 단일-셀 이동은 떨어진 액적 사이 에너지 장벽도 못 넘는다(<b>정직한 발견</b>). R2 의 진짜 자리는 <b>형태가 실리는 바닥 필드 E</b>다(INTERPRET §5 "형태는 flux 의 하류 — 시뮬이 빚는다"). 이 step 은 그 <b>E-막에 Young-Laplace 표면장력</b>을 더한다(막을 경계 곡률로 편향) — 막(R1 couple)이 kin 끼리 E 를 균등화했다면, tension(R2)은 그 위에 <b>곡률 구배</b>를 얹어 <i>볼록 경계(coordination 낮음)의 E 를 오목/속(coordination 높음)으로</i> 민다(ΔP=γκ). 액적의 <i>E-형태</i>가 둥근 돔으로 모이고 톱니 경계의 E 가 펴진다 → 같은 해석 렌즈가 그 둥근 형태를 코드 0 으로 그린다. <code>node step-0024/verify.js</code> 로 회귀·장부·결정론·tension·sustain 검증.',
    overlays: { sourceSink: false, pools: true, life: true, centroid: true, sparkline: true },
    poolOpts: { minE: 1.5, prom: 0.3 },

    controls: [
      { items: [
        { kind: 'check', id: 'drive', label: '외부 source', param: 'drive', def: false, title: '고정 외부 source(step-0007). 기본 off — 별이 내생 구동.' },
        { kind: 'check', id: 'auto', label: '자동 명암', def: true, view: true, title: '화면 밝기를 현재 최대 E 에 맞춰 정규화' }
      ]},
      { items: [
        { kind: 'check', id: 'tensionc', label: '곡률 표면장력(막에 Young-Laplace)', def: true, gateFor: 'kTension', title: 'E-막에 곡률 구배를 얹는다 — 볼록 경계(같은 태그 4-근방 적음)의 E 를 오목/속(많음)으로 민다(ΔP=γκ). 액적의 E-형태가 둥근 돔으로. couple(R1)의 균등화 위에 얹힌다. 0 = step-0023(곡률 없음).' },
        { kind: 'slider', id: 'kTension', label: 'kTension', param: 'kTension', min: 0, max: 1, step: 1, def: 1, fixed: 0, gateBy: 'tensionc', gateOff: 0, title: '곡률 표면장력 마스터(0/1). 1 = on. E 쌍 거래(볼록→오목, 나간 만큼 들어옴)라 장부 불변.' },
        { kind: 'slider', id: 'tensionGamma', label: '표면장력 γ', param: 'tensionGamma', min: 0, max: 0.4, step: 0.02, def: 0.10, fixed: 2, title: '곡률 계수 γ — kin 4-쌍 E flux = γ·Δ(coordination)·E[볼록쪽]. 클수록 E-돔이 강하게 둥글어진다.' }
      ]},
      { items: [
        { kind: 'check', id: 'anchorc', label: '정착 생활사(잘 먹은 kin-포위 → 고착)', def: true, gateFor: 'kAnchor', title: '잘 먹고(m≥anchorM) kin 에 둘러싸인(같은 태그 4-근방≥anchorKin) 생명이 이 tick 고착 → 이동·탐사·재정렬 보류(제자리 유지). 떠돌지 않는 kin 코어 둘레에 이웃이 쌓여 큰 안정 조직으로. 굶거나 kin 흩어지면 풀림(가역). 0 = step-0022(정착 없음).' },
        { kind: 'slider', id: 'kAnchor', label: 'kAnchor', param: 'kAnchor', min: 0, max: 1, step: 1, def: 1, fixed: 0, gateBy: 'anchorc', gateOff: 0, title: '정착 마스터(0/1). 1 = 정착 on. 위치만 — 운동 skip 일 뿐 m·E·R 거래 0(장부 불변).' },
        { kind: 'slider', id: 'anchorM', label: '정착 m문턱', param: 'anchorM', min: 0.2, max: 1.2, step: 0.05, def: 0.6, fixed: 2, title: '잘 먹음 문턱 — m 이 이 값 이상이라야 고착(굶주리면 풀려 먹이를 찾아 떠난다, 자기 보호). mSeed 위·mDiv 아래.' },
        { kind: 'slider', id: 'anchorKin', label: '정착 kin문턱', param: 'anchorKin', min: 1, max: 4, step: 1, def: 2, fixed: 0, title: 'kin 포위 문턱 — 같은 태그 4-근방이 이 수 이상이라야 고착(외톨이는 정착 안 함 — 조직의 일부일 때만 자리를 지킨다).' }
      ]},
      { items: [
        { kind: 'check', id: 'germc', label: '생식세포 계통 격리(germ/soma 불가역)', def: true, gateFor: 'kGermline', title: '각 생명이 *위치 무관*하게 한 번 fate 를 받는다(불가역) — soma 계통은 제 잉여를 germ kin 에게 전량 export(번식이 germ 전용 = Weismann, step-0022). 0 = step-0021.' },
        { kind: 'slider', id: 'kGermline', label: 'kGermline', param: 'kGermline', min: 0, max: 1, step: 0.05, def: 0.3, fixed: 2, gateBy: 'germc', gateOff: 0, title: 'soma 계통 할당 비율(0~1).' }
      ]},
      { items: [
        { kind: 'check', id: 'diffc', label: '세포 분화(위치 soma/germ)', def: true, gateFor: 'kDiff', title: '같은 genotype 이 *위치*로 갈린다(step-0021) — 갇힌 내부는 soma, 표면은 germ. 0 = step-0020.' },
        { kind: 'slider', id: 'kDiff', label: 'kDiff', param: 'kDiff', min: 0, max: 1, step: 0.05, def: 0.3, fixed: 2, gateBy: 'diffc', gateOff: 0, title: '위치 분화 기부 강도(0~1). 갇힌 내부 soma 가 표면 kin germ 에게 기부(m→m).' }
      ]},
      { items: [
        { kind: 'check', id: 'publicc', label: '공공재 협동(시너지 b≫c)', def: true, gateFor: 'kPublic', title: '협동자가 잉여를 기부해 kin 여럿에게 나눠 주되 시너지로 증폭(step-0020). 0 = step-0019.' },
        { kind: 'slider', id: 'kPublic', label: 'kPublic', param: 'kPublic', min: 0, max: 1, step: 0.05, def: 0.3, fixed: 2, gateBy: 'publicc', gateOff: 0, title: '공공재 기부 강도(0~1).' },
        { kind: 'slider', id: 'pubSynergy', label: '시너지 b/c', param: 'pubSynergy', min: 1, max: 4, step: 0.1, def: 2.0, fixed: 1, title: '시너지 배수(>1 이라야 양의 합).' }
      ]},
      { items: [
        { kind: 'check', id: 'sharec', label: '생물량 공유(개체↔대사)', def: true, gateFor: 'kShare', title: '같은 유전형(kin) 4-인접 생명끼리 m 을 표적 구조로 공유(step-0019). 0 = step-0018.' },
        { kind: 'slider', id: 'kShare', label: 'kShare', param: 'kShare', min: 0, max: 1, step: 0.05, def: 0.5, fixed: 2, gateBy: 'sharec', gateOff: 0, title: 'kin m 구조 강도(0~1).' }
      ]},
      { items: [
        { kind: 'check', id: 'couplec', label: '막/flux 결합(개체↔도메인)', def: true, gateFor: 'kMembrane', title: '같은 유전형(kin) 4-인접 생명끼리 필드 E 를 공유·재분배 → 막 창발(step-0018). 0 = step-0017.' },
        { kind: 'slider', id: 'kMembrane', label: 'kMembrane', param: 'kMembrane', min: 0, max: 1, step: 0.05, def: 0.5, fixed: 2, gateBy: 'couplec', gateOff: 0, title: 'kin 쌍 E 균등화 강도(0~1).' }
      ]},
      { items: [
        { kind: 'check', id: 'adhesionc', label: '차등 응집(개체↔액적)', def: true, gateFor: 'kAdhesion', title: '같은 유전형(kin) 생명끼리 모이고 다른 태그는 밀어낸다(Steinberg DAH, step-0017) → 표면장력 액적(개체). 0 = step-0016.' },
        { kind: 'slider', id: 'kAdhesion', label: 'kAdhesion', param: 'kAdhesion', min: 0, max: 1, step: 1, def: 1, fixed: 0, gateBy: 'adhesionc', gateOff: 0 },
        { kind: 'slider', id: 'adhesionLambda', label: '이종 반발 λ', param: 'adhesionLambda', min: 0, max: 3, step: 0.1, def: 1.0, fixed: 1, title: '응집 점수 = kin − λ·타. 클수록 이종 분리가 날카롭다(표면장력↑).' },
        { kind: 'slider', id: 'adhesionGain', label: '이동 문턱 gain', param: 'adhesionGain', min: 0, max: 2, step: 0.1, def: 0.5, fixed: 1, title: '후보 칸 점수가 머무름보다 이만큼 커야 옮긴다(jitter 방지·안정 액적).' }
      ]},
      { items: [
        { kind: 'check', id: 'inheritc', label: '생명 유전(genotype↔대사)', def: true, gateFor: 'kInherit', title: '생명이 R-genotype 을 부트스트랩·분열 상속(±변이)하고, fit(태그)→대사세로 선택된다(step-0016). kin 을 정의해 응집·막·공유·공공재·분화·계통 격리·정착의 토대.' },
        { kind: 'slider', id: 'kInherit', label: 'kInherit', param: 'kInherit', min: 0, max: 1, step: 1, def: 1, fixed: 0, gateBy: 'inheritc', gateOff: 0 },
        { kind: 'slider', id: 'inheritMu', label: '생명 변이율 mu', param: 'inheritMu', min: 0, max: 0.1, step: 0.005, def: 0.01, fixed: 3, title: '분열 상속 복제오류율. 0 = 순수 클론 계통.' },
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
        { kind: 'select', id: 'click', label: '클릭 동작', role: 'click', options: [['lifegene', '유전 생명 놓기'], ['scatter', '흩어진 클론(정착 관찰)'], ['tissue', '클론 조직'], ['gene', '유전 씨앗(R)'], ['star', '별 점화'], ['life', '생명 놓기'], ['rock', '둑 쌓기(R)'], ['harvest', '수확']], def: 'lifegene' },
        { kind: 'button', id: 'seedScatter', label: '흩어진 클론(정착 관찰)', action: 'seedScatter' },
        { kind: 'button', id: 'seedTissue', label: '클론 조직', action: 'seedTissue' },
        { kind: 'button', id: 'seedStar', label: '별 씨앗 ×6', action: 'seedStars' },
        { kind: 'button', id: 'seedLife', label: '생명 ×5', action: 'seedLife' },
        { kind: 'button', id: 'kill', label: '생명 전멸', action: 'kill' }
      ]}
    ],

    /* 오버레이 — 유전형 R(태그별 색) + 활성도 A + 별 + *유전 생명*(태그색 점·계통 fate: soma 고리·germ 점) + *개체 윤곽* + *정착 표시*(고착 생명에 청록 사각 테두리). */
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
      /* 개체 윤곽 — 같은 유전형 4-인접 생명 쌍을 선으로 잇는다(연결 성분 = 표면장력 액적 = flux 결합 도메인). */
      var ag = sim.agents, occ = {};
      for (var k0 = 0; k0 < ag.length; k0++) { occ[ag[k0].center] = ag[k0].g | 0; }
      ctx.lineWidth = Math.max(1, SCALE * 0.3);
      for (var k1 = 0; k1 < ag.length; k1++) {
        var ai = ag[k1], gg = ai.g; if (!gg) continue;
        var col2 = GENE_COL[gg], lx = (ai.x + 0.5) * SCALE, ly = (ai.y + 0.5) * SCALE;
        var rgt = ai.center - (ai.center % W) + (ai.x + 1) % W, dwn = ((ai.y + 1) % H) * W + ai.x;
        if (occ[rgt] === gg) { ctx.strokeStyle = 'rgba(' + col2[0] + ',' + col2[1] + ',' + col2[2] + ',0.6)'; ctx.beginPath(); ctx.moveTo(lx, ly); ctx.lineTo(((ai.x + 1) % W + 0.5) * SCALE, ly); ctx.stroke(); }
        if (occ[dwn] === gg) { ctx.strokeStyle = 'rgba(' + col2[0] + ',' + col2[1] + ',' + col2[2] + ',0.6)'; ctx.beginPath(); ctx.moveTo(lx, ly); ctx.lineTo(lx, ((ai.y + 1) % H + 0.5) * SCALE); ctx.stroke(); }
      }
      /* 정착 표시 — 고착(a.sessile=1)한 생명에 *청록 사각 테두리*(제자리에 못 박힘 = anchor). 큰 안정 조직의 코어가 청록 격자로 드러난다. */
      ctx.lineWidth = Math.max(1, SCALE * 0.16);
      for (var ks = 0; ks < ag.length; ks++) {
        var as = ag[ks]; if (!as.sessile) continue;
        ctx.strokeStyle = 'rgba(70,224,200,0.9)';
        ctx.strokeRect(as.x * SCALE + 0.5, as.y * SCALE + 0.5, SCALE - 1, SCALE - 1);
      }
      /* 유전 생명 점 — *계통 표시*(germline 켜졌으면): soma 계통(a.soma===1)은 작은 속 빈 점, germ 계통은 큰 채운 점. 미커밋/격리 off 면 위치 분화(0021)로 fallback. */
      var germOn = sim.p.kGermline !== 0;
      for (var k = 0; k < ag.length; k++) {
        var a2 = ag[k], col3 = GENE_COL[a2.g], lx2 = (a2.x + 0.5) * SCALE, ly2 = (a2.y + 0.5) * SCALE;
        var soma;
        if (germOn && a2.soma !== undefined) {              // 불가역 계통 fate(germline)
          soma = a2.soma === 1;
        } else {                                            // 위치 분화(0021) fallback — 4-근방 다 차면 soma
          var cx = a2.center, x2 = a2.x, occN = 0;
          if (occ[cx - x2 + (x2 + 1) % W] !== undefined) occN++;
          if (occ[cx - x2 + (x2 - 1 + W) % W] !== undefined) occN++;
          if (occ[((a2.y + 1) % H) * W + x2] !== undefined) occN++;
          if (occ[((a2.y - 1 + H) % H) * W + x2] !== undefined) occN++;
          soma = occN >= 4;
        }
        var cstr = col3 ? col3[0] + ',' + col3[1] + ',' + col3[2] : '245,245,245';
        if (soma) {   // soma(체세포·번식 안 함) — 작은 속 빈 고리
          ctx.strokeStyle = 'rgba(' + cstr + ',0.85)'; ctx.lineWidth = Math.max(1, SCALE * 0.18);
          ctx.beginPath(); ctx.arc(lx2, ly2, Math.max(1.2, SCALE * 0.24), 0, 6.2832); ctx.stroke();
        } else {      // germ(생식세포) — 큰 채운 점
          ctx.fillStyle = 'rgba(' + cstr + ',0.95)';
          ctx.beginPath(); ctx.arc(lx2, ly2, Math.max(1.8, SCALE * 0.36), 0, 6.2832); ctx.fill();
        }
      }
    },

    stats: [
      { label: 'tick', get: function (c) { return String(c.sim.tick); } },
      { label: 'sumE', get: function (c) { return c.m.sumE.toFixed(2); } },
      { label: '<span style="color:#46e0c8">표면장력</span> (속/경계 E비 / flux)', get: function (c) { var d = window.HWS_SIM.measureRoundness(c.sim); return d.tagged ? (d.coreRatio.toFixed(2) + ' / ' + (c.sim.tensionFlux || 0).toFixed(0)) : '—'; } },
      { label: '<span style="color:#46e0c8">정착</span> (고착 / 비율)', get: function (c) { var d = window.HWS_SIM.measureAnchor(c.sim); return d.tagged ? (d.sessile + ' / ' + d.sessileFrac.toFixed(2)) : '—'; } },
      { label: '<span style="color:#46e0c8">갇힌 내부</span> (수 / 비율)', get: function (c) { var d = window.HWS_SIM.measureAnchor(c.sim); return d.tagged ? (d.interior + ' / ' + d.interiorFrac.toFixed(2)) : '—'; } },
      { label: '<span style="color:#78c860">개체</span> (수 / 평균 / 최대 세포)', get: function (c) { var o = window.HWS_SIM.measureOrganisms(c.sim); return o.nOrg + ' / ' + o.meanSize.toFixed(1) + ' / ' + o.maxSize; } },
      { label: '<span style="color:#e0c060">계통</span> (soma / germ)', get: function (c) { var d = window.HWS_SIM.measureGermline(c.sim); return d.committed ? (d.soma + ' / ' + d.germ) : '—'; } },
      { label: '생명 유전형 (점유 / 변이)', get: function (c) { var s = c.sim, gs = lifeGeneStat(s); return gs.total + ' / ' + (s.inheritMut || 0); } },
      { label: '별 <span style="color:#ff9a3c">living</span>/<span style="color:#fff7d2">burning</span>/<span style="color:#aab">ash</span>', get: function (c) { var k = stateCounts(c.sim); return k[0] + ' / ' + k[1] + ' / ' + k[2]; } },
      { label: '<span class="pool">고임</span> / <span class="life">개체수</span> / M', get: function (c) { return c.pools.length + ' / ' + c.sim.agents.length + ' / ' + c.led.biomass.toFixed(2); } },
      { label: '누적 출생 / 사망 / <span style="color:#46e0c8">분화 provision</span>', get: function (c) { return c.sim.births + ' / ' + c.sim.deaths + ' / ' + (c.sim.differentiated || 0).toFixed(0); } },
      { label: '장부 잔차', get: function (c) { var r = c.led.residual; return { text: r.toExponential(3) + (r < 1e-6 ? ' PASS' : ' FAIL'), cls: r < 1e-6 ? 'pass' : 'fail' }; } }
    ],

    legend:
      '<span style="color:#e86060">●</span>tag1 <span style="color:#78c860">●</span>tag2 <span style="color:#60a8e8">●</span>tag3 <span style="color:#c870e0">●</span>tag4 — 유전 생명(●germ ○soma) &nbsp; <span style="color:#46e0c8">▢</span>정착(고착) &nbsp; <span style="color:#c89b6a">■</span>R &nbsp; <span style="color:#57e0c8">■</span>활성도 A &nbsp; <span style="color:#fff7d2">★</span>별<br>' +
      '<b>곡률 기반 표면장력(R2)</b>: 형태 사다리 R1(응집+막, 0017·0018)이 개체를 *표면장력 액적*으로 빚어 막을 바닥 E 필드에 새겼다. *position* 곡률은 응집(차등접착=표면장력)과 redundant 라(정직한 발견), R2 는 *바닥 필드 E* 에 산다 — 이 step 은 *E-막에 Young-Laplace 표면장력*을 더한다(막을 경계 곡률로 편향): couple(R1)의 균등화 위에 곡률 구배를 얹어 *볼록 경계의 E 를 오목/속으로* 민다(ΔP=γκ) → 액적의 E-형태가 둥근 돔으로. "클론 조직" 을 깔고 보라.<br>' +
      '<b>막 둥글림</b>: <code>verify tension</code>(rounding 아레나) — 볼록 경계 E 1.93→1.62(곡률 큰 경계의 E 가 속으로 밀려 식는다 = 표면장력)·속/경계 E비 0.22→0.26(속이 차오름)·곡률 E flux ~4437. 곡률은 author 아닌 *측정/창발*(kin coordination 국소 법칙만 깖). E 쌍 거래(볼록→오목, 나간 만큼 들어옴 — 보존)라 churn 을 안 깬다(<code>verify sustain</code>·잔차 &lt;1e-6 <span class="pass">PASS</span>). <i>전체 스택은 희소(carrying capacity)라 큰 막이 드물어 곡률이 약하게 켜진다 — 현상은 rounding 아레나에서.</i> "곡률 표면장력" 체크를 끄면 step-0023 으로.',

    actions: {
      seedScatter: function (api) {
        var s = api.sim, n = 0;
        for (var y = 18; y < 46; y += 3) for (var x = 18; x < 46; x += 3) { var a = api.core.spawnAgent(s, x, y); a.g = 1; n++; }
        api.toast('흩어진 클론 ' + n + '세포(tag1) — 정착 on 이면 잘 먹은 kin 코어가 고착(청록 사각)해 큰 안정 조직으로 모인다. off 면 흩어진 채');
      },
      seedTissue: function (api) {
        var s = api.sim, n = 0;
        for (var y = 26; y < 38; y++) for (var x = 26; x < 38; x++) { var a = api.core.spawnAgent(s, x, y); a.g = 1; n++; }
        api.toast('클론 조직 ' + n + '세포(tag1) — 잘 먹은 kin-포위 세포가 고착(정착)해 조직이 안정된다');
      },
      seedStars: function (api) { for (var i = 0; i < 6; i++) api.core.spawnStar(api.sim, (i * 53) % api.sim.p.W, (i * 29) % api.sim.p.H); api.toast('별 ×6 점화'); },
      seedLife: function (api) { var pools = api.core.detectPools(api.sim, { minE: 1.5, prom: 0.3 }), n = Math.min(5, pools.length); for (var i = 0; i < n; i++) api.core.spawnAgent(api.sim, pools[i].x, pools[i].y); api.toast(n ? ('강한 고임 ' + n + '곳에 생명') : '놓을 고임이 없다 — 별을 켜세요'); },
      kill: function (api) { var ag = api.sim.agents; for (var i = 0; i < ag.length; i++) { api.sim.E[ag[i].center] += ag[i].m; api.sim.deaths++; } api.sim.agents = []; api.toast('생명 전멸(장부 유지)'); }
    },

    clickModes: {
      lifegene: function (api, cx, cy) { var tag = 1 + ((api.sim.tick + cx + cy) % api.sim.p.geneTypes), a = api.core.spawnAgent(api.sim, cx, cy); a.g = tag; api.toast('유전 생명 (' + cx + ',' + cy + ') tag ' + tag + ' — kin 끼리 응집·정착해 큰 안정 조직으로'); },
      scatter: function (api, cx, cy) { var s = api.sim, n = 0; for (var y = cy - 9; y < cy + 9; y += 3) for (var x = cx - 9; x < cx + 9; x += 3) { var a = api.core.spawnAgent(s, x, y); a.g = 1; n++; } api.toast('흩어진 클론 ' + n + '세포 (' + cx + ',' + cy + ') — 정착이 고착시켜 큰 안정 조직으로 모은다'); },
      tissue: function (api, cx, cy) { var s = api.sim, n = 0; for (var y = cy - 5; y < cy + 5; y++) for (var x = cx - 5; x < cx + 5; x++) { var a = api.core.spawnAgent(s, x, y); a.g = 1; n++; } api.toast('클론 조직 ' + n + '세포 (' + cx + ',' + cy + ') — 잘 먹은 kin-포위 세포가 정착(고착)'); },
      gene: function (api, cx, cy) { var tag = 1 + ((api.sim.tick + cx + cy) % api.sim.p.geneTypes); api.core.spawnGene(api.sim, cx, cy, 1, tag, 1.0); api.toast('유전 씨앗 R (' + cx + ',' + cy + ') tag ' + tag); },
      star: function (api, cx, cy) { var s = api.core.spawnStar(api.sim, cx, cy); api.toast('별 점화 (' + cx + ',' + cy + ') 연료 ' + s.fuel.toFixed(0)); },
      life: function (api, cx, cy) { var a = api.core.spawnAgent(api.sim, cx, cy); api.toast('생명 출생 (' + cx + ',' + cy + ') m ' + a.m.toFixed(2)); },
      harvest: function (api, cx, cy) { var rm = api.core.harvest(api.sim, cx, cy, 3); api.toast('수확 −' + rm.toFixed(1) + ' E → sunk'); },
      rock: function (api, cx, cy) { var added = api.core.paintStore(api.sim, cx, cy, 2, 5); api.toast('둑 쌓기 +' + added.toFixed(0) + ' R(무유전)'); }
    }
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = panel;
  else global.HWS_PANEL_0024 = panel;
})(typeof window !== 'undefined' ? window : globalThis);
