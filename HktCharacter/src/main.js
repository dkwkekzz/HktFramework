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
import { retargetClip } from 'three/examples/jsm/utils/SkeletonUtils.js';
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
  male:   { label: '남자', file: 'assets/character/X Bot.fbx', x: -0.62, ch: null },
  female: { label: '여자', file: 'assets/character/Y Bot.fbx', x:  0.62, ch: null },
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
  // 본체(prime) = 정점 최다 스킨 메시. X/Y Bot 은 보조 메시(Joints 액센트)가 별도
  // 스켈레톤·이름 중복이라, 보조 메시는 숨기고 그 뼈 이름을 바꿔 루트 믹서가 본체 뼈에만
  // 바인딩되게 한다(재바인드는 스키닝을 붕괴시키므로 안 함).
  const skinnedAll = meshes.filter(m => m.isSkinnedMesh);
  skinnedAll.sort((a, b) =>
    (b.geometry.attributes.position?.count || 0) - (a.geometry.attributes.position?.count || 0));
  const primeMesh = skinnedAll[0] || null;
  const primeBoneSet = new Set(primeMesh ? primeMesh.skeleton.bones : []);
  for (let i = 1; i < skinnedAll.length; i++) {
    for (const b of skinnedAll[i].skeleton.bones) if (!primeBoneSet.has(b)) b.name += '__dup';
    skinnedAll[i].removeFromParent(); // 보조 메시는 그래프에서 제거(숨김만으론 잔여가 뜸)
  }
  // 크기·접지·본 비율·애니메이션은 씬 그래프에 실제 배치된 뼈(루트 아래, 스케일 반영)로.
  // 믹서는 루트(obj)에 두고 트랙은 뼈 이름으로 이 그래프 뼈를 구동한다.
  const animBones = bones.filter(b => !b.name.endsWith('__dup'));
  const boneMap = new Map();
  for (const b of animBones) if (!boneMap.has(simpleName(b.name))) boneMap.set(simpleName(b.name), b);

  const shownMeshes = meshes.filter(m => !m.isSkinnedMesh || m === primeMesh);
  const ch = {
    root: obj, meshes: shownMeshes, bones: animBones, boneMap, hasMesh: !!primeMesh, slotX: slot.x,
    mixer: new THREE.AnimationMixer(obj), actions: {}, clips: {}, active: '',
    helper: animBones.length ? new THREE.SkeletonHelper(obj) : null,
    baseScale: 1, props: defaultProps(), primeMesh,
  };
  computeBaseScale(ch);
  applyProps(ch); // root scale + 발 접지
  // 렌더에 쓰이는 **본체 스켈레톤의 모든 뼈**(그래프에 없는 orphan 포함)의 바인드 로컬
  // 포즈를 저장해 둔다 — retargetClip bake 는 뼈를 오염시키고, 클립에 트랙이 없는 뼈(손가락
  // 등)나 그래프에 없는 뼈는 믹서가 안 건드려 bake 잔여가 남는다 → 그 뼈에 스키닝된 정점이
  // 고정 위치로 떨어져 조각으로 뜬다. bake 후 바인드로 복원해 제자리에 붙인다.
  ch.bindPose = new Map();
  const bindSrc = primeMesh ? primeMesh.skeleton.bones : animBones;
  for (const b of bindSrc) ch.bindPose.set(b, { p: b.position.clone(), q: b.quaternion.clone() });
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
// 애니메이션 리타깃은 THREE.SkeletonUtils.retargetClip(월드 공간 리타깃)에 맡긴다.
// 이유: Mixamo X/Y Bot 의 raw mixamorig 리그는 뼈 rest 축이 비-단위(non-identity)라,
// 단위 rest 로 익스포트된 클립(bare 이름 Hips/LeftArm)을 로컬 quaternion 으로 그대로
// 얹으면 팔이 T-포즈로 남는다(관찰). retargetClip 은 source 를 클립으로 포즈시킨 뒤
// 각 프레임의 월드 포즈를 target bind 기준 로컬로 다시 구워 rest 차이를 흡수한다.
//
// source(애니메이션 FBX)는 스킨 메시가 없으므로, 뼈로 임시 SkinnedMesh 를 만들어 준다.
function buildSource(obj, clip) {
  const sBones = []; obj.traverse(o => { if (o.isBone) sBones.push(o); });
  if (!sBones.length) return null;
  const sRoot = sBones.find(b => !b.parent?.isBone) || sBones[0];
  const srcMesh = new THREE.SkinnedMesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial());
  srcMesh.add(sRoot);
  srcMesh.bind(new THREE.Skeleton(sBones));
  srcMesh.updateMatrixWorld(true);
  const byS = new Map();
  for (const b of sBones) if (!byS.has(simpleName(b.name))) byS.set(simpleName(b.name), b.name);
  return { srcMesh, clip, byS, hipName: byS.get('hips') || sBones[0].name };
}

