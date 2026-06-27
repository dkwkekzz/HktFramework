// rule_0008 — 골격 결합 (Skeletal bonds) : 분자가 *형상*을 갖고, 고분자가 *사슬*로 자란다
//
// 지금까지 공유 결합은 엔진 reconcileMerges 가 결합 원자들을 *하나의 질점(point mass)* 으로 융합했다.
//   parts 에 기록은 남아도 공간적 골격(어느 원자가 어디 붙었나)이 없어 — 형상도, 사슬도, 회전도 없었다.
//
// rule_0008 은 공유 결합의 *실현* 을 바꾼다(엔진 reconcileBonds·rule_0004 채널 전환과 함께):
//   융합 → **지속 링크**. 결합한 원자는 distinct 로 남고, 결합은 *힘* 으로 붙잡는다. 분자는 "결합으로
//   묶인 distinct 원자들의 골격". 그 위에서 형상·고분자 사슬·회전·가역 분해가 *공짜로 창발* 한다.
//
// 이 규칙은 결합된 원자 쌍·결합 둘레에 힘만 누적한다(상태 변경 0 — 위상 부기는 엔진 몫). 네 항:
//   ① 결합 길이(Morse)  : 평형 길이 L 로 붙잡되, 충분히 늘이면 인력이 *약해져 끊긴다* → 가역 분해 창발.
//   ② 결합각(VSEPR)     : 한 원자의 이웃들이 서로 반발 → 각을 벌려 *형상* 창발(2이웃=직선·4이웃=사면체…).
//   ③ 고립쌍(lone pair) : 결합에 안 쓰인 전자쌍이 이웃을 *눌러* 각을 좁힘 → 물의 *굽음*(CO₂ 직선과 대비).
//   ④ 결합 소산         : 결합 *늘어남(반경)* 만 식혀 진동을 재운다. 접선(회전)은 안 건드려 *텀블링* 보존.
// 모든 항이 중심·상대량(작용-반작용 쌍 내부) → **운동량 보존**. 에너지는 KE+결합PE+소산(결합열) 닫힌 장부.
//
// author 안 함: "물·메탄·폴리에틸렌" 분기 0. 결합가·고립쌍 수는 Z 의 껍질(shellState)에서 *창발* 하고,
//   결합 길이·깊이는 질량·차수에서 나온다. 시나리오는 근본 정수 Z·관성 m 만 seed.
// 결정론: 현재 위치·속도·Z·결합 위상(e.bonds)만 읽음. Math.random 금지. 같은 입력 → 같은 출력.

import { shellState } from '../rule_0004/rule_0004.js';

const radius = (m, bondK) => bondK * Math.sqrt(m > 0 ? m : 1);     // 질량→공유 반경(rule_0002/0004 와 동일)

// 결합 평형 길이 L — 두 공유 반경 합(접촉)에 lenScale. 차수 높을수록 짧다(이중>단일 결합이 더 짧음).
function bondLength(e, o, bondK, lenScale, order, lenShorten) {
  const base = radius(e.m, bondK) + radius(o.m, bondK);
  return (base * lenScale) / (1 + lenShorten * (Math.max(1, order) - 1));
}

// 고립 전자쌍 수 — 결합에 안 쓰인 바깥 전자쌍. Z 에서 창발: (바깥전자 − Σ결합차수)/2.
//   O(6e, 결합 2) → 2쌍 → 물이 굽는다. C(4e, 결합 4) → 0쌍 → 메탄 사면체·CO₂ 직선.
function lonePairs(e) {
  if (e.Z == null) return 0;
  const v = shellState(e.Z).valenceElectrons;
  const used = Array.isArray(e.bonds) ? e.bonds.reduce((a, b) => a + (b.order || 0), 0) : 0;
  return Math.max(0, Math.floor((v - used) / 2));
}

// id→원소 인덱스(틱당 1회 캐시) — 결합은 id 로 기록되므로 이웃 원소를 빠르게 찾는다.
function idMap(world) {
  if (world._sk8Tick === world.tick && world._sk8Map) return world._sk8Map;
  const m = new Map();
  for (const el of world.elements) if (el.id != null) m.set(el.id, el);
  world._sk8Map = m; world._sk8Tick = world.tick;
  return m;
}

