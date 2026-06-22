// HktInfra step-0094 — 헤드리스 검증 (정리 분할: svc-whisper 박스-부품 분할·기능 0)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 은 *정리 step*(0030/0035/0043/0053 류) — 새 가설 모드 없음.
//   더한 한 조각: svc-whisper.js 가 33KB>30KB 박스 트리거(CLAUDE.md 임계 규칙)를 넘겨, svc-inventory(0043/0053) 분할 패턴으로 박스를 부품 분할 — svc-whisper-core.js(클래스·constructor·파티 원장·질의·restart) + svc-whisper-handlers.js(onMsg·onTick·Object.assign 프로토타입 증강) + svc-whisper.js(진입점). export(WhisperRouter)·동작·바이트 불변 = reg 0.
//   검증: ⒜ `reg`(키트) — 분할은 내부 구조만(동일 export·동일 메서드) → src=baseline(0093) 비트 동일. ⒝ 누적 회귀(`all`) — 전 가설 모드(0071~0093 라우팅·전달 신뢰·파티 종결·관측 포함)가 현재 코드에 그대로 통과(분할이 깨지 않음).
'use strict';
const NET = require('./net-core.js');
const NETPREV = require('../baseline/net-core.js');
const makeVerifyKit = require('../engine/verify-kit.js');

const SEEDS = [42, 7, 1234, 99, 2026];
const DEATH = 40; const LEASE = 3; const RESTART_AT = 60; const SNAP_N = 6; const CHAT_SNAP_N = 5; const JLOSS = 0.3;
const kit = makeVerifyKit({ NET, NETPREV, SEEDS, DEATH, LEASE, RESTART_AT, SNAP_N, CHAT_SNAP_N, JLOSS });

// 정리 step — 새 가설 모드 없음. kit 의 누적 회귀(reg + 전 승격 모드)가 분할의 비트 동일성을 단언한다.
(async () => { process.exit(await kit.cli(process.argv)); })();
