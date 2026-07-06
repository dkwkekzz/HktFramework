// HktInfra step-0489 — 헤드리스 검증 (#16 승급 라운드 2차 9: coordcap 누적 회귀 승격)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 한 조각 = 0380 grand capstone `coordcap`(#62 broker 측 제어 평면
//   상주 코디네이터 E2E: start→연속 run→z3 drift→syncPlan 자가 치유 뒤에도 실 cluster==in-proc 권위)을 누적 회귀로 승격. 박스 무수정→reg 0.
'use strict';
const NET = require('./net-core.js');
const NETPREV = require('../baseline/net-core.js');
const makeVerifyKit = require('../engine/verify-kit.js');
// #16 승급 라운드 2차 — cluster child_process grand capstone 승급용 주입 deps(verify-kit ORDER 가 상시 실행).
const { Cluster } = require('./cluster-core.js');
const { makeClusterHostDriver } = require('./cluster-hostdriver.js');
const { makeClusterCoordinator } = require('./cluster-coord.js');
const { runMultiViaCoord, coordAuthEquiv } = require('./cluster-run.js');

const SEEDS = [42, 7, 1234, 99, 2026];
const DEATH = 40; const LEASE = 3; const RESTART_AT = 60; const SNAP_N = 6; const CHAT_SNAP_N = 5; const JLOSS = 0.3;
const kit = makeVerifyKit({ NET, NETPREV, SEEDS, DEATH, LEASE, RESTART_AT, SNAP_N, CHAT_SNAP_N, JLOSS,
  Cluster, makeClusterHostDriver, makeClusterCoordinator, runMultiViaCoord, coordAuthEquiv });

(async () => { process.exit(await kit.cli(process.argv)); })();
