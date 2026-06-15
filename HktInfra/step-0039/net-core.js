// HktInfra step-0039 — 정리 step: topology.js 박스-부품 분할 (31KB>30KB 박스 트리거 — 기능 추가 0).
//   topology.js 가 31KB 로 박스 임계(30KB)를 넘겨, *토폴로지 구성*(routeFilters·buildTopology·makeActor)을 topo-build.js 로 분리한다.
//   topology.js 는 *run 드라이버 + 진입점*(quorumMergeJournals·run·runMulti)으로 남고, build 부품을 require 해 동일 export 를 재노출.
//   이 net-core 진입점은 부품 목록에 topo-build.js 를 더해 묶을 뿐(export 집합·동작 불변) — 0030 net-core 분할·0035 cluster 분할의 topology 판.
//
// 척추(SPINE.md) 준수: 기능 0·바이트 동일(verbatim 이동)·export 집합 불변 → reg 0(0037 비트 동일·E2E cluster.js 무수정).
//   분할은 *내부 파일 구조*만 — 동결 단위는 여전히 step-0039/ 디렉토리 통째. headless·원격 검증: node run.js 가 이 진입점 하나를 require — 검증 경로 무변경.
'use strict';
const __isNode = typeof module !== 'undefined' && module.exports && typeof require !== 'undefined';
const __c = __isNode ? require('./common.js') : globalThis.__HktNetCommon;
const __p = n => __isNode ? require('./' + n + '.js') : globalThis.__HktNetParts[n.replace(/-/g, '_')];

// 라이브 testbed(run.js) 의 기능 탐지 — 시나리오 inject write-seam 지원(0016 에서 심음 — TESTBED §10-4).
const SUPPORTS = { inject: true };
const PUBLIC_ADDRS = ['login', 'gateway'];

// ── 모듈 노출 (dual-mode) — export 집합은 0029 와 동일(분할은 내부 구조만) ───────────
const __hktNet = Object.assign(
  { mulberry32: __c.mulberry32, fnv1a: __c.fnv1a, Net: __c.Net, LoginServer: __c.LoginServer, SessionRegistry: __c.SessionRegistry },
  __p('gateway'), __p('orchestrator'), __p('zone'),
  __p('svc-inventory'), __p('svc-chat'), __p('svc-bus'), __p('svc-audit'), __p('svc-ranking'),
  __p('persist'), __p('client'), __p('metrics'), __p('topo-build'), __p('topology'),
  { PUBLIC_ADDRS, DEFAULTS: __c.DEFAULTS, SUPPORTS });
if (typeof module !== 'undefined' && module.exports) module.exports = __hktNet;
if (typeof globalThis !== 'undefined') globalThis.HktNet = __hktNet;
