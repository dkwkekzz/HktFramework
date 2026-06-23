'use strict';
// step-0156 — 미읽음 배지 질의 인터페이스(mailUnreadQuery→mailUnreadReply): 0151~0155 배지는 *프로세스 내 pull*(unreadOf)로만 읽혔다 — 게이트웨이/클라가 *원격에서* 미읽음 수를 물을 길이 없었다.
//   이 step: MailFeed 가 {type:'mailUnreadQuery',rcpt} 요청에 현재 unread 를 {type:'mailUnreadReply',rcpt,unread} 로 회신(request/reply·SPINE §4 경로3·프레즌스 0069 presenceQuery 의 우편 판). 순수 읽기(배지 무변경). 질의 미수신이면 미발화 = 0155 비트 동일.
// step-0155 — MailFeed 회계 정합 capstone(feedConsistent·unread==sent−read−expired): 0151~0154 가 배지에 입금(+)·읽음(−)·만료(−)·복원을 쌓았다. 그 회계가 *대수적으로 닫혀* 있는가?
//   feedConsistent: 모든 수신자에 대해 unread == sent − read − expired (배지의 미읽음은 입금에서 읽음·만료를 뺀 것·음수 0). 0150 mailConsistent(우편 박스 권위 판)의 *읽기 모델 판*. 미호출 read accessor = 0154 비트 동일(reg).
// step-0154 — MailFeed 영속·late-join(reconstruct·우편 op 저널 replay): 0151~0153 MailFeed 는 *자기 영속 0* — crash 시 미읽음 배지가 전부 소실됐다.
//   0020 읽기 모델(ranking)·0113 시세 피드(MarketFeed)가 *쓰기 모델의 durable 저널*을 replay 해 투영을 복원했듯, MailFeed 는 우편 박스의 op 저널(0145 mailPersist·send/fetch/expire)을 replay 해 수신자별 배지(unread/sent/read/expired)를 재계산한다.
//   다운타임에 버스가 흘려보낸 svc.mail.* 를 놓쳤어도 우편이 영속한 op 로 완전 복원(CQRS late-join). reconstruct == 라이브 == 죽기 전. 미호출(restart 미주입)이면 0153 비트 동일.
// step-0153 — MailFeed 만료 반영(svc.mail.expired 구독→unread--): 0152 까지 unread 는 입금(+)·읽음(−)만 반영 — 미수령 만료(0148~0149)는 배지에 안 빠져 *영영 미읽음으로 남았다*.
//   이 step: svc.mail.expired(0149)도 구독해 만료 시 그 수신자 unread--·expired++ → 만료된 우편은 배지에서도 사라진다. 회계가 unread==sent−read−expired 로 닫힌다(0155 capstone 대비). mailFeedExpire OFF 면 0152 비트 동일(expired 토픽 미구독).
// step-0152 — MailFeed 읽음 반영(svc.mail.read 구독→unread--): 0151 은 입금(svc.mail.sent)만 소비해 unread 가 *단조 증가*였다 — 수령(읽음)해도 배지가 안 줄었다.
//   이 step: 우편 박스가 발행하는 svc.mail.read(0147)를 구독해 그 수신자 unread--·read++ → 미읽음 배지가 *읽으면 줄어든다*(거래소 MarketFeed 0116 만료 반영의 우편 판). svc.mail.read 미구독(mailFeedRead OFF)이면 0151 비트 동일(read 토픽 미전달).
// step-0151 — 우편 미읽음 배지 읽기 모델(mailFeed·svc.mail.sent 구독→수신자별 unread 카운트): 우편 박스(0142~0150)는 우편함 *권위*만 들고
//   입금(0144 svc.mail.sent)·읽음(0147 svc.mail.read)·만료(0149 svc.mail.expired)를 버스로 발행한다. 이 박스는 그 발행 스트림을 *소비만* 해
//   수신자별 {unread 미읽음 통수} 투영을 만든다 — 0112 MarketFeed(거래소 sold/cancelled→item별 시세)의 *우편 판*(CQRS read model).
//   우편함 권위 0(우편 박스가 권위)·발신 0(audit·MarketFeed 처럼 순수 관찰 소비자·존 tick 밖 반응형). 0016 발행자 무수정 소비자 패턴:
//   우편/버스 코드 비트 동일, 추가는 구독 테이블 행 + 이 박스뿐. 0151 한 조각: svc.mail.sent 만 소비(unread++). 읽음/만료 반영은 0152~0153.
// dual-mode: Node require / 브라우저는 common.js 를 <script> 선행 로드(전역 __HktNetCommon).
const __c = (typeof module !== 'undefined' && module.exports && typeof require !== 'undefined')
  ? require('./common.js') : globalThis.__HktNetCommon;
