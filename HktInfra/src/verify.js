// HktInfra step-0228 — 헤드리스 검증 (월드 영속 fsync durable barrier·worldFsync/worldRecoverDurable)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 가설 = `worldfsync`.
//   더한 한 조각: worldFsync→durableSeq=jseq(디스크 확정 프런티어), worldRecoverDurable→seq≤durableSeq 만 replay(fsync 이후 tail 미보장). 미주입 → 0227 비트 동일(reg). 3차 고도화 월드영속 #2.
//   검증: ⒜ `reg`(키트). ⒝ `worldfsync`(가설) — 3 append→fsync→2 append→recoverDurable 은 3개만, full replay 는 5개.
'use strict';
const NET = require('./net-core.js');
const NETPREV = require('../baseline/net-core.js');
const makeVerifyKit = require('../engine/verify-kit.js');

const SEEDS = [42, 7, 1234, 99, 2026];
const DEATH = 40; const LEASE = 3; const RESTART_AT = 60; const SNAP_N = 6; const CHAT_SNAP_N = 5; const JLOSS = 0.3;
const kit = makeVerifyKit({ NET, NETPREV, SEEDS, DEATH, LEASE, RESTART_AT, SNAP_N, CHAT_SNAP_N, JLOSS });

const { run } = NET;
const { check, pad } = kit.helpers;

const APP = (at, intent) => ({ at, op: { type: 'worldAppend', intent } });
const FSYNC = (at) => ({ at, op: { type: 'worldFsync' } });
// e1·e2·e3 append → fsync(durableSeq 3) → e4·e5 append(미fsync) → recoverDurable=3개만·full replay=5개.
const OPS = [
  APP(1, { e: 'e1', kind: 'move', to: 1 }), APP(2, { e: 'e2', kind: 'move', to: 2 }), APP(3, { e: 'e3', kind: 'move', to: 3 }),
  FSYNC(4),
  APP(5, { e: 'e4', kind: 'move', to: 4 }), APP(6, { e: 'e5', kind: 'move', to: 5 }),
];
const BASE = { clients: 6, moves: 20, radius: 4, grid: 16, zones: 2, bus: true, worldLog: true, worldOps: OPS };

function worldfsync(seeds) {
  console.log('== worldfsync: 월드 영속 fsync durable barrier(worldFsync/worldRecoverDurable) — durableSeq 워터마크 = fsync 로 디스크 확정된 최대 seq(0227 flush=페이지캐시 적층, fsync=물리 확정 구분). recoverDurable 은 seq≤durableSeq 만 replay(fsync 이후 tail 은 crash 시 미보장). durability 의 *진짜* 경계. 3차 고도화 월드영속 #2. ==');
  console.log('seed   | durSeq | dur복구 | full복구 | e4(미fsync) | 판정');
  for (const seed of seeds) {
    const r = run({ seed, ticks: 8, ...BASE });
    const w = r.worldlog;
    w._replayDurable();                              // seq≤durableSeq(=3) 만 — crash 후 진짜 복구.
    const durCount = [...['e1', 'e2', 'e3', 'e4', 'e5']].filter(e => w.stateOf(e)).length;
    const e4durable = !!w.stateOf('e4');
    w.replay();                                      // full(전체 로그) — 5개.
    const fullCount = [...['e1', 'e2', 'e3', 'e4', 'e5']].filter(e => w.stateOf(e)).length;
    // fsync 가 seq 3 까지 확정 → recoverDurable 3개(e1~e3)·e4/e5 미보장 / full replay 5개.
    const ok = check(w.durableSeq === 3 && durCount === 3 && !e4durable && fullCount === 5,
      `seed ${seed}: fsync 위반 (durSeq ${w.durableSeq}·dur ${durCount}·full ${fullCount}·e4 ${e4durable})`);
    console.log(`${pad(seed, 6)} | ${pad(w.durableSeq, 6)} | ${pad(durCount, 7)} | ${pad(fullCount, 8)} | ${pad(e4durable ? 'durable' : 'lost', 11)} | ${ok ? 'OK' : 'FAIL'}`);
  }
  console.log('  → fsync 가 seq 3 까지 디스크 확정(durableSeq 3)하면 crash 후 진짜 복구(recoverDurable)는 e1~e3 3개만 — fsync 이후 append 한 e4·e5 는 미보장(crash 시 소실 가능). full replay(전체 로그)는 5개를 본다. flush(0227·페이지캐시)와 fsync(0228·물리 확정)의 구분 = durability 의 진짜 경계. 월드영속 3차 고도화 #2.');
}

kit.MODES['worldfsync'] = worldfsync;
kit.ORDER.splice(1, 0, 'worldfsync');

(async () => { process.exit(await kit.cli(process.argv)); })();
