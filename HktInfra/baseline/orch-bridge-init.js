'use strict';
// step-0332 정리 — Orchestrator 생성자의 *브리지·데이터평면·host컨테이너·egress 필드 초기화*(0272~0331 대입 블록)를 전용 파일로 분리한다.
//   orchestrator.js 가 0331 egress 로 30.5KB>30KB 를 넘겨, 다음 기능 step 전 정리(비대화 트리거). 이 블록은 코멘트 밀도가 높아(필드마다 step 근거) orchestrator 의 부피를 키우던 주범 — 전용 파일로 떼면 orchestrator.js 22.2KB·이 파일 ~10KB·둘 다 <30KB.
//   같은 순서의 동일 대입을 생성자 같은 지점(`this._initBridgeFields(opts)`)에서 호출하므로 동작 비트 불변(reg 0·orch-placement 0251·orch-control 0267·orch-hostproc 0305·orch-views 0323 투명 분할 계보).
// dual-mode: Node require / 브라우저는 net-core.js 가 <script> 선행 로드(전역 __HktNetParts.orch_bridge_init).

// 브리지 필드 init 믹스인 — Orchestrator.prototype 에 Object.assign. this=Orchestrator 인스턴스(생성자가 호출).
const OrchBridgeInit = {
  _initBridgeFields(opts) {
    // 실 zone.js 브리지(step-0272·#51b) — 0241~0250 의 running 은 zoneId→host *문자열* 추상이었다(집행 SSOT 이되 실 런타임 미연결). zoneBridge ON 이면 placement 집행이 *실 EntityZone 인스턴스*를 host 에 띄워(zoneRuntimes 레지스트리) 추상 running 과 실 존 런타임을 잇는다(orchestrator=존 spawn 책임·SPINE §2 코디네이션). 팩토리는 makeActor 가 주입(topo-actors)·OFF 면 빈 채 = 0271 비트 동일.
    this.zoneBridge = opts.zoneBridge || false;
    this.zoneFactory = opts.zoneFactory || null;   // (zoneId)→새 EntityZone. makeActor 가 zoneBridge ON 일 때 주입(직렬화 불가 함수이므로 spec 아님).
    this.zoneRuntimes = new Map();   // zoneId -> { zone: EntityZone, host } (실 가동 존 런타임 핸들·running 문자열 SSOT 의 실물 짝).
    this.zoneStarts = 0;             // 브리지로 실제 인스턴스화(start)한 존 런타임 누적 수(계측·멱등 재배치 제외).
    this.zoneMigrations = 0;         // 브리지로 실 EntityZone 핸들을 release+acquire 이주(host 원자 교체)한 누적 수(step-0273·재생성 아님).
    this.zoneStops = 0;              // 브리지로 실 EntityZone 런타임을 퇴역(zoneRuntimes 제거)한 누적 수(step-0274·멱등 no-op 제외).
    this.zoneRescued = 0;            // host 장애로 죽은 host 의 실 EntityZone 런타임을 생존 host 에 새 인스턴스 재가동한 누적 수(step-0275·비자발적·상태 소실).
    // 브리지 존 데이터 평면(step-0281·#56) — 0272~0280 의 zoneRuntimes 는 *빈 핸들*이었다(entity 0·onTick 0 → migrate "상태 보존"이 구조적이되 행동적이지 않음·리뷰 0271~0280 #56). zoneEntityFlow ON 이면 게이트웨이/운영이 보낸 enter/move/leave 를 orch 가 *실 EntityZone 핸들*(zoneRuntimes.get(zoneId).zone)로 라우팅해 실제 entity 가 실 존 코드(zone.js onMsg/onTick)를 흐른다. OFF 면 라우팅 0 = 0280 비트 동일(zoneBridge 도 OFF 면 런타임 자체 0).
    this.zoneEntityFlow = opts.zoneEntityFlow || false;
    this.zoneEnters = 0;             // 실 EntityZone 핸들로 라우팅한 enter 누적 수(step-0281·계측·미가동 존 거부 제외).
    this.zoneMoves = 0;              // 실 EntityZone 핸들로 라우팅한 move 누적 수(step-0282·계측·위치 적용은 런타임 onTick).
    this.zoneLeaves = 0;            // 실 EntityZone 핸들에서 제거한 leave 누적 수(step-0283·계측·실존 avatar 만).
    this.zoneEntitiesLost = 0;      // host 장애로 죽은 인스턴스에서 소실한 entity 누적 수(step-0285·정직한 한계·migrate 무손실과 대조·복구는 영속 후속).
    this.zoneEntitiesDiscarded = 0; // 존 운영 퇴역(stop)으로 폐기한 entity 누적 수(step-0286·계획적·hostdown 비자발 소실과 구분).
    // 존 런타임 전송 seam(step-0291·#9 멀티프로세스 배선) — 0281~0290 의 브리지는 entity frame 을 실 EntityZone 핸들에 *직접 method 호출*(rt.zone.onMsg)로 흘렸다(인프로세스 결합). zoneHostHandle ON 이면 그 호출을 _zoneDeliver 전송 seam 으로 감싼다: frame 을 JSON 직렬화 경계(소켓 와이어의 씨앗·host.js deliver cmd 동형)로 round-trip 시킨 뒤 적용 → 데이터 평면이 *직렬화 가능한 메시지 경계*를 통과(원격 host.js 프로세스로 분리할 전제). OFF 면 직접 호출 = 0290 비트 동일.
    this.zoneHostHandle = opts.zoneHostHandle || false;
    this.zoneFramesDelivered = 0;   // 전송 seam 으로 흘린 entity frame 누적 수(step-0291·계측·enter+move+leave 합과 대조).
    this.zoneFrameBytes = 0;        // 전송 seam frame 의 직렬화 바이트 누적(step-0291·소켓 대역의 씨앗·>0 이면 실제 와이어를 탔다는 증거).
    // 존 host mailbox(step-0292·#9) — 0291 seam 은 frame 을 *즉시* 적용(동기). zoneHostMailbox ON 이면 deliver=핸들 mbox 큐 enqueue, 적용은 _tickRuntimes 가 onTick 전 일괄 drain — 실 소켓 수신 버퍼 + host.js per-tick deliver 배치(0048)의 씨앗(비동기 수신→tick 경계 일괄 처리). OFF→0291 즉시 적용 동일.
    this.zoneHostMailbox = opts.zoneHostMailbox || false;
    this.zoneFrameQueueMax = 0;     // mbox 최대 큐 깊이(step-0292·계측·≥1 이면 실제로 큐를 거쳤다는 증거·수신 버퍼 압력 관측).
    this.zoneFramesDrained = 0;     // mbox 에서 drain 해 적용한 frame 누적(step-0292·== zoneFramesDelivered 이면 큐 잔류 0·무손실).
    // 게이트웨이 존 디렉토리 push(step-0293·#9) — 0291~0292 는 orch 가 핸들을 직접 보유·게이트웨이는 존 위치를 모른다(entity 라우팅이 orch 경유). gatewayZoneDir ON 이면 배치 집행(start/migrate/stop/hostdown)마다 zone→host 위치를 게이트웨이에 push(zoneLoc·서비스 디스커버리) → 게이트웨이가 라우팅 테이블을 캐시(#9 직접 라우팅의 전제). OFF→push 0 = 0292 비트 동일.
    this.gatewayZoneDir = opts.gatewayZoneDir || false;
    this.zoneLocPushed = 0;         // 게이트웨이로 push 한 zoneLoc 누적(step-0293·계측·배치 집행 수와 대조).
    // 게이트웨이 직접 라우팅 적용(step-0294·#9) — 0293 까지 entity 라우팅 *결정*은 orch 가 했다(zoneId→자기 zoneRuntimes 조회). gatewayDirectZone ON 이면 게이트웨이가 자기 디렉토리로 host 를 해소해 zoneDeliver(host 태깅)로 보내고, orch(=존 host 보유)는 그 host 가 실 런타임 host(running)와 일치할 때만 적용(stale 거부) — 라우팅 결정이 게이트웨이로 이동(#9 핵심). OFF→zoneDeliver 미수신 = 0293 비트 동일.
    this.gatewayDirectZone = opts.gatewayDirectZone || false;
    this.zoneDirectApplied = 0;     // 게이트웨이 직접 라우팅으로 적용한 frame 누적(step-0294·계측).
    this.zoneDirStale = 0;          // 게이트웨이 디렉토리가 뒤처져(이주 직후 등) 거부한 frame 누적(step-0294·정직한 한계·이주 라우팅 정합은 0296).
    this.hostDownBroadcasts = 0;    // 게이트웨이로 보낸 hostDown 일괄 무효화 broadcast 누적(step-0297·장애 검출 신호).
    // 실 host.js 물리 프로세스 분리 씨앗(step-0301·#9 잔여) — 0291~0300 까지 zone-host 핸들은 orch 의 *flat* zoneRuntimes Map(zoneId→{zone,host})·host 는 문자열 태그였다(orch 가 모든 존을 직접 보유·tick). zoneHostProc ON 이면 host 를 *1급 컨테이너*(ZoneHost·자기 존 집합 소유)로 묶는다(zoneHosts: host→{zones}) — 실 host.js 프로세스(여러 존을 소유·자기 소켓으로 수신·자기 루프로 tick)의 씨앗. 배치 집행(start/migrate/hostdown/stop)이 _hostSet 으로 이 컨테이너를 유지. OFF 면 빈 채 = 0300 비트 동일.
    this.zoneHostProc = opts.zoneHostProc || false;
    this.zoneHosts = new Map();      // host -> { zones: Set<zoneId>, inbox: [] } (그 host 프로세스가 소유한 실 존 런타임 집합 + 자기 수신 버퍼·flat zoneRuntimes 의 host 별 묶음·실 host.js 의 씨앗).
    this.zoneHostFramesRecv = 0;     // host 컨테이너 inbox 로 수신한 entity frame 누적(step-0302·소켓 수신 버퍼의 host 프로세스 판·per-runtime mbox 대체).
    this.zoneHostDrained = 0;        // host 자기 루프가 inbox 에서 drain 해 소유 존에 적용한 frame 누적(step-0302·== zoneHostFramesRecv 면 잔류 0·무손실).
    this.hostRegisters = 0;          // host 컨테이너가 *처음 존을 받아 새로 생긴* 누적 수(step-0304·실 host.js 프로세스 spawn 의 씨앗 — 그 host 가 첫 존을 호스팅).
    this.hostDeregisters = 0;        // host 컨테이너가 *마지막 존을 잃어 사라진* 누적 수(step-0304·실 host.js 프로세스 despawn 의 씨앗 — 그 host 가 더는 존을 안 돌림). registers−deregisters == 현 host 수.
    this.zoneHostStale = 0;          // host inbox drain 시 *그 host 가 더는 소유 안 하는*(이주로 떠난) 존의 frame 을 거부한 누적 수(step-0306·실 프로세스 이중 쓰기 방지·정상 tick 0·recv == drained + stale).
    this.zoneHostLifecycle = opts.zoneHostLifecycle || false;   // step-0312 — host 프로세스 생애주기 이벤트 로그 ON 플래그(OFF→로그 0·prior 모드/baseline 비트 동일).
    this.hostLifecycleLog = [];      // step-0312 — host 컨테이너 spawn/despawn 의 *순서 있는 이벤트 스트림* [{host, kind, seq}](hostRegisters/hostDeregisters 가 *얼마나*라면, 이건 *언제 어느 host*·실 cluster.spawnOne/killHost 호출 지점의 씨앗).
    // 다운스트림 egress(step-0331·#9 후속) — 0319~0330 은 host 가 산출한 AOI 뷰를 런타임 존 버퍼(rt.zone.net.buf)에 *포착*만 했다(질의로 읽을 뿐 전역 net 미접촉). zoneEgress ON 이면 orch(host)가 매 tick 그 버퍼의 *새* view frame 을 게이트웨이로 송출(zoneView)한다 — SPINE §4 경로2 월드 다운스트림(존→게이트웨이)의 실 배선 씨앗. per-runtime egress 커서(rt.egN)로 한 frame 1회만 송출(버퍼 미삭제·0319~0330 질의 보존). OFF→송출 0 = 0330 비트 동일.
    this.zoneEgress = opts.zoneEgress || false;
    this.zoneViewEgressed = 0;       // 게이트웨이로 송출한 view/view_delta frame 누적(step-0331·계측·== zoneViewFrames() 면 버퍼 잔류 0·무손실 송출).
    this.zoneEgressSeq = new Map();   // step-0335 — 세션별 다운스트림 전송 시퀀스(sessionId→next dseq). egress frame 마다 단조 dseq 부여(클라가 순서/유실 감지·ack/재전송의 토대). zoneEgress OFF 면 미사용 = 비트 동일.
    this.zoneEgressBuf = new Map();    // step-0336 — 세션별 *미-ack* egress 버퍼(sessionId→[{dseq,frame}]). 게이트웨이 ack 로 가지치기(자기-크기조정·미-ack 만 잔류·재전송 소스·버스 ack 0040 의 다운스트림 판). zoneEgress OFF 면 빈 채 = 비트 동일.
    this.zoneEgressAcked = new Map();  // step-0336 — 세션별 ack 워터마크(이 dseq 이하 게이트웨이 수신 확인·단조). 버퍼 가지치기 기준.
    this.zoneEgressPruned = 0;         // step-0336 — ack 로 가지친 egress frame 누적(계측·== egressed 면 전부 ack·버퍼 0).
    this.zoneEgressBufPeak = 0;        // step-0336 — egress 버퍼 최대 길이(자기-크기조정 유계 증거·ack 면 ≈in-flight).
    this.egressDrop = new Set(opts.egressDrop || []);   // step-0337 — 전송 손실 주입(테스트): "sid#dseq" 의 *첫* egress 를 드롭(전송층 유실 모델). 미설정이면 빈 Set = 손실 0 = 비트 동일.
    this.egressDroppedOnce = new Set(); // step-0337 — 이미 한 번 드롭한 키(재전송은 통과 = 1회 손실 모델·복구 가능성 보장).
    this.zoneEgressDropped = 0;         // step-0337 — egress 전송 손실(드롭)한 frame 누적(주입 계측).
    this.zoneResent = 0;                // step-0337 — 재전송(resync)으로 버퍼에서 다시 보낸 frame 누적.
    this.zoneResyncServed = 0;          // step-0337 — 처리한 게이트웨이 zoneResync 요청 누적.
  },
};

const __part = { OrchBridgeInit };
if (typeof module !== 'undefined' && module.exports) module.exports = __part;
if (typeof globalThis !== 'undefined') (globalThis.__HktNetParts = globalThis.__HktNetParts || {}).orch_bridge_init = __part;
