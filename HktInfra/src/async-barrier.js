'use strict';
// HktInfra async-barrier — #4 실 net.step 배리어 *실제* 치환 arc(0451~) + 완전 async 전환 다중 존 유계 resync 가드(0462~). async-net(0441~0450)이 실 Net 메시지·실 sim seam
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
  const C = (cfg && typeof cfg === 'object') ? cfg : {};
  // step-0454 — move 손실+resync: 배리어가 *move* 만 확률 손실(enter/leave 는 rng/존재 민감이라 무손실)·resync 로 재전송.
  //   move 는 위치 가산(가환)이라 늦게 적용돼도 최종 월드 동일 → 복원만 하면 world==lockstep. resyncDelay tick 뒤 재enqueue.
  const lossRate = C.loss || 0;
  const doResync = C.resync !== false;             // 기본 true(0455 에서 false 대조)
  const resyncDelay = C.resyncDelay || 2;
  const endTick = C.ticks || Infinity;             // 재전송이 끝나기 전 배달·적용되도록 마지막 여유 tick 은 무손실(past-end 방지)
  const lrnd = lossRate ? __c.mulberry32(((C.seed || 0) ^ 0x8ABB) >>> 0) : null;
  // step-0457 — 교차-tick 지연 jitter: move 를 확률적으로 1..delayMax tick 늦게 배달(손실 아님·항상 재enqueue). 배달 타이밍을
  //   tick 배리어에서 분리(배리어-free 진행 판) — move 는 가환이라 늦게 적용해도 최종 월드 동일 → world==lockstep.
  const delayRate = C.delay || 0;
  const delayMax = C.delayMax || 3;
  const drnd = delayRate ? __c.mulberry32(((C.seed || 0) ^ 0x0DEC) >>> 0) : null;
  const delayedIds = new Set();      // 이미 한 번 지연된 move(재지연 없음·유계)
  let delayed = 0;
  const resyncedIds = new Set();     // 이미 한 번 resync 된 move id(재전송분은 재드롭 안 함 → 체인 길이 1·유계·확실 배달)
  const clocks = {};                 // site → Lamport 카운터(per-source 단조)
  let stamped = 0, held = 0, resyncs = 0, lost = 0;
  // step-0456 — exactly-once 회계: move 를 존에 *정확히 한 번* 배달했나(손실 하 복원해도 중복 0·유실 0).
  let moveDeliv = 0, moveDup = 0;    // moveDeliv=고유 배달·moveDup=이미 배달된 move 재배달 시도(dedup skip)
  let maxSpan = 0, deferN = 0;       // step-0465 — 유계 resync 회계: deferSpan=재배달 tick − defer tick(loss=resyncDelay·delay=1..delayMax). maxSpan < horizon 이면 이주 전 확실 재배달.
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
  // ── step-0462 (#4 완전 async 전환) — wrap-aware interior 유계 resync 가드 ──
  //   0451~0460 은 loss/delay 를 *단일 존*에서만 흡수(가환·무이주)했다. 다중 존에선 이주 타이밍이 바뀌면 lockstep 의
  //   move-drop 집합이 달라져 발산(0461·#72). 해법: barrier 가 소유 존을 peek 해 *interior* 인 move 만 loss/delay 로 흡수한다.
  //   interior = 엔티티가 자기 region 양 끝(경계 + wrap 경계 둘 다)에서 horizon 이상 떨어짐 → deferred move 가 재배달되기 전
  //   엔티티가 이주 경계에 닿을 수 없다(이주 전 유계 resync). 그래서 이주에 간섭하지 않고 world==lockstep 보존.
  //   ownerZone·region 접근은 barrier ON 경로에서만(OFF→net.step·reg 0). loss/resync(0462)·delay(0463) 둘 다 interior 게이트.
  const horizon = Math.max(resyncDelay, delayMax) + 1;   // deferred move 는 horizon tick 내 재배달(resync/delay 상한)
  function ownerZone(av) { for (const a of net.actors.values()) if (a && a.ents && typeof a.isAuthority === 'function' && a.isAuthority() && a.ents.has(av)) return a; return null; }
  function interior(wm) { const z = ownerZone(wm.payload.avatar); if (!z) return false; const e = z.ents.get(wm.payload.avatar); return (e.x - z.region.lo) >= horizon && (z.region.hi - 1 - e.x) >= horizon; }
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
      for (const m of due) {
        if (!isWorldInput(m)) { deliverMsg(m); continue; }
        const wm = world[wi++].m; held++;
        // step-0454 — move 손실+resync: move 만 확률 드롭(재전송분·enter/leave 는 무손실)·resync 로 resyncDelay tick 뒤 재enqueue.
        if (lrnd && wm.payload.type === 'move' && interior(wm) && !resyncedIds.has(wm.id) && net.tick + resyncDelay + 1 < endTick && (lrnd() % 1000) < Math.floor(lossRate * 1000)) {
          if (doResync) { resyncedIds.add(wm.id); net._enqueue(net.tick + resyncDelay, wm); resyncs++; deferN++; if (resyncDelay > maxSpan) maxSpan = resyncDelay; }   // 재전송(가환 move·재드롭 없음→유계·확실 배달·span=resyncDelay)
          else lost++;                                                             // 무-resync 대조(0455)
          continue;                                                               // 이번 배달은 드롭(net.delivered 미등록)
        }
        // step-0457 — 교차-tick 지연: move 를 1..delayMax tick 늦게 재enqueue(재지연 없음·past-end 방지). 손실 아님.
        if (drnd && wm.payload.type === 'move' && interior(wm) && !delayedIds.has(wm.id) && net.tick + delayMax + 1 < endTick && (drnd() % 1000) < Math.floor(delayRate * 1000)) {
          const dspan = 1 + (drnd() % delayMax); delayedIds.add(wm.id); delayed++; deferN++; if (dspan > maxSpan) maxSpan = dspan; net._enqueue(net.tick + dspan, wm); continue;
        }
        if (wm.payload.type === 'move') { if (net.delivered.has(wm.id)) moveDup++; else moveDeliv++; }   // 회계: 고유 배달 vs 중복
        deliverMsg(wm);
      }
      for (const a of net.order) if (a.onTick) a.onTick(net.tick);
    },
    flush() {},                          // 홀드백 잔여 flush(0455 resync 단계)·per-tick 방출은 no-op
    stats() { return { stamped, held, resyncs, lost, delayed, moveDeliv, moveDup, deferN, maxSpan, horizon, sites: Object.keys(clocks).length }; },
  };
}

const __part = { makeAsyncBarrier };
if (typeof module !== 'undefined' && module.exports) module.exports = __part;
if (typeof globalThis !== 'undefined') (globalThis.__HktNetParts = globalThis.__HktNetParts || {}).async_barrier = __part;
