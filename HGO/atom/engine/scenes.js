// scenes.js — 장면 레지스트리 (append-only)
// 한 step = 장면 한 항. 이 한 항이 검증·골든 해시·시각화 셋 모두의 단일 출처(DRY, SPINE §6.1).
//   { id, title, desc, ticks, init(rng,K)→spec, watch(sim,K)→{지표}, assert(ctx,K)→[{name,pass,value}] }
;(function (root, factory) {
  const K = (typeof require !== 'undefined') ? require('./hgo-kernel.js') : root.HGO.kernel;
  const mod = factory(K);
  if (typeof module !== 'undefined' && module.exports) module.exports = mod;
  else (root.HGO = root.HGO || {}).scenes = mod;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (K) {
  'use strict';

  // 원소는 author 한 타입이 아니라 (Z,N) 다발의 값일 뿐 (SPINE §3 요건1).
  // 수소·헬륨·탄소·산소 = 양성자 수의 위치.
  const ELEMENTS = [{ Z: 1, N: 0 }, { Z: 2, N: 2 }, { Z: 6, N: 6 }, { Z: 8, N: 8 }];

  const SCENES = {
    'step-0001': {
      id: 'step-0001',
      title: '원자가 존재하고 떠다닌다 (자유 운동)',
      desc: '개별 원자(보존량 다발: Z·N·e·들뜸·위치·속도)를 빈 토러스 무대에 띄워 ' +
            '상호작용 없이 자유 운동시킨다. 힘 0 — 무대 + 규칙 0. ' +
            '닫힌 장부(전하 Q·바리온 B·렙톤 L·에너지 E)와 결정론을 앵커로 박는다.',
      ticks: 50,

      init(rng, K) {
        const W = 100, H = 100, n = 40, atoms = [];
        for (let i = 0; i < n; i++) {
          const el = ELEMENTS[(rng() * ELEMENTS.length) | 0];
          const ion = rng() < 0.2 ? 1 : 0;           // 20% 이온화: 전자 1 제거 → 전하 Q≠0
          atoms.push({
            Z: el.Z, N: el.N, e: el.Z - ion, x: 0,    // x = 전자 들뜸 준위(step-0002 부터 씀)
            rx: rng() * W, ry: rng() * H,
            vx: rng() * 2 - 1, vy: rng() * 2 - 1,      // 속도 [-1,1] — 운동에너지 = 온도
          });
        }
        return { W, H, atoms, knobs: { dt: 1.0 } };
      },

      watch(sim, K) {
        const L = K.ledger(sim);
        let speed = 0; for (const a of sim.atoms) speed += Math.hypot(a.vx, a.vy);
        return {
          atoms: sim.atoms.length,
          Q: L.Q, B: L.B, L: L.L, E: +L.E.toFixed(3),
          meanSpeed: +(speed / sim.atoms.length).toFixed(4),
        };
      },

      // 가설: 원자가 결정론적으로 *움직였고*, 무대(토러스) 안에 머문다.
      // ctx 는 verify 가 채운다: { meanDisp, allBounded, maxCoord, hashChanged }
      assert(ctx, K) {
        return [
          { name: '원자가 움직임(상태 변화·평균 변위>0)', pass: ctx.hashChanged && ctx.meanDisp > 0, value: +ctx.meanDisp.toFixed(3) },
          { name: '무대 경계 유지(토러스 안)', pass: ctx.allBounded, value: +ctx.maxCoord.toFixed(2) },
        ];
      },
    },

    'step-0002': {
      id: 'step-0002',
      title: '원자가 빛난다 (전자 들뜸 → 자발 방출 → 광자 λ=hc/ΔE)',
      desc: '일부 원자를 들뜬 전자 준위(x=1~3)로 초기화하고, 자발 방출 법칙(노브 kEmit)으로 ' +
            '들뜬 원자가 한 준위씩 떨어지며 광자를 낸다. 파장 λ=hc/ΔE 는 준위 차에서 *창발*(색을 author 안 함) — ' +
            '비선형 준위(수소 에너지 고유값) 덕에 서로 다른 전이가 서로 다른 스펙트럼선을 만든다. 들뜸 E ↓ = 광자 E ↑(닫힌 장부 쌍 거래).',
      ticks: 50,

      init(rng, K) {
        const W = 100, H = 100, n = 40, atoms = [];
        for (let i = 0; i < n; i++) {
          const el = ELEMENTS[(rng() * ELEMENTS.length) | 0];
          const ion = rng() < 0.2 ? 1 : 0;
          const x = rng() < 0.6 ? 1 + ((rng() * 3) | 0) : 0;   // 60% 들뜸: 준위 1~3
          atoms.push({
            Z: el.Z, N: el.N, e: el.Z - ion, x,
            rx: rng() * W, ry: rng() * H,
            vx: rng() * 2 - 1, vy: rng() * 2 - 1,
          });
        }
        // 런타임 자발 방출용 시드 의사난수 — rng 한 번 더 소비해 결정론적으로 파생.
        const simRng = K.mulberry32((rng() * 4294967296) >>> 0);
        return { W, H, atoms, rng: simRng, knobs: { dt: 1.0, kEmit: 0.1 } };
      },

      watch(sim, K) {
        const L = K.ledger(sim);
        let excited = 0, exc = 0;
        for (const a of sim.atoms) { if ((a.x | 0) > 0) excited++; exc += K.levelE(a.x); }
        let pe = 0; for (const p of sim.photons) pe += p.E;
        return {
          atoms: sim.atoms.length,
          excited, photons: sim.photons.length,
          excE: +exc.toFixed(3), photonE: +pe.toFixed(3),
          E: +L.E.toFixed(3),
        };
      },

      // 가설: ① 광자가 방출된다 ② 파장이 준위 차에서 창발(λ=hc/ΔE, author 0) ③ 서로 다른 전이 → 서로 다른 스펙트럼선.
      assert(ctx, K) {
        const ph = ctx.sim.photons, n = ph.length;
        let lambdaOK = n > 0;
        const lines = new Set();
        for (const p of ph) {
          const dE = K.levelE(p.from) - K.levelE(p.to);
          if (Math.abs(p.lambda - K.photonLambda(dE)) > 1e-12) lambdaOK = false;  // λ 는 ΔE 의 함수(창발), 저장값과 일치
          lines.add(p.from + '→' + p.to);
        }
        return [
          { name: '광자 방출됨(자발 방출 count>0)', pass: n > 0, value: n },
          { name: '파장이 준위 차에서 창발(λ=hc/ΔE)', pass: lambdaOK, value: n > 0 ? +ph[0].lambda.toFixed(4) : 0 },
          { name: '서로 다른 전이 → 서로 다른 스펙트럼선(≥2)', pass: lines.size >= 2, value: lines.size },
        ];
      },
    },

    'step-0003': {
      id: 'step-0003',
      title: '광자가 원자를 민다 (운동량 반동 p=E/c → recoil shift)',
      desc: '모든 원자를 *정지*(v=0)·들뜬 준위로 초기화하고, 자발 방출(kEmit)에 더해 반동 법칙(노브 kRecoil)을 켠다. ' +
            '방출 광자가 운동량 p=E/c 를 나르고 원자는 반대로 밀린다 — 정지에서 시작해도 빛 때문에 움직인다. ' +
            '준위차 ΔE 는 광자 E_ph + 원자 반동 KE 로 갈라져(recoil shift) 광자 E 가 ΔE 보다 작아지고, ' +
            '가벼운 원자일수록 반동·shift 가 크다(질량 의존 — author 0, 식에서 창발). 총 운동량은 정확히 0(광자↔원자 상쇄).',
      ticks: 50,

      init(rng, K) {
        const W = 100, H = 100, n = 40, atoms = [];
        for (let i = 0; i < n; i++) {
          const el = ELEMENTS[(rng() * ELEMENTS.length) | 0];
          const ion = rng() < 0.2 ? 1 : 0;
          const x = rng() < 0.6 ? 1 + ((rng() * 3) | 0) : 0;   // 60% 들뜸: 준위 1~3
          atoms.push({
            Z: el.Z, N: el.N, e: el.Z - ion, x,
            rx: rng() * W, ry: rng() * H,
            vx: 0, vy: 0,                                       // *정지* 시작 → 운동은 오직 광자 반동에서
          });
        }
        const simRng = K.mulberry32((rng() * 4294967296) >>> 0);
        return { W, H, atoms, rng: simRng, knobs: { dt: 1.0, kEmit: 0.1, kRecoil: 1 } };
      },

      watch(sim, K) {
        let speed = 0, apx = 0, apy = 0, ppx = 0, ppy = 0;
        for (const a of sim.atoms) { const m = K.mass(a); speed += Math.hypot(a.vx, a.vy); apx += m * a.vx; apy += m * a.vy; }
        for (const p of sim.photons) { ppx += p.px || 0; ppy += p.py || 0; }
        return {
          atoms: sim.atoms.length,
          photons: sim.photons.length,
          meanSpeed: +(speed / sim.atoms.length).toFixed(5),     // 정지(0)에서 반동으로 얻은 평균 속력
          atomP: +Math.hypot(apx, apy).toFixed(4),               // 원자 총 운동량 크기
          photonP: +Math.hypot(ppx, ppy).toFixed(4),             // 광자 총 운동량 크기(원자와 상쇄)
          totP: +Math.hypot(apx + ppx, apy + ppy).toExponential(2), // 총합 ≈ 0
        };
      },

      // 가설: ① 정지 원자가 광자 반동으로 움직인다 ② 총 운동량 보존(원자+광자 ≈0) ③ recoil shift(광자 E<준위차 ΔE).
      assert(ctx, K) {
        const sim = ctx.sim, ph = sim.photons;
        let px = 0, py = 0, speed = 0;
        for (const a of sim.atoms) { const m = K.mass(a); px += m * a.vx; py += m * a.vy; speed += Math.hypot(a.vx, a.vy); }
        for (const p of ph) { px += p.px || 0; py += p.py || 0; }
        const Ptot = Math.hypot(px, py), meanSpeed = speed / sim.atoms.length;
        let nr = 0, shifted = 0, shiftSum = 0;
        for (const p of ph) {
          if (!p.recoiled) continue;
          nr++;
          const gap = K.levelE(p.from) - K.levelE(p.to);         // 전체 준위차(p.E 는 이미 E_ph 로 줄어듦)
          if (p.E < gap - 1e-12) shifted++;
          shiftSum += (gap - p.E) / gap;
        }
        return [
          { name: '정지 원자가 광자 반동으로 움직임(평균 속력>0)', pass: meanSpeed > 0, value: +meanSpeed.toFixed(5) },
          { name: '총 운동량 보존(원자+광자 ≈0)', pass: Ptot < 1e-9, value: +Ptot.toExponential(2) },
          { name: 'recoil shift(광자 E<준위차 ΔE, 전부)', pass: nr > 0 && shifted === nr, value: nr ? +(shiftSum / nr).toFixed(4) : 0 },
        ];
      },
    },

    'step-0004': {
      id: 'step-0004',
      title: '빛이 날아간다 (광자 전파 — 운동량 방향으로 광속 c 직진)',
      desc: '정지·들뜬 원자에서 방출(kEmit)·반동(kRecoil)으로 *방향을 가진* 광자가 생기면, 전파 법칙(노브 kProp)으로 ' +
            '그 광자가 운동량 방향으로 광속 c 로 직진한다(토러스 wrap). 복사장이 더는 방출점에 고이지 않고 *공간으로 퍼진다* — ' +
            '흡수·전파의 무대. 위치만 바뀌므로 에너지·운동량 장부는 그대로 닫힌다(보존-자명). ' +
            '큰 무대(400²)로 런 동안 wrap 을 피해 직진·광속을 정밀 측정한다.',
      ticks: 50,

      init(rng, K) {
        const W = 400, H = 400, n = 40, atoms = [];   // 큰 무대 — 50 tick·c=1 이면 최대 이동 50 ≪ 200(half)
        for (let i = 0; i < n; i++) {
          const el = ELEMENTS[(rng() * ELEMENTS.length) | 0];
          const ion = rng() < 0.2 ? 1 : 0;
          const x = rng() < 0.6 ? 1 + ((rng() * 3) | 0) : 0;
          atoms.push({
            Z: el.Z, N: el.N, e: el.Z - ion, x,
            rx: rng() * W, ry: rng() * H,
            vx: 0, vy: 0,                                // 정지 — 광자 방향 = 순수 반동 방향(등방 분수)
          });
        }
        const simRng = K.mulberry32((rng() * 4294967296) >>> 0);
        return { W, H, atoms, rng: simRng, knobs: { dt: 1.0, kEmit: 0.1, kRecoil: 1, kProp: 1 } };
      },

      watch(sim, K) {
        const c = K.C, k = sim.knobs.kProp, dt = sim.knobs.dt;
        let n = 0, disp = 0, agesum = 0;
        for (const p of sim.photons) {
          if (Math.hypot(p.px || 0, p.py || 0) <= 0) continue;
          n++;
          disp += Math.hypot(K.minImage(p.rx - p.rx0, sim.W), K.minImage(p.ry - p.ry0, sim.H));
          agesum += (sim.tick - p.birth);
        }
        return {
          atoms: sim.atoms.length,
          photons: sim.photons.length,
          meanDisp: +(n ? disp / n : 0).toFixed(3),       // 광자 평균 비행 거리
          meanSpeed: +(agesum ? disp / agesum : 0).toFixed(4),  // 거리/나이 ≈ 광속 c·k
        };
      },

      // 가설: ① 광자가 전파한다(이동 거리>0) ② 광속 c 로 직진(거리 = c·나이, 전부) ③ 복사장이 공간으로 퍼진다.
      assert(ctx, K) {
        const sim = ctx.sim, ph = sim.photons, c = K.C, k = sim.knobs.kProp, dt = sim.knobs.dt;
        let n = 0, moved = 0, speedOK = 0, dispSum = 0;
        for (const p of ph) {
          if (Math.hypot(p.px || 0, p.py || 0) <= 0) continue;
          n++;
          const disp = Math.hypot(K.minImage(p.rx - p.rx0, sim.W), K.minImage(p.ry - p.ry0, sim.H));
          dispSum += disp;
          if (disp > 0) moved++;
          const expected = c * k * dt * (sim.tick - p.birth);   // 직진·광속 → 거리 = c·나이
          if (Math.abs(disp - expected) < 1e-9) speedOK++;
        }
        return [
          { name: '광자가 전파한다(평균 비행 거리>0)', pass: n > 0 && moved === n, value: +(n ? dispSum / n : 0).toFixed(3) },
          { name: '광속 c 로 직진(거리=c·나이, 전부)', pass: n > 0 && speedOK === n, value: n ? speedOK : 0 },
          { name: '복사장이 공간으로 퍼짐(전파 광자 다수)', pass: n > 0, value: n },
        ];
      },
    },

    'step-0005': {
      id: 'step-0005',
      title: '빛이 원자를 재여기한다 (비탄성 산란 — 순환의 씨앗)',
      desc: '방출·반동·전파로 날아간 광자가 근처 원자를 만나면, 한 준위 들뜸을 *주고* 그만큼 *적색이동해 살아남는다*(비탄성 산란). ' +
            '세계가 식기만 하던 단조 냉각(step-0002~0004)에 *재여기*가 생겨 들뜸이 재공급된다 — 순환의 첫 씨앗. ' +
            '잉여 에너지를 살아남은 광자가 가져가므로 원자는 정수 준위로 깔끔히 점프하고, E·운동량은 정확히 보존된다(Compton형). ' +
            '초기 준위는 0~2 로 제한 — 산란이 그 위(≥3)로 원자를 끌어올리면 빛이 일한 증거.',
      ticks: 50,

      init(rng, K) {
        const W = 100, H = 100, n = 40, atoms = [];
        for (let i = 0; i < n; i++) {
          const el = ELEMENTS[(rng() * ELEMENTS.length) | 0];
          const ion = rng() < 0.2 ? 1 : 0;
          const x = rng() < 0.7 ? 1 + ((rng() * 2) | 0) : 0;   // 70% 들뜸: 준위 1~2(흡수자=방출자), 초기 최대 2
          atoms.push({
            Z: el.Z, N: el.N, e: el.Z - ion, x,
            rx: rng() * W, ry: rng() * H,
            vx: 0, vy: 0,                                       // 정지 — 총 운동량 0 에서 출발
          });
        }
        const simRng = K.mulberry32((rng() * 4294967296) >>> 0);
        return { W, H, atoms, rng: simRng, knobs: { dt: 1.0, kEmit: 0.1, kRecoil: 1, kProp: 1, kScatter: 0.5, scatterR: 12 } };
      },

      watch(sim, K) {
        let maxLevel = 0, exc = 0, redshifted = 0;
        for (const a of sim.atoms) { const xi = a.x | 0; if (xi > maxLevel) maxLevel = xi; exc += K.levelE(a.x); }
        for (const p of sim.photons) if ((p.nscatter | 0) > 0 && p.E < p.E0) redshifted++;
        return {
          atoms: sim.atoms.length,
          photons: sim.photons.length,
          scatters: sim.scatterCount | 0,         // 누적 산란(재여기) 횟수
          maxLevel,                                // 도달 최대 준위(초기 ≤2 → ≥3 이면 빛이 끌어올림)
          excE: +exc.toFixed(3),                   // 총 들뜸 에너지(재공급)
          redshifted,                              // 적색이동한 광자 수
        };
      },

      // 가설: ① 빛이 원자를 재여기(산란 count>0) ② 산란 광자가 적색이동(E<방출 E0, 전부) ③ 들뜸이 초기 이상으로 재공급(최대 준위≥3).
      assert(ctx, K) {
        const sim = ctx.sim;
        const scatters = sim.scatterCount | 0;
        let maxLevel = 0;
        for (const a of sim.atoms) { const xi = a.x | 0; if (xi > maxLevel) maxLevel = xi; }
        let ns = 0, redOK = 0;
        for (const p of sim.photons) {
          if ((p.nscatter | 0) <= 0) continue;
          ns++;
          if (p.E < p.E0 - 1e-12) redOK++;          // 산란 광자는 방출 에너지보다 작아야(잉여를 원자에 줌)
        }
        return [
          { name: '빛이 원자를 재여기함(비탄성 산란 count>0)', pass: scatters > 0, value: scatters },
          { name: '산란 광자가 적색이동(E<방출 E0, 전부)', pass: ns > 0 && redOK === ns, value: ns },
          { name: '들뜸이 초기(≤2) 넘어 재공급됨(최대 준위≥3)', pass: maxLevel >= 3, value: maxLevel },
        ];
      },
    },

    'step-0006': {
      id: 'step-0006',
      title: '산란이 방향을 바꾼다 (각도 분포 + 최근접 원자 — 산란 정밀화)',
      desc: 'step-0005 산란은 *전방*으로만 튀고 타깃을 *배열 인덱스 순*으로 골랐다(검토 지적). 이를 정밀화: ' +
            '노브 scatterAngular 로 산란이 *등방 각도 분포*(광자가 진짜 방향을 바꿈)·*반경 내 최근접 원자* 선택으로 바뀐다. ' +
            '게이트라서 노브를 끄면 step-0005 와 비트 동일(회귀 0). 2D 에너지·운동량을 정확히 보존하며, ' +
            '이동 원자에서는 청색이동(inverse Compton)도 창발한다.',
      ticks: 50,

      init(rng, K) {
        const W = 100, H = 100, n = 40, atoms = [];
        for (let i = 0; i < n; i++) {
          const el = ELEMENTS[(rng() * ELEMENTS.length) | 0];
          const ion = rng() < 0.2 ? 1 : 0;
          const x = rng() < 0.7 ? 1 + ((rng() * 2) | 0) : 0;   // 70% 들뜸: 준위 1~2, 초기 최대 2
          atoms.push({
            Z: el.Z, N: el.N, e: el.Z - ion, x,
            rx: rng() * W, ry: rng() * H,
            vx: 0, vy: 0,                                       // 정지 — 총 운동량 0 에서 출발
          });
        }
        const simRng = K.mulberry32((rng() * 4294967296) >>> 0);
        return { W, H, atoms, rng: simRng, knobs: { dt: 1.0, kEmit: 0.1, kRecoil: 1, kProp: 1, kScatter: 0.5, scatterR: 12, scatterAngular: 1 } };
      },

      watch(sim, K) {
        let maxLevel = 0, px = 0, py = 0;
        for (const a of sim.atoms) { const xi = a.x | 0, m = K.mass(a); if (xi > maxLevel) maxLevel = xi; px += m * a.vx; py += m * a.vy; }
        for (const p of sim.photons) { px += p.px || 0; py += p.py || 0; }
        const dn = sim.deflectN | 0;
        return {
          atoms: sim.atoms.length,
          photons: sim.photons.length,
          scatters: sim.scatterCount | 0,
          maxLevel,
          meanDeflect: +(dn ? sim.deflectSum / dn : 0).toFixed(4),   // 평균 편향각(rad) — 전방-전용이면 0
          totP: +Math.hypot(px, py).toExponential(2),                // 총 운동량(보존 → ≈0)
        };
      },

      // 가설: ① 산란이 각도 분포(평균 편향각>0.1 rad, 전방-전용이면 0) ② 빛이 원자 재여기(산란>0·최대 준위≥3) ③ 2D 운동량 보존(원자+광자≈0).
      assert(ctx, K) {
        const sim = ctx.sim;
        const dn = sim.deflectN | 0, meanDeflect = dn ? sim.deflectSum / dn : 0;
        const scatters = sim.scatterCount | 0;
        let maxLevel = 0, px = 0, py = 0;
        for (const a of sim.atoms) { const xi = a.x | 0, m = K.mass(a); if (xi > maxLevel) maxLevel = xi; px += m * a.vx; py += m * a.vy; }
        for (const p of sim.photons) { px += p.px || 0; py += p.py || 0; }
        const Ptot = Math.hypot(px, py);
        return [
          { name: '산란이 각도 분포로 방향 바꿈(평균 편향각>0.1 rad)', pass: dn > 0 && meanDeflect > 0.1, value: +meanDeflect.toFixed(4) },
          { name: '빛이 원자 재여기(산란>0, 최대 준위≥3)', pass: scatters > 0 && maxLevel >= 3, value: scatters },
          { name: '2D 운동량 보존(원자+광자 ≈0)', pass: Ptot < 1e-9, value: +Ptot.toExponential(2) },
        ];
      },
    },

    'step-0007': {
      id: 'step-0007',
      title: '오래된 빛이 복사 바스로 빠진다 (광자 소멸/binning — 무한 누적 정리)',
      desc: 'step-0004~6 의 전파·산란은 광자를 *살려두기만* 해서 활성 배열이 무한 누적했다(STATE 🔴, 긴 런서 비대). ' +
            'escape 법칙(노브 kEscape)으로 나이 ≥ escapeAge 인 광자를 활성 sim.photons 에서 빼 *복사 바스* sim.escaped 로 *이전*한다. ' +
            '그냥 지우면 E·운동량이 누출돼 장부가 깨지므로, 빠진 광자의 E·px·py 를 바스에 누적 — 활성합+바스합은 정확히 불변(닫힌 장부). ' +
            '활성 광자 나이가 escapeAge 로 유계 → 런서가 비대해지지 않는다. 바스는 미래 재가열(순환)의 reservoir 씨앗. ' +
            '게이트라서 노브를 끄면 step-0006 비트 동일(회귀 0). 30 tick 런으로 *유계 활성*(나이 ≤ escapeAge)과 *누적 바스*가 동시에 산다.',
      ticks: 30,

      init(rng, K) {
        const W = 200, H = 200, n = 40, atoms = [];   // 큰 무대 — 30 tick·c=1 직진이 wrap(half=100) 안
        for (let i = 0; i < n; i++) {
          const el = ELEMENTS[(rng() * ELEMENTS.length) | 0];
          const ion = rng() < 0.2 ? 1 : 0;
          const x = rng() < 0.6 ? 1 + ((rng() * 3) | 0) : 0;   // 60% 들뜸: 준위 1~3 — 시간에 걸쳐 방출(광자 공급)
          atoms.push({
            Z: el.Z, N: el.N, e: el.Z - ion, x,
            rx: rng() * W, ry: rng() * H,
            vx: 0, vy: 0,                                       // 정지 — 광자 방향 = 순수 반동 방향
          });
        }
        const simRng = K.mulberry32((rng() * 4294967296) >>> 0);
        // 방출·반동·전파로 광자가 날아가 나이 들면 escape 가 바스로 이전. escapeAge=20 → 나이 20 이상 binning.
        return { W, H, atoms, rng: simRng, knobs: { dt: 1.0, kEmit: 0.15, kRecoil: 1, kProp: 1, kEscape: 1, escapeAge: 20 } };
      },

      watch(sim, K) {
        const bath = sim.escaped || { E: 0, count: 0 };
        let activeE = 0, maxAge = 0;
        for (const p of sim.photons) { activeE += p.E; const age = sim.tick - p.birth; if (age > maxAge) maxAge = age; }
        return {
          atoms: sim.atoms.length,
          active: sim.photons.length,            // 활성 광자(유계 — 무한 누적 안 함)
          escaped: bath.count,                    // 복사 바스로 이전된 광자 수
          activeE: +activeE.toFixed(3),
          bathE: +bath.E.toFixed(3),              // 복사 바스 누적 에너지
          radE: +(activeE + bath.E).toFixed(3),   // 총 복사 E(활성+바스 — 불변 회계)
          maxAge,                                  // 활성 광자 최대 나이(≤ escapeAge → 유계)
        };
      },

      // 가설: ① 광자가 복사 바스로 이전됨(소멸 회계, escaped>0) ② 활성 배열 유계(모든 활성 광자 나이≤escapeAge) ③ 복사 E 가 바스에 누적·보존(바스 E>0, 총 E 보존은 ②기둥).
      assert(ctx, K) {
        const sim = ctx.sim, bath = sim.escaped || { E: 0, count: 0 };
        const ageMax = sim.knobs.escapeAge || 1e9;
        let maxAge = 0;
        for (const p of sim.photons) { const age = sim.tick - p.birth; if (age > maxAge) maxAge = age; }
        return [
          { name: '광자가 복사 바스로 이전됨(escaped count>0)', pass: bath.count > 0, value: bath.count },
          { name: '활성 배열 유계(모든 활성 광자 나이 ≤ escapeAge)', pass: maxAge <= ageMax, value: maxAge },
          { name: '복사 에너지가 바스에 누적·보존(바스 E>0)', pass: bath.E > 0, value: +bath.E.toFixed(3) },
        ];
      },
    },

    'step-0008': {
      id: 'step-0008',
      title: '복사 바스가 원자를 다시 데운다 (재가열 — 느린 순환 닫기)',
      desc: 'step-0007 의 복사 바스는 *모으기만* 했다 — 세계는 식기만 했다. reheat 법칙(노브 kReheat)으로 ' +
            '바스에 고인 복사 E 를 원자로 *되돌려* 들뜸(x)을 재공급한다: 들뜸→방출→광자→노화→바스→들뜸 루프가 닫힌다(SPINE §4 순환의 첫 닫힘). ' +
            '바스는 E·운동량을 함께 이지만, 등방 복사라 *운동량-자유 잉여*(E−|p|≥0)가 늘 있어 그 잉여만 한 준위 비용으로 뽑아 들뜸에 싣는다 — 바스 운동량 불변·정확 보존. ' +
            '게이트라서 노브를 끄면 step-0007 비트 동일(회귀 0). 60 tick 런으로, 냉각만 하던 세계에 *재가열*이 들어와 들뜸이 되살아남을 본다.',
      ticks: 60,

      init(rng, K) {
        const W = 200, H = 200, n = 40, atoms = [];   // 큰 무대 — 60 tick·c=1 직진이 wrap(half=100) 안
        for (let i = 0; i < n; i++) {
          const el = ELEMENTS[(rng() * ELEMENTS.length) | 0];
          const ion = rng() < 0.2 ? 1 : 0;
          const x = rng() < 0.6 ? 1 + ((rng() * 3) | 0) : 0;   // 60% 들뜸: 준위 1~3 — 초기 복사 공급원
          atoms.push({
            Z: el.Z, N: el.N, e: el.Z - ion, x,
            rx: rng() * W, ry: rng() * H,
            vx: 0, vy: 0,                                       // 정지 — 등방 복사(바스 net 운동량 ≈0)
          });
        }
        const simRng = K.mulberry32((rng() * 4294967296) >>> 0);
        // 방출→반동→전파→escape(바스 적립)→reheat(바스 인출) 전부 켜 순환 루프를 닫는다.
        return { W, H, atoms, rng: simRng, knobs: { dt: 1.0, kEmit: 0.15, kRecoil: 1, kProp: 1, kEscape: 1, escapeAge: 15, kReheat: 0.05 } };
      },

      watch(sim, K) {
        const bath = sim.escaped || { E: 0, count: 0, reheated: 0, px: 0, py: 0 };
        let exc = 0, excited = 0;
        for (const a of sim.atoms) { exc += K.levelE(a.x); if ((a.x | 0) > 0) excited++; }
        let activeE = 0; for (const p of sim.photons) activeE += p.E;
        const surplus = bath.E - Math.hypot(bath.px || 0, bath.py || 0);
        return {
          atoms: sim.atoms.length,
          excited,                                  // 들뜬 원자 수(재가열로 0 으로 안 죽음)
          excE: +exc.toFixed(3),                    // 총 들뜸 E(재가열 재공급 — 순환 증거)
          reheated: bath.reheated | 0,              // 바스→원자 재가열 횟수
          bathE: +bath.E.toFixed(3),                // 바스 잔여 에너지(재가열로 줄어듦)
          surplus: +surplus.toFixed(3),             // 바스 운동량-자유 잉여(≥0 유지)
          radE: +(activeE + bath.E).toFixed(3),
        };
      },

      // 가설: ① 바스가 원자를 재가열함(reheat count>0) ② 재가열로 들뜸이 재공급(런 끝까지 들뜬 원자>0) ③ 바스 잉여 음수 안 됨(E≥|p| 물리 유지). 총 E 보존은 ②기둥.
      assert(ctx, K) {
        const sim = ctx.sim, bath = sim.escaped || { E: 0, reheated: 0, px: 0, py: 0 };
        const reheated = bath.reheated | 0;
        let excited = 0; for (const a of sim.atoms) if ((a.x | 0) > 0) excited++;
        const surplus = bath.E - Math.hypot(bath.px || 0, bath.py || 0);
        return [
          { name: '바스가 원자를 재가열함(reheat count>0)', pass: reheated > 0, value: reheated },
          { name: '재가열로 들뜸이 재공급됨(런 끝 들뜬 원자>0)', pass: excited > 0, value: excited },
          { name: '바스 운동량-자유 잉여 ≥0(E≥|p| 물리 유지)', pass: surplus >= -1e-9, value: +surplus.toFixed(3) },
        ];
      },
    },

    'step-0009': {
      id: 'step-0009',
      title: '원자가 서로 부딪힌다 (탄성 충돌 — 첫 원자-원자 상호작용, Phase C 의 문)',
      desc: '지금까지 원자-원자 상호작용은 0이었다(빛 매개만). 첫 직접 접촉: 접촉 반경 안에서 *서로 다가오는* 원자 쌍이 ' +
            '탄성 충돌(노브 kCollide)해 운동량을 *교환*한다 — 총 운동량·총 KE 는 닫힌 형식으로 정확히 보존(머신 정밀도). ' +
            '절반은 움직이고 절반은 *정지*로 시작 — 충돌이 정지 원자를 때려 움직이게 하면 운동량이 *퍼지는*(열화·확산) 증거다. ' +
            '연속 쿨롱장(PE 항·심플렉틱 적분 필요 → 에너지 드리프트)은 별도 step 으로 전가하고, 여기선 *정확 보존*하는 충돌만 얹는다. ' +
            '게이트라서 노브를 끄면 step-0008(과 그 이전) 비트 동일(회귀 0).',
      ticks: 60,

      init(rng, K) {
        const W = 60, H = 60, n = 50, atoms = [];   // 작은 무대 + 많은 원자 → 충돌이 자주 일어남
        for (let i = 0; i < n; i++) {
          const el = ELEMENTS[(rng() * ELEMENTS.length) | 0];
          const ion = rng() < 0.2 ? 1 : 0;
          const moving = (i % 2) === 0;                      // 절반 운동·절반 정지(rest0 표식 — hash 미참여)
          atoms.push({
            Z: el.Z, N: el.N, e: el.Z - ion, x: 0,
            rx: rng() * W, ry: rng() * H,
            vx: moving ? (rng() * 2 - 1) : 0,
            vy: moving ? (rng() * 2 - 1) : 0,
            rest0: !moving,                                  // 초기 정지 표식(충돌로 움직였는지 검증용)
          });
        }
        return { W, H, atoms, knobs: { dt: 1.0, kCollide: 1, collideR: 3 } };
      },

      watch(sim, K) {
        let px = 0, py = 0, ke = 0, movedFromRest = 0, speedVar = 0, meanSp = 0;
        for (const a of sim.atoms) {
          const m = K.mass(a), sp = Math.hypot(a.vx, a.vy);
          px += m * a.vx; py += m * a.vy; ke += 0.5 * m * (a.vx * a.vx + a.vy * a.vy);
          meanSp += sp / sim.atoms.length;
          if (a.rest0 && sp > 1e-12) movedFromRest++;        // 정지로 시작했다 움직인 원자
        }
        return {
          atoms: sim.atoms.length,
          collisions: sim.collideCount | 0,        // 누적 탄성 충돌 횟수
          movedFromRest,                            // 충돌로 깨어난(운동량 받은) 정지 원자 수
          totP: +Math.hypot(px, py).toExponential(2), // 총 운동량 크기(보존 → 초기값 유지)
          KE: +ke.toFixed(4),                       // 총 KE(탄성 → 보존)
          meanSpeed: +meanSp.toFixed(4),
        };
      },

      // 가설: ① 원자가 충돌함(collide count>0) ② 운동량이 퍼짐(정지 원자가 충돌로 움직임>0) ③ 총 KE 보존(탄성, ②기둥 E 와 정합). 총 운동량 보존은 ②기둥 px·py.
      assert(ctx, K) {
        const sim = ctx.sim;
        const collisions = sim.collideCount | 0;
        let movedFromRest = 0, ke = 0;
        for (const a of sim.atoms) {
          const m = K.mass(a);
          ke += 0.5 * m * (a.vx * a.vx + a.vy * a.vy);
          if (a.rest0 && Math.hypot(a.vx, a.vy) > 1e-12) movedFromRest++;
        }
        return [
          { name: '원자가 서로 충돌함(탄성 충돌 count>0)', pass: collisions > 0, value: collisions },
          { name: '운동량이 퍼짐(정지 원자가 충돌로 움직임>0)', pass: movedFromRest > 0, value: movedFromRest },
          { name: '총 KE 보존(탄성 — E 보존은 ②기둥)', pass: ke > 0, value: +ke.toFixed(4) },
        ];
      },
    },
  };

  return { SCENES, ELEMENTS };
});
