// HktInfra step-0453 — 헤드리스 검증 (#4 실 net.step 배리어 실제 치환 3: 월드 입력 per-tick 전순서 holdback)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 모드 = `barhold`.
//   더한 한 조각: async-barrier stepper 가 월드 입력을 holdback 버퍼로 모아 *전순서*(lc,site)로 방출(그 외 원순서). 실 존 intent 적용은
//   순서 무관(위치 가산·onMsg→pending·onTick 일괄) → 재정렬해도 world/log 불변(투명·배리어 기계 실동작). run({asyncBarrier}) world/log==lockstep·held>0.
//   검증: ⒜ `reg`(asyncBarrier 미설정→net.step 비트 동일). ⒝ `barhold` — world/log==lockstep·held>0.
'use strict';
const NET = require('./net-core.js');
const NETPREV = require('../baseline/net-core.js');
const makeVerifyKit = require('../engine/verify-kit.js');

const SEEDS = [42, 7, 1234, 99, 2026];
const DEATH = 40; const LEASE = 3; const RESTART_AT = 60; const SNAP_N = 6; const CHAT_SNAP_N = 5; const JLOSS = 0.3;
const kit = makeVerifyKit({ NET, NETPREV, SEEDS, DEATH, LEASE, RESTART_AT, SNAP_N, CHAT_SNAP_N, JLOSS });

const { check, pad, worldDigest, logDigest } = kit.helpers;

// step-0453 #4 실 치환 3 — barhold: 월드 입력 per-tick 전순서 holdback·world/log==lockstep·held>0.
function barhold(seeds) {
  console.log('== barhold (0453·#4 실 치환 3): 월드 입력 per-tick 전순서 holdback — world/log==lockstep(투명)·held>0. ==');
  console.log('seed   | world== | log== | held | 판정');
  for (const seed of seeds) {
    const base = { seed, ticks: 48, clients: 4, moves: 30, radius: 4, grid: 16, incremental: true };
    const off = NET.run({ ...base });
    const on = NET.run({ ...base, asyncBarrier: true });
    const wEq = worldDigest(off) === worldDigest(on);
    const lEq = logDigest(off) === logDigest(on);
    const st = on.asyncBarrier || { held: 0 };
    const ok = check(wEq && lEq && st.held > 0, `seed ${seed}: world ${wEq}·log ${lEq}·held ${st.held}`);
    console.log(`${pad(seed, 6)} | ${pad(wEq ? 'Y' : 'N', 7)} | ${pad(lEq ? 'Y' : 'N', 5)} | ${pad(st.held, 4)} | ${ok ? 'OK' : 'FAIL'}`);
  }
}

kit.MODES['barhold'] = barhold;
kit.ORDER.splice(1, 0, 'barhold');

(async () => { process.exit(await kit.cli(process.argv)); })();