const { fnv1a } = __c;

// ── [게임 서비스] MailFeed — 우편 미읽음 배지(읽기 모델). 존 tick 밖 *순수 반응형*(onTick 없음·발신 0). ──
//   svc.mail.sent 토픽을 구독해 수신자별 미읽음(unread)을 *재계산*하는 파생 뷰일 뿐 — 우편함 권위는 MailService.
//   sent{id,from,to,sentAt} → 그 수신자 unread++(접속 전이라도 "안 읽은 우편 N통" 배지). 읽음(0152)·만료(0153)가 unread 를 깎는다.
class MailFeed {
  constructor(opts = {}) {
    this.bus = opts.bus || null;   // 이벤트 버스 주소(구독 경유 — 발행자 주소 무지). mailFeed 는 bus 전제.
    this.badges = new Map();       // recipient -> {unread, sent} (미읽음 배지 투영 — 우편 발행 스트림의 파생, 권위 아님)
    this.consumed = 0;             // svc.mail.* 소비 수(관찰 소비자의 입력 회계)
    this.queriesRx = 0;            // 받은 mailUnreadQuery 수(step-0156·읽기 경로 계측). repliesSent = 보낸 회신 수(1:1).
    this.repliesSent = 0;
  }
  _row(rcpt) { if (!this.badges.has(rcpt)) this.badges.set(rcpt, { unread: 0, sent: 0, read: 0, expired: 0 }); return this.badges.get(rcpt); }
  onMsg(m) {
    const p = m.payload;
    // 미읽음 배지 질의 응답(step-0156·mailUnreadQuery) — {type,rcpt} 요청에 현재 unread 를 {type:'mailUnreadReply'} 로 회신(request/reply·프레즌스 0069 의 우편 판). 순수 읽기(배지 무변경). _lastReply 에 마지막 회신 보관(검증용).
    if (p.type === 'mailUnreadQuery') {
      this.queriesRx++;
      const unread = this.unreadOf(p.rcpt);
      this._lastReply = { rcpt: p.rcpt, unread };
      if (this.net && this.addr) { this.net.send(this.addr, m.from, { type: 'mailUnreadReply', rcpt: p.rcpt, unread }); this.repliesSent++; }
      return;
    }
    if (p.type !== 'ev' || !p.ev) return;
    // 입금 소비(svc.mail.sent·0144) — 그 수신자의 미읽음 통수 증가. ev={id,from,to,sentAt}.
    if (p.topic === 'svc.mail.sent') { const r = this._row(p.ev.to); r.unread++; r.sent++; this.consumed++; return; }
    // 읽음 소비(svc.mail.read·0147·step-0152) — 그 수신자의 미읽음 차감(읽으면 배지가 준다)·read 누적. ev={id,to,from}. mailFeedRead OFF 면 미구독(미전달=0151 비트 동일).
    if (p.topic === 'svc.mail.read') { const r = this._row(p.ev.to); r.unread--; r.read++; this.consumed++; return; }
    // 만료 소비(svc.mail.expired·0149·step-0153) — 미수령 만료 우편을 배지에서도 차감·expired 누적. ev={id,to,from}. mailFeedExpire OFF 면 미구독(0152 비트 동일).
    if (p.topic === 'svc.mail.expired') { const r = this._row(p.ev.to); r.unread--; r.expired++; this.consumed++; return; }
  }
  unreadOf(rcpt) { const r = this.badges.get(rcpt); return r ? r.unread : 0; }   // 한 수신자 미읽음 통수(배지)
  sentOf(rcpt) { const r = this.badges.get(rcpt); return r ? r.sent : 0; }       // 한 수신자 누적 입금 통수
  readOf(rcpt) { const r = this.badges.get(rcpt); return r ? r.read : 0; }       // 한 수신자 누적 읽음 통수(step-0152)
  expiredOf(rcpt) { const r = this.badges.get(rcpt); return r ? r.expired : 0; }   // 한 수신자 누적 만료 통수(step-0153)
  totalUnread() { let n = 0; for (const r of this.badges.values()) n += r.unread; return n; }   // 전 수신자 미읽음 합
  // 배지 회계 정합 capstone(step-0155·단언용 읽기 accessor) — 모든 수신자에 unread == sent − read − expired·unread≥0(공백·중복 0). 0150 mailConsistent 의 읽기 모델 판. 미호출 = 0154 비트 동일.
  feedConsistent() { for (const r of this.badges.values()) if (r.unread !== r.sent - r.read - r.expired || r.unread < 0) return false; return true; }
  // crash — 읽기 모델 프로세스 사망(RAM 소실)의 인프로세스 모델. 투영·소비 회계 비움(자기 영속 0).
  crash() { this.badges = new Map(); this.consumed = 0; }
  // reconstruct(step-0154·late-join) — 자기 영속 0 인데도 *우편 박스의 durable op 저널*(0145)을 replay 해 배지를 재계산(MarketFeed 0113·ranking 0020 의 우편 판).
  //   매핑(우편 reconstruct 와 동형): send → 그 수신자 unread++·sent++(보유 적재). fetch → 그 시점 보유분 전부 unread→read 이동(수령). expire → unread--·expired++(만료 회수).
  //   라이브 배지(svc.mail.sent/read/expired 소비)와 *정확히 같은* 투영을 만든다 — 다운타임에 놓친 발행도 우편 저널이 메운다. 저널은 seq 순.
  reconstruct(journal) {
    this.badges = new Map(); this.consumed = 0;
    const held = new Map();   // rcpt -> 현재 보유 통수(fetch 가 한 번에 옮길 양 산출용 — 우편 저널의 fetch 는 통수 미기록)
    for (const e of (journal || []).slice().sort((a, b) => a.seq - b.seq)) {
      if (e.kind === 'send') { const r = this._row(e.to); r.unread++; r.sent++; held.set(e.to, (held.get(e.to) || 0) + 1); this.consumed++; }
      else if (e.kind === 'fetch') { const h = held.get(e.to) || 0; if (h) { const r = this._row(e.to); r.unread -= h; r.read += h; held.set(e.to, 0); this.consumed += h; } }
      else if (e.kind === 'expire') { const r = this._row(e.to); r.unread--; r.expired++; held.set(e.to, (held.get(e.to) || 0) - 1); this.consumed++; }
    }
  }
  // digest — 배지 투영 해시(결정론 검증용). recipient 정렬 순회.
  digest() {
    const rows = [];
    for (const rcpt of [...this.badges.keys()].sort()) { const r = this.badges.get(rcpt); rows.push(`${rcpt}:u${r.unread}/s${r.sent}/r${r.read || 0}/e${r.expired || 0}`); }
    return fnv1a(rows.join('|'));
  }
}

const __part = { MailFeed };
if (typeof module !== 'undefined' && module.exports) module.exports = __part;
if (typeof globalThis !== 'undefined') (globalThis.__HktNetParts = globalThis.__HktNetParts || {}).svc_mailfeed = __part;
