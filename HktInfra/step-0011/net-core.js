// HktInfra step-0011 — 실 네트워크 소켓 전송 현실화: child_process IPC 파이프 → 실 TCP 소켓 (와이어 현실화)
// step-0010(프로세스 경계 현실화 — child_process.fork IPC) 위에 *한 조각*만 더한다:
//   0010 은 각 서버 박스를 별 OS 프로세스(fork)로 분리하고 *fork 의 IPC 채널*(파이프·메시지 프레임 내장)로 통신시켜
//   프로세스 경계를 현실화했다 — 그러나 전송은 아직 *로컬 IPC 파이프*였고(실 네트워크 소켓 아님), 게다가 fork 가
//   주는 메시지-프레임 IPC 라 *TCP 스트림 재조립* 같은 실 와이어 문제를 우회했다(0010 §8.2).
//   이 step 은 그 와이어를 *실 TCP 소켓*으로 갈아끼운다([TOOLS.md] §2 버스·transport seam):
//     · 인프로세스 모드(run): engine/Net 그대로 — 0010 와 *비트 동일*(reg 0). 와이어 교체는 비-침습.
//     · 멀티프로세스 모드(runMulti): 각 서버 박스가 *별도 OS 프로세스*(child_process.spawn — *IPC 채널 0*)에 살고,
//       broker(TCP 서버)와 *실 TCP 소켓*으로 연결돼 *길이-프리픽스 프레이밍*된 JSON 메시지로만 통신한다.
//       fork 의 내장 IPC 채널을 안 쓴다 — 와이어는 진짜 소켓 바이트 스트림(공유 메모리 0·다른 머신 이전 가능).
//
// 핵심 설계 — 와이어만 바뀌고 *lockstep 배리어·액터·프로토콜은 0010 그대로*:
//   broker 는 engine/Net 의 step() 의미를 *비동기 배리어*로 재현한다(타이밍↔내용 분리, 0004 의 계승):
//     매 tick: ① due 메시지를 호스트별로 묶어 deliver(원격 onMsg) → 발신을 (전역순서, 로컬순서)로 재정렬 후
//                 broker net.send 로 재생(seq/id/log/enqueue = engine Net 그대로) → ② 전 액터 onTick(등록 순서)
//                 → 발신 재정렬·재생. deliver 발신은 항상 tick 발신보다 먼저(engine step 의 deliver→onTick 순서).
//   배리어가 전역 발신 순서를 *정확히* 보존하므로 broker.net.log 가 인프로세스와 *비트 동일* → 실 소켓 위에서도 E2E 동치.
//   TCP 는 바이트 스트림이라 *프레이밍*(4바이트 길이 프리픽스)으로 메시지 경계를 복원한다 — 실 와이어의 첫 현실 문제.
//   (logDigest 는 from>to:payload 순서의 함수 — seq/tick 무관 — 이라 순서 보존만으로 충분.)
//
// 척추(SPINE.md) 준수:
//   - 신성한 tick: 액터 로직 무변경(0010 그대로). broker 는 전송 substrate 일 뿐 — tick 안에 I/O·인증 0.
//   - 결정론 코어: 액터는 시드 의사난수만(Math.random 0). 와이어가 소켓이 돼도 같은 입력열 → 같은 상태(E2E 동치).
//   - 권위 단일 소유: 0010 불변(소유자=1·이중쓰기 0·failover bounded gap→회복)이 실 소켓 너머로도 보존.
//   - 은닉·단일 연결: 클라는 게이트웨이만. 소켓 분리는 *서버간* 경계 — 클라엔 비가시(누설 0).
//   - headless·원격 검증: node verify.js 한 줄이 전 프로세스를 TCP 소켓으로 묶어 같은 4기둥 검증(제1 운영 제약).
'use strict';
const __engine = (typeof module !== 'undefined' && module.exports && typeof require !== 'undefined')
  ? require('../engine/index.js')
  : globalThis.HktEngine;
const { Net, LoginServer, SessionRegistry, mulberry32, fnv1a } = __engine;

// 복원·failover 파라미터(0009 그대로) — opts 오버라이드 가능 결정론 상수. hkt.recovery.*·hkt.failover.* 노브의 더미판.
const DEFAULTS = { retxPeriod: 2, resyncPeriod: 3, heartbeat: 10, leaseTimeout: 3 };

