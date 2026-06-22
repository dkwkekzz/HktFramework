// htj-activity.js — HTJ 확장성 레버1↔레버3 경계: **활동도 추적 + 동결 판정**(S3, 시간 LOD 의 안전한 첫 형태).
//
//   문제(step_0024 가 남긴 다음 지렛대): 활성 집합(S2, htj-sparse createActiveSet)은 *빈 블록*만 건너뛴다.
//   그러나 별이 정착하면 그 내부는 *비어있지 않은데도 거의 안 변한다* — S2 는 그 블록을 여전히 매 step 돈다.
//   step_0024 가 박은 "셀은 희소화돼도 블록은 100% 점유" 천장도 같은 뿌리다(옅은 꼬리가 모든 블록에 잔류).
//   **변화가 멎은(quiet) 블록을 알아채 건너뛰는(동결) 것**이 — 빈 블록 너머의 — 다음 실현 절감이고,
//   동시에 design/scalability.md §4 S5 승격이 요구하는 "안정 판정"(언제 개체로 올릴지) 재료다.
//
//   처방(design §4 S3 "활동도(Δ누적) 임계 이하면 동결, 이웃 자극 시 깨움"):
//     · 블록마다 *활동도* = 직전 측정 이후 그 블록 안 장의 L∞ 변화(max|Δ|) 를 추적한다.
//     · 활동도 ≤ threshold 가 **holdSteps 연속**이면 그 블록을 *동결*(stable)로 판정 → 법칙이 건너뛴다.
//     · 활동도가 다시 threshold 를 넘으면 그 블록을 *깨운다*(연속 카운트 streak=0 리셋) → 다시 돈다.
//
//   비트 동일(관문, threshold=0): **per-cell 법칙**(fusion·cooling 등 이웃 stencil 없음)에서 활동도가
//   정확히 0 인 블록은 *값이 한 톨도 안 변하는* 블록이다 — 그 법칙을 거기서 돌려봐야 0 변화 → 건너뛰어도
//   조밀과 *byte 동일*. (stencil 법칙은 동결 블록이 활성 이웃의 flux 를 받을 수 있어 "이웃까지 quiet"
//   해야 안전 — 다음 step. step_0018→0020 의 per-cell→halo 진행과 동형이다.)
//
//   보존(척추): 동결은 *계산을 멈출 뿐 값을 안 건드린다* → 동결 블록의 Σρ·Σu 가 동결 동안 정확히 불변.
//   빈 블록 건너뜀(S2)과 같은 부류의 안전성 — 다만 여기선 "비-영인데 안 변하는" 블록까지 넓힌다.
//
//   이건 *컨테이너/스케줄러 층*(design §5 "가법성")일 뿐 — 법칙 코드를 대체하지 않고, 법칙은 여전히
//   opts.active=activeOrigins() 를 받아 돈다(step_0018~ 와 동일 인터페이스). createActiveSet 과 조합:
//   ActiveSet 이 *비-영* 블록 원점을 주면, 이 추적기가 그중 *quiet* 한 것을 빼고 *활성*만 돌려준다.
//
//   세계(법칙) 그 자체가 아니라 그 *스케줄러* — 렌더·캔버스·DOM 에 의존하지 않는다(Node 에서 그대로 돈다).
//   브라우저(viewer.html)·Node(verify.js) 양쪽에서 동일하게 동작(UMD).
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.HTJActivity = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const DEFAULT_BLOCK = 8;

  // 활동도 추적기 — 블록별 *변화량*을 step 간 누적해 동결/활성을 가른다.
  //
  //   measure(field, origins[, opts]) : origins(보통 ActiveSet.origins() = 비-영 블록 원점)만 훑어
  //     각 블록의 L∞ 변화(직전 스냅샷 대비)를 재고 quiet streak 를 갱신한 뒤 스냅샷을 새로 찍는다.
  //     훑는 범위가 origins 의 블록 칸뿐 → O(활성), 전-격자 O(N³) 아님.
  //   activeOrigins(origins, holdSteps) : origins 중 streak < holdSteps 인 것(아직 안 얼었으니 *돌아야 함*).
  //   frozenOrigins(origins, holdSteps) : streak ≥ holdSteps 인 것(동결=stable, 건너뜀).
  function createActivityTracker(N, blockSize) {
    N = N | 0;
    if (N <= 0) throw new Error('createActivityTracker: N must be > 0');
    const bs = (blockSize | 0) || DEFAULT_BLOCK;
    const nbx = Math.ceil(N / bs);
    const prev = new Map();        // 블록키 → Float64Array(bs³) 직전 스냅샷 (측정한 블록만 보관)
    const streak = new Map();      // 블록키 → quiet(활동도≤threshold) 연속 측정 횟수
    let lastScanned = 0;           // 마지막 measure 가 *실제로 훑은* 셀 수(스캔 비용의 실측 증거)
    let lastMaxActivity = 0;

    const bcells = bs * bs * bs;
    function originKey(ox, oy, oz) { return ((oz / bs | 0) * nbx + (oy / bs | 0)) * nbx + (ox / bs | 0); }

    // 한 블록(원점 ox,oy,oz)의 활동도 = 직전 스냅샷 대비 max|Δ|, 그리고 새 스냅샷을 snap 에 채운다.
    //   스냅샷이 없으면(첫 측정) Δ 는 +∞ 취급(streak 리셋) — 아직 "안 변한다"고 단정 못 하니 활성 유지.
    function blockActivityAndSnap(field, ox, oy, oz, counter) {
      const key = originKey(ox, oy, oz);
      let snap = prev.get(key);
      const first = !snap;
      if (first) { snap = new Float64Array(bcells); prev.set(key, snap); }
      let act = first ? Infinity : 0;
      for (let lz = 0; lz < bs; lz++) { const z = oz + lz; if (z >= N) break;
        for (let ly = 0; ly < bs; ly++) { const y = oy + ly; if (y >= N) break;
          for (let lx = 0; lx < bs; lx++) { const x = ox + lx; if (x >= N) break;
            counter.n++;
            const v = field[(z * N + y) * N + x];
            const li = ((lz * bs) + ly) * bs + lx;
            if (!first) { const d = Math.abs(v - snap[li]); if (d > act) act = d; }
            snap[li] = v;                       // 새 스냅샷(다음 측정의 기준)
          }
        }
      }
      return act;
    }

    const self = {
      N, blockSize: bs, blocksPerAxis: nbx,
      lastScannedCells() { return lastScanned; },
      maxActivity() { return lastMaxActivity; },
      streakOf(bx, by, bz) { return streak.get((bz * nbx + by) * nbx + bx) || 0; },

      // 활동도 측정 1회 — origins 의 각 블록 활동도를 재고 streak 갱신(quiet 면 ++, 아니면 0). 스냅샷 갱신.
      //   opts.threshold(기본 0): 이하면 quiet. opts.threshold=0 → "정확히 0 변화"만 quiet(비트 동일 관문).
      measure(field, origins, opts) {
        opts = opts || {};
        const threshold = opts.threshold != null ? opts.threshold : 0;
        const counter = { n: 0 };
        let mx = 0;
        for (let i = 0; i < origins.length; i++) {
          const ox = origins[i][0], oy = origins[i][1], oz = origins[i][2];
          const act = blockActivityAndSnap(field, ox, oy, oz, counter);
          const key = originKey(ox, oy, oz);
          if (act <= threshold) streak.set(key, (streak.get(key) || 0) + 1);  // 여전히 quiet → 연속 +1
          else streak.set(key, 0);                                            // 다시 변함 → 깨움(리셋)
          if (act !== Infinity && act > mx) mx = act;
        }
        lastScanned = counter.n;
        lastMaxActivity = mx;
        return { maxActivity: mx, scanned: counter.n };
      },

      // origins 중 *아직 안 얼은*(streak < holdSteps) 블록 원점 — 법칙이 opts.active 로 받아 돈다.
      //   입력 origins 의 순서를 보존(보통 결정론 키 오름차순) → 비트 동일 보장.
      activeOrigins(origins, holdSteps) {
        const out = [];
        for (let i = 0; i < origins.length; i++) {
          const o = origins[i];
          if ((streak.get(originKey(o[0], o[1], o[2])) || 0) < holdSteps) out.push(o);
        }
        return out;
      },

      // origins 중 *동결*(streak ≥ holdSteps = stable) 블록 원점 — S5 승격 후보·진단·렌더에 쓴다.
      frozenOrigins(origins, holdSteps) {
        const out = [];
        for (let i = 0; i < origins.length; i++) {
          const o = origins[i];
          if ((streak.get(originKey(o[0], o[1], o[2])) || 0) >= holdSteps) out.push(o);
        }
        return out;
      }
    };
    return self;
  }

  return { createActivityTracker, DEFAULT_BLOCK, VERSION: 1 };
});
