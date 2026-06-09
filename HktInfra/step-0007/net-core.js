// HktInfra step-0007 — 증분 AOI (관심영역 구독: 전체 스냅샷 → enter/exit/update 증분)
// step-0006(공간 분할 + 경계 핸드오프 + 경계 띠 ghost) 위에 *한 조각*만 더한다:
//   존이 매 tick 각 세션에 *반경 안 엔터티 전부*(전체 스냅샷)를 보내던 것을 — 직전 가시 집합 대비
//   **새로 들어온 것(enter)·나간 것(exit)·움직인 것(update)** 만 보내는 *증분*으로 바꾼다. 클라는
//   증분을 *누적 적용*해 가시 집합을 재구성한다. 대역폭이 밀도가 아니라 *변화량*에 비례 — 정지하면 0.
//
// 0006 와의 관계: 존은 여전히 *시뮬하지 않는다*(위치 맵 + AOI). 분할·핸드오프·경계 띠 ghost 도 그대로.
//   바뀐 것은 ④ 뷰 발행 *한 단계*뿐 — 전체 스냅샷(view) → 증분(view_delta). 증분을 끄면(incremental=false)
//   0006 의 view 를 *비트 동일*하게 보낸다(reg 0) — 증분 코드 경로를 안 타므로 net.log·상태 동일.
//
// 핵심 설계 — 세션 이주 시 reset(키프레임):
//   증분은 *직전 가시 집합*(prevSeen)에 의존한다. 새 세션(enter)·핸드오프로 *막 인수한* 세션은 prevSeen 이
//   없으므로 *첫 증분 = reset*(클라 seen 비우고 현재 가시 전부 enter)을 보낸다. 키프레임→델타의 표준 패턴.
//   → 세션이 존을 넘어 이주해도(권위 핸드오프) 새 소유 존이 첫 tick 에 full 재동기 → 클라 seen 에 stale 0.
//
// 척추(SPINE.md) 준수:
//   - 신성한 tick: 존 tick 안엔 위치 갱신 + 핸드오프 + ghost 발행 + AOI 증분 브로드캐스트만(I/O·인증 0).
//   - 권위 단일 소유: 0006 그대로 — 증분은 *뷰 인코딩*만 바꾼다(쓰기 권위 불변).
//   - 은닉·단일 연결: 클라는 게이트웨이만. view_delta 도 sessionId 없이 중계(클라는 존·핸드오프·세션 모름).
'use strict';
// engine 로드 — Node 면 require, 브라우저면 먼저 로드된 전역(HktEngine).
const __engine = (typeof module !== 'undefined' && module.exports && typeof require !== 'undefined')
  ? require('../engine/index.js')
  : globalThis.HktEngine;
const { Net, LoginServer, SessionRegistry, mulberry32, fnv1a } = __engine;

