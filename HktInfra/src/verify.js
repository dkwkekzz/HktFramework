// HktInfra step-0260 — 헤드리스 검증 (캐시 정합 capstone·arc 0252~0260 닫기)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 모드 = `cachecohere`.
//   더한 한 조각: CacheStore.coherent() 읽기 accessor — 캐시 메커니즘 전체(write-through·bulk·negative·SETNX·SETEX·delete·prefix)가 섞여도 구조 불변(store↔setAt 1:1·store∩negatives=∅·keyTtl⊆store) 유지. 무효화가 keyTtl 도 정리. 읽기·미수신 → 0259 비트 동일(reg).
//   검증: ⒜ `reg`(키트·비트 동일). ⒝ `cachecohere`(가설) — 혼합 시퀀스 매 단계 coherent()==true + 최종 값/소스 정합(a=1·c 제거·x negative·session:* 제거).
'use strict';
const NET = require('./net-core.js');
const NETPREV = require('../baseline/net-core.js');
const makeVerifyKit = require('../engine/verify-kit.js');

const SEEDS = [42, 7, 1234, 99, 2026];
const DEATH = 40; const LEASE = 3; const RESTART_AT = 60; const SNAP_N = 6; const CHAT_SNAP_N = 5; const JLOSS = 0.3;
const kit = makeVerifyKit({ NET, NETPREV, SEEDS, DEATH, LEASE, RESTART_AT, SNAP_N, CHAT_SNAP_N, JLOSS });

const { check, pad } = kit.helpers;
const { CacheStore } = NET;

function cachecohere(seeds) {
  console.log('== cachecohere (0260·캐시 정합 capstone·arc 0252~0260 닫기): 캐시 전 메커니즘(write-through·bulk·negative·SETNX·SETEX·delete·prefix)이 섞인 혼합 시퀀스 매 단계 coherent()(store↔setAt 1:1·store∩negatives=∅·keyTtl⊆store) 유지 + 최종 값/소스 정합(a=1·c 제거·x negative·session:* 제거). ==');
  console.log('seed   | 매단계 coherent | a값 | c존재 | x∈neg | session제거 | 판정');
  for (const seed of seeds) {
    const c = new CacheStore({ source: {} });
    let tick = 0;
    let allCoherent = true;
    const send = (type, extra) => { c.onMsg({ from: 'gw', tick: ++tick, payload: { type, ...extra } }); if (!c.coherent()) allCoherent = false; };
    send('cacheWriteThrough', { on: true });
    send('cacheNegative', { on: true });
    send('cacheSet', { key: 'a', value: '1' });          // 캐시+소스 1
    send('cacheSetEx', { key: 'b', value: '2', ttl: 2 }); // per-key TTL
    send('cacheAdd', { key: 'c', value: '3' });           // SETNX added
    send('cacheAdd', { key: 'a', value: '99' });          // not added(a 유지 1)
    send('cacheGet', { key: 'x' });                        // miss·소스없음 → negative
    send('cacheGet', { key: 'x' });                        // negHit
    send('cacheInvalidate', { key: 'b' });                 // b 캐시 사본 끊기(+keyTtl 정리)
    send('cacheGet', { key: 'a' });                        // hit a=1
    send('cacheDelete', { key: 'c' });                     // c 캐시+소스 제거
    send('cacheSet', { key: 'session:1', value: 's1' });
    send('cacheSet', { key: 'session:2', value: 's2' });
    send('cacheDeletePrefix', { prefix: 'session:' });     // session:* 제거
    const aVal = c.get('a'), cExist = c.has('c'), xNeg = c.negatives.has('x');
    const sessGone = !c.has('session:1') && !c.has('session:2');
    const finalCoherent = c.coherent();
    const ok = check(allCoherent && finalCoherent && aVal === '1' && cExist === false && xNeg === true && sessGone === true && c.source.get('a') === '1' && !c.source.has('c'),
      `seed ${seed}: 정합 위반 (coherent ${allCoherent}/${finalCoherent}·a ${aVal}·c ${cExist}·xNeg ${xNeg}·sess ${sessGone}·src.a ${c.source.get('a')})`);
    console.log(`${pad(seed, 6)} | ${pad(String(allCoherent), 14)} | ${pad(aVal || '-', 3)} | ${pad(String(cExist), 5)} | ${pad(String(xNeg), 5)} | ${pad(String(sessGone), 11)} | ${ok ? 'OK' : 'FAIL'}`);
  }
}

kit.MODES['cachecohere'] = cachecohere;
kit.ORDER.splice(1, 0, 'cachecohere');

(async () => { process.exit(await kit.cli(process.argv)); })();
