// rule_0003 — 전자기력 (Electromagnetism) : 우주 4대 기본 상호작용 중 하나
//
// 힘 규칙은 *특별한 국소 힘*을 author 하지 않는다 — 오직 4대 기본 상호작용(중력·전자기력·강력·약력)만
// 정의한다. "전기력·반발력·마찰력"은 별개의 힘이 아니라, 모두 *전자기력 하나*에서 창발하는 양상이다.
//   · 전기력      = 전하 사이 쿨롱 (Madelung 항).
//   · 반발력(단단함)= 가까워지면 전자구름이 겹쳐 같은 전하가 밀어내는 단거리 반발 (Born 항). 물질의 '단단함'.
//   · 마찰력      = 접촉한 전하들이 *상대운동*을 거스르며 에너지를 소산 (접촉 소산 항). 옆으로 미끄러짐을 막음.
// 셋은 모두 전자기 상호작용의 부분이다(이온 결정의 Born–Landé 모형이 정확히 이 구성). 따로 분류하지 않는다.
//
// 전자기력의 *원천은 전하* 다. 전하는 두 형태로 존재한다:
//   ① 원소의 순전하 q — 이온(Na⁺·Cl⁻)이 가진 단극(monopole). 원소 중심에 있다.
//   ② 분자 내부의 *부분전하* — 중성 분자(net q=0)라도 구성 원자들이 en 차이로 부분전하 δ 를 띤다
//      (rule_0005 가 계산해 part.dq 에 써넣는다). 각 부분의 *위치*에 있다.
//   → 전자기력은 이 둘을 구분하지 않는다. **모든 전하 사이의 쿨롱**일 뿐. 그래서:
//      · 멀리선 분자의 순전하가 0 이라 EM 에 *안 보인다*(중성).
//      · 가까이선 부분전하들이 보여 **분자 간 인력(쌍극자–쌍극자·수소결합 양상)이 창발**한다.
//        반데르발스는 별도 힘이 아니라 *바로 이 부분전하 쿨롱* 이다 — 따로 계산하면 이중계산.
//   "분자가 되어야 비로소 (전자기적) 특성을 가진다": 홀원자(중성)는 EM 에 안 보이고, 분자는 내부
//   부분전하 덕에 비로소 EM 에 드러난다. 그 가시성이 곧 극성이고, 거기서 분자 간 인력이 나온다.
//
// 힘이므로 엔진의 a=F/m 위에서 누적만 한다(상태 변경 0). 모든 항이 중심·상대량 → 작용-반작용 정확히
//   상쇄 → 총 운동량 보존(소산 항은 에너지만 줄임 = 마찰열). 결정론: 현재 상태(위치·속도·전하)만 읽음.
//
// 하위 호환: 부분전하(part.dq)가 없으면(rule_0005 미적용 세계) 전하 사이트는 순전하뿐 → 이온만 보는
//   기존 거동과 *비트 동일*. Born 을 |전하곱| 으로 스케일하므로 단위 이온(q=±1)은 옛값 그대로다.

// 분자의 부분전하(part.dq)는 rule_0005 가 정의한다(en 차이 → δ). EM 은 그 전하를 *읽어* 작용할 뿐이라,
//   힘 계산 전에 부분전하가 채워져 있어야 한다. 규칙 순서상 rule_0005 가 rule_0003 보다 *뒤*라(번호순),
//   분자 자신의 EM 이 부분전하 할당보다 먼저 돌면 첫 틱에 분자가 안 보인다 — 그래서 EM 이 직접
//   ensureCharges 를 온디맨드로 호출해 보장한다(rule_0004 ensureTick 과 같은 패턴, 순서 무관).
import { ensureCharges } from '../rule_0005/rule_0005.js';

// 원소의 '전하 사이트' — 전자기력이 작용하는 점전하들의 *현재 세계 위치*와 전하.
//   분자(parts≥2): 부분전하 δ 를 가진 부분들. 부분 위치는 병합 시점 frozen 기하라, 부분들의 질량중심
//     기준 오프셋을 분자의 *현재* 중심(e.x)에 더해 현재 위치를 복원한다(분자는 강체 병진).
//   이온/원자: 순전하 q 를 가진 중심 한 점. 중성(q=0·dq 없음)은 사이트 0 → EM 에 안 보임.
function chargeSites(e, world) {
  const W = world.width, H = world.height, D = world.depth;
  const wrapZ = typeof D === 'number' && D > 0;
  if (Array.isArray(e.parts) && e.parts.length >= 2) {
    const parts = e.parts;
    const ref = parts[0];
    // 부분들의 질량중심 오프셋(frozen, ref 기준 토러스 최근접) — 현재 위치 복원의 기준
    let M = 0, cox = 0, coy = 0, coz = 0;
    const off = [];
    for (const p of parts) {
      const m = p.m > 0 ? p.m : 1;
      let dx = p.x - ref.x; dx -= Math.round(dx / W) * W;
      let dy = p.y - ref.y; dy -= Math.round(dy / H) * H;
      let dz = (p.z || 0) - (ref.z || 0); if (wrapZ) dz -= Math.round(dz / D) * D;
      off.push([dx, dy, dz]); M += m; cox += m * dx; coy += m * dy; coz += m * dz;
    }
    cox /= M; coy /= M; coz /= M;
    const sites = [];
    for (let k = 0; k < parts.length; k++) {
      const dq = parts[k].dq || 0;
      if (dq === 0) continue;                              // 부분전하 없는(또는 동핵 대칭) 부분은 생략
      sites.push({ x: e.x + (off[k][0] - cox), y: e.y + (off[k][1] - coy), z: (e.z || 0) + (off[k][2] - coz), q: dq });
    }
    return sites;
  }
  const q = e.q || 0;
  return q !== 0 ? [{ x: e.x, y: e.y, z: e.z || 0, q }] : [];
}

