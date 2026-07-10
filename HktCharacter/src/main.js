// ============================================================================
//  HktCharacter — 미니멀 FBX 뷰어 (리셋 v2)
//
//  하는 일 딱 세 가지:
//    1. with-skin 캐릭터 FBX → 스킨 메시를 그대로 렌더 (핵심 수정: 이전 코드는
//       FBX 의 메시를 씬에 추가하지 않고 뼈만 추출했다)
//    2. 애니메이션-only FBX / 동봉 샘플 → 현재 캐릭터에 이름 매칭으로 리타깃 재생
//    3. 본 표시 = THREE.SkeletonHelper — "실제" 스켈레톤을 그린다
//       (이전의 "긴 손가락"은 SDF 세그먼트(가상 뼈·볼륨 헬퍼 포함)를 본이라고
//        그렸던 것 — 실제 리그의 뼈가 아니었다)
// ============================================================================
import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { McFlesh } from './mcflesh.js';

// ---------------------------------------------------------------------------
//  씬 / 렌더러
// ---------------------------------------------------------------------------
const app = document.getElementById('app');
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
app.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x14161a);
scene.fog = new THREE.Fog(0x14161a, 8, 30);

const cam = new THREE.PerspectiveCamera(45, 1, 0.05, 100);
cam.position.set(1.6, 1.6, 3.2);
const controls = new OrbitControls(cam, renderer.domElement);
controls.target.set(0, 0.95, 0);
controls.enableDamping = true;

scene.add(new THREE.HemisphereLight(0xbfd4ff, 0x30271f, 1.1));
const sun = new THREE.DirectionalLight(0xffffff, 1.6);
sun.position.set(2.5, 5, 3);
scene.add(sun);

const grid = new THREE.GridHelper(20, 40, 0x39424e, 0x242a32);
scene.add(grid);
const ground = new THREE.Mesh(
  new THREE.CircleGeometry(10, 48).rotateX(-Math.PI / 2),
  new THREE.MeshStandardMaterial({ color: 0x1a1e24, roughness: 1 }),
);
ground.position.y = -0.005;
scene.add(ground);

function resize() {
  const w = app.clientWidth, h = app.clientHeight;
  renderer.setSize(w, h, false);
  cam.aspect = w / h;
  cam.updateProjectionMatrix();
}
addEventListener('resize', resize);
resize();

const setStatus = html => { document.getElementById('status').innerHTML = html; };

// ---------------------------------------------------------------------------
//  캐릭터 상태
// ---------------------------------------------------------------------------
//  ch = { root, meshes[], bones[], mixer, clips{}, actions{}, active, helper,
//         hasMesh }  — 화면엔 항상 최대 1개.
let ch = null;
const ui = { speed: 1, bone: false, mesh: true, gray: false, wire: false, sdf: false };

// Mixamo 이름 정규화: "mixamorig:LeftHand" / "mixamorig1:LeftHand" /
// "mixamorigLeftHand" → "lefthand". 리그가 달라도 단순명으로 매칭.
const simpleName = n =>
  n.split(':').pop().replace(/^mixamorig\d*/i, '').toLowerCase();

function disposeCharacter() {
  if (!ch) return;
  scene.remove(ch.root);
  if (ch.helper) scene.remove(ch.helper);
  ch.root.traverse(o => {
    if (o.geometry) o.geometry.dispose();
    for (const m of [].concat(o.material || [])) m.dispose?.();
  });
  ch = null;
  refreshClipButtons();
}

// FBX 루트를 "키 ~1.7 m·발바닥 y=0·원점"으로 정규화 (Mixamo 는 cm 스케일 100배)
function normalizeRoot(root, bones) {
  root.updateMatrixWorld(true);
  let box = new THREE.Box3().setFromObject(root);
  if (box.isEmpty()) { // 애니메이션-only: 지오메트리가 없으면 뼈 위치로
    box = new THREE.Box3();
    const p = new THREE.Vector3();
    for (const b of bones) box.expandByPoint(b.getWorldPosition(p));
  }
  const size = new THREE.Vector3(); box.getSize(size);
  const s = 1.7 / Math.max(size.y, 1e-3);
  root.scale.multiplyScalar(s);
  root.updateMatrixWorld(true);
  box.setFromObject(root);
  if (box.isEmpty()) {
    const p = new THREE.Vector3();
    for (const b of bones) box.expandByPoint(b.getWorldPosition(p));
  }
  const c = new THREE.Vector3(); box.getCenter(c);
  root.position.x -= c.x;
  root.position.z -= c.z;
  root.position.y -= box.min.y; // 발바닥을 바닥에
  root.updateMatrixWorld(true);
}