// ── [엣지] 게이트웨이 — 클라의 유일한 게임 연결점. 내부 토폴로지(존 둘·핸드오프·세션) 은닉 ──
//  0006 과 동일하나, 존→클라 뷰 중계가 view(전체) *또는* view_delta(증분) 둘 다를 다룬다(sessionId 박리).
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
      if (p.type === 'view') {            // 존→클라 전체 스냅샷 중계(변형 없음 — 어느 존이 보냈는지 클라는 모름)
        const bind = this.bySession.get(p.sessionId);
        if (bind) this.net.send(this.addr, bind.client, { type: 'view', entities: p.entities });
      } else if (p.type === 'view_delta') {  // 존→클라 증분 중계(sessionId 박리 — 클라는 세션 모름)
        const bind = this.bySession.get(p.sessionId);
        if (bind) this.net.send(this.addr, bind.client, { type: 'view_delta', reset: p.reset, enter: p.enter, exit: p.exit, update: p.update });
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

// ── [월드] 분할 존 — 시뮬 없음. 위치 맵 + AOI + 경계 핸드오프 + *증분 AOI*(이 step 의 한 조각) ──
//  0006 과 ①~③(이동·핸드오프·ghost)·구조 동일. ④ 뷰 발행만 전체 스냅샷 → 증분으로 바꾼다.
class EntityZone {
  constructor(seed, opts = {}) {
    this.rng = mulberry32((seed ^ 0x5A17) >>> 0);   // 시작 위치용 시드 PRNG (엔트리 존만 사용)
    this.grid = opts.grid || 16;
    this.radius = opts.radius !== undefined ? opts.radius : 4;  // AOI 반경(체비쇼프)
    this.incremental = opts.incremental !== false;  // 이 step 의 토글 — false 면 0006(전체 스냅샷) 비트 동일
    const G = this.grid;
    this.region = opts.region || { lo: 0, hi: G };  // 소유 x 범위(분할 끔이면 전 grid)
    this.sibling = opts.sibling || null;            // 이웃 존 주소(없으면 단일 존 = 0005)
    this.boundary = opts.boundary !== undefined ? opts.boundary : G / 2;  // 내부 경계선 x
    const band = this.radius;                       // 경계 띠 폭 = AOI 반경(연속 보장)
    this.bandLo = (this.region.hi === this.boundary) ? this.boundary - band : this.boundary;
    this.bandHi = (this.region.hi === this.boundary) ? this.boundary : this.boundary + band;
    this.ents = new Map();        // avatar -> {x,y}   (이 존이 *소유*한 엔터티만 — 쓰기 권위)
    this.ghosts = new Map();      // avatar -> {x,y}   (sibling 경계 띠 구독 — 읽기 전용, 매 tick 갱신)
    this.sessions = new Map();    // sessionId -> {gateway, avatar}  (소유 아바타의 세션 — 이 존이 뷰 발행)
    this.prevSeen = new Map();    // sessionId -> Map(id->{x,y})  (직전 tick 그 세션에 *보낸* 가시 집합 = 증분 기준)
    this.pending = [];            // 이번 tick 적용할 이동 이벤트
    this.sent = 0;                // 전체 스냅샷 모드에서 보낸 엔터티 건수(0006 대역폭 기준)
    this.views = 0;               // 보낸 뷰 메시지 수(전체 스냅샷)
    this.handoffsSent = 0;        // release 횟수
    this.handoffsAcquired = 0;    // acquire 횟수
    this.ghostMsgs = 0;           // 경계 구독 메시지 수
    this.ghostEntsSent = 0;       // 경계 구독으로 보낸 엔터티 건수(상호 구독 비용)
    // 증분 회계 — enter/exit/update 건수(레코드)·델타 메시지 수·reset 수
    this.deltaEnter = 0; this.deltaExit = 0; this.deltaUpdate = 0; this.deltaMsgs = 0; this.resets = 0;
  }
  owns(x) { return x >= this.region.lo && x < this.region.hi; }
  inBand(x) { return x >= this.bandLo && x < this.bandHi; }
  near(a, b) { return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y)) <= this.radius; }  // 체비쇼프(비-wrap)
  sessionOf(avatar) {            // 핸드오프 시 함께 옮길 세션 탐색
    for (const [sid, s] of this.sessions) if (s.avatar === avatar) return { id: sid, gateway: s.gateway };
    return null;
  }
  onMsg(m) {
    const p = m.payload;
    if (p.type === 'enter') {       // 엔트리 존(zone1)만 받는다 — 시작 위치 부여(시드 PRNG)
      this.sessions.set(p.sessionId, { gateway: m.from, avatar: p.avatar });
      this.ents.set(p.avatar, { x: this.rng() % this.grid, y: this.rng() % this.grid });
    } else if (p.type === 'move') {
      if (this.ents.has(p.avatar)) this.pending.push(p);  // *소유* 엔터티의 이동만 큐잉(비소유는 무시 → 이중적용 0)
    } else if (p.type === 'leave') {
      this.sessions.delete(p.sessionId);
      this.prevSeen.delete(p.sessionId);   // 증분 기준 폐기(이 세션은 더는 없음)
      this.ents.delete(p.avatar);   // 소유 존만 실제로 지움(비소유는 no-op)
    } else if (p.type === 'handoff') {   // acquire — sibling 이 떼어 보낸 권위 토큰을 붙인다
      this.ents.set(p.avatar, { x: p.x, y: p.y });
      if (p.sessionId) this.sessions.set(p.sessionId, { gateway: p.gateway, avatar: p.avatar });
      // prevSeen 은 *옮기지 않는다* — 새 소유 존은 직전 가시를 모르므로 다음 tick reset(키프레임) 발행 → stale 0
      this.handoffsAcquired++;
    } else if (p.type === 'ghosts') {    // 경계 띠 구독 갱신(sibling owned 의 경계 근방 스냅샷)
      this.ghosts = new Map(p.ents.map(e => [e.id, { x: e.x, y: e.y }]));
    }
  }
  // 한 세션의 현재 가시 집합(owned + ghost, 반경 R) — 0006 의 view 순서(owned 먼저, 그다음 ghost) 보존.
  visibleFor(me) {
    const vis = new Map();
    for (const [id, e] of this.ents) if (this.near(me, e)) vis.set(id, { x: e.x, y: e.y });    // owned 먼저
    for (const [id, e] of this.ghosts) if (this.near(me, e)) vis.set(id, { x: e.x, y: e.y });  // 그다음 ghost
    return vis;
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
          if (s) { this.sessions.delete(s.id); this.prevSeen.delete(s.id); }
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
    // ④ 각 소유 세션에 AOI(반경 R) 발행 — 전체 스냅샷(0006) *또는* 증분(이 step)
    for (const [sessionId, s] of this.sessions) {
      const me = this.ents.get(s.avatar);
      if (!me) continue;
      if (!this.incremental) {
        // ── 전체 스냅샷(0006 비트 동일) ──
        const visible = [];
        for (const [id, e] of this.ents) if (this.near(me, e)) visible.push({ id, x: e.x, y: e.y });
        for (const [id, e] of this.ghosts) if (this.near(me, e)) visible.push({ id, x: e.x, y: e.y });
        this.sent += visible.length;
        this.views++;
        this.net.send(this.addr, s.gateway, { type: 'view', sessionId, entities: visible });
        continue;
      }
      // ── 증분 — 직전 가시(prevSeen) 대비 enter/exit/update만 ──
      const cur = this.visibleFor(me);
      const prev = this.prevSeen.get(sessionId);
      const reset = !prev;                 // 새 세션·핸드오프 직후 = 기준 없음 → 키프레임(전부 enter)
      const enter = [], exit = [], update = [];
      for (const [id, e] of cur) {
        if (reset) { enter.push({ id, x: e.x, y: e.y }); continue; }
        const pe = prev.get(id);
        if (!pe) enter.push({ id, x: e.x, y: e.y });
        else if (pe.x !== e.x || pe.y !== e.y) update.push({ id, x: e.x, y: e.y });
      }
      if (!reset) for (const id of prev.keys()) if (!cur.has(id)) exit.push(id);
      this.prevSeen.set(sessionId, cur);   // 다음 tick 기준 = 방금 보낸 가시 집합(= 클라 seen 과 동기)
      if (!reset && enter.length === 0 && exit.length === 0 && update.length === 0) continue;  // 변화 0 → 무발신(정지 시 대역폭 0)
      this.deltaEnter += enter.length; this.deltaExit += exit.length; this.deltaUpdate += update.length;
      this.deltaMsgs++; if (reset) this.resets++;
      this.net.send(this.addr, s.gateway, { type: 'view_delta', sessionId, reset, enter, exit, update });
    }
  }
}

