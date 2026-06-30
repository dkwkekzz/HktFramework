'use strict';
// HktInfra async-core — #4 진짜 비동기(lockstep 배리어 해제)를 위한 *논리 클럭·인과 정렬* substrate.
//   오늘 결정론은 net.step() 의 중앙 lockstep 배리어가 떠받친다(모든 참여자가 동기 tick 으로 전진). #4 는 이를 해제하되
//   결정론(같은 이벤트 multiset → 같은 수렴 상태)을 지키는 것 — 그러려면 메시지가 *물리적으로 다른 순서*로 도착해도
//   인과(happens-before)를 복원해 *결정론 전순서*로 적용해야 한다. 그 기계(Lamport 클럭·전순서·holdback·인과 배달·수렴)를
//   이 박스가 든다. 다운스트림(DownClient)·업스트림(UpClient)처럼 *in-proc substrate 를 먼저* 증명하고, 실 전송 배선(net.step
//   배리어 치환)은 후속 arc. 이 박스는 run() 경로가 호출하지 않는다 → run() 비트 불변(reg 구조적 0).
// dual-mode: Node require / 브라우저는 common.js 를 <script> 선행 로드(전역 __HktNetCommon).
const __isNode = typeof module !== 'undefined' && module.exports && typeof require !== 'undefined';
const __c = __isNode ? require('./common.js') : globalThis.__HktNetCommon;
const { mulberry32, fnv1a } = __c;

// ── step-0431 — Lamport 논리 클럭 원시 ──────────────────────────────────────
//   Lamport(1978): 각 site 가 단조 증가 카운터를 들고 ⒜ 로컬/발신 이벤트마다 1 전진 ⒝ 수신 시 max(local,msgT)+1.
//   이 규칙이 보장하는 것(clock condition): a → b (happens-before) ⇒ C(a) < C(b). 인과는 항상 스탬프 증가로 나타난다.
//   (역은 아님 — C(a)<C(b) 라고 a→b 는 아님. 전순서 tie-break 는 0433 에서 site 로.)
function makeLamportClock(site) {
  let t = 0;
  return {
    site,
    now() { return t; },
    // 로컬 이벤트 — 클럭 1 전진 후 스탬프 반환(이 이벤트의 논리 시각).
    local() { return ++t; },
    // 발신 — 로컬 이벤트와 동일(스탬프를 메시지에 실어 보낸다).
    send() { return ++t; },
    // 수신 — C = max(local, msgT) + 1. 받은 인과보다 반드시 큰 시각을 갖는다(clock condition 유지).
    recv(msgT) { t = Math.max(t, msgT >>> 0) + 1; return t; },
  };
}

// ── step-0432 — 다중 site send/recv 인과 규칙 + clock condition 검증 substrate ──
//   N site 가 Lamport 클럭으로 메시지를 주고받는 결정론 스케줄을 돌려 *이벤트 로그 + happens-before 간선*을 낸다.
//   링크는 FIFO(이 step 은 순서 보존 배달 — 재정렬은 0434). 인과 간선 = ⒜ program order(같은 site 연속 이벤트) ⒝ send→recv.
//   clock condition(Lamport): 모든 간선 a→b 에서 C(a) < C(b). 이 함수가 그 substrate 를 만들고 0433~ 전순서/holdback 이 소비.
//   결정: 시드 PRNG 만(Math.random 0). 같은 (seed, sites, rounds) → 같은 로그(재현).
function lamportExchange(seed, { sites = 2, rounds = 24 } = {}) {
  const rnd = mulberry32((seed ^ 0x4A11) >>> 0);
  const clocks = Array.from({ length: sites }, (_, s) => makeLamportClock('s' + s));
  const seqOf = new Array(sites).fill(0);           // site 별 발신 시퀀스(FIFO 키)
  const inbox = Array.from({ length: sites }, () => []);  // 각 site 의 도착 대기(FIFO)
  const lastEvId = new Array(sites).fill(-1);        // program-order 간선용(같은 site 직전 이벤트)
  const events = [];                                 // { id, site, lc, kind, seq?, refId? }
  const edges = [];                                  // [aId, bId] — a happens-before b
  let nextId = 0;
  const emit = (site, lc, kind, extra) => {
    const id = nextId++;
    events.push({ id, site, lc, kind, ...extra });
    if (lastEvId[site] >= 0) edges.push([lastEvId[site], id]);  // program order
    lastEvId[site] = id;
    return id;
  };
  for (let r = 0; r < rounds; r++) {
    const site = rnd() % sites;
    const hasInc = inbox[site].length > 0;
    const choice = rnd() % 3;   // 0 local · 1 send · 2 recv(가능하면)
    if (choice === 2 && hasInc) {
      const msg = inbox[site].shift();              // FIFO 배달
      const lc = clocks[site].recv(msg.sendLc);
      const id = emit(site, lc, 'recv', { refId: msg.sendEvId, from: msg.fromSite });
      edges.push([msg.sendEvId, id]);               // send → recv 인과 간선
    } else if (choice === 1 || (choice === 2 && !hasInc)) {
      const to = sites === 1 ? site : ((site + 1 + (rnd() % (sites - 1))) % sites);
      const lc = clocks[site].send();
      const seq = seqOf[site]++;
      const id = emit(site, lc, 'send', { seq, to });
      inbox[to].push({ fromSite: site, sendEvId: id, sendLc: lc, seq });
    } else {
      const lc = clocks[site].local();
      emit(site, lc, 'local', {});
    }
  }
  return { events, edges, finalClocks: clocks.map(c => c.now()) };
}

// clock condition 검증 — 모든 happens-before 간선 a→b 에서 C(a) < C(b) 인가? (위반 간선 수 반환)
function clockConditionViolations(events, edges) {
  const lcOf = new Map(events.map(e => [e.id, e.lc]));
  let v = 0;
  for (const [a, b] of edges) if (!(lcOf.get(a) < lcOf.get(b))) v++;
  return v;
}

const __part = { makeLamportClock, lamportExchange, clockConditionViolations, _h: fnv1a, _rnd: mulberry32 };
if (typeof module !== 'undefined' && module.exports) module.exports = __part;
if (typeof globalThis !== 'undefined') (globalThis.__HktNetParts = globalThis.__HktNetParts || {}).async_core = __part;
