  /* 순서 단일 출처(척추 결정: 순서 불변). step() 은 이 배열을 그대로 순회한다.
   * ⑤b 점화(ignite)는 ⑤결정화 뒤·⑥이동 앞 — 갓 굳은 R 을 읽어 점화하고, 별이 만든 봉우리를 생명이 같은 tick 에 쫓는다.
   * ⑤c 연소(combust)는 ⑤b ignite 앞 — 이번 tick 주입 전에 별 상태를 정해(이전 tick 잔열 기준) burnMul 을 ignite 가 읽는다.
   * ⑥b 혼잡(crowd)은 ⑥이동 뒤·⑦생명 앞 — 이동으로 정해진 자리의 국소 밀도로 혼잡세를 매기고, 죽음은 ⑦이 처리한다.
   * ⑤d 복제(replicate)는 ⑤결정화 뒤·⑤c 연소 앞 — 직전 결정화가 만든 R 주형을 읽어 E→R 로 자기복제한다(저장 형성 군집).
   * ⑧b 생명 유전(inherit)은 ⑧번식 뒤·⑨계량 앞 — 자식이 있어야 인접 부모에서 상속하고, 표현형세는 다음 tick ⑦생명이 사망 처리한다.
   * ⑥a 차등 응집(adhere)은 ⑥move 뒤·⑥b crowd 앞 — 먹이를 쫓은 뒤 같은 자리에서 kin 으로 정렬하고, crowd 가 그 자리 밀도를 잰다.
   * ⑥c 막 결합(couple)은 ⑥a adhere 뒤·⑥b crowd 앞 — 정렬로 묶인 액적 위에서 kin 끼리 E 를 공유하고(막 창발), crowd·생명이 그 공유된 자리에서 잰다·흡수한다.
   * ⑥d 생물량 공유(share)는 ⑥b crowd 뒤·⑦생명 앞 — crowd 가 매긴 대사세 뒤의 m 을 kin 끼리 균등화해, 굶주린 kin 을 ⑦의 사망 판정 전에 떠받친다(개체 단위 생존).
   * ⑥e 공공재 협동(pubgood)은 ⑥d share 뒤·⑦생명 앞 — 떠받침(보존) 위에 공공재(양의 합 시너지) 이득을 얹어, ⑦의 사망/흡수 전에 kin 의 m 을 키운다(번식 가속·강한 침투).
   * ⑨ 계량(flux)은 *맨 끝* — 이번 tick 모든 법칙이 E 를 바꾼 *뒤* net dE/dt 를 재야 한 tick 전체의 throughput 이 된다. */
  var LAW_ORDER = [diffuse, evaporate, drive, crystallize, replicate, combust, ignite, move, adhere, couple, crowd, share, pubgood, metabolize, reproduce, inherit, flux];

  var api = {
    DEFAULTS: DEFAULTS, LAW_ORDER: LAW_ORDER,
    diffuse: diffuse, evaporate: evaporate, drive: drive, crystallize: crystallize, replicate: replicate,
    combust: combust, ignite: ignite, move: move, adhere: adhere, couple: couple, crowd: crowd, share: share, pubgood: pubgood, metabolize: metabolize, reproduce: reproduce, inherit: inherit, flux: flux
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else global.HWS_LAWS = api;
})(typeof window !== 'undefined' ? window : globalThis);
