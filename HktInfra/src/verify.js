// HktInfra step-0205 — 헤드리스 검증 (캐시 박스 분리·set/get 기본·cacheService/cacheSet)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 가설 = `cacheset`.
//   더한 한 조각: CacheStore 박스 — 핫 데이터 1홉 캐시(cacheSet→store·같은 key 덮어씀·get hit). DB 직행 대체(SPINE 계층6). cacheService OFF → 박스 0 → 0204 비트 동일(reg). read-through miss 는 0206.
//   검증: ⒜ `reg`(키트) — 0204 비트 동일. ⒝ `cacheset`(가설) — set 4(session/inv/price + session 덮어씀) → size 3·get 최신값·sets 4.
'use strict';
const NET = require('./net-core.js');
const NETPREV = require('../baseline/net-core.js');
const makeVerifyKit = require('../engine/verify-kit.js');

const SEEDS = [42, 7, 1234, 99, 2026];
const DEATH = 40; const LEASE = 3; const RESTART_AT = 60; const SNAP_N = 6; const CHAT_SNAP_N = 5; const JLOSS = 0.3;
const kit = makeVerifyKit({ NET, NETPREV, SEEDS, DEATH, LEASE, RESTART_AT, SNAP_N, CHAT_SNAP_N, JLOSS });

const { run } = NET;
const { check, pad } = kit.helpers;

const SET = (at, key, value) => ({ at, op: { type: 'cacheSet', key, value } });
// 시나리오: 핫 데이터 3종 set + session 덮어씀(최신 값).
const OPS = [
  SET(2, 'session:h1', 'gw1'), SET(3, 'inv:h1', 5), SET(4, 'price:sword', 100),
  SET(5, 'session:h1', 'gw2'),   // 덮어씀 → 최신 gw2.
];
const BASE = { clients: 6, moves: 20, radius: 4, grid: 16, zones: 2, bus: true, cacheService: true, cacheOps: OPS };

function cacheset(seeds) {
  console.log('== cacheset: 캐시 박스 분리 — set/get 기본. 핫 데이터(세션·가방·시세)를 1홉 캐시에 쓰고 읽는다(DB 직행 대체·같은 key 덮어씀). 존 tick 밖. ==');
  console.log('seed   | size | session:h1 | inv:h1 | price:sword | sets | 판정');
  for (const seed of seeds) {
    const r = run({ seed, ticks: 8, ...BASE });
    const size = r.cache.size();
    const s = r.cache.get('session:h1'), iv = r.cache.get('inv:h1'), pr = r.cache.get('price:sword');
    const ok = check(size === 3 && s === 'gw2' && iv === 5 && pr === 100 && r.cache.sets === 4,
      `seed ${seed}: 캐시 위반 (size ${size}·session ${s}·sets ${r.cache.sets})`);
    console.log(`${pad(seed, 6)} | ${pad(size, 4)} | ${pad(s || '-', 10)} | ${pad(iv, 6)} | ${pad(pr, 11)} | ${pad(r.cache.sets, 4)} | ${ok ? 'OK' : 'FAIL'}`);
  }
  console.log('  → CacheStore 가 핫 데이터를 1홉에 답한다(set 4·session 덮어씀 → size 3·최신 gw2). DB 직행 대체(매 조회가 디스크 안 때림·Redis 의 더미판). 캐시 박스 기본 통신 — read-through(miss→소스)는 0206.');
}

kit.MODES['cacheset'] = cacheset;
kit.ORDER.splice(1, 0, 'cacheset');

(async () => { process.exit(await kit.cli(process.argv)); })();
