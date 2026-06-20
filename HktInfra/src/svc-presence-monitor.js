// step-0070 — 프레즌스 모니터/질의자 + active 재타깃(presenceAnnounce): 0069 의 질의자는 queryAddr 를 *고정*(primary)으로 가리켜 primary 사망 후 질의가 끊겼다(0069 §9). 이 step 은 svc.presence.active 공지를 구독해 승격된 박스로 queryAddr 를 *재타깃* — 죽음 후 질의도 승격된 박스가 답한다(읽기 경로 failover 연속성). 공지 미구독이면 재타깃 0 = 0069 비트 동일. (분할 preamble: 박스 1개=파일 1개·진입점 net-core.js)
// dual-mode: Node require / 브라우저는 common.js 를 <script> 선행 로드(전역 __HktNetCommon).
const __c = (typeof module !== 'undefined' && module.exports && typeof require !== 'undefined')
  ? require('./common.js') : globalThis.__HktNetCommon;
const { Net, LoginServer, SessionRegistry, mulberry32, fnv1a, DEFAULTS } = __c;

// ── [게임 서비스] PresenceMonitor — svc.presence 의 *둘째(셋째) 소비자*. 존 tick 밖 *순수 관찰형*(onTick 없음·발신 0 = 비-침습 구조적). ──
//   orch 가 발행한 건강 판정(down/up/permanent)을 소비해 소비자별 *상태 기계*를 유지: state(현재) + downCount/upCount/permCount(전이 회계).
//   발행자(orch)·다른 소비자(audit·ranking2) 무수정으로 얹힌다(0016 decouple) — 추가는 버스 구독 행 + 이 박스뿐. 권위 0(파생 뷰·"누가 어디에" 대시보드).
class PresenceMonitor {
  constructor(opts = {}) {
    this.state = new Map();       // consumer -> 'down'|'up'|'permanent' (현재 건강 상태 — 대시보드의 한 칸)
    this.downCount = new Map();   // consumer -> down 전이 누적(일시 의심 횟수)
    this.upCount = new Map();     // consumer -> up 전이 누적(회복 횟수)
    this.permCount = new Map();   // consumer -> permanent 전이 누적(포기 횟수)
    this.events = 0;              // 소비한 svc.presence 이벤트 누적(발행 수와 1:1 대조 — 무손실 관측)
    // SSOT 질의자(step-0069·presenceQuery) — 프레즌스 박스의 읽기 인터페이스 호출처. svc.presence 이벤트를 받을 때마다 queryFor 소비자들의 *현재 상태*를 SSOT 에 질의(pull)해 queried 에 기록. queryAddr 미설정이면 질의 0 = 0063/0068 비트 동일(관찰만).
    this.queryAddr = opts.queryAddr || null;   // 프레즌스 SSOT 박스 주소(명시 의존·request/reply 경로). null 이면 질의 안 함.
    this.queryFor = opts.queryFor || [];       // 질의할 소비자 목록(관측 못 한 소비자도 포함 가능 — 독립 읽기 경로 증명).
    this.queried = new Map();     // consumer -> 질의로 받은 최신 state(pull 지식). 관측(state)과 대조용.
    this.queriesSent = 0;         // 보낸 presenceQuery 수(계측). repliesRecv = 받은 응답 수(1:1 = 무손실 읽기).
    this.repliesRecv = 0;
    this.retargets = 0;           // active 재타깃 수(step-0070·svc.presence.active 공지 수신 — failover 시 1).
  }
  onMsg(m) {
    const p = m.payload;
    // active 재타깃(step-0070·presenceAnnounce) — 승격된 박스가 svc.presence.active 로 공지한 새 active 주소로 queryAddr 갱신. 이후 질의가 승격된 박스로 간다(읽기 경로 failover 디스커버리). 미구독이면 미발화(0069 비트 동일).
    if (p.type === 'ev' && p.topic === 'svc.presence.active' && p.ev) { this.queryAddr = p.ev.addr; this.retargets++; return; }
    // SSOT 질의 응답 수신(step-0069) — 프레즌스 박스가 회신한 현재 상태. queried 에 기록(pull 지식). 발행으로 못 본 소비자 상태도 여기서 알게 된다.
    if (p.type === 'presenceReply') { this.queried.set(p.consumer, p.state); this.repliesRecv++; return; }
    if (p.type !== 'ev' || p.topic !== 'svc.presence' || !p.ev) return;
    const { kind, consumer } = p.ev;
    this.events++;
    this.state.set(consumer, kind);   // 마지막 전이가 현재 상태(down→up→permanent 순서대로 덮어씀)
    const bump = (mp) => mp.set(consumer, (mp.get(consumer) || 0) + 1);
    if (kind === 'down') bump(this.downCount);
    else if (kind === 'up') bump(this.upCount);
    else if (kind === 'permanent') bump(this.permCount);
    // 관측한 전이마다 SSOT 질의(pull) — queryFor 소비자들의 현재 상태를 프레즌스 박스에 묻는다(관측↔SSOT 대조·구독 못 한 소비자 보강). queryAddr 없으면 미발화(비-침습 관찰형 유지).
    if (this.queryAddr) for (const c of this.queryFor) { this.net.send(this.addr, this.queryAddr, { type: 'presenceQuery', consumer: c }); this.queriesSent++; }
  }
  stateOf(consumer) { return this.state.get(consumer) || null; }
  queriedOf(consumer) { return this.queried.get(consumer) || null; }
}

const __part = { PresenceMonitor };
if (typeof module !== 'undefined' && module.exports) module.exports = __part;
if (typeof globalThis !== 'undefined') (globalThis.__HktNetParts = globalThis.__HktNetParts || {}).svc_presence_monitor = __part;
