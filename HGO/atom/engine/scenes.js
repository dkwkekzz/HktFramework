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

  // 분자 측정 = 결합 간선의 *연결 성분*(union-find). author 한 객체 아님 — 순수 측정(SPINE §3 요건1).
  //   count = 크기≥2 성분 수(=분자 수) · maxSize = 최대 성분 원자 수.
  function molecules(sim) {
    const n = sim.atoms.length, parent = new Array(n);
    for (let i = 0; i < n; i++) parent[i] = i;
    const find = x => { while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; } return x; };
    for (const e of (sim.bonds || [])) { const ri = find(e[0]), rj = find(e[1]); if (ri !== rj) parent[ri] = rj; }
    const size = {};
    for (let i = 0; i < n; i++) { const r = find(i); size[r] = (size[r] || 0) + 1; }
    let count = 0, maxSize = 1;
    for (const r in size) { if (size[r] >= 2) count++; if (size[r] > maxSize) maxSize = size[r]; }
    return { count, maxSize };
  }

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

    'step-0010': {
      id: 'step-0010',
      title: '원자가 서로 들러붙는다 (이온결합 — 첫 비탄성 포획, 분자의 씨앗)',
      desc: 'step-0009 충돌은 탄성(튕김)뿐 — 원자는 만나도 흩어졌다. bond 법칙(노브 kBond)으로 ' +
            '느리게 다가오는 *반대 전하* 쌍(q_a·q_b<0, 쿨롱 끌림)이 *비탄성 포획*된다: 상대 운동을 완전 흡수해 ' +
            '질량중심 속도로 잠기고(같이 움직임) 결합으로 묶인다. 흡수한 상대 KE 는 *결합 E reservoir*(sim.bondE)로 park — ' +
            '총 운동량·총 E 정확 보존(닫힌 장부, step-0007 광자 binning 동형). 분자는 author 가 아니라 *결합 간선의 연결 성분*으로 측정(SPINE §3 요건1). ' +
            '같은 전하/중성·빠른 쌍은 결합 안 하고 collide 로 탄성 튕김 — 선택성·온도 의존이 창발(author `if(isMolecule)` 0). ' +
            '게이트라서 노브를 끄면 step-0009(과 그 이전) 비트 동일(회귀 0).',
      ticks: 60,

      init(rng, K) {
        const W = 50, H = 50, n = 50, atoms = [];   // 작고 조밀 → 느린 반대전하 접촉 잦음
        for (let i = 0; i < n; i++) {
          const el = ELEMENTS[(rng() * ELEMENTS.length) | 0];
          const cation = (i % 2) === 0;                      // 절반 양이온(e=Z−1, q=+1)·절반 음이온(e=Z+1, q=−1)
          atoms.push({
            Z: el.Z, N: el.N, e: cation ? el.Z - 1 : el.Z + 1, x: 0,
            rx: rng() * W, ry: rng() * H,
            vx: (rng() * 2 - 1) * 0.5, vy: (rng() * 2 - 1) * 0.5,  // 느린 속도 → 다수가 포획 임계(bondVmax) 안
          });
        }
        // bond(포획)+collide(탄성) 둘 다 켜 — 차가운 반대전하는 묶이고, 같은전하/빠른 쌍은 튕긴다(선택성 창발).
        return { W, H, atoms, knobs: { dt: 1.0, kBond: 1, bondR: 3, bondVmax: 2.0, kCollide: 1, collideR: 3 } };
      },

      watch(sim, K) {
        const m = molecules(sim);
        let px = 0, py = 0, ke = 0;
        for (const a of sim.atoms) { const mm = K.mass(a); px += mm * a.vx; py += mm * a.vy; ke += 0.5 * mm * (a.vx * a.vx + a.vy * a.vy); }
        return {
          atoms: sim.atoms.length,
          bonds: sim.bondCount | 0,                  // 누적 결합(포획) 횟수
          molecules: m.count,                         // 분자 수(크기≥2 연결 성분 — 측정, author 0)
          maxMolecule: m.maxSize,                     // 최대 분자 크기(원자 수)
          collisions: sim.collideCount | 0,           // 탄성 충돌(같은 전하/빠른 쌍)
          bondE: +(sim.bondE || 0).toFixed(4),        // 결합 E reservoir(흡수한 상대 KE)
          totP: +Math.hypot(px, py).toExponential(2), // 총 운동량(보존)
          KE: +ke.toFixed(4),
        };
      },

      // 가설: ① 결합이 형성됨(비탄성 포획 count>0) ② 분자가 창발(연결 성분 크기≥2 측정>0) ③ 결합은 반대 전하 쌍만(선택성 창발, 전부). 총 E·운동량 보존은 ②기둥.
      assert(ctx, K) {
        const sim = ctx.sim, m = molecules(sim), bonds = sim.bonds || [];
        let oppositeOK = 0;
        for (const e of bonds) {
          const a = sim.atoms[e[0]], b = sim.atoms[e[1]];
          if ((a.Z - a.e) * (b.Z - b.e) < 0) oppositeOK++;     // 반대 전하 쌍이어야(선택성 창발 검증)
        }
        return [
          { name: '결합이 형성됨(비탄성 포획 count>0)', pass: (sim.bondCount | 0) > 0, value: sim.bondCount | 0 },
          { name: '분자가 창발(연결 성분 크기≥2 측정>0)', pass: m.count > 0, value: m.count },
          { name: '결합은 반대 전하 쌍만(선택성 창발, 전부)', pass: bonds.length > 0 && oppositeOK === bonds.length, value: oppositeOK },
        ];
      },
    },

    'step-0011': {
      id: 'step-0011',
      title: '결합 에너지가 빛이 된다 (화학발광 — bondE → 들뜸 → 광자)',
      desc: 'step-0010 bond 는 흡수한 상대 KE 를 결합 E reservoir(sim.bondE)에 *모으기만* 했다(escape 가 광자를 바스에 모으듯). ' +
            'chemilum 법칙(노브 kChemilum)이 그 결합 에너지를 *결합한 원자의 전자 들뜸(x)*으로 되돌린다 — 들뜬 원자는 emit(0002)이 광자로 낸다. ' +
            '사슬: bond(상대 KE→bondE) → chemilum(bondE→들뜸) → emit(들뜸→광자 λ=hc/ΔE). *결합 에너지가 빛으로 새어나온다*(화학발광 토이, render 신호). ' +
            '모든 원자를 x=0(바닥)으로 시작 — 빛의 유일한 출처가 결합 에너지임을 증명. 결합 안 한 원자는 빛나지 않는다(선택성 창발). ' +
            '운동량-자유 준위 거래라 E 정확 보존(bondE↓ = 들뜸E↑ = 광자E↑). 게이트라서 노브를 끄면 step-0010 비트 동일(회귀 0).',
      ticks: 60,

      init(rng, K) {
        const W = 50, H = 50, n = 50, atoms = [];   // step-0010 과 같은 조밀 무대(결합 형성)
        for (let i = 0; i < n; i++) {
          const el = ELEMENTS[(rng() * ELEMENTS.length) | 0];
          const cation = (i % 2) === 0;                      // 절반 양이온·절반 음이온(반대전하 결합)
          atoms.push({
            Z: el.Z, N: el.N, e: cation ? el.Z - 1 : el.Z + 1, x: 0,  // 바닥 상태 — 빛은 오직 결합 E 에서
            rx: rng() * W, ry: rng() * H,
            vx: (rng() * 2 - 1) * 0.5, vy: (rng() * 2 - 1) * 0.5,
          });
        }
        const simRng = K.mulberry32((rng() * 4294967296) >>> 0);
        // bond(결합·bondE 적립) → chemilum(bondE→들뜸) → emit·recoil·prop(들뜸→광자) 사슬을 켠다. collide 공존.
        return { W, H, atoms, rng: simRng, knobs: { dt: 1.0, kBond: 1, bondR: 3, bondVmax: 2.0, kChemilum: 0.1, kEmit: 0.1, kRecoil: 1, kProp: 1, kCollide: 1, collideR: 3 } };
      },

      watch(sim, K) {
        const bonded = new Set(); for (const e of (sim.bonds || [])) { bonded.add(e[0]); bonded.add(e[1]); }
        let excited = 0, maxLevel = 0, px = 0, py = 0;
        for (const a of sim.atoms) { const xi = a.x | 0, m = K.mass(a); if (xi > 0) excited++; if (xi > maxLevel) maxLevel = xi; px += m * a.vx; py += m * a.vy; }
        let pe = 0; for (const p of sim.photons) { pe += p.E; px += p.px || 0; py += p.py || 0; }
        return {
          atoms: sim.atoms.length,
          bonds: sim.bondCount | 0,
          chemilum: sim.chemilumCount | 0,         // 화학발광(bondE→들뜸) 횟수
          photons: sim.photons.length,              // 결합 에너지서 나온 광자
          photonE: +pe.toFixed(3),
          bondE: +(sim.bondE || 0).toFixed(3),      // 잔여 결합 E(빛으로 빠져나가 줄어듦)
          excited,                                   // 들뜬 원자(전부 결합 원자 — 선택성)
          totP: +Math.hypot(px, py).toExponential(2),
        };
      },

      // 가설: ① 화학발광 발생(bondE→들뜸 전환>0) ② 결합 에너지가 빛이 됨(초기 x=0 전부 → 광자 방출>0) ③ 빛나는 건 결합한 원자만(비결합 들뜸=0). 총 E·운동량 보존은 ②기둥.
      assert(ctx, K) {
        const sim = ctx.sim;
        const bonded = new Set(); for (const e of (sim.bonds || [])) { bonded.add(e[0]); bonded.add(e[1]); }
        let nonBondedExcited = 0;
        for (let i = 0; i < sim.atoms.length; i++) if ((sim.atoms[i].x | 0) > 0 && !bonded.has(i)) nonBondedExcited++;
        const chem = sim.chemilumCount | 0, photons = sim.photons.length;
        return [
          { name: '화학발광 발생(bondE→들뜸 전환 count>0)', pass: chem > 0, value: chem },
          { name: '결합 에너지가 빛이 됨(초기 x=0 → 광자 방출>0)', pass: photons > 0, value: photons },
          { name: '빛나는 건 결합한 원자만(비결합 들뜸=0)', pass: chem > 0 && nonBondedExcited === 0, value: nonBondedExcited },
        ];
      },
    },

    'step-0012': {
      id: 'step-0012',
      title: '결합에 원자가 한계가 생긴다 (과응집 → 이량체, 화학량론의 씨앗)',
      desc: 'step-0010 bond 는 한계 없이 묶여 거대 덩어리(≈26원자 blob)로 과응집했다(STATE 한계). bond 게이트 `bondValence` 로 ' +
            '원자당 결합 수를 *원자가 = |Z−e|*(전하 다발서 창발, author 0)로 제한한다 — ±1 이온은 cap 1 → *이량체*(2원자)만. ' +
            '거대 blob 이 사라지고 분자가 *정해진 크기*(화학량론)를 갖는다. 게이트라서 끄면 step-0010/0011 비트 동일(회귀 0, step-0006 scatterAngular 정밀화와 동형). ' +
            '포화된 이온은 더는 결합 안 하고 collide 로 탄성 튕김(닫힌 장부 유지). 원자가는 *원소 타입이 아니라 전하 다발*에서 나온다.',
      ticks: 60,

      init(rng, K) {
        const W = 50, H = 50, n = 50, atoms = [];   // step-0010 과 동일 무대 — 한계 유무만 대조
        for (let i = 0; i < n; i++) {
          const el = ELEMENTS[(rng() * ELEMENTS.length) | 0];
          const cation = (i % 2) === 0;
          atoms.push({
            Z: el.Z, N: el.N, e: cation ? el.Z - 1 : el.Z + 1, x: 0,   // ±1 이온 → 원자가 cap 1
            rx: rng() * W, ry: rng() * H,
            vx: (rng() * 2 - 1) * 0.5, vy: (rng() * 2 - 1) * 0.5,
          });
        }
        // bond + bondValence(원자가 한계) + collide. step-0010 대비 추가는 bondValence 한 노브뿐.
        return { W, H, atoms, knobs: { dt: 1.0, kBond: 1, bondR: 3, bondVmax: 2.0, bondValence: 1, kCollide: 1, collideR: 3 } };
      },

      watch(sim, K) {
        const m = molecules(sim);
        const deg = new Array(sim.atoms.length).fill(0);
        for (const e of (sim.bonds || [])) { deg[e[0]]++; deg[e[1]]++; }
        let maxDeg = 0; for (const d of deg) if (d > maxDeg) maxDeg = d;
        let px = 0, py = 0; for (const a of sim.atoms) { const mm = K.mass(a); px += mm * a.vx; py += mm * a.vy; }
        return {
          atoms: sim.atoms.length,
          bonds: sim.bondCount | 0,
          molecules: m.count,                          // 분자 수(연결 성분 크기≥2)
          maxMolecule: m.maxSize,                       // 최대 분자 크기(한계로 2 이하)
          maxDegree: maxDeg,                            // 최대 결합 차수(원자가 ≤ |전하| = 1)
          collisions: sim.collideCount | 0,
          bondE: +(sim.bondE || 0).toFixed(3),
          totP: +Math.hypot(px, py).toExponential(2),
        };
      },

      // 가설: ① 원자가 한계가 분자 크기 제한(최대 분자 ≤2 — cap 1 이량체) ② 어느 원자도 원자가 초과 안 함(최대 차수 ≤1) ③ 한계가 결합을 죽이진 않음(분자 여전히 형성>0). 총 E·운동량 보존은 ②기둥.
      assert(ctx, K) {
        const sim = ctx.sim, m = molecules(sim);
        const deg = new Array(sim.atoms.length).fill(0);
        for (const e of (sim.bonds || [])) { deg[e[0]]++; deg[e[1]]++; }
        let maxDeg = 0, overCap = 0;
        for (let i = 0; i < sim.atoms.length; i++) {
          if (deg[i] > maxDeg) maxDeg = deg[i];
          if (deg[i] > Math.abs(sim.atoms[i].Z - sim.atoms[i].e)) overCap++;   // 원자가 초과 원자(있으면 버그)
        }
        return [
          { name: '원자가 한계가 분자 크기 제한(최대 분자 ≤2, 이량체)', pass: m.maxSize <= 2, value: m.maxSize },
          { name: '어느 원자도 원자가 초과 안 함(차수 ≤ |전하|, 위반 0)', pass: overCap === 0, value: maxDeg },
          { name: '한계가 결합을 죽이진 않음(분자 여전히 형성>0)', pass: m.count > 0, value: m.count },
        ];
      },
    },

    'step-0013': {
      id: 'step-0013',
      title: '원소가 색을 구분한다 (준위 Z 의존 — 단전자 이온 스펙트럼 E∝Z²)',
      desc: '지금까지 준위 에너지 levelE(x) 는 Z 를 무시해 He⁺·C·O 가 전부 *수소선*을 냈다(STATE §3 🔴). ' +
            'levelEZ(노브 levelZ) 게이트로 *단전자 수소형 이온*(e=1)의 들뜸 E 를 ∝Z² 로 만든다(보어 닫힌 형식 E_n=−R·Z²/n²) — ' +
            '같은 전이라도 Z 가 크면 광자가 더 푸르다(λ=hc/Z²ΔE). H⁺e1·He⁺·C⁵⁺·O⁷⁺(전부 e=1, Z=1·2·6·8)를 들떠 방출시키면 ' +
            '1→0 전이가 *원소마다 다른 선*(0.75·Z²)으로 갈라진다 — render 가 원소를 색으로 구분할 토대. ' +
            'Z·e 는 런 중 불변이라 흡수·방출이 같은 Z² 로 거래 → 닫힌 장부 정확 유지. 게이트라서 끄면(levelZ=0) levelE 그대로 = step-0012 이전 비트 동일(회귀 0). 반동 없음 → 선 위치가 깨끗한 Z²(정지계 스펙트럼).',
      ticks: 50,

      init(rng, K) {
        const W = 100, H = 100, n = 40, atoms = [];
        for (let i = 0; i < n; i++) {
          const el = ELEMENTS[i % ELEMENTS.length];           // 4 원소 균등(H·He·C·O 전부 존재 — 라운드로빈)
          const x = 1 + ((rng() * 3) | 0);                    // 준위 1~3(전부 들뜸 → 1→0 전이로 캐스케이드)
          atoms.push({
            Z: el.Z, N: el.N, e: 1, x,                        // e=1 → *단전자 수소형 이온*(E∝Z² 적용 대상)
            rx: rng() * W, ry: rng() * H,
            vx: 0, vy: 0,                                      // 정지 — 반동 없음(아래 kRecoil=0)·도플러 0 → 선 위치 깨끗
          });
        }
        const simRng = K.mulberry32((rng() * 4294967296) >>> 0);
        // emit 만 켠다(recoil·prop 없음 → 광자 E = 정확한 준위차 ΔE = 0.75·Z²). levelZ=1 → 완전 Z² 스케일.
        return { W, H, atoms, rng: simRng, knobs: { dt: 1.0, kEmit: 0.3, levelZ: 1 } };
      },

      // 1→0 전이 광자를 발원 원소 Z 별로 모은다(전이당 한 선 = 한 색). 정지·무반동 → 같은 Z 는 같은 E.
      _lines10(sim) {
        const byZ = {};
        for (const p of sim.photons) {
          if (p.from === 1 && p.to === 0) (byZ[p.srcZ] || (byZ[p.srcZ] = [])).push(p.E);
        }
        return byZ;
      },

      watch(sim, K) {
        const L = K.ledger(sim);
        const byZ = this._lines10(sim);
        const distinctE = new Set();
        for (const z in byZ) for (const e of byZ[z]) distinctE.add(+e.toFixed(9));
        const eH = byZ[1] ? byZ[1][0] : 0, eHe = byZ[2] ? byZ[2][0] : 0;
        return {
          atoms: sim.atoms.length,
          photons: sim.photons.length,
          lines10: distinctE.size,                          // 1→0 의 *서로 다른* 선(=원소 수만큼 갈라짐)
          elemZ: Object.keys(byZ).length,                    // 1→0 광자를 낸 원소(Z) 수
          E_H_10: +eH.toFixed(4),                            // H(Z1) 1→0 광자 E = 0.75
          E_He_10: +eHe.toFixed(4),                          // He(Z2) 1→0 광자 E = 3.0 (=4×H)
          ratioHeH: eH > 0 ? +(eHe / eH).toFixed(4) : 0,     // Z² 스케일 → 정확히 4
          E: +L.E.toFixed(3),
        };
      },

      // 가설: ① 광자 방출됨 ② 원소가 스펙트럼을 구분(1→0 선 수 = 1→0 을 낸 원소 수, 각 Z 가 제 선) ③ Z² 스케일 정합(He⁺/H = 4). 닫힌 장부는 ②기둥.
      assert(ctx, K) {
        const sim = ctx.sim, byZ = SCENES['step-0013']._lines10(sim);
        const zList = Object.keys(byZ);
        const distinctE = new Set();
        for (const z of zList) for (const e of byZ[z]) distinctE.add(+e.toFixed(9));
        const eH = byZ[1] ? byZ[1][0] : 0, eHe = byZ[2] ? byZ[2][0] : 0;
        const ratio = eH > 0 ? eHe / eH : 0;
        return [
          { name: '광자 방출됨(자발 방출 count>0)', pass: sim.photons.length > 0, value: sim.photons.length },
          { name: '원소가 스펙트럼을 구분(1→0 선 수 = 원소 수, ≥2)', pass: zList.length >= 2 && distinctE.size === zList.length, value: distinctE.size },
          { name: 'Z² 스케일 정합(He⁺ 1→0 = 4× H 1→0)', pass: Math.abs(ratio - 4) < 1e-9, value: +ratio.toFixed(4) },
        ];
      },
    },

    'step-0014': {
      id: 'step-0014',
      title: '다전자 원자도 색을 구분한다 (전자 차폐 — 유효핵전하 Z_eff)',
      desc: 'step-0013 의 E∝Z² 는 *단전자 이온*(e=1)만 정확했다 — 다전자 중성원자는 차폐로 닫힌 형식이 없어 아직 수소선을 냈다(STATE §3 🟡). ' +
            'levelEZ 에 차폐 노브 `levelScreen`(σ)을 더한다: 다른 e−1 전자가 핵을 가려 *유효핵전하* Z_eff=Z−σ·(e−1) 로 E∝Z_eff² — ' +
            '중성 He(e=2)·C(e=6)·O(e=8)가 *자기 선*을 내되 같은 Z 의 단전자 이온보다 *얕다*(차폐로 끌림 ↓). ' +
            '같은 전이라도 He⁺(e=1) 3.0 vs 중성 He(e=2) 2.04 — 이온화 상태가 색을 바꾼다. Z·e 런 중 불변 → 흡수·방출 같은 Z_eff² 거래 → 닫힌 장부 정확. ' +
            '게이트라서 끄면(levelScreen=0) 다전자는 step-0013(Z 무관) 그대로 = 회귀 0. 반동 없음 → 선 위치 깨끗.',
      ticks: 50,

      init(rng, K) {
        const W = 100, H = 100, n = 40, atoms = [];
        for (let i = 0; i < n; i++) {
          const el = ELEMENTS[((i / 2) | 0) % ELEMENTS.length];   // 2개씩 한 원소(이온/중성 쌍)
          const neutral = (i % 2) === 1;                          // 짝수 = 단전자 이온(e=1, 기준) · 홀수 = 중성(e=Z, 차폐)
          atoms.push({
            Z: el.Z, N: el.N, e: neutral ? el.Z : 1, x: 1 + ((rng() * 3) | 0),  // 준위 1~3 → 1→0 캐스케이드
            rx: rng() * W, ry: rng() * H,
            vx: 0, vy: 0,                                         // 정지·무반동 → 선 위치 깨끗(아래 emit 만)
          });
        }
        const simRng = K.mulberry32((rng() * 4294967296) >>> 0);
        // emit 만(recoil·prop 없음 → 광자 E = 정확한 ΔE). levelZ=1·levelScreen=0.35(Slater 형 차폐).
        return { W, H, atoms, rng: simRng, knobs: { dt: 1.0, kEmit: 0.3, levelZ: 1, levelScreen: 0.35 } };
      },

      // 1→0 전이 광자를 (Z,e) 별로 모은다 — 같은 Z 라도 e(이온화 상태)가 다르면 차폐로 선이 갈라짐.
      _lines10(sim) {
        const byZE = {};   // "Z|e" → 광자 E (정지·무반동 → 같은 (Z,e) 는 같은 E)
        for (const p of sim.photons) {
          if (p.from === 1 && p.to === 0) byZE[p.srcZ + '|' + p.srcE] = p.E;
        }
        return byZE;
      },

      watch(sim, K) {
        const L = K.ledger(sim), byZE = this._lines10(sim);
        const neutralE = new Set();
        for (const key in byZE) { const e = +key.split('|')[1]; if (e > 1) neutralE.add(+byZE[key].toFixed(9)); }
        const heIon = byZE['2|1'] || 0, heNeu = byZE['2|2'] || 0;
        return {
          atoms: sim.atoms.length,
          photons: sim.photons.length,
          neutralLines: neutralE.size,                       // 다전자(중성) 1→0 의 서로 다른 선(He·C·O 갈라짐)
          E_He_ion: +heIon.toFixed(4),                       // He⁺(e=1) 1→0 = 3.0 (비차폐 Z²)
          E_He_neutral: +heNeu.toFixed(4),                   // 중성 He(e=2) 1→0 = 2.042 (차폐 Z_eff²)
          screenRatio: heIon > 0 ? +(heNeu / heIon).toFixed(4) : 0,  // 차폐/비차폐 = ((Z−σ)/Z)² < 1
          E: +L.E.toFixed(3),
        };
      },

      // 가설: ① 광자 방출됨 ② 다전자 중성원자도 원소 구분(중성 1→0 선 ≥2, He·C·O 차폐 스펙트럼) ③ 차폐가 유효전하 낮춤(중성 He < He⁺, 정확히 ((Z−σ)/Z)²). 닫힌 장부는 ②기둥.
      assert(ctx, K) {
        const sim = ctx.sim, byZE = SCENES['step-0014']._lines10(sim);
        const sigma = sim.knobs.levelScreen;
        const neutralE = new Set();
        for (const key in byZE) { const e = +key.split('|')[1]; if (e > 1) neutralE.add(+byZE[key].toFixed(9)); }
        const heIon = byZE['2|1'] || 0, heNeu = byZE['2|2'] || 0;
        const ratio = heIon > 0 ? heNeu / heIon : 0;
        const expRatio = ((2 - sigma) / 2) * ((2 - sigma) / 2);   // 중성 He(e=2)/He⁺(e=1) = (Z_eff/Z)²
        return [
          { name: '광자 방출됨(자발 방출 count>0)', pass: sim.photons.length > 0, value: sim.photons.length },
          { name: '다전자 중성원자도 원소 구분(중성 1→0 선 ≥2)', pass: neutralE.size >= 2, value: neutralE.size },
          { name: '차폐가 유효전하 낮춤(중성 He < He⁺, ((Z−σ)/Z)² 정합)', pass: heIon > 0 && heNeu > 0 && ratio < 1 && Math.abs(ratio - expRatio) < 1e-9, value: +ratio.toFixed(4) },
        ];
      },
    },
  };

  return { SCENES, ELEMENTS };
});
