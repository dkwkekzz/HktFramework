// main.js — 확인 가능한 무대 (v2: 기본 스켈레톤을 로드해 그 위에 절차 살을 붙인다).
//
// 흐름: Mixamo 베이스(X Bot/Y Bot) FBX 로드 → 구동 뼈 선정(HktCharacter 로더 방식) →
// 아티스트 스킨은 숨기고 그 스켈레톤에 절차 살(flesh.js)을 기른다 → Mixamo 클립을
// 월드 공간 리타깃(bakeClip)해 재생. 살은 skinning 으로 뼈를 따라 변형한다.
//
// HktCharacter 참고: parseFBX / 구동 뼈 선정(트윈 교차 리그) / bakeClip(순수 월드 리타깃) /
// measureClipRootY(사전 접지) 를 그대로 포팅하되, 스킨 메시 렌더 대신 절차 살을 얹는다.
//
// 좌표계 = cm(Mixamo 원본, 스케일 그룹 없음) — 화면 크기는 카메라가 맞춘다.

import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { growFlesh, DEFAULT_FLESH } from './flesh.js';
import { simpleName, boneBox, pickDrivers, makeBindCaches, buildSource, bakeClip, measureClipRootY } from './creature.js';

// ── 무대 ──────────────────────────────────────────────────
const app = document.getElementById('app');
const CAPTURE = new URLSearchParams(location.search).has('capture');
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: CAPTURE });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(app.clientWidth, app.clientHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
app.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1a1d24);

const cam = new THREE.PerspectiveCamera(45, app.clientWidth / app.clientHeight, 1, 4000);
cam.position.set(180, 150, 320);
const controls = new OrbitControls(cam, renderer.domElement);
controls.target.set(0, 100, 0);
controls.enableDamping = true;

scene.add(new THREE.HemisphereLight(0xbfd4ff, 0x2a2620, 1.1));
const sun = new THREE.DirectionalLight(0xffffff, 1.6);
sun.position.set(120, 260, 160);
scene.add(sun);
scene.add(new THREE.GridHelper(600, 24, 0x3a4050, 0x2a2f3a));

// (simpleName·boneBox·pickDrivers·bakeClip 등은 creature.js 공유 코어에서 가져온다.)

// ── 상태 ──────────────────────────────────────────────────
const MODELS = [
  { label: '남자 (X Bot)', file: 'assets/character/X Bot.fbx' },
  { label: '여자 (Y Bot)', file: 'assets/character/Y Bot.fbx' },
];
const CLIPS = { 대기: 'idle', 걷기: 'walk', 뛰기: 'run' };
const state = {
  file: MODELS[0].file, label: MODELS[0].label,
  flesh: { ...DEFAULT_FLESH },
  clip: '대기', speed: 1,
  showFlesh: true, showSkin: false, showBones: false, pause: false,
};
let ch = null;          // 현재 크리처
const clock = new THREE.Clock();
const fbxLoader = new FBXLoader();

// ── FBX 파싱 ──────────────────────────────────────────────
function parseFBX(buf) {
  const obj = fbxLoader.parse(buf, '');
  const meshes = [], bones = [];
  obj.traverse(o => { if (o.isSkinnedMesh || o.isMesh) meshes.push(o); if (o.isBone) bones.push(o); });
  return { obj, meshes, bones };
}

// ── 크리처 생성 (로드 → 구동뼈 → 살) ──────────────────────
function disposeCh() {
  if (!ch) return;
  scene.remove(ch.obj); scene.remove(ch.flesh); scene.remove(ch.helper);
  ch.obj.traverse(o => { o.geometry?.dispose(); for (const m of [].concat(o.material || [])) m.dispose?.(); });
  ch.flesh?.geometry.dispose();
  ch = null;
}

