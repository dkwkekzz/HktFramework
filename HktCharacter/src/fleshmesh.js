// ===========================================================================
//  HktCharacter · 정점 로프트 살 층 (vertex flesh mesh) — "찍고 → 조정" 매체
//
//  쌓는 방식(SDF round-cone smin 스택)의 음영 한계는 구조적이다: 이웃 콘의
//  기울기 불연속(가로 밴드), smin 웰드 lump, 구 껍질 돌출. 이 층은 살을
//  레이마칭이 아니라 **실제 정점 메시**로 만들어 그 한계를 우회한다.
//
//    1) 찍기   : 뼈 체인을 따라 단면 링 정점을 "대충" 배치 (뼈 축 + 대략 반경)
//    2) 조정   : 바인드 포즈에서 각 정점을 기존 살 필드(시트 피팅된 loft+extras
//                의 SDF) 표면으로 방사 투영 — 시트에서 온 형상으로 정점이 이동
//    3) 다듬기 : Taubin 스무딩 — 웰드/밴드 고주파를 정점 단계에서 제거
//
//  런타임은 정점을 (뼈, 관절 로컬 오프셋)으로 보유해 FK 를 그대로 상속한다
//  ("살은 뼈대의 함수" 설계 결정 유지). 렌더는 평범한 메시 + smooth normal —
//  음영이 구성상 매끄럽다. SDF 는 빌드 시 "조정의 진실 원천"으로만 쓰인다.
// ===========================================================================
import * as THREE from 'three';

// ---- SDF 필드 — main.js frag 의 map()/sdSeg() JS 포트 (빌드 시 투영 전용) ----
function smin(a, b, k) {
  const h = Math.min(Math.max(0.5 + 0.5 * (b - a) / k, 0), 1);
  return b + (a - b) * h - k * h * (1 - h);
}
function sdRoundCone(px, py, pz, s) {
  const pax = px - s.ax, pay = py - s.ay, paz = pz - s.az;
  const y = pax * s.bax + pay * s.bay + paz * s.baz;
  const z = y - s.l2;
  const xvx = pax * s.l2 - s.bax * y, xvy = pay * s.l2 - s.bay * y, xvz = paz * s.l2 - s.baz * y;
  const x2 = xvx * xvx + xvy * xvy + xvz * xvz;
  const y2 = y * y * s.l2, z2 = z * z * s.l2;
  const k = Math.sign(s.rr) * s.rr * s.rr * x2;
  if (Math.sign(z) * s.a2 * z2 > k) return Math.sqrt(x2 + z2) * s.il2 - s.rb;
  if (Math.sign(y) * s.a2 * y2 < k) return Math.sqrt(x2 + y2) * s.il2 - s.ra;
  return (Math.sqrt(x2 * s.a2 * s.il2) + y * s.rr) * s.il2 - s.ra;
}
// 납작화 2축 포함 세그먼트 SDF (셰이더 sdSeg 와 동일 의미론 — f<0 은 one-sided)
function sdSeg(s, px, py, pz) {
  let w = 1;
  if (s.f != null && Math.abs(s.f) < 0.999) {
    const fa = Math.abs(s.f); w = Math.min(w, fa);
    const d = (px - s.ax) * s.nx + (py - s.ay) * s.ny + (pz - s.az) * s.nz;
    if (s.f > 0 || d > 0) { const m = (1 / fa - 1) * d; px += m * s.nx; py += m * s.ny; pz += m * s.nz; }
  }
  if (s.f2 != null && Math.abs(s.f2) < 0.999) {
    const fa = Math.abs(s.f2); w = Math.min(w, fa);
    const d = (px - s.ax) * s.mx + (py - s.ay) * s.my + (pz - s.az) * s.mz;
    if (s.f2 > 0 || d > 0) { const m = (1 / fa - 1) * d; px += m * s.mx; py += m * s.my; pz += m * s.mz; }
  }
  return sdRoundCone(px, py, pz, s) * w;
}
// 세그먼트 전처리 — [평범 | detail | cut] 순서 보존 (셰이더 uploadBones 와 동일)
function prepSegs(segs) {
  const isDetail = s => s.cut || s.k != null || s.f != null || s.f2 != null;
  const ordered = [
    ...segs.filter(s => !isDetail(s)),
    ...segs.filter(s => isDetail(s) && !s.cut),
    ...segs.filter(s => s.cut),
  ];
  return ordered.map(s => {
    const bax = s.b.x - s.a.x, bay = s.b.y - s.a.y, baz = s.b.z - s.a.z;
    const l2 = bax * bax + bay * bay + baz * baz;
    const rr = s.ra - s.rb;
    return {
      id: s.id ?? '',
      ax: s.a.x, ay: s.a.y, az: s.a.z, bax, bay, baz,
      l2, il2: 1 / l2, rr, a2: l2 - rr * rr, ra: s.ra, rb: s.rb,
      k: s.k ?? null, cut: !!s.cut, detail: isDetail(s),
      f: s.f ?? null, nx: s.n?.x ?? 0, ny: s.n?.y ?? 0, nz: s.n?.z ?? 1,
      f2: s.f2 ?? null, mx: s.n2?.x ?? 0, my: s.n2?.y ?? 0, mz: s.n2?.z ?? 1,
      rmax: Math.max(s.ra, s.rb),
    };
  });
}
function fieldAt(subset, px, py, pz, gk) {
  let d = 1e9;
  for (let i = 0; i < subset.length; i++) {
    const s = subset[i];
    const ds = s.detail ? sdSeg(s, px, py, pz) : sdRoundCone(px, py, pz, s);
    const k = s.k ?? gk;
    d = s.cut ? -smin(-d, ds, k) : smin(d, ds, k);
  }
  return d;
}
// 점 → 캡슐 축 거리 (링 단위 세그먼트 프리필터 — 투영 비용의 지배 항 절감)
function distToSegAxis(px, py, pz, s) {
  const pax = px - s.ax, pay = py - s.ay, paz = pz - s.az;
  const t = Math.min(Math.max((pax * s.bax + pay * s.bay + paz * s.baz) * s.il2, 0), 1);
  const dx = pax - s.bax * t, dy = pay - s.bay * t, dz = paz - s.baz * t;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}
