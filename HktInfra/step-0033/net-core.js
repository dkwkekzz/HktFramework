// HktInfra step-0033 — 버스 동적 구독/해지 (runtime sub/unsub) — bus failover(영속·재라우팅)의 선결.
// step-0032 위에 *한 조각*만 더한다: ServiceBus 의 `unsub` 메시지(sub seam 과 대칭) + 런타임에 라우팅 테이블을 *양방향*으로 바꾸는 능력.
//   0016 이래 버스 구독은 토폴로지 빌더의 *정적 선언 spec* 으로만 채워졌다 — 분산 버스가 죽고 살아날 때 구독이 재협상되려면(소비자가
//   새 브로커에 재구독·이전 라우트 해지) 라우팅 테이블을 런타임에 바꾸는 토대가 먼저다. 닿는 박스 파일: svc-bus.js(unsub+회계) ·
//   topology.js(busReSub 제어 평면 트리거) 둘뿐. 새 검증 모드 = `busdyn`(verify.js 셸 한정).
//
// 척추(SPINE.md) 준수: 버스는 여전히 *순수 반응형*(onTick 0)·신성한 tick 밖이며 라우팅 테이블 Map 이 유일 SSOT. sub/unsub 은 제어
//   평면(정규 net.send) — 결정론·은닉 불변. busReSub 미제공 시 unsub/동적 코드 휴면 → 회귀 0(reg 25/25 비트 동일·E2E cluster.js 무수정).
//   headless·원격 검증: node run.js 가 이 진입점 하나를 require — 검증 경로 무변경.
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
  __p('persist'), __p('client'), __p('metrics'), __p('topology'),
  { PUBLIC_ADDRS, DEFAULTS: __c.DEFAULTS, SUPPORTS });
if (typeof module !== 'undefined' && module.exports) module.exports = __hktNet;
if (typeof globalThis !== 'undefined') globalThis.HktNet = __hktNet;
