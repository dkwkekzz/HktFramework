'use strict';
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
  }
  // 멤버십 변경 발행(step-0084) — 가입/탈퇴 델타를 svc.party.changed 로. changePublish OFF·bus 부재면 no-op(0083 동일). 실제 변경이 일어났을 때만 호출(no-op 변경은 발행 안 함).
  _publishChange(partyId, kind, member) {
    if (!(this.changePublish && this.bus)) return;
    this.net.send(this.addr, this.bus, { type: 'pub', topic: 'svc.party.changed', ev: { partyId, kind, member } }); this.published++;
  }
  onMsg(m) {
    const p = m.payload;
    // 파티 결성/갱신(멤버십 SSOT 쓰기) — partyId 의 멤버 목록을 설정. 같은 partyId 재-create 면 덮어씀(가입/탈퇴 반영의 단순 모델).
    if (p.type === 'partyCreate') { this.parties.set(p.partyId, (p.members || []).slice()); this.creates++; return; }
    // 증분 가입(step-0084·partyJoin) — 한 멤버를 파티에 추가(전체 목록 덮어쓰기 대신 델타). 미존재 파티면 새로 연다. 이미 있으면 no-op(중복 가입 무시·발행 안 함·멱등). 변경 시 svc.party.changed 발행.
    if (p.type === 'partyJoin') {
      const arr = this.parties.get(p.partyId) || []; this.joins++;
      if (!arr.includes(p.member)) { arr.push(p.member); this.parties.set(p.partyId, arr); this._publishChange(p.partyId, 'join', p.member); }
      return;
    }
    // 증분 탈퇴(step-0084·partyLeave) — 한 멤버를 파티에서 제거(델타). 없으면 no-op(발행 안 함·멱등). 변경 시 발행.
    if (p.type === 'partyLeave') {
      const arr = this.parties.get(p.partyId); this.leaves++;
      if (arr && arr.includes(p.member)) { this.parties.set(p.partyId, arr.filter(x => x !== p.member)); this._publishChange(p.partyId, 'leave', p.member); }
      return;
    }
    // 멤버십 질의(읽기·request/reply) — 라우터가 파티 전송 전에 멤버 목록을 묻는다. 미존재 파티면 빈 목록(graceful). 응답을 m.from 으로 회신.
    if (p.type === 'partyQuery') { this.queriesRx++; this.net.send(this.addr, m.from, { type: 'partyMembers', partyId: p.partyId, members: this.parties.get(p.partyId) || [] }); this.repliesSent++; return; }
  }
  membersOf(partyId) { return this.parties.get(partyId) || []; }
}

const __part = { PartyService };
if (typeof module !== 'undefined' && module.exports) module.exports = __part;
if (typeof globalThis !== 'undefined') (globalThis.__HktNetParts = globalThis.__HktNetParts || {}).svc_party = __part;
