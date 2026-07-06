// HktInfra step-0484 — 헤드리스 검증 (#16 승급 라운드 2차 4: asynce2ecap 누적 회귀 승격)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 한 조각 = 0440 grand capstone `asynce2ecap`(진짜 비동기 substrate
//   in-proc: M 복제 순열+손실→전 복제 desync0·인과 정렬)을 engine/verify-kit.js 누적 회귀로 승격. 박스 무수정→reg 0 자명·verify.js 순수 셸.
'use strict';
const NET = require('./net-core.js');
const NETPREV = require('../baseline/net-core.js');
const makeVerifyKit = require('../engine/verify-kit.js');

const SEEDS = [42, 7, 1234, 99, 2026];
const DEATH = 40; const LEASE = 3; const RESTART_AT = 60; const SNAP_N = 6; const CHAT_SNAP_N = 5; const JLOSS = 0.3;
const kit = makeVerifyKit({ NET, NETPREV, SEEDS, DEATH, LEASE, RESTART_AT, SNAP_N, CHAT_SNAP_N, JLOSS });

(async () => { process.exit(await kit.cli(process.argv)); })();
