// ===========================================================================
//  Skeleton → Flesh  (rig-agnostic)  ·  히키토 asset pipeline prototype
//
//  1) Skeleton IR   : joints[{name,parent,offset}] + per-frame 회전 → world FK
//  2) Flesh grammar : radiusForName(name) → 이름으로 반지름 → 어떤 리그든 같은 스타일
//  3) Source        : built-in Mixamo 리그+클립 / FBX 드롭 (Vite에선 항상 동작)
//
//  ⓘ 아키텍처 매핑 (harness):
//    - Planner   = 뼈대 그래프 = genome
//    - Generator = 살 grammar (radiusForName + SDF profile + smin)
//    - Evaluator = (TODO) 실루엣 판독성 / 스타일 편차 / 자기충돌 정량 로깅
// ===========================================================================
import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';

const MAXB = 60;
const app = document.getElementById('app');

const renderer = new THREE.WebGLRenderer({ antialias: false });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
renderer.autoClear = false;
app.appendChild(renderer.domElement);

// ---- 살: 풀스크린 레이마칭 --------------------------------------------------
const quadScene = new THREE.Scene();
const quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
const uniforms = {
  uCamPos: { value: new THREE.Vector3() },
  uInvVP:  { value: new THREE.Matrix4() },
  uBoneA:  { value: Array.from({ length: MAXB }, () => new THREE.Vector4()) },
  uBoneB:  { value: Array.from({ length: MAXB }, () => new THREE.Vector4()) },
  uBoneCount: { value: 0 },
  uK:      { value: 0.30 },
  uColor:  { value: new THREE.Color('#f7b58c') },
};

