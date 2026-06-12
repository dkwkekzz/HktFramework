// HktInfra step-0031 — 헤드리스 검증 (정리 step: net-core 박스=파일 분할 + verify 키트 engine 승격 — 기능 추가 0)
// 사용: node step-0031/verify.js <mode> [seed]
//   mode 카탈로그·각 모드 문서: engine/verify-kit.js 헤더 (0001~0029 누적 모드는 키트로 승격 — 이 step 의 새 모드 0).
//   이 step 의 가설은 "분할·승격이 동작 불변"이다 — reg(직전 0029 와 비트 동일) + 전 모드 통과 + spine 사슬이 그 증명.
// 새 step 작성법(다음 step 부터): 이 파일에 새 가설 모드만 추가한다 —
//   kit.MODES['<mode>'] = fn; kit.ORDER.splice(1, 0, '<mode>');   (누적 회귀는 키트가 든다)
'use strict';
const NET = require('./net-core.js');
const NETPREV = require('../step-0030/net-core.js');   // reg 대조용(직전 step)
const makeVerifyKit = require('../engine/verify-kit.js');

const SEEDS = [42, 7, 1234, 99, 2026];
const DEATH = 40;        // 권위 존 사망 tick(failover)
const LEASE = 3;         // lease 결손 임계
const RESTART_AT = 60;   // 가방 서비스 재시작 tick(quiescent — 저널 drain 완료 → 복구 투명)
const SNAP_N = 6;        // 가방 저널 스냅샷 압축 주기(0018)
const CHAT_SNAP_N = 5;   // 채팅 커맨드 로그 스냅샷 압축 주기(0022)
const JLOSS = 0.3;       // 저널 홉 손실율(0023~) — inventory→persist 홉 신뢰 NAK/재전송 자극

const kit = makeVerifyKit({ NET, NETPREV, SEEDS, DEATH, LEASE, RESTART_AT, SNAP_N, CHAT_SNAP_N, JLOSS });
// 이 step 의 새 모드: 없음(정리 step — 구조만 변경, reg 가 가설 그 자체).

(async () => { process.exit(await kit.cli(process.argv)); })();
