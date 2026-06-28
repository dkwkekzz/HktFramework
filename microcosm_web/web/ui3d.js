/* UI3D (색 수정2): THREE.Points + vertexColors 로 입자 색을 항상 표시.
   instanceColor 게이팅 이슈 우회. 엔진(window.MC3) 사용. */
(function () {
  const KIND = MC3.KIND, W = 160, H = 100, D = 160, OX = 80, OZ = 80;
  const stage = document.getElementById('stage');
  const hud = document.getElementById('hud');
  const ww = stage.clientWidth || 760, hh = 500;

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(ww, hh); renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.setClearColor(0x0d0d14, 1); stage.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(55, ww / hh, 0.1, 1200);
  const target = new THREE.Vector3(0, 14, 0);
  let camR = 150, camTheta = 0.9, camPhi = 1.12;
  function updateCam() {
    camera.position.set(target.x + camR * Math.sin(camPhi) * Math.cos(camTheta),
      target.y + camR * Math.cos(camPhi), target.z + camR * Math.sin(camPhi) * Math.sin(camTheta));
    camera.lookAt(target);
  }
  updateCam();

  scene.add(new THREE.GridHelper(220, 22, 0x44475a, 0x24242c));
  const ring = new THREE.Mesh(new THREE.RingGeometry(3, 4.2, 28),
    new THREE.MeshBasicMaterial({ color: 0x8a80ff, side: THREE.DoubleSide }));
  ring.rotation.x = -Math.PI / 2; ring.position.set(16, 0.1, 0); scene.add(ring);

  // 단위 = 입자(Points). vertexColors 로 색이 항상 보인다.
  const CAP = 2000;
  const pgeo = new THREE.BufferGeometry();
  const ppos = new Float32Array(CAP * 3), pcol = new Float32Array(CAP * 3);
  pgeo.setAttribute('position', new THREE.BufferAttribute(ppos, 3));
  pgeo.setAttribute('color', new THREE.BufferAttribute(pcol, 3));
  const points = new THREE.Points(pgeo, new THREE.PointsMaterial({ size: 4.2, vertexColors: true, sizeAttenuation: true }));
  points.frustumCulled = false; scene.add(points);

  const MAXB = 4000, bgeo = new THREE.BufferGeometry(), bpos = new Float32Array(MAXB * 2 * 3);
  bgeo.setAttribute('position', new THREE.BufferAttribute(bpos, 3));
  const blines = new THREE.LineSegments(bgeo, new THREE.LineBasicMaterial({ color: 0x9a9cb0, transparent: true, opacity: 0.34 }));
  blines.frustumCulled = false; scene.add(blines);
  const MAXBO = 2400, lgeo = new THREE.BufferGeometry(), lpos = new Float32Array(MAXBO * 2 * 3);
  lgeo.setAttribute('position', new THREE.BufferAttribute(lpos, 3));
  const llines = new THREE.LineSegments(lgeo, new THREE.LineBasicMaterial({ color: 0xd7d2ff, transparent: true, opacity: 0.95 }));
  llines.frustumCulled = false; scene.add(llines);

  let world, hero; const mouseT = new THREE.Vector3(16, 0, 0);
  function reset() { world = new MC3.World({ W, H, D, gravity: 9 }); hero = MC3.Forms.character(world, 62, 12, 80); MC3.Forms.chainmail(world, 96, 46, 80, { cols: 12, rows: 9 }); }
  function heroCore() { return (hero && world.alive[hero.core]) ? hero.core : null; }
  function castFire() { const c = heroCore(); if (c == null) return; MC3.Forms.fireball(world, world.px[c], world.py[c], world.pz[c], mouseT.x + OX, world.py[c], mouseT.z + OZ, { count: 46, temp: 2.0, speed: 48 }); }
  function castBolt() { MC3.Forms.lightning(world, mouseT.x + OX, mouseT.z + OZ, { dmg: 55 }); }
  function dropMail() { MC3.Forms.chainmail(world, mouseT.x + OX, 46, mouseT.z + OZ, { cols: 10, rows: 8 }); }
  function spawnHero() { if (heroCore() == null) hero = MC3.Forms.character(world, 62, 12, 80); }

  const ray = new THREE.Raycaster(), plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), ndc = new THREE.Vector2(), hitp = new THREE.Vector3();
  function aim(e) {
    const r = renderer.domElement.getBoundingClientRect();
    ndc.x = ((e.clientX - r.left) / r.width) * 2 - 1; ndc.y = -((e.clientY - r.top) / r.height) * 2 + 1;
    ray.setFromCamera(ndc, camera);
    if (ray.ray.intersectPlane(plane, hitp)) { mouseT.copy(hitp); ring.position.set(hitp.x, 0.1, hitp.z); }
  }
  let dragging = false, moved = false, lx = 0, ly = 0; const cv = renderer.domElement;
  cv.addEventListener('mousedown', e => { dragging = true; moved = false; lx = e.clientX; ly = e.clientY; aim(e); });
  window.addEventListener('mouseup', () => { dragging = false; });
  cv.addEventListener('mousemove', e => {
    aim(e);
    if (dragging) { const dx = e.clientX - lx, dy = e.clientY - ly; if (Math.abs(dx) + Math.abs(dy) > 4) moved = true; lx = e.clientX; ly = e.clientY; camTheta -= dx * 0.01; camPhi = Math.max(0.2, Math.min(1.5, camPhi - dy * 0.01)); updateCam(); }
  });
  cv.addEventListener('click', e => { aim(e); if (!moved) castFire(); });
  cv.addEventListener('wheel', e => { e.preventDefault(); camR = Math.max(60, Math.min(340, camR + e.deltaY * 0.12)); updateCam(); }, { passive: false });
  window.addEventListener('keydown', e => { const k = e.key.toLowerCase(); if (k === 'f') castFire(); else if (k === 'l') castBolt(); else if (k === 'c') dropMail(); else if (k === 'r') reset(); });
  const bind = (id, fn) => { const el = document.getElementById(id); if (el) el.onclick = fn; };
  bind('bHero', spawnHero); bind('bFire', castFire); bind('bBolt', castBolt); bind('bMail', dropMail); bind('bReset', reset);

  function writeColor(k, i, o) {
    let r, g, b;
    if (k === KIND.FIRE) { const t = Math.min(1, world.T[i] / 2); r = Math.min(1, 0.7 + t * 0.3); g = Math.min(1, 0.2 + t * 0.75); b = Math.max(0.02, t - 0.5); }
    else if (k === KIND.CHARACTER) { const f = world.hpMax[i] > 0 ? Math.max(0, world.hp[i] / world.hpMax[i]) : 1; r = 0.2 + (1 - f) * 0.75; g = 0.55 + f * 0.35; b = 0.45; }
    else if (k === KIND.ARMOR) { if (world.T[i] > 0.4) { const t = Math.min(1, world.T[i] / 2); r = 0.7 + t * 0.3; g = 0.2 + t * 0.6; b = 0.05; } else { r = 0.72; g = 0.75; b = 0.8; } }
    else if (k === KIND.LIGHTNING) { r = 0.92; g = 0.9; b = 1; }
    else { r = 0.5; g = 0.5; b = 0.5; }
    pcol[o] = r; pcol[o + 1] = g; pcol[o + 2] = b;
  }
  function frame() {
    world.step(0.04); world.step(0.04);
    let cnt = 0; const n = Math.min(world.n, CAP);
    for (let i = 0; i < n; i++) {
      if (!world.alive[i]) continue; const o = cnt * 3;
      ppos[o] = world.px[i] - OX; ppos[o + 1] = world.py[i]; ppos[o + 2] = world.pz[i] - OZ;
      writeColor(world.kind[i], i, o); cnt++;
    }
    pgeo.setDrawRange(0, cnt);
    pgeo.attributes.position.needsUpdate = true; pgeo.attributes.color.needsUpdate = true;
    let bc = 0;
    for (const b of world.bonds) { if (!world.alive[b.i] || !world.alive[b.j] || bc >= MAXB) continue;
      bpos[bc * 6] = world.px[b.i] - OX; bpos[bc * 6 + 1] = world.py[b.i]; bpos[bc * 6 + 2] = world.pz[b.i] - OZ;
      bpos[bc * 6 + 3] = world.px[b.j] - OX; bpos[bc * 6 + 4] = world.py[b.j]; bpos[bc * 6 + 5] = world.pz[b.j] - OZ; bc++; }
    bgeo.setDrawRange(0, bc * 2); bgeo.attributes.position.needsUpdate = true;
    let lc = 0;
    for (const bolt of world.bolts) for (const s of bolt.segs) { if (lc >= MAXBO) break;
      lpos[lc * 6] = s[0] - OX; lpos[lc * 6 + 1] = s[1]; lpos[lc * 6 + 2] = s[2] - OZ;
      lpos[lc * 6 + 3] = s[3] - OX; lpos[lc * 6 + 4] = s[4]; lpos[lc * 6 + 5] = s[5] - OZ; lc++; }
    lgeo.setDrawRange(0, lc * 2); lgeo.attributes.position.needsUpdate = true;
    if (hud) { let alive = 0; for (let i = 0; i < world.n; i++) if (world.alive[i]) alive++;
      const c = heroCore(); hud.textContent = (c != null ? ('HP ' + Math.max(0, world.hp[c]).toFixed(0)) : '캐릭터 쓰러짐 (R)') + '   ·   units ' + alive + '   ·   bonds ' + world.bonds.length; }
    renderer.render(scene, camera); requestAnimationFrame(frame);
  }
  reset(); frame();
})();
