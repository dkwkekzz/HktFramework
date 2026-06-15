// HktInfra step-0042 — 요청 replay 버퍼 *자기-크기조정* (ack 기반 가지치기·busAck — 고정 K 수동 튜닝 해소).
//   0039 고정 K(busWindow)는 *최대 예상 gap(다운타임×발신율)* 을 사전 추정해야 한다 — 작으면 손실·크면 메모리 낭비(0039 §9).
//   ack-가지치기: 가방이 처리한 reqId 를 svc.item.ack 로 통보 → 게이트웨이가 ack 워터마크 이하 inBuffer 를 제거 → 버퍼엔 *미-ack(in-flight)* 만 남는다.
//   정상 구간엔 ack 가 흘러 버퍼가 0 으로 drain·gap 구간엔 ack 도 끊겨 버퍼가 gap 만큼 *자동 성장* → 복구 replay 가 정확히 그만큼 덮어 *K 추정 없이* 무손실.
//   닿는 박스: svc-inventory.js(reqId ack 발행)·gateway.js(ack 워터마크 가지치기·peak 계측)·topo-build.js(busAck 배선·svc.item.ack 구독). busAck=0 = 0039 비트 동일.
//
// 척추(SPINE.md) 준수: busAck=0(기본)→0039 비트 동일(reg 0·OFF 경로 휴면)·존 tick 밖 제어 평면(신성한 tick 보존)·headless 원격 검증 무변경.
//   ack 무손실(minted==base·desync 0)·버퍼 peak 가 가동 길이 무관(무계는 ∝발신 수)·idle drain. 동결 단위는 step-0042/ 디렉토리 통째.
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
