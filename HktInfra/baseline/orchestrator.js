'use strict';
// step-0285 — #56 브리지 존 데이터 평면 5: zoneEntitiesLost 계측(hostdown 소실·정직한 한계).
// step-0283 — #56 브리지 존 데이터 평면 3: zoneLeaves 계측(leave 흐름·entity 제거).
// step-0282 — #56 브리지 존 데이터 평면 2: zoneMoves 계측(move 흐름). orch 가 런타임 onTick 을 구동해 위치 적용(orch-control onTick·orch-zonebridge _tickRuntimes).
// step-0281 — #56 브리지 존 데이터 평면 1: zoneEntityFlow 플래그 + zoneEnters 계측. 브리지 존(zoneRuntimes)이 빈 핸들이던 것을, enter 라우팅으로 실 entity 가 흐르게 시작(라우팅·질의는 orch-zonebridge.js·onMsg 분기는 orch-control.js). OFF→0280 비트 동일.
// step-0251 — 정리(#49 인접): 배치 SSOT 런타임 메서드(_start/_migrate/_hostDown/_stop/_rebalance/_drain·load helper·executed/placement 질의)를 orch-placement.js 로 분리(34KB>30KB 트리거 유계화). Object.assign 으로 prototype 에 되섞어 동작 비트 불변(reg 0·플래그 없는 투명 분할). 프레즌스/failover 제어 평면(onMsg·onTick·_track·_presence·monitor)은 잔류.
// step-0250 — 배치 SSOT 실배선(#51) 10: placeQuery 가 executed 실 가동 host 회신. 0204 배치 질의는 결정(placement)만 회신했다 — 이제 reply 에 *실 가동 host*(running)도 실어, 게이트웨이가 존이 *실제로 도는 곳*으로 라우팅한다(결정만이 아니라 집행 위치까지 읽기). reply 에 running 필드 추가(읽기 전용·placeQuery 미수신이면 0249 비트 동일·reg 0). executed 배치 SSOT 의 읽기 경로 완성(0241~0250 decade 닫기).
// step-0249 — 배치 SSOT 실배선(#51) 9: 전 lifecycle 집행 capstone. `runningHosts()` 질의(현재 존을 돌리는 *가동 중 host* 집합·운영 대시보드). 한 혼합 시퀀스(start→auto→rebalance→migrate→stop→hostdown→auto)가 전 op 를 거쳐도 매번 결정(placement)==집행(running)·drift 0·한 존 정확히 한 host(공백/중복 0)를 단언 — executed 배치 SSOT arc(0241~0249) 닫기. 읽기 질의 1개·OFF→0248 비트 동일(reg 0).
// step-0248 — 배치 SSOT 실배선(#51) 8: host 장애 복구(placeHostDown). host 가 *비자발적*으로 죽으면(드레인=계획 퇴역과 달리) 그 host 의 모든 존 런타임이 소실 → 살아남은 host 중 최소부하로 *재가동(re-acquire)*. 죽은 host 는 release 불가(이미 죽음)이므로 graceful migrate 가 아니라 running 단일 키 재배치(공백 없이 한 존 정확히 한 host 회복). 복구 후 죽은 host running 0·drift 0. placeHostDown 미수신이면 0247 비트 동일(reg 0).
// step-0247 — 배치 SSOT 실배선(#51) 7: executed placeAuto. 부하 기반 자동 배치(placeAuto)가 placeExecute ON 이면 최소부하 host 선택 + paper placement 갱신에 더해 실 존 런타임도 그 host 에 가동(_start). 0217 advisory 자동 배치의 집행 판. OFF→0246 비트 동일(reg 0).
// step-0246 — 배치 SSOT 실배선(#51) 6: executed placeStop. placeStop{zoneId} → 존을 운영 퇴역: 결정(placement)에서 제거 + placeExecute ON 이면 실 존 런타임도 종료(running 제거·instance.js _despawn 의 존 판). 없는 존은 멱등 no-op. 드레인(host 전체 이주)과 달리 *그 존 자체를 내린다*. placeStop 미수신이면 0245 비트 동일(reg 0).
// step-0245 — 배치 SSOT 실배선(#51) 5: placement↔running reconcile capstone. `placementDrift()` 질의(결정 placement 와 집행 running 이 어긋난 존 수). placeExecute ON 이면 모든 배치 op(place/migrate/rebalance/drain) 뒤 drift 0(결정==집행·paper 표류 없음)을 단언 — advisory→executed arc 닫기. 코드는 읽기 질의 1개(쓰기 무변경)·OFF→0244 비트 동일(reg 0).
// step-0244 — 배치 SSOT 실배선(#51) 4: executed placeDrain. placeExecute ON 이면 host 드레인이 paper placement.set 마다 실 존 런타임도 _migrate(release+acquire)로 이주 → 드레인 후 그 host running 0(실제 비워짐·0224 퇴역 안전 이주의 집행 판). 0242 _migrate 재사용. OFF→0243 비트 동일(reg 0).
// step-0243 — 배치 SSOT 실배선(#51) 3: executed placeRebalance. placeExecute ON 이면 자동 부하 재배치가 paper placement.set 마다 실 존 런타임도 _migrate(release+acquire)로 함께 이주(running 균형까지 실제 수렴·0223 자동 트리거의 집행 판). 0242 _migrate 재사용. OFF→0242 비트 동일(reg 0).
// step-0242 — 배치 SSOT 실배선(#51) 2: executed placeMigrate. placeExecute ON 이면 placeMigrate 가 paper placement 갱신에 더해 실 존 런타임을 release(기존 host)+acquire(toHost) 쌍으로 *실제 이주*(running 단일 키 원자 교체·한 존은 정확히 한 host·공백/중복 0). paper Map.set 만이던 0218 의 집행 판(advisory→executed migrate). OFF→0241 비트 동일(reg 0).
// step-0241 — 배치 SSOT 실배선(#51) 1: 존 런타임 레지스트리(running). placement(결정 SSOT·"어디서 돌아야 하나")와 별개로 *실제 가동 중인* 존 런타임을 host 별로 추적하는 executed SSOT(=집행 현실). placeExecute ON 이면 placeZone 이 paper 갱신에 더해 실 존 런타임을 *띄운다*(running.set·starts++·instance.js active SSOT 와 동형). OFF 면 paper map 만 = 0240 비트 동일(reg 0). advisory→executed 의 첫 조각.
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
// 배치 SSOT 런타임 믹스인(step-0251 분리) — Node require / 브라우저 전역 둘 다.
const { OrchPlacement } = (typeof module !== 'undefined' && module.exports && typeof require !== 'undefined')
  ? require('./orch-placement.js') : globalThis.__HktNetParts.orch_placement;
