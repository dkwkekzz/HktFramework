'use strict';
// step-0102 — 미확인 체크아웃 유계화(checkoutBound·읽음측 0099 판): 0101 의 2단계 읽음은 ack 전 미확인 메시지를 *체크아웃에 무계 보유*한다 — 읽는 이가 느리거나 죽어 영영 ack 안 하고 재드레인만 반복하면 checkout 이 received 에 비례해 성장(0101 §9). 0099 가 *수신함(inbox)* 을 최근 K 로 cap 했듯, 이 step 은 *미확인 체크아웃* 을 최근 K(checkoutBound)로 cap 한다: drain 후 K 초과면 가장 오래된 미확인을 떨군다(checkoutOverflowed++·lossy). 읽혔으나 확인 안 된 옛 메시지의 방어 — drained(ack 확인 소비)는 무손실 보존(0101)이고 checkout cap 은 미확인 보유의 lossy 유계화. 0099 inbox cap(미읽음 방어)과 0102 checkout cap(읽음-미확인 방어)이 짝. checkoutBound 0(기본)=무계 보유=0101 비트 동일.
// step-0101 — 읽음 확인 영수증(drainAck·2단계 읽음): 0100 의 drain() 은 inbox 를 *파괴적으로 즉시 비운다* — 읽는 순간 소비로 친다. 그러나 읽은 결과가 손실되면(소유자가 처리 전 크래시·드레인 전송 유실) 메시지는 영영 잃는다(재드레인 정합 미보장·0100 §9). 이 step 은 그 드레인을 *2단계 읽음*으로 만든다: drain() 이 inbox 를 *미확인 체크아웃*(checkout)으로 옮겨 반환하되 *제거하지 않고* 보유하고, 소유자가 처리 완료 후 ackDrain(seq) 로 확인하면 *그때서야* 안전 제거(drainAcked 누적). ack 전에 재드레인하면 같은 체크아웃을 무손실 재반환(at-least-once 읽음) → 읽음 손실이 복구 가능. 0076 whisperReceipt(전달 영수증·수신측)의 *읽음측* 판 — at-least-once 읽음 + ack 안전 제거 = exactly-once *소비*. drainAck OFF 면 drain() 은 0100 파괴적 즉시 비움(비트 동일).
// step-0100 — Mailbox inbox 드레인(drain·읽음 소비): 0099 의 inboxBound 는 inbox 를 최근 K개로 cap 하되 초과분을 *드롭*(잃음)한다 — notification 트레이 의미론(0099 §9). 진짜 수신함은 소유자(클라)가 *읽어 비운다* — 읽은 메시지는 잃는 게 아니라 소비된다. 이 step 은 그 드레인을 모델한다: `drain()` 이 현 inbox 를 반환하며 비우고(inbox=[]) 누적 소비량(drained)을 센다 → 읽는 이가 있으면 inbox 가 *무손실로* 비워져 메모리 유계(드롭 0). 0099 cap(읽는 이 없을 때의 방어)과 짝 — drain 은 읽는 이 있을 때의 정상 비움. drain() 미호출(mboxDrain 훅 미제공)이면 inbox 누적 = 0099 비트 동일.
// step-0099 — Mailbox inbox 유계화(inboxBound·드레인 읽기 모델): Mailbox.inbox 는 받은 귓속말을 *전부 영구 보관*한다 → 수신함이 read 로 비워지지 않는 한 메모리가 received 에 비례해 무한 성장(누설). 실 수신함은 소유자(클라)가 읽어 비운다 — 읽는 이가 없으면 무계 inbox 는 누설이다. 이 step 은 inbox 를 *최근 K개*(inboxBound)로 유계화한다: 적재 후 K 초과면 가장 오래된 것을 떨군다(overflowed++·드롭은 계측). received(총 수신 수)는 *진실의 SSOT*로 보존 — inbox 는 유계 최근-뷰(알림 트레이 cap). dedup 메모리(0081 seq·0090 epoch)에 이은 inbox 차원의 유계화. inboxBound 0(기본) = 무계 평면 배열(0098 비트 동일).
// step-0091 — 옛 epoch grace 유예(deliverEpochGrace·straggler 내성): 0090 은 더 높은 epoch 도착 시 낮은 epoch 워터마크를 *즉시* 가지친다 — 단조 epoch 도착을 가정한다(0090 §9). 하지만 가지친 *뒤* 옛 epoch 의 지연 straggler 가 도착하면 워터마크가 없어 *신규로 오인 재수신*(중복 적재·전달 유실의 거울상). 이 step 은 즉시 가지치기 대신 *가장 최근 epochGrace 개의 닫힌 epoch 워터마크를 유예*(슬라이딩 윈도)한다 — epoch e 도착 시 e-epochGrace 미만 epoch 만 제거. 유예된 닫힌 epoch 의 straggler 는 워터마크가 살아 있어 정상 dedup(중복으로 인식·재적재 안 함). epoch 차원은 producer 당 epochGrace+1 로 여전히 유계(0051 lease grace 의 epoch 판). epochGrace 0(기본) = e 미만 즉시 제거 = 0090 비트 동일.
// step-0090 — epoch 워터마크 유계화(epochBound·옛 epoch 가지치기): 0089 의 (producer,epoch) 워터마크는 재시작 안전을 주지만, Mailbox 가 *모든 epoch*의 워터마크를 영영 보관한다 → 라우터가 재시작할수록 epoch 차원이 ∝재시작 수로 무한 성장(0089 §9). 핵심 통찰: 라우터가 재시작하면(epoch++) inflight 를 비우므로 *옛 epoch 의 전달은 다시 오지 않는다* → 더 높은 epoch 가 도착하면 그 producer 의 *낮은 epoch 워터마크는 안전하게 잊어도 된다*. 이 step 은 base producer 별 *현재(최고) epoch* 만 유지하고, 더 높은 epoch 수신 시 낮은 epoch 워터마크 키를 가지친다 → epoch 차원이 producer 당 1 로 유계(0048 lease lifecycle·0042 seen 유계화의 epoch 판). epochBound OFF 면 가지치기 0·옛 epoch 누적 = 0089 비트 동일.
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
    this.seenWm = new Map();    // producer 키(addr 또는 addr#epoch) -> 본 *연속* 최고 seq(step-0081·유계 경로). 이하는 전부 본 것으로 접힘 → 보관 0.
    this.seenAbove = new Map(); // producer 키 -> Set(wm 초과 *비순차* seq)(step-0081). 순차 도착이면 즉시 흡수돼 ≈빈 집합 → 메모리 O(gap).
    this.duplicates = 0;    // dedup 으로 걸러낸 중복 전달 수(계측).
    this.epochBound = opts.epochBound || false;   // epoch 워터마크 유계화(step-0090·epochBound) — base producer 별 현재 epoch 만 유지·낮은 epoch 가지치기. OFF 면 옛 epoch 누적(0089 동일).
    this.curEpoch = new Map();  // base producer(m.from) -> 본 최고 epoch(step-0090). 더 높은 epoch 도착 시 낮은 epoch 워터마크 키 가지치기.
    this.epochGrace = opts.epochGrace || 0;   // 옛 epoch grace 유예(step-0091·deliverEpochGrace) — 가장 최근 N개 닫힌 epoch 워터마크를 유예(슬라이딩 윈도)해 지연 straggler 를 정상 dedup. 0(기본) = 즉시 가지치기(0090 동일). epoch 차원은 producer 당 N+1 로 유계.
    this.inboxBound = opts.inboxBound || 0;   // inbox 유계화(step-0099·inboxBound) — inbox 를 최근 K개로 cap(K 초과 시 가장 오래된 것 드롭). 0(기본) = 무계(0098 동일). received 는 보존(진실 SSOT).
    this.overflowed = 0;    // inboxBound 로 떨군 옛 inbox 항목 수(step-0099·계측). received - overflowed ≈ 현 inbox 보유(≤K).
    this.drained = 0;       // drain() 으로 소비(읽어 비움)한 누적 항목 수(step-0100·계측). 드롭(overflowed)과 달리 무손실 소비. drainAck ON(0101) 이면 ack 시에만 증가(읽음 확인 후 소비).
    this.drainAck = opts.drainAck || false;   // 읽음 확인 영수증(step-0101·drainAck) — drain 을 2단계 읽음(checkout→ackDrain)으로: ack 전엔 보유(checkout)·재드레인 시 무손실 재반환·ack 시에만 안전 제거. OFF 면 0100 파괴적 즉시 비움(비트 동일).
    this.checkout = null;   // 미확인 체크아웃 배치 {seq, msgs}(step-0101·drainAck ON) — 읽었으나 ack 대기 중. ack 전 재드레인 시 (carry 누적해) 재반환 = 읽음 손실 복구 가능(at-least-once 읽음).
    this.drainSeq = 0;      // 드레인 배치 seq(step-0101·단조 증가). 재드레인마다 ++ — 소유자는 *최신* seq 로 ack(낡은 seq ack 는 무시).
    this.drainAcked = 0;    // ackDrain 으로 확인·안전 제거된 누적 항목 수(step-0101·계측). 드레인 후 ack 까지 완료된 exactly-once 소비.
    this.checkoutBound = opts.checkoutBound || 0;   // 미확인 체크아웃 유계화(step-0102·checkoutBound) — checkout 을 최근 K개로 cap(K 초과 시 가장 오래된 미확인 드롭·checkoutOverflowed++). 0(기본)=무계(0101 동일). drained(ack 소비)는 무손실 보존.
    this.checkoutOverflowed = 0;    // checkoutBound 로 떨군 미확인 체크아웃 항목 수(step-0102·계측·lossy). 읽혔으나 ack 전 드롭 — 슬로/데드 리더 방어(0099 inbox overflow 의 읽음측 판).
  }
  // inbox 드레인(step-0100·drain / step-0101·drainAck 2단계) — 소유자(클라)가 수신함을 *읽는다*.
  //   drainAck OFF(0100): 현 inbox 를 반환하며 *즉시 비우고* drained 누적(파괴적 읽음). 읽는 이가 있으면 inbox 가 무손실로 유계(0099 lossy cap 과 짝). 미호출이면 inbox 누적(0099 동일).
  //   drainAck ON(0101): inbox 를 *미확인 체크아웃*으로 옮겨(있던 체크아웃 carry + 새 inbox) inbox 비우고 {seq, msgs} 반환 — *제거하지 않고 보유*. drained 는 ack 시에만 증가. ack 전 재드레인은 같은 배치를 무손실 재반환(읽음 손실 복구).
  drain() {
    if (!this.drainAck) { const msgs = this.inbox; this.drained += msgs.length; this.inbox = []; return msgs; }   // 0100 파괴적 즉시 비움(비트 동일)
    const carry = this.checkout ? this.checkout.msgs : [];   // 미확인(ack 안 된) 이전 체크아웃은 잃지 않고 누적
    const msgs = carry.concat(this.inbox);
    this.inbox = []; this.drainSeq++;
    // 미확인 체크아웃 유계화(step-0102·checkoutBound) — 최근 K개만 보유(K 초과 시 가장 오래된 미확인 드롭·checkoutOverflowed++). 읽되 영영 ack 안 하는 슬로/데드 리더의 보유 누설 방어(0099 inbox cap 의 읽음측 판). 0 이면 무계(0101 비트 동일).
    if (this.checkoutBound > 0) while (msgs.length > this.checkoutBound) { msgs.shift(); this.checkoutOverflowed++; }
    this.checkout = { seq: this.drainSeq, msgs };
    return { seq: this.drainSeq, msgs };
  }
  // 읽음 확인(step-0101·ackDrain) — 소유자가 읽은 배치 처리 완료를 그 seq 로 확인 → 체크아웃 안전 제거·drained/drainAcked 누적. seq 불일치(낡은/중복 ack)는 무시(멱등). drainAck OFF 면 no-op.
  ackDrain(seq) {
    if (!this.drainAck || !this.checkout || this.checkout.seq !== seq) return;
    const n = this.checkout.msgs.length; this.drained += n; this.drainAcked += n; this.checkout = null;
  }
  // epoch 가지치기(step-0090) — base 의 더 높은 epoch 도착 시, 그 base 의 *낮은 epoch* 워터마크 키를 제거(옛 epoch 전달은 재시작으로 다시 안 옴 → 안전). epochBound OFF·epoch 없으면 no-op.
  //   step-0091 grace 유예: e-epochGrace *미만* epoch 만 제거(가장 최근 epochGrace 개 닫힌 epoch 워터마크는 유예 → 지연 straggler 를 정상 dedup). epochGrace 0 = e 미만 즉시 제거(0090).
  _pruneEpoch(base, epoch) {
    if (!this.epochBound || epoch == null) return;
    const cur = this.curEpoch.get(base);
    if (cur != null && epoch <= cur) return;   // 새 epoch 아님 → 가지치기 불필요
    const floor = epoch - this.epochGrace;   // 이 미만 epoch 워터마크만 제거(0090: floor=epoch / grace N: 최근 N개 닫힌 epoch 유예)
    if (cur != null) for (const k of [...this.seenWm.keys()]) { const i = k.lastIndexOf('#'); if (i >= 0 && k.slice(0, i) === base && +k.slice(i + 1) < floor) { this.seenWm.delete(k); this.seenAbove.delete(k); } }
    this.curEpoch.set(base, epoch);
  }
  epochKeyCount() { return this.seenWm.size; }   // 보관 중인 (producer,epoch) 워터마크 키 수(계측·유계 증명).
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
      // epoch 워터마크 유계화(step-0090) — 더 높은 epoch 도착 시 그 base 의 낮은 epoch 워터마크 키 가지치기(옛 epoch 전달은 재시작으로 다시 안 옴). epochBound OFF 면 no-op(0089 누적).
      this._pruneEpoch(m.from, p.epoch);
      // producer epoch(step-0089) — p.epoch 가 실려오면(라우터 epochKeyed) (producer,epoch) 로 분리: 라우터 재시작 시 새 epoch=새 워터마크 → 리셋된 낮은 seq 오접힘 방지. epoch 없으면 producer 만(0081 동작·비트 동일).
      const prod = (p.epoch != null) ? (m.from + '#' + p.epoch) : m.from;
      if ((this.dedup || this.dedupBound) && p.seq != null && this._seenHas(prod, p.seq)) { this.duplicates++; this._ack(p); return; }
      if (p.seq != null) this._seenAdd(prod, p.seq);
      this.received++; this.inbox.push({ from: p.from, body: p.body });
      // inbox 유계화(step-0099·inboxBound) — 최근 K개만 보유(K 초과 시 가장 오래된 것 드롭·overflowed++). received 는 보존(진실 SSOT). 0 이면 무계(0098 비트 동일).
      if (this.inboxBound > 0) while (this.inbox.length > this.inboxBound) { this.inbox.shift(); this.overflowed++; }
      this._ack(p);
      return;
    }
  }
}

const __part = { Mailbox };
if (typeof module !== 'undefined' && module.exports) module.exports = __part;
if (typeof globalThis !== 'undefined') (globalThis.__HktNetParts = globalThis.__HktNetParts || {}).svc_mailbox = __part;
