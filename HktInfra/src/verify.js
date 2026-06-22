// HktInfra step-0098 — 헤드리스 검증 (정리 분할: topo-build 박스-부품 분할·기능 0)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 은 *정리 step*(0030/0035/0038/0094 류) — 새 가설 모드 없음.
//   더한 한 조각: topo-build.js 가 32KB>30KB 박스 트리거를 넘겨, *액터 팩토리 + 라우트 필터*(makeActor·routeFilters·박스 클래스 import)를 topo-actors.js 로 분리 — buildTopology(선언적 spec 빌더·외부 의존 0)는 topo-build.js 에 남고 진입점이 topo-actors 를 require 해 동일 export(routeFilters·buildTopology·makeActor) 노출. verbatim 이동 = reg 0.
//   검증: ⒜ `reg`(키트) — 분할은 내부 구조만(동일 export·동일 함수) → src=baseline(0097) 비트 동일. ⒝ 누적 회귀(`all`) — 전 가설 모드가 현재 코드에 그대로 통과(분할이 안 깨짐).
'use strict';
const NET = require('./net-core.js');
const NETPREV = require('../baseline/net-core.js');
const makeVerifyKit = require('../engine/verify-kit.js');

const SEEDS = [42, 7, 1234, 99, 2026];
const DEATH = 40; const LEASE = 3; const RESTART_AT = 60; const SNAP_N = 6; const CHAT_SNAP_N = 5; const JLOSS = 0.3;
const kit = makeVerifyKit({ NET, NETPREV, SEEDS, DEATH, LEASE, RESTART_AT, SNAP_N, CHAT_SNAP_N, JLOSS });

// 정리 step — 새 가설 모드 없음. kit 의 누적 회귀(reg + 전 승격 모드)가 분할의 비트 동일성을 단언한다.
(async () => { process.exit(await kit.cli(process.argv)); })();
