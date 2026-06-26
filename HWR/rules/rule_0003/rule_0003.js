// rule_0003 — 전기력 (전하를 띤 원소끼리 끌고 민다)
//
// rule_0002 의 이온 결합은 전자를 옮겨 +/− 이온을 만들 뿐, 그 이온을 *붙잡지는* 못한다.
// 이 규칙이 그 힘이다 — 전하 사이의 쿨롱 힘. 힘이므로 엔진의 a=F/m 위에서 누적만 한다(상태 변경 없음).
//
//   · 쿨롱: F = kCoulomb·q_i·q_j / r²  — 같은 부호는 밀고(repel), 반대 부호는 당긴다(attract).
//   · 짧은 거리 반발(하드코어): F = kCore / r^coreExp (coreExp>2) — 가까울수록 급격히 밀어, 반대 이온이
//     한 점으로 무너지지 않고 *평형 거리*에 멈춘다. 이 평형이 이온 격자(예: NaCl)의 간격으로 창발한다.
//   · 결합 감쇠: 상대속도(둘 사이 다가옴/멀어짐)에 비례해 거스르는 힘. 이온이 결합할 때 *결합 에너지를
//     방출*하며 평형 거리에 안착하게 한다(실제 이온 격자가 진동을 복사로 잃고 정착하는 것). 상대속도에만
//     작용하므로 *총 운동량은 보존*(같이 움직이면 감쇠 0 — 갈릴레이 불변). 무한 진동·적분 발산을 막는다.
//
// 중성 원소(q=0)는 전기적으로 *안 보인다* — 힘 0. 그래서 rule_0002 의 공유 결합(중성 원자 병합)을
//   방해하지 않는다. 전기력은 오직 이온(전하≠0)들 사이에서만 작동한다.
//
// 보존: 세 힘 모두 중심력·상대량이라, 원소마다 독립 합산해도 작용-반작용이 정확히 상쇄 → 총 운동량 보존.
//   (감쇠는 에너지를 줄이지만 운동량은 보존 — 결합 에너지 방출.)
// author 안 함: 타입 분기 0. 전하라는 보편 스칼라와 거리·상대속도만으로 결정. 결정론: 현재 상태만 읽음.

export default {
  id: 'rule_0003',
  name: '전기력',
  //   kCoulomb: 쿨롱 세기 / kCore: 하드코어 반발 / coreExp: 반발 가파름(>2) / cDamp: 결합 감쇠 / rMin: 거리 하한
  //   평형 거리(반대 이온, |q|=1): r* = (kCore/kCoulomb)^(1/(coreExp−2))  — 기본값(coreExp 3)에서 = 6
  defaults: { kCoulomb: 15, kCore: 90, coreExp: 3, cDamp: 0.3, rMin: 0.5 },

  // 원소 i 에 작용하는 전기력을 누적한다(상태는 안 건드림). e: 원소, i: 인덱스, world: 세계, params
  apply(e, i, world, params) {
    const qi = e.q || 0;
    if (qi === 0) return;                                 // 중성은 전기적으로 안 보임
    const kCoulomb = params && params.kCoulomb != null ? params.kCoulomb : 15;
    const kCore = params && params.kCore != null ? params.kCore : 90;
    const coreExp = params && params.coreExp != null ? params.coreExp : 3;
    const cDamp = params && params.cDamp != null ? params.cDamp : 0.3;
    const rMin = params && params.rMin != null ? params.rMin : 0.5;
    const els = world.elements;
    const W = world.width, H = world.height;

    for (let j = 0; j < els.length; j++) {
      if (j === i) continue;
      const o = els[j];
      const qj = o.q || 0;
      if (qj === 0) continue;                             // 전하 없는 상대와는 전기력 없음

      // 토러스 최근접 변위(i → j) 와 거리
      let dx = o.x - e.x; dx -= Math.round(dx / W) * W;
      let dy = o.y - e.y; dy -= Math.round(dy / H) * H;
      let r2 = dx * dx + dy * dy;
      if (r2 < rMin * rMin) r2 = rMin * rMin;             // 발산 방지(하한)
      const r = Math.sqrt(r2);
      const ux = dx / r, uy = dy / r;                     // i→j 단위벡터

      // 쿨롱: 같은 부호 → 음수 → −ux(밂), 반대 부호 → 양수 → +ux(당김). (i→j 방향이 ux)
      const fCoulomb = -kCoulomb * qi * qj / r2;
      // 하드코어 반발: 항상 −ux(j 반대로), 가까울수록 급격
      const fCore = kCore / Math.pow(r, coreExp);
      // 결합 감쇠: 중심선 방향 상대속도(i 기준)를 거스른다 → 진동을 잃고 평형에 안착
      const vrad = ((e.vx || 0) - (o.vx || 0)) * ux + ((e.vy || 0) - (o.vy || 0)) * uy;
      const fDamp = -cDamp * vrad;

      const fMag = fCoulomb - fCore + fDamp;
      e.fx += fMag * ux;
      e.fy += fMag * uy;
    }
  },
};
