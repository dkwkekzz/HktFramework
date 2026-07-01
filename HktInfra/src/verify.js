// HktInfra step-0465 — 헤드리스 검증 (#4 완전 async 전환 — 유계 resync 증명)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 모드 = `mzbound`.
//   더한 한 조각: `async-barrier.js` 에 유계 resync 회계(deferSpan=재배달 tick − defer tick·maxSpan·deferN·horizon) 노출.
//   명제: 모든 deferred move 의 재배달 span 이 horizon=max(resyncDelay,delayMax)+1 *미만* → interior(엔티티가 경계에서 horizon
//   이상) 이므로 재배달 전 엔티티가 이주 경계에 닿을 수 없다 = 이주 전 유계 resync. asyncBarrier OFF → net.step reg 0.
//   검증: ⒜ `reg`. ⒝ `mzbound` — maxSpan < horizon·deferN>0·world==lockstep.
'use strict';
const NET = require('./net-core.js');
const NETPREV = require('../baseline/net-core.js');
const makeVerifyKit = require('../engine/verify-kit.js');

const SEEDS = [42, 7, 1234, 99, 2026];
const DEATH = 40; const LEASE = 3; const RESTART_AT = 60; const SNAP_N = 6; const CHAT_SNAP_N = 5; const JLOSS = 0.3;
const kit = makeVerifyKit({ NET, NETPREV, SEEDS, DEATH, LEASE, RESTART_AT, SNAP_N, CHAT_SNAP_N, JLOSS });

const { check, pad, worldDigest } = kit.helpers;

// step-0465 #4 완전 async — mzbound: 유계 resync 증명 — maxSpan < horizon(재배달이 이주 경계 도달 전 확실).
function mzbound(seeds) {
  console.log('== mzbound (0465·#4 완전 async): 유계 resync 증명 — 모든 deferred move span < horizon(이주 전 확실 재배달) + world==lockstep. ==');
  console.log('seed   | deferN | maxSpan | horizon | span<horizon | world==lockstep | 판정');
  for (const seed of seeds) {
    const b = { seed, ticks: 70, clients: 6, moves: 30, radius: 4, grid: 24, incremental: true, zones: 2 };
    const off = NET.run({ ...b });
    const on = NET.run({ ...b, asyncBarrier: { loss: 0.2, delay: 0.3, delayMax: 3, resync: true, resyncDelay: 2, seed, ticks: 70 } });
    const same = worldDigest(off) === worldDigest(on);
    const st = on.asyncBarrier || { deferN: 0, maxSpan: 0, horizon: 0 };
    const bounded = st.deferN > 0 && st.maxSpan < st.horizon;
    const ok = check(same && bounded, `seed ${seed}: same${same}·deferN${st.deferN}·maxSpan${st.maxSpan}<horizon${st.horizon}`);
    console.log(`${pad(seed, 6)} | ${pad(st.deferN, 6)} | ${pad(st.maxSpan, 7)} | ${pad(st.horizon, 7)} | ${pad(st.maxSpan < st.horizon ? 'Y' : 'N', 12)} | ${pad(same ? 'Y' : 'N', 15)} | ${ok ? 'OK' : 'FAIL'}`);
  }
}

kit.MODES['mzbound'] = mzbound;
kit.ORDER.splice(1, 0, 'mzbound');

(async () => { process.exit(await kit.cli(process.argv)); })();
