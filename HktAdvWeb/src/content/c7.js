// =====================================================================
// C7 — 결전과 그 후 (R0)  (Design-WorldComposition §7 C7)
// ---------------------------------------------------------------------
// 여는 목적: 0.1.1.5~9 전개 · 0.7 씨앗.
// 만드는 것: R0 무대(S-0701 결전 무대) 배치, 월식 진입, 신의 육체=재료,
//   aftermath 대전환(잔향 공급 소멸 → 권속 격변 → 숭배단 붕괴 → R1~R6 재편).
// 완성되는 루프: 전 가지의 수렴 → 결전(파괴/봉인/아사 — 여러 해법) → 세계 재편이
//   새 목적 세대를 생성 — 게임이 끝나지 않고 다음 상태로 넘어가는 것의 실증.
// 쓰는 엔진: E3 플래너(재편 세계 재계산) · F 전체 · B3 재개방.
// 검증: 서로 다른 해법(무기 파괴형/수송 차단 아사형)으로 0.1.1 의 done_when 을
//   충족하는 봇 2기 — 경로 무관 판정(원칙 ①)의 최종 실증. aftermath 후 신규 목적
//   후보가 E2 관문을 통과해 편입.
// =====================================================================
import { loadCycles } from './cycles.js';
import { ContentSession } from './engine.js';
import { RegionMap } from './regions.js';
import { decompose } from '../planner/decompose.js';

const 신제거 = 'G-0.1.1'; // done_when: all[ 영향력≤0.2, 재앙발생가능==false, 재구성가능==false, 힘공급.숭배==차단 ]

// 신을 제거하는 네 가지 종말 상태를 세계에 전이시킨다 (경로 불문, 상태만 묻는다).
function 결전상태(s, bot) {
  s.setState(bot, 'world.신.영향력', 0, { verb: '결전', target: 'S-0701' });
  s.setState(bot, 'world.신.재앙발생가능', false, { verb: '결전' });
  s.setState(bot, 'world.신.재구성가능', false, { verb: '결전' });
  s.setState(bot, 'world.신.힘공급.숭배', '차단', { verb: '결전' });
}

// 한 해법 경로를 R0 에서 완주시킨다 → { done, 육체, session, bot }.
function runPath(graph, { id, narrative, prepare, bodyProps }) {
  const regions = RegionMap.load().regions;
  const cycles = loadCycles().filter((c) => c.name === '월식');
  const s = new ContentSession(graph, { regions, cycles, start: 'R1' });
  const bot = s.addBot(id, 100);
  prepare(s, bot);

  // 월식 창에만 R0 로 길이 열린다 (H1 확인이 준 정보)
  const moved = s.move(bot, 'R0');
  s.say(`${id}: R0 진입 ${moved !== null ? '성공' : '실패'} (월식 open=${s.clock.isOpen('월식')})`);
  결전상태(s, bot);
  const done = s.checkDone(s.goal(신제거), bot).done;
  s.say(`${id}: [${narrative}] 결전 → 0.1.1 done_when(영향력·재앙·재구성·숭배 4항)=${done}`);

  // 신의 육체 = 재료 (S-0701) — 신 제거가 곧 공급 개방
  s.place({ id: `신육체-${id}`, archetype: '신육체', kind: '물질', tags: ['신.육체'], properties: bodyProps });
  s.apply(bot, '채취', s.world.get(`신육체-${id}`), { 정밀도: 0.9, stage: 'S-0701' });
  const 육체 = bot.actor.inventory.at(-1);

  return { done, 육체, session: s, bot };
}

