  /* ⑥a 차등 응집(adhere, step-0017) — kAdhesion=0 이면 통째로 건너뜀(회귀 0, agents·장부 불변 → 해시 무관).
   * SPINE §다섯째 축 다음 칸 + STATE (a): 개체(다세포='계')를 *만들지(author)* 않는다 — 차등 응집(kin↑/타↓, Steinberg
   *   차등접착 가설)이 빚은 *표면장력 액적* = flux 결합 도메인으로 *측정*해 읽는다(척추 체크 2 — 활성도 환원). 같은 유전형
   *   (kin=같은 a.g) 생명끼리 모이고 다른 태그는 밀어내, cell sorting → 같은 태그 블롭(액적)이 kin/타 경계를 최소화(표면장력)
   *   하며 창발한다. "유전이 개체보다 먼저"(SPINE) — a.g 가 정의돼야(step-0016) kin 이 정의돼 다세포가 묶인다.
   * 메커니즘(국소·위치만 — Schelling 분리 동역학): 각 생명이 빈 4이웃 후보(+머무름) 중 *응집 점수*가 최대인 칸으로 옮긴다.
   *   점수(후보 칸의 8이웃 점유를 셈) = (같은 태그 이웃 수 kin) − adhesionLambda·(다른 태그 이웃 수 타). kin 많은 자리로
   *   끌리고 타 자리를 피한다 — 강접착 세포가 안으로 모여 표면장력 액적(DAH). 머무름보다 adhesionGain 이상 *엄격히* 나아야
   *   옮김(jitter 방지). 위치만 바꿈 — 장부 거래 0(move/tumble 과 같은 경계, 잔차 불변). 무유전(a.g=0)은 kin 이 없어 안 묶임.
   * 척추: 새 *필드* 없음(kin 판정은 생명 속성 a.g — 단일 척추) · authored 분기 없음(개체를 안 만든다, 위치 바이어스만) ·
   *   국소 문턱(제 4이웃·후보 8이웃만, 전역 조율자 0) · 닫힌 장부(거래 0 — 위치만, move 와 동일).
   * ⑥a: ⑥move(주화성) 뒤·⑥b crowd 앞 — 먹이를 쫓은 뒤 같은 자리에서 kin 으로 정렬하고, crowd 가 그 정렬된 자리의 밀도를 잰다.
   *   occ(점유→태그)는 *순차 그리디*로 제자리 갱신(move/crowd 와 같은 정신) — 같은 scan 안에서 먼저 옮긴 생명을 뒤가 본다(결정론). */
  var ADHERE_VN = [[0, -1], [0, 1], [-1, 0], [1, 0]];                                   // 이동 후보(4-근방) — scan 순서 고정(결정론)
  var ADHERE_NB8 = [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]];  // 접촉 셈(8-근방, Moore)
  function adhScore(occ, x, y, myTag, W, H, lam, selfCenter) {                          // 응집 점수 = kin − lam·타 (후보 칸 8이웃 점유 셈, 자기 칸 제외)
    var kin = 0, non = 0;
    for (var d = 0; d < 8; d++) {
      var nx = (x + ADHERE_NB8[d][0] + W) % W, ny = (y + ADHERE_NB8[d][1] + H) % H, idx = ny * W + nx;
      if (idx === selfCenter) continue;                                                // 옮겨갈 생명의 *떠날* 자리는 세지 않는다
      var t = occ[idx]; if (t <= 0) continue;                                          // -1 빈칸·0 무유전 → 접촉 아님(kin 정체성 없음)
      if (t === myTag) kin++; else non++;
    }
    return kin - lam * non;
  }
  function adhere(sim) {
    var p = sim.p; if (p.kAdhesion === 0) return;
    if (!p.life || !sim.agents.length) return;
    var ag = sim.agents, W = p.W, H = p.H, N = W * H, lam = p.adhesionLambda, gain = p.adhesionGain;
    var occ = sim.adhereOcc; if (!occ || occ.length !== N) occ = sim.adhereOcc = new Int16Array(N);
    occ.fill(-1);                                                                      // -1 = 빈칸. 점유 칸엔 태그(0=무유전, >0=유전형)
    for (var i = 0; i < ag.length; i++) occ[ag[i].center] = ag[i].g | 0;
    var moved = 0;
    for (var k = 0; k < ag.length; k++) {
      var a = ag[k], myTag = a.g | 0, ax = a.x, ay = a.y, ac = a.center;
      var best = adhScore(occ, ax, ay, myTag, W, H, lam, ac) + gain;                   // 머무름 기준 + 문턱(엄격한 개선만 옮김)
      var bIdx = -1, bX = 0, bY = 0;
      for (var d = 0; d < 4; d++) {
        var nx = (ax + ADHERE_VN[d][0] + W) % W, ny = (ay + ADHERE_VN[d][1] + H) % H, nidx = ny * W + nx;
        if (occ[nidx] !== -1) continue;                                               // 빈칸만(점유 칸엔 못 들어간다)
        var sc = adhScore(occ, nx, ny, myTag, W, H, lam, ac);
        if (sc > best) { best = sc; bIdx = nidx; bX = nx; bY = ny; }
      }
      if (bIdx >= 0) {                                                                 // kin 접촉이 늘어나는 빈칸으로 — 위치만(장부 거래 0)
        occ[ac] = -1; occ[bIdx] = myTag;
        a.x = bX; a.y = bY; a.center = bIdx; a.cells = K.discCells(W, H, bX, bY, p.lifeR);
        moved++;
      }
    }
    sim.adheres += moved;                                                              // 누적 응집 이동(통계 — 위치 변경이라 장부 무관)
  }

  /* ⑥c 막/flux 결합 도메인(couple, step-0018) — kMembrane=0 이면 통째로 건너뜀(회귀 0, E 불변 → org@ 비트 동일·새 해시 항 0).
   * SPINE 주요 전이 사다리 "다세포(개체)=flux 결합 도메인" + STATE 형태 사다리 R1: step-0017 의 액적은 `measureOrganisms` 가
   *   그은 *측정 윤곽*일 뿐이었다(정직한 한계 #2 — 내부 E 공유·공통 경계 없음). 이 법칙은 그 액적을 *물리적 flux 결합 도메인*으로 올린다:
   *   같은 유전형(kin=같은 a.g)으로 4-인접한 생명끼리 *제 칸의 필드 E 를 국소 공유·재분배*한다 → 액적 내부 E 가 균질해지고(공유 larder),
   *   주변과의 경계엔 단차(막)가 *창발*한다. "막"·"표면장력"을 코드에 박지 않는다 — kin E 공유라는 국소 법칙만 깔면 막은 액적의 *표면*으로
   *   창발(개체 먼저·막 뒤, 0017 설계결정 4의 연장). 무유전(a.g=0)은 kin 정체성이 없어 공유 안 함("유전이 개체보다 먼저").
   * 메커니즘(국소·E 재분배·쌍 거래 보존): 각 4-인접 kin 쌍(같은 태그·인접 center)의 E 차이를 kMembrane 비율만큼 균등화한다 —
   *   d = (E[c]−E[nb])·kMembrane·0.5 를 c→nb 로 옮긴다(나간 만큼 들어옴 → sumE 불변, 거래 0). 우/하 변만 훑어 쌍을 한 번씩만(중복 0).
   *   adhere(위치만)와 달리 *실제 E 재분배*지만(0015·0016 처럼 실변환), 쌍 거래라 닫힌 장부·임계 자기조직 보존(잔차 불변).
   * 척추: 새 *필드* 없음(같은 E 를 공유 — 막은 창발·kin 은 a.g 속성, 단일 척추) · authored 개체 분기 없음(couple 은 *국소 쌍* 법칙 —
   *   전역 `measureOrganisms` 를 동역학에 안 씀 → "측정은 읽기전용" 정전 사실 보존; kin 인접 게이트는 adhere/inherit 와 같은 속성 게이트) ·
   *   국소 문턱(제 4-인접 kin 쌍만, 전역 조율자 0) · 닫힌 장부(쌍별 E 균등화 = 거래 0, move/adhere 와 같은 경계).
   * ⑥c: ⑥a adhere(kin 정렬) 뒤·⑥b crowd 앞 — 정렬로 묶인 액적 위에서 kin 끼리 E 를 모으고, 다음 ⑦생명이 그 공유된 자리에서 흡수한다.
   *   순차(occ 제자리·scan=agent 배열 순서)라 같은 패스에서 먼저 옮긴 E 를 뒤가 본다(Gauss-Seidel, 결정론 — Math.random 금지). */
  function couple(sim) {
    var p = sim.p; if (p.kMembrane === 0) return;
    if (!p.life || !sim.agents.length) return;
    var ag = sim.agents, E = sim.E, W = p.W, H = p.H, N = W * H, k = p.kMembrane * 0.5;
    var occ = sim.coupleOcc; if (!occ || occ.length !== N) occ = sim.coupleOcc = new Int16Array(N);
    occ.fill(0);                                                                       // 0 = 무점유/무유전(kin 정체성 없음 → 공유 제외)
    for (var i = 0; i < ag.length; i++) { var g = ag[i].g | 0; if (g > 0) occ[ag[i].center] = g; }
    var shared = 0;
    for (var s = 0; s < ag.length; s++) {
      var a = ag[s], t = a.g | 0; if (t <= 0) continue;
      var c = a.center, x = a.x, y = a.y;
      var rc = c - x + (x + 1) % W;                                                    // 우(+x) 이웃 center
      var dc = ((y + 1) % H) * W + x;                                                  // 하(+y) 이웃 center (우/하만 — 쌍 중복 방지)
      if (occ[rc] === t) { var d1 = (E[c] - E[rc]) * k; E[c] -= d1; E[rc] += d1; shared += d1 < 0 ? -d1 : d1; }
      if (occ[dc] === t) { var d2 = (E[c] - E[dc]) * k; E[c] -= d2; E[dc] += d2; shared += d2 < 0 ? -d2 : d2; }
    }
    sim.coupled += shared;                                                             // 누적 공유 flux(통계 — 쌍 거래라 장부 무관)
  }

  /* ⑥d 생물량 공유(share, step-0019) — kShare=0 이면 통째로 건너뜀(회귀 0, m 불변 → mem@ 비트 동일·새 해시 항 0).
   * SPINE §다섯째 축 "개체를 *중립에서 적응으로*" + STATE (a) 개체↔대사 *차등* 결합: step-0018 의 couple 은 *필드 E* 를 kin 끼리 균일하게
   *   공유해 개체에 *개체군 이득*(공유 larder → carrying capacity↑·개체 커짐)을 줬으나 — 모든 kin 이 똑같이 공유(분업 없음)라 *선택압*은 0이었다
   *   (개체군 이득 ≠ 개체군 선택; kin selection 의 *맹아*지 선택 자체 아님). 이 법칙은 그 larder 를 *차등*으로 만든다: kin 끼리 공유하는 것을 *필드 E*
   *   가 아니라 *생물량 m*(대사 재고 — 사망/번식을 직접 가르는 양)으로, 그 공유 강도를 *유전형의 함수*(coop)로. 협동 유전형(coop>0)은 굶주린 kin
   *   (같은 유전형)을 사망 직전 떠받쳐(risk-pooling — m 균등화) 도메인이 *단위로* 생존하고, 그 kin 이 같은 협동 유전형을 실어 *번진다*(Hamilton 포괄적합도).
   *   배신 유전형(coop=0)은 안 떠받쳐 굶주린 동료가 죽는다. *단 kin 이 뭉쳐야*(adhere=높은 혈연도 r) 협동자가 협동자 곁에 서 공유가 일어난다(rb>c).
   *   → "공유하는 유전형 vs 안 하는 유전형의 차등 적합도"(0018 정직한 한계 #2)가 생겨 개체성이 *중립에서 적응으로*. 협동을 *복제 적합도(fit)와 분리*
   *   (coop = 별 표현형 맵)해야 confound 없이 kin selection 만 잰다.
   * 메커니즘(국소·m 재분배·쌍 거래 보존 — *균등화 아니라 표적 구조(targeted rescue)*): 각 4-인접 kin 쌍(같은 태그·인접 center) 중
   *   *한쪽만 사망권*(m < dangerLine = mDeath·SHARE_BAND)이고 다른 쪽이 안전하면, 안전한 협동자가 *제 잉여*(m−dangerLine)로 굶주린 kin 을
   *   dangerLine 까지 떠받친다: d = min(dangerLine−m[궁핍], m[부유]−dangerLine)·kShare·coop 를 부유→궁핍으로(나간 만큼 들어옴 → sumM 불변).
   *   *균등화*(couple 식)가 아니다 — 균등화는 부유 kin 을 mDiv 밑으로 끌어내려 번식을 깎아(협동 비용↑) 선택 우위를 지운다. 표적 구조는
   *   궁핍한 kin 의 *결손분*(작음)만 메워 부유 kin 의 번식을 거의 안 깎으면서(비용↓) 사망을 막는다(이득↑) → b>c 로 협동이 *선택*된다.
   *   occIdx(center→agent index)로 이웃 *생명*을 찾는다(couple 은 필드 E[cell] 이라 셀 인덱스로 족했으나, m 은 *생명* 속성이라 점유 생명을 찾아야 함).
   * 척추: 새 *필드* 없음(m 은 기존 생물량, coop 은 a.g 속성의 표현형 — 단일 척추) · authored 분기 없음(공유 *세율*만 coop 의 함수, E 동역학·활성도는
   *   태그로 안 갈림 — inherit 의 차등 대사세와 같은 정합) · 국소 문턱(제 4-인접 kin 쌍만, 전역 조율자 0) · 닫힌 장부(m 쌍 거래 = 나간 만큼 들어옴, couple 과 같은 경계).
   * ⑥d: ⑥b crowd(밀도세) 뒤·⑦생명(흡수·사망) 앞 — crowd 가 매긴 대사세 *뒤*의 m 을 보고, 굶주린 kin 을 ⑦의 사망 판정 *전에* 떠받친다. */
  var SHARE_BAND = 3.0;                                                                // 사망권 폭(고정 상수, 노브 아님) — dangerLine = mDeath·SHARE_BAND. 이 밑이면 "궁핍"(구조 대상).
  function share(sim) {
    var p = sim.p; if (p.kShare === 0) return;
    if (!p.life || !sim.agents.length) return;
    var ag = sim.agents, W = p.W, H = p.H, N = W * H, k = p.kShare;
    var f0 = p.coopFit0, fStep = p.coopFitStep, danger = p.mDeath * SHARE_BAND;
    var occ = sim.shareOcc; if (!occ || occ.length !== N) occ = sim.shareOcc = new Int32Array(N);
    occ.fill(0);                                                                       // 0 = 무점유. 점유 칸엔 (agent index + 1)
    for (var i = 0; i < ag.length; i++) { if ((ag[i].g | 0) > 0) occ[ag[i].center] = i + 1; }
    var shared = 0;
    for (var s = 0; s < ag.length; s++) {
      var a = ag[s], t = a.g | 0; if (t <= 0) continue;
      var coop = f0 + fStep * (t - 1); if (coop > 1) coop = 1; else if (coop < 0) coop = 0;
      if (coop <= 0) continue;                                                         // 배신 유전형 — 떠받치지 않음(coop=0)
      var kc = k * coop, c = a.center, x = a.x, y = a.y;
      var rc = c - x + (x + 1) % W;                                                    // 우(+x) 이웃 center
      var dc = ((y + 1) % H) * W + x;                                                  // 하(+y) 이웃 center (우/하만 — 쌍 중복 방지)
      var ri = occ[rc]; if (ri > 0) { var b1 = ag[ri - 1]; if ((b1.g | 0) === t) shared += rescue(a, b1, danger, kc); }
      var di = occ[dc]; if (di > 0) { var b2 = ag[di - 1]; if ((b2.g | 0) === t) shared += rescue(a, b2, danger, kc); }
    }
    sim.shared += shared;                                                              // 누적 구조 생물량(통계 — 쌍 거래라 장부 무관)
  }
  /* kin 쌍 표적 구조 — 한쪽만 사망권이면 안전한 쪽이 제 잉여로 궁핍한 쪽을 dangerLine 까지 떠받친다(작은 결손분만, 번식 거의 안 깎음). */
  function rescue(a, b, danger, kc) {
    var donor, recip;
    if (a.m < danger && b.m >= danger) { donor = b; recip = a; }                       // a 궁핍·b 안전 → b 가 떠받침
    else if (b.m < danger && a.m >= danger) { donor = a; recip = b; }                  // b 궁핍·a 안전 → a 가 떠받침
    else return 0;                                                                     // 둘 다 안전이거나 둘 다 궁핍 → 구조 없음(잉여 없음)
    var need = danger - recip.m, avail = donor.m - danger;                             // 결손분 vs 잉여
    var d = (need < avail ? need : avail) * kc;                                         // 작은 쪽만큼만 — 번식 거의 안 깎음
    donor.m -= d; recip.m += d;
    return d;
  }

  /* ⑥e 공공재 협동(pubgood, step-0020) — kPublic=0 이면 통째로 건너뜀(회귀 0, m·E 불변 → share@ 비트 동일·새 해시 항 0).
   * SPINE §다섯째 축 "사회 칸" + STATE 🔴 최우선: step-0019 share 는 kin 끼리 m 을 *쌍 거래*(보존적 재분배)로 떠받쳤다 — 균등화 아닌 표적 구조라
   *   b>c 가 되긴 했으나 *보존적*(b≈c+ε)이라 협동이 *지속*만 했지(배신과 공존) 강하게 *침투*(치환)하진 못했다(0019 정직한 한계 #1). 강한 침투는
   *   *양의 합*(시너지 b≫c)을 요구한다 — 한 기부가 *여럿*을 살리는 공공재. 이 법칙은 그 공공재를 더한다:
   *   협동자(coop>0)가 제 *잉여*(m−dangerLine, 굶주리면 생산 안 함 — 자기 보호)의 kPublic·coop 만큼을 *공공재 기부* c 로 떼어, 제 4-인접 kin *여럿*에게
   *   나눠 준다 — 단 *시너지로 증폭*된다: 각 kin 은 ①기부 m 분(c/nKin, m→m 전달 — share 처럼 보존) + ②*시너지 증폭분*((syn−1)·그 m 분)을 받는데, ②는
   *   *필드 E 에서 끌어온다*(공공재가 환경 자원을 푼다 — 세포외 소화효소·협동 채식의 게임화, E→m). 한 기부 c 가 집단에 b=syn·c(>c)로 — 대칭 kin 클러스터선
   *   기부 m 분이 이웃에서 되돌아오고(손익 0) 거기에 시너지 E-이득이 얹혀 1인당 순이득 (syn−1)·c>0 → 협동자 클러스터가 환경 E 를 *더 빨리 채집*해 더 빨리
   *   번식 → 협동이 *강하게 침투*(공공재 게임). 배신자(coop=0)는 기부도·이득도 0(무임승차).
   * 왜 *kin 이 뭉쳐야*(positive assortment) 강하게 침투하나: 기부가 *이웃 kin*(같은 태그)에게만 가므로(자기 아님 — 진짜 이타·greenbeard 인식) 뭉칠수록 kin 이웃이
   *   많아 시너지 이득이 커진다(rb≫c). *단* 기부가 kin-지향(태그 인식)이라 흩어져도 *해롭진 않다*(0019 표적 구조와 달리 — 인식이 공간 assortment 를 일부 대신).
   *   즉 혈연도는 침투의 *세기*를 가른다(뭉치면 강한 침투·흩어지면 ~중립) — "kin 구조가 강한 침투보다 먼저"(0019 의 연장, 단 이번엔 흩어짐이 중립이지 음 아님).
   * 시너지는 *질량 창조가 아니다* — 이득 b 의 증폭분은 *필드 E*(별·source 가 닫힌 장부로 채운 자원)에서 끌어온 것(공공재가 잠긴 자원을 *푼다*). E 부족(기근)이면 capped(보존).
   * 척추: 새 *필드* 없음(coop 은 a.g 표현형·기부는 m→m·시너지는 기존 E→m — 단일 척추) · authored 분기 없음(기부 *세율*만 coop 의 함수, E 동역학은 태그로 안 갈림) ·
   *   국소 문턱(제 4-인접 kin·제 m·이웃 칸 E 만, 전역 조율자 0) · 닫힌 장부(기부 m→m·시너지 E→m, 둘 다 보존 경계 — 비가역 채집이되 보존, 질량 창조 0).
   * ⑥e: ⑥d share(표적 구조) 뒤·⑦생명(흡수·사망) 앞 — 떠받침(보존) *위에* 공공재(양의 합) 이득을 얹어 ⑦의 사망/흡수 전에 kin 의 m 을 키운다(번식 가속).
   *   순차(occ 제자리·scan=agent 배열 순서)라 같은 패스서 먼저 생산한 이득을 뒤가 본다(Gauss-Seidel, 결정론 — Math.random 금지). */
  function pubgood(sim) {
    var p = sim.p; if (p.kPublic === 0) return;
    if (!p.life || !sim.agents.length) return;
    var ag = sim.agents, E = sim.E, W = p.W, H = p.H, N = W * H, k = p.kPublic, syn = p.pubSynergy;
    var f0 = p.coopFit0, fStep = p.coopFitStep, danger = p.mDeath * SHARE_BAND;
    var occ = sim.pubOcc; if (!occ || occ.length !== N) occ = sim.pubOcc = new Int32Array(N);
    occ.fill(0);                                                                        // 0 = 무점유. 점유 칸엔 (agent index + 1)
    for (var i = 0; i < ag.length; i++) { if ((ag[i].g | 0) > 0) occ[ag[i].center] = i + 1; }
    var kin = sim.pubKin || (sim.pubKin = [0, 0, 0, 0]);                                // 4-근방 kin 인덱스 재사용 버퍼(상태 아님)
    var produced = 0;
    for (var s = 0; s < ag.length; s++) {
      var a = ag[s], t = a.g | 0; if (t <= 0) continue;
      var coop = f0 + fStep * (t - 1); if (coop > 1) coop = 1; else if (coop < 0) coop = 0;
      if (coop <= 0) continue;                                                          // 배신 유전형 — 공공재 생산 안 함(무임승차)
      var surplus = a.m - danger; if (surplus <= 0) continue;                           // 잉여 없음 — 굶주리며 이타 강요 안 함(자기 보호)
      var x = a.x, y = a.y, nKin = 0;
      for (var d = 0; d < 4; d++) {                                                     // 4-근방 kin 이웃 수집(같은 태그 점유 생명) — 이득을 *여럿*에게
        var nx = (x + GENE_VN[d][0] + W) % W, ny = (y + GENE_VN[d][1] + H) % H, oi = occ[ny * W + nx];
        if (oi > 0 && (ag[oi - 1].g | 0) === t) kin[nKin++] = oi - 1;
      }
      if (nKin === 0) continue;                                                         // 받을 kin 없음(흩어진 협동) → 생산 안 함(낭비 회피)
      var invest = k * coop * surplus;                                                  // 기부 c — 제 잉여에서 떼어 공공재로(이웃에게, 자기 아님 → 진짜 이타)
      a.m -= invest;
      var perM = invest / nKin;                                                         // 각 kin 에게 가는 *m 기부분*(share 처럼 m→m — 클러스터선 되돌아옴, 안 새면 손익 0)
      var perBonus = perM * (syn - 1);                                                  // *시너지 증폭분* — 필드 E 에서 채집(공공재가 환경 자원을 푼다 — 한 기부가 b=syn·c 로 커진다)
      for (var n = 0; n < nKin; n++) {
        var b = ag[kin[n]];
        b.m += perM; produced += perM;                                                  // 기부 m(m→m 전달 — 보존)
        var take = E[b.center]; if (take > perBonus) take = perBonus;                   // 시너지는 *필드 E* 에서(자원을 푼다) — E 부족(기근)이면 capped(보존)
        if (take > 0) { E[b.center] -= take; b.m += take; produced += take; }           // 시너지 E→m(흡수와 같은 경계, 닫힌 장부)
      }
    }
    sim.pubgood += produced;                                                            // 누적 공공재 이득(통계 — 기부는 m→m·시너지는 E→m, 둘 다 보존)
  }
