'use strict';
// step-0086 — 파티 저널 스냅샷 압축(partySnapshot·snapshot+tail replay): 0085 의 변경 저널은 *무계 성장*이라 가입/탈퇴가 누적될수록 replay 비용·메모리가 ∝변경 수다(0085 §9). 0018 가방·0022 채팅이 *주기 스냅샷+tail replay* 로 푼 압축을 멤버십 저널에 적용한다: snapInterval 개 변경마다 현재 멤버십 projection 을 스냅샷(upToSeq 기록)하고 그 이하 저널을 가지치기 → 저널은 *마지막 스냅샷 이후 tail* 만 보관(유계). reconstruct 는 스냅샷에서 출발해 tail(seq>upToSeq)만 replay → 전체 저널 replay 와 비트 동일(무손실 압축). 스냅샷+tail == 전체 저널 == 죽기 전. partySnapshot(snapInterval 0) 면 압축 0·저널 무계 = 0085 비트 동일.
// step-0085 — 파티 멤버십 영속·failover(partyPersist·변경 저널 replay): 0084 까지 PartyService 의 멤버십은 *휘발*(in-memory)이라 박스 crash 시 결성·가입/탈퇴가 전부 소실됐다(영속 0·0084 §9). 0017 가방·0020 랭킹·0021 채팅이 event sourcing(효과/커맨드 저널 replay)으로 푼 것을 *멤버십*에 적용한다: 멤버십을 바꾸는 명령(create/join/leave)을 *변경 저널*(durable)에 추가하고, crash(RAM 소실) 후 fresh PartyService 가 그 저널을 replay 해 멤버십 projection 을 재구성한다 → 죽기 전과 비트 동일. 멤버십(projection)은 휘발, 저널은 durable(0084 svc.party.changed 스트림이 곧 이 저널의 이벤트). partyPersist OFF 면 저널 0·crash 후 reconstruct 해도 빈 멤버십(소실) = 0084 비트 동일(저널 미기록·휴면).
// step-0084 — 증분 가입/탈퇴 + 멤버십 변경 발행(partyChange·svc.party.changed): 0075 의 PartyService 는 멤버십을 partyCreate(*전체 목록 덮어쓰기*)로만 갱신했다 — 한 명 가입/탈퇴에도 전체 목록을 다시 보내야 하고, 변경이 *관측 불가*(누가 언제 들고 났는지 스트림 없음·0075 §9). 실제 길드/파티는 증분 변경(가입·탈퇴)이 잦고, 그 변경을 다른 시스템(채팅 채널·랭킹·감사)이 구독해야 한다. 이 step 은 ⒜ 증분 변경 명령 partyJoin/partyLeave(전체 목록 대신 한 멤버 델타) ⒝ 변경 발행(svc.party.changed{partyId,kind,member}→audit 관측)을 더한다. 0082 failedPublish(전달 실패 발행)·0060 presencePublish 의 *멤버십 변경* 판 — 상태 변경을 버스로 노출해 발행자 무수정 소비자가 반응. partyChange OFF·증분 명령 미주입이면 발행 0·멤버십 partyCreate 만 = 0083 비트 동일.
// step-0075 — 파티 멤버십 SSOT(partyService): 0073 의 파티 라우터는 멤버 목록을 요청에 *인라인*으로 받았다 — 누가 어느 파티인가(멤버십)와 그 파티에 어떻게 전달하나(라우팅)가 한 요청에 섞여 있었다. 실제 길드/파티는 멤버십이 *오래 사는 상태*(결성·가입·탈퇴)다. 이 step 은 멤버십을 전용 박스 PartyService 로 분리한다: 클라가 파티를 결성(partyCreate)하면 PartyService 가 멤버십 SSOT 를 보유하고, 라우터는 파티 전송 시 멤버 목록을 *질의*(partyQuery→partyMembers)로 얻는다 → 멤버십 SSOT(이 박스)→프레즌스 SSOT(0069)→라우팅 의 2단 조회. 멤버십 ⟂ 라우팅 관심사 분리(SPINE 계층3 길드/소셜). partyService OFF 면 박스 0 = 0074 비트 동일.
// dual-mode: Node require / 브라우저는 common.js 를 <script> 선행 로드(전역 __HktNetCommon).
const __c = (typeof module !== 'undefined' && module.exports && typeof require !== 'undefined')
  ? require('./common.js') : globalThis.__HktNetCommon;
const { Net, LoginServer, SessionRegistry, mulberry32, fnv1a, DEFAULTS } = __c;

