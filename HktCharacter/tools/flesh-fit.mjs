// ============================================================================
//  flesh-fit.mjs — Y Bot **실제 메시 버텍스**에서 살 DNA 를 역산한다.
//
//  손으로 반지름을 찍는 대신, 모델의 스킨 버텍스를 각 뼈(캡슐)에 **Mixamo 바인딩**
//  으로 배정해 t 슬라이스별 반지름·단면 납작도(flatten)를 측정한다. 그러면 형태가
//  모델을 따라가고, SDF 메타볼 합성이 "라인(인체 곡선)"을 부드럽게 유지한다.
//  ("똑같이 붙이면 똑같이 나오니 라인은 유지" — SDF 는 정확 재현이 아니라 매끈한 근사.)
//
//  캡슐 = 부모 뼈 → 자식 뼈, **부모 뼈로 키잉**(렌더러와 동일). 버텍스는 지배 뼈
//  (스킨 가중치 최대)로 배정 — 기하 최근접은 관절에서 뼈끼리 뭉개지므로.
//  출력: src/ybotDna.js. fleshdna 의 preset 'y-bot' 이 로드. 실행: node tools/flesh-fit.mjs
// ============================================================================
import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { readFileSync, writeFileSync } from 'fs';
import { defaultDna } from '../src/fleshdna.js';

const simpleName = n => n.split(':').pop().replace(/^mixamorig\d*/i, '').toLowerCase();
const stripLR = k => k.replace(/^left|^right/, '');

// ── Y Bot 로드 + 키 1.7m 정규화(makeCh 규약) ──
const buf = readFileSync('public/assets/character/Y Bot.fbx');
const obj = new FBXLoader().parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength), '');
const bones = [], meshes = [];
obj.traverse(o => { if (o.isBone) bones.push(o); if (o.isSkinnedMesh) meshes.push(o); });
const boneMap = new Map(); const drivers = [];
for (const b of bones) { const sn = simpleName(b.name); if (!boneMap.has(sn)) { boneMap.set(sn, b); drivers.push(b); } } // 개명 안 함(메시 지배 뼈 이름 보존)
const p = new THREE.Vector3();
obj.scale.setScalar(1); obj.position.set(0, 0, 0); obj.updateMatrixWorld(true);
const box = new THREE.Box3(); for (const b of drivers) box.expandByPoint(b.getWorldPosition(p));
const size = new THREE.Vector3(); box.getSize(size);
obj.scale.setScalar(1.7 / Math.max(size.y, 1e-3)); obj.updateMatrixWorld(true);

meshes.sort((a, b) => b.geometry.attributes.position.count - a.geometry.attributes.position.count);
const mesh = meshes[0];
mesh.updateMatrixWorld(true);
const pos = mesh.geometry.attributes.position, vN = pos.count;
const skinIdx = mesh.geometry.attributes.skinIndex, skinWt = mesh.geometry.attributes.skinWeight;
const meshBones = mesh.skeleton.bones;

// ── 캡슐(부모→자식, 부모 키잉) + 월드 축·로컬 프레임 ──
const caps = [];
for (const b of drivers) {
  if (!b.parent?.isBone) continue;
  const par = b.parent;
  const a = par.getWorldPosition(new THREE.Vector3());
  const c = b.getWorldPosition(new THREE.Vector3());
  const ax = c.clone().sub(a); const len = ax.length(); if (len < 1e-4) continue;
  ax.multiplyScalar(1 / len);
  const u = new THREE.Vector3(0, 0, 1); u.addScaledVector(ax, -u.dot(ax)); // 전방 +z 투영
  if (u.length() < 0.2) { u.set(1, 0, 0); u.addScaledVector(ax, -u.dot(ax)); }
  u.normalize();
  const v = new THREE.Vector3().crossVectors(ax, u).normalize();
  caps.push({ key: stripLR(simpleName(par.name)), a, ax, len, u, v });
}
const capsByKey = new Map();
for (const cap of caps) { if (!capsByKey.has(cap.key)) capsByKey.set(cap.key, []); capsByKey.get(cap.key).push(cap); }

// ── 버텍스 → 지배 뼈 → 그 뼈 캡슐 중 최근접 ──
const merged = new Map(); // stripLR 키 → [[t,fu,fv], ...]
const vw = new THREE.Vector3();
for (let i = 0; i < vN; i++) {
  let bi = 0, bw = -1;
  for (let j = 0; j < 4; j++) { const w = skinWt.getComponent(i, j); if (w > bw) { bw = w; bi = skinIdx.getComponent(i, j); } }
  const key = stripLR(simpleName(meshBones[bi].name));
  const list = capsByKey.get(key); if (!list) continue;
  vw.fromBufferAttribute(pos, i); mesh.applyBoneTransform(i, vw); vw.applyMatrix4(mesh.matrixWorld);
  let best = null, bestD = Infinity, bt = 0, bu = 0, bv = 0;
  for (const cap of list) {
    const rel = vw.clone().sub(cap.a);
    const along = rel.dot(cap.ax);
    let t = along / cap.len; t = t < 0 ? 0 : t > 1 ? 1 : t;
    const closest = cap.a.clone().addScaledVector(cap.ax, Math.max(0, Math.min(cap.len, along)));
    const dist = vw.distanceTo(closest);
    if (dist < bestD) { const proj = rel.clone().addScaledVector(cap.ax, -along); bestD = dist; best = cap; bt = t; bu = proj.dot(cap.u); bv = proj.dot(cap.v); }
  }
  if (best) { if (!merged.has(key)) merged.set(key, []); merged.get(key).push([bt, bu, bv]); }
}

