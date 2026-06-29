'use strict';
// step-0299 — #9 멀티프로세스 배선 9: zoneDirSnapshot 질의(전 라우팅 테이블 {zoneId:host}·running 과 bijection 대조). 읽기 전용.
// step-0294 — #9 멀티프로세스 배선 4: 게이트웨이→실 존 직접 라우팅(zoneEnter). 게이트웨이가 자기 zoneDir 로 존 host 를 해소해 zoneDeliver 로 직접 보낸다(라우팅 결정이 게이트웨이에·orch 데이터 평면 우회). 디렉토리 미스면 드롭. gatewayDirectZone OFF→이전 비트 동일.
// step-0293 — #9 멀티프로세스 배선 3: 존 위치 디렉토리(zoneDir·서비스 디스커버리 캐시). orch 가 배치 집행마다 push 하는 zoneLoc 으로 게이트웨이가 zone→host 위치를 학습(은닉 유지). #9 직접 라우팅(게이트웨이→실 존)의 전제. orch push OFF 면 빈 채.
// step-0048 분할 preamble — 박스 1개=파일 1개 (CLAUDE.md 임계 규칙). 진입점 net-core.js 가 묶는다.
// dual-mode: Node require / 브라우저는 common.js 를 <script> 선행 로드(전역 __HktNetCommon).
const __c = (typeof module !== 'undefined' && module.exports && typeof require !== 'undefined')
  ? require('./common.js') : globalThis.__HktNetCommon;
const { Net, LoginServer, SessionRegistry, mulberry32, fnv1a, DEFAULTS } = __c;
// step-0270 분할 — 메시지 라우팅 핸들러(onMsg) 믹스인.
const { GatewayMsg } = (typeof module !== 'undefined' && module.exports && typeof require !== 'undefined')
  ? require('./gateway-msg.js') : globalThis.__HktNetParts.gateway_msg;