// ── [게임 서비스] PartyService — 파티/길드 *멤버십*의 SSOT(SPINE 계층3 길드/소셜). 존 tick 밖 *순수 반응형*(onTick 없음·권위=멤버십만). ──
//   partyCreate: 파티 결성/갱신({partyId, members}) → 멤버십 SSOT 갱신. partyQuery: 라우터가 멤버 목록을 질의(request/reply·SPINE §4 경로3) → partyMembers 회신.
//   분리 이유(SPINE §2 판정): 멤버십(누가 어느 파티)은 *오래 사는 게임 상태*로 존 tick 박자와 무관 — 비동기 서비스. 라우터(WhisperRouter)는 멤버십을 *질의*로만 소비(멤버십 권위 0·은닉: 라우터는 멤버십 저장 방식을 모르고 질의 계약만). 0069 프레즌스 SSOT 와 같은 패턴의 *멤버십* 판.
class PartyService {
  constructor(opts = {}) {
    this.parties = new Map();     // partyId -> [member...] (멤버십 SSOT — 오래 사는 상태).
    this.creates = 0;             // 처리한 partyCreate 수(계측).
    this.queriesRx = 0;           // 받은 partyQuery 수(계측). repliesSent = 보낸 응답 수(1:1).
    this.repliesSent = 0;
    this.changePublish = opts.changePublish || false;   // 멤버십 변경 발행(step-0084·partyChange) — 가입/탈퇴를 svc.party.changed 로 발행. OFF·bus 부재면 발행 0(0083 동일).
    this.bus = opts.bus || null;        // 변경 발행 경로(구독자 주소 무지·은닉). null 이면 발행 못 함.
    this.joins = 0;               // 처리한 partyJoin 수(step-0084·증분 가입 계측).
    this.leaves = 0;              // 처리한 partyLeave 수(step-0084·증분 탈퇴 계측).
    this.published = 0;           // svc.party.changed 발행 수(step-0084·계측). 변경 수와 1:1(실제 변경 시만).
    this.persist = opts.persist || false;   // 멤버십 영속(step-0085·partyPersist) — 변경 명령을 durable 저널에 기록·crash 후 replay 로 재구성. OFF 면 저널 0(0084 동일·휘발).
    this.journal = [];            // durable 변경 저널 [{seq, kind, partyId, member|members}] — projection(parties)과 분리(crash 시 parties 만 소실·저널은 영속). 0084 svc.party.changed 의 영속 판.
    this.jseq = 0;                // 저널 시퀀스(단조).
    this.snapInterval = opts.snapInterval || 0;   // 저널 스냅샷 압축(step-0086·partySnapshot) — 이 개수 변경마다 멤버십 스냅샷+저널 가지치기. 0 이면 압축 0(0085 동일·무계 저널).
    this.snapshot = null;         // {upToSeq, parties:[[partyId,[member...]]...]} — 마지막 압축 스냅샷(이하 저널은 가지쳐짐). reconstruct 의 출발점.
    this.snapshots = 0;           // 찍은 스냅샷 수(step-0086·계측).
  }
  // 변경 저널 추가(step-0085) — 멤버십 변경 명령을 durable 저널에 append. persist OFF 면 no-op(0084 동일). 실제 변경 시에만 호출(no-op 변경은 저널 안 함 = 발행과 동일 의미론). 0086: snapInterval 도달 시 압축.
  _journalChange(entry) {
    if (!this.persist) return;
    this.journal.push({ seq: ++this.jseq, ...entry });
    // 스냅샷 압축(step-0086) — tail 길이가 snapInterval 에 도달하면 현재 멤버십을 스냅샷(upToSeq=jseq)하고 그 이하 저널 가지치기. 저널은 마지막 스냅샷 이후 tail 만 보관(유계). snapInterval 0 면 미발화(0085 동일).
    if (this.snapInterval > 0 && this.journal.length >= this.snapInterval) {
      this.snapshot = { upToSeq: this.jseq, parties: [...this.parties].map(([k, v]) => [k, v.slice()]) };
      this.journal = this.journal.filter(e => e.seq > this.jseq);   // tail 만 남김(방금 upToSeq 이하 전부 가지치기 → 0)
      this.snapshots++;
    }
  }
  // 멤버십 변경 발행(step-0084) — 가입/탈퇴 델타를 svc.party.changed 로. changePublish OFF·bus 부재면 no-op(0083 동일). 실제 변경이 일어났을 때만 호출(no-op 변경은 발행 안 함).
  _publishChange(partyId, kind, member) {
    if (!(this.changePublish && this.bus)) return;
    this.net.send(this.addr, this.bus, { type: 'pub', topic: 'svc.party.changed', ev: { partyId, kind, member } }); this.published++;
  }
  onMsg(m) {
    const p = m.payload;
    // 파티 결성/갱신(멤버십 SSOT 쓰기) — partyId 의 멤버 목록을 설정. 같은 partyId 재-create 면 덮어씀(가입/탈퇴 반영의 단순 모델).
    if (p.type === 'partyCreate') { this.parties.set(p.partyId, (p.members || []).slice()); this.creates++; this._journalChange({ kind: 'create', partyId: p.partyId, members: (p.members || []).slice() }); return; }
    // 증분 가입(step-0084·partyJoin) — 한 멤버를 파티에 추가(전체 목록 덮어쓰기 대신 델타). 미존재 파티면 새로 연다. 이미 있으면 no-op(중복 가입 무시·발행 안 함·멱등). 변경 시 svc.party.changed 발행.
    if (p.type === 'partyJoin') {
      const arr = this.parties.get(p.partyId) || []; this.joins++;
      if (!arr.includes(p.member)) { arr.push(p.member); this.parties.set(p.partyId, arr); this._publishChange(p.partyId, 'join', p.member); this._journalChange({ kind: 'join', partyId: p.partyId, member: p.member }); }
      return;
    }
    // 증분 탈퇴(step-0084·partyLeave) — 한 멤버를 파티에서 제거(델타). 없으면 no-op(발행 안 함·멱등). 변경 시 발행.
    if (p.type === 'partyLeave') {
      const arr = this.parties.get(p.partyId); this.leaves++;
      if (arr && arr.includes(p.member)) { this.parties.set(p.partyId, arr.filter(x => x !== p.member)); this._publishChange(p.partyId, 'leave', p.member); this._journalChange({ kind: 'leave', partyId: p.partyId, member: p.member }); }
      return;
    }
    // 멤버십 질의(읽기·request/reply) — 라우터가 파티 전송 전에 멤버 목록을 묻는다. 미존재 파티면 빈 목록(graceful). 응답을 m.from 으로 회신.
    if (p.type === 'partyQuery') { this.queriesRx++; this.net.send(this.addr, m.from, { type: 'partyMembers', partyId: p.partyId, members: this.parties.get(p.partyId) || [] }); this.repliesSent++; return; }
  }
  membersOf(partyId) { return this.parties.get(partyId) || []; }
  // crash(step-0085) — 박스 RAM 소실의 인프로세스 모델: 멤버십 projection 만 비운다. *변경 저널은 durable* 이라 보존(0084 svc.party.changed 의 영속 판). 계측도 비움(소비 회계 = projection 의 일부).
  crash() { this.parties = new Map(); this.creates = 0; this.joins = 0; this.leaves = 0; }
  // reconstruct(step-0085·failover) — fresh 박스가 durable 변경 저널을 seq 순 replay 해 멤버십 projection 을 재계산. create=목록 설정·join=추가·leave=제거 (onMsg 멤버십 변경과 정확히 같은 매핑) → 죽기 전과 비트 동일. 자기 영속 저널만으로 멤버십 복원(0020 ranking 의 멤버십 판).
  //   0086: 스냅샷이 있으면 그 멤버십에서 출발해 tail(seq>upToSeq)만 replay → 스냅샷+tail == 전체 저널(무손실 압축). 스냅샷 없으면 저널 전체 replay(0085).
  reconstruct() {
    const m = new Map();
    if (this.snapshot) for (const [k, v] of this.snapshot.parties) m.set(k, v.slice());
    const upTo = this.snapshot ? this.snapshot.upToSeq : -1;
    for (const e of this.journal.slice().sort((a, b) => a.seq - b.seq)) {
      if (e.seq <= upTo) continue;
      if (e.kind === 'create') m.set(e.partyId, (e.members || []).slice());
      else if (e.kind === 'join') { const arr = m.get(e.partyId) || []; if (!arr.includes(e.member)) { arr.push(e.member); m.set(e.partyId, arr); } }
      else if (e.kind === 'leave') { const arr = m.get(e.partyId); if (arr) m.set(e.partyId, arr.filter(x => x !== e.member)); }
    }
    this.parties = m;
  }
}

const __part = { PartyService };
if (typeof module !== 'undefined' && module.exports) module.exports = __part;
if (typeof globalThis !== 'undefined') (globalThis.__HktNetParts = globalThis.__HktNetParts || {}).svc_party = __part;
