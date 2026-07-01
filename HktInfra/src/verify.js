// HktInfra step-0452 — 헤드리스 검증 (#4 실 net.step 배리어 실제 치환 2: 월드 입력 per-site Lamport 스탬프)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 모드 = `barstamp`.
//   더한 한 조각: async-barrier stepper 가 net.step() 배달을 인라인(같은 순서→world/log 불변) + 월드 입력(zone enter/move/leave)에
//   per-site Lamport 스탬프 부여(site=intent 원발신 sessionId/avatar). 스탬프만 기록·재정렬 없음 → run({asyncBarrier}) world/log==lockstep.
//   검증: ⒜ `reg`(asyncBarrier 미설정→net.step 비트 동일). ⒝ `barstamp` — world/log==lockstep·stamped>0·sites>1.
'use strict';
const NET = require('./net-core.js');
const NETPREV = require('../baseline/net-core.js');
const makeVerifyKit = require('../engine/verify-kit.js');

const SEEDS = [42, 7, 1234, 99, 2026];
const DEATH = 40; const LEASE = 3; const RESTART_AT = 60; const SNAP_N = 6; const CHAT_SNAP_N = 5; const JLOSS = 0.3;
const kit = makeVerifyKit({ NET, NETPREV, SEEDS, DEATH, LEASE, RESTART_AT, SNAP_N, CHAT_SNAP_N, JLOSS });

const { check, pad, worldDigest, logDigest } = kit.helpers;

// step-0452 #4 실 치환 2 — barstamp: 월드 입력 스탬프·world/log==lockstep·stamped>0.
function barstamp(seeds) {
  console.log('== barstamp (0452·#4 실 치환 2): 월드 입력 per-site Lamport 스탬프 — world/log==lockstep·stamped>0. ==');
  console.log('seed   | world== | log== | stamped | sites | 판정');
  for (const seed of seeds) {
    const base = { seed, ticks: 48, clients: 4, moves: 30, radius: 4, grid: 16, incremental: true };
    const off = NET.run({ ...base });
    const on = NET.run({ ...base, asyncBarrier: true });
    const wEq = worldDigest(off) === worldDigest(on);
    const lEq = logDigest(off) === logDigest(on);
    const st = on.asyncBarrier || { stamped: 0, sites: 0 };
    const ok = check(wEq && lEq && st.stamped > 0 && st.sites > 1, `seed ${seed}: world ${wEq}·log ${lEq}·stamped ${st.stamped}·sites ${st.sites}`);
    console.log(`${pad(seed, 6)} | ${pad(wEq ? 'Y' : 'N', 7)} | ${pad(lEq ? 'Y' : 'N', 5)} | ${pad(st.stamped, 7)} | ${pad(st.sites, 5)} | ${ok ? 'OK' : 'FAIL'}`);
  }
}

kit.MODES['barstamp'] = barstamp;
kit.ORDER.splice(1, 0, 'barstamp');

(async () => { process.exit(await kit.cli(process.argv)); })();
