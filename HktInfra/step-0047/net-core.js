// HktInfra step-0047 — 다중 게이트웨이 producer 네임스페이스 (가방 요청 dedup 을 (producer,reqId) 복합키로·busProducerNs·0042 §9 ① 해소).
//   0037 reqId 는 *producer-local* 단조 카운터(게이트웨이마다 0,1,2…)다 — 단일 게이트웨이면 충분하나, SPINE "게이트웨이 군"처럼 *다중* 게이트웨이가 같은 가방에 발신하면
//   reqId 네임스페이스가 겹친다(gw1 reqId k vs gw2 reqId k) → 단일 네임스페이스 seenReqs 가 gw2 의 k 를 gw1 의 *이미 처리한 k* 로 오인해 폐기(둘째 producer 요청 손실).
//   해법: dedup 키를 (producer,reqId) 복합키로 분리 — 가방은 버스 너머라 발신 게이트웨이를 구별 못 하므로(은닉) 요청에 실린 producer 태그가 유일한 네임스페이스 신호. 0044 *소비자* min-워터마크의 *producer 측* 거울.
//   닿는 박스: gateway.js(svc.item 에 producer 태깅)·svc-inventory-core.js(seenReqs 복합키 dedup)·topo-build.js(busProducerNs 배선)·topology.js(producerInject 둘째 producer 자극). busProducerNs=0 = 0045 비트 동일.
//
// 척추(SPINE.md) 준수: busProducerNs=0(기본)→0045 비트 동일(reg 0·producer 미태깅·키=bare reqId)·존 tick 밖 제어 평면(신성한 tick 보존)·headless 원격 검증 무변경.
//   ON 이면 둘째 게이트웨이 reqId 충돌이 분리돼 요청 손실 0(minted 보존)·원장 권위 무영향. 동결 단위는 step-0047/ 디렉토리 통째.
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
