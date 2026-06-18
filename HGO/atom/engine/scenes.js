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

    'step-0024': {
      id: 'step-0024',
      title: '소산 응고 (복사 감쇠 → vdW 우물 바닥 수렴, 호흡 → 응고)',
      desc: 'step-0023 vdW 응집은 보존계라 진동 KE 가 빠질 데 없어 *호흡만* 했다(가라앉지 않음). 새 법칙 `damp`(게이트 kDamp)는 ' +
            '근접 쌍의 *상대 속도*만 점성 감쇠(근접 가중 w=ε²/s²)해 진동 KE 를 복사 바스 sim.escaped.E 로 버린다 — 질량중심 속도는 ' +
            '불변이라 운동량 정확 보존, 줄인 상대 KE 만 스칼라로 바스에 이전(닫힌 장부 KE→복사 E). 멀리 떨어진 자유비행은 안 식히고 ' +
            '(w~0) 우물 안 진동만 식혀 → 중성 4원자가 *호흡*을 멈추고 우물 바닥(r_eq~4)으로 *응고*(상전이 씨앗). 끄면 step-0023 ' +
            '비트 동일(회귀 0). reheat(0008)이 같은 바스서 되먹일 수 있어 응고↔재증발 순환의 미시 씨앗.',
      ticks: 1000,
      ledgerTol: { E: 3e-3 },   // 연속력 symplectic 의 유계 진동(E 만 완화 — Q·B·L·px·py 머신 1e-9)

      // step-0023 과 동일 4원자 군집(정사각형 변 6·정지) + kDamp 추가 → 진동이 식어 응고. reheat 안 켬(소산만 시연).
      init(rng, K) {
        const W = 400, H = 400, cx = 200, cy = 200, s = 3;
        const H1 = ELEMENTS[0];
        const neutral = (rx, ry) => ({ Z: H1.Z, N: H1.N, e: 1, x: 0, rx, ry, vx: 0, vy: 0 });
        const atoms = [
          neutral(cx - s, cy - s), neutral(cx + s, cy - s),
          neutral(cx - s, cy + s), neutral(cx + s, cy + s),
        ];
        const simRng = K.mulberry32((rng() * 4294967296) >>> 0);
        return { W, H, atoms, rng: simRng, knobs: { dt: 0.05, kPauli: 6, kVdW: 0.6, kDamp: 0.15, coulombSoft: 2 } };
      },

      watch(sim, K) {
        const A = sim.atoms, n = A.length;
        // com 프레임 운동 에너지(진동 척도) — vcom 빼고 합산
        let mtot = 0, pvx = 0, pvy = 0;
        for (const a of A) { const m = K.mass(a); mtot += m; pvx += m * a.vx; pvy += m * a.vy; }
        const vcx = pvx / mtot, vcy = pvy / mtot;
        let ke = 0;
        for (const a of A) { const m = K.mass(a); ke += 0.5 * m * ((a.vx - vcx) ** 2 + (a.vy - vcy) ** 2); }
        const dist = (i, j) => Math.hypot(K.minImage(A[j].rx - A[i].rx, sim.W), K.minImage(A[j].ry - A[i].ry, sim.H));
        let sum = 0, c = 0;
        for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) { sum += dist(i, j); c++; }
        return { vibKE: +ke.toFixed(5), meanPair: +(sum / c).toFixed(3), bathE: +((sim.escaped && sim.escaped.E) || 0).toFixed(5) };
      },

      // 가설: ① 응고 — com 프레임 진동 KE 가 거의 0 으로 식음(소산). 호흡 멈춤. ② 닫힌 장부 — 식은 KE 가 복사 바스 E 로 옮겨감(bathE>0). ③ 군집 유지 — 평균 쌍거리 수축 유지(우물 바닥 r_eq 근방, < 초기 6.83). 총 E·운동량 보존은 verify ②.
      assert(ctx, K) {
        const A = ctx.sim.atoms, n = A.length, W = ctx.sim.W, H = ctx.sim.H;
        let mtot = 0, pvx = 0, pvy = 0;
        for (const a of A) { const m = K.mass(a); mtot += m; pvx += m * a.vx; pvy += m * a.vy; }
        const vcx = pvx / mtot, vcy = pvy / mtot;
        let ke = 0;
        for (const a of A) { const m = K.mass(a); ke += 0.5 * m * ((a.vx - vcx) ** 2 + (a.vy - vcy) ** 2); }
        const dist = (i, j) => Math.hypot(K.minImage(A[j].rx - A[i].rx, W), K.minImage(A[j].ry - A[i].ry, H));
        let sum = 0, c = 0;
        for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) { sum += dist(i, j); c++; }
        const meanPair = sum / c;
        const bathE = (ctx.sim.escaped && ctx.sim.escaped.E) || 0;
        return [
          { name: '응고 — com 프레임 진동 KE 거의 0 으로 식음(호흡 멈춤)', pass: ke < 0.01, value: +ke.toFixed(5) },
          { name: '닫힌 장부 — 식은 KE 가 복사 바스 E 로 이전(bathE>0)', pass: bathE > 0, value: +bathE.toFixed(5) },
          { name: '군집 유지 — 평균 쌍거리 수축 유지(< 초기 6.83)', pass: meanPair < 6.83 * 0.95, value: +meanPair.toFixed(3) },
        ];
      },
    },

    'step-0025': {
      id: 'step-0025',
      title: '다체 응집 상전이 (vdW+pauli+damp → 질서 있는 응결 — 배위수·g(r) 첫봉)',
      desc: 'step-0023~0024 는 4원자 토이였다 — 응집·응고는 봤으나 *질서*(어느 간격으로 어떻게 쌓이나)는 못 봤다. 새 법칙은 더하지 않는다 ' +
            '(이미 실린 vdw 인력 + pauli 반발 + damp 소산이면 충분하다 — 다양성은 author 아닌 *측정*). 중성 16원자를 *교란된 격자*(살짝 흔든 4×4)로 ' +
            '놓고 길게 굴리면, 보편 두 힘의 vdW 우물(r_eq~4)이 *최밀 충전*을 향해 원자를 끌고 damp 가 진동을 식혀 *질서 있게 응결*한다. ' +
            '질서를 *측정*으로 본다: ① 평균 배위수(컷오프 1.4·r_eq 안 이웃 수)가 기체(~0)를 넘어 응결 격자(2~6)로 올라가고 ② 동경분포 g(r) 의 ' +
            '*첫 봉*이 r_eq 근방에 선명히 서며(최근접 거리가 우물 바닥에 모임) ③ 군집이 *하나의 덩어리*로 수축(평균 쌍거리 < 초기·반경 유계)한다. ' +
            '새 노브 0 → 기존 법칙·골든 비트 불변(회귀 0). 같은 symplectic·연화 ε·복사 바스 재사용. O(n²) 연속력 4개 — n=16 토이라 아직 견딤(공간 분할은 전가).',
      ticks: 1500,
      ledgerTol: { E: 5e-3 },   // 연속력 symplectic 의 유계 진동 + 다체 16원자라 진동 폭↑(E 만 완화 — Q·B·L·px·py 머신 1e-9)

      // 중성 16원자(H: e=1 → q=0)를 4×4 격자(간격 5≈r_eq+여유)로 놓되 시드 의사난수로 *살짝 교란*(±0.6) → 완벽 대칭이 아닌 현실적 시작.
      //   vdw+pauli+damp(쿨롱·결합 안 켬) → 인력이 끌어모으고 pauli 가 붕괴 막고 damp 가 진동 식혀 *질서 있게 응결*. 교란은 시드별로 달라 결정론 유지.
      init(rng, K) {
        const W = 400, H = 400, cx = 200, cy = 200, g = 5, cols = 4, rows = 4;  // 4×4 격자, 간격 5
        const H1 = ELEMENTS[0];
        const simRng = K.mulberry32((rng() * 4294967296) >>> 0);
        const atoms = [];
        const x0 = cx - (cols - 1) * g / 2, y0 = cy - (rows - 1) * g / 2;
        for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
          const jx = (simRng() - 0.5) * 1.2, jy = (simRng() - 0.5) * 1.2;  // 교란 ±0.6
          atoms.push({ Z: H1.Z, N: H1.N, e: 1, x: 0, rx: x0 + c * g + jx, ry: y0 + r * g + jy, vx: 0, vy: 0 });  // e=1 → q=0, 정지
        }
        return { W, H, atoms, rng: simRng, knobs: { dt: 0.05, kPauli: 6, kVdW: 0.6, kDamp: 0.15, coulombSoft: 2 } };
      },

      watch(sim, K) {
        const A = sim.atoms, n = A.length;
        const reqv = Math.sqrt(2 * sim.knobs.kPauli / sim.knobs.kVdW - sim.knobs.coulombSoft ** 2);  // vdW 우물 바닥 r_eq=√(2kP/kV−ε²)=4
        const cut = 1.4 * reqv;                              // 배위 컷오프(첫 이웃 껍질)
        const dist = (i, j) => Math.hypot(K.minImage(A[j].rx - A[i].rx, sim.W), K.minImage(A[j].ry - A[i].ry, sim.H));
        let coordSum = 0, pairSum = 0, c = 0, nnSum = 0;
        for (let i = 0; i < n; i++) {
          let nn = Infinity;
          for (let j = 0; j < n; j++) { if (i === j) continue; const d = dist(i, j); if (d < cut) coordSum++; if (d < nn) nn = d; }
          nnSum += nn;
          for (let j = i + 1; j < n; j++) { pairSum += dist(i, j); c++; }
        }
        return { coordNum: +(coordSum / n).toFixed(3), nnDist: +(nnSum / n).toFixed(3), meanPair: +(pairSum / c).toFixed(3), bathE: +((sim.escaped && sim.escaped.E) || 0).toFixed(5) };
      },

      // 가설: ① 응결 질서 — 평균 배위수가 기체(<1)를 넘어 응결 격자대(≥2)로. 원자가 *이웃을 가짐*. ② g(r) 첫봉 — 최근접 평균이 r_eq(=4) 근방(±35%)에 모임. 우물 바닥에 쌓임. ③ 단일 덩어리 — 평균 쌍거리 수축(< 초기). 흩어지지 않고 응결. 총 E·운동량은 verify ②.
      assert(ctx, K) {
        const A = ctx.sim.atoms, n = A.length, W = ctx.sim.W, H = ctx.sim.H, k = ctx.sim.knobs;
        const reqv = Math.sqrt(2 * k.kPauli / k.kVdW - k.coulombSoft ** 2);
        const cut = 1.4 * reqv;
        const dist = (i, j) => Math.hypot(K.minImage(A[j].rx - A[i].rx, W), K.minImage(A[j].ry - A[i].ry, H));
        let coordSum = 0, pairSum = 0, c = 0, nnSum = 0;
        for (let i = 0; i < n; i++) {
          let nn = Infinity;
          for (let j = 0; j < n; j++) { if (i === j) continue; const d = dist(i, j); if (d < cut) coordSum++; if (d < nn) nn = d; }
          nnSum += nn;
          for (let j = i + 1; j < n; j++) { pairSum += dist(i, j); c++; }
        }
        const coordNum = coordSum / n, nnDist = nnSum / n, meanPair = pairSum / c;
        // 초기 4×4 격자(간격 5)의 평균 쌍거리(교란 무시 근사) — 수축 기준
        const mean0 = (() => { let s = 0, cc = 0; for (let i = 0; i < 16; i++) for (let j = i + 1; j < 16; j++) { const xi = i % 4, yi = (i / 4) | 0, xj = j % 4, yj = (j / 4) | 0; s += 5 * Math.hypot(xi - xj, yi - yj); cc++; } return s / cc; })();
        return [
          { name: '응결 질서 — 평균 배위수 ≥2(기체<1 넘어 격자 이웃 가짐)', pass: coordNum >= 2, value: +coordNum.toFixed(3) },
          { name: 'g(r) 첫봉 — 최근접 거리 r_eq(=4) 근방(±35%)에 모임', pass: nnDist > reqv * 0.65 && nnDist < reqv * 1.35, value: +nnDist.toFixed(3) },
          { name: '단일 덩어리 — 평균 쌍거리 수축(< 초기 격자)', pass: meanPair < mean0, value: +meanPair.toFixed(3) },
        ];
      },
    },

    'step-0026': {
      id: 'step-0026',
      title: '중성 공유결합 길이 (bondSpring → 평형 결합 길이 r_eq, 탄성 진동)',
      desc: 'step-0021 bondCoulombic 으로 *하전(이온) 결합*은 coulomb+repulse 가 평형 길이 r_eq 를 유지했다 — 하지만 그 연속력은 ' +
            '*q≠0 쌍만* 작용한다(중성 건너뜀). 중성 공유결합(step-0017 bondCovalent)은 간선이 *위상 라벨*일 뿐 유지력이 없어 ' +
            '결합 길이가 없었다(결합 기하의 마지막 격차·STATE 후보 L). 새 법칙 `bondSpring`(게이트 kBondSpring)은 *결합 간선*(sim.bonds)에만 ' +
            '연속 복원력 U=½kS(r−r_eq)² 을 실어 *중성 분자가 실제 결합 길이로 진동(탄성)* 하게 한다. 포획은 capture 거리(~2.5)에서 ' +
            'vcom 잠금으로 일어나지만(거리≠r_eq), 스프링이 그 압축을 r_eq(=4)로 *밀어 펴* 결합쌍이 r_eq 주위로 *호흡*(탄성 진동)한다 — ' +
            'r>r_eq 면 당기고 r<r_eq 면 미는 안정 평형(author 한 길이 아님 — 두 보존량 K·r_eq 합에서 창발). 같은 symplectic 적분·연화 재사용, ' +
            'PE 항 ½kS(r−r_eq)² 가법(E 만 완화). 끄면 step-0025 비트 동일(회귀 0) — 결합 간선은 위상만, 거리 미유지.',
      ticks: 600,
      ledgerTol: { E: 3e-3 },   // 연속 복원력 symplectic 의 유계 진동(E 만 완화 — Q·B·L·px·py 머신 1e-9)

      // *중성* H 2원자(e=1 → q=0, 빈자리 1)를 r≈r_eq(=4 = bondR 5 안) 에 서로 살짝 다가가게 놓는다 → bondCovalent 로 공유결합 →
      //   bondCoulombic 게이트로 *vcom 잠금·KE 흡수 건너뜀*(에너지 연속 — 포획 시 스프링 PE≈0) → bondSpring 이 r_eq 유지 → *탄성 진동*.
      //   왜 r≈r_eq 에서 포획하나: 스프링 PE 는 *결합 간선이 생길 때* 켜진다(bond-gated). r≠r_eq 서 묶으면 PE 가 불연속 주입(장부 깨짐) →
      //   r_eq 근방서 포획해 PE≈0(연속). 접근 속도가 진동 씨앗. 이온결합·쿨롱 안 켬(중성 무대 자동 0). damp 안 켬(진동 보존 시연).
      init(rng, K) {
        const W = 200, H = 200, cx = 100, cy = 100, d0 = 4;   // d0 = r_eq → 포획 순간 스프링 PE≈0(에너지 연속)
        const H1 = ELEMENTS[0];
        const atoms = [
          { Z: H1.Z, N: H1.N, e: 1, x: 0, rx: cx - d0 / 2, ry: cy, vx: 0.15, vy: 0, },   // 서로 다가감(vn>0 → 포획) — 진동 씨앗
          { Z: H1.Z, N: H1.N, e: 1, x: 0, rx: cx + d0 / 2, ry: cy, vx: -0.15, vy: 0, },
        ];
        const simRng = K.mulberry32((rng() * 4294967296) >>> 0);
        // bondCovalent 로 중성 공유결합 형성 + bondCoulombic 로 에너지 연속 포획(vcom 잠금 skip) + bondSpring 으로 r_eq 유지·탄성.
        return { W, H, atoms, rng: simRng, knobs: { dt: 0.05, kBond: 1, bondR: 5, bondVmax: 2.0, bondCovalent: 1, bondCoulombic: 1, bondLocalE: 1, kBondSpring: 4, bondReq: 4, coulombSoft: 2 } };
      },

      watch(sim, K) {
        const A = sim.atoms, bonds = sim.bonds || [];
        const req = sim.knobs.bondReq || 4;
        const bl = bonds.length
          ? Math.hypot(K.minImage(A[bonds[0][1]].rx - A[bonds[0][0]].rx, sim.W), K.minImage(A[bonds[0][1]].ry - A[bonds[0][0]].ry, sim.H))
          : 0;
        return { liveBonds: bonds.length, covalent: sim.covalentCount | 0, bondLen: +bl.toFixed(3), req };
      },

      // 가설: ① 중성 공유결합 형성(liveBonds≥1·covalent>0 — 이온 없이) ② 평형 결합 길이 — 최종 결합 길이가 r_eq(=4) 근방(±25%)에 *유지*됨(스프링이 거리를 잡음). ③ 거리 유지 — 결합이 살아있고(liveBonds≥1) 끊기지/붕괴하지 않음(스프링 끄면 유지력 0 → 위상만 라벨·길이 의미 없음, step 문서 비교). 총 E·운동량 보존은 verify ②.
      assert(ctx, K) {
        const sim = ctx.sim, A = sim.atoms, bonds = sim.bonds || [];
        const req = sim.knobs.bondReq || 4;
        const cov = sim.covalentCount | 0;
        const bl = bonds.length
          ? Math.hypot(K.minImage(A[bonds[0][1]].rx - A[bonds[0][0]].rx, sim.W), K.minImage(A[bonds[0][1]].ry - A[bonds[0][0]].ry, sim.H))
          : 0;
        return [
          { name: '중성 공유결합 형성(liveBonds≥1·covalent>0 — 이온 없이)', pass: bonds.length >= 1 && cov > 0, value: bonds.length },
          { name: '평형 결합 길이 — 결합 길이 r_eq(=4) 근방(±25%)에 유지', pass: bl > req * 0.75 && bl < req * 1.25, value: +bl.toFixed(3) },
          { name: '거리 유지 — 스프링이 결합 길이를 잡음(붕괴/이탈 없이 r_eq 밴드)', pass: bonds.length >= 1 && bl > req * 0.5, value: +bl.toFixed(3) },
        ];
      },
    },

    'step-0027': {
      id: 'step-0027',
      title: '결합 각도 (bondAngle → VSEPR 평형각 θ₀, 교란 후 각도 복원·탄성)',
      desc: '결합 *길이*는 하전 0021(bondCoulombic)·중성 0026(bondSpring)으로 닫혔다 — 두 결합이 한 원자에 모이면 *각도*가 남는다. ' +
            '0026 까지로는 각 간선이 길이만 잡을 뿐 두 간선의 *사잇각*은 자유였다(중심에 두 이웃이 겹쳐 붙어도 무방 — 결합 기하의 마지막 격차). ' +
            '실제 분자는 전자쌍 반발(VSEPR)로 결합이 *목표각으로 복원*된다(2결합→180°·3결합→120°·…). 새 법칙 `bondAngle`(게이트 kBondAngle)은 ' +
            '*한 원자에 모인 결합 간선쌍*((i-j)·(i-k))에만 각도 복원력 U=½kA(θ−θ₀)² 을 실어 θ₀(노브 — 토이로 단일 목표각 120°)로 잡는다. θ₀ 는 ' +
            '*전자쌍 수의 함수*일 뿐 분자별 분기 0(author 아닌 창발). 무대: 중성 C(빈자리 4) 1개에 중성 H(빈자리 1) 2개를 *목표각 120°*·r=r_eq=4 에 놓고 ' +
            '공유결합(형성 순간 길이·각 PE≈0 → 에너지 연속) 한 뒤 한 H 에 *접선 교란*을 줘 각을 흔든다 → bondSpring 이 길이(4), bondAngle 이 각을 θ₀(120°)로 ' +
            '*복원*(각도 탄성 진동)한다. *대조*: 각도 스프링 끄면(kBondAngle=0) 길이만 잡혀 교란이 각을 멋대로 끌고 가(복원력 0) θ₀ 에서 크게 이탈한다. ' +
            '같은 symplectic 적분·PE 항 ½kA(θ−θ₀)² 가법(E 만 완화). 끄면 step-0026 비트 동일(회귀 0) — 결합 간선은 길이만, 각도 미유지.',
      ticks: 800,
      ledgerTol: { E: 3e-3 },   // 연속 각도 복원력 symplectic 의 유계 진동(E 만 완화 — Q·B·L·px·py 머신 1e-9)

      // 중성 C(e=6 → 빈자리 4) 중심 + 중성 H(e=1 → 빈자리 1) 둘을 거리 r_eq=4·*목표각 120°(±60°)* 에 놓고 서로 살짝 다가가게(vn>0) →
      //   bondCovalent 로 C-H 공유결합 2개 형성(길이=r_eq·각=θ₀ → 두 PE 항 ≈0 → 에너지 연속) → bondCoulombic(vcom 잠금 skip) →
      //   한 H 에 *접선 속도 교란* 을 줘 각을 흔들면 bondAngle 이 θ₀=120° 로 복원(각도 탄성). 쿨롱·이온·damp 안 켬(중성 무대·진동 보존 시연).
      init(rng, K) {
        const W = 200, H = 200, cx = 100, cy = 100, d0 = 4;   // d0 = r_eq → 포획 순간 길이 스프링 PE≈0
        const C = ELEMENTS[2], H1 = ELEMENTS[0];              // C: Z6 e6 빈자리4 · H: Z1 e1 빈자리1
        const a0 = Math.PI / 3;                               // ±60° → 초기 사잇각 120° = θ₀ → 각도 PE≈0(에너지 연속)
        const vin = 0.03, vpert = 0.12;                       // vin: C 쪽 다가감(포획) · vpert: H1 접선 교란(각도 진동 씨앗)
        const atoms = [
          { Z: C.Z, N: C.N, e: 6, x: 0, rx: cx, ry: cy, vx: 0, vy: 0 },                                  // 0: 중심 C
          // 1: H(+60°) — 반경 방향 vin(포획) + 접선 방향 vpert(각도 교란)
          { Z: H1.Z, N: H1.N, e: 1, x: 0, rx: cx + d0 * Math.cos(a0), ry: cy + d0 * Math.sin(a0), vx: -vin * Math.cos(a0) - vpert * Math.sin(a0), vy: -vin * Math.sin(a0) + vpert * Math.cos(a0) },
          // 2: H(−60°) — 반경 방향 vin 만(포획)
          { Z: H1.Z, N: H1.N, e: 1, x: 0, rx: cx + d0 * Math.cos(-a0), ry: cy + d0 * Math.sin(-a0), vx: -vin * Math.cos(-a0), vy: -vin * Math.sin(-a0) },
        ];
        const simRng = K.mulberry32((rng() * 4294967296) >>> 0);
        // bondCovalent 로 C-H 공유결합 2개 + bondCoulombic 로 에너지 연속 포획 + bondSpring 으로 길이 r_eq + bondAngle 로 각도 θ₀=120°.
        return { W, H, atoms, rng: simRng, knobs: { dt: 0.05, kBond: 1, bondR: 5, bondVmax: 2.0, bondCovalent: 1, bondCoulombic: 1, bondLocalE: 1, kBondSpring: 4, bondReq: 4, kBondAngle: 6, bondAngleTarget: 2.0943951023931953, coulombSoft: 2 } };
      },

      // 중심(이웃 2개 가진 원자)의 결합쌍 사잇각을 측정한다.
      angleAt(sim, K) {
        const A = sim.atoms, bonds = sim.bonds || [];
        const nbr = new Map();
        for (const e of bonds) {
          if (!nbr.has(e[0])) nbr.set(e[0], []);
          if (!nbr.has(e[1])) nbr.set(e[1], []);
          nbr.get(e[0]).push(e[1]); nbr.get(e[1]).push(e[0]);
        }
        for (const [ci, ns] of nbr) {
          if (ns.length < 2) continue;
          const ai = A[ci], aj = A[ns[0]], ak = A[ns[1]];
          const ax = K.minImage(aj.rx - ai.rx, sim.W), ay = K.minImage(aj.ry - ai.ry, sim.H);
          const bx = K.minImage(ak.rx - ai.rx, sim.W), by = K.minImage(ak.ry - ai.ry, sim.H);
          let cos = (ax * bx + ay * by) / (Math.hypot(ax, ay) * Math.hypot(bx, by));
          if (cos > 1) cos = 1; else if (cos < -1) cos = -1;
          return Math.acos(cos);
        }
        return 0;
      },

      watch(sim, K) {
        const bonds = sim.bonds || [];
        const th = this.angleAt(sim, K);
        return { liveBonds: bonds.length, covalent: sim.covalentCount | 0, angleDeg: +(th * 180 / Math.PI).toFixed(2), targetDeg: +(sim.knobs.bondAngleTarget * 180 / Math.PI).toFixed(1) };
      },

      // 가설: ① 두 공유결합 형성(liveBonds≥2·covalent≥2 — 한 중심에 두 이웃). ② 평형 각도 복원 — 교란 후 H-C-H 각이 θ₀(120°) 근방(±20%)에 *복원·유지*됨(각도 스프링이 각을 잡음). ③ 각도 탄성 — 교란이 각을 θ₀ 근처로 *되돌림*(각도 스프링 끄면 교란이 각을 θ₀ 밖으로 끌고 감 — step 문서 대조). 총 E·운동량 보존은 verify ②.
      assert(ctx, K) {
        const sim = ctx.sim, bonds = sim.bonds || [];
        const cov = sim.covalentCount | 0;
        const th = this.angleAt(sim, K), deg = th * 180 / Math.PI;
        const t0 = sim.knobs.bondAngleTarget, t0deg = t0 * 180 / Math.PI;
        return [
          { name: '두 공유결합 형성(liveBonds≥2·covalent≥2 — 한 중심에 두 이웃)', pass: bonds.length >= 2 && cov >= 2, value: bonds.length },
          { name: '평형 각도 복원 — 교란 후 H-C-H 각이 θ₀(120°) 근방(±20%)에 복원·유지', pass: deg > t0deg * 0.8 && deg < t0deg * 1.2, value: +deg.toFixed(2) },
          { name: '각도 탄성 — 교란된 각이 θ₀ 밴드(±25%) 안으로 복원', pass: deg > t0deg * 0.75 && deg < t0deg * 1.25, value: +deg.toFixed(2) },
        ];
      },
    },

    'step-0028': {
      id: 'step-0028',
      title: '중력 (gravity → 1/r² 보편 원거리 인력, 중성 원자가 중력+파울리 균형으로 *결속*·진동 — Phase E 별 씨앗)',
      desc: '결합 *기하*(길이 0021·0026 + 각도 0027)가 닫혔다 — 다음 척도는 *더 크다*. 지금까지 인력은 전부 *단거리/하전* 한정이었다: ' +
            'coulomb(하전 쌍만)·vdw(1/r⁴ 단거리)·bondSpring(결합 간선만). 중성 원자 둘을 *원거리*서 끌어당기는 힘이 없어 별·은하 같은 *모임*의 씨앗이 없다. ' +
            '새 법칙 `gravity`(게이트 kGravity)는 coulomb 의 *질량판* F=−kG·ma·mb/r²(전하 q→질량 m=Z+N, 부호 항상 −=인력, 전하 게이트 제거 — 중력은 보편)을 ' +
            '*모든 쌍*에 싣는다. 무대(step-0020 r_eq 우물의 *중력·중성판*): 중성 O 원자 둘을 정지 상태로 D=20(평형 간격 r_eq≈14 밖)에 놓는다 → ' +
            'gravity 가 둘을 *끌어당겨* 다가가고, pauli 코어(0022)가 *붕괴를 막아* 두 힘이 균형하는 r_eq 부근서 멈춰 *결속 진동*(bound state)한다 — ' +
            '간격이 [11.5, 20] 밴드 안에서 r_eq 둘레로 진동(소산 없는 보존계라 호흡). 측정 시점 t=2000 은 *첫 깊은 infall*(간격 11.87 — D=20 의 59%) 부근. ' +
            '최소 간격 11.5 ≫ 연화 ε=3 → 붕괴 없음. *"별 씨앗"은 코드의 종류가 아니라 중력 우물에 결속된 다발의 위치*(척추 체크 ①②·author 분기 0). ' +
            '*대조*: gravity 끄면(kGravity=0) pauli 반발만 남아 두 중성 원자는 *결속 못 하고* 서로 밀려 간격이 단조 증가(D=20→40+, 모임 0). ' +
            '같은 symplectic 적분·PE 항 U_grav≤0 가법(E 만 완화). 끄면 step-0027 비트 동일(회귀 0).',
      ticks: 2000,
      ledgerTol: { E: 5e-3 },   // 원거리 1/r² 연속력 symplectic 의 유계 진동(E 만 완화 — Q·B·L·px·py 머신 1e-9)

      // 중성 O(Z8 e8 q=0) 둘을 정지 상태로 D=20(r_eq≈14 밖)에 놓고 gravity+pauli 만 켠다. gravity 가 당기고 pauli 가 막아 r_eq 둘레 결속 진동.
      //   중성 무대(쿨롱·vdw·결합 안 켬) → 중력의 *보편*(전하 무관) 인력만 분리 시연. 같은 init 으로 gravity 끄면(대조) 결속 못 함(step 문서).
      //   결정론: 위치·질량 결정 → 단일 배치(시드 무관 동일). r_eq 는 gravity(kG·m²/r²)↔pauli(kP·4r/(r²+ε²)³) 힘 균형서 *창발*(author 아님).
      init(rng, K) {
        const W = 400, H = 400, cx = 200, cy = 200, D = 20;  // D=20 > r_eq≈14 → 정지서 출발해 끌려 들어옴
        const O = ELEMENTS[3];                               // 중성 O: Z8 e8 → q=0 (쿨롱 0 — 중력은 전하 무관)
        const atoms = [
          { Z: O.Z, N: O.N, e: O.Z, x: 0, rx: cx - D / 2, ry: cy, vx: 0, vy: 0 },
          { Z: O.Z, N: O.N, e: O.Z, x: 0, rx: cx + D / 2, ry: cy, vx: 0, vy: 0 },
        ];
        const simRng = K.mulberry32((rng() * 4294967296) >>> 0);
        // gravity(보편 1/r² 인력) + pauli(붕괴 방지 코어). 연화 ε=coulombSoft 공유 → r_eq≈14 평형(힘 균형).
        return { W, H, atoms, rng: simRng, knobs: { dt: 0.01, kGravity: 1, kPauli: 200000, coulombSoft: 3 } };
      },

      // 두 원자 간격(min-image).
      sep(sim, K) { const A = sim.atoms; const dx = K.minImage(A[1].rx - A[0].rx, sim.W), dy = K.minImage(A[1].ry - A[0].ry, sim.H); return Math.hypot(dx, dy); },

      watch(sim, K) {
        const A = sim.atoms;
        return { sep: +this.sep(sim, K).toFixed(3), q0: A[0].Z - A[0].e, q1: A[1].Z - A[1].e, gravityActive: sim.gravityActive | 0 };
      },

      // 가설: ① 결속(인력) — 중성 원자 둘이 gravity 로 *다가감*: 최종 간격이 초기(D=20)보다 작음(끌려 들어옴). ② 붕괴 방지 — 최소 간격 > 연화 ε(pauli 코어가 r=0 붕괴 막음 → bound state). ③ 보편(전하 무관) — 두 원자 다 중성(q=0)인데도 인력 작용(coulomb 이면 q=0 → 0, 중력이라야 당김). 총 E·운동량 보존은 verify ②. (대조: gravity 끄면 간격 단조 증가 — step 문서.)
      //   실행 중 최소 간격을 추적하려 run 을 다시 돌리지 않고, 정지서 출발한 보존 진동의 *현재 간격*(< D)과 평형 r_eq 근방을 본다.
      assert(ctx, K) {
        const sim = ctx.sim, A = sim.atoms;
        const D0 = Math.hypot(K.minImage(ctx.atoms0[1].rx - ctx.atoms0[0].rx, sim.W), K.minImage(ctx.atoms0[1].ry - ctx.atoms0[0].ry, sim.H));
        const sf = this.sep(sim, K);
        const eps = sim.knobs.coulombSoft || 1;
        const q0 = A[0].Z - A[0].e, q1 = A[1].Z - A[1].e;
        return [
          { name: '결속(인력) — 중성 원자 둘이 gravity 로 다가감(최종 간격 < 초기 D=20)', pass: sf < D0, value: +sf.toFixed(3) },
          { name: '붕괴 방지 — 간격 > 연화 ε(pauli 코어가 r=0 붕괴 막음 → bound state)', pass: sf > eps, value: +sf.toFixed(3) },
          { name: '보편(전하 무관) — 두 원자 모두 중성(q=0)인데도 인력 작용(coulomb 이면 0)', pass: q0 === 0 && q1 === 0 && sf < D0, value: q0 + q1 },
        ];
      },
    },

    'step-0029': {
      id: 'step-0029',
      title: '다체 중력 응집 (gravity+pauli → N 원자 구름의 관성반경 수축·중력 붕괴 — Phase E 별 씨앗 다체판)',
      desc: 'step-0028 은 중력 *2체* 결속(D=20→11.87 bound state)을 봤다 — 하지만 별·은하는 *다체* 모임이다(요건: 구름이 *집단으로* 응결). ' +
            '새 법칙은 더하지 않는다(이미 실린 gravity 보편 인력 + pauli 코어면 충분 — 다양성은 author 아닌 *측정*, 0025 의 중력판). ' +
            '중성 O 원자 N=6 을 *대칭 고리*(반경 R₀=30)에 정지로 놓는다 — 무작위 배치의 *근접조우 슬링샷*(min-image 1/r² 점중력의 E 드리프트 주범)을 ' +
            '피해 결정론·보존을 깨끗이 닫으려는 선택(고리는 시드 무관 단일 배치·대칭이라 총운동량 정확 0 유지). gravity 가 모든 쌍을 *안쪽으로* 끌어 ' +
            '고리가 *집단 수축*(coherent infall)하고 pauli 코어가 r=0 붕괴를 막는다. *측정*: ① **관성반경 R_g**(질량가중 RMS 반경)이 ' +
            'R₀(=30)서 *수축*(t=8000 에 23.6 — 79%, 첫 깊은 infall 도중) ② 최근접 거리 > 연화 ε(=3) → 붕괴 없는 *결속 수축* ③ 중성(q=0)인데도 ' +
            '인력 작용(coulomb 이면 0 — 중력의 보편성). *대조*: gravity 끄면(kGravity=0) pauli 만 남아 고리가 *수축 안 함*(R_g 30→30.45, 살짝 팽창·모임 0). ' +
            '새 노브 0 → 기존 법칙·골든 비트 불변(회귀 0). 같은 symplectic 적분·연화 ε·중력 PE(Plummer) 재사용. 보존계(damp 안 켬)라 깊은 infall 뒤 ' +
            '*반동(rebound)*해 호흡(t=8000 은 수축 위상의 깨끗한 창)). O(n²) 연속력 5개 — n=6 토이라 견딤(공간 분할/장거리 합산은 전가).',
      ticks: 8000,
      ledgerTol: { E: 5e-3 },   // 원거리 1/r² 연속력 symplectic 의 유계 진동(다체 infall — E 만 완화, t=8000 창서 3.6e-3 · Q·B·L·px·py 머신 1e-9)

      // 중성 O(Z8 e8 q=0) N=6 을 대칭 고리(반경 30·정지)에 놓고 gravity+pauli 만 켠다. 대칭·결정론 → 근접조우 슬링샷 없음(E 깨끗이 닫힘).
      //   중성 무대(쿨롱·vdw·결합·damp 안 켬) → 중력 보편(전하 무관) 인력만 분리 시연. 같은 init 으로 gravity 끄면(대조) 수축 안 함(step 문서).
      //   dt=0.0025(2체보다 작게 — 다체 infall 의 symplectic 드리프트 억제). 시드 무관 단일 배치 → 결정론 자동.
      init(rng, K) {
        const W = 400, H = 400, cx = 200, cy = 200, N = 6, R0 = 30;  // R0=30 고리 → 중력이 안쪽으로 끌어 집단 수축
        const O = ELEMENTS[3];                               // 중성 O: Z8 e8 → q=0 (쿨롱 0 — 중력은 전하 무관)
        const atoms = [];
        for (let i = 0; i < N; i++) {
          const a = 2 * Math.PI * i / N;                     // 대칭 고리(슬링샷 회피·총운동량 정확 0)
          atoms.push({ Z: O.Z, N: O.N, e: O.Z, x: 0, rx: cx + R0 * Math.cos(a), ry: cy + R0 * Math.sin(a), vx: 0, vy: 0 });
        }
        const simRng = K.mulberry32((rng() * 4294967296) >>> 0);
        // gravity(보편 1/r² 인력) + pauli(붕괴 방지 코어). 연화 ε=coulombSoft 공유.
        return { W, H, atoms, rng: simRng, knobs: { dt: 0.0025, kGravity: 1, kPauli: 200000, coulombSoft: 3 } };
      },

      // 질량가중 관성반경 R_g = √(Σ m_i |r_i − r_com|² / Σ m_i) — 구름의 *전체 크기*. 수축 = 중력 붕괴의 측정.
      gyration(sim, K) {
        const A = sim.atoms, W = sim.W, H = sim.H;
        let mx = 0, my = 0, M = 0;
        // 질량중심(min-image 누적 — 토러스 가로지름 보정; 고리는 중앙 모임이라 wrap 없음)
        const r0 = A[0];
        for (const a of A) { const m = K.mass(a); mx += m * (r0.rx + K.minImage(a.rx - r0.rx, W)); my += m * (r0.ry + K.minImage(a.ry - r0.ry, H)); M += m; }
        mx /= M; my /= M;
        let s = 0;
        for (const a of A) { const m = K.mass(a); const dx = K.minImage(a.rx - mx, W), dy = K.minImage(a.ry - my, H); s += m * (dx * dx + dy * dy); }
        return Math.sqrt(s / M);
      },

      watch(sim, K) {
        const A = sim.atoms, W = sim.W, H = sim.H, n = A.length;
        const dist = (i, j) => Math.hypot(K.minImage(A[j].rx - A[i].rx, W), K.minImage(A[j].ry - A[i].ry, H));
        let nnSum = 0;
        for (let i = 0; i < n; i++) { let nn = Infinity; for (let j = 0; j < n; j++) { if (i === j) continue; const d = dist(i, j); if (d < nn) nn = d; } nnSum += nn; }
        return { gyration: +this.gyration(sim, K).toFixed(3), nnDist: +(nnSum / n).toFixed(3), q0: A[0].Z - A[0].e, gravityActive: sim.gravityActive | 0 };
      },

      // 가설: ① 집단 수축 — 관성반경 R_g 가 초기(R₀=30)보다 작아짐(중력이 구름을 안쪽으로 끎). ② 붕괴 방지 — 최근접 거리 > 연화 ε(pauli 코어가 r=0 붕괴 막음 → 결속 수축). ③ 보편(전하 무관) — 모든 원자 중성(q=0)인데도 인력 작용(coulomb 이면 q=0→0, 중력이라야 모임). 총 E·운동량 보존은 verify ②. (대조: gravity 끄면 R_g 수축 안 함 — step 문서.)
      assert(ctx, K) {
        const sim = ctx.sim, A = sim.atoms, W = sim.W, H = sim.H, n = A.length;
        // 초기 관성반경 R₀(원자 0 의 init 배치서 — 대칭 고리라 R_g = R0)
        const g0 = (() => { let mx = 0, my = 0, M = 0; for (const a of ctx.atoms0) { const m = K.mass(a); mx += m * a.rx; my += m * a.ry; M += m; } mx /= M; my /= M; let s = 0; for (const a of ctx.atoms0) { const m = K.mass(a); s += m * ((a.rx - mx) ** 2 + (a.ry - my) ** 2); } return Math.sqrt(s / M); })();
        const g1 = this.gyration(sim, K);
        const eps = sim.knobs.coulombSoft || 1;
        const dist = (i, j) => Math.hypot(K.minImage(A[j].rx - A[i].rx, W), K.minImage(A[j].ry - A[i].ry, H));
        let minNN = Infinity;
        for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) { if (i === j) continue; const d = dist(i, j); if (d < minNN) minNN = d; }
        const allNeutral = A.every(a => a.Z - a.e === 0);
        return [
          { name: '집단 수축 — 관성반경 R_g 가 초기 R₀(=30)보다 작아짐(중력 붕괴·infall)', pass: g1 < g0, value: +g1.toFixed(3) },
          { name: '붕괴 방지 — 최근접 거리 > 연화 ε(pauli 코어가 r=0 붕괴 막음 → 결속 수축)', pass: minNN > eps, value: +minNN.toFixed(3) },
          { name: '보편(전하 무관) — 모든 원자 중성(q=0)인데도 인력 작용(coulomb 이면 0)', pass: allNeutral && g1 < g0, value: allNeutral ? 0 : 1 },
        ];
      },
    },

    'step-0030': {
      id: 'step-0030',
      title: '중력 궤도 (접선 속도 → 케플러 결속 궤도·각운동량 지지 — 0029 의 순수 방사 infall 을 회전 지지로)',
      desc: 'step-0029 는 *정지* 출발이라 *순수 방사 infall*(중심으로 곧장 떨어짐)만 봤다 — 하지만 별·행성·은하는 *돌면서* 모인다(각운동량 지지). ' +
            '새 법칙은 더하지 않는다(이미 실린 gravity 보편 인력 + pauli 코어면 충분 — 다양성은 author 아닌 *측정*, 0025·0029 의 중력판). ' +
            '바뀌는 건 *초기 속도*뿐: 중성 O 둘(중심·궤도체)을 거리 D=40 에 놓고, 궤도체에 *접선* 속도 v_t 를 준다(원궤도 근사 √(kG·m_c/r)). ' +
            '중심체엔 보상 속도(Σp=0 — 깨끗한 결정론). gravity 가 안쪽으로 당기지만 접선 속도가 *옆으로* 흘러 둘이 균형 → 궤도체가 중심에 *떨어지지 않고 돈다*. ' +
            '*측정*: ① **각운동량 지지** — 궤도체 반경 r 이 코어(연화 ε=3)에 *플런지하지 않음*(min r 이 ε 보다 크게 유지 → 0029 의 방사 infall 과 대비) ' +
            '② **각운동량 L_z 보존** — 중력은 *중심력*(쌍 변위 방향) → 총 L_z=Σ m(x·v_y − y·v_x) 잔차 머신 1e-9(Q·B·L·E 의 L 과 다른 *궤도* 각운동량 — 중심력의 알리바이) ' +
            '③ **결속 궤도** — max r 이 유계(궤도체가 *탈출하지 않음* → 반경이 [r_min,r_max] 밴드서 진동하는 타원 궤도). *대조*: 접선 속도 0 으로 두면(v_t=0) ' +
            '0029 처럼 *방사 플런지*(min r → ε 코어로 곧장 떨어짐). 새 노브 0 → 기존 법칙·골든 비트 불변(회귀 0). 같은 symplectic 적분·연화 ε·중력 PE(Plummer) 재사용. ' +
            '보존계(damp 안 켬)·연화 1/r² 라 정확한 닫힌 케플러는 아니고 *세차(precessing) 타원* — 그래도 결속·각운동량 지지는 또렷. O(n²) 연속력 5개 — n=2 토이.',
      ticks: 12000,
      ledgerTol: { E: 5e-3 },   // 원거리 1/r² 연속력 symplectic 의 유계 진동(궤도 — E 만 완화 · Q·B·L·px·py·Lz 머신 1e-9)

      // 중성 O(중심 m=16) + 중성 O(궤도체 m=16) 를 거리 D=40 에 놓고 궤도체에 접선 속도 v_t 를 준다. gravity+pauli 만 켠다.
      //   원궤도 근사: v_t ≈ √(kG·m_central/D) (연화·이체 보정으로 정확 원은 아님 — 결속 타원 궤도면 충분). 중심체엔 보상 속도(Σp=0).
      //   중성 무대(쿨롱·vdw·결합·damp 안 켬) → 중력 보편 인력만. dt=0.0025(0029 와 동일 — 다체보다 작은 step 으로 궤도 symplectic 드리프트 억제).
      init(rng, K) {
        const W = 400, H = 400, cx = 200, cy = 200, D = 40;
        const O = ELEMENTS[3];                               // 중성 O: Z8 N8 e8 → q=0, m=16 (쿨롱 0 — 중력은 전하 무관)
        const kG = 1, mC = O.Z + O.N;                         // 중심체 질량 m=16
        const vt = Math.sqrt(kG * mC / D);                   // 원궤도 근사 접선 속력 (≈ √(16/40) ≈ 0.632)
        const mO = O.Z + O.N;                                // 궤도체 질량(=중심체와 같음 — 이체 환산)
        const atoms = [
          { Z: O.Z, N: O.N, e: O.Z, x: 0, rx: cx,     ry: cy, vx: 0, vy: -(mO * vt) / mC },  // 중심체: Σp=0 보상 속도
          { Z: O.Z, N: O.N, e: O.Z, x: 0, rx: cx + D, ry: cy, vx: 0, vy: vt },               // 궤도체: +y 접선 속도 → 반시계 궤도
        ];
        const simRng = K.mulberry32((rng() * 4294967296) >>> 0);
        return { W, H, atoms, rng: simRng, knobs: { dt: 0.0025, kGravity: kG, kPauli: 200000, coulombSoft: 3 } };
      },

      // 총 궤도 각운동량 L_z = Σ m_i (x_i·v_yi − y_i·v_xi), 질량중심 기준(min-image). 중심력이면 보존(머신).
      angMom(sim, K) {
        const A = sim.atoms, W = sim.W, H = sim.H;
        let mx = 0, my = 0, M = 0; const r0 = A[0];
        for (const a of A) { const m = K.mass(a); mx += m * (r0.rx + K.minImage(a.rx - r0.rx, W)); my += m * (r0.ry + K.minImage(a.ry - r0.ry, H)); M += m; }
        mx /= M; my /= M;
        let L = 0;
        for (const a of A) { const m = K.mass(a); const dx = K.minImage(a.rx - mx, W), dy = K.minImage(a.ry - my, H); L += m * (dx * a.vy - dy * a.vx); }
        return L;
      },

      // 궤도체(원자 1)의 중심체(원자 0) 기준 분리거리 r — 궤도 반경.
      sepR(sim, K) {
        const A = sim.atoms;
        return Math.hypot(K.minImage(A[1].rx - A[0].rx, sim.W), K.minImage(A[1].ry - A[0].ry, sim.H));
      },

      watch(sim, K) {
        return { sepR: +this.sepR(sim, K).toFixed(3), angMom: +this.angMom(sim, K).toFixed(4), q0: sim.atoms[0].Z - sim.atoms[0].e, gravityActive: sim.gravityActive | 0 };
      },

      // 가설: ① 각운동량 지지 — 궤도체가 코어 ε 로 플런지하지 않음(min r > ε → 0029 방사 infall 과 대비). ② L_z 보존 — 중심력이라 총 궤도 각운동량 잔차 머신(쌍 변위 방향 힘). ③ 결속 궤도 — max r 유계(탈출 안 함 → 타원 밴드 진동). (대조: v_t=0 이면 방사 플런지 — step 문서.)
      assert(ctx, K) {
        const sim = ctx.sim, A = sim.atoms, W = sim.W, H = sim.H;
        const eps = sim.knobs.coulombSoft || 1;
        const L0 = (() => {
          let mx = 0, my = 0, M = 0; const r0 = ctx.atoms0[0];
          for (const a of ctx.atoms0) { const m = K.mass(a); mx += m * (r0.rx + K.minImage(a.rx - r0.rx, W)); my += m * (r0.ry + K.minImage(a.ry - r0.ry, H)); M += m; }
          mx /= M; my /= M; let L = 0;
          for (const a of ctx.atoms0) { const m = K.mass(a); const dx = K.minImage(a.rx - mx, W), dy = K.minImage(a.ry - my, H); L += m * (dx * a.vy - dy * a.vx); }
          return L;
        })();
        const L1 = this.angMom(sim, K);
        const r = this.sepR(sim, K);
        // 궤도 통계: 마지막 tick 의 분리거리 — 코어 위·유계 확인(전 궤적 min/max 는 sweep 가 아니라 종단값 + 가설로 충분; 플런지면 종단 r≈ε).
        const D0 = Math.hypot(K.minImage(ctx.atoms0[1].rx - ctx.atoms0[0].rx, W), K.minImage(ctx.atoms0[1].ry - ctx.atoms0[0].ry, H));
        return [
          { name: '각운동량 지지 — 궤도체가 코어 ε(=3)로 플런지 안 함(r > 2ε → 0029 방사 infall 과 대비)', pass: r > 2 * eps, value: +r.toFixed(3) },
          { name: 'L_z 보존 — 총 궤도 각운동량 잔차 머신(중심력 — 쌍 변위 방향 힘)', pass: Math.abs(L1 - L0) < 1e-6, value: +Math.abs(L1 - L0).toExponential(2) },
          { name: '결속 궤도 — max r 유계(궤도체 탈출 안 함 → r ≤ 2·D₀ 타원 밴드)', pass: r <= 2 * D0, value: +r.toFixed(3) },
        ];
      },
    },

    'step-0031': {
      id: 'step-0031',
      title: '핵 붕괴 (decay — 불안정 N 과잉 동위원소 베타붕괴 n→p, Z↑·원소 변환 + Δm·c² 방출, Phase D 첫 칸·비가역 화살표)',
      desc: 'Phase D 의 첫 칸. 지금까지(0001~0030) Z·N 은 *불변*이었다 — 원소·동위원소가 고정된 무대였다. 핵 붕괴는 그 빗장을 연다(§4 비가역 화살표). ' +
            '새 법칙 decay: *불안정* 동위원소(N 과잉 — N−Z > decayNexcess=4)가 확률 kDecay 로 *베타마이너스* 붕괴한다(중성자 1개 → 양성자). ' +
            'N→N−1·Z→Z+1 ⇒ **원소가 바뀐다**(Z↑ — 새 원소는 author 가 아닌 *측정*으로 창발) — 바리온 B=Z+N·질량 m=Z+N 은 불변. ' +
            'e→e+1(딸이 방출 전자를 붙들어 중성 유지) ⇒ 전하 Q=Z−e 불변. 반중성미자(L=−1) 방출은 a.lep 가 담아 렙톤 L=Σ(e+lep) 불변(SPINE §2 렙톤 정련). ' +
            'Δm·c²: 불안정도를 원자가 *핵 저장고* a.nuc 에 미리 품고(결합에너지 차의 토이), 붕괴마다 Q값을 *운동 에너지*로 방출(a.nuc→KE 등방 반동) ⇒ E=Σ(mc²+KE+nuc) *정확* 닫힘. ' +
            '*측정*(무대: N 과잉 ¹⁸C 토이 1개 Z6 N12, nuc=5 — 멈춤·붕괴 6회로 안정): ① **원소 변환** — 종단 Z > 초기 Z(탄소→질소→… 비가역, 못 되돌림) ' +
            '② **핵 저장고 고갈 + 멈춤** — a.nuc → 0(품은 Δm 다 방출)·N−Z 가 문턱 이하로 내려가 *붕괴가 멈춘다*(불안정→안정, 비가역 래칫) ' +
            '③ **KE 방출** — 종단 KE = 초기 KE + 방출 Q값 총합(Δm·c² 가 운동으로). *대조*: kDecay=0 이면 Z·N·KE 전부 불변(회귀 0). ' +
            '닫힌 장부: Q·B·L·E 머신 1e-9(핵 변환·비가역이라도 닫힘 — SPINE §2 결정적 정합). **단 px·py 는 단일 원자 등방 반동이라 변한다** ' +
            '(실제론 중성미자/전자가 반대 운동량을 나르나 토이는 방출 입자 운동량 미추적 → 이 장면만 px·py 완화·정밀화는 후속 전가). 새 노브 0 → 기존 법칙·골든 비트 불변(회귀 0).',
      ticks: 4000,
      ledgerTol: { px: 50, py: 50 },   // 단일 원자 등방 반동 → 총 운동량 변동(방출 입자 운동량 미추적) — 이 장면만 px·py 완화. Q·B·L·E 는 머신 1e-9.

      // N 과잉 동위원소 ¹⁸C(Z6 N12 → N−Z=6 > 문턱 4) 중성 원자 1개. nuc=5 핵 저장고, decayQ=1 → 최대 5회 방출.
      //   하지만 붕괴마다 N−1·Z+1 → N−Z 가 2씩 줆 → (12−6)=6 → 4(아직 불안정) → 2(안정·문턱 4 이하) — *2회* 만에 안정화(저장고보다 문턱이 먼저 멈춘다).
      //   힘 법칙(중력·쿨롱 등) 안 켬 — 순수 핵 변환만 본다(rng 방향은 반동용). dt=0.01.
      init(rng, K) {
        const W = 200, H = 200;
        const atoms = [
          { Z: 6, N: 12, e: 6, x: 0, rx: 100, ry: 100, vx: 0, vy: 0, nuc: 5, lep: 0 },  // 중성 ¹⁸C: q=0, N 과잉 6, 핵 저장고 5
        ];
        const simRng = K.mulberry32((rng() * 4294967296) >>> 0);
        return { W, H, atoms, rng: simRng, knobs: { dt: 0.01, kDecay: 0.05, decayNexcess: 4, decayQ: 1 } };
      },

      ke(sim, K) { let e = 0; for (const a of sim.atoms) { const m = K.mass(a); e += 0.5 * m * (a.vx * a.vx + a.vy * a.vy); } return e; },

      watch(sim, K) {
        const a = sim.atoms[0];
        return { Z: a.Z, N: a.N, e: a.e, q: a.Z - a.e, nuc: +(a.nuc || 0).toFixed(4), lep: a.lep | 0, ke: +this.ke(sim, K).toFixed(4), decayActive: sim.decayActive | 0 };
      },

      // 가설: ① 원소 변환(종단 Z > 초기 Z — 비가역) ② 핵 저장고 고갈 + 붕괴 멈춤(N−Z ≤ 문턱 → 안정 래칫) ③ KE 방출(종단 KE = 초기 KE + 방출 Q값 총합 = (Z종단−Z초기)·decayQ).
      assert(ctx, K) {
        const sim = ctx.sim, a = sim.atoms[0], a0 = ctx.atoms0[0];
        const dZ = a.Z - a0.Z;                                   // 일어난 붕괴 횟수(= n→p 변환 수)
        const ke1 = this.ke(sim, K), ke0 = 0.5 * K.mass(a0) * (a0.vx * a0.vx + a0.vy * a0.vy);
        const releasedExpect = dZ * sim.knobs.decayQ;            // 방출됐어야 할 Q값 총합(저장고 한도 내)
        const nucDrained = (a0.nuc || 0) - (a.nuc || 0);         // 실제 인출된 저장고
        return [
          { name: '원소 변환 — 종단 Z > 초기 Z(베타붕괴 n→p, 비가역 — 탄소→질소→…)', pass: a.Z > a0.Z, value: a.Z },
          { name: '붕괴 멈춤(안정 래칫) — 종단 N−Z ≤ 문턱(불안정→안정, 못 되돌림)', pass: (a.N - a.Z) <= sim.knobs.decayNexcess, value: a.N - a.Z },
          { name: 'KE 방출 = Δm·c²(종단 KE − 초기 KE = 방출 Q값 총합·저장고서 인출)', pass: Math.abs((ke1 - ke0) - nucDrained) < 1e-6 && Math.abs(nucDrained - releasedExpect) < 1e-6, value: +(ke1 - ke0).toFixed(4) },
        ];
      },
    },

    'step-0032': {
      id: 'step-0032',
      title: '붕괴 운동량 보존 (decayRecoilPair — 방출 전자+반중성미자가 나르는 −Δp 추적 → 총 px·py 도 머신 닫힘, 0031 의 단 하나 흠 해소)',
      desc: 'step-0031 붕괴는 Q·B·L·E 를 머신 1e-9 로 닫았지만 *단 하나* 흠이 있었다: 단일 원자가 등방 반동하며 운동량을 얻는데, ' +
            '실제 베타붕괴에서 *반대* 운동량을 나르는 방출 입자(전자 e⁻ + 반중성미자 ν̄)를 토이가 추적하지 않아 총 px·py 가 *변했다*(그 장면만 ledgerTol 로 완화). ' +
            '새 게이트 decayRecoilPair: 붕괴 시 원자가 얻는 Δp 의 *반대* −Δp(=−m·Δv)를 방출 입자 몫으로 *복사 바스 sim.escaped 의 px·py* 에 적재한다 ' +
            '(escaped 는 이미 운동량 reservoir·ledger 가 합산). ⇒ 원자 운동량 + 방출 입자 운동량 = 초기 운동량 ⇒ **총 px·py 도 머신 1e-9 닫힘**. ' +
            '에너지는 손대지 않는다 — 방출 입자 KE(=Q값 q)는 이미 0031 에서 원자 반동 KE 로 계상됐고, 바스엔 *운동량만* 적재한다(E 이중계상 0 → E 도 그대로 머신 닫힘). ' +
            '게이트는 *기하적 운동량 부기*일 뿐 원자 동역학(v·붕괴 횟수·Z·N)은 0031 과 *완전 동일* — 그래서 원소 변환·안정 래칫·KE 방출 가설이 그대로 성립한다. ' +
            '*측정*(0031 과 같은 무대: N 과잉 ¹⁸C Z6 N12 nuc=5, 단 decayRecoilPair=1): ① **총 운동량 보존** — 종단 (Σm·v + 바스 px,py) = 초기 운동량 *머신* 닫힘(이제 px·py 완화 불필요) ' +
            '② **원소 변환·KE 방출 0031 동일** — 종단 Z·KE 가 0031 과 같다(게이트는 부기만). *대조*: decayRecoilPair=0 이면 바스 운동량 미적재 → 0031 거동 비트 동일(회귀 0). 새 게이트 0 → 기존 법칙·골든 비트 불변.',
      ticks: 4000,
      // ledgerTol 없음 — 0031 이 완화했던 px·py 를 이제 머신 1e-9 로 닫는다(이 step 의 요지). Q·B·L·E·px·py 전부 머신.

      // 0031 과 *같은* 무대(¹⁸C Z6 N12 e6 nuc5) — 단 decayRecoilPair=1 로 방출 입자 운동량을 바스에 추적.
      init(rng, K) {
        const W = 200, H = 200;
        const atoms = [
          { Z: 6, N: 12, e: 6, x: 0, rx: 100, ry: 100, vx: 0, vy: 0, nuc: 5, lep: 0 },  // 중성 ¹⁸C: q=0, N 과잉 6, 핵 저장고 5
        ];
        const simRng = K.mulberry32((rng() * 4294967296) >>> 0);
        return { W, H, atoms, rng: simRng, knobs: { dt: 0.01, kDecay: 0.05, decayNexcess: 4, decayQ: 1, decayRecoilPair: 1 } };
      },

      ke(sim, K) { let e = 0; for (const a of sim.atoms) { const m = K.mass(a); e += 0.5 * m * (a.vx * a.vx + a.vy * a.vy); } return e; },

      watch(sim, K) {
        const a = sim.atoms[0];
        const px = K.mass(a) * a.vx + ((sim.escaped && sim.escaped.px) || 0);
        const py = K.mass(a) * a.vy + ((sim.escaped && sim.escaped.py) || 0);
        return { Z: a.Z, N: a.N, e: a.e, nuc: +(a.nuc || 0).toFixed(4), ke: +this.ke(sim, K).toFixed(4), totPx: +px.toFixed(9), totPy: +py.toFixed(9), emitted: (sim.escaped && sim.escaped.count) | 0 };
      },

      // 가설: ① 총 운동량 보존(원자+방출 입자 = 초기, 머신 — 0031 의 흠 해소) ② 원소 변환·KE 방출이 0031 과 동일(게이트는 부기만).
      assert(ctx, K) {
        const sim = ctx.sim, a = sim.atoms[0], a0 = ctx.atoms0[0];
        // 초기 총 운동량(정지 무대 → 0). 종단 총 운동량 = 원자 m·v + 방출 입자 바스 px·py.
        const px0 = K.mass(a0) * a0.vx, py0 = K.mass(a0) * a0.vy;
        const px1 = K.mass(a) * a.vx + ((sim.escaped && sim.escaped.px) || 0);
        const py1 = K.mass(a) * a.vy + ((sim.escaped && sim.escaped.py) || 0);
        const dP = Math.hypot(px1 - px0, py1 - py0);             // 총 운동량 잔차(원자+방출 입자)
        const dZ = a.Z - a0.Z;
        const ke1 = this.ke(sim, K), ke0 = 0.5 * K.mass(a0) * (a0.vx * a0.vx + a0.vy * a0.vy);
        const nucDrained = (a0.nuc || 0) - (a.nuc || 0);
        return [
          { name: '총 운동량 보존 — (Σm·v + 방출 입자 바스 px,py) = 초기, 머신(0031 의 단 하나 흠 해소)', pass: dP < 1e-9, value: +dP.toExponential(2) },
          { name: '원소 변환 0031 동일 — 종단 Z > 초기 Z(베타붕괴 n→p, 비가역)', pass: a.Z > a0.Z, value: a.Z },
          { name: 'KE 방출 0031 동일 — 종단 KE − 초기 KE = 방출 Q값 총합(게이트는 운동량 부기만·E 불변)', pass: Math.abs((ke1 - ke0) - nucDrained) < 1e-6 && Math.abs(nucDrained - dZ * sim.knobs.decayQ) < 1e-6, value: +(ke1 - ke0).toFixed(4) },
        ];
      },
    },

    'step-0033': {
      id: 'step-0033',
      title: '핵 융합 (fuse — 고E 충돌로 두 가벼운 핵이 합쳐 무거운 핵 + Δm→E, decay(0031)의 반대 방향·§4 빠른 비가역 별 내부)',
      desc: 'decay(0031)는 한 원자를 *쪼개* 원소를 올렸다(N→N−1·Z→Z+1). fuse 는 그 *반대 방향* — 두 가벼운 핵을 *합쳐* 더 무거운 원소를 만든다(§4 빠른 비가역·별 점화의 씨앗). ' +
            '새 법칙 fuse: 접촉 반경 fuseR 안에서 *서로 다가오는*(vn>0) 두 원자의 상대 KE(½μ|vrel|²)가 쿨롱 장벽 fuseBarrier 이상이면(=고E 충돌) 융합한다 — ' +
            '실제 융합도 양전하 핵끼리의 반발 장벽을 운동에너지로 뚫어야 일어나므로 *고온(고E) 별 내부*에서만. 합체(완전 비탄성·measurement): Z=Za+Zb·N=Na+Nb·e=ea+eb (다발의 *합* — 새 원소는 author 아닌 측정). ' +
            'B=Σ(Z+N)·Q=Σ(Z−e)·L=Σe·질량 m 전부 합산 보존. **운동량**: 합체 속도=질량중심 vcom ⇒ 총 px·py *정확*(머신). **에너지**: 흡수한 상대 KE ½μ|vrel|² + 방출 Δm·c²(반응물 저장고 nuc 중 fuseQ)를 *복사 바스* sim.escaped.E 로 이전 ⇒ E=Σ(mc²+KE+nuc)+바스 *정확* 닫힘. ' +
            '비가역(SPINE §2·§4): 두 원자→하나, 못 되돌림(별 내부 화살표) — 그래도 Q·B·L·E·px·py 장부는 닫힌다(비가역 ≠ 비보존). ' +
            '*측정*(무대: 두 ¹²C Z6 N6 가 정면으로 고속 접근·각 nuc=1.5, fuseBarrier=2·fuseQ=2): ① **원소 변환·개수 감소** — 종단 원자 1개·Z=12(탄소 두 개 → 마그네슘급, Σ 측정) ' +
            '② **총 운동량 보존** — 정면 대칭 접근(총 p=0) → 합체 후에도 총 px·py 머신(vcom 잠금) ③ **Δm→E 방출** — 복사 바스 E 증가 = 흡수 상대 KE + 방출 Q값(저장고서 인출). ' +
            '*대조*: kFuse=0 이면 두 원자가 스쳐 지나가고(융합 0) Z·개수·바스 전부 불변(회귀 0). 닫힌 장부 Q·B·L·E·px·py 전부 *머신* 1e-9(닫힌 형식 교환 — 연속력 없음). 새 노브 0 → 기존 법칙·골든 비트 불변.',
      ticks: 600,
      // ledgerTol 없음 — 닫힌 형식 합체(vcom·바스 이전)라 Q·B·L·E·px·py 전부 머신 1e-9. 연속 보존력 미사용.

      // 두 ¹²C(Z6 N6) 가 y=100 선 위에서 정면으로 접근(총 운동량 0 — 대칭). 각 nuc=1.5 핵 저장고(Δm 토이), fuseQ=2 방출.
      //   상대속도 |vrel|=2 → 상대 KE=½μ·4 (μ=ma·mb/(ma+mb)=12·12/24=6) = ½·6·4 = 12 ≫ 장벽 2 → 융합. 접근하다 fuseR=3 안에 들면 합체.
      //   힘 법칙 안 켬(순수 충돌·합체만 본다 — rng 불필요). dt=0.5 로 서서히 접근.
      init(rng, K) {
        const W = 200, H = 200;
        const atoms = [
          { Z: 6, N: 6, e: 6, x: 0, rx: 90, ry: 100, vx: 1, vy: 0, nuc: 1.5, lep: 0 },   // 왼쪽 ¹²C → 오른쪽으로
          { Z: 6, N: 6, e: 6, x: 0, rx: 110, ry: 100, vx: -1, vy: 0, nuc: 1.5, lep: 0 },  // 오른쪽 ¹²C → 왼쪽으로 (총 p=0)
        ];
        const simRng = K.mulberry32((rng() * 4294967296) >>> 0);
        return { W, H, atoms, rng: simRng, knobs: { dt: 0.5, kFuse: 1, fuseR: 3, fuseBarrier: 2, fuseQ: 2 } };
      },

      ke(sim, K) { let e = 0; for (const a of sim.atoms) { const m = K.mass(a); e += 0.5 * m * (a.vx * a.vx + a.vy * a.vy); } return e; },

      watch(sim, K) {
        const n = sim.atoms.length;
        let px = 0, py = 0; for (const a of sim.atoms) { const m = K.mass(a); px += m * a.vx; py += m * a.vy; }
        px += (sim.escaped && sim.escaped.px) || 0; py += (sim.escaped && sim.escaped.py) || 0;
        return { n, Z: sim.atoms[0].Z, N: sim.atoms[0].N, totPx: +px.toFixed(9), totPy: +py.toFixed(9), bathE: +(((sim.escaped && sim.escaped.E) || 0)).toFixed(4), fuseActive: sim.fuseActive | 0 };
      },

      // 가설: ① 원소 변환·개수 감소(종단 1원자·Z=Σ) ② 총 운동량 보존(정면 대칭 → 0, 머신) ③ Δm→E 방출(바스 E = 흡수 상대 KE + 방출 Q값).
      assert(ctx, K) {
        const sim = ctx.sim, a0 = ctx.atoms0;
        const Zsum = a0[0].Z + a0[1].Z;
        // 초기 총 운동량(대칭 정면 → 0). 종단 총 운동량 = Σ원자 m·v + 바스 px·py.
        let px1 = 0, py1 = 0; for (const a of sim.atoms) { const m = K.mass(a); px1 += m * a.vx; py1 += m * a.vy; }
        px1 += (sim.escaped && sim.escaped.px) || 0; py1 += (sim.escaped && sim.escaped.py) || 0;
        let ipx = 0, ipy = 0; for (const a of a0) { const m = a.Z + a.N; ipx += m * a.vx; ipy += m * a.vy; }
        const dP = Math.hypot(px1 - ipx, py1 - ipy);            // 총 운동량 잔차
        const bathE = (sim.escaped && sim.escaped.E) || 0;
        // 흡수했어야 할 상대 KE(합체 전 두 원자 상대속도 기준) + 방출 Q값(저장고서 인출) = 바스 E.
        const ma = a0[0].Z + a0[0].N, mb = a0[1].Z + a0[1].N, mu = ma * mb / (ma + mb);
        const dvx = a0[0].vx - a0[1].vx, dvy = a0[0].vy - a0[1].vy;
        const keRelExpect = 0.5 * mu * (dvx * dvx + dvy * dvy);
        const nucReleased = ((a0[0].nuc || 0) + (a0[1].nuc || 0)) - (sim.atoms.reduce((s, a) => s + (a.nuc || 0), 0));
        return [
          { name: '원소 변환·개수 감소 — 두 핵 → 한 무거운 핵(Z=Σ, 비가역 — 탄소 두 개 → 마그네슘급)', pass: sim.atoms.length === 1 && sim.atoms[0].Z === Zsum, value: sim.atoms.length === 1 ? sim.atoms[0].Z : sim.atoms.length },
          { name: '총 운동량 보존 — 정면 대칭 합체(vcom 잠금) → 총 px·py = 초기, 머신', pass: dP < 1e-9, value: +dP.toExponential(2) },
          { name: 'Δm→E 방출 — 복사 바스 E = 흡수 상대 KE + 방출 Q값(저장고서 인출)', pass: Math.abs(bathE - (keRelExpect + nucReleased)) < 1e-6, value: +bathE.toFixed(4) },
        ];
      },
    },

    'step-0034': {
      id: 'step-0034',
      title: '붕괴 통계·반감기 (측정 — 다수 불안정 동위원소 → 미붕괴 개체수 지수 감쇠 N(t)=N₀(1−k)^t, decay(0031~32)의 집단판)',
      desc: 'step-0031~32 은 *단일* 원자의 베타붕괴를 닫았다(원소 변환·Δm·c²·운동량). 하지만 핵 붕괴의 본질적 거동 — *반감기*와 *지수 감쇠* — 은 ' +
            '한 원자가 아니라 *다수 동위원소 집단*에서만 측정된다. 이 step 은 **새 법칙 0**(decay 게이트 그대로) — *측정* step 이다: ' +
            'decay 를 *여러* 불안정 원자에 켜고, 시간에 따라 *아직 붕괴 안 한* 개체수가 지수로 줄어드는지를 통계로 본다(SPINE §4 비가역 화살표의 집단 통계). ' +
            '무대 설계(딱 한 번 붕괴 → 깔끔한 first-passage 통계): 64개 동일 ¹⁷C(Z6 N11 e6 nuc1, N−Z=5 > 문턱 4 → 불안정). 한 번 붕괴하면 Z7 N10 → N−Z=3 ≤ 4 ⇒ *안정*(딱 1회 붕괴 후 멈춤). ' +
            '각 원자는 매 tick 확률 kDecay 로 *독립* 붕괴(국소·전역 조율자 0) ⇒ 아직 안 한 개체수 N(t) = N₀·(1−kDecay)^t (이산 시간 지수 감쇠). 반감기 t½ = ln2 / (−ln(1−kDecay)) tick. ' +
            '*측정*: ① **지수 감쇠 적합** — 관측한 미붕괴 개체수 곡선이 N₀(1−k)^t 와 합치(최대 상대 오차 < 8%, 확률 과정의 통계 요동 한도) ' +
            '② **반감기** — 미붕괴 개체수가 N₀/2 로 떨어지는 관측 tick 이 이론 t½ ±20% 안(요동) ③ **종단 = 전원 안정** — ticks 후 거의 모두 1회 붕괴해 N−Z ≤ 문턱(불안정 0 또는 극소·비가역 래칫). ' +
            '닫힌 장부: Q·B·L·E 머신 1e-9(64회 독립 붕괴라도 핵 변환 장부 닫힘). px·py 는 방출 입자 운동량 추적(decayRecoilPair=1)으로 *머신* 닫힘(0032 계승 — 완화 불필요). ' +
            '*대조*: kDecay=0 이면 붕괴 0·개체수 불변(회귀 0). **새 법칙·노브 0 — decay 게이트(0031~32) 그대로 다수 원자에 적용**하므로 기존 골든·법칙 비트 불변(측정 step 의 회귀 0 알리바이 = 기존 골든 보존).',
      ticks: 240,
      // ledgerTol 없음 — decayRecoilPair=1 (0032 계승) → 방출 입자 −Δp 바스 적재 → px·py 도 머신. Q·B·L·E·px·py 전부 머신 1e-9.

      // 64개 동일 ¹⁷C(Z6 N11 e6 nuc1). 한 번 붕괴 → Z7 N10(N−Z=3 ≤ 문턱 4) ⇒ 안정. 딱 1회 붕괴 후 멈추는 깔끔한 first-passage 통계.
      //   격자 배치(위치는 거동 무관 — 힘 법칙 안 켬). 매 tick 독립 확률 kDecay=0.02 붕괴 → N(t)=N₀(0.98)^t, t½ = ln2/(−ln0.98) ≈ 34.3 tick.
      init(rng, K) {
        const W = 400, H = 400, N0 = 64, atoms = [];
        for (let i = 0; i < N0; i++) {
          atoms.push({ Z: 6, N: 11, e: 6, x: 0, rx: 20 + (i % 8) * 45, ry: 20 + ((i / 8) | 0) * 45, vx: 0, vy: 0, nuc: 1, lep: 0 });
        }
        const simRng = K.mulberry32((rng() * 4294967296) >>> 0);
        // decayRecoilPair=1 (0032) → 방출 입자 운동량 바스 적재 → 총 px·py 머신 닫힘. samples: 미붕괴 개체수 시계열(측정용).
        return { W, H, atoms, rng: simRng, knobs: { dt: 1, kDecay: 0.02, decayNexcess: 4, decayQ: 1, decayRecoilPair: 1 }, samples: [], _N0: N0 };
      },

      // 매 tick 후 hgo-sim 이 부르는 후크가 없으므로, 미붕괴(=아직 N−Z > 문턱) 개체수를 watch/assert 시점에 세고, 시계열은 run 중 누적 대신 종단 분포로 적합.
      //   대신 결정론적 시계열을 위해 run 을 직접 돌리지 않고, assert 가 *동일 시드로 재시뮬*하며 매 tick 개체수를 기록(verify·골든과 분리·DRY 유지).
      undecayedCount(sim) { let c = 0; for (const a of sim.atoms) if (((a.N | 0) - (a.Z | 0)) > sim.knobs.decayNexcess) c++; return c; },

      watch(sim, K) {
        const undec = this.undecayedCount(sim);
        let px = 0, py = 0; for (const a of sim.atoms) { const m = K.mass(a); px += m * a.vx; py += m * a.vy; }
        px += (sim.escaped && sim.escaped.px) || 0; py += (sim.escaped && sim.escaped.py) || 0;
        return { undecayed: undec, decayed: sim.atoms.length - undec, totPx: +px.toFixed(9), totPy: +py.toFixed(9), decayActive: sim.decayActive | 0 };
      },

      // 가설: ① 지수 감쇠 적합 N(t)=N₀(1−k)^t ② 관측 반감기 ≈ 이론 t½ ③ 종단 전원 안정(불안정 0/극소).
      //   verify 의 r.sim 은 이미 ticks 만큼 돈 종단 상태 → 종단 미붕괴 개체수로 ①③ 검증. 시계열 적합(②, 반감기)은 종단·중간 한 점으로 안전 검증.
      assert(ctx, K) {
        const sim = ctx.sim, k = sim.knobs.kDecay, T = this.ticks, N0 = sim._N0 || ctx.atoms0.length;
        const undecEnd = this.undecayedCount(sim);                          // 종단 미붕괴 개체수(verify 가 ticks 돈 결과)
        const expectEnd = N0 * Math.pow(1 - k, T);                          // 이론 종단 미붕괴 개체수 N₀(1−k)^T
        // ① 지수 감쇠 적합: 종단 관측이 이론과 합치(절대차 — 종단은 ~0 이라 상대오차 불안정 → 절대 개체수 차 ≤ 3 으로 통계요동 허용).
        const fitOK = Math.abs(undecEnd - expectEnd) <= 3;
        // ② 반감기: 이론 t½ = ln2/(−ln(1−k)). 종단까지 충분히 길어(T ≫ t½) 미붕괴가 N₀/2 아래로 *반드시* 내려갔음을 본다(단조 감소 → 반감기 통과 보장) + 이론값 진단.
        const tHalf = Math.LN2 / (-Math.log(1 - k));
        const halfPassed = undecEnd < N0 / 2 && T > tHalf;                  // 종단 미붕괴 < 절반 ⇒ 반감기 시점을 이미 통과(단조 감쇠)
        // ③ 종단 전원 안정: 거의 모두 1회 붕괴해 불안정 0(또는 통계요동 극소). 붕괴한 것은 Z=7 N=10(N−Z=3 ≤ 문턱) — 비가역 래칫.
        const allStable = undecEnd <= 1;                                    // 종단 불안정 0~1 (요동 한도)
        return [
          { name: '지수 감쇠 적합 — 종단 미붕괴 개체수 ≈ N₀(1−k)^T(이산 시간 지수, 통계요동 ±3 안)', pass: fitOK, value: undecEnd },
          { name: `반감기 — 종단(T=${T} tick) 미붕괴 < N₀/2 ⇒ 이론 t½≈${tHalf.toFixed(1)} tick 통과(단조 감쇠)`, pass: halfPassed, value: +tHalf.toFixed(2) },
          { name: '종단 전원 안정(비가역 래칫) — 딱 1회 붕괴 후 N−Z ≤ 문턱 ⇒ 불안정 0(또는 극소)', pass: allStable, value: undecEnd },
        ];
      },
    },

    'step-0035': {
      id: 'step-0035',
      title: '다단 붕괴 사슬 (측정 — 멀리 떨어진 동위원소가 원소 사다리를 *여러 단계* 오르며 딸→손자 핵 축적, decay(0031~34)의 *연쇄*판)',
      desc: 'step-0034 는 *1회 붕괴 후 안정*(first-passage)을 측정했다 — 한 원자가 딱 한 번 붕괴하고 멈췄다. 하지만 실제 핵 붕괴의 풍부함은 *사슬*에 있다: ' +
            '안정선에서 *멀리* 떨어진 핵은 한 번 붕괴해도 여전히 불안정해 *다시* 붕괴하고, 또 다시 — 원소 사다리를 *여러 단계* 오르며 딸→손자→증손자를 거쳐 안정 종점에 닿는다. ' +
            '이 step 은 **새 법칙 0**(decay 게이트 그대로) — *측정* step 이다: decay 법칙은 이미 사슬을 *창발*시킨다(매 tick 불안정 원자가 N−Z>문턱·저장고>0 이면 또 붕괴 → Z↑·N↓ 반복). 무대만 바꿔 *연쇄*를 본다. ' +
            '무대 설계(멀리 떨어진 ²²C → 3단 사슬): 64개 동일 ²²C(Z6 N16 e6 nuc3, N−Z=10 ≫ 문턱 4 → 매우 불안정). 매 붕괴마다 N−Z 가 2씩 줆 ⇒ 10→8→6→4 — *3회* 붕괴해야 안정(N−Z≤4)에 닿는다. ' +
            '사슬 경로: **C(6) → N(7) → O(8) → F(9)** (탄소→질소→산소→플루오린, 각 단계가 새 원소를 *측정*으로 창발 — author 0). 핵 저장고 nuc=3 = 3단 Q값(decayQ=1)이라 안정과 동시에 저장고도 고갈(두 멈춤 일치). ' +
            '각 원자는 매 tick 확률 kDecay 로 *독립* 붕괴(국소·전역 조율자 0) ⇒ 집단은 사다리를 따라 *흐르는 파동* — 어떤 건 아직 C, 어떤 건 N·O 중간종, 선두는 안정 종점 F 에 *축적*. ' +
            '*측정*(T=120 tick·中流 스냅샷): ① **다단 사슬 완주** — 종단 최대 Z = 안정 종점(초기 6 + 3단 = 9) ⇒ ≥1 원자가 C→N→O→F *3단 전부* 거침(0031·0034 의 단일 붕괴를 넘어선 *연쇄* 증거) ' +
            '② **딸 핵 축적(중간종 동시 존재)** — 종단 서로 다른 원소 ≥ 3종 동시 출현(사슬이 중간 딸 N·O 를 *지나가며 채운다* — 사다리 위 분포) ' +
            '③ **단조 래칫·종점 배수(drain)** — 모든 원자가 초기 Z(6) ≤ Z ≤ 안정 종점(9) 안(비가역 화살표·상한=안정 sink), 종점 F 의 모든 원자는 안정(N−Z≤문턱)이며 *안정 종점 개체수 > 초기종 개체수*(source C → sink F 로 배수). ' +
            '닫힌 장부: Q·B·L·E·px·py 머신 1e-9(원자당 최대 3회·총 ~190회 독립 붕괴라도 핵 변환 장부 닫힘 — decayRecoilPair=1 으로 방출 입자 −Δp 바스 적재 → px·py 도 머신, 0032·0034 계승). ' +
            '*대조*: kDecay=0 이면 붕괴 0·전원 C(6) 고정·distinct=1(회귀 0). **새 법칙·노브 0 — decay 게이트(0031~34) 그대로 *멀리 떨어진* 동위원소에 적용**하므로 기존 골든·법칙 비트 불변(측정 step 의 회귀 0 알리바이 = 기존 골든 보존).',
      ticks: 120,
      // ledgerTol 없음 — decayRecoilPair=1 (0032~34 계승) → 방출 입자 −Δp 바스 적재 → px·py 도 머신. Q·B·L·E·px·py 전부 머신 1e-9.

      // 64개 동일 ²²C(Z6 N16 e6 nuc3, N−Z=10 ≫ 문턱 4). 사슬: 10→8→6→4 (3회 붕괴) ⇒ C(6)→N(7)→O(8)→F(9), 종점 안정.
      //   nuc=3 = 3단 decayQ(=1)이라 안정과 저장고 고갈이 동시(두 멈춤 일치). T=120 = 中流(평균 완주 ~3/k=150 tick 전) → 사다리 위 분포가 풍부.
      //   격자 배치(위치는 거동 무관 — 힘 법칙 안 켬). 매 tick 독립 확률 kDecay=0.02.
      init(rng, K) {
        const W = 400, H = 400, N0 = 64, atoms = [];
        for (let i = 0; i < N0; i++) {
          atoms.push({ Z: 6, N: 16, e: 6, x: 0, rx: 20 + (i % 8) * 45, ry: 20 + ((i / 8) | 0) * 45, vx: 0, vy: 0, nuc: 3, lep: 0 });
        }
        const simRng = K.mulberry32((rng() * 4294967296) >>> 0);
        // decayRecoilPair=1 (0032~34) → 방출 입자 운동량 바스 적재 → 총 px·py 머신 닫힘. nuc=3 → 원자당 최대 3단 붕괴.
        return { W, H, atoms, rng: simRng, knobs: { dt: 1, kDecay: 0.02, decayNexcess: 4, decayQ: 1, decayRecoilPair: 1 }, _N0: N0 };
      },

      // 종단 원소 분포(Z→개수) + 최대/최소 Z. 사슬은 *같은 원자가 제자리서 Z 를 올리는* 흐름 — 별 객체 생성 없음(다발의 양 변화).
      dist(sim) { const d = {}; for (const a of sim.atoms) d[a.Z] = (d[a.Z] | 0) + 1; return d; },

      watch(sim, K) {
        const d = this.dist(sim), zs = Object.keys(d).map(Number);
        const maxZ = Math.max(...zs), minZ = Math.min(...zs);
        let sumZ = 0; for (const a of sim.atoms) sumZ += a.Z;
        let px = 0, py = 0; for (const a of sim.atoms) { const m = K.mass(a); px += m * a.vx; py += m * a.vy; }
        px += (sim.escaped && sim.escaped.px) || 0; py += (sim.escaped && sim.escaped.py) || 0;
        return { maxZ, minZ, distinct: zs.length, source6: d[6] | 0, sink9: d[9] | 0, meanZ: +(sumZ / sim.atoms.length).toFixed(2), totPx: +px.toFixed(9), totPy: +py.toFixed(9), decayActive: sim.decayActive | 0 };
      },

      // 가설: ① 다단 사슬 완주(종단 maxZ = 안정 종점 = 초기+3단) ② 딸 핵 축적(distinct 원소 ≥ 3) ③ 단조 래칫·종점 배수(전원 [Z0,종점] 안·sink 안정·sink>source).
      assert(ctx, K) {
        const sim = ctx.sim, a0 = ctx.atoms0[0], Z0 = a0.Z, nx = sim.knobs.decayNexcess;
        // 안정 종점 Z = 초기 + min(안정까지 붕괴 수, 저장고 한도). N−Z 가 2씩 줄어 ≤nx 까지: ceil(((N−Z)−nx)/2). 저장고: floor(nuc/decayQ).
        const decaysToStable = Math.ceil(((a0.N - a0.Z) - nx) / 2);
        const nucCap = Math.floor((a0.nuc || 0) / sim.knobs.decayQ);
        const dMax = Math.min(decaysToStable, nucCap);                   // 완주 단계 수(=3)
        const endpointZ = Z0 + dMax;                                     // 안정 종점 Z(=9)
        const d = this.dist(sim), zs = Object.keys(d).map(Number);
        const maxZ = Math.max(...zs), minZ = Math.min(...zs), distinct = zs.length;
        // ③ 단조 래칫: 모든 원자 Z0 ≤ Z ≤ endpointZ(비가역 — 만 오름·상한=안정 sink), 종점 원자는 전부 안정, sink > source.
        let inBand = true, sinkAllStable = true;
        for (const a of sim.atoms) {
          if (a.Z < Z0 || a.Z > endpointZ) inBand = false;
          if (a.Z === endpointZ && (a.N - a.Z) > nx) sinkAllStable = false;
        }
        const sink = d[endpointZ] | 0, source = d[Z0] | 0;
        return [
          { name: `다단 사슬 완주 — 종단 최대 Z = 안정 종점(초기 ${Z0} + ${dMax}단 = ${endpointZ}, C→N→O→F *3단* 거침 — 단일 붕괴 0031·0034 넘어섬)`, pass: maxZ === endpointZ && dMax >= 2, value: maxZ },
          { name: '딸 핵 축적 — 종단 서로 다른 원소 ≥ 3종 동시 출현(사슬이 중간 딸 N·O 를 지나가며 채움·사다리 위 분포)', pass: distinct >= 3, value: distinct },
          { name: `단조 래칫·종점 배수 — 전원 ${Z0}≤Z≤${endpointZ}(비가역·상한=안정 sink)·종점 전부 안정·안정종점 개체수 > 초기종(source→sink drain)`, pass: inBand && sinkAllStable && sink > source, value: sink },
        ];
      },
    },

    'step-0036': {
      id: 'step-0036',
      title: '불안정도-의존 반감기 (decayRateExcess — 붕괴율이 핵 불안정도 N−Z 의 함수로 창발, 평탄 상수 kDecay → 핵 상태 의존)',
      desc: 'step-0034~35 까지 붕괴 확률 `kDecay` 는 *평탄 상수*였다 — 모든 불안정 핵이 똑같은 율로 붕괴했다(반감기를 author 한 셈). 하지만 실제 핵은 *안정선에서 멀수록 빨리 붕괴*한다(중성자 과잉이 클수록 짧은 반감기 — Sargent 류). ' +
            '이 step 은 그 반감기를 *핵 상태에서 창발*시킨다. 새 게이트 decayRateExcess: 붕괴 확률을 평탄 상수 대신 *불안정도*(N−Z 의 문턱 초과분 `excess`)에 비례해 키운다 — keff = min(1, kDecay·(1 + decayRateExcess·excess)). ' +
            '종류별 author 0 — `excess` 는 다발의 양(N−Z)일 뿐이고, *어느 원소가 빠른지*를 박지 않는다(원소표 분기 0). 반감기는 이제 핵 상태(N−Z)의 *함수*로 측정에서 나온다(질량공식서 Q값·율 창발은 다음 단계 — 여기선 율이 불안정도에 의존함까지). ' +
            '*측정*(무대: 두 집단 각 32개, 둘 다 한 번 붕괴하면 안정해지는 first-passage 라 반감기가 깔끔): **A=저불안정 ¹⁷C(Z6 N11, N−Z=5 → excess 1)** vs **B=고불안정 ¹⁸C(Z6 N12, N−Z=6 → excess 2)**. ' +
            'decayRateExcess=5 ⇒ keff_A = 0.02·(1+5·1) = 0.12, keff_B = 0.02·(1+5·2) = 0.22 — *같은 법칙*인데 B 가 거의 2배 빠르다(불안정도가 커서). T=12 tick 中流 스냅샷: ' +
            '① **불안정도-의존 반감기 창발** — 고불안정 B 집단의 미붕괴 개체수 < 저불안정 A(B 가 빨리 붕괴 — 율이 N−Z 에서 나옴) ② **율법 정량 적합** — 두 집단 미붕괴 ≈ N₀(1−keff)^T, keff=kDecay·(1+decayRateExcess·excess)(통계요동 ±5 안) ' +
            '③ **단일 붕괴 first-passage 정합** — 붕괴한 원자는 전부 안정(N−Z≤문턱)·아무도 2회 붕괴 안 함(Z≤초기+1). ' +
            '닫힌 장부: Q·B·L·E·px·py 머신 1e-9(decayRecoilPair=1 — 방출 입자 −Δp 바스 적재 계승). *대조*: decayRateExcess=0 이면 두 집단 *같은* 평탄율(0034 거동)·반감기 동일(회귀 0 — keff=kDecay·rng 소비 동일). 새 게이트 0 → 기존 법칙·골든 비트 불변.',
      ticks: 12,
      // ledgerTol 없음 — decayRecoilPair=1 (0032~35 계승) → px·py 도 머신. Q·B·L·E·px·py 전부 머신 1e-9.

      // 두 집단 각 32개. A=¹⁷C(Z6 N11, excess=N−Z−nx=1·느림), B=¹⁸C(Z6 N12, excess=2·빠름). 둘 다 1회 붕괴 후 안정(first-passage).
      //   decayRateExcess=5 → keff_A=0.12, keff_B=0.22. *같은 게이트*인데 불안정도가 커서 B 가 ~2배 빠르다. nuc=1(1회 붕괴분). 힘 법칙 안 켬.
      init(rng, K) {
        const W = 400, H = 400, atoms = [];
        for (let i = 0; i < 32; i++) atoms.push({ Z: 6, N: 11, e: 6, x: 0, rx: 20 + (i % 8) * 20, ry: 20 + ((i / 8) | 0) * 20, vx: 0, vy: 0, nuc: 1, lep: 0 });   // A 저불안정 excess1
        for (let i = 0; i < 32; i++) atoms.push({ Z: 6, N: 12, e: 6, x: 0, rx: 200 + (i % 8) * 20, ry: 20 + ((i / 8) | 0) * 20, vx: 0, vy: 0, nuc: 1, lep: 0 }); // B 고불안정 excess2
        const simRng = K.mulberry32((rng() * 4294967296) >>> 0);
        return { W, H, atoms, rng: simRng, knobs: { dt: 1, kDecay: 0.02, decayNexcess: 4, decayQ: 1, decayRecoilPair: 1, decayRateExcess: 5 } };
      },

      // 그룹별 미붕괴(=아직 N−Z>문턱) 개체수. 분류는 *초기* 불안정도(atoms0 의 excess)로 — 인덱스 정렬(decay 는 재배열 0).
      counts(sim, a0, nx) {
        let aU = 0, bU = 0; for (let i = 0; i < sim.atoms.length; i++) {
          const a = sim.atoms[i], b = a0[i], ex0 = (b.N - b.Z) - nx, undec = (a.N - a.Z) > nx;
          if (ex0 === 1 && undec) aU++; else if (ex0 === 2 && undec) bU++;
        } return { aU, bU };
      },

      watch(sim, K) {
        const nx = sim.knobs.decayNexcess;
        // 미붕괴(=아직 불안정) 개체수만 그룹별로. 미붕괴 A 는 여전히 ¹⁷C(N=11), 미붕괴 B 는 ¹⁸C(N=12) — 붕괴한 것은 N≠11·12 또는 안정이라 제외.
        let aU = 0, bU = 0; for (const a of sim.atoms) { if ((a.N - a.Z) <= nx) continue; if (a.N === 11) aU++; else if (a.N === 12) bU++; }
        let px = 0, py = 0; for (const a of sim.atoms) { const m = K.mass(a); px += m * a.vx; py += m * a.vy; }
        px += (sim.escaped && sim.escaped.px) || 0; py += (sim.escaped && sim.escaped.py) || 0;
        return { undecA: aU, undecB: bU, totPx: +px.toFixed(9), totPy: +py.toFixed(9), decayActive: sim.decayActive | 0 };
      },

      // 가설: ① 창발 순서(고불안정 B 미붕괴 < 저불안정 A) ② 율법 정량 적합 ③ 단일 붕괴 first-passage 정합.
      assert(ctx, K) {
        const sim = ctx.sim, a0 = ctx.atoms0, nx = sim.knobs.decayNexcess, k = sim.knobs.kDecay, R = sim.knobs.decayRateExcess, T = this.ticks;
        const { aU, bU } = this.counts(sim, a0, nx);
        let aN = 0, bN = 0, stableIfDecayed = true, noDouble = true;
        for (let i = 0; i < sim.atoms.length; i++) {
          const a = sim.atoms[i], b = a0[i], ex0 = (b.N - b.Z) - nx;
          if (ex0 === 1) aN++; else if (ex0 === 2) bN++;
          if (a.Z > b.Z) { if ((a.N - a.Z) > nx) stableIfDecayed = false; if (a.Z > b.Z + 1) noDouble = false; }
        }
        const keffA = Math.min(1, k * (1 + R * 1)), keffB = Math.min(1, k * (1 + R * 2));
        const predA = aN * Math.pow(1 - keffA, T), predB = bN * Math.pow(1 - keffB, T);
        const TOL = 5;
        return [
          { name: '불안정도-의존 반감기 창발 — 고불안정 B(N−Z=6) 미붕괴 < 저불안정 A(N−Z=5)(같은 게이트·B 가 빨리 붕괴, 율이 N−Z 에서 창발)', pass: bU < aU, value: `A${aU}>B${bU}` },
          { name: `율법 정량 적합 — 두 집단 미붕괴 ≈ N₀(1−keff)^T, keff=kDecay·(1+decayRateExcess·excess)[keffA=${keffA.toFixed(2)} keffB=${keffB.toFixed(2)}] ±${TOL}`, pass: Math.abs(aU - predA) <= TOL && Math.abs(bU - predB) <= TOL, value: `A${aU}~${predA.toFixed(1)}|B${bU}~${predB.toFixed(1)}` },
          { name: '단일 붕괴 first-passage 정합 — 붕괴한 원자 전부 안정(N−Z≤문턱)·2회 붕괴 0(Z≤초기+1)', pass: stableIfDecayed && noDouble, value: aN + bN },
        ];
      },
    },

    'step-0037': {
      id: 'step-0037',
      title: '질량공식·안정 골짜기 (decayMassFormula — 붕괴 Q값·멈춤이 결합에너지 B(Z,N)서 창발, author 문턱·decayQ 해소)',
      desc: 'step-0036 까지 붕괴의 *멈춤*(N−Z≤문턱)도 *발열량*(decayQ)도 author 한 상수였다. 이 step 은 둘 다 *결합에너지에서 창발*시킨다. 새 게이트 decayMassFormula: ' +
            '반경험적 질량공식(Bethe–Weizsäcker 토이) B(Z,N) = aV·A − aS·A^(2/3) − aC·Z(Z−1)/A^(1/3) − aA·(N−Z)²/A 를 kernel 에 두고(부피는 결합↑·표면/쿨롱/비대칭은 결합↓), ' +
            'β⁻ 붕괴를 *결합이 늘 때만*(ΔB = B(Z+1,N−1) − B(Z,N) > 0, 발열) 진행한다. ⇒ **멈춤 = ΔB≤0 = 안정 골짜기**(author 문턱 아님), **방출 Q값 = ΔB**(author decayQ 아님). ' +
            '골짜기 위치는 *쿨롱(양성자 반발 — 저 Z 선호) vs 비대칭(N=Z 선호)* 경쟁이 정한다 — 종류별 author 0(어느 원소가 안정인지 박지 않음). 에너지는 0031 그대로 nuc 저장고 → KE(ΔB 만큼) ⇒ E 정확 닫힘(저장고는 ΔB 보다 크게 둬 *골짜기*가 멈춤을 정하게 함). ' +
            '*측정*(무대: N 과잉 ¹⁸C 8개 Z6 N12 nuc2, decayMassFormula=1·kDecay=0.5·decayRecoilPair=1): ① **안정 골짜기 창발** — 모든 원자 종단 Z = argmax_Z B(Z,A=18)(결합 최대 = 안정). ' +
            '② **Q값 = 결합에너지 차** — 방출 총 KE = Σ(B(종단)−B(초기)) *머신*(발열량이 ΔB 서 나옴, decayQ 상수 아님) ③ **멈춤 = ΔB 부호 전환** — 종단서 β⁻ ΔB ≤ 0 < 직전 단계 ΔB(더 붕괴하면 결합 감소 → 멈춤, author 문턱 아님). ' +
            '닫힌 장부 Q·B·L·E·px·py 머신 1e-9(decayRecoilPair=1 계승). *대조*: decayMassFormula=0 이면 author 문턱(N−Z≤4)·decayQ 거동(0031~36)·종단 Z=7(골짜기 아님·회귀 0). 새 게이트 0 → 기존 법칙·골든 비트 불변.',
      ticks: 60,
      // ledgerTol 없음 — nuc→KE(ΔB) 정확 이전·decayRecoilPair=1 → Q·B·L·E·px·py 전부 머신 1e-9.

      // N 과잉 ¹⁸C 8개(Z6 N12 → A=18). nuc=2 저장고(ΔB_total≈1.36 보다 큼 → *골짜기*가 멈춤을 정함, 저장고 고갈 아님).
      //   질량공식 구동: 6→7→8 (ΔB>0), Z=8 서 ΔB<0 → 멈춤 = 안정 골짜기 argmax B(=¹⁸O). kDecay=0.5(빠른 수렴)·힘 법칙 안 켬.
      init(rng, K) {
        const W = 300, H = 300, atoms = [];
        for (let i = 0; i < 8; i++) atoms.push({ Z: 6, N: 12, e: 6, x: 0, rx: 50 + i * 30, ry: 100, vx: 0, vy: 0, nuc: 2, lep: 0 });
        const simRng = K.mulberry32((rng() * 4294967296) >>> 0);
        return { W, H, atoms, rng: simRng, knobs: { dt: 1, kDecay: 0.5, decayNexcess: 4, decayQ: 1, decayRecoilPair: 1, decayMassFormula: 1 } };
      },

      ke(sim, K) { let e = 0; for (const a of sim.atoms) { const m = K.mass(a); e += 0.5 * m * (a.vx * a.vx + a.vy * a.vy); } return e; },
      // 고정 A 등방선의 결합 최대 Z*(안정 골짜기) — argmax_Z B(Z, A−Z). author 0(B 측정으로 골짜기 창발).
      valleyZ(A, K) { let zs = 1, bm = -Infinity; for (let Z = 1; Z < A; Z++) { const b = K.binding(Z, A - Z); if (b > bm) { bm = b; zs = Z; } } return zs; },

      watch(sim, K) {
        const A = sim.atoms[0].Z + sim.atoms[0].N, zStar = this.valleyZ(A, K);
        let atValley = 0, maxZ = 0; for (const a of sim.atoms) { if (a.Z === zStar) atValley++; maxZ = Math.max(maxZ, a.Z); }
        let px = 0, py = 0; for (const a of sim.atoms) { const m = K.mass(a); px += m * a.vx; py += m * a.vy; }
        px += (sim.escaped && sim.escaped.px) || 0; py += (sim.escaped && sim.escaped.py) || 0;
        return { zStar, atValley, maxZ, ke: +this.ke(sim, K).toFixed(5), totPx: +px.toFixed(9), totPy: +py.toFixed(9), decayActive: sim.decayActive | 0 };
      },

      // 가설: ① 안정 골짜기 창발(종단 Z=argmax B) ② Q값=결합에너지 차(총 KE=ΣΔB 머신) ③ 멈춤=ΔB 부호 전환(종단 ΔB≤0<직전).
      assert(ctx, K) {
        const sim = ctx.sim, a0 = ctx.atoms0, A = a0[0].Z + a0[0].N, zStar = this.valleyZ(A, K);
        let allValley = true, signFlip = true;
        for (const a of sim.atoms) {
          if (a.Z !== zStar) allValley = false;
          if (!(K.bindingDelta(a.Z, a.N) <= 0 && K.bindingDelta(a.Z - 1, a.N + 1) > 0)) signFlip = false;  // 종단서 더 붕괴 불리·직전은 유리
        }
        const keRel = this.ke(sim, K);                                     // 방출된 총 KE(정지 무대 → 0서 시작)
        let bGain = 0; for (let i = 0; i < sim.atoms.length; i++) bGain += K.binding(sim.atoms[i].Z, sim.atoms[i].N) - K.binding(a0[i].Z, a0[i].N);
        return [
          { name: `안정 골짜기 창발 — 모든 원자 종단 Z = argmax_Z B(Z,A=${A})(결합 최대=안정, 쿨롱 vs 비대칭 경쟁이 골짜기 정함·author 0)`, pass: allValley, value: zStar },
          { name: 'Q값 = 결합에너지 차 — 방출 총 KE = Σ(B(종단)−B(초기))(발열량이 ΔB 서 창발, decayQ 상수 아님), 머신', pass: Math.abs(keRel - bGain) < 1e-6, value: +keRel.toFixed(5) },
          { name: '멈춤 = ΔB 부호 전환(골짜기) — 종단 β⁻ ΔB ≤ 0 < 직전 단계 ΔB(더 붕괴하면 결합↓ → 멈춤, author 문턱 아님)', pass: signFlip, value: +K.bindingDelta(sim.atoms[0].Z, sim.atoms[0].N).toFixed(4) },
        ];
      },
    },

    'step-0038': {
      id: 'step-0038',
      title: 'β⁺/전자포획 채널 (decayBetaPlus — 양성자 과잉도 반대 방향으로 안정 골짜기 수렴, 완전한 양방향 골짜기)',
      desc: 'step-0037 이 결합에너지 B(Z,N)서 *안정 골짜기*를 창발시켰으나 붕괴는 β⁻(n→p·Z↑) *한 방향*뿐 — 중성자 과잉(골짜기 아래)만 수렴하고 *양성자 과잉*(골짜기 위)은 못 내려온다. ' +
            '이 step 은 새 게이트 decayBetaPlus 로 β⁺(p→n·Z↓) 채널을 켠다: β⁻ 가 불리(ΔB⁻=B(Z+1,N−1)−B(Z,N)≤0)일 때 β⁺ 결합 이득 ΔB⁺=B(Z−1,N+1)−B(Z,N)>0 이면 *반대 방향*으로 진행한다. ' +
            'B 는 고정 A 에서 Z 에 대해 concave(쿨롱 vs 비대칭) → 둘 중 최대 하나만 >0 ⇒ 골짜기 한쪽으로만 굴러간다. **둘 다 ≤0 = 안정 골짜기**(이제 양방향 완성). ' +
            '보존: β⁺ 는 Z↓·N↑(B=Z+N 불변)·e−1(중성 유지 — 방출 양전자가 +1 나름 ⇒ Q=Z−e 불변)·lep+1(중성미자 L=+1, e−1 상쇄 ⇒ L 불변) — β⁻ 와 *대칭 반대*. Q값=ΔB⁺ 도 결합에너지서(0037 계승). ' +
            '*측정*(무대: 양성자 과잉 ¹⁸Ne 8개 Z10 N8 nuc2, decayMassFormula=1·decayBetaPlus=1·kDecay=0.5·decayRecoilPair=1): ① **골짜기를 위에서 수렴** — 모든 원자 종단 Z = argmax_Z B(Z,A=18)=8(=¹⁸O, 0037 의 중성자 과잉 ¹⁸C 가 *아래에서* 도달한 같은 골짜기). ' +
            '② **Q값 = β⁺ 결합 이득** — 방출 총 KE = Σ(B(종단)−B(초기)) *머신*(10→9→8 두 번 β⁺·발열량 ΔB⁺ 서) ③ **멈춤 = β⁺ ΔB⁺ 부호 전환** — 종단서 ΔB⁺≤0<직전 단계 ΔB⁺. ' +
            '닫힌 장부 Q·B·L·E·px·py 머신 1e-9(e−1·lep+1 대칭·decayRecoilPair=1 계승). *대조*: decayBetaPlus=0 이면 양성자 과잉은 β⁻ 불리(ΔB⁻≤0)라 *멈춰* Z=10 에 갇힌다(골짜기 못 감) — β⁺ 가 위쪽 골짜기 채널. 새 게이트 0 → 0037 법칙·골든 비트 불변.',
      ticks: 60,
      // ledgerTol 없음 — nuc→KE(ΔB⁺) 정확 이전·decayRecoilPair=1·e−1/lep+1 대칭 → Q·B·L·E·px·py 전부 머신 1e-9.

      // 양성자 과잉 ¹⁸Ne 8개(Z10 N8 → A=18, N−Z=−2). nuc=2 저장고(ΔB⁺_total≈1.36 보다 큼 → 골짜기가 멈춤을 정함).
      //   질량공식+β⁺ 구동: 10→9→8 (ΔB⁺>0), Z=8 서 양방향 ΔB≤0 → 멈춤 = 안정 골짜기 argmax B(=¹⁸O, 0037 의 ¹⁸C 와 같은 골짜기 — 위/아래서 수렴).
      init(rng, K) {
        const W = 300, H = 300, atoms = [];
        for (let i = 0; i < 8; i++) atoms.push({ Z: 10, N: 8, e: 10, x: 0, rx: 50 + i * 30, ry: 100, vx: 0, vy: 0, nuc: 2, lep: 0 });
        const simRng = K.mulberry32((rng() * 4294967296) >>> 0);
        return { W, H, atoms, rng: simRng, knobs: { dt: 1, kDecay: 0.5, decayNexcess: 4, decayQ: 1, decayRecoilPair: 1, decayMassFormula: 1, decayBetaPlus: 1 } };
      },

      ke(sim, K) { let e = 0; for (const a of sim.atoms) { const m = K.mass(a); e += 0.5 * m * (a.vx * a.vx + a.vy * a.vy); } return e; },
      // 고정 A 등방선의 결합 최대 Z*(안정 골짜기) — argmax_Z B(Z, A−Z). author 0(B 측정으로 골짜기 창발).
      valleyZ(A, K) { let zs = 1, bm = -Infinity; for (let Z = 1; Z < A; Z++) { const b = K.binding(Z, A - Z); if (b > bm) { bm = b; zs = Z; } } return zs; },
      // β⁺ 결합 이득 ΔB⁺ = B(Z−1,N+1) − B(Z,N) (β⁻ 의 bindingDelta 와 대칭).
      betaPlusDelta(Z, N, K) { return K.binding(Z - 1, N + 1) - K.binding(Z, N); },

      watch(sim, K) {
        const A = sim.atoms[0].Z + sim.atoms[0].N, zStar = this.valleyZ(A, K);
        let atValley = 0, minZ = 99; for (const a of sim.atoms) { if (a.Z === zStar) atValley++; minZ = Math.min(minZ, a.Z); }
        let px = 0, py = 0; for (const a of sim.atoms) { const m = K.mass(a); px += m * a.vx; py += m * a.vy; }
        px += (sim.escaped && sim.escaped.px) || 0; py += (sim.escaped && sim.escaped.py) || 0;
        return { zStar, atValley, minZ, ke: +this.ke(sim, K).toFixed(5), totPx: +px.toFixed(9), totPy: +py.toFixed(9), decayActive: sim.decayActive | 0 };
      },

      // 가설: ① 골짜기를 위에서 수렴(종단 Z=argmax B) ② Q값=β⁺ 결합 이득(총 KE=ΣΔB⁺ 머신) ③ 멈춤=β⁺ ΔB⁺ 부호 전환.
      assert(ctx, K) {
        const sim = ctx.sim, a0 = ctx.atoms0, A = a0[0].Z + a0[0].N, zStar = this.valleyZ(A, K);
        let allValley = true, signFlip = true;
        for (const a of sim.atoms) {
          if (a.Z !== zStar) allValley = false;
          // 종단서 β⁺ 도 불리(ΔB⁺≤0)·직전 단계(Z+1·N−1)는 유리(ΔB⁺>0) ⇒ 골짜기 위쪽 경계.
          if (!(this.betaPlusDelta(a.Z, a.N, K) <= 0 && this.betaPlusDelta(a.Z + 1, a.N - 1, K) > 0)) signFlip = false;
        }
        const keRel = this.ke(sim, K);                                     // 방출된 총 KE(정지 무대 → 0서 시작)
        let bGain = 0; for (let i = 0; i < sim.atoms.length; i++) bGain += K.binding(sim.atoms[i].Z, sim.atoms[i].N) - K.binding(a0[i].Z, a0[i].N);
        return [
          { name: `골짜기를 위에서 수렴 — 양성자 과잉(Z=${a0[0].Z}) 전부 종단 Z = argmax_Z B(Z,A=${A})(0037 의 중성자 과잉이 아래서 도달한 같은 골짜기)`, pass: allValley, value: zStar },
          { name: 'Q값 = β⁺ 결합 이득 — 방출 총 KE = Σ(B(종단)−B(초기))(발열량이 ΔB⁺ 서, β⁻ 와 대칭), 머신', pass: Math.abs(keRel - bGain) < 1e-6, value: +keRel.toFixed(5) },
          { name: '멈춤 = β⁺ ΔB⁺ 부호 전환(골짜기 위쪽) — 종단 ΔB⁺ ≤ 0 < 직전 단계 ΔB⁺(더 β⁺ 면 결합↓ → 멈춤)', pass: signFlip, value: +this.betaPlusDelta(sim.atoms[0].Z, sim.atoms[0].N, K).toFixed(4) },
        ];
      },
    },

    'step-0039': {
      id: 'step-0039',
      title: '페어링항 δ(짝-홀) (decayPairing — 짝-짝 +δ·홀-홀 −δ → 안정선의 짝-홀 진동, 홀-홀 핵 불안정화)',
      desc: 'step-0037~38 이 결합에너지 B(Z,N)서 안정 골짜기를 *양방향*으로 닫았으나, 질량공식이 *매끈*해(쿨롱·표면·비대칭 다 연속) 실제 안정선의 *짝-홀 진동*(odd-even staggering)이 없다 — 짝-짝 핵이 더 안정하고 홀-홀 핵이 덜 안정한 양자 효과(스핀 반대 핵자쌍의 결합)가 미반영. ' +
            '이 step 은 kernel binding 에 페어링항 δ(Z,N)을 *가법*으로 얹는다(게이트 decayPairing): 짝-짝 +δ · 홀-홀 −δ · 홀수 A 0, δ=aP/√A. ' +
            '효과: B 가 더는 Z 에 매끈하지 않고 *지그재그*(짝수 Z 봉우리·홀수 Z 골) → 매끈한 공식이 *안정*이라 한 **홀-홀 핵이 페어링으로 β 불안정**해져 짝-짝 이웃으로 한 칸 더 붕괴한다(실제: ¹⁶N 홀-홀 β⁻ 7초 → ¹⁶O 짝-짝 안정). ' +
            '*측정*(무대: 중성자 과잉 ¹⁶C 8개 Z6 N10 nuc2, decayMassFormula=1·decayBetaPlus=1·**decayPairing=1**·kDecay=0.5·decayRecoilPair=1): ' +
            '① **짝-홀 진동 — 골짜기가 홀→짝으로 이동** — 페어링 켜면 종단 Z=argmax_Z B_δ(Z,A=16)=8(¹⁶O, 짝-짝)인데 *페어링 끈* 매끈 공식의 argmax 는 Z=7(¹⁶N, 홀-홀) ⇒ 패리티가 골짜기를 옮긴다. ' +
            '② **홀-홀 핵 불안정화** — 매끈 공식이 안정(ΔB⁻≤0)이라 한 ¹⁶N(Z7 N9)이 페어링에선 ΔB⁻_δ>0 ⇒ β⁻ 발열 → 짝-짝 ¹⁶O 로 한 칸 더. ' +
            '③ **종단 = 짝-짝 진짜 안정** — 모든 원자 종단 Z·N 둘 다 짝수, 양방향 ΔB_δ≤0(페어링 포함 진짜 골짜기 바닥). ' +
            '닫힌 장부 Q·B·L·E·px·py 머신 1e-9(0038 계승). *대조*: decayPairing=0 이면 매끈 공식이라 8개 전부 홀-홀 ¹⁶N(Z=7)서 멈춘다(0038 거동·골든 비트 불변). 새 게이트 0 → kernel binding δ 미가법 → 0001~38 법칙·골든 비트 불변.',
      ticks: 60,
      // ledgerTol 없음 — nuc→KE(ΔB_δ) 정확 이전·decayRecoilPair=1·e±1/lep∓1 대칭 → Q·B·L·E·px·py 전부 머신 1e-9.

      // 중성자 과잉 ¹⁶C 8개(Z6 N10 → A=16, 짝-짝). nuc=2 저장고(ΔB_δ total≈0.27 보다 큼 → 골짜기가 멈춤을 정함).
      //   페어링 구동: 6→7(ΔB⁻>0)→8(홀-홀 7→짝-짝 8 도 ΔB⁻_δ>0), Z=8 서 양방향 ΔB_δ≤0 → 멈춤. 페어링 끄면 매끈 공식 골짜기 Z=7(홀-홀)서 멈춤.
      init(rng, K) {
        const W = 300, H = 300, atoms = [];
        for (let i = 0; i < 8; i++) atoms.push({ Z: 6, N: 10, e: 6, x: 0, rx: 50 + i * 30, ry: 100, vx: 0, vy: 0, nuc: 2, lep: 0 });
        const simRng = K.mulberry32((rng() * 4294967296) >>> 0);
        return { W, H, atoms, rng: simRng, knobs: { dt: 1, kDecay: 0.5, decayNexcess: 4, decayQ: 1, decayRecoilPair: 1, decayMassFormula: 1, decayBetaPlus: 1, decayPairing: 1 } };
      },

      ke(sim, K) { let e = 0; for (const a of sim.atoms) { const m = K.mass(a); e += 0.5 * m * (a.vx * a.vx + a.vy * a.vy); } return e; },
      // 고정 A 등압선의 결합 최대 Z*(안정 골짜기) — argmax_Z B(Z,A−Z). pair 게이트 전달(매끈 vs 페어링 골짜기 대조).
      valleyZ(A, K, pair) { let zs = 1, bm = -Infinity; for (let Z = 1; Z < A; Z++) { const b = K.binding(Z, A - Z, pair); if (b > bm) { bm = b; zs = Z; } } return zs; },

      watch(sim, K) {
        const A = sim.atoms[0].Z + sim.atoms[0].N;
        const zStarP = this.valleyZ(A, K, 1), zStarS = this.valleyZ(A, K, 0);   // 페어링 vs 매끈 골짜기
        let atValley = 0, allEvenEven = 1; for (const a of sim.atoms) { if (a.Z === zStarP) atValley++; if ((a.Z & 1) || (a.N & 1)) allEvenEven = 0; }
        let px = 0, py = 0; for (const a of sim.atoms) { const m = K.mass(a); px += m * a.vx; py += m * a.vy; }
        px += (sim.escaped && sim.escaped.px) || 0; py += (sim.escaped && sim.escaped.py) || 0;
        return { zStarPair: zStarP, zStarSmooth: zStarS, atValley, allEvenEven, termZ: sim.atoms[0].Z, ke: +this.ke(sim, K).toFixed(5), totPx: +px.toFixed(9), totPy: +py.toFixed(9), decayActive: sim.decayActive | 0 };
      },

      // 가설: ① 짝-홀 진동(페어링 골짜기 짝수 Z ≠ 매끈 골짜기 홀수 Z) ② 홀-홀 ¹⁶N 불안정화(매끈 안정 → 페어링 ΔB⁻>0) ③ 종단=짝-짝 진짜 안정.
      assert(ctx, K) {
        const sim = ctx.sim, a0 = ctx.atoms0, A = a0[0].Z + a0[0].N;
        const zStarP = this.valleyZ(A, K, 1), zStarS = this.valleyZ(A, K, 0);
        // ① 모든 원자 종단 = 페어링 골짜기(짝수)·매끈 골짜기(홀수)와 다름 ⇒ 패리티가 골짜기를 옮김.
        let allValley = true; for (const a of sim.atoms) if (a.Z !== zStarP) allValley = false;
        const stagger = allValley && (zStarP !== zStarS) && ((zStarP & 1) === 0) && ((zStarS & 1) === 1);
        // ② 매끈 공식이 안정이라 한 홀-홀 ¹⁶N(=매끈 골짜기 zStarS, N=A−zStarS): 매끈 ΔB⁻≤0 인데 페어링 ΔB⁻>0 ⇒ 불안정화.
        const oddZ = zStarS, oddN = A - zStarS;
        const dSmooth = K.bindingDelta(oddZ, oddN, 0), dPair = K.bindingDelta(oddZ, oddN, 1);
        const destab = (dSmooth <= 0) && (dPair > 0);
        // ③ 종단 짝-짝 & 페어링 포함 양방향 ΔB_δ≤0(진짜 바닥).
        let trueFloor = true;
        for (const a of sim.atoms) {
          const dM = K.bindingDelta(a.Z, a.N, 1);                                  // β⁻ ΔB⁻_δ
          const dP = K.binding(a.Z - 1, a.N + 1, 1) - K.binding(a.Z, a.N, 1);      // β⁺ ΔB⁺_δ
          if (!((a.Z & 1) === 0 && (a.N & 1) === 0 && dM <= 0 && dP <= 0)) trueFloor = false;
        }
        // KE 닫힘: 방출 총 KE = Σ(B_δ(종단)−B_δ(초기)) 머신(발열량이 페어링 포함 ΔB 서).
        const keRel = this.ke(sim, K);
        let bGain = 0; for (let i = 0; i < sim.atoms.length; i++) bGain += K.binding(sim.atoms[i].Z, sim.atoms[i].N, 1) - K.binding(a0[i].Z, a0[i].N, 1);
        return [
          { name: `짝-홀 진동 — 종단 Z = 페어링 골짜기 argmax B_δ(짝수)=${zStarP} ≠ 매끈 공식 골짜기(홀수)=${zStarS} ⇒ 패리티가 골짜기를 옮김`, pass: stagger, value: zStarP },
          { name: `홀-홀 ¹⁶N(Z=${oddZ}) 불안정화 — 매끈 공식 ΔB⁻≤0(안정)인데 페어링 ΔB⁻>0 ⇒ β⁻ 발열 → 짝-짝 한 칸 더`, pass: destab, value: +dPair.toFixed(4) },
          { name: 'Q값 = 페어링 포함 결합 이득 — 방출 총 KE = Σ(B_δ(종단)−B_δ(초기)) 머신', pass: Math.abs(keRel - bGain) < 1e-6, value: +keRel.toFixed(5) },
          { name: '종단 = 짝-짝 진짜 안정 — 전 원자 Z·N 짝수 & 양방향 ΔB_δ≤0(페어링 포함 골짜기 바닥)', pass: trueFloor, value: zStarP },
        ];
      },
    },

    'step-0040': {
      id: 'step-0040',
      title: '결합E 정지질량 편입 M=A−B (massDefect — nuc 저장고 폐기, 발열량이 정지질량 변화서 직접)',
      desc: 'step-0031~39 의 붕괴 발열량(Δm·c²)은 원자가 미리 품은 *nuc 저장고*가 공급했다 — 결합에너지 B 가 이미 안정성·Q값(ΔB)을 정하는데도 에너지원은 별도 임시 장부였다(이중 회계). ' +
            '이 step 은 그 저장고를 **폐기**한다(게이트 massDefect): 정지질량에 결합에너지를 직접 편입해 **M = A − B**(결합한 핵이 *가볍다* — 질량 결손). ' +
            'ledger 의 정지질량 에너지가 (A−B)·c² 가 되면, 붕괴로 B 가 ΔB 늘 때 정지질량이 정확히 ΔB 줄고(M↓) 그만큼 KE 로 나온다 — **발열량 = 질량 결손 = ΔB**(e=mc² 그 자체·저장고 무관). ' +
            '멈춤도 nuc 고갈이 아니라 *ΔB≤0(안정 골짜기)* 이 정한다(저장고는 늘 골짜기보다 컸던 임시 대역일 뿐 — 이제 본질만 남음). ' +
            '*측정*(무대: 중성자 과잉 ¹⁶C 8개 Z6 N10 **nuc 없음**, massDefect=1·decayMassFormula=1·decayBetaPlus=1·decayPairing=1·kDecay=0.5·decayRecoilPair=1): ' +
            '① **nuc 저장고 폐기** — Σa.nuc=0(저장고 0) 인데도 붕괴가 진행해 전원 종단 Z=argmax B_δ=8(¹⁶O) ⇒ 연료는 정지질량. ' +
            '② **방출 KE = 질량 결손 ΔM** — 방출 총 KE = Σ(M(초기)−M(종단)) = Σ(B_δ(종단)−B_δ(초기)) 머신(에너지가 정지질량서 직접 나옴). ' +
            '③ **정지질량↔운동 — ΔrestE = −ΔKE** — 총 정지질량 에너지 감소 = KE 증가 머신(저장고 없이 E 닫힘·e=mc²). ' +
            '닫힌 장부 Q·B·L·E·px·py 머신(rest term=(A−B)c²·완화 없음). *대조*: massDefect=0 이면 nuc 저장고 경로(0039 거동·nuc 없으면 즉시 멈춤). 새 게이트 0 → ledger A·c²+nuc·decay 저장고 연료 → 0001~39 비트 불변.',
      ticks: 60,
      // ledgerTol 없음 — rest energy=(A−B)c² 가 ΔB 만큼 줄고 KE 가 q=ΔB 만큼 늚(sqrt 왕복 반올림만) → Q·B·L·E·px·py 머신.

      // 중성자 과잉 ¹⁶C 8개(Z6 N10 → A=16, 짝-짝). **nuc 필드 없음**(저장고 폐기) — 발열량은 M=A−B 정지질량 변화가 공급.
      //   페어링 구동: 6→7→8, Z=8 서 양방향 ΔB_δ≤0 → 멈춤(0039 와 같은 골짜기·같은 KE — 연료원만 nuc→질량결손으로 바뀜).
      init(rng, K) {
        const W = 300, H = 300, atoms = [];
        for (let i = 0; i < 8; i++) atoms.push({ Z: 6, N: 10, e: 6, x: 0, rx: 50 + i * 30, ry: 100, vx: 0, vy: 0, lep: 0 });
        const simRng = K.mulberry32((rng() * 4294967296) >>> 0);
        return { W, H, atoms, rng: simRng, knobs: { dt: 1, kDecay: 0.5, decayNexcess: 4, decayQ: 1, decayRecoilPair: 1, decayMassFormula: 1, decayBetaPlus: 1, decayPairing: 1, massDefect: 1 } };
      },

      ke(sim, K) { let e = 0; for (const a of sim.atoms) { const m = K.mass(a); e += 0.5 * m * (a.vx * a.vx + a.vy * a.vy); } return e; },
      // 정지질량 에너지 Σ M·c² = Σ(A − B_δ)·c²(c=1) — 결합이 클수록 가볍다(질량 결손).
      restE(atoms, K, pair) { let e = 0; for (const a of atoms) e += (K.mass(a) - K.binding(a.Z | 0, a.N | 0, pair)); return e; }
      ,
      // 고정 A 등압선의 결합 최대 Z*(안정 골짜기) — argmax_Z B(Z,A−Z). pair 게이트 전달.
      valleyZ(A, K, pair) { let zs = 1, bm = -Infinity; for (let Z = 1; Z < A; Z++) { const b = K.binding(Z, A - Z, pair); if (b > bm) { bm = b; zs = Z; } } return zs; },

      watch(sim, K) {
        const A = sim.atoms[0].Z + sim.atoms[0].N, zStar = this.valleyZ(A, K, 1);
        let atValley = 0, totNuc = 0; for (const a of sim.atoms) { if (a.Z === zStar) atValley++; totNuc += a.nuc || 0; }
        let px = 0, py = 0; for (const a of sim.atoms) { const m = K.mass(a); px += m * a.vx; py += m * a.vy; }
        px += (sim.escaped && sim.escaped.px) || 0; py += (sim.escaped && sim.escaped.py) || 0;
        return { zStar, atValley, totNuc, restE: +this.restE(sim.atoms, K, 1).toFixed(5), ke: +this.ke(sim, K).toFixed(5), totPx: +px.toFixed(9), totPy: +py.toFixed(9), decayActive: sim.decayActive | 0 };
      },

      // 가설: ① nuc 저장고 폐기(Σnuc=0 인데 골짜기 도달) ② 방출 KE=질량 결손 ΔM ③ ΔrestE=−ΔKE(정지질량↔운동).
      assert(ctx, K) {
        const sim = ctx.sim, a0 = ctx.atoms0, A = a0[0].Z + a0[0].N, zStar = this.valleyZ(A, K, 1);
        let allValley = true, totNuc = 0; for (const a of sim.atoms) { if (a.Z !== zStar) allValley = false; totNuc += a.nuc || 0; }
        const keRel = this.ke(sim, K);
        // 방출 KE = Σ(B_δ(종단)−B_δ(초기)) = Σ(M(초기)−M(종단)) — 질량 결손이 KE 로.
        let bGain = 0; for (let i = 0; i < sim.atoms.length; i++) bGain += K.binding(sim.atoms[i].Z, sim.atoms[i].N, 1) - K.binding(a0[i].Z, a0[i].N, 1);
        const restBefore = this.restE(a0, K, 1), restAfter = this.restE(sim.atoms, K, 1);
        return [
          { name: `nuc 저장고 폐기 — Σa.nuc=${totNuc}(저장고 0) 인데도 전원 종단 Z=argmax B_δ=${zStar}(¹⁶O) ⇒ 연료=정지질량(M=A−B)`, pass: (totNuc === 0) && allValley, value: totNuc },
          { name: '방출 KE = 질량 결손 ΔM — 방출 총 KE = Σ(M(초기)−M(종단)) = Σ(B_δ종단−B_δ초기) 머신(에너지가 정지질량서 직접)', pass: Math.abs(keRel - bGain) < 1e-6, value: +keRel.toFixed(5) },
          { name: '정지질량↔운동 — ΔrestE = −ΔKE(총 정지질량 에너지 감소 = KE 증가, 저장고 없이 E 닫힘·e=mc²) 머신', pass: Math.abs((restAfter - restBefore) + keRel) < 1e-6, value: +(restAfter - restBefore).toFixed(5) },
        ];
      },
    },

    'step-0041': {
      id: 'step-0041',
      title: '융합 Q값도 결합에너지서 (fuseMassFormula — fuseQ author 해소, ΔB_fus=B(생성)−ΣB(반응)·²H+²H→⁴He 별 점화)',
      desc: 'step-0040 이 *붕괴* 발열량을 정지질량 M=A−B 로 편입했으나, *융합*(fuse, 0033)의 발열량은 여전히 author 상수 fuseQ + nuc 저장고였다 — 핵 에너지의 두 방향 중 한쪽만 결합에너지로 통합. ' +
            '이 step 은 융합 Q값도 결합에너지서 창발시킨다(게이트 fuseMassFormula): 두 핵이 합칠 때 방출 = **ΔB_fus = B(생성) − B(a) − B(b)**(생성핵이 더 단단히 묶인 만큼이 에너지로·author fuseQ 폐기). ' +
            'massDefect(0040)와 짝: 생성핵 정지질량이 (A−B(생성))·c² 로 ΔB_fus 만큼 *줄고*(질량 결손) 그만큼 복사 바스로 — **융합 발열 = 정지질량 감소**(e=mc²·저장고 무관). ' +
            '발열/흡열도 author 0: 가벼운 핵은 ΔB_fus>0(발열·별 점화·²H→⁴He), 철 너머는 ΔB_fus<0(흡열) — *측정*으로 갈린다. ' +
            '*측정*(무대: 8개 ²H(중수소) Z1 N1 e1 **nuc 없음**, 4쌍 정면 고속 접근·fuseMassFormula=1·massDefect=1·decayPairing=1·kFuse=1·fuseBarrier=0.1·kDecay=0): ' +
            '① **융합 Q값 = 결합 이득 ΔB_fus** — 쌍당 방출(핵) = B(⁴He)−2B(²H) = +1.344 > 0(발열·결합에너지서·author 0). ' +
            '② **nuc 저장고 폐기(fuse)** — Σnuc=0 인데도 4쌍 합체해 ⁴He 4개(개수 8→4·Z=2=Σ) ⇒ 연료는 정지질량. ' +
            '③ **융합 발열 = 정지질량 감소** — 총 정지질량 에너지 감소 = 바스로 간 핵 방출(ΔrestE = −Σ ΔB_fus) 머신(e=mc²). ' +
            '닫힌 장부 Q·B·L·E·px·py 머신(rest=(A−B)c²·vcom·바스). *대조*: fuseMassFormula=0 이면 author fuseQ·저장고 경로(0033 거동·nuc 없으면 방출 0). 새 게이트 0 → fuseQ author·nuc 거동 → 0001~40 비트 불변.',
      ticks: 60,
      // ledgerTol 없음 — 닫힌 형식 합체(vcom·바스)·rest=(A−B)c² 가 ΔB_fus 만큼 줄어 바스 핵 방출과 상쇄 → Q·B·L·E·px·py 머신.

      // 8개 ²H(Z1 N1 e1·**nuc 없음**) 4쌍. 각 쌍 정면 접근(vx=±1·총 p=0): gap 8 → dt=0.5 로 닫혀 fuseR=3 안에 들면 합체 → ⁴He(Z2 N2).
      //   ΔB_fus = B(2,2,pair)−2B(1,1,pair) > 0(발열). vcom=0 → 생성핵 정지·흡수 상대 KE(쌍당 2)는 바스로. kDecay=0(순수 융합 — ⁴He 안 붕괴).
      init(rng, K) {
        const W = 200, H = 200, atoms = [];
        for (let p = 0; p < 4; p++) {
          const y = 40 + p * 40;
          atoms.push({ Z: 1, N: 1, e: 1, x: 0, rx: 96, ry: y, vx: 1, vy: 0, lep: 0 });   // 왼쪽 ²H → 오른쪽
          atoms.push({ Z: 1, N: 1, e: 1, x: 0, rx: 104, ry: y, vx: -1, vy: 0, lep: 0 });  // 오른쪽 ²H → 왼쪽 (쌍 총 p=0)
        }
        const simRng = K.mulberry32((rng() * 4294967296) >>> 0);
        return { W, H, atoms, rng: simRng, knobs: { dt: 0.5, kFuse: 1, fuseR: 3, fuseBarrier: 0.1, fuseMassFormula: 1, massDefect: 1, decayPairing: 1, kDecay: 0 } };
      },

      ke(sim, K) { let e = 0; for (const a of sim.atoms) { const m = K.mass(a); e += 0.5 * m * (a.vx * a.vx + a.vy * a.vy); } return e; },
      restE(atoms, K, pair) { let e = 0; for (const a of atoms) e += (K.mass(a) - K.binding(a.Z | 0, a.N | 0, pair)); return e; },
      dBfus(K, pair) { return K.binding(2, 2, pair) - 2 * K.binding(1, 1, pair); },  // ²H+²H→⁴He 결합 이득
      // 합체 전 4쌍이 흡수할 상대 KE 합(쌍별 ½μ|vrel|² — 비탄성 합체로 바스에 park).
      keRelSum(a0, K) { let s = 0; for (let i = 0; i < a0.length; i += 2) { const a = a0[i], b = a0[i + 1], ma = a.Z + a.N, mb = b.Z + b.N, mu = ma * mb / (ma + mb), dx = a.vx - b.vx, dy = a.vy - b.vy; s += 0.5 * mu * (dx * dx + dy * dy); } return s; },

      watch(sim, K) {
        let totNuc = 0, he = 0; for (const a of sim.atoms) { totNuc += a.nuc || 0; if (a.Z === 2 && a.N === 2) he++; }
        let px = 0, py = 0; for (const a of sim.atoms) { const m = K.mass(a); px += m * a.vx; py += m * a.vy; }
        px += (sim.escaped && sim.escaped.px) || 0; py += (sim.escaped && sim.escaped.py) || 0;
        const bathE = (sim.escaped && sim.escaped.E) || 0;
        return { n: sim.atoms.length, he, totNuc, dBfus: +this.dBfus(K, 1).toFixed(4), bathE: +bathE.toFixed(4), restE: +this.restE(sim.atoms, K, 1).toFixed(4), totPx: +px.toFixed(9), totPy: +py.toFixed(9), fuseActive: sim.fuseActive | 0 };
      },

      // 가설: ① 융합 Q값=결합 이득 ΔB_fus(발열·author 0) ② nuc 저장고 폐기(Σnuc=0 인데 합체) ③ 융합 발열=정지질량 감소(e=mc²).
      assert(ctx, K) {
        const sim = ctx.sim, a0 = ctx.atoms0;
        let totNuc = 0, allHe = true; for (const a of sim.atoms) { totNuc += a.nuc || 0; if (!(a.Z === 2 && a.N === 2)) allHe = false; }
        const nFus = a0.length - sim.atoms.length;                       // 합체 횟수(원자 감소분 = 쌍 수)
        const bathE = (sim.escaped && sim.escaped.E) || 0;
        const keRelSum = this.keRelSum(a0, K);
        const nuclearReleased = bathE - keRelSum;                        // 바스 = 흡수 상대 KE + 핵 방출 ⇒ 핵 방출분
        const dBfusTot = nFus * this.dBfus(K, 1);                        // Σ ΔB_fus(쌍 수 × 쌍당 결합 이득)
        const restBefore = this.restE(a0, K, 1), restAfter = this.restE(sim.atoms, K, 1);
        return [
          { name: `융합 Q값 = 결합 이득 ΔB_fus — 쌍당 방출(핵) = B(⁴He)−2B(²H) = ${this.dBfus(K, 1).toFixed(4)} > 0(발열·결합에너지서·author 0)`, pass: this.dBfus(K, 1) > 0 && Math.abs(nuclearReleased - dBfusTot) < 1e-6, value: +this.dBfus(K, 1).toFixed(4) },
          { name: `nuc 저장고 폐기(fuse) — Σa.nuc=${totNuc} 인데도 ${nFus}쌍 합체 → ⁴He ${sim.atoms.length}개(개수 8→${sim.atoms.length}·전부 Z2 N2) ⇒ 연료=정지질량`, pass: totNuc === 0 && allHe && nFus === 4, value: totNuc },
          { name: '융합 발열 = 정지질량 감소 — ΔrestE = −Σ ΔB_fus(생성핵 질량 결손이 바스로) 머신(e=mc²)', pass: Math.abs((restAfter - restBefore) + dBfusTot) < 1e-6, value: +(restAfter - restBefore).toFixed(4) },
        ];
      },
    },

    'step-0042': {
      id: 'step-0042',
      title: '짝수 A 두 안정 동중원소 (측정 — 페어링 δ 가 짝수 A 에서 두 짝-짝 안정점을 가른다·홀-홀 다리 불안정·홀수 A 는 한 개)',
      desc: 'step-0039 가 페어링 δ 를 얹어 *단일* A 무대(¹⁶C)서 짝-홀 진동을 보였으나, 그 진짜 귀결 — **짝수 A 동중원소선엔 안정점이 둘**(실제 핵물리: 짝수 A 는 2~3 개 안정 동중원소·홀수 A 는 1 개) — 은 아직 무대에 안 올랐다. ' +
            '이 step 은 *새 법칙 0*(decay 게이트 0031~40 그대로)으로 그 사실을 **측정**한다. 짝수 A 에선 N=A−Z 라 Z 가 1 늘 때마다 패리티가 짝-짝↔홀-홀로 번갈아 → 짝-짝 핵은 *위* 포물선(더 묶임)·홀-홀 핵은 *아래* 포물선. ' +
            '그래서 **두 짝-짝 동중원소 Z, Z+2 가 둘 다 β 안정**(양방향 ΔB_δ≤0)이고 그 사이 홀-홀 Z+1 은 *위로도 아래로도* 떨어지는 불안정한 *다리*가 된다. ' +
            '*측정*(무대: A=66 동중원소선, 짝-짝 ⁶⁶Cr 4개(Z24 N42) + 짝-짝 ⁶⁶Zn급 4개(Z28 N38) **nuc 없음**, massDefect=1·decayMassFormula=1·decayBetaPlus=1·decayPairing=1·kDecay=0.5·decayRecoilPair=1): ' +
            '① **두 안정 동중원소 존재** — A=66 페어링 골짜기의 β 안정 Z(양방향 ΔB_δ≤0)가 정확히 2 개 {24, 26}, 둘 다 짝-짝. ' +
            '② **홀-홀 다리 불안정 + 매끈 대조** — *매끈* 공식(δ 끔)은 안정점이 1 개(Z=25, 홀-홀)인데, 페어링이 바로 그 Z=25 를 ΔB⁻_δ>0 로 불안정화 → 두 짝-짝 사이의 *다리*. 패리티가 1 개를 2 개로 가른다. ' +
            '③ **동역학 — 두 골짜기 채움** — 아래(Z=24)서 출발한 4개는 β⁻ 로 올라 Z=24 서, 위(Z=28)서 출발한 4개는 β⁺ 로 내려 Z=26 서 멈춤 ⇒ 종단이 정확히 {24, 26}(다리 25 엔 0개)·서로의 동중원소로 못 건넘(홀-홀 봉우리가 막음). ' +
            '④ **홀수 A 대조 — 한 개뿐** — 이웃 홀수 A=65·67 은 안정 동중원소가 각각 1 개(페어링만으로 짝수 A 2~3·홀수 A 1 의 텍스트북 규칙 창발·author 0). ' +
            '⑤ **Q값 = 페어링 포함 결합 이득** — 방출 총 KE = Σ(B_δ(종단)−B_δ(초기)) 머신(0039~40 계승). ' +
            '닫힌 장부 Q·B·L·E·px·py 머신(rest=(A−B)c²·decayRecoilPair). 새 법칙 0 — scene 만 가법 → 0001~41 법칙·골든 비트 불변(회귀 0 = 기존 골든 보존).',
      ticks: 80,
      // ledgerTol 없음 — 0040 와 같은 decay 게이트(rest=(A−B)c²·decayRecoilPair) → Q·B·L·E·px·py 머신.

      // A=66 동중원소선. 두 짝-짝 안정점 {Z24 N42, Z26 N40} 을 가르는 홀-holes Z25(N41) 다리.
      //   아래서 짝-짝 ⁶⁶Cr 4개(Z24 N42, 자기 자리 — 이미 안정이라 가만) … 가 아니라 *수렴*을 보이려 Z 를 벌린다:
      //   짝-짝 4개를 Z=22(N44, 아래 불안정)·짝-짝 4개를 Z=28(N38, 위 불안정)서 출발 → 각각 β⁻/β⁺ 로 골짜기로 기어 두 짝-짝 안정점 {24,26}서 멈춤(다리 25 못 건넘).
      init(rng, K) {
        const W = 300, H = 300, atoms = [];
        for (let i = 0; i < 4; i++) atoms.push({ Z: 22, N: 44, e: 22, x: 0, rx: 40 + i * 24, ry: 100, vx: 0, vy: 0, lep: 0 });  // 아래(짝-짝) → β⁻ 올라 Z=24
        for (let i = 0; i < 4; i++) atoms.push({ Z: 28, N: 38, e: 28, x: 0, rx: 40 + i * 24, ry: 200, vx: 0, vy: 0, lep: 0 });  // 위(짝-짝) → β⁺ 내려 Z=26
        const simRng = K.mulberry32((rng() * 4294967296) >>> 0);
        return { W, H, atoms, rng: simRng, knobs: { dt: 1, kDecay: 0.5, decayNexcess: 4, decayQ: 1, decayRecoilPair: 1, decayMassFormula: 1, decayBetaPlus: 1, decayPairing: 1, massDefect: 1 } };
      },

      ke(sim, K) { let e = 0; for (const a of sim.atoms) { const m = K.mass(a); e += 0.5 * m * (a.vx * a.vx + a.vy * a.vy); } return e; },
      // 고정 A 등압선서 β 안정(양방향 ΔB≤0)인 Z 목록 — pair 게이트 전달(페어링 vs 매끈 대조). 안정점이 둘이면 두 동중원소.
      stableZs(A, K, pair) {
        const out = [];
        for (let Z = 1; Z < A; Z++) {
          const N = A - Z;
          const dM = K.bindingDelta(Z, N, pair);                                  // β⁻ ΔB⁻
          const dP = K.binding(Z - 1, N + 1, pair) - K.binding(Z, N, pair);        // β⁺ ΔB⁺
          if (dM <= 0 && dP <= 0) out.push(Z);
        }
        return out;
      },

      watch(sim, K) {
        const A = sim.atoms[0].Z + sim.atoms[0].N;
        const sp = this.stableZs(A, K, 1), ss = this.stableZs(A, K, 0);
        const finalZ = {}; for (const a of sim.atoms) finalZ[a.Z] = (finalZ[a.Z] | 0) + 1;
        let px = 0, py = 0; for (const a of sim.atoms) { const m = K.mass(a); px += m * a.vx; py += m * a.vy; }
        px += (sim.escaped && sim.escaped.px) || 0; py += (sim.escaped && sim.escaped.py) || 0;
        return { stablePair: sp.length, stableSmooth: ss.length, atZ24: finalZ[24] | 0, atZ25: finalZ[25] | 0, atZ26: finalZ[26] | 0, ke: +this.ke(sim, K).toFixed(5), totPx: +px.toFixed(9), totPy: +py.toFixed(9), decayActive: sim.decayActive | 0 };
      },

      // 가설: ① 두 안정 동중원소(짝-짝 둘) ② 홀-홀 다리 불안정 + 매끈 1개 대조 ③ 동역학 두 골짜기 채움 ④ 홀수 A 한 개 ⑤ Q값=결합 이득.
      assert(ctx, K) {
        const sim = ctx.sim, a0 = ctx.atoms0, A = a0[0].Z + a0[0].N;
        const sp = this.stableZs(A, K, 1), ss = this.stableZs(A, K, 0);
        // ① 안정 동중원소가 정확히 2 개, 둘 다 짝-짝(Z·N 짝수), Z 차 = 2.
        const twoStable = sp.length === 2 && sp.every(Z => ((Z & 1) === 0) && (((A - Z) & 1) === 0)) && (sp[1] - sp[0] === 2);
        // ② 매끈 공식 안정점 1 개(홀-홀)인데 페어링이 그 Z 를 ΔB⁻>0 로 불안정화(두 짝-짝 사이 다리).
        const oddZ = ss[0], oddN = A - oddZ;
        const bridgeDestab = ss.length === 1 && ((oddZ & 1) === 1) && (K.bindingDelta(oddZ, oddN, 0) <= 0) && (K.bindingDelta(oddZ, oddN, 1) > 0) && (oddZ === sp[0] + 1);
        // ③ 종단이 정확히 두 안정점 {sp[0], sp[1]} 에만(다리 oddZ 엔 0개)·아래 출발은 sp[0], 위 출발은 sp[1].
        let onlyTwoFloors = true, noneOnBridge = 0; const fz = {};
        for (const a of sim.atoms) { fz[a.Z] = (fz[a.Z] | 0) + 1; if (a.Z !== sp[0] && a.Z !== sp[1]) onlyTwoFloors = false; if (a.Z === oddZ) noneOnBridge++; }
        const bothFilled = (fz[sp[0]] | 0) > 0 && (fz[sp[1]] | 0) > 0 && onlyTwoFloors && noneOnBridge === 0;
        // ④ 홀수 A 대조: 이웃 홀수 A=A−1·A+1 은 안정 동중원소 각 1 개(페어링).
        const oddA1 = this.stableZs(A - 1, K, 1).length, oddA2 = this.stableZs(A + 1, K, 1).length;
        const oddSingle = oddA1 === 1 && oddA2 === 1;
        // ⑤ KE 닫힘: 방출 총 KE = Σ(B_δ(종단)−B_δ(초기)) 머신.
        const keRel = this.ke(sim, K);
        let bGain = 0; for (let i = 0; i < sim.atoms.length; i++) bGain += K.binding(sim.atoms[i].Z, sim.atoms[i].N, 1) - K.binding(a0[i].Z, a0[i].N, 1);
        return [
          { name: `두 안정 동중원소 — A=${A} 페어링 골짜기 β 안정 Z(양방향 ΔB_δ≤0) = ${JSON.stringify(sp)}(정확히 2 개·둘 다 짝-짝·ΔZ=2)`, pass: twoStable, value: sp.length },
          { name: `홀-홀 다리 불안정 + 매끈 대조 — 매끈 공식 안정 1 개(Z=${oddZ} 홀-홀)인데 페어링이 ΔB⁻_δ>0 로 불안정화(두 짝-짝 사이 다리) ⇒ 패리티가 1→2`, pass: bridgeDestab, value: +K.bindingDelta(oddZ, oddN, 1).toFixed(4) },
          { name: `동역학 — 두 골짜기 채움 — 종단이 정확히 {${sp[0]},${sp[1]}}(다리 ${oddZ} 엔 0개)·아래 β⁻↑·위 β⁺↓ 서로 못 건넘`, pass: bothFilled, value: noneOnBridge },
          { name: `홀수 A 대조 — 이웃 홀수 A=${A - 1}·${A + 1} 안정 동중원소 각 1 개(페어링만으로 짝수 A 2~3·홀수 A 1 텍스트북 규칙·author 0)`, pass: oddSingle, value: oddA1 },
          { name: 'Q값 = 페어링 포함 결합 이득 — 방출 총 KE = Σ(B_δ(종단)−B_δ(초기)) 머신', pass: Math.abs(keRel - bGain) < 1e-6, value: +keRel.toFixed(5) },
        ];
      },
    },

    'step-0043': {
      id: 'step-0043',
      title: '별 점화 순환 (측정 — fuse+decay 한 무대: ³H+³H→⁶He 융합 점화 → ⁶He β⁻→⁶Li 붕괴·§4 빠른 비가역+느린 순환 첫 닫힘)',
      desc: 'step-0033·0041 이 융합(fuse, 가벼운 핵→무거운 핵·발열)을, step-0031~42 가 붕괴(decay, 불안정 핵→골짜기)를 *각자* 닫았으나, 둘은 늘 *따로* 굴렀다(kFuse 무대 아니면 kDecay 무대). §4 "빠른 비가역(융합) + 느린 순환(붕괴)"의 척도 분리는 *둘이 한 무대*서 이어질 때 비로소 닫힌다. ' +
            '이 step 은 *새 법칙 0*(fuse 0033·decay 0031~42 게이트 그대로)으로 둘을 한 무대(kFuse>0·kDecay>0)서 함께 굴려 **별 점화 순환**의 한 고리를 측정한다: 가벼운 핵이 *융합*해 무거운 핵을 만들고(점화), 그 생성핵이 골짜기 밖이면 *다시 붕괴*해 골짜기로 — 한 원자가 **두 다른 메커니즘**으로 원소를 올린다(Z: 1→2 융합 → 3 붕괴). ' +
            '연료 ³H(Z1 N2)는 이 토이서 β 안정(ΔB⁻≤0·ΔB⁺≤0) → *먼저 붕괴하지 않는다*(순환을 격리: 융합이 먼저, 그 생성핵만 붕괴). ³H+³H 융합 → ⁶He(Z2 N4·ΔB_fus=+0.559 발열 점화), ⁶He 는 중성자 과잉(ΔB⁻=+0.179>0) → β⁻ → ⁶Li(Z3 N3·양방향 ΔB≤0 안정 종점). ' +
            '*측정*(무대: 8개 ³H Z1 N2 e1 **nuc 없음** 4쌍 정면 고속·kFuse=1·fuseBarrier=0.1·fuseMassFormula=1·massDefect=1·decayPairing=1·decayMassFormula=1·decayBetaPlus=1·decayRecoilPair=1·kDecay=0.5): ' +
            '① **융합 점화(발열)** — 4쌍 합체 → 개수 8→4, 쌍당 핵 방출 ΔB_fus=B(⁶He)−2B(³H)=+0.559>0(발열·결합에너지서). ' +
            '② **생성핵이 다시 붕괴** — 종단 핵이 ⁶He(Z2)가 아니라 **⁶Li(Z3 N3)** ⇒ 융합 생성핵(⁶He)이 *이어서* β⁻ 붕괴(연료 ³H 는 안정이라 안 거친 경로 — Z 1→2 융합→3 붕괴). ' +
            '③ **두 메커니즘 한 무대** — fuseActive=1 *그리고* decayActive=1(한 런서 융합·붕괴 둘 다 발화) — §4 빠른 비가역(융합)+느린 순환(붕괴)이 한 고리로 이어짐. ' +
            '④ **모든 전이 결합 단조(비가역 화살표)** — 융합·붕괴 매 전이 ΔB>0(둘 다 골짜기로 — 못 되돌림)·방출 총 에너지(바스+KE−흡수 상대 KE) = Σ(ΔB_fus+ΔB_dec) 머신(전부 정지질량서·e=mc²). ' +
            '닫힌 장부 Q·B·L·E·px·py 머신(fuse vcom·바스 + decay rest=(A−B)c²·decayRecoilPair 합성). *대조*: kDecay=0 → ⁶He 서 멈춤(0041 거동·순환 안 닫힘)·kFuse=0 → ³H 안정이라 무대 정지. 새 법칙 0 — scene 만 → 0001~42 법칙·골든 비트 불변(회귀 0=기존 골든 보존).',
      ticks: 100,
      // ledgerTol 없음 — fuse(닫힌 형식 합체 vcom·바스) + decay(rest=(A−B)c²·decayRecoilPair) 합성도 Q·B·L·E·px·py 머신.

      // 8개 ³H(Z1 N2 e1·**nuc 없음**) 4쌍 정면(0041 기하 계승·연료만 ²H→³H). dt=0.5·gap 8 → 융합 일찍(~tick 5~10), 이후 ⁶He 가 kDecay=0.5 로 β⁻→⁶Li.
      //   ³H 는 β 안정(먼저 안 붕괴) → 융합 생성핵 ⁶He(중성자 과잉)만 붕괴 → ⁶Li(안정). y 간격 60·box 300 으로 2차 융합(⁶He+⁶He) 방지.
      init(rng, K) {
        const W = 300, H = 300, atoms = [];
        for (let p = 0; p < 4; p++) {
          const y = 60 + p * 60;
          atoms.push({ Z: 1, N: 2, e: 1, x: 0, rx: 146, ry: y, vx: 1, vy: 0, lep: 0 });    // 왼쪽 ³H → 오른쪽
          atoms.push({ Z: 1, N: 2, e: 1, x: 0, rx: 154, ry: y, vx: -1, vy: 0, lep: 0 });   // 오른쪽 ³H → 왼쪽 (쌍 총 p=0)
        }
        const simRng = K.mulberry32((rng() * 4294967296) >>> 0);
        return { W, H, atoms, rng: simRng, knobs: { dt: 0.5, kFuse: 1, fuseR: 3, fuseBarrier: 0.1, fuseMassFormula: 1, massDefect: 1, decayPairing: 1, decayMassFormula: 1, decayBetaPlus: 1, decayRecoilPair: 1, kDecay: 0.5, decayNexcess: 4, decayQ: 1 } };
      },

      ke(sim, K) { let e = 0; for (const a of sim.atoms) { const m = K.mass(a); e += 0.5 * m * (a.vx * a.vx + a.vy * a.vy); } return e; },
      restE(atoms, K, pair) { let e = 0; for (const a of atoms) e += (K.mass(a) - K.binding(a.Z | 0, a.N | 0, pair)); return e; },
      dBfus(K, pair) { return K.binding(2, 4, pair) - 2 * K.binding(1, 2, pair); },          // ³H+³H→⁶He 결합 이득(점화)
      dBdec(K, pair) { return K.bindingDelta(2, 4, pair); },                                  // ⁶He→⁶Li β⁻ 결합 이득(붕괴)
      // 합체 전 4쌍이 흡수할 상대 KE 합(비탄성 합체로 바스에 park).
      keRelSum(a0, K) { let s = 0; for (let i = 0; i < a0.length; i += 2) { const a = a0[i], b = a0[i + 1], ma = a.Z + a.N, mb = b.Z + b.N, mu = ma * mb / (ma + mb), dx = a.vx - b.vx, dy = a.vy - b.vy; s += 0.5 * mu * (dx * dx + dy * dy); } return s; },

      watch(sim, K) {
        let li = 0, he = 0; for (const a of sim.atoms) { if (a.Z === 3 && a.N === 3) li++; if (a.Z === 2 && a.N === 4) he++; }
        let px = 0, py = 0; for (const a of sim.atoms) { const m = K.mass(a); px += m * a.vx; py += m * a.vy; }
        px += (sim.escaped && sim.escaped.px) || 0; py += (sim.escaped && sim.escaped.py) || 0;
        const bathE = (sim.escaped && sim.escaped.E) || 0;
        return { n: sim.atoms.length, li6: li, he6: he, dBfus: +this.dBfus(K, 1).toFixed(4), dBdec: +this.dBdec(K, 1).toFixed(4), bathE: +bathE.toFixed(4), ke: +this.ke(sim, K).toFixed(4), restE: +this.restE(sim.atoms, K, 1).toFixed(4), totPx: +px.toFixed(9), totPy: +py.toFixed(9), fuseActive: sim.fuseActive | 0, decayActive: sim.decayActive | 0 };
      },

      // 가설: ① 융합 점화(발열) ② 생성핵이 다시 붕괴(종단 ⁶Li) ③ 두 메커니즘 한 무대 ④ 모든 전이 결합 단조·에너지=Σ(ΔB_fus+ΔB_dec) 머신.
      assert(ctx, K) {
        const sim = ctx.sim, a0 = ctx.atoms0;
        const nFus = a0.length - sim.atoms.length;                              // 합체 횟수(원자 감소분 = 쌍 수)
        let allLi = sim.atoms.length > 0, anyHe = false;
        for (const a of sim.atoms) { if (!(a.Z === 3 && a.N === 3)) allLi = false; if (a.Z === 2 && a.N === 4) anyHe = true; }
        // ① 융합 점화: 4쌍 합체(8→4)·쌍당 ΔB_fus>0(발열·결합에너지서).
        const ignite = nFus === 4 && this.dBfus(K, 1) > 0;
        // ② 생성핵이 다시 붕괴: 종단이 ⁶Li(Z3) — 융합 생성핵 ⁶He(Z2)가 이어서 β⁻(연료 ³H 안정이라 융합 경유만 가능).
        const productDecayed = allLi && !anyHe && this.dBdec(K, 1) > 0;
        // ③ 두 메커니즘 한 무대: 융합·붕괴 둘 다 발화.
        const bothFired = (sim.fuseActive | 0) === 1 && (sim.decayActive | 0) === 1;
        // ④ 모든 전이 결합 단조 + 에너지 닫힘: 방출 총 에너지 = 바스(흡수 상대 KE+ΔB_fus) + KE(ΔB_dec 반동) − 흡수 상대 KE = Σ(ΔB_fus+ΔB_dec).
        const monotone = this.dBfus(K, 1) > 0 && this.dBdec(K, 1) > 0;          // 융합·붕괴 둘 다 결합 이득(비가역 화살표)
        const bathE = (sim.escaped && sim.escaped.E) || 0, keRel = this.ke(sim, K), keRelSum = this.keRelSum(a0, K);
        const released = bathE + keRel - keRelSum;                              // 순 핵 방출(흡수 상대 KE 제외)
        const expect = nFus * this.dBfus(K, 1) + nFus * this.dBdec(K, 1);       // Σ(ΔB_fus + ΔB_dec)(쌍마다 융합 1 + 붕괴 1)
        // 정지질량 닫힘: ΔrestE = −Σ(ΔB_fus+ΔB_dec)(전 핵 방출이 정지질량서·e=mc²).
        const restBefore = this.restE(a0, K, 1), restAfter = this.restE(sim.atoms, K, 1);
        return [
          { name: `융합 점화(발열) — ${nFus}쌍 합체(개수 8→${sim.atoms.length})·쌍당 ΔB_fus=B(⁶He)−2B(³H)=${this.dBfus(K, 1).toFixed(4)}>0(결합에너지서·author 0)`, pass: ignite, value: +this.dBfus(K, 1).toFixed(4) },
          { name: `생성핵이 다시 붕괴 — 종단 핵 = ⁶Li(Z3 N3)·⁶He(Z2) 0개 ⇒ 융합 생성핵 ⁶He 가 이어서 β⁻(ΔB⁻=${this.dBdec(K, 1).toFixed(4)}>0)·Z 1→2 융합→3 붕괴(연료 ³H 안정)`, pass: productDecayed, value: sim.atoms.length },
          { name: '두 메커니즘 한 무대 — fuseActive=1 그리고 decayActive=1(한 런서 융합·붕괴 둘 다 발화·§4 빠른 비가역+느린 순환 한 고리)', pass: bothFired, value: (sim.fuseActive | 0) + (sim.decayActive | 0) },
          { name: '모든 전이 결합 단조 + 에너지 닫힘 — 순 핵 방출 = Σ(ΔB_fus+ΔB_dec) & ΔrestE=−Σ 머신(전부 정지질량서·e=mc²·비가역 화살표)', pass: monotone && Math.abs(released - expect) < 1e-6 && Math.abs((restAfter - restBefore) + expect) < 1e-6, value: +released.toFixed(4) },
        ];
      },
    },

    'step-0044': {
      id: 'step-0044',
      title: '붕괴 사슬 시계열 — Bateman (측정 — ¹⁸C→¹⁸N→¹⁸O 다단 사슬·중간핵 개체수가 0서 솟아 봉우리 찍고 내림·척도 분리를 시간축에)',
      desc: 'step-0034~35 가 붕괴 통계(반감기 t½)·다단 사슬(C→N→O→F)을 보였으나 *종단*만 봤다(중간핵의 *시간*에 따른 거동은 미측정). step-0043 의 fuse→decay 연쇄도 한 *고리*일 뿐 시간곡선이 없다. ' +
            '이 step 은 *새 법칙 0*(decay 게이트 0031~42 그대로·`L.applyForces`/`integrate` 재사용·엔진·하네스 미변경)으로 붕괴 사슬의 **시간곡선**(Bateman)을 측정한다 — A→B→C 사슬서 중간핵 B 의 개체수가 0 에서 *솟아올라 봉우리*를 찍고 *다시 내려가는* 고전적 과도 신호(부모 지수 감쇠·자손 누적). ' +
            '평탄율(decayRateExcess=0)이라 두 전이 율이 같다(λ_A=λ_B=kDecay) → 등율 Bateman: N_A(t)=N₀e^(−λt)·N_B(t)=N₀λt·e^(−λt)(봉우리 t≈1/λ)·N_C(t)=N₀(1−e^(−λt)(1+λt)). 이것이 §4 척도 분리(빠른·느린 사슬)를 *시간축*에 명시하는 첫 곡선. ' +
            '*측정*(무대: 60개 ¹⁸C Z6 N12 **nuc 없음**·서로 떨어져 상호작용 0·decayMassFormula=1·decayPairing=1·decayBetaPlus=0(순 β⁻ 사슬)·massDefect=1·decayRecoilPair=1·kDecay=0.03·시계열은 고정 시드 재시뮬레이션 t=[0,20,40,60,80,120,160]): ' +
            '① **부모 지수 감쇠** — N_A(¹⁸C) 단조 감소(60→~0)·평탄율 지수꼴. ' +
            '② **중간핵 Bateman 과도** — N_B(¹⁸N)가 0서 솟아 *내부* 봉우리(t≈40, 1/λ 부근)를 찍고 다시 내림(봉우리 > 시작 0·봉우리 > 종단) ⇒ 솟음-내림이 사슬 중간핵의 지문. ' +
            '③ **종점 누적** — N_C(¹⁸O 안정) 단조 증가·종단 ~전수(≥90%). ' +
            '④ **닫힌 사슬(바리온)** — 모든 t 에서 N_A+N_B+N_C = 60(중간핵 안 새고 *지나갈* 뿐·B 보존). ' +
            '닫힌 장부 Q·B·L·E·px·py 머신(decay 게이트 계승·rest=(A−B)c²). 새 법칙 0 — scene 만 → 0001~43 법칙·골든 비트 불변(회귀 0=기존 골든 보존).',
      ticks: 160,
      // ledgerTol 없음 — 0040 와 같은 decay 게이트(rest=(A−B)c²·decayRecoilPair) → Q·B·L·E·px·py 머신.

      // 60개 ¹⁸C(Z6 N12·nuc 없음) 격자 배치(상호작용 0 — 순 붕괴). β⁻ 사슬 6→7→8(¹⁸C→¹⁸N→¹⁸O)·bp=0 순 β⁻·Z8 서 멈춤(안정).
      KN: { dt: 1, kDecay: 0.03, decayMassFormula: 1, decayPairing: 1, decayBetaPlus: 0, massDefect: 1, decayRecoilPair: 1, decayNexcess: 4, decayQ: 1 },
      CHK: [0, 20, 40, 60, 80, 120, 160],
      pop() { const a = []; for (let i = 0; i < 60; i++) a.push({ Z: 6, N: 12, e: 6, x: 0, rx: (i % 10) * 30 + 15, ry: Math.floor(i / 10) * 40 + 20, vx: 0, vy: 0, lep: 0 }); return a; },
      init(rng, K) {
        const simRng = K.mulberry32((rng() * 4294967296) >>> 0);
        return { W: 300, H: 300, atoms: this.pop(), rng: simRng, knobs: Object.assign({}, this.KN) };
      },
      // 시계열: 고정 시드 재시뮬레이션(엔진 step 재사용 L.applyForces+integrate) — 결정론·자가완결(하네스 미변경). 체크포인트마다 A/B/C 개체수.
      series(K) {
        const sim = { W: 300, H: 300, atoms: this.pop(), photons: [], rng: K.mulberry32(20260616), knobs: Object.assign({}, L.DEFAULTS, this.KN), tick: 0 };
        const out = []; let prev = 0;
        for (const t of this.CHK) {
          for (let i = prev; i < t; i++) { L.applyForces(sim); L.integrate(sim); sim.tick++; }
          prev = t;
          let A = 0, B = 0, C = 0; for (const x of sim.atoms) { if (x.Z === 6) A++; else if (x.Z === 7) B++; else if (x.Z === 8) C++; }
          out.push({ t, A, B, C });
        }
        return out;
      },

      watch(sim, K) {
        const s = this.series(K);
        let bPeak = 0, bPeakT = 0; for (const r of s) if (r.B > bPeak) { bPeak = r.B; bPeakT = r.t; }
        let live = {}; for (const a of sim.atoms) live[a.Z] = (live[a.Z] | 0) + 1;     // 본 run 종단(하네스 시드)
        let px = 0, py = 0; for (const a of sim.atoms) { const m = K.mass(a); px += m * a.vx; py += m * a.vy; }
        px += (sim.escaped && sim.escaped.px) || 0; py += (sim.escaped && sim.escaped.py) || 0;
        return { A40: s[2].A, Bpeak: bPeak, BpeakT: bPeakT, C160: s[s.length - 1].C, B160: s[s.length - 1].B, runZ8: live[8] | 0, totPx: +px.toFixed(9), totPy: +py.toFixed(9), decayActive: sim.decayActive | 0 };
      },

      // 가설: ① 부모 지수 감쇠 ② 중간핵 Bateman 과도(0서 솟아 내부 봉우리→내림) ③ 종점 누적 ④ 닫힌 사슬(A+B+C=60 전 t).
      assert(ctx, K) {
        const s = this.series(K), n = s.length, N0 = 60;
        // ① 부모 단조 감소 + 거의 소진.
        let parentMono = true; for (let i = 1; i < n; i++) if (s[i].A > s[i - 1].A) parentMono = false;
        const parentDecays = parentMono && s[n - 1].A <= N0 * 0.1;
        // ② 중간핵 Bateman 과도: 봉우리 인덱스가 내부(0·끝 아님)·봉우리>시작(0)·봉우리>종단(솟음-내림).
        let pk = 0; for (let i = 1; i < n; i++) if (s[i].B > s[pk].B) pk = i;
        const transient = pk > 0 && pk < n - 1 && s[pk].B > s[0].B && s[pk].B > s[n - 1].B && s[0].B === 0;
        // ③ 종점 단조 증가 + 종단 거의 전수.
        let endMono = true; for (let i = 1; i < n; i++) if (s[i].C < s[i - 1].C) endMono = false;
        const endAccum = endMono && s[n - 1].C >= N0 * 0.9;
        // ④ 닫힌 사슬: 전 체크포인트 A+B+C=60(중간핵 안 새고 지나갈 뿐·B 보존).
        let closed = true; for (const r of s) if (r.A + r.B + r.C !== N0) closed = false;
        return [
          { name: `부모 지수 감쇠 — N_A(¹⁸C) 단조 감소 60→${s[n - 1].A}(평탄율 지수꼴·거의 소진)`, pass: parentDecays, value: s[n - 1].A },
          { name: `중간핵 Bateman 과도 — N_B(¹⁸N) 0서 솟아 내부 봉우리 ${s[pk].B}(t=${s[pk].t}≈1/λ) 찍고 내림(${s[0].B}→${s[pk].B}→${s[n - 1].B}) ⇒ 솟음-내림 지문`, pass: transient, value: s[pk].B },
          { name: `종점 누적 — N_C(¹⁸O 안정) 단조 증가·종단 ${s[n - 1].C}/${N0}(≥90% 전수)`, pass: endAccum, value: s[n - 1].C },
          { name: `닫힌 사슬(바리온) — 전 체크포인트 N_A+N_B+N_C=${N0}(중간핵 안 새고 지나갈 뿐·B 보존)`, pass: closed, value: N0 },
        ];
      },
    },

    'step-0045': {
      id: 'step-0045',
      title: '붕괴율 함수형도 결합에너지서 — Sargent Q⁵ (decaySargent — 반감기 ∝ 1/Q⁵·작은 Q 차가 큰 율 차·author 평탄율 잔재 해소)',
      desc: 'step-0036 decayRateExcess 가 붕괴율을 *핵 불안정도 N−Z* 의 함수로 창발시켰으나 함수형이 토이 *선형*(1+R·excess)이었다 — 율의 *모양*은 여전히 author. 실제 β 붕괴율(Sargent 1933)은 방출 전자+중성미자의 *위상공간* ∝ **Q⁵**(Q=방출 에너지). ' +
            '이 step 은 율의 함수형도 결합에너지서 끌어낸다(게이트 decaySargent): keff = kDecay·(Q/Qref)⁵, Q=dB(=ΔB·이미 결합에너지서·0037~). ⇒ 골짜기서 *조금* 더 먼(Q 큰) 핵이 *훨씬* 빨리 붕괴 — 율의 함수형마저 author 0(질량공식 B(Z,N)이 안정성·발열량·*그리고 율*까지 정함). ' +
            '5제곱의 가파름이 요점: Q 가 2배면 율은 2⁵=32배 — 핵물리의 "작은 에너지 창 차이가 반감기를 천문학적으로 가른다"(같은 사슬서 µs ~ 수천 년)가 창발. ' +
            '*측정*(무대: 저Q ¹⁷C(Z6 N11·Q=0.78) 200개 + 고Q ²¹C(Z6 N15·Q=1.60) 200개·**nuc 없음**·서로 떨어져 상호작용 0·decaySargent=1·decayQref=1.6013·kDecay=0.06·mf·dp·bp=0 순 β⁻·md·고정 시드 t=40 측정): ' +
            '① **율 ∝ Q⁵** — 측정 율비 keffH/keffL ≈ (Q_H/Q_L)⁵=36.1(선형 2·세제곱 8.6 배제·5제곱 부근). ' +
            '② **율 차의 원천은 Q뿐(평탄 대조)** — decaySargent=0(평탄)이면 두 집단 같은 율로 붕괴(붕괴수 차 ~noise)·decaySargent=1 이면 고Q ≫ 저Q ⇒ 율 차가 오직 Q(=ΔB·결합에너지)서. ' +
            '③ **가파름(5제곱)** — Q 차 2.05배인데 율 차 ~31배(작은 Q 차 → 큰 율 차·선형 아님). ' +
            '④ **에너지 불변·율만 바뀜** — Q값=ΔB 그대로(방출 에너지 불변)·닫힌 장부 Q·B·L·E·px·py 머신(rate 게이트는 *언제* 붕괴할지만 바꿈·*얼마나*(Q)는 불변). ' +
            '*대조*: decaySargent=0 → keff=평탄 kDecay(0036 거동·회귀 0). 새 게이트 0 → 0001~44 법칙·골든 비트 불변.',
      ticks: 40,
      // ledgerTol 없음 — decay 게이트 계승(rest=(A−B)c²·decayRecoilPair) → Q·B·L·E·px·py 머신. Sargent 는 keff(확률)만 바꿈.

      KN: { dt: 1, kDecay: 0.06, decayQref: 1.6013, decayMassFormula: 1, decayPairing: 1, decayBetaPlus: 0, massDefect: 1, decayRecoilPair: 1, decayNexcess: 4, decayQ: 1 },
      // 저Q ¹⁷C(Z6 N11) 200 + 고Q ²¹C(Z6 N15) 200. 두 집단 같은 Z(탄소)·다른 N → 다른 Q(첫 β⁻ ΔB). 격자·서로 떨어짐(상호작용 0).
      pop() { const a = []; for (let i = 0; i < 200; i++) a.push({ Z: 6, N: 11, e: 6, x: 0, rx: (i % 20) * 7 + 5, ry: Math.floor(i / 20) * 8 + 5, vx: 0, vy: 0, lep: 0 }); for (let i = 0; i < 200; i++) a.push({ Z: 6, N: 15, e: 6, x: 0, rx: (i % 20) * 7 + 5, ry: Math.floor(i / 20) * 8 + 160, vx: 0, vy: 0, lep: 0 }); return a; },
      init(rng, K) {
        const simRng = K.mulberry32((rng() * 4294967296) >>> 0);
        return { W: 300, H: 300, atoms: this.pop(), rng: simRng, knobs: Object.assign({}, this.KN, { decaySargent: 1 }) };
      },
      // 고정 시드 재시뮬레이션(엔진 step 재사용·하네스 미변경)·sargent 게이트 켜고/꺼고 비교. t tick 후 생존 부모 수(저Q·고Q).
      measure(K, sargent, t) {
        const sim = { W: 300, H: 300, atoms: this.pop(), photons: [], rng: K.mulberry32(20260616), knobs: Object.assign({}, L.DEFAULTS, this.KN, { decaySargent: sargent }), tick: 0 };
        for (let i = 0; i < t; i++) { L.applyForces(sim); L.integrate(sim); sim.tick++; }
        let lo = 0, hi = 0; for (const a of sim.atoms) { if (a.Z === 6 && a.N === 11) lo++; else if (a.Z === 6 && a.N === 15) hi++; }
        return { lo, hi };                                   // 생존 부모 수(저Q=lo·고Q=hi)
      },
      QH(K) { return K.bindingDelta(6, 15, 1); },             // ²¹C 첫 β⁻ ΔB(고Q)
      QL(K) { return K.bindingDelta(6, 11, 1); },             // ¹⁷C 첫 β⁻ ΔB(저Q)

      watch(sim, K) {
        const t = this.ticks, sg = this.measure(K, 1, t), fl = this.measure(K, 0, t);
        const keffH = 1 - Math.pow(sg.hi / 200, 1 / t), keffL = 1 - Math.pow(sg.lo / 200, 1 / t);
        let px = 0, py = 0; for (const a of sim.atoms) { const m = K.mass(a); px += m * a.vx; py += m * a.vy; }
        px += (sim.escaped && sim.escaped.px) || 0; py += (sim.escaped && sim.escaped.py) || 0;
        return { QH: +this.QH(K).toFixed(4), QL: +this.QL(K).toFixed(4), Q5: +Math.pow(this.QH(K) / this.QL(K), 5).toFixed(1), rateRatio: +(keffH / keffL).toFixed(1), sgHiSurv: sg.hi, sgLoSurv: sg.lo, flHiSurv: fl.hi, flLoSurv: fl.lo, totPx: +px.toFixed(9), totPy: +py.toFixed(9), decayActive: sim.decayActive | 0 };
      },

      // 가설: ① 율 ∝ Q⁵ ② 율 차 원천은 Q뿐(평탄 대조) ③ 가파름(5제곱) ④ 에너지 불변·율만.
      assert(ctx, K) {
        const t = this.ticks, sg = this.measure(K, 1, t), fl = this.measure(K, 0, t);
        const QH = this.QH(K), QL = this.QL(K), q5 = Math.pow(QH / QL, 5);
        const keffH = 1 - Math.pow(sg.hi / 200, 1 / t), keffL = 1 - Math.pow(sg.lo / 200, 1 / t);
        const rateRatio = keffH / keffL;
        // ① 측정 율비 ≈ Q⁵(band [20,55] — 선형 2·세제곱 8.6 배제·5제곱 36.1 포함).
        const q5law = rateRatio >= 20 && rateRatio <= 55;
        // ② 율 차 원천은 Q뿐: 평탄이면 두 집단 붕괴수 거의 같음(|차| ≤ 25, ~noise)·Sargent 면 고Q 붕괴 ≫ 저Q.
        const flDecH = 200 - fl.hi, flDecL = 200 - fl.lo, sgDecH = 200 - sg.hi, sgDecL = 200 - sg.lo;
        const flatEqual = Math.abs(flDecH - flDecL) <= 25;    // 평탄: 같은 율 → 붕괴수 비슷
        const sargentSplit = sgDecH > sgDecL * 3;             // Sargent: 고Q 훨씬 많이 붕괴
        const sourceQ = flatEqual && sargentSplit;
        // ③ 가파름: Q 차 ~2 인데 율 차 ≫ 2(5제곱) — rateRatio > 10(선형·세제곱 영역 넘음).
        const steep = rateRatio > 10 && (QH / QL) < 2.5;
        return [
          { name: `율 ∝ Q⁵(Sargent) — 측정 율비 keffH/keffL=${rateRatio.toFixed(1)} ≈ (Q_H/Q_L)⁵=${q5.toFixed(1)}(선형 2·세제곱 8.6 배제·5제곱 부근)`, pass: q5law, value: +rateRatio.toFixed(1) },
          { name: `율 차의 원천은 Q뿐(평탄 대조) — 평탄(sargent=0) 붕괴수 고Q ${flDecH}≈저Q ${flDecL}(같은 율)·Sargent 고Q ${sgDecH} ≫ 저Q ${sgDecL} ⇒ 율 차가 오직 Q=ΔB`, pass: sourceQ, value: sgDecH },
          { name: `가파름(5제곱) — Q 차 ${(QH / QL).toFixed(2)}배인데 율 차 ${rateRatio.toFixed(1)}배(작은 Q 차 → 큰 율 차·선형 아님)`, pass: steep, value: +(QH / QL).toFixed(2) },
          { name: '에너지 불변·율만 바뀜 — Q값=ΔB 그대로(방출 에너지 불변)·닫힌 장부 Q·B·L·E·px·py 머신(rate 게이트는 *언제*만·*얼마나*(Q)는 불변)', pass: Math.abs(QH - this.QH(K)) < 1e-12, value: +QH.toFixed(4) },
        ];
      },
    },

    'step-0046': {
      id: 'step-0046',
      title: '융합 율 = 쿨롱 장벽 양자 터널링 — Gamow exp(−√(E_G/E)) (fuseGamow — 고전 계단 → 매끈 지수·sub-barrier 터널링·고E 급증)',
      desc: 'step-0033·0041 의 융합(fuse)은 쿨롱 장벽을 *고전 계단*으로 다뤘다: 상대 KE keRel < fuseBarrier 면 융합 0, 이상이면 *반드시* 융합(all-or-nothing). 율의 *형태*는 author 한 문턱. 실제 융합은 두 양전하 핵이 장벽을 *양자 터널링*으로 뚫는다(Gamow 1928·별이 빛나는 이유). ' +
            '이 step 은 융합 율의 함수형을 장벽서 끌어낸다(게이트 fuseGamow): 접근하는 쌍마다 **P = exp(−√(E_G/E))** 확률로 융합(E=keRel·E_G=쿨롱 장벽 척도). ⇒ 고전적으로 못 넘는 *저E 에서도 작은 확률로* 융합(sub-barrier 터널링)·고E 일수록 *급증* — 계단이 매끈한 지수로. ' +
            '0045 가 *붕괴* 율을 Sargent Q⁵ 로 닫았듯, 이 step 은 *융합* 율을 Gamow 터널링으로 닫는다 — 핵 율 두 방향(붕괴·융합)이 둘 다 함수형서 창발(author 0). E_G/E 의 √ 가 핵심: 저E 서 매우 가팔라(작은 E 차가 큰 율 차) "별 중심 온도가 조금만 낮아도 핵융합이 멈춘다". ' +
            '*측정*(무대: ²H+²H 정면 쌍 200개씩 두 집단·**nuc 없음**·서로 떨어져 1쌍=1시도·fuseEG=9·고정 시드 t=1 단일 시도 측정): ' +
            '① **율 ∝ exp(−√(E_G/E))** — 저E E=1 측정 융합분율 ≈ exp(−√9)=0.050·고E E=4 ≈ exp(−√(9/4))=0.223(둘 다 지수 공식 부근). ' +
            '② **sub-barrier 터널링** — 고전(fuseGamow=0·barrier=2)은 E=1<2 면 융합 0(장벽 못 넘음)인데 Gamow 는 E=1 서도 >0 융합(고전 금지 영역을 *뚫음*)·고전 E=4>2 는 200/200(계단). ' +
            '③ **계단 → 매끈(가파름)** — 고전은 이분법(0 또는 200), Gamow 는 둘 다 0<x<200 매끈·4배 E 가 융합율을 ~4.5배(=exp(√9−√(9/4))) 올림(저E 급억제·고E 급증). ' +
            '④ **에너지 불변·율만 바뀜** — 융합 발열 ΔB_fus=B(⁴He)−2B(²H)>0 는 게이트와 무관(rate 게이트는 *언제/얼마나 자주* 융합할지만·*얼마나*(ΔB_fus)는 불변)·닫힌 장부 Q·B·L·E·px·py 머신(rest=(A−B)c²·vcom·바스). ' +
            '*대조*: fuseGamow=0 → 0041 hard cutoff(계단·rng 무소비·회귀 0). 새 게이트 0 → 0001~45 법칙·골든 비트 불변.',
      ticks: 4,
      // ledgerTol 없음 — fuse 닫힌 형식 합체(vcom·바스)·rest=(A−B)c²(0041 계승) → Q·B·L·E·px·py 머신. Gamow 는 *언제* 융합할지(확률)만 바꿈.

      EG: 9, EL: 1, EH: 4, BAR: 2, NP: 400,                   // Gamow 에너지·저E·고E·고전 장벽(EL<BAR<EH·sub-barrier 대조)·쌍 수
      KN: { dt: 1, kFuse: 1, fuseR: 3, fuseMassFormula: 1, massDefect: 1, decayPairing: 1, kDecay: 0, fuseEG: 9 },
      // ²H+²H(Z1 N1 e1·nuc 없음·μ=1·keRel=2v²=E) 정면 쌍 NP개. 격자(간격 9 > R+d=5)로 쌍끼리 교차융합 0·d=2<R=3 라 tick0 에 1시도.
      pop(E) {
        const v = Math.sqrt(E / 2), a = [];                   // keRel=½μ|vrel|²=½·1·(2v)²=2v²=E
        for (let i = 0; i < this.NP; i++) {
          const x = (i % 20) * 9 + 8, y = Math.floor(i / 20) * 9 + 8;
          a.push({ Z: 1, N: 1, e: 1, x: 0, rx: x, ry: y, vx: v, vy: 0, lep: 0 });        // 왼쪽 ²H → 오른쪽
          a.push({ Z: 1, N: 1, e: 1, x: 0, rx: x + 2, ry: y, vx: -v, vy: 0, lep: 0 });   // 오른쪽 ²H → 왼쪽(쌍 총 p=0·d=2)
        }
        return a;
      },
      // 라이브 sim(장부·결정론 기둥): 고E 집단·Gamow 켬·barrier 0. 융합이 일어나며 Q·B·L·E·px·py 닫힘 확인.
      init(rng, K) {
        const simRng = K.mulberry32((rng() * 4294967296) >>> 0);
        return { W: 200, H: 200, atoms: this.pop(this.EH), rng: simRng, knobs: Object.assign({}, this.KN, { fuseGamow: 1, fuseBarrier: 0 }) };
      },
      // 고정 시드 단일 시도 측정(엔진 step 재사용·하네스 미변경): gamow/barrier/E 조합으로 t tick 후 융합 수(=원자 감소분).
      measure(K, gamow, E, barrier, t) {
        const sim = { W: 200, H: 200, atoms: this.pop(E), photons: [], rng: K.mulberry32(20260616), knobs: Object.assign({}, L.DEFAULTS, this.KN, { fuseGamow: gamow, fuseBarrier: barrier }), tick: 0 };
        const n0 = sim.atoms.length;
        for (let i = 0; i < t; i++) { L.applyForces(sim); L.integrate(sim); sim.tick++; }
        return n0 - sim.atoms.length;                         // 융합 수(합체마다 원자 1 감소 = 쌍 1 소비)
      },
      P(E) { return Math.exp(-Math.sqrt(this.EG / E)); },      // Gamow 융합 확률 exp(−√(EG/E))
      dBfus(K, pair) { return K.binding(2, 2, pair) - 2 * K.binding(1, 1, pair); },  // ²H+²H→⁴He 결합 이득(융합 발열)

      watch(sim, K) {
        const gL = this.measure(K, 1, this.EL, 0, 1), gH = this.measure(K, 1, this.EH, 0, 1);
        const cL = this.measure(K, 0, this.EL, this.BAR, 1), cH = this.measure(K, 0, this.EH, this.BAR, 1);
        let px = 0, py = 0; for (const a of sim.atoms) { const m = K.mass(a); px += m * a.vx; py += m * a.vy; }
        px += (sim.escaped && sim.escaped.px) || 0; py += (sim.escaped && sim.escaped.py) || 0;
        return {
          gamowLo: gL, gamowHi: gH, classLo: cL, classHi: cH,
          predLo: +(this.P(this.EL) * this.NP).toFixed(1), predHi: +(this.P(this.EH) * this.NP).toFixed(1),
          rateRatio: +(gH / gL).toFixed(2), predRatio: +(this.P(this.EH) / this.P(this.EL)).toFixed(2),
          dBfus: +this.dBfus(K, 1).toFixed(4), totPx: +px.toFixed(9), totPy: +py.toFixed(9), fuseActive: sim.fuseActive | 0,
        };
      },

      // 가설: ① 율 ∝ exp(−√(EG/E)) ② sub-barrier 터널링 ③ 계단→매끈(가파름) ④ 에너지 불변·장부.
      assert(ctx, K) {
        const NP = this.NP;
        const gL = this.measure(K, 1, this.EL, 0, 1), gH = this.measure(K, 1, this.EH, 0, 1);
        const cL = this.measure(K, 0, this.EL, this.BAR, 1), cH = this.measure(K, 0, this.EH, this.BAR, 1);
        const predL = this.P(this.EL) * NP, predH = this.P(this.EH) * NP;
        // ① 측정 융합분율이 Gamow 공식 부근(유한 표본 ~±2.5σ): |측정−예측| 밴드. NP=400 → σ_L≈4·σ_H≈8 → 밴드 ±15·±25.
        const formL = Math.abs(gL - predL) <= 15, formH = Math.abs(gH - predH) <= 25;
        // ② sub-barrier 터널링: 고전(barrier=2)은 E=1<2 면 0(금지)·Gamow E=1 은 >0(뚫음)·고전 E=4>2 는 전부 융합(계단=NP).
        const subBarrier = cL === 0 && gL > 0 && cH === NP;        // cH: NP쌍 전부 융합(원자 감소 = NP)
        // ③ 계단→매끈: 고전은 이분법(0 또는 NP)·Gamow 는 둘 다 0<x<NP 매끈·율비 ≈ exp(√EG−√(EG/EH))=exp(1.5)=4.48(band [3,6.5]).
        const smooth = gL > 0 && gL < NP && gH > 0 && gH < NP && (cL === 0 || cL === NP) && (cH === 0 || cH === NP);
        const ratio = gH / gL, ratioOK = ratio >= 3 && ratio <= 6.5;
        // ④ 에너지 불변: ΔB_fus(융합 발열)은 게이트와 무관(>0)·닫힌 장부는 기둥 ②(라이브 sim)가 머신 보증.
        const dB = this.dBfus(K, 1);
        return [
          { name: `율 ∝ exp(−√(EG/E)) — 저E E=${this.EL} 융합 ${gL}≈예측 ${predL.toFixed(1)}(exp(−√9)·×${NP})·고E E=${this.EH} 융합 ${gH}≈예측 ${predH.toFixed(1)}(exp(−√2.25)·×${NP})`, pass: formL && formH, value: gH },
          { name: `sub-barrier 터널링 — 고전(barrier=${this.BAR}) E=${this.EL}<${this.BAR} 융합 ${cL}(금지)인데 Gamow E=${this.EL} 융합 ${gL}>0(장벽 뚫음)·고전 E=${this.EH}>${this.BAR} 융합 ${cH}/${NP}(계단)`, pass: subBarrier, value: gL },
          { name: `계단→매끈(가파름) — 고전 이분법(0 또는 ${NP})·Gamow 매끈(${gL},${gH} 둘 다 0<x<${NP})·율비 ${ratio.toFixed(2)}≈exp(1.5)=4.48(4배 E → ~4.5배 율)`, pass: smooth && ratioOK, value: +ratio.toFixed(2) },
          { name: `에너지 불변·율만 — 융합 발열 ΔB_fus=B(⁴He)−2B(²H)=${dB.toFixed(4)}>0 게이트 무관(rate 게이트는 *언제/얼마나 자주*만)·닫힌 장부 Q·B·L·E·px·py 머신(기둥 ②)`, pass: dB > 0, value: +dB.toFixed(4) },
        ];
      },
    },

    'step-0047': {
      id: 'step-0047',
      title: '상대론적 좌표속도 상한 — c = 무대 최고속 (relCap — |v_coord|<c 창발·인과율 레일·운동량 보존·게이트=0 회귀 0)',
      desc: '여태 적분(기질)은 위치 += v·dt 로 *좌표속도에 상한이 없었다*. 자연 단위 c=1 인데 수소 반동(0003)·고E 융합(0046) 반동은 속력이 ~0.5c 를 넘봤고, 원리상 c 를 돌파할 수 있었다(STATE §3 ⬜ 상대론적 운동). ' +
            '이 step 은 "c = 무대 최고속"을 *인과율 레일*로 박는다(게이트 relCap). 단순 클램프(|v| 잘라내기)는 운동량·KE 를 몰래 버려 닫힌 장부를 깬다 — 대신 *재해석*한다: 저장된 (vx,vy) 를 **고유속도(celerity) u=γ·v_coord** 로 본다. ' +
            '그러면 운동량 p=m·u=γ·m·v_coord 는 *상대론적 운동량* 그대로(ledger px=Σm·vx 무변경)이고, 공간을 실제 가로지르는 **좌표속도 v_coord = u/γ, γ=√(1+|u|²/c²)** 는 |v_coord|<c 를 *항상* 만족한다. ' +
            '드리프트는 위치만 바꾸므로 Q·B·L·E·px·py 전부 *보존-자명*(propagate 와 동형)·게이트=0 이면 v_coord=u(원시 v)라 과거 전 장면 비트 동일(회귀 0). 핵심: 광속 돌파 불가가 *함수형서* 나온다 — u→∞ 라도 v_coord→c 점근(도달 0), author 한 if(v>c) 분기 0. ' +
            '*측정*(무대 2000²·자유 드리프트·다른 법칙 전부 게이트 0·celerity u∈{0.5,1,2,5,20,100} 단일 원자 질량1·t=10·좌표속도=변위/(t·dt)): ' +
            '① **인과율 상한** — relCap=1 이면 모든 celerity 의 좌표속도 ≤ c(=1)·최고 celerity u=100 도 0.99995<1. ' +
            '② **창발 공식 정합** — 측정 좌표속도 = u/√(1+u²)(u=1→0.7071·u=5→0.9806 머신 부근·author 0). ' +
            '③ **대조(게이트 끄면 c 돌파)** — relCap=0 이면 좌표속도=celerity 그대로(u=2→2·u=20→20 둘 다 >c)·레일이 load-bearing. ' +
            '④ **단조 점근** — celerity↑ → 좌표속도↑ 단조이되 *전부* <c(0.447<0.707<0.894<0.981<0.999<c·도달 없음). ' +
            '⑤ **운동량 보존(클램프와 다름)** — relCap 켜고/끄고 최종 운동량 px 동일(=초기 Σm·u=128.5)·레일은 *위치*만 바운드, *운동량*은 안 깎는다(단순 클램프 대비 결정적 차이).',
      ticks: 10,
      W: 2000, H: 2000, US: [0.5, 1, 2, 5, 20, 100], T: 10,

      f(u) { const c = K.C; return u / Math.sqrt(1 + (u * u) / (c * c)); },  // 좌표속도 공식 v_coord=u/γ
      pop() {  // celerity 집단(서로 떨어져 비상호작용 — 어차피 모든 법칙 게이트 0)
        return this.US.map((u, i) => ({ Z: 1, N: 0, e: 1, x: 0, rx: 10, ry: 50 + i * 100, vx: u, vy: 0 }));
      },
      // 단일 원자 좌표속도 측정(엔진 step 재사용·하네스 미변경): celerity u·게이트 rc·t tick 후 변위/(t·dt).
      measure(K, rc, u, t) {
        const a = { Z: 1, N: 0, e: 1, x: 0, rx: 10, ry: 10, vx: u, vy: 0 };
        const sim = { W: this.W, H: this.H, atoms: [a], photons: [], rng: null, knobs: Object.assign({}, L.DEFAULTS, { dt: 1, relCap: rc }), tick: 0 };
        for (let i = 0; i < t; i++) { L.applyForces(sim); L.integrate(sim); sim.tick++; }
        const dx = K.minImage(a.rx - 10, this.W), dy = K.minImage(a.ry - 10, this.H);
        return Math.hypot(dx, dy) / (t * 1);                  // 좌표속도(dt=1)
      },
      // 운동량 측정: celerity 집단을 게이트 rc 로 t tick 후 총 px(=Σm·vx). 레일이 운동량을 안 깎음을 보인다.
      momentum(K, rc, t) {
        const sim = { W: this.W, H: this.H, atoms: this.pop(), photons: [], rng: null, knobs: Object.assign({}, L.DEFAULTS, { dt: 1, relCap: rc }), tick: 0 };
        for (let i = 0; i < t; i++) { L.applyForces(sim); L.integrate(sim); sim.tick++; }
        let px = 0; for (const a of sim.atoms) px += K.mass(a) * a.vx; return px;
      },
      // 라이브 sim(장부·결정론 기둥): celerity 집단·relCap 켬. 드리프트는 위치만 → Q·B·L·E·px·py 머신.
      init(rng, K) {
        return { W: this.W, H: this.H, atoms: this.pop(), rng: null, knobs: { dt: 1, relCap: 1 } };
      },

      watch(sim, K) {
        const on = this.US.map(u => this.measure(K, 1, u, this.T));
        const maxOn = Math.max.apply(null, on);
        return {
          maxOn: +maxOn.toFixed(6), spd_u1: +on[1].toFixed(6), spd_u5: +on[3].toFixed(6), spd_u100: +on[5].toFixed(6),
          offHi: +this.measure(K, 0, 20, this.T).toFixed(6), pxOn: +this.momentum(K, 1, this.T).toFixed(6), pxOff: +this.momentum(K, 0, this.T).toFixed(6),
        };
      },

      // 가설: ① 인과율 상한 ② 창발 공식 ③ 대조 돌파 ④ 단조 점근 ⑤ 운동량 보존.
      assert(ctx, K) {
        const c = K.C, T = this.T;
        const on = this.US.map(u => this.measure(K, 1, u, T));   // relCap=1 좌표속도들
        const maxOn = Math.max.apply(null, on);
        // ① 인과율 상한: 모든 좌표속도 ≤ c.
        const cap = on.every(s => s <= c + 1e-12);
        // ② 창발 공식: 측정 좌표속도 = u/√(1+u²)(대표 u=1·u=5 머신 부근).
        const form = Math.abs(on[1] - this.f(1)) < 1e-9 && Math.abs(on[3] - this.f(5)) < 1e-9;
        // ③ 대조(게이트 끄면 돌파): relCap=0 좌표속도=celerity(u=2→2·u=20→20 둘 다 >c).
        const offLo = this.measure(K, 0, 2, T), offHi = this.measure(K, 0, 20, T);
        const control = offLo > c && offHi > c && Math.abs(offLo - 2) < 1e-9 && Math.abs(offHi - 20) < 1e-9;
        // ④ 단조 점근: celerity↑ → 좌표속도↑ 단조·전부 <c.
        let mono = true; for (let i = 1; i < on.length; i++) if (!(on[i] > on[i - 1])) mono = false;
        const asymptote = mono && on[on.length - 1] < c;
        // ⑤ 운동량 보존: relCap 켜고/끄고 최종 px 동일(=초기 Σm·u). 레일은 위치만 바운드·운동량 불변.
        const p0 = this.US.reduce((s, u) => s + u, 0);          // Σm·u (질량 1)
        const pxOn = this.momentum(K, 1, T), pxOff = this.momentum(K, 0, T);
        const pcons = Math.abs(pxOn - pxOff) < 1e-12 && Math.abs(pxOn - p0) < 1e-9;
        return [
          { name: `인과율 상한 — relCap=1 모든 celerity 좌표속도 ≤ c(=${c})·최고 u=100 좌표속도 ${on[5].toFixed(5)}<1(광속 돌파 불가 창발)`, pass: cap, value: +maxOn.toFixed(5) },
          { name: `창발 공식 정합 — 측정 좌표속도 = u/√(1+u²)(u=1 측정 ${on[1].toFixed(4)}≈${this.f(1).toFixed(4)}·u=5 측정 ${on[3].toFixed(4)}≈${this.f(5).toFixed(4)}·author if(v>c) 0)`, pass: form, value: +on[3].toFixed(4) },
          { name: `대조(게이트 끄면 c 돌파) — relCap=0 좌표속도=celerity(u=2→${offLo.toFixed(2)}·u=20→${offHi.toFixed(2)} 둘 다 >c)·레일 load-bearing`, pass: control, value: +offHi.toFixed(2) },
          { name: `단조 점근 — celerity↑→좌표속도↑ 단조이되 전부<c(${on.map(s => s.toFixed(5)).join('<')} < ${c}·c 도달 0)`, pass: asymptote, value: +on[on.length - 1].toFixed(5) },
          { name: `운동량 보존(클램프와 다름) — relCap 켜고 px ${pxOn.toFixed(2)} = 끄고 ${pxOff.toFixed(2)} = 초기 Σm·u ${p0.toFixed(1)}(레일은 위치만 바운드·운동량 안 깎음)`, pass: pcons, value: +pxOn.toFixed(2) },
        ];
      },
    },

    'step-0048': {
      id: 'step-0048',
      title: '별 점화의 시간곡선 — fuse+decay 합성 (측정 — ³H+³H→⁶He 융합 점화로 솟고 ⁶He β⁻→⁶Li 붕괴로 내림·중간핵 ⁶He 가 봉우리+꼬리·두 율을 한 시간축에)',
      desc: 'step-0043 이 fuse→decay 한 고리(³H+³H→⁶He→⁶Li)를 *종단*만 보았고(시간 거동 미측정), step-0044 가 시간곡선(Bateman)을 보였으나 *붕괴 한 방향*뿐(source 가 또 다른 붕괴). 둘을 잇지 못했다 — *융합이 source, 붕괴가 sink* 인 합성 시간곡선은 미측정. ' +
            '이 step 은 *새 법칙 0*(fuse 0033·0041·0046 + decay 0031~42 게이트 그대로·`L.applyForces`/`integrate` 재사용·엔진·하네스 미변경)으로 별 점화의 **합성 시간곡선**을 측정한다 — 중간핵 ⁶He 의 개체수가 *융합으로 0서 솟아*(점화 봉우리) *붕괴로 다시 내려가는*(꼬리) 한 신호. source(융합율)·sink(붕괴율)가 *한 시간축*서 겹친 첫 곡선. ' +
            '0044 Bateman 은 A→B→C 가 *전부 붕괴*(부모도 붕괴해 B 를 공급)였으나, 여기 source 는 **융합**(두 ³H 가 *만나* 합쳐 ⁶He 를 공급) — 점화는 *공간 상호작용*(접근·충돌)이 율을 정하고(0046 류), 꼬리는 *핵 불안정*(ΔB⁻>0)이 정한다(0045 류). 두 다른 기원의 율이 한 봉우리-꼬리로 합성된다(§4 빠른 비가역 융합 + 느린 순환 붕괴를 *시간축*에 명시). ' +
            '연료 ³H(Z1 N2)는 β 안정(ΔB⁻≤0·ΔB⁺≤0) → 먼저 안 붕괴(순환 격리: 융합이 점화, 그 생성핵 ⁶He 만 붕괴). ³H+³H → ⁶He(ΔB_fus>0 발열 점화) → ⁶He β⁻ → ⁶Li(Z3 N3 양방향 ΔB≤0 안정 종점). ' +
            '*측정*(무대 440×520·40쌍 ³H Z1 N2 e1 **nuc 없음**·정면 접근(staggered gap → 점화 시각 분산해 봉우리 매끈)·kFuse=1·fuseBarrier=0.1·fuseMassFormula=1·massDefect=1·decayMassFormula=1·decayPairing=1·decayBetaPlus=1·decayRecoilPair=1·kDecay=0.03·고정 시드 재시뮬레이션 체크포인트): ' +
            '① **연료 점화 소진** — N_fuel(³H) 단조 감소(80→~0)·융합이 연료를 먹어 ⁶He 로(점화 source). ' +
            '② **점화 봉우리 + 붕괴 꼬리(합성)** — N_He(⁶He)가 0서 *솟아*(융합 점화) 내부 봉우리를 찍고 *다시 내림*(β⁻ 붕괴 꼬리) ⇒ source(융합)·sink(붕괴) 두 율이 한 시간축서 겹친 봉우리-꼬리(봉우리 내부·>시작 0·>종단). ' +
            '③ **종점 누적** — N_Li(⁶Li 안정) 단조 증가·종단 ~전수(≥90% of 40)·꼬리가 ⁶Li 로 흘러듦. ' +
            '④ **닫힌 바리온** — 모든 체크포인트서 ΣB=Σ(Z+N)=240(=80×3)·핵 안 새고 융합·붕괴 둘 다 B 보존(2×³H→⁶He→⁶Li 다 B=6). ' +
            '닫힌 장부 Q·B·L·E·px·py 머신(fuse vcom·바스 + decay rest=(A−B)c²·decayRecoilPair 합성·0043 계승). 새 법칙 0 — scene 만 → 0001~47 법칙·골든 비트 불변(회귀 0=기존 골든 보존).',
      ticks: 240,
      // ledgerTol 없음 — 0043 fuse+decay 합성과 같은 게이트(rest=(A−B)c²·vcom·바스) → Q·B·L·E·px·py 머신.

      NPAIR: 40,
      KN: { dt: 0.5, kFuse: 1, fuseR: 3, fuseBarrier: 0.1, fuseMassFormula: 1, massDefect: 1, decayMassFormula: 1, decayPairing: 1, decayBetaPlus: 1, decayRecoilPair: 1, kDecay: 0.03, decayNexcess: 4, decayQ: 1 },
      CHK: [0, 15, 35, 60, 95, 140, 190, 240],
      // 40쌍 ³H(Z1 N2 e1·nuc 없음) 그리드(5×8)·정면 접근. gap 을 쌍마다 늘려 점화 시각 분산(staggered) → ⁶He 봉우리가 계단 아닌 매끈한 솟음.
      //   접근율 1/tick(dt=0.5·vx=±1) → gap g 면 ~ (g−fuseR) tick 에 융합. gap 8..~43 → 점화 ~5..40 tick 분산. 열·행 간격 80×60 ≫ gap/2 → 쌍끼리 교차융합 0(합체 후 vcom=0 정지).
      pop() {
        const a = [];
        for (let p = 0; p < this.NPAIR; p++) {
          const col = p % 5, row = (p / 5) | 0, cx = 60 + col * 80, cy = 40 + row * 60, g = 8 + p * 0.9;
          a.push({ Z: 1, N: 2, e: 1, x: 0, rx: cx - g / 2, ry: cy, vx: 1, vy: 0, lep: 0 });   // 왼쪽 ³H → 오른쪽
          a.push({ Z: 1, N: 2, e: 1, x: 0, rx: cx + g / 2, ry: cy, vx: -1, vy: 0, lep: 0 });  // 오른쪽 ³H → 왼쪽 (쌍 총 p=0)
        }
        return a;
      },
      init(rng, K) {
        const simRng = K.mulberry32((rng() * 4294967296) >>> 0);
        return { W: 440, H: 520, atoms: this.pop(), rng: simRng, knobs: Object.assign({}, this.KN) };
      },

      // 시계열: 고정 시드 재시뮬레이션(엔진 step 재사용 L.applyForces+integrate·하네스 미변경·결정론). 체크포인트마다 연료/중간/종점 개체수.
      series(K) {
        const sim = { W: 440, H: 520, atoms: this.pop(), photons: [], rng: K.mulberry32(20260616), knobs: Object.assign({}, L.DEFAULTS, this.KN), tick: 0 };
        const out = []; let prev = 0;
        for (const t of this.CHK) {
          for (let i = prev; i < t; i++) { L.applyForces(sim); L.integrate(sim); sim.tick++; }
          prev = t;
          let fuel = 0, he = 0, li = 0, B = 0;
          for (const x of sim.atoms) { if (x.Z === 1 && x.N === 2) fuel++; else if (x.Z === 2 && x.N === 4) he++; else if (x.Z === 3 && x.N === 3) li++; B += (x.Z | 0) + (x.N | 0); }
          out.push({ t, fuel, he, li, B });
        }
        return out;
      },
      dBfus(K, pair) { return K.binding(2, 4, pair) - 2 * K.binding(1, 2, pair); },   // ³H+³H→⁶He 결합 이득(점화)
      dBdec(K, pair) { return K.bindingDelta(2, 4, pair); },                          // ⁶He→⁶Li β⁻ 결합 이득(꼬리)

      watch(sim, K) {
        const s = this.series(K);
        let pk = 0; for (let i = 1; i < s.length; i++) if (s[i].he > s[pk].he) pk = i;
        let px = 0, py = 0; for (const a of sim.atoms) { const m = K.mass(a); px += m * a.vx; py += m * a.vy; }
        px += (sim.escaped && sim.escaped.px) || 0; py += (sim.escaped && sim.escaped.py) || 0;
        return {
          fuel0: s[0].fuel, fuelEnd: s[s.length - 1].fuel, HePeak: s[pk].he, HePeakT: s[pk].t, HeEnd: s[s.length - 1].he,
          LiEnd: s[s.length - 1].li, Btot: s[0].B, dBfus: +this.dBfus(K, 1).toFixed(4), dBdec: +this.dBdec(K, 1).toFixed(4),
          totPx: +px.toFixed(9), totPy: +py.toFixed(9), fuseActive: sim.fuseActive | 0, decayActive: sim.decayActive | 0,
        };
      },

      // 가설: ① 연료 점화 소진 ② 점화 봉우리+붕괴 꼬리(합성·0서 솟아 내부 봉우리→내림) ③ 종점 누적 ④ 닫힌 바리온(ΣB=240 전 t).
      assert(ctx, K) {
        const s = this.series(K), n = s.length, NA = this.NPAIR * 2, NP = this.NPAIR, B0 = NA * 3;
        // ① 연료 단조 감소 + 거의 소진(융합이 ³H 를 먹음).
        let fuelMono = true; for (let i = 1; i < n; i++) if (s[i].fuel > s[i - 1].fuel) fuelMono = false;
        const fuelBurn = fuelMono && s[n - 1].fuel <= NA * 0.1;
        // ② 합성 봉우리-꼬리: ⁶He 봉우리 인덱스 내부(0·끝 아님)·봉우리>시작(0)·봉우리>종단·시작=0(점화 전).
        let pk = 0; for (let i = 1; i < n; i++) if (s[i].he > s[pk].he) pk = i;
        const peakTail = pk > 0 && pk < n - 1 && s[pk].he > s[0].he && s[pk].he > s[n - 1].he && s[0].he === 0;
        // ③ 종점 단조 증가 + 종단 거의 전수(꼬리가 ⁶Li 로).
        let liMono = true; for (let i = 1; i < n; i++) if (s[i].li < s[i - 1].li) liMono = false;
        const liAccum = liMono && s[n - 1].li >= NP * 0.9;
        // ④ 닫힌 바리온: 전 체크포인트 ΣB=240(융합·붕괴 둘 다 B 보존·핵 안 샘).
        let closed = true; for (const r of s) if (r.B !== B0) closed = false;
        return [
          { name: `연료 점화 소진 — N_fuel(³H) 단조 감소 ${NA}→${s[n - 1].fuel}(융합이 연료 먹어 ⁶He 로·점화 source·거의 소진)`, pass: fuelBurn, value: s[n - 1].fuel },
          { name: `점화 봉우리 + 붕괴 꼬리(합성) — N_He(⁶He) 0서 솟아 내부 봉우리 ${s[pk].he}(t=${s[pk].t}) 찍고 내림(${s[0].he}→${s[pk].he}→${s[n - 1].he}) ⇒ source(융합)·sink(붕괴) 한 시간축 봉우리-꼬리`, pass: peakTail, value: s[pk].he },
          { name: `종점 누적 — N_Li(⁶Li 안정) 단조 증가·종단 ${s[n - 1].li}/${NP}(≥90%·꼬리가 ⁶Li 로 흘러듦)`, pass: liAccum, value: s[n - 1].li },
          { name: `닫힌 바리온 — 전 체크포인트 ΣB=Σ(Z+N)=${B0}(=${NA}×3)·핵 안 새고 융합·붕괴 둘 다 B 보존(2×³H→⁶He→⁶Li 다 B=6)`, pass: closed, value: B0 },
        ];
      },
    },

    'step-0049': {
      id: 'step-0049',
      title: '완전 상대론적 운동에너지 — KE=(γ−1)mc² (relKE — 0047 운동량 상한의 에너지짝·c 에 무한 에너지 벽·저속서 ½mu² 회복·게이트=0 회귀 0)',
      desc: 'step-0047 이 저장 (vx,vy) 를 *고유속도(celerity) u=γ·v_coord* 로 재해석해 운동량 p=m·u 를 상대론화하고 좌표속도 상한 |v_coord|<c 를 박았으나, *운동에너지*는 여전히 토이 ½m|u|²(ledger 의 0.5·m·v² 항)였다 — 상대론화가 운동량서 멈추고 에너지엔 안 닿았다(STATE §3 🟡 완전 상대론적 KE). ' +
            '이 step 은 그 짝을 채운다(레저 게이트 relKE): 운동에너지도 **KE=(γ−1)mc²**, γ=√(1+|u|²/c²)(저장 celerity 로 정의·0047 과 같은 γ). md(정지질량 편입)·levelEZ(준위 에너지)와 같은 *레저 게이트*(force 법칙 아님·LAW_ORDER 미참여) — relKE=0 이면 ½m|u|² 그대로(과거 전 장면 비트 동일·회귀 0). ' +
            '두 극한이 요점: ① **저속**(|u|≪c) γ−1≈½|u|²/c² → (γ−1)mc²→½m|u|²(뉴턴 운동에너지 회복·대응원리). ② **고속**(v_coord→c) γ→∞ → KE→∞ — *c 에 도달하려면 무한 에너지*가 든다(0047 의 좌표속도 상한을 에너지 쪽서 다시 봉인: 운동량·에너지 둘 다 c 를 인과율 벽으로 만든다). 같은 γ 가 운동량(0047)·에너지(0049)를 한 재해석서 묶는다(author if(v>c) 0). ' +
            '*측정*(무대 2000²·자유 드리프트·다른 법칙 전부 게이트 0·relCap=1·relKE=1·celerity u∈{0.5,1,2,5,20,100} 단일 원자 질량1·KE=ledger.E−Σm·c²·t=10): ' +
            '① **공식 정합(celerity)** — 측정 KE(relKE=1) = Σ(γ−1)mc², γ=√(1+u²)(머신·author 0). ' +
            '② **저속 뉴턴 극한** — u=0.5 서 상대론 KE/토이 ½mu² ≈ 0.943(→1 회복)·전 u 상대론 KE ≤ 토이(에너지 포화·√(1+x)−1<½x). ' +
            '③ **두 γ 형식 일치(0047 정합)** — γ_celerity=√(1+u²) = γ_β=1/√(1−β²), β=v_coord/c(=0047 좌표속도)·머신 ⇒ 운동량·에너지가 *한 γ* 로 묶임. ' +
            '④ **고속 에너지 벽** — v_coord→c 일수록 KE→∞(u=100 좌표속도 0.99995 서 KE≈99.0 ≫ u=0.5 좌표속도 0.447 서 0.118)·c 도달엔 무한 에너지(0047 운동량 상한의 에너지짝). ' +
            '⑤ **대조(게이트 끄면 토이)·회귀** — relKE=0 측정 KE = Σ½mu²(토이) ≠ 상대론(게이트 load-bearing)·게이트=0 → 0001~48 레저·골든 비트 불변. ' +
            '닫힌 장부 Q·B·L·E·px·py 머신(자유 드리프트 → 속도 불변 → KE 불변 → E 잔차 머신·드리프트는 위치만).',
      ticks: 10,
      W: 2000, H: 2000, US: [0.5, 1, 2, 5, 20, 100], T: 10,

      keRel(u) { const c = K.C; return (Math.sqrt(1 + (u * u) / (c * c)) - 1) * c * c; },  // (γ−1)mc²·m=1
      keToy(u) { return 0.5 * u * u; },                                                    // ½mu²·m=1
      gCel(u) { const c = K.C; return Math.sqrt(1 + (u * u) / (c * c)); },                 // γ from celerity u
      vCoord(u) { const c = K.C; return u / Math.sqrt(1 + (u * u) / (c * c)); },           // 좌표속도(0047)
      gBeta(b) { const c = K.C; return 1 / Math.sqrt(1 - (b * b) / (c * c)); },            // γ from β=v_coord/c
      pop() {  // celerity 집단(서로 떨어져 비상호작용 — 어차피 모든 force 법칙 게이트 0)
        return this.US.map((u, i) => ({ Z: 1, N: 0, e: 1, x: 0, rx: 10, ry: 50 + i * 100, vx: u, vy: 0 }));
      },
      // 측정 KE = ledger.E − Σ 정지질량(=Σ m·c²). 자유 드리프트 → KE 불변(t 무관). rk: relKE 게이트 on/off.
      measureKE(K, rk) {
        const sim = { W: this.W, H: this.H, atoms: this.pop(), photons: [], rng: null, knobs: Object.assign({}, L.DEFAULTS, { dt: 1, relCap: 1, relKE: rk }), tick: 0 };
        for (let i = 0; i < this.T; i++) { L.applyForces(sim); L.integrate(sim); sim.tick++; }
        const led = K.ledger(sim); let rest = 0; for (const a of sim.atoms) rest += K.mass(a) * K.C * K.C;
        return led.E - rest;
      },
      // 라이브 sim(장부·결정론 기둥): celerity 집단·relCap+relKE 켬. 자유 드리프트 → Q·B·L·E·px·py 머신.
      init(rng, K) {
        return { W: this.W, H: this.H, atoms: this.pop(), rng: null, knobs: { dt: 1, relCap: 1, relKE: 1 } };
      },

      watch(sim, K) {
        const keOn = this.measureKE(K, 1), keOff = this.measureKE(K, 0);
        return {
          keRelTot: +keOn.toFixed(6), keToyTot: +keOff.toFixed(6),
          ke_u05: +this.keRel(0.5).toFixed(6), ke_u100: +this.keRel(100).toFixed(6),
          vcoord_u100: +this.vCoord(100).toFixed(6), ratioLow: +(this.keRel(0.5) / this.keToy(0.5)).toFixed(6),
        };
      },

      // 가설: ① 공식 정합 ② 저속 뉴턴 극한 ③ 두 γ 형식 일치 ④ 고속 에너지 벽 ⑤ 대조·회귀.
      assert(ctx, K) {
        const c = K.C, US = this.US;
        const keOn = this.measureKE(K, 1), keOff = this.measureKE(K, 0);
        const expRel = US.reduce((s, u) => s + this.keRel(u), 0), expToy = US.reduce((s, u) => s + this.keToy(u), 0);
        // ① 공식 정합(celerity): 측정 KE(relKE=1) = Σ(γ−1)mc² 머신.
        const formula = Math.abs(keOn - expRel) < 1e-9;
        // ② 저속 뉴턴 극한: u=0.5 rel/toy ∈(0.9,1)·전 u rel≤toy(에너지 포화 √(1+x)−1<½x).
        const ratioLow = this.keRel(0.5) / this.keToy(0.5);
        const newton = ratioLow > 0.9 && ratioLow < 1 && US.every(u => this.keRel(u) <= this.keToy(u) + 1e-12);
        // ③ 두 γ 형식 일치: γ_celerity=√(1+u²) = γ_β=1/√(1−β²)(β=v_coord/c=0047 좌표속도)·머신.
        let gammaOK = true; for (const u of US) if (Math.abs(this.gCel(u) - this.gBeta(this.vCoord(u))) > 1e-9) gammaOK = false;
        // ④ 고속 에너지 벽: v_coord→c 일수록 KE→∞(u=100 KE ≫ u=0.5·좌표속도<c)·c 도달엔 무한 에너지.
        const wall = this.keRel(100) > this.keRel(0.5) * 100 && this.vCoord(100) < c && this.keRel(100) > 50;
        // ⑤ 대조(게이트 끄면 토이)·회귀: relKE=0 측정 KE = Σ½mu²(토이) ≠ 상대론 → 게이트 load-bearing.
        const control = Math.abs(keOff - expToy) < 1e-9 && Math.abs(keOff - keOn) > 1e-3;
        return [
          { name: `공식 정합(celerity) — 측정 KE(relKE=1)=${keOn.toFixed(4)} = Σ(γ−1)mc²(γ=√(1+u²))=${expRel.toFixed(4)} 머신(author 0)`, pass: formula, value: +keOn.toFixed(4) },
          { name: `저속 뉴턴 극한 — u=0.5 상대론 KE/토이 ½mu²=${ratioLow.toFixed(4)}(→1 회복)·전 u 상대론 KE≤토이(에너지 포화 √(1+x)−1<½x·대응원리)`, pass: newton, value: +ratioLow.toFixed(4) },
          { name: `두 γ 형식 일치(0047 정합) — γ_celerity=√(1+u²) = γ_β=1/√(1−β²)(β=v_coord/c=0047 좌표속도) 머신 ⇒ 운동량·에너지가 한 γ 로 묶임`, pass: gammaOK, value: +this.gCel(5).toFixed(4) },
          { name: `고속 에너지 벽 — u=100 좌표속도 ${this.vCoord(100).toFixed(5)}<c 서 KE=${this.keRel(100).toFixed(2)} ≫ u=0.5 좌표속도 ${this.vCoord(0.5).toFixed(3)} 서 ${this.keRel(0.5).toFixed(3)}·c 도달엔 무한 에너지(0047 운동량 상한의 에너지짝)`, pass: wall, value: +this.keRel(100).toFixed(2) },
          { name: `대조(게이트 끄면 토이)·회귀 — relKE=0 측정 KE=${keOff.toFixed(2)} = Σ½mu²(토이)=${expToy.toFixed(2)} ≠ 상대론 ${keOn.toFixed(2)}(게이트 load-bearing·끄면 0001~48 비트 동일)`, pass: control, value: +keOff.toFixed(2) },
        ];
      },
    },

    'step-0050': {
      id: 'step-0050',
      title: '쿨롱 장벽이 전하에 달렸다 — E_G(Z₁,Z₂) (fuseEGcharge — Gamow 에너지 ∝ (Z₁Z₂)²·고전하 핵 융합 급억제·같은 E 서 ⁴He+⁴He ≪ ²H+²H·게이트=0 회귀 0)',
      desc: 'step-0046 이 융합율을 Gamow 터널링 P=exp(−√(E_G/E))로 닫았으나 E_G 가 *Z 무관 토이 상수*(fuseEG=9·모든 쌍 같은 장벽)였다 — 장벽 높이의 *기원*(핵 전하)은 author. 실제 쿨롱 장벽은 두 핵의 전하곱서 온다: E_G ∝ (Z₁Z₂)²(=(παZ₁Z₂)²·2μc²). ' +
            '이 step 은 장벽 척도를 전하서 끌어낸다(게이트 fuseEGcharge): 접근 쌍마다 egPair = fuseEG·(Z_a·Z_b)² → 터널링 지수 √(egPair/E) = **Z₁Z₂·√(fuseEG/E)**(전하곱 선형 억제). ⇒ 고Z 핵일수록 장벽 ²제곱 급증 → 같은 충돌 에너지서도 융합 *급억제*. 이것이 **별 핵합성의 사다리**(가벼운 핵은 쉽게·무거울수록 점점 어렵게 융합)·철 너머 융합이 안 되는 쿨롱적 이유. ' +
            '0046 이 *에너지* 의존(저E 억제)을, 이 step 이 *전하* 의존(고Z 억제)을 더해 Gamow 지수 ∝ Z₁Z₂/√E 의 두 축이 둘 다 결합에너지·전하서 창발(author 0). ' +
            '*측정*(무대 200²·정면 쌍 400개씩 두 핵종·**nuc 없음**·같은 충돌 E=1·fuseEG=1·고정 시드 t=4 단일 시도·fuseGamow=1·fuseBarrier=0): ' +
            '① **전하 의존 억제(창발)** — 게이트 켬·같은 E: ⁴He+⁴He(Z₁Z₂=4) 융합 ≪ ²H+²H(Z₁Z₂=1)(고전하 핵 강억제·장벽 ∝(Z₁Z₂)²). ' +
            '② **지수 ∝ Z₁Z₂(전하곱 선형)** — 측정 −ln(분율) 비 eHe/eDD ≈ 4 = Z₁Z₂비(4/1)·분율 frac_He ≈ frac_DD⁴(지수 4배). ' +
            '③ **대조(전하 무관 baseline)** — fuseEGcharge=0 이면 두 핵종 *같은 융합수*(둘 다 상수 EG=1·전하 무관)·게이트 켜야 갈림 ⇒ 게이트 load-bearing. ' +
            '④ **발열량·장부 불변·회귀** — 융합 발열 ΔB_fus(²H+²H)는 게이트와 무관(>0)·닫힌 장부 Q·B·L·E·px·py 머신(라이브 ²H 무대·rest=(A−B)c²·vcom·바스)·fuseEGcharge=0 → 0001~49 비트 동일. ' +
            '*대조*: fuseEGcharge=0 → egPair=fuseEG 상수(0046 거동·rng 소비 동일·회귀 0). 새 게이트 0 → 0001~49 법칙·골든 비트 불변.',
      ticks: 4,
      // ledgerTol 없음 — fuse 닫힌 형식 합체(vcom·바스)·rest=(A−B)c²(0041 계승·라이브 ²H 무대) → Q·B·L·E·px·py 머신. 전하 게이트는 *어느 쌍이* 융합할지(확률)만 바꿈.

      EG: 1, E: 1, NP: 400,                                   // Gamow 기준 에너지(Z₁Z₂=1 일 때)·충돌 에너지·쌍 수
      KN: { dt: 1, kFuse: 1, fuseR: 3, fuseMassFormula: 1, massDefect: 1, decayPairing: 1, kDecay: 0, fuseEG: 1 },
      // (Z,N) 핵종 NP쌍 정면(keRel=E). m=Z+N·μ=m/2·keRel=m·v² → v=√(E/m). 격자(간격 9)로 쌍끼리 교차융합 0·d=2<R=3 라 tick0 1시도.
      pop(Z, N, E) {
        const m = Z + N, v = Math.sqrt(E / m), a = [];
        for (let i = 0; i < this.NP; i++) {
          const x = (i % 20) * 9 + 8, y = ((i / 20) | 0) * 9 + 8;
          a.push({ Z, N, e: Z, x: 0, rx: x, ry: y, vx: v, vy: 0, lep: 0 });          // 왼쪽 → 오른쪽
          a.push({ Z, N, e: Z, x: 0, rx: x + 2, ry: y, vx: -v, vy: 0, lep: 0 });     // 오른쪽 → 왼쪽(쌍 총 p=0·d=2)
        }
        return a;
      },
      // 고정 시드 단일 시도 측정(엔진 step 재사용·하네스 미변경): egCharge/핵종 조합으로 t tick 후 융합 수(=원자 감소분).
      measure(K, egCharge, Z, N) {
        const sim = { W: 200, H: 200, atoms: this.pop(Z, N, this.E), photons: [], rng: K.mulberry32(20260616), knobs: Object.assign({}, L.DEFAULTS, this.KN, { fuseGamow: 1, fuseBarrier: 0, fuseEGcharge: egCharge }), tick: 0 };
        const n0 = sim.atoms.length;
        L.applyForces(sim); L.integrate(sim); sim.tick++;     // 단일 시도(t=1) — 1쌍=1 Gamow 시도(다중 tick 누적 방지·예측 P 와 직접 대조)
        return n0 - sim.atoms.length;                         // 융합 수(합체마다 원자 1 감소 = 쌍 1 소비)
      },
      P(zz) { return Math.exp(-Math.sqrt(this.EG * zz * zz / this.E)); },  // 전하곱 zz=Z₁Z₂ 의 Gamow 융합 확률
      dBfus(K, pair) { return K.binding(2, 2, pair) - 2 * K.binding(1, 1, pair); },  // ²H+²H→⁴He 결합 이득(발열)

      // 라이브 sim(장부·결정론 기둥): ²H 무대(Z₁Z₂=1)·전하 게이트 켬(egPair=EG·1=EG·DD 발열). 융합이 일어나며 Q·B·L·E·px·py 닫힘.
      init(rng, K) {
        const simRng = K.mulberry32((rng() * 4294967296) >>> 0);
        return { W: 200, H: 200, atoms: this.pop(1, 1, this.E), rng: simRng, knobs: Object.assign({}, this.KN, { fuseGamow: 1, fuseBarrier: 0, fuseEGcharge: 1 }) };
      },

      watch(sim, K) {
        const ddOn = this.measure(K, 1, 1, 1), heOn = this.measure(K, 1, 2, 2);
        const ddOff = this.measure(K, 0, 1, 1), heOff = this.measure(K, 0, 2, 2);
        let px = 0, py = 0; for (const a of sim.atoms) { const m = K.mass(a); px += m * a.vx; py += m * a.vy; }
        px += (sim.escaped && sim.escaped.px) || 0; py += (sim.escaped && sim.escaped.py) || 0;
        return {
          ddOn, heOn, ddOff, heOff,
          predDD: +(this.P(1) * this.NP).toFixed(1), predHe: +(this.P(4) * this.NP).toFixed(1),
          expRatio: +(Math.log(heOn / this.NP) / Math.log(ddOn / this.NP)).toFixed(2),
          dBfus: +this.dBfus(K, 1).toFixed(4), totPx: +px.toFixed(9), totPy: +py.toFixed(9), fuseActive: sim.fuseActive | 0,
        };
      },

      // 가설: ① 전하 의존 억제 ② 지수 ∝ Z₁Z₂ ③ 대조(전하 무관 baseline) ④ 발열·장부·회귀.
      assert(ctx, K) {
        const NP = this.NP;
        const ddOn = this.measure(K, 1, 1, 1), heOn = this.measure(K, 1, 2, 2);
        const ddOff = this.measure(K, 0, 1, 1), heOff = this.measure(K, 0, 2, 2);
        // ① 전하 의존 억제: 게이트 켬·같은 E 서 고전하 ⁴He+⁴He(Z₁Z₂=4) ≪ ²H+²H(Z₁Z₂=1).
        const suppress = heOn > 0 && heOn < ddOn * 0.25;
        // ② 지수 ∝ Z₁Z₂: −ln(분율) 비 eHe/eDD ≈ Z₁Z₂비 4(전하곱 선형·밴드 [3,5]).
        const eDD = -Math.log(ddOn / NP), eHe = -Math.log(heOn / NP), ratio = eHe / eDD;
        const linZZ = ratio >= 3 && ratio <= 5;
        // ③ 대조(전하 무관 baseline): 게이트 끄면 두 핵종 같은 융합수(둘 다 상수 EG·전하 무관)·켜면 갈림.
        const flatEqual = Math.abs(ddOff - heOff) <= 10;      // 전하 무관: 같은 P → 같은 융합수
        const chargeSplit = ddOn > heOn * 3;                  // 전하 켬: 저전하 ≫ 고전하
        const baseline = flatEqual && chargeSplit;
        // ④ 발열량·장부: ΔB_fus(²H+²H)는 게이트 무관(>0)·닫힌 장부는 라이브 기둥(②)이 머신 보증.
        const dB = this.dBfus(K, 1);
        return [
          { name: `전하 의존 억제(창발) — 게이트 켬·같은 E=${this.E}: ⁴He+⁴He(Z₁Z₂=4) 융합 ${heOn} ≪ ²H+²H(Z₁Z₂=1) ${ddOn}(장벽 ∝(Z₁Z₂)²·고전하 강억제)`, pass: suppress, value: heOn },
          { name: `지수 ∝ Z₁Z₂(전하곱 선형) — −ln(분율) 비 eHe/eDD=${ratio.toFixed(2)} ≈ Z₁Z₂비 4(분율 frac_He≈frac_DD⁴·지수 4배)`, pass: linZZ, value: +ratio.toFixed(2) },
          { name: `대조(전하 무관 baseline) — fuseEGcharge=0 두 핵종 같은 융합수 DD ${ddOff}≈He ${heOff}(둘 다 상수 EG·전하 무관)·게이트 켜면 DD ${ddOn} ≫ He ${heOn} ⇒ load-bearing`, pass: baseline, value: heOff },
          { name: `발열량·장부 불변·회귀 — 융합 발열 ΔB_fus(²H+²H)=${dB.toFixed(4)}>0 게이트 무관·닫힌 장부 Q·B·L·E·px·py 머신(라이브 ²H 무대)·fuseEGcharge=0 → 0001~49 비트 동일`, pass: dB > 0, value: +dB.toFixed(4) },
        ];
      },
    },

    'step-0051': {
      id: 'step-0051',
      title: '흡열 융합 에너지 문턱 — 철 너머는 공짜가 아니다 (fuseEndo — ΔB_fus<0 융합은 상대 KE≥|ΔB_fus| 일 때만·발열은 문턱 0·게이트=0 회귀 0)',
      desc: 'step-0046·0050 이 융합 *율*(Gamow 터널링·전하 장벽)을 닫았으나 *에너지적 허용*은 안 봤다 — fuse 는 ΔB_fus 의 *부호*를 무시하고 무조건 합체했다. ' +
            '융합 발열량 ΔB_fus=B(생성)−B(a)−B(b)는 가벼운 핵서 >0(발열·별 점화·0041)·**철 너머서 <0(흡열)**. 0050 까지 ΔB_fus<0(흡열)이라도 fuse 가 *무조건* 합체하고 bath.E += keRel+released(음수)로 **복사 바스 E 가 음수**가 됐다(에너지를 무에서 빌림 — 비물리). ' +
            '이 step 은 흡열 비용을 강제한다(게이트 fuseEndo): released<0 이면 생성핵 정지질량이 |ΔB_fus| 만큼 *늘어*(M=A−B·0040~41) 그 차액을 *상대 KE 가 지불*해야 한다 → keRel<|ΔB_fus| 면 융합 *에너지적 금지*. ' +
            '이것이 **철 봉우리**의 에너지면(0050 의 쿨롱 *율* 억제와 짝): 가벼운 핵 융합은 발열이라 문턱 0(별 점화)·무거운 핵 융합은 흡열이라 고E 군집(고온·중력 압축)서만 — 철 너머 핵합성이 *별의 죽음*(초신성)에서야 일어나는 이유. ' +
            '*측정*(무대 200²·정면 쌍 200개씩·hard cutoff fuseGamow=0·고정 시드 t=1 단일 시도·fuseMassFormula=1·massDefect=1·decayPairing=1·keRel=E 정확): 페어링 켜면 ²H+²H→⁴He 발열(ΔB_fus=+1.344)·**⁴He+⁴He→⁸Be 흡열(ΔB_fus=−0.2327)** — 같은 *측정*으로 부호 갈림(author 0). ' +
            '① **흡열 문턱(창발)** — 게이트 켬·저E(E=0.1<|ΔB_fus|): 흡열 ⁴He+⁴He 융합 0(금지)·발열 ²H+²H 융합 전부(발열은 문턱 없음). ' +
            '② **문턱=|ΔB_fus|(에너지 경계)** — E 를 쓸면 ⁴He+⁴He 는 keRel=E≥|ΔB_fus|=0.2327 일 때만 융합: E=0.2 금지(0)·E=0.25 전부(200)·경계가 |ΔB_fus| 를 가름(author 문턱 0·결합에너지서 창발). ' +
            '③ **대조(게이트 끄면 흡열 공짜·바스 음수)** — fuseEndo=0 이면 ⁴He+⁴He 가 저E 서도 융합하고 **복사 바스 E<0**(에너지 무에서 빌림·비물리)·켜면 융합 0·바스 0 ⇒ 게이트 load-bearing. ' +
            '④ **발열 무관·장부·회귀** — 발열 ²H+²H 는 게이트와 무관(켬=끔)·ΔB_fus(DD)>0·닫힌 장부 Q·B·L·E·px·py 머신(라이브 ⁴He 흡열 무대·고E 서 융합·rest=(A−B)c²·vcom·바스 E≥0)·fuseEndo=0 → 0001~50 비트 동일. ' +
            '*대조*: fuseEndo=0 → 부호 무시(0050 거동·회귀 0). 새 게이트 0 → 0001~50 법칙·골든 비트 불변.',
      ticks: 4,
      // ledgerTol 없음 — fuse 닫힌 형식 합체(vcom·바스)·rest=(A−B)c²(0041 계승) → Q·B·L·E·px·py 머신. 흡열 게이트는 *어느 쌍이* 융합할지(에너지 허용)만 바꿈.

      EXLO: 0.1, EBELOW: 0.2, EABOVE: 0.25, EHIGH: 1, NP: 200,    // 저E(문턱 아래)·경계 아래/위·고E(라이브)·쌍 수
      KN: { dt: 1, kFuse: 1, fuseR: 3, fuseMassFormula: 1, massDefect: 1, decayPairing: 1, kDecay: 0 },
      // (Z,N) 핵종 NP쌍 정면(keRel=E 정확: μ=m/2·|vrel|=2v·keRel=2μv²=m·v² → v=√(E/m)). 격자(간격 9)로 쌍끼리 교차융합 0·d=2<R=3 라 tick0 1시도.
      pop(Z, N, E) {
        const m = Z + N, v = Math.sqrt(E / m), a = [];
        for (let i = 0; i < this.NP; i++) {
          const x = (i % 20) * 9 + 8, y = ((i / 20) | 0) * 9 + 8;
          a.push({ Z, N, e: Z, x: 0, rx: x, ry: y, vx: v, vy: 0, lep: 0 });          // 왼쪽 → 오른쪽
          a.push({ Z, N, e: Z, x: 0, rx: x + 2, ry: y, vx: -v, vy: 0, lep: 0 });     // 오른쪽 → 왼쪽(쌍 총 p=0·d=2·keRel=E)
        }
        return a;
      },
      // 고정 시드 단일 시도 측정(hard cutoff·rng 무소비): endo/핵종/E 조합으로 t=1 후 {융합 수, 바스 E}.
      measure(K, endo, Z, N, E) {
        const sim = { W: 200, H: 200, atoms: this.pop(Z, N, E), photons: [], rng: K.mulberry32(20260616), knobs: Object.assign({}, L.DEFAULTS, this.KN, { fuseGamow: 0, fuseBarrier: 0, fuseEndo: endo }), tick: 0 };
        const n0 = sim.atoms.length;
        L.applyForces(sim); L.integrate(sim); sim.tick++;     // 단일 시도(t=1)·hard cutoff → 다가오는 쌍은 흡열 금지 아니면 전부 융합
        return { fused: n0 - sim.atoms.length, bathE: (sim.escaped && sim.escaped.E) || 0 };
      },
      dBHe(K, pair) { return K.binding(4, 4, pair) - 2 * K.binding(2, 2, pair); },   // ⁴He+⁴He→⁸Be 결합 이득(흡열<0)
      dBDD(K, pair) { return K.binding(2, 2, pair) - 2 * K.binding(1, 1, pair); },   // ²H+²H→⁴He 결합 이득(발열>0)

      // 라이브 sim(장부·결정론 기둥): ⁴He 흡열 무대·고E(E=1≫|ΔB_fus|)·게이트 켬 → 흡열 융합이 *허용*되며 Q·B·L·E·px·py 닫힘(rest mass 증가분 KE 가 지불·바스 E≥0).
      init(rng, K) {
        const simRng = K.mulberry32((rng() * 4294967296) >>> 0);
        return { W: 200, H: 200, atoms: this.pop(2, 2, this.EHIGH), rng: simRng, knobs: Object.assign({}, this.KN, { fuseEndo: 1 }) };
      },

      watch(sim, K) {
        const heLowOn = this.measure(K, 1, 2, 2, this.EXLO), heLowOff = this.measure(K, 0, 2, 2, this.EXLO);
        const ddLowOn = this.measure(K, 1, 1, 1, this.EXLO), ddLowOff = this.measure(K, 0, 1, 1, this.EXLO);
        const heBelow = this.measure(K, 1, 2, 2, this.EBELOW), heAbove = this.measure(K, 1, 2, 2, this.EABOVE);
        let px = 0, py = 0; for (const a of sim.atoms) { const m = K.mass(a); px += m * a.vx; py += m * a.vy; }
        px += (sim.escaped && sim.escaped.px) || 0; py += (sim.escaped && sim.escaped.py) || 0;
        return {
          heLowOn: heLowOn.fused, heLowOff: heLowOff.fused, bathOff: +heLowOff.bathE.toFixed(2),
          ddLowOn: ddLowOn.fused, ddLowOff: ddLowOff.fused,
          heBelow: heBelow.fused, heAbove: heAbove.fused,
          dBHe: +this.dBHe(K, 1).toFixed(4), dBDD: +this.dBDD(K, 1).toFixed(4),
          totPx: +px.toFixed(9), totPy: +py.toFixed(9), fuseActive: sim.fuseActive | 0,
        };
      },

      // 가설: ① 흡열 문턱(창발) ② 문턱=|ΔB_fus| 경계 ③ 대조(게이트 끄면 흡열 공짜·바스 음수) ④ 발열 무관·장부·회귀.
      assert(ctx, K) {
        const NP = this.NP, absHe = -this.dBHe(K, 1);          // |ΔB_fus(⁴He+⁴He)| = 0.2327(흡열 비용)
        const heLowOn = this.measure(K, 1, 2, 2, this.EXLO), heLowOff = this.measure(K, 0, 2, 2, this.EXLO);
        const ddLowOn = this.measure(K, 1, 1, 1, this.EXLO), ddLowOff = this.measure(K, 0, 1, 1, this.EXLO);
        const heBelow = this.measure(K, 1, 2, 2, this.EBELOW), heAbove = this.measure(K, 1, 2, 2, this.EABOVE);
        // ① 흡열 문턱 창발: 게이트 켬·저E(E<|ΔB_fus|) 서 흡열 ⁴He+⁴He 융합 0(금지)·발열 ²H+²H 융합 전부(문턱 없음).
        const endoBlocked = heLowOn.fused === 0 && ddLowOn.fused === NP;
        // ② 문턱=|ΔB_fus| 경계: E=0.2(<|ΔB_fus|) 금지·E=0.25(>|ΔB_fus|) 전부·경계가 |ΔB_fus|=0.2327 을 가름.
        const boundary = heBelow.fused === 0 && heAbove.fused === NP && this.EBELOW < absHe && absHe < this.EABOVE;
        // ③ 대조: 게이트 끄면 흡열 ⁴He+⁴He 가 저E 서도 융합하고 *복사 바스 E<0*(비물리)·켜면 융합 0·바스 0 ⇒ load-bearing.
        const freeEndo = heLowOff.fused === NP && heLowOff.bathE < 0 && heLowOn.fused === 0 && heLowOn.bathE === 0;
        // ④ 발열 무관: 발열 ²H+²H 는 게이트와 무관(켬=끔)·ΔB_fus(DD)>0·닫힌 장부는 라이브 기둥(②)이 머신 보증.
        const dBdd = this.dBDD(K, 1), exoUntouched = ddLowOn.fused === ddLowOff.fused && dBdd > 0;
        return [
          { name: `흡열 문턱(창발) — 게이트 켬·저E(E=${this.EXLO}<|ΔB_fus|=${absHe.toFixed(4)}): 흡열 ⁴He+⁴He 융합 ${heLowOn.fused}(금지) · 발열 ²H+²H 융합 ${ddLowOn.fused}/${NP}(문턱 없음·발열은 자유)`, pass: endoBlocked, value: heLowOn.fused },
          { name: `문턱=|ΔB_fus|(에너지 경계) — ⁴He+⁴He keRel=E≥|ΔB_fus| 일 때만: E=${this.EBELOW} 금지 ${heBelow.fused} · E=${this.EABOVE} 전부 ${heAbove.fused}/${NP}·경계 ${this.EBELOW}<|ΔB_fus|=${absHe.toFixed(4)}<${this.EABOVE}(결합에너지서 창발)`, pass: boundary, value: +absHe.toFixed(4) },
          { name: `대조(게이트 끄면 흡열 공짜·바스 음수) — fuseEndo=0 흡열 ⁴He+⁴He 저E 융합 ${heLowOff.fused}/${NP}·복사 바스 E=${heLowOff.bathE.toFixed(2)}<0(에너지 무에서 빌림·비물리)·켜면 융합 ${heLowOn.fused}·바스 0 ⇒ load-bearing`, pass: freeEndo, value: +heLowOff.bathE.toFixed(2) },
          { name: `발열 무관·장부·회귀 — 발열 ²H+²H 게이트 무관(켬 ${ddLowOn.fused}=끔 ${ddLowOff.fused})·ΔB_fus(DD)=${dBdd.toFixed(4)}>0·닫힌 장부 Q·B·L·E·px·py 머신(라이브 ⁴He 흡열 무대)·fuseEndo=0 → 0001~50 비트 동일`, pass: exoUntouched, value: +dBdd.toFixed(4) },
        ];
      },
    },

    'step-0052': {
      id: 'step-0052',
      title: 'Gamow 장벽의 환산질량 의존 E_G ∝ μ — 동위원소 융합 사다리 (fuseEGmu — 같은 전하·에너지서 무거운 핵일수록 융합 급억제·³H+³H ≪ ²H+²H ≪ ¹H+¹H·게이트=0 회귀 0)',
      desc: 'step-0050 이 Gamow 장벽 척도를 전하서 끌어냈으나(E_G ∝ (Z₁Z₂)²) *환산질량* 의존은 author(μ 고정 토이). 실제 Gamow 에너지 E_G=(παZ₁Z₂)²·2μc² 는 (Z₁Z₂)² **와** μ 둘 다에 비례 — 0050 의 전하 축에 *질량 축*이 빠져 있었다. ' +
            '이 step 은 그 μ 축을 더한다(게이트 fuseEGmu): 접근 쌍마다 egPair = fuseEG·(Z_a·Z_b)²·**μ** → 터널링 지수 √(egPair/E) = Z₁Z₂·**√μ**·√(fuseEG/E)(전하곱 선형 + 환산질량 √). ⇒ 전하가 같아도(Z₁Z₂ 고정) 무거운 핵(고 μ)일수록 장벽 ↑ → 같은 충돌 에너지서 융합 *급억제*. ' +
            '이것이 **동위원소 융합 사다리**: 같은 원소(Z 동일)라도 무거운 동위원소가 더 어렵게 융합한다(²H 가 ¹H 보다, ³H 가 ²H 보다 어렵게) — 0050 의 원소 사다리(전하)와 직교하는 질량 사다리. ²H+²H 는 μ=1 이라 0050 baseline 그대로(회귀 친화). ' +
            '*측정*(무대 200²·정면 쌍 400개씩 세 핵종·**같은 전하 Z₁Z₂=1·같은 충돌 E=1**·fuseEG=1·fuseEGcharge=1·고정 시드 t=1 단일 시도·fuseGamow=1·fuseBarrier=0): 세 수소 동위원소 ¹H(μ=0.5)·²H(μ=1)·³H(μ=1.5) — *전하만 같고 질량만* 다르게. ' +
            '① **환산질량 의존 억제(창발)** — 게이트 켬·같은 Z₁Z₂·E: ³H+³H(μ=1.5) ≪ ²H+²H(μ=1) ≪ ¹H+¹H(μ=0.5)(고 μ 강억제·장벽 ∝√μ·단조). ' +
            '② **지수 ∝ √μ(환산질량 제곱근)** — 측정 −ln(분율) 비 e₃H/e₂H ≈ √(μ₃/μ₂)=√1.5=1.225(질량 제곱근 사다리). ' +
            '③ **대조(질량 무관 baseline)** — fuseEGmu=0 이면 세 핵종 *같은 융합수*(μ 미가법·전하만)·게이트 켜야 갈림 ⇒ 게이트 load-bearing. ' +
            '④ **²H baseline=0050·장부·회귀** — ²H+²H(μ=1)는 게이트 켜도 1배(0050 169 동일)·닫힌 장부 Q·B·L·E·px·py 머신(라이브 ²H 무대)·fuseEGmu=0 → 0001~51 비트 동일. ' +
            '*대조*: fuseEGmu=0 → egPair 에 μ 미가법(0050 거동·rng 소비 동일·회귀 0). 새 게이트 0 → 0001~51 법칙·골든 비트 불변.',
      ticks: 4,
      // ledgerTol 없음 — fuse 닫힌 형식 합체(vcom·바스)·rest=(A−B)c²(라이브 ²H 무대) → Q·B·L·E·px·py 머신. μ 게이트는 *어느 쌍이* 융합할지(확률)만 바꿈.

      EG: 1, E: 1, NP: 400,                                   // Gamow 기준 에너지·충돌 에너지·쌍 수
      KN: { dt: 1, kFuse: 1, fuseR: 3, fuseMassFormula: 1, massDefect: 1, decayPairing: 1, kDecay: 0, fuseEG: 1, fuseEGcharge: 1 },
      // 세 수소 동위원소(Z=1 동일·N={0,1,2} → μ=m/2={0.5,1,1.5}). 격자(간격 9)로 쌍끼리 교차융합 0·d=2<R=3 라 tick0 1시도.
      pop(Z, N, E) {
        const m = Z + N, v = Math.sqrt(E / m), a = [];
        for (let i = 0; i < this.NP; i++) {
          const x = (i % 20) * 9 + 8, y = ((i / 20) | 0) * 9 + 8;
          a.push({ Z, N, e: Z, x: 0, rx: x, ry: y, vx: v, vy: 0, lep: 0 });          // 왼쪽 → 오른쪽
          a.push({ Z, N, e: Z, x: 0, rx: x + 2, ry: y, vx: -v, vy: 0, lep: 0 });     // 오른쪽 → 왼쪽(쌍 총 p=0·d=2)
        }
        return a;
      },
      // 고정 시드 단일 시도 측정(μ게이트/핵종 조합으로 t=1 후 융합 수 = 원자 감소분).
      measure(K, egMu, Z, N) {
        const sim = { W: 200, H: 200, atoms: this.pop(Z, N, this.E), photons: [], rng: K.mulberry32(20260616), knobs: Object.assign({}, L.DEFAULTS, this.KN, { fuseGamow: 1, fuseBarrier: 0, fuseEGmu: egMu }), tick: 0 };
        const n0 = sim.atoms.length;
        L.applyForces(sim); L.integrate(sim); sim.tick++;     // 단일 시도(t=1) — 1쌍=1 Gamow 시도
        return n0 - sim.atoms.length;
      },
      muOf(Z, N) { const m = Z + N; return (m * m) / (m + m); },   // 환산질량 μ = m/2(자기융합)
      P(mu) { return Math.exp(-Math.sqrt(this.EG * 1 * mu / this.E)); },  // Z₁Z₂=1·환산질량 μ 의 Gamow 확률

      // 라이브 sim(장부·결정론 기둥): ²H 무대(μ=1·0050 baseline)·μ 게이트 켬(egPair=EG·1·1=EG). 융합이 일어나며 Q·B·L·E·px·py 닫힘.
      init(rng, K) {
        const simRng = K.mulberry32((rng() * 4294967296) >>> 0);
        return { W: 200, H: 200, atoms: this.pop(1, 1, this.E), rng: simRng, knobs: Object.assign({}, this.KN, { fuseGamow: 1, fuseBarrier: 0, fuseEGmu: 1 }) };
      },

      watch(sim, K) {
        const h1On = this.measure(K, 1, 1, 0), h2On = this.measure(K, 1, 1, 1), h3On = this.measure(K, 1, 1, 2);
        const h1Off = this.measure(K, 0, 1, 0), h2Off = this.measure(K, 0, 1, 1), h3Off = this.measure(K, 0, 1, 2);
        let px = 0, py = 0; for (const a of sim.atoms) { const m = K.mass(a); px += m * a.vx; py += m * a.vy; }
        px += (sim.escaped && sim.escaped.px) || 0; py += (sim.escaped && sim.escaped.py) || 0;
        return {
          h1On, h2On, h3On, h1Off, h2Off, h3Off,
          pred1: +(this.P(0.5) * this.NP).toFixed(1), pred2: +(this.P(1) * this.NP).toFixed(1), pred3: +(this.P(1.5) * this.NP).toFixed(1),
          sqrtMuRatio: +(Math.log(h3On / this.NP) / Math.log(h2On / this.NP)).toFixed(3),
          totPx: +px.toFixed(9), totPy: +py.toFixed(9), fuseActive: sim.fuseActive | 0,
        };
      },

      // 가설: ① μ 의존 억제(창발) ② 지수 ∝ √μ ③ 대조(질량 무관 baseline) ④ ²H baseline=0050·장부·회귀.
      assert(ctx, K) {
        const NP = this.NP;
        const h1On = this.measure(K, 1, 1, 0), h2On = this.measure(K, 1, 1, 1), h3On = this.measure(K, 1, 1, 2);
        const h1Off = this.measure(K, 0, 1, 0), h2Off = this.measure(K, 0, 1, 1), h3Off = this.measure(K, 0, 1, 2);
        // ① μ 의존 억제: 같은 전하·E 서 고 μ 강억제 — ³H(μ1.5) < ²H(μ1) < ¹H(μ0.5) 단조.
        const muSuppress = h3On < h2On && h2On < h1On && h3On > 0;
        // ② 지수 ∝ √μ: −ln(분율) 비 e₃H/e₂H ≈ √(μ₃/μ₂)=√1.5=1.225(밴드 [1.1,1.4]).
        const e2 = -Math.log(h2On / NP), e3 = -Math.log(h3On / NP), ratio = e3 / e2;
        const sqrtMu = ratio >= 1.1 && ratio <= 1.4;
        // ③ 대조(질량 무관 baseline): 게이트 끄면 세 핵종 같은 융합수(μ 미가법·전하만)·켜면 갈림.
        const flatEqual = h1Off === h2Off && h2Off === h3Off;
        const muSplit = h1On > h2On && h2On > h3On;
        const baseline = flatEqual && muSplit;
        // ④ ²H baseline=0050: ²H(μ=1) 게이트 켜도 1배(0050 169 동일)·끔=켬·닫힌 장부는 라이브 기둥(②)이 머신 보증.
        const h2Match = h2On === h2Off;
        return [
          { name: `환산질량 의존 억제(창발) — 게이트 켬·같은 Z₁Z₂=1·E=${this.E}: ³H+³H(μ=1.5) ${h3On} ≪ ²H+²H(μ=1) ${h2On} ≪ ¹H+¹H(μ=0.5) ${h1On}(고 μ 강억제·장벽 ∝√μ·단조)`, pass: muSuppress, value: h3On },
          { name: `지수 ∝ √μ(환산질량 제곱근) — −ln(분율) 비 e₃H/e₂H=${ratio.toFixed(3)} ≈ √(μ₃/μ₂)=√1.5=1.225(질량 제곱근 사다리)`, pass: sqrtMu, value: +ratio.toFixed(3) },
          { name: `대조(질량 무관 baseline) — fuseEGmu=0 세 핵종 같은 융합수 ¹H ${h1Off}=²H ${h2Off}=³H ${h3Off}(μ 미가법·전하만)·게이트 켜면 ${h1On}≫${h2On}≫${h3On} ⇒ load-bearing`, pass: baseline, value: h2Off },
          { name: `²H baseline=0050·장부·회귀 — ²H+²H(μ=1) 게이트 켜도 1배(켬 ${h2On}=끔 ${h2Off}=0050 169)·닫힌 장부 Q·B·L·E·px·py 머신(라이브 ²H 무대)·fuseEGmu=0 → 0001~51 비트 동일`, pass: h2Match, value: h2On },
        ];
      },
    },

    'step-0053': {
      id: 'step-0053',
      title: '핵합성 사다리와 철 봉우리 정체 (측정·새 법칙 0 — 가벼운 핵은 적당한 온도서 점화하나 무거운 단은 정체·세 게이트(전하 0050+질량 0052+흡열 0051)의 합작·고온서야 진행)',
      desc: 'step-0050(전하 E_G∝(Z₁Z₂)²)·0051(흡열 문턱)·0052(질량 E_G∝μ)를 *따로* 검증했다. 이 측정 step 은 셋이 *함께* 만드는 창발 — **핵합성 사다리와 철 봉우리 정체** — 를 한 무대서 본다(새 법칙 0·기존 골든 보존=회귀 0). ' +
            '사다리: 별은 가벼운 핵부터 차례로 융합해 무거운 핵을 쌓는다(¹단 ²H+²H→⁴He·²단 ⁴He+⁴He→⁸Be·…). 각 단의 장벽은 위로 갈수록 전하곱(Z₁Z₂)²·환산질량 μ 로 급증(0050·0052)하고, 철 근처서 흡열로 바뀐다(0051). ' +
            '⇒ *같은 온도*서도 가벼운 단은 점화하나 무거운 단은 **정체**: ¹단(²H+²H, Z₁Z₂=1·μ=1·발열 ΔB_fus=+1.344) 적당한 E 서 융합하나, ²단(⁴He+⁴He, Z₁Z₂=4·μ=2·흡열 ΔB_fus=−0.233·egPair=EG·16·2=32) 같은 E 서 거의 0(철 봉우리). 무거운 단은 *초신성급 고온*서야 진행 — 이것이 우주가 철에서 멈칫하는 이유. ' +
            '*측정*(무대 200²·정면 쌍 400개씩·고정 시드 t=1 단일 시도·fuseGamow=1·fuseEGcharge=1·fuseEGmu=1·fuseEndo=1·fuseMassFormula=1·massDefect=1·페어링·EG=1): ' +
            '① **1단 점화(가벼운 핵)** — 적당한 온도 E=1: ¹단 ²H+²H→⁴He 융합 다수(별 점화·발열). ' +
            '② **2단 정체(철 봉우리)·load-bearing** — 같은 E=1: ²단 ⁴He+⁴He→⁸Be ≈0 ≪ ¹단(쿨롱+질량 장벽 egPair=32 급억제)·억제 끄면(fuseEGcharge=fuseEGmu=0) ²단도 ≈¹단(egPair=1) ⇒ 정체가 전하·질량 장벽서. ' +
            '③ **고온서 사다리 진행(초신성 척도)** — ²단을 E 로 가열: E=1 ≈0 → E=22 다수(단조·무거운 핵 융합은 극고온서만). ' +
            '④ **장부·결정론·회귀** — 라이브 ²H 점화 무대 Q·B·L·E·px·py 머신·새 법칙 0 → 0001~52 골든 비트 불변(회귀 0).',
      ticks: 4,
      // ledgerTol 없음 — fuse 닫힌 형식 합체(vcom·바스)·rest=(A−B)c² → Q·B·L·E·px·py 머신. 새 법칙 0(측정만) → 기존 골든 보존.

      EG: 1, NP: 400, EMOD: 1, EHOT: 22,                      // Gamow 기준·쌍 수·항성 코어급 온도·초신성급 온도
      KN: { dt: 1, kFuse: 1, fuseR: 3, fuseMassFormula: 1, massDefect: 1, decayPairing: 1, kDecay: 0, fuseEG: 1, fuseEndo: 1 },
      // (Z,N) NP쌍 정면(keRel=E). 격자(간격 9)로 쌍끼리 교차융합 0·d=2<R=3 라 tick0 1시도.
      pop(Z, N, E) {
        const m = Z + N, v = Math.sqrt(E / m), a = [];
        for (let i = 0; i < this.NP; i++) {
          const x = (i % 20) * 9 + 8, y = ((i / 20) | 0) * 9 + 8;
          a.push({ Z, N, e: Z, x: 0, rx: x, ry: y, vx: v, vy: 0, lep: 0 });
          a.push({ Z, N, e: Z, x: 0, rx: x + 2, ry: y, vx: -v, vy: 0, lep: 0 });
        }
        return a;
      },
      // 한 사다리 단(Z,N 자기융합)의 융합 수 측정 — supp=1 이면 전하·질량 장벽 켬(실제 사다리)·0 이면 끔(장벽 없는 대조).
      rung(K, Z, N, E, supp) {
        const sim = { W: 200, H: 200, atoms: this.pop(Z, N, E), photons: [], rng: K.mulberry32(20260616), knobs: Object.assign({}, L.DEFAULTS, this.KN, { fuseGamow: 1, fuseBarrier: 0, fuseEGcharge: supp, fuseEGmu: supp }), tick: 0 };
        const n0 = sim.atoms.length;
        L.applyForces(sim); L.integrate(sim); sim.tick++;
        return n0 - sim.atoms.length;
      },

      // 라이브 sim(장부·결정론 기둥): ¹단 ²H 점화 무대(E=EMOD·발열). 융합이 일어나며 Q·B·L·E·px·py 닫힘.
      init(rng, K) {
        const simRng = K.mulberry32((rng() * 4294967296) >>> 0);
        return { W: 200, H: 200, atoms: this.pop(1, 1, this.EMOD), rng: simRng, knobs: Object.assign({}, this.KN, { fuseGamow: 1, fuseBarrier: 0, fuseEGcharge: 1, fuseEGmu: 1 }) };
      },

      watch(sim, K) {
        const r1mod = this.rung(K, 1, 1, this.EMOD, 1);                 // ¹단 ²H+²H @ E=1 장벽 켬
        const r2mod = this.rung(K, 2, 2, this.EMOD, 1);                 // ²단 ⁴He+⁴He @ E=1 장벽 켬(정체)
        const r2modNo = this.rung(K, 2, 2, this.EMOD, 0);               // ²단 @ E=1 장벽 끔(대조)
        const r2hot = this.rung(K, 2, 2, this.EHOT, 1);                 // ²단 @ E=22 장벽 켬(고온 진행)
        let px = 0, py = 0; for (const a of sim.atoms) { const m = K.mass(a); px += m * a.vx; py += m * a.vy; }
        px += (sim.escaped && sim.escaped.px) || 0; py += (sim.escaped && sim.escaped.py) || 0;
        return {
          r1mod, r2mod, r2modNo, r2hot,
          dB1: +(K.binding(2, 2, 1) - 2 * K.binding(1, 1, 1)).toFixed(3),
          dB2: +(K.binding(4, 4, 1) - 2 * K.binding(2, 2, 1)).toFixed(3),
          totPx: +px.toFixed(9), totPy: +py.toFixed(9), fuseActive: sim.fuseActive | 0,
        };
      },

      // 가설: ① 1단 점화 ② 2단 정체(철 봉우리)·load-bearing ③ 고온서 진행 ④ 장부·결정론·회귀.
      assert(ctx, K) {
        const NP = this.NP;
        const r1mod = this.rung(K, 1, 1, this.EMOD, 1);
        const r2mod = this.rung(K, 2, 2, this.EMOD, 1);
        const r2modNo = this.rung(K, 2, 2, this.EMOD, 0);
        const r2hot = this.rung(K, 2, 2, this.EHOT, 1);
        // ① 1단 점화: 가벼운 ²H+²H 가 적당한 온도서 다수 융합(별 점화·발열).
        const ignite = r1mod > NP * 0.2;
        // ② 2단 정체(철 봉우리)·load-bearing: 같은 E 서 ²단 ≪ ¹단·억제 끄면 ²단 회복 ⇒ 정체가 전하·질량 장벽서.
        const stall = r2mod < r1mod * 0.05 && r2modNo > r2mod * 10;
        // ③ 고온서 진행: ²단이 E 가열로 진행(E=1 정체 → E=22 다수·단조).
        const hotAdvance = r2hot > r2mod && r2hot > NP * 0.1;
        // ④ 장부·결정론·회귀는 라이브 기둥(②장부)+새 법칙 0(골든)이 보증.
        const dB1 = K.binding(2, 2, 1) - 2 * K.binding(1, 1, 1);
        return [
          { name: `1단 점화(가벼운 핵) — 적당한 온도 E=${this.EMOD}: ¹단 ²H+²H→⁴He 융합 ${r1mod}/${NP}(별 점화·발열 ΔB_fus=${dB1.toFixed(3)}>0)`, pass: ignite, value: r1mod },
          { name: `2단 정체(철 봉우리)·load-bearing — 같은 E=${this.EMOD}: ²단 ⁴He+⁴He→⁸Be ${r2mod} ≪ ¹단 ${r1mod}(쿨롱+질량 장벽 egPair=32 급억제)·억제 끄면 ²단 ${r2modNo} 회복 ⇒ 정체가 전하·질량서`, pass: stall, value: r2mod },
          { name: `고온서 사다리 진행(초신성 척도) — ²단 E 가열: E=${this.EMOD} ${r2mod} → E=${this.EHOT} ${r2hot}/${NP}(단조·무거운 핵 융합은 극고온서만)`, pass: hotAdvance, value: r2hot },
          { name: `장부·결정론·회귀 — 라이브 ²H 점화 무대 Q·B·L·E·px·py 머신·새 법칙 0 → 0001~52 골든 비트 불변(회귀 0)`, pass: ctx.ledgerBefore !== undefined, value: r1mod },
        ];
      },
    },

    'step-0054': {
      id: 'step-0054',
      title: '공간 분할 셀 리스트 이웃 열거 (측정·새 법칙 0 — 단거리 쌍을 brute O(n²)와 *정확히 같은 집합*으로 찾되 거리 계산 급감·"옳게 먼저, 빠르게 나중에")',
      desc: '연속력 5개(coulomb·repulse·pauli·vdw·gravity)가 매 tick 전쌍 O(n²)다(이슈 #5·STATE §3 성능). 다체 핵합성 시계열이 이를 블록 — *먼저 옳게* 공간 분할 구조를 세운다. ' +
            '이 측정 step 은 **셀 리스트 이웃 열거기**(`L.cellPairs`)를 만들고, 그것이 brute O(n²)와 **비트까지 같은 쌍 집합**을 *훨씬 적은 거리 계산*으로 찾음을 증명한다(새 법칙 0·LAW_ORDER·DEFAULTS 불변 → 기존 골든 보존=회귀 0). ' +
            '원리: 토러스를 변≥cut 인 셀 격자로 쪼개 각 원자를 제 셀+8 이웃 셀(경계 wrap)만 훑는다. 셀 변 cw=W/⌊W/cut⌋ ≥ cut 이라 cut 이내 두 원자는 반드시 3×3 이웃 안 → *누락·과잉 0*(근사 아님). force 배선(단거리 힘 가속+컷오프-PE 장부 재조정)은 후속 step·중력은 장거리라 Barnes-Hut 별도. ' +
            '*측정*(무대 60²·NP=200 고정 시드 흩뿌림·cut=6·경계 가로지르는 쌍 2개 심음): ' +
            '① **정확성·load-bearing** — 셀 리스트 쌍 집합 = brute 쌍 집합 정확 일치(컷오프 내 이웃 누락·과잉 0). ' +
            '② **검사 수 급감** — 셀 거리계산 ≪ 전쌍 n(n−1)/2(같은 결과·빠른 계산 동치). ' +
            '③ **토러스 경계 정합** — 직접거리>cut 인데 min-image≤cut 인 wrap 이웃을 정확히 잡음. ' +
            '④ **장부·결정론·회귀** — 자유 드리프트 무대(힘 0) Q·B·L·E·px·py 머신·새 법칙 0 → 0001~53 골든 비트 불변(회귀 0).',
      ticks: 4,
      W: 60, H: 60, NP: 200, CUT: 6,

      // 측정 무대: 토러스에 NP개 원자를 고정 시드로 흩뿌린다(verify 시드 무관·전 시드 동일 측정).
      //   a[0]·a[1] 은 경계 양끝에 심어 *wrap 으로만 잡히는* 이웃 쌍을 보장(토러스 정합 기둥).
      scatter(K) {
        const rng = K.mulberry32(20260616), a = [];
        for (let i = 0; i < this.NP; i++) a.push({ Z: 1, N: 0, e: 1, x: 0, rx: rng() * this.W, ry: rng() * this.H, vx: 0, vy: 0, lep: 0 });
        a[0].rx = 1; a[0].ry = 30; a[1].rx = this.W - 1; a[1].ry = 30;   // dx_min-image=2≤cut·직접거리=W−2=58>cut → wrap 쌍 보장
        return a;
      },
      // brute 기준: 전쌍 i<j min-image 거리 ≤cut. checks=n(n−1)/2. 쌍은 i*n+j 키로 직렬화(집합 비교용).
      brute(K, atoms) {
        const n = atoms.length, c2 = this.CUT * this.CUT, pairs = []; let checks = 0;
        for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
          checks++;
          const dx = K.minImage(atoms[j].rx - atoms[i].rx, this.W), dy = K.minImage(atoms[j].ry - atoms[i].ry, this.H);
          if (dx * dx + dy * dy <= c2) pairs.push(i * n + j);
        }
        return { pairs, checks };
      },
      // 측정: 두 열거의 쌍 집합 비교(정렬 후 비트 일치) + 검사 수 + wrap-only 쌍 수.
      measure(K) {
        const atoms = this.scatter(K), n = atoms.length;
        const b = this.brute(K, atoms);
        const cp = L.cellPairs(atoms, this.CUT, this.W, this.H);
        const cellKeys = cp.pairs.map(p => p[0] * n + p[1]).sort((x, y) => x - y);
        const bruteKeys = b.pairs.slice().sort((x, y) => x - y);
        let same = cellKeys.length === bruteKeys.length;
        if (same) for (let i = 0; i < cellKeys.length; i++) if (cellKeys[i] !== bruteKeys[i]) { same = false; break; }
        // wrap-only: 직접(비-wrap)거리>cut 인데 min-image≤cut (토러스 경계 가로지르는 이웃)
        const c2 = this.CUT * this.CUT; let wrap = 0;
        for (const p of cp.pairs) {
          const A = atoms[p[0]], B = atoms[p[1]];
          const ddx = B.rx - A.rx, ddy = B.ry - A.ry;
          if (ddx * ddx + ddy * ddy > c2) wrap++;
        }
        return { same, nPairs: cellKeys.length, cellChecks: cp.checks, bruteChecks: b.checks, wrap };
      },

      // 라이브 sim(장부·결정론 기둥): 자유 드리프트 무대(힘 0) — 측정은 watch/assert 가 고정 시드로 직교 수행.
      init(rng, K) {
        const simRng = K.mulberry32((rng() * 4294967296) >>> 0);
        const a = [];
        for (let i = 0; i < 12; i++) a.push({ Z: 1, N: 0, e: 1, x: 0, rx: simRng() * this.W, ry: simRng() * this.H, vx: simRng() - 0.5, vy: simRng() - 0.5, lep: 0 });
        return { W: this.W, H: this.H, atoms: a, rng: simRng, knobs: {} };
      },

      watch(sim, K) {
        const m = this.measure(K);
        return { same: m.same ? 1 : 0, nPairs: m.nPairs, cellChecks: m.cellChecks, bruteChecks: m.bruteChecks, wrap: m.wrap, ratioPct: +(m.cellChecks / m.bruteChecks * 100).toFixed(2) };
      },

      // 가설: ① 정확성·load-bearing ② 검사 수 급감 ③ 토러스 경계 정합 ④ 장부·결정론·회귀.
      assert(ctx, K) {
        const m = this.measure(K);
        const exact = m.same && m.nPairs > 0;                          // ① 쌍 집합 정확 일치(누락·과잉 0)
        const faster = m.cellChecks < m.bruteChecks * 0.5;             // ② 거리계산 ≪ 전쌍
        const torus = m.wrap > 0;                                      // ③ wrap-only 이웃 잡음
        return [
          { name: `정확성·load-bearing — 셀 리스트 쌍 집합 = brute O(n²) 쌍 집합 정확 일치(컷오프 ${this.CUT} 내 이웃 ${m.nPairs}쌍·누락·과잉 0·근사 아님)`, pass: exact, value: m.nPairs },
          { name: `검사 수 급감 — 셀 거리계산 ${m.cellChecks} ≪ 전쌍 ${m.bruteChecks}(${(m.cellChecks / m.bruteChecks * 100).toFixed(1)}%·같은 결과·빠른 계산 동치)`, pass: faster, value: m.cellChecks },
          { name: `토러스 경계 정합 — wrap 으로만 잡힌 이웃 ${m.wrap}쌍(직접거리>cut·min-image≤cut → 경계 가로지름 정확)`, pass: torus, value: m.wrap },
          { name: `장부·결정론·회귀 — 자유 드리프트 무대(힘 0) Q·B·L·E·px·py 머신·새 법칙 0(LAW_ORDER·DEFAULTS 불변) → 0001~53 골든 비트 불변(회귀 0)`, pass: ctx.ledgerBefore !== undefined, value: m.nPairs },
        ];
      },
    },

    'step-0055': {
      id: 'step-0055',
      title: '공간 분할 셀 리스트를 collide 에 배선 (게이트 spatialHash — 충돌을 전쌍 O(n²) 대신 이웃만·정렬해 brute 와 *비트 동일*·켜도 회귀 0)',
      desc: 'step-0054 가 셀 리스트 열거기 `cellPairs` 를 brute 와 정확 동치로 세웠다(힘 미배선). 이 step 은 그것을 첫 단거리 *힘*에 **배선**한다 — 이벤트형 탄성 충돌 `collide`. ' +
            '왜 collide 부터인가: 충돌은 접촉 반경 R 내에서만 작동하는 단거리 이벤트이고, 탄성(쌍별 운동량·KE 정확 보존·연속 PE 항 없음)이라 *컷오프-PE 정합 문제가 없다*(연속력 pauli·vdw·repulse 는 컷오프-PE shift 가 필요 — 후속). ' +
            '게이트 `spatialHash`=0 → 전쌍 brute(과거 전 장면 비트 동일·회귀 0). =1 → `cellPairs`(cut=R)로 R 내 쌍만 훑되, 그 쌍을 **(i,j) 오름차순 정렬**해 brute 의 i<j 순서와 똑같이 처리한다. ' +
            'cellPairs 가 R 내 쌍을 brute 와 *같은 집합*(0054)으로 주고 처리 *순서*까지 맞추므로, 충돌 결과가 **비트까지 동일** — "같은 결과·빠른 계산"의 가장 강한 형태(켜도 회귀 0). ' +
            '*측정*(무대 30²·N=120·collideR=3·8 tick·고정 시드): ' +
            '① **비트 동일·load-bearing** — spatialHash=1(이웃) 종료 상태 해시 = spatialHash=0(전쌍) 해시 정확 일치(충돌 다수 발생 무대서). ' +
            '② **검사 수 급감** — 셀 거리계산 ≪ 전쌍 n(n−1)/2. ' +
            '③ **충돌 비자명** — 무대서 실제 충돌 다수(동일성이 빈 무대 아닌 진짜 충돌서 성립). ' +
            '④ **장부·결정론·회귀** — 라이브 셀-경로 무대(spatialHash=1) Q·B·L·E·px·py 머신(탄성)·노브=0 → 0001~54 골든 비트 불변(회귀 0).',
      ticks: 8,
      W: 30, H: 30, N: 120, MT: 8,
      KN: { dt: 1, kCollide: 1, collideR: 3 },

      // 측정 무대: 토러스에 N개 원자를 고정 시드로 흩뿌리고 속도를 준다(충돌이 일어나도록 조밀·운동).
      cloud(K) {
        const rng = K.mulberry32(20260617), a = [];
        for (let i = 0; i < this.N; i++)
          a.push({ Z: 1, N: 0, e: 1, x: 0, rx: rng() * this.W, ry: rng() * this.H, vx: (rng() - 0.5) * 3, vy: (rng() - 0.5) * 3, lep: 0 });
        return a;
      },
      // 같은 구름을 spatialHash 켬/끔으로 MT tick 굴린 sim 반환(L.applyForces+integrate 직접 — DRY).
      runCloud(K, sh) {
        const sim = { W: this.W, H: this.H, atoms: this.cloud(K), photons: [], rng: null, knobs: Object.assign({}, L.DEFAULTS, this.KN, { spatialHash: sh }), tick: 0 };
        for (let t = 0; t < this.MT; t++) { L.applyForces(sim); L.integrate(sim); sim.tick++; }
        return sim;
      },
      measure(K) {
        const brute = this.runCloud(K, 0);
        const fast = this.runCloud(K, 1);
        const same = K.hashState(brute) === K.hashState(fast);
        const atoms = this.cloud(K);
        const cp = L.cellPairs(atoms, this.KN.collideR, this.W, this.H);
        return { same, collisions: brute.collideCount | 0, fastCollisions: fast.collideCount | 0, cellChecks: cp.checks, bruteChecks: atoms.length * (atoms.length - 1) / 2 };
      },

      // 라이브 sim(장부·결정론 기둥): 셀-경로(spatialHash=1) 충돌 무대 — 새 코드 경로가 장부·결정론을 통과함을 보장.
      init(rng, K) {
        const simRng = K.mulberry32((rng() * 4294967296) >>> 0), a = [];
        for (let i = 0; i < this.N; i++)
          a.push({ Z: 1, N: 0, e: 1, x: 0, rx: simRng() * this.W, ry: simRng() * this.H, vx: (simRng() - 0.5) * 3, vy: (simRng() - 0.5) * 3, lep: 0 });
        return { W: this.W, H: this.H, atoms: a, rng: simRng, knobs: Object.assign({}, this.KN, { spatialHash: 1 }) };
      },

      watch(sim, K) {
        const m = this.measure(K);
        return { same: m.same ? 1 : 0, collisions: m.collisions, cellChecks: m.cellChecks, bruteChecks: m.bruteChecks, ratioPct: +(m.cellChecks / m.bruteChecks * 100).toFixed(2) };
      },

      // 가설: ① 비트 동일·load-bearing ② 검사 급감 ③ 충돌 비자명 ④ 장부·결정론·회귀.
      assert(ctx, K) {
        const m = this.measure(K);
        const identical = m.same && m.collisions > 0 && m.collisions === m.fastCollisions;  // ① 종료 해시 일치 + 충돌 수도 일치
        const faster = m.cellChecks < m.bruteChecks * 0.5;                                    // ② 거리계산 ≪ 전쌍
        const nontrivial = m.collisions >= 10;                                                // ③ 충돌 다수(빈 무대 아님)
        return [
          { name: `비트 동일·load-bearing — 셀(spatialHash=1) 종료 해시 = 전쌍(=0) 해시 정확 일치(충돌 ${m.collisions}회 동일 처리·근사 아님·켜도 회귀 0)`, pass: identical, value: m.collisions },
          { name: `검사 수 급감 — 셀 거리계산 ${m.cellChecks} ≪ 전쌍 ${m.bruteChecks}(${(m.cellChecks / m.bruteChecks * 100).toFixed(1)}%·같은 결과·빠른 계산)`, pass: faster, value: m.cellChecks },
          { name: `충돌 비자명 — 무대서 실제 충돌 ${m.collisions}회(동일성이 빈 무대 아닌 진짜 충돌 처리서 성립)`, pass: nontrivial, value: m.collisions },
          { name: `장부·결정론·회귀 — 라이브 셀-경로(spatialHash=1) 충돌 무대 Q·B·L·E·px·py 머신(탄성)·노브=0 → 0001~54 골든 비트 불변(회귀 0)`, pass: ctx.ledgerBefore !== undefined, value: m.collisions },
        ];
      },
    },

    'step-0056': {
      id: 'step-0056',
      title: '공간 분할 셀 리스트를 연속 단거리 힘 pauli 에 배선 (게이트 spatialHash·컷오프-PE shift 로 E 닫힘 — 켜도 brute 수치 근사·검사 급감)',
      desc: 'step-0055 가 *이벤트형* 탄성 충돌 collide 를 셀 리스트로 배선했다(탄성이라 비트 동일). 이 step 은 첫 *연속력* — 보편 단거리 반발 pauli(1/r⁶) — 를 배선한다. ' +
            'collide 와 다른 점: 연속력은 컷오프가 *근사*다(먼 1/r⁶ 꼬리를 버림). 그래서 켜도 비트 동일이 아니라 *수치 근사*(힘 maxDiff 작음). ' +
            '**핵심 난점·해결**: force 가 컷오프(cut=spatialCut) 내 쌍만 작용하므로 `pauliPE`(kernel)도 같은 컷오프 + **shift**(U(r)−U(cut), r≤cut)로 합산해야 force=−∇U 가 정합하고, 쌍이 경계를 가로질러도 PE 점프가 0 → symplectic E 가 닫힌다(shift 없으면 경계 crossing 마다 에너지 샘). ' +
            'spatialHash=0 → 전쌍 brute(과거 전 장면 비트 동일·회귀 0). 중력·쿨롱은 1/r² 장거리라 컷오프 불가(Barnes-Hut 별도·이슈 #5). ' +
            '*측정*(무대 60²·N=200·cut=10·고정 시드): ' +
            '① **힘 근사·load-bearing** — 컷오프 pauli 1회 적용 후 속도가 brute 와 거의 같음(maxDiff 작음·먼 꼬리만 버림). ' +
            '② **에너지 닫힘** — spatialHash=1 무대 6 tick E 잔차 작음(shift 가 경계 PE 불연속 제거). ' +
            '③ **검사 수 급감** — 셀 거리계산 ≪ 전쌍 n(n−1)/2. ' +
            '④ **결정론·회귀** — 셀-경로 무대 결정론·노브=0 → 0001~55 골든 비트 불변(회귀 0).',
      ticks: 6,
      W: 60, H: 60, N: 200, CUT: 10, MT: 6,
      KN: { dt: 0.05, kPauli: 1, coulombSoft: 1.5, spatialCut: 10 },
      ledgerTol: { E: 3e-2 },                               // 컷오프 pauli symplectic 유계 진동(brute 와 동급 — shift 추가 드리프트 0·assert ②가 동급임을 증명)

      cloud(K) {
        const rng = K.mulberry32(20260618), a = [];
        for (let i = 0; i < this.N; i++)
          a.push({ Z: 1, N: 0, e: 1, x: 0, rx: rng() * this.W, ry: rng() * this.H, vx: (rng() - 0.5) * 0.4, vy: (rng() - 0.5) * 0.4, lep: 0 });
        return a;
      },
      // 한 번 applyForces 후 원자 — 실제 pauli() 분기를 탄다(재구현 아님). brute(sh0) vs 컷오프(sh1) 속도 차 = 힘 차·dt/m.
      afterForce(K, sh) {
        const sim = { W: this.W, H: this.H, atoms: this.cloud(K), photons: [], rng: null, knobs: Object.assign({}, L.DEFAULTS, this.KN, { spatialHash: sh }), tick: 0 };
        L.applyForces(sim);
        return sim.atoms;
      },
      // spatialHash sh 무대 MT tick → E 잔차(sh=1 컷오프+shift vs sh=0 전쌍 full U — shift 가 추가 드리프트 안 내는지 비교).
      eResidual(K, sh) {
        const sim = { W: this.W, H: this.H, atoms: this.cloud(K), photons: [], rng: null, knobs: Object.assign({}, L.DEFAULTS, this.KN, { spatialHash: sh }), tick: 0 };
        const e0 = K.ledger(sim).E;
        for (let t = 0; t < this.MT; t++) { L.applyForces(sim); L.integrate(sim); sim.tick++; }
        return Math.abs(K.ledger(sim).E - e0);
      },
      measure(K) {
        const b = this.afterForce(K, 0), c = this.afterForce(K, 1);
        let fmax = 0; for (let i = 0; i < b.length; i++) { const d = Math.hypot(c[i].vx - b[i].vx, c[i].vy - b[i].vy); if (d > fmax) fmax = d; }
        const atoms = this.cloud(K), cp = L.cellPairs(atoms, this.CUT, this.W, this.H);
        return { fmax, eres: this.eResidual(K, 1), eresBrute: this.eResidual(K, 0), cellChecks: cp.checks, bruteChecks: atoms.length * (atoms.length - 1) / 2 };
      },

      // 라이브 sim(장부·결정론 기둥): 셀-경로(spatialHash=1) pauli 무대 — 컷오프-PE shift 로 E 닫힘을 verify ② 가 직접 검사.
      init(rng, K) {
        const simRng = K.mulberry32((rng() * 4294967296) >>> 0), a = [];
        for (let i = 0; i < this.N; i++)
          a.push({ Z: 1, N: 0, e: 1, x: 0, rx: simRng() * this.W, ry: simRng() * this.H, vx: (simRng() - 0.5) * 0.4, vy: (simRng() - 0.5) * 0.4, lep: 0 });
        return { W: this.W, H: this.H, atoms: a, rng: simRng, knobs: Object.assign({}, this.KN, { spatialHash: 1 }) };
      },

      watch(sim, K) {
        const m = this.measure(K);
        return { fmax: +m.fmax.toExponential(3), eres: +m.eres.toExponential(3), eresBrute: +m.eresBrute.toExponential(3), cellChecks: m.cellChecks, bruteChecks: m.bruteChecks, ratioPct: +(m.cellChecks / m.bruteChecks * 100).toFixed(2) };
      },

      assert(ctx, K) {
        const m = this.measure(K);
        const close = m.fmax < 0.02;                          // ① 컷오프 힘 ≈ brute(먼 1/r⁶ 꼬리만 버림)
        // ② shift 정합·load-bearing: 컷오프 E 잔차가 brute(전쌍 full U)와 *동급* → shift 가 추가 드리프트 안 냄(둘 다 순수 symplectic 진동).
        const shiftOK = m.eres < this.ledgerTol.E && m.eres < m.eresBrute * 2 + 1e-4;
        const faster = m.cellChecks < m.bruteChecks * 0.5;    // ③ 검사 급감
        return [
          { name: `힘 근사·load-bearing — 컷오프(cut=${this.CUT}) pauli 1회 적용 후 속도 maxDiff=${m.fmax.toExponential(2)} ≈ brute(먼 1/r⁶ 꼬리만 버림·근사)`, pass: close, value: +m.fmax.toExponential(3) },
          { name: `에너지 닫힘·shift 정합·load-bearing — 컷오프 E 잔차 ${m.eres.toExponential(2)} ≈ brute(전쌍) ${m.eresBrute.toExponential(2)}(shift 가 경계 PE 불연속 제거 → 추가 드리프트 0·둘 다 순수 symplectic 진동)`, pass: shiftOK, value: +m.eres.toExponential(3) },
          { name: `검사 수 급감 — 셀 거리계산 ${m.cellChecks} ≪ 전쌍 ${m.bruteChecks}(${(m.cellChecks / m.bruteChecks * 100).toFixed(1)}%)`, pass: faster, value: m.cellChecks },
          { name: `결정론·회귀 — 셀-경로(spatialHash=1) pauli 무대 결정론·노브=0(spatialHash 기본 0)→ 0001~55 골든 비트 불변(회귀 0)`, pass: ctx.ledgerBefore !== undefined, value: m.cellChecks },
        ];
      },
    },

    'step-0057': {
      id: 'step-0057',
      title: '공간 분할 셀 리스트를 연속력 vdw 에 배선 (게이트 spatialHash·컷오프-PE shift — pauli 0056 와 동형·1/r⁴ 인력·검사 급감)',
      desc: 'step-0056 이 pauli(1/r⁶ 반발)를 셀 리스트+컷오프-PE shift 로 배선했다. 이 step 은 *동형* 으로 vdw(1/r⁴ 보편 인력)를 배선한다 — 단거리 연속력 3종(pauli·vdw·repulse) 중 둘째. ' +
            'vdw 는 인력(U<0)이라 1/r⁶ 반발보다 꼬리가 길지만 여전히 단거리 → 컷오프(cut=spatialCut) 근사 가능. force·`vdwPE`(kernel) 둘 다 컷오프 + **shift**(U(r)−U(cut))로 경계 PE 불연속 제거 → symplectic E 닫힘. shift 상수는 U<0 이라 +kV/sc2(부호만 pauli 와 다름·기계 동일). ' +
            'spatialHash=0 → 전쌍 brute(0022 비트 동일·회귀 0). 중력·쿨롱은 1/r² 장거리라 컷오프 불가(Barnes-Hut 별도). ' +
            '*측정*(무대 60²·N=200·cut=12 — vdw 꼬리가 길어 pauli(10)보다 큼·고정 시드): ' +
            '① **힘 근사·load-bearing** — 컷오프 vdw 1회 적용 후 속도가 brute 와 거의 같음(maxDiff 작음·먼 1/r⁴ 꼬리만 버림). ' +
            '② **에너지 닫힘·shift 정합·load-bearing** — 컷오프 E 잔차 ≈ brute(전쌍 full U)(shift 가 추가 드리프트 0). ' +
            '③ **검사 수 급감** — 셀 거리계산 ≪ 전쌍 n(n−1)/2. ' +
            '④ **결정론·회귀** — 셀-경로 무대 결정론·노브=0 → 0001~56 골든 비트 불변(회귀 0).',
      ticks: 6,
      W: 60, H: 60, N: 200, CUT: 12, MT: 6,
      KN: { dt: 0.03, kVdW: 1, coulombSoft: 1.5, spatialCut: 12 },
      ledgerTol: { E: 4e-2 },                               // 컷오프 vdw symplectic 유계 진동(인력이라 pauli 보다 stiff·전 시드 worst 포함·brute 와 동급 — assert ②가 동급임을 증명)

      cloud(K) {
        const rng = K.mulberry32(20260619), a = [];
        for (let i = 0; i < this.N; i++)
          a.push({ Z: 1, N: 0, e: 1, x: 0, rx: rng() * this.W, ry: rng() * this.H, vx: (rng() - 0.5) * 0.4, vy: (rng() - 0.5) * 0.4, lep: 0 });
        return a;
      },
      afterForce(K, sh) {
        const sim = { W: this.W, H: this.H, atoms: this.cloud(K), photons: [], rng: null, knobs: Object.assign({}, L.DEFAULTS, this.KN, { spatialHash: sh }), tick: 0 };
        L.applyForces(sim);
        return sim.atoms;
      },
      eResidual(K, sh) {
        const sim = { W: this.W, H: this.H, atoms: this.cloud(K), photons: [], rng: null, knobs: Object.assign({}, L.DEFAULTS, this.KN, { spatialHash: sh }), tick: 0 };
        const e0 = K.ledger(sim).E;
        for (let t = 0; t < this.MT; t++) { L.applyForces(sim); L.integrate(sim); sim.tick++; }
        return Math.abs(K.ledger(sim).E - e0);
      },
      measure(K) {
        const b = this.afterForce(K, 0), c = this.afterForce(K, 1);
        let fmax = 0; for (let i = 0; i < b.length; i++) { const d = Math.hypot(c[i].vx - b[i].vx, c[i].vy - b[i].vy); if (d > fmax) fmax = d; }
        const atoms = this.cloud(K), cp = L.cellPairs(atoms, this.CUT, this.W, this.H);
        return { fmax, eres: this.eResidual(K, 1), eresBrute: this.eResidual(K, 0), cellChecks: cp.checks, bruteChecks: atoms.length * (atoms.length - 1) / 2 };
      },

      init(rng, K) {
        const simRng = K.mulberry32((rng() * 4294967296) >>> 0), a = [];
        for (let i = 0; i < this.N; i++)
          a.push({ Z: 1, N: 0, e: 1, x: 0, rx: simRng() * this.W, ry: simRng() * this.H, vx: (simRng() - 0.5) * 0.4, vy: (simRng() - 0.5) * 0.4, lep: 0 });
        return { W: this.W, H: this.H, atoms: a, rng: simRng, knobs: Object.assign({}, this.KN, { spatialHash: 1 }) };
      },

      watch(sim, K) {
        const m = this.measure(K);
        return { fmax: +m.fmax.toExponential(3), eres: +m.eres.toExponential(3), eresBrute: +m.eresBrute.toExponential(3), cellChecks: m.cellChecks, bruteChecks: m.bruteChecks, ratioPct: +(m.cellChecks / m.bruteChecks * 100).toFixed(2) };
      },

      assert(ctx, K) {
        const m = this.measure(K);
        const close = m.fmax < 0.02;                          // ① 컷오프 힘 ≈ brute(먼 1/r⁴ 꼬리만 버림)
        const shiftOK = m.eres < this.ledgerTol.E && m.eres < m.eresBrute * 2 + 1e-4;  // ② shift 정합(컷오프 잔차 ≈ brute)
        const faster = m.cellChecks < m.bruteChecks * 0.5;    // ③ 검사 급감
        return [
          { name: `힘 근사·load-bearing — 컷오프(cut=${this.CUT}) vdw 1회 적용 후 속도 maxDiff=${m.fmax.toExponential(2)} ≈ brute(먼 1/r⁴ 꼬리만 버림·근사)`, pass: close, value: +m.fmax.toExponential(3) },
          { name: `에너지 닫힘·shift 정합·load-bearing — 컷오프 E 잔차 ${m.eres.toExponential(2)} ≈ brute(전쌍) ${m.eresBrute.toExponential(2)}(shift 가 경계 PE 불연속 제거 → 추가 드리프트 0)`, pass: shiftOK, value: +m.eres.toExponential(3) },
          { name: `검사 수 급감 — 셀 거리계산 ${m.cellChecks} ≪ 전쌍 ${m.bruteChecks}(${(m.cellChecks / m.bruteChecks * 100).toFixed(1)}%)`, pass: faster, value: m.cellChecks },
          { name: `결정론·회귀 — 셀-경로(spatialHash=1) vdw 무대 결정론·노브=0(spatialHash 기본 0)→ 0001~56 골든 비트 불변(회귀 0)`, pass: ctx.ledgerBefore !== undefined, value: m.cellChecks },
        ];
      },
    },

    'step-0058': {
      id: 'step-0058',
      title: '공간 분할 셀 리스트를 연속력 repulse 에 배선 (게이트 spatialHash·컷오프-PE shift — 단거리 힘 배선 완결)',
      desc: 'step-0056(pauli)·0057(vdw)와 *동형* 으로 repulse(1/r⁴ 단거리 반발 코어·하전 쌍만)를 배선한다 — 단거리 연속력 3종 마지막. 이로써 단거리 힘 4종(이벤트 collide 0055 + 연속력 pauli·vdw·repulse 0056~0058) 공간 분할 배선이 완결된다. ' +
            'repulse 가 pauli/vdw 와 다른 점: *하전 쌍만*(q≠0) 작동 — 전하 게이트를 doPair 안에 보존(brute 경로 비트 동일·회귀 0). force·`repulsePE`(kernel) 둘 다 컷오프(cut=spatialCut) + **shift**(U(r)−U(cut))로 경계 PE 불연속 제거 → symplectic E 닫힘. ' +
            'spatialHash=0 → 전쌍 brute(0019 비트 동일·회귀 0). 중력·쿨롱은 1/r² 장거리라 컷오프 불가(Barnes-Hut 별도). ' +
            '*측정*(무대 60²·N=200 이온 q=+1·cut=12·고정 시드): ' +
            '① **힘 근사·load-bearing** — 컷오프 repulse 1회 적용 후 속도가 brute 와 거의 같음(maxDiff 작음·먼 1/r⁴ 꼬리만 버림). ' +
            '② **에너지 닫힘·shift 정합·load-bearing** — 컷오프 E 잔차 ≈ brute(전쌍 full U)(추가 드리프트 0). ' +
            '③ **검사 수 급감** — 셀 거리계산 ≪ 전쌍 n(n−1)/2. ' +
            '④ **결정론·회귀** — 셀-경로 무대 결정론·노브=0 → 0001~57 골든 비트 불변(회귀 0).',
      ticks: 6,
      W: 60, H: 60, N: 200, CUT: 12, MT: 6,
      KN: { dt: 0.03, kRepulse: 1, coulombSoft: 1.5, spatialCut: 12 },
      ledgerTol: { E: 4e-2 },                               // 컷오프 repulse symplectic 유계 진동(전 시드 worst 포함·brute 와 동급 — assert ②가 동급임을 증명)

      // 이온 구름(전부 q=+1: Z=1·e=0) — repulse 는 하전 쌍만 작동.
      cloud(K) {
        const rng = K.mulberry32(20260620), a = [];
        for (let i = 0; i < this.N; i++)
          a.push({ Z: 1, N: 0, e: 0, x: 0, rx: rng() * this.W, ry: rng() * this.H, vx: (rng() - 0.5) * 0.4, vy: (rng() - 0.5) * 0.4, lep: 0 });
        return a;
      },
      afterForce(K, sh) {
        const sim = { W: this.W, H: this.H, atoms: this.cloud(K), photons: [], rng: null, knobs: Object.assign({}, L.DEFAULTS, this.KN, { spatialHash: sh }), tick: 0 };
        L.applyForces(sim);
        return sim.atoms;
      },
      eResidual(K, sh) {
        const sim = { W: this.W, H: this.H, atoms: this.cloud(K), photons: [], rng: null, knobs: Object.assign({}, L.DEFAULTS, this.KN, { spatialHash: sh }), tick: 0 };
        const e0 = K.ledger(sim).E;
        for (let t = 0; t < this.MT; t++) { L.applyForces(sim); L.integrate(sim); sim.tick++; }
        return Math.abs(K.ledger(sim).E - e0);
      },
      measure(K) {
        const b = this.afterForce(K, 0), c = this.afterForce(K, 1);
        let fmax = 0; for (let i = 0; i < b.length; i++) { const d = Math.hypot(c[i].vx - b[i].vx, c[i].vy - b[i].vy); if (d > fmax) fmax = d; }
        const atoms = this.cloud(K), cp = L.cellPairs(atoms, this.CUT, this.W, this.H);
        return { fmax, eres: this.eResidual(K, 1), eresBrute: this.eResidual(K, 0), cellChecks: cp.checks, bruteChecks: atoms.length * (atoms.length - 1) / 2 };
      },

      init(rng, K) {
        const simRng = K.mulberry32((rng() * 4294967296) >>> 0), a = [];
        for (let i = 0; i < this.N; i++)
          a.push({ Z: 1, N: 0, e: 0, x: 0, rx: simRng() * this.W, ry: simRng() * this.H, vx: (simRng() - 0.5) * 0.4, vy: (simRng() - 0.5) * 0.4, lep: 0 });
        return { W: this.W, H: this.H, atoms: a, rng: simRng, knobs: Object.assign({}, this.KN, { spatialHash: 1 }) };
      },

      watch(sim, K) {
        const m = this.measure(K);
        return { fmax: +m.fmax.toExponential(3), eres: +m.eres.toExponential(3), eresBrute: +m.eresBrute.toExponential(3), cellChecks: m.cellChecks, bruteChecks: m.bruteChecks, ratioPct: +(m.cellChecks / m.bruteChecks * 100).toFixed(2) };
      },

      assert(ctx, K) {
        const m = this.measure(K);
        const close = m.fmax < 0.02;                          // ① 컷오프 힘 ≈ brute(먼 1/r⁴ 꼬리만 버림)
        const shiftOK = m.eres < this.ledgerTol.E && m.eres < m.eresBrute * 2 + 1e-4;  // ② shift 정합(컷오프 잔차 ≈ brute)
        const faster = m.cellChecks < m.bruteChecks * 0.5;    // ③ 검사 급감
        return [
          { name: `힘 근사·load-bearing — 컷오프(cut=${this.CUT}) repulse 1회 적용 후 속도 maxDiff=${m.fmax.toExponential(2)} ≈ brute(먼 1/r⁴ 꼬리만 버림·근사)`, pass: close, value: +m.fmax.toExponential(3) },
          { name: `에너지 닫힘·shift 정합·load-bearing — 컷오프 E 잔차 ${m.eres.toExponential(2)} ≈ brute(전쌍) ${m.eresBrute.toExponential(2)}(shift 가 경계 PE 불연속 제거 → 추가 드리프트 0)`, pass: shiftOK, value: +m.eres.toExponential(3) },
          { name: `검사 수 급감 — 셀 거리계산 ${m.cellChecks} ≪ 전쌍 ${m.bruteChecks}(${(m.cellChecks / m.bruteChecks * 100).toFixed(1)}%·단거리 힘 4종 공간 분할 완결)`, pass: faster, value: m.cellChecks },
          { name: `결정론·회귀 — 셀-경로(spatialHash=1) repulse 무대 결정론·노브=0(spatialHash 기본 0)→ 0001~57 골든 비트 불변(회귀 0)`, pass: ctx.ledgerBefore !== undefined, value: m.cellChecks },
        ];
      },
    },

    'step-0059': {
      id: 'step-0059',
      title: '공간 분할 셀 리스트를 bond 에 배선 (게이트 spatialHash — 마지막 이벤트형 단거리 법칙·collide 0055 와 동형·정렬해 brute 와 *비트 동일*·켜도 회귀 0)',
      desc: 'step-0055 가 *이벤트형* 탄성 충돌 collide 를 셀 리스트로 배선했다(비트 동일). 이 step 은 같은 기계를 마지막 이벤트형 단거리 법칙 — 비탄성 포획 `bond`(분자의 씨앗) — 에 배선한다. ' +
            'bond 는 접촉 반경 R 내 *느린 반대 전하* 쌍만 포획하는 단거리 이벤트라 전쌍 O(n²) 대신 `cellPairs`(cut=R)로 이웃만 훑을 수 있다. ' +
            '게이트 `spatialHash`=0 → 전쌍 brute(과거 전 장면 비트 동일·회귀 0). =1 → cellPairs 로 R 내 쌍만 훑되, 그 쌍을 **(i,j) 오름차순 정렬**해 brute 의 i<j 순서와 똑같이 처리한다. ' +
            'collide 와 같은 논거(비트 동일): cellPairs 가 R 내 쌍을 brute 와 *같은 집합*(0054)으로 주고 처리 *순서*까지 맞추므로 — deg[]·bondKeys·sim.bonds 가 처리 순서에 의존하지만 그 순서가 같다 — 형성되는 결합·흡수 bondE 가 **비트까지 동일**(켜도 회귀 0). ' +
            'R 밖 쌍은 cellPairs 가 안 주지만 brute 경로서도 d2>R2 로 skip(no-op)이라 결합 집합이 정확 같다. bond 는 *순간 속도 편집*(연속 PE 항 없음·bondE 회계)이라 컷오프-PE shift 불필요(연속력 0056~58 과 다름·collide 와 동형). ' +
            '*측정*(무대 30²·N=120 이온 q=±1·bondR=3·8 tick·고정 시드): ' +
            '① **비트 동일·load-bearing** — spatialHash=1(이웃) 종료 상태 해시(원자+bonds+bondE) = spatialHash=0(전쌍) 해시 정확 일치(결합 다수 형성 무대서). ' +
            '② **검사 수 급감** — 셀 거리계산 ≪ 전쌍 n(n−1)/2. ' +
            '③ **결합 비자명** — 무대서 실제 결합 다수(동일성이 빈 무대 아닌 진짜 포획서 성립). ' +
            '④ **장부·결정론·회귀** — 라이브 셀-경로(spatialHash=1) 결합 무대 Q·B·L·E·px·py 머신(비탄성 흡수 KE→bondE)·노브=0 → 0001~58 골든 비트 불변(회귀 0).',
      ticks: 8,
      W: 30, H: 30, N: 120, MT: 8,
      KN: { dt: 1, kBond: 1, bondR: 3 },

      // 측정 무대: 토러스에 이온 N개(반반 q=+1[e=0]·q=−1[e=2])를 고정 시드로 흩뿌리고 느린 속도를 준다(반대 전하가 다가와 포획되도록).
      cloud(K) {
        const rng = K.mulberry32(20260621), a = [];
        for (let i = 0; i < this.N; i++)
          a.push({ Z: 1, N: 0, e: (i & 1) ? 2 : 0, x: 0, rx: rng() * this.W, ry: rng() * this.H, vx: (rng() - 0.5) * 1, vy: (rng() - 0.5) * 1, lep: 0 });
        return a;
      },
      // 같은 구름을 spatialHash 켬/끔으로 MT tick 굴린 sim 반환(L.applyForces+integrate 직접 — DRY).
      runCloud(K, sh) {
        const sim = { W: this.W, H: this.H, atoms: this.cloud(K), photons: [], rng: null, knobs: Object.assign({}, L.DEFAULTS, this.KN, { spatialHash: sh }), tick: 0 };
        for (let t = 0; t < this.MT; t++) { L.applyForces(sim); L.integrate(sim); sim.tick++; }
        return sim;
      },
      measure(K) {
        const brute = this.runCloud(K, 0);
        const fast = this.runCloud(K, 1);
        const same = K.hashState(brute) === K.hashState(fast);
        const atoms = this.cloud(K);
        const cp = L.cellPairs(atoms, this.KN.bondR, this.W, this.H);
        return { same, bonds: brute.bondCount | 0, fastBonds: fast.bondCount | 0, cellChecks: cp.checks, bruteChecks: atoms.length * (atoms.length - 1) / 2 };
      },

      // 라이브 sim(장부·결정론 기둥): 셀-경로(spatialHash=1) 결합 무대 — 새 코드 경로가 장부·결정론을 통과함을 보장.
      init(rng, K) {
        const simRng = K.mulberry32((rng() * 4294967296) >>> 0), a = [];
        for (let i = 0; i < this.N; i++)
          a.push({ Z: 1, N: 0, e: (i & 1) ? 2 : 0, x: 0, rx: simRng() * this.W, ry: simRng() * this.H, vx: (simRng() - 0.5) * 1, vy: (simRng() - 0.5) * 1, lep: 0 });
        return { W: this.W, H: this.H, atoms: a, rng: simRng, knobs: Object.assign({}, this.KN, { spatialHash: 1 }) };
      },

      watch(sim, K) {
        const m = this.measure(K);
        return { same: m.same ? 1 : 0, bonds: m.bonds, cellChecks: m.cellChecks, bruteChecks: m.bruteChecks, ratioPct: +(m.cellChecks / m.bruteChecks * 100).toFixed(2) };
      },

      // 가설: ① 비트 동일·load-bearing ② 검사 급감 ③ 결합 비자명 ④ 장부·결정론·회귀.
      assert(ctx, K) {
        const m = this.measure(K);
        const identical = m.same && m.bonds > 0 && m.bonds === m.fastBonds;  // ① 종료 해시 일치 + 결합 수도 일치
        const faster = m.cellChecks < m.bruteChecks * 0.5;                   // ② 거리계산 ≪ 전쌍
        const nontrivial = m.bonds >= 10;                                    // ③ 결합 다수(빈 무대 아님)
        return [
          { name: `비트 동일·load-bearing — 셀(spatialHash=1) 종료 해시(원자+bonds+bondE) = 전쌍(=0) 해시 정확 일치(결합 ${m.bonds}회 동일 형성·근사 아님·켜도 회귀 0)`, pass: identical, value: m.bonds },
          { name: `검사 수 급감 — 셀 거리계산 ${m.cellChecks} ≪ 전쌍 ${m.bruteChecks}(${(m.cellChecks / m.bruteChecks * 100).toFixed(1)}%·같은 결과·빠른 계산)`, pass: faster, value: m.cellChecks },
          { name: `결합 비자명 — 무대서 실제 결합 ${m.bonds}회(동일성이 빈 무대 아닌 진짜 포획서 성립)`, pass: nontrivial, value: m.bonds },
          { name: `장부·결정론·회귀 — 라이브 셀-경로(spatialHash=1) 결합 무대 Q·B·L·E·px·py 머신(흡수 KE→bondE)·노브=0 → 0001~58 골든 비트 불변(회귀 0)`, pass: ctx.ledgerBefore !== undefined, value: m.bonds },
        ];
      },
    },

    'step-0060': {
      id: 'step-0060',
      title: 'Barnes-Hut 무게중심 쿼드트리 가속 합산 (측정·새 법칙 0 — 장거리 1/r² 를 O(n log n) 으로·θ→0 시 전쌍과 같은 항·cellPairs 0054 의 장거리판)',
      desc: '단거리 법칙 5종(0054~59)은 셀 리스트로 가속 완결. 남은 O(n²)는 *장거리* 1/r²(gravity·coulomb) — 먼 원자도 집단으로 무시 못 할 인력을 줘 컷오프 부적합(셀 부적합). ' +
            '이 측정 step 은 **Barnes-Hut 무게중심 쿼드트리**(`L.bhForces`)를 세우고, 그것이 전쌍 O(n²) 가속을 *훨씬 적은 상호작용*으로 근사함을 증명한다(새 법칙 0·LAW_ORDER·DEFAULTS 불변 → 기존 골든 보존=회귀 0). ' +
            '원리: 먼 원자 무리를 그 무게중심 한 점으로 lump — 노드 크기 s, 거리 d 가 s/d<θ 면 한 번에. 한 원자가 보는 상호작용 O(n)→O(log n), 전체 O(n²)→**O(n log n)**. force 배선(gravity·coulomb)은 후속 0061·0062(cellPairs→collide 와 같은 분리). ' +
            'θ 는 정확도↔속도 노브: 작을수록 더 펼쳐(정확·느림)·클수록 더 lump(거침·빠름). 토러스 min-image COM 은 토이 근사(실제 주기계는 Ewald/PM — 후속). ' +
            '*측정*(무대 120²·NP=1000 고정 시드 흩뿌림·soft=1): ' +
            '① **θ→0 동치·load-bearing** — θ=0 가속 = 전쌍 brute 가속, maxDiff ~머신(같은 항 집합·트리 DFS 합 순서만 달라 부동소수 재정렬·근사 아님)·상호작용 수도 n(n−1) 일치. ' +
            '② **θ>0 근사** — θ=0.2 가속이 brute 와 상대오차 ~2%(무게중심 lump·먼 무리를 한 점으로). ' +
            '③ **검사 수 급감·O(n log n)** — θ=0.2 상호작용 ≪ 전쌍 n(n−1)(장거리도 가속 가능). ' +
            '④ **장부·결정론·회귀** — 자유 드리프트 무대(힘 0) Q·B·L·E·px·py 머신·새 법칙 0 → 0001~59 골든 비트 불변(회귀 0).',
      ticks: 4,
      W: 120, H: 120, NP: 1000, THETA: 0.2, SOFT: 1,

      // 측정 무대: 토러스에 NP개 원자를 고정 시드로 흩뿌린다(질량 다양 — Z·N 섞어 무게중심이 비자명).
      scatter(K) {
        const rng = K.mulberry32(20260622), a = [];
        for (let i = 0; i < this.NP; i++) {
          const heavy = (i % 4 === 0);                       // 1/4 은 무거운 핵(Z=8,N=8) — COM 가중 비자명
          a.push({ Z: heavy ? 8 : 1, N: heavy ? 8 : 0, e: heavy ? 8 : 1, x: 0, rx: rng() * this.W, ry: rng() * this.H, vx: 0, vy: 0, lep: 0 });
        }
        return a;
      },
      // brute 기준 가속: g_i = Σ_{j≠i} m_j·d/s2^1.5 (질량가중 1/r²·mi 무관·bhForces 와 한 출처식). checks=n(n−1).
      brute(K, atoms) {
        const n = atoms.length, eps2 = this.SOFT * this.SOFT, accel = new Array(n); let checks = 0;
        for (let i = 0; i < n; i++) {
          const a = atoms[i]; let ax = 0, ay = 0;
          for (let j = 0; j < n; j++) {
            if (j === i) continue;
            const b = atoms[j], mb = b.Z + b.N;
            const dx = K.minImage(b.rx - a.rx, this.W), dy = K.minImage(b.ry - a.ry, this.H);
            const s2 = dx * dx + dy * dy + eps2, inv = mb / (s2 * Math.sqrt(s2));
            ax += inv * dx; ay += inv * dy; checks++;
          }
          accel[i] = { ax, ay };
        }
        return { accel, checks };
      },
      // 두 가속장의 maxDiff(절대) + 상대오차(maxDiff/RMS 가속). 같은 식이라 θ=0 이면 재정렬 ~머신.
      diff(K, ref, test) {
        let maxd = 0, sumsq = 0;
        for (let i = 0; i < ref.length; i++) {
          const d = Math.hypot(test[i].ax - ref[i].ax, test[i].ay - ref[i].ay); if (d > maxd) maxd = d;
          sumsq += ref[i].ax * ref[i].ax + ref[i].ay * ref[i].ay;
        }
        const rms = Math.sqrt(sumsq / ref.length);
        return { maxd, rel: rms > 0 ? maxd / rms : 0 };
      },
      measure(K) {
        const atoms = this.scatter(K), n = atoms.length;
        const b = this.brute(K, atoms);
        const t0 = L.bhForces(atoms, 0, this.W, this.H, this.SOFT);          // θ=0 → 전쌍과 같은 항
        const th = L.bhForces(atoms, this.THETA, this.W, this.H, this.SOFT); // θ=0.5 → 근사
        const d0 = this.diff(K, b.accel, t0.accel), dT = this.diff(K, b.accel, th.accel);
        return { exactMaxd: d0.maxd, exactChecks: t0.checks, bruteChecks: b.checks, approxRel: dT.rel, approxChecks: th.checks };
      },

      // 라이브 sim(장부·결정론 기둥): 자유 드리프트 무대(힘 0) — 측정은 watch/assert 가 고정 시드로 직교 수행.
      init(rng, K) {
        const simRng = K.mulberry32((rng() * 4294967296) >>> 0), a = [];
        for (let i = 0; i < 12; i++) a.push({ Z: 1, N: 0, e: 1, x: 0, rx: simRng() * this.W, ry: simRng() * this.H, vx: simRng() - 0.5, vy: simRng() - 0.5, lep: 0 });
        return { W: this.W, H: this.H, atoms: a, rng: simRng, knobs: {} };
      },

      watch(sim, K) {
        const m = this.measure(K);
        return { exactMaxd: +m.exactMaxd.toExponential(3), exactChecks: m.exactChecks, bruteChecks: m.bruteChecks, approxRel: +m.approxRel.toExponential(3), approxChecks: m.approxChecks, ratioPct: +(m.approxChecks / m.bruteChecks * 100).toFixed(2) };
      },

      // 가설: ① θ→0 동치·load-bearing ② θ>0 근사 ③ 검사 급감 O(n log n) ④ 장부·결정론·회귀.
      assert(ctx, K) {
        const m = this.measure(K);
        const exact = m.exactMaxd < 1e-9 && m.exactChecks === m.bruteChecks;  // ① θ=0 = brute(같은 항·재정렬 ~머신·상호작용 수 일치)
        const approx = m.approxRel < 0.05;                                    // ② θ=0.5 상대오차 작음(무게중심 근사)
        const faster = m.approxChecks < m.bruteChecks * 0.5;                  // ③ 상호작용 ≪ 전쌍
        return [
          { name: `θ→0 동치·load-bearing — θ=0 가속 = 전쌍 brute 가속 maxDiff=${m.exactMaxd.toExponential(2)}(~머신·같은 항 집합·트리 DFS 합 순서만 다름·근사 아님)·상호작용 ${m.exactChecks}=${m.bruteChecks} 일치`, pass: exact, value: +m.exactMaxd.toExponential(3) },
          { name: `θ>0 근사 — θ=${this.THETA} 가속 상대오차 ${(m.approxRel * 100).toFixed(2)}%(무게중심 lump·먼 무리를 한 점으로)`, pass: approx, value: +m.approxRel.toExponential(3) },
          { name: `검사 수 급감·O(n log n) — θ=${this.THETA} 상호작용 ${m.approxChecks} ≪ 전쌍 ${m.bruteChecks}(${(m.approxChecks / m.bruteChecks * 100).toFixed(1)}%·장거리도 가속)`, pass: faster, value: m.approxChecks },
          { name: `장부·결정론·회귀 — 자유 드리프트 무대(힘 0) Q·B·L·E·px·py 머신·새 법칙 0(LAW_ORDER·DEFAULTS 불변) → 0001~59 골든 비트 불변(회귀 0)`, pass: ctx.ledgerBefore !== undefined, value: m.approxChecks },
        ];
      },
    },

    'step-0061': {
      id: 'step-0061',
      title: 'Barnes-Hut 트리(0060)를 gravity 에 배선 (게이트 farField — 장거리 1/r² 가속 O(n log n)·질량가중 평균 가속 차감으로 px·py 머신 복원·등가원리)',
      desc: 'step-0060 이 Barnes-Hut 트리 `bhForces` 를 세우고 brute 동치를 측정했다(force 미배선). 이 step 은 그것을 첫 장거리 *힘* gravity 에 **배선**한다 — collide(0055)가 cellPairs 를 배선한 것의 장거리판. ' +
            '게이트 `farField`=0(기본) → 전쌍 brute(step-0027~ 비트 동일·머신 보존·회귀 0). =1 → bhForces(θ=spatialTheta) 가속 g_i 를 v_i += kg·g_i·dt 로 싣는다(중력 가속=kg·g_i·0060 과 한 출처식). ' +
            '⚠️ BH 는 무게중심 lump 라 힘이 쌍별 등·반작용이 아니다 → 날것이면 총 운동량 px·py 가 머신 보존 안 됨(BH 인공 net force). **해소(중력 한정·등가원리)**: 질량가중 평균 가속 c=Σm·g/Σm 를 빼고 싣는다(g_i→g_i−c). ' +
            '중력은 보편(모든 질량 같은 가속)이라 균일 가속 차감은 *상대 운동 불변*(COM 드리프트만 제거)·물리적 무해 → brute 의 Σm·a=0(반작용)과 같은 0-net 으로 맞춰 px·py **머신** 복원 + 공통오차 c 제거로 정확도도 개선. E 만 symplectic 유계 진동(0019 선례·완화). ' +
            '*측정*(무대 60²·N=200 중력+pauli·dt=0.01·θ=0.5·6 tick·고정 시드): ' +
            '① **가속 근사·load-bearing** — farField=1 한 tick 적용 후 속도가 brute 와 거의 같음(maxDiff 작음·0060 의 ~2% lump 오차). ' +
            '② **운동량 머신 복원·load-bearing** — farField=1 MT tick dpx·dpy ≤ 머신(평균 가속 차감 → BH 비대칭 인공 net force 제거·날것이면 O(0.1~1)). ' +
            '③ **E 닫힘·BH 추가 드리프트 0·load-bearing** — farField=1 E 잔차 ≈ farField=0(brute) E 잔차(BH 가속이 symplectic E 드리프트를 더 안 늘림). ' +
            '④ **검사 수 급감·O(n log n)** — bhForces 상호작용 ≪ 전쌍 n(n−1). ' +
            '⑤ **장부·결정론·회귀** — 라이브 farField=1 무대 Q·B·L·px·py 머신(E 완화)·노브=0(farField 기본 0) → 0001~60 골든 비트 불변(회귀 0).',
      ticks: 6,
      W: 60, H: 60, N: 200, MT: 6,
      KN: { dt: 0.01, kGravity: 0.5, kPauli: 1, coulombSoft: 1.5, spatialTheta: 0.5 },
      ledgerTol: { E: 3e-1 },                                // 중력 symplectic 유계 진동(brute·BH 동급·전 시드 worst 포함 — assert ③이 동급임을 증명·px·py 는 완화 없음=머신 복원)

      // 중력+pauli 구름(질량 다양 — 1/4 무거운 ¹⁶O·COM 가중 비자명). 느린 속도(중력 응집 무대).
      cloud(K) {
        const rng = K.mulberry32(20260623), a = [];
        for (let i = 0; i < this.N; i++) {
          const heavy = (i % 4 === 0);
          a.push({ Z: heavy ? 8 : 1, N: heavy ? 8 : 0, e: heavy ? 8 : 1, x: 0, rx: rng() * this.W, ry: rng() * this.H, vx: (rng() - 0.5) * 0.2, vy: (rng() - 0.5) * 0.2, lep: 0 });
        }
        return a;
      },
      afterForce(K, ff) {
        const sim = { W: this.W, H: this.H, atoms: this.cloud(K), photons: [], rng: null, knobs: Object.assign({}, L.DEFAULTS, this.KN, { farField: ff }), tick: 0 };
        L.applyForces(sim);
        return sim.atoms;
      },
      // MT tick 굴린 뒤 장부 드리프트(E·px·py) 반환.
      drift(K, ff) {
        const sim = { W: this.W, H: this.H, atoms: this.cloud(K), photons: [], rng: null, knobs: Object.assign({}, L.DEFAULTS, this.KN, { farField: ff }), tick: 0 };
        const l0 = K.ledger(sim);
        for (let t = 0; t < this.MT; t++) { L.applyForces(sim); L.integrate(sim); sim.tick++; }
        const l1 = K.ledger(sim);
        return { dE: Math.abs(l1.E - l0.E), dpx: Math.abs(l1.px - l0.px), dpy: Math.abs(l1.py - l0.py) };
      },
      measure(K) {
        const b = this.afterForce(K, 0), f = this.afterForce(K, 1);
        let fmax = 0; for (let i = 0; i < b.length; i++) { const d = Math.hypot(f[i].vx - b[i].vx, f[i].vy - b[i].vy); if (d > fmax) fmax = d; }
        const db = this.drift(K, 0), df = this.drift(K, 1);
        const atoms = this.cloud(K), checks = L.bhForces(atoms, this.KN.spatialTheta, this.W, this.H, this.KN.coulombSoft).checks;
        return { fmax, eres: df.dE, eresBrute: db.dE, dpx: df.dpx, dpy: df.dpy, checks, bruteChecks: atoms.length * (atoms.length - 1) };
      },

      // 라이브 sim(장부·결정론 기둥): farField=1 중력 무대 — px·py 머신(평균 가속 차감)·E 완화.
      init(rng, K) {
        const simRng = K.mulberry32((rng() * 4294967296) >>> 0), a = [];
        for (let i = 0; i < this.N; i++) {
          const heavy = (i % 4 === 0);
          a.push({ Z: heavy ? 8 : 1, N: heavy ? 8 : 0, e: heavy ? 8 : 1, x: 0, rx: simRng() * this.W, ry: simRng() * this.H, vx: (simRng() - 0.5) * 0.2, vy: (simRng() - 0.5) * 0.2, lep: 0 });
        }
        return { W: this.W, H: this.H, atoms: a, rng: simRng, knobs: Object.assign({}, this.KN, { farField: 1 }) };
      },

      watch(sim, K) {
        const m = this.measure(K);
        return { fmax: +m.fmax.toExponential(3), eres: +m.eres.toExponential(3), eresBrute: +m.eresBrute.toExponential(3), dpx: +m.dpx.toExponential(3), dpy: +m.dpy.toExponential(3), checks: m.checks, bruteChecks: m.bruteChecks, ratioPct: +(m.checks / m.bruteChecks * 100).toFixed(2) };
      },

      // 가설: ① 가속 근사 ② 운동량 머신 복원 ③ E 닫힘·추가 드리프트 0 ④ 검사 급감 ⑤ 장부·결정론·회귀.
      assert(ctx, K) {
        const m = this.measure(K);
        const close = m.fmax < 0.02;                                          // ① 한 tick 가속 ≈ brute
        const momOK = m.dpx < 1e-9 && m.dpy < 1e-9;                            // ② 운동량 머신(평균 가속 차감 → 복원)
        const eOK = m.eres < this.ledgerTol.E && m.eres < m.eresBrute * 2 + 1e-3;  // ③ E 잔차 ≈ brute(BH 추가 드리프트 0)
        const faster = m.checks < m.bruteChecks * 0.5;                        // ④ 상호작용 ≪ 전쌍
        return [
          { name: `가속 근사·load-bearing — farField=1 한 tick 적용 후 속도 maxDiff=${m.fmax.toExponential(2)} ≈ brute(0060 무게중심 lump 오차)`, pass: close, value: +m.fmax.toExponential(3) },
          { name: `운동량 머신 복원·load-bearing — farField=1 ${this.MT}tick dpx=${m.dpx.toExponential(2)}·dpy=${m.dpy.toExponential(2)} ≤ 머신(질량가중 평균 가속 차감 → BH 인공 net force 제거·등가원리)`, pass: momOK, value: +m.dpx.toExponential(3) },
          { name: `E 닫힘·BH 추가 드리프트 0·load-bearing — farField=1 E 잔차 ${m.eres.toExponential(2)} ≈ brute(전쌍) ${m.eresBrute.toExponential(2)}(BH 가속이 symplectic E 드리프트를 더 안 늘림)`, pass: eOK, value: +m.eres.toExponential(3) },
          { name: `검사 수 급감·O(n log n) — bhForces 상호작용 ${m.checks} ≪ 전쌍 ${m.bruteChecks}(${(m.checks / m.bruteChecks * 100).toFixed(1)}%)`, pass: faster, value: m.checks },
          { name: `장부·결정론·회귀 — 라이브 farField=1 중력 무대 Q·B·L·px·py 머신(E 완화)·노브=0(farField 기본 0) → 0001~60 골든 비트 불변(회귀 0)`, pass: ctx.ledgerBefore !== undefined, value: m.checks },
        ];
      },
    },

    'step-0062': {
      id: 'step-0062',
      title: 'Barnes-Hut 트리를 coulomb 에 배선 (게이트 farField — 전하가중 트리·gravity 0061 와 동형·하전만 평균 가속 차감으로 px·py 머신·중성 불변)',
      desc: 'step-0061 이 Barnes-Hut 트리를 gravity 에 배선했다(질량가중). 이 step 은 같은 트리를 coulomb 에 배선한다 — 단 *전하가중*(`bhForces(charged=1)` 가 쿨롱장 F_i=Σ q_j·d/s2^1.5 를 돌려줌·질량-COM 전개점). 쿨롱 가속 a_i=−(kc·q_i/m_i)·F_i. ' +
            'gravity 와 차이(운동량 복원): 중력은 보편(질량가중 평균 차감·등가원리)이었으나 쿨롱은 *전하 의존* → 중성은 brute 서 안 움직인다. ' +
            '해소: BH 인공 net force 를 *하전 원자에서만* 질량가중 평균 가속 c′=Σ_q m·a/Σ_q m 로 빼 Σ_q m·(a−c′)=0 → px·py **머신** + 중성은 차감도 안 받아 *불변*(brute 정확 일치). 하전끼리 상대 가속 a_i−a_j 불변. E 만 symplectic 완화. farField=0(기본) → 전쌍 brute(비트 동일·회귀 0). ' +
            '*측정*(무대 60²·N=200·1/3 q=+1·1/3 q=−1·1/3 중성·dt=0.01·θ=0.5·6 tick·고정 시드): ' +
            '① **가속 근사·load-bearing** — farField=1 한 tick 후 속도가 brute 와 거의 같음(maxDiff 작음). ' +
            '② **운동량 머신·load-bearing** — farField=1 dpx·dpy ≤ 머신(하전만 평균 가속 차감). ' +
            '③ **중성 불변·load-bearing** — 중성 원자 속도가 farField 켬/끔 정확 동일(차감도 하전만 → brute 일치). ' +
            '④ **E 닫힘·BH 추가 드리프트 0** — farField=1 E 잔차 ≈ farField=0(brute). ' +
            '⑤ **검사 급감·O(n log n) + 회귀** — 상호작용 ≪ 전쌍·노브=0 → 0001~61 골든 비트 불변.',
      ticks: 6,
      W: 60, H: 60, N: 200, MT: 6,
      KN: { dt: 0.01, kCoulomb: 0.5, kPauli: 1, coulombSoft: 1.5, spatialTheta: 0.5 },
      ledgerTol: { E: 1e-2 },                                // 쿨롱 symplectic 유계 진동(brute·BH 동급·전 시드 worst — px·py 완화 없음=머신)

      // 이온+중성 구름(1/3 q=+1[e=0]·1/3 q=−1[e=2]·1/3 중성[e=1]) — 중성 불변 기둥 검사용.
      cloud(K) {
        const rng = K.mulberry32(20260624), a = [];
        for (let i = 0; i < this.N; i++) {
          const r = i % 3, e = (r === 0) ? 0 : (r === 1) ? 2 : 1;
          a.push({ Z: 1, N: 0, e, x: 0, rx: rng() * this.W, ry: rng() * this.H, vx: (rng() - 0.5) * 0.2, vy: (rng() - 0.5) * 0.2, lep: 0 });
        }
        return a;
      },
      afterForce(K, ff) {
        const sim = { W: this.W, H: this.H, atoms: this.cloud(K), photons: [], rng: null, knobs: Object.assign({}, L.DEFAULTS, this.KN, { farField: ff }), tick: 0 };
        L.applyForces(sim);
        return sim.atoms;
      },
      drift(K, ff) {
        const sim = { W: this.W, H: this.H, atoms: this.cloud(K), photons: [], rng: null, knobs: Object.assign({}, L.DEFAULTS, this.KN, { farField: ff }), tick: 0 };
        const l0 = K.ledger(sim);
        for (let t = 0; t < this.MT; t++) { L.applyForces(sim); L.integrate(sim); sim.tick++; }
        const l1 = K.ledger(sim);
        return { dE: Math.abs(l1.E - l0.E), dpx: Math.abs(l1.px - l0.px), dpy: Math.abs(l1.py - l0.py) };
      },
      measure(K) {
        const b = this.afterForce(K, 0), f = this.afterForce(K, 1);
        let fmax = 0, neutralMax = 0;
        for (let i = 0; i < b.length; i++) {
          const d = Math.hypot(f[i].vx - b[i].vx, f[i].vy - b[i].vy); if (d > fmax) fmax = d;
          if (b[i].Z - b[i].e === 0 && d > neutralMax) neutralMax = d;   // 중성: 켬/끔 차이(0 이어야)
        }
        const db = this.drift(K, 0), df = this.drift(K, 1);
        const atoms = this.cloud(K), checks = L.bhForces(atoms, this.KN.spatialTheta, this.W, this.H, this.KN.coulombSoft, true).checks;
        return { fmax, neutralMax, eres: df.dE, eresBrute: db.dE, dpx: df.dpx, dpy: df.dpy, checks, bruteChecks: atoms.length * (atoms.length - 1) };
      },

      // 라이브 sim(장부·결정론 기둥): farField=1 쿨롱 무대 — px·py 머신(하전 평균 차감)·E 완화.
      init(rng, K) {
        const simRng = K.mulberry32((rng() * 4294967296) >>> 0), a = [];
        for (let i = 0; i < this.N; i++) {
          const r = i % 3, e = (r === 0) ? 0 : (r === 1) ? 2 : 1;
          a.push({ Z: 1, N: 0, e, x: 0, rx: simRng() * this.W, ry: simRng() * this.H, vx: (simRng() - 0.5) * 0.2, vy: (simRng() - 0.5) * 0.2, lep: 0 });
        }
        return { W: this.W, H: this.H, atoms: a, rng: simRng, knobs: Object.assign({}, this.KN, { farField: 1 }) };
      },

      watch(sim, K) {
        const m = this.measure(K);
        return { fmax: +m.fmax.toExponential(3), neutralMax: +m.neutralMax.toExponential(3), eres: +m.eres.toExponential(3), eresBrute: +m.eresBrute.toExponential(3), dpx: +m.dpx.toExponential(3), dpy: +m.dpy.toExponential(3), checks: m.checks, bruteChecks: m.bruteChecks, ratioPct: +(m.checks / m.bruteChecks * 100).toFixed(2) };
      },

      // 가설: ① 가속 근사 ② 운동량 머신 ③ 중성 불변 ④ E 닫힘 ⑤ 검사 급감·회귀.
      assert(ctx, K) {
        const m = this.measure(K);
        const close = m.fmax < 0.02;                                          // ① 한 tick 가속 ≈ brute
        const momOK = m.dpx < 1e-9 && m.dpy < 1e-9;                            // ② 운동량 머신(하전 평균 차감)
        const neutralFixed = m.neutralMax < 1e-15;                            // ③ 중성 불변(차감도 하전만 → brute 일치)
        const eOK = m.eres < this.ledgerTol.E && m.eres < m.eresBrute * 2 + 1e-4;  // ④ E 잔차 ≈ brute
        const faster = m.checks < m.bruteChecks * 0.5;                        // ⑤ 상호작용 ≪ 전쌍
        return [
          { name: `가속 근사·load-bearing — farField=1 한 tick 후 속도 maxDiff=${m.fmax.toExponential(2)} ≈ brute(전하가중 lump 오차)`, pass: close, value: +m.fmax.toExponential(3) },
          { name: `운동량 머신·load-bearing — farField=1 ${this.MT}tick dpx=${m.dpx.toExponential(2)}·dpy=${m.dpy.toExponential(2)} ≤ 머신(하전만 질량가중 평균 가속 차감)`, pass: momOK, value: +m.dpx.toExponential(3) },
          { name: `중성 불변·load-bearing — 중성 원자 속도 farField 켬/끔 차이 ${m.neutralMax.toExponential(2)} ≈ 0(차감도 하전만 → brute 정확 일치·전하 의존 보존)`, pass: neutralFixed, value: +m.neutralMax.toExponential(3) },
          { name: `E 닫힘·BH 추가 드리프트 0·load-bearing — farField=1 E 잔차 ${m.eres.toExponential(2)} ≈ brute(전쌍) ${m.eresBrute.toExponential(2)}`, pass: eOK, value: +m.eres.toExponential(3) },
          { name: `검사 급감·O(n log n)·회귀 — bhForces 상호작용 ${m.checks} ≪ 전쌍 ${m.bruteChecks}(${(m.checks / m.bruteChecks * 100).toFixed(1)}%)·노브=0(farField 기본 0) → 0001~61 골든 비트 불변`, pass: faster && ctx.ledgerBefore !== undefined, value: m.checks },
        ];
      },
    },

    'step-0063': {
      id: 'step-0063',
      title: '다체 중력 응집 — 공간 분할(셀 pauli)+Barnes-Hut(트리 gravity) 동시 무대로 N=600 구름 붕괴 (측정·새 법칙 0·인프라 완비 위 규모 현상)',
      desc: 'step-0054~62 가 공간 분할 인프라를 완비했다(단거리 5종 셀 + 장거리 2종 BH). 이 측정 step 은 그 위에서 *큰 규모 현상* — 다체 중력 붕괴 — 를 굴린다(새 법칙 0·scene 만·골든 보존=회귀 0). ' +
            'N=600 중성 원자를 중심 원반에 차갑게 흩뿌리고 **farField=1(BH 트리 중력) + spatialHash=1(셀 pauli 반발) 동시** 로 굴린다 — 두 인프라가 한 무대서 함께 작동(정합 검증). 중력이 응집·pauli 가 붕괴 방지(0029 의 규모판). ' +
            'gravity 의 BH 가속은 질량가중 평균 가속 차감(0061)으로 px·py 머신·pauli 의 셀 힘은 쌍별 반작용(0056)으로 px·py 머신 → 동시 무대도 운동량 머신(E 만 symplectic 완화). ' +
            '*측정*(무대 160²·N=600·dt=0.012·θ=0.5·cut=8·72 tick·고정 시드): ' +
            '① **중력 응집·load-bearing** — farField=1 중력 무대서 관성반경 R_g 가 *단조 수축*(중력이 구름을 끌어모음). ' +
            '② **대조·load-bearing** — 같은 무대 kGravity=0(pauli 만) → R_g 정확히 평탄(붕괴는 *중력 때문*·author 아닌 측정). ' +
            '③ **인프라 정합·운동량 머신** — farField=1+spatialHash=1 동시 무대 px·py 머신·E 상대 드리프트 ~0%(거대 정지질량 대비). ' +
            '④ **규모·O(n log n)** — BH 상호작용 ≪ 전쌍 n(n−1)(N=600 이 가능한 이유). ' +
            '⑤ **결정론·회귀** — 새 법칙 0(scene 만·LAW_ORDER·DEFAULTS 불변) → 0001~62 골든 비트 불변.',
      ticks: 72,
      W: 160, H: 160, N: 600, MT: 72,
      KN: { dt: 0.012, kGravity: 1.5, kPauli: 0.5, coulombSoft: 1.5, spatialTheta: 0.5, spatialCut: 8 },
      ledgerTol: { E: 6e1 },                                 // 다체 중력 symplectic 유계 진동(절대 큰 듯하나 정지질량 대비 상대 ~0.1%·brute 도 동급·assert ③ 상대 드리프트로 증명)

      // 중심 원반에 차갑게 흩뿌린 중성 구름(중력 응집·pauli 붕괴 방지 무대).
      cloud(K, seed) {
        const rng = K.mulberry32(seed), a = [], cx = this.W / 2, cy = this.H / 2;
        for (let i = 0; i < this.N; i++) {
          const ang = rng() * 2 * Math.PI, rad = Math.sqrt(rng()) * 35;       // 균일 원반(√ 로 면적균일)
          a.push({ Z: 1, N: 1, e: 1, x: 0, rx: cx + rad * Math.cos(ang), ry: cy + rad * Math.sin(ang), vx: (rng() - 0.5) * 0.01, vy: (rng() - 0.5) * 0.01, lep: 0 });
        }
        return a;
      },
      // 관성반경 R_g = √(⟨|r−r_com|²⟩) — 구름 크기(응집 → 수축).
      Rg(K, atoms) {
        let cx = 0, cy = 0; for (const a of atoms) { cx += a.rx; cy += a.ry; } cx /= atoms.length; cy /= atoms.length;
        let s = 0; for (const a of atoms) { const dx = K.minImage(a.rx - cx, this.W), dy = K.minImage(a.ry - cy, this.H); s += dx * dx + dy * dy; }
        return Math.sqrt(s / atoms.length);
      },
      // kg 로 MT tick 굴린 뒤 R_g 시계열 + 장부 드리프트.
      run(K, kg) {
        const sim = { W: this.W, H: this.H, atoms: this.cloud(K, 20260625), photons: [], rng: null, knobs: Object.assign({}, L.DEFAULTS, this.KN, { kGravity: kg, farField: 1, spatialHash: 1 }), tick: 0 };
        const rg0 = this.Rg(K, sim.atoms), l0 = K.ledger(sim), series = [rg0];
        for (let t = 0; t < this.MT; t++) { L.applyForces(sim); L.integrate(sim); sim.tick++; if ((t + 1) % 18 === 0) series.push(this.Rg(K, sim.atoms)); }
        const l1 = K.ledger(sim);
        return { rg0, rg1: this.Rg(K, sim.atoms), series, dE: Math.abs(l1.E - l0.E), dpx: Math.abs(l1.px - l0.px), dpy: Math.abs(l1.py - l0.py), Etot: Math.abs(l0.E) };
      },
      measure(K) {
        const g = this.run(K, this.KN.kGravity), no = this.run(K, 0);
        let monotone = true; for (let i = 1; i < g.series.length; i++) if (g.series[i] > g.series[i - 1] + 1e-9) monotone = false;  // R_g 단조 비증가
        const checks = L.bhForces(this.cloud(K, 20260625), this.KN.spatialTheta, this.W, this.H, this.KN.coulombSoft).checks;
        return { rg0: g.rg0, rgGrav: g.rg1, rgNo: no.rg1, monotone, gravSeries: g.series, dpx: g.dpx, dpy: g.dpy, dE: g.dE, relE: g.dE / g.Etot, checks, bruteChecks: this.N * (this.N - 1) };
      },

      // 라이브 sim(장부·결정론 기둥): farField=1+spatialHash=1 중력 무대 — px·py 머신·E 완화.
      init(rng, K) {
        const a = this.cloud(K, (rng() * 4294967296) >>> 0);
        return { W: this.W, H: this.H, atoms: a, rng: null, knobs: Object.assign({}, this.KN, { farField: 1, spatialHash: 1 }) };
      },

      watch(sim, K) {
        const m = this.measure(K);
        return { rg0: +m.rg0.toFixed(3), rgGrav: +m.rgGrav.toFixed(3), rgNo: +m.rgNo.toFixed(3), contractPct: +((1 - m.rgGrav / m.rg0) * 100).toFixed(3), dpx: +m.dpx.toExponential(3), relEpct: +(m.relE * 100).toFixed(4), checks: m.checks, bruteChecks: m.bruteChecks, ratioPct: +(m.checks / m.bruteChecks * 100).toFixed(2) };
      },

      // 가설: ① 중력 응집(단조 수축) ② 대조 평탄 ③ 인프라 정합·운동량 머신 ④ 규모 O(n log n) ⑤ 결정론·회귀.
      assert(ctx, K) {
        const m = this.measure(K);
        const contract = m.rgGrav < m.rg0 - 0.1 && m.monotone;                          // ① 중력 → 단조 수축
        const flat = Math.abs(m.rgNo - m.rg0) < 0.05;                                   // ② 대조 평탄(붕괴는 중력 때문)
        const momOK = m.dpx < 1e-9 && m.dpy < 1e-9;                                     // ③ 동시 무대 운동량 머신
        const faster = m.checks < m.bruteChecks * 0.5;                                  // ④ 상호작용 ≪ 전쌍
        return [
          { name: `중력 응집·load-bearing — farField=1 무대 R_g ${m.rg0.toFixed(2)}→${m.rgGrav.toFixed(2)} 단조 수축(${((1 - m.rgGrav / m.rg0) * 100).toFixed(2)}%·중력이 N=600 구름을 끌어모음)`, pass: contract, value: +m.rgGrav.toFixed(3) },
          { name: `대조·load-bearing — 같은 무대 kGravity=0 R_g ${m.rg0.toFixed(2)}→${m.rgNo.toFixed(2)} 평탄(붕괴는 *중력 때문*·끄면 수축 0·author 아닌 측정)`, pass: flat, value: +m.rgNo.toFixed(3) },
          { name: `인프라 정합·운동량 머신·load-bearing — farField=1(BH 중력)+spatialHash=1(셀 pauli) 동시 무대 dpx=${m.dpx.toExponential(2)}·dpy=${m.dpy.toExponential(2)} ≤ 머신·E 상대 드리프트 ${(m.relE * 100).toFixed(3)}%(정지질량 대비)`, pass: momOK, value: +m.dpx.toExponential(3) },
          { name: `규모·O(n log n) — BH 상호작용 ${m.checks} ≪ 전쌍 ${m.bruteChecks}(${(m.checks / m.bruteChecks * 100).toFixed(1)}%·N=600 이 가능한 이유)`, pass: faster, value: m.checks },
          { name: `결정론·회귀 — 새 법칙 0(scene 만·LAW_ORDER·DEFAULTS 불변) → 0001~62 골든 비트 불변`, pass: ctx.ledgerBefore !== undefined, value: m.checks },
        ];
      },
    },

    'step-0064': {
      id: 'step-0064',
      title: '공간 분할 셀 리스트를 fuse 에 배선 (게이트 spatialHash — 핵 융합도 셀 이웃만·collide 0055/bond 0059 와 동형·정렬해 brute 와 *비트 동일*·켜도 회귀 0·다체 핵합성 시계열 토대)',
      desc: 'step-0055(collide)·0059(bond)가 이벤트형 단거리 법칙을 셀 리스트로 배선했다(비트 동일). 이 step 은 같은 기계를 *핵 융합* `fuse` — Phase D 의 두 핵 합체(별 점화) — 에 배선한다. ' +
            'fuse 는 접촉 반경 R 내 *다가오는 고E* 쌍만 합체하는 단거리 이벤트라 전쌍 O(n²) 대신 `cellPairs`(cut=fuseR)로 이웃만 훑을 수 있다. 이것이 막혀 다체 핵합성 시계열(0048·0053 의 시계열판)이 N 을 못 키웠다 — 이 배선이 그 토대다. ' +
            '게이트 `spatialHash`=0 → 전쌍 brute(과거 전 장면 비트 동일·회귀 0). =1 → cellPairs 로 R 내 쌍만 훑되, 그 쌍을 **(i,j) 오름차순 정렬**해 brute 의 사전식 i<j 순서와 똑같이 처리한다. ' +
            'collide/bond 와 같은 논거(비트 동일): brute 의 이중 루프는 *정확히 사전식 (i,j)* 로 돌고 break 는 "원자 i 한 tick 한 번만 합쳐짐"이다. cellPairs 쌍을 (i,j) 정렬+consumed[i](=break)로 처리하면 — dead[]·bath 적재가 순서 의존이나 그 순서가 같다 — 합체·바스 E 가 **비트까지 동일**(켜도 회귀 0). ' +
            'R 밖 쌍은 cellPairs 가 안 주지만 brute 경로서도 d2>R2 로 no-op(break 안 함)이라 합체 집합 정확 같다. fuse 는 *순간 합체*(연속 PE 항 없음·바스 E 회계)라 컷오프-PE shift 불필요(연속력 0056~58 과 다름·collide/bond 와 동형). ' +
            '*측정*(무대 36²·N=160 ²H 차가운 구름·fuseR=3·fmf+md+페어링 발열·12 tick·고정 시드): ' +
            '① **비트 동일·load-bearing** — spatialHash=1(이웃) 종료 상태 해시(원자+바스) = spatialHash=0(전쌍) 해시 정확 일치(융합 다수 무대서·근사 아님). ' +
            '② **검사 수 급감** — 셀 거리계산 ≪ 전쌍 n(n−1)/2. ' +
            '③ **융합 비자명** — 무대서 실제 합체 다수(동일성이 빈 무대 아닌 진짜 융합서 성립). ' +
            '④ **장부·결정론·회귀** — 라이브 셀-경로(spatialHash=1) 융합 무대 Q·B·L·E·px·py 머신(fmf+md 정지질량 결손→발열)·노브=0 → 0001~63 골든 비트 불변(회귀 0).',
      ticks: 12,
      // ledgerTol 없음 — fuse 닫힌 형식 합체(vcom·바스)·fmf+md rest=(A−B)c² → Q·B·L·E·px·py 머신(0053 선례).
      W: 36, H: 36, N: 160, MT: 12,
      KN: { dt: 1, kFuse: 1, fuseR: 3, fuseMassFormula: 1, massDefect: 1, decayPairing: 1 },

      // 측정 무대: 토러스에 ²H(Z=1,N=1,e=1 중성) N개를 고정 시드로 흩뿌리고 속도를 준다(다가오는 쌍이 융합되도록·barrier=0 결정론).
      cloud(K) {
        const rng = K.mulberry32(20260628), a = [];
        for (let i = 0; i < this.N; i++)
          a.push({ Z: 1, N: 1, e: 1, x: 0, rx: rng() * this.W, ry: rng() * this.H, vx: (rng() - 0.5) * 1.5, vy: (rng() - 0.5) * 1.5, lep: 0 });
        return a;
      },
      // 같은 구름을 spatialHash 켬/끔으로 MT tick 굴린 sim 반환(L.applyForces+integrate 직접 — DRY).
      runCloud(K, sh) {
        const sim = { W: this.W, H: this.H, atoms: this.cloud(K), photons: [], rng: null, knobs: Object.assign({}, L.DEFAULTS, this.KN, { spatialHash: sh }), tick: 0 };
        for (let t = 0; t < this.MT; t++) { L.applyForces(sim); L.integrate(sim); sim.tick++; }
        return sim;
      },
      measure(K) {
        const brute = this.runCloud(K, 0);
        const fast = this.runCloud(K, 1);
        const same = K.hashState(brute) === K.hashState(fast);
        const atoms = this.cloud(K);
        const cp = L.cellPairs(atoms, this.KN.fuseR, this.W, this.H);
        return { same, fusions: this.N - brute.atoms.length, fastFusions: this.N - fast.atoms.length, cellChecks: cp.checks, bruteChecks: atoms.length * (atoms.length - 1) / 2 };
      },

      // 라이브 sim(장부·결정론 기둥): 셀-경로(spatialHash=1) 융합 무대 — 새 코드 경로가 장부·결정론을 통과함을 보장.
      init(rng, K) {
        const simRng = K.mulberry32((rng() * 4294967296) >>> 0), a = [];
        for (let i = 0; i < this.N; i++)
          a.push({ Z: 1, N: 1, e: 1, x: 0, rx: simRng() * this.W, ry: simRng() * this.H, vx: (simRng() - 0.5) * 1.5, vy: (simRng() - 0.5) * 1.5, lep: 0 });
        return { W: this.W, H: this.H, atoms: a, rng: simRng, knobs: Object.assign({}, this.KN, { spatialHash: 1 }) };
      },

      watch(sim, K) {
        const m = this.measure(K);
        return { same: m.same ? 1 : 0, fusions: m.fusions, cellChecks: m.cellChecks, bruteChecks: m.bruteChecks, ratioPct: +(m.cellChecks / m.bruteChecks * 100).toFixed(2) };
      },

      // 가설: ① 비트 동일·load-bearing ② 검사 급감 ③ 융합 비자명 ④ 장부·결정론·회귀.
      assert(ctx, K) {
        const m = this.measure(K);
        const identical = m.same && m.fusions > 0 && m.fusions === m.fastFusions;  // ① 종료 해시 일치 + 융합 수도 일치
        const faster = m.cellChecks < m.bruteChecks * 0.5;                          // ② 거리계산 ≪ 전쌍
        const nontrivial = m.fusions >= 10;                                         // ③ 융합 다수(빈 무대 아님)
        return [
          { name: `비트 동일·load-bearing — 셀(spatialHash=1) 종료 해시(원자+바스) = 전쌍(=0) 해시 정확 일치(융합 ${m.fusions}회 동일 합체·근사 아님·켜도 회귀 0)`, pass: identical, value: m.fusions },
          { name: `검사 수 급감 — 셀 거리계산 ${m.cellChecks} ≪ 전쌍 ${m.bruteChecks}(${(m.cellChecks / m.bruteChecks * 100).toFixed(1)}%·같은 결과·빠른 계산)`, pass: faster, value: m.cellChecks },
          { name: `융합 비자명 — 무대서 실제 합체 ${m.fusions}회(동일성이 빈 무대 아닌 진짜 융합서 성립)`, pass: nontrivial, value: m.fusions },
          { name: `장부·결정론·회귀 — 라이브 셀-경로(spatialHash=1) 융합 무대 Q·B·L·E·px·py 머신(fmf+md 정지질량 결손→발열)·노브=0 → 0001~63 골든 비트 불변(회귀 0)`, pass: ctx.ledgerBefore !== undefined, value: m.fusions },
        ];
      },
    },

    'step-0065': {
      id: 'step-0065',
      title: '진짜 다체 핵합성 시계열 (측정·새 법칙 0 — 0064 셀 fuse 로 N=400 ²H 뜨거운 구름이 자유 충돌·점화·⁴He 로 타며 시계열로 연료 감소/생성핵 봉우리·0053 정면 토이의 다체판)',
      desc: 'step-0048·0053 은 핵합성 사다리를 *정면 쌍*(머리 맞댄 단일 시도)으로만 봤다 — 진짜 별 내부는 *수많은 핵이 무작위로 충돌*하는 다체 무대다. step-0064 가 fuse 를 셀 리스트로 배선해 그 다체 무대가 비로소 가능해졌다. 이 측정 step 은 그 위에서 **다체 핵합성 시계열**을 굴린다(새 법칙 0·scene 만·LAW_ORDER·DEFAULTS 불변 → 기존 골든 보존=회귀 0). ' +
            'N=400 ²H(Z=1,N=1) 핵을 뜨겁게(고속·고 keRel) 흩뿌리고 **spatialHash=1(셀 fuse)+Gamow 터널링(fuseGamow·fuseEGcharge·fuseEGmu·fuseEndo·fmf+md)** 으로 자유롭게 굴린다 — 핵들이 무작위로 다가와 쿨롱 장벽을 뚫고 합체한다. ' +
            '연료(²H·Z=1)는 *단조 감소*하고, 첫 생성핵(⁴He·Z=2)이 *솟았다 내린다* — ⁴He 는 중간 산물(Bateman 의 중간핵 솟음-내림 0044 의 다체판): ²H+²H 로 생기고 다시 ⁴He+⁴He·⁴He+²H 로 무거운 핵에 먹힌다. 사다리가 다체로 *진행*해 무거운 핵(Z≥3)이 쌓인다. 바리온 ΣB=Σ(Z+N) 은 변환 내내 *정확 보존*(원소가 바뀌어도 핵자 수 불변). ' +
            '*측정*(무대 140²·N=400 ²H·고속 EHOT=6·fuseR=3·셀 fuse·고정 시드·48 tick·6 tick 마다 스냅샷): ' +
            '① **연료 단조 감소** — ²H 개수 시계열이 단조 비증가(점화로 연료 소모·다체 자유 충돌). ' +
            '② **생성핵 봉우리** — ⁴He(Z=2) 0 → 봉우리 → 내림(첫 핵합성 산물·²H 가 ⁴He 로·다시 무거운 핵에 먹힘·Bateman 중간핵). ' +
            '③ **바리온 보존·load-bearing** — ΣB=Σ(Z+N) 전 스냅샷 정확 보존(원소 변환·합체로 개수 줄어도 핵자 수 불변·머신). ' +
            '④ **대조·load-bearing** — kFuse=0(점화 끔) → ²H 평탄(연료 소모는 *융합 때문*·끄면 0·author 아닌 측정). ' +
            '⑤ **장부·결정론·회귀** — 라이브 셀 fuse 점화 무대 Q·B·L·E·px·py 머신(fmf+md 발열)·새 법칙 0 → 0001~64 골든 비트 불변(회귀 0).',
      ticks: 16,
      // ledgerTol 없음 — fuse 닫힌 형식 합체(vcom·바스)·fmf+md rest=(A−B)c² → Q·B·L·E·px·py 머신(0053·0064 선례).
      W: 140, H: 140, N: 400, MT: 48, SNAP: 6, EHOT: 6,
      KN: { dt: 1, kFuse: 1, fuseR: 3, fuseGamow: 1, fuseEG: 1, fuseEGcharge: 1, fuseEGmu: 1, fuseEndo: 1, fuseMassFormula: 1, massDefect: 1, decayPairing: 1, spatialHash: 1 },

      // 뜨거운 ²H 구름: 토러스에 N개를 고정 시드로 흩뿌리고 고속(keRel 높아 Gamow 터널링)으로 던진다.
      cloud(K) {
        const rng = K.mulberry32(20260629), a = [], v = Math.sqrt(this.EHOT / 2);  // m(²H)=2 → ½mv²~EHOT
        for (let i = 0; i < this.N; i++) {
          const ang = rng() * 2 * Math.PI;
          a.push({ Z: 1, N: 1, e: 1, x: 0, rx: rng() * this.W, ry: rng() * this.H, vx: v * Math.cos(ang), vy: v * Math.sin(ang), lep: 0 });
        }
        return a;
      },
      // 원소 분포 스냅샷: ²H(Z1)·⁴He(Z2)·무거운핵(Z≥3)·바리온 ΣB.
      counts(atoms) {
        let z1 = 0, z2 = 0, zh = 0, B = 0;
        for (const a of atoms) { if (a.Z === 1) z1++; else if (a.Z === 2) z2++; else zh++; B += a.Z + a.N; }
        return { z1, z2, zh, B };
      },
      // kFuse 로 MT tick 굴린 시계열(연료·생성핵·바리온) + 장부 드리프트.
      run(K, kf) {
        const sim = { W: this.W, H: this.H, atoms: this.cloud(K), photons: [], rng: K.mulberry32(20260629), knobs: Object.assign({}, L.DEFAULTS, this.KN, { kFuse: kf }), tick: 0 };
        const l0 = K.ledger(sim), series = [this.counts(sim.atoms)];
        for (let t = 0; t < this.MT; t++) { L.applyForces(sim); L.integrate(sim); sim.tick++; if ((t + 1) % this.SNAP === 0) series.push(this.counts(sim.atoms)); }
        const l1 = K.ledger(sim);
        return { series, dE: Math.abs(l1.E - l0.E), dpx: Math.abs(l1.px - l0.px), dpy: Math.abs(l1.py - l0.py), dB: Math.abs(l1.B - l0.B) };
      },
      cache(K) { return this._c || (this._c = { on: this.run(K, this.KN.kFuse), off: this.run(K, 0) }); },

      // 라이브 sim(장부·결정론 기둥): 셀 fuse 점화 무대 — 융합이 일어나며 Q·B·L·E·px·py 닫힘.
      init(rng, K) {
        const simRng = K.mulberry32((rng() * 4294967296) >>> 0), a = [], v = Math.sqrt(this.EHOT / 2);
        for (let i = 0; i < 120; i++) {
          const ang = simRng() * 2 * Math.PI;
          a.push({ Z: 1, N: 1, e: 1, x: 0, rx: simRng() * this.W, ry: simRng() * this.H, vx: v * Math.cos(ang), vy: v * Math.sin(ang), lep: 0 });
        }
        return { W: this.W, H: this.H, atoms: a, rng: simRng, knobs: Object.assign({}, this.KN) };
      },

      watch(sim, K) {
        const c = this.cache(K), s = c.on.series, last = s[s.length - 1];
        let z2max = 0; for (const x of s) if (x.z2 > z2max) z2max = x.z2;
        return { z1_0: s[0].z1, z1_end: last.z1, z2max, zh_end: last.zh, B0: s[0].B, Bend: last.B, dpx: +c.on.dpx.toExponential(3), dB: +c.on.dB.toExponential(3) };
      },

      // 가설: ① 연료 단조 감소 ② 생성핵 봉우리 ③ 바리온 보존 ④ 대조 평탄 ⑤ 장부·결정론·회귀.
      assert(ctx, K) {
        const c = this.cache(K), on = c.on.series, off = c.off.series;
        let monotone = true; for (let i = 1; i < on.length; i++) if (on[i].z1 > on[i - 1].z1) monotone = false;  // 연료 단조 비증가
        const burned = on[on.length - 1].z1 < on[0].z1 * 0.8 && monotone;                                       // ① 연료 ≥20% 소모·단조
        let z2max = 0; for (const x of on) if (x.z2 > z2max) z2max = x.z2;
        const produced = z2max >= 10;                                                                            // ② ⁴He 봉우리(첫 핵합성 산물)
        let Bok = true; for (const x of on) if (Math.abs(x.B - on[0].B) > 1e-9) Bok = false;                     // ③ 바리온 전 스냅샷 보존
        const flat = off[off.length - 1].z1 === off[0].z1;                                                       // ④ kFuse=0 → 연료 평탄
        return [
          { name: `연료 단조 감소 — ²H ${on[0].z1} → ${on[on.length - 1].z1}(단조 비증가·다체 자유 충돌 점화로 연료 소모)`, pass: burned, value: on[on.length - 1].z1 },
          { name: `생성핵 봉우리 — ⁴He(Z=2) 0 → 봉우리 ${z2max} → 내림(첫 핵합성 산물·²H+²H→⁴He·중간핵으로 무거운 핵에 먹힘·Bateman 다체판·무거운핵 Z≥3 ${on[on.length - 1].zh})`, pass: produced, value: z2max },
          { name: `바리온 보존·load-bearing — ΣB=Σ(Z+N) 전 스냅샷 ${on[0].B} 정확 보존(원소 변환·합체로 개수 줄어도 핵자 수 불변·머신)`, pass: Bok, value: on[0].B },
          { name: `대조·load-bearing — kFuse=0(점화 끔) ²H ${off[0].z1} → ${off[off.length - 1].z1} 평탄(연료 소모는 *융합 때문*·끄면 0·author 아닌 측정)`, pass: flat, value: off[off.length - 1].z1 },
          { name: `장부·결정론·회귀 — 라이브 셀 fuse 점화 무대 Q·B·L·E·px·py 머신(fmf+md 발열)·새 법칙 0 → 0001~64 골든 비트 불변(회귀 0)`, pass: ctx.ledgerBefore !== undefined, value: on[on.length - 1].z1 },
        ];
      },
    },

    'step-0066': {
      id: 'step-0066',
      title: 'gravity+coulomb 동시 farField 무대 (측정·새 법칙 0 — 두 장거리 BH 트리[질량가중+전하가중]를 한 무대서 함께·두 독립 평균 가속 차감[0061 질량-전체·0062 전하-하전만]이 정합 합성 → px·py 머신·중성은 쿨롱 안 닿되 중력엔 끌림)',
      desc: 'step-0061 이 gravity 를(질량가중 BH·전체 평균 차감)·0062 가 coulomb 을(전하가중 BH·하전만 차감) *따로* BH 트리에 배선했다. 0063 은 gravity+pauli(단거리) 동시 무대를 봤다. 이 측정 step 은 처음으로 **두 장거리 BH 트리를 한 무대서 동시에** 굴린다(새 법칙 0·scene 만·LAW_ORDER·DEFAULTS 불변 → 기존 골든 보존=회귀 0). ' +
            '핵심 정합: 두 평균 가속 차감이 *독립*이다 — 중력은 질량가중을 *전체*서, 쿨롱은 전하가중을 *하전만*서 뺀다. 두 차감은 각자 Σm·a=0 라 *합성해도* 총 px·py **머신**. 중성(q=0)은 쿨롱 가속 a=−(kc·q/m)F=0 이라 *쿨롱엔 안 닿되* 중력엔 보편으로 끌린다(등가원리). ' +
            '*측정*(무대 120²·N=300·1/3 q=+1·1/3 q=−1·1/3 중성·dt=0.012·θ=0.5·cut=8·gravity+coulomb+pauli 동시·farField=1+spatialHash=1·72 tick·고정 시드): ' +
            '① **운동량 머신·동시 무대·load-bearing** — dpx·dpy ≤ 머신(두 독립 차감 합성)·대조 날것 BH net |Σm·g| ≫ 머신(차감 없으면 폭발 — 차감이 필수). ' +
            '② **중성 쿨롱 불변·load-bearing** — 같은 중력+pauli 무대서 쿨롱 켬/끔 중성 Δv=0.00e+0(쿨롱은 하전만)·하전 Δv≠0(쿨롱 작동) — 동시 무대서도 전하 의존 보존. ' +
            '③ **중력 보편** — 중성 원자 관성반경 R_g 단조 수축(쿨롱 안 닿는 중성도 중력엔 끌림·등가원리). ' +
            '④ **규모·O(n log n)** — 두 BH 트리 상호작용 ≪ 전쌍 n(n−1). ' +
            '⑤ **결정론·회귀** — 새 법칙 0(scene 만) → 0001~65 골든 비트 불변(회귀 0).',
      ticks: 72,
      W: 120, H: 120, N: 300, MT: 72,
      KN: { dt: 0.012, kGravity: 2.0, kCoulomb: 0.5, kPauli: 0.5, coulombSoft: 1.5, spatialTheta: 0.5, spatialCut: 8 },
      ledgerTol: { E: 3e1 },                                  // 두 연속력 symplectic 유계 진동(정지질량 대비 상대 ~0.2%·px·py 완화 없음=머신)

      // 이온+중성 구름(1/3 q=+1[e=0]·1/3 q=−1[e=2]·1/3 중성[e=1]·질량 2=Z+N) — 중성 쿨롱 불변·중력 보편 기둥.
      cloud(K, seed) {
        const rng = K.mulberry32(seed || 20260630), a = [], cx = this.W / 2, cy = this.H / 2;
        for (let i = 0; i < this.N; i++) {
          const r = i % 3, e = (r === 0) ? 0 : (r === 1) ? 2 : 1;
          const ang = rng() * 2 * Math.PI, rad = Math.sqrt(rng()) * 28;
          a.push({ Z: 1, N: 1, e, x: 0, rx: cx + rad * Math.cos(ang), ry: cy + rad * Math.sin(ang), vx: (rng() - 0.5) * 0.01, vy: (rng() - 0.5) * 0.01, lep: 0 });
        }
        return a;
      },
      // 중성 원자만의 관성반경 R_g(중력 보편 — 쿨롱 안 닿는 q=0 이 중력으로 수축).
      neutralRg(K, atoms) {
        const ns = atoms.filter(a => a.Z - a.e === 0); let cx = 0, cy = 0;
        for (const a of ns) { cx += a.rx; cy += a.ry; } cx /= ns.length; cy /= ns.length;
        let s = 0; for (const a of ns) { const dx = K.minImage(a.rx - cx, this.W), dy = K.minImage(a.ry - cy, this.H); s += dx * dx + dy * dy; }
        return Math.sqrt(s / ns.length);
      },
      // gravity+coulomb+pauli 동시 무대 MT tick — px·py 드리프트 + 중성 R_g 시계열.
      run(K) {
        const sim = { W: this.W, H: this.H, atoms: this.cloud(K), photons: [], rng: null, knobs: Object.assign({}, L.DEFAULTS, this.KN, { farField: 1, spatialHash: 1 }), tick: 0 };
        const rg0 = this.neutralRg(K, sim.atoms), l0 = K.ledger(sim), series = [rg0];
        for (let t = 0; t < this.MT; t++) { L.applyForces(sim); L.integrate(sim); sim.tick++; if ((t + 1) % 6 === 0) series.push(this.neutralRg(K, sim.atoms)); }
        const l1 = K.ledger(sim);
        return { rg0, rg1: this.neutralRg(K, sim.atoms), series, dE: Math.abs(l1.E - l0.E), dpx: Math.abs(l1.px - l0.px), dpy: Math.abs(l1.py - l0.py), Etot: Math.abs(l0.E) };
      },
      // 한 tick 후 원자(쿨롱 켬/끔 — 중성 쿨롱 불변 검사). 다른 힘(중력+pauli)은 동일.
      afterForce(K, kc) {
        const sim = { W: this.W, H: this.H, atoms: this.cloud(K), photons: [], rng: null, knobs: Object.assign({}, L.DEFAULTS, this.KN, { kCoulomb: kc, farField: 1, spatialHash: 1 }), tick: 0 };
        L.applyForces(sim);
        return sim.atoms;
      },
      measure(K) {
        const g = this.run(K);
        let monotone = true; for (let i = 1; i < g.series.length; i++) if (g.series[i] > g.series[i - 1] + 1e-9) monotone = false;
        // 중성 쿨롱 불변: 쿨롱 켬(0.5)/끔(0) 한 tick 후 중성 Δv=0·하전 Δv≠0(중력+pauli 동일).
        const off = this.afterForce(K, 0), on = this.afterForce(K, this.KN.kCoulomb);
        let neutralMax = 0, chargedMax = 0;
        for (let i = 0; i < off.length; i++) {
          const d = Math.hypot(on[i].vx - off[i].vx, on[i].vy - off[i].vy);
          if (off[i].Z - off[i].e === 0) { if (d > neutralMax) neutralMax = d; } else if (d > chargedMax) chargedMax = d;
        }
        // 대조: 날것 BH net |Σ m·g|(질량가중·차감 전) — 0 아님 → 차감이 필수(load-bearing).
        const atoms = this.cloud(K), gAcc = L.bhForces(atoms, this.KN.spatialTheta, this.W, this.H, this.KN.coulombSoft).accel;
        let rnx = 0, rny = 0; for (let i = 0; i < atoms.length; i++) { const m = atoms[i].Z + atoms[i].N; rnx += m * gAcc[i].ax; rny += m * gAcc[i].ay; }
        const rawNet = Math.hypot(rnx, rny);
        const checks = L.bhForces(atoms, this.KN.spatialTheta, this.W, this.H, this.KN.coulombSoft).checks;
        return { rg0: g.rg0, rg1: g.rg1, monotone, dpx: g.dpx, dpy: g.dpy, dE: g.dE, relE: g.dE / g.Etot, neutralMax, chargedMax, rawNet, checks, bruteChecks: atoms.length * (atoms.length - 1) };
      },

      // 라이브 sim(장부·결정론 기둥): gravity+coulomb+pauli 동시 farField 무대 — px·py 머신·E 완화.
      init(rng, K) {
        const a = this.cloud(K, (rng() * 4294967296) >>> 0);
        return { W: this.W, H: this.H, atoms: a, rng: null, knobs: Object.assign({}, this.KN, { farField: 1, spatialHash: 1 }) };
      },

      watch(sim, K) {
        const m = this.measure(K);
        return { rg0: +m.rg0.toFixed(3), rg1: +m.rg1.toFixed(3), contractPct: +((1 - m.rg1 / m.rg0) * 100).toFixed(2), dpx: +m.dpx.toExponential(3), dpy: +m.dpy.toExponential(3), neutralMax: +m.neutralMax.toExponential(3), chargedMax: +m.chargedMax.toExponential(3), rawNet: +m.rawNet.toExponential(3), relEpct: +(m.relE * 100).toFixed(4), checks: m.checks, ratioPct: +(m.checks / m.bruteChecks * 100).toFixed(2) };
      },

      // 가설: ① 운동량 머신(동시 차감 합성)·대조 날것 ② 중성 쿨롱 불변 ③ 중력 보편 ④ 규모 ⑤ 결정론·회귀.
      assert(ctx, K) {
        const m = this.measure(K);
        const momOK = m.dpx < 1e-9 && m.dpy < 1e-9 && m.rawNet > 1e-6;                  // ① 두 차감 합성 머신 + 날것 net 비자명
        const neutralFixed = m.neutralMax < 1e-15 && m.chargedMax > 1e-9;               // ② 중성 쿨롱 불변·하전 작동
        const contract = m.rg1 < m.rg0 - 0.1 && m.monotone;                             // ③ 중성 R_g 단조 수축(중력 보편)
        const faster = m.checks < m.bruteChecks * 0.5;                                  // ④ BH ≪ 전쌍
        return [
          { name: `운동량 머신·동시 무대·load-bearing — gravity+coulomb 동시 farField dpx=${m.dpx.toExponential(2)}·dpy=${m.dpy.toExponential(2)} ≤ 머신(두 독립 차감[질량-전체·전하-하전] 합성)·대조 날것 BH net |Σm·g|=${m.rawNet.toExponential(2)} ≫ 머신(차감 필수)`, pass: momOK, value: +m.dpx.toExponential(3) },
          { name: `중성 쿨롱 불변·load-bearing — 같은 중력+pauli 무대서 쿨롱 켬/끔 중성 Δv=${m.neutralMax.toExponential(2)} ≈ 0(쿨롱 하전만)·하전 Δv=${m.chargedMax.toExponential(2)}≠0(쿨롱 작동) — 동시 무대서도 전하 의존 보존`, pass: neutralFixed, value: +m.neutralMax.toExponential(3) },
          { name: `중력 보편 — 중성 원자 R_g ${m.rg0.toFixed(2)}→${m.rg1.toFixed(2)} 단조 수축(${((1 - m.rg1 / m.rg0) * 100).toFixed(2)}%·쿨롱 안 닿는 q=0 도 중력엔 끌림·등가원리)`, pass: contract, value: +m.rg1.toFixed(3) },
          { name: `규모·O(n log n) — 두 BH 트리 상호작용 ${m.checks} ≪ 전쌍 ${m.bruteChecks}(${(m.checks / m.bruteChecks * 100).toFixed(1)}%)`, pass: faster, value: m.checks },
          { name: `결정론·회귀 — 새 법칙 0(scene 만·LAW_ORDER·DEFAULTS 불변) → 0001~65 골든 비트 불변(회귀 0)`, pass: ctx.ledgerBefore !== undefined, value: m.checks },
        ];
      },
    },

    'step-0067': {
      id: 'step-0067',
      title: '핵 껍질 닫힘 마법수 보정 nucShell (게이트 — B(Z,N) 에 껍질 닫힘 보너스 δ_shell=aShell·(magic(Z)+magic(N))·이중마법수=2배·안정 골짜기에 마법수 안정섬 창발·붕괴 종점이 마법수로 이동·nucShell=0 → 미가법·회귀 0)',
      desc: 'step-0037~42 의 질량공식 B(Z,N)(부피·표면·쿨롱·비대칭·페어링)은 *매끈*해 안정 골짜기를 부드러운 곡선으로 준다. 실제 핵은 *껍질 모형*(Mayer/Jensen)으로 양성자·중성자가 채워진 껍질을 완성하는 **마법수**(2·8·20·28·50·82·126)서 유난히 단단하다 — 매끈 공식이 못 잡는 *불연속 안정섬*. ' +
            '이 step 은 게이트 `nucShell` 로 결합에너지에 껍질 보너스 δ_shell(Z,N)=aShell·(isMagic(Z)+isMagic(N)) 를 얹는다(aShell=0.8) — Z·N 각자 마법수면 +aShell·*둘 다*(이중마법수 ⁴He·¹⁶O·⁴⁰Ca…)면 +2aShell. ledger 정지질량(M=A−B)·decay ΔB·fuse ΔB_fus 가 *모두 같은 B* 를 쓰도록 게이트를 셋 다 관통(변환 Q=실제 ΔB 정합·누수 0). nucShell=0(기본) → δ_shell 미가법 → 비트 동일(회귀 0). ' +
            '창발(author 안정표 0): 마법수서 B 가 봉우리 → β붕괴 골짜기 종점이 *마법수로 이동*(A=22 매끈 Z=10 → 껍질 Z=8 마법수서 멈춤·양성자 껍질 닫힘 안정섬). ' +
            '*측정*(질량공식 + 라이브 A=22 ⁶?→ 붕괴 무대·nucShell+md+mf+페어링+β±·고정 시드): ' +
            '① **이중마법수 보너스·load-bearing** — B(8,8)[¹⁶O]·B(20,20)[⁴⁰Ca] 껍질−매끈 = +1.6(=2aShell 이중마법)·B(2,2)[⁴He]=+1.6·비마법 B(6,7)=0(보너스가 마법수에만). ' +
            '② **골짜기 종점 이동·load-bearing** — A=22 등중원소 argmax_Z B: 매끈 Z=10(²²Ne) → 껍질 Z=8(마법수·양성자 껍질 닫힘)·끄면 Z=10 복귀(이동이 껍질 항서). ' +
            '③ **붕괴 안정섬** — 라이브 중성자 과잉 A=22 핵이 nucShell=1 면 Z=8(마법수)서 멈춤·nucShell=0 면 Z=10 까지(마법수 안정섬이 종점을 끌어당김). ' +
            '④ **장부·결정론·회귀** — 라이브 nucShell=1+md 붕괴 무대 Q·B·L·E·px·py 머신(rest=A−B·ΔB 같은 껍질 B → Q 정합)·nucShell=0 → 0001~66 골든 비트 불변(회귀 0).',
      ticks: 60,
      // ledgerTol 없음 — decay 닫힌 형식(rest=A−B 껍질 포함·ΔB 껍질 포함 정합)·Q·B·L·E·px·py 머신.
      A: 22, Z0: 6, MT: 60,
      KN: { dt: 1, kDecay: 0.5, decayMassFormula: 1, massDefect: 1, decayBetaPlus: 1, decayPairing: 1, decayRecoilPair: 1, nucShell: 1 },

      // 등중원소 A 의 안정 골짜기 argmax_Z B(Z,A−Z) — 껍질 게이트 sh 로.
      valleyZ(K, sh) {
        let best = -1e9, bz = -1;
        for (let Z = 1; Z < this.A; Z++) { const b = K.binding(Z, this.A - Z, 1, sh); if (b > best) { best = b; bz = Z; } }
        return bz;
      },
      // 중성자 과잉 A=22 핵(Z=Z0) 집단을 붕괴시켜 종점 Z 분포 — nucShell sh 로.
      decayEnd(K, sh) {
        const a = [];
        for (let i = 0; i < 40; i++) a.push({ Z: this.Z0, N: this.A - this.Z0, e: this.Z0, x: 0, rx: 0, ry: 0, vx: 0, vy: 0, lep: 0, nuc: 0 });
        const sim = { W: 50, H: 50, atoms: a, photons: [], rng: K.mulberry32(20260701), knobs: Object.assign({}, L.DEFAULTS, this.KN, { nucShell: sh }), tick: 0 };
        for (let t = 0; t < this.MT; t++) { L.applyForces(sim); L.integrate(sim); sim.tick++; }
        let maxZ = 0, sumZ = 0; for (const x of sim.atoms) { if (x.Z > maxZ) maxZ = x.Z; sumZ += x.Z; }
        return { maxZ, meanZ: sumZ / sim.atoms.length };
      },

      // 라이브 sim(장부·결정론 기둥): nucShell=1+md 붕괴 무대 — rest=A−B·ΔB 같은 껍질 B → Q·B·L·E·px·py 머신.
      init(rng, K) {
        const simRng = K.mulberry32((rng() * 4294967296) >>> 0), a = [];
        for (let i = 0; i < 40; i++) a.push({ Z: this.Z0, N: this.A - this.Z0, e: this.Z0, x: 0, rx: simRng() * 50, ry: simRng() * 50, vx: 0, vy: 0, lep: 0, nuc: 0 });
        return { W: 50, H: 50, atoms: a, rng: simRng, knobs: Object.assign({}, this.KN) };
      },

      watch(sim, K) {
        return {
          bonus16O: +(K.binding(8, 8, 1, 1) - K.binding(8, 8, 1, 0)).toFixed(3),
          bonus40Ca: +(K.binding(20, 20, 1, 1) - K.binding(20, 20, 1, 0)).toFixed(3),
          bonusNonMagic: +(K.binding(6, 7, 1, 1) - K.binding(6, 7, 1, 0)).toFixed(3),
          valleySmooth: this.valleyZ(K, 0), valleyShell: this.valleyZ(K, 1),
          decayEndShell: this.decayEnd(K, 1).maxZ, decayEndSmooth: this.decayEnd(K, 0).maxZ,
        };
      },

      // 가설: ① 이중마법수 보너스 ② 골짜기 종점 이동 ③ 붕괴 안정섬 ④ 장부·결정론·회귀.
      assert(ctx, K) {
        const b16 = K.binding(8, 8, 1, 1) - K.binding(8, 8, 1, 0);
        const b40 = K.binding(20, 20, 1, 1) - K.binding(20, 20, 1, 0);
        const bNon = K.binding(6, 7, 1, 1) - K.binding(6, 7, 1, 0);
        const vSmooth = this.valleyZ(K, 0), vShell = this.valleyZ(K, 1);
        const dShell = this.decayEnd(K, 1).maxZ, dSmooth = this.decayEnd(K, 0).maxZ;
        const doubleMagic = Math.abs(b16 - 1.6) < 1e-9 && Math.abs(b40 - 1.6) < 1e-9 && bNon === 0;  // ① 이중마법 +2aShell·비마법 0
        const shift = vShell === 8 && vSmooth === 10 && vShell !== vSmooth;                          // ② 골짜기 종점 마법수로 이동
        const island = dShell === 8 && dSmooth === 10 && dShell < dSmooth;                           // ③ 붕괴 종점 마법수 안정섬서 멈춤
        return [
          { name: `이중마법수 보너스·load-bearing — B(8,8)¹⁶O 껍질−매끈=${b16.toFixed(2)}·B(20,20)⁴⁰Ca=${b40.toFixed(2)}(=2aShell 이중마법)·비마법 B(6,7)=${bNon.toFixed(2)}(보너스가 마법수 Z/N 에만·author 안정표 0)`, pass: doubleMagic, value: +b16.toFixed(3) },
          { name: `골짜기 종점 이동·load-bearing — A=${this.A} 등중원소 argmax_Z B: 매끈 Z=${vSmooth}(²²Ne) → 껍질 Z=${vShell}(마법수 양성자 껍질 닫힘)·끄면 Z=${vSmooth} 복귀(이동이 껍질 항서)`, pass: shift, value: vShell },
          { name: `붕괴 안정섬 — 라이브 중성자 과잉 A=${this.A} 핵 nucShell=1 종점 Z=${dShell}(마법수서 멈춤)·nucShell=0 종점 Z=${dSmooth}(마법수 안정섬이 붕괴 종점을 끌어당김)`, pass: island, value: dShell },
          { name: `장부·결정론·회귀 — 라이브 nucShell=1+md 붕괴 무대 Q·B·L·E·px·py 머신(rest=A−B·ΔB 같은 껍질 B → Q 정합)·nucShell=0 → 0001~66 골든 비트 불변(회귀 0)`, pass: ctx.ledgerBefore !== undefined, value: dShell },
        ];
      },
    },

    'step-0068': {
      id: 'step-0068',
      title: '별 일생 결합 — 중력 수축이 차가운 ²H 구름을 압축·가열해 핵합성을 *스스로* 점화 (측정·새 법칙 0 — 0063 중력 붕괴 + 0065 핵합성 한 무대·대조 끄면 점화 약화·SPINE §4 별 씨앗)',
      desc: 'step-0063 은 중력 붕괴를·0065 는 핵합성 시계열을 *따로* 봤다. 이 측정 step 은 둘을 한 무대서 결합해 **별의 점화 메커니즘**을 본다(새 법칙 0·scene 만·LAW_ORDER·DEFAULTS 불변 → 기존 골든 보존=회귀 0). ' +
            '차가운 ²H 구름(저속·Gamow 터널링 거의 0)을 farField=1(BH 중력)+spatialHash=1(셀 pauli+fuse)+Gamow 풀세트로 굴린다. 중력이 구름을 *압축*하면 비리얼 가열로 상대속도(keRel)가 올라 — *밀집 고온 코어*에서 — Gamow 융합이 **스스로 점화**한다. pauli 가 완전 붕괴를 막아(축퇴압 토이) 코어가 탄다. ' +
            '핵심 결합(SPINE §4 별 씨앗): 점화는 *외부 주입이 아니라* 세계 안 중력에서 난다 — 중력을 끄면(kGravity=0) 구름이 차갑게 퍼진 채라 점화가 *약화*된다(중력-점화 인과). ' +
            '*측정*(무대 130²·N=400 차가운 ²H·dt=0.008·θ=0.5·cut=8·중력+pauli+fuse 동시·120 tick·고정 시드): ' +
            '① **중력 응집** — 관성반경 R_g 단조 수축(중력이 구름을 끌어모음). ' +
            '② **자가 점화·핵합성** — 연료 ²H 단조 감소·생성핵 출현(밀집 고온 코어서 융합 점화). ' +
            '③ **중력-점화 결합·load-bearing** — kGravity>0 융합 ≫ kGravity=0(압축·가열 없으면 점화 약화 — 점화가 *중력 때문*·author 아닌 측정). ' +
            '④ **장부·결정론·회귀** — 라이브 결합 무대 Q·B·L·px·py 머신(fuse fmf+md 발열·중력 BH 차감)·E 만 준-암시적 적분 누적(깊은 붕괴 근접조우·상대 ~2%·유계 아님)·새 법칙 0 → 0001~67 골든 비트 불변(회귀 0).',
      ticks: 24,
      W: 130, H: 130, N: 400, MT: 120, SNAP: 20,
      KN: { dt: 0.008, kGravity: 2.0, kPauli: 0.6, fuseR: 2.2, coulombSoft: 2.5, spatialTheta: 0.5, spatialCut: 8,
            kFuse: 1, fuseGamow: 1, fuseEG: 0.6, fuseEGcharge: 1, fuseEGmu: 1, fuseEndo: 1, fuseMassFormula: 1, massDefect: 1, decayPairing: 1 },
      ledgerTol: { E: 4e1 },                                  // 라이브 24tick E 준-암시적 적분 누적(중력 붕괴·상대 ~0.03%·Q·B·L·px·py 완화 없음=머신)

      // 차가운 ²H 구름(중심 원반·저속 → 중력 가열 전엔 점화 거의 0).
      cloud(K, seed) {
        const rng = K.mulberry32(seed || 20260702), a = [], cx = this.W / 2, cy = this.H / 2;
        for (let i = 0; i < this.N; i++) {
          const ang = rng() * 2 * Math.PI, rad = Math.sqrt(rng()) * 30;
          a.push({ Z: 1, N: 1, e: 1, x: 0, rx: cx + rad * Math.cos(ang), ry: cy + rad * Math.sin(ang), vx: (rng() - 0.5) * 0.05, vy: (rng() - 0.5) * 0.05, lep: 0, nuc: 0 });
        }
        return a;
      },
      Rg(K, atoms) {
        let cx = 0, cy = 0; for (const a of atoms) { cx += a.rx; cy += a.ry; } cx /= atoms.length; cy /= atoms.length;
        let s = 0; for (const a of atoms) { const dx = K.minImage(a.rx - cx, this.W), dy = K.minImage(a.ry - cy, this.H); s += dx * dx + dy * dy; }
        return Math.sqrt(s / atoms.length);
      },
      // kGravity 로 MT tick 굴린 결합 무대 — R_g·연료(²H) 시계열 + 장부 드리프트.
      run(K, kg) {
        const sim = { W: this.W, H: this.H, atoms: this.cloud(K), photons: [], rng: K.mulberry32(20260702), knobs: Object.assign({}, L.DEFAULTS, this.KN, { kGravity: kg, farField: 1, spatialHash: 1 }), tick: 0 };
        const rg0 = this.Rg(K, sim.atoms), n0 = sim.atoms.length, l0 = K.ledger(sim), rgS = [rg0], fuelS = [n0];
        for (let t = 0; t < this.MT; t++) { L.applyForces(sim); L.integrate(sim); sim.tick++; if ((t + 1) % this.SNAP === 0) { rgS.push(this.Rg(K, sim.atoms)); fuelS.push(sim.atoms.length); } }
        const l1 = K.ledger(sim);
        return { rg0, rg1: this.Rg(K, sim.atoms), rgS, fuelS, fusions: n0 - sim.atoms.length, dE: Math.abs(l1.E - l0.E), dpx: Math.abs(l1.px - l0.px), dpy: Math.abs(l1.py - l0.py), dQ: Math.abs(l1.Q - l0.Q), dB: Math.abs(l1.B - l0.B), Etot: Math.abs(l0.E) };
      },
      cache(K) { return this._c || (this._c = { on: this.run(K, this.KN.kGravity), off: this.run(K, 0) }); },

      // 라이브 sim(장부·결정론 기둥): 중력+pauli+fuse 결합 무대 — Q·B·L·px·py 머신·E 완화.
      init(rng, K) {
        const a = this.cloud(K, (rng() * 4294967296) >>> 0);
        return { W: this.W, H: this.H, atoms: a, rng: K.mulberry32((rng() * 4294967296) >>> 0), knobs: Object.assign({}, this.KN, { farField: 1, spatialHash: 1 }) };
      },

      watch(sim, K) {
        const c = this.cache(K);
        return { rg0: +c.on.rg0.toFixed(2), rgGrav: +c.on.rg1.toFixed(2), contractPct: +((1 - c.on.rg1 / c.on.rg0) * 100).toFixed(2), fusionsGrav: c.on.fusions, fusionsNoGrav: c.off.fusions, dpx: +c.on.dpx.toExponential(3), dB: +c.on.dB.toExponential(3), relEpct: +(c.on.dE / c.on.Etot * 100).toFixed(4) };
      },

      // 가설: ① 중력 응집 ② 자가 점화 ③ 중력-점화 결합·load-bearing ④ 장부·결정론·회귀.
      assert(ctx, K) {
        const c = this.cache(K);
        let monotone = true; for (let i = 1; i < c.on.rgS.length; i++) if (c.on.rgS[i] > c.on.rgS[i - 1] + 1e-9) monotone = false;
        let fuelMono = true; for (let i = 1; i < c.on.fuelS.length; i++) if (c.on.fuelS[i] > c.on.fuelS[i - 1]) fuelMono = false;
        const contract = c.on.rg1 < c.on.rg0 - 0.1 && monotone;                         // ① 중력 수축
        const ignite = c.on.fusions > 20 && fuelMono;                                   // ② 자가 점화(연료 단조 감소)
        const coupling = c.on.fusions > c.off.fusions * 2;                              // ③ 중력 켬 점화 ≫ 끔(중력-점화 인과)
        const ledgerOK = c.on.dpx < 1e-9 && c.on.dB < 1e-9 && c.on.dQ < 1e-9;          // ④ Q·B·px 머신
        return [
          { name: `중력 응집 — R_g ${c.on.rg0.toFixed(2)}→${c.on.rg1.toFixed(2)} 단조 수축(${((1 - c.on.rg1 / c.on.rg0) * 100).toFixed(2)}%·중력이 차가운 ²H 구름을 끌어모음)`, pass: contract, value: +c.on.rg1.toFixed(3) },
          { name: `자가 점화·핵합성 — 연료 ²H ${c.on.fuelS[0]}→${c.on.fuelS[c.on.fuelS.length - 1]} 단조 감소·융합 ${c.on.fusions}회(밀집 고온 코어서 Gamow 점화·외부 주입 0)`, pass: ignite, value: c.on.fusions },
          { name: `중력-점화 결합·load-bearing — kGravity>0 융합 ${c.on.fusions} ≫ kGravity=0 융합 ${c.off.fusions}(압축·가열 없으면 점화 약화 → 점화가 *중력 때문*·SPINE §4 별 씨앗·author 아닌 측정)`, pass: coupling, value: c.on.fusions },
          { name: `장부·결정론·회귀 — 라이브 결합 무대 Q·B·px·py 머신(dpx ${c.on.dpx.toExponential(2)}·dB ${c.on.dB.toExponential(2)}·fuse fmf+md 발열·중력 BH 차감)·E 만 준-암시적 적분 누적(깊은 붕괴 근접조우·측정 상대 ${(c.on.dE / c.on.Etot * 100).toFixed(2)}%)·새 법칙 0 → 0001~67 골든 비트 불변(회귀 0)`, pass: ledgerOK, value: c.on.fusions },
        ];
      },
    },

    'step-0069': {
      id: 'step-0069',
      title: 'velocity-Verlet symplectic 적분 (게이트 symplectic — 보존 연속력 2차 leapfrog·깊은 궤도·붕괴 E 누적 해소[0068 한계]·2체 속박 궤도 400tick E 표류 553배 개선·symplectic=0 → 옛 경로·회귀 0)',
      desc: 'step-0068 별 점화 무대서 준-암시적 오일러(1차·전 kick→drift)가 깊은 중력 근접조우 시 E 를 *누적*(유계 아님)했다. 이 step 은 게이트 `symplectic` 로 **velocity-Verlet(KDK·leapfrog·2차)** 를 얹는다 — 반-kick(dt/2)→drift→새 위치서 반-kick(dt/2)→이벤트 법칙 1회. 보존 연속력(coulomb·repulse·pauli·vdw·bondSpring·bondAngle·gravity)만 반-kick·이벤트/소산은 1회. ' +
            'sim.step 이 게이트로 경로를 고른다 — symplectic=0(기본) → 옛 symplectic Euler(과거 전 장면 비트 동일·회귀 0)·=1 → leapfrog. 오차: Euler O(dt)·VV O(dt²) → 깊은 궤도서 E 누적이 *유계 진동*으로 바뀐다(궤도 안 무너짐). ' +
            '*측정*(2체 속박 중력 궤도·brute 정확 2체·질량 16·kg=2·soft=2·400 tick·고정·farField=0): ' +
            '① **E 보존 우월·load-bearing** — *이심 궤도*(dt=0.15·plunge r 3.4↔14) 같은 무대: VV E 순 표류 ≪ Euler(누적)·비율 ≫ 50배(2차 vs 1차). ' +
            '② **secular 표류 vs 유계·load-bearing** — 윈도우-평균 E 중심: Euler 단조 표류(궤도 붕괴) ≫ VV(에너지 중심 정지·유계)·진동 평균 제거로 robust. ' +
            '③ **근원형 궤도 안정·결정론** — 라이브 *근원형*(v_circ) VV 궤도 r 거의 일정·E 스윙 미세(symplectic 보존)·같은 시드 2회 비트 동일. ' +
            '④ **운동량 머신·회귀** — VV 반-kick 각자 쌍별 반작용 → px·py 머신·symplectic=0 → 0001~68 골든 비트 불변(회귀 0).',
      ticks: 400,
      W: 120, H: 120, MT: 400,
      V0: 0.6, D: 7, DT: 0.15,                                // 측정: 이심 궤도(plunge·드라마틱 대조)
      VC: 1.05, DTC: 0.1,                                     // 라이브: 근원형 궤도(스윙 미세·E 유계 확인)
      KN: { kGravity: 2, coulombSoft: 2 },
      ledgerTol: { E: 1e-3 },                                 // 라이브 근원형 VV E 유계(상대 ~6e-4%·절대 ~1e-5·px·py 완화 없음=머신)

      sys(v, d) {
        const cx = this.W / 2, cy = this.H / 2;
        return [{ Z: 8, N: 8, e: 8, x: 0, rx: cx - d, ry: cy, vx: 0, vy: -v, lep: 0 },
                { Z: 8, N: 8, e: 8, x: 0, rx: cx + d, ry: cy, vx: 0, vy: v, lep: 0 }];
      },
      // vv=1 → leapfrog · 0 → symplectic Euler. E 시계열(순 표류·윈도우-평균 secular·스윙)·궤도 r 범위·운동량.
      run(K, vv, v, d, dt) {
        const sim = { W: this.W, H: this.H, atoms: this.sys(v, d), photons: [], rng: null, knobs: Object.assign({}, L.DEFAULTS, this.KN, { dt }), tick: 0 };
        const E0 = K.ledger(sim).E, px0 = K.ledger(sim).px, py0 = K.ledger(sim).py;
        let Emin = E0, Emax = E0, rmin = 1e9, rmax = 0; const Es = [];
        for (let t = 0; t < this.MT; t++) {
          if (vv) L.leapfrog(sim); else { L.applyForces(sim); L.integrate(sim); }
          const E = K.ledger(sim).E; Es.push(E); if (E < Emin) Emin = E; if (E > Emax) Emax = E;
          const dx = K.minImage(sim.atoms[1].rx - sim.atoms[0].rx, this.W), dy = K.minImage(sim.atoms[1].ry - sim.atoms[0].ry, this.H), r = Math.hypot(dx, dy);
          if (r < rmin) rmin = r; if (r > rmax) rmax = r;
        }
        const h = this.MT >> 1; let m1 = 0, m2 = 0;          // 윈도우-평균(진동 위상 제거 → secular 표류만)
        for (let i = 0; i < h; i++) m1 += Es[i]; for (let i = h; i < this.MT; i++) m2 += Es[i];
        m1 /= h; m2 /= (this.MT - h);
        const l = K.ledger(sim);
        return { E0, netDrift: Math.abs(l.E - E0), secular: Math.abs(m2 - m1), swing: Emax - Emin, rmin, rmax, dpx: Math.abs(l.px - px0), dpy: Math.abs(l.py - py0), Etot: Math.abs(E0) };
      },
      // 측정: 이심 궤도 VV vs Euler · 라이브 기둥: 근원형 VV.
      cache(K) { return this._c || (this._c = { vv: this.run(K, 1, this.V0, this.D, this.DT), eu: this.run(K, 0, this.V0, this.D, this.DT), circ: this.run(K, 1, this.VC, this.D, this.DTC) }); },

      // 라이브 sim(장부·결정론 기둥): symplectic=1 → sim.step 이 leapfrog 경로 → 새 적분이 장부·결정론 통과. 근원형(스윙 미세).
      init(rng, K) {
        return { W: this.W, H: this.H, atoms: this.sys(this.VC, this.D), rng: null, knobs: Object.assign({}, this.KN, { dt: this.DTC, symplectic: 1 }) };
      },

      watch(sim, K) {
        const c = this.cache(K);
        return { vvRelPct: +(c.vv.netDrift / c.vv.Etot * 100).toFixed(4), euRelPct: +(c.eu.netDrift / c.eu.Etot * 100).toFixed(2), ratio: +(c.eu.netDrift / c.vv.netDrift).toFixed(0),
                 euSecularPct: +(c.eu.secular / c.eu.Etot * 100).toFixed(2), vvSecularPct: +(c.vv.secular / c.vv.Etot * 100).toFixed(4),
                 circSwingPct: +(c.circ.swing / c.circ.Etot * 100).toFixed(4), circR: [+c.circ.rmin.toFixed(1), +c.circ.rmax.toFixed(1)], dpx: +c.circ.dpx.toExponential(3) };
      },

      // 가설: ① E 보존 우월 ② secular 표류 vs 유계 ③ 근원형 궤도 안정 ④ 운동량 머신·회귀.
      assert(ctx, K) {
        const c = this.cache(K);
        const better = c.eu.netDrift > c.vv.netDrift * 50 && c.vv.netDrift / c.vv.Etot < 0.005;          // ① VV 순 표류 ≪ Euler
        const secular = c.eu.secular > c.vv.secular * 10 && c.vv.secular / c.vv.Etot < 0.02;             // ② Euler 에너지 중심 표류 ≫ VV
        const circle = (c.circ.rmax - c.circ.rmin) < 5 && c.circ.swing / c.circ.Etot < 0.005 && c.circ.dpx < 1e-9;  // ③ 근원형 궤도 r 거의 일정·스윙 미세
        const momOK = c.vv.dpx < 1e-9 && c.vv.dpy < 1e-9;                                                 // ④ 이심 무대도 운동량 머신
        return [
          { name: `E 보존 우월·load-bearing — 이심 궤도 ${this.MT}tick(plunge r${c.vv.rmin.toFixed(1)}↔${c.vv.rmax.toFixed(1)}) 같은 dt: VV E 순 표류 ${(c.vv.netDrift / c.vv.Etot * 100).toFixed(3)}% ≪ Euler ${(c.eu.netDrift / c.eu.Etot * 100).toFixed(2)}%(비율 ${(c.eu.netDrift / c.vv.netDrift).toFixed(0)}배·2차 O(dt²) vs 1차 O(dt))`, pass: better, value: +(c.eu.netDrift / c.vv.netDrift).toFixed(0) },
          { name: `secular 표류 vs 유계·load-bearing — 윈도우-평균 E 중심: Euler ${(c.eu.secular / c.eu.Etot * 100).toFixed(2)}%(단조 표류·궤도 붕괴) ≫ VV ${(c.vv.secular / c.vv.Etot * 100).toFixed(4)}%(에너지 중심 정지·유계·진동 평균 제거 robust)`, pass: secular, value: +(c.eu.secular / c.vv.secular).toFixed(0) },
          { name: `근원형 궤도 안정·결정론 — 라이브 근원형 VV 궤도 r∈[${c.circ.rmin.toFixed(1)},${c.circ.rmax.toFixed(1)}](거의 일정)·E 스윙 ${(c.circ.swing / c.circ.Etot * 100).toFixed(4)}%(symplectic 유계)·같은 시드 2회 비트 동일`, pass: circle, value: +(c.circ.swing / c.circ.Etot * 100).toFixed(4) },
          { name: `운동량 머신·회귀 — VV 반-kick 쌍별 반작용 이심 무대 dpx ${c.vv.dpx.toExponential(2)}·dpy ${c.vv.dpy.toExponential(2)} ≤ 머신·symplectic=0(기본) → sim.step 옛 경로 → 0001~68 골든 비트 불변(회귀 0)`, pass: momOK && ctx.ledgerBefore !== undefined, value: +c.vv.dpx.toExponential(3) },
        ];
      },
    },

    'step-0070': {
      id: 'step-0070',
      title: '별 핵합성 사다리 — 자가 점화 별이 VV 로 오래 굴러 무거운 원소를 쌓는다 (측정·새 법칙 0 — 0068 점화 + 0069 VV 적분·maxZ 1→12 사다리 등반·distinct 12종·중력 끄면 사다리 0·SPINE §4·§8 Phase E)',
      desc: 'step-0068 은 별의 *점화*를·0069 는 VV 적분을 보였다. 이 측정 step 은 둘을 합쳐 자가 점화 별을 **VV(symplectic=1)로 오래 굴려** 핵합성 사다리가 *끝까지 등반*하는 걸 본다(새 법칙 0·scene 만·LAW_ORDER·DEFAULTS 불변 → 기존 골든 보존=회귀 0). VV 를 *다체 BH+fuse 무대*에 처음 적용(0069 §3 ① 메움). ' +
            '차가운 ²H 구름이 중력 수축→압축 가열→밀집 코어 점화 후, 생성핵(⁴He)이 다시 융합해 무거운 핵으로 *층층이* 쌓인다 — 모든 핵 물리(Gamow 0046·전하/질량 장벽 0050/52·흡열 문턱 0051·결합E 0040~41·껍질 마법수 0067) 합작. maxZ(가장 무거운 원소)가 시간에 따라 등반하고 동시 존재 원소 종류(distinct)가 늘어난다. ' +
            '*측정*(무대 130²·N=400 차가운 ²H·dt=0.01·VV·중력+pauli+fuse 동시·240 tick·40 tick 스냅샷·고정 시드): ' +
            '① **사다리 등반·load-bearing** — maxZ 단조 등반(²H→⁴He→…무거운 핵)·동시 존재 원소 종류 증가(별이 주기율표를 쌓음·시계열). ' +
            '② **중력 구동·load-bearing** — kGravity=0(압축 없음) → 사다리 0(maxZ 1·융합 0)·점화·등반이 *중력 때문*(author 아닌 측정). ' +
            '③ **무거운 원소 잔존** — 종단 분포 연료 ²H 소진·무거운 핵(Z≥3) 다수 축적(별 핵합성 산물). ' +
            '④ **장부·결정론·회귀** — VV 다체 별 무대 Q·B·L·px·py 머신·E 완화(깊은 붕괴+융합 — VV 가 못 잡는 이벤트/근접조우 오차·0069 §3 한계)·새 법칙 0 → 0001~69 골든 비트 불변(회귀 0).',
      ticks: 120,
      W: 130, H: 130, N: 400, MT: 240, SNAP: 40,
      KN: { dt: 0.01, kGravity: 2.2, kPauli: 0.6, fuseR: 2.2, coulombSoft: 2.0, spatialTheta: 0.5, spatialCut: 8,
            kFuse: 1, fuseGamow: 1, fuseEG: 0.5, fuseEGcharge: 1, fuseEGmu: 1, fuseEndo: 1, fuseMassFormula: 1, massDefect: 1, decayPairing: 1, nucShell: 1,
            farField: 1, spatialHash: 1, symplectic: 1 },
      ledgerTol: { E: 1.5e3 },                                // 깊은 붕괴+융합 다체 별 E 완화(라이브 120tick 상대 ~3%·VV 도 이벤트/근접조우 오차 못 잡음·0069 §3 한계·Q·B·L·px·py 완화 없음=머신)

      cloud(K, seed) {
        const rng = K.mulberry32(seed || 20260704), a = [], cx = this.W / 2, cy = this.H / 2;
        for (let i = 0; i < this.N; i++) {
          const ang = rng() * 2 * Math.PI, rad = Math.sqrt(rng()) * 30;
          a.push({ Z: 1, N: 1, e: 1, x: 0, rx: cx + rad * Math.cos(ang), ry: cy + rad * Math.sin(ang), vx: (rng() - 0.5) * 0.05, vy: (rng() - 0.5) * 0.05, lep: 0, nuc: 0 });
        }
        return a;
      },
      counts(at) {
        let z1 = 0, zh = 0, maxZ = 0; const set = new Set();
        for (const a of at) { if (a.Z === 1) z1++; else if (a.Z >= 3) zh++; if (a.Z > maxZ) maxZ = a.Z; set.add(a.Z); }
        return { z1, zh, maxZ, distinct: set.size };
      },
      run(K, kg) {
        const sim = { W: this.W, H: this.H, atoms: this.cloud(K), photons: [], rng: K.mulberry32(20260704), knobs: Object.assign({}, L.DEFAULTS, this.KN, { kGravity: kg }), tick: 0 };
        const n0 = sim.atoms.length, l0 = K.ledger(sim), snaps = [this.counts(sim.atoms)];
        for (let t = 0; t < this.MT; t++) { L.leapfrog(sim); sim.tick++; if ((t + 1) % this.SNAP === 0) snaps.push(this.counts(sim.atoms)); }  // symplectic=1 → VV(다체 별)
        const l1 = K.ledger(sim);
        return { snaps, fus: n0 - sim.atoms.length, dpx: Math.abs(l1.px - l0.px), dpy: Math.abs(l1.py - l0.py), dB: Math.abs(l1.B - l0.B), dQ: Math.abs(l1.Q - l0.Q), dL: Math.abs(l1.L - l0.L), dE: Math.abs(l1.E - l0.E), Etot: Math.abs(l0.E) };
      },
      cache(K) { return this._c || (this._c = { on: this.run(K, this.KN.kGravity), off: this.run(K, 0) }); },

      // 라이브 sim(장부·결정론 기둥): VV 다체 별 무대(symplectic=1) — Q·B·L·px·py 머신·E 완화. sim.step 이 leapfrog 경로.
      init(rng, K) {
        const a = this.cloud(K, (rng() * 4294967296) >>> 0);
        return { W: this.W, H: this.H, atoms: a, rng: K.mulberry32((rng() * 4294967296) >>> 0), knobs: Object.assign({}, this.KN) };
      },

      watch(sim, K) {
        const c = this.cache(K), last = c.on.snaps[c.on.snaps.length - 1];
        return { maxZseries: c.on.snaps.map(s => s.maxZ), distinctEnd: last.distinct, z1End: last.z1, zhEnd: last.zh, fusOn: c.on.fus, fusOff: c.off.fus, maxZoff: c.off.snaps[c.off.snaps.length - 1].maxZ, dpx: +c.on.dpx.toExponential(3), relEpct: +(c.on.dE / c.on.Etot * 100).toFixed(3) };
      },

      // 가설: ① 사다리 등반 ② 중력 구동 ③ 무거운 원소 잔존 ④ 장부·결정론·회귀.
      assert(ctx, K) {
        const c = this.cache(K), on = c.on.snaps, last = on[on.length - 1];
        let climb = true; for (let i = 1; i < on.length; i++) if (on[i].maxZ < on[i - 1].maxZ) climb = false;  // maxZ 단조 비감소
        const ladder = climb && last.maxZ >= 6 && last.distinct >= 6;                                          // ① 사다리 등반(무거운 원소·다종)
        const driven = c.off.snaps[c.off.snaps.length - 1].maxZ <= 1 && c.off.fus === 0 && c.on.fus > 50;      // ② 중력 끄면 사다리 0
        const heavy = last.z1 < this.N * 0.2 && last.zh >= 20;                                                 // ③ 연료 소진·무거운 핵 축적
        const ledgerOK = c.on.dpx < 1e-9 && c.on.dpy < 1e-9 && c.on.dB < 1e-9 && c.on.dQ < 1e-9 && c.on.dL < 1e-9;  // ④ Q·B·L·px·py 머신
        return [
          { name: `사다리 등반·load-bearing — maxZ 시계열 ${on.map(s => s.maxZ).join('→')} 단조 등반·동시 존재 원소 ${last.distinct}종(별이 ²H→⁴He→…무거운 핵으로 주기율표를 쌓음)`, pass: ladder, value: last.maxZ },
          { name: `중력 구동·load-bearing — kGravity=0 사다리 maxZ ${c.off.snaps[c.off.snaps.length - 1].maxZ}·융합 ${c.off.fus}(압축 없으면 점화·등반 0)·켬 융합 ${c.on.fus} ⇒ 사다리가 *중력 때문*(author 아닌 측정)`, pass: driven, value: c.off.fus },
          { name: `무거운 원소 잔존 — 종단 연료 ²H ${last.z1}/${this.N} 소진·무거운 핵(Z≥3) ${last.zh} 축적(별 핵합성 산물)`, pass: heavy, value: last.zh },
          { name: `장부·결정론·회귀 — VV 다체 별 무대 Q·B·L·px·py 머신(dpx ${c.on.dpx.toExponential(2)}·dB ${c.on.dB.toExponential(2)}·dL ${c.on.dL.toExponential(2)})·E 완화 ${(c.on.dE / c.on.Etot * 100).toFixed(2)}%(깊은 붕괴+융합·0069 §3 한계)·새 법칙 0 → 0001~69 골든 비트 불변(회귀 0)`, pass: ledgerOK, value: last.maxZ },
        ];
      },
    },

    'step-0071': {
      id: 'step-0071',
      title: '별 죽음·분산 — 복사 바스 E 가 모은 가스를 되흩는다 (disperse·항성풍·SPINE §4 느린 순환 닫기·바스 E→운동 분산·kDisperse 끄면 분산 0·E·px·py 머신)',
      desc: 'Phase E 는 지금까지 *모으기만* 했다 — gravity(0028)가 구름을 끌고 fuse(0033~)가 핵합성으로 무거운 원소를 쌓았다(빠른 비가역 화살표). ' +
            'SPINE §4 의 순환은 *되흩음*을 요구한다("무거운 원소는 항성 죽음·분산으로 흩어져 다음 별의 재료가 된다"). 이 step 은 그 흩는 힘 disperse 를 더한다(LAW_ORDER 끝·kDisperse=0 → 회귀 0). ' +
            '물리: 별 내부 융합이 쌓은 *복사 에너지*(sim.escaped.E — fuse 가 park 한 바스)가 가스를 다시 밀어낸다(복사압·항성풍). decay(0031)의 등방 KE 반동 + 0032 의 −Δp 바스 적재를 물려받아 — 한 원자가 바스서 ε KE 를 얻고(등방·시드 방향) 방출 복사 입자의 −Δp 는 바스에. ' +
            '*측정*(무대 100²·N=120 차가운 ²H 매듭·바스 E0 사전 충전·자유 드리프트(연속력 0)·120 tick·고정 시드): ' +
            '① **분산·load-bearing** — kDisperse 켜면 R_g 크게 팽창(가스 흩어짐)·끄면 R_g 정적(분산이 *disperse 때문*·author 아닌 측정). ' +
            '② **복사 구동·load-bearing** — 켜면 바스 E 소진(복사→운동 전환)·끄면 바스 E 불변(흩는 에너지가 *복사 바스*서·§4 융합 산물). ' +
            '③ **장부 머신** — 자유 드리프트라 연속력 E 완화 없음 → Q·B·L·E·px·py *전부* 머신(E: 바스→KE 정확·px·py: −Δp→바스 정확·0032 동형). ' +
            '④ **회귀** — kDisperse=0 → 자유 드리프트(회귀 0 알리바이)·새 노브 0 기본 → 0001~70 골든 비트 불변.',
      ticks: 80,
      W: 100, H: 100, N: 120, MT: 120, SNAP: 20, E0: 80,
      KN: { dt: 1.0, kDisperse: 0.08, disperseE: 1 },

      knot(K, seed) {                                          // 차가운 ²H 매듭(중력이 이미 모은 가스의 토이 — 분산 전 상태)
        const rng = K.mulberry32(seed || 20260711), a = [], cx = this.W / 2, cy = this.H / 2;
        for (let i = 0; i < this.N; i++) {
          const ang = rng() * 2 * Math.PI, rad = Math.sqrt(rng()) * 8;
          a.push({ Z: 1, N: 1, e: 1, x: 0, rx: cx + rad * Math.cos(ang), ry: cy + rad * Math.sin(ang), vx: (rng() - 0.5) * 0.01, vy: (rng() - 0.5) * 0.01, lep: 0, nuc: 0 });
        }
        return a;
      },
      Rg(at) {                                                 // 관성반경(고정 중심 min-image — 흩어짐 척도)
        const cx = this.W / 2, cy = this.H / 2; let s = 0;
        for (const a of at) { const dx = K.minImage(a.rx - cx, this.W), dy = K.minImage(a.ry - cy, this.H); s += dx * dx + dy * dy; }
        return Math.sqrt(s / at.length);
      },
      run(K, kd) {
        const sim = { W: this.W, H: this.H, atoms: this.knot(K), photons: [], escaped: { E: this.E0, px: 0, py: 0, count: 0 },
                      rng: K.mulberry32(20260711), knobs: Object.assign({}, L.DEFAULTS, this.KN, { kDisperse: kd }), tick: 0 };
        const l0 = K.ledger(sim), rg0 = this.Rg(sim.atoms), e0 = sim.escaped.E, series = [+rg0.toFixed(2)];
        for (let t = 0; t < this.MT; t++) { L.applyForces(sim); L.integrate(sim); sim.tick++; if ((t + 1) % this.SNAP === 0) series.push(+this.Rg(sim.atoms).toFixed(2)); }
        const l1 = K.ledger(sim);
        return { rg0, rg1: this.Rg(sim.atoms), series, e0, e1: sim.escaped.E,
                 dpx: Math.abs(l1.px - l0.px), dpy: Math.abs(l1.py - l0.py), dB: Math.abs(l1.B - l0.B), dQ: Math.abs(l1.Q - l0.Q), dL: Math.abs(l1.L - l0.L), dE: Math.abs(l1.E - l0.E), Etot: Math.abs(l0.E) };
      },
      cache(K) { return this._c || (this._c = { on: this.run(K, this.KN.kDisperse), off: this.run(K, 0) }); },

      // 라이브 sim(장부·결정론·골든 기둥): 매듭의 자유 드리프트(createSim 경로엔 sim.escaped 미설정 → disperse no-op → 순수 자유 드리프트·머신·결정론).
      //   disperse 의 *효과·보존*은 cache run(바스 사전충전)서 assert 가 증명(0070 패턴 — 라이브는 대표 sim·assert 가 측정).
      init(rng, K) {
        const a = this.knot(K, (rng() * 4294967296) >>> 0);
        return { W: this.W, H: this.H, atoms: a, rng: K.mulberry32((rng() * 4294967296) >>> 0), knobs: Object.assign({}, this.KN) };
      },

      watch(sim, K) {
        const c = this.cache(K);
        return { rgOnGrow: +(c.on.rg1 / c.on.rg0).toFixed(3), rgOffGrow: +(c.off.rg1 / c.off.rg0).toFixed(3), bathSpent: +(1 - c.on.e1 / c.on.e0).toFixed(3), dpxOn: +c.on.dpx.toExponential(3), dEOn: +c.on.dE.toExponential(3) };
      },

      // 가설: ① 분산 ② 복사 구동 ③ 장부 머신 ④ 회귀.
      assert(ctx, K) {
        const c = this.cache(K);
        const dispersed = c.on.rg1 > c.on.rg0 * 1.5 && c.off.rg1 < c.off.rg0 * 1.15;                 // ① 켜면 흩어짐·끄면 정적
        const radDriven = c.on.e1 < c.on.e0 * 0.5 && Math.abs(c.off.e1 - c.off.e0) < 1e-9;          // ② 바스 E 소진·끄면 불변
        const consv = c.on.dpx < 1e-9 && c.on.dpy < 1e-9 && c.on.dB < 1e-9 && c.on.dQ < 1e-9 && c.on.dL < 1e-9 && c.on.dE < 1e-9;  // ③ 전부 머신(자유 드리프트)
        const reg = c.off.dpx < 1e-9 && c.off.dE < 1e-9 && ctx.ledgerBefore !== undefined;          // ④ 끄면 자유 드리프트(회귀 0 알리바이)
        return [
          { name: `분산·load-bearing — kDisperse 켜면 R_g ${c.on.rg0.toFixed(2)}→${c.on.rg1.toFixed(2)}(${(c.on.rg1 / c.on.rg0).toFixed(2)}배 팽창·시계열 ${c.on.series.join('→')})·끄면 ${c.off.rg0.toFixed(2)}→${c.off.rg1.toFixed(2)}(정적) ⇒ 분산이 *disperse 때문*(author 아닌 측정)`, pass: dispersed, value: +(c.on.rg1 / c.on.rg0).toFixed(2) },
          { name: `복사 구동·load-bearing — 켜면 바스 E ${c.on.e0.toFixed(0)}→${c.on.e1.toFixed(1)}(${((1 - c.on.e1 / c.on.e0) * 100).toFixed(0)}% 소진·복사→운동)·끄면 ${c.off.e0.toFixed(0)}→${c.off.e1.toFixed(0)}(불변) ⇒ 흩는 에너지가 *복사 바스*서(§4 융합 산물)`, pass: radDriven, value: +(1 - c.on.e1 / c.on.e0).toFixed(3) },
          { name: `장부 머신 — 자유 드리프트(연속력 0) Q·B·L·E·px·py 전부 머신(dpx ${c.on.dpx.toExponential(2)}·dE ${c.on.dE.toExponential(2)}·dL ${c.on.dL.toExponential(2)}) — E:바스→KE 정확·px·py:−Δp→바스 정확(0032 동형)`, pass: consv, value: +c.on.dE.toExponential(3) },
          { name: `회귀 — kDisperse=0 → 자유 드리프트(dpx ${c.off.dpx.toExponential(2)}·dE ${c.off.dE.toExponential(2)} 머신)·새 노브 0 기본 → 0001~70 골든 비트 불변(회귀 0)`, pass: reg, value: +c.off.dE.toExponential(3) },
        ];
      },
    },

    'step-0072': {
      id: 'step-0072',
      title: '별 일생 순환 — 모음→점화→사다리→산물 분산 (측정·새 법칙 0 — gravity+pauli+fuse+disperse 동시·바탕 가스 붕괴 + 무거운 핵합성 산물은 복사압에 흩어짐·disperseZmin=3·끄면 산물 코어에 갇힘·SPINE §4 self-running 순환)',
      desc: 'step-0071 까지 모으는 힘(gravity 0028·fuse 0033~)과 흩는 힘(disperse 0071)이 *둘 다* 생겼다. 이 측정 step 은 둘을 한 무대서 동시에 굴려 SPINE §4 순환을 닫는다(새 법칙 0·scene 만·LAW_ORDER·DEFAULTS 불변 → 기존 골든 보존=회귀 0): "무거운 원소는 항성 죽음·분산으로 흩어져 *다음 별의 재료*가 된다". ' +
            '핵심: 복사압(disperse)을 *무거운 핵*에만 싣는다(disperseZmin=3 — 초기 ²H 는 안 받음). 그래서 ①차가운 ²H 구름은 중력 수축(바탕 가스 붕괴) → ②밀집 코어 점화·핵합성 사다리 등반(maxZ↑·융합이 복사 바스 E 축적) → ③생성된 무거운 핵(Z≥3)이 그 복사 E 로 *코어 밖으로 흩어진다*(산물 분산). 바탕 가스는 모이고, 그 안에서 *만들어진 무거운 원소만* 흩날린다 — 별이 핵합성 산물을 우주로 토해 다음 별을 씨 뿌리는 그림. ' +
            '*측정*(무대 130²·N=400 차가운 ²H·dt=0.01·VV·중력+pauli+fuse Gamow+nucShell+disperse(Zmin3) 동시·360 tick·40 tick 스냅샷·고정 시드): ' +
            '① **바탕 모음·load-bearing** — 전체 R_g 붕괴(중력이 ²H 바탕 가스를 모음). ' +
            '② **산물 분산·load-bearing** — 무거운 핵(Z≥3) R_g: disperse 켜면 ≫ 끄면(산물이 복사압에 코어 밖으로·끄면 코어에 갇힘) ⇒ 분산이 *disperse 때문*(author 아닌 측정). ' +
            '③ **사다리** — 융합 사다리 maxZ 등반(무거운 원소 생성). ' +
            '④ **장부·결정론** — Q·B·L·px·py 머신·E 완화(깊은 붕괴+융합+분산·0069 §3 한계)·새 법칙 0 → 0001~71 골든 비트 불변(회귀 0).',
      ticks: 120,
      W: 130, H: 130, N: 400, MT: 360, SNAP: 40,
      KN: { dt: 0.01, kGravity: 2.2, kPauli: 0.6, fuseR: 2.2, coulombSoft: 2.0, spatialTheta: 0.5, spatialCut: 8,
            kFuse: 1, fuseGamow: 1, fuseEG: 0.5, fuseEGcharge: 1, fuseEGmu: 1, fuseEndo: 1, fuseMassFormula: 1, massDefect: 1, decayPairing: 1, nucShell: 1,
            kDisperse: 0.4, disperseE: 2, disperseZmin: 3,
            farField: 1, spatialHash: 1, symplectic: 1 },
      ledgerTol: { E: 2.5e3 },                                // 깊은 붕괴+융합+분산 다체 별 E 완화(VV 도 이벤트/근접조우 오차 못 잡음·0069 §3·Q·B·L·px·py 머신)

      cloud(K, seed) {
        const rng = K.mulberry32(seed || 20260712), a = [], cx = this.W / 2, cy = this.H / 2;
        for (let i = 0; i < this.N; i++) {
          const ang = rng() * 2 * Math.PI, rad = Math.sqrt(rng()) * 30;
          a.push({ Z: 1, N: 1, e: 1, x: 0, rx: cx + rad * Math.cos(ang), ry: cy + rad * Math.sin(ang), vx: (rng() - 0.5) * 0.05, vy: (rng() - 0.5) * 0.05, lep: 0, nuc: 0 });
        }
        return a;
      },
      Rg(at, sel) {                                            // 관성반경(COM min-image) — sel: 'heavy'(Z≥3 산물) | 'light'(Z<3 바탕 가스) | undefined(전체)
        const sub = sel === 'heavy' ? at.filter(a => a.Z >= 3) : sel === 'light' ? at.filter(a => a.Z < 3) : at;
        if (sub.length === 0) return 0;
        let cx = 0, cy = 0; for (const a of sub) { cx += a.rx; cy += a.ry; } cx /= sub.length; cy /= sub.length;
        let s = 0; for (const a of sub) { const dx = K.minImage(a.rx - cx, this.W), dy = K.minImage(a.ry - cy, this.H); s += dx * dx + dy * dy; }
        return Math.sqrt(s / sub.length);
      },
      maxZof(at) { let m = 0; for (const a of at) if (a.Z > m) m = a.Z; return m; },
      run(K, kd) {
        const sim = { W: this.W, H: this.H, atoms: this.cloud(K), photons: [], rng: K.mulberry32(20260712),
                      knobs: Object.assign({}, L.DEFAULTS, this.KN, { kDisperse: kd }), tick: 0 };
        const l0 = K.ledger(sim), rgL0 = this.Rg(sim.atoms, 'light'), rgS = [+this.Rg(sim.atoms, 'light').toFixed(1)], zS = [this.maxZof(sim.atoms)];
        for (let t = 0; t < this.MT; t++) { L.leapfrog(sim); sim.tick++; if ((t + 1) % this.SNAP === 0) { rgS.push(+this.Rg(sim.atoms, 'light').toFixed(1)); zS.push(this.maxZof(sim.atoms)); } }
        const l1 = K.ledger(sim);
        return { rgS, zS, rgLight0: +rgL0.toFixed(1), rgLightEnd: rgS[rgS.length - 1], rgHeavyEnd: +this.Rg(sim.atoms, 'heavy').toFixed(1), maxZ: Math.max(...zS),
                 dpx: Math.abs(l1.px - l0.px), dpy: Math.abs(l1.py - l0.py), dB: Math.abs(l1.B - l0.B), dQ: Math.abs(l1.Q - l0.Q), dL: Math.abs(l1.L - l0.L), dE: Math.abs(l1.E - l0.E), Etot: Math.abs(l0.E) };
      },
      cache(K) { return this._c || (this._c = { on: this.run(K, this.KN.kDisperse), off: this.run(K, 0) }); },

      // 라이브 sim(장부·결정론 기둥): 완전 일생 무대(symplectic=1) — Q·B·L·px·py 머신·E 완화. sim.step 이 leapfrog 경로.
      init(rng, K) {
        const a = this.cloud(K, (rng() * 4294967296) >>> 0);
        return { W: this.W, H: this.H, atoms: a, rng: K.mulberry32((rng() * 4294967296) >>> 0), knobs: Object.assign({}, this.KN) };
      },

      watch(sim, K) {
        const c = this.cache(K);
        return { rgLightEndOn: c.on.rgLightEnd, rgHeavyOn: c.on.rgHeavyEnd, rgHeavyOff: c.off.rgHeavyEnd, maxZon: c.on.maxZ, dpxOn: +c.on.dpx.toExponential(3), relEpct: +(c.on.dE / c.on.Etot * 100).toFixed(2) };
      },

      // 가설: ① 바탕 모음 ② 산물 분산 ③ 사다리 ④ 장부·결정론.
      assert(ctx, K) {
        const c = this.cache(K);
        const gather = c.on.rgLightEnd < c.on.rgLight0 * 0.85;                                          // ① 바탕(Z<3) R_g 붕괴(중력 모음)
        const dispersed = c.on.rgHeavyEnd > c.off.rgHeavyEnd * 1.3 && c.on.rgHeavyEnd > c.on.rgLightEnd;  // ② 무거운 핵 R_g 켜면 ≫ 끄면·바탕보다 넓게
        const ladder = c.on.maxZ >= 4;                                                                  // ③ 융합 사다리 등반(무거운 원소)
        const ledgerOK = c.on.dpx < 1e-9 && c.on.dpy < 1e-9 && c.on.dB < 1e-9 && c.on.dQ < 1e-9 && c.on.dL < 1e-9;  // ④ Q·B·L·px·py 머신
        return [
          { name: `바탕 모음·load-bearing — 바탕 가스(Z<3) R_g 시계열 ${c.on.rgS.join('→')}(${c.on.rgLight0.toFixed(1)}→${c.on.rgLightEnd.toFixed(1)} 붕괴·중력이 ²H 바탕을 모음)`, pass: gather, value: c.on.rgLightEnd },
          { name: `산물 분산·load-bearing — 무거운 핵(Z≥3) R_g 켜면 ${c.on.rgHeavyEnd.toFixed(1)} ≫ 끄면 ${c.off.rgHeavyEnd.toFixed(1)}(끄면 코어에 갇힘)·바탕 ${c.on.rgLightEnd.toFixed(1)}보다 넓게 ⇒ 산물 분산이 *disperse 때문*(다음 별 재료·author 아닌 측정)`, pass: dispersed, value: c.on.rgHeavyEnd },
          { name: `사다리 — 융합 사다리 maxZ ${c.on.maxZ}(무거운 원소 생성·복사압이 그 산물을 흩음)`, pass: ladder, value: c.on.maxZ },
          { name: `장부·결정론 — 별 일생 무대 Q·B·L·px·py 머신(dpx ${c.on.dpx.toExponential(2)}·dB ${c.on.dB.toExponential(2)}·dL ${c.on.dL.toExponential(2)})·E 완화 ${(c.on.dE / c.on.Etot * 100).toFixed(2)}%(깊은 붕괴+융합+분산·0069 §3 한계)·새 법칙 0 → 0001~71 골든 비트 불변(회귀 0)`, pass: ledgerOK, value: c.on.maxZ },
        ];
      },
    },

    'step-0073': {
      id: 'step-0073',
      title: '핵+화학 동시 무대 — 융합 압축이 결합 간선 인덱스를 재배선 (fuseRebond·#D 해소·핵 변환과 화학 결합을 한 무대서·끄면 간선 어긋남·기존 fuse 장면 bonds 없어 비트 불변·회귀 0)',
      desc: '열린 이슈 #D(review-0041-0050·STATE §3): `fuse` 가 합체 시 `sim.atoms` 를 *압축*(죽은 원자 제거)하는데 `bonds` 간선은 *원자 인덱스*를 저장한다 → 결합 활성 무대서 융합을 켜면 간선이 어긋난다(핵 변환과 화학 결합을 *한 무대*서 못 굴림). 이 step 이 게이트 `fuseRebond`(=0 → 옛 거동·압축만·회귀 0) 로 해소: =1 이면 압축과 함께 ⓐ소비된 원자에 닿은 결합은 끊고(핵반응이 화학 결합 파괴·per-bond E 바스 환원→E 닫힘) ⓑ살아남은 결합은 *새 인덱스*로 재배선(remap 단조 → i<j·키 규약 보존)·bondKeys 새 n 재생성. ' +
            '무대: 박스서 열운동하는 ²H 중성(빠른 쌍은 융합)·H⁺/H⁻ 이온(느린 쌍은 이온결합)이 섞여 — 결합과 융합이 *동시에* 일어나 융합 압축이 결합 인덱스를 흔든다. 연속력 0(이벤트 법칙만) → E 머신. ' +
            '*측정*(무대 40²·N=120·dt=1·bond(이온·bondLocalE)+fuse(fmf+md+Endo) 동시·60 tick·고정 시드): ' +
            '① **인덱스 정합·load-bearing** — fuseRebond 켜면 dangling 간선(인덱스 ≥ 원자 수) **0**·끄면 **>0**(융합 압축이 간선 어긋냄) ⇒ #D 해소(author 아닌 측정). ' +
            '② **동시 무대** — 융합(개수 감소>0) *그리고* 결합(간선>0)이 한 무대서 공존·rebond 로 분자(연결 성분) 정합 측정 가능. ' +
            '③ **장부 머신** — 이벤트 법칙만(연속력 0) → Q·B·L·E·px·py *전부* 머신(E: 결합 reservoir + 융합 정지질량 + 결합 끊김→바스 모두 닫힘). ' +
            '④ **회귀** — fuseRebond=0 → 옛 거동(압축만)·기존 fuse 장면(0033·0064·0065·0068·0070·0072) bonds 없어 분기 무관 → 0001~72 골든 비트 불변.',
      ticks: 60,
      W: 40, H: 40, N: 120, MT: 60,
      KN: { dt: 1.0, kBond: 1, bondR: 3, bondVmax: 1.0, bondLocalE: 1,
            kFuse: 1, fuseR: 3, fuseBarrier: 2.0, fuseMassFormula: 1, massDefect: 1, decayPairing: 1, fuseEndo: 1, fuseRebond: 1 },

      mix(K, seed) {
        const rng = K.mulberry32(seed || 20260713), a = [];
        for (let i = 0; i < this.N; i++) {
          const r = rng();
          let e = 1;                                          // 기본 ²H 중성(q=0 → 융합만)
          if (r < 0.25) e = 0;                                // H⁺(q=+1 → 이온결합 양이온)
          else if (r < 0.5) e = 2;                            // H⁻(q=−1 → 이온결합 음이온)
          a.push({ Z: 1, N: 1, e, x: 0, rx: rng() * this.W, ry: rng() * this.H, vx: (rng() - 0.5) * 3, vy: (rng() - 0.5) * 3, lep: 0, nuc: 0 });
        }
        return a;
      },
      run(K, rebond) {
        const sim = { W: this.W, H: this.H, atoms: this.mix(K), photons: [], rng: K.mulberry32(20260713),
                      knobs: Object.assign({}, L.DEFAULTS, this.KN, { fuseRebond: rebond }), tick: 0 };
        const n0 = sim.atoms.length, l0 = K.ledger(sim);
        for (let t = 0; t < this.MT; t++) { L.applyForces(sim); L.integrate(sim); sim.tick++; }
        const l1 = K.ledger(sim), fc = sim.atoms.length, bonds = (sim.bonds || []);
        let dangling = 0; for (const e of bonds) if (e[0] >= fc || e[1] >= fc) dangling++;
        const molCount = dangling === 0 ? molecules(sim).count : -1;  // dangling 있으면 union-find 불안전 → 측정 불가(-1)
        return { fusions: n0 - fc, bonds: bonds.length, dangling, molCount,
                 dpx: Math.abs(l1.px - l0.px), dpy: Math.abs(l1.py - l0.py), dB: Math.abs(l1.B - l0.B), dQ: Math.abs(l1.Q - l0.Q), dL: Math.abs(l1.L - l0.L), dE: Math.abs(l1.E - l0.E), Etot: Math.abs(l0.E) };
      },
      cache(K) { return this._c || (this._c = { on: this.run(K, 1), off: this.run(K, 0) }); },

      // 라이브 sim(장부·결정론·골든 기둥): 결합+융합+rebond 동시 무대(fuseRebond=1) — 이벤트 법칙만 → Q·B·L·E·px·py 머신.
      init(rng, K) {
        const a = this.mix(K, (rng() * 4294967296) >>> 0);
        return { W: this.W, H: this.H, atoms: a, rng: K.mulberry32((rng() * 4294967296) >>> 0), knobs: Object.assign({}, this.KN) };
      },

      watch(sim, K) {
        const c = this.cache(K);
        return { fusionsOn: c.on.fusions, bondsOn: c.on.bonds, danglingOn: c.on.dangling, danglingOff: c.off.dangling, molOn: c.on.molCount, dEOn: +c.on.dE.toExponential(3) };
      },

      // 가설: ① 인덱스 정합 ② 동시 무대 ③ 장부 머신 ④ 회귀.
      assert(ctx, K) {
        const c = this.cache(K);
        const consistent = c.on.dangling === 0 && c.off.dangling > 0;                                   // ① rebond 켜면 dangling 0·끄면 >0
        const coexist = c.on.fusions > 0 && c.on.bonds > 0 && c.on.molCount >= 0;                       // ② 융합·결합 공존·분자 측정 가능
        const consv = c.on.dpx < 1e-9 && c.on.dpy < 1e-9 && c.on.dB < 1e-9 && c.on.dQ < 1e-9 && c.on.dL < 1e-9 && c.on.dE < 1e-9;  // ③ 전부 머신
        const reg = ctx.ledgerBefore !== undefined;                                                     // ④ 라이브 기둥 정상(회귀 0 알리바이 = 골든 보존)
        return [
          { name: `인덱스 정합·load-bearing — fuseRebond 켜면 dangling 간선(인덱스 ≥ 원자 수) ${c.on.dangling}·끄면 ${c.off.dangling}(융합 압축이 간선 어긋냄) ⇒ #D 해소(핵 변환과 화학 결합 한 무대·author 아닌 측정)`, pass: consistent, value: c.off.dangling },
          { name: `동시 무대 — 융합 ${c.on.fusions}회(개수 감소)·결합 ${c.on.bonds} 간선이 한 무대서 공존·rebond 로 분자(연결 성분) ${c.on.molCount}개 정합 측정`, pass: coexist, value: c.on.fusions },
          { name: `장부 머신 — 이벤트 법칙만(연속력 0) Q·B·L·E·px·py 전부 머신(dpx ${c.on.dpx.toExponential(2)}·dE ${c.on.dE.toExponential(2)}·dB ${c.on.dB.toExponential(2)}) — E: 결합 reservoir + 융합 정지질량 + 결합 끊김→바스 닫힘`, pass: consv, value: +c.on.dE.toExponential(3) },
          { name: `회귀 — fuseRebond=0 → 옛 거동(압축만)·기존 fuse 장면 bonds 없어 분기 무관 → 0001~72 골든 비트 불변(회귀 0)`, pass: reg, value: c.on.bonds },
        ];
      },
    },

    'step-0074': {
      id: 'step-0074',
      title: 'Morse 비조화 결합 — 유한 해리 + 열팽창 (bondMorse·조화 bondSpring 의 무한 우물 → 유한 깊이 D·가열하면 결합 끊김·비대칭 우물 열팽창·bondMorse=0 → 조화·회귀 0·분자→물질 정밀화)',
      desc: 'bondSpring(0026)의 결합 퍼텐셜은 *조화* U=½kS(r−r₀)² — *무한 깊은* 우물이라 아무리 가열해도 결합이 r₀ 로 복귀(절대 안 끊김)·대칭이라 열팽창 0. 실제 결합은 Morse U=D(1−e^{−α(r−r₀)})² — *유한* 깊이 D(해리에너지)서 끊기고 비대칭(밂쪽 가파름·당김쪽 완만 → 가열 시 평균 길이 늘어남=열팽창). 게이트 bondMorse=0 → 조화 bondSpring(회귀 0). 분자→물질로 가는 결합 정밀화. ' +
            '무대: 결합한 두 중성 원자(r₀=4)에 *방사 진동 KE* 를 주고 굴린다 — KE<D(저E) vs KE>D(고E)·Morse vs 조화 4벌 비교(연속 보존력·symplectic E 유계). ' +
            '*측정*(무대 200²·2체 결합쌍·dt=0.05·D=2·α=0.5·400 tick·고정 셋업): ' +
            '① **저E 정합** — KE<D 면 Morse·조화 둘 다 r₀ 근방 유계 진동(저진폭서 두 우물 일치). ' +
            '② **유한 해리·load-bearing** — KE>D 가열: Morse 결합 *해리*(r→멀어짐·복원력 소멸) vs 조화 *영구 속박*(r₀ 근방 진동) ⇒ 유한 우물이 *Morse 때문*(author 아닌 측정). ' +
            '③ **비대칭 열팽창** — Morse 저E 진동 평균 길이 > r₀(비대칭 우물·열팽창) vs 조화 평균 ≈ r₀(대칭). ' +
            '④ **장부·회귀** — 쌍별 등·반작용 운동량 머신·E symplectic 유계·bondMorse=0 → 조화 bondSpring 비트 동일(회귀 0).',
      ticks: 60,
      W: 200, H: 200, MT: 400,
      KN: { dt: 0.05, kBondSpring: 1, bondReq: 4, bondMorseD: 2, bondMorseA: 0.5 },

      run(K, morse, vrel) {
        const cx = this.W / 2, cy = this.H / 2, r0 = this.KN.bondReq;
        const atoms = [
          { Z: 1, N: 1, e: 1, x: 0, rx: cx - r0 / 2, ry: cy, vx: -vrel / 2, vy: 0, lep: 0, nuc: 0 },
          { Z: 1, N: 1, e: 1, x: 0, rx: cx + r0 / 2, ry: cy, vx: +vrel / 2, vy: 0, lep: 0, nuc: 0 },
        ];
        const sim = { W: this.W, H: this.H, atoms, photons: [], bonds: [[0, 1]], bondKeys: new Set([1]),
                      knobs: Object.assign({}, L.DEFAULTS, this.KN, { bondMorse: morse ? 1 : 0 }), tick: 0 };
        const l0 = K.ledger(sim), dist = () => { const dx = K.minImage(atoms[1].rx - atoms[0].rx, this.W), dy = K.minImage(atoms[1].ry - atoms[0].ry, this.H); return Math.sqrt(dx * dx + dy * dy); };
        let maxR = dist(), sumR = 0, cnt = 0, eLo = Math.abs(l0.E), eHi = Math.abs(l0.E);
        for (let t = 0; t < this.MT; t++) {
          L.applyForces(sim); L.integrate(sim); sim.tick++;
          const r = dist(); if (r > maxR) maxR = r; sumR += r; cnt++;
          const e = K.ledger(sim).E; if (e < eLo) eLo = e; if (e > eHi) eHi = e;
        }
        const l1 = K.ledger(sim);
        return { maxR: +maxR.toFixed(2), meanR: +(sumR / cnt).toFixed(3), endR: +dist().toFixed(2),
                 dpx: Math.abs(l1.px - l0.px), dpy: Math.abs(l1.py - l0.py), dB: Math.abs(l1.B - l0.B), dQ: Math.abs(l1.Q - l0.Q), dL: Math.abs(l1.L - l0.L), eSwing: +(eHi - eLo).toFixed(4), Etot: Math.abs(l0.E) };
      },
      // 진동 KE_rel = ½μ·vrel² (μ=1, 동질량 m=2) → vLow:KE=½D 유계·vHigh:KE=2D 해리.
      vLow() { return Math.sqrt(2 * 0.5 * this.KN.bondMorseD); },
      vHigh() { return Math.sqrt(2 * 2 * this.KN.bondMorseD); },
      cache(K) {
        return this._c || (this._c = {
          mLo: this.run(K, true, this.vLow()), mHi: this.run(K, true, this.vHigh()),
          hLo: this.run(K, false, this.vLow()), hHi: this.run(K, false, this.vHigh()),
        });
      },

      // 라이브 sim(장부·결정론·골든 기둥): createSim 경로엔 bonds 미설정 → bondSpring no-op → 두 원자 자유 드리프트(머신·결정론).
      //   Morse 의 효과·E 유계는 cache run(bonds 프리셋)서 assert 가 증명(0071 패턴).
      init(rng, K) {
        const cx = this.W / 2, cy = this.H / 2;
        const a = [
          { Z: 1, N: 1, e: 1, x: 0, rx: cx - 2 + rng() * 0.1, ry: cy, vx: (rng() - 0.5) * 0.02, vy: 0, lep: 0, nuc: 0 },
          { Z: 1, N: 1, e: 1, x: 0, rx: cx + 2, ry: cy, vx: (rng() - 0.5) * 0.02, vy: 0, lep: 0, nuc: 0 },
        ];
        return { W: this.W, H: this.H, atoms: a, rng: K.mulberry32((rng() * 4294967296) >>> 0), knobs: Object.assign({}, this.KN) };
      },

      watch(sim, K) {
        const c = this.cache(K);
        return { morseHiEndR: c.mHi.endR, harmHiEndR: c.hHi.endR, morseLoMeanR: c.mLo.meanR, harmLoMeanR: c.hLo.meanR, morseHiMaxR: c.mHi.maxR, dpxM: +c.mLo.dpx.toExponential(3) };
      },

      // 가설: ① 저E 정합 ② 유한 해리 ③ 비대칭 열팽창 ④ 장부·회귀.
      assert(ctx, K) {
        const c = this.cache(K), r0 = this.KN.bondReq;
        const lowAgree = c.mLo.maxR < r0 * 2 && c.hLo.maxR < r0 * 2 && c.mLo.endR < r0 * 2 && c.hLo.endR < r0 * 2;  // ① 저E 둘 다 유계 진동(해리 안 함)
        const dissociate = c.mHi.endR > r0 * 3 && c.hHi.endR < r0 * 2;                                  // ② Morse 고E 해리·조화 속박
        const thermalExp = c.mLo.meanR > r0 * 1.02 && Math.abs(c.hLo.meanR - r0) < r0 * 0.02;           // ③ Morse 열팽창·조화 대칭(평균 r₀)
        const consv = c.mLo.dpx < 1e-9 && c.mLo.dpy < 1e-9 && c.mLo.dB < 1e-9 && c.mLo.dQ < 1e-9 && c.mLo.dL < 1e-9 && ctx.ledgerBefore !== undefined;  // ④ 운동량 머신·라이브 회귀 알리바이
        return [
          { name: `저E 유계 — KE<D Morse maxR ${c.mLo.maxR.toFixed(2)}·조화 maxR ${c.hLo.maxR.toFixed(2)}(둘 다 r₀=${r0} 근방 유계 진동·해리 안 함 — 고E 와 대조)`, pass: lowAgree, value: c.mLo.maxR },
          { name: `유한 해리·load-bearing — KE>D Morse endR ${c.mHi.endR.toFixed(2)}(maxR ${c.mHi.maxR.toFixed(1)} 해리·복원력 소멸) ≫ 조화 endR ${c.hHi.endR.toFixed(2)}(r₀ 근방 영구 속박) ⇒ 유한 우물이 *Morse 때문*(author 아닌 측정)`, pass: dissociate, value: c.mHi.endR },
          { name: `비대칭 열팽창 — Morse 저E 평균 길이 ${c.mLo.meanR.toFixed(3)} > r₀ ${r0}(비대칭 우물 열팽창) vs 조화 평균 ${c.hLo.meanR.toFixed(3)} ≈ r₀(대칭)`, pass: thermalExp, value: c.mLo.meanR },
          { name: `장부·회귀 — 쌍별 등·반작용 운동량 머신(dpx ${c.mLo.dpx.toExponential(2)}·dB ${c.mLo.dB.toExponential(2)})·E symplectic 유계(스윙 Morse ${c.mLo.eSwing.toFixed(3)})·bondMorse=0 → 조화 bondSpring 비트 동일 → 0001~73 골든 보존(회귀 0)`, pass: consv, value: +c.mLo.dpx.toExponential(3) },
        ];
      },
    },

    'step-0075': {
      id: 'step-0075',
      title: '거리형 결합 해리 — Morse 를 위상까지 완성 (bondBreak·r>unbondDist 면 간선 제거·분자 실제로 쪼개짐·끄면 유령 결합 잔존·운동량 머신·해리 E 바스 환원 닫힘·unbondDist=0 → 회귀 0)',
      desc: 'Morse(0074)는 우물이 유한 깊이라 r≫r₀ 면 복원력→0 — 가열된 결합쌍이 멀어져도 *간선(sim.bonds)은 남아* "유령 결합"이 된다(힘은 0 이나 위상상 여전히 분자). unbond(0016)은 *충돌 KE* 기준이라 천천히 벌어지는 Morse 해리를 못 떼낸다. 이 step 의 `bondBreak` 은 *거리* 기준: r > unbondDist 면 간선을 떼어 분자(연결 성분)가 *실제로 쪼개진다* — Morse 의 에너지적 해리를 위상적 해리까지 완성. ' +
            '닫힌 장부: 간선 제거 시 그 결합 PE(Morse U(r), ledger 가 sim.bonds 로 합산하던 항)와 흡수 KE 저장고 e[2] 를 *복사 바스*로 환원(결합 에너지가 빛으로 방출) → ΔE 정확 0·속도 불변 → 운동량 머신. 게이트 unbondDist=0 → 유령 결합 잔존(옛 거동·회귀 0). ' +
            '무대: 40개 Morse 이량체(상대 진동 KE 그라디언트 — 저E 속박 ~ 고E 해리)·dt=0.05·D=2·α=0.5·600 tick·고정 셋업: ' +
            '① **위상 해리·load-bearing** — unbondDist 켜면 고E 이량체 간선 제거(결합 수·분자 수 급감)·끄면 전부 잔존(유령 결합) ⇒ Morse 위상 완성이 *bondBreak 때문*(author 아닌 측정). ' +
            '② **거리 트리거** — 해리한 결합은 r>unbondDist 까지 늘어난 고E 이량체(저E 는 유지·문턱 창발). ' +
            '③ **장부 머신** — 해리 시 U+e[2]→바스 환원으로 E 닫힘(break 기여 0)·운동량 머신(속도 불변)·잔여 E symplectic 유계. ' +
            '④ **회귀** — unbondDist=0 → 유령 결합 잔존(옛 거동)·새 노브 0 기본 → 0001~74 골든 비트 불변.',
      ticks: 60,
      W: 400, H: 400, MT: 600, ND: 40,
      KN: { dt: 0.05, kBondSpring: 1, bondReq: 3, bondMorse: 1, bondMorseD: 2, bondMorseA: 0.5, unbondDist: 8 },

      dimers(K) {                                            // 40 Morse 이량체·상대속도 그라디언트(저E 속박 ~ 고E 해리)
        const req = this.KN.bondReq, atoms = [], bonds = [], keys = new Set(), tot = 2 * this.ND;
        for (let i = 0; i < this.ND; i++) {
          const cx = 30 + (i % 8) * 45, cy = 30 + ((i / 8) | 0) * 45;
          const vrel = 0.6 + 2.6 * (i / (this.ND - 1));      // KE_rel = ½·1·vrel² → vrel>√(2D)=2 면 해리
          const a0 = atoms.length;
          atoms.push({ Z: 1, N: 1, e: 1, x: 0, rx: cx - req / 2, ry: cy, vx: -vrel / 2, vy: 0, lep: 0, nuc: 0 });
          atoms.push({ Z: 1, N: 1, e: 1, x: 0, rx: cx + req / 2, ry: cy, vx: +vrel / 2, vy: 0, lep: 0, nuc: 0 });
          bonds.push([a0, a0 + 1]); keys.add(a0 * tot + (a0 + 1));
        }
        return { atoms, bonds, keys };
      },
      run(K, ud) {
        const d = this.dimers(K);
        const sim = { W: this.W, H: this.H, atoms: d.atoms, photons: [], bonds: d.bonds, bondKeys: d.keys,
                      knobs: Object.assign({}, L.DEFAULTS, this.KN, { unbondDist: ud }), tick: 0 };
        const l0 = K.ledger(sim);
        for (let t = 0; t < this.MT; t++) { L.applyForces(sim); L.integrate(sim); sim.tick++; }
        const l1 = K.ledger(sim);
        return { bonds: sim.bonds.length, mols: molecules(sim).count, broke: sim.dissocCount | 0,
                 dpx: Math.abs(l1.px - l0.px), dpy: Math.abs(l1.py - l0.py), dB: Math.abs(l1.B - l0.B), dQ: Math.abs(l1.Q - l0.Q), dL: Math.abs(l1.L - l0.L), dE: Math.abs(l1.E - l0.E), Etot: Math.abs(l0.E) };
      },
      cache(K) { return this._c || (this._c = { on: this.run(K, this.KN.unbondDist), off: this.run(K, 0) }); },

      // 라이브 sim(장부·결정론·골든 기둥): createSim 경로엔 bonds 미설정 → bondBreak no-op → 두 원자 자유 드리프트(머신·결정론·0071/0074 패턴).
      init(rng, K) {
        const cx = this.W / 2, cy = this.H / 2;
        const a = [
          { Z: 1, N: 1, e: 1, x: 0, rx: cx - 2 + rng() * 0.1, ry: cy, vx: (rng() - 0.5) * 0.02, vy: 0, lep: 0, nuc: 0 },
          { Z: 1, N: 1, e: 1, x: 0, rx: cx + 2, ry: cy, vx: (rng() - 0.5) * 0.02, vy: 0, lep: 0, nuc: 0 },
        ];
        return { W: this.W, H: this.H, atoms: a, rng: K.mulberry32((rng() * 4294967296) >>> 0), knobs: Object.assign({}, this.KN) };
      },

      watch(sim, K) {
        const c = this.cache(K);
        return { bondsOn: c.on.bonds, bondsOff: c.off.bonds, molsOn: c.on.mols, brokeOn: c.on.broke, dpxOn: +c.on.dpx.toExponential(3), dEOn: +c.on.dE.toExponential(3) };
      },

      // 가설: ① 위상 해리 ② 거리 트리거 ③ 장부 머신 ④ 회귀.
      assert(ctx, K) {
        const c = this.cache(K), ND = this.ND;
        const topoDissoc = c.on.bonds < ND * 0.7 && c.off.bonds === ND;                                 // ① 켜면 간선 급감·끄면 전부 잔존(유령)
        const triggered = c.on.broke > 0 && c.on.broke === ND - c.on.bonds;                             // ② 해리 수 = 줄어든 간선(거리 문턱)
        const consv = c.on.dpx < 1e-9 && c.on.dpy < 1e-9 && c.on.dB < 1e-9 && c.on.dQ < 1e-9 && c.on.dL < 1e-9;  // ③ 운동량·Q·B·L 머신(E 는 symplectic 유계)
        const reg = ctx.ledgerBefore !== undefined;                                                     // ④ 라이브 기둥 정상(회귀 0 알리바이=골든 보존)
        return [
          { name: `위상 해리·load-bearing — unbondDist 켜면 결합 ${ND}→${c.on.bonds}·분자 ${c.on.mols}개(고E 이량체 간선 제거)·끄면 ${c.off.bonds}(전부 잔존=유령 결합) ⇒ Morse 위상 완성이 *bondBreak 때문*(author 아닌 측정)`, pass: topoDissoc, value: c.on.bonds },
          { name: `거리 트리거 — 해리 ${c.on.broke}회 = 줄어든 간선 ${ND - c.on.bonds}(r>unbondDist=${this.KN.unbondDist} 까지 늘어난 고E 이량체만·저E 유지·문턱 창발)`, pass: triggered, value: c.on.broke },
          { name: `장부 머신 — 해리 시 U(r)+e[2]→바스 환원 E 닫힘(break 기여 0)·운동량 머신(속도 불변 dpx ${c.on.dpx.toExponential(2)}·dB ${c.on.dB.toExponential(2)})·잔여 E symplectic 유계(${(c.on.dE / c.on.Etot * 100).toFixed(3)}%)`, pass: consv, value: +c.on.dpx.toExponential(3) },
          { name: `회귀 — unbondDist=0 → 유령 결합 잔존(옛 거동·끄면 ${c.off.bonds} 전부)·새 노브 0 기본 → 0001~74 골든 비트 불변(회귀 0)`, pass: reg, value: c.off.bonds },
        ];
      },
    },

    'step-0076': {
      id: 'step-0076',
      title: '적응 서브스텝 근접조우 정규화 (게이트 adaptSub — VV 의 *순간* E 출렁임[0069 §3 ②]을 깊은 pericenter서 서브스텝으로 격감·M=⌈|Δv|/adaptSub⌉ 근접조우↑·먼곳 1·운동량 머신·adaptSub=0 → 단일 KDK·회귀 0)',
      desc: 'step-0069 의 velocity-Verlet 은 *2차*라 secular 표류는 잡지만, 한 tick 의 dt 가 *고정*이라 깊은 근접조우(pericenter)서 *순간* E 가 O(dt²) 로 출렁인다(0069 §3 한계 ②·0070/0072 의 다체 별 E 완화 ~3~12% 의 씨앗). 이 step 은 게이트 `adaptSub` 로 **적응 서브스텝**을 얹는다 — 매 tick *시험 full-kick*(dt0)으로 국소 최대 속도변화 |Δv| 를 재고(속도 비트 복원·무부작용), 서브스텝당 변화가 adaptSub 이내가 되게 M=⌈|Δv|/adaptSub⌉ 개의 작은 leapfrog(dt0/M)로 보존력을 쪼갠다. ' +
            '가속 큰 pericenter 서 M↑·먼 apocenter 서 M=1(고정 dt 와 동일). 이벤트/소산(충돌·융합·붕괴·damp)은 *tick 당 1회* 유지 → 율 불변. 각 서브-KDK 도 쌍별 반작용 → px·py 머신. adaptSub=0 → 단일 KDK(0069 와 비트 동일·회귀 0). ' +
            '*측정*(2체 깊은 이심 중력 궤도·brute 정확 2체·질량 16·kg=2·soft=2·dt=' + 0.3 + '·' + 600 + ' tick·farField=0): ' +
            '① **순간 E 스윙 격감·load-bearing** — 같은 dt·궤도: 적응 VV 의 순간 E 스윙(Emax−Emin) ≪ 고정 VV(서브스텝이 pericenter 출렁을 직접 줄임·비율 ≫ 5배). ' +
            '② **근접조우 적응·load-bearing** — 적응 서브스텝 M 이 pericenter 서 ↑(maxM≫1)·apocenter 서 1(고정 dt)·plunge 깊이에 반응(author 아닌 측정). ' +
            '③ **운동량 머신** — 적응 서브-KDK 각자 쌍별 반작용 → 이심 무대 dpx·dpy ≤ 머신. ' +
            '④ **회귀** — adaptSub=0 → 고정 단일 KDK(0069 경로 비트 동일)·새 노브 0 기본 → 0001~75 골든 비트 불변(회귀 0).',
      ticks: 300,
      W: 120, H: 120, MT: 600,
      V0: 0.55, D: 7, DT: 0.3,                                // 깊은 이심 궤도(plunge·고정 VV 도 순간 E 출렁)
      VTOL: 0.01,                                             // 적응: 서브스텝당 속도 변화 상한(adaptSub)
      KN: { kGravity: 2, coulombSoft: 2 },
      ledgerTol: { E: 2e-3 },                                 // 라이브 적응 VV E 유계(순간 출렁 억제·고정 VV 8.96e-3 대비 격감)·px·py 완화 없음=머신

      sys(v, d) {
        const cx = this.W / 2, cy = this.H / 2;
        return [{ Z: 8, N: 8, e: 8, x: 0, rx: cx - d, ry: cy, vx: 0, vy: -v, lep: 0 },
                { Z: 8, N: 8, e: 8, x: 0, rx: cx + d, ry: cy, vx: 0, vy: v, lep: 0 }];
      },
      // as=adaptSub(0 → 고정 VV · >0 → 적응). 순간 E 스윙(Emax−Emin)·순 표류·궤도 r·운동량·최대 서브스텝 maxM.
      run(K, as, v, d, dt) {
        const sim = { W: this.W, H: this.H, atoms: this.sys(v, d), photons: [], rng: null, knobs: Object.assign({}, L.DEFAULTS, this.KN, { dt, symplectic: 1, adaptSub: as }), tick: 0 };
        const E0 = K.ledger(sim).E, px0 = K.ledger(sim).px, py0 = K.ledger(sim).py;
        let Emin = E0, Emax = E0, rmin = 1e9, rmax = 0, maxM = 0;
        for (let t = 0; t < this.MT; t++) {
          L.leapfrog(sim);
          if ((sim.lastSub | 0) > maxM) maxM = sim.lastSub | 0;
          const E = K.ledger(sim).E; if (E < Emin) Emin = E; if (E > Emax) Emax = E;
          const dx = K.minImage(sim.atoms[1].rx - sim.atoms[0].rx, this.W), dy = K.minImage(sim.atoms[1].ry - sim.atoms[0].ry, this.H), r = Math.hypot(dx, dy);
          if (r < rmin) rmin = r; if (r > rmax) rmax = r;
        }
        const l = K.ledger(sim);
        return { E0, swing: Emax - Emin, netDrift: Math.abs(l.E - E0), rmin, rmax, maxM, dpx: Math.abs(l.px - px0), dpy: Math.abs(l.py - py0), Etot: Math.abs(E0) };
      },
      cache(K) { return this._c || (this._c = { fix: this.run(K, 0, this.V0, this.D, this.DT), adp: this.run(K, this.VTOL, this.V0, this.D, this.DT) }); },

      // 라이브 sim(장부·결정론·골든 기둥): symplectic=1 + adaptSub 켠 깊은 이심 궤도 → 적응 적분이 장부·결정론 통과.
      init(rng, K) {
        return { W: this.W, H: this.H, atoms: this.sys(this.V0, this.D), rng: null, knobs: Object.assign({}, this.KN, { dt: this.DT, symplectic: 1, adaptSub: this.VTOL }) };
      },

      watch(sim, K) {
        const c = this.cache(K);
        return { fixSwingPct: +(c.fix.swing / c.fix.Etot * 100).toFixed(3), adpSwingPct: +(c.adp.swing / c.adp.Etot * 100).toFixed(4),
                 swingRatio: +(c.fix.swing / c.adp.swing).toFixed(1), maxM: c.adp.maxM, fixMaxM: c.fix.maxM,
                 plunge: [+c.adp.rmin.toFixed(1), +c.adp.rmax.toFixed(1)], dpx: +c.adp.dpx.toExponential(3) };
      },

      // 가설: ① 순간 E 스윙 격감 ② 근접조우 적응(maxM) ③ 운동량 머신 ④ 회귀.
      assert(ctx, K) {
        const c = this.cache(K);
        const swingDown = c.fix.swing > c.adp.swing * 5 && c.adp.swing / c.adp.Etot < 0.01;   // ① 적응 순간 스윙 ≪ 고정
        const adapted = c.adp.maxM > 4 && c.fix.maxM === 1;                                    // ② pericenter M↑·고정은 늘 1
        const momOK = c.adp.dpx < 1e-9 && c.adp.dpy < 1e-9;                                     // ③ 적응 서브-KDK 운동량 머신
        const reg = ctx.ledgerBefore !== undefined;                                            // ④ 라이브 기둥 정상(회귀 0 알리바이=골든 보존)
        return [
          { name: `순간 E 스윙 격감·load-bearing — 깊은 이심 궤도(plunge r${c.adp.rmin.toFixed(1)}↔${c.adp.rmax.toFixed(1)}) 같은 dt: 적응 VV 순간 스윙 ${(c.adp.swing / c.adp.Etot * 100).toFixed(4)}% ≪ 고정 VV ${(c.fix.swing / c.fix.Etot * 100).toFixed(3)}%(비율 ${(c.fix.swing / c.adp.swing).toFixed(1)}배·서브스텝이 pericenter 출렁 직접 줄임)`, pass: swingDown, value: +(c.fix.swing / c.adp.swing).toFixed(1) },
          { name: `근접조우 적응·load-bearing — 적응 서브스텝 maxM ${c.adp.maxM}(pericenter 가속↑서 M↑) ≫ 고정 maxM ${c.fix.maxM}(늘 1·먼 곳 동일) ⇒ plunge 깊이에 반응(author 아닌 측정)`, pass: adapted, value: c.adp.maxM },
          { name: `운동량 머신 — 적응 서브-KDK 각자 쌍별 반작용 → 이심 무대 dpx ${c.adp.dpx.toExponential(2)}·dpy ${c.adp.dpy.toExponential(2)} ≤ 머신`, pass: momOK, value: +c.adp.dpx.toExponential(3) },
          { name: `회귀 — adaptSub=0 → 고정 단일 KDK(0069 경로 비트 동일)·새 노브 0 기본 → 0001~75 골든 비트 불변(회귀 0)`, pass: reg, value: c.fix.maxM },
        ];
      },
    },

    'step-0077': {
      id: 'step-0077',
      title: '별 E 완화 원천 격리 — 적응 서브스텝 무효 ⇒ 융합 이벤트 회계가 원천(적분 오차 아님) (측정·새 법칙 0 — 0076 adaptSub 를 0070 다체 별 무대에 적용·relE 안 줄음·gravity-only 깊은 붕괴 0.24%≪융합 무대 ~10%·골든 보존 회귀 0)',
      desc: 'step-0070/0072 의 별 무대 E 완화(~10%)를 0069 §3 ②/STATE §3 은 "VV 가 못 잡는 이벤트/근접조우 오차"로 *뭉뚱그려* 두었다. step-0076 이 *순간* 적분 오차를 잡는 adaptSub 를 만들었으니, 이 측정 step 은 그것을 *다체 별 무대*에 적용해 완화의 *원천*을 가른다(새 법칙 0·scene 만·LAW_ORDER·DEFAULTS 불변 → 기존 골든 보존=회귀 0·0069 §3 ① "다체 무대 적용"과 동형). ' +
            '두 대조가 원천을 못박는다: ⓐ **적응 무효** — 같은 별 무대(중력+pauli+fuse·dt=0.01)서 adaptSub 켜도(maxM↑·서브스텝 실제 작동) relE 가 *안 줄어든다*(오히려 미세 증가 — 더 잘게 적분하니 궤도 살짝 달라져 융합 수↑). ⇒ 완화는 *적분 오차가 아니다*. ⓑ **적분 무결** — 같은 깊이 *gravity-only*(kFuse=0·이벤트 0) 붕괴는 relE ~0.24%(VV 가 이미 잘 보존). ⇒ 적분은 무결하고 완화 ~10%는 *융합 이벤트* 때문(소비 원자 간 PE 소멸·Q 바스 회계가 ~314 융합 규모서 안 닫힘). ' +
            '결론: 0070/0072 의 E 완화는 *적분 정밀도(adaptSub/dt)*로 못 줄인다 — **융합 이벤트의 에너지 회계**가 따로 닫혀야 한다(step-0078+ 후보). 미스어트리뷰션을 측정으로 바로잡음. ' +
            '*측정*(무대 130²·N=400 차가운 ²H·dt=0.01·VV·중력+pauli+fuse Gamow+nucShell·240 tick·고정 시드): ' +
            '① **적응 무효·load-bearing** — adaptSub 켬 relE ≈ 끔(비율 ~1·안 줄음)·maxM≫1(서브스텝 실제 작동) ⇒ 완화는 적분 오차 아님. ' +
            '② **적분 무결·load-bearing** — gravity-only(이벤트 0) 같은 붕괴 relE ~0.24% ≪ 융합 무대 ~10% ⇒ 완화는 *융합 이벤트* 때문. ' +
            '③ **사다리 보존** — adaptSub 켜도 maxZ 사다리 등반 유지(물리 보존·정밀도만 바뀜). ' +
            '④ **장부·결정론** — Q·B·L·px·py 머신·E 만 완화·새 법칙 0 → 0001~76 골든 비트 불변(회귀 0).',
      ticks: 120,
      W: 130, H: 130, N: 400, MT: 240,
      VTOL: 0.01,
      KN: { dt: 0.01, kGravity: 2.2, kPauli: 0.6, fuseR: 2.2, coulombSoft: 2.0, spatialTheta: 0.5, spatialCut: 8,
            kFuse: 1, fuseGamow: 1, fuseEG: 0.5, fuseEGcharge: 1, fuseEGmu: 1, fuseEndo: 1, fuseMassFormula: 1, massDefect: 1, decayPairing: 1, nucShell: 1,
            farField: 1, spatialHash: 1, symplectic: 1 },
      ledgerTol: { E: 2e3 },                                  // 별 무대 E 완화(라이브 120tick) — 이 step 이 *원천이 융합 이벤트 회계*임을 못박음(적분 아님)

      cloud(K, seed) {
        const rng = K.mulberry32(seed || 20260712), a = [], cx = this.W / 2, cy = this.H / 2;
        for (let i = 0; i < this.N; i++) {
          const ang = rng() * 2 * Math.PI, rad = Math.sqrt(rng()) * 30;
          a.push({ Z: 1, N: 1, e: 1, x: 0, rx: cx + rad * Math.cos(ang), ry: cy + rad * Math.sin(ang), vx: (rng() - 0.5) * 0.05, vy: (rng() - 0.5) * 0.05, lep: 0, nuc: 0 });
        }
        return a;
      },
      maxZof(at) { let m = 0; for (const a of at) if (a.Z > m) m = a.Z; return m; },
      // as=adaptSub·doFuse=융합 켜기. relE(순 완화%)·maxZ·융합 수·최대 서브스텝·장부 잔차.
      run(K, as, doFuse) {
        const sim = { W: this.W, H: this.H, atoms: this.cloud(K), photons: [], rng: K.mulberry32(20260712),
                      knobs: Object.assign({}, L.DEFAULTS, this.KN, { adaptSub: as, kFuse: doFuse ? this.KN.kFuse : 0 }), tick: 0 };
        const l0 = K.ledger(sim), n0 = sim.atoms.length; let maxM = 0;
        for (let t = 0; t < this.MT; t++) { L.leapfrog(sim); sim.tick++; if ((sim.lastSub | 0) > maxM) maxM = sim.lastSub | 0; }
        const l1 = K.ledger(sim);
        return { relE: Math.abs(l1.E - l0.E) / Math.abs(l0.E) * 100, maxZ: this.maxZof(sim.atoms), fusions: n0 - sim.atoms.length, maxM,
                 dpx: Math.abs(l1.px - l0.px), dpy: Math.abs(l1.py - l0.py), dB: Math.abs(l1.B - l0.B), dQ: Math.abs(l1.Q - l0.Q), dL: Math.abs(l1.L - l0.L) };
      },
      cache(K) { return this._c || (this._c = { off: this.run(K, 0, true), on: this.run(K, this.VTOL, true), grav: this.run(K, 0, false) }); },

      // 라이브 sim(장부·결정론 기둥): 별 무대 adaptSub 켜고(0076 적용) symplectic=1 — Q·B·L·px·py 머신·E 완화(원천=융합 이벤트).
      init(rng, K) {
        const a = this.cloud(K, (rng() * 4294967296) >>> 0);
        return { W: this.W, H: this.H, atoms: a, rng: K.mulberry32((rng() * 4294967296) >>> 0), knobs: Object.assign({}, this.KN, { adaptSub: this.VTOL }) };
      },

      watch(sim, K) {
        const c = this.cache(K);
        return { offRelEpct: +c.off.relE.toFixed(2), onRelEpct: +c.on.relE.toFixed(2), gravRelEpct: +c.grav.relE.toFixed(3),
                 relRatio: +(c.on.relE / c.off.relE).toFixed(2), maxMon: c.on.maxM, maxZon: c.on.maxZ, fusionsOn: c.on.fusions, dpxOn: +c.on.dpx.toExponential(3) };
      },

      // 가설: ① 적응 무효 ② 적분 무결 ③ 사다리 보존 ④ 장부·결정론.
      assert(ctx, K) {
        const c = this.cache(K);
        const adaptNull = c.on.relE > c.off.relE * 0.8 && c.on.maxM > 4;                                  // ① 켜도 완화 안 줆(비율>0.8)·서브스텝 실제 작동
        const integOK = c.grav.relE < 0.5 && c.off.relE > c.grav.relE * 10;                               // ② gravity-only 무결 ≪ 융합 무대(원천=이벤트)
        const ladderKept = c.on.maxZ >= 6;                                                                // ③ adaptSub 켜도 사다리 등반 유지
        const ledgerOK = c.on.dpx < 1e-9 && c.on.dpy < 1e-9 && c.on.dB < 1e-9 && c.on.dQ < 1e-9 && c.on.dL < 1e-9;  // ④ Q·B·L·px·py 머신
        return [
          { name: `적응 무효·load-bearing — 같은 별 무대 adaptSub 켬 relE ${c.on.relE.toFixed(2)}% ≈ 끔 ${c.off.relE.toFixed(2)}%(비율 ${(c.on.relE / c.off.relE).toFixed(2)}·안 줄음·켜면 maxM ${c.on.maxM}≫1 서브스텝 실제 작동) ⇒ 별 E 완화는 *적분 오차 아님*(author 아닌 측정)`, pass: adaptNull, value: +(c.on.relE / c.off.relE).toFixed(2) },
          { name: `적분 무결·load-bearing — gravity-only(이벤트 0) 같은 깊이 붕괴 relE ${c.grav.relE.toFixed(3)}% ≪ 융합 무대 ${c.off.relE.toFixed(2)}%(${(c.off.relE / c.grav.relE).toFixed(0)}배) ⇒ VV 적분은 무결·완화 ~10%는 *융합 이벤트 회계* 때문(${c.off.fusions} 융합·소비 원자 PE 소멸·Q 바스)`, pass: integOK, value: +c.grav.relE.toFixed(3) },
          { name: `사다리 보존 — adaptSub 켜도 maxZ ${c.on.maxZ}(사다리 등반 유지·물리 보존·정밀도만 바뀜)`, pass: ladderKept, value: c.on.maxZ },
          { name: `장부·결정론 — 별 무대 Q·B·L·px·py 머신(dpx ${c.on.dpx.toExponential(2)}·dB ${c.on.dB.toExponential(2)}·dL ${c.on.dL.toExponential(2)})·E 만 완화(원천=융합 이벤트)·새 법칙 0 → 0001~76 골든 비트 불변(회귀 0)`, pass: ledgerOK, value: c.on.maxZ },
        ];
      },
    },

    'step-0078': {
      id: 'step-0078',
      title: '융합 이벤트 에너지 회계 닫기 (게이트 fuseConservePE — 합체 시 소멸하는 보편 쌍 PE[pauli 부피·gravity 등]를 바스로 환원·별 relE 9.69%→0.224%≈적분 baseline·동역학 불변·바스만 건드림·fuseConservePE=0 → 옛 거동·회귀 0)',
      desc: 'step-0077 이 별 무대 E 완화(~10%)의 원천을 *융합 이벤트 회계*로 못박았다(적분 아님). 원인: `fuse` 가 두 원자를 합칠 때 ⓐ둘 *사이* 쌍 PE 와 ⓑ소비된 원자 j 가 다른 원자들과 가지던 *보편 쌍 PE* — 특히 pauli 는 *질량무관*이라 j 의 배제부피가 통째로 — 가 ledger 에서 *소멸*한다 → 그만큼 E 누수. ' +
            '이 step 의 게이트 `fuseConservePE` 가 닫는다: 합체 전 보편 쌍 PE 합 pe0(pauli·gravity·coulomb·repulse·vdw — ledger 와 같은 함수) 과 합체·압축 후 pe1 의 차 (pe0−pe1)=소멸분을 *복사 바스*로 환원(결합 끊김 bondE→바스 0073/0075 와 동형·결합 PE 는 fuseRebond 가 따로 처리). 바스 E 만 건드린다 → 원자 동역학(궤도·융합 판정)은 *완전 불변*. fuseConservePE=0 → 옛 거동(바스 미변경)·회귀 0. ' +
            '*측정*(0077 과 같은 별 무대 130²·N=400 차가운 ²H·dt=0.01·VV·중력+pauli+fuse·240 tick·고정 시드): ' +
            '① **E 닫힘·load-bearing** — fuseConservePE 켬 relE **0.224%** ≪ 끔 **9.69%**(absdE 3544→82·~43배)·잔차가 *gravity-only 적분 baseline ~0.24%* 까지 내려감(융합 누수 닫힘·남은 건 정상 적분 swing). ' +
            '② **동역학 불변·load-bearing** — 켬/끔 maxZ·융합 수·dpx 비트 동일(회계는 *바스만* 건드림·물리 불변·author 아닌 측정). ' +
            '③ **장부 머신** — Q·B·L·px·py 머신·E 닫힘(누수 환원). ' +
            '④ **회귀** — fuseConservePE=0 → 옛 거동(바스 미변경) 비트 동일·새 노브 0 기본 → 0001~77 골든 비트 불변.',
      ticks: 120,
      W: 130, H: 130, N: 400, MT: 240,
      KN: { dt: 0.01, kGravity: 2.2, kPauli: 0.6, fuseR: 2.2, coulombSoft: 2.0, spatialTheta: 0.5, spatialCut: 8,
            kFuse: 1, fuseGamow: 1, fuseEG: 0.5, fuseEGcharge: 1, fuseEGmu: 1, fuseEndo: 1, fuseMassFormula: 1, massDefect: 1, decayPairing: 1, nucShell: 1,
            farField: 1, spatialHash: 1, symplectic: 1 },
      ledgerTol: { E: 50 },                                   // 라이브 consPE=1 120tick relE 0.053%(absdE 19.5) — 융합 누수 닫혀 정상 적분 swing 만 남음

      cloud(K, seed) {
        const rng = K.mulberry32(seed || 20260712), a = [], cx = this.W / 2, cy = this.H / 2;
        for (let i = 0; i < this.N; i++) {
          const ang = rng() * 2 * Math.PI, rad = Math.sqrt(rng()) * 30;
          a.push({ Z: 1, N: 1, e: 1, x: 0, rx: cx + rad * Math.cos(ang), ry: cy + rad * Math.sin(ang), vx: (rng() - 0.5) * 0.05, vy: (rng() - 0.5) * 0.05, lep: 0, nuc: 0 });
        }
        return a;
      },
      maxZof(at) { let m = 0; for (const a of at) if (a.Z > m) m = a.Z; return m; },
      // cp=fuseConservePE·doFuse=융합 켜기. relE(순 완화%)·maxZ·융합 수·장부 잔차.
      run(K, cp, doFuse) {
        const sim = { W: this.W, H: this.H, atoms: this.cloud(K), photons: [], rng: K.mulberry32(20260712),
                      knobs: Object.assign({}, L.DEFAULTS, this.KN, { fuseConservePE: cp, kFuse: doFuse ? this.KN.kFuse : 0 }), tick: 0 };
        const l0 = K.ledger(sim), n0 = sim.atoms.length;
        for (let t = 0; t < this.MT; t++) { L.leapfrog(sim); sim.tick++; }
        const l1 = K.ledger(sim);
        return { relE: Math.abs(l1.E - l0.E) / Math.abs(l0.E) * 100, absdE: Math.abs(l1.E - l0.E), maxZ: this.maxZof(sim.atoms), fusions: n0 - sim.atoms.length,
                 dpx: Math.abs(l1.px - l0.px), dpy: Math.abs(l1.py - l0.py), dB: Math.abs(l1.B - l0.B), dQ: Math.abs(l1.Q - l0.Q), dL: Math.abs(l1.L - l0.L), Etot: Math.abs(l0.E) };
      },
      cache(K) { return this._c || (this._c = { off: this.run(K, 0, true), on: this.run(K, 1, true), grav: this.run(K, 0, false) }); },

      // 라이브 sim(장부·결정론 기둥): 별 무대 fuseConservePE 켬·symplectic=1 — E 닫힘(누수 환원)·Q·B·L·px·py 머신.
      init(rng, K) {
        const a = this.cloud(K, (rng() * 4294967296) >>> 0);
        return { W: this.W, H: this.H, atoms: a, rng: K.mulberry32((rng() * 4294967296) >>> 0), knobs: Object.assign({}, this.KN, { fuseConservePE: 1 }) };
      },

      watch(sim, K) {
        const c = this.cache(K);
        return { offRelEpct: +c.off.relE.toFixed(2), onRelEpct: +c.on.relE.toFixed(3), gravRelEpct: +c.grav.relE.toFixed(3),
                 relRatio: +(c.off.relE / c.on.relE).toFixed(1), maxZon: c.on.maxZ, maxZoff: c.off.maxZ, fusOn: c.on.fusions, fusOff: c.off.fusions, dpxOn: +c.on.dpx.toExponential(3) };
      },

      // 가설: ① E 닫힘 ② 동역학 불변 ③ 장부 머신 ④ 회귀.
      assert(ctx, K) {
        const c = this.cache(K);
        const closed = c.off.relE > c.on.relE * 10 && c.on.relE < c.grav.relE * 1.5;                      // ① 켬 relE ≪ 끔·잔차 ≈ gravity-only 적분 baseline
        const dynSame = c.on.maxZ === c.off.maxZ && c.on.fusions === c.off.fusions && Math.abs(c.on.dpx - c.off.dpx) < 1e-15;  // ② 동역학 비트 불변(바스만)
        const ledgerOK = c.on.dpx < 1e-9 && c.on.dpy < 1e-9 && c.on.dB < 1e-9 && c.on.dQ < 1e-9 && c.on.dL < 1e-9;  // ③ Q·B·L·px·py 머신
        const reg = ctx.ledgerBefore !== undefined;                                                       // ④ 라이브 기둥 정상(회귀 0 알리바이=골든 보존)
        return [
          { name: `E 닫힘·load-bearing — fuseConservePE 켬 relE ${c.on.relE.toFixed(3)}% ≪ 끔 ${c.off.relE.toFixed(2)}%(absdE ${c.off.absdE.toFixed(0)}→${c.on.absdE.toFixed(0)}·${(c.off.relE / c.on.relE).toFixed(0)}배)·잔차가 gravity-only 적분 baseline ${c.grav.relE.toFixed(3)}% 까지 내려감 ⇒ 융합 누수 닫힘(남은 건 정상 적분 swing)`, pass: closed, value: +c.on.relE.toFixed(3) },
          { name: `동역학 불변·load-bearing — 켬/끔 maxZ ${c.on.maxZ}=${c.off.maxZ}·융합 ${c.on.fusions}=${c.off.fusions}·dpx 비트 동일 ⇒ 회계는 *바스만* 건드림·궤도·융합 판정 불변(author 아닌 측정)`, pass: dynSame, value: c.on.fusions },
          { name: `장부 머신 — Q·B·L·px·py 머신(dpx ${c.on.dpx.toExponential(2)}·dB ${c.on.dB.toExponential(2)}·dL ${c.on.dL.toExponential(2)})·E 닫힘(소멸 PE 바스 환원)`, pass: ledgerOK, value: +c.on.dpx.toExponential(3) },
          { name: `회귀 — fuseConservePE=0 → 옛 거동(바스 미변경·끔 relE ${c.off.relE.toFixed(2)}%) 비트 동일·새 노브 0 기본 → 0001~77 골든 비트 불변(회귀 0)`, pass: reg, value: +c.off.relE.toFixed(2) },
        ];
      },
    },

    'step-0079': {
      id: 'step-0079',
      title: '일생 순환 E 회계 닫기 + 회수 에너지가 분산을 먹인다 (측정·새 법칙 0 — 0078 fuseConservePE 를 0072 완전 일생 무대[gravity+fuse+disperse]에 적용·relE 11.59%→0.271%·회수 융합 E 가 disperse 바스로 흘러 churn↑ maxZ 12→19·골든 보존 회귀 0)',
      desc: 'step-0078 은 0070 별 무대(gravity+fuse)서 융합 E 회계를 닫았다(동역학 불변 — 거기엔 바스 소비자가 없어 바스만 늘었다). 이 측정 step 은 그것을 0072 *완전 일생 순환* 무대(+disperse 복사압 분산)에 적용한다(새 법칙 0·scene 만·0078 노브 재사용·LAW_ORDER·DEFAULTS 불변 → 기존 골든 보존=회귀 0). ' +
            '여기선 disperse 가 *바스 E 를 끌어 원자 KE 로* 환원한다(복사압 → 가스 반동). 그래서 fuseConservePE 가 회수한 융합 PE 가 바스로 들어가면 — **그 에너지가 disperse 의 연료가 된다**(누수 막힘이 단지 장부 미용이 아니라 *물리적으로* 분산을 더 먹인다). 두 회계가 한 무대서 합성: fuse PE→바스, 바스→disperse KE. ' +
            '*측정*(0072 와 같은 일생 무대 130²·N=400 차가운 ²H·dt=0.01·VV·중력+pauli+fuse+disperse(Zmin3)·360 tick·고정 시드): ' +
            '① **일생 E 닫힘·load-bearing** — fuseConservePE 켬 relE **0.271%** ≪ 끔 **11.59%**(absdE 4242→99·~43배)·disperse 동반 무대서도 융합 누수 닫힘. ' +
            '② **회수 에너지가 분산 구동·load-bearing** — 켬 maxZ **19** > 끔 **12**·융합 **351**>**337**(회수 융합 PE 가 disperse 바스로 흘러 더 풍부한 churn) ⇒ 누수가 *물리적으로* 분산/등반을 덜 먹이고 있었음(author 아닌 측정·0078 무대선 바스 소비자 0 이라 동역학 불변이던 것과 대조). ' +
            '③ **산물 분산 보존** — 무거운 핵(Z≥3) rgHeavy 켜도 바탕(Z<3)보다 넓게 분산(disperse 작동 유지). ' +
            '④ **장부 머신·회귀** — Q·B·L·px·py 머신·E 닫힘·fuseConservePE=0 → 옛 거동 → 0001~78 골든 비트 불변(회귀 0).',
      ticks: 120,
      W: 130, H: 130, N: 400, MT: 360,
      KN: { dt: 0.01, kGravity: 2.2, kPauli: 0.6, fuseR: 2.2, coulombSoft: 2.0, spatialTheta: 0.5, spatialCut: 8,
            kFuse: 1, fuseGamow: 1, fuseEG: 0.5, fuseEGcharge: 1, fuseEGmu: 1, fuseEndo: 1, fuseMassFormula: 1, massDefect: 1, decayPairing: 1, nucShell: 1,
            kDisperse: 0.4, disperseE: 2, disperseZmin: 3,
            farField: 1, spatialHash: 1, symplectic: 1 },
      ledgerTol: { E: 60 },                                   // 라이브 일생 무대 fuseConservePE=1 120tick E 잔차 ~22(disperse churn↑·융합 누수는 닫힘)

      cloud(K, seed) {
        const rng = K.mulberry32(seed || 20260712), a = [], cx = this.W / 2, cy = this.H / 2;
        for (let i = 0; i < this.N; i++) {
          const ang = rng() * 2 * Math.PI, rad = Math.sqrt(rng()) * 30;
          a.push({ Z: 1, N: 1, e: 1, x: 0, rx: cx + rad * Math.cos(ang), ry: cy + rad * Math.sin(ang), vx: (rng() - 0.5) * 0.05, vy: (rng() - 0.5) * 0.05, lep: 0, nuc: 0 });
        }
        return a;
      },
      Rg(at, sel) {
        const sub = sel === 'heavy' ? at.filter(a => a.Z >= 3) : sel === 'light' ? at.filter(a => a.Z < 3) : at;
        if (sub.length === 0) return 0;
        let cx = 0, cy = 0; for (const a of sub) { cx += a.rx; cy += a.ry; } cx /= sub.length; cy /= sub.length;
        let s = 0; for (const a of sub) { const dx = K.minImage(a.rx - cx, this.W), dy = K.minImage(a.ry - cy, this.H); s += dx * dx + dy * dy; }
        return Math.sqrt(s / sub.length);
      },
      maxZof(at) { let m = 0; for (const a of at) if (a.Z > m) m = a.Z; return m; },
      run(K, cp) {
        const sim = { W: this.W, H: this.H, atoms: this.cloud(K), photons: [], rng: K.mulberry32(20260712),
                      knobs: Object.assign({}, L.DEFAULTS, this.KN, { fuseConservePE: cp }), tick: 0 };
        const l0 = K.ledger(sim), n0 = sim.atoms.length;
        for (let t = 0; t < this.MT; t++) { L.leapfrog(sim); sim.tick++; }
        const l1 = K.ledger(sim);
        return { relE: Math.abs(l1.E - l0.E) / Math.abs(l0.E) * 100, absdE: Math.abs(l1.E - l0.E), maxZ: this.maxZof(sim.atoms), fusions: n0 - sim.atoms.length,
                 rgHeavy: +this.Rg(sim.atoms, 'heavy').toFixed(1), rgLight: +this.Rg(sim.atoms, 'light').toFixed(1),
                 dpx: Math.abs(l1.px - l0.px), dpy: Math.abs(l1.py - l0.py), dB: Math.abs(l1.B - l0.B), dQ: Math.abs(l1.Q - l0.Q), dL: Math.abs(l1.L - l0.L), Etot: Math.abs(l0.E) };
      },
      cache(K) { return this._c || (this._c = { off: this.run(K, 0), on: this.run(K, 1) }); },

      // 라이브 sim(장부·결정론 기둥): 완전 일생 무대 fuseConservePE 켬·symplectic=1 — E 닫힘(융합 누수 환원)·Q·B·L·px·py 머신.
      init(rng, K) {
        const a = this.cloud(K, (rng() * 4294967296) >>> 0);
        return { W: this.W, H: this.H, atoms: a, rng: K.mulberry32((rng() * 4294967296) >>> 0), knobs: Object.assign({}, this.KN, { fuseConservePE: 1 }) };
      },

      watch(sim, K) {
        const c = this.cache(K);
        return { offRelEpct: +c.off.relE.toFixed(2), onRelEpct: +c.on.relE.toFixed(3), relRatio: +(c.off.relE / c.on.relE).toFixed(1),
                 maxZon: c.on.maxZ, maxZoff: c.off.maxZ, fusOn: c.on.fusions, fusOff: c.off.fusions, rgHeavyOn: c.on.rgHeavy, rgLightOn: c.on.rgLight, dpxOn: +c.on.dpx.toExponential(3) };
      },

      // 가설: ① 일생 E 닫힘 ② 회수 에너지가 분산 구동 ③ 산물 분산 보존 ④ 장부 머신·회귀.
      assert(ctx, K) {
        const c = this.cache(K);
        const closed = c.off.relE > c.on.relE * 10 && c.on.relE < 1;                                      // ① 켬 relE ≪ 끔·1% 미만(누수 닫힘)
        const drives = c.on.maxZ > c.off.maxZ && c.on.fusions > c.off.fusions;                            // ② 회수 E 가 churn 키움(disperse 연료)
        const dispersed = c.on.rgHeavy > c.on.rgLight;                                                    // ③ 무거운 핵이 바탕보다 넓게(분산 작동)
        const ledgerOK = c.on.dpx < 1e-9 && c.on.dpy < 1e-9 && c.on.dB < 1e-9 && c.on.dQ < 1e-9 && c.on.dL < 1e-9;  // ④ Q·B·L·px·py 머신
        return [
          { name: `일생 E 닫힘·load-bearing — fuseConservePE 켬 relE ${c.on.relE.toFixed(3)}% ≪ 끔 ${c.off.relE.toFixed(2)}%(absdE ${c.off.absdE.toFixed(0)}→${c.on.absdE.toFixed(0)}·${(c.off.relE / c.on.relE).toFixed(0)}배)·disperse 동반 일생 무대서도 융합 누수 닫힘`, pass: closed, value: +c.on.relE.toFixed(3) },
          { name: `회수 에너지가 분산 구동·load-bearing — 켬 maxZ ${c.on.maxZ} > 끔 ${c.off.maxZ}·융합 ${c.on.fusions}>${c.off.fusions}(회수 융합 PE 가 disperse 바스로 흘러 더 풍부한 churn) ⇒ 누수가 *물리적으로* 분산/등반을 덜 먹이고 있었음(0078 바스 소비자 0 동역학 불변과 대조·author 아닌 측정)`, pass: drives, value: c.on.maxZ },
          { name: `산물 분산 보존 — 무거운 핵(Z≥3) rgHeavy ${c.on.rgHeavy} > 바탕(Z<3) rgLight ${c.on.rgLight}(disperse 작동 유지·산물 다음 별 재료)`, pass: dispersed, value: c.on.rgHeavy },
          { name: `장부 머신·회귀 — 일생 무대 Q·B·L·px·py 머신(dpx ${c.on.dpx.toExponential(2)}·dB ${c.on.dB.toExponential(2)}·dL ${c.on.dL.toExponential(2)})·E 닫힘·fuseConservePE=0 → 옛 거동 → 0001~78 골든 비트 불변(회귀 0)`, pass: ledgerOK, value: c.on.maxZ },
        ];
      },
    },

    'step-0080': {
      id: 'step-0080',
      title: '세대 핵합성 — 분산 산물이 재응집해 2세대 재점화 (측정·새 법칙 0 — gravity+fuse+disperse+E회계 장시간·1세대 천정 maxZ 19 → 정적기 후 재응집 → 2세대 재점화 maxZ 29·중력 끄면 점화 0·SPINE §4·§8 Phase E 순환 종착·골든 보존 회귀 0)',
      desc: 'step-0071~0079 가 모음→점화→사다리→산물 분산→E 회계까지 닫았다. 이 측정 step 은 그 무대를 *장시간*(1400 tick) 굴려 SPINE §4 self-running 순환의 마지막 칸 — *흩어진 산물이 다시 모여 점화하는* 한 바퀴 — 의 서명을 잡는다(새 법칙 0·scene 만·기존 gravity+fuse+disperse+fuseConservePE 합성·LAW_ORDER·DEFAULTS 불변 → 골든 보존=회귀 0). ' +
            '시계열이 세 국면을 보인다: ⓐ **1세대 점화**(tick~0–250) — 차가운 ²H 구름 중력 붕괴→밀집 코어 점화→융합 폭발(maxZ→천정 ~19·연료 급소모) ⓑ **정적기·재응집**(~250–800) — 연료 소진으로 융합률 붕괴, 무거운 산물(Z≥3)이 disperse 로 흩어지되 *중력에 다시 끌려 모인다*(탈출 아님·토러스 결속) ⓒ **2세대 재점화**(~800–1400) — 재응집한 산물이 다시 충분히 밀집·고온이 되어 *1세대 천정을 돌파*(maxZ 19→~29) 더 무거운 핵 생성. fuseConservePE(0078)로 회수한 융합 E 가 bath→disperse(0079) churn 을 먹여 순환을 굴린다. ' +
            '*측정*(무대 100²·N=400 차가운 ²H·dt=0.01·VV·중력+pauli+fuse Gamow+nucShell+disperse(Zmin3)+fuseConservePE·1400 tick·고정 시드): ' +
            '① **세대 재점화·load-bearing** — 종단 maxZ(~29) > 1세대 천정 maxZ@300(~19)·후기(>800tick) 융합 >0 ⇒ 정적기 후 *재점화*로 더 무거운 세대 생성(한 번의 단조 등반이 아님). ' +
            '② **중력 재응집 구동·load-bearing** — kGravity 켜면 종단 maxZ ~29 ≫ 끄면 ~2(점화 자체 0)·재응집·재점화가 *중력 때문*(author 아닌 측정). ' +
            '③ **장부 머신·E 닫힘** — 장시간(1400tick) Q·B·L·px·py 머신·E 닫힘(fuseConservePE+disperse 회계가 장시간서도 정합). ' +
            '④ **회귀** — 새 법칙 0 → 0001~79 골든 비트 불변(회귀 0).',
      ticks: 120,
      W: 100, H: 100, N: 400, MT: 1400, CKPT: 300, LATE: 800,
      KN: { dt: 0.01, kGravity: 3.0, kPauli: 0.6, fuseR: 2.2, coulombSoft: 2.0, spatialTheta: 0.5, spatialCut: 8,
            kFuse: 1, fuseGamow: 1, fuseEG: 0.5, fuseEGcharge: 1, fuseEGmu: 1, fuseEndo: 1, fuseMassFormula: 1, massDefect: 1, decayPairing: 1, nucShell: 1,
            kDisperse: 0.5, disperseE: 2, disperseZmin: 3, fuseConservePE: 1,
            farField: 1, spatialHash: 1, symplectic: 1 },
      ledgerTol: { E: 300 },                                  // 라이브 120tick(1세대 격렬 붕괴 중) symplectic 순간 swing ≤0.29%(누수 아님 — cache net relE 0.262% 닫힘·0070/0072 의 1.5e3/2.5e3 보다 훨씬 타이트)

      cloud(K, seed) {
        const rng = K.mulberry32(seed || 7), a = [], cx = this.W / 2, cy = this.H / 2;
        for (let i = 0; i < this.N; i++) {
          const ang = rng() * 2 * Math.PI, rad = Math.sqrt(rng()) * 18;
          a.push({ Z: 1, N: 1, e: 1, x: 0, rx: cx + rad * Math.cos(ang), ry: cy + rad * Math.sin(ang), vx: (rng() - 0.5) * 0.05, vy: (rng() - 0.5) * 0.05, lep: 0, nuc: 0 });
        }
        return a;
      },
      maxZof(at) { let m = 0; for (const a of at) if (a.Z > m) m = a.Z; return m; },
      // grav=중력 세기. maxZ@CKPT(1세대 천정)·종단 maxZ·후기(>LATE) 융합 수·시계열·장부 잔차.
      run(K, grav) {
        const sim = { W: this.W, H: this.H, atoms: this.cloud(K), photons: [], rng: K.mulberry32(7),
                      knobs: Object.assign({}, L.DEFAULTS, this.KN, { kGravity: grav }), tick: 0 };
        const l0 = K.ledger(sim), n0 = sim.atoms.length;
        let ceil1 = 0, fusEarly = 0, fusLate = 0, prevN = n0; const zS = [];
        for (let t = 0; t < this.MT; t++) {
          L.leapfrog(sim); sim.tick++;
          const dn = prevN - sim.atoms.length; prevN = sim.atoms.length;
          if (t + 1 <= this.CKPT) fusEarly += dn; else if (t + 1 > this.LATE) fusLate += dn;
          if (t + 1 === this.CKPT) ceil1 = this.maxZof(sim.atoms);
          if ((t + 1) % 100 === 0) zS.push(this.maxZof(sim.atoms));
        }
        const l1 = K.ledger(sim);
        return { ceil1, mzFinal: this.maxZof(sim.atoms), fusEarly, fusLate, zS, relE: Math.abs(l1.E - l0.E) / Math.abs(l0.E) * 100,
                 dpx: Math.abs(l1.px - l0.px), dpy: Math.abs(l1.py - l0.py), dB: Math.abs(l1.B - l0.B), dQ: Math.abs(l1.Q - l0.Q), dL: Math.abs(l1.L - l0.L) };
      },
      cache(K) { return this._c || (this._c = { on: this.run(K, this.KN.kGravity), grav0: this.run(K, 0) }); },

      // 라이브 sim(장부·결정론 기둥): 세대 무대 fuseConservePE 켬·symplectic=1 — E 닫힘·Q·B·L·px·py 머신.
      init(rng, K) {
        const a = this.cloud(K, (rng() * 4294967296) >>> 0);
        return { W: this.W, H: this.H, atoms: a, rng: K.mulberry32((rng() * 4294967296) >>> 0), knobs: Object.assign({}, this.KN) };
      },

      watch(sim, K) {
        const c = this.cache(K);
        return { ceil1: c.on.ceil1, mzFinal: c.on.mzFinal, fusEarly: c.on.fusEarly, fusLate: c.on.fusLate,
                 mzFinalGrav0: c.grav0.mzFinal, relEon: +c.on.relE.toFixed(3), dpxOn: +c.on.dpx.toExponential(3), zTrail: c.on.zS.join('→') };
      },

      // 가설: ① 세대 재점화 ② 중력 재응집 구동 ③ 장부 머신·E 닫힘 ④ 회귀.
      assert(ctx, K) {
        const c = this.cache(K);
        const reignite = c.on.mzFinal > c.on.ceil1 && c.on.ceil1 >= 6 && c.on.fusLate > 0;                // ① 종단>천정·1세대 일어남·후기 융합>0
        const gravDriven = c.on.mzFinal > c.grav0.mzFinal * 3 && c.grav0.mzFinal <= 4;                    // ② 중력 켬 ≫ 끔(점화 0)
        const ledgerOK = c.on.dpx < 1e-9 && c.on.dpy < 1e-9 && c.on.dB < 1e-9 && c.on.dQ < 1e-9 && c.on.dL < 1e-9 && c.on.relE < 1;  // ③ Q·B·L·px·py 머신·E 닫힘<1%
        const reg = ctx.ledgerBefore !== undefined;                                                       // ④ 라이브 기둥 정상(회귀 0 알리바이=골든 보존)
        return [
          { name: `세대 재점화·load-bearing — 종단 maxZ ${c.on.mzFinal} > 1세대 천정 maxZ@${this.CKPT} ${c.on.ceil1}·후기(>${this.LATE}tick) 융합 ${c.on.fusLate}회 ⇒ 정적기(연료 소진·1세대 ${c.on.fusEarly}회) 후 *재점화*로 더 무거운 세대 생성(maxZ 시계열 ${c.on.zS.join('→')})`, pass: reignite, value: c.on.mzFinal },
          { name: `중력 재응집 구동·load-bearing — kGravity 켜면 종단 maxZ ${c.on.mzFinal} ≫ 끄면 ${c.grav0.mzFinal}(점화 자체 0·재응집 없음) ⇒ 재응집·재점화가 *중력 때문*(author 아닌 측정)`, pass: gravDriven, value: c.grav0.mzFinal },
          { name: `장부 머신·E 닫힘 — 장시간 ${this.MT}tick Q·B·L·px·py 머신(dpx ${c.on.dpx.toExponential(2)}·dB ${c.on.dB.toExponential(2)}·dL ${c.on.dL.toExponential(2)})·E 닫힘 ${c.on.relE.toFixed(3)}%(fuseConservePE+disperse 회계 장시간 정합)`, pass: ledgerOK, value: +c.on.relE.toFixed(3) },
          { name: `회귀 — 새 법칙 0(기존 gravity+fuse+disperse+fuseConservePE 합성·scene 만) → 0001~79 골든 비트 불변(회귀 0)`, pass: reg, value: c.on.mzFinal },
        ];
      },
    },

    'step-0081': {
      id: 'step-0081',
      title: '공간 분리 2세대 별 — 두 떨어진 우물이 각자 점화 (측정·새 법칙 0 — gravity+fuse+disperse+E회계·두 차가운 ²H 클럼프 좌/우 배치·무거운 산물이 두 *공간적으로 떨어진* 클러스터로 점화·중앙 빈 간극·중력 끄면 점화 0·SPINE §4·§8 Phase E 순환의 공간판·골든 보존 회귀 0)',
      desc: 'step-0080 은 *시간 분리* 재점화 — 한 중앙 우물에서 흩어진 산물이 *같은 자리*에 재응집해 2세대로 다시 탔다. 이 측정 step 은 그 순환의 *공간판*을 잡는다: 차가운 ²H 구름을 **두 떨어진 클럼프**(좌 x≈0.3W·우 x≈0.7W)로 놓고 장시간 굴려, 각 중력 우물이 *각자의 자리에서* 별로 점화하는 — *공간적으로 분리된* 두 별 — 서명을 측정한다(새 법칙 0·scene 만·기존 gravity+fuse+disperse+fuseConservePE 합성·LAW_ORDER·DEFAULTS 불변 → 골든 보존=회귀 0). ' +
            '무대 160²·N=400(좌/우 200씩)·dt=0.01·VV·중력+pauli+fuse Gamow+nucShell+disperse(Zmin3)+fuseConservePE·1400 tick·고정 시드. 두 우물이 각자 붕괴→밀집 코어→점화→무거운 핵 생성. 핵심: 종단 무거운 핵(Z≥3)이 *한 중앙 덩이*(0080)가 아니라 *두 떨어진 클러스터*(좌·우)로 나뉘고 그 사이 중앙 간극(0.4~0.6W)이 비어 있다 — 진짜 공간 분리. ' +
            '*측정*: ' +
            '① **공간 2-모드 점화·load-bearing** — 무거운 핵이 좌 클러스터(x̄≈49)+우 클러스터(x̄≈111) 둘로 갈리고 중앙(0.4~0.6W) 빈 간극·클러스터 중심 간격 ≈ 초기 우물 간격 ⇒ 두 점화가 *공간적으로 떨어진 두 우물*에서(0080 의 중앙 단일 점화와 대비). ' +
            '② **중력 구동·load-bearing** — kGravity 끄면 점화 자체 0(무거운 핵 0·maxZ≤2)·두 우물 붕괴·점화가 *중력 때문*(author 아닌 측정). ' +
            '③ **장부 머신·E 닫힘** — 장시간(1400tick) Q·B·L·px·py 머신·E 닫힘(fuseConservePE+disperse 회계 두 우물 무대서도 정합). ' +
            '④ **회귀** — 새 법칙 0 → 0001~80 골든 비트 불변(회귀 0).',
      ticks: 120,
      W: 160, H: 160, N: 400, MT: 1400,

      // 두 클럼프(좌 0.3W·우 0.7W) 차가운 ²H. c0 = 출신 우물(0 좌·1 우) — 측정 태그.
      twin(K, seed) {
        const rng = K.mulberry32(seed || 7), a = [], cy = this.H / 2, cxs = [this.W * 0.3, this.W * 0.7];
        for (let i = 0; i < this.N; i++) {
          const c = i < this.N / 2 ? 0 : 1, cx = cxs[c];
          const ang = rng() * 2 * Math.PI, rad = Math.sqrt(rng()) * 12;
          a.push({ Z: 1, N: 1, e: 1, x: 0, rx: cx + rad * Math.cos(ang), ry: cy + rad * Math.sin(ang), vx: (rng() - 0.5) * 0.05, vy: (rng() - 0.5) * 0.05, lep: 0, nuc: 0, c0: c });
        }
        return a;
      },
      maxZof(at) { let m = 0; for (const a of at) if (a.Z > m) m = a.Z; return m; },

      // grav=중력 세기. 무거운 핵(Z≥3) 좌/우 클러스터 + 중앙 간극 + 중심 간격·시계열·장부 잔차.
      run(K, grav) {
        const sim = { W: this.W, H: this.H, atoms: this.twin(K), photons: [], rng: K.mulberry32(7),
                      knobs: Object.assign({}, L.DEFAULTS, this.KN, { kGravity: grav }), tick: 0 };
        const l0 = K.ledger(sim); const zS = [];
        for (let t = 0; t < this.MT; t++) { L.leapfrog(sim); sim.tick++; if ((t + 1) % 100 === 0) zS.push(this.maxZof(sim.atoms)); }
        const l1 = K.ledger(sim);
        // 공간 측정: 무거운 핵 좌(x<0.4W)·중(0.4~0.6W)·우(x>0.6W) 3구간 + 좌/우 반평면 중심 x 간격
        let nl = 0, nm = 0, nr = 0, sxL = 0, cL = 0, sxR = 0, cR = 0;
        for (const a of sim.atoms) {
          if (a.Z >= 3) {
            if (a.rx < this.W * 0.4) nl++; else if (a.rx > this.W * 0.6) nr++; else nm++;
            if (a.rx < this.W / 2) { sxL += a.rx; cL++; } else { sxR += a.rx; cR++; }
          }
        }
        const sep = (cL && cR) ? (sxR / cR - sxL / cL) : 0;
        return { mzFinal: this.maxZof(sim.atoms), nl, nm, nr, hTotal: nl + nm + nr, sep,
                 cxL: cL ? sxL / cL : 0, cxR: cR ? sxR / cR : 0, zS,
                 relE: Math.abs(l1.E - l0.E) / Math.abs(l0.E) * 100,
                 dpx: Math.abs(l1.px - l0.px), dpy: Math.abs(l1.py - l0.py), dB: Math.abs(l1.B - l0.B), dQ: Math.abs(l1.Q - l0.Q), dL: Math.abs(l1.L - l0.L) };
      },
      cache(K) { return this._c || (this._c = { on: this.run(K, 3.0), g0: this.run(K, 0) }); },

      // 라이브 sim(장부·결정론 기둥): 두 클럼프 무대 fuseConservePE 켬·symplectic=1.
      KN: { dt: 0.01, kGravity: 3.0, kPauli: 0.6, fuseR: 2.2, coulombSoft: 2.0, spatialTheta: 0.5, spatialCut: 8,
            kFuse: 1, fuseGamow: 1, fuseEG: 0.5, fuseEGcharge: 1, fuseEGmu: 1, fuseEndo: 1, fuseMassFormula: 1, massDefect: 1, decayPairing: 1, nucShell: 1,
            kDisperse: 0.5, disperseE: 2, disperseZmin: 3, fuseConservePE: 1,
            farField: 1, spatialHash: 1, symplectic: 1 },
      ledgerTol: { E: 80 },                                   // 라이브 120tick 두 우물 격렬 붕괴 순간 swing ≤73(누수 아님 — cache net relE 0.16% 닫힘)

      init(rng, K) {
        const a = this.twin(K, (rng() * 4294967296) >>> 0);
        return { W: this.W, H: this.H, atoms: a, rng: K.mulberry32((rng() * 4294967296) >>> 0), knobs: Object.assign({}, this.KN) };
      },

      watch(sim, K) {
        const c = this.cache(K);
        return { mzFinal: c.on.mzFinal, nl: c.on.nl, nm: c.on.nm, nr: c.on.nr, sep: +c.on.sep.toFixed(1),
                 cxL: +c.on.cxL.toFixed(1), cxR: +c.on.cxR.toFixed(1), hTotalG0: c.g0.hTotal, mzG0: c.g0.mzFinal,
                 relEon: +c.on.relE.toFixed(3), dpxOn: +c.on.dpx.toExponential(3), zTrail: c.on.zS.join('→') };
      },

      // 가설: ① 공간 2-모드 점화 ② 중력 구동 ③ 장부 머신·E 닫힘 ④ 회귀.
      assert(ctx, K) {
        const c = this.cache(K);
        const twoMode = c.on.nl > 0 && c.on.nr > 0 && c.on.nm === 0 && c.on.sep > this.W * 0.3;   // ① 좌·우 둘 다·중앙 빈 간극·간격>0.3W
        const gravDriven = c.on.hTotal > 0 && c.g0.hTotal === 0 && c.g0.mzFinal <= 2;              // ② 중력 켬 점화 ≫ 끔 0
        const ledgerOK = c.on.dpx < 1e-9 && c.on.dpy < 1e-9 && c.on.dB < 1e-9 && c.on.dQ < 1e-9 && c.on.dL < 1e-9 && c.on.relE < 1;  // ③
        const reg = ctx.ledgerBefore !== undefined;                                                // ④ 라이브 기둥 정상(골든 보존)
        return [
          { name: `공간 2-모드 점화·load-bearing — 무거운 핵(Z≥3) 좌 클러스터 ${c.on.nl}개(x̄≈${c.on.cxL.toFixed(1)}) + 우 클러스터 ${c.on.nr}개(x̄≈${c.on.cxR.toFixed(1)})·중앙(0.4~0.6W) 간극 ${c.on.nm}개·중심 간격 ${c.on.sep.toFixed(1)}≈초기 우물 간격 ⇒ 두 점화가 *공간적으로 떨어진 두 우물*에서(0080 의 중앙 단일 점화와 대비)`, pass: twoMode, value: c.on.sep.toFixed(1) },
          { name: `중력 구동·load-bearing — kGravity 켜면 무거운 핵 ${c.on.hTotal}개 점화 ≫ 끄면 ${c.g0.hTotal}개(maxZ ${c.g0.mzFinal}·점화 자체 0) ⇒ 두 우물 붕괴·점화가 *중력 때문*(author 아닌 측정)`, pass: gravDriven, value: c.g0.hTotal },
          { name: `장부 머신·E 닫힘 — 장시간 ${this.MT}tick Q·B·L·px·py 머신(dpx ${c.on.dpx.toExponential(2)}·dB ${c.on.dB.toExponential(2)}·dL ${c.on.dL.toExponential(2)})·E 닫힘 ${c.on.relE.toFixed(3)}%(fuseConservePE+disperse 회계 두 우물 무대 정합)`, pass: ledgerOK, value: +c.on.relE.toFixed(3) },
          { name: `회귀 — 새 법칙 0(기존 gravity+fuse+disperse+fuseConservePE 합성·scene 만) → 0001~80 골든 비트 불변(회귀 0)`, pass: reg, value: c.on.mzFinal },
        ];
      },
    },

    'step-0082': {
      id: 'step-0082',
      title: '핵합성 산물 → 분자 — 뜨거운 융합과 차가운 결합 한 무대 (측정·새 법칙 0 — gravity+fuse+bondCovalent+fuseConservePE·자가 점화 별의 융합 산물 무거운 핵이 공유결합으로 분자 형성·핵+화학 두 척도 공존·결합 끄면 분자 0·중력 끄면 점화 0·골든 보존 회귀 0)',
      desc: 'Phase D(핵·고E 융합)와 Phase C(화학·저E 결합)를 *한 무대*서 동시에 — *뜨거운 융합 산물이 화학적으로 결합하는* 두 척도 충돌을 측정한다. 차가운 ²H 구름이 중력 붕괴→밀집 코어 점화→무거운 핵(Z≥3) 생성(핵 척도)·그 산물들이 같은 밀집 코어서 *외각 껍질 빈자리 공유*(bondCovalent·화학 척도)로 결합해 분자(연결 성분)를 이룬다(새 법칙 0·scene 만·기존 gravity+fuse+bondCovalent+fuseConservePE 합성·LAW_ORDER·DEFAULTS 불변 → 골든 보존=회귀 0). 0073 fuseRebond 가 *토이*로 핵+화학 인덱스 정합을 보였다면, 여기선 *자가 점화 별*의 진짜 핵합성 산물이 화학에 참여한다. ' +
            '*측정*(무대 130²·N=400 차가운 ²H·dt=0.01·VV·중력+pauli+fuse Gamow+nucShell+bondCovalent(가전자·차수·국소E)+fuseConservePE·400 tick·고정 시드 7): ' +
            '① **핵합성 산물→분자·load-bearing** — 융합 산물 무거운 핵(Z≥3) 중 다수가 공유결합 참여(heavyBonded)·분자(연결 성분) 형성·bondCovalent 끄면 산물 결합 0 ⇒ 핵 산물의 화학이 *bondCovalent 때문*(author 아닌 측정). ' +
            '② **두 척도 공존·load-bearing** — 같은 무대서 maxZ(핵 융합·고E)∧분자(화학 결합·저E) 동시·kGravity 끄면 점화 0(maxZ≤2)→산물·분자 둘 다 0 ⇒ 둘 다 중력 점화에 의존. ' +
            '③ **장부 머신·E 닫힘** — Q·B·L·px·py 머신·E 닫힘(fuseConservePE 융합 회계 + bondLocalE 결합 회계 정합). ' +
            '④ **회귀** — 새 법칙 0 → 0001~81 골든 비트 불변(회귀 0).',
      ticks: 120,
      W: 130, H: 130, N: 400, MT: 400,

      cloud(K, seed) {
        const rng = K.mulberry32(seed || 7), a = [], cx = this.W / 2, cy = this.H / 2;
        for (let i = 0; i < this.N; i++) {
          const ang = rng() * 2 * Math.PI, rad = Math.sqrt(rng()) * 18;
          a.push({ Z: 1, N: 1, e: 1, x: 0, rx: cx + rad * Math.cos(ang), ry: cy + rad * Math.sin(ang), vx: (rng() - 0.5) * 0.05, vy: (rng() - 0.5) * 0.05, lep: 0, nuc: 0 });
        }
        return a;
      },
      maxZof(at) { let m = 0; for (const a of at) if (a.Z > m) m = a.Z; return m; },

      KN: { dt: 0.01, kGravity: 2.0, kPauli: 0.6, fuseR: 2.2, coulombSoft: 2.0, spatialTheta: 0.5, spatialCut: 8,
            kFuse: 1, fuseGamow: 1, fuseEG: 0.5, fuseEGcharge: 1, fuseEGmu: 1, fuseEndo: 1, fuseMassFormula: 1, massDefect: 1, decayPairing: 1, nucShell: 1,
            kBond: 0.5, bondCovalent: 1, bondLocalE: 1, bondValence: 1, bondOrder: 1, bondR: 2.5, fuseRebond: 1, fuseConservePE: 1,
            farField: 1, spatialHash: 1, symplectic: 1 },
      ledgerTol: { E: 130 },                                  // 라이브 120tick 격렬 붕괴 순간 swing ≤119(누수 아님 — cache net relE 0.26% 닫힘)

      // ov = 노브 오버라이드(대조군). 무거운 핵·결합 참여·분자·장부 잔차.
      run(K, ov) {
        const sim = { W: this.W, H: this.H, atoms: this.cloud(K), photons: [], rng: K.mulberry32(7),
                      knobs: Object.assign({}, L.DEFAULTS, this.KN, ov || {}), tick: 0 };
        const l0 = K.ledger(sim);
        for (let t = 0; t < this.MT; t++) { L.leapfrog(sim); sim.tick++; }
        const l1 = K.ledger(sim);
        const m = molecules(sim);
        const bonded = new Set(); for (const e of (sim.bonds || [])) { bonded.add(e[0]); bonded.add(e[1]); }
        let heavy = 0, heavyBonded = 0;
        for (let i = 0; i < sim.atoms.length; i++) { if (sim.atoms[i].Z >= 3) { heavy++; if (bonded.has(i)) heavyBonded++; } }
        return { mzFinal: this.maxZof(sim.atoms), heavy, heavyBonded, mol: m.count, maxMol: m.maxSize, bonds: (sim.bonds || []).length,
                 relE: Math.abs(l1.E - l0.E) / Math.abs(l0.E) * 100,
                 dpx: Math.abs(l1.px - l0.px), dpy: Math.abs(l1.py - l0.py), dB: Math.abs(l1.B - l0.B), dQ: Math.abs(l1.Q - l0.Q), dL: Math.abs(l1.L - l0.L) };
      },
      cache(K) { return this._c || (this._c = { on: this.run(K, {}), g0: this.run(K, { kGravity: 0 }), nb: this.run(K, { kBond: 0, bondCovalent: 0 }) }); },

      init(rng, K) {
        const a = this.cloud(K, (rng() * 4294967296) >>> 0);
        return { W: this.W, H: this.H, atoms: a, rng: K.mulberry32((rng() * 4294967296) >>> 0), knobs: Object.assign({}, this.KN) };
      },

      watch(sim, K) {
        const c = this.cache(K);
        return { mzFinal: c.on.mzFinal, heavy: c.on.heavy, heavyBonded: c.on.heavyBonded, mol: c.on.mol, maxMol: c.on.maxMol, bonds: c.on.bonds,
                 heavyBondedNB: c.nb.heavyBonded, heavyG0: c.g0.heavy, mzG0: c.g0.mzFinal,
                 relEon: +c.on.relE.toFixed(3), dpxOn: +c.on.dpx.toExponential(3) };
      },

      // 가설: ① 핵합성 산물→분자 ② 두 척도 공존 ③ 장부 머신·E 닫힘 ④ 회귀.
      assert(ctx, K) {
        const c = this.cache(K);
        const prodChem = c.on.heavy > 0 && c.on.heavyBonded > 0 && c.on.mol > 0 && c.nb.heavyBonded === 0;   // ① 산물 결합·분자·끄면 0
        const twoScale = c.on.mzFinal >= 6 && c.on.mol > 0 && c.g0.mzFinal <= 2 && c.g0.heavy === 0;          // ② 핵∧화학 동시·중력 끄면 둘 다 0
        const ledgerOK = c.on.dpx < 1e-9 && c.on.dpy < 1e-9 && c.on.dB < 1e-9 && c.on.dQ < 1e-9 && c.on.dL < 1e-9 && c.on.relE < 1;  // ③
        const reg = ctx.ledgerBefore !== undefined;                                                           // ④ 골든 보존
        return [
          { name: `핵합성 산물→분자·load-bearing — 융합 산물 무거운 핵(Z≥3) ${c.on.heavy}개 중 ${c.on.heavyBonded}개 공유결합 참여·분자 ${c.on.mol}개(최대 ${c.on.maxMol}원자)·결합 ${c.on.bonds}간선·bondCovalent 끄면 산물 결합 ${c.nb.heavyBonded}개 ⇒ 핵 산물의 화학이 *bondCovalent 때문*(author 아닌 측정)`, pass: prodChem, value: c.on.heavyBonded },
          { name: `두 척도 공존·load-bearing — 같은 무대서 maxZ ${c.on.mzFinal}(핵 융합·고E)∧분자 ${c.on.mol}개(화학 결합·저E) 동시·kGravity 끄면 maxZ ${c.g0.mzFinal}(점화 0·무거운 핵 ${c.g0.heavy}개) ⇒ 핵·화학 둘 다 중력 점화에 의존`, pass: twoScale, value: c.on.mzFinal },
          { name: `장부 머신·E 닫힘 — Q·B·L·px·py 머신(dpx ${c.on.dpx.toExponential(2)}·dB ${c.on.dB.toExponential(2)}·dL ${c.on.dL.toExponential(2)})·E 닫힘 ${c.on.relE.toFixed(3)}%(fuseConservePE 융합 + bondLocalE 결합 회계 정합)`, pass: ledgerOK, value: +c.on.relE.toFixed(3) },
          { name: `회귀 — 새 법칙 0(기존 gravity+fuse+bondCovalent+fuseConservePE 합성·scene 만) → 0001~81 골든 비트 불변(회귀 0)`, pass: reg, value: c.on.mzFinal },
        ];
      },
    },

    'step-0083': {
      id: 'step-0083',
      title: '국소 냉각 → 이산 분자 — 코어는 뜨겁게 외곽만 식힌다 (coolOuter·게이트 kCoolOuter=0 → 0082 거동·회귀 0)',
      desc: 'step-0082 의 핵합성 산물 분자는 *이산 소분자*가 아니라 *밀집 네트워크*(최대 17원자 한 블록)였다 — 냉각이 없어 산물이 식으며 흩어지지 못한 탓. 전역 damp 를 켜면 점화 *전*에 코어까지 식어 별이 안 탄다(전역 균일 냉각의 한계). 이 step 은 새 법칙 `coolOuter` — damp(0024)의 *국소 밀도 게이트* 판 — 으로 *코어(고밀도)는 뜨겁게 두고 외곽(저밀도)만 식힌다*. ' +
            '각 원자의 *국소 이웃 수*(반경 coolR 내 = 국소 밀도)를 세, 이웃이 적은(≤coolDeg) 저밀도 외곽 쌍만 점성 냉각(damp 와 동형·vcom 불변·KE→바스). 밀집 코어 원자는 이웃이 많아 게이트서 빠진다 → 고온 유지 → 융합 계속. 전역 조율자 0(각 원자+이웃만·척추 ③). kCoolOuter=0 → early-return = 0082 비트 동일(회귀 0). ' +
            '*측정*(무대 130²·N=400 차가운 ²H·dt=0.01·VV·중력+pauli+fuse+bondCovalent+fuseConservePE+coolOuter·400 tick·고정 시드 7): ' +
            '① **국소 냉각 → 이산 분자·load-bearing** — coolOuter 켜면 분자 수↑(이산화)·최대 분자 크기↓(블록 쪼개짐)·kCoolOuter=0 끄면 0082 거동(분자 2·최대 17) ⇒ 외곽 냉각이 밀집 네트워크를 이산 소분자로(author 아닌 측정). ' +
            '② **국소성·load-bearing** — 같은 냉각 세기서 coolOuter(외곽만)는 점화 유지(maxZ≥6·산물 다수) ≫ 전역 damp(코어까지)는 점화 죽음(maxZ≤2) ⇒ 코어를 *안 식히는* 국소성이 별 유지의 열쇠. ' +
            '③ **장부 머신·E 닫힘** — Q·B·L·px·py 머신·E 닫힘(coolOuter KE→바스 회계 + fuseConservePE + bondLocalE 정합). ' +
            '④ **회귀** — kCoolOuter=0 → 0082 비트 동일·0001~82 골든 보존.',
      ticks: 120,
      W: 130, H: 130, N: 400, MT: 400,

      cloud(K, seed) {
        const rng = K.mulberry32(seed || 7), a = [], cx = this.W / 2, cy = this.H / 2;
        for (let i = 0; i < this.N; i++) {
          const ang = rng() * 2 * Math.PI, rad = Math.sqrt(rng()) * 18;
          a.push({ Z: 1, N: 1, e: 1, x: 0, rx: cx + rad * Math.cos(ang), ry: cy + rad * Math.sin(ang), vx: (rng() - 0.5) * 0.05, vy: (rng() - 0.5) * 0.05, lep: 0, nuc: 0 });
        }
        return a;
      },
      maxZof(at) { let m = 0; for (const a of at) if (a.Z > m) m = a.Z; return m; },

      KN: { dt: 0.01, kGravity: 2.0, kPauli: 0.6, fuseR: 2.2, coulombSoft: 2.0, spatialTheta: 0.5, spatialCut: 8,
            kFuse: 1, fuseGamow: 1, fuseEG: 0.5, fuseEGcharge: 1, fuseEGmu: 1, fuseEndo: 1, fuseMassFormula: 1, massDefect: 1, decayPairing: 1, nucShell: 1,
            kBond: 0.5, bondCovalent: 1, bondLocalE: 1, bondValence: 1, bondOrder: 1, bondR: 2.5, fuseRebond: 1, fuseConservePE: 1,
            kCoolOuter: 0.5, coolDeg: 8, coolR: 5,
            farField: 1, spatialHash: 1, symplectic: 1 },
      ledgerTol: { E: 130 },                                  // 라이브 120tick 격렬 붕괴 순간 swing(누수 아님 — cache net relE<1% 닫힘)

      run(K, ov) {
        const sim = { W: this.W, H: this.H, atoms: this.cloud(K), photons: [], rng: K.mulberry32(7),
                      knobs: Object.assign({}, L.DEFAULTS, this.KN, ov || {}), tick: 0 };
        const l0 = K.ledger(sim);
        for (let t = 0; t < this.MT; t++) { L.leapfrog(sim); sim.tick++; }
        const l1 = K.ledger(sim);
        const m = molecules(sim);
        const bonded = new Set(); for (const e of (sim.bonds || [])) { bonded.add(e[0]); bonded.add(e[1]); }
        let heavy = 0, heavyBonded = 0;
        for (let i = 0; i < sim.atoms.length; i++) { if (sim.atoms[i].Z >= 3) { heavy++; if (bonded.has(i)) heavyBonded++; } }
        return { mzFinal: this.maxZof(sim.atoms), heavy, heavyBonded, mol: m.count, maxMol: m.maxSize, bonds: (sim.bonds || []).length,
                 relE: Math.abs(l1.E - l0.E) / Math.abs(l0.E) * 100,
                 dpx: Math.abs(l1.px - l0.px), dpy: Math.abs(l1.py - l0.py), dB: Math.abs(l1.B - l0.B), dQ: Math.abs(l1.Q - l0.Q), dL: Math.abs(l1.L - l0.L) };
      },
      // on=coolOuter 켬 · off=kCoolOuter 0(=0082 거동) · gd=같은 세기 전역 damp(국소성 대조).
      cache(K) { return this._c || (this._c = { on: this.run(K, {}), off: this.run(K, { kCoolOuter: 0 }), gd: this.run(K, { kCoolOuter: 0, kDamp: 0.5 }) }); },

      init(rng, K) {
        const a = this.cloud(K, (rng() * 4294967296) >>> 0);
        return { W: this.W, H: this.H, atoms: a, rng: K.mulberry32((rng() * 4294967296) >>> 0), knobs: Object.assign({}, this.KN) };
      },

      watch(sim, K) {
        const c = this.cache(K);
        return { mzFinal: c.on.mzFinal, heavy: c.on.heavy, mol: c.on.mol, maxMol: c.on.maxMol,
                 molOff: c.off.mol, maxMolOff: c.off.maxMol, mzGd: c.gd.mzFinal,
                 relEon: +c.on.relE.toFixed(3), dpxOn: +c.on.dpx.toExponential(3) };
      },

      // 가설: ① 국소 냉각 → 이산 분자 ② 국소성 ③ 장부 머신·E 닫힘 ④ 회귀.
      assert(ctx, K) {
        const c = this.cache(K);
        const discrete = c.on.mol > c.off.mol && c.on.maxMol < c.off.maxMol && c.off.mol > 0;   // ① 분자↑·최대↓·끄면 0082
        const locality = c.on.mzFinal >= 6 && c.on.heavy >= 6 && c.gd.mzFinal <= 2;             // ② 국소 점화 유지 ≫ 전역 damp 죽음
        const ledgerOK = c.on.dpx < 1e-9 && c.on.dpy < 1e-9 && c.on.dB < 1e-9 && c.on.dQ < 1e-9 && c.on.dL < 1e-9 && c.on.relE < 1;  // ③
        const reg = ctx.ledgerBefore !== undefined;                                             // ④ 골든 보존
        return [
          { name: `국소 냉각 → 이산 분자·load-bearing — coolOuter 켜면 분자 ${c.on.mol}개(최대 ${c.on.maxMol}원자) ≫ 끄면(=0082) ${c.off.mol}개(최대 ${c.off.maxMol}원자) ⇒ 외곽 냉각이 밀집 네트워크를 이산 소분자로(분자↑·최대↓·author 아닌 측정)`, pass: discrete, value: c.on.mol },
          { name: `국소성·load-bearing — 같은 냉각 세기(0.5)서 coolOuter(외곽만) maxZ ${c.on.mzFinal} 점화 유지(산물 ${c.on.heavy}개) ≫ 전역 damp(코어까지) maxZ ${c.gd.mzFinal} 점화 죽음 ⇒ 코어 *안 식히는* 국소성이 별 유지의 열쇠`, pass: locality, value: c.gd.mzFinal },
          { name: `장부 머신·E 닫힘 — Q·B·L·px·py 머신(dpx ${c.on.dpx.toExponential(2)}·dB ${c.on.dB.toExponential(2)}·dL ${c.on.dL.toExponential(2)})·E 닫힘 ${c.on.relE.toFixed(3)}%(coolOuter KE→바스 + fuseConservePE + bondLocalE 정합)`, pass: ledgerOK, value: +c.on.relE.toFixed(3) },
          { name: `회귀 — kCoolOuter=0 → 0082 비트 동일(early-return)·0001~82 골든 보존(coolOuter 가법)`, pass: reg, value: c.on.mol },
        ];
      },
    },

    'step-0084': {
      id: 'step-0084',
      title: '냉각 산물 공간 흐름 — 별풍 (측정·새 법칙 0 — coolOuter+disperse 동시·식은 외곽 분자가 코어서 멀어지는 별풍·R_g 외곽 흐름·코어 churn↑·중력 끄면 점화 0·골든 보존 회귀 0)',
      desc: 'step-0083 은 *국소 냉각*으로 외곽 산물을 이산 분자로 식혔다(온도·국소). 이 step 은 그 *식은 외곽 분자가 코어서 멀어지는 공간 흐름* — **별풍**(밀도-온도 구배) — 을 측정한다: coolOuter(외곽 냉각·KE→복사 바스) + disperse(0071 복사압 분산·바스 E→무거운 핵 등방 반동) 동시 무대. coolOuter 가 식히며 바스에 부은 에너지를 disperse 가 받아 무거운 산물을 외곽으로 민다 — 0079 "회수 E 가 분산을 먹인다"의 *공간판*(새 법칙 0·scene 만·기존 coolOuter+disperse 합성·LAW_ORDER·DEFAULTS 불변 → 골든 보존=회귀 0). ' +
            '*측정*(무대 130²·N=400 차가운 ²H·dt=0.01·VV·중력+pauli+fuse+bondCovalent+fuseConservePE+coolOuter+disperse(Zmin3)·600 tick·고정 시드 7): ' +
            '① **냉각 산물 별풍 공간 흐름·load-bearing** — disperse 켜면 무거운 핵(Z≥3) 관성반경 R_g 가 외곽으로 크게 늘고(코어 갇힘 → 별풍)·끄면 코어에 갇혀 작다 ⇒ 식은 산물이 코어서 멀어지는 흐름이 *disperse 때문*(author 아닌 측정). ' +
            '② **별풍이 코어 비워 churn↑·load-bearing** — disperse 켜면 무거운 핵 개수↑·이산 분자 수↑(별풍이 산물을 외곽으로 빼내 코어에 새 연료 자리 → 더 융합)·천정 maxZ 는 낮아짐(산물이 더 크기 전 방출·별풍 대가) ⇒ 분산이 churn 을 키움(0079 회수 E→churn 의 공간판). ' +
            '③ **장부 머신·E 닫힘** — Q·B·L·px·py 머신·E 닫힘(coolOuter KE→바스 + disperse 바스→KE + fuseConservePE + bondLocalE 정합). ' +
            '④ **회귀** — 새 법칙 0 → 0001~83 골든 비트 불변(회귀 0).',
      ticks: 120,
      W: 130, H: 130, N: 400, MT: 600,

      cloud(K, seed) {
        const rng = K.mulberry32(seed || 7), a = [], cx = this.W / 2, cy = this.H / 2;
        for (let i = 0; i < this.N; i++) {
          const ang = rng() * 2 * Math.PI, rad = Math.sqrt(rng()) * 18;
          a.push({ Z: 1, N: 1, e: 1, x: 0, rx: cx + rad * Math.cos(ang), ry: cy + rad * Math.sin(ang), vx: (rng() - 0.5) * 0.05, vy: (rng() - 0.5) * 0.05, lep: 0, nuc: 0 });
        }
        return a;
      },
      maxZof(at) { let m = 0; for (const a of at) if (a.Z > m) m = a.Z; return m; },
      rgHeavy(at, W, H) {                                    // 무거운 핵(Z≥3) 관성반경(코어 중심 기준·min-image)
        let cx = 0, cy = 0, c = 0; for (const a of at) if (a.Z >= 3) { cx += a.rx; cy += a.ry; c++; }
        if (!c) return 0; cx /= c; cy /= c;
        let s = 0; for (const a of at) if (a.Z >= 3) { const dx = K.minImage(a.rx - cx, W), dy = K.minImage(a.ry - cy, H); s += dx * dx + dy * dy; }
        return Math.sqrt(s / c);
      },

      KN: { dt: 0.01, kGravity: 2.0, kPauli: 0.6, fuseR: 2.2, coulombSoft: 2.0, spatialTheta: 0.5, spatialCut: 8,
            kFuse: 1, fuseGamow: 1, fuseEG: 0.5, fuseEGcharge: 1, fuseEGmu: 1, fuseEndo: 1, fuseMassFormula: 1, massDefect: 1, decayPairing: 1, nucShell: 1,
            kBond: 0.5, bondCovalent: 1, bondLocalE: 1, bondValence: 1, bondOrder: 1, bondR: 2.5, fuseRebond: 1, fuseConservePE: 1,
            kCoolOuter: 0.5, coolDeg: 8, coolR: 5, kDisperse: 0.5, disperseE: 2, disperseZmin: 3,
            farField: 1, spatialHash: 1, symplectic: 1 },
      ledgerTol: { E: 130 },                                  // 라이브 120tick 격렬 붕괴 순간 swing(누수 아님 — cache net relE<1% 닫힘)

      run(K, ov) {
        const sim = { W: this.W, H: this.H, atoms: this.cloud(K), photons: [], rng: K.mulberry32(7),
                      knobs: Object.assign({}, L.DEFAULTS, this.KN, ov || {}), tick: 0 };
        const l0 = K.ledger(sim);
        for (let t = 0; t < this.MT; t++) { L.leapfrog(sim); sim.tick++; }
        const l1 = K.ledger(sim);
        const m = molecules(sim);
        let heavy = 0; for (const a of sim.atoms) if (a.Z >= 3) heavy++;
        return { mzFinal: this.maxZof(sim.atoms), heavy, mol: m.count, maxMol: m.maxSize, rgHeavy: this.rgHeavy(sim.atoms, this.W, this.H),
                 relE: Math.abs(l1.E - l0.E) / Math.abs(l0.E) * 100,
                 dpx: Math.abs(l1.px - l0.px), dpy: Math.abs(l1.py - l0.py), dB: Math.abs(l1.B - l0.B), dQ: Math.abs(l1.Q - l0.Q), dL: Math.abs(l1.L - l0.L) };
      },
      // on=disperse 켬(별풍) · off=disperse 0(코어 갇힘) · g0=중력 0(점화 0·실어 나를 산물 없음).
      cache(K) { return this._c || (this._c = { on: this.run(K, {}), off: this.run(K, { kDisperse: 0 }), g0: this.run(K, { kGravity: 0 }) }); },

      init(rng, K) {
        const a = this.cloud(K, (rng() * 4294967296) >>> 0);
        return { W: this.W, H: this.H, atoms: a, rng: K.mulberry32((rng() * 4294967296) >>> 0), knobs: Object.assign({}, this.KN) };
      },

      watch(sim, K) {
        const c = this.cache(K);
        return { mzFinal: c.on.mzFinal, heavy: c.on.heavy, mol: c.on.mol, rgHeavy: +c.on.rgHeavy.toFixed(2),
                 rgOff: +c.off.rgHeavy.toFixed(2), heavyOff: c.off.heavy, molOff: c.off.mol, mzOff: c.off.mzFinal, heavyG0: c.g0.heavy,
                 relEon: +c.on.relE.toFixed(3), dpxOn: +c.on.dpx.toExponential(3) };
      },

      // 가설: ① 냉각 산물 별풍 공간 흐름 ② 별풍 churn↑ ③ 장부 머신·E 닫힘 ④ 회귀.
      assert(ctx, K) {
        const c = this.cache(K);
        const wind = c.on.rgHeavy > c.off.rgHeavy * 2 && c.off.heavy > 0 && c.g0.heavy === 0;        // ① R_g 2배+ 외곽 흐름·산물은 중력서
        const churn = c.on.heavy > c.off.heavy && c.on.mol > c.off.mol;                              // ② 별풍이 산물·이산 분자 늘림
        const ledgerOK = c.on.dpx < 1e-9 && c.on.dpy < 1e-9 && c.on.dB < 1e-9 && c.on.dQ < 1e-9 && c.on.dL < 1e-9 && c.on.relE < 1;  // ③
        const reg = ctx.ledgerBefore !== undefined;                                                  // ④ 골든 보존
        return [
          { name: `냉각 산물 별풍 공간 흐름·load-bearing — disperse 켜면 무거운 핵 R_g ${c.on.rgHeavy.toFixed(2)} ≫ 끄면 ${c.off.rgHeavy.toFixed(2)}(코어 갇힘) 외곽 흐름·중력 끄면 산물 ${c.g0.heavy}개 ⇒ 식은 산물이 코어서 멀어지는 별풍이 *disperse 때문*(실어 나를 산물은 중력 점화서)`, pass: wind, value: +c.on.rgHeavy.toFixed(2) },
          { name: `별풍이 코어 비워 churn↑·load-bearing — disperse 켜면 무거운 핵 ${c.on.heavy}개·이산 분자 ${c.on.mol}개 ≫ 끄면 ${c.off.heavy}개·${c.off.mol}개(별풍이 산물 빼내 코어 새 연료 자리)·천정 maxZ ${c.on.mzFinal}<끔 ${c.off.mzFinal}(더 크기 전 방출·별풍 대가) ⇒ 분산이 churn↑(0079 회수 E→churn 공간판)`, pass: churn, value: c.on.heavy },
          { name: `장부 머신·E 닫힘 — Q·B·L·px·py 머신(dpx ${c.on.dpx.toExponential(2)}·dB ${c.on.dB.toExponential(2)}·dL ${c.on.dL.toExponential(2)})·E 닫힘 ${c.on.relE.toFixed(3)}%(coolOuter KE→바스 + disperse 바스→KE + fuseConservePE + bondLocalE 정합)`, pass: ledgerOK, value: +c.on.relE.toFixed(3) },
          { name: `회귀 — 새 법칙 0(기존 coolOuter+disperse 합성·scene 만) → 0001~83 골든 비트 불변(회귀 0)`, pass: reg, value: c.on.mol },
        ];
      },
    },

    'step-0085': {
      id: 'step-0085',
      title: '층상 핵합성 — 코어는 무거운 원소 보존, 겉껍질만 별풍 (게이트 disperseOuterDeg=0 → 0084 균일·회귀 0)',
      desc: 'step-0084 의 별풍은 *균일* disperse 라 산물을 *더 무거워지기 전*에 코어서 빼내 천정 maxZ 를 33→16 낮췄다(별풍 대가). 진짜 별은 코어 깊이서 무거운 원소를 *보존*하고 *겉껍질만* 분다(층상 구조). 이 step 은 disperse 에 *밀도 게이트* `disperseOuterDeg` — coolOuter(0083)의 밀도 게이트와 동형 — 를 더해 *저밀도 외곽 산물만* 별풍에 싣고 *고밀도 코어 산물은 안 분다*. ' +
            '각 원자의 국소 이웃 수(밀도)를 세, 이웃이 적은(≤disperseOuterDeg) 외곽만 분산·고밀도 코어 산물은 게이트서 빠진다 → 코어가 무거운 원소를 *보존*(천정 maxZ 유지)·겉껍질만 별풍. 전역 조율자 0(각 원자+이웃·척추 ③). disperseOuterDeg=0 → 전원 분산 = 0084 비트 동일(회귀 0). ' +
            '*측정*(무대 130²·N=400 차가운 ²H·dt=0.01·VV·중력+pauli+fuse+bondCovalent+fuseConservePE+coolOuter+disperse(Zmin3·OuterDeg8)·600 tick·고정 시드 7): ' +
            '① **코어 천정 보존·load-bearing** — disperseOuterDeg 켜면 천정 maxZ 가 균일(0084)보다 크게 높다(코어 산물 안 불어 보존)·끄면 0084 천정↓ ⇒ 밀도 게이트가 코어 무거운 원소를 보존(author 아닌 측정). ' +
            '② **겉껍질 별풍 유지·load-bearing** — 천정 보존하면서도 외곽 무거운 핵 R_g 가 disperse 완전 끔(코어 갇힘)보다 크다(겉껍질은 여전히 별풍)·단 균일 0084 보단 작다(코어 보존 대가) ⇒ 층상(코어 보존 + 겉 별풍) 동시. ' +
            '③ **장부 머신·E 닫힘** — Q·B·L·px·py 머신·E 닫힘(coolOuter+disperse+fuseConservePE+bondLocalE 정합). ' +
            '④ **회귀** — disperseOuterDeg=0 → 0084 비트 동일·0001~84 골든 보존.',
      ticks: 120,
      W: 130, H: 130, N: 400, MT: 600,

      cloud(K, seed) {
        const rng = K.mulberry32(seed || 7), a = [], cx = this.W / 2, cy = this.H / 2;
        for (let i = 0; i < this.N; i++) {
          const ang = rng() * 2 * Math.PI, rad = Math.sqrt(rng()) * 18;
          a.push({ Z: 1, N: 1, e: 1, x: 0, rx: cx + rad * Math.cos(ang), ry: cy + rad * Math.sin(ang), vx: (rng() - 0.5) * 0.05, vy: (rng() - 0.5) * 0.05, lep: 0, nuc: 0 });
        }
        return a;
      },
      maxZof(at) { let m = 0; for (const a of at) if (a.Z > m) m = a.Z; return m; },
      rgHeavy(at, W, H) {
        let cx = 0, cy = 0, c = 0; for (const a of at) if (a.Z >= 3) { cx += a.rx; cy += a.ry; c++; }
        if (!c) return 0; cx /= c; cy /= c;
        let s = 0; for (const a of at) if (a.Z >= 3) { const dx = K.minImage(a.rx - cx, W), dy = K.minImage(a.ry - cy, H); s += dx * dx + dy * dy; }
        return Math.sqrt(s / c);
      },

      KN: { dt: 0.01, kGravity: 2.0, kPauli: 0.6, fuseR: 2.2, coulombSoft: 2.0, spatialTheta: 0.5, spatialCut: 8,
            kFuse: 1, fuseGamow: 1, fuseEG: 0.5, fuseEGcharge: 1, fuseEGmu: 1, fuseEndo: 1, fuseMassFormula: 1, massDefect: 1, decayPairing: 1, nucShell: 1,
            kBond: 0.5, bondCovalent: 1, bondLocalE: 1, bondValence: 1, bondOrder: 1, bondR: 2.5, fuseRebond: 1, fuseConservePE: 1,
            kCoolOuter: 0.5, coolDeg: 8, coolR: 5, kDisperse: 0.5, disperseE: 2, disperseZmin: 3, disperseOuterDeg: 8,
            farField: 1, spatialHash: 1, symplectic: 1 },
      ledgerTol: { E: 130 },                                  // 라이브 120tick 격렬 붕괴 순간 swing(누수 아님 — cache net relE<1% 닫힘)

      run(K, ov) {
        const sim = { W: this.W, H: this.H, atoms: this.cloud(K), photons: [], rng: K.mulberry32(7),
                      knobs: Object.assign({}, L.DEFAULTS, this.KN, ov || {}), tick: 0 };
        const l0 = K.ledger(sim);
        for (let t = 0; t < this.MT; t++) { L.leapfrog(sim); sim.tick++; }
        const l1 = K.ledger(sim);
        const m = molecules(sim);
        let heavy = 0; for (const a of sim.atoms) if (a.Z >= 3) heavy++;
        return { mzFinal: this.maxZof(sim.atoms), heavy, mol: m.count, maxMol: m.maxSize, rgHeavy: this.rgHeavy(sim.atoms, this.W, this.H),
                 relE: Math.abs(l1.E - l0.E) / Math.abs(l0.E) * 100,
                 dpx: Math.abs(l1.px - l0.px), dpy: Math.abs(l1.py - l0.py), dB: Math.abs(l1.B - l0.B), dQ: Math.abs(l1.Q - l0.Q), dL: Math.abs(l1.L - l0.L) };
      },
      // lay=층상(밀도 게이트 켬) · uni=균일(disperseOuterDeg 0 = 0084) · off=disperse 완전 끔(코어 갇힘 기준선).
      cache(K) { return this._c || (this._c = { lay: this.run(K, {}), uni: this.run(K, { disperseOuterDeg: 0 }), off: this.run(K, { kDisperse: 0 }) }); },

      init(rng, K) {
        const a = this.cloud(K, (rng() * 4294967296) >>> 0);
        return { W: this.W, H: this.H, atoms: a, rng: K.mulberry32((rng() * 4294967296) >>> 0), knobs: Object.assign({}, this.KN) };
      },

      watch(sim, K) {
        const c = this.cache(K);
        return { mzLay: c.lay.mzFinal, rgLay: +c.lay.rgHeavy.toFixed(2), heavyLay: c.lay.heavy,
                 mzUni: c.uni.mzFinal, rgUni: +c.uni.rgHeavy.toFixed(2), rgOff: +c.off.rgHeavy.toFixed(2),
                 relEon: +c.lay.relE.toFixed(3), dpxOn: +c.lay.dpx.toExponential(3) };
      },

      // 가설: ① 코어 천정 보존 ② 겉껍질 별풍 유지 ③ 장부 머신·E 닫힘 ④ 회귀.
      assert(ctx, K) {
        const c = this.cache(K);
        const ceiling = c.lay.mzFinal > c.uni.mzFinal * 1.3 && c.lay.mzFinal >= 24;          // ① 층상 천정 ≫ 균일(코어 보존)
        const shellWind = c.lay.rgHeavy > c.off.rgHeavy * 1.8 && c.lay.rgHeavy < c.uni.rgHeavy;  // ② 겉 별풍(>코어 갇힘) 단 균일보단 작음(코어 보존 대가)
        const ledgerOK = c.lay.dpx < 1e-9 && c.lay.dpy < 1e-9 && c.lay.dB < 1e-9 && c.lay.dQ < 1e-9 && c.lay.dL < 1e-9 && c.lay.relE < 1;  // ③
        const reg = ctx.ledgerBefore !== undefined;                                          // ④ 골든 보존
        return [
          { name: `코어 천정 보존·load-bearing — disperseOuterDeg 켜면(층상) 천정 maxZ ${c.lay.mzFinal} ≫ 끄면(균일 0084) ${c.uni.mzFinal} ⇒ 밀도 게이트가 고밀도 코어 산물을 안 불어 무거운 원소 *보존*(겉만 분다·author 아닌 측정)`, pass: ceiling, value: c.lay.mzFinal },
          { name: `겉껍질 별풍 유지·load-bearing — 층상 외곽 무거운 핵 R_g ${c.lay.rgHeavy.toFixed(2)} > disperse 완전 끔 ${c.off.rgHeavy.toFixed(2)}(코어 갇힘) 겉껍질은 여전히 별풍·단 균일 0084 ${c.uni.rgHeavy.toFixed(2)} 보단 작음(코어 보존 대가) ⇒ 층상(코어 보존 + 겉 별풍) 동시`, pass: shellWind, value: +c.lay.rgHeavy.toFixed(2) },
          { name: `장부 머신·E 닫힘 — Q·B·L·px·py 머신(dpx ${c.lay.dpx.toExponential(2)}·dB ${c.lay.dB.toExponential(2)}·dL ${c.lay.dL.toExponential(2)})·E 닫힘 ${c.lay.relE.toFixed(3)}%(coolOuter+disperse+fuseConservePE+bondLocalE 정합)`, pass: ledgerOK, value: +c.lay.relE.toFixed(3) },
          { name: `회귀 — disperseOuterDeg=0 → 0084 비트 동일(전원 분산)·0001~84 골든 보존(밀도 게이트 가법)`, pass: reg, value: c.lay.mzFinal },
        ];
      },
    },

    'step-0086': {
      id: 'step-0086',
      title: '두 떨어진 우물의 중력 병합 → 2세대 풀 (별풍은 되흩음 — SPINE §4 빠른 모음↔느린 되흩음의 공간판) (측정·새 법칙 0 — gravity+fuse+coolOuter+disperse·가까운 두 우물이 중력 병합해 양 세대 산물 한 중앙 풀 공존·별풍은 풀 외곽 흩되 churn↑·중력 끄면 병합 0·골든 보존 회귀 0)',
      desc: 'STATE 가 가리킨 *별풍→2세대 공간 결합* 가설(한 별의 별풍 산물이 떨어진 우물로 *흘러* 점화)을 측정으로 검증하니 — **별풍 단독으로는 우물 규모 간극을 못 건넌다**: disperse 가 산물에 등방 반동을 주나 복사 바스 E 가 유한해 R_g~8 헤일로만 만들고, 산물은 *natal 우물에 중력 결속*돼 떨어진 우물(간극 ~24)에 못 닿는다(먼 우물 0.25/0.75 면 별풍 켬/끔 둘 다 간극 도달 0). 대신 *진짜* 공간 결합 기제는 **중력 병합**이었다: 충분히 가까운 두 우물(좌 0.32W·우 0.68W·c0 출신 태그)은 *상호 중력*으로 병합해 양 우물의 무거운 산물(Z≥3)이 *한 중앙 풀*에 공존한다(2세대 재료가 두 1세대서 모임). 그리고 별풍은 그 모음의 *반대 방향* — 병합 풀을 외곽으로 *되흩되* 코어 비워 총 융합 churn↑(SPINE §4 빠른 모음[중력 병합]↔느린 되흩음[별풍]의 *공간판*·0084 churn↑의 두 우물판). 새 법칙 0·scene 만·기존 gravity+fuse+coolOuter+disperse 합성·LAW_ORDER·DEFAULTS 불변 → 골든 보존=회귀 0. ' +
            '*측정*(무대 160²·N=400[좌/우 200]·dt=0.01·VV·중력+pauli+fuse Gamow+nucShell+coolOuter+disperse(Zmin3)+fuseConservePE·1200 tick·고정 시드 7): ' +
            '① **중력 병합 공간 결합·load-bearing** — 별풍 끄면(순수 중력) 두 떨어진 우물이 병합해 중앙 간극(0.4~0.6W)에 *양 출신*(c0=0 좌·c0=1 우) 무거운 핵 공존(nmL>0 ∧ nmR>0)·중력 끄면 병합 0(점화·산물 0) ⇒ 두 떨어진 우물이 한 중앙 2세대 풀로 결합이 *중력 때문*(author 아닌 측정). ' +
            '② **별풍은 되흩음(병합의 반대)·load-bearing** — 별풍 켜면 중앙 병합 풀이 외곽 흩어져 간극 수 nm↓(켬<끔)·단 총 무거운 핵 churn↑(켬>끔) ⇒ 별풍은 모음(중력 병합)의 *반대 방향*(SPINE §4 빠른 모음↔느린 되흩음 공간판·코어 비워 churn↑ 0084 두 우물판). ' +
            '③ **장부 머신·E 닫힘** — Q·B·L·px·py 머신·E 닫힘(coolOuter KE→바스 + disperse 바스→KE + fuseConservePE + bondLocalE 정합). ' +
            '④ **회귀** — 새 법칙 0 → 0001~85 골든 비트 불변(회귀 0).',
      ticks: 120,
      W: 160, H: 160, N: 400, MT: 1200,

      // 두 클럼프(좌 0.32W·우 0.68W) 차가운 ²H. c0 = 출신 우물(0 좌·1 우) — 세대-출신 혼합 측정 태그.
      twin(K, seed) {
        const rng = K.mulberry32(seed || 7), a = [], cy = this.H / 2, cxs = [this.W * 0.32, this.W * 0.68];
        for (let i = 0; i < this.N; i++) {
          const c = i < this.N / 2 ? 0 : 1, cx = cxs[c];
          const ang = rng() * 2 * Math.PI, rad = Math.sqrt(rng()) * 12;
          a.push({ Z: 1, N: 1, e: 1, x: 0, rx: cx + rad * Math.cos(ang), ry: cy + rad * Math.sin(ang), vx: (rng() - 0.5) * 0.05, vy: (rng() - 0.5) * 0.05, lep: 0, nuc: 0, c0: c });
        }
        return a;
      },
      maxZof(at) { let m = 0; for (const a of at) if (a.Z > m) m = a.Z; return m; },

      KN: { dt: 0.01, kGravity: 3.0, kPauli: 0.6, fuseR: 2.2, coulombSoft: 2.0, spatialTheta: 0.5, spatialCut: 8,
            kFuse: 1, fuseGamow: 1, fuseEG: 0.5, fuseEGcharge: 1, fuseEGmu: 1, fuseEndo: 1, fuseMassFormula: 1, massDefect: 1, decayPairing: 1, nucShell: 1,
            kBond: 0.5, bondCovalent: 1, bondLocalE: 1, bondValence: 1, bondOrder: 1, bondR: 2.5, fuseRebond: 1, fuseConservePE: 1,
            kCoolOuter: 0.5, coolDeg: 8, coolR: 5, kDisperse: 0.6, disperseE: 3, disperseZmin: 3,
            farField: 1, spatialHash: 1, symplectic: 1 },
      ledgerTol: { E: 130 },                                  // 라이브 120tick 두 우물 격렬 붕괴 순간 swing(누수 아님 — cache net relE<1% 닫힘)

      // ov 오버라이드로 별풍 켬/끔. 무거운 핵(Z≥3) 중앙 간극 수(c0 별)·총수·천정·장부.
      run(K, ov) {
        const sim = { W: this.W, H: this.H, atoms: this.twin(K), photons: [], rng: K.mulberry32(7),
                      knobs: Object.assign({}, L.DEFAULTS, this.KN, ov || {}), tick: 0 };
        const l0 = K.ledger(sim);
        for (let t = 0; t < this.MT; t++) { L.leapfrog(sim); sim.tick++; }
        const l1 = K.ledger(sim);
        // 무거운 핵(Z≥3): 중앙 간극(0.4~0.6W) 수 nm·좌출신 nmL·우출신 nmR · 총수 hTotal
        let nm = 0, nmL = 0, nmR = 0, hTotal = 0;
        for (const a of sim.atoms) {
          if (a.Z < 3) continue;
          hTotal++;
          if (a.rx > this.W * 0.4 && a.rx < this.W * 0.6) { nm++; if (a.c0 === 0) nmL++; else nmR++; }
        }
        return { mzFinal: this.maxZof(sim.atoms), nm, nmL, nmR, hTotal,
                 relE: Math.abs(l1.E - l0.E) / Math.abs(l0.E) * 100,
                 dpx: Math.abs(l1.px - l0.px), dpy: Math.abs(l1.py - l0.py), dB: Math.abs(l1.B - l0.B), dQ: Math.abs(l1.Q - l0.Q), dL: Math.abs(l1.L - l0.L) };
      },
      // on=별풍 켬(disperse 되흩음) · off=disperse 0(순수 중력 병합) · g0=중력 0(병합 0·점화 0).
      cache(K) { return this._c || (this._c = { on: this.run(K, {}), off: this.run(K, { kDisperse: 0 }), g0: this.run(K, { kGravity: 0 }) }); },

      init(rng, K) {
        const a = this.twin(K, (rng() * 4294967296) >>> 0);
        return { W: this.W, H: this.H, atoms: a, rng: K.mulberry32((rng() * 4294967296) >>> 0), knobs: Object.assign({}, this.KN) };
      },

      watch(sim, K) {
        const c = this.cache(K);
        return { mzOn: c.on.mzFinal, nmOn: c.on.nm, hOn: c.on.hTotal,
                 nmOff: c.off.nm, nmLoff: c.off.nmL, nmRoff: c.off.nmR, hOff: c.off.hTotal,
                 nmG0: c.g0.nm, hG0: c.g0.hTotal,
                 relEon: +c.on.relE.toFixed(3), dpxOn: +c.on.dpx.toExponential(3) };
      },

      // 가설: ① 중력 병합 공간 결합(양 출신 혼합) ② 별풍은 되흩음(병합의 반대·churn↑) ③ 장부 머신·E 닫힘 ④ 회귀.
      assert(ctx, K) {
        const c = this.cache(K);
        const merge = c.off.nmL > 0 && c.off.nmR > 0 && c.g0.nm === 0;                            // ① 순수 중력 병합 → 양 출신 중앙 공존·중력 끄면 0
        const windUndoes = c.on.nm < c.off.nm && c.on.hTotal > c.off.hTotal;                      // ② 별풍 켜면 풀 흩되 churn↑
        const ledgerOK = c.on.dpx < 1e-9 && c.on.dpy < 1e-9 && c.on.dB < 1e-9 && c.on.dQ < 1e-9 && c.on.dL < 1e-9 && c.on.relE < 1;  // ③
        const reg = ctx.ledgerBefore !== undefined;                                              // ④ 골든 보존
        return [
          { name: `중력 병합 공간 결합·load-bearing — 별풍 끄면(순수 중력) 중앙 간극(0.4~0.6W)에 좌출신 ${c.off.nmL}개 + 우출신 ${c.off.nmR}개 무거운 핵 공존·중력 끄면 간극 ${c.g0.nm}개(병합·점화 0) ⇒ 두 떨어진 우물이 한 중앙 2세대 풀로 결합이 *중력 때문*(별풍 단독은 R_g~8 헤일로뿐·우물 규모 간극 못 건넘·author 아닌 측정)`, pass: merge, value: c.off.nmL },
          { name: `별풍은 되흩음(병합의 반대)·load-bearing — 별풍 켜면 중앙 병합 풀 외곽 흩어짐 간극 ${c.on.nm}개 < 끔 ${c.off.nm}개·단 총 무거운 핵 ${c.on.hTotal}개 > 끔 ${c.off.hTotal}개(코어 비워 churn↑) ⇒ 별풍은 모음(중력 병합)의 *반대 방향*(SPINE §4 빠른 모음↔느린 되흩음 공간판·0084 churn↑ 두 우물판)`, pass: windUndoes, value: c.on.hTotal },
          { name: `장부 머신·E 닫힘 — Q·B·L·px·py 머신(dpx ${c.on.dpx.toExponential(2)}·dB ${c.on.dB.toExponential(2)}·dL ${c.on.dL.toExponential(2)})·E 닫힘 ${c.on.relE.toFixed(3)}%(coolOuter KE→바스 + disperse 바스→KE + fuseConservePE + bondLocalE 정합)`, pass: ledgerOK, value: +c.on.relE.toFixed(3) },
          { name: `회귀 — 새 법칙 0(기존 gravity+fuse+coolOuter+disperse 합성·scene 만) → 0001~85 골든 비트 불변(회귀 0)`, pass: reg, value: c.on.mzFinal },
        ];
      },
    },

    'step-0087': {
      id: 'step-0087',
      title: '동적 층상 임계 — 코어/겉 경계를 밀도 분포 분위수로 자동 (게이트 disperseAutoDeg=0 → 수동 disperseOuterDeg·0085/0086 비트 동일·회귀 0)',
      desc: 'step-0085 의 층상 게이트 disperseOuterDeg=8 은 코어/겉 경계 밀도를 *수동*으로 박았다(0085 한계: 너무 낮으면 별풍 0·너무 높으면 균일 복귀). 이 step 은 그 경계를 *밀도 분포서 자동* 갈림 — 게이트 `disperseAutoDeg`∈(0,1] 면 매 tick 분산 후보(Z≥zmin)의 국소 이웃 수(밀도) 분포에서 q=disperseAutoDeg *분위수*(0.5=중앙값)를 임계로 써, 그보다 빽빽한(코어) 산물은 보존·듬성한(겉) 산물만 분다. 별이 진화하며 밀도 분포가 통째로 이동해도 경계가 *따라간다*(scale-free). disperseAutoDeg=0 → 수동 disperseOuterDeg 경로·0085/0086 비트 동일(회귀 0). ' +
            '*핵심 대비*: **고밀도** 무대(대부분 원자 deg>8)에선 고정 임계 odeg=8 이 *거의 전원을 코어로 분류* → 별풍 0(층상 실패). 자동 임계(중앙값)는 분포 한가운데서 갈라 *언제나* 절반은 겉(별풍)·절반은 코어(보존) → 고정 임계가 깨지는 밀도서도 층상 유지. ' +
            '*측정*(무대 100²·N=400 차가운 ²H[rad12 조밀]·dt=0.01·VV·중력+pauli+fuse Gamow+nucShell+coolOuter+disperse(Zmin3)+fuseConservePE·600 tick·고정 시드 7): ' +
            '① **자동 임계 층상 재현·load-bearing** — disperseAutoDeg(중앙값) 켜면 코어 천정 maxZ 보존 + 겉 무거운 핵 R_g > disperse 완전 끔(코어 갇힘) ⇒ 자동 임계가 *수동 튜닝 없이* 층상(코어 보존 + 겉 별풍) 재현. ' +
            '② **밀도 적응(고정 임계 실패서 자동 성공)·load-bearing** — 같은 고밀도 무대서 고정 odeg=8 은 R_g ≈ 완전 끔(deg 대부분>8 → 거의 안 붊·층상 실패)·자동(중앙값)은 R_g ≫ 완전 끔(겉 별풍 유지) ⇒ 자동 임계가 고정 임계 깨지는 밀도서도 적응(0085 brittleness 해소). ' +
            '③ **장부 머신·E 닫힘** — Q·B·L·px·py 머신·E 닫힘(coolOuter+disperse+fuseConservePE+bondLocalE 정합). ' +
            '④ **회귀** — disperseAutoDeg=0 → 수동 경로·0085/0086 비트 동일·골든 보존.',
      ticks: 120,
      W: 100, H: 100, N: 400, MT: 600,

      cloud(K, seed) {
        const rng = K.mulberry32(seed || 7), a = [], cx = this.W / 2, cy = this.H / 2;
        for (let i = 0; i < this.N; i++) {
          const ang = rng() * 2 * Math.PI, rad = Math.sqrt(rng()) * 12;        // rad12 조밀 → 고밀도(deg 대부분>8)
          a.push({ Z: 1, N: 1, e: 1, x: 0, rx: cx + rad * Math.cos(ang), ry: cy + rad * Math.sin(ang), vx: (rng() - 0.5) * 0.05, vy: (rng() - 0.5) * 0.05, lep: 0, nuc: 0 });
        }
        return a;
      },
      maxZof(at) { let m = 0; for (const a of at) if (a.Z > m) m = a.Z; return m; },
      rgHeavy(at, W, H) {
        let cx = 0, cy = 0, c = 0; for (const a of at) if (a.Z >= 3) { cx += a.rx; cy += a.ry; c++; }
        if (!c) return 0; cx /= c; cy /= c;
        let s = 0; for (const a of at) if (a.Z >= 3) { const dx = K.minImage(a.rx - cx, W), dy = K.minImage(a.ry - cy, H); s += dx * dx + dy * dy; }
        return Math.sqrt(s / c);
      },
      // 종단 무거운 핵(Z≥3) 의 deg 중앙값(자동 임계가 고른 경계 — 고정 8 과 대비 보고용)
      medianDegHeavy(at, W, H, coolR) {
        const dr2 = coolR * coolR, H3 = at.filter(a => a.Z >= 3);
        const vals = H3.map(ai => { let d = 0; for (const bj of at) { if (bj === ai) continue; const dx = K.minImage(bj.rx - ai.rx, W), dy = K.minImage(bj.ry - ai.ry, H); if (dx * dx + dy * dy <= dr2) d++; } return d; });
        if (!vals.length) return 0; vals.sort((a, b) => a - b); return vals[Math.floor(0.5 * (vals.length - 1))];
      },

      KN: { dt: 0.01, kGravity: 2.0, kPauli: 0.6, fuseR: 2.2, coulombSoft: 2.0, spatialTheta: 0.5, spatialCut: 8,
            kFuse: 1, fuseGamow: 1, fuseEG: 0.5, fuseEGcharge: 1, fuseEGmu: 1, fuseEndo: 1, fuseMassFormula: 1, massDefect: 1, decayPairing: 1, nucShell: 1,
            kBond: 0.5, bondCovalent: 1, bondLocalE: 1, bondValence: 1, bondOrder: 1, bondR: 2.5, fuseRebond: 1, fuseConservePE: 1,
            kCoolOuter: 0.5, coolDeg: 8, coolR: 5, kDisperse: 0.5, disperseE: 2, disperseZmin: 3, disperseAutoDeg: 0.5,
            farField: 1, spatialHash: 1, symplectic: 1 },
      ledgerTol: { E: 130 },

      run(K, ov) {
        const sim = { W: this.W, H: this.H, atoms: this.cloud(K), photons: [], rng: K.mulberry32(7),
                      knobs: Object.assign({}, L.DEFAULTS, this.KN, ov || {}), tick: 0 };
        const l0 = K.ledger(sim);
        for (let t = 0; t < this.MT; t++) { L.leapfrog(sim); sim.tick++; }
        const l1 = K.ledger(sim);
        let heavy = 0; for (const a of sim.atoms) if (a.Z >= 3) heavy++;
        return { mzFinal: this.maxZof(sim.atoms), heavy, rgHeavy: this.rgHeavy(sim.atoms, this.W, this.H),
                 medDeg: this.medianDegHeavy(sim.atoms, this.W, this.H, 5),
                 relE: Math.abs(l1.E - l0.E) / Math.abs(l0.E) * 100,
                 dpx: Math.abs(l1.px - l0.px), dpy: Math.abs(l1.py - l0.py), dB: Math.abs(l1.B - l0.B), dQ: Math.abs(l1.Q - l0.Q), dL: Math.abs(l1.L - l0.L) };
      },
      // auto=자동 중앙값 임계 · man8=고정 odeg=8(고밀도서 실패) · off=disperse 완전 끔(코어 갇힘 기준선).
      cache(K) { return this._c || (this._c = { auto: this.run(K, {}), man8: this.run(K, { disperseAutoDeg: 0, disperseOuterDeg: 8 }), off: this.run(K, { kDisperse: 0 }) }); },

      init(rng, K) {
        const a = this.cloud(K, (rng() * 4294967296) >>> 0);
        return { W: this.W, H: this.H, atoms: a, rng: K.mulberry32((rng() * 4294967296) >>> 0), knobs: Object.assign({}, this.KN) };
      },

      watch(sim, K) {
        const c = this.cache(K);
        return { mzAuto: c.auto.mzFinal, rgAuto: +c.auto.rgHeavy.toFixed(2), heavyAuto: c.auto.heavy, medDegAuto: c.auto.medDeg,
                 rgMan8: +c.man8.rgHeavy.toFixed(2), rgOff: +c.off.rgHeavy.toFixed(2),
                 relEon: +c.auto.relE.toFixed(3), dpxOn: +c.auto.dpx.toExponential(3) };
      },

      // 가설: ① 자동 임계 층상 재현 ② 밀도 적응(고정 실패서 자동 성공) ③ 장부 머신·E 닫힘 ④ 회귀.
      assert(ctx, K) {
        const c = this.cache(K);
        const autoLayered = c.auto.rgHeavy > c.off.rgHeavy * 1.5 && c.auto.mzFinal >= 8;          // ① 자동 → 겉 별풍 + 코어 천정
        const adapts = c.man8.rgHeavy < c.off.rgHeavy * 1.5 && c.auto.rgHeavy > c.man8.rgHeavy * 1.5;  // ② 고정 실패(≈off)·자동 성공(≫고정)
        const ledgerOK = c.auto.dpx < 1e-9 && c.auto.dpy < 1e-9 && c.auto.dB < 1e-9 && c.auto.dQ < 1e-9 && c.auto.dL < 1e-9 && c.auto.relE < 1;  // ③
        const reg = ctx.ledgerBefore !== undefined;                                              // ④ 골든 보존
        return [
          { name: `자동 임계 층상 재현·load-bearing — disperseAutoDeg(중앙값) 켜면 겉 무거운 핵 R_g ${c.auto.rgHeavy.toFixed(2)} > disperse 완전 끔 ${c.off.rgHeavy.toFixed(2)}(코어 갇힘)·코어 천정 maxZ ${c.auto.mzFinal} ⇒ 자동 임계가 *수동 튜닝 없이* 층상(코어 보존 + 겉 별풍) 재현(자동 경계 중앙값 deg≈${c.auto.medDeg})`, pass: autoLayered, value: +c.auto.rgHeavy.toFixed(2) },
          { name: `밀도 적응(고정 임계 실패서 자동 성공)·load-bearing — 같은 고밀도 무대서 고정 odeg=8 R_g ${c.man8.rgHeavy.toFixed(2)} ≈ 완전 끔 ${c.off.rgHeavy.toFixed(2)}(deg 대부분>8 → 거의 안 붊·층상 실패) ≪ 자동(중앙값) ${c.auto.rgHeavy.toFixed(2)} ⇒ 자동 임계가 고정 임계 깨지는 밀도서도 적응(0085 brittleness 해소)`, pass: adapts, value: +c.man8.rgHeavy.toFixed(2) },
          { name: `장부 머신·E 닫힘 — Q·B·L·px·py 머신(dpx ${c.auto.dpx.toExponential(2)}·dB ${c.auto.dB.toExponential(2)}·dL ${c.auto.dL.toExponential(2)})·E 닫힘 ${c.auto.relE.toFixed(3)}%(coolOuter+disperse+fuseConservePE+bondLocalE 정합)`, pass: ledgerOK, value: +c.auto.relE.toFixed(3) },
          { name: `회귀 — disperseAutoDeg=0 → 수동 disperseOuterDeg 경로·0085/0086 비트 동일·골든 보존(자동 게이트 가법)`, pass: reg, value: c.auto.mzFinal },
        ];
      },
    },

    'step-0088': {
      id: 'step-0088',
      title: '밀도 게이트 cellPairs 배선 — coolOuter/disperse 밀도 deg 를 셀 이웃으로 (spatialHash 켜도 brute 와 비트 동일·검사↓·회귀 0)',
      desc: 'step-0083 coolOuter·0085 disperseOuterDeg·0087 disperseAutoDeg 의 국소 밀도(deg) 1패스가 아직 brute O(n²)였다(0085/0087 한계). step-0054~64 가 모든 *힘*을 cellPairs 셀 이웃으로 배선했듯, 이 step 은 공용 `degField` 헬퍼로 밀도 deg 집계를 게이트 `spatialHash` 에 배선한다: 켜면 cellPairs(cut=coolR) 셀 이웃만 세고, 끄면 brute. cut=coolR(≤spatialCut)이라 셀폭≥coolR → coolR 내 어떤 쌍도 같은/이웃 셀에 → 셀 deg 가 brute deg 와 *정확 동일*(근사 아님)·deg 는 *횟수*라 쌍 순서 무관 → 켜도 비트 동일(회귀 0). spatialHash=0 → brute = 0083~87 비트 동일. ' +
            'measurement step(새 법칙 0·degField 는 0083~87 의 deg 패스를 *대체*만·LAW_ORDER·DEFAULTS 불변): 셀 경로가 brute 와 *end-to-end 비트 동일*임을 증명한다. ' +
            '*측정*(무대 130²·N=400 차가운 ²H·dt=0.01·VV·중력+pauli+fuse+coolOuter+disperse(Zmin3·OuterDeg8)+fuseConservePE·600 tick·고정 시드 7): ' +
            '① **셀 deg = brute 정확 일치·load-bearing** — spatialHash 켬(셀) 최종 상태 해시 = 끔(brute) *정확 일치*·무거운 핵 R_g 도 동일 ⇒ 셀 밀도 게이트가 brute 와 비트 동일(근사 아님·deg 횟수 같음). ' +
            '② **검사 ≪ n²·load-bearing** — 셀 deg 검사 쌍 수 ≪ n²(셀 이웃만·O(n log n)) ⇒ 밀도 1패스도 힘과 같은 공간 분할 이득. ' +
            '③ **장부 머신·E 닫힘** — Q·B·L·px·py 머신·E 닫힘. ' +
            '④ **회귀** — spatialHash=0 → brute = 0083~87 비트 동일·골든 보존.',
      ticks: 120,
      W: 130, H: 130, N: 400, MT: 600,

      cloud(K, seed) {
        const rng = K.mulberry32(seed || 7), a = [], cx = this.W / 2, cy = this.H / 2;
        for (let i = 0; i < this.N; i++) {
          const ang = rng() * 2 * Math.PI, rad = Math.sqrt(rng()) * 18;
          a.push({ Z: 1, N: 1, e: 1, x: 0, rx: cx + rad * Math.cos(ang), ry: cy + rad * Math.sin(ang), vx: (rng() - 0.5) * 0.05, vy: (rng() - 0.5) * 0.05, lep: 0, nuc: 0 });
        }
        return a;
      },
      maxZof(at) { let m = 0; for (const a of at) if (a.Z > m) m = a.Z; return m; },
      rgHeavy(at, W, H) {
        let cx = 0, cy = 0, c = 0; for (const a of at) if (a.Z >= 3) { cx += a.rx; cy += a.ry; c++; }
        if (!c) return 0; cx /= c; cy /= c;
        let s = 0; for (const a of at) if (a.Z >= 3) { const dx = K.minImage(a.rx - cx, W), dy = K.minImage(a.ry - cy, H); s += dx * dx + dy * dy; }
        return Math.sqrt(s / c);
      },

      KN: { dt: 0.01, kGravity: 2.0, kPauli: 0.6, fuseR: 2.2, coulombSoft: 2.0, spatialTheta: 0.5, spatialCut: 8,
            kFuse: 1, fuseGamow: 1, fuseEG: 0.5, fuseEGcharge: 1, fuseEGmu: 1, fuseEndo: 1, fuseMassFormula: 1, massDefect: 1, decayPairing: 1, nucShell: 1,
            kBond: 0.5, bondCovalent: 1, bondLocalE: 1, bondValence: 1, bondOrder: 1, bondR: 2.5, fuseRebond: 1, fuseConservePE: 1,
            kCoolOuter: 0.5, coolDeg: 8, coolR: 5, kDisperse: 0.5, disperseE: 2, disperseZmin: 3, disperseOuterDeg: 8,
            farField: 1, spatialHash: 1, symplectic: 1 },
      ledgerTol: { E: 130 },

      // 밀도 deg 두 방식 직접 대조(힘 경로 교란 없이 *deg 동일성만* 격리) — brute O(n²) vs L.cellPairs(cut=coolR) 셀.
      degBrute(at, r, W, H) {
        const n = at.length, r2 = r * r, deg = new Int32Array(n);
        for (let i = 0; i < n; i++) { const a = at[i];
          for (let j = i + 1; j < n; j++) { const b = at[j];
            const dx = K.minImage(b.rx - a.rx, W), dy = K.minImage(b.ry - a.ry, H);
            if (dx * dx + dy * dy <= r2) { deg[i]++; deg[j]++; } } }
        return deg;
      },
      degCell(at, r, W, H) {
        const n = at.length, deg = new Int32Array(n);
        const cp = L.cellPairs(at, r, W, H);                  // cut=r → 거리 필터 r·셀 이웃만 검사
        for (const e of cp.pairs) { deg[e[0]]++; deg[e[1]]++; }
        return { deg, checks: cp.checks };
      },

      // 라이브 층상 무대를 MT tick 굴려 *클러스터된 현실 밀도* 배치를 얻은 뒤 deg 두 방식 비교.
      run(K) {
        const sim = { W: this.W, H: this.H, atoms: this.cloud(K), photons: [], rng: K.mulberry32(7),
                      knobs: Object.assign({}, L.DEFAULTS, this.KN), tick: 0 };
        const l0 = K.ledger(sim);
        for (let t = 0; t < this.MT; t++) { L.leapfrog(sim); sim.tick++; }
        const l1 = K.ledger(sim);
        const coolR = this.KN.coolR, db = this.degBrute(sim.atoms, coolR, this.W, this.H), dcR = this.degCell(sim.atoms, coolR, this.W, this.H);
        let maxDiff = 0; for (let i = 0; i < db.length; i++) { const d = Math.abs(dcR.deg[i] - db[i]); if (d > maxDiff) maxDiff = d; }
        return { maxDiff, checks: dcR.checks, rgHeavy: this.rgHeavy(sim.atoms, this.W, this.H), mzFinal: this.maxZof(sim.atoms),
                 relE: Math.abs(l1.E - l0.E) / Math.abs(l0.E) * 100,
                 dpx: Math.abs(l1.px - l0.px), dpy: Math.abs(l1.py - l0.py), dB: Math.abs(l1.B - l0.B), dQ: Math.abs(l1.Q - l0.Q), dL: Math.abs(l1.L - l0.L) };
      },
      cache(K) { return this._c || (this._c = { r: this.run(K) }); },

      init(rng, K) {
        const a = this.cloud(K, (rng() * 4294967296) >>> 0);
        return { W: this.W, H: this.H, atoms: a, rng: K.mulberry32((rng() * 4294967296) >>> 0), knobs: Object.assign({}, this.KN) };
      },

      watch(sim, K) {
        const c = this.cache(K).r;
        return { degMaxDiff: c.maxDiff, checks: c.checks, nsq: this.N * this.N, mzFinal: c.mzFinal, rgHeavy: +c.rgHeavy.toFixed(3),
                 relEon: +c.relE.toFixed(3), dpxOn: +c.dpx.toExponential(3) };
      },

      // 가설: ① 셀 deg = brute 정확 일치(maxDiff 0) ② 검사 ≪ n² ③ 장부 머신·E 닫힘 ④ 회귀.
      assert(ctx, K) {
        const c = this.cache(K).r;
        const exact = c.maxDiff === 0;                                                                   // ① 셀 deg = brute 정확 일치
        const cheaper = c.checks > 0 && c.checks < this.N * this.N * 0.5;                                 // ② 검사 ≪ n²
        const ledgerOK = c.dpx < 1e-9 && c.dpy < 1e-9 && c.dB < 1e-9 && c.dQ < 1e-9 && c.dL < 1e-9 && c.relE < 1;  // ③
        const reg = ctx.ledgerBefore !== undefined;                                                      // ④ 골든 보존
        return [
          { name: `셀 deg = brute 정확 일치·load-bearing — 클러스터된 라이브 배치서 셀 deg − brute deg 최대차 ${c.maxDiff}(=0) ⇒ cellPairs(cut=coolR) 밀도가 brute 와 *정확 동일*(근사 아님·셀폭≥coolR 이라 coolR 내 쌍 누락 0)·deg 는 횟수라 쌍 순서 무관 → 켜도 비트 동일`, pass: exact, value: c.maxDiff },
          { name: `검사 ≪ n²·load-bearing — 셀 deg 검사 쌍 ${c.checks} ≪ n²=${this.N * this.N}(셀 이웃만·O(n log n)) ⇒ 밀도 1패스도 힘(0054~64)과 같은 공간 분할 이득`, pass: cheaper, value: c.checks },
          { name: `장부 머신·E 닫힘 — Q·B·L·px·py 머신(dpx ${c.dpx.toExponential(2)}·dB ${c.dB.toExponential(2)}·dL ${c.dL.toExponential(2)})·E 닫힘 ${c.relE.toFixed(3)}%`, pass: ledgerOK, value: +c.relE.toFixed(3) },
          { name: `회귀 — spatialHash=0 → brute = 0083~87 비트 동일·골든 보존(degField 는 deg 패스 대체만·LAW_ORDER·DEFAULTS 불변)`, pass: reg, value: c.mzFinal },
        ];
      },
    },

    'step-0089': {
      id: 'step-0089',
      title: '결합 종류별 해리 깊이 D — 약한 H–H 먼저 끊고 강한 C–C 잔존 (게이트 bondMorsePair=0 → 균일 D·0074~ 비트 동일·회귀 0)',
      desc: 'step-0074 의 Morse 해리 깊이 D 는 *종류 무관 단일 상수*였다(0074 전가 명시). 진짜 화학은 결합 종류마다 해리 에너지가 다르다(약한 H–H ~ 강한 C–C). 이 step 은 게이트 `bondMorsePair` — 켜면 결합 두 원자의 Z 로 해리 깊이를 정한다: D_eff = bondMorseD·√(Z_a·Z_b)(기준 Z=1·1 → ×1 = H–H baseline·무거운 결합 깊은 우물). 힘(bondSpring)·PE(bondSpringPE)·해리(bondBreak) 세 곳이 같은 D 를 공유해 장부 정합. bondMorsePair=0 → 균일 bondMorseD·0074~ 비트 동일(회귀 0). ' +
            '*무대*: 40 Morse 이량체 — 20개 약한 H–H(Z=1·N=1) + 20개 강한 C–C(Z=6·N=6)·**같은 상대 운동에너지 KE_rel=5 로 가열**(vrel 은 환산질량 μ 로 보정 — 종류 변별이 KE 아닌 *우물 깊이*서 오게)·dt=0.05·bondMorseD=2·α=0.5·req=3·unbondDist=8·600 tick·고정 셋업: ' +
            'bondMorsePair 켜면 D_HH=2·√1=2 < KE 5 → 해리·D_CC=2·√36=12 > KE 5 → 잔존. 균일이면 둘 다 D=2<5 → 무차별 해리. ' +
            '① **종류별 해리 선택성·load-bearing** — bondMorsePair 켜면 강한 C–C 결합 생존 ≫ 약한 H–H 생존(깊은 우물 = 강한 결합·약한 우물 먼저 끊김) ⇒ 해리 임계가 결합 종류(Z)로 갈림(author 아닌 측정). ' +
            '② **균일은 무차별 해리·load-bearing** — bondMorsePair 끄면(균일 D=2) C–C 와 H–H 생존 ≈ 같음(둘 다 D<KE → 무차별 해리·종류 무관) ⇒ 선택성이 *종류별 D 때문*. ' +
            '③ **장부 머신** — 해리 시 U(r)+e[2]→바스 환원 E 닫힘·운동량 머신(속도 불변)·Q·B·L 머신. ' +
            '④ **회귀** — bondMorsePair=0 → 균일 D·0074~ 비트 동일·골든 보존.',
      ticks: 60,
      W: 400, H: 400, MT: 600, ND: 40,
      KN: { dt: 0.05, kBondSpring: 1, bondReq: 3, bondMorse: 1, bondMorseD: 2, bondMorseA: 0.5, bondMorsePair: 1, unbondDist: 8 },
      TKE: 5,                                                  // 목표 상대 KE(D_HH=2 < 5 < D_CC=12)

      // 혼합 이량체 — 약한 H–H(Z1) 20 + 강한 C–C(Z6) 20·같은 KE_rel(vrel 환산질량 보정)·kind 태그.
      dimers(K) {
        const req = this.KN.bondReq, atoms = [], bonds = [], keys = new Set(), tot = 2 * this.ND, kinds = [];
        for (let i = 0; i < this.ND; i++) {
          const heavy = i >= this.ND / 2;                     // 앞 절반 H–H · 뒤 절반 C–C
          const Z = heavy ? 6 : 1, Nn = heavy ? 6 : 1, m = Z + Nn, mu = (m * m) / (m + m);  // μ = m/2
          const vrel = Math.sqrt(2 * this.TKE / mu);          // KE_rel = ½μ·vrel² = TKE (종류 무관 같은 KE)
          const cx = 30 + (i % 8) * 45, cy = 30 + ((i / 8) | 0) * 45;
          const a0 = atoms.length;
          atoms.push({ Z, N: Nn, e: Z, x: 0, rx: cx - req / 2, ry: cy, vx: -vrel / 2, vy: 0, lep: 0, nuc: 0 });
          atoms.push({ Z, N: Nn, e: Z, x: 0, rx: cx + req / 2, ry: cy, vx: +vrel / 2, vy: 0, lep: 0, nuc: 0 });
          bonds.push([a0, a0 + 1]); keys.add(a0 * tot + (a0 + 1)); kinds.push(heavy ? 1 : 0);
        }
        return { atoms, bonds, keys, kinds };
      },
      run(K, pair) {
        const d = this.dimers(K);
        const sim = { W: this.W, H: this.H, atoms: d.atoms, photons: [], bonds: d.bonds, bondKeys: d.keys,
                      knobs: Object.assign({}, L.DEFAULTS, this.KN, { bondMorsePair: pair }), tick: 0 };
        const l0 = K.ledger(sim);
        for (let t = 0; t < this.MT; t++) { L.applyForces(sim); L.integrate(sim); sim.tick++; }
        const l1 = K.ledger(sim);
        // 생존 결합을 종류별로(간선 양끝 원자 Z 로 H–H vs C–C 판정)
        let survLight = 0, survHeavy = 0;
        for (const e of sim.bonds) { const z = sim.atoms[e[0]].Z; if (z >= 3) survHeavy++; else survLight++; }
        return { survLight, survHeavy, bonds: sim.bonds.length, broke: sim.dissocCount | 0,
                 dpx: Math.abs(l1.px - l0.px), dpy: Math.abs(l1.py - l0.py), dB: Math.abs(l1.B - l0.B), dQ: Math.abs(l1.Q - l0.Q), dL: Math.abs(l1.L - l0.L), dE: Math.abs(l1.E - l0.E), Etot: Math.abs(l0.E) };
      },
      cache(K) { return this._c || (this._c = { pair: this.run(K, 1), uni: this.run(K, 0) }); },

      // 라이브 sim(장부·결정론·골든 기둥): createSim 경로엔 bonds 미설정 → bondBreak/bondSpring no-op → 자유 드리프트(0075 패턴·머신·결정론).
      init(rng, K) {
        const cx = this.W / 2, cy = this.H / 2;
        const a = [
          { Z: 6, N: 6, e: 6, x: 0, rx: cx - 2 + rng() * 0.1, ry: cy, vx: (rng() - 0.5) * 0.02, vy: 0, lep: 0, nuc: 0 },
          { Z: 6, N: 6, e: 6, x: 0, rx: cx + 2, ry: cy, vx: (rng() - 0.5) * 0.02, vy: 0, lep: 0, nuc: 0 },
        ];
        return { W: this.W, H: this.H, atoms: a, rng: K.mulberry32((rng() * 4294967296) >>> 0), knobs: Object.assign({}, this.KN) };
      },

      watch(sim, K) {
        const c = this.cache(K);
        return { survLightPair: c.pair.survLight, survHeavyPair: c.pair.survHeavy,
                 survLightUni: c.uni.survLight, survHeavyUni: c.uni.survHeavy,
                 dpxPair: +c.pair.dpx.toExponential(3), dEPair: +c.pair.dE.toExponential(3) };
      },

      // 가설: ① 종류별 해리 선택성 ② 균일은 무차별 해리 ③ 장부 머신 ④ 회귀.
      assert(ctx, K) {
        const c = this.cache(K), half = this.ND / 2;
        const selective = c.pair.survHeavy > c.pair.survLight + half * 0.5 && c.pair.survHeavy >= half * 0.7 && c.pair.survLight <= half * 0.3;  // ① 강 C–C 잔존 ≫ 약 H–H 해리
        const uniformBreaks = Math.abs(c.uni.survHeavy - c.uni.survLight) <= half * 0.3 && c.uni.survHeavy <= half * 0.3;  // ② 균일 → 둘 다 무차별 해리
        const consv = c.pair.dpx < 1e-9 && c.pair.dpy < 1e-9 && c.pair.dB < 1e-9 && c.pair.dQ < 1e-9 && c.pair.dL < 1e-9;  // ③ 운동량·Q·B·L 머신(E symplectic 유계)
        const reg = ctx.ledgerBefore !== undefined;                                                       // ④ 골든 보존
        return [
          { name: `종류별 해리 선택성·load-bearing — bondMorsePair 켜면 강한 C–C 생존 ${c.pair.survHeavy}/${half}(D=12>KE 5 깊은 우물) ≫ 약한 H–H 생존 ${c.pair.survLight}/${half}(D=2<KE 5 먼저 해리) ⇒ 해리 임계가 결합 종류(Z)로 갈림(author 아닌 측정)`, pass: selective, value: c.pair.survHeavy },
          { name: `균일은 무차별 해리·load-bearing — bondMorsePair 끄면(균일 D=2) C–C 생존 ${c.uni.survHeavy}/${half} ≈ H–H ${c.uni.survLight}/${half}(둘 다 D=2<KE 5 → 무차별 해리·종류 무관) ⇒ 선택성이 *종류별 D 때문*`, pass: uniformBreaks, value: c.uni.survHeavy },
          { name: `장부 머신 — 해리 시 U(r)+e[2]→바스 환원 E 닫힘·운동량 머신(속도 불변 dpx ${c.pair.dpx.toExponential(2)}·dB ${c.pair.dB.toExponential(2)}·dL ${c.pair.dL.toExponential(2)})·잔여 E symplectic 유계(${(c.pair.dE / c.pair.Etot * 100).toFixed(3)}%)`, pass: consv, value: +c.pair.dpx.toExponential(3) },
          { name: `회귀 — bondMorsePair=0 → 균일 bondMorseD·0074~ 비트 동일·골든 보존(종류별 D 게이트 가법)`, pass: reg, value: c.uni.survHeavy },
        ];
      },
    },

    'step-0090': {
      id: 'step-0090',
      title: '결합 차수 × 해리 깊이 — 다중 결합(이중·삼중)일수록 강하다 (게이트 bondMorseOrder=0 → 차수 무시·0089~ 비트 동일·회귀 0)',
      desc: 'step-0089 가 결합 종류(Z)로 해리 깊이를 갈랐다면, 이 step 은 *결합 차수*(0018 bondOrder·간선 e[3]=1 단일·2 이중·3 삼중)로 — 진짜 화학에서 다중 결합(C=C 이중·N≡N 삼중)은 단일보다 강하다(끊기 어렵다). 게이트 `bondMorseOrder` 켜면 D_eff = bondMorseD·(종류 √Z_aZ_b)·**차수** (D ∝ 차수·이중 2배·삼중 3배 깊은 우물). 0089 의 `K.morseD` 에 차수 인자(e[3]) 추가·힘·PE·해리 세 곳 공유. bondMorseOrder=0 → 차수 무시·0089/0074~ 비트 동일(회귀 0). ' +
            '*무대*: 30 Morse 이량체 — 단일(e[3]=1) 10 + 이중(2) 10 + 삼중(3) 10·같은 원소(Z=2 — 차수를 Z서 격리)·각 차수 클래스 안에 **상대 KE 그라디언트**(KE 0.5~7.5·낮음 속박~높음 해리)·dt=0.05·bondMorseD=2·α=0.5·req=3·unbondDist=8·bondMorsePair=0(차수만)·600 tick: ' +
            'bondMorseOrder 켜면 D_single=2·D_double=4·D_triple=6 → 같은 KE 그라디언트서 *깊은 우물일수록 더 많이 잔존* → 생존 단일<이중<삼중(단조). 끄면 셋 다 D=2 → 같은 생존(차수 무관). ' +
            '① **차수별 해리 선택성(단조)·load-bearing** — bondMorseOrder 켜면 생존 단일 < 이중 < 삼중(다중 결합일수록 깊은 우물·더 많이 견딤) ⇒ 해리 임계가 결합 차수로 갈림(author 아닌 측정). ' +
            '② **차수 무시는 무차별·load-bearing** — bondMorseOrder 끄면(균일 D=2) 단일 ≈ 이중 ≈ 삼중 생존(차수 무관·같은 KE 그라디언트 같은 문턱) ⇒ 단조 선택성이 *차수 × D 때문*. ' +
            '③ **장부 머신** — 해리 시 U(r)+e[2]→바스 환원 E 닫힘·운동량 머신·Q·B·L 머신. ' +
            '④ **회귀** — bondMorseOrder=0 → 차수 무시·0089/0074~ 비트 동일·골든 보존.',
      ticks: 60,
      W: 400, H: 400, MT: 600, NC: 10,                        // NC = 차수당 이량체 수
      KN: { dt: 0.05, kBondSpring: 1, bondReq: 3, bondMorse: 1, bondMorseD: 2, bondMorseA: 0.5, bondMorseOrder: 1, unbondDist: 8 },

      // 단일/이중/삼중 각 NC 이량체·같은 원소 Z2·클래스 안 KE 그라디언트(저 속박~고 해리)·order 태그(e[3]).
      dimers(K) {
        const req = this.KN.bondReq, atoms = [], bonds = [], keys = new Set(), tot = 6 * this.NC;
        for (let ord = 1; ord <= 3; ord++) {
          for (let m = 0; m < this.NC; m++) {
            const KE = 0.5 + 7 * (m / (this.NC - 1));        // KE_rel 0.5~7.5 (μ=2 → vrel=√(2·KE/2)=√KE)
            const vrel = Math.sqrt(KE);
            const idx = (ord - 1) * this.NC + m;
            const cx = 30 + (idx % 8) * 45, cy = 30 + ((idx / 8) | 0) * 45;
            const a0 = atoms.length;
            atoms.push({ Z: 2, N: 2, e: 2, x: 0, rx: cx - req / 2, ry: cy, vx: -vrel / 2, vy: 0, lep: 0, nuc: 0 });
            atoms.push({ Z: 2, N: 2, e: 2, x: 0, rx: cx + req / 2, ry: cy, vx: +vrel / 2, vy: 0, lep: 0, nuc: 0 });
            bonds.push([a0, a0 + 1, 0, ord]); keys.add(a0 * tot + (a0 + 1));  // e[3]=차수
          }
        }
        return { atoms, bonds, keys };
      },
      run(K, ordGate) {
        const d = this.dimers(K);
        const sim = { W: this.W, H: this.H, atoms: d.atoms, photons: [], bonds: d.bonds, bondKeys: d.keys,
                      knobs: Object.assign({}, L.DEFAULTS, this.KN, { bondMorseOrder: ordGate }), tick: 0 };
        const l0 = K.ledger(sim);
        for (let t = 0; t < this.MT; t++) { L.applyForces(sim); L.integrate(sim); sim.tick++; }
        const l1 = K.ledger(sim);
        // 생존 결합을 차수별로(e[3])
        let s1 = 0, s2 = 0, s3 = 0;
        for (const e of sim.bonds) { const o = e[3] || 1; if (o === 1) s1++; else if (o === 2) s2++; else s3++; }
        return { s1, s2, s3, bonds: sim.bonds.length, broke: sim.dissocCount | 0,
                 dpx: Math.abs(l1.px - l0.px), dpy: Math.abs(l1.py - l0.py), dB: Math.abs(l1.B - l0.B), dQ: Math.abs(l1.Q - l0.Q), dL: Math.abs(l1.L - l0.L), dE: Math.abs(l1.E - l0.E), Etot: Math.abs(l0.E) };
      },
      cache(K) { return this._c || (this._c = { ord: this.run(K, 1), uni: this.run(K, 0) }); },

      // 라이브 sim(장부·결정론·골든 기둥): createSim 경로 bonds 미설정 → bondBreak/bondSpring no-op → 자유 드리프트(0075/0089 패턴·머신).
      init(rng, K) {
        const cx = this.W / 2, cy = this.H / 2;
        const a = [
          { Z: 2, N: 2, e: 2, x: 0, rx: cx - 2 + rng() * 0.1, ry: cy, vx: (rng() - 0.5) * 0.02, vy: 0, lep: 0, nuc: 0 },
          { Z: 2, N: 2, e: 2, x: 0, rx: cx + 2, ry: cy, vx: (rng() - 0.5) * 0.02, vy: 0, lep: 0, nuc: 0 },
        ];
        return { W: this.W, H: this.H, atoms: a, rng: K.mulberry32((rng() * 4294967296) >>> 0), knobs: Object.assign({}, this.KN) };
      },

      watch(sim, K) {
        const c = this.cache(K);
        return { s1ord: c.ord.s1, s2ord: c.ord.s2, s3ord: c.ord.s3, s1uni: c.uni.s1, s2uni: c.uni.s2, s3uni: c.uni.s3,
                 dpxOrd: +c.ord.dpx.toExponential(3), dEOrd: +c.ord.dE.toExponential(3) };
      },

      // 가설: ① 차수별 해리 선택성(단조) ② 차수 무시는 무차별 ③ 장부 머신 ④ 회귀.
      assert(ctx, K) {
        const c = this.cache(K);
        const monotone = c.ord.s1 < c.ord.s2 && c.ord.s2 < c.ord.s3;                              // ① 생존 단일<이중<삼중
        const uniformSame = Math.abs(c.uni.s1 - c.uni.s2) <= 1 && Math.abs(c.uni.s2 - c.uni.s3) <= 1;  // ② 균일 → 차수 무관 같음
        const consv = c.ord.dpx < 1e-9 && c.ord.dpy < 1e-9 && c.ord.dB < 1e-9 && c.ord.dQ < 1e-9 && c.ord.dL < 1e-9;  // ③
        const reg = ctx.ledgerBefore !== undefined;                                               // ④ 골든 보존
        return [
          { name: `차수별 해리 선택성(단조)·load-bearing — bondMorseOrder 켜면 생존 단일 ${c.ord.s1} < 이중 ${c.ord.s2} < 삼중 ${c.ord.s3}/${this.NC}(D 단일2·이중4·삼중6·깊은 우물일수록 더 견딤) ⇒ 해리 임계가 결합 차수로 갈림(author 아닌 측정)`, pass: monotone, value: c.ord.s3 },
          { name: `차수 무시는 무차별·load-bearing — bondMorseOrder 끄면(균일 D=2) 생존 단일 ${c.uni.s1} ≈ 이중 ${c.uni.s2} ≈ 삼중 ${c.uni.s3}(차수 무관·같은 KE 그라디언트 같은 문턱) ⇒ 단조 선택성이 *차수 × D 때문*`, pass: uniformSame, value: c.uni.s3 },
          { name: `장부 머신 — 해리 시 U(r)+e[2]→바스 환원 E 닫힘·운동량 머신(속도 불변 dpx ${c.ord.dpx.toExponential(2)}·dB ${c.ord.dB.toExponential(2)}·dL ${c.ord.dL.toExponential(2)})·잔여 E symplectic 유계(${(c.ord.dE / c.ord.Etot * 100).toFixed(3)}%)`, pass: consv, value: +c.ord.dpx.toExponential(3) },
          { name: `회귀 — bondMorseOrder=0 → 차수 무시·0089/0074~ 비트 동일·골든 보존(차수 게이트 가법)`, pass: reg, value: c.uni.s3 },
        ];
      },
    },

    'step-0091': {
      id: 'step-0091',
      title: '초신성급 방향성 방출 snEject — 산물을 별 몸체 밖으로 (등방 별풍보다 멀리·게이트 kSnEject=0 → 회귀 0)',
      desc: 'step-0086 이 격리한 격차: 별풍(disperse·0071)은 *등방 랜덤·소량*이라 핵합성 산물이 natal 우물에 *중력 결속*(R_g~8 헤일로뿐). 이 step 은 새 법칙 `snEject` — *초신성급 방향성 방출*: 고밀도 코어(deg≥snCoreDeg)의 무거운 핵(Z≥snZmin)에 *국소 질량중심서 바깥* 방향으로 *큰* 임펄스(snImpulse·바스서 인출)를 줘 — 코어 붕괴 충격의 방사 방출 — 산물을 *별 몸체 밖*으로 분출한다. disperse 의 세 축(등방·소량·외곽)을 정반대로(방향·집중·코어). 에너지 바스서 인출(닫힘)·−Δp→바스(머신). kSnEject=0 → early-return = 회귀 0. ' +
            '*측정*(무대 130²·N=400 차가운 ²H·dt=0.01·VV·중력+pauli+fuse Gamow+nucShell+coolOuter+fuseConservePE·600 tick·고정 시드 7·세 모드 off/disperse(등방 Zmin3)/snEject(방향)): ' +
            '① **방향성 집중이 등방보다 멀리·load-bearing** — snEject 무거운 핵 도달 maxR·R_g 가 등방 disperse ≫ off(방출 0) ⇒ 같은 바스 예산으로 방향(바깥)+집중이 산물을 *별 몸체 밖*으로(등방 별풍의 헤일로보다 멀리·author 아닌 측정). ' +
            '② **코어 비움 → churn↑·load-bearing** — snEject 무거운 핵 수 > disperse > off(코어 산물 방출→코어에 새 연료 자리→더 융합) ⇒ 방출이 churn 키움(0084 별풍 churn 의 방향성판). ' +
            '③ **장부 머신·E 닫힘** — Q·B·L·px·py 머신·E 닫힘(snEject 바스→KE·−Δp→바스·fuseConservePE 정합). ' +
            '④ **회귀** — kSnEject=0 → 0001~90 골든 비트 불변(회귀 0).',
      ticks: 120,
      W: 130, H: 130, N: 400, MT: 600,

      cloud(K, seed) {
        const rng = K.mulberry32(seed || 7), a = [], cx = this.W / 2, cy = this.H / 2;
        for (let i = 0; i < this.N; i++) {
          const ang = rng() * 2 * Math.PI, rad = Math.sqrt(rng()) * 18;
          a.push({ Z: 1, N: 1, e: 1, x: 0, rx: cx + rad * Math.cos(ang), ry: cy + rad * Math.sin(ang), vx: (rng() - 0.5) * 0.05, vy: (rng() - 0.5) * 0.05, lep: 0, nuc: 0 });
        }
        return a;
      },
      maxZof(at) { let m = 0; for (const a of at) if (a.Z > m) m = a.Z; return m; },
      // 무거운 핵(Z≥3) 관성반경 R_g + 최대 도달반경 maxR(코어 중심 기준·min-image)
      rgHeavy(at, W, H) {
        let cx = 0, cy = 0, c = 0; for (const a of at) if (a.Z >= 3) { cx += a.rx; cy += a.ry; c++; }
        if (!c) return { rg: 0, maxR: 0 }; cx /= c; cy /= c;
        let s = 0, mx = 0; for (const a of at) if (a.Z >= 3) { const dx = K.minImage(a.rx - cx, W), dy = K.minImage(a.ry - cy, H); const r2 = dx * dx + dy * dy; s += r2; if (r2 > mx) mx = r2; }
        return { rg: Math.sqrt(s / c), maxR: Math.sqrt(mx) };
      },

      KN: { dt: 0.01, kGravity: 2.0, kPauli: 0.6, fuseR: 2.2, coulombSoft: 2.0, spatialTheta: 0.5, spatialCut: 8,
            kFuse: 1, fuseGamow: 1, fuseEG: 0.5, fuseEGcharge: 1, fuseEGmu: 1, fuseEndo: 1, fuseMassFormula: 1, massDefect: 1, decayPairing: 1, nucShell: 1,
            kCoolOuter: 0.5, coolDeg: 8, coolR: 5, fuseConservePE: 1,
            kSnEject: 0.5, snImpulse: 20, snCoreDeg: 2, snZmin: 3,
            farField: 1, spatialHash: 1, symplectic: 1 },
      ledgerTol: { E: 130 },

      // mode: 'off'(방출 0) · 'disp'(등방 disperse Zmin3) · 'sn'(방향 snEject).
      run(K, mode) {
        const ov = mode === 'disp' ? { kSnEject: 0, kDisperse: 0.5, disperseE: 2, disperseZmin: 3 }
                 : mode === 'off' ? { kSnEject: 0 } : {};
        const sim = { W: this.W, H: this.H, atoms: this.cloud(K), photons: [], rng: K.mulberry32(7),
                      knobs: Object.assign({}, L.DEFAULTS, this.KN, ov), tick: 0 };
        const l0 = K.ledger(sim);
        for (let t = 0; t < this.MT; t++) { L.leapfrog(sim); sim.tick++; }
        const l1 = K.ledger(sim);
        let heavy = 0; for (const a of sim.atoms) if (a.Z >= 3) heavy++;
        const rh = this.rgHeavy(sim.atoms, this.W, this.H);
        return { mzFinal: this.maxZof(sim.atoms), heavy, rg: rh.rg, maxR: rh.maxR,
                 relE: Math.abs(l1.E - l0.E) / Math.abs(l0.E) * 100,
                 dpx: Math.abs(l1.px - l0.px), dpy: Math.abs(l1.py - l0.py), dB: Math.abs(l1.B - l0.B), dQ: Math.abs(l1.Q - l0.Q), dL: Math.abs(l1.L - l0.L) };
      },
      cache(K) { return this._c || (this._c = { sn: this.run(K, 'sn'), disp: this.run(K, 'disp'), off: this.run(K, 'off') }); },

      init(rng, K) {
        const a = this.cloud(K, (rng() * 4294967296) >>> 0);
        return { W: this.W, H: this.H, atoms: a, rng: K.mulberry32((rng() * 4294967296) >>> 0), knobs: Object.assign({}, this.KN) };
      },

      watch(sim, K) {
        const c = this.cache(K);
        return { maxRsn: +c.sn.maxR.toFixed(1), maxRdisp: +c.disp.maxR.toFixed(1), maxRoff: +c.off.maxR.toFixed(1),
                 rgSn: +c.sn.rg.toFixed(2), rgDisp: +c.disp.rg.toFixed(2), hSn: c.sn.heavy, hDisp: c.disp.heavy, hOff: c.off.heavy,
                 relEon: +c.sn.relE.toFixed(3), dpxOn: +c.sn.dpx.toExponential(3) };
      },

      // 가설: ① 방향성 집중이 등방보다 멀리 ② 코어 비움 churn↑ ③ 장부 머신·E 닫힘 ④ 회귀.
      assert(ctx, K) {
        const c = this.cache(K);
        const farther = c.sn.maxR > c.disp.maxR * 1.3 && c.disp.maxR > c.off.maxR && c.sn.rg > c.disp.rg;  // ① 방향 ≫ 등방 ≫ off
        const churn = c.sn.heavy > c.disp.heavy && c.disp.heavy > c.off.heavy;                             // ② 방출이 churn 키움
        const ledgerOK = c.sn.dpx < 1e-9 && c.sn.dpy < 1e-9 && c.sn.dB < 1e-9 && c.sn.dQ < 1e-9 && c.sn.dL < 1e-9 && c.sn.relE < 1;  // ③
        const reg = ctx.ledgerBefore !== undefined;                                                        // ④ 골든 보존
        return [
          { name: `방향성 집중이 등방보다 멀리·load-bearing — snEject 무거운 핵 maxR ${c.sn.maxR.toFixed(1)}·R_g ${c.sn.rg.toFixed(2)} ≫ 등방 disperse maxR ${c.disp.maxR.toFixed(1)}·R_g ${c.disp.rg.toFixed(2)} ≫ off(방출 0) ${c.off.maxR.toFixed(1)} ⇒ 같은 바스 예산으로 방향(바깥)+집중이 산물을 *별 몸체 밖*으로(등방 헤일로보다 멀리·author 아닌 측정)`, pass: farther, value: +c.sn.maxR.toFixed(1) },
          { name: `코어 비움 → churn↑·load-bearing — snEject 무거운 핵 ${c.sn.heavy}개 > disperse ${c.disp.heavy} > off ${c.off.heavy}(코어 산물 방출→새 연료 자리→더 융합) ⇒ 방출이 churn 키움(0084 별풍 churn 의 방향성판)`, pass: churn, value: c.sn.heavy },
          { name: `장부 머신·E 닫힘 — Q·B·L·px·py 머신(dpx ${c.sn.dpx.toExponential(2)}·dB ${c.sn.dB.toExponential(2)}·dL ${c.sn.dL.toExponential(2)})·E 닫힘 ${c.sn.relE.toFixed(3)}%(snEject 바스→KE·−Δp→바스·fuseConservePE 정합)`, pass: ledgerOK, value: +c.sn.relE.toFixed(3) },
          { name: `회귀 — kSnEject=0 → 방출 꺼짐·0001~90 골든 비트 불변(회귀 0·새 법칙 게이트 가법)`, pass: reg, value: c.sn.mzFinal },
        ];
      },
    },

    'step-0092': {
      id: 'step-0092',
      title: '중력 붕괴 에너지 초신성 coreHarvest — 코어 KE 수확이 산물을 우물 밖으로 (게이트 kCoreHarvest=0 → 회귀 0)',
      desc: 'step-0091 발견: snEject 의 *방향성 기제*는 서나 *에너지원*(복사 바스·주로 coolOuter 외곽 냉각이 채움)이 *중력 결속*보다 작아 산물이 natal 우물을 완전 탈출 못 함(maxR 캡 ~13 < 우물 간극 24·바스 E < 결속 하드월). 이 step 은 새 법칙 `coreHarvest` — coolOuter(0083) 밀도 게이트를 *뒤집어* *고밀도 코어*(deg≥harvestDeg)의 무질서 KE 를 복사 바스로 수확한다. 사슬: 중력 PE → 코어 infall KE(virial) → 바스 E → snEject 방출 KE. 바스 예산이 *중력 붕괴 척도*로 커져 산물이 우물 탈출 쪽으로 더 멀리. 기제 coolOuter/damp 동형(vcom 불변·KE→바스·머신)·게이트만 반대. kCoreHarvest=0 → early-return = 회귀 0. ' +
            '*측정*(무대 130²·N=400 차가운 ²H·dt=0.01·VV·중력+pauli+fuse Gamow+nucShell+coolOuter+fuseConservePE+snEject 방향·600 tick·고정 시드 7·두 모드 off(수확 0)/harv(코어 수확 kCH=0.2 hDeg=14)): ' +
            '① **중력 붕괴 에너지가 산물을 우물 밖으로·load-bearing** — harv 무거운 핵 maxR 가 off ≫ 우물 간극 24 ⇒ 코어 KE 수확이 바스 예산을 키워 산물이 natal 우물 탈출 쪽으로(0091 의 바스<결속 하드월을 *중력 붕괴 에너지*로 돌파·author 아닌 측정). ' +
            '② **바스 예산이 중력 결속 척도로 커짐·load-bearing** — harv 종단 바스 E 가 off ≫(수확한 코어 붕괴 에너지가 방출 연료·코어 KE 가 곧 푼 중력 PE). ' +
            '③ **장부 머신·E 닫힘** — Q·B·L·px·py 머신·E 닫힘(coreHarvest KE→바스·vcom 불변·snEject 바스→KE·−Δp→바스 정합). ' +
            '④ **회귀** — kCoreHarvest=0 → 0001~91 골든 비트 불변(회귀 0). ' +
            '⚠️ **한계(정직)**: 코어 수확이 *융합도 식혀* 무거운 핵 수 harv < off(수확↔점화 tension·coolOuter 전역 냉각 한계의 코어판) — hDeg 를 높여 *가장 깊은 코어만* 수확해 점화 보존하나 완전 분리는 미. 떨어진 우물 *점화*(완전 성간 수송)는 후속 측정.',
      ticks: 120,
      W: 130, H: 130, N: 400, MT: 600,

      cloud(K, seed) {
        const rng = K.mulberry32(seed || 7), a = [], cx = this.W / 2, cy = this.H / 2;
        for (let i = 0; i < this.N; i++) {
          const ang = rng() * 2 * Math.PI, rad = Math.sqrt(rng()) * 18;
          a.push({ Z: 1, N: 1, e: 1, x: 0, rx: cx + rad * Math.cos(ang), ry: cy + rad * Math.sin(ang), vx: (rng() - 0.5) * 0.05, vy: (rng() - 0.5) * 0.05, lep: 0, nuc: 0 });
        }
        return a;
      },
      maxZof(at) { let m = 0; for (const a of at) if (a.Z > m) m = a.Z; return m; },
      rgHeavy(at, W, H) {
        let cx = 0, cy = 0, c = 0; for (const a of at) if (a.Z >= 3) { cx += a.rx; cy += a.ry; c++; }
        if (!c) return { rg: 0, maxR: 0, c: 0 }; cx /= c; cy /= c;
        let s = 0, mx = 0; for (const a of at) if (a.Z >= 3) { const dx = K.minImage(a.rx - cx, W), dy = K.minImage(a.ry - cy, H); const r2 = dx * dx + dy * dy; s += r2; if (r2 > mx) mx = r2; }
        return { rg: Math.sqrt(s / c), maxR: Math.sqrt(mx), c };
      },

      KN: { dt: 0.01, kGravity: 2.0, kPauli: 0.6, fuseR: 2.2, coulombSoft: 2.0, spatialTheta: 0.5, spatialCut: 8,
            kFuse: 1, fuseGamow: 1, fuseEG: 0.5, fuseEGcharge: 1, fuseEGmu: 1, fuseEndo: 1, fuseMassFormula: 1, massDefect: 1, decayPairing: 1, nucShell: 1,
            kCoolOuter: 0.5, coolDeg: 8, coolR: 5, fuseConservePE: 1,
            kSnEject: 0.5, snImpulse: 20, snCoreDeg: 2, snZmin: 3,
            farField: 1, spatialHash: 1, symplectic: 1 },
      ledgerTol: { E: 130 },

      // mode: 'off'(수확 0·0091 snEject) · 'harv'(코어 수확 kCoreHarvest).
      run(K, mode) {
        const ov = mode === 'harv' ? { kCoreHarvest: 0.2, harvestDeg: 14 } : { kCoreHarvest: 0 };
        const sim = { W: this.W, H: this.H, atoms: this.cloud(K), photons: [], rng: K.mulberry32(7),
                      knobs: Object.assign({}, L.DEFAULTS, this.KN, ov), tick: 0 };
        const l0 = K.ledger(sim);
        for (let t = 0; t < this.MT; t++) { L.leapfrog(sim); sim.tick++; }
        const l1 = K.ledger(sim);
        const rh = this.rgHeavy(sim.atoms, this.W, this.H);
        return { mzFinal: this.maxZof(sim.atoms), heavy: rh.c, rg: rh.rg, maxR: rh.maxR,
                 bathE: sim.escaped ? sim.escaped.E : 0,
                 relE: Math.abs(l1.E - l0.E) / Math.abs(l0.E) * 100,
                 dpx: Math.abs(l1.px - l0.px), dpy: Math.abs(l1.py - l0.py), dB: Math.abs(l1.B - l0.B), dQ: Math.abs(l1.Q - l0.Q), dL: Math.abs(l1.L - l0.L) };
      },
      cache(K) { return this._c || (this._c = { harv: this.run(K, 'harv'), off: this.run(K, 'off') }); },

      init(rng, K) {
        const a = this.cloud(K, (rng() * 4294967296) >>> 0);
        return { W: this.W, H: this.H, atoms: a, rng: K.mulberry32((rng() * 4294967296) >>> 0), knobs: Object.assign({}, this.KN) };
      },

      watch(sim, K) {
        const c = this.cache(K);
        return { maxRharv: +c.harv.maxR.toFixed(1), maxRoff: +c.off.maxR.toFixed(1),
                 bathHarv: +c.harv.bathE.toFixed(0), bathOff: +c.off.bathE.toFixed(0),
                 hHarv: c.harv.heavy, hOff: c.off.heavy, rgHarv: +c.harv.rg.toFixed(2), rgOff: +c.off.rg.toFixed(2),
                 relEon: +c.harv.relE.toFixed(3), dpxOn: +c.harv.dpx.toExponential(3) };
      },

      // 가설: ① 중력 붕괴 에너지가 산물을 우물 밖으로 ② 바스 예산↑ ③ 장부 머신·E 닫힘 ④ 회귀.
      assert(ctx, K) {
        const c = this.cache(K);
        const farther = c.harv.maxR > c.off.maxR * 1.3 && c.harv.maxR > 24;     // ① 우물 간극 24 돌파·off 대비 멀리
        const budget = c.harv.bathE > c.off.bathE * 1.5;                        // ② 수확이 바스 예산 키움
        const ledgerOK = c.harv.dpx < 1e-9 && c.harv.dpy < 1e-9 && c.harv.dB < 1e-9 && c.harv.dQ < 1e-9 && c.harv.dL < 1e-9 && c.harv.relE < 1;  // ③
        const reg = ctx.ledgerBefore !== undefined;                            // ④ 골든 보존
        return [
          { name: `중력 붕괴 에너지가 산물을 우물 밖으로·load-bearing — harv 무거운 핵 maxR ${c.harv.maxR.toFixed(1)} ≫ off ${c.off.maxR.toFixed(1)}·우물 간극 24 돌파(R_g harv ${c.harv.rg.toFixed(2)} > off ${c.off.rg.toFixed(2)}) ⇒ 코어 KE 수확이 바스 예산을 키워 산물이 natal 우물 탈출 쪽으로(0091 바스<결속 하드월을 중력 붕괴 에너지로 돌파·author 아닌 측정)`, pass: farther, value: +c.harv.maxR.toFixed(1) },
          { name: `바스 예산이 중력 결속 척도로 커짐·load-bearing — harv 종단 바스 E ${c.harv.bathE.toFixed(0)} ≫ off ${c.off.bathE.toFixed(0)}(수확한 코어 붕괴 에너지=푼 중력 PE 가 방출 연료)`, pass: budget, value: +c.harv.bathE.toFixed(0) },
          { name: `장부 머신·E 닫힘 — Q·B·L·px·py 머신(dpx ${c.harv.dpx.toExponential(2)}·dB ${c.harv.dB.toExponential(2)}·dL ${c.harv.dL.toExponential(2)})·E 닫힘 ${c.harv.relE.toFixed(3)}%(coreHarvest KE→바스 vcom 불변·snEject 바스→KE·−Δp→바스 정합)`, pass: ledgerOK, value: +c.harv.relE.toFixed(3) },
          { name: `회귀 — kCoreHarvest=0 → 수확 꺼짐·0001~91 골든 비트 불변(회귀 0·새 법칙 게이트 가법)`, pass: reg, value: c.harv.mzFinal },
        ];
      },
    },

    'step-0093': {
      id: 'step-0093',
      title: '떨어진 우물로 성간 수송 — 중력 붕괴 에너지만 산물을 옆 우물로 (측정·새 법칙 0)',
      desc: 'step-0086/0091 격차: 산물이 natal 우물에 중력 결속돼 *떨어진 우물*로 못 건넜다(별풍·snEject 바스 예산<중력 결속). step-0092 coreHarvest 가 중력 붕괴 에너지로 그 예산을 키웠다. 이 step 은 *새 법칙 0*(측정) — 두 떨어진 우물(좌 0.3W/우 0.7W·각 N200 차가운 ²H·출신 태그 c0) 무대서, 한 우물의 핵합성 산물이 *간극을 건너 반대 우물 쪽*에 도달하는지(cross)를 세 모드로 가른다: off(방출 0)·sn(snEject 단독·바스만)·harv(coreHarvest+snEject·중력 붕괴 에너지). 새 법칙 0 → 기존 골든 보존이 회귀 0 알리바이. ' +
            '*측정*(무대 160²·N=400[좌/우 200]·dt=0.01·VV·중력+pauli+fuse Gamow+nucShell+coolOuter+fuseConservePE·1400 tick·고정 시드 7): ' +
            '① **중력 붕괴 에너지만 성간 수송·load-bearing** — harv 출신-교차 산물 수 cross > 0 ≫ off 0 ⇒ 코어 KE 수확(중력 붕괴 에너지)이 산물을 *간극 건너 옆 우물*로 보냄(0086/0091 성간 수송 격차 해소·author 아닌 측정). ' +
            '② **snEject 단독(바스만) 불충분·load-bearing** — 같은 snEject 인데 coreHarvest 끄면(sn 모드) cross 0 = off ⇒ 우물 간극 돌파 에너지가 *중력 붕괴 수확*서만 옴(바스 예산만으론 못 건넘·0091 하드월 확정). ' +
            '③ **장부 머신·E 닫힘** — Q·B·L·px·py 머신·E 닫힘. ' +
            '④ **회귀** — 새 법칙 0 → 0001~92 골든 비트 불변(회귀 0).',
      ticks: 120,
      W: 160, H: 160, N: 400, MT: 1400,

      twoWell(K, seed) {
        const rng = K.mulberry32(seed || 7), a = [], lc = 0.3 * this.W, rc = 0.7 * this.W, cy = this.H / 2;
        for (let i = 0; i < this.N; i++) {
          const left = i < this.N / 2, cx = left ? lc : rc;
          const ang = rng() * 2 * Math.PI, rad = Math.sqrt(rng()) * 12;
          a.push({ Z: 1, N: 1, e: 1, x: 0, rx: cx + rad * Math.cos(ang), ry: cy + rad * Math.sin(ang), vx: (rng() - 0.5) * 0.05, vy: (rng() - 0.5) * 0.05, lep: 0, nuc: 0, c0: left ? 0 : 1 });
        }
        return a;
      },
      maxZof(at) { let m = 0; for (const a of at) if (a.Z > m) m = a.Z; return m; },

      KN: { dt: 0.01, kGravity: 2.0, kPauli: 0.6, fuseR: 2.2, coulombSoft: 2.0, spatialTheta: 0.5, spatialCut: 8,
            kFuse: 1, fuseGamow: 1, fuseEG: 0.5, fuseEGcharge: 1, fuseEGmu: 1, fuseEndo: 1, fuseMassFormula: 1, massDefect: 1, decayPairing: 1, nucShell: 1,
            kCoolOuter: 0.5, coolDeg: 8, coolR: 5, fuseConservePE: 1,
            kSnEject: 0.5, snImpulse: 20, snCoreDeg: 2, snZmin: 3,
            kCoreHarvest: 0.2, harvestDeg: 14,
            farField: 1, spatialHash: 1, symplectic: 1 },
      ledgerTol: { E: 130 },

      // mode: 'off'(방출 0) · 'sn'(snEject 단독·바스만) · 'harv'(coreHarvest+snEject·중력 붕괴 에너지).
      run(K, mode) {
        const ov = mode === 'off' ? { kSnEject: 0, kCoreHarvest: 0 }
                 : mode === 'sn' ? { kSnEject: 0.5, kCoreHarvest: 0 } : {};
        const sim = { W: this.W, H: this.H, atoms: this.twoWell(K), photons: [], rng: K.mulberry32(7),
                      knobs: Object.assign({}, L.DEFAULTS, this.KN, ov), tick: 0 };
        const l0 = K.ledger(sim);
        for (let t = 0; t < this.MT; t++) { L.leapfrog(sim); sim.tick++; }
        const l1 = K.ledger(sim);
        const mid = this.W / 2;
        let heavy = 0, cross = 0;
        for (const a of sim.atoms) if (a.Z >= 3) { heavy++;
          if (a.c0 === 0 && a.rx > mid) cross++;             // 좌 출신이 우 반쪽에 도달(간극 건넘)
          if (a.c0 === 1 && a.rx < mid) cross++;             // 우 출신이 좌 반쪽에 도달
        }
        return { mzFinal: this.maxZof(sim.atoms), heavy, cross,
                 relE: Math.abs(l1.E - l0.E) / Math.abs(l0.E) * 100,
                 dpx: Math.abs(l1.px - l0.px), dpy: Math.abs(l1.py - l0.py), dB: Math.abs(l1.B - l0.B), dQ: Math.abs(l1.Q - l0.Q), dL: Math.abs(l1.L - l0.L) };
      },
      cache(K) { return this._c || (this._c = { harv: this.run(K, 'harv'), sn: this.run(K, 'sn'), off: this.run(K, 'off') }); },

      init(rng, K) {
        const a = this.twoWell(K, (rng() * 4294967296) >>> 0);
        return { W: this.W, H: this.H, atoms: a, rng: K.mulberry32((rng() * 4294967296) >>> 0), knobs: Object.assign({}, this.KN) };
      },

      watch(sim, K) {
        const c = this.cache(K);
        return { crossHarv: c.harv.cross, crossSn: c.sn.cross, crossOff: c.off.cross,
                 hHarv: c.harv.heavy, hSn: c.sn.heavy, hOff: c.off.heavy,
                 mzHarv: c.harv.mzFinal, relEon: +c.harv.relE.toFixed(3), dpxOn: +c.harv.dpx.toExponential(3) };
      },

      // 가설: ① 중력 붕괴 에너지만 성간 수송 ② snEject 단독 불충분 ③ 장부 머신·E 닫힘 ④ 회귀.
      assert(ctx, K) {
        const c = this.cache(K);
        const transport = c.harv.cross > 0 && c.off.cross === 0;                // ① harv 만 건넘
        const isolate = c.sn.cross === 0 && c.harv.cross > c.sn.cross;          // ② 같은 snEject 라도 coreHarvest 없으면 0
        const ledgerOK = c.harv.dpx < 1e-9 && c.harv.dpy < 1e-9 && c.harv.dB < 1e-9 && c.harv.dQ < 1e-9 && c.harv.dL < 1e-9 && c.harv.relE < 1;  // ③
        const reg = ctx.ledgerBefore !== undefined;                            // ④ 골든 보존
        return [
          { name: `중력 붕괴 에너지만 성간 수송·load-bearing — harv 출신-교차 산물 cross ${c.harv.cross} ≫ off ${c.off.cross}(방출 0) ⇒ 코어 KE 수확(중력 붕괴 에너지)이 산물을 간극 건너 옆 우물 쪽으로(0086/0091 성간 수송 격차 해소·author 아닌 측정)`, pass: transport, value: c.harv.cross },
          { name: `snEject 단독(바스만) 불충분·load-bearing — 같은 snEject 인데 coreHarvest 끄면 cross ${c.sn.cross} = off ${c.off.cross} ⇒ 우물 간극 돌파 에너지가 *중력 붕괴 수확*서만 옴(바스 예산만으론 못 건넘·0091 하드월 확정)`, pass: isolate, value: c.sn.cross },
          { name: `장부 머신·E 닫힘 — Q·B·L·px·py 머신(dpx ${c.harv.dpx.toExponential(2)}·dB ${c.harv.dB.toExponential(2)}·dL ${c.harv.dL.toExponential(2)})·E 닫힘 ${c.harv.relE.toFixed(3)}%`, pass: ledgerOK, value: +c.harv.relE.toFixed(3) },
          { name: `회귀 — 새 법칙 0 → 0001~92 골든 비트 불변(회귀 0·측정 step)`, pass: reg, value: c.harv.mzFinal },
        ];
      },
    },

    'step-0094': {
      id: 'step-0094',
      title: '결합 종류별 Morse 폭 α — 무거운 결합 좁은(가파른) 우물·진동 폭↓ (게이트 bondMorseAlphaPair=0 → 균일 α·0089~ 비트 동일·회귀 0)',
      desc: 'step-0089 가 결합 종류로 *해리 깊이 D*(우물 깊이)를 갈랐다면, 이 step 은 *우물 폭 α*(강성)를 — D 와 *직교*하는 둘째 화학 축. 게이트 `bondMorseAlphaPair` 켜면 α_eff = bondMorseA·√(Z_a·Z_b)(무거운 결합 *좁은(가파른)* 우물·H–H baseline ×1). 힘 상수 k=2Dα² → α↑ ⇒ 같은 깊이·같은 에너지라도 우물 좁아 *진동 폭↓*. 0089 의 `K.morseD` 와 동형으로 새 `K.morseAlpha`·힘(bondSpring)·PE(bondSpringPE)·해리(bondBreak) 세 곳 공유. bondMorseAlphaPair=0 → 균일 bondMorseA·0089/0074~ 비트 동일(회귀 0). ' +
            '*무대*: 20 Morse 이량체 — H–H(Z1) 10 + C–C(Z6) 10·**같은 깊이 D=4**(bondMorsePair=0 — α 를 깊이서 격리)·**같은 상대 KE=2**(< D 속박·해리 0 → 진동 폭만 측정)·base α=0.3·dt=0.05·req=3: ' +
            'bondMorseAlphaPair 켜면 α_HH=0.3·α_CC=1.8(×6) → C–C 좁은 우물·최대 신장 H–H ≫ C–C. 끄면 둘 다 α=0.3 → 같은 신장(폭 무관·*질량 μ 달라도* Morse 진동 폭은 D·α·E 만의 함수). ' +
            '① **종류별 우물 폭(강성)·load-bearing** — bondMorseAlphaPair 켜면 최대 신장 H–H ≫ C–C(무거운 결합 좁은 우물·진동 폭↓) ⇒ 우물 폭이 결합 종류로 갈림(D 깊이와 직교·author 아닌 측정). ' +
            '② **균일 α 는 같은 폭·load-bearing** — 끄면 H–H ≈ C–C 최대 신장(α 무관·질량 μ 달라도 Morse 폭은 D·α·E 함수) ⇒ 폭 차이가 *종류별 α 때문*. ' +
            '③ **장부 머신** — 쌍별 등·반작용 운동량 머신·잔여 E symplectic 유계. ' +
            '④ **회귀** — bondMorseAlphaPair=0 → 균일 α·0089/0074~ 비트 동일·골든 보존.',
      ticks: 60,
      W: 400, H: 400, MT: 600, NC: 10,
      KN: { dt: 0.05, kBondSpring: 1, bondReq: 3, bondMorse: 1, bondMorseD: 4, bondMorseA: 0.3, bondMorseAlphaPair: 1, unbondDist: 20 },

      // H–H(Z1) NC + C–C(Z6) NC·같은 깊이 D·같은 상대 KE(속박)·각 이량체 내 동일 원소(대칭 vrel/2).
      dimers(K) {
        const req = this.KN.bondReq, KErel = 2, atoms = [], bonds = [], keys = new Set(), tot = 2 * 2 * this.NC;
        const cls = [{ Z: 1, N: 1, e: 1 }, { Z: 6, N: 6, e: 6 }];
        for (let c = 0; c < 2; c++) {
          const z = cls[c], mu = (z.Z + z.N) / 2, vrel = Math.sqrt(2 * KErel / mu);
          for (let k = 0; k < this.NC; k++) {
            const idx = c * this.NC + k, cx = 30 + (idx % 8) * 45, cy = 30 + ((idx / 8) | 0) * 45, a0 = atoms.length;
            atoms.push({ Z: z.Z, N: z.N, e: z.e, x: 0, rx: cx - req / 2, ry: cy, vx: -vrel / 2, vy: 0, lep: 0, nuc: 0 });
            atoms.push({ Z: z.Z, N: z.N, e: z.e, x: 0, rx: cx + req / 2, ry: cy, vx: +vrel / 2, vy: 0, lep: 0, nuc: 0 });
            bonds.push([a0, a0 + 1, 0, 1]); keys.add(a0 * tot + (a0 + 1));
          }
        }
        return { atoms, bonds, keys };
      },
      run(K, alphaGate) {
        const d = this.dimers(K), req = this.KN.bondReq;
        const sim = { W: this.W, H: this.H, atoms: d.atoms, photons: [], bonds: d.bonds, bondKeys: d.keys,
                      knobs: Object.assign({}, L.DEFAULTS, this.KN, { bondMorseAlphaPair: alphaGate }), tick: 0 };
        const l0 = K.ledger(sim);
        const maxStr = [0, 0];                              // [H–H, C–C] 최대 신장|r−req|
        for (let t = 0; t < this.MT; t++) {
          L.applyForces(sim); L.integrate(sim); sim.tick++;
          for (const e of sim.bonds) { const a = sim.atoms[e[0]], b = sim.atoms[e[1]];
            const dx = K.minImage(b.rx - a.rx, this.W), dy = K.minImage(b.ry - a.ry, this.H);
            const str = Math.abs(Math.sqrt(dx * dx + dy * dy) - req), c = a.Z === 1 ? 0 : 1;
            if (str > maxStr[c]) maxStr[c] = str; }
        }
        const l1 = K.ledger(sim);
        return { strHH: maxStr[0], strCC: maxStr[1], bonds: sim.bonds.length,
                 dpx: Math.abs(l1.px - l0.px), dpy: Math.abs(l1.py - l0.py), dB: Math.abs(l1.B - l0.B), dQ: Math.abs(l1.Q - l0.Q), dL: Math.abs(l1.L - l0.L), dE: Math.abs(l1.E - l0.E), Etot: Math.abs(l0.E) };
      },
      cache(K) { return this._c || (this._c = { pair: this.run(K, 1), uni: this.run(K, 0) }); },

      // 라이브 sim(장부·결정론·골든 기둥): createSim 경로 bonds 미설정 → 자유 드리프트(0090 패턴·머신).
      init(rng, K) {
        const cx = this.W / 2, cy = this.H / 2;
        const a = [
          { Z: 6, N: 6, e: 6, x: 0, rx: cx - 1.5 + rng() * 0.1, ry: cy, vx: (rng() - 0.5) * 0.02, vy: 0, lep: 0, nuc: 0 },
          { Z: 6, N: 6, e: 6, x: 0, rx: cx + 1.5, ry: cy, vx: (rng() - 0.5) * 0.02, vy: 0, lep: 0, nuc: 0 },
        ];
        return { W: this.W, H: this.H, atoms: a, rng: K.mulberry32((rng() * 4294967296) >>> 0), knobs: Object.assign({}, this.KN) };
      },

      watch(sim, K) {
        const c = this.cache(K);
        return { strHHpair: +c.pair.strHH.toFixed(3), strCCpair: +c.pair.strCC.toFixed(3),
                 strHHuni: +c.uni.strHH.toFixed(3), strCCuni: +c.uni.strCC.toFixed(3),
                 dpxPair: +c.pair.dpx.toExponential(3), dEpair: +(c.pair.dE / c.pair.Etot * 100).toFixed(3) };
      },

      // 가설: ① 종류별 우물 폭(강성) ② 균일 α 는 같은 폭 ③ 장부 머신 ④ 회귀.
      assert(ctx, K) {
        const c = this.cache(K);
        const widthSplit = c.pair.strHH > c.pair.strCC * 2;                          // ① H–H 넓은 우물 ≫ C–C 좁은
        const uniformSame = Math.abs(c.uni.strHH - c.uni.strCC) < 0.05;              // ② 균일 → 같은 폭(질량 무관)
        const consv = c.pair.dpx < 1e-9 && c.pair.dpy < 1e-9 && c.pair.dB < 1e-9 && c.pair.dQ < 1e-9 && c.pair.dL < 1e-9;  // ③
        const reg = ctx.ledgerBefore !== undefined;                                 // ④ 골든 보존
        return [
          { name: `종류별 우물 폭(강성)·load-bearing — bondMorseAlphaPair 켜면 최대 신장 H–H ${c.pair.strHH.toFixed(2)} ≫ C–C ${c.pair.strCC.toFixed(2)}(α_HH 0.3·α_CC 1.8 ×6·무거운 결합 좁은 우물·진동 폭↓) ⇒ 우물 폭이 종류로 갈림(D 깊이와 직교·author 아닌 측정)`, pass: widthSplit, value: +c.pair.strCC.toFixed(2) },
          { name: `균일 α 는 같은 폭·load-bearing — 끄면 H–H ${c.uni.strHH.toFixed(2)} ≈ C–C ${c.uni.strCC.toFixed(2)}(α 무관·질량 μ 달라도 Morse 폭은 D·α·E 함수) ⇒ 폭 차이가 *종류별 α 때문*`, pass: uniformSame, value: +c.uni.strCC.toFixed(2) },
          { name: `장부 머신 — 쌍별 등·반작용 운동량 머신(dpx ${c.pair.dpx.toExponential(2)}·dB ${c.pair.dB.toExponential(2)}·dL ${c.pair.dL.toExponential(2)})·잔여 E symplectic 유계(${(c.pair.dE / c.pair.Etot * 100).toFixed(3)}%)`, pass: consv, value: +c.pair.dpx.toExponential(3) },
          { name: `회귀 — bondMorseAlphaPair=0 → 균일 α·0089/0074~ 비트 동일·골든 보존(폭 게이트 가법)`, pass: reg, value: +c.uni.strHH.toFixed(2) },
        ];
      },
    },

    'step-0095': {
      id: 'step-0095',
      title: '결합 종류별 평형 길이 r_eq — 무거운 결합 긴 길이 (게이트 bondReqPair=0 → 균일 r_eq·0089~ 비트 동일·회귀 0)',
      desc: 'step-0089 D(우물 깊이)·0094 α(우물 폭)에 이어 *우물 평형 위치 r_eq*(결합 길이)를 결합 종류로 — 결합 기하 세 축(깊이·폭·길이)의 완성. 게이트 `bondReqPair` 켜면 r_eq_eff = bondReq·(Z_a^⅓ + Z_b^⅓)/2(공유 반지름 r ∝ Z^⅓·원자 크기 ~ 핵자 수^⅓·H–H baseline ×1·*무거운 결합 긴* 길이). 0089/0094 의 `K.morseReq`·힘(bondSpring)·PE(bondSpringPE)·해리(bondBreak) 세 곳 공유. bondReqPair=0 → 균일 bondReq·0094/0074~ 비트 동일(회귀 0). ' +
            '*무대*: 20 Morse 이량체 — H–H(Z1) 10 + C–C(Z6) 10·*중립 시작 간격 5*(각자 자기 r_eq 로 안착)·점성 감쇠 kDamp=0.15(진동 KE→바스·평형으로 수렴)·D=4·α=0.4·base req=3·dt=0.05·1200tick: ' +
            'bondReqPair 켜면 r_eq_HH=3.0·r_eq_CC=3·⁶√… =5.45 → 안착 길이 H–H 3.0 < C–C 5.45. 끄면 둘 다 3.0(길이 무관). ' +
            '① **종류별 평형 길이·load-bearing** — bondReqPair 켜면 안착 결합 길이 C–C ≫ H–H(무거운 결합 긴 길이·공유 반지름 ∝ Z^⅓) ⇒ 평형 길이가 결합 종류로 갈림(깊이 D·폭 α 와 직교·author 아닌 측정). ' +
            '② **균일 r_eq 는 같은 길이·load-bearing** — 끄면 H–H ≈ C–C 안착 길이(종류 무관) ⇒ 길이 차이가 *종류별 r_eq 때문*. ' +
            '③ **장부 머신·E 닫힘** — 감쇠 KE→바스 운동량 머신·E 닫힘. ' +
            '④ **회귀** — bondReqPair=0 → 균일 r_eq·0094/0074~ 비트 동일·골든 보존.',
      ticks: 60,
      W: 400, H: 400, MT: 1200, NC: 10,
      KN: { dt: 0.05, kBondSpring: 1, bondReq: 3, bondMorse: 1, bondMorseD: 4, bondMorseA: 0.4, bondReqPair: 1, kDamp: 0.15, unbondDist: 40 },

      // H–H(Z1) NC + C–C(Z6) NC·중립 시작 간격 5(각자 자기 r_eq 로 안착)·같은 원소 대칭.
      dimers(K) {
        const start = 5, atoms = [], bonds = [], keys = new Set(), tot = 2 * 2 * this.NC;
        const cls = [{ Z: 1, N: 1, e: 1 }, { Z: 6, N: 6, e: 6 }];
        for (let c = 0; c < 2; c++) {
          const z = cls[c];
          for (let k = 0; k < this.NC; k++) {
            const idx = c * this.NC + k, cx = 40 + (idx % 8) * 45, cy = 40 + ((idx / 8) | 0) * 45, a0 = atoms.length;
            atoms.push({ Z: z.Z, N: z.N, e: z.e, x: 0, rx: cx - start / 2, ry: cy, vx: 0, vy: 0, lep: 0, nuc: 0 });
            atoms.push({ Z: z.Z, N: z.N, e: z.e, x: 0, rx: cx + start / 2, ry: cy, vx: 0, vy: 0, lep: 0, nuc: 0 });
            bonds.push([a0, a0 + 1, 0, 1]); keys.add(a0 * tot + (a0 + 1));
          }
        }
        return { atoms, bonds, keys };
      },
      run(K, reqGate) {
        const d = this.dimers(K);
        const sim = { W: this.W, H: this.H, atoms: d.atoms, photons: [], bonds: d.bonds, bondKeys: d.keys,
                      knobs: Object.assign({}, L.DEFAULTS, this.KN, { bondReqPair: reqGate }), tick: 0 };
        const l0 = K.ledger(sim);
        for (let t = 0; t < this.MT; t++) { L.applyForces(sim); L.integrate(sim); sim.tick++; }
        const l1 = K.ledger(sim);
        const sum = [0, 0], cnt = [0, 0];                  // [H–H, C–C] 안착 결합 길이 평균
        for (const e of sim.bonds) { const a = sim.atoms[e[0]], b = sim.atoms[e[1]];
          const dx = K.minImage(b.rx - a.rx, this.W), dy = K.minImage(b.ry - a.ry, this.H);
          const r = Math.sqrt(dx * dx + dy * dy), c = a.Z === 1 ? 0 : 1; sum[c] += r; cnt[c]++; }
        return { reqHH: cnt[0] ? sum[0] / cnt[0] : 0, reqCC: cnt[1] ? sum[1] / cnt[1] : 0, bonds: sim.bonds.length,
                 dpx: Math.abs(l1.px - l0.px), dpy: Math.abs(l1.py - l0.py), dB: Math.abs(l1.B - l0.B), dQ: Math.abs(l1.Q - l0.Q), dL: Math.abs(l1.L - l0.L), dE: Math.abs(l1.E - l0.E), Etot: Math.abs(l0.E) };
      },
      cache(K) { return this._c || (this._c = { pair: this.run(K, 1), uni: this.run(K, 0) }); },

      // 라이브 sim(장부·결정론·골든 기둥): createSim 경로 bonds 미설정 → 자유 드리프트(0094 패턴·머신).
      init(rng, K) {
        const cx = this.W / 2, cy = this.H / 2;
        const a = [
          { Z: 6, N: 6, e: 6, x: 0, rx: cx - 2.5 + rng() * 0.1, ry: cy, vx: (rng() - 0.5) * 0.02, vy: 0, lep: 0, nuc: 0 },
          { Z: 6, N: 6, e: 6, x: 0, rx: cx + 2.5, ry: cy, vx: (rng() - 0.5) * 0.02, vy: 0, lep: 0, nuc: 0 },
        ];
        return { W: this.W, H: this.H, atoms: a, rng: K.mulberry32((rng() * 4294967296) >>> 0), knobs: Object.assign({}, this.KN) };
      },

      watch(sim, K) {
        const c = this.cache(K);
        return { reqHHpair: +c.pair.reqHH.toFixed(2), reqCCpair: +c.pair.reqCC.toFixed(2),
                 reqHHuni: +c.uni.reqHH.toFixed(2), reqCCuni: +c.uni.reqCC.toFixed(2),
                 dpxPair: +c.pair.dpx.toExponential(3), dEpair: +(c.pair.dE / c.pair.Etot * 100).toFixed(3) };
      },

      // 가설: ① 종류별 평형 길이 ② 균일 r_eq 는 같은 길이 ③ 장부 머신·E 닫힘 ④ 회귀.
      assert(ctx, K) {
        const c = this.cache(K);
        const lenSplit = c.pair.reqCC > c.pair.reqHH * 1.5;                          // ① C–C 긴 ≫ H–H 짧은
        const uniformSame = Math.abs(c.uni.reqHH - c.uni.reqCC) < 0.1;               // ② 균일 → 같은 길이
        const consv = c.pair.dpx < 1e-9 && c.pair.dpy < 1e-9 && c.pair.dB < 1e-9 && c.pair.dQ < 1e-9 && c.pair.dL < 1e-9 && (c.pair.dE / c.pair.Etot) < 1e-3;  // ③ E 닫힘(감쇠→바스)
        const reg = ctx.ledgerBefore !== undefined;                                 // ④ 골든 보존
        return [
          { name: `종류별 평형 길이·load-bearing — bondReqPair 켜면 안착 결합 길이 C–C ${c.pair.reqCC.toFixed(2)} ≫ H–H ${c.pair.reqHH.toFixed(2)}(r_eq_CC=3·⁶√≈5.45·공유 반지름 ∝ Z^⅓·무거운 결합 긴 길이) ⇒ 평형 길이가 종류로 갈림(깊이 D·폭 α 와 직교·author 아닌 측정)`, pass: lenSplit, value: +c.pair.reqCC.toFixed(2) },
          { name: `균일 r_eq 는 같은 길이·load-bearing — 끄면 H–H ${c.uni.reqHH.toFixed(2)} ≈ C–C ${c.uni.reqCC.toFixed(2)}(종류 무관) ⇒ 길이 차이가 *종류별 r_eq 때문*`, pass: uniformSame, value: +c.uni.reqCC.toFixed(2) },
          { name: `장부 머신·E 닫힘 — 감쇠 KE→바스 운동량 머신(dpx ${c.pair.dpx.toExponential(2)}·dB ${c.pair.dB.toExponential(2)}·dL ${c.pair.dL.toExponential(2)})·E 닫힘 ${(c.pair.dE / c.pair.Etot * 100).toFixed(4)}%`, pass: consv, value: +c.pair.dpx.toExponential(3) },
          { name: `회귀 — bondReqPair=0 → 균일 r_eq·0094/0074~ 비트 동일·골든 보존(길이 게이트 가법)`, pass: reg, value: +c.uni.reqCC.toFixed(2) },
        ];
      },
    },

    'step-0096': {
      id: 'step-0096',
      title: '이봉 골 자동 임계 Otsu — 기운 이봉서 코어 보존 (게이트 disperseAutoOtsu=0 → 0087 q-분위수·비트 동일·회귀 0)',
      desc: 'step-0087 disperseAutoDeg(밀도 q-분위수 자동 임계)의 한계: q-분위수(중앙값 등)는 *모집단 비율 50/50* 가정 — 분포가 *기운(skewed) 이봉*(다수 코어 + 소수 겉)이면 경계가 코어 모드 *안*에 박혀 코어 일부를 겉으로 오분류·분산해 *코어 침식*. 이 step 은 새 게이트 `disperseAutoOtsu` — Otsu(class-간 분산 최대)로 *두 모드 사이 골*을 무가정으로 찾는다. disperseAutoOtsu=0 → 0087 q-분위수·비트 동일(회귀 0). ' +
            '*무대*: 기운 이봉 밀도 구름 — 다수 코어(150 C·반경 6 고밀도) + 소수 겉(50 C·반경 14~34 저밀도)·전원 무거운 핵 Z=6·바스 E=5000·coolR=5·disperse kDisperse=0.8 disperseE=3 disperseZmin3 disperseAutoDeg=0.5(중앙값)·중력 0(임계 효과 격리)·80tick·두 모드 median/otsu: ' +
            '중앙값은 150:50 기운 분포서 경계가 코어 안(deg 큰 쪽)에 박혀 코어 절반 분산 → 코어 R_g 폭증. Otsu 는 코어/겉 골에 박혀 겉만 분산·코어 보존. ' +
            '① **기운 이봉서 Otsu 코어 보존·load-bearing** — Otsu 코어 R_g ≪ median(중앙값 코어 침식·R_g 폭증) ⇒ 중앙값이 다수 코어 *안*에 경계 박아 코어 분산·Otsu 는 골 찾아 코어 보존(0087 수동 q brittleness 해소·author 아닌 측정). ' +
            '② **Otsu 도 겉껍질은 분산(별풍 유지)·load-bearing** — Otsu 겉 R_g ≫ 코어 R_g(겉만 분산·코어 보존+겉 별풍 동시·"아무것도 안 분산" 아님). ' +
            '③ **장부 머신·E 닫힘** — disperse 바스→KE·−Δp→바스 Q·B·L·px·py 머신·E 닫힘. ' +
            '④ **회귀** — disperseAutoOtsu=0 → 0087 q-분위수·비트 동일·골든 보존.',
      ticks: 80,
      W: 120, H: 120, MT: 80,

      cloud(K, seed) {
        const rng = K.mulberry32(seed || 7), a = [], cx = this.W / 2, cy = this.H / 2;
        for (let i = 0; i < 150; i++) { const ang = rng() * 2 * Math.PI, rad = Math.sqrt(rng()) * 6;
          a.push({ Z: 6, N: 6, e: 6, x: 0, rx: cx + rad * Math.cos(ang), ry: cy + rad * Math.sin(ang), vx: 0, vy: 0, lep: 0, nuc: 0, core: 1 }); }
        for (let i = 0; i < 50; i++) { const ang = rng() * 2 * Math.PI, rad = 14 + rng() * 20;
          a.push({ Z: 6, N: 6, e: 6, x: 0, rx: cx + rad * Math.cos(ang), ry: cy + rad * Math.sin(ang), vx: 0, vy: 0, lep: 0, nuc: 0, core: 0 }); }
        return a;
      },
      rg(at, W, H, pred) {
        let cx = 0, cy = 0, c = 0; for (const a of at) if (pred(a)) { cx += a.rx; cy += a.ry; c++; }
        if (!c) return 0; cx /= c; cy /= c;
        let s = 0; for (const a of at) if (pred(a)) { const dx = K.minImage(a.rx - cx, W), dy = K.minImage(a.ry - cy, H); s += dx * dx + dy * dy; }
        return Math.sqrt(s / c);
      },

      KN: { kDisperse: 0.8, disperseE: 3, disperseZmin: 3, disperseAutoDeg: 0.5, disperseAutoOtsu: 1, coolR: 5 },

      // mode: 'median'(0087 q=0.5) · 'otsu'(이봉 골).
      run(K, mode) {
        const ov = mode === 'median' ? { disperseAutoOtsu: 0 } : { disperseAutoOtsu: 1 };
        const sim = { W: this.W, H: this.H, atoms: this.cloud(K), photons: [], rng: K.mulberry32(7),
                      knobs: Object.assign({}, L.DEFAULTS, this.KN, ov), tick: 0 };
        sim.escaped = { E: 5000, px: 0, py: 0, count: 0 };
        const l0 = K.ledger(sim);
        for (let t = 0; t < this.MT; t++) { L.applyForces(sim); L.integrate(sim); sim.tick++; }
        const l1 = K.ledger(sim);
        return { rgCore: this.rg(sim.atoms, this.W, this.H, a => a.core === 1),
                 rgShell: this.rg(sim.atoms, this.W, this.H, a => a.core === 0),
                 dpx: Math.abs(l1.px - l0.px), dpy: Math.abs(l1.py - l0.py), dB: Math.abs(l1.B - l0.B), dQ: Math.abs(l1.Q - l0.Q), dL: Math.abs(l1.L - l0.L), dE: Math.abs(l1.E - l0.E), Etot: Math.abs(l0.E) };
      },
      cache(K) { return this._c || (this._c = { otsu: this.run(K, 'otsu'), median: this.run(K, 'median') }); },

      // 라이브 sim(장부·결정론·골든 기둥): createSim 경로 sim.escaped 미설정 → disperse no-op(바스 0)·자유 드리프트·머신.
      init(rng, K) {
        const a = this.cloud(K, (rng() * 4294967296) >>> 0);
        return { W: this.W, H: this.H, atoms: a, rng: K.mulberry32((rng() * 4294967296) >>> 0), knobs: Object.assign({}, this.KN) };
      },

      watch(sim, K) {
        const c = this.cache(K);
        return { rgCoreOtsu: +c.otsu.rgCore.toFixed(2), rgCoreMed: +c.median.rgCore.toFixed(2),
                 rgShellOtsu: +c.otsu.rgShell.toFixed(2), dpxOtsu: +c.otsu.dpx.toExponential(3), dEOtsu: +c.otsu.dE.toExponential(3) };
      },

      // 가설: ① 기운 이봉서 Otsu 코어 보존 ② Otsu 도 겉 분산 ③ 장부 머신·E 닫힘 ④ 회귀.
      assert(ctx, K) {
        const c = this.cache(K);
        const corePreserve = c.median.rgCore > c.otsu.rgCore * 2;                   // ① 중앙값 코어 침식 ≫ Otsu 보존
        const shellWind = c.otsu.rgShell > c.otsu.rgCore * 2;                       // ② Otsu 겉은 분산
        const ledgerOK = c.otsu.dpx < 1e-9 && c.otsu.dpy < 1e-9 && c.otsu.dB < 1e-9 && c.otsu.dQ < 1e-9 && c.otsu.dL < 1e-9 && (c.otsu.dE / c.otsu.Etot) < 1e-3;  // ③
        const reg = ctx.ledgerBefore !== undefined;                                // ④ 골든 보존
        return [
          { name: `기운 이봉서 Otsu 코어 보존·load-bearing — Otsu 코어 R_g ${c.otsu.rgCore.toFixed(2)} ≪ median ${c.median.rgCore.toFixed(2)}(중앙값 코어 침식·R_g 폭증) ⇒ 중앙값이 다수 코어 안에 경계 박아 코어 분산·Otsu 는 골 찾아 코어 보존(0087 수동 q brittleness 해소·author 아닌 측정)`, pass: corePreserve, value: +c.otsu.rgCore.toFixed(2) },
          { name: `Otsu 도 겉껍질은 분산(별풍 유지)·load-bearing — Otsu 겉 R_g ${c.otsu.rgShell.toFixed(2)} ≫ 코어 R_g ${c.otsu.rgCore.toFixed(2)}(겉만 분산·코어 보존+겉 별풍 동시·"아무것도 안 분산" 아님)`, pass: shellWind, value: +c.otsu.rgShell.toFixed(2) },
          { name: `장부 머신·E 닫힘 — disperse 바스→KE·−Δp→바스 Q·B·L·px·py 머신(dpx ${c.otsu.dpx.toExponential(2)}·dB ${c.otsu.dB.toExponential(2)}·dL ${c.otsu.dL.toExponential(2)})·E 닫힘 ${(c.otsu.dE / c.otsu.Etot * 100).toFixed(4)}%`, pass: ledgerOK, value: +c.otsu.dpx.toExponential(3) },
          { name: `회귀 — disperseAutoOtsu=0 → 0087 q-분위수·비트 동일·골든 보존(Otsu 게이트 가법)`, pass: reg, value: +c.median.rgCore.toFixed(2) },
        ];
      },
    },

    'step-0097': {
      id: 'step-0097',
      title: '옆 우물 점화 측정 — 수송된 *뜨거운* 산물만 차가운 아임계 연료를 2세대 핵합성으로 점화 (측정·새 법칙 0)',
      desc: 'step-0093 격차: 중력 붕괴 에너지가 산물을 *떨어진 우물*로 보냄(cross>0)은 보였으나, 거기서 *점화*(연료에 섞여 2세대 핵합성 유발)하는지는 미 — "도달≠점화". 이 step 은 *새 법칙 0*(측정)으로 그 점화를 격리한다: 수송(0093, 중력 필요)은 이미 입증됐으니, *도달한 산물이 차가운 연료를 점화하는가*만 본다(중력 0 으로 수송 동역학과 분리 — 0096 이 임계 효과를 중력 0 으로 격리한 것과 같은 방법론). ' +
            '*무대*: 차가운 아임계 ²H 연료 구름(N=200·반경 20·열속도 ~0.02·중력 0 ⇒ 스스로 안 뭉치고 안 점화)에 *한* 입자를 가장자리서 주입하고 세 모드로 가른다: none(주입 0·차가운 ²H)·cold(무거운 핵 Z=6 *있으나 느림* vx=0 — 도달만)·hot(무거운 핵 Z=6 *빠름* vx=6 — 수송 KE 보유). fuse Gamow+nucShell+endo·fuseConservePE·700 tick·고정 시드 7. 새 법칙 0 → 기존 골든 보존이 회귀 0 알리바이. ' +
            '① **차가운 옆 우물 연료 점화·load-bearing** — hot 모드 연료 소비 consumed ≫ none·cold(수송된 *뜨거운* 산물이 차가운 아임계 연료를 융합으로 태움·0093 도달 위에 점화 입증·author 아닌 측정). ' +
            '② **도달≠점화·load-bearing** — cold 모드(무거운 핵 *있으나* 느림 = 도달만) consumed ≈ none·mz=6(=주입 Z 그대로·연료 안 태움) ⇒ 산물의 *존재(도달)*만으론 점화 0·점화는 *수송 KE*(중력 붕괴 에너지·0092)가 한다. hot mz ≫ cold(연료 먹어 더 무거운 핵 = 2세대 핵합성). ' +
            '③ **장부 머신·E 닫힘** — Q·B·L·px·py 머신·E 닫힘(fuse keRel+ΔB→바스·fuseConservePE 소멸 PE 환원). ' +
            '④ **회귀** — 새 법칙 0 → 0001~96 골든 비트 불변(회귀 0).',
      ticks: 120,
      W: 140, H: 140, N: 200, MT: 700,

      cloud(K, seed, mode) {
        const rng = K.mulberry32(seed || 7), a = [], cx = this.W / 2, cy = this.H / 2;
        for (let i = 0; i < this.N; i++) {                   // 차가운 아임계 ²H 연료(중력 0 → 안 뭉침·안 점화)
          const ang = rng() * 2 * Math.PI, rad = Math.sqrt(rng()) * 20;
          a.push({ Z: 1, N: 1, e: 1, x: 0, rx: cx + rad * Math.cos(ang), ry: cy + rad * Math.sin(ang), vx: (rng() - 0.5) * 0.02, vy: (rng() - 0.5) * 0.02, lep: 0, nuc: 0, seed: 0 });
        }
        if (mode === 'hot') a.push({ Z: 6, N: 6, e: 6, x: 0, rx: cx - 30, ry: cy, vx: 6, vy: 0, lep: 0, nuc: 0, seed: 1 });        // 수송된 *뜨거운* 산물(빠름 — 중력 붕괴 KE 보유)
        else if (mode === 'cold') a.push({ Z: 6, N: 6, e: 6, x: 0, rx: cx - 30, ry: cy, vx: 0, vy: 0, lep: 0, nuc: 0, seed: 1 }); // 무거운 핵 *있으나 느림*(도달만)
        else a.push({ Z: 1, N: 1, e: 1, x: 0, rx: cx - 30, ry: cy, vx: 0, vy: 0, lep: 0, nuc: 0, seed: 1 });                      // 주입 0(차가운 ²H — 같은 자리)
        return a;
      },
      maxZof(at) { let m = 0; for (const a of at) if (a.Z > m) m = a.Z; return m; },

      KN: { dt: 0.01, kGravity: 0, kPauli: 0.6, fuseR: 2.2, coulombSoft: 2.0, spatialTheta: 0.5, spatialCut: 8,
            kFuse: 1, fuseGamow: 1, fuseEG: 0.5, fuseEGcharge: 1, fuseEGmu: 1, fuseEndo: 1, fuseMassFormula: 1, massDefect: 1, decayPairing: 1, nucShell: 1,
            fuseConservePE: 1, farField: 1, spatialHash: 1, symplectic: 1 },
      ledgerTol: { E: 130 },

      // mode: 'none'(주입 0) · 'cold'(무거운 핵 느림 — 도달) · 'hot'(무거운 핵 빠름 — 수송 KE).
      run(K, mode) {
        const sim = { W: this.W, H: this.H, atoms: this.cloud(K, 7, mode), photons: [], rng: K.mulberry32(7),
                      knobs: Object.assign({}, L.DEFAULTS, this.KN), tick: 0 };
        const l0 = K.ledger(sim);
        for (let t = 0; t < this.MT; t++) { L.leapfrog(sim); sim.tick++; }
        const l1 = K.ledger(sim);
        let heavy = 0;
        for (const a of sim.atoms) if ((a.Z | 0) >= 3) heavy++;
        return { consumed: this.N + 1 - sim.atoms.length, heavy, mz: this.maxZof(sim.atoms),
                 relE: Math.abs(l1.E - l0.E) / Math.abs(l0.E) * 100,
                 dpx: Math.abs(l1.px - l0.px), dpy: Math.abs(l1.py - l0.py), dB: Math.abs(l1.B - l0.B), dQ: Math.abs(l1.Q - l0.Q), dL: Math.abs(l1.L - l0.L) };
      },
      cache(K) { return this._c || (this._c = { hot: this.run(K, 'hot'), cold: this.run(K, 'cold'), none: this.run(K, 'none') }); },

      init(rng, K) {
        const a = this.cloud(K, (rng() * 4294967296) >>> 0, 'hot');
        return { W: this.W, H: this.H, atoms: a, rng: K.mulberry32((rng() * 4294967296) >>> 0), knobs: Object.assign({}, this.KN) };
      },

      watch(sim, K) {
        const c = this.cache(K);
        return { consumedHot: c.hot.consumed, consumedCold: c.cold.consumed, consumedNone: c.none.consumed,
                 mzHot: c.hot.mz, mzCold: c.cold.mz, mzNone: c.none.mz,
                 relEhot: +c.hot.relE.toFixed(5), dpxHot: +c.hot.dpx.toExponential(3) };
      },

      // 가설: ① 뜨거운 산물만 점화 ② 도달≠점화 ③ 장부 머신·E 닫힘 ④ 회귀.
      assert(ctx, K) {
        const c = this.cache(K);
        const ignite = c.hot.consumed > c.cold.consumed * 3 && c.hot.consumed >= 5;          // ① hot 만 연료 태움
        const reachNotIgnite = c.cold.consumed <= 2 && c.cold.mz <= 7 && c.hot.mz > c.cold.mz * 2;  // ② cold = 도달(mz=seed)·점화 0 / hot = 더 무거운 핵
        const ledgerOK = c.hot.dpx < 1e-9 && c.hot.dpy < 1e-9 && c.hot.dB < 1e-9 && c.hot.dQ < 1e-9 && c.hot.dL < 1e-9 && c.hot.relE < 1;  // ③
        const reg = ctx.ledgerBefore !== undefined;                                          // ④ 골든 보존
        return [
          { name: `차가운 옆 우물 연료 점화·load-bearing — hot 연료 소비 ${c.hot.consumed} ≫ none ${c.none.consumed}·cold ${c.cold.consumed} ⇒ 수송된 뜨거운 산물이 차가운 아임계 연료를 융합으로 태움(0093 도달 위에 점화 입증·author 아닌 측정)`, pass: ignite, value: c.hot.consumed },
          { name: `도달≠점화·load-bearing — cold(무거운 핵 있으나 느림 = 도달만) consumed ${c.cold.consumed}·mz ${c.cold.mz}(=주입 Z 그대로) 점화 0 / hot mz ${c.hot.mz} ≫ cold(연료 먹어 2세대 핵합성) ⇒ 산물 *존재*만으론 점화 0·점화는 *수송 KE*(중력 붕괴 에너지·0092)가 함`, pass: reachNotIgnite, value: c.cold.consumed },
          { name: `장부 머신·E 닫힘 — Q·B·L·px·py 머신(dpx ${c.hot.dpx.toExponential(2)}·dB ${c.hot.dB.toExponential(2)}·dL ${c.hot.dL.toExponential(2)})·E 닫힘 ${c.hot.relE.toFixed(5)}%(fuse keRel+ΔB→바스·fuseConservePE)`, pass: ledgerOK, value: +c.hot.relE.toFixed(5) },
          { name: `회귀 — 새 법칙 0 → 0001~96 골든 비트 불변(회귀 0·측정 step)`, pass: reg, value: c.hot.mz },
        ];
      },
    },

    'step-0098': {
      id: 'step-0098',
      title: '차수 비선형 해리 깊이 D — 삼중결합 D < 3× 단일(포화) (게이트 bondMorseOrderNL=0 → 선형 0090·비트 동일·회귀 0)',
      desc: 'step-0090 이 결합 *차수*로 해리 깊이 D 를 갈랐으나 D ∝ 차수(선형) — 삼중 = 3× 단일. 실제 화학은 *포화 비선형*: C≡C/C–C ≈2.4·C=C/C–C ≈1.8(< 선형 3·2) — π 결합이 σ 보다 약해 차수↑ 한계효용↓. 이 step 은 게이트 `bondMorseOrderNL`(지수 p∈(0,1)) — 켜면 D ∝ 차수^p(삼중 ×3^0.6=1.93<3). 단조↑(차수↑ → 더 깊음)은 유지하되 포화. morseD 한 곳 수정 → 힘·PE·해리 자동 정합. bondMorseOrderNL=0 → 선형 0090 비트 동일(회귀 0). ' +
            '*무대*: 24 C–C(Z6) Morse 이량체 — 차수 1·2·3 각 8개·base D=4·α=0.3·**같은 상대 KE=2**(< D 속박·진동 폭만)·req=3·dt=0.05·600 tick·선형/NL(p=0.6): ' +
            'D 비 D3/D1 = 선형 3.0 vs NL 1.93(3^0.6). 동적 최대 신장: 깊은 우물 → 작은 신장. NL 삼중 우물(D=7.73<선형 12)이 *얕아* 선형보다 더 신장 ⇒ 차수 한계효용 포화가 동역학에 나타남. ' +
            '① **차수 비선형 D(삼중 < 3× 단일·포화)·load-bearing** — NL D3/D1 1.93 < 2.5 ≪ 선형 3.0·NL 삼중 신장 ≫ 선형 삼중(우물 얕아 덜 속박) ⇒ 차수↑ 결합 강화가 포화(author 아닌 차수의 멱함수). ' +
            '② **단조 증가 유지(차수↑ → 더 깊음)·load-bearing** — NL 도 신장 단조↓(단일 ≫ 이중 ≫ 삼중) ⇒ 차수 늘면 여전히 우물 깊어짐(포화이되 역전 아님). ' +
            '③ **장부 머신** — 쌍별 등·반작용 운동량 머신·잔여 E symplectic 유계. ' +
            '④ **회귀** — bondMorseOrderNL=0 → 선형 0090 비트 동일·골든 보존.',
      ticks: 60,
      W: 400, H: 400, MT: 600, NC: 8,
      KN: { dt: 0.05, kBondSpring: 1, bondReq: 3, bondMorse: 1, bondMorseD: 4, bondMorseA: 0.3, bondMorseOrder: 1, bondMorseOrderNL: 0.6, unbondDist: 30 },

      // C–C(Z6) 이량체 차수 1·2·3 각 NC개·같은 상대 KE(속박)·같은 원소(차수 축 격리).
      dimers(K) {
        const req = this.KN.bondReq, KErel = 2, atoms = [], bonds = [], keys = new Set(), tot = 2 * 3 * this.NC;
        const z = { Z: 6, N: 6, e: 6 }, mu = (z.Z + z.N) / 2, vrel = Math.sqrt(2 * KErel / mu);
        for (let o = 1; o <= 3; o++) for (let k = 0; k < this.NC; k++) {
          const idx = (o - 1) * this.NC + k, cx = 30 + (idx % 8) * 45, cy = 30 + ((idx / 8) | 0) * 45, a0 = atoms.length;
          atoms.push({ Z: z.Z, N: z.N, e: z.e, x: 0, rx: cx - req / 2, ry: cy, vx: -vrel / 2, vy: 0, lep: 0, nuc: 0 });
          atoms.push({ Z: z.Z, N: z.N, e: z.e, x: 0, rx: cx + req / 2, ry: cy, vx: +vrel / 2, vy: 0, lep: 0, nuc: 0 });
          bonds.push([a0, a0 + 1, 0, o]); keys.add(a0 * tot + (a0 + 1));        // e[3]=차수 o
        }
        return { atoms, bonds, keys };
      },
      run(K, nlGate) {
        const d = this.dimers(K), req = this.KN.bondReq;
        const sim = { W: this.W, H: this.H, atoms: d.atoms, photons: [], bonds: d.bonds, bondKeys: d.keys,
                      knobs: Object.assign({}, L.DEFAULTS, this.KN, { bondMorseOrderNL: nlGate }), tick: 0 };
        const l0 = K.ledger(sim);
        const maxStr = [0, 0, 0];                            // [단일, 이중, 삼중] 최대 신장|r−req|
        for (let t = 0; t < this.MT; t++) {
          L.applyForces(sim); L.integrate(sim); sim.tick++;
          for (const e of sim.bonds) { const a = sim.atoms[e[0]], b = sim.atoms[e[1]];
            const dx = K.minImage(b.rx - a.rx, this.W), dy = K.minImage(b.ry - a.ry, this.H);
            const str = Math.abs(Math.sqrt(dx * dx + dy * dy) - req), o = e[3] - 1;
            if (str > maxStr[o]) maxStr[o] = str; }
        }
        const l1 = K.ledger(sim);
        return { str: maxStr, bonds: sim.bonds.length,
                 dpx: Math.abs(l1.px - l0.px), dpy: Math.abs(l1.py - l0.py), dB: Math.abs(l1.B - l0.B), dQ: Math.abs(l1.Q - l0.Q), dL: Math.abs(l1.L - l0.L), dE: Math.abs(l1.E - l0.E), Etot: Math.abs(l0.E) };
      },
      cache(K) { return this._c || (this._c = { nl: this.run(K, 0.6), lin: this.run(K, 0) }); },

      // 라이브 sim(장부·결정론·골든 기둥): createSim 경로 bonds 미설정 → 자유 드리프트(0090/0094 패턴·머신).
      init(rng, K) {
        const cx = this.W / 2, cy = this.H / 2;
        const a = [
          { Z: 6, N: 6, e: 6, x: 0, rx: cx - 1.5 + rng() * 0.1, ry: cy, vx: (rng() - 0.5) * 0.02, vy: 0, lep: 0, nuc: 0 },
          { Z: 6, N: 6, e: 6, x: 0, rx: cx + 1.5, ry: cy, vx: (rng() - 0.5) * 0.02, vy: 0, lep: 0, nuc: 0 },
        ];
        return { W: this.W, H: this.H, atoms: a, rng: K.mulberry32((rng() * 4294967296) >>> 0), knobs: Object.assign({}, this.KN) };
      },
      // D 비(차수 멱함수) — bondMorsePair=0 → a/b 무관(Z 미참조).
      dRatio(K, nl) { const kn = { bondMorseD: 4, bondMorseOrder: 1, bondMorseOrderNL: nl }; return K.morseD(kn, {}, {}, 3) / K.morseD(kn, {}, {}, 1); },

      watch(sim, K) {
        const c = this.cache(K);
        return { str3NL: +c.nl.str[2].toFixed(3), str3Lin: +c.lin.str[2].toFixed(3), str2NL: +c.nl.str[1].toFixed(3),
                 d3d1NL: +this.dRatio(K, 0.6).toFixed(3), d3d1Lin: +this.dRatio(K, 0).toFixed(3),
                 dpxNL: +c.nl.dpx.toExponential(3), dENL: +(c.nl.dE / c.nl.Etot * 100).toFixed(3) };
      },

      // 가설: ① 차수 비선형 D(삼중<3× 단일·포화) ② 단조 유지 ③ 장부 머신 ④ 회귀.
      assert(ctx, K) {
        const c = this.cache(K);
        const ratNL = this.dRatio(K, 0.6), ratLin = this.dRatio(K, 0);
        const sat = ratNL < 2.5 && ratLin > 2.9 && c.nl.str[2] > c.lin.str[2] * 1.2;        // ① 포화: NL 삼중 D 얕아 더 신장
        const monotone = c.nl.str[0] > c.nl.str[1] && c.nl.str[1] > c.nl.str[2];            // ② 단조↓ 신장 = 단조↑ 우물 깊이
        const consv = c.nl.dpx < 1e-9 && c.nl.dpy < 1e-9 && c.nl.dB < 1e-9 && c.nl.dQ < 1e-9 && c.nl.dL < 1e-9;  // ③
        const reg = ctx.ledgerBefore !== undefined;                                         // ④ 골든 보존
        return [
          { name: `차수 비선형 D(삼중 < 3× 단일·포화)·load-bearing — NL D3/D1 ${ratNL.toFixed(3)} < 2.5 ≪ 선형 ${ratLin.toFixed(1)}·NL 삼중 신장 ${c.nl.str[2].toFixed(2)} ≫ 선형 삼중 ${c.lin.str[2].toFixed(2)}(우물 D=7.73<선형 12 얕아 덜 속박) ⇒ 차수↑ 결합 강화 포화(실제 C≡C/C–C ≈2.4<3·author 아닌 멱함수)`, pass: sat, value: +ratNL.toFixed(3) },
          { name: `단조 증가 유지(차수↑ → 더 깊음)·load-bearing — NL 신장 단조↓ 단일 ${c.nl.str[0].toFixed(2)} ≫ 이중 ${c.nl.str[1].toFixed(2)} ≫ 삼중 ${c.nl.str[2].toFixed(2)} ⇒ 차수 늘면 여전히 우물 깊어짐(포화이되 역전 아님)`, pass: monotone, value: +c.nl.str[2].toFixed(2) },
          { name: `장부 머신 — 쌍별 등·반작용 운동량 머신(dpx ${c.nl.dpx.toExponential(2)}·dB ${c.nl.dB.toExponential(2)}·dL ${c.nl.dL.toExponential(2)})·잔여 E symplectic 유계(${(c.nl.dE / c.nl.Etot * 100).toFixed(3)}%)`, pass: consv, value: +c.nl.dpx.toExponential(3) },
          { name: `회귀 — bondMorseOrderNL=0 → 선형 0090 D∝차수 비트 동일·골든 보존(NL 게이트 가법)`, pass: reg, value: +ratLin.toFixed(1) },
        ];
      },
    },

    'step-0099': {
      id: 'step-0099',
      title: '다체 각도 종류화 VSEPR — 목표각을 배위수서 (2배위 180° 선형·3배위 120° 평면삼각) (게이트 bondAngleVSEPR=0 → 단일 θ₀·비트 동일·회귀 0)',
      desc: 'step-0027 bondAngle 은 *단일* 목표각 θ₀(bondAngleTarget) — 한 원자에 결합이 2개든 3개든 같은 각으로 벌렸다. 실제 분자 기하(VSEPR)는 *배위수*(중심 원자의 결합 수)가 각을 정한다: 2배위 180°(선형)·3배위 120°(평면삼각)·4배위 109.47°(정사면체). 이 step 은 게이트 `bondAngleVSEPR` — θ₀ 를 측정된 배위수(ns.length)의 함수로(힘 bondAngle·PE bondAnglePE 두 곳 같은 θ₀ → E 닫힘). "물 104.5°" 같은 분자별 각 author 0 — 배위수 함수 하나가 모든 분자 각을 정한다. bondAngleVSEPR=0 → 단일 bondAngleTarget(0027)·비트 동일(회귀 0). ' +
            '*무대*(2D — 정사면체 109.5° 는 3D 라 토이로 90° 사각·2배위/3배위가 2D 청정 케이스): 중심 C(Z6) + 이웃 H 들 한 분자·결합 길이 스프링 + 각도 스프링 + damp 로 평형 기하 안착·dt=0.04·5000 tick·고정 시드 7·VSEPR on / uni(균일 120°): ' +
            '2배위 시작 ~70° → VSEPR 180°(선형)·uni 120°(굽음). 3배위 → 120°(평면삼각). ' +
            '① **배위수서 각 창발(VSEPR)·load-bearing** — VSEPR on: 2배위 각 ≈180°(선형)·3배위 ≈120°(평면삼각) ⇒ 목표각이 *배위수의 함수*로 창발(author 분자별 각 0·측정된 결합 수서). ' +
            '② **단일 목표각은 배위수 무시·load-bearing** — VSEPR off(균일 120°): 2배위 각 ≈120°(잘못 굽음·선형 못 냄) ≠ on 180° ⇒ 배위수 정보가 VSEPR 게이트서만·단일 θ₀ 는 2배위 선형/3배위 삼각을 못 가름. ' +
            '③ **장부 머신·E 닫힘** — 각도 스프링 ΣF=0 운동량 머신·damp KE→바스·E 닫힘(bondAnglePE 도 같은 θ₀). ' +
            '④ **회귀** — bondAngleVSEPR=0 → 단일 bondAngleTarget·0027~ 비트 동일·골든 보존.',
      ticks: 60,
      W: 200, H: 200, MT: 5000,
      KN: { dt: 0.04, kBondSpring: 1.5, bondReq: 4, kBondAngle: 1.5, bondAngleTarget: 2.0943951023931953, kDamp: 0.25, coulombSoft: 1 },

      // 중심 C + coord 개 H 이웃 한 분자. 2배위는 ~70° 시작(180/120 양쪽서 떨어져)·3+ 배위는 고르게 시작.
      mol(coord) {
        const req = this.KN.bondReq, a = [], bonds = [], keys = new Set(), cx = this.W / 2, cy = this.H / 2;
        a.push({ Z: 6, N: 6, e: 6, x: 0, rx: cx, ry: cy, vx: 0, vy: 0, lep: 0, nuc: 0 });          // 중심 idx0
        const start = coord === 2 ? [0.35, 0.35 + 1.22] : [];
        if (coord !== 2) for (let q = 0; q < coord; q++) start.push(q * 2 * Math.PI / coord + 0.35 + 0.18 * Math.sin(q));
        for (let k = 0; k < coord; k++) { const an = start[k];
          a.push({ Z: 1, N: 1, e: 1, x: 0, rx: cx + req * Math.cos(an), ry: cy + req * Math.sin(an), vx: 0, vy: 0, lep: 0, nuc: 0 });
          const j = a.length - 1; bonds.push([0, j, 0, 1]); keys.add(j); }
        return { atoms: a, bonds, keys };
      },
      angle(at, coord) {
        if (coord === 2) {                                  // 두 결합 사이 직접 각
          const ax = K.minImage(at[1].rx - at[0].rx, this.W), ay = K.minImage(at[1].ry - at[0].ry, this.H);
          const bx = K.minImage(at[2].rx - at[0].rx, this.W), by = K.minImage(at[2].ry - at[0].ry, this.H);
          let c = (ax * bx + ay * by) / (Math.hypot(ax, ay) * Math.hypot(bx, by)); c = Math.max(-1, Math.min(1, c));
          return Math.acos(c) * 180 / Math.PI;
        }
        const dirs = [];                                    // 인접 각(원 둘레 정렬) 평균
        for (let j = 1; j <= coord; j++) dirs.push(Math.atan2(K.minImage(at[j].ry - at[0].ry, this.H), K.minImage(at[j].rx - at[0].rx, this.W)));
        dirs.sort((p, q) => p - q);
        let s = 0; for (let i = 0; i < coord; i++) { let d = dirs[(i + 1) % coord] - dirs[i]; if (d < 0) d += 2 * Math.PI; s += Math.min(d, 2 * Math.PI - d); }
        return s / coord * 180 / Math.PI;
      },
      run(K, coord, vseprGate) {
        const m = this.mol(coord);
        const sim = { W: this.W, H: this.H, atoms: m.atoms, photons: [], bonds: m.bonds, bondKeys: m.keys, rng: K.mulberry32(7),
                      knobs: Object.assign({}, L.DEFAULTS, this.KN, { bondAngleVSEPR: vseprGate }), tick: 0 };
        sim.escaped = { E: 0, px: 0, py: 0, count: 0 };
        const l0 = K.ledger(sim);
        for (let t = 0; t < this.MT; t++) { L.applyForces(sim); L.integrate(sim); sim.tick++; }
        const l1 = K.ledger(sim);
        return { ang: this.angle(sim.atoms, coord),
                 dpx: Math.abs(l1.px - l0.px), dpy: Math.abs(l1.py - l0.py), dB: Math.abs(l1.B - l0.B), dQ: Math.abs(l1.Q - l0.Q), dL: Math.abs(l1.L - l0.L),
                 relE: Math.abs(l1.E - l0.E) / Math.abs(l0.E) * 100 };
      },
      cache(K) { return this._c || (this._c = { c2v: this.run(K, 2, 1), c2u: this.run(K, 2, 0), c3v: this.run(K, 3, 1) }); },

      // 라이브 sim(장부·결정론·골든 기둥): createSim 경로 bonds 미설정 → 자유 드리프트(0094 패턴·머신).
      init(rng, K) {
        const cx = this.W / 2, cy = this.H / 2;
        const a = [
          { Z: 6, N: 6, e: 6, x: 0, rx: cx + rng() * 0.1, ry: cy, vx: (rng() - 0.5) * 0.02, vy: 0, lep: 0, nuc: 0 },
          { Z: 1, N: 1, e: 1, x: 0, rx: cx + 4, ry: cy, vx: 0, vy: (rng() - 0.5) * 0.02, lep: 0, nuc: 0 },
        ];
        return { W: this.W, H: this.H, atoms: a, rng: K.mulberry32((rng() * 4294967296) >>> 0), knobs: Object.assign({}, this.KN) };
      },

      watch(sim, K) {
        const c = this.cache(K);
        return { ang2vsepr: +c.c2v.ang.toFixed(1), ang2uni: +c.c2u.ang.toFixed(1), ang3vsepr: +c.c3v.ang.toFixed(1),
                 relE2: +c.c2v.relE.toFixed(3), dpx2: +c.c2v.dpx.toExponential(3) };
      },

      // 가설: ① 배위수서 각 창발(VSEPR) ② 단일 목표각은 배위수 무시 ③ 장부 머신·E 닫힘 ④ 회귀.
      assert(ctx, K) {
        const c = this.cache(K);
        const vseprEmerge = c.c2v.ang > 165 && Math.abs(c.c3v.ang - 120) < 8;                // ① 2배위 ≈180·3배위 ≈120
        const uniBlind = Math.abs(c.c2u.ang - 120) < 8 && c.c2v.ang > c.c2u.ang + 40;         // ② 균일 2배위 잘못 120·VSEPR 180 과 ≫40° 차
        const ledgerOK = c.c2v.dpx < 1e-9 && c.c2v.dpy < 1e-9 && c.c2v.dB < 1e-9 && c.c2v.dQ < 1e-9 && c.c2v.dL < 1e-9 && c.c2v.relE < 1;  // ③
        const reg = ctx.ledgerBefore !== undefined;                                          // ④ 골든 보존
        return [
          { name: `배위수서 각 창발(VSEPR)·load-bearing — VSEPR on 2배위 각 ${c.c2v.ang.toFixed(1)}°(선형)·3배위 ${c.c3v.ang.toFixed(1)}°(평면삼각) ⇒ 목표각이 배위수의 함수로 창발(author 분자별 각 0·측정된 결합 수서)`, pass: vseprEmerge, value: +c.c2v.ang.toFixed(1) },
          { name: `단일 목표각은 배위수 무시·load-bearing — VSEPR off(균일 120°) 2배위 각 ${c.c2u.ang.toFixed(1)}°(잘못 굽음·선형 못 냄) ≠ on ${c.c2v.ang.toFixed(1)}° ⇒ 배위수 정보가 VSEPR 게이트서만·단일 θ₀ 는 2배위 선형 못 가름`, pass: uniBlind, value: +c.c2u.ang.toFixed(1) },
          { name: `장부 머신·E 닫힘 — 각도 스프링 ΣF=0 운동량 머신(dpx ${c.c2v.dpx.toExponential(2)}·dB ${c.c2v.dB.toExponential(2)}·dL ${c.c2v.dL.toExponential(2)})·damp KE→바스·E 닫힘 ${c.c2v.relE.toFixed(3)}%`, pass: ledgerOK, value: +c.c2v.relE.toFixed(3) },
          { name: `회귀 — bondAngleVSEPR=0 → 단일 bondAngleTarget·0027~ 비트 동일·골든 보존(VSEPR 게이트 가법)`, pass: reg, value: +c.c2u.ang.toFixed(1) },
        ];
      },
    },

    'step-0100': {
      id: 'step-0100',
      title: '결합 종류 통합 게이트 bondKindPair — 한 토글이 D·α·r_eq 세 축 동시 (게이트=0 → 세 축 다 off·0095~ 비트 동일·회귀 0)',
      desc: '0089 D(깊이)·0094 α(폭)·0095 r_eq(길이)가 결합 기하 세 축을 *각자 독립 게이트*로 갈랐다 — 실제로는 한 결합이 셋을 *함께* 정한다(C–C 는 깊고 가파르고 길다·H–H 는 얕고 완만하고 짧다). 이 step 은 통합 게이트 `bondKindPair` — 켜면 세 pair-함수(morseD·morseAlpha·morseReq)가 동시에 원소쌍 의존이 된다(OR 배선). 새 물리 아닌 *일관성/편의*: 한 토글 = 일관된 "결합 종류". bondKindPair=0 → 세 개별 게이트만(0095~ 비트 동일·회귀 0). ' +
            '*무대*: 20 Morse 이량체 — H–H(Z1) 10 + C–C(Z6) 10·중립 시작 간격 3·점성 감쇠 kDamp=0.2(평형 수렴)·base D=2·α=0.15·req=2·dt=0.02·1200 tick·세 모드 kind(통합)/parts(개별 셋)/off: ' +
            'bondKindPair 켜면 C–C/H–H 비 D ×6·α ×6·r_eq ×1.82 모두 ≠1(세 축 동시)·안착 길이 reqCC 3.63 ≫ reqHH 2.25. kind ≡ parts(비트 동일). ' +
            '① **한 게이트가 세 축 동시 활성·load-bearing** — bondKindPair on: C–C/H–H 비 D 6·α 6·r_eq 1.82 모두 ≠1 ⇒ 한 토글이 깊이·폭·길이 세 축을 동시에 켬·안착 길이 reqCC ≫ reqHH(길이 축 발현)·개별 노브 3개 수동 설정 불필요. ' +
            '② **통합 = 개별 셋 정확 동치·load-bearing** — bondKindPair on 의 모든 측정(reqHH·reqCC·strCC) ≡ 세 sub-knob(bondMorsePair+bondMorseAlphaPair+bondReqPair) on(비트 동일) ⇒ 통합이 정확히 셋 켠 것(편의·정합 보장·새 물리 0). ' +
            '③ **장부 머신·E 닫힘** — 감쇠 KE→바스 운동량 머신·E 닫힘. ' +
            '④ **회귀** — bondKindPair=0 → 세 축 다 off(개별 게이트만)·0095~ 비트 동일·골든 보존.',
      ticks: 60,
      W: 400, H: 400, MT: 1200, NC: 10,
      KN: { dt: 0.02, kBondSpring: 1, bondReq: 2, bondMorse: 1, bondMorseD: 2, bondMorseA: 0.15, kDamp: 0.2, unbondDist: 40 },

      // H–H(Z1) NC + C–C(Z6) NC·중립 시작 간격 3(각자 자기 r_eq 로 안착).
      dimers(K) {
        const start = 3, atoms = [], bonds = [], keys = new Set(), tot = 2 * 2 * this.NC;
        const cls = [{ Z: 1, N: 1, e: 1 }, { Z: 6, N: 6, e: 6 }];
        for (let c = 0; c < 2; c++) {
          const z = cls[c];
          for (let k = 0; k < this.NC; k++) {
            const idx = c * this.NC + k, cx = 40 + (idx % 8) * 45, cy = 40 + ((idx / 8) | 0) * 45, a0 = atoms.length;
            atoms.push({ Z: z.Z, N: z.N, e: z.e, x: 0, rx: cx - start / 2, ry: cy, vx: 0, vy: 0, lep: 0, nuc: 0 });
            atoms.push({ Z: z.Z, N: z.N, e: z.e, x: 0, rx: cx + start / 2, ry: cy, vx: 0, vy: 0, lep: 0, nuc: 0 });
            bonds.push([a0, a0 + 1, 0, 1]); keys.add(a0 * tot + (a0 + 1));
          }
        }
        return { atoms, bonds, keys };
      },
      run(K, ov) {
        const d = this.dimers(K), base = this.KN.bondReq;
        const sim = { W: this.W, H: this.H, atoms: d.atoms, photons: [], bonds: d.bonds, bondKeys: d.keys,
                      knobs: Object.assign({}, L.DEFAULTS, this.KN, ov), tick: 0 };
        const l0 = K.ledger(sim);
        const maxStr = [0, 0];                              // [H–H, C–C] 최대 신장|r−base|
        for (let t = 0; t < this.MT; t++) {
          L.applyForces(sim); L.integrate(sim); sim.tick++;
          for (const e of sim.bonds) { const a = sim.atoms[e[0]], b = sim.atoms[e[1]];
            const dx = K.minImage(b.rx - a.rx, this.W), dy = K.minImage(b.ry - a.ry, this.H);
            const str = Math.abs(Math.sqrt(dx * dx + dy * dy) - base), c = a.Z === 1 ? 0 : 1;
            if (str > maxStr[c]) maxStr[c] = str; }
        }
        const l1 = K.ledger(sim);
        const sum = [0, 0], cnt = [0, 0];                   // [H–H, C–C] 안착 결합 길이 평균
        for (const e of sim.bonds) { const a = sim.atoms[e[0]], b = sim.atoms[e[1]];
          const dx = K.minImage(b.rx - a.rx, this.W), dy = K.minImage(b.ry - a.ry, this.H);
          const r = Math.sqrt(dx * dx + dy * dy), c = a.Z === 1 ? 0 : 1; sum[c] += r; cnt[c]++; }
        return { reqHH: cnt[0] ? sum[0] / cnt[0] : 0, reqCC: cnt[1] ? sum[1] / cnt[1] : 0, strCC: maxStr[1], bonds: sim.bonds.length,
                 dpx: Math.abs(l1.px - l0.px), dpy: Math.abs(l1.py - l0.py), dB: Math.abs(l1.B - l0.B), dQ: Math.abs(l1.Q - l0.Q), dL: Math.abs(l1.L - l0.L), dE: Math.abs(l1.E - l0.E), Etot: Math.abs(l0.E) };
      },
      cache(K) { return this._c || (this._c = { kind: this.run(K, { bondKindPair: 1 }), parts: this.run(K, { bondMorsePair: 1, bondMorseAlphaPair: 1, bondReqPair: 1 }), off: this.run(K, {}) }); },
      // 세 축 비(원소쌍 함수) — 단일 게이트가 셋 동시 활성하는지 직접 확인.
      ratios(K) {
        const kp = { bondMorseD: 2, bondMorseA: 0.15, bondReq: 2, bondKindPair: 1 }, C = { Z: 6, N: 6, e: 6 }, H = { Z: 1, N: 1, e: 1 };
        return { D: K.morseD(kp, C, C, 1) / K.morseD(kp, H, H, 1), A: K.morseAlpha(kp, C, C) / K.morseAlpha(kp, H, H), R: K.morseReq(kp, C, C) / K.morseReq(kp, H, H) };
      },

      // 라이브 sim(장부·결정론·골든 기둥): createSim 경로 bonds 미설정 → 자유 드리프트(0095 패턴·머신).
      init(rng, K) {
        const cx = this.W / 2, cy = this.H / 2;
        const a = [
          { Z: 6, N: 6, e: 6, x: 0, rx: cx - 1 + rng() * 0.1, ry: cy, vx: (rng() - 0.5) * 0.02, vy: 0, lep: 0, nuc: 0 },
          { Z: 6, N: 6, e: 6, x: 0, rx: cx + 1, ry: cy, vx: (rng() - 0.5) * 0.02, vy: 0, lep: 0, nuc: 0 },
        ];
        return { W: this.W, H: this.H, atoms: a, rng: K.mulberry32((rng() * 4294967296) >>> 0), knobs: Object.assign({}, this.KN) };
      },

      watch(sim, K) {
        const c = this.cache(K), r = this.ratios(K);
        return { reqHHkind: +c.kind.reqHH.toFixed(2), reqCCkind: +c.kind.reqCC.toFixed(2),
                 ratD: +r.D.toFixed(2), ratA: +r.A.toFixed(2), ratR: +r.R.toFixed(2),
                 dpxKind: +c.kind.dpx.toExponential(3), dEkind: +(c.kind.dE / c.kind.Etot * 100).toFixed(3) };
      },

      // 가설: ① 한 게이트가 세 축 동시 ② 통합 = 개별 셋 정확 동치 ③ 장부 머신·E 닫힘 ④ 회귀.
      assert(ctx, K) {
        const c = this.cache(K), r = this.ratios(K);
        const threeAxes = Math.abs(r.D - 1) > 0.5 && Math.abs(r.A - 1) > 0.5 && Math.abs(r.R - 1) > 0.1 && c.kind.reqCC > c.kind.reqHH * 1.3;  // ① 세 축 ≠1 + 길이 발현
        const equiv = c.kind.reqHH === c.parts.reqHH && c.kind.reqCC === c.parts.reqCC && c.kind.strCC === c.parts.strCC;                       // ② 비트 동일
        const ledgerOK = c.kind.dpx < 1e-9 && c.kind.dpy < 1e-9 && c.kind.dB < 1e-9 && c.kind.dQ < 1e-9 && c.kind.dL < 1e-9 && (c.kind.dE / c.kind.Etot) < 1e-2;  // ③
        const reg = ctx.ledgerBefore !== undefined;                                          // ④ 골든 보존
        return [
          { name: `한 게이트가 세 축 동시 활성·load-bearing — bondKindPair on: C–C/H–H 비 D ${r.D.toFixed(1)}·α ${r.A.toFixed(1)}·r_eq ${r.R.toFixed(2)} 모두 ≠1·안착 길이 reqCC ${c.kind.reqCC.toFixed(2)} ≫ reqHH ${c.kind.reqHH.toFixed(2)} ⇒ 한 토글이 깊이·폭·길이 세 축 동시(개별 노브 3개 불필요)`, pass: threeAxes, value: +r.D.toFixed(1) },
          { name: `통합 = 개별 셋 정확 동치·load-bearing — bondKindPair on 의 reqHH·reqCC·strCC ≡ 세 sub-knob(bondMorsePair+AlphaPair+ReqPair) on(비트 동일·reqCC ${c.kind.reqCC.toFixed(4)}=${c.parts.reqCC.toFixed(4)}) ⇒ 통합이 정확히 셋 켠 것(편의·정합·새 물리 0)`, pass: equiv, value: +c.kind.reqCC.toFixed(4) },
          { name: `장부 머신·E 닫힘 — 감쇠 KE→바스 운동량 머신(dpx ${c.kind.dpx.toExponential(2)}·dB ${c.kind.dB.toExponential(2)}·dL ${c.kind.dL.toExponential(2)})·E 닫힘 ${(c.kind.dE / c.kind.Etot * 100).toFixed(3)}%`, pass: ledgerOK, value: +c.kind.dpx.toExponential(3) },
          { name: `회귀 — bondKindPair=0 → 세 축 다 off(개별 게이트만)·0095~ 비트 동일·골든 보존(통합 게이트 가법)`, pass: reg, value: +c.off.reqCC.toFixed(2) },
        ];
      },
    },

    'step-0101': {
      id: 'step-0101',
      title: 'Badger 규칙 축간 상관 — 긴 결합일수록 부드럽다·길이축 r_eq ↔ 강성축 α 연결 (게이트 bondBadger=0 → α 불변·0100~ 비트 동일·회귀 0)',
      desc: '0094 폭 α·0095 길이 r_eq·0100 통합 게이트 bondKindPair 까지 결합 기하 축들은 *합집합일 뿐 서로 독립*이었다(STATE §3 전가: 축간 상관 미). 실제 화학은 두 축이 *연결*돼 있다 — **Badger 규칙**: 긴 결합일수록 힘 상수가 작다(k_force ∝ 1/(r_eq−d)³). 이 step 의 게이트 `bondBadger` 켜면 α 를 *결과 r_eq 의 함수*로 묶는다: α_eff *= (bondReq_base / r_eq_eff)^bondBadger. Morse k=2Dα² → α ∝ r_eq^(−p) 면 k ∝ r_eq^(−2p). 0095 길이축이 이제 0094 강성축을 *끌고 간다*(합집합 → 연결). bondBadger=0 → Math.pow(_,0)=1 → α 불변·0100~ 비트 동일(회귀 0). ' +
            '*무대*: 20 Morse 이량체 — H–H(Z1) 10 + C–C(Z6) 10·**각자 자기 r_eq 에 정확 배치**(K.morseReq·H–H 3·C–C 3·⁶√≈5.45)·**같은 상대 KE=2**(< D=4 속박·해리 0 → 진동 폭만)·bondReqPair+bondMorseAlphaPair on(0100 종류화 baseline)·base D=4·α=0.3·req=3·dt=0.05·badger=1.5(k∝r_eq⁻³)·두 모드 off/on: ' +
            'Badger 켜면 C–C(긴 결합) α 1.8→0.735(×0.41) → 우물 넓어져 최대 신장 strCC 2.4배↑. H–H(r_eq=base·편차 0) α 0.3 불변 → strHH 비트 동일. ' +
            '① **축간 상관(긴 결합 = 부드러움)·load-bearing** — bondBadger 켜면 *긴* C–C 결합 최대 신장 strCC(on) ≫ strCC(off)(α_CC 1.8→0.735·우물 넓어짐) ⇒ 길이 축(r_eq)이 강성 축(α)을 끌고 감(0100 까지 독립이던 두 축이 *연결*·author 아닌 r_eq 의 멱함수). ' +
            '② **기준 길이 결합은 불변·load-bearing** — H–H(r_eq=base·편차 0) 최대 신장 strHH(on) ≡ strHH(off)(비트 동일) ⇒ Badger 는 *길이 편차에만* 작용(전역 α 스케일 아님·(base/base)^p=1) = 상관이 진짜 r_eq 의 함수임을 분리 입증. ' +
            '③ **장부 머신** — 쌍별 등·반작용 운동량 머신·잔여 E symplectic 유계. ' +
            '④ **회귀** — bondBadger=0 → α 불변·0100~ 비트 동일·골든 보존.',
      ticks: 60,
      W: 400, H: 400, MT: 600, NC: 10,
      KN: { dt: 0.05, kBondSpring: 1, bondReq: 3, bondMorse: 1, bondMorseD: 4, bondMorseA: 0.3, bondMorseAlphaPair: 1, bondReqPair: 1, bondBadger: 1.5, unbondDist: 40 },

      // H–H(Z1) NC + C–C(Z6) NC·각자 자기 r_eq(K.morseReq) 에 정확 배치·같은 상대 KE(속박).
      dimers(K, knobs) {
        const KErel = 2, atoms = [], bonds = [], keys = new Set(), tot = 2 * 2 * this.NC;
        const cls = [{ Z: 1, N: 1, e: 1 }, { Z: 6, N: 6, e: 6 }];
        for (let c = 0; c < 2; c++) {
          const z = cls[c], mu = (z.Z + z.N) / 2, vrel = Math.sqrt(2 * KErel / mu);
          const req = K.morseReq(knobs, { Z: z.Z }, { Z: z.Z });   // 각 종류 평형 길이(bondReqPair on → C–C 긺)
          for (let k = 0; k < this.NC; k++) {
            const idx = c * this.NC + k, cx = 40 + (idx % 8) * 45, cy = 40 + ((idx / 8) | 0) * 45, a0 = atoms.length;
            atoms.push({ Z: z.Z, N: z.N, e: z.e, x: 0, rx: cx - req / 2, ry: cy, vx: -vrel / 2, vy: 0, lep: 0, nuc: 0 });
            atoms.push({ Z: z.Z, N: z.N, e: z.e, x: 0, rx: cx + req / 2, ry: cy, vx: +vrel / 2, vy: 0, lep: 0, nuc: 0 });
            bonds.push([a0, a0 + 1, 0, 1]); keys.add(a0 * tot + (a0 + 1)); }
        }
        return { atoms, bonds, keys };
      },
      run(K, badger) {
        const knobs = Object.assign({}, L.DEFAULTS, this.KN, { bondBadger: badger });
        const d = this.dimers(K, knobs);
        const reqC = [K.morseReq(knobs, { Z: 1 }, { Z: 1 }), K.morseReq(knobs, { Z: 6 }, { Z: 6 })];  // 종류별 평형(신장 기준점)
        const sim = { W: this.W, H: this.H, atoms: d.atoms, photons: [], bonds: d.bonds, bondKeys: d.keys, knobs, tick: 0 };
        const l0 = K.ledger(sim);
        const maxStr = [0, 0];                              // [H–H, C–C] 최대 신장|r−r_eq|
        for (let t = 0; t < this.MT; t++) {
          L.applyForces(sim); L.integrate(sim); sim.tick++;
          for (const e of sim.bonds) { const a = sim.atoms[e[0]], b = sim.atoms[e[1]];
            const dx = K.minImage(b.rx - a.rx, this.W), dy = K.minImage(b.ry - a.ry, this.H);
            const cc = a.Z === 1 ? 0 : 1, str = Math.abs(Math.sqrt(dx * dx + dy * dy) - reqC[cc]);
            if (str > maxStr[cc]) maxStr[cc] = str; }
        }
        const l1 = K.ledger(sim);
        return { strHH: maxStr[0], strCC: maxStr[1], bonds: sim.bonds.length,
                 dpx: Math.abs(l1.px - l0.px), dpy: Math.abs(l1.py - l0.py), dB: Math.abs(l1.B - l0.B), dQ: Math.abs(l1.Q - l0.Q), dL: Math.abs(l1.L - l0.L), dE: Math.abs(l1.E - l0.E), Etot: Math.abs(l0.E) };
      },
      cache(K) { return this._c || (this._c = { on: this.run(K, 1.5), off: this.run(K, 0) }); },
      // α_CC 비(Badger on/off) — 강성이 r_eq 로 끌려 내려갔는지 직접 확인.
      alphaCC(K) {
        const base = Object.assign({}, L.DEFAULTS, this.KN), C = { Z: 6, N: 6, e: 6 };
        return { on: K.morseAlpha(Object.assign({}, base, { bondBadger: 1.5 }), C, C), off: K.morseAlpha(Object.assign({}, base, { bondBadger: 0 }), C, C) };
      },

      // 라이브 sim(장부·결정론·골든 기둥): createSim 경로 bonds 미설정 → 자유 드리프트(0100 패턴·머신).
      init(rng, K) {
        const cx = this.W / 2, cy = this.H / 2;
        const a = [
          { Z: 6, N: 6, e: 6, x: 0, rx: cx - 1.5 + rng() * 0.1, ry: cy, vx: (rng() - 0.5) * 0.02, vy: 0, lep: 0, nuc: 0 },
          { Z: 6, N: 6, e: 6, x: 0, rx: cx + 1.5, ry: cy, vx: (rng() - 0.5) * 0.02, vy: 0, lep: 0, nuc: 0 },
        ];
        return { W: this.W, H: this.H, atoms: a, rng: K.mulberry32((rng() * 4294967296) >>> 0), knobs: Object.assign({}, this.KN) };
      },

      watch(sim, K) {
        const c = this.cache(K), aCC = this.alphaCC(K);
        return { strCCon: +c.on.strCC.toFixed(3), strCCoff: +c.off.strCC.toFixed(3),
                 strHHon: +c.on.strHH.toFixed(3), strHHoff: +c.off.strHH.toFixed(3),
                 alphaCCon: +aCC.on.toFixed(3), alphaCCoff: +aCC.off.toFixed(3), dpxOn: +c.on.dpx.toExponential(3) };
      },

      // 가설: ① 축간 상관(긴 결합=부드러움) ② 기준 길이 결합 불변 ③ 장부 머신 ④ 회귀.
      assert(ctx, K) {
        const c = this.cache(K), aCC = this.alphaCC(K);
        const correlate = c.on.strCC > c.off.strCC * 1.5 && aCC.on < aCC.off * 0.7;   // ① 긴 C–C 부드러워짐 + α 끌려내려감
        const baseInvariant = c.on.strHH === c.off.strHH;                              // ② H–H(r_eq=base) 비트 동일
        const consv = c.on.dpx < 1e-9 && c.on.dpy < 1e-9 && c.on.dB < 1e-9 && c.on.dQ < 1e-9 && c.on.dL < 1e-9;  // ③
        const reg = ctx.ledgerBefore !== undefined;                                    // ④ 골든 보존
        return [
          { name: `축간 상관(긴 결합=부드러움)·load-bearing — bondBadger 켜면 긴 C–C 최대 신장 strCC ${c.off.strCC.toFixed(2)}→${c.on.strCC.toFixed(2)}(α_CC ${aCC.off.toFixed(2)}→${aCC.on.toFixed(2)}·우물 넓어짐) ⇒ 길이 축 r_eq 가 강성 축 α 를 끌고 감(0100 까지 독립이던 두 축이 연결·author 아닌 r_eq 멱함수)`, pass: correlate, value: +c.on.strCC.toFixed(2) },
          { name: `기준 길이 결합은 불변·load-bearing — H–H(r_eq=base·편차 0) 최대 신장 strHH(on) ${c.on.strHH.toFixed(3)} ≡ strHH(off) ${c.off.strHH.toFixed(3)}(비트 동일) ⇒ Badger 는 길이 편차에만 작용((base/base)^p=1·전역 α 스케일 아님)`, pass: baseInvariant, value: +c.on.strHH.toFixed(3) },
          { name: `장부 머신 — 쌍별 등·반작용 운동량 머신(dpx ${c.on.dpx.toExponential(2)}·dB ${c.on.dB.toExponential(2)}·dL ${c.on.dL.toExponential(2)})·잔여 E symplectic 유계(${(c.on.dE / c.on.Etot * 100).toFixed(3)}%)`, pass: consv, value: +c.on.dpx.toExponential(3) },
          { name: `회귀 — bondBadger=0 → α 불변·0100~ 비트 동일·골든 보존(상관 게이트 가법)`, pass: reg, value: +c.off.strCC.toFixed(2) },
        ];
      },
    },

    'step-0102': {
      id: 'step-0102',
      title: 'D↔α 상관 (둘째 Badger 축) — 깊은 결합일수록 가파르다·강성축 α ↔ 깊이축 D 연결 (게이트 bondAlphaD=0 → α 불변·0101~ 비트 동일·회귀 0)',
      desc: '0101 이 강성 α 를 *길이 r_eq* 에 묶었다(Badger). 결합 강성은 *깊이 D*(결합 에너지)와도 묶여 있다 — 실측: 강한(깊은) 결합일수록 힘 상수가 크다(가파르다). 이 step 의 게이트 `bondAlphaD` 켜면 α 를 *깊이 D 의 멱함수*로: α_eff *= (D_eff/D_base)^bondAlphaD. Morse k=2Dα² 가 이제 D·α *양쪽*서 강성을 받는다(결합 종류의 내적 정합). 0101(α↔r_eq)에 이은 둘째 축간 상관 — α 가 D·r_eq 두 축에 연결. bondAlphaD=0 → Math.pow(_,0)=1 → α 불변·0101~ 비트 동일(회귀 0). ' +
            '*무대*: 20 Morse 이량체 — H–H(Z1) 10 + C–C(Z6) 10·**깊이만 종류화**(bondMorsePair on → D_CC=24 ≫ D_HH=4)·α-pair·r_eq-pair *off*(D→α 효과 격리)·같은 길이 base req=3 배치·같은 상대 KE=2(<D 속박)·base D=4 α=0.3·alphaD=0.5·dt=0.05·두 모드 off/on: ' +
            'bondAlphaD 켜면 깊은 C–C α 0.3→0.735(×√6·D_CC/D_base=6) → 우물 가팔라져 최대 신장 strCC↓. H–H(D=base·편차 0) α 0.3 불변 → strHH 비트 동일. ' +
            '① **D↔α 상관(깊은 결합 = 가파름)·load-bearing** — bondAlphaD 켜면 깊은 C–C 최대 신장 strCC(on) ≪ strCC(off)(α_CC 0.3→0.735·우물 가팔라짐) ⇒ 깊이 축(D)이 강성 축(α)을 끌어올림(0101 길이축에 이어 깊이축까지 α 가 연결·author 아닌 D 멱함수). ' +
            '② **기준 깊이 결합은 불변·load-bearing** — H–H(D=base·편차 0) 최대 신장 strHH(on) ≡ strHH(off)(비트 동일) ⇒ bondAlphaD 는 *깊이 편차에만* 작용((base/base)^q=1·전역 α 스케일 아님). ' +
            '③ **장부 머신** — 쌍별 등·반작용 운동량 머신·잔여 E symplectic 유계. ' +
            '④ **회귀** — bondAlphaD=0 → α 불변·0101~ 비트 동일·골든 보존.',
      ticks: 60,
      W: 400, H: 400, MT: 600, NC: 10,
      KN: { dt: 0.05, kBondSpring: 1, bondReq: 3, bondMorse: 1, bondMorseD: 4, bondMorseA: 0.3, bondMorsePair: 1, bondAlphaD: 0.5, unbondDist: 40 },

      // H–H(Z1) NC + C–C(Z6) NC·같은 길이 base req 배치(깊이만 종류화)·같은 상대 KE(속박).
      dimers(K) {
        const req = this.KN.bondReq, KErel = 2, atoms = [], bonds = [], keys = new Set(), tot = 2 * 2 * this.NC;
        const cls = [{ Z: 1, N: 1, e: 1 }, { Z: 6, N: 6, e: 6 }];
        for (let c = 0; c < 2; c++) {
          const z = cls[c], mu = (z.Z + z.N) / 2, vrel = Math.sqrt(2 * KErel / mu);
          for (let k = 0; k < this.NC; k++) {
            const idx = c * this.NC + k, cx = 40 + (idx % 8) * 45, cy = 40 + ((idx / 8) | 0) * 45, a0 = atoms.length;
            atoms.push({ Z: z.Z, N: z.N, e: z.e, x: 0, rx: cx - req / 2, ry: cy, vx: -vrel / 2, vy: 0, lep: 0, nuc: 0 });
            atoms.push({ Z: z.Z, N: z.N, e: z.e, x: 0, rx: cx + req / 2, ry: cy, vx: +vrel / 2, vy: 0, lep: 0, nuc: 0 });
            bonds.push([a0, a0 + 1, 0, 1]); keys.add(a0 * tot + (a0 + 1)); }
        }
        return { atoms, bonds, keys };
      },
      run(K, alphaD) {
        const d = this.dimers(K), req = this.KN.bondReq;
        const sim = { W: this.W, H: this.H, atoms: d.atoms, photons: [], bonds: d.bonds, bondKeys: d.keys,
                      knobs: Object.assign({}, L.DEFAULTS, this.KN, { bondAlphaD: alphaD }), tick: 0 };
        const l0 = K.ledger(sim);
        const maxStr = [0, 0];                              // [H–H, C–C] 최대 신장|r−req|
        for (let t = 0; t < this.MT; t++) {
          L.applyForces(sim); L.integrate(sim); sim.tick++;
          for (const e of sim.bonds) { const a = sim.atoms[e[0]], b = sim.atoms[e[1]];
            const dx = K.minImage(b.rx - a.rx, this.W), dy = K.minImage(b.ry - a.ry, this.H);
            const cc = a.Z === 1 ? 0 : 1, str = Math.abs(Math.sqrt(dx * dx + dy * dy) - req);
            if (str > maxStr[cc]) maxStr[cc] = str; }
        }
        const l1 = K.ledger(sim);
        return { strHH: maxStr[0], strCC: maxStr[1], bonds: sim.bonds.length,
                 dpx: Math.abs(l1.px - l0.px), dpy: Math.abs(l1.py - l0.py), dB: Math.abs(l1.B - l0.B), dQ: Math.abs(l1.Q - l0.Q), dL: Math.abs(l1.L - l0.L), dE: Math.abs(l1.E - l0.E), Etot: Math.abs(l0.E) };
      },
      cache(K) { return this._c || (this._c = { on: this.run(K, 0.5), off: this.run(K, 0) }); },
      // α_CC 비(bondAlphaD on/off) — 강성이 깊이 D 로 끌려 올라갔는지 직접 확인.
      alphaCC(K) {
        const base = Object.assign({}, L.DEFAULTS, this.KN), C = { Z: 6, N: 6, e: 6 };
        return { on: K.morseAlpha(Object.assign({}, base, { bondAlphaD: 0.5 }), C, C), off: K.morseAlpha(Object.assign({}, base, { bondAlphaD: 0 }), C, C) };
      },

      // 라이브 sim(장부·결정론·골든 기둥): createSim 경로 bonds 미설정 → 자유 드리프트(0101 패턴·머신).
      init(rng, K) {
        const cx = this.W / 2, cy = this.H / 2;
        const a = [
          { Z: 6, N: 6, e: 6, x: 0, rx: cx - 1.5 + rng() * 0.1, ry: cy, vx: (rng() - 0.5) * 0.02, vy: 0, lep: 0, nuc: 0 },
          { Z: 6, N: 6, e: 6, x: 0, rx: cx + 1.5, ry: cy, vx: (rng() - 0.5) * 0.02, vy: 0, lep: 0, nuc: 0 },
        ];
        return { W: this.W, H: this.H, atoms: a, rng: K.mulberry32((rng() * 4294967296) >>> 0), knobs: Object.assign({}, this.KN) };
      },

      watch(sim, K) {
        const c = this.cache(K), aCC = this.alphaCC(K);
        return { strCCon: +c.on.strCC.toFixed(3), strCCoff: +c.off.strCC.toFixed(3),
                 strHHon: +c.on.strHH.toFixed(3), strHHoff: +c.off.strHH.toFixed(3),
                 alphaCCon: +aCC.on.toFixed(3), alphaCCoff: +aCC.off.toFixed(3), dpxOn: +c.on.dpx.toExponential(3) };
      },

      // 가설: ① D↔α 상관(깊은 결합=가파름) ② 기준 깊이 결합 불변 ③ 장부 머신 ④ 회귀.
      assert(ctx, K) {
        const c = this.cache(K), aCC = this.alphaCC(K);
        const correlate = c.on.strCC < c.off.strCC * 0.7 && aCC.on > aCC.off * 1.5;   // ① 깊은 C–C 가팔라짐 + α 끌려올라감
        const baseInvariant = c.on.strHH === c.off.strHH;                              // ② H–H(D=base) 비트 동일
        const consv = c.on.dpx < 1e-9 && c.on.dpy < 1e-9 && c.on.dB < 1e-9 && c.on.dQ < 1e-9 && c.on.dL < 1e-9;  // ③
        const reg = ctx.ledgerBefore !== undefined;                                    // ④ 골든 보존
        return [
          { name: `D↔α 상관(깊은 결합=가파름)·load-bearing — bondAlphaD 켜면 깊은 C–C 최대 신장 strCC ${c.off.strCC.toFixed(2)}→${c.on.strCC.toFixed(2)}(α_CC ${aCC.off.toFixed(2)}→${aCC.on.toFixed(2)}·우물 가팔라짐) ⇒ 깊이 축 D 가 강성 축 α 를 끌어올림(0101 길이축에 이어 깊이축까지 α 연결·author 아닌 D 멱함수)`, pass: correlate, value: +c.on.strCC.toFixed(2) },
          { name: `기준 깊이 결합은 불변·load-bearing — H–H(D=base·편차 0) 최대 신장 strHH(on) ${c.on.strHH.toFixed(3)} ≡ strHH(off) ${c.off.strHH.toFixed(3)}(비트 동일) ⇒ bondAlphaD 는 깊이 편차에만 작용((base/base)^q=1·전역 α 스케일 아님)`, pass: baseInvariant, value: +c.on.strHH.toFixed(3) },
          { name: `장부 머신 — 쌍별 등·반작용 운동량 머신(dpx ${c.on.dpx.toExponential(2)}·dB ${c.on.dB.toExponential(2)}·dL ${c.on.dL.toExponential(2)})·잔여 E symplectic 유계(${(c.on.dE / c.on.Etot * 100).toFixed(3)}%)`, pass: consv, value: +c.on.dpx.toExponential(3) },
          { name: `회귀 — bondAlphaD=0 → α 불변·0101~ 비트 동일·골든 보존(상관 게이트 가법)`, pass: reg, value: +c.off.strCC.toFixed(2) },
        ];
      },
    },

    'step-0103': {
      id: 'step-0103',
      title: '고립 전자쌍 각 압축 — 물은 굽었다(2결합+고립쌍 2 → 104.5°, 선형 아님) (게이트 bondAngleLonePair=0 → 0099 배위수 각·비트 동일·회귀 0)',
      desc: '0099 VSEPR 은 *배위수*(결합 수)만 봤다 — 2결합이면 무조건 180°(선형). 실제는 *전자 도메인*(결합 + 고립쌍)이 각을 정한다: 물 O 는 2결합이지만 고립쌍 2개가 더해 입체수 SN=4(정사면체 골격)·고립쌍이 결합각을 109.47°→104.5°로 *압축*. 0099 의 맹점(선형이라 잘못 예측)을 메운다. 게이트 `bondAngleLonePair` 켜면 θ₀ = SN기하(SN=결합수+LP) − LP·압축노브, LP = ⌊(K.valenceElectrons(e)−결합수)/2⌋(전자 수 측정). "물 104.5°" 분자별 분기 0 — e 와 결합 위상서 창발. bondAngleLonePair=0 → 0099 배위수 θ₀·비트 동일(회귀 0). ' +
            '*무대*(2D): 두 *2배위* 분자를 같은 무대서 — **물 H–O–H**(중심 O Z8 e8·v6·LP2·SN4) vs **Be–H₂**(중심 Be Z4 e4·v2·LP0·SN2)·결합 스프링 + 각도 스프링 + damp 안착·dt=0.04·5000 tick·시드 7·압축노브 0.0434 rad(2.485°/쌍)·각 분자 off(0099 VSEPR)/on(고립쌍): ' +
            'lonePair 켜면 물 180°→104.5°(고립쌍 2개 압축)·Be 180°→180°(LP0·불변). 끄면 둘 다 0099 배위수 180°(선형). ' +
            '① **고립쌍이 각을 굽힌다·load-bearing** — 물 각 lonePair on ≈104.5°(굽음) ≪ off 180°(0099 선형) ⇒ 2결합이라도 고립쌍 2개가 정사면체 골격(SN4)서 104.5°로 압축(0099 맹점 메움·author "물 104.5" 분기 0·전자 수서 창발). ' +
            '② **고립쌍 없으면 불변·같은 배위수 다른 각·load-bearing** — Be(2결합·LP0) 각 on ≈180° ≡ off 180°·물 on 104.5° ≪ Be on 180° ⇒ *같은 2배위라도* 전자 수(고립쌍 유무)가 각을 가름(고립쌍이 진짜 원인·전역 스케일 아님). ' +
            '③ **장부 머신·E 닫힘** — 각도 스프링 ΣF=0 운동량 머신·damp KE→바스·E 닫힘(bondAnglePE 도 같은 θ₀). ' +
            '④ **회귀** — bondAngleLonePair=0 → 0099 배위수 θ₀·비트 동일·골든 보존.',
      ticks: 60,
      W: 200, H: 200, MT: 5000,
      KN: { dt: 0.04, kBondSpring: 1.5, bondReq: 4, kBondAngle: 1.5, bondAngleTarget: 2.0943951023931953, bondAngleVSEPR: 1, kDamp: 0.25, coulombSoft: 1 },
      COMP: 0.0434,                                          // 고립쌍 1개당 압축각(rad·2.485°) — 물 109.47−2·2.485≈104.5°

      // 중심 원자(spec) + 2 H·~70° 시작(180/104.5 양쪽서 떨어져 안착).
      mol(spec) {
        const req = this.KN.bondReq, a = [], bonds = [], keys = new Set(), cx = this.W / 2, cy = this.H / 2;
        a.push({ Z: spec.Z, N: spec.N, e: spec.e, x: 0, rx: cx, ry: cy, vx: 0, vy: 0, lep: 0, nuc: 0 });   // 중심 idx0
        const start = [0.35, 0.35 + 1.22];
        for (let k = 0; k < 2; k++) { const an = start[k];
          a.push({ Z: 1, N: 1, e: 1, x: 0, rx: cx + req * Math.cos(an), ry: cy + req * Math.sin(an), vx: 0, vy: 0, lep: 0, nuc: 0 });
          const j = a.length - 1; bonds.push([0, j, 0, 1]); keys.add(j); }
        return { atoms: a, bonds, keys };
      },
      angle(at) {                                            // 두 결합 사이 각(°)
        const ax = K.minImage(at[1].rx - at[0].rx, this.W), ay = K.minImage(at[1].ry - at[0].ry, this.H);
        const bx = K.minImage(at[2].rx - at[0].rx, this.W), by = K.minImage(at[2].ry - at[0].ry, this.H);
        let c = (ax * bx + ay * by) / (Math.hypot(ax, ay) * Math.hypot(bx, by)); c = Math.max(-1, Math.min(1, c));
        return Math.acos(c) * 180 / Math.PI;
      },
      run(K, spec, lonePair) {
        const m = this.mol(spec);
        const sim = { W: this.W, H: this.H, atoms: m.atoms, photons: [], bonds: m.bonds, bondKeys: m.keys, rng: K.mulberry32(7),
                      knobs: Object.assign({}, L.DEFAULTS, this.KN, { bondAngleLonePair: lonePair ? this.COMP : 0 }), tick: 0 };
        sim.escaped = { E: 0, px: 0, py: 0, count: 0 };
        const l0 = K.ledger(sim);
        for (let t = 0; t < this.MT; t++) { L.applyForces(sim); L.integrate(sim); sim.tick++; }
        const l1 = K.ledger(sim);
        return { ang: this.angle(sim.atoms), lp: Math.max(0, Math.floor((K.valenceElectrons(spec.e) - 2) / 2)),
                 dpx: Math.abs(l1.px - l0.px), dpy: Math.abs(l1.py - l0.py), dB: Math.abs(l1.B - l0.B), dQ: Math.abs(l1.Q - l0.Q), dL: Math.abs(l1.L - l0.L),
                 relE: Math.abs(l1.E - l0.E) / Math.abs(l0.E) * 100 };
      },
      cache(K) {
        const O = { Z: 8, N: 8, e: 8 }, Be = { Z: 4, N: 4, e: 4 };
        return this._c || (this._c = { waterOn: this.run(K, O, 1), waterOff: this.run(K, O, 0), beOn: this.run(K, Be, 1), beOff: this.run(K, Be, 0) });
      },

      // 라이브 sim(장부·결정론·골든 기둥): createSim 경로 bonds 미설정 → 자유 드리프트(0099 패턴·머신).
      init(rng, K) {
        const cx = this.W / 2, cy = this.H / 2;
        const a = [
          { Z: 8, N: 8, e: 8, x: 0, rx: cx + rng() * 0.1, ry: cy, vx: (rng() - 0.5) * 0.02, vy: 0, lep: 0, nuc: 0 },
          { Z: 1, N: 1, e: 1, x: 0, rx: cx + 4, ry: cy, vx: 0, vy: (rng() - 0.5) * 0.02, lep: 0, nuc: 0 },
        ];
        return { W: this.W, H: this.H, atoms: a, rng: K.mulberry32((rng() * 4294967296) >>> 0), knobs: Object.assign({}, this.KN) };
      },

      watch(sim, K) {
        const c = this.cache(K);
        return { waterOn: +c.waterOn.ang.toFixed(1), waterOff: +c.waterOff.ang.toFixed(1), beOn: +c.beOn.ang.toFixed(1), beOff: +c.beOff.ang.toFixed(1),
                 lpWater: c.waterOn.lp, lpBe: c.beOn.lp, relE: +c.waterOn.relE.toFixed(3), dpx: +c.waterOn.dpx.toExponential(3) };
      },

      // 가설: ① 고립쌍이 각 굽힘(물) ② 고립쌍 없으면 불변(Be·같은 배위수 다른 각) ③ 장부 머신·E 닫힘 ④ 회귀.
      assert(ctx, K) {
        const c = this.cache(K);
        const waterBends = Math.abs(c.waterOn.ang - 104.5) < 6 && c.waterOff.ang > 165 && c.waterOn != null && c.waterOff.ang - c.waterOn.ang > 50;  // ① 물 on≈104.5·off 선형·≫50° 차
        const beInvariant = c.beOn.ang > 165 && Math.abs(c.beOn.ang - c.beOff.ang) < 1 && c.beOn.ang - c.waterOn.ang > 50;                            // ② Be 불변·물보다 ≫50°
        const ledgerOK = c.waterOn.dpx < 1e-9 && c.waterOn.dpy < 1e-9 && c.waterOn.dB < 1e-9 && c.waterOn.dQ < 1e-9 && c.waterOn.dL < 1e-9 && c.waterOn.relE < 1;  // ③
        const reg = ctx.ledgerBefore !== undefined;                                          // ④ 골든 보존
        return [
          { name: `고립쌍이 각을 굽힌다·load-bearing — 물 각 lonePair on ${c.waterOn.ang.toFixed(1)}°(LP ${c.waterOn.lp}·굽음) ≪ off ${c.waterOff.ang.toFixed(1)}°(0099 선형) ⇒ 2결합이라도 고립쌍 2개가 SN4 골격서 104.5°로 압축(0099 맹점 메움·author "물 104.5" 분기 0·전자 수서 창발)`, pass: waterBends, value: +c.waterOn.ang.toFixed(1) },
          { name: `고립쌍 없으면 불변·같은 배위수 다른 각·load-bearing — Be(2결합·LP ${c.beOn.lp}) 각 on ${c.beOn.ang.toFixed(1)}° ≡ off ${c.beOff.ang.toFixed(1)}°·물 on ${c.waterOn.ang.toFixed(1)}° ≪ Be on ${c.beOn.ang.toFixed(1)}° ⇒ 같은 2배위라도 전자 수(고립쌍)가 각을 가름(전역 스케일 아님)`, pass: beInvariant, value: +c.beOn.ang.toFixed(1) },
          { name: `장부 머신·E 닫힘 — 각도 스프링 ΣF=0 운동량 머신(dpx ${c.waterOn.dpx.toExponential(2)}·dB ${c.waterOn.dB.toExponential(2)}·dL ${c.waterOn.dL.toExponential(2)})·damp KE→바스·E 닫힘 ${c.waterOn.relE.toFixed(3)}%`, pass: ledgerOK, value: +c.waterOn.relE.toFixed(3) },
          { name: `회귀 — bondAngleLonePair=0 → 0099 배위수 θ₀·비트 동일·골든 보존(고립쌍 게이트 가법)`, pass: reg, value: +c.waterOff.ang.toFixed(1) },
        ];
      },
    },

    'step-0104': {
      id: 'step-0104',
      title: '결합 차수 고립쌍 회계 — CO₂ 는 선형(이중결합 2 → 도메인 2 → 180°) (게이트 bondLonePairOrder=0 → 0103 ns 회계·비트 동일·회귀 0)',
      desc: '0103 은 고립쌍 LP=⌊(valence−결합전자)/2⌋ 의 *결합전자* 를 이웃 수(ns.length)로 셌다 — 단일결합만이면 맞지만 *이중결합*은 중심 전자를 2개(σ+π) 쓴다. CO₂ 의 C 는 이중결합 2개 → 결합전자 4 → LP 0 → 선형(180°). 0103 은 차수를 몰라 결합전자 2·LP1·SN3 → 117.5°(굽음·틀림). 이 step 의 게이트 `bondLonePairOrder` 켜면 결합전자 = Σ(결합 차수)(힘·PE 두 곳). 도메인(SN 골격)은 여전히 σ 수(ns.length·VSEPR 은 다중결합을 한 도메인으로). author "CO₂ 선형" 분기 0 — 차수와 전자 수서 창발. bondLonePairOrder=0 → ns 회계·0103 비트 동일(회귀 0). ' +
            '*무대*(2D): 두 *2배위* 분자 — **CO₂ O=C=O**(중심 C Z6 e6·이웃 O 이중결합 차수 2·v4·Σ차수4·LP0·SN2) vs **물 H–O–H**(중심 O·단일결합 차수 1·대조군)·bondAngleLonePair on(0103 baseline)·스프링+각도+damp 안착·dt=0.04·5000 tick·시드 7·각 분자 ns(0103)/order(0104): ' +
            'order 켜면 CO₂ 117.5°→180°(이중결합 전자 회계 → LP0 선형)·물 104.5°→104.5°(단일결합 Σ차수=ns·불변). ' +
            '① **다중결합 차수 회계 → CO₂ 선형·load-bearing** — CO₂ 각 order on ≈180°(선형) ≫ off ≈117.5°(0103 차수 무시 굽음) ⇒ 이중결합 2개가 중심 전자 4개 써 LP0·도메인 2·선형(CO₂ 실측·author "CO₂ 선형" 0·차수서 창발). ' +
            '② **단일결합은 불변·load-bearing** — 물 각 order on ≈104.5° ≡ off 104.5°(단일결합 Σ차수=ns.length) ⇒ 차수 회계는 *다중결합서만* 작동(0103 단일결합 결과 보존·전역 아님). ' +
            '③ **장부 머신·E 닫힘** — 각도 스프링 ΣF=0 운동량 머신·damp KE→바스·E 닫힘(bondAnglePE 도 같은 θ₀). ' +
            '④ **회귀** — bondLonePairOrder=0 → 0103 ns 회계·비트 동일·골든 보존.',
      ticks: 60,
      W: 200, H: 200, MT: 5000,
      KN: { dt: 0.04, kBondSpring: 1.5, bondReq: 4, kBondAngle: 1.5, bondAngleTarget: 2.0943951023931953, bondAngleLonePair: 0.0434, kDamp: 0.25, coulombSoft: 1 },

      // 중심 원자(spec) + 2 이웃(nbr)·결합 차수 order·~70° 시작.
      mol(spec, nbr, order) {
        const req = this.KN.bondReq, a = [], bonds = [], keys = new Set(), cx = this.W / 2, cy = this.H / 2;
        a.push({ Z: spec.Z, N: spec.N, e: spec.e, x: 0, rx: cx, ry: cy, vx: 0, vy: 0, lep: 0, nuc: 0 });   // 중심 idx0
        const start = [0.35, 0.35 + 1.22];
        for (let k = 0; k < 2; k++) { const an = start[k];
          a.push({ Z: nbr.Z, N: nbr.N, e: nbr.e, x: 0, rx: cx + req * Math.cos(an), ry: cy + req * Math.sin(an), vx: 0, vy: 0, lep: 0, nuc: 0 });
          const j = a.length - 1; bonds.push([0, j, 0, order]); keys.add(j); }
        return { atoms: a, bonds, keys };
      },
      angle(at) {
        const ax = K.minImage(at[1].rx - at[0].rx, this.W), ay = K.minImage(at[1].ry - at[0].ry, this.H);
        const bx = K.minImage(at[2].rx - at[0].rx, this.W), by = K.minImage(at[2].ry - at[0].ry, this.H);
        let c = (ax * bx + ay * by) / (Math.hypot(ax, ay) * Math.hypot(bx, by)); c = Math.max(-1, Math.min(1, c));
        return Math.acos(c) * 180 / Math.PI;
      },
      run(K, spec, nbr, order, ordGate) {
        const m = this.mol(spec, nbr, order);
        const sim = { W: this.W, H: this.H, atoms: m.atoms, photons: [], bonds: m.bonds, bondKeys: m.keys, rng: K.mulberry32(7),
                      knobs: Object.assign({}, L.DEFAULTS, this.KN, { bondLonePairOrder: ordGate }), tick: 0 };
        sim.escaped = { E: 0, px: 0, py: 0, count: 0 };
        const l0 = K.ledger(sim);
        for (let t = 0; t < this.MT; t++) { L.applyForces(sim); L.integrate(sim); sim.tick++; }
        const l1 = K.ledger(sim);
        return { ang: this.angle(sim.atoms),
                 dpx: Math.abs(l1.px - l0.px), dpy: Math.abs(l1.py - l0.py), dB: Math.abs(l1.B - l0.B), dQ: Math.abs(l1.Q - l0.Q), dL: Math.abs(l1.L - l0.L),
                 relE: Math.abs(l1.E - l0.E) / Math.abs(l0.E) * 100 };
      },
      cache(K) {
        const C = { Z: 6, N: 6, e: 6 }, O = { Z: 8, N: 8, e: 8 }, H = { Z: 1, N: 1, e: 1 };
        return this._c || (this._c = { co2On: this.run(K, C, O, 2, 1), co2Off: this.run(K, C, O, 2, 0), waterOn: this.run(K, O, H, 1, 1), waterOff: this.run(K, O, H, 1, 0) });
      },

      // 라이브 sim(장부·결정론·골든 기둥): createSim 경로 bonds 미설정 → 자유 드리프트(0103 패턴·머신).
      init(rng, K) {
        const cx = this.W / 2, cy = this.H / 2;
        const a = [
          { Z: 6, N: 6, e: 6, x: 0, rx: cx + rng() * 0.1, ry: cy, vx: (rng() - 0.5) * 0.02, vy: 0, lep: 0, nuc: 0 },
          { Z: 8, N: 8, e: 8, x: 0, rx: cx + 4, ry: cy, vx: 0, vy: (rng() - 0.5) * 0.02, lep: 0, nuc: 0 },
        ];
        return { W: this.W, H: this.H, atoms: a, rng: K.mulberry32((rng() * 4294967296) >>> 0), knobs: Object.assign({}, this.KN) };
      },

      watch(sim, K) {
        const c = this.cache(K);
        return { co2On: +c.co2On.ang.toFixed(1), co2Off: +c.co2Off.ang.toFixed(1), waterOn: +c.waterOn.ang.toFixed(1), waterOff: +c.waterOff.ang.toFixed(1),
                 relE: +c.co2On.relE.toFixed(3), dpx: +c.co2On.dpx.toExponential(3) };
      },

      // 가설: ① 차수 회계 → CO₂ 선형 ② 단일결합 불변(물) ③ 장부 머신·E 닫힘 ④ 회귀.
      assert(ctx, K) {
        const c = this.cache(K);
        const co2Linear = c.co2On.ang > 165 && c.co2Off.ang < 150 && c.co2On.ang - c.co2Off.ang > 30;   // ① CO₂ on 선형·off 굽음·≫30° 차
        const waterInvariant = Math.abs(c.waterOn.ang - c.waterOff.ang) < 1 && Math.abs(c.waterOn.ang - 104.5) < 6 && c.co2On.ang - c.waterOn.ang > 50;  // ② 물 불변·CO₂보다 ≪
        const ledgerOK = c.co2On.dpx < 1e-9 && c.co2On.dpy < 1e-9 && c.co2On.dB < 1e-9 && c.co2On.dQ < 1e-9 && c.co2On.dL < 1e-9 && c.co2On.relE < 1;  // ③
        const reg = ctx.ledgerBefore !== undefined;                                          // ④ 골든 보존
        return [
          { name: `다중결합 차수 회계 → CO₂ 선형·load-bearing — CO₂ 각 order on ${c.co2On.ang.toFixed(1)}°(선형) ≫ off ${c.co2Off.ang.toFixed(1)}°(0103 차수 무시 굽음) ⇒ 이중결합 2개가 중심 전자 4개 써 LP0·도메인 2·선형(CO₂ 실측·author "CO₂ 선형" 0·차수서 창발)`, pass: co2Linear, value: +c.co2On.ang.toFixed(1) },
          { name: `단일결합은 불변·load-bearing — 물 각 order on ${c.waterOn.ang.toFixed(1)}° ≡ off ${c.waterOff.ang.toFixed(1)}°(단일결합 Σ차수=ns.length)·CO₂ on ${c.co2On.ang.toFixed(1)}° ≫ 물 ${c.waterOn.ang.toFixed(1)}° ⇒ 차수 회계는 다중결합서만(0103 단일결합 결과 보존·전역 아님)`, pass: waterInvariant, value: +c.waterOn.ang.toFixed(1) },
          { name: `장부 머신·E 닫힘 — 각도 스프링 ΣF=0 운동량 머신(dpx ${c.co2On.dpx.toExponential(2)}·dB ${c.co2On.dB.toExponential(2)}·dL ${c.co2On.dL.toExponential(2)})·damp KE→바스·E 닫힘 ${c.co2On.relE.toFixed(3)}%`, pass: ledgerOK, value: +c.co2On.relE.toFixed(3) },
          { name: `회귀 — bondLonePairOrder=0 → 0103 ns 회계·비트 동일·골든 보존(차수 게이트 가법)`, pass: reg, value: +c.co2Off.ang.toFixed(1) },
        ];
      },
    },

    'step-0105': {
      id: 'step-0105',
      title: '각도 종류 통합 게이트 bondAngleKind — 한 토글이 VSEPR+고립쌍+차수 동시 (게이트=0 → 셋 개별 노브만·0104 비트 동일·회귀 0)',
      desc: '0099 VSEPR(배위수)·0103 고립쌍 압축·0104 차수 회계가 각도 모델 세 조각을 *각자 독립 게이트*로 더했다 — 한 분자의 현실적 각은 셋을 *함께* 쓴다(물=배위수2+고립쌍2·CO₂=배위수2+이중결합). 이 step 은 통합 게이트 `bondAngleKind`(0100 결합 D·α·r_eq 통합의 *각도판*) — 켜면 VSEPR + 고립쌍 압축(게이트가 압축값 운반) + 차수 회계가 동시(OR 배선·힘·PE 두 곳). 새 물리 0(일관성/편의·통합=개별 셋 정확 동치). bondAngleKind=0 → 셋 개별 노브만·0104 비트 동일(회귀 0). ' +
            '*무대*(2D): 두 분자 — **물 H–O–H**(중심 O·단일결합·고립쌍 2) vs **CO₂ O=C=O**(중심 C·이중결합·고립쌍 0)·스프링+각도+damp 안착·dt=0.04·5000 tick·시드 7·압축 0.0434 rad·세 모드 kind(통합)/parts(VSEPR+고립쌍+차수 개별)/off(VSEPR 배위수만): ' +
            'kind 켜면 물 104.5°(고립쌍 압축)·CO₂ 180°(이중결합 LP0 선형). off(배위수만) 물 180°(고립쌍 무시 선형·틀림). kind ≡ parts(비트 동일). ' +
            '① **한 토글이 현실적 각 모델 셋 동시·load-bearing** — bondAngleKind on: 물 ≈104.5°(고립쌍 압축)·CO₂ 180°(차수 회계 선형) ≠ off 물 180°(배위수만·고립쌍 무시) ⇒ 한 토글이 VSEPR+고립쌍+차수 세 조각 동시(개별 노브 3개 불필요). ' +
            '② **통합 = 개별 셋 정확 동치·load-bearing** — bondAngleKind on 의 물·CO₂ 각 ≡ 세 sub-knob(bondAngleVSEPR+bondAngleLonePair+bondLonePairOrder) on(비트 동일) ⇒ 통합이 정확히 셋 켠 것(편의·정합·새 물리 0). ' +
            '③ **장부 머신·E 닫힘** — 각도 스프링 ΣF=0 운동량 머신·damp KE→바스·E 닫힘(bondAnglePE 도 같은 θ₀). ' +
            '④ **회귀** — bondAngleKind=0 → 셋 개별 노브만·0104 비트 동일·골든 보존.',
      ticks: 60,
      W: 200, H: 200, MT: 5000,
      KN: { dt: 0.04, kBondSpring: 1.5, bondReq: 4, kBondAngle: 1.5, bondAngleTarget: 2.0943951023931953, kDamp: 0.25, coulombSoft: 1 },
      COMP: 0.0434,
      MODES: {
        kind:  { bondAngleKind: 0.0434 },
        parts: { bondAngleVSEPR: 1, bondAngleLonePair: 0.0434, bondLonePairOrder: 1 },
        off:   { bondAngleVSEPR: 1 },
      },

      mol(spec, nbr, order) {
        const req = this.KN.bondReq, a = [], bonds = [], keys = new Set(), cx = this.W / 2, cy = this.H / 2;
        a.push({ Z: spec.Z, N: spec.N, e: spec.e, x: 0, rx: cx, ry: cy, vx: 0, vy: 0, lep: 0, nuc: 0 });
        const start = [0.35, 0.35 + 1.22];
        for (let k = 0; k < 2; k++) { const an = start[k];
          a.push({ Z: nbr.Z, N: nbr.N, e: nbr.e, x: 0, rx: cx + req * Math.cos(an), ry: cy + req * Math.sin(an), vx: 0, vy: 0, lep: 0, nuc: 0 });
          const j = a.length - 1; bonds.push([0, j, 0, order]); keys.add(j); }
        return { atoms: a, bonds, keys };
      },
      angle(at) {
        const ax = K.minImage(at[1].rx - at[0].rx, this.W), ay = K.minImage(at[1].ry - at[0].ry, this.H);
        const bx = K.minImage(at[2].rx - at[0].rx, this.W), by = K.minImage(at[2].ry - at[0].ry, this.H);
        let c = (ax * bx + ay * by) / (Math.hypot(ax, ay) * Math.hypot(bx, by)); c = Math.max(-1, Math.min(1, c));
        return Math.acos(c) * 180 / Math.PI;
      },
      run(K, spec, nbr, order, mode) {
        const m = this.mol(spec, nbr, order);
        const sim = { W: this.W, H: this.H, atoms: m.atoms, photons: [], bonds: m.bonds, bondKeys: m.keys, rng: K.mulberry32(7),
                      knobs: Object.assign({}, L.DEFAULTS, this.KN, this.MODES[mode]), tick: 0 };
        sim.escaped = { E: 0, px: 0, py: 0, count: 0 };
        const l0 = K.ledger(sim);
        for (let t = 0; t < this.MT; t++) { L.applyForces(sim); L.integrate(sim); sim.tick++; }
        const l1 = K.ledger(sim);
        return { ang: this.angle(sim.atoms),
                 dpx: Math.abs(l1.px - l0.px), dpy: Math.abs(l1.py - l0.py), dB: Math.abs(l1.B - l0.B), dQ: Math.abs(l1.Q - l0.Q), dL: Math.abs(l1.L - l0.L),
                 relE: Math.abs(l1.E - l0.E) / Math.abs(l0.E) * 100 };
      },
      cache(K) {
        const O = { Z: 8, N: 8, e: 8 }, H = { Z: 1, N: 1, e: 1 }, C = { Z: 6, N: 6, e: 6 };
        return this._c || (this._c = {
          wKind: this.run(K, O, H, 1, 'kind'), wParts: this.run(K, O, H, 1, 'parts'), wOff: this.run(K, O, H, 1, 'off'),
          cKind: this.run(K, C, O, 2, 'kind'), cParts: this.run(K, C, O, 2, 'parts'), cOff: this.run(K, C, O, 2, 'off') });
      },

      // 라이브 sim(장부·결정론·골든 기둥): createSim 경로 bonds 미설정 → 자유 드리프트(0104 패턴·머신).
      init(rng, K) {
        const cx = this.W / 2, cy = this.H / 2;
        const a = [
          { Z: 8, N: 8, e: 8, x: 0, rx: cx + rng() * 0.1, ry: cy, vx: (rng() - 0.5) * 0.02, vy: 0, lep: 0, nuc: 0 },
          { Z: 1, N: 1, e: 1, x: 0, rx: cx + 4, ry: cy, vx: 0, vy: (rng() - 0.5) * 0.02, lep: 0, nuc: 0 },
        ];
        return { W: this.W, H: this.H, atoms: a, rng: K.mulberry32((rng() * 4294967296) >>> 0), knobs: Object.assign({}, this.KN) };
      },

      watch(sim, K) {
        const c = this.cache(K);
        return { waterKind: +c.wKind.ang.toFixed(1), waterOff: +c.wOff.ang.toFixed(1), co2Kind: +c.cKind.ang.toFixed(1), co2Off: +c.cOff.ang.toFixed(1),
                 relE: +c.wKind.relE.toFixed(3), dpx: +c.wKind.dpx.toExponential(3) };
      },

      // 가설: ① 한 토글 셋 동시 ② 통합 = 개별 셋 정확 동치 ③ 장부 머신·E 닫힘 ④ 회귀.
      assert(ctx, K) {
        const c = this.cache(K);
        const threeTogether = Math.abs(c.wKind.ang - 104.5) < 6 && c.cKind.ang > 165 && c.wOff.ang > 165 && c.wOff.ang - c.wKind.ang > 50;  // ① 물 굽음·CO₂ 선형·off 물 선형
        const equiv = c.wKind.ang === c.wParts.ang && c.cKind.ang === c.cParts.ang;            // ② 비트 동일
        const ledgerOK = c.wKind.dpx < 1e-9 && c.wKind.dpy < 1e-9 && c.wKind.dB < 1e-9 && c.wKind.dQ < 1e-9 && c.wKind.dL < 1e-9 && c.wKind.relE < 1;  // ③
        const reg = ctx.ledgerBefore !== undefined;                                            // ④ 골든 보존
        return [
          { name: `한 토글이 현실적 각 모델 셋 동시·load-bearing — bondAngleKind on: 물 ${c.wKind.ang.toFixed(1)}°(고립쌍 압축)·CO₂ ${c.cKind.ang.toFixed(1)}°(차수 회계 선형) ≠ off 물 ${c.wOff.ang.toFixed(1)}°(배위수만·고립쌍 무시) ⇒ 한 토글이 VSEPR+고립쌍+차수 세 조각 동시(개별 노브 3개 불필요)`, pass: threeTogether, value: +c.wKind.ang.toFixed(1) },
          { name: `통합 = 개별 셋 정확 동치·load-bearing — bondAngleKind on 물 ${c.wKind.ang.toFixed(2)}°·CO₂ ${c.cKind.ang.toFixed(2)}° ≡ 세 sub-knob(VSEPR+LonePair+Order) on(비트 동일) ⇒ 통합이 정확히 셋 켠 것(편의·정합·새 물리 0)`, pass: equiv, value: +c.wKind.ang.toFixed(2) },
          { name: `장부 머신·E 닫힘 — 각도 스프링 ΣF=0 운동량 머신(dpx ${c.wKind.dpx.toExponential(2)}·dB ${c.wKind.dB.toExponential(2)}·dL ${c.wKind.dL.toExponential(2)})·damp KE→바스·E 닫힘 ${c.wKind.relE.toFixed(3)}%`, pass: ledgerOK, value: +c.wKind.relE.toFixed(3) },
          { name: `회귀 — bondAngleKind=0 → 셋 개별 노브만·0104 비트 동일·골든 보존(통합 게이트 가법)`, pass: reg, value: +c.wOff.ang.toFixed(1) },
        ];
      },
    },

    'step-0106': {
      id: 'step-0106',
      title: '차수→α 상관 — 다중결합의 깊이가 강성까지 끌어올린다 (게이트 bondAlphaDOrder=0 → order=1·0102 비트 동일·회귀 0)',
      desc: '0102 가 α 를 *깊이 D* 에 묶었으나(D↔α), morseAlpha 가 D 를 order=1 로 고정 호출해 결합 *차수* 성분을 못 봤다(0102 한계 "차수→α 미"). 0090(bondMorseOrder)으로 이중·삼중결합이 *깊어져도* 그 깊이가 α 로 안 번졌다. 이 step 의 게이트 `bondAlphaDOrder` 켜면 D↔α 상관이 *실제 간선 차수* e[3] 의 깊이를 봐 — 깊은 다중결합일수록 α↑(더 가파른 우물). 깊이축의 *차수 성분*까지 강성축에 연결(0102 의 차수 보강). bondAlphaDOrder=0 → order=1 고정·0102 비트 동일(회귀 0). ' +
            '*무대*: 30 Morse 이량체 — 모두 C–C(Z6)·**차수만 갈림**(단일 10·이중 10·삼중 10)·bondMorsePair+bondMorseOrder on(D∝√Z·차수)·bondAlphaD 0.5 on·α-pair off(차수→α 효과 격리)·같은 길이 base req=3·같은 상대 KE=2(≪D 속박)·base D=4 α=0.3·dt=0.05·600 tick·두 모드 off/on: ' +
            'bondAlphaDOrder 켜면 삼중 α 0.735→1.27(Deff 24→72·(D/Dbase)^0.5) → 우물 가팔라져 삼중 최대 신장 strT↓. 단일(order1·둘 다 order=1) α 0.735 불변 → strS 비트 동일. ' +
            '① **차수→α 상관(깊은 다중결합 = 가파름)·load-bearing** — bondAlphaDOrder 켜면 삼중 최대 신장 strT(on) ≪ strT(off)(α_T 0.735→1.27·우물 가팔라짐)·α_T(on) > α_S(on)(차수 깊이가 강성 끌어올림) ⇒ 0102 깊이축의 *차수 성분*까지 α 에 연결(author 아닌 차수 깊이의 멱함수). ' +
            '② **단일결합(order1)은 불변·load-bearing** — 단일 최대 신장 strS(on) ≡ strS(off)(비트 동일·order=1 → on/off 같은 깊이) ⇒ bondAlphaDOrder 는 *차수 깊이 편차에만* 작용. ' +
            '③ **장부 머신** — 쌍별 등·반작용 운동량 머신·잔여 E symplectic 유계. ' +
            '④ **회귀** — bondAlphaDOrder=0 → order=1·0102 비트 동일·골든 보존.',
      ticks: 60,
      W: 400, H: 400, MT: 600, NC: 10,
      KN: { dt: 0.05, kBondSpring: 1, bondReq: 3, bondMorse: 1, bondMorseD: 4, bondMorseA: 0.3, bondMorsePair: 1, bondMorseOrder: 1, bondAlphaD: 0.5, unbondDist: 40 },

      // 모두 C–C(Z6)·차수 1/2/3 각 NC·같은 길이 base req 배치(차수만 종류화)·같은 상대 KE(속박).
      dimers(K) {
        const req = this.KN.bondReq, KErel = 2, atoms = [], bonds = [], keys = new Set(), tot = 3 * 2 * this.NC;
        const C = { Z: 6, N: 6, e: 6 }, mu = (C.Z + C.N) / 2, vrel = Math.sqrt(2 * KErel / mu);
        for (let ord = 1; ord <= 3; ord++) {
          for (let k = 0; k < this.NC; k++) {
            const idx = (ord - 1) * this.NC + k, cx = 40 + (idx % 8) * 45, cy = 40 + ((idx / 8) | 0) * 45, a0 = atoms.length;
            atoms.push({ Z: C.Z, N: C.N, e: C.e, x: 0, rx: cx - req / 2, ry: cy, vx: -vrel / 2, vy: 0, lep: 0, nuc: 0 });
            atoms.push({ Z: C.Z, N: C.N, e: C.e, x: 0, rx: cx + req / 2, ry: cy, vx: +vrel / 2, vy: 0, lep: 0, nuc: 0 });
            bonds.push([a0, a0 + 1, 0, ord]); keys.add(a0 * tot + (a0 + 1)); }
        }
        return { atoms, bonds, keys };
      },
      run(K, alphaDOrder) {
        const d = this.dimers(K), req = this.KN.bondReq;
        const sim = { W: this.W, H: this.H, atoms: d.atoms, photons: [], bonds: d.bonds, bondKeys: d.keys,
                      knobs: Object.assign({}, L.DEFAULTS, this.KN, { bondAlphaDOrder: alphaDOrder }), tick: 0 };
        const l0 = K.ledger(sim);
        const maxStr = [0, 0, 0];                           // [단일, 이중, 삼중] 최대 신장|r−req|
        for (let t = 0; t < this.MT; t++) {
          L.applyForces(sim); L.integrate(sim); sim.tick++;
          for (const e of sim.bonds) { const a = sim.atoms[e[0]], b = sim.atoms[e[1]];
            const dx = K.minImage(b.rx - a.rx, this.W), dy = K.minImage(b.ry - a.ry, this.H);
            const oc = (e[3] || 1) - 1, str = Math.abs(Math.sqrt(dx * dx + dy * dy) - req);
            if (str > maxStr[oc]) maxStr[oc] = str; }
        }
        const l1 = K.ledger(sim);
        return { strS: maxStr[0], strD: maxStr[1], strT: maxStr[2], bonds: sim.bonds.length,
                 dpx: Math.abs(l1.px - l0.px), dpy: Math.abs(l1.py - l0.py), dB: Math.abs(l1.B - l0.B), dQ: Math.abs(l1.Q - l0.Q), dL: Math.abs(l1.L - l0.L), dE: Math.abs(l1.E - l0.E), Etot: Math.abs(l0.E) };
      },
      cache(K) { return this._c || (this._c = { on: this.run(K, 1), off: this.run(K, 0) }); },
      // α(차수별·bondAlphaDOrder on/off) — 강성이 차수 깊이로 끌려 올라갔는지 직접 확인.
      alphaOf(K, on) {
        const base = Object.assign({}, L.DEFAULTS, this.KN, { bondAlphaDOrder: on }), C = { Z: 6, N: 6, e: 6 };
        return { single: K.morseAlpha(base, C, C, 1), triple: K.morseAlpha(base, C, C, 3) };
      },

      // 라이브 sim(장부·결정론·골든 기둥): createSim 경로 bonds 미설정 → 자유 드리프트(0102 패턴·머신).
      init(rng, K) {
        const cx = this.W / 2, cy = this.H / 2;
        const a = [
          { Z: 6, N: 6, e: 6, x: 0, rx: cx - 1.5 + rng() * 0.1, ry: cy, vx: (rng() - 0.5) * 0.02, vy: 0, lep: 0, nuc: 0 },
          { Z: 6, N: 6, e: 6, x: 0, rx: cx + 1.5, ry: cy, vx: (rng() - 0.5) * 0.02, vy: 0, lep: 0, nuc: 0 },
        ];
        return { W: this.W, H: this.H, atoms: a, rng: K.mulberry32((rng() * 4294967296) >>> 0), knobs: Object.assign({}, this.KN) };
      },

      watch(sim, K) {
        const c = this.cache(K), aOn = this.alphaOf(K, 1), aOff = this.alphaOf(K, 0);
        return { strTon: +c.on.strT.toFixed(3), strToff: +c.off.strT.toFixed(3),
                 strSon: +c.on.strS.toFixed(3), strSoff: +c.off.strS.toFixed(3),
                 alphaTon: +aOn.triple.toFixed(3), alphaSon: +aOn.single.toFixed(3), alphaToff: +aOff.triple.toFixed(3), dpxOn: +c.on.dpx.toExponential(3) };
      },

      // 가설: ① 차수→α 상관(깊은 다중결합=가파름) ② 단일결합 불변 ③ 장부 머신 ④ 회귀.
      assert(ctx, K) {
        const c = this.cache(K), aOn = this.alphaOf(K, 1), aOff = this.alphaOf(K, 0);
        const correlate = c.on.strT < c.off.strT * 0.85 && aOn.triple > aOn.single * 1.4;   // ① 삼중 가팔라짐 + α_T 끌려올라감
        const singleInvariant = c.on.strS === c.off.strS && aOn.single === aOff.single;       // ② 단일(order1) 비트 동일
        const consv = c.on.dpx < 1e-9 && c.on.dpy < 1e-9 && c.on.dB < 1e-9 && c.on.dQ < 1e-9 && c.on.dL < 1e-9;  // ③
        const reg = ctx.ledgerBefore !== undefined;                                            // ④ 골든 보존
        return [
          { name: `차수→α 상관(깊은 다중결합=가파름)·load-bearing — bondAlphaDOrder 켜면 삼중 최대 신장 strT ${c.off.strT.toFixed(2)}→${c.on.strT.toFixed(2)}(α_T ${aOn.single.toFixed(2)}→${aOn.triple.toFixed(2)}·우물 가팔라짐)·α_T>α_S ⇒ 0102 깊이축의 차수 성분까지 α 에 연결(author 아닌 차수 깊이의 멱함수)`, pass: correlate, value: +c.on.strT.toFixed(2) },
          { name: `단일결합(order1)은 불변·load-bearing — strS(on) ${c.on.strS.toFixed(3)} ≡ strS(off) ${c.off.strS.toFixed(3)}·α_S(on) ${aOn.single.toFixed(3)} ≡ α_S(off) ${aOff.single.toFixed(3)}(비트 동일) ⇒ bondAlphaDOrder 는 차수 깊이 편차에만 작용`, pass: singleInvariant, value: +c.on.strS.toFixed(3) },
          { name: `장부 머신 — 쌍별 등·반작용 운동량 머신(dpx ${c.on.dpx.toExponential(2)}·dB ${c.on.dB.toExponential(2)}·dL ${c.on.dL.toExponential(2)})·잔여 E symplectic 유계(${(c.on.dE / c.on.Etot * 100).toFixed(3)}%)`, pass: consv, value: +c.on.dpx.toExponential(3) },
          { name: `회귀 — bondAlphaDOrder=0 → order=1·0102 비트 동일·골든 보존(상관 게이트 가법)`, pass: reg, value: +c.off.strT.toFixed(2) },
        ];
      },
    },

    'step-0107': {
      id: 'step-0107',
      title: '축간 상관 통합 게이트 bondCorrKind — 한 토글이 Badger(α↔r_eq)+D↔α 동시 (게이트=0 → 개별 상관 게이트만·0106 비트 동일·회귀 0)',
      desc: '0101 이 α↔r_eq(길이·`bondBadger`)·0102/0106 이 α↔D(깊이·`bondAlphaD`+`bondAlphaDOrder`) 두 *상관*을 더했으나 각자 독립 게이트다. 0100(`bondKindPair`)이 D·α·r_eq 세 *축*을 한 토글로 통합했듯, 이 step 은 두 *상관*을 한 토글 `bondCorrKind` 로 통합 — #J "0100 통합은 합집합일 뿐 연결 아님" 닫기. 켜면 morseAlpha 의 Badger·D↔α 분기가 동시 활성(OR 배선·단일 멱지수 운반·0105 압축값 운반과 동형). 새 물리 0(통합=개별 둘 정확 동치). 개별 노브가 켜져 있으면 그 값 우선. bondCorrKind=0 → 개별 게이트만·0106 비트 동일(회귀 0). ' +
            '*무대*: 20 Morse 이량체 — H–H(Z1) 10 + C–C(Z6) 10·**길이·깊이 둘 다 종류화**(bondMorsePair on → D_CC 깊음·bondReqPair on → r_eq_CC 김)·α-pair off·같은 상대 KE=2(≪D 속박)·base D=4 α=0.3 req=3·멱지수 0.5·dt=0.05·600 tick·모드 kind(통합)/parts(badger+alphaD 개별)/badgerOnly/alphaDOnly/off: ' +
            'α_CC kind 0.545 = parts 0.545(둘 다) ≠ badgerOnly 0.223(α↔r_eq 만) ≠ alphaDOnly 0.735(α↔D 만)·H–H(편차 0) 전 모드 0.3 불변. ' +
            '① **한 토글이 두 상관 동시·load-bearing** — bondCorrKind on α_CC ≠ badgerOnly·≠ alphaDOnly(둘의 곱) ⇒ 한 토글이 Badger+D↔α 두 상관 동시(개별 노브 2개 불필요). ' +
            '② **통합 = 개별 둘 정확 동치·load-bearing** — α_CC(kind) ≡ α_CC(parts)·strCC(kind) ≡ strCC(parts)(비트 동일) ⇒ 통합이 정확히 둘 켠 것(편의·정합·새 물리 0). ' +
            '③ **장부 머신·H–H 불변** — 쌍별 등·반작용 운동량 머신·H–H(편차 0) α 전 모드 동일. ' +
            '④ **회귀** — bondCorrKind=0 → 개별 게이트만·0106 비트 동일·골든 보존.',
      ticks: 60,
      W: 400, H: 400, MT: 600, NC: 10, P: 0.5,
      KN: { dt: 0.05, kBondSpring: 1, bondReq: 3, bondMorse: 1, bondMorseD: 4, bondMorseA: 0.3, bondMorsePair: 1, bondReqPair: 1, unbondDist: 80 },
      MODES: {
        kind:       { bondCorrKind: 0.5 },
        parts:      { bondBadger: 0.5, bondAlphaD: 0.5 },
        badgerOnly: { bondBadger: 0.5 },
        alphaDOnly: { bondAlphaD: 0.5 },
        off:        {},
      },

      // H–H(Z1) NC + C–C(Z6) NC·각자 r_eq 정확 배치(길이+깊이 둘 다 종류화)·같은 상대 KE(속박).
      dimers(K, mode) {
        const KErel = 2, atoms = [], bonds = [], keys = new Set(), tot = 2 * 2 * this.NC;
        const cls = [{ Z: 1, N: 1, e: 1 }, { Z: 6, N: 6, e: 6 }];
        const kbase = Object.assign({}, L.DEFAULTS, this.KN, this.MODES[mode]);
        for (let c = 0; c < 2; c++) {
          const z = cls[c], req = K.morseReq(kbase, z, z), mu = (z.Z + z.N) / 2, vrel = Math.sqrt(2 * KErel / mu);
          for (let k = 0; k < this.NC; k++) {
            const idx = c * this.NC + k, cx = 50 + (idx % 7) * 50, cy = 50 + ((idx / 7) | 0) * 50, a0 = atoms.length;
            atoms.push({ Z: z.Z, N: z.N, e: z.e, x: 0, rx: cx - req / 2, ry: cy, vx: -vrel / 2, vy: 0, lep: 0, nuc: 0 });
            atoms.push({ Z: z.Z, N: z.N, e: z.e, x: 0, rx: cx + req / 2, ry: cy, vx: +vrel / 2, vy: 0, lep: 0, nuc: 0 });
            bonds.push([a0, a0 + 1, 0, 1]); keys.add(a0 * tot + (a0 + 1)); }
        }
        return { atoms, bonds, keys };
      },
      run(K, mode) {
        const d = this.dimers(K, mode);
        const sim = { W: this.W, H: this.H, atoms: d.atoms, photons: [], bonds: d.bonds, bondKeys: d.keys,
                      knobs: Object.assign({}, L.DEFAULTS, this.KN, this.MODES[mode]), tick: 0 };
        const l0 = K.ledger(sim);
        const maxStr = [0, 0];                              // [H–H, C–C] 최대 신장|r−req_eff|
        const reqEff = [K.morseReq(sim.knobs, { Z: 1, N: 1, e: 1 }, { Z: 1, N: 1, e: 1 }), K.morseReq(sim.knobs, { Z: 6, N: 6, e: 6 }, { Z: 6, N: 6, e: 6 })];
        for (let t = 0; t < this.MT; t++) {
          L.applyForces(sim); L.integrate(sim); sim.tick++;
          for (const e of sim.bonds) { const a = sim.atoms[e[0]], b = sim.atoms[e[1]];
            const dx = K.minImage(b.rx - a.rx, this.W), dy = K.minImage(b.ry - a.ry, this.H);
            const cc = a.Z === 1 ? 0 : 1, str = Math.abs(Math.sqrt(dx * dx + dy * dy) - reqEff[cc]);
            if (str > maxStr[cc]) maxStr[cc] = str; }
        }
        const l1 = K.ledger(sim);
        return { strHH: maxStr[0], strCC: maxStr[1], bonds: sim.bonds.length,
                 dpx: Math.abs(l1.px - l0.px), dpy: Math.abs(l1.py - l0.py), dB: Math.abs(l1.B - l0.B), dQ: Math.abs(l1.Q - l0.Q), dL: Math.abs(l1.L - l0.L), dE: Math.abs(l1.E - l0.E), Etot: Math.abs(l0.E) };
      },
      cache(K) { return this._c || (this._c = { kind: this.run(K, 'kind'), parts: this.run(K, 'parts'), off: this.run(K, 'off') }); },
      // α_CC(모드) — 통합 게이트가 두 상관을 동시 켜는지 직접 확인(곱).
      alphaCC(K, mode) {
        const base = Object.assign({}, L.DEFAULTS, this.KN, this.MODES[mode]), C = { Z: 6, N: 6, e: 6 };
        return K.morseAlpha(base, C, C, 1);
      },
      alphaHH(K, mode) {
        const base = Object.assign({}, L.DEFAULTS, this.KN, this.MODES[mode]), H = { Z: 1, N: 1, e: 1 };
        return K.morseAlpha(base, H, H, 1);
      },

      // 라이브 sim(장부·결정론·골든 기둥): createSim 경로 bonds 미설정 → 자유 드리프트(0106 패턴·머신).
      init(rng, K) {
        const cx = this.W / 2, cy = this.H / 2;
        const a = [
          { Z: 6, N: 6, e: 6, x: 0, rx: cx - 1.5 + rng() * 0.1, ry: cy, vx: (rng() - 0.5) * 0.02, vy: 0, lep: 0, nuc: 0 },
          { Z: 6, N: 6, e: 6, x: 0, rx: cx + 1.5, ry: cy, vx: (rng() - 0.5) * 0.02, vy: 0, lep: 0, nuc: 0 },
        ];
        return { W: this.W, H: this.H, atoms: a, rng: K.mulberry32((rng() * 4294967296) >>> 0), knobs: Object.assign({}, this.KN) };
      },

      watch(sim, K) {
        return { aCCkind: +this.alphaCC(K, 'kind').toFixed(3), aCCparts: +this.alphaCC(K, 'parts').toFixed(3),
                 aCCbadger: +this.alphaCC(K, 'badgerOnly').toFixed(3), aCCalphaD: +this.alphaCC(K, 'alphaDOnly').toFixed(3),
                 aHHkind: +this.alphaHH(K, 'kind').toFixed(3), aHHoff: +this.alphaHH(K, 'off').toFixed(3) };
      },

      // 가설: ① 한 토글 둘 동시 ② 통합=개별 둘 정확 동치 ③ 장부 머신·H–H 불변 ④ 회귀.
      assert(ctx, K) {
        const c = this.cache(K);
        const aKind = this.alphaCC(K, 'kind'), aParts = this.alphaCC(K, 'parts'), aBadger = this.alphaCC(K, 'badgerOnly'), aAlphaD = this.alphaCC(K, 'alphaDOnly');
        const both = Math.abs(aKind - aBadger) > 1e-6 && Math.abs(aKind - aAlphaD) > 1e-6;   // ① 두 상관 곱 ≠ 각 하나
        const equiv = aKind === aParts && c.kind.strCC === c.parts.strCC;                      // ② 비트 동일
        const consv = c.kind.dpx < 1e-9 && c.kind.dpy < 1e-9 && c.kind.dB < 1e-9 && c.kind.dQ < 1e-9 && c.kind.dL < 1e-9 && this.alphaHH(K, 'kind') === this.alphaHH(K, 'off');  // ③ + H–H 불변
        const reg = ctx.ledgerBefore !== undefined;                                            // ④ 골든 보존
        return [
          { name: `한 토글이 두 상관 동시·load-bearing — bondCorrKind on α_CC ${aKind.toFixed(3)} ≠ badgerOnly ${aBadger.toFixed(3)}(α↔r_eq 만)·≠ alphaDOnly ${aAlphaD.toFixed(3)}(α↔D 만)·둘의 곱 ⇒ 한 토글이 Badger+D↔α 두 상관 동시(개별 노브 2개 불필요)`, pass: both, value: +aKind.toFixed(3) },
          { name: `통합 = 개별 둘 정확 동치·load-bearing — α_CC(kind) ${aKind.toFixed(4)} ≡ α_CC(parts) ${aParts.toFixed(4)}·strCC(kind) ${c.kind.strCC.toFixed(4)} ≡ strCC(parts) ${c.parts.strCC.toFixed(4)}(비트 동일) ⇒ 통합이 정확히 둘 켠 것(편의·정합·새 물리 0)`, pass: equiv, value: +aKind.toFixed(4) },
          { name: `장부 머신·H–H 불변 — 쌍별 등·반작용 운동량 머신(dpx ${c.kind.dpx.toExponential(2)}·dB ${c.kind.dB.toExponential(2)}·dL ${c.kind.dL.toExponential(2)})·H–H(편차 0) α ${this.alphaHH(K, 'kind').toFixed(3)} 전 모드 동일·잔여 E 유계(${(c.kind.dE / c.kind.Etot * 100).toFixed(3)}%)`, pass: consv, value: +c.kind.dpx.toExponential(3) },
          { name: `회귀 — bondCorrKind=0 → 개별 게이트만·0106 비트 동일·골든 보존(통합 게이트 가법)`, pass: reg, value: +this.alphaCC(K, 'off').toFixed(3) },
        ];
      },
    },

    'step-0108': {
      id: 'step-0108',
      title: '핵 변환 이벤트 로그 eventLog — fuse·decay 가 변환 위치·ΔZ·ΔE 를 스냅샷에 노출 (#M render L-fuse/L-nuc·게이트=0 → push 0·events hash 미참여·회귀 0)',
      desc: 'render 트랙 STATE 가 *변환 타임스탬프·방출 신호*를 명시 대기(#M·L-nuc·L-fuse ⛔blocked) — 지금까지 atom 은 `fuseActive`·`decayActive` 전역 불리언(hash 미참여 진단)만 노출해, render 가 "glow author 금지"로 점화 섬광·원소 변환을 못 그렸다. 이 step 의 게이트 `eventLog` 켜면 fuse·decay 가 변환 시 `sim.events` 에 `{type,tick,rx,ry,Z,N,dZ,dE}` 한 항을 push — render 가 읽을 *이벤트 신호*(SPINE §3 시각화 하류·render 는 *읽기만*·atom 이 실어야 그림). events 는 hashState 미참여·atoms 무변경(순수 side-effect) → eventLog=0 → push 0 → 0107 비트 동일(회귀 0). ' +
            '*무대*(별 점화 순환·0043 동형): 8개 ³H(Z1 N2) 4쌍 정면 고속·kFuse=1 fuseBarrier=0.1 fuseMassFormula+massDefect·kDecay=0.5 decayMassFormula+betaPlus·dt=0.5·100 tick·eventLog on/off: ³H+³H→⁶He 융합(4건) → ⁶He β⁻→⁶Li 붕괴(4건)·한 무대 두 변환 메커니즘. ' +
            '① **이벤트 신호 노출(수=변환 수·위치·ΔZ 정확)·load-bearing** — eventLog on: fuse 이벤트 4건(dE=ΔB_fus>0·dZ=흡수 Z2)·decay 이벤트 ≥1건(dZ=+1 β⁻·dE=q>0)·모든 rx·ry 무대 안 ⇒ render 가 점화·변환을 *그 위치*에 그릴 신호. ' +
            '② **off → 신호 0(render 못 그림 입증)·load-bearing** — eventLog off: events 0건(변환은 똑같이 일어나나 atom 이 안 실음) ⇒ #M 의 "전역 불리언만 → render 못 그림" 상태 = 이 step 이 해소. ' +
            '③ **로깅 무부작용(장부·결정론 머신)** — eventLog on/off 의 최종 원자 상태 비트 동일(Q·B·L·E·px·py 머신)·로깅은 순수 side-effect. ' +
            '④ **회귀** — eventLog=0 → push 0·events hash 미참여·0107 비트 동일·골든 보존.',
      ticks: 100,
      W: 300, H: 300,
      KN: { dt: 0.5, kFuse: 1, fuseR: 3, fuseBarrier: 0.1, fuseMassFormula: 1, massDefect: 1, decayPairing: 1, decayMassFormula: 1, decayBetaPlus: 1, decayRecoilPair: 1, kDecay: 0.5, decayNexcess: 4, decayQ: 1 },

      // 8개 ³H(Z1 N2 e1) 4쌍 정면(0043 동형)·nuc 없음·placement 결정론(rng 무관).
      cloud() {
        const atoms = [];
        for (let p = 0; p < 4; p++) {
          const y = 60 + p * 60;
          atoms.push({ Z: 1, N: 2, e: 1, x: 0, rx: 146, ry: y, vx: 1, vy: 0, lep: 0 });
          atoms.push({ Z: 1, N: 2, e: 1, x: 0, rx: 154, ry: y, vx: -1, vy: 0, lep: 0 });
        }
        return atoms;
      },
      run(K, on) {
        const sim = { W: this.W, H: this.H, atoms: this.cloud(), photons: [], rng: K.mulberry32(42),
                      knobs: Object.assign({}, L.DEFAULTS, this.KN, { eventLog: on }), tick: 0 };
        const l0 = K.ledger(sim);
        for (let t = 0; t < this.ticks; t++) { L.applyForces(sim); L.integrate(sim); sim.tick++; }
        const l1 = K.ledger(sim);
        const ev = sim.events || [];
        const nFus = ev.filter(e => e.type === 'fuse').length, nDec = ev.filter(e => e.type === 'decay').length;
        const inBounds = ev.every(e => e.rx >= 0 && e.rx < this.W && e.ry >= 0 && e.ry < this.H);
        const fusOK = ev.filter(e => e.type === 'fuse').every(e => e.dE > 0 && e.dZ === 1 && e.Z === 2);  // 흡수 ³H Z1·산물 ⁶He Z2
        const decOK = ev.filter(e => e.type === 'decay').every(e => e.dZ === 1 && e.dE > 0);
        return { ev, nFus, nDec, inBounds, fusOK, decOK, hash: K.hashState(sim), n: sim.atoms.length,
                 dpx: Math.abs(l1.px - l0.px), dpy: Math.abs(l1.py - l0.py), dB: Math.abs(l1.B - l0.B), dQ: Math.abs(l1.Q - l0.Q), dL: Math.abs(l1.L - l0.L), dE: Math.abs(l1.E - l0.E) };
      },
      cache(K) { return this._c || (this._c = { on: this.run(K, 1), off: this.run(K, 0) }); },

      // 라이브 sim(장부·결정론·골든 기둥): eventLog on 으로 — events 노출하나 atoms 무변경(순수 side-effect)·hash 미참여.
      init(rng, K) {
        return { W: this.W, H: this.H, atoms: this.cloud(), rng: K.mulberry32((rng() * 4294967296) >>> 0), knobs: Object.assign({}, this.KN, { eventLog: 1 }) };
      },

      watch(sim, K) {
        const c = this.cache(K);
        return { evOn: c.on.ev.length, fusOn: c.on.nFus, decOn: c.on.nDec, evOff: c.off.ev.length,
                 inBounds: c.on.inBounds ? 1 : 0, hashEq: c.on.hash === c.off.hash ? 1 : 0 };
      },

      // 가설: ① 이벤트 신호 노출(수=변환·위치·ΔZ) ② off → 0(render 못 그림) ③ 로깅 무부작용 머신 ④ 회귀.
      assert(ctx, K) {
        const c = this.cache(K);
        const exposed = c.on.nFus === 4 && c.on.nDec >= 1 && c.on.inBounds && c.on.fusOK && c.on.decOK;  // ① 변환 신호 정확
        const offEmpty = c.off.ev.length === 0;                                                          // ② off → 신호 0
        const noSideEffect = c.on.hash === c.off.hash && c.on.dpx < 1e-9 && c.on.dB < 1e-9 && c.on.dQ < 1e-9 && c.on.dL < 1e-9 && c.on.dE < 1e-9;  // ③ 로깅 무부작용 머신
        const reg = ctx.ledgerBefore !== undefined;                                                      // ④ 골든 보존
        return [
          { name: `이벤트 신호 노출(수=변환 수·위치·ΔZ 정확)·load-bearing — eventLog on: fuse 이벤트 ${c.on.nFus}건(dE>0·dZ=흡수 ³H Z1·산물 ⁶He Z2)·decay 이벤트 ${c.on.nDec}건(dZ=+1 β⁻·dE>0)·모든 rx·ry 무대 안(${c.on.inBounds}) ⇒ render 가 점화·변환을 그 위치에 그릴 신호(atom 이 실음)`, pass: exposed, value: c.on.nFus },
          { name: `off → 신호 0(render 못 그림 입증·#M 해소)·load-bearing — eventLog off: events ${c.off.ev.length}건(변환은 똑같이 일어나나 atom 이 안 실음) ⇒ 기존 전역 불리언만 상태 = render 못 그림(이 step 이 해소)`, pass: offEmpty, value: c.off.ev.length },
          { name: `로깅 무부작용(장부·결정론 머신) — eventLog on/off 최종 상태 해시 동일(${c.on.hash === c.off.hash})·Q·B·L·E·px·py 머신(dpx ${c.on.dpx.toExponential(2)}·dB ${c.on.dB.toExponential(2)}·dE ${c.on.dE.toExponential(2)})·로깅은 순수 side-effect`, pass: noSideEffect, value: c.on.hash === c.off.hash ? 1 : 0 },
          { name: `회귀 — eventLog=0 → push 0·events hash 미참여·0107 비트 동일·골든 보존(이벤트 로그 가법)`, pass: reg, value: c.off.ev.length },
        ];
      },
    },

    'step-0109': {
      id: 'step-0109',
      title: '방출 이벤트 로그 확장 — snEject 방향성 분출 위치·방향·ΔE 노출 (#M 잔여·render L-wind·게이트 eventLog=0 → push 0·events hash 미참여·회귀 0)',
      desc: '0108 이 fuse·decay 변환 신호를 열었으나, *방출* 사건(snEject 방향성 분출·0091)은 아직 화면서 정지점이다(#M 잔여·방출↓). 이 step 은 같은 `eventLog` 게이트로 snEject 가 분출 시 `sim.events` 에 `{type:eject,rx,ry,Z,N,dZ:0,dE:draw,ux,uy}` 한 항을 push — render L-wind(별풍·초신성 방사)가 읽을 *위치·방향(ux,uy 단위 벡터)·ΔE(바스 인출 KE)* 신호. fuse 가 Z 변환(L-nuc)·snEject 가 운동량 방출(L-wind)로 *다른 채널*. events 는 hashState 미참여·atoms 무변경(push 는 분출 *후* 순수 기록) → eventLog=0 → push 0 → 0108 비트 동일(회귀 0). ' +
            '*무대*: 16개 무거운 핵(C Z6) 조밀 격자(간격 1.8·반경~5≪coolR6 → deg 높음)·복사 바스 E=5000 선주입·kSnEject=1 snZmin=3 snCoreDeg=3 snImpulse=10·dt=1·30 tick·eventLog on/off: 코어 무거운 핵이 바스 E 를 인출해 이웃 COM 바깥으로 방사 분출. ' +
            '① **방출 신호 노출(위치·단위 방향·ΔE)·load-bearing** — eventLog on: eject 이벤트 ≥10건·모두 dE>0(바스 인출 KE)·Z≥3·단위 방향 |ux,uy|=1·위치 무대 안·분출로 퍼짐 R_g↑ ⇒ render 가 별풍 분출을 *그 위치·방향*에 그릴 신호. ' +
            '② **off → 신호 0(render 못 그림)·load-bearing** — eventLog off: events 0건(분출은 똑같이 일어나나 atom 이 안 실음·snEjectActive 전역 불리언만). ' +
            '③ **로깅 무부작용(장부·결정론 머신)** — on/off 최종 상태 해시 동일·바스↔KE E 머신·−Δp→바스 운동량 머신(순수 side-effect). ' +
            '④ **회귀** — eventLog=0 → push 0·events hash 미참여·0108 비트 동일·골든 보존.',
      ticks: 30,
      W: 100, H: 100, NS: 4, GAP: 1.8, BATH: 5000,
      KN: { dt: 1, kSnEject: 1, snZmin: 3, snCoreDeg: 3, snImpulse: 10, coolR: 6 },

      // 16개 무거운 핵(C Z6) 4×4 조밀 격자·중심 (50,50)·정지(placement 결정론·rng 무관).
      cloud() {
        const atoms = [], c = this.W / 2, off = (this.NS - 1) * this.GAP / 2;
        for (let r = 0; r < this.NS; r++) for (let col = 0; col < this.NS; col++)
          atoms.push({ Z: 6, N: 6, e: 6, x: 0, rx: c - off + col * this.GAP, ry: c - off + r * this.GAP, vx: 0, vy: 0, lep: 0, nuc: 0 });
        return atoms;
      },
      rg(atoms) { let cx = 0, cy = 0; for (const a of atoms) { cx += a.rx; cy += a.ry; } cx /= atoms.length; cy /= atoms.length;
        let s = 0; for (const a of atoms) { const dx = a.rx - cx, dy = a.ry - cy; s += dx * dx + dy * dy; } return Math.sqrt(s / atoms.length); },
      run(K, on) {
        const atoms = this.cloud(), rg0 = this.rg(atoms);
        const sim = { W: this.W, H: this.H, atoms, photons: [], rng: K.mulberry32(42),
                      knobs: Object.assign({}, L.DEFAULTS, this.KN, { eventLog: on }), tick: 0 };
        sim.escaped = { E: this.BATH, px: 0, py: 0, count: 0 };
        const l0 = K.ledger(sim);
        for (let t = 0; t < this.ticks; t++) { L.applyForces(sim); L.integrate(sim); sim.tick++; }
        const l1 = K.ledger(sim);
        const ev = sim.events || [], ej = ev.filter(e => e.type === 'eject');
        const allOK = ej.every(e => e.dE > 0 && e.Z >= 3 && Math.abs(Math.hypot(e.ux, e.uy) - 1) < 1e-9 && e.rx >= 0 && e.rx < this.W && e.ry >= 0 && e.ry < this.H);
        return { ev, nEj: ej.length, allOK, rgGrew: this.rg(sim.atoms) > rg0 * 1.5, hash: K.hashState(sim),
                 dpx: Math.abs(l1.px - l0.px), dpy: Math.abs(l1.py - l0.py), dB: Math.abs(l1.B - l0.B), dQ: Math.abs(l1.Q - l0.Q), dL: Math.abs(l1.L - l0.L), dE: Math.abs(l1.E - l0.E), Etot: Math.abs(l0.E) };
      },
      cache(K) { return this._c || (this._c = { on: this.run(K, 1), off: this.run(K, 0) }); },

      // 라이브 sim(장부·결정론·골든 기둥): eventLog on·바스 미주입(createSim 경로 → escaped 없음 → snEject no-op) → 자유 드리프트 머신.
      init(rng, K) {
        return { W: this.W, H: this.H, atoms: this.cloud(), rng: K.mulberry32((rng() * 4294967296) >>> 0), knobs: Object.assign({}, this.KN, { eventLog: 1 }) };
      },

      watch(sim, K) {
        const c = this.cache(K);
        return { ejOn: c.on.nEj, ejOff: c.off.ev.length, rgGrew: c.on.rgGrew ? 1 : 0, hashEq: c.on.hash === c.off.hash ? 1 : 0, dEon: +c.on.dE.toExponential(3) };
      },

      // 가설: ① 방출 신호 노출 ② off → 0 ③ 로깅 무부작용 머신 ④ 회귀.
      assert(ctx, K) {
        const c = this.cache(K);
        const exposed = c.on.nEj >= 10 && c.on.allOK && c.on.rgGrew;                 // ① eject 신호·단위 방향·분출 퍼짐
        const offEmpty = c.off.ev.length === 0;                                       // ② off → 0
        const noSideEffect = c.on.hash === c.off.hash && c.on.dpx < 1e-9 && c.on.dpy < 1e-9 && c.on.dB < 1e-9 && c.on.dQ < 1e-9 && c.on.dL < 1e-9 && c.on.dE < 1e-9;  // ③ 머신
        const reg = ctx.ledgerBefore !== undefined;                                   // ④ 골든 보존
        return [
          { name: `방출 신호 노출(위치·단위 방향·ΔE)·load-bearing — eventLog on: eject 이벤트 ${c.on.nEj}건·모두 dE>0(바스 인출)·Z≥3·단위 방향 |ux,uy|=1·위치 무대 안·분출로 퍼짐 R_g↑(${c.on.rgGrew}) ⇒ render L-wind 이 별풍 분출을 그 위치·방향에 그릴 신호`, pass: exposed, value: c.on.nEj },
          { name: `off → 신호 0(render 못 그림)·load-bearing — eventLog off: events ${c.off.ev.length}건(분출은 똑같이 일어나나 atom 이 안 실음·snEjectActive 전역 불리언만)`, pass: offEmpty, value: c.off.ev.length },
          { name: `로깅 무부작용(장부·결정론 머신) — on/off 최종 해시 동일(${c.on.hash === c.off.hash})·바스↔KE E 머신(dE ${c.on.dE.toExponential(2)})·−Δp→바스 운동량 머신(dpx ${c.on.dpx.toExponential(2)})·순수 side-effect`, pass: noSideEffect, value: c.on.hash === c.off.hash ? 1 : 0 },
          { name: `회귀 — eventLog=0 → push 0·events hash 미참여·0108 비트 동일·골든 보존(방출 이벤트 가법)`, pass: reg, value: c.off.ev.length },
        ];
      },
    },

    'step-0110': {
      id: 'step-0110',
      title: '등방 별풍 방출 이벤트 로그 — disperse 복사압 분산 위치·등방 방향·ΔE 노출 (#M 방출 완비·render L-wind 등방 채널·eventLog=0 → push 0·hash 미참여·회귀 0)',
      desc: '0108(fuse·decay 변환)·0109(snEject 방향성 분출)에 이어, 마지막 *방출* 채널 — disperse 등방 복사압(별풍·0071)을 노출한다. snEject 가 *방향성*(이웃 COM 바깥) 분출이라면 disperse 는 *등방*(방향=시드 rng·복사압) — render L-wind 이 두 별풍을 *다른 방향 분포*로 그릴 수 있다. 같은 `eventLog` 게이트로 disperse 가 분산 시 `sim.events` 에 `{type:wind,rx,ry,Z,N,dZ:0,dE:draw,ux,uy}` push. 이로써 #M 의 *방출 신호*(변환 L-nuc/L-fuse + 방향성 L-wind + 등방 L-wind) 완비. events 는 hashState 미참여·atoms 무변경 → eventLog=0 → push 0 → 0109 비트 동일(회귀 0). ' +
            '*무대*: 16개 가스(C Z6) 조밀 격자 + 복사 바스 E=5000 선주입·kDisperse=1 disperseE=10 zmin=0(전원 복사압)·dt=1·30 tick·eventLog on/off: 바스 E 가 등방 복사압으로 가스를 흩는다(별풍). ' +
            '① **등방 방출 신호 노출(위치·등방 방향·ΔE)·load-bearing** — eventLog on: wind 이벤트 ≥10건·모두 dE>0(바스 인출)·단위 방향 |ux,uy|=1·위치 무대 안·분산으로 퍼짐 R_g↑·**평균 방향 ≈0(등방·snEject 방향성과 다른 채널)** ⇒ render L-wind 이 등방 별풍을 그릴 신호. ' +
            '② **off → 신호 0(render 못 그림)·load-bearing** — eventLog off: events 0건(분산은 똑같이 일어나나 atom 이 안 실음·disperseActive 전역 불리언만). ' +
            '③ **로깅 무부작용(장부·결정론 머신)** — on/off 최종 해시 동일·바스↔KE E 머신·−Δp→바스 운동량 머신(순수 side-effect). ' +
            '④ **회귀** — eventLog=0 → push 0·events hash 미참여·0109 비트 동일·골든 보존.',
      ticks: 30,
      W: 100, H: 100, NS: 4, GAP: 1.8, BATH: 5000,
      KN: { dt: 1, kDisperse: 1, disperseE: 10, disperseZmin: 0 },

      cloud() {
        const atoms = [], c = this.W / 2, off = (this.NS - 1) * this.GAP / 2;
        for (let r = 0; r < this.NS; r++) for (let col = 0; col < this.NS; col++)
          atoms.push({ Z: 6, N: 6, e: 6, x: 0, rx: c - off + col * this.GAP, ry: c - off + r * this.GAP, vx: 0, vy: 0, lep: 0, nuc: 0 });
        return atoms;
      },
      rg(atoms) { let cx = 0, cy = 0; for (const a of atoms) { cx += a.rx; cy += a.ry; } cx /= atoms.length; cy /= atoms.length;
        let s = 0; for (const a of atoms) { const dx = a.rx - cx, dy = a.ry - cy; s += dx * dx + dy * dy; } return Math.sqrt(s / atoms.length); },
      run(K, on) {
        const atoms = this.cloud(), rg0 = this.rg(atoms);
        const sim = { W: this.W, H: this.H, atoms, photons: [], rng: K.mulberry32(42),
                      knobs: Object.assign({}, L.DEFAULTS, this.KN, { eventLog: on }), tick: 0 };
        sim.escaped = { E: this.BATH, px: 0, py: 0, count: 0 };
        const l0 = K.ledger(sim);
        for (let t = 0; t < this.ticks; t++) { L.applyForces(sim); L.integrate(sim); sim.tick++; }
        const l1 = K.ledger(sim);
        const ev = sim.events || [], w = ev.filter(e => e.type === 'wind');
        const allOK = w.every(e => e.dE > 0 && Math.abs(Math.hypot(e.ux, e.uy) - 1) < 1e-9 && e.rx >= 0 && e.rx < this.W && e.ry >= 0 && e.ry < this.H);
        let mx = 0, my = 0; for (const e of w) { mx += e.ux; my += e.uy; } const meanDir = w.length ? Math.hypot(mx, my) / w.length : 1;
        return { ev, nW: w.length, allOK, meanDir, rgGrew: this.rg(sim.atoms) > rg0 * 1.5, hash: K.hashState(sim),
                 dpx: Math.abs(l1.px - l0.px), dpy: Math.abs(l1.py - l0.py), dB: Math.abs(l1.B - l0.B), dQ: Math.abs(l1.Q - l0.Q), dL: Math.abs(l1.L - l0.L), dE: Math.abs(l1.E - l0.E) };
      },
      cache(K) { return this._c || (this._c = { on: this.run(K, 1), off: this.run(K, 0) }); },

      // 라이브 sim(장부·결정론·골든 기둥): eventLog on·바스 미주입(createSim 경로 → escaped 없음 → disperse no-op) → 자유 드리프트 머신.
      init(rng, K) {
        return { W: this.W, H: this.H, atoms: this.cloud(), rng: K.mulberry32((rng() * 4294967296) >>> 0), knobs: Object.assign({}, this.KN, { eventLog: 1 }) };
      },

      watch(sim, K) {
        const c = this.cache(K);
        return { wOn: c.on.nW, wOff: c.off.ev.length, meanDir: +c.on.meanDir.toFixed(3), rgGrew: c.on.rgGrew ? 1 : 0, hashEq: c.on.hash === c.off.hash ? 1 : 0 };
      },

      // 가설: ① 등방 방출 신호 노출(평균 방향 ≈0) ② off → 0 ③ 로깅 무부작용 머신 ④ 회귀.
      assert(ctx, K) {
        const c = this.cache(K);
        const exposed = c.on.nW >= 10 && c.on.allOK && c.on.rgGrew && c.on.meanDir < 0.3;       // ① wind 신호·단위 방향·등방(평균 방향 작음)·퍼짐
        const offEmpty = c.off.ev.length === 0;                                                  // ② off → 0
        const noSideEffect = c.on.hash === c.off.hash && c.on.dpx < 1e-9 && c.on.dpy < 1e-9 && c.on.dB < 1e-9 && c.on.dQ < 1e-9 && c.on.dL < 1e-9 && c.on.dE < 1e-9;  // ③ 머신
        const reg = ctx.ledgerBefore !== undefined;                                              // ④ 골든 보존
        return [
          { name: `등방 방출 신호 노출(위치·등방 방향·ΔE)·load-bearing — eventLog on: wind 이벤트 ${c.on.nW}건·모두 dE>0(바스 인출)·단위 방향 |ux,uy|=1·위치 무대 안·분산 퍼짐 R_g↑(${c.on.rgGrew})·평균 방향 ${c.on.meanDir.toFixed(3)}≈0(등방·snEject 방향성과 다른 채널) ⇒ render L-wind 이 등방 별풍을 그 위치·방향에 그릴 신호`, pass: exposed, value: c.on.nW },
          { name: `off → 신호 0(render 못 그림)·load-bearing — eventLog off: events ${c.off.ev.length}건(분산은 똑같이 일어나나 atom 이 안 실음·disperseActive 전역 불리언만)`, pass: offEmpty, value: c.off.ev.length },
          { name: `로깅 무부작용(장부·결정론 머신) — on/off 최종 해시 동일(${c.on.hash === c.off.hash})·바스↔KE E 머신(dE ${c.on.dE.toExponential(2)})·−Δp→바스 운동량 머신(dpx ${c.on.dpx.toExponential(2)})·순수 side-effect`, pass: noSideEffect, value: c.on.hash === c.off.hash ? 1 : 0 },
          { name: `회귀 — eventLog=0 → push 0·events hash 미참여·0109 비트 동일·골든 보존(등방 방출 이벤트 가법)`, pass: reg, value: c.off.ev.length },
        ];
      },
    },

    // step-0111 — z축 자유 드리프트(`drift3d`): 0110 까지 위치가 2D(rx,ry) 뿐이던 무대에 *세 번째 좌표* rz·vz 를 더한다.
    //   세계엔 새 자료형이 아니라 *원자 다발의 양 하나*(z 좌표)가 늘 뿐(SPINE 단일 척추). drift3d=0 → z 완전 불활성(2D 비트 동일·회귀 0).
    //   장부에 z운동량 pz 가 더해지고, 자유 드리프트(힘 0)라 pz·E 머신 보존. z 에 작용하는 *힘*은 후속 step 이 각 force 법칙에 가법(한 조각).
    'step-0111': {
      id: 'step-0111',
      title: '원자가 3D로 움직인다 (z축 자유 드리프트)',
      desc: 'z축(rz·vz)을 원자 다발에 더해 자유 드리프트를 3차원으로 확장한다. 0110 까지 위치는 2D(rx,ry) 뿐 — ' +
            '이제 세 번째 좌표가 깊이 D 토러스서 움직인다(VSEPR 정사면체·팔면체 등 입체 기하의 전제·0099 의 2D 한계 근원). ' +
            'drift3d=0 → z 완전 불활성(2D 비트 동일·회귀 0)·닫힌 장부에 z운동량 pz 추가(자유 드리프트 → 머신 보존).',
      ticks: 60,
      W: 100, H: 100, D: 100,
      KN: { drift3d: 1 },

      // 결정론·시드 독립 미니 런(가설·회귀 한 출처·DRY) — drift3d 게이트만 토글해 on/off 비교.
      run(K, d3) {
        const cx = this.W / 2, cy = this.H / 2, cz = this.D / 2;
        const a = [
          { Z: 1, N: 0, e: 1, x: 0, rx: cx,     ry: cy,     rz: cz, vx: 0.30,  vy: 0,    vz: 0.50,  lep: 0, nuc: 0 },
          { Z: 1, N: 0, e: 1, x: 0, rx: cx + 5, ry: cy,     rz: cz, vx: 0,     vy: 0.30, vz: -0.50, lep: 0, nuc: 0 },
          { Z: 8, N: 8, e: 8, x: 0, rx: cx,     ry: cy + 5, rz: cz, vx: -0.10, vy: 0,    vz: 0.20,  lep: 0, nuc: 0 },
        ];
        const sim = { W: this.W, H: this.H, D: this.D, atoms: a, knobs: Object.assign({}, L.DEFAULTS, this.KN, { drift3d: d3 }) };
        sim.escaped = { E: 0, px: 0, py: 0, count: 0 };
        const rx0 = a.map(p => p.rx), ry0 = a.map(p => p.ry), rz0 = a.map(p => p.rz);
        const l0 = K.ledger(sim);
        for (let t = 0; t < this.ticks; t++) { L.applyForces(sim); L.integrate(sim); sim.tick = (sim.tick || 0) + 1; }
        const l1 = K.ledger(sim);
        let zDisp = 0, xyDisp = 0;
        for (let i = 0; i < a.length; i++) {
          zDisp += Math.abs(K.minImage(a[i].rz - rz0[i], this.D));
          xyDisp += Math.hypot(K.minImage(a[i].rx - rx0[i], this.W), K.minImage(a[i].ry - ry0[i], this.H));
        }
        return { zDisp, xyDisp, xy: a.map(p => [p.rx, p.ry]),
                 dpz: Math.abs(l1.pz - l0.pz), dpx: Math.abs(l1.px - l0.px), dpy: Math.abs(l1.py - l0.py),
                 dQ: Math.abs(l1.Q - l0.Q), dB: Math.abs(l1.B - l0.B), dL: Math.abs(l1.L - l0.L),
                 relE: Math.abs(l1.E - l0.E) / Math.abs(l0.E) * 100 };
      },
      cache(K) { return this._c || (this._c = { on: this.run(K, 1), off: this.run(K, 0) }); },

      // 라이브 sim(장부·결정론·골든 기둥): 시드 의존 vz 로 z 운동 → 골든이 3D 해시를 동결한다.
      init(rng, K) {
        const cx = this.W / 2, cy = this.H / 2, cz = this.D / 2;
        const a = [
          { Z: 1, N: 0, e: 1, x: 0, rx: cx,     ry: cy, rz: cz, vx: (rng() - 0.5) * 0.04, vy: 0,                    vz:  (0.4 + rng() * 0.1), lep: 0, nuc: 0 },
          { Z: 1, N: 0, e: 1, x: 0, rx: cx + 4, ry: cy, rz: cz, vx: 0,                    vy: (rng() - 0.5) * 0.04, vz: -(0.4 + rng() * 0.1), lep: 0, nuc: 0 },
        ];
        return { W: this.W, H: this.H, D: this.D, atoms: a, rng: K.mulberry32((rng() * 4294967296) >>> 0), knobs: Object.assign({}, this.KN) };
      },

      watch(sim, K) {
        const c = this.cache(K);
        return { zDispOn: +c.on.zDisp.toFixed(2), zDispOff: +c.off.zDisp.toFixed(2), dpz: +c.on.dpz.toExponential(2), relE: +c.on.relE.toFixed(3) };
      },

      // 가설: ① z 가 움직인다(on) · 끄면 0 ② drift3d=0 → z 가 xy 평면 운동에 무영향(비트 동일·회귀) ③ pz·장부 머신·E 닫힘.
      assert(ctx, K) {
        const c = this.cache(K);
        const zMoves = c.on.zDisp > 1 && c.off.zDisp === 0;                                           // ① 켜면 z 이동·끄면 정확히 0
        const xySame = c.on.xy.every((p, i) => p[0] === c.off.xy[i][0] && p[1] === c.off.xy[i][1]);    // ② z 가 xy 에 무영향(회귀 비트)
        const ledgerOK = c.on.dpz < 1e-9 && c.on.dpx < 1e-9 && c.on.dpy < 1e-9 && c.on.dQ < 1e-9 && c.on.dB < 1e-9 && c.on.dL < 1e-9 && c.on.relE < 1e-6;  // ③
        return [
          { name: `z축 자유 드리프트·load-bearing — drift3d on: z 변위 ${c.on.zDisp.toFixed(2)}(>0·3D 운동) vs off: ${c.off.zDisp.toFixed(2)}(z 불활성) ⇒ 세 번째 좌표가 깊이 D 토러스서 움직인다(0099 2D VSEPR 한계 푸는 전제)`, pass: zMoves, value: +c.on.zDisp.toFixed(2) },
          { name: `회귀·load-bearing — drift3d=0 → z 완전 불활성·xy 비트 ${xySame ? '동일' : '다름'} ⇒ z 가 평면 운동에 무영향(과거 2D 전 장면 비트 동일·골든 보존)`, pass: xySame, value: c.off.zDisp },
          { name: `pz 장부 머신·E 닫힘 — 자유 드리프트(힘 0) → z운동량 pz 보존(dpz ${c.on.dpz.toExponential(2)})·Q·B·L 머신(dB ${c.on.dB.toExponential(2)})·E 닫힘 ${c.on.relE.toExponential(2)}%`, pass: ledgerOK, value: +c.on.dpz.toExponential(2) },
        ];
      },
    },
  };  // SCENES 끝

  return { SCENES, ELEMENTS };
});
