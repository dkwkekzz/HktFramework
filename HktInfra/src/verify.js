// HktInfra step-0469 — 헤드리스 검증 (#4 완전 async 전환 — 다운스트림 뷰 수렴 desync 0)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 모드 = `mzdownstream`.
//   더한 한 조각: 다중 존(grid24) 결합 loss+delay 하에서 *모든 클라의 AOI 뷰*(seenSig)가 lockstep(무섭동) 뷰와 정확히 일치
//   = 다운스트림 desync 0(0459 단일 존 수렴의 다중 존+이주 판). 유계 resync 가 월드뿐 아니라 클라 관찰 뷰까지 수렴시킴을 단언.
//   barrier 코드 무변경(뷰는 월드의 함수) → reg 0.
//   검증: ⒜ `reg`. ⒝ `mzdownstream` — 전 클라 seenSig(on)==seenSig(off)·resyncs/delayed>0·handoffs>0.
'use strict';
const NET = require('./net-core.js');
const NETPREV = require('../baseline/net-core.js');
const makeVerifyKit = require('../engine/verify-kit.js');

const SEEDS = [42, 7, 1234, 99, 2026];
const DEATH = 40; const LEASE = 3; const RESTART_AT = 60; const SNAP_N = 6; const CHAT_SNAP_N = 5; const JLOSS = 0.3;
const kit = makeVerifyKit({ NET, NETPREV, SEEDS, DEATH, LEASE, RESTART_AT, SNAP_N, CHAT_SNAP_N, JLOSS });

const { check, pad, worldDigest } = kit.helpers;

// step-0469 #4 완전 async — mzdownstream: 다중 존 loss+delay 하 전 클라 AOI 뷰 수렴(desync 0).
function mzdownstream(seeds) {
  console.log('== mzdownstream (0469·#4 완전 async): 다중 존(grid24) loss+delay 하 전 클라 AOI 뷰 == lockstep(desync 0) + 섭동/이주 실재. ==');
  console.log('seed   | 클라 뷰 수렴 | resync·delay | handoffs | 판정');
  for (const seed of seeds) {
    const b = { seed, ticks: 70, clients: 6, moves: 30, radius: 4, grid: 24, incremental: true, zones: 2 };
    const off = NET.run({ ...b });
    const on = NET.run({ ...b, asyncBarrier: { loss: 0.2, delay: 0.3, delayMax: 3, resync: true, resyncDelay: 2, seed, ticks: 70 } });
    const vOff = off.clients.map(c => c.seenSig());
    const vOn = on.clients.map(c => c.seenSig());
    const converged = vOff.length > 0 && vOff.every((s, i) => s === vOn[i]);
    const st = on.asyncBarrier || { resyncs: 0, delayed: 0 };
    const pert = st.resyncs > 0 && st.delayed > 0 && off.totals.handoffs > 0;
    const ok = check(converged && pert, `seed ${seed}: 뷰수렴${converged}·r${st.resyncs}/d${st.delayed}·handoff${off.totals.handoffs}`);
    console.log(`${pad(seed, 6)} | ${pad(converged ? 'Y (' + vOff.length + '/' + vOff.length + ')' : 'N', 12)} | ${pad('r' + st.resyncs + '·d' + st.delayed, 12)} | ${pad(off.totals.handoffs, 8)} | ${ok ? 'OK' : 'FAIL'}`);
  }
}

kit.MODES['mzdownstream'] = mzdownstream;
kit.ORDER.splice(1, 0, 'mzdownstream');

(async () => { process.exit(await kit.cli(process.argv)); })();
