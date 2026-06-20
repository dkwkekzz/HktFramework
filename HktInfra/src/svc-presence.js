'use strict';
// step-0067 — 프레즌스 박스 failover 승격(presencePromote): 0066 의 standby(presence2)는 SSOT 를 그림자 복제만 했다(발행 억제). 이 step 은 마지막 고리를 닫는다 — primary 사망 시 standby 가 *승격*(active=true)해 svc.presence 발행을 인계한다(존 shadow follower 승격 0009·버스 failover 0034 의 코디네이션 판). shadow 가 모든 보고를 이미 먹었으므로(0066) 승격은 *SSOT 갭 0*: 죽음 전 보고는 둘 다 봤고, 죽음 후 보고는 승격된 standby 가 발행 → 다운스트림(presmon)이 전 전이열을 무손실 수신. 미승격(대조)이면 죽음 후 전이는 영영 미발행(failover 가 막는 갭). (분할 preamble: 박스 1개=파일 1개·진입점 net-core.js)
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
    // active(step-0066·presenceShadow) — 이 박스가 *활성*(발행 권위 보유)인가. true(기본·primary)면 SSOT 갱신 후 svc.presence 로 발행. false(standby)면 같은 보고 스트림으로 SSOT 를 *그림자 복제*만 하고 발행은 억제(이중 발행 0). 미지정이면 true = 0065 비트 동일(단일 active 박스). 승격(0067·promote)이 이 플래그를 뒤집어 발행을 인계한다.
    this.active = opts.active !== undefined ? opts.active : true;
    this.dead = false;            // primary 사망(step-0067·crash) — RAM 소실의 인프로세스 모델. dead 면 보고 무시·발행 0(승격된 standby 가 인계).
    this.promotedAt = -1;         // standby→active 승격 tick(계측) — 미승격이면 -1.
  }
  onMsg(m) {
    if (this.dead) return;        // 사망한 박스는 보고를 처리·발행하지 않는다(step-0067) — 승격된 standby 가 이후 보고를 인계.
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
  // crash(step-0067) — primary 프레즌스 박스 사망(RAM 소실)의 인프로세스 모델. 이후 보고 무시·발행 0. SSOT 는 standby(presence2)가 그림자 복제로 보유하므로 진실은 소실되지 않는다(0034 "진실 원천=소비자"의 코디네이션 판: 진실 원천=shadow).
  crash() { this.dead = true; }
  // promote(step-0067) — standby(active=false)를 *활성*으로 승격해 svc.presence 발행을 인계. shadow 가 이미 모든 보고로 SSOT 를 복제했으므로(0066) 승격 시점 SSOT 갭 0 — 죽음 후 보고만 새로 발행하면 다운스트림이 전 전이열을 무손실 수신. 0009 follower 승격(존)·0061 standby 활성화(서비스)의 프레즌스 판.
  promote(tick) { if (this.active) return; this.active = true; this.promotedAt = (tick !== undefined) ? tick : 0; }
}

const __part = { PresenceService };
if (typeof module !== 'undefined' && module.exports) module.exports = __part;
if (typeof globalThis !== 'undefined') (globalThis.__HktNetParts = globalThis.__HktNetParts || {}).svc_presence = __part;
