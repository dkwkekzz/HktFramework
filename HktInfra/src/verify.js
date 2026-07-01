// HktInfra step-0458 — 헤드리스 검증 (#4 실 net.step 배리어 실제 치환 8: 다중 존+핸드오프 통합)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 모드 = `barmultizone`.
//   더한 한 조각: 배리어를 *다중 존*(2 존·공간 분할·핸드오프/이주) 토폴로지에 구동 — holdback 이 월드 입력을 발신 순서(m.id)로
//   재구성해 제자리 슬롯 방출하므로 이주가 있어도 투명(world/log==lockstep). 코드 무변경(0453 holdback 경로) → reg 0.
//   검증: ⒜ `reg`. ⒝ `barmultizone` — 2 존·핸드오프 하 world/log==lockstep·handoffs>0·held>0.
'use strict';
const NET = require('./net-core.js');
const NETPREV = require('../baseline/net-core.js');
const makeVerifyKit = require('../engine/verify-kit.js');

const SEEDS = [42, 7, 1234, 99, 2026];
const DEATH = 40; const LEASE = 3; const RESTART_AT = 60; const SNAP_N = 6; const CHAT_SNAP_N = 5; const JLOSS = 0.3;
const kit = makeVerifyKit({ NET, NETPREV, SEEDS, DEATH, LEASE, RESTART_AT, SNAP_N, CHAT_SNAP_N, JLOSS });

const { check, pad, worldDigest, logDigest } = kit.helpers;

// step-0458 #4 실 치환 8 — barmultizone: 2 존+핸드오프 하 배리어 투명·world/log==lockstep·handoffs>0.
function barmultizone(seeds) {
  console.log('== barmultizone (0458·#4 실 치환 8): 다중 존+핸드오프 통합 — world/log==lockstep·handoffs>0·held>0. ==');
  console.log('seed   | world== | log== | handoffs | held | 판정');
  for (const seed of seeds) {
    const base = { seed, ticks: 70, clients: 6, moves: 30, radius: 4, grid: 16, incremental: true, zones: 2 };
    const off = NET.run({ ...base });
    const on = NET.run({ ...base, asyncBarrier: true });
    const wEq = worldDigest(off) === worldDigest(on);
    const lEq = logDigest(off) === logDigest(on);
    const st = on.asyncBarrier || { held: 0 };
    const ho = off.totals.handoffs;
    const ok = check(wEq && lEq && ho > 0 && st.held > 0, `seed ${seed}: world ${wEq}·log ${lEq}·handoffs ${ho}·held ${st.held}`);
    console.log(`${pad(seed, 6)} | ${pad(wEq ? 'Y' : 'N', 7)} | ${pad(lEq ? 'Y' : 'N', 5)} | ${pad(ho, 8)} | ${pad(st.held, 4)} | ${ok ? 'OK' : 'FAIL'}`);
  }
}

kit.MODES['barmultizone'] = barmultizone;
kit.ORDER.splice(1, 0, 'barmultizone');

(async () => { process.exit(await kit.cli(process.argv)); })();
