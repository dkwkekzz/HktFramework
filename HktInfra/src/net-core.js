// HktInfra step-0048 — 소비자 lease lifecycle 정합 (시작-시점 죽음 축출 + 축출 비가역 해소·busLeaseLife·0045 §9/리뷰 §2·§3 해소).
//   0045 소비자 lease(busConsumerLease)는 침묵 기준(consumerSeen)을 *그 소비자가 처음 ack 한 시점*에야 세운다 → 두 빈틈이 남았다:
//   §2 *시작-시점 죽음*: 한 번도 ack 안 한 소비자(구독 후 영영 죽음)는 consumerSeen 미확립 → 축출 정의역 밖(영영 못 축출) + consumerWm 미확립으로 min 을 -1 에 고정 → outBuffer 무계 성장.
//   §3 *축출 비가역*: evicted 에 한 번 들면 영영 못 빠짐 → 축출된 소비자가 돌아와도(재구독·재-ack) min 정의역 미복귀 → 그 소비자가 필요로 하는 *이후* 결과 starve 재발.
//   해법(busLeaseLife): ⒜ sweep 가 *처음 본* 미-ack 소비자에 침묵 기준을 그때의 frontier 로 *지연* 확립(leaseSpan grace) → 다음 sweep 부터 측정 → 영영-죽음이면 leaseSpan 뒤 축출(지연이라 산 소비자 오축출 0)
//                         ⒝ 축출된 소비자가 다시 ack 하면 evicted 에서 제거(재admission) → min 정의역 복귀 → 이후 결과 보존(옛 가지친 결과는 자기 저널 reconstruct 0020).
//   닿는 박스: svc-inventory-core.js(busLeaseLife 플래그·readmissions 계측)·svc-inventory-bus.js(_onOutAck — 지연 baseline sweep·재admission)·topo-build.js(busLeaseLife 배선). busLeaseLife=0 = 0047 비트 동일.
//
// 척추(SPINE.md) 준수: busLeaseLife=0(기본)→0047 비트 동일(reg 0·지연 baseline 미확립·재admission 0·evicted 동작 무변경)·존 tick 밖 제어 평면(신성한 tick 보존)·headless 원격 검증 무변경.
//   ON 이면 never-ack 소비자도 유계(run-length 무관·ev≥1)·축출 가역(재admission)·산 소비자 오축출 0(ctl). 동결 단위는 step-0048/ 디렉토리 통째.
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
  __p('svc-presence-monitor'), __p('svc-presence'), __p('svc-whisper'), __p('svc-party'), __p('svc-mailbox'),
  __p('persist'), __p('client'), __p('metrics'), __p('topo-build'), __p('topology'),
  { PUBLIC_ADDRS, DEFAULTS: __c.DEFAULTS, SUPPORTS });
if (typeof module !== 'undefined' && module.exports) module.exports = __hktNet;
if (typeof globalThis !== 'undefined') globalThis.HktNet = __hktNet;