// ── [엣지] 게이트웨이 — 0009 그대로(replicas 를 생성자 인자로 받게만 조정 — 토폴로지 빌더가 단일 경로로 배선) ──
class Gateway {
  constructor(zoneAddrs, replicas = [], inventoryAddr = null, chatAddr = null, busAddr = null, busResendReq = false, busWindow = 0, busAck = false, busOutAck = false, busSeenBound = false, busMinWm = false, busProducerNs = false, busSeenNs = false) {
    this.zones = zoneAddrs.slice();      // 권위 존 주소(enter 라우팅 = zones[0])
    this.replicas = replicas.slice();    // 추종자(shadow) 주소 — failover 시 입력 미러 대상(0009=빈 배열 → 비트 동일)
    this.byClient = new Map();
    this.bySession = new Map();
    this.byAvatar = new Map();            // avatar → bind (가방·채팅 결과를 대상 클라로 라우팅 — service off 면 미사용)
    this.inventory = inventoryAddr;       // 가방 서비스 주소(null = 가방 분리 OFF 또는 버스 ON → 직접 결합 0)
    this.chat = chatAddr;                 // 채팅 서비스 주소(null = 채팅 분리 OFF 또는 버스 ON → 직접 결합 0)
    this.bus = busAddr;                   // 이벤트 버스 주소(null = 버스 OFF → 0015 직접 라우팅 비트 동일)
    this.dropped = 0;
    this.rejected = 0;
    // ── 버스 failover *요청 경로* 무손실(이 step·busResendReq) — 0036 의 §9(요청 드롭=base 대비 mint 손실) 해소. ──
    //   0036 은 *결과* 경로(svc.item.out)를 producer(가방) replay 로 무손실화했다. *요청* 경로(svc.item)는 그 거울:
    //   crash gap 에 떨군 클라 요청(pickup/give/reconcile)은 가방에 도달조차 못 해 mint 자체가 안 일어난다(원장이 base 보다 작음 = mint 손실).
    //   요청의 producer 는 *게이트웨이*다 — 발행한 요청을 inBuffer 에 보관했다 버스 복구 시 재발행(가방 resendOut 의 게이트웨이 판).
    //   재발행은 멱등 불가능한 pickup 을 이중 mint 할 수 있으므로 요청마다 producer-local reqId(단조)를 실어 가방이 dedup(seenReqs).
    this.busResendReq = busResendReq;     // ON 이면 svc.item 요청을 reqId 태깅·inBuffer 보관·버스 복구 시 재발행. OFF = 0036 비트 동일(태깅 0·보관 0·재발행 0).
    this.inBuffer = [];                   // 발행한 svc.item 요청 ev(busResendReq 일 때만) — 버스 복구 재발행 소스. busWindow>0 이면 최근 K 개로 슬라이딩(유계·이 step).
    this.inSeq = 0;                       // producer-local 요청 reqId 카운터(단조·결정론 — 클라 op 순서가 시드 함수). 가방 dedup 키.
    this.inResends = 0;                   // 버스 복구 시 재발행한 요청 수(이 step·계측)
    // ── 유계 replay 버퍼(이 step·busWindow) — 0036 outBuffer·0037 inBuffer 의 *무계 성장* 해소(0032 wfWindow 의 버스 판). ──
    //   0037 inBuffer 는 발행한 *전* 요청을 무계로 쌓는다 → 장기 가동 시 메모리 무한 성장(런타임 위험). failover 가 메우려는 건 *gap 구간*(crash→재구독)에
    //   떨군 요청뿐이므로, 버퍼는 그 창을 덮을 만큼만 있으면 된다. busWindow=K 면 *최근 K 개*만 보관(미끄러지는 유계 창) → per-producer 메모리 O(K) 상한.
    //   gap 요청은 재구독 시점에 *가장 최근* 항목들이라, K≥|gap 요청| 이면 전부 버퍼에 남아 재발행됨 = 무손실 유지. K<gap 이면 가장 오래된 gap 요청이 evict → 손실 재현(K 가 load-bearing).
    //   K=0 = 무계(0038 비트 동일). busResendReq OFF 면 inBuffer 미사용 → busWindow 무관(reg 0 불변).
    this.busWindow = busWindow;           // inBuffer 유계 창 크기 K(0039). 0 = 무계. >0 = 최근 K 개만(슬라이딩·고정 K).
    // ── 요청 버퍼 *자기-크기조정*(이 step·busAck) — 0039 고정 K 의 §9(K 수동 튜닝·gap 초과 시 손실) 해소. ──
    //   고정 K 는 *최대 예상 gap(다운타임×발신율)* 을 사전 추정해야 한다 — 작게 잡으면 손실, 크게 잡으면 메모리 낭비. ack-가지치기는 이를 *자동화*:
    //   소비자(가방)가 처리한 reqId 를 svc.item.ack 로 통보 → 게이트웨이가 *ack 된 요청을 inBuffer 에서 가지치기*. 버퍼엔 *미-ack(in-flight)* 요청만 남는다.
    //   정상 구간엔 ack 가 흘러 버퍼 ≈ 왕복 지연(작게 유지)·gap 구간엔 ack 도 끊겨 버퍼가 gap 만큼 *자동 성장* → 복구 replay 가 정확히 그만큼 덮어 무손실(K 추정 불필요).
    //   busAck OFF 면 ack 발행/가지치기 0 = 0039 비트 동일. busResendReq 전제(inBuffer·reqId 필요) — busWindow 와 상호배타적으로 씀(둘 다 inBuffer 바운드).
    this.busAck = busAck;                 // ON 이면 svc.item.ack 수신 시 inBuffer 가지치기(자기-크기조정). OFF = 0039 비트 동일(ack 미구독·가지치기 0).
    this.inAcked = -1;                    // ack 워터마크 — 이 reqId 이하 전부 가방이 처리 확인(단조). inBuffer 가지치기 기준.
    this.inBufPeak = 0;                   // inBuffer 최대 길이(계측) — 자기-크기조정의 유계 증거(ack 면 ≈in-flight·고정/무계면 K/무한).
    this.inPruned = 0;                    // ack 로 가지친 요청 누적(0040·계측)
    // ── 결과 ack(이 step·busOutAck) — 가방 outBuffer 자기-크기조정의 소비자 측(0040 요청 ack 의 거울). ──
    //   svc.item.out 으로 받은 결과를 클라에 *중계할 때마다* 그 outSeq 를 svc.item.out.ack 로 통보(중계 확인) → 가방이 ack 워터마크 이하 outBuffer 를 가지친다.
    //   결과는 클라 belief Set 갱신이라 *멱등*(재배달 무해) → consumer dedup 불요(0036 발견) — ack 는 *버퍼 가지치기*만 위한 신호다. OFF 면 발행 0 = 0040 비트 동일.
    this.busOutAck = busOutAck;           // ON 이면 svc.item.out 중계마다 svc.item.out.ack{outSeq} 발행. OFF = 0040 비트 동일(ack 발행 0).
    this.outAcksSent = 0;                 // 발행한 결과 ack 누적(0041·계측)
    // ── seenReqs 유계화(이 step·busSeenBound) — 가방 dedup 집합(seenReqs·0037)의 *무계 성장* 해소(0040/0041 §9). ──
    //   가방 seenReqs 는 처리한 *전* reqId 를 무계로 쌓는다(재발행 이중 mint 방어) → 장기 가동 시 무한 성장. 그러나 게이트웨이가 재발행하는 건 inBuffer(미-ack=reqId>inAcked)뿐이라
    //   reqId≤inAcked 는 영영 재출현하지 않는다 → 가방은 그 이하 dedup 상태를 잊어도 안전. inAcked 가 전진할 때 그 prune 프런티어를 svc.item.seen 으로 통보(busAck 의 역방향 워터마크).
    this.busSeenBound = busSeenBound;     // ON 이면 inAcked 전진 시 svc.item.seen{upTo} 발행. OFF = 0041 비트 동일(발행 0). busAck+busResendReq 전제.
    this.seenWmSent = 0;                  // 발행한 seen 워터마크 누적(0042·계측)
    // ── 다중 소비자 min-워터마크(이 step·busMinWm) — 게이트웨이는 결과의 *한* 소비자다(둘째 = ranking). ON 이면 결과 ack 에 consumer:'gateway' 태깅 → 가방이 소비자별 frontier 로 min 계산. ──
    this.busMinWm = busMinWm;             // ON 이면 svc.item.out.ack 에 consumer 태깅. OFF = 0043 비트 동일(태깅 0·단일 워터마크).
    this.busProducerNs = busProducerNs;   // ON 이면 svc.item 요청에 producer(=게이트웨이 주소) 태깅 → 다중 게이트웨이 reqId 네임스페이스 분리(0046). OFF = 0045 비트 동일(미태깅).
    this.busSeenNs = busSeenNs;           // ON 이면 svc.item.seen 워터마크에 producer 태깅 → 가방이 그 producer 의 복합키만 가지치기(이 step·0046 §9 해소). OFF = 0046 비트 동일(미태깅·숫자 워터마크).
    // 존 위치 디렉토리(step-0293·#9) — 게이트웨이가 "어느 존이 어느 host(런타임)에서 도나"를 캐시한다(서비스 디스커버리·라우팅 테이블의 씨앗). orch 가 배치 집행마다 svc 디스커버리 push(zoneLoc)로 갱신·게이트웨이는 orch 내부를 모른 채 토픽/명시 메시지로만 학습(은닉). 이 디렉토리가 #9 직접 라우팅(게이트웨이→실 존)의 전제다. orch 가 gatewayZoneDir OFF 면 push 0 → 빈 채 = 이전 비트 동일.
    this.zoneDir = new Map();             // zoneId -> host(실 런타임 위치). zoneLoc 수신으로 set/delete(orch-zonebridge._pubZoneLoc).
    this.gatewayZoneRoutes = 0;           // step-0294 (#9) — 게이트웨이가 자기 디렉토리로 해소해 직접 라우팅한 entity frame 누적.
    this.gatewayZoneMisses = 0;           // step-0294 (#9) — 디렉토리에 없는 존(미배치/미학습)으로 드롭한 entity frame 누적(정직한 한계).
    this.gatewayHostInvalidated = 0;      // step-0297 (#9) — orch hostDown broadcast 로 죽은 host 의 dir 엔트리를 일괄 무효화한 횟수(장애 검출 반영).
    // 다운스트림 뷰 수신 버퍼(step-0333·#9 후속) — orch egress 가 보낸 zoneView(host 산출 AOI 뷰)를 세션별로 보관(존→게이트웨이 경로의 게이트웨이 종단). 0331 egress 송출의 짝. 세션→클라 라우팅은 후속(0334+). zoneEgress OFF 면 zoneView 미수신 → 빈 채 = 이전 비트 동일.
    this.zoneViewIn = new Map();          // sessionId -> [frame…] (그 세션에 도착한 다운스트림 view/view_delta frame·도착 순서 보존).
    this.zoneViewsRx = 0;                 // 수신한 zoneView frame 누적(step-0333·계측·== orch.zoneEgressCount() 면 egress→게이트웨이 무손실).
    // 다운스트림 라우팅 디렉토리(step-0334·#9 후속) — 브리지 세션→클라 주소(클라가 게이트웨이로 zoneEnter 할 때 학습·orch 의 sessionId 기본 's:'+avatar 와 일치). zoneView 수신 시 이 디렉토리로 클라를 해소해 frame 전달(존→게이트웨이→클라 완성). 미바인딩 세션 frame 은 드롭(계측).
    this.downClients = new Map();         // sessionId -> client addr (다운스트림 전달 대상·zoneEnter 에서 set·은닉: 클라는 게이트웨이만 안다).
    this.zoneViewsRouted = 0;             // 바인딩된 클라로 전달한 다운스트림 frame 누적(step-0334·계측·== zoneViewsRx 면 무드롭 라우팅).
    this.zoneViewDropped = 0;             // 미바인딩 세션이라 드롭한 다운스트림 frame 누적(step-0334·정직한 한계).
    // 다운스트림 시퀀스 추적(step-0335·#9 후속) — orch egress 가 frame 마다 부여한 세션별 단조 dseq 를 추적해 *순서/유실*을 감지(per-세션 next 기대값). 인오더면 next 단조 전진·gap(dseq>기대)이면 카운트(클라 ack/재전송의 게이트웨이 측 토대). zoneEgress OFF 면 dseq 미수신 → 빈 채 = 비트 동일.
    this.downSeqNext = new Map();         // sessionId -> 다음 기대 dseq(인오더 수신마다 +1).
    this.downSeqGaps = 0;                 // dseq != 기대(유실/재정렬)로 감지한 gap 누적(step-0335·정상 인오더 시나리오 0).
    // 다운스트림 재전송 요청(step-0337·#9 후속) — 앞 frame 유실로 gap(dseq>기대) 감지 시 orch 에 zoneResync 발신(에피소드당 1회·인오더 복귀 시 해제). orch 가 버퍼에서 재전송 → gap 닫힘. 손실 없으면 발신 0 = 이전 비트 동일.
    this.downResyncPending = new Set();   // sessionId — 미해결 resync 요청 보유(중복 요청 억제).
    this.downResyncsSent = 0;             // 발신한 zoneResync 누적(step-0337·손실 1건당 ≥1).
    this.downCleaned = 0;                 // step-0339 — 정리한 다운스트림 세션 누적(leave/disconnect 시·stale 바인딩 회수).
    this.downDelivered = new Map();       // step-0340 — 클라 addr → 그 클라로 전달한 sessionId 집합(다운스트림 격리 증거: 각 클라가 *자기 세션 frame 만* 받았는가·교차 누수 0). 읽기 전용 회계(메시지 무영향).
    this.downRecvWindow = 0;              // step-0347 — 세션별 수신 버퍼(zoneViewIn) 유계 창 K(0=무계). 전달 후 frame 은 클라(DownClient)가 보유하므로 게이트웨이는 *최근 K* 만 보관 → per-세션 메모리 O(K) 상한(버스 seenBound 0042·수신함 유계 0099 의 다운스트림 판). 0 면 무계 = 이전 비트 동일.
    this.downRecvPeak = 0;               // step-0347 — 세션 수신 버퍼 최대 길이(유계 증거).
  }
  // 다운스트림 세션 정리(step-0339·#9 후속) — leave/disconnect 시 그 세션의 다운스트림 상태(클라 바인딩·시퀀스·resync·수신 버퍼)를 일괄 제거(stale 바인딩/무계 성장 방지·0334 한계 해소). 미존재 세션은 멱등 no-op.
  _downCleanup(sid) {
    const had = this.downClients.has(sid);
    this.downClients.delete(sid); this.downSeqNext.delete(sid); this.downResyncPending.delete(sid); this.zoneViewIn.delete(sid);
    if (had) this.downCleaned++;
  }
  // 다운스트림 뷰 수신+라우팅(step-0333 수신·step-0334 라우팅) — orch egress zoneView 를 세션 버퍼에 적재(frame 보존) + downClients 바인딩이 있으면 그 클라로 frame 전달(존→게이트웨이→클라). sessionId 없으면 무시(주소 불가)·미바인딩이면 드롭(계측).
  _recvZoneView(p) {
    if (!p.sessionId) return;
    const sid = p.sessionId;
    this.zoneViewsRx++;
    // step-0335/0337 — 다운스트림 시퀀스 인오더 게이팅: dseq 가 기대면 전진·전달·ack, 미래(앞 유실)면 gap·resync 요청(라우팅 안 함), 과거(중복)면 드롭. 인오더만 클라로 전달 = 순서 보장·중복 0.
    if (p.dseq !== undefined) {
      const exp = this.downSeqNext.get(sid) || 0;
      if (p.dseq < exp) return;             // 중복(이미 인오더 수신·재전송 사본) — 드롭(클라 belief 무오염).
      if (p.dseq > exp) {                   // 미래(앞 frame 유실) — gap·resync 요청(에피소드당 1회)·라우팅 보류.
        this.downSeqGaps++;
        if (!this.downResyncPending.has(sid)) { this.net.send(this.addr, 'orch', { type: 'zoneResync', sessionId: sid, from: exp }); this.downResyncPending.add(sid); this.downResyncsSent++; }
        return;
      }
      this.downSeqNext.set(sid, exp + 1);   // 인오더(dseq==exp) — 전진·resync 해제.
      this.downResyncPending.delete(sid);
      this.net.send(this.addr, 'orch', { type: 'zoneViewAck', sessionId: sid, dseq: p.dseq });   // step-0336 — 수신 확인 ack(orch egress 버퍼 가지치기). zoneEgress OFF 면 zoneView 미수신 → ack 0 = 이전 비트 동일.
    }
    let a = this.zoneViewIn.get(sid); if (!a) { a = []; this.zoneViewIn.set(sid, a); }
    a.push(p.frame);
    if (this.downRecvWindow > 0 && a.length > this.downRecvWindow) a.shift();   // step-0347 — 유계 창: 전달 후 frame 은 클라가 보유하므로 최근 K 만 보관(per-세션 메모리 상한). 0 면 무계 = 이전.
    if (a.length > this.downRecvPeak) this.downRecvPeak = a.length;
    const client = this.downClients.get(sid);
    if (client) {
      this.net.send(this.addr, client, p.frame); this.zoneViewsRouted++;   // step-0334 — 인오더 frame 만 세션→클라 전달(클라 와이어 계약 = view/view_delta 기존 형식).
      let ds = this.downDelivered.get(client); if (!ds) { ds = new Set(); this.downDelivered.set(client, ds); } ds.add(sid);   // step-0340 — 격리 회계: 이 클라가 받은 sessionId 기록(교차 누수 검증).
    } else this.zoneViewDropped++;
  }
  // 다운스트림 라우팅 질의(step-0334·#9 후속) — "전달/드롭 누적·이 세션이 어느 클라에 묶였나"(존→게이트웨이→클라 무손실·바인딩 검증). 읽기 전용.
  gatewayRoutedCount() { return this.zoneViewsRouted; }
  gatewayDroppedCount() { return this.zoneViewDropped; }
  downClientOf(sessionId) { return this.downClients.get(sessionId) || null; }
  // 다운스트림 시퀀스 질의(step-0335·#9 후속) — "이 세션의 다음 기대 dseq(=받은 인오더 frame 수)·전체 gap 수"(순서/무유실 검증). 읽기 전용.
  gatewayDownSeqNext(sessionId) { return this.downSeqNext.get(sessionId) || 0; }
  gatewayDownGaps() { return this.downSeqGaps; }
  gatewayResyncsSent() { return this.downResyncsSent; }   // step-0337 — 발신한 다운스트림 재전송 요청 수(손실 복구 발화 증거).
  gatewayCleanedCount() { return this.downCleaned; }      // step-0339 — 정리한 다운스트림 세션 수(leave 회수 증거).
  // 다운스트림 격리 질의(step-0340·#9 후속) — "이 클라가 받은 세션들 / 모든 클라가 정확히 자기 세션 frame 만 받았나(교차 누수 0)". 모든 클라의 전달 세션 집합이 크기 1(자기 1세션)이면 격리 성립. 읽기 전용.
  gatewayClientSessions(client) { const s = this.downDelivered.get(client); return s ? [...s].sort() : []; }
  gatewayDeliveryIsolated() { for (const s of this.downDelivered.values()) if (s.size !== 1) return false; return true; }
  // 다운스트림 운영 대시보드(step-0349·#9 후속) — 게이트웨이 다운스트림 평면 한눈 요약 {rx, routed, dropped, gaps, resyncs, cleaned, sessions, isolated}. 운영 관측·전파 건강 단일 뷰(0331~0348 지표 집계). 읽기 전용.
  downstreamReport() {
    return {
      rx: this.zoneViewsRx, routed: this.zoneViewsRouted, dropped: this.zoneViewDropped,
      gaps: this.downSeqGaps, resyncs: this.downResyncsSent, cleaned: this.downCleaned,
      sessions: this.downClients.size, isolated: this.gatewayDeliveryIsolated(),
    };
  }
  // 다운스트림 뷰 수신 질의(step-0333·#9 후속) — "이 세션에 도착한 다운스트림 frame 수 / 전체 수신 frame 수"(egress→게이트웨이 무손실 검증). 읽기 전용.
  gatewayViewsFor(sessionId) { const a = this.zoneViewIn.get(sessionId); return a ? a.length : 0; }
  gatewayDownstreamCount() { return this.zoneViewsRx; }
  gatewayViewSessions() { return [...this.zoneViewIn.keys()].sort(); }
  // 존 디렉토리 질의(step-0293·#9) — "이 존이 어느 host 에 있다고 게이트웨이가 아나 / 몇 개 아나"(라우팅 결정 기준·orch.running 실물과 대조해 정합 검증). 읽기 전용.
  zoneDirOf(zoneId) { return this.zoneDir.get(zoneId) || null; }
  zoneDirSize() { return this.zoneDir.size; }
  // 존 디렉토리 스냅샷(step-0299·#9) — 게이트웨이가 보유한 전 라우팅 테이블 {zoneId:host}(운영 대시보드·orch.running 과 bijection 대조). 읽기 전용.
  zoneDirSnapshot() { const o = {}; for (const [z, h] of this.zoneDir) o[z] = h; return o; }
  worldTargets() { return this.replicas.length ? this.zones.concat(this.replicas) : this.zones; }
  // 서비스 발신 단일 경로 — 버스 ON 이면 *토픽 발행*(소비자 주소 무지), OFF 면 0015 직접 라우팅(비트 동일).
  _svcSend(topic, directAddr, ev) {
    if (this.bus) { this.net.send(this.addr, this.bus, { type: 'pub', topic, ev }); return true; }
    if (directAddr) { this.net.send(this.addr, directAddr, ev); return true; }
    return false;
  }
  // svc.item 요청 발신(이 step·busResendReq) — _svcSend 위 얇은 래퍼. ON 이면 reqId 태깅 + inBuffer 보관(버스 복구 재발행 소스).
  //   OFF 면 ev 무변형 → _svcSend 그대로 = 0036 비트 동일(reqId 없음·보관 0). 버스 OFF(직접 모드)면 보관 안 함(재발행 무의미).
  _itemReq(ev) {
    if (this.busResendReq) { ev = { ...ev, reqId: this.inSeq++ }; if (this.busProducerNs) ev.producer = this.addr; }   // 요청 dedup 키(producer-local 단조) — 가방이 재발행 중복을 멱등 폐기. busProducerNs ON 이면 producer(=게이트웨이 주소) 태깅 → 다중 게이트웨이 reqId 네임스페이스 분리(이 step). OFF 면 미태깅 = 0045 비트 동일.
    const sent = this._svcSend('svc.item', this.inventory, ev);
    if (sent && this.busResendReq && this.bus) {
      this.inBuffer.push(ev);   // 버스 복구 시 재발행 — gap 에 떨군 요청을 다시 가방에 도달시킨다
      if (this.busWindow > 0 && this.inBuffer.length > this.busWindow) this.inBuffer.shift();   // 미끄러지는 유계 창(0039) — 최근 K 개만 보관(K=0 면 미실행)
      if (this.inBuffer.length > this.inBufPeak) this.inBufPeak = this.inBuffer.length;   // 최대 길이 계측(이 step) — 자기-크기조정 유계 증거
    }
    return sent;
  }
  // 버스 failover 요청 재발행(이 step·busResendReq) — 버스 복구(재구독) 직후 트리거(가방 resendOut 과 같은 위치).
  //   보관한 svc.item 요청을 다시 pub → gap 에 떨군 요청이 가방에 도달해 mint/xfer 발생(원장이 base 따라잡음 = mint 손실 0).
  //   gap *전* 도달한 요청도 함께 재발행되나 가방이 reqId 로 dedup(seenReqs) → 이중 mint 0(멱등). 순수 반응형 제어 평면(존 tick 밖).
  //   OFF 면 호출돼도 즉시 반환(reg 0 불변). 재구독이 라우팅을 복구한 뒤라야 fan-out(토폴로지가 reneg 다음에 트리거).
  resendIn() {
    if (!this.busResendReq || !this.bus) return;
    for (const ev of this.inBuffer) { this.net.send(this.addr, this.bus, { type: 'pub', topic: 'svc.item', ev }); this.inResends++; }
  }
  // 요청 ack 수신(이 step·busAck) — 가방이 svc.item.ack 로 통보한 reqId 까지 inBuffer 가지치기(자기-크기조정).
  //   ack 워터마크(inAcked)는 단조 — 이 reqId 이하 요청은 가방이 처리 확인했으므로 재발행 불필요(gap 손실 후보 아님) → 앞에서부터 제거.
  //   inBuffer 는 inSeq(=reqId) 순서라 front 가 최소 reqId — front.reqId ≤ 워터마크 동안 shift(O(가지친 수)). 미-ack(in-flight) 요청만 남는다.
  //   ack 도 gap 에 끊기므로 다운타임 동안엔 가지치기 멈춰 버퍼가 자동 성장 → 복구 replay 가 정확히 그만큼 덮음(K 추정 불필요). OFF 면 미발동(reg 0 불변).
  _onItemAck(ev) {
    if (!this.busAck || ev == null || ev.reqId === undefined) return;
    const before = this.inAcked;
    if (ev.reqId > this.inAcked) this.inAcked = ev.reqId;
    while (this.inBuffer.length && this.inBuffer[0].reqId <= this.inAcked) { this.inBuffer.shift(); this.inPruned++; }
    // seenReqs 유계화(이 step·busSeenBound) — inAcked 가 전진하면 그 prune 프런티어를 가방에 통보(역방향 워터마크).
    //   가방이 inBuffer 에서 reqId≤inAcked 를 가지쳤으므로 *그 이하는 다시 재발행되지 않는다* → 가방이 seenReqs dedup 집합에서 안전히 잊을 수 있다.
    //   reqId 단조 + 게이트웨이가 각 reqId 를 1회만 발신(재발행만 중복·재발행 범위는 >inAcked) → ≤inAcked 는 영영 재출현 0 → dedup 정확성 보존(dupe 0). OFF 면 발행 0 = 0041 비트 동일.
    if (this.busSeenBound && this.bus && this.inAcked > before) { const sev = this.busSeenNs ? { upTo: this.inAcked, producer: this.addr } : { upTo: this.inAcked }; this.net.send(this.addr, this.bus, { type: 'pub', topic: 'svc.item.seen', ev: sev }); this.seenWmSent++; }   // busSeenNs ON 이면 producer 태깅(가방이 복합키 가지치기·이 step). OFF = 0046 비트 동일.
  }
  // 결과 ack 발행(이 step·busOutAck) — svc.item.out 결과를 중계할 때마다 그 outSeq 를 가방에 통보(0040 요청 ack 발행의 거울).
  //   가방이 이 ack 로 outBuffer 를 가지쳐 자기-크기조정. outSeq 없으면(busOutAck OFF·가방 미태깅) 발행 0 = 0040 비트 동일.
  _ackOut(ev) {
    if (!this.busOutAck || !this.bus || ev == null || ev.outSeq === undefined) return;
    // busMinWm ON 이면 consumer 태깅(다중 소비자 min 의 정의역 키) — OFF 면 0043 비트 동일({outSeq} 단일 워터마크).
    const ack = this.busMinWm ? { outSeq: ev.outSeq, consumer: 'gateway' } : { outSeq: ev.outSeq };
    this.net.send(this.addr, this.bus, { type: 'pub', topic: 'svc.item.out.ack', ev: ack });
    this.outAcksSent++;
  }
  // 가방 결과 중계 — 요청자(reqAvatar)에게 item_result, give 성공이면 수신자(toAvatar)에게 item_recv. 은닉: itemId/op 만 전달.
  //   직접 모드(0015)와 버스 모드(svc.item.out ev)가 *같은 중계 함수*를 쓴다 — 클라 와이어 계약 불변.
  _relayItemResult(p) {
    if (p.type !== 'item_result') return;
    const rb = this.byAvatar.get(p.reqAvatar);
    if (rb) this.net.send(this.addr, rb.client, { type: 'item_result', ok: p.ok, op: p.op, itemId: p.itemId });
    if (p.ok && p.op === 'give') {
      const tb = this.byAvatar.get(p.toAvatar);
      if (tb) this.net.send(this.addr, tb.client, { type: 'item_recv', itemId: p.itemId });
    }
  }
  // id-reconciliation 응답 중계(이 step) — 가방이 돌려준 item_recon_map 을 요청 클라에게. 은닉: 매핑만(서비스 내부 비전달).
  //   직접 모드·버스 모드 모두 같은 함수(버스 봉투 해체 후 여기로). mintRecon OFF 면 가방이 메시지 0 → 호출 0(reg 0 불변).
  _relayItemRecon(p) {
    if (p.type !== 'item_recon_map') return;
    const rb = this.byAvatar.get(p.reqAvatar);
    if (rb) this.net.send(this.addr, rb.client, { type: 'item_recon_map', mappings: p.mappings });
  }
  // 채팅 팬아웃 중계 — chat 이 결정한 수신자(toAvatar)에게 chat_msg. 은닉: channel/from/seq 만(chat 내부·구독 테이블 비전달).
  _relayChatOut(p) {
    if (p.type !== 'chat_out') return;
    const tb = this.byAvatar.get(p.toAvatar);
    if (tb) this.net.send(this.addr, tb.client, { type: 'chat_msg', channel: p.channel, from: p.from, seq: p.seq });
  }
  // 랭킹 갱신 중계(이 step) — ranking 이 발행한 svc.rank.out 의 대상 아바타 클라에 rank_update. 은닉: count 만(ranking 내부 비전달).
  _relayRank(p) {
    if (p.type !== 'rank_update') return;
    const tb = this.byAvatar.get(p.avatar);
    if (tb) this.net.send(this.addr, tb.client, { type: 'rank_update', count: p.count });
  }
}
// step-0270 분할 — 메시지 라우팅 핸들러(onMsg)를 프로토타입에 되섞음(정의 위치만 이동·this 바인딩 동일·reg 0). onMsg 가 _svcSend/_itemReq/_relayX 호출.
Object.assign(Gateway.prototype, GatewayMsg);

const __part = { Gateway };
if (typeof module !== 'undefined' && module.exports) module.exports = __part;
if (typeof globalThis !== 'undefined') (globalThis.__HktNetParts = globalThis.__HktNetParts || {}).gateway = __part;
