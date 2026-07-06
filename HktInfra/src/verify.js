// HktInfra step-0490 — 헤드리스 검증 (#16 승급 라운드 2차 10·arc 닫기: promoted16 등록 가드)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 한 조각 = arc 정리 — 승급한 grand capstone 9종이 ORDER 누적 회귀에
//   항구 등록됐는지 가드하는 `promoted16` 모드 추가(향후 우발 제거 방지·"no silent cap") + verify-kit 헤더 카탈로그 갱신. 박스 무수정→reg 0 자명.
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
