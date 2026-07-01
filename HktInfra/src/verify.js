// HktInfra step-0457 — 헤드리스 검증 (#4 실 net.step 배리어 실제 치환 7: 교차-tick 지연 jitter)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 모드 = `bardelay`.
//   더한 한 조각: 배리어가 move 를 확률적으로 1..delayMax tick 늦게 배달(손실 아님·재enqueue) — 배달 타이밍을 tick 배리어에서 분리
//   (배리어-free 진행 판). move 는 가환이라 늦게 적용해도 최종 월드 동일 → run({asyncBarrier:{delay}}) world==lockstep·delayed>0.
//   검증: ⒜ `reg`. ⒝ `bardelay` — world==lockstep·delayed>0·moveDup 0.
'use strict';
const NET = require('./net-core.js');
const NETPREV = require('../baseline/net-core.js');
const makeVerifyKit = require('../engine/verify-kit.js');

const SEEDS = [42, 7, 1234, 99, 2026];
const DEATH = 40; const LEASE = 3; const RESTART_AT = 60; const SNAP_N = 6; const CHAT_SNAP_N = 5; const JLOSS = 0.3;
const kit = makeVerifyKit({ NET, NETPREV, SEEDS, DEATH, LEASE, RESTART_AT, SNAP_N, CHAT_SNAP_N, JLOSS });

const { check, pad, worldDigest } = kit.helpers;

// step-0457 #4 실 치환 7 — bardelay: 교차-tick 지연 jitter·world==lockstep·delayed>0.
function bardelay(seeds) {
  console.log('== bardelay (0457·#4 실 치환 7): 교차-tick 지연 jitter — 배달 타이밍 tick 분리·world==lockstep·delayed>0. ==');
  console.log('seed   | world== | delayed | moveDup | 판정');
  for (const seed of seeds) {
    const base = { seed, ticks: 48, clients: 4, moves: 30, radius: 4, grid: 16, incremental: true, zones: 1 };
    const off = NET.run({ ...base });
    const on = NET.run({ ...base, asyncBarrier: { delay: 0.4, delayMax: 4, seed, ticks: 48 } });
    const wEq = worldDigest(off) === worldDigest(on);
    const st = on.asyncBarrier || { delayed: 0, moveDup: 0 };
    const ok = check(wEq && st.delayed > 0 && st.moveDup === 0, `seed ${seed}: world ${wEq}·delayed ${st.delayed}·dup ${st.moveDup}`);
    console.log(`${pad(seed, 6)} | ${pad(wEq ? 'Y' : 'N', 7)} | ${pad(st.delayed, 7)} | ${pad(st.moveDup, 7)} | ${ok ? 'OK' : 'FAIL'}`);
  }
}

kit.MODES['bardelay'] = bardelay;
kit.ORDER.splice(1, 0, 'bardelay');

(async () => { process.exit(await kit.cli(process.argv)); })();
