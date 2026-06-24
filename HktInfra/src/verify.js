// HktInfra step-0213 — 헤드리스 검증 (월드 영속 스냅샷 압축·worldSnapshot·무손실)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 가설 = `worldsnap`.
//   더한 한 조각: worldSnapshot → 투영을 스냅샷으로 굳히고 로그를 tail(seq>snapshotSeq)로 절단. replay = 스냅샷+tail = 전체-로그 replay 와 비트 동일(무손실 압축·로그 저장 유계). worldSnapshot 미주입 → 0212 비트 동일(reg). 2차 고도화 월드영속 #1.
//   검증: ⒜ `reg`(키트). ⒝ `worldsnap`(가설) — 압축 run(스냅샷 후 tail) 의 replay stateDigest == 전체 run replay stateDigest, journal tail < full.
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
const SNAP = (at) => ({ at, op: { type: 'worldSnapshot' } });
// intent: {e, kind:'move'|'pickup', to/item}. 5개 intent — 중간(스냅샷) 후 2개가 tail.
const INTENTS = [
  APP(2, { e: 'e1', kind: 'move', to: 'A' }),
  APP(3, { e: 'e1', kind: 'move', to: 'B' }),
  APP(4, { e: 'e2', kind: 'pickup', item: 'sword' }),
  APP(6, { e: 'e1', kind: 'move', to: 'C' }),
  APP(7, { e: 'e2', kind: 'pickup', item: 'shield' }),
];
const COMPRESSED = INTENTS.concat([SNAP(5)]);   // 5번째 intent 전(처음 3개 후) 스냅샷 → tail 2개.
const BASE = { clients: 6, moves: 20, radius: 4, grid: 16, zones: 2, bus: true, worldLog: true };

function worldsnap(seeds) {
  console.log('== worldsnap: 월드 영속 스냅샷 압축(worldSnapshot) — 투영을 스냅샷으로 굳히고 로그를 tail 로 절단. replay=스냅샷+tail == 전체-로그 replay(무손실·로그 저장 유계). 2차 고도화 월드영속 #1. ==');
  console.log('seed   | full len | tail len | full digest | snap digest | 판정');
  for (const seed of seeds) {
    const full = run({ seed, ticks: 10, ...BASE, worldOps: INTENTS });        // 스냅샷 없음(전체 로그).
    const comp = run({ seed, ticks: 10, ...BASE, worldOps: COMPRESSED });     // 스냅샷 후 tail.
    full.worldlog.replay(); comp.worldlog.replay();
    const fd = full.worldlog.stateDigest(), cd = comp.worldlog.stateDigest();
    const fl = full.worldlog.length(), cl = comp.worldlog.length();
    // 무손실: 압축 replay digest == 전체 replay digest. 절단: tail < full. 스냅샷 1회.
    const ok = check(fd === cd && cl < fl && comp.worldlog.snapshots === 1 && comp.worldlog.snapshotSeq === 3,
      `seed ${seed}: 스냅샷 위반 (full ${fd}/${fl}·comp ${cd}/${cl}·snaps ${comp.worldlog.snapshots})`);
    console.log(`${pad(seed, 6)} | ${pad(fl, 8)} | ${pad(cl, 8)} | ${pad(fd, 11)} | ${pad(cd, 11)} | ${ok ? 'OK' : 'FAIL'}`);
  }
  console.log('  → 스냅샷 후 tail(2) < 전체 로그(5)·압축 replay digest == 전체 replay digest(무손실). intent 로그가 무한히 안 자란다(저장 유계·event sourcing 스냅샷 토대). 월드영속 2차 고도화 #1.');
}

kit.MODES['worldsnap'] = worldsnap;
kit.ORDER.splice(1, 0, 'worldsnap');

(async () => { process.exit(await kit.cli(process.argv)); })();
