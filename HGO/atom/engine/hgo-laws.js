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
  const DEFAULTS = { dt: 1.0, kEmit: 0, kRecoil: 0, kProp: 0, kScatter: 0, scatterAngular: 0, kEscape: 0, kReheat: 0, kCollide: 0, kBond: 0, kChemilum: 0, levelZ: 0 };

  // 자발 방출(step-0002): 들뜬 원자(x>0)가 확률 kEmit 로 한 준위 강하 → 광자 1개.
  //   닫힌 장부: 원자 들뜸 E ↓ = 광자 E ↑ (정확 쌍 거래, ΔE = levelE(x)−levelE(x−1)).
  //   국소: 그 원자 *혼자*로 판정(이웃·전역 조율자 0). 결정론: sim.rng(시드 의사난수)만.
  function emit(sim) {
    const k = sim.knobs.kEmit;
    if (!k) return;                  // 노브=0 → early-return = 회귀 0 (방출 항 꺼짐 → 직전 비트)
    const rng = sim.rng;
    if (!rng) return;                // 런타임 의사난수 없으면 방출 불가(Math.random 금지 — 결정론)
    const lz = sim.knobs.levelZ;     // 준위 Z 의존(step-0013, 0 → levelE = 회귀 0)
    for (const a of sim.atoms) {
      if ((a.x | 0) <= 0) continue;            // 바닥 상태는 방출 안 함
      if (rng() >= k) continue;                // 자발 방출 확률 kEmit
      const x0 = a.x | 0, x1 = x0 - 1;
      const dE = K.levelEZ(x0, a.Z, a.e, lz) - K.levelEZ(x1, a.Z, a.e, lz);  // 준위 차 = 광자 에너지 (λ author 안 함; lz=0 → levelE)
      a.x = x1;                                 // 한 준위 강하 (들뜸 E ↓)
      //  px·py: 광자 운동량(recoil 법칙이 채움) · src: 반동 줄 원자 · recoiled: 반동 처리 플래그.
      //  rx0·ry0·birth: 방출 위치·시각(propagate 검증용). E0·nscatter: 방출 에너지·산란 횟수(scatter 검증용). srcZ: 발원 원소 Z(step-0013 스펙트럼 검증). hash 미참여.
      //  recoil 꺼짐(kRecoil=0)이면 px=py=0 으로 남아 장부 운동량 0 가법 → step-0002 비트 동일.
      sim.photons.push({ E: dE, lambda: K.photonLambda(dE), rx: a.rx, ry: a.ry, rx0: a.rx, ry0: a.ry, birth: sim.tick, from: x0, to: x1, px: 0, py: 0, src: a, recoiled: false, E0: dE, nscatter: 0, srcZ: a.Z });
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
    if (sim.knobs.scatterAngular) { scatterV2(sim, k, rng); return; }  // step-0006 게이트(기본 0 → 옛 전방 산란)
    const R = sim.knobs.scatterR || 10, R2 = R * R, xMax = 6;
    const lz = sim.knobs.levelZ;     // 준위 Z 의존(step-0013, 0 → levelE = 회귀 0)
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
        const G = K.levelEZ(x + 1, a.Z, a.e, lz) - K.levelEZ(x, a.Z, a.e, lz);  // 한 준위 ↑ 들뜸 비용(lz=0 → levelE)
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

  // 산란 정밀화(step-0006, 노브 scatterAngular 게이트) — 검토 반영:
  //   ① 타깃을 *배열 인덱스 순 첫 적격*이 아니라 *반경 내 최근접* 원자로(편향 제거).
  //   ② 전방(forward)만이 아니라 *등방 각도 분포*(시드 θ')로 산란 — 광자가 방향을 바꾼다.
  //   노브 미설정 → scatter 가 옛 분기 사용(step-0005 비트 동일 = 회귀 0).
  //   2D 에너지+운동량 동시 보존: 총 운동량 P = p_광자 + m·v_원자, 산란 방향 dir'=(cosθ',sinθ').
  //     q² + q·2(m − P·dir') + (|P|² − |m v|² − 2mE + 2mG) = 0   (q=산란 후 광자 에너지)
  //     q = (P·dir' − m) + √((m − P·dir')² − cc).  전방·정지 시 step-0005 해로 환원(+ 근).
  //     원자 v ← (P − q·dir')/m, 광자 p ← q·dir'. 이동 원자면 청색이동(inverse Compton)도 창발.
  function scatterV2(sim, k, rng) {
    const R = sim.knobs.scatterR || 10, R2 = R * R, xMax = 6;
    const lz = sim.knobs.levelZ;     // 준위 Z 의존(step-0013, 0 → levelE = 회귀 0)
    for (const p of sim.photons) {
      const Ein = p.E, pmag = Math.hypot(p.px || 0, p.py || 0);
      if (pmag <= 0) continue;                          // 방향 없는 광자는 산란 안 함
      const idirx = p.px / pmag, idiry = p.py / pmag;   // 입사 방향(편향각 측정용)
      let best = -1, bestD2 = R2;                        // 반경 내 *최근접* 적격 원자
      for (let i = 0; i < sim.atoms.length; i++) {
        const a = sim.atoms[i];
        if ((a.x | 0) >= xMax) continue;                // 고준위 포화(이온화 영역 밖)
        const dx = K.minImage(p.rx - a.rx, sim.W), dy = K.minImage(p.ry - a.ry, sim.H);
        const d2 = dx * dx + dy * dy;
        if (d2 < bestD2) { bestD2 = d2; best = i; }
      }
      if (best < 0) continue;                           // 반경 내 적격 원자 없음
      if (rng() >= k) continue;                         // 광자당 1회 확률(continue — 다음 광자로)
      const a = sim.atoms[best], x = a.x | 0, G = K.levelEZ(x + 1, a.Z, a.e, lz) - K.levelEZ(x, a.Z, a.e, lz), m = K.mass(a);
      const th = rng() * 2 * Math.PI, cth = Math.cos(th), sth = Math.sin(th);   // 등방 산란 방향
      const Px = p.px + m * a.vx, Py = p.py + m * a.vy;  // 총 운동량(보존량)
      const Pdir = Px * cth + Py * sth;
      const cc = Px * Px + Py * Py - m * m * (a.vx * a.vx + a.vy * a.vy) - 2 * m * Ein + 2 * m * G;
      const mp = m - Pdir, D2 = mp * mp - cc;
      if (D2 < 0) continue;                             // 이 방향엔 보존 해 없음(시도 실패)
      const q = (Pdir - m) + Math.sqrt(D2);             // 산란 후 광자 에너지(물리 근)
      if (q <= 0) continue;                             // 광자 양에너지만
      const defl = Math.acos(Math.max(-1, Math.min(1, idirx * cth + idiry * sth)));  // 편향각(입사↔산란)
      sim.deflectSum = (sim.deflectSum || 0) + defl; sim.deflectN = (sim.deflectN | 0) + 1;
      a.x = x + 1;                                       // 원자 한 준위 들뜸(재여기)
      a.vx = (Px - q * cth) / m; a.vy = (Py - q * sth) / m;   // 2D 운동량 보존 반동
      p.E = q; p.px = q * cth; p.py = q * sth; p.lambda = K.photonLambda(q);  // 광자 방향·에너지 변경
      p.nscatter = (p.nscatter | 0) + 1; sim.scatterCount = (sim.scatterCount | 0) + 1;
    }
  }

  // 광자 소멸/복사 바스 binning (step-0007, *순환의 reservoir*). 오래되거나(나이 ≥ escapeAge)
  // 저에너지인(E ≤ escapeEmin) 광자를 활성 sim.photons 에서 빼 *복사 바스* sim.escaped 로 *이전*한다.
  //   왜 binning 인가: 전파(0004)·산란(0005~6)은 광자를 *살려두므로* 활성 배열이 무한 누적(STATE 🔴, 긴 런서 비대).
  //     그냥 지우면 E·운동량 누출 → 장부 파탄. 대신 바스에 E·px·py 를 누적 *이전* → 활성합+바스합=불변(정확 보존).
  //   닫힌 장부: 광자가 배열에서 사라져도 그 E·p 가 sim.escaped 로 옮겨가고 ledger 가 바스를 합산(가법, 미존재→0).
  //   유계: 살아남은 광자 나이 ≤ escapeAge 로 활성 길이 유계 → 런서 비대 방지. 바스는 미래 *재가열*의
  //     reservoir(SPINE §4 느린 순환 씨앗) — 지금은 모으기만, 되먹임은 후속 step.
  //   저에너지 binning(escapeEmin)은 산란 q→0 적색이동으로 생긴 거의-0 에너지 광자(λ→∞ 폭주 후보)도
  //     바스로 흡수해 정리한다(검토 잔여 q→0 의 실용적 해소 — in-scatter λ 클램프는 별도 step 전가).
  //   국소: 광자 *혼자*의 나이·에너지로 판정(이웃·전역 조율자 0). 노브=0 → early-return = 회귀 0.
  function escape(sim) {
    const k = sim.knobs.kEscape;
    if (!k) return;                                  // 노브=0 → early-return = 회귀 0 (binning 꺼짐 → 직전 비트)
    const ageMax = sim.knobs.escapeAge || 1e9;       // 미설정 → 사실상 무한(나이로 안 뺌)
    const eMin = sim.knobs.escapeEmin || 0;          // 미설정 → 0(저에너지로 안 뺌, 광자 E>0)
    const bath = sim.escaped || (sim.escaped = { E: 0, px: 0, py: 0, count: 0 });
    const keep = [];
    for (const p of sim.photons) {
      if ((sim.tick - p.birth) >= ageMax || p.E <= eMin) {
        bath.E += p.E; bath.px += p.px || 0; bath.py += p.py || 0; bath.count++;  // 바스로 *이전*(E·운동량 정확 보존)
        p.src = null;                                // 발원 원자 참조 해제(검토 잔여 — 빠진 광자 GC 허용, hash·ledger 무관)
      } else {
        keep.push(p);                                // 살아남은 활성 광자(나이 < escapeAge)
      }
    }
    sim.photons = keep;                              // 활성 배열 = 살아남은 광자만(유계)
  }

  // 복사 바스 되먹임 = 재가열 (step-0008, *느린 순환 닫기*). step-0007 이 *모으기만* 한 복사 바스
  // sim.escaped 의 에너지를 원자로 *되돌려* 들뜸(x)을 재공급한다 — 단조 냉각/소멸을 SPINE §4 "순환"으로.
  //   왜 들뜸(운동량-자유)인가: 바스는 E 와 운동량 px·py 를 함께 인다. 등방 복사라 |p_바스| ≤ E_바스(c=1) →
  //     *운동량-자유 잉여* surplus = E_바스 − |p_바스| ≥ 0 이 항상 있다. 이 잉여만 한 준위 비용 G 로 뽑아
  //     원자 들뜸에 실으면(thermalized 흡수 — 사방 흡수가 net 반동 상쇄), 바스 운동량 px·py 불변.
  //   닫힌 장부: bath.E ↓ G = 원자 들뜸 E ↑ G (정확 쌍 거래), 운동량 양쪽 불변 ⇒ Q·B·L·E·px·py 보존.
  //     바스가 음에너지/비물리(E<|p|)로 가지 않게 G ≤ surplus 일 때만 흡수 → 흡수 후도 E ≥ |p| 유지.
  //   순환: 들뜸 → 방출(emit) → 광자 → 노화 → 바스(escape) → 들뜸(reheat) … 루프가 닫힌다(self-running 씨앗).
  //   국소: 원자 *혼자* + 바스 집계로 판정(원자-원자 조율자 0). 결정론: 확률 kReheat 는 sim.rng 만. 노브=0 → 회귀 0.
  function reheat(sim) {
    const k = sim.knobs.kReheat;
    if (!k) return;                  // 노브=0 → early-return = 회귀 0 (재가열 꺼짐 → 직전 비트)
    const rng = sim.rng;
    if (!rng) return;                // 의사난수 없으면 확률 판정 불가(Math.random 금지 — 결정론)
    const bath = sim.escaped;
    if (!bath || bath.E <= 0) return;                     // 줄 에너지 없음(바스 빔)
    const xMax = sim.knobs.reheatXMax || 6;               // 준위 상한(이온화 영역 밖)
    const lz = sim.knobs.levelZ;                          // 준위 Z 의존(step-0013, 0 → levelE = 회귀 0)
    for (const a of sim.atoms) {
      if (rng() >= k) continue;                           // 확률 kReheat 재흡수 시도
      const x = a.x | 0;
      if (x >= xMax) continue;                            // 고준위 포화
      const G = K.levelEZ(x + 1, a.Z, a.e, lz) - K.levelEZ(x, a.Z, a.e, lz);  // 한 준위 ↑ 데우는 비용(lz=0 → levelE)
      const surplus = bath.E - Math.hypot(bath.px, bath.py);  // 운동량-자유 잉여(≥0, c=1)
      if (G > surplus) continue;                          // 줄 운동량-자유 에너지 부족
      bath.E -= G;                                        // 바스 에너지 차감(되돌림)
      a.x = x + 1;                                         // 원자 한 준위 재여기(데움)
      bath.reheated = (bath.reheated | 0) + 1;            // 재가열 횟수(진단·hash 미참여)
    }
  }

  // 탄성 2체 충돌 = 첫 원자-원자 상호작용 (step-0009, *Phase C 의 문*). 지금까지 원자-원자
  // 상호작용은 0(빛 매개만)이었다. 접촉 반경 collideR 안에서 *서로 다가오는* 원자 쌍이 충돌 법선(중심선)
  // 방향으로 탄성 충돌한다 — 운동량을 *교환*하되 총 운동량·총 KE 를 *정확히* 보존(닫힌 형식, 머신 정밀도).
  //   왜 충돌(연속 쿨롱 아님)인가: 연속 보존력(쿨롱 1/r²)을 동결 적분기(반음시 오일러)로 풀면 O(dt²)
  //     에너지 드리프트가 생겨 1e-9 정밀 장부를 못 맞춘다. HGO 전 법칙처럼 *닫힌 형식 교환*(KE·p 정확)
  //     인 탄성 충돌이 첫 직접 상호작용으로 정합 — 쿨롱장(PE 항·심플렉틱 적분 필요)은 별도 step 전가.
  //   닫힌 장부: 임펄스 j=2μ·vn(μ=환원질량) 을 법선 n 으로 — Δp_a=−j·n, Δp_b=+j·n ⇒ 총 운동량 불변,
  //     법선 상대속도 부호만 반전(|v_n| 보존) ⇒ 총 KE 불변(탄성). 멀어지는 쌍(vn≤0)은 건너뜀(겹침 중복·끈적임 방지).
  //   국소: *그 두 원자*만으로 판정(전역 조율자 0, 토러스 min-image 거리). 결정론: rng 불필요(위치·속도 결정).
  //   순환: 운동량이 빠른 원자→느린 원자로 퍼져 *열화·확산*(SPINE §3 요건2 운동E=온도) — 결합·분자의 토대.
  function collide(sim) {
    const k = sim.knobs.kCollide;
    if (!k) return;                  // 노브=0 → early-return = 회귀 0 (충돌 항 꺼짐 → 직전 비트)
    const R = sim.knobs.collideR || 3, R2 = R * R;
    const atoms = sim.atoms, n = atoms.length;
    for (let i = 0; i < n; i++) {
      const a = atoms[i];
      for (let j = i + 1; j < n; j++) {
        const b = atoms[j];
        const dx = K.minImage(b.rx - a.rx, sim.W), dy = K.minImage(b.ry - a.ry, sim.H);
        const d2 = dx * dx + dy * dy;
        if (d2 > R2 || d2 === 0) continue;                 // 접촉 반경 밖(또는 완전 겹침 — 0 나눗셈 가드)
        const d = Math.sqrt(d2), nx = dx / d, ny = dy / d;  // 충돌 법선(a→b 단위 벡터)
        const vn = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny; // 상대속도의 법선 성분(>0 = 다가옴)
        if (vn <= 0) continue;                              // 멀어지는/접선 → 충돌 안 함(겹침 중복 방지)
        const ma = K.mass(a), mb = K.mass(b);
        const imp = 2 * vn / (ma + mb);                     // 탄성 임펄스 계수(= 2vn/(ma+mb))
        a.vx -= imp * mb * nx; a.vy -= imp * mb * ny;        // Δv_a = −2 m_b/(m_a+m_b)·vn·n
        b.vx += imp * ma * nx; b.vy += imp * ma * ny;        // Δv_b = +2 m_a/(m_a+m_b)·vn·n (총 p·KE 보존)
        sim.collideCount = (sim.collideCount | 0) + 1;       // 진단 카운터(hash 미참여)
      }
    }
  }

  // 이온결합 = 첫 *비탄성* 원자-원자 상호작용 (step-0010, *분자의 씨앗*). step-0009 충돌은 탄성(튕김)뿐 —
  // 원자는 만나도 다시 흩어졌다. 결합은 *느리게 다가오는 반대 전하* 쌍(q_a·q_b<0, 쿨롱 끌림)을 *포획*한다:
  // 상대 운동을 완전 흡수(perfectly inelastic)해 둘을 질량중심 속도로 잠그고(va=vb=vcom → 같이 움직임) 결합으로 묶는다.
  //   닫힌 장부: 흡수된 상대 KE(½μ|v_a−v_b|²)는 사라지지 않고 *결합 E reservoir* sim.bondE 로 park —
  //     총 운동량(vcom 가중 → 정확)·총 E(KE 감소분 = bondE 증가분) 정확 보존. step-0007 광자→바스 binning 과 동형 회계.
  //   분자 = author 한 객체가 아니라 *결합 간선의 연결 성분*으로 측정(SPINE §3 요건1) — 법칙은 간선만 기록, 분자는 장면이 센다.
  //   선택성(창발): 끌림은 *반대 전하만*. 같은 전하/중성은 결합 안 하고 collide 로 탄성 튕김(author `if(isMolecule)` 0).
  //     게다가 빠른 쌍(|v_rel|>bondVmax)은 포획 못 하고 튕김 → *온도 의존 결합*(차가운 이온만 묶임)이 식에서 창발.
  //   국소: *그 두 원자*만으로 판정(전역 조율자 0, min-image). 결정론: 위치·속도·전하 결정 → rng 불필요.
  //   collide 와의 정합: bond 가 먼저 돌아 상대속도를 0 으로 잠그면 뒤따르는 collide 는 vn≤0 으로 그 쌍을 건너뜀(중복 0).
  //   ⊕ step-0012 게이트 `bondValence`(=0 → 무제한·이전 비트 동일): 원자당 결합 수를 *원자가 = |Z−e|*(전하 다발서
  //     창발, author 0)로 제한 → ±1 이온은 cap 1 → 이량체만(과응집 blob 해소). step-0006 scatterAngular 정밀화와 동형 게이트.
  function bond(sim) {
    const k = sim.knobs.kBond;
    if (!k) return;                  // 노브=0 → early-return = 회귀 0 (결합 항 꺼짐 → 직전 비트)
    const R = sim.knobs.bondR || 3, R2 = R * R;
    const vmax = sim.knobs.bondVmax || 1.5, vmax2 = vmax * vmax;  // 이 상대속력 미만에서만 포획
    if (!sim.bonds) { sim.bonds = []; sim.bondKeys = new Set(); }  // 결합 간선 장부(미존재→지연 초기화)
    const atoms = sim.atoms, n = atoms.length;
    const vcap = sim.knobs.bondValence || 0;             // 원자가 한계 게이트(0=무제한 → step-0010/0011 비트 동일)
    let deg = null;
    if (vcap) { deg = new Array(n).fill(0); for (const e of sim.bonds) { deg[e[0]]++; deg[e[1]]++; } }  // 현 결합 차수(이전 tick 누적)
    for (let i = 0; i < n; i++) {
      const a = atoms[i];
      for (let j = i + 1; j < n; j++) {
        const key = i * n + j;
        if (sim.bondKeys.has(key)) continue;                 // 이미 결합 — 재포획·이중 흡수 금지
        const b = atoms[j];
        if ((a.Z - a.e) * (b.Z - b.e) >= 0) continue;        // 반대 전하만 끌림(같은 전하/중성 → collide 탄성)
        if (vcap && (deg[i] >= Math.abs(a.Z - a.e) || deg[j] >= Math.abs(b.Z - b.e))) continue;  // 원자가 포화 → 결합 안 함(collide 탄성)
        const dx = K.minImage(b.rx - a.rx, sim.W), dy = K.minImage(b.ry - a.ry, sim.H);
        const d2 = dx * dx + dy * dy;
        if (d2 > R2 || d2 === 0) continue;                   // 접촉 반경 밖(또는 완전 겹침 가드)
        const d = Math.sqrt(d2), nx = dx / d, ny = dy / d;   // 결합 법선(a→b 단위 벡터)
        const dvx = a.vx - b.vx, dvy = a.vy - b.vy;
        const vn = dvx * nx + dvy * ny;                      // 상대속도 법선 성분(>0 = 다가옴)
        if (vn <= 0) continue;                               // 멀어지는/접선 → 포획 안 함
        if (dvx * dvx + dvy * dvy > vmax2) continue;         // 너무 빠르면 포획 못 함(탄성 튕김은 collide 몫)
        const ma = K.mass(a), mb = K.mass(b), M = ma + mb;
        const vcx = (ma * a.vx + mb * b.vx) / M, vcy = (ma * a.vy + mb * b.vy) / M;  // 질량중심 속도
        // 흡수한 상대 KE = KE_before − KE_after(질량중심) ≥0 → 결합 E reservoir 로 park (총 E·운동량 보존)
        const keBefore = 0.5 * ma * (a.vx * a.vx + a.vy * a.vy) + 0.5 * mb * (b.vx * b.vx + b.vy * b.vy);
        const keAfter = 0.5 * M * (vcx * vcx + vcy * vcy);
        a.vx = vcx; a.vy = vcy; b.vx = vcx; b.vy = vcy;      // 질량중심 속도로 잠금 → 같이 움직임(공간 결합 유지)
        sim.bondE = (sim.bondE || 0) + (keBefore - keAfter); // 흡수 KE park(닫힌 장부)
        sim.bonds.push([i, j]); sim.bondKeys.add(key);
        if (vcap) { deg[i]++; deg[j]++; }                   // 차수 갱신(같은 tick 내 후속 쌍이 포화 보게)
        sim.bondCount = (sim.bondCount | 0) + 1;             // 진단 카운터(결합 간선은 hash 참여)
      }
    }
  }

  // 화학발광 = 결합 에너지가 빛이 된다 (step-0011, *bondE reservoir 의 방출*). step-0010 bond 는 흡수한 상대
  // KE 를 sim.bondE 에 *모으기만* 했다(escape 가 광자를 바스에 모으기만 한 것과 동형). chemilum 법칙(노브 kChemilum)이
  // 그 결합 E 를 *결합한 원자의 전자 들뜸(x)* 으로 되돌린다 — 들뜬 원자는 emit(0002)이 광자로 낸다.
  //   ⇒ 사슬: bond(상대 KE→bondE) → chemilum(bondE→들뜸) → emit(들뜸→광자 λ=hc/ΔE). *결합 에너지가 빛으로 새어나온다*(화학발광 토이, render 신호).
  //   왜 들뜸(운동량-자유)인가: bondE 는 스칼라 reservoir(운동량 0). 한 준위 비용 G 만큼 bondE 에서 빼 원자 들뜸에
  //     실으면 운동량 불변·E 정확 보존(reheat 의 바스→들뜸과 동형 — 단 *출처가 화학 결합*·*대상이 결합 원자*).
  //   선택성·국소: 결합에 참여한 원자만 빛난다(그 결합 reservoir 가 그 원자들의 것). 비결합 원자 0 — 결합 간선으로 판정(전역 조율자 0).
  //   닫힌 장부: sim.bondE ↓ G = 원자 들뜸 E ↑ G (정확 쌍 거래), 운동량 불변 ⇒ Q·B·L·E·px·py 보존. 노브=0 → 회귀 0.
  function chemilum(sim) {
    const k = sim.knobs.kChemilum;
    if (!k) return;                  // 노브=0 → early-return = 회귀 0 (화학발광 꺼짐 → 직전 비트)
    const rng = sim.rng;
    if (!rng) return;                // 의사난수 없으면 확률 판정 불가(Math.random 금지 — 결정론)
    if (!sim.bondE || sim.bondE <= 0) return;            // 줄 결합 에너지 없음
    if (!sim.bonds || !sim.bonds.length) return;         // 결합(빛날 원자) 없음
    const bonded = new Set();
    for (const e of sim.bonds) { bonded.add(e[0]); bonded.add(e[1]); }  // 결합 참여 원자 집합
    const xMax = sim.knobs.chemilumXMax || 6;            // 준위 상한(이온화 영역 밖)
    const lz = sim.knobs.levelZ;                          // 준위 Z 의존(step-0013, 0 → levelE = 회귀 0)
    const atoms = sim.atoms, n = atoms.length;
    for (let i = 0; i < n; i++) {
      if (!bonded.has(i)) continue;                      // *결합한 원자만* 화학발광(선택성·국소)
      if (rng() >= k) continue;                          // 확률 kChemilum 발광 시도
      const a = atoms[i], x = a.x | 0;
      if (x >= xMax) continue;                            // 고준위 포화
      const G = K.levelEZ(x + 1, a.Z, a.e, lz) - K.levelEZ(x, a.Z, a.e, lz);  // 한 준위 ↑ 데우는 비용(lz=0 → levelE)
      if (G > sim.bondE) continue;                        // 결합 E 부족
      sim.bondE -= G;                                     // 결합 reservoir 차감(빛으로 새어나감)
      a.x = x + 1;                                        // 결합 원자 한 준위 재여기(이후 emit 가 광자로)
      sim.chemilumCount = (sim.chemilumCount | 0) + 1;    // 화학발광 횟수(진단·hash 미참여)
    }
  }

  // 힘/상호작용 법칙 레지스트리 + 실행 순서. append-only — 노브=0 → 회귀 0.
  const LAWS = { emit, recoil, propagate, scatter, escape, reheat, bond, chemilum, collide };
  const LAW_ORDER = ['emit', 'recoil', 'propagate', 'scatter', 'escape', 'reheat', 'bond', 'chemilum', 'collide'];

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
