// HktInfra step-0255 — 헤드리스 검증 (캐시 put-if-absent·SETNX)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 모드 = `cacheadd`.
//   더한 한 조각: CacheStore.cacheAdd{key,value} — 키가 없을 때만 쓰고 added=true·있으면 무변경 added=false(SETNX·first-writer-wins·분산 락 primitive). 새 메시지 타입·미수신 → 0254 비트 동일(reg).
//   검증: ⒜ `reg`(키트·비트 동일). ⒝ `cacheadd`(가설) — add k=v1(없음)→added true·store=v1. add k=v2(있음)→added false·store 여전히 v1(최초-기록-승).
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

function cacheadd(seeds) {
  console.log('== cacheadd (0255·캐시 #4): put-if-absent(SETNX) — cacheAdd{key,value} 가 키 없을 때만 쓰고 added=true, 이미 있으면 무변경·added=false(최초-기록-승·분산 락/유일 점유 primitive). add k=v1(없음)→added true·store=v1. add k=v2(있음)→added false·store 여전히 v1. ==');
  console.log('seed   | 1차 added | 2차 added | 최종 store | 판정');
  for (const seed of seeds) {
    const c = new CacheStore({ source: {} });
    c.onMsg(M('cacheAdd', { key: 'k', value: 'v1' }));
    const a1 = (c._lastAdd || {}).added;
    c.onMsg(M('cacheAdd', { key: 'k', value: 'v2' }));
    const a2 = (c._lastAdd || {}).added;
    const finalV = c.get('k');
    const ok = check(a1 === true && a2 === false && finalV === 'v1',
      `seed ${seed}: SETNX 위반 (a1 ${a1}·a2 ${a2}·store ${finalV})`);
    console.log(`${pad(seed, 6)} | ${pad(String(a1), 9)} | ${pad(String(a2), 9)} | ${pad(finalV || '-', 10)} | ${ok ? 'OK' : 'FAIL'}`);
  }
}

kit.MODES['cacheadd'] = cacheadd;
kit.ORDER.splice(1, 0, 'cacheadd');

(async () => { process.exit(await kit.cli(process.argv)); })();