// ── [엣지] 게이트웨이 — 0009 그대로(replicas 를 생성자 인자로 받게만 조정 — 토폴로지 빌더가 단일 경로로 배선) ──
class Gateway {
  constructor(zoneAddrs, replicas = []) {
    this.zones = zoneAddrs.slice();      // 권위 존 주소(enter 라우팅 = zones[0])
    this.replicas = replicas.slice();    // 추종자(shadow) 주소 — failover 시 입력 미러 대상(0009=빈 배열 → 비트 동일)
    this.byClient = new Map();
    this.bySession = new Map();
    this.dropped = 0;
    this.rejected = 0;
  }
  worldTargets() { return this.replicas.length ? this.zones.concat(this.replicas) : this.zones; }
  onMsg(m) {
    const p = m.payload;
    if (m.from === 'registry') {
      if (p.type === 'validate_ok') {
        const bind = { client: p.ref, sessionId: p.sessionId, avatar: p.avatar };
        this.byClient.set(p.ref, bind);
        this.bySession.set(p.sessionId, bind);
        this.net.send(this.addr, this.zones[0], { type: 'enter', sessionId: p.sessionId, avatar: p.avatar });
        if (this.replicas.length) this.net.send(this.addr, this.replicas[0], { type: 'enter', sessionId: p.sessionId, avatar: p.avatar });
        this.net.send(this.addr, p.ref, { type: 'connect_ok', avatar: p.avatar });
      } else if (p.type === 'validate_fail') {
        this.rejected++;
        this.net.send(this.addr, p.ref, { type: 'connect_fail' });
      }
      return;
    }
    if (m.from === 'orch') {
      if (p.type === 'reroute') {
        this.zones = this.zones.map(z => z === p.from ? p.to : z);
        this.replicas = this.replicas.filter(z => z !== p.to && z !== p.retire);
      }
      return;
    }
    if (m.from.startsWith('zone')) {
      if (p.type === 'view') {
        const bind = this.bySession.get(p.sessionId);
        if (bind) this.net.send(this.addr, bind.client, { type: 'view', entities: p.entities });
      } else if (p.type === 'view_delta') {
        const bind = this.bySession.get(p.sessionId);
        if (bind) this.net.send(this.addr, bind.client, { type: 'view_delta', reset: p.reset, enter: p.enter, exit: p.exit, update: p.update, seq: p.seq });
      }
      return;
    }
    if (p.type === 'connect') {
      if (this.byClient.has(m.from)) { this.rejected++; this.net.send(this.addr, m.from, { type: 'connect_fail' }); return; }
      this.net.send(this.addr, 'registry', { type: 'validate', ticket: p.ticket, ref: m.from });
    } else if (p.type === 'move') {
      const bind = this.byClient.get(m.from);
      if (bind) for (const z of this.worldTargets()) this.net.send(this.addr, z, { type: 'move', sessionId: bind.sessionId, avatar: bind.avatar, d: p.d });
      else this.dropped++;
    } else if (p.type === 'resync') {
      const bind = this.byClient.get(m.from);
      if (bind) for (const z of this.worldTargets()) this.net.send(this.addr, z, { type: 'resync', sessionId: bind.sessionId });
      else this.dropped++;
    } else if (p.type === 'disconnect') {
      const bind = this.byClient.get(m.from);
      if (!bind) return;
      for (const z of this.worldTargets()) this.net.send(this.addr, z, { type: 'leave', sessionId: bind.sessionId, avatar: bind.avatar });
      this.net.send(this.addr, 'registry', { type: 'session_closed', sessionId: bind.sessionId });
      this.net.send(this.addr, m.from, { type: 'disconnect_ok' });
      this.byClient.delete(m.from);
      this.bySession.delete(bind.sessionId);
    }
  }
}

// ── [코디네이션] Orchestrator — 0009 그대로(monitor 쌍을 생성자 opts 로 받게만 조정) ──
class Orchestrator {
  constructor(opts = {}) {
    this.leaseTimeout = opts.leaseTimeout || DEFAULTS.leaseTimeout;
    this.pairs = new Map();
    this.lastLease = new Map();
    this.dead = new Set();
    this.curTick = 0;
    this.promotions = 0;
    this.deathSeen = new Map();
    if (opts.monitor) for (const [a, f] of opts.monitor) this.monitor(a, f);
  }
  monitor(authority, follower) { this.pairs.set(authority, follower); this.lastLease.set(authority, 0); }
  onMsg(m) {
    const p = m.payload;
    if (p.type === 'lease') this.lastLease.set(p.zone, this.curTick);
  }
  onTick(tick) {
    this.curTick = tick;
    for (const [auth, follower] of this.pairs) {
      if (this.dead.has(auth)) continue;
      const last = this.lastLease.get(auth);
      if (last > 0 && (tick - last) >= this.leaseTimeout) {
        this.dead.add(auth);
        this.deathSeen.set(auth, tick);
        this.promotions++;
        const survivor = this._survivorOf(auth);
        const otherFollower = survivor ? this.pairs.get(survivor) : null;
        this.net.send(this.addr, follower, { type: 'promote', sibling: survivor });
        if (survivor) this.net.send(this.addr, survivor, { type: 'relink', sibling: follower });
        if (otherFollower) this.net.send(this.addr, otherFollower, { type: 'retire' });
        this.net.send(this.addr, 'gateway', { type: 'reroute', from: auth, to: follower, retire: otherFollower });
      }
    }
  }
  _survivorOf(deadAuth) {
    for (const a of this.pairs.keys()) if (a !== deadAuth && !this.dead.has(a)) return a;
    return null;
  }
}

