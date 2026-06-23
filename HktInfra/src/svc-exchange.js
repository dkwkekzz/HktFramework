'use strict';
// step-0124 정리 분할 — ExchangeService 진입점. 원장 코어 + 트랜잭션 핸들러 두 부품을 묶어 동일 export(ExchangeService) 노출(0123 과 바이트·동작 불변·reg 0).
//   net-core.js 가 __p('svc-exchange') 로 이 파일을 묶는다. 분할 이유: svc-exchange.js 가 32KB 를 넘어(비대화 트리거·박스 1개=파일 1개 유계) — 가방 svc-inventory core/txn 분할(0053)·svc-whisper 분할(0094)과 같은 패턴.
// dual-mode: Node 는 부품을 require(core→txn 순 — txn 이 core 프로토타입 증강), 브라우저는 <script> 선행 로드(전역).
const __isNode = typeof module !== 'undefined' && module.exports && typeof require !== 'undefined';
const __core = __isNode ? require('./svc-exchange-core.js') : globalThis.__HktNetParts.svc_exchange_core;
if (__isNode) { require('./svc-exchange-txn.js'); }
const __part = { ExchangeService: __core.ExchangeService };
if (typeof module !== 'undefined' && module.exports) module.exports = __part;
if (typeof globalThis !== 'undefined') (globalThis.__HktNetParts = globalThis.__HktNetParts || {}).svc_exchange = __part;