// ---------------------------------------------------------------------------
//  클립 등록/재생 (크로스페이드)
// ---------------------------------------------------------------------------
function addClips(anims, label) {
  if (!ch || !anims?.length) return 0;
  let added = 0;
  for (const clip of anims) {
    const c = retargetClip(clip);
    if (!c) continue;
    const name = c.name && c.name !== 'mixamo.com' ? c.name : label;
    let key = name, i = 2;
    while (ch.clips[key]) key = `${name} ${i++}`;
    c.name = key;
    ch.clips[key] = c;
    added++;
  }
  refreshClipButtons();
  return added;
}

// 트랙 노드명을 현재 캐릭터의 실제 뼈 이름으로 재작성 (이름 매칭 리타깃).
// position 트랙은 Hips(루트)만 유지 — 리그 간 뼈 길이가 달라도 본이 늘어나지
// 않게 회전만 옮긴다. (이전 "본 길이 어색"의 재발 방지)
function retargetClip(clip) {
  const byName = ch.boneMap;
  const tracks = [];
  for (const t of clip.tracks) {
    const dot = t.name.lastIndexOf('.');
    const node = t.name.slice(0, dot), prop = t.name.slice(dot + 1);
    const bone = byName.get(simpleName(node));
    if (!bone) continue;
    if (prop === 'position' && simpleName(node) !== 'hips') continue;
    if (prop === 'scale') continue;
    const nt = t.clone();
    nt.name = `${bone.name}.${prop}`;
    tracks.push(nt);
  }
  if (!tracks.length) return null;
  return new THREE.AnimationClip(clip.name, clip.duration, tracks);
}

function playClip(name, fade = 0.25) {
  if (!ch || !ch.clips[name] || ch.active === name) return;
  if (!ch.actions[name]) ch.actions[name] = ch.mixer.clipAction(ch.clips[name]);
  const next = ch.actions[name];
  const prev = ch.active && ch.actions[ch.active];
  next.enabled = true;
  next.setEffectiveWeight(1).play();
  if (prev && fade > 0) { next.reset(); prev.crossFadeTo(next, fade, false); }
  else if (prev) prev.stop();
  ch.active = name;
  refreshClipButtons();
}

function refreshClipButtons() {
  const box = document.getElementById('clips');
  box.innerHTML = '';
  const names = ch ? Object.keys(ch.clips) : [];
  if (!names.length) {
    box.innerHTML = '<span style="color:#5c6673">캐릭터/클립 없음</span>';
    return;
  }
  for (const name of names) {
    const b = document.createElement('button');
    b.textContent = name;
    b.classList.toggle('on', name === ch.active);
    b.addEventListener('click', () => playClip(name));
    box.appendChild(b);
  }
}

