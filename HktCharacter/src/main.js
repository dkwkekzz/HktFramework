// ============================================================================
//  HktCharacter — 캐릭터 선택 + 애니메이션 + 본 비율 뷰어 (v3)
//
//  v2("삼바를 눌러야 메시가 나온다") 대비 바뀐 것:
//    1. 기본 화면에 남/여 두 캐릭터를 나란히 배치하고 즉시 렌더한다.
//       - 남자 = Mixamo "Alpha"(X-Bot, samba.fbx 의 스킨 메시)
//       - 여자 = Mixamo "Eve"(female.fbx, with-skin) — Mixamo 에서 받아 연결
//    2. 캐릭터를 클릭(또는 버튼)해 "선택"하면, 이후 고른 애니메이션을 그
//       선택된 캐릭터만 수행한다. 두 리그의 뼈 이름은 simpleName 으로 정규화돼
//       같은 클립이 양쪽에 리타깃된다.
//    3. 본 비율 슬라이더 — 키/머리/몸통/어깨/팔/다리/손을 뼈 스케일로 조절.
//       클립은 회전(+Hips 위치)만 옮기므로 scale 채널은 우리가 소유한다.
//
//  핵심 유지: 메시는 FBX 원본 그대로, 본 표시는 THREE.SkeletonHelper.
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
scene.fog = new THREE.Fog(0x14161a, 9, 34);

const cam = new THREE.PerspectiveCamera(45, 1, 0.05, 100);
cam.position.set(0.4, 1.5, 4.4);
const controls = new OrbitControls(cam, renderer.domElement);
controls.target.set(0, 0.9, 0);
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

// 선택 표시 링 — 선택된 캐릭터 발밑에 놓인다
const ring = new THREE.Mesh(
  new THREE.RingGeometry(0.34, 0.42, 48).rotateX(-Math.PI / 2),
  new THREE.MeshBasicMaterial({ color: 0x3b82f6, transparent: true, opacity: 0.85, depthWrite: false }),
);
ring.position.y = 0.01;
ring.visible = false;
scene.add(ring);

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
//  이름 정규화 — 리그가 달라도 단순명으로 매칭
//  "mixamorig:LeftHand" / "mixamorigLeftHand"(콜론 없는 내보내기) /
//  "LeftHand"(접두어 없는 리그, 예: Eve) → 모두 "lefthand".
// ---------------------------------------------------------------------------
const simpleName = n =>
  n.split(':').pop().replace(/^mixamorig\d*/i, '').toLowerCase();

// ---------------------------------------------------------------------------
//  본 비율 그룹 — simpleName 정규식에 걸리는 뼈들의 scale 을 곱한다.
//  height 만 예외로 root(전체) 스케일에 적용. 값 1 = 원본.
// ---------------------------------------------------------------------------
const PROP_GROUPS = [
  { id: 'height',   label: '키(전체)', re: null,          min: 0.8, max: 1.2 },
  { id: 'head',     label: '머리',     re: /^head$/,      min: 0.6, max: 1.6 },
  { id: 'torso',    label: '몸통',     re: /^spine1$/,    min: 0.8, max: 1.3 },
  { id: 'shoulder', label: '어깨너비', re: /shoulder$/,   min: 0.6, max: 1.5 },
  { id: 'arm',      label: '팔',       re: /arm$/,        min: 0.8, max: 1.3 }, // arm+forearm
  { id: 'leg',      label: '다리',     re: /leg$/,        min: 0.8, max: 1.3 }, // upleg+leg
  { id: 'hand',     label: '손',       re: /hand$/,       min: 0.6, max: 1.6 },
];
const defaultProps = () => Object.fromEntries(PROP_GROUPS.map(g => [g.id, 1]));

// ---------------------------------------------------------------------------
//  슬롯 정의 — 화면에 항상 두 캐릭터. 각 슬롯은 ch(캐릭터 상태)를 가진다.
// ---------------------------------------------------------------------------
const SLOTS = {
  male:   { label: '남자', file: 'assets/anim/samba.fbx',       x: -0.62, ch: null },
  female: { label: '여자', file: 'assets/character/female.fbx', x:  0.62, ch: null },
};
let selected = 'male';
const ui = { speed: 1, bone: false, mesh: true, gray: false, wire: false, sdf: false };

const selCh = () => SLOTS[selected]?.ch || null;
const eachCh = fn => { for (const id in SLOTS) if (SLOTS[id].ch) fn(SLOTS[id].ch, id); };

