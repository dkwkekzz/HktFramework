// HktInfra step-0449 — 헤드리스 검증 (#4 실 net.step 배리어 치환 9: lockstep 배리어 등가·실 engine Net 대조)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 모드 = `netbarrier`.
//   더한 한 조각: async-net.runLockstepEngine — 실 engine Net(중앙 lockstep 배리어 net.step)에 client 발신 actor+존 수신 actor
//   register·구동. 명제: 배리어(net.step)로 배달하든 배리어-free substrate 로 배달하든 존 실 월드 == canonical(치환 결과 불변).
//   대조: net.step 도착 순서 그대로 fold(naive)는 전순서 미적용→갈림(substrate load-bearing). run() 밖 → reg 0.
//   검증: ⒜ `reg`. ⒝ `netbarrier` — 배리어+substrate==canonical·배리어-free async==canonical·naive 갈림·무손실 delivered==N.
'use strict';
const NET = require('./net-core.js');
const NETPREV = require('../baseline/net-core.js');
const makeVerifyKit = require('../engine/verify-kit.js');

const SEEDS = [42, 7, 1234, 99, 2026];
const DEATH = 40; const LEASE = 3; const RESTART_AT = 60; const SNAP_N = 6; const CHAT_SNAP_N = 5; const JLOSS = 0.3;
const kit = makeVerifyKit({ NET, NETPREV, SEEDS, DEATH, LEASE, RESTART_AT, SNAP_N, CHAT_SNAP_N, JLOSS });

const { check, pad } = kit.helpers;

// step-0449 #4 배리어 치환 9 — netbarrier: 실 engine Net 배리어 vs 배리어-free substrate 등가(둘 다 canonical)·naive 갈림.
function netbarrier(seeds) {
  console.log('== netbarrier (0449·#4 배리어 치환 9): 실 engine Net 배리어 == 배리어-free substrate(둘 다 canonical)·naive 갈림. ==');
  console.log('seed   | 이벤트 | delivered | 배리어+substrate | 배리어-free async | naive갈림 | 판정');
  for (const seed of seeds) {
    const C = 4, M = 4, MS = 40;
    const s = NET.worldIntentStream(seed, { clients: C, avatars: 4, msgs: MS });
    const events = NET.withSseq(s.events);
    const canonical = NET.simFold(NET.totalOrder(events), seed, s.avatars).digest;
    const L = NET.runLockstepEngine(s.events, seed, s.avatars, C);       // 실 engine Net lockstep
    const asyncD = NET.convergeReplicas(events, M, seed, s.avatars, C, { lossy: true });   // 배리어-free
    const lockstepEq = L.totalDigest === canonical && L.delivered === MS;
    const asyncEq = asyncD.every(d => d === canonical);
    const naiveDiv = L.arrivalDigest !== canonical;
    const ok = check(lockstepEq && asyncEq, `seed ${seed}: barrier ${lockstepEq}·async ${asyncEq}·delivered ${L.delivered}·naiveDiv ${naiveDiv}`);
    console.log(`${pad(seed, 6)} | ${pad(MS, 6)} | ${pad(L.delivered, 9)} | ${pad(lockstepEq ? 'Y' : 'N', 16)} | ${pad(asyncEq ? 'Y' : 'N', 17)} | ${pad(naiveDiv ? 'Y' : 'N', 9)} | ${ok ? 'OK' : 'FAIL'}`);
  }
}

kit.MODES['netbarrier'] = netbarrier;
kit.ORDER.splice(1, 0, 'netbarrier');

(async () => { process.exit(await kit.cli(process.argv)); })();
