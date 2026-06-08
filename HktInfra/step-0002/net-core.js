// HktInfra step-0002 — 존 결정론 복제 (입력 재현 = 복제, 상태 전송 아님)
// step-0001 골격을 잇고 *한 조각*만 더한다: 추종자(follower) 존 인스턴스.
// 게이트웨이가 존으로 가는 intent 스트림(enter/intent/leave)을 추종자 존에 *그대로 복사*하면,
// 상태 바이트를 한 번도 전송하지 않고 권위·추종자가 매 tick 같은 해시에 도달한다.
//
// step-0001 의 det 는 *같은 프로세스의 자기 재현*이었다(0001 §8.2).
// step-0002 는 그 토대 위에서 *다른 인스턴스가 입력 로그만으로 같은 상태*(복제=재현)를 격리 증명한다.
//
// 척추(SPINE.md) 준수:
//  - 신성한 tick: 추종자 onTick 도 권위와 동일(intent 적용 + VM 전진 + 해시). 복제 탭은 게이트웨이의 입력 중계지 존 tick 밖.
//  - 결정론 코어: 추종자도 세계 상태 쓰기 경로는 intent→VM 하나. 같은 시드·로그 → 같은 해시.
//  - 권위 단일 소유: 권위 존만 쓰기 권위. 추종자는 권위 0 — 읽기 전용 재현(뷰 발행 안 함, 소유자는 권위 존 기록).
//  - 은닉·단일 연결: 클라는 여전히 게이트웨이만. 추종자('zone1f')는 내부 — 클라 메시지에 0건.
//
// 회귀 0(불변): replicate off 면 추종자/탭 송신이 0 → step-0001 과 비트 동일(골든 해시 유지).
//             replicate on 이어도 권위 존은 비-침습(추종자 복사는 다른 액터로 — 권위 입력열 불변) → 골든 유지.
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
class SessionRegistry {
  constructor() {
    this.tickets = new Map();
    this.sessions = new Map();
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
        t.used = true;
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
// step-0002 추가: replicas[] — 권위 존으로 가는 입력열(enter/intent/leave)을 같은 tick 에
// 추종자 존(들)에도 *그대로 복사*한다. 권위 존 송신은 1바이트도 안 바뀐다(비-침습 탭).
// replicas 가 비면 step-0001 과 동일 — 회귀 0.
class Gateway {
  constructor() {
    this.byClient = new Map();
    this.bySession = new Map();
    this.dropped = 0;
    this.rejected = 0;
    this.replicas = [];   // 추종자 존 주소들 — 입력 스트림 미러 대상 (off = [])
  }
  // 권위 입력 송신 뒤, 같은 payload 를 추종자(들)에 복사. 권위 경로는 먼저·그대로 — 불변.
  mirror(payload) {
    for (const r of this.replicas) this.net.send(this.addr, r, payload);
  }
  onMsg(m) {
    const p = m.payload;
    if (m.from === 'registry') {
      if (p.type === 'validate_ok') {
        const bind = { client: p.ref, sessionId: p.sessionId, zone: p.zone, avatar: p.avatar };
        this.byClient.set(p.ref, bind);
        this.bySession.set(p.sessionId, bind);
        const enter = { type: 'enter', sessionId: p.sessionId, avatar: p.avatar };
        this.net.send(this.addr, p.zone, enter);
        this.mirror(enter);                                   // 추종자도 같은 enter
        this.net.send(this.addr, p.ref, { type: 'connect_ok' });
      } else if (p.type === 'validate_fail') {
        this.rejected++;
        this.net.send(this.addr, p.ref, { type: 'connect_fail' });
      }
      return;
    }
    if (m.from.startsWith('zone')) {
      // 권위 존만 뷰를 보낸다(추종자는 발행 안 함). 추종자 주소는 여기 닿지 않는다.
      if (p.type === 'view') {
        const bind = this.bySession.get(p.sessionId);
        if (bind) this.net.send(this.addr, bind.client, { type: 'view', t: p.t, view: p.view });
      }
      return;
    }
    if (p.type === 'connect') {
      if (this.byClient.has(m.from)) {
        this.rejected++;
        this.net.send(this.addr, m.from, { type: 'connect_fail' });
        return;
      }
      this.net.send(this.addr, 'registry', { type: 'validate', ticket: p.ticket, ref: m.from });
    } else if (p.type === 'intent') {
      const bind = this.byClient.get(m.from);
      if (bind) {
        const intent = { type: 'intent', sessionId: bind.sessionId, avatar: bind.avatar, intent: p.intent };
        this.net.send(this.addr, bind.zone, intent);
        this.mirror(intent);                                  // 추종자도 같은 intent
      } else this.dropped++;
    } else if (p.type === 'disconnect') {
      const bind = this.byClient.get(m.from);
      if (!bind) return;
      const leave = { type: 'leave', sessionId: bind.sessionId, avatar: bind.avatar };
      this.net.send(this.addr, bind.zone, leave);
      this.mirror(leave);                                     // 추종자도 같은 leave
      this.net.send(this.addr, 'registry', { type: 'session_closed', sessionId: bind.sessionId });
      this.net.send(this.addr, m.from, { type: 'disconnect_ok' });
      this.byClient.delete(m.from);
      this.bySession.delete(bind.sessionId);
    }
  }
}

// ── [월드] 존 서버 (최소 결정론 VM 스텁) ────────────────────────────────
// step-0002 추가: role ('authority' | 'follower'). 추종자는 권위 0 — 뷰를 발행하지 않고,
// 소유자 장부에 *권위 존*을 기록한다(자기 권위 0). 계산 경로는 권위와 비트 동일.
class ZoneServer {
  constructor(seed, opts = {}) {
    this.rng = mulberry32((seed ^ 0x5A17) >>> 0);
    this.state = { t: 0, counter: 0, entities: {} };
    this.spawnOrder = [];
    this.sessions = new Map();
    this.owners = new Map();        // avatar -> 권위 소유자 주소
    this.pendingIntents = [];
    this.enterCount = 0;
    this.applied = 0;
    this.ownerViolations = 0;
    this.hashes = [];
    this.role = opts.role || 'authority';     // 'authority' | 'follower'
    this.authorityAddr = opts.authorityAddr;  // 추종자일 때 권위 존 주소
    this.authClaims = 0;            // 이 인스턴스가 *자기* 권위로 주장하는 엔티티 수(추종자 = 0 이어야)
  }
  // 이 인스턴스가 엔티티에 기록할 소유자: 권위는 자신, 추종자는 권위 존(자기 권위 0)
  ownerFor() { return this.role === 'follower' ? this.authorityAddr : this.addr; }
  onMsg(m) {
    const p = m.payload;
    if (p.type === 'enter') {
      this.enterCount++;
      this.sessions.set(p.sessionId, { gateway: m.from, avatar: p.avatar });
      this.state.entities[p.avatar] = { x: this.rng() % 16, y: this.rng() % 16, hp: 100 };
      this.owners.set(p.avatar, this.ownerFor());
      this.spawnOrder.push(p.avatar);
    } else if (p.type === 'intent') {
      if (this.sessions.has(p.sessionId)) this.pendingIntents.push(p);
    } else if (p.type === 'leave') {
      this.sessions.delete(p.sessionId);
      delete this.state.entities[p.avatar];
      this.owners.delete(p.avatar);
      this.spawnOrder = this.spawnOrder.filter(a => a !== p.avatar);
    }
  }
  onTick() {
    // ① intent 적용 — 도착 순서 그대로(결정론). 권위·추종자 동일 입력 → 동일 결과.
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
    // ③ 권위 장부 검사 — 모든 엔티티의 소유자 = ownerFor(), 정확히 1. 추종자 자기 권위 주장 = 0.
    const ents = Object.keys(this.state.entities);
    const expect = this.ownerFor();
    const ok = ents.length === this.owners.size && ents.every(a => this.owners.get(a) === expect);
    if (!ok) this.ownerViolations++;
    this.authClaims = ents.filter(a => this.owners.get(a) === this.addr).length;
    // ④ 해시 (+ 뷰 발행 — 권위만. 추종자는 읽기 전용 재현이라 발행 안 함)
    this.hashes.push(this.hash());
    if (this.role !== 'follower') {
      for (const [sessionId, s] of this.sessions) {
        this.net.send(this.addr, s.gateway, { type: 'view', sessionId, t: this.state.t, view: this.serialize() });
      }
    }
  }
  serialize() {
    const ents = this.spawnOrder
      .map(a => { const e = this.state.entities[a]; return a + ':' + e.x + ',' + e.y + ',' + e.hp; })
      .join('|');
    return 't=' + this.state.t + ';c=' + this.state.counter + ';' + ents;
  }
  hash() { return fnv1a(this.serialize()); }
  chain() { return fnv1a(this.hashes.join(',')); }
}

// ── 클라이언트 (스크립트 구동) — 아는 주소는 'login'·'gateway' 뿐 ─────────
class Client {
  constructor(script) {
    this.script = script;
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
      if (this.script.badTicket) {
        this.ticket = 'TKFORGED';
        this.phase = 'connecting';
        this.net.send(this.addr, 'gateway', { type: 'connect', ticket: this.ticket });
      } else {
        this.phase = 'authing';
        this.net.send(this.addr, 'login', { type: 'auth', account: this.script.account });
      }
    } else if (this.phase === 'playing') {
      if (this.sent < this.script.intents) {
        const dx = (this.rngIntent() % 3) - 1;
        const dy = (this.rngIntent() % 3) - 1;
        this.net.send(this.addr, 'gateway', { type: 'intent', intent: { dx, dy } });
        this.sent++;
      } else {
        this.phase = 'disconnecting';
        this.net.send(this.addr, 'gateway', { type: 'disconnect' });
      }
    } else if (this.phase === 'done' && this.script.postLogoutIntent && !this.strayDone) {
      this.strayDone = true;
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
// opts.replicate: true 면 추종자 존('zone1f')을 같은 시드로 세우고 게이트웨이가 입력열을 미러.
function run(opts) {
  const { seed, ticks = 60, scenario = {}, replicate = false } = opts;
  const net = new Net();
  const login = new LoginServer(['hero'], seed);
  const registry = new SessionRegistry();
  const gateway = new Gateway();
  const zone = new ZoneServer(seed); // 권위
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
  // ── step-0002: 추종자 존 (입력 재현 복제) ──
  let follower = null;
  if (replicate) {
    follower = new ZoneServer(seed, { role: 'follower', authorityAddr: 'zone1' }); // 같은 시드+params
    net.register('zone1f', follower);          // 내부 주소 — 클라는 모른다(은닉)
    gateway.replicas.push('zone1f');           // 게이트웨이가 입력열을 그대로 복사
  }
  for (let i = 0; i < ticks; i++) net.step();
  return {
    net, login, registry, gateway, zone, follower, client, intruder,
    hash: zone.hash(),
    chain: zone.chain(),
    state: zone.serialize(),
    // 추종자 측 — replicate 일 때만 의미
    fhash: follower ? follower.hash() : null,
    fchain: follower ? follower.chain() : null,
    fstate: follower ? follower.serialize() : null,
  };
}

const PUBLIC_ADDRS = ['login', 'gateway'];

if (typeof module !== 'undefined') {
  module.exports = { mulberry32, fnv1a, Net, LoginServer, SessionRegistry, Gateway, ZoneServer, Client, Intruder, run, PUBLIC_ADDRS };
}
