'use strict';
// step-0066 — 프레즌스 박스 shadow 복제(presenceShadow): 0065 가 orch 의 전이 보고를 *버스 토픽*(svc.presence.report)으로 올려 orch 가 박스 주소 무지가 됐다(완전 decouple). 그 위에 *대기(standby)* PresenceService(presence2)를 같은 토픽에 구독시켜 SSOT(consumerDown/permanentDown)를 *그림자 복제*한다 — 단 발행은 안 한다(active=false → svc.presence 이중 발행 억제). 같은 보고 스트림을 먹는 두 박스가 같은 SSOT 로 수렴(존 follower 복제 0002·shadow follower 0009 의 코디네이션 판) → 프레즌스 박스 failover 의 토대(승격 시 SSOT 갭 0). (분할 preamble: 박스 1개=파일 1개·진입점 net-core.js)
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
    this.published = 0;                 // svc.presence 발행 수(계측) — 보고 수와 1:1(active 박스만).
    this.reports = 0;                   // orch 가 보고한 전이 수(계측) — active·standby 둘 다 같은 보고를 받으므로 동일하게 센다.
    // active(step-0066·presenceShadow) — 이 박스가 *활성*(발행 권위 보유)인가. true(기본·primary)면 SSOT 갱신 후 svc.presence 로 발행. false(standby)면 같은 보고 스트림으로 SSOT 를 *그림자 복제*만 하고 발행은 억제(이중 발행 0). 미지정이면 true = 0065 비트 동일(단일 active 박스). 승격(0067 후보)은 이 플래그를 뒤집어 발행을 인계한다.
    this.active = opts.active !== undefined ? opts.active : true;
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
    // 발행은 *active 박스만*(step-0066·presenceShadow) — standby(active=false)는 같은 보고로 SSOT 그림자 복제만 하고 svc.presence 이중 발행을 억제. active 기본 true = 0065 비트 동일.
    if (this.active && this.bus) { this.net.send(this.addr, this.bus, { type: 'pub', topic: 'svc.presence', ev: { kind, consumer } }); this.published++; }   // SSOT 갱신 후 발행(0060 의 발행을 이 박스로 인계).
  }
  stateOf(consumer) { return this.permanentDown.has(consumer) ? 'permanent' : (this.consumerDown.has(consumer) ? 'down' : 'up'); }
}

const __part = { PresenceService };
if (typeof module !== 'undefined' && module.exports) module.exports = __part;
if (typeof globalThis !== 'undefined') (globalThis.__HktNetParts = globalThis.__HktNetParts || {}).svc_presence = __part;
