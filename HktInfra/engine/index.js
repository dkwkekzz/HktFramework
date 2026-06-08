// HktInfra engine/ — 공통 하니스 (STATE §2 'engine 추출 트리거' 발동)
// 0001~0003 의 net-core.js 가 ~80% 중복(시드 PRNG·FNV·Net·엣지/코디 스텁·동결 Sim)을 반복했다.
// 이 파일이 그 중복을 *한 곳*으로 모은다 — 매 step 의 net-core.js 는 이 위에 *새 프로토콜만* 더한다.
//
// 담는 것(안정·재사용):
//   - mulberry32(시드 PRNG) · fnv1a(해시)            ← 결정론 도구 (전 step 동일)
//   - Net(전송 substrate)                            ← step-0004 가 *전송 모델*을 여기에 더했다(아래)
//   - LoginServer · SessionRegistry (엣지·코디 스텁)   ← 0001 이후 불변
//   - ISimCore v1 동결 계약 구현(DummySimCore·ArraySimCore) ← 0003 동결, 무수정 이전
//
// step-0004 가 Net 에 더한 한 조각: **전송 모델(지연·손실·재정렬 + 중복-송신 신뢰성)**.
//   transport=null 이면 0001~0003 의 *무손실·즉시·FIFO* 와 비트 동일(회귀 0의 토대).
//   transport 가 켜지면, 지정된 라우트의 메시지에 지연·손실·재정렬을 입힌다(결정론적·시드 기반).
//   ※ 이 파일은 '전송이 무엇을 하는가'만 안다 — '논리 tick 스케줄링'(타이밍↔내용 분리)은 net-core 의 ZoneHost.
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

// ════════════════════════════════════════════════════════════════════════
//  Net — 메시지 전송 substrate (step-0004: 전송 모델 추가)
// ════════════════════════════════════════════════════════════════════════
//  transport=null  → 무손실·즉시: tick T 발신 → T+1 배달, FIFO (0001~0003 그대로).
//  transport={...} → 지정 라우트(routeFilter)의 메시지에:
//     · 지연 d ∈ [delayMin, delayMax]      (시드 PRNG)
//     · 손실: 각 송신 사본을 loss 확률로 드롭 (시드 PRNG)
//     · 신뢰성: redundancy 사본을 연속 tick(t..t+R-1)에 중복 송신 — 수신측은 msgId 로 *최초 도착*만 채택(dedup)
//     · 재정렬: 가변 지연의 부수효과로 자연 발생
//  결정론: 모든 난수 추출은 단일 transport PRNG(시드(seed^transport.seed))에서 *고정 순서*(send 호출 순서)로.
//          → 같은 (seed, transport) → 같은 타이밍. "타이밍은 토폴로지의 함수, 내용만 시드의 함수"의 토대.
//  ★ 전송은 *라우트 선택적*: 기본 필터는 게이트웨이→존(들)의 월드 입력(enter/intent/leave)만.
//     제어 평면(인증·세션·뷰)과 클라→게이트웨이 홉은 행복 경로 유지 — 실험을 복제 팬아웃에 격리한다.
class Net {
  constructor(opts = {}) {
    this.actors = new Map();
    this.order = [];          // onTick 호출 순서 = 등록 순서 (결정론)
    this.log = [];
    this.tick = 0;
    this.seq = 0;
    this.transport = opts.transport || null;
    this.queue = new Map();    // deliverTick -> [msg]  (전송 모델에서 지연 배달)
    this.delivered = new Set(); // msgId dedup (중복 송신 사본 1회만 배달)
    this.trng = this.transport
      ? mulberry32(((opts.seed || 0) ^ (this.transport.seed || 0) ^ 0x7A11C0DE) >>> 0)
      : null;
    // 계측 (전송 열화 곡선용)
    this.stats = { sent: 0, copies: 0, lost: 0, deliveredN: 0, dupSkipped: 0, maxDelay: 0 };
  }
  register(addr, actor) {
    this.actors.set(addr, actor);
    this.order.push(actor);
    actor.addr = addr;
    actor.net = this;
  }
  // 전송 모델을 입힐 라우트인가? 기본: 게이트웨이→존(들)의 월드 입력만(복제 팬아웃에 격리).
  _transported(m) {
    if (!this.transport) return false;
    const f = this.transport.routeFilter;
    if (f) return f(m);
    const p = m.payload;
    return m.from === 'gateway' && /^zone/.test(m.to) &&
      (p.type === 'enter' || p.type === 'intent' || p.type === 'leave');
  }
  _enqueue(t, m) {
    if (!this.queue.has(t)) this.queue.set(t, []);
    this.queue.get(t).push(m);
  }
  send(from, to, payload) {
    const id = this.seq++;
    const m = { tick: this.tick, seq: id, id, from, to, payload };
    this.log.push(m);
    this.stats.sent++;
    if (!this._transported(m)) {
      this._enqueue(this.tick + 1, m);   // 행복 경로 — 다음 tick FIFO 배달
      return;
    }
    // 전송 경로 — redundancy 중복 송신, 각 사본 독립 지연·손실
    const T = this.transport;
    const R = T.redundancy || 1;
    for (let c = 0; c < R; c++) {
      const sendTick = this.tick + c;     // 연속 tick 에 재송신
      const span = T.delayMax - T.delayMin;
      const d = T.delayMin + (span > 0 ? (this.trng() % (span + 1)) : 0);
      const lost = (this.trng() % 1000) < Math.floor((T.loss || 0) * 1000);  // 추출 순서 고정(분기 무관)
      this.stats.copies++;
      if (lost) { this.stats.lost++; continue; }
      this._enqueue(sendTick + 1 + d, m); // 배달 tick = 송신 + 1 + 지연
    }
  }
  step() {
    this.tick++;
    const due = this.queue.get(this.tick) || [];
    this.queue.delete(this.tick);
    for (const m of due) {
      if (this.delivered.has(m.id)) { this.stats.dupSkipped++; continue; } // 중복 사본 — 최초만 채택
      this.delivered.add(m.id);
      const delay = this.tick - m.tick - 1;
      if (delay > this.stats.maxDelay) this.stats.maxDelay = delay;
      this.stats.deliveredN++;
      const a = this.actors.get(m.to);
      if (a && a.onMsg) a.onMsg(m);
    }
    for (const a of this.order) if (a.onTick) a.onTick(this.tick);
  }
}