function makeCh(parsed) {
  const { obj, meshes, bones } = parsed;
  // 구동 뼈 선정(트윈 교차 리그 처리) — creature.js 공유.
  const { drivers, boneMap } = pickDrivers(bones);
  // 아티스트 스킨은 숨긴다(살을 우리가 기르므로) — 토글로 비교 가능.
  for (const m of meshes) { m.frustumCulled = false; m.visible = state.showSkin; m.userData.orig = m.material; }

  obj.position.set(0, 0, 0); obj.updateMatrixWorld(true);
  ch = {
    obj, meshes, bones: drivers, boneMap, allBones: bones,
    mixer: new THREE.AnimationMixer(obj), clips: {}, actions: {}, active: '',
    flesh: null, helper: new THREE.SkeletonHelper(obj),
    ...makeBindCaches(drivers, bones),   // bindLocalQ/P, bindWorldQ, staticParentQ
  };
  ch.helper.material.depthTest = false;
  ch.helper.visible = state.showBones;

  groundRest();                 // 발바닥 y=0 (rest)
  ch.flesh = buildFleshAtBind();
  ch.flesh.visible = state.showFlesh;

  scene.add(obj); scene.add(ch.flesh); scene.add(ch.helper);
  return ch;
}

// rest(바인드) 포즈로 발바닥을 y=0 에 맞춘다.
function groundRest() {
  ch.obj.position.set(0, 0, 0); ch.obj.updateMatrixWorld(true);
  const box = boneBox(ch.bones), c = new THREE.Vector3(); box.getCenter(c);
  ch.obj.position.x = -c.x; ch.obj.position.z = -c.z; ch.obj.position.y = -box.min.y;
  ch.obj.updateMatrixWorld(true);
}

// 살은 반드시 **바인드 포즈**에서 굽는다 — 현재 애니메이션 포즈가 아니라.
// (재생 중 굵기 슬라이더를 만져도 뼈를 잠시 바인드로 되돌려 굽고 원상복구.)
function buildFleshAtBind() {
  const saved = ch.allBones.map(b => [b, b.quaternion.clone(), b.position.clone()]);
  for (const b of ch.allBones) {
    if (ch.bindLocalQ.has(b)) { b.quaternion.copy(ch.bindLocalQ.get(b)); b.position.copy(ch.bindLocalP.get(b)); }
  }
  ch.obj.updateMatrixWorld(true);
  const mesh = growFlesh(ch.bones, simpleName, state.flesh);
  for (const [b, q, p] of saved) { b.quaternion.copy(q); b.position.copy(p); }
  ch.obj.updateMatrixWorld(true);
  return mesh;
}

function regrowFlesh() {
  if (!ch) return;
  const wasVisible = ch.flesh.visible;
  scene.remove(ch.flesh); ch.flesh.geometry.dispose();
  ch.flesh = buildFleshAtBind();
  ch.flesh.visible = wasVisible;
  scene.add(ch.flesh);
  updateHud();
}

// ── 리타깃 (creature.js 공유 코어 사용) ───────────────────
const sourceCache = {};
async function loadSource(file) {
  if (sourceCache[file]) return sourceCache[file];
  const buf = await (await fetch(`assets/anim/${file}.fbx`)).arrayBuffer();
  const { obj } = parseFBX(buf);
  const clip = (obj.animations || []).find(a => a.duration > 0.01);
  if (!clip) return null;
  const src = buildSource(obj, clip);
  if (src) sourceCache[file] = src;
  return src;
}

function playBaked(name, fade = 0.25) {
  const clip = ch.clips[name]; if (!clip || ch.active === name) return;
  if (clip.__rootY === undefined) clip.__rootY = measureClipRootY(ch, clip);
  if (!ch.actions[name]) ch.actions[name] = ch.mixer.clipAction(clip);
  const next = ch.actions[name], prev = ch.active && ch.actions[ch.active];
  next.enabled = true; next.setEffectiveTimeScale(state.speed).setEffectiveWeight(1).play();
  if (prev && fade > 0) { next.reset(); prev.crossFadeTo(next, fade, false); } else if (prev) prev.stop();
  ch.active = name; state.clip = name;
  ch.obj.position.y = clip.__rootY;
  ch.mixer.update(0);
  updateHud();
}

async function playAnim(name, fade = 0.25) {
  if (!ch) return;
  if (!ch.clips[name]) {
    const src = await loadSource(CLIPS[name]);
    const baked = src && bakeClip(ch, src, name);
    if (!baked) { setStatus(`${name}: 리타깃 실패`); return; }
    ch.clips[name] = baked;
  }
  playBaked(name, fade);
  refreshAnimButtons();
}

