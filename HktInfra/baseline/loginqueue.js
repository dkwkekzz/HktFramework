'use strict';
// step-0209 — 로그인 큐 박스 분리: enqueue/dequeue 기본(loginQueue·loginEnqueue/loginDequeue). 접속 폭주를 엣지에서 대기열로 흡수하고 순서대로 티켓 발급. loginQueue OFF 면 박스 0 = 0208 비트 동일(reg 0).
// dual-mode: Node require / 브라우저는 common.js 선행 로드(전역 __HktNetCommon).
const __c = (typeof module !== 'undefined' && module.exports && typeof require !== 'undefined')
  ? require('./common.js') : globalThis.__HktNetCommon;
const { Net, LoginServer, SessionRegistry, mulberry32, fnv1a, DEFAULTS } = __c;

// ── [엣지] LoginQueue — 로그인 대기열 + 세션 티켓 발급(SPINE 계층1 엣지·로그인/인증). 접속 폭주(오픈/이벤트)를 *엣지에서* 대기열로 끝낸다 → 월드에 안 닿는다. 존 tick 밖·*순수 반응형*(onTick 없음). ──
//   왜 분리(SPINE §2): 오픈/이벤트 접속 폭주가 월드까지 밀려오면 시뮬이 죽는다 → 대기열은 엣지에서 끝나야 한다(0001 LoginServer 일회 티켓 스텁의 *대기열* 실체화·§3 격차 메움). 1차 너비는 *기본 통신*만: 줄 세우고(enqueue) 순서대로 티켓 발급(dequeue)까지(만료는 0210).
//   FIFO 공정성: 먼저 줄 선 플레이어가 먼저 입장(결정론 순서). 중복 enqueue 는 멱등(같은 player 한 자리).
class LoginQueue {
  constructor(opts = {}) {
    this.queue = [];           // [player...] — 대기열 FIFO(엣지 흡수·먼저 줄 선 순서).
    this.admitted = new Map(); // player -> { ticket } (입장 허가·티켓 발급 SSOT).
    this.ticketSeq = 0;        // 티켓 시퀀스(단조·결정론 id).
    this.enqueues = 0;         // 처리한 loginEnqueue 수(계측·중복 멱등 포함).
    this.dequeues = 0;         // 처리한 loginDequeue 수(계측·빈 큐 no-op 포함).
    this.net = null; this.addr = null;   // net.register 가 주입(send 경로).
  }
  // 줄 세우기(step-0209) — player 를 대기열 뒤에 붙인다. 이미 줄섰거나 입장한 player 는 멱등 no-op(한 자리). 접속 폭주를 엣지가 흡수.
  _enqueue(player) {
    if (this.queue.includes(player) || this.admitted.has(player)) return false;
    this.queue.push(player); return true;
  }
  // 입장 허가(step-0209) — 대기열 맨 앞 player 를 빼서 세션 티켓 발급(FIFO·먼저 줄 선 순서). 빈 큐면 no-op. 발급된 티켓은 admitted SSOT.
  _dequeue() {
    if (this.queue.length === 0) return null;
    const player = this.queue.shift();
    const ticket = 'tkt-' + (++this.ticketSeq);
    this.admitted.set(player, { ticket });
    return { player, ticket };
  }
  onMsg(m) {
    const p = m.payload;
    if (p.type === 'loginEnqueue') { this._enqueue(p.player); this.enqueues++; return; }
    if (p.type === 'loginDequeue') { this._dequeue(); this.dequeues++; return; }
  }
  // 질의 인터페이스 — 대기열 길이/순번·티켓(엣지 상태 읽기). 게이트웨이/검증이 쓴다.
  queueLength() { return this.queue.length; }
  positionOf(player) { const i = this.queue.indexOf(player); return i < 0 ? -1 : i; }
  ticketOf(player) { const a = this.admitted.get(player); return a ? a.ticket : null; }
  admittedCount() { return this.admitted.size; }
}

const __part = { LoginQueue };
if (typeof module !== 'undefined' && module.exports) module.exports = __part;
if (typeof globalThis !== 'undefined') (globalThis.__HktNetParts = globalThis.__HktNetParts || {}).loginqueue = __part;
