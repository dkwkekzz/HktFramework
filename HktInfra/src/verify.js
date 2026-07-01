// HktInfra step-0467 — 헤드리스 검증 (#4 완전 async 전환 — 이주 전 유계 resync 명제)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 모드 = `mzhandoff`.
//   더한 한 조각: `async-barrier.js` 에 이주 경계 걸침 회계 — pendingMoves(미결 deferred move → avatar)·handoffsObs·
//   deferredAcrossHandoff. 명제: **이주(handoff) 관측 시 그 avatar 의 미결 deferred move 는 0**(deferredAcrossHandoff==0)
//   = 이주 전 유계 resync(defer 는 항상 이주 전 재배달). handoffsObs>0(실 이주 관측). asyncBarrier OFF → net.step reg 0.
//   검증: ⒜ `reg`. ⒝ `mzhandoff` — deferredAcrossHandoff==0·handoffsObs>0·deferN>0·world==lockstep.
'use strict';
const NET = require('./net-core.js');
const NETPREV = require('../baseline/net-core.js');
const makeVerifyKit = require('../engine/verify-kit.js');

const SEEDS = [42, 7, 1234, 99, 2026];
const DEATH = 40; const LEASE = 3; const RESTART_AT = 60; const SNAP_N = 6; const CHAT_SNAP_N = 5; const JLOSS = 0.3;
const kit = makeVerifyKit({ NET, NETPREV, SEEDS, DEATH, LEASE, RESTART_AT, SNAP_N, CHAT_SNAP_N, JLOSS });

const { check, pad, worldDigest } = kit.helpers;

// step-0467 #4 완전 async — mzhandoff: 이주 전 유계 resync 명제(deferredAcrossHandoff==0·handoffsObs>0).
function mzhandoff(seeds) {
  console.log('== mzhandoff (0467·#4 완전 async): 이주 전 유계 resync — 이주 관측 시 미결 deferred move 0(deferredAcrossHandoff==0) + world==lockstep. ==');
  console.log('seed   | deferN | handoffsObs | deferredAcrossHandoff | world==lockstep | 판정');
  for (const seed of seeds) {
    const b = { seed, ticks: 70, clients: 6, moves: 30, radius: 4, grid: 24, incremental: true, zones: 2 };
    const off = NET.run({ ...b });
    const on = NET.run({ ...b, asyncBarrier: { loss: 0.2, delay: 0.3, delayMax: 3, resync: true, resyncDelay: 2, seed, ticks: 70 } });
    const same = worldDigest(off) === worldDigest(on);
    const st = on.asyncBarrier || { deferN: 0, handoffsObs: 0, deferredAcrossHandoff: 1 };
    const clean = st.deferredAcrossHandoff === 0 && st.handoffsObs > 0 && st.deferN > 0;
    const ok = check(same && clean, `seed ${seed}: same${same}·hobs${st.handoffsObs}·across${st.deferredAcrossHandoff}·deferN${st.deferN}`);
    console.log(`${pad(seed, 6)} | ${pad(st.deferN, 6)} | ${pad(st.handoffsObs, 11)} | ${pad(st.deferredAcrossHandoff, 21)} | ${pad(same ? 'Y' : 'N', 15)} | ${ok ? 'OK' : 'FAIL'}`);
  }
}

kit.MODES['mzhandoff'] = mzhandoff;
kit.ORDER.splice(1, 0, 'mzhandoff');

(async () => { process.exit(await kit.cli(process.argv)); })();