// ── 로드/전환 ─────────────────────────────────────────────
let busy = false;
async function switchModel(file, label) {
  if (busy) return; busy = true;
  setStatus(`${label} 로드 중…`);
  try {
    const buf = await (await fetch(encodeURI(file))).arrayBuffer();
    const parsed = parseFBX(buf);
    if (!parsed.bones.length) throw new Error('뼈 없는 FBX');
    disposeCh();
    state.file = file; state.label = label;
    makeCh(parsed);
    await playAnim(state.clip, 0);
    setStatus(`${label} 준비됨.`);
  } catch (e) { setStatus('로드 실패: ' + e.message); }
  busy = false;
  refreshModelButtons(); updateHud();
}

// ── 렌더 루프 ─────────────────────────────────────────────
function tick() {
  requestAnimationFrame(tick);
  const dt = Math.min(clock.getDelta(), 0.1);
  if (ch && !state.pause) ch.mixer.update(dt * state.speed);
  controls.update();
  renderer.render(scene, cam);
}
tick();
addEventListener('resize', () => {
  cam.aspect = app.clientWidth / app.clientHeight; cam.updateProjectionMatrix();
  renderer.setSize(app.clientWidth, app.clientHeight);
});

// ── UI ────────────────────────────────────────────────────
const $ = id => document.getElementById(id);
const setStatus = html => { const s = $('status'); if (s) s.innerHTML = html; };

function refreshModelButtons() {
  const box = $('models'); box.innerHTML = '';
  for (const m of MODELS) {
    const b = document.createElement('button');
    b.textContent = m.label; b.classList.toggle('on', state.file === m.file);
    b.onclick = () => switchModel(m.file, m.label);
    box.appendChild(b);
  }
}
function refreshAnimButtons() {
  const box = $('clips'); box.innerHTML = '';
  for (const name of Object.keys(CLIPS)) {
    const b = document.createElement('button');
    b.textContent = name; b.classList.toggle('on', ch?.active === name);
    b.onclick = () => playAnim(name);
    box.appendChild(b);
  }
}
function slider(label, min, max, val, onInput) {
  const row = document.createElement('label'); row.className = 'slider';
  row.innerHTML = `<span>${label}</span><input type="range" min="${min}" max="${max}" step="0.01" value="${val}"><b>${(+val).toFixed(2)}</b>`;
  const input = row.querySelector('input'), out = row.querySelector('b');
  input.oninput = () => { out.textContent = (+input.value).toFixed(2); onInput(+input.value); };
  return row;
}
function bindToggle(id, init, onChange) {
  const b = $(id); if (init) b.classList.add('on');
  b.onclick = () => { b.classList.toggle('on'); onChange(b.classList.contains('on')); };
}
let girthTimer = null;
function buildUI() {
  refreshModelButtons(); refreshAnimButtons();
  $('flesh').appendChild(slider('굵기', 0.5, 2.0, state.flesh.girth, v => {
    state.flesh.girth = v; clearTimeout(girthTimer); girthTimer = setTimeout(regrowFlesh, 140);
  }));
  $('speed').appendChild(slider('속도', 0, 2, state.speed, v => { state.speed = v; }));
  bindToggle('t-flesh', state.showFlesh, v => { state.showFlesh = v; if (ch) ch.flesh.visible = v; });
  bindToggle('t-skin', state.showSkin, v => { state.showSkin = v; if (ch) for (const m of ch.meshes) m.visible = v; });
  bindToggle('t-bones', state.showBones, v => { state.showBones = v; if (ch) ch.helper.visible = v; });
  bindToggle('t-pause', state.pause, v => { state.pause = v; });
}
function updateHud() {
  $('hud').innerHTML = ch
    ? `모델 <b>${state.label}</b> · 구동뼈 <b>${ch.bones.length}</b> · 살정점 <b>${ch.flesh?.geometry.getAttribute('position').count ?? 0}</b> · 클립 <b>${ch.active || '—'}</b>`
    : '로드 중…';
}

buildUI();
switchModel(state.file, state.label);

window.__hkt = { state, get ch() { return ch; }, switchModel, playAnim, regrowFlesh, simpleName, THREE };
