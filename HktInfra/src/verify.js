// HktInfra step-0464 — 헤드리스 검증 (#4 완전 async 전환 — 다중 존 결합 loss+delay + exactly-once)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 모드 = `mzresync`.
//   더한 한 조각: 0462(loss)·0463(delay) interior 유계 resync 가드를 *동시* 적용(결합 섭동)해 다중 존(grid24) 에서
//   world==lockstep + **exactly-once(moveDup==0)** 를 한 시나리오로 단언. barrier 코드 무변경(두 가드 이미 존재) → reg 0.
//   검증: ⒜ `reg`. ⒝ `mzresync` — 결합 loss+delay world==lockstep·moveDup0·handoffs>0·resyncs>0·delayed>0.
'use strict';
const NET = require('./net-core.js');
const NETPREV = require('../baseline/net-core.js');
const makeVerifyKit = require('../engine/verify-kit.js');

const SEEDS = [42, 7, 1234, 99, 2026];
const DEATH = 40; const LEASE = 3; const RESTART_AT = 60; const SNAP_N = 6; const CHAT_SNAP_N = 5; const JLOSS = 0.3;
const kit = makeVerifyKit({ NET, NETPREV, SEEDS, DEATH, LEASE, RESTART_AT, SNAP_N, CHAT_SNAP_N, JLOSS });

const { check, pad, worldDigest } = kit.helpers;

// step-0464 #4 완전 async — mzresync: 다중 존 결합 loss+delay + interior 유계 resync 가드 → world==lockstep + exactly-once.
function mzresync(seeds) {
  console.log('== mzresync (0464·#4 완전 async): 다중 존(grid24·zones2) 결합 loss+delay + interior 유계 resync 가드 → world==lockstep + exactly-once(moveDup0). ==');
  console.log('seed   | handoffs | resync·delay | moveDup | world==lockstep | 판정');
  for (const seed of seeds) {
    const b = { seed, ticks: 70, clients: 6, moves: 30, radius: 4, grid: 24, incremental: true, zones: 2 };
    const off = NET.run({ ...b });
    const on = NET.run({ ...b, asyncBarrier: { loss: 0.2, delay: 0.3, delayMax: 3, resync: true, resyncDelay: 2, seed, ticks: 70 } });
    const same = worldDigest(off) === worldDigest(on);
    const st = on.asyncBarrier || { resyncs: 0, delayed: 0, moveDup: 0 };
    const once = st.moveDup === 0;
    const pert = st.resyncs > 0 && st.delayed > 0;
    const ok = check(same && once && pert && off.totals.handoffs > 0, `seed ${seed}: same${same}·once${once}·pert r${st.resyncs}/d${st.delayed}·handoff${off.totals.handoffs}`);
    console.log(`${pad(seed, 6)} | ${pad(off.totals.handoffs, 8)} | ${pad('r' + st.resyncs + '·d' + st.delayed, 12)} | ${pad(st.moveDup, 7)} | ${pad(same ? 'Y' : 'N', 15)} | ${ok ? 'OK' : 'FAIL'}`);
  }
}

kit.MODES['mzresync'] = mzresync;
kit.ORDER.splice(1, 0, 'mzresync');

(async () => { process.exit(await kit.cli(process.argv)); })();
