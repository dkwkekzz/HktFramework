'use strict';
// step-0081 — dedup seen 집합 유계화(deliverDedupBound·워터마크): 0080 의 수신측 dedup 은 본 seq 를 *전부* `seen` Set 에 영구 보관한다 → 귓속말이 누적될수록 메모리가 run 에 비례해 무한 성장(0080 §9). 라우터의 deliverySeq 는 *단조 증가*(producer 별 ++deliverySeq)이고, 라우터는 ack 받거나 포기하면 그 seq 를 다시 안 보낸다 — 따라서 *연속 워터마크 아래* 의 seq 는 영영 재발신 안 됨 = 안전하게 잊어도 됨. 이 step 은 그 통찰로 seen 을 유계화한다: producer(전달자 addr) 별로 ⒜ seenWm(본 *연속* 최고 seq — 이하는 전부 본 것으로 접힘) + ⒝ seenAbove(wm 초과 *비순차* seq 의 희소 집합)를 둔다. 새 seq 수신 시 seenAbove 에 넣고 wm+1 이 차 있으면 흡수하며 wm 전진(set 에서 제거) → 메모리 = O(gap)(순차 도착이면 ≈0), OFF 의 O(고유 seq)(∝run) 대비 유계. 0042 busSeenBound(inAcked 워터마크)·0047 busSeenNs(per-producer)의 *전달 dedup* 판. dedup 판정(중복=inbox 재적재 안 함)은 불변 — 메모리 표현만 유계화. deliverDedupBound OFF 면 0080 의 평면 Set(무계) = 비트 동일.
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
    this.dedupBound = opts.dedupBound || false;   // dedup seen 집합 유계화(step-0081·deliverDedupBound) — 평면 Set 대신 producer 별 연속 워터마크+희소 비순차 집합으로 메모리를 O(gap)로 유계화. OFF 면 0080 의 무계 평면 Set(비트 동일).
    this.dropAck = opts.dropAck || 0;   // ack 손실 주입(step-0080·테스트 전용) — 첫 N개 ack 을 억제(전달은 정상 수신). 라우터가 ack 못 받아 재발신→중복 유발. 0 이면 ack 손실 없음(0079 동일).
    this.ackDropped = 0;    // 억제한 ack 수(계측).
    this.seen = new Set();  // 본 seq 집합(dedup 키·0080 무계 평면 경로) — dedupBound OFF 때만 사용.
    this.seenWm = new Map();    // producer addr -> 본 *연속* 최고 seq(step-0081·유계 경로). 이하는 전부 본 것으로 접힘 → 보관 0.
    this.seenAbove = new Map(); // producer addr -> Set(wm 초과 *비순차* seq)(step-0081). 순차 도착이면 즉시 흡수돼 ≈빈 집합 → 메모리 O(gap).
    this.duplicates = 0;    // dedup 으로 걸러낸 중복 전달 수(계측).
  }
  // 본 seq 인가(dedup 판정 — 평면/유계 공통 디스패치). 유계 경로: wm 이하(접힘) 또는 seenAbove 에 있으면 본 것.
  _seenHas(prod, seq) {
    if (!this.dedupBound) return this.seen.has(seq);
    if (seq <= (this.seenWm.get(prod) || 0)) return true;
    const above = this.seenAbove.get(prod); return above ? above.has(seq) : false;
  }
  // seq 를 본 것으로 기록. 유계 경로: seenAbove 에 넣고 wm+1 이 차 있으면 연속 흡수하며 wm 전진(흡수분은 set 에서 제거 → 유계). 평면 경로: 0080 그대로 Set.add(무계).
  _seenAdd(prod, seq) {
    if (!this.dedupBound) { this.seen.add(seq); return; }
    let wm = this.seenWm.get(prod) || 0;
    if (seq <= wm) return;
    let above = this.seenAbove.get(prod);
    if (!above) { above = new Set(); this.seenAbove.set(prod, above); }
    above.add(seq);
    while (above.has(wm + 1)) { above.delete(wm + 1); wm++; }   // 연속 흡수 — 워터마크 전진하며 집합에서 제거(유계화)
    this.seenWm.set(prod, wm);
  }
  // dedup 보관 항목 수(계측·유계 증명) — 유계 경로=비순차 잔여(Σ seenAbove), 평면 경로=Set 전체(∝고유 seq).
  seenSize() {
    if (!this.dedupBound) return this.seen.size;
    let n = 0; for (const s of this.seenAbove.values()) n += s.size; return n;
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
      // dedup 키 표현은 평면 Set(0080·무계) 또는 producer 별 워터마크(0081·유계)를 _seenHas/_seenAdd 가 디스패치 — 판정은 동일, 메모리만 다름. producer = 전달자 addr(m.from).
      // producer epoch(step-0089) — p.epoch 가 실려오면(라우터 epochKeyed) (producer,epoch) 로 분리: 라우터 재시작 시 새 epoch=새 워터마크 → 리셋된 낮은 seq 오접힘 방지. epoch 없으면 producer 만(0081 동작·비트 동일).
      const prod = (p.epoch != null) ? (m.from + '#' + p.epoch) : m.from;
      if ((this.dedup || this.dedupBound) && p.seq != null && this._seenHas(prod, p.seq)) { this.duplicates++; this._ack(p); return; }
      if (p.seq != null) this._seenAdd(prod, p.seq);
      this.received++; this.inbox.push({ from: p.from, body: p.body });
      this._ack(p);
      return;
    }
  }
}

const __part = { Mailbox };
if (typeof module !== 'undefined' && module.exports) module.exports = __part;
if (typeof globalThis !== 'undefined') (globalThis.__HktNetParts = globalThis.__HktNetParts || {}).svc_mailbox = __part;
