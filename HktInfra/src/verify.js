// HktInfra step-0470 — 헤드리스 검증 (#4 완전 async 전환 10·grand capstone: 다중 존 이주 하 유계 resync E2E)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 모드 = `mze2ecap`.
//   더한 한 조각: grand capstone — 다중 존(grid24·zones2) 결합 loss+delay+핸드오프를 한 시나리오로 돌려 arc 전체를 단언:
//   ⒜ world==lockstep(유계 resync·이주 타이밍 불변) ⒝ exactly-once(moveDup0·lost0·pendingAtEnd0) ⒞ 다운스트림 desync 0(전
//   클라 뷰==lockstep) ⒟ 유계 resync(maxSpan<horizon·deferredAcrossHandoff0·handoffs>0). #4 완전 async 전환 sub-arc(0461~0470) 닫기.
//   asyncBarrier OFF → reg 구조적 0.
//   검증: ⒜ `reg`. ⒝ `mze2ecap` — 위 4항 전부 + 섭동/이주 실재.
'use strict';
const NET = require('./net-core.js');
const NETPREV = require('../baseline/net-core.js');
const makeVerifyKit = require('../engine/verify-kit.js');

const SEEDS = [42, 7, 1234, 99, 2026];
const DEATH = 40; const LEASE = 3; const RESTART_AT = 60; const SNAP_N = 6; const CHAT_SNAP_N = 5; const JLOSS = 0.3;
const kit = makeVerifyKit({ NET, NETPREV, SEEDS, DEATH, LEASE, RESTART_AT, SNAP_N, CHAT_SNAP_N, JLOSS });

const { check, pad, worldDigest } = kit.helpers;

// step-0470 #4 완전 async 10·grand capstone — mze2ecap: 다중 존 이주 하 유계 resync E2E(world/뷰==lockstep·exactly-once·유계). 0461~0470 닫기.
function mze2ecap(seeds) {
  console.log('== mze2ecap (0470·#4 grand capstone): 다중 존 loss+delay+핸드오프 — world==lockstep·exactly-once·다운스트림 desync0·유계 resync. 0461~0470 닫기. ==');
  console.log('seed   | world | exactly-once | 뷰수렴 | 유계(span<H·across0) | handoffs | 판정');
  for (const seed of seeds) {
    const b = { seed, ticks: 70, clients: 6, moves: 30, radius: 4, grid: 24, incremental: true, zones: 2 };
    const off = NET.run({ ...b });
    const on = NET.run({ ...b, asyncBarrier: { loss: 0.2, delay: 0.3, delayMax: 3, resync: true, resyncDelay: 2, seed, ticks: 70 } });
    const st = on.asyncBarrier || {};
    const world = worldDigest(off) === worldDigest(on);
    const once = st.moveDup === 0 && st.lost === 0 && st.pendingAtEnd === 0 && st.moveDeliv > 0;
    const view = off.clients.map(c => c.seenSig()).every((s, i) => s === on.clients[i].seenSig());
    const bounded = st.maxSpan < st.horizon && st.deferredAcrossHandoff === 0 && st.deferN > 0;
    const migrated = off.totals.handoffs > 0 && st.handoffsObs > 0;
    const ok = check(world && once && view && bounded && migrated, `seed ${seed}: w${world}·once${once}·view${view}·bnd${bounded}·mig${migrated}`);
    console.log(`${pad(seed, 6)} | ${pad(world ? 'Y' : 'N', 5)} | ${pad(once ? 'Y' : 'N', 12)} | ${pad(view ? 'Y' : 'N', 6)} | ${pad('span' + st.maxSpan + '<' + st.horizon + '·a' + st.deferredAcrossHandoff, 20)} | ${pad(off.totals.handoffs, 8)} | ${ok ? 'OK' : 'FAIL'}`);
  }
}

kit.MODES['mze2ecap'] = mze2ecap;
kit.ORDER.splice(1, 0, 'mze2ecap');

(async () => { process.exit(await kit.cli(process.argv)); })();
