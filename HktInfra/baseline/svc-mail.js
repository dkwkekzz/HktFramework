'use strict';
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
    this.boxes = new Map();        // recipient -> Map(mailId -> mail) — 우편함 권위(단일 소유·보유 held).
    this.sent = 0;                 // 총 입금 통수(회계 — 0150 sent==held+fetched+expired 의 좌변).
    this.fetched = 0;              // 총 수령 통수(step-0143 — 수신자가 가져간 합).
    this.expired = 0;              // 총 만료 통수(step-0148 — 만료 회수 합; 0143 엔 0).
    this.read = new Map();         // recipient -> [수령한 mail…] — 읽음 보관(0147 읽음 확인 발행 대비·수령 내용 검증).
    this._seq = 0;                 // 결정론 mail id 시퀀스(id 미지정 시 'mail'+seq — 단일 박스 순서 = 결정적).
    this.persist = opts.persist || false;   // 원장 영속(step-0145·mailPersist) — send/fetch op 를 durable 저널에 기록·crash 후 replay. OFF 면 저널 0(0144 동일·휘발).
    this.journal = [];             // durable op 저널 [{seq,kind,...}](step-0145) — projection(우편함·읽음·회계)과 분리(crash 시 projection 만 소실).
    this.jseq = 0;                 // 저널 시퀀스(append-only).
    this.snapInterval = opts.snapInterval || 0;   // 저널 스냅샷 압축(step-0146·mailSnapshot) — 저널 N항마다 projection 스냅샷+가지치기. 0 면 무압축(0145 동일).
    this.snapshot = null;          // {upToSeq, state}(step-0146) — 마지막 압축 스냅샷. reconstruct 의 출발점.
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
    // 우편 입금(mailSend) — 발신자가 수신자 우편함에 우편 1통을 비동기 적재(수신자 접속 무관). p={type,id?,from,to,body}.
    //   id 미지정이면 결정론 시퀀스로 부여. 같은 id 재전송은 멱등(이중 적재 0 — 재전송 신뢰성 0145~ 대비).
    if (p.type === 'mailSend') {
      const rcpt = p.to;
      const id = p.id != null ? p.id : ('mail' + (this._seq++));
      const box = this._box(rcpt);
      if (box.has(id)) return;   // idempotent
      const sentAt = m.tick != null ? m.tick : (p.sentAt | 0);
      box.set(id, { id, from: p.from, to: rcpt, body: p.body, sentAt });
      this.sent++;
      this._journal({ kind: 'send', id, from: p.from, to: rcpt, body: p.body, sentAt });   // step-0145: durable op
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
        box.clear();   // 보유→수령 이동(무손실·중복 0). 빈 Map 유지(held(rcpt)==0).
        this._journal({ kind: 'fetch', to: rcpt });   // step-0145: durable op(수령도 replay 정합 — replay 시 그 시점 보유분을 동일 이동)
      }
      this._lastFetch = { to: rcpt, mails: out };
      return;
    }
  }
  // crash(step-0145) — 박스 RAM 소실의 인프로세스 모델: projection(우편함·읽음·회계)만 비운다. *op 저널은 durable* 이라 보존(거래소 0109 의 우편 판).
  crash() {
    this.boxes = new Map(); this.read = new Map();
    this.sent = 0; this.fetched = 0; this.expired = 0; this.sentPublished = 0; this._seq = 0; this._lastFetch = null;
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
        box.set(e.id, { id: e.id, from: e.from, to: e.to, body: e.body, sentAt: e.sentAt });
        this.sent++;
      } else if (e.kind === 'fetch') {
        const box = this.boxes.get(e.to);
        const out = box ? [...box.values()] : [];
        if (out.length) {
          const log = this.read.get(e.to) || [];
          for (const mm of out) log.push(mm);
          this.read.set(e.to, log);
          this.fetched += out.length;
          box.clear();
        }
      }
    }
  }
  held(rcpt) { const b = this.boxes.get(rcpt); return b ? b.size : 0; }   // 한 수신자 우편함 보유 통수
  totalHeld() { let n = 0; for (const b of this.boxes.values()) n += b.size; return n; }   // 전 우편함 보유 합
  fetchedOf(rcpt) { const l = this.read.get(rcpt); return l ? l.length : 0; }   // 한 수신자 수령 통수(step-0143)
  boxOf(rcpt) { const b = this.boxes.get(rcpt); return b ? [...b.values()] : []; }   // 우편함 통째(읽기·결정론 순서)
  readOf(rcpt) { const l = this.read.get(rcpt); return l ? l.slice() : []; }   // 수령(읽음) 보관 통째(step-0143)
  // 회계 정합(step-0143 — sent==held+fetched; 0148 에 +expired). 우편 1통은 매 순간 정확히 한 상태(보유·수령·만료)에 있다(공백·중복 0).
  accountConsistent() { return this.sent === this.totalHeld() + this.fetched + this.expired; }
  // digest — 우편 *전체 상태* 해시(결정론·failover 비트 동일 검증용). 0145: 우편함(보유)+읽음(수령)+회계 카운터 포함(crash→reconstruct 가 죽기 전과 동일한지 단언).
  digest() {
    const rows = [];
    for (const rcpt of [...this.boxes.keys()].sort())
      for (const id of [...this.boxes.get(rcpt).keys()].sort()) {
        const mm = this.boxes.get(rcpt).get(id);
        rows.push(`H/${rcpt}/${id}:${mm.from}>${mm.to}@${mm.sentAt}:${mm.body}`);
      }
    for (const rcpt of [...this.read.keys()].sort())
      for (const mm of this.read.get(rcpt))
        rows.push(`R/${rcpt}/${mm.id}:${mm.from}>${mm.to}@${mm.sentAt}:${mm.body}`);
    rows.push(`C:sent=${this.sent},fetched=${this.fetched},expired=${this.expired}`);
    return fnv1a(rows.join('|'));
  }
}

const __part = { MailService };
if (typeof module !== 'undefined' && module.exports) module.exports = __part;
if (typeof globalThis !== 'undefined') (globalThis.__HktNetParts = globalThis.__HktNetParts || {}).svc_mail = __part;
