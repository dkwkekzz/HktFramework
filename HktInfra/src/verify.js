// HktInfra step-0456 — 헤드리스 검증 (#4 실 net.step 배리어 실제 치환 6: exactly-once 회계)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 모드 = `baraccount`.
//   더한 한 조각: 배리어가 move 를 존에 *정확히 한 번* 배달했나 회계(moveDeliv=고유 배달·moveDup=중복). 손실+resync 하에서도
//   moveDeliv == 발신 move 수·moveDup 0 → exactly-once. run({asyncBarrier:{loss,resync}}) world==lockstep.
//   검증: ⒜ `reg`. ⒝ `baraccount` — world==lockstep·moveDeliv==발신 move·moveDup 0.
'use strict';
const NET = require('./net-core.js');
const NETPREV = require('../baseline/net-core.js');
const makeVerifyKit = require('../engine/verify-kit.js');

const SEEDS = [42, 7, 1234, 99, 2026];
const DEATH = 40; const LEASE = 3; const RESTART_AT = 60; const SNAP_N = 6; const CHAT_SNAP_N = 5; const JLOSS = 0.3;
const kit = makeVerifyKit({ NET, NETPREV, SEEDS, DEATH, LEASE, RESTART_AT, SNAP_N, CHAT_SNAP_N, JLOSS });

const { check, pad, worldDigest } = kit.helpers;

// step-0456 #4 실 치환 6 — baraccount: 손실+resync 하 move exactly-once(moveDeliv==발신·moveDup0)·world==lockstep.
function baraccount(seeds) {
  console.log('== baraccount (0456·#4 실 치환 6): move exactly-once 회계 — moveDeliv==발신·moveDup0·world==lockstep. ==');
  console.log('seed   | world== | moveDeliv | 발신move | moveDup | 판정');
  for (const seed of seeds) {
    const base = { seed, ticks: 48, clients: 4, moves: 30, radius: 4, grid: 16, incremental: true, zones: 1 };
    const off = NET.run({ ...base });
    const on = NET.run({ ...base, asyncBarrier: { loss: 0.2, seed, resync: true, resyncDelay: 2, ticks: 48 } });
    const sentMoves = on.net.log.filter(m => m.from === 'gateway' && /^zone/.test(m.to) && m.payload && m.payload.type === 'move').length;
    const st = on.asyncBarrier || { moveDeliv: 0, moveDup: 0 };
    const wEq = worldDigest(off) === worldDigest(on);
    const ok = check(wEq && st.moveDeliv === sentMoves && st.moveDup === 0, `seed ${seed}: world ${wEq}·deliv ${st.moveDeliv}/${sentMoves}·dup ${st.moveDup}`);
    console.log(`${pad(seed, 6)} | ${pad(wEq ? 'Y' : 'N', 7)} | ${pad(st.moveDeliv, 9)} | ${pad(sentMoves, 8)} | ${pad(st.moveDup, 7)} | ${ok ? 'OK' : 'FAIL'}`);
  }
}

kit.MODES['baraccount'] = baraccount;
kit.ORDER.splice(1, 0, 'baraccount');

(async () => { process.exit(await kit.cli(process.argv)); })();
