/* HWS 공통 법칙 — *진화하는* 누적 법칙 집합. step 이 더해온 모든 항이 *순서 있는 게이트 함수*로 산다.
 *
 * 설계(law-pipeline): step-0001~0010 은 step() 한 덩어리를 매번 복사·수정하며 항을 하나씩 늘렸다.
 *   여기선 그 덩어리를 *한 항 = 한 함수*로 분해한다. 각 법칙은 sim 을 받아 제자리 변형하는 순수 절차이고,
 *   자기 노브가 0/off 면 *통째로 일찍 반환*한다 — 이게 회귀 0(노브=0 → 직전 step 비트 동일)의 실현이다.
 *   step() 의 "①~⑧ 순서 불변"은 이제 매 파일 주석에 재입력되는 대신 LAW_ORDER 배열 *단일 출처*가 된다.
 *
 * 새 step 작성법: (1) 새 법칙 함수를 여기 추가(자기 노브로 게이트, 노브=0 면 early-return),
 *   (2) DEFAULTS 에 노브 1개 추가(기본 0 = 회귀), (3) LAW_ORDER 의 올바른 순서 자리에 삽입.
 *   세계의 *상태를 안 바꾸는* 측정/장부/disc 헬퍼는 여기 말고 engine/hws-kernel.js 에.
 *
 * 회귀 사슬(노브를 끄면 과거 step 으로 환원):
 *   pTumble=0 → 0009 · kRelief=0 → 0008 · kCryst=0 → 0007 · srcJump=0 → 0006 · baseCost=0 → 0005 ·
 *   move=0 → 0004 · repro=0 → 0003 · (에이전트 0) → 0002 · kA=0 → 0001.
 * 검증: `node engine/validate/verify-engine.js` 가 이 법칙 묶음이 step-0010/sim-core.js 와 비트 동일함을 증명.
 *
 * 브라우저: window.HWS_LAWS (window.HWS_KERNEL 선행 로드 필요) / Node: module.exports.
 */
