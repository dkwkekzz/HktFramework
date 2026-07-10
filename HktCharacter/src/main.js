// ===========================================================================
//  HktCharacter · Skeleton → Flesh  (rig-agnostic)  ·  asset pipeline prototype
//
//  1) Skeleton IR   : joints[{name,parent,offset}] + per-frame 회전 → world FK
//  2) Flesh grammar : radiusForName(name) → 이름으로 반지름 → 어떤 리그든 같은 스타일
//  3) Source        : built-in Mixamo 리그+클립 / 동봉 로코모션 FBX 샘플 + FBX 드롭
//
//  ⓘ 아키텍처 매핑 (harness):
//    - Planner   = 뼈대 그래프 = genome
//    - Generator = 살 grammar (radiusForName + SDF profile + smin)
//    - Evaluator = (TODO) 실루엣 판독성 / 스타일 편차 / 자기충돌 정량 로깅
// ===========================================================================
import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { PROFILES, GROUPS, matchRule } from './proportions.js';

const MAXB = 256; // loft 원판 사슬 포함 상한 (5 vec4 배열 × 256 = 1280 ≤ 프래그먼트 유니폼 4096)
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
  // Detail 층: 세그먼트별 (k, 납작화 f, -, -) + 납작화 방향(단위 벡터)
  // f<0 은 one-sided — dir의 +쪽 반만 납작화 (얼굴 앞면 평평 + 뒤통수 볼록 같은 비대칭)
  uBoneC:  { value: Array.from({ length: MAXB }, () => new THREE.Vector4(-1, 1, 0, 0)) },
  uBoneN:  { value: Array.from({ length: MAXB }, () => new THREE.Vector4(0, 0, 1, 0)) },
  // 2축째 납작화 (dir2.xyz, f2) — 두개골(좌우+앞뒤)·손바닥(두께+폭) 같은 이중 타원 단면
  uBoneM:  { value: Array.from({ length: MAXB }, () => new THREE.Vector4(0, 0, 1, 1)) },
  uBoneCount: { value: 0 },
  uDetailStart: { value: 0 },  // 이 인덱스부터 detail 세그먼트(k/flatten/cut) — 앞쪽은 저비용 경로
  uCutStart:  { value: MAXB }, // 이 인덱스부터는 빼기(smooth-subtraction) 세그먼트
  uK:      { value: 0.12 }, // smin 블렌드 폭 — 작을수록 팔·다리·머리가 뚜렷(캐릭터 실루엣). 크게 하면 블롭.
  uColor:  { value: new THREE.Color('#f7b58c') },
};

