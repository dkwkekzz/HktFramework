// HktInfra step-0212 — 헤드리스 검증 (캐시 무효화·cacheInvalidate·write 시 캐시 일관성)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 가설 = `cacheinval`.
//   더한 한 조각: cacheInvalidate{key} → 소스(SSOT) 변경 통지에 캐시 사본을 끊는다(store/setAt 제거) → 다음 get miss → read-through 로 새 값 재적재. stale 사본 차단. cacheInvalidate 미주입 → 0211 비트 동일(reg). 2차 고도화 캐시 박스 #2.
//   검증: ⒜ `reg`(키트). ⒝ `cacheinval`(가설) — k1 stale set → invalidate(k1) → get(k1) miss → 소스 fresh 재적재.
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
const INVAL = (at, key) => ({ at, op: { type: 'cacheInvalidate', key } });
const GET = (at, key) => ({ at, op: { type: 'cacheGet', key } });
// 시나리오: k1 stale set(@2)·k2 set(@3) → invalidate k1(@5·소스가 바뀜) → get k1(@7) miss → 소스 fresh 재적재.
const OPS = [
  SET(2, 'k1', 'v1-stale'), SET(3, 'k2', 'v2'),
  INVAL(5, 'k1'),
  GET(7, 'k1'),
];
// 소스(backing SSOT)의 k1 은 fresh — invalidate 후 read-through 가 이 값을 다시 채운다.
const BASE = { clients: 6, moves: 20, radius: 4, grid: 16, zones: 2, bus: true, cacheService: true, cacheSource: { k1: 'v1-fresh' }, cacheOps: OPS };

function cacheinval(seeds) {
  console.log('== cacheinval: 캐시 무효화(cacheInvalidate) — 소스(SSOT) 변경 시 캐시 사본을 끊는다 → 다음 get miss → read-through 로 fresh 재적재(stale 사본 차단·write 시 일관성). 2차 고도화 캐시 박스 #2. ==');
  console.log('seed   | invalidated | k1 값(재적재) | k2 | misses | 판정');
  for (const seed of seeds) {
    const r = run({ seed, ticks: 10, ...BASE });
    const c = r.cache;
    const k1v = c.get('k1'), k2 = c.has('k2');
    // invalidate 가 stale 사본 제거(invalidated 1) → get(k1) miss → 소스 fresh('v1-fresh') 재적재. k2 무관 생존.
    const ok = check(c.invalidated === 1 && c.invalidations === 1 && k1v === 'v1-fresh' && k2 && c.misses >= 1,
      `seed ${seed}: 무효화 위반 (invalidated ${c.invalidated}·k1 ${k1v}·k2 ${k2}·misses ${c.misses})`);
    console.log(`${pad(seed, 6)} | ${pad(c.invalidated, 11)} | ${pad(k1v || '-', 13)} | ${pad(k2 ? 'live' : '-', 4)} | ${pad(c.misses, 6)} | ${ok ? 'OK' : 'FAIL'}`);
  }
  console.log('  → cacheInvalidate 가 stale 사본을 끊고(invalidated 1) 다음 get 이 miss→소스 fresh 재적재(k1=v1-fresh). write 경로가 캐시를 stale 로 안 남긴다(캐시 일관성 토대). 캐시 박스 2차 고도화 #2.');
}

kit.MODES['cacheinval'] = cacheinval;
kit.ORDER.splice(1, 0, 'cacheinval');

(async () => { process.exit(await kit.cli(process.argv)); })();