// ---------------------------------------------------------------------------
//  FBX 파싱 → { obj, meshes[], bones[] }
// ---------------------------------------------------------------------------
function parseFBX(buf) {
  const obj = new FBXLoader().parse(buf, '');
  const meshes = [], bones = [];
  obj.traverse(o => {
    if (o.isSkinnedMesh || o.isMesh) meshes.push(o);
    if (o.isBone) bones.push(o);
  });
  if (!bones.length && meshes.length) {
    for (const m of meshes) if (m.isSkinnedMesh) bones.push(...m.skeleton.bones);
  }
  return { obj, meshes, bones };
}

// 뼈 월드 위치로 만든 bbox — scale/애니메이션을 반영한다(스킨 메시의 CPU
// boundingBox 는 rest 포즈 고정이라 본 스케일 변경을 못 따라오므로 뼈 기준).
function boneBox(ch) {
  const box = new THREE.Box3(); const p = new THREE.Vector3();
  for (const b of ch.bones) box.expandByPoint(b.getWorldPosition(p));
  return box;
}

// ---------------------------------------------------------------------------
//  캐릭터 생성 / 교체 / 제거
// ---------------------------------------------------------------------------
function disposeCh(slotId) {
  const ch = SLOTS[slotId].ch;
  if (!ch) return;
  scene.remove(ch.root);
  if (ch.helper) scene.remove(ch.helper);
  ch.root.traverse(o => {
    if (o.geometry) o.geometry.dispose();
    for (const m of [].concat(o.material || [])) m.dispose?.();
  });
  SLOTS[slotId].ch = null;
}

function makeCh(slotId, parsed) {
  const { obj, meshes, bones } = parsed;
  const slot = SLOTS[slotId];
  for (const m of meshes) {
    m.frustumCulled = false; // 애니메이션이 원래 바운드를 벗어나도 사라지지 않게
    m.castShadow = m.receiveShadow = false;
    m.userData.origMaterial = m.material;
  }
  const boneMap = new Map();
  for (const b of bones) if (!boneMap.has(simpleName(b.name))) boneMap.set(simpleName(b.name), b);

  const ch = {
    root: obj, meshes, bones, boneMap, hasMesh: meshes.length > 0, slotX: slot.x,
    mixer: new THREE.AnimationMixer(obj), clips: {}, actions: {}, active: '',
    helper: bones.length ? new THREE.SkeletonHelper(obj) : null,
    baseScale: 1, props: defaultProps(),
  };
  computeBaseScale(ch);
  applyProps(ch); // root scale + 발 접지
  if (ch.helper) {
    ch.helper.material.depthTest = false; // 메시 너머로도 본이 보이게
    ch.helper.visible = ui.bone;
    scene.add(ch.helper);
  }
  scene.add(obj);
  slot.ch = ch;
  applyMaterialMode(ch);
  return ch;
}

// 모든 스케일 1 상태에서 "키 1.7m" 기준 배율을 잡는다 (한 번만).
function computeBaseScale(ch) {
  ch.root.scale.setScalar(1);
  for (const b of ch.bones) b.scale.setScalar(1);
  ch.root.position.set(0, 0, 0);
  ch.root.updateMatrixWorld(true);
  const size = new THREE.Vector3(); boneBox(ch).getSize(size);
  ch.baseScale = 1.7 / Math.max(size.y, 1e-3);
}

// 본 비율 적용: 그룹 뼈 scale → root(키) scale → 발 접지 + 좌우 배치.
function applyProps(ch) {
  for (const b of ch.bones) b.scale.setScalar(1);
  for (const g of PROP_GROUPS) {
    if (!g.re) continue;
    const m = ch.props[g.id] ?? 1;
    if (m === 1) continue;
    for (const b of ch.bones) if (g.re.test(simpleName(b.name))) b.scale.setScalar(m);
  }
  ch.root.scale.setScalar(ch.baseScale * (ch.props.height ?? 1));
  replant(ch);
}

// 발바닥 y=0, 슬롯 x 로 중심 이동 (뼈 bbox 기준 — 스케일 반영).
function replant(ch) {
  ch.root.position.set(0, 0, 0);
  ch.root.updateMatrixWorld(true);
  const box = boneBox(ch);
  const c = new THREE.Vector3(); box.getCenter(c);
  ch.root.position.x = ch.slotX - c.x;
  ch.root.position.z = -c.z;
  ch.root.position.y = -box.min.y;
  ch.root.updateMatrixWorld(true);
}

