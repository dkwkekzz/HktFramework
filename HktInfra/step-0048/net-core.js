// HktInfra step-0048 — per-producer seen 워터마크 (busProducerNs 복합키를 busSeenBound 가 가지치게·busSeenNs·0046 §9/리뷰 §1 해소).
//   0046 busProducerNs ON 이면 seenReqs 키가 *복합키*(`producer\0reqId`·문자열)인데, 0042 busSeenBound 의 prune 은 `r <= upTo`(숫자 비교) → `'gw\05' <= 5` 는 false(NaN)
//   → 복합키가 *영영* 안 가지쳐져 seenReqs 가 무계 회귀(busSeenBound 가 사실상 무력). 두 기능이 독립 copy-forward 되며 정합 안 됐던 잠복 버그(리뷰 §1).
//   해법: 게이트웨이가 svc.item.seen 워터마크에 producer 태깅 → 가방이 producer 별 워터마크(producerSeenWm)로 *그 producer 의* 복합키만(접두사 일치 + 숫자 suffix ≤ upTo) 가지친다. 0046 producer 네임스페이스의 *prune 측* 완결.
//   닿는 박스: gateway.js(svc.item.seen 에 producer 태깅)·svc-inventory-core.js(producerSeenWm 상태·복합키 구분자 텍스트화)·svc-inventory-bus.js(_onSeenWatermark producer 별 가지치기)·topo-build.js(busSeenNs 배선). busSeenNs=0 = 0046 비트 동일.
//
// 척추(SPINE.md) 준수: busSeenNs=0(기본)→0046 비트 동일(reg 0·seen 미태깅·숫자 prune)·존 tick 밖 제어 평면(신성한 tick 보존)·headless 원격 검증 무변경.
//   ON 이면 복합키 seenReqs 가 유계(run-length 무관·idle drain)·minted 보존(가지친 reqId 미-재출현·dupe 0). 동결 단위는 step-0048/ 디렉토리 통째.
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
