// rule_0005 — 분자의 창발 특성 (분자가 되어야 비로소 특성을 가진다)
//
// 지금까지(rule_0004) 원자는 결합해 *정확한 조성의 분자*가 됐다(H₂O·CO₂). 하지만 분자에는 아직
// "특성"이 없었다 — 색도, 극성도, 안정/반응성도, 상태(고체/액체/기체)도 없다. 원자 한 알에는
// 그런 게 없는 게 맞다: 색·극성·상태는 *여러 원자가 한 구조로 묶였을 때* 비로소 나타나는 양이다.
//
// rule_0005 의 한 줄: **분자(parts≥2)만이 특성을 갖는다.** 그리고 그 특성은 타입이 아니라
// *조성·기하의 함수로 계산*된다(author 안 함 — "if 물" 같은 분기 0).
//
//   ① 극성(쌍극자) — 구성 원자의 전기음성도 차이 × 부분들의 상대 기하의 *벡터합*.
//        en 다른 원자 사이엔 전자가 한쪽으로 치우쳐 부분전하 δ 가 생기고(δ=en−평균, Σδ=0),
//        쌍극자 p = Σ δ·r. 대칭이면(CO₂: O–C–O 일직선) 상쇄→0(무극성), 굽으면(H₂O) 잔류→유극성.
//        → 같은 원자 조성이라도 *기하*가 극성을 가른다. 순수 창발(시나리오가 박지 않음).
//   ② 분자 간 인력 — 이 규칙이 더하는 단 하나의 *새 힘*. 극성 분자끼리 끌린다(쌍극자–쌍극자,
//        물의 수소결합 같은 응집력). Lennard–Jones 형: 멀면 당기고(인력 꼬리) 너무 가까우면 민다
//        (전자구름 반발 코어) → 평형 간격에서 응집. 세기 ε = kVdw·극성ᵢ·극성ⱼ → *무극성(극성0)은
//        ε=0 → 인력 없음*. 결합(rule_0004)보다 훨씬 약해 병합시키지 않는다(특성이지 결합이 아님).
//   ③ 상태(고체/액체/기체) — ②의 인력 vs 운동에너지(온도)에서 *창발*. 극성 분자는 끌려 응결하고
//        (액체/고체 방울), 무극성·원자는 흩어진다(기체). 박은 라벨이 아니라 거동으로 드러난다.
//   ④ 색·안정성 — 측정 출력. 색=구성 원자 전자껍질 채움의 함수(분자마다 다른 색). 안정성=옥텟
//        만족(freeValence==0 → 안정, 잔여 손>0 → 반응성). 뷰어·관찰이 읽는다.
//
// 힘이므로 엔진의 a=F/m 위에 누적만 한다(상태 변경 0). 분자 간 인력은 중심력 → 작용-반작용으로
//   총 운동량 보존(LJ 는 보존력). 결정론: 현재 상태(parts 기하·en·위치)만 읽음. Math.random 금지.

import { shellState } from '../rule_0004/rule_0004.js';

const isMolecule = e => Array.isArray(e.parts) && e.parts.length >= 2;  // 특성은 분자만 갖는다

// 분자의 창발 특성 — 조성(구성 원자 Z·en)과 기하(parts 상대 위치)의 *순수 함수*. 부수효과 없음.
//   원자(parts<2)는 null — "분자가 되어야 비로소 특성을 가진다".
export function moleculeProps(e, world) {
  const parts = e.parts;
  if (!Array.isArray(parts) || parts.length < 2) return null;
  const W = world.width, H = world.height, D = world.depth;
  const wrapZ = typeof D === 'number' && D > 0;
  const N = parts.length;

  // 각 부분의 전기음성도(en)와 껍질 채움(색의 원천). en 은 부분에 기록돼 있으면 쓰고, 없으면 Z 에서 계산.
  const ens = new Array(N);
  let enSum = 0, fillSum = 0;
  for (let k = 0; k < N; k++) {
    const p = parts[k];
    const en = p.en != null ? p.en : (p.Z != null ? shellState(p.Z).en : 0);
    ens[k] = en; enSum += en;
    if (p.Z != null) { const s = shellState(p.Z); fillSum += s.shellCap > 0 ? s.valenceElectrons / s.shellCap : 0; }
  }
  const enMean = enSum / N;

  // ── ① 쌍극자(극성) — δ=en−평균(Σδ=0 → 기준점 무관), p = Σ δ·(부분 위치 − 기준). parts[0] 기준 토러스 최근접.
  //    대칭 배치는 벡터합이 0(무극성), 굽은 배치는 잔류(유극성). 같은 조성도 기하가 가른다.
  const ref = parts[0];
  let px = 0, py = 0, pz = 0;
  for (let k = 0; k < N; k++) {
    const p = parts[k];
    let dx = p.x - ref.x; dx -= Math.round(dx / W) * W;
    let dy = p.y - ref.y; dy -= Math.round(dy / H) * H;
    let dz = (p.z || 0) - (ref.z || 0); if (wrapZ) dz -= Math.round(dz / D) * D;
    const d = ens[k] - enMean;
    px += d * dx; py += d * dy; pz += d * dz;
  }
  const polarity = Math.sqrt(px * px + py * py + pz * pz);

  // ── ④ 측정: 색(껍질 채움 평균 → 색상환), 안정성(옥텟 만족 = 잔여 원자가 0).
  const fillMean = fillSum / N;
  const hue = (((fillMean * 360) % 360) + 360) % 360;
  const stable = e.freeValence != null ? e.freeValence === 0 : true;   // 옥텟 채움 = 안정
  const reactivity = e.freeValence != null ? e.freeValence : 0;        // 잔여 손 = 반응성

  return { polarity, dipole: { x: px, y: py, z: pz }, hue, stable, reactivity };
}

