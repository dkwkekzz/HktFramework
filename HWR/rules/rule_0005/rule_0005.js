// rule_0005 — 분자의 창발 특성 (분자가 되어야 비로소 특성을 가진다)
//
// rule_0004 로 원자는 *정확한 조성의 분자*(H₂O·CO₂)가 됐다. 하지만 분자에는 아직 "특성"이 없다 —
// 색도, 극성도, 안정/반응성도. 원자 한 알에는 그런 게 없는 게 맞다: 색·극성은 *여러 원자가 한 구조로
// 묶였을 때* 비로소 나타나는 양이다.
//
// 이 규칙은 **힘을 만들지 않는다.** 분자의 *특성*만 계산한다. 핵심 특성은 **부분전하 분포** 다:
//   분자 안의 원자는 en(전기음성도) 차이만큼 전자를 한쪽으로 당겨, 중성 분자(net q=0)라도 구성 원자가
//   부분전하 δ 를 띤다(δ = (분자평균en − enᵢ)·kPolar, Σδ=0). 이게 **극성의 실체**다.
//
// 그리고 그 부분전하에 작용하는 힘은 **전자기력(rule_0003) 하나**다 — 분자 간 인력(반데르발스·수소결합)은
//   별도 힘이 아니라 *부분전하들 사이 쿨롱* 일 뿐. 따로 계산하면 이중계산이고 "force=4대 기본" 원칙 위반.
//   그래서 rule_0005 는 δ 를 part.dq 에 *써넣기만* 하고(특성), 인력은 rule_0003 이 그 δ 를 보고 *창발*시킨다.
//   "분자가 되어야 비로소 (전자기적) 특성을 가진다": 홀원자(중성)는 EM 에 안 보이고, 분자는 내부
//   부분전하 덕에 비로소 EM 에 드러난다 — 그 가시성이 극성이고, 거기서 분자 간 인력·상태가 나온다.
//
// 측정 특성(힘 아님, 뷰어·관찰이 읽음):
//   · 극성(polarity) = 부분전하 쌍극자 크기 |Σ δ·r|. 대칭(CO₂)이면 0, 굽으면(H₂O) 잔류.
//   · 색(hue)        = 구성 원자 전자껍질 채움 평균 → 색상환(분자마다 다른 색).
//   · 안정성(stable) = 옥텟 만족(freeValence==0) / 반응성(reactivity)=잔여 손.
//
// 결정론: 현재 조성(parts 의 en·기하)만 읽음. Math.random 금지. 같은 입력 → 같은 출력.

import { shellState } from '../rule_0004/rule_0004.js';

const isMolecule = e => Array.isArray(e.parts) && e.parts.length >= 2;  // 특성은 분자만 갖는다

