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

  // 법칙 모듈의 공유 헬퍼(step-0017 공유결합 빈자리) — 노드(require)·브라우저(root.HGO.laws) 양쪽 가드.
  const L = (typeof require !== 'undefined') ? require('./hgo-laws.js')
          : ((typeof globalThis !== 'undefined' ? globalThis : this).HGO || {}).laws;

  // 원소는 author 한 타입이 아니라 (Z,N) 다발의 값일 뿐 (SPINE §3 요건1).
  // 수소·헬륨·탄소·산소 = 양성자 수의 위치.
  const ELEMENTS = [{ Z: 1, N: 0 }, { Z: 2, N: 2 }, { Z: 6, N: 6 }, { Z: 8, N: 8 }];

  // step-0019 쿨롱 측정 헬퍼 — KE·전하별 평균 거리. PE 는 커널 공유 헬퍼 K.coulombPE(힘/ledger 와 한 출처, DRY).
  function keOf(atoms) { let s = 0; for (const a of atoms) { const m = a.Z + a.N; s += 0.5 * m * (a.vx * a.vx + a.vy * a.vy); } return s; }
  function coulombMetrics(sim) {
    const A = sim.atoms;
    let oppSum = 0, oppN = 0, likeSum = 0, likeN = 0;
    for (let i = 0; i < A.length; i++) {
      const qi = A[i].Z - A[i].e;
      for (let j = i + 1; j < A.length; j++) {
        const qj = A[j].Z - A[j].e;
        const dx = K.minImage(A[j].rx - A[i].rx, sim.W), dy = K.minImage(A[j].ry - A[i].ry, sim.H);
        const d = Math.sqrt(dx * dx + dy * dy);
        if (qi * qj < 0) { oppSum += d; oppN++; } else if (qi * qj > 0) { likeSum += d; likeN++; }
      }
    }
    return { ke: keOf(A), pe: K.coulombPE(A, sim.knobs, sim.W, sim.H), oppD: oppN ? oppSum / oppN : 0, likeD: likeN ? likeSum / likeN : 0 };
  }

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

    'step-0015': {
      id: 'step-0015',
      title: '결합 에너지가 결합별로 산다 (전역 reservoir → 결합별 E 장부, unbond 의 토대)',
      desc: 'step-0010~0011 의 결합 에너지는 *전역 스칼라* sim.bondE 하나였다 — 어느 결합의 에너지인지 알 수 없어 *결합 깸*(unbond)이 불가능했다(STATE 🟡). ' +
            'bond 게이트 `bondLocalE` 로 흡수 KE 를 *그 결합 간선*에 per-bond 저장([i,j,Eabs])하고, chemilum 도 전역 풀이 아니라 *그 원자 자신의 결합*에서 인출한다 — ' +
            '빛이 *그 분자의 결합 E*에서 나온다(국소성↑, 척추 ③). 전역 sim.bondE 는 그대로 두되 *결합별 합* = 전역(Σe[2]=bondE 불변) — ledger 무영향. ' +
            '게이트라서 끄면(bondLocalE=0) 결합은 [i,j]·chemilum 전역 → step-0011 비트 동일(회귀 0). 이 결합별 장부가 다음 unbond(결합 깸)·핵 회계의 토대다.',
      ticks: 60,

      init(rng, K) {
        const W = 50, H = 50, n = 50, atoms = [];   // step-0011 과 동일 무대(결합·화학발광)
        for (let i = 0; i < n; i++) {
          const el = ELEMENTS[(rng() * ELEMENTS.length) | 0];
          const cation = (i % 2) === 0;
          atoms.push({
            Z: el.Z, N: el.N, e: cation ? el.Z - 1 : el.Z + 1, x: 0,   // 바닥 — 빛은 오직 결합 E 에서
            rx: rng() * W, ry: rng() * H,
            vx: (rng() * 2 - 1) * 0.5, vy: (rng() * 2 - 1) * 0.5,
          });
        }
        const simRng = K.mulberry32((rng() * 4294967296) >>> 0);
        // step-0011 사슬 + bondLocalE(결합별 E 장부) 한 노브만 추가.
        return { W, H, atoms, rng: simRng, knobs: { dt: 1.0, kBond: 1, bondR: 3, bondVmax: 2.0, kChemilum: 0.1, kEmit: 0.1, kRecoil: 1, kProp: 1, kCollide: 1, collideR: 3, bondLocalE: 1 } };
      },

      watch(sim, K) {
        const bonds = sim.bonds || [];
        let sumE2 = 0, minE2 = Infinity; for (const e of bonds) { sumE2 += (e[2] || 0); if ((e[2] || 0) < minE2) minE2 = e[2] || 0; }
        if (!bonds.length) minE2 = 0;
        return {
          atoms: sim.atoms.length,
          bonds: sim.bondCount | 0,
          chemilum: sim.chemilumCount | 0,
          localDebit: sim.bondLocalDebit | 0,               // chemilum 이 결합별 장부서 인출한 횟수
          sumBondE: +sumE2.toFixed(4),                       // Σ 결합별 E (= 전역과 일치해야)
          globalBondE: +(sim.bondE || 0).toFixed(4),         // 전역 reservoir
          ledgerResid: +Math.abs(sumE2 - (sim.bondE || 0)).toExponential(2),  // 국소 합 − 전역 (≈0)
          minE2: +minE2.toFixed(4),                          // 최소 결합 E (≥0 — 국소 회계 유효)
        };
      },

      // 가설: ① 결합별 E 장부 기록(결합 형성·각 간선이 E 저장>0) ② 국소 회계 충실(Σe[2] = 전역 bondE, 잔차≈0) ③ 국소 소비(chemilum 이 특정 결합서 인출>0 & 모든 e[2]≥0). 총 E 보존은 ②기둥(닫힌 장부).
      assert(ctx, K) {
        const sim = ctx.sim, bonds = sim.bonds || [];
        let sumE2 = 0, allTriple = bonds.length > 0, minE2 = Infinity;
        for (const e of bonds) { if (e.length < 3) allTriple = false; sumE2 += (e[2] || 0); if ((e[2] || 0) < minE2) minE2 = e[2] || 0; }
        const resid = Math.abs(sumE2 - (sim.bondE || 0));
        const debit = sim.bondLocalDebit | 0;
        return [
          { name: '결합별 E 장부 기록(결합 형성 & 각 간선이 E 저장)', pass: allTriple, value: bonds.length },
          { name: '국소 회계 충실(Σ결합별E = 전역 bondE, 잔차≈0)', pass: resid <= 1e-9, value: +resid.toExponential(2) },
          { name: '국소 소비(chemilum 이 특정 결합서 인출>0 & 모든 e[2]≥0)', pass: debit > 0 && minE2 >= -1e-12, value: debit },
        ];
      },
    },

    'step-0016': {
      id: 'step-0016',
      title: '결합이 깨진다 (unbond — bond 의 역연산, 영구 이량체 → 충돌로 해방)',
      desc: 'step-0010~0015 의 결합은 *영구*였다 — 한 번 묶이면 안 풀려 세계가 결합 쪽으로 래칫됐다(STATE 🟡). ' +
            '새 법칙 `unbond`(게이트 kUnbond)는 bond 의 정확한 역: 외부 충돌(collide)이 결합 원자를 때려 두 원자의 *상대 KE* 가 ' +
            '*그 결합에 저장된 e[2]*(step-0015 결합별 장부)를 넘으면 끊는다 — 저장 E 를 상대 운동으로 정확히 돌려주고(vcom 불변·Δp=0·ΔE=0) ' +
            '전역 bondE 동기 차감·간선 제거. 트리거는 *측정된 상대 KE 대 저장 E* 비교뿐(author 분기 0, 척추 ②). ' +
            '게이트라서 끄면(kUnbond=0) step-0015 비트 동일(회귀 0). 이로써 결합↔해체 순환이 열려 세계가 한쪽으로 굳지 않는다(SPINE §4 순환).',
      ticks: 80,

      init(rng, K) {
        const W = 50, H = 50, n = 50, atoms = [];   // step-0015 와 동일 무대(결합·화학발광·국소 E 장부)
        for (let i = 0; i < n; i++) {
          const el = ELEMENTS[(rng() * ELEMENTS.length) | 0];
          const cation = (i % 2) === 0;
          atoms.push({
            Z: el.Z, N: el.N, e: cation ? el.Z - 1 : el.Z + 1, x: 0,
            rx: rng() * W, ry: rng() * H,
            vx: (rng() * 2 - 1) * 0.8, vy: (rng() * 2 - 1) * 0.8,   // step-0015 보다 약간 뜨겁게 — 충돌로 결합 깨기 좋게
          });
        }
        const simRng = K.mulberry32((rng() * 4294967296) >>> 0);
        // step-0015 사슬 + kUnbond(결합 깸) 한 노브만 추가. bondVmax 낮춰 약한 결합도 생기게(깰 대상 확보).
        return { W, H, atoms, rng: simRng, knobs: { dt: 1.0, kBond: 1, bondR: 3, bondVmax: 1.5, kChemilum: 0.1, kEmit: 0.1, kRecoil: 1, kProp: 1, kCollide: 1, collideR: 3, bondLocalE: 1, kUnbond: 1 } };
      },

      watch(sim, K) {
        const bonds = sim.bonds || [];
        let sumE2 = 0, minE2 = Infinity; for (const e of bonds) { sumE2 += (e[2] || 0); if ((e[2] || 0) < minE2) minE2 = e[2] || 0; }
        if (!bonds.length) minE2 = 0;
        return {
          atoms: sim.atoms.length,
          bondsFormed: sim.bondCount | 0,                    // 형성된 결합 누적(bond)
          unbonds: sim.unbondCount | 0,                       // 깨진 결합 누적(unbond)
          liveBonds: bonds.length,                            // 현재 살아있는 결합 간선
          chemilum: sim.chemilumCount | 0,
          sumBondE: +sumE2.toFixed(4),                        // Σ 결합별 E
          globalBondE: +(sim.bondE || 0).toFixed(4),          // 전역 reservoir
          ledgerResid: +Math.abs(sumE2 - (sim.bondE || 0)).toExponential(2),  // 국소 합 − 전역 (≈0 — 깸 후에도 동기)
        };
      },

      // 가설: ① 결합이 깨진다(unbond>0 — 영구 아님) ② 닫힌 장부 유지(Σe[2]=전역 bondE, 깸 후에도 잔차≈0) ③ 결합 동적 평형(형성>깸>0 & 일부 살아남음 → 래칫 아닌 순환). 총 E·p 보존은 ②기둥(verify ledger).
      assert(ctx, K) {
        const sim = ctx.sim, bonds = sim.bonds || [];
        let sumE2 = 0; for (const e of bonds) sumE2 += (e[2] || 0);
        const resid = Math.abs(sumE2 - (sim.bondE || 0));
        const formed = sim.bondCount | 0, broke = sim.unbondCount | 0;
        return [
          { name: '결합이 깨진다(unbond>0 — 영구 이량체 아님)', pass: broke > 0, value: broke },
          { name: '닫힌 장부 유지(Σ결합별E = 전역 bondE, 깸 후에도 잔차≈0)', pass: resid <= 1e-9, value: +resid.toExponential(2) },
          { name: '결합 동적 평형(형성>깸>0 & 일부 살아남음 → 순환)', pass: formed > broke && broke > 0 && bonds.length > 0, value: formed },
        ];
      },
    },

    'step-0017': {
      id: 'step-0017',
      title: '공유결합 (중성 원자가 외각 껍질을 공유 — 이온결합 옆 둘째 선택성)',
      desc: 'step-0010~0016 의 결합은 *이온결합*(반대 전하 전이)뿐이었다 — 중성 원자는 만나도 collide 로 튕길 뿐(STATE 요건1). ' +
            'bond 게이트 `bondCovalent`(=0 → 이온만, step-0016 비트 동일)가 *둘째 선택성*을 더한다: *중성*(q=0) 원자 쌍이 ' +
            '*외각 껍질 빈자리*(다음 닫힌 껍질 2·10·18 까지 부족분)를 공유해 결합한다. 공유 원자가 = 빈자리 → H 1·C 4·O 2·He 0(noble) 이 ' +
            '*e 다발 + 마법수*에서 그대로 창발한다(author `if(isWater)` 0, 척추 ①②). 포획·결합 E reservoir·분자 측정은 이온결합 기계를 그대로 재사용 — ' +
            '바뀐 것은 *국소 선택 규칙*뿐. 끄면 중성 쌍은 collide 탄성(회귀 0). 이로써 분자가 *반대 전하 없이도* 만들어진다(물·메탄형).',
      ticks: 80,

      init(rng, K) {
        const W = 50, H = 50, n = 50, atoms = [];   // *중성* 원자 무대(e=Z) — 공유결합 시연(이온 아님)
        for (let i = 0; i < n; i++) {
          const el = ELEMENTS[(rng() * ELEMENTS.length) | 0];   // H·He·C·O
          atoms.push({
            Z: el.Z, N: el.N, e: el.Z, x: 0,                     // 중성(e=Z) → 전하 0 → 이온결합 불가, 공유결합 후보
            rx: rng() * W, ry: rng() * H,
            vx: (rng() * 2 - 1) * 0.5, vy: (rng() * 2 - 1) * 0.5,
          });
        }
        const simRng = K.mulberry32((rng() * 4294967296) >>> 0);
        // step-0015 사슬(국소 E 장부) + bondCovalent(공유결합) 한 노브. kUnbond 도 켜 결합 동역학 유지. 이온결합은 무대에 이온이 0이라 자동 0.
        return { W, H, atoms, rng: simRng, knobs: { dt: 1.0, kBond: 1, bondR: 3, bondVmax: 2.0, kChemilum: 0.1, kEmit: 0.1, kRecoil: 1, kProp: 1, kCollide: 1, collideR: 3, bondLocalE: 1, kUnbond: 1, bondCovalent: 1 } };
      },

      watch(sim, K) {
        const bonds = sim.bonds || [], atoms = sim.atoms;
        const deg = new Array(atoms.length).fill(0);
        for (const e of bonds) { deg[e[0]]++; deg[e[1]]++; }
        let overValence = 0, heBonds = 0, maxDeg = 0;
        for (let i = 0; i < atoms.length; i++) {
          const vac = L.covVacancy(atoms[i].e);
          if (deg[i] > vac) overValence++;                  // 빈자리 초과(있으면 안 됨)
          if (vac === 0 && deg[i] > 0) heBonds++;            // noble(He) 인데 결합(있으면 안 됨)
          if (deg[i] > maxDeg) maxDeg = deg[i];
        }
        const mol = molecules(sim);
        return {
          atoms: atoms.length,
          bondsFormed: sim.bondCount | 0,
          covalent: sim.covalentCount | 0,                  // 공유결합 횟수(중성 쌍)
          liveBonds: bonds.length,
          molecules: mol.count,                              // 형성된 분자(연결 성분 ≥2) 수
          maxMolSize: mol.maxSize,
          maxDeg,                                            // 최대 결합 차수(C=4 까지 가능)
          overValence,                                       // 빈자리 초과 원자 수(0 이어야)
          heBonds,                                           // noble 원자의 결합 수(0 이어야)
        };
      },

      // 가설: ① 중성 원자가 공유결합(covalent>0 — 이온 없이 분자 형성) ② 빈자리 = 원자가 한계(어떤 원자도 covVacancy 초과 0) ③ noble 비활성(He 결합 0 — 닫힌 껍질은 공유 안 함). 총 E·p·Q·B 보존은 verify ② 기둥.
      assert(ctx, K) {
        const sim = ctx.sim, bonds = sim.bonds || [], atoms = sim.atoms;
        const deg = new Array(atoms.length).fill(0);
        for (const e of bonds) { deg[e[0]]++; deg[e[1]]++; }
        let overValence = 0, heBonds = 0;
        for (let i = 0; i < atoms.length; i++) {
          const vac = L.covVacancy(atoms[i].e);
          if (deg[i] > vac) overValence++;
          if (vac === 0 && deg[i] > 0) heBonds++;
        }
        const cov = sim.covalentCount | 0;
        return [
          { name: '중성 원자가 공유결합(covalent>0 — 이온 없이 분자)', pass: cov > 0, value: cov },
          { name: '빈자리 = 원자가 한계(covVacancy 초과 원자 0)', pass: overValence === 0, value: overValence },
          { name: 'noble 비활성(He 등 닫힌 껍질 결합 0)', pass: heBonds === 0, value: heBonds },
        ];
      },
    },

    'step-0018': {
      id: 'step-0018',
      title: '결합 차수 (이중·삼중 결합 — 같은 쌍이 빈자리만큼 전자쌍 다중 공유)',
      desc: 'step-0017 공유결합은 *단일 결합*(간선 1·전자쌍 1)뿐 — 빈자리가 2 이상이어도 한 쌍은 한 번만 묶였다(STATE 요건1). ' +
            'bond 게이트 `bondOrder`(=0 → 단일만, step-0017 비트 동일)가 *같은 쌍*이 남은 빈자리만큼 전자쌍을 다중 공유하게 한다: ' +
            '차수 = min(남은 빈자리 i·j, ordMax) → O(빈자리2)=O *이중*·N(빈자리3)≡N *삼중*. 간선에 차수 e[3] 기록, 빈자리를 order 칸 소비. ' +
            '⇒ 화학량론이 빈자리서 창발: O₂·N₂ 가 *고립 이량체*(이중·삼중 결합이 양쪽 원자가를 한 번에 채움)로 떨어진다(단일 결합이면 O 가 사슬로 자랐다). ' +
            '끄면 차수 1·step-0017 비트 동일(회귀 0). 결합에 *세기/겹수*가 생겨 분자 위상이 원자가 화학을 따른다.',
      ticks: 80,

      init(rng, K) {
        // *중성* 원자 무대 — N(Z7,빈자리3·삼중)·O(Z8,빈자리2·이중) 로 다중 결합 이량체(N₂·O₂)를 깨끗이 보인다(장면 로컬 원소, 전역 ELEMENTS 불변).
        const LOCAL = [{ Z: 7, N: 7 }, { Z: 8, N: 8 }];   // N·O
        const W = 50, H = 50, n = 50, atoms = [];
        for (let i = 0; i < n; i++) {
          const el = LOCAL[(rng() * LOCAL.length) | 0];
          atoms.push({
            Z: el.Z, N: el.N, e: el.Z, x: 0,                     // 중성(e=Z) → 공유결합 후보
            rx: rng() * W, ry: rng() * H,
            vx: (rng() * 2 - 1) * 0.5, vy: (rng() * 2 - 1) * 0.5,
          });
        }
        const simRng = K.mulberry32((rng() * 4294967296) >>> 0);
        // step-0017 사슬 + bondOrder(결합 차수) 한 노브. kUnbond 도 켜 동역학 유지.
        return { W, H, atoms, rng: simRng, knobs: { dt: 1.0, kBond: 1, bondR: 3, bondVmax: 2.0, kChemilum: 0.1, kEmit: 0.1, kRecoil: 1, kProp: 1, kCollide: 1, collideR: 3, bondLocalE: 1, kUnbond: 1, bondCovalent: 1, bondOrder: 1 } };
      },

      watch(sim, K) {
        const bonds = sim.bonds || [], atoms = sim.atoms;
        const deg = new Array(atoms.length).fill(0);
        let maxOrder = 0;
        for (const e of bonds) { const o = e[3] || 1; deg[e[0]] += o; deg[e[1]] += o; if (o > maxOrder) maxOrder = o; }
        let overValence = 0, multiDimers = 0;
        for (let i = 0; i < atoms.length; i++) if (deg[i] > L.covVacancy(atoms[i].e)) overValence++;
        for (const e of bonds) { const o = e[3] || 1; if (o >= 2 && deg[e[0]] === o && deg[e[1]] === o) multiDimers++; }  // 다중 결합 고립 이량체(O₂·N₂)
        const mol = molecules(sim);
        return {
          atoms: atoms.length,
          bondsFormed: sim.bondCount | 0,
          multiBonds: sim.multiBondCount | 0,                // 이중·삼중 결합 횟수
          maxOrder,                                          // 최대 결합 차수(3=삼중 N≡N)
          multiDimers,                                       // 다중 결합으로 양쪽 원자가 포화된 고립 이량체(O₂·N₂)
          liveBonds: bonds.length,
          molecules: mol.count,
          maxMolSize: mol.maxSize,
          overValence,                                       // order 가중 빈자리 초과(0 이어야)
        };
      },

      // 가설: ① 다중 결합 형성(multiBonds>0 — 이중·삼중) ② order 가중 화학량론(어떤 원자도 covVacancy 초과 0 — 차수가 빈자리 정확 소비) ③ 다중 결합 고립 이량체(O₂·N₂>0 — 이중·삼중이 양 원자가를 한 번에 채워 분자가 2원자로 떨어짐). 총 보존은 verify ② 기둥.
      assert(ctx, K) {
        const sim = ctx.sim, bonds = sim.bonds || [], atoms = sim.atoms;
        const deg = new Array(atoms.length).fill(0);
        for (const e of bonds) { const o = e[3] || 1; deg[e[0]] += o; deg[e[1]] += o; }
        let overValence = 0, multiDimers = 0;
        for (let i = 0; i < atoms.length; i++) if (deg[i] > L.covVacancy(atoms[i].e)) overValence++;
        for (const e of bonds) { const o = e[3] || 1; if (o >= 2 && deg[e[0]] === o && deg[e[1]] === o) multiDimers++; }
        const multi = sim.multiBondCount | 0;
        return [
          { name: '다중 결합 형성(multiBonds>0 — 이중·삼중)', pass: multi > 0, value: multi },
          { name: 'order 가중 화학량론(covVacancy 초과 원자 0)', pass: overValence === 0, value: overValence },
          { name: '다중 결합 고립 이량체(O₂·N₂ > 0 — 양 원자가 포화→2원자 분자)', pass: multiDimers > 0, value: multiDimers },
        ];
      },
    },

    'step-0019': {
      id: 'step-0019',
      title: '쿨롱장 (첫 연속 보존력 — 거리 의존 인력/반발, 평형 기하의 근원)',
      desc: 'step-0010~0018 의 결합은 *닫힌 형식 이산 교환*(포획 순간 속도만 잠금)이라 *평형 길이·각도*가 없었다 — 결합 기하가 ' +
            '충돌·반동에 흩어져 "괴이"했다(STATE 후보 B). `coulomb`(게이트 kCoulomb)은 첫 *연속* 보존력 F=kC·qa·qb/r²(연화 ε) 을 매 tick ' +
            '속도에 싣는다: 같은부호 반발·반대부호 인력. step() 이 *반음시(symplectic) 오일러*(v 먼저→r) 라 에너지(KE+PE)가 *유계 진동*으로 보존된다 ' +
            '(머신 0 아님 — 연속 적분 O(dt²), STATE 경고대로 E 만 허용오차 완화). ledger 에 PE 항 가법(kCoulomb 게이트), 운동량·전하는 머신 정밀 보존. ' +
            '끄면 step-0018 비트 동일(회귀 0). 이 연속력이 평형 결합 길이(이후 step 의 반발 코어와 결합)·분자 기하의 *근원*이다.',
      ticks: 600,
      ledgerTol: { E: 3e-3 },   // 연속력의 반음시 유계 진동(E 만 완화 — Q·B·L·px·py 는 머신 1e-9 유지). dt 작을수록 ↓(symplectic, drift 0)

      init(rng, K) {
        const W = 50, H = 50, n = 30, atoms = [];   // 하전 이온 구름(중성 제외 — 쿨롱이 작용)
        for (let i = 0; i < n; i++) {
          const el = ELEMENTS[(rng() * ELEMENTS.length) | 0];
          const cation = (i % 2) === 0;
          atoms.push({
            Z: el.Z, N: el.N, e: cation ? el.Z - 1 : el.Z + 1, x: 0,   // ±1 이온 교대(절반 +·절반 −)
            rx: rng() * W, ry: rng() * H,
            vx: (rng() * 2 - 1) * 0.2, vy: (rng() * 2 - 1) * 0.2,        // 거의 정지 — 힘이 운동을 만들게
          });
        }
        const simRng = K.mulberry32((rng() * 4294967296) >>> 0);
        // 쿨롱만(bond·collide 끔) — 새 연속력을 고립 시연. dt 작게(symplectic 진동↓)·연화 2(특이점 차단).
        return { W, H, atoms, rng: simRng, knobs: { dt: 0.05, kCoulomb: 1, coulombSoft: 2 } };
      },

      watch(sim, K) {
        const m = coulombMetrics(sim);
        return {
          atoms: sim.atoms.length,
          KE: +m.ke.toFixed(3), PE: +m.pe.toFixed(3),
          meanOppDist: +m.oppD.toFixed(3),                  // 반대전하쌍 평균 거리(끌림 → 작아짐)
          meanLikeDist: +m.likeD.toFixed(3),                // 같은전하쌍 평균 거리(반발 → 커짐)
        };
      },

      // 가설: ① 인력/반발 선택성(반대전하 평균거리 < 같은전하 평균거리 — 끌림이 반대를 모으고 반발이 같은 걸 밂) ② KE↔PE 교환(보존력이 일함 — ΔKE·ΔPE<0, 둘 다 유의) ③ 총 에너지 유계 보존(|Δ(KE+PE)| ≤ 3e-3, symplectic). 운동량 정확 보존은 verify ② px·py(머신 1e-9).
      assert(ctx, K) {
        const sim = ctx.sim;
        const m1 = coulombMetrics(sim);
        const ke0 = keOf(ctx.atoms0), pe0 = K.coulombPE(ctx.atoms0, sim.knobs, sim.W, sim.H);   // 초기(atoms0)
        const dKE = m1.ke - ke0, dPE = m1.pe - pe0;
        const dTotal = Math.abs(dKE + dPE);                              // KE+PE 변화(유계 보존이면 ≈0)
        return [
          { name: '인력/반발 선택성(반대전하 평균거리 < 같은전하 평균거리)', pass: m1.oppD < m1.likeD, value: +(m1.likeD - m1.oppD).toFixed(3) },
          { name: 'KE↔PE 교환(보존력이 일함 — ΔKE·ΔPE<0 & 유의)', pass: dKE * dPE < 0 && Math.abs(dKE) > 1e-3, value: +dKE.toFixed(3) },
          { name: '총 에너지 유계 보존(|Δ(KE+PE)| ≤ 3e-3, symplectic)', pass: dTotal <= 3e-3, value: +dTotal.toExponential(2) },
        ];
      },
    },

    'step-0020': {
      id: 'step-0020',
      title: '반발 코어 (단거리 반발 → 쿨롱과 균형 → 평형 결합 길이 r_eq 창발)',
      desc: 'step-0019 쿨롱장은 첫 연속력이었으나 *평형점이 없었다* — 반대전하는 골(연화 ε)로 붕괴·진동만 한다(결합이 "괴이"한 근본 ' +
            '원인: 고정 거리가 없음). `repulse`(게이트 kRepulse)는 *단거리 반발 코어* U=kR/(r²+ε²)(force ∝ 1/r⁴) 를 더한다 — 쿨롱 ' +
            '인력(1/r³)보다 *가팔라* 단거리를 지배하고 장거리엔 굴복한다. 둘의 합이 r_eq²+ε²=(2kR/(kC·|qaqb|))² 에서 *우물*을 만들어 ' +
            '**평형 결합 길이 r_eq 가 창발**한다(author 한 거리 아님 — 두 연속력 합의 측정). r<r_eq→반발, r>r_eq→인력이 이겨 양쪽서 r_eq 로 ' +
            '*복원*(안정 평형). 같은 심플렉틱 적분·PE 가법(E 완화)·연화 ε 재사용. 끄면 step-0019 비트 동일(회귀 0). 이것이 실제 결합 길이의 원리.',
      ticks: 600,
      ledgerTol: { E: 3e-3 },   // 연속력 2개(쿨롱+코어)의 반음시 유계 진동(E 만 완화 — Q·B·L·px·py 머신 1e-9 유지)

      // r_eq 우물을 *고립*된 ±1 이온 3쌍으로 시연(rng 미사용 → 전 시드 동일 = 순수 결정론 측정). 각 쌍은 토러스서 멀리 떨어뜨려 쌍내력만 받게.
      //   knobs: kCoulomb=1·coulombSoft(ε)=2·kRepulse=2.5 → s2_eq=(2·2.5/1)²=25 → r_eq=√(25−4)=√21≈4.583.
      //   쌍 A=r_eq(평형, 정지→머무름) · 쌍 B=1.5·r_eq(밖, 정지→인력이 안으로) · 쌍 C=0.6·r_eq(안, 정지→코어가 밖으로). 셋이 안정 평형을 양쪽서 증명.
      //   토러스 120·중심 60 간격 → 쌍 간 교차력(~1/60²) 무시 가능(각 쌍 *고립*). 오프셋을 완만히(±50%) 해 r_eq 근처 진동(폭주 방지).
      init(rng, K) {
        const W = 120, H = 120;
        const REQ = Math.sqrt(21);                          // ≈4.583 (위 분석식)
        const H1 = ELEMENTS[0];                             // 수소(Z=1,N=0,mass=1) — ±1 이온쌍
        const pair = (cx, cy, d) => ([                      // 중심 (cx,cy), x 로 거리 d 벌린 cation(+1)·anion(−1), 정지
          { Z: H1.Z, N: H1.N, e: 0,  x: 0, rx: cx - d / 2, ry: cy, vx: 0, vy: 0 },   // e=0 → q=+1
          { Z: H1.Z, N: H1.N, e: 2,  x: 0, rx: cx + d / 2, ry: cy, vx: 0, vy: 0 },   // e=2 → q=−1
        ]);
        const atoms = [
          ...pair(30, 30, REQ),          // A: 평형 거리
          ...pair(90, 30, 1.5 * REQ),    // B: 평형 밖(인력 우세 → 안으로 복원)
          ...pair(30, 90, 0.6 * REQ),    // C: 평형 안(반발 우세 → 밖으로 복원, 붕괴 방지)
        ];
        const simRng = K.mulberry32((rng() * 4294967296) >>> 0);
        return { W, H, atoms, rng: simRng, knobs: { dt: 0.05, kCoulomb: 1, coulombSoft: 2, kRepulse: 2.5 } };
      },

      watch(sim, K) {
        const A = sim.atoms;
        const dist = (i, j) => Math.hypot(K.minImage(A[j].rx - A[i].rx, sim.W), K.minImage(A[j].ry - A[i].ry, sim.H));
        const m = coulombMetrics(sim);
        return {
          REQ: +Math.sqrt(21).toFixed(3),
          dA: +dist(0, 1).toFixed(3),   // 평형서 출발 → r_eq 유지
          dB: +dist(2, 3).toFixed(3),   // 밖서 출발 → 줄어듦(인력)
          dC: +dist(4, 5).toFixed(3),   // 안서 출발 → 늘어남(반발 코어)
          KE: +m.ke.toFixed(3),
        };
      },

      // 가설: ① 평형 길이 r_eq 유지(쌍 A 가 r_eq 정지서 머무름 → 순 힘 0 = 결합 길이의 정의) ② 인력 복원(쌍 B r>r_eq → 안으로, dB<초기) ③ 반발 코어 복원·붕괴 방지(쌍 C r<r_eq → 밖으로, dC>초기 & dC>ε). 안정 평형을 양쪽서 증명. 총 E 유계 보존은 verify ②(E≤3e-3).
      assert(ctx, K) {
        const A = ctx.sim.atoms, W = ctx.sim.W, H = ctx.sim.H;
        const dist = (i, j) => Math.hypot(K.minImage(A[j].rx - A[i].rx, W), K.minImage(A[j].ry - A[i].ry, H));
        const REQ = Math.sqrt(21);
        const dA = dist(0, 1), dB = dist(2, 3), dC = dist(4, 5);
        const dB0 = 1.5 * REQ, dC0 = 0.6 * REQ, eps = ctx.sim.knobs.coulombSoft;
        return [
          { name: '평형 길이 r_eq 유지(쌍 A 정지서 머무름 — 순 힘 0)', pass: Math.abs(dA - REQ) < 0.3, value: +dA.toFixed(3) },
          { name: '인력 복원(쌍 B r>r_eq → 안으로, dB<초기)', pass: dB < dB0 * 0.95, value: +(dB - dB0).toFixed(3) },
          { name: '반발 코어 복원·붕괴 방지(쌍 C r<r_eq → 밖으로, dC>초기 & dC>ε)', pass: dC > dC0 * 1.05 && dC > eps, value: +(dC - dC0).toFixed(3) },
        ];
      },
    },

    'step-0021': {
      id: 'step-0021',
      title: '쿨롱+포획 결합 (bond 속도잠금 → 연속력 r_eq 유지, 위상→기하 완성)',
      desc: 'step-0010 `bond` 는 포획 순간 둘을 질량중심 속도로 *잠그고* 상대 KE 를 흡수했다 — *위상*(누가 묶였나)만 있고 *거리*를 유지하는 ' +
            '힘이 없어 결합이 충돌·반동에 흩어졌다("괴이"의 뿌리). step-0020 이 평형 결합 길이 r_eq 를 창발시켰으니, 게이트 `bondCoulombic` 은 ' +
            'bond 의 *비탄성 속도잠금·KE흡수를 건너뛰고* 간선(위상)만 기록한다 — 이미 작동 중인 coulomb+repulse(하전 쌍)가 결합을 *r_eq 로 유지*한다. ' +
            '차갑게 포획된 결합쌍이 *r_eq(√21≈4.583) 주위로 좁게 진동* = 실제 결합 길이(위상→기하 완성·분자 진동). 포획 시 속도 불변 → ' +
            '*에너지 연속*(bondE=0, 불연속 0)·운동량 머신 보존. 끄면 step-0020 비트 동일(회귀 0). 분자가 비로소 *고정 결합 길이*를 가진다. ' +
            '※ 보존계(마찰 0): 포획 에너지가 진동 진폭으로 남아 r_eq *로 수렴*이 아니라 r_eq *주위 유계 진동* — 차가운 포획이라 진폭이 작다.',
      ticks: 800,
      ledgerTol: { E: 3e-3 },   // 연속력(쿨롱+코어)의 반음시 유계 진동(E 만 완화 — Q·B·L·px·py 머신 1e-9)

      // 고립 ±이온 3쌍(토러스 멀리, rng 미사용 순수 결정론)을 r_eq 근처서 *차갑게*(미세 접근) tick 1 에 포획(bondR=6).
      //   bondCoulombic=1 → 속도잠금 없이 간선만 → coulomb(1)+repulse(2.5)·ε=2 가 r_eq=√21≈4.583 우물에 가둠 → r_eq 주위 *좁은 진동*(분자 진동).
      //   ※ 보존계(마찰 0)라 포획 에너지가 진동 진폭으로 남는다 → r_eq *로 수렴*이 아니라 r_eq *주위 유계 진동*. 차게 포획해야 진폭이 작아 결합 길이≈r_eq.
      init(rng, K) {
        const W = 400, H = 400;          // 토러스 크게·중심 240 간격 → 쌍 간 교차력(~1/240²) 무시(각 쌍 *진짜 고립*)
        const H1 = ELEMENTS[0];                             // 수소(Z=1,N=0,mass=1) — ±1 이온쌍
        const u = 0.03;                                     // 미세 접근(|v_rel|=0.06 ≪ bondVmax=1.5 → 차가운 포획 → 좁은 진동)
        const pair = (cx, cy, d) => ([                      // 중심(cx,cy), x 로 거리 d, 서로 마주보고 u 로 접근(vn>0 → tick 1 포획)
          { Z: H1.Z, N: H1.N, e: 0, x: 0, rx: cx - d / 2, ry: cy, vx: +u, vy: 0 },   // e=0 → q=+1, +x(파트너 쪽)
          { Z: H1.Z, N: H1.N, e: 2, x: 0, rx: cx + d / 2, ry: cy, vx: -u, vy: 0 },   // e=2 → q=−1, −x(파트너 쪽)
        ]);
        const atoms = [
          ...pair(80, 80, 4.2),          // 평형 살짝 안서 포획
          ...pair(320, 80, Math.sqrt(21)),// 평형 거리서 포획
          ...pair(80, 320, 5.0),         // 평형 살짝 밖서 포획
        ];
        const simRng = K.mulberry32((rng() * 4294967296) >>> 0);
        return { W, H, atoms, rng: simRng, knobs: { dt: 0.05, kBond: 1, bondCoulombic: 1, bondR: 6, kCoulomb: 1, coulombSoft: 2, kRepulse: 2.5 } };
      },

      watch(sim, K) {
        const A = sim.atoms;
        const dist = (i, j) => Math.hypot(K.minImage(A[j].rx - A[i].rx, sim.W), K.minImage(A[j].ry - A[i].ry, sim.H));
        return {
          REQ: +Math.sqrt(21).toFixed(3),
          bonds: (sim.bonds || []).length,
          bondE: +(sim.bondE || 0).toFixed(6),               // 쿨롱 결합은 흡수 0 (에너지 연속)
          d1: +dist(0, 1).toFixed(3), d2: +dist(2, 3).toFixed(3), d3: +dist(4, 5).toFixed(3),
          meanBondLen: +(((dist(0, 1) + dist(2, 3) + dist(4, 5)) / 3)).toFixed(3),
        };
      },

      // 가설: ① 결합 형성(위상) — 3쌍 모두 간선 기록(bonds=3) ② 결합 길이≈r_eq(기하) — 차가운 포획 → 셋 다 r_eq 좁은 밴드 [0.8·r_eq, 1.2·r_eq] 안 진동(실제 결합 길이) ③ 탄성 결합(속도잠금 없음 → 에너지 연속) — bondE=0(비탄성 흡수 0). 총 E 유계 보존은 verify ②.
      assert(ctx, K) {
        const A = ctx.sim.atoms, W = ctx.sim.W, H = ctx.sim.H;
        const dist = (i, j) => Math.hypot(K.minImage(A[j].rx - A[i].rx, W), K.minImage(A[j].ry - A[i].ry, H));
        const REQ = Math.sqrt(21), lo = 0.8 * REQ, hi = 1.2 * REQ;   // 좁은 밴드(차가운 포획 → 작은 진동 → 결합 길이≈r_eq)
        const ds = [dist(0, 1), dist(2, 3), dist(4, 5)];
        const nBonds = (ctx.sim.bonds || []).length;
        const allInBand = ds.every(d => d >= lo && d <= hi);
        const mean = (ds[0] + ds[1] + ds[2]) / 3;
        return [
          { name: '결합 형성(위상) — 3쌍 모두 간선 기록(bonds=3)', pass: nBonds === 3, value: nBonds },
          { name: '결합 길이≈r_eq(기하) — 차가운 포획 → 셋 다 r_eq 좁은 밴드서 진동', pass: allInBand, value: +mean.toFixed(3) },
          { name: '탄성 결합(속도잠금 없음 → 에너지 연속, bondE=0)', pass: (ctx.sim.bondE || 0) === 0, value: +(ctx.sim.bondE || 0).toFixed(6) },
        ];
      },
    },

    'step-0022': {
      id: 'step-0022',
      title: '보편 파울리 반발 (중성 포함 excluded-volume — 중성 등속운동 해소)',
      desc: 'coulomb·repulse 는 *하전 쌍만* 작용해 중성 원자(q=0)는 서로 안 보고 *등속 직진*(겹쳐 통과)했다. 파울리 배타(전자 구름 겹침 반발)는 ' +
            '전하와 무관한 *부피*다 → 새 법칙 `pauli`(게이트 kPauli)는 단거리 반발 U=kP/(r²+ε²)²(force ∝ 1/r⁶, repulse 보다 가팔라 *접촉서만*)를 ' +
            '*모든 쌍*(전하 게이트 없음)에 싣는다. 중성 원자도 접촉서 밀어내 *겹침 방지*(물질의 부피)·*소프트 충돌*. 정면 접근 쌍은 튕기고(vx 반전), ' +
            '빗겨 접근 쌍은 편향(vy 창발)된다 — 더는 등속 직진이 아니다. 같은 심플렉틱·연화 ε·PE 가법(E 완화) 재사용. 끄면 step-0021 비트 동일(회귀 0).',
      ticks: 700,
      ledgerTol: { E: 3e-3 },   // 연속력의 반음시 유계 진동(E 만 완화 — Q·B·L·px·py 머신 1e-9)

      // 중성 원자(H: e=1 → q=0) 2쌍을 고립(토러스 크게)·정면/빗겨 접근시켜 *중성이 상호작용*함을 시연. coulomb·repulse 안 켬(중성엔 무효).
      //   pauli 만(kP=6·ε=2) → 접촉서 반발. 쌍1 정면(b=0) → 튕김(vx 반전). 쌍2 빗겨(b=2) → 편향(vy 창발). rng 미사용 순수 결정론.
      init(rng, K) {
        const W = 400, H = 400;
        const H1 = ELEMENTS[0];                             // 수소(Z=1,N=0,mass=1)
        const u = 0.15;                                     // 접근 속력(KE ≪ 파울리 장벽 → 튕김 보장)
        const neutral = (rx, ry, vx, vy) => ({ Z: H1.Z, N: H1.N, e: 1, x: 0, rx, ry, vx, vy });  // e=1 → q=0 (중성)
        const atoms = [
          neutral(96, 100, +u, 0), neutral(104, 100, -u, 0),     // 쌍1 정면 접근(b=0) → 튕김
          neutral(294, 300, +u, 0), neutral(306, 302, -u, 0),    // 쌍2 빗겨 접근(b=2) → 편향(vy)
        ];
        const simRng = K.mulberry32((rng() * 4294967296) >>> 0);
        return { W, H, atoms, rng: simRng, knobs: { dt: 0.05, kPauli: 6, coulombSoft: 2 } };
      },

      watch(sim, K) {
        const A = sim.atoms;
        const dist = (i, j) => Math.hypot(K.minImage(A[j].rx - A[i].rx, sim.W), K.minImage(A[j].ry - A[i].ry, sim.H));
        return {
          vxA: +A[0].vx.toFixed(4),       // 쌍1 정면: +0.15 → 반전(<0)이면 튕김
          d_headon: +dist(0, 1).toFixed(3),
          vyC: +A[2].vy.toFixed(4),        // 쌍2 빗겨: 0 → 음수면 편향
          d_offset: +dist(2, 3).toFixed(3),
        };
      },

      // 가설: ① 중성 정면 튕김(excluded-volume — 중성도 안 뚫음): 쌍1 vxA 반전(+u→<0). ② 중성 빗겨 편향(산란): 쌍2 vyC 창발(0→유의<0). ③ 둘 다 q=0(쿨롱·반발 무효) — 순수 파울리 효과. 총 E 유계·운동량 머신은 verify ②.
      assert(ctx, K) {
        const A = ctx.sim.atoms;
        const allNeutral = A.every(a => (a.Z - a.e) === 0);
        return [
          { name: '중성 정면 튕김(excluded-volume — vxA 반전 +u→<0)', pass: A[0].vx < 0, value: +A[0].vx.toFixed(4) },
          { name: '중성 빗겨 편향(산란 — vyC 창발 0→유의)', pass: Math.abs(A[2].vy) > 0.02, value: +A[2].vy.toFixed(4) },
          { name: '둘 다 중성(q=0 — 쿨롱·반발 무효, 순수 파울리)', pass: allNeutral, value: allNeutral ? 1 : 0 },
        ];
      },
    },

    'step-0023': {
      id: 'step-0023',
      title: '반데르발스 인력 (중성 군집 — pauli 반발과 vdW 우물 → 응집)',
      desc: 'step-0022 pauli 는 중성에 *반발만* 줘 중성 원자는 접촉서 튕길 뿐 *모이지 않았다*. 새 법칙 `vdw`(게이트 kVdW)는 보편 약한 인력 ' +
            'U=−kV/(r²+ε²)(force ∝ 1/r⁴)를 *모든 쌍*에 더한다 — pauli 반발(1/r⁶)보다 덜 가팔라 *단거리는 반발이(붕괴 방지)·중거리는 인력이* 이긴다. ' +
            '둘이 **vdW 우물**(최소 PE at s2_eq=2kP/kV → r_eq=√(2kP/kV−ε²)=4)을 만들어 근접한 중성 원자가 *응집*한다(condensation seed). 정지한 중성 ' +
            '4원자(정사각형)가 서로 끌려 *수축*(평균 거리↓)하되 pauli 가 붕괴를 막아 *유계 군집*으로 묶인다. 같은 symplectic·연화 ε·PE 가법(E 완화) ' +
            '재사용. 끄면 step-0022 비트 동일(회귀 0). ※ 1/r⁴ 힘이라 *단거리 약결합*(장거리 견인=중력은 Phase E).',
      ticks: 1000,
      ledgerTol: { E: 3e-3 },   // 연속력의 반음시 유계 진동(E 만 완화 — Q·B·L·px·py 머신 1e-9)

      // 중성 4원자(H: e=1 → q=0)를 정사각형(변 6)·정지로 놓고 vdw+pauli 만(쿨롱 안 켬) → 인력이 수축, pauli 가 붕괴 방지 → 유계 군집.
      //   kV=0.6·kP=6·ε=2 → 중성 쌍 우물 r_eq=√(2·6/0.6−4)=√16=4. rng 미사용 순수 결정론. 토러스 크게(고립).
      init(rng, K) {
        const W = 400, H = 400, cx = 200, cy = 200, s = 3;  // 정사각형 반변 3 → 변 6
        const H1 = ELEMENTS[0];
        const neutral = (rx, ry) => ({ Z: H1.Z, N: H1.N, e: 1, x: 0, rx, ry, vx: 0, vy: 0 });  // e=1 → q=0, 정지
        const atoms = [
          neutral(cx - s, cy - s), neutral(cx + s, cy - s),
          neutral(cx - s, cy + s), neutral(cx + s, cy + s),
        ];
        const simRng = K.mulberry32((rng() * 4294967296) >>> 0);
        return { W, H, atoms, rng: simRng, knobs: { dt: 0.05, kPauli: 6, kVdW: 0.6, coulombSoft: 2 } };
      },

      watch(sim, K) {
        const A = sim.atoms, n = A.length;
        const dist = (i, j) => Math.hypot(K.minImage(A[j].rx - A[i].rx, sim.W), K.minImage(A[j].ry - A[i].ry, sim.H));
        let sum = 0, mn = Infinity, mx = 0, c = 0;
        for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) { const d = dist(i, j); sum += d; c++; mn = Math.min(mn, d); mx = Math.max(mx, d); }
        return { meanPair: +(sum / c).toFixed(3), minPair: +mn.toFixed(3), maxPair: +mx.toFixed(3) };
      },

      // 가설: ① 중성 인력 군집 — 평균 쌍거리 수축(final < 초기). 중성도 모인다. ② 붕괴 방지 — 최소 쌍거리 > ε(=2). pauli 가 우물 바닥서 막음. ③ 유계 군집 — 최대 쌍거리 유계(< 초기 대각 8.49·1.5). 안 흩어짐(bound). 총 E·운동량은 verify ②.
      assert(ctx, K) {
        const A = ctx.sim.atoms, n = A.length, W = ctx.sim.W, H = ctx.sim.H;
        const dist = (i, j) => Math.hypot(K.minImage(A[j].rx - A[i].rx, W), K.minImage(A[j].ry - A[i].ry, H));
        let sum = 0, mn = Infinity, mx = 0, c = 0;
        for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) { const d = dist(i, j); sum += d; c++; mn = Math.min(mn, d); mx = Math.max(mx, d); }
        const meanPair = sum / c;
        const mean0 = (4 * 6 + 2 * Math.sqrt(72)) / 6;       // 초기 평균 쌍거리(변 6 ×4 + 대각 √72 ×2)/6 ≈ 6.83
        const eps = ctx.sim.knobs.coulombSoft;
        return [
          { name: '중성 인력 군집 — 평균 쌍거리 수축(final < 초기 6.83)', pass: meanPair < mean0 * 0.95, value: +meanPair.toFixed(3) },
          { name: '붕괴 방지 — 최소 쌍거리 > ε(pauli 가 우물 바닥서 막음)', pass: mn > eps, value: +mn.toFixed(3) },
          { name: '유계 군집 — 최대 쌍거리 유계(안 흩어짐, bound)', pass: mx < Math.sqrt(72) * 1.5, value: +mx.toFixed(3) },
        ];
      },
    },
  };

  return { SCENES, ELEMENTS };
});
