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

const __part = { worldIntentStream, streamSig };
if (typeof module !== 'undefined' && module.exports) module.exports = __part;
if (typeof globalThis !== 'undefined') (globalThis.__HktNetParts = globalThis.__HktNetParts || {}).async_net = __part;
