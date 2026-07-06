// HktInfra step-0491 — 헤드리스 검증 (#16 승급 라운드 3차 1: svcexchangecap 서비스 saga capstone 재작성 편입)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 한 조각 = 거래소↔가방 saga 정합 capstone(0140 sagaLiveConsistent 판)을
//   *재작성*해 verify-kit ORDER 로 편입(옛 코드 git 소실→run() 을 exchange+saga opts 로 구동·정합 술어 단언). 박스 무수정→reg 0 자명.
'use strict';
const NET = require('./net-core.js');
const NETPREV = require('../baseline/net-core.js');
const makeVerifyKit = require('../engine/verify-kit.js');
// cluster child_process grand capstone(0486~0489) 승급용 주입 deps(verify-kit ORDER 가 상시 실행).
const { Cluster } = require('./cluster-core.js');
const { makeClusterHostDriver } = require('./cluster-hostdriver.js');
const { makeClusterCoordinator } = require('./cluster-coord.js');
const { runMultiViaCoord, coordAuthEquiv } = require('./cluster-run.js');

const SEEDS = [42, 7, 1234, 99, 2026];
const DEATH = 40; const LEASE = 3; const RESTART_AT = 60; const SNAP_N = 6; const CHAT_SNAP_N = 5; const JLOSS = 0.3;
const kit = makeVerifyKit({ NET, NETPREV, SEEDS, DEATH, LEASE, RESTART_AT, SNAP_N, CHAT_SNAP_N, JLOSS,
  Cluster, makeClusterHostDriver, makeClusterCoordinator, runMultiViaCoord, coordAuthEquiv });

(async () => { process.exit(await kit.cli(process.argv)); })();
