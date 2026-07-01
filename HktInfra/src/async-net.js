'use strict';
// HktInfra async-net — #4 실 net.step 배리어 치환 arc(0441~). async-core(0431~0440)가 *추상 이벤트*로 증명한
//   논리 클럭·인과 정렬 substrate 를, 이 박스가 **실 engine Net 메시지 형태**(from/to/payload)와 **동결 sim seam(DummySimCore)**
//   에 잇는다 — DownClient/UpClient 가 in-proc 먼저였듯, 실 net.step() 중앙 lockstep 배리어를 *치환할* 기계를
//   먼저 실 메시지·실 월드 상태 위에서 증명한다. 이 박스는 run() 경로가 호출하지 않는다 → run() 비트 불변(reg 구조적 0).
//   substrate 원시(Lamport 클럭·holdback·전순서·resync·회계)는 async-core 를 *재사용*한다(복제 금지).
// dual-mode(검증 전용·Node): common.js(engine 재노출) + async-core 재사용. 브라우저는 <script> 선행 로드.
const __isNode = typeof module !== 'undefined' && module.exports && typeof require !== 'undefined';
const __c = __isNode ? require('./common.js') : globalThis.__HktNetCommon;
const __p = n => __isNode ? require('./' + n + '.js') : globalThis.__HktNetParts[n.replace(/-/g, '_')];
const { mulberry32, fnv1a } = __c;
const AC = __p('async-core');   // 논리 클럭·holdback·전순서·resync·회계 원시(0431~0440) 재사용
const __eng = __isNode ? require('../engine/index.js') : globalThis.HktEngine;   // 동결 sim seam(DummySimCore) — 실 월드 상태 fold 용

// ── step-0441 — 실 Net 메시지 형태 intent 스트림 + per-client Lamport 스탬프 ──
//   오늘 결정론은 net.step() 이 모든 참여자를 한 동기 tick 으로 묶어 *중앙 큐 하나*로 배달함이 떠받친다. #4 는 이를 해제한다 —
//   그러려면 먼저 *실 전송 메시지*(gateway→zone 의 월드 입력 intent)를 논리 클럭으로 스탬프해야 한다. 다중 client(발신 site)가
//   각자 Lamport 클럭으로 intent 를 발신 → 이벤트 로그 + program-order 간선(같은 client 연속). client 끼리 인과 없음(각자 독립
//   발신) → 전순서 tie-break 는 site 로(0433). 메시지 형태 = 실 Net 계약: { id, from:'client'+s, to:'zone1', payload:{type:'intent',...} }.
//   결정: 시드 PRNG 만(Math.random 0). 같은 (seed, clients, avatars, msgs) → 같은 로그(재현).
function worldIntentStream(seed, { clients = 4, avatars = 4, msgs = 40 } = {}) {
  const rnd = mulberry32((seed ^ 0x4E7C) >>> 0);
  const clocks = Array.from({ length: clients }, (_, s) => AC.makeLamportClock('c' + s));
  const avatarIds = Array.from({ length: avatars }, (_, a) => 'a' + a);
  const events = [];              // { id, site, from, to, lc, kind:'intent', payload }
  const edges = [];               // [aId, bId] — a happens-before b (program order·같은 client)
  const lastEvId = new Array(clients).fill(-1);
  let nextId = 0;
  for (let k = 0; k < msgs; k++) {
    const site = rnd() % clients;
    const lc = clocks[site].send();                       // 발신 이벤트 — 클럭 1 전진
    const avatar = avatarIds[rnd() % avatars];
    const dx = (rnd() % 3) - 1;                            // {-1,0,1}
    const dy = (rnd() % 3) - 1;
    const id = nextId++;
    events.push({ id, site, from: 'client' + site, to: 'zone1', lc, kind: 'intent', payload: { type: 'intent', avatar, dx, dy } });
    if (lastEvId[site] >= 0) edges.push([lastEvId[site], id]);
    lastEvId[site] = id;
  }
  return { events, edges, avatars: avatarIds, finalClocks: clocks.map(c => c.now()) };
}
// 스트림 서명 — (site,lc,avatar,dx,dy) 열 해시(재현 대조용·도착 무관 내용 함수).
function streamSig(events) {
  return fnv1a(events.map(e => e.site + ':' + e.lc + ':' + e.payload.avatar + ':' + e.payload.dx + ',' + e.payload.dy).join('|'));
}

// ── step-0442 — 배달 순서대로 동결 sim seam(DummySimCore)에 fold → 실 월드 상태 다이제스트 ──
//   async-core 의 applyDigest 는 *추상* fnv fold 였다. 실 net.step 배리어 치환은 결국 *실 월드 상태*의 수렴을 뜻하므로,
//   여기서는 배달된 intent 를 **동결 ISimCore(DummySimCore·engine)** 에 순차 tick 으로 접어 serialize()·해시를 낸다.
//   핵심(순서 민감): DummySimCore.counter 는 매 tick 전 avatar 위치를 누적 해시 → 같은 intent 라도 *적용 순서가 다르면* 다른
//   serialize()(위치는 가환이어도 counter 가 갈림). 그래서 totalOrder(0433)로 정규화한 fold 는 *도착 순열 불변*(수렴 다이제스트) —
//   반대로 raw 도착 순서 fold 는 갈릴 수 있다(substrate 가 load-bearing 인 이유). avatar 는 정렬 순 spawn(결정론).
function simFold(orderedEvents, seed, avatars) {
  const sim = __eng.DEFAULT_MAKE_SIM(seed >>> 0);   // DummySimCore(seed)
  for (const a of avatars.slice().sort()) sim.spawn(a);
  for (const e of orderedEvents) sim.tick([{ avatar: e.payload.avatar, intent: { dx: e.payload.dx, dy: e.payload.dy } }]);
  const ser = sim.serialize();
  return { ser, digest: fnv1a(ser) };
}