// 방사 투영: c 에서 dir 로 나가며 "첫 번째 표면 탈출점"을 찾는다.
// 마지막 음수가 아니라 첫 −→+ 교차를 쓰는 이유: 허리 높이의 옆 방향 레이가
// 팔 살까지 관통하면 몸통이 팔을 감싸는 풍선이 된다 — 자기 표면에서 멈춰야 한다.
// 단, GAP(8mm) 이하의 얇은 양수 틈은 같은 표면으로 보고 건너뛴다 — 둔부·허벅지
// 주름의 수 mm 틈에서 행마다 조기 정지/관통이 교차하면 톱니 프린지가 생긴다(교훈).
function projectRay(subset, gk, cx, cy, cz, dx, dy, dz, sMax) {
  const STEP = 0.005, GAP = 0.008;
  let entered = fieldAt(subset, cx, cy, cz, gk) < 0;
  let lastIn = entered ? 0 : -1;
  let exitAt = -1; // 첫 탈출 교차의 s (틈 판정 대기 중)
  for (let s = STEP; s <= sMax + GAP; s += STEP) {
    const d = fieldAt(subset, cx + dx * s, cy + dy * s, cz + dz * s, gk);
    if (d < 0) {
      lastIn = s; entered = true;
      if (exitAt >= 0 && s - exitAt <= GAP) exitAt = -1; // 얇은 틈 — 계속 진행
    } else if (entered && exitAt < 0) {
      exitAt = s;
    } else if (exitAt >= 0 && s - exitAt > GAP) break; // 틈이 두껍다 — 진짜 표면
  }
  if (exitAt < 0) return entered ? sMax : null; // 탈출 못 함(깊은 내부) — 내부에 숨긴다
  let lo = Math.max(lastIn, exitAt - STEP), hi = exitAt;
  if (fieldAt(subset, cx + dx * lo, cy + dy * lo, cz + dz * lo, gk) >= 0) lo = lastIn;
  for (let i = 0; i < 12; i++) {
    const m = (lo + hi) / 2;
    if (fieldAt(subset, cx + dx * m, cy + dy * m, cz + dz * m, gk) < 0) lo = m; else hi = m;
  }
  return (lo + hi) / 2;
}

