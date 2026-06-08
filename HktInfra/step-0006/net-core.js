// HktInfra step-0006 — 공간 분할 + 존 간 권위 핸드오프
// step-0005(단일 존 AOI 브로드캐스트) 위에 *한 조각*만 더한다:
//   월드를 존 2개로 나눈다(x 기준 분할). 경계 근방 엔터티는 양 존이 *상호 구독*(경계 띠 = ghost)하고,
//   엔터티가 경계를 넘으면 권위가 한 존에서 다른 존으로 **release+acquire 쌍 거래**로 이주한다.
//   — 소유자는 매 tick 정확히 1(공백도 이중쓰기도 없음, in-flight 토큰까지 보존). 클라의 AOI 는
//   존 경계를 넘어도 끊기지 않는다(은닉: 클라는 존이 둘·핸드오프가 일어남을 모른다).
//
// 0005 와의 관계: 존은 여전히 *시뮬하지 않는다* — 위치 맵 + AOI 필터가 전부. 더한 것은 (a) 분할 경계
//   (b) 경계 띠 상호 구독(ghost) (c) 경계 넘는 엔터티의 권위 핸드오프(토큰 보존 쌍 거래)뿐.
//   분할을 끄면(zones=1) 0005 와 *비트 동일*(reg 0) — 존 1개가 전 grid 를 소유, ghost·핸드오프 0.
//
// 척추(SPINE.md) 준수:
//   - 신성한 tick: 존 tick 안엔 위치 갱신 + 핸드오프 + AOI 브로드캐스트만(I/O·인증·트랜잭션 0).
//   - 권위 단일 소유: 엔터티 쓰기 권위는 *정확히 한 존*. 이주는 release(보내는 존이 떼고)+acquire(받는 존이 붙임)
//     쌍 거래 — 전송 중(in-flight)엔 토큰이 버스에 있고 어느 존도 안 쓴다(이중쓰기 0). 토큰 보존.
//   - 은닉·단일 연결: 클라는 게이트웨이만. 뷰는 *현재 소유 존*이 게이트웨이 경유로 보낸다(클라는 존 수·핸드오프 모름).
'use strict';
// engine 로드 — Node 면 require, 브라우저면 먼저 로드된 전역(HktEngine).
const __engine = (typeof module !== 'undefined' && module.exports && typeof require !== 'undefined')
  ? require('../engine/index.js')
  : globalThis.HktEngine;
const { Net, LoginServer, SessionRegistry, mulberry32, fnv1a } = __engine;

// ── [엣지] 게이트웨이 — 클라의 유일한 게임 연결점. 내부 토폴로지(존이 둘인 것·핸드오프) 은닉 ──
//  0005 와 거의 동일하나, 월드 입력(move/leave)을 *모든 존*에 브로드캐스트한다(소유 존만 적용).
//  → 라우팅 테이블·핸드오프 통지 없이도 항상 올바른 존이 적용 → 핸드오프 중 입력 유실 0(은닉 유지).
//  존이 1개면 브로드캐스트 = 단일 송신 → 0005 와 비트 동일.
class Gateway {
  constructor(zoneAddrs) {
    this.zones = zoneAddrs;          // 월드 입력을 흩뿌릴 존 주소들(엔트리 존 = zones[0])
    this.byClient = new Map();       // client addr -> {sessionId, avatar}
    this.bySession = new Map();      // sessionId  -> {client, avatar}
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
        this.net.send(this.addr, this.zones[0], { type: 'enter', sessionId: p.sessionId, avatar: p.avatar });
        this.net.send(this.addr, p.ref, { type: 'connect_ok', avatar: p.avatar });
      } else if (p.type === 'validate_fail') {
        this.rejected++;
        this.net.send(this.addr, p.ref, { type: 'connect_fail' });
      }
      return;
    }
    if (m.from.startsWith('zone')) {
      if (p.type === 'view') {            // 존→클라 AOI 뷰 중계 (변형 없음 — 어느 존이 보냈는지 클라는 모름)
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
      if (bind) for (const z of this.zones) this.net.send(this.addr, z, { type: 'move', sessionId: bind.sessionId, avatar: bind.avatar, d: p.d });
      else this.dropped++;
    } else if (p.type === 'disconnect') {
      const bind = this.byClient.get(m.from);
      if (!bind) return;
      for (const z of this.zones) this.net.send(this.addr, z, { type: 'leave', sessionId: bind.sessionId, avatar: bind.avatar });
      this.net.send(this.addr, 'registry', { type: 'session_closed', sessionId: bind.sessionId });
      this.net.send(this.addr, m.from, { type: 'disconnect_ok' });
      this.byClient.delete(m.from);
      this.bySession.delete(bind.sessionId);
    }
  }
}

