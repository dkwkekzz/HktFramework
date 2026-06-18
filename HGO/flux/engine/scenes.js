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
  function roughSpec(theta) {
    const cols = 12, rows = 12, depth = 12, W = 100, H = 100, D = 100, S = K.SCALE;
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

  const SCENES = {
    // ── step-0001: 기질 + 단일 규칙 + 닫힌 장부 ── θ=0(문턱 없음) → 규칙은 순수 선형 확산.
    //   3D 격자: 중앙 블롭(고 q) + 배경(저 q) → 규칙이 기울기를 6-이웃으로 평형화한다. Σq 불변·spread 단조 감소가 가설.
    'step-0001': {
      id: 'step-0001',
      title: 'step-0001 — 기질: 단일 규칙 위의 3D 확산',
      desc: 'θ=0 이면 규칙 F=κ·sign(d)·|d|^α 는 순수 확산. 3D 격자 중앙 블롭이 6-이웃으로 퍼져 평형화하되 총량 Σq 는 불변(반대칭 보존). 세계의 유일한 법칙이 이 한 장면에서 처음 돈다.',
      ticks: 200,
      init(rng, K) {
        const cols = 12, rows = 12, depth = 12, W = 100, H = 100, D = 100, S = K.SCALE;
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
      init(rng, K) {
        const cols = 12, rows = 12, depth = 12, W = 100, H = 100, D = 100, S = K.SCALE;
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
      init() { return roughSpec(1.0); },           // 메인 궤적(θ=1.0) — 해시/골든 대상
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
  };

  return { SCENES, measure };
});
