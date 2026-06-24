'use strict';
// step-0228 — 월드 영속 fsync durable barrier(worldFsync/worldRecoverDurable): durableSeq 워터마크 = fsync 로 *디스크 확정*된 최대 seq(0227 flush=OS 페이지캐시 적층, fsync=물리 확정의 구분). worldRecoverDurable 은 seq≤durableSeq 만 replay(fsync 이후 tail 은 crash 시 미보장 — durability 의 *진짜* 경계). worldFsync 미수신이면 durableSeq 0·recoverDurable 미발화 = 0227 비트 동일(reg 0). 3차 고도화(월드영속 #2).
// step-0227 — 월드 영속 write-behind 버퍼(worldBuffer/worldFlush): intent 를 *버퍼*에 모았다 worldFlush 로 durable 로그에 일괄 적층(쓰기 지연·배치 = 매 intent 마다 디스크 안 때림·신성한 tick 보호). 버퍼는 비-durable(미flush 분은 crash 시 소실 — write-behind 의 본질적 윈도). worldBuffer/worldFlush 미수신이면 버퍼 빈 채 = 0226 비트 동일(reg 0). 3차 고도화(월드영속 #1).
// step-0214 — 월드 영속 정합 capstone(worldCrash/worldRecover): crash(투영 소실)→recover(스냅샷+tail replay) 를 *메시지 구동* 프로토콜로(슈퍼바이저가 복구를 명령). 스냅샷이 durable 해 crash 후에도 동일 digest 복원(스냅샷 load-bearing·tail 단독 불충분). worldCrash/worldRecover 미수신이면 0213 비트 동일(reg 0). 2차 고도화(월드영속 #2·스냅샷 arc 닫기).
// step-0213 — 월드 영속 스냅샷 압축(worldSnapshot): 투영을 스냅샷으로 굳히고 로그를 tail(스냅샷 이후 seq)로 절단. replay = 스냅샷+tail 재적용 = 전체-로그 replay 와 *비트 동일*(무손실 압축). intent 로그가 무한히 안 자라게(가방 0018/우편 0146/길드 0185 의 월드 판). worldSnapshot 미수신이면 0212 비트 동일(reg 0). 2차 고도화(월드영속 #1).
// step-0208 — 월드 영속 replay 재구성: durable intent 로그를 전수 재적용해 월드 상태 투영 복원(crash 후 로그만으로 동일 상태·event sourcing 핵심·복제=재현). worldLog OFF 면 박스 0 = 0206 비트 동일(reg 0). 월드 영속 박스 기본 통신 완비.
// step-0207 — 월드 영속 박스 분리: intent 로그 append 기본(worldLog·worldAppend). 세계 상태의 유일 쓰기 경로(intent)를 durable 로그로 event sourcing. worldLog OFF 면 박스 0 = 0206 비트 동일(reg 0).
// dual-mode: Node require / 브라우저는 common.js 선행 로드(전역 __HktNetCommon).
const __c = (typeof module !== 'undefined' && module.exports && typeof require !== 'undefined')
  ? require('./common.js') : globalThis.__HktNetCommon;
const { Net, LoginServer, SessionRegistry, mulberry32, fnv1a, DEFAULTS } = __c;