// ── 클라이언트 — 0006 과 동일하나, view(전체) *또는* view_delta(증분)로 seen 을 재구성 ──
//  존이 둘·핸드오프·증분 reset 을 *모른다* — 뷰는 게이트웨이에서 균일하게 온다.
class Client {
  constructor(script) {
    this.script = script;
    this.phase = 'idle';
    this.ticket = null;
    this.avatar = null;
    this.seen = new Map();    // id -> {x,y}  (마지막 가시 집합 = 시각화·대조 대상)
    this.views = 0;           // 받은 뷰/델타 메시지 수
    this.deltasApplied = 0;
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
        this.phase = 'settled';   // 이동 종료 후 접속 유지(위치 안정 → 증분 0 수렴, AOI 대조 가능)
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
    } else if (p.type === 'view') {                 // 전체 스냅샷 — seen 통째 교체(0006)
      this.views++;
      this.seen = new Map(p.entities.map(e => [e.id, { x: e.x, y: e.y }]));
    } else if (p.type === 'view_delta') {           // 증분 — seen 누적 적용(이 step)
      this.views++; this.deltasApplied++;
      if (p.reset) this.seen = new Map();           // 키프레임 — 비우고 enter 로 재구성
      for (const e of p.enter) this.seen.set(e.id, { x: e.x, y: e.y });
      for (const e of p.update) this.seen.set(e.id, { x: e.x, y: e.y });
      for (const id of p.exit) this.seen.delete(id);
    } else if (p.type === 'disconnect_ok') {
      this.phase = 'done';
    }
  }
  seenIds() { return [...this.seen.keys()].sort(); }
  // 위치까지 포함한 가시 서명 — 증분 정확성(seen == 전체 스냅샷) 대조용.
  seenSig() {
    return [...this.seen.entries()].map(([id, e]) => id + '@' + e.x + ',' + e.y).sort().join(';');
  }
}

