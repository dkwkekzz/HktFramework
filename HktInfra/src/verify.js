// HktInfra step-0486 — 헤드리스 검증 (#16 승급 라운드 2차 6: upce2ecap 누적 회귀 승격)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 한 조각 = 0480 grand capstone `upce2ecap`(실 UpClient 발신 intent 가
//   실 host.js child 프로세스 경계를 넘어 존에 닿고 egress 뷰 되먹임 E2E)을 누적 회귀로 승격. 첫 cluster child_process capstone
//   승급 — verify.js 셸이 Cluster/makeClusterHostDriver 등 cluster deps 를 ctx 로 주입(engine→src 결합 없이). 박스 무수정→reg 0 자명.
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
