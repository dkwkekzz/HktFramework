// HktInfra step-0005 — 멀티 클라 + AOI 이벤트 브로드캐스트 (간단한 더미 서버)
// step-0004(현실 전송)까지의 박스 토폴로지(로그인→게이트웨이→존, 은닉·단일 연결) 위에 *한 조각*만 더한다:
//   존은 *시뮬레이션하지 않는다* — 엔터티 위치만 들고, 이벤트(이동)가 오면 그 엔터티를 갱신하고
//   **주변 클라(AOI 반경 안)에게만** 간단한 엔터티 정보 {id, x, y} 를 브로드캐스트한다(시각화용).
//   = 서버 동작(라우팅·관심영역 필터·수명주기·은닉)을 헤드리스로 테스트하기 위한 *최소 더미*.
//
// 의도적으로 뺀 것(0004 이전의 무거움): 결정론 VM(해시 사슬)·INPUT_DELAY 스케줄·클라 예측/롤백.
//   더미의 "월드"는 그냥 위치 맵이다 — C++ HktCore 결정론 VM 은 최후 교체의 일(SPINE §3).
//   남긴 것: 시드 의사난수만(Math.random 0) → 같은 시드 → 같은 브로드캐스트(라우팅 재현 가능).
//
// 척추(SPINE.md) 준수:
//   - 신성한 tick: 존 tick 안엔 위치 갱신 + AOI 브로드캐스트만(I/O·인증·트랜잭션 없음).
//   - 은닉·단일 연결: 클라는 게이트웨이만. 존→클라 뷰도 게이트웨이 경유. 내부 주소 비노출.
//   - 권위 단일 소유: 엔터티 쓰기 권위는 존 하나(클라는 읽기 전용 뷰만 받는다).
'use strict';
// engine 로드 — Node 면 require, 브라우저면 먼저 로드된 전역(HktEngine).
const __engine = (typeof module !== 'undefined' && module.exports && typeof require !== 'undefined')
  ? require('../engine/index.js')
  : globalThis.HktEngine;
const { Net, LoginServer, SessionRegistry, mulberry32, fnv1a } = __engine;

// ── [엣지] 게이트웨이 — 클라의 유일한 게임 연결점. 내부 토폴로지 은닉. 멀티 클라 라우팅 ──
class Gateway {
  constructor() {
    this.byClient = new Map();    // client addr -> {sessionId, avatar}
    this.bySession = new Map();   // sessionId  -> {client, avatar}
    this.dropped = 0;
    this.rejected = 0;
  }
  onMsg(m) {
    const p = m.payload;
    if (m.from === 'registry') {
      if (p.type === 'validate_ok') {
        const bind = { client: p.ref, sessionId: p.sessionId, avatar: p.avatar };
        this.byClient.set(p.ref, bind);
        this.bySession.set(p.sessionId, bind);
        this.net.send(this.addr, 'zone1', { type: 'enter', sessionId: p.sessionId, avatar: p.avatar });
        this.net.send(this.addr, p.ref, { type: 'connect_ok', avatar: p.avatar });
      } else if (p.type === 'validate_fail') {
        this.rejected++;
        this.net.send(this.addr, p.ref, { type: 'connect_fail' });
      }
      return;
    }
    if (m.from.startsWith('zone')) {
      if (p.type === 'view') {            // 존→클라 AOI 뷰 중계 (변형 없음)
        const bind = this.bySession.get(p.sessionId);
        if (bind) this.net.send(this.addr, bind.client, { type: 'view', entities: p.entities });
      }
      return;
    }
    if (p.type === 'connect') {
      if (this.byClient.has(m.from)) { this.rejected++; this.net.send(this.addr, m.from, { type: 'connect_fail' }); return; }
      this.net.send(this.addr, 'registry', { type: 'validate', ticket: p.ticket, ref: m.from });
    } else if (p.type === 'move') {
      const bind = this.byClient.get(m.from);
      if (bind) this.net.send(this.addr, 'zone1', { type: 'move', sessionId: bind.sessionId, avatar: bind.avatar, d: p.d });
      else this.dropped++;
    } else if (p.type === 'disconnect') {
      const bind = this.byClient.get(m.from);
      if (!bind) return;
      this.net.send(this.addr, 'zone1', { type: 'leave', sessionId: bind.sessionId, avatar: bind.avatar });
      this.net.send(this.addr, 'registry', { type: 'session_closed', sessionId: bind.sessionId });
      this.net.send(this.addr, m.from, { type: 'disconnect_ok' });
      this.byClient.delete(m.from);
      this.bySession.delete(bind.sessionId);
    }
  }
}

