/* HWS 공통 시뮬 — 커널(동결 헬퍼) + 법칙(진화하는 항)을 묶어 step 들이 쓰는 단일 코어 객체를 만든다.
 *
 * step() = LAW_ORDER 배열을 고정 순서로 순회 + tick++. 한 덩어리 step() 복사·수정의 끝 —
 *   "①~⑧ 순서 불변"은 hws-laws.js 의 LAW_ORDER 단일 출처가 보장한다. sim.laws 로 per-sim 오버라이드 가능
 *   (새 step 이 법칙을 *삽입/추가*할 때 자기 순서 배열을 줄 수 있다 — 확장점). 기본은 L.LAW_ORDER.
 *
 * 이 코어가 노출하는 메서드 표면은 step-0010/sim-core.js 와 동일하다 — engine/hws-ui.js 의 mount(core,…)·
 *   각 step 의 panel.js·verify.js 가 그대로 갈아끼워진다. createSim/step/run 만 여기, 나머지는 커널 재노출.
 *
 * 브라우저(셸 로드 순서): hws-kernel.js → hws-laws.js → hws-sim.js → hws-ui.js → (3d) → panel.js.
 *   window.HWS_SIM 가 코어. / Node: var core = require('engine/hws-sim.js').
 */
(function (global) {
  'use strict';
  var isNode = (typeof module !== 'undefined' && module.exports);
  var K = isNode ? require('./hws-kernel.js') : global.HWS_KERNEL;
  var L = isNode ? require('./hws-laws.js') : global.HWS_LAWS;

  function createSim(seed, params) {
    var p = Object.assign({}, L.DEFAULTS, params || {});
    p.source = Object.assign({}, L.DEFAULTS.source, (params && params.source) || {});
    p.sink = Object.assign({}, L.DEFAULTS.sink, (params && params.sink) || {});
    var rng = K.mulberry32(seed);
    var N = p.W * p.H;
    var E = new Float64Array(N);
    for (var i = 0; i < N; i++) E[i] = p.initE + p.noise * (rng() - 0.5);
    var E0 = 0;
    for (i = 0; i < N; i++) E0 += E[i];
    return {
      p: p, seed: seed, tick: 0,
      E: E, buf: new Float64Array(N),
      R: new Float64Array(N),                  // 저장체(굳은 흐름량). 초기 0 → kCryst=0 이면 영원히 0(회귀)
      hPot: new Float64Array(N),               // 흐름 퍼텐셜 h=E+kRelief·R 작업 버퍼(상태 아님)
      fLim: new Float64Array(N),               // donor 유출 제한 f 작업 버퍼(상태 아님)
      srcCells: K.discCells(p.W, p.H, p.source.x, p.source.y, p.source.r),
      sinkCells: K.discCells(p.W, p.H, p.sink.x, p.sink.y, p.sink.r),
      srcBase: { x: p.source.x, y: p.source.y },
      srcBaseTick: 0,
      E0: E0,                                  // 초기 총량 (장부의 기준점)
      injected: 0, evaporated: 0, sunk: 0,     // 닫힌 장부 T
      agents: [],          // 살아있는 에이전트 목록
      metabolized: 0,      // 대사로 소산된 총량
      deaths: 0,           // 누적 사망 수 (통계용)
      divOffsets: K.discOffsets(p.divR),
      occSet: new Set(),
      births: 0,           // 누적 분열(출생) 수 (통계용)
      moveOffsets: K.discOffsets(p.moveR),
      moves: 0,            // 누적 이동(run, 주화성) 수 (통계용)
      tumbles: 0,          // 누적 탐사(tumble) 수 (통계용 — 위치 변경이라 장부 무관)
      tumbleBuf: [],       // tumble 빈 이웃 [idx,x,y…] 재사용 버퍼(상태 아님 — 매 호출 비움)
      adheres: 0,          // step-0017: 누적 차등 응집 이동 수 (통계용 — 위치 변경이라 장부 무관). adhereOcc(점유→태그)는 법칙이 지연 생성.
      coupled: 0,          // step-0018: 누적 막 공유 flux 량 (통계용 — kin 쌍 E 균등화는 쌍 거래라 장부 무관). coupleOcc(점유→태그)는 법칙이 지연 생성.
      shared: 0,           // step-0019: 누적 생물량(m) 공유량 (통계용 — kin 쌍 m 균등화는 쌍 거래라 장부 무관). shareOcc(center→agent index)는 법칙이 지연 생성.
      pubgood: 0,          // step-0020: 누적 공공재 이득량 (통계용 — 비용 c=m→metabolized·이득 b=E→m, 둘 다 보존 경계라 장부 무관). pubOcc(center→agent index)는 법칙이 지연 생성.
      differentiated: 0,   // step-0021: 누적 분화 provision 량 (통계용 — 갇힌 내부 soma 가 kin 에게 m→m 쌍 거래로 기부, 보존 경계라 장부 무관). diffOcc(center→agent index)는 법칙이 지연 생성.
      germProvisioned: 0,  // step-0022: 누적 생식세포 계통 격리 provision 량 (통계용 — soma 계통이 germ kin 에게 m→m 쌍 거래로 export, 보존 경계라 장부 무관). germOcc(center→agent index)는 법칙이 지연 생성.
      germInit: false,     // step-0022: 계통 격리 활성 여부 — 해시 가법 가드(false 면 a.soma 해시 skip → 과거 골든 불변)
      sessileCount: 0,     // step-0023: 정착(고착) 생명 수 스냅샷 (통계용 — a.sessile 은 매 tick 재계산 게이트, 위치만 영향이라 장부·해시 무관). anchorOcc(점유→agent index)는 법칙이 지연 생성.
      tensionFlux: 0,      // step-0024: 누적 곡률 표면장력 E flux (통계용 — 볼록 경계→오목/속 E 쌍 거래라 장부 무관). tensionOcc(점유→태그)·tensionN4(coordination)는 법칙이 지연 생성.
      anisoGrown: 0,       // step-0025: 누적 방향성 결정 성장 수 (통계용 — 선호 축 빈 이웃에 E→R 침착·태그 복사, E→R 쌍 거래라 장부 무관). anisoSnap(tick 시작 G 스냅샷)은 법칙이 지연 생성.
      turingConverted: 0,  // step-0026: 누적 E↔R 튜링 전환량 (통계용 — 셀별 E↔R 쌍 거래[자기촉매 침착·붕괴], 보존 경계라 장부 무관). R̄ 활성 커널은 법칙이 R 을 제자리에서 읽는다(상태 아님).
      dendriteGrown: 0,    // step-0027: 누적 가지 성장 침착량 (통계용 — 전선 셀 E→R 쌍 거래[곡률 증폭 침착], 보존 경계라 장부 무관). dendSnap(tick 시작 R 스냅샷)은 법칙이 지연 생성(상태 아님).
      permeated: 0,        // step-0028: 누적 선택 투과 막 import flux (통계용 — kin 액적 표면이 빈 바깥에서 안으로 끄는 E 쌍 거래[능동·정류], 보존 경계라 장부 무관). permOcc(점유→태그)는 법칙이 지연 생성(상태 아님).
      crystallized: 0, weathered: 0,  // 누적 결정화량·풍화량 (통계용 — 장부와 무관, R 이 순잔액)
      stars: [],           // step-0011: 살아있는 별 목록 {x,y,center,fuel}. 초기 0 → kIgnite=0 이면 영원히 0(회귀)
      burned: 0, starBirths: 0, starDeaths: 0,  // step-0011: 누적 연소량·점화·소진 수(통계용 — F 가 순잔액)
      A: new Float64Array(N),      // step-0014: 활성도 필드(통과 throughput EMA). 초기 0 → kFlux=0 이면 영원히 0(회귀)
      Eprev: new Float64Array(N),  // step-0014: 직전 tick 끝 E 스냅샷(dE/dt 측정 기준). kFlux=0 이면 미사용(회귀)
      fluxInit: false,             // step-0014: 활성도 첫 기준선 설정 여부 — 해시 가법 가드(false 면 A 해시 skip)
      fluxSum: 0, fluxPeak: 0,     // step-0014: 세계 활성도 총량·최고(통계용 — 매 tick 재계산, 상태 아님)
      G: new Uint8Array(N),        // step-0015: 유전형 태그(genotype) — R 의 *속성*(이산 정보). 0 = 무유전. kTemplate=0 이면 영원히 0(회귀)
      Gbuf: new Uint8Array(N),     // step-0015: 복제 tick-시작 주형 스냅샷(작업 버퍼 — 상태 아님, 매 tick 재계산)
      geneInit: false,             // step-0015: 복제 활성 여부 — 해시 가법 가드(false 면 G 해시 skip → 과거 골든 불변)
      geneReps: 0, geneMut: 0,     // step-0015: 누적 복제·변이 수(통계용 — 장부 무관)
      lifeGeneInit: false,         // step-0016: 생명 유전 활성 여부 — 해시 가법 가드(false 면 agent.g 해시 skip → 과거 골든 불변)
      inheritMut: 0,               // step-0016: 누적 생명 유전 변이 수(통계용 — 장부 무관). inheritOcc(상속 매개 Map)는 법칙이 지연 생성.
      laws: L.LAW_ORDER    // 이 sim 에 적용할 법칙 순서(확장점). 기본 = 표준 LAW_ORDER.
    };
  }

  /* 법칙 적용 — sim.laws 를 고정 순서로 순회 + tick++. (해시 상태에 laws 는 안 들어감 → 회귀 무관.) */
  function step(sim) {
    var laws = sim.laws || L.LAW_ORDER;
    for (var i = 0; i < laws.length; i++) laws[i](sim);
    sim.tick++;
  }

  function run(sim, ticks) { for (var t = 0; t < ticks; t++) step(sim); return sim; }

  /* step-0010/sim-core.js 와 동일한 메서드 표면 — 엔진·패널·verify 가 그대로 쓴다. */
  var core = {
    DEFAULTS: L.DEFAULTS, laws: L,
    mulberry32: K.mulberry32, tumbleHash: K.tumbleHash, createSim: createSim,
    aggKernel: K.aggKernel, spawnAgent: K.spawnAgent, spawnStar: K.spawnStar, spawnGene: K.spawnGene, step: step, run: run,
    totalBiomass: K.totalBiomass, totalStore: K.totalStore, totalFuel: K.totalFuel, ledger: K.ledger, measure: K.measure, measureStore: K.measureStore, measureOrganisms: K.measureOrganisms, measureMembrane: K.measureMembrane, measureSelective: K.measureSelective, measureDifferentiation: K.measureDifferentiation, measureGermline: K.measureGermline, measureAnchor: K.measureAnchor, measureRoundness: K.measureRoundness, measureAnisotropy: K.measureAnisotropy, measureTuring: K.measureTuring, measureDendrite: K.measureDendrite,
    detectPools: K.detectPools, harvest: K.harvest, paintStore: K.paintStore, paintE: K.paintE, localE: K.localE, localStore: K.localStore,
    torusDist: K.torusDist, centroid: K.centroid, spread: K.spread, trackDist: K.trackDist, discCells: K.discCells,
    setSource: K.setSource, setSink: K.setSink,
    hashState: K.hashState
  };
  if (isNode) module.exports = core;
  else global.HWS_SIM = core;
})(typeof window !== 'undefined' ? window : globalThis);
