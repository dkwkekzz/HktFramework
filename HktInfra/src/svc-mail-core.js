'use strict';
// step-0178 — 아이템 우편 saga 재admission 횟수 상한(mailReadmitMax): gid 가 readmitMax 회 재admission 후 또 포기되면 영구 실패(permFailed)로 abandonedGive 제외→재admission 차단(무한 루프 방지·거래소 0137 의 우편 판). pending 잔존(sagaConsistent 불변). readmitMax 0 면 무제한 = 0177 비트 동일.
// step-0177 — 아이템 우편 saga 재admission 발행(mailReadmitPublish): _readmit 재개 시 svc.mail.saga_readmitted 1회 발행(0174 포기 발행의 짝·audit 관측·readmitPublished==readmitted·거래소 0135 의 우편 판). OFF·bus 부재면 발행 0 = 0176 비트 동일.
// step-0176 — 아이템 우편 saga 포기 give 재admission(mailReadmit): 포기(abandonedGive·0173/0174)된 give 를 pendingGive 로 되돌려 retry 재개(retryCount 리셋·거래소 0134 의 우편 판). op 부재면 0175 비트 동일.
// ── MailService 코어 — 오프라인 우편 배송 박스(SPINE §2 게임 서비스). 거래소 arc(0107~0140)의 우편 판. ──
//   상세 step 역사(0142~0174)는 각 step-NNNN.md(역사의 SSOT) + reviews/(인과 감사). 여기엔 *구조 + 최근 delta*만 둔다(0175 정리 — 누적 step-주석 헤더 17KB 압축·기능 0·reg 0).
//   arc 골격: 메시지(0142 분리·0143 수령·0144~0149 발행·0150 정합)·MailFeed 미읽음 배지(0151~0156)·아이템 첨부(0157~0160)·가방 연동 escrow custody 3레그+2-서비스 보존(0161~0164)·saga(0166 회신/0167 추적/0168 재전송+dedup/0169 정합/0170 transfers/0172 autoRetry/0173 재시도상한/0174 포기발행). 정리 분할: 0165(core/txn/entry)·0171(persist 추출)·0175(헤더 압축).
//   불변: 존 tick 밖 별 박스(신성한 tick)·우편함 권위 단일 소유(boxes: recipient→Map(mailId→mail))·발행은 파생 관찰 스트림(비-침습)·복제=저널 replay 재현. OFF 플래그는 직전 step 비트 동일(reg 0).
//   부품: 트랜잭션 핸들러(onMsg)=svc-mail-txn.js·영속/failover(_snapState/_restore/_journal/crash/reconstruct)=svc-mail-persist.js·진입점 svc-mail.js 가 core→txn→persist 순 로드(Object.assign 프로토타입 증강).
// dual-mode: Node require / 브라우저는 common.js 를 <script> 선행 로드(전역 __HktNetCommon).
const __c = (typeof module !== 'undefined' && module.exports && typeof require !== 'undefined')
  ? require('./common.js') : globalThis.__HktNetCommon;
const { fnv1a } = __c;