export default {
  id: 'rule_0003',
  name: '전자기력',
  //   kCoulomb : 쿨롱(전기) 세기 / kBorn,bornExp : 전자구름 겹침 반발(단단함) / kFriction : 접촉 소산(마찰)
  //   rMin : 거리 하한(발산 방지)
  //   반대 이온 평형 거리: r* = kBorn/kCoulomb (Born 을 |전하곱| 으로 스케일 → 전하 무관, bornExp 3 에서 = 6)
  defaults: { kCoulomb: 15, kBorn: 90, bornExp: 3, kFriction: 10, rMin: 0.5 },

  // 원소 i 에 작용하는 전자기력을 누적한다(상태는 안 건드림). e: 원소, i: 인덱스, world: 세계, params
  apply(e, i, world, params) {
    const kPolar = params && params.kPolar != null ? params.kPolar : 10;
    ensureCharges(e, world, kPolar);                       // 분자면 부분전하 보장(EM 이 읽기 전)
    const sitesE = chargeSites(e, world);
    if (sitesE.length === 0) return;                       // 전하 없으면 전자기적으로 안 보임
    const kCoulomb = params && params.kCoulomb != null ? params.kCoulomb : 15;
    const kBorn = params && params.kBorn != null ? params.kBorn : 90;
    const bornExp = params && params.bornExp != null ? params.bornExp : 3;
    const kFriction = params && params.kFriction != null ? params.kFriction : 10;
    const rMin = params && params.rMin != null ? params.rMin : 0.5;
    const els = world.elements;
    const W = world.width, H = world.height, D = world.depth;
    const wrapZ = typeof D === 'number' && D > 0;

    for (let j = 0; j < els.length; j++) {
      if (j === i) continue;
      const o = els[j];
      ensureCharges(o, world, kPolar);                     // 상대가 분자면 부분전하 보장
      const sitesO = chargeSites(o, world);
      if (sitesO.length === 0) continue;                   // 전하 없는 상대와는 전자기력 없음

      // ── 전기(쿨롱) + 반발(Born) — *모든 전하 사이트 쌍*에 작용 ──
      //   이온–이온(단극), 이온–분자(전하-쌍극자), 분자–분자(쌍극자-쌍극자=반데르발스)가 한 식에서 나온다.
      for (const a of sitesE) for (const b of sitesO) {
        let dx = b.x - a.x; dx -= Math.round(dx / W) * W;
        let dy = b.y - a.y; dy -= Math.round(dy / H) * H;
        let dz = b.z - a.z; if (wrapZ) dz -= Math.round(dz / D) * D;
        let r2 = dx * dx + dy * dy + dz * dz;
        if (r2 < rMin * rMin) r2 = rMin * rMin;            // 발산 방지(하한)
        const r = Math.sqrt(r2);
        const ux = dx / r, uy = dy / r, uz = dz / r;       // a→b 단위벡터(3D)
        // 전기(쿨롱·Madelung): 같은 부호 → 음수 → −u(밂), 반대 부호 → 양수 → +u(당김)
        const fElectric = -kCoulomb * a.q * b.q / r2;
        // 반발(전자구름 겹침·Born): 항상 −u(b 반대로), 가까울수록 급격 → 단단함. |전하곱| 으로 스케일(전하 무관 평형).
        const fRepulse = kBorn * Math.abs(a.q * b.q) / Math.pow(r, bornExp);
        const fRadial = fElectric - fRepulse;              // 중심선 방향 합(전기+반발)
        e.fx += fRadial * ux; e.fy += fRadial * uy; e.fz += fRadial * uz;
      }

      // ── 마찰(접촉 소산) — 원소 중심 상대속도를 거스른다(반경=안착 감쇠, 접선=미끄럼 마찰). 단거리(1/r²) ──
      //   상대량이라 같이 움직이면 0(갈릴레이 불변), 작용-반작용 → 운동량 보존, 에너지만 소산(마찰열).
      let dxc = o.x - e.x; dxc -= Math.round(dxc / W) * W;
      let dyc = o.y - e.y; dyc -= Math.round(dyc / H) * H;
      let dzc = (o.z || 0) - (e.z || 0); if (wrapZ) dzc -= Math.round(dzc / D) * D;
      let rc2 = dxc * dxc + dyc * dyc + dzc * dzc;
      if (rc2 < rMin * rMin) rc2 = rMin * rMin;
      const wf = 1 / rc2;                                   // 접촉 가중(단거리)
      const dvx = (e.vx || 0) - (o.vx || 0), dvy = (e.vy || 0) - (o.vy || 0), dvz = (e.vz || 0) - (o.vz || 0);
      e.fx -= kFriction * wf * dvx; e.fy -= kFriction * wf * dvy; e.fz -= kFriction * wf * dvz;
    }
  },
};