export default {
  id: 'rule_0008',
  name: '골격 결합',
  //   bondK,lenScale,lenShorten : 결합 평형 길이 L(질량·차수에서) — rule_0002/0004 반경 척도 공유
  //   bondDepth,bondAlpha       : Morse 우물 깊이(∝차수)·폭. 깊이/폭이 결합 강성을 정한다
  //   bondBreak                 : 끊김 임계(늘어남 r−L 이 L·bondBreak 초과 → 분해 표시). 가역 분해
  //   kAngle,angleMin           : 결합각(VSEPR) 이웃-이웃 반발 세기·거리 하한 → 형상
  //   kLone,loneLen             : 고립쌍이 이웃을 누르는 세기·고립쌍 로브 거리 → 굽음
  //   kBondSink                 : 결합 *반경* 소산(진동 냉각, 회전은 보존)
  //   fMax                      : 힘 상한(dt=1 적분 안정)
  defaults: {
    bondK: 2, lenScale: 0.95, lenShorten: 0.18,
    bondDepth: 3.0, bondAlpha: 0.35, bondBreak: 1.6,
    kAngle: 60, angleMin: 1.5, kLone: 45, loneLen: 0.7,
    kBondSink: 0.25, kAngleSink: 0.4, fMax: 30,
    // bondOrderCap: 골격 세계(rule_0004)에서 형성되는 결합 차수 상한. 1 = 단일 결합만 →
    //   손이 남아 여러 이웃과 링크 → *사슬·가지(고분자)* 가 창발. (비-skeletal 세계는 이 값을 무시.)
    bondOrderCap: 1,
  },

  // 골격 원자 i 에 작용하는 결합력을 누적한다. 결합이 없으면(홀원자·비골격) 아무 것도 안 한다.
  //   i↔이웃 쌍은 정확히 반대(작용-반작용)로 누적 → 운동량 보존. e: 원소, i: 인덱스, world: 세계, params
  apply(e, i, world, params) {
    if (!Array.isArray(e.bonds) || e.bonds.length === 0) return;   // 결합 없으면 골격 힘 없음
    const p = params || {};
    const bondK = p.bondK != null ? p.bondK : 2;
    const lenScale = p.lenScale != null ? p.lenScale : 0.95;
    const lenShorten = p.lenShorten != null ? p.lenShorten : 0.18;
    const bondDepth = p.bondDepth != null ? p.bondDepth : 3.0;
    const bondAlpha = p.bondAlpha != null ? p.bondAlpha : 0.35;
    const bondBreak = p.bondBreak != null ? p.bondBreak : 1.6;
    const kAngle = p.kAngle != null ? p.kAngle : 60;
    const angleMin = p.angleMin != null ? p.angleMin : 1.5;
    const kLone = p.kLone != null ? p.kLone : 45;
    const loneLen = p.loneLen != null ? p.loneLen : 0.7;
    const kBondSink = p.kBondSink != null ? p.kBondSink : 0.25;
    const kAngleSink = p.kAngleSink != null ? p.kAngleSink : 0.4;
    const fMax = p.fMax != null ? p.fMax : 30;
    const W = world.width, H = world.height, D = world.depth;
    const wrapZ = typeof D === 'number' && D > 0;
    const map = idMap(world);
    const clamp = f => (f > fMax ? fMax : f < -fMax ? -fMax : f);

    // 이웃들의 토러스 최근접 변위·거리·단위벡터를 모은다(이번 틱 위치 기준).
    const nb = [];
    for (const link of e.bonds) {
      const o = map.get(link.other);
      if (!o) continue;                                   // 끊긴/사라진 이웃은 건너뜀
      let dx = o.x - e.x; dx -= Math.round(dx / W) * W;
      let dy = o.y - e.y; dy -= Math.round(dy / H) * H;
      let dz = (o.z || 0) - (e.z || 0); if (wrapZ) dz -= Math.round(dz / D) * D;
      let r = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (r < 1e-9) r = 1e-9;
      nb.push({ o, order: link.order || 1, dx, dy, dz, r, ux: dx / r, uy: dy / r, uz: dz / r });
    }
    if (nb.length === 0) return;

    // ── ① 결합 길이(Morse) + ④ 결합 반경 소산 ────────────────────────────────────
    for (const b of nb) {
      const L = bondLength(e, b.o, bondK, lenScale, b.order, lenShorten);
      const x = b.r - L;                                  // 늘어남(>0) / 눌림(<0)
      const ex = Math.exp(-bondAlpha * x);
      // F_e = dU/dr · û(e→o), dU/dr = 2·D·α·e^{−αx}(1−e^{−αx}). x>0 인력(û 방향), x<0 반발(−û).
      const g = clamp(2 * bondDepth * b.order * bondAlpha * ex * (1 - ex));
      e.fx += g * b.ux; e.fy += g * b.uy; e.fz += g * b.uz;

      // 분해(가역): 변곡점 너머로 충분히 늘면(Morse 인력이 사위어 사실상 끊김) 링크 제거를 표시한다.
      //   중복 방지로 id 가 작은 쪽만 표시. freeValence 는 rule_0004 가 다음 틱에 자동 복원.
      if (x > L * bondBreak && e.id < b.o.id)
        world.pendingUnbonds.push({ a: e.id, b: b.o.id });

      // 결합 *반경* 소산 — 상대속도의 중심선 성분만 흡수(진동 냉각). 접선 성분(회전·텀블링)은 보존.
      const dvx = (e.vx || 0) - (b.o.vx || 0), dvy = (e.vy || 0) - (b.o.vy || 0), dvz = (e.vz || 0) - (b.o.vz || 0);
      const vr = dvx * b.ux + dvy * b.uy + dvz * b.uz;     // 중심선(반경) 방향 상대속도
      e.fx -= kBondSink * vr * b.ux; e.fy -= kBondSink * vr * b.uy; e.fz -= kBondSink * vr * b.uz;
    }

    // ── ② 결합각(VSEPR) — 한 원자의 이웃들끼리 반발 → 각을 벌린다(형상 창발) ───────────
    //   중심 e 가 자기 이웃 쌍(j,k)에 반발을 가한다(각 쌍은 중심이 유일 → 한 번만). 힘은 j↔k 내부 쌍
    //   → 운동량 보존(e 엔 안 더함). 2이웃→직선(180°)·3→삼각·4→사면체가 거리 반발에서 자연 정렬.
    for (let a = 0; a < nb.length; a++) for (let c = a + 1; c < nb.length; c++) {
      const ja = nb[a].o, jc = nb[c].o;
      let dx = jc.x - ja.x; dx -= Math.round(dx / W) * W;
      let dy = jc.y - ja.y; dy -= Math.round(dy / H) * H;
      let dz = (jc.z || 0) - (ja.z || 0); if (wrapZ) dz -= Math.round(dz / D) * D;
      let r2 = dx * dx + dy * dy + dz * dz;
      if (r2 < angleMin * angleMin) r2 = angleMin * angleMin;
      const r = Math.sqrt(r2);
      const f = clamp(kAngle / r2);                        // 이웃 사이 반발(쿨롱형, 가까울수록 강)
      const ux = dx / r, uy = dy / r, uz = dz / r;
      jc.fx += f * ux; jc.fy += f * uy; jc.fz += f * uz;   // ja↔jc 밀어냄(내부 쌍 → 운동량 보존)
      ja.fx -= f * ux; ja.fy -= f * uy; ja.fz -= f * uz;

      // 굽힘 진동만 식힌다 — 이웃-이웃 *거리축(radial)* 상대속도를 소산. 강체 텀블링은 이웃 간 거리가
      //   불변(radial 성분 0)이라 안 죽는다 → 형상은 정착하되 분자 회전은 보존(④와 같은 원리, 각 모드).
      const dvx = (jc.vx || 0) - (ja.vx || 0), dvy = (jc.vy || 0) - (ja.vy || 0), dvz = (jc.vz || 0) - (ja.vz || 0);
      const vr = dvx * ux + dvy * uy + dvz * uz;
      jc.fx -= kAngleSink * vr * ux; jc.fy -= kAngleSink * vr * uy; jc.fz -= kAngleSink * vr * uz;
      ja.fx += kAngleSink * vr * ux; ja.fy += kAngleSink * vr * uy; ja.fz += kAngleSink * vr * uz;
    }

    // ── ③ 고립쌍(lone pair) — 결합에 안 쓰인 전자쌍이 이웃을 눌러 각을 좁힌다(굽음) ──────────
    //   결합 방향 합 S 의 반대쪽에 고립쌍 로브를 둔다(전자쌍은 결합이 없는 곳을 차지). 그 로브가 각
    //   이웃을 밀면(반작용은 중심 e) 이웃이 *결합 다발 쪽* 으로 눌려 각이 좁아진다 → 물 104°(CO₂ 0쌍=180°).
    const lp = lonePairs(e);
    if (lp > 0 && nb.length >= 2) {
      let sx = 0, sy = 0, sz = 0;
      for (const b of nb) { sx += b.ux; sy += b.uy; sz += b.uz; }
      const sl = Math.sqrt(sx * sx + sy * sy + sz * sz);
      if (sl > 1e-6) {
        const lx = -sx / sl, ly = -sy / sl, lz = -sz / sl; // 결합 반대 방향(고립쌍 로브)
        // 로브 위치 = e + loneLen·L̄·l̂ (L̄ ≈ 평균 결합 길이 척도). 이웃마다 로브→이웃 반발, 반작용은 e.
        const Lbar = bondLength(e, nb[0].o, bondK, lenScale, nb[0].order, lenShorten);
        const lox = e.x + loneLen * Lbar * lx, loy = e.y + loneLen * Lbar * ly, loz = (e.z || 0) + loneLen * Lbar * lz;
        for (const b of nb) {
          let dx = b.o.x - lox; dx -= Math.round(dx / W) * W;
          let dy = b.o.y - loy; dy -= Math.round(dy / H) * H;
          let dz = (b.o.z || 0) - loz; if (wrapZ) dz -= Math.round(dz / D) * D;
          let r2 = dx * dx + dy * dy + dz * dz;
          if (r2 < angleMin * angleMin) r2 = angleMin * angleMin;
          const r = Math.sqrt(r2);
          const f = clamp(kLone * lp / r2);
          const ux = dx / r, uy = dy / r, uz = dz / r;
          b.o.fx += f * ux; b.o.fy += f * uy; b.o.fz += f * uz;  // 이웃 밀어냄(로브 반대로)
          e.fx -= f * ux; e.fy -= f * uy; e.fz -= f * uz;        // 반작용은 중심(내부 쌍 → 운동량 보존)
        }
      }
    }
  },
};
