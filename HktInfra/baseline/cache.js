'use strict';
// step-0211 — 캐시 TTL 만료(cacheExpire): set 시 setAt 기록 → setAt+ttl≤now 인 키 회수(스윕). 휘발 캐시가 stale 핫 데이터를 영영 안 들고 있게(메모리 유계·Redis TTL 의 더미판). cacheExpire 미수신이면 0210 비트 동일(reg 0). 2차 고도화(캐시 박스 #1).
// step-0206 — 캐시 read-through(cacheGet): miss 시 소스(backing)서 읽어 캐시를 채운 뒤 답한다(다음 get 은 hit). DB 직행을 캐시가 흡수. cacheGet 미수신이면 0205 비트 동일(reg 0). 캐시 박스 기본 통신 완비.
// step-0205 — 캐시 박스 분리: set/get 기본(cacheService·cacheSet). 핫 데이터(세션·가방·시세)를 1홉으로 읽고 쓰는 캐시 계층. cacheService OFF 면 박스 0 = 0204 비트 동일(reg 0).
// dual-mode: Node require / 브라우저는 common.js 선행 로드(전역 __HktNetCommon).
const __c = (typeof module !== 'undefined' && module.exports && typeof require !== 'undefined')
  ? require('./common.js') : globalThis.__HktNetCommon;
const { Net, LoginServer, SessionRegistry, mulberry32, fnv1a, DEFAULTS } = __c;

// ── [데이터] CacheStore — 핫 데이터(세션·가방·시세)의 캐시 계층(SPINE 계층6 데이터). 매 조회가 DB 직행하지 않게 *한 홉*에 답한다. 존 tick 밖·*순수 반응형*(onTick 없음). ──
//   왜 분리(SPINE §2): 핫 데이터 반복 조회가 DB 동기 I/O 를 때리면 어떤 서버 tick 도 못 버틴다 → 휘발 캐시 계층(Redis 의 더미판). 1차 너비는 *기본 통신*만: set 으로 값을 넣고 get 으로 읽는 것까지(read-through miss 는 0206).
//   write-through 기본: cacheSet 은 캐시에 쓴다(미래엔 backing store 동시 기록 — 0206~). 같은 key 재-set = 덮어씀(최신 값).
class CacheStore {
  constructor(opts = {}) {
    this.store = new Map();    // key -> value (핫 데이터 캐시 — 휘발·DB 직행 대체).
    this.sets = 0;             // 처리한 cacheSet 수(계측·덮어쓰기 포함).
    this.source = new Map(Object.entries(opts.source || {}));   // backing store(소스 of truth·DB 의 더미판) — read-through miss 시 여기서 읽어 채운다(step-0206).
    this.getsRx = 0;           // 받은 cacheGet 수(step-0206·읽기 경로 계측). hits/misses 로 분해.
    this.hits = 0;             // 캐시 hit 수(store 에 있던 것·DB 안 때림).
    this.misses = 0;           // 캐시 miss 수(read-through 로 소스 조회).
    this._lastGet = null;      // 마지막 cacheReply 보관(검증용).
    this.setAt = new Map();    // key -> tick (set 된 시각·step-0211 TTL 만료 기준). store 와 1:1.
    this.expires = 0;          // 처리한 cacheExpire 스윕 수(step-0211·계측).
    this.evicted = 0;          // 만료로 회수된 키 누적 수(step-0211·setAt+ttl≤now).
    this.net = null; this.addr = null;   // net.register 가 주입(send 경로).
  }
  // 캐시 쓰기(step-0205·write-through 기본) — key→value 저장(같은 key 재-set 은 덮어씀·최신 값). 게이트웨이/서비스가 핫 데이터를 채운다. setAt 기록(step-0211·TTL 기준·재-set 은 시각 갱신).
  _set(key, value, now) { this.store.set(key, value); if (now != null) this.setAt.set(key, now); }
  onMsg(m) {
    const p = m.payload;
    const now = (m.tick != null) ? m.tick : 0;
    // set 요청(cacheSet) — {key, value} → 캐시에 씀. 미래엔 backing store 동시 기록(write-through·0206~). setAt 기록(step-0211·TTL 기준).
    if (p.type === 'cacheSet') { this._set(p.key, p.value, now); this.sets++; return; }
    // get 요청(cacheGet·step-0206·read-through) — {key} → hit 면 캐시서 즉답, miss 면 소스(backing)서 읽어 *채운 뒤* 답한다(다음 get 은 hit). DB 직행을 캐시가 흡수(매 조회 디스크 0). filled=miss 를 소스가 메웠나. cacheGet 미수신이면 미발화 = 0205 비트 동일.
    if (p.type === 'cacheGet') {
      this.getsRx++;
      let value, hit;
      if (this.store.has(p.key)) { value = this.store.get(p.key); hit = true; this.hits++; }
      else { this.misses++; hit = false; if (this.source.has(p.key)) { value = this.source.get(p.key); this.store.set(p.key, value); this.setAt.set(p.key, now); } }   // read-through: miss → 소스서 읽어 캐시 채움(다음번 hit·setAt 기록).
      this._lastGet = { key: p.key, value, hit, filled: !hit && this.store.has(p.key) };
      if (this.net && this.addr) { this.net.send(this.addr, m.from, { type: 'cacheReply', key: p.key, value, hit }); }
      return;
    }
    // TTL 만료 스윕(step-0211·cacheExpire) — {ttl} → setAt+ttl ≤ now 인 키를 회수(store·setAt 제거). 휘발 캐시가 stale 핫 데이터를 영영 안 들고 있게(메모리 유계·Redis TTL 더미판). cacheExpire 미수신이면 미발화 = 0210 비트 동일.
    if (p.type === 'cacheExpire') {
      for (const [key, t] of [...this.setAt]) if (t + p.ttl <= now) { this.store.delete(key); this.setAt.delete(key); this.evicted++; }
      this.expires++; return;
    }
  }
  // 질의 인터페이스 — 핫 데이터 읽기(캐시 hit). miss 시 read-through(소스 조회)는 0206. 검증·게이트웨이가 쓴다.
  get(key) { return this.store.has(key) ? this.store.get(key) : undefined; }
  has(key) { return this.store.has(key); }
  size() { return this.store.size; }
}

const __part = { CacheStore };
if (typeof module !== 'undefined' && module.exports) module.exports = __part;
if (typeof globalThis !== 'undefined') (globalThis.__HktNetParts = globalThis.__HktNetParts || {}).cache = __part;