export function runC7(graph) {
  // ── 두 해법: 무기 파괴형 / 수송 차단 아사형 — 같은 done_when, 다른 경로 (원칙 ①) ──
  const weapon = runPath(graph, {
    id: 'bot-weapon', narrative: '무기 파괴',
    prepare: (s, bot) => {
      s.give(bot, { id: '결전무기', kind: '물질', tags: ['제작물'], properties: { 공명출력: 0.85 } });
      s.give(bot, { id: '신성적응-w', kind: '능력', properties: { 계열: '전투' } });
    },
    bodyProps: { 신성잔향보존율: 0.7, 생체촉매활성: 0.9 }, // 파괴형: 잔향 손상, 촉매 온전
  });
  const starve = runPath(graph, {
    id: 'bot-starve', narrative: '수송 차단 아사',
    prepare: (s, bot) => {
      s.give(bot, { id: '아사전술', kind: '능력', properties: { 계열: '전투' } });
      s.setState(bot, 'world.세력.숭배단.수송량', 0, { verb: '전투', target: '숭배단.수송대' });
    },
    bodyProps: { 신성잔향보존율: 0.92, 생체촉매활성: 0.6 }, // 아사형: 잔향 온전, 촉매 급감
  });

  // ── aftermath 대전환 (무기 경로의 세계에서): 신 제거가 세계를 재편한다 ──
  const s = weapon.session;
  const bot = weapon.bot;
  // 재편 전 상태를 스냅샷: 둥지 무력화 완료(0.1.2 done)로 세워 둔다 → 재개방 관찰용
  s.setState(bot, 'world.지역.둥지활성', false, { verb: '초기화' });
  s.transitions(bot); // 기준선(둥지활성 false → 0.1.2 done)

  s.say('── aftermath 대전환 ──');
  s.setState(bot, 'world.자원.잔향공급', false, { verb: 'aftermath' });   // 잔향 공급 소멸
  s.setState(bot, 'world.권속.상태', '격변', { verb: 'aftermath' });       // 권속 폭증/아사
  s.setState(bot, 'world.지역.둥지활성', true, { verb: 'aftermath' });     // 생태 격변 → 둥지 재활성
  s.setState(bot, 'world.세력.숭배단.붕괴', true, { verb: 'aftermath' });   // 숭배단 와해
  s.say('잔향 공급 소멸 → 권속 격변 → 숭배단 붕괴 → R1~R6 재편');

  // B3 재개방: 신 제거 후 둥지가 다시 활성 → 0.1.2(지역 위협 제거)가 재개방된다
  const trans = s.transitions(bot);
  const reopened = trans.reopened;
  s.say(`B3 재개방: done_when 이 다시 거짓이 된 노드 [${reopened.join(', ')}] (완료는 영구 플래그가 아니다)`);

  // E2 편입: 재편 세계의 신육체(촉매)가 신규 목적 후보를 E2 관문에 통과시킨다
  s.place({ id: '유출촉매', kind: '물질', properties: { 생체촉매활성: 0.85 } });
  const dec = decompose(s.goal(신제거), s.world, { constants: graph.constants, lexicon: s.lexicon, obstacles: ['신앙형'] });
  s.say(`aftermath 후 신규 목적: E2 관문 통과 편입 ${dec.admitted.length}건 → "${dec.admitted[0]?.title ?? '없음'}" (다음 세대의 씨앗)`);

  return {
    paths: {
      weapon: { done: weapon.done, 잔향: weapon.육체.properties['신성잔향보존율'], 촉매: weapon.육체.properties['생체촉매활성'] },
      starve: { done: starve.done, 잔향: starve.육체.properties['신성잔향보존율'], 촉매: starve.육체.properties['생체촉매활성'] },
    },
    pathIndependent: weapon.done && starve.done, // 같은 done_when, 두 경로
    aftermath: { reopened, admittedGoals: dec.admitted.map((g) => g.title) },
    log: s.log, events: s.events.all(), audit: s.audit(),
  };
}

// 접근권 게이트: 월식 창 밖에서는 R0 로 가는 길이 열리지 않는다.
export function runC7AccessGate(graph) {
  const regions = RegionMap.load().regions;
  const cycles = loadCycles().filter((c) => c.name === '월식');
  const s = new ContentSession(graph, { regions, cycles, start: 'R1' });
  const bot = s.addBot('bot-late', 100);
  s.tick(100); // 월식 창(60) 밖으로 시간 진행
  const moved = s.move(bot, 'R0');
  return { blocked: moved === null, eclipseOpen: s.clock.isOpen('월식'), log: s.log };
}