// ---------------------------------------------------------------------------
//  FBX 로드 — 메시가 있으면 캐릭터 교체, 없으면(애니메이션-only) 클립 리타깃
// ---------------------------------------------------------------------------
function loadFBXBuffer(buf, label) {
  let obj;
  try { obj = new FBXLoader().parse(buf, ''); }
  catch (e) { setStatus('FBX 파싱 실패: ' + e.message); return; }

  const meshes = [], bones = [];
  obj.traverse(o => {
    if (o.isSkinnedMesh || o.isMesh) meshes.push(o);
    if (o.isBone) bones.push(o);
  });
  if (!bones.length && meshes.length) {
    for (const m of meshes) if (m.isSkinnedMesh) bones.push(...m.skeleton.bones);
  }

  if (meshes.length) {
    // ---- 캐릭터 FBX: 스킨 메시를 씬에 그대로 올린다 --------------------------
    disposeCharacter();
    for (const m of meshes) {
      m.frustumCulled = false; // 애니메이션으로 원래 바운드를 벗어나도 사라지지 않게
      m.castShadow = m.receiveShadow = false;
      m.userData.origMaterial = m.material;
    }
    normalizeRoot(obj, bones);
    scene.add(obj);
    const boneMap = new Map();
    for (const b of bones) if (!boneMap.has(simpleName(b.name))) boneMap.set(simpleName(b.name), b);
    ch = {
      root: obj, meshes, bones, boneMap, hasMesh: true,
      mixer: new THREE.AnimationMixer(obj), clips: {}, actions: {}, active: '',
      helper: bones.length ? new THREE.SkeletonHelper(obj) : null,
    };
    if (ch.helper) {
      ch.helper.material.depthTest = false; // 메시 너머로도 본이 보이게
      ch.helper.visible = ui.bone;
      scene.add(ch.helper);
    }
    applyMaterialMode();
    const n = addClips(obj.animations, label);
    if (n) playClip(Object.keys(ch.clips)[0], 0);
    setStatus(`<b>${label}</b> 로드 — 메시 ${meshes.length}개 · 뼈 ${bones.length}개 · 클립 ${n}개.`
      + (n ? '' : ' 로코모션 샘플이나 애니메이션 FBX 를 얹어보세요.'));
  } else if (bones.length && obj.animations?.length) {
    // ---- 애니메이션-only FBX -------------------------------------------------
    if (ch) {
      const n = addClips(obj.animations, label);
      if (n) { playClip(Object.keys(ch.clips).at(-1), 0.25); setStatus(`<b>${label}</b> — 클립 ${n}개를 현재 캐릭터에 리타깃.`); }
      else setStatus(`<b>${label}</b> — 이름이 맞는 뼈가 없어 리타깃 실패.`);
    } else {
      // 캐릭터가 없으면 스켈레톤만이라도 보여준다
      disposeCharacter();
      normalizeRoot(obj, bones);
      scene.add(obj);
      const boneMap = new Map();
      for (const b of bones) if (!boneMap.has(simpleName(b.name))) boneMap.set(simpleName(b.name), b);
      ch = {
        root: obj, meshes: [], bones, boneMap, hasMesh: false,
        mixer: new THREE.AnimationMixer(obj), clips: {}, actions: {}, active: '',
        helper: new THREE.SkeletonHelper(obj),
      };
      ch.helper.material.depthTest = false;
      ch.helper.visible = true; // 메시가 없으니 본은 무조건 켠다
      scene.add(ch.helper);
      const n = addClips(obj.animations, label);
      if (n) playClip(Object.keys(ch.clips)[0], 0);
      setStatus(`<b>${label}</b> — 애니메이션 전용 FBX (메시 없음). 스켈레톤 표시 중.`
        + ' <i>⚠ 이 리그는 Mixamo 내보내기용 임시 스켈레톤이라 비율(손가락·발 길이 등)이'
        + ' 실제 캐릭터와 다릅니다.</i> with-skin 캐릭터 FBX(또는 삼바 샘플)를 먼저 로드하고'
        + ' 그 위에 얹으면 정상 비율로 재생됩니다.');
    }
  } else {
    setStatus(`<b>${label}</b> — 스켈레톤/메시를 찾지 못했습니다.`);
  }
}

// ---------------------------------------------------------------------------
//  동봉 샘플 + 드롭존
// ---------------------------------------------------------------------------
const FBX_SAMPLES = [
  ['걷기', 'walk'], ['뛰기', 'run'], ['대기', 'idle'],
  ['점프', 'jump'], ['공격', 'attack'], ['삼바', 'samba'],
];
{
  const box = document.getElementById('samples');
  for (const [label, file] of FBX_SAMPLES) {
    const b = document.createElement('button');
    b.textContent = label;
    b.addEventListener('click', async () => {
      setStatus(`샘플 로드 중… (${label})`);
      try {
        const buf = await (await fetch(`assets/anim/${file}.fbx`)).arrayBuffer();
        loadFBXBuffer(buf, label);
      } catch (e) { setStatus(`샘플 로드 실패(${label}): ` + e.message); }
    });
    box.appendChild(b);
  }
}