// ── [월드] 존 — 시뮬 없음. 엔터티 위치 맵 + AOI 브로드캐스트(이 step 의 한 조각) ──
//  GRID×GRID 격자. 이벤트(이동)는 위치만 갱신. 매 tick 각 세션에 *반경 R 안* 엔터티 정보만 보낸다(AOI 필터).
//  "적당히 주변 클라에게 브로드캐스트, 데이터는 시각화할 엔터티 정보({id,x,y})만" — 더미의 전부.
class EntityZone {
  constructor(seed, opts = {}) {
    this.rng = mulberry32((seed ^ 0x5A17) >>> 0);   // 시작 위치용 시드 PRNG (Math.random 금지)
    this.grid = opts.grid || 16;
    this.radius = opts.radius !== undefined ? opts.radius : 4;  // AOI 반경(체비쇼프)
    this.ents = new Map();        // avatar -> {x, y}
    this.sessions = new Map();    // sessionId -> {gateway, avatar}
    this.pending = [];            // 이번 tick 적용할 이동 이벤트
    this.sent = 0;                // 보낸 엔터티 정보 건수(대역폭 계측)
    this.fullSent = 0;            // AOI 없을 때(전체 브로드캐스트) 가정 건수 — 절감 비교용
  }
  onMsg(m) {
    const p = m.payload;
    if (p.type === 'enter') {
      this.sessions.set(p.sessionId, { gateway: m.from, avatar: p.avatar });
      this.ents.set(p.avatar, { x: this.rng() % this.grid, y: this.rng() % this.grid });
    } else if (p.type === 'move') {
      if (this.sessions.has(p.sessionId)) this.pending.push(p);  // tick 에 일괄 적용
    } else if (p.type === 'leave') {
      this.sessions.delete(p.sessionId);
      this.ents.delete(p.avatar);
    }
  }
  near(a, b) {   // 체비쇼프 거리 <= R ?
    return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y)) <= this.radius;
  }
  onTick() {
    // ① 이동 이벤트 적용 — 위치 갱신만(시뮬 아님)
    for (const p of this.pending) {
      const e = this.ents.get(p.avatar);
      if (e) { e.x = (e.x + p.d.dx + this.grid) % this.grid; e.y = (e.y + p.d.dy + this.grid) % this.grid; }
    }
    this.pending = [];
    // ② 각 세션에 AOI(반경 R) 안 엔터티 정보만 브로드캐스트
    for (const [sessionId, s] of this.sessions) {
      const me = this.ents.get(s.avatar);
      if (!me) continue;
      const visible = [];
      for (const [id, e] of this.ents) if (this.near(me, e)) visible.push({ id, x: e.x, y: e.y });
      this.sent += visible.length;
      this.fullSent += this.ents.size;   // AOI 없으면 전부 보냈을 것
      this.net.send(this.addr, s.gateway, { type: 'view', sessionId, entities: visible });
    }
  }
  // 그라운드 트루스 — verify 가 클라 수신과 대조(서버 동작 검증)
  aoiTruth(avatar) {
    const me = this.ents.get(avatar);
    if (!me) return null;
    const out = [];
    for (const [id, e] of this.ents) if (this.near(me, e)) out.push(id);
    return out.sort();
  }
}

