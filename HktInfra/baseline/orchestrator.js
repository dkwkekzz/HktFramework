'use strict';
// step-0224 — 오케스트레이터 host 드레인(placeDrain): 정비/퇴역할 host 의 *모든* 존을 다른(나머지) host 중 최소부하로 차례차례 이주(release+acquire 연쇄·존 권위 단일 소유 보존). 드레인 후 그 host 부하 0(비운다). 다른 host 없으면 보류(존 잔류). placeDrain 미수신이면 0223 비트 동일(reg 0). 3차 고도화(오케스트레이터 #2).
// step-0223 — 오케스트레이터 부하 재배치 자동 트리거(placeRebalance): 후보 host 부하 불균형(최대−최소 ≥ 2)이면 최대부하 host 의 존을 최소부하 host 로 *자동* placeMigrate(0218 의 자동 트리거판·정적 배치 한계 제거). 균형(gap<2)까지 한 패스 수렴. 결정론 host/zone 순서. placeRebalance 미수신이면 0222 비트 동일(reg 0). 3차 고도화(오케스트레이터 #1).
// step-0218 — 오케스트레이터 존 재배치 핸드오프(placeMigrate): 이미 배치된 존을 다른 host 로 *release(기존)+acquire(신규) 쌍*으로 옮긴다(존 권위 단일 소유 보존·공백/중복 0·0006 핸드오프의 배치 판). 미배치 존·같은 host 는 거부(no-op). placeMigrate 미수신이면 0217 비트 동일(reg 0). 2차 고도화(오케스트레이터 #2).
// step-0217 — 오케스트레이터 부하 배치(placeAuto): 후보 host 중 *최소 부하*(=배치된 존 수 최소) host 를 골라 존을 자동 배치(정적 배치 한계 제거·부하 분산). 동률은 후보 순서로 결정론 tie-break. placeAuto 미수신이면 0216 비트 동일(reg 0). 2차 고도화(오케스트레이터 #1).
// step-0204 — 오케스트레이터 존 배치 질의(placeQuery→placeReply): 배치 SSOT(0203)를 원격 request/reply 로 읽는다(게이트웨이가 "이 존 어디 사나" 물음). 순수 읽기·placeQuery 미수신이면 0203 비트 동일(reg 0). 배치 박스 기본 통신 완비. (아래 0065 메모는 프레즌스 보고 버스화 설명·유지.)
// step-0065 — 프레즌스 보고 버스화: orch→PresenceService 보고를 point-to-point(0064)→버스 토픽 svc.presence.report 로 올린다(presenceReportBus). orch 가 프레즌스 박스 주소를 모른다(토픽만·완전 decouple→다중 orch/박스 failover 기반). OFF 면 0064 비트 동일. (분할 preamble: 박스 1개=파일 1개·진입점 net-core.js)
// dual-mode: Node require / 브라우저는 common.js 를 <script> 선행 로드(전역 __HktNetCommon).
const __c = (typeof module !== 'undefined' && module.exports && typeof require !== 'undefined')
  ? require('./common.js') : globalThis.__HktNetCommon;
const { Net, LoginServer, SessionRegistry, mulberry32, fnv1a, DEFAULTS } = __c;