const frag = /* glsl */`
precision highp float;
varying vec2 vUv;
uniform vec3 uCamPos; uniform mat4 uInvVP;
uniform vec4 uBoneA[${MAXB}]; uniform vec4 uBoneB[${MAXB}];
uniform vec4 uBoneC[${MAXB}]; uniform vec4 uBoneN[${MAXB}];
uniform vec4 uBoneM[${MAXB}];
uniform int uBoneCount; uniform int uDetailStart; uniform int uCutStart;
uniform float uK; uniform vec3 uColor;
const vec3 L = normalize(vec3(0.55,0.85,0.45)); const float GY = 0.0;
float smin(float a,float b,float k){float h=clamp(0.5+0.5*(b-a)/k,0.0,1.0);return mix(b,a,h)-k*h*(1.0-h);}
float sdRoundCone(vec3 p,vec3 a,vec3 b,float r1,float r2){
  vec3 ba=b-a;float l2=dot(ba,ba);float rr=r1-r2;float a2=l2-rr*rr;float il2=1.0/l2;
  vec3 pa=p-a;float y=dot(pa,ba);float z=y-l2;vec3 xv=pa*l2-ba*y;float x2=dot(xv,xv);
  float y2=y*y*l2;float z2=z*z*l2;float k=sign(rr)*rr*rr*x2;
  if(sign(z)*a2*z2>k)return sqrt(x2+z2)*il2-r2;
  if(sign(y)*a2*y2<k)return sqrt(x2+y2)*il2-r1;
  return (sqrt(x2*a2*il2)+y*rr)*il2-r1;}
// 납작화 — 방향 n 을 1/|f| 로 늘린 공간에서 평가 후 min(|f|,1) 배 (보수적 하한
// → 레이마치 안전). f>0 은 양쪽(타원 단면), f<0 은 n 의 +쪽 반만(one-sided) —
// 반대쪽은 원형 유지. one-sided 도 w 는 항상 곱한다 (경계 근방 하한 보장).
vec3 flatP(vec3 p,vec3 a,vec3 n,float f,inout float w){
  float fa=abs(f); if(fa>=0.999)return p;
  w=min(w,fa);
  float d=dot(p-a,n);
  if(f>0.0||d>0.0)p+=(1.0/fa-1.0)*d*n;
  return p;}
// 세그먼트 i 의 SDF — 납작화 최대 2축 (uBoneN+C.y, uBoneM.xyz+M.w)
float sdSeg(int i,vec3 p){
  vec4 A=uBoneA[i];vec4 B=uBoneB[i];vec4 C=uBoneC[i];vec4 M=uBoneM[i];
  float w=1.0;
  p=flatP(p,A.xyz,uBoneN[i].xyz,C.y,w);
  p=flatP(p,A.xyz,M.xyz,M.w,w);
  return sdRoundCone(p,A.xyz,B.xyz,A.w,B.w)*w;}
float map(vec3 p){float d=1e9;
  // 1) 평범한 캡슐 (대부분) — 저비용 경로. 셰이더 비용의 지배 항이라 분리 유지.
  for(int i=0;i<${MAXB};i++){ if(i>=uDetailStart)break;
    vec4 A=uBoneA[i];vec4 B=uBoneB[i];
    d=smin(d,sdRoundCone(p,A.xyz,B.xyz,A.w,B.w),uK);}
  // 2) detail 세그먼트 (소수) — k/flatten/cut 확장 경로
  for(int j=uDetailStart;j<uBoneCount;j++){
    float dj=sdSeg(j,p);
    float k=uBoneC[j].x<0.0?uK:uBoneC[j].x;
    if(j<uCutStart)d=smin(d,dj,k);          // 더하기 (smooth-union)
    else d=-smin(-d,dj,k);                  // 빼기 (smooth-subtraction) — 주름/파임
  } return d;}
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
    if(d<0.0008*t+0.0004){
      // 히트 정련 — 납작화(w<1) 세그먼트는 필드가 w 배 축소돼 임계값이 월드로 1/w 배
      // 부풀어 보인다 (팬케이크 골반 +2cm 스커트 교훈). 몇 스텝 더 조여 실표면에 붙인다.
      for(int j=0;j<10;j++){d=map(ro+rd*t);if(d<0.00012*t+0.00006)break;t+=d;}
      hit=true;break;
    } t+=d; if(t>26.0)break;}
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
//  실제 규칙/수치는 proportions.js 의 프로파일이 보유 — 여기는 조회 + 그룹 배율만.
//  실제 Mixamo 이름("mixamorig:LeftForeArm")도 접두어만 떼면 그대로 매칭.
// ===========================================================================
function simpleName(n) { return n.replace(/^mixamorig:?/i, ''); }
let profile = PROFILES.reference;
const groupMul = Object.fromEntries(GROUPS.map(([key]) => [key, 1.0])); // UI 그룹 배율
function radiusForName(name) {
  const rule = matchRule(profile, simpleName(name));
  if (!rule) return profile.fallback;
  return rule.r * (groupMul[rule.group] ?? 1.0);
}
function isFinger(name) { return /Thumb|Index|Middle|Ring|Pinky|Finger/.test(simpleName(name)); }

// ===========================================================================
//  (1) Skeleton IR : Mixamo 표준 humanoid 계층 (T-pose, 단위 ~m)
//  치수는 전부 프로파일 skeleton 절에서 온다 — 비율 변경 시 코드 수정 불필요.
// ===========================================================================
function buildMixamoRig(sk) {
  const J = []; const idx = {};
  const add = (name, parent, ox, oy, oz) => {
    idx[name] = J.length;
    J.push({ name, parent: parent == null ? -1 : idx[parent], offset: [ox, oy, oz] });
  };
  // spineZ: 척추 전후 오프셋 (S-커브 — 가슴 앞벽 평평/등 뒤로. 미지정 시 일직선)
  const sz = sk.spineZ ?? [0, 0, 0];
  add('mixamorig:Hips', null, 0, sk.hipsY, 0);
  add('mixamorig:Spine', 'mixamorig:Hips', 0, sk.spineLens[0], sz[0]);
  add('mixamorig:Spine1', 'mixamorig:Spine', 0, sk.spineLens[1], sz[1]);
  add('mixamorig:Spine2', 'mixamorig:Spine1', 0, sk.spineLens[2], sz[2]);
  add('mixamorig:Neck', 'mixamorig:Spine2', 0, sk.neckLen, sk.neckZ);
  add('mixamorig:Head', 'mixamorig:Neck', 0, sk.headLen, sk.headZ);
  add('mixamorig:HeadTop_End', 'mixamorig:Head', 0, sk.headTopLen, sk.headTopZ);
  for (const [S, x] of [['Left', 1], ['Right', -1]]) {
    add(`mixamorig:${S}Shoulder`, 'mixamorig:Spine2', x * sk.shoulderX, sk.shoulderY, 0);
    add(`mixamorig:${S}Arm`, `mixamorig:${S}Shoulder`, x * sk.armX, 0, 0);
    add(`mixamorig:${S}ForeArm`, `mixamorig:${S}Arm`, x * sk.upperArmLen, 0, 0);
    add(`mixamorig:${S}Hand`, `mixamorig:${S}ForeArm`, x * sk.foreArmLen, 0, 0);
    for (const [fn, ang, len] of sk.fingers) {
      const zoff = Math.sin(ang) * 0.03;
      add(`mixamorig:${S}Hand${fn}1`, `mixamorig:${S}Hand`, x * (len * 0.5), 0, zoff * 3.0);
      add(`mixamorig:${S}Hand${fn}2`, `mixamorig:${S}Hand${fn}1`, x * len, 0, 0);
      add(`mixamorig:${S}Hand${fn}3`, `mixamorig:${S}Hand${fn}2`, x * len * 0.8, 0, 0);
    }
    // kneeX/ankleX: 다리 안쪽 수렴 (미지정 시 upLegX = 수직 기둥)
    // upLegZ/kneeZ/ankleZ: 다리 전후 배치 (미지정 시 0 = 골반 바로 아래 수직)
    const kneeX = sk.kneeX ?? sk.upLegX, ankleX = sk.ankleX ?? kneeX;
    const upLegZ = sk.upLegZ ?? 0, kneeZ = sk.kneeZ ?? upLegZ, ankleZ = sk.ankleZ ?? kneeZ;
    add(`mixamorig:${S}UpLeg`, 'mixamorig:Hips', x * sk.upLegX, sk.upLegY, upLegZ);
    add(`mixamorig:${S}Leg`, `mixamorig:${S}UpLeg`, x * (kneeX - sk.upLegX), -sk.thighLen, kneeZ - upLegZ);
    add(`mixamorig:${S}Foot`, `mixamorig:${S}Leg`, x * (ankleX - kneeX), -sk.shinLen, ankleZ - kneeZ);
    add(`mixamorig:${S}ToeBase`, `mixamorig:${S}Foot`, 0, -sk.footDrop, sk.toeZ);
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
instantiateRig(buildMixamoRig(profile.skeleton));

// ===========================================================================
//  (3-a) built-in 클립 : Mixamo 이름으로 회전 부여
// ===========================================================================
const _e = new THREE.Euler();
function applyPose(clip, t, speed) {
  const ph = t * speed * 4.0;
  const armDown = profile.pose?.armDown ?? 1.30;
  const footSplay = profile.pose?.footSplay ?? 0.0;
  const foreArmOut = profile.pose?.foreArmOut ?? 0.0;
  const handIn = profile.pose?.handIn ?? 0.0;
  // 전방 스윙(rad): 시트 A-포즈는 팔이 몸 옆이 아니라 살짝 앞 — 손이 허벅지 앞에 온다.
  // rx>0 은 뒤로 가므로 부호 반전해 적용한다.
  const armFwd = profile.pose?.armFwd ?? 0.0;
  const foreArmFwd = profile.pose?.foreArmFwd ?? 0.0;
  for (let i = 0; i < jointObjs.length; i++) {
    const n = simpleName(jointName[i]); let rx = 0, ry = 0, rz = 0;
    const R = n.startsWith('Right');
    if (clip !== 'wave' || !R) {
      if (n === 'LeftArm') { rz = -armDown; rx = -armFwd; }
      if (n === 'RightArm') { rz = armDown; rx = -armFwd; }
      if (n === 'LeftForeArm') { rz = foreArmOut; rx = -foreArmFwd; }
      if (n === 'RightForeArm') { rz = -foreArmOut; rx = -foreArmFwd; }
      if (n === 'LeftHand') rz = -handIn;
      if (n === 'RightHand') rz = handIn;
    }
    if (n === 'LeftFoot') ry = footSplay;
    if (n === 'RightFoot') ry = -footSplay;
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
const _wp = new THREE.Vector3(), _wpp = new THREE.Vector3(), _wq = new THREE.Quaternion();

// Detail 층: 규칙/extras/subBones 의 k(blend 폭)·flatten·flatten2 를 세그먼트에 부여.
// flatten.dir 은 관절 로컬 → 월드 회전(quat), fx 는 미러 시 x 부호.
// f<0 = one-sided (dir +쪽 반만 납작화) — 부호는 셰이더까지 그대로 흘러간다.
function segDetail(seg, spec, quat, fx = 1) {
  if (!spec) return seg;
  if (spec.k != null) seg.k = spec.k;
  const world = dir => new THREE.Vector3(dir[0] * fx, dir[1], dir[2]).applyQuaternion(quat).normalize();
  if (spec.flatten)  { seg.f  = spec.flatten.f;  seg.n  = world(spec.flatten.dir); }
  if (spec.flatten2) { seg.f2 = spec.flatten2.f; seg.n2 = world(spec.flatten2.dir); }
  return seg;
}

// ---- 원판 로프트(disk-loft) 살 층 (LOFT-PLAN §4) ---------------------------
// profile.loft: { '<뼈 simple name>': { group, k?, disks:[{t, rx, zf, zb, xo?}] } }
//   · t     : 뼈 축 위치 (0=부모 관절, 1=자식 관절 — 범위 밖 허용: 골반 t<0 등)
//   · rx    : 좌우 반경(m) · zf/zb : 앞/뒤 경계(m, 관절 로컬 +z=정면, zb 는 보통 음수)
//   · xo    : 단면 중심의 좌우 오프셋(m) — 다리처럼 축≠단면 중심일 때. mirror 시 부호 반전.
// 키는 Left/Right 접두어를 뗀 이름과도 일치 ('UpLeg' → 양 다리, xo/fx 미러) — grammar 원칙.
// 원판 (i,i+1) 쌍 → round-cone 세그먼트 1개. 타원 단면은 flatten 으로: 긴 반경을 캡슐
// 반지름으로, 짧은 축을 f<1 납작화 (f>1 은 레이마치 하한 위반 — 방향을 바꿔서 회피).
// 앞/뒤 비대칭은 원판 중심 오프셋 (zf+zb)/2 로 해소 — 셰이더 무변경.
// ⚠ flatten 은 세그먼트 a 의 평면 기준 공간 스케일이라 축에서 벗어난 b 중심도 f 배
//   끌려간다 → 방출 시 오프셋 차를 1/f 로 선보정해 피팅값이 그대로 렌더되게 한다.
function loftStackFor(name) {
  const L = profile.loft; if (!L) return null;
  const n = simpleName(name);
  if (L[n]) return { spec: L[n], fx: 1 };
  const m = n.match(/^(Left|Right)(.+)$/);
  if (m && L[m[2]]) return { spec: L[m[2]], fx: m[1] === 'Left' ? 1 : -1 };
  return null;
}
function emitLoft(segs, spec, fx, a, b, quat, fat, id) {
  const mul = (groupMul[spec.group] ?? 1.0) * fat;
  const axis = b.clone().sub(a);
  const zdir = new THREE.Vector3(0, 0, 1).applyQuaternion(quat).normalize();
  const xdir = new THREE.Vector3(1, 0, 0).applyQuaternion(quat).normalize();
  const D = spec.disks;
  // 스택 내부 k: 이웃 cone 세그먼트의 기울기 불연속(면 각짐)이 준-툰 셰이딩에서 가로
  // 밴드로 증폭된다 — k 가 이음새를 둥글린다 (0.004 로 줄이면 다리가 골판지가 되는 교훈).
  // 대가는 원판 평면마다 k/4(4mm) 균일 부풀음 — 스무스한 사슬에선 리플이 아니라 전체
  // 두께 +4mm 로 읽히고, 재피팅(compose SHRINK)이 데이터에서 도로 빼서 수렴한다.
  const k = spec.k ?? 0.016;
  // k0/k1: 스택 첫/끝 세그먼트의 관절 경계 blend — 이웃 살(골반↔허벅지 등)과의
  // 웰드 주름을 넓게 편다 (스택 내부 k 와 분리 — LOFT-PLAN §4 "관절 경계만 blend").
  // ⚠ 축 방향 납작화(팬케이크)는 시도 후 폐기 — 필드가 f2 배 줄어 히트 임계값이 월드로
  // 1/f2 배 부풀고, 비등방 스케일이 법선의 축 성분을 1/f2 배 왜곡해 가로 밴딩이 생긴다.
  // 빠른 테이퍼(가랑이·힙 플레어)는 데이터 쪽(fit-loft 의 돔 가드·rEmit 클램프)에서 푼다.
  for (let i = 0; i + 1 < D.length; i++) {
    const d0 = D[i], d1 = D[i + 1];
    const zc0 = (d0.zf + d0.zb) / 2, zc1 = (d1.zf + d1.zb) / 2;
    const x0 = (d0.xo ?? 0) * fx,     x1 = (d1.xo ?? 0) * fx;
    const rz0 = (d0.zf - d0.zb) / 2,  rz1 = (d1.zf - d1.zb) / 2;
    const asp = (rz0 / d0.rx + rz1 / d1.rx) / 2; // 평균 종횡비 rz/rx
    const zFlat = asp <= 1.0;                    // true: z 납작 / false: x 납작
    const f = Math.min(zFlat ? asp : 1 / asp, 0.999);
    const A = a.clone().addScaledVector(axis, d0.t).addScaledVector(zdir, zc0).addScaledVector(xdir, x0);
    // b 중심 선보정: 납작화 방향 성분의 a 대비 차분만 1/f 로 확대
    const dz = zFlat ? (zc1 - zc0) / f : (zc1 - zc0);
    const dx = zFlat ? (x1 - x0)   : (x1 - x0) / f;
    const B = a.clone().addScaledVector(axis, d1.t).addScaledVector(zdir, zc0 + dz).addScaledVector(xdir, x0 + dx);
    segs.push({
      a: A, b: B,
      ra: (zFlat ? d0.rx : rz0) * mul, rb: (zFlat ? d1.rx : rz1) * mul,
      k: i === 0 ? (spec.k0 ?? k) : i + 2 === D.length ? (spec.k1 ?? k) : k,
      f, n: zFlat ? zdir : xdir, id,
    });
  }
}

// 볼륨 헬퍼(extras) — 프로파일이 정의한 관절-로컬 세그먼트를 살에 추가한다.
// resolveJoint(simpleName) → { pos, quat } (렌더 공간). 관절이 없으면 조용히 건너뜀
// → extras 가 없는 임의 리그도 깨지지 않는다.
function appendExtras(segs, fat, resolveJoint) {
  for (let ei = 0; ei < profile.extras.length; ei++) {
    const e = profile.extras[ei];
    const mul = (groupMul[e.group] ?? 1.0) * fat;
    const targets = e.mirrorJoints ? [['Left' + e.joint, 1], ['Right' + e.joint, -1]] : [[e.joint, 1]];
    for (const [jname, jx] of targets) {
      const jt = resolveJoint(jname);
      if (!jt) continue;
      const flips = e.mirrorX ? [1, -1] : [jx];
      for (const fx of flips) {
        const a = new THREE.Vector3(e.a[0] * fx, e.a[1], e.a[2]).applyQuaternion(jt.quat).add(jt.pos);
        const b = new THREE.Vector3(e.b[0] * fx, e.b[1], e.b[2]).applyQuaternion(jt.quat).add(jt.pos);
        const seg = segDetail({ a, b, ra: e.ra * mul, rb: e.rb * mul, cut: e.op === 'cut' }, e, jt.quat, fx);
        seg.id = `extra:${ei}:${jname}`;
        segs.push(seg);
      }
    }
  }
}
// 가상 하위 뼈(subBones) — 애니메이션 리그를 건드리지 않는 세분화 층.
// 실제 관절(또는 앞서 정의된 가상 뼈)의 월드 변환에 프로파일 오프셋을 얹어
// 관절 사슬을 "추출 시점에" 합성한다. 트랙이 없으므로 부모 FK 를 그대로 상속
// → built-in 절차 클립/외부 FBX 클립 모두 무수정 (리그 비하드코딩 설계 결정 유지).
//   · mirrorX  : Left/Right 쌍 생성 (offset.x 와 flatten dir.x 부호 반전)
//   · link:false : 부모→가상 뼈 캡슐을 만들지 않는다 (자식 체인의 앵커 전용)
//   · 두께/디테일은 rules 가 가상 뼈 "이름"으로 결정 — grammar 원칙 그대로.
// 반환: 가상 관절 맵 (extras 가 가상 뼈에도 붙을 수 있게 결합 resolver 용).
function appendSubBones(segs, fat, resolveJoint) {
  const virt = {};
  const resolve = n => virt[n] ?? resolveJoint(n);
  for (const sb of profile.subBones ?? []) {
    const sides = sb.mirrorX ? [['Left', 1], ['Right', -1]] : [['', 1]];
    for (const [side, fx] of sides) {
      let pName = side + sb.parent, parent = resolve(pName);
      if (!parent) { pName = sb.parent; parent = resolve(pName); }
      if (!parent) continue; // 관절이 없는 리그 → 조용히 건너뜀 (extras 와 동일 계약)
      const pos = new THREE.Vector3(sb.offset[0] * fx, sb.offset[1], sb.offset[2])
        .applyQuaternion(parent.quat).add(parent.pos);
      virt[side + sb.name] = { pos, quat: parent.quat };
      if (sb.link === false || pos.distanceToSquared(parent.pos) < 1e-8) continue;
      const seg = {
        a: parent.pos.clone(), b: pos,
        ra: radiusForName(pName) * fat, rb: radiusForName(side + sb.name) * fat,
        id: 'sub:' + side + sb.name,
      };
      const rule = matchRule(profile, side + sb.name);
      if (rule) segDetail(seg, rule, parent.quat, fx);
      segDetail(seg, sb, parent.quat, fx); // 스펙 자체의 k/flatten 오버라이드 (rule 위에)
      segs.push(seg);
    }
  }
  return virt;
}
function builtinJoint(name) {
  const i = jointName.findIndex(jn => simpleName(jn) === name);
  if (i < 0) return null;
  return { pos: jointObjs[i].getWorldPosition(new THREE.Vector3()), quat: jointObjs[i].getWorldQuaternion(new THREE.Quaternion()) };
}
function extractBones(showFingers, fat) {
  rigRoot.updateMatrixWorld(true);
  const segs = [];
  for (let i = 0; i < jointDefs.length; i++) {
    const p = jointDefs[i].parent; if (p < 0) continue;
    if (!showFingers && (isFinger(jointName[i]) || isFinger(jointName[p]))) continue;
    jointObjs[i].getWorldPosition(_wp); jointObjs[p].getWorldPosition(_wpp);
    if (_wp.distanceToSquared(_wpp) < 1e-8) continue;
    // loft 스택 보유 뼈 → 캡슐 대신 원판 사슬 (없는 뼈는 기존 캡슐 — rig-agnostic 계약)
    const lf = loftStackFor(jointName[i]);
    if (lf) {
      emitLoft(segs, lf.spec, lf.fx, _wpp.clone(), _wp.clone(),
        jointObjs[i].getWorldQuaternion(new THREE.Quaternion()), fat, 'loft:' + simpleName(jointName[i]));
      continue;
    }
    const seg = {
      a: _wpp.clone(), b: _wp.clone(),
      ra: radiusForName(jointName[p]) * fat, rb: radiusForName(jointName[i]) * fat,
      id: simpleName(jointName[i]),
    };
    // 캡슐의 detail(k·flatten)은 자식 관절 규칙을 따른다
    const rule = matchRule(profile, simpleName(jointName[i]));
    if (rule && (rule.k != null || rule.flatten || rule.flatten2)) {
      segDetail(seg, rule, jointObjs[i].getWorldQuaternion(new THREE.Quaternion()));
    }
    segs.push(seg);
  }
  const virt = appendSubBones(segs, fat, builtinJoint);
  appendExtras(segs, fat, n => virt[n] ?? builtinJoint(n));
  return segs;
}
function uploadBones(segs) {
  // [평범한 캡슐 | detail 합집합 | 컷] 순서로 정렬 — 셰이더가 구간별 경로를 탄다
  const isDetail = s => s.cut || s.k != null || s.f != null || s.f2 != null;
  const plain = segs.filter(s => !isDetail(s));
  const detail = segs.filter(s => isDetail(s) && !s.cut);
  const cuts = segs.filter(s => s.cut);
  const ordered = plain.concat(detail, cuts);
  const detailStart = plain.length;
  const cutStart = plain.length + detail.length;
  const n = Math.min(ordered.length, MAXB);
  for (let i = 0; i < n; i++) {
    const s = ordered[i];
    uniforms.uBoneA.value[i].set(s.a.x, s.a.y, s.a.z, s.ra);
    uniforms.uBoneB.value[i].set(s.b.x, s.b.y, s.b.z, s.rb);
    uniforms.uBoneC.value[i].set(s.k ?? -1, s.f ?? 1, 0, 0);
    if (s.n) uniforms.uBoneN.value[i].set(s.n.x, s.n.y, s.n.z, 0);
    uniforms.uBoneM.value[i].set(s.n2?.x ?? 0, s.n2?.y ?? 0, s.n2?.z ?? 1, s.f2 ?? 1);
    bonePos.set([s.a.x, s.a.y, s.a.z, s.b.x, s.b.y, s.b.z], i * 6);
    jointPos.set([s.a.x, s.a.y, s.a.z, s.b.x, s.b.y, s.b.z], i * 6);
  }
  uniforms.uBoneCount.value = n;
  uniforms.uDetailStart.value = Math.min(detailStart, n);
  uniforms.uCutStart.value = Math.min(cutStart, n);
  boneGeo.setDrawRange(0, n * 2); jointGeo.setDrawRange(0, n * 2);
  boneGeo.attributes.position.needsUpdate = true;
  jointGeo.attributes.position.needsUpdate = true;
}

// ===========================================================================
//  (3-b) FBX 소스 : 실제 Mixamo 클립 재생 (Vite에선 FBXLoader 항상 사용 가능)
//    · 동봉 로코모션 샘플(public/assets/anim/*.fbx)을 fetch 로 바로 재생
//    · 클립을 전부 보관하고 이름으로 전환 (Mixamo 단일-클립 FBX 는 1개)
//    · 애니메이션-only FBX(스킨 메시 없음)는 뼈 world 위치로 바운드를 다시 잡는다
//      — Box3.setFromObject 만 쓰면 지오메트리가 없어 size.y=0 → scale 폭주로
//        캐릭터가 화면 밖으로 날아간다 (HktSplatLife ExternalSkeleton 과 동일 정식).
// ===========================================================================
let mode = 'builtin', extMixer = null, extRoot = null, extBones = [], extScale = 1, extCenter = new THREE.Vector3();
let extClips = {}, extActions = {}, extActive = '';
const statusEl = document.getElementById('status');
const setStatus = html => { statusEl.innerHTML = html; };
setStatus('FBX 로더 준비됨 — 로코모션 샘플 또는 Mixamo FBX를 드롭하세요.');

// 이름 클립으로 전환 — fade>0 이면 크로스페이드(같은 리그라 뼈 순서 불변 = 안전).
function playExtClip(name, fade) {
  if (!extMixer || !extClips[name] || extActive === name) return;
  if (!extActions[name]) extActions[name] = extMixer.clipAction(extClips[name]);
  const next = extActions[name];
  const prev = extActive && extActions[extActive];
  next.enabled = true; next.setEffectiveWeight(1).play();
  if (prev && fade > 0) { next.reset(); prev.crossFadeTo(next, fade, false); }
  else if (prev) prev.stop();
  extActive = name;
  refreshExtClips();
}
// 다중 클립 FBX 는 클립 버튼을 노출 (단일 클립이면 숨김).
function refreshExtClips() {
  const box = document.getElementById('extClips'); box.innerHTML = '';
  const names = Object.keys(extClips);
  if (mode !== 'external' || names.length < 2) return;
  for (const name of names) {
    const b = document.createElement('button'); b.textContent = name || '(무명)';
    b.classList.toggle('on', name === extActive);
    b.addEventListener('click', () => playExtClip(name, 0.25));
    box.appendChild(b);
  }
}

function loadFBXBuffer(buf, label) {
  try {
    const obj = new FBXLoader().parse(buf, '');
    let bones = []; obj.traverse(o => { if (o.isBone) bones.push(o); });
    if (!bones.length) obj.traverse(o => { if (o.isSkinnedMesh) bones = o.skeleton.bones; });
    if (!bones.length) { setStatus('스켈레톤을 못 찾았어요.'); return; }
    // 바운드 정규화 — 스킨 메시가 없으면(애니메이션-only) 뼈 world 위치로 다시 잡는다.
    obj.updateMatrixWorld(true);
    let box = new THREE.Box3().setFromObject(obj);
    if (box.isEmpty()) {
      box = new THREE.Box3(); const wp = new THREE.Vector3();
      for (const b of bones) { b.getWorldPosition(wp); box.expandByPoint(wp); }
    }
    const size = new THREE.Vector3(); box.getSize(size);
    extScale = 1.7 / Math.max(size.y, 1e-3); box.getCenter(extCenter);
    extRoot = obj; extBones = bones;
    extMixer = null; extClips = {}; extActions = {}; extActive = '';
    if (obj.animations && obj.animations.length) {
      extMixer = new THREE.AnimationMixer(obj);
      for (const c of obj.animations) extClips[c.name || `clip${Object.keys(extClips).length}`] = c;
      playExtClip(Object.keys(extClips)[0], 0);
    }
    mode = 'external'; st.clip = 'external';
    document.getElementById('extOpt').disabled = false;
    document.getElementById('clip').value = 'external';
    refreshExtClips();
    const nClip = Object.keys(extClips).length;
    setStatus(`<b>${label} 로드</b> — 뼈 ${bones.length}개 · 클립 ${nClip}개 재생 중.`);
  } catch (e) {
    setStatus('FBX 파싱 실패: ' + e.message);
  }
}

// 동봉 로코모션 샘플 (Mixamo, public/assets/anim/). 라벨=한글, 파일=영문.
const FBX_SAMPLES = [
  ['걷기', 'walk'], ['뛰기', 'run'], ['대기', 'idle'],
  ['점프', 'jump'], ['공격', 'attack'], ['삼바', 'samba'],
];
async function loadSample(file, label) {
  setStatus(`샘플 로드 중… (${label})`);
  try {
    const buf = await (await fetch(`assets/anim/${file}.fbx`)).arrayBuffer();
    loadFBXBuffer(buf, label);
  } catch (e) { setStatus(`샘플 로드 실패(${label}): ` + e.message); }
}
// 내장 스켈레톤(절차적 클립)으로 복귀.
function returnToBuiltin() {
  mode = 'builtin'; extRoot = null; extMixer = null; extClips = {}; extActions = {}; extActive = '';
  st.clip = 'walk';
  document.getElementById('clip').value = 'walk';
  document.getElementById('extOpt').disabled = true;
  refreshExtClips();
  setStatus('내장 스켈레톤 (built-in FK) — 절차적 클립.');
}
function externalJoint(name) {
  const b = extBones.find(bb => simpleName(bb.name) === name);
  if (!b) return null;
  const pos = b.getWorldPosition(new THREE.Vector3()).sub(extCenter).multiplyScalar(extScale);
  pos.y += 0.98;
  return { pos, quat: b.getWorldQuaternion(_wq) };
}
function extractExternal(showFingers, fat) {
  if (extMixer) extMixer.update((st.speed || 1) * (1 / 60));
  extRoot.updateMatrixWorld(true);
  const segs = [];
  for (const b of extBones) {
    if (!b.parent || !b.parent.isBone) continue;
    if (!showFingers && (isFinger(b.name) || isFinger(b.parent.name))) continue;
    b.getWorldPosition(_wp); b.parent.getWorldPosition(_wpp);
    const a = _wpp.clone().sub(extCenter).multiplyScalar(extScale); a.y += 0.98;
    const c = _wp.clone().sub(extCenter).multiplyScalar(extScale);  c.y += 0.98;
    if (a.distanceToSquared(c) < 1e-8) continue;
    // 외부 리그도 loft 는 t 비례라 뼈 길이가 달라도 자연 스케일 (rig-agnostic)
    const lf = loftStackFor(b.name);
    if (lf) {
      emitLoft(segs, lf.spec, lf.fx, a, c, b.getWorldQuaternion(new THREE.Quaternion()), fat, 'loft:' + simpleName(b.name));
      continue;
    }
    const seg = { a, b: c, ra: radiusForName(b.parent.name) * fat, rb: radiusForName(b.name) * fat, id: simpleName(b.name) };
    const rule = matchRule(profile, simpleName(b.name));
    if (rule && (rule.k != null || rule.flatten || rule.flatten2)) {
      segDetail(seg, rule, b.getWorldQuaternion(new THREE.Quaternion()));
    }
    segs.push(seg);
  }
  const virt = appendSubBones(segs, fat, externalJoint);
  appendExtras(segs, fat, n => virt[n] ?? externalJoint(n));
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
  const r = new FileReader(); r.onload = () => loadFBXBuffer(r.result, f.name); r.readAsArrayBuffer(f);
}

// ===========================================================================
//  카메라 / 입력 / 루프
// ===========================================================================
const st = { az: 0.5, el: 0.06, dist: 4.0, clip: 'walk', speed: 1.0, k: profile.defaults?.k ?? 0.12, fat: 1.0, fingers: false, bone: false, pause: false };
// ?paused=1 — 계측 도구용: 첫 프레임부터 렌더를 쉰다 (소프트웨어 GL 은 프레임이 수 초 —
// 페이지 로드 직후의 무거운 프레임들이 evaluate/fit 호출을 굶긴다)
if (new URLSearchParams(location.search).has('paused')) st.pause = true;
uniforms.uK.value = st.k;
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

// ---- 비율 패널 : 프리셋 전환 + 그룹 배율 슬라이더 --------------------------
// 프리셋 전환은 built-in 리그를 프로파일 치수로 재생성한다 (외부 FBX 는 자체
// 뼈 길이 유지 — 두께 규칙/볼륨 헬퍼만 새 프로파일을 따른다).
function setPreset(id) {
  if (!PROFILES[id]) return;
  profile = PROFILES[id];
  instantiateRig(buildMixamoRig(profile.skeleton));
  if (profile.defaults?.k != null) {
    st.k = profile.defaults.k; uniforms.uK.value = st.k;
    $('k').value = st.k; $('kVal').textContent = st.k.toFixed(2);
  }
  $('preset').value = id;
}
const presetSel = $('preset');
for (const [id, p] of Object.entries(PROFILES)) {
  const o = document.createElement('option'); o.value = id; o.textContent = p.name;
  presetSel.appendChild(o);
}
presetSel.value = Object.entries(PROFILES).find(([, p]) => p === profile)[0];
presetSel.addEventListener('change', e => setPreset(e.target.value));

const gbox = $('propGroups');
for (const [key, label] of GROUPS) {
  const row = document.createElement('div'); row.className = 'row';
  row.innerHTML = `<label>${label} <span id="pg_${key}_v">1.00</span></label>
    <input id="pg_${key}" type="range" min="0.5" max="1.6" step="0.01" value="1.0">`;
  gbox.appendChild(row);
  row.querySelector('input').addEventListener('input', e => {
    groupMul[key] = +e.target.value;
    row.querySelector('span').textContent = (+e.target.value).toFixed(2);
  });
}

// 시작 프로파일의 권장 smin 을 슬라이더에 반영.
$('k').value = st.k; $('kVal').textContent = st.k.toFixed(2);

// ---- 계측 훅 (eval/fit-loft.mjs 용) ----------------------------------------
// screenToWorld: 렌더 버퍼 픽셀 → plane('z'|'x')=0 평면 교차 월드 좌표.
//   정면(az=0)은 z=0, 측면(az=π/2)은 x=0 평면에 캐릭터가 서 있다.
function screenToWorld(xpx, ypx, plane) {
  updateCam(); // st.az 변경 직후 렌더 프레임 없이 호출돼도 카메라를 최신으로
  const w = renderer.domElement.width, h = renderer.domElement.height;
  const p0 = new THREE.Vector3((xpx + 0.5) / w * 2 - 1, -((ypx + 0.5) / h * 2 - 1), -1).unproject(cam);
  const dir = p0.sub(cam.position).normalize();
  const t = plane === 'x' ? -cam.position.x / dir.x : -cam.position.z / dir.z;
  const q = cam.position.clone().addScaledVector(dir, t);
  return [q.x, q.y, q.z];
}
// joints: 현재(포즈 적용된) built-in 관절 월드 좌표/회전 덤프 — 바인드 포즈 피팅용.
function jointsDump() {
  if (!rigRoot) return {};
  rigRoot.updateMatrixWorld(true);
  const out = {};
  for (let i = 0; i < jointObjs.length; i++) {
    const p = jointObjs[i].getWorldPosition(new THREE.Vector3());
    const q = jointObjs[i].getWorldQuaternion(new THREE.Quaternion());
    out[simpleName(jointName[i])] = {
      pos: [p.x, p.y, p.z], quat: [q.x, q.y, q.z, q.w],
      parent: jointDefs[i].parent >= 0 ? simpleName(jointName[jointDefs[i].parent]) : null,
    };
  }
  return out;
}
// 세그먼트 제외 필터 (id 정규식) — "몸통만" 같은 부분 실루엣 계측용. null 로 해제.
let segExcl = null;
function setSegFilter(re) { segExcl = re ? new RegExp(re) : null; }

// 디버그/튜닝 핸들 — 콘솔에서 프로파일 수치를 실시간으로 만질 수 있다.
window.__hkt = {
  st, groupMul, setPreset, PROFILES, get profile() { return profile; }, uniforms, updateCam,
  screenToWorld, joints: jointsDump, setSegFilter, target,
};
$('btnFinger').addEventListener('click', e => { st.fingers = !st.fingers; e.target.classList.toggle('on', st.fingers); });
$('btnBone').addEventListener('click', e => { st.bone = !st.bone; boneLines.visible = joints3.visible = st.bone; e.target.classList.toggle('on', st.bone); });
$('btnBuiltin').addEventListener('click', returnToBuiltin);

// 동봉 로코모션 샘플 버튼 — 클릭 시 해당 FBX 를 fetch 해 살이 그 클립을 따라간다.
const sbox = $('fbxSamples');
for (const [label, file] of FBX_SAMPLES) {
  const b = document.createElement('button'); b.textContent = label;
  b.addEventListener('click', () => loadSample(file, label));
  sbox.appendChild(b);
}

const clock = new THREE.Clock();
function loop() {
  // st.pause: 계측 도구용 — 레이마칭을 쉬어 페이지 evaluate 지연을 없앤다
  // (소프트웨어 GL 에선 프레임이 수 초 — 시트 분석/좌표 변환은 렌더가 필요 없다)
  if (st.pause) { requestAnimationFrame(loop); return; }
  const t = clock.getElapsedTime();
  let segs;
  if (mode === 'external' && extRoot) {
    segs = extractExternal(st.fingers, st.fat);
  } else {
    applyPose(st.clip === 'external' ? 'idle' : st.clip, t, st.speed);
    segs = extractBones(st.fingers, st.fat);
  }
  if (segExcl) segs = segs.filter(s => !segExcl.test(s.id ?? ''));
  uploadBones(segs); updateCam();
  renderer.clear();
  renderer.render(quadScene, quadCam);
  if (st.bone) renderer.render(skelScene, cam);
  requestAnimationFrame(loop);
}
loop(); // 메인 루프 시작
