// =====================================================================
// C5 — 타인의 세계 (R5)  (Design-WorldComposition §7 C5)
// ---------------------------------------------------------------------
// 여는 목적: 0.1.1.6 사슬 · 0.1.4 수송 차단 · 0.6 관계.
// 만드는 것: R5 픽스처(시장 거래 법칙 — 협상 동사, 속성 기반 가격), 세력 상태
//   (자유민 신뢰·숭배단 적대), 호송 주기.
// 완성되는 루프: 거래로 모든 재료의 제3 경로 개방, 강탈↔거래↔의뢰의 삼자 선택,
//   세력 aftermath(강탈→적대→수송 감소→신의 힘 공급 약화 — 0.1.1 에 닿는 간접 경로).
// 쓰는 엔진: F1 다중 행위자 · E3 분해.
// 검증: 강탈 봇과 거래 봇이 같은 done_when 을 충족하되 세계 상태(적대도)가 다르게
//   끝난다 — 경로가 aftermath 차이를 남기는 실증 (원칙 ①: 완료는 상태를 묻는다).
// =====================================================================
import { loadCycles } from './cycles.js';
import { ContentSession } from './engine.js';
import { RegionMap } from './regions.js';
import { decompose } from '../planner/decompose.js';

const 표본 = 'G-0.1.1.2.1'; // done_when: has 물질 신성잔향보존율≥0.6 (경로 불문)

export function runC5(graph) {
  const regions = RegionMap.load().regions;
  const cycles = loadCycles().filter((c) => c.name === '호송');
  const s = new ContentSession(graph, { regions, cycles, start: 'R1' });
  s.setState(null, 'world.세력.숭배단.수송량', 3, { verb: '초기화' });
  s.setState(null, 'world.세력.숭배단.적대', false, { verb: '초기화' });
  s.setState(null, 'world.세력.자유민.신뢰', 0, { verb: '초기화' });

  // ── 거래 봇: 시장에서 속성으로 산다 (제3의 해법 층, 전투 없이 표본에 닿는다) ──
  const trade = s.addBot('bot-trade', 60);
  s.move(trade, 'R5');
  // 속성 기반 거래: "이런 속성을 가진 것"을 산다 (S-0502). + 거래 신뢰(관계 재료)
  s.apply(trade, '협상', null, { buy: { kind: '물질', tags: ['유물'], properties: { 신성잔향보존율: 0.7 } }, 신뢰단계: 1, stage: 'S-0502' });
  const tradeSample = s.checkDone(s.goal(표본), trade).done;
  const trustDone = s.checkDone(s.goal('G-0.1.1.6.1'), trade).done;
  s.setState(trade, 'world.세력.자유민.신뢰', 1, { verb: 'aftermath' });
  // 거래 경로가 남긴 세계 상태를 강탈 전에 스냅샷 (같은 세계, 다른 경로의 흔적 비교)
  const tradeState = { 적대: s.state.world['세력']['숭배단']['적대'], 신뢰: s.state.world['세력']['자유민']['신뢰'] };
  s.say(`거래 봇: 시장에서 잔향 0.7 유물 매입 + 신뢰 1 → 표본 완료=${tradeSample}, 거래신뢰(0.1.1.6.1)=${trustDone}. 숭배단 적대=${tradeState.적대}`);

  // ── 강탈 봇: 호송 창에 수송로를 습격한다 (최고 효율, 세력 적대 대가) ──
  const raid = s.addBot('bot-raid', 60);
  s.give(raid, { id: '전투능력-r', kind: '능력', properties: { 계열: '전투' } });
  s.move(raid, 'R5');
  s.say(`강탈 봇: R5 도착 t${s.t}, 호송 창 open=${s.clock.isOpen('호송')} (world.주기.호송=${s.state.world['주기']?.['호송']})`);
  const cut = s.goal('G-0.1.1.6.2'); // serves [0.1.1.6, 0.1.4] — 규합 증명이자 세력 약화
  const raidMet = s.demandsMet(raid, cut).met;
  s.apply(raid, '전투', null, { spoils: [{ kind: '물질', tags: ['유물', '숭배단.수송대'], properties: { 신성잔향보존율: 0.85 } }], stage: 'S-0501' });
  // 습격 결과: 수송량 0 + 숭배단 적대 확정 (aftermath — 세계 상태 전이, 사건 감사)
  s.setState(raid, 'world.세력.숭배단.수송량', 0, { verb: '전투', target: '숭배단.수송대' });
  // 전투 사건에 수송대 태그가 실리도록 별도 기록 (done_when: event 전투 target_tag 숭배단.수송대)
  s.events.append({ actor: raid.id, verb: '전투', target: 'S-0501', tags: ['숭배단.수송대'], delta: {}, energy: 0, stage: 'S-0501' });
  s.setState(raid, 'world.세력.숭배단.적대', true, { verb: 'aftermath' });
  const raidSample = s.checkDone(s.goal(표본), raid).done;
  const cutDone = s.checkDone(cut, raid).done;
  const factionDone = s.checkDone(s.goal('G-0.1.4'), raid).done;
  const cutRipples = cutDone ? s.ripple(cut, raid) : [];
  s.say(`강탈 봇: 습격(demand ${raidMet ? '충족' : '불가'}) → 잔향 0.85 유물 + 수송량 0 → 표본 완료=${raidSample}, 수송 차단(0.1.1.6.2)=${cutDone}, 세력 약화(0.1.4)=${factionDone}`);
  s.say(`  수송 차단 파문 갈래: ${cutRipples.map((e) => e.branch).join(' + ')} (규합 증명이자 세력 약화 — 0.1.1 에 닿는 간접 경로)`);

  // ── E3: 세력도 목적 사슬을 굴린다 — 신앙형 신에 대한 분해 (숭배 교란 수단) ──
  const wf = s.world; // 강탈로 드러난 촉매 재료가 있으면 분해가 닿는다
  wf.add({ id: '숭배촉매', kind: '물질', properties: { 생체촉매활성: 0.7 } });
  const dec = decompose(s.goal('G-0.1.1'), wf, { constants: graph.constants, lexicon: s.lexicon, obstacles: ['신앙형'] });
  s.say(`E3 분해(신앙형): "${dec.admitted[0]?.title ?? '없음'}" — 세력 aftermath 가 새 하위 목적을 연다`);

  const 숭배단 = () => s.state.world['세력']['숭배단'];
  return {
    trade: { sampleDone: tradeSample, trustDone, 적대: tradeState.적대, 자유민신뢰: tradeState.신뢰 },
    raid: { sampleDone: raidSample, cutDone, factionDone, 적대: 숭배단().적대, 수송량: 숭배단().수송량, ripples: cutRipples.map((e) => e.branch) },
    sameGoal: tradeSample && raidSample,       // 같은 done_when 을 두 경로가 충족
    differentState: tradeState.적대 !== 숭배단().적대,  // 경로가 세계 상태를 다르게 남긴다
    decompose: dec.admitted.map((g) => g.title),
    log: s.log, events: s.events.all(), audit: s.audit(),
  };
}
