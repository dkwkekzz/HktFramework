// HktInfra step-0003 — Sim 인터페이스 동결 + 더미 서버 공식화
// step-0002 골격(권위 존 + 추종자 존 + 게이트웨이 입력-미러)을 잇고 *한 조각*만 더한다:
//   존 시뮬을 "구현"이 아니라 "계약(인터페이스)"으로 박고, 오늘의 VM 스텁을 그 계약의 *첫 구현*(더미)으로 공식 승격.
//
// 핵심 전환(STATE §2 · TOOLS §4): 실 C++ 시뮬을 *먼저* 지으면 원격 빌드·검증 루프가 끊긴다.
//   그래서 순서를 뒤집는다 — 시뮬은 인터페이스만 동결하고, 그 뒤에 더미 서버를 세운다.
//   인프라(엣지·코디·존 호스트·복제 탭)는 더미 뒤에서 전부 원격 E2E 로 서고,
//   나중에 더미를 *얇은 C++ 호스트로 교체만* 한다(인터페이스 동일 → 인프라 무수정).
//
// 이 step 이 박는 불변:
//   ① 호스트(인프라)는 구체 시뮬 클래스 이름을 모른다 — 오직 동결된 ISimCore 계약으로만 대화.
//   ② 교체 지점은 단일 seam — run(opts).makeSim 팩토리 하나. 이것만 바꾸면 구현이 갈린다.
//   ③ 같은 계약을 만족하는 *다른 표현*(객체맵 vs 병렬배열=C++ SoA 스탠드인)은 비트 동일 골든에 도달.
//      → 인터페이스가 표현을 누설하지 않음을 증명. C++ 교체가 의존할 바로 그 성질.
//
// 척추(SPINE.md) 준수:
//   - 신성한 tick: Sim.tick 안엔 시뮬만(intent 적용 + VM 전진). I/O·인증·팬아웃 0.
//   - 결정론 코어: 세계 쓰기 경로는 여전히 intent→Sim 하나. 같은 seed+호출열 → 같은 serialize.
//   - 권위 단일 소유: 소유자 장부는 *호스트*(인프라)에 산다 — 시뮬 밖. 권위=자신, 추종자=권위 존.
//   - 은닉·단일 연결: 클라는 게이트웨이만. 추종자('zone1f')는 내부. (0002 그대로)
//
// 회귀 0(불변): 인터페이스 추출은 동작 비-침습 — 더미 구현은 step-0002 계산을 *그대로* 옮긴 것이라
//             골든 해시·사슬이 비트 동일. replicate off=골든, on=권위 비-침습(0002 §3).
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

// ── [엣지] 게이트웨이 — 클라의 유일한 게임 연결점. 내부 토폴로지를 은닉한다 (0002 그대로) ──
// 입력-미러 탭: 권위 존으로 가는 입력열(enter/intent/leave)을 같은 tick 에 추종자 존(들)에 그대로 복사.
// ※ 게이트웨이는 구체 시뮬 구현을 모른다 — 존 *주소*로만 말한다(은닉·단일 연결).
class Gateway {
  constructor() {
    this.byClient = new Map();
    this.bySession = new Map();
    this.dropped = 0;
    this.rejected = 0;
    this.replicas = [];   // 추종자 존 주소들 — 입력 스트림 미러 대상 (off = [])
  }
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
        this.mirror(enter);
        this.net.send(this.addr, p.ref, { type: 'connect_ok' });
      } else if (p.type === 'validate_fail') {
        this.rejected++;
        this.net.send(this.addr, p.ref, { type: 'connect_fail' });
      }
      return;
    }
    if (m.from.startsWith('zone')) {
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
        this.mirror(intent);
      } else this.dropped++;
    } else if (p.type === 'disconnect') {
      const bind = this.byClient.get(m.from);
      if (!bind) return;
      const leave = { type: 'leave', sessionId: bind.sessionId, avatar: bind.avatar };
      this.net.send(this.addr, bind.zone, leave);
      this.mirror(leave);
      this.net.send(this.addr, 'registry', { type: 'session_closed', sessionId: bind.sessionId });
      this.net.send(this.addr, m.from, { type: 'disconnect_ok' });
      this.byClient.delete(m.from);
      this.bySession.delete(bind.sessionId);
    }
  }
}

