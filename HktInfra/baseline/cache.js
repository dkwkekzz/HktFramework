'use strict';
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
    this.net = null; this.addr = null;   // net.register 가 주입(send 경로).
  }
  // 캐시 쓰기(step-0205·write-through 기본) — key→value 저장(같은 key 재-set 은 덮어씀·최신 값). 게이트웨이/서비스가 핫 데이터를 채운다.
  _set(key, value) { this.store.set(key, value); }
  onMsg(m) {
    const p = m.payload;
    // set 요청(cacheSet) — {key, value} → 캐시에 씀. 미래엔 backing store 동시 기록(write-through·0206~). 지금은 기본 통신만.
    if (p.type === 'cacheSet') { this._set(p.key, p.value); this.sets++; return; }
  }
  // 질의 인터페이스 — 핫 데이터 읽기(캐시 hit). miss 시 read-through(소스 조회)는 0206. 검증·게이트웨이가 쓴다.
  get(key) { return this.store.has(key) ? this.store.get(key) : undefined; }
  has(key) { return this.store.has(key); }
  size() { return this.store.size; }
}

const __part = { CacheStore };
if (typeof module !== 'undefined' && module.exports) module.exports = __part;
if (typeof globalThis !== 'undefined') (globalThis.__HktNetParts = globalThis.__HktNetParts || {}).cache = __part;
