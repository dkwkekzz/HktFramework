// ============================================================================
// 엔트로픽 이완 커널 — A9 (설계: Docs/Design-EntropicFlow.md)
//
// 공리 ①: 에너지의 흐름에는 별다른 논리가 없다 — 엔트로피에 따라 높은 확률로 흩어질 뿐이다.
// 개별 양자가 "빈 쪽으로 num/den 확률로 이동"하는 것을 다수에 대해 평균 내면 **구배 비례 이체**
// (Fick 확산 = 엔트로피 증가의 거시 형태)가 된다. 이 mean-field 형태를 유일 커널로 삼는다:
//   흐름/누수 = floor(구배 × num/den).
//
// 결정론·정수·보존은 검증하지 않는다 — 모든 흐름이 ledger.transfer 클램프를 지나므로 자료구조가
// 강제한다. num/den ≤ 1/2 여야 오버슛·진동 없이 평형으로 단조 수렴한다.
//
// 서버·클라 공용 순수 모듈 (Node/DOM API 의존 0 · 무작위 금지 — mean-field 는 결정론적).
// ============================================================================

// (A) 두 풀 사이 이완 — 높은 쪽 → 낮은 쪽. 필드 확산(A1)이 이 커널의 특수해다.
//     같은 용량(max) 풀 사이에서는 잔고 구배가 곧 점유율 구배다. 서버 내부(무방송) 이체에 쓴다.
export function relaxGradient(ledger, aId, bId, num, den, cause) {
  const grad = ledger.balance(aId) - ledger.balance(bId);
  if (grad === 0) return 0;
  const amount = Math.floor(Math.abs(grad) * num / den);
  if (amount <= 0) return 0;
  return grad > 0
    ? ledger.transfer(aId, bId, amount, cause)
    : ledger.transfer(bId, aId, amount, cause);
}

// (B) 최대엔트로피 저수지(SINK)로의 이완량 — 순수 함수(양만 반환).
//     SINK 는 엔트로피 바닥(유효 퍼텐셜 0)이라, 집중된 질서와의 구배가 곧 그 풀의 잔고다.
//     → 누수 = floor(잔고 × num/den) = "각 양자가 num/den 확률로 흩어지는" 지수 이완의 기댓값.
//     방송이 필요한 풀(소유 아이템·땅 아이템)이라, 호출측이 이 양을 #tx 로 흘려보낸다(미러 재생).
export function entropicLeak(balance, num, den) {
  return Math.floor(Math.max(0, balance) * num / den);
}

// (C) 노드 탭 — A9-3: 채집/채굴이 여는 채널의 흐름량. 손으로 쓴 상수가 아니라 노드의 집중도(잔고)
//     에서 창발한다: 풍부한 노드는 많이(floor(잔고 × num/den)), 고갈된 노드는 적게, 거의 빈 노드는 0.
//     감소 수익이 클램프가 아니라 법칙에서 나온다. **양자 바닥을 두지 않는다**(감가와 다른 점): 근접
//     빈 노드는 구배가 거의 0이라 흐름 0이 충실한 결과이고, 그래야 채취자가 고갈 노드를 떠나 풍부한
//     노드로 흩어진다(로밍이 창발). 서버·클라 공용(클라 예측도 같은 값) — 순수 결정론.
export function nodeTap(balance, num, den) {
  return entropicLeak(balance, num, den);
}
