// =====================================================================
// C4 — 앎의 문 (R4)  (Design-WorldComposition §7 C4)
// ---------------------------------------------------------------------
// 여는 목적: 0.1.1.1.3 해독 · 0.1.1.4.2 문 열기 · 0.1.1.3.3 축전 결정.
// 만드는 것: R4 픽스처(문전/문 안 구역, 수호 기구), 월식 주기, 조율 동사(접근권).
// 완성되는 루프: 탁본 → 문자 지식 → 문 개방 + 정체 해독 → 최고 품질 공급 접근.
//   지식이 물리적 문을 여는 인식 플레이의 정점. 에너지저장 공급이 0→1 로 열리며
//   무기 사슬 완성 가능.
// 쓰는 엔진: B2 시간 창 · C1 발견 · E2 백로그(공급 0→1 전환의 기계 확인).
// 검증: 접근권 없는 봇 문전 차단 / 지식 봇 개방. E2 백로그에서 0.1.1.3.3 이
//   빠지는 순간이 C4 완료의 술어다.
// =====================================================================
import { loadCycles } from './cycles.js';
import { ContentSession } from './engine.js';
import { RegionMap } from './regions.js';
import { backlogAgainstWorld } from '../planner/constraints.js';

const 저장재료 = 'G-0.1.1.3.3'; // 에너지저장밀도≥0.5 ∧ 신성내성≥0.4 (유일 공급 S-0402)

export function runC4(graph) {
  const regions = RegionMap.load().regions;
  const cycles = loadCycles().filter((c) => c.name === '월식');
  const s = new ContentSession(graph, { regions, cycles, start: 'R1' });
  const ctx = () => ({ constants: graph.constants, lexicon: s.lexicon, state: s.state });

  // ── 공급 0→1 전환의 기준선: 문 열기 전 0.1.1.3.3 은 백로그(에너지저장 무대 미실존) ──
  const before = backlogAgainstWorld(graph, s.world, ctx());
  const inBacklogBefore = before.backlog.some((b) => b.id === 저장재료);
  s.say(`문 열기 전: 0.1.1.3.3(에너지저장·내성) 백로그=${inBacklogBefore} — 유일 공급 S-0402 는 앎의 문 안`);

  // ── 지식 없는 봇: 문전에서 조율 불가 (접근권 차단) ──
  const noknow = s.addBot('bot-noknow', 60);
  s.move(noknow, 'R4');
  s.give(noknow, { id: '공명도구-n', kind: '물질', tags: ['제작물'], properties: { 공명출력: 0.45 } });
  const door = s.goal('G-0.1.1.4.2');
  const noknowMet = s.demandsMet(noknow, door).met;
  s.say(`지식 없는 봇: 문 열기 demand(고대문자 지식 + 공명) 충족=${noknowMet} → 문전 차단`);

  // ── 지식 갖춘 봇: 탁본 → 문자 지식 → 조율(문 개방) + 해독(정체) ──
  const know = s.addBot('bot-know', 80);
  s.move(know, 'R4');
  // 월식 창 여부 (엔드 진입·H1 관측 창) — 상태형 재료의 리듬
  s.say(`R4 도착 t${s.t}, 월식 창 open=${s.clock.isOpen('월식')} (world.주기.월식=${s.state.world['주기']?.['월식']})`);
  // 문전 기록실 탁본(관찰) → 고대문자 정보 (접근권 없이 관찰 가능)
  s.apply(know, '관찰', null, { 주제: '고대문자', stage: 'S-0401' });
  // 비교로 문자 지식(고대문자) + 신의 정체(해독) 지식을 만든다
  s.apply(know, '비교', null, { 주제: '고대문자', kind: '지식', stage: 'S-0401' });
  s.apply(know, '비교', null, { 주제: '신.정체', kind: '지식', stage: 'S-0401' });
  const 해독Done = s.checkDone(s.goal('G-0.1.1.1.3'), know).done;
  s.say(`  해독(0.1.1.1.3): 신의 정체 지식 확인 → 완료=${해독Done}`);
  // 실험 도구(공명출력)를 재사용해 문을 조율 → 접근권
  s.give(know, { id: '공명도구-k', kind: '물질', tags: ['제작물'], properties: { 공명출력: 0.45 } });
  const knowMet = s.demandsMet(know, door).met;
  s.apply(know, '조율', null, { 대상: '유적.문', stage: 'S-0401' });
  const doorDone = s.checkDone(door, know).done;
  s.say(`  문 열기(0.1.1.4.2): demand 충족=${knowMet} → 조율 → 접근권 확보, 완료=${doorDone}`);

  // ── 문이 열리자 문 안 축전 결정이 접근 가능해진다 (공급 0→1) ──
  let storeDone = false;
  let inBacklogAfter = inBacklogBefore;
  if (doorDone) {
    // 접근권으로 문 안 재료가 세계에 드러난다 (스폰 아님 — 문 너머 실존을 재해석)
    s.place({ id: '축전결정-src', archetype: '축전결정', kind: '물질', properties: { 에너지저장밀도: 0.7, 신성내성: 0.6 } });
    s.apply(know, '채취', s.world.get('축전결정-src'), { 정밀도: 0.9, stage: 'S-0402' });
    storeDone = s.checkDone(s.goal(저장재료), know).done;
    const after = backlogAgainstWorld(graph, s.world, ctx());
    inBacklogAfter = after.backlog.some((b) => b.id === 저장재료);
    s.say(`  문 안 축전 결정 채취 → 0.1.1.3.3 완료=${storeDone}. E2 백로그에서 0.1.1.3.3 이탈=${inBacklogBefore && !inBacklogAfter} (공급 0→1)`);
  }

  // ── 무기 사슬 완성 가능성: 이제 공명전달+에너지저장 재료를 다 갖추면 결합 가능 ──
  s.give(know, { id: '무기급수정', kind: '물질', properties: { 공명전달률: 0.85, 에너지손실률: 0.1 } });
  const weaponReady = s.demandsMet(know, s.goal('G-0.1.1.3.4')).met;
  s.say(`무기 결합(0.1.1.3.4) demand 충족=${weaponReady} — 앎의 문을 지나야 전투 빌드도 완성된다`);

  return {
    doorGate: { noknowBlocked: !noknowMet, knowOpened: doorDone },
    해독Done,
    backlog: { before: inBacklogBefore, after: inBacklogAfter, dropped: inBacklogBefore && !inBacklogAfter },
    storeDone,
    weaponReady,
    log: s.log, events: s.events.all(), audit: s.audit(),
  };
}
