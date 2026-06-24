'use strict';
// step-0220 — 로그인 큐 재접속 세션 재개(loginReconnect): 아직 admitted(티켓 유효·미만료)인 player 가 재접속하면 *기존 티켓을 재개*(새 티켓 미발급·재큐 없음·멱등 세션 resume). 티켓 만료/미발급이면 재개 불가(reconnectMisses·재큐 필요). 끊겼다 금방 돌아온 세션이 줄을 다시 안 선다. loginReconnect 미수신이면 0219 비트 동일(reg 0). 2차 고도화(로그인 큐 #2·균형 라운드 닫기).
// step-0219 — 로그인 큐 수용량 백프레셔(loginCapacity): admitted 가 capacity 에 도달하면 dequeue 가 *입장 보류*(player 를 큐에 남김·rejectedByCapacity). 월드 동접 상한을 엣지에서 강제(폭주 시 줄이 늘되 월드는 capacity 이상 안 받는다). loginCapacity 미수신이면 capacity=∞ → 0218 비트 동일(reg 0). 2차 고도화(로그인 큐 #1).
// step-0210 — 로그인 티켓 만료(loginExpire): issuedAt+ttl≤now 인 발급 티켓 회수(들고만 있고 안 쓰는 티켓 무효화·엣지 자원 보호). loginExpire 미수신이면 0209 비트 동일(reg 0). 로그인 큐 박스 기본 통신 완비(= 너비 1차 마지막 박스).
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
    this.expires = 0;          // 처리한 loginExpire 스윕 수(step-0210·계측).
    this.expired = 0;          // 만료로 무효화된 티켓 누적 수(step-0210·issuedAt+ttl≤now).
    this.capacity = Infinity;  // 동시 입장 상한(step-0219·loginCapacity 로 설정·미설정이면 ∞=무제한=0218 거동).
    this.rejectedByCapacity = 0;   // 수용량 초과로 입장 보류된 dequeue 누적 수(step-0219·백프레셔 증거).
    this.reconnects = 0;       // 처리한 loginReconnect 수(step-0220·계측).
    this.resumes = 0;          // 기존 티켓 재개 성공 수(step-0220·아직 유효한 admitted player).
    this.reconnectMisses = 0;  // 재개 실패 수(step-0220·티켓 만료/미발급 → 재큐 필요).
    this.net = null; this.addr = null;   // net.register 가 주입(send 경로).
  }
  // 재접속 세션 재개(step-0220·loginReconnect) — 아직 admitted(유효 티켓) player 면 기존 티켓 그대로 재개(새 티켓 미발급·ticketSeq 불변·재큐 없음·멱등). 티켓 만료/미발급이면 재개 불가(null·재큐 필요). 끊겼다 금방 돌아온 세션이 줄을 다시 안 선다.
  _reconnect(player) {
    this.reconnects++;
    const a = this.admitted.get(player);
    if (a) { this.resumes++; return a.ticket; }   // 기존 티켓 재개(새 티켓 안 만듦).
    this.reconnectMisses++; return null;          // 만료/미발급 → 재개 불가(재큐 필요).
  }
  // 줄 세우기(step-0209) — player 를 대기열 뒤에 붙인다. 이미 줄섰거나 입장한 player 는 멱등 no-op(한 자리). 접속 폭주를 엣지가 흡수.
  _enqueue(player) {
    if (this.queue.includes(player) || this.admitted.has(player)) return false;
    this.queue.push(player); return true;
  }
  // 입장 허가(step-0209·0219 수용량) — 대기열 맨 앞 player 를 빼서 세션 티켓 발급(FIFO·먼저 줄 선 순서). 빈 큐면 no-op. admitted 가 capacity 도달이면 *입장 보류*(player 를 큐에 남김·백프레셔·step-0219). 발급된 티켓은 admitted SSOT. issuedAt(step-0210·만료 기준 tick).
  _dequeue(now) {
    if (this.queue.length === 0) return null;
    if (this.admitted.size >= this.capacity) { this.rejectedByCapacity++; return null; }   // 수용량 초과 → 입장 보류(player 큐 잔류·백프레셔). capacity=∞ 면 영영 미발화 = 0218 거동.
    const player = this.queue.shift();
    const ticket = 'tkt-' + (++this.ticketSeq);
    this.admitted.set(player, { ticket, issuedAt: now });
    return { player, ticket };
  }
  onMsg(m) {
    const p = m.payload;
    const now = (m.tick != null) ? m.tick : 0;
    if (p.type === 'loginEnqueue') { this._enqueue(p.player); this.enqueues++; return; }
    if (p.type === 'loginDequeue') { this._dequeue(now); this.dequeues++; return; }
    // 티켓 만료 스윕(step-0210·loginExpire) — issuedAt+ttl ≤ now 인 발급 티켓을 무효화(admitted 제거). 들고만 있고 안 쓰는 티켓을 회수(엣지 자원 보호·재접속/만료 토대). loginExpire 미수신이면 미발화 = 0209 비트 동일.
    if (p.type === 'loginExpire') {
      for (const [player, a] of [...this.admitted]) if (a.issuedAt + p.ttl <= now) { this.admitted.delete(player); this.expired++; }
      this.expires++; return;
    }
    // 수용량 설정(step-0219·loginCapacity) — {cap} → 동시 입장 상한 설정(월드 동접 상한을 엣지가 강제). 이후 dequeue 는 admitted<cap 일 때만 입장(초과는 보류·백프레셔). loginCapacity 미수신이면 capacity=∞ = 0218 비트 동일.
    if (p.type === 'loginCapacity') { this.capacity = (p.cap == null ? Infinity : p.cap); return; }
    // 재접속 세션 재개(step-0220·loginReconnect) — {player} → 유효 티켓이면 재개(새 티켓 미발급). loginReconnect 미수신이면 미발화 = 0219 비트 동일.
    if (p.type === 'loginReconnect') { this._reconnect(p.player); return; }
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
