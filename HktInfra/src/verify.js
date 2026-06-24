// HktInfra step-0225 — 헤드리스 검증 (캐시 용량 LRU 회수·cacheCapacity)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 가설 = `cachecapacity`.
//   더한 한 조각: cacheCapacity{cap} → 캐시 키 수 상한. set 으로 size>cap 이면 가장 오래된(setAt 최소) 키 회수(개수 유계·allkeys-lru 더미판). cap=∞ 면 회수 0 = 0224 비트 동일(reg). 3차 고도화 캐시 #1.
//   검증: ⒜ `reg`(키트). ⒝ `cachecapacity`(가설) — cap 2 후 3키 set → 가장 오래된 k1 회수·size 2.
'use strict';
const NET = require('./net-core.js');
const NETPREV = require('../baseline/net-core.js');
const makeVerifyKit = require('../engine/verify-kit.js');

const SEEDS = [42, 7, 1234, 99, 2026];
const DEATH = 40; const LEASE = 3; const RESTART_AT = 60; const SNAP_N = 6; const CHAT_SNAP_N = 5; const JLOSS = 0.3;
const kit = makeVerifyKit({ NET, NETPREV, SEEDS, DEATH, LEASE, RESTART_AT, SNAP_N, CHAT_SNAP_N, JLOSS });

const { run } = NET;
const { check, pad } = kit.helpers;

const CAP = (at, cap) => ({ at, op: { type: 'cacheCapacity', cap } });
const SET = (at, key, value) => ({ at, op: { type: 'cacheSet', key, value } });
// cap 2 → k1·k2·k3 차례 set → k3 set 시 size 3>2 → 가장 오래된 k1 회수(store {k2,k3}).
const OPS = [
  CAP(1, 2),
  SET(2, 'k1', 'v1'), SET(3, 'k2', 'v2'), SET(4, 'k3', 'v3'),
];
const BASE = { clients: 6, moves: 20, radius: 4, grid: 16, zones: 2, bus: true, cacheService: true, cacheOps: OPS };

function cachecapacity(seeds) {
  console.log('== cachecapacity: 캐시 용량 LRU 회수(cacheCapacity) — 캐시 키 수 상한({cap}) 설정 후 set 으로 size>cap 이 되면 가장 오래된(recency=setAt 최소) 키부터 회수(개수 유계·Redis allkeys-lru 더미판). 0211 TTL 이 시간 유계라면 이건 *개수* 유계. 3차 고도화 캐시 #1. ==');
  console.log('seed   | size | k1   | k2   | k3   | evic | 판정');
  for (const seed of seeds) {
    const r = run({ seed, ticks: 8, ...BASE });
    const c = r.cache;
    // cap 2 → k3 set 시 가장 오래된 k1 회수: size 2·k1 없음·k2/k3 생존·capEvicted 1.
    const ok = check(c.size() === 2 && !c.has('k1') && c.has('k2') && c.has('k3') && c.capEvicted === 1,
      `seed ${seed}: capacity 위반 (size ${c.size()}·k1 ${c.has('k1')}·evic ${c.capEvicted})`);
    console.log(`${pad(seed, 6)} | ${pad(c.size(), 4)} | ${pad(c.has('k1') ? 'live' : 'evic', 4)} | ${pad(c.has('k2') ? 'live' : '-', 4)} | ${pad(c.has('k3') ? 'live' : '-', 4)} | ${pad(c.capEvicted, 4)} | ${ok ? 'OK' : 'FAIL'}`);
  }
  console.log('  → cap 2 캐시에 k1·k2·k3 을 넣으면 가장 오래된 k1 이 회수되고(capEvicted 1·size 2) 최근 k2·k3 만 남는다 — TTL(0211·시간 유계) 위에 *개수* 유계를 더해, 핫 키가 무한히 안 쌓이게(Redis maxmemory allkeys-lru 더미판). 캐시 3차 고도화 #1.');
}

kit.MODES['cachecapacity'] = cachecapacity;
kit.ORDER.splice(1, 0, 'cachecapacity');

(async () => { process.exit(await kit.cli(process.argv)); })();
