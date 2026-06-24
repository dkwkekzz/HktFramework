// HktInfra step-0206 — 헤드리스 검증 (캐시 read-through·cacheGet·miss→소스 채움)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 가설 = `cachereadthrough`.
//   더한 한 조각: cacheGet → hit 면 즉답·miss 면 소스(backing)서 읽어 캐시 채운 뒤 답(다음 hit). DB 직행 흡수. cacheGet 미주입 → 0205 비트 동일(reg).
//   검증: ⒜ `reg`(키트) — 0205 비트 동일. ⒝ `cachereadthrough`(가설) — get 4(hit·miss-fill·refill-hit·absent-miss) → hits 2·misses 2·소스값 캐시 채움.
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
const GET = (at, key) => ({ at, from: 'gateway', op: { type: 'cacheGet', key } });
// 시나리오: session 을 캐시에 set → get(hit) · price:gem get(miss→소스 채움) · price:gem 재get(hit) · absent get(miss·소스도 없음).
const OPS = [
  SET(2, 'session:h1', 'gw1'),
  GET(3, 'session:h1'),     // hit(캐시에 있음).
  GET(4, 'price:gem'),      // miss → 소스 'price:gem'=50 으로 채움.
  GET(5, 'price:gem'),      // hit(read-through 로 채워짐).
  GET(6, 'absent:z'),       // miss → 소스에도 없음 → undefined.
];
const BASE = { clients: 6, moves: 20, radius: 4, grid: 16, zones: 2, bus: true, cacheService: true, cacheSource: { 'price:gem': 50 }, cacheOps: OPS };

function cachereadthrough(seeds) {
  console.log('== cachereadthrough: 캐시 read-through — cacheGet miss 시 소스(backing DB)서 읽어 캐시 채운 뒤 답(다음 get 은 hit). DB 직행을 캐시가 흡수. ==');
  console.log('seed   | getsRx | hits | misses | size | last(absent) | 판정');
  for (const seed of seeds) {
    const r = run({ seed, ticks: 8, ...BASE });
    const c = r.cache, last = c._lastGet;
    // hit: session, price(refill) = 2. miss: price(첫), absent = 2. store: session+price(채워짐) = size 2(absent 는 소스 없어 미채움).
    const ok = check(c.getsRx === 4 && c.hits === 2 && c.misses === 2 && c.size() === 2 && c.get('price:gem') === 50 &&
      last && last.key === 'absent:z' && last.value === undefined && last.hit === false,
      `seed ${seed}: read-through 위반 (rx ${c.getsRx}·hits ${c.hits}·misses ${c.misses}·size ${c.size()})`);
    console.log(`${pad(seed, 6)} | ${pad(c.getsRx, 6)} | ${pad(c.hits, 4)} | ${pad(c.misses, 6)} | ${pad(c.size(), 4)} | ${pad(last ? last.key + '=' + last.value : '-', 12)} | ${ok ? 'OK' : 'FAIL'}`);
  }
  console.log('  → cacheGet: hit 는 캐시서 즉답(DB 0), miss 는 소스서 읽어 *캐시 채운 뒤* 답(price:gem 첫 get miss→fill, 재get hit). 소스에도 없는 absent 는 undefined. read-through 가 매 조회의 DB 직행을 흡수(첫 miss 만 소스 1홉). 캐시 박스 기본 통신 완비(set 0205 + get/read-through 0206).');
}

kit.MODES['cachereadthrough'] = cachereadthrough;
kit.ORDER.splice(1, 0, 'cachereadthrough');

(async () => { process.exit(await kit.cli(process.argv)); })();
