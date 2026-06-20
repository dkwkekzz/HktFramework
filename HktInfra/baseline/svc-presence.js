'use strict';
// step-0065 — 프레즌스 보고 버스화(presenceReportBus): PresenceService(0064 분리)가 orch 의 전이 보고를 point-to-point({type:'presence'}) *또는* 버스 토픽(svc.presence.report·{type:'ev'}) 둘 다 받아 SSOT 갱신+발행. 보고 버스화로 orch 가 박스 주소 무지(완전 decouple·failover 기반). SPINE 계층 5 "세션/프레즌스" SSOT. (분할 preamble: 박스 1개=파일 1개·진입점 net-core.js)
// dual-mode: Node require / 브라우저는 common.js 를 <script> 선행 로드(전역 __HktNetCommon).
const __c = (typeof module !== 'undefined' && module.exports && typeof require !== 'undefined')
  ? require('./common.js') : globalThis.__HktNetCommon;
const { Net, LoginServer, SessionRegistry, mulberry32, fnv1a, DEFAULTS } = __c;

// ── [코디네이션] PresenceService — "누가 어디에/어떤 상태인가"의 SSOT(SPINE 계층 5 세션/프레즌스). 존 tick 밖 *순수 반응형*(onTick 없음). ──
//   orch 가 전이를 {type:'presence', kind, consumer} 로 *보고*(명시 인터페이스·point-to-point) → 이 박스가 consumerDown/permanentDown SSOT 갱신 + svc.presence 토픽으로 *발행*.
//   분리 이유(SPINE §2 판정): 프레즌스 SSOT 유지·발행은 orch 의 *결정/행동*(recover/retry/포기)과 다른 책임 — "누가 어디에"의 단일 조회처(귓속말·파티·핸드오프 라우팅의 미래 기반). orch 무수정으로 다른 박스가 이 SSOT 를 질의·구독.
class PresenceService {
  constructor(opts = {}) {
    this.bus = opts.bus || null;        // svc.presence 발행 경로(구독자 주소 무지).
    this.consumerDown = new Set();      // 현재 down(축출됨)으로 보고된 소비자 — 프레즌스 SSOT.
    this.permanentDown = new Set();     // 영구 down(포기)으로 보고된 소비자.
    this.published = 0;                 // svc.presence 발행 수(계측) — 보고 수와 1:1.
    this.reports = 0;                   // orch 가 보고한 전이 수(계측).
  }
  onMsg(m) {
    const p = m.payload;
    // orch 의 전이 보고 수신 — point-to-point({type:'presence'}·0064) 또는 버스 토픽({type:'ev', topic:'svc.presence.report'}·0065). 둘 다 같은 SSOT 갱신+발행.
    let kind, consumer;
    if (p.type === 'presence') { kind = p.kind; consumer = p.consumer; }
    else if (p.type === 'ev' && p.topic === 'svc.presence.report' && p.ev) { kind = p.ev.kind; consumer = p.ev.consumer; }
    else return;
    this.reports++;
    if (kind === 'down') this.consumerDown.add(consumer);
    else if (kind === 'up') this.consumerDown.delete(consumer);
    else if (kind === 'permanent') this.permanentDown.add(consumer);
    if (this.bus) { this.net.send(this.addr, this.bus, { type: 'pub', topic: 'svc.presence', ev: { kind, consumer } }); this.published++; }   // SSOT 갱신 후 발행(0060 의 발행을 이 박스로 인계).
  }
  stateOf(consumer) { return this.permanentDown.has(consumer) ? 'permanent' : (this.consumerDown.has(consumer) ? 'down' : 'up'); }
}

const __part = { PresenceService };
if (typeof module !== 'undefined' && module.exports) module.exports = __part;
if (typeof globalThis !== 'undefined') (globalThis.__HktNetParts = globalThis.__HktNetParts || {}).svc_presence = __part;
