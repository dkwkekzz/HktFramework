// engine — 세계 로직. 보편 역학(모든 원소·모든 세계에 같은 방식)만 소유한다.
//
// 철학(HWR/CLAUDE.md): 세계는 원소로 되어있고, 정해진 규칙으로 스스로 굴러간다.
// 여기서 역할을 가른다:
//   · 세계 로직(이 파일) = 보편 역학. 모든 원소를 순회하며 한 틱 전진시킨다.
//       관성(위치는 속도로 적분) · 뉴턴 2법칙(a = F/m) · 시간(tick) · 위상(결합) 은 *엔진이 소유*한다.
//   · 규칙(rule_NNNN.js)  = 원소에 작용하는 '힘' 또는 일으킬 '사건'의 *법칙*. 규칙은 힘을 누적(`e.f* += …`)
//       하거나 사건 의사를 표시(예: world.pendingMerges)할 뿐, 적분·tick·병합 실행은 건드리지 않는다.
//       → 규칙 계약(apply)은 보편 역학이 늘어도 그대로다.
//
// 한 틱(stepWorld):
//   ① 모든 원소의 힘 누적기(fx,fy,fz)를 0으로 초기화
//   ② 모든 원소를 순회하며 모든 규칙을 적용 — 규칙은 힘만 더하거나 사건을 표시(서로 가림 없이 누적)
//   ③ 뉴턴 적분: v += (F/m)·dt (질량=관성의 척도), x += v·dt (관성)
//   ④ 경계: 토러스 랩(좌표 동일시 — 힘 아님 → 속도·운동량 불변)
//   ⑤ 위상 재조정: 규칙이 표시한 병합(world.pendingMerges)을 실현 — 질량·운동량 보존으로 원소를 하나로
//   ⑥ tick++  (시간은 엔진이 틱당 한 번만 전진)
//
// 연속 역학(①~④)과 이산 위상(⑤)은 다른 일이다: 힘은 운동량을 더하고(보존), 결합은 세계의 원소 개수를
//   바꾼다(질량·운동량은 보존하되 운동에너지는 결합으로 흡수). 둘 다 *보편*이라 엔진이 소유한다 —
//   특정 타입을 모른 채(author 안 함) 모든 원소에 같은 방식으로 적용한다.
//
// 결정론: 힘·사건은 *현재* 상태만 읽어 누적/표시하고(②), 적분·병합은 그 뒤(③~⑤) — 적용 순서에 무관.
// Math.random 금지(규칙·시나리오 공통). 같은 입력 → 같은 출력.
export function stepWorld(world, rules, params) {
  const dt = params && params.dt != null ? params.dt : 1;
  const els = world.elements;

  // 골격 결합 세계(world.skeletal): 원자에 *안정 id* 를 1회 부여한다 — 결합은 id 쌍으로 기록되어
  //   원소 추가/재정렬에도 안전하다(rule_0008). 비-skeletal 세계는 손대지 않아 비트 동일(하위 호환).
  if (world.skeletal) {
    if (world._nextId == null) world._nextId = 0;
    for (const e of els) if (e.id == null) e.id = world._nextId++;
  }

  // ① 힘 누적기 초기화
  for (const e of els) { e.fx = 0; e.fy = 0; e.fz = 0; }
  // 이번 틱의 사건 표시판 초기화(규칙이 ②에서 채운다). 비우고 시작 → 표시 안 되면 변화 0.
  world.pendingMerges = [];       // 결합(공유·융합) → 병합(점질량 합성)
  world.pendingTransfers = [];    // 결합(이온) → 전하 이동
  world.pendingBonds = [];        // 결합(공유·골격) → 지속 링크 기록(rule_0008, 융합 X)
  world.pendingUnbonds = [];      // 분해(골격) → 링크 제거(가역 분해, rule_0008)

  // ② 모든 원소 × 모든 규칙 — 규칙은 힘만 누적하거나 사건을 표시. (위치는 아직 고정 → 적용 순서 무관)
  for (let i = 0; i < els.length; i++) {
    const e = els[i];
    for (const r of rules) if (r && typeof r.apply === 'function') r.apply(e, i, world, params);
  }

  // ③④ 뉴턴 적분 + 관성 + 토러스 랩 (3D)
  //   세계는 3차원 박스다(폭 W × 높이 H × 깊이 D). x·y·z 세 축 모두 같은 보편 역학으로 전진한다.
  //   depth(D)가 설정되면 z 도 토러스 랩 — 시뮬레이션 공간 자체가 3D(렌더 전용 아님).
  //   depth 미설정(2D 세계)이면 z 는 무경계로 남겨 하위 호환(기존 z=0 시나리오는 비트 동일).
  const W = world.width, H = world.height, D = world.depth;
  const wrapZ = typeof D === 'number' && D > 0;
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
    if (wrapZ) e.z = ((e.z % D) + D) % D;   // 3D 깊이 축 토러스 랩(depth 설정 시)
  }

  // ⑤ 위상/상태 재조정 — 규칙이 표시한 결합을 실현
  reconcileTransfers(world);  // 이온 결합: 전자(전하) 이동 (Σq 보존)
  reconcileBonds(world);      // 골격 결합: 지속 링크 기록/제거 (원자 distinct 유지 — 융합 X)
  reconcileMerges(world);     // 공유 결합(융합): 원소 병합 (질량·운동량·전하 보존)

  // ⑥ 시간 전진(엔진 전용)
  world.tick++;
}

