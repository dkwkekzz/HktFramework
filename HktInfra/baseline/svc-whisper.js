'use strict';
// step-0094 정리 분할 — WhisperRouter 진입점. 코어(클래스·constructor·파티 원장·질의·restart)와 핸들러(onMsg·onTick) 두 부품을 묶어
//   동일 export(WhisperRouter) 노출(0093 와 바이트·동작 불변·reg 0). net-core.js 가 __p('svc-whisper') 로 이 파일을 묶는다.
//   배경: svc-whisper.js 가 33KB>30KB 박스 트리거를 넘겨, svc-inventory(0043/0053) 분할 패턴으로 박스를 부품 분할(기능 0).
// dual-mode: Node 는 부품을 require(core→handlers 순 — handlers 가 core 프로토타입 증강), 브라우저는 <script> 선행 로드(전역).
const __isNode = typeof module !== 'undefined' && module.exports && typeof require !== 'undefined';
const __core = __isNode ? require('./svc-whisper-core.js') : globalThis.__HktNetParts.svc_whisper_core;
if (__isNode) require('./svc-whisper-handlers.js');
const __part = { WhisperRouter: __core.WhisperRouter };
if (typeof module !== 'undefined' && module.exports) module.exports = __part;
if (typeof globalThis !== 'undefined') (globalThis.__HktNetParts = globalThis.__HktNetParts || {}).svc_whisper = __part;