// ── 클라이언트 — 아는 주소는 'login'·'gateway' 뿐. 받은 엔터티 정보를 seen 맵에 시각화 ──
class Client {
  constructor(script) {
    this.script = script;
    this.phase = 'idle';
    this.ticket = null;
    this.avatar = null;
    this.seen = new Map();    // id -> {x,y}  (마지막 AOI 뷰 = 시각화 대상)
    this.views = 0;
    this.events = [];
    this.sent = 0;
    this.rng = null;
  }
  onTick(S) {
    // 지정 tick 에 떠나기(수명주기 테스트용) — 떠나면 주변 AOI 에서 사라져야 한다.
    if (this.script.leaveTick != null && S >= this.script.leaveTick &&
        (this.phase === 'playing' || this.phase === 'settled')) {
      this.phase = 'disconnecting';
      this.net.send(this.addr, 'gateway', { type: 'disconnect' });
      return;
    }
    if (this.phase === 'idle') {
      this.phase = 'authing';
      this.net.send(this.addr, 'login', { type: 'auth', account: this.script.account });
    } else if (this.phase === 'playing') {
      if (this.sent < this.script.moves) {
        const dx = (this.rng() % 3) - 1, dy = (this.rng() % 3) - 1;
        this.net.send(this.addr, 'gateway', { type: 'move', d: { dx, dy } });
        this.sent++;
      } else {
        this.phase = 'settled';   // 이동 종료 후 *접속 유지*(위치 안정 → 뷰 수렴, AOI 대조 가능)
      }
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
      this.avatar = p.avatar;
      this.rng = mulberry32((this.script.seed ^ 0xC11E) >>> 0);
    } else if (p.type === 'connect_fail') {
      this.phase = 'rejected';
    } else if (p.type === 'view') {
      this.views++;
      this.seen = new Map(p.entities.map(e => [e.id, { x: e.x, y: e.y }]));  // 최신 AOI 스냅샷
    } else if (p.type === 'disconnect_ok') {
      this.phase = 'done';
    }
  }
  seenIds() { return [...this.seen.keys()].sort(); }
}

// ── 하니스 — 한 번의 세계 실행 (멀티 클라) ──────────────────────────────
// opts: { seed, ticks, clients(N), moves, radius, grid, transport }
function run(opts) {
  const {
    seed, ticks = 40, clients = 4, moves = 30, radius = 4, grid = 16, transport = null,
    leave = {},   // { clientIndex: leaveTick } — 지정 클라가 그 tick 에 떠난다(수명주기 테스트)
  } = opts;
  const accounts = [];
  for (let i = 0; i < clients; i++) accounts.push('hero' + i);

  const net = new Net({ transport, seed });
  const login = new LoginServer(accounts, seed);
  const registry = new SessionRegistry();
  const gateway = new Gateway();
  const zone = new EntityZone(seed, { radius, grid });
  net.register('login', login);
  net.register('registry', registry);
  net.register('gateway', gateway);
  net.register('zone1', zone);

  const clis = [];
  for (let i = 0; i < clients; i++) {
    // 각 클라 입력 시드를 분리(서로 다른 이동) — 시드 의사난수만
    const c = new Client({ account: accounts[i], seed: (seed + i * 0x9E37) >>> 0, moves, leaveTick: leave[i] != null ? leave[i] : null });
    net.register('client' + i, c);
    clis.push(c);
  }
  for (let i = 0; i < ticks; i++) net.step();
  return { net, login, registry, gateway, zone, clients: clis };
}

const PUBLIC_ADDRS = ['login', 'gateway'];

// ── 모듈 노출 (dual-mode: Node require + 브라우저 <script> 전역) ───────────
const __hktNet = {
  mulberry32, fnv1a, Net, LoginServer, SessionRegistry, Gateway, EntityZone, Client,
  run, PUBLIC_ADDRS,
};
if (typeof module !== 'undefined' && module.exports) module.exports = __hktNet;  // Node
if (typeof globalThis !== 'undefined') globalThis.HktNet = __hktNet;             // 브라우저: window.HktNet