// 이온 결합의 *메커니즘* — 규칙이 표시한 전하 이동 쌍을 받아 전자를 옮긴다.
//   규칙은 '누가 이온 결합하는지'(법칙)만 표시하고, '전자가 어디로 가는지'(en 높은 쪽으로)는 여기가 실행한다.
//   전자는 사라지지 않고 이동만 하므로 Σq 보존(한쪽 −dq, 한쪽 +dq). 병합하지 않는다 — 둘은 +/− 이온으로 남는다.
function reconcileTransfers(world) {
  const reqs = world.pendingTransfers;
  if (!Array.isArray(reqs) || reqs.length === 0) return;
  const els = world.elements;
  const n = els.length;
  for (const r of reqs) {
    if (!r) continue;
    const a = r.a, b = r.b;
    if (a < 0 || b < 0 || a >= n || b >= n || a === b) continue;
    const ea = els[a], eb = els[b];
    const dq = r.dq != null ? r.dq : 1;
    // 전자(−)는 전기음성도 높은 쪽으로: 그쪽 q 가 더 음, 반대쪽이 더 양
    const accept = (ea.en || 0) >= (eb.en || 0) ? ea : eb;  // 전자 받는 쪽(en 높음)
    const donate = accept === ea ? eb : ea;                 // 전자 주는 쪽(en 낮음)
    accept.q = (accept.q || 0) - dq;
    donate.q = (donate.q || 0) + dq;
  }
}

