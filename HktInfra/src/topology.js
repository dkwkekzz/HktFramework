'use strict';
// step-0141 정리 분할 — topology.js 가 31.5KB>30KB 박스 트리거를 넘겨, *run 드라이버*(quorumMergeJournals·run·runMulti)를
//   topo-run.js 로 분리했다. 이 파일은 *진입점*으로 남아 토폴로지 구성 부품(topo-build: routeFilters·buildTopology·makeActor)과
//   run 드라이버 부품(topo-run: quorumMergeJournals·run·runMulti)을 묶어 동일 export 를 노출한다 —
//   기능 0·바이트 동일·export 불변 → reg 0(0140 비트 동일). 0038 분할(build) 이후 두 번째 topology 슬림화.
// dual-mode: Node 는 부품을 require, 브라우저는 common.js·박스 파일을 <script> 선행 로드(전역 __HktNetParts).
const __isNode = typeof module !== 'undefined' && module.exports && typeof require !== 'undefined';
const __p = n => __isNode ? require('./' + n + '.js') : globalThis.__HktNetParts[n.replace(/-/g, '_')];
const { routeFilters, buildTopology, makeActor } = __p('topo-build');
const { quorumMergeJournals, run, runMulti } = __p('topo-run');   // step-0141 분할 — run 드라이버.

const __part = { routeFilters, buildTopology, makeActor, quorumMergeJournals, run, runMulti };
if (typeof module !== 'undefined' && module.exports) module.exports = __part;
if (typeof globalThis !== 'undefined') (globalThis.__HktNetParts = globalThis.__HktNetParts || {}).topology = __part;