// ── 하니스 — 한 번의 세계 실행 (멀티 클라 + 분할 존 + 증분 AOI) ──
// opts: { seed, ticks, clients, moves, radius, grid, zones(1|2), incremental, leave, transport }
function run(opts) {
  const {
    seed, ticks = 48, clients = 6, moves = 30, radius = 4, grid = 16, zones = 2,
    incremental = true, transport = null, leave = {},
  } = opts;
  const accounts = [];
  for (let i = 0; i < clients; i++) accounts.push('hero' + i);

  const net = new Net({ transport, seed });
  const login = new LoginServer(accounts, seed);
  const registry = new SessionRegistry();
  const H = Math.floor(grid / 2);

  const zoneObjs = [];
  const zoneAddrs = [];
  if (zones === 1) {
    zoneObjs.push(new EntityZone(seed, { grid, radius, incremental, region: { lo: 0, hi: grid }, sibling: null, boundary: grid }));
    zoneAddrs.push('zone1');
  } else {
    zoneObjs.push(new EntityZone(seed, { grid, radius, incremental, region: { lo: 0, hi: H }, sibling: 'zone2', boundary: H }));
    zoneObjs.push(new EntityZone(seed, { grid, radius, incremental, region: { lo: H, hi: grid }, sibling: 'zone1', boundary: H }));
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

  // 권위 trace(0006) + 증분 trace(이 step) — 매 tick 후 스냅샷.
  const trace = [];        // {tick, committed, inflight, liveN} — 권위 보존
  const seenTrace = [];    // tick 별 [각 클라 seenSig] — 증분 정확성(전체 스냅샷과 비교)
  const deltaTrace = [];   // tick 별 이번 tick 보낸 증분 레코드 합(정지 시 0 수렴)
  let fullAssumed = 0, prevViews = 0, prevDeltaRec = 0;
  for (let i = 0; i < ticks; i++) {
    net.step();
    const committed = new Map();
    for (const z of zoneObjs) for (const av of z.ents.keys()) committed.set(av, (committed.get(av) || 0) + 1);
    const inflight = scanInflightHandoffs(net);
    const live = new Set([...committed.keys(), ...inflight]);
    trace.push({ tick: i + 1, committed, inflight, liveN: live.size });
    seenTrace.push(clis.map(c => c.seenSig()));
    const curDeltaRec = zoneObjs.reduce((a, z) => a + z.deltaEnter + z.deltaExit + z.deltaUpdate, 0);
    deltaTrace.push(curDeltaRec - prevDeltaRec); prevDeltaRec = curDeltaRec;
    // 전체 스냅샷 모드의 AOI-없음 대비 절감 회계(0006 호환 — incremental=false 일 때만 의미)
    const viewsNow = zoneObjs.reduce((a, z) => a + z.views, 0);
    fullAssumed += (viewsNow - prevViews) * live.size;
    prevViews = viewsNow;
  }
  const totals = {
    sent: zoneObjs.reduce((a, z) => a + z.sent, 0),                 // 전체 스냅샷 엔터티 건수
    views: zoneObjs.reduce((a, z) => a + z.views, 0),
    handoffs: zoneObjs.reduce((a, z) => a + z.handoffsSent, 0),
    ghostEnts: zoneObjs.reduce((a, z) => a + z.ghostEntsSent, 0),
    ghostMsgs: zoneObjs.reduce((a, z) => a + z.ghostMsgs, 0),
    deltaEnter: zoneObjs.reduce((a, z) => a + z.deltaEnter, 0),
    deltaExit: zoneObjs.reduce((a, z) => a + z.deltaExit, 0),
    deltaUpdate: zoneObjs.reduce((a, z) => a + z.deltaUpdate, 0),
    deltaMsgs: zoneObjs.reduce((a, z) => a + z.deltaMsgs, 0),
    resets: zoneObjs.reduce((a, z) => a + z.resets, 0),
    fullAssumed,
  };
  totals.deltaRecords = totals.deltaEnter + totals.deltaExit + totals.deltaUpdate;  // 증분 총 레코드
  return { net, login, registry, gateway, zones: zoneObjs, zoneAddrs, clients: clis, trace, seenTrace, deltaTrace, totals, H, grid, radius };
}

// 버스(net.queue)에 아직 배달되지 않은 핸드오프 토큰을 센다 — in-flight = 권위가 "이주 중".
function scanInflightHandoffs(net) {
  const out = [];
  for (const msgs of net.queue.values())
    for (const m of msgs)
      if (m.payload && m.payload.type === 'handoff' && !net.delivered.has(m.id)) out.push(m.payload.avatar);
  return out;
}

// 그라운드 트루스 — *전 존 합산* 월드 위치에서 avatar 의 반경 R 이웃(존 경계 무시).
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
