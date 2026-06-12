/* step-0040 패널 — 전체 에너지 고리 폐합(VOXEL.md V5+ *통합* — 0037 별빛→비→바다 위에 결정화+지지[기존 부품]을 합성). 직전 step-0039(잔해→씨앗) 패널을 잇되 *법칙 무변경 통합*이라 새 노브 없이 데모 프리셋만 이 가설로 갱신했다.
 * 이 step 은 hws-laws.js 를 *건드리지 않는다* — 이미 검증된 부품(별 일생 ignite·중력 gravity·결정화 crystallize·지지 게이트)을 *합성*해 둘만으론 안 나는 제3의 현상(바다가 지면/씨앗으로 굳어 다음 별을 키운다)을 창발시키는 통합 step 이다. 통합 게이트 = 기존 노브 kCryst(+kSupport).
 * 완성하는 그림: 별이 z=0(R 핵)서 나→천장까지 뜨고(0035)→연료 쇠해 도로 지고(0036)→진 별빛이 중력으로 z=0 바다로 고이고(0037)→그 바다 E 가 결정화로 R(지면/씨앗)로 굳어(0008·0032 지지)→R 이 ignThresh 넘으면 새 별이 거기서 점화(0011) = E→별→비→바다→지면→새 별 *완전 self-running 폐합*. 세계가 제 별빛으로 다음 별의 씨앗밭을 키운다.
 * 회귀(이중 가드): kCryst=0 이면 결정화 skip(바다가 안 굳음=0037 비트 동일) / D=1 이면 별 z-궤적 무(별빛 비 경로 자체가 2D 레거시 불변). 3D 뷰는 아직 z=0 평면 하이트필드 — voxel 렌더(L-V1)는 렌더러 트랙(RENDER-STATE.md). 브라우저: window.HWS_PANEL_0040
 * (아래 표준 스택·통계는 step-0027 덴드라이트 그대로 — 에너지 고리 폐합은 그 동역학과 직교.) */
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

  /* ── 데모(프리셋) — 전체 에너지 고리 폐합 아레나: verify.js cycleArena()/rainArena()/seedSunCore() 와 *같은* 설정.
   *   기본 패널은 회귀 상태(D=1·결정화 off)로 열려 직전 step 과 화면이 같다 → "뭘 더했는지" 안 보임.
   *   이 아레나(D=8 voxel·z=0 R 핵서 별 점화·부력·하강·중력 비 on)에 *결정화+지지*를 켜고/끄고 두 프리셋으로 A/B 대조한다 — 화면이 보여주는 것 =
   *   verify 가 단언하는 수치(바다→지면/씨앗 결정화·점화 자리 ≫13)가 되게. 결정화 ON 이면 별빛이 비로 z=0 바다에 고였다가 R 지면/씨앗으로 굳어 씨앗밭이 넓어진다(R 점이 z=0 에 퍼진다). */
  function cycleArena(kC) {
    return {
      D: 8, initE: 0, noise: 0, drive: false,
      source: { x: 0, y: 0, r: 0, rate: 0 }, sink: { x: 0, y: 0, r: 0, rate: 0 },
      kD: 0, kDz: 0, kEvap: 0, kA: 0, baseCost: 0, life: false, repro: false, move: false,
      kIgnite: 1, kStarRise: 1, kStarFall: 1, starFallThresh: 0.5, kStarSet: 0, starRate: 0.06, starFuel0: 500, ignThresh: 1.5, starCap: 3, starGap: 6, starR: 2, starDriftPeriod: 20,
      kGravity: 0.2, kFSM: 0, kCollapse: 0, kCryst: kC, crystThresh: 2.0, kSupport: 1, supportThresh: 0.5, kWeather: 0, kOcclude: 0,
      kCrowd: 0, kRelief: 0, kFlux: 0, kTemplate: 0, kInherit: 0, inheritCost: 0,
      kShare: 0, kPublic: 0, kDiff: 0, kGermline: 0, kAnchor: 0, kTension: 0, kMembrane: 0, kAdhesion: 0, kAniso: 0, kTuring: 0, kDendrite: 0, kPermeate: 0
    };
  }
  function seedSunCore(sim, core) {   // z=0 정적 R 핵(점화 신호 — 첫 별이 여기서 난다·이후엔 결정화 지면/씨앗서도) — verify.js seedSunCore 와 동일(반경 2·값 2.0·E0 산입)
    var W = sim.p.W, H = sim.p.H, disc = core.discCells(W, H, (W / 2) | 0, (H / 2) | 0, 2);
    for (var k = 0; k < disc.length; k++) { sim.R[disc[k]] += 2.0; sim.E0 += 2.0; }
  }

  var panel = {
    coreGlobal: 'HWS_SIM',
    title: 'HWS step-0040 — <span style="color:#ffd060">전체 에너지 고리 폐합</span>: 바다가 지면/씨앗으로 굳어 세계가 제 별빛으로 다음 별을 키운다 = 완전 self-running(VOXEL.md V5+ 통합)',
    subtitle: 'step-0037 은 진 별빛을 중력으로 z=0 <b>바다</b>(고인 E)에 고이게 했으나 거기서 멈췄다. 이 step 은 그 고리를 끝까지 닫는다 — 이미 검증된 부품 넷(별 일생 <code>ignite</code>·중력 <code>gravity</code>·결정화 <code>crystallize</code>·지지 게이트)을 <b>합성</b>해, <b>바다 E 가 z=0 에서 R(지면/씨앗)로 굳고 그 R 이 점화 문턱을 넘어 새 별을 키운다</b>. 이 step 은 <b>hws-laws.js 를 안 건드린다</b>(법칙 무변경 통합 — 0037 과 같은 정신): 통합 게이트 = 기존 노브 <b>kCryst</b>(+kSupport). 完成: 별이 나→뜨고→지고→진 별빛이 비로 z=0 바다로(0037)→그 바다 E 가 결정화로 <b>R 지면/씨앗</b>으로 굳어(0008·0032)→R 이 ignThresh 넘으면 <b>새 별이 거기서 점화</b>(0011) → <b>E→별→비→바다→지면→새 별</b> = "스스로 굴러가는 세계"의 에너지 순환 *완전 폐합*. 세계가 처음 놓은 작은 씨앗(13칸)에 더는 기대지 않고 <b>제 별빛으로 씨앗밭(150칸+)을 키운다</b>. <b>kCryst=0 이면 결정화 skip(바다가 안 굳음=0037 비트 동일) / D=1 이면 별 z-궤적 무(별빛 비 경로 자체가 2D 레거시 불변)</b>(회귀 0·이중 가드). 검증: <b>결정화 off 면 결정화량 0·점화 자리 13칸뿐 → on 이면 바다→R 결정화 ~1210·maxR ~25(≫ ignThresh 1.5)·점화 자리 ~150칸</b>·잔차 3.2e-14·결정론. <code>node step-0040/verify.js</code> 로 reg·cycle·conserve·det. (표준 스택은 step-0027 덴드라이트 그대로 — 에너지 고리 폐합과 직교.)',
    overlays: { sourceSink: false, pools: true, life: true, centroid: true, sparkline: true },
    poolOpts: { minE: 1.5, prom: 0.3 },

    /* 데모 프리셋 — 이 step 이 합성한 전체 에너지 고리 폐합을 한 클릭으로 보이는 설정(verify cycle 과 동일 아레나)으로. 둘 다 별 상승·하강·중력 비 on(별빛이 바다로) — *결정화+지지*만 토글. */
    presets: [
      { label: '🌍 에너지 고리 폐합 ON (바다→지면/씨앗·D=8)',
        title: 'verify cycle(on) 과 같은 설정: D=8 아레나·z=0 R 핵서 별 점화·kStarRise=1·kStarFall=1·중력비 kGravity=0.2·*결정화 kCryst=0.05+지지 kSupport=1*, 500 tick 미리 진행. 진 별빛이 비로 z=0 바다에 고였다가 R 지면/씨앗으로 굳는다(결정화 ~1210·maxR ~25). 통계 "점화 자리(z=0 R≥문턱)" 이 13칸(처음 씨앗)→~150칸이면 세계가 제 씨앗밭을 키운 것 = verify 가 단언하는 수치(R 점이 z=0 에 퍼진다). (3D 뷰는 아직 z=0 평면만 — voxel 렌즈 L-V1 백로그. 수치가 증거.)',
        params: cycleArena(0.05), seed: seedSunCore, run: 500,
        note: '고리 폐합 ON — "점화 자리"≈150칸(바다가 R 지면/씨앗으로 굳어 씨앗밭↑). OFF 버튼과 번갈아 보라.' },
      { label: '💧 결정화 OFF (=0037·바다만·대조)',
        title: 'verify cycle(off) 과 같은 설정: 같은 아레나·핵·별·중력비지만 kCryst=0(=0037 별빛→비→바다). 바다가 z=0 에 고이기만 하고 안 굳는다(결정화 0·점화 자리 = 처음 놓은 씨앗 13칸 그대로). ON 버튼과 번갈아 눌러 A/B 로 비교하면 바다→지면/씨앗 폐합이 또렷하다.',
        params: cycleArena(0), seed: seedSunCore, run: 500,
        note: '결정화 OFF(대조·=0037) — "점화 자리"=13칸(바다만·안 굳음). ON 버튼과 번갈아 눌러 고리 폐합을 보라.' }
    ],

    controls: [
      { items: [
        { kind: 'check', id: 'drive', label: '외부 source', param: 'drive', def: false, title: '고정 외부 source(step-0007). 기본 off — 별이 내생 구동.' },
        { kind: 'check', id: 'auto', label: '자동 명암', def: true, view: true, title: '화면 밝기를 현재 최대 E 에 맞춰 정규화' }
      ]},
      { items: [
        { kind: 'slider', id: 'D', label: '터 깊이 D (voxel)', param: 'D', min: 1, max: 8, step: 1, def: 1, fixed: 0, title: '시뮬 공간 깊이(z). 1 = 기존 2D(비트 동일). >1 = voxel 상자(W×H×D). *리셋 시 적용*되는 구조 노브. D>1 + kDz>0 이라야 z 확산으로 상위 평면이 산다. 3D 뷰는 아직 z=0 평면 하이트필드(voxel 렌더는 렌더러 트랙).' },
        { kind: 'check', id: 'zdiffc', label: 'z 확산(6-이웃 — 상위 평면 깨움)', def: false, gateFor: 'kDz', title: 'step-0030 V2: 확산 stencil 을 4-이웃→6-이웃으로(z 항). z=0 평면 E 가 z 로 퍼져 상위 평면이 산다. 끄면(kDz=0) V1 — 상위 평면 불활성. ⚠ z 항은 *선형 확산 경로*(kRelief=0)에만 있다 — 아래 "무대(기복)"가 켜져 있으면(기본 on) z 확산이 무효다(기복 경로는 z=0 평면 전용, 3D 수직은 V3 중력). z 확산을 보려면 무대를 끄고 D>1 로 리셋하라.' },
        { kind: 'slider', id: 'kDz', label: 'kDz (z 확산 계수)', param: 'kDz', min: 0, max: 0.25, step: 0.01, def: 0.15, fixed: 2, gateBy: 'zdiffc', gateOff: 0, title: 'z 확산 계수(상하 이웃). 0 또는 D=1 이면 z 항 산술 0 = 회귀(직전 step 비트 동일). kDz=kD 면 등방. 안정: 4·kD+2·kDz ≤ 1. *리셋 불필요* — 즉시 적용. ⚠ "무대(기복)"가 켜져 있으면 무효(기복 경로엔 z 항 없음 — 무대를 끄라).' }
      ]},
      { items: [
        { kind: 'check', id: 'gravityc', label: '중력(E 하향 침전 — 바다 원형)', def: false, gateFor: 'kGravity', title: 'step-0031 V3: 각 셀이 제 E 의 kGravity 비율을 아래(z−1) 이웃으로 유출(donor-제한 쌍 거래). V2 의 등방 z 확산과 달리 *아래만* 선호 → E 가 z=0 바닥부터 고인다 = 바다. 끄면(kGravity=0) V2. D>1 로 리셋해야 z 이웃이 생긴다. 무대(기복)와 무관(중력은 전 z 평면을 직접 처리).' },
        { kind: 'slider', id: 'kGravity', label: 'kGravity (중력 계수)', param: 'kGravity', min: 0, max: 0.5, step: 0.02, def: 0.2, fixed: 2, gateBy: 'gravityc', gateOff: 0, title: '중력 계수(셀당/tick 하향 유출 비율). 0 또는 D=1 이면 gravity 산술 0 = 회귀. 클수록 빨리 침전. *리셋 불필요* — 즉시 적용.' }
      ]},
      { items: [
        { kind: 'check', id: 'supportc', label: '지지 침착(지면 바닥부터 — 공중 바위 차단)', def: false, gateFor: 'kSupport', title: 'step-0032 V4: crystallize 의 E→R 침착을 *지지 있는 칸*(z=0 바닥 또는 아래 R≥문턱)으로 게이트. 켜면 결정화가 W×H×D 전 평면으로 일반화되되 공중 바위(부유 R)를 막고 지면이 바닥부터 쌓인다. 끄면(kSupport=0) z=0 평면 결정화(step-0031). D>1 로 리셋해야 3D 침착이 산다. 결정화(아래)가 켜져 있어야 보인다.' },
        { kind: 'slider', id: 'kSupport', label: 'kSupport (지지 게이트 0/1)', param: 'kSupport', min: 0, max: 1, step: 1, def: 0, fixed: 0, gateBy: 'supportc', gateOff: 0, title: '지지 침착 마스터(0/1). 0 또는 D=1 이면 게이트 무효(z=0 평면) = 회귀(직전 step 비트 동일). 1 = on(3D 침착 + 지지 게이트). 침착 위치만 거름 — 장부·결정론 무관.' },
        { kind: 'slider', id: 'supportThresh', label: '지지 문턱', param: 'supportThresh', min: 0, max: 2, step: 0.1, def: 0.5, fixed: 1, title: 'z>0 셀은 바로 아래 칸 R 이 이 값 이상이라야 침착. =0 이면 무게이트(모든 칸 지지 → 부유 R 발생, 대조). 클수록 지지 조건 엄격(지면이 더 단단히 다져진 뒤 위층 쌓임).' }
      ]},
      { items: [
        { kind: 'check', id: 'occludec', label: 'R 차폐(E 가 지면 위에 고임 — 바다가 지면 위)', def: false, gateFor: 'kOcclude', title: 'step-0033 V5: gravity 가 아래(z−1) 칸으로 E 를 밀기 전, 그 칸 R≥occludeThresh(고체 지면)면 하향 유출을 차단 → E 가 못 내려가 지면 위에 고인다(옆 우회는 확산). 끄면(kOcclude=0) V3 순수 하향(E 가 지면 통과). D>1 + 중력 켜야 보인다. 결정화/지지 침착이 만든 지면이 있어야 막을 게 생긴다.' },
        { kind: 'slider', id: 'kOcclude', label: 'kOcclude (R 차폐 0/1)', param: 'kOcclude', min: 0, max: 1, step: 1, def: 0, fixed: 0, gateBy: 'occludec', gateOff: 0, title: 'R 차폐 마스터(0/1). 0 또는 D=1 이면 무효(gravity 가 V3 순수 하향/z 벽 early-return) = 회귀(직전 step 비트 동일). 1 = on(아래 고체면 하향 차단). 차폐 판정만 — 양 안 바꿈, 장부·결정론 무관.' },
        { kind: 'slider', id: 'occludeThresh', label: '차폐 문턱', param: 'occludeThresh', min: 0, max: 2, step: 0.1, def: 0.5, fixed: 1, title: '아래 칸 R 이 이 값 이상이면 하향 유출 차단(지면=고체). 빈칸(R=0)은 통과. =0 으로 내리면 빈칸도 차단(중력 무효 — 대조용 극단). 클수록 단단히 굳은 지면만 막음.' }
      ]},
      { items: [
        { kind: 'check', id: 'collapsec', label: '부유 R 붕괴(공중 바위가 아래로 무너짐 — R 의 중력)', def: false, gateFor: 'kCollapse', title: 'step-0034 V5+: 새 법칙 collapse(gravity 뒤). 각 셀(z≥1)이 아래(z−1) 칸 R<collapseThresh(비지지)면 제 R 의 kCollapse 비율을 아래로 떨군다(R↔R 쌍 거래). 아래가 고체(R≥문턱)면 안착 → R 이 바닥부터 쌓인다. V4 지지 침착(정적·R 이 생길 때 막음)의 동역학 짝 — 이미 떠 있는 R 을 무너뜨린다. 끄면(kCollapse=0) 직전 step. D>1 로 리셋해야 z 이웃이 생긴다.' },
        { kind: 'slider', id: 'kCollapse', label: 'kCollapse (붕괴율)', param: 'kCollapse', min: 0, max: 1, step: 0.05, def: 0.2, fixed: 2, gateBy: 'collapsec', gateOff: 0, title: '부유 R 붕괴율(셀당/tick 하향 낙하 비율). 0 또는 D=1 이면 collapse 통째/z 벽 early-return = 회귀(직전 step 비트 동일). 클수록 빨리 무너짐. R↔R 쌍 거래라 총 R 보존(장부 무관). *리셋 불필요* — 즉시 적용.' },
        { kind: 'slider', id: 'collapseThresh', label: '붕괴 지지 문턱', param: 'collapseThresh', min: 0, max: 2, step: 0.1, def: 0.5, fixed: 1, title: '아래 칸 R 이 이 값 *미만*이면 비지지(떨어짐), 이상이면 지지(안착). 지지/차폐 문턱과 같은 척도(고체 R 기준 통일). 클수록 더 단단한 지면이라야 R 이 멈춘다(R 이 더 높이 쌓임).' }
      ]},
      { items: [
        { kind: 'check', id: 'dendritec', label: '가지치기 덴드라이트(전선 경계 불안정→옆가지)', def: true, gateFor: 'kDendrite', title: '자라는 결정 전선에 Mullins-Sekerka 경계 불안정(곡률 증폭 + 기하 차폐)을 얹어 *옆가지*(눈송이/금속 덴드라이트). 둘째 필드 없이 E·R 만. R 하이트필드에 *가지*. 0 = step-0026.' },
        { kind: 'slider', id: 'kDendrite', label: 'kDendrite', param: 'kDendrite', min: 0, max: 1, step: 1, def: 1, fixed: 0, gateBy: 'dendritec', gateOff: 0, title: '덴드라이트 마스터(0/1). 1 = on. 전선 셀 안 E→R 쌍 거래(결정화/복제와 같은 경계)라 장부 불변.' },
        { kind: 'slider', id: 'dendRate', label: '침착속도', param: 'dendRate', min: 0.02, max: 0.2, step: 0.01, def: 0.06, fixed: 2, title: '전선 셀 E→R 침착량 계수(=dendRate·E·곡률증폭). E≥dendRate 라야 자란다(기질 문턱). 작을수록 점진(가는 가지).' },
        { kind: 'slider', id: 'dendThresh', label: '고체 문턱', param: 'dendThresh', min: 0.2, max: 1.0, step: 0.05, def: 0.5, fixed: 2, title: 'R≥이 값이면 결정(고체), 미만이면 성장 전선 후보. 침착 누적이 이 값 넘으면 전선 한 겹 전진.' },
        { kind: 'slider', id: 'dendSharp', label: '곡률 증폭', param: 'dendSharp', min: 0, max: 4, step: 0.25, def: 1.0, fixed: 2, title: 'Mullins-Sekerka 곡률 증폭(=1+dendSharp·(3−고체8)). 볼록 tip 가속·오목 notch 억제. 0 = 무증폭(차폐만 → 컴팩트 덩이)·>0 = tip 가속(또렷한 옆가지)·클수록 가늘고 잦은 가지.' }
      ]},
      { items: [
        { kind: 'check', id: 'turingc', label: '튜링 불안정(균일→반점/줄무늬)', def: true, gateFor: 'kTuring', title: '비확산 R 자기촉매(짧은 활성) + 확산 E(긴 억제)가 *균일을 깨* 반점/줄무늬(step-0026). 0 = step-0025.' },
        { kind: 'slider', id: 'kTuring', label: 'kTuring', param: 'kTuring', min: 0, max: 1, step: 1, def: 1, fixed: 0, gateBy: 'turingc', gateOff: 0, title: '튜링 마스터(0/1). 셀별 E↔R 쌍 거래라 장부 불변.' },
        { kind: 'slider', id: 'turRate', label: '반응속도', param: 'turRate', min: 0.05, max: 1.0, step: 0.05, def: 0.3, fixed: 2, title: 'E→R 자기촉매·R→E 붕괴 속도(전체 스택은 너무 크면 R sink 가 E 를 굶김).' },
        { kind: 'slider', id: 'turSat', label: '활성 포화', param: 'turSat', min: 1.0, max: 6.0, step: 0.5, def: 2.5, fixed: 1, title: '자기촉매 포화 — 큰 R 은 되녹음(무한 sink 금지).' }
      ]},
      { items: [
        { kind: 'check', id: 'anisoc', label: '방향성 결정화(genotype→결정축)', def: true, gateFor: 'kAniso', title: 'genotype 이 결정 성장 *방향*을 정한다 — 선호 축으로만 E→R 침착(step-0025). 0 = 등방 결정.' },
        { kind: 'slider', id: 'kAniso', label: 'kAniso', param: 'kAniso', min: 0, max: 1, step: 1, def: 1, fixed: 0, gateBy: 'anisoc', gateOff: 0, title: '방향성 결정화 마스터(0/1). E→R 쌍 거래라 장부 불변.' },
        { kind: 'slider', id: 'anisoRate', label: '침착량', param: 'anisoRate', min: 0.05, max: 0.6, step: 0.05, def: 0.3, fixed: 2, title: '선호 축 빈 이웃 칸당/tick E→R 침착량.' }
      ]},
      { items: [
        { kind: 'check', id: 'tensionc', label: '곡률 표면장력(막에 Young-Laplace)', def: true, gateFor: 'kTension', title: 'E-막에 곡률 구배를 얹는다(step-0024). 0 = step-0023.' },
        { kind: 'slider', id: 'kTension', label: 'kTension', param: 'kTension', min: 0, max: 1, step: 1, def: 1, fixed: 0, gateBy: 'tensionc', gateOff: 0, title: '곡률 표면장력 마스터(0/1). E 쌍 거래(볼록→오목)라 장부 불변.' },
        { kind: 'slider', id: 'tensionGamma', label: '표면장력 γ', param: 'tensionGamma', min: 0, max: 0.4, step: 0.02, def: 0.10, fixed: 2, title: '곡률 계수 γ.' }
      ]},
      { items: [
        { kind: 'check', id: 'anchorc', label: '정착 생활사(잘 먹은 kin-포위 → 고착)', def: true, gateFor: 'kAnchor', title: '잘 먹고 kin 에 둘러싸인 생명이 고착(step-0023). 0 = step-0022.' },
        { kind: 'slider', id: 'kAnchor', label: 'kAnchor', param: 'kAnchor', min: 0, max: 1, step: 1, def: 1, fixed: 0, gateBy: 'anchorc', gateOff: 0, title: '정착 마스터(0/1). 위치만 — 거래 0.' },
        { kind: 'slider', id: 'anchorM', label: '정착 m문턱', param: 'anchorM', min: 0.2, max: 1.2, step: 0.05, def: 0.6, fixed: 2 },
        { kind: 'slider', id: 'anchorKin', label: '정착 kin문턱', param: 'anchorKin', min: 1, max: 4, step: 1, def: 2, fixed: 0 }
      ]},
      { items: [
        { kind: 'check', id: 'germc', label: '생식세포 계통 격리(germ/soma 불가역)', def: true, gateFor: 'kGermline', title: '위치 무관 불가역 fate(Weismann, step-0022). 0 = step-0021.' },
        { kind: 'slider', id: 'kGermline', label: 'kGermline', param: 'kGermline', min: 0, max: 1, step: 0.05, def: 0.3, fixed: 2, gateBy: 'germc', gateOff: 0 }
      ]},
      { items: [
        { kind: 'check', id: 'diffc', label: '세포 분화(위치 soma/germ)', def: true, gateFor: 'kDiff', title: '같은 genotype 이 위치로 갈린다(step-0021). 0 = step-0020.' },
        { kind: 'slider', id: 'kDiff', label: 'kDiff', param: 'kDiff', min: 0, max: 1, step: 0.05, def: 0.3, fixed: 2, gateBy: 'diffc', gateOff: 0 }
      ]},
      { items: [
        { kind: 'check', id: 'publicc', label: '공공재 협동(시너지 b≫c)', def: true, gateFor: 'kPublic', title: '협동자가 기부해 kin 여럿에게 시너지로 증폭(step-0020). 0 = step-0019.' },
        { kind: 'slider', id: 'kPublic', label: 'kPublic', param: 'kPublic', min: 0, max: 1, step: 0.05, def: 0.3, fixed: 2, gateBy: 'publicc', gateOff: 0 },
        { kind: 'slider', id: 'pubSynergy', label: '시너지 b/c', param: 'pubSynergy', min: 1, max: 4, step: 0.1, def: 2.0, fixed: 1 }
      ]},
      { items: [
        { kind: 'check', id: 'sharec', label: '생물량 공유(개체↔대사)', def: true, gateFor: 'kShare', title: 'kin m 표적 구조(step-0019). 0 = step-0018.' },
        { kind: 'slider', id: 'kShare', label: 'kShare', param: 'kShare', min: 0, max: 1, step: 0.05, def: 0.5, fixed: 2, gateBy: 'sharec', gateOff: 0 }
      ]},
      { items: [
        { kind: 'check', id: 'couplec', label: '막/flux 결합(개체↔도메인)', def: true, gateFor: 'kMembrane', title: 'kin E 공유·재분배 → 막 창발(step-0018). 0 = step-0017.' },
        { kind: 'slider', id: 'kMembrane', label: 'kMembrane', param: 'kMembrane', min: 0, max: 1, step: 0.05, def: 0.5, fixed: 2, gateBy: 'couplec', gateOff: 0 }
      ]},
      { items: [
        { kind: 'check', id: 'adhesionc', label: '차등 응집(개체↔액적)', def: true, gateFor: 'kAdhesion', title: 'kin 끼리 모이고 타는 밀어낸다(Steinberg DAH, step-0017). 0 = step-0016.' },
        { kind: 'slider', id: 'kAdhesion', label: 'kAdhesion', param: 'kAdhesion', min: 0, max: 1, step: 1, def: 1, fixed: 0, gateBy: 'adhesionc', gateOff: 0 },
        { kind: 'slider', id: 'adhesionLambda', label: '이종 반발 λ', param: 'adhesionLambda', min: 0, max: 3, step: 0.1, def: 1.0, fixed: 1 },
        { kind: 'slider', id: 'adhesionGain', label: '이동 문턱 gain', param: 'adhesionGain', min: 0, max: 2, step: 0.1, def: 0.5, fixed: 1 }
      ]},
      { items: [
        { kind: 'check', id: 'inheritc', label: '생명 유전(genotype↔대사)', def: true, gateFor: 'kInherit', title: '생명이 R-genotype 부트스트랩·상속·표현형세(step-0016). kin 의 토대.' },
        { kind: 'slider', id: 'kInherit', label: 'kInherit', param: 'kInherit', min: 0, max: 1, step: 1, def: 1, fixed: 0, gateBy: 'inheritc', gateOff: 0 },
        { kind: 'slider', id: 'inheritMu', label: '생명 변이율 mu', param: 'inheritMu', min: 0, max: 0.1, step: 0.005, def: 0.01, fixed: 3 },
        { kind: 'slider', id: 'inheritCost', label: '표현형 결합', param: 'inheritCost', min: 0, max: 0.4, step: 0.01, def: 0.02, fixed: 2 }
      ]},
      { items: [
        { kind: 'check', id: 'templatec', label: '복제(R-주형)', def: true, gateFor: 'kTemplate', title: '유전형 R 주형이 이웃 E→R 을 등방 촉매·태그 복사(step-0015).' },
        { kind: 'slider', id: 'kTemplate', label: 'kTemplate', param: 'kTemplate', min: 0, max: 1, step: 1, def: 1, fixed: 0, gateBy: 'templatec', gateOff: 0 },
        { kind: 'slider', id: 'geneMu', label: 'R 변이율 mu', param: 'geneMu', min: 0, max: 0.1, step: 0.005, def: 0.01, fixed: 3 },
        { kind: 'slider', id: 'geneFitStep', label: '적합도 기울기', param: 'geneFitStep', min: 0, max: 0.3, step: 0.01, def: 0.15, fixed: 2 }
      ]},
      { items: [
        { kind: 'check', id: 'fluxc', label: '활성도 계량(flux)', def: true, gateFor: 'kFlux', title: '매 tick |dE/dt| 를 활성도 A 로 적분(step-0014, 읽기 전용).' },
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
        { kind: 'check', id: 'crowdc', label: '자기제한(밀도)', def: true, gateFor: 'kCrowd', title: '국소 밀도 → 추가 대사세 → carrying capacity(step-0012).' },
        { kind: 'slider', id: 'kCrowd', label: 'kCrowd', param: 'kCrowd', min: 0, max: 0.6, step: 0.02, def: 0.20, fixed: 2, gateBy: 'crowdc', gateOff: 0 }
      ]},
      { items: [
        { kind: 'check', id: 'ignite', label: '구동 내생화(별)', def: true, gateFor: 'kIgnite', title: 'R 누적 핵에서 별 점화·서행(step-0011). 0 = 별 없음.' },
        { kind: 'slider', id: 'kIgnite', label: 'kIgnite', param: 'kIgnite', min: 0, max: 1, step: 1, def: 1, fixed: 0, gateBy: 'ignite', gateOff: 0 },
        { kind: 'slider', id: 'starRate', label: '별 주입 rate', param: 'starRate', min: 0.02, max: 0.15, step: 0.01, def: 0.06, fixed: 2 },
        { kind: 'slider', id: 'ignThresh', label: '점화 문턱(R)', param: 'ignThresh', min: 0.5, max: 4, step: 0.1, def: 1.5, fixed: 1 },
        { kind: 'check', id: 'starrisec', label: '별 부력 상승(소산 극단이 떠오름 — 태양)', def: false, gateFor: 'kStarRise', title: 'step-0035 V5+: 점화한 별이 z=0(지면 R 핵)에서 태어나 매 tick 천장(z=D−1)까지 떠올라 제 z 의 3D ball 로 E 방출. 높이서 뿜은 E 를 중력(V3)이 비처럼 내린다=태양. step-0034 R 침강의 대칭(소산↑·저장↓ → 활성도 축이 연직축). 끄면(0) 별 z=0 서행만. D>1 로 리셋해야 z 가 생긴다.' },
        { kind: 'slider', id: 'kStarRise', label: 'kStarRise (부력 상승률)', param: 'kStarRise', min: 0, max: 3, step: 1, def: 1, fixed: 0, gateBy: 'starrisec', gateOff: 0, title: '별 부력 상승률(매 tick z 상승 칸수). 0 또는 D=1 이면 부력 무효(별 z 미설정·2D / 상승 0) = 회귀. 위치만 — 거래 0(장부 무관). *리셋 불필요* — 즉시 적용. 중력(V3)을 함께 켜면 高z E 가 아래로 비처럼 내린다.' },
        { kind: 'check', id: 'starfallc', label: '별 하강·일생(연료 쇠퇴 → 가라앉음 — 일몰)', def: false, gateFor: 'kStarFall', title: 'step-0036 V5+: 부력 = 활성도(연료)의 함수. 연료가 starFallThresh 분율 아래로 쇠한 *죽어가는* 별이 부력을 잃고 매 tick z 한 칸씩 가라앉으며(z=0 까지) 그 z 에서 계속 탄다 → 방출 E 가 하강 경로를 따라 내려간다 = 일몰. 부력 상승(kStarRise) 위에 얹힌다 — 떠오른 별만 진다. 끄면(0) 별이 천장에 머묾(0035). D>1·상승 on 으로 리셋해야 z 궤적이 생긴다.' },
        { kind: 'slider', id: 'kStarFall', label: 'kStarFall (하강 게이트 0/1)', param: 'kStarFall', min: 0, max: 1, step: 1, def: 0, fixed: 0, gateBy: 'starfallc', gateOff: 0, title: '별 하강 마스터(0/1). 0 또는 D=1 이면 무효(dying 늘 false·st.z=0 고정) = 회귀(직전 step 비트 동일). 1 = on(연료 쇠한 별이 가라앉음). 위치만 — 거래 0(장부 무관). *리셋 불필요* — 즉시 적용.' },
        { kind: 'slider', id: 'starFallThresh', label: '하강 개시 연료분율', param: 'starFallThresh', min: 0.1, max: 0.9, step: 0.05, def: 0.5, fixed: 2, title: '연료 < starFuel0·이 값 이면 부력 상실(죽어가는 별 → 하강). 0.5 = 절반 태우면 진다. 클수록 일찍 진다(prime 짧음)·작을수록 천장에 오래 머물다 늦게 진다.' },
        { kind: 'check', id: 'starsetc', label: '별 일몰사(지평선 닿으면 꺼짐 — 出沒生死)', def: false, gateFor: 'kStarSet', title: 'step-0038 V5+: 떠올랐다(st.rose) 다시 지는(dying) 별이 바닥(z=0, 지평선)에 닿으면 꺼진다(FSM off=즉시 제거·on=ash). 연료 남아도 *짐* 자체가 죽음 — 소산 극단이 저장 바닥에 안착=소산 정체성 상실. 빈 starCap 자리에 R 핵서 다음 별 점화 → 세대 순환. 끄면(0) 진 별이 z=0 서 계속 탐(0036). D>1·상승·하강 on 으로 리셋해야 궤적이 닫힌다.' },
        { kind: 'slider', id: 'kStarSet', label: 'kStarSet (일몰사 게이트 0/1)', param: 'kStarSet', min: 0, max: 1, step: 1, def: 0, fixed: 0, gateBy: 'starsetc', gateOff: 0, title: '별 일몰사 마스터(0/1). 0 이면 죽음·st.rose 미진입(0037 비트 동일). D=1·rise off 면 st.z 가 1 못 됨 → 죽음 미발생 = 회귀(직전 step 비트 동일). 1 = on(떴다 진 별이 z=0 닿으면 꺼짐). 위치/상태만 — 연료 F 는 장부 항 아님(보존 무관). *리셋 불필요* — 즉시 적용.' },
        { kind: 'check', id: 'ashseedc', label: '별 잔해→씨앗(진 별이 무덤에 R 남김 — 재구성)', def: false, gateFor: 'kAshSeed', title: 'step-0039 V5+: 일몰사(kStarSet)로 z=0 무덤에서 꺼지는 별이 미연소 외부 연료의 kAshSeed 분율을 그 자리 저장체 R 로 남긴다 = 다음 별의 점화 씨앗(出沒生死 → 잔해 → 재구성). SPINE 척도분리: 빠른 비가역 死 + 느린 저장 재구성 = 세계 척도 순환(별의 외부 질량이 세계 안 R 로 내생화). 끄면(0) 진 별이 흔적 없이 사라짐(0038). 일몰사(kStarSet) 위에 얹힌다 — 지는 별만 잔해를 남긴다.' },
        { kind: 'slider', id: 'kAshSeed', label: 'kAshSeed (잔해→씨앗 분율)', param: 'kAshSeed', min: 0, max: 1, step: 0.05, def: 0, fixed: 2, gateBy: 'ashseedc', gateOff: 0, title: '별 잔해→씨앗 분율(0~1). 0 또는 일몰사 미발생(D=1·rise off)이면 잔해 침착 미진입 = 회귀(직전 step 비트 동일). 0.5 = 진 별 연료 절반이 무덤에 R 로. 연료 F[외부 질량]가 R 로 들며 E0 를 같은 만큼 올려 닫힌 장부 유지. *리셋 불필요* — 즉시 적용.' }
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
        { kind: 'check', id: 'stage', label: '무대(기복)', def: true, gateFor: 'kRelief', title: '퇴적 R 이 흐름을 휜다(step-0009). ⚠ 켜져 있으면(기복 경로) z 확산(kDz)이 무효 — z 확산은 선형 확산 경로(kRelief=0)에만 있다. 3D z 확산을 보려면 무대를 끄라.' },
        { kind: 'slider', id: 'kRelief', label: 'kRelief', param: 'kRelief', min: 0, max: 3, step: 0.1, def: 1.0, fixed: 1, gateBy: 'stage', gateOff: 0 },
        { kind: 'check', id: 'cryst', label: '결정화(R)', def: true, gateFor: 'kCryst', title: '별이 주입한 E 가 굳어 R 로 — 복제·결정화·생명 부트스트랩의 기질.' },
        { kind: 'slider', id: 'kCryst', label: 'kCryst', param: 'kCryst', min: 0, max: 0.05, step: 0.005, def: 0.01, fixed: 3, gateBy: 'cryst', gateOff: 0 }
      ]},
      { items: [
        { kind: 'select', id: 'click', label: '클릭 동작', role: 'click', options: [['dendseed', '결정 씨앗(가지치기)'], ['turingfield', '균일 R 칠(튜링 관찰)'], ['genecrystal', '유전 씨앗 결정(방향성)'], ['lifegene', '유전 생명 놓기'], ['scatter', '흩어진 클론(정착)'], ['tissue', '클론 조직'], ['gene', '유전 씨앗(R)'], ['star', '별 점화'], ['life', '생명 놓기'], ['rock', '둑 쌓기(R)'], ['harvest', '수확']], def: 'dendseed' },
        { kind: 'button', id: 'fillDendrite', label: '저-E 장 + 결정 씨앗(덴드라이트 격리)', action: 'fillDendrite' },
        { kind: 'button', id: 'fillTuring', label: '균일 R 장(튜링 격리)', action: 'fillTuring' },
        { kind: 'button', id: 'seedStar', label: '별 씨앗 ×6', action: 'seedStars' },
        { kind: 'button', id: 'seedLife', label: '생명 ×5', action: 'seedLife' },
        { kind: 'button', id: 'kill', label: '생명 전멸', action: 'kill' }
      ]}
    ],

    /* 오버레이 — R(유전형이면 태그색·무유전이면 호박) + 활성도 A + 별 + 유전 생명 점 + 개체 윤곽 + 정착 표시. 덴드라이트 가지·튜링 패턴은 *무유전 R*(호박)의 하이트필드로 드러난다. */
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
        var a = r / satR; if (a > 0.9) a = 0.9;
        var g = G[idx], col = GENE_COL[g];
        if (col) ctx.fillStyle = 'rgba(' + col[0] + ',' + col[1] + ',' + col[2] + ',' + a.toFixed(3) + ')';   // 유전형 클론 색(R)
        else ctx.fillStyle = 'rgba(220,165,96,' + (a * 0.9).toFixed(3) + ')';                                   // 무유전 R(호박) — 덴드라이트 가지·튜링 반점이 여기 드러난다
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
      /* 개체 윤곽 — 같은 유전형 4-인접 생명 쌍을 선으로(연결 성분 = 표면장력 액적). */
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
      /* 정착 표시 — 고착(a.sessile=1)한 생명에 청록 사각 테두리. */
      ctx.lineWidth = Math.max(1, SCALE * 0.16);
      for (var ks = 0; ks < ag.length; ks++) {
        var as = ag[ks]; if (!as.sessile) continue;
        ctx.strokeStyle = 'rgba(70,224,200,0.9)';
        ctx.strokeRect(as.x * SCALE + 0.5, as.y * SCALE + 0.5, SCALE - 1, SCALE - 1);
      }
      /* 유전 생명 점 — 계통 표시(germline 켜졌으면): soma 속 빈 점·germ 채운 점. */
      var germOn = sim.p.kGermline !== 0;
      for (var k = 0; k < ag.length; k++) {
        var a2 = ag[k], col3 = GENE_COL[a2.g], lx2 = (a2.x + 0.5) * SCALE, ly2 = (a2.y + 0.5) * SCALE;
        var soma;
        if (germOn && a2.soma !== undefined) {
          soma = a2.soma === 1;
        } else {
          var cx = a2.center, x2 = a2.x, occN = 0;
          if (occ[cx - x2 + (x2 + 1) % W] !== undefined) occN++;
          if (occ[cx - x2 + (x2 - 1 + W) % W] !== undefined) occN++;
          if (occ[((a2.y + 1) % H) * W + x2] !== undefined) occN++;
          if (occ[((a2.y - 1 + H) % H) * W + x2] !== undefined) occN++;
          soma = occN >= 4;
        }
        var cstr = col3 ? col3[0] + ',' + col3[1] + ',' + col3[2] : '245,245,245';
        if (soma) {
          ctx.strokeStyle = 'rgba(' + cstr + ',0.85)'; ctx.lineWidth = Math.max(1, SCALE * 0.18);
          ctx.beginPath(); ctx.arc(lx2, ly2, Math.max(1.2, SCALE * 0.24), 0, 6.2832); ctx.stroke();
        } else {
          ctx.fillStyle = 'rgba(' + cstr + ',0.95)';
          ctx.beginPath(); ctx.arc(lx2, ly2, Math.max(1.8, SCALE * 0.36), 0, 6.2832); ctx.fill();
        }
      }
    },

    stats: [
      { label: 'tick', get: function (c) { return String(c.sim.tick); } },
      { label: 'sumE', get: function (c) { return c.m.sumE.toFixed(2); } },
      { label: '<span style="color:#ffd060">점화 자리</span> (z=0 R≥문턱 / 결정화 — 가설: 바다→씨앗밭)', get: function (c) {
          var D = c.sim.p.D || 1, cOn = (c.sim.p.kCryst || 0) !== 0, gOn = (c.sim.p.kGravity || 0) !== 0;
          var R = c.sim.R, W = c.sim.p.W, H = c.sim.p.H, th = c.sim.p.ignThresh || 1.5, n = 0; for (var k = 0; k < W * H; k++) if (R[k] >= th) n++;
          var cry = c.sim.crystallized || 0, b = c.sim.starBirths || 0;
          if (D < 2 || !gOn) return { text: '점화 자리 ' + n + '칸 (z=0 평면/중력 off — 고리 폐합 비활성. 위 "고리 폐합 ON" 버튼으로)', cls: '' };
          return { text: '점화 자리 ' + n + '칸 / 결정화 ' + cry.toFixed(0) + ' / 출생 ' + b, cls: (cOn && n > 13 && cry > 1) ? 'pass' : '' };
      } },
      { label: '<span style="color:#9ad24a">덴드라이트</span> (넓이 / 거칠기 / 가지끝)', get: function (c) { var d = window.HWS_SIM.measureDendrite(c.sim); return d.area ? (d.area + ' / ' + d.roughness.toFixed(2) + ' / ' + d.tips) : '—'; } },
      { label: '<span style="color:#46e0c8">튜링 패턴</span> (진폭 / 파장 lag)', get: function (c) { var d = window.HWS_SIM.measureTuring(c.sim); return (d.stdR.toFixed(3) + ' / ' + (d.firstNeg || '—')); } },
      { label: '<span style="color:#46e0c8">방향성 결정</span> (이방성 / 성장)', get: function (c) { var d = window.HWS_SIM.measureAnisotropy(c.sim); return d.cells ? ((isFinite(d.aniso) ? d.aniso.toFixed(2) : '∞') + ' / ' + (c.sim.anisoGrown || 0).toFixed(0)) : '—'; } },
      { label: '<span style="color:#78c860">개체</span> (수 / 평균 / 최대 세포)', get: function (c) { var o = window.HWS_SIM.measureOrganisms(c.sim); return o.nOrg + ' / ' + o.meanSize.toFixed(1) + ' / ' + o.maxSize; } },
      { label: '<span style="color:#e0c060">계통</span> (soma / germ)', get: function (c) { var d = window.HWS_SIM.measureGermline(c.sim); return d.committed ? (d.soma + ' / ' + d.germ) : '—'; } },
      { label: '별 <span style="color:#ff9a3c">living</span>/<span style="color:#fff7d2">burning</span>/<span style="color:#aab">ash</span>', get: function (c) { var k = stateCounts(c.sim); return k[0] + ' / ' + k[1] + ' / ' + k[2]; } },
      { label: '<span class="pool">고임</span> / <span class="life">개체수</span> / M', get: function (c) { return c.pools.length + ' / ' + c.sim.agents.length + ' / ' + c.led.biomass.toFixed(2); } },
      { label: '누적 출생 / 사망', get: function (c) { return c.sim.births + ' / ' + c.sim.deaths; } },
      { label: '장부 잔차', get: function (c) { var r = c.led.residual; return { text: r.toExponential(3) + (r < 1e-6 ? ' PASS' : ' FAIL'), cls: r < 1e-6 ? 'pass' : 'fail' }; } }
    ],

    legend:
      '<span style="color:#dca560">■</span>무유전 R(덴드라이트 가지/튜링 반점) &nbsp; <span style="color:#e86060">●</span>tag1 <span style="color:#78c860">●</span>tag2 <span style="color:#60a8e8">●</span>tag3 <span style="color:#c870e0">●</span>tag4 — 유전 결정/생명 &nbsp; <span style="color:#46e0c8">▢</span>정착 &nbsp; <span style="color:#fff7d2">★</span>별<br>' +
      '<b>전체 에너지 고리 폐합(VOXEL.md V5+ 통합)</b>: step-0037 은 진 별빛을 중력으로 z=0 <b>바다</b>(고인 E)에 고이게 했으나 거기서 멈췄다. 이 step 은 그 고리를 끝까지 닫는다 — <b>hws-laws.js 를 안 건드리고</b>(법칙 무변경 통합) 검증된 부품 넷(별 일생·중력·결정화·지지 게이트)을 <b>합성</b>해 바다 E 가 z=0 에서 <b>R(지면/씨앗)로 굳고 그 R 이 점화 문턱을 넘어 새 별을 키운다</b>. 통합 게이트 = 기존 노브 <b>kCryst</b>(+kSupport). <b>E→별→비→바다→지면→새 별</b> = "스스로 굴러가는 세계"의 에너지 순환 완전 폐합 — 세계가 처음 놓은 작은 씨앗(13칸)에 더는 기대지 않고 제 별빛으로 씨앗밭(150칸+)을 키운다. "터 깊이 D" 8·"별 부력 상승"·"별 하강"·"중력"·"결정화"·"지지 침착" 켜고 리셋해 보라(위 "에너지 고리 폐합 ON" 버튼). <code>verify cycle</code>: <b>결정화 off 면 결정화 0·점화 자리 13칸뿐 → on 이면 바다→R 결정화 ~1210·maxR ~25(≫ ignThresh 1.5)·점화 자리 ~150칸</b>·잔차 3.2e-14. 부품 합성이 빚은 제3의 현상(어느 하나만으론 안 남) — 에너지 순환의 가시적 완전 폐합. (3D 뷰는 아직 z=0 평면 하이트필드 — voxel 렌더는 렌더러 트랙 L-V1.)<br>' +
      '<b>가지치기 덴드라이트(R5)</b>: R3(방향성)은 *곧은* needle 을, R4(튜링)는 *균일 대칭 깨짐*을 빚었다. 이 step 은 *자라는 결정 전선*을 *경계 불안정*(Mullins-Sekerka)으로 *옆가지*를 뻗게 한다 — *둘째 필드 없이* E·R 만(자라는 셀이 제 E 를 당겨 비우면 튀어나온 tip 은 빨리 채워지나 오목 만은 멈춤 = *기하 차폐*, 거기에 *곡률 증폭*[볼록 tip 가속]을 얹는다). "저-E 장 + 결정 씨앗" 버튼을 누르고 돌리면, 둥근 씨앗이 *저절로* 옆가지로 갈린다(다른 법칙은 클릭 동작·시드로 격리).<br>' +
      '<b>가지</b>: <code>verify dendrite</code>(dendrite 아레나) — 거칠기 1.67(곡률 무증폭=컴팩트 덩이)→24.56(곡률+차폐=가지·원판 ≈1 대비 ≫1)·가지 끝 4→34. *곡률 증폭이 평탄 전선을 옆가지로 가른다*(turing 의 "근방 커널 필수"와 같은 정신 — 차폐만이면 컴팩트, 정직한 한계). author 아닌 *창발*(침착 1개만 깖 — 척추 체크 2). 셀 안 E→R 쌍 거래(보존)라 churn 을 안 깬다(<code>verify sustain</code>·잔차 &lt;1e-6 <span class="pass">PASS</span>). <i>전체 스택은 희소·이미 굳은 R 이라 가지가 약하게만 — 현상은 dendrite 아레나에서.</i> "덴드라이트" 체크를 끄면 step-0026 으로.',

    actions: {
      fillDendrite: function (api) {
        var s = api.sim, R = s.R, G = s.G, E = s.E, W = s.p.W, H = s.p.H, N = W * H, addE = 0, addR = 0;
        for (var i = 0; i < N; i++) { addE += 0.8 - E[i]; E[i] = 0.8; addR += 0 - R[i]; R[i] = 0; G[i] = 0; }   // 균일 저-E(0.8 — E-제한 → 영구 빈틈) 장·R 비움
        var cells = api.core.discCells(W, H, (W / 2) | 0, (H / 2) | 0, 2);                                       // 중심 고체 R 씨앗(전선이 여기서 가지친다)
        for (var k = 0; k < cells.length; k++) { addR += 1.0 - R[cells[k]]; R[cells[k]] = 1.0; }
        s.E0 += addE + addR;
        api.toast('저-E 장(0.8) + 중심 결정 씨앗 — 덴드라이트 on 이면 둥근 씨앗이 저절로 옆가지로 갈린다(다른 법칙은 끄거나 격리해 보라)');
      },
      fillTuring: function (api) {
        var s = api.sim, R = s.R, G = s.G, N = s.p.W * s.p.H, add = 0;
        for (var i = 0; i < N; i++) { add += 0.5 - R[i]; R[i] = 0.5; G[i] = 0; }   // 격자 전체 균일 무유전 R(0.5) — E noise 가 대칭을 깬다 → 튜링이 반점/줄무늬로
        s.E0 += add;
        api.toast('균일 R 장(0.5) — 튜링 on 이면 저절로 반점/줄무늬로 갈라진다(덴드라이트는 꺼 보라)');
      },
      seedStars: function (api) { for (var i = 0; i < 6; i++) api.core.spawnStar(api.sim, (i * 53) % api.sim.p.W, (i * 29) % api.sim.p.H); api.toast('별 ×6 점화'); },
      seedLife: function (api) { var pools = api.core.detectPools(api.sim, { minE: 1.5, prom: 0.3 }), n = Math.min(5, pools.length); for (var i = 0; i < n; i++) api.core.spawnAgent(api.sim, pools[i].x, pools[i].y); api.toast(n ? ('강한 고임 ' + n + '곳에 생명') : '놓을 고임이 없다 — 별을 켜세요'); },
      kill: function (api) { var ag = api.sim.agents; for (var i = 0; i < ag.length; i++) { api.sim.E[ag[i].center] += ag[i].m; api.sim.deaths++; } api.sim.agents = []; api.toast('생명 전멸(장부 유지)'); }
    },

    clickModes: {
      dendseed: function (api, cx, cy) { var s = api.sim, R = s.R, G = s.G, add = 0, cells = api.core.discCells(s.p.W, s.p.H, cx, cy, 2); for (var k = 0; k < cells.length; k++) { add += 1.0 - R[cells[k]]; R[cells[k]] = 1.0; G[cells[k]] = 0; } s.E0 += add; api.toast('결정 씨앗 (' + cx + ',' + cy + ') — 덴드라이트 on·둘레 E 가 충분하면 이 씨앗이 옆가지를 뻗는다'); },
      turingfield: function (api, cx, cy) { var s = api.sim, R = s.R, G = s.G, W = s.p.W, H = s.p.H, add = 0; for (var dy = -6; dy <= 6; dy++) for (var dx = -6; dx <= 6; dx++) { var x = (cx + dx + W) % W, y = (cy + dy + H) % H, j = y * W + x; add += 0.5 - R[j]; R[j] = 0.5; G[j] = 0; } s.E0 += add; api.toast('균일 R 칠 (' + cx + ',' + cy + ') — 튜링 on 이면 이 패치가 반점/줄무늬로 갈라진다'); },
      genecrystal: function (api, cx, cy) { var tag = 1 + ((api.sim.tick + cx + cy) % api.sim.p.geneTypes); api.core.spawnGene(api.sim, cx, cy, 2, tag, 1.0); api.toast('유전 씨앗 결정 (' + cx + ',' + cy + ') tag ' + tag); },
      lifegene: function (api, cx, cy) { var tag = 1 + ((api.sim.tick + cx + cy) % api.sim.p.geneTypes), a = api.core.spawnAgent(api.sim, cx, cy); a.g = tag; api.toast('유전 생명 (' + cx + ',' + cy + ') tag ' + tag); },
      scatter: function (api, cx, cy) { var s = api.sim, n = 0; for (var y = cy - 9; y < cy + 9; y += 3) for (var x = cx - 9; x < cx + 9; x += 3) { var a = api.core.spawnAgent(s, x, y); a.g = 1; n++; } api.toast('흩어진 클론 ' + n + '세포 (' + cx + ',' + cy + ')'); },
      tissue: function (api, cx, cy) { var s = api.sim, n = 0; for (var y = cy - 5; y < cy + 5; y++) for (var x = cx - 5; x < cx + 5; x++) { var a = api.core.spawnAgent(s, x, y); a.g = 1; n++; } api.toast('클론 조직 ' + n + '세포 (' + cx + ',' + cy + ')'); },
      gene: function (api, cx, cy) { var tag = 1 + ((api.sim.tick + cx + cy) % api.sim.p.geneTypes); api.core.spawnGene(api.sim, cx, cy, 1, tag, 1.0); api.toast('유전 씨앗 R (' + cx + ',' + cy + ') tag ' + tag); },
      star: function (api, cx, cy) { var s = api.core.spawnStar(api.sim, cx, cy); api.toast('별 점화 (' + cx + ',' + cy + ') 연료 ' + s.fuel.toFixed(0)); },
      life: function (api, cx, cy) { var a = api.core.spawnAgent(api.sim, cx, cy); api.toast('생명 출생 (' + cx + ',' + cy + ') m ' + a.m.toFixed(2)); },
      harvest: function (api, cx, cy) { var rm = api.core.harvest(api.sim, cx, cy, 3); api.toast('수확 −' + rm.toFixed(1) + ' E → sunk'); },
      rock: function (api, cx, cy) { var added = api.core.paintStore(api.sim, cx, cy, 2, 5); api.toast('둑 쌓기 +' + added.toFixed(0) + ' R(무유전)'); }
    }
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = panel;
  else global.HWS_PANEL_0040 = panel;
})(typeof window !== 'undefined' ? window : globalThis);
