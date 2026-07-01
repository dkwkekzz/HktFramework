// HktInfra step-0468 — 헤드리스 검증 (#4 완전 async 전환 — exactly-once 완전 회계)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 모드 = `mzexactly`.
//   더한 한 조각: `async-barrier.js` 에 `pendingAtEnd`(종료 시 미결 deferred move 수) 노출. exactly-once 완전 회계:
//   moveDup==0(중복 배달 0)·lost==0(resync ON→유실 0)·pendingAtEnd==0(모든 deferred move 결국 배달)·moveDeliv>0 →
//   유계 resync 가 redirect 없이 *정확히 한 번* 배달(유실·중복·미결 0). asyncBarrier OFF → net.step reg 0.
//   검증: ⒜ `reg`. ⒝ `mzexactly` — moveDup0·lost0·pendingAtEnd0·moveDeliv>0·world==lockstep.
'use strict';
const NET = require('./net-core.js');
const NETPREV = require('../baseline/net-core.js');
const makeVerifyKit = require('../engine/verify-kit.js');

const SEEDS = [42, 7, 1234, 99, 2026];
const DEATH = 40; const LEASE = 3; const RESTART_AT = 60; const SNAP_N = 6; const CHAT_SNAP_N = 5; const JLOSS = 0.3;
const kit = makeVerifyKit({ NET, NETPREV, SEEDS, DEATH, LEASE, RESTART_AT, SNAP_N, CHAT_SNAP_N, JLOSS });

const { check, pad, worldDigest } = kit.helpers;

// step-0468 #4 완전 async — mzexactly: exactly-once 완전 회계(moveDup0·lost0·pendingAtEnd0).
function mzexactly(seeds) {
  console.log('== mzexactly (0468·#4 완전 async): exactly-once 완전 회계 — moveDup0·lost0·pendingAtEnd0(유계 resync 로 정확히 한 번 배달) + world==lockstep. ==');
  console.log('seed   | moveDeliv | moveDup | lost | pendingEnd | world==lockstep | 판정');
  for (const seed of seeds) {
    const b = { seed, ticks: 70, clients: 6, moves: 30, radius: 4, grid: 24, incremental: true, zones: 2 };
    const off = NET.run({ ...b });
    const on = NET.run({ ...b, asyncBarrier: { loss: 0.2, delay: 0.3, delayMax: 3, resync: true, resyncDelay: 2, seed, ticks: 70 } });
    const same = worldDigest(off) === worldDigest(on);
    const st = on.asyncBarrier || { moveDeliv: 0, moveDup: 1, lost: 1, pendingAtEnd: 1 };
    const once = st.moveDup === 0 && st.lost === 0 && st.pendingAtEnd === 0 && st.moveDeliv > 0;
    const ok = check(same && once, `seed ${seed}: same${same}·dup${st.moveDup}·lost${st.lost}·pend${st.pendingAtEnd}·deliv${st.moveDeliv}`);
    console.log(`${pad(seed, 6)} | ${pad(st.moveDeliv, 9)} | ${pad(st.moveDup, 7)} | ${pad(st.lost, 4)} | ${pad(st.pendingAtEnd, 10)} | ${pad(same ? 'Y' : 'N', 15)} | ${ok ? 'OK' : 'FAIL'}`);
  }
}

kit.MODES['mzexactly'] = mzexactly;
kit.ORDER.splice(1, 0, 'mzexactly');

(async () => { process.exit(await kit.cli(process.argv)); })();
