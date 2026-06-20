'use strict';
// step-0068 — 프레즌스 박스 사망 자율 감지(presenceLease): 0067 의 승격은 *외부 주입*(presenceFailover.at 가 promote 호출)이었다(0067 §9 한계). 이 step 은 그 트리거를 *자율화*한다 — active 박스가 매 tick svc.presence.hb 하트비트를 발행하고, standby 가 그걸 구독해 *침묵 길이*(hbTimeout)로 primary 사망을 스스로 감지→자기 promote. 외부 promote 호출 없이 죽음 후 보고를 인계 발행. 0009 의 orch lease 타임아웃→follower 승격을 프레즌스 박스에 적용(감지 권위=standby 자신). presenceLease OFF 면 하트비트·자율 승격 0 = 0067 비트 동일. (분할 preamble: 박스 1개=파일 1개·진입점 net-core.js)
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
    // 사망 자율 감지(step-0068·presenceLease) — active 박스가 매 tick svc.presence.hb 를 발행, standby 가 구독해 침묵 길이로 primary 사망을 스스로 감지→자기 promote(외부 트리거 없이). 0009 의 orch lease 타임아웃→follower 승격의 프레즌스 판(감지 권위=standby 자신). OFF 면 하트비트·자율 승격 0 = 0067 비트 동일.
    this.lease = opts.lease || false;
    this.hbTimeout = opts.hbTimeout || 3;   // 하트비트 침묵이 이만큼 쌓이면 primary 사망 단정→자기 승격(결정론 상수·0009 leaseTimeout 의 프레즌스 판).
    this.lastHbTick = 0;          // 마지막으로 svc.presence.hb 를 받은(또는 자기 발행한) tick. 0 면 미수신(부트스트랩 — 오감지 가드).
    this.hbSent = 0;              // 발행한 하트비트 수(계측·active 박스만). hbRecv = 받은 수(standby 측).
    this.hbRecv = 0;
  }
  onMsg(m) {
    if (this.dead) return;        // 사망한 박스는 보고를 처리·발행하지 않는다(step-0067) — 승격된 standby 가 이후 보고를 인계.
    const p = m.payload;
    // 하트비트 수신(step-0068) — active 박스의 svc.presence.hb 구독. 받을 때마다 lastHbTick 갱신(침묵 길이 0 으로 리셋). standby 만 구독(active 는 자기 하트비트 안 들음). presenceLease OFF 면 이 토픽 미구독 = 미발화.
    if (p.type === 'ev' && p.topic === 'svc.presence.hb') { this.lastHbTick = this.net.tick; this.hbRecv++; return; }
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
  // onTick(step-0068·presenceLease) — active 박스는 매 tick 하트비트 발행(svc.presence.hb), standby 는 침묵 길이로 사망 자율 감지→자기 승격. presenceLease OFF 면 즉시 반환(0067 비트 동일·순수 반응형 유지). 죽은 박스는 침묵(dead 가드). 신성한 tick 밖 코디네이션 제어 평면.
  onTick(tick) {
    if (!this.lease || this.dead) return;
    if (this.active) { if (this.bus) { this.net.send(this.addr, this.bus, { type: 'pub', topic: 'svc.presence.hb', ev: { box: this.addr } }); this.hbSent++; } return; }   // active 박스: 생존 신호 발행
    // standby: 하트비트 침묵이 hbTimeout 쌓이면 primary 사망 단정→자기 승격(외부 트리거 없이·감지 권위=자신). lastHbTick 0(부트스트랩)이면 미감지(오감지 가드).
    if (this.lastHbTick > 0 && (tick - this.lastHbTick) >= this.hbTimeout) this.promote(tick);
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
