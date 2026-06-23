'use strict';
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
  }
  _row(rcpt) { if (!this.badges.has(rcpt)) this.badges.set(rcpt, { unread: 0, sent: 0 }); return this.badges.get(rcpt); }
  onMsg(m) {
    const p = m.payload;
    if (p.type !== 'ev' || !p.ev) return;
    // 입금 소비(svc.mail.sent·0144) — 그 수신자의 미읽음 통수 증가. ev={id,from,to,sentAt}.
    if (p.topic === 'svc.mail.sent') { const r = this._row(p.ev.to); r.unread++; r.sent++; this.consumed++; return; }
  }
  unreadOf(rcpt) { const r = this.badges.get(rcpt); return r ? r.unread : 0; }   // 한 수신자 미읽음 통수(배지)
  sentOf(rcpt) { const r = this.badges.get(rcpt); return r ? r.sent : 0; }       // 한 수신자 누적 입금 통수
  totalUnread() { let n = 0; for (const r of this.badges.values()) n += r.unread; return n; }   // 전 수신자 미읽음 합
  // crash — 읽기 모델 프로세스 사망(RAM 소실)의 인프로세스 모델. 투영·소비 회계 비움(자기 영속 0).
  crash() { this.badges = new Map(); this.consumed = 0; }
  // digest — 배지 투영 해시(결정론 검증용). recipient 정렬 순회.
  digest() {
    const rows = [];
    for (const rcpt of [...this.badges.keys()].sort()) { const r = this.badges.get(rcpt); rows.push(`${rcpt}:u${r.unread}/s${r.sent}`); }
    return fnv1a(rows.join('|'));
  }
}

const __part = { MailFeed };
if (typeof module !== 'undefined' && module.exports) module.exports = __part;
if (typeof globalThis !== 'undefined') (globalThis.__HktNetParts = globalThis.__HktNetParts || {}).svc_mailfeed = __part;
