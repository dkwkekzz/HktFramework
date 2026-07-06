// HktInfra step-0520 — 헤드리스 검증 (#46 금고↔가방 escrow 10·arc 닫기: guildbankcap — grand capstone 네 정합층)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 한 조각 = 물리 이동+2-서비스 보존+saga 정합+교차 회계 네 층 동시 성립(거래소 0140·우편 0180 의 금고 판·#46 arc 닫기)
//   pure-verify grand capstone verify-kit ORDER 편입. 박스 무변→reg 0 자명. verify.js 는 cluster deps 주입 셸.
'use strict';
const NET = require('./net-core.js');
const NETPREV = require('../baseline/net-core.js');
const makeVerifyKit = require('../engine/verify-kit.js');
const { Cluster } = require('./cluster-core.js');
const { makeClusterHostDriver } = require('./cluster-hostdriver.js');
const { makeClusterCoordinator } = require('./cluster-coord.js');
const { runMultiViaCoord, coordAuthEquiv } = require('./cluster-run.js');

const SEEDS = [42, 7, 1234, 99, 2026];
const DEATH = 40; const LEASE = 3; const RESTART_AT = 60; const SNAP_N = 6; const CHAT_SNAP_N = 5; const JLOSS = 0.3;
const kit = makeVerifyKit({ NET, NETPREV, SEEDS, DEATH, LEASE, RESTART_AT, SNAP_N, CHAT_SNAP_N, JLOSS,
  Cluster, makeClusterHostDriver, makeClusterCoordinator, runMultiViaCoord, coordAuthEquiv });

(async () => { process.exit(await kit.cli(process.argv)); })();
