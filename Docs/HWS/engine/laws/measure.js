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