// ---------------------------------------------------------------------------
//  애니메이션 — 원본 클립을 파일당 1회 파싱해 캐시, 슬롯별로 리타깃/재생
// ---------------------------------------------------------------------------
const ANIMS = [
  ['걷기', 'walk'], ['뛰기', 'run'], ['대기', 'idle'],
  ['점프', 'jump'], ['공격', 'attack'], ['삼바', 'samba'],
];
const rawClipCache = {}; // file → THREE.AnimationClip (리타깃 전 원본)

async function loadRawClip(file) {
  if (rawClipCache[file]) return rawClipCache[file];
  const buf = await (await fetch(`assets/anim/${file}.fbx`)).arrayBuffer();
  const { obj } = parseFBX(buf);
  const clip = (obj.animations || []).find(a => a.duration > 0.01);
  if (clip) rawClipCache[file] = clip;
  return clip || null;
}

// 트랙 노드명을 대상 캐릭터의 실제 뼈 이름으로 재작성 (이름 매칭 리타깃).
// position 은 Hips 만 유지 — 리그 간 뼈 길이가 달라도 회전만 옮겨 안 늘어난다.
// scale 트랙은 버린다 — 본 비율은 우리가 별도로 소유하는 채널.
function retargetClip(clip, ch) {
  const byName = ch.boneMap;
  const tracks = [];
  for (const t of clip.tracks) {
    const dot = t.name.lastIndexOf('.');
    const node = t.name.slice(0, dot), prop = t.name.slice(dot + 1);
    const key = simpleName(node);
    const bone = byName.get(key);
    if (!bone) continue;
    if (prop === 'position' && key !== 'hips') continue;
    if (prop === 'scale') continue;
    const nt = t.clone();
    nt.name = `${bone.name}.${prop}`;
    tracks.push(nt);
  }
  if (!tracks.length) return null;
  return new THREE.AnimationClip(clip.name, clip.duration, tracks);
}

function playClip(ch, name, fade = 0.25) {
  if (!ch || !ch.clips[name] || ch.active === name) return;
  if (!ch.actions[name]) ch.actions[name] = ch.mixer.clipAction(ch.clips[name]);
  const next = ch.actions[name];
  const prev = ch.active && ch.actions[ch.active];
  next.enabled = true;
  next.setEffectiveWeight(1).play();
  if (prev && fade > 0) { next.reset(); prev.crossFadeTo(next, fade, false); }
  else if (prev) prev.stop();
  ch.active = name;
}

// 선택된(또는 지정) 슬롯에 애니메이션을 얹어 재생.
async function playAnim(label, file, slotId = selected, fade = 0.25) {
  const ch = SLOTS[slotId]?.ch;
  if (!ch) return;
  if (!ch.clips[label]) {
    const raw = await loadRawClip(file);
    if (!raw) { setStatus(`${label}: 클립 로드 실패`); return; }
    const rc = retargetClip(raw, ch);
    if (!rc) { setStatus(`${label}: 리타깃할 뼈를 못 찾음`); return; }
    rc.name = label;
    ch.clips[label] = rc;
  }
  playClip(ch, label, fade);
  refreshAnimButtons();
}

// ---------------------------------------------------------------------------
//  기본 캐릭터 두 명 로드 → 둘 다 "대기"로 세워둔다
// ---------------------------------------------------------------------------
async function loadSlotBase(slotId) {
  const slot = SLOTS[slotId];
  const buf = await (await fetch(slot.file)).arrayBuffer();
  const parsed = parseFBX(buf);
  if (!parsed.meshes.length) throw new Error(`${slot.label}: 메시 없는 FBX`);
  disposeCh(slotId);
  makeCh(slotId, parsed);
}

async function bootstrap() {
  setStatus('캐릭터 로드 중… (남자·여자)');
  try {
    await loadSlotBase('male');
    await loadSlotBase('female');
  } catch (e) {
    setStatus('캐릭터 로드 실패: ' + e.message);
    return;
  }
  // 둘 다 대기 자세로
  await playAnim('대기', 'idle', 'male', 0);
  await playAnim('대기', 'idle', 'female', 0);
  select('male');
  refreshCharButtons();
  setStatus('준비됨 — 캐릭터를 클릭해 선택하고, 애니메이션을 눌러보세요. 본 비율도 조절할 수 있습니다.');
}

