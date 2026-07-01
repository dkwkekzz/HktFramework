// HktInfra step-0463 — 헤드리스 검증 (#4 완전 async 전환 — 다중 존 이주 하 유계 resync·delay 가드)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 모드 = `mzdelayguard`.
//   더한 한 조각: 0462 의 interior 유계 resync 가드를 *delay(교차-tick 지연 jitter)* 경로로 확장(interior move 만 지연).
//   → 다중 존(grid24) delay-only 도 world==lockstep(경계 근처 move 는 지연 없이 in-order 배달·이주 타이밍 불변).
//   asyncBarrier OFF → net.step()·baseline 비트 동일(reg 0). barrier ON 경로만 변경.
//   검증: ⒜ `reg`. ⒝ `mzdelayguard` — 다중 존 delay-only world==lockstep·handoffs>0·delayed>0.
'use strict';
const NET = require('./net-core.js');
const NETPREV = require('../baseline/net-core.js');
const makeVerifyKit = require('../engine/verify-kit.js');

const SEEDS = [42, 7, 1234, 99, 2026];
const DEATH = 40; const LEASE = 3; const RESTART_AT = 60; const SNAP_N = 6; const CHAT_SNAP_N = 5; const JLOSS = 0.3;
const kit = makeVerifyKit({ NET, NETPREV, SEEDS, DEATH, LEASE, RESTART_AT, SNAP_N, CHAT_SNAP_N, JLOSS });

const { check, pad, worldDigest } = kit.helpers;

// step-0463 #4 완전 async — mzdelayguard: 다중 존 delay-only + interior 유계 resync 가드 → world==lockstep.
function mzdelayguard(seeds) {
  console.log('== mzdelayguard (0463·#4 완전 async): 다중 존(grid24·zones2) delay-only + interior 유계 resync 가드 → world==lockstep. ==');
  console.log('seed   | handoffs | delayed | world==lockstep | 판정');
  for (const seed of seeds) {
    const b = { seed, ticks: 70, clients: 6, moves: 30, radius: 4, grid: 24, incremental: true, zones: 2 };
    const off = NET.run({ ...b });
    const on = NET.run({ ...b, asyncBarrier: { loss: 0, delay: 0.3, delayMax: 3, resync: true, seed, ticks: 70 } });
    const same = worldDigest(off) === worldDigest(on);
    const st = on.asyncBarrier || { delayed: 0 };
    const ok = check(same && off.totals.handoffs > 0 && st.delayed > 0, `seed ${seed}: same${same}·handoff${off.totals.handoffs}·delayed${st.delayed}`);
    console.log(`${pad(seed, 6)} | ${pad(off.totals.handoffs, 8)} | ${pad(st.delayed, 7)} | ${pad(same ? 'Y' : 'N', 15)} | ${ok ? 'OK' : 'FAIL'}`);
  }
}

kit.MODES['mzdelayguard'] = mzdelayguard;
kit.ORDER.splice(1, 0, 'mzdelayguard');

(async () => { process.exit(await kit.cli(process.argv)); })();