// ── [월드] 분할 존 — 0009 그대로(무수정 복사 전진) ──
class EntityZone {
  constructor(seed, opts = {}) {
    this.rng = mulberry32((seed ^ 0x5A17) >>> 0);
    this.grid = opts.grid || 16;
    this.radius = opts.radius !== undefined ? opts.radius : 4;
    this.incremental = opts.incremental !== false;
    this.recovery = opts.recovery === true;
    this.retxPeriod = opts.retxPeriod || DEFAULTS.retxPeriod;
    this.heartbeat = opts.heartbeat || DEFAULTS.heartbeat;
    this.failover = opts.failover === true;
    this.shadow = opts.shadow === true;
    this.orch = opts.orch || null;
    this.deathTick = opts.deathTick != null ? opts.deathTick : null;
    this.dead = false;
    this.promotedAt = null;
    const G = this.grid;
    this.region = opts.region || { lo: 0, hi: G };
    this.sibling = opts.sibling || null;
    this.boundary = opts.boundary !== undefined ? opts.boundary : G / 2;
    const band = this.radius;
    this.bandLo = (this.region.hi === this.boundary) ? this.boundary - band : this.boundary;
    this.bandHi = (this.region.hi === this.boundary) ? this.boundary : this.boundary + band;
    this.ents = new Map();
    this.ghosts = new Map();
    this.sessions = new Map();
    this.prevSeen = new Map();
    this.pending = [];
    this.curTick = 0;
    this.deltaSeqOf = new Map();
    this.lastKeyframe = new Map();
    this.needsKeyframe = new Set();
    this.outbox = new Map();
    this.acquired = new Set();
    this.handoffSeq = 0;
    this.sent = 0; this.views = 0;
    this.handoffsSent = 0; this.handoffsAcquired = 0;
    this.ghostMsgs = 0; this.ghostEntsSent = 0;
    this.deltaEnter = 0; this.deltaExit = 0; this.deltaUpdate = 0; this.deltaMsgs = 0; this.resets = 0;
    this.retransmits = 0; this.acksRx = 0; this.naksRx = 0; this.keyframesForced = 0; this.heartbeats = 0;
    this.leasesSent = 0; this.promotionKeyframes = 0;
  }
  isAuthority() { return !this.dead && !this.shadow; }
  owns(x) { return x >= this.region.lo && x < this.region.hi; }
  inBand(x) { return x >= this.bandLo && x < this.bandHi; }
  near(a, b) { return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y)) <= this.radius; }
  sessionOf(avatar) {
    for (const [sid, s] of this.sessions) if (s.avatar === avatar) return { id: sid, gateway: s.gateway };
    return null;
  }
  onMsg(m) {
    if (this.dead) return;
    const p = m.payload;
    if (p.type === 'enter') {
      this.sessions.set(p.sessionId, { gateway: m.from, avatar: p.avatar });
      this.ents.set(p.avatar, { x: this.rng() % this.grid, y: this.rng() % this.grid });
    } else if (p.type === 'move') {
      if (this.ents.has(p.avatar)) this.pending.push(p);
    } else if (p.type === 'leave') {
      this.sessions.delete(p.sessionId);
      this.prevSeen.delete(p.sessionId);
      this.deltaSeqOf.delete(p.sessionId);
      this.lastKeyframe.delete(p.sessionId);
      this.ents.delete(p.avatar);
    } else if (p.type === 'handoff') {
      if (this.recovery && p.handoffId !== undefined) {
        if (!this.acquired.has(p.handoffId)) {
          this.acquired.add(p.handoffId);
          this.ents.set(p.avatar, { x: p.x, y: p.y });
          if (p.sessionId) {
            this.sessions.set(p.sessionId, { gateway: p.gateway, avatar: p.avatar });
            this.deltaSeqOf.set(p.sessionId, p.lastSeq);
          }
          this.handoffsAcquired++;
        }
        this.net.send(this.addr, m.from, { type: 'handoff_ack', handoffId: p.handoffId });
      } else {
        this.ents.set(p.avatar, { x: p.x, y: p.y });
        if (p.sessionId) this.sessions.set(p.sessionId, { gateway: p.gateway, avatar: p.avatar });
        this.handoffsAcquired++;
      }
    } else if (p.type === 'handoff_ack') {
      if (this.outbox.delete(p.handoffId)) this.acksRx++;
    } else if (p.type === 'resync') {
      if (this.sessions.has(p.sessionId)) { this.needsKeyframe.add(p.sessionId); this.naksRx++; }
    } else if (p.type === 'ghosts') {
      this.ghosts = new Map(p.ents.map(e => [e.id, { x: e.x, y: e.y }]));
    } else if (p.type === 'promote') {
      this.shadow = false;
      this.promotedAt = this.curTick;
      this.sibling = p.sibling;
      for (const sid of this.sessions.keys()) this.needsKeyframe.add(sid);
    } else if (p.type === 'relink') {
      this.sibling = p.sibling;
    } else if (p.type === 'retire') {
      this.dead = true;
    }
  }
  visibleFor(me) {
    const vis = new Map();
    for (const [id, e] of this.ents) if (this.near(me, e)) vis.set(id, { x: e.x, y: e.y });
    for (const [id, e] of this.ghosts) if (this.near(me, e)) vis.set(id, { x: e.x, y: e.y });
    return vis;
  }
  onTick(tick) {
    this.curTick = tick || 0;
    if (this.deathTick != null && this.curTick >= this.deathTick) this.dead = true;
    if (this.dead) return;
    if (this.failover && this.orch && !this.shadow) { this.net.send(this.addr, this.orch, { type: 'lease', zone: this.addr }); this.leasesSent++; }
    const SUP = this.shadow;
    for (const p of this.pending) {
      const e = this.ents.get(p.avatar);
      if (e) { e.x = (e.x + p.d.dx + this.grid) % this.grid; e.y = (e.y + p.d.dy + this.grid) % this.grid; }
    }
    this.pending = [];
    if (this.sibling) {
      for (const [avatar, e] of [...this.ents]) {
        if (!this.owns(e.x)) {
          const s = this.sessionOf(avatar);
          if (this.recovery) {
            const handoffId = this.addr + ':' + (this.handoffSeq++);
            const lastSeq = s ? (this.deltaSeqOf.get(s.id) ?? -1) : -1;
            const rec = { avatar, x: e.x, y: e.y, sessionId: s ? s.id : null, gateway: s ? s.gateway : null, lastSeq, lastSent: this.curTick, retries: 0 };
            this.outbox.set(handoffId, rec);
            this.net.send(this.addr, this.sibling, { type: 'handoff', handoffId, avatar, x: e.x, y: e.y, sessionId: rec.sessionId, gateway: rec.gateway, lastSeq });
          } else {
            this.net.send(this.addr, this.sibling, { type: 'handoff', avatar, x: e.x, y: e.y, sessionId: s ? s.id : null, gateway: s ? s.gateway : null });
          }
          this.ents.delete(avatar);
          if (s) { this.sessions.delete(s.id); this.prevSeen.delete(s.id); this.deltaSeqOf.delete(s.id); this.lastKeyframe.delete(s.id); }
          this.handoffsSent++;
        }
      }
    }
    if (this.recovery && this.outbox.size) {
      for (const [hid, rec] of this.outbox) {
        if (this.curTick - rec.lastSent >= this.retxPeriod) {
          rec.lastSent = this.curTick; rec.retries++; this.retransmits++;
          this.net.send(this.addr, this.sibling, { type: 'handoff', handoffId: hid, avatar: rec.avatar, x: rec.x, y: rec.y, sessionId: rec.sessionId, gateway: rec.gateway, lastSeq: rec.lastSeq });
        }
      }
    }
    if (this.sibling) {
      const band = [];
      for (const [avatar, e] of this.ents) if (this.inBand(e.x)) band.push({ id: avatar, x: e.x, y: e.y });
      this.net.send(this.addr, this.sibling, { type: 'ghosts', ents: band });
      this.ghostMsgs++;
      this.ghostEntsSent += band.length;
    }
    for (const [sessionId, s] of this.sessions) {
      const me = this.ents.get(s.avatar);
      if (!me) continue;
      if (!this.incremental) {
        const visible = [];
        for (const [id, e] of this.ents) if (this.near(me, e)) visible.push({ id, x: e.x, y: e.y });
        for (const [id, e] of this.ghosts) if (this.near(me, e)) visible.push({ id, x: e.x, y: e.y });
        if (!SUP) { this.sent += visible.length; this.views++; this.net.send(this.addr, s.gateway, { type: 'view', sessionId, entities: visible }); }
        continue;
      }
      const cur = this.visibleFor(me);
      const prev = this.prevSeen.get(sessionId);
      if (!this.recovery) {
        const reset = !prev;
        const enter = [], exit = [], update = [];
        for (const [id, e] of cur) {
          if (reset) { enter.push({ id, x: e.x, y: e.y }); continue; }
          const pe = prev.get(id);
          if (!pe) enter.push({ id, x: e.x, y: e.y });
          else if (pe.x !== e.x || pe.y !== e.y) update.push({ id, x: e.x, y: e.y });
        }
        if (!reset) for (const id of prev.keys()) if (!cur.has(id)) exit.push(id);
        this.prevSeen.set(sessionId, cur);
        if (!reset && enter.length === 0 && exit.length === 0 && update.length === 0) continue;
        if (!SUP) {
          this.deltaEnter += enter.length; this.deltaExit += exit.length; this.deltaUpdate += update.length;
          this.deltaMsgs++; if (reset) this.resets++;
          this.net.send(this.addr, s.gateway, { type: 'view_delta', sessionId, reset, enter, exit, update });
        }
        continue;
      }
      const forced = this.needsKeyframe.has(sessionId);
      const lastKf = this.lastKeyframe.get(sessionId);
      const hb = lastKf === undefined || (this.curTick - lastKf) >= this.heartbeat;
      const reset = !prev || forced || hb;
      const enter = [], exit = [], update = [];
      for (const [id, e] of cur) {
        if (reset) { enter.push({ id, x: e.x, y: e.y }); continue; }
        const pe = prev.get(id);
        if (!pe) enter.push({ id, x: e.x, y: e.y });
        else if (pe.x !== e.x || pe.y !== e.y) update.push({ id, x: e.x, y: e.y });
      }
      if (!reset) for (const id of prev.keys()) if (!cur.has(id)) exit.push(id);
      this.prevSeen.set(sessionId, cur);
      if (!reset && enter.length === 0 && exit.length === 0 && update.length === 0) continue;
      const seq = (this.deltaSeqOf.get(sessionId) ?? -1) + 1;
      this.deltaSeqOf.set(sessionId, seq);
      if (reset) {
        this.lastKeyframe.set(sessionId, this.curTick);
        if (forced) this.needsKeyframe.delete(sessionId);
      }
      if (!SUP) {
        this.deltaEnter += enter.length; this.deltaExit += exit.length; this.deltaUpdate += update.length;
        this.deltaMsgs++;
        if (reset) {
          this.resets++;
          if (forced) { this.keyframesForced++; if (this.promotedAt != null && this.curTick >= this.promotedAt) this.promotionKeyframes++; }
          else if (hb && prev) this.heartbeats++;
        }
        this.net.send(this.addr, s.gateway, { type: 'view_delta', sessionId, reset, enter, exit, update, seq });
      }
    }
  }
}

