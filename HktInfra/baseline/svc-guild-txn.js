'use strict';
// step-0265 정리 분할(#49 인접·선제) — svc-guild.js 가 29.5KB(30KB 근접·성장 박스)라, GuildService 의 *트랜잭션 핸들러*(onMsg:
//   guildCreate/Join/Leave/Transfer/Deposit/Withdraw/Query)를 svc-guild-txn.js 믹스인으로 분리한다. 코어가 Object.assign(prototype) 로 되섞음 —
//   정의 위치만 이동·this 바인딩/메서드 해소 동일·기능 0 → reg 0(0264 비트 동일). 0124 svc-exchange-txn·0264 svc-exchange-persist 와 같은 패턴.
// dual-mode: Node require / 브라우저는 <script> 선행 로드(전역 __HktNetParts.svc_guild_txn).
const GuildTxn = {
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
    // 길드 금고 예치(step-0191·guildDeposit) — 멤버가 아이템을 길드 공유 원장(vault)에 예치. bank OFF 면 무시(0190 비트 동일). 미존재 길드·비멤버면 graceful no-op(로스터 선결·은닉). 이미 vault 에 있으면 멱등 no-op(집합 의미론). 거래소 0117 list leg·우편 0157 mailItem 의 조직 공유 판.
    if (p.type === 'guildDeposit') {
      if (!this.bank) return;
      this.deposits++;
      const g = this.guilds.get(p.guildId);
      if (g && g.members.includes(p.member)) {
        const v = this.vault.get(p.guildId) || [];
        if (!v.includes(p.itemId)) { v.push(p.itemId); this.vault.set(p.guildId, v); this._publishBank(p.guildId, 'deposit', p.itemId, p.member); this._journalChange({ kind: 'deposit', guildId: p.guildId, itemId: p.itemId }); this._custody(p.itemId, p.member, 'escrow', { kind: 'deposit', guildId: p.guildId }); }   // 권위 단일 소유: itemId 는 길드 금고 1곳에만(중복 0). 실 변경 발행(0193)·저널(0194)·escrow 인출 leg(0511·멤버 가방→escrow·invMode ON 일 때만).
      }
      return;
    }
    // 길드 금고 인출(step-0192·guildWithdraw) — 멤버가 길드 금고에서 아이템을 꺼냄. bank OFF 면 무시(0191 비트 동일). 멤버이고 금고에 그 itemId 가 있을 때만 제거(비멤버·없는 itemId·미존재 길드면 멱등 graceful no-op). 거래소 buy leg 0118·우편 fetch 0158 의 길드 금고 판.
    if (p.type === 'guildWithdraw') {
      if (!this.bank) return;
      this.withdraws++;
      const g = this.guilds.get(p.guildId);
      const v = this.vault.get(p.guildId);
      if (g && g.members.includes(p.member) && v && v.includes(p.itemId)) {
        this.vault.set(p.guildId, v.filter(x => x !== p.itemId)); this._publishBank(p.guildId, 'withdraw', p.itemId, p.member); this._journalChange({ kind: 'withdraw', guildId: p.guildId, itemId: p.itemId });   // 권위 단일 소유: itemId 가 금고를 떠남(이중쓰기 0). 실 변경 발행(0193)·저널(0194).
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
  },
};

const __part = { GuildTxn };
if (typeof module !== 'undefined' && module.exports) module.exports = __part;
if (typeof globalThis !== 'undefined') (globalThis.__HktNetParts = globalThis.__HktNetParts || {}).svc_guild_txn = __part;