(function (global) {
  'use strict';
  var K = (typeof module !== 'undefined' && module.exports) ? require('./hws-kernel.js') : global.HWS_KERNEL;

  /* ── 표준 시나리오 파라미터 (step 간 수치 비교를 위해 고정) ── */
  var DEFAULTS = {
    W: 64, H: 64,          // 터: 격자 크기 (wrap)
    kD: 0.20,              // 확산 계수 (4이웃, 안정 조건 kD <= 0.25)
    kEvap: 0.001,          // 증발률 — 매 tick E 의 kEvap 비율이 장부 T 로
    initE: 1.0,            // 초기 평균 E
    noise: 0.5,            // 초기 노이즈 진폭 (시드로 결정)
    source: { x: 16, y: 16, r: 3, rate: 0.05 },  // 셀당/tick당 주입량
    sink:   { x: 48, y: 48, r: 4, rate: 0.10 },  // 셀 E 의 비율 제거
    drive: true,           // 구동 on/off — off 면 source·sink 둘 다 정지
    /* ── step-0002: 응집(농도 창 안의 uphill 흐름) ── */
    kA: 0,                 // 응집 강도. 기본 0 = off = step-0001 과 비트 동일
    aggMc: 1.1,            // 농도 창 중심
    aggW: 0.7,             // 농도 창 반폭 (|m-mc|>=w 면 응집 0)
    /* ── step-0003: 생명(자원을 먹는 자기유지 패턴) ── */
    life: true,            // 생명 법칙 on/off. 단, 에이전트가 없으면 어차피 no-op(회귀)
    kL: 0.05,              // 흡수율 — 매 tick 입(disc)의 E 의 이 비율을 생물량으로
    mMaint: 0.03,          // 유지율 — 매 tick 생물량의 이 비율을 대사로 소산
    mDeath: 0.05,          // 사망 임계 — m 이 이 값 미만이면 사망
    mSeed: 0.50,           // 스폰 시 초기 생물량
    lifeR: 1,              // 입 반경(흡수 원판). 1 = 자신+4이웃(von Neumann 근사 disc)
    /* ── step-0004: 번식(생물량이 임계를 넘으면 분열) ── */
    repro: true,           // 번식 on/off. off(또는 mDiv=Infinity) → step-0003 과 비트 동일(회귀)
    mDiv: 1.20,            // 분열 임계 — m >= mDiv 면 둘로 쪼갬(부모 m/2, 자식 m/2)
    divR: 1,               // 자식 배치 탐색 반경 — 이 disc 안 빈 이웃 중 E 최고 셀로
    popCap: 4096,          // 개체수 안전 상한(=격자 셀 수). 보통 자원이 먼저 제한 → 거의 안 닿음
    /* ── step-0005: 이동(주화성 — 더 높은 E 이웃으로 한 칸씩) ── */
    move: true,            // 이동 on/off. off(또는 moveR=0) → step-0004 와 비트 동일(회귀)
    moveR: 1,              // 이동 반경(보폭). 1 = 4이웃 중 한 칸. 0 = 이동 없음(회귀)
    moveThresh: 0.02,      // 이동 임계 — 빈 이웃 E 가 현재 중심보다 이만큼 높아야 옮김(구배 문턱)
    /* ── step-0006: 기초대사비(절대 생존 문턱) ── */
    baseCost: 0,           // 생물량과 무관한 절대 대사비. cost = m·mMaint + baseCost.
    /* ── step-0007: 떠도는 자원(source 가 주기적으로 +x 로 재배치, 토러스 wrap) ── */
    srcJump: 0,            // 재배치 1회당 source x 이동 칸수. 0 = off = step-0006 와 비트 동일(회귀).
    srcPeriod: 150,        // 재배치 주기(tick). srcJump>0 일 때만 의미.
    /* ── step-0008: 결정화·풍화(저장체 = 평형 개체) ── */
    kCryst: 0,             // 결정화율. 0 = off = step-0007 과 비트 동일(회귀). >0 이면 E>crystThresh 인 셀의
                           //   초과분의 이 비율이 매 tick 굳어 R 로(E→R). 높은 문턱 진입(빠름).
    crystThresh: 3.0,      // 결정화 문턱(척추 결정3) — E 가 이 값을 넘는 셀에서만 결정화가 켜진다(강한 고임 핵).
    kWeather: 0.0003,      // 풍화율 — 매 tick R 의 이 비율이 E 로 되돌아간다(R→E, 느림·무조건).
    /* ── step-0009: 무대(기복 — 퇴적이 바닥을 올려 흐름이 굳은 땅을 비켜간다) ── */
    kRelief: 0,            // 기복 가중. 0 = off = step-0008 과 비트 동일(회귀). >0 이면 흐름 퍼텐셜
                           //   h = E + kRelief·R 의 내리막으로 확산(donor-제한 upwind). 1 이면 3D 지형(E+R)과
                           //   흐름 퍼텐셜이 일치. 시나리오 튜닝 노브(결정론 무관) — 방향만 바꿀 뿐 총량 보존.
    /* ── step-0010: 탐사(run-and-tumble — 갇힌 굶주린 생명이 의사난수 방향으로 한 칸) ── */
    pTumble: 0,            // tumble 확률. 0 = off = step-0009 와 비트 동일(회귀). (0,1] 이면 greedy 가 갇힌
                           //   (이동 불가=국소 최대) + 굶주린(예측 흡수 < 비용) 생명이 매 tick 이 확률로 의사난수
                           //   방향(구배 무상관, tumbleHash) 한 칸. 위치만 바꿔 장부 불변. 결정론 노브(시드 의사난수).
    /* ── step-0011: 구동 내생화(별 — R 누적 핵에서 점화하는 내생 주입원, 연료 소진까지 서행) ── */
    kIgnite: 0,           // 점화 마스터. 0 = off = step-0010 과 비트 동일(회귀, stars 불변). >0 이면 별 법칙 on.
                          //   별 = 활성도 축의 *소산 극단*: R 누적 핵에서 점화(내생 siting) → 연료(외부 질량)를 E 로
                          //   주입하며 서행(채식지) → 소진하면 꺼진다(비가역). 고정 외부 source 를 *떠도는 필멸 봉우리*로
                          //   대체 → 개체군이 수렴할 영구 전역 봉우리가 사라진다(G2/G3 후보).
    starRate: 0.06,       // 별 주입율 — 셀당/tick 당 방출 disc 에 주입(외부 source.rate=0.05 동급). sim.injected 로 추적.
    starFuel0: 500,       // 별 연료(외부 질량 할당, 닫힌 장부 밖 대기) — 소진까지 ≈ fuel/(starRate·disc) tick 산다(서행 수명).
    ignThresh: 1.5,       // 점화 문턱(국소·결정3) — 셀 R 이 이 값을 넘으면 점화 후보(붕괴해 별이 서는 강고임 핵).
    starCap: 10,          // 동시 별 수 상한(시나리오 노브 — 여럿이라 항상 가까이 채식지).
    starGap: 6,           // 별 간 최소 간격(셀) — 한 핵 중복 점화 방지(국소 거리만 본다).
    starR: 3,             // 별의 방출 반경 — 연료를 이 disc 에 주입(외부 source 처럼 넓은 봉우리, 생명이 채식).
    starDriftPeriod: 20,  // 서행 주기 — 이 tick 마다 방출 봉우리가 한 칸 이동(클수록 느림 — 생명이 따라올 수 있게).
                          //   방향은 점화 시 tumbleHash(내생 의사난수, 시드 결정론) 4이웃 중 하나로 고정.
    /* ── step-0012: 밀도 의존 자기제한(crowding — 국소 개체 밀도가 carrying capacity 를 만든다) ── */
    kCrowd: 0,            // 혼잡 대사세 계수. 0 = off = step-0011 과 비트 동일(회귀, agents 불변). >0 이면 각 생명이
                         //   *국소 밀도*(crowdR disc 안 이웃 수)에 비례한 추가 대사세를 낸다(소산 → metabolized 경계).
                         //   붐비면 net 손실↑ → 솎임 → 로지스틱 carrying capacity. 내생 구동의 과증식-공멸을 묶는
                         //   *음성 피드백*(국소 문턱, 전역 조율자 0). step-0011 의 🔴 최우선 격차를 메우는 한 조각.
    crowdR: 3,            // 밀도 측정 반경 — 이 disc 안의 다른 생명 수가 혼잡도(국소만 본다). 별 방출 반경(starR=3)과
                         //   같은 척도 — 한 별의 채식지 넓이에서 몇이 경쟁하는가. R=2 면 솎임이 국소적이라 채식지를
                         //   다 덮어 공멸(과소), R=3 이상이면 생명이 흩어져 채식지에 E 가 남아 결정화→R 재충전→지속.
    /* ── step-0013: 별 연소 FSM(living→burning→ash — 이산 비가역 문턱, SPINE 결정3 완전판) ── */
    kFSM: 0,             // 별 연소 FSM 마스터. 0 = off = step-0012 와 비트 동일(회귀, 별이 birth→full rate→fuel 소진).
                         //   1 이면 별의 alive→dead proto-FSM 가운데 *burning* 을 끼워 이산 3-상태 FSM 이 된다:
                         //   living(갓 점화 kindling, 저활성·정지) → burning(전율·서행) → ash(소진·제거). 전이는 *문턱에서
                         //   딱 뒤집힘*(연속 변조 아님)이고 비가역(되돌아가지 않음·ash 제거). 활성도(주입 throughput)는
                         //   그 위 연속 측정 — 라벨은 편의지 진실의 출처가 아니다(burning ⟺ 전율 주입, 측정으로 환원).
    livingFrac: 0.55,    // living 주입율 배수(0~1) — 갓 점화한 kindling 은 *저활성·정지*로 핫코어 E 를 제자리에 쌓는다.
                         //   burning 은 배수 1(전율) + 서행(채식지 떠돎). ash 는 0(주입 멎음). 정지 kindling 이라 핫코어가
                         //   흩어지지 않고 burnOn 까지 차오른다(flashpoint 도달).
    burnOn: 0.6,         // living→burning 점화 문턱(히스테리시스 *상*, 빠른 변수). 핫코어(disc 평균 E)가 이 값 *이상*이면 SNAP 연소.
    burnOff: 0.4,        // burning→ash 조기 quench 문턱(히스테리시스 *하* < 상). 핫코어가 이 값 *미만*으로 식으면 SNAP 재.
                         //   소진은 보통 *느린 변수*(연료 고갈, ignite)가 끌지만, 이 하문턱은 *심하게 잠식된* 별을 조기에 끈다.
                         //   상≠하(폭 = burnOn−burnOff > 0)라 그 사이 밴드에선 latch(안 떨리고 비가역) — 이산성이 *문턱 분리·
                         //   timescale 분리*(빠른 점화 snap · 느린 소진)에서 창발한다(흥분성 매질/이완 진동, FitzHugh–Nagumo).
    /* ── step-0014: 활성도 계량(flux — 척추 변수 E 의 통과 throughput 측정, SPINE 결정1·2) ── */
    kFlux: 0,            // 활성도 계량 마스터. 0 = off = step-0013 과 비트 동일(회귀, A·Eprev 불변 → 해시 가법 skip).
                         //   1 이면 매 tick 각 셀의 *통과 flux*(net dE/dt = 척추 변수 E 가 그 칸에서 처리되는 속도, 결정1)를 재서
                         //   활성도 필드 A 로 적분(EMA)한다. A 는 *연속 활성도 축*(결정2) — 저장체(R 잠김·E 불변 → 낮은 A)와
                         //   소산(별 연소·E 격변 → 높은 A)이 *측정*으로 그 축의 두 극단에 갈린다(authored enum 없이 분류 창발).
                         //   A 는 *읽기 전용 계기*다 — E/R/agent 동역학에 되먹이지 않는다(단일 척추: A 는 측정이지 둘째 구동 필드 아님).
    aFlux: 0.1,          // 활성도 EMA 평활 계수(0~1) — A ← (1−aFlux)·A + aFlux·|dE/dt|. 작을수록 길게 기억(시간 평균),
                         //   클수록 순간 throughput 에 민감. 결정론 무관(시드 의사난수 아님)·장부 무관(A 는 에너지 아닌 *속도*).
    /* ── step-0015: R-주형 자기복제(heredity — 유전의 씨앗, SPINE §다섯째 축) ── */
    kTemplate: 0,        // 복제 마스터. 0 = off = step-0014 와 비트 동일(회귀, G·복제 미작동 → 해시 가법 skip). >0 이면
                         //   R-주형 자기복제 on: 자기복제하는 R-배치(genotype)가 제 사본의 결정화를 *촉매*한다(저장의 씨앗 끝).
                         //   복제 = E→R 쌍 거래(닫힌 장부, ⑤결정화와 같은 경계) + 유전형 태그 G 복사. 복제오류=변이·기질경쟁=선택.
    geneRate: 0.5,       // 복제 1회당 이웃 칸에 침착하는 E→R 양(태그를 함께 복사). 대상 이웃은 E ≥ geneRate 여야 한다(기질 문턱=선택).
    geneThresh: 0.3,     // 주형 문턱 — R[i] ≥ 이 값 & G[i]≠0 인 칸이 복제 주형(국소 판정). 자식도 침착으로 이 문턱을 넘어 다음 세대 주형.
    geneMu: 0.01,        // 복제오류율(변이) — 자식 태그가 이 확률로 이웃 태그(±1, wrap)로 바뀐다(시드 의사난수, Math.random 금지).
    geneTypes: 4,        // 유전형 태그 종류 수(1..geneTypes). 다양성은 *병렬 필드 아닌 속성*(태그 G)에 싣는다 — 단일 척추.
    geneFit0: 0.5,       // 유전형→표현형(복제 propensity) 맵 절편: fit(tag) = geneFit0 + geneFitStep·(tag−1), [0,1] clamp.
    geneFitStep: 0.15,   // 표현형 기울기 — 높은 태그가 더 빨리 복제(propensity↑) → 선택이 평균 적합도를 올린다(=0 이면 중립=드리프트만).
    geneClear: 0.05      // 유전 소거 문턱 — R[i] < 이 값이면 G[i]=0(풍화로 기질이 사라지면 유전 정보도 소멸 — 정보는 저장 극단에만).
  };

  /* ─────────────────────────────────────────────────────────────────────────
   * 법칙들 — 매 tick 세계의 E/R/agents 를 제자리 변형. 각자 자기 노브로 게이트(노브=0 → early-return = 회귀).
   * 순서는 LAW_ORDER(아래)가 단일 출처로 고정한다: ①확산 ②증발 ③④구동 ⑤결정화 ⑥이동 ⑦생명 ⑧번식.
   * ───────────────────────────────────────────────────────────────────────── */

  /* ① 확산(+응집·기복) — E 의 흐름. *이 법칙이 E/buf 스왑을 소유한다*(확산 결과를 buf 에 써서 swap-in).
   * kRelief≠0 이면 무대 경로(기복, donor-제한 upwind, h=E+kRelief·R 내리막), 0 이면 4이웃 선형 확산.
   * kA≠0 이면 농도 창 응집을 같은 루프에서 가법(한 step=한 항이되 둘은 늘 같은 패스에서 계산됨 — 비트 동일 유지). */
  function diffuse(sim) {
    var p = sim.p, W = p.W, H = p.H, E = sim.E, B = sim.buf, kD = p.kD;
    var kA = p.kA, mc = p.aggMc, w = p.aggW;
    var x, y, i;
    if (p.kRelief !== 0) {
      /* 기복(donor-제한 upwind): 패스0 h=E+kRelief·R, 패스1 유출수요·제한 f, 패스2 변 flux(쌍 거래 보존). */
      var kB = p.kRelief, R9 = sim.R, hP = sim.hPot, fL = sim.fLim;
      for (i = 0; i < W * H; i++) hP[i] = E[i] + kB * R9[i];
      for (y = 0; y < H; y++) {
        var yNa = ((y - 1 + H) % H) * W, ySa = ((y + 1) % H) * W, yCa = y * W;
        for (x = 0; x < W; x++) {
          var xWa = (x - 1 + W) % W, xEa = (x + 1) % W;
          i = yCa + x;
          var hh = hP[i], dm = 0, dd;
          dd = hh - hP[yNa + x]; if (dd > 0) dm += dd;
          dd = hh - hP[ySa + x]; if (dd > 0) dm += dd;
          dd = hh - hP[yCa + xWa]; if (dd > 0) dm += dd;
          dd = hh - hP[yCa + xEa]; if (dd > 0) dm += dd;
          dm *= kD;
          fL[i] = dm > E[i] ? E[i] / dm : 1;
        }
      }
      for (y = 0; y < H; y++) {
        var yNb = ((y - 1 + H) % H) * W, ySb = ((y + 1) % H) * W, yCb = y * W;
        for (x = 0; x < W; x++) {
          var xWb = (x - 1 + W) % W, xEb = (x + 1) % W;
          i = yCb + x;
          var jN = yNb + x, jS = ySb + x, jW = yCb + xWb, jE = yCb + xEb;
          var hc = hP[i], net = 0, dv;
          dv = hc - hP[jN]; if (dv > 0) net -= fL[i] * kD * dv; else if (dv < 0) net += fL[jN] * kD * (hP[jN] - hc);
          dv = hc - hP[jS]; if (dv > 0) net -= fL[i] * kD * dv; else if (dv < 0) net += fL[jS] * kD * (hP[jS] - hc);
          dv = hc - hP[jW]; if (dv > 0) net -= fL[i] * kD * dv; else if (dv < 0) net += fL[jW] * kD * (hP[jW] - hc);
          dv = hc - hP[jE]; if (dv > 0) net -= fL[i] * kD * dv; else if (dv < 0) net += fL[jE] * kD * (hP[jE] - hc);
          var ei = E[i], bi = ei;
          B[i] = ei + net;
          if (kA !== 0) {
            var bN = E[jN], bS = E[jS], bW = E[jW], bE = E[jE];
            B[i] += kA * (
              aggK(bi < bN ? bi : bN, mc, w) * (bi - bN) +
              aggK(bi < bS ? bi : bS, mc, w) * (bi - bS) +
              aggK(bi < bW ? bi : bW, mc, w) * (bi - bW) +
              aggK(bi < bE ? bi : bE, mc, w) * (bi - bE)
            );
          }
        }
      }
    } else {
      /* 4이웃, wrap. 총량 보존 (step-0008 식 그대로 — kRelief=0 회귀 경로) */
      for (y = 0; y < H; y++) {
        var yN = ((y - 1 + H) % H) * W, yS = ((y + 1) % H) * W, yC = y * W;
        for (x = 0; x < W; x++) {
          var xW = (x - 1 + W) % W, xE = (x + 1) % W;
          i = yC + x;
          var eN = E[yN + x], eS = E[yS + x], eWc = E[yC + xW], eEc = E[yC + xE], eii = E[i];
          B[i] = eii + kD * (eN + eS + eWc + eEc - 4 * eii);
          if (kA !== 0) {
            B[i] += kA * (
              aggK(eii < eN ? eii : eN, mc, w) * (eii - eN) +
              aggK(eii < eS ? eii : eS, mc, w) * (eii - eS) +
              aggK(eii < eWc ? eii : eWc, mc, w) * (eii - eWc) +
              aggK(eii < eEc ? eii : eEc, mc, w) * (eii - eEc)
            );
          }
        }
      }
    }
    sim.E = B; sim.buf = E;
  }
  var aggK = K.aggKernel;

  /* ② 증발 — 매 tick E 의 kEvap 비율이 장부 evaporated 로. */
  function evaporate(sim) {
    var p = sim.p, E = sim.E, N = p.W * p.H, kEvap = p.kEvap, evap = 0, d;
    for (var i = 0; i < N; i++) { d = E[i] * kEvap; E[i] -= d; evap += d; }
    sim.evaporated += evap;
  }

  /* ③④ 구동 — 떠도는 source(step-0007) 재배치 + 주입 + 배출(sink). drive off 면 통째로 정지(회귀). */
  function drive(sim) {
    var p = sim.p; if (!p.drive) return;
    var E = sim.E, W = p.W, H = p.H, i, d;
    if (p.srcJump !== 0 && p.srcPeriod > 0) {
      var nj = Math.floor((sim.tick - sim.srcBaseTick) / p.srcPeriod);
      var ncx = (((sim.srcBase.x + p.srcJump * nj) % W) + W) % W;
      if (ncx !== p.source.x) {
        p.source.x = ncx;
        sim.srcCells = K.discCells(W, H, ncx, p.source.y, p.source.r);
      }
    }
    var sc = sim.srcCells, rate = p.source.rate;
    for (i = 0; i < sc.length; i++) E[sc[i]] += rate;
    sim.injected += rate * sc.length;
    var kc = sim.sinkCells, srate = p.sink.rate, snk = 0;
    for (i = 0; i < kc.length; i++) { d = E[kc[i]] * srate; E[kc[i]] -= d; snk += d; }
    sim.sunk += snk;
  }

  /* ⑤ 결정화·풍화(step-0008) — kCryst=0 이면 통째로 건너뜀(회귀 0, R 불변). */
  function crystallize(sim) {
    var p = sim.p; if (p.kCryst === 0) return;
    var E = sim.E, N = p.W * p.H, R = sim.R, kC = p.kCryst, cth = p.crystThresh, kW = p.kWeather;
    var cry = 0, wth = 0;
    for (var i = 0; i < N; i++) {
      var ev = E[i];
      if (ev > cth) {                          // 문턱: 넘은 셀만 굳는다(국소 판정)
        var dep = (ev - cth) * kC;
        E[i] = ev - dep; R[i] += dep; cry += dep;
      }
      var ri = R[i];
      if (ri !== 0) {                          // 풍화: 굳은 R 이 천천히 E 로(느린 역행)
        var rel = ri * kW;
        R[i] = ri - rel; E[i] += rel; wth += rel;
      }
    }
    sim.crystallized += cry; sim.weathered += wth;
  }

  /* ⑤d 복제(R-주형 자기복제, step-0015) — kTemplate=0 이면 통째로 건너뜀(회귀 0, G·복제 불변 → 해시 가법 skip).
   * SPINE §다섯째 축(유전): 저장(R)의 *씨앗 끝* — 자기복제하는 R-배치(genotype)가 제 사본의 결정화를 *촉매*한다.
   *   복제 = E→R 쌍 거래(닫힌 장부, ⑤결정화와 같은 경계) + 유전형 태그 G 복사. 복제오류(geneMu)=변이, 기질(E) 경쟁=선택
   *   → 다윈 동역학이 substrate 위에서 돈다(genotype = 복제된 R-패턴; 다양성은 *병렬 필드 아닌 속성*=태그 G 에 — 단일 척추).
   *   유전은 *이산* 정보다(연속 필드는 번져 정보를 못 지킨다 — Schrödinger "비주기 결정") — G 는 Uint8 이산 태그, R 은 담체.
   * 표현형: fit(tag) = geneFit0 + geneFitStep·(tag−1) = 복제 propensity(0~1). 높은 태그가 빨리 복제 → 선택이 평균 적합도를
   *   올린다(geneFitStep=0 이면 중립=드리프트). genotype→phenotype 맵은 authored type 분기가 아니다 — E 동역학은 태그로
   *   안 갈리고(필드는 여전히 E), 복제 *속도*만 태그의 함수다. 활성도(E flux)는 여전히 측정으로 환원(척추 체크 2).
   * 국소(척추 체크 3): 주형은 제 4이웃(von Neumann)만 본다(전역 조율자 0). tick 시작 스냅샷(Gbuf)에서 주형을 읽어
   *   같은 tick scan-order 연쇄 폭주를 막는다 — 한 tick = 한 세대. 빈 칸(G==0) 경쟁은 scan 먼저 온 주형이 차지(국소 자원경쟁).
   * 순환(척추 체크 4): 풍화(⑤ kWeather)가 R 을 깎아 R < geneClear 면 G=0(기질이 사라지면 유전 정보도 소멸 — 정보는 저장
   *   극단에만; 소산 극단 불꽃은 흐름이 패턴을 지운다). 빠른 복제(개체 척도) + 느린 풍화(세계 척도) = 유전 정보의 순환.
   * 장부: 복제는 E→R 쌍 거래뿐(G 태그는 거래 0 — 정보지 에너지 아님). sumE+M+R+… 식 불변(잔차 동일). */
  var GENE_VN = [[0, -1], [0, 1], [-1, 0], [1, 0]];   // 복제 이웃(4-근방) — scan 순서 고정(결정론·먼저 온 주형이 빈칸 차지)
  function replicate(sim) {
    var p = sim.p; if (p.kTemplate === 0) return;   // off: replicate no-op. geneInit 은 *건드리지 않는다* — A(읽기전용 측정·재베이스라인 필요)와 달리 G 는 *지속 상태*다:
                                                    //   spawnGene 으로 심은 G 가 있으면(geneInit=true) kTemplate 을 꺼도 그 유전형이 해시에 남아야 한다(faithful fingerprint, sticky).
                                                    //   kTemplate=0·미파종이면 geneInit 기본 false 유지 → G skip(과거 골든 std@/endo@/cwd@/fsm@/flux@ 불변).
    sim.geneInit = true;
    var E = sim.E, R = sim.R, G = sim.G, Gb = sim.Gbuf, W = p.W, H = p.H, N = W * H;
    var rate = p.geneRate, gThr = p.geneThresh, mu = p.geneMu, nG = p.geneTypes;
    var f0 = p.geneFit0, fStep = p.geneFitStep, gClr = p.geneClear, seed = sim.seed, tick = sim.tick;
    var reps = 0, muts = 0, i;
    /* 0. 유전 소거(풍화로 기질 사라진 칸의 태그 제거) + tick 시작 주형 스냅샷(Gb) — 같은 tick 연쇄 폭주 방지(한 tick=한 세대). */
    for (i = 0; i < N; i++) { if (G[i] !== 0 && R[i] < gClr) G[i] = 0; Gb[i] = G[i]; }
    /* 1. 복제 — 각 주형(Gb≠0 & R≥gThr)이 4이웃 빈칸(G==0, 기질 E≥rate)에 propensity=fit 로 침착·태그 복사(±변이). */
    for (var y = 0; y < H; y++) {
      for (var x = 0; x < W; x++) {
        i = y * W + x;
        var g = Gb[i]; if (g === 0 || R[i] < gThr) continue;
        var fit = f0 + fStep * (g - 1); if (fit > 1) fit = 1; else if (fit < 0) fit = 0;
        for (var d = 0; d < 4; d++) {
          var nx = (x + GENE_VN[d][0] + W) % W, ny = (y + GENE_VN[d][1] + H) % H, j = ny * W + nx;
          if (G[j] !== 0) continue;            // 이미 태그(live) — 먼저 온 주형이 차지(국소 자원경쟁, scan 순서)
          if (E[j] < rate) continue;           // 기질 부족 — 복제할 E 가 없다(자원 문턱 → 경쟁=선택)
          var h = K.tumbleHash(nx, ny, tick, seed);
          if ((h >>> 16) * (1 / 65536) >= fit) continue;   // 발화 propensity = 적합도(표현형) — 고비트
          E[j] -= rate; R[j] += rate;          // E→R 쌍 거래(닫힌 장부 — 결정화와 같은 경계)
          var tag = g, mb = h & 0xffff;
          if (mb * (1 / 65536) < mu) {         // 복제오류 = 변이(시드 의사난수) — ±1 이웃 태그로(wrap)
            tag = ((g - 1 + ((mb & 1) ? 1 : nG - 1)) % nG) + 1; muts++;
          }
          G[j] = tag; reps++;
        }
      }
    }
    sim.geneReps += reps; sim.geneMut += muts;   // 누적 복제·변이(통계 — 장부 무관)
  }

  /* ⑤b 점화·연소·소진(step-0011) — 구동 내생화. kIgnite=0 이면 통째로 건너뜀(회귀 0, stars 불변).
   * 별 = 활성도 축의 *소산 극단*(SPINE 결정2). 닫힌 고리: 저장체 R 이 임계를 넘으면 *세계 안에서* 점화
   * (R→연료, 쌍 거래) → 연료를 E 로 태우며 국소 봉우리가 되고(연료→E, 쌍 거래) → 소진하면 꺼진다(비가역, 결정3).
   * 태운 E 가 퍼져(①확산) 다른 곳에 R 로 굳고(⑤결정화)→새 별이 거기서 점화→봉우리 *명멸·이동*. 외부 고정 source
   * (영구 전역 봉우리)가 사라져 개체군이 수렴할 점이 없어진다. 새 외부 항 없음 — injected 불변, F 가 순잔액:
   *   sumE + M + R + F + evap + sunk + metab − injected = E0  (별 없으면 F=0 → step-0010 장부 식과 동일).
   * 결정4(속성–필드–국소반응): 별은 fuel 속성 + 로컬 R 문턱(내 칸 R>ignThresh 면 점화)으로만 판정 — 전역 조율자 0. */
  var STAR_DIR = [[1, 0], [-1, 0], [0, 1], [0, -1]];   // 서행 방향(4이웃) — 점화 시 tumbleHash 로 하나 고른다
  var ASH_LINGER = 20;   // 재(ash) 불응기 길이(고정 상수, 노브 아님) — 식는 ember 가 점화 슬롯을 점유하는 tick 수.

  function ignite(sim) {
    var p = sim.p; if (p.kIgnite === 0) return;
    var E = sim.E, R = sim.R, W = p.W, H = p.H, stars = sim.stars;
    var starRate = p.starRate, dPer = p.starDriftPeriod;
    /* 1. 각 별의 한 tick: 주입(연료→E, disc — sim.injected 로 경계 추적) → 소진 판정 → 서행(정한 방향 주기마다 한 칸).
     *    별은 *외부 질량(연료)을 태워 장에 주입하며 서행하는 채식지*다 — 생명이 그 E 봉우리를 쫓는다(churn 엔진). */
    var alive = [], fsm = p.kFSM !== 0;
    for (var s = 0; s < stars.length; s++) {
      var st = stars[s], cells = st.cells, nc = cells.length;
      if (st.state === 2) {                                     // 재(ash) — 식는 ember: 주입 0·정지. ASH_LINGER tick 머물다 제거(비가역·불응기).
        if (++st.ashAge >= ASH_LINGER) { sim.starDeaths++; continue; }   //   점화 슬롯을 점유해 그 자리 재점화를 막는다(흥분성 매질 refractory).
        alive.push(st); continue;
      }
      /* 주입율 — FSM on 이면 상태 배수(living=livingFrac, burning=1), off 면 원본(비트 동일: burnMul undefined). */
      var want = (st.burnMul !== undefined ? starRate * st.burnMul : starRate) * nc, inj = st.fuel < want ? st.fuel : want, per = inj / nc;
      for (var bc = 0; bc < nc; bc++) E[cells[bc]] += per;
      st.fuel -= inj; sim.injected += inj; sim.burned += inj;
      if (st.fuel <= 1e-9) {                                    // 연료 소진(느린 변수) — FSM 이면 burning→ash(머문다), 아니면 즉시 꺼짐(비트 동일).
        if (fsm) { st.state = 2; st.burnMul = 0; st.ashAge = 0; alive.push(st); }
        else sim.starDeaths++;
        continue;
      }
      /* 서행 — burning 만 떠돈다(FSM on). living(kindling)은 정지해 핫코어를 쌓고, FSM off 면 늘 떠돈다(비트 동일).
       * 위치만 바꿈(거래 0). 점화 시 정한 방향으로 주기마다 한 칸 — 서행 봉우리를 생명이 따라온다. */
      st.age++;
      if (st.age % dPer === 0 && (st.state === undefined || st.state === 1)) {
        var nx = (st.x + st.vx + W) % W, ny = (st.y + st.vy + H) % H;
        st.x = nx; st.y = ny; st.center = ny * W + nx; st.cells = K.discCells(W, H, nx, ny, p.starR);
      }
      alive.push(st);
    }
    sim.stars = stars = alive;
    /* 2. 점화 — 저장체 R 이 ignThresh 를 넘은 셀 중, 기존 별과 starGap 이상 떨어진 *최강 R 핵*에서 새 별 1개가
     *    태어난다(starCap 까지, tick 당 최대 1). 위치는 내생(R 누적), 방향은 tumbleHash(시드 결정 의사난수), 연료는
     *    외부 할당(starFuel0). R 은 *소비하지 않는다* — 별이 선 자리의 표식일 뿐(주입형: 별 에너지는 제 질량에서). */
    if (stars.length < p.starCap) {
      var ignThresh = p.ignThresh, starGap2 = p.starGap * p.starGap;
      var bestR = ignThresh, bi = -1, bx = 0, by = 0;
      for (var y = 0; y < H; y++) {
        for (var x = 0; x < W; x++) {
          var i = y * W + x;
          if (R[i] <= bestR) continue;
          var ok = true;                              // 기존 별과 너무 가까우면 skip(국소 거리만)
          for (var k = 0; k < stars.length; k++) {
            var dx = Math.min((x - stars[k].x + W) % W, (stars[k].x - x + W) % W);
            var dy = Math.min((y - stars[k].y + H) % H, (stars[k].y - y + H) % H);
            if (dx * dx + dy * dy < starGap2) { ok = false; break; }
          }
          if (!ok) continue;
          bestR = R[i]; bi = i; bx = x; by = y;
        }
      }
      if (bi >= 0) {
        var d = STAR_DIR[K.tumbleHash(bx, by, sim.tick, sim.seed) & 3];
        var ns = { x: bx, y: by, center: bi, fuel: p.starFuel0, cells: K.discCells(W, H, bx, by, p.starR),
          vx: d[0], vy: d[1], age: 0, bornTick: sim.tick };
        if (p.kFSM !== 0) { ns.state = 0; ns.burnMul = p.livingFrac; }   // FSM on: 갓 점화 = living(kindling). off: 필드 없음(회귀).
        stars.push(ns);
        sim.starBirths++;
      }
    }
  }

  /* ⑤c 연소 FSM(별 living→burning→ash, step-0013) — kFSM=0 이면 통째로 건너뜀(회귀 0, 별 상태 필드 없음 → 해시 불변).
   * 별의 alive→dead proto-FSM(점화→소진) *가운데 burning 을 끼워* 이산 3-상태 FSM 을 완성한다(SPINE 결정3):
   *   living(갓 점화 kindling — 저활성 livingFrac·정지) →[핫코어 ≥ burnOn]→ burning(전율 1·서행) →[핫코어 < burnOff]→ ash(0·제거).
   * 핫코어 = 별 disc 평균 E(자기 throughput 의 잔열). 전이는 *문턱에서 딱 뒤집힘*(연속 변조 아님) — 활성도 배수(burnMul)가
   * 0.4→1→0 으로 *계단* 점프한다. 비가역: living→burning→ash 만(되돌림 없음·ash 는 ⑤b ignite 가 제거). 활성도로 환원:
   * burning ⟺ 전율 주입(burnMul=1) ⟺ 별 disc 의 dE/dt 가 높음 — 라벨은 그 측정의 편의 표기일 뿐(결정2 정합 (b)).
   * 히스테리시스: burnOn>burnOff(폭>0)라 경계에서 안 떨리고(anti-chatter) — 이산성이 *문턱 분리*에서 창발(결정2 정합 (c)).
   * 척추: 새 필드 없음(필드는 E·R, state 는 별 *속성* Fragment) · authored type 분기 없음(켜지는 국소 법칙=주입 배수·서행만 바뀜, 결정4) ·
   * 국소 문턱(제 disc 평균 E 만 본다, 전역 조율자 0) · 닫힌 장부(state 는 거래 0 — 주입은 ⑤b 가 fuel→E 로, 외부 질량 경계 불변).
   * combust 는 ⑤b ignite *앞*에 둔다 — 이번 tick 주입 전에 상태를 정해(이전 tick 잔열 기준) burnMul 을 ignite 가 읽는다. */
  function combust(sim) {
    var p = sim.p; if (p.kFSM === 0) return;
    var stars = sim.stars; if (!stars.length) return;
    var E = sim.E, burnOn = p.burnOn, burnOff = p.burnOff, lf = p.livingFrac;
    for (var s = 0; s < stars.length; s++) {
      var st = stars[s];
      if (st.state === undefined) { st.state = 0; st.burnMul = lf; }   // 안전 초기화(런 도중 FSM 켠 경우)
      if (st.state === 2) continue;                                   // 재(ash)는 ignite 가 ashAge 로 관리(불응기) — 전이 없음
      var cells = st.cells, nc = cells.length, sum = 0;               // 핫코어 = disc 평균 E(자기 throughput 의 잔열, 단일 셀보다 서행에 강건)
      for (var c = 0; c < nc; c++) sum += E[cells[c]];
      var hot = sum / nc;
      if (st.state === 0) {                                           // living(kindling): flashpoint(빠른 변수) 도달이면 SNAP 연소(점화 문턱 burnOn)
        if (hot >= burnOn) { st.state = 1; st.burnMul = 1; }
      } else {                                                        // burning: 핫코어가 소진 문턱 burnOff 미만으로 식으면 SNAP 재(조기 quench — 연료 남아도 꺼짐)
        if (hot < burnOff) { st.state = 2; st.burnMul = 0; st.ashAge = 0; }  //   히스테리시스: burnOn>burnOff(폭>0) → 그 사이 밴드에선 latch(안 떨림)
      }
    }
  }

  /* ⑥ 이동 — run(주화성, 구배 따라 한 칸, step-0005) + tumble(step-0010, 갇히면 의사난수 한 칸).
   * 생명 off / 에이전트 0 / move off 면 통째로 건너뜀(회귀). pTumble=0 이면 tumble 분기 skip(=step-0009). */
  function move(sim) {
    var p = sim.p;
    if (!p.life || !sim.agents.length || !p.move) return;
    var W = p.W, H = p.H, E = sim.E, ag = sim.agents;
    var kL = p.kL, mMaint = p.mMaint, baseCost = p.baseCost;
    var moveOff = sim.moveOffsets, moveThresh = p.moveThresh, mocc = sim.occSet;
    var pTum = p.pTumble, tSeed = sim.seed, tTick = sim.tick;
    mocc.clear();
    for (var ms = 0; ms < ag.length; ms++) mocc.add(ag[ms].center);
    for (var mk = 0; mk < ag.length; mk++) {
      var mv = ag[mk];
      var floor = E[mv.center] + moveThresh;
      var mvx = mv.x, mvy = mv.y, bIdx = -1, bEv = floor, bX = 0, bY = 0;
      for (var mo = 0; mo < moveOff.length; mo++) {
        var mnx = (mvx + moveOff[mo][0] + W) % W, mny = (mvy + moveOff[mo][1] + H) % H;
        var mnidx = mny * W + mnx;
        if (mocc.has(mnidx)) continue;
        if (E[mnidx] > bEv) { bEv = E[mnidx]; bIdx = mnidx; bX = mnx; bY = mny; }
      }
      if (bIdx >= 0) {
        /* run — 구배가 있으면 더 높은 E 이웃으로(step-0005~0009 그대로). */
        mocc.delete(mv.center);
        mv.x = bX; mv.y = bY; mv.center = bIdx;
        mv.cells = K.discCells(W, H, bX, bY, p.lifeR);
        mocc.add(bIdx);
        sim.moves++;
        continue;
      }
      /* tumble — 갇힘(구배 없음=국소 최대) → 굶주린 생명이 의사난수 방향 한 칸(옅은 골짜기 건너기).
       * 굶주림 게이트: 입(disc)의 예측 흡수 < 이번 tick 비용이면 net 손실 — 도박할 만하다. 잘 먹는 정착 생명은 안 함. */
      if (pTum !== 0) {
        var mcells = mv.cells, intake = 0;
        for (var ic = 0; ic < mcells.length; ic++) intake += E[mcells[ic]];
        intake *= kL;
        var hcost = mv.m * mMaint + baseCost;
        if (intake < hcost) {                       // 굶주림 — net 손실 중
          var empties = sim.tumbleBuf; empties.length = 0;   // 빈 이웃 [idx,x,y] (재사용 버퍼)
          for (var to = 0; to < moveOff.length; to++) {
            var tnx = (mvx + moveOff[to][0] + W) % W, tny = (mvy + moveOff[to][1] + H) % H;
            var tnidx = tny * W + tnx;
            if (!mocc.has(tnidx)) empties.push(tnidx, tnx, tny);
          }
          var nE = empties.length / 3;
          if (nE > 0) {
            var hsh = K.tumbleHash(mvx, mvy, tTick, tSeed);
            if ((hsh >>> 16) * (1 / 65536) < pTum) {       // 발화(rate) — 고비트
              var pick = ((hsh & 0xffff) % nE) * 3;        // 방향 — 저비트(균등)
              mocc.delete(mv.center);
              mv.x = empties[pick + 1]; mv.y = empties[pick + 2]; mv.center = empties[pick];
              mv.cells = K.discCells(W, H, mv.x, mv.y, p.lifeR);
              mocc.add(empties[pick]);
              sim.tumbles++;
            }
          }
        }
      }
    }
  }

  /* ⑥b 혼잡(밀도 의존 자기제한, step-0012) — kCrowd=0 이면 통째로 건너뜀(회귀 0, agents·장부 불변).
   * 내생 구동(별)은 동결을 풀었으나 carrying capacity 가 없어 생명이 과증식→공멸했다(step-0011 §5). 이 법칙은
   * 그 *음성 피드백*을 더한다: 각 생명이 *국소 밀도*(crowdR disc 안의 다른 생명 수)에 비례한 추가 대사세를 낸다 —
   * 붐비면 net 손실이 커져(흡수<비용) 솎이고, 다음 ⑦생명에서 m<mDeath 면 죽는다(죽음 처리는 ⑦에 위임 — 중복 없음).
   * 이것이 로지스틱 자기제한이다: 국소 밀도가 높을수록 1인당 생존이 어려워져 개체군이 *국소* 수용력으로 수렴한다.
   * 척추: 새 필드 없음(필드는 여전히 E) · authored 분기 없음(연속 활성도 변조) · 국소 문턱(이웃만 셈, 전역 조율자 0) ·
   * 닫힌 장부(혼잡세는 m→metabolized 쌍 거래, baseCost 와 같은 소산 경계 — sumE+M+R+…+metab−inj=E0 불변). */
  function crowd(sim) {
    var p = sim.p; if (p.kCrowd === 0) return;
    if (!p.life || !sim.agents.length) return;
    var ag = sim.agents, W = p.W, H = p.H, kC = p.kCrowd;
    /* crowdR disc 오프셋(중심 제외) — 노브 변경 시에만 재계산, sim 에 캐시(상태 아님 → 해시·회귀 무관). */
    var offs = sim.crowdOffsets;
    if (!offs || sim.crowdOffR !== p.crowdR) { offs = sim.crowdOffsets = K.discOffsets(p.crowdR); sim.crowdOffR = p.crowdR; }
    var occ = sim.crowdGrid, NG = W * H;
    if (!occ || occ.length !== NG) occ = sim.crowdGrid = new Uint16Array(NG);
    else occ.fill(0);
    for (var k = 0; k < ag.length; k++) occ[ag[k].center]++;   // 점유 그리드(보통 셀당 1)
    for (var k2 = 0; k2 < ag.length; k2++) {
      var a = ag[k2], ax = a.x, ay = a.y, dens = 0;
      for (var o = 0; o < offs.length; o++) {
        var nx = (ax + offs[o][0] + W) % W, ny = (ay + offs[o][1] + H) % H;
        dens += occ[ny * W + nx];
      }
      if (dens === 0) continue;
      var tax = kC * dens;                                     // 혼잡 대사세(절대) — 밀도 비례
      if (tax > a.m) tax = a.m;
      a.m -= tax; sim.metabolized += tax;                      // 소산(스트레스 호흡, 닫힌 장부 sink)
    }
  }

  /* ⑦ 생명(흡수·유지·사망) — step-0006 그대로. cost = m·mMaint + baseCost. survivors 를 sim.agents 로 넘긴다
   * (원본은 생명 블록 끝에서 한 번 대입했지만, 여기선 ⑦ 끝에 대입 → ⑧ 번식이 그 배열을 읽고 push: 비트 동일). */
  function metabolize(sim) {
    var p = sim.p;
    if (!p.life || !sim.agents.length) return;
    var E = sim.E, ag = sim.agents, kL = p.kL, mMaint = p.mMaint, mDeath = p.mDeath, baseCost = p.baseCost;
    var survivors = [];
    for (var k = 0; k < ag.length; k++) {
      var a = ag[k], cells = a.cells;
      var got = 0;
      for (var c = 0; c < cells.length; c++) {
        var idx = cells[c], take = E[idx] * kL;
        E[idx] -= take; got += take;
      }
      a.m += got;
      var cost = a.m * mMaint + baseCost;
      if (cost > a.m) cost = a.m;
      a.m -= cost; sim.metabolized += cost;
      if (a.m < mDeath) {
        E[a.center] += a.m; a.m = 0;
        a.deathTick = sim.tick; sim.deaths++;
      } else {
        survivors.push(a);
      }
    }
    sim.agents = survivors;
  }

  /* ⑧ 번식 — repro off 면 건너뜀. 분열 = 생물량 내부 분배(부모 m/2 + 자식 m/2). step-0004 그대로.
   * sim.agents(=⑦의 survivors)를 직접 읽고 push — 원본의 survivors push 와 동일 배열·동일 순서. */
  function reproduce(sim) {
    var p = sim.p;
    if (!p.life || !p.repro) return;
    var W = p.W, H = p.H, E = sim.E, survivors = sim.agents;
    var mDiv = p.mDiv, divOff = sim.divOffsets, popCap = p.popCap, occ = sim.occSet;
    occ.clear();
    for (var s = 0; s < survivors.length; s++) occ.add(survivors[s].center);
    var nDiv = survivors.length;
    for (var s2 = 0; s2 < nDiv; s2++) {
      var par = survivors[s2];
      if (par.m < mDiv) continue;
      if (survivors.length >= popCap) break;
      var px = par.x, py = par.y, bestIdx = -1, bestE = -Infinity, bestX = 0, bestY = 0;
      for (var o = 0; o < divOff.length; o++) {
        var nx = (px + divOff[o][0] + W) % W, ny = (py + divOff[o][1] + H) % H;
        var nidx = ny * W + nx;
        if (occ.has(nidx)) continue;
        if (E[nidx] > bestE) { bestE = E[nidx]; bestIdx = nidx; bestX = nx; bestY = ny; }
      }
      if (bestIdx < 0) continue;
      var half = par.m * 0.5;
      par.m = half;
      survivors.push({
        x: bestX, y: bestY, m: half,
        cells: K.discCells(W, H, bestX, bestY, p.lifeR),
        center: bestIdx, bornTick: sim.tick
      });
      occ.add(bestIdx);
      sim.births++;
    }
  }

  /* ⑨ 활성도 계량(flux, step-0014) — kFlux=0 이면 통째로 건너뜀(회귀 0, A·Eprev·fluxInit 불변 → 해시 가법 skip).
   * SPINE 결정1(척추 변수 = flux): 척추 변수 E 의 *통과 throughput*(net dE/dt — 단위 tick 당 그 칸에서 처리되는 에너지량,
   *   차이슨 energy rate density 의 게임화)을 매 tick 측정해 활성도 필드 A 로 EMA 적분한다. 재고(E)와 흐름(A=dE/dt)을
   *   분리해 *읽어낸다* — A 가 곧 활성도 연속축(SPINE 결정2 "이분 enum 아닌 연속축의 두 극단").
   * SPINE 결정2(분류는 측정으로 창발): A 위에서 저장체(R 잠김·흐름 끊김 → A≈0, "존재")와 소산(별 연소·흐름 격렬 → A 높음,
   *   "흐름 있어야 존재")이 *측정으로* 갈린다 — 코드에 종류(enum)를 안 박는다. 같은 stored E 라도 흐름이 지나면 소산, 끊기면
   *   저장체(활성도가 정체성을 가른다, 이름이 아니라). flux 는 그 측정을 명시적 필드로 만든다.
   * 척추: 새 *구동* 필드 없음(A 는 *읽기 전용 계기* — E/R/agent 에 되먹이지 않아 단일 척추 유지) · authored type 분기 없음
   *   (A 는 E 만으로 계산, R/별 라벨 안 읽음 — 분류는 verify 가 A 를 *읽어* 창발 확인) · 국소(셀별 dE/dt, 전역 조율자 0) ·
   *   장부 무관(A 는 에너지 아닌 *속도* — 거래 0, 잔차 불변). LAW_ORDER *맨 끝* — 이번 tick 모든 법칙 적용 후 net dE/dt 측정.
   * Eprev = 직전 tick 끝(=이번 tick 시작) E. 첫 활성 tick 은 기준선만 잡고 측정 skip(|E−0| 스파이크 회피). */
  function flux(sim) {
    var p = sim.p; if (p.kFlux === 0) { sim.fluxInit = false; return; }   // off: fluxInit 리셋 → 해시 A 가법 skip(토글-off 도 step-0013 동일)·재활성 시 기준선 재설정(스파이크 회피)
    var E = sim.E, A = sim.A, Ep = sim.Eprev, N = p.W * p.H, a = p.aFlux, j;
    if (!sim.fluxInit) { for (j = 0; j < N; j++) Ep[j] = E[j]; sim.fluxInit = true; return; }
    var b = 1 - a, sumA = 0, peakA = 0;
    for (var i = 0; i < N; i++) {
      var thru = E[i] - Ep[i]; if (thru < 0) thru = -thru;   // |dE/dt| — 이 칸을 통과한 net flux(throughput)
      var ai = b * A[i] + a * thru;                          // EMA 적분 → 활성도(연속축 위 한 점)
      A[i] = ai; Ep[i] = E[i];                               // Ep 갱신: 다음 tick 의 시작 기준
      sumA += ai; if (ai > peakA) peakA = ai;
    }
    sim.fluxSum = sumA; sim.fluxPeak = peakA;                // 통계(상태 아님 재계산값 — 세계 활성도 총량/최고)
  }

  /* 순서 단일 출처(척추 결정: 순서 불변). step() 은 이 배열을 그대로 순회한다.
   * ⑤b 점화(ignite)는 ⑤결정화 뒤·⑥이동 앞 — 갓 굳은 R 을 읽어 점화하고, 별이 만든 봉우리를 생명이 같은 tick 에 쫓는다.
   * ⑤c 연소(combust)는 ⑤b ignite 앞 — 이번 tick 주입 전에 별 상태를 정해(이전 tick 잔열 기준) burnMul 을 ignite 가 읽는다.
   * ⑥b 혼잡(crowd)은 ⑥이동 뒤·⑦생명 앞 — 이동으로 정해진 자리의 국소 밀도로 혼잡세를 매기고, 죽음은 ⑦이 처리한다.
   * ⑤d 복제(replicate)는 ⑤결정화 뒤·⑤c 연소 앞 — 직전 결정화가 만든 R 주형을 읽어 E→R 로 자기복제한다(저장 형성 군집).
   * ⑨ 계량(flux)은 *맨 끝* — 이번 tick 모든 법칙이 E 를 바꾼 *뒤* net dE/dt 를 재야 한 tick 전체의 throughput 이 된다. */
  var LAW_ORDER = [diffuse, evaporate, drive, crystallize, replicate, combust, ignite, move, crowd, metabolize, reproduce, flux];

  var api = {
    DEFAULTS: DEFAULTS, LAW_ORDER: LAW_ORDER,
    diffuse: diffuse, evaporate: evaporate, drive: drive, crystallize: crystallize, replicate: replicate,
    combust: combust, ignite: ignite, move: move, crowd: crowd, metabolize: metabolize, reproduce: reproduce, flux: flux
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else global.HWS_LAWS = api;
})(typeof window !== 'undefined' ? window : globalThis);