// ── [코디네이션] Orchestrator — 0009 그대로(monitor 쌍을 생성자 opts 로 받게만 조정) ──
class Orchestrator {
  constructor(opts = {}) {
    this.leaseTimeout = opts.leaseTimeout || DEFAULTS.leaseTimeout;
    this.pairs = new Map();
    this.lastLease = new Map();
    this.dead = new Set();
    this.curTick = 0;
    this.promotions = 0;
    this.deathSeen = new Map();
    // 존 배치 SSOT(step-0203·placeZone) — 오케스트레이터가 "어느 존을 어느 host 에 둘지"의 배치 결정 권위(코디네이션 계층). 정적 배치 한계 제거의 씨앗(SPINE §2 코디네이션). placement 미주입이면 빈 채 = 0202 비트 동일.
    this.placement = new Map();   // zoneId -> host (배치 SSOT — "누가 어디서 도나"의 권위 단일 소유).
    this.placements = 0;          // 처리한 placeZone 수(step-0203·계측·재배치 덮어쓰기 포함).
    this.placeQueriesRx = 0;      // 받은 placeQuery 수(step-0204·읽기 경로 계측). placeRepliesSent = 보낸 회신 수(1:1).
    this.placeRepliesSent = 0;
    this._lastPlaceReply = null;  // 마지막 placeReply 보관(검증용·순수 읽기).
    this.autoPlacements = 0;      // 처리한 placeAuto 수(step-0217·부하 기반 자동 배치·계측).
    this.migrations = 0;          // 처리한 placeMigrate 성공 수(step-0218·release+acquire 쌍·재배치).
    this.migrateRejects = 0;      // 거부된 placeMigrate 수(step-0218·미배치 존·같은 host no-op).
    this.rebalances = 0;          // 처리한 placeRebalance 패스 수(step-0223·계측·균형이면 0).
    this.rebalanceMoves = 0;      // 재배치 자동 트리거로 옮긴 존 누적 수(step-0223·release+acquire 쌍).
    this.drains = 0;              // 처리한 placeDrain 수(step-0224·계측).
    this.drainMoves = 0;          // 드레인으로 다른 host 로 이주한 존 누적 수(step-0224·release+acquire 연쇄).
    // 소비자 프레즌스 SSOT(step-0055·busLeasePresence) — 0054 가 lease 전이를 svc.item.lease 로 *관측 가능*하게 했다. 이제 코디네이션 계층이 그 이벤트를 소비해 "어느 소비자가 지금 down 인가"(consumerDown)를 유지한다(SPINE 계층 5 세션/프레즌스의 씨앗). 버스 이벤트만으로 — 가방 내부를 안 들여다본다(은닉). OFF 면 미구독(이벤트 0)이라 빈 채 = 0054 비트 동일.
    this.busLeasePresence = opts.busLeasePresence || false;
    this.consumerDown = new Set();   // 현재 down(축출됨)으로 관측된 소비자 — evict 이벤트에 add·readmit 에 delete. 코디네이션의 프레즌스 뷰(가방 evicted 의 거울).
    this.presenceEvents = 0;         // 소비한 lease 이벤트 누적(계측) — evictions+readmissions 와 대조.
    // 프레즌스 *반응*(step-0056·busPresenceRecover) — 0055 가 프레즌스를 *상태*로만 뒀다면, 이 step 은 마지막 고리(*행동*)를 닫는다: down 으로 관측한 소비자에게 recover 명령을 *직접* 보낸다(0009 promote/reroute 와 같은 제어 평면). 소비자가 *스스로* 재구독한다(orch 가 대신 sub 하면 orch 가 구독자로 등록됨 = 0055 §9 난점) → 결과 재개 → 재-ack → 가방 재admission → readmit → consumerDown 비움 = self-healing 고리 완성. OFF 면 recover 미발신 = 0055 비트 동일.
    this.busPresenceRecover = opts.busPresenceRecover || false;
    this.recoverTopic = opts.recoverTopic || 'svc.item.out';   // 소비자가 재구독할 토픽(가방 결과 스트림 — ranking 의 입력). 명시 인터페이스로 전달(소비자 내부 무지).
    this.recoversSent = 0;           // 발신한 recover 명령 수(행동 계측) — OFF·미-down 이면 0.
    this.recovered = new Set();      // 이미 recover 명령을 보낸 down 소비자(중복 명령 억제 — evict 1회당 1 recover).
    this.recoverAcks = 0;            // 소비자가 돌려보낸 recover 확인 수(step-0057) — recoversSent 와 1:1 이면 모든 명령이 전달·수행됨(분실 0). 코디네이션이 명령 결과를 *안다*(fire-and-forget 가 아니라 확인된 루프).
    // 미확인 명령 재시도(step-0058·recoverRetry) — recover 가 분실될 수 있다(명령 메시지 손실·소비자 일시 무응답). 0057 의 recoverAck 가 "확인됨"을 알려주므로, *미확인*(recoverTimeout 경과 후에도 ack 없음) 명령을 재발신해 분실에도 치유가 수렴하게 한다(0008 ack/NAK 재전송의 제어 평면 판). OFF 면 재시도 0 = 0057 비트 동일.
    this.recoverRetry = opts.recoverRetry || false;
    this.recoverTimeout = opts.recoverTimeout || 4;   // recover 후 ack 를 기다리는 tick(이후 미확인이면 재발신). 결정론 상수.
    this.pendingRecover = new Map();   // consumer -> 마지막 recover 발신 tick(ack 오면 삭제). onTick 이 timeout 경과분을 재발신.
    this.recoverRetries = 0;           // 재발신 수(계측) — 분실 1건당 ≥1.
    // 재시도 상한(step-0059·recoverMaxRetries) — 영구 분실(소비자 영영 안 옴)에 재시도가 무한 반복되지 않게 per-consumer 재발신 횟수에 상한. 도달하면 그 소비자를 permanentDown 으로 *포기*(pending 에서 빼 루프 종료). 0 이면 무상한 = 0058 동일.
    this.recoverMaxRetries = opts.recoverMaxRetries || 0;
    this.recoverAttempts = new Map();   // consumer -> 누적 재발신 횟수(상한 비교 기준). ack 오면 readmit/ack 경로가 정리.
    this.permanentDown = new Set();      // 상한 도달로 포기한 소비자(영구 down 으로 단정 — 대체 소비자 spawn 등 상위 오케스트레이션의 대상·후속).
    this.givenUp = 0;                    // 포기 수(계측).
    // 프레즌스 발행(step-0060·presencePublish) — 0055~0059 의 소비자 건강 판정(down/up/permanent)은 orch *사유 상태*(consumerDown/permanentDown)였다. 이제 그 판정을 svc.presence 버스 이벤트로 발행해 *다른 서비스*가 구독·반응할 수 있게 한다(프레즌스가 1급 발행 신호 — 0054 가 lease 를 관측 가능하게 한 것의 프레즌스 판정 판). OFF·버스 부재면 발행 0 = 0059 비트 동일.
    this.bus = opts.bus || null;
    this.presencePublish = opts.presencePublish || false;
    this.presencePublished = 0;          // 발행한 svc.presence 이벤트 수(계측) — down/up/permanent 전이 합과 대조.
    // 전용 프레즌스 박스 분리(step-0064·presenceBox) — ON 이면 orch 는 프레즌스 SSOT/발행을 직접 안 하고, 전이를 PresenceService(presenceAddr)에 *보고*만 한다(point-to-point). PresenceService 가 consumerDown/permanentDown SSOT 를 쥐고 svc.presence 로 발행. OFF 면 orch 가 직접(0063 비트 동일). orch 는 결정/행동(recover/retry/포기)에 집중 = 순수 오케스트레이터.
    this.presenceBox = opts.presenceBox || false;
    this.presenceAddr = opts.presenceAddr || null;
    // 프레즌스 보고 버스화(step-0065·presenceReportBus) — 0064 의 orch→PresenceService 보고는 point-to-point(presenceAddr 명시)였다(0064 §9 한계). ON 이면 보고를 버스 토픽 svc.presence.report 로 발행 → orch 가 프레즌스 박스 *주소를 모른다*(토픽만·완전 decouple) → 다중 orch·프레즌스 박스 failover 가능. OFF 면 point-to-point(0064 동일).
    this.presenceReportBus = opts.presenceReportBus || false;
    if (opts.monitor) for (const [a, f] of opts.monitor) this.monitor(a, f);
  }
  monitor(authority, follower) { this.pairs.set(authority, follower); this.lastLease.set(authority, 0); }
  // 프레즌스 전이 처리(step-0064/0065) — presenceBox ON 이면 PresenceService 에 보고(0065: 버스 토픽 / 0064: point-to-point). OFF 면 orch 가 직접 SSOT 갱신 + 발행(0063 동일·OFF 경로 비트 불변).
  _track(kind, consumer) {
    if (this.presenceBox) {
      if (this.presenceReportBus && this.bus) { this.net.send(this.addr, this.bus, { type: 'pub', topic: 'svc.presence.report', ev: { kind, consumer } }); return; }   // 보고 버스화(0065·주소 무지)
      if (this.presenceAddr) { this.net.send(this.addr, this.presenceAddr, { type: 'presence', kind, consumer }); return; }   // point-to-point(0064)
    }
    if (kind === 'down') this.consumerDown.add(consumer);
    else if (kind === 'up') this.consumerDown.delete(consumer);
    else if (kind === 'permanent') this.permanentDown.add(consumer);
    this._presence(kind, consumer);
  }
  // 프레즌스 판정 발행(step-0060) — down/up/permanent 전이를 svc.presence 토픽에 pub(구독자 주소 무지). OFF·버스 부재면 no-op(0059 비트 동일·순수 제어 평면·존 tick 밖).
  _presence(kind, consumer) { if (!this.presencePublish || !this.bus) return; this.net.send(this.addr, this.bus, { type: 'pub', topic: 'svc.presence', ev: { kind, consumer } }); this.presencePublished++; }
  onMsg(m) {
    const p = m.payload;
    // 존 배치 SSOT 쓰기(step-0203·placeZone) — {zoneId, host} → 배치 맵 갱신(재배치는 덮어씀). 코디네이션의 배치 결정 권위. placementOps 미주입이면 영영 안 옴 = 0202 비트 동일(reg 0). 질의는 0204.
    if (p.type === 'placeZone') { this.placement.set(p.zoneId, p.host); this.placements++; return; }
    // 부하 기반 자동 배치(step-0217·placeAuto) — {zoneId, hosts[]} → 후보 host 중 최소 부하(배치된 존 수 최소) host 선택 배치(부하 분산·정적 배치 한계 제거). 동률은 후보 순서로 결정론 tie-break. placeAuto 미수신이면 미발화 = 0216 비트 동일.
    if (p.type === 'placeAuto') {
      const host = this._leastLoaded(p.hosts || []);
      if (host !== null) { this.placement.set(p.zoneId, host); this.autoPlacements++; }
      return;
    }
    // 존 재배치 핸드오프(step-0218·placeMigrate) — {zoneId, toHost} → 이미 배치된 존을 release(기존 host)+acquire(toHost) 쌍으로 옮긴다(권위 단일 소유 보존·공백/중복 0). 미배치 존·같은 host 는 거부(no-op). placeMigrate 미수신이면 미발화 = 0217 비트 동일.
    if (p.type === 'placeMigrate') {
      const from = this.placement.get(p.zoneId);
      if (from === undefined || from === p.toHost) { this.migrateRejects++; return; }   // 미배치/같은 host 거부.
      this.placement.set(p.zoneId, p.toHost); this.migrations++;   // release(from)+acquire(toHost) — Map 단일 키 원자 교체(중간 상태 공백/중복 0).
      return;
    }
    // 부하 재배치 자동 트리거(step-0223·placeRebalance) — {hosts[]} → 후보 부하 불균형(최대−최소≥2)이면 최대→최소 host 로 존 자동 이주(균형까지·release+acquire). 0218 placeMigrate 의 자동 트리거판. placeRebalance 미수신이면 미발화 = 0222 비트 동일.
    if (p.type === 'placeRebalance') { this._rebalance(p.hosts || []); this.rebalances++; return; }
    // host 드레인(step-0224·placeDrain) — {host, hosts[]} → host 의 모든 존을 나머지 host 중 최소부하로 이주(release+acquire 연쇄·드레인 후 부하 0). 정비/퇴역. placeDrain 미수신이면 미발화 = 0223 비트 동일.
    if (p.type === 'placeDrain') { this._drain(p.host, p.hosts || []); this.drains++; return; }
    // 존 배치 질의(step-0204·placeQuery) — {zoneId} 요청에 현재 배치 host 를 {placeReply} 로 회신(request/reply·SPINE §4 경로3·프레즌스 0069/우편 0156 의 배치 판). 순수 읽기(배치 무변경). _lastPlaceReply 에 보관(검증용). 질의 미수신이면 미발화 = 0203 비트 동일.
    if (p.type === 'placeQuery') {
      this.placeQueriesRx++;
      const host = this.placementOf(p.zoneId);
      this._lastPlaceReply = { zoneId: p.zoneId, host };
      if (this.net && this.addr) { this.net.send(this.addr, m.from, { type: 'placeReply', zoneId: p.zoneId, host }); this.placeRepliesSent++; }
      return;
    }
    if (p.type === 'lease') this.lastLease.set(p.zone, this.curTick);
    // 치유 확인 수신(step-0057·recoverAck) — recover 명령을 받은 소비자가 재구독하며 돌려보낸 확인. orch 가 명령 *전달·수행*을 안다(분실 0 이면 recoverAcks==recoversSent). busPresenceRecover OFF 면 recover 미발신 → 이 메시지 영영 안 옴 = 0056 비트 동일.
    if (p.type === 'recoverAck') { this.recoverAcks++; this.pendingRecover.delete(p.consumer); this.recoverAttempts.delete(p.consumer); return; }
    // lease 생애 이벤트 소비(step-0055·busLeasePresence) — 가방이 svc.item.lease 로 발행한 축출/복귀를 코디네이션이 프레즌스로 반영. 구독은 토폴로지가 busLeasePresence 일 때만 추가(OFF 면 이 분기 미수신 = 0054 비트 동일).
    if (this.busLeasePresence && p.type === 'ev' && p.topic === 'svc.item.lease' && p.ev) {
      if (p.ev.kind === 'evict') {
        this._track('down', p.ev.consumer);   // 프레즌스 down 전이(step-0064: presenceBox 면 PresenceService 에 보고·아니면 직접 SSOT+발행)

        // 프레즌스 반응(step-0056·busPresenceRecover) — down 관측 즉시 그 소비자에 recover 명령(자기 재구독 트리거). evict 1회당 1 recover(recovered Set 중복 억제). OFF 면 미발신 = 0055 비트 동일.
        if (this.busPresenceRecover && !this.recovered.has(p.ev.consumer)) {
          this.recovered.add(p.ev.consumer);
          this.net.send(this.addr, p.ev.consumer, { type: 'recover', topic: this.recoverTopic });
          this.recoversSent++;
          this.pendingRecover.set(p.ev.consumer, this.curTick);   // 확인 대기(step-0058) — ack 오면 삭제·timeout 경과면 재발신.
        }
      } else if (p.ev.kind === 'readmit') {
        this._track('up', p.ev.consumer);   // 프레즌스 up 전이(step-0064)

        this.recovered.delete(p.ev.consumer);   // 살아 돌아옴 → 다음 down 때 다시 recover 가능(재발 대비)
      }
      this.presenceEvents++;
    }
  }
  onTick(tick) {
    this.curTick = tick;
    // 미확인 recover 재시도(step-0058·recoverRetry) — recoverTimeout 경과해도 ack 안 온 명령을 재발신. ack 오면 onMsg 가 pendingRecover 에서 지운다(루프 종료). OFF 면 미실행 = 0057 비트 동일.
    if (this.recoverRetry && this.pendingRecover.size) {
      for (const [consumer, sentAt] of this.pendingRecover) {
        if (tick - sentAt >= this.recoverTimeout) {
          // 재시도 상한(step-0059) — 이미 max 회 재발신했는데도 ack 가 없으면 영구 분실로 단정: pending 에서 빼 포기(permanentDown). recoverMaxRetries 0 이면 무상한(0058 동일).
          const attempts = this.recoverAttempts.get(consumer) || 0;
          if (this.recoverMaxRetries > 0 && attempts >= this.recoverMaxRetries) {
            this.pendingRecover.delete(consumer);
            this.givenUp++;
            this._track('permanent', consumer);   // 프레즌스 permanent 전이(step-0064: 포기를 PresenceService 보고 또는 직접 발행)
            continue;
          }
          this.net.send(this.addr, consumer, { type: 'recover', topic: this.recoverTopic });
          this.pendingRecover.set(consumer, tick);
          this.recoverAttempts.set(consumer, attempts + 1);
          this.recoverRetries++;
        }
      }
    }
    for (const [auth, follower] of this.pairs) {
      if (this.dead.has(auth)) continue;
      const last = this.lastLease.get(auth);
      if (last > 0 && (tick - last) >= this.leaseTimeout) {
        this.dead.add(auth);
        this.deathSeen.set(auth, tick);
        this.promotions++;
        const survivor = this._survivorOf(auth);
        const otherFollower = survivor ? this.pairs.get(survivor) : null;
        this.net.send(this.addr, follower, { type: 'promote', sibling: survivor });
        if (survivor) this.net.send(this.addr, survivor, { type: 'relink', sibling: follower });
        if (otherFollower) this.net.send(this.addr, otherFollower, { type: 'retire' });
        this.net.send(this.addr, 'gateway', { type: 'reroute', from: auth, to: follower, retire: otherFollower });
      }
    }
  }
  _survivorOf(deadAuth) {
    for (const a of this.pairs.keys()) if (a !== deadAuth && !this.dead.has(a)) return a;
    return null;
  }
  // 존 배치 질의(step-0203) — "이 존이 어디 사나 / 몇 개 배치됐나"(배치 SSOT 읽기). 게이트웨이 라우팅·검증이 쓴다. 질의 인터페이스(request/reply over net)는 0204.
  placementOf(zoneId) { return this.placement.get(zoneId) || null; }
  placedCount() { return this.placement.size; }
  // host 부하(step-0217) — 그 host 에 배치된 존 수(배치 SSOT 에서 파생·부하 지표). 부하 분산 판정의 기준.
  hostLoad(host) { let n = 0; for (const h of this.placement.values()) if (h === host) n++; return n; }
  // 최소 부하 host(step-0217) — 후보 중 hostLoad 최소를 고른다. 동률은 후보 배열 순서로 결정론 tie-break(첫 최소). 후보 없으면 null.
  _leastLoaded(hosts) {
    let best = null, bestLoad = Infinity;
    for (const h of hosts) { const l = this.hostLoad(h); if (l < bestLoad) { bestLoad = l; best = h; } }
    return best;
  }
  // 부하 재배치 자동 트리거(step-0223·placeRebalance) — 후보 host 부하 불균형(최대−최소 ≥ 2)이면 최대부하 host 의 존(placement 삽입 순 첫 존)을 최소부하 host 로 옮긴다(release+acquire 쌍=0218 자동판). 균형(gap<2)까지 한 패스 수렴. 동률은 후보/존 순서로 결정론 tie-break. 옮긴 존 수 반환(균형이면 0).
  _rebalance(hosts) {
    let moved = 0;
    while (true) {
      let maxH = null, maxL = -1, minH = null, minL = Infinity;
      for (const h of hosts) { const l = this.hostLoad(h); if (l > maxL) { maxL = l; maxH = h; } if (l < minL) { minL = l; minH = h; } }
      if (maxH === null || maxL - minL < 2) break;            // 균형(또는 후보 없음) → 종료.
      let z = null; for (const [zid, h] of this.placement) if (h === maxH) { z = zid; break; }   // 최대부하 host 의 첫 존(삽입 순).
      if (z === null) break;
      this.placement.set(z, minH); moved++;                   // release(maxH)+acquire(minH) — 단일 키 원자 교체.
    }
    this.rebalanceMoves += moved; return moved;
  }
  // host 드레인(step-0224·placeDrain) — 정비/퇴역할 host 의 *모든* 존을 나머지 host 중 최소부하로 차례차례 이주(release+acquire 연쇄·권위 단일 소유 보존·드레인 후 그 host 부하 0). 매 존마다 최소부하 재계산(부하 고르게 분산). 다른 host 없으면 보류. 옮긴 존 수 반환.
  _drain(host, hosts) {
    let moved = 0;
    const others = (hosts || []).filter(h => h !== host);   // 드레인 대상 제외 후보.
    for (const [zid, h] of [...this.placement]) {            // placement 삽입 순(결정론).
      if (h !== host) continue;                             // 드레인 host 의 존만.
      const target = this._leastLoaded(others);             // 매번 최소부하 재계산(고른 분산).
      if (target === null) break;                           // 받을 host 없음 → 보류.
      this.placement.set(zid, target); moved++;             // release(host)+acquire(target).
    }
    this.drainMoves += moved; return moved;
  }
}

const __part = { Orchestrator };
if (typeof module !== 'undefined' && module.exports) module.exports = __part;
if (typeof globalThis !== 'undefined') (globalThis.__HktNetParts = globalThis.__HktNetParts || {}).orchestrator = __part;
