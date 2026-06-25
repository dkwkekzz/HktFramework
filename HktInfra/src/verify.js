// HktInfra step-0253 — 헤드리스 검증 (캐시 bulk get)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 모드 = `cachemget`.
//   더한 한 조각: CacheStore.cacheMget{keys[]} — 여러 키를 read-through 일괄 조회 → cacheMReply{values[]} 한 회신(라운드트립 N→1). 새 메시지 타입·미수신 → 0252 비트 동일(reg).
//   검증: ⒜ `reg`(키트·비트 동일). ⒝ `cachemget`(가설) — set k1=v1,k2=v2·소스 k3=s3 → mget[k1,k2,k3] = [v1,v2,s3](store hit 2 + source read-through 1·미존재 키는 undefined).
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

function cachemget(seeds) {
  console.log('== cachemget (0253·캐시 #2): bulk get — cacheMget{keys[]} 한 요청에 여러 키를 read-through 일괄 조회 → cacheMReply{values[]} 한 회신(라운드트립 N→1). set k1=v1,k2=v2·소스 k3=s3·k4 없음 → mget[k1,k2,k3,k4] = [v1,v2,s3,undefined](store hit 2 + source read-through 1 + 미존재 1). ==');
  console.log('seed   | values            | hits | misses | 판정');
  for (const seed of seeds) {
    const c = new CacheStore({ source: { k3: 's3' } });
    c.onMsg(M('cacheSet', { key: 'k1', value: 'v1' }));
    c.onMsg(M('cacheSet', { key: 'k2', value: 'v2' }));
    c.onMsg(M('cacheMget', { keys: ['k1', 'k2', 'k3', 'k4'] }));
    const vs = (c._lastMget || {}).values || [];
    const ok = check(vs[0] === 'v1' && vs[1] === 'v2' && vs[2] === 's3' && vs[3] === undefined && c.hits === 2 && c.misses === 2,
      `seed ${seed}: bulk get 위반 (values ${JSON.stringify(vs)}·hits ${c.hits}·misses ${c.misses})`);
    console.log(`${pad(seed, 6)} | ${pad(JSON.stringify(vs), 17)} | ${pad(c.hits, 4)} | ${pad(c.misses, 6)} | ${ok ? 'OK' : 'FAIL'}`);
  }
}

kit.MODES['cachemget'] = cachemget;
kit.ORDER.splice(1, 0, 'cachemget');

(async () => { process.exit(await kit.cli(process.argv)); })();
