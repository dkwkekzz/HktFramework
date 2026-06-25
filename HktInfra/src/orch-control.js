'use strict';
// step-0267 정리 분할(#49 인접·선제) — orchestrator.js 가 27.5KB(30KB 근접·성장 박스)라, Orchestrator 의 *제어 평면 핸들러*(onMsg·onTick)를
//   orch-control.js 믹스인으로 분리한다(0251 orch-placement 분할의 짝 — 그쪽은 executed lifecycle 메서드, 이쪽은 메시지/tick 핸들러).
//   코어가 Object.assign(prototype) 로 되섞음 — 정의 위치만 이동·this 바인딩/메서드 해소 동일·기능 0 → reg 0(0266 비트 동일). onMsg 의 placeX 분기는 _start/_migrate(placement 믹스인) 로 그대로 해소.
// dual-mode: Node require / 브라우저는 <script> 선행 로드(전역 __HktNetParts.orch_control).
const OrchControl = {
  onMsg(m) {
    const p = m.payload;
    // 존 배치 SSOT 쓰기(step-0203·placeZone) — {zoneId, host} → 배치 맵 갱신(재배치는 덮어씀). 코디네이션의 배치 결정 권위. placementOps 미주입이면 영영 안 옴 = 0202 비트 동일(reg 0). 질의는 0204.
    if (p.type === 'placeZone') { this.placement.set(p.zoneId, p.host); this.placements++; if (this.placeExecute) this._start(p.zoneId, p.host); return; }
    // 부하 기반 자동 배치(step-0217·placeAuto) — {zoneId, hosts[]} → 후보 host 중 최소 부하(배치된 존 수 최소) host 선택 배치(부하 분산·정적 배치 한계 제거). 동률은 후보 순서로 결정론 tie-break. placeAuto 미수신이면 미발화 = 0216 비트 동일.
    if (p.type === 'placeAuto') {
      const host = this._leastLoaded(p.hosts || []);
      if (host !== null) { this.placement.set(p.zoneId, host); this.autoPlacements++; if (this.placeExecute) this._start(p.zoneId, host); }   // 집행(step-0247) — 실 존 런타임도 가동.
      return;
    }
    // 존 재배치 핸드오프(step-0218·placeMigrate) — {zoneId, toHost} → 이미 배치된 존을 release(기존 host)+acquire(toHost) 쌍으로 옮긴다(권위 단일 소유 보존·공백/중복 0). 미배치 존·같은 host 는 거부(no-op). placeMigrate 미수신이면 미발화 = 0217 비트 동일.
    if (p.type === 'placeMigrate') {
      const from = this.placement.get(p.zoneId);
      if (from === undefined || from === p.toHost) { this.migrateRejects++; return; }   // 미배치/같은 host 거부.
      this.placement.set(p.zoneId, p.toHost); this.migrations++;   // release(from)+acquire(toHost) — Map 단일 키 원자 교체(중간 상태 공백/중복 0).
      if (this.placeExecute) this._migrate(p.zoneId, p.toHost);    // 집행(step-0242) — 실 존 런타임도 이주.
      return;
    }
    // 부하 재배치 자동 트리거(step-0223·placeRebalance) — {hosts[]} → 후보 부하 불균형(최대−최소≥2)이면 최대→최소 host 로 존 자동 이주(균형까지·release+acquire). 0218 placeMigrate 의 자동 트리거판. placeRebalance 미수신이면 미발화 = 0222 비트 동일.
    if (p.type === 'placeRebalance') { this._rebalance(p.hosts || []); this.rebalances++; return; }
    // host 드레인(step-0224·placeDrain) — {host, hosts[]} → host 의 모든 존을 나머지 host 중 최소부하로 이주(release+acquire 연쇄·드레인 후 부하 0). 정비/퇴역. placeDrain 미수신이면 미발화 = 0223 비트 동일.
    if (p.type === 'placeDrain') { this._drain(p.host, p.hosts || []); this.drains++; return; }
    // 존 운영 퇴역(step-0246·placeStop) — {zoneId} → 그 존을 내린다(결정 placement 제거 + placeExecute ON 이면 실 런타임 running 종료). 드레인(host 의 *모든* 존 이주)과 달리 *특정 존 자체*를 stop. 없는 존 멱등. placeStop 미수신이면 미발화 = 0245 비트 동일.
    if (p.type === 'placeStop') { this._stop(p.zoneId); this.stops++; return; }
    // host 장애 복구(step-0248·placeHostDown) — {host, hosts[]} → 비자발적으로 죽은 host 의 모든 존을 살아남은 host 중 최소부하로 *재가동*(re-acquire·드레인의 graceful migrate 와 달리 죽은 host 는 release 불가). 생존 host 없으면 보류. placeHostDown 미수신이면 미발화 = 0247 비트 동일.
    if (p.type === 'placeHostDown') { this._hostDown(p.host, p.hosts || []); this.hostDowns++; return; }
    // 존 배치 질의(step-0204·placeQuery) — {zoneId} 요청에 현재 배치 host 를 {placeReply} 로 회신(request/reply·SPINE §4 경로3·프레즌스 0069/우편 0156 의 배치 판). 순수 읽기(배치 무변경). _lastPlaceReply 에 보관(검증용). 질의 미수신이면 미발화 = 0203 비트 동일.
    if (p.type === 'placeQuery') {
      this.placeQueriesRx++;
      const host = this.placementOf(p.zoneId);          // 결정(어디서 돌아야 하나).
      const running = this.runningHostOf(p.zoneId);      // 집행(step-0250·실제 어디서 도나 — 게이트웨이가 진짜 위치로 라우팅).
      this._lastPlaceReply = { zoneId: p.zoneId, host, running };
      if (this.net && this.addr) { this.net.send(this.addr, m.from, { type: 'placeReply', zoneId: p.zoneId, host, running }); this.placeRepliesSent++; }
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
  },
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
  },
};

const __part = { OrchControl };
if (typeof module !== 'undefined' && module.exports) module.exports = __part;
if (typeof globalThis !== 'undefined') (globalThis.__HktNetParts = globalThis.__HktNetParts || {}).orch_control = __part;

