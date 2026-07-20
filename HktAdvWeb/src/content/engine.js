// =====================================================================
// 콘텐츠 세션 — 픽스처 위에서 봇을 굴리는 공용 하네스 (콘텐츠 단계 C1~C7)
// ---------------------------------------------------------------------
// 엔진 모듈(World·Ledger·EventLog·법칙·demand·complete·ripple·belief·decompose)을
// 한 세션으로 묶는다. 각 콘텐츠 단계(cN.js)는 이 세션에 픽스처를 세우고 봇을
// 스크립트로 움직여 §7 의 "완성되는 루프"와 실패 모드를 재현한다.
//
// 불변 원칙 유지: 상태 변경은 법칙 apply() (또는 원장 mint/burn = 세계 경계) 로만.
// 자동 회귀(test/content-*.test.js)와 눈 검증(데모)이 같은 코드 경로.
// =====================================================================
import { World, Substance } from '../substrate/substance.js';
import { Ledger } from '../substrate/ledger.js';
import { EventLog } from '../substrate/events.js';
import { matchAllDemands } from '../graph/demand.js';
import { checkDone as checkDoneNode, detectTransitions } from '../graph/complete.js';
import { ripple } from '../graph/ripple.js';
import { BeliefView } from '../epistemic/belief.js';
import { contentLawTable } from './laws.js';
import { CycleClock, worldCycleEffects } from './cycles.js';
import { RegionMap } from './regions.js';

export class ContentSession {
  constructor(graph, { cycles, regions, regen = {}, seedState, start = null } = {}) {
    this.graph = graph;
    this.lexicon = graph.lexicon;
    this.constants = graph.constants;
    this.world = new World(this.lexicon);
    this.ledger = new Ledger();
    this.events = new EventLog();
    this.laws = contentLawTable(this.lexicon);
    this.state = seedState ?? { world: {}, stage: {} };
    this.state.world ??= {}; this.state.stage ??= {};
    this.regions = regions ? new RegionMap(regions) : null;
    this.start = start;
    this.clock = cycles
      ? new CycleClock(cycles, { state: this.state, world: this.world, onTick: worldCycleEffects(regen) })
      : null;
    this.bots = [];
    this.log = [];
    this._done = new Map(); // 완료 전이 추적용 스냅샷
  }

  say(m) { this.log.push(m); return m; }

  // 세계에 원천 개체를 놓는다 (스폰 아님 — 픽스처가 세운 세계의 실존 요소).
  place(spec) { return this.world.add(spec); }

  addBot(id, energy = 100, opts = {}) {
    this.ledger.open(id, energy);
    const bot = {
      id,
      정밀도: opts['정밀도'] ?? 0.9,
      actor: { id, inventory: [] },
      belief: opts.belief ?? BeliefView.fromGraph(this.graph, id),
      region: opts.region ?? this.start,
    };
    this.bots.push(bot);
    return bot;
  }

  // 봇에게 시작 재료를 쥐여준다 (능력·사전 확보 재료 등 — 픽스처 초기 보유).
  give(bot, spec) {
    const sub = spec instanceof Substance ? spec : new Substance(spec, this.lexicon);
    bot.actor.inventory.push(sub);
    return sub;
  }

  ctxFor(bot) {
    return {
      constants: this.constants, lexicon: this.lexicon, actor: bot.actor,
      world: this.world, ledger: this.ledger, state: this.state, events: this.events,
      belief: bot.belief,
    };
  }

  // 시간을 n 틱 진행한다 (주기 시계가 있으면 그 구동기를, 없으면 소멸타이머만).
  tick(n = 1) {
    if (this.clock) return this.clock.step(n);
    for (let i = 0; i < n; i++) {
      for (const e of this.world.all()) {
        if (typeof e.properties['소멸타이머'] === 'number') {
          e.properties['소멸타이머'] -= 1;
          if (e.properties['소멸타이머'] <= 0) this.world.remove(e.id);
        }
      }
    }
    return 0;
  }

  get t() { return this.clock?.tick ?? 0; }

  // 봇을 지역으로 이동시킨다. 이동 비용(틱)만큼 시계를 진행 → 주기와 맞물린다.
  // R0 은 월식 창에만 통행 가능 (blocked 훅). 도달 불가면 null.
  move(bot, to) {
    if (!this.regions) throw new Error('regions 픽스처가 없다 — 이동 불가');
    const from = bot.region ?? this.start;
    const eclipseOpen = this.clock?.has('월식') ? this.clock.isOpen('월식') : true;
    // R0(신의 거처)은 월식 창에만 통행 가능 — 목적지든 경유든 차단.
    if (to === 'R0' && !eclipseOpen) { this.say(`${bot.id}: ${from}→R0 이동 불가 (월식 창 밖 — 길이 드러나지 않는다)`); return null; }
    const blocked = (rid) => rid === 'R0' && !eclipseOpen;
    const res = this.regions.path(from, to, { blocked });
    if (!res) { this.say(`${bot.id}: ${from}→${to} 이동 불가 (경로 차단 — 월식 창 대기?)`); return null; }
    this.tick(res.cost);
    bot.region = to;
    this.say(`${bot.id}: ${res.path.join('→')} 이동 (${res.cost}틱 소모, 현재 t${this.t})`);
    return res.cost;
  }

  // 법칙 적용 — 상태 변경의 유일한 경로.
  apply(bot, verb, target, params = {}) {
    return this.laws.apply(bot.actor, verb, target, params, { ledger: this.ledger, events: this.events, world: this.world });
  }

  // 에너지 수확 — 세계 경계 유입(mint). 흉터에서 새는 신성 에너지를 원장에 채운다.
  harvest(bot, amount, cause = '흉터 수확', stage = null) {
    this.ledger.mint(bot.id, amount, cause);
    this.events.append({ actor: bot.id, verb: '수확', target: stage, tags: [], delta: { 잔고: amount }, energy: 0, stage });
    this.say(`${bot.id}: ${cause} → 잔고 +${amount} (현재 ${this.ledger.balance(bot.id)})`);
  }

  // 세계 상태 경로를 직접 전이시킨다 (전투 결과·aftermath 등 — 사건으로 감사).
  setState(bot, path, value, { verb = 'aftermath', target = null } = {}) {
    const segs = path.split('.');
    let node = this.state;
    for (let i = 0; i < segs.length - 1; i++) { node[segs[i]] ??= {}; node = node[segs[i]]; }
    node[segs.at(-1)] = value;
    this.events.append({ actor: bot?.id ?? null, verb, target, tags: [], delta: { state: { path, value } }, energy: 0, stage: null });
  }

  demandsMet(bot, goal) { return matchAllDemands(bot.actor, goal.demand, this.world, this.ctxFor(bot)); }
  checkDone(goal, bot) { return checkDoneNode(goal, this.ctxFor(bot)); }
  ripple(goal, bot) { return ripple(goal, this.graph, this.ctxFor(bot)); }
  transitions(bot) { const r = detectTransitions(this.graph, this.ctxFor(bot), this._done); this._done = r.doneNow; return r; }

  goal(id) {
    const g = this.graph.goalsById.get(id);
    if (!g) throw new Error(`없는 목적 노드: ${id}`);
    return g;
  }

  audit() { return this.ledger.audit(); }
  snapshot() {
    return { log: this.log, cycleLog: this.clock?.log ?? [], events: this.events.all(), ledger: this.ledger.snapshot(), audit: this.audit() };
  }
}
