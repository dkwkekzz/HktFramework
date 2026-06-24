// HktInfra step-0252 — 헤드리스 검증 (캐시 write-through 소스 정합)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 모드 = `cachewt`.
//   더한 한 조각: CacheStore.cacheWriteThrough{on} 토글 — ON 이면 cacheSet 이 backing source 에도 동시 기록(소스 정합). 무효화(0212) 후 read-through(0206)가 *최신* 값 재적재. 미수신/OFF → 0226 비트 동일(reg).
//   검증: ⒜ `reg`(키트·비트 동일). ⒝ `cachewt`(가설) — writeThrough ON: set k=v2→invalidate→get k = v2(최신·소스 정합). OFF: 같은 시퀀스 → get k = v1(stale·소스 미갱신).
'use strict';
const NET = require('./net-core.js');
const NETPREV = require('../baseline/net-core.js');
const makeVerifyKit = require('../engine/verify-kit.js');

const SEEDS = [42, 7, 1234, 99, 2026];
const DEATH = 40; const LEASE = 3; const RESTART_AT = 60; const SNAP_N = 6; const CHAT_SNAP_N = 5; const JLOSS = 0.3;
const kit = makeVerifyKit({ NET, NETPREV, SEEDS, DEATH, LEASE, RESTART_AT, SNAP_N, CHAT_SNAP_N, JLOSS });

const { check, pad } = kit.helpers;
const { CacheStore } = NET;

// 캐시 박스를 직접 구성(소스에 k=v1)·메시지로 구동(net 없이 onMsg 로 set/invalidate/get).
function makeCache() { const c = new CacheStore({ source: { k: 'v1' } }); c.net = null; c.addr = 'cache'; return c; }
const M = (type, extra) => ({ from: 'gw', tick: 1, payload: { type, ...extra } });

function cachewt(seeds) {
  console.log('== cachewt (0252·캐시 #1): write-through 소스 정합 — writeThrough ON 이면 cacheSet 이 backing source 에도 동시 기록 → 무효화(0212) 후 read-through(0206)가 *최신* 값 재적재(OFF 면 소스 미갱신 → stale 재적재). ON: set k=v2→invalidate k→get k = v2. OFF: 같은 시퀀스 → get k = v1(stale). ==');
  console.log('seed   | WT get | noWT get | WT소스기록 | 판정');
  for (const seed of seeds) {
    // ON 경로
    const on = makeCache();
    on.onMsg(M('cacheWriteThrough', { on: true }));
    on.onMsg(M('cacheSet', { key: 'k', value: 'v2' }));   // 캐시+소스 둘 다 v2
    on.onMsg(M('cacheInvalidate', { key: 'k' }));         // 캐시 사본 끊기 → 다음 get 은 miss
    on.onMsg(M('cacheGet', { key: 'k' }));                // read-through: 소스(v2) 재적재
    const onVal = (on._lastGet || {}).value;
    // OFF 경로(대조군) — 같은 시퀀스, writeThrough 미설정.
    const off = makeCache();
    off.onMsg(M('cacheSet', { key: 'k', value: 'v2' }));  // 캐시만 v2(소스는 v1 유지)
    off.onMsg(M('cacheInvalidate', { key: 'k' }));
    off.onMsg(M('cacheGet', { key: 'k' }));               // read-through: 소스(stale v1) 재적재
    const offVal = (off._lastGet || {}).value;
    const ok = check(onVal === 'v2' && offVal === 'v1' && on.writeThroughs === 1 && off.writeThroughs === 0,
      `seed ${seed}: write-through 위반 (WT ${onVal}·noWT ${offVal}·wt수 ${on.writeThroughs}/${off.writeThroughs})`);
    console.log(`${pad(seed, 6)} | ${pad(onVal || '-', 6)} | ${pad(offVal || '-', 8)} | ${pad(on.writeThroughs, 10)} | ${ok ? 'OK' : 'FAIL'}`);
  }
}

kit.MODES['cachewt'] = cachewt;
kit.ORDER.splice(1, 0, 'cachewt');

(async () => { process.exit(await kit.cli(process.argv)); })();