// ── [월드] 분할 존 — 시뮬 없음. 위치 맵 + AOI + 경계 핸드오프(이 step 의 한 조각) ──
//  region [lo,hi) = 이 존이 *소유*하는 x 범위. sibling = 이웃 존 주소(없으면 분할 끔 = 0005 동작).
//  매 tick: ① 소유 엔터티 이동 적용 ② region 밖으로 나간 엔터티 핸드오프(release) ③ 경계 띠 owned 를
//    sibling 에 ghost 로 발행(상호 구독) ④ 소유 세션마다 AOI(owned + ghost) 뷰 브로드캐스트.
class EntityZone {
  constructor(seed, opts = {}) {
    this.rng = mulberry32((seed ^ 0x5A17) >>> 0);   // 시작 위치용 시드 PRNG (엔트리 존만 사용)
    this.grid = opts.grid || 16;
    this.radius = opts.radius !== undefined ? opts.radius : 4;  // AOI 반경(체비쇼프)
    const G = this.grid;
    this.region = opts.region || { lo: 0, hi: G };  // 소유 x 범위(분할 끔이면 전 grid)
    this.sibling = opts.sibling || null;            // 이웃 존 주소(없으면 단일 존 = 0005)
    this.boundary = opts.boundary !== undefined ? opts.boundary : G / 2;  // 내부 경계선 x
    const band = this.radius;                       // 경계 띠 폭 = AOI 반경(연속 보장)
    // 이 존이 sibling 에 ghost 로 발행할 띠: [경계-band, 경계) (hi=경계) 또는 [경계, 경계+band) (lo=경계)
    this.bandLo = (this.region.hi === this.boundary) ? this.boundary - band : this.boundary;
    this.bandHi = (this.region.hi === this.boundary) ? this.boundary : this.boundary + band;
    this.ents = new Map();        // avatar -> {x,y}   (이 존이 *소유*한 엔터티만 — 쓰기 권위)
    this.ghosts = new Map();      // avatar -> {x,y}   (sibling 경계 띠 구독 — 읽기 전용, 매 tick 갱신)
    this.sessions = new Map();    // sessionId -> {gateway, avatar}  (소유 아바타의 세션 — 이 존이 뷰 발행)
    this.pending = [];            // 이번 tick 적용할 이동 이벤트
    this.sent = 0;                // 보낸 엔터티 정보 건수(AOI 대역폭)
    this.views = 0;               // 보낸 뷰 메시지 수
    this.handoffsSent = 0;        // release 횟수
    this.handoffsAcquired = 0;    // acquire 횟수
    this.ghostMsgs = 0;           // 경계 구독 메시지 수
    this.ghostEntsSent = 0;       // 경계 구독으로 보낸 엔터티 건수(상호 구독 비용)
  }
  owns(x) { return x >= this.region.lo && x < this.region.hi; }
  inBand(x) { return x >= this.bandLo && x < this.bandHi; }
  near(a, b) { return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y)) <= this.radius; }  // 체비쇼프(비-wrap, 0005 동일)
  sessionOf(avatar) {            // 핸드오프 시 함께 옮길 세션 탐색
    for (const [sid, s] of this.sessions) if (s.avatar === avatar) return { id: sid, gateway: s.gateway };
    return null;
  }
  onMsg(m) {
    const p = m.payload;
    if (p.type === 'enter') {       // 엔트리 존(zone1)만 받는다 — 시작 위치 부여(시드 PRNG)
      this.sessions.set(p.sessionId, { gateway: m.from, avatar: p.avatar });
      this.ents.set(p.avatar, { x: this.rng() % this.grid, y: this.rng() % this.grid });
      // region 밖이면 다음 onTick 의 핸드오프 단계가 sibling 으로 이주시킨다(통일된 경로).
    } else if (p.type === 'move') {
      if (this.ents.has(p.avatar)) this.pending.push(p);  // *소유* 엔터티의 이동만 큐잉(비소유는 무시 → 이중적용 0)
    } else if (p.type === 'leave') {
      this.sessions.delete(p.sessionId);
      this.ents.delete(p.avatar);   // 소유 존만 실제로 지움(비소유는 no-op)
    } else if (p.type === 'handoff') {   // acquire — sibling 이 떼어 보낸 권위 토큰을 붙인다
      this.ents.set(p.avatar, { x: p.x, y: p.y });
      if (p.sessionId) this.sessions.set(p.sessionId, { gateway: p.gateway, avatar: p.avatar });
      this.handoffsAcquired++;
    } else if (p.type === 'ghosts') {    // 경계 띠 구독 갱신(sibling owned 의 경계 근방 스냅샷)
      this.ghosts = new Map(p.ents.map(e => [e.id, { x: e.x, y: e.y }]));
    }
  }
  onTick() {
    // ① 이동 이벤트 적용 — 소유 엔터티 위치 갱신만(시뮬 아님)
    for (const p of this.pending) {
      const e = this.ents.get(p.avatar);
      if (e) { e.x = (e.x + p.d.dx + this.grid) % this.grid; e.y = (e.y + p.d.dy + this.grid) % this.grid; }
    }
    this.pending = [];
    // ② 핸드오프(release) — region 밖으로 나간 소유 엔터티를 sibling 으로 이주(토큰을 떼어 메시지에 실어 보냄)
    if (this.sibling) {
      for (const [avatar, e] of [...this.ents]) {
        if (!this.owns(e.x)) {
          const s = this.sessionOf(avatar);
          this.net.send(this.addr, this.sibling, {
            type: 'handoff', avatar, x: e.x, y: e.y,
            sessionId: s ? s.id : null, gateway: s ? s.gateway : null,
          });
          this.ents.delete(avatar);            // release: 이 존은 더는 소유하지 않음(이중쓰기 0)
          if (s) this.sessions.delete(s.id);
          this.handoffsSent++;
        }
      }
    }
    // ③ 경계 띠 상호 구독 — owned 중 경계 근방을 sibling 에 ghost 로 발행(AOI 가 존 경계를 넘게)
    if (this.sibling) {
      const band = [];
      for (const [avatar, e] of this.ents) if (this.inBand(e.x)) band.push({ id: avatar, x: e.x, y: e.y });
      this.net.send(this.addr, this.sibling, { type: 'ghosts', ents: band });
      this.ghostMsgs++;
      this.ghostEntsSent += band.length;
    }
    // ④ 각 소유 세션에 AOI(반경 R) 안 엔터티 = owned + ghost 브로드캐스트(존 경계 ≠ AOI 경계)
    for (const [sessionId, s] of this.sessions) {
      const me = this.ents.get(s.avatar);
      if (!me) continue;
      const visible = [];
      for (const [id, e] of this.ents) if (this.near(me, e)) visible.push({ id, x: e.x, y: e.y });    // owned 먼저(0005 순서)
      for (const [id, e] of this.ghosts) if (this.near(me, e)) visible.push({ id, x: e.x, y: e.y });  // 그다음 ghost(분할 끔이면 비어 0005 동일)
      this.sent += visible.length;
      this.views++;
      this.net.send(this.addr, s.gateway, { type: 'view', sessionId, entities: visible });
    }
  }
}