// ---- 체인 정의 — 이름 기반 (grammar 원칙: 특정 리그 하드코딩 금지) ----------
// bones: 자식 관절 simple name 사슬. 링 높이 t 는 profile.loft 스택이 있으면
// 그대로(시트 피팅 해상도 계승), 없으면 균등 분할. mirror 는 Left/Right 쌍.
// field: 이 체인의 투영이 "보는" 세그먼트 필터 (id 기준) — 몸통 레이가 팔 살을
// 관통해 팔을 감싸거나(가슴 선반), 팔 레이가 가슴에 들러붙는 교차 오염을 막는다.
const otherSide = side => (side === 'Left' ? 'Right' : 'Left');
const CHAIN_DEFS = [
  { bones: ['Spine', 'Spine1', 'Spine2', 'Neck', 'Head', 'HeadTop_End'], around: 24, mirror: false, inset: 0,
    field: () => id => !/Arm|Hand/.test(id) },
  { bones: ['Leg', 'Foot'], around: 18, mirror: true, inset: 0.0015,
    field: side => id => !/Arm|Hand/.test(id) && !id.includes(otherSide(side)) },
  { bones: ['ToeBase'], around: 12, mirror: true, inset: 0.0015,
    field: side => id => /Leg|Foot|Toe/.test(id) && !id.includes(otherSide(side)) },
  { bones: ['Arm', 'ForeArm', 'Hand'], around: 12, mirror: true, inset: 0.0015,
    field: side => id => /Arm|Hand|Shoulder/.test(id) && !id.includes(otherSide(side)) },
];
const UNIFORM_TS = [0, 0.25, 0.5, 0.75, 1]; // loft 없는 뼈(팔 등)의 균등 링
const CAP_PHIS = [Math.PI / 8, Math.PI / 4, Math.PI * 3 / 8]; // 돔 캡 링의 극각

// 링 평면 직교 프레임 — 축과 나란하지 않은 기준축을 골라 (u,v,axis) 정규 직교.
// u×v=axis 이 되도록 잡는다 (권선 방향 → 바깥 법선 보장의 근거).
function ringFrame(axis) {
  const n = axis.clone().normalize();
  const ref = Math.abs(n.z) < 0.9 ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(0, 1, 0);
  const v = ref.clone().addScaledVector(n, -n.dot(ref)).normalize();
  const u = new THREE.Vector3().crossVectors(v, n);
  return { n, u, v };
}