const frag = /* glsl */`
precision highp float;
varying vec2 vUv;
uniform vec3 uCamPos; uniform mat4 uInvVP;
uniform vec4 uBoneA[${MAXB}]; uniform vec4 uBoneB[${MAXB}];
uniform int uBoneCount; uniform float uK; uniform vec3 uColor;
const vec3 L = normalize(vec3(0.55,0.85,0.45)); const float GY = 0.0;
float smin(float a,float b,float k){float h=clamp(0.5+0.5*(b-a)/k,0.0,1.0);return mix(b,a,h)-k*h*(1.0-h);}
float sdRoundCone(vec3 p,vec3 a,vec3 b,float r1,float r2){
  vec3 ba=b-a;float l2=dot(ba,ba);float rr=r1-r2;float a2=l2-rr*rr;float il2=1.0/l2;
  vec3 pa=p-a;float y=dot(pa,ba);float z=y-l2;vec3 xv=pa*l2-ba*y;float x2=dot(xv,xv);
  float y2=y*y*l2;float z2=z*z*l2;float k=sign(rr)*rr*rr*x2;
  if(sign(z)*a2*z2>k)return sqrt(x2+z2)*il2-r2;
  if(sign(y)*a2*y2<k)return sqrt(x2+y2)*il2-r1;
  return (sqrt(x2*a2*il2)+y*rr)*il2-r1;}
float map(vec3 p){float d=1e9;
  for(int i=0;i<${MAXB};i++){ if(i>=uBoneCount)break;
    vec4 A=uBoneA[i];vec4 B=uBoneB[i];
    d=smin(d,sdRoundCone(p,A.xyz,B.xyz,A.w,B.w),uK);} return d;}
vec3 calcN(vec3 p){vec2 e=vec2(0.0012,0.0);
  return normalize(vec3(map(p+e.xyy)-map(p-e.xyy),map(p+e.yxy)-map(p-e.yxy),map(p+e.yyx)-map(p-e.yyx)));}
float softshadow(vec3 ro,vec3 rd,float mint,float maxt,float w){float res=1.0,t=mint;
  for(int i=0;i<24;i++){float h=map(ro+rd*t);res=min(res,w*h/t);t+=clamp(h,0.03,0.35);
    if(res<0.004||t>maxt)break;} return clamp(res,0.0,1.0);}
float ao(vec3 p,vec3 n){float occ=0.0,sca=1.0;
  for(int i=0;i<5;i++){float h=0.02+0.16*float(i);occ+=(h-map(p+n*h))*sca;sca*=0.72;}
  return clamp(1.0-1.4*occ,0.0,1.0);}
vec3 sky(vec3 rd){float t=clamp(rd.y*0.5+0.5,0.0,1.0);return mix(vec3(0.10,0.08,0.13),vec3(0.19,0.16,0.25),t);}
void main(){
  vec2 ndc=vUv*2.0-1.0;
  vec4 nf=uInvVP*vec4(ndc,-1.0,1.0);nf/=nf.w; vec4 ff=uInvVP*vec4(ndc,1.0,1.0);ff/=ff.w;
  vec3 ro=uCamPos; vec3 rd=normalize(ff.xyz-nf.xyz);
  float t=0.0;bool hit=false;
  for(int i=0;i<100;i++){vec3 p=ro+rd*t;float d=map(p);
    if(d<0.0008*t+0.0004){hit=true;break;} t+=d; if(t>26.0)break;}
  vec3 col;
  if(hit){
    vec3 p=ro+rd*t;vec3 n=calcN(p);float dif=clamp(dot(n,L),0.0,1.0);
    dif*=softshadow(p+n*0.02,L,0.02,9.0,18.0);
    float band=smoothstep(0.0,0.35,dif)*0.55+smoothstep(0.45,0.9,dif)*0.45;
    float occ=ao(p,n);float rim=pow(1.0-clamp(dot(n,-rd),0.0,1.0),3.0);
    vec3 base=uColor*mix(0.92,1.06,clamp(p.y*0.28+0.3,0.0,1.0));
    col=base*(0.30+0.85*band)*occ;
    col+=vec3(0.55,0.72,0.95)*rim*0.5*occ; col+=base*0.06;
  } else if(rd.y<0.0){
    float gt=(GY-ro.y)/rd.y;vec3 gp=ro+rd*gt;
    float sh=softshadow(gp+vec3(0.0,0.01,0.0),L,0.03,7.0,10.0);
    float rad=exp(-0.05*dot(gp.xz,gp.xz));
    vec3 g=mix(vec3(0.13,0.11,0.16),vec3(0.17,0.15,0.20),rad);g*=(0.35+0.65*sh);
    float fog=smoothstep(7.0,24.0,length(gp.xz));col=mix(g,sky(rd),fog);
  } else col=sky(rd);
  col=pow(col,vec3(0.4545)); gl_FragColor=vec4(col,1.0);}`;

const quadMat = new THREE.ShaderMaterial({
  uniforms,
  vertexShader: `varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.0,1.0);}`,
  fragmentShader: frag, depthTest: false, depthWrite: false,
});
quadScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), quadMat));

// ---- 뼈대 오버레이 ----------------------------------------------------------
const skelScene = new THREE.Scene();
const cam = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
const boneGeo = new THREE.BufferGeometry();
const bonePos = new Float32Array(MAXB * 6);
boneGeo.setAttribute('position', new THREE.BufferAttribute(bonePos, 3));
const boneLines = new THREE.LineSegments(boneGeo, new THREE.LineBasicMaterial({ color: 0xffe08a, transparent: true, opacity: 0.9, depthTest: false }));
const jointGeo = new THREE.BufferGeometry();
const jointPos = new Float32Array(MAXB * 6);
jointGeo.setAttribute('position', new THREE.BufferAttribute(jointPos, 3));
const joints3 = new THREE.Points(jointGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 6, sizeAttenuation: false, depthTest: false }));
boneLines.visible = joints3.visible = false;
skelScene.add(boneLines); skelScene.add(joints3);

