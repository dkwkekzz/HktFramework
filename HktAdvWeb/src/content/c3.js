// =====================================================================
// C3 — 재료의 세계 (R2 + R3)  (Design-WorldComposition §7 C3)
// ---------------------------------------------------------------------
// 여는 목적: 0.1.1.3 제작 사슬 · 0.1.2 둥지 · 0.3.1.2 균류 원리 · 0.1.1.4.3 탈것.
// 만드는 것: R2(심부/표층 대역)·R3(둥지·균류·운반 무리) 픽스처, 지역 이동(인접·
//   이동 비용) 구동, 독기 층. E1 스캐너 상시 편입(획득 재료의 재해석 → 역결합).
// 완성되는 루프: 무기급 재료를 세 경로(심부 채굴/둥지 소탕/유적은 아직 잠김) 중
//   선택 → 결합·안정화(에너지저장 공급이 아직 0 → C4 대기) → 유사 대상 시험.
//   위협 제거가 재료 획득과 겹치는 첫 체험(㉡ — 둥지=창고).
// 쓰는 엔진: E1 재해석 · C3 retro-bind · B2 다중 해법 판정.
// 검증: 같은 demand(무기급 공명전달)를 채굴형/전투형 두 봇이 다른 경로로 충족
//   (§5 행렬의 실행 증명). 균류 획득 후 촉매 demand 발견 시 retro-bind 발화.
// =====================================================================
import { ContentSession } from './engine.js';
import { RegionMap } from './regions.js';
import { scan } from '../planner/reinterpret.js';
import { findUnbound, discoverNode } from '../epistemic/retrobind.js';

const 무기급 = 'G-0.1.1.3.2'; // done_when: 공명전달률≥0.7 ∧ 에너지손실률≤0.3

export function runC3(graph) {
  const regions = RegionMap.load().regions;
  const s = new ContentSession(graph, { regions, start: 'R1' });

  // ── 채굴형 봇: R2 심부 수정으로 무기급 재료 확보 ──
  const mine = s.addBot('bot-mine', 80, { 정밀도: 0.95 });
  s.move(mine, 'R2');
  s.place({ id: '심부수정', archetype: '수정질광석-심부', kind: '물질', properties: { 공명전달률: 0.85, 에너지손실률: 0.1 } });
  s.apply(mine, '채취', s.world.get('심부수정'), { 정밀도: 0.95, stage: 'S-0201' });
  const 수정물 = mine.actor.inventory.at(-1);
  const mineDone = s.checkDone(s.goal(무기급), mine).done;
  s.say(`채굴형: 심부 수정 채취 → 공명전달률=${수정물.properties['공명전달률'].toFixed(3)} 손실=${수정물.properties['에너지손실률'].toFixed(3)} → 0.1.1.3.2 완료=${mineDone}`);

  // ── 전투형 봇: R3 에서 둥지 무력화(위협 제거) → 잔해 뼈 채취(창고) ──
  const fight = s.addBot('bot-fight', 80, { 정밀도: 0.95 });
  fight.belief.set('G-0.2.3.2', '미발견'); // 역결합 시연: 촉매 demand 는 아직 미발견
  s.give(fight, { id: '전투능력-f', kind: '능력', properties: { 계열: '전투' } });
  s.move(fight, 'R3');
  // 둥지 위치 특정(탐색) → 무력화(전투) — 0.1.2.2, 위협 제거
  s.apply(fight, '탐색', null, { 주제: '둥지위치', stage: 'S-0301' });
  const 둥지 = s.goal('G-0.1.2.2');
  const dmNest = s.demandsMet(fight, 둥지);
  s.apply(fight, '전투', null, { stage: 'S-0301' });
  s.setState(fight, 'world.지역.둥지활성', false, { verb: '전투', target: 'S-0301' });
  const nestDone = s.checkDone(둥지, fight).done;
  s.say(`전투형: 둥지 위치 특정(demand ${dmNest.met ? '충족' : '불가'}) → 무력화 → 둥지활성=false, 0.1.2.2 완료=${nestDone}`);
  // aftermath: 잔해에서 공명 전달 뼈가 드러난다 (S-0301 이 채취 무대로 재해석 — ㉡)
  s.place({ id: '마수뼈-잔해', archetype: '마수뼈', kind: '물질', tags: ['잔해'], properties: { 공명전달률: 0.8, 에너지손실률: 0.2 } });
  s.apply(fight, '채취', s.world.get('마수뼈-잔해'), { 정밀도: 0.95, stage: 'S-0301' });
  const 뼈물 = fight.actor.inventory.at(-1);
  const fightDone = s.checkDone(s.goal(무기급), fight).done;
  s.say(`전투형: 잔해 뼈 채취 → 공명전달률=${뼈물.properties['공명전달률'].toFixed(3)} 손실=${뼈물.properties['에너지손실률'].toFixed(3)} → 0.1.1.3.2 완료=${fightDone} (위협 제거와 재료 획득이 한 행동에서 겹침)`);

  // ── 역결합: 용도 불명 균류를 먼저 얻고, 촉매 demand 를 발견하는 순간 밝혀진다 ──
  s.place({ id: '발광균류-src', archetype: '발광균류', kind: '물질', properties: { 생체촉매활성: 0.6, 독성: 0.4 } });
  s.apply(fight, '채취', s.world.get('발광균류-src'), { 정밀도: 0.95, stage: 'S-0302' });
  const unboundBefore = findUnbound(fight.actor, graph, fight.belief).map((m) => m.id);
  const { events: rbEvents } = discoverNode(fight.belief, graph, fight.actor, 'G-0.2.3.2', { constants: graph.constants, lexicon: s.lexicon, world: s.world, via: 'C3 균류 재해석' });
  const retro = rbEvents.find((e) => e.type === 'retro-bind');
  s.say(`역결합: 획득 시 용도 불명 [${unboundBefore.join(',')}] → G-0.2.3.2(촉매) 발견 순간 결합 ${retro ? retro.links.map((l) => l.property).join('+') : '없음'}`);

  // ── E1 재해석 스캐너: 세계에 실존하는 무기급 재료 후보 (스폰 아님) ──
  const 무기급demand = s.goal(무기급).demand[0];
  const cands = scan(무기급demand, s.world, { constants: graph.constants, lexicon: s.lexicon }).map((c) => c.fromElement);
  s.say(`E1 재해석: 무기급 공명전달 재료 후보 ${cands.length}건 [${cands.join(',')}] (이미 존재하는 것을 재해석 — 원칙 ④)`);

  // ── 결합(무기, 0.1.1.3.4)은 에너지저장 재료가 없어 아직 막힌다 (C4 에서 열림) ──
  const weapon = s.goal('G-0.1.1.3.4');
  const weaponReady = s.demandsMet(mine, weapon).met;
  s.say(`무기 결합(0.1.1.3.4): demand 충족=${weaponReady} — 에너지저장밀도 공급이 아직 0 (S-0402 = 앎의 문 안, C4 대기)`);

  return {
    mine: { done: mineDone, path: '심부 수정 채굴(R2)', 공명전달률: 수정물.properties['공명전달률'] },
    fight: { done: fightDone, path: '둥지 소탕→뼈(R3)', nestDone, 공명전달률: 뼈물.properties['공명전달률'] },
    multiPath: mineDone && fightDone,
    retrobind: { unbound: unboundBefore, links: retro?.links ?? [] },
    scan: cands,
    weaponBlocked: !weaponReady,
    log: s.log, events: s.events.all(), audit: s.audit(),
  };
}
