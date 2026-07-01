// HktInfra step-0462 — 헤드리스 검증 (#4 완전 async 전환 — 다중 존 이주 하 유계 resync·loss 가드)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 모드 = `mzlossguard`.
//   더한 한 조각: `async-barrier.js` 에 wrap-aware **interior 유계 resync 가드** + ownerZone 오라클 추가, *loss/resync* 경로를
//   interior() 로 게이트. interior = 엔티티가 자기 region 양 끝(경계+wrap)에서 horizon=max(resyncDelay,delayMax)+1 이상 떨어짐 →
//   deferred move 가 재배달되기 전 이주 경계에 닿을 수 없음(이주 전 유계 resync) → 다중 존 loss-only 도 world==lockstep 보존.
//   asyncBarrier OFF → net.step()·baseline 비트 동일(reg 0). barrier ON 경로만 변경.
//   검증: ⒜ `reg`. ⒝ `mzlossguard` — 다중 존(grid24) loss-only world==lockstep·handoffs>0·resyncs>0.
'use strict';
const NET = require('./net-core.js');
const NETPREV = require('../baseline/net-core.js');
const makeVerifyKit = require('../engine/verify-kit.js');

const SEEDS = [42, 7, 1234, 99, 2026];
const DEATH = 40; const LEASE = 3; const RESTART_AT = 60; const SNAP_N = 6; const CHAT_SNAP_N = 5; const JLOSS = 0.3;
const kit = makeVerifyKit({ NET, NETPREV, SEEDS, DEATH, LEASE, RESTART_AT, SNAP_N, CHAT_SNAP_N, JLOSS });

const { check, pad, worldDigest } = kit.helpers;

// step-0462 #4 완전 async — mzlossguard: 다중 존 loss-only + interior 유계 resync 가드 → world==lockstep.
function mzlossguard(seeds) {
  console.log('== mzlossguard (0462·#4 완전 async): 다중 존(grid24·zones2) loss-only + wrap-aware interior 유계 resync 가드 → world==lockstep. ==');
  console.log('seed   | handoffs | resyncs | world==lockstep | 판정');
  for (const seed of seeds) {
    const b = { seed, ticks: 70, clients: 6, moves: 30, radius: 4, grid: 24, incremental: true, zones: 2 };
    const off = NET.run({ ...b });
    const on = NET.run({ ...b, asyncBarrier: { loss: 0.2, delay: 0, resync: true, resyncDelay: 2, seed, ticks: 70 } });
    const same = worldDigest(off) === worldDigest(on);
    const st = on.asyncBarrier || { resyncs: 0 };
    // 가드 유효: 다중 존 loss 하 world==lockstep(수렴) + 실 이주(handoffs>0) + 실 손실 복원(resyncs>0).
    const ok = check(same && off.totals.handoffs > 0 && st.resyncs > 0, `seed ${seed}: same${same}·handoff${off.totals.handoffs}·resync${st.resyncs}`);
    console.log(`${pad(seed, 6)} | ${pad(off.totals.handoffs, 8)} | ${pad(st.resyncs, 7)} | ${pad(same ? 'Y' : 'N', 15)} | ${ok ? 'OK' : 'FAIL'}`);
  }
}

kit.MODES['mzlossguard'] = mzlossguard;
kit.ORDER.splice(1, 0, 'mzlossguard');

(async () => { process.exit(await kit.cli(process.argv)); })();