// step-0267 분할 — 제어 평면 핸들러(onMsg·onTick) 믹스인.
const { OrchControl } = (typeof module !== 'undefined' && module.exports && typeof require !== 'undefined')
  ? require('./orch-control.js') : globalThis.__HktNetParts.orch_control;
// step-0272 — #51b 실 zone.js 브리지 믹스인(_bridgeStart·존 런타임 질의).
const { OrchZoneBridge } = (typeof module !== 'undefined' && module.exports && typeof require !== 'undefined')
  ? require('./orch-zonebridge.js') : globalThis.__HktNetParts.orch_zonebridge;

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
    // 존 런타임 레지스트리(step-0241·#51 실배선) — placement 가 "어느 존이 어느 host 에서 *돌아야* 하나"(결정)라면, running 은 "지금 *실제로* 어느 host 에서 도는가"(집행 현실). placeExecute ON 이면 배치 결정이 실 존 런타임 lifecycle(start/migrate/stop)을 구동한다(advisory paper → executed). OFF 면 빈 채 = 0240 비트 동일.
    this.placeExecute = opts.placeExecute || false;
    this.running = new Map();     // zoneId -> host (실 가동 중인 존 런타임의 host·executed SSOT·권위 단일 소유: 한 존은 정확히 한 host 에서 돈다).
    this.starts = 0;              // executed placeZone 으로 실제 가동(start)된 존 런타임 누적 수(step-0241·계측·멱등 재배치 제외).
    this.runtimeMigrations = 0;   // executed placeMigrate 로 실 존 런타임을 release+acquire 이주한 누적 수(step-0242·집행·paper migrations 와 대조).
    this.stops = 0;               // 처리한 placeStop 수(step-0246·계측·no-op 멱등 포함).
    this.zonesRetired = 0;        // placeStop 으로 실제 퇴역(placement 에서 제거)된 존 누적 수(step-0246·존 자체 내림).
    this.hostDowns = 0;           // 처리한 placeHostDown 수(step-0248·계측·생존 host 없으면 보류 포함).
    this.hostRescued = 0;         // host 장애로 살아남은 host 에 재가동(re-acquire)된 존 누적 수(step-0248·비자발적 복구).
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
  _survivorOf(deadAuth) {
    for (const a of this.pairs.keys()) if (a !== deadAuth && !this.dead.has(a)) return a;
    return null;
  }
}
// 배치 SSOT 런타임 메서드(_start/_migrate/_hostDown/_stop/_rebalance/_drain·load helper·placement/executed 질의)는 orch-placement.js 로 분리(step-0251).
// Object.assign 으로 prototype 에 되섞는다 — 정의 위치만 옮길 뿐 this 바인딩·메서드 해소 동일 = 동작 비트 불변(reg 0). onMsg 의 placeX 분기가 this._start/_migrate/... 로 그대로 호출.
Object.assign(Orchestrator.prototype, OrchPlacement);
// step-0272 — #51b 실 zone.js 브리지 메서드를 프로토타입에 되섞음(_start 가드가 zoneBridge ON 일 때만 호출 = OFF 비트 동일).
Object.assign(Orchestrator.prototype, OrchZoneBridge);
// step-0267 분할 — 제어 평면 핸들러(onMsg·onTick)를 프로토타입에 되섞음(정의 위치만 이동·this 바인딩 동일·reg 0).
Object.assign(Orchestrator.prototype, OrchControl);

const __part = { Orchestrator };
if (typeof module !== 'undefined' && module.exports) module.exports = __part;
if (typeof globalThis !== 'undefined') (globalThis.__HktNetParts = globalThis.__HktNetParts || {}).orchestrator = __part;
