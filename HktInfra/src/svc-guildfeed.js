'use strict';
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
  }
  onMsg(m) {
    const p = m.payload;
    if (p.type !== 'ev' || p.topic !== 'svc.guild.changed') return;   // 길드 변경 스트림만 소비(타 토픽 무시).
    this.events++;
    const ev = p.ev;
    if (ev.kind === 'create') this.counts.set(ev.guildId, ev.members.length);   // 초기 로스터 크기로 배지 시드.
    else if (ev.kind === 'join') this.counts.set(ev.guildId, (this.counts.get(ev.guildId) || 0) + 1);
    else if (ev.kind === 'leave') this.counts.set(ev.guildId, (this.counts.get(ev.guildId) || 0) - 1);
  }
  countOf(guildId) { return this.counts.get(guildId) || 0; }
  totalMembers() { let t = 0; for (const v of this.counts.values()) t += v; return t; }
}

const __gf = { GuildFeed };
if (typeof module !== 'undefined' && module.exports) module.exports = __gf;
if (typeof globalThis !== 'undefined') (globalThis.__HktNetParts = globalThis.__HktNetParts || {}).svc_guildfeed = __gf;
