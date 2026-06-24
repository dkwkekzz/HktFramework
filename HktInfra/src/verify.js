// HktInfra step-0211 — 헤드리스 검증 (캐시 TTL 만료·cacheExpire·휘발 캐시 메모리 유계)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 가설 = `cachettl`.
//   더한 한 조각: cacheExpire{ttl} → setAt+ttl≤now 인 캐시 키 회수(스윕). set 시 setAt 기록. stale 핫 데이터를 영영 안 들고 있게(메모리 유계·Redis TTL 더미판). cacheExpire 미주입 → 0210 비트 동일(reg). 2차 고도화 캐시 박스 #1.
//   검증: ⒜ `reg`(키트). ⒝ `cachettl`(가설) — k1(setAt2)·k2(setAt5) set → expire(ttl3)@7 → k1(2+3≤7) 회수·k2(5+3>7) 생존.
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
const EXPIRE = (at, ttl) => ({ at, op: { type: 'cacheExpire', ttl } });
// 시나리오: k1 set(@2)·k2 set(@5) → ttl3 만료 스윕@7: k1(setAt+3≤7) 회수·k2(setAt+3>7) 생존.
const OPS = [
  SET(2, 'k1', 'v1'), SET(5, 'k2', 'v2'),
  EXPIRE(7, 3),
];
const BASE = { clients: 6, moves: 20, radius: 4, grid: 16, zones: 2, bus: true, cacheService: true, cacheOps: OPS };

function cachettl(seeds) {
  console.log('== cachettl: 캐시 TTL 만료(cacheExpire) — setAt+ttl≤now 인 키 회수(stale 핫 데이터 영영 안 들고 있게·메모리 유계·Redis TTL 더미판). 2차 고도화 캐시 박스 #1. ==');
  console.log('seed   | size | k1 | k2 | evicted | 판정');
  for (const seed of seeds) {
    const r = run({ seed, ticks: 10, ...BASE });
    const c = r.cache;
    const k1 = c.has('k1'), k2 = c.has('k2');
    // k1 setAt(2)+ttl3=5 ≤ now → 회수. k2 setAt(5)+ttl3=8 > now → 생존. evicted 1·size 1.
    const ok = check(!k1 && k2 && c.evicted === 1 && c.size() === 1 && c.expires === 1,
      `seed ${seed}: TTL 위반 (size ${c.size()}·k1 ${k1}·k2 ${k2}·evicted ${c.evicted})`);
    console.log(`${pad(seed, 6)} | ${pad(c.size(), 4)} | ${pad(k1 ? 'live' : '(만료)', 6)} | ${pad(k2 ? 'live' : '-', 4)} | ${pad(c.evicted, 7)} | ${ok ? 'OK' : 'FAIL'}`);
  }
  console.log('  → cacheExpire 가 setAt+ttl≤now 인 키를 회수(k1 일찍 set → 만료, k2 늦게 set → 생존) → evicted 1·size 1. 휘발 캐시가 stale 핫 데이터를 영영 안 들고 있어 메모리가 유계(Redis TTL 토대). 캐시 박스 2차 고도화 #1.');
}

kit.MODES['cachettl'] = cachettl;
kit.ORDER.splice(1, 0, 'cachettl');

(async () => { process.exit(await kit.cli(process.argv)); })();
