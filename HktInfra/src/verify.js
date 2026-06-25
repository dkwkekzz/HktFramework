// HktInfra step-0257 — 헤드리스 검증 (캐시 explicit delete·DEL)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 모드 = `cachedel`.
//   더한 한 조각: CacheStore.cacheDelete{key} — store·setAt·keyTtl·negatives 제거 + writeThrough ON 이면 source(SSOT)에서도 제거(무효화와 달리 영구 삭제·read-through 재적재 없음). 새 메시지 타입·미수신 → 0256 비트 동일(reg).
//   검증: ⒜ `reg`(키트·비트 동일). ⒝ `cachedel`(가설) — WT ON: set k=v→delete k→get k = undefined(소스서도 제거). 대조 invalidate: set k2=v→invalidate→get = v(소스 유지·read-through 재적재).
'use strict';
const NET = require('./net-core.js');
const NETPREV = require('../baseline/net-core.js');
const makeVerifyKit = require('../engine/verify-kit.js');

const SEEDS = [42, 7, 1234, 99, 2026];
const DEATH = 40; const LEASE = 3; const RESTART_AT = 60; const SNAP_N = 6; const CHAT_SNAP_N = 5; const JLOSS = 0.3;
const kit = makeVerifyKit({ NET, NETPREV, SEEDS, DEATH, LEASE, RESTART_AT, SNAP_N, CHAT_SNAP_N, JLOSS });

const { check, pad } = kit.helpers;
const { CacheStore } = NET;
const M = (type, extra) => ({ from: 'gw', tick: 1, payload: { type, ...extra } });

function cachedel(seeds) {
  console.log('== cachedel (0257·캐시 #6): explicit delete(DEL) — cacheDelete{key} 가 캐시 + writeThrough 면 source(SSOT)서도 영구 제거(무효화는 캐시 사본만 끊고 소스 유지 → read-through 재적재). WT ON: set k=v→delete→get = undefined(소스서도 제거). 대조 invalidate k2: get = v(소스 유지). ==');
  console.log('seed   | delete 후 get | invalidate 후 get | deleted | 판정');
  for (const seed of seeds) {
    const c = new CacheStore({ source: {} });
    c.onMsg(M('cacheWriteThrough', { on: true }));
    c.onMsg(M('cacheSet', { key: 'k', value: 'v' }));     // 캐시+소스 v
    c.onMsg(M('cacheDelete', { key: 'k' }));              // 캐시+소스서 제거
    c.onMsg(M('cacheGet', { key: 'k' }));                 // miss·소스도 없음 → undefined
    const delGet = (c._lastGet || {}).value;
    // 대조군: invalidate 는 소스 유지 → read-through 재적재
    c.onMsg(M('cacheSet', { key: 'k2', value: 'v2' }));   // 캐시+소스 v2(WT)
    c.onMsg(M('cacheInvalidate', { key: 'k2' }));         // 캐시 사본만 끊음
    c.onMsg(M('cacheGet', { key: 'k2' }));                // miss → 소스(v2) 재적재
    const invGet = (c._lastGet || {}).value;
    const ok = check(delGet === undefined && invGet === 'v2' && c.deleted === 1,
      `seed ${seed}: delete 위반 (del ${delGet}·inv ${invGet}·deleted ${c.deleted})`);
    console.log(`${pad(seed, 6)} | ${pad(delGet === undefined ? 'undefined' : delGet, 13)} | ${pad(invGet || '-', 17)} | ${pad(c.deleted, 7)} | ${ok ? 'OK' : 'FAIL'}`);
  }
}

kit.MODES['cachedel'] = cachedel;
kit.ORDER.splice(1, 0, 'cachedel');

(async () => { process.exit(await kit.cli(process.argv)); })();