// ===========================================================================
//  (2) Flesh grammar : 이름 → 반지름.  이게 "스타일"의 정의.
//  실제 Mixamo 이름("mixamorig:LeftForeArm")도 접두어만 떼면 그대로 매칭.
// ===========================================================================
function simpleName(n) { return n.replace(/^mixamorig:?/i, ''); }
function radiusForName(name) {
  const n = simpleName(name), has = s => n.indexOf(s) >= 0;
  if (n === 'Hips') return 0.135;
  if (has('Spine2')) return 0.15;
  if (has('Spine1')) return 0.14;
  if (has('Spine'))  return 0.13;
  if (has('Neck'))   return 0.055;
  if (has('HeadTop') || has('_End')) return 0.065;
  if (has('Head'))   return 0.12;
  if (has('Shoulder')) return 0.055;
  if (has('ForeArm')) return 0.05;
  if (has('Arm'))    return 0.062;
  if (has('Hand'))   return 0.05;
  if (has('UpLeg'))  return 0.10;
  if (has('Leg'))    return 0.078;
  if (has('ToeBase') || has('Toe')) return 0.035;
  if (has('Foot'))   return 0.052;
  if (has('Thumb') || has('Index') || has('Middle') || has('Ring') || has('Pinky') || has('Finger')) return 0.014;
  return 0.05; // 미지의 뼈 → 기본값 (임의 리그도 깨지지 않음)
}
function isFinger(name) { return /Thumb|Index|Middle|Ring|Pinky|Finger/.test(simpleName(name)); }

// ===========================================================================
//  (1) Skeleton IR : Mixamo 표준 humanoid 계층 (T-pose, 단위 ~m)
// ===========================================================================
function buildMixamoRig() {
  const J = []; const idx = {};
  const add = (name, parent, ox, oy, oz) => {
    idx[name] = J.length;
    J.push({ name, parent: parent == null ? -1 : idx[parent], offset: [ox, oy, oz] });
  };
  add('mixamorig:Hips', null, 0, 0.98, 0);
  add('mixamorig:Spine', 'mixamorig:Hips', 0, 0.11, 0);
  add('mixamorig:Spine1', 'mixamorig:Spine', 0, 0.12, 0);
  add('mixamorig:Spine2', 'mixamorig:Spine1', 0, 0.12, 0);
  add('mixamorig:Neck', 'mixamorig:Spine2', 0, 0.12, 0.01);
  add('mixamorig:Head', 'mixamorig:Neck', 0, 0.07, 0.01);
  add('mixamorig:HeadTop_End', 'mixamorig:Head', 0, 0.15, 0.02);
  for (const [S, x] of [['Left', 1], ['Right', -1]]) {
    add(`mixamorig:${S}Shoulder`, 'mixamorig:Spine2', x * 0.05, 0.09, 0);
    add(`mixamorig:${S}Arm`, `mixamorig:${S}Shoulder`, x * 0.13, 0, 0);
    add(`mixamorig:${S}ForeArm`, `mixamorig:${S}Arm`, x * 0.28, 0, 0);
    add(`mixamorig:${S}Hand`, `mixamorig:${S}ForeArm`, x * 0.25, 0, 0);
    const fingers = [['Thumb', 0.55, 0.03], ['Index', 0.14, 0.04], ['Middle', -0.02, 0.045], ['Ring', -0.16, 0.04], ['Pinky', -0.30, 0.032]];
    for (const [fn, ang, len] of fingers) {
      const zoff = Math.sin(ang) * 0.03;
      add(`mixamorig:${S}Hand${fn}1`, `mixamorig:${S}Hand`, x * (len * 0.5), 0, zoff * 3.0);
      add(`mixamorig:${S}Hand${fn}2`, `mixamorig:${S}Hand${fn}1`, x * len, 0, 0);
      add(`mixamorig:${S}Hand${fn}3`, `mixamorig:${S}Hand${fn}2`, x * len * 0.8, 0, 0);
    }
    add(`mixamorig:${S}UpLeg`, 'mixamorig:Hips', x * 0.09, -0.06, 0);
    add(`mixamorig:${S}Leg`, `mixamorig:${S}UpLeg`, 0, -0.42, 0);
    add(`mixamorig:${S}Foot`, `mixamorig:${S}Leg`, 0, -0.42, 0);
    add(`mixamorig:${S}ToeBase`, `mixamorig:${S}Foot`, 0, -0.07, 0.14);
  }
  return J;
}

