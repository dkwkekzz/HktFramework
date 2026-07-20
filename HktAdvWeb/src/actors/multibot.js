// =====================================================================
// 봇 N기 + aftermath 연쇄 (step F1)
// ---------------------------------------------------------------------
// 여러 봇이 각자 독립 BeliefView 를 굴린다. 같은 무대의 유한 공급을 두고 경쟁하고
// (선착 소진), 한 봇의 완료 aftermath 가 세계를 바꿔 E3 플래너를 깨워 다른 봇의
// 새 목적 씨앗이 된다 (§5 원칙 5 — "살아있는 세계"). aftermath 는 세계를 바꾸고
// 사건으로 감사된다(원장·사건 정합 유지).
// (Design-StepPlan §8 F1)
// =====================================================================
import { readFileSync } from 'node:fs';
import yaml from 'js-yaml';
import { dataPath } from '../paths.js';
import { World } from '../substrate/substance.js';
import { Ledger } from '../substrate/ledger.js';
import { EventLog } from '../substrate/events.js';
import { defaultLawTable } from '../substrate/laws.js';
import { matchAllDemands } from '../graph/demand.js';
import { checkDone } from '../graph/complete.js';
import { ripple } from '../graph/ripple.js';
import { BeliefView } from '../epistemic/belief.js';
import { decompose } from '../planner/decompose.js';

export function loadMultiFixture(file = dataPath('world-multi.yaml')) {
  return yaml.load(readFileSync(file, 'utf8'));
}

function setPath(root, path, value) {
  const segs = path.split('.');
  let node = root;
  for (let i = 0; i < segs.length - 1; i++) { node[segs[i]] ??= {}; node = node[segs[i]]; }
  node[segs.at(-1)] = value;
}

export function runMultiSim(graph, fixture = loadMultiFixture(), opts = {}) {
  const lexicon = graph.lexicon;
  const constants = graph.constants;
  const stageId = fixture.stage.id;
  let supply = opts.supply_count ?? fixture.stage.supply_count ?? 1;

  const world = new World(lexicon);
  const src = world.add({ id: fixture.source.id, archetype: fixture.source.archetype, kind: '물질', tags: fixture.source.tags ?? [], properties: { ...fixture.source.properties } });
  const ledger = new Ledger();
  const events = new EventLog();
  const laws = defaultLawTable(lexicon);
  const state = { world: {}, stage: { [stageId]: { 잔여시간: fixture.source.properties['소멸타이머'] ?? 99 } } };

  // 봇별 독립 BeliefView (C1) + 계좌
  const bots = fixture.bots.map((b) => {
    ledger.open(b.id, b.energy);
    return { id: b.id, 정밀도: b.정밀도, actor: { id: b.id, inventory: [] }, belief: BeliefView.fromGraph(graph, b.id) };
  });

  const target = graph.goalsById.get(fixture.target);
  const log = [];
  const say = (m) => log.push(m);
  const results = {};
  const ripples = [];
  const aftermaths = [];
  const newGoals = [];

  say(`무대 ${stageId} 유한 공급 ${supply}개를 두고 봇 ${bots.length}기 경쟁 (선착 소진)`);

  // 각 봇이 순서대로 한 액션 (선착순)
  for (const bot of bots) {
    const ctx = { constants, lexicon, actor: bot.actor, world, ledger, state, events, belief: bot.belief };
    const dm = matchAllDemands(bot.actor, target.demand, world, ctx);
    if (!world.has(src.id) || !dm.met) {
      results[bot.id] = 'timeout';
      say(`${bot.id}: 무대 공급 소진 — 채취 실패 (선착 경쟁에서 밀림)`);
    } else {
      laws.apply(bot.actor, '채취', world.get(src.id), { 정밀도: bot.정밀도, stage: stageId }, { ledger, events, world });
      supply -= 1;
      if (supply <= 0 && world.has(src.id)) { world.remove(src.id); say(`${bot.id}: 채취 성공 → 무대 공급 소진(다음 봇은 못 얻는다)`); }
      const dc = checkDone(target, ctx);
      if (dc.done) {
        results[bot.id] = 'success';
        ripples.push(...ripple(target, graph, ctx));
        say(`${bot.id}: done_when 충족 → 완료, 파문 상향`);
        applyAftermath(bot);
      } else {
        results[bot.id] = 'timeout';
        say(`${bot.id}: 채취했으나 done_when 미충족`);
      }
    }
  }

  function applyAftermath(completer) {
    const af = fixture.aftermath?.[target.id];
    if (!af) return;
    // ① 세계 상태 변화 + 사건 기록(에너지 0 — 세계 경계 변화, 감사 유지)
    if (af.state) { setPath(state, af.state.path, af.state.value); }
    events.append({ actor: completer.id, verb: 'aftermath', target: target.id, tags: [], delta: { state: af.state }, energy: 0, stage: stageId });
    // ② aftermath 로 드러난 요소를 세계에 편입 (스폰 아님 — 완료가 세계를 바꾼 결과)
    for (const r of af.reveals ?? []) if (!world.has(r.id)) world.add(r);
    // ③ 다른 봇들에게 신규 목적이 발견된다 (C1) + E3 플래너를 깨워 하위 목적 계산
    if (af.wake_goal) {
      for (const other of bots) {
        if (other.id === completer.id) continue;
        const ev = other.belief.discover(af.wake_goal, { via: 'aftermath 연쇄' });
        newGoals.push({ bot: other.id, goal: af.wake_goal, discover: ev });
      }
      const parent = graph.goalsById.get(af.wake_goal);
      const dec = decompose(parent, world, { constants, lexicon, obstacles: af.obstacles ?? [] });
      for (const sub of dec.admitted) newGoals.push({ bot: 'plan', goal: sub.id, subgoal: sub.title, serves: sub.serves });
      say(`aftermath(${completer.id}): 세계 변화 → 봇 B 에 신규 목적 ${af.wake_goal} 발견 + E3 분해 후보 ${dec.admitted.length}건`);
      aftermaths.push({ by: completer.id, node: target.id, wake_goal: af.wake_goal, decomposed: dec.admitted.map((s) => s.title) });
    }
  }

  return {
    results, log, ripples, aftermaths, newGoals,
    events: events.all(),
    ledger: ledger.snapshot(),
    audit: ledger.audit(),
    beliefs: Object.fromEntries(bots.map((b) => [b.id, { 'G-0.1.4': b.belief.stateOf('G-0.1.4') }])),
  };
}
