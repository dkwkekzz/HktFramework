// hgo-laws.js — 진화하는 법칙 파이프라인 (append-only)
// 한 step = 힘 법칙 1개 + 노브 + LAW_ORDER 한 자리 (노브=0 → early-return = 회귀 0).
// step-0001(부트스트랩): 힘 법칙 0개 — 자유 운동(적분)만이 기질이다.
;(function (root, factory) {
  const K = (typeof require !== 'undefined') ? require('./hgo-kernel.js') : root.HGO.kernel;
  const mod = factory(K);
  if (typeof module !== 'undefined' && module.exports) module.exports = mod;
  else (root.HGO = root.HGO || {}).laws = mod;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (K) {
  'use strict';

  // 노브 기본값 — step 마다 *미존재 시 가법*으로만 추가(과거 장면 무영향).
  const DEFAULTS = { dt: 1.0, kEmit: 0, kRecoil: 0, kProp: 0, kScatter: 0 };

  // 자발 방출(step-0002): 들뜬 원자(x>0)가 확률 kEmit 로 한 준위 강하 → 광자 1개.
  //   닫힌 장부: 원자 들뜸 E ↓ = 광자 E ↑ (정확 쌍 거래, ΔE = levelE(x)−levelE(x−1)).
  //   국소: 그 원자 *혼자*로 판정(이웃·전역 조율자 0). 결정론: sim.rng(시드 의사난수)만.
  function emit(sim) {
    const k = sim.knobs.kEmit;
    if (!k) return;                  // 노브=0 → early-return = 회귀 0 (방출 항 꺼짐 → 직전 비트)
    const rng = sim.rng;
    if (!rng) return;                // 런타임 의사난수 없으면 방출 불가(Math.random 금지 — 결정론)
    for (const a of sim.atoms) {
      if ((a.x | 0) <= 0) continue;            // 바닥 상태는 방출 안 함
      if (rng() >= k) continue;                // 자발 방출 확률 kEmit
      const x0 = a.x | 0, x1 = x0 - 1;
      const dE = K.levelE(x0) - K.levelE(x1);  // 준위 차 = 광자 에너지 (λ author 안 함)
      a.x = x1;                                 // 한 준위 강하 (들뜸 E ↓)
      //  px·py: 광자 운동량(recoil 법칙이 채움) · src: 반동 줄 원자 · recoiled: 반동 처리 플래그.
      //  rx0·ry0·birth: 방출 위치·시각(propagate 검증용). E0·nscatter: 방출 에너지·산란 횟수(scatter 검증용). hash 미참여.
      //  recoil 꺼짐(kRecoil=0)이면 px=py=0 으로 남아 장부 운동량 0 가법 → step-0002 비트 동일.
      sim.photons.push({ E: dE, lambda: K.photonLambda(dE), rx: a.rx, ry: a.ry, rx0: a.rx, ry0: a.ry, birth: sim.tick, from: x0, to: x1, px: 0, py: 0, src: a, recoiled: false, E0: dE, nscatter: 0 });
    }
  }

  // 광자 반동(step-0003): 방출 광자가 운동량 p=E/c 를 나르고 원자가 반대로 recoil.
  //   닫힌 장부(에너지·운동량 동시): 준위차 ΔE 가 *광자 E_ph + 원자 반동 ΔKE* 로 갈라진다.
  //     방향 dir 로 |p|=pmag 방출 → 원자 Δv=−(pmag/m)·dir, E_ph=pmag·c.
  //     ΔKE = m·v·Δv + ½m|Δv|² = −pmag(v·dir) + pmag²/2m  ← *이미 움직이는 원자*의 Doppler 교차항 포함.
  //     보존 ΔE = E_ph + ΔKE = pmag(c − v·dir) + pmag²/2m  ⇒  2차식.
  //     풀면  pmag = m[ −(c − v·dir) + √((c − v·dir)² + 2ΔE/m) ].  (v=0 이면 rest-frame recoil shift 로 환원)
  //     ⇒ 같은 ΔE 라도 운동 반대로 쏜 광자가 더 큰 E(청색)·운동 방향이면 더 작은 E(적색) — Doppler 창발.
  //   국소: 광자 + 그 *발원 원자(src)* 만으로 판정(이웃·전역 조율자 0 — 공간 질의 불필요).
  //   결정론: 방출 방향 θ 는 sim.rng(시드 의사난수)만. 노브=0 → early-return = 회귀 0.
  function recoil(sim) {
    const k = sim.knobs.kRecoil;
    if (!k) return;                  // 노브=0 → early-return = 회귀 0 (반동 항 꺼짐 → 직전 비트)
    const rng = sim.rng;
    if (!rng) return;                // 의사난수 없으면 방향 불가(Math.random 금지 — 결정론)
    const c = K.C;
    for (const p of sim.photons) {
      if (p.recoiled) continue;      // 이전 tick 에 이미 반동 처리된 광자는 건너뜀
      const a = p.src;
      if (!a) continue;
      const dE = p.E;                          // 방출 시 광자에 실린 *전체* 준위차
      if (dE <= 0) { p.recoiled = true; continue; }
      const m = K.mass(a);
      const th = rng() * 2 * Math.PI;          // 방출 방향(결정론 의사난수)
      const dx = Math.cos(th), dy = Math.sin(th);
      const vd = a.vx * dx + a.vy * dy;        // 원자 속도의 방출 방향 성분(Doppler 교차항)
      const b = c - vd;
      const pmag = m * (Math.sqrt(b * b + 2 * dE / m) - b);  // 에너지+운동량 동시 보존 해(2차식 근)
      const Eph = pmag * c;                    // |광자 운동량| = E_ph/c (질량 0 → E=pc)
      p.E = Eph;                               // 광자 E ← E_ph (준위차 − 반동 ΔKE)
      p.lambda = K.photonLambda(Eph);          // λ 도 갱신(reddened) — λ=hc/E_ph
      p.px = pmag * dx; p.py = pmag * dy;       // 광자 운동량(장부 가법)
      a.vx -= pmag * dx / m; a.vy -= pmag * dy / m; // 원자 반대 방향 반동(Δp = −p)
      p.recoiled = true;
    }
  }

  // 광자 전파(step-0004): 질량 0 광자가 *운동량 방향*으로 광속 c 로 직진(토러스 wrap).
  //   step-0003 이 실은 운동량(px,py)이 방향을 준다 — 그 방향으로 r += dir·c·dt.
  //   닫힌 장부: 위치만 바뀜 — 광자 E·운동량·원자 전부 불변 ⇒ 장부 잔차 그대로(보존-자명).
  //   국소: 광자 *혼자* 자유 비행(이웃·전역 조율자 0). 노브=0 → early-return = 회귀 0.
  //   ⚠ 흡수·소멸은 아직 0 — 광자는 누적·비행만(STATE §3 🔴, 흡수 step 이 소멸 담당).
  function propagate(sim) {
    const k = sim.knobs.kProp;
    if (!k) return;                  // 노브=0 → early-return = 회귀 0 (전파 항 꺼짐 → 직전 비트)
    const c = K.C, dt = sim.knobs.dt;
    for (const p of sim.photons) {
      const pmag = Math.hypot(p.px || 0, p.py || 0);
      if (pmag <= 0) continue;       // 운동량 없는 광자(방향 미정, step-0002 류)는 정지
      const sp = c * k * dt;         // k=1 → 정확히 광속 c (k 는 전파 계수/디버그 속도 스케일)
      p.rx = wrap(p.rx + (p.px / pmag) * sp, sim.W);
      p.ry = wrap(p.ry + (p.py / pmag) * sp, sim.H);
    }
  }

  // 비탄성 산란 = 빛이 원자를 재여기(step-0005, *순환의 씨앗*). 광자가 근처 원자에 한 준위 들뜸을
  // 주고 *살아남아 적색이동*한다(Compton형). 남는 에너지를 광자가 가져가므로 원자는 정수 준위 점프 가능.
  //   왜 흡수·소멸이 아니라 산란인가: 자유 광자 E=pc 라 전체 흡수 시 운동량 KE(p²/2m)<광자 E,
  //     차액을 정수 준위에 정확히 실을 수 없다(Mössbauer 문제). 산란은 잉여를 광자에 남겨 정확 보존.
  //   에너지+운동량 동시 보존(전방 산란, dir=광자 진행 방향): u=광자가 내놓는 에너지.
  //     u²/(2m) + u(v·dir − 1) + G = 0  (G=levelE(x+1)−levelE(x), 들뜸 비용)
  //     u = m[ (1 − v·dir) − √((1 − v·dir)² − 2G/m) ]  (작은 근=최소 전달). 판별식<0 → 산란 불가(반동 과대).
  //   원자: x↑·전방 반동(Δv=u·dir/m). 광자: E·|p|← q=E−u(적색이동), 방향 불변. 국소(광자+근접 원자).
  //   결정론: 확률 kScatter 는 sim.rng 만. 노브=0 → early-return = 회귀 0.
  function scatter(sim) {
    const k = sim.knobs.kScatter;
    if (!k) return;                  // 노브=0 → early-return = 회귀 0
    const rng = sim.rng;
    if (!rng) return;
    const R = sim.knobs.scatterR || 10, R2 = R * R, xMax = 6;
    for (const p of sim.photons) {
      const Ein = p.E, pmag = Math.hypot(p.px || 0, p.py || 0);
      if (pmag <= 0) continue;       // 방향 없는 광자(무반동)는 산란 안 함
      const dirx = p.px / pmag, diry = p.py / pmag;
      for (let i = 0; i < sim.atoms.length; i++) {
        const a = sim.atoms[i];
        const x = a.x | 0;
        if (x >= xMax) continue;     // 고준위 포화(이온화 영역 — 범위 밖)
        const dx = K.minImage(p.rx - a.rx, sim.W), dy = K.minImage(p.ry - a.ry, sim.H);
        if (dx * dx + dy * dy > R2) continue;                 // 근접 반경 밖
        const G = K.levelE(x + 1) - K.levelE(x);              // 한 준위 ↑ 들뜸 비용
        const m = K.mass(a), vd = a.vx * dirx + a.vy * diry, bb = 1 - vd;
        const D = bb * bb - 2 * G / m;
        if (D < 0) continue;                                  // 반동 과대 → 이 전이 불가
        const u = m * (bb - Math.sqrt(D));                    // 광자가 내놓는 에너지(작은 근)
        if (u <= 0 || u >= Ein) continue;                     // 광자 에너지 부족/음수
        if (rng() >= k) break;                                // 확률 kScatter 산란 시도 실패 → 이 광자 패스
        const q = Ein - u;                                    // 산란 후 광자 에너지(적색이동)
        a.x = x + 1;                                           // 원자 한 준위 들뜸(재여기)
        a.vx += u * dirx / m; a.vy += u * diry / m;            // 전방 반동
        p.E = q; p.px = q * dirx; p.py = q * diry; p.lambda = K.photonLambda(q);  // 광자 적색이동(방향 불변)
        p.nscatter = (p.nscatter | 0) + 1;
        sim.scatterCount = (sim.scatterCount | 0) + 1;
        break;
      }
    }
  }

  // 힘/상호작용 법칙 레지스트리 + 실행 순서. append-only — 노브=0 → 회귀 0.
  const LAWS = { emit, recoil, propagate, scatter };
  const LAW_ORDER = ['emit', 'recoil', 'propagate', 'scatter'];

  // 법칙 적용: 각 법칙이 원자 상태(v·x·…)를 고친다. 노브=0 인 항은 early-return.
  function applyForces(sim) {
    for (const name of LAW_ORDER) LAWS[name](sim);
  }

  function wrap(v, max) { v %= max; if (v < 0) v += max; return v === max ? 0 : v; } // [0,max) 보장 — 음수 wrap 의 부동소수 반올림이 정확히 max 를 내는 경우를 0 으로 접는다

  // 적분(기질): 자유 운동 — 위치 += 속도·dt, 토러스 경계 wrap.
  // 힘이 없으므로 v 불변 → 에너지·운동량 정확 보존(닫힌 장부 잔차 0).
  function integrate(sim) {
    const dt = sim.knobs.dt;
    for (const a of sim.atoms) {
      a.rx = wrap(a.rx + a.vx * dt, sim.W);
      a.ry = wrap(a.ry + a.vy * dt, sim.H);
    }
  }

  return { DEFAULTS, LAWS, LAW_ORDER, applyForces, integrate, wrap };
});
