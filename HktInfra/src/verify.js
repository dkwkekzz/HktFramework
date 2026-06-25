// HktInfra step-0256 — 헤드리스 검증 (캐시 per-key TTL·SETEX)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 모드 = `cachesetex`.
//   더한 한 조각: CacheStore.cacheSetEx{key,value,ttl} — 키별 만료 수명(keyTtl) 저장·cacheExpire 스윕이 per-key ttl 우선(없으면 글로벌). 차등 만료. keyTtl 비면 0255 비트 동일(reg).
//   검증: ⒜ `reg`(키트·비트 동일). ⒝ `cachesetex`(가설) — setEx k1 ttl=2@now1, set k2(글로벌)@now1 → expire{ttl:10}@now5: k1 만료(per-key 2)·k2 생존(글로벌 10).
'use strict';
const NET = require('./net-core.js');
const NETPREV = require('../baseline/net-core.js');
const makeVerifyKit = require('../engine/verify-kit.js');

const SEEDS = [42, 7, 1234, 99, 2026];
const DEATH = 40; const LEASE = 3; const RESTART_AT = 60; const SNAP_N = 6; const CHAT_SNAP_N = 5; const JLOSS = 0.3;
const kit = makeVerifyKit({ NET, NETPREV, SEEDS, DEATH, LEASE, RESTART_AT, SNAP_N, CHAT_SNAP_N, JLOSS });

const { check, pad } = kit.helpers;
const { CacheStore } = NET;
const Mt = (type, tick, extra) => ({ from: 'gw', tick, payload: { type, ...extra } });

function cachesetex(seeds) {
  console.log('== cachesetex (0256·캐시 #5): per-key TTL(SETEX) — cacheSetEx{key,value,ttl} 가 키별 만료 수명 저장·cacheExpire 스윕이 per-key ttl 우선(없으면 글로벌·차등 만료). setEx k1 ttl=2@now1·set k2(글로벌)@now1 → expire{ttl:10}@now5: k1 만료(1+2=3≤5)·k2 생존(1+10=11>5). ==');
  console.log('seed   | k1 존재 | k2 존재 | evicted | 판정');
  for (const seed of seeds) {
    const c = new CacheStore({ source: {} });
    c.onMsg(Mt('cacheSetEx', 1, { key: 'k1', value: 'v1', ttl: 2 }));   // per-key 짧은 수명
    c.onMsg(Mt('cacheSet', 1, { key: 'k2', value: 'v2' }));             // per-key 없음 → 글로벌 적용
    c.onMsg(Mt('cacheExpire', 5, { ttl: 10 }));                          // now5·글로벌 ttl 10
    const k1 = c.has('k1'), k2 = c.has('k2');
    const ok = check(k1 === false && k2 === true && c.evicted === 1,
      `seed ${seed}: per-key TTL 위반 (k1 ${k1}·k2 ${k2}·evicted ${c.evicted})`);
    console.log(`${pad(seed, 6)} | ${pad(String(k1), 7)} | ${pad(String(k2), 7)} | ${pad(c.evicted, 7)} | ${ok ? 'OK' : 'FAIL'}`);
  }
}

kit.MODES['cachesetex'] = cachesetex;
kit.ORDER.splice(1, 0, 'cachesetex');

(async () => { process.exit(await kit.cli(process.argv)); })();
