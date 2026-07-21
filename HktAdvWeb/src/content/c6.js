// =====================================================================
// C6 — 기다림의 세계 (R6 + 주기 전면화)  (Design-WorldComposition §7 C6)
// ---------------------------------------------------------------------
// 여는 목적: 0.2.2.1 내한 장비 · 0.4.1 한랭 적응 · H2 검증/반증.
// 만드는 것: R6 픽스처(상시 저온 소모·한파 창), 균류 단열재 가공(정제 동사),
//   전 주기 동시 가동(겹침 이벤트 관찰).
// 완성되는 루프: 장비 준비 → 한파 창 포착 → H2 실험 → (설계상 H2 반증) 가지 붕괴
//   — 그러나 내한 장비·적응은 0.2/0.4 완료로 남는다. 상실의 연출과 진행의 보존.
// 쓰는 엔진: C2 반증·붕괴 · D3 붕괴 연출 · B2 환경 창 판정.
// 검증: H2 반증 완주 후 0.2.2.1/0.4.1 이 완료로 잔존(실패한 가설이 낭비가 아님) +
//   한파 창 밖 실험의 무효 판정.
// =====================================================================
import { loadCycles } from './cycles.js';
import { ContentSession } from './engine.js';
import { RegionMap } from './regions.js';
import { evaluateHypothesis, applyVerdict } from '../epistemic/hypothesis.js';

