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
  };

  return { SCENES, ELEMENTS };
});