// 골격 결합의 *메커니즘*(보편 위상 부기) — 규칙이 표시한 링크를 위상에 기록/제거한다.
//   융합(reconcileMerges)이 원자를 하나의 질점으로 접었던 것과 달리, 여기선 원자를 *distinct 로 둔 채*
//   결합 그래프만 갱신한다. 분자 = "결합으로 연결된 원자들의 연결 성분"(저장이 아니라 그래프).
//   · 형성(pendingBonds): {a,b,order} — a,b 는 현재 elements 인덱스. 양쪽 인접 리스트 e.bonds 에
//       서로의 *id* 와 결합차수를 기록(중복 금지). 원자는 사라지지 않으니 Σm·Σq·Σmv 자동 보존.
//   · 분해(pendingUnbonds): {a,b} — a,b 는 *id*(끊는 규칙이 id 를 안다). 양쪽 인접 리스트에서 제거.
//       잔여 원자가(freeValence)는 rule_0004 가 다음 틱에 e.bonds 로부터 자동 복원 → 가역 분해.
//   타입을 모른 채 위상만 다루므로 author 안 함이 지켜진다(융합이 질량만 합산했듯).
function reconcileBonds(world) {
  const reqs = world.pendingBonds, uns = world.pendingUnbonds;
  const els = world.elements;
  const n = els.length;

  // 형성 — 인덱스 쌍 → id 기반 링크. 이미 결합된 쌍은 건너뛴다(차수 누적 방지).
  if (Array.isArray(reqs)) for (const r of reqs) {
    if (!r) continue;
    const a = r.a, b = r.b;
    if (a < 0 || b < 0 || a >= n || b >= n || a === b) continue;
    const ea = els[a], eb = els[b];
    if (ea.id == null || eb.id == null) continue;
    if (!Array.isArray(ea.bonds)) ea.bonds = [];
    if (!Array.isArray(eb.bonds)) eb.bonds = [];
    if (ea.bonds.some(x => x.other === eb.id)) continue;   // 이미 링크됨
    const order = r.order != null ? r.order : 1;
    ea.bonds.push({ other: eb.id, order });
    eb.bonds.push({ other: ea.id, order });
  }

  // 분해 — id 쌍을 양쪽 인접 리스트에서 제거. (원자는 그대로 남고 결합만 끊긴다.)
  if (Array.isArray(uns) && uns.length) for (const u of uns) {
    if (!u) continue;
    const ai = u.a, bi = u.b;                              // ids
    for (const e of els) {
      if (!Array.isArray(e.bonds) || e.bonds.length === 0) continue;
      if (e.id === ai) e.bonds = e.bonds.filter(x => x.other !== bi);
      else if (e.id === bi) e.bonds = e.bonds.filter(x => x.other !== ai);
    }
  }
}

