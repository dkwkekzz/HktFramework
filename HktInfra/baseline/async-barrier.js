'use strict';
// HktInfra async-barrier — #4 실 net.step 배리어 *실제* 치환 arc(0451~). async-net(0441~0450)이 실 Net 메시지·실 sim seam
//   위에서 배리어 치환 *in-proc 등가*를 증명한 뒤, 이 박스는 그 substrate 를 **실 `run()` 전송 배선**에 꽂는다:
//   run() 의 매 tick `net.step()`(중앙 lockstep 배리어) 대신 이 stepper 가 *월드 입력*(gateway→zone enter/move/leave)을
//   async substrate(Lamport 스탬프·holdback·resync)로 배달하고, 그 외 메시지·onTick 은 그대로. **`opts.asyncBarrier` OFF →
//   run() 이 이 박스를 만들지도 호출하지도 않음 → net.step() 그대로 = baseline 비트 동일(reg 구조적 0)**.
//   핵심: 실 존의 per-tick intent 적용은 *순서 무관*(위치 가산·교차-avatar 카운터 없음) → 재정렬은 월드 중립. substrate 의
//   load-bearing 가치는 ⒜ 배리어-free 진행 ⒝ 손실 복원(resync) — 그래서 worldDigest(run{asyncBarrier}) == worldDigest(run{})(lockstep).
// dual-mode: Node require / 브라우저는 common.js·async-core 를 <script> 선행 로드.
const __isNode = typeof module !== 'undefined' && module.exports && typeof require !== 'undefined';
const __c = __isNode ? require('./common.js') : globalThis.__HktNetCommon;
const __p = n => __isNode ? require('./' + n + '.js') : globalThis.__HktNetParts[n.replace(/-/g, '_')];
const AC = __p('async-core');   // Lamport 클럭·holdback·resync·전순서 원시(0431~0440) 재사용

// ── step-0451/0452 — 배리어 stepper: 인라인 배달 + 월드 입력 per-site Lamport 스탬프 ──
//   0451 은 이음새(투명)였고, 0452 는 stepper 가 net.step() 의 배달을 *직접* 인라인한다(같은 순서·같은 stats·같은 onTick → world/log
//   불변). 그 위에 *월드 입력*(zone 행 enter/move/leave)에 per-site Lamport 스탬프를 부여한다(site = intent 원발신자 sessionId/avatar).
//   0452 는 스탬프만 기록(재정렬 없음·배달 순서 net.step 동일) → world/log 불변(스탬프는 배리어 내부 기록·메시지/log 미변경).
//   이후 holdback(0453)·재정렬(0454)·resync(0455)가 이 스탬프를 소비. cfg = opts.asyncBarrier(현재 truthy·이후 {loss,pace} 등).
function makeAsyncBarrier(net, cfg) {
  const clocks = {};                 // site → Lamport 카운터(per-source 단조)
  let stamped = 0, held = 0, resyncs = 0;
  const isWorldInput = m => /^zone/.test(m.to) && m.payload && (m.payload.type === 'enter' || m.payload.type === 'move' || m.payload.type === 'leave');
  const siteOf = m => (m.payload && (m.payload.sessionId || m.payload.avatar)) || m.from;
  function stamp(m) { const s = siteOf(m); clocks[s] = (clocks[s] || 0) + 1; stamped++; return { m, site: s, lc: clocks[s] }; }
  // net.step() 의 per-message 배달을 verbatim 인라인(dedup·delay·stats·onMsg) — 배달 순서 동일 → world/log 불변.
  function deliverMsg(m) {
    if (net.delivered.has(m.id)) { net.stats.dupSkipped++; return; }
    net.delivered.add(m.id);
    const delay = net.tick - m.tick - 1;
    if (delay > net.stats.maxDelay) net.stats.maxDelay = delay;
    net.stats.deliveredN++;
    const a = net.actors.get(m.to);
    if (a && a.onMsg) a.onMsg(m);
  }
  // step-0453 — 정전(canonical) 순서 재구성 키 = 전역 발신 순서 m.id. 실 존은 *순서 민감*(enter 가 zone.rng() 소비·move 는
  //   entity 존재 요구) → 임의 재정렬은 월드 파괴. substrate 의 일 = 도착이 흐트러져도 *발신 순서(m.id)를 재구성*해 배달 → lockstep
  //   과 같은 순서 = 같은 월드. 한 tick 큐는 이미 발신 순서라 이 정렬은 항등(투명) — load-bearing 은 손실 복원(move·0455).
  const cmp = (a, b) => a.m.id - b.m.id;
  return {
    step() {
      net.tick++;
      const due = net.queue.get(net.tick) || [];
      net.queue.delete(net.tick);
      // step-0453 — 월드 입력을 holdback 버퍼로 모아 *발신 순서(m.id)*로 방출(정전 순서 재구성)·그 외는 원순서. 정상 run() 에선
      //   큐가 이미 발신 순서라 항등 → world/log 불변(투명·배리어 기계가 실 run() 전송에 실동작). 손실/지연 복원은 0455~.
      const world = [];
      for (const m of due) if (isWorldInput(m)) world.push(stamp(m));
      world.sort(cmp);                             // 월드 입력: 정전 순서(m.id) 재구성 — 정상 run() 항등
      let wi = 0;                                  // 월드 입력을 *제자리 슬롯*에 방출(비월드 위치 불변 → 상호작용 보존)
      for (const m of due) { if (isWorldInput(m)) { held++; deliverMsg(world[wi++].m); } else deliverMsg(m); }
      for (const a of net.order) if (a.onTick) a.onTick(net.tick);
    },
    flush() {},                          // 홀드백 잔여 flush(0455 resync 단계)·per-tick 방출은 no-op
    stats() { return { stamped, held, resyncs, sites: Object.keys(clocks).length }; },
  };
}

const __part = { makeAsyncBarrier };
if (typeof module !== 'undefined' && module.exports) module.exports = __part;
if (typeof globalThis !== 'undefined') (globalThis.__HktNetParts = globalThis.__HktNetParts || {}).async_barrier = __part;
