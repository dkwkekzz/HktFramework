'use strict';
// step-0040 분할 preamble — 박스 1개=파일 1개 (CLAUDE.md 임계 규칙). 진입점 net-core.js 가 묶는다.
// dual-mode: Node require / 브라우저는 common.js 를 <script> 선행 로드(전역 __HktNetCommon).
const __c = (typeof module !== 'undefined' && module.exports && typeof require !== 'undefined')
  ? require('./common.js') : globalThis.__HktNetCommon;
const { Net, LoginServer, SessionRegistry, mulberry32, fnv1a, DEFAULTS } = __c;

// ── [게임 서비스] InventoryService — 아이템 원장(가방). 존 tick 밖 *순수 반응형*(onTick 없음 = 신성한 tick 밖). ──
//   원장 = itemId→owner 의 *함수*(Map) → 구조적 소유자=1·dupe 불가. byOwner = 역인덱스(소유자→itemId 집합) — 트랜잭션
//   정합 교차검증(원장 ≡ byOwner). 이동(give) = sender release + receiver acquire 를 *한 onMsg 안에 원자적*(쌍 거래).
//   itemId = 전역 mint 카운터(아바타 비-인코딩 → 은닉). 재적용(전송 redundancy/dedup)에도 idempotent — 옮긴 아이템은
//   owner≠from 이라 두 번째 give 는 실패(중복 이동 0). 자기 자신/미소유/미존재 give 는 실패(phantom 0).
class InventoryService {
  constructor(opts = {}) {
    this.gateway = opts.gateway || 'gateway';
    this.bus = opts.bus || null;  // 이벤트 버스 주소(null = 0015 직접 라우팅 비트 동일 — 버스 ON 이면 gateway 주소 미사용)
    this.persist = opts.persist || null;  // 영속 스토어 주소(null = 0016 비트 동일 — write-behind 저널 OFF). 가방 자기 데이터 스토어 명시 인터페이스.
    this.persistBackup = opts.persistBackup || null;  // 보조 영속 스토어 주소(0027·persistBackup) — _journal 이중쓰기 대상. null = 0026 비트 동일(단일 persist).
    this.replicas = opts.replicas || [];  // N-replica 영속 스토어 주소 목록(0028·persistReplicas) — _journal 이 primary + 이 목록 전부에 fan-out. [] = 0027 비트 동일(N-replica 휴면). persistBackup 과 상호배타(토폴로지가 둘 중 하나만 와이어).
    this.quorumW = opts.quorumW || 0;     // 쓰기 정족수(이 step·quorumW) — 저널이 W개 스토어에 ack 되면 그 seq 를 durable 선언. >0 이면 _journal 이 q:true 로 ack 요청, 스토어가 회신. 0 = 0028 비트 동일(ack 0·낙관 fire-and-forget).
    this.ackSeqs = new Map();             // seq -> Set<storeAddr> — durable ack 한 스토어 집합(0029). size≥quorumW 면 그 seq durable.
    this.durableSeq = -1;                 // 커밋 워터마크(0029) — [0..durableSeq] 전 seq 가 ≥W ack(연속). 윈도 = (journalSeq-1) - durableSeq = 아직 정족수 미확인(정합성 윈도 가시화).
    this.quorumAcks = 0;                  // 수신한 journal_ack 누적(0029·계측)
    this.windowFill = opts.windowFill || false;  // 정합성 윈도 *해소*(0031·windowFill) — ON 이면 durableSeq 위 윈도(0<ack<W) seq 를 아직 ack 안 한 스토어에 주기적 재-fan-out → 정족수 채워 durable 로 전환. OFF = 0029 비트 동일(윈도 *감지*만·전환 0).
    this.wfPeriod = opts.wfPeriod || 4;          // 윈도 해소 sweep 주기(0031·제어 평면 결정론 상수·seed 무관·tick 동기 아님). ≥3 이라 직전 sweep fill 의 ack 가 다음 sweep 전에 기록(round-trip 2 tick < period → 이중 발신 0).
    this.wfWindow = opts.wfWindow || 0;          // 윈도 해소 sweep *유계 범위*(이 step·wfWindow) — sweep 이 매 tick [durableSeq+1 .. durableSeq+wfWindow] 만 훑는다(미끄러지는 유계 창 → per-sweep O(K) 비용 상한). durableSeq 가 전진하며 창이 따라 미끄러져 전체 윈도를 결국 덮는다. 0 = 무계(0031 비트 동일 — journalSeq-1 까지).
    this.windowFills = 0;                 // 윈도 해소로 재발신한 저널 누적(0031·계측 — ON 이면 >0·OFF 면 0). fill 손실 retry(이 step) 시 재시도분만큼 증가.
    this.snapInterval = opts.snapshot || 0;  // 스냅샷 압축 주기(0018) — 저널 N항목마다 원장 스냅샷 발신(0 = 0017 비트 동일·압축 휴면).
    this.reliable = opts.reliable || false;  // 저널 홉 신뢰 전달(0023) — ON 이면 보낸 저널을 sentBuffer 에 보관하고 persist NAK 에 재전송(0008 ack/NAK 의 저널 홉 판). OFF = 0022 fire-and-forget 비트 동일.
    this.journalHb = opts.journalHb || false;  // 저널 홉 *tail* 손실 감지(이 step) — ON 이면 주기적 heartbeat 로 persist 에 maxSentSeq 통보 → persist 가 maxRecvSeq *위*의 tail 갭도 NAK 가능(0023 NAK-only 의 §9 사각 해소). reliable 위에 올라탐. OFF = 0023 비트 동일(heartbeat 0).
    this.hbPeriod = opts.hbPeriod || 8;        // heartbeat 주기(제어 평면 결정론 상수 — seed 무관·tick 동기 아님). t % hbPeriod == 0 에 통보.
    this.ledger = new Map();      // itemId -> ownerAvatar (단일 진실 — 매 시점 소유자 정확히 1)
    this.byOwner = new Map();     // ownerAvatar -> Set<itemId> (역인덱스 — 트랜잭션 정합 교차검증)
    this.mintTotal = 0;           // 전역 mint 카운터(결정론 itemId)
    this.journalSeq = 0;          // 저널 항목 시퀀스(영속 효과 로그의 단조 순번 — replay 멱등·순서 보존)
    this.sentBuffer = new Map();  // seq -> 보낸 저널 항목(0023·reliable 일 때만 채움) — persist NAK 시 재전송 소스(미-ack 보존). 압축/bound 는 후속.
    this.resends = 0;             // NAK 에 응답해 재전송한 저널 항목 누적(0023·계측)
    this.journalHbs = 0;          // 보낸 저널 heartbeat 수(0024·journalHb·계측)
    // ── 버스 failover *결과 경로* 무손실(이 step·busResend) — 0034 의 §9(요청/결과 경로 in-flight 드롭=at-most-once) 해소. ──
    //   0034 busfail 은 routing 복구(재구독)만 했다 — crash gap 에 떨군 svc.item.out *결과*(원장엔 적용됐으나 클라 미수신)는 영구 손실(클라 belief 가 원장보다 뒤처짐 = itemDesync).
    //   producer replay(0023 홉 신뢰·0025 give-resend 의 *버스 판*): 발신한 결과를 보관했다가 버스 복구 시 재발행 → 뒤처진 클라가 따라잡음. 버스는 *살아 돌아온* 새 박스(영속 0)라
    //   gap 의 떨군 메시지를 못 메운다 → 진실 원천(producer=가방)이 재발행해야 한다. 클라 belief 는 Set 갱신이라 *멱등*(재배달 무해) → consumer dedup 불요.
    this.busResend = opts.busResend || false;  // ON 이면 발신 결과를 outBuffer 에 보관·버스 복구 시 재발행. OFF = 0035 비트 동일(보관 0·재발행 0).
    this.outBuffer = [];          // 발신한 svc.item.out 결과 페이로드(busResend 일 때만) — 버스 복구 재발행 소스. busWindow>0 이면 최근 K 개로 슬라이딩(유계·이 step).
    this.outResends = 0;          // 버스 복구 시 재발행한 결과 수(0036·계측)
    // ── 유계 replay 버퍼(이 step·busWindow) — outBuffer(0036)·게이트웨이 inBuffer(0037)의 *무계 성장* 해소(0032 wfWindow 의 버스 판). ──
    //   0036 outBuffer 는 발신한 *전* 결과를 무계로 쌓는다 → 장기 가동 시 메모리 무한 성장. failover 가 메우는 건 gap 구간 결과뿐이므로 그 창을 덮을 만큼만 보관하면 된다.
    //   busWindow=K 면 *최근 K 개*만(미끄러지는 유계 창) → 메모리 O(K) 상한. gap 결과는 재구독 시점 최근 항목이라 K≥|gap 결과| 이면 무손실 유지. K<gap 이면 손실 재현.
    this.busWindow = opts.busWindow || 0;  // outBuffer 유계 창 크기 K(이 step). 0 = 무계(0038 동일). >0 = 최근 K 개만(슬라이딩).
    // ── 버스 failover *요청 경로* 무손실의 가방 측(이 step·busResendReq) — 게이트웨이 요청 재발행의 멱등 수신. ──
    //   게이트웨이가 버스 복구 시 보관 요청을 재발행하면 gap *전* 도달한 요청도 함께 온다 → pickup 은 매번 새 itemId 를 mint 하므로
    //   dedup 없이는 이중 mint(dupe). 요청에 실린 producer-local reqId 를 seenReqs 에 기록해 *최초 1회만* 처리(0023 persist recvSeqs 의 요청 홉 판).
    //   give/reconcile 는 자체 멱등(owner/ledger 체크)이나 일관성 위해 같은 dedup 경로. OFF(reqId 없음)면 분기 휴면 = 0036 비트 동일.
    this.busResendReq = opts.busResendReq || false;  // ON 이면 reqId 실린 요청을 dedup(seenReqs). OFF = 0036 비트 동일(dedup 0).
    this.seenReqs = new Set();    // 처리한 요청 reqId(busResendReq ON·reqId 실릴 때만) — 재발행 중복 멱등 폐기(pickup 이중 mint 0).
    this.minted = 0; this.transfers = 0; this.failedOps = 0;
  }
  _own(owner, itemId) { if (!this.byOwner.has(owner)) this.byOwner.set(owner, new Set()); this.byOwner.get(owner).add(itemId); }
  _unown(owner, itemId) { const s = this.byOwner.get(owner); if (s) s.delete(itemId); }
  // 결과 발신 단일 경로 — 버스 ON 이면 svc.item.out 토픽 발행(소비자 주소 무지), OFF 면 0015 직접 라우팅(비트 동일).
  _out(msg) {
    if (this.bus) {
      if (this.busResend) {
        this.outBuffer.push(msg);   // 버스 failover 결과 재발행 소스 보관(0036). OFF 면 push 0 → 0035 비트 동일.
        if (this.busWindow > 0 && this.outBuffer.length > this.busWindow) this.outBuffer.shift();   // 미끄러지는 유계 창(이 step) — 최근 K 개만(K=0 면 미실행 = 0038 동일)
      }
      this.net.send(this.addr, this.bus, { type: 'pub', topic: 'svc.item.out', ev: msg });
    }
    else this.net.send(this.addr, this.gateway, msg);
  }
  // 버스 failover 결과 재발행(이 step·busResend) — 버스 복구(재구독) 직후 트리거. 보관한 결과를 svc.item.out 에 다시 pub.
  //   gap 에 떨군 결과(원장 적용·클라 미수신 → belief < 원장)를 재배달 → 게이트웨이가 클라에 중계 → belief 가 원장 따라잡음(itemDesync→0).
  //   클라 belief 는 Set add/delete 라 *멱등*(이미 받은 결과 재배달 무해) → consumer dedup 불요. 순수 반응형 제어 평면(존 tick 밖·신성한 tick 보존).
  //   OFF 면 호출돼도 즉시 반환(reg 0 불변). 재구독이 라우팅을 복구한 뒤라야 fan-out 됨(토폴로지가 reneg 다음에 트리거).
  resendOut() {
    if (!this.busResend || !this.bus) return;
    for (const msg of this.outBuffer) { this.net.send(this.addr, this.bus, { type: 'pub', topic: 'svc.item.out', ev: msg }); this.outResends++; }
  }
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
  }
  // 저널 홉 재전송(이 step·reliable) — persist 가 seq 갭을 감지해 보낸 NAK 에 응답: sentBuffer 의 미수신 항목을 다시 send(새 m.id·전송 손실 재노출).
  //   순수 반응형(onMsg·onTick 0 유지). persist 는 recvSeqs 로 멱등 수신(중복 push 0) → at-least-once 전송 위에 effectively-once 영속.
  _resend(missing) {
    for (const seq of missing) {
      const e = this.sentBuffer.get(seq);
      if (e) { this.net.send(this.addr, this.persist, { type: 'journal', entry: e, resend: true }); this.resends++; }   // resend:true — 재전송 사본 식별(전송층이 tail 시나리오에서 *최초 전송*만 떨굼 → 재전송은 신뢰 배달, 갭은 *감지* 문제로 격리)
    }
  }
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
  }
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
  }
  // 스냅샷 발신 — 현재 원장 상태(압축 베이스)를 persist 로. upToSeq = 직전 저널 항목 seq(스냅샷이 그 이하 효과를 *이미 반영*).
  //   ledger/mintTotal/minted/transfers 를 함께 — replay 가 이 베이스에서 tail 만 적용해 전체-저널 replay 와 비트 동일 재구성.
  _snapshot() {
    this.net.send(this.addr, this.persist, { type: 'snapshot', snap: {
      upToSeq: this.journalSeq - 1,
      ledger: [...this.ledger.entries()],
      mintTotal: this.mintTotal, minted: this.minted, transfers: this.transfers,
    } });
  }
  onMsg(m) {
    let p = m.payload;
    if (p.type === 'journal_nak') { if (this.reliable) this._resend(p.missing || []); return; }   // 저널 홉 NAK(0023) — persist 가 감지한 갭 재전송(reactive·신성한 tick 밖)
    if (p.type === 'journal_ack') { if (this.quorumW > 0) this._recordAck(p.seq, m.from); return; }   // 쓰기 정족수 ack(이 step) — 스토어 저장 확인 집계 → durableSeq 워터마크. quorumW 0 면 ack 자체가 안 옴(0028 비트 동일)
    if (p.type === 'ev' && p.topic === 'svc.item') p = p.ev;   // 버스 봉투 해체(구독 수신) — 직접 모드와 같은 item_req/item_reconcile
    // 요청 dedup(이 step·busResendReq) — 게이트웨이 재발행이 gap 전 도달분도 다시 보내므로 reqId 로 *최초 1회만* 처리(pickup 이중 mint 0).
    //   reqId 없으면(busResendReq OFF·재발행 미사용) 분기 휴면 = 0036 비트 동일. 멱등(Set dedup) — 재발행 무해.
    if (this.busResendReq && p.reqId !== undefined) {
      if (this.seenReqs.has(p.reqId)) return;   // 이미 처리(재발행 중복) — 폐기
      this.seenReqs.add(p.reqId);
    }
    if (p.type === 'item_reconcile') {
      // id-reconciliation(이 step·mintRecon) — 클라가 믿는 아이템 id 목록을 받아 원장에 없는 것을 re-mint(새 id).
      //   belief = 서버가 라이브로 확인한 사실 → crash 가 그 mint 저널을 소실했을 뿐 → 서버가 새 id 로 재발급(권위 재-확인).
      //   원장에 이미 있는 id(durable mint)는 skip → 멱등(중복 요청·give-resend 와 공존에도 dupe 0).
      //   결과 item_recon_map 은 _out 으로 → gateway 가 클라에 중계(은닉). 매핑이 없으면(전부 durable) 응답 없음(클라 belief 변경 0).
      const av = p.reqAvatar;
      // mintTotal 하한 보정: 클라가 신고한 id 중 mintTotal 이상인 것이 있으면 충돌 방지(xfer 손실 시 mintTotal 이 너무 낮을 수 있음)
      for (const id of (p.owned || [])) {
        const n = parseInt(String(id).slice(4), 10);
        if (Number.isFinite(n) && n >= this.mintTotal) this.mintTotal = n + 1;
      }
      const mappings = [];
      for (const oldId of (p.owned || [])) {
        if (this.ledger.get(oldId) === av) continue;   // 이미 원장에 있음(durable mint) — skip
        const newId = 'item' + (this.mintTotal++);
        this.ledger.set(newId, av); this._own(av, newId);
        this.minted++;
        this._journal({ kind: 'mint', itemId: newId, owner: av });   // re-mint 도 저널에 기록 → 이후 crash/replay 에도 유지
        mappings.push({ oldId, newId });
      }
      if (mappings.length > 0) this._out({ type: 'item_recon_map', reqAvatar: av, mappings });
      return;
    }
    if (p.type !== 'item_req') return;
    if (p.op === 'pickup') {
      const itemId = 'item' + (this.mintTotal++);   // 신규 아이템 mint(dupe 아님 — 새 itemId)
      this.ledger.set(itemId, p.avatar);
      this._own(p.avatar, itemId);
      this.minted++;
      this._journal({ kind: 'mint', itemId, owner: p.avatar });   // 영속 효과 로그 — 새 가방이 replay 로 이 원장을 재현
      this._out({ type: 'item_result', ok: true, op: 'pickup', reqAvatar: p.avatar, itemId });
    } else if (p.op === 'give') {
      const owner = this.ledger.get(p.itemId);
      if (owner === p.fromAvatar && p.toAvatar && p.toAvatar !== p.fromAvatar) {
        // 쌍 거래 — release(from) + acquire(to) 원자적. 원장·역인덱스 동시 갱신(둘 다 한 onMsg).
        this._unown(p.fromAvatar, p.itemId);
        this.ledger.set(p.itemId, p.toAvatar);
        this._own(p.toAvatar, p.itemId);
        this.transfers++;
        this._journal({ kind: 'xfer', itemId: p.itemId, from: p.fromAvatar, to: p.toAvatar });
        this._out({ type: 'item_result', ok: true, op: 'give', reqAvatar: p.fromAvatar, toAvatar: p.toAvatar, itemId: p.itemId });
      } else {
        // 미소유/이미 이동/자기자신 — 거부(중복 이동·phantom 0). net.log 엔 fail 만(원장 무변경·저널 무기록).
        this.failedOps++;
        this._out({ type: 'item_result', ok: false, op: 'give', reqAvatar: p.fromAvatar, itemId: p.itemId });
      }
    }
  }
  // crash — 프로세스 사망(RAM 소실)의 인프로세스 모델: 원장·역인덱스·카운터 전부 비운다. PersistStore 는 *별 박스*라 무관.
  crash() {
    this.ledger = new Map(); this.byOwner = new Map();
    this.mintTotal = 0; this.journalSeq = 0;
    this.sentBuffer = new Map(); this.resends = 0; this.journalHbs = 0;   // 신뢰 전달(0023) — 새 프로세스는 미-ack 버퍼 0(죽기 전 in-flight 는 소실 = §9 write-behind 윈도 잔존). heartbeat 계측도 리셋.
    this.ackSeqs = new Map(); this.durableSeq = -1; this.quorumAcks = 0; this.windowFills = 0;   // 쓰기 정족수·윈도 해소 상태 리셋(0029~0031) — 새 프로세스는 ack 집계/fill 계측 0(복구 후 다시 쌓임). quorumW 0 면 무관.
    this.outBuffer = []; this.outResends = 0;   // 버스 failover 결과 재발행 버퍼 리셋(0036) — 가방 crash 는 결과 버퍼도 소실(RAM). busResend OFF 면 무관.
    this.seenReqs = new Set();   // 요청 dedup 집합 리셋(이 step) — 새 프로세스는 처리 이력 0(busResendReq OFF 면 무관).
    this.minted = 0; this.transfers = 0; this.failedOps = 0;
  }
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
  }
  itemCount() { return this.ledger.size; }
  ownerOf(itemId) { return this.ledger.get(itemId); }
}

const __part = { InventoryService };
if (typeof module !== 'undefined' && module.exports) module.exports = __part;
if (typeof globalThis !== 'undefined') (globalThis.__HktNetParts = globalThis.__HktNetParts || {}).svc_inventory = __part;
