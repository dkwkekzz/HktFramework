// HktInfra step-0226 — 헤드리스 검증 (캐시 recency touch·cacheLruTouch·진짜 LRU)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 가설 = `cachetouch`.
//   더한 한 조각: cacheLruTouch{on} → get hit 시 recency(setAt) 갱신(진짜 LRU·핫 키 생존). OFF 면 0225 비트 동일(reg). 3차 고도화 캐시 #2.
//   검증: ⒜ `reg`(키트). ⒝ `cachetouch`(가설) — touch ON·cap 2·k1·k2 set·get k1(touch)·k3 set → k2 회수(k1 생존, 0225 와 반대).
'use strict';
const NET = require('./net-core.js');
const NETPREV = require('../baseline/net-core.js');
const makeVerifyKit = require('../engine/verify-kit.js');

const SEEDS = [42, 7, 1234, 99, 2026];
const DEATH = 40; const LEASE = 3; const RESTART_AT = 60; const SNAP_N = 6; const CHAT_SNAP_N = 5; const JLOSS = 0.3;
const kit = makeVerifyKit({ NET, NETPREV, SEEDS, DEATH, LEASE, RESTART_AT, SNAP_N, CHAT_SNAP_N, JLOSS });

const { run } = NET;
const { check, pad } = kit.helpers;

const TOUCH = (at, on) => ({ at, op: { type: 'cacheLruTouch', on } });
const CAP = (at, cap) => ({ at, op: { type: 'cacheCapacity', cap } });
const SET = (at, key, value) => ({ at, op: { type: 'cacheSet', key, value } });
const GET = (at, key) => ({ at, op: { type: 'cacheGet', key } });
// touch ON·cap 2 → k1·k2 set → get k1(recency 갱신) → k3 set → 가장 오래된 k2 회수(k1 생존·0225 면 k1 회수됐을 것).
const OPS = [
  TOUCH(1, true), CAP(2, 2),
  SET(3, 'k1', 'v1'), SET(4, 'k2', 'v2'),
  GET(5, 'k1'),
  SET(6, 'k3', 'v3'),
];
const BASE = { clients: 6, moves: 20, radius: 4, grid: 16, zones: 2, bus: true, cacheService: true, cacheOps: OPS };

function cachetouch(seeds) {
  console.log('== cachetouch: 캐시 recency touch(cacheLruTouch) — lruTouch ON 이면 get *hit* 시 recency(setAt)를 now 로 갱신 → 자주 읽는 핫 키가 회수에서 살아남는다(진짜 LRU = set+get 둘 다 recency). 0225 는 set-시각만(FIFO 에 가까움). get k1 후 k3 가 들어오면 0225 면 k1, 0226(touch) 면 k2 가 회수된다. 3차 고도화 캐시 #2. ==');
  console.log('seed   | k1   | k2   | k3   | touch | 판정');
  for (const seed of seeds) {
    const r = run({ seed, ticks: 8, ...BASE });
    const c = r.cache;
    // touch ON: get k1 후 k3 set 시 가장 오래된 k2 회수 → k1 생존(0225 면 k1 이 회수됐을 것·진짜 LRU 증명)·touches 1·capEvicted 1.
    const ok = check(c.has('k1') && !c.has('k2') && c.has('k3') && c.touches === 1 && c.capEvicted === 1,
      `seed ${seed}: touch LRU 위반 (k1 ${c.has('k1')}·k2 ${c.has('k2')}·touches ${c.touches})`);
    console.log(`${pad(seed, 6)} | ${pad(c.has('k1') ? 'live' : 'evic', 4)} | ${pad(c.has('k2') ? 'live' : 'evic', 4)} | ${pad(c.has('k3') ? 'live' : '-', 4)} | ${pad(c.touches, 5)} | ${ok ? 'OK' : 'FAIL'}`);
  }
  console.log('  → touch ON 에서 k1 을 한 번 읽고(touches 1) k3 를 넣으면 회수되는 건 k2(가장 오래 *안 쓴* 키)이고 k1 은 생존한다 — 0225(set-시각만) 라면 가장 먼저 set 된 k1 이 회수됐을 것. get 도 recency 에 반영하는 진짜 LRU 로, 읽기 트래픽 많은 핫 키를 캐시가 지킨다. 캐시 3차 고도화 #2.');
}

kit.MODES['cachetouch'] = cachetouch;
kit.ORDER.splice(1, 0, 'cachetouch');

(async () => { process.exit(await kit.cli(process.argv)); })();
