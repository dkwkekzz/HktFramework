'use strict';
// step-0097 — 귓속말 반송 발행(bouncePublish·관측): 0082(포기)·0087(성공)·0093/0095(파티 종결) 발행은 전달 수명주기 대부분을 관측 스트림에 실었지만, *반송*(대상 down/permanent 으로 즉시 도달 불가)은 라우터 내부 카운터(bounced)에만 남아 운영 평면이 못 봤다. 이 step 은 반송을 svc.whisper.bounced{to,from,state} 로 발행 → audit 구독. 0082 failed(유계 재시도 소진 후 포기)와 달리 *즉시 도달 불가*(프레즌스가 down/permanent 판정) — 전달 결말의 셋째 종류. bouncePublish OFF·bus 부재면 발행 0 = 0096 비트 동일.
// step-0095 — 파티 complete 발행(partyCompletePublish·성공 종결 관측): 0093 은 파티 *실패* 종결(svc.party.incomplete)만 발행했다 — 0082→0087 이 개별 전달의 실패+성공 발행으로 수명주기를 완성했듯, 파티 차원에도 *성공 종결*(전원 acked)이 빠져 운영 평면이 실패 절반만 봤다(0093 §9). 이 step 은 파티가 acked(routed>0 && delivered==routed=모든 up 멤버 실수신)에 *처음* 이르면 svc.party.complete{partyId,members,routed,delivered} 를 발행 → audit 가 구독. 0087 deliveredPublish 의 파티 판·0093 incomplete 와 짝(파티 전송 발행 수명주기 완성). partyCompletePublish OFF·bus 부재면 발행 0 = 0094 비트 동일.
// step-0094 정리 분할 — WhisperRouter *코어*(클래스·constructor·파티 영수증 원장·질의 적재·restart). svc-whisper.js 가 33KB>30KB 박스 트리거를 넘겨
//   박스를 부품으로 재분할(기능 0·바이트 동일·reg 0). 큰 메시지 핸들러(onMsg·onTick)는 svc-whisper-handlers.js 가 프로토타입을 Object.assign 으로 증강(svc-inventory 분할 패턴 동일). 진입점 svc-whisper.js 가 core→handlers 순 로드.
// 역사(0071~0093 라우팅·전달 신뢰·파티 종결·관측)는 각 step-NNNN.md + reviews/ 가 SSOT — 헤더 누적 폐지.
//
// ── [게임 서비스] WhisperRouter — 귓속말/파티 *라우팅* 소비자(SPINE 계층3·5). 존 tick 밖 *순수 반응형*(onTick 은 라우터 제어 평면 timeout·권위 0).
//   클라→라우터: {type:'whisper'|'party'|'partyTo'} 요청 → 프레즌스 SSOT(queryAddr)·멤버십 SSOT(membershipAddr)에 질의(pull) → 응답(presenceReply/partyMembers)으로 라우팅(up=전달·down/permanent=반송).
//   전달 신뢰(0076~): 영수증(seq/ackTo)·재시도(deliverTimeout)·상한 포기(deliverMaxRetries)·dedup epoch 키잉(epochKeyed). 파티(0083~): partyId 별 {members,routed,bounced,delivered,failed} 원장·세 종결(done/acked/incomplete).
//   분리 이유(SPINE §2): 귓속말 팬아웃·라우팅은 존 tick 박자와 무관 — 비동기. SSOT 는 *질의*로만 소비(권위 0·은닉).
// dual-mode: Node require / 브라우저는 common.js 를 <script> 선행 로드(전역 __HktNetCommon).
const __c = (typeof module !== 'undefined' && module.exports && typeof require !== 'undefined')
  ? require('./common.js') : globalThis.__HktNetCommon;
const { Net, LoginServer, SessionRegistry, mulberry32, fnv1a, DEFAULTS } = __c;