// ── [게임 서비스] MailService — 오프라인 우편 배송 박스. 존 tick 밖·발신 0(0142). 우편함 권위 단일 소유. ──
//   boxes: recipient -> Map(mailId -> {id, from, to, body, sentAt}). mailSend 입금 시 우편 1통 적재(같은 id 재전송 멱등).
//   회계(0150 capstone 대비): sent = 총 입금 통수. 0142 엔 held(보유)만 = sent(수령/만료 0).
class MailService {
  constructor(opts = {}) {
    this.bus = opts.bus || null;   // 발행용(svc.mail.* 발행 — 0144~).
    this.sentPublish = opts.sentPublish || false;   // 입금 발행(step-0144·mailSentPublish) — mailSend 시 svc.mail.sent 발행. OFF·bus 부재면 발행 0(0143 비트 동일).
    this.sentPublished = 0;        // 발행한 svc.mail.sent 수(step-0144·계측·sent 와 1:1).
    this.readPublish = opts.readPublish || false;   // 읽음 발행(step-0147·mailReadPublish) — mailFetch 수령 시 통마다 svc.mail.read 발행. OFF·bus 부재면 발행 0(0146 비트 동일).
    this.readPublished = 0;        // 발행한 svc.mail.read 수(step-0147·계측·fetched 와 1:1).
    this.expirePublish = opts.expirePublish || false;   // 만료 발행(step-0149·mailExpirePublish) — mailSweep 만료 시 통마다 svc.mail.expired 발행. OFF·bus 부재면 발행 0(0148 비트 동일).
    this.expirePublished = 0;      // 발행한 svc.mail.expired 수(step-0149·계측·expired 와 1:1).
    this.boxes = new Map();        // recipient -> Map(mailId -> mail) — 우편함 권위(단일 소유·보유 held).
    this.sent = 0;                 // 총 입금 통수(회계 — 0150 sent==held+fetched+expired 의 좌변).
    this.fetched = 0;              // 총 수령 통수(step-0143 — 수신자가 가져간 합).
    this.expired = 0;              // 총 만료 통수(step-0148 — 만료 회수 합; 0143 엔 0).
    this.item = opts.item || false;   // 아이템 첨부 우편(step-0157·mailItem) — mailSend 의 item 필드를 우편에 싣는다. OFF 면 item=null·itemSent 0(0156 비트 동일).
    this.itemSent = 0;             // 아이템 실은 입금 통수(step-0157 — 0160 itemSent==itemHeld+itemFetched+itemExpired 의 좌변).
    this.itemFetched = 0;          // 아이템 실은 수령 통수(step-0158).
    this.itemExpired = 0;          // 아이템 실은 만료 통수(step-0159).
    this.inv = opts.inv || null;        // 가방(inventory) 주소(step-0161·mailInv) — 아이템 우편 escrow 실체화 give 의 대상. 부재면 추상 escrow(0160 동일).
    this.invMode = opts.invMode || false;   // 우편↔가방 원자 거래(step-0161·mailInv) — ON 이면 send/fetch/expire 가 가방 give 로 아이템 custody 이동. OFF 면 추상 escrow(0160 비트 동일).
    this.gives = 0;                // 가방에 보낸 give 요청 통수(step-0161 — 0164 2-서비스 보존·가방 escrowXfers 와 교차 정합).
    this.saga = opts.saga || false;     // saga 회신 비동기 수신(step-0166·mailSaga) — ON 이면 give 에 replyTo+cause 를 실어 가방이 item_result 를 echo. OFF 면 fire-and-forget(0165 비트 동일).
    this.ackedGives = 0;           // 가방서 회신(item_result) 받은 give 통수(step-0166 — 무손실서 gives==ackedGives·닫힌 고리 liveness).
    this.giveOks = 0;              // 성공 회신 통수(step-0166 — 0170 giveOks==가방 escrowXfers 교차 정합 capstone 의 좌변).
    this.giveFails = 0;            // 실패 회신 통수(step-0166 — 발신자 미소유 등; 무손실·정상 소유서 0).
    this.gid = 0;                  // 단조 give id(step-0167) — saga 회신 매칭 키. _custody 가 발급.
    this.pending = new Set();      // 미해결 give 의 gid 집합(step-0167) — _custody add·item_result 회신이 delete. 정상 0 drain·회신 손실 시 잔존(ack 미수신 격차 가시).
    this.pendingGive = new Map();  // gid -> {itemId,from,to,cause}(step-0167) — 재전송 소스(0168 대비·회신 손실 시 같은 gid 로 재발신).
    this.pendingPeak = 0;          // 미해결 최대치(step-0167·관측).
    this.ackDrop = opts.ackDrop ? new Set(opts.ackDrop) : null;   // 테스트 seam(step-0167) — 수신 시 *1회* 드롭할 gid 집합(transient 회신 손실 모의·step-0168 부터 drop-once → 재전송이 통과). 미제공이면 무손실(production 무영향·reg 0).
    this.retries = 0;              // saga 재전송 통수(step-0168·mailRetry + step-0172·autoRetry — 재발신은 gives 무증가·이 별도 계측).
    this.maxRetries = opts.maxRetries || 0;   // saga 재시도 상한(step-0173·mailMaxRetries·거래소 0131 의 우편 판) — _resendPending 재전송을 gid 당 N회로 제한. 도달 시 그 give 포기(pendingGive 제거·재전송 중단)·pending(Set)엔 잔존(미해결·sagaConsistent 불변). 0 이면 무제한(0172 비트 동일).
    this.retryCount = new Map();   // gid -> 재전송 횟수(step-0173·maxRetries>0 일 때만 사용) — 상한 비교용. ack/포기 시 제거.
    this.giveAbandoned = 0;        // 상한 도달로 포기한 give 누적(step-0173·계측) — 영구 회신 손실의 신호. pending 에는 남는다(미해결·재전송만 중단).
    this.abandonPublish = opts.abandonPublish || false;   // 포기 발행(step-0174·mailAbandonPublish·거래소 0132 의 우편 판) — 상한 도달 포기 시 svc.mail.saga_abandoned 1회 발행(운영 가시화·audit 관측·giveAbandoned 와 1:1). OFF·bus 부재면 발행 0(0173 비트 동일).
    this.abandonPublished = 0;     // 발행한 svc.mail.saga_abandoned 수(step-0174·계측·giveAbandoned 와 1:1).
    this.abandonedGive = new Map();  // gid -> {itemId,from,to,cause}(step-0176·mailReadmit) — 포기된 give 의 재admission 소스(운영이 손실 해소 후 pendingGive 로 되돌림·거래소 0134 의 우편 판).
    this.readmitted = 0;           // 재admission 한 give 누적(step-0176·계측).
    this.readmitPublish = opts.readmitPublish || false;   // 재admission 발행(step-0177·mailReadmitPublish·거래소 0135 의 우편 판) — _readmit 으로 포기 give 재개 시 svc.mail.saga_readmitted 1회 발행(0174 포기 발행의 짝·운영 가시화·readmitPublished==readmitted). OFF·bus 부재면 발행 0(0176 비트 동일).
    this.readmitPublished = 0;     // 발행한 svc.mail.saga_readmitted 수(step-0177·계측·readmitted 와 1:1).
    this.readmitMax = opts.readmitMax || 0;   // 재admission 횟수 상한(step-0178·mailReadmitMax·거래소 0137 의 우편 판) — gid 가 readmitMax 회 재admission 된 뒤 또 포기되면 *영구 실패*(permFailed)로 abandonedGive 에 안 넣어 재admission 차단(무한 abandon↔readmit 루프 방지). pending 엔 잔존(sagaConsistent 불변). 0 이면 무제한(0177 비트 동일).
    this.readmitCount = new Map();  // gid -> 재admission 횟수(step-0178·readmitMax>0 일 때만 사용) — _readmit 누적·상한 비교용.
    this.permFailed = 0;           // 영구 실패한 give 누적(step-0178·계측) — readmitMax 도달 후 또 포기. 재admission 차단(abandonedGive 제외)·pending 잔존.
    this.ackDropAlways = opts.ackDropAlways ? new Set(opts.ackDropAlways) : null;   // 테스트 seam(step-0173) — 수신 시 *매번* 드롭할 gid 집합(지속 회신 손실 모의·drop-once ackDrop 0167 과 달리 안 지움 → 재전송이 영영 통과 못 함 → 상한 트리거). 미제공이면 무손실(production 무영향·reg 0).
    this.autoRetry = opts.autoRetry || false;   // 자동 주기 재전송(step-0172·mailAutoRetry) — ON 이면 mailSweep op 이 미해결 give 재전송도 트리거(주기적 타임아웃 재전송·거래소 0129 의 우편 판). OFF 면 sweep 은 TTL 회수만(0171 비트 동일). 명시 mailRetry op(0168) 없이도 같은 주기 신호(sweep)로 pending drain.
    this.escrowIds = new Set();    // escrow custody 중인 itemId 집합(step-0164·2-서비스 보존) — 발신 add·수령/만료 delete(invMode 일 때만). 가방의 'escrow' 소유 집합과 교차 정합. invMode OFF 면 빔(0163 비트 동일).
    this.read = new Map();         // recipient -> [수령한 mail…] — 읽음 보관(0147 읽음 확인 발행 대비·수령 내용 검증).
    this._seq = 0;                 // 결정론 mail id 시퀀스(id 미지정 시 'mail'+seq — 단일 박스 순서 = 결정적).
    this.ttl = opts.ttl || 0;      // 만료 TTL(step-0148·mailTtl) — now−sentAt≥ttl 미수령 우편 자동 회수. 0 면 만료 0(0147 동일).
    this.persist = opts.persist || false;   // 원장 영속(step-0145·mailPersist) — send/fetch op 를 durable 저널에 기록·crash 후 replay. OFF 면 저널 0(0144 동일·휘발).
    this.journal = [];             // durable op 저널 [{seq,kind,...}](step-0145) — projection(우편함·읽음·회계)과 분리(crash 시 projection 만 소실).
    this.jseq = 0;                 // 저널 시퀀스(append-only).
    this.snapInterval = opts.snapInterval || 0;   // 저널 스냅샷 압축(step-0146·mailSnapshot) — 저널 N항마다 projection 스냅샷+가지치기. 0 면 무압축(0145 동일).
    this.snapshot = null;          // {upToSeq, state}(step-0146) — 마지막 압축 스냅샷. reconstruct 의 출발점.
  }
  // 영속·failover 부품(_snapState/_restore/_journal/crash/reconstruct)은 svc-mail-persist.js 가 프로토타입 증강(step-0171 정리 분할·동작 불변).
  _box(rcpt) { if (!this.boxes.has(rcpt)) this.boxes.set(rcpt, new Map()); return this.boxes.get(rcpt); }
  // 아이템 custody 이동 헬퍼(step-0161) — 우편↔가방 2-서비스 쌍 거래의 한 레그. invMode·inv·itemId 있을 때만 가방에 give(fromAvatar→toAvatar). 가방이 권위·우편은 요청만(은닉). 미충족이면 no-op(추상 escrow·0160 동일·reg 0).
  //   거래소 _custody(0117)의 우편 판. send=발신자→escrow(leg1 0161)·fetch=escrow→수신자(leg2 0162)·expire=escrow→발신자(leg3 0163).
  _custody(itemId, from, to, cause) {
    if (!this.invMode || !this.inv || itemId == null || !this.net) return;
    const msg = { type: 'item_req', op: 'give', itemId, fromAvatar: from, toAvatar: to };
    // saga 피드백(step-0166·mailSaga) — ON 이면 replyTo(우편 주소)+cause(어느 레그·mailId) 를 실어 가방이 item_result 를 우편으로도 회신.
    //   OFF 면 msg 가 0165 와 정확히 같다(replyTo/cause 키 없음) → 가방의 echo(_sagaReply) 휴면 = 비트 동일(reg 0).
    if (this.saga) {
      const gid = this.gid++;           // 미해결 추적 id(step-0167) — 회신 매칭 키
      msg.replyTo = this.addr; msg.cause = cause; msg.gid = gid;
      this.pending.add(gid);
      this.pendingGive.set(gid, { itemId, from, to, cause });   // 재전송 소스(step-0168 대비)
      if (this.pending.size > this.pendingPeak) this.pendingPeak = this.pending.size;
    }
    this.net.send(this.addr, this.inv, msg);
    this.gives++;
    if (to === 'escrow') this.escrowIds.add(itemId);        // 발신 인출(leg1) — escrow 진입(step-0164·2-서비스 보존 추적)
    else if (from === 'escrow') this.escrowIds.delete(itemId);   // 수령 입금(leg2)·만료 반환(leg3) — escrow 이탈
  }
  // 미해결 give 재전송(step-0168·mailRetry·0172·autoRetry 공용)·재시도 상한(step-0173·maxRetries) — pendingGive 에 남은(회신 손실) give 를 *같은 gid* 로 재발신(재실행 아닌 *재회신* 유도·가방 sagaDedup 전제).
  //   재전송이라 gives/escrowIds 무증가(이미 추적 중)·retries++. maxRetries>0 이면 gid 당 N회 재전송 후 포기(pendingGive 제거→이후 sweep 비-순회·giveAbandoned++·pending(Set) 잔존·sagaConsistent 불변). 포기는 *재전송 중단*일 뿐 abort 아님(give 가 실제 성공했을 수 있어 낙관적 미해결 유지=안전). maxRetries 0·pendingGive 빔이면 0172 비트 동일.
  _resendPending() {
    if (!this.invMode || !this.inv || !this.net) return;
    for (const [gid, g] of [...this.pendingGive]) {
      if (this.maxRetries > 0) {
        const c = this.retryCount.get(gid) || 0;
        if (c >= this.maxRetries) {
          this.pendingGive.delete(gid); this.retryCount.delete(gid); this.giveAbandoned++;   // 상한 도달 — 포기(재전송 중단·pending 잔존)
          // 재admission 횟수 상한(step-0178·readmitMax) — readmitMax 회 재admission 된 give 가 또 포기되면 *영구 실패*: abandonedGive 에 안 넣어 재admission 차단(무한 abandon↔readmit 루프 방지). pending(Set)엔 잔존(미해결·sagaConsistent 불변). readmitMax 0 면 항상 abandonedGive(0177 비트 동일).
          if (this.readmitMax > 0 && (this.readmitCount.get(gid) || 0) >= this.readmitMax) { this.readmitCount.delete(gid); this.permFailed++; continue; }
          this.abandonedGive.set(gid, g);   // 재admission 소스(step-0176) — 포기 give 파라미터 간직(운영이 손실 해소 후 mailReadmit 으로 재개). pending(Set)엔 그대로 남아 미해결.
          // 포기 발행(step-0174·mailAbandonPublish) — 영구 미해결 give 를 svc.mail.saga_abandoned 로 1회 발행(운영 가시화·거래소 0132 의 우편 판). OFF·bus 부재면 no-op(0173 비트 동일).
          if (this.abandonPublish && this.bus && this.net) { this.net.send(this.addr, this.bus, { type: 'pub', topic: 'svc.mail.saga_abandoned', ev: { gid, itemId: g.itemId, cause: g.cause } }); this.abandonPublished++; }
          continue;
        }
        this.retryCount.set(gid, c + 1);
      }
      this.net.send(this.addr, this.inv, { type: 'item_req', op: 'give', itemId: g.itemId, fromAvatar: g.from, toAvatar: g.to, replyTo: this.addr, cause: g.cause, gid });
      this.retries++;
    }
  }
  // 포기 give 재admission(step-0176·mailReadmit·거래소 0134 의 우편 판) — 운영이 손실 해소 후 포기(abandonedGive)된 give 를 pendingGive 로 되돌려 retry 재개(retryCount 리셋·상한 재충전). 이후 sweep/mailRetry 가 재전송 → 손실 해소 후면 ack→drain. abandonedGive 비었으면 no-op = 0175 비트 동일.
  _readmit() {
    for (const [gid, g] of this.abandonedGive) {
      this.pendingGive.set(gid, g); this.retryCount.delete(gid); this.readmitted++;
      this.readmitCount.set(gid, (this.readmitCount.get(gid) || 0) + 1);   // 재admission 횟수 누적(step-0178·readmitMax 비교용·readmitMax 0 면 미사용·관찰 무영향)
      // 재admission 발행(step-0177·mailReadmitPublish) — 포기 give 재개를 svc.mail.saga_readmitted 로 1회 발행(0174 포기 발행의 짝·운영 가시화). OFF·bus 부재면 no-op(0176 비트 동일).
      if (this.readmitPublish && this.bus && this.net) { this.net.send(this.addr, this.bus, { type: 'pub', topic: 'svc.mail.saga_readmitted', ev: { gid, itemId: g.itemId, cause: g.cause } }); this.readmitPublished++; }
    }
    this.abandonedGive = new Map();
  }
  // crash/reconstruct(영속·failover·step-0145~)는 svc-mail-persist.js 가 프로토타입 증강(step-0171 정리 분할·동작 불변).
  held(rcpt) { const b = this.boxes.get(rcpt); return b ? b.size : 0; }   // 한 수신자 우편함 보유 통수
  totalHeld() { let n = 0; for (const b of this.boxes.values()) n += b.size; return n; }   // 전 우편함 보유 합
  itemHeld() { let n = 0; for (const b of this.boxes.values()) for (const mm of b.values()) if (mm.item != null) n++; return n; }   // 보유 중 아이템 실은 통수(step-0157)
  fetchedOf(rcpt) { const l = this.read.get(rcpt); return l ? l.length : 0; }   // 한 수신자 수령 통수(step-0143)
  boxOf(rcpt) { const b = this.boxes.get(rcpt); return b ? [...b.values()] : []; }   // 우편함 통째(읽기·결정론 순서)
  readOf(rcpt) { const l = this.read.get(rcpt); return l ? l.slice() : []; }   // 수령(읽음) 보관 통째(step-0143)
  // 회계 정합(step-0143 — sent==held+fetched; 0148 에 +expired). 우편 1통은 매 순간 정확히 한 상태(보유·수령·만료)에 있다(공백·중복 0).
  accountConsistent() { return this.sent === this.totalHeld() + this.fetched + this.expired; }
  // 우편 회계 정합 capstone(step-0150·단언용 읽기 accessor) — 0142~0149 arc 의 창발 불변: 우편 1통은 매 순간 정확히 한 상태(보유 held·수령 fetched·만료 expired)에 분할(공백·중복 0).
  //   sent == totalHeld + fetched + expired 가 *모든 체제*(수령만·만료만·혼합·crash 복구)서 성립. accountConsistent 와 동치이나 capstone 의 명시 이름(거래소 0140 sagaLiveConsistent 의 우편 판).
  mailConsistent() { return this.sent === this.totalHeld() + this.fetched + this.expired; }
  // 아이템 회계 정합 capstone(step-0160·단언용 읽기 accessor) — 0157~0159 의 창발 불변: 아이템 1개는 매 순간 정확히 한 상태(보유 itemHeld·수령 itemFetched·만료 itemExpired)에 분할(공백·중복 0).
  //   itemSent == itemHeld + itemFetched + itemExpired 가 *모든 체제*서 성립. 0150 mailConsistent(메시지 통수 판)의 아이템 판·아이템 우편 arc(0157~0160) 닫기.
  itemConsistent() { return this.itemSent === this.itemHeld() + this.itemFetched + this.itemExpired; }
  // 우편↔가방 2-서비스 보존 capstone(step-0164·단언용 읽기 accessor) — escrow custody 중인 itemId 집합·우편 내부 정합.
  //   escrowItemIds(): 우편이 escrow 에 묶었다고 믿는 itemId 정렬 집합(가방의 'escrow' 소유 집합과 교차 정합 — 두 서비스 일치). escrowConsistent(): 보유 아이템 우편 통수(itemHeld) == escrow 아이템 수(escrowIds.size) — 우편 1통=아이템 1개=escrow 1건. 거래소 0120 escrowItemIds(open==escrow) 의 우편 판.
  escrowItemIds() { return [...this.escrowIds].sort(); }
  escrowConsistent() { return this.itemHeld() === this.escrowIds.size; }
  pendingGives() { return this.pending.size; }   // 미해결(회신 미수신) give 통수(step-0167) — 정상 0·회신 손실 시 잔존. 0166 gives==ackedGives 의 격차 = 이 값.
  // saga 회계 정합 capstone(step-0169·단언용 읽기 accessor) — 0166~0168 saga 회계의 창발 불변. 두 항등식 AND:
  //   ① gives == ackedGives + pendingGives(보낸 give 는 정확히 acked 또는 pending·새는 give 0) ② ackedGives == giveOks + giveFails(회신은 ok/fail 분류·누락 0). 정상·손실·재전송 모든 체제서 성립. 거래소 0128 의 우편 판.
  sagaConsistent() { return this.gives === this.ackedGives + this.pending.size && this.ackedGives === this.giveOks + this.giveFails; }
  // 아이템 우편↔가방 전체 닫힘 capstone(step-0170·단언용 읽기 accessor) — 우편 박스 *내부* 네 회계층의 동시 닫힘:
  //   mailConsistent(메시지 통수 0150) AND itemConsistent(아이템 0160) AND escrowConsistent(escrow 집합 0164) AND sagaConsistent(saga 회계 0169). 거래소 0140 sagaLiveConsistent 의 우편 판. + verify 가 giveOks==가방 escrowXfers(두 서비스 합치).
  sagaLiveConsistent() { return this.mailConsistent() && this.itemConsistent() && this.escrowConsistent() && this.sagaConsistent(); }
  // digest — 우편 *전체 상태* 해시(결정론·failover 비트 동일 검증용). 0145: 우편함(보유)+읽음(수령)+회계 카운터 포함(crash→reconstruct 가 죽기 전과 동일한지 단언).
  digest() {
    const rows = [];
    for (const rcpt of [...this.boxes.keys()].sort())
      for (const id of [...this.boxes.get(rcpt).keys()].sort()) {
        const mm = this.boxes.get(rcpt).get(id);
        rows.push(`H/${rcpt}/${id}:${mm.from}>${mm.to}@${mm.sentAt}:${mm.body}${mm.item != null ? ':i' + mm.item : ''}`);   // step-0157: 아이템 첨부 시만 추가(미첨부=0156 비트 동일)
      }
    for (const rcpt of [...this.read.keys()].sort())
      for (const mm of this.read.get(rcpt))
        rows.push(`R/${rcpt}/${mm.id}:${mm.from}>${mm.to}@${mm.sentAt}:${mm.body}${mm.item != null ? ':i' + mm.item : ''}`);   // step-0158: 수령 아이템 첨부 시만 추가
    rows.push(`C:sent=${this.sent},fetched=${this.fetched},expired=${this.expired}`);
    return fnv1a(rows.join('|'));
  }
}

const __part = { MailService };
if (typeof module !== 'undefined' && module.exports) module.exports = __part;
if (typeof globalThis !== 'undefined') (globalThis.__HktNetParts = globalThis.__HktNetParts || {}).svc_mail_core = __part;
