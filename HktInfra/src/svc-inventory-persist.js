'use strict';
// step-0048 정리 분할 — InventoryService *write-behind 영속* 경로(_journal·_resend·_recordAck·onTick·_snapshot·replay).
//   원장 코어(svc-inventory-core.js)의 프로토타입을 Object.assign 으로 증강(동작 불변). 진입점이 core 뒤에 로드한다.
const __isNode = typeof module !== 'undefined' && module.exports && typeof require !== 'undefined';
const { InventoryService } = __isNode ? require('./svc-inventory-core.js') : globalThis.__HktNetParts.svc_inventory_core;
Object.assign(InventoryService.prototype, {
  // 영속 저널 쓰기(write-behind) — 수락한 효과를 PersistStore 로 fire-and-forget. persist OFF 면 no-op(0016 비트 동일).
  //   결과 ack 는 영속 ack 를 *기다리지 않는다*(write-behind) — 신성한 tick 밖 비동기. 저널 항목 = 재현(event sourcing)의 입력.
  _journal(entry) {
    if (!this.persist) return;
    const full = { ...entry, seq: this.journalSeq++ };
    if (this.reliable || this.windowFill) this.sentBuffer.set(full.seq, full);   // 미-ack 보존: 신뢰 전달(0023·persist NAK 재전송) 또는 윈도 해소(이 step·정족수 미달 seq 재발신 소스). 둘 다 OFF 면 보관 0(0029 비트 동일).
    // 쓰기 정족수 ack 요청(이 step) — quorumW>0 이면 q:true 를 실어 스토어가 저장 후 journal_ack 회신. quorumW 0 면 q 없음 = 0028 비트 동일(낙관 fire-and-forget).
    //   매 발신마다 별도 객체(0028 처럼) — 공유 참조 회피로 전송층 변형 안전. q 없으면 페이로드가 0028 과 비트 동일(reg 0).
    const mk = () => this.quorumW > 0 ? { type: 'journal', entry: full, q: true } : { type: 'journal', entry: full };
    this.net.send(this.addr, this.persist, mk());
    // 이중쓰기(0027) — persistBackup ON 이면 backup persist 에도 동일 항목 발신(fire-and-forget). primary crash 후 backup 에서 완전 복구 가능.
    if (this.persistBackup) this.net.send(this.addr, this.persistBackup, mk());
    // N-replica fan-out(0028) — replicas 목록 전부에 동일 항목 발신(각각 독립 저장소). primary + N 복제 = N+1 내구 사본.
    //   복구가 *생존 복제들의 저널 union(quorum read·0028)* 이라 (primary 포함) 최대 N개 죽어도 무손실. quorumW>0(이 step)이면 각 스토어가 ack 회신 → 서비스가 durable 사본 수를 셈.
    //   [] 면 발신 0(reg 0 — 0027 비트 동일). 전송 손실로 각 복제가 *부분* 저널만 가져도 union 이 메운다(merge 가 단일 복제보다 강함).
    for (const r of this.replicas) this.net.send(this.addr, r, mk());
    // 스냅샷 압축(0018) — 저널 N항목마다 *원장 스냅샷*을 persist 로(write-behind·반응형·onTick 0 유지). persist 가 upToSeq 이하
    //   저널을 폐기 → 무한 성장 방지. 라이브 원장 비-침습(invDigest 불변) · 복구는 스냅샷 베이스 + tail replay(무손실 압축).
    if (this.snapInterval > 0 && this.journalSeq % this.snapInterval === 0) this._snapshot();
  },
  // 저널 홉 재전송(이 step·reliable) — persist 가 seq 갭을 감지해 보낸 NAK 에 응답: sentBuffer 의 미수신 항목을 다시 send(새 m.id·전송 손실 재노출).
  //   순수 반응형(onMsg·onTick 0 유지). persist 는 recvSeqs 로 멱등 수신(중복 push 0) → at-least-once 전송 위에 effectively-once 영속.
  _resend(missing) {
    for (const seq of missing) {
      const e = this.sentBuffer.get(seq);
      if (e) { this.net.send(this.addr, this.persist, { type: 'journal', entry: e, resend: true }); this.resends++; }   // resend:true — 재전송 사본 식별(전송층이 tail 시나리오에서 *최초 전송*만 떨굼 → 재전송은 신뢰 배달, 갭은 *감지* 문제로 격리)
    }
  },
  // 쓰기 정족수 ack 집계(이 step·quorumW) — 스토어가 회신한 journal_ack 를 seq 별 집합에 모은다. ≥W 인 seq 가 연속(0..)이면 durableSeq 워터마크 전진.
  //   durableSeq = 서비스가 *확정 durable* 로 선언할 수 있는 프런티어(≥W 사본 보유 = (N+1−W) 죽음 견딤). 그 위는 정합성 윈도(아직 정족수 미확인). 멱등(Set dedup) — 재-ack 무해.
  _recordAck(seq, from) {
    let set = this.ackSeqs.get(seq);
    if (!set) { set = new Set(); this.ackSeqs.set(seq, set); }
    set.add(from);
    this.quorumAcks++;
    while (true) {   // 연속 워터마크 전진 — durableSeq+1 이 ≥W ack 인 동안만(빈칸/미달이면 멈춤 = 윈도 경계)
      const s = this.ackSeqs.get(this.durableSeq + 1);
      if (s && s.size >= this.quorumW) this.durableSeq++; else break;
    }
  },
  // 저널 홉 tail 손실 감지(이 step·journalHb) — 주기적 heartbeat 로 persist 에 *내가 보낸 최대 seq*(maxSentSeq) 통보.
  //   NAK-only(0023)는 persist 가 *받은* 최대 seq([0..maxRecvSeq])까지만 갭을 본다 → tail(최고 수신 *위*)을 못 본다(§9 사각).
  //   heartbeat 가 maxSentSeq 를 알려주면 persist 가 [maxRecvSeq+1..maxSentSeq] tail 갭도 NAK → 재전송으로 메움(write-behind 신뢰성의 tail 절반).
  //   *존 tick 밖*(가방 자체 제어 평면 onTick — 존 net.log/상태 비-기여·신성한 tick 보존). OFF 면 onTick no-op(0023 비트 동일).
  onTick(t) {
    // 저널 홉 tail heartbeat(0024) — journalHb ON 일 때만. 아래 윈도 해소(이 step)와 *독립*(둘 다 휴면이면 onTick no-op = 0029 비트 동일).
    if (this.journalHb && this.reliable && this.persist && this.journalSeq > 0 && t % this.hbPeriod === 0) {
      this.net.send(this.addr, this.persist, { type: 'journal_hb', maxSentSeq: this.journalSeq - 1 });
      this.journalHbs++;
    }
    // 정합성 윈도 *해소*(0031·windowFill) — 0029 가 윈도를 워터마크 위로 *감지*만 했다면, 이 sweep 은 그 윈도를 durable 로 *전환*한다.
    //   durableSeq 위 ack<W 인 seq 를 *아직 ack 안 한* 스토어에 재-fan-out(resend:true·q:true) → 그 스토어가 저장 후 ack
    //   → ackSeqs 가 W 충족 → _recordAck 의 워터마크가 전진 → 윈도가 위에서부터 닫힌다. 0023 재전송 메커니즘(resend 우회)을 *정족수* 목적에 재사용.
    //   순수 반응형 제어 평면(존 tick 밖·net.log 비-기여로 신성한 tick 보존). wfPeriod≥3 → round-trip(2 tick) 안에 ack 기록 → 다음 sweep 전 반영 → acks.has(r) 가드가 이중 발신 0.
    //   *유계 sweep + fill 손실 retry(이 step)*: 매 sweep 은 [durableSeq+1 .. durableSeq+wfWindow] 만 훑어 per-sweep O(K) 비용 상한(미끄러지는 창). fill 자체가 손실돼도(ack 미수신 → n<W 유지)
    //     *다음 sweep 이 같은 seq 를 자연 retry* → 결국 정족수 충족(주기적 재-scan = 내장 retry). durableSeq 전진에 창이 따라 미끄러져 전체 윈도를 덮는다. wfWindow 0 = 무계(0031 비트 동일).
    //   OFF 면 이 분기 휴면 → 0029 비트 동일(reg 0). quorumW 0 이면 durableSeq 미사용이라 무의미(토폴로지가 quorumW>0 전제로만 와이어).
    if (this.windowFill && this.quorumW > 0 && this.persist && this.journalSeq > 0 && t % this.wfPeriod === 0) {
      const stores = [this.persist, ...this.replicas];
      const hi = this.wfWindow > 0 ? Math.min(this.journalSeq - 1, this.durableSeq + this.wfWindow) : this.journalSeq - 1;   // 유계 창 상한(이 step) — 0 면 무계(journalSeq-1·0031 동일)
      for (let seq = this.durableSeq + 1; seq <= hi; seq++) {
        const acks = this.ackSeqs.get(seq);
        const n = acks ? acks.size : 0;
        // 대상 = 정족수 *미달*(0<n<W): ≥1 사본이 durable 확인됐으나 W 미달. n===0 은 (ⓐ 원 발신이 아직 in-flight·미-ack
        //   or ⓑ 전손실=0 사본)이라 제외 — in-flight 를 재발신하면 곧 도착할 원 발신과 중복·전손실은 0023 신뢰 홉 영역(정족수 아님). n≥W 는 이미 durable.
        if (n === 0 || n >= this.quorumW) continue;
        const e = this.sentBuffer.get(seq);
        if (!e) continue;                                   // 버퍼에 없음(windowFill 이면 _journal 이 보존하므로 통상 존재)
        for (const r of stores) {
          if (acks && acks.has(r)) continue;                // 그 스토어가 이미 durable 보유(ack 함) — 재발신 0 = dupe 0
          this.net.send(this.addr, r, { type: 'journal', entry: e, q: true, resend: true });   // resend:true → 손실 모델 우회(신뢰 배달)·q:true → 저장 후 ack 회신
          this.windowFills++;
        }
      }
    }
  },
  // 스냅샷 발신 — 현재 원장 상태(압축 베이스)를 persist 로. upToSeq = 직전 저널 항목 seq(스냅샷이 그 이하 효과를 *이미 반영*).
  //   ledger/mintTotal/minted/transfers 를 함께 — replay 가 이 베이스에서 tail 만 적용해 전체-저널 replay 와 비트 동일 재구성.
  _snapshot() {
    this.net.send(this.addr, this.persist, { type: 'snapshot', snap: {
      upToSeq: this.journalSeq - 1,
      ledger: [...this.ledger.entries()],
      mintTotal: this.mintTotal, minted: this.minted, transfers: this.transfers,
    } });
  },
  // replay — 영속 저널(효과 로그)로 원장을 *재현*(상태 전송 아님 = §4 "복제=재현"). seq 순서대로 mint/xfer 적용.
  //   mintTotal·journalSeq 를 *최대값+1* 로 복원(개수 아님) → 이후 itemId 연속성·seq 단조 보장. 완전 저널이면 max+1==개수(복구 투명).
  //   저널에 빈칸(write-behind 손실/비-contiguous)이 있어도 itemId 재사용·seq 중복이 구조적으로 불가(개수 기반의 함정 회피).
  replay(journal, snapshot) {
    const sorted = (journal || []).slice().sort((a, b) => a.seq - b.seq);
    let maxMintId = -1, maxSeq = -1;
    // 스냅샷 베이스(이 step) — 압축으로 폐기된 *헤드 저널*을 스냅샷 원장이 대신한다. 그 뒤 tail(seq>upToSeq)만 적용.
    //   snapshot 없으면(0017 전체 저널·압축 OFF) 이 블록 휴면 → 종전 경로와 비트 동일.
    if (snapshot) {
      for (const [id, owner] of snapshot.ledger) { this.ledger.set(id, owner); this._own(owner, id); }
      this.minted = snapshot.minted; this.transfers = snapshot.transfers;
      maxMintId = snapshot.mintTotal - 1;   // mintTotal 베이스(= 최대 itemId+1) — tail mint 가 더 밀어올릴 수 있음
      maxSeq = snapshot.upToSeq;             // seq 베이스 — tail 이 더 큰 seq 를 가짐
    }
    for (const e of sorted) {
      if (snapshot && e.seq <= snapshot.upToSeq) continue;   // 스냅샷에 이미 반영된 헤드는 건너뜀(압축 정합 — 이중 적용 방지)
      if (e.seq > maxSeq) maxSeq = e.seq;
      if (e.kind === 'mint') {
        this.ledger.set(e.itemId, e.owner); this._own(e.owner, e.itemId);
        this.minted++;
        const idNum = parseInt(String(e.itemId).slice(4), 10);   // 'item<N>' → N (mintTotal 복원 = max(N)+1)
        if (Number.isFinite(idNum) && idNum > maxMintId) maxMintId = idNum;
      } else if (e.kind === 'xfer') {
        this._unown(e.from, e.itemId); this.ledger.set(e.itemId, e.to); this._own(e.to, e.itemId);
        this.transfers++;
        const idNum = parseInt(String(e.itemId).slice(4), 10);   // xfer 항목도 maxMintId 추적 — mint 전체 손실 시 mintTotal=0 충돌 방지
        if (Number.isFinite(idNum) && idNum > maxMintId) maxMintId = idNum;
      }
    }
    this.mintTotal = maxMintId + 1;   // 다음 mint itemId = 'item'+(max+1) (개수 아님 — 빈칸에도 재사용 0)
    this.journalSeq = maxSeq + 1;     // 다음 저널 seq = max+1 (개수 아님 — 빈칸에도 중복 0)
  },
});
if (__isNode) module.exports = { InventoryService };
