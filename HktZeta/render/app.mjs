// 브라우저 렌더 — Scene(scene.json)만 소비해 three.js 로 그린다(불변 원칙 ④).
// ?view=field | terrain | worm 로 세 시점을 고른다. 세계 규칙을 여기서 재유도하지 않는다.
import * as THREE from '/three.module.js';

const view = new URLSearchParams(location.search).get('view') || 'field';
const S = 50; // 정규화된 세계 반경

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0a0e18);
scene.fog = new THREE.Fog(0x0a0e18, 180, 460);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(1);
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 2000);

scene.add(new THREE.HemisphereLight(0xbfd4ff, 0x1a1420, 1.1));
const sun = new THREE.DirectionalLight(0xffffff, 1.4);
sun.position.set(60, 120, 40);
scene.add(sun);

// act 채널 팔레트 (0:이동 1:섭취 2:분열 3:대기)
const ACT_COL = [0x4fc3f7, 0x81c784, 0xff8a65, 0xba9adf];
const hue = (i, n) => new THREE.Color().setHSL((i / n) * 0.85, 0.7, 0.6);

fetch('./scene.json').then((r) => r.json()).then((data) => {
  const bounds = worldBounds(data);
  const P = (x, y) => project(x, y, bounds); // 세계(x,y) → 정규화 (nx,nz)

  if (view === 'field') buildField(data, P);
  else if (view === 'terrain') buildTerrain(data);
  else if (view === 'worm') buildWorm(data, P);

  renderer.render(scene, camera);
  requestAnimationFrame(() => { renderer.render(scene, camera); window.__ready = true; });
}).catch((e) => { document.title = 'ERR ' + e.message; window.__ready = true; });

// ── 시점 ① field: XZ=위치, Y=에너지(성장), 몸=존재, 꼬리=궤적 ──────────────
function buildField(data, P) {
  addGrid();
  const maxE = Math.max(1, ...data.bodies.map((b) => b.energy));
  const eY = (e) => (e / maxE) * 34;

  const geo = new THREE.SphereGeometry(1, 12, 12);
  const inst = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ roughness: 0.4 }), data.bodies.length);
  const m = new THREE.Matrix4();
  data.bodies.forEach((b, i) => {
    const [nx, nz] = P(b.x, b.y);
    const s = 0.7 + b.mag * 0.55;
    m.makeScale(s, s, s); m.setPosition(nx, eY(b.energy) + s, nz);
    inst.setMatrixAt(i, m);
    inst.setColorAt(i, new THREE.Color(ACT_COL[b.act] ?? 0xffffff));
  });
  inst.instanceMatrix.needsUpdate = true;
  if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
  scene.add(inst);

  // 꼬리 = 계보 궤적(성장하면 위로 솟음)
  data.trails.forEach((tr, li) => {
    const pts = tr.map((p) => { const [nx, nz] = P(p.x, p.y); return new THREE.Vector3(nx, (p.e / maxE) * 34, nz); });
    const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts),
      new THREE.LineBasicMaterial({ color: hue(li, data.trails.length), transparent: true, opacity: 0.8 }));
    scene.add(line);
  });

  camera.position.set(4, 62, 118);
  camera.lookAt(0, 12, 0);
}

// ── 시점 ② terrain: 정수 산술 지형(높이=Ω(n), 색=μ(n)) ──────────────────────
function buildTerrain(data) {
  const { W, H, height, mu } = data.terrain;
  const amp = 26, span = 120;
  const geo = new THREE.PlaneGeometry(span, span, W - 1, H - 1);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  const col = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const h = height[i] ?? 0;
    pos.setY(i, h * amp);
    // μ 게이트로 색을 가른다: 0=제곱인수(붉음), +1=파랑, −1=초록. 높을수록 밝게.
    const base = mu[i] === 0 ? [0.85, 0.30, 0.28] : (mu[i] > 0 ? [0.30, 0.55, 0.95] : [0.35, 0.85, 0.55]);
    const l = 0.35 + h * 0.65;
    col[i * 3] = base[0] * l; col[i * 3 + 1] = base[1] * l; col[i * 3 + 2] = base[2] * l;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.computeVertexNormals();
  scene.add(new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, flatShading: true })));

  camera.position.set(0, 66, 104);
  camera.lookAt(0, 6, 0);
}

// ── 시점 ③ worm: (x, t, y) 시공 궤적 — 시간이 위로 흐른다 ────────────────────
function buildWorm(data, P) {
  addGrid();
  const T = data.trails[0]?.length ?? 1;
  const tScale = 130 / T;
  let maxT = 0;
  data.trails.forEach((tr, li) => {
    const pts = tr.map((p, t) => { const [nx, nz] = P(p.x, p.y); maxT = Math.max(maxT, t); return new THREE.Vector3(nx, t * tScale, nz); });
    const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts),
      new THREE.LineBasicMaterial({ color: hue(li, data.trails.length) }));
    scene.add(line);
  });
  camera.position.set(120, 92, 120);
  camera.lookAt(0, maxT * tScale * 0.45, 0);
}

// ── 공용 ──────────────────────────────────────────────────────────────────
function worldBounds(data) {
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  const eat = (x, y) => { minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y); };
  data.bodies.forEach((b) => eat(b.x, b.y));
  data.trails.forEach((tr) => tr.forEach((p) => eat(p.x, p.y)));
  if (!isFinite(minX)) { minX = maxX = minY = maxY = 0; }
  return { minX, maxX, minY, maxY };
}
function project(x, y, b) {
  const sx = (b.maxX - b.minX) || 1, sy = (b.maxY - b.minY) || 1;
  const s = Math.max(sx, sy);
  return [((x - (b.minX + b.maxX) / 2) / s) * 2 * S, ((y - (b.minY + b.maxY) / 2) / s) * 2 * S];
}
function addGrid() {
  const g = new THREE.GridHelper(2 * S + 20, 24, 0x2a3550, 0x1a2036);
  scene.add(g);
}