// 분자의 창발 특성 — 조성(구성 원자 en·Z)과 기하(parts 상대 위치)의 *순수 함수*. 부수효과 없음.
//   부분전하 δ 배열 + 극성(쌍극자 크기) + 색 + 안정성. 원자(parts<2)는 null.
export function moleculeProps(e, world, kPolar) {
  const parts = e.parts;
  if (!isMolecule(e)) return null;
  const kP = kPolar != null ? kPolar : 10;
  const W = world.width, H = world.height, D = world.depth;
  const wrapZ = typeof D === 'number' && D > 0;
  const N = parts.length;

  // 각 부분의 en 과 평균. 부분 전하 δ = (평균 − enᵢ)·kPolar → Σδ=0(중성 분자, 기준점 무관).
  const ens = new Array(N);
  let enSum = 0, fillSum = 0;
  for (let k = 0; k < N; k++) {
    const p = parts[k];
    const en = p.en != null ? p.en : (p.Z != null ? shellState(p.Z).en : 0);
    ens[k] = en; enSum += en;
    if (p.Z != null) { const s = shellState(p.Z); fillSum += s.shellCap > 0 ? s.valenceElectrons / s.shellCap : 0; }
  }
  const enMean = enSum / N;

  // 부분전하 δ + 쌍극자(극성) p = Σ δ·(부분 위치 − 기준). parts[0] 기준 토러스 최근접.
  //   대칭 배치는 벡터합 0(무극성), 굽은 배치는 잔류(유극성) — 같은 조성도 기하가 가른다.
  const ref = parts[0];
  const partials = new Array(N);
  let px = 0, py = 0, pz = 0;
  for (let k = 0; k < N; k++) {
    const p = parts[k];
    const dq = (enMean - ens[k]) * kP;
    partials[k] = dq;
    let dx = p.x - ref.x; dx -= Math.round(dx / W) * W;
    let dy = p.y - ref.y; dy -= Math.round(dy / H) * H;
    let dz = (p.z || 0) - (ref.z || 0); if (wrapZ) dz -= Math.round(dz / D) * D;
    px += dq * dx; py += dq * dy; pz += dq * dz;
  }
  const polarity = Math.sqrt(px * px + py * py + pz * pz);

  const fillMean = fillSum / N;
  const hue = (((fillMean * 360) % 360) + 360) % 360;
  const stable = e.freeValence != null ? e.freeValence === 0 : true;   // 옥텟 채움 = 안정
  const reactivity = e.freeValence != null ? e.freeValence : 0;        // 잔여 손 = 반응성

  return { partials, polarity, dipole: { x: px, y: py, z: pz }, hue, stable, reactivity };
}

// 부분전하(part.dq)를 *틱당 1회* 보장한다(규칙 순서 무관). 부분전하는 조성·기하의 함수라 분자마다
//   상수지만, 갓 생성된 분자가 *생성 즉시* 전자기력에 보이도록 온디맨드로 채운다 — rule_0004 의
//   ensureTick 과 같은 패턴. **rule_0003(전자기력)이 힘 계산 전 이 함수를 호출**해, 분자 자신의 EM 이
//   부분전하 할당보다 먼저 실행되는 순서 문제를 없앤다(첫 틱 누락·운동량 비대칭 방지).
//   계산된 측정 특성(polarity/hue/…)은 e._mp 에 스태시 — rule_0005.apply 가 읽어 원소에 써넣는다.
export function ensureCharges(e, world, kPolar) {
  if (e._dqTick === world.tick) return e._mp || null;
  e._dqTick = world.tick;
  const p = moleculeProps(e, world, kPolar);
  e._mp = p;
  if (p) for (let k = 0; k < e.parts.length; k++) e.parts[k].dq = p.partials[k];
  return p;
}

export default {
  id: 'rule_0005',
  name: '분자의 창발 특성',
  //   kPolar : 부분전하 세기(δ = (평균en − enᵢ)·kPolar). EM 이 이 δ 를 보고 분자 간 인력을 만든다.
  defaults: { kPolar: 10 },

  // 분자의 특성을 계산해 원소·부분에 써넣는다. **힘은 더하지 않는다**(인력은 rule_0003 전자기력이 δ 에서 창발).
  //   e: 원소, i: 인덱스, world: 세계, params
  apply(e, i, world, params) {
    const kPolar = params && params.kPolar != null ? params.kPolar : 10;
    const p = ensureCharges(e, world, kPolar);   // 부분전하(part.dq) 보장 + 측정 특성 계산
    if (!p) {
      // 원자: 내부 구조 없음 → 부분전하·극성 없음(특성 없음). EM 엔 순전하 q 로만 보일 뿐.
      e.polarity = 0;
      return;
    }
    e.polarity = p.polarity;      // 극성(측정)
    e.hue = p.hue;                // 분자가 비로소 갖는 색(조성의 함수)
    e.stable = p.stable;          // 옥텟 만족 = 안정
    e.reactivity = p.reactivity;  // 잔여 손 = 반응성
  },
};
