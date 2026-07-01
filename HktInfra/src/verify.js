// HktInfra step-0455 — 헤드리스 검증 (#4 실 net.step 배리어 실제 치환 5: 무-resync 대조 발산·substrate load-bearing)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 모드 = `barnoresync`.
//   더한 한 조각: 대조 실험 — 같은 move 손실을 resync:false(복원 없음)로 돌리면 world != lockstep(발산)·resync:true 면 == lockstep(복원).
//   → 배리어의 resync 가 *load-bearing*(손실 하 결정론을 떠받침). 코드 무변경(0454 resync:false 경로 구동) → asyncBarrier OFF reg 0.
//   검증: ⒜ `reg`. ⒝ `barnoresync` — 무-resync 발산(world != lockstep)·resync 복원(== lockstep)·lost>0.
'use strict';
const NET = require('./net-core.js');
const NETPREV = require('../baseline/net-core.js');
const makeVerifyKit = require('../engine/verify-kit.js');

const SEEDS = [42, 7, 1234, 99, 2026];
const DEATH = 40; const LEASE = 3; const RESTART_AT = 60; const SNAP_N = 6; const CHAT_SNAP_N = 5; const JLOSS = 0.3;
const kit = makeVerifyKit({ NET, NETPREV, SEEDS, DEATH, LEASE, RESTART_AT, SNAP_N, CHAT_SNAP_N, JLOSS });

const { check, pad, worldDigest } = kit.helpers;

// step-0455 #4 실 치환 5 — barnoresync: 무-resync 발산·resync 복원·substrate load-bearing 증명.
function barnoresync(seeds) {
  console.log('== barnoresync (0455·#4 실 치환 5): 무-resync 대조 — 손실 복원 없으면 world!=lockstep(발산)·resync 면 복원. ==');
  console.log('seed   | 무resync발산 | resync복원 | lost | 판정');
  for (const seed of seeds) {
    const base = { seed, ticks: 48, clients: 4, moves: 30, radius: 4, grid: 16, incremental: true, zones: 1 };
    const off = NET.run({ ...base });
    const onNo = NET.run({ ...base, asyncBarrier: { loss: 0.2, seed, resync: false, ticks: 48 } });
    const onYes = NET.run({ ...base, asyncBarrier: { loss: 0.2, seed, resync: true, resyncDelay: 2, ticks: 48 } });
    const diverge = worldDigest(off) !== worldDigest(onNo);
    const recover = worldDigest(off) === worldDigest(onYes);
    const lost = (onNo.asyncBarrier || { lost: 0 }).lost;
    const ok = check(diverge && recover && lost > 0, `seed ${seed}: diverge ${diverge}·recover ${recover}·lost ${lost}`);
    console.log(`${pad(seed, 6)} | ${pad(diverge ? 'Y' : 'N', 12)} | ${pad(recover ? 'Y' : 'N', 10)} | ${pad(lost, 4)} | ${ok ? 'OK' : 'FAIL'}`);
  }
}

kit.MODES['barnoresync'] = barnoresync;
kit.ORDER.splice(1, 0, 'barnoresync');

(async () => { process.exit(await kit.cli(process.argv)); })();
