'use strict';
// step-0036 — 분할 공통: engine 로드 + 복원·failover 기본 상수. 모든 박스 파일의 preamble 이 이 파일을 본다.
const __engine = (typeof module !== 'undefined' && module.exports && typeof require !== 'undefined')
  ? require('../engine/index.js')
  : globalThis.HktEngine;
const { Net, LoginServer, SessionRegistry, mulberry32, fnv1a } = __engine;

// 복원·failover 파라미터(0009 그대로) — opts 오버라이드 가능 결정론 상수. hkt.recovery.*·hkt.failover.* 노브의 더미판.
const DEFAULTS = { retxPeriod: 2, resyncPeriod: 3, heartbeat: 10, leaseTimeout: 3 };

const __common = { Net, LoginServer, SessionRegistry, mulberry32, fnv1a, DEFAULTS };
if (typeof module !== 'undefined' && module.exports) module.exports = __common;
if (typeof globalThis !== 'undefined') globalThis.__HktNetCommon = __common;
