// HktInfra step-0451 — 헤드리스 검증 (#4 실 net.step 배리어 실제 치환 1: 배리어 stepper seam 투명)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 모드 = `barpass`.
//   더한 한 조각: 신규 박스 async-barrier.js — run() 이 매 tick net.step() 대신 부를 stepper seam(투명 pass-through) +
//   topo-run.js gated 배선(opts.asyncBarrier OFF→net.step() 그대로=reg 0). run({asyncBarrier}) world/log == run({})(lockstep).
//   검증: ⒜ `reg`(asyncBarrier 미설정→비트 동일). ⒝ `barpass` — run({asyncBarrier:true}) worldDigest/logDigest == run({}).
'use strict';
const NET = require('./net-core.js');
const NETPREV = require('../baseline/net-core.js');
const makeVerifyKit = require('../engine/verify-kit.js');

const SEEDS = [42, 7, 1234, 99, 2026];
const DEATH = 40; const LEASE = 3; const RESTART_AT = 60; const SNAP_N = 6; const CHAT_SNAP_N = 5; const JLOSS = 0.3;
const kit = makeVerifyKit({ NET, NETPREV, SEEDS, DEATH, LEASE, RESTART_AT, SNAP_N, CHAT_SNAP_N, JLOSS });

const { check, pad, worldDigest, logDigest } = kit.helpers;

// step-0451 #4 실 치환 1 — barpass: run({asyncBarrier}) == run({})(lockstep)·투명 seam(world/log 불변).
function barpass(seeds) {
  console.log('== barpass (0451·#4 실 치환 1): 배리어 stepper seam 투명 — run({asyncBarrier}) world/log == run({}) lockstep. ==');
  console.log('seed   | world== | log== | 판정');
  for (const seed of seeds) {
    const base = { seed, ticks: 48, clients: 4, moves: 30, radius: 4, grid: 16, incremental: true };
    const off = NET.run({ ...base });
    const on = NET.run({ ...base, asyncBarrier: true });
    const wEq = worldDigest(off) === worldDigest(on);
    const lEq = logDigest(off) === logDigest(on);
    const ok = check(wEq && lEq, `seed ${seed}: world ${wEq}·log ${lEq}`);
    console.log(`${pad(seed, 6)} | ${pad(wEq ? 'Y' : 'N', 7)} | ${pad(lEq ? 'Y' : 'N', 5)} | ${ok ? 'OK' : 'FAIL'}`);
  }
}

kit.MODES['barpass'] = barpass;
kit.ORDER.splice(1, 0, 'barpass');

(async () => { process.exit(await kit.cli(process.argv)); })();
