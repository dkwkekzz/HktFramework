// ============================================================================
//  HktCharacter — 뼈 → 근육 → 피부 파이프라인 (신규 제작 방식)
//
//  캐릭터를 "완성된 스킨 FBX"로 불러오지 않는다. 대신 사람을 만들듯 3단계로 쌓는다:
//    ① 뼈   — X/Y Bot Mixamo 스켈레톤을 로드 (skeleton.js). 봇의 원본 스킨은 버린다.
//    ② 근육 — 해부학 아틀라스대로 뼈 사이에 방추형 근육을 부착 (muscles.js).
//             애니메이션에 따라 늘고 수축하면 부푼다.
//    ③ 피부 — 근육·뼈의 음함수 필드에서 표면을 뽑아(MarchingCubes) rest 포즈에서
//             한 번 굽고, 뼈에 스키닝 바인딩 (skin.js). 이후 GPU 스키닝으로 재생.
//
//  애니메이션은 Mixamo 클립을 리그에 리타깃(retarget.js) — 뼈가 움직이면 근육·피부가
//  함께 따라온다. 상세 설계 → docs/PIPELINE.md.
// ============================================================================
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { loadSkeleton, replant, disposeRig, boneBox } from './skeleton.js';
import { MuscleLayer } from './muscles.js';
import { BODY_PRESETS } from './anatomy.js';
import { bakeSkin } from './skin.js';
import { parseClipFBX, bakeClip, measureGroundY } from './retarget.js';

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
scene.fog = new THREE.Fog(0x14161a, 9, 34);

const cam = new THREE.PerspectiveCamera(45, 1, 0.05, 100);
cam.position.set(0.6, 1.5, 4.0);
const controls = new OrbitControls(cam, renderer.domElement);
controls.target.set(0, 0.95, 0);
controls.enableDamping = true;

scene.add(new THREE.HemisphereLight(0xbfd4ff, 0x30271f, 1.1));
const sun = new THREE.DirectionalLight(0xffffff, 1.7);
sun.position.set(2.5, 5, 3);
scene.add(sun);
const rim = new THREE.DirectionalLight(0x88aaff, 0.5);
rim.position.set(-3, 2, -4);
scene.add(rim);

scene.add(new THREE.GridHelper(20, 40, 0x39424e, 0x242a32));
const ground = new THREE.Mesh(
  new THREE.CircleGeometry(10, 48).rotateX(-Math.PI / 2),
  new THREE.MeshStandardMaterial({ color: 0x1a1e24, roughness: 1 }),
);
ground.position.y = -0.005;
scene.add(ground);

function resize() {
  const w = app.clientWidth, h = app.clientHeight;
  renderer.setSize(w, h);
  cam.aspect = w / h;
  cam.updateProjectionMatrix();
}
addEventListener('resize', resize);
resize();

const setStatus = html => { document.getElementById('status').innerHTML = html; };
const $ = id => document.getElementById(id);

// ---------------------------------------------------------------------------
//  데이터
// ---------------------------------------------------------------------------
const MODELS = [
  { label: 'X Bot', file: 'assets/character/X Bot.fbx' },
  { label: 'Y Bot', file: 'assets/character/Y Bot.fbx' },
];
const ANIMS = [
  ['대기', 'idle'], ['걷기', 'walk'], ['뛰기', 'run'],
  ['점프', 'jump'], ['공격', 'attack'], ['삼바', 'samba'],
];

const view = { bone: false, muscle: false, skin: true };
let speed = 1;
let body = '평균'; // 체형 프리셋(BODY_PRESETS 키)

// 현재 캐릭터 상태
const C = {
  rig: null, muscles: null, skin: null, helper: null,
  mixer: null, clips: {}, actions: {}, active: '', groundY: {},
};
const sourceCache = {}; // 애니 파일 → 파싱된 소스 (모델 간 공유)