const drop = document.getElementById('drop');
for (const ev of ['dragover', 'dragenter'])
  addEventListener(ev, e => { e.preventDefault(); drop.classList.add('hot'); });
for (const ev of ['dragleave', 'drop'])
  addEventListener(ev, e => { e.preventDefault(); drop.classList.remove('hot'); });
addEventListener('drop', e => { if (e.dataTransfer.files[0]) readFile(e.dataTransfer.files[0]); });
drop.addEventListener('click', () => {
  const inp = document.createElement('input');
  inp.type = 'file'; inp.accept = '.fbx';
  inp.onchange = e => readFile(e.target.files[0]);
  inp.click();
});
function readFile(f) {
  if (!f) return;
  setStatus('읽는 중… ' + f.name);
  const r = new FileReader();
  r.onload = () => loadFBXBuffer(r.result, f.name.replace(/\.fbx$/i, ''));
  r.readAsArrayBuffer(f);
}

// ---------------------------------------------------------------------------
//  표시 토글 / 속도
// ---------------------------------------------------------------------------
const $ = id => document.getElementById(id);
const grayMat = new THREE.MeshStandardMaterial({ color: 0x9aa4b0, roughness: 0.75 });

function applyMaterialMode() {
  if (!ch) return;
  for (const m of ch.meshes) {
    m.visible = ui.mesh;
    m.material = ui.gray ? grayMat : m.userData.origMaterial;
    for (const mat of [].concat(m.material)) mat.wireframe = ui.wire;
  }
}
$('btnMesh').addEventListener('click', e => {
  ui.mesh = !ui.mesh; e.target.classList.toggle('on', ui.mesh); applyMaterialMode();
});
$('btnBone').addEventListener('click', e => {
  ui.bone = !ui.bone; e.target.classList.toggle('on', ui.bone);
  if (ch?.helper) ch.helper.visible = ui.bone || !ch.hasMesh;
});
$('btnGray').addEventListener('click', e => {
  ui.gray = !ui.gray; e.target.classList.toggle('on', ui.gray); applyMaterialMode();
});
$('btnWire').addEventListener('click', e => {
  ui.wire = !ui.wire; e.target.classList.toggle('on', ui.wire);
  grayMat.wireframe = ui.wire; applyMaterialMode();
});
// SDF 살 — 스켈레톤 캡슐을 MarchingCubes 로 실시간 폴리곤화 (mcflesh.js)
const mcFlesh = new McFlesh(scene);
$('btnSdf').addEventListener('click', e => {
  ui.sdf = !ui.sdf; e.target.classList.toggle('on', ui.sdf);
  mcFlesh.setVisible(ui.sdf && !!ch);
  if (ui.sdf && !ch) setStatus('SDF 살: 먼저 캐릭터/샘플을 로드하세요.');
});
$('spd').addEventListener('input', e => {
  ui.speed = +e.target.value;
  $('spdVal').textContent = ui.speed.toFixed(1);
});

// ---------------------------------------------------------------------------
//  루프
// ---------------------------------------------------------------------------
const clock = new THREE.Clock();
function loop() {
  const dt = Math.min(clock.getDelta(), 0.1);
  if (ch?.mixer) ch.mixer.update(dt * ui.speed);
  if (ui.sdf && ch) {
    ch.root.updateMatrixWorld(true);
    mcFlesh.setVisible(true);
    mcFlesh.update(ch.bones, simpleName);
  } else mcFlesh.setVisible(false);
  controls.update();
  renderer.render(scene, cam);
  requestAnimationFrame(loop);
}
setStatus('준비됨 — with-skin 캐릭터 FBX 를 드롭하거나 로코모션 샘플을 눌러보세요.');
loop();

// 콘솔/자동 검증용 핸들
window.__hkt = {
  scene, cam, renderer, ui,
  get ch() { return ch; },
  loadFBXBuffer, playClip,
};
