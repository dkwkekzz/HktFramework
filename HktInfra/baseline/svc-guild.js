'use strict';
// step-0183 — 길드 멤버십 변경 발행(guildChangePublish·svc.guild.changed): 0182 의 증분 가입/탈퇴는 *관측 불가*였다(누가 언제 들고 났는지 스트림 0·0182 한계). 실제 길드 변경은 다른 시스템(채팅 채널·배지·감사)이 구독해야 한다. 파티 0084 의 변경 발행을 길드에 적용한다: 실제 멤버십 변경(가입/탈퇴) 시 svc.guild.changed{guildId,kind,member} 를 버스로 발행 → 발행자 무수정 소비자(audit)가 반응. 변경 없는 no-op(중복 가입·없는 탈퇴·master 탈퇴 거부)은 발행 안 함(발행==실 변경). guildChangePublish OFF·bus 부재면 발행 0 = 0182 비트 동일(reg).
// step-0182 — 길드 증분 가입/탈퇴(guildJoin/guildLeave·멱등·master 보호): 0181 의 GuildService 는 guildCreate(*전체 로스터 덮어쓰기*)로만 멤버십을 갱신했다 — 한 명 가입/탈퇴에도 전체 목록을 다시 보내야 한다(0181 한계). 파티 0084 의 증분 가입/탈퇴를 길드에 적용한다: guildJoin{guildId,member}(한 멤버 추가·이미 있으면 no-op·멱등)·guildLeave{guildId,member}(한 멤버 제거·없으면 no-op·멱등). **master 보호**: master 의 guildLeave 는 no-op(마스터는 탈퇴 못 함 — 이양 0189 선결) → single-master 불변 보존. 미존재 길드 join 은 graceful 무시(create 선결). 증분 명령 미주입이면 0181 비트 동일(휴면·reg 0).
// step-0181 — 길드(Guild) 서비스 분리(guildService·GuildService): SPINE 계층3 게임 서비스의 마지막 미착수 박스(가방·채팅·거래소·우편·랭킹 ✅, 길드 ⬜). 파티(0075 PartyService)가 *수명 짧은* 그룹 멤버십이라면, 길드는 *오래 사는 명명된 조직* — 마스터(단일 권위 소유자)가 결성하고 로스터(멤버 집합)를 보유한다. 거래소·우편 박스의 계보(escrow/발행/영속/saga)를 따라 이 arc(0181~0190)에서 키운다.
//   분리 이유(SPINE §2 판정): 길드 멤버십·마스터십은 *존 tick 박자와 무관한 오래 사는 게임 상태* → 비동기 서비스(존 tick 밖·onTick 없음·순수 반응형). 클라/라우터는 로스터를 *질의*로만 소비(은닉: 저장 방식 모름·질의 계약만). 0075 파티 멤버십 SSOT 의 *길드* 판 + single-master 권위 불변(척추 ③ 권위 단일 소유의 길드 적용).
//   더한 한 조각(0181): ⒜ guildCreate{guildId, master, members} → 로스터 SSOT 쓰기(master 는 항상 멤버에 포함·중복 제거) ⒝ guildQuery{guildId} → guildRoster{guildId, master, members} 회신(request/reply·SPINE §4 경로3). single-master 불변: 매 길드는 정확히 한 master(권위 단일 소유). guildService OFF → 박스 0 = 0180 비트 동일(reg).
// dual-mode: Node require / 브라우저는 common.js 를 <script> 선행 로드(전역 __HktNetCommon).
const __c = (typeof module !== 'undefined' && module.exports && typeof require !== 'undefined')
  ? require('./common.js') : globalThis.__HktNetCommon;
const { Net, LoginServer, SessionRegistry, mulberry32, fnv1a, DEFAULTS } = __c;

