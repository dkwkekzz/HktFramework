'use strict';
// step-0190 — 길드 정합 capstone(rosterConsistent·single-master 불변·arc 0181~0190 닫기): 0181~0189 에서 길드 박스를 세웠다(로스터 SSOT·증분·발행·영속·스냅샷·배지·feed 영속·정합·마스터 이양). 이 step 은 박스 전체를 관통하는 *척추 ③ 권위 단일 소유*의 길드 불변을 명시 단언한다 — rosterConsistent(): 모든 길드는 정확히 한 master(공백 0)·master ∈ members(고아 마스터 0)·멤버 중복 0. 모든 연산(create/join/leave/transfer)·모든 체제(정상·guild crash→reconstruct·feed crash→reconstruct)서 성립 + feedConsistent(0188 배지==로스터)와 결합 → 길드 박스가 결코 single-master 를 깨지 않음을 증명. 순수 읽기(권위 0·실행 경로 무변경) → 0189 비트 동일(reg). 거래소 0140·우편 0180 capstone 의 길드 판.
// step-0189 — 마스터 이양(guildTransfer·single-master 보존 쌍 거래): 0182 master 보호는 마스터를 *영구 고정*했다 — 마스터가 길드를 떠나거나 위임할 길이 없었다(0182 한계). 권위 이동의 정전 패턴(release+acquire 쌍 거래·SPINE §5 ③·존 핸드오프 0006·escrow 거래 0117 의 *마스터십* 판)을 길드에 적용한다: guildTransfer{guildId,from,to} → from 이 현재 master 이고 to 가 멤버일 때만 master 를 to 로 *원자 교체*(공백 0·이중 0). from 은 일반 멤버로 잔류(로스터 크기 불변). to 비-멤버·from 비-마스터면 no-op(거래 거부). 이양도 발행(kind 'transfer'·GuildFeed 는 무시=배지 불변)·저널(영속 replay 동일 적용). guildTransfer 미주입이면 0188 비트 동일(reg).
// step-0186 — 길드 멤버 수 배지 읽기 모델(guildFeed·GuildFeed): 0183 변경 발행은 가입/탈퇴 델타만 노출했다 — 길드 *현재 멤버 수*를 한눈에 보려는 소비자(길드 목록 UI·정원 체크)는 매번 로스터 질의를 해야 했다(0185 한계). 우편 MailFeed 0151·거래소 MarketFeed 0112 의 읽기 모델(발행 스트림 구독·발신 0·권위 0)을 길드에 적용한다: 새 박스 GuildFeed 가 svc.guild.changed 를 구독해 guildId 별 memberCount 배지를 유지(create=초기 로스터 크기·join +1·leave −1). 배지는 로스터 SSOT 와 독립한 *파생 읽기 모델*(CQRS). 정확한 배지를 위해 이 step 은 guildCreate 도 발행(kind 'create'·members) — changePublish ON 일 때만. guildFeed OFF·guild 부재면 박스 0 = 0185 비트 동일.
// step-0185 — 길드 저널 스냅샷 압축(guildSnapshot·snapshot+tail replay): 0184 의 변경 저널은 *무계 성장*이라 가입/탈퇴가 누적될수록 replay 비용·메모리가 ∝변경 수다(0184 한계). 파티 0086(가방 0018·채팅 0022 동일)의 주기 스냅샷+tail replay 를 길드 저널에 적용한다: snapInterval 개 변경마다 현재 로스터 projection 을 스냅샷(upToSeq 기록)하고 그 이하 저널을 가지치기 → 저널은 *마지막 스냅샷 이후 tail* 만 보관(유계). reconstruct 는 스냅샷에서 출발해 tail(seq>upToSeq)만 replay → 전체 저널 replay 와 비트 동일(무손실 압축). guildSnapshot(snapInterval 0) 면 압축 0·저널 무계 = 0184 비트 동일.
// step-0184 — 길드 영속·failover(guildPersist·변경 저널 replay): 0183 까지 GuildService 의 로스터/마스터십은 *휘발*(in-memory)이라 박스 crash 시 결성·가입/탈퇴가 전부 소실됐다(영속 0·0183 한계). 파티 0085 의 event sourcing 을 길드에 적용한다: 로스터를 바꾸는 명령(create/join/leave)을 *변경 저널*(durable)에 append 하고, crash(RAM 소실) 후 fresh GuildService 가 그 저널을 seq 순 replay 해 로스터+마스터십 projection 을 재구성한다 → 죽기 전과 비트 동일. projection(guilds)은 휘발, 저널은 durable. guildPersist OFF 면 저널 0·crash 후 reconstruct 해도 빈 로스터(소실) = 0183 비트 동일(저널 미기록·휴면).
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
    this.transfers = 0;           // 처리한 guildTransfer 수(step-0189·계측·no-op 포함). 성사된 이양만 master 교체.
    this.persist = opts.persist || false;   // 로스터 영속(step-0184·guildPersist) — 변경 명령을 durable 저널에 기록·crash 후 replay 로 재구성. OFF 면 저널 0(0183 동일·휘발).
    this.journal = [];            // durable 변경 저널 [{seq, kind, guildId, master|member}] — projection(guilds)과 분리(crash 시 guilds 만 소실·저널은 영속). 파티 0085 변경 저널의 길드 판.
    this.jseq = 0;                // 저널 시퀀스(단조).
    this.snapInterval = opts.snapInterval || 0;   // 저널 스냅샷 압축(step-0185·guildSnapshot) — 이 개수 변경마다 로스터 스냅샷+저널 가지치기. 0 이면 압축 0(0184 동일·무계 저널).
    this.snapshot = null;         // {upToSeq, guilds:[[guildId,{master,members}]...]} — 마지막 압축 스냅샷(이하 저널은 가지쳐짐). reconstruct 의 출발점.
    this.snapshots = 0;           // 찍은 스냅샷 수(step-0185·계측).
    this.net = null; this.addr = null;   // net.register 가 주입(send 경로).
  }
  // 로스터 정규화 — master 를 항상 멤버에 포함하고 중복 제거(집합 의미론·결정론적 삽입 순서: master 선두). single-master 불변 보조.
  _normalize(master, members) {
    const out = [master];
    for (const m of (members || [])) if (m !== master && !out.includes(m)) out.push(m);
    return out;
  }
  // 변경 저널 추가(step-0184) — 로스터 변경 명령을 durable 저널에 append. persist OFF 면 no-op(0183 동일). 실 변경 시에만 호출. 파티 0085 _journalChange 의 길드 판.
  _journalChange(entry) {
    if (!this.persist) return;
    this.journal.push({ seq: ++this.jseq, ...entry });
    // 스냅샷 압축(step-0185) — tail 길이가 snapInterval 에 도달하면 현재 로스터를 스냅샷(upToSeq=jseq)하고 그 이하 저널 가지치기. 저널은 마지막 스냅샷 이후 tail 만 보관(유계). snapInterval 0 면 미발화(0184 동일). 파티 0086 의 길드 판.
    if (this.snapInterval > 0 && this.journal.length >= this.snapInterval) {
      this.snapshot = { upToSeq: this.jseq, guilds: [...this.guilds].map(([k, v]) => [k, { master: v.master, members: v.members.slice() }]) };
      this.journal = this.journal.filter(e => e.seq > this.jseq);   // tail 만 남김(방금 upToSeq 이하 전부 가지치기 → 0)
      this.snapshots++;
    }
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
      const mem = this._normalize(p.master, p.members);
      this.guilds.set(p.guildId, { master: p.master, members: mem });
      this.creates++; this._journalChange({ kind: 'create', guildId: p.guildId, master: p.master, members: mem });
      // 배지 정확도(step-0186) — 결성 시 초기 로스터 크기를 발행(GuildFeed 가 memberCount 시드). changePublish OFF·bus 부재면 no-op(0185 동일).
      if (this.changePublish && this.bus) { this.net.send(this.addr, this.bus, { type: 'pub', topic: 'svc.guild.changed', ev: { guildId: p.guildId, kind: 'create', members: mem.slice() } }); this.published++; }
      return;
    }
    // 증분 가입(step-0182·guildJoin) — 한 멤버를 로스터에 추가(전체 덮어쓰기 대신 델타). 이미 멤버면 no-op(멱등). 미존재 길드면 graceful 무시(create 선결). 파티 0084 partyJoin 의 길드 판.
    if (p.type === 'guildJoin') {
      this.joins++;
      const g = this.guilds.get(p.guildId);
      if (g && !g.members.includes(p.member)) { g.members.push(p.member); this._publishChange(p.guildId, 'join', p.member); this._journalChange({ kind: 'join', guildId: p.guildId, member: p.member }); }
      return;
    }
    // 증분 탈퇴(step-0182·guildLeave) — 한 멤버를 로스터에서 제거(델타). 없으면 no-op(멱등). **master 보호**: master 탈퇴는 no-op(이양 0189 선결) → single-master 불변 보존. 파티 0084 partyLeave 의 길드 판.
    if (p.type === 'guildLeave') {
      this.leaves++;
      const g = this.guilds.get(p.guildId);
      if (g && p.member !== g.master && g.members.includes(p.member)) { g.members = g.members.filter(x => x !== p.member); this._publishChange(p.guildId, 'leave', p.member); this._journalChange({ kind: 'leave', guildId: p.guildId, member: p.member }); }
      return;
    }
    // 마스터 이양(step-0189·guildTransfer) — release+acquire 쌍 거래로 master 권위를 from→to 로 원자 교체. from 이 현재 master 이고 to 가 멤버일 때만 성사(아니면 거래 거부 no-op). from 은 멤버 잔류(로스터 크기 불변)·single-master 보존(공백 0·이중 0). 존 핸드오프 0006 의 마스터십 판.
    if (p.type === 'guildTransfer') {
      this.transfers++;
      const g = this.guilds.get(p.guildId);
      if (g && g.master === p.from && p.to !== p.from && g.members.includes(p.to)) {
        g.master = p.to;   // 권위 단일 소유 이동 — from 은 members 에 잔류, to 가 새 master(이미 멤버).
        if (this.changePublish && this.bus) { this.net.send(this.addr, this.bus, { type: 'pub', topic: 'svc.guild.changed', ev: { guildId: p.guildId, kind: 'transfer', member: p.to } }); this.published++; }
        this._journalChange({ kind: 'transfer', guildId: p.guildId, master: p.to });
      }
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
  // rosterConsistent(step-0190·capstone) — single-master 불변(척추 ③): 전 길드 정확히 한 master(공백 0)·master ∈ members(고아 0)·멤버 중복 0. 순수 읽기(권위 0). 모든 연산·체제서 성립해야 길드 박스가 권위 단일 소유를 보존. 거래소 0140·우편 0180 capstone 의 길드 판.
  rosterConsistent() {
    for (const g of this.guilds.values()) {
      if (g.master == null) return false;                              // 마스터 공백 0.
      if (!g.members.includes(g.master)) return false;                 // 고아 마스터 0(master ∈ members).
      if (new Set(g.members).size !== g.members.length) return false;  // 멤버 중복 0.
    }
    return true;
  }
  // crash(step-0184) — 박스 RAM 소실의 인프로세스 모델: 로스터 projection·계측만 비운다. *변경 저널은 durable* 이라 보존(파티 0085 의 길드 판).
  crash() { this.guilds = new Map(); this.creates = 0; this.joins = 0; this.leaves = 0; }
  // reconstruct(step-0184·failover) — fresh 박스가 durable 변경 저널을 seq 순 replay 해 로스터+마스터십 projection 을 재계산. create=설정·join=추가·leave=제거(master 보호 동일) → 죽기 전과 비트 동일. 자기 영속 저널만으로 복원.
  //   0185: 스냅샷이 있으면 그 로스터에서 출발해 tail(seq>upToSeq)만 replay → 스냅샷+tail == 전체 저널(무손실 압축). 스냅샷 없으면 저널 전체 replay(0184).
  reconstruct() {
    const m = new Map();
    if (this.snapshot) for (const [k, v] of this.snapshot.guilds) m.set(k, { master: v.master, members: v.members.slice() });
    const upTo = this.snapshot ? this.snapshot.upToSeq : -1;
    for (const e of this.journal.slice().sort((a, b) => a.seq - b.seq)) {
      if (e.seq <= upTo) continue;
      if (e.kind === 'create') m.set(e.guildId, { master: e.master, members: this._normalize(e.master, e.members) });
      else if (e.kind === 'join') { const g = m.get(e.guildId); if (g && !g.members.includes(e.member)) g.members.push(e.member); }
      else if (e.kind === 'leave') { const g = m.get(e.guildId); if (g && e.member !== g.master && g.members.includes(e.member)) g.members = g.members.filter(x => x !== e.member); }
      else if (e.kind === 'transfer') { const g = m.get(e.guildId); if (g && g.members.includes(e.master)) g.master = e.master; }   // step-0189 — 이양 replay(master 교체·로스터 불변).
    }
    this.guilds = m;
  }
}

const __guild = { GuildService };
if (typeof module !== 'undefined' && module.exports) module.exports = __guild;
if (typeof globalThis !== 'undefined') (globalThis.__HktNetParts = globalThis.__HktNetParts || {}).svc_guild = __guild;
