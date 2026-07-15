// ============================================================================
//  HktCharacter — 캐릭터 선택 + 애니메이션 + 본 비율 뷰어 (v3)
//
//  v4: 화면에는 캐릭터 **한 명**만 세운다.
//    1. 드롭다운(저장소 모델 + 📁 FBX 임포트)으로 그 자리를 갈아끼운다. 현재 로드된
//       모델 이름은 패널 상단(#charNow)에 표시한다.
//    2. 애니메이션 버튼 → 현재 캐릭터에 리타깃 재생. 리타깃은 순수 월드 공간 자체
//       구현(bakeClip), 구동 뼈는 메시 소속이 아니라 계층 등뼈(DFS-첫 뼈).
//    3. 접지: 클립별 접지 y 를 재생 시작 전에 **미리 측정**(measureClipRootY)해 root.y
//       를 고정 — 재생 중(특히 crossfade 중) 포즈를 재측정하지 않는다(중심 틀어짐 방지).
//    4. 본 비율 슬라이더 — 키/머리/몸통/어깨/팔/다리/손을 뼈 스케일로 조절.
//       클립은 회전 + hips 위치(변위) 트랙만 가지므로 scale 채널과 root position 은
//       우리가 소유한다.
//
//  핵심 유지: 메시는 FBX 원본 그대로, 본 표시는 THREE.SkeletonHelper.
// ============================================================================
import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { McFlesh } from './mcflesh.js';
import {
  GENE_SPEC, defaultGenome, randomGenome, compileFlesh, mutateGenome,
  deriveStats, serializeGenome, parseGenome, mulberry32,
} from './fleshdna.js';

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
  // updateStyle=true(기본) — 캔버스 CSS 크기를 뷰포트에 맞춘다. false 로 두면 HiDPI
  // (devicePixelRatio 2, 예: 레티나)에서 드로잉 버퍼(w·pr × h·pr)가 CSS 크기 미설정으로
  // 그대로 표시돼 캔버스가 뷰포트를 넘치고, 중앙 정렬된 모델이 화면 우하단으로 밀린다.
  renderer.setSize(w, h);
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
// 저장소(public/assets/character/)에 있는 모델 목록 = 드롭다운 "저장소 모델" 항목.
// 새 캐릭터 FBX 를 추가하면 여기 한 줄만 늘리면 된다.
const MODELS = [
  { label: 'X Bot', file: 'assets/character/X Bot.fbx' },
  { label: 'Y Bot', file: 'assets/character/Y Bot.fbx' },
];
// v4: 화면에는 캐릭터 **한 명**만. 드롭다운(저장소 모델/📁 임포트)으로 그 자리를 갈아끼운다.
const SLOTS = {
  main: { label: MODELS[0].label, file: MODELS[0].file, x: 0, ch: null },
};
let selected = 'main';
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
  // 구동 뼈 선정 — Mixamo with-skin FBX 는 스킨 메시 2벌(Surface+Joints)의 스켈레톤이
  // 같은 이름의 트윈으로 **교차(interleaved)** 배치된다. 어느 쪽이 계층의 등뼈(backbone)
  // 인지는 파일마다 다르다(X Bot=Surface 쪽, Y Bot=Joints 쪽). 그래서 메시 소속이 아니라
  // **계층 순서**로 고른다: DFS 선순회에서 simpleName 별 첫 뼈(항상 조상 쪽) = 구동 대상.
  // 트윈 자식들은 바인드 로컬을 유지한 채 부모를 따라 움직이므로 두 메시 다 애니메이션된다.
  // (같은 이름의 나머지 뼈는 유일하게 개명해 믹서 이름 바인딩 충돌을 없앤다.)
  const boneMap = new Map(); const drivers = [];
  let dupSeq = 0;
  for (const b of bones) { // parseFBX 의 traverse = DFS 선순회 (부모 먼저)
    const sn = simpleName(b.name);
    if (!boneMap.has(sn)) { boneMap.set(sn, b); drivers.push(b); }
    else b.name = `${b.name}__dup${dupSeq++}`;
  }
  const skinnedAll = meshes.filter(m => m.isSkinnedMesh);
  skinnedAll.sort((a, b) =>
    (b.geometry.attributes.position?.count || 0) - (a.geometry.attributes.position?.count || 0));
  const primeMesh = skinnedAll[0] || null;
  // 크기·접지·본 비율·애니메이션은 씬 그래프에 실제 배치된 뼈(루트 아래, 스케일 반영)로.
  // 믹서는 루트(obj)에 두고 트랙은 뼈 이름으로 이 그래프 뼈를 구동한다.
  const ch = {
    root: obj, meshes, bones: drivers, boneMap, allBones: bones, hasMesh: !!primeMesh, slotX: slot.x,
    mixer: new THREE.AnimationMixer(obj), actions: {}, clips: {}, active: '',
    helper: drivers.length ? new THREE.SkeletonHelper(obj) : null,
    baseScale: 1, props: defaultProps(), primeMesh,
    // 살 게놈 — 캐릭터별 상태(props 와 같은 수명). 위상(뼈)은 게놈 밖 고정, 살만 소유.
    fleshGenome: defaultGenome(), fleshSeed: 1,
  };
  ch.fleshPheno = compileFlesh(ch.fleshGenome); // 뼈 이름→세그먼트 LUT 평가기
  computeBaseScale(ch);
  applyProps(ch); // root scale + 발 접지
  // 바인드 캐시 — 리타깃(bakeClip)은 뼈 상태를 전혀 건드리지 않는 순수 계산이라,
  // 필요한 바인드(로컬 q / 월드 q)를 로드 직후 한 번 캐시해 둔다.
  ch.bindLocalQ = new Map();
  ch.bindLocalP = new Map();
  for (const b of bones) {
    ch.bindLocalQ.set(b, b.quaternion.clone());
    ch.bindLocalP.set(b, b.position.clone());
  }
  obj.updateMatrixWorld(true);
  const q = new THREE.Quaternion();
  ch.bindWorldQ = new Map();
  for (const b of bones) ch.bindWorldQ.set(b, b.getWorldQuaternion(q).clone());
  ch.staticParentQ = new Map(); // 뼈가 아닌 부모(정적 노드)의 월드 회전
  for (const b of bones) {
    const p = b.parent;
    if (p && !p.isBone && !ch.staticParentQ.has(p)) ch.staticParentQ.set(p, p.getWorldQuaternion(q).clone());
  }
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
  // 비율이 바뀌면 클립별 접지 y 캐시(__rootY)는 무효 — 다음 재생 시 재측정
  for (const k in ch.clips) delete ch.clips[k].__rootY;
  replant(ch);
}

