// HktInfra step-0214 — 헤드리스 검증 (월드 영속 정합 capstone·worldCrash/worldRecover·스냅샷 arc 닫기)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 가설 = `worldcrash`.
//   더한 한 조각: worldCrash(투영 소실)·worldRecover(스냅샷+tail replay) 를 메시지 구동 프로토콜로. 스냅샷 durable → crash 후 동일 digest 복원(스냅샷 load-bearing). 미주입 → 0213 비트 동일(reg). 2차 고도화 월드영속 #2.
//   검증: ⒜ `reg`(키트). ⒝ `worldcrash`(가설) — append+snapshot+tail → worldCrash → worldRecover 후 digest == 전체-replay digest(무손실)·스냅샷 제거 시 digest 달라짐(load-bearing).
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
const CRASH = (at) => ({ at, op: { type: 'worldCrash' } });
const RECOVER = (at) => ({ at, op: { type: 'worldRecover' } });
const INTENTS = [
  APP(2, { e: 'e1', kind: 'move', to: 'A' }),
  APP(3, { e: 'e1', kind: 'move', to: 'B' }),
  APP(4, { e: 'e2', kind: 'pickup', item: 'sword' }),
  APP(6, { e: 'e1', kind: 'move', to: 'C' }),
  APP(7, { e: 'e2', kind: 'pickup', item: 'shield' }),
];
// 스냅샷(@5·처음 3개 후)+tail 2개 → crash(@9)+recover(@10) 메시지 구동.
const CYCLE = INTENTS.concat([SNAP(5), CRASH(9), RECOVER(10)]);
const BASE = { clients: 6, moves: 20, radius: 4, grid: 16, zones: 2, bus: true, worldLog: true };

function worldcrash(seeds) {
  console.log('== worldcrash: 월드 영속 정합 capstone(worldCrash/worldRecover) — crash(투영 소실)→recover(스냅샷+tail replay) 메시지 구동. 스냅샷 durable → crash 후 동일 digest 복원(스냅샷 load-bearing). 2차 고도화 월드영속 #2·스냅샷 arc 닫기. ==');
  console.log('seed   | full digest | recover digest | snap제거 digest | crash/recover | 판정');
  for (const seed of seeds) {
    const full = run({ seed, ticks: 12, ...BASE, worldOps: INTENTS });   // 기준: 스냅샷/crash 없는 전체 replay.
    full.worldlog.replay();
    const fd = full.worldlog.stateDigest();
    const cyc = run({ seed, ticks: 12, ...BASE, worldOps: CYCLE });        // 스냅샷+crash+recover.
    const w = cyc.worldlog;
    const rd = w.stateDigest();                                            // recover 가 이미 재구성한 투영.
    // 스냅샷 제거 시뮬(load-bearing 증명) — 스냅샷 없이 tail(2)만으로 replay → 처음 3 intent 누락 → digest 달라짐.
    const saved = w.snapshot; w.snapshot = null; const savedSeq = w.snapshotSeq; w.snapshotSeq = 0;
    w.replay(); const nd = w.stateDigest();
    w.snapshot = saved; w.snapshotSeq = savedSeq;                          // 원복(부수효과 0).
    const ok = check(rd === fd && nd !== fd && w.crashes === 1 && w.recovers === 1,
      `seed ${seed}: 정합 위반 (recover ${rd}·full ${fd}·noSnap ${nd}·crash ${w.crashes}/recover ${w.recovers})`);
    console.log(`${pad(seed, 6)} | ${pad(fd, 11)} | ${pad(rd, 14)} | ${pad(nd, 15)} | ${pad(w.crashes + '/' + w.recovers, 13)} | ${ok ? 'OK' : 'FAIL'}`);
  }
  console.log('  → crash 후 worldRecover 가 스냅샷+tail 로 투영을 무손실 복원(recover digest == 전체-replay digest). 스냅샷 제거 시 digest 가 달라짐 = 스냅샷이 접힌 역사를 짊어진다(load-bearing). 월드영속 스냅샷 arc(0207~0214) 닫힘.');
}

kit.MODES['worldcrash'] = worldcrash;
kit.ORDER.splice(1, 0, 'worldcrash');

(async () => { process.exit(await kit.cli(process.argv)); })();