export function runC6(graph) {
  const regions = RegionMap.load().regions;
  const cycles = loadCycles(); // 전 주기 전면화 (겹침 관찰)
  const s = new ContentSession(graph, { regions, cycles, start: 'R1' });
  const bot = s.addBot('bot-C6', 60);
  // 저온 실험용 표본(신의 조직, 잔향 보존)을 픽스처가 세운다
  s.give(bot, { id: '표본-C6', kind: '물질', tags: ['신.조직'], properties: { 신성잔향보존율: 0.7 } });

  // ── 장비 준비: 검은 숲에서 균류 단열재를 정제 → 결합해 내한 장비 (첫 진입용) ──
  s.move(bot, 'R3');
  s.place({ id: '발광균류-C6', archetype: '발광균류', kind: '물질', properties: { 생체촉매활성: 0.5, 독성: 0.5 } });
  s.apply(bot, '채취', s.world.get('발광균류-C6'), { 정밀도: 0.9, stage: 'S-0302' });
  s.apply(bot, '정제', null, { 산출: '단열재', stage: 'S-0302' });   // 균류 → 단열재 (내한성 0.6)
  s.apply(bot, '결합', null, { recipe: '장비', stage: 'S-0302' });    // 단열재 → 내한 장비
  const equipDone = s.checkDone(s.goal('G-0.2.2.1'), bot).done; // serves [0.2.2, 0.4.1]
  const coldAdaptDone = s.checkDone(s.goal('G-0.4.1'), bot).done;
  s.say(`장비 준비: 균류 정제 → 단열재 → 내한 장비. 0.2.2.1=${equipDone}, 0.4.1(한랭 적응)=${coldAdaptDone}`);

  // ── 독기 적응(0.4.2): 균류 독기에 반복 노출·해독으로 내성 축적 → R3 심부(둥지 심장부) 개방 ──
  s.setState(bot, 'world.자기.독기내성', 0.5, { verb: '적응', target: 'R3' });
  const poisonAdaptDone = s.checkDone(s.goal('G-0.4.2'), bot).done;
  s.say(`독기 적응(0.4.2): 노출·해독으로 독기내성 축적 → 완료=${poisonAdaptDone} (R3 심부 개방)`);

  // ── 빙원 진입: 상시 저온 소모, 한파 창에만 유효 저온(-30) 도달 ──
  s.move(bot, 'R6');
  const 한파open = s.clock.isOpen('한파');
  const 기온 = s.state.world['환경']?.['기온'];
  const effectiveCold = 한파open && 기온 <= -20; // 유효 저온은 한파 창에서만 (§ note)
  s.say(`R6 도착 t${s.t}: 기온=${기온}, 한파 창 open=${한파open} → 유효 저온=${effectiveCold}`);

  // ── H2 실험(저온 반응): 유효 저온일 때만 유효한 저온반응 측정이 나온다 ──
  const h2exp = s.goal('G-0.1.1.2.H2.1');
  const h2demandMet = s.demandsMet(bot, h2exp).met; // 표본 + 기온<0 + 내한 장비
  if (effectiveCold) {
    s.apply(bot, '실험', s.give(bot, { id: 'exp-target', kind: '물질', tags: ['신.조직'], properties: { 신성잔향보존율: 0.7 } }), { 주제: '저온반응', stage: 'S-0601' });
  } else {
    s.apply(bot, '실험', null, { stage: 'S-0601' }); // 무효 실험 — 저온반응 정보를 못 낸다
  }
  const h2ExpDone = s.checkDone(h2exp, bot).done;
  s.say(`H2 실험(0.1.1.2.H2.1): demand 충족=${h2demandMet}, 유효 측정=${effectiveCold} → 완료=${h2ExpDone}`);

  // ── 한파 창 밖 실험의 무효 판정 (별도 확인) ──
  const outsideValid = (() => {
    // 한파가 닫힌 틱까지 진행해 유효 저온이 사라짐을 확인
    const closeIn = s.clock.windowClosesIn('한파');
    s.tick(closeIn + 1);
    const cold = s.clock.isOpen('한파') && (s.state.world['환경']?.['기온'] <= -20);
    s.say(`한파 창 밖(t${s.t}, 기온 ${s.state.world['환경']?.['기온']}): 유효 저온=${cold} → 저온 실험 무효`);
    return cold;
  })();

  // ── H2 반증: 저온 반응이 예측을 배신한다 → 가설·하위 가지 붕괴 ──
  const h2 = evaluateHypothesis({ id: 'G-0.1.1.2.H2', stimulus: '저온', threshold: 0.5 }, [{ stimulus: '저온', response: 0.1 }], graph.constants);
  const collapseEvents = applyVerdict(bot.belief, graph, { id: 'G-0.1.1.2.H2' }, h2);
  const collapsed = collapseEvents[0]?.collapsed ?? [];
  s.say(`H2 가설 판정: ${h2.verdict} → 붕괴 가지 [${collapsed.join(', ')}] (믿음만 죽는다, 전역 데이터 불변)`);

  // ── 실패한 가설이 낭비가 아니다: 내한 장비·적응은 완료로 잔존 ──
  const equipStillDone = s.checkDone(s.goal('G-0.2.2.1'), bot).done;
  const coldStillDone = s.checkDone(s.goal('G-0.4.1'), bot).done;
  s.say(`반증 후 잔존: 0.2.2.1=${equipStillDone}, 0.4.1=${coldStillDone} (여정의 산출은 다른 가지의 진행으로 남는다)`);

  // ── 전 주기 동시 가동: 창 겹침 관찰 ──
  const overlaps = countOverlaps(cycles, 0, 300);

  return {
    equip: { made: equipDone, coldAdapt: coldAdaptDone, poisonAdapt: poisonAdaptDone },
    h2: { verdict: h2.verdict, collapsed, expDoneInWindow: h2ExpDone, effectiveColdOutside: outsideValid },
    retained: { equip: equipStillDone, coldAdapt: coldStillDone },
    overlaps,
    log: s.log, cycleLog: s.clock.log, events: s.events.all(), audit: s.audit(),
  };
}

// [from,to) 틱 구간에서 두 개 이상의 주기 창이 동시에 열린 틱 수.
function countOverlaps(cycles, from, to) {
  let n = 0;
  for (let t = from; t < to; t++) {
    const open = cycles.filter((c) => (t % c.period) < c.window).length;
    if (open >= 2) n++;
  }
  return n;
}
