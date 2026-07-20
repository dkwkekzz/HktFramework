// =====================================================================
// C1 — 첫 사냥터 (R1 절반)  (Design-WorldComposition §7 C1)
// ---------------------------------------------------------------------
// 여는 목적: 0.1.1.2.1(표본 채취) · 0.1.1.2.2(관찰) · 0.3.1.1(에너지 수확) ·
//            0.1.1.1.1(흉터 조사).
// 만드는 것: R1 축소 픽스처(S-0045 조직조각 + S-0103 흉터), 순행 주기(600/20),
//            소멸타이머. 틱 루프에 주기 구동기 탑재 — 순행이 무대를 재생성하는 첫 사례.
// 완성되는 루프: 흔적 발견 → 순행 창 안 채취(정밀도 선택) → 관찰로 정보 →
//                에너지 수확으로 유지비 충당. 말단 카드 → 세계 해결 → 파문의
//                마이크로 루프 하나가 완전체.
// 검증: 봇이 순행 1주기 안에 표본+정보+수확+조사를 완주(성공) / 창을 놓치면 실패.
// =====================================================================
import { loadCycles } from './cycles.js';
import { ContentSession } from './engine.js';

// 순행 주기가 열릴 때 재생성되는 R1 조직 조각 원천 (S-0045).
function 조직조각Spec() {
  return {
    id: '조직조각-R1', archetype: '조직조각', kind: '물질', tags: ['신.조직'],
    properties: { 신성잔향보존율: 0.8, 오염도: 0.1, 소멸타이머: 14 },
  };
}

// C1 을 한 번 실행한다. opts.delay 틱만큼 지체하면 순행 창(20)을 놓쳐 실패한다.
export function runC1(graph, { delay = 0, 정밀도 = 0.9 } = {}) {
  const cycles = loadCycles().filter((c) => c.name === '순행');
  const s = new ContentSession(graph, { cycles, regen: { 'S-0045': 조직조각Spec } });
  const bot = s.addBot('bot-C1', 20, { 정밀도 });

  s.say(`R1 잿빛 평원 — 순행 창(window ${cycles[0].window}) 골든 타임. 시작 t${s.t}`);
  if (delay > 0) { s.say(`${delay}틱 지체 (다른 볼일)…`); s.tick(delay); }

  const goals = {
    '표본': graph.goalsById.get('G-0.1.1.2.1'),
    '관찰': graph.goalsById.get('G-0.1.1.2.2'),
    '조사': graph.goalsById.get('G-0.1.1.1.1'),
    '수확': graph.goalsById.get('G-0.3.1.1'),
  };
  const results = {};
  const ripples = [];

  // ① 표본 채취 (0.1.1.2.1) — 물질(잔향) + 환경(잔여시간>0) demand
  const src = s.world.get('조직조각-R1');
  const dm1 = s.demandsMet(bot, goals['표본']);
  if (src && dm1.met) {
    s.apply(bot, '채취', src, { 정밀도, stage: 'S-0045' });
    const 표본 = bot.actor.inventory.at(-1);
    s.say(`t${s.t}: 채취 → 표본 신성잔향보존율=${표본.properties['신성잔향보존율'].toFixed(3)} (창 잔여 ${s.state.stage['S-0045']?.['잔여시간']})`);
  } else {
    s.say(`t${s.t}: 표본 채취 불가 — ${!src ? '조직 조각이 소멸(창을 놓침)' : '시간 창 밖'}`);
  }
  results['표본'] = s.checkDone(goals['표본'], bot).done;
  if (results['표본']) ripples.push(...s.ripple(goals['표본'], bot));

  s.tick(2);

  // ② 표본 관찰 (0.1.1.2.2) — 관찰로 신.에너지순환 정보
  const 표본 = bot.actor.inventory.find((m) => (m.properties['신성잔향보존율'] ?? 0) >= graph.constants['잔향보존_최소']);
  if (표본) {
    s.apply(bot, '관찰', 표본, { 주제: '신.에너지순환', stage: 'S-0045' });
    s.say(`t${s.t}: 관찰 → 신.에너지순환 정보 획득`);
  } else s.say(`t${s.t}: 관찰할 표본이 없다`);
  results['관찰'] = s.checkDone(goals['관찰'], bot).done;
  if (results['관찰']) ripples.push(...s.ripple(goals['관찰'], bot));

  s.tick(2);

  // ③ 흉터 조사 (0.1.1.1.1) — 환경(S-0103 신선도>0) demand, 관찰로 신.행동주기 정보
  const dm3 = s.demandsMet(bot, goals['조사']);
  if (dm3.met) {
    s.apply(bot, '관찰', null, { 주제: '신.행동주기', stage: 'S-0103' });
    s.say(`t${s.t}: 흉터 조사 → 신.행동주기 정보 (신선도 ${s.state.stage['S-0103']?.['신선도']})`);
  } else s.say(`t${s.t}: 흉터 조사 불가 — 신선도 창 밖`);
  results['조사'] = s.checkDone(goals['조사'], bot).done;
  if (results['조사']) ripples.push(...s.ripple(goals['조사'], bot));

  s.tick(2);

  // ④ 에너지 수확 (0.3.1.1) — 환경(S-0103 신선도>0) demand, 흉터에서 유출 에너지 수확
  const dm4 = s.demandsMet(bot, goals['수확']);
  if (dm4.met) {
    s.harvest(bot, 35, '흉터 수확', 'S-0103');
  } else s.say(`t${s.t}: 에너지 수확 불가 — 신선도 창 밖`);
  results['수확'] = s.checkDone(goals['수확'], bot).done;
  if (results['수확']) ripples.push(...s.ripple(goals['수확'], bot));

  const allDone = Object.values(results).every(Boolean);
  s.say(allDone
    ? `순행 1주기 안에 표본+정보+수확+조사 완주 — 마이크로 루프 완전체 (t${s.t})`
    : `일부 미완 — ${Object.entries(results).filter(([, v]) => !v).map(([k]) => k).join(', ')} 실패`);

  return {
    result: allDone ? 'success' : 'timeout',
    results, ripples, t: s.t,
    windowWas: cycles[0].window,
    log: s.log, cycleLog: s.clock.log, events: s.events.all(),
    audit: s.audit(), ledger: s.ledger.snapshot(),
  };
}
