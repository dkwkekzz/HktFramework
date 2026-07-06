// HktInfra step-0481 — 헤드리스 검증 (#16 승급 라운드 2차 1: mze2ecap 누적 회귀 승격)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 한 조각 = 0470 grand capstone `mze2ecap` 를
//   engine/verify-kit.js 의 누적 회귀(MODES+ORDER)로 승격 — 옛 bespoke 검증이 HEAD 재검증 불가였던 격차 해소.
//   박스 `.js` 0줄 수정(verify-kit·verify 는 baseline 비대상) → reg 0 자명. verify.js 는 순수 셸로 위임.
'use strict';
const NET = require('./net-core.js');
const NETPREV = require('../baseline/net-core.js');
const makeVerifyKit = require('../engine/verify-kit.js');

const SEEDS = [42, 7, 1234, 99, 2026];
const DEATH = 40; const LEASE = 3; const RESTART_AT = 60; const SNAP_N = 6; const CHAT_SNAP_N = 5; const JLOSS = 0.3;
const kit = makeVerifyKit({ NET, NETPREV, SEEDS, DEATH, LEASE, RESTART_AT, SNAP_N, CHAT_SNAP_N, JLOSS });

(async () => { process.exit(await kit.cli(process.argv)); })();