// ── [데이터] WorldLog — 월드(존) 상태의 *intent 로그* event sourcing(SPINE 계층6 데이터·TOOLS §3 데이터 3분할 ①). 세계 상태의 *유일 쓰기 경로*(intent·SPINE §4 경로1)를 durable 로그로 적층 → 로그만으로 상태 재구성. 서비스 PersistStore(효과 저널)·Redis(휘발)와 직교 — 월드 상태는 DB 행이 아니라 intent 로그로 산다. 존 tick 밖·onTick 없음. ──
//   왜 분리(SPINE §2·데이터 3분할): 월드 상태를 DB 행으로 저장하면 동기 디스크 I/O 가 tick 을 막는다 → 대신 *append-only intent 로그*(결정론 덕에 로그+시드만으로 동일 상태 재구성·복제=재현). 1차 너비는 *기본 통신*만: intent 를 로그에 적층하는 것까지(replay 재구성은 0208).
class WorldLog {
  constructor(opts = {}) {
    this.journal = [];         // [{seq, intent}] — 월드 intent durable 로그(append-only·event sourcing·세계의 유일 쓰기 경로).
    this.jseq = 0;             // 로그 시퀀스(단조).
    this.appends = 0;          // 처리한 worldAppend 수(계측).
    this._state = new Map();   // 파생 투영(entity -> {pos, items[]}) — 로그를 replay 해 얻는 월드 상태(휘발·crash 시 소실·로그서 재구성·step-0208).
    this.replays = 0;          // 처리한 replay 수(step-0208·계측).
    this.snapshot = null;      // 스냅샷(step-0213·entity->{pos,items} 깊은 복사) — replay 시작점. null 이면 빈 상태서 출발(0208 거동).
    this.snapshotSeq = 0;      // 스냅샷이 담은 최대 seq(step-0213·이하 로그는 절단·이상만 tail).
    this.snapshots = 0;        // 처리한 worldSnapshot 수(step-0213·계측).
    this.buffer = [];          // write-behind 버퍼(step-0227·미flush intent·비-durable·crash 시 소실 윈도).
    this.buffered = 0;         // 버퍼에 모인 intent 누적 수(step-0227·계측).
    this.flushes = 0;          // 처리한 worldFlush 수(step-0227·계측·빈 버퍼 no-op 포함).
    this.flushed = 0;          // flush 로 durable 로그에 적층된 intent 누적 수(step-0227).
    this.durableSeq = 0;       // fsync 로 디스크 확정된 최대 seq(step-0228·이 이하만 crash 후 보장·이상 tail 은 미보장).
    this.fsyncs = 0;           // 처리한 worldFsync 수(step-0228·계측).
    this.net = null; this.addr = null;   // net.register 가 주입(send 경로).
  }
  // fsync durable replay(step-0228·worldRecoverDurable) — 스냅샷서 출발해 seq≤durableSeq 인 tail 만 재적용(fsync 이후 미확정 tail 제외). 0208 replay 가 *전체* 로그를 가정한다면, 이건 디스크 확정 프런티어까지만 — crash 후 *진짜* 복구 가능한 상태. durableSeq 0 이면 스냅샷(또는 빈)만.
  _replayDurable() {
    this._state = this.snapshot ? this._cloneState(this.snapshot) : new Map();
    for (const e of this.journal.slice().sort((a, b) => a.seq - b.seq)) if (e.seq > this.snapshotSeq && e.seq <= this.durableSeq) this._apply(e.intent);
    this.recoversDurable = (this.recoversDurable || 0) + 1;
  }
  // write-behind flush(step-0227·worldFlush) — 버퍼에 모인 intent 를 durable 로그에 일괄 적층(순서 보존·배치 쓰기). flush 전엔 비-durable(crash 시 소실). 빈 버퍼면 멱등 no-op.
  _flush() {
    const n = this.buffer.length;
    for (const it of this.buffer) this._append(it);   // 순서 보존 적층(seq 단조).
    this.buffer = []; this.flushed += n; this.flushes++;
    return n;
  }
  // 투영 깊은 복사(step-0213) — 스냅샷 보관/복원용(entity 별 {pos, items[]} 독립 사본·참조 공유 0).
  _cloneState(s) { const m = new Map(); for (const [k, v] of s) m.set(k, { pos: v.pos, items: v.items.slice() }); return m; }
  // 스냅샷 압축(step-0213·worldSnapshot) — ① 전체 재구성(replay)로 투영을 현재화 → ② 그 투영을 스냅샷으로 굳히고 snapshotSeq=현재 jseq → ③ 로그를 tail(seq>snapshotSeq)만 남기고 절단. 다음 replay 는 스냅샷+tail = 전체 replay 와 동일(무손실). 로그가 무한히 안 자란다(저장 유계).
  _snapshot() {
    this.replay();                                       // 스냅샷+기존 tail 전수 재구성(투영 현재화).
    this.snapshot = this._cloneState(this._state);       // 현재 투영을 스냅샷으로 굳힘(깊은 복사).
    this.snapshotSeq = this.jseq;                        // 스냅샷이 담은 최대 seq.
    this.journal = this.journal.filter(e => e.seq > this.snapshotSeq);   // tail(이후 seq)만 보존 — 스냅샷에 접힌 로그 절단.
    this.snapshots++;
  }
  // intent append(step-0207·기본) — 세계 상태 변경 intent 를 durable 로그에 적층(append-only). 존/게이트웨이가 매 tick 의 intent 를 흘려보낸다. 결정론: 로그 순서가 상태를 결정.
  _append(intent) { this.journal.push({ seq: ++this.jseq, intent }); }
  // intent 적용(step-0208) — 한 intent 를 파생 투영에 반영(move→위치·pickup→소지). 결정론 reducer(같은 로그→같은 상태).
  _apply(it) {
    if (!it) return;
    const e = this._state.get(it.e) || { pos: null, items: [] };
    if (it.kind === 'move') e.pos = it.to;
    else if (it.kind === 'pickup') { if (!e.items.includes(it.item)) e.items.push(it.item); }
    this._state.set(it.e, e);
  }
  // replay 재구성(step-0208·0213 스냅샷 확장) — 투영을 *스냅샷서* 출발(없으면 빈 상태)하고 tail 로그(seq>snapshotSeq)를 seq 순서로 재적용 → 월드 상태 재구성. crash(투영 소실) 후에도 스냅샷+로그만으로 동일 상태 복원(event sourcing 핵심·복제=재현). 스냅샷 없으면 0208 거동(빈 상태서 전수).
  replay() {
    this._state = this.snapshot ? this._cloneState(this.snapshot) : new Map();
    for (const e of this.journal.slice().sort((a, b) => a.seq - b.seq)) if (e.seq > this.snapshotSeq) this._apply(e.intent);
    this.replays++;
  }
  // crash(step-0208) — 월드 상태 투영 소실(RAM·휘발)의 인프로세스 모델. *로그는 durable* 이라 살아남는다 → replay 로 복원. 데이터 계층이 세션보다 오래 산다.
  crash() { this._state = new Map(); }
  // 상태 다이제스트(step-0208) — 재구성된 투영의 결정론 해시(같은 로그→같은 해시·crash/replay 무손실 증거). entity 정렬로 순서 무관.
  stateDigest() {
    let h = 2166136261 >>> 0;
    const ser = [...this._state.entries()].sort((a, b) => a[0] < b[0] ? -1 : 1)
      .map(([k, v]) => k + ':' + v.pos + ':' + v.items.slice().sort().join(',')).join('|');
    for (let i = 0; i < ser.length; i++) { h ^= ser.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
    return '0x' + h.toString(16).padStart(8, '0');
  }
  onMsg(m) {
    const p = m.payload;
    // append 요청(worldAppend) — {intent} → intent 로그에 적층. replay 재구성은 0208(이미 위 메서드). 지금은 append 만 onMsg.
    if (p.type === 'worldAppend') { this._append(p.intent); this.appends++; return; }
    // 스냅샷 압축 요청(step-0213·worldSnapshot) — 투영을 스냅샷으로 굳히고 로그를 tail 로 절단(로그 저장 유계). worldSnapshot 미수신이면 미발화 = 0212 비트 동일.
    if (p.type === 'worldSnapshot') { this._snapshot(); return; }
    // crash 명령(step-0214·worldCrash) — 투영(RAM·휘발) 소실의 메시지 구동 모델. 스냅샷·tail 로그는 durable 이라 살아남는다. worldCrash 미수신이면 미발화 = 0213 비트 동일.
    if (p.type === 'worldCrash') { this.crash(); this.crashes = (this.crashes || 0) + 1; return; }
    // recover 명령(step-0214·worldRecover) — 슈퍼바이저가 복구를 명령 → 스냅샷+tail replay 로 투영 재구성(crash 후 무손실 복원·복제=재현). worldRecover 미수신이면 미발화 = 0213 비트 동일.
    if (p.type === 'worldRecover') { this.replay(); this.recovers = (this.recovers || 0) + 1; return; }
    // write-behind 버퍼 적층(step-0227·worldBuffer) — {intent} → durable 로그가 아니라 *버퍼*에 모은다(쓰기 지연·매 intent 디스크 안 때림). worldFlush 전엔 비-durable. worldBuffer 미수신이면 버퍼 빈 채 = 0226 비트 동일.
    if (p.type === 'worldBuffer') { this.buffer.push(p.intent); this.buffered++; return; }
    // write-behind flush(step-0227·worldFlush) — 버퍼를 durable 로그에 일괄 적층(배치). worldFlush 미수신이면 미발화 = 0226 비트 동일.
    if (p.type === 'worldFlush') { this._flush(); return; }
    // fsync durable barrier(step-0228·worldFsync) — 현재 jseq 까지를 디스크 확정(durableSeq=jseq). 이후 append(tail)는 다음 fsync 까지 미보장. worldFsync 미수신이면 durableSeq 0 = 0227 비트 동일.
    if (p.type === 'worldFsync') { this.durableSeq = this.jseq; this.fsyncs++; return; }
    // fsync durable replay(step-0228·worldRecoverDurable) — seq≤durableSeq tail 만 재구성(crash 후 진짜 복구 경계). worldRecoverDurable 미수신이면 미발화 = 0227 비트 동일.
    if (p.type === 'worldRecoverDurable') { this._replayDurable(); return; }
  }
  // 질의 인터페이스 — 로그 길이/항목·투영 상태(event sourcing 읽기). 검증·replay 가 쓴다.
  length() { return this.journal.length; }
  bufferLength() { return this.buffer.length; }   // step-0227·미flush(비-durable) intent 수.
  at(seq) { const e = this.journal.find(e => e.seq === seq); return e ? e.intent : undefined; }
  stateOf(e) { return this._state.get(e) || null; }
}

const __part = { WorldLog };
if (typeof module !== 'undefined' && module.exports) module.exports = __part;
if (typeof globalThis !== 'undefined') (globalThis.__HktNetParts = globalThis.__HktNetParts || {}).worldlog = __part;
