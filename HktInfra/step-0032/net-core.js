// HktInfra step-0032 — 정리 step: net-core 박스 1개=파일 1개 분할 (기능 추가 0 · 외부 계약 불변 · reg 비트 동일)
// step-0029(PersistStore quorum write ack) 위에 *구조만* 바꾼다 — CLAUDE.md "박스별 파일 분할 임계"(한 step 박스 4개 초과) 시행:
//   누적 10 박스(Gateway·Orchestrator·EntityZone·Inventory·Chat·Bus·Audit·Ranking·PersistStore·Client)가 단일 net-core.js(128KB)에
//   살아 매 step 의 Grep·Edit 비용이 파일 크기에 비례해 커졌다. → 박스 1개=파일 1개로 분할, 이 진입점이 require/<script> 로 묶어
//   *동일한* export 집합을 노출한다(verify·host·cluster·panel·run.js 의 require 인터페이스 무변경).
//   파일 구조 = 목표 토폴로지(박스=독립 서버)와 일치: gateway·orchestrator·zone·svc-inventory·svc-chat·svc-bus·svc-audit·
//   svc-ranking·persist·client + topology(배선·run)·metrics(회계·트루스 헬퍼)·common(engine 로드·DEFAULTS).
//
// 척추(SPINE.md) 준수: 코드 본문은 0029 verbatim 이동(동작 불변) — 신성한 tick·결정론·권위·은닉 전부 0029 그대로.
//   headless·원격 검증: node run.js 가 이 진입점 하나를 require — 검증 경로 무변경. 회귀 0 은 reg(25/25 비트 동일)가 증명.
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