// ── t-슬라이스 fit: 반지름(큰 축) + flatten f(작은/큰) + 중심 오프셋(bump 후보) ──
const quant = (arr, q) => { const s = arr.slice().sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.max(0, Math.floor(q * (s.length - 1))))]; };
const median = arr => quant(arr, 0.5);
const NB = 6;
function fitKey(verts) {
  if (verts.length < 40) return null;
  const bins = Array.from({ length: NB }, () => ({ fu: [], fv: [] }));
  for (const [t, fu, fv] of verts) { const bi = Math.min(NB - 1, Math.floor(t * NB)); bins[bi].fu.push(fu); bins[bi].fv.push(fv); }
  const prof = [], cus = [], cvs = []; let fSum = 0, fCnt = 0;
  for (let bi = 0; bi < NB; bi++) {
    const b = bins[bi]; if (b.fv.length < 10) continue;
    // 반지름 = 분포 반폭(p90-p10)/2 — 중심 위치와 무관. flatten f = 작은축/큰축.
    const vHalf = (quant(b.fv, 0.9) - quant(b.fv, 0.1)) / 2;
    const uHalf = (quant(b.fu, 0.9) - quant(b.fu, 0.1)) / 2;
    const r = Math.max(vHalf, uHalf), f = Math.min(uHalf, vHalf) / Math.max(Math.max(uHalf, vHalf), 1e-4);
    prof.push([+((bi + 0.5) / NB).toFixed(3), +r.toFixed(4)]);
    cus.push(median(b.fu)); cvs.push(median(b.fv));                    // 스킨 중심(뼈 기준 오프셋)
    fSum += f; fCnt++;
  }
  if (prof.length < 2) return null;
  if (prof[0][0] > 0.02) prof.unshift([0, prof[0][1]]);
  if (prof[prof.length - 1][0] < 0.98) prof.push([1, prof[prof.length - 1][1]]);
  return { profile: prof, f: fCnt ? +(fSum / fCnt).toFixed(3) : 1, offset: [+median(cus).toFixed(4), +median(cvs).toFixed(4), 0] };
}
const fitByKey = new Map();
for (const [k, verts] of merged) { const fit = fitKey(verts); if (fit) fitByKey.set(k, fit); }

// ── defaultDna 구조(순서·match·group·flatten dir) 유지 + 측정값 주입 ──
const dna = defaultDna();
dna.name = 'y-bot';
// hips 규칙이 없으면 spine 앞에 추가(부모=Hips 캡슐용)
if (!dna.segments.some(s => s.match === 'hips'))
  dna.segments.splice(dna.segments.findIndex(s => s.match === 'spine2'), 0, { match: 'hips', profile: [[0, 0.11]], flatten: { dir: [0, 0, 1], f: 0.8 }, group: 'torso' });
dna.bumps = [];
const skip = s => /thumb|index|middle|ring|pinky|end\$/.test(s.match);
// **렌더러와 동일한 first-match** 로 각 fit 키를 세그먼트에 주입 (스트립 키로 test —
// 렌더러는 'leftupleg' 로, fit 은 'upleg' 로 test 하지만 우선순위 결과는 동일).
let injected = 0;
for (const [key, fit] of fitByKey) {
  if (/thumb|index|middle|ring|pinky/.test(key)) continue; // 손가락 키 제외(손바닥 오염 방지)
  if (!fit.profile.some(pt => pt[1] > 0.01)) continue;
  const s = dna.segments.find(seg => !skip(seg) && new RegExp(seg.match).test(key));
  if (!s) continue;
  s.profile = fit.profile;
  if (s.flatten) s.flatten.f = +Math.max(0.35, Math.min(1, fit.f)).toFixed(3);
  else if (fit.f < 0.8) s.flatten = { dir: [0, 0, 1], f: +fit.f.toFixed(3) };
  if (Math.hypot(fit.offset[0], fit.offset[1]) > 0.012) s.offset = fit.offset; // 뼈→스킨 중심선 이동
  injected++;
}

const out = `// 자동 생성 — tools/flesh-fit.mjs (Y Bot 메시 역산). 직접 수정 말 것.\nexport const ybotDna = ${JSON.stringify(dna)};\n`;
writeFileSync('src/ybotDna.js', out);
console.log(`fit: 세그먼트 ${injected}개 주입, 버텍스 ${vN}, 표면 "${mesh.name}"`);
for (const s of dna.segments) {
  if (/thumb|index|middle|ring|pinky|end\$/.test(s.match)) continue;
  console.log(`  ${s.match.padEnd(10)} r=[${s.profile.map(pt => pt[1]).join(',')}]${s.flatten ? ' f=' + s.flatten.f : ''}`);
}
