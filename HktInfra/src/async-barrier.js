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

// ── step-0451 — 배리어 stepper seam(투명 pass-through) ────────────────────────
//   첫 조각은 *이음새*만 세운다: run() 이 net.step() 대신 부를 stepper 를 만들되, 아직 아무 것도 가로채지 않고 net.step() 에
//   그대로 위임(투명). 이후 step 이 월드 입력 스탬프(0452)·holdback(0453)·재정렬(0454)·resync(0455)를 이 seam 에 얹는다.
//   cfg = opts.asyncBarrier 값(현재 truthy 여부만). 투명 단계라 ON 이어도 net.step() 과 동일 → world/log 불변.
function makeAsyncBarrier(net, cfg) {
  return {
    step() { net.step(); },      // 투명 pass-through(0451) — 이후 step 이 월드 입력 배달만 substrate 로 치환
    flush() {},                  // 홀드백 잔여 flush(0453~)·투명 단계는 no-op
    stats() { return { stamped: 0, held: 0, resyncs: 0 }; },
  };
}

const __part = { makeAsyncBarrier };
if (typeof module !== 'undefined' && module.exports) module.exports = __part;
if (typeof globalThis !== 'undefined') (globalThis.__HktNetParts = globalThis.__HktNetParts || {}).async_barrier = __part;
