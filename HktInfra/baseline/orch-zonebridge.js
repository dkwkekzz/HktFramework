'use strict';
// step-0355 — #57 실 host.js OS 프로세스 spawn 5: _zoneDeliver 의 host inbox enqueue 지점에서 clusterDriver.onFrame(host,zoneId) 호출(실 cluster.rpc deliver 소켓 송신 자리). 미부착→호출 0 = 0354 비트 동일.
// step-0306 — #9 잔여(실 host.js 물리 분리): host inbox stale 거부. _tickRuntimes drain 시 그 host 가 더는 소유 안 하는(이주로 떠난) 존의 frame 을 적용하지 않고 거부(zoneHostStale++) — 실 프로세스 이중 쓰기 방지. 정상 tick 0·recv == drained + stale. OFF(zoneHostProc)→경로 미발화 = 0305 비트 동일.
// step-0305 — 정리 분할: host 프로세스 컨테이너 층(0301~0304)을 orch-hostproc.js 로 분리(>30KB 트리거 유계화·기능 0·reg 0). 이 파일엔 실 zone.js 브리지 lifecycle·전송 seam·#56 데이터 평면 질의가 남는다.
// step-0302 — #9 잔여(실 host.js 물리 분리): host 자기 inbox 수신 + 자기 루프 drain·tick(_zoneDeliver→host 컨테이너 inbox·_tickRuntimes host 단위 drain·tick·실 host.js 루프 씨앗). zoneHostProc ON 이면 _zoneDeliver 가 frame 을 그 존의 host 컨테이너 inbox(zoneId 태깅)에 enqueue(per-runtime mbox 대체·소켓 1개=host 1개)·_tickRuntimes 가 host 단위로 자기 inbox drain 후 자기 소유 존만 onTick(실 host.js 프로세스 루프 씨앗). OFF→0301 비트 동일.
// step-0301 — #9 잔여(실 host.js 물리 분리): host 1급 컨테이너(zoneHosts) 레지스트리. flat zoneRuntimes(zoneId→{zone,host}) 위에, host 가 *자기 존 집합을 소유한 컨테이너*(실 host.js 프로세스의 씨앗)임을 _hostSet 으로 유지. 배치 집행(start/migrate/hostdown/stop)이 zone→host 귀속을 갱신. 질의 hostRuntimeCount/zoneHostOf/zoneHostHosts. zoneHostProc OFF→호출 자체 no-op = 0300 비트 동일.
// step-0300 — #9 멀티프로세스 배선 10·capstone: directFlowCoherent 질의(entityFlowCoherent && entityDirectCoherent). destructive+graceful 혼합 lifecycle 을 게이트웨이 직접 라우팅만으로 돌린 뒤 참 → #9 arc 0291~0300 닫기. 읽기 전용.
// step-0298 — #9 멀티프로세스 배선 8: entityDirectCoherent 질의(직접 라우팅 데이터 평면 정합 + stale 누수 0). 읽기 전용·동작 무변경.
// step-0293 — #9 멀티프로세스 배선 3: 게이트웨이 존 디렉토리 push(_pubZoneLoc). 배치 집행(start/migrate/stop/hostdown)마다 zone→host 위치를 게이트웨이에 push(zoneLoc·서비스 디스커버리) → 게이트웨이가 라우팅 테이블 캐시(#9 직접 라우팅 전제). gatewayZoneDir OFF→push 0 = 0292 비트 동일.
// step-0292 — #9 멀티프로세스 배선 2: 존 host mailbox(_zoneDeliver enqueue + _tickRuntimes drain). zoneHostMailbox ON 시 frame 을 즉시 적용 대신 핸들 mbox 큐에 쌓고 onTick 전 일괄 drain(소켓 수신 버퍼+host.js per-tick deliver 배치 씨앗). OFF→0291 즉시 적용 동일.
// step-0291 — #9 멀티프로세스 배선 1: 존 런타임 전송 seam(_zoneDeliver). 브리지 enter/move/leave 가 실 EntityZone 핸들에 직접 onMsg 하던 것을, zoneHostHandle ON 시 JSON 직렬화 경계(소켓 와이어의 씨앗)로 round-trip 시켜 적용. OFF→0290 비트 동일.
// step-0290 — #56 브리지 존 데이터 평면 10·capstone: entityFlowCoherent(fullyCoherent+entityCoherent)·entityConserved(보존 회계 항등식). #56 arc 0281~0290 닫기.
// step-0289 — #56 브리지 존 데이터 평면 9: entityCensus 질의(전 런타임 entity 분포). graceful 재배치(rebalance/drain·_migrate 같은 핸들)는 total 무손실 보존.
// step-0288 — #56 브리지 존 데이터 평면 8: entityCoherent 질의(단일 소유 + entity 보유 런타임은 모두 executed running·orphan 0).
// step-0287 — #56 브리지 존 데이터 평면 7: entityOwnerZone/entityOwnerCount/entitiesSingleOwner 질의(entity 권위 단일 소유의 데이터 평면 판).
// step-0286 — #56 브리지 존 데이터 평면 6: _bridgeStop 에 zoneEntitiesDiscarded 계측(존 퇴역→entity 폐기·계획적).
// step-0285 — #56 브리지 존 데이터 평면 5: _bridgeHostDown 에 zoneEntitiesLost 계측(hostdown=새 인스턴스→entity 소실·migrate 무손실과 대조).
// step-0284 — #56 브리지 존 데이터 평면 4: totalEntities() census 질의. migrate(_bridgeMigrate·같은 핸들)가 entity 를 *행동적으로* 무손실 보존함을 단언(0273 구조적 보존의 데이터 평면 판).
// step-0283 — #56 브리지 존 데이터 평면 3: _bridgeLeave(leave 라우팅·entity 제거).
// step-0282 — #56 브리지 존 데이터 평면 2: _bridgeMove(move 라우팅)·_tickRuntimes(런타임 onTick 구동·위치 적용)·zoneEntityPos 질의.
// step-0281 — #56 브리지 존 데이터 평면 1: _bridgeEnter(실 EntityZone 핸들로 enter 라우팅)·zoneEntityCount/zoneHasEntity 질의. 0272~0280 의 빈 핸들에 실 entity 가 흐르기 시작.
// step-0272 — #51b 실 zone.js 브리지. 0241~0250 의 배치 실배선은 running(zoneId→host 문자열)까지였다 — *집행 SSOT* 이되 실 EntityZone 런타임과는 끊겨 있었다.
//   이 믹스인은 그 간극을 잇는다: placement 집행(_start/_migrate/_stop)이 *실 EntityZone 인스턴스*를 host 에 띄우고/이주하고/내린다(zoneRuntimes 레지스트리).
//   오케스트레이터가 존 런타임을 spawn/배치하는 것은 그 정의 책임(SPINE §2 코디네이션: "존 배치·인스턴스 spawn") — 은닉 위반이 아니라 집행이다.
//   EntityZone 팩토리는 makeActor(topo-actors)가 zoneBridge ON 일 때 주입(직렬화 불가 함수이므로 spec 이 아닌 액터 구성 시점). OFF 면 이 메서드들이 호출되지 않아 0271 비트 동일(reg 0).
// dual-mode: Node require / 브라우저는 net-core.js 가 <script> 선행 로드(전역 __HktNetParts.orch_zonebridge).

