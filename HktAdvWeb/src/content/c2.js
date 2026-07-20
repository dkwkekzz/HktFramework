// =====================================================================
// C2 — 가설의 탄생 (R1 완성)  (Design-WorldComposition §7 C2)
// ---------------------------------------------------------------------
// 여는 목적: H1 사슬(H1.1 진동 수단 → H1.2 실험) · H2 등장(경합) · 0.2.3.2.1(심장).
// 만드는 것: S-0102(무리분산 주기) + 표층 수정 소량(H1.1 재료, R2 유인).
// 완성되는 루프: 관찰 → 가설 2개 경합 → 수단 제작 → 실험 → H1 확인.
//   심장 채취 시 약물(0.2.3.2)·약점(0.1.1.2) 두 계보 동시 파문 — 시그니처의 첫 발화.
// 쓰는 엔진: C2 가설 판정 · C1 믿음 · D3 파문 연출 (시나리오만 새로).
// 검증: H1 을 확인으로 굳혀 0.1.1.2 완료 파문 도달, 심장 1개의 이중 파문 재현.
// =====================================================================
import { loadCycles } from './cycles.js';
import { ContentSession } from './engine.js';
import { evaluateHypothesis, applyVerdict } from '../epistemic/hypothesis.js';

export function runC2(graph) {
  const cycles = loadCycles().filter((c) => c.name === '무리분산');
  const s = new ContentSession(graph, { cycles });
  const bot = s.addBot('bot-C2', 40, { 정밀도: 0.9 });
  // 전투 능력(무리 제압 수단)과 진동 재료(표층 수정)를 픽스처가 세운다.
  s.give(bot, { id: '전투능력', kind: '능력', properties: { 계열: '전투' } });
  s.place({ id: '권속심장-src', archetype: '권속심장', kind: '물질', tags: ['신.권속', '신.조직'], properties: { 생체촉매활성: 0.75, 신성잔향보존율: 0.7 } });
  s.place({ id: '표층수정-src', archetype: '수정질광석-표층', kind: '물질', properties: { 공명전달률: 0.6, 에너지손실률: 0.4 } });

  // ── (A) 심장 이중 파문: 하나의 채취가 약물·약점 두 계보로 파문 ──
  s.say(`[A] 무리분산 창(open=${s.clock.isOpen('무리분산')})에 권속 심장 사냥 (S-0102)`);
  const heart = s.goal('G-0.2.3.2.1');
  const dmH = s.demandsMet(bot, heart);
  s.say(`  demand(전투 능력 + 무리분산 창): ${dmH.met ? '충족' : '불가'}`);
  s.apply(bot, '채취', s.world.get('권속심장-src'), { 정밀도: 0.9, stage: 'S-0102' });
  const 심장물 = bot.actor.inventory.at(-1);
  s.say(`  심장 채취 → 생체촉매활성=${심장물.properties['생체촉매활성'].toFixed(3)} · 신성잔향보존율=${심장물.properties['신성잔향보존율'].toFixed(3)} (하나의 재료, 두 속성)`);
  const heartDone = s.checkDone(heart, bot).done;
  const heartRipples = heartDone ? s.ripple(heart, bot) : [];
  const branches = heartRipples.map((e) => e.branch);
  s.say(`  0.2.3.2.1 완료=${heartDone} → 이중 파문 갈래: ${branches.join(' + ')}`);

  // ── (B) 가설 경합 → 수단 제작 → 실험 → H1 확인 ──
  s.say('[B] 관찰 → 가설 2개(H1 공명 / H2 저온) 경합 → 진동 수단 제작 → 실험 → H1 확인');
  // 관찰: 표본(심장물, 잔향 보존)에서 신.에너지순환 정보
  s.apply(bot, '관찰', 심장물, { 주제: '신.에너지순환', stage: 'S-0102' });
  // 진동 수단 제작(H1.1): 표층 수정 채취 → 결합(진동수단)
  s.apply(bot, '채취', s.world.get('표층수정-src'), { 정밀도: 0.95, stage: 'S-0201' });
  s.apply(bot, '결합', null, { recipe: '진동수단', stage: 'S-0201' });
  const 진동수단 = bot.actor.inventory.at(-1);
  const h11Done = s.checkDone(s.goal('G-0.1.1.2.H1.1'), bot).done;
  s.say(`  H1.1 진동 수단: 공명출력=${진동수단.properties['공명출력'].toFixed(3)} → 완료=${h11Done}`);
  // 실험(H1.2): 표본에 진동을 두 번 가해 재현 관측
  const experiments = [];
  for (let i = 0; i < 2; i++) {
    s.apply(bot, '실험', 심장물, { 주제: '진동반응', stage: 'S-0102' });
    experiments.push({ stimulus: '진동', response: 0.9 });
  }
  const h12Done = s.checkDone(s.goal('G-0.1.1.2.H1.2'), bot).done;
  s.say(`  H1.2 진동 실험(2회 재현) → 완료=${h12Done}`);

  // 가설 판정: H1 확인(재현 ≥ 재현_최소) / H2 는 미검증 경합으로 남는다
  const h1 = evaluateHypothesis({ id: 'G-0.1.1.2.H1', stimulus: '진동', threshold: 0.5 }, experiments, graph.constants);
  applyVerdict(bot.belief, graph, { id: 'G-0.1.1.2.H1' }, h1);
  s.say(`  가설 판정: H1(공명진동) → ${h1.verdict} (재현 ${h1.confirms}) · H2(저온) → ${bot.belief.stateOf('G-0.1.1.2.H2')}(경합 유지)`);

  const weakness = s.goal('G-0.1.1.2');
  const weaknessDone = s.checkDone(weakness, bot).done;
  const weaknessRipples = weaknessDone ? s.ripple(s.goal('G-0.1.1.2.H1'), bot) : [];
  s.say(`  0.1.1.2(약점 발견) done_when(약점 확인): ${weaknessDone ? '충족 → 완료 파문' : '미충족'}`);

  return {
    heart: { done: heartDone, branches, ripples: heartRipples },
    hypothesis: { h1: h1.verdict, h2: bot.belief.stateOf('G-0.1.1.2.H2'), h11Done, h12Done },
    weakness: { done: weaknessDone, ripples: weaknessRipples },
    log: s.log, events: s.events.all(), audit: s.audit(),
  };
}
