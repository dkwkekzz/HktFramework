'use strict';
// step-0063 — 프레즌스 모니터(presenceMonitor): svc.presence 의 down/up/permanent 발행을 구독해 *소비자별 건강 상태*(현재 상태 + 전이 회계)를 유지하는 구조적 읽기 모델. 0060 §9 가 예고한 반응자 셋 중 *모니터링 대시보드* 판(0061 이 *대체 spawn*, 이 step 이 *대시보드*). audit(0016)이 토픽별 *수*만 세는 범용 sink 라면, 이것은 프레즌스에 특화된 *상태 기계*("누가 지금 어디에/어떤 상태인가" — SPINE 계층 5 세션/프레즌스의 관측 면). (분할 preamble: 박스 1개=파일 1개·진입점 net-core.js)
// dual-mode: Node require / 브라우저는 common.js 를 <script> 선행 로드(전역 __HktNetCommon).
const __c = (typeof module !== 'undefined' && module.exports && typeof require !== 'undefined')
  ? require('./common.js') : globalThis.__HktNetCommon;
const { Net, LoginServer, SessionRegistry, mulberry32, fnv1a, DEFAULTS } = __c;

// ── [게임 서비스] PresenceMonitor — svc.presence 의 *둘째(셋째) 소비자*. 존 tick 밖 *순수 관찰형*(onTick 없음·발신 0 = 비-침습 구조적). ──
//   orch 가 발행한 건강 판정(down/up/permanent)을 소비해 소비자별 *상태 기계*를 유지: state(현재) + downCount/upCount/permCount(전이 회계).
//   발행자(orch)·다른 소비자(audit·ranking2) 무수정으로 얹힌다(0016 decouple) — 추가는 버스 구독 행 + 이 박스뿐. 권위 0(파생 뷰·"누가 어디에" 대시보드).
class PresenceMonitor {
  constructor() {
    this.state = new Map();       // consumer -> 'down'|'up'|'permanent' (현재 건강 상태 — 대시보드의 한 칸)
    this.downCount = new Map();   // consumer -> down 전이 누적(일시 의심 횟수)
    this.upCount = new Map();     // consumer -> up 전이 누적(회복 횟수)
    this.permCount = new Map();   // consumer -> permanent 전이 누적(포기 횟수)
    this.events = 0;              // 소비한 svc.presence 이벤트 누적(발행 수와 1:1 대조 — 무손실 관측)
  }
  onMsg(m) {
    const p = m.payload;
    if (p.type !== 'ev' || p.topic !== 'svc.presence' || !p.ev) return;
    const { kind, consumer } = p.ev;
    this.events++;
    this.state.set(consumer, kind);   // 마지막 전이가 현재 상태(down→up→permanent 순서대로 덮어씀)
    const bump = (mp) => mp.set(consumer, (mp.get(consumer) || 0) + 1);
    if (kind === 'down') bump(this.downCount);
    else if (kind === 'up') bump(this.upCount);
    else if (kind === 'permanent') bump(this.permCount);
  }
  stateOf(consumer) { return this.state.get(consumer) || null; }
}

const __part = { PresenceMonitor };
if (typeof module !== 'undefined' && module.exports) module.exports = __part;
if (typeof globalThis !== 'undefined') (globalThis.__HktNetParts = globalThis.__HktNetParts || {}).svc_presence_monitor = __part;
