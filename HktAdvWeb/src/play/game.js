// =====================================================================
// 플레이어블 게임 (P0) — 사람이 접속해 조작하는 서버 권위 실시간 세계
// ---------------------------------------------------------------------
// 지금까지는 봇이 모든 사슬을 굴렸다(시뮬레이션·관전). 이 층이 처음으로
// "입력"을 연다: 플레이어가 접속(join)해 지역을 이동하고 무대에서 행동하면,
// 그 행동이 봇과 완전히 같은 경로(법칙 apply → done_when → 파문)로 세계를
// 바꾼다 — 행위자 사슬 공유(설계 §7)의 실체. 서버가 권위이고 클라이언트는
// 상태 payload 만 그린다(불변 원칙 ⑥의 플레이 버전).
//
// 시간 모델: 전역 시계(CycleClock) 하나를 실시간 구동기(서버 setInterval)가
// 민다. 이동은 액터별 travel 로 따로 센다 — 전역 시계를 개인 이동이 밀면
// 다른 플레이어의 시간이 왜곡되기 때문(멀티플레이의 요건).
// =====================================================================
import { readFileSync } from 'node:fs';
import yaml from 'js-yaml';
import { dataPath } from '../paths.js';
import { loadGraph } from '../graph/loader.js';
import { detectTransitions } from '../graph/complete.js';
import { ripple } from '../graph/ripple.js';
import { BeliefView } from '../epistemic/belief.js';
import { traceToConditions } from '../scene/viewmodel.js';
import { ContentSession } from '../content/engine.js';
import { loadComposition } from '../content/regions.js';

export function loadPlayFixture(file = dataPath('world-play.yaml')) {
  return yaml.load(readFileSync(file, 'utf8'));
}

const DEFAULT_GOAL = 'G-0.1.1.2.1'; // 첫 접속의 활성 말단 — C1 첫 사냥터

export class PlayGame {
  constructor(graph = loadGraph(), fixture = loadPlayFixture()) {
    this.graph = graph;
    this.fixture = fixture;
    const comp = loadComposition();
    // 원천 재생성: regen 주기 창이 열릴 때 되살아난다 (리듬의 산물 — 스폰 아님).
    const regen = {};
    for (const src of fixture.sources ?? []) {
      if (src.regen === '순행' && src.stage === 'S-0045') regen['S-0045'] = () => this._spec(src);
    }
    this.session = new ContentSession(graph, {
      cycles: fixture.cycles, regions: comp.regions, regen, start: fixture.start ?? 'R1',
    });
    this.sourcesByStage = new Map(); // stage → [source spec]
    for (const src of fixture.sources ?? []) {
      if (!this.sourcesByStage.has(src.stage)) this.sourcesByStage.set(src.stage, []);
      this.sourcesByStage.get(src.stage).push(src);
      // 주기 시계가 t0 창에서 이미 재생성했을 수 있다 (순행 regen) — 중복 배치 방지.
      if (!this.session.world.has(src.id)) this.session.place(this._spec(src));
    }
    this.players = new Map();
    this.globalFeed = [];
    this._pn = 0;
    // 사회적 존재감 봇 — 플레이어와 같은 사슬로 R1 루프를 돈다.
    this.bots = (fixture.bots ?? []).map((b) => ({
      ...this._newActor(b.id, b.id, b.energy ?? 40), 정밀도: b['정밀도'] ?? 0.7, cooldown: 3, isBot: true,
    }));
  }

  _spec(src) {
    return {
      id: src.id, archetype: src.archetype, kind: src.kind ?? '물질',
      tags: src.tags ?? [], properties: { ...src.properties },
    };
  }

  _newActor(id, name, energy) {
    this.session.ledger.open(id, energy);
    return {
      id, name,
      actor: { id, inventory: [] },
      belief: BeliefView.fromGraph(this.graph, id),
      region: this.fixture.start ?? 'R1',
      traveling: null,
      active: DEFAULT_GOAL,
      doneSnap: new Map(),
      discoveredStages: new Set(this.graph.stages.filter((s) => s.discovered).map((s) => s.id)),
      feed: [],
    };
  }

  get t() { return this.session.t; }
  regionOfStage(sid) { return this.session.regions.regionOfStage(sid); }

  say(p, text, kind = 'info') {
    const entry = { t: this.t, text, kind };
    if (p) { p.feed.push(entry); p.feed = p.feed.slice(-30); }
    return entry;
  }

  broadcast(text, kind = 'world') {
    this.globalFeed.push({ t: this.t, text, kind });
    this.globalFeed = this.globalFeed.slice(-30);
  }

