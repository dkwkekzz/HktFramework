'use strict';
// step-0079 — 전달 포기 통지(deliverNotify·deliveryFailed): 0078 의 포기(undeliverable)는 라우터 *내부 계측*일 뿐 — 귓속말을 보낸 클라는 전달이 영영 실패했음을 모른다(0078 §9). 이 step 은 포기를 *발신자에게 가시화*한다 — 상한 도달로 포기할 때, 원 발신자(inflight.from)에게 {type:'deliveryFailed', to, body} 를 회신한다(failedNotified++). 클라는 이 신호로 "상대에게 끝내 닿지 못했다"를 안다(반송 bounce 가 *도달 불가 즉시* 알리듯, 포기는 *유계 재시도 소진 후* 알린다). deliverNotify OFF 면 통지 0 = 0078 비트 동일(포기는 조용).
// step-0078 — 전달 재시도 상한(deliverMaxRetries): 0077 의 재시도는 *무상한*이라 수신측이 영영 죽으면 inflight·재발신이 무한 누적된다(0077 §9). 이 step 은 재시도를 유계화한다 — inflight 엔트리마다 tries 를 세고, deliverMaxRetries 회 재발신했는데도 whisperAck 가 없으면 *영구 전달불가*로 단정: inflight 에서 빼 포기(undeliverable++). 0059 recoverMaxRetries(치유 포기)의 *전달* 판 — at-least-once 의 무한 재시도를 유계 재시도+명시적 포기로. deliverMaxRetries 0 이면 무상한(0077 동일).
// step-0077 — 전달 손실 감지+재시도(whisperDeliverRetry): 0076 은 미확인 전달(inflight)을 *분리*만 했지, 전달/영수증이 손실되면 inflight 에 영영 남았다(at-most-once 확인·0076 §9). 이 step 은 그 고리를 닫는다 — 라우터에 onTick 을 더해 deliverTimeout 경과해도 whisperAck 못 받은 inflight 전달을 *재발신*(같은 seq·재전송)한다 → 전달/ack 손실에도 delivered 로 수렴(at-least-once). 영수증(0076)이 "확인됨"을 주므로 *미확인*만 재시도(0058 recoverRetry·0008 ack/NAK 재전송의 전달 판). whisperDeliverRetry OFF 면 onTick 무발화·재발신 0 = 0076 비트 동일(inflight 방치).
// step-0076 — 전달 영수증(whisperReceipt): 0071~0075 의 라우터는 라우팅 *결정*(프레즌스 질의→up 전달/down 반송)까지만 견고했다 — whisperDeliver 를 보내는 순간 routed++ 로 셌지, *대상이 실제로 받았는지*는 확인하지 않았다(best-effort·0075 §9). 이 step 은 전달의 *수신 확인 고리*를 더한다: 라우터가 deliverable 일 때 whisperDeliver 에 {seq, ackTo:this.addr} 를 실어 보내고 inflight[seq] 에 보류, 수신측 Mailbox 가 whisperAck{seq} 를 회신하면 inflight 에서 지우고 delivered++(전달 확인). 0057 recoverAck(치유 확인 고리)의 *전달* 판 — routed(보냄) ⊇ delivered(확인됨), inflight=routed-delivered. whisperReceipt OFF 면 ackTo 미부착·inflight 미보류·Mailbox 부재 = 0075 비트 동일(routed 만·delivered 0).
// step-0075 — 파티 멤버십 SSOT 소비(membershipAddr): 0073 의 파티 라우터는 멤버 목록을 요청에 *인라인*으로 받았다(멤버십과 라우팅이 한 요청에 섞임). 이 step 은 멤버십을 전용 박스(PartyService)로 분리하고, 라우터는 파티 전송 시 멤버 목록을 *질의*로 얻는다: {type:'partyTo', partyId} → 멤버십 SSOT(membershipAddr)에 partyQuery → partyMembers 응답이 오면 멤버마다 _queryFor(프레즌스 질의)→라우팅. 멤버십 SSOT(PartyService)→프레즌스 SSOT(0069)→라우팅 의 2단 조회. membershipAddr 없으면 partyTo 미해소(멤버십 SSOT 부재의 대조). 인라인 party(0073)는 그대로 동작.
// step-0074 — 재타깃 윈도 질의 재시도(whisperRetry): 0072 의 재타깃은 primary 사망 *후* 도착한 질의만 구한다 — 승격 공지가 라우터에 닿기 *전*의 윈도(사망~공지 전파)에 보낸 질의는 죽은 primary 로 가 영영 손실된다(0072 §9). 이 step 은 그 고리를 닫는다: 라우터가 재타깃(svc.presence.active 수신)할 때, 아직 응답 못 받은 *보류 질의*를 새 active 주소로 재발신한다 → 윈도에 손실된 질의도 승격된 박스로 다시 가 답을 받는다(0058 recoverRetry 의 질의 판). 재시도 트리거는 *공지*(재타깃)라 onTick 0·순수 반응 유지. whisperRetry OFF 면 재발신 0 = 0073 비트 동일(재타깃은 주소만 갱신·보류 질의 방치).
// step-0073 — 파티 라우터(다중 대상 팬아웃): 0071/0072 의 귓속말은 1:1(대상 1명)이었다. 파티 채팅·파티 초대는 1:N — 한 요청이 여러 멤버에게 가야 한다. 이 step 은 같은 라우터에 {type:'party', members:[...]} 를 더한다: 라우터가 *각 멤버*의 상태를 프레즌스 SSOT 에 질의(N개)하고, 응답이 오는 대로 멤버별 라우팅(up 멤버에 전달·down/permanent 멤버는 반송) — 한 요청에서 *부분 전달*(일부 up 전달·일부 down 반송)이 자연히 일어난다. SPINE 계층3 채팅/소셜의 1:N 팬아웃 + 계층5 프레즌스 질의 소비. 파티 미주입이면 미발화 = 0072 비트 동일(새 메시지 타입 핸들러는 휴면).
// step-0072 — 귓속말 라우터 failover 연속성(whisperFailover): 0071 의 라우터는 queryAddr 를 *고정*(primary 프레즌스 박스)으로 가리켜, primary 사망 후 귓속말 질의가 죽은 박스로 가 끊긴다(0071 §9 — presmon 의 0069 §9 한계가 라우터로 옮겨온 것). 0070 이 presmon 에 준 해법(svc.presence.active 공지→queryAddr 재타깃)을 *라우터*에 적용한다: 승격된 박스가 공지한 새 active 주소를 라우터가 구독해 queryAddr 를 재타깃 → primary 사망 후 귓속말도 승격된 박스로 질의돼 라우팅이 연속된다(읽기 경로 failover 디스커버리의 라우팅 판). 공지 미구독(whisperFailover OFF)이면 재타깃 0 = 0071 비트 동일.
// step-0071 — 귓속말 라우터(whisperRouter): 0069/0070 이 프레즌스 SSOT 의 *질의 인터페이스*(presenceQuery→presenceReply·pull)를 세웠지만, 그 질의자는 presmon(관찰 모델)이었다 — 질의 인터페이스의 *실제 소비자*가 아니라 "질의가 도는가"를 보이는 대역. 이 step 은 그 인터페이스의 첫 *진짜* 소비자를 더한다: 클라가 다른 플레이어에게 귓속말을 보내면, 라우터가 "그가 어디에/어떤 상태인가"를 프레즌스 SSOT 에 질의(pull)하고 그 답으로 *라우팅 결정*을 내린다(up=전달·down/permanent=반송). SPINE 계층5: 프레즌스 SSOT 가 곧 귓속말·파티·핸드오프 라우팅의 단일 조회처라는 큰 그림의 첫 라우팅 소비자. whisperRouter OFF 면 박스 0 = 0070 비트 동일. (분할 preamble: 박스 1개=파일 1개·진입점 net-core.js)
// dual-mode: Node require / 브라우저는 common.js 를 <script> 선행 로드(전역 __HktNetCommon).
const __c = (typeof module !== 'undefined' && module.exports && typeof require !== 'undefined')
  ? require('./common.js') : globalThis.__HktNetCommon;