// IR → Object3D 계층 (THREE가 FK/world matrix 담당)
let jointDefs = [], jointObjs = [], jointName = [], rigRoot = null, bindHipY = 0;
function instantiateRig(defs) {
  if (rigRoot) skelScene.remove(rigRoot);
  jointDefs = defs; jointObjs = []; jointName = [];
  rigRoot = new THREE.Group(); skelScene.add(rigRoot);
  defs.forEach(d => {
    const o = new THREE.Object3D(); o.name = d.name;
    o.position.set(d.offset[0], d.offset[1], d.offset[2]);
    jointObjs.push(o); jointName.push(d.name);
  });
  defs.forEach((d, i) => { (d.parent >= 0 ? jointObjs[d.parent] : rigRoot).add(jointObjs[i]); });
  const hi = defs.findIndex(d => d.parent < 0);
  bindHipY = hi >= 0 ? defs[hi].offset[1] : 0;
}
instantiateRig(buildMixamoRig());

// ===========================================================================
//  (3-a) built-in 클립 : Mixamo 이름으로 회전 부여
// ===========================================================================
const _e = new THREE.Euler();
function applyPose(clip, t, speed) {
  const ph = t * speed * 4.0;
  const armDown = 1.30;
  for (let i = 0; i < jointObjs.length; i++) {
    const n = simpleName(jointName[i]); let rx = 0, ry = 0, rz = 0;
    const R = n.startsWith('Right');
    if (clip !== 'wave' || !R) {
      if (n === 'LeftArm') rz = -armDown;
      if (n === 'RightArm') rz = armDown;
    }
    if (clip === 'walk') {
      if (n === 'LeftUpLeg')  rx =  Math.sin(ph) * 0.5;
      if (n === 'RightUpLeg') rx = -Math.sin(ph) * 0.5;
      if (n === 'LeftLeg')  rx = Math.max(0, -Math.sin(ph)) * 0.9;
      if (n === 'RightLeg') rx = Math.max(0,  Math.sin(ph)) * 0.9;
      if (n === 'LeftArm')  rx =  Math.sin(ph) * 0.4;
      if (n === 'RightArm') rx = -Math.sin(ph) * 0.4;
      if (n === 'Spine1') ry = Math.sin(ph) * 0.06;
    } else if (clip === 'idle') {
      if (n === 'Spine1') ry = Math.sin(t * 1.1) * 0.03;
      if (n === 'Head')   ry = Math.sin(t * 0.8) * 0.04;
      if (n === 'LeftArm')  rx = Math.sin(t * 1.1) * 0.05;
      if (n === 'RightArm') rx = Math.sin(t * 1.1 + 0.5) * 0.05;
    } else if (clip === 'wave') {
      if (n === 'RightArm')     { rz = -1.55; rx = 0.2; }
      if (n === 'RightForeArm') { rz = Math.sin(t * 7.0) * 0.5 - 0.2; }
      if (n === 'Spine1') ry = 0.08;
    }
    _e.set(rx, ry, rz, 'XYZ');
    jointObjs[i].quaternion.setFromEuler(_e);
  }
  const bob = clip === 'walk' ? Math.sin(ph * 2.0) * 0.03 : clip === 'idle' ? Math.sin(t * 1.1) * 0.008 : 0;
  jointObjs[jointDefs.findIndex(d => d.parent < 0)].position.y = bindHipY + bob;
}

