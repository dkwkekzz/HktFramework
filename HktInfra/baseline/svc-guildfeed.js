'use strict';
// step-0188 — GuildFeed 회계 정합 capstone(feedConsistent·배지==로스터 크기): 0186~0187 에서 배지를 세우고 영속시켰다. 이 step 은 그 *불변*을 명시 단언한다 — 전 길드에서 GuildFeed 배지 countOf(id) == GuildService 로스터 members.length(고아 배지 0·누락 0). 우편 MailFeed 0155 feedConsistent(unread==sent−read−expired)의 길드 판. 정상·crash→reconstruct(feed/guild 양쪽)·영속 네 체제서 성립 → 읽기 모델(CQRS)이 권위 SSOT 와 결코 갈라지지 않음을 증명. 순수 읽기 메서드(권위 0·실행 경로 무변경) → 0187 비트 동일(reg).
// step-0187 — GuildFeed 영속·late-join(guildFeedPersist·op 저널 replay): 0186 의 배지는 *휘발*이라 박스 crash 시 멤버 수 투영이 소실됐다(영속 0·0186 한계). 우편 MailFeed 0154·랭킹 0020 의 읽기 모델 영속(소비 op 저널 replay)을 길드 배지에 적용한다: 소비한 svc.guild.changed 이벤트를 durable 저널에 기록하고, crash(투영 소실) 후 fresh GuildFeed 가 그 저널을 replay 해 배지를 재구성한다 → 죽기 전과 동일(late-join). 배지(투영)는 휘발, 저널은 durable. guildFeedPersist OFF 면 저널 0·crash 후 빈 배지(소실) = 0186 비트 동일.
// step-0186 — 길드 멤버 수 배지 읽기 모델(GuildFeed·svc.guild.changed 구독·발신 0·권위 0): 우편 MailFeed 0151·거래소 MarketFeed 0112 의 길드 판. 길드 변경 발행 스트림(svc.guild.changed)을 구독해 guildId 별 *현재 멤버 수* 배지를 유지한다 — create=초기 로스터 크기·join +1·leave −1. 로스터 SSOT(GuildService)와 독립한 *파생 읽기 모델*(CQRS): 발신 0(net.send 없음)·권위 0(순수 관찰) → 비-침습. 발행자(GuildService) 무수정으로 추가되는 둘째 소비자(audit 옆).
// dual-mode: Node require / 브라우저는 common.js 를 <script> 선행 로드(전역 __HktNetCommon).
const __c = (typeof module !== 'undefined' && module.exports && typeof require !== 'undefined')
  ? require('./common.js') : globalThis.__HktNetCommon;
const { Net, LoginServer, SessionRegistry, mulberry32, fnv1a, DEFAULTS } = __c;

// ── [게임 서비스] GuildFeed — 길드 멤버 수 배지(읽기 모델). 존 tick 밖 *순수 반응형*(onTick 없음·발신 0·권위 0). ──
//   svc.guild.changed 구독 → guildId 별 memberCount 투영. create=members.length·join +1·leave −1. 로스터 SSOT 와 정합(0188 capstone: 배지==로스터 크기).
class GuildFeed {
  constructor(opts = {}) {
    this.counts = new Map();      // guildId -> memberCount (배지 투영·파생 읽기 모델).
    this.events = 0;              // 소비한 svc.guild.changed 이벤트 수(계측).
    this.persist = opts.persist || false;   // 배지 영속(step-0187·guildFeedPersist) — 소비 op 저널 replay 로 crash 후 재구성. OFF 면 저널 0(0186 동일·휘발).
    this.journal = [];            // durable 소비 op 저널 [ev...] — 투영(counts)과 분리(crash 시 counts 만 소실·저널은 영속). 우편 MailFeed 0154 의 길드 판.
  }
  // 배지 적용(step-0186) — 한 이벤트를 counts 투영에 반영. onMsg·reconstruct 가 같은 매핑 사용(분기 1곳).
  _apply(ev) {
    if (ev.kind === 'create') this.counts.set(ev.guildId, ev.members.length);   // 초기 로스터 크기로 배지 시드.
    else if (ev.kind === 'join') this.counts.set(ev.guildId, (this.counts.get(ev.guildId) || 0) + 1);
    else if (ev.kind === 'leave') this.counts.set(ev.guildId, (this.counts.get(ev.guildId) || 0) - 1);
  }
  onMsg(m) {
    const p = m.payload;
    if (p.type !== 'ev' || p.topic !== 'svc.guild.changed') return;   // 길드 변경 스트림만 소비(타 토픽 무시).
    this.events++;
    this._apply(p.ev);
    if (this.persist) this.journal.push(p.ev);   // 영속(step-0187) — 소비 op 를 durable 저널에 기록(crash replay 대비).
  }
  countOf(guildId) { return this.counts.get(guildId) || 0; }
  totalMembers() { let t = 0; for (const v of this.counts.values()) t += v; return t; }
  // feedConsistent(step-0188·capstone) — 배지 정합 불변: 전 길드 countOf(id) == 로스터 members.length AND 배지에만 있는 고아 guild 0. guildSvc(권위 SSOT)를 받아 대조하는 순수 읽기(권위 0). 읽기 모델이 SSOT 와 갈라지지 않음을 단언. 우편 0155 feedConsistent 의 길드 판.
  feedConsistent(guildSvc) {
    for (const [id, g] of guildSvc.guilds) if (this.countOf(id) !== g.members.length) return false;
    for (const id of this.counts.keys()) if (!guildSvc.guilds.has(id)) return false;   // 고아 배지(로스터 없는데 배지) 0.
    return true;
  }
  // crash(step-0187) — 박스 RAM 소실: 배지 투영·계측만 비운다. *소비 op 저널은 durable* 이라 보존(우편 MailFeed 0154 의 길드 판).
  crash() { this.counts = new Map(); this.events = 0; }
  // reconstruct(step-0187·late-join) — fresh 박스가 durable 저널을 순서대로 replay 해 배지 투영 재구성 → 죽기 전과 동일. 자기 영속 저널만으로 복원.
  reconstruct() { this.counts = new Map(); for (const ev of this.journal) this._apply(ev); }
}

const __gf = { GuildFeed };
if (typeof module !== 'undefined' && module.exports) module.exports = __gf;
if (typeof globalThis !== 'undefined') (globalThis.__HktNetParts = globalThis.__HktNetParts || {}).svc_guildfeed = __gf;
