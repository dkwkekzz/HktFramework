'use strict';
// step-0269 정리 분할(#49 인접·선제) — svc-mailbox.js 가 24.7KB(30KB 근접·성장 박스)라, Mailbox 의 *seen/epoch dedup 헬퍼*
//   (_pruneEpoch·epochKeyCount·_seenHas·_seenAdd·seenSize·_ack: exactly-once dedup 워터마크 유계화 + epoch 펜싱 + ack 회신)를
//   svc-mailbox-dedup.js 믹스인으로 분리한다. 코어가 Object.assign(prototype) 로 되섞음 — 정의 위치만 이동·this 바인딩/메서드 해소 동일·기능 0 → reg 0(0268 비트 동일).
// dual-mode: Node require / 브라우저는 <script> 선행 로드(전역 __HktNetParts.svc_mailbox_dedup).
const MailboxDedup = {
  _pruneEpoch(base, epoch) {
    if (!this.epochBound || epoch == null) return;
    const cur = this.curEpoch.get(base);
    if (cur != null && epoch <= cur) return;   // 새 epoch 아님 → 가지치기 불필요
    const floor = epoch - this.epochGrace;   // 이 미만 epoch 워터마크만 제거(0090: floor=epoch / grace N: 최근 N개 닫힌 epoch 유예)
    if (cur != null) for (const k of [...this.seenWm.keys()]) { const i = k.lastIndexOf('#'); if (i >= 0 && k.slice(0, i) === base && +k.slice(i + 1) < floor) { this.seenWm.delete(k); this.seenAbove.delete(k); } }
    this.curEpoch.set(base, epoch);
  },
  epochKeyCount() { return this.seenWm.size; },   // 보관 중인 (producer,epoch) 워터마크 키 수(계측·유계 증명).
  // 본 seq 인가(dedup 판정 — 평면/유계 공통 디스패치). 유계 경로: wm 이하(접힘) 또는 seenAbove 에 있으면 본 것.
  _seenHas(prod, seq) {
    if (!this.dedupBound) return this.seen.has(seq);
    if (seq <= (this.seenWm.get(prod) || 0)) return true;
    const above = this.seenAbove.get(prod); return above ? above.has(seq) : false;
  },
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
  },
  // dedup 보관 항목 수(계측·유계 증명) — 유계 경로=비순차 잔여(Σ seenAbove), 평면 경로=Set 전체(∝고유 seq).
  seenSize() {
    if (!this.dedupBound) return this.seen.size;
    let n = 0; for (const s of this.seenAbove.values()) n += s.size; return n;
  },
  // ack 회신(전달 영수증) — dropAck 주입 시 첫 N개는 억제(전달은 받되 ack 만 분실 → 라우터 재발신→중복 유발). 그 후 정상 회신.
  _ack(p) {
    if (!(p.ackTo && p.seq != null)) return;
    if (this.ackDropped < this.dropAck) { this.ackDropped++; return; }   // ack 손실 주입(첫 N개 억제)
    this.net.send(this.addr, p.ackTo, { type: 'whisperAck', seq: p.seq }); this.acks++;
  },
};

const __part = { MailboxDedup };
if (typeof module !== 'undefined' && module.exports) module.exports = __part;
if (typeof globalThis !== 'undefined') (globalThis.__HktNetParts = globalThis.__HktNetParts || {}).svc_mailbox_dedup = __part;
