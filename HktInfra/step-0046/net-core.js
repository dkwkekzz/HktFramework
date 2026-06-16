// HktInfra step-0046 — 소비자 lease/축출 (영구 뒤처진 소비자를 min 정의역에서 떨궈 outBuffer 무계 보유 해소·busConsumerLease).
//   0044 min-워터마크(busMinWm)는 outBuffer 를 *모든 기대 소비자 frontier 의 최소(min)*까지만 가지친다 — 자기-크기조정이 *가장 느린* 소비자에 묶인다(0044 §9 대가).
//   한 소비자(ranking)가 *영영* 죽어 ack 가 끊기면 min 이 그 frontier 에 고정 → outBuffer 가 생산량(run-length)에 비례해 무계 성장한다.
//   lease: 가방이 각 소비자의 *침묵 길이*(마지막 ack 시점의 생산자 frontier 대비 전진폭)를 추적 → leaseSpan 이상 침묵한 소비자를 *축출*(evicted Set·min 정의역 제외) → min 이 산 소비자만으로 전진 → 버퍼 drain.
//   닿는 박스: svc-inventory-core.js(lease 상태·crash 리셋)·svc-inventory-bus.js(_onOutAck 침묵 sweep·축출·min 정의역 제외)·topo-build.js(busConsumerLease/leaseSpan 배선)·topology.js(rankDie 영구 다운 자극). busConsumerLease=0 = 0044 비트 동일.
//
// 척추(SPINE.md) 준수: busConsumerLease=0(기본)→0044 비트 동일(reg 0·evicted 항상 빔 → min 정의역 무변경)·존 tick 밖 순수 반응형 제어 평면(신성한 tick 보존)·headless 원격 검증 무변경.
//   lease ON 이면 죽은 소비자 축출 후 outBuffer peak 가 run-length 무관(유계)·산 소비자 오축출 0·원장 권위 무영향. 동결 단위는 step-0046/ 디렉토리 통째.
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
