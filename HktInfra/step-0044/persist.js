'use strict';
// step-0044 분할 preamble — 박스 1개=파일 1개 (CLAUDE.md 임계 규칙). 진입점 net-core.js 가 묶는다.
// dual-mode: Node require / 브라우저는 common.js 를 <script> 선행 로드(전역 __HktNetCommon).
const __c = (typeof module !== 'undefined' && module.exports && typeof require !== 'undefined')
  ? require('./common.js') : globalThis.__HktNetCommon;
const { Net, LoginServer, SessionRegistry, mulberry32, fnv1a, DEFAULTS } = __c;

// ── [데이터] PersistStore — 영속 진실(이 step 의 한 조각). SPINE 계층 6 첫 박스. 존 tick 밖 *순수 반응형*(onTick 없음). ──
//   가방의 효과 로그(append-only 저널)를 *프로세스 수명과 독립*으로 보관한다 — "세계가 세션보다 오래 산다". 가방 서비스가
//   죽어도(RAM 소실) 이 박스는 *살아서* 저널을 지킨다(자기 프로세스·데이터 계층) → 새 가방이 저널을 replay 해 원장을 재현.
//   저널 = [{seq,kind:'mint'|'xfer',...}] — event sourcing(상태 전송 아님 = §4 "복제=재현"). write-behind: 가방이 fire-and-forget
//   으로 append 하고 ack 를 안 기다린다(신성한 tick 밖 비동기). 발신 0 = 관찰 전용 스토어(가방이 읽기는 복구 시 제어 평면으로).
//   주의: 이번 step 은 *단일 인스턴스·메모리 저널*(스냅샷 압축·디스크 fsync·다중 복제·write 손실 ack/resend 없음 — 후속).
class PersistStore {
  constructor(opts = {}) {
    this.reliable = opts.reliable || false;  // 저널 홉 신뢰 수신(이 step) — ON 이면 seq 갭 감지 시 발신자에 NAK·중복 seq dedup(멱등). OFF = 0022 비트 동일(매 수신 push).
    this.journal = [];            // append-only 효과 로그(SSOT — replay 입력). 압축 후엔 tail(seq>snapshot.upToSeq)만 보존.
    this.writes = 0;              // append 수신 *누적* 수(압축에도 안 줄음 — 가방 수락 변이 = mint+xfer 와 대조의 진실). reliable 이면 *distinct seq* 수(dedup).
    this.snapshot = null;         // 최신 원장 스냅샷(압축 베이스 — {upToSeq,ledger,mintTotal,minted,transfers}). null = 압축 전(0017).
    this.snapshots = 0;           // 스냅샷 수신 수(압축 횟수)
    this.compacted = 0;           // 압축으로 폐기한 저널 항목 누적 수(절감량)
    this.recvSeqs = new Set();    // 수신한 저널 seq 집합(0023·reliable) — dedup(재전송 중복 0) + 갭 감지(미수신 seq 색출)
    this.maxRecvSeq = -1;         // 수신한 최대 seq(NAK-only 갭 범위의 상한 — [0..maxRecvSeq] 중 미수신 = 손실 후보). *받은* 것만 알므로 tail 은 못 본다(§9).
    this.expectedMaxSeq = -1;     // heartbeat 로 학습한 *발신자* 최대 seq(이 step·journalHb) — 갭 스캔 상한을 maxRecvSeq *위*로 끌어올려 tail 손실 감지(§9 해소).
    this.naks = 0;                // 갭 감지로 보낸 NAK 누적(0023·계측)
    this.tailNaks = 0;            // maxRecvSeq *위*(tail)의 갭을 포함한 NAK 누적(이 step·계측 — heartbeat 없이는 0 = §9 사각의 직접 증명)
  }
  // 갭 스캔 + NAK(0023 의 인라인 스캔을 helper 로 — journal 수신·heartbeat 둘 다 호출).
  //   상한 hi = max(maxRecvSeq, expectedMaxSeq) — heartbeat(이 step)가 expectedMaxSeq 를 올리면 tail 도 스캔. heartbeat 없으면 expectedMaxSeq=-1 → hi=maxRecvSeq(0023 비트 동일).
  _scanAndNak(to) {
    const hi = Math.max(this.maxRecvSeq, this.expectedMaxSeq);
    const missing = [];
    for (let s = 0; s <= hi; s++) if (!this.recvSeqs.has(s)) missing.push(s);
    if (missing.length > 0) {
      this.net.send(this.addr, to, { type: 'journal_nak', missing });
      this.naks++;
      if (missing.some(s => s > this.maxRecvSeq)) this.tailNaks++;   // tail(수신 최고 위) 갭 포함 = heartbeat 가 알려준 덕 — NAK-only 면 구조적으로 0
    }
  }
  onMsg(m) {
    const p = m.payload;
    if (p.type === 'journal') {
      // 쓰기 정족수 ack 회신(이 step) — p.q 가 있으면(발신자 quorumW>0) 저장 후 발신자에 journal_ack{seq} 회신 → 서비스가 durable 사본 수 집계.
      //   *수신 = RAM 저장*(별 박스) 이므로 도달이 곧 durable. p.q 없으면(quorumW 0) 회신 0 = 0028 비트 동일(낙관 fire-and-forget). 멱등 재-ack(중복/재전송에도 무해 — 서비스 Set dedup).
      if (!this.reliable) {
        this.journal.push(p.entry); this.writes++;   // 0022 경로 — fire-and-forget(중복/갭 무처리)
        if (p.q) this.net.send(this.addr, m.from, { type: 'journal_ack', seq: p.entry.seq });
        return;
      }
      // 신뢰 수신(0023) — dedup(이미 받은 seq 면 무시·재전송 중복 0) + 갭 감지 NAK(미수신 seq 를 발신자에 요청).
      const seq = p.entry.seq;
      if (!this.recvSeqs.has(seq)) {
        this.recvSeqs.add(seq); this.journal.push(p.entry); this.writes++;
        if (seq > this.maxRecvSeq) this.maxRecvSeq = seq;
      }
      if (p.q) this.net.send(this.addr, m.from, { type: 'journal_ack', seq });   // 쓰기 정족수 ack(이 step) — dedup 후에도 매번 재-ack(손실된 ack 결국 도달·서비스 Set dedup)
      // 미수신 seq 색출 → 있으면 발신자(m.from)에 NAK(재전송 요청). 매 수신 재-NAK = NAK 손실에도 결국 수렴(tail 손실은 heartbeat 가 알려야 — 0024).
      this._scanAndNak(m.from);
      return;
    }
    // 저널 홉 heartbeat(이 step·journalHb) — 발신자가 통보한 maxSentSeq 로 갭 스캔 상한을 끌어올린다 → tail(최고 수신 위) 손실도 NAK.
    //   순수 반응형(onMsg). expectedMaxSeq 단조 증가. heartbeat 없으면 이 분기 휴면 → expectedMaxSeq=-1 → 0023 비트 동일.
    if (p.type === 'journal_hb') {
      if (!this.reliable) return;
      if (p.maxSentSeq > this.expectedMaxSeq) this.expectedMaxSeq = p.maxSentSeq;
      this._scanAndNak(m.from);
      return;
    }
    // 스냅샷 수신(이 step) — 압축: snapshot.upToSeq *이하* 저널 항목을 폐기(스냅샷이 그 상태를 이미 담음). tail 만 남김.
    //   writes 는 *안 줄인다*(누적 진실) — journalComplete 가 writes==mint+xfer 로 완전성을 본다(저널은 압축돼도 영속된 변이 수는 불변).
    if (p.type === 'snapshot') {
      this.snapshot = p.snap;
      const before = this.journal.length;
      this.journal = this.journal.filter(e => e.seq > p.snap.upToSeq);
      this.compacted += before - this.journal.length;
      this.snapshots++;
      return;
    }
  }
  size() { return this.journal.length; }
  // crash — PersistStore 프로세스 사망(이 step): journal·snapshot·모든 추적 상태 전량 소실.
  //   InventoryService crash 와 같은 패턴이지만 *데이터 계층*(저장소) 의 죽음 — backup 없으면 복구 불가.
  crash() {
    this.journal = []; this.snapshot = null; this.writes = 0; this.snapshots = 0; this.compacted = 0;
    this.recvSeqs = new Set(); this.maxRecvSeq = -1; this.expectedMaxSeq = -1;
    this.naks = 0; this.tailNaks = 0;
  }
}

const __part = { PersistStore };
if (typeof module !== 'undefined' && module.exports) module.exports = __part;
if (typeof globalThis !== 'undefined') (globalThis.__HktNetParts = globalThis.__HktNetParts || {}).persist = __part;
