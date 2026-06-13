'use strict';
// step-0033 분할 preamble — 박스 1개=파일 1개 (CLAUDE.md 임계 규칙). 진입점 net-core.js 가 묶는다.
// dual-mode: Node require / 브라우저는 common.js 를 <script> 선행 로드(전역 __HktNetCommon).
const __c = (typeof module !== 'undefined' && module.exports && typeof require !== 'undefined')
  ? require('./common.js') : globalThis.__HktNetCommon;
const { Net, LoginServer, SessionRegistry, mulberry32, fnv1a, DEFAULTS } = __c;

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

const __part = { Orchestrator };
if (typeof module !== 'undefined' && module.exports) module.exports = __part;
if (typeof globalThis !== 'undefined') (globalThis.__HktNetParts = globalThis.__HktNetParts || {}).orchestrator = __part;
