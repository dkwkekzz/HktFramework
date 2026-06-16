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
  const DEFAULTS = { dt: 1.0, kEmit: 0, kRecoil: 0, kProp: 0, kScatter: 0, scatterAngular: 0, kEscape: 0, kReheat: 0, kCollide: 0, kBond: 0, kChemilum: 0, levelZ: 0, levelScreen: 0, bondLocalE: 0, kUnbond: 0, bondCovalent: 0, bondOrder: 0, kCoulomb: 0, coulombSoft: 1, kRepulse: 0, bondCoulombic: 0, kPauli: 0, kVdW: 0, kDamp: 0, kBondSpring: 0, bondReq: 4, kBondAngle: 0, bondAngleTarget: 2.0943951023931953, kGravity: 0, kDecay: 0, decayNexcess: 4, decayQ: 1, decayRecoilPair: 0, decayRateExcess: 0, decayMassFormula: 0, decayBetaPlus: 0, decayPairing: 0, decaySargent: 0, decayQref: 1, massDefect: 0, kFuse: 0, fuseR: 3, fuseBarrier: 0, fuseQ: 0, fuseMassFormula: 0 };

  // 외각 껍질 빈자리(step-0017 공유결합) = 다음 *닫힌 껍질* 전자수까지 부족분. author 한 원자가 0 — e 다발 + 마법수에서 창발.
  //   닫힌 껍질(noble) 전자수 [2,10,18,36] (He·Ne·Ar·Kr) — 옥텟 규칙의 토이. 중성 원소가 제 빈자리만큼 결합:
  //   H(e1)→1·He(e2)→0(noble·비활성)·C(e6)→4·O(e8)→2 = 실제 원자가가 e+마법수에서 그대로 나온다(SPINE §3 요건1·4).
  const SHELL_MAGIC = [2, 10, 18, 36];
  function covVacancy(e) { for (const m of SHELL_MAGIC) if (e < m) return m - e; return 0; }  // 0 = 이미 닫힌 껍질(또는 초과)


  // 자발 방출(step-0002): 들뜬 원자(x>0)가 확률 kEmit 로 한 준위 강하 → 광자 1개.
  //   닫힌 장부: 원자 들뜸 E ↓ = 광자 E ↑ (정확 쌍 거래, ΔE = levelE(x)−levelE(x−1)).
  //   국소: 그 원자 *혼자*로 판정(이웃·전역 조율자 0). 결정론: sim.rng(시드 의사난수)만.
  function emit(sim) {
    const k = sim.knobs.kEmit;
    if (!k) return;                  // 노브=0 → early-return = 회귀 0 (방출 항 꺼짐 → 직전 비트)
    const rng = sim.rng;
    if (!rng) return;                // 런타임 의사난수 없으면 방출 불가(Math.random 금지 — 결정론)
    const lz = sim.knobs.levelZ, sc = sim.knobs.levelScreen;  // 준위 Z 의존·다전자 차폐(0 → levelE = 회귀 0)
    for (const a of sim.atoms) {
      if ((a.x | 0) <= 0) continue;            // 바닥 상태는 방출 안 함
      if (rng() >= k) continue;                // 자발 방출 확률 kEmit
      const x0 = a.x | 0, x1 = x0 - 1;
      const dE = K.levelEZ(x0, a.Z, a.e, lz, sc) - K.levelEZ(x1, a.Z, a.e, lz, sc);  // 준위 차 = 광자 에너지 (λ author 안 함; lz=0 → levelE)
      a.x = x1;                                 // 한 준위 강하 (들뜸 E ↓)
      //  px·py: 광자 운동량(recoil 법칙이 채움) · src: 반동 줄 원자 · recoiled: 반동 처리 플래그.
      //  rx0·ry0·birth: 방출 위치·시각(propagate 검증용). E0·nscatter: 방출 에너지·산란 횟수(scatter 검증용). srcZ·srcE: 발원 원소 Z·전자수(step-0013·0014 스펙트럼 검증). hash 미참여.
      //  recoil 꺼짐(kRecoil=0)이면 px=py=0 으로 남아 장부 운동량 0 가법 → step-0002 비트 동일.
      sim.photons.push({ E: dE, lambda: K.photonLambda(dE), rx: a.rx, ry: a.ry, rx0: a.rx, ry0: a.ry, birth: sim.tick, from: x0, to: x1, px: 0, py: 0, src: a, recoiled: false, E0: dE, nscatter: 0, srcZ: a.Z, srcE: a.e });
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
    const lz = sim.knobs.levelZ, sc = sim.knobs.levelScreen;  // 준위 Z 의존·다전자 차폐(0 → levelE = 회귀 0)
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
        const G = K.levelEZ(x + 1, a.Z, a.e, lz, sc) - K.levelEZ(x, a.Z, a.e, lz, sc);  // 한 준위 ↑ 들뜸 비용(lz=0 → levelE)
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
    const lz = sim.knobs.levelZ, sc = sim.knobs.levelScreen;  // 준위 Z 의존·다전자 차폐(0 → levelE = 회귀 0)
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
      const a = sim.atoms[best], x = a.x | 0, G = K.levelEZ(x + 1, a.Z, a.e, lz, sc) - K.levelEZ(x, a.Z, a.e, lz, sc), m = K.mass(a);
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
    const lz = sim.knobs.levelZ, sc = sim.knobs.levelScreen;  // 준위 Z 의존·다전자 차폐(0 → levelE = 회귀 0)
    for (const a of sim.atoms) {
      if (rng() >= k) continue;                           // 확률 kReheat 재흡수 시도
      const x = a.x | 0;
      if (x >= xMax) continue;                            // 고준위 포화
      const G = K.levelEZ(x + 1, a.Z, a.e, lz, sc) - K.levelEZ(x, a.Z, a.e, lz, sc);  // 한 준위 ↑ 데우는 비용(lz=0 → levelE)
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
  //   ⊕ step-0017 게이트 `bondCovalent`(=0 → 이온결합만·step-0016 비트 동일): *둘째 선택성*을 더한다 — 반대 전하(이온)가
  //     아닌 *중성*(q=0) 원자 쌍이 *외각 껍질 빈자리*(covVacancy)를 공유해 결합한다. 이온=전자 전이(반대 전하), 공유=전자 공유(중성).
  //     공유 원자가 = 빈자리(H1·C4·O2·He0) → 결합 수 한계가 *e 다발*서 창발(author 0). 포획·reservoir 는 이온과 동일 기계 재사용.
  //   ⊕ step-0018 게이트 `bondOrder`(=0 → 단일 결합만·step-0017 비트 동일): 공유 쌍이 *남은 빈자리만큼* 전자쌍을 다중 공유한다.
  //     차수 = min(남은 빈자리, ordMax) → O=O 이중·N≡N 삼중. 간선에 차수 e[3] 기록·빈자리 order 칸 소비 → 화학량론(O₂·N₂ 고립 이량체)이 창발.
  function bond(sim) {
    const k = sim.knobs.kBond;
    if (!k) return;                  // 노브=0 → early-return = 회귀 0 (결합 항 꺼짐 → 직전 비트)
    const R = sim.knobs.bondR || 3, R2 = R * R;
    const vmax = sim.knobs.bondVmax || 1.5, vmax2 = vmax * vmax;  // 이 상대속력 미만에서만 포획
    if (!sim.bonds) { sim.bonds = []; sim.bondKeys = new Set(); }  // 결합 간선 장부(미존재→지연 초기화)
    const atoms = sim.atoms, n = atoms.length;
    const vcap = sim.knobs.bondValence || 0;             // 원자가 한계 게이트(0=무제한 → step-0010/0011 비트 동일)
    const cov = sim.knobs.bondCovalent || 0;             // 공유결합 게이트(0 → 이온만, step-0016 비트 동일)
    const ord = sim.knobs.bondOrder || 0;                // 결합 차수 게이트(0 → 단일 결합만, step-0017 비트 동일)
    const ordMax = sim.knobs.bondOrderMax || 3;          // 최대 차수(삼중 N≡N 까지)
    let deg = null;
    if (vcap || cov) { deg = new Array(n).fill(0); for (const e of sim.bonds) { const o = e[3] || 1; deg[e[0]] += o; deg[e[1]] += o; } }  // 현 결합 차수(order 가중 — 이중=2칸 소비)
    for (let i = 0; i < n; i++) {
      const a = atoms[i];
      for (let j = i + 1; j < n; j++) {
        const key = i * n + j;
        if (sim.bondKeys.has(key)) continue;                 // 이미 결합 — 재포획·이중 흡수 금지
        const b = atoms[j];
        const qa = a.Z - a.e, qb = b.Z - b.e;
        let order = 1;                                       // 결합 차수(기본 단일 — bondOrder=0 이면 불변)
        if (qa * qb < 0) {                                   // ── 이온결합: 반대 전하 끌림(기존 경로) ──
          if (vcap && (deg[i] >= Math.abs(qa) || deg[j] >= Math.abs(qb))) continue;  // 원자가 포화 → 결합 안 함(collide 탄성)
        } else {                                             // ── 반대 전하 아님 → 이온 불가 ──
          if (!cov) continue;                                // 게이트 off → 기존처럼 skip(같은 전하/중성, 회귀 0)
          if (qa !== 0 || qb !== 0) continue;                // 공유는 *중성 원자만*(같은부호 이온은 반발 → collide 탄성)
          const va = covVacancy(a.e), vb = covVacancy(b.e);  // 외각 껍질 빈자리(다음 닫힌 껍질까지)
          if (va <= 0 || vb <= 0) continue;                  // 한쪽이라도 껍질 채움(noble, 예: He) → 공유 안 함
          if (deg[i] >= va || deg[j] >= vb) continue;        // 공유 원자가 포화(빈자리 = 결합 수 한계 — e 다발서 창발)
          // step-0018 게이트 bondOrder(=0 → 단일·step-0017 비트 동일): *같은 쌍*이 남은 빈자리만큼 전자쌍 다중 공유.
          //   차수 = min(남은 빈자리 i, 남은 빈자리 j, ordMax) → O(빈자리2)+O = O=O 이중·N(빈자리3)+N = N≡N 삼중. 화학량론이 빈자리서 창발.
          if (ord) order = Math.min(va - deg[i], vb - deg[j], ordMax);
        }
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
        // ⊕ step-0021 게이트 bondCoulombic(=0 → 비탄성 vcom 잠금·step-0020 비트 동일): 켜면 *속도잠금·KE흡수를 건너뛰고*
        //   간선(위상)만 기록한다. 이미 작동 중인 coulomb+repulse(하전 쌍)가 그 결합을 r_eq 로 *유지* → 결합쌍이 r_eq 주위로 진동
        //   (위상→기하 완성: bond 가 거리까지 잠그던 "괴이함"을 연속력 평형으로 대체). 포획 시 속도 불변·bondE 불변 ⇒ *에너지 연속*
        //   (불연속 0·새 PE 항 불필요 — 쿨롱+코어 PE 는 이미 ledger). 단 하전(이온) 결합에만 유효 — 중성 공유결합은 유지력 없음(후속).
        const coulombic = sim.knobs.bondCoulombic || 0;
        // 흡수한 상대 KE = KE_before − KE_after(질량중심) ≥0 → 결합 E reservoir 로 park (총 E·운동량 보존)
        const keBefore = 0.5 * ma * (a.vx * a.vx + a.vy * a.vy) + 0.5 * mb * (b.vx * b.vx + b.vy * b.vy);
        const keAfter = 0.5 * M * (vcx * vcx + vcy * vcy);
        let absorbed = 0;
        if (!coulombic) {                                    // 기존: 비탄성 vcom 잠금 → 위상만(거리 미유지, 충돌·반동에 흩어짐)
          a.vx = vcx; a.vy = vcy; b.vx = vcx; b.vy = vcy;    // 질량중심 속도로 잠금 → 같이 움직임
          absorbed = keBefore - keAfter;                     // 흡수 상대 KE
          sim.bondE = (sim.bondE || 0) + absorbed;           // 흡수 KE park(닫힌 장부, 전역 합 = Σ 결합별 E)
        }
        // coulombic: 속도·bondE 불변 → 에너지 연속. 간선은 위상 라벨, 기하(r_eq)는 coulomb+repulse 가 창발 유지.
        // step-0015 게이트 bondLocalE(=0 → 이전 비트 동일): 흡수 E 를 *그 결합 간선*에 per-bond 저장([i,j,Eabs]).
        //   전역 sim.bondE 는 그대로 두되(ledger 가 읽음·불변) 결합별 e[2] 가 그 합을 분해 → 어느 결합 E 인지 국소 추적(unbond·핵 회계 토대).
        const edge = sim.knobs.bondLocalE ? [i, j, absorbed] : [i, j];
        if (ord) { if (edge.length < 3) edge.push(0); edge[3] = order; }  // 차수 기록(미설정→e[3]||1=단일·회귀 0). E 슬롯 없으면 0 채워 희소 구멍 방지
        sim.bonds.push(edge);
        sim.bondKeys.add(key);
        if (vcap || cov) { deg[i] += order; deg[j] += order; }  // 차수 갱신(order 가중 — 이중 결합은 빈자리 2칸 소비)
        sim.bondCount = (sim.bondCount | 0) + 1;             // 진단 카운터(결합 간선은 hash 참여)
        if (qa === 0 && qb === 0) sim.covalentCount = (sim.covalentCount | 0) + 1;  // 공유결합 횟수(중성 쌍 = 공유, 진단·hash 미참여)
        if (order >= 2) sim.multiBondCount = (sim.multiBondCount | 0) + 1;  // 다중 결합(이중·삼중) 횟수(진단·hash 미참여)
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
    const lz = sim.knobs.levelZ, sc = sim.knobs.levelScreen;  // 준위 Z 의존·다전자 차폐(0 → levelE = 회귀 0)
    const local = sim.knobs.bondLocalE;                  // step-0015 게이트: 결합별 E 장부서 인출(0 → 전역 풀, 이전 비트 동일)
    const atoms = sim.atoms, n = atoms.length;
    for (let i = 0; i < n; i++) {
      if (!bonded.has(i)) continue;                      // *결합한 원자만* 화학발광(선택성·국소)
      if (rng() >= k) continue;                          // 확률 kChemilum 발광 시도
      const a = atoms[i], x = a.x | 0;
      if (x >= xMax) continue;                            // 고준위 포화
      const G = K.levelEZ(x + 1, a.Z, a.e, lz, sc) - K.levelEZ(x, a.Z, a.e, lz, sc);  // 한 준위 ↑ 데우는 비용(lz=0 → levelE)
      if (local) {
        // 국소 인출: *그 원자의 결합* 중 E 충분한 첫 간선서 차감(배열 순 → 결정론). 전역 합도 동기 차감(Σe[2]=bondE 불변).
        let be = null;
        for (const e of sim.bonds) { if ((e[0] === i || e[1] === i) && (e[2] || 0) >= G) { be = e; break; } }
        if (!be) continue;                                // 이 원자의 어느 결합도 E 부족
        be[2] -= G; sim.bondE -= G;                        // 그 결합 E 차감(국소) + 전역 합 동기
        sim.bondLocalDebit = (sim.bondLocalDebit | 0) + 1; // 국소 인출 횟수(진단·hash 미참여)
      } else {
        if (G > sim.bondE) continue;                       // 결합 E 부족(전역 풀)
        sim.bondE -= G;                                    // 결합 reservoir 차감(빛으로 새어나감)
      }
      a.x = x + 1;                                        // 결합 원자 한 준위 재여기(이후 emit 가 광자로)
      sim.chemilumCount = (sim.chemilumCount | 0) + 1;    // 화학발광 횟수(진단·hash 미참여)
    }
  }

  // 결합 깸 = bond 의 정확한 역연산 (step-0016, *영구 결합의 해방*). step-0010 bond 는 상대 KE 를 흡수해
  // 두 원자를 질량중심 속도로 잠갔다 — 이량체는 *영구*였다(한 번 묶이면 안 풀림). 하지만 외부 충돌(collide)이
  // 결합 원자 하나를 때리면 두 원자의 상대속도가 다시 살아난다(va≠vb). 그 *상대 KE 가 그 결합에 저장된 e[2]*
  // 를 넘으면 결합이 끊긴다 — 충분히 흔들린 결합만 깬다(약한 결합·뜨거운 환경서 먼저 깸).
  //   닫힌 장부(bond 의 정확한 역): 저장 결합 E e[2] 를 *상대 운동으로 정확히 돌려준다*. 운동량 보존: 질량중심
  //     속도 vcom 은 불변, 상대속도만 |v_rel'|²=|v_rel|²+2·e[2]/μ 로 확대(같은 방향) → Δp=0·ΔE=0
  //     (전역 bondE↓e[2] = 상대 KE↑e[2]). step-0015 결합별 장부 e[2] 가 "얼마 돌려줄지"를 정확히 안다.
  //   트리거(창발): ½μ|v_rel|² > e[2] — author `if(shouldBreak)` 0, 조건은 *측정된 상대 KE 대 저장 E* 비교뿐.
  //     깬 뒤 상대속도가 커져(에너지 방출) bondVmax 를 넘으면 bond 가 재포획 못 함 → 즉시 재결합 thrash 회피.
  //   국소: *그 두 원자 + 그 결합*만으로 판정(전역 조율자 0). 결정론: 위치·속도·e[2] 결정 → rng 불필요.
  //   게이트 kUnbond(=0 → early-return = 회귀 0): 끄면 step-0015 비트 동일. bondLocalE 필요(e[2] = 돌려줄 E 의 출처).
  function unbond(sim) {
    const k = sim.knobs.kUnbond;
    if (!k) return;                  // 노브=0 → early-return = 회귀 0 (결합 깸 꺼짐 → 직전 비트)
    if (!sim.bonds || !sim.bonds.length) return;         // 깰 결합 없음
    const atoms = sim.atoms, n = atoms.length;
    const kept = [];                 // 살아남는 결합(재구성 — 깬 간선 제거)
    let broke = 0;
    for (const e of sim.bonds) {
      const Estored = e[2] || 0;     // 저장 결합 E (bondLocalE 꺼졌으면 0 → 못 깸 = 게이트 의존)
      if (Estored <= 0) { kept.push(e); continue; }
      const i = e[0], j = e[1], a = atoms[i], b = atoms[j];
      const ma = K.mass(a), mb = K.mass(b), M = ma + mb, mu = ma * mb / M;
      const dvx = a.vx - b.vx, dvy = a.vy - b.vy;
      const vrel2 = dvx * dvx + dvy * dvy;
      if (0.5 * mu * vrel2 <= Estored) { kept.push(e); continue; }  // 상대 KE ≤ 저장 E → 아직 약하게 흔들림, 결합 유지
      // 깸: 저장 E 를 상대 운동으로 돌려줌(vcom 불변 → 운동량 보존, v_rel 확대 → ΔKE = +Estored)
      const vcx = (ma * a.vx + mb * b.vx) / M, vcy = (ma * a.vy + mb * b.vy) / M;
      const scale = Math.sqrt((vrel2 + 2 * Estored / mu) / vrel2);  // |v_rel'|/|v_rel| (vrel2>0 보장 — 위 비교)
      const rvx = dvx * scale, rvy = dvy * scale;        // 확대된 상대속도(같은 방향 → 서로 더 밀어냄)
      a.vx = vcx + (mb / M) * rvx; a.vy = vcy + (mb / M) * rvy;
      b.vx = vcx - (ma / M) * rvx; b.vy = vcy - (ma / M) * rvy;
      sim.bondE -= Estored;          // 전역 reservoir 동기 차감(Σe[2]=bondE 불변 유지)
      sim.bondKeys.delete(i * n + j); // bondKey 제거 → bond 재포획 허용(단 빨라서 bondVmax 초과 → 실질 회피)
      broke++;
    }
    if (broke) { sim.bonds = kept; sim.unbondCount = (sim.unbondCount | 0) + broke; }  // 간선 장부 교체 + 진단 카운터(hash 미참여)
  }

  // 쿨롱장 = 첫 *연속* 보존력 (step-0019, *공간 결합력 — 기하의 근원*). 지금까지 모든 상호작용은
  // *닫힌 형식 이산 교환*(collide·bond·unbond — 순간 속도 편집)이라 결합엔 *평형 길이·각도*가 없었다:
  // bond 는 포획 *순간* 거리에 속도만 잠갔을 뿐(STATE 후보 B·step-0015 "괴이한 기하"의 근본 원인).
  // coulomb 은 *거리 의존* 힘 F = kC·qa·qb/r² 를 매 tick 속도에 싣는다 — 같은부호 반발·반대부호 인력.
  //   왜 이제 가능한가: step()=applyForces(v 갱신)→integrate(새 v 로 r) 가 *반음시(symplectic) 오일러*라
  //     에너지(KE+PE)가 *유계 진동*으로 보존된다(secular drift 0). 단 머신 0(1e-9)은 아님 — 연속 적분의 O(dt²)
  //     진동(STATE 경고). ⇒ ledger 에 *PE 항*(kernel 가법, kCoulomb 게이트)을 더하고 그 장면만 E 허용오차 완화.
  //   연화(Plummer) ε: r²→r²+ε² 로 특이점·무한 PE 차단(U=kC·qa·qb/√(r²+ε²), F=−∇U 정확 보존력). ε 가 짧은 길이 척도.
  //   닫힌 장부: 쌍별 등·반작용(Δp_a=+f·dt, Δp_b=−f·dt) ⇒ 총 운동량 *정확* 보존(머신 0). Q·B·L·x 불변(쿨롱은 전하 위치만 바꿈).
  //   국소: *그 두 하전 원자*만(min-image). 결정론: 위치·전하 결정 → rng 불필요. 게이트 kCoulomb=0 → early-return = 회귀 0.
  function coulomb(sim) {
    const kc = sim.knobs.kCoulomb;
    if (!kc) return;                 // 노브=0 → early-return = 회귀 0 (연속력 꺼짐 → 직전 비트)
    const dt = sim.knobs.dt;
    const eps2 = (sim.knobs.coulombSoft || 1) * (sim.knobs.coulombSoft || 1);  // 연화 길이²(특이점 차단)
    const atoms = sim.atoms, n = atoms.length;
    for (let i = 0; i < n; i++) {
      const a = atoms[i], qa = a.Z - a.e;
      if (qa === 0) continue;                              // 중성 → 쿨롱 0
      const ma = K.mass(a);
      for (let j = i + 1; j < n; j++) {
        const b = atoms[j], qb = b.Z - b.e;
        if (qb === 0) continue;
        const dx = K.minImage(b.rx - a.rx, sim.W), dy = K.minImage(b.ry - a.ry, sim.H);  // a→b 변위
        const s2 = dx * dx + dy * dy + eps2;               // 연화 거리²
        // 힘(a 에 작용) = −kC·qa·qb / s2^1.5 · d (d=a→b). 반대부호(qaqb<0)→ +d 방향(인력)·같은부호→ −d(반발).
        const fOverR = -kc * qa * qb / (s2 * Math.sqrt(s2));
        const fx = fOverR * dx, fy = fOverR * dy;          // a 에 작용하는 힘 벡터(b 엔 −fx,−fy → 운동량 정확 보존)
        const mb = K.mass(b);
        a.vx += (fx / ma) * dt; a.vy += (fy / ma) * dt;    // 반음시 오일러: 속도부터 갱신(integrate 가 새 v 로 위치)
        b.vx -= (fx / mb) * dt; b.vy -= (fy / mb) * dt;
      }
    }
    sim.coulombActive = 1;                                 // 진단 플래그(hash 미참여)
  }

  // repulse 은 *단거리 반발 코어* U=kR/(r²+ε²) (force ∝ 1/r⁴ — 쿨롱 1/r³ 보다 가팔라 *단거리* 지배·*장거리* 굴복)
  //   을 매 tick 속도에 싣는다. 왜 필요한가: 순수 쿨롱(0019)은 평형점이 없다 — 반대전하는 골(연화 ε)로 붕괴·진동만 한다.
  //   단거리 반발을 더하면 인력(1/r³)↔반발(1/r⁴)이 균형하는 지점에서 *평형 결합 길이 r_eq* 가 창발한다(r²+ε²=(2kR/(kC·|qaqb|))²).
  //     → 결합이 비로소 *고정 거리*를 가진다(STATE "괴이한 기하" 해소·실제 결합 길이 원리). r<r_eq 면 반발이, r>r_eq 면 인력이 이겨
  //     양쪽서 r_eq 로 *복원* = 안정 평형. 닫힌 형식 author 아님 — 두 연속력의 합에서 *창발*(척추 체크 ②).
  //   기질 재사용: coulomb 과 동일 *반음시(symplectic)* 적분(v→r) → 총 E(KE+PE) 유계 보존(E 만 완화). 연화 ε=coulombSoft 공유(노브 1개).
  //   닫힌 장부: 쌍별 등·반작용(Δp_a=+f·dt, Δp_b=−f·dt) ⇒ 운동량 *머신* 보존. PE 항 U_rep≥0 가법(kRepulse 게이트). Q·B·L·x 불변.
  //   국소: *그 두 하전 원자*만(coulomb 과 같은 쌍·게이트·min-image). 결정론: 위치 결정 → rng 불필요. kRepulse=0 → early-return = 회귀 0.
  function repulse(sim) {
    const kr = sim.knobs.kRepulse;
    if (!kr) return;                 // 노브=0 → early-return = 회귀 0 (반발 코어 꺼짐 → 0019 비트)
    const dt = sim.knobs.dt;
    const eps2 = (sim.knobs.coulombSoft || 1) * (sim.knobs.coulombSoft || 1);  // 연화 길이²(쿨롱과 공유)
    const atoms = sim.atoms, n = atoms.length;
    for (let i = 0; i < n; i++) {
      const a = atoms[i], qa = a.Z - a.e;
      if (qa === 0) continue;                              // 중성 → 코어 0 (쿨롱과 같은 쌍 게이트)
      const ma = K.mass(a);
      for (let j = i + 1; j < n; j++) {
        const b = atoms[j], qb = b.Z - b.e;
        if (qb === 0) continue;
        const dx = K.minImage(b.rx - a.rx, sim.W), dy = K.minImage(b.ry - a.ry, sim.H);  // a→b 변위
        const s2 = dx * dx + dy * dy + eps2;               // 연화 거리²
        // U_rep = kR/s2 → F_on_a = −∇_a U = −kR·2/s2² · d (d=a→b) → a 를 −d(b 반대편) 로 밂 = 반발(전하부호 무관).
        const fOverR = -kr * 2 / (s2 * s2);
        const fx = fOverR * dx, fy = fOverR * dy;          // a 에 작용(b 엔 −fx,−fy → 운동량 정확 보존)
        const mb = K.mass(b);
        a.vx += (fx / ma) * dt; a.vy += (fy / ma) * dt;    // 반음시 오일러: 속도부터(integrate 가 새 v 로 위치)
        b.vx -= (fx / mb) * dt; b.vy -= (fy / mb) * dt;
      }
    }
    sim.repulseActive = 1;                                 // 진단 플래그(hash 미참여)
  }

  // pauli 은 *보편* 단거리 반발(excluded-volume) U=kP/(r²+ε²)² (force ∝ 1/r⁶) 을 *모든 쌍*(전하 무관)에 싣는다.
  //   왜 필요한가: coulomb·repulse 는 *하전 쌍만* 작용 → 중성 원자(q=0)는 서로 안 보고 *등속 직진*(겹쳐 통과)했다.
  //     파울리 배타(전자 구름 겹침 반발)는 전하와 무관한 *부피*다 → 게이트를 떼어 중성 포함 모든 쌍이 접촉서 밀어내게 한다(물질의 부피·소프트 충돌).
  //   왜 repulse 보다 가파른가(1/r⁶ vs 1/r⁴): excluded-volume 은 *접촉에서만* 작용해야(장거리 균일 반발=기체 팽창 회피) → 짧은 사거리.
  //   기질 재사용: coulomb·repulse 와 동일 *반음시(symplectic)* 적분(v→r)·연화 ε(coulombSoft 공유) → 총 E 유계 보존(E 만 완화).
  //   닫힌 장부: 쌍별 등·반작용 ⇒ 운동량 *머신* 보존. PE 항 U_pauli≥0 가법(kPauli 게이트, 모든 쌍). Q·B·L·x 불변(위치만 바꿈).
  //   국소: *그 두 원자*만(min-image). 결정론: 위치 결정 → rng 불필요. kPauli=0 → early-return = 회귀 0.
  function pauli(sim) {
    const kp = sim.knobs.kPauli;
    if (!kp) return;                 // 노브=0 → early-return = 회귀 0 (파울리 반발 꺼짐 → 0021 비트)
    const dt = sim.knobs.dt;
    const eps2 = (sim.knobs.coulombSoft || 1) * (sim.knobs.coulombSoft || 1);  // 연화 길이²(쿨롱·반발과 공유)
    const atoms = sim.atoms, n = atoms.length;
    for (let i = 0; i < n; i++) {
      const a = atoms[i], ma = K.mass(a);                  // 전하 게이트 없음 — 중성 포함 모든 원자
      for (let j = i + 1; j < n; j++) {
        const b = atoms[j];
        const dx = K.minImage(b.rx - a.rx, sim.W), dy = K.minImage(b.ry - a.ry, sim.H);  // a→b 변위
        const s2 = dx * dx + dy * dy + eps2;               // 연화 거리²
        // U_pauli = kP/s2² → F_on_a = −∇_a U = −kP·4/s2³ · d (d=a→b) → a 를 −d(b 반대편) 로 밂 = 반발(전하 무관).
        const fOverR = -kp * 4 / (s2 * s2 * s2);
        const fx = fOverR * dx, fy = fOverR * dy;          // a 에 작용(b 엔 −fx,−fy → 운동량 정확 보존)
        const mb = K.mass(b);
        a.vx += (fx / ma) * dt; a.vy += (fy / ma) * dt;    // 반음시 오일러: 속도부터(integrate 가 새 v 로 위치)
        b.vx -= (fx / mb) * dt; b.vy -= (fy / mb) * dt;
      }
    }
    sim.pauliActive = 1;                                   // 진단 플래그(hash 미참여)
  }

  // vdw 은 *보편* 약한 인력(반데르발스/London) U=−kV/(r²+ε²)(force ∝ 1/r⁴, 인력)을 *모든 쌍*(전하 무관)에 싣는다.
  //   왜 필요한가: step-0022 pauli 는 중성에 *반발만* 줬다 → 중성은 접촉서 튕길 뿐 *모이지 않았다*(군집 없음). 인력을 더해야 자연스러운 응집/궤도.
  //   왜 pauli(1/r⁶)보다 덜 가파른가(1/r⁴): 단거리는 pauli 반발이 이겨 *붕괴 방지*, 중거리는 vdw 인력이 이겨 *끌어모음* → 둘이 **vdW 우물** 형성
  //     (최소 PE at s2_eq=2kP/kV) → 중성 원자가 r_eq 간격으로 *응집*(condensation). 우물 = author 아닌 두 보편력 합의 측정.
  //   ※ 1/r⁴ 힘이라 *단거리 약결합*(장거리 인력은 1/r² 중력 — Phase E). 이미 근접한 중성만 묶인다(원거리 견인 아님 — 정직한 vdW).
  //   기질 재사용: 동일 symplectic 적분·연화 ε. 닫힌 장부: 쌍별 등·반작용 → 운동량 머신. PE 항 U_vdw≤0 가법(kVdW 게이트). Q·B·L·x 불변.
  //   국소: 그 두 원자만(min-image). 결정론: rng 불필요. kVdW=0 → early-return = 회귀 0.
  function vdw(sim) {
    const kv = sim.knobs.kVdW;
    if (!kv) return;                 // 노브=0 → early-return = 회귀 0 (인력 꺼짐 → 0022 비트)
    const dt = sim.knobs.dt;
    const eps2 = (sim.knobs.coulombSoft || 1) * (sim.knobs.coulombSoft || 1);
    const atoms = sim.atoms, n = atoms.length;
    for (let i = 0; i < n; i++) {
      const a = atoms[i], ma = K.mass(a);                  // 전하 게이트 없음 — 중성 포함 모든 원자(vdW 는 보편)
      for (let j = i + 1; j < n; j++) {
        const b = atoms[j];
        const dx = K.minImage(b.rx - a.rx, sim.W), dy = K.minImage(b.ry - a.ry, sim.H);  // a→b 변위
        const s2 = dx * dx + dy * dy + eps2;
        // U_vdw = −kV/s2 → F_on_a = −∇_a U = +kV·2/s2² · d (d=a→b) → a 를 +d(b 쪽)로 당김 = 인력.
        const fOverR = kv * 2 / (s2 * s2);
        const fx = fOverR * dx, fy = fOverR * dy;          // a 에 작용(b 엔 −fx,−fy → 운동량 정확 보존)
        const mb = K.mass(b);
        a.vx += (fx / ma) * dt; a.vy += (fy / ma) * dt;
        b.vx -= (fx / mb) * dt; b.vy -= (fy / mb) * dt;
      }
    }
    sim.vdwActive = 1;                                     // 진단 플래그(hash 미참여)
  }

  // damp 은 *근접 쌍의 상대 운동*만 점성 소산(복사 감쇠)해 vdW 우물의 *호흡*(진동)을 *응고*(우물 바닥 수렴)로 바꾼다.
  //   왜 필요한가: step-0023 응집은 보존계라 진동 KE 가 빠질 데가 없어 *호흡만* 했다(가라앉지 않음). 진짜 *응고/상전이*엔
  //     진동 에너지를 빼는 소산이 필요하다 — 실제 응축은 운동 E 를 *복사*로 버리며 일어난다(SPINE §4 느린 순환의 미시판).
  //   무엇을 빼나(국소·운동량 보존): 쌍 (a,b) 의 *상대 속도* vrel=vb−va 만 비율 f 로 줄인다(근접 가중 w=eps2/(s2)).
  //     질량중심 속도 vcom 은 *불변* → 쌍 운동량 px·py 정확 보존(머신). 줄인 만큼의 *상대 KE* 만 스칼라로 빠진다.
  //   어디로 가나(닫힌 장부): 빠진 ΔKE_rel = ½μ|vrel|²(1−(1−f)²) ≥ 0 을 복사 바스 sim.escaped.E 로 *이전*(운동량-자유 →
  //     bath.px·py 불변). reheat(0008) 이 같은 바스서 되먹일 수 있다 → 응고↔재증발 순환의 씨앗. E 총합 보존(KE→바스 E).
  //   왜 근접 가중인가: 멀리 떨어진 *자유 비행*은 안 식히고(중성 기체는 계속 운동), 우물 안 *진동*만 식힌다 → 응집만 응고.
  //   국소: 그 두 원자만(min-image). 결정론: rng 불필요. kDamp=0 → early-return = 회귀 0 (step-0023 비트 동일).
  function damp(sim) {
    const kd = sim.knobs.kDamp;
    if (!kd) return;                 // 노브=0 → early-return = 회귀 0
    const eps2 = (sim.knobs.coulombSoft || 1) * (sim.knobs.coulombSoft || 1);
    const atoms = sim.atoms, n = atoms.length;
    const bath = sim.escaped || (sim.escaped = { E: 0, px: 0, py: 0, count: 0 });
    for (let i = 0; i < n; i++) {
      const a = atoms[i], ma = K.mass(a);
      for (let j = i + 1; j < n; j++) {
        const b = atoms[j], mb = K.mass(b);
        const dx = K.minImage(b.rx - a.rx, sim.W), dy = K.minImage(b.ry - a.ry, sim.H);
        const s2 = dx * dx + dy * dy + eps2;
        const w = eps2 / s2;                              // 근접 가중 ∈(0,1] — 멀면 ~0(자유비행 무영향), 가까우면 ~1
        let f = kd * w;                                   // 이번 tick 상대속도 감쇠 비율
        if (f <= 0) continue;
        if (f > 0.5) f = 0.5;                             // 안정성 클램프(과감쇠 방지)
        const mu = (ma * mb) / (ma + mb);                 // 환산질량 — com 프레임 상대 KE = ½μ|vrel|²
        const vrx = b.vx - a.vx, vry = b.vy - a.vy;       // 상대 속도(vcom 불변 유지가 핵심)
        const v2 = vrx * vrx + vry * vry;
        if (v2 === 0) continue;
        // vrel 을 (1−f) 로 스케일: a 는 +(f·mb/(ma+mb))·vrel, b 는 −(f·ma/(ma+mb))·vrel 만큼 이동 → vcom 불변
        const sa = f * mb / (ma + mb), sb = f * ma / (ma + mb);
        a.vx += sa * vrx; a.vy += sa * vry;               // a 를 b 쪽 속도로 끌어당김(상대속도↓)
        b.vx -= sb * vrx; b.vy -= sb * vry;
        const dKE = 0.5 * mu * v2 * (1 - (1 - f) * (1 - f));  // 사라진 상대 KE ≥0 (스칼라)
        bath.E += dKE; bath.count++;                      // 복사 바스로 이전(운동량-자유 → px·py 불변) = 닫힌 장부
      }
    }
    sim.dampActive = 1;                                   // 진단 플래그(hash 미참여)
  }

  // bondSpring 은 *결합 간선*(sim.bonds)에만 작용하는 연속 복원력 U=½·kS·(r−r_eq)² 을 매 tick 속도에 싣는다 —
  //   *중성 공유결합*에 평형 결합 길이 r_eq 를 부여한다(step-0026, *결합 기하의 마지막 격차*). 왜 필요한가:
  //   하전(이온) 결합은 step-0021 bondCoulombic 으로 coulomb+repulse 가 r_eq 를 유지했다 — 하지만 그 연속력은 *q≠0 쌍만*
  //   작용한다(coulomb·repulse 는 중성 건너뜀). 중성 공유결합(step-0017 bondCovalent)은 간선이 *위상 라벨*일 뿐
  //   유지력이 없어 결합 길이가 없었다(bond.js line 342 "중성 공유결합은 유지력 없음(후속)"). bondSpring 은 그 간선에
  //   거리 의존 복원력을 실어 *중성 분자가 실제 결합 길이로 진동(탄성)* 하게 한다 — 하전·중성 결합 모두 r_eq 기하를 가짐.
  //   왜 쌍힘(pauli/vdw)이 아니라 *결합 한정* 인가: 공유결합은 외각 전자쌍 공유라는 *위상적 사건*이다(빈자리서 창발, step-0017).
  //     그 위상을 *측정한 간선*에만 평형 길이를 부여한다 — 비결합 중성쌍은 vdW 우물(0023)이 다룸(역할 분리·창발 환원).
  //   복원력: r>r_eq(늘어남) → 인력(서로 당김)·r<r_eq(눌림) → 반발(서로 밂). 양쪽서 r_eq 로 복원 = 안정 평형(탄성 결합).
  //   기질 재사용: coulomb·repulse·pauli·vdw 와 동일 *반음시(symplectic)* 적분(v→r) → 총 E(KE+½kS(r−r_eq)²) 유계 보존(E 만 완화).
  //   닫힌 장부: 쌍별 등·반작용(Δp_a=+f·dt, Δp_b=−f·dt) ⇒ 운동량 *머신* 보존. PE 항 U_spring≥0 가법(kBondSpring 게이트). Q·B·L·x 불변.
  //   국소: *그 결합의 두 원자*만(간선 = 그 둘의 위상). 결정론: 위치 결정 → rng 불필요. kBondSpring=0 → early-return = 회귀 0.
  function bondSpring(sim) {
    const ks = sim.knobs.kBondSpring;
    if (!ks) return;                 // 노브=0 → early-return = 회귀 0 (결합 스프링 꺼짐 → step-0025 비트)
    if (!sim.bonds || !sim.bonds.length) return;         // 결합(작용 대상 간선) 없음
    const dt = sim.knobs.dt;
    const req = sim.knobs.bondReq || 4;                  // 평형 결합 길이 r_eq
    const atoms = sim.atoms, n = atoms.length;
    for (const e of sim.bonds) {
      const i = e[0], j = e[1], a = atoms[i], b = atoms[j];
      const dx = K.minImage(b.rx - a.rx, sim.W), dy = K.minImage(b.ry - a.ry, sim.H);  // a→b 변위
      const r = Math.sqrt(dx * dx + dy * dy);
      if (r === 0) continue;                              // 완전 겹침 가드(방향 미정의)
      const nx = dx / r, ny = dy / r;                     // a→b 단위 벡터(복원 방향)
      // U=½kS(r−req)² → F_on_a = −∂U/∂r_a = +kS·(r−req)·n (r>req → +n: b 쪽 당김=인력 / r<req → −n: 밂=반발)
      const fmag = ks * (r - req);
      const fx = fmag * nx, fy = fmag * ny;               // a 에 작용(b 엔 −fx,−fy → 운동량 정확 보존)
      const ma = K.mass(a), mb = K.mass(b);
      a.vx += (fx / ma) * dt; a.vy += (fy / ma) * dt;     // 반음시 오일러: 속도부터(integrate 가 새 v 로 위치)
      b.vx -= (fx / mb) * dt; b.vy -= (fy / mb) * dt;
    }
    sim.bondSpringActive = 1;                             // 진단 플래그(hash 미참여)
  }

  // bondAngle 은 *한 원자에 모인 결합쌍*((i-j)·(i-k), 공통 중심 i)에 각도 복원력 U=½·kA·(θ−θ₀)² 을 싣는다 —
  //   *결합 각도*(다체 VSEPR, step-0027 · 결합 기하의 마지막 축)를 부여한다. 왜 필요한가:
  //   결합 *길이*는 하전 0021(bondCoulombic)·중성 0026(bondSpring)으로 닫혔다 — 두 결합이 한 원자에 모이면 *각도*가 남는다.
  //   bondSpring 까지로는 각 간선이 길이만 잡을 뿐, 두 간선의 *사잇각*은 자유다(중심 원자에 두 이웃이 겹쳐 붙어도 무방). 실제 분자는
  //   전자쌍 반발(VSEPR)로 결합이 *벌어진다*(2결합→180° 선형·3결합→120° 평면·…). bondAngle 은 그 반발을 *각도 스프링*으로 창발시킨다.
  //   왜 author 가 아닌 창발인가: 목표각 θ₀ 는 *전자쌍 수의 함수*(노브 — 토이로 단일 θ₀)일 뿐, "물은 104.5°" 같은 분자별 분기 0.
  //     각 중심 원자의 *결합 간선쌍을 측정*해(연결 성분 측정의 각도판) 그 둘 사이에만 복원력 — 비결합쌍·전역 조율자 0.
  //   복원력: θ>θ₀(너무 벌어짐) → 모으고 θ<θ₀(너무 좁음) → 벌린다. 양쪽서 θ₀ 로 복원 = 안정 평형(각도 탄성).
  //   힘 식(표준 분자역학 각도 굽힘): a=r_j−r_i, b=r_k−r_i, cosθ=(a·b)/(|a||b|). dU/dθ=kA·(θ−θ₀).
  //     F_j=−dU/dθ·(1/|a|)(cosθ·â−b̂)/sinθ · (−1)…  → 아래 코드는 F_j=−dU/dθ·∂θ/∂r_j, ∂θ/∂r_j=(cosθ·â−b̂)/(|a|·sinθ).
  //     F_k 대칭, F_i=−(F_j+F_k) ⇒ Σ F=0 (운동량 머신 보존). PE 항 ½kA(θ−θ₀)²≥0 가법(kBondAngle 게이트).
  //   기질 재사용: bondSpring 과 동일 반음시(symplectic) 적분(v→r) → 총 E 유계 보존(E 만 완화). Q·B·L·x 불변.
  //   국소: *그 중심 원자 + 두 이웃*만(간선 = 그 셋의 위상). 결정론: 위치 결정 → rng 불필요. kBondAngle=0 → early-return = 회귀 0.
  function bondAngle(sim) {
    const ka = sim.knobs.kBondAngle;
    if (!ka) return;                 // 노브=0 → early-return = 회귀 0 (각도 스프링 꺼짐 → step-0026 이하 비트)
    if (!sim.bonds || !sim.bonds.length) return;
    const dt = sim.knobs.dt;
    const t0 = sim.knobs.bondAngleTarget;                // 목표각 θ₀(VSEPR — 전자쌍 반발 평형각)
    const atoms = sim.atoms, W = sim.W, H = sim.H;
    // 각 원자에 모인 이웃(결합 상대) 목록을 측정한다(연결 성분의 각도판 — author 분기 0).
    const nbr = new Map();
    for (const e of sim.bonds) {
      if (!nbr.has(e[0])) nbr.set(e[0], []);
      if (!nbr.has(e[1])) nbr.set(e[1], []);
      nbr.get(e[0]).push(e[1]); nbr.get(e[1]).push(e[0]);
    }
    for (const [ci, ns] of nbr) {
      if (ns.length < 2) continue;                        // 결합 1개 이하 → 각도 없음
      const ai = atoms[ci];
      // 같은 중심에 모인 모든 이웃쌍 (j<k) 에 각도 복원력
      for (let p = 0; p < ns.length; p++) for (let q = p + 1; q < ns.length; q++) {
        const aj = atoms[ns[p]], ak = atoms[ns[q]];
        const axx = K.minImage(aj.rx - ai.rx, W), axy = K.minImage(aj.ry - ai.ry, H);  // a = i→j
        const bxx = K.minImage(ak.rx - ai.rx, W), bxy = K.minImage(ak.ry - ai.ry, H);  // b = i→k
        const la = Math.hypot(axx, axy), lb = Math.hypot(bxx, bxy);
        if (la === 0 || lb === 0) continue;
        let cos = (axx * bxx + axy * bxy) / (la * lb);
        if (cos > 1) cos = 1; else if (cos < -1) cos = -1;
        const theta = Math.acos(cos);
        const sin = Math.sqrt(1 - cos * cos);
        if (sin < 1e-6) continue;                          // θ≈0 또는 π → 방향 특이(분모 0) 가드
        const ahx = axx / la, ahy = axy / la, bhx = bxx / lb, bhy = bxy / lb;  // â, b̂
        const dUdt = ka * (theta - t0);                    // dU/dθ
        // ∂θ/∂r_j = (cosθ·â − b̂)/(|a|·sinθ) ; F_j = −dU/dθ·∂θ/∂r_j
        const fjx = -dUdt * (cos * ahx - bhx) / (la * sin), fjy = -dUdt * (cos * ahy - bhy) / (la * sin);
        const fkx = -dUdt * (cos * bhx - ahx) / (lb * sin), fky = -dUdt * (cos * bhy - ahy) / (lb * sin);
        const fix = -(fjx + fkx), fiy = -(fjy + fky);      // F_i = −(F_j+F_k) → ΣF=0(운동량 보존)
        const mi = K.mass(ai), mj = K.mass(aj), mk = K.mass(ak);
        ai.vx += (fix / mi) * dt; ai.vy += (fiy / mi) * dt;
        aj.vx += (fjx / mj) * dt; aj.vy += (fjy / mj) * dt;
        ak.vx += (fkx / mk) * dt; ak.vy += (fky / mk) * dt;
      }
    }
    sim.bondAngleActive = 1;                               // 진단 플래그(hash 미참여)
  }

  // gravity 은 *보편 원거리 인력* F = −kG·ma·mb/r² 를 *모든 쌍*(전하 무관)에 싣는다 — Phase E 의 씨앗(다체를 *모으는* 첫 힘).
  //   왜 이제인가: 결합 *기하*(길이 0021·0026 + 각도 0027)가 닫혔다 → 다음 척도는 *더 크다*. 지금까지 인력은 전부 *단거리*였다:
  //     coulomb(하전만)·vdw(1/r⁴ 단거리)·bondSpring(결합 간선만). 중성 대질량을 *원거리*서 끌어모으는 힘이 없어 별·은하 같은 *모임*이 안 생긴다.
  //   coulomb 의 *질량판*: 전하 q→질량 m(=Z+N), 부호 항상 −(인력, 동일부호 반발 없음 — 음질량 없음). 전하 게이트 제거(중력은 보편).
  //   왜 author 가 아닌 창발인가: "별"·"군집"은 코드의 종류가 아니라 *중력 우물에 모인 원자 다발의 위치*다(척추 체크 ①②). pauli 코어(0022)가
  //     붕괴를 막아 *평형 군집*(중력 인력 ↔ 파울리 반발 균형)이 창발한다 — §4 의 "별의 씨앗".
  //   기질 재사용: coulomb·pauli 와 동일 *반음시(symplectic)* 적분(v→r)·연화 ε(coulombSoft 공유) → 총 E(KE+PE) 유계 보존(E 만 완화).
  //   닫힌 장부: 쌍별 등·반작용(Δp_a=+f·dt, Δp_b=−f·dt) ⇒ 총 운동량 *정확* 보존(머신 0). PE 항 U_grav≤0 가법(kGravity 게이트). Q·B·L·x 불변.
  //   국소: *그 두 원자*만(min-image). 결정론: 위치·질량 결정 → rng 불필요. 게이트 kGravity=0 → early-return = 회귀 0.
  function gravity(sim) {
    const kg = sim.knobs.kGravity;
    if (!kg) return;                 // 노브=0 → early-return = 회귀 0 (중력 꺼짐 → step-0027 비트)
    const dt = sim.knobs.dt;
    const eps2 = (sim.knobs.coulombSoft || 1) * (sim.knobs.coulombSoft || 1);  // 연화 길이²(쿨롱·파울리와 공유)
    const atoms = sim.atoms, n = atoms.length;
    for (let i = 0; i < n; i++) {
      const a = atoms[i], ma = K.mass(a);                  // 전하 게이트 없음 — 중성 포함 모든 원자(중력은 보편)
      for (let j = i + 1; j < n; j++) {
        const b = atoms[j], mb = K.mass(b);
        const dx = K.minImage(b.rx - a.rx, sim.W), dy = K.minImage(b.ry - a.ry, sim.H);  // a→b 변위
        const s2 = dx * dx + dy * dy + eps2;               // 연화 거리²
        // U_grav = −kG·ma·mb/√s2 → F_on_a = −∇_a U = +kG·ma·mb/s2^1.5 · d (d=a→b) → a 를 +d(b 쪽)로 당김 = 인력(항상).
        const fOverR = kg * ma * mb / (s2 * Math.sqrt(s2));
        const fx = fOverR * dx, fy = fOverR * dy;          // a 에 작용(b 엔 −fx,−fy → 운동량 정확 보존)
        a.vx += (fx / ma) * dt; a.vy += (fy / ma) * dt;    // 반음시 오일러: 속도부터(integrate 가 새 v 로 위치)
        b.vx -= (fx / mb) * dt; b.vy -= (fy / mb) * dt;
      }
    }
    sim.gravityActive = 1;                                 // 진단 플래그(hash 미참여)
  }

  // fuse 은 *핵 융합* — decay(0031)의 *반대 방향*·§4 빠른 비가역 별 내부(가벼운 핵 → 무거운 핵, 못 되돌림·창발의 화살표).
  //   decay 가 한 원자를 *쪼개* 원소를 *올렸다*면(N→N−1·Z→Z+1), fuse 는 두 가벼운 핵을 *합쳐* 더 무거운 원소를 만든다.
  //   조건(고에너지 충돌 — 쿨롱 장벽 돌파): fuseR 안에서 *서로 다가오는*(vn>0) 두 원자의 상대 KE(½μ|vrel|²)가 장벽 fuseBarrier 이상이면 융합.
  //     실제로도 융합은 양전하 핵끼리의 쿨롱 반발(장벽)을 운동에너지로 뚫어야 일어난다 — 그래서 *고온(고E)* 별 내부에서만.
  //   합체(완전 비탄성·measurement 로 새 원소): 두 원자 a,b → 한 원자. Z=Za+Zb·N=Na+Nb·e=ea+eb (다발의 *합* — 새 원소는 author 아닌 *측정*으로 창발).
  //     ⇒ 바리온 B=Σ(Z+N)·전하 Q=Σ(Z−e)·렙톤 L=Σe 전부 합산 보존(쪼갬 없음 — 단순 병합). 질량 m=Z+N 도 합 보존.
  //   닫힌 장부(운동량·에너지):
  //     • 운동량: 합체 속도 = 질량중심 속도 vcom=(ma·va+mb·vb)/(ma+mb) ⇒ 총 px·py *정확* 보존(bond 의 vcom 잠금과 동형·머신).
  //     • 에너지: 합체가 흡수한 *상대* KE ½μ|vrel|² 는 사라지지 않고 복사 바스 sim.escaped.E 로 park(bond·damp 와 동형 회계 — E 닫힘).
  //     • Δm·c² 방출(융합 에너지): 반응물이 품은 핵 저장고 nuc(a.nuc+b.nuc) 중 fuseQ 를 *방출* — sim.escaped.E 로 이전(복사로 빠짐).
  //       남은 저장고는 product.nuc 으로 계승. ⇒ E=Σ(mc²+KE+nuc)+바스 *정확* 닫힘(저장고→바스 이전은 회계상 이동일 뿐, 총 E 불변).
  //   비가역(SPINE §2·§4): 두 원자가 하나로 — 못 되돌림(별 내부 화살표). 하지만 Q·B·L·E·px·py 장부는 *닫힌다*(비가역 ≠ 비보존).
  //   국소: *그 두 원자*만으로 판정(전역 조율자 0·토러스 min-image). 결정론: rng 불필요(위치·속도·문턱 결정). 노브 kFuse=0 → early-return = 회귀 0.
  //   주의: 합체로 원자 *개수가 준다* — 한 tick 에 한 원자가 두 번 합쳐지지 않도록 소비 플래그로 가드(겹침 중복 0). 죽은 원자는 배열서 압축.
  function fuse(sim) {
    const k = sim.knobs.kFuse;
    if (!k) return;                  // 노브=0 → early-return = 회귀 0 (융합 항 꺼짐 → 직전 비트)
    const R = sim.knobs.fuseR || 3, R2 = R * R;
    const barrier = sim.knobs.fuseBarrier || 0;            // 쿨롱 장벽: 상대 KE 가 이 이상이어야 융합(고E 충돌)
    const qRel = sim.knobs.fuseQ || 0;                     // 융합마다 방출하는 Δm·c² Q값(저장고 잔량 한도 내)
    const fmf = sim.knobs.fuseMassFormula;                 // 융합 Q값을 결합에너지서(step-0041, 0 → author fuseQ·저장고 거동·회귀 0)
    const pr = sim.knobs.decayPairing;                     // fmf 면 ΔB_fus 의 페어링 게이트(ledger·decay 와 같은 B 사용)
    const atoms = sim.atoms, n = atoms.length;
    let bath = null, fusedAny = false;
    const dead = new Array(n).fill(false);                 // 이미 합쳐져 소비된 원자(한 tick 중복 합체 가드)
    for (let i = 0; i < n; i++) {
      if (dead[i]) continue;
      const a = atoms[i];
      for (let j = i + 1; j < n; j++) {
        if (dead[j]) continue;
        const b = atoms[j];
        const dx = K.minImage(b.rx - a.rx, sim.W), dy = K.minImage(b.ry - a.ry, sim.H);
        const d2 = dx * dx + dy * dy;
        if (d2 > R2 || d2 === 0) continue;                 // 접촉 반경 밖(또는 완전 겹침 가드)
        const d = Math.sqrt(d2), nx = dx / d, ny = dy / d;
        const vn = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny; // 상대속도 법선 성분(>0 = 다가옴)
        if (vn <= 0) continue;                              // 멀어지는 쌍은 융합 안 함
        const ma = K.mass(a), mb = K.mass(b), mu = (ma * mb) / (ma + mb);
        const dvx = a.vx - b.vx, dvy = a.vy - b.vy;
        const keRel = 0.5 * mu * (dvx * dvx + dvy * dvy);   // 상대 KE = ½μ|vrel|²(쿨롱 장벽 돌파 판정용)
        if (keRel < barrier) continue;                      // 장벽 미돌파 → 융합 안 함(저E 는 collide/bond 몫)
        // 합체: vcom 으로 잠근 새 원자(다발 합산). 총 운동량 정확 보존, 흡수된 상대 KE 는 바스로.
        const M = ma + mb;
        const vcx = (ma * a.vx + mb * b.vx) / M, vcy = (ma * a.vy + mb * b.vy) / M;
        const nucSum = (a.nuc || 0) + (b.nuc || 0);
        // 방출 Δm·c²: fmf(0041) 면 *결합에너지 이득* ΔB_fus = B(생성)−B(a)−B(b)(질량공식서 — 발열량이 author 상수 아님·massDefect 와 짝).
        //   융합은 가벼운 핵서 발열(ΔB_fus>0·별 점화), 철 너머 흡열(ΔB_fus<0) — 둘 다 *측정*으로 창발(author 0). fmf=0 → author fuseQ(저장고 한도).
        const Zp = a.Z + b.Z, Np = a.N + b.N;
        const released = fmf
          ? (K.binding(Zp, Np, pr) - K.binding(a.Z | 0, a.N | 0, pr) - K.binding(b.Z | 0, b.N | 0, pr))
          : Math.min(qRel, nucSum);
        if (!bath) bath = sim.escaped || (sim.escaped = { E: 0, px: 0, py: 0, count: 0 });
        bath.E += keRel + released;                         // 흡수한 상대 KE + 방출 Δm·c² → 복사 바스. fmf+md: 생성 핵 정지질량이 ΔB_fus 만큼 줄어 상쇄(E 닫힘)
        bath.count = (bath.count | 0) + 1;
        // a 를 product 로 갱신(다발 합산·vcom·저장고 계승). b 는 dead 표시 → 배열서 압축.
        a.Z += b.Z; a.N += b.N; a.e += b.e; a.lep = (a.lep || 0) + (b.lep || 0);
        a.vx = vcx; a.vy = vcy;
        a.nuc = fmf ? nucSum : nucSum - released;           // fmf: 저장고 미인출(연료=ΔM 정지질량·massDefect)·계승만. else: 저장고서 방출분 제외
        a.x = 0;                                            // 들뜸은 합체로 초기화(토이 — 핵 들뜸 별도 모형 전가)
        dead[j] = true; fusedAny = true;
        break;                                              // a 는 이번 tick 더 안 합침(i 다음으로)
      }
    }
    if (fusedAny) {                                         // 죽은 원자 압축(개수 감소 — 합체 측정)
      const live = [];
      for (let i = 0; i < n; i++) if (!dead[i]) live.push(atoms[i]);
      sim.atoms = live;
    }
    sim.fuseActive = 1;                                     // 진단 플래그(hash 미참여)
  }

  // decay 은 *핵 붕괴* — Phase D 의 첫 칸·§4 비가역 화살표(못 되돌림). 지금까지 Z·N 은 *불변*이었다(원소·동위원소 고정).
  //   불안정 동위원소(N 과잉 — N−Z > decayNexcess)가 확률 kDecay 로 *베타마이너스* 붕괴: 중성자 1개가 양성자로 바뀐다(n→p).
  //     N → N−1, Z → Z+1  ⇒ B=Z+N 불변(바리온 보존)·질량 m=Z+N 불변. *원소가 바뀐다*(Z↑ — 측정으로 새 원소가 창발, author 0).
  //     e → e+1 (딸 원자가 방출 전자를 붙들어 중성 유지) ⇒ Q=Z−e 불변(전하 보존).
  //     렙톤: 반중성미자(L=−1) 방출 → a.lep −= 1 ⇒ L=Σ(e+lep) 불변(SPINE §2 렙톤 회계 — e 단순화 정련).
  //   왜 비보존이 아닌 비가역인가(SPINE §2 결정적 정합): Z·N 을 바꿔 *비가역*(불안정→안정, 화살표)이지만 Q·B·L·E 장부는 *닫힌다*.
  //   Δm·c² 의 출처: 붕괴 Q값 q 를 원자가 *핵 저장고* a.nuc 에 미리 품는다(불안정도 = 결합에너지 차의 토이). 붕괴 시 q 를 *운동 에너지*로 방출:
  //     a.nuc −= q · |Δv|: KE += q · 등방 반동(시드 방향). ⇒ E = Σ(mc²+KE+nuc) *정확* 닫힘(반동은 단일 원자 → 총 운동량은 *그 원자만* 바뀜).
  //   운동량(0031 한계 → 0032 게이트 decayRecoilPair 로 해소): 단일 원자 반동만 보면 총 px·py 가 *변한다* — 실제론
  //     방출된 전자+반중성미자가 *반대* 운동량을 나른다. decayRecoilPair=1 이면 그 방출 입자의 운동량 −Δp(=−m·Δv)를
  //     복사 바스 sim.escaped.px·py 에 담는다(escaped 는 이미 운동량 reservoir·ledger 가 합산). ⇒ 총 px·py 도 *머신* 닫힘.
  //     에너지는 손대지 않는다 — 방출 입자 KE(q)는 이미 원자 반동 KE 로 계상됐고, 바스엔 운동량만 적재(E 이중계상 0).
  //     게이트=0 → 0031 거동(바스 px·py 미적재) 비트 동일 = 회귀 0. 게이트는 *기하적 운동량 부기*일 뿐 동역학(원자 v)은 불변.
  //   국소: *그 원자 혼자*로 판정(이웃·전역 조율자 0). 결정론: 방향·확률 sim.rng(시드 의사난수)만. 게이트 kDecay=0 → early-return = 회귀 0.
  function decay(sim) {
    const k = sim.knobs.kDecay;
    if (!k) return;                  // 노브=0 → early-return = 회귀 0 (붕괴 꺼짐 → 직전 비트)
    const rng = sim.rng;
    if (!rng) return;                // 의사난수 없으면 방향·확률 불가(Math.random 금지 — 결정론)
    const nx = sim.knobs.decayNexcess;                     // 불안정 문턱(decayMassFormula=0 일 때 — N 과잉 동위원소)
    const pair = sim.knobs.decayRecoilPair;                // 방출 입자 운동량 추적(0032 게이트, 0 → 0031 거동·회귀 0)
    const mf = sim.knobs.decayMassFormula;                 // 질량공식 구동(step-0037, 0 → author 문턱·decayQ 거동·회귀 0)
    const bp = sim.knobs.decayBetaPlus;                     // β⁺/전자포획 채널(step-0038, 0 → β⁻ 한 방향만·회귀 0)
    const dp = sim.knobs.decayPairing;                      // 페어링항 δ(step-0039, 0 → δ 미가법·0038 거동·회귀 0)
    const md = sim.knobs.massDefect;                        // 결합E 정지질량 편입(step-0040, 0 → nuc 저장고 연료·회귀 0)
    const useBind = mf || md;                               // md(정지질량=A−B)는 binding 기반 안정·Q 를 *함의*한다 — md 켜고 mf 끈 불일치서도 q=ΔB 로 닫힘(레저 −B 변화와 정합·md=0 이면 mf 그대로·회귀 0)
    let bath = null;
    for (const a of sim.atoms) {
      // 안정성 게이트: mf 면 *결합에너지*가 정한다(ΔB>0 발열 → 골짜기로 진행 · ΔB≤0 → 골짜기 안정, author 문턱 0).
      //   mf=0 이면 author 문턱(N−Z>nx) 그대로(회귀 0). 두 경로 모두 rng 소비 전 판정(결정론 동일).
      //   채널(0037 까지 β⁻ 한 방향 — 중성자 과잉만 골짜기로): bp=1 이면 β⁺(p→n·Z↓) 도 켠다 → *양성자 과잉*도 반대 방향으로 골짜기 수렴.
      //     β⁻ ΔB⁻=B(Z+1,N−1)−B(Z,N) · β⁺ ΔB⁺=B(Z−1,N+1)−B(Z,N). B 는 Z 에 대해 concave(질량공식) → 둘 중 최대 하나만 >0(골짜기 한쪽).
      //     그래서 β⁻ 가 불리(ΔB⁻≤0)일 때만 β⁺ 를 본다 — 둘 다 ≤0 이면 안정 골짜기(완전한 양방향 골짜기). bp=0 → 0037 거동 비트 동일.
      let dB = 0, chan = 0;                                                       // chan: 0=β⁻(n→p·Z↑) · 1=β⁺(p→n·Z↓)
      if (useBind) {                                                              // mf 또는 md — 둘 다 결합에너지가 안정·Q 의 출처(정합 강제)
        dB = K.bindingDelta(a.Z | 0, a.N | 0, dp);                                // β⁻ 결합 이득 ΔB⁻ (dp 면 페어링 δ 포함)
        if (dB <= 0) {                                                            // β⁻ 불리(중성자 과잉 아님)
          if (bp) {                                                              // β⁺ 채널 켬: 양성자 과잉이면 반대 방향으로 골짜기 수렴
            const dBp = K.binding((a.Z | 0) - 1, (a.N | 0) + 1, dp) - K.binding(a.Z | 0, a.N | 0, dp);  // β⁺ 결합 이득 ΔB⁺
            if (dBp <= 0) continue;                                              // 양방향 ΔB≤0 → 안정 골짜기(질량공식 창발)
            dB = dBp; chan = 1;                                                  // β⁺ 진행(p→n·Z↓·발열 ΔB⁺)
          } else continue;                                                       // β⁺ 끔 → 0037 거동(β⁻ 만·회귀 0)
        }
      }
      else if (((a.N | 0) - (a.Z | 0)) <= nx) continue;                          // author 문턱(안정·N 과잉 아님)
      if (!md && (a.nuc || 0) <= 0) continue;              // 핵 저장고 빈 원자는 더 못 방출(md=0 경로). md(0040) 면 연료=−B 정지질량 변화 → 멈춤은 ΔB≤0(골짜기)이 정함(저장고 폐기)
      // 붕괴 확률: 평탄 kDecay 가 기본. decayRateExcess>0 이면 *핵 불안정도*(N−Z 의 문턱 초과분)에 비례해 가속 —
      //   반감기가 author 한 평탄 상수가 아니라 핵 상태의 *함수*로 창발한다(안정선서 멀수록 빨리 붕괴 — Sargent 류).
      //   keff = min(1, kDecay·(1 + decayRateExcess·excess)). 종류별 author 0 — excess 는 *선택된 채널*의 과잉(다발 양)일 뿐.
      //   노브=0 → keff=kDecay = 평탄(회귀 0 — rng 소비·비교 동일).
      let keff = k;
      if (sim.knobs.decayRateExcess) {
        // 불안정도 = *선택된 채널*의 과잉, 문턱 초과분: β⁻(chan=0)=중성자 과잉 N−Z · β⁺(chan=1)=양성자 과잉 Z−N.
        //   0 으로 바닥(Math.max) — 가속 모델 k(1+R·excess)는 excess≥0 에서만 유효(음수 외삽 = 모델 붕괴 → keff<0 → 확률 아님).
        //   excess<0 이어도 채널 게이트를 통과한 원자는 *최소 기본율 k* 로 붕괴(얼지 않음). β⁻ author 문턱 경로(0036)는 N−Z>nx 보장 → 바닥 no-op·회귀 0.
        const imbalance = chan ? ((a.Z | 0) - (a.N | 0)) : ((a.N | 0) - (a.Z | 0));
        const excess = Math.max(0, imbalance - nx);
        keff = Math.min(1, k * (1 + sim.knobs.decayRateExcess * excess));
      }
      // Sargent 법칙(step-0045): β 붕괴율의 *함수형*도 결합에너지서 — 방출 전자+중성미자의 위상공간 ∝ Q⁵(Q=방출 에너지=ΔB).
      //   0036 decayRateExcess 는 율을 *N−Z 불안정도*로 창발시켰으나 함수형이 토이 선형. 실제 β 율(Sargent 1933)은 Q값의 *5제곱*:
      //   더 들뜬(골짜기서 먼) 핵일수록 Q 크고 → 위상공간 폭증 → 훨씬 빨리 붕괴(반감기 ∝ 1/Q⁵). Q=dB(이미 결합에너지서)라 율의 함수형도 author 0.
      //   keff = min(1, kDecay·(Q/Qref)⁵). dB>0 보장(채널 선택)·useBind 필요(dB 가 결합에너지일 때만 — author 문턱 경로엔 dB=0).
      //   게이트 decaySargent=0 → early-skip = keff 불변(평탄/excess 거동 — 회귀 0). decayRateExcess 와 배타(둘 다 율 모델 — Sargent 가 우선).
      if (sim.knobs.decaySargent && useBind) {
        const Qref = sim.knobs.decayQref || 1;
        keff = Math.min(1, k * Math.pow(dB / Qref, 5));     // 위상공간 Q⁵ — 작은 Q 차가 큰 율 차(5제곱 가파름)
      }
      if (rng() >= keff) continue;                          // 붕괴 확률 keff(불안정도 의존)
      // 방출 Q값: useBind(mf|md) 면 *결합에너지 이득* ΔB(질량공식서 창발 — 발열량이 author 상수 아님), 아니면 author decayQ.
      //   md(0040) 면 발열량은 정지질량 변화 ΔM=−ΔB 가 직접 공급(저장고 무관·캡 없음) — ledger 의 −B 편입이 자동 상쇄(useBind 라 q=ΔB 보장). md=0 이면 nuc 저장고 한도.
      const q0 = useBind ? dB : sim.knobs.decayQ;
      const q = md ? q0 : Math.min(a.nuc, q0);
      // 변환: 원소가 바뀐다(Z 이동). 전하·바리온 보존, 렙톤은 (반)중성미자로 닫음(L=Σ(e+lep) 불변).
      if (chan) {
        // β⁺(p→n): Z↓·N↑ ⇒ B=Z+N 불변. e−1(중성 유지·방출 양전자가 +1 나름) ⇒ Q=Z−e 불변. 중성미자 L=+1 → lep+1(e−1 상쇄, ΔL=0).
        a.N += 1; a.Z -= 1; a.e -= 1; a.lep = (a.lep || 0) + 1;
      } else {
        // β⁻(n→p): Z↑·N↓ ⇒ B 불변. e+1(딸이 방출 전자 붙듦) ⇒ Q 불변. 반중성미자 L=−1 → lep−1(e+1 상쇄, ΔL=0).
        a.N -= 1; a.Z += 1; a.e += 1; a.lep = (a.lep || 0) - 1;
      }
      // Δm·c² 방출: 저장고 q 를 등방 반동 KE 로. 새 |v| 는 ½m·v'² = ½m·v² + q 를 풀어 정확히 KE 를 q 만큼 올린다(방향은 시드).
      const m = K.mass(a);                                 // n→p 라 m=Z+N 불변(반동 질량)
      const vx0 = a.vx, vy0 = a.vy;                         // 반동 전 속도(방출 입자 운동량 = −m·Δv 산출용)
      const ke0 = 0.5 * m * (vx0 * vx0 + vy0 * vy0);
      const ke1 = ke0 + q;
      const sp1 = Math.sqrt(2 * ke1 / m);                  // 새 속력(KE 가 q 만큼 큼)
      const th = rng() * 2 * Math.PI;                      // 등방 반동 방향(시드 — 결정론)
      a.vx = sp1 * Math.cos(th); a.vy = sp1 * Math.sin(th);
      if (!md) a.nuc -= q;                                 // md=0: 저장고 인출(= KE 증가분 → E 닫힘). md(0040): 저장고 없음 — KE 증가분은 ledger 의 ΔM=−ΔB 정지질량 감소가 상쇄(E 닫힘)
      if (pair) {                                          // 방출 입자(e⁻+ν̄)가 나르는 반대 운동량 −Δp 를 바스에 적재 → 총 px·py 머신 닫힘
        if (!bath) bath = sim.escaped || (sim.escaped = { E: 0, px: 0, py: 0, count: 0 });
        bath.px += -(m * (a.vx - vx0));                    // −Δp_x (원자가 +Δp 얻으면 방출 입자는 −Δp)
        bath.py += -(m * (a.vy - vy0));
        bath.count = (bath.count | 0) + 1;
      }
    }
    sim.decayActive = 1;                                   // 진단 플래그(hash 미참여)
  }

  // 힘/상호작용 법칙 레지스트리 + 실행 순서. append-only — 노브=0 → 회귀 0.
  const LAWS = { emit, recoil, propagate, scatter, escape, reheat, bond, chemilum, collide, unbond, coulomb, repulse, pauli, vdw, damp, bondSpring, bondAngle, gravity, fuse, decay };
  const LAW_ORDER = ['emit', 'recoil', 'propagate', 'scatter', 'escape', 'reheat', 'bond', 'chemilum', 'collide', 'unbond', 'coulomb', 'repulse', 'pauli', 'vdw', 'damp', 'bondSpring', 'bondAngle', 'gravity', 'fuse', 'decay'];

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

  return { DEFAULTS, LAWS, LAW_ORDER, applyForces, integrate, wrap, covVacancy };
});