// 실 zone.js 브리지 믹스인 — Orchestrator.prototype 에 Object.assign 으로 섞인다. 모든 메서드는 this=Orchestrator 인스턴스.
const OrchZoneBridge = {
  // host 프로세스 컨테이너 층(_hostSet·hostRuntimeCount·zoneHostOf·zoneHostHosts·hostRegistered·zoneHostSingleOwner·zoneHostDrift)은 step-0305 에서 orch-hostproc.js 로 분리(>30KB 트리거 유계화). 같은 prototype 에 Object.assign 되므로 this._hostSet 등은 그대로 해소(투명 분할·reg 0).
  // 브리지 start(step-0272) — 배치 결정 집행 시 실 EntityZone 런타임을 host 에 띄운다(zoneRuntimes 등록). 이미 도는 존이면 host 만 정렬(멱등·신규 인스턴스화 아님). zoneBridge OFF·팩토리 부재면 호출 자체가 없다(_start 가드).
  _bridgeStart(zoneId, host) {
    const rt = this.zoneRuntimes.get(zoneId);
    if (rt) { rt.host = host; this._hostSet(zoneId, host); this._pubZoneLoc(zoneId, host); return false; }   // 이미 가동 — host 만 정렬(멱등·컨테이너 귀속도 정렬).
    const zone = this.zoneFactory(zoneId);      // 실 EntityZone 인스턴스화(결정론 시드=zoneId 해시·makeActor 주입 팩토리).
    this.zoneRuntimes.set(zoneId, { zone, host, mbox: [] });   // mbox: 존 host 수신 버퍼(step-0292·mailbox OFF 면 미사용).
    this.zoneStarts++;
    this._hostSet(zoneId, host);                // step-0301 (#9 잔여) — host 컨테이너에 귀속(실 host.js 프로세스가 이 존을 소유).
    this._pubZoneLoc(zoneId, host);             // step-0293 (#9) — 게이트웨이 디렉토리에 위치 공표(서비스 디스커버리).
    return true;
  },
  // 게이트웨이 존 위치 공표(step-0293·#9) — 배치 집행으로 zone→host 가 바뀌면 게이트웨이에 zoneLoc 을 push(서비스 디스커버리). host===null 이면 퇴역 통보(게이트웨이가 디렉토리에서 삭제). gatewayZoneDir OFF·net 부재면 no-op = 0292 비트 동일. orch 가 게이트웨이 주소를 *명시*로만 안다(은닉 — 게이트웨이 내부 무지).
  _pubZoneLoc(zoneId, host) {
    if (this.gatewayZoneDir && this.net && this.addr) { this.net.send(this.addr, 'gateway', { type: 'zoneLoc', zoneId, host }); this.zoneLocPushed++; }
  },
  // 브리지 migrate(step-0273) — 배치 재결정 집행 시 *같은 EntityZone 인스턴스*의 host 를 release(기존)+acquire(toHost) 쌍으로 원자 교체한다(존 런타임 핸들 이주 = 상태 보존·재생성 아님·zoneRuntimes 단일 키 = 한 존 정확히 한 host). 미가동·같은 host 는 멱등 no-op. zoneBridge OFF·팩토리 부재면 호출 자체가 없다(_migrate 가드).
  _bridgeMigrate(zoneId, toHost) {
    const rt = this.zoneRuntimes.get(zoneId);
    if (!rt) return false;             // 미가동 — 집행 대상 없음(멱등).
    if (rt.host === toHost) return false;
    rt.host = toHost;                  // 같은 EntityZone 핸들(상태·entity 보존)의 host 만 원자 교체 — 새 인스턴스 만들지 않음.
    this.zoneMigrations++;
    this._hostSet(zoneId, toHost);     // step-0301 (#9 잔여) — host 컨테이너 귀속을 새 host 로 이동(이전 host 컨테이너에서 떼고 새 host 에 붙임).
    this._pubZoneLoc(zoneId, toHost);  // step-0293 (#9) — 이주된 새 host 를 게이트웨이 디렉토리에 갱신.
    return true;
  },
  // 브리지 hostDown(step-0275) — host 장애 복구 집행 시 죽은 host 의 실 EntityZone 런타임을 생존 host 에 *새 인스턴스*로 재가동한다. migrate(자발·같은 핸들·상태 보존)와 결정적으로 다르다: 죽은 host 의 런타임은 이미 소실이므로 graceful 이주 불가 → 새 인스턴스(상태 보존 *불가*·잃은 상태 복구는 영속서 후속·범위 밖). zoneRuntimes 의 zone 핸들을 교체하고 host 를 target 으로. 없는 존 멱등.
  _bridgeHostDown(zoneId, target) {
    const rt = this.zoneRuntimes.get(zoneId);
    if (!rt) return false;
    this.zoneEntitiesLost += rt.zone.ents.size;   // step-0285 (#56) — 죽은 host 인스턴스의 entity 는 graceful 이주 불가 → 소실. 정직히 계측(잃은 상태 복구는 영속서 재구성·범위 밖).
    rt.zone = this.zoneFactory(zoneId);   // 새 인스턴스 — 죽은 것 폐기(상태 소실·비자발적). migrate 와 달리 핸들 동일성 *깨짐*이 정상.
    rt.host = target;
    this.zoneRescued++;
    this._hostSet(zoneId, target);        // step-0301 (#9 잔여) — 죽은 host 컨테이너에서 떼고 생존 host 컨테이너에 재귀속(죽은 host 가 마지막 존을 잃으면 roster 에서 제거).
    this._pubZoneLoc(zoneId, target);     // step-0293 (#9) — 재가동된 생존 host 를 게이트웨이 디렉토리에 갱신.
    return true;
  },
  // 브리지 stop(step-0274) — 존 운영 퇴역 집행 시 실 EntityZone 런타임을 zoneRuntimes 에서 제거(핸들 폐기 = 인스턴스 GC 대상). 없는 존은 멱등 no-op(zoneStops 무증). instance.js _despawn 의 존 판. zoneBridge OFF·팩토리 부재면 호출 자체가 없다(_stop 가드).
  _bridgeStop(zoneId) {
    const rt = this.zoneRuntimes.get(zoneId);
    if (!rt) return false;
    this.zoneEntitiesDiscarded += rt.zone.ents.size;   // step-0286 (#56) — 존 운영 퇴역 시 그 핸들의 entity 는 폐기(계획적·hostdown 비자발 소실과 구분·계측). 퇴역 전 세션 이전/영속은 후속.
    this.zoneRuntimes.delete(zoneId); this.zoneStops++;
    this._hostSet(zoneId, null);      // step-0301 (#9 잔여) — host 컨테이너에서 제거(어느 host 도 소유 안 함·그 host 가 마지막 존이면 roster 에서 빠짐).
    this._pubZoneLoc(zoneId, null);   // step-0293 (#9) — 퇴역을 게이트웨이 디렉토리에 통보(삭제).
    return true;
  },
  // 존 런타임 질의(step-0272) — "이 존의 실 EntityZone 핸들 / 그 host / 총 몇 개 실 런타임이 도나"(브리지 읽기·running 문자열 SSOT 와 대조해 실물 정합 검증).
  zoneRuntimeOf(zoneId) { const rt = this.zoneRuntimes.get(zoneId); return rt ? rt.zone : null; },
  zoneRuntimeHostOf(zoneId) { const rt = this.zoneRuntimes.get(zoneId); return rt ? rt.host : null; },
  runtimeCount() { return this.zoneRuntimes.size; },
  // 실 런타임 host 분포 질의(step-0275) — 그 host 에서 도는 실 EntityZone 런타임 수(장애/드레인 후 그 host 0 검증·running 문자열 runningOn 의 실물 짝).
  runtimeOn(host) { let n = 0; for (const rt of this.zoneRuntimes.values()) if (rt.host === host) n++; return n; },
  // 실 런타임 가동 host 집합 질의(step-0277) — 현재 실 EntityZone 을 하나라도 돌리는 host 집합(운영 대시보드·재배치 분산/드레인 비움 검증). running 문자열 runningHosts 의 실물 짝.
  zoneRuntimeHosts() { const s = new Set(); for (const rt of this.zoneRuntimes.values()) s.add(rt.host); return s; },
  // 브리지 표류 질의(step-0276) — running(zoneId→host *문자열* 추상 SSOT·0241)과 zoneRuntimes(실 EntityZone 핸들의 host)가 어긋난 존 수(host 불일치 또는 한쪽에만 존재). placeExecute+zoneBridge ON 이면 모든 배치 op(start/migrate/stop/hostdown/rebalance/drain) 뒤 0 — 추상 집행 SSOT 와 실 런타임 레지스트리가 한 몸으로 움직인다(브리지 정합). placementDrift(0245·결정↔집행)의 *실물* 판. 읽기 전용.
  zoneRuntimeDrift() {
    let d = 0;
    const ids = new Set([...this.running.keys(), ...this.zoneRuntimes.keys()]);
    for (const z of ids) { const rt = this.zoneRuntimes.get(z); if (this.running.get(z) !== (rt ? rt.host : undefined)) d++; }
    return d;
  },
  // 브리지 정합 불변 질의(step-0278·capstone primitive) — 브리지가 깨지지 않았는가의 단일 술어: ⒜ 표류 0(추상 host==실 host) ⒝ 실 런타임 수 == 추상 running 수(존 집합 일치). 둘 다 참이면 추상 집행 SSOT 와 실 EntityZone 레지스트리가 완전 일치(한 존=한 host·양쪽). 모든 배치 op 뒤 참이어야(0280 capstone 이 혼합 lifecycle 로 단언). 읽기 전용.
  bridgeCoherent() { return this.zoneRuntimeDrift() === 0 && this.runtimeCount() === this.running.size; },
  // 브리지 존 enter 라우팅(step-0281·#56) — 게이트웨이/운영이 보낸 enter 를 *실 EntityZone 핸들*로 흘린다. 0272~0280 의 zoneRuntimes 는 빈 핸들이었고(entity 0), 이 메서드가 실 zone.js onMsg('enter') 를 호출해 실제 avatar 가 그 존의 ents 에 산다 → migrate "상태 보존"이 *행동적으로* 검증 가능해진다(리뷰 #56). 미가동 존(런타임 없음)은 거부(멱등 false). zoneEntityFlow OFF 면 호출 자체 없음(onMsg 가드·0280 비트 동일).
  _bridgeEnter(zoneId, avatar, sessionId, gateway) {
    const rt = this.zoneRuntimes.get(zoneId);
    if (!rt) return false;             // 미가동 존 — 흘릴 핸들 없음(멱등).
    this._zoneDeliver(rt, { from: gateway || 'gateway', payload: { type: 'enter', sessionId: sessionId || ('s:' + avatar), avatar } }, zoneId);
    this.zoneEnters++;
    return true;
  },
  // 존 런타임 전송 seam(step-0291·#9) — entity frame 을 실 EntityZone 핸들에 흘리는 *단일 경로*. zoneHostHandle ON 이면 frame 을 JSON 직렬화 경계로 round-trip(소켓 와이어의 씨앗·host.js deliver 동형)시켜 적용 → 데이터 평면이 직렬화 가능한 메시지 경계를 통과(원격 host.js 프로세스 분리 전제·#9). 함수/순환 참조가 frame 에 섞이면 여기서 걸린다(원격-검증 가능성의 토대). OFF 면 직접 method 호출 = 0290 비트 동일.
  _zoneDeliver(rt, frame, zoneId) {
    if (this.zoneHostHandle) {
      const wire = JSON.stringify(frame);          // 직렬화 경계 — 실 소켓이면 이 바이트가 와이어로 간다.
      this.zoneFramesDelivered++; this.zoneFrameBytes += wire.length;
      const f = JSON.parse(wire);                  // 역직렬화(원격이면 host 프로세스가 수행).
      if (this.zoneHostProc) {                     // step-0302 (#9 잔여) — host 프로세스 수신: frame 을 그 존의 *host 컨테이너 inbox*(zoneId 태깅)에 enqueue. per-runtime mbox(0292)를 host 단일 수신 버퍼로 대체(소켓 1개 = host 프로세스 1개). 적용은 _tickRuntimes 의 host 루프 drain.
        const c = this.zoneHosts.get(rt.host);
        if (c) { (c.inbox || (c.inbox = [])).push({ zoneId, f }); this.zoneHostFramesRecv++; if (c.inbox.length > this.zoneFrameQueueMax) this.zoneFrameQueueMax = c.inbox.length; if (this.clusterDriver) { this.clusterDriver.onFrame(rt.host, zoneId); this.driverFrames++; } }   // step-0355 (#57) — host inbox enqueue = 실 cluster.rpc(host,{cmd:'deliver'}) 소켓 송신 자리(미부착→호출 0·비트 동일).
      } else if (this.zoneHostMailbox) {           // step-0292 (#9) — 비동기 수신: 즉시 적용 대신 핸들 mbox 에 enqueue(소켓 수신 버퍼 씨앗). 적용은 _tickRuntimes drain.
        (rt.mbox || (rt.mbox = [])).push(f);
        if (rt.mbox.length > this.zoneFrameQueueMax) this.zoneFrameQueueMax = rt.mbox.length;
      } else {
        rt.zone.onMsg(f);                          // 0291 경로 — seam 통과 후 즉시 적용.
      }
    } else {
      rt.zone.onMsg(frame);                        // 0290 경로 — 인프로세스 직접 호출.
    }
  },
  // 브리지 존 move 라우팅(step-0282·#56) — enter 한 avatar 의 이동 의도를 실 EntityZone 핸들로 흘린다(onMsg('move')→pending). 실제 위치 적용은 그 존의 onTick 에서(orch 가 _tickRuntimes 로 구동·아래). 미가동 존·미존재 avatar 는 무해(zone.js move 가드: ents.has 만 push). zoneEntityFlow OFF 면 호출 없음(0281 비트 동일).
  _bridgeMove(zoneId, avatar, dx, dy, gateway) {
    const rt = this.zoneRuntimes.get(zoneId);
    if (!rt) return false;
    this._zoneDeliver(rt, { from: gateway || 'gateway', payload: { type: 'move', avatar, d: { dx, dy } } }, zoneId);
    this.zoneMoves++;
    return true;
  },
  // 브리지 존 leave 라우팅(step-0283·#56) — avatar 의 퇴장(로그아웃·존 떠남)을 실 EntityZone 핸들로 흘린다(onMsg('leave')→ents/sessions 제거). 미가동 존·미존재 avatar 는 무해(zone.js delete 멱등). sessionId='s:'+avatar 로 enter 의 세션도 정리. zoneEntityFlow OFF 면 호출 없음(0282 비트 동일).
  _bridgeLeave(zoneId, avatar, gateway) {
    const rt = this.zoneRuntimes.get(zoneId);
    if (!rt) return false;
    const had = rt.zone.ents.has(avatar);
    this._zoneDeliver(rt, { from: gateway || 'gateway', payload: { type: 'leave', sessionId: 's:' + avatar, avatar } }, zoneId);
    if (had) this.zoneLeaves++;
    const sid = 's:' + avatar;   // step-0339 (#9 후속) — 그 세션의 egress 다운스트림 상태(미-ack 버퍼·시퀀스·ack 워터마크) 정리(무계 성장 방지·게이트웨이 정리의 orch 짝). egress OFF 면 빈 맵 delete = no-op → reg 0.
    this.zoneEgressBuf.delete(sid); this.zoneEgressSeq.delete(sid); this.zoneEgressAcked.delete(sid);
    return had;
  },
  // 런타임 존 tick 구동(step-0282·#56) — orch 가 매 tick 자기 zoneRuntimes 의 실 EntityZone onTick 을 돌려 pending move 를 위치에 적용한다(실 zone.js 시뮬 진행). net 싱크가 view send 를 흡수(런타임 존은 클라 직접 전파 안 함·#9 후속). zoneEntityFlow OFF 면 호출 없음(onTick 가드·0281 비트 동일).
  _tickRuntimes(tick) {
    // step-0302 (#9 잔여) — host 프로세스 루프: 각 host 컨테이너가 *자기* inbox 를 drain(소유 존에 dispatch)한 뒤 *자기* 소유 존만 onTick. flat zoneRuntimes 전역 순회 대신 host 단위(실 host.js 프로세스가 자기 존만 수신·tick — 프로세스 경계의 씨앗). zoneHostProc OFF 면 아래 flat 경로 = 0301 비트 동일.
    if (this.zoneHostProc) {
      for (const c of this.zoneHosts.values()) {
        if (c.inbox && c.inbox.length) {           // host 소켓 수신 버퍼 drain — zoneId 로 소유 존 dispatch(FIFO·per-zone 순서 보존).
          for (const { zoneId, f } of c.inbox) {
            // step-0306 (#9 잔여) — host inbox stale 거부: enqueue 후 drain 전(같은 tick 내) 그 존이 *다른 host 로 이주*했으면, 이 host 프로세스는 더는 그 존을 소유하지 않는다 → frame 을 적용하지 않고 거부(zoneHostStale++·drained 미증가). 실 host.js 분리의 핵심 안전망: 프로세스가 자기가 잃은 존의 frame 을 적용하면 이중 쓰기(이주 후 두 host 가 같은 존을 건드림)다. c.zones 가 host 의 *현재* 소유 = 진짜 권위. 정상 흐름(이주 없는 tick)에선 항상 소유 → 거부 0. 불변: recv == drained + stale.
            if (!c.zones.has(zoneId)) { this.zoneHostStale++; continue; }
            const rt = this.zoneRuntimes.get(zoneId); if (rt) rt.zone.onMsg(f);
            this.zoneHostDrained++;
          }
          c.inbox = [];
        }
        for (const zoneId of c.zones) { const rt = this.zoneRuntimes.get(zoneId); if (rt) rt.zone.onTick(tick); }   // 이 host 가 소유한 존만 tick.
      }
      return;
    }
    for (const rt of this.zoneRuntimes.values()) {
      // step-0292 (#9) — mailbox ON 이면 onTick 전 수신 버퍼를 일괄 drain(tick 경계 배치 처리·host.js deliver cmd 동형). FIFO 순 적용 → enter→move 순서 보존. drain 후 onTick 이 pending move 를 위치에 적용.
      if (this.zoneHostMailbox && rt.mbox && rt.mbox.length) {
        for (const f of rt.mbox) rt.zone.onMsg(f);
        this.zoneFramesDrained += rt.mbox.length; rt.mbox = [];
      }
      rt.zone.onTick(tick);
    }
  },
  // 다운스트림 데이터 평면 뷰 질의(0319~0322·zoneViewBuf·zoneViewEntered·zoneViewStats·zoneVisibleIds·zoneViewsFor·zoneViewFrames)는 step-0323 에서 orch-views.js 로 분리(>30KB 트리거 유계화·투명 분할·reg 0). 같은 prototype 에 Object.assign 되므로 this 해소 동일.
  // 브리지 존 entity 위치 질의(step-0282·#56) — 실 EntityZone 핸들의 그 avatar 위치({x,y})·없으면 null. move 적용·migrate 위치 보존 검증.
  zoneEntityPos(zoneId, avatar) { const rt = this.zoneRuntimes.get(zoneId); const e = rt && rt.zone.ents.get(avatar); return e ? { x: e.x, y: e.y } : null; },
  // 브리지 존 entity 질의(step-0281·#56) — "이 존의 실 EntityZone 핸들에 몇 entity 가 사나 / 이 avatar 가 있나"(실 zone.js ents 직접 읽기·migrate 무손실·hostdown 소실 등 데이터 평면 불변 검증의 기초). 미가동 존은 0/false.
  zoneEntityCount(zoneId) { const rt = this.zoneRuntimes.get(zoneId); return rt ? rt.zone.ents.size : 0; },
  zoneHasEntity(zoneId, avatar) { const rt = this.zoneRuntimes.get(zoneId); return rt ? rt.zone.ents.has(avatar) : false; },
  // 전 런타임 entity 총수 질의(step-0284·#56) — 모든 실 EntityZone 핸들의 ents.size 합(전 존 인구). migrate(같은 핸들)·rebalance/drain(graceful)에서 보존·hostdown/stop(파괴)에서 변동을 단언하는 census 의 기초.
  totalEntities() { let n = 0; for (const rt of this.zoneRuntimes.values()) n += rt.zone.ents.size; return n; },
  // entity 소유 질의(step-0287·#56) — "이 avatar 가 어느 런타임 존에 사나 / 몇 개 존에 사나"(데이터 평면 권위 단일 소유의 실물 판·존 핸들의 host 단일 소유 0276 과 동형, entity 차원). entityOwnerZone 은 첫 매칭 zoneId·없으면 null.
  entityOwnerZone(avatar) { for (const [z, rt] of this.zoneRuntimes) if (rt.zone.ents.has(avatar)) return z; return null; },
  entityOwnerCount(avatar) { let n = 0; for (const rt of this.zoneRuntimes.values()) if (rt.zone.ents.has(avatar)) n++; return n; },
  // entity 단일 소유 불변(step-0287·#56) — 어떤 avatar 도 두 개 이상 런타임 존에 동시에 살지 않는다(권위 단일 소유의 데이터 평면 판·공백/중복 0 중 *중복* 측). enter 는 한 존에만 적재·migrate 는 같은 핸들 이동(존 집합 불변)이므로 정상 op 에선 항상 참 — 모든 op 뒤 단언(0290 capstone). 읽기 전용.
  entitiesSingleOwner() {
    const seen = new Set();
    for (const rt of this.zoneRuntimes.values()) for (const a of rt.zone.ents.keys()) { if (seen.has(a)) return false; seen.add(a); }
    return true;
  },
  // entity 정합 불변(step-0288·#56) — entity 데이터 평면이 executed SSOT 와 어긋나지 않는다: ⒜ 단일 소유(어떤 avatar 도 두 존 없음·0287) ⒝ entity 를 담은 실 런타임 존은 모두 running(집행 SSOT)에 있다 — orphan 런타임(running 밖인데 entity 보유)이 없다. stop/hostdown 이 런타임·entity 를 함께 정리하므로 정상 op 뒤 항상 참. 읽기 전용.
  entityCoherent() {
    if (!this.entitiesSingleOwner()) return false;
    for (const z of this.zoneRuntimes.keys()) if (!this.running.has(z)) return false;   // entity 보유 런타임은 반드시 executed running 존(orphan 0).
    return true;
  },
  // 전 데이터 평면 정합 질의(step-0290·#56 capstone) — entity 데이터 평면이 배치 SSOT 와 *완전히* 한 몸인지의 단일 술어: ⒜ fullyCoherent(placement==running==zoneRuntimes 3층·#51b 0280) ⒝ entityCoherent(단일 소유 + entity 보유 런타임 모두 running·0288). 참이면 "어디서 돌아야/돈다고 기록/실제 핸들" 3층 + "entity 가 정확히 한 존에·executed 존에만" 이 모두 정합. 혼합 lifecycle 후 참(0290 capstone). 읽기 전용.
  entityFlowCoherent() { return this.fullyCoherent() && this.entityCoherent(); },
  // 직접 라우팅 데이터 평면 정합 질의(step-0298·#9) — 게이트웨이 직접 라우팅 체제에서 entity 데이터 평면이 정합하고 *오라우팅 누수가 0* 인지의 단일 술어: ⒜ entityCoherent(단일 소유 + orphan 0·0288) ⒝ zoneDirStale === 0(낡은 host frame 이 하나도 적용 안 됨 — 전부 거부). 참이면 "게이트웨이가 결정한 라우팅이 전부 옳은 런타임에 닿았고, entity 가 정확히 한 존에 산다"(직접 라우팅 안전성). 읽기 전용.
  entityDirectCoherent() { return this.entityCoherent() && this.zoneDirStale === 0; },
  // 직접 라우팅 전 데이터 평면 정합 질의(step-0300·#9 capstone) — #9 멀티프로세스 배선이 데이터 평면을 *완전히* 게이트웨이 직접 라우팅으로 옮겼는지의 단일 술어: ⒜ entityFlowCoherent(placement==running==zoneRuntimes 3층 + entity 단일 소유/orphan0·0290) ⒝ entityDirectCoherent(직접 라우팅 정합 + stale 누수 0·0298). 참이면 "배치 3층 정합 + entity 가 정확히 한 존에 + 게이트웨이 직접 라우팅이 전부 옳게 닿았다"가 모두 성립. destructive+graceful 혼합 lifecycle 을 게이트웨이 직접 라우팅만으로 돌린 뒤 참(0300 capstone). 읽기 전용.
  directFlowCoherent() { return this.entityFlowCoherent() && this.entityDirectCoherent(); },
  // entity 보존 회계(step-0290·#56 capstone) — 데이터 평면 보존 항등식: 살아있는 total = 받은 enter − 떠난 leave − hostdown 소실 − stop 폐기. graceful op(migrate/rebalance/drain·같은 핸들)는 항에 안 들어간다(무손실). 모든 op 뒤 성립(0290 capstone). 읽기 전용.
  entityConserved() { return this.totalEntities() === this.zoneEnters - this.zoneLeaves - this.zoneEntitiesLost - this.zoneEntitiesDiscarded; },
  // entity census 스냅샷(step-0289·#56) — 전 런타임의 entity 분포 {total, zones:{zoneId:count}}(운영 대시보드·graceful op 전후 보존 대조). graceful 재배치(rebalance/drain)는 _migrate(같은 핸들)이므로 total 불변·zone 분포만 재편.
  entityCensus() {
    const zones = {}; let total = 0;
    for (const [z, rt] of this.zoneRuntimes) { zones[z] = rt.zone.ents.size; total += rt.zone.ents.size; }
    return { total, zones };
  },
  // 전 계층 정합 질의(step-0280·#51b capstone) — 배치 결정(placement)·추상 집행(running)·실 EntityZone 런타임(zoneRuntimes) **세 층이 완전 일치**하는 단일 술어: ⒜ placementDrift 0(결정==집행·0245) ⒝ bridgeCoherent(집행==실물·0278) ⒞ placedCount==runtimeCount(결정 수==실 런타임 수). 참이면 "어디서 돌아야 하나(결정)==어디서 돈다고 기록(집행)==실제 어느 핸들이 어느 host(실물)" 가 한 몸 — #51b 가 추상 SSOT 와 실 zone.js 런타임을 완전히 이은 증거. 읽기 전용.
  fullyCoherent() { return this.placementDrift() === 0 && this.bridgeCoherent() && this.placedCount() === this.runtimeCount(); },
};

const __part = { OrchZoneBridge };
if (typeof module !== 'undefined' && module.exports) module.exports = __part;
if (typeof globalThis !== 'undefined') (globalThis.__HktNetParts = globalThis.__HktNetParts || {}).orch_zonebridge = __part;