// ---------------------------------------------------------------------------
//  파이프라인 빌드 — 로드 → 근육 → 피부
// ---------------------------------------------------------------------------
async function loadModel(file, label) {
  setStatus(`${label}: ① 골격 로드 중…`);
  const buf = await (await fetch(encodeURI(file))).arrayBuffer();

  // 이전 캐릭터 정리
  if (C.rig) {
    C.mixer?.stopAllAction();
    scene.remove(C.rig.obj);
    if (C.helper) scene.remove(C.helper);
    if (C.skin) scene.remove(C.skin.mesh);
    C.muscles?.dispose();
    disposeRig(C.rig);
  }
  C.clips = {}; C.actions = {}; C.active = ''; C.groundY = {};

  // ① 뼈
  const rig = loadSkeleton(buf);
  replant(rig);
  scene.add(rig.obj);
  C.rig = rig;
  C.helper = new THREE.SkeletonHelper(rig.obj);
  C.helper.material.depthTest = false;
  scene.add(C.helper);

  // ② 근육 (체형 프리셋 반영)
  setStatus(`${label}: ② 근육 부착 중…`);
  await frame();
  C.muscles = new MuscleLayer(scene);
  C.muscles.build(rig, BODY_PRESETS[body]);

  // ③ 피부 (굽기)
  setStatus(`${label}: ③ 피부 굽는 중…`);
  await frame();
  const caps = C.muscles.getCapsules();
  C.skin = bakeSkin(rig, caps, C.muscles.profile); // 전달률·fascia 반영(§11·§9.10)
  scene.add(C.skin.mesh);

  C.mixer = new THREE.AnimationMixer(rig.obj);
  applyView();
  await playAnim('대기', 'idle', 0);
  setStatus(`${label} 준비됨 — 피부 ${C.skin.stats.tris.toFixed(0)}삼각형 · 근육 ${C.muscles.items.length}개. 레이어 버튼으로 단계 확인.`);
  refreshAnims();
}

// 한 프레임 양보 (무거운 굽기 전 상태 텍스트가 렌더되게)
const frame = () => new Promise(r => requestAnimationFrame(() => r()));

// 체형만 바꿔 근육·피부를 재빌드 (뼈·애니메이션은 유지). 같은 골격에서 마른/근육질/비만.
async function rebuildBody() {
  if (!C.rig) return;
  setStatus(`체형 «${body}»: 근육·피부 재빌드 중…`);
  await frame();
  if (C.skin) {
    scene.remove(C.skin.mesh);
    C.skin.mesh.geometry.dispose();
    C.skin.mesh.material.dispose();
  }
  C.muscles.build(C.rig, BODY_PRESETS[body]);   // 근육량 반영
  C.skin = bakeSkin(C.rig, C.muscles.getCapsules(), C.muscles.profile); // 지방·전달률·fascia 반영해 다시 굽기
  scene.add(C.skin.mesh);
  applyView();
  const p = BODY_PRESETS[body];
  setStatus(`체형 «${body}» — 근육 ×${p.muscle} · 지방 ${(p.fat * 100).toFixed(1)}cm · 피부 ${C.skin.stats.tris.toFixed(0)}삼각형.`);
}

// ---------------------------------------------------------------------------
//  애니메이션 — 리타깃 후 재생
// ---------------------------------------------------------------------------
async function loadSource(file) {
  if (sourceCache[file]) return sourceCache[file];
  const buf = await (await fetch(`assets/anim/${file}.fbx`)).arrayBuffer();
  const src = parseClipFBX(buf);
  if (src) sourceCache[file] = src;
  return src;
}