const radius = e => (e.r != null && e.r > 0) ? e.r : Math.sqrt(e.m > 0 ? e.m : 1);

// 분자의 특성을 한 틱에 한 번만 계산해 캐시(_ptick). 측정값(polarity/hue/stable/reactivity)을 원소에 써넣어
//   뷰어·관찰이 읽게 한다. 힘 계산엔 극성 크기(_pol)만 쓴다.
function ensureProps(e, world) {
  if (e._ptick === world.tick) return;
  e._ptick = world.tick;
  const p = moleculeProps(e, world);
  if (p) {
    e._pol = p.polarity;
    e.polarity = p.polarity;
    e.hue = p.hue;                 // 분자가 비로소 갖는 색(조성의 함수)
    e.stable = p.stable;
    e.reactivity = p.reactivity;
  } else {
    e._pol = 0;                    // 원자: 내부 구조 없음 → 극성 없음(특성 없음)
    e.polarity = 0;
  }
}

export default {
  id: 'rule_0005',
  name: '분자의 창발 특성',
  //   kVdw     : 분자 간 인력 세기(우물 깊이 ε = kVdw·극성ᵢ·극성ⱼ, 무극성이면 0)
  //   sigmaK   : 평형 간격 척도(σ = 두 반경 합 × sigmaK). 우물이 *완만*하도록(진동주기 ≫ dt) 넉넉히.
  //   rCutK    : 차단 거리(= σ·rCutK 밖이면 무시 — 단거리 힘)
  //   rMinFrac : 거리 하한(= σ·rMinFrac, 반발 코어 발산 방지)
  //   fMax     : 힘 크기 상한 — *정상 속박에선 안 걸릴 만큼 높게*(걸리면 비보존이라 에너지 샘) +
  //              겹쳐 생성 같은 병적 근접만 유한하게 막는 안전판
  defaults: { kVdw: 40, sigmaK: 2, rCutK: 3, rMinFrac: 0.6, fMax: 200 },

  // 원소 i 에 작용하는 분자 간 인력을 누적한다(상태 변경 0). 분자(극성>0)끼리만 — 원자·무극성은 안 보임.
  //   각 원소가 '자기에게 작용하는 힘'을 모든 상대로부터 합산 → i↔j 쌍은 정확히 반대 부호 → 운동량 보존.
  apply(e, i, world, params) {
    ensureProps(e, world);                  // 측정값을 써넣고(분자면), 극성 크기 캐시
    if (!isMolecule(e) || e._pol <= 0) return;  // 특성(극성) 없으면 분자 간 인력 안 받음

    const kVdw = params && params.kVdw != null ? params.kVdw : 300;
    const sigmaK = params && params.sigmaK != null ? params.sigmaK : 1;
    const rCutK = params && params.rCutK != null ? params.rCutK : 3;
    const rMinFrac = params && params.rMinFrac != null ? params.rMinFrac : 0.85;
    const fMax = params && params.fMax != null ? params.fMax : 50;
    const els = world.elements;
    const W = world.width, H = world.height, D = world.depth;
    const wrapZ = typeof D === 'number' && D > 0;
    const Ri = radius(e);

    for (let j = 0; j < els.length; j++) {
      if (j === i) continue;
      const o = els[j];
      ensureProps(o, world);
      if (!isMolecule(o) || o._pol <= 0) continue;   // 무극성(원자·대칭 분자)은 인력 없음

      // 토러스 최근접 변위(i→j) — 3D
      let dx = o.x - e.x; dx -= Math.round(dx / W) * W;
      let dy = o.y - e.y; dy -= Math.round(dy / H) * H;
      let dz = (o.z || 0) - (e.z || 0); if (wrapZ) dz -= Math.round(dz / D) * D;

      const sigma = (Ri + radius(o)) * sigmaK;        // 접촉(평형) 척도 = 두 반경 합
      let r = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (r > sigma * rCutK) continue;                // 차단 거리 밖 → 단거리 힘 무시
      const rFloor = sigma * rMinFrac;
      if (r < rFloor) r = rFloor;                     // 반발 코어 발산 방지(하한)
      const ux = dx / r, uy = dy / r, uz = dz / r;    // i→j 단위벡터

      // Lennard–Jones 형 분자 간 힘. ε = kVdw·극성곱 → 무극성이면 0.
      //   F>0 = i→j 방향(인력), F<0 = 반대(반발 코어). 멀면 (σ/r)⁶ 인력, 가까우면 −2(σ/r)¹² 반발.
      const eps = kVdw * e._pol * o._pol;
      const sr = sigma / r, s6 = Math.pow(sr, 6), s12 = s6 * s6;
      let F = (24 * eps / r) * (s6 - 2 * s12);
      if (F > fMax) F = fMax; else if (F < -fMax) F = -fMax;   // 적분 안정용 상한

      e.fx += F * ux; e.fy += F * uy; e.fz += F * uz;
    }
  },
};