  // ── 접속 ──
  join(name = '모험가') {
    const id = `p${++this._pn}`;
    const p = this._newActor(id, String(name).slice(0, 12), this.fixture.player_energy ?? 20);
    this.players.set(id, p);
    this.say(p, `${p.name} — 잿빛 평원에 도착했다. 활성 목적: 신의 조직 표본을 확보한다`);
    this.broadcast(`${p.name} 이(가) 세계에 들어왔다`);
    return { id, name: p.name };
  }

  player(id) {
    const p = this.players.get(id);
    if (!p) throw new Error('없는 플레이어 — 다시 접속(join)할 것');
    return p;
  }

  // ── 활성 목적 교체 (말단 카드 탭 — 상위 설계 §6.2) ──
  setActiveGoal(id, goalId) {
    const p = this.player(id);
    const g = this.graph.goalsById.get(goalId);
    if (!g || !g.verb) throw new Error('활성 목적은 행동 말단(verb 보유)이어야 한다');
    if (p.belief.stateOf(goalId) === '미발견') throw new Error('아직 발견하지 못한 목적이다');
    p.active = goalId;
    this.say(p, `활성 목적 교체: ${g.title}`);
    return goalId;
  }

  // ── 이동 (액터별 travel — 전역 시계와 독립) ──
  move(id, to) {
    const p = this.player(id);
    if (p.traveling) throw new Error(`이동 중이다 (${p.traveling.to} 까지 ${p.traveling.remaining}틱)`);
    const eclipseOpen = this.session.clock.has('월식') ? this.session.clock.isOpen('월식') : true;
    if (to === 'R0' && !eclipseOpen) {
      throw new Error(`R0 길이 드러나지 않았다 — 월식 창까지 ${this.session.clock.ticksUntilOpen('월식')}틱`);
    }
    const res = this.session.regions.path(p.region, to, { blocked: (rid) => rid === 'R0' && !eclipseOpen });
    if (!res) throw new Error(`${p.region}→${to} 경로가 없다`);
    if (res.cost === 0) return { arrived: true, cost: 0 };
    p.traveling = { to, path: res.path, remaining: res.cost, total: res.cost };
    this.say(p, `${res.path.join('→')} 이동 시작 (${res.cost}틱)`);
    return { arrived: false, cost: res.cost };
  }

  _arrive(p) {
    p.region = p.traveling.to;
    p.traveling = null;
    this.say(p, `${p.region} 도착`);
    // 도착 = 발견: 이 지역의 미발견 무대가 "?" 에서 실체로 (인식은 발품의 산물).
    for (const sid of this.session.regions.stagesOf(p.region)) {
      if (!p.discoveredStages.has(sid)) {
        p.discoveredStages.add(sid);
        const st = this.graph.stagesById.get(sid);
        this.say(p, `무대 발견: ${st?.source ?? sid}`, 'discover');
      }
    }
  }