const sourceCache = {}; // file → { srcMesh, clip, byS, hipName }
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

// source 클립을 대상 캐릭터(prime 스켈레톤)에 월드 공간 리타깃해 새 클립을 굽는다.
// names: 대상 뼈 이름 → source 뼈 이름 (simpleName 매칭). scale 은 트랙에 없다.
function bakeClip(ch, src, label) {
  const target = ch.primeMesh;
  if (!target || !src) return null;
  const names = {};
  for (const tb of target.skeleton.bones) {
    const sn = src.byS.get(simpleName(tb.name));
    if (sn) names[tb.name] = sn;
  }
  // preservePosition:false — 이걸 켜면(기본값) 일부 Mixamo 리그(관찰: Y Bot)에서
  // 리타깃이 뼈를 바인드(T-포즈)로 되돌려 팔이 안 내려온다. 회전만 필요하므로 끈다.
  const baked = retargetClip(target, src.srcMesh, src.clip, { fps: 30, names, hip: src.hipName, preservePosition: false });
  if (!baked) return null;
  // retargetClip 은 `.bones[뼈].prop`(스켈레톤 상대) 트랙을 굽는다. 이걸 `뼈.prop`(뼈 이름)
  // 트랙으로 바꿔 **루트 믹서**가 씬 그래프의 실제 뼈를 이름으로 구동하게 한다 — 그래야
  // 렌더·스케일과 정합한다(스켈레톤 상대 경로로 별도 믹서를 돌리면 스케일이 어긋나 붕괴).
  // Hips 위치 트랙은 버린다 — 클립마다 절대 높이가 달라 전환 시 뜨/가라앉음. 회전만 쓰면
  // Hips 는 바인드 높이 고정 → 접지 일관(제자리 애니메이션), 미세 보정은 groundToPose.
  baked.tracks = baked.tracks
    .filter(t => !/\.position$/.test(t.name))
    .map(t => { t.name = t.name.replace(/^\.bones\[(.+?)\]\./, '$1.'); return t; });
  baked.name = label;
  // retargetClip 은 baking 중 뼈 position/scale 을 오염시킨 채 마지막 프레임에 남긴다.
  // 우리 클립은 회전만 재생하므로 뼈 position 을 저장해 둔 바인드로 복원한다(scale 은
  // groundToPose 의 applyProps 가 비율대로 복구). 안 하면 스켈레톤이 흩어져 메시가 붕괴.
  // (skeleton.pose() 는 일부 리그[Y Bot]에서 복원이 안 됨 → 직접 복원.)
  // 스켈레톤 전체를 바인드로 리셋(믹서가 안 건드리는·그래프에 없는 뼈까지 — 이걸 안 하면
  // 그 뼈에 스키닝된 정점이 고정 위치에 떨어져 떠 있는 조각으로 남는다), 이어서 그래프 뼈는
  // 저장한 바인드로 정밀 복원.
  target.skeleton.pose();
  if (ch.bindPose) for (const [b, bp] of ch.bindPose) { b.position.copy(bp.p); b.quaternion.copy(bp.q); }
  return baked;
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
    const src = await loadSource(file);
    if (!src) { setStatus(`${label}: 클립 로드 실패`); return; }
    let baked;
    try { baked = bakeClip(ch, src, label); }
    catch (e) { setStatus(`${label}: 리타깃 실패 — ${e.message}`); return; }
    if (!baked) { setStatus(`${label}: 리타깃 대상 없음`); return; }
    ch.clips[label] = baked;
  }
  playClip(ch, label, fade);
  groundToPose(ch); // 클립마다 다리 포즈가 달라 미세하게 뜨/가라앉음 → 프레임0 기준 재접지
  refreshAnimButtons();
}

