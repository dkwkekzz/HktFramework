// HktInfra step-0035 — 버스 failover: 구독 재협상으로 라우팅 복구 (bus crash → re-sub → 서비스 경로 복원).
// step-0033(동적 구독/해지) 위에 *한 조각*만 더한다: ServiceBus.crash()(라우팅 RAM 소실 = 서비스 경로 단절) + 복구는 *소비자들의
//   재구독*(0033 동적 sub 의 재협상 용례). 핵심 통찰: 버스는 *파생 상태*(라우팅 테이블)만 들고 진실 원천은 *소비자*다 — 그래서
//   버스 failover 는 버스 내부 영속(저널/스냅샷) 없이도, 소비자가 (같은 주소의) 새 버스에 sub 를 재발신하면 라우팅이 재구성된다(이력 replay 불필요).
//   닿는 박스 파일: svc-bus.js(crash) · topology.js(busRestart 트리거·재협상 = 정적 subs spec 재발신) 둘뿐. 새 검증 모드 = `busfail`(verify.js 셸 한정).
//
// 척추(SPINE.md) 준수: 버스는 여전히 *순수 반응형*(onTick 0)·신성한 tick 밖이며 라우팅 Map 이 유일 SSOT. crash/재협상은 제어 평면
//   (정규 net.send) — 결정론·은닉 불변. busRestart 미제공 시 crash 0 → 회귀 0(reg 25/25 비트 동일·E2E cluster.js 무수정). 발행자는 같은 'bus' 주소라 무수정.
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
