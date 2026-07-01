// HktInfra step-0461 — 헤드리스 검증 (#4 완전 async 전환 arc 시작 — 다중 존 이주 하 유계 resync)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 모드 = `mzdiverge`.
//   더한 한 조각: 발산 포착(negative control) — 다중 존(grid24·zones2) loss+delay 를 *무-가드* barrier(현행)로 돌리면
//   world != lockstep(발산). 원인: 지연/손실이 이주 타이밍을 바꿔 lockstep 의 move-drop 집합(stale 존 도착 move 폐기·zone.js)이
//   달라짐. #72 격차(이주 경계 넘는 지연 move)를 수치로 고정 → 0462~ 가 wrap-aware interior 가드로 해소. barrier 코드 무변경 → reg 0.
//   검증: ⒜ `reg`. ⒝ `mzdiverge` — 다중 존 loss+delay world != lockstep(발산 관측)·handoffs>0.
'use strict';
const NET = require('./net-core.js');
const NETPREV = require('../baseline/net-core.js');
const makeVerifyKit = require('../engine/verify-kit.js');

const SEEDS = [42, 7, 1234, 99, 2026];
const DEATH = 40; const LEASE = 3; const RESTART_AT = 60; const SNAP_N = 6; const CHAT_SNAP_N = 5; const JLOSS = 0.3;
const kit = makeVerifyKit({ NET, NETPREV, SEEDS, DEATH, LEASE, RESTART_AT, SNAP_N, CHAT_SNAP_N, JLOSS });

const { check, pad, worldDigest } = kit.helpers;

// step-0461 #4 완전 async 전환 arc 시작 — mzdiverge: 다중 존 loss+delay 무-가드 barrier → world != lockstep(발산 포착·#72 고정).
function mzdiverge(seeds) {
  console.log('== mzdiverge (0461·#4 완전 async): 다중 존(grid24·zones2) loss+delay 무-가드 → world != lockstep(발산). #72 이주 경계 move-drop 고정. ==');
  console.log('seed   | handoffs | resync·delay | world==lockstep | 발산? | 판정');
  for (const seed of seeds) {
    const b = { seed, ticks: 70, clients: 6, moves: 30, radius: 4, grid: 24, incremental: true, zones: 2 };
    const off = NET.run({ ...b });
    const on = NET.run({ ...b, asyncBarrier: { loss: 0.2, delay: 0.3, delayMax: 3, resync: true, resyncDelay: 2, seed, ticks: 70 } });
    const same = worldDigest(off) === worldDigest(on);
    const st = on.asyncBarrier || { resyncs: 0, delayed: 0 };
    const pert = st.resyncs > 0 || st.delayed > 0;
    // negative control: 무-가드 다중 존은 *발산해야* 정상(가드 부재 확증). handoffs>0(실 이주) + 섭동>0 + world != lockstep.
    const diverges = !same;
    const ok = check(off.totals.handoffs > 0 && pert && diverges, `seed ${seed}: handoff${off.totals.handoffs}·pert${pert}·발산${diverges}`);
    console.log(`${pad(seed, 6)} | ${pad(off.totals.handoffs, 8)} | ${pad('r' + st.resyncs + '·d' + st.delayed, 12)} | ${pad(same ? 'Y' : 'N', 15)} | ${pad(diverges ? 'Y' : 'N', 5)} | ${ok ? 'OK' : 'FAIL'}`);
  }
}

kit.MODES['mzdiverge'] = mzdiverge;
kit.ORDER.splice(1, 0, 'mzdiverge');

(async () => { process.exit(await kit.cli(process.argv)); })();
