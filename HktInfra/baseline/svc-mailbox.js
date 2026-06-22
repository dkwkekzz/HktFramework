'use strict';
// step-0080 — 수신측 dedup(exactly-once): 0077 의 at-least-once 재시도는 *영수증(ack)이 손실*되면 라우터가 *이미 받은 전달*도 재발신한다 → Mailbox 가 같은 귓속말을 두 번 적재(중복·0077 §9). 이 step 은 수신측을 멱등화한다 — Mailbox 가 seq 를 기억(seen)해, 중복 whisperDeliver(이미 본 seq)는 inbox 에 *재적재하지 않고*(duplicates++) ack 만 재회신(라우터 inflight 정리). 0026 id-reconciliation(belief 로 중복 mint 차단)의 *전달* 판 — at-least-once 전송 + 수신측 dedup = exactly-once *처리*. 손실 주입 dropAck(첫 N개 ack 억제·전달은 정상 수신)로 중복을 유발. dedup OFF 면 중복 적재(0079 동작·received 2).
// step-0077 — 전달 손실 재시도(whisperDeliverRetry) 대조용 손실 주입 dropDeliver 추가: 첫 N개 whisperDeliver 를 떨궈(수신·ack 0) 라우터의 재발신(deliverTimeout 후)이 손실에도 delivered 로 수렴함을 보인다. dropDeliver 0 = 0076 동일.
// step-0076 — 전달 영수증(whisperReceipt) 수신측 박스 Mailbox: 0071~0075 의 라우터는 라우팅 *결정*(up 전달·down 반송)까지만 견고했고, whisperDeliver 자체는 best-effort 였다 — 보낸 순간 routed++ 로 세고 *대상이 실제로 받았는지*는 확인 안 했다(0075 §9). 이 step 은 전달의 *수신 확인 고리*를 더한다: 라우터가 whisperDeliver 에 {seq, ackTo} 를 실어 보내면, 수신측 Mailbox 가 받아 inbox 에 적재하고 ackTo(라우터)로 whisperAck{seq} 를 회신한다 → 라우터가 delivered(확인) 를 센다. 0057 recoverAck(치유 확인 고리)의 *전달* 판. whisperReceipt OFF 면 이 박스 부재·ackTo 없음 = 0075 비트 동일.
// dual-mode: Node require / 브라우저는 common.js 를 <script> 선행 로드(전역 __HktNetCommon).
const __c = (typeof module !== 'undefined' && module.exports && typeof require !== 'undefined')
  ? require('./common.js') : globalThis.__HktNetCommon;
const { Net, LoginServer, SessionRegistry, mulberry32, fnv1a, DEFAULTS } = __c;

// ── [게임 서비스] Mailbox — 귓속말 *수신측* 박스(SPINE 계층3 채팅/소셜). 존 tick 밖 *순수 반응형*(onTick 없음·권위=수신함만). ──
//   whisperDeliver{from, body, seq, ackTo} 수신 → inbox 적재(received++) + ackTo 가 있으면 whisperAck{seq} 회신(전달 영수증). ackTo 없으면(0075 이전 best-effort) 적재만(ack 0).
//   분리 이유(SPINE §2 판정): 귓속말 수신·확인은 존 tick 박자와 무관 — 비동기. 라우터(WhisperRouter)와는 명시 메시지 계약(whisperDeliver/whisperAck)만 공유(은닉). 0069 프레즌스·0075 멤버십과 같은 request/reply 패턴의 *전달 확인* 판.
class Mailbox {
  constructor(opts = {}) {
    this.inbox = [];        // 받은 귓속말 [{from, body}] — 수신함.
    this.received = 0;      // 받은 whisperDeliver 수(계측).
    this.acks = 0;          // 회신한 whisperAck 수(계측·ackTo 있을 때만).
    this.dropDeliver = opts.dropDeliver || 0;   // 전달 손실 주입(step-0077·테스트 전용) — 첫 N개 whisperDeliver 를 조용히 떨군다(수신·ack 0). 라우터의 재시도(deliverRetry)가 손실에도 수렴함을 보이는 대조. 0 이면 손실 없음(0076 동일).
    this.dropped = 0;       // 떨군 전달 수(계측).
    this.dedup = opts.dedup || false;   // 수신측 dedup(step-0080·exactly-once) — seq 기억으로 중복 whisperDeliver 를 inbox 재적재 안 함. OFF 면 중복 적재(0079 동작).
    this.dropAck = opts.dropAck || 0;   // ack 손실 주입(step-0080·테스트 전용) — 첫 N개 ack 을 억제(전달은 정상 수신). 라우터가 ack 못 받아 재발신→중복 유발. 0 이면 ack 손실 없음(0079 동일).
    this.ackDropped = 0;    // 억제한 ack 수(계측).
    this.seen = new Set();  // 본 seq 집합(dedup 키) — 중복 판정.
    this.duplicates = 0;    // dedup 으로 걸러낸 중복 전달 수(계측).
  }
  // ack 회신(전달 영수증) — dropAck 주입 시 첫 N개는 억제(전달은 받되 ack 만 분실 → 라우터 재발신→중복 유발). 그 후 정상 회신.
  _ack(p) {
    if (!(p.ackTo && p.seq != null)) return;
    if (this.ackDropped < this.dropAck) { this.ackDropped++; return; }   // ack 손실 주입(첫 N개 억제)
    this.net.send(this.addr, p.ackTo, { type: 'whisperAck', seq: p.seq }); this.acks++;
  }
  onMsg(m) {
    const p = m.payload;
    // 귓속말 전달 수신 — 적재 후 ackTo(라우터)로 영수증 회신. ackTo/seq 없으면(best-effort·0075 이하) 적재만(ack 미발신 = 영수증 없는 전달의 대조).
    if (p.type === 'whisperDeliver') {
      // 손실 주입(step-0077) — 첫 dropDeliver 개는 떨군다(수신·ack 0). 라우터가 ack 못 받아 deliverTimeout 후 재발신 → 손실 소진 후 도달·확인.
      if (this.dropped < this.dropDeliver) { this.dropped++; return; }
      // 수신측 dedup(step-0080·exactly-once) — 이미 본 seq 면 중복: inbox 재적재 안 함(멱등). 단 ack 은 재회신해 라우터 inflight 를 정리(at-least-once 전송 + 수신측 멱등 = exactly-once 처리). dedup OFF 면 이 분기 없이 중복도 적재(0079).
      if (this.dedup && p.seq != null && this.seen.has(p.seq)) { this.duplicates++; this._ack(p); return; }
      if (p.seq != null) this.seen.add(p.seq);
      this.received++; this.inbox.push({ from: p.from, body: p.body });
      this._ack(p);
      return;
    }
  }
}

const __part = { Mailbox };
if (typeof module !== 'undefined' && module.exports) module.exports = __part;
if (typeof globalThis !== 'undefined') (globalThis.__HktNetParts = globalThis.__HktNetParts || {}).svc_mailbox = __part;
