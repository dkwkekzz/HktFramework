// HktInfra step-0258 — 헤드리스 검증 (캐시 stats 관측·INFO)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 모드 = `cachestats`.
//   더한 한 조각: CacheStore.cacheStats{} → cacheStatsReply{stats}(hit/miss/hitRate/size…) + hitRate()·stats() 읽기 accessor(순수 읽기). 새 메시지 타입·미수신 → 0257 비트 동일(reg).
//   검증: ⒜ `reg`(키트·비트 동일). ⒝ `cachestats`(가설) — set k=v·get k(hit)·get k(hit)·get x(miss) → stats: hits 2·misses 1·hitRate 2/3·size 1.
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

function cachestats(seeds) {
  console.log('== cachestats (0258·캐시 #7): stats 관측(INFO) — cacheStats{} → cacheStatsReply{hits,misses,hitRate,size…}(운영 대시보드 폴링). set k=v·get k(hit)·get k(hit)·get x(miss·소스없음) → hits 2·misses 1·hitRate 2/3·size 1. ==');
  console.log('seed   | hits | misses | hitRate | size | 판정');
  for (const seed of seeds) {
    const c = new CacheStore({ source: {} });
    c.onMsg(M('cacheSet', { key: 'k', value: 'v' }));
    c.onMsg(M('cacheGet', { key: 'k' }));   // hit
    c.onMsg(M('cacheGet', { key: 'k' }));   // hit
    c.onMsg(M('cacheGet', { key: 'x' }));   // miss
    c.onMsg(M('cacheStats', {}));
    const s = c._lastStats || {};
    const ok = check(s.hits === 2 && s.misses === 1 && Math.abs(s.hitRate - 2 / 3) < 1e-9 && s.size === 1,
      `seed ${seed}: stats 위반 (hits ${s.hits}·misses ${s.misses}·hitRate ${s.hitRate}·size ${s.size})`);
    console.log(`${pad(seed, 6)} | ${pad(s.hits, 4)} | ${pad(s.misses, 6)} | ${pad((s.hitRate || 0).toFixed(3), 7)} | ${pad(s.size, 4)} | ${ok ? 'OK' : 'FAIL'}`);
  }
}

kit.MODES['cachestats'] = cachestats;
kit.ORDER.splice(1, 0, 'cachestats');

(async () => { process.exit(await kit.cli(process.argv)); })();