// ════════════════════════════════════════════════════════════════════════
//  Sim 인터페이스 (동결 계약, step-0003) — 존 시뮬이 만족해야 할 단일 계약 v1
// ════════════════════════════════════════════════════════════════════════
//  존 시뮬은 *이 계약 뒤에* 산다. 호스트(인프라)는 오직 이 메서드들로만 시뮬과 대화한다.
//  더미(오늘·Node)와 (후일) C++ HktCore 가 같은 계약을 구현 — 교체는 단일 seam(run.makeSim).
//
//  new Sim(seed)            결정론적 초기화. seed 외 입력 금지(Math.random 금지).
//  spawn(avatar)            enter 수명주기 — 결정론적 초기 상태 할당(seed 의사난수).
//  despawn(avatar)          leave 수명주기.
//  tick(intents) -> applied intents=[{avatar,intent:{dx,dy}}] 를 도착 순서대로 적용 후 1 tick 전진.
//                           반환: 살아있는 엔티티에 적용된 intent 수(인프라 계측용).
//  liveIds() -> [avatar]    살아있는 엔티티 id, 결정론적 순서(스폰 순서). 권위 장부·뷰 직렬화에 사용.
//  serialize() -> string    정규 상태 문자열(해시 입력). 표현 무관 — 같은 (seed+호출열) → 같은 문자열.
//
//  불변(동결): 같은 seed + 같은 (spawn/despawn/tick) 호출열 → 같은 serialize() (구현·표현 무관).
//  이 불변이 곧 "복제=재현"(SPINE §4)과 더미↔C++ 교체 안전성의 토대다.
//
//  계약 자체는 verify.js 의 `conf`(conformance) 모드가 실행 가능한 명세로 검증한다.
const SIM_CONTRACT_VERSION = 'v1';

// ── ISimCore 구현 #1: DummySimCore (객체맵 표현) — 인터페이스의 *첫 구현*(공식) ──
// step-0002 ZoneServer 의 VM 스텁 계산을 *그대로* 옮긴 것 → 골든 비트 동일(회귀 0).
// throwaway 아님 — 동결된 계약의 첫 정식 구현. C++ 는 같은 계약의 *정교화 구현*.
class DummySimCore {
  constructor(seed) {
    this.rng = mulberry32((seed ^ 0x5A17) >>> 0);
    this.t = 0;
    this.counter = 0;
    this.map = {};          // avatar -> {x,y,hp}  (객체맵 표현 — 이 표현은 인터페이스 밖, 사적)
    this.order = [];        // 스폰 순서
  }
  spawn(avatar) {
    this.map[avatar] = { x: this.rng() % 16, y: this.rng() % 16, hp: 100 };
    this.order.push(avatar);
  }
  despawn(avatar) {
    delete this.map[avatar];
    this.order = this.order.filter(a => a !== avatar);
  }
  tick(intents) {
    // ① intent 적용 — 도착 순서 그대로(결정론)
    let applied = 0;
    for (const p of intents) {
      const e = this.map[p.avatar];
      if (e) {
        e.x = (e.x + p.intent.dx + 16) % 16;
        e.y = (e.y + p.intent.dy + 16) % 16;
        applied++;
      }
    }
    // ② VM 전진 — 정수 연산만(비트 결정론)
    this.t++;
    let mix = this.counter | 0;
    for (const a of this.order) {
      const e = this.map[a];
      mix = (Math.imul(mix, 1664525) + 1013904223 + e.x * 31 + e.y) | 0;
    }
    this.counter = ((Math.imul(mix, 1664525) + 1013904223) | 0) >>> 0;
    return applied;
  }
  liveIds() { return this.order.slice(); }
  serialize() {
    const body = this.order
      .map(a => { const e = this.map[a]; return a + ':' + e.x + ',' + e.y + ',' + e.hp; })
      .join('|');
    return 't=' + this.t + ';c=' + this.counter + ';' + body;
  }
}
DummySimCore.simId = 'dummy-objmap-' + SIM_CONTRACT_VERSION;

