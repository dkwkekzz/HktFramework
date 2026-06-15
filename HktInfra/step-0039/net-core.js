// HktInfra step-0039 — 버스 failover replay 버퍼 *유계화* (busWindow 슬라이딩 K 창 — 메모리 무계 성장 해소).
//   0036 outBuffer(가방 결과 replay)·0037 inBuffer(게이트웨이 요청 replay)는 발신한 *전* 결과/요청을 무계로 쌓아 장기 가동 시 메모리 무한 성장.
//   failover 가 메우려는 건 gap 구간(crash→재구독)뿐이므로, 버퍼는 그 창을 덮을 만큼만 있으면 된다 — busWindow=K 면 두 버퍼를 *최근 K 개*로 슬라이딩(0032 wfWindow 의 버스 판).
//   닿는 박스: gateway.js(inBuffer 슬라이딩)·svc-inventory.js(outBuffer 슬라이딩)·topo-build.js(busWindow 배선). K=0 = 0038 비트 동일.
//
// 척추(SPINE.md) 준수: busWindow=0(기본)→0038 비트 동일(reg 0·OFF 경로 휴면)·존 tick 밖 제어 평면(신성한 tick 보존)·headless 원격 검증 무변경.
//   K≥gap 이면 유계화가 동작에 *투명*(minted==base·desync 0)·K<gap 이면 손실 재현(바운드 load-bearing). 동결 단위는 step-0039/ 디렉토리 통째.
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
