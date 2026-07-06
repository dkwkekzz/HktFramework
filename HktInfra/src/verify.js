// HktInfra step-0485 — 헤드리스 검증 (#16 승급 라운드 2차 5: worldcap 누적 회귀 승격)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 한 조각 = 0350 grand capstone `worldcap`(월드 다운스트림 E2E:
//   host AOI→포착→전파→실 DownClient 수렴 desync0·게이트웨이 격리·SPINE §4 경로2)을 누적 회귀로 승격. 박스 무수정→reg 0 자명·verify.js 순수 셸.
'use strict';
const NET = require('./net-core.js');
const NETPREV = require('../baseline/net-core.js');
const makeVerifyKit = require('../engine/verify-kit.js');

const SEEDS = [42, 7, 1234, 99, 2026];
const DEATH = 40; const LEASE = 3; const RESTART_AT = 60; const SNAP_N = 6; const CHAT_SNAP_N = 5; const JLOSS = 0.3;
const kit = makeVerifyKit({ NET, NETPREV, SEEDS, DEATH, LEASE, RESTART_AT, SNAP_N, CHAT_SNAP_N, JLOSS });

(async () => { process.exit(await kit.cli(process.argv)); })();
