// engine — 세계 로직(고정). 규칙이 추가돼도 *절대 바뀌지 않는다*.
//
// 철학(HWR/CLAUDE.md): 세계는 원소로 되어있고, 정해진 규칙으로 스스로 굴러간다.
// 여기서 역할을 가른다:
//   · 세계 로직(이 파일) = 보편 역학. 모든 원소를 순회하며 한 틱 전진시킨다.
//       관성(위치는 속도로 적분) · 뉴턴 2법칙(a = F/m) · 시간(tick) 은 *엔진이 소유*한다.
//   · 규칙(rule_NNNN.js)  = 원소에 작용하는 '힘'일 뿐. 힘만 누적(`e.f* += …`)하고
//       위치·속도·tick·적분은 건드리지 않는다. → 규칙이 늘어도 엔진은 그대로, 힘만 누적된다.
//
// 한 틱(stepWorld):
//   ① 모든 원소의 힘 누적기(fx,fy,fz)를 0으로 초기화
//   ② 모든 원소를 순회하며 모든 규칙을 적용 — 규칙은 힘만 더한다(서로 가림 없이 누적)
//   ③ 뉴턴 적분: v += (F/m)·dt (질량=관성의 척도), x += v·dt (관성)
//   ④ 경계: 토러스 랩(좌표 동일시 — 힘 아님 → 속도·운동량 불변)
//   ⑤ tick++  (시간은 엔진이 틱당 한 번만 전진)
//
// 결정론: 힘은 *현재* 상태만 읽어 누적하고(②), 적분은 그 뒤 한 번(③) — 적용 순서에 무관.
// Math.random 금지(규칙·시나리오 공통). 같은 입력 → 같은 출력.
export function stepWorld(world, rules, params) {
  const dt = params && params.dt != null ? params.dt : 1;
  const els = world.elements;

  // ① 힘 누적기 초기화
  for (const e of els) { e.fx = 0; e.fy = 0; e.fz = 0; }

  // ② 모든 원소 × 모든 규칙 — 규칙은 힘만 누적. (위치는 아직 고정 → 적용 순서 무관)
  for (let i = 0; i < els.length; i++) {
    const e = els[i];
    for (const r of rules) if (r && typeof r.apply === 'function') r.apply(e, i, world, params);
  }

  // ③④ 뉴턴 적분 + 관성 + 토러스 랩
  const W = world.width, H = world.height;
  for (const e of els) {
    const m = e.m > 0 ? e.m : 1;            // 질량 없으면 1
    e.vx += (e.fx / m) * dt;                // a = F/m → Δv
    e.vy += (e.fy / m) * dt;
    e.vz = (e.vz || 0) + ((e.fz || 0) / m) * dt;
    e.x += e.vx * dt;                       // 관성: 위치는 속도로 적분
    e.y += e.vy * dt;
    e.z = (e.z || 0) + e.vz * dt;
    e.x = ((e.x % W) + W) % W;              // 토러스 랩 — 좌표 동일시(힘 아님)
    e.y = ((e.y % H) + H) % H;
  }

  // ⑤ 시간 전진(엔진 전용)
  world.tick++;
}