// ---- 세그먼트 추출 : 부모→자식 = taper 캡슐 -------------------------------
const _wp = new THREE.Vector3(), _wpp = new THREE.Vector3();
function extractBones(showFingers, fat) {
  rigRoot.updateMatrixWorld(true);
  const segs = [];
  for (let i = 0; i < jointDefs.length; i++) {
    const p = jointDefs[i].parent; if (p < 0) continue;
    if (!showFingers && (isFinger(jointName[i]) || isFinger(jointName[p]))) continue;
    jointObjs[i].getWorldPosition(_wp); jointObjs[p].getWorldPosition(_wpp);
    if (_wp.distanceToSquared(_wpp) < 1e-8) continue;
    segs.push({
      a: _wpp.clone(), b: _wp.clone(),
      ra: radiusForName(jointName[p]) * fat, rb: radiusForName(jointName[i]) * fat,
    });
  }
  return segs;
}
function uploadBones(segs) {
  const n = Math.min(segs.length, MAXB);
  for (let i = 0; i < n; i++) {
    const s = segs[i];
    uniforms.uBoneA.value[i].set(s.a.x, s.a.y, s.a.z, s.ra);
    uniforms.uBoneB.value[i].set(s.b.x, s.b.y, s.b.z, s.rb);
    bonePos.set([s.a.x, s.a.y, s.a.z, s.b.x, s.b.y, s.b.z], i * 6);
    jointPos.set([s.a.x, s.a.y, s.a.z, s.b.x, s.b.y, s.b.z], i * 6);
  }
  uniforms.uBoneCount.value = n;
  boneGeo.setDrawRange(0, n * 2); jointGeo.setDrawRange(0, n * 2);
  boneGeo.attributes.position.needsUpdate = true;
  jointGeo.attributes.position.needsUpdate = true;
}

// ===========================================================================
//  (3-b) FBX 드롭 : 실제 Mixamo 클립 재생 (Vite에선 FBXLoader 항상 사용 가능)
// ===========================================================================
let mode = 'builtin', extMixer = null, extRoot = null, extBones = [], extScale = 1, extCenter = new THREE.Vector3();
const statusEl = document.getElementById('status');
const setStatus = html => { statusEl.innerHTML = html; };
setStatus('FBX 로더 준비됨 — Mixamo FBX를 드롭하세요.');

function loadFBXBuffer(buf) {
  try {
    const obj = new FBXLoader().parse(buf, '');
    let bones = []; obj.traverse(o => { if (o.isBone) bones.push(o); });
    if (!bones.length) obj.traverse(o => { if (o.isSkinnedMesh) bones = o.skeleton.bones; });
    if (!bones.length) { setStatus('스켈레톤을 못 찾았어요.'); return; }
    const box = new THREE.Box3().setFromObject(obj);
    const size = new THREE.Vector3(); box.getSize(size);
    extScale = 1.7 / Math.max(size.y, 1e-3); box.getCenter(extCenter);
    extRoot = obj; extBones = bones;
    if (obj.animations && obj.animations.length) {
      extMixer = new THREE.AnimationMixer(obj);
      extMixer.clipAction(obj.animations[0]).play();
    }
    mode = 'external';
    document.getElementById('extOpt').disabled = false;
    document.getElementById('clip').value = 'external';
    setStatus('<b>불러오기 완료</b> — 실제 Mixamo 클립 재생 중.');
  } catch (e) {
    setStatus('FBX 파싱 실패: ' + e.message);
  }
}
function extractExternal(showFingers, fat) {
  if (extMixer) extMixer.update(1 / 60);
  extRoot.updateMatrixWorld(true);
  const segs = [];
  for (const b of extBones) {
    if (!b.parent || !b.parent.isBone) continue;
    if (!showFingers && (isFinger(b.name) || isFinger(b.parent.name))) continue;
    b.getWorldPosition(_wp); b.parent.getWorldPosition(_wpp);
    const a = _wpp.clone().sub(extCenter).multiplyScalar(extScale); a.y += 0.98;
    const c = _wp.clone().sub(extCenter).multiplyScalar(extScale);  c.y += 0.98;
    if (a.distanceToSquared(c) < 1e-8) continue;
    segs.push({ a, b: c, ra: radiusForName(b.parent.name) * fat, rb: radiusForName(b.name) * fat });
  }
  return segs;
}
const drop = document.getElementById('drop');
['dragover', 'dragenter'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.add('hot'); }));
['dragleave', 'drop'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.remove('hot'); }));
drop.addEventListener('click', () => {
  const inp = document.createElement('input'); inp.type = 'file'; inp.accept = '.fbx';
  inp.onchange = e => readFile(e.target.files[0]); inp.click();
});
drop.addEventListener('drop', e => { if (e.dataTransfer.files[0]) readFile(e.dataTransfer.files[0]); });
function readFile(f) {
  if (!f) return; setStatus('읽는 중… ' + f.name);
  const r = new FileReader(); r.onload = () => loadFBXBuffer(r.result); r.readAsArrayBuffer(f);
}