const { Net, LoginServer, SessionRegistry, mulberry32, fnv1a, DEFAULTS } = __c;

// ── [게임 서비스] WhisperRouter — 귓속말 라우팅의 첫 박스(SPINE 계층3 채팅/소셜 + 계층5 프레즌스 질의 소비). 존 tick 밖 *순수 반응형*(onTick 없음·시뮬 무관). ──
//   클라→라우터: {type:'whisper', to, body} 요청 → 라우터가 프레즌스 SSOT(queryAddr)에 *대상 상태*를 질의(presenceQuery·pull) → 응답(presenceReply)이 오면 보류 귓속말을 라우팅.
//   라우팅 규칙(프레즌스가 결정): state 'up' → 대상에게 전달(whisperDeliver·routed) / 'down'·'permanent' → 반송(bounced·도달 불가). "누가 어디에"의 단일 조회처가 라우팅을 구동한다(SPINE §2 코디네이션 분리 근거의 첫 라우팅 소비자).
//   분리 이유(SPINE §2 판정): 귓속말 팬아웃·라우팅은 존 tick 박자와 무관 — 비동기 서비스. 프레즌스 SSOT 는 *질의*로만 소비(권위 0·은닉: 라우터는 SSOT 내부를 모르고 질의/응답 계약만 안다).
class WhisperRouter {
  constructor(opts = {}) {
    this.receipt = opts.receipt || false;   // 전달 영수증(step-0076·whisperReceipt) — whisperDeliver 에 seq/ackTo 부착·Mailbox 의 whisperAck 로 delivered 확인. OFF 면 best-effort(routed 만·0075 동일).
    this.deliverRetry = opts.deliverRetry || false;   // 전달 손실 재시도(step-0077·whisperDeliverRetry) — onTick 이 deliverTimeout 경과한 미확인 inflight 를 재발신. OFF 면 재발신 0(0076 동일).
    this.deliverTimeout = opts.deliverTimeout || 4;   // whisperDeliver 후 whisperAck 를 기다리는 tick(이후 미확인이면 재발신). 결정론 상수.
    this.deliverMaxRetries = opts.deliverMaxRetries || 0;   // 전달 재시도 상한(step-0078·deliverMaxRetries) — 이 횟수 재발신해도 ack 없으면 포기(undeliverable). 0 이면 무상한(0077 동일).
    this.deliverNotify = opts.deliverNotify || false;   // 전달 포기 통지(step-0079·deliverNotify) — 포기 시 원 발신자에 deliveryFailed 회신. OFF 면 통지 0(0078 동일).
    this.deliverRetries = 0;       // 재발신한 whisperDeliver 수(step-0077·계측). 손실 복구 횟수.
    this.undeliverable = 0;        // 상한 도달로 포기한 전달 수(step-0078·계측). 영구 전달불가.
    this.failedNotified = 0;       // 발신자에 회신한 deliveryFailed 수(step-0079·계측).
    this.deliverySeq = 0;          // 전달 시퀀스(step-0076) — whisperDeliver 마다 증가하는 영수증 상관키.
    this.inflight = new Map();     // seq -> {to, from, body, at} — 전달했으나 아직 whisperAck 못 받은 보류 전달(routed-delivered·at=마지막 발신 tick).
    this.delivered = 0;            // whisperAck 로 *확인된* 전달 수(step-0076). routed ⊇ delivered, 차이 = inflight.size.
    this.acksRecv = 0;             // 받은 whisperAck 수(계측·중복 ack 무시 후에도 카운트).
    this.retry = opts.retry || false;   // 재타깃 윈도 질의 재시도(step-0074·whisperRetry) — 재타깃 시 보류 질의 재발신. OFF 면 재발신 0(0073 동일).
    this.membershipAddr = opts.membershipAddr || null;   // 파티 멤버십 SSOT 박스 주소(step-0075·PartyService). null 이면 partyTo 미해소(0074 동일).
    this.queryAddr = opts.queryAddr || null;   // 프레즌스 SSOT 박스 주소(명시 의존·request/reply 경로·0069 인터페이스). null 이면 질의 못 함→전부 보류.
    this.pending = new Map();     // consumer -> [{from, body}] — presenceReply 대기 중인 귓속말(질의↔응답 상관: consumer 키로 묶음).
    this.queriesSent = 0;         // 보낸 presenceQuery 수(계측). repliesRecv = 받은 응답 수(1:1 = 무손실 읽기).
    this.repliesRecv = 0;
    this.routed = 0;              // 전달한 귓속말 수(대상 up·whisperDeliver 발신). bounced = 반송 수(대상 down/permanent).
    this.bounced = 0;
    this.decisions = new Map();   // consumer -> 'routed'|'bounced' — 대상별 최신 라우팅 판정(대시보드·검증 대조).
    this.retargets = 0;           // active 재타깃 수(step-0072·svc.presence.active 공지 수신 — failover 시 1). 미구독이면 0(0071 동일).
    this.parties = 0;             // 받은 파티 요청 수(step-0073·1:N 팬아웃 계측). 멤버 수만큼 질의로 전개.
    this.retries = 0;             // 재타깃 시 재발신한 보류 질의 수(step-0074·whisperRetry 계측). 윈도 손실 복구.
    this.partyPending = new Map(); // partyId -> {from, body} — partyMembers 응답 대기 중인 파티 전송 요청(step-0075·멤버십 조회 보류).
    this.membershipQueries = 0;   // 보낸 partyQuery 수(step-0075·멤버십 SSOT 조회 계측). membersResolved = 응답으로 받은 멤버 누적.
    this.membersResolved = 0;
  }
  pendingCount() { let n = 0; for (const arr of this.pending.values()) n += arr.length; return n; }
  // 한 대상에 귓속말 1건을 적재+질의(귓속말·파티 멤버 공통 경로). 응답 올 때까지 pending[to] 보류·queryAddr 로 presenceQuery.
  _queryFor(to, from, body) {
    const arr = this.pending.get(to) || []; arr.push({ from, body }); this.pending.set(to, arr);
    if (this.queryAddr) { this.net.send(this.addr, this.queryAddr, { type: 'presenceQuery', consumer: to }); this.queriesSent++; }
  }
  onMsg(m) {
    const p = m.payload;
    // active 재타깃(step-0072·whisperFailover) — 승격된 프레즌스 박스가 svc.presence.active 로 공지한 새 active 주소로 queryAddr 갱신. 이후 귓속말 질의가 승격된 박스로 간다(라우팅 읽기 경로 failover·0070 presmon 재타깃의 라우터 판). 미구독이면 미발화(0071 비트 동일).
    if (p.type === 'ev' && p.topic === 'svc.presence.active' && p.ev) {
      this.queryAddr = p.ev.addr; this.retargets++;
      // 재타깃 윈도 질의 재시도(step-0074·whisperRetry) — 재타깃 전 보낸 질의가 죽은 primary 로 가 손실됐을 수 있다(0072 §9). 아직 응답 못 받은 보류 질의를 새 active 주소로 재발신 → 윈도 손실분도 승격 박스로 다시 감. 공지(재타깃)가 재시도를 구동(onTick 0·순수 반응). retry OFF 면 재발신 0(0073 비트 동일·보류 방치).
      if (this.retry && this.queryAddr) for (const to of this.pending.keys()) { this.net.send(this.addr, this.queryAddr, { type: 'presenceQuery', consumer: to }); this.queriesSent++; this.retries++; }
      return;
    }
    // 전달 영수증 수신(step-0076·whisperAck) — Mailbox 가 회신한 영수증으로 inflight[seq] 보류 해제·delivered++(전달 확인). 미보류 seq(중복/허위)면 delivered 무변경(idempotent). receipt OFF 면 ackTo 미부착이라 이 메시지 자체가 안 옴.
    if (p.type === 'whisperAck') { this.acksRecv++; if (this.inflight.has(p.seq)) { this.inflight.delete(p.seq); this.delivered++; } return; }
    // 클라→라우터 귓속말 요청(1:1) — 대상 상태를 모르므로 프레즌스 SSOT 에 질의(pull). 응답 올 때까지 보류(consumer 키). queryAddr 없으면 질의 0(전부 영구 보류 = 라우팅 불가의 대조).
    if (p.type === 'whisper') { this._queryFor(p.to, m.from, p.body); return; }
    // 파티 요청(step-0073·1:N 팬아웃·멤버 인라인) — 멤버마다 _queryFor(질의 N개 전개). 응답이 오는 대로 멤버별 라우팅(아래 presenceReply 핸들러 공통) — 한 요청에서 부분 전달이 자연 발생. 파티 미주입이면 이 분기 휴면(0072 비트 동일).
    if (p.type === 'party') { this.parties++; for (const to of (p.members || [])) this._queryFor(to, m.from, p.body); return; }
    // 파티 전송(step-0075·멤버십 SSOT 조회) — 멤버 목록을 *인라인으로 받지 않고* PartyService(membershipAddr)에 질의(partyQuery). 응답(partyMembers) 올 때까지 보류(partyId 키). membershipAddr 없으면 미해소(멤버십 SSOT 부재의 대조).
    if (p.type === 'partyTo') { this.partyPending.set(p.partyId, { from: m.from, body: p.body }); if (this.membershipAddr) { this.net.send(this.addr, this.membershipAddr, { type: 'partyQuery', partyId: p.partyId }); this.membershipQueries++; } return; }
    // 멤버십 응답(step-0075·partyMembers) — PartyService 가 회신한 멤버 목록으로 보류 파티 전송을 *전개*: 멤버마다 _queryFor(프레즌스 질의→라우팅·0073 와 동일 경로). 멤버십 SSOT→프레즌스 SSOT→라우팅 2단 조회 완성.
    if (p.type === 'partyMembers') { this.parties++; this.membersResolved += (p.members || []).length; const req = this.partyPending.get(p.partyId) || { from: m.from }; this.partyPending.delete(p.partyId); for (const to of (p.members || [])) this._queryFor(to, req.from, req.body); return; }
    // 프레즌스 SSOT 응답(0069 presenceReply) — 대상 상태로 보류 귓속말을 라우팅. up=전달(whisperDeliver→대상 주소·best-effort), 아니면 반송. 라우팅 결정이 *프레즌스 질의로 구동*된다(이 step 의 핵심).
    if (p.type === 'presenceReply') {
      this.repliesRecv++;
      const arr = this.pending.get(p.consumer) || []; this.pending.delete(p.consumer);
      const deliverable = p.state === 'up';
      for (const w of arr) {
        if (deliverable) {
          const msg = { type: 'whisperDeliver', from: w.from, body: w.body };
          // 전달 영수증(step-0076·whisperReceipt) — seq/ackTo 부착·inflight 보류. Mailbox 가 whisperAck 회신하면 delivered++(확인). OFF 면 best-effort(영수증 없이 routed 만·0075 비트 동일).
          if (this.receipt) { const seq = ++this.deliverySeq; msg.seq = seq; msg.ackTo = this.addr; this.inflight.set(seq, { to: p.consumer, from: w.from, body: w.body, at: this.net ? this.net.tick : 0, tries: 0 }); }
          this.net.send(this.addr, p.consumer, msg); this.routed++;
        }
        else this.bounced++;
      }
      this.decisions.set(p.consumer, deliverable ? 'routed' : 'bounced');
      return;
    }
  }
  // 전달 손실 재시도(step-0077·whisperDeliverRetry) — deliverTimeout 경과해도 whisperAck 못 받은 inflight 전달을 같은 seq 로 재발신(at-least-once). whisperAck 오면 onMsg 가 inflight 에서 지운다(루프 종료). OFF 면 미실행 = 0076 비트 동일(inflight 방치). 존 tick 무관 — 라우터 제어 평면의 벽시계 timeout.
  onTick(tick) {
    if (!this.deliverRetry || !this.inflight.size) return;
    for (const [seq, e] of this.inflight) {
      if (tick - e.at >= this.deliverTimeout) {
        // 재시도 상한(step-0078·deliverMaxRetries) — 이미 max 회 재발신했는데도 ack 가 없으면 영구 전달불가로 단정: inflight 에서 빼 포기(undeliverable++). 0 이면 무상한(0077 동일).
        if (this.deliverMaxRetries > 0 && e.tries >= this.deliverMaxRetries) {
          this.inflight.delete(seq); this.undeliverable++;
          // 전달 포기 통지(step-0079·deliverNotify) — 원 발신자(e.from)에게 영구 전달실패를 회신해 가시화. OFF 면 통지 0(0078 동일·포기는 조용).
          if (this.deliverNotify) { this.net.send(this.addr, e.from, { type: 'deliveryFailed', to: e.to, body: e.body }); this.failedNotified++; }
          continue;
        }
        this.net.send(this.addr, e.to, { type: 'whisperDeliver', from: e.from, body: e.body, seq, ackTo: this.addr });
        e.at = tick; e.tries++; this.deliverRetries++;
      }
    }
  }
  decisionOf(consumer) { return this.decisions.get(consumer) || null; }
}

const __part = { WhisperRouter };
if (typeof module !== 'undefined' && module.exports) module.exports = __part;
if (typeof globalThis !== 'undefined') (globalThis.__HktNetParts = globalThis.__HktNetParts || {}).svc_whisper = __part;
