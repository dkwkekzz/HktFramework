// hgo-kernel.js — 동결 헬퍼 (결정론 PRNG · 상태 해시 · 보존 장부)
// 이 파일의 함수는 시리즈 회귀 앵커다 — 시그니처/수치 의미를 바꾸지 않는다(가법만).
;(function (root, factory) {
  const mod = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = mod;
  else (root.HGO = root.HGO || {}).kernel = mod;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const C = 1; // 빛의 속도 = 1 (자연 단위) — e=mc² 의 c

  // 결정론 의사난수 (Math.random 금지). 같은 시드 → 같은 수열.
  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // 원자 질량 = 양성자 + 중성자 (전자 질량 무시 — 단순화, SPINE §3 요건4-4)
  function mass(a) { return a.Z + a.N; }

  // 반경험적 질량공식(Bethe–Weizsäcker 토이) 결합에너지 B(Z,N) — 핵 *안정성*의 출처(원소표 author 0).
  //   B = aV·A − aS·A^(2/3) − aC·Z(Z−1)/A^(1/3) − aA·(N−Z)²/A   (A=Z+N · 페어링 δ 생략 — 후속 정밀화)
  //   부피(aV)는 결합을 키우고, 표면(aS)·쿨롱(aC, 양성자 반발)·비대칭(aA, N≠Z 불리)은 깎는다.
  //   결합 B 가 클수록 안정. **베타붕괴 Q값·안정 골짜기가 여기서 창발** — 쿨롱(저 Z 선호) vs 비대칭(N=Z 선호) 경쟁이 골짜기 위치를 정한다(author 0).
  //   토이 계수(자연 단위 c=1): ΔB 를 KE<c 로 유지하도록 축소 — 결정론 상수라 헤더 고정(CLAUDE 규약: 시뮬 상수는 CVar 예외).
  const BIND = { aV: 1.0, aS: 0.5, aC: 0.1048, aA: 1.35, aP: 0.6 };
  // 페어링항 δ(Z,N)(step-0039, pair 게이트) — 짝-짝 +δ(스핀 반대 쌍이 더 결합·안정) · 홀-홀 −δ(덜 결합·불안정) · 홀수 A 0.
  //   짝지은 핵자 쌍이 에너지를 낮춘다 → 안정선의 짝-홀 진동(odd-even staggering)이 창발: 매끈한 질량공식이 *안정*이라 한 홀-홀 핵이
  //   페어링으로 불안정해져 짝-짝 이웃으로 한 칸 더 붕괴한다(예: ¹⁶N 홀-홀 → ¹⁶O 짝-짝). δ = aP/√A(텍스트북 12·A^(−1/2) 토이).
  function pairingDelta(Z, N) {
    const eZ = ((Z & 1) === 0), eN = ((N & 1) === 0);
    const s = (eZ && eN) ? 1 : ((!eZ && !eN) ? -1 : 0);   // 짝-짝 + · 홀-홀 − · 홀수 A(한쪽만 짝) 0
    return s ? s * BIND.aP / Math.sqrt(Z + N) : 0;
  }
  function binding(Z, N, pair) {
    Z = Z | 0; N = N | 0; const A = Z + N; if (A <= 0) return 0;
    const b = BIND.aV * A - BIND.aS * Math.pow(A, 2 / 3) - BIND.aC * Z * (Z - 1) / Math.cbrt(A) - BIND.aA * (N - Z) * (N - Z) / A;
    return pair ? b + pairingDelta(Z, N) : b;             // pair=0/undefined → 정확히 b(δ 미가법) = 비트 동일·회귀 0
  }
  // β⁻(n→p) 붕괴의 결합에너지 이득 ΔB = B(Z+1,N−1) − B(Z,N). >0 이면 *발열*(골짜기 쪽으로) → 붕괴 진행, ≤0 이면 안정(골짜기). pair 게이트 전달.
  function bindingDelta(Z, N, pair) { return binding(Z + 1, N - 1, pair) - binding(Z, N, pair); }

  // 전자 들뜸 준위(x)의 에너지 — 이산 에너지 *고유값*(슈뢰딩거 수소 스펙트럼 E_n=−R/n², n=x+1; x=0 바닥→0).
  //   ※ 보어의 *궤도* 그림(불확정성 위배 → 하이젠베르크·슈뢰딩거가 기각)이 아니라, 그 그림이 우연히 맞힌
  //     *에너지 고유값*만 쓴다 — 궤도·반지름·각운동량 양자화는 시뮬 안 함(전이만 관측, 하이젠베르크 정신).
  //   준위 간격이 비선형 → 서로 다른 전이가 서로 다른 ΔE(=스펙트럼선) 창발(author 0).
  //   ⚠ 단순화: Z 무시 → 다전자 원자도 수소형 사다리(실제 수소형 E∝Z²·다전자 차폐 미반영, STATE §3 🔴).
  const RYDBERG = 1; // 들뜸 에너지 척도 R (자연 단위)
  const H_PLANCK = 1; // 플랑크 상수 h (자연 단위) — λ = h·c/ΔE
  function levelE(x) { const n = (x | 0) + 1; return RYDBERG * (1 - 1 / (n * n)); }
  // 준위 에너지의 Z 의존(step-0013, 노브 zScale 게이트 — 원소별 스펙트럼).
  //   ⚠ levelE 는 동결 앵커(Z 무관 수소 사다리)다 — 시그니처/수치 의미 불변. 여기 *새 함수*가 가법으로 Z 를 얹는다.
  //   단전자 *수소형* 이온(e=1)의 들뜸 E ∝ Z² (보어 닫힌 형식 E_n=−R·Z²/n² ⇒ 들뜸 E=Z²·levelE(x)).
  //   다전자(e≠1): step-0014 차폐 노브 screen 게이트 — 유효핵전하 Z_eff=Z−screen·(e−1) 로 E∝Z_eff²
  //     (다른 e−1 전자가 핵을 가림 → 실효 끌림 ↓ → 준위 얕아짐). screen=0 → 다전자 Z 무관(step-0013 보존·회귀 0).
  //   zScale 블렌드: 0 → 정확히 levelE(x)(회귀 0·바이트 동일) · 1 → 완전 Z(_eff)² 스케일 · 중간 → 보간(뷰어 슬라이더).
  //   ★ 닫힌 장부 핵심: Z·e 는 *런 중 불변*(어느 법칙도 안 바꿈) → 한 원자의 zfac(Z_eff 포함) 가 상수 →
  //     흡수(scatter·reheat·chemilum)와 방출(emit)이 *같은 zfac* 로 거래 → 들뜸 E 의 가감이 정확히 상쇄(E 보존).
  function levelEZ(x, Z, e, zScale, screen) {
    const base = levelE(x);
    if (!zScale) return base;                       // 노브=0 → 정확히 levelE (회귀 0)
    let zfac;
    if (e === 1) zfac = Z * Z;                      // 단전자 수소형 이온: 정확 E∝Z² (step-0013)
    else if (screen) { const zeff = Z - screen * (e - 1); zfac = zeff * zeff; }  // 다전자: 유효핵전하 Z_eff² (step-0014 차폐)
    else zfac = 1;                                  // 차폐 노브=0 → 다전자 Z 무관(step-0013 보존)
    return base * (1 + zScale * (zfac - 1));        // 0→levelE · 1→Z(_eff)²·levelE · 보간
  }
  // 광자 파장 — λ = hc/ΔE. 색은 author 가 아니라 준위 차에서 *나온다*(SPINE §3 요건3).
  function photonLambda(dE) { return H_PLANCK * C / dE; }

  // 쿨롱 위치 에너지(step-0019) — Plummer U=Σ_{i<j 하전} kC·qa·qb/√(r²+ε²). 힘 법칙(F=−∇U)과 *정확히* 동일 식.
  //   ledger 와 장면 측정(peOf)이 *한 출처*를 공유해야 KE↔PE 보존이 비트 단위로 성립(DRY — 두 곳 desync 방지).
  //   미하전(q=0)·kCoulomb=0 → 0 (과거 장부 불변). atoms 인자로 임의 스냅샷(초기/최종) PE 측정 가능.
  function coulombPE(atoms, knobs, W, H) {
    const kc = (knobs && knobs.kCoulomb) || 0;
    if (!kc) return 0;
    const eps2 = (knobs.coulombSoft || 1) ** 2;
    let u = 0;
    for (let i = 0; i < atoms.length; i++) {
      const qi = atoms[i].Z - atoms[i].e; if (qi === 0) continue;
      for (let j = i + 1; j < atoms.length; j++) {
        const qj = atoms[j].Z - atoms[j].e; if (qj === 0) continue;
        const dx = minImage(atoms[j].rx - atoms[i].rx, W), dy = minImage(atoms[j].ry - atoms[i].ry, H);
        u += kc * qi * qj / Math.sqrt(dx * dx + dy * dy + eps2);
      }
    }
    return u;
  }

  // 중력 위치 에너지(step-0028) — Plummer U_grav = Σ_{i<j *모든 쌍*} −kG·ma·mb/√(r²+ε²) ≤ 0. 힘 법칙(F=−∇U)과 *정확히* 동일 식.
  //   쿨롱의 *질량판*: 전하 q→질량 m(=Z+N), 항상 인력(부호 고정 −). 전하 게이트 없음(중력은 보편 — 중성 포함 모든 쌍).
  //   coulombPE 와 같은 연화 ε(coulombSoft 공유, DRY). kGravity 미설정/0(0027 이하) → 0 → 과거 장부 불변.
  function gravityPE(atoms, knobs, W, H) {
    const kg = (knobs && knobs.kGravity) || 0;
    if (!kg) return 0;
    const eps2 = (knobs.coulombSoft || 1) ** 2;
    let u = 0;
    for (let i = 0; i < atoms.length; i++) {
      const mi = mass(atoms[i]);
      for (let j = i + 1; j < atoms.length; j++) {
        const dx = minImage(atoms[j].rx - atoms[i].rx, W), dy = minImage(atoms[j].ry - atoms[i].ry, H);
        u += -kg * mi * mass(atoms[j]) / Math.sqrt(dx * dx + dy * dy + eps2);
      }
    }
    return u;
  }

  // 반발 코어 위치 에너지(step-0020) — U_rep = Σ_{i<j 하전} kR/(r²+ε²) ≥ 0. 힘 법칙(F=−∇U)과 *정확히* 동일 식.
  //   coulombPE 와 같은 쌍·게이트·연화(DRY). kRepulse 미설정/0(0019 이하) → 0 → 과거 장부 불변. 쿨롱 인력과 합쳐 r_eq 우물을 만든다.
  // step-0058 게이트 spatialHash(=0 → 전쌍 full U·회귀 0): pauliPE(0056)·vdwPE(0057)와 동형 컷오프+shift. 하전 쌍만(전하 게이트 보존).
  //   U_shifted=kR/s2−kR/sc2 (r≤cut)·0 (r>cut) — r=cut 에서 0 연속화 → 경계 PE 점프 0 → symplectic E 닫힘(force=−∇U 정합).
  function repulsePE(atoms, knobs, W, H) {
    const kr = (knobs && knobs.kRepulse) || 0;
    if (!kr) return 0;
    const eps2 = (knobs.coulombSoft || 1) ** 2;
    const sh = (knobs && knobs.spatialHash) || 0;
    const cut = (knobs && knobs.spatialCut) || 8, cut2 = cut * cut;
    const uCut = sh ? kr / (cut2 + eps2) : 0;           // r=cut 에서의 U(연속화 shift 상수)
    let u = 0;
    for (let i = 0; i < atoms.length; i++) {
      const qi = atoms[i].Z - atoms[i].e; if (qi === 0) continue;
      for (let j = i + 1; j < atoms.length; j++) {
        const qj = atoms[j].Z - atoms[j].e; if (qj === 0) continue;
        const dx = minImage(atoms[j].rx - atoms[i].rx, W), dy = minImage(atoms[j].ry - atoms[i].ry, H);
        const r2 = dx * dx + dy * dy;
        if (sh && r2 > cut2) continue;                  // 컷오프 밖 → 0(force 도 0 — 정합)
        u += kr / (r2 + eps2) - uCut;                   // shift: r=cut 에서 0 연속(경계 PE 점프 0)
      }
    }
    return u;
  }

  // 파울리 보편 반발 위치 에너지(step-0022) — U_pauli = Σ_{i<j *모든 쌍*} kP/(r²+ε²)² ≥ 0. 힘 법칙(F=−∇U)과 *정확히* 동일 식.
  //   repulse 와 달리 *전하 게이트 없음*(중성 포함 모든 쌍 — 부피는 전하 무관). kPauli 미설정/0(0021 이하) → 0 → 과거 장부 불변.
  // step-0056 게이트 spatialHash(=0 → 전쌍 full U·회귀 0): pauli force 가 컷오프(cut=spatialCut) 내 쌍만 작용하면
  //   PE 도 같은 컷오프 + **shift** 로 합산해야 force=−∇U 가 정합한다. U_shifted(r)=kP/s²²−kP/s_cut²² (r≤cut)·0 (r>cut).
  //   shift 상수는 r=cut 에서 U 를 0 으로 연속화 → 쌍이 컷오프 경계를 가로질러도 PE 점프 0 → symplectic E 닫힘(완화 최소).
  //   sh=0(과거 전 장면): uCut=0·컷오프 검사 없음 → 전쌍 full U 그대로(비트 동일·회귀 0).
  function pauliPE(atoms, knobs, W, H) {
    const kp = (knobs && knobs.kPauli) || 0;
    if (!kp) return 0;
    const eps2 = (knobs.coulombSoft || 1) ** 2;
    const sh = (knobs && knobs.spatialHash) || 0;
    const cut = (knobs && knobs.spatialCut) || 8, cut2 = cut * cut;
    const sc2 = cut2 + eps2, uCut = sh ? kp / (sc2 * sc2) : 0;   // r=cut 에서의 U(연속화 shift 상수)
    let u = 0;
    for (let i = 0; i < atoms.length; i++) {
      for (let j = i + 1; j < atoms.length; j++) {
        const dx = minImage(atoms[j].rx - atoms[i].rx, W), dy = minImage(atoms[j].ry - atoms[i].ry, H);
        const r2 = dx * dx + dy * dy;
        if (sh && r2 > cut2) continue;                  // 컷오프 밖 → 0(force 도 0 — 정합)
        const s2 = r2 + eps2;
        u += kp / (s2 * s2) - uCut;                     // shift: r=cut 에서 0 연속(경계 가로질러도 PE 점프 0)
      }
    }
    return u;
  }

  // 반데르발스 보편 인력 위치 에너지(step-0023) — U_vdw = Σ_{i<j *모든 쌍*} −kV/(r²+ε²) ≤ 0. 힘 법칙(F=−∇U)과 *정확히* 동일 식.
  //   전하 게이트 없음(vdW 는 보편). pauli 반발과 합쳐 우물(s2_eq=2kP/kV) 형성. kVdW 미설정/0(0022 이하) → 0 → 과거 장부 불변.
  // step-0057 게이트 spatialHash(=0 → 전쌍 full U·회귀 0): pauliPE(0056)와 동형 컷오프+shift. U_shifted=−kV/s2−(−kV/sc2) (r≤cut)·0 (r>cut).
  //   vdW 는 U<0(인력)이라 shift 상수 −U(cut)=+kV/sc2>0 — r=cut 에서 U 0 연속화 → 경계 PE 점프 0 → symplectic E 닫힘(force=−∇U 정합).
  function vdwPE(atoms, knobs, W, H) {
    const kv = (knobs && knobs.kVdW) || 0;
    if (!kv) return 0;
    const eps2 = (knobs.coulombSoft || 1) ** 2;
    const sh = (knobs && knobs.spatialHash) || 0;
    const cut = (knobs && knobs.spatialCut) || 8, cut2 = cut * cut;
    const uCut = sh ? -kv / (cut2 + eps2) : 0;          // r=cut 에서의 U(연속화 shift 상수·vdW 는 음수)
    let u = 0;
    for (let i = 0; i < atoms.length; i++) {
      for (let j = i + 1; j < atoms.length; j++) {
        const dx = minImage(atoms[j].rx - atoms[i].rx, W), dy = minImage(atoms[j].ry - atoms[i].ry, H);
        const r2 = dx * dx + dy * dy;
        if (sh && r2 > cut2) continue;                  // 컷오프 밖 → 0(force 도 0 — 정합)
        u += -kv / (r2 + eps2) - uCut;                  // shift: r=cut 에서 0 연속(경계 PE 점프 0)
      }
    }
    return u;
  }

  // 결합 스프링 위치 에너지(step-0026) — U_spring = Σ_{결합 간선} ½·kS·(r−r_eq)² ≥ 0. 힘 법칙(F=−∇U)과 *정확히* 동일 식.
  //   *결합 간선만*(sim.bonds — coulomb/vdw 류 전쌍 아님) → 중성 공유결합에 평형 길이 부여. kBondSpring 미설정/0(0025 이하) → 0 → 과거 장부 불변.
  function bondSpringPE(sim) {
    const ks = (sim.knobs && sim.knobs.kBondSpring) || 0;
    if (!ks || !sim.bonds || !sim.bonds.length) return 0;
    const req = sim.knobs.bondReq || 4;
    const A = sim.atoms;
    let u = 0;
    for (const e of sim.bonds) {
      const a = A[e[0]], b = A[e[1]];
      const dx = minImage(b.rx - a.rx, sim.W), dy = minImage(b.ry - a.ry, sim.H);
      const dr = Math.sqrt(dx * dx + dy * dy) - req;
      u += 0.5 * ks * dr * dr;
    }
    return u;
  }

  // 결합 각도 위치 에너지(step-0027) — U_angle = Σ_{한 중심에 모인 결합쌍} ½·kA·(θ−θ₀)² ≥ 0. 힘 법칙(F=−∇U)과 동일 식.
  //   *한 원자에 모인 결합 간선쌍*(VSEPR)만 → 중성·하전 분자에 평형 각도 부여. kBondAngle 미설정/0(0026 이하) → 0 → 과거 장부 불변.
  function bondAnglePE(sim) {
    const ka = (sim.knobs && sim.knobs.kBondAngle) || 0;
    if (!ka || !sim.bonds || !sim.bonds.length) return 0;
    const t0 = sim.knobs.bondAngleTarget;
    const A = sim.atoms, W = sim.W, H = sim.H;
    const nbr = new Map();
    for (const e of sim.bonds) {
      if (!nbr.has(e[0])) nbr.set(e[0], []);
      if (!nbr.has(e[1])) nbr.set(e[1], []);
      nbr.get(e[0]).push(e[1]); nbr.get(e[1]).push(e[0]);
    }
    let u = 0;
    for (const [ci, ns] of nbr) {
      if (ns.length < 2) continue;
      const ai = A[ci];
      for (let p = 0; p < ns.length; p++) for (let q = p + 1; q < ns.length; q++) {
        const aj = A[ns[p]], ak = A[ns[q]];
        const axx = minImage(aj.rx - ai.rx, W), axy = minImage(aj.ry - ai.ry, H);
        const bxx = minImage(ak.rx - ai.rx, W), bxy = minImage(ak.ry - ai.ry, H);
        const la = Math.hypot(axx, axy), lb = Math.hypot(bxx, bxy);
        if (la === 0 || lb === 0) continue;
        let cos = (axx * bxx + axy * bxy) / (la * lb);
        if (cos > 1) cos = 1; else if (cos < -1) cos = -1;
        const d = Math.acos(cos) - t0;
        u += 0.5 * ka * d * d;
      }
    }
    return u;
  }

  // 닫힌 장부: 보존되어야 할 양들의 총합 (SPINE §2)
  //  Q 전하 = Σ(Z−e) · B 바리온 = Σ(Z+N) · L 렙톤 = Σe
  //  E 에너지-질량 = Σ(m·c² + ½m·v² + 들뜸E) + Σ 광자E  (e=mc² 정지+운동+들뜸+복사)
  //  px,py 운동량 = Σ m·v + Σ 광자운동량(p.px,p.py — step-0003 recoil 가법, 미설정 → 0)
  // 가법 규칙(SPINE §6.1): 들뜸항은 x=0 → 0, 광자항은 미존재/빈 배열 → 0 ⇒ 과거(step-0001) 장부 불변.
  function ledger(sim) {
    let Q = 0, B = 0, L = 0, E = 0, px = 0, py = 0;
    const lz = (sim.knobs && sim.knobs.levelZ) || 0;       // 준위 Z 의존(step-0013, 미설정/0 → levelE 그대로 = 과거 장부 불변)
    const sc = (sim.knobs && sim.knobs.levelScreen) || 0;  // 다전자 차폐(step-0014, 미설정/0 → step-0013 그대로)
    // 결합E 정지질량 편입(step-0040 massDefect). fuseMassFormula(0041)도 *융합 Q를 binding 서* 빼므로 정지질량이 −B 여야 닫힌다 →
    //   둘 중 하나라도 켜지면 rest=A−B 로 편입(fmf 가 md 를 *함의*·불일치 조합서도 닫힘). 둘 다 0(과거 전 장면) → m·c²+nuc 그대로(회귀 0).
    const md = (sim.knobs && (sim.knobs.massDefect || sim.knobs.fuseMassFormula)) || 0;
    const pr = (sim.knobs && sim.knobs.decayPairing) || 0; // md 일 때 −B 의 페어링 게이트(decay·fuse 와 같은 B 사용)
    // 완전 상대론적 운동에너지(step-0049 relKE): 0047 이 저장 v 를 *고유속도(celerity) u=γ·v_coord* 로 재해석해 운동량 p=m·u 를 상대론화했으나,
    //   운동에너지는 여전히 토이 ½m|u|². 이 게이트는 KE 도 상대론화한다 — KE=(γ−1)mc², γ=√(1+|u|²/c²)(저속 극한서 ½m|u|² 회복·고속서 발산=c 에 무한 에너지 벽).
    //   relKE=0(과거 전 장면) → ½m·v2 그대로(비트 동일·회귀 0). md/levelEZ 와 같은 *레저 게이트*(force 법칙 아님 — LAW_ORDER 미참여).
    const rk = (sim.knobs && sim.knobs.relKE) || 0;
    for (const a of sim.atoms) {
      const m = mass(a);
      Q += a.Z - a.e;
      B += a.Z + a.N;
      L += a.e;
      const v2 = a.vx * a.vx + a.vy * a.vy;
      // 정지질량 에너지: md 면 결합에너지를 정지질량에 편입(M=A−B → 결합한 핵이 *가볍다*·질량 결손), 아니면 A·c²(+nuc 저장고).
      //   md=0 → (m)·c²+0.5mv²+들뜸 그대로 + 아래 a.nuc → 과거 비트 동일(회귀 0). md=1 → −B 편입·nuc 미가법(저장고 폐기).
      E += (md ? (m - binding(a.Z | 0, a.N | 0, pr)) : m) * C * C + (rk ? (Math.sqrt(1 + v2 / (C * C)) - 1) * m * C * C : 0.5 * m * v2) + levelEZ(a.x, a.Z, a.e, lz, sc);  // KE: rk → (γ−1)mc²(상대론) / 0 → ½mv²(토이·회귀 0) · 들뜸(x=0 → 0; lz=0 → levelE)
      // 핵 결합/저장 에너지(step-0031 decay): 불안정 동위원소가 품은 붕괴 Q값(Δm·c² 저장고). 붕괴 시 KE 로 빠진다 → E 닫힘.
      //   미존재(과거 전 장면 a.nuc undefined) → 0 가법 → 장부·해시 불변. 핵 변환이라도 Σ(mc²+KE+a.nuc) 보존.
      //   md(0040) 면 저장고 폐기 — 발열량은 −B 정지질량 변화서 직접 나온다(나머지 nuc 회계는 md=0 경로 전용).
      if (!md) E += a.nuc || 0;
      px += m * a.vx;
      py += m * a.vy;
      // 렙톤 수: e 가 곧 렙톤이나, 베타붕괴(n→p, e+1)는 반중성미자(L=−1)를 방출 → a.lep 가 그 음의 렙톤 수를 담아 L 닫힘(SPINE §2 렙톤 정련).
      //   미존재(과거 a.lep undefined) → 0 가법 → 과거 L 불변.
      L += a.lep || 0;
    }
    // 복사장: 에너지 + 운동량(recoil). px·py 미설정(step-0002 이하) → 0 가법 → 과거 장부 불변.
    if (sim.photons) for (const p of sim.photons) { E += p.E; px += p.px || 0; py += p.py || 0; }
    // 복사 바스(step-0007 escape): 활성 배열에서 빠진 광자의 E·운동량 reservoir. 미존재(과거)→0 가법 → 장부 불변.
    if (sim.escaped) { E += sim.escaped.E; px += sim.escaped.px || 0; py += sim.escaped.py || 0; }
    // 결합 E reservoir(step-0010 bond): 비탄성 포획서 흡수한 상대 KE. 운동량-자유(스칼라) → E 만 가법. 미존재(과거)→0 → 장부 불변.
    if (sim.bondE) E += sim.bondE;
    // 쿨롱 PE(step-0019 coulomb): 연속 보존력의 위치 에너지(공유 헬퍼 — 힘 법칙·장면 측정과 한 출처).
    //   가법 규칙: kCoulomb 미설정/0(과거 전 장면) → 0 → 장부 불변. 켜지면 KE↔PE 가 교환되며 총 E 유계 보존(반음시).
    E += coulombPE(sim.atoms, sim.knobs, sim.W, sim.H);
    // 반발 코어 PE(step-0020 repulse): 단거리 반발의 위치 에너지(쿨롱 PE 와 한 쌍·게이트). kRepulse 미설정/0 → 0 → 장부 불변.
    E += repulsePE(sim.atoms, sim.knobs, sim.W, sim.H);
    // 파울리 보편 반발 PE(step-0022 pauli): 모든 쌍의 excluded-volume PE. kPauli 미설정/0 → 0 → 장부 불변.
    E += pauliPE(sim.atoms, sim.knobs, sim.W, sim.H);
    // 반데르발스 보편 인력 PE(step-0023 vdw): 모든 쌍의 인력 PE(≤0). kVdW 미설정/0 → 0 → 장부 불변.
    E += vdwPE(sim.atoms, sim.knobs, sim.W, sim.H);
    // 결합 스프링 PE(step-0026 bondSpring): 결합 간선의 평형 길이 복원 PE(≥0). kBondSpring 미설정/0 → 0 → 장부 불변.
    E += bondSpringPE(sim);
    // 결합 각도 PE(step-0027 bondAngle): 한 중심에 모인 결합쌍의 평형 각도 복원 PE(≥0). kBondAngle 미설정/0 → 0 → 장부 불변.
    E += bondAnglePE(sim);
    // 중력 PE(step-0028 gravity): 모든 쌍의 인력 PE(≤0). kGravity 미설정/0 → 0 → 장부 불변.
    E += gravityPE(sim.atoms, sim.knobs, sim.W, sim.H);
    return { Q, B, L, E, px, py };
  }

  // 토러스 최소상(min-image) 변위 — 경계 wrap 을 가로지르는 거리 보정
  function minImage(d, max) {
    d %= max;
    if (d > max / 2) d -= max;
    if (d < -max / 2) d += max;
    return d;
  }

  // 전체 상태의 결정론 해시 (float64 비트까지) — 결정론·골든 회귀 앵커.
  // 가법 규칙: 새 필드는 *정의됐을 때만* 섞는다(미존재 시 no-op → 과거 해시 불변).
  function hashState(sim) {
    let h = 0x811c9dc5; // FNV-1a 32bit
    const buf = new ArrayBuffer(8), dv = new DataView(buf);
    function mixI(x) { h ^= (x | 0); h = Math.imul(h, 0x01000193); }
    function mixF(x) { dv.setFloat64(0, x); for (let b = 0; b < 8; b++) { h ^= dv.getUint8(b); h = Math.imul(h, 0x01000193); } }
    mixI(sim.atoms.length);
    for (const a of sim.atoms) {
      mixI(a.Z); mixI(a.N); mixI(a.e); mixI(a.x | 0);
      mixF(a.rx); mixF(a.ry); mixF(a.vx); mixF(a.vy);
    }
    // 광자: *비어 있지 않을 때만* 섞는다 → 과거(광자 0) 해시 불변(가법 규칙).
    if (sim.photons && sim.photons.length) {
      mixI(sim.photons.length);
      for (const p of sim.photons) { mixI(p.from); mixI(p.to); mixF(p.E); mixF(p.rx); mixF(p.ry); }
    }
    // 복사 바스(step-0007): *정의됐을 때만* 섞는다 → 과거(바스 0) 해시 불변(가법 규칙).
    if (sim.escaped) { mixI(sim.escaped.count | 0); mixF(sim.escaped.E); mixF(sim.escaped.px); mixF(sim.escaped.py); }
    // 결합(step-0010): 결합 E reservoir·결합 간선 위상을 *정의됐을 때만* 섞는다 → 과거(결합 0) 해시 불변(가법 규칙).
    if (sim.bondE) mixF(sim.bondE);
    if (sim.bonds && sim.bonds.length) { mixI(sim.bonds.length); for (const e of sim.bonds) { mixI(e[0]); mixI(e[1]); } }
    return (h >>> 0).toString(16).padStart(8, '0');
  }

  return { C, RYDBERG, H_PLANCK, mulberry32, mass, binding, bindingDelta, pairingDelta, levelE, levelEZ, photonLambda, coulombPE, repulsePE, pauliPE, vdwPE, bondSpringPE, bondAnglePE, gravityPE, ledger, minImage, hashState };
});
