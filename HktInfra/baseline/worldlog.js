'use strict';
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
    this.net = null; this.addr = null;   // net.register 가 주입(send 경로).
  }
  // intent append(step-0207·기본) — 세계 상태 변경 intent 를 durable 로그에 적층(append-only). 존/게이트웨이가 매 tick 의 intent 를 흘려보낸다. 결정론: 로그 순서가 상태를 결정.
  _append(intent) { this.journal.push({ seq: ++this.jseq, intent }); }
  onMsg(m) {
    const p = m.payload;
    // append 요청(worldAppend) — {intent} → intent 로그에 적층. 미래엔 주기 스냅샷+replay 재구성(0208~). 지금은 기본 통신만.
    if (p.type === 'worldAppend') { this._append(p.intent); this.appends++; return; }
  }
  // 질의 인터페이스 — 로그 길이/항목(event sourcing 읽기). 검증·replay(0208)가 쓴다.
  length() { return this.journal.length; }
  at(seq) { const e = this.journal.find(e => e.seq === seq); return e ? e.intent : undefined; }
}

const __part = { WorldLog };
if (typeof module !== 'undefined' && module.exports) module.exports = __part;
if (typeof globalThis !== 'undefined') (globalThis.__HktNetParts = globalThis.__HktNetParts || {}).worldlog = __part;
