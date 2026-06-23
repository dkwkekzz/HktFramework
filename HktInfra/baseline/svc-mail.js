'use strict';
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
    this.bus = opts.bus || null;   // 발행용(0144~ svc.mail.* 발행) — 0142 엔 미사용(발신 0).
    this.boxes = new Map();        // recipient -> Map(mailId -> mail) — 우편함 권위(단일 소유·보유 held).
    this.sent = 0;                 // 총 입금 통수(회계 — 0150 sent==held+fetched+expired 의 좌변).
    this.fetched = 0;              // 총 수령 통수(step-0143 — 수신자가 가져간 합).
    this.expired = 0;              // 총 만료 통수(step-0148 — 만료 회수 합; 0143 엔 0).
    this.read = new Map();         // recipient -> [수령한 mail…] — 읽음 보관(0147 읽음 확인 발행 대비·수령 내용 검증).
    this._seq = 0;                 // 결정론 mail id 시퀀스(id 미지정 시 'mail'+seq — 단일 박스 순서 = 결정적).
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
      box.set(id, { id, from: p.from, to: rcpt, body: p.body, sentAt: m.tick != null ? m.tick : (p.sentAt | 0) });
      this.sent++;
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
      }
      this._lastFetch = { to: rcpt, mails: out };
      return;
    }
  }
  held(rcpt) { const b = this.boxes.get(rcpt); return b ? b.size : 0; }   // 한 수신자 우편함 보유 통수
  totalHeld() { let n = 0; for (const b of this.boxes.values()) n += b.size; return n; }   // 전 우편함 보유 합
  fetchedOf(rcpt) { const l = this.read.get(rcpt); return l ? l.length : 0; }   // 한 수신자 수령 통수(step-0143)
  boxOf(rcpt) { const b = this.boxes.get(rcpt); return b ? [...b.values()] : []; }   // 우편함 통째(읽기·결정론 순서)
  readOf(rcpt) { const l = this.read.get(rcpt); return l ? l.slice() : []; }   // 수령(읽음) 보관 통째(step-0143)
  // 회계 정합(step-0143 — sent==held+fetched; 0148 에 +expired). 우편 1통은 매 순간 정확히 한 상태(보유·수령·만료)에 있다(공백·중복 0).
  accountConsistent() { return this.sent === this.totalHeld() + this.fetched + this.expired; }
  // digest — 우편함 상태 해시(결정론 검증용·recipient/id 정렬). 0142: 입금만이므로 sentAt·from·body 포함.
  digest() {
    const rows = [];
    for (const rcpt of [...this.boxes.keys()].sort())
      for (const id of [...this.boxes.get(rcpt).keys()].sort()) {
        const mm = this.boxes.get(rcpt).get(id);
        rows.push(`${rcpt}/${id}:${mm.from}>${mm.to}@${mm.sentAt}:${mm.body}`);
      }
    return fnv1a(rows.join('|'));
  }
}

const __part = { MailService };
if (typeof module !== 'undefined' && module.exports) module.exports = __part;
if (typeof globalThis !== 'undefined') (globalThis.__HktNetParts = globalThis.__HktNetParts || {}).svc_mail = __part;
