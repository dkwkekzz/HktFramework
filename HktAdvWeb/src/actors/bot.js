// =====================================================================
// 봇 v0 + 최소 수직 절편 실행기 (step B4)
// ---------------------------------------------------------------------
// 계획 없음, 반응만: 그래프에서 활성 말단을 골라 → 무대로 이동(추상 이동: 틱 소모)
// → 법칙 apply(채취) → 완료 판정 → 상향 파문. 플래너는 E3.
// 사슬 완주 후 원장 audit() + 사건 로그 감사가 성립한다 (설계의 최초 종단 증명 M2).
// (Design-StepPlan §4 B4)
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

export function loadSliceFixture(file = dataPath('world-slice1.yaml')) {
  return yaml.load(readFileSync(file, 'utf8'));
}

// 절편을 처음부터 끝까지 실행한다. opts 로 시간 압박 파라미터를 덮어쓸 수 있다.
// → { result: 'success'|'timeout', ticks, log[], events[], ledger, ripples[], done }
export function runSlice(graph, fixture = loadSliceFixture(), opts = {}) {
  const lexicon = graph.lexicon;
  const 정밀도 = opts['정밀도'] ?? fixture['정밀도'] ?? 0.9;
  const moveCost = opts.move_cost ?? fixture.bot.move_cost ?? 1;
  const 소멸타이머0 = opts['소멸타이머'] ?? fixture.source.properties['소멸타이머'];

  // ── 세계 조립 ──
  const world = new World(lexicon);
  const stageId = fixture.source.stage;
  const src = world.add({
    id: fixture.source.id,
    archetype: fixture.source.archetype,
    kind: '물질',
    tags: fixture.source.tags ?? [],
    properties: { ...fixture.source.properties, 소멸타이머: 소멸타이머0 },
  });
  const ledger = new Ledger();
  ledger.open(fixture.bot.id, fixture.bot.energy);
  const events = new EventLog();
  const laws = defaultLawTable(lexicon);
  const actor = { id: fixture.bot.id, inventory: [] };

  // 상태 창: stage.<id>.잔여시간 = 원천의 소멸타이머 (상태형 demand 판정의 통로)
  const state = { world: {}, stage: { [stageId]: { 잔여시간: 소멸타이머0 } } };
  const ctx = { constants: graph.constants, lexicon, actor, world, ledger, state, events };

  let tick = 0;
  const log = [];
  const say = (m) => log.push(m);

  // 시간 진행: 원천 소멸타이머 감소, 0 이면 소멸.
  const advanceTime = (n) => {
    for (let i = 0; i < n; i++) {
      tick++;
      if (world.has(src.id)) {
        src.properties['소멸타이머'] -= 1;
        state.stage[stageId]['잔여시간'] = Math.max(0, src.properties['소멸타이머']);
        if (src.properties['소멸타이머'] <= 0) {
          world.remove(src.id);
          events.append({ actor: null, verb: '소멸', target: src.id, tags: src.tags, energy: 0, stage: stageId });
          say(`t${tick}: 소멸 — 무대 원천이 시간 초과로 사라졌다`);
        }
      }
    }
  };

  const target = graph.goalsById.get(fixture.target_goal);
  say(`활성 말단 선택: ${target.id} (${target.title}) — 발견 상태 ${target.epistemic}`);

  // demand 충족 가능성 사전 확인 (반응적 판단)
  const pre = matchAllDemands(actor, target.demand, world, ctx);
  say(`demand 판정: ${pre.met ? '충족 가능' : '불가'} (${pre.results.map((r) => r.trace?.form === '보유형' ? `후보${r.candidates.length}` : (r.met ? '창내' : '창밖')).join(', ')})`);

  say(`무대 ${stageId} 로 이동 (추상 이동: ${moveCost} 틱)`);
  advanceTime(moveCost);

  let result, done = false, ripples = [];
  if (!world.has(src.id)) {
    result = 'timeout';
    say('도착했으나 표본이 이미 소멸했다 — 사슬 실패 (상태형 재료 "시간과 기회" 상실)');
  } else {
    say(`t${tick}: 법칙 apply(채취, 정밀도=${정밀도}) — 잔여시간 ${state.stage[stageId]['잔여시간']}`);
    const res = laws.apply(actor, '채취', world.get(src.id), { 정밀도, stage: stageId }, { ledger, events, world });
    const 표본 = res.adds[0];
    say(`채취물 생성: 신성잔향보존율=${표본.properties['신성잔향보존율'].toFixed(3)} 오염도=${표본.properties['오염도'].toFixed(3)} (에너지 -${res.energy})`);

    const dc = checkDone(target, ctx);
    done = dc.done;
    if (done) {
      result = 'success';
      ripples = ripple(target, graph, ctx);
      say(`t${tick}: done_when 충족 → 완료. 파문 ${ripples.length} 갈래 상향`);
      for (const ev of ripples) {
        say(`  파문 ▸ ${ev.branch} 경유 조상: ${ev.ancestors.map((a) => a.id).join(' → ')}`);
      }
    } else {
      result = 'timeout';
      say('채취했으나 done_when 미충족 (순도 부족?) — 사슬 실패');
    }
  }

  return {
    result, done, ticks: tick, log,
    events: events.all(),
    ledger: ledger.snapshot(),
    ripples,
    inventory: actor.inventory.map((s) => ({ id: s.id, kind: s.kind, properties: s.properties })),
    audit: ledger.audit(),
  };
}