// ===========================================================================
//  buildFleshMesh — 바인드 포즈에서 1회 실행. segs = 현재 SDF 세그먼트 전부
//  (loft+extras 포함), getBone(childSimpleName) → { a: 부모 관절 월드 위치,
//  quat: 자식 관절 월드 회전 } | null.
// ===========================================================================
export function buildFleshMesh({ segs, getBone, profile, radiusForName, globalK }) {
  const ordered = prepSegs(segs);
  const positions = [];   // 바인드 월드 (fit — 투영+스무딩 결과)
  const roughPos = [];    // 바인드 월드 (rough — 찍기만 한 상태, 단계 시각화용)
  const indices = [];
  const groups = [];      // { child, vids } — 프레임마다 뼈 하나 resolve 후 일괄 변환
  const neighbors = [];   // Taubin 스무딩용 인접 리스트
  let built = 0;

  const pushVert = (p, rough) => {
    positions.push(p.x, p.y, p.z);
    roughPos.push(rough.x, rough.y, rough.z);
    neighbors.push([]);
    return positions.length / 3 - 1;
  };

  for (const def of CHAIN_DEFS) {
    for (const prefix of def.mirror ? ['Left', 'Right'] : ['']) {
      // ---- 1) 찍기: 체인을 따라 링(중심·프레임·대략 반경) 나열 ----------------
      const rings = []; // { child, c, u, v, n, rGuess, child2, w2 }
      const BU = [];    // 체인에서 실제 쓰인 뼈 [{ name, a, b }] — 관절 경계 블렌딩용
      let ok = true;
      for (const bone of def.bones) {
        const gb = getBone(prefix + bone);
        if (!gb || !gb.b) { ok = false; break; }
        const axis = gb.b.clone().sub(gb.a);
        const { n, u, v } = ringFrame(axis);
        BU.push({ name: prefix + bone, a: gb.a.clone(), b: gb.b.clone() });
        const stack = profile.loft?.[bone];
        const disks = stack?.disks?.length >= 2 ? stack.disks : null;
        const ts = disks ? disks.map(d => d.t) : UNIFORM_TS;
        for (let i = 0; i < ts.length; i++) {
          const c = gb.a.clone().addScaledVector(axis, ts[i]);
          if (rings.length && c.distanceToSquared(rings[rings.length - 1].c) < 1e-6) continue; // 관절 공유 링 중복 제거
          const rGuess = disks
            ? Math.max(disks[i].rx, (disks[i].zf - disks[i].zb) / 2) + 0.01
            : radiusForName(prefix + bone) * 1.3 + 0.012;
          rings.push({ child: prefix + bone, boneIdx: BU.length - 1, c, u, v, n, rGuess, child2: null, w2: 0 });
        }
      }
      if (!ok || rings.length < 2) continue; // 관절 없는 리그 → 체인 통째로 생략 (조용히)
      // 관절 경계 W(6cm) 안의 링은 이웃 뼈와 이중 바인딩 — 무릎·팔꿈치가 접힐 때
      // 강체 부착 링이 찢어지는(전단) v1 문제를 간이 스키닝으로 해소. 경계 정확히
      // 위의 공유 링은 w2=0.5 (반은 허벅지, 반은 정강이).
      const BLEND_W = 0.06;
      for (const ring of rings) {
        const bi = ring.boneIdx, cands = [];
        if (bi > 0) cands.push({ pos: BU[bi].a, other: BU[bi - 1].name });
        if (bi + 1 < BU.length) cands.push({ pos: BU[bi].b, other: BU[bi + 1].name });
        for (const cd of cands) {
          const d = ring.c.distanceTo(cd.pos);
          const w = d < BLEND_W ? 0.5 * (1 - d / BLEND_W) : 0;
          if (w > ring.w2) { ring.w2 = w; ring.child2 = cd.other; }
        }
      }

      // ---- 2) 조정: 각 링 정점을 살 필드 표면으로 방사 투영 -------------------
      const N = def.around;
      const rows = [];     // rows[r][j] = vid
      const project = (ring, dir, sMax) => {
        const s = projectRay(ring.subset, globalK, ring.c.x, ring.c.y, ring.c.z, dir.x, dir.y, dir.z, sMax);
        // 다른 부위 관통 방지: 대략 반경의 2.2배를 넘는 탈출은 "몸통 반대편" 같은
        // 남의 표면이다 (팔 링의 안쪽 레이가 가슴을 뚫고 나가던 교훈) — rough 로 후퇴
        let r = s == null ? ring.rGuess : s;
        if (r > ring.rGuess * 2.2) r = ring.rGuess;
        return Math.max(r - def.inset, 0.002); // inset: 몸통과 겹치는 팔다리 면의 z-fighting 완화
      };
      const dirAt = (ring, j) => {
        const th = j / N * Math.PI * 2;
        return ring.u.clone().multiplyScalar(Math.cos(th)).addScaledVector(ring.v, Math.sin(th));
      };
      const fieldOk = def.field(prefix);
      const visible = ordered.filter(s => fieldOk(s.id));
      for (const ring of rings) {
        const sMax = ring.rGuess * 2.5 + 0.12;
        ring.sMax = sMax;
        ring.subset = visible.filter(s => distToSegAxis(ring.c.x, ring.c.y, ring.c.z, s) <= sMax + s.rmax + (s.k ?? globalK) + 0.05);
      }
      const emitRing = (ring, dirFn) => {
        const row = [];
        for (let j = 0; j < N; j++) {
          const dir = dirFn(j);
          const r = project(ring, dir, ring.sMax);
          row.push(pushVert(
            ring.c.clone().addScaledVector(dir, r),
            ring.c.clone().addScaledVector(dir, ring.rGuess)));
        }
        rows.push(row);
        groups.push({ child: ring.child, child2: ring.child2, w2: ring.w2, vids: row });
      };
      // 시작 캡(돔): 극 → 극각 큰 순으로 링을 깔아 튜브 진행 방향과 정렬
      const capRing = (ring, e, phi) => emitRing(ring, j =>
        dirAt(ring, j).multiplyScalar(Math.cos(phi)).addScaledVector(e, Math.sin(phi)));
      const first = rings[0], last = rings[rings.length - 1];
      const eS = first.n.clone().negate(), eE = last.n.clone();
      const emitPole = (ring, e) => {
        const r = project(ring, e, ring.sMax);
        const vid = pushVert(ring.c.clone().addScaledVector(e, r), ring.c.clone().addScaledVector(e, ring.rGuess));
        groups.push({ child: ring.child, child2: ring.child2, w2: ring.w2, vids: [vid] });
        return vid;
      };
      const poleStart = emitPole(first, eS);
      for (let i = CAP_PHIS.length - 1; i >= 0; i--) capRing(first, eS, CAP_PHIS[i]);
      for (const ring of rings) emitRing(ring, j => dirAt(ring, j));
      for (const phi of CAP_PHIS) capRing(last, eE, phi);
      const poleEnd = emitPole(last, eE);

      // ---- 토폴로지: 이웃 링 쿼드 스트립 + 극 팬 (권선 = 바깥 법선) ----------
      const R = rows.length;
      for (let r = 0; r + 1 < R; r++) {
        for (let j = 0; j < N; j++) {
          const j1 = (j + 1) % N;
          const a = rows[r][j], b = rows[r][j1], c = rows[r + 1][j1], d = rows[r + 1][j];
          indices.push(a, b, c, a, c, d);
        }
      }
      for (let j = 0; j < N; j++) {
        const j1 = (j + 1) % N;
        indices.push(rows[0][j], rows[0][j1], poleStart);
        indices.push(rows[R - 1][j1], rows[R - 1][j], poleEnd);
      }
      // 스무딩 인접: 링 내 좌우 + 링 간 같은 각도 + 극
      for (let r = 0; r < R; r++) {
        for (let j = 0; j < N; j++) {
          const vid = rows[r][j], nb = neighbors[vid];
          nb.push(rows[r][(j + 1) % N], rows[r][(j - 1 + N) % N]);
          nb.push(r > 0 ? rows[r - 1][j] : poleStart);
          nb.push(r + 1 < R ? rows[r + 1][j] : poleEnd);
        }
      }
      neighbors[poleStart].push(...rows[0]);
      neighbors[poleEnd].push(...rows[R - 1]);
      built++;
    }
  }

  // ---- 3) 다듬기: Taubin(λ|μ) 스무딩 — 수축 없이 고주파만 제거 --------------
  const nv = positions.length / 3;
  {
    const tmp = new Float64Array(nv * 3);
    const pass = lambda => {
      for (let i = 0; i < nv; i++) {
        const nb = neighbors[i];
        if (!nb.length) { tmp[i * 3] = positions[i * 3]; tmp[i * 3 + 1] = positions[i * 3 + 1]; tmp[i * 3 + 2] = positions[i * 3 + 2]; continue; }
        let ax = 0, ay = 0, az = 0;
        for (const j of nb) { ax += positions[j * 3]; ay += positions[j * 3 + 1]; az += positions[j * 3 + 2]; }
        ax /= nb.length; ay /= nb.length; az /= nb.length;
        tmp[i * 3] = positions[i * 3] + lambda * (ax - positions[i * 3]);
        tmp[i * 3 + 1] = positions[i * 3 + 1] + lambda * (ay - positions[i * 3 + 1]);
        tmp[i * 3 + 2] = positions[i * 3 + 2] + lambda * (az - positions[i * 3 + 2]);
      }
      for (let i = 0; i < nv * 3; i++) positions[i] = tmp[i];
    };
    for (let it = 0; it < 8; it++) { pass(0.5); pass(-0.53); }
  }

  // ---- 정점을 뼈-로컬로 저장: p = a + quat · local — FK 상속의 전부.
  //      이중 바인딩 링은 이웃 뼈 프레임의 local 도 함께 굽는다 (블렌드 스키닝).
  const bakeLocal = worldArr => {
    const l1 = new Float32Array(nv * 3), l2 = new Float32Array(nv * 3);
    const inv = new THREE.Quaternion(), p = new THREE.Vector3();
    const bakeInto = (out, g, boneName) => {
      const gb = getBone(boneName);
      inv.copy(gb.quat).invert();
      for (const vid of g.vids) {
        p.set(worldArr[vid * 3] - gb.a.x, worldArr[vid * 3 + 1] - gb.a.y, worldArr[vid * 3 + 2] - gb.a.z).applyQuaternion(inv);
        out[vid * 3] = p.x; out[vid * 3 + 1] = p.y; out[vid * 3 + 2] = p.z;
      }
    };
    for (const g of groups) {
      bakeInto(l1, g, g.child);
      if (g.child2) bakeInto(l2, g, g.child2);
    }
    return { l1, l2 };
  };
  const localFit = bakeLocal(positions);
  const localRough = bakeLocal(roughPos);
  let local = localFit;

  // ---- 지오메트리 / 재질 (SDF 렌더와 동일한 준-툰 밴드+림 — eval 스킨 검출 호환) ----
  const geo = new THREE.BufferGeometry();
  const posAttr = new THREE.BufferAttribute(new Float32Array(nv * 3), 3);
  posAttr.setUsage(THREE.DynamicDrawUsage);
  geo.setAttribute('position', posAttr);
  geo.setIndex(indices);
  const mat = new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color('#f7b58c') } },
    vertexShader: `varying vec3 vN; varying vec3 vP;
      void main(){ vN = normal; vP = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `varying vec3 vN; varying vec3 vP; uniform vec3 uColor;
      void main(){
        vec3 L = normalize(vec3(0.55, 0.85, 0.45));
        vec3 n = normalize(vN); if (!gl_FrontFacing) n = -n;
        vec3 rd = normalize(vP - cameraPosition);
        float dif = clamp(dot(n, L), 0.0, 1.0);
        float band = smoothstep(0.0, 0.35, dif) * 0.55 + smoothstep(0.45, 0.9, dif) * 0.45;
        float rim = pow(1.0 - clamp(dot(n, -rd), 0.0, 1.0), 3.0);
        vec3 base = uColor * mix(0.92, 1.06, clamp(vP.y * 0.28 + 0.3, 0.0, 1.0));
        vec3 col = base * (0.30 + 0.85 * band);
        col += vec3(0.55, 0.72, 0.95) * rim * 0.5; col += base * 0.06;
        gl_FragColor = vec4(pow(col, vec3(0.4545)), 1.0); }`,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false; // 정점이 매 프레임 CPU 갱신 — 바운드 무효

  // ---- 런타임: 매 프레임 뼈 변환만 다시 얹는다 (투영/스무딩 재실행 없음) ------
  const _v = new THREE.Vector3(), _v2 = new THREE.Vector3();
  const update = resolveBone => {
    const arr = posAttr.array;
    for (const g of groups) {
      const gb = resolveBone(g.child);
      if (!gb) continue;
      const gb2 = g.child2 ? resolveBone(g.child2) : null;
      const w2 = gb2 ? g.w2 : 0, w1 = 1 - w2;
      for (const vid of g.vids) {
        _v.set(local.l1[vid * 3], local.l1[vid * 3 + 1], local.l1[vid * 3 + 2]).applyQuaternion(gb.quat).add(gb.a);
        if (gb2) {
          _v2.set(local.l2[vid * 3], local.l2[vid * 3 + 1], local.l2[vid * 3 + 2]).applyQuaternion(gb2.quat).add(gb2.a);
          _v.multiplyScalar(w1).addScaledVector(_v2, w2);
        }
        arr[vid * 3] = _v.x; arr[vid * 3 + 1] = _v.y; arr[vid * 3 + 2] = _v.z;
      }
    }
    posAttr.needsUpdate = true;
    geo.computeVertexNormals();
  };
  const setStage = stage => { local = stage === 'rough' ? localRough : localFit; };
  return { mesh, update, setStage, stats: { verts: nv, tris: indices.length / 3, chains: built } };
}