// ── 클라이언트 — 0009 그대로(프로세스 경계는 *서버간* — 클라는 게이트웨이만, 비가시) ──
class Client {
  constructor(script) {
    this.script = script;
    this.phase = 'idle';
    this.ticket = null;
    this.avatar = null;
    this.seen = new Map();
    this.views = 0;
    this.deltasApplied = 0;
    this.events = [];
    this.sent = 0;
    this.rng = null;
    this.curTick = 0;
    this.expectedSeq = 0;
    this.awaitingResync = false;
    this.lastNak = -99;
    this.naksSent = 0;
    this.resyncPeriod = script.resyncPeriod || DEFAULTS.resyncPeriod;
    this.staleDrops = 0;
  }
  onTick(S) {
    this.curTick = S;
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
        this.phase = 'settled';
      }
    }
    if (this.awaitingResync && (S - this.lastNak) >= this.resyncPeriod) {
      this.net.send(this.addr, 'gateway', { type: 'resync' });
      this.lastNak = S; this.naksSent++;
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
    } else if (p.type === 'view_delta') {
      this.views++;
      if (p.seq === undefined) {
        this.deltasApplied++;
        if (p.reset) this.seen = new Map();
        for (const e of p.enter) this.seen.set(e.id, { x: e.x, y: e.y });
        for (const e of p.update) this.seen.set(e.id, { x: e.x, y: e.y });
        for (const id of p.exit) this.seen.delete(id);
        return;
      }
      if (p.reset) {
        if (p.seq >= this.expectedSeq) {
          this.seen = new Map();
          for (const e of p.enter) this.seen.set(e.id, { x: e.x, y: e.y });
          for (const e of p.update) this.seen.set(e.id, { x: e.x, y: e.y });
          this.expectedSeq = p.seq + 1;
          this.awaitingResync = false;
          this.deltasApplied++;
        }
        return;
      }
      if (p.seq === this.expectedSeq) {
        for (const e of p.enter) this.seen.set(e.id, { x: e.x, y: e.y });
        for (const e of p.update) this.seen.set(e.id, { x: e.x, y: e.y });
        for (const id of p.exit) this.seen.delete(id);
        this.expectedSeq++;
        this.deltasApplied++;
      } else if (p.seq > this.expectedSeq) {
        this.staleDrops++;
        if (!this.awaitingResync || (this.curTick - this.lastNak) >= this.resyncPeriod) {
          this.net.send(this.addr, 'gateway', { type: 'resync' });
          this.lastNak = this.curTick; this.naksSent++;
        }
        this.awaitingResync = true;
      }
    } else if (p.type === 'disconnect_ok') {
      this.phase = 'done';
    }
  }
  seenIds() { return [...this.seen.keys()].sort(); }
  seenSig() {
    return [...this.seen.entries()].map(([id, e]) => id + '@' + e.x + ',' + e.y).sort().join(';');
  }
}