// ---------------------------------------------------------------------------
//  선택 (버튼 + 3D 클릭)
// ---------------------------------------------------------------------------
function select(id) {
  if (!SLOTS[id]) return;
  selected = id;
  updateRing();
  refreshCharButtons();
  refreshAnimButtons();
  refreshPropSliders();
  mcFlesh.setVisible(ui.sdf && !!selCh());
  document.getElementById('animWho').textContent = SLOTS[id].label;
  document.getElementById('propWho').textContent = SLOTS[id].label;
}

function updateRing() {
  const ch = selCh();
  if (!ch) { ring.visible = false; return; }
  ring.visible = true;
  ring.position.x = ch.slotX;
}

const raycaster = new THREE.Raycaster();
const ndc = new THREE.Vector2();
let downXY = null;
renderer.domElement.addEventListener('pointerdown', e => { downXY = [e.clientX, e.clientY]; });
renderer.domElement.addEventListener('pointerup', e => {
  if (!downXY) return;
  const moved = Math.hypot(e.clientX - downXY[0], e.clientY - downXY[1]);
  downXY = null;
  if (moved > 5) return; // 드래그(궤도 회전)는 선택으로 치지 않음
  const r = renderer.domElement.getBoundingClientRect();
  ndc.x = ((e.clientX - r.left) / r.width) * 2 - 1;
  ndc.y = -((e.clientY - r.top) / r.height) * 2 + 1;
  raycaster.setFromCamera(ndc, cam);
  let best = null, bestDist = Infinity;
  for (const id in SLOTS) {
    const ch = SLOTS[id].ch;
    if (!ch) continue;
    const hits = raycaster.intersectObjects(ch.meshes, true);
    if (hits.length && hits[0].distance < bestDist) { bestDist = hits[0].distance; best = id; }
  }
  if (best) select(best);
});

// ---------------------------------------------------------------------------
//  UI — 캐릭터 버튼 / 애니메이션 버튼 / 본 비율 슬라이더
// ---------------------------------------------------------------------------
const $ = id => document.getElementById(id);

function refreshCharButtons() {
  const box = $('chars'); box.innerHTML = '';
  for (const id in SLOTS) {
    const slot = SLOTS[id];
    const b = document.createElement('button');
    b.className = 'char' + (id === selected ? ' on' : '');
    const anim = slot.ch?.active || '—';
    b.innerHTML = `${slot.label}<span class="cap">${slot.ch ? anim : '로드 안 됨'}</span>`;
    b.addEventListener('click', () => select(id));
    box.appendChild(b);
  }
}

function refreshAnimButtons() {
  const box = $('anims'); box.innerHTML = '';
  const ch = selCh();
  for (const [label, file] of ANIMS) {
    const b = document.createElement('button');
    b.textContent = label;
    b.classList.toggle('on', !!ch && ch.active === label);
    b.addEventListener('click', () => playAnim(label, file));
    box.appendChild(b);
  }
  refreshCharButtons(); // 캐릭터 버튼의 현재 애니메이션 캡션 갱신
}

function refreshPropSliders() {
  const box = $('props'); box.innerHTML = '';
  const ch = selCh();
  for (const g of PROP_GROUPS) {
    const row = document.createElement('div'); row.className = 'row';
    const lab = document.createElement('label'); lab.textContent = g.label;
    const inp = document.createElement('input');
    inp.type = 'range'; inp.min = g.min; inp.max = g.max; inp.step = 0.01;
    inp.value = ch ? (ch.props[g.id] ?? 1) : 1;
    inp.disabled = !ch;
    const val = document.createElement('span'); val.className = 'val';
    val.textContent = (+inp.value).toFixed(2);
    inp.addEventListener('input', () => {
      val.textContent = (+inp.value).toFixed(2);
      const c = selCh(); if (!c) return;
      c.props[g.id] = +inp.value;
      applyProps(c);
      updateRing();
    });
    row.append(lab, inp, val);
    box.appendChild(row);
  }
}

$('btnPropReset').addEventListener('click', () => {
  const ch = selCh(); if (!ch) return;
  ch.props = defaultProps();
  applyProps(ch);
  updateRing();
  refreshPropSliders();
});

// 애니메이션 버튼 채우기 (초기)
refreshAnimButtons();
refreshPropSliders();

// ---------------------------------------------------------------------------
//  드롭존 — with-skin 이면 선택 슬롯 교체, 애니메이션이면 선택 슬롯에 리타깃
// ---------------------------------------------------------------------------
const drop = $('drop');
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
  r.onload = () => loadDroppedFBX(r.result, f.name.replace(/\.fbx$/i, ''));
  r.readAsArrayBuffer(f);
}

