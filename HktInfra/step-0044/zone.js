'use strict';
// step-0044 분할 preamble — 박스 1개=파일 1개 (CLAUDE.md 임계 규칙). 진입점 net-core.js 가 묶는다.
// dual-mode: Node require / 브라우저는 common.js 를 <script> 선행 로드(전역 __HktNetCommon).
const __c = (typeof module !== 'undefined' && module.exports && typeof require !== 'undefined')
  ? require('./common.js') : globalThis.__HktNetCommon;
const { Net, LoginServer, SessionRegistry, mulberry32, fnv1a, DEFAULTS } = __c;

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

const __part = { EntityZone };
if (typeof module !== 'undefined' && module.exports) module.exports = __part;
if (typeof globalThis !== 'undefined') (globalThis.__HktNetParts = globalThis.__HktNetParts || {}).zone = __part;
