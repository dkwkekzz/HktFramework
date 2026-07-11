// main.js — 확인 가능한 무대.
//
// 코드로 리그를 짓고(rig.js) → 그 위에 절차 살을 기르고(flesh.js) → Mixamo 클립을
// 리타깃 없이 그대로 얹어 재생한다. 그리드·조명·OrbitControls 의 최소 무대.
// window.__hkt 로 상태를 노출(검증/디버그).

import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { buildRig, normalizeClip, DEFAULT_GENOME } from './rig.js';
import { growFlesh, DEFAULT_FLESH } from './flesh.js';

const CLIPS = { 대기: 'idle.fbx', 걷기: 'walk.fbx', 뛰기: 'run.fbx' };

// ── 무대 ──────────────────────────────────────────────────
const app = document.getElementById('app');
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(app.clientWidth, app.clientHeight);
app.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1a1d24);

// 리그는 cm 단위(키 ~200) → 카메라·그리드도 cm 로 맞춘다.
const cam = new THREE.PerspectiveCamera(45, app.clientWidth / app.clientHeight, 1, 4000);
cam.position.set(180, 150, 320);
const controls = new OrbitControls(cam, renderer.domElement);
controls.target.set(0, 100, 0);
controls.update();

scene.add(new THREE.HemisphereLight(0xbfd4ff, 0x2a2620, 1.1));
const dir = new THREE.DirectionalLight(0xffffff, 1.6);
dir.position.set(120, 260, 160);
scene.add(dir);

const grid = new THREE.GridHelper(600, 24, 0x3a4050, 0x2a2f3a);
scene.add(grid);

// ── 크리처 상태 ───────────────────────────────────────────
const state = {
  genome: { ...DEFAULT_GENOME },
  flesh: { ...DEFAULT_FLESH },
  clip: '대기',
  speed: 1,
  showFlesh: true,
  showBones: false,
  pause: false,
};
let creature = null;   // { mesh, rig, mixer, helper, actions }
const clock = new THREE.Clock();
const clipCache = new Map();
const fbxLoader = new FBXLoader();

// Mixamo FBX 에서 클립 하나를 로드해 리그 이름에 맞게 정규화(=그대로 사용) 후 캐시.
async function loadClip(file) {
  if (clipCache.has(file)) return clipCache.get(file);
  const buf = await fetch(`assets/anim/${file}`).then(r => r.arrayBuffer());
  const obj = fbxLoader.parse(buf, '');
  const clip = normalizeClip(obj.animations[0]);
  clipCache.set(file, clip);
  return clip;
}

// 게놈+살 파라미터로 크리처를 (재)생성한다 — 창발/AI 파이프라인의 리빌드 지점.
async function rebuild() {
  if (creature) {
    scene.remove(creature.mesh);
    if (creature.helper) scene.remove(creature.helper);
    creature.mesh.geometry.dispose();
  }
  const rig = buildRig(state.genome);
  const mesh = growFlesh(rig, state.flesh);
  mesh.visible = state.showFlesh;
  scene.add(mesh);

  const helper = new THREE.SkeletonHelper(mesh);
  helper.visible = state.showBones;
  scene.add(helper);

  const mixer = new THREE.AnimationMixer(mesh);
  creature = { mesh, rig, mixer, helper, actions: new Map() };

  await playClip(state.clip);
  updateHud();
}

async function playClip(name) {
  state.clip = name;
  const clip = await loadClip(CLIPS[name]);
  const { mixer, actions } = creature;
  let action = actions.get(name);
  if (!action) { action = mixer.clipAction(clip); actions.set(name, action); }
  // 크로스페이드
  for (const [n, a] of actions) if (n !== name) a.fadeOut(0.25);
  action.reset().setEffectiveTimeScale(state.speed).fadeIn(0.25).play();
}

// ── 렌더 루프 ─────────────────────────────────────────────
function tick() {
  requestAnimationFrame(tick);
  const dt = clock.getDelta();
  if (creature && !state.pause) creature.mixer.update(dt);
  controls.update();
  renderer.render(scene, cam);
}
tick();

addEventListener('resize', () => {
  cam.aspect = app.clientWidth / app.clientHeight;
  cam.updateProjectionMatrix();
  renderer.setSize(app.clientWidth, app.clientHeight);
});

// ── UI ────────────────────────────────────────────────────
function el(id) { return document.getElementById(id); }