// ── 클라이언트 — 0005 와 동일. 아는 주소는 'login'·'gateway' 뿐. 받은 엔터티를 seen 맵에 시각화 ──
//  존이 둘인 것·내 아바타가 핸드오프된 것을 *모른다* — 뷰는 게이트웨이에서 균일하게 온다.
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
        this.phase = 'settled';   // 이동 종료 후 접속 유지(위치 안정 → 뷰 수렴, AOI 대조 가능)
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
      this.seen = new Map(p.entities.map(e => [e.id, { x: e.x, y: e.y }]));
    } else if (p.type === 'disconnect_ok') {
      this.phase = 'done';
    }
  }
  seenIds() { return [...this.seen.keys()].sort(); }
}

// ── 하니스 — 한 번의 세계 실행 (멀티 클라 + 분할 존). 매 tick 권위 스냅샷을 trace 로 기록 ──
// opts: { seed, ticks, clients, moves, radius, grid, zones(1|2), leave, transport }
function run(opts) {
  const {
    seed, ticks = 40, clients = 4, moves = 30, radius = 4, grid = 16, zones = 2, transport = null,
    leave = {},
  } = opts;
  const accounts = [];
  for (let i = 0; i < clients; i++) accounts.push('hero' + i);

  const net = new Net({ transport, seed });
  const login = new LoginServer(accounts, seed);
  const registry = new SessionRegistry();
  const H = Math.floor(grid / 2);

  // 존 토폴로지: 1개면 전 grid 소유(0005), 2개면 [0,H)/[H,grid) 상호 구독
  const zoneObjs = [];
  const zoneAddrs = [];
  if (zones === 1) {
    zoneObjs.push(new EntityZone(seed, { grid, radius, region: { lo: 0, hi: grid }, sibling: null, boundary: grid }));
    zoneAddrs.push('zone1');
  } else {
    zoneObjs.push(new EntityZone(seed, { grid, radius, region: { lo: 0, hi: H }, sibling: 'zone2', boundary: H }));
    zoneObjs.push(new EntityZone(seed, { grid, radius, region: { lo: H, hi: grid }, sibling: 'zone1', boundary: H }));
    zoneAddrs.push('zone1', 'zone2');
  }

  const gateway = new Gateway(zoneAddrs);
  net.register('login', login);
  net.register('registry', registry);
  net.register('gateway', gateway);
  zoneObjs.forEach((z, i) => net.register(zoneAddrs[i], z));

  const clis = [];
  for (let i = 0; i < clients; i++) {
    const c = new Client({ account: accounts[i], seed: (seed + i * 0x9E37) >>> 0, moves, leaveTick: leave[i] != null ? leave[i] : null });
    net.register('client' + i, c);
    clis.push(c);
  }

  // 권위 trace — 매 tick 후 스냅샷(소유자 수 + in-flight 토큰). 핸드오프 보존 검증용.
  const trace = [];
  let fullAssumed = 0, prevViews = 0;
  for (let i = 0; i < ticks; i++) {
    net.step();
    const committed = new Map();   // avatar -> 소유 존 수(>1 이면 이중쓰기)
    for (const z of zoneObjs) for (const av of z.ents.keys()) committed.set(av, (committed.get(av) || 0) + 1);
    const inflight = scanInflightHandoffs(net);   // 버스에 떠 있는 권위 토큰(avatar 배열)
    const live = new Set([...committed.keys(), ...inflight]);
    trace.push({ tick: i + 1, committed, inflight, liveN: live.size });
    // AOI 절감 회계: 이 tick 보낸 뷰 × 월드 엔터티 수(= AOI 없으면 전부 보냈을 가정)
    const viewsNow = zoneObjs.reduce((a, z) => a + z.views, 0);
    fullAssumed += (viewsNow - prevViews) * live.size;
    prevViews = viewsNow;
  }
  const totals = {
    sent: zoneObjs.reduce((a, z) => a + z.sent, 0),
    views: zoneObjs.reduce((a, z) => a + z.views, 0),
    handoffs: zoneObjs.reduce((a, z) => a + z.handoffsSent, 0),
    ghostEnts: zoneObjs.reduce((a, z) => a + z.ghostEntsSent, 0),
    ghostMsgs: zoneObjs.reduce((a, z) => a + z.ghostMsgs, 0),
    fullAssumed,
  };
  return { net, login, registry, gateway, zones: zoneObjs, zoneAddrs, clients: clis, trace, totals, H, grid, radius };
}