// ── routeFilter — 0009 그대로 ──
const routeFilters = {
  handoff: (m) => /^zone/.test(m.from) && /^zone/.test(m.to) && m.payload.type === 'handoff',
  delta: (m) => /^zone/.test(m.from) && m.to === 'gateway' && m.payload.type === 'view_delta',
  both: (m) => (/^zone/.test(m.from) && /^zone/.test(m.to) && m.payload.type === 'handoff') ||
               (/^zone/.test(m.from) && m.to === 'gateway' && m.payload.type === 'view_delta'),
};

// ════════════════════════════════════════════════════════════════════════
//  토폴로지 빌더 — 인프로세스/멀티프로세스가 *같은 단일 경로*로 액터를 구성(E2E 동치의 토대).
//   buildTopology(opts) → { specs:[{addr,kind,seed,opts}], order:[addr...] }.  0009 run() 의 배선을
//   *선언적 spec* 으로 옮겼다(생성자 opts 에 전 배선 포함 — 후처리 0). makeActor(spec, net) 가 spec → 액터.
//   같은 spec → 같은 액터(시드 의사난수만) → 프로세스가 갈려도 같은 초기 상태.
// ════════════════════════════════════════════════════════════════════════
function buildTopology(opts) {
  const {
    seed, clients = 6, moves = 30, radius = 4, grid = 16, zones = 2,
    incremental = true, recovery = false, leave = {},
    retxPeriod, heartbeat, resyncPeriod,
    failover = false, deathTick = null, leaseTimeout, killZone = 'zone1',
  } = opts;
  const H = Math.floor(grid / 2);
  const accounts = [];
  for (let i = 0; i < clients; i++) accounts.push('hero' + i);
  const specs = [];
  const order = [];
  const add = (s) => { specs.push(s); order.push(s.addr); };

  // 등록(=onTick) 순서는 0009 와 *정확히* 일치해야 reg 0: login·registry·gateway·zone1·zone2·[orch·zone1f·zone2f]·client*
  add({ addr: 'login', kind: 'login', opts: { accounts, seed } });
  add({ addr: 'registry', kind: 'registry', opts: {} });

  const zoneAddrs = zones === 1 ? ['zone1'] : ['zone1', 'zone2'];
  const replicas = (failover && zones === 2) ? ['zone1f', 'zone2f'] : [];
  add({ addr: 'gateway', kind: 'gateway', opts: { zoneAddrs, replicas } });

  const zopt = { grid, radius, incremental, recovery, retxPeriod, heartbeat, failover };
  const orchAddr = (failover && zones === 2) ? 'orch' : null;
  if (zones === 1) {
    add({ addr: 'zone1', kind: 'zone', seed, opts: { ...zopt, region: { lo: 0, hi: grid }, sibling: null, boundary: grid, orch: orchAddr } });
  } else {
    const dt = (key) => (deathTick != null && killZone === key) ? deathTick : null;
    add({ addr: 'zone1', kind: 'zone', seed, opts: { ...zopt, region: { lo: 0, hi: H }, sibling: 'zone2', boundary: H, orch: orchAddr, deathTick: dt('zone1') } });
    add({ addr: 'zone2', kind: 'zone', seed, opts: { ...zopt, region: { lo: H, hi: grid }, sibling: 'zone1', boundary: H, orch: orchAddr, deathTick: dt('zone2') } });
  }

  if (failover && zones === 2) {
    add({ addr: 'orch', kind: 'orch', opts: { leaseTimeout, monitor: [['zone1', 'zone1f'], ['zone2', 'zone2f']] } });
    add({ addr: 'zone1f', kind: 'zone', seed, opts: { ...zopt, region: { lo: 0, hi: H }, sibling: 'zone2f', boundary: H, shadow: true, orch: 'orch' } });
    add({ addr: 'zone2f', kind: 'zone', seed, opts: { ...zopt, region: { lo: H, hi: grid }, sibling: 'zone1f', boundary: H, shadow: true, orch: 'orch' } });
  }

  for (let i = 0; i < clients; i++) {
    add({ addr: 'client' + i, kind: 'client', opts: { script: { account: accounts[i], seed: (seed + i * 0x9E37) >>> 0, moves, leaveTick: leave[i] != null ? leave[i] : null, resyncPeriod } } });
  }
  return { specs, order, zoneAddrs, H, grid, radius };
}