// 발바닥 y=0 접지 (뼈 bbox 기준 — 스케일 반영). x/z 중심 정렬은 **바인드(클립 없음)일 때만**
// — 재생 중 포즈 bbox 로 x/z 를 다시 맞추면 클립·프레임마다 중심이 튄다("중심 틀어짐" 원인).
function replant(ch) {
  const anchored = !!ch.active; // 클립 재생 중이면 x/z 는 건드리지 않는다
  ch.root.position.y = 0;
  if (!anchored) ch.root.position.set(0, 0, 0);
  ch.root.updateMatrixWorld(true);
  const box = boneBox(ch);
  if (!anchored) {
    const c = new THREE.Vector3(); box.getCenter(c);
    ch.root.position.x = ch.slotX - c.x;
    ch.root.position.z = -c.z;
  }
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
// 리타깃은 **순수 월드 공간 계산**으로 직접 굽는다 (SkeletonUtils.retargetClip 폐기 —
// 그것은 bake 중 target 뼈 상태를 오염시키고(skeleton.pose+decompose 잔여 → 본 흩어짐),
// Y Bot 처럼 등뼈가 트윈 쪽인 리그에선 바인드 포즈가 그대로 구워져 T-포즈로 멈췄다).
// 원리: 원하는 타깃 월드 회전 = srcWorld(t) × corr, corr = srcBindWorld⁻¹ × tgtBindWorld.
// 이를 프레임마다 실제 부모의 월드 회전(트윈 등 비매칭 뼈는 바인드 로컬 유지로 전파)
// 기준 로컬로 변환해 쿼터니언 트랙으로 만든다. 타깃 뼈는 읽지도 쓰지도 않는다.
//
// source(애니메이션 FBX)는 뼈 계층 + 바인드 월드 회전만 있으면 된다.
function buildSource(obj, clip) {
  const sBones = []; obj.traverse(o => { if (o.isBone) sBones.push(o); });
  if (!sBones.length || !clip) return null;
  obj.updateMatrixWorld(true);
  const bySName = new Map(); const bindWorldQ = new Map();
  const q = new THREE.Quaternion();
  for (const b of sBones) {
    const sn = simpleName(b.name);
    if (!bySName.has(sn)) { bySName.set(sn, b); bindWorldQ.set(sn, b.getWorldQuaternion(q).clone()); }
  }
  // Hips 이동 리타깃용 — 소스 바인드에서 hips 의 월드 위치 (변위 기준점 + 키 비율 계산)
  const hipsB = bySName.get('hips');
  const hipsBindP = hipsB ? hipsB.getWorldPosition(new THREE.Vector3()).clone() : null;
  return { obj, clip, bySName, bindWorldQ, hipsBindP };
}

const sourceCache = {}; // file → { obj, clip, bySName, bindWorldQ }
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

// source 클립을 구동 뼈(boneMap)에 월드 공간 리타깃해 새 클립을 굽는다.
// 위치 트랙은 hips **x/y/z 변위 전체** — y 만 옮기면 앉는 동작에서 발이 뜨고(v4 버그),
// x/z(체중 이동·런지·스텝)를 버리면 골반이 못 움직인 만큼 발이 반대로 미끄러져 중심이
// 흔들려 보인다(v4.2 버그 — Mixamo 웹 대비 불안정의 원인). 제자리 재생은 x/z 의 선형
// 순이동(detrend) 제거로 유지, 최종 접지는 measureClipRootY(사전 측정).
function bakeClip(ch, src, label, fps = 30) {
  if (!src) return null;
  const dur = src.clip.duration;
  const frames = Math.max(2, Math.round(dur * fps) + 1);
  const matched = new Map(); // 구동 뼈 → { sBone, corr }
  for (const [sn, b] of ch.boneMap) {
    const sBone = src.bySName.get(sn);
    if (!sBone) continue;
    matched.set(b, { sBone, corr: src.bindWorldQ.get(sn).clone().invert().multiply(ch.bindWorldQ.get(b)) });
  }
  if (!matched.size) return null;
  // Hips **이동(x/y/z) 변위 전체** 리타깃 준비 — 소스 hips 의 월드 변위를 키 비율
  // (hScale)로 스케일해 hips.position 트랙으로 만든다. 이동형(순이동≠0) 클립이 와도
  // 제자리 재생이 유지되게 x/z 는 클립 전체의 선형 순이동 성분만 제거(detrend)한다 —
  // 동봉 Mixamo 클립은 전부 제자리(순이동=0)라 체중 이동 흔들림이 온전히 남는다.
  // hips 의 부모는 정적 노드(씬 루트 계열)라 부모 월드 행렬을 bake 시작 시 1회 캐시.
  const hips = ch.boneMap.get('hips');
  const hm = hips && matched.get(hips);
  let hp = null;
  if (hm && src.hipsBindP && src.hipsBindP.y > 1e-6) {
    ch.root.updateMatrixWorld(true);
    const pm = hips.parent.matrixWorld.clone();
    const bindWorld = ch.bindLocalP.get(hips).clone().applyMatrix4(pm);
    hp = {
      sBone: hm.sBone,
      pmInv: pm.invert(), // 이후 pm 은 역행렬
      bindWorld,
      hScale: bindWorld.y / src.hipsBindP.y, // 타깃/소스 hips 높이 비율 (단위 차 흡수)
      values: new Float32Array(frames * 3),
      net: new THREE.Vector3(), // 클립 전체 순이동 (x/z detrend 용)
    };
  }
  // source 를 전용 믹서로 프레임마다 포즈시켜 월드 회전을 샘플링 (target 은 불변).
  const mixer = new THREE.AnimationMixer(src.obj);
  mixer.clipAction(src.clip).play();
  const times = new Float32Array(frames);
  const values = new Map([...matched.keys()].map(b => [b, new Float32Array(frames * 4)]));
  const worldQ = new Map(ch.allBones.map(b => [b, new THREE.Quaternion()]));
  const sw = new THREE.Quaternion(), wq = new THREE.Quaternion(), inv = new THREE.Quaternion();
  const idQ = new THREE.Quaternion();
  const sv = new THREE.Vector3(), tv = new THREE.Vector3();
  if (hp) { // 클립 순이동 측정 (마지막-첫 프레임) — x/z detrend 기준
    mixer.setTime(0); src.obj.updateMatrixWorld(true);
    hp.net.copy(hp.sBone.getWorldPosition(sv));
    mixer.setTime(dur); src.obj.updateMatrixWorld(true);
    hp.net.subVectors(hp.sBone.getWorldPosition(sv), hp.net);
  }
  for (let f = 0; f < frames; f++) {
    const t = Math.min(dur, f / fps);
    times[f] = t;
    mixer.setTime(t);
    src.obj.updateMatrixWorld(true);
    if (hp) {
      hp.sBone.getWorldPosition(sv).sub(src.hipsBindP); // 소스 바인드 기준 월드 변위
      const k = dur > 1e-6 ? t / dur : 0;
      sv.x -= hp.net.x * k; sv.z -= hp.net.z * k; // 순이동 제거 → 제자리 유지 (y 는 그대로)
      tv.copy(hp.bindWorld).addScaledVector(sv, hp.hScale);
      tv.applyMatrix4(hp.pmInv); // 부모 로컬로 변환
      hp.values.set([tv.x, tv.y, tv.z], f * 3);
    }
    for (const b of ch.allBones) { // DFS 선순회 → 부모 worldQ 가 항상 먼저 계산됨
      const pw = b.parent?.isBone ? worldQ.get(b.parent)
        : (ch.staticParentQ.get(b.parent) || idQ);
      const out = worldQ.get(b);
      const m = matched.get(b);
      if (m) {
        m.sBone.getWorldQuaternion(sw);
        wq.copy(sw).multiply(m.corr);                 // 원하는 타깃 월드 회전
        const lq = inv.copy(pw).invert().multiply(wq); // 실제 부모 기준 로컬로
        values.get(b).set([lq.x, lq.y, lq.z, lq.w], f * 4);
        out.copy(wq);
      } else {
        // 비매칭 뼈(트윈·손가락 끝 등)는 바인드 로컬 유지 — 부모를 따라 움직인다
        out.copy(pw).multiply(ch.bindLocalQ.get(b));
      }
    }
  }
  const tracks = [];
  for (const [b] of matched)
    tracks.push(new THREE.QuaternionKeyframeTrack(`${b.name}.quaternion`, times, values.get(b)));
  if (hp) tracks.push(new THREE.VectorKeyframeTrack(`${hips.name}.position`, times, hp.values));
  return new THREE.AnimationClip(label, dur, tracks);
}

// 클립별 접지 root.y 를 **미리 측정**한다: 임시 믹서로 클립을 N 프레임 샘플링해 뼈 bbox
// 최저 y 를 찾고, 그 프레임이 바닥에 닿는 root.y 를 돌려준다. 측정 후 뼈 회전을 원상
// 복구하므로 화면 상태는 불변(렌더 사이 동기 실행). — 이전 groundToPose 는 재생 중인
// **혼합(crossfade) 포즈**를 측정해 root 를 옮겼기 때문에 클립·모델·타이밍마다 다르게
// 뜨거나(공중부양) 중심이 틀어졌다.
function measureClipRootY(ch, clip, samples = 12) {
  const saved = ch.allBones.map(b => [b, b.quaternion.clone(), b.position.clone()]);
  const savedY = ch.root.position.y;
  ch.root.position.y = 0;
  const mixer = new THREE.AnimationMixer(ch.root);
  mixer.clipAction(clip).play();
  let minY = Infinity;
  for (let i = 0; i <= samples; i++) {
    mixer.setTime(clip.duration * i / samples);
    ch.root.updateMatrixWorld(true);
    minY = Math.min(minY, boneBox(ch).min.y);
  }
  mixer.stopAllAction();
  mixer.uncacheRoot(ch.root);
  for (const [b, q, p] of saved) { b.quaternion.copy(q); b.position.copy(p); }
  ch.root.position.y = savedY;
  ch.root.updateMatrixWorld(true);
  return -minY; // 클립 전체에서 가장 낮은 지점이 y=0 에 닿는 root.y
}

function playClip(ch, name, fade = 0.25) {
  if (!ch || !ch.clips[name] || ch.active === name) return;
  const clip = ch.clips[name];
  if (clip.__rootY === undefined) clip.__rootY = measureClipRootY(ch, clip);
  if (!ch.actions[name]) ch.actions[name] = ch.mixer.clipAction(clip);
  const next = ch.actions[name];
  const prev = ch.active && ch.actions[ch.active];
  next.enabled = true;
  next.setEffectiveWeight(1).play();
  if (prev && fade > 0) { next.reset(); prev.crossFadeTo(next, fade, false); }
  else if (prev) prev.stop();
  ch.active = name;
  ch.root.position.y = clip.__rootY; // 접지는 사전 측정값으로 — 재생 중 재측정 금지
  ch.mixer.update(0); // 포즈 즉시 적용 — 다음 렌더까지 1프레임 T-포즈(바인드) 노출 방지
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
  playClip(ch, label, fade); // 접지는 playClip 안에서 클립별 사전 측정값으로 처리
  refreshAnimButtons();
}

// ---------------------------------------------------------------------------
//  기본 캐릭터 로드 / 모델 전환
// ---------------------------------------------------------------------------
async function loadSlotBase(slotId) {
  const slot = SLOTS[slotId];
  const buf = await (await fetch(encodeURI(slot.file))).arrayBuffer();
  const parsed = parseFBX(buf);
  if (!parsed.meshes.length) throw new Error(`${slot.label}: 메시 없는 FBX`);
  disposeCh(slotId);
  makeCh(slotId, parsed);
}

// 드롭다운(저장소 모델)으로 화면의 캐릭터를 갈아끼운다. 클립 캐시는 캐릭터별이므로
// 새 캐릭터에는 대기부터 다시 리타깃해 세운다.
let switching = false;
async function switchModel(m) {
  const slot = SLOTS.main;
  if (switching || (slot.file === m.file && slot.ch)) return;
  switching = true;
  setStatus(`${m.label} 로드 중…`);
  try {
    slot.file = m.file; slot.label = m.label;
    await loadSlotBase('main');
    await playAnim('대기', 'idle', 'main', 0);
    select('main');
    setStatus(`${m.label} 준비됨.`);
  } catch (e) {
    setStatus('로드 실패: ' + e.message);
  }
  switching = false;
  refreshCharSelect();
  refreshPropSliders();
}

async function bootstrap() {
  setStatus('캐릭터 로드 중…');
  try {
    await loadSlotBase('main');
  } catch (e) {
    setStatus('캐릭터 로드 실패: ' + e.message);
    return;
  }
  await playAnim('대기', 'idle', 'main', 0);
  select('main');
  refreshCharSelect();
  setStatus('준비됨 — 드롭다운으로 캐릭터를 바꾸고, 애니메이션을 눌러보세요.');
}

// ---------------------------------------------------------------------------
//  선택 (버튼 + 3D 클릭)
// ---------------------------------------------------------------------------
function select(id) {
  if (!SLOTS[id]) return;
  selected = id;
  updateRing();
  refreshCharSelect();
  refreshAnimButtons();
  refreshPropSliders();
  refreshFleshUI();
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

// ---------------------------------------------------------------------------
//  UI — 모델 선택 버튼 / 애니메이션 버튼 / 본 비율 슬라이더
// ---------------------------------------------------------------------------
const $ = id => document.getElementById(id);

// 캐릭터는 한 명 — 드롭다운으로 "그 자리에 어떤 모델을 세울지" 선택하고, 현재 로드된
// 모델 이름 + 재생 중 애니메이션을 상단(#charNow)에 표시한다.
const CUSTOM_PREFIX = '__custom__:';
function refreshCharSelect() {
  const slot = SLOTS.main;
  const isCustom = slot.file.startsWith(CUSTOM_PREFIX);

  // 현재 로드 표시
  const anim = slot.ch ? (slot.ch.active || '로드 중') : '로드 중';
  $('charNow').innerHTML =
    `<span class="k">현재:</span> ${slot.label} <span class="k">· ${anim}</span>`;

  // 드롭다운 = 저장소 모델 + (임포트된 커스텀) + 임포트 트리거
  const sel = $('charSelect'); sel.innerHTML = '';
  const grp = document.createElement('optgroup'); grp.label = '저장소 모델';
  MODELS.forEach((m, i) => {
    const o = document.createElement('option');
    o.value = 'model:' + i; o.textContent = m.label;
    if (!isCustom && slot.file === m.file) o.selected = true;
    grp.appendChild(o);
  });
  sel.appendChild(grp);
  if (isCustom) {
    const o = document.createElement('option');
    o.value = 'custom'; o.selected = true;
    o.textContent = `${slot.label} (임포트됨)`;
    sel.appendChild(o);
  }
  const imp = document.createElement('option');
  imp.value = 'import'; imp.textContent = '📁 FBX 임포트…';
  sel.appendChild(imp);
}

// 드롭다운 변경 → 저장소 모델 전환 / 임포트 파일창. (선택값은 refreshCharSelect 가 되돌린다)
function onCharSelectChange() {
  const v = $('charSelect').value;
  if (v === 'import') { openReplace(); refreshCharSelect(); return; }
  if (v === 'custom') return;
  if (v.startsWith('model:')) switchModel(MODELS[+v.slice(6)]);
}
$('charSelect').addEventListener('change', onCharSelectChange);

// 임의 FBX 로 교체 — 파일 선택창(드롭과 같은 경로).
function openReplace() {
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
  refreshCharSelect(); // 상단 현재-모델 표시의 애니메이션 캡션 갱신
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
      refreshFleshStats(); // 뼈 길이 변화 → 형태→기능 스탯 재계산(§6)
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

// ---------------------------------------------------------------------------
//  살 게놈 UI — 게놈(정규화 유전자 벡터)을 슬라이더로 노출. 슬라이더=지역성 시연
//  (작은 변화→작은 형태 변화), 🎲=폐쇄성 시연(임의 수열도 항상 유효한 몸), 스탯
//  readout=형태→기능(§6, 스탯은 게놈이 아니라 표현형에서 읽어낸다).
// ---------------------------------------------------------------------------
const GENE_LABEL = {
  'global.bulk': '전체 벌크', 'head.thick': '머리 두께', 'head.shape': '머리 형태',
  'torso.thick': '몸통 두께', 'torso.shape': '허리 잘록', 'torso.flatten': '몸통 납작',
  'arm.thick': '팔 두께', 'arm.shape': '이두 볼록', 'hand.thick': '손 두께',
  'leg.thick': '다리 두께', 'leg.shape': '종아리 볼록', 'foot.thick': '발 두께',
  'surface.hue': '피부 색상', 'surface.tone': '피부 명도',
};

// 주어진 스켈레톤에서 부위별 실측 길이(m) — 형태→기능이 실제 뼈를 읽게 한다(§6).
function measureLengths(ch) {
  const acc = {}; const pa = new THREE.Vector3(), pb = new THREE.Vector3();
  const seen = new Set();
  for (const b of ch.bones) {
    if (!b.parent?.isBone) continue;
    const pKey = simpleName(b.parent.name), cKey = simpleName(b.name);
    const key = pKey + '>' + cKey;
    if (seen.has(key)) continue; seen.add(key);
    const seg = ch.fleshPheno.resolve(pKey, cKey); if (!seg) continue;
    acc[seg.group] = (acc[seg.group] || 0) + b.parent.getWorldPosition(pa).distanceTo(b.getWorldPosition(pb));
  }
  return acc;
}

function refreshFleshStats() {
  const el = $('fleshStats'); if (!el) return;
  const ch = selCh();
  if (!ch) { el.innerHTML = '<span class="k">캐릭터 없음</span>'; return; }
  const s = deriveStats(ch.fleshPheno, measureLengths(ch));
  el.innerHTML =
    `<span class="k">체력</span> ${s.health} · <span class="k">속도</span> ${s.speed}` +
    ` · <span class="k">위력</span> ${s.power}<br>` +
    `<span class="k">부피</span> ${(s.volume * 1000).toFixed(1)}L · <span class="k">사거리</span> ${s.reach}m`;
}

function refreshFleshSliders() {
  const box = $('fleshSliders'); if (!box) return;
  box.innerHTML = '';
  const ch = selCh();
  GENE_SPEC.forEach((g, i) => {
    const row = document.createElement('div'); row.className = 'row';
    const lab = document.createElement('label'); lab.textContent = GENE_LABEL[g.key] || g.key;
    const inp = document.createElement('input');
    inp.type = 'range'; inp.min = 0; inp.max = 1; inp.step = 0.01;
    inp.value = ch ? ch.fleshGenome[i] : g.def;
    inp.disabled = !ch;
    const val = document.createElement('span'); val.className = 'val';
    const showVal = () => { val.textContent = (g.lo + (+inp.value) * (g.hi - g.lo)).toFixed(2); };
    showVal();
    inp.addEventListener('input', () => {
      const c = selCh(); if (!c) return;
      c.fleshGenome[i] = +inp.value;
      c.fleshPheno = compileFlesh(c.fleshGenome); // 재전개 (지역성: 작은 변화만 반영)
      showVal(); refreshFleshStats();
    });
    row.append(lab, inp, val);
    box.appendChild(row);
  });
  refreshFleshStats();
}

// 살 게놈 UI 전체 갱신 (슬라이더 + 스탯 + DNA 코드) — 캐릭터 전환 시 호출
function refreshFleshUI() {
  const ch = selCh();
  const who = $('fleshWho'); if (who) who.textContent = ch ? SLOTS[selected].label : '';
  refreshFleshSliders();
  const code = $('fleshCode');
  if (code) code.value = ch ? serializeGenome(ch.fleshGenome) : '';
}

$('btnFleshRandom')?.addEventListener('click', () => {
  const ch = selCh(); if (!ch) return;
  ch.fleshSeed = (ch.fleshSeed + 1) >>> 0;
  ch.fleshGenome = randomGenome(mulberry32(ch.fleshSeed)); // 임의 수열 → 항상 유효 (폐쇄성)
  ch.fleshPheno = compileFlesh(ch.fleshGenome);
  refreshFleshUI();
  mcFlesh.setVisible(ui.sdf && !!ch);
});
$('btnFleshMutate')?.addEventListener('click', () => {
  const ch = selCh(); if (!ch) return;
  ch.fleshSeed = (ch.fleshSeed + 1) >>> 0;
  ch.fleshGenome = mutateGenome(ch.fleshGenome, ch.fleshSeed, 1); // 층별 변이율
  ch.fleshPheno = compileFlesh(ch.fleshGenome);
  refreshFleshUI();
});
$('btnFleshReset')?.addEventListener('click', () => {
  const ch = selCh(); if (!ch) return;
  ch.fleshGenome = defaultGenome();
  ch.fleshPheno = compileFlesh(ch.fleshGenome);
  refreshFleshUI();
});
$('fleshCode')?.addEventListener('change', () => {
  const ch = selCh(); if (!ch) return;
  ch.fleshGenome = parseGenome($('fleshCode').value); // DNA 코드 붙여넣기 → 개체 복원
  ch.fleshPheno = compileFlesh(ch.fleshGenome);
  refreshFleshUI();
});

// 애니메이션 버튼 채우기 (초기)
refreshAnimButtons();
refreshPropSliders();
refreshFleshUI();

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
    // with-skin → 화면의 캐릭터를 이 모델로 교체
    SLOTS.main.file = CUSTOM_PREFIX + label; // 저장소 모델 선택 해제(커스텀 표시)
    SLOTS.main.label = label;
    disposeCh('main');
    makeCh('main', parsed);
    // 표준 대기 클립을 얹어 세운다 (교체된 캐릭터의 리그에 리타깃, 접지는 playClip 이 처리).
    playAnim('대기', 'idle', 'main', 0).finally(() => {
      select('main');
      refreshCharSelect(); refreshPropSliders();
    });
    setStatus(`캐릭터 교체 — <b>${label}</b> (메시 ${meshes.length} · 뼈 ${bones.length}).`);
  } else if (bones.length && obj.animations?.length) {
    // 애니메이션-only → 캐릭터에 리타깃 (드롭한 FBX 의 뼈로 source 구성)
    const ch = selCh();
    if (!ch) { setStatus('캐릭터가 아직 로드되지 않았습니다.'); return; }
    const clip = obj.animations.find(a => a.duration > 0.01) || obj.animations[0];
    const src = buildSource(obj, clip);
    let key = label, i = 2; while (ch.clips[key]) key = `${label} ${i++}`;
    let baked;
    try { baked = bakeClip(ch, src, key); }
    catch (e) { setStatus(`${label}: 리타깃 실패 — ${e.message}`); return; }
    if (!baked) { setStatus(`${label}: 맞는 뼈가 없어 리타깃 실패.`); return; }
    ch.clips[key] = baked;
    playClip(ch, key, 0.25);
    refreshAnimButtons();
    setStatus(`<b>${key}</b> — 리타깃 재생.`);
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
    // 뼈 월드에서 슬롯 x 오프셋을 빼 준다. 반지름·색은 sel.fleshPheno(게놈 전개)에서.
    mcFlesh.update(sel, simpleName);
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
  scene, cam, renderer, ui, SLOTS, MODELS,
  get selected() { return selected; },
  get sel() { return selCh(); },
  select, playAnim, loadDroppedFBX, switchModel,
  // 살 게놈 콘솔/검증 API — 게놈은 (수열, 전개 규칙) 쌍임을 그대로 노출.
  get genome() { return selCh()?.fleshGenome?.slice(); },
  get dna() { const c = selCh(); return c ? serializeGenome(c.fleshGenome) : null; },
  get stats() { const c = selCh(); return c ? deriveStats(c.fleshPheno, measureLengths(c)) : null; },
  setGenome(arr) { const c = selCh(); if (!c) return; c.fleshGenome = arr.slice(0, GENE_SPEC.length); c.fleshPheno = compileFlesh(c.fleshGenome); refreshFleshUI(); },
  setDna(hex) { const c = selCh(); if (!c) return; c.fleshGenome = parseGenome(hex); c.fleshPheno = compileFlesh(c.fleshGenome); refreshFleshUI(); },
  randomFlesh(seed = 1) { const c = selCh(); if (!c) return; c.fleshGenome = randomGenome(mulberry32(seed)); c.fleshPheno = compileFlesh(c.fleshGenome); refreshFleshUI(); },
};