// ---------------------------------------------------------------------------
//  기본 캐릭터 두 명 로드 → 둘 다 "대기"로 세워둔다
// ---------------------------------------------------------------------------
// 현재 클립의 프레임0 포즈로 발을 바닥에 정확히 접지 (로드 직후 1회).
// 리타깃에서 Hips 를 바인드 기준으로 상대화하므로 남는 오차는 무릎 굽힘 정도뿐.
function groundToPose(ch) {
  if (!ch) return;
  ch.mixer.update(0); // 프레임0 포즈(회전)를 뼈에 적용
  // retargetClip 의 bake 는 bone.matrix.decompose 로 뼈에 잔여 scale 을 남긴다. 우리 클립은
  // 회전만 담아 scale 을 되돌리지 못하므로 메시가 붕괴한다 → applyProps 로 본 scale(비율)과
  // root scale 을 복구하고 접지까지 한 번에 처리한다.
  applyProps(ch);
}

async function loadSlotBase(slotId) {
  const slot = SLOTS[slotId];
  const buf = await (await fetch(encodeURI(slot.file))).arrayBuffer();
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
  // 둘 다 대기 자세로 세우고 발을 바닥에 접지
  await playAnim('대기', 'idle', 'male', 0);
  await playAnim('대기', 'idle', 'female', 0);
  groundToPose(SLOTS.male.ch);
  groundToPose(SLOTS.female.ch);
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
    const wrap = document.createElement('div'); wrap.className = 'charwrap';
    const b = document.createElement('button');
    b.className = 'char' + (id === selected ? ' on' : '');
    const anim = slot.ch?.active || '—';
    b.innerHTML = `${slot.label}<span class="cap">${slot.ch ? anim : '로드 안 됨'}</span>`;
    b.addEventListener('click', () => select(id));
    // 슬롯별 모델 교체 — 클릭하면 그 슬롯을 선택하고 FBX 파일 선택창을 연다.
    const rep = document.createElement('button');
    rep.className = 'rep'; rep.textContent = '📁 교체'; rep.title = `${slot.label} 모델을 FBX 로 교체`;
    rep.addEventListener('click', e => { e.stopPropagation(); openReplace(id); });
    wrap.append(b, rep);
    box.appendChild(wrap);
  }
}

// 지정 슬롯의 모델을 FBX 로 교체 — 슬롯을 선택한 뒤 파일 선택창을 연다(드롭과 같은 경로).
function openReplace(id) {
  select(id);
  const inp = document.createElement('input');
  inp.type = 'file'; inp.accept = '.fbx';
  inp.onchange = e => readFile(e.target.files[0]);
  inp.click();
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
    // 표준 대기 클립을 얹어 세운다 (교체된 캐릭터의 리그에 리타깃).
    playAnim('대기', 'idle', selected, 0).finally(() => {
      groundToPose(selCh()); // 교체 직후 발 접지
      refreshCharButtons(); refreshPropSliders();
    });
    setStatus(`<b>${SLOTS[selected].label}</b> 슬롯 교체 — ${label} (메시 ${meshes.length} · 뼈 ${bones.length}).`);
  } else if (bones.length && obj.animations?.length) {
    // 애니메이션-only → 선택된 캐릭터에 리타깃 (드롭한 FBX 의 뼈로 source 구성)
    const ch = selCh();
    if (!ch) { setStatus('먼저 캐릭터를 선택하세요.'); return; }
    const clip = obj.animations.find(a => a.duration > 0.01) || obj.animations[0];
    const src = buildSource(obj, clip);
    let key = label, i = 2; while (ch.clips[key]) key = `${label} ${i++}`;
    let baked;
    try { baked = bakeClip(ch, src, key); }
    catch (e) { setStatus(`${label}: 리타깃 실패 — ${e.message}`); return; }
    if (!baked) { setStatus(`${label}: 맞는 뼈가 없어 리타깃 실패.`); return; }
    ch.clips[key] = baked;
    playClip(ch, key, 0.25);
    groundToPose(ch);
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