// makeActor — spec → 액터(net 에 register). 인프로세스(engine Net)·호스트(HostNet shim) 양쪽이 같은 팩토리 사용.
function makeActor(spec, net) {
  let a;
  switch (spec.kind) {
    case 'login': a = new LoginServer(spec.opts.accounts, spec.opts.seed); break;
    case 'registry': a = new SessionRegistry(); break;
    case 'gateway': a = new Gateway(spec.opts.zoneAddrs, spec.opts.replicas); break;
    case 'zone': a = new EntityZone(spec.seed, spec.opts); break;
    case 'orch': a = new Orchestrator(spec.opts); break;
    case 'client': a = new Client(spec.opts.script); break;
    default: throw new Error('unknown kind ' + spec.kind);
  }
  net.register(spec.addr, a);
  return a;
}

// ════════════════════════════════════════════════════════════════════════
//  run — 인프로세스 모드(engine/Net). 0009 와 *비트 동일*(reg 0). 단일 경로(buildTopology+makeActor)로 구성.
// ════════════════════════════════════════════════════════════════════════
function run(opts) {
  const { seed, ticks = 48, transport = null, onTick = null } = opts;
  const topo = buildTopology(opts);
  const net = new Net({ transport, seed });
  const map = new Map();
  for (const spec of topo.specs) map.set(spec.addr, makeActor(spec, net));

  const gateway = map.get('gateway');
  const login = map.get('login');
  const registry = map.get('registry');
  const orch = map.get('orch') || null;
  const zoneObjs = topo.zoneAddrs.map(a => map.get(a));
  const followers = ['zone1f', 'zone2f'].map(a => map.get(a)).filter(Boolean);
  const clis = topo.specs.filter(s => s.kind === 'client').map(s => map.get(s.addr));
  const allZones = zoneObjs.concat(followers);

  const trace = [], seenTrace = [], deltaTrace = [], replicaTrace = [];
  let prevDeltaRec = 0;
  for (let i = 0; i < ticks; i++) {
    net.step();
    const committed = new Map();
    for (const z of allZones) if (z.isAuthority()) for (const av of z.ents.keys()) committed.set(av, (committed.get(av) || 0) + 1);
    const inflight = inflightSet(net, allZones);
    const live = new Set([...committed.keys(), ...inflight]);
    trace.push({ tick: i + 1, committed, inflight, liveN: live.size });
    seenTrace.push(clis.map(c => c.seenSig()));
    const curDeltaRec = zoneObjs.reduce((a, z) => a + z.deltaEnter + z.deltaExit + z.deltaUpdate, 0);
    deltaTrace.push(curDeltaRec - prevDeltaRec); prevDeltaRec = curDeltaRec;
    if (opts.failover) replicaTrace.push(replicaDivergence(zoneObjs, followers));
    // 옵션 onTick(t, state) 훅 — 미제공이면 호출 0(reg 0 불변). 레코더의 per-tick 엔티티 위치·AOI 시각화 활성용
    //   (TESTBED 마무리 ⒜·STATE §2). state.ents = [{id,x,y,zone,authority}], state.radius = AOI 반경.
    if (onTick) {
      const ents = [];
      for (const z of allZones) if (z.isAuthority()) for (const [id, e] of z.ents) ents.push({ id, x: e.x, y: e.y, zone: z.addr, authority: true });
      onTick(i + 1, { ents, radius: topo.radius, grid: topo.grid });
    }
  }
  const sum = (f) => zoneObjs.reduce((a, z) => a + f(z), 0);
  const sumAll = (f) => allZones.reduce((a, z) => a + f(z), 0);
  const totals = {
    sent: sum(z => z.sent), views: sum(z => z.views),
    handoffs: sum(z => z.handoffsSent), acquired: sum(z => z.handoffsAcquired),
    ghostEnts: sum(z => z.ghostEntsSent), ghostMsgs: sum(z => z.ghostMsgs),
    deltaEnter: sum(z => z.deltaEnter), deltaExit: sum(z => z.deltaExit), deltaUpdate: sum(z => z.deltaUpdate),
    deltaMsgs: sum(z => z.deltaMsgs), resets: sum(z => z.resets),
    retransmits: sum(z => z.retransmits), acksRx: sum(z => z.acksRx), naksRx: sum(z => z.naksRx),
    keyframesForced: sumAll(z => z.keyframesForced), heartbeats: sum(z => z.heartbeats),
    promotionKeyframes: sumAll(z => z.promotionKeyframes),
    leasesSent: sumAll(z => z.leasesSent),
    naksSent: clis.reduce((a, c) => a + c.naksSent, 0),
    staleDrops: clis.reduce((a, c) => a + c.staleDrops, 0),
    promotions: orch ? orch.promotions : 0,
  };
  totals.deltaRecords = totals.deltaEnter + totals.deltaExit + totals.deltaUpdate;
  totals.netLost = net.stats.lost;
  return { net, login, registry, gateway, orch, zones: zoneObjs, followers, allZones, zoneAddrs: topo.zoneAddrs, clients: clis, trace, seenTrace, deltaTrace, replicaTrace, totals, H: topo.H, grid: topo.grid, radius: topo.radius, deathTick: opts.deathTick != null ? opts.deathTick : null, killZone: opts.killZone || 'zone1', mode: 'inproc' };
}

