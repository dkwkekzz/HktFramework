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
  function blobSpec(theta, n) {
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
    return { cols, rows, depth, W, H, D, atoms, knobs: { kappa: 0.1, theta, alpha: 1 } };
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

  const SCENES = {
    // ── step-0001: 기질 + 단일 규칙 + 닫힌 장부 ── θ=0(문턱 없음) → 규칙은 순수 선형 확산.
    //   3D 격자: 중앙 블롭(고 q) + 배경(저 q) → 규칙이 기울기를 6-이웃으로 평형화한다. Σq 불변·spread 단조 감소가 가설.
    'step-0001': {
      id: 'step-0001',
      title: 'step-0001 — 기질: 단일 규칙 위의 3D 확산',
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
  };

  return { SCENES, measure };
});