// 버스(net.queue)에 아직 배달되지 않은 핸드오프 토큰을 센다 — in-flight = 권위가 "이주 중"(어느 존도 안 씀).
function scanInflightHandoffs(net) {
  const out = [];
  for (const msgs of net.queue.values())
    for (const m of msgs)
      if (m.payload && m.payload.type === 'handoff' && !net.delivered.has(m.id)) out.push(m.payload.avatar);
  return out;
}

// 그라운드 트루스 — *전 존 합산* 월드 위치에서 avatar 의 반경 R 이웃(존 경계 무시). 뷰 연속성 검증용.
function globalAoiTruth(r, avatar) {
  let me = null;
  for (const z of r.zones) if (z.ents.has(avatar)) { me = z.ents.get(avatar); break; }
  if (!me) return null;
  const R = r.radius;
  const out = [];
  for (const z of r.zones) for (const [id, e] of z.ents)
    if (Math.max(Math.abs(me.x - e.x), Math.abs(me.y - e.y)) <= R) out.push(id);
  return out.sort();
}

// 어느 존이 이 avatar 를 소유하는가(없으면 null = in-flight 또는 미존재)
function ownerOf(r, avatar) {
  for (let i = 0; i < r.zones.length; i++) if (r.zones[i].ents.has(avatar)) return r.zoneAddrs[i];
  return null;
}

const PUBLIC_ADDRS = ['login', 'gateway'];

// ── 모듈 노출 (dual-mode: Node require + 브라우저 <script> 전역) ───────────
const __hktNet = {
  mulberry32, fnv1a, Net, LoginServer, SessionRegistry, Gateway, EntityZone, Client,
  run, scanInflightHandoffs, globalAoiTruth, ownerOf, PUBLIC_ADDRS,
};
if (typeof module !== 'undefined' && module.exports) module.exports = __hktNet;  // Node
if (typeof globalThis !== 'undefined') globalThis.HktNet = __hktNet;             // 브라우저: window.HktNet
