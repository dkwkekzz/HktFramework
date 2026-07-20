// ============================================================================
//  eval/smoke.mjs — 파이프라인 헤드리스 검증 (WebGL 불필요)
//
//  샌드박스가 headless Chromium 을 막으므로, 실제 모듈(skeleton/muscles/skin/
//  retarget)을 Node 에서 그대로 구동해 3단계가 성립하는지 수치로 검증한다.
//  육안 확인은 `npm run dev` 로 사용자가 별도 수행.
//
//  실행: node eval/smoke.mjs
// ============================================================================
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { loadSkeleton, replant, boneBox } from '../src/skeleton.js';
import { MuscleLayer } from '../src/muscles.js';
import { bakeSkin } from '../src/skin.js';
import { detectLandmarks, landmarkPoints } from '../src/landmarks.js';
import { analyzeJoints } from '../src/joints.js';
import { BODY_PRESETS } from '../src/anatomy.js';
import { parseClipFBX, bakeClip, measureGroundY } from '../src/retarget.js';

const toBuf = p => { const b = readFileSync(p); return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength); };
let fails = 0;
const ok = (cond, msg) => { console.log(`${cond ? '  ✓' : '  ✗ FAIL'} ${msg}`); if (!cond) fails++; };

for (const model of ['X Bot', 'Y Bot']) {
  console.log(`\n=== ${model} ===`);

  // ① 뼈 -------------------------------------------------------------------
  const rig = loadSkeleton(toBuf(`public/assets/character/${model}.fbx`));
  replant(rig);
  ok(rig.drivers.length >= 60, `구동 뼈 ${rig.drivers.length}개 (≥60)`);
  ok(['hips', 'leftarm', 'rightupleg', 'head'].every(n => rig.boneMap.has(n)), '핵심 뼈 매핑 존재');
  const bb = boneBox(rig), size = new THREE.Vector3(); bb.getSize(size);
  ok(Math.abs(size.y - 1.7) < 0.05, `골격 키 ${size.y.toFixed(3)}m (≈1.7)`);
  ok(Math.abs(bb.min.y) < 1e-3, `발 접지 min.y=${bb.min.y.toFixed(4)}`);

  // ② 근육 -----------------------------------------------------------------
  const scene = new THREE.Scene();
  const muscles = new MuscleLayer(scene);
  muscles.build(rig);
  ok(muscles.items.length >= 28, `근육 ${muscles.items.length}개 (≥28)`);
  const caps = muscles.getCapsules();
  ok(caps.length > muscles.items.length, `피부 캡슐 ${caps.length}개 (근육+뼈패딩)`);
  ok(caps.every(c => c.r > 0 && isFinite(c.a.x) && isFinite(c.b.y)), '캡슐 반지름>0·좌표 유한');

  // WP-01 · 부착 패치 (§19.1 구조 검증 + §7.1 부착 불변) ---------------------
  const att = muscles.getAttachments();
  ok(att.length === muscles.items.length * 2, `부착점 ${att.length}개 (근육×2)`);
  ok(att.every(a => a.r > 0 && isFinite(a.world.x) && isFinite(a.pivot.y)), '부착 반지름>0·좌표 유한');
  const byId = new Map(); // 근육별 origin/insertion 개수
  for (const a of att) { const e = byId.get(a.id) || { o: 0, i: 0 }; e[a.role === 'origin' ? 'o' : 'i']++; byId.set(a.id, e); }
  ok([...byId.values()].every(e => e.o >= 1 && e.i >= 1), '모든 근육이 origin+insertion 보유(§19.1)');
  ok(muscles.items.every(it => it.oBone !== it.iBone), 'origin≠insertion 뼈');
  // §7.1: 팔(상완) 길이 ×1.3 → 부착점이 앵커 뼈와 1:1 이동(비율 변화에 부착 유지)
  const arm = rig.boneMap.get('leftforearm');
  if (arm) {
    const bic0 = att.filter(a => a.id === 'biceps.L');
    const o0 = bic0.find(a => a.role === 'origin'), i0 = bic0.find(a => a.role === 'insertion');
    const fbP0 = arm.getWorldPosition(new THREE.Vector3());
    const savedPos = arm.position.clone();
    arm.position.multiplyScalar(1.3);           // 상완 길이를 로컬 축 그대로 30% 늘림
    rig.obj.updateMatrixWorld(true);
    const boneDelta = arm.getWorldPosition(new THREE.Vector3()).distanceTo(fbP0);
    const bic1 = muscles.getAttachments().filter(a => a.id === 'biceps.L');
    const o1 = bic1.find(a => a.role === 'origin'), i1 = bic1.find(a => a.role === 'insertion');
    ok(o0 && i0 && Math.abs(i0.world.distanceTo(i1.world) - boneDelta) < 2e-3,
      `부착 불변: insertion 이 앵커 뼈와 1:1 이동 (Δ뼈=${boneDelta.toFixed(3)})`);
    ok(o0.world.distanceTo(o1.world) < 2e-3, '부착 불변: 반대쪽 origin 은 뼈 이동에 불변');
    arm.position.copy(savedPos);                // rest 복원 (이후 피부 굽기가 rest 를 봄)
    rig.obj.updateMatrixWorld(true);
  }

  // WP-02 · 관절 통과 → 포즈 반응 (§19.3 기능 검증): 팔꿈치 굴곡 시 이두 단축·굵어짐 ---
  const fore = rig.boneMap.get('leftforearm');
  const biceps = () => muscles.getBellies().find(x => x.id === 'biceps.L');
  if (fore && biceps()) {
    const b0 = biceps();
    const savedRot = fore.rotation.clone();
    fore.rotation.x += THREE.MathUtils.degToRad(120); // 팔꿈치 굴곡
    rig.obj.updateMatrixWorld(true);
    const b1 = biceps();
    ok(b1.len < b0.len * 0.9, `이두 굴곡 시 단축 ${b0.len.toFixed(3)}→${b1.len.toFixed(3)}m (§19.3)`);
    ok(b1.radius > b0.radius * 1.05, `이두 굴곡 시 굵어짐(부피 보존) ${b0.radius.toFixed(4)}→${b1.radius.toFixed(4)}m`);
    fore.rotation.copy(savedRot);               // rest 복원
    rig.obj.updateMatrixWorld(true);
  }

  // WP-02b · Route Solver + Wrap (§6·§19.3): 조건부 wrap 이 팔꿈치를 우회하되 이두 단축을
  //  매끄럽게(불연속 없이) 유지하는가. wrap engage + 단조 단축 + 전이 점프 작음.
  {
    const fa = rig.boneMap.get('leftforearm');
    if (fa) {
      const saved = fa.rotation.clone(), lens = []; let engaged = false;
      for (const deg of [0, 30, 60, 90, 120]) {
        fa.rotation.copy(saved); fa.rotation.x += THREE.MathUtils.degToRad(deg); rig.obj.updateMatrixWorld(true);
        const bb = muscles.getBellies().find(x => x.id === 'biceps.L');
        lens.push(bb.len); if (bb.wrapped) engaged = true;
      }
      fa.rotation.copy(saved); rig.obj.updateMatrixWorld(true);
      ok(engaged, 'WP-02b: 이두 wrap engage (팔꿈치 우회 §6)');
      let mono = true, maxJump = 0;
      for (let i = 1; i < lens.length; i++) { if (lens[i] > lens[i - 1] + 1e-4) mono = false; maxJump = Math.max(maxJump, Math.abs(lens[i] - lens[i - 1])); }
      ok(mono, `WP-02b: 이두 굴곡 단조 단축 [${lens.map(l => l.toFixed(3)).join(', ')}]`);
      ok(maxJump < 0.06, `WP-02b: wrap 전이 점프 ${(maxJump * 1000).toFixed(0)}mm <60mm (§19.3 연속성)`);
    }
  }

  // WP-04 · Joint Influence & 기능 근육 (§7.4·§10.5): 삼두(길항근)가 팔꿈치 굴곡 시 신장·얇아짐,
  //  이두(주동근)와 반대로 — 길항쌍(agonist↔antagonist). 길이를 관절 굴곡각의 함수로 잇는다.
  {
    const fa = rig.boneMap.get('leftforearm');
    if (fa) {
      const saved = fa.rotation.clone();
      const at = d => { fa.rotation.copy(saved); fa.rotation.x += THREE.MathUtils.degToRad(d); rig.obj.updateMatrixWorld(true); return muscles.getBellies(); };
      const g0 = at(0), g1 = at(120);
      fa.rotation.copy(saved); rig.obj.updateMatrixWorld(true);
      const t0 = g0.find(x => x.id === 'triceps.L'), t1 = g1.find(x => x.id === 'triceps.L');
      const b0 = g0.find(x => x.id === 'biceps.L'), b1 = g1.find(x => x.id === 'biceps.L');
      ok(t1.len > t0.len * 1.1, `WP-04: 삼두 굴곡 시 신장 ${t0.len.toFixed(3)}→${t1.len.toFixed(3)}m (§10.1 길항)`);
      ok(t1.radius < t0.radius, `WP-04: 삼두 신장 시 얇아짐 ${t0.radius.toFixed(4)}→${t1.radius.toFixed(4)}m`);
      ok(b1.len < b0.len && t1.len > t0.len, 'WP-04: 길항쌍 — 이두 단축 ↔ 삼두 신장(§10.5)');
    }
  }

  // 근육 좌우 대칭 (frame lat 정합, §19.4): 짝 근육 벨리 center 가 x-미러여야 한다.
  //  (cross(axis,ant) 가 우측에서 미러의 음수로 나와 l 오프셋이 2l 어긋나던 버그의 회귀 가드.)
  {
    const bel = muscles.getBellies(), by = new Map();
    for (const b of bel) { const base = b.id.replace(/\.[LR]$/, ''); const e = by.get(base) || {}; e[b.id.endsWith('.L') ? 'L' : b.id.endsWith('.R') ? 'R' : 'C'] = b; by.set(base, e); }
    let worst = 0;
    for (const e of by.values()) if (e.L && e.R) { const m = e.L.center.clone(); m.x *= -1; worst = Math.max(worst, m.distanceTo(e.R.center)); }
    ok(worst < 0.005, `근육 좌우 대칭: 짝 벨리 최대 오차 ${(worst * 1000).toFixed(2)}mm <5mm (§19.4)`);
  }

  // WP-11 · Bone Landmark Detection (§9.2·§19.1): 랜드마크가 프록시 표면에 있고 좌우 대칭 -----
  {
    const lm = detectLandmarks(rig);
    ok(lm.size === rig.drivers.length, `랜드마크 세트 ${lm.size}개 (구동 뼈당 1)`);
    const arm = lm.get('leftarm');
    ok(!!arm && Math.abs(arm.axis.length() - 1) < 1e-3, '랜드마크 축 단위벡터');
    // 표면 점(양 끝 × 4면)이 프록시 반지름만큼 끝에서 벗어났는가
    let surfOk = true;
    for (const s of landmarkPoints(lm)) {
      if (s.name === 'proximal' || s.name === 'distal') continue;
      const set = lm.get(s.sn);
      const end = s.name.startsWith('proximal') ? set.proximal : set.distal;
      if (Math.abs(s.p.distanceTo(end) - set.radius) > 1e-4) { surfOk = false; break; }
    }
    ok(surfOk, '표면 랜드마크가 프록시 반지름에 위치(§9.2)');
    // 축이 proximal→distal 방향(비-리프)
    ok(arm.distal.distanceTo(arm.proximal) > 0.05 && arm.axis.dot(arm.distal.clone().sub(arm.proximal)) > 0, '축이 원위 방향');
    // 좌우 대칭: leftarm ↔ rightarm proximal 이 x-미러, lateral 면이 좌우 반대
    const la = lm.get('leftarm'), ra = lm.get('rightarm');
    if (la && ra) {
      const mir = la.proximal.clone(); mir.x *= -1;
      ok(mir.distanceTo(ra.proximal) < 0.02, `랜드마크 좌우 대칭 (Δ=${mir.distanceTo(ra.proximal).toFixed(3)})`);
      ok(Math.sign(la.faces.lat.x || -1) === -Math.sign(ra.faces.lat.x || 1), 'lateral 면이 좌우 반대(정중선 바깥)');
    }

    // WP-12 · Joint Function Analysis (§9.3): 관절 유형·자유도·굴곡축 -----------------------
    const jt = analyzeJoints(rig, lm);
    ok(jt.size >= 8, `관절 기능 ${jt.size}개 (≥8: 팔꿈치·무릎·어깨·고관절 좌우 등)`);
    const elbow = jt.get('leftforearm'), shoulder = jt.get('leftarm'), knee = jt.get('leftleg');
    ok(elbow && elbow.type === 'hinge' && elbow.dof === 1, '팔꿈치 = hinge 1DOF');
    ok(knee && knee.type === 'hinge' && knee.dof === 1, '무릎 = hinge 1DOF');
    ok(shoulder && shoulder.type === 'ball' && shoulder.dof === 3, '어깨 = ball 3DOF');
    ok(elbow && Math.abs(elbow.flexionAxis.length() - 1) < 1e-3, '굴곡축 단위벡터');
    ok(elbow && elbow.range.max > elbow.range.min, '회전 범위 min<max');
    // 좌우 팔꿈치 굴곡축이 x-미러(대칭)
    const re = jt.get('rightforearm');
    if (elbow && re) {
      const mirAx = elbow.flexionAxis.clone(); mirAx.x *= -1;
      ok(mirAx.distanceTo(re.flexionAxis) < 0.05 || mirAx.clone().negate().distanceTo(re.flexionAxis) < 0.05,
        '좌우 팔꿈치 굴곡축 대칭');
    }
  }

  // ③ 피부 (굽기) ----------------------------------------------------------
  const t0 = Date.now();
  const { mesh, skeleton, stats } = bakeSkin(rig, caps);
  const bakeMs = Date.now() - t0;
  ok(mesh.isSkinnedMesh, 'SkinnedMesh 생성');
  ok(stats.tris > 1500, `피부 삼각형 ${stats.tris} (>1500)`);
  const g = mesh.geometry;
  ok(!!g.attributes.skinIndex && !!g.attributes.skinWeight, 'skinIndex/skinWeight 속성 존재');
  const si = g.attributes.skinIndex.array;
  ok(si.every(v => v < skeleton.bones.length), `skinIndex 전부 < 뼈수(${skeleton.bones.length})`);
  const sw = g.attributes.skinWeight.array;
  let wOk = true;
  for (let i = 0; i < sw.length; i += 4) {
    const s = sw[i] + sw[i + 1] + sw[i + 2] + sw[i + 3];
    if (Math.abs(s - 1) > 1e-2) { wOk = false; break; }
  }
  ok(wOk, 'skinWeight 각 정점 합 ≈ 1');
  // 피부 bbox — 사람 실루엣(키 ~1.7, 폭 0.3~0.7)
  g.computeBoundingBox();
  const sz = new THREE.Vector3(); g.boundingBox.getSize(sz);
  ok(sz.y > 1.55 && sz.y < 1.95, `피부 높이 ${sz.y.toFixed(2)}m`);
  // 바인드는 T-포즈(팔 수평) — 폭은 팔 벌린 스팬(≈키). 손끝까지 살이 붙었는지 확인.
  ok(sz.x > 1.2 && sz.x < 1.95, `피부 폭(T-포즈 스팬) ${sz.x.toFixed(2)}m`);
  ok(sz.z > 0.12 && sz.z < 0.5, `피부 두께(전후) ${sz.z.toFixed(2)}m`);
  console.log(`    (굽기 ${bakeMs}ms · 정점 ${stats.verts})`);

  // WP-09 · 조직 패킹(§9.8·§19.2 skin escape): 피부가 캡슐 union 표면을 감싸는가.
  //  가산 합이면 겹침부(몸통·관절)가 부풀어 정점이 멀리 뜬다(판때기). smooth-max union 은
  //  표면을 공유하므로 escape 가 작다. 정점별 최근접 캡슐 표면거리(dist−r)가 임계 초과면 escape.
  {
    const segD = (px, py, pz, a, b) => {
      const abx = b.x - a.x, aby = b.y - a.y, abz = b.z - a.z;
      const apx = px - a.x, apy = py - a.y, apz = pz - a.z;
      const L = abx * abx + aby * aby + abz * abz;
      let t = L > 1e-9 ? (apx * abx + apy * aby + apz * abz) / L : 0; t = t < 0 ? 0 : t > 1 ? 1 : t;
      const dx = apx - abx * t, dy = apy - aby * t, dz = apz - abz * t;
      return Math.sqrt(dx * dx + dy * dy + dz * dz);
    };
    const vp = g.attributes.position.array; let escaped = 0; const total = vp.length / 3;
    for (let i = 0; i < vp.length; i += 3) {
      let best = Infinity;
      for (const c of caps) { const d = segD(vp[i], vp[i + 1], vp[i + 2], c.a, c.b) - c.r; if (d < best) best = d; }
      if (best > 0.08) escaped++; // 캡슐 표면에서 8cm 이상 뜬 정점 = escape (fascia webbing 허용 초과)
    }
    ok(escaped / total < 0.02, `skin escape ${(100 * escaped / total).toFixed(1)}% <2% (§19.2 조직 패킹)`);
  }

  // 좌우 대칭(§19.4·§20: 비의도적 비대칭 ≤1%): rest 피부 정점의 x-미러 최근접 평균거리/키.
  {
    const p = g.attributes.position.array, np = p.length / 3, cel = 0.03, bk = new Map();
    const key = (x, y, z) => `${Math.round(x / cel)},${Math.round(y / cel)},${Math.round(z / cel)}`;
    for (let i = 0; i < np; i++) { const k = key(p[i * 3], p[i * 3 + 1], p[i * 3 + 2]); let b = bk.get(k); if (!b) bk.set(k, b = []); b.push(i); }
    let sum = 0;
    for (let i = 0; i < np; i++) {
      const qx = -p[i * 3], qy = p[i * 3 + 1], qz = p[i * 3 + 2]; let best = Infinity;
      for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (let dz = -1; dz <= 1; dz++) {
        const arr = bk.get(key(qx + dx * cel, qy + dy * cel, qz + dz * cel)); if (!arr) continue;
        for (const j of arr) { const d = Math.hypot(qx - p[j * 3], qy - p[j * 3 + 1], qz - p[j * 3 + 2]); if (d < best) best = d; }
      }
      if (best < Infinity) sum += best;
    }
    const meanA = sum / np, pct = meanA / sz.y * 100;
    ok(pct < 1, `피부 좌우 대칭: 평균 비대칭 ${(meanA * 1000).toFixed(2)}mm (${pct.toFixed(3)}% <1%, §19.4)`);
  }

  // WP-10 · 피부 전달률(§11 SkinTransfer·§21.5): 전달률↑ → 피부가 근육을 바짝 감싸 분리가
  //  또렷(근육질). 전달률↓ → smooth-max 가 근육 사이 골을 메워(fascia webbing) 피부가 근육에서
  //  더 떠 매끄럽다(비만). 같은 캡슐에서 transfer 만 바꿔 "피부-근육 평균 이격"으로 검증.
  {
    const segD2 = (px, py, pz, a, b) => {
      const abx = b.x - a.x, aby = b.y - a.y, abz = b.z - a.z;
      const apx = px - a.x, apy = py - a.y, apz = pz - a.z;
      const L = abx * abx + aby * aby + abz * abz;
      let t = L > 1e-9 ? (apx * abx + apy * aby + apz * abz) / L : 0; t = t < 0 ? 0 : t > 1 ? 1 : t;
      const dx = apx - abx * t, dy = apy - aby * t, dz = apz - abz * t;
      return Math.sqrt(dx * dx + dy * dy + dz * dz);
    };
    const meanClear = (geo, cs) => {
      const vp = geo.attributes.position.array; let sum = 0; const n = vp.length / 3;
      for (let i = 0; i < vp.length; i += 3) {
        let best = Infinity;
        for (const c of cs) { const d = segD2(vp[i], vp[i + 1], vp[i + 2], c.a, c.b) - c.r; if (d < best) best = d; }
        sum += best;
      }
      return sum / n;
    };
    muscles.build(rig, { muscle: 1.3, fat: 0 });
    const capsT = muscles.getCapsules();
    const sharp = meanClear(bakeSkin(rig, capsT, { transfer: 1.0 }).mesh.geometry, capsT);
    const smooth = meanClear(bakeSkin(rig, capsT, { transfer: 0.05 }).mesh.geometry, capsT);
    ok(smooth > sharp, `전달률: 매끄럼이 근육서 더 뜸(분리 감춤) ${smooth.toFixed(4)} > 또렷 ${sharp.toFixed(4)}m (§11)`);
    muscles.build(rig); // 기본 복구
  }

  // WP-10 · 워터타이트(§19.4) + fascia 스무딩(§9.10): 전 체형이 구멍 없이 구워지고(경계에지=한
  //  삼각형만 쓰는 에지=구멍 척도), Laplacian 스무딩이 표면을 매끄럽게(면적↓) 하는가.
  {
    const boundaryEdges = (geo) => {
      const idx = geo.index, cnt = new Map();
      const key = (a, b) => a < b ? a * 1e7 + b : b * 1e7 + a;
      for (let i = 0; i < idx.count; i += 3) {
        const a = idx.getX(i), b = idx.getX(i + 1), c = idx.getX(i + 2);
        for (const [u, v] of [[a, b], [b, c], [c, a]]) { const k = key(u, v); cnt.set(k, (cnt.get(k) || 0) + 1); }
      }
      let bnd = 0; for (const v of cnt.values()) if (v === 1) bnd++;
      return bnd;
    };
    const surfArea = (geo) => {
      const p = geo.attributes.position, idx = geo.index;
      const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), ab = new THREE.Vector3(), ac = new THREE.Vector3();
      let s = 0;
      for (let i = 0; i < idx.count; i += 3) {
        a.fromBufferAttribute(p, idx.getX(i)); b.fromBufferAttribute(p, idx.getX(i + 1)); c.fromBufferAttribute(p, idx.getX(i + 2));
        s += ab.subVectors(b, a).cross(ac.subVectors(c, a)).length() * 0.5;
      }
      return s;
    };
    let worst = 0, worstName = '';
    for (const name of ['마른', '평균', '근육질', '비만']) {
      muscles.build(rig, BODY_PRESETS[name]);
      const be = boundaryEdges(bakeSkin(rig, muscles.getCapsules(), BODY_PRESETS[name]).mesh.geometry);
      if (be > worst) { worst = be; worstName = name; }
    }
    ok(worst < 90, `워터타이트: 최다 구멍 체형 «${worstName}» 경계에지 ${worst} <90 (§19.4)`);
    muscles.build(rig, { muscle: 1.1, fat: 0 });
    const capsF = muscles.getCapsules();
    const rough = surfArea(bakeSkin(rig, capsF, { fascia: 0 }).mesh.geometry);
    const smoothA = surfArea(bakeSkin(rig, capsF, { fascia: 6 }).mesh.geometry);
    ok(smoothA < rough, `fascia 스무딩: 면적 ${smoothA.toFixed(2)} < 원본 ${rough.toFixed(2)}m² (§9.10)`);
    muscles.build(rig); // 기본 복구
  }

  // 애니메이션 ------------------------------------------------------------
  scene.add(rig.obj); scene.add(mesh);
  const src = parseClipFBX(toBuf('public/assets/anim/walk.fbx'));
  ok(!!src, 'walk 소스 파싱');
  const clip = bakeClip(rig, src, '걷기');
  ok(clip && clip.tracks.length > 30, `리타깃 클립 트랙 ${clip?.tracks.length}개`);
  const gy = measureGroundY(rig, clip);
  ok(isFinite(gy), `접지 측정 root.y=${gy.toFixed(3)}`);

  // 피부가 실제로 뼈를 따라 변형되는가 — rest 정점 vs 포즈 정점
  const mixer = new THREE.AnimationMixer(rig.obj);
  mixer.clipAction(clip).play();
  const restV = new THREE.Vector3(), poseV = new THREE.Vector3();
  const sample = Math.floor((g.attributes.position.count) * 0.5);
  mixer.setTime(0); scene.updateMatrixWorld(true); mesh.updateMatrixWorld(true);
  const bt = mesh.applyBoneTransform ? 'applyBoneTransform' : 'boneTransform';
  mesh[bt](sample, restV.fromBufferAttribute(g.attributes.position, sample));
  mixer.setTime(clip.duration * 0.5); scene.updateMatrixWorld(true); mesh.updateMatrixWorld(true);
  mesh[bt](sample, poseV.fromBufferAttribute(g.attributes.position, sample));
  ok(restV.distanceTo(poseV) > 1e-3, `피부 정점 애니메이션 변형 Δ=${restV.distanceTo(poseV).toFixed(4)}m`);

  // 근육 라이브 갱신 (포즈에서 예외 없이)
  let muscleOk = true;
  try { muscles.update(); } catch { muscleOk = false; }
  ok(muscleOk, '포즈에서 근육 라이브 갱신 무예외');

  // WP-06 체형 프리셋 (§5.2 G2): 같은 골격에서 비만이 마른보다 피부가 두껍다 -----
  muscles.build(rig, { muscle: 0.8, fat: 0.0 });
  const leanG = bakeSkin(rig, muscles.getCapsules()).mesh.geometry;
  leanG.computeBoundingBox(); const lz = new THREE.Vector3(); leanG.boundingBox.getSize(lz);
  muscles.build(rig, { muscle: 1.0, fat: 0.07 });
  const fatG = bakeSkin(rig, muscles.getCapsules()).mesh.geometry;
  fatG.computeBoundingBox(); const fz = new THREE.Vector3(); fatG.boundingBox.getSize(fz);
  ok(fz.z > lz.z + 0.05, `체형: 비만 피부 전후 ${fz.z.toFixed(2)} > 마른 ${lz.z.toFixed(2)}m (G2)`);
  muscles.build(rig); // 기본 체형 복구
}

console.log(`\n${fails === 0 ? '✅ 전체 통과' : `❌ ${fails}개 실패`}`);
process.exit(fails === 0 ? 0 : 1);