// ── ISimCore 구현 #2: ArraySimCore (병렬 배열 = SoA 표현) — *C++ 스탠드인* ──
// 같은 계약, 전혀 다른 내부 표현(struct-of-arrays — C++ HktCore 가 TArray 로 짤 그 모양).
// 객체맵이 아니라 ids/xs/ys/hps 병렬 배열. 코드 경로는 다르지만 산술·순서·직렬화는 계약대로 → 골든 비트 동일.
// 역할: "인터페이스가 표현을 누설하지 않음 → 더미를 (메모리 레이아웃이 다른) C++ 로 갈아끼워도 인프라 무수정"을
//       *프로토타입 안에서* 미리 증명하는 두 번째 구현. 교체는 run.makeSim 단일 seam 만 바꾼다.
class ArraySimCore {
  constructor(seed) {
    this.rng = mulberry32((seed ^ 0x5A17) >>> 0);
    this.t = 0;
    this.counter = 0;
    this.ids = [];          // 병렬 배열 (SoA) — 사적 표현
    this.xs = [];
    this.ys = [];
    this.hps = [];
  }
  spawn(avatar) {
    this.ids.push(avatar);
    this.xs.push(this.rng() % 16);   // x 먼저 — 더미의 객체리터럴 평가 순서(x→y)와 동일
    this.ys.push(this.rng() % 16);   // y 다음 — rng 호출 순서 일치가 동일 초기상태의 필요조건
    this.hps.push(100);
  }
  despawn(avatar) {
    const i = this.ids.indexOf(avatar);
    if (i >= 0) { this.ids.splice(i, 1); this.xs.splice(i, 1); this.ys.splice(i, 1); this.hps.splice(i, 1); }
  }
  tick(intents) {
    let applied = 0;
    for (const p of intents) {
      const i = this.ids.indexOf(p.avatar);
      if (i >= 0) {
        this.xs[i] = (this.xs[i] + p.intent.dx + 16) % 16;
        this.ys[i] = (this.ys[i] + p.intent.dy + 16) % 16;
        applied++;
      }
    }
    this.t++;
    let mix = this.counter | 0;
    for (let i = 0; i < this.ids.length; i++) {
      mix = (Math.imul(mix, 1664525) + 1013904223 + this.xs[i] * 31 + this.ys[i]) | 0;
    }
    this.counter = ((Math.imul(mix, 1664525) + 1013904223) | 0) >>> 0;
    return applied;
  }
  liveIds() { return this.ids.slice(); }
  serialize() {
    let body = '';
    for (let i = 0; i < this.ids.length; i++) {
      if (i) body += '|';
      body += this.ids[i] + ':' + this.xs[i] + ',' + this.ys[i] + ',' + this.hps[i];
    }
    return 't=' + this.t + ';c=' + this.counter + ';' + body;
  }
}
ArraySimCore.simId = 'array-soa-' + SIM_CONTRACT_VERSION;

// 단일 교체 seam — 구체 시뮬을 이름으로 아는 *유일한* 곳. 인프라(아래)는 이 표를 모른다.
const SIM_FACTORIES = {
  dummy: (seed) => new DummySimCore(seed),
  array: (seed) => new ArraySimCore(seed),
};
const DEFAULT_MAKE_SIM = SIM_FACTORIES.dummy;