  // ── 행동 — 상태 변경은 법칙 apply() 경유 (봇과 같은 경로) ──
  act(id, { verb, stage = null, target = null, params = {} } = {}) {
    const p = this.player(id);
    if (p.traveling) throw new Error('이동 중에는 행동할 수 없다');
    if (stage && this.regionOfStage(stage) !== p.region) {
      throw new Error(`${stage} 는 이 지역(${p.region})에 없다`);
    }
    const st = this.session.state.stage;

    // 수확은 세계 경계 유입(원장 mint) — 법칙이 아니라 세션 harvest 경로.
    if (verb === '수확') {
      if (this.regionOfStage('S-0103') !== p.region) throw new Error('흉터(S-0103)는 R1 에 있다');
      const 신선도 = st['S-0103']?.['신선도'] ?? 0;
      if (신선도 <= 0) throw new Error('흉터가 풍화됐다 — 다음 순행 창을 기다려라');
      const amount = Math.min(35, 5 + 신선도);
      this.session.harvest(p, amount, '흉터 수확', 'S-0103');
      this.say(p, `유출 에너지 수확 +${amount} (잔고 ${this.session.ledger.balance(p.id)})`, 'gain');
      return this._afterAct(p, { verb, amount });
    }

    // 무대별 관문(시간 창·소진) — 배치 원칙 ㉢ "시간이 가격"의 실행부.
    let tgt = null;
    if (verb === '채취' || verb === '포획') {
      const specs = this.sourcesByStage.get(stage) ?? [];
      const live = specs.map((s) => this.session.world.get(target ?? s.id)).filter(Boolean);
      tgt = target ? this.session.world.get(target) : live[0];
      if (!tgt) throw new Error('원천이 없다 — 소멸했거나 이미 소진됐다 (다음 창을 기다려라)');
      const spec = specs.find((s) => s.id === tgt.id);
      if (spec?.gate && !this.session.clock.isOpen(spec.gate)) {
        throw new Error(`지금은 불가 — [${spec.gate}] 창까지 ${this.session.clock.ticksUntilOpen(spec.gate)}틱`);
      }
      if (stage === 'S-0045' && (st['S-0045']?.['잔여시간'] ?? 0) <= 0) {
        throw new Error('조직이 소멸 직전을 지났다 — 다음 순행을 기다려라');
      }
    }
    if (verb === '관찰' && params['주제'] === '신.행동주기' && (st['S-0103']?.['신선도'] ?? 0) <= 0) {
      throw new Error('흉터가 풍화돼 읽을 것이 없다');
    }
    if (verb === '관찰' && params['주제'] === '신.에너지순환') {
      const 표본 = p.actor.inventory.find((m) => (m.properties['신성잔향보존율'] ?? 0) >= this.graph.constants['잔향보존_최소']);
      if (!표본) throw new Error('관찰할 표본이 없다 — 먼저 잔향 보존율이 충분한 표본을 확보하라');
      tgt = 표본;
    }
    if (verb === '협상' && p.region !== this.regionOfStage('S-0502')) throw new Error('협상은 시장(R5)에서');
    if (verb === '협상' && params['신뢰단계'] !== undefined) {
      const 증표 = p.actor.inventory.find((m) => (m.properties['신성잔향보존율'] ?? 0) >= 0.3);
      if (!증표) throw new Error('시장이 원하는 증표(잔향 ≥ 0.3)가 없다 — 오염 표본이라도 가져와라');
    }

    // 법칙 적용 — 유일한 상태 변경 경로. 에너지 부족 등은 법칙이 거부한다.
    const res = this.session.apply(p, verb, tgt, { ...params, stage });
    const made = res.adds.map((s) => this._matSummary(s)).join(', ');
    this.say(p, `${verb}${stage ? `@${stage}` : ''} → ${made || '기록됨'} (에너지 -${res.energy})`, 'act');

    // 소진 무대: 성공하면 원천이 사라진다 — 선착 경쟁의 실체.
    const spec = tgt && (this.sourcesByStage.get(stage) ?? []).find((s) => s.id === tgt.id);
    if (spec?.consume && this.session.world.has(tgt.id)) {
      this.session.world.remove(tgt.id);
      this.broadcast(`${stage} 의 원천이 소진됐다 — 다음 창을 기다려야 한다`);
    }
    return this._afterAct(p, { verb, adds: res.adds.map((s) => s.id) });
  }

  // 행동 후: 완료 전이 검출 → 파문 → 피드. 재개방도 잡는다 (완료는 술어의 현재값).
  _afterAct(p, result) {
    const ctx = this.session.ctxFor(p);
    const tr = detectTransitions(this.graph, ctx, p.doneSnap);
    p.doneSnap = tr.doneNow;
    const ripples = [];
    for (const gid of tr.completed) {
      const g = this.graph.goalsById.get(gid);
      if (p.belief.stateOf(gid) === '미발견') continue; // 믿음에 없는 완료는 조용히 (그래프=믿음)
      const rs = ripple(g, this.graph, ctx);
      ripples.push(...rs);
      this.say(p, `목적 완료: ${g.title} — 파문 ${rs.length}갈래 상향`, 'ripple');
      for (const r of rs) this.say(p, `  ▸ ${[gid, ...r.ancestors.map((a) => a.id)].join(' → ')}`, 'ripple');
      this.broadcast(`누군가의 파문이 ${rs.length}갈래로 올랐다`, 'ripple'); // 익명 — 타인의 파문(§6.4)
    }
    for (const gid of tr.reopened) {
      const g = this.graph.goalsById.get(gid);
      this.say(p, `목적 재개방: ${g.title} — 세계가 변해 술어가 다시 거짓이 됐다`, 'reopen');
    }
    return { ok: true, ...result, completed: tr.completed, ripples: ripples.length };
  }

