'use strict';
// step-0166 — 아이템 우편 발신 실패 보상(mailCompensate): 0165 는 give 실패(ackedFail)를 *집계만* 했다 — 발신자가 아이템을 안 가졌는데도 우편이 낙관적으로 적재돼 *phantom 우편*(실물 없는 우편)이 남았다.
//   이 step: 발신 leg(cause=mailsend) give 가 실패 회신하면 그 우편을 롤백(box 에서 제거·sent--·itemSent--·compensated++). 거래소 0122 exchCompensate(list 인출 실패→매물 abort)의 우편 판. 받는 이가 실물 없는 우편을 받지 않는다(phantom 0).
//   mailCompensate OFF·give 성공이면 롤백 0 = 0165 비트 동일.
// step-0165 — 아이템 우편 give 결과 비동기 수신(mailSaga·replyTo+gid): 0161~0164 의 give 는 fire-and-forget — 가방 give 가 성공했는지 우편이 몰랐다(낙관적).
//   이 step: mailSaga ON 이면 _custody 가 give 에 replyTo(자기 주소)+단조 gid 를 실어 보내고 미해결 집합(pending)에 넣는다. 가방 item_result 회신이 그 gid 로 오면 pending 에서 빼고 acked(ok/fail) 집계(거래소 0121 exchSaga 의 우편 판). 정상(무손실)서 pending 0 으로 drain.
//   mailSaga OFF·replyTo 부재면 가방이 회신 안 함(_sagaReply no-op) = 0164 비트 동일.
// step-0164 — 아이템 우편 2-서비스 보존(mailCustodyItems): 0161~0163 세 leg(인출·입금·반환)가 우편 회계와 가방을 따로 움직인다 — 둘이 *합치*하는가?
//   이 step: mailCustodyItems()(보유 우편이 든 아이템 id 집합·단언용 읽기) == 가방의 'mailcustody' 소유 집합이어야 한다(거래소 0120 open escrowItemIds≡가방 escrow 의 우편 판). in-transit 아이템 = 보유 우편의 아이템과 정확히 일치(공백·중복 0). 미호출 = 0163 비트 동일(reg).
// step-0163 — 아이템 우편 만료 반환 leg3: 0161~0162 는 발신 인출·수령 입금만 — 미수령 만료 시 아이템이 우편 custody 에 영영 묶였다.
//   이 step: mailSweep 만료 시 그 우편의 아이템을 우편 custody→*발신자* 가방으로 반환 give(거래소 0119 cancel/expire 반환 leg 의 우편 판). 받는 이가 안 가져가면 보낸 이에게 돌아온다(아이템 보존). invMode OFF·item 부재면 give 0 = 0162 비트 동일.
// step-0162 — 아이템 우편 수령 입금 leg2: 0161 은 발신 시 아이템을 우편 custody 로 인출만 했다 — 수령자가 받아도 가방에 안 들어왔다.
//   이 step: mailFetch 가 수령 통의 아이템을 우편 custody→수령자 가방으로 give(거래소 0118 buy 입금 leg 의 우편 판). 인출(0161)의 짝 — 발신자서 빠진 실물이 수령자 가방에 들어온다. invMode OFF·item 부재면 give 0 = 0161 비트 동일.
// step-0161 — 아이템 우편 발신 인출 leg1(mailInv·invMode): 0157~0160 은 아이템을 *우편 박스 안 회계*로만 추적했다 — 발신자 가방서 실물이 안 빠졌다(리뷰 #40).
//   이 step: invMode ON 이면 mailSend 가 아이템을 발신자 가방→우편 custody('mailcustody')로 give(거래소 0117 list 인출 leg 의 우편 판). 가방이 권위·우편은 요청만(은닉). 수령 입금(0162)·만료 반환(0163)·2-서비스 보존(0164) 후속.
//   mailInv OFF·item 부재·inv 부재면 give 0 = 0160 비트 동일(우편 박스 내 회계만·가방 무변경).
// step-0160 — 아이템 우편 회계 정합 capstone(itemConsistent·itemSent==itemHeld+itemFetched+itemExpired): 0157~0159 가 아이템의 입금·수령·만료를 쌓았다. 그 회계가 *대수적으로 닫혀* 있는가?
//   itemConsistent: 아이템 1개는 매 순간 정확히 한 상태 — 보유(itemHeld)·수령(itemFetched)·만료(itemExpired) 으로 분할(공백·중복 0). itemSent == 셋의 합이 *모든 체제*(수령만·만료만·혼합·crash 복구)서 성립.
//   0150 mailConsistent(메시지 통수 판)의 *아이템 판*·아이템 우편 arc(0157~0160) 닫기. 미호출 read accessor = 0159 비트 동일(reg).
// step-0159 — 아이템 우편 만료 회수(itemExpired): 0157~0158 은 아이템의 입금·수령만 회계했다 — 미수령 아이템 우편이 TTL 만료되면 아이템 회계가 어디로 가는지 미집계였다.
//   이 step: mailSweep 만료 시 아이템 실은 통수만큼 itemExpired++(만료 우편의 아이템 회수). 회계 itemHeld→itemExpired 전이. 만료된 아이템은 발신자 반환이 자연스러우나(가방 연동) 본 step 은 *우편 박스 내 회수 회계*까지(반환 give 는 백로그). mailItem OFF·아이템 미첨부면 itemExpired 0 = 0158 비트 동일.
// step-0158 — 아이템 우편 수령(itemFetched): 0157 은 아이템을 *보유(held)* 까지만 회계했다 — 수신자가 수령하면 아이템이 어디로 가는지 미집계였다.
//   이 step: mailFetch 가 보유→수령 이동 시 아이템 실은 통수만큼 itemFetched++(아이템도 메시지와 함께 read 로 이동·읽음 보관). 회계 itemHeld→itemFetched 전이. mailItem OFF·아이템 미첨부면 itemFetched 0 = 0157 비트 동일.
// step-0157 — 아이템 첨부 우편(mailItem·mailSend item): 0142~0156 우편은 *메시지(body)* 만 날랐다 — 아이템 우편(선물·전리품 배송)이 없었다.
//   이 step: mailSend 가 선택 필드 item(아이템 id)을 받아 우편 1통이 아이템 1개를 *함께 보유*한다. itemSent(아이템 실은 입금 통수)·itemHeld(보유 중 아이템 통수) 회계. 거래소 escrow(0117)처럼 아이템이 우편함에 묶인다(가방 연동 give/반환은 후속 백로그).
//   mailItem OFF·item 미첨부면 item=null·itemSent 0·digest 무변경 = 0156 비트 동일. 수령 시 아이템 이동(0158)·만료 회수(0159)·아이템 회계 capstone(0160) 후속.
// step-0150 — 우편 회계 정합 capstone(mailConsistent·sent==held+fetched+expired): 0142~0149 우편 arc 의 *창발 불변*을 단언하는 capstone(거래소 0140 sagaLiveConsistent 의 우편 판).
//   우편 1통은 매 순간 정확히 한 상태에 있다 — 보유(held·우편함)·수령(fetched·읽음)·만료(expired·회수) 으로 분할되며 공백·중복 0. sent == totalHeld + fetched + expired 가 *모든 체제*(수령만·만료만·혼합·crash 복구)서 성립.
//   미호출 read accessor = 0149 비트 동일(reg). 0142~0149 가 더한 모든 전이(입금·수령·만료·replay)가 이 분할을 보존함을 닫는 단언.
// step-0149 — 우편 만료 발행(mailExpirePublish·svc.mail.expired): 0148 만료는 *발행 0* — 발신자/운영이 만료를 관측할 길이 없었다.
//   이 step: mailSweep 만료 시 통마다 svc.mail.expired{id,to,from} 발행 → audit 가 관측. 우편 수명주기 발행 3종(입금 svc.mail.sent 0144·읽음 svc.mail.read 0147·만료 svc.mail.expired) 완비(거래소 sold/cancelled/expired 와 동형). OFF·bus 부재면 발행 0 = 0148 비트 동일.
// step-0148 — 우편 만료 TTL(mailTtl·now−sentAt≥ttl 자동 회수): 미수령 우편이 우편함에 영영 쌓일 수 있다(0143 의 정직한 한계).
//   거래소 0114(매물 만료 TTL)처럼, mailSweep(now) 가 now−sentAt≥ttl 인 미수령 우편을 *시간 트리거*로 회수(보유→만료). 회계가 sent==held+fetched+expired 로 완비(우편 1통은 매 순간 보유/수령/만료 정확히 한 상태).
//   만료도 durable op('expire')로 저널 → reconstruct 정합. ttl 0·mailSweep 미주입이면 만료 0 = 0147 비트 동일.
// step-0147 — 우편 읽음 확인 발행(mailReadPublish·svc.mail.read): 0144 는 *입금*만 발행했다 — 수령(읽음)은 운영/발신자가 관측할 길이 없었다.
//   이 step: mailFetch 수령 시 통마다 svc.mail.read{id,to,from} 발행 → audit/발신자가 *읽음*을 관측(수명주기 발행 확장·거래소 sold/cancelled 류). 우편함 권위 불변(발행=파생 스트림·비-침습). OFF·bus 부재면 발행 0 = 0146 비트 동일.
// step-0146 — 우편 저널 스냅샷 압축(mailSnapshot): 0145 저널은 무압축이라 send/fetch 누적으로 무한 성장한다.
//   거래소 0110·가방 0018 처럼, 저널 N항(snapInterval)마다 현재 projection 을 스냅샷(upToSeq=jseq)하고 그 이하 저널을 가지치기 → *tail 만* 유계 보관.
//   reconstruct 는 스냅샷에서 출발해 tail 만 replay → 전체-저널 replay 와 *비트 동일*(무손실 압축). 라이브 projection 비-침습(압축은 저널 쪽 일). snapInterval 0 면 0145 비트 동일.
// step-0145 — 우편 영속·failover(mailPersist·op 저널 replay): 0142~0144 우편함은 *자기 영속 0* — crash 시 보유·수령이 전부 휘발했다.
//   가방 0017(효과 저널)·거래소 0109(op 저널)처럼, 우편도 원장을 바꾼 op(send·fetch)를 durable 저널에 append 하고, crash(projection 소실) 후 그 저널을 seq 순 replay 해
//   우편함+읽음+회계를 *죽기 전과 비트 동일*하게 재구성한다(event sourcing·발신/발행 없이 순수 재현). persist OFF·미replay 면 소실(영속 부재의 대가 = 대조군). "세계가 세션보다 오래 산다".
// step-0144 — 우편 발행(mailSentPublish·svc.mail.sent): 입금(mailSend)을 버스로 발행해 audit/읽기 모델이 *발행자 무수정으로* 관측한다 —
//   거래소 0108(exchangePublish→svc.exchange.sold·audit 구독)의 우편 판. 우편함 권위는 여전히 MailService(발행은 파생 관찰 스트림). OFF·bus 부재면 발행 0 = 0143 비트 동일.
// step-0143 — 우편 수령(mailFetch): 0142 는 입금만이라 우편함이 무한히 쌓였다 — 수신자가 *가져가는* 경로가 없었다.
//   이 step: 수신자가 우편함을 pull → 보유(held)에서 수령(fetched)으로 *무손실 이동*(읽음 보관·이중 수령 0·빈 우편함 재수령 0).
//   회계 확장: 0142 sent==totalHeld 에서 sent==held+fetched 로(+expired 0148). 우편은 오프라인 배송이므로 *접속 시 수령*이 정상 흐름(귓속말의 즉시 전달과 대비).
// step-0142 — 우편(Mail) 서비스 분리(MailService): SPINE §2 게임 서비스 계층의 *우편*(⬜→🟡 첫 박스). offline 비동기 배송 —
//   귓속말(0071~ wrouter)이 *온라인* 라우팅(수신자 접속 시 즉시 전달/반송)이라면, 우편은 *오프라인* 배송: 발신자가 수신자 우편함에 넣으면
//   수신자가 *나중에 접속해 수령*한다(접속 무관·세계가 세션보다 오래 — SPINE §2 "tick 과 무관한 책임은 존 밖으로").
//   존 tick 밖 별 박스(신성한 tick 보존)·단일 소유(우편함 권위는 이 박스)·발신 0(0142 — 입금만; 수령 0143·발행 0144~).
//   0142 한 조각: mailSend(입금) — 발신자→수신자 우편함에 우편 1통 적재. 우편함 = recipient별 Map(mailId→mail). 거래소(0107)·시세 피드(0112) 박스 도입 패턴.
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
    this.read = new Map();         // recipient -> [수령한 mail…] — 읽음 보관(0147 읽음 확인 발행 대비·수령 내용 검증).
    this._seq = 0;                 // 결정론 mail id 시퀀스(id 미지정 시 'mail'+seq — 단일 박스 순서 = 결정적).
    this.ttl = opts.ttl || 0;      // 만료 TTL(step-0148·mailTtl) — now−sentAt≥ttl 미수령 우편 자동 회수. 0 면 만료 0(0147 동일).
    this.persist = opts.persist || false;   // 원장 영속(step-0145·mailPersist) — send/fetch op 를 durable 저널에 기록·crash 후 replay. OFF 면 저널 0(0144 동일·휘발).
    this.journal = [];             // durable op 저널 [{seq,kind,...}](step-0145) — projection(우편함·읽음·회계)과 분리(crash 시 projection 만 소실).
    this.jseq = 0;                 // 저널 시퀀스(append-only).
    this.snapInterval = opts.snapInterval || 0;   // 저널 스냅샷 압축(step-0146·mailSnapshot) — 저널 N항마다 projection 스냅샷+가지치기. 0 면 무압축(0145 동일).
    this.snapshot = null;          // {upToSeq, state}(step-0146) — 마지막 압축 스냅샷. reconstruct 의 출발점.
    this.inv = opts.inv || null;        // 가방(inventory) 주소(step-0161·mailInv) — 아이템 우편 custody give 의 대상. 부재면 우편 박스 내 회계만(0160 동일).
    this.invMode = opts.invMode || false;   // 아이템 우편 가방 연동(step-0161) — ON 이면 mailSend/fetch/expire 가 가방 give 로 custody 이동. OFF 면 0160 비트 동일.
    this.gives = 0;                // 발신한 custody give 수(step-0161 — 거래소 0117 _custody 의 우편 판·0169 회계·0170 교차 정합 대비).
    this.saga = opts.saga || false;   // give 결과 비동기 수신(step-0165·mailSaga) — _custody 가 replyTo+gid 를 실어 가방 회신을 받는다. OFF 면 가방 회신 안 함(0164 비트 동일).
    this._gid = 0;                 // 단조 give id(step-0165·미해결 추적 매칭 키).
    this.pending = new Set();      // 미해결 give 의 gid(step-0165) — _custody add·item_result 회신이 delete. 정상 흐름서 0 으로 drain(회신 손실 시 잔존·0167 가시).
    this.acked = 0; this.ackedOk = 0; this.ackedFail = 0;   // 회신 받은 give 수(step-0165·ok/fail 분리·0169 gives==ackedOk+ackedFail+pending).
    this.compensate = opts.compensate || false;   // 발신 실패 보상(step-0166·mailCompensate) — 발신 leg give 실패 시 우편 롤백. OFF 면 0165 비트 동일.
    this.compensated = 0;          // 보상(롤백)한 발신 우편 수(step-0166).
    this._gidRef = new Map();      // gid -> {kind:'send', mailId, rcpt}(step-0166) — 발신 leg give 의 우편 참조(실패 시 롤백 대상).
  }
  // 발신 우편 롤백(step-0166·보상) — 발신 leg give 실패 시 낙관적 적재한 우편을 제거(거래소 0122 abort 의 우편 판·phantom 0).
  _compensateSend(ref) {
    const box = this.boxes.get(ref.rcpt);
    if (box && box.has(ref.mailId)) {
      const mm = box.get(ref.mailId);
      box.delete(ref.mailId); this.sent--; if (mm.item != null) this.itemSent--;
      this.compensated++;
    }
  }
  // custody 이동 헬퍼(step-0161) — 아이템 우편 가방 연동의 한 레그. invMode·inv·itemId 있을 때만 가방에 give(from→to). 가방이 권위·우편은 요청만(은닉). 미충족이면 no-op(0160 비트 동일).
  //   custody 의제 소유자 'mailcustody' — 발신~수령/만료 사이 in-transit 아이템 보관(거래소 'escrow' 의 우편 판). cause 로 leg 구분(mailsend/mailfetch/mailexpire).
  //   step-0165: saga ON 이면 replyTo(자기)+gid 동봉·pending 추적(가방 회신 매칭).
  _custody(itemId, from, to, cause, ref) {
    if (!this.invMode || !this.inv || itemId == null || !this.net) return;
    const msg = { type: 'item_req', op: 'give', itemId, fromAvatar: from, toAvatar: to, cause };
    if (this.saga) { const gid = ++this._gid; msg.replyTo = this.addr; msg.gid = gid; this.pending.add(gid); if (ref) this._gidRef.set(gid, ref); }   // step-0166: ref(발신 leg 우편 참조) 보관·실패 시 롤백
    this.net.send(this.addr, this.inv, msg);
    this.gives++;
  }
  // projection 스냅샷/복원(step-0146) — 우편함(보유)·읽음·회계를 plain 구조로 직렬화/역직렬화(스냅샷 압축의 베이스).
  _snapState() {
    return {
      boxes: [...this.boxes].map(([r, mm]) => [r, [...mm.values()].map(x => ({ ...x }))]),
      read: [...this.read].map(([r, arr]) => [r, arr.map(x => ({ ...x }))]),
      sent: this.sent, fetched: this.fetched, expired: this.expired,
    };
  }
  _restore(s) {
    this.boxes = new Map(s.boxes.map(([r, arr]) => [r, new Map(arr.map(x => [x.id, { ...x }]))]));
    this.read = new Map(s.read.map(([r, arr]) => [r, arr.map(x => ({ ...x }))]));
    this.sent = s.sent; this.fetched = s.fetched; this.expired = s.expired;
  }
  // op 저널 추가(step-0145) — 우편함을 바꾼 op(send/fetch)만 durable 저널에 append. persist OFF 면 no-op(0144 동일).
  //   step-0146: snapInterval 도달 시 현재 projection 을 스냅샷(upToSeq=jseq)하고 그 이하 저널을 가지치기 → tail 만 유계 보관.
  _journal(entry) {
    if (!this.persist) return;
    this.journal.push({ seq: ++this.jseq, ...entry });
    if (this.snapInterval > 0 && this.journal.length >= this.snapInterval) {
      this.snapshot = { upToSeq: this.jseq, state: this._snapState() };
      this.journal = this.journal.filter(e => e.seq > this.jseq);   // tail 만(방금 upToSeq 이하 전부 가지치기 → 0)
    }
  }
  _box(rcpt) { if (!this.boxes.has(rcpt)) this.boxes.set(rcpt, new Map()); return this.boxes.get(rcpt); }
  onMsg(m) {
    const p = m && m.payload;
    if (!p) return;
    // 가방 give 결과 비동기 수신(step-0165·mailSaga) — _custody 가 replyTo 로 보낸 give 의 item_result 회신. gid 로 pending 에서 제거 + acked(ok/fail) 집계.
    //   saga OFF 면 이 메시지가 영영 안 옴(가방 _sagaReply no-op·0164 비트 동일). 미해결 추적·재전송(0167)·보상(0166)의 토대.
    if (p.type === 'item_result' && p.op === 'give') {
      if (p.gid !== undefined && this.pending.has(p.gid)) {
        this.pending.delete(p.gid); this.acked++;
        if (p.ok) this.ackedOk++;
        else { this.ackedFail++; if (this.compensate) { const ref = this._gidRef.get(p.gid); if (ref && ref.kind === 'send') this._compensateSend(ref); } }   // step-0166: 발신 실패→우편 롤백(phantom 0)
        this._gidRef.delete(p.gid);
      }
      return;
    }
    // 우편 입금(mailSend) — 발신자가 수신자 우편함에 우편 1통을 비동기 적재(수신자 접속 무관). p={type,id?,from,to,body}.
    //   id 미지정이면 결정론 시퀀스로 부여. 같은 id 재전송은 멱등(이중 적재 0 — 재전송 신뢰성 0145~ 대비).
    if (p.type === 'mailSend') {
      const rcpt = p.to;
      const id = p.id != null ? p.id : ('mail' + (this._seq++));
      const box = this._box(rcpt);
      if (box.has(id)) return;   // idempotent
      const sentAt = m.tick != null ? m.tick : (p.sentAt | 0);
      const item = (this.item && p.item != null) ? p.item : null;   // step-0157: 아이템 첨부(mailItem OFF·미첨부면 null = 0156 비트 동일)
      box.set(id, { id, from: p.from, to: rcpt, body: p.body, sentAt, item });
      this.sent++;
      if (item != null) this.itemSent++;
      this._journal({ kind: 'send', id, from: p.from, to: rcpt, body: p.body, sentAt, item });   // step-0145: durable op (step-0157: item 동봉)
      if (item != null) this._custody(item, p.from, 'mailcustody', 'mailsend', { kind: 'send', mailId: id, rcpt });   // step-0161: 발신 인출 leg1 — 발신자 가방→우편 custody(거래소 0117 의 우편 판·invMode OFF 면 no-op). step-0166: ref 로 실패 시 롤백.
      // 입금 발행(step-0144·mailSentPublish) — svc.mail.sent 로 1회 발행(운영 가시화·audit 관측). OFF·bus 부재면 no-op(0143 비트 동일).
      if (this.sentPublish && this.bus && this.net) { this.net.send(this.addr, this.bus, { type: 'pub', topic: 'svc.mail.sent', ev: { id, from: p.from, to: rcpt, sentAt } }); this.sentPublished++; }
      return;
    }
    // 우편 수령(mailFetch·step-0143) — 수신자가 자기 우편함을 pull. 보유분 전부를 읽음 보관으로 *무손실 이동*(box→read).
    //   빈 우편함 재수령은 0통(이중 수령 0). p={type,to}. 마지막 수령 배치는 _lastFetch 에 보관(0147 발행 대비).
    if (p.type === 'mailFetch') {
      const rcpt = p.to;
      const box = this.boxes.get(rcpt);
      const out = box ? [...box.values()] : [];
      if (out.length) {
        const log = this.read.get(rcpt) || [];
        for (const mm of out) log.push(mm);
        this.read.set(rcpt, log);
        this.fetched += out.length;
        for (const mm of out) if (mm.item != null) this.itemFetched++;   // step-0158: 아이템도 수령 이동(itemHeld→itemFetched)
        for (const mm of out) if (mm.item != null) this._custody(mm.item, 'mailcustody', rcpt, 'mailfetch');   // step-0162: 수령 입금 leg2 — 우편 custody→수령자 가방(거래소 0118 의 우편 판·invMode OFF 면 no-op)
        box.clear();   // 보유→수령 이동(무손실·중복 0). 빈 Map 유지(held(rcpt)==0).
        this._journal({ kind: 'fetch', to: rcpt });   // step-0145: durable op(수령도 replay 정합 — replay 시 그 시점 보유분을 동일 이동)
        // 읽음 발행(step-0147·mailReadPublish) — 수령 통마다 svc.mail.read 발행(운영/발신자 읽음 관측). OFF·bus 부재면 no-op(0146 비트 동일·발행은 replay 에서 안 함).
        if (this.readPublish && this.bus && this.net) for (const mm of out) { this.net.send(this.addr, this.bus, { type: 'pub', topic: 'svc.mail.read', ev: { id: mm.id, to: rcpt, from: mm.from } }); this.readPublished++; }
      }
      this._lastFetch = { to: rcpt, mails: out };
      return;
    }
    // 우편 만료 sweep(mailSweep·step-0148) — now−sentAt≥ttl 인 미수령 우편을 시간 트리거로 회수(보유→만료). p={type,now?}. now 미지정이면 주입 tick.
    //   ttl 0 면 no-op(0147 동일). 결정론: recipient/id 정렬 순회. 만료도 durable op('expire')로 저널 → reconstruct 정합.
    if (p.type === 'mailSweep') {
      if (this.ttl <= 0) return;
      const now = p.now != null ? p.now : (m.tick | 0);
      for (const rcpt of [...this.boxes.keys()].sort()) {
        const box = this.boxes.get(rcpt);
        for (const id of [...box.keys()].sort()) {
          const mm = box.get(id);
          if (now - mm.sentAt >= this.ttl) {
            box.delete(id); this.expired++;
            if (mm.item != null) this.itemExpired++;   // step-0159: 아이템 실은 우편 만료 회수(itemHeld→itemExpired)
            if (mm.item != null) this._custody(mm.item, 'mailcustody', mm.from, 'mailexpire');   // step-0163: 만료 반환 leg3 — 우편 custody→발신자 가방(거래소 0119 의 우편 판·invMode OFF 면 no-op)
            this._journal({ kind: 'expire', to: rcpt, id });   // durable op(만료도 replay 정합)
            // 만료 발행(step-0149·mailExpirePublish) — 회수 통마다 svc.mail.expired 발행(운영/발신자 관측). OFF·bus 부재면 no-op(0148 비트 동일·replay 에선 안 함).
            if (this.expirePublish && this.bus && this.net) { this.net.send(this.addr, this.bus, { type: 'pub', topic: 'svc.mail.expired', ev: { id, to: rcpt, from: mm.from } }); this.expirePublished++; }
          }
        }
      }
      return;
    }
  }
  // crash(step-0145) — 박스 RAM 소실의 인프로세스 모델: projection(우편함·읽음·회계)만 비운다. *op 저널은 durable* 이라 보존(거래소 0109 의 우편 판).
  crash() {
    this.boxes = new Map(); this.read = new Map();
    this.sent = 0; this.fetched = 0; this.expired = 0; this.sentPublished = 0; this.readPublished = 0; this.expirePublished = 0; this._seq = 0; this._lastFetch = null;
    this.itemSent = 0; this.itemFetched = 0; this.itemExpired = 0;   // step-0157~0159: 아이템 회계도 RAM 소실(저널 replay 로 복원)
    this.gives = 0;   // step-0161: custody give 계측 리셋(가방 give 는 외부 — 우편 박스 RAM 소실 모델)
    this.pending = new Set(); this.acked = 0; this.ackedOk = 0; this.ackedFail = 0; this._gid = 0;   // step-0165: saga 미해결/회신 회계 리셋
    this.compensated = 0; this._gidRef = new Map();   // step-0166: 보상 회계 리셋
  }
  // reconstruct(step-0145·failover) — fresh 박스가 durable op 저널을 seq 순 replay 해 projection 을 재계산(onMsg 와 같은 매핑·발신/발행 없이) → 죽기 전과 비트 동일.
  //   send → 우편함 적재 + sent++(멱등). fetch → 그 시점 보유분 전부 box→read 이동(수령 회계 재현). 발행(sentPublish)은 replay 에서 *안 한다*(파생 스트림·이중 발행 방지).
  //   step-0146: 스냅샷이 있으면 그 projection 에서 출발해 tail(seq>upToSeq)만 replay(스냅샷 압축 — 전체 replay 와 비트 동일).
  reconstruct() {
    if (this.snapshot) this._restore(this.snapshot.state);
    for (const e of this.journal.slice().sort((a, b) => a.seq - b.seq)) {
      if (e.kind === 'send') {
        const box = this._box(e.to);
        if (box.has(e.id)) continue;
        const item = e.item != null ? e.item : null;   // step-0157: 아이템 동봉 replay
        box.set(e.id, { id: e.id, from: e.from, to: e.to, body: e.body, sentAt: e.sentAt, item });
        this.sent++;
        if (item != null) this.itemSent++;
      } else if (e.kind === 'fetch') {
        const box = this.boxes.get(e.to);
        const out = box ? [...box.values()] : [];
        if (out.length) {
          const log = this.read.get(e.to) || [];
          for (const mm of out) log.push(mm);
          this.read.set(e.to, log);
          this.fetched += out.length;
          for (const mm of out) if (mm.item != null) this.itemFetched++;   // step-0158: 아이템 수령 이동 replay
          box.clear();
        }
      } else if (e.kind === 'expire') {   // 만료(step-0148) — 회수된 우편 1통 제거 + expired++(저널 정합).
        const box = this.boxes.get(e.to);
        if (box && box.has(e.id)) { const mm = box.get(e.id); box.delete(e.id); this.expired++; if (mm.item != null) this.itemExpired++; }   // step-0159: 아이템 만료 회수 replay
      }
    }
  }
  held(rcpt) { const b = this.boxes.get(rcpt); return b ? b.size : 0; }   // 한 수신자 우편함 보유 통수
  totalHeld() { let n = 0; for (const b of this.boxes.values()) n += b.size; return n; }   // 전 우편함 보유 합
  itemHeld() { let n = 0; for (const b of this.boxes.values()) for (const mm of b.values()) if (mm.item != null) n++; return n; }   // 보유 중 아이템 실은 통수(step-0157)
  // 보유 우편이 든 아이템 id 집합(step-0164·단언용 읽기) — in-transit custody 에 있어야 할 아이템들. 가방 'mailcustody' 소유 집합과 일치해야(2-서비스 보존·거래소 0120 의 우편 판).
  mailCustodyItems() { const ids = []; for (const b of this.boxes.values()) for (const mm of b.values()) if (mm.item != null) ids.push(mm.item); return ids.sort(); }
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
if (typeof globalThis !== 'undefined') (globalThis.__HktNetParts = globalThis.__HktNetParts || {}).svc_mail = __part;