// ── [엣지] 로그인/인증 서버 (스텁) — 0001 이후 불변 ───────────────────────
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

// ── [코디네이션] 세션 레지스트리 (스텁) — "누가 어디에"의 SSOT — 0001 이후 불변 ──
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

// ════════════════════════════════════════════════════════════════════════
//  ISimCore v1 — 동결 계약 (step-0003 동결, 무수정 이전). 상세 계약은 step-0003.md §2.
// ════════════════════════════════════════════════════════════════════════
//  new Sim(seed) · spawn(avatar) · despawn(avatar) · tick(intents)->applied · liveIds()->[] · serialize()->str
//  불변: 같은 seed + 같은 호출열 → 같은 serialize() (구현·표현 무관). 복제=재현·C++ 최후교체의 토대.
const SIM_CONTRACT_VERSION = 'v1';

// 구현 #1: DummySimCore (객체맵 표현) — 동결 계약의 첫 정식 구현.
class DummySimCore {
  constructor(seed) {
    this.rng = mulberry32((seed ^ 0x5A17) >>> 0);
    this.t = 0;
    this.counter = 0;
    this.map = {};
    this.order = [];
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
    let applied = 0;
    for (const p of intents) {
      const e = this.map[p.avatar];
      if (e) {
        e.x = (e.x + p.intent.dx + 16) % 16;
        e.y = (e.y + p.intent.dy + 16) % 16;
        applied++;
      }
    }
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

// 구현 #2: ArraySimCore (병렬 배열 = SoA 표현) — C++ HktCore 스탠드인.
class ArraySimCore {
  constructor(seed) {
    this.rng = mulberry32((seed ^ 0x5A17) >>> 0);
    this.t = 0;
    this.counter = 0;
    this.ids = [];
    this.xs = [];
    this.ys = [];
    this.hps = [];
  }
  spawn(avatar) {
    this.ids.push(avatar);
    this.xs.push(this.rng() % 16);   // x 먼저 — 더미의 객체리터럴 평가 순서(x→y)와 동일
    this.ys.push(this.rng() % 16);
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

// 단일 교체 seam — 구체 시뮬을 이름으로 아는 *유일한* 곳(0003). 인프라(net-core)는 이 표를 모른다.
const SIM_FACTORIES = {
  dummy: (seed) => new DummySimCore(seed),
  array: (seed) => new ArraySimCore(seed),
};
const DEFAULT_MAKE_SIM = SIM_FACTORIES.dummy;
const CONCRETE_SIM_NAMES = ['DummySimCore', 'ArraySimCore'];

// ── 모듈 노출 (dual-mode: Node require + 브라우저 <script> 전역) ───────────
// 헤드리스 검증(Node)과 시각 관찰 셸(브라우저)이 *같은 코어*를 쓴다 — UE-free 불변을 관찰 도구까지 확장.
const __hktEngine = {
  mulberry32, fnv1a, Net, LoginServer, SessionRegistry,
  DummySimCore, ArraySimCore, SIM_FACTORIES, DEFAULT_MAKE_SIM,
  SIM_CONTRACT_VERSION, CONCRETE_SIM_NAMES,
};
if (typeof module !== 'undefined' && module.exports) module.exports = __hktEngine;  // Node: require('../engine')
if (typeof globalThis !== 'undefined') globalThis.HktEngine = __hktEngine;          // 브라우저: <script> 후 window.HktEngine