  // ── 실시간 구동기(서버 setInterval)가 매 tick_ms 마다 부른다 ──
  tick() {
    const before = new Map(this.session.clock.cycles.map((c) => [c.name, this.session.clock.isOpen(c.name)]));
    this.session.tick(1);
    for (const [name, was] of before) {
      const now = this.session.clock.isOpen(name);
      if (now && !was) this.broadcast(`[${name}] 창이 열렸다`, 'cycle');
      if (!now && was) this.broadcast(`[${name}] 창이 닫혔다`, 'cycle');
    }
    // 무리분산 재생성: 창이 열리면 소진된 권속 원천이 되돌아온다.
    for (const [stage, specs] of this.sourcesByStage) {
      for (const spec of specs) {
        if (spec.regen && spec.regen !== '순행' && this.session.clock.isOpen(spec.regen) && !this.session.world.has(spec.id)) {
          this.session.world.add(this._spec(spec));
        }
      }
    }
    // 이동 진행
    for (const p of this.players.values()) {
      if (p.traveling && --p.traveling.remaining <= 0) this._arrive(p);
    }
    // 봇 — 플레이어와 같은 사슬로 R1 루프 (사회적 배경 복사)
    for (const b of this.bots) {
      if (--b.cooldown > 0) continue;
      b.cooldown = 7;
      try {
        const src = this.session.world.get('조직조각-R1');
        if (src && this.session.ledger.balance(b.id) > 2) {
          this.session.apply(b, '채취', src, { 정밀도: b['정밀도'], stage: 'S-0045' });
          this.broadcast('저편에서 누군가 조직을 수습하고 있다');
        } else if ((this.session.state.stage['S-0103']?.['신선도'] ?? 0) > 0) {
          this.session.harvest(b, 8, '흉터 수확', 'S-0103');
        }
      } catch { /* 봇의 실패는 조용히 — 세계는 계속 돈다 */ }
    }
    return this.t;
  }

  _matSummary(s) {
    const keys = ['신성잔향보존율', '생체촉매활성', '공명전달률', '공명출력', '내한성', '신성내성', '주제', '신뢰단계', '대상'];
    const parts = [];
    for (const k of keys) {
      const v = s.properties?.[k];
      if (v !== undefined) parts.push(`${k}=${typeof v === 'number' ? v.toFixed(2) : v}`);
    }
    return `${s.archetype ?? s.kind}(${parts.join(' ')})`;
  }

  // ── 상태 payload — 클라이언트는 이것만 그린다 ──
  state(id) {
    const p = this.player(id);
    const clock = this.session.clock;
    const st = this.session.state.stage;
    const goal = this.graph.goalsById.get(p.active);
    const dc = goal ? { done: p.doneSnap.get(goal.id) ?? false, conditions: traceToConditions(this.session.checkDone(goal, p).trace) } : null;

    const stages = this.session.regions.stagesOf(p.region).map((sid) => {
      const known = p.discoveredStages.has(sid);
      const s = this.graph.stagesById.get(sid);
      const specs = this.sourcesByStage.get(sid) ?? [];
      return {
        id: sid,
        source: known ? s?.source : '?',
        timers: {
          잔여시간: st[sid]?.['잔여시간'] ?? null,
          신선도: st[sid]?.['신선도'] ?? null,
        },
        targets: known ? specs.filter((x) => this.session.world.has(x.id)).map((x) => ({
          id: x.id, archetype: x.archetype, gate: x.gate ?? null,
          gateOpen: x.gate ? clock.isOpen(x.gate) : true,
        })) : [],
      };
    });

    const here = (a) => !a.traveling && a.region === p.region && a.id !== p.id;
    const others = [...this.players.values()].filter(here).map((o) => o.name)
      .concat(this.bots.filter((b) => b.region === p.region).map(() => '낯선 모험가'));

    return {
      tick: this.t,
      tickMs: this.fixture.tick_ms ?? 1000,
      you: {
        id: p.id, name: p.name, region: p.region, traveling: p.traveling,
        energy: this.session.ledger.balance(p.id),
        inventory: p.actor.inventory.map((s) => this._matSummary(s)),
        activeGoal: goal ? { id: goal.id, title: goal.title, desired: goal.desired, verb: goal.verb, done: dc.done, conditions: dc.conditions } : null,
        goals: this.graph.goals
          .filter((g) => g.verb && p.belief.stateOf(g.id) !== '미발견')
          .map((g) => ({ id: g.id, title: g.title, state: p.belief.stateOf(g.id), done: p.doneSnap.get(g.id) ?? false })),
      },
      region: {
        id: p.region, name: this.session.regions.get(p.region)?.name ?? p.region,
        danger: this.session.regions.get(p.region)?.danger ?? 0,
        stages, others,
      },
      map: this.session.regions.regions.map((r) => ({
        id: r.id, name: r.name, danger: r.danger,
        adjacent: r.adjacent ?? [], cost: this.session.regions.moveCost(p.region, r.id),
        here: r.id === p.region,
      })),
      cycles: (this.fixture.cycles ?? []).map((c) => ({
        name: c.name, open: clock.isOpen(c.name),
        opensIn: clock.ticksUntilOpen(c.name), closesIn: clock.windowClosesIn(c.name),
      })),
      feed: [...p.feed.slice(-14), ...this.globalFeed.slice(-6)].sort((a, b) => a.t - b.t).slice(-16),
      audit: this.session.audit().ok ?? true,
    };
  }
}
