// HktInfra step-0259 — 헤드리스 검증 (캐시 namespace 무효화·SCAN+DEL)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 모드 = `cacheprefix`.
//   더한 한 조각: CacheStore.cacheDeletePrefix{prefix} — prefix 로 시작하는 모든 키를 store(+writeThrough 면 source)서 제거(namespace 무효화·단일 delete 0257 의 패턴판). 새 메시지 타입·미수신 → 0258 비트 동일(reg).
//   검증: ⒜ `reg`(키트·비트 동일). ⒝ `cacheprefix`(가설) — set session:a, session:b, item:c → deletePrefix "session:" → session 2개 제거·item:c 생존·prefixDeleted 2.
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

function cacheprefix(seeds) {
  console.log('== cacheprefix (0259·캐시 #8): namespace 무효화(SCAN+DEL) — cacheDeletePrefix{prefix} 가 prefix 로 시작하는 모든 키 일괄 제거(한 유저 세션 전부·길드 해체 등). set session:a,session:b,item:c → deletePrefix "session:" → session 2개 제거·item:c 생존·prefixDeleted 2. ==');
  console.log('seed   | session:a | session:b | item:c | prefixDeleted | 판정');
  for (const seed of seeds) {
    const c = new CacheStore({ source: {} });
    c.onMsg(M('cacheSet', { key: 'session:a', value: 'A' }));
    c.onMsg(M('cacheSet', { key: 'session:b', value: 'B' }));
    c.onMsg(M('cacheSet', { key: 'item:c', value: 'C' }));
    c.onMsg(M('cacheDeletePrefix', { prefix: 'session:' }));
    const a = c.has('session:a'), b = c.has('session:b'), it = c.has('item:c');
    const ok = check(a === false && b === false && it === true && c.prefixDeleted === 2,
      `seed ${seed}: prefix 삭제 위반 (a ${a}·b ${b}·item ${it}·prefixDeleted ${c.prefixDeleted})`);
    console.log(`${pad(seed, 6)} | ${pad(String(a), 9)} | ${pad(String(b), 9)} | ${pad(String(it), 6)} | ${pad(c.prefixDeleted, 13)} | ${ok ? 'OK' : 'FAIL'}`);
  }
}

kit.MODES['cacheprefix'] = cacheprefix;
kit.ORDER.splice(1, 0, 'cacheprefix');

(async () => { process.exit(await kit.cli(process.argv)); })();