function loadDroppedFBX(buf, label) {
  let parsed;
  try { parsed = parseFBX(buf); }
  catch (e) { setStatus('FBX 파싱 실패: ' + e.message); return; }
  const { meshes, bones, obj } = parsed;

  if (meshes.length) {
    // with-skin → 선택된 슬롯의 캐릭터를 교체 (여자 슬롯 선택 후 Mixamo 여성
    // FBX 를 드롭하면 그대로 "연결"된다)
    disposeCh(selected);
    makeCh(selected, parsed);
    playAnim('대기', 'idle', selected, 0).finally(() => {
      // 대기 클립이 없으면 FBX 내장 클립이라도
      const ch = selCh();
      if (ch && !ch.active && obj.animations?.length) {
        const rc = retargetClip(obj.animations[0], ch);
        if (rc) { rc.name = label; ch.clips[label] = rc; playClip(ch, label, 0); refreshAnimButtons(); }
      }
      refreshCharButtons(); refreshPropSliders();
    });
    setStatus(`<b>${SLOTS[selected].label}</b> 슬롯 교체 — ${label} (메시 ${meshes.length} · 뼈 ${bones.length}).`);
  } else if (bones.length && obj.animations?.length) {
    // 애니메이션-only → 선택된 캐릭터에 리타깃
    const ch = selCh();
    if (!ch) { setStatus('먼저 캐릭터를 선택하세요.'); return; }
    const rc = retargetClip(obj.animations[0], ch);
    if (!rc) { setStatus(`${label}: 맞는 뼈가 없어 리타깃 실패.`); return; }
    let key = label, i = 2; while (ch.clips[key]) key = `${label} ${i++}`;
    rc.name = key; ch.clips[key] = rc;
    playClip(ch, key, 0.25);
    refreshAnimButtons();
    setStatus(`<b>${label}</b> — ${SLOTS[selected].label} 에 리타깃 재생.`);
  } else {
    setStatus(`<b>${label}</b> — 스켈레톤/메시를 찾지 못했습니다.`);
  }
}

// ---------------------------------------------------------------------------
//  표시 토글 / 속도
// ---------------------------------------------------------------------------
const grayMat = new THREE.MeshStandardMaterial({ color: 0x9aa4b0, roughness: 0.75 });

function applyMaterialMode(ch) {
  if (!ch) { eachCh(applyMaterialMode); return; }
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
  eachCh(ch => { if (ch.helper) ch.helper.visible = ui.bone; });
});
$('btnGray').addEventListener('click', e => {
  ui.gray = !ui.gray; e.target.classList.toggle('on', ui.gray); applyMaterialMode();
});
$('btnWire').addEventListener('click', e => {
  ui.wire = !ui.wire; e.target.classList.toggle('on', ui.wire);
  grayMat.wireframe = ui.wire; applyMaterialMode();
});
// SDF 살 — 선택된 캐릭터의 스켈레톤을 MarchingCubes 로 실시간 폴리곤화
const mcFlesh = new McFlesh(scene);
$('btnSdf').addEventListener('click', e => {
  ui.sdf = !ui.sdf; e.target.classList.toggle('on', ui.sdf);
  mcFlesh.setVisible(ui.sdf && !!selCh());
  if (ui.sdf && !selCh()) setStatus('SDF 살: 먼저 캐릭터를 선택하세요.');
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
  eachCh(ch => ch.mixer.update(dt * ui.speed));
  const sel = selCh();
  if (ui.sdf && sel) {
    sel.root.updateMatrixWorld(true);
    mcFlesh.setVisible(true);
    // SDF 는 볼륨 중심(원점) 기준이라, 선택 캐릭터를 잠시 원점으로 본 것처럼
    // 뼈 월드에서 슬롯 x 오프셋을 빼 준다.
    mcFlesh.update(sel.bones, simpleName, sel.slotX);
  } else mcFlesh.setVisible(false);
  controls.update();
  renderer.render(scene, cam);
  requestAnimationFrame(loop);
}
setStatus('초기화 중…');
loop();
bootstrap();

// 콘솔/자동 검증용 핸들
window.__hkt = {
  scene, cam, renderer, ui, SLOTS,
  get selected() { return selected; },
  get sel() { return selCh(); },
  select, playAnim, loadDroppedFBX,
};
