// HktInfra step-0460 — 헤드리스 검증 (#4 실 net.step 배리어 실제 치환 10·grand capstone: run() E2E)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 모드 = `bare2ecap`.
//   더한 한 조각: grand capstone — 실 `run()` 의 net.step 중앙 배리어를 async-barrier 로 치환해 ⒜ 단일 존 손실+지연+resync 하
//   world==lockstep·exactly-once(moveDup0)·다운스트림 뷰 수렴(desync0) ⒝ 다중 존+핸드오프 투명(world/log==lockstep) 를 한 시나리오로
//   단언. #4 실 net.step 배리어 실제 치환 sub-arc(0451~0460) 닫기. asyncBarrier OFF → reg 구조적 0.
//   검증: ⒜ `reg`. ⒝ `bare2ecap` — 손실+지연 world/뷰==lockstep·exactly-once·다중 존 투명·resyncs/delayed>0.
'use strict';
const NET = require('./net-core.js');
const NETPREV = require('../baseline/net-core.js');
const makeVerifyKit = require('../engine/verify-kit.js');

const SEEDS = [42, 7, 1234, 99, 2026];
const DEATH = 40; const LEASE = 3; const RESTART_AT = 60; const SNAP_N = 6; const CHAT_SNAP_N = 5; const JLOSS = 0.3;
const kit = makeVerifyKit({ NET, NETPREV, SEEDS, DEATH, LEASE, RESTART_AT, SNAP_N, CHAT_SNAP_N, JLOSS });

const { check, pad, worldDigest, logDigest } = kit.helpers;

// step-0460 #4 실 치환 10·grand capstone — bare2ecap: run() 배리어 치환 E2E(손실+지연 world/뷰==lockstep·exactly-once·다중 존 투명). 0451~0460 닫기.
function bare2ecap(seeds) {
  console.log('== bare2ecap (0460·#4 grand capstone): run() net.step 배리어 치환 — 손실+지연 world/뷰==lockstep·exactly-once·다중 존 투명. 0451~0460 닫기. ==');
  console.log('seed   | 단일존 world/뷰 | exactly-once | resync·delay | 다중존 world/log | 판정');
  for (const seed of seeds) {
    // ⒜ 단일 존: 손실+지연+resync
    const b1 = { seed, ticks: 48, clients: 4, moves: 30, radius: 4, grid: 16, incremental: true, zones: 1 };
    const off1 = NET.run({ ...b1 });
    const on1 = NET.run({ ...b1, asyncBarrier: { loss: 0.2, delay: 0.3, delayMax: 3, resync: true, resyncDelay: 2, seed, ticks: 48 } });
    const sig = r => r.clients.map(c => c.seenSig()).join('|');
    const wv1 = worldDigest(off1) === worldDigest(on1) && sig(off1) === sig(on1);
    const st = on1.asyncBarrier || { moveDup: 0, resyncs: 0, delayed: 0 };
    const once = st.moveDup === 0;
    const pert = st.resyncs > 0 && st.delayed > 0;
    // ⒝ 다중 존+핸드오프: 투명
    const b2 = { seed, ticks: 70, clients: 6, moves: 30, radius: 4, grid: 16, incremental: true, zones: 2 };
    const off2 = NET.run({ ...b2 });
    const on2 = NET.run({ ...b2, asyncBarrier: true });
    const mz = worldDigest(off2) === worldDigest(on2) && logDigest(off2) === logDigest(on2) && off2.totals.handoffs > 0;
    const ok = check(wv1 && once && pert && mz, `seed ${seed}: 단일 ${wv1}·once ${once}·pert r${st.resyncs}/d${st.delayed}·다중 ${mz}`);
    console.log(`${pad(seed, 6)} | ${pad(wv1 ? 'Y' : 'N', 14)} | ${pad(once ? 'Y' : 'N', 12)} | ${pad('r' + st.resyncs + '·d' + st.delayed, 12)} | ${pad(mz ? 'Y' : 'N', 16)} | ${ok ? 'OK' : 'FAIL'}`);
  }
}

kit.MODES['bare2ecap'] = bare2ecap;
kit.ORDER.splice(1, 0, 'bare2ecap');

(async () => { process.exit(await kit.cli(process.argv)); })();
