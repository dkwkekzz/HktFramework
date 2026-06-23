'use strict';
// step-0165 정리 분할 — MailService 진입점. 원장 코어 + 트랜잭션 핸들러 + 영속·failover(step-0171) 세 부품을 묶어 동일 export(MailService) 노출(직전과 바이트·동작 불변·reg 0).
//   net-core.js 가 __p('svc-mail') 로 이 파일을 묶는다. 분할 이유: svc-mail-core.js 가 30KB 를 넘어(비대화 트리거·박스 1개=파일 1개 유계) — 거래소 svc-exchange core/txn(0124)·가방 svc-inventory core/txn/persist(0053)·svc-whisper(0094) 와 같은 패턴.
// dual-mode: Node 는 부품을 require(core→txn→persist 순 — txn/persist 가 core 프로토타입 증강), 브라우저는 <script> 선행 로드(전역).
const __isNode = typeof module !== 'undefined' && module.exports && typeof require !== 'undefined';
const __core = __isNode ? require('./svc-mail-core.js') : globalThis.__HktNetParts.svc_mail_core;
if (__isNode) { require('./svc-mail-txn.js'); require('./svc-mail-persist.js'); }
const __part = { MailService: __core.MailService };
if (typeof module !== 'undefined' && module.exports) module.exports = __part;
if (typeof globalThis !== 'undefined') (globalThis.__HktNetParts = globalThis.__HktNetParts || {}).svc_mail = __part;