// ── [월드] 존 호스트 (인프라) — 시뮬을 *계약으로만* 안다 ──────────────────
// step-0002 ZoneServer 에서 *시뮬 계산*을 ISimCore 뒤로 빼낸 나머지: 메시징·세션·소유자 장부·역할·뷰·해시.
// 이 클래스는 구체 시뮬 클래스 이름을 **한 번도** 적지 않는다(주입된 makeSim 으로만 생성) — 단일 seam 의 보강.
// role: 'authority' | 'follower'. 추종자는 권위 0 — 뷰 발행 안 함, 소유자 장부에 권위 존 기록.
class ZoneHost {
  constructor(seed, makeSim, opts = {}) {
    this.sim = makeSim(seed);        // ← 유일한 시뮬 결합점은 주입된 팩토리. 구체 타입을 모른다.
    this.sessions = new Map();
    this.owners = new Map();          // avatar -> 권위 소유자 주소 (인프라 — 시뮬 밖)
    this.pendingIntents = [];
    this.enterCount = 0;
    this.applied = 0;
    this.ownerViolations = 0;
    this.hashes = [];
    this.role = opts.role || 'authority';
    this.authorityAddr = opts.authorityAddr;
    this.authClaims = 0;
  }
  ownerFor() { return this.role === 'follower' ? this.authorityAddr : this.addr; }
  onMsg(m) {
    const p = m.payload;
    if (p.type === 'enter') {
      this.enterCount++;
      this.sessions.set(p.sessionId, { gateway: m.from, avatar: p.avatar });
      this.sim.spawn(p.avatar);                    // 수명주기 → 계약
      this.owners.set(p.avatar, this.ownerFor());  // 권위 장부 → 인프라
    } else if (p.type === 'intent') {
      if (this.sessions.has(p.sessionId)) this.pendingIntents.push(p);
    } else if (p.type === 'leave') {
      this.sessions.delete(p.sessionId);
      this.sim.despawn(p.avatar);                  // 수명주기 → 계약
      this.owners.delete(p.avatar);
    }
  }
  onTick() {
    // ① intent 적용 + VM 전진 — 전부 계약 뒤. 호스트는 적용 수만 받는다.
    this.applied += this.sim.tick(this.pendingIntents);
    this.pendingIntents = [];
    // ② 권위 장부 검사 (인프라) — 살아있는 엔티티의 소유자 = ownerFor(), 정확히 1. 추종자 자기권위 = 0.
    const ents = this.sim.liveIds();
    const expect = this.ownerFor();
    const ok = ents.length === this.owners.size && ents.every(a => this.owners.get(a) === expect);
    if (!ok) this.ownerViolations++;
    this.authClaims = ents.filter(a => this.owners.get(a) === this.addr).length;
    // ③ 해시 (+ 뷰 발행 — 권위만. 추종자는 읽기 전용 재현이라 발행 안 함)
    this.hashes.push(this.hash());
    if (this.role !== 'follower') {
      for (const [sessionId, s] of this.sessions) {
        this.net.send(this.addr, s.gateway, { type: 'view', sessionId, t: this.hashes.length, view: this.serialize() });
      }
    }
  }
  serialize() { return this.sim.serialize(); }   // 계약 경유 — 호스트는 표현을 모른다
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

// ── 침입자 — 본 클라의 티켓을 훔쳐 재사용 시도 (일회성 티켓 자극) ──────────
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
// opts.makeSim: ISimCore 팩토리 (default = 더미). ★ 더미↔C++(여기선 array) 교체의 *단일 seam*.
//               인프라(Gateway/ZoneHost/...) 는 이 인자만으로 구현이 갈린다 — 코드 무수정.
// opts.replicate: true 면 추종자 존('zone1f')을 *같은 makeSim* 으로 세우고 게이트웨이가 입력열을 미러.
function run(opts) {
  const { seed, ticks = 60, scenario = {}, replicate = false, makeSim = DEFAULT_MAKE_SIM } = opts;
  const net = new Net();
  const login = new LoginServer(['hero'], seed);
  const registry = new SessionRegistry();
  const gateway = new Gateway();
  const zone = new ZoneHost(seed, makeSim); // 권위
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
  let follower = null;
  if (replicate) {
    follower = new ZoneHost(seed, makeSim, { role: 'follower', authorityAddr: 'zone1' }); // 같은 시드·같은 구현
    net.register('zone1f', follower);          // 내부 주소 — 클라는 모른다(은닉)
    gateway.replicas.push('zone1f');           // 게이트웨이가 입력열을 그대로 복사
  }
  for (let i = 0; i < ticks; i++) net.step();
  return {
    net, login, registry, gateway, zone, follower, client, intruder,
    simId: zone.sim.constructor.simId,
    hash: zone.hash(),
    chain: zone.chain(),
    state: zone.serialize(),
    fhash: follower ? follower.hash() : null,
    fchain: follower ? follower.chain() : null,
    fstate: follower ? follower.serialize() : null,
  };
}

const PUBLIC_ADDRS = ['login', 'gateway'];
// 인프라 클래스 — verify 의 `swap` 모드가 "이 중 누구도 구체 시뮬 클래스를 이름으로 모름"을 구조적으로 검사.
const INFRA_CLASSES = { Net, LoginServer, SessionRegistry, Gateway, ZoneHost, Client, Intruder };
const CONCRETE_SIM_NAMES = ['DummySimCore', 'ArraySimCore'];

if (typeof module !== 'undefined') {
  module.exports = {
    mulberry32, fnv1a, Net, LoginServer, SessionRegistry, Gateway,
    DummySimCore, ArraySimCore, ZoneHost, Client, Intruder,
    SIM_FACTORIES, DEFAULT_MAKE_SIM, SIM_CONTRACT_VERSION,
    INFRA_CLASSES, CONCRETE_SIM_NAMES, run, PUBLIC_ADDRS,
  };
}