class WhisperRouter {
  constructor(opts = {}) {
    this.receipt = opts.receipt || false;   // 전달 영수증(step-0076·whisperReceipt) — whisperDeliver 에 seq/ackTo 부착·Mailbox 의 whisperAck 로 delivered 확인. OFF 면 best-effort(routed 만·0075 동일).
    this.deliverRetry = opts.deliverRetry || false;   // 전달 손실 재시도(step-0077·whisperDeliverRetry) — onTick 이 deliverTimeout 경과한 미확인 inflight 를 재발신. OFF 면 재발신 0(0076 동일).
    this.deliverTimeout = opts.deliverTimeout || 4;   // whisperDeliver 후 whisperAck 를 기다리는 tick(이후 미확인이면 재발신). 결정론 상수.
    this.deliverMaxRetries = opts.deliverMaxRetries || 0;   // 전달 재시도 상한(step-0078·deliverMaxRetries) — 이 횟수 재발신해도 ack 없으면 포기(undeliverable). 0 이면 무상한(0077 동일).
    this.deliverNotify = opts.deliverNotify || false;   // 전달 포기 통지(step-0079·deliverNotify) — 포기 시 원 발신자에 deliveryFailed 회신. OFF 면 통지 0(0078 동일).
    this.failedPublish = opts.failedPublish || false;   // 전달 실패 발행(step-0082·failedPublish) — 포기 시 svc.whisper.failed 토픽 발행(관측/감사용). OFF·bus 부재면 발행 0(0081 동일).
    this.bus = opts.bus || null;        // 버스 주소(step-0082·발행 경로). null 이면 발행 못 함(구독자 주소 무지·은닉).
    this.deliverRetries = 0;       // 재발신한 whisperDeliver 수(step-0077·계측). 손실 복구 횟수.
    this.undeliverable = 0;        // 상한 도달로 포기한 전달 수(step-0078·계측). 영구 전달불가.
    this.failedNotified = 0;       // 발신자에 회신한 deliveryFailed 수(step-0079·계측).
    this.failedPublished = 0;      // svc.whisper.failed 로 발행한 실패 수(step-0082·계측). 관측 평면 노출.
    this.deliveredPublish = opts.deliveredPublish || false;   // 전달 성공 발행(step-0087·deliveredPublish) — whisperAck 확인 시 svc.whisper.delivered 발행(관측·수명주기 완성). OFF·bus 부재면 발행 0(0086 동일).
    this.deliveredPublished = 0;   // svc.whisper.delivered 로 발행한 성공 수(step-0087·계측). 0082 failed 와 짝.
    this.epochKeyed = opts.epochKeyed || false;   // producer epoch 워터마크(step-0089·epochKeyed) — whisperDeliver 에 epoch 부착·재시작 안전. OFF 면 epoch 미부착(0081 동작·0088 비트 동일).
    this.epoch = 0;               // 라우터 epoch(step-0089) — restart() 마다 ++. 재시작 전후 seq 공간을 (producer,epoch)로 분리하는 펜싱 토큰.
    this.restarts = 0;            // 재시작 수(step-0089·계측).
    this.deliverySeq = 0;          // 전달 시퀀스(step-0076) — whisperDeliver 마다 증가하는 영수증 상관키.
    this.inflight = new Map();     // seq -> {to, from, body, at} — 전달했으나 아직 whisperAck 못 받은 보류 전달(routed-delivered·at=마지막 발신 tick).
    this.delivered = 0;            // whisperAck 로 *확인된* 전달 수(step-0076). routed ⊇ delivered, 차이 = inflight.size.
    this.acksRecv = 0;             // 받은 whisperAck 수(계측·중복 ack 무시 후에도 카운트).
    this.retry = opts.retry || false;   // 재타깃 윈도 질의 재시도(step-0074·whisperRetry) — 재타깃 시 보류 질의 재발신. OFF 면 재발신 0(0073 동일).
    this.membershipAddr = opts.membershipAddr || null;   // 파티 멤버십 SSOT 박스 주소(step-0075·PartyService). null 이면 partyTo 미해소(0074 동일).
    this.queryAddr = opts.queryAddr || null;   // 프레즌스 SSOT 박스 주소(명시 의존·request/reply 경로·0069 인터페이스). null 이면 질의 못 함→전부 보류.
    this.pending = new Map();     // consumer -> [{from, body}] — presenceReply 대기 중인 귓속말(질의↔응답 상관: consumer 키로 묶음).
    this.queriesSent = 0;         // 보낸 presenceQuery 수(계측). repliesRecv = 받은 응답 수(1:1 = 무손실 읽기).
    this.repliesRecv = 0;
    this.routed = 0;              // 전달한 귓속말 수(대상 up·whisperDeliver 발신). bounced = 반송 수(대상 down/permanent).
    this.bounced = 0;
    this.decisions = new Map();   // consumer -> 'routed'|'bounced' — 대상별 최신 라우팅 판정(대시보드·검증 대조).
    this.retargets = 0;           // active 재타깃 수(step-0072·svc.presence.active 공지 수신 — failover 시 1). 미구독이면 0(0071 동일).
    this.activeEpoch = -1;        // 본 최고 active 공지 epoch(step-0106·announceEpoch 펜싱) — 이하 공지는 메아리로 거부(역-재타깃·재시도 폭주 방지). epoch 없으면 0072 무조건 재타깃.
    this.staleAnnounces = 0;      // epoch 펜싱으로 거부한 낡은/메아리 공지 수(step-0106·계측·0105 presmon 펜싱의 라우터 판).
    this.parties = 0;             // 받은 파티 요청 수(step-0073·1:N 팬아웃 계측). 멤버 수만큼 질의로 전개.
    this.retries = 0;             // 재타깃 시 재발신한 보류 질의 수(step-0074·whisperRetry 계측). 윈도 손실 복구.
    this.partyPending = new Map(); // partyId -> {from, body} — partyMembers 응답 대기 중인 파티 전송 요청(step-0075·멤버십 조회 보류).
    this.membershipQueries = 0;   // 보낸 partyQuery 수(step-0075·멤버십 SSOT 조회 계측). membersResolved = 응답으로 받은 멤버 누적.
    this.membersResolved = 0;
    this.partyReceipt = opts.partyReceipt || false;   // 파티 1:N 라우팅 영수증 집계(step-0083·partyReceipt) — partyId 별 {members,routed,bounced} 원장. OFF 면 집계 0(0082 동일).
    this.partyReceipts = new Map();   // partyId -> {members, routed, bounced} — 파티 전송 완료 원장(routed+bounced==members 면 완료). 부분 전달 가시.
    this.partyAckGiveup = opts.partyAckGiveup || false;   // 파티 ack 타임아웃 포기(step-0092·partyAckGiveup) — 멤버 전달이 deliverMaxRetries 로 포기되면 그 파티 failed++ → partyIncomplete 종결. OFF 면 포기를 파티에 귀속 안 함(0091 동일·undeliverable 자체는 0078 불변).
    this.partyGiveups = 0;   // 파티에 귀속된 멤버 전달 포기 수(step-0092·계측).
    this.partyIncompletePublish = opts.partyIncompletePublish || false;   // 파티 incomplete 발행(step-0093·partyIncompletePublish) — 파티가 부분 전달 종결에 이르면 svc.party.incomplete 발행(관측). OFF·bus 부재면 발행 0(0092 동일).
    this.partyIncompletePublished = 0;   // svc.party.incomplete 로 발행한 파티 수(step-0093·계측). 0082 failed·0087 delivered 의 파티 판.
    this._incPub = new Set();   // 이미 incomplete 발행한 partyId(중복 발행 방지·종결은 1회).
    this.partyCompletePublish = opts.partyCompletePublish || false;   // 파티 complete 발행(step-0095·partyCompletePublish) — 파티가 전원 acked 에 이르면 svc.party.complete 발행(성공 종결 관측). OFF·bus 부재면 발행 0(0094 동일).
    this.partyCompletePublished = 0;   // svc.party.complete 로 발행한 파티 수(step-0095·계측). 0093 incomplete 와 짝.
    this._completePub = new Set();   // 이미 complete 발행한 partyId(중복 발행 방지·종결은 1회).
    this.bouncePublish = opts.bouncePublish || false;   // 귓속말 반송 발행(step-0097·bouncePublish) — 대상 down/permanent 반송을 svc.whisper.bounced 발행(관측). OFF·bus 부재면 발행 0(0096 동일).
    this.bouncePublished = 0;   // svc.whisper.bounced 로 발행한 반송 수(step-0097·계측). 0082 failed·0087 delivered 와 같은 관측 평면.
  }
  // 파티 영수증 원장 열기(step-0083) — 파티 수신 시 멤버 수로 초기화. partyReceipt OFF 면 no-op(집계 0·0082 동일).
  _partyOpen(partyId, n) { if (this.partyReceipt && partyId != null) this.partyReceipts.set(partyId, { members: n, routed: 0, bounced: 0, delivered: 0, failed: 0 }); }   // 0088: delivered(실수신 ack)·0092: failed(포기) 추가
  // 파티 영수증 집계(step-0083) — 멤버 라우팅 판정을 그 파티에 더한다(up=routed·아니면 bounced). 파티 전송 아니면(party null) no-op.
  _partyTally(partyId, deliverable) { if (!this.partyReceipt || partyId == null) return; const r = this.partyReceipts.get(partyId); if (r) { if (deliverable) r.routed++; else r.bounced++; } }
  // 파티 ack 집계(step-0088) — whisperAck 확인 시 그 전달이 속한 파티의 delivered 증가(실수신 확인). 파티 전송 아니면 no-op. routed(결정)≥delivered(확인).
  _partyAck(partyId) { if (!this.partyReceipt || partyId == null) return; const r = this.partyReceipts.get(partyId); if (r) r.delivered++; }
  // 파티 ack 포기 귀속(step-0092) — 멤버 전달이 영구 포기(0078 deliverMaxRetries)되면 그 파티 failed++. partyAckGiveup OFF·파티 아니면 no-op(0091 동일).
  _partyFail(partyId) { if (!this.partyAckGiveup || !this.partyReceipt || partyId == null) return; const r = this.partyReceipts.get(partyId); if (r) { r.failed++; this.partyGiveups++; } }
  partyDone(partyId) { const r = this.partyReceipts.get(partyId); return r ? (r.routed + r.bounced === r.members) : false; }   // 라우팅 결정 완료(0083)
  partyAcked(partyId) { const r = this.partyReceipts.get(partyId); return r ? (r.routed > 0 && r.delivered === r.routed) : false; }   // 실수신 완료(0088) — 모든 up 멤버가 ack
  // 파티 N-of-M 종결(step-0092·partyIncomplete) — 라우팅 결정 완료 + 모든 routed 멤버가 ack(delivered) 또는 포기(failed)로 귀결 + 실패 1↑. acked 도 incomplete 도 아닌 영구 보류를 제거(0078 포기의 파티 판).
  partyIncomplete(partyId) { const r = this.partyReceipts.get(partyId); return r ? (r.routed + r.bounced === r.members && r.delivered + r.failed === r.routed && r.failed > 0) : false; }
  pendingCount() { let n = 0; for (const arr of this.pending.values()) n += arr.length; return n; }
  // 한 대상에 귓속말 1건을 적재+질의(귓속말·파티 멤버 공통 경로). 응답 올 때까지 pending[to] 보류·queryAddr 로 presenceQuery. party(step-0083): 파티 전송이면 partyId 를 보류 엔트리에 실어 라우팅 판정을 파티에 귀속.
  _queryFor(to, from, body, party) {
    const arr = this.pending.get(to) || []; arr.push({ from, body, party }); this.pending.set(to, arr);
    if (this.queryAddr) { this.net.send(this.addr, this.queryAddr, { type: 'presenceQuery', consumer: to }); this.queriesSent++; }
  }
  // restart(step-0089) — 라우터 재시작(crash→fresh)의 인프로세스 모델: deliverySeq 0 리셋·inflight 비움·epoch++. epoch 펜싱이 재시작 전후 seq 공간을 분리해 수신측 워터마크 오접힘을 막는다(0013/0048 epoch 펜싱의 전달 판). epochKeyed OFF 면 epoch 는 올라도 미부착이라 워터마크가 producer 만으로 키잉 → 재시작 후 낮은 seq 오접힘(버그 대조).
  restart() { this.deliverySeq = 0; this.inflight = new Map(); this.epoch++; this.restarts++; }
  decisionOf(consumer) { return this.decisions.get(consumer) || null; }
}

const __part = { WhisperRouter };
if (typeof module !== 'undefined' && module.exports) module.exports = __part;
if (typeof globalThis !== 'undefined') (globalThis.__HktNetParts = globalThis.__HktNetParts || {}).svc_whisper_core = __part;
