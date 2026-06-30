/* grow.js — 공간식민화(space colonization, Runions 2007) 성장 엔진.
 *
 * 손으로 가지를 배치하지 않는다. 어트랙터(잎눈/옥신원) 구름을 크라운 외피에 뿌리고,
 * 가지가 가까운 어트랙터 쪽으로 한 스텝씩 자라며 닿은 어트랙터를 소비한다. 같은 규칙이지만
 * 시드(어트랙터 배치)가 다르면 매번 다른 나무가 *창발*한다 — 형태가 수식에서 나온다.
 *
 *   ① 어트랙터 구름(크라운 외피 내 거부표집)
 *   ② 각 어트랙터 → 인지반경 di 안 최근접 노드에 pull 누적
 *   ③ pull 받은 노드는 normalize(pull + upBias·up)·D 만큼 새 노드로 성장
 *   ④ 킬반경 dk 안에 든 어트랙터 소비
 *   ⑤ 반경 테이퍼는 Murray 법칙(r^e = Σ child r^e)으로 팁→루트 후처리
 *
 * DOM 비의존 — Node 로 검증 가능. 출력은 렌더러가 캡슐/메타볼로 바로 소비하는 평면 배열.
 */
(function (global) {
  'use strict';

  // 재현 가능한 시드 RNG (art.html 과 동일 mulberry32). 전역 Math.random 을 건드리지 않는다.
  function mulberry32(a) {
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      let t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  const DEFAULTS = {
    baseX: 0, baseY: 0,        // 밑동(월드 좌표). y 위로 증가.
    nAttractors: 380,          // 어트랙터 수
    crownCY: 60, crownRX: 26, crownRY: 24,  // 크라운 외피 중심·반경
    di: 18,                    // 인지(영향) 반경
    dk: 5,                     // 킬 반경  (가드: dk<di, dk>=2D)
    D: 2.4,                    // 스텝 길이
    upBias: 0.26,              // 중력굴성(위로 끌림)
    rTip: 0.5, murrayE: 2.3, rTrunkMax: 3.0,  // 반경 테이퍼
    maxSteps: 320, maxNodes: 2200,
  };

  function grow(rng, opt = {}) {
    const o = Object.assign({}, DEFAULTS, opt);
    if (typeof rng === 'number') rng = mulberry32(rng);
    // 가드: 파라미터 일관성 — 단일 스파이크/무한루프 방지
    const D = o.D;
    const dk = Math.max(o.dk, 2 * D);          // dk >= 2D
    const di = Math.max(o.di, dk + 2 * D);     // dk < di (여유 확보)
    const killR2 = dk * dk, infl2 = di * di;

    // 크라운 외피: 시드별 중심·종횡비 지터(타원). 거부표집.
    const cx = o.baseX + (rng() - 0.5) * o.crownRX * 0.5;
    const cy = o.baseY + o.crownCY + (rng() - 0.5) * 8;
    const rx = o.crownRX * (0.8 + rng() * 0.5);
    const ry = o.crownRY * (0.8 + rng() * 0.5);
    const lean = (rng() - 0.5) * 0.5;          // 크라운 기울기(비대칭 창발)
    const ax = [], ay = [], aAlive = [];
    let guard = 0;
    while (ax.length < o.nAttractors && guard < o.nAttractors * 40) {
      guard++;
      const u = (rng() * 2 - 1), v = (rng() * 2 - 1);
      if (u * u + v * v > 1) continue;          // 단위원 내부만 → 타원으로 매핑
      ax.push(cx + u * rx + v * ry * lean);
      ay.push(cy + v * ry);
      aAlive.push(1);
    }
    const nA = ax.length;

    // 노드 배열. 루트 = 밑동.
    const nx = [o.baseX], ny = [o.baseY], parent = [-1], children = [[]];
    const addNode = (x, y, p) => {
      const id = nx.length;
      nx.push(x); ny.push(y); parent.push(p); children.push([]);
      children[p].push(id);
      return id;
    };

    // ── 트렁크 부트스트랩: 밑동에서 위로 직선 성장해 구름 영향권에 진입 ──
    // (이게 없으면 루트가 어떤 어트랙터의 di 밖이라 "아무 가지도 안 자람".)
    let tip = 0, boot = 0;
    while (boot < 400) {
      boot++;
      // 가장 가까운 살아있는 어트랙터까지 거리
      let best = Infinity;
      for (let a = 0; a < nA; a++) {
        if (!aAlive[a]) continue;
        const ddx = ax[a] - nx[tip], ddy = ay[a] - ny[tip], d2 = ddx * ddx + ddy * ddy;
        if (d2 < best) best = d2;
      }
      if (best <= infl2) break;                 // 구름에 도달 → 콜로니제이션 시작
      tip = addNode(nx[tip], ny[tip] + D, tip); // 위로 한 스텝
    }

    // ── 공간식민화 본 루프 ──
    const dirx = [], diry = [], cnt = [];
    let steps = 0;
    while (steps < o.maxSteps && nx.length < o.maxNodes) {
      steps++;
      const N = nx.length;
      for (let i = 0; i < N; i++) { dirx[i] = 0; diry[i] = 0; cnt[i] = 0; }

      // 각 어트랙터 → di 안 최근접 노드에 정규화 pull 누적
      let anyInfluence = false;
      for (let a = 0; a < nA; a++) {
        if (!aAlive[a]) continue;
        let bi = -1, bd = infl2;
        for (let i = 0; i < N; i++) {
          const ddx = ax[a] - nx[i], ddy = ay[a] - ny[i], d2 = ddx * ddx + ddy * ddy;
          if (d2 < bd) { bd = d2; bi = i; }
        }
        if (bi >= 0) {
          const ddx = ax[a] - nx[bi], ddy = ay[a] - ny[bi], L = Math.hypot(ddx, ddy) + 1e-9;
          dirx[bi] += ddx / L; diry[bi] += ddy / L; cnt[bi]++;
          anyInfluence = true;
        }
      }
      if (!anyInfluence) break;                 // 더 끌릴 어트랙터 없음

      // pull 받은 노드 성장
      let grew = 0;
      for (let i = 0; i < N; i++) {
        if (cnt[i] === 0) continue;
        let gx = dirx[i], gy = diry[i] + o.upBias * cnt[i];  // 중력굴성
        const L = Math.hypot(gx, gy) + 1e-9; gx /= L; gy /= L;
        addNode(nx[i] + gx * D, ny[i] + gy * D, i);
        grew++;
      }
      if (grew === 0) break;                     // 무성장 → 종료

      // 닿은 어트랙터 소비
      const M = nx.length;
      for (let a = 0; a < nA; a++) {
        if (!aAlive[a]) continue;
        for (let i = N; i < M; i++) {            // 새로 추가된 노드만 검사(충분)
          const ddx = ax[a] - nx[i], ddy = ay[a] - ny[i];
          if (ddx * ddx + ddy * ddy < killR2) { aAlive[a] = 0; break; }
        }
      }
    }

    // ── 반경 테이퍼(Murray): 팁 r=rTip → post-order 루트방향 r=(Σ child r^e)^(1/e) ──
    const radius = new Array(nx.length).fill(o.rTip);
    const e = o.murrayE;
    // 자식이 먼저 계산되도록 인덱스 역순(부모는 항상 더 작은 인덱스에 생성됨)
    for (let i = nx.length - 1; i >= 0; i--) {
      const ch = children[i];
      if (ch.length === 0) { radius[i] = o.rTip; continue; }
      let s = 0;
      for (const c of ch) s += Math.pow(radius[c], e);
      radius[i] = Math.min(o.rTrunkMax, Math.pow(s, 1 / e));
    }

    // ── 잎: 소비된 어트랙터 근처 + 말단(팁) 노드에 잎 클러스터 시드 ──
    const isTip = children.map((c) => c.length === 0);
    const leaves = [];
    for (let i = 1; i < nx.length; i++) {
      if (isTip[i]) leaves.push({ x: nx[i], y: ny[i] });
    }

    return {
      nx, ny, parent, children, radius, isTip,
      leaves,                       // {x,y} 잎 클러스터 시드(렌더러가 메타볼로 부풀림)
      crown: { cx, cy, rx, ry },
      nNodes: nx.length, nAttractors: nA, steps,
      params: { di, dk, D, upBias: o.upBias },
    };
  }

  const Grow = { grow, mulberry32, DEFAULTS };
  global.Grow = Grow;
  if (typeof module !== 'undefined' && module.exports) module.exports = Grow;
})(typeof window !== 'undefined' ? window : globalThis);