async function playAnim(label, file, fade = 0.25) {
  const rig = C.rig;
  if (!rig) return;
  if (!C.clips[label]) {
    const src = await loadSource(file);
    if (!src) { setStatus(`${label}: 클립 로드 실패`); return; }
    let baked;
    try { baked = bakeClip(rig, src, label); }
    catch (e) { setStatus(`${label}: 리타깃 실패 — ${e.message}`); return; }
    if (!baked) { setStatus(`${label}: 맞는 뼈 없음`); return; }
    C.clips[label] = baked;
    C.groundY[label] = measureGroundY(rig, baked);
  }
  const clip = C.clips[label];
  if (C.active === label) return;
  if (!C.actions[label]) C.actions[label] = C.mixer.clipAction(clip);
  const next = C.actions[label];
  const prev = C.active && C.actions[C.active];
  next.enabled = true;
  next.setEffectiveWeight(1).play();
  if (prev && fade > 0) { next.reset(); prev.crossFadeTo(next, fade, false); }
  else if (prev) prev.stop();
  C.active = label;
  rig.obj.position.y = C.groundY[label];
  C.mixer.update(0);
  refreshAnims();
}

// ---------------------------------------------------------------------------
//  레이어 표시
// ---------------------------------------------------------------------------
function applyView() {
  if (C.helper) C.helper.visible = view.bone;
  if (C.muscles) C.muscles.setVisible(view.muscle);
  if (C.skin) C.skin.mesh.visible = view.skin;
}

// ---------------------------------------------------------------------------
//  UI
// ---------------------------------------------------------------------------
function refreshAnims() {
  const box = $('anims'); box.innerHTML = '';
  for (const [label, file] of ANIMS) {
    const b = document.createElement('button');
    b.textContent = label;
    b.classList.toggle('on', C.active === label);
    b.addEventListener('click', () => playAnim(label, file));
    box.appendChild(b);
  }
}

function buildModelSelect() {
  const sel = $('model'); sel.innerHTML = '';
  MODELS.forEach((m, i) => {
    const o = document.createElement('option');
    o.value = String(i); o.textContent = m.label;
    sel.appendChild(o);
  });
  sel.addEventListener('change', () => {
    const m = MODELS[+sel.value];
    loadModel(m.file, m.label).catch(e => setStatus('로드 실패: ' + e.message));
  });
}

function buildBodySelect() {
  const sel = $('body'); sel.innerHTML = '';
  for (const name of Object.keys(BODY_PRESETS)) {
    const o = document.createElement('option');
    o.value = name; o.textContent = name; o.selected = name === body;
    sel.appendChild(o);
  }
  sel.addEventListener('change', () => {
    body = sel.value;
    rebuildBody().catch(e => setStatus('체형 재빌드 실패: ' + e.message));
  });
}

$('btnBone').addEventListener('click', e => {
  view.bone = !view.bone; e.target.classList.toggle('on', view.bone); applyView();
});
$('btnMuscle').addEventListener('click', e => {
  view.muscle = !view.muscle; e.target.classList.toggle('on', view.muscle); applyView();
});
$('btnSkin').addEventListener('click', e => {
  view.skin = !view.skin; e.target.classList.toggle('on', view.skin); applyView();
});
$('spd').addEventListener('input', e => {
  speed = +e.target.value; $('spdVal').textContent = speed.toFixed(1);
});
// 활성도 슬라이더(§10.3·§10.6): 전 근육 등척성 팽창. 근육 레이어에서 육안 확인.
$('activ').addEventListener('input', e => {
  const a = +e.target.value; $('activVal').textContent = a.toFixed(1);
  C.muscles?.setActivation(a);
});

buildModelSelect();
buildBodySelect();
refreshAnims();

// ---------------------------------------------------------------------------
//  루프
// ---------------------------------------------------------------------------
const clock = new THREE.Clock();
function loop() {
  const dt = Math.min(clock.getDelta(), 0.1);
  if (C.mixer) {
    C.mixer.update(dt * speed);
    C.rig.obj.updateMatrixWorld(true);
    if (C.muscles && view.muscle) C.muscles.update(); // 근육 라이브 갱신
  }
  controls.update();
  renderer.render(scene, cam);
  requestAnimationFrame(loop);
}
loop();

loadModel(MODELS[0].file, MODELS[0].label)
  .catch(e => setStatus('초기 로드 실패: ' + e.message));

// 콘솔/자동 검증용 핸들
window.__hkt = { scene, cam, renderer, C, MODELS, ANIMS, view, loadModel, playAnim };
