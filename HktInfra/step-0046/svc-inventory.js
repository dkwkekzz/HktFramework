'use strict';
// step-0046 정리 분할 — InventoryService 진입점. 원장 코어 + write-behind 영속 + 버스 결과/replay 세 부품을 묶어
//   동일 export(InventoryService) 노출(0042 와 바이트·동작 불변·reg 0). net-core.js 가 __p('svc-inventory') 로 이 파일을 묶는다.
// dual-mode: Node 는 부품을 require(core→persist→bus 순 — persist/bus 가 core 프로토타입 증강), 브라우저는 <script> 선행 로드(전역).
const __isNode = typeof module !== 'undefined' && module.exports && typeof require !== 'undefined';
const __core = __isNode ? require('./svc-inventory-core.js') : globalThis.__HktNetParts.svc_inventory_core;
if (__isNode) { require('./svc-inventory-persist.js'); require('./svc-inventory-bus.js'); }
const __part = { InventoryService: __core.InventoryService };
if (typeof module !== 'undefined' && module.exports) module.exports = __part;
if (typeof globalThis !== 'undefined') (globalThis.__HktNetParts = globalThis.__HktNetParts || {}).svc_inventory = __part;
