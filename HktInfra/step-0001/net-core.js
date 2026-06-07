// HktInfra step-0001 — 최소 골격 토폴로지
// 박스 4개(로그인 · 게이트웨이 · 존 · 세션 레지스트리) + 클라 1 을 인프로세스 액터 + 메시지 큐로 세운다.
// 이 step 의 산출물은 박스 내부가 아니라 *경계와 메시지 계약*이다 — 박스는 스텁이어도 좋다.
//
// 척추(SPINE.md) 준수:
//  - 신성한 tick: 존 onTick 은 intent 적용 + VM 전진 + 뷰 발행만 한다 (인증·티켓·세션 관리는 전부 존 밖).
//  - 결정론 코어: 세계 상태의 쓰기 경로는 intent→VM 하나. 시드 의사난수만(Math.random 금지), 정수 연산만.
//  - 권위 단일 소유: 존이 자기 엔티티 전부의 유일 소유자(매 tick 검사).
//  - 은닉·단일 연결: 클라가 아는 주소는 'login'·'gateway' 뿐. 존/레지스트리 주소·세션ID 는 클라 메시지에 나타나지 않는다.
'use strict';

// ── 시드 의사난수 (mulberry32, uint32 반환) ─────────────────────────────
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return (t ^ (t >>> 14)) >>> 0;
  };
}

