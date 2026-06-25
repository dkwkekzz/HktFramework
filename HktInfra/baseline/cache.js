'use strict';
// step-0253 — 캐시 bulk get(cacheMget): {keys[]} 한 요청에 여러 키를 read-through 일괄 조회 → cacheMReply{values[]} 한 회신(라운드트립 N→1·플레이어 N명 핫데이터 배치 페치). 각 키는 cacheGet(0206)과 동일 hit/miss/read-through·setAt·lruTouch 적용. cacheMget 미수신이면 미발화 = 0252 비트 동일(reg 0·새 메시지 타입). 4차 고도화(캐시 박스 #2).
// step-0252 — 캐시 write-through 소스 정합(cacheWriteThrough): writeThrough ON 이면 cacheSet 이 캐시(store) 뿐 아니라 backing source(SSOT 더미·DB)에도 동시 기록 → 소스가 캐시와 정합. 그래서 무효화(0212) 후 read-through(0206)가 *최신* 값을 재적재(OFF 면 소스에 안 써 stale 값 재적재). writeThrough 토글({on}·cacheLruTouch 0226 동형). 미설정이면 writeThrough=false → 소스 무변경 = 0226 비트 동일(reg 0). 4차 고도화(캐시 박스 #1).
// step-0226 — 캐시 recency touch(cacheLruTouch): lruTouch ON 이면 get *hit* 시 recency(setAt)를 now 로 갱신 → 자주 읽는 핫 키가 회수에서 살아남는다(진짜 LRU = set+get 둘 다 recency·0225 는 set-시각만이라 FIFO 에 가까웠다). lruTouch OFF(미설정)면 get 이 recency 미갱신 = 0225 비트 동일(reg 0). 3차 고도화(캐시 박스 #2).
// step-0225 — 캐시 용량 LRU 회수(cacheCapacity): 캐시 키 수 상한 설정({cap}). set 으로 store.size>cap 이 되면 가장 오래된(recency=setAt 최소) 키부터 회수(개수 유계·Redis maxmemory-policy allkeys-lru 더미판). TTL(0211)이 시간 유계라면 이건 *개수* 유계. capacity=∞(미설정)면 회수 0 = 0224 비트 동일(reg 0). 3차 고도화(캐시 박스 #1).
// step-0212 — 캐시 무효화(cacheInvalidate): 소스(SSOT)가 바뀌면 캐시 키를 무효화(store/setAt 제거) → 다음 get 은 miss → read-through 로 새 값 재적재. stale 사본을 즉시 끊는다(write 시 캐시 일관성). cacheInvalidate 미수신이면 0211 비트 동일(reg 0). 2차 고도화(캐시 박스 #2).
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
    this.invalidations = 0;    // 처리한 cacheInvalidate 수(step-0212·소스 변경 통지·없는 키 멱등 포함).
    this.invalidated = 0;      // 실제 무효화된 키 누적 수(step-0212·store 에 있던 것만).
    this.capacity = Infinity;  // 캐시 키 수 상한(step-0225·cacheCapacity 로 설정·미설정이면 ∞=무제한=0224 거동).
    this.capEvicted = 0;       // 용량 초과로 LRU 회수된 키 누적 수(step-0225·setAt 최소부터).
    this.lruTouch = false;     // get hit 시 recency 갱신 여부(step-0226·cacheLruTouch·OFF 면 0225 거동=set-시각만).
    this.touches = 0;          // get hit 으로 recency 가 갱신된 누적 수(step-0226·lruTouch ON 일 때만).
    this.writeThrough = false; // cacheSet 시 backing source 동시 기록 여부(step-0252·cacheWriteThrough·OFF 면 0226 거동=캐시만 씀).
    this.writeThroughs = 0;    // write-through 로 소스에도 기록된 누적 set 수(step-0252·writeThrough ON 일 때만).
    this.net = null; this.addr = null;   // net.register 가 주입(send 경로).
  }
  // 캐시 쓰기(step-0205·write-through 기본) — key→value 저장(같은 key 재-set 은 덮어씀·최신 값). 게이트웨이/서비스가 핫 데이터를 채운다. setAt 기록(step-0211·TTL 기준·재-set 은 시각 갱신). step-0225: 쓰기 후 용량 초과면 LRU 회수.
  _set(key, value, now) { this.store.set(key, value); if (now != null) this.setAt.set(key, now); if (this.writeThrough) { this.source.set(key, value); this.writeThroughs++; } this._evictToCapacity(); }   // step-0252: write-through 면 backing source 도 동시 갱신(소스 정합 → 무효화 후 read-through 가 최신값).
  // 용량 LRU 회수(step-0225·cacheCapacity) — store.size 가 capacity 를 넘는 동안 가장 오래된(recency=setAt 최소·동률은 iteration 순) 키를 회수한다. capacity=∞ 면 루프 미진입 = 0224 비트 동일(회귀 0). 개수 유계(0211 시간 유계의 짝).
  _evictToCapacity() {
    while (this.store.size > this.capacity) {
      let victim = null, minT = Infinity;
      for (const [k, t] of this.setAt) if (t < minT) { minT = t; victim = k; }   // recency 최소(가장 오래 안 쓴 키).
      if (victim === null) break;
      this.store.delete(victim); this.setAt.delete(victim); this.capEvicted++;
    }
  }
  onMsg(m) {
    const p = m.payload;
    const now = (m.tick != null) ? m.tick : 0;
    // set 요청(cacheSet) — {key, value} → 캐시에 씀. 미래엔 backing store 동시 기록(write-through·0206~). setAt 기록(step-0211·TTL 기준).
    if (p.type === 'cacheSet') { this._set(p.key, p.value, now); this.sets++; return; }
    // get 요청(cacheGet·step-0206·read-through) — {key} → hit 면 캐시서 즉답, miss 면 소스(backing)서 읽어 *채운 뒤* 답한다(다음 get 은 hit). DB 직행을 캐시가 흡수(매 조회 디스크 0). filled=miss 를 소스가 메웠나. cacheGet 미수신이면 미발화 = 0205 비트 동일.
    if (p.type === 'cacheGet') {
      this.getsRx++;
      let value, hit;
      if (this.store.has(p.key)) { value = this.store.get(p.key); hit = true; this.hits++; if (this.lruTouch) { this.setAt.set(p.key, now); this.touches++; } }   // step-0226: hit 시 recency 갱신(진짜 LRU·OFF 면 미갱신=0225 동일).
      else { this.misses++; hit = false; if (this.source.has(p.key)) { value = this.source.get(p.key); this.store.set(p.key, value); this.setAt.set(p.key, now); } }   // read-through: miss → 소스서 읽어 캐시 채움(다음번 hit·setAt 기록).
      this._lastGet = { key: p.key, value, hit, filled: !hit && this.store.has(p.key) };
      if (this.net && this.addr) { this.net.send(this.addr, m.from, { type: 'cacheReply', key: p.key, value, hit }); }
      return;
    }
    // bulk get(step-0253·cacheMget·read-through) — {keys[]} → 각 키를 cacheGet(0206)과 동일 로직(hit/miss/read-through·setAt·lruTouch·hits/misses 계측)으로 일괄 조회 → cacheMReply{values[]} 한 회신(라운드트립 N→1). 미수신이면 미발화 = 0252 비트 동일.
    if (p.type === 'cacheMget') {
      const values = [];
      for (const key of (p.keys || [])) {
        this.getsRx++;
        let value;
        if (this.store.has(key)) { value = this.store.get(key); this.hits++; if (this.lruTouch) { this.setAt.set(key, now); this.touches++; } }
        else { this.misses++; if (this.source.has(key)) { value = this.source.get(key); this.store.set(key, value); this.setAt.set(key, now); } }
        values.push(value);
      }
      this._lastMget = { keys: p.keys || [], values };
      if (this.net && this.addr) this.net.send(this.addr, m.from, { type: 'cacheMReply', keys: p.keys || [], values });
      return;
    }
    // TTL 만료 스윕(step-0211·cacheExpire) — {ttl} → setAt+ttl ≤ now 인 키를 회수(store·setAt 제거). 휘발 캐시가 stale 핫 데이터를 영영 안 들고 있게(메모리 유계·Redis TTL 더미판). cacheExpire 미수신이면 미발화 = 0210 비트 동일.
    if (p.type === 'cacheExpire') {
      for (const [key, t] of [...this.setAt]) if (t + p.ttl <= now) { this.store.delete(key); this.setAt.delete(key); this.evicted++; }
      this.expires++; return;
    }
    // 무효화(step-0212·cacheInvalidate) — {key} → 소스(SSOT)가 바뀌었다는 통지에 캐시 사본을 즉시 끊는다(store/setAt 제거). 다음 get 은 miss → read-through 로 새 값 재적재(stale 사본 차단·write 시 캐시 일관성). 없는 키는 멱등 no-op. cacheInvalidate 미수신이면 미발화 = 0211 비트 동일.
    if (p.type === 'cacheInvalidate') {
      if (this.store.has(p.key)) { this.store.delete(p.key); this.setAt.delete(p.key); this.invalidated++; }
      this.invalidations++; return;
    }
    // 용량 설정(step-0225·cacheCapacity) — {cap} → 캐시 키 수 상한 설정 후 즉시 초과분 LRU 회수(개수 유계). 이후 set 마다 상한 유지. cacheCapacity 미수신이면 capacity=∞ = 0224 비트 동일.
    if (p.type === 'cacheCapacity') { this.capacity = (p.cap == null ? Infinity : p.cap); this._evictToCapacity(); return; }
    // recency touch 모드(step-0226·cacheLruTouch) — {on} → get hit 시 recency(setAt) 갱신 여부를 켠다(진짜 LRU). cacheLruTouch 미수신이면 lruTouch=false = 0225 비트 동일.
    if (p.type === 'cacheLruTouch') { this.lruTouch = !!p.on; return; }
    // write-through 모드(step-0252·cacheWriteThrough) — {on} → cacheSet 이 backing source 에도 동시 기록할지 켠다(소스 정합). cacheWriteThrough 미수신이면 writeThrough=false = 0226 비트 동일.
    if (p.type === 'cacheWriteThrough') { this.writeThrough = !!p.on; return; }
  }
  // 질의 인터페이스 — 핫 데이터 읽기(캐시 hit). miss 시 read-through(소스 조회)는 0206. 검증·게이트웨이가 쓴다.
  get(key) { return this.store.has(key) ? this.store.get(key) : undefined; }
  has(key) { return this.store.has(key); }
  size() { return this.store.size; }
}

const __part = { CacheStore };
if (typeof module !== 'undefined' && module.exports) module.exports = __part;
if (typeof globalThis !== 'undefined') (globalThis.__HktNetParts = globalThis.__HktNetParts || {}).cache = __part;
