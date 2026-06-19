// scenes.js — 장면 레지스트리(append-only). 한 step = 장면 한 항(법칙 아님 — SPINE §5).
//   장면 = { id, title, desc, ticks, init(rng,K)→spec, watch(sim,K)→지표, assert(w0,w1,K)→[{name,pass,value}] }.
//   이 한 항이 검증·골든·시각화의 단일 출처(DRY). 새 장면은 직전 장면 형식을 따른다.
// atom 트랙과 동일하게 HGO.scenes 전역(브라우저) / module.exports(Node)에 등록.
;(function (root, factory) {
  const K = (typeof require !== 'undefined') ? require('./flux-kernel.js') : root.HGO.kernel;
  const mod = factory(K);
  if (typeof module !== 'undefined' && module.exports) module.exports = mod;
  else (root.HGO = root.HGO || {}).scenes = mod;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (K) {
  'use strict';

  // 격자 셀 한 칸을 렌더 계약 모양으로 만든다. q = 보존량(*고정소수점 정수* — 규칙 대상),
  //   rx,ry,rz = 3D 위치(렌더가 rz 를 깊이로 읽음 — RENDER.md §2/render.js a.rz). x = 렌더 밝기 채널
  //   (= q 인간 단위 q/SCALE, 파생 읽기). Z=1·N=0·e=1(중성·단일 원소·단일 동위원소) 고정
  //   → 렌더는 균일 크기 구를 그리고 밝기만 q 따라간다. SCALE 은 kernel 권위(고정소수점 단일 출처).
  function cell(rx, ry, rz, q) { return { rx, ry, rz, q, x: q / K.SCALE, Z: 1, N: 0, e: 1, vx: 0, vy: 0 }; }

  // 창발 측정(author 아님) — q 장의 합·퍼짐. spread(max−min)가 층(확산 평형화)을 *읽는* 지표.
  //   q 는 고정소수점 정수 → 합·범위는 정수(정확), 보고는 인간 단위(/SCALE)로 환산(Σq 정수 동일 → Δ 비트 0).
  function measure(sim) {
    const S = K.SCALE;
    let sum = 0, mn = Infinity, mx = -Infinity;
    for (const a of sim.atoms) { sum += a.q; if (a.q < mn) mn = a.q; if (a.q > mx) mx = a.q; }
    return { sumQ: +(sum / S).toFixed(6), spread: +((mx - mn) / S).toFixed(6), maxq: +(mx / S).toFixed(6), minq: +(mn / S).toFixed(6) };
  }

  // 창발 측정(arc B — 동결 층) — θ>0 일 때 "어디가 굳었나"를 *읽는* 지표(author 라벨 아님).
  //   active = 규칙이 *실제로 흐르게 하는* 간선 수(F≠0 — laws 의 게이트를 그대로 복제: ex>0 & floor(κ·ex)>0).
  //     데드밴드(ad 가 θ 바로 위라 floor 후 0)는 동결로 본다 — flux=0 이 진짜 정지 신호.
  //   maxNbr = 최대 이웃 차(인간 단위). 동결 상태에선 모든 이웃 차가 θ 부근으로 붕괴(잔류 기울기가 잠김).
  function frozenMeasure(sim) {
    const S = K.SCALE;
    const thetaFix = Math.round(sim.knobs.theta * S);
    const kappaFix = Math.round(sim.knobs.kappa * S);
    const a = sim.atoms, edges = sim.edges;
    let active = 0, maxd = 0;
    for (let e = 0; e < edges.length; e++) {
      const d = a[edges[e][0]].q - a[edges[e][1]].q;
      const ad = d < 0 ? -d : d;
      const ex = ad - thetaFix;
      if (ex > 0 && Math.floor(ex * kappaFix / S) > 0) active++;   // 실제 흐르는(사태) 간선
      if (ad > maxd) maxd = ad;
    }
    return { active, maxNbr: +(maxd / S).toFixed(6), theta: sim.knobs.theta, flux: +((sim.fluxLast || 0) / S).toFixed(6) };
  }

  // 결정론 거친 풍경(rng 미사용 — 셀 인덱스 정수 해시로 재현). θ 만 바꿔 freeze 전이를 본다(step-0003 θ-스윕).
  //   q ∈ [0,10] 의 고주파 거칢(이웃이 크게 다름 → θ=1 에서 많은 간선이 사태). 시드 무관 → 비트 재현.
  function roughSpec(theta, n) {
    const cols = n || 12, rows = n || 12, depth = n || 12, W = 100, H = 100, D = 100, S = K.SCALE;
    const atoms = []; let i = 0;
    for (let z = 0; z < depth; z++) for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const rx = (c + 0.5) / cols * W, ry = (r + 0.5) / rows * H, rz = (z + 0.5) / depth * D - D / 2;
      const h = (Math.imul(i + 1, 2654435761) >>> 0) % 100000;   // Knuth 승법 해시 → 0..99999(결정론)
      atoms.push(cell(rx, ry, rz, Math.round(h / 100000 * 10 * S)));
      i++;
    }
    return { cols, rows, depth, W, H, D, atoms, knobs: { kappa: 0.1, theta, alpha: 1 } };
  }

  // 한 spec 을 ticks 만큼 결정론 relaxation 후 잔류 spread(인간 단위) 반환. assert 안의 θ-스윕 재실행용.
  //   sim 모듈을 지연 참조(Node: require / 브라우저: HGO.sim) — 하네스 불변, 메인 해시에 무관(보조 측정).
  function freezeResidual(spec, ticks) {
    const SIM = (typeof require !== 'undefined') ? require('./flux-sim.js') : globalThis.HGO.sim;
    const sim = SIM.createSim(spec);
    for (let t = 0; t < ticks; t++) SIM.step(sim);
    let mn = Infinity, mx = -Infinity;
    for (const a of sim.atoms) { if (a.q < mn) mn = a.q; if (a.q > mx) mx = a.q; }
    return +((mx - mn) / K.SCALE).toFixed(4);
  }

  // 결정론 블롭 풍경(transcendental 0 — 크로스플랫폼 비트, SPINE §9.3) — 큰 척도 구조 + 작은 노이즈.
  //   배경 q=1 + 3개 블롭(2차 falloff) + 정수 해시 노이즈. 동결 후 도메인/전선 분해를 본다(step-0004).
  //   alpha·kappa 는 선택 인자(미지정 → α=1·κ=0.1, 기존 0004~0007 호출과 비트 동일 = 회귀 0). step-0008 의 α 스윕이 쓴다.
  function blobSpec(theta, n, alpha, kappa) {
    const cols = n || 12, rows = n || 12, depth = n || 12, W = 100, H = 100, D = 100, S = K.SCALE;
    // 블롭 중심 = 격자 비율 × 해상도(정수 반올림). n=12 면 원래 정수 중심 [3,3,3]/[8,4,6]/[5,9,8] 정확 복원(골든 불변).
    const centers = [[3, 3, 3, 8], [8, 4, 6, 6], [5, 9, 8, 7]].map(b =>
      [Math.round(b[0] / 12 * cols), Math.round(b[1] / 12 * rows), Math.round(b[2] / 12 * depth), b[3]]);
    const atoms = [];
    for (let z = 0; z < depth; z++) for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const rx = (c + 0.5) / cols * W, ry = (r + 0.5) / rows * H, rz = (z + 0.5) / depth * D - D / 2;
      let q = 1;
      for (let b = 0; b < centers.length; b++) {
        const cx = centers[b][0], cy = centers[b][1], cz = centers[b][2], h = centers[b][3];
        const d2 = (c - cx) * (c - cx) + (r - cy) * (r - cy) + (z - cz) * (z - cz);
        const f = 1 - d2 / 16; if (f > 0) q += h * f;            // 2차 falloff(transcendental 없음)
      }
      const idx = (z * rows + r) * cols + c;
      const noise = ((Math.imul(idx + 1, 2654435761) >>> 0) % 1000) / 1000 * 0.2;   // 0..0.2 결정론 노이즈
      atoms.push(cell(rx, ry, rz, Math.round((q + noise) * S)));
    }
    return { cols, rows, depth, W, H, D, atoms, knobs: { kappa: kappa || 0.1, theta, alpha: alpha || 1 } };
  }

  // 창발 측정(arc C — 도메인) — 동결 q 장을 군집해 "덩어리 + 전선"을 읽는다(author 라벨 0).
  //   전선(front) = |Δq| ≥ frontEps 인 간선(가파른 경계). 그 간선을 *끊고* 남은 그래프의 연결성분 = 도메인.
  //   반환: 도메인 수 nDom · 최대 도메인 셀 비율 maxFrac · 전선 간선 비율 frontFrac. union-find.
  function domains(sim, frontEps) {
    const S = K.SCALE, fFix = Math.round(frontEps * S);
    const a = sim.atoms, edges = sim.edges, n = a.length;
    const parent = new Int32Array(n); for (let i = 0; i < n; i++) parent[i] = i;
    const find = x => { while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; } return x; };
    let front = 0;
    for (let e = 0; e < edges.length; e++) {
      const i = edges[e][0], j = edges[e][1];
      const d = a[i].q - a[j].q, ad = d < 0 ? -d : d;
      if (ad >= fFix) { front++; continue; }                 // 전선 → 끊음(도메인 경계)
      const ri = find(i), rj = find(j); if (ri !== rj) parent[ri] = rj;
    }
    const size = new Map(); let mx = 0;
    for (let i = 0; i < n; i++) { const r = find(i); const s = (size.get(r) || 0) + 1; size.set(r, s); if (s > mx) mx = s; }
    return { nDom: size.size, maxFrac: +(mx / n).toFixed(4), frontFrac: +(front / edges.length).toFixed(4), nCells: n };
  }

  // spec 을 ticks 만큼 동결시켜 sim 반환(보조 측정용·메인 해시 무관). 지연 sim 참조(Node/브라우저).
  function frozenSim(spec, ticks) {
    const SIM = (typeof require !== 'undefined') ? require('./flux-sim.js') : globalThis.HGO.sim;
    const sim = SIM.createSim(spec);
    for (let t = 0; t < ticks; t++) SIM.step(sim);
    return sim;
  }

  // 창발 측정(arc C 완성 — 상관 길이) — 군집 임계 무관한 척도 지표. q 장의 축별 자기상관 C(d) 가
  //   1/e 로 떨어지는 거리 ξ(셀 단위·선형 보간). 백색잡음이면 ξ<1(이웃 무상관), 구조 있으면 ξ>1.
  function correlationLength(sim) {
    const a = sim.atoms, cols = sim.cols, rows = sim.rows, depth = sim.depth, n = a.length;
    const idx = (c, r, z) => (z * rows + r) * cols + c;
    let mean = 0; for (const x of a) mean += x.q; mean /= n;
    let varr = 0; for (const x of a) { const dv = x.q - mean; varr += dv * dv; } varr /= n;
    if (varr <= 0) return { xi: 0, corr: [] };
    const maxR = Math.min(cols, rows, depth) >> 1;
    const corr = [];
    for (let d = 1; d <= maxR; d++) {
      let s = 0, cnt = 0;
      for (let z = 0; z < depth; z++) for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
        const dv = a[idx(c, r, z)].q - mean;
        s += dv * (a[idx((c + d) % cols, r, z)].q - mean);
        s += dv * (a[idx(c, (r + d) % rows, z)].q - mean);
        s += dv * (a[idx(c, r, (z + d) % depth)].q - mean);
        cnt += 3;
      }
      corr.push(+((s / cnt) / varr).toFixed(4));
    }
    const thr = 1 / Math.E;                       // 1/e ≈ 0.368
    let xi = maxR, prevD = 0, prevC = 1;          // C(0)=1
    for (let k = 0; k < corr.length; k++) {
      const d = k + 1, cv = corr[k];
      if (cv <= thr) { xi = prevD + (prevC - thr) / (prevC - cv) * (d - prevD); break; }
      prevD = d; prevC = cv;
    }
    return { xi: +xi.toFixed(3), corr };
  }

  // 창발 측정(arc D — 시간 척도 분리) — 구조 풍경을 확산 relaxation 하며 두 *공간* 척도의 진폭 시계열을
  //   수집한다. 작은 척도(이웃 차 RMS = 고주파 거칢)는 큰 척도(B³ 블록 평균의 편차 RMS = 저주파 변동)보다
  //   *빠르게* 감쇠한다 — 확산에서 모드 감쇠율 ∝ k²(작은 파장 = 큰 k = 급감). 1/e 도달 tick = τ.
  //   이것이 "산(느림)과 물(빠름) 한 세계 공존"의 핵: 같은 한 규칙이 척도에 따라 다른 *시간* 척도로 푼다.
  //   author 0: q 의 함수일 뿐(라벨 없음·분기 없음). 지연 sim 참조(보조 측정·메인 해시 무관).
  function scaleSeparation(spec, ticks, block) {
    const SIM = (typeof require !== 'undefined') ? require('./flux-sim.js') : globalThis.HGO.sim;
    const S = K.SCALE, B = block || 4, sim = SIM.createSim(spec);
    const cols = sim.cols, rows = sim.rows, depth = sim.depth, a = sim.atoms, edges = sim.edges, n = a.length;
    const idx = (c, r, z) => (z * rows + r) * cols + c;
    // 작은 척도: 이웃 차 RMS(고주파 — 인접 셀 거칢). q 평형화의 가장 작은 파장.
    const small = () => { let s = 0; for (let e = 0; e < edges.length; e++) { const d = (a[edges[e][0]].q - a[edges[e][1]].q) / S; s += d * d; } return Math.sqrt(s / edges.length); };
    // 큰 척도: B³ 블록 평균의 전역 평균 대비 편차 RMS(저주파 — 큰 덩어리 변동).
    const large = () => {
      let gm = 0; for (let i = 0; i < n; i++) gm += a[i].q; gm /= n;
      const bc = Math.ceil(cols / B), br = Math.ceil(rows / B), nb = bc * br * Math.ceil(depth / B);
      const sum = new Float64Array(nb), cnt = new Float64Array(nb);
      for (let z = 0; z < depth; z++) for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
        const b = (((z / B) | 0) * br + ((r / B) | 0)) * bc + ((c / B) | 0); sum[b] += a[idx(c, r, z)].q; cnt[b]++;
      }
      let ss = 0, m = 0; for (let b = 0; b < nb; b++) if (cnt[b]) { const dv = sum[b] / cnt[b] - gm; ss += dv * dv; m++; }
      return Math.sqrt(ss / m) / S;
    };
    const sm = [small()], lg = [large()];
    for (let t = 0; t < ticks; t++) { SIM.step(sim); sm.push(small()); lg.push(large()); }
    const tau = ser => { const thr = ser[0] / Math.E; for (let t = 1; t < ser.length; t++) if (ser[t] <= thr) return +(t - 1 + (ser[t - 1] - thr) / (ser[t - 1] - ser[t])).toFixed(2); return ticks; };
    const tauS = tau(sm), tauL = tau(lg);
    return { tauSmall: tauS, tauLarge: tauL, ratio: +(tauL / tauS).toFixed(2),
      small0: +sm[0].toFixed(4), smallEnd: +sm[sm.length - 1].toFixed(4),
      large0: +lg[0].toFixed(4), largeEnd: +lg[lg.length - 1].toFixed(4) };
  }

  // 창발 측정(arc D — 산·물 공간 공존) — θ>0 한 세계의 relaxation 중, *같은 tick* 에 동결(산)·사태(물)
  //   두 상이 *공간적으로 공존*하는가. 간선 상: active = 실제 흐르는 간선(물), frozen = 나머지(산, |d|≲θ).
  //   peakCo = min(actFrac,froFrac) 의 시간 최대(둘 다 실질적인 정점). snap tick 의 *셀* 분율(물 셀=활성 간선에 닿는
  //   셀, 산 셀=나머지)로 공간 공존을 본다. 시간이 가면 물→산(동결 전선 전진, actEnd→0). author 0: q·θ 의 함수.
  function phaseCoexistence(spec, ticks, snap) {
    const SIM = (typeof require !== 'undefined') ? require('./flux-sim.js') : globalThis.HGO.sim;
    const S = K.SCALE, sim = SIM.createSim(spec);
    const thetaFix = Math.round(sim.knobs.theta * S), kappaFix = Math.round(sim.knobs.kappa * S);
    const a = sim.atoms, edges = sim.edges, E = edges.length, n = a.length;
    const edgeFrac = () => { let act = 0; for (let e = 0; e < E; e++) { const d = a[edges[e][0]].q - a[edges[e][1]].q, ad = d < 0 ? -d : d, ex = ad - thetaFix; if (ex > 0 && Math.floor(ex * kappaFix / S) > 0) act++; } return { act: act / E, fro: (E - act) / E }; };
    const m0 = edgeFrac();
    let peakCo = 0, peakT = 0, water = null;
    for (let t = 0; t < ticks; t++) {
      SIM.step(sim);
      const m = edgeFrac(), co = Math.min(m.act, m.fro); if (co > peakCo) { peakCo = co; peakT = t + 1; }
      if (t + 1 === snap) {                                  // 스냅샷: 셀 단위 물/산 분율(공간 공존)
        const w = new Uint8Array(n);
        for (let e = 0; e < E; e++) { const i = edges[e][0], j = edges[e][1], d = a[i].q - a[j].q, ad = d < 0 ? -d : d, ex = ad - thetaFix; if (ex > 0 && Math.floor(ex * kappaFix / S) > 0) { w[i] = 1; w[j] = 1; } }
        let cw = 0; for (let i = 0; i < n; i++) if (w[i]) cw++; water = cw / n;
      }
    }
    const mE = edgeFrac();
    return { act0: +m0.act.toFixed(3), fro0: +m0.fro.toFixed(3), actEnd: +mE.act.toFixed(3), froEnd: +mE.fro.toFixed(3),
      peakCo: +peakCo.toFixed(3), peakT, waterFrac: +(water || 0).toFixed(3), earthFrac: +(1 - (water || 0)).toFixed(3), snap };
  }

  // 창발 측정(규칙 4 자유도 마지막 — α 비선형 차수) — 같은 블롭 풍경·θ=0 에서 α 만 바꿔 relaxation.
  //   Φ(d)=…|d|^α 라 α>1 이면 |d|<1(작은 기울기) → |d|^α < |d| (sub-linear, 거의 안 흐름 = 효과적 동결),
  //   |d|>1(큰 기울기) → super-linear (가속·폭주). 즉 α 가 *문턱 없이도* 동결을 만들고(잔류 spread↑) 큰 기울기는
  //   불안정(κ 커지면 발산). author 0: 규칙 노브 스윕일 뿐. 발산 = q 가 2⁵³ 넘어 Σq 깨짐(유한성으로 안정 판정).
  function alphaEffect(theta, kappa, ticks) {
    const SIM = (typeof require !== 'undefined') ? require('./flux-sim.js') : globalThis.HGO.sim;
    const S = K.SCALE;
    const run = (alpha) => {
      const sim = SIM.createSim(blobSpec(theta, 12, alpha, kappa));
      let q0 = 0; for (const a of sim.atoms) q0 += a.q;
      for (let t = 0; t < ticks; t++) SIM.step(sim);
      let mn = Infinity, mx = -Infinity, q1 = 0; for (const a of sim.atoms) { if (a.q < mn) mn = a.q; if (a.q > mx) mx = a.q; q1 += a.q; }
      const resid = (mx - mn) / S, finite = Number.isFinite(resid), dq = Math.abs(q1 - q0) / S;
      return { resid: finite ? +resid.toFixed(4) : Infinity, finite, dq: finite ? dq : NaN };
    };
    return { a1: run(1), a2: run(2), a3hi: run(3) };   // α=1·2 (κ 안정역) + α=3(같은 κ 발산 경계)
  }

  // 창발 측정(arc B/C — 구동 사태 통계, 🔴 SOC) — 이 세계엔 구동이 없어 단일 궤적엔 사태가 없다. 동결 상태에
  //   셀 1개 q 펄스를 *구동* 하고 relaxation 으로 풀리는 사태 크기(=q 가 eps 넘게 변한 셀 수)를 앙상블(여러
  //   구동 위치)로 모은다. θ↑ 일수록 동결이 전파를 차단 → 사태가 국소화(평균 크기↓). θ=0 은 소산(사태 아닌 확산).
  //   author 0: q·θ 의 함수. 멱법칙(척도 불변)은 유한 12³ 한계로 보류 — *평균 사태 크기의 θ 의존*까지 정량.
  function avalancheStats(theta, pulse, relax, N) {
    const SIM = (typeof require !== 'undefined') ? require('./flux-sim.js') : globalThis.HGO.sim;
    const S = K.SCALE;
    const base = SIM.createSim(roughSpec(theta));               // 동결 기질(θ relaxed)
    for (let t = 0; t < 400; t++) SIM.step(base);
    const n = base.atoms.length, baseQ = base.atoms.map(a => a.q), eps = Math.round(0.01 * S), pf = Math.round(pulse * S);
    const stride = Math.max(1, Math.floor(n / N)), sizes = [];
    for (let site = 0; site < n; site += stride) {
      const sim = SIM.createSim(roughSpec(theta));               // 동결 상태 복제 + 한 셀 구동
      for (let k = 0; k < n; k++) sim.atoms[k].q = baseQ[k];
      sim.atoms[site].q += pf;
      const before = sim.atoms.map(a => a.q);
      for (let t = 0; t < relax; t++) SIM.step(sim);
      let sz = 0; for (let k = 0; k < n; k++) if (Math.abs(sim.atoms[k].q - before[k]) > eps) sz++;
      sizes.push(sz);
    }
    sizes.sort((a, b) => a - b);
    const mean = sizes.reduce((s, x) => s + x, 0) / sizes.length;
    return { mean: +mean.toFixed(2), median: sizes[sizes.length >> 1], min: sizes[0], max: sizes[sizes.length - 1], n: sizes.length };
  }

  // arc E 풍경 — 둘째 보존 채널 p(촉매 장). q 는 두 동일 범프(좌·우 대칭), p 는 좌반 고(촉매)·우반 저(정적).
  //   kappaP=0 → p 정적(촉매 장만), gamma>0 → p 가 q 의 κ 변조. κ=0.05·γ·p̄ 가 안정역(κ_eff·Z<1) 안.
  //   cellP = 렌더 계약 + p 필드(렌더는 p 무시 — q 만 밝기). n 스케일 시 범프/경계 비율 보존.
  function catalystSpec(gamma, n) {
    const cols = n || 12, rows = n || 12, depth = n || 12, W = 100, H = 100, D = 100, S = K.SCALE;
    const aC = Math.round(3 / 12 * cols), bC = Math.round(9 / 12 * cols), midR = Math.round(6 / 12 * rows), midZ = Math.round(6 / 12 * depth);
    const atoms = [];
    for (let z = 0; z < depth; z++) for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const rx = (c + 0.5) / cols * W, ry = (r + 0.5) / rows * H, rz = (z + 0.5) / depth * D - D / 2;
      let q = 1; if ((c === aC || c === bC) && r === midR && z === midZ) q += 8;   // 좌·우 동일 범프
      const p = c < cols / 2 ? 2 : 0;                                              // 좌반 고p(촉매)·우반 저p
      atoms.push({ rx, ry, rz, q: Math.round(q * S), p: Math.round(p * S), x: q, Z: 1, N: 0, e: 1, vx: 0, vy: 0 });
    }
    return { cols, rows, depth, W, H, D, atoms, knobs: { kappa: 0.05, theta: 0, alpha: 1, kappaP: 0, gamma } };
  }

  // 창발 측정(arc E — 이중 보존 + 촉매) — γ>0 일 때 고p 영역 범프가 저p 영역 범프보다 *빠르게* 평형(κ 변조).
  //   τ = 범프 초과분(qcenter−1)이 초기(8)의 1/e 로 떨어지는 tick. 고p τ_A < 저p τ_B = 촉매. ΣQ·ΣP 독립 보존 확인.
  function catalysis(gamma, ticks) {
    const SIM = (typeof require !== 'undefined') ? require('./flux-sim.js') : globalThis.HGO.sim;
    const S = K.SCALE, sim = SIM.createSim(catalystSpec(gamma));
    const cols = sim.cols, rows = sim.rows, depth = sim.depth, a = sim.atoms;
    const idx = (c, r, z) => (z * rows + r) * cols + c;
    const A = idx(Math.round(3 / 12 * cols), Math.round(6 / 12 * rows), Math.round(6 / 12 * depth));
    const B = idx(Math.round(9 / 12 * cols), Math.round(6 / 12 * rows), Math.round(6 / 12 * depth));
    let q0 = 0, p0 = 0; for (const x of a) { q0 += x.q; p0 += x.p; }
    const exA = [(a[A].q - S) / S], exB = [(a[B].q - S) / S];
    for (let t = 0; t < ticks; t++) { SIM.step(sim); exA.push((a[A].q - S) / S); exB.push((a[B].q - S) / S); }
    let q1 = 0, p1 = 0; for (const x of a) { q1 += x.q; p1 += x.p; }
    const tau = ser => { const thr = ser[0] / Math.E; for (let t = 1; t < ser.length; t++) if (ser[t] <= thr) return +(t - 1 + (ser[t - 1] - thr) / (ser[t - 1] - ser[t])).toFixed(2); return ticks; };
    const finite = Number.isFinite(a[A].q) && Number.isFinite(a[B].q);
    return { tauA: tau(exA), tauB: tau(exB), dQ: finite ? Math.abs(q1 - q0) / S : NaN, dP: finite ? Math.abs(p1 - p0) / S : NaN, finite };
  }

  // arc F 풍경(관성·파동) — 중앙 펄스 IC, v=0(정지 출발), inertial=on, α=1. 과감쇠(q←q+G)가 아니라
  //   관성(v←v+G; q←q+v)으로 적분 → 들뜸이 *전파·진동*하고 평형으로 죽지 않는다(SPINE §3·§4). κ 는 안정역(CFL).
  function pulseSpec(kappa, n) {
    const cols = n || 12, rows = n || 12, depth = n || 12, W = 100, H = 100, D = 100, S = K.SCALE;
    const atoms = [];
    for (let z = 0; z < depth; z++) for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const rx = (c + 0.5) / cols * W, ry = (r + 0.5) / rows * H, rz = (z + 0.5) / depth * D - D / 2;
      const dc = Math.abs(c - (cols - 1) / 2), dr = Math.abs(r - (rows - 1) / 2), dz = Math.abs(z - (depth - 1) / 2);
      const blob = (dc <= 1 && dr <= 1 && dz <= 1) ? 10 : 0;        // 중앙 3³ 펄스(step-0001 과 같은 IC, v=0)
      atoms.push({ rx, ry, rz, q: Math.round((1 + blob) * S), x: 1, Z: 1, N: 0, e: 1, vx: 0, vy: 0, v: 0 });
    }
    return { cols, rows, depth, W, H, D, atoms, knobs: { kappa, theta: 0, alpha: 1, inertial: 1 } };
  }

  // arc F 풍경 — x 축 평면파 q=1+A·cos(kₓc), kₓ=2π·m/cols. 분산관계 ω(k) 측정용(단일 모드 진동수).
  function planeWaveSpec(kappa, m, n) {
    const cols = n || 12, rows = n || 12, depth = n || 12, W = 100, H = 100, D = 100, S = K.SCALE, A = 3;
    const kx = 2 * Math.PI * m / cols, atoms = [];
    for (let z = 0; z < depth; z++) for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const rx = (c + 0.5) / cols * W, ry = (r + 0.5) / rows * H, rz = (z + 0.5) / depth * D - D / 2;
      const q = 1 + A * Math.cos(kx * c);
      atoms.push({ rx, ry, rz, q: Math.round(q * S), x: 1, Z: 1, N: 0, e: 1, vx: 0, vy: 0, v: 0 });
    }
    return { cols, rows, depth, W, H, D, atoms, knobs: { kappa, theta: 0, alpha: 1, inertial: 1 } };
  }

  // 창발 측정(arc F — 파동) — 관성 적분이 파동을 내는지 *읽는* 지표(author 라벨 아님).
  //   ① 보존: ΣQ·ΣP 비트 불변(관성도 반대칭 −F/+F 라 정확). ② 가역/유계: E=K+U 가 발산 없이 유계 진동
  //   (심플렉틱이라 shadow-Hamiltonian 보존 → 표류 대신 밴드 진동, 확산처럼 0 으로 안 죽음). ③ 비단조: spread 가
  //   감소만 하지 않고 오르내림(파동). ④ 분산관계: 평면파 모드 m 의 측정 ω 가 이론 2√κ·|sin(kₓ/2)| 과 일치.
  function waveMeasure(kappa, ticks, n) {
    const SIM = (typeof require !== 'undefined') ? require('./flux-sim.js') : globalThis.HGO.sim;
    const S = K.SCALE, sim = SIM.createSim(pulseSpec(kappa, n));
    let q0 = 0, p0 = 0; for (const a of sim.atoms) { q0 += a.q; p0 += (a.v || 0); }
    const E = s => {                                  // E = Σ½v² + Σ_간선 ½κ·d²  (α=1,θ=0 퍼텐셜)
      let Kn = 0; for (const a of s.atoms) { const v = (a.v || 0) / S; Kn += 0.5 * v * v; }
      let U = 0; for (const e of s.edges) { const d = (s.atoms[e[0]].q - s.atoms[e[1]].q) / S; U += 0.5 * kappa * d * d; }
      return Kn + U;
    };
    const sp = s => { let mn = Infinity, mx = -Infinity; for (const a of s.atoms) { if (a.q < mn) mn = a.q; if (a.q > mx) mx = a.q; } return (mx - mn) / S; };
    const E0 = E(sim), Es = [], sps = [sp(sim)];
    for (let t = 0; t < ticks; t++) { SIM.step(sim); Es.push(E(sim)); sps.push(sp(sim)); }
    let q1 = 0, p1 = 0; for (const a of sim.atoms) { q1 += a.q; p1 += (a.v || 0); }
    const finite = Number.isFinite(sim.atoms[0].q) && Number.isFinite(Es[Es.length - 1]);
    const eMin = Math.min.apply(null, Es), eMax = Math.max.apply(null, Es);
    // 비단조: spread 가 한 번이라도 *증가*하면(파동 되돌아옴) true — 확산은 단조 감소만.
    let rebounds = 0; for (let t = 1; t < sps.length; t++) if (sps[t] > sps[t - 1] + 1e-9) rebounds++;
    // 분산관계: 모드 m=2 평면파를 돌려 진동 주기 → ω. 영점통과(평균 상향)로 주기 추정.
    const m = 2, ksim = SIM.createSim(planeWaveSpec(kappa, m, n)), cols = ksim.cols, rows = ksim.rows, depth = ksim.depth, kx = 2 * Math.PI * m / cols;
    const amp = s => { let x = 0; const a = s.atoms; for (let z = 0; z < depth; z++) for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) x += (a[(z * rows + r) * cols + c].q / S - 1) * Math.cos(kx * c); return x / (cols * rows * depth) * 2; };
    const ser = []; for (let t = 0; t < 200; t++) { ser.push(amp(ksim)); SIM.step(ksim); }
    const mean = ser.reduce((x, y) => x + y, 0) / ser.length; const cr = [];
    for (let t = 1; t < ser.length; t++) if ((ser[t - 1] - mean) <= 0 && (ser[t] - mean) > 0) cr.push(t);
    const period = cr.length > 1 ? (cr[cr.length - 1] - cr[0]) / (cr.length - 1) : NaN;
    const omegaMeas = 2 * Math.PI / period, omegaThy = 2 * Math.sqrt(kappa) * Math.abs(Math.sin(kx / 2));
    return {
      dQ: finite ? Math.abs(q1 - q0) / S : NaN, dP: finite ? Math.abs(p1 - p0) / S : NaN, finite,
      E0: +E0.toFixed(2), eMin: +eMin.toFixed(2), eMax: +eMax.toFixed(2), rebounds,
      omegaMeas: +omegaMeas.toFixed(4), omegaThy: +omegaThy.toFixed(4), dispRatio: +(omegaMeas / omegaThy).toFixed(3),
    };
  }

  // arc G 풍경(원자 = 자기 가둠) — 중앙 고진폭 펄스, 관성, 비선형 α(>1). pulseSpec(step-0011, α=1)와 같은 IC 형태지만
  //   α 를 노브로 받는다(새 법칙·새 노브 0 — 기존 inertial·α 조합). 선형(α=1)은 분산해 흩어지지만 α>1 은 분산을
  //   *되감아* 자기집속한다(FPUT형 비조화). κ 는 α>1 안정역(작은 κ — step-0008 의 α=3 발산 경계 회피).
  function breatherSpec(kappa, amp, alpha, n) {
    const cols = n || 12, rows = n || 12, depth = n || 12, W = 100, H = 100, D = 100, S = K.SCALE;
    const atoms = [];
    for (let z = 0; z < depth; z++) for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const rx = (c + 0.5) / cols * W, ry = (r + 0.5) / rows * H, rz = (z + 0.5) / depth * D - D / 2;
      const dc = Math.abs(c - (cols - 1) / 2), dr = Math.abs(r - (rows - 1) / 2), dz = Math.abs(z - (depth - 1) / 2);
      const blob = (dc < 1 && dr < 1 && dz < 1) ? amp : 0;          // 중앙 2³ 고진폭 펄스(v=0 정지 출발)
      atoms.push({ rx, ry, rz, q: Math.round((1 + blob) * S), x: 1, Z: 1, N: 0, e: 1, vx: 0, vy: 0, v: 0 });
    }
    return { cols, rows, depth, W, H, D, atoms, knobs: { kappa, theta: 0, alpha, inertial: 1 } };
  }

  // 창발 측정(arc G — 원자/자기 가둠) — 비선형이 분산을 *되감아* 들뜸을 가두는지 *읽는* 지표(author 라벨 아님).
  //   같은 IC 를 선형(α=1)·비선형(α>1)로 돌려 *지속 최대진폭*(시작 과도 후 시간평균 peak)을 비교한다.
  //   선형 파동은 흩어져 peak 가 배경으로 가라앉고(질량 0·골드스톤), 비선형 자기집속은 peak 를 높게 유지한다
  //   (= 비분산 국소 들뜸 = 이산 브리더 씨앗). 유한 토러스라 분산파도 재귀(recurrence)로 가끔 재집속 →
  //   *순간* peak 은 비단조 → 시간평균으로 본다. ΣQ·ΣP 비트 보존·발산 없음(유한)도 같이 확인.
  function breatherMeasure(kappa, amp, ticks, n) {
    const SIM = (typeof require !== 'undefined') ? require('./flux-sim.js') : globalThis.HGO.sim;
    const S = K.SCALE;
    const peak = s => { let mx = 0; for (const a of s.atoms) { const e = Math.abs((a.q - S) / S); if (e > mx) mx = e; } return mx; };
    const run = alpha => {
      const sim = SIM.createSim(breatherSpec(kappa, amp, alpha, n));
      let q0 = 0, p0 = 0; for (const a of sim.atoms) { q0 += a.q; p0 += (a.v || 0); }
      let s = 0, cnt = 0, mn = Infinity;
      for (let t = 0; t < ticks; t++) { SIM.step(sim); if (t >= 20) { const p = peak(sim); s += p; cnt++; if (p < mn) mn = p; } }
      let q1 = 0, p1 = 0; for (const a of sim.atoms) { q1 += a.q; p1 += (a.v || 0); }
      const fin = Number.isFinite(sim.atoms[0].q);
      return { mean: +(s / cnt).toFixed(4), min: +mn.toFixed(4), dQ: fin ? Math.abs(q1 - q0) / S : NaN, dP: fin ? Math.abs(p1 - p0) / S : NaN, fin };
    };
    const lin = run(1), non = run(2);
    return { lin, non, ratio: +(non.mean / lin.mean).toFixed(3) };
  }

  // 창발 측정(arc G — 브리더 내부 진동수) — 갇힌 들뜸이 *진짜 이산 브리더*임을 가르는 결정적 지표(author 아님).
  //   브리더 핵(부호 있는 최대 들뜸 = 가장 높은 봉우리)의 시간열 → 진동 주기 → 내부 진동수 ω_b. 선형 포논 전파
  //   대역 상한 ω_max=2√(3κ)(3D 6-이웃, k=π 전 축; step-0011 분산관계 ω(k)=2√κ·|sin| 의 3축 합 최대) 와 비교.
  //   경화(hardening) 비선형이면 ω_b 가 진폭 따라 *상승* → 대역 *밖*(공명할 포논 없음) → 방사 불가 → 영속 국소화.
  //   진폭 2·3·4 를 돌려 (대역 밖 여부 + 경화 추세)를 함께 본다. ΣP 비트 보존도 확인.
  function breathingMeasure(kappa, ticks, n) {
    const SIM = (typeof require !== 'undefined') ? require('./flux-sim.js') : globalThis.HGO.sim;
    const S = K.SCALE;
    const smax = s => { let mx = -Infinity; for (const a of s.atoms) { const e = (a.q - S) / S; if (e > mx) mx = e; } return mx; };  // 부호 있는 최대 들뜸(브리더 핵)
    const run = amp => {
      const sim = SIM.createSim(breatherSpec(kappa, amp, 2, n));
      let p0 = 0; for (const a of sim.atoms) p0 += (a.v || 0);
      const ser = []; for (let t = 0; t < ticks; t++) { ser.push(smax(sim)); SIM.step(sim); }
      let p1 = 0; for (const a of sim.atoms) p1 += (a.v || 0);
      const fin = Number.isFinite(sim.atoms[0].q);
      const m = ser.reduce((x, y) => x + y, 0) / ser.length, cr = [];           // 평균 상향 영점통과 → 주기
      for (let t = 1; t < ser.length; t++) if ((ser[t - 1] - m) <= 0 && (ser[t] - m) > 0) cr.push(t);
      const per = cr.length > 1 ? (cr[cr.length - 1] - cr[0]) / (cr.length - 1) : NaN;
      return { omega: +(2 * Math.PI / per).toFixed(4), ncross: cr.length, dP: fin ? Math.abs(p1 - p0) / S : NaN, fin };
    };
    return { a2: run(2), a3: run(3), a4: run(4), bandMax: +(2 * Math.sqrt(3 * kappa)).toFixed(4) };
  }

  // arc H/I 풍경(여러 브리더) — x 축을 따라 *여러* 고진폭 펄스(2³ 블록)를 일렬로 놓는다. breatherSpec 의 한 펄스를
  //   centers 목록으로 일반화(새 법칙·새 노브 0 — 같은 inertial·α). 두 개(분자 씨앗)·세 개(사슬=고분자 씨앗)를
  //   같은 코드로 만든다(DRY·복사 0). 중심은 비율로(n=12 면 항등 → 골든 불변·작은 격자는 위치 보존).
  function lumpChainSpec(kappa, amp, alpha, centers, n) {
    const cols = n || 12, rows = n || 12, depth = n || 12, W = 100, H = 100, D = 100, S = K.SCALE;
    const rmid = Math.floor((rows - 1) / 2), zmid = Math.floor((depth - 1) / 2);
    const cset = centers.map(cc => Math.round(cc / 12 * cols));
    const atoms = [];
    for (let z = 0; z < depth; z++) for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const rx = (c + 0.5) / cols * W, ry = (r + 0.5) / rows * H, rz = (z + 0.5) / depth * D - D / 2;
      let blob = 0;
      for (const cc of cset) if ((c === cc || c === cc + 1) && (r === rmid || r === rmid + 1) && (z === zmid || z === zmid + 1)) blob = amp;
      atoms.push({ rx, ry, rz, q: Math.round((1 + blob) * S), x: 1, Z: 1, N: 0, e: 1, vx: 0, vy: 0, v: 0 });
    }
    return { cols, rows, depth, W, H, D, atoms, knobs: { kappa, theta: 0, alpha, inertial: 1 } };
  }

  // 창발 측정(arc H/I — 다체 국소화) — 여러 브리더가 *서로 다른 자리에* 동시에 갇혀 *공존*하는지 *읽는* 지표.
  //   각 구획(seg = x 열 범위)의 시작 과도 후 시간평균 최대진폭(peak)을 본다 — 비선형(α=2)은 구획마다 코어를
  //   유지하지만 선형(α=1)은 흩어져 합쳐진다. 코어가 *각 자리에 고정*(핀닝)되므로 N 개 펄스 → N 개 지속 코어
  //   = 분자(2)·사슬(≥3, 고분자) 의 *기하* 씨앗. 결합에너지/포화(진짜 화학결합)는 author 0 — 측정 아닌 미해결.
  function multiBreatherMeasure(kappa, amp, centers, segs, ticks, n) {
    const SIM = (typeof require !== 'undefined') ? require('./flux-sim.js') : globalThis.HGO.sim;
    const S = K.SCALE;
    const peakRange = (s, c0, c1) => { let mx = 0, i = 0, N = s.cols; for (let z = 0; z < N; z++) for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) { if (c >= c0 && c <= c1) { const e = Math.abs((s.atoms[i].q - S) / S); if (e > mx) mx = e; } i++; } return mx; };
    const run = alpha => {
      const sim = SIM.createSim(lumpChainSpec(kappa, amp, alpha, centers, n));
      let p0 = 0; for (const a of sim.atoms) p0 += (a.v || 0);
      const sums = segs.map(() => 0), mins = segs.map(() => Infinity); let cnt = 0;
      for (let t = 0; t < ticks; t++) { SIM.step(sim); if (t >= 20) { segs.forEach((sg, k) => { const p = peakRange(sim, sg[0], sg[1]); sums[k] += p; if (p < mins[k]) mins[k] = p; }); cnt++; } }
      let p1 = 0; for (const a of sim.atoms) p1 += (a.v || 0);
      const fin = Number.isFinite(sim.atoms[0].q);
      return { means: sums.map(s => +(s / cnt).toFixed(4)), mins: mins.map(m => +m.toFixed(4)), dP: fin ? Math.abs(p1 - p0) / S : NaN, fin };
    };
    const non = run(2), lin = run(1);
    const ratios = non.means.map((m, k) => +(m / lin.means[k]).toFixed(3));
    return { non, lin, ratios, minRatio: Math.min.apply(null, ratios), minMeanNon: Math.min.apply(null, non.means), nSeg: segs.length };
  }

  // arc G 측정 — 브리더 장수명(시간 지속). 단일 브리더를 길게 돌려 *후기 창*(late window) 평균 peak 가 선형 대비
  //   높게 유지되는지 본다 — 원자가 *영속하는 물질*인지(전이 아닌 안정 구조). ΣP 비트 보존도.
  function lifeMeasure(kappa, amp, ticks) {
    const SIM = (typeof require !== 'undefined') ? require('./flux-sim.js') : globalThis.HGO.sim;
    const S = K.SCALE;
    const peak = s => { let mx = 0; for (const a of s.atoms) { const e = Math.abs((a.q - S) / S); if (e > mx) mx = e; } return mx; };
    const run = alpha => {
      const sim = SIM.createSim(breatherSpec(kappa, amp, alpha, 12));
      let p0 = 0; for (const a of sim.atoms) p0 += (a.v || 0);
      let s = 0, n = 0; const lo = Math.floor(ticks * 0.6);
      for (let t = 0; t < ticks; t++) { SIM.step(sim); if (t >= lo) { s += peak(sim); n++; } }
      let p1 = 0; for (const a of sim.atoms) p1 += (a.v || 0);
      const fin = Number.isFinite(sim.atoms[0].q);
      return { late: +(s / n).toFixed(4), dP: fin ? Math.abs(p1 - p0) / S : NaN, fin };
    };
    const non = run(2), lin = run(1);
    return { non, lin, ratio: +(non.late / lin.late).toFixed(3) };
  }

  // arc G 측정 — 자기집속 세기 ∝ 진폭(경화). 진폭 스윕에서 (비선형/선형) 지속 peak 비가 진폭 따라 *증가* →
  //   강한 들뜸일수록 더 단단히 갇힘 = "원자 크기"의 연속 스펙트럼. breatherMeasure 를 진폭 인자로 재사용.
  function focusScaleMeasure(kappa, ticks) {
    const amps = [0.5, 1, 2, 3, 4, 5];
    const ratios = amps.map(a => breatherMeasure(kappa, a, ticks).ratio);
    return { amps, ratios, lo: ratios[0], hi: ratios[ratios.length - 1] };
  }

  // arc G 풍경 — *뜨거운 잡음* IC(균일 q + 결정론 해시 노이즈·v=0). 모듈레이션 불안정으로 비선형이 에너지를
  //   국소화하는지(브리더 자발 형성 = 무에서 물질) 보는 기질. rng 미사용(셀 인덱스 해시 → 비트 재현).
  function hotSpec(amp, kappa, alpha, n) {
    const cols = n || 12, rows = n || 12, depth = n || 12, W = 100, H = 100, D = 100, S = K.SCALE;
    const atoms = []; let i = 0;
    for (let z = 0; z < depth; z++) for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const rx = (c + 0.5) / cols * W, ry = (r + 0.5) / rows * H, rz = (z + 0.5) / depth * D - D / 2;
      const h = (Math.imul(i + 1, 2654435761) >>> 0) / 4294967296;       // 0..1 결정론(Knuth 승법 해시)
      atoms.push({ rx, ry, rz, q: Math.round((1 + amp * (h - 0.5)) * S), x: 1, Z: 1, N: 0, e: 1, vx: 0, vy: 0, v: 0 });
      i++;
    }
    return { cols, rows, depth, W, H, D, atoms, knobs: { kappa, theta: 0, alpha, inertial: 1 } };
  }

  // 창발 측정(arc G — 무에서 물질) — 뜨거운 잡음에서 비선형이 에너지를 *스스로 국소화*하는지 읽는 지표.
  //   역참여비 P=(Σe²)²/Σe⁴(=실효 들뜸 셀 수, 낮을수록 국소화) + 지속 최대진폭. 비선형은 잡음을 모아 봉우리를
  //   키우고(P↓·peak↑), 선형은 퍼진 채 남는다(P 큼). ΣQ 비트 보존도. P 안정(붕괴 안 함)은 populationMeasure.
  function spontaneousMeasure(kappa, amp, ticks, n) {
    const SIM = (typeof require !== 'undefined') ? require('./flux-sim.js') : globalThis.HGO.sim;
    const S = K.SCALE;
    const stat = s => { let s1 = 0, s2 = 0, mx = 0, q = 0; for (const a of s.atoms) { const e = (a.q - S) / S, e2 = e * e; s1 += e2; s2 += e2 * e2; if (Math.abs(e) > mx) mx = Math.abs(e); q += a.q; } return { P: s2 > 0 ? s1 * s1 / s2 : 0, peak: mx, sumQ: q }; };
    const run = alpha => {
      const sim = SIM.createSim(hotSpec(amp, kappa, alpha, n));
      const q0 = stat(sim).sumQ; let ps = 0, Ps = 0, cnt = 0; const lo = Math.floor(ticks / 2);
      for (let t = 0; t < ticks; t++) { SIM.step(sim); if (t >= lo) { const st = stat(sim); ps += st.peak; Ps += st.P; cnt++; } }
      const last = stat(sim), fin = Number.isFinite(sim.atoms[0].q);
      return { pkLate: +(ps / cnt).toFixed(4), Plate: +(Ps / cnt).toFixed(1), dQ: fin ? Math.abs(last.sumQ - q0) / S : NaN, fin };
    };
    const non = run(2), lin = run(1);
    return { non, lin, pkRatio: +(non.pkLate / lin.pkLate).toFixed(3), pRatio: +(lin.Plate / non.Plate).toFixed(3) };
  }

  // 풍경 — 임의 위치의 2³ 블록 펄스들(절대 좌표·corners=[c,r,z] 좌하단). lumpChainSpec(x-축·n=12 비율)과 달리
  //   *임의 배치*(간격 스윕·n 자유)용. 두 브리더 결합 천장(bindingCeiling) 측정이 쓴다. 새 법칙·노브 0.
  function blockLumpsSpec(kappa, amp, alpha, corners, n) {
    const cols = n || 12, rows = n || 12, depth = n || 12, W = 100, H = 100, D = 100, S = K.SCALE;
    const inB = (c, r, z, b) => (c === b[0] || c === b[0] + 1) && (r === b[1] || r === b[1] + 1) && (z === b[2] || z === b[2] + 1);
    const atoms = [];
    for (let z = 0; z < depth; z++) for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const rx = (c + 0.5) / cols * W, ry = (r + 0.5) / rows * H, rz = (z + 0.5) / depth * D - D / 2;
      let blob = 0; for (const b of corners) if (inB(c, r, z, b)) { blob = amp; break; }
      atoms.push({ rx, ry, rz, q: Math.round((1 + blob) * S), x: 1, Z: 1, N: 0, e: 1, vx: 0, vy: 0, v: 0 });
    }
    return { cols, rows, depth, W, H, D, atoms, knobs: { kappa, theta: 0, alpha, inertial: 1 } };
  }

  // 창발 측정(arc H — 결합 천장) — 두 브리더의 지속 peak 가 *간격에 거의 무관*하고 단일 브리더 값 부근에
  //   머무는지 본다(n=16 여유 상자). 강한 *고정-간격 결합*(인력 우물)이면 특정 간격에서 peak 가 크게 솟아야 하는데,
  //   단일 q 는 약한 단거리 협동뿐 → 간격 의존이 작음(spread<임계)·단일값 근처. = 비결합/비포화(SPINE §5 blob).
  function bindingCeilingMeasure(kappa, amp, ticks) {
    const SIM = (typeof require !== 'undefined') ? require('./flux-sim.js') : globalThis.HGO.sim;
    const S = K.SCALE, n = 16, m = Math.floor((n - 1) / 2);   // m=7
    const peak = s => { let mx = 0; for (const a of s.atoms) { const e = Math.abs((a.q - S) / S); if (e > mx) mx = e; } return mx; };
    const meanPk = corners => { const sim = SIM.createSim(blockLumpsSpec(kappa, amp, 2, corners, n)); let s = 0, c = 0, fin = true; for (let t = 0; t < ticks; t++) { SIM.step(sim); if (!Number.isFinite(sim.atoms[0].q)) { fin = false; break; } if (t >= 20) { s += peak(sim); c++; } } return fin ? +(s / c).toFixed(4) : NaN; };
    const single = meanPk([[m, m, m]]);
    const seps = [2, 3, 4, 6, 8];
    const pks = seps.map(sep => meanPk([[m - Math.ceil(sep / 2), m, m], [m - Math.ceil(sep / 2) + sep, m, m]]));
    const mx = Math.max.apply(null, pks), mn = Math.min.apply(null, pks);
    const fin = pks.every(Number.isFinite) && Number.isFinite(single);
    return { single: +single.toFixed(4), seps, pks: pks.map(x => +x.toFixed(4)), spread: +(mx / mn).toFixed(3), maxOverSingle: +(mx / single).toFixed(3), minPk: +mn.toFixed(4), fin };
  }

  // 창발 측정(arc G — 자발 물질의 안정 개체수) — 뜨거운 비선형을 길게 돌려 역참여비 P 가 *안정화*(한 덩어리로
  //   붕괴하지도, 다시 퍼지지도 않음)하는지 본다. 자발 형성된 국소 들뜸이 *지속하는 다체 개체군*(원자 기체)인지의
  //   증거 — P(후기)≈P(중기)(안정)·P<선형(국소)·P≫1(한 덩어리 아님·여럿).
  function populationMeasure(kappa, amp, ticks, n) {
    const SIM = (typeof require !== 'undefined') ? require('./flux-sim.js') : globalThis.HGO.sim;
    const S = K.SCALE;
    const Pof = s => { let s1 = 0, s2 = 0; for (const a of s.atoms) { const e = (a.q - S) / S, e2 = e * e; s1 += e2; s2 += e2 * e2; } return s2 > 0 ? s1 * s1 / s2 : 0; };
    const run = alpha => {
      const sim = SIM.createSim(hotSpec(amp, kappa, alpha, n));
      let pm = 0, pl = 0, cm = 0, cl = 0; const mid0 = Math.floor(ticks * 0.4), mid1 = Math.floor(ticks * 0.6);
      for (let t = 0; t < ticks; t++) { SIM.step(sim); const P = Pof(sim); if (t >= mid0 && t < mid1) { pm += P; cm++; } if (t >= Math.floor(ticks * 0.8)) { pl += P; cl++; } }
      return { Pmid: +(pm / cm).toFixed(1), Plate: +(pl / cl).toFixed(1), fin: Number.isFinite(sim.atoms[0].q) };
    };
    const non = run(2), lin = run(1);
    return { non, lin, drift: +(Math.abs(non.Plate - non.Pmid) / non.Pmid).toFixed(3), N: (n || 12) ** 3 };
  }

  // ══ arc J(다발) 공용 — 둘째 보존 채널 b=원자가(SPINE §5 다성분 확장) ══════════════════════════════
  //   단일 q 천장(0019·0020)을 측정이 명령한 다발로 돌파. 셀에 b(결합 전하) 추가 + knobs.valence opt-in
  //   (회귀 0: 기존 20 장면은 valence 미설정 → applyValence 미진입·비트 불변). q 는 관성 브리더(α>1),
  //   b 는 과감쇠 접착제, 둘 사이 교차-인력(flux-laws.applyValence)이 *고정 간격 결합*과 *포화*를 낸다.

  // 풍경 — 2³ 블록 브리더들(corners=[c,r,z] 좌하단) + 각 블록에 b 전하 bamp. blockLumpsSpec(단일 q)에 b 채널·
  //   valence 노브를 더한 다발판(DRY). q=1+amp, b=bamp(유한 결합 용량=원자가). 새 법칙 0(같은 rule()·교차항).
  function valenceLumpsSpec(kc, kb, amp, bamp, alpha, corners, n) {
    const cols = n || 16, rows = n || 16, depth = n || 16, W = 100, H = 100, D = 100, S = K.SCALE;
    const inB = (c, r, z, b) => (c === b[0] || c === b[0] + 1) && (r === b[1] || r === b[1] + 1) && (z === b[2] || z === b[2] + 1);
    const atoms = [];
    for (let z = 0; z < depth; z++) for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const rx = (c + 0.5) / cols * W, ry = (r + 0.5) / rows * H, rz = (z + 0.5) / depth * D - D / 2;
      let blob = 0; for (const b of corners) if (inB(c, r, z, b)) { blob = 1; break; }
      atoms.push({ rx, ry, rz, q: Math.round((1 + blob * amp) * S), b: Math.round(blob * bamp * S), x: 1, Z: 1, N: 0, e: 1, vx: 0, vy: 0, v: 0 });
    }
    return { cols, rows, depth, W, H, D, atoms, knobs: { kappa: 0.05, theta: 0, alpha, inertial: 1, valence: 1, kc, kappaB: kb } };
  }

  // x-축 프로파일(열별 최대 |들뜸|) — 브리더 위치·결합 거리를 읽는 공용 렌즈(author 0=q 함수).
  function xProfile(sim) {
    const N = sim.cols, S = K.SCALE, p = new Array(N).fill(0); let i = 0;
    for (let z = 0; z < N; z++) for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) { const e = Math.abs((sim.atoms[i].q - S) / S); if (e > p[c]) p[c] = e; i++; }
    return p;
  }
  // 두 지배 봉우리의 토러스 x-거리(d≥2 분리 요구 → 한 코어를 두 번 세지 않음) + 두 peak 값.
  function twoPeakDist(sim) {
    const N = sim.cols, p = xProfile(sim);
    let c1 = 0; for (let c = 0; c < N; c++) if (p[c] > p[c1]) c1 = c;
    let c2 = -1; for (let c = 0; c < N; c++) { const d = Math.min((c - c1 + N) % N, (c1 - c + N) % N); if (d >= 2 && (c2 < 0 || p[c] > p[c2])) c2 = c; }
    const d = c2 < 0 ? 0 : Math.min((c2 - c1 + N) % N, (c1 - c2 + N) % N);
    return { d, p1: p[c1], p2: c2 < 0 ? 0 : p[c2] };
  }
  function sumQv(sim) { const S = K.SCALE; let s = 0; for (const a of sim.atoms) s += a.q; return s; }
  function sumB(sim) { let s = 0; for (const a of sim.atoms) s += (a.b || 0); return s; }

  // 창발 측정(arc J — 결합) — valence 채널이 두 브리더를 *고정 결합 거리 d\*로 포획*하는지 읽는다. 같은 IC(간격
  //   sep0)를 채널 ON(kc>0)·OFF(kc=0)로 돌려, 후기 두-봉우리 거리·지속 peak 를 비교한다. ON 은 인력 우물이
  //   둘을 d* 로 끌어 안정 고정(peak 유지)·OFF 는 0019 천장(분산·간격 무관). ΣQ·ΣB 비트 보존도.
  function valenceBindMeasure(kc, kb, amp, bamp, sep0, ticks, n) {
    const SIM = (typeof require !== 'undefined') ? require('./flux-sim.js') : globalThis.HGO.sim;
    const S = K.SCALE, m = Math.floor(((n || 16) - 1) / 2), c0 = m - Math.ceil(sep0 / 2), c1 = c0 + sep0;
    const corners = [[c0, m, m], [c1, m, m]];
    const run = useKc => {
      const sim = SIM.createSim(valenceLumpsSpec(useKc, kb, amp, bamp, 2, corners, n));
      const q0 = sumQv(sim), b0 = sumB(sim); let ds = 0, ps = 0, cnt = 0; const lo = Math.floor(ticks * 0.6);
      for (let t = 0; t < ticks; t++) { SIM.step(sim); if (t >= lo) { const w = twoPeakDist(sim); ds += w.d; ps += Math.min(w.p1, w.p2); cnt++; } }
      const fin = Number.isFinite(sim.atoms[0].q);
      return { dLate: +(ds / cnt).toFixed(3), pkLate: +(ps / cnt).toFixed(4), dQ: fin ? Math.abs(sumQv(sim) - q0) / S : NaN, dB: fin ? Math.abs(sumB(sim) - b0) / S : NaN, fin };
    };
    const on = run(kc), off = run(0);
    return { on, off, sep0, pkRatio: +(on.pkLate / off.pkLate).toFixed(3), dDrop: +(sep0 - on.dLate).toFixed(3) };
  }

  // x-축 N 등분 구획 각각의 후기 평균 peak(마디별 코어 생존 — author 0=q 함수). 사슬이 *모든 마디*를 유지하는지.
  function segPeaksLate(sim0maker, n, ticks, nseg) {
    const SIM = (typeof require !== 'undefined') ? require('./flux-sim.js') : globalThis.HGO.sim;
    const S = K.SCALE, sim = sim0maker(), w = Math.floor(n / nseg);
    const sums = new Array(nseg).fill(0); let cnt = 0; const lo = Math.floor(ticks * 0.6);
    for (let t = 0; t < ticks; t++) { SIM.step(sim); if (t >= lo) { const mx = new Array(nseg).fill(0); let i = 0;
      for (let z = 0; z < n; z++) for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) { const e = Math.abs((sim.atoms[i].q - S) / S); const sg = Math.min(nseg - 1, Math.floor(c / w)); if (e > mx[sg]) mx[sg] = e; i++; }
      for (let k = 0; k < nseg; k++) sums[k] += mx[k]; cnt++; } }
    return { seg: sums.map(s => +(s / cnt).toFixed(4)), fin: Number.isFinite(sim.atoms[0].q) };
  }
  // x-축 N 등분 일렬 브리더 corners(중앙 정렬·간격 sp).
  function lineCorners(N, sp, n) { const m = Math.floor((n - 1) / 2), span = (N - 1) * sp, c0 = Math.floor((n - span) / 2) - 1, a = []; for (let i = 0; i < N; i++) a.push([c0 + i * sp, m, m]); return a; }

  // 창발 측정(arc J — 사슬=고분자 씨앗) — valence 전하 bamp 가 N 브리더 *일렬*을 선형 사슬로 묶어 *모든 마디*를
  //   유지하는지 읽는다(nseg 구획별 후기 peak). 전하 ON(bamp>0)은 b-접착제가 사슬을 결속해 마디마다 코어 생존,
  //   OFF(bamp=0=단일 q)는 0015 처럼 분산(약함). 최소 마디 peak ON ≫ OFF = 사슬 결합. ΣQ·ΣB 비트 보존.
  function valenceChainMeasure(kc, kb, amp, bamp, N, sp, ticks, n) {
    const corners = lineCorners(N, sp, n);
    const mk = bb => () => { const SIM = (typeof require !== 'undefined') ? require('./flux-sim.js') : globalThis.HGO.sim; return SIM.createSim(valenceLumpsSpec(kc, kb, amp, bb, 2, corners, n)); };
    const on = segPeaksLate(mk(bamp), n, ticks, N), off = segPeaksLate(mk(0), n, ticks, N);
    const minOn = Math.min.apply(null, on.seg), minOff = Math.min.apply(null, off.seg);
    // ΣB 보존 확인(별도 짧은 런)
    const SIM = (typeof require !== 'undefined') ? require('./flux-sim.js') : globalThis.HGO.sim, S = K.SCALE;
    const cs = SIM.createSim(valenceLumpsSpec(kc, kb, amp, bamp, 2, corners, n)); const b0 = sumB(cs), q0 = sumQv(cs);
    for (let t = 0; t < ticks; t++) SIM.step(cs);
    const fin = Number.isFinite(cs.atoms[0].q);
    return { on: on.seg, off: off.seg, minOn: +minOn.toFixed(4), minOff: +minOff.toFixed(4), ratio: +(minOn / minOff).toFixed(3), fin, dQ: fin ? Math.abs(sumQv(cs) - q0) / S : NaN, dB: fin ? Math.abs(sumB(cs) - b0) / S : NaN };
  }

  // 창발 측정(arc J — 사슬 선형성: 덩어리 아님) — 결합된 *코어*(고임계)의 q-가중 2차 모멘트로 세장비
  //   (x-신장 σx / 가로 신장 √((σy²+σz²)/2)) + 가로 폭을 읽는다. 선형 사슬이면 세장비≫1·가로 폭≈1셀(단일파일),
  //   덩어리면 ~1·두꺼움. valence 전하 ON 이 사슬을 *얇은 1D 선*으로 죄는지(OFF=단일 q 보다 선형·얇음) 본다.
  function chainLinearityMeasure(kc, kb, amp, bamp, N, sp, ticks, n, coreTh) {
    const SIM = (typeof require !== 'undefined') ? require('./flux-sim.js') : globalThis.HGO.sim;
    const S = K.SCALE, corners = lineCorners(N, sp, n), th = coreTh || 1.2;
    const moments = sim => {
      let i = 0, W = 0, cx = 0, cy = 0, cz = 0;
      for (let z = 0; z < n; z++) for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) { const e = Math.abs((sim.atoms[i].q - S) / S), w = e > th ? e : 0; W += w; cx += w * c; cy += w * r; cz += w * z; i++; }
      if (W <= 0) return { ax: 0, wy: 0 };
      cx /= W; cy /= W; cz /= W; i = 0; let mx = 0, my = 0, mz = 0;
      for (let z = 0; z < n; z++) for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) { const e = Math.abs((sim.atoms[i].q - S) / S), w = e > th ? e : 0; mx += w * (c - cx) ** 2; my += w * (r - cy) ** 2; mz += w * (z - cz) ** 2; i++; }
      const sx = Math.sqrt(mx / W), tw = Math.sqrt((my / W + mz / W) / 2);
      return { ax: tw > 0 ? sx / tw : 0, wy: tw };
    };
    const run = bb => {
      const sim = SIM.createSim(valenceLumpsSpec(kc, kb, amp, bb, 2, corners, n));
      const q0 = sumQv(sim), b0 = sumB(sim); let as = 0, ws = 0, cnt = 0; const lo = Math.floor(ticks * 0.6);
      for (let t = 0; t < ticks; t++) { SIM.step(sim); if (t >= lo) { const m = moments(sim); as += m.ax; ws += m.wy; cnt++; } }
      const fin = Number.isFinite(sim.atoms[0].q);
      return { aspect: +(as / cnt).toFixed(3), tw: +(ws / cnt).toFixed(3), dQ: fin ? Math.abs(sumQv(sim) - q0) / S : NaN, dB: fin ? Math.abs(sumB(sim) - b0) / S : NaN, fin };
    };
    const on = run(bamp), off = run(0);
    return { on, off };
  }

  const SCENES = {
    // ── step-0001: 기질 + 단일 규칙 + 닫힌 장부 ── θ=0(문턱 없음) → 규칙은 순수 선형 확산.
    //   3D 격자: 중앙 블롭(고 q) + 배경(저 q) → 규칙이 기울기를 6-이웃으로 평형화한다. Σq 불변·spread 단조 감소가 가설.
    'step-0001': {
      id: 'step-0001',
      title: 'step-0001 — 기질: 단일 규칙 위의 3D 확산',
      did: '세계의 단 하나뿐인 규칙을 θ=0(문턱 없음·순수 확산)으로 처음 돌린다. 3D 격자 한가운데 q 가 뭉친 블롭을 놓는다.',
      observe: '가운데 밝은 덩어리가 6방향 이웃으로 번져 점점 평평해진다. 총량(watch sumQ)은 그대로인 채 퍼짐(spread)만 줄어든다.',
      desc: 'θ=0 이면 규칙 F=κ·sign(d)·|d|^α 는 순수 확산. 3D 격자 중앙 블롭이 6-이웃으로 퍼져 평형화하되 총량 Σq 는 불변(반대칭 보존). 세계의 유일한 법칙이 이 한 장면에서 처음 돈다.',
      ticks: 200,
      init(rng, K, opts) {
        const n = (opts && opts.scale) || 12;       // 격자 해상도(뷰어 조절·기본 12 → verify/골든 불변)
        const cols = n, rows = n, depth = n, W = 100, H = 100, D = 100, S = K.SCALE;
        const atoms = [];
        for (let z = 0; z < depth; z++) for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
          const rx = (c + 0.5) / cols * W, ry = (r + 0.5) / rows * H;
          const rz = (z + 0.5) / depth * D - D / 2;   // z=0 중심 대칭 배치(카메라 타깃 z=0 에 정렬)
          // 중앙 3×3×3 블롭 = 고 q, 그 외 배경 = 저 q. + 작은 결정론 노이즈(rng 는 초기 배치에만, SPINE §3).
          //   인간 단위 q 를 고정소수점 정수로 양자화(round) — 이후 규칙·보존·해시는 전부 정수.
          const dc = Math.abs(c - (cols - 1) / 2), dr = Math.abs(r - (rows - 1) / 2), dz = Math.abs(z - (depth - 1) / 2);
          const blob = (dc <= 1 && dr <= 1 && dz <= 1) ? 10 : 0;
          atoms.push(cell(rx, ry, rz, Math.round((1 + blob + rng() * 0.01) * S)));
        }
        // κ=0.1: 3D 6-이웃 명시적 확산 안정 조건 κ·Z<1 충족(0.1×6=0.6<1). 2D 의 κ=0.2(×4=0.8)와 같은 안정역.
        return { cols, rows, depth, W, H, D, atoms, knobs: { kappa: 0.1, theta: 0, alpha: 1 } };
      },
      watch(sim) { return measure(sim); },
      assert(w0, w1) {
        return [
          { name: 'Σq 보존(닫힌 장부)', pass: Math.abs(w1.sumQ - w0.sumQ) < 1e-6, value: `Δ=${(w1.sumQ - w0.sumQ).toExponential(2)}` },
          { name: '확산 평형화(spread↓)', pass: w1.spread < w0.spread, value: `${w0.spread} → ${w1.spread}` },
          { name: '평형 미완(아직 비0 — 완전 평탄 아님)', pass: w1.spread > 0, value: `spread=${w1.spread}` },
        ];
      },
    },

    // ── step-0002: arc B 임계 진입 — θ>0 → 자기조직화 동결 층(돌의 원형) ── 같은 규칙·새 법칙/노브 0(θ 만 올림).
    //   거친 무작위 q 풍경에서 시작: 큰 이웃 차는 사태로 흐르고, 차가 θ 아래로 떨어지면 플럭스 0 으로 잠긴다(동결).
    //   step-0001(θ=0)이 spread→0 으로 *평탄화*하는 것과 갈린다 — 여기선 사태가 스스로 멈추고 잔류 기울기가 *굳는다*.
    'step-0002': {
      id: 'step-0002',
      title: 'step-0002 — 임계: θ>0 의 자기조직화 동결(돌의 원형)',
      did: '같은 규칙에서 문턱 θ 만 올린다(새 법칙 0). 울퉁불퉁한 무작위 q 풍경에서 출발한다.',
      observe: '큰 차이는 흘러 평평해지다가, 이웃 차가 θ 아래로 떨어지면 멈춰 굳는다(동결). 화면이 끝까지 평평해지지 않고 거친 채 멈추며, watch 의 active(흐르는 간선)가 0 으로 간다.',
      desc: '같은 단일 규칙에서 문턱 θ 만 올린다(새 법칙·노브 0). 거친 q 풍경의 큰 기울기는 사태로 흐르지만, 이웃 차가 θ 아래로 떨어지면 플럭스가 0 으로 잠긴다. 사태가 스스로 멈춰 모든 이웃 차가 θ 부근인 동결 상태로 자기조직화 — θ=0 확산(완전 평탄화)과 갈리는 첫 비확산 층(고체·구조의 토대).',
      ticks: 400,
      init(rng, K, opts) {
        const n = (opts && opts.scale) || 12;       // 격자 해상도(뷰어 조절·기본 12 → verify/골든 불변)
        const cols = n, rows = n, depth = n, W = 100, H = 100, D = 100, S = K.SCALE;
        const atoms = [];
        for (let z = 0; z < depth; z++) for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
          const rx = (c + 0.5) / cols * W, ry = (r + 0.5) / rows * H;
          const rz = (z + 0.5) / depth * D - D / 2;            // z=0 중심 대칭(카메라 타깃 정렬)
          // 거친 무작위 적재(rng 는 초기 배치에만 — SPINE §3): q ∈ [0,10] → 이웃 차가 θ 보다 크게 흩어짐(사태 씨앗).
          atoms.push(cell(rx, ry, rz, Math.round(rng() * 10 * S)));
        }
        // κ=0.1(3D 안정역 동일 κ·Z=0.6<1). θ=1.0: 이웃 차 1.0 미만은 동결, 초과만 사태. α=1(선형).
        return { cols, rows, depth, W, H, D, atoms, knobs: { kappa: 0.1, theta: 1.0, alpha: 1 } };
      },
      watch(sim) { return Object.assign(measure(sim), frozenMeasure(sim)); },
      assert(w0, w1) {
        const theta = w1.theta;
        return [
          { name: 'Σq 보존(닫힌 장부)', pass: Math.abs(w1.sumQ - w0.sumQ) < 1e-6, value: `Δ=${(w1.sumQ - w0.sumQ).toExponential(2)}` },
          { name: '사태 발생(초기 활성 간선>0)', pass: w0.active > 0, value: `active(초기)=${w0.active}` },
          { name: '자기조직화 동결(사태 정지: 활성 간선 0·flux 0)', pass: w1.active === 0 && w1.flux === 0, value: `active ${w0.active}→${w1.active}, flux=${w1.flux}` },
          { name: '동결 경계(모든 이웃 차 ≲ θ)', pass: w1.maxNbr <= theta + 0.01, value: `maxNbr ${w1.maxNbr} ≲ θ=${theta}` },
          { name: '동결 잔류 구조(≠확산 평탄: spread>0)', pass: w1.spread > 0, value: `spread ${w0.spread} → ${w1.spread}` },
        ];
      },
    },

    // ── step-0003: arc B 후반 — θ 가 freeze 전이를 *제어*한다(임계 노브) ── 새 법칙/노브 0(θ 만 스윕).
    //   같은 거친 풍경을 θ∈{0,0.5,1,2,4} 로 relaxation → 잔류 spread 가 θ 와 함께 단조로 커진다.
    //   θ=0 은 확산극한(거의 평탄), θ↑ 는 동결극한(잔류 큼). 확산↔동결은 *연속 전이*이고 θ 가 순서 노브.
    'step-0003': {
      id: 'step-0003',
      title: 'step-0003 — 임계: θ 가 확산↔동결 전이를 제어',
      did: '문턱 θ 만 여러 값으로 바꿔 가며(스윕) 같은 풍경을 풀어 확산↔동결 사이를 훑는다.',
      observe: 'θ 가 작으면 거의 평평(확산), 클수록 더 거칠게 굳는다(동결). 남는 거칢(잔류 spread)이 θ 와 함께 단조로 커진다 — 확산과 동결이 한 규칙의 두 극한임이 드러난다.',
      desc: '같은 단일 규칙·같은 거친 풍경에서 문턱 θ 만 스윕한다(새 법칙·노브 0). 잔류 기울기(평형 후 남는 spread)가 θ 와 함께 단조로 커진다 — θ=0 은 거의 완전 평탄(확산), θ 클수록 더 굳는다(동결). 확산과 동결은 같은 규칙의 두 극한이고, θ 가 그 사이를 잇는 순서 노브임을 측정으로 보인다(arc B 임계의 골격).',
      ticks: 400,
      init(rng, K, opts) { return roughSpec(1.0, (opts && opts.scale) || 12); },   // 메인 궤적(θ=1.0)·격자 조절(기본 12=골든)
      watch(sim) { return Object.assign(measure(sim), frozenMeasure(sim)); },
      assert(w0, w1, K) {
        const thetas = [0, 0.5, 1, 2, 4];
        const resid = thetas.map(th => freezeResidual(roughSpec(th), 400));   // θ-스윕 재실행(보조·결정론)
        let monotone = true;
        for (let k = 1; k < resid.length; k++) if (resid[k] < resid[k - 1] - 1e-6) monotone = false;
        return [
          { name: 'Σq 보존(닫힌 장부)', pass: Math.abs(w1.sumQ - w0.sumQ) < 1e-6, value: `Δ=${(w1.sumQ - w0.sumQ).toExponential(2)}` },
          { name: 'θ-freeze 전이(잔류 spread ↑θ 단조)', pass: monotone, value: `θ${JSON.stringify(thetas)} → resid${JSON.stringify(resid)}` },
          { name: '확산극한(θ=0 거의 평탄)', pass: resid[0] < 0.5, value: `resid(θ=0)=${resid[0]}` },
          { name: '동결극한(θ↑ → 잔류 ↑)', pass: resid[resid.length - 1] > resid[0] + 1, value: `resid(θ=4)=${resid[resid.length - 1]} ≫ resid(θ=0)=${resid[0]}` },
        ];
      },
    },

    // ── step-0004: arc C — 동결 상태의 도메인 + 전선 구조 ── 새 법칙/노브 0(블롭 IC + θ=1.0 동결).
    //   구조 있는 풍경(3 블롭 + 노이즈)이 동결하면 *가파른 경계(전선)*로 갈린 *덩어리(도메인)* 가 남는가.
    //   전선 = |Δq|≥0.8 간선(끊음), 도메인 = 남은 연결성분. 1(균일)도 N(완전 분절)도 아니면 구조 창발.
    'step-0004': {
      id: 'step-0004',
      title: 'step-0004 — 구조: 동결 도메인 + 전선(지형의 씨앗)',
      did: '블롭 3개로 구조 있는 풍경을 θ=1.0 으로 동결시킨다.',
      observe: '가파른 경계(전선)로 갈린 덩어리(도메인) 여러 개가 남는다. 균일 한 덩어리도, 셀 하나하나로 쪼개진 것도 아닌 중간 구조 — 지형·해안선의 씨앗(watch 의 도메인 수).',
      desc: '구조 있는 q 풍경(3 블롭 + 노이즈)을 θ=1.0 으로 동결시킨다(새 법칙·노브 0). 동결 상태를 군집하면 가파른 경계(전선, |Δq|≥0.8)로 갈린 덩어리(도메인)가 남는다 — 균일(1개)도 완전 분절(셀 수)도 아닌 중간 구조. 도메인/전선은 지형·해안선의 씨앗(현상 지도 arc C).',
      ticks: 400,
      init(rng, K, opts) { return blobSpec(1.0, (opts && opts.scale) || 12); },
      watch(sim) { return Object.assign(measure(sim), domains(sim, 0.8)); },
      assert(w0, w1) {
        return [
          { name: 'Σq 보존(닫힌 장부)', pass: Math.abs(w1.sumQ - w0.sumQ) < 1e-6, value: `Δ=${(w1.sumQ - w0.sumQ).toExponential(2)}` },
          { name: '구조 창발(1 < 도메인 < 셀수)', pass: w1.nDom > 1 && w1.nDom < w1.nCells, value: `nDom=${w1.nDom} / nCells=${w1.nCells}` },
          { name: '전선 존재(0 < frontFrac < 1)', pass: w1.frontFrac > 0 && w1.frontFrac < 1, value: `frontFrac=${w1.frontFrac}` },
          { name: '큰 도메인 존재(maxFrac>균일이상)', pass: w1.maxFrac > 1 / w1.nCells, value: `maxFrac=${w1.maxFrac}` },
          { name: 'coarsening(작은 도메인 융합·지배 도메인 성장)', pass: w1.nDom < w0.nDom && w1.maxFrac > w0.maxFrac, value: `nDom ${w0.nDom}→${w1.nDom}, maxFrac ${w0.maxFrac}→${w1.maxFrac}` },
        ];
      },
    },

    // ── step-0005: arc C 완성 — 공간 상관 길이 ξ(척도 비의존) ── 새 법칙/노브 0. step-0004 동결 세계를 새 렌즈로.
    //   도메인 수는 군집 임계 의존 — ξ(자기상관 1/e 거리)는 임계 무관. 구조 풍경 ξ vs 백색잡음 ξ 대조로
    //   "동결 구조가 특정 척도를 가진다"를 정량(균일도 백색잡음도 아님). 메인 궤적은 blobSpec(1.0)(step-0004 와 동일 세계).
    'step-0005': {
      id: 'step-0005',
      title: 'step-0005 — 구조: 상관 길이 ξ(척도 비의존 지표)',
      did: '동결된 q 장의 공간 크기를, 군집 임계 없이 자기상관이 1/e 로 떨어지는 거리 ξ 로 잰다.',
      observe: '구조 풍경(블롭)은 ξ>1(여러 셀에 걸친 덩어리), 백색잡음은 ξ<1(이웃끼리 무관). watch 의 ξ 값으로 동결 세계가 고유한 크기 척도를 가짐을 본다.',
      desc: '동결 구조의 척도를 군집 임계 없이 잰다 — q 장 자기상관이 1/e 로 떨어지는 거리 ξ. 구조 풍경(블롭)은 ξ>1(여러 셀에 걸친 덩어리), 백색잡음은 ξ<1(이웃 무상관). 동결 세계가 특정 공간 척도를 가짐을 정량(arc C 완성·척도 분리 arc D 의 토대).',
      ticks: 400,
      init(rng, K, opts) { return blobSpec(1.0, (opts && opts.scale) || 12); },
      watch(sim) { return Object.assign(measure(sim), correlationLength(sim)); },
      assert(w0, w1) {
        const rough = correlationLength(frozenSim(roughSpec(1.0), 400));   // 백색잡음 동결 대조(결정론)
        return [
          { name: 'Σq 보존(닫힌 장부)', pass: Math.abs(w1.sumQ - w0.sumQ) < 1e-6, value: `Δ=${(w1.sumQ - w0.sumQ).toExponential(2)}` },
          { name: '구조 척도(ξ>1: 여러 셀 상관)', pass: w1.xi > 1, value: `ξ(블롭)=${w1.xi}, corr=${JSON.stringify(w1.corr)}` },
          { name: '유한 척도(ξ<maxR: 무한상관 아님)', pass: w1.xi < 6, value: `ξ=${w1.xi} < maxR=6` },
          { name: '구조 vs 백색잡음(ξ_블롭 ≫ ξ_잡음)', pass: w1.xi > rough.xi, value: `ξ_블롭=${w1.xi} > ξ_잡음=${rough.xi}` },
        ];
      },
    },

    // ── step-0006: arc D — 시간 척도 분리(산 느림 + 물 빠름 공존) ── 새 법칙/노브 0(블롭 IC + θ=0 확산).
    //   구조 풍경을 확산 relaxation 하며 두 공간 척도를 추적: 작은 척도(이웃 차)는 큰 척도(블록 변동)보다
    //   먼저 평형된다. 확산 모드 감쇠율 ∝ k² → 같은 한 규칙이 척도에 따라 다른 *시간* 척도로 푼다 = 층 공존의 씨앗.
    'step-0006': {
      id: 'step-0006',
      title: 'step-0006 — 척도 분리: 작은 척도 빠른 평형 + 큰 척도 느린 흐름',
      did: '구조 풍경을 θ=0 확산으로 풀면서 큰 척도·작은 척도 진폭을 매 tick 따라간다.',
      observe: '작은 무늬(고주파)가 큰 무늬(저주파)보다 ~2배 빨리 사라진다. 같은 한 규칙인데 척도마다 푸는 속도가 다르다 — 빨리 잦아드는 물, 느리게 남는 산이 한 세계에 공존하는 토대.',
      desc: '같은 단일 규칙·구조 풍경(블롭)을 θ=0 확산으로 relaxation 한다(새 법칙·노브 0). 두 공간 척도의 진폭을 매 tick 추적하면 작은 척도(이웃 차 RMS=고주파)가 큰 척도(블록 평균 편차 RMS=저주파)보다 ~2배 빠르게 1/e 로 감쇠한다 — 확산 모드 감쇠율 ∝ k². 같은 한 규칙이 척도에 따라 다른 시간 척도로 풀린다는 측정: "산(느림)과 물(빠름)이 한 세계에 공존"의 토대(현상 지도 arc D).',
      ticks: 200,
      init(rng, K, opts) { return blobSpec(0.0, (opts && opts.scale) || 12); },
      watch(sim) { return measure(sim); },
      assert(w0, w1) {
        const sep = scaleSeparation(blobSpec(0.0), 200, 4);   // 두 척도 시계열 수집(보조·결정론)
        return [
          { name: 'Σq 보존(닫힌 장부)', pass: Math.abs(w1.sumQ - w0.sumQ) < 1e-6, value: `Δ=${(w1.sumQ - w0.sumQ).toExponential(2)}` },
          { name: '시간 척도 분리(작은 척도 먼저 평형: τ_small < τ_large)', pass: sep.tauSmall < sep.tauLarge, value: `τ_small=${sep.tauSmall} < τ_large=${sep.tauLarge}` },
          { name: '분리비 유의(τ_large/τ_small > 1.5)', pass: sep.ratio > 1.5, value: `ratio=${sep.ratio}` },
          { name: '두 척도 모두 확산 감쇠(>1/e 줄어듦)', pass: sep.smallEnd < sep.small0 / Math.E && sep.largeEnd < sep.large0 / Math.E, value: `small ${sep.small0}→${sep.smallEnd}, large ${sep.large0}→${sep.largeEnd}` },
        ];
      },
    },

    // ── step-0007: arc D 완성 — 산·물 *공간* 공존(한 세계 한 tick) ── 새 법칙/노브 0(블롭 IC + θ=0.5 고정).
    //   step-0006 은 두 척도의 *시간* 분리만 봤다(θ=0, 결국 둘 다 평탄). 여기선 단일 θ>0 한 세계에서 큰 기울기
    //   영역은 아직 흐르고(물) 작은 기울기 영역은 이미 굳어(산) *같은 tick* 에 공간적으로 공존한다. 시간이 가면 물→산.
    'step-0007': {
      id: 'step-0007',
      title: 'step-0007 — 척도 분리: 산(동결)·물(흐름) 공간 공존(한 세계)',
      did: '구조 풍경을 θ=0.5 한 세계로 푼다.',
      observe: '같은 순간에 큰 기울기 영역은 아직 흐르고(물), 작은 기울기 영역은 이미 굳어(산) 공간적으로 나란히 공존한다. 시간이 가면 동결 전선이 전진해 물이 산으로 바뀐다 — 별도 법칙 없이 한 규칙이 산과 물을 동시에 만든다.',
      desc: '같은 단일 규칙·구조 풍경(블롭)을 θ=0.5 로 relaxation 한다(새 법칙·노브 0). 단일 문턱 한 세계에서 큰 기울기 영역은 아직 사태로 흐르고(물), 작은 기울기 영역은 이미 플럭스 0 으로 굳어(산) 같은 tick 에 두 국면이 공간적으로 공존한다. tick 160 스냅샷: 물 셀 0.555 · 산 셀 0.445(둘 다 실질). 시간이 가면 동결 전선이 전진해 물→산으로 전환(actEnd→0). 별도 법칙 없이 한 규칙이 한 필드에서 산과 물을 동시에 만든다(현상 지도 arc D 완성).',
      ticks: 400,
      init(rng, K, opts) { return blobSpec(0.5, (opts && opts.scale) || 12); },
      watch(sim) { return measure(sim); },
      assert(w0, w1) {
        const p = phaseCoexistence(blobSpec(0.5), 400, 160);   // 상 공존 시계열 + tick160 셀 스냅샷(보조·결정론)
        return [
          { name: 'Σq 보존(닫힌 장부)', pass: Math.abs(w1.sumQ - w0.sumQ) < 1e-6, value: `Δ=${(w1.sumQ - w0.sumQ).toExponential(2)}` },
          { name: '시간 공존(간선: 물·산 둘 다 실질, peakCo>0.1)', pass: p.peakCo > 0.1, value: `peakCo=${p.peakCo} @tick ${p.peakT}` },
          { name: '공간 공존(tick160 셀: 물·산 둘 다 >0.3)', pass: p.waterFrac > 0.3 && p.earthFrac > 0.3, value: `물=${p.waterFrac} · 산=${p.earthFrac} @tick ${p.snap}` },
          { name: '물→산 전환(동결 전선 전진: actEnd→0 < act0)', pass: p.actEnd < p.act0 && p.actEnd < 0.01, value: `act ${p.act0}→${p.actEnd}, fro ${p.fro0}→${p.froEnd}` },
        ];
      },
    },

    // ── step-0008: 규칙 4 자유도 마지막 — α(비선형 차수) ── 새 법칙/노브 0(기존 α 노브 스윕, θ=0 고정).
    //   지금껏 모든 장면이 α=1(선형 확산). α>1 이면 Φ=…|d|^α 가 작은 기울기(|d|<1)에서 sub-linear → 거의 안 흐름
    //   (θ 없이도 *효과적 동결*), 큰 기울기(|d|>1)에서 super-linear → 가속(κ 커지면 발산). α 가 비선형 동역학의 마지막 자유도.
    'step-0008': {
      id: 'step-0008',
      title: 'step-0008 — 비선형: α>1 가 문턱 없이 동결을 만든다',
      did: '한 번도 안 쓰던 자유도 α(비선형 지수)를 켠다(θ=0 고정).',
      observe: 'α=2 면 작은 기울기는 거의 안 흘러 문턱 없이도 거칢이 남고(효과적 동결), 큰 기울기는 가속한다. α=1(순수 확산·거의 평탄)과 갈린다. α=3 은 큰 기울기가 폭주해 발산 — α>1 은 안정 κ 가 더 작아야 함을 보인다.',
      desc: '규칙의 4 자유도 중 한 번도 안 쓴 α(비선형 지수)를 켠다(새 법칙·노브 0, θ=0 고정). Φ=κ·sign(d)·|d|^α 라 α=2 면 작은 기울기(|d|<1)는 |d|²<|d| 로 거의 안 흐르고(문턱 θ 없이도 효과적 동결 — 잔류 spread 남음), 큰 기울기는 가속한다. α=1(순수 확산, 잔류≈0)과 측정으로 갈린다. α=3·같은 κ 는 큰 기울기 폭주로 발산(비선형 불안정 경계) — α>1 은 안정 κ 가 더 작아야 함을 측정으로.',
      ticks: 300,
      init(rng, K, opts) { return blobSpec(0.0, (opts && opts.scale) || 12, 2, 0.1); },   // 메인: θ=0·α=2·κ=0.1(안정역)
      watch(sim) { return measure(sim); },
      assert(w0, w1) {
        const e = alphaEffect(0.0, 0.1, 300);   // α∈{1,2,3} 블롭 θ=0 relaxation 비교(보조·결정론)
        return [
          { name: 'Σq 보존(닫힌 장부·α=2 안정)', pass: Math.abs(w1.sumQ - w0.sumQ) < 1e-6 && e.a2.finite, value: `Δ=${(w1.sumQ - w0.sumQ).toExponential(2)}, α2 |Δq|=${e.a2.dq.toExponential(2)}` },
          { name: 'α>1 효과적 동결(θ 없이 잔류↑: resid α2 ≫ α1)', pass: e.a2.resid > e.a1.resid + 0.5, value: `resid α1=${e.a1.resid} → α2=${e.a2.resid}` },
          { name: 'α=1 순수 확산 평탄(잔류≈0)', pass: e.a1.resid < 0.1, value: `resid(α=1)=${e.a1.resid}` },
          { name: '비선형 불안정 경계(α=3 같은 κ 발산·α=2 안정)', pass: e.a2.finite && !e.a3hi.finite, value: `α2 finite=${e.a2.finite}, α3 finite=${e.a3hi.finite}(resid=${e.a3hi.resid})` },
        ];
      },
    },

    // ── step-0009: 🔴 SOC — 구동 사태 크기의 θ 의존(앙상블) ── 새 법칙/노브 0(동결 기질 + 셀 1개 구동).
    //   이 세계엔 구동이 없어 단일 궤적엔 사태가 없다. 동결 상태에 q 펄스를 넣고 풀어 사태 크기를 앙상블로 모은다.
    //   θ↑ 동결이 전파 차단 → 사태 국소화(평균↓). θ=0 은 소산(확산). 메인 궤적 = roughSpec(0.5) 동결 기질.
    'step-0009': {
      id: 'step-0009',
      title: 'step-0009 — 임계: 구동 사태 크기의 θ 의존(SOC 앙상블)',
      did: '동결된 바닥에 셀 하나를 q 펄스로 톡 건드려, 번지는 사태 크기(q 가 변한 셀 수)를 여러 위치로 모은다.',
      observe: 'θ 가 클수록 동결이 전파를 막아 평균 사태 크기가 줄어든다(θ0.5≈16 → θ4≈3.6). θ=0 은 그냥 소산(사태가 아님). 임계 사태가 동결 문턱에 제어됨 — 멱법칙은 격자 크기 한계로 보류.',
      desc: '동결 상태에 셀 하나 q 펄스를 구동(새 법칙·노브 0, 구동=IC 섭동)하고 relaxation 으로 풀리는 사태 크기(=q 가 변한 셀 수)를 여러 구동 위치 앙상블로 모은다. θ 가 클수록 동결이 사태 전파를 차단해 평균 사태 크기가 단조 감소(θ0.5=16 → θ4=3.6), θ=0 은 펄스가 소산(사태 아닌 확산, size≈1). 임계 사태가 동결 문턱에 제어됨을 측정 — 멱법칙(척도 불변)은 유한 12³ 한계로 보류(🔴 부분 충족).',
      ticks: 400,
      init(rng, K, opts) { return roughSpec(0.5, (opts && opts.scale) || 12); },   // 메인: 동결 기질
      watch(sim) { return Object.assign(measure(sim), frozenMeasure(sim)); },
      assert(w0, w1) {
        const av = th => avalancheStats(th, 3.0, 200, 40);   // θ별 구동 사태 앙상블(보조·결정론)
        const a0 = av(0.0), a05 = av(0.5), a1 = av(1.0), a2 = av(2.0), a4 = av(4.0);
        const means = [a05.mean, a1.mean, a2.mean, a4.mean];
        let monoDown = true; for (let k = 1; k < means.length; k++) if (means[k] > means[k - 1] + 1e-9) monoDown = false;
        return [
          { name: 'Σq 보존(닫힌 장부)', pass: Math.abs(w1.sumQ - w0.sumQ) < 1e-6, value: `Δ=${(w1.sumQ - w0.sumQ).toExponential(2)}` },
          { name: '사태 존재(θ=0.5: 평균>1·분포 폭 max>min)', pass: a05.mean > 1 && a05.max > a05.min, value: `mean=${a05.mean} (min ${a05.min}, max ${a05.max}, N=${a05.n})` },
          { name: 'θ 사태 국소화(평균 크기 θ↑ 단조↓)', pass: monoDown, value: `θ[0.5,1,2,4] → mean${JSON.stringify(means)}` },
          { name: 'θ=0 소산(사태 아닌 확산: 평균≈1 ≪ θ=0.5)', pass: a0.mean < 1.5 && a0.mean < a05.mean, value: `mean(θ=0)=${a0.mean} ≪ mean(θ=0.5)=${a05.mean}` },
        ];
      },
    },

    // ── step-0010: arc E 부트스트랩 — 둘째 보존 채널 p + 진짜 촉매(κ 변조) ── 규칙 정련(opt-in·회귀 0, SKILL §3).
    //   단일 q 의 천장(A~D 다 측정, 무에서 패턴 없음)을 넘는 첫 발. p 가 q 의 교환률 κ 를 국소 변조 = 촉매:
    //   고p 영역 범프가 저p 영역보다 빠르게 평형. 같은 규칙(rule())을 q·p 두 채널에 — 새 법칙 0. ΣQ·ΣP 독립 보존.
    'step-0010': {
      id: 'step-0010',
      title: 'step-0010 — arc E: 둘째 보존량 p 가 q 를 촉매(κ 변조)',
      did: '단일 q 의 한계를 넘는 첫 발 — 둘째 보존량 p 를 도입해 p 가 q 의 교환 속도를 국소적으로 바꾸는 촉매를 켠다.',
      observe: '똑같은 두 범프 중 p 가 높은 영역의 범프가 더 빨리 평형에 든다(τ_A<τ_B). 두 양 ΣQ·ΣP 가 각각 보존된다. 단, q 균일화 자체는 안 깨져 패턴 형성엔 아직 부족(후속 과제).',
      desc: '단일 보존 q 의 천장(A~D·SOC 다 측정·무에서 패턴 없음)을 넘는 첫 발 — 둘째 보존량 p 를 opt-in 으로 도입(knobs.gamma·규칙 정련, gamma 없으면 과거 9 장면 비트 불변=회귀 0). p 가 q 의 교환률을 국소 변조(κ_eff=κ(1+γ·p̄)) = 진짜 촉매: q 의 동일 두 범프 중 고p 영역 범프가 저p 영역보다 빠르게 평형(τ_A<τ_B). 같은 규칙 rule() 을 q·p 두 채널에 각각(새 법칙 0), ΣQ·ΣP 독립 보존(비트). 한계: κ 변조는 q 평형(균일)을 안 깸 → 패턴 형성(상향 플럭스)은 cross-gradient 항이 필요(arc E 후속).',
      ticks: 60,
      init(rng, K, opts) { return catalystSpec(1.0, (opts && opts.scale) || 12); },   // 메인: γ=1 결합(안정역)
      watch(sim) { return measure(sim); },
      assert(w0, w1) {
        const c0 = catalysis(0.0, 60), c1 = catalysis(1.0, 60);   // γ=0(대조)·γ=1(촉매) 보조 재실행(결정론)
        return [
          { name: 'Σq 보존(닫힌 장부·결합 경로)', pass: Math.abs(w1.sumQ - w0.sumQ) < 1e-6 && c1.finite, value: `Δ=${(w1.sumQ - w0.sumQ).toExponential(2)}, γ1 |ΔΣq|=${c1.dQ.toExponential(2)}` },
          { name: 'ΣP 독립 보존(둘째 채널 닫힌 장부)', pass: c1.finite && c1.dP < 1e-6, value: `|ΔΣp|=${c1.dP.toExponential(2)}` },
          { name: '대조(γ=0: 고p·저p 범프 평형 동일)', pass: Math.abs(c0.tauA - c0.tauB) < 0.5, value: `τ_A=${c0.tauA} ≈ τ_B=${c0.tauB}` },
          { name: '촉매(γ=1: 고p 범프 τ_A < 저p τ_B)', pass: c1.tauA < c1.tauB - 0.5, value: `τ_A(고p)=${c1.tauA} < τ_B(저p)=${c1.tauB}` },
        ];
      },
    },
    // ── step-0011: arc F 부트스트랩 — 관성 도입 = 파동 ── 규칙 정련(opt-in·회귀 0, SPINE §4·§6·SKILL §3).
    //   Part I(과감쇠 확산 A~E)은 단일 q 의 천장을 확정했다 — 소산 동역학은 평형으로 *죽는다*. 같은 힘 Gᵢ=−Σⱼ F(i→j) 를
    //   과감쇠(q←q+G) 대신 **관성**(v←v+G; q←q+v)으로 적분하면 세계가 *가역*이 되어 들뜸이 전파·진동하고 안 죽는다.
    //   바뀐 건 역학뿐(힘의 법칙 rule() 고정). inertial 미설정 = 과거 10 장면 비트 불변(회귀 0). 측정: ΣQ·ΣP 비트 보존 +
    //   E 유계(발산 0) + spread 비단조(파동·확산처럼 0 으로 안 죽음) + 분산관계 ω(k)=2√κ·|sin(k/2)| 일치.
    'step-0011': {
      id: 'step-0011',
      title: 'step-0011 — arc F: 관성 도입 = 파동(가역·자기 구동)',
      did: '같은 힘 법칙을 과감쇠(q←q+G) 대신 관성(v←v+G; q←q+v)으로 적분한다 — 바뀐 건 역학뿐.',
      observe: '중앙 펄스가 죽지 않고 전파·반사·간섭하며 진동한다(파동). 퍼짐(spread)이 단조로 줄지 않고 오르내리며, 측정 진동수가 파동방정식 분산관계와 일치 — 들뜸이 진짜 파동이라는 증거.',
      desc: '단일 q 의 천장(Part I A~E·소산은 평형으로 죽음)을 넘는 첫 발 — 같은 힘의 법칙 rule() 을 과감쇠(q←q+G) 대신 관성(v←v+G; q←q+v)으로 적분한다(opt-in knobs.inertial·규칙 정련, inertial 없으면 과거 10 장면 비트 불변=회귀 0). 중앙 펄스가 전파·반사·간섭하며 진동한다 — spread 가 단조 감소(확산처럼 죽음)하지 않고 오르내림(파동). 보존: ΣQ·ΣP 비트 불변(관성도 반대칭 −F/+F), E=K+U 발산 없이 유계(심플렉틱). 평면파 모드의 측정 진동수가 이산 파동방정식 분산관계 ω(k)=2√κ·|sin(kₓ/2)| 와 일치(ratio≈1) — 들뜸이 진짜 파동임의 측정 증거. κ=0.1 안정역(CFL: κ·Z<4). 같은 규칙·새 법칙 0, 바뀐 건 역학(SPINE §3·§4).',
      ticks: 200,
      init(rng, K, opts) { return pulseSpec(0.1, (opts && opts.scale) || 12); },   // 메인: 중앙 펄스·관성·κ=0.1(안정역)
      watch(sim) { return measure(sim); },
      assert(w0, w1) {
        const wv = waveMeasure(0.1, 200);   // 보조 재실행(결정론): 보존·E 유계·비단조·분산관계
        return [
          { name: 'ΣQ 보존(닫힌 장부·관성 경로 비트)', pass: wv.finite && wv.dQ < 1e-6, value: `|ΔΣq|=${wv.dQ.toExponential(2)}` },
          { name: 'ΣP 보존(운동량 닫힌 장부·반대칭 강제)', pass: wv.finite && wv.dP < 1e-6, value: `|ΔΣp|=${wv.dP.toExponential(2)}` },
          { name: '가역·유계(E=K+U 발산 없이 유계·확산처럼 0 으로 안 죽음)', pass: wv.finite && wv.eMax < 4 * wv.E0 && wv.eMin > 0, value: `E0=${wv.E0}, E∈[${wv.eMin},${wv.eMax}]` },
          { name: '파동(spread 비단조: 되돌아옴 — 확산은 단조↓)', pass: wv.rebounds > 5, value: `rebounds=${wv.rebounds}` },
          { name: '분산관계 일치(ω_meas ≈ 2√κ·|sin(kₓ/2)|)', pass: Math.abs(wv.dispRatio - 1) < 0.05, value: `ω_meas=${wv.omegaMeas} vs ω_thy=${wv.omegaThy} (ratio=${wv.dispRatio})` },
        ];
      },
    },

    // ── step-0012: arc G — 비선형 자기 가둠 = 원자(이산 브리더 씨앗) ── 장면+측정만(법칙·노브 0, 기존 inertial·α 조합).
    //   arc F(step-0011)는 *선형* 파동(α=1)을 세웠다 — 보존·E 유계·분산관계 측정 완료. 하지만 선형 파동은 분산해
    //   흩어진다(질량 0, 골드스톤). 같은 관성 적분에 *비선형 α>1*(이미 있는 노브)을 켜면 분산을 *되감아* 자기집속 →
    //   들뜸이 흩어지지 않고 한 자리에 갇힌다(이산 브리더 = 원자). 질량은 박지 않고 *측정*(SPINE §5·§9 arc G).
    'step-0012': {
      id: 'step-0012',
      title: 'step-0012 — arc G: 비선형 자기 가둠 = 원자(이산 브리더 씨앗)',
      did: '관성 적분에 비선형 α>1 을 함께 켠다(같은 IC 의 중앙 펄스).',
      observe: '선형(α=1)에선 펄스가 배경으로 가라앉지만, 비선형(α=2)에선 분산을 되감아 한 자리에 갇힌다(자기집속). 갇힌 들뜸 peak 가 선형의 ~2배로 지속 — 흩어지지 않는 국소 들뜸 = 원자(이산 브리더)의 씨앗.',
      desc: '선형 파동(arc F)은 분산해 흩어진다(질량 0). 같은 관성 적분(v←v+G; q←q+v)에 비선형 α>1(이미 있는 노브)을 켜면 — 같은 IC 의 중앙 펄스가 선형(α=1)에선 배경으로 가라앉지만 비선형(α=2)에선 분산을 되감아 한 자리에 갇힌다(자기집속·FPUT형 비조화). 측정: 시작 과도 후 시간평균 최대진폭(peak) 을 선형 vs 비선형으로 비교 — 비선형 peak 가 선형의 ~2배로 지속(=비분산 국소 들뜸 = 이산 브리더 씨앗). 질량은 author 하지 않고 갇힌 들뜸으로 *측정*(arc H 효과질량의 전제). κ=0.05 는 α>1 안정역(step-0008 α=3 발산 경계 회피)·amp=3·θ=0. 보존: ΣQ·ΣP 비트 불변(관성 비선형도 반대칭 −F/+F)·발산 없음(유한). 같은 규칙·새 법칙 0, 바뀐 건 노브 α 뿐(SPINE §3·§5).',
      ticks: 400,
      init(rng, K, opts) { return breatherSpec(0.05, 3, 2, (opts && opts.scale) || 12); },   // 메인: 중앙 펄스·관성·α=2·κ=0.05
      watch(sim) { return measure(sim); },
      assert(w0, w1) {
        const b = breatherMeasure(0.05, 3, 400);   // 보조 재실행(결정론): 선형 vs 비선형 지속 peak·보존
        return [
          { name: 'ΣQ 보존(닫힌 장부·관성 비선형 경로 비트)', pass: b.non.fin && b.non.dQ < 1e-6, value: `|ΔΣq|=${b.non.dQ.toExponential(2)}` },
          { name: 'ΣP 보존(운동량 닫힌 장부·반대칭 강제)', pass: b.non.fin && b.non.dP < 1e-6, value: `|ΔΣp|=${b.non.dP.toExponential(2)}` },
          { name: '안정(α>1 발산 없이 유한)', pass: b.non.fin, value: `finite=${b.non.fin}` },
          { name: '자기 가둠(비선형 지속 peak ≫ 선형 분산 peak)', pass: b.ratio > 1.5, value: `peak_non=${b.non.mean} vs peak_lin=${b.lin.mean} (ratio=${b.ratio})` },
          { name: '비분산 국소화(비선형 들뜸이 배경으로 안 가라앉음)', pass: b.non.mean > 1.0, value: `peak_non(평균)=${b.non.mean} > 1.0` },
        ];
      },
    },

    // ── step-0013: arc G — 브리더 내부 진동수가 전파대역 밖(방사 불가 = 진짜 이산 브리더) ── 장면+측정만(법칙·노브 0).
    //   step-0012 는 비선형이 들뜸을 *가둔다*를 측정했다(peak 비). 왜 안 흩어지나? — 갇힌 핵의 *내부 진동수 ω_b* 가
    //   선형 포논 전파대역 상한 ω_max=2√(3κ) *밖*이라, 공명해 에너지를 실어 갈 포논 모드가 없어 *방사 불가*다.
    //   경화(hardening) 비선형이라 ω_b 가 진폭 따라 상승 → 대역 밖으로 더 밀린다. 이게 이산 브리더의 결정적 서명.
    'step-0013': {
      id: 'step-0013',
      title: 'step-0013 — arc G: 브리더 내부 진동수 전파대역 밖(방사 불가)',
      did: '왜 안 흩어지는지 측정 — 갇힌 핵의 내부 진동수 ω_b 를 뽑아 파동 전파대역 상한과 비교한다.',
      observe: 'ω_b 가 대역 밖이라 에너지를 실어 갈 파동 모드가 없어 방사 불가 = 영속 국소화. 진폭이 클수록 ω_b 가 더 올라가(경화) 대역 밖으로 더 밀린다 — 이산 브리더의 결정적 서명.',
      desc: 'step-0012 는 비선형이 들뜸을 가둔다(peak 비 2.1배)를 쟀다. 이번엔 *왜* 안 흩어지는지를 측정한다 — 갇힌 핵(부호 있는 최대 들뜸)의 시간열에서 내부 진동수 ω_b 를 뽑아, 선형 파동(arc F)의 전파대역 상한 ω_max=2√(3κ)(3D 6-이웃·step-0011 분산관계의 3축 합 최대) 과 비교. 결과: ω_b 가 대역 *밖*(공명할 포논 모드 없음→에너지 실어 갈 곳 없음→방사 불가→영속 국소화)이고, 경화(hardening) 비선형이라 진폭 따라 ω_b 가 *상승*(amp2→3→4: 0.825→0.860→1.366) — 대역 밖으로 더 밀린다. 이것이 이산 브리더(=원자)의 결정적 서명. 같은 세계(breatherSpec) 새 렌즈·κ=0.05·θ=0. ΣP 비트 보존·발산 0. 새 법칙·새 노브 0(SPINE §5·§9 arc G).',
      ticks: 400,
      init(rng, K, opts) { return breatherSpec(0.05, 3, 2, (opts && opts.scale) || 12); },   // step-0012 와 같은 브리더 세계·새 측정 렌즈
      watch(sim) { return measure(sim); },
      assert(w0, w1) {
        const f = breathingMeasure(0.05, 400);   // 보조 재실행(결정론): amp 2·3·4 의 ω_b·대역 상한
        return [
          { name: 'ΣP 보존(운동량 닫힌 장부·반대칭 강제)', pass: f.a3.fin && f.a3.dP < 1e-6, value: `|ΔΣp|=${f.a3.dP.toExponential(2)}` },
          { name: '안정(α>1 발산 없이 유한)', pass: f.a4.fin, value: `finite=${f.a4.fin}` },
          { name: '진동수 전파대역 밖(브리더 ω_b ≫ 포논 대역 상한 → 방사 불가)', pass: f.a4.omega > f.bandMax, value: `ω_b(amp4)=${f.a4.omega} vs ω_max=${f.bandMax} (ratio=${(f.a4.omega / f.bandMax).toFixed(2)})` },
          { name: '경화 비선형(ω_b 가 진폭 따라 상승 → 대역 밖으로 밀림)', pass: f.a4.omega > f.a2.omega, value: `ω_b(amp2→4)=${f.a2.omega}→${f.a3.omega}→${f.a4.omega}` },
          { name: 'step-0012 브리더(amp3)도 대역 위(가까스로 gap 안)', pass: f.a3.omega > f.bandMax, value: `ω_b(amp3)=${f.a3.omega} > ω_max=${f.bandMax}` },
        ];
      },
    },

    // ── step-0014: arc H — 두 브리더 공존(다체 국소화 = 분자/사슬의 기하 씨앗) ── 장면+측정만(법칙·노브 0).
    //   arc G(0012·0013)는 *한* 브리더가 갇히고 대역 밖 진동수로 영속함을 측정했다. 분자·고분자로 가려면 먼저
    //   *여럿*이 서로 다른 자리에 동시에 갇힐 수 있어야 한다(필요 조건). x 축 두 곳에 펄스를 놓고 각 반쪽이 코어를
    //   유지하는지(비선형) vs 흩어지는지(선형) 측정. 핀닝(이산 격자가 브리더를 자리에 고정)이 공존을 가능케 한다.
    'step-0014': {
      id: 'step-0014',
      title: 'step-0014 — arc H: 두 브리더 공존(다체 국소화 = 분자 기하 씨앗)',
      did: 'x 축 두 곳에 같은 펄스를 동시에 놓는다.',
      observe: '비선형(α=2)은 두 코어를 각자 자리에 고정(핀닝)해 따로 공존시키지만, 선형은 흩어져 하나로 합쳐진다. 여럿이 서로 다른 자리에 동시에 갇히는 것 = 분자 기하의 씨앗. (진짜 결합에너지는 아직 없음.)',
      desc: 'arc G 는 한 브리더의 가둠(0012)·대역 밖 진동수(0013)를 쟀다. 분자·고분자의 *필요 조건*은 여럿이 서로 다른 자리에 동시에 갇혀 공존하는 것. x 축 두 곳(중심 [2,8]·토러스 대칭)에 같은 펄스를 놓고 각 반쪽([0–5],[6–11])의 시작 과도 후 시간평균 peak 를 본다 — 비선형(α=2)은 두 코어를 각 자리에 유지(핀닝)하지만 선형(α=1)은 흩어져 합쳐진다. 측정: 두 반쪽 모두 비선형 peak≫선형(이산 격자가 브리더를 자리에 고정해 공존). 결합에너지/포화(진짜 화학결합)는 측정 아닌 미해결(author 0). κ=0.05·θ=0·amp=3. ΣP 비트 보존·발산 0. 새 법칙·새 노브 0(SPINE §5·§9 arc H).',
      ticks: 400,
      init(rng, K, opts) { return lumpChainSpec(0.05, 3, 2, [2, 8], (opts && opts.scale) || 12); },   // 두 브리더(분자 씨앗)
      watch(sim) { return measure(sim); },
      assert(w0, w1) {
        const m = multiBreatherMeasure(0.05, 3, [2, 8], [[0, 5], [6, 11]], 400);
        return [
          { name: 'ΣP 보존(운동량 닫힌 장부·반대칭 강제)', pass: m.non.fin && m.non.dP < 1e-6, value: `|ΔΣp|=${m.non.dP.toExponential(2)}` },
          { name: '안정(α>1 발산 없이 유한)', pass: m.non.fin, value: `finite=${m.non.fin}` },
          { name: '두 코어 공존(각 반쪽 비선형 peak ≫ 선형 분산 — 모든 구획)', pass: m.minRatio > 1.4, value: `peak_non=[${m.non.means}] vs peak_lin=[${m.lin.means}] (minRatio=${m.minRatio})` },
          { name: '각 코어 국소화 유지(가장 약한 구획도 peak>1.0)', pass: m.minMeanNon > 1.0, value: `min(peak_non)=${m.minMeanNon} > 1.0` },
        ];
      },
    },

    // ── step-0015: arc I — 세 브리더 일렬 = 사슬(고분자 1차 목표 방향) ── 장면+측정만(법칙·노브 0).
    //   분자(둘, 0014)에서 사슬(셋 이상)로. x 축에 세 펄스를 *일렬*(collinear)로 놓고 세 구획이 모두 코어를
    //   유지하면 = 길이>2 의 선형 사슬(고분자의 *기하* 씨앗, SPINE §5·§9 arc I, 1차 목표). 단일 스칼라 q + 격자
    //   핀닝이 *덩어리(blob)*가 아니라 *선형 배열*을 유지하는지 측정. 진짜 원자가·포화 결합은 미해결(author 0).
    'step-0015': {
      id: 'step-0015',
      title: 'step-0015 — arc I: 세 브리더 일렬 = 사슬(고분자 기하 씨앗·1차 목표)',
      did: 'x 축에 세 펄스를 일렬로 놓는다(고분자가 flux 의 1차 목표).',
      observe: '비선형은 세 코어가 다 살아 일렬로 고정되고(사슬), 선형은 흩어진다. 길이 3 의 선형 배열 = 고분자 기하의 씨앗 — 덩어리가 아니라 줄로 버틴다. (방향성 원자가·포화 결합은 아직 없음.)',
      desc: '분자(둘, step-0014)에서 사슬(셋 이상)로 — 고분자는 flux 트랙의 1차 목표(SPINE §5·§9 arc I). x 축에 세 펄스를 일렬(중심 [0,4,8]·토러스 period-4 대칭)로 놓고 세 구획([0–3],[4–7],[8–11]) 모두 시작 과도 후 시간평균 peak 코어를 유지하는지(비선형) vs 흩어지는지(선형) 측정. 세 코어가 다 살아 *일렬로 고정*되면 = 길이>2 의 선형 사슬 = 고분자의 기하 씨앗. 단일 스칼라 q + 관성 + 비선형 + 격자 핀닝만으로 덩어리가 아닌 *선형 배열*을 유지함을 본다(SPINE §5 최소부터). 단, 방향성 원자가·결합 포화(진짜 고분자 화학)는 측정 아닌 미해결(author 0) — 코어가 *공존·고정*하는 기하만 측정. κ=0.05·θ=0·amp=3. ΣP 비트 보존·발산 0. 새 법칙·새 노브 0.',
      ticks: 400,
      init(rng, K, opts) { return lumpChainSpec(0.05, 3, 2, [0, 4, 8], (opts && opts.scale) || 12); },   // 세 브리더 일렬(사슬 씨앗)
      watch(sim) { return measure(sim); },
      assert(w0, w1) {
        const m = multiBreatherMeasure(0.05, 3, [0, 4, 8], [[0, 3], [4, 7], [8, 11]], 400);
        const allCores = m.non.means.every(x => x > 1.0);   // 세 구획 모두 코어 생존 = 사슬 길이 3
        return [
          { name: 'ΣP 보존(운동량 닫힌 장부·반대칭 강제)', pass: m.non.fin && m.non.dP < 1e-6, value: `|ΔΣp|=${m.non.dP.toExponential(2)}` },
          { name: '안정(α>1 발산 없이 유한)', pass: m.non.fin, value: `finite=${m.non.fin}` },
          { name: '세 코어 일렬 공존(사슬 길이 3 — 모든 구획 비선형 peak ≫ 선형)', pass: m.minRatio > 1.4, value: `peak_non=[${m.non.means}] vs peak_lin=[${m.lin.means}] (minRatio=${m.minRatio})` },
          { name: '선형 사슬(덩어리 아님 — 세 구획 모두 코어 생존)', pass: allCores && m.nSeg === 3, value: `cores=${m.non.means.map(x => x > 1.0 ? 1 : 0).reduce((a, b) => a + b, 0)}/3 (peaks=[${m.non.means}])` },
        ];
      },
    },

    // ── step-0016: arc G — 브리더 장수명(원자는 영속하는 물질) ── 장면+측정만(법칙·노브 0).
    //   arc G(0012·0013)는 브리더의 가둠·대역 밖 진동수를 *400틱* 동안 봤다. "물질"이라면 더 오래 살아야 한다.
    //   같은 브리더를 1500틱 돌려, 후기 창(t≥900)의 평균 peak 가 선형 대비 높게 유지되는지(전이 아닌 안정 구조).
    'step-0016': {
      id: 'step-0016',
      title: 'step-0016 — arc G: 브리더 장수명(원자는 영속하는 물질)',
      did: 'step-0012 의 브리더를 1500틱으로 길게 돌려 오래 사는지 본다.',
      observe: '후기(t≥900)에도 비선형 peak 가 높게 유지되지만(소폭 감쇠하나 안정), 선형은 일찍 가라앉는다. 원자가 잠깐의 전이가 아니라 지속하는 안정 구조임을 본다.',
      desc: '브리더가 *물질*이라면 잠깐이 아니라 오래 살아야 한다. step-0012 의 브리더(breatherSpec·α=2·amp3·κ0.05)를 1500틱 돌려, 후기 창(t≥900·전체의 60% 이후)의 시간평균 peak 를 선형(α=1)과 비교 — 비선형은 후기에도 peak 를 높게 유지(소폭 감쇠하나 안정)하지만 선형은 일찍 가라앉는다. 원자가 전이(transient)가 아니라 *지속하는 안정 구조*임의 측정. ΣP 비트 보존. 새 법칙·새 노브 0(SPINE §5·§9 arc G).',
      ticks: 1500,
      init(rng, K, opts) { return breatherSpec(0.05, 3, 2, (opts && opts.scale) || 12); },
      watch(sim) { return measure(sim); },
      assert(w0, w1) {
        const L = lifeMeasure(0.05, 3, 1500);
        return [
          { name: 'ΣP 보존(운동량 닫힌 장부·반대칭 강제)', pass: L.non.fin && L.non.dP < 1e-6, value: `|ΔΣp|=${L.non.dP.toExponential(2)}` },
          { name: '안정(α>1 발산 없이 유한)', pass: L.non.fin, value: `finite=${L.non.fin}` },
          { name: '장수명(후기 t≥900 비선형 peak ≫ 선형)', pass: L.ratio > 1.5, value: `late_non=${L.non.late} vs late_lin=${L.lin.late} (ratio=${L.ratio})` },
          { name: '안정 구조(후기에도 코어 유지·전이 아님)', pass: L.non.late > 1.0, value: `late_non=${L.non.late} > 1.0` },
        ];
      },
    },

    // ── step-0017: arc G — 자기집속 세기 ∝ 진폭(경화·"원자 크기"의 연속 스펙트럼) ── 장면+측정만(법칙·노브 0).
    //   브리더가 하나가 아니다 — 진폭이 클수록 더 단단히 갇힌다(경화 비선형). 진폭 0.5~5 스윕에서 (비선형/선형)
    //   지속 peak 비가 진폭 따라 *증가* → 강한 들뜸일수록 자기집속이 세짐 = 갇힌 에너지(질량)의 연속 스펙트럼.
    'step-0017': {
      id: 'step-0017',
      title: 'step-0017 — arc G: 자기집속 ∝ 진폭(경화·원자 크기 스펙트럼)',
      did: '진폭을 0.5→5 로 스윕하며 (비선형/선형) 지속 peak 비를 잰다.',
      observe: '진폭이 클수록 더 단단히 갇힌다(비/선형 peak 비 2.06→2.50, 경화). 같은 규칙이 진폭만으로 다양한 "원자 크기"를 연속적으로 만든다.',
      desc: '원자(브리더)는 한 종류가 아니다 — 진폭이 클수록 자기집속이 세져 더 단단히 갇힌다(경화 비선형, step-0013 의 진동수-진폭 상승과 한 현상). 진폭 0.5→5 스윕에서 (비선형/선형) 지속 peak 비를 재면 진폭 따라 *증가*(2.06→2.50) — 갇힌 에너지(질량)의 연속 스펙트럼. 같은 규칙이 진폭만으로 다양한 "원자 크기"를 낸다(author 0 — 측정값). 메인 장면은 amp=3 브리더(breatherSpec). ΣP 비트 보존. 새 법칙·새 노브 0.',
      ticks: 250,
      init(rng, K, opts) { return breatherSpec(0.05, 3, 2, (opts && opts.scale) || 12); },
      watch(sim) { return measure(sim); },
      assert(w0, w1) {
        const F = focusScaleMeasure(0.05, 250);
        const mono = F.hi > F.lo;
        return [
          { name: '모든 진폭에서 자기 가둠(비선형/선형 peak 비 > 1.5)', pass: Math.min.apply(null, F.ratios) > 1.5, value: `ratios=[${F.ratios}] @amp=[${F.amps}]` },
          { name: '경화(자기집속 ∝ 진폭 — 큰 진폭일수록 비 상승)', pass: mono, value: `ratio(amp0.5)=${F.lo} → ratio(amp5)=${F.hi}` },
          { name: '연속 스펙트럼(진폭이 원자 크기를 매끄럽게 정함)', pass: F.hi - F.lo > 0.2, value: `Δratio=${(F.hi - F.lo).toFixed(3)} (${F.lo}→${F.hi})` },
        ];
      },
    },

    // ── step-0018: arc G — 무에서 물질: 뜨거운 잡음에서 브리더 자발 형성(모듈레이션 불안정) ── 장면+측정만(법칙·노브 0).
    //   지금까지 브리더는 *손으로 펄스를 놓아* 만들었다. 진짜 "스스로 굴러가는 세계"라면 *featureless 한 잡음*에서
    //   물질이 스스로 응결해야 한다. 균일 q + 결정론 노이즈를 비선형 관성으로 굴리면, 모듈레이션 불안정이 에너지를
    //   봉우리로 모은다(브리더 씨앗) — 선형은 퍼진 채 남는다. 무에서 패턴(SPINE 큰 목표).
    'step-0018': {
      id: 'step-0018',
      title: 'step-0018 — arc G: 무에서 물질(뜨거운 잡음→브리더 자발 형성)',
      did: '균일 q + 결정론 잡음(featureless)을 비선형 관성으로 굴린다 — 손으로 펄스를 놓지 않는다.',
      observe: '모듈레이션 불안정이 에너지를 봉우리로 모아 브리더가 저절로 생긴다. 비선형은 국소화↑·peak↑, 선형은 퍼진 채 남는다 — 잡음에서 물질이 스스로 응결.',
      desc: '지금까진 브리더를 손으로 펄스를 놓아 만들었다. 스스로 굴러가는 세계라면 *featureless 잡음*에서 물질이 응결해야 한다 — 균일 q + 결정론 노이즈(hotSpec·rng 미사용·셀 해시)를 비선형 관성(α=2)으로 굴리면 모듈레이션 불안정이 에너지를 봉우리로 모은다(브리더 자발 형성). 측정: 역참여비 P=(Σe²)²/Σe⁴(낮을수록 국소)·지속 peak 를 비선형 vs 선형 비교 — 비선형은 P↓·peak↑(잡음→국소 물질), 선형은 퍼진 채(P 큼). ΣQ 비트 보존. 무에서 패턴(SPINE 큰 목표·author 0 측정). 새 법칙·새 노브 0.',
      ticks: 800,
      init(rng, K, opts) { return hotSpec(2, 0.05, 2, (opts && opts.scale) || 12); },   // 메인: 뜨거운 잡음·비선형 관성
      watch(sim) { return measure(sim); },
      assert(w0, w1) {
        const M = spontaneousMeasure(0.05, 3, 800);
        return [
          { name: 'ΣQ 보존(닫힌 장부·뜨거운 비선형 경로 비트)', pass: M.non.fin && M.non.dQ < 1e-6, value: `|ΔΣq|=${M.non.dQ.toExponential(2)}` },
          { name: '안정(발산 없이 유한)', pass: M.non.fin, value: `finite=${M.non.fin}` },
          { name: '자발 국소화(비선형 지속 peak > 선형 — 잡음이 봉우리로 응결)', pass: M.pkRatio > 1.15, value: `peak_non=${M.non.pkLate} vs peak_lin=${M.lin.pkLate} (ratio=${M.pkRatio})` },
          { name: '국소화(비선형 역참여비 P < 선형 — 더 적은 셀에 집중)', pass: M.pRatio > 1.05, value: `P_lin=${M.lin.Plate} vs P_non=${M.non.Plate} (lin/non=${M.pRatio})` },
        ];
      },
    },

    // ── step-0019: arc H — 단일 q 의 결합 천장(두 브리더 약한 상호작용·고정 결합 없음) ── 장면+측정만(법칙·노브 0).
    //   분자(arc H)의 핵심은 *고정-간격 결합*(인력 우물·결합에너지<0). 두 브리더를 간격을 바꿔 가며 놓고 지속 peak 를
    //   재면, 강한 결합이면 특정 간격에서 크게 솟아야 한다. 측정 결과: 간격 의존이 작고 단일 브리더 값 부근 —
    //   단일 q 는 약한 단거리 협동뿐 *고정 결합 없음* = 비결합/비포화(SPINE §5 blob 예측 확인). 다발 확장 명령.
    'step-0019': {
      id: 'step-0019',
      title: 'step-0019 — arc H: 단일 q 결합 천장(약한 상호작용·고정 결합 없음)',
      did: '두 브리더의 간격을 2~8 로 바꿔 놓고 지속 peak 를 재서 고정 결합이 있는지 본다.',
      observe: 'peak 가 간격에 거의 무관하다 = 끌어당기는 결합 우물이 없다(비결합·비포화). 단일 스칼라 q 로는 덩어리만 되고, 진짜 원자가 결합엔 다성분 보존 다발이 필요함을 측정으로 확인.',
      desc: '분자(arc H)의 핵심 신호는 고정-간격 결합(인력 우물·결합에너지<0). 두 브리더를 간격 2~8 로 바꿔 놓고(n=16 여유 상자) 지속 peak 를 재면 — 강한 결합이면 어떤 간격에서 크게 솟아야 한다. 측정: peak 의 간격 의존이 작고(spread<1.5) 단일 브리더 값 부근(maxOverSingle<1.5) — 단일 q 는 약한 단거리 협동만 있을 뿐 *고정 결합이 없다* = 비결합/비포화. SPINE §5 의 "단일 스칼라→등방·비포화→덩어리(blob)" 예측을 *측정으로* 확인 → 진짜 원자가 결합엔 다성분 보존 다발 확장 필요(measurement commands extension). 메인 장면은 간격 4 두 브리더. ΣP 비트 보존. 새 법칙·새 노브 0(author 0 — null 도 측정).',
      ticks: 400,
      init(rng, K, opts) { const m = 7; return blockLumpsSpec(0.05, 3, 2, [[m - 2, m, m], [m + 2, m, m]], (opts && opts.scale) || 16); },
      watch(sim) { return measure(sim); },
      assert(w0, w1) {
        const B = bindingCeilingMeasure(0.05, 3, 400);
        return [
          { name: '안정(두 브리더 모든 간격 유한)', pass: B.fin, value: `finite=${B.fin}` },
          { name: '두 코어 공존(모든 간격에서 코어 유지)', pass: B.minPk > 1.0, value: `min peak=${B.minPk} > 1.0 (pks=[${B.pks}])` },
          { name: '고정 결합 없음(간격 의존 약함 — 결합 우물 부재)', pass: B.fin && B.spread < 1.5, value: `peak 간격 스프레드 max/min=${B.spread} < 1.5 (seps=[${B.seps}])` },
          { name: '비결합(두 브리더 peak ≈ 단일 — 인력 증폭 없음)', pass: B.fin && B.maxOverSingle < 1.5, value: `max(pair)/single=${B.maxOverSingle} (single=${B.single})` },
        ];
      },
    },

    // ── step-0020: 종합 — 자발 물질은 안정 다체 개체군(원자 기체) → 단일 q 관성 사다리의 천장 ── 장면+측정만(법칙·노브 0).
    //   step-0018 의 자발 형성이 *지속하는 다체 상태*(한 덩어리로 안 붕괴)임을 길게(1200틱) 확인. 종합: 단일 q +
    //   관성은 *원자*(자기 가둠·대역 밖·장수명·자발 형성·공존)는 내지만, *고정 결합/포화*(분자·고분자 화학, 0019)는
    //   못 낸다 = Part II 단일 q 천장. SPINE §5 처방대로 *측정이* 다성분 보존 다발(원자가) 확장을 명령한다.
    'step-0020': {
      id: 'step-0020',
      title: 'step-0020 — 종합: 자발 물질=안정 원자 기체 → 단일 q 관성 천장',
      did: 'step-0018 의 자발 형성이 지속하는 다체 상태인지 1200틱으로 확인하고 단일 q 천장을 종합한다.',
      observe: '역참여비 P 가 안정화(한 덩어리로 안 뭉치고 다시 안 퍼짐)되며 여럿이 공존한다(원자 기체). 단일 q+관성은 원자는 내지만 고정 결합/포화(분자·고분자 화학)는 못 낸다 — 다성분 확장이 필요함이 결론.',
      desc: 'step-0018 의 자발 형성이 *지속하는 다체 상태*(원자 기체)인지 길게(1200틱) 확인 — 역참여비 P 가 안정화(한 덩어리로 붕괴도, 다시 퍼지지도 않음)·선형보다 국소·P≫1(여럿). 종합 천장: 단일 q + 관성은 원자(자기 가둠 0012·대역 밖 0013·장수명 0016·진폭 스펙트럼 0017·자발 형성 0018·공존 0014/0015)는 내지만 *고정 결합/포화*(분자·고분자 화학, 0019 천장)는 못 낸다 = Part II 단일 q 천장. SPINE §5 처방: *측정이* 다성분 보존 다발(원자가) 확장을 명령(atom 트랙 전하·핵자·전자 다발과 수렴). 메인 장면은 뜨거운 비선형. ΣQ 비트 보존. 새 법칙·새 노브 0.',
      ticks: 1200,
      init(rng, K, opts) { return hotSpec(2, 0.05, 2, (opts && opts.scale) || 12); },
      watch(sim) { return measure(sim); },
      assert(w0, w1) {
        const P = populationMeasure(0.05, 2, 1200, 12);
        return [
          { name: '안정(발산 없이 유한)', pass: P.non.fin, value: `finite=${P.non.fin}` },
          { name: '개체수 안정(P 후기≈중기 — 한 덩어리로 안 붕괴·안 퍼짐)', pass: P.non.fin && P.drift < 0.15, value: `P_mid=${P.non.Pmid} → P_late=${P.non.Plate} (drift=${P.drift})` },
          { name: '국소 다체(비선형 P < 선형 — 잡음보다 응결)', pass: P.non.fin && P.non.Plate < P.lin.Plate, value: `P_non=${P.non.Plate} < P_lin=${P.lin.Plate}` },
          { name: '여럿(원자 기체·한 덩어리 아님 P≫1)', pass: P.non.fin && P.non.Plate > P.N / 100, value: `P_non=${P.non.Plate} ≫ 1 (N/100=${(P.N / 100).toFixed(0)})` },
        ];
      },
    },

    // ── step-0021: arc J 부트스트랩 — 둘째 보존 채널 b=원자가 → 고정 간격 결합(단일 q 천장 돌파) ── 규칙 정련(opt-in).
    //   단일 q 는 두 브리더를 못 묶었다(0019 천장·등방·비포화→덩어리). SPINE §5 처방대로 *측정이 명령한* 다성분
    //   보존 다발을 도입: 둘째 보존량 b 가 교차-인력(q↔b)으로 *고정 간격 결합 우물*을 판다. 같은 IC 를 채널
    //   ON(kc>0)·OFF(kc=0)로 돌리면 — ON 은 두 브리더를 결합 거리 d* 로 끌어 안정 고정(peak 유지)·OFF 는 0019 분산.
    //   새 *법칙* 0(같은 rule() 을 q·b 에 + 교차항·SPINE §1·§3). 회귀 0: valence 미설정 과거 20 장면 비트 불변.
    'step-0021': {
      id: 'step-0021',
      title: 'step-0021 — arc J: 둘째 보존 채널 b=원자가로 고정 간격 결합',
      did: '단일 q 가 못 한 결합을 위해, 측정이 명령한 둘째 보존량 b(결합 전하)를 켠다. 두 브리더 + 각자의 b 전하를 가까이 놓고 채널 ON/OFF 로 비교한다.',
      observe: '채널 ON 이면 두 브리더가 b-접착제로 서로 끌려 고정 거리 d*≈2 로 묶이고 봉우리를 유지한다(결합). OFF(kc=0)면 0019 처럼 흩어진다. 둘째 양 b 도 q 처럼 비트 보존된다.',
      desc: '단일 q 의 결합 천장(0019: 두 브리더 간격 의존 약함·고정 결합 없음·SPINE §5 blob)을 *측정이 명령한* 다성분 보존 다발로 돌파한다. 셀에 둘째 보존량 b(결합 전하=원자가)를 더하고(opt-in knobs.valence), 같은 rule() 을 q·b 에 각각 적용 + 둘 사이 교차-인력(q 는 높은 b 로·b 는 높은 q 로 — flux-laws.applyValence). 두 q-브리더가 각자 b-우물을 파고 그 우물이 서로 끌려 둘을 *고정 간격 d\**로 묶는다(인력 우물=결합). 측정: 같은 IC(간격 3)를 채널 ON(kc=0.04)·OFF(kc=0)로 600틱 — ON 은 후기 두-봉우리 거리 d* 로 수렴·지속 peak ON≫OFF, OFF 는 0019 천장(분산·peak 낮음). ΣQ·ΣB 둘 다 비트 보존(반대칭). 새 *법칙* 0(SPINE §1·§3)·정수 결정론·회귀 0(opt-in 게이트). arc J(다발) 첫 step — atom 트랙 전하/핵자/전자 다발과 수렴.',
      ticks: 600,
      init(rng, K, opts) { const n = (opts && opts.scale) || 16, m = 7; return valenceLumpsSpec(0.04, 0.05, 3, 3, 2, [[m - 2, m, m], [m + 2, m, m]], n); },
      watch(sim) { return Object.assign(measure(sim), { sumB: +(sumB(sim) / K.SCALE).toFixed(6) }); },
      assert(w0, w1) {
        const M = valenceBindMeasure(0.04, 0.05, 3, 3, 3, 600, 16);
        return [
          { name: 'ΣQ 보존(닫힌 장부·valence 경로 비트)', pass: M.on.fin && M.on.dQ < 1e-6, value: `|ΔΣq|=${M.on.dQ.toExponential(2)}` },
          { name: 'ΣB 보존(둘째 보존 채널 비트)', pass: M.on.fin && M.on.dB < 1e-6, value: `|ΔΣb|=${M.on.dB.toExponential(2)}` },
          { name: '안정(발산 없이 유한)', pass: M.on.fin && M.off.fin, value: `finite on=${M.on.fin} off=${M.off.fin}` },
          { name: '결합 포획(채널 ON 두 브리더 거리 d* 로 수렴·고정 ≪ 초기)', pass: M.on.fin && M.on.dLate <= 2.5, value: `init sep=3 → d_late=${M.on.dLate} (d*≈2)` },
          { name: '결합 = peak 유지(ON ≫ OFF — OFF 는 0019 천장 분산)', pass: M.on.fin && M.pkRatio > 1.3, value: `peak_on=${M.on.pkLate} vs peak_off=${M.off.pkLate} (ratio=${M.pkRatio})` },
        ];
      },
    },

    // ── step-0022: arc J — 사슬(고분자 씨앗): valence 가 N 브리더 일렬을 선형 사슬로 묶어 모든 마디 유지 ── 장면+측정만.
    //   0021 은 *둘*의 결합. 1차 목표는 *사슬*(고분자). 세 브리더를 일렬로 놓고 valence 전하 ON(bamp>0)/OFF(bamp=0=
    //   단일 q)로 돌리면 — ON 은 b-접착제가 셋을 결속해 *모든 마디*가 코어를 유지(선형 사슬), OFF 는 0015 처럼 분산.
    //   최소 마디 peak ON ≫ OFF = 사슬이 결합으로 유지됨. 새 법칙·새 노브 0(0021 의 valence 재사용).
    'step-0022': {
      id: 'step-0022',
      title: 'step-0022 — arc J: 사슬(고분자 씨앗) — valence 가 세 브리더를 선형 사슬로 묶음',
      did: '세 브리더를 일렬로 놓고 valence 결합 전하를 켜고(bamp=3)/끈(bamp=0) 채로 돌려, 사슬의 세 마디가 다 유지되는지 본다.',
      observe: '전하 ON 이면 b-접착제가 셋을 결속해 세 마디 봉우리가 다 살아 선형 사슬을 이룬다. OFF(단일 q)면 0015 처럼 흩어져 약해진다. 가장 약한 마디조차 ON 이 OFF 보다 훨씬 높다 = 사슬이 결합으로 버틴다.',
      desc: '0021 은 *둘*의 결합을 봤다. 1차 목표는 *사슬*(고분자). 세 브리더를 x-축 일렬(간격 4)로 놓고 valence 전하 ON(bamp=3)·OFF(bamp=0=단일 q)로 800틱. 측정(valenceChainMeasure): x 를 3 구획으로 갈라 마디별 후기 peak — ON 은 b-접착제가 셋을 결속해 *모든 마디*가 코어 유지(선형 사슬), OFF 는 0015 처럼 분산(약함). 최소 마디 peak ON ≫ OFF 면 사슬이 *결합으로* 버티는 것(독립 핀닝 아님). ΣQ·ΣB 비트 보존. 새 법칙·새 노브 0(0021 valence 재사용·author 0). 고분자(SPINE §5·arc I/J)의 *결합된* 씨앗 — 0015 의 핀닝 일렬을 결합으로 격상.',
      ticks: 800,
      init(rng, K, opts) { const n = (opts && opts.scale) || 16; return valenceLumpsSpec(0.04, 0.05, 3, 3, 2, lineCorners(3, 4, n), n); },
      watch(sim) { return Object.assign(measure(sim), { sumB: +(sumB(sim) / K.SCALE).toFixed(6) }); },
      assert(w0, w1) {
        const M = valenceChainMeasure(0.04, 0.05, 3, 3, 3, 4, 800, 16);
        return [
          { name: 'ΣQ·ΣB 보존(닫힌 장부·사슬 경로 비트)', pass: M.fin && M.dQ < 1e-6 && M.dB < 1e-6, value: `|ΔΣq|=${M.dQ.toExponential(2)} |ΔΣb|=${M.dB.toExponential(2)}` },
          { name: '안정(발산 없이 유한)', pass: M.fin, value: `finite=${M.fin}` },
          { name: '세 마디 다 생존(ON 최소 마디 peak 높음 — 선형 사슬)', pass: M.fin && M.minOn > 1.4, value: `seg_on=[${M.on}] min=${M.minOn}` },
          { name: '사슬 = 결합(ON 최소 마디 ≫ OFF 단일 q 분산)', pass: M.fin && M.ratio > 1.3, value: `min_on=${M.minOn} vs min_off=${M.minOff} (ratio=${M.ratio})` },
        ];
      },
    },

    // ── step-0023: arc J — 사슬은 선형이다(덩어리 아님): 결합 사슬의 세장비 ≫ 1 ── 장면+측정만(법칙·노브 0).
    //   0022 는 세 마디가 *산다*만 봤다. 고분자(1차 목표)의 정의는 결합이 *선형*(방향성)이라는 것 — 단일 q 천장의
    //   "등방 덩어리(blob)"와 갈린다. 네 브리더 일렬의 *코어*(고임계) 2차 모멘트로 세장비(x-신장/가로 신장)를 재면,
    //   valence 결합 사슬은 세장비≫1·가로 폭≈1셀(단일파일 선)이고 OFF(단일 q)보다 더 선형·얇다 = 진짜 1D 고분자.
    'step-0023': {
      id: 'step-0023',
      title: 'step-0023 — arc J: 사슬은 선형이다(덩어리 아님·세장비 ≫ 1)',
      did: '네 브리더를 일렬로 결합시키고, 결합된 코어 덩어리의 모양(세로로 긴가, 사방으로 퍼진 공인가)을 세장비로 잰다.',
      observe: '결합 사슬은 한 줄로 길고(세장비≈6) 가로로 한 셀 두께뿐인 *단일파일 선*이다 — 등방 덩어리(blob)가 아니다. valence 를 끄면 더 두껍고 덜 선형. 단일 q 가 못 한 1D 고분자 모양이 측정으로 확인.',
      desc: '0022 는 세 마디가 *산다*(결합)만 봤다. 고분자(1차 목표)의 정의는 결합이 *선형/방향성*이라는 것 — 0019 단일 q 천장의 "등방 비포화 덩어리(blob)"와 갈린다. 네 브리더 x-축 일렬(간격 4)의 *코어*(임계 1.2 이상) q-가중 2차 모멘트로 세장비(σx / √((σy²+σz²)/2)) + 가로 폭을 800틱 후기 측정. valence 결합 사슬(bamp=3): 세장비≈6·가로 폭≈0.8셀(단일파일 선) — OFF(bamp=0=단일 q)는 세장비≈3·가로 폭≈1.4(더 두껍고 덜 선형). 결합이 *축을 따라 선형*임을 직접 측정 = 진짜 1D 고분자 모양(덩어리 아님). ΣQ·ΣB 비트 보존. 새 법칙·새 노브 0(0021 valence 재사용·author 0).',
      ticks: 800,
      init(rng, K, opts) { const n = (opts && opts.scale) || 16; return valenceLumpsSpec(0.04, 0.05, 3, 3, 2, lineCorners(4, 4, n), n); },
      watch(sim) { return Object.assign(measure(sim), { sumB: +(sumB(sim) / K.SCALE).toFixed(6) }); },
      assert(w0, w1) {
        const M = chainLinearityMeasure(0.04, 0.05, 3, 3, 4, 4, 800, 16, 1.2);
        return [
          { name: 'ΣQ·ΣB 보존(닫힌 장부·사슬 경로 비트)', pass: M.on.fin && M.on.dQ < 1e-6 && M.on.dB < 1e-6, value: `|ΔΣq|=${M.on.dQ.toExponential(2)} |ΔΣb|=${M.on.dB.toExponential(2)}` },
          { name: '안정(발산 없이 유한)', pass: M.on.fin && M.off.fin, value: `finite on=${M.on.fin} off=${M.off.fin}` },
          { name: '사슬은 선형(세장비 ≫ 1 — 덩어리 아님)', pass: M.on.fin && M.on.aspect > 3, value: `aspect_on=${M.on.aspect} (가로폭=${M.on.tw}셀)` },
          { name: '단일파일(가로 폭 ≈ 1셀)', pass: M.on.fin && M.on.tw < 1.2, value: `tw_on=${M.on.tw} 셀` },
          { name: 'valence 가 더 선형·얇음(ON > OFF 단일 q)', pass: M.on.fin && M.on.aspect > M.off.aspect && M.on.tw < M.off.tw, value: `aspect on=${M.on.aspect} > off=${M.off.aspect}·tw on=${M.on.tw} < off=${M.off.tw}` },
        ];
      },
    },

  };

  return { SCENES, measure };
});