// 결합의 *메커니즘*(보편 위상 연산) — 규칙이 표시한 병합 쌍을 받아 원소를 하나로 접는다.
//   규칙은 '무엇을 합칠지'(법칙)만 표시하고, '어떻게 합치는지'(질량 합·운동량 보존·질량중심)는 여기가 소유한다.
//   타입을 모른 채 질량만 합산하므로 author 안 함이 지켜진다.
//
// 보존: 질량 M=Σmᵢ, 운동량 ΣmᵢVᵢ(→ 합성 속도 = 질량중심 속도), 위치 = 질량중심(토러스 최근접 평균).
//   운동에너지는 결합으로 흡수되어 *감소*하고, 그 손실은 world.bondEnergy 에 누적된다(KE+bondEnergy 보존).
function reconcileMerges(world) {
  const reqs = world.pendingMerges;
  if (!Array.isArray(reqs) || reqs.length === 0) return;
  const els = world.elements;
  const n = els.length;

  // union-find — 같은 틱의 전이적 병합(A–B, B–C → 한 덩어리)을 모은다.
  const parent = new Array(n);
  for (let i = 0; i < n; i++) parent[i] = i;
  const find = x => { while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; } return x; };
  const union = (a, b) => { a = find(a); b = find(b); if (a !== b) parent[a > b ? a : b] = (a > b ? b : a); };
  for (const r of reqs) {
    if (!r) continue;
    const a = r.a, b = r.b;
    if (a >= 0 && b >= 0 && a < n && b < n && a !== b) union(a, b);
  }

  // 결합차수(order) 합산 — 그룹별로 이번 틱에 소비된 원자가(공유쌍 수). 규칙이 표시한 order 만 읽는다.
  //   freeValence(잔여 원자가)는 보편 스칼라처럼 합산하되, 결합 하나당 양쪽에서 1씩(=2·order) 소비된다.
  //   order 가 없는(구형) 요청은 0 으로 — freeValence 미설정 세계는 이 항이 영향 없음(하위 호환).
  const orderByRoot = new Map();
  for (const r of reqs) {
    if (!r) continue;
    const a = r.a, b = r.b;
    if (a >= 0 && b >= 0 && a < n && b < n && a !== b)
      orderByRoot.set(find(a), (orderByRoot.get(find(a)) || 0) + (r.order != null ? r.order : 0));
  }

  // 대표 인덱스별로 구성원을 모은다(i 오름차순 순회 → 결정론적).
  const groups = new Map();
  for (let i = 0; i < n; i++) {
    const g = find(i);
    let arr = groups.get(g);
    if (!arr) { arr = []; groups.set(g, arr); }
    arr.push(i);
  }

  const W = world.width, H = world.height, D = world.depth;
  const wrapZ = typeof D === 'number' && D > 0;
  const next = [];
  let released = 0;
  for (const idxs of groups.values()) {
    if (idxs.length === 1) { next.push(els[idxs[0]]); continue; } // 혼자면 그대로 통과

    // 질량 합·운동량 합·질량중심(토러스: 기준 원소에 대한 최근접 이미지로 평균)·KE 손실 누적
    const ref = els[idxs[0]];
    let M = 0, px = 0, py = 0, pz = 0, sx = 0, sy = 0, sz = 0, keBefore = 0, Q = 0, enW = 0;
    let freeSum = 0, anyFree = false;        // 잔여 원자가 합(공유 결합 한정 — 설정된 세계만)
    const parts = [];
    for (const k of idxs) {
      const e = els[k];
      const m = e.m > 0 ? e.m : 1;
      if (e.freeValence != null) { anyFree = true; freeSum += e.freeValence; }
      let dx = e.x - ref.x; dx -= Math.round(dx / W) * W;   // 토러스 최근접 이미지(x)
      let dy = e.y - ref.y; dy -= Math.round(dy / H) * H;   //              (y)
      let dz = (e.z || 0) - (ref.z || 0);                   //              (z, 3D 박스면 토러스)
      if (wrapZ) dz -= Math.round(dz / D) * D;
      const vz = e.vz || 0;
      M += m;
      px += m * e.vx; py += m * e.vy; pz += m * vz;
      sx += m * dx; sy += m * dy; sz += m * dz;
      keBefore += 0.5 * m * (e.vx * e.vx + e.vy * e.vy + vz * vz);
      Q += e.q || 0;                                        // 전하 합산(분자의 순전하, Σq 보존)
      enW += (e.en || 0) * m;                               // 전기음성도 질량가중(합성체 대표값)
      if (Array.isArray(e.parts)) parts.push(...e.parts); else parts.push(e);
    }
    const vx = px / M, vy = py / M, vz = pz / M;            // 운동량 보존 → 질량중심 속도
    let x = ref.x + sx / M, y = ref.y + sy / M;             // 질량중심 위치
    let z = (ref.z || 0) + sz / M;
    x = ((x % W) + W) % W; y = ((y % H) + H) % H;
    if (wrapZ) z = ((z % D) + D) % D;
    const keAfter = 0.5 * M * (vx * vx + vy * vy + vz * vz);
    released += keBefore - keAfter;                          // 결합으로 흡수된 운동에너지(≥0)

    // 표시값 재계산(시각화 전용, 창발 아님): 반경=면적 합(√Σrᵢ²), 색=질량가중 평균.
    let r2 = 0, hueW = 0;
    for (const k of idxs) { const e = els[k]; r2 += (e.r || 0) * (e.r || 0); hueW += (e.hue ?? 0) * (e.m > 0 ? e.m : 1); }
    const composite = { x, y, z, vx, vy, vz, m: M, q: Q, en: enW / M, parts };
    if (r2 > 0) composite.r = Math.sqrt(r2);
    composite.hue = hueW / M;
    // 잔여 원자가: 구성원 잔여 합 − 2·Σorder(결합 하나가 양쪽 원자가 1씩 소비). 0 이면 포화(=안정 분자, 더 결합 안 함).
    //   freeValence 를 쓰는 세계(껍질/원자가 규칙)에서만 설정 — 그 외(구형 공유 병합)는 미설정으로 남겨 하위 호환.
    if (anyFree) composite.freeValence = Math.max(0, freeSum - 2 * (orderByRoot.get(find(idxs[0])) || 0));
    next.push(composite);
  }

  world.elements = next;
  world.bondEnergy = (world.bondEnergy || 0) + released;     // 닫힌 에너지 장부: KE + bondEnergy 보존
}
