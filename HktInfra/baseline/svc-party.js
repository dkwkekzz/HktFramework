'use strict';
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
  }
  onMsg(m) {
    const p = m.payload;
    // 파티 결성/갱신(멤버십 SSOT 쓰기) — partyId 의 멤버 목록을 설정. 같은 partyId 재-create 면 덮어씀(가입/탈퇴 반영의 단순 모델).
    if (p.type === 'partyCreate') { this.parties.set(p.partyId, (p.members || []).slice()); this.creates++; return; }
    // 멤버십 질의(읽기·request/reply) — 라우터가 파티 전송 전에 멤버 목록을 묻는다. 미존재 파티면 빈 목록(graceful). 응답을 m.from 으로 회신.
    if (p.type === 'partyQuery') { this.queriesRx++; this.net.send(this.addr, m.from, { type: 'partyMembers', partyId: p.partyId, members: this.parties.get(p.partyId) || [] }); this.repliesSent++; return; }
  }
  membersOf(partyId) { return this.parties.get(partyId) || []; }
}

const __part = { PartyService };
if (typeof module !== 'undefined' && module.exports) module.exports = __part;
if (typeof globalThis !== 'undefined') (globalThis.__HktNetParts = globalThis.__HktNetParts || {}).svc_party = __part;