// ── FNV-1a 32bit 해시 ──────────────────────────────────────────────────
function fnv1a(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

// ── 메시지 네트 (무손실 · 즉시: tick T 발신 → T+1 배달, FIFO) ────────────
// 전 메시지를 log 에 기록한다 — 은닉 검사(verify `hide`)의 원료.
class Net {
  constructor() {
    this.actors = new Map();
    this.order = [];        // onTick 호출 순서 = 등록 순서 (결정론)
    this.pending = [];
    this.log = [];
    this.tick = 0;
    this.seq = 0;
  }
  register(addr, actor) {
    this.actors.set(addr, actor);
    this.order.push(actor);
    actor.addr = addr;
    actor.net = this;
  }
  send(from, to, payload) {
    const m = { tick: this.tick, seq: this.seq++, from, to, payload };
    this.pending.push(m);
    this.log.push(m);
  }
  step() {
    this.tick++;
    const deliver = this.pending;
    this.pending = [];
    for (const m of deliver) {
      const a = this.actors.get(m.to);
      if (a && a.onMsg) a.onMsg(m);
    }
    for (const a of this.order) if (a.onTick) a.onTick(this.tick);
  }
}

// ── [엣지] 로그인/인증 서버 (스텁) ───────────────────────────────────────
// 계정 검증 → 일회성 티켓 발급(결정론) → 레지스트리에 등록, 클라엔 티켓만.
class LoginServer {
  constructor(accounts, seed) {
    this.accounts = new Set(accounts);
    this.seed = seed >>> 0;
    this.issued = 0;
  }
  onMsg(m) {
    const p = m.payload;
    if (p.type !== 'auth') return;
    if (!this.accounts.has(p.account)) {
      this.net.send(this.addr, m.from, { type: 'auth_fail' });
      return;
    }
    const ticket = 'TK' + fnv1a(p.account + ':' + this.seed + ':' + this.issued++).toString(16);
    this.net.send(this.addr, 'registry', { type: 'ticket_issued', ticket, account: p.account });
    this.net.send(this.addr, m.from, { type: 'auth_ok', ticket });
  }
}

// ── [코디네이션] 세션 레지스트리 (스텁) — "누가 어디에"의 SSOT ─────────────
// 티켓 검증(일회성) · 세션 발급 · 존 배정(이 step 은 zone1 고정) · 수명주기 추적.
class SessionRegistry {
  constructor() {
    this.tickets = new Map();   // ticket -> {account, used}
    this.sessions = new Map();  // sessionId -> {account, gateway, zone, avatar, state}
    this.nextSession = 1;
    this.nextAvatar = 1;
  }
  onMsg(m) {
    const p = m.payload;
    if (p.type === 'ticket_issued') {
      this.tickets.set(p.ticket, { account: p.account, used: false });
    } else if (p.type === 'validate') {
      const t = this.tickets.get(p.ticket);
      if (t && !t.used) {
        t.used = true; // 일회성 — 재사용은 거부된다
        const sessionId = 'S' + this.nextSession++;
        const avatar = 'av' + this.nextAvatar++;
        this.sessions.set(sessionId, { account: t.account, gateway: m.from, zone: 'zone1', avatar, state: 'active' });
        this.net.send(this.addr, m.from, { type: 'validate_ok', ref: p.ref, sessionId, zone: 'zone1', avatar });
      } else {
        this.net.send(this.addr, m.from, { type: 'validate_fail', ref: p.ref });
      }
    } else if (p.type === 'session_closed') {
      const s = this.sessions.get(p.sessionId);
      if (s) s.state = 'closed';
    }
  }
}

// ── [엣지] 게이트웨이 — 클라의 유일한 게임 연결점. 내부 토폴로지를 은닉한다 ──
// 티켓 검증은 레지스트리에 위임, intent 는 존으로 중계, 뷰는 존 정체를 벗겨 클라로.
// 세션 없는 intent 는 *여기서* 떨어진다 — 존은 무자격 트래픽을 평생 모른다.
class Gateway {
  constructor() {
    this.byClient = new Map();   // clientAddr -> bind
    this.bySession = new Map();  // sessionId  -> bind
    this.dropped = 0;            // 무세션 intent 폐기 수
    this.rejected = 0;           // connect 거부 수
  }
  onMsg(m) {
    const p = m.payload;
    if (m.from === 'registry') {
      if (p.type === 'validate_ok') {
        const bind = { client: p.ref, sessionId: p.sessionId, zone: p.zone, avatar: p.avatar };
        this.byClient.set(p.ref, bind);
        this.bySession.set(p.sessionId, bind);
        this.net.send(this.addr, p.zone, { type: 'enter', sessionId: p.sessionId, avatar: p.avatar });
        this.net.send(this.addr, p.ref, { type: 'connect_ok' }); // 클라에겐 어떤 내부 식별자도 없다
      } else if (p.type === 'validate_fail') {
        this.rejected++;
        this.net.send(this.addr, p.ref, { type: 'connect_fail' });
      }
      return;
    }
    if (m.from.startsWith('zone')) {
      if (p.type === 'view') {
        const bind = this.bySession.get(p.sessionId);
        if (bind) this.net.send(this.addr, bind.client, { type: 'view', t: p.t, view: p.view }); // sessionId·존 주소 박리
      }
      return;
    }
    // ── 클라 발신 ──
    if (p.type === 'connect') {
      if (this.byClient.has(m.from)) { // 중복 연결 거부
        this.rejected++;
        this.net.send(this.addr, m.from, { type: 'connect_fail' });
        return;
      }
      this.net.send(this.addr, 'registry', { type: 'validate', ticket: p.ticket, ref: m.from });
    } else if (p.type === 'intent') {
      const bind = this.byClient.get(m.from);
      if (bind) this.net.send(this.addr, bind.zone, { type: 'intent', sessionId: bind.sessionId, avatar: bind.avatar, intent: p.intent });
      else this.dropped++; // 세션 경계 밖 — 존까지 못 간다
    } else if (p.type === 'disconnect') {
      const bind = this.byClient.get(m.from);
      if (!bind) return;
      this.net.send(this.addr, bind.zone, { type: 'leave', sessionId: bind.sessionId, avatar: bind.avatar });
      this.net.send(this.addr, 'registry', { type: 'session_closed', sessionId: bind.sessionId });
      this.net.send(this.addr, m.from, { type: 'disconnect_ok' });
      this.byClient.delete(m.from);
      this.bySession.delete(bind.sessionId);
    }
  }
}

// ── [월드] 존 서버 (최소 결정론 VM 스텁) ────────────────────────────────
// 16×16 정수 격자 위 엔티티. tick = intent 적용(도착 순서) → VM 전진(정수 LCG 혼합) → 뷰 발행 + 해시.
// 시뮬 외 작업 0 — 인증·세션·티켓을 모른다(신성한 tick).
class ZoneServer {
  constructor(seed) {
    this.rng = mulberry32((seed ^ 0x5A17) >>> 0); // 스폰 위치용 시드 의사난수
    this.state = { t: 0, counter: 0, entities: {} };
    this.spawnOrder = [];        // 결정론적 순회 순서
    this.sessions = new Map();   // sessionId -> {gateway, avatar}
    this.owners = new Map();     // avatar -> 소유자(이 존) — 권위 장부
    this.pendingIntents = [];
    this.enterCount = 0;
    this.applied = 0;
    this.ownerViolations = 0;
    this.hashes = [];
  }
  onMsg(m) {
    const p = m.payload;
    if (p.type === 'enter') {
      this.enterCount++;
      this.sessions.set(p.sessionId, { gateway: m.from, avatar: p.avatar });
      this.state.entities[p.avatar] = { x: this.rng() % 16, y: this.rng() % 16, hp: 100 };
      this.owners.set(p.avatar, this.addr);
      this.spawnOrder.push(p.avatar);
    } else if (p.type === 'intent') {
      if (this.sessions.has(p.sessionId)) this.pendingIntents.push(p); // 모르는 세션 방어(정상 경로에선 게이트웨이가 먼저 거른다)
    } else if (p.type === 'leave') {
      this.sessions.delete(p.sessionId);
      delete this.state.entities[p.avatar];
      this.owners.delete(p.avatar);
      this.spawnOrder = this.spawnOrder.filter(a => a !== p.avatar);
    }
  }
  onTick() {
    // ① intent 적용 — 도착 순서 그대로(결정론)
    for (const p of this.pendingIntents) {
      const e = this.state.entities[p.avatar];
      if (e) {
        e.x = (e.x + p.intent.dx + 16) % 16;
        e.y = (e.y + p.intent.dy + 16) % 16;
        this.applied++;
      }
    }
    this.pendingIntents = [];
    // ② VM 전진 — 정수 연산만(비트 결정론)
    this.state.t++;
    let mix = this.state.counter | 0;
    for (const a of this.spawnOrder) {
      const e = this.state.entities[a];
      mix = (Math.imul(mix, 1664525) + 1013904223 + e.x * 31 + e.y) | 0;
    }
    this.state.counter = ((Math.imul(mix, 1664525) + 1013904223) | 0) >>> 0;
    // ③ 권위 장부 검사 — 모든 엔티티의 소유자 = 이 존, 정확히 1
    const ents = Object.keys(this.state.entities);
    const ok = ents.length === this.owners.size && ents.every(a => this.owners.get(a) === this.addr);
    if (!ok) this.ownerViolations++;
    // ④ 해시 + 뷰 발행 (세션별 — 이 step 은 전체 상태, AOI 는 후속 step)
    this.hashes.push(this.hash());
    for (const [sessionId, s] of this.sessions) {
      this.net.send(this.addr, s.gateway, { type: 'view', sessionId, t: this.state.t, view: this.serialize() });
    }
  }
  serialize() { // 안정 순서 직렬화 — 해시·비트 비교의 기준
    const ents = this.spawnOrder
      .map(a => { const e = this.state.entities[a]; return a + ':' + e.x + ',' + e.y + ',' + e.hp; })
      .join('|');
    return 't=' + this.state.t + ';c=' + this.state.counter + ';' + ents;
  }
  hash() { return fnv1a(this.serialize()); }
}

// ── 클라이언트 (스크립트 구동) — 아는 주소는 'login'·'gateway' 뿐 ─────────
class Client {
  constructor(script) {
    this.script = script; // {account, seed, intents, badTicket?, postLogoutIntent?}
    this.phase = 'idle';
    this.ticket = null;
    this.views = 0;
    this.events = [];
    this.sent = 0;
    this.strayDone = false;
    this.rngIntent = null;
  }
  onTick() {
    if (this.phase === 'idle') {
      if (this.script.badTicket) { // 위조 티켓 직행(가설 ⑤a)
        this.ticket = 'TKFORGED';
        this.phase = 'connecting';
        this.net.send(this.addr, 'gateway', { type: 'connect', ticket: this.ticket });
      } else {
        this.phase = 'authing';
        this.net.send(this.addr, 'login', { type: 'auth', account: this.script.account });
      }
    } else if (this.phase === 'playing') {
      if (this.sent < this.script.intents) {
        const dx = (this.rngIntent() % 3) - 1; // -1..1
        const dy = (this.rngIntent() % 3) - 1;
        this.net.send(this.addr, 'gateway', { type: 'intent', intent: { dx, dy } });
        this.sent++;
      } else {
        this.phase = 'disconnecting';
        this.net.send(this.addr, 'gateway', { type: 'disconnect' });
      }
    } else if (this.phase === 'done' && this.script.postLogoutIntent && !this.strayDone) {
      this.strayDone = true; // 퇴장 후 intent (가설 ⑤c) — 게이트웨이에서 떨어져야 한다
      this.net.send(this.addr, 'gateway', { type: 'intent', intent: { dx: 1, dy: 1 } });
    }
  }
  onMsg(m) {
    const p = m.payload;
    this.events.push(p.type);
    if (p.type === 'auth_ok') {
      this.ticket = p.ticket;
      this.phase = 'connecting';
      this.net.send(this.addr, 'gateway', { type: 'connect', ticket: this.ticket });
    } else if (p.type === 'connect_ok') {
      this.phase = 'playing';
      this.rngIntent = mulberry32((this.script.seed ^ 0xC11E) >>> 0);
    } else if (p.type === 'connect_fail') {
      this.phase = 'rejected';
    } else if (p.type === 'view') {
      this.views++;
    } else if (p.type === 'disconnect_ok') {
      this.phase = 'done';
    }
  }
}

// ── 침입자 — 본 클라의 티켓을 훔쳐 재사용 시도 (가설 ⑤b: 일회성 티켓) ──────
class Intruder {
  constructor(victim) { this.victim = victim; this.sentSteal = false; this.events = []; }
  onTick() {
    if (!this.sentSteal && this.victim.phase === 'playing' && this.victim.ticket) {
      this.sentSteal = true;
      this.net.send(this.addr, 'gateway', { type: 'connect', ticket: this.victim.ticket });
    }
  }
  onMsg(m) { this.events.push(m.payload.type); }
}

// ── 하니스 — 한 번의 세계 실행 ──────────────────────────────────────────
function run(opts) {
  const { seed, ticks = 60, scenario = {} } = opts;
  const net = new Net();
  const login = new LoginServer(['hero'], seed);
  const registry = new SessionRegistry();
  const gateway = new Gateway();
  const zone = new ZoneServer(seed);
  const client = new Client({
    account: 'hero', seed,
    intents: scenario.intents !== undefined ? scenario.intents : 20,
    badTicket: !!scenario.badTicket,
    postLogoutIntent: !!scenario.postLogoutIntent,
  });
  net.register('login', login);
  net.register('registry', registry);
  net.register('gateway', gateway);
  net.register('zone1', zone);
  net.register('client', client);
  let intruder = null;
  if (scenario.reuseTicket) {
    intruder = new Intruder(client);
    net.register('client2', intruder);
  }
  for (let i = 0; i < ticks; i++) net.step();
  return {
    net, login, registry, gateway, zone, client, intruder,
    hash: zone.hash(),                       // 최종 존 상태 해시
    chain: fnv1a(zone.hashes.join(',')),     // 매 tick 해시 사슬 — 전 구간 비트 동일성의 지문
    state: zone.serialize(),
  };
}

const PUBLIC_ADDRS = ['login', 'gateway']; // 클라가 알아도 되는 유일한 주소들

if (typeof module !== 'undefined') {
  module.exports = { mulberry32, fnv1a, Net, LoginServer, SessionRegistry, Gateway, ZoneServer, Client, Intruder, run, PUBLIC_ADDRS };
}