// ════════════════════════════════════════════════════════════════════════
//  runMulti — 멀티프로세스 모드(실 TCP 소켓). cluster.js 에 위임(Node 한정 — 브라우저 미로드).
//   같은 buildTopology 로 토폴로지를 짜고, 각 서버 박스를 별 프로세스(child_process.spawn — IPC 채널 0)에 띄워
//   broker(TCP 서버)와 길이-프리픽스 프레이밍 소켓으로 묶어 lockstep 배리어로 구동.
//   반환 r 은 run() 과 같은 digest 함수들이 그대로 먹는 형태(zones/clients/net.log) + r.cluster(pids/소켓 계측).
// ════════════════════════════════════════════════════════════════════════
function runMulti(opts) {
  if (typeof require === 'undefined') throw new Error('runMulti 는 Node 전용');
  return require('./cluster.js').runMulti(opts, { buildTopology, Net, fnv1a });
}

// ── 회계·트루스 헬퍼 (0009 그대로 — 인프로세스/멀티프로세스 재구성 r 둘 다 먹음) ──
function inflightSet(net, zoneObjs) {
  const out = new Set();
  for (const msgs of net.queue.values())
    for (const m of msgs)
      if (m.payload && m.payload.type === 'handoff' && /^zone[12]$/.test(m.to) && !net.delivered.has(m.id)) out.add(m.payload.avatar);
  for (const z of zoneObjs) if (z.isAuthority && z.isAuthority()) for (const rec of z.outbox.values()) out.add(rec.avatar);
  return out;
}
function authorityCount(t, avatar) {
  const c = t.committed.get(avatar) || 0;
  if (c > 0) return c;
  return t.inflight.has(avatar) ? 1 : 0;
}
function replicaDivergence(zoneObjs, followers) {
  const auth = new Map(), foll = new Map();
  for (const z of zoneObjs) if (!z.dead) for (const [id, e] of z.ents) auth.set(id, e.x + ',' + e.y);
  for (const z of followers) if (!z.dead && z.shadow) for (const [id, e] of z.ents) foll.set(id, e.x + ',' + e.y);
  let diff = 0;
  for (const [id, v] of auth) if (foll.get(id) !== v) diff++;
  for (const id of foll.keys()) if (!auth.has(id)) diff++;
  return diff;
}
function globalAoiTruth(r, avatar) {
  const live = liveZones(r);
  let me = null;
  for (const z of live) if (z.ents.has(avatar)) { me = z.ents.get(avatar); break; }
  if (!me) return null;
  const R = r.radius;
  const out = [];
  for (const z of live) for (const [id, e] of z.ents)
    if (Math.max(Math.abs(me.x - e.x), Math.abs(me.y - e.y)) <= R) out.push(id);
  return out.sort();
}
function liveZones(r) { return r.allZones ? r.allZones.filter(z => z.isAuthority()) : r.zones; }
function ownerOf(r, avatar) {
  const live = liveZones(r);
  for (const z of live) if (z.ents.has(avatar)) return z.addr;
  return null;
}

const PUBLIC_ADDRS = ['login', 'gateway'];

// ── 모듈 노출 (dual-mode) ───────────
const __hktNet = {
  mulberry32, fnv1a, Net, LoginServer, SessionRegistry, Gateway, Orchestrator, EntityZone, Client,
  buildTopology, makeActor, run, runMulti, routeFilters,
  inflightSet, authorityCount, replicaDivergence, globalAoiTruth, liveZones, ownerOf,
  PUBLIC_ADDRS, DEFAULTS,
};
if (typeof module !== 'undefined' && module.exports) module.exports = __hktNet;
if (typeof globalThis !== 'undefined') globalThis.HktNet = __hktNet;