// ===========================================================================
//  카메라 / 입력 / 루프
// ===========================================================================
const st = { az: 0.5, el: 0.06, dist: 4.0, clip: 'walk', speed: 1.0, k: 0.30, fat: 1.0, fingers: false, bone: false };
const target = new THREE.Vector3(0, 1.0, 0);
function updateCam() {
  const ce = Math.cos(st.el), se = Math.sin(st.el);
  cam.position.set(target.x + st.dist * ce * Math.sin(st.az), target.y + st.dist * se, target.z + st.dist * ce * Math.cos(st.az));
  cam.lookAt(target); cam.updateMatrixWorld(true);
  cam.matrixWorldInverse.copy(cam.matrixWorld).invert();
  const vp = new THREE.Matrix4().multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse);
  uniforms.uInvVP.value.copy(vp).invert();
  uniforms.uCamPos.value.copy(cam.position);
}
let drag = false, px = 0, py = 0;
renderer.domElement.addEventListener('pointerdown', e => { drag = true; px = e.clientX; py = e.clientY; });
window.addEventListener('pointerup', () => drag = false);
window.addEventListener('pointermove', e => {
  if (!drag) return;
  st.az -= (e.clientX - px) * 0.008;
  st.el = Math.max(-0.5, Math.min(1.2, st.el + (e.clientY - py) * 0.006));
  px = e.clientX; py = e.clientY;
});
renderer.domElement.addEventListener('wheel', e => {
  e.preventDefault(); st.dist = Math.max(2.4, Math.min(11, st.dist + e.deltaY * 0.004));
}, { passive: false });
function resize() {
  const w = app.clientWidth, h = app.clientHeight;
  renderer.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix();
}
window.addEventListener('resize', resize); resize();

const $ = id => document.getElementById(id);
$('clip').addEventListener('change', e => { st.clip = e.target.value; mode = (st.clip === 'external') ? 'external' : 'builtin'; });
$('spd').addEventListener('input', e => { st.speed = +e.target.value; $('spdVal').textContent = (+e.target.value).toFixed(1); });
$('k').addEventListener('input', e => { st.k = +e.target.value; uniforms.uK.value = st.k; $('kVal').textContent = st.k.toFixed(2); });
$('fat').addEventListener('input', e => { st.fat = +e.target.value; $('fatVal').textContent = st.fat.toFixed(2); });
$('btnFinger').addEventListener('click', e => { st.fingers = !st.fingers; e.target.classList.toggle('on', st.fingers); });
$('btnBone').addEventListener('click', e => { st.bone = !st.bone; boneLines.visible = joints3.visible = st.bone; e.target.classList.toggle('on', st.bone); });

const clock = new THREE.Clock();
function loop() {
  const t = clock.getElapsedTime();
  let segs;
  if (mode === 'external' && extRoot) {
    segs = extractExternal(st.fingers, st.fat);
  } else {
    applyPose(st.clip === 'external' ? 'idle' : st.clip, t, st.speed);
    segs = extractBones(st.fingers, st.fat);
  }
  uploadBones(segs); updateCam();
  renderer.clear();
  renderer.render(quadScene, quadCam);
  if (st.bone) renderer.render(skelScene, cam);
  requestAnimationFrame(loop);
}
loop();
