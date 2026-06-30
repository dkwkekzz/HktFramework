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

// ── step-0433 — 결정론 전순서(total order) — Lamport 시각 + site tie-break ──
//   인과(부분순서)만으론 동시(concurrent) 이벤트의 적용 순서가 안 정해진다. 결정론 수렴엔 *전순서*가 필요 →
//   Lamport 전순서: 키 = (lc, siteIndex). 같은 site 이벤트는 lc 가 엄격 증가(program order)·다른 site 동시 이벤트는
//   site 로 tie-break → 모든 이벤트가 *유일* 키를 가진다. clock condition(a→b⇒C(a)<C(b)) 덕에 이 순서는 인과를 존중한다
//   (동시 이벤트의 tie-break 만 임의·인과 무관). 핵심: 순서가 *내용의 함수*라서 어떤 물리 도착 순열이든 같은 전순서를 낸다.
const siteIdx = e => (typeof e.site === 'number' ? e.site : parseInt(String(e.site).replace(/^s/, ''), 10));
function totalOrderCmp(a, b) { return (a.lc - b.lc) || (siteIdx(a) - siteIdx(b)); }
function totalOrder(events) { return events.slice().sort(totalOrderCmp); }
// 전순서 서명 — 적용 순서의 id 열 해시(두 순열이 같은 전순서를 내는지 비교용).
function orderSig(events) { return fnv1a(events.map(e => e.id).join(',')); }
// 전순서가 *엄격*(동률 키 0)이며 *인과를 존중*(모든 간선 a→b 에서 pos(a)<pos(b))하는가? { strict, causal } 반환.
function totalOrderSound(events, edges) {
  const ord = totalOrder(events);
  let strict = true;
  for (let i = 1; i < ord.length; i++) if (totalOrderCmp(ord[i - 1], ord[i]) === 0) strict = false;
  const pos = new Map(ord.map((e, i) => [e.id, i]));
  let causal = true;
  for (const [a, b] of edges) if (!(pos.get(a) < pos.get(b))) causal = false;
  return { strict, causal, sig: orderSig(ord) };
}

// ── step-0434 — holdback 재정렬 버퍼(low-water-mark 안정성) ──────────────────
//   전순서(0433)는 *전체 집합이 손에 있을 때* 계산. 실제론 이벤트가 *교차-site 재정렬*로 도착한다(링크별 지연 상이).
//   holdback: 사이트별 링크는 FIFO(같은 site 이벤트는 발신 순서대로 도착)지만 site 끼리는 임의 인터리빙.
//   안정성 규칙 — lwm(low-water-mark) = min_s (그 site 에서 마지막으로 도착한 lc). 어떤 미래 이벤트든 lc > lwm 이므로,
//   lc ≤ lwm 인 버퍼 이벤트는 *더 작은 키가 더 못 온다*(FIFO 보장) → 전순서로 안전 방출. 미도착 site 1개라도 있으면 lwm=-1(보류).
//   close() = 스트림 종료 → 잔여 전부 전순서 flush. 핵심: 어떤 인터리빙이든 방출열 == totalOrder(전체).
function makeHoldback(nsites) {
  const maxSeen = new Array(nsites).fill(-1);   // site 별 마지막 도착 lc (FIFO → 그 site 의 lc 연속 frontier)
  let pending = [];
  const delivered = [];
  let beforeClose = 0;                          // close 이전에 방출된 수(진짜 holdback 증거)
  const lwm = () => { let m = Infinity; for (let s = 0; s < nsites; s++) m = Math.min(m, maxSeen[s]); return m; };
  function flushStable() {
    const w = lwm();
    if (w < 0) return;
    const ready = pending.filter(e => e.lc <= w);
    if (!ready.length) return;
    ready.sort(totalOrderCmp);
    for (const e of ready) delivered.push(e);
    pending = pending.filter(e => e.lc > w);
  }
  return {
    offer(e) { maxSeen[siteIdx(e)] = Math.max(maxSeen[siteIdx(e)], e.lc); pending.push(e); flushStable(); },
    close() { beforeClose = delivered.length; pending.sort(totalOrderCmp); for (const e of pending) delivered.push(e); pending = []; return delivered; },
    delivered, sig() { return orderSig(delivered); }, beforeCloseCount() { return beforeClose; },
  };
}

// ── step-0435 — 인과 의존 배달(dependency-based causal delivery) ─────────────
//   holdback(0434)은 *사이트별 FIFO* 가정에 기댄다. 인과 배달은 더 강하다: 각 이벤트의 *직접 인과 선행*(deps)을
//   명시 추적해, 그 선행이 모두 배달되기 전엔 보류 → FIFO 없이도(어떤 적대적 도착 순열이든) 원인→결과 순서를 보장.
//   deps(e) = happens-before 간선 a→e 의 a 집합(program order 선행 + 받은 send). DAG 라 deadlock 없음(전부 결국 배달).
function depsFromEdges(events, edges) {
  const deps = new Map(events.map(e => [e.id, []]));
  for (const [a, b] of edges) deps.get(b).push(a);
  return deps;
}
// arrival(물리 도착 순열)대로 버퍼에 넣되, deps 가 모두 delivered 면 방출(연쇄 flush). 반환 order = 인과 존중 배달열.
function causalDeliver(events, edges, arrival) {
  const deps = depsFromEdges(events, edges);
  const delivered = new Set();
  const order = [];
  const buf = [];
  const flush = () => {
    let progress = true;
    while (progress) {
      progress = false;
      for (let i = 0; i < buf.length; i++) {
        if (deps.get(buf[i].id).every(d => delivered.has(d))) {
          const e = buf.splice(i, 1)[0]; delivered.add(e.id); order.push(e); progress = true; i--;
        }
      }
    }
  };
  for (const e of arrival) { buf.push(e); flush(); }
  return { order, deliveredN: order.length, stuck: buf.length };
}
// 인과 위반 — 배달열에서 간선 a→b 의 pos(a)<pos(b) 위반 수.
function causalViolations(order, edges) {
  const pos = new Map(order.map((e, i) => [e.id, i]));
  let v = 0; for (const [a, b] of edges) if (!(pos.get(a) < pos.get(b))) v++; return v;
}

const __part = { makeLamportClock, lamportExchange, clockConditionViolations, totalOrder, totalOrderCmp, orderSig, totalOrderSound, makeHoldback, depsFromEdges, causalDeliver, causalViolations, _h: fnv1a, _rnd: mulberry32 };
if (typeof module !== 'undefined' && module.exports) module.exports = __part;
if (typeof globalThis !== 'undefined') (globalThis.__HktNetParts = globalThis.__HktNetParts || {}).async_core = __part;