// ── [게임 서비스] GuildService — 길드 *로스터+마스터십*의 SSOT(SPINE 계층3 길드/소셜). 존 tick 밖 *순수 반응형*(onTick 없음·권위=로스터/마스터만). ──
//   guildCreate: 길드 결성/갱신({guildId, master, members}) → 로스터 SSOT 갱신(master ∈ members 보장). guildQuery: 로스터 질의(request/reply) → guildRoster 회신.
//   single-master 불변: 모든 길드는 정확히 한 master(권위 단일 소유·척추 ③). 마스터 이양은 후속(0189) 쌍 거래.
class GuildService {
  constructor(opts = {}) {
    this.guilds = new Map();      // guildId -> { master, members:[...] } (로스터 SSOT — 오래 사는 상태·master ∈ members).
    this.creates = 0;             // 처리한 guildCreate 수(계측).
    this.queriesRx = 0;           // 받은 guildQuery 수(계측). repliesSent = 보낸 응답 수(1:1).
    this.repliesSent = 0;
    this.joins = 0;               // 처리한 guildJoin 수(step-0182·증분 가입 계측·no-op 포함).
    this.leaves = 0;              // 처리한 guildLeave 수(step-0182·증분 탈퇴 계측·no-op/master 보호 포함).
    this.changePublish = opts.changePublish || false;   // 멤버십 변경 발행(step-0183·guildChangePublish) — 가입/탈퇴를 svc.guild.changed 로. OFF·bus 부재면 발행 0(0182 동일).
    this.bus = opts.bus || null;        // 변경 발행 경로(구독자 주소 무지·은닉). null 이면 발행 못 함.
    this.published = 0;           // svc.guild.changed 발행 수(step-0183·계측). 실 변경과 1:1(no-op 발행 안 함).
    this.net = null; this.addr = null;   // net.register 가 주입(send 경로).
  }
  // 로스터 정규화 — master 를 항상 멤버에 포함하고 중복 제거(집합 의미론·결정론적 삽입 순서: master 선두). single-master 불변 보조.
  _normalize(master, members) {
    const out = [master];
    for (const m of (members || [])) if (m !== master && !out.includes(m)) out.push(m);
    return out;
  }
  // 멤버십 변경 발행(step-0183) — 가입/탈퇴 델타를 svc.guild.changed 로. changePublish OFF·bus 부재면 no-op(0182 동일). 실제 변경 시에만 호출(no-op 변경은 발행 안 함). 파티 0084 _publishChange 의 길드 판.
  _publishChange(guildId, kind, member) {
    if (!(this.changePublish && this.bus)) return;
    this.net.send(this.addr, this.bus, { type: 'pub', topic: 'svc.guild.changed', ev: { guildId, kind, member } }); this.published++;
  }
  onMsg(m) {
    const p = m.payload;
    // 길드 결성/갱신(로스터 SSOT 쓰기) — guildId 의 master+멤버를 설정. 같은 guildId 재-create 면 덮어씀(단순 모델·후속 step 이 증분 가입/탈퇴로 정련). master 는 항상 멤버.
    if (p.type === 'guildCreate') {
      this.guilds.set(p.guildId, { master: p.master, members: this._normalize(p.master, p.members) });
      this.creates++; return;
    }
    // 증분 가입(step-0182·guildJoin) — 한 멤버를 로스터에 추가(전체 덮어쓰기 대신 델타). 이미 멤버면 no-op(멱등). 미존재 길드면 graceful 무시(create 선결). 파티 0084 partyJoin 의 길드 판.
    if (p.type === 'guildJoin') {
      this.joins++;
      const g = this.guilds.get(p.guildId);
      if (g && !g.members.includes(p.member)) { g.members.push(p.member); this._publishChange(p.guildId, 'join', p.member); }
      return;
    }
    // 증분 탈퇴(step-0182·guildLeave) — 한 멤버를 로스터에서 제거(델타). 없으면 no-op(멱등). **master 보호**: master 탈퇴는 no-op(이양 0189 선결) → single-master 불변 보존. 파티 0084 partyLeave 의 길드 판.
    if (p.type === 'guildLeave') {
      this.leaves++;
      const g = this.guilds.get(p.guildId);
      if (g && p.member !== g.master && g.members.includes(p.member)) { g.members = g.members.filter(x => x !== p.member); this._publishChange(p.guildId, 'leave', p.member); }
      return;
    }
    // 로스터 질의(읽기·request/reply) — 클라/라우터가 길드 로스터를 묻는다. 미존재 길드면 master null·빈 목록(graceful). 응답을 m.from 으로 회신.
    if (p.type === 'guildQuery') {
      this.queriesRx++;
      const g = this.guilds.get(p.guildId);
      this.net.send(this.addr, m.from, { type: 'guildRoster', guildId: p.guildId, master: g ? g.master : null, members: g ? g.members.slice() : [] });
      this.repliesSent++; return;
    }
  }
  membersOf(guildId) { const g = this.guilds.get(guildId); return g ? g.members : []; }
  masterOf(guildId) { const g = this.guilds.get(guildId); return g ? g.master : null; }
}

const __guild = { GuildService };
if (typeof module !== 'undefined' && module.exports) module.exports = __guild;
if (typeof globalThis !== 'undefined') (globalThis.__HktNetParts = globalThis.__HktNetParts || {}).svc_guild = __guild;
