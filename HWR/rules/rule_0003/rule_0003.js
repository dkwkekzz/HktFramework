// rule_0003 — 전자기력 (Electromagnetism) : 우주 4대 기본 상호작용 중 하나
//
// 힘 규칙은 *특별한 국소 힘*을 author 하지 않는다 — 오직 4대 기본 상호작용(중력·전자기력·강력·약력)만
// 정의한다. "전기력·반발력·마찰력"은 별개의 힘이 아니라, 모두 *전자기력 하나*에서 창발하는 양상이다.
//   · 전기력      = 전하 사이 쿨롱 (Madelung 항).
//   · 반발력(단단함)= 가까워지면 전자구름이 겹쳐 같은 전하가 밀어내는 단거리 반발 (Born 항). 물질의 '단단함'.
//   · 마찰력      = 접촉한 전하들이 *상대운동*을 거스르며 에너지를 소산 (접촉 소산 항). 옆으로 미끄러짐을 막음.
// 셋은 모두 전자기 상호작용의 부분이다(이온 결정의 Born–Landé 모형이 정확히 이 구성). 따로 분류하지 않는다.
//
// 전자기력의 *원천은 전하 q* 다. 지금은 이온(q≠0)만 순전하를 가지므로 EM 은 이온들 사이에서 드러난다.
//   중성(q=0)은 순전하가 0이라 EM 이 안 보인다 — 그래서 rule_0002 의 공유 결합(중성 원자 병합)을 안 막는다.
//   (중성끼리의 미세 EM = 반데르발스·중성 표면 마찰은 전하 구조(쌍극자)가 창발하면 같은 규칙에서 확장된다.
//    자기력 qv×B 도 같은 EM 의 속도 의존 부분 — 후속 정밀화. 지금은 전기·반발·마찰 양상에 집중.)
//
// 힘이므로 엔진의 a=F/m 위에서 누적만 한다(상태 변경 0). 세 항 모두 중심·상대량 → 작용-반작용 정확히
//   상쇄 → 총 운동량 보존(소산 항은 에너지만 줄임 = 마찰열). 결정론: 현재 상태(위치·속도·전하)만 읽음.

export default {
  id: 'rule_0003',
  name: '전자기력',
  //   kCoulomb : 쿨롱(전기) 세기 / kBorn,bornExp : 전자구름 겹침 반발(단단함) / kFriction : 접촉 소산(마찰)
  //   rMin : 거리 하한(발산 방지)
  //   반대 이온 평형 거리: r* = (kBorn/kCoulomb)^(1/(bornExp−2))  — 기본값(bornExp 3)에서 = 6
  defaults: { kCoulomb: 15, kBorn: 90, bornExp: 3, kFriction: 10, rMin: 0.5 },

  // 원소 i 에 작용하는 전자기력을 누적한다(상태는 안 건드림). e: 원소, i: 인덱스, world: 세계, params
  apply(e, i, world, params) {
    const qi = e.q || 0;
    if (qi === 0) return;                                 // 순전하 없으면 전자기적으로 안 보임
    const kCoulomb = params && params.kCoulomb != null ? params.kCoulomb : 15;
    const kBorn = params && params.kBorn != null ? params.kBorn : 90;
    const bornExp = params && params.bornExp != null ? params.bornExp : 3;
    const kFriction = params && params.kFriction != null ? params.kFriction : 10;
    const rMin = params && params.rMin != null ? params.rMin : 0.5;
    const els = world.elements;
    const W = world.width, H = world.height;

    for (let j = 0; j < els.length; j++) {
      if (j === i) continue;
      const o = els[j];
      const qj = o.q || 0;
      if (qj === 0) continue;                             // 전하 없는 상대와는 전자기력 없음

      // 토러스 최근접 변위(i → j) 와 거리
      let dx = o.x - e.x; dx -= Math.round(dx / W) * W;
      let dy = o.y - e.y; dy -= Math.round(dy / H) * H;
      let r2 = dx * dx + dy * dy;
      if (r2 < rMin * rMin) r2 = rMin * rMin;             // 발산 방지(하한)
      const r = Math.sqrt(r2);
      const ux = dx / r, uy = dy / r;                     // i→j 단위벡터

      // ── 전자기 상호작용 한 벌 (전기 + 반발 + 마찰이 모두 여기서 나온다) ──
      // 전기(쿨롱·Madelung): 같은 부호 → 음수 → −ux(밂), 반대 부호 → 양수 → +ux(당김)
      const fElectric = -kCoulomb * qi * qj / r2;
      // 반발(전자구름 겹침·Born): 항상 −ux(j 반대로), 가까울수록 급격 → 물질의 단단함
      const fRepulse = kBorn / Math.pow(r, bornExp);
      const fRadial = fElectric - fRepulse;               // 중심선 방향 합(전기+반발)

      // 마찰(접촉 소산): 상대속도 전체를 거스른다(반경=안착 감쇠, 접선=미끄럼 마찰). 가까울수록 강함.
      //   상대량이라 같이 움직이면 0(갈릴레이 불변), 작용-반작용 → 운동량 보존, 에너지만 소산(마찰열).
      const w = 1 / r2;                                   // 접촉 가중(단거리)
      const dvx = (e.vx || 0) - (o.vx || 0), dvy = (e.vy || 0) - (o.vy || 0);

      e.fx += fRadial * ux - kFriction * w * dvx;
      e.fy += fRadial * uy - kFriction * w * dvy;
    }
  },
};
