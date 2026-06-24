// HktInfra step-0240 — 헤드리스 검증 셸 (loginabandon 모드를 verify-kit 으로 승급·#16 3차 라운드 누적 회귀화 완료)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 은 새 가설 모드 없음 — 0230 의 loginabandon 을 누적 키트로 *이동*(승급)했다.
//   3차 균형 라운드(0221~0230) 10개 bespoke 모드 전부가 이제 verify-kit 누적 회귀(spine)에 산다(#16 완료).
'use strict';
const NET = require('./net-core.js');
const NETPREV = require('../baseline/net-core.js');
const makeVerifyKit = require('../engine/verify-kit.js');

const SEEDS = [42, 7, 1234, 99, 2026];
const DEATH = 40; const LEASE = 3; const RESTART_AT = 60; const SNAP_N = 6; const CHAT_SNAP_N = 5; const JLOSS = 0.3;
const kit = makeVerifyKit({ NET, NETPREV, SEEDS, DEATH, LEASE, RESTART_AT, SNAP_N, CHAT_SNAP_N, JLOSS });

(async () => { process.exit(await kit.cli(process.argv)); })();