// ── step-0443 — 존 수신 메일박스: 스트리밍 holdback 재정렬(교차-client 재정렬 안정 방출) ──
//   0442 simFold 는 *전체 집합이 손에 있을 때* totalOrder 로 정규화했다. 실제 존은 intent 를 *교차-client 재정렬*로
//   스트림으로 받는다(client 별 링크는 FIFO·client 끼리 임의 인터리빙). makeZoneMailbox 는 async-core.makeHoldback 을
//   재사용해 low-water-mark 안정성으로 *도착하는 족족* 안전분만 점진 방출 → close 시 잔여 flush. 핵심: 어떤 인터리빙이든
//   방출열 == totalOrder(전체) → 그 방출열 simFold == canonical(수렴). beforeClose>0 = 진짜 점진 holdback(전체 대기 아님).
function makeZoneMailbox(nsites) {
  const hb = AC.makeHoldback(nsites);
  return {
    receive(msg) { hb.offer(msg); },                    // 실 Net intent 도착(교차-client 재정렬)
    close() { return hb.close(); },                     // 스트림 종료 → 잔여 전순서 flush
    delivered: hb.delivered, sig() { return hb.sig(); },
    beforeCloseCount() { return hb.beforeCloseCount(); },   // close 이전 방출 수(점진 holdback 증거)
  };
}

// ── step-0444 — 실 actor.onMsg 디스패치(net.step 배달 절반 치환) ──────────────
//   net.step() 은 두 일을 한다: ⒜ 도착 메시지를 actor.onMsg 로 *배달* ⒝ actor.onTick 진행. 이 조각은 ⒜(배달)를
//   중앙 배리어에서 떼어낸다: makeZoneActor 는 실 Net 메시지 계약(onMsg(m){ m.payload → 동결 sim tick })을 든 *실 수신
//   actor*, deliverToActor 는 존 메일박스 holdback 방출열을 그 actor.onMsg 로 흘린다. net.step 의 전역 FIFO 큐 대신
//   substrate 가 재구성한 전순서로 배달 → actor 의 실 sim 상태 == canonical(전 인터리빙 불변). onTick(진행)은 아직 lockstep.
function makeZoneActor(seed, avatars) {
  const sim = __eng.DEFAULT_MAKE_SIM(seed >>> 0);
  for (const a of avatars.slice().sort()) sim.spawn(a);
  let applied = 0;
  return {
    addr: 'zone1', kind: 'zone',
    onMsg(m) { const p = m && m.payload; if (p && p.type === 'intent') { sim.tick([{ avatar: p.avatar, intent: { dx: p.dx, dy: p.dy } }]); applied++; } },
    appliedN() { return applied; }, serialize() { return sim.serialize(); }, digest() { return fnv1a(sim.serialize()); },
  };
}
function deliverToActor(orderedMsgs, actor) { for (const m of orderedMsgs) actor.onMsg(m); return actor; }

// ── step-0445 — 손실 하 존 수신: per-client sseq gap-resync ──────────────────
//   0443 메일박스 holdback 은 *client 링크 FIFO* 가 깨지면(intent 누락) 무너진다 — 빠진 lc 를 건너뛰고 오방출. 실 전송은
//   손실이 있으므로(net.step transport loss), 각 intent 에 per-client 연속 시퀀스(sseq)를 붙여 *연속분만* 안쪽 holdback 에
//   넘긴다 → sseq 가 expected 를 앞지르면 hole=손실 감지·재전송(resync)으로 채우면 frontier 전진. async-core.makeResyncSite
//   재사용. 이로써 손실+재정렬 아래서도 방출열 == totalOrder → simFold 수렴. (다운스트림 egress gap-resync 의 논리 클럭 판.)
function makeZoneResync(nsites) {
  const site = AC.makeResyncSite(nsites);
  return {
    receive(e) { site.receive(e); }, resync(e) { site.resync(e); },
    finish() { return site.finish(); }, missing() { return site.missing(); },
    gaps() { return site.gaps(); }, resyncs() { return site.resyncs(); },
  };
}

const __part = { worldIntentStream, streamSig, simFold, makeZoneMailbox, makeZoneActor, deliverToActor, makeZoneResync };
if (typeof module !== 'undefined' && module.exports) module.exports = __part;
if (typeof globalThis !== 'undefined') (globalThis.__HktNetParts = globalThis.__HktNetParts || {}).async_net = __part;