function buildUI() {
  // 클립 버튼
  const clipRow = el('clips');
  for (const name of Object.keys(CLIPS)) {
    const b = document.createElement('button');
    b.textContent = name;
    b.onclick = () => { playClip(name); markActive(clipRow, b); };
    clipRow.appendChild(b);
    if (name === state.clip) b.classList.add('on');
  }
  // 게놈 슬라이더 (뼈 비율)
  const genomeDefs = [
    ['torso', '몸통', 0.6, 1.6], ['neck', '목', 0.6, 1.6],
    ['arm', '팔', 0.6, 1.6], ['leg', '다리', 0.6, 1.6], ['shoulder', '어깨폭', 0.6, 1.6],
  ];
  const gWrap = el('genome');
  for (const [key, label, min, max] of genomeDefs) {
    gWrap.appendChild(slider(label, min, max, state.genome[key], v => {
      state.genome[key] = v; scheduleRebuild();
    }));
  }
  // 살 파라미터
  el('flesh').appendChild(slider('굵기', 0.5, 2.0, state.flesh.girth, v => {
    state.flesh.girth = v; scheduleRebuild();
  }));
  // 표시 토글
  bindToggle('t-flesh', state.showFlesh, v => { state.showFlesh = v; if (creature) creature.mesh.visible = v; });
  bindToggle('t-bones', state.showBones, v => { state.showBones = v; if (creature) creature.helper.visible = v; });
  bindToggle('t-pause', state.pause, v => { state.pause = v; });
  // 속도
  el('speed').appendChild(slider('속도', 0, 2, state.speed, v => {
    state.speed = v;
    if (creature) for (const a of creature.actions.values()) a.setEffectiveTimeScale(v);
  }));
  // 드롭존: Mixamo 애니메이션 FBX 를 떨궈 그대로 재생
  setupDropzone();
}

function slider(label, min, max, val, onInput) {
  const row = document.createElement('label');
  row.className = 'slider';
  row.innerHTML = `<span>${label}</span><input type="range" min="${min}" max="${max}" step="0.01" value="${val}"><b>${(+val).toFixed(2)}</b>`;
  const input = row.querySelector('input'), out = row.querySelector('b');
  input.oninput = () => { out.textContent = (+input.value).toFixed(2); onInput(+input.value); };
  return row;
}

function bindToggle(id, init, onChange) {
  const b = el(id);
  if (init) b.classList.add('on');
  b.onclick = () => { b.classList.toggle('on'); onChange(b.classList.contains('on')); };
}

function markActive(row, btn) { row.querySelectorAll('button').forEach(x => x.classList.remove('on')); btn.classList.add('on'); }

// 슬라이더 연타 시 리빌드 폭주 방지(디바운스)
let rebuildTimer = null;
function scheduleRebuild() { clearTimeout(rebuildTimer); rebuildTimer = setTimeout(rebuild, 120); }

function setupDropzone() {
  const dz = el('dropzone');
  const stop = e => { e.preventDefault(); e.stopPropagation(); };
  ['dragenter', 'dragover'].forEach(ev => dz.addEventListener(ev, e => { stop(e); dz.classList.add('hot'); }));
  ['dragleave', 'drop'].forEach(ev => dz.addEventListener(ev, e => { stop(e); dz.classList.remove('hot'); }));
  dz.addEventListener('drop', async e => {
    const file = e.dataTransfer.files[0];
    if (!file || !/\.fbx$/i.test(file.name)) return;
    const buf = await file.arrayBuffer();
    const clip = normalizeClip(fbxLoader.parse(buf, '').animations[0]);
    const name = file.name.replace(/\.fbx$/i, '');
    CLIPS[name] = null; clipCache.set('__drop_' + name, clip);
    const action = creature.mixer.clipAction(clip);
    creature.actions.set(name, action);
    for (const [n, a] of creature.actions) if (n !== name) a.fadeOut(0.25);
    action.reset().setEffectiveTimeScale(state.speed).fadeIn(0.25).play();
    state.clip = name;
    updateHud(`드롭 클립 재생: ${name}`);
  });
}

function updateHud(extra) {
  const rig = creature?.rig;
  el('hud').innerHTML =
    `본 <b>${rig?.bones.length ?? 0}</b> · 정점 <b>${creature?.mesh.geometry.getAttribute('position').count ?? 0}</b> · ` +
    `클립 <b>${state.clip}</b>` + (extra ? ` · ${extra}` : '');
}

buildUI();
rebuild();

// 디버그/검증 핸들
window.__hkt = { state, get creature() { return creature; }, rebuild, playClip, THREE };
