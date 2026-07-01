// HktInfra step-0466 — 헤드리스 검증 (#4 완전 async 전환 — 유계 resync 가드 load-bearing 대조)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 모드 = `mzguardctl`.
//   더한 한 조각: `async-barrier.js` 에 `cfg.mzGuard` 토글(기본 ON) 추가 — false 면 interior() 우회(전 move 흡수). 같은 시나리오를
//   ⒜ 가드 ON → world==lockstep(수렴) ⒝ 가드 OFF → world != lockstep(발산) 로 대조해 interior 유계 resync 가드가 *load-bearing*
//   (없으면 발산·있으면 수렴)임을 확증(0455 무-resync 대조의 다중 존 판). asyncBarrier OFF → net.step reg 0.
//   검증: ⒜ `reg`. ⒝ `mzguardctl` — ON 수렴 && OFF 발산(둘 다 성립해야 통과).
'use strict';
const NET = require('./net-core.js');
const NETPREV = require('../baseline/net-core.js');
const makeVerifyKit = require('../engine/verify-kit.js');

const SEEDS = [42, 7, 1234, 99, 2026];
const DEATH = 40; const LEASE = 3; const RESTART_AT = 60; const SNAP_N = 6; const CHAT_SNAP_N = 5; const JLOSS = 0.3;
const kit = makeVerifyKit({ NET, NETPREV, SEEDS, DEATH, LEASE, RESTART_AT, SNAP_N, CHAT_SNAP_N, JLOSS });

const { check, pad, worldDigest } = kit.helpers;

// step-0466 #4 완전 async — mzguardctl: 유계 resync 가드 load-bearing 대조(ON 수렴 vs OFF 발산).
function mzguardctl(seeds) {
  console.log('== mzguardctl (0466·#4 완전 async): interior 유계 resync 가드 load-bearing — 가드 ON→world==lockstep, OFF→발산. ==');
  console.log('seed   | 가드ON 수렴 | 가드OFF 발산 | 판정');
  for (const seed of seeds) {
    const b = { seed, ticks: 70, clients: 6, moves: 30, radius: 4, grid: 24, incremental: true, zones: 2 };
    const off = NET.run({ ...b });
    const abBase = { loss: 0.2, delay: 0.3, delayMax: 3, resync: true, resyncDelay: 2, seed, ticks: 70 };
    const onGuard = NET.run({ ...b, asyncBarrier: { ...abBase } });                 // 가드 ON(기본)
    const onBypass = NET.run({ ...b, asyncBarrier: { ...abBase, mzGuard: false } }); // 가드 OFF(우회)
    const converges = worldDigest(off) === worldDigest(onGuard);
    const diverges = worldDigest(off) !== worldDigest(onBypass);
    const ok = check(converges && diverges, `seed ${seed}: ON수렴${converges}·OFF발산${diverges}`);
    console.log(`${pad(seed, 6)} | ${pad(converges ? 'Y' : 'N', 11)} | ${pad(diverges ? 'Y' : 'N', 12)} | ${ok ? 'OK' : 'FAIL'}`);
  }
}

kit.MODES['mzguardctl'] = mzguardctl;
kit.ORDER.splice(1, 0, 'mzguardctl');

(async () => { process.exit(await kit.cli(process.argv)); })();
