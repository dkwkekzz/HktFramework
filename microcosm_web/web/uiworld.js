/* uiworld.js v2.1 - 순수 2D 캔버스. 지형·바다·바위·나무·개체·불 + 가열 글로우. 엔진=window.MCW */
(function () {
  const K = MCW.KIND;
  const cv = document.getElementById('mcw'), ctx = cv.getContext('2d'), hud = document.getElementById('hud');
  const W = 240, H = 120, scale = cv.width / W;
  const sx = x => x * scale, sy = y => (H - y) * scale;
  let world, mouse = { x: 120, y: 60 }, pouring = false; const MAXN = 2400;
  function reset() {
    world = new MCW.World({ W, H, gravity: 16 }); MCW.Forms.terrain(world);
    for (const cx of [70, 100, 130]) MCW.Forms.water(world, cx, 55, 26, 112);
    MCW.Forms.tree(world, 44); MCW.Forms.tree(world, 92); MCW.Forms.tree(world, 198);
    MCW.Forms.rock(world, 150, 0, { r: 5 });
    MCW.Forms.creature(world, 116, 100); MCW.Forms.creature(world, 175, 100);
    MCW.Forms.character(world, 224, 95);
  }
  function pour(x, y) { if (world.n < MAXN) for (let t = 0; t < 6; t++) world.spawn({ x: x + (Math.random() - 0.5) * 6, y: y + Math.random() * 5, vy: -3, M: 0.5, kind: K.WATER, gScale: 1 }); }
  function toWorld(e) { const r = cv.getBoundingClientRect(); return { x: (e.clientX - r.left) * (cv.width / r.width) / scale, y: H - (e.clientY - r.top) * (cv.height / r.height) / scale }; }
  cv.addEventListener('mousemove', e => { mouse = toWorld(e); });
  cv.addEventListener('mousedown', e => { mouse = toWorld(e); pouring = true; });
  window.addEventListener('mouseup', () => { pouring = false; });
  const bind = (id, fn) => { const el = document.getElementById(id); if (el) el.onclick = fn; };
  bind('bWater', () => pour(mouse.x, mouse.y));
  bind('bRock', () => MCW.Forms.rock(world, mouse.x, 0, { r: 4.5 }));
  bind('bTree', () => MCW.Forms.tree(world, mouse.x));
  bind('bCreature', () => MCW.Forms.creature(world, mouse.x, mouse.y));
  bind('bFire', () => MCW.Forms.fireball(world, mouse.x, mouse.y, { count: 44, temp: 2.2 }));
  bind('bReset', reset);
  function circle(x, y, r) { ctx.beginPath(); ctx.arc(x, y, r, 0, 6.2832); ctx.fill(); }
  function fireColor(T) { const t = Math.min(1, T / 2); return 'rgba(255,' + (90 + t * 150 | 0) + ',' + (t * 60 | 0) + ',0.85)'; }
  const COL = {}; COL[K.ROCK] = '#8b8576'; COL[K.WOOD] = '#7a5630'; COL[K.LEAF] = '#4f9a3e';
  function drawTerrain() {
    ctx.beginPath(); ctx.moveTo(0, cv.height);
    for (let x = 0; x <= W; x += 2) ctx.lineTo(sx(x), sy(world.ground(x)));
    ctx.lineTo(cv.width, cv.height); ctx.closePath(); ctx.fillStyle = '#3a3526'; ctx.fill();
    ctx.beginPath(); for (let x = 0; x <= W; x += 2) { const px = sx(x), py = sy(world.ground(x)); if (x === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py); } ctx.strokeStyle = '#5a8f3c'; ctx.lineWidth = 3; ctx.stroke();
  }
  function draw() {
    const g = ctx.createLinearGradient(0, 0, 0, cv.height); g.addColorStop(0, '#10131c'); g.addColorStop(1, '#161a26'); ctx.fillStyle = g; ctx.fillRect(0, 0, cv.width, cv.height);
    drawTerrain();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < world.n; i++) { if (!world.alive[i] || world.kind[i] !== K.WATER) continue; ctx.fillStyle = 'rgba(50,120,210,0.5)'; circle(sx(world.px[i]), sy(world.py[i]), 4.4); }
    ctx.globalCompositeOperation = 'source-over';
    ctx.lineWidth = 1.6; ctx.beginPath(); ctx.strokeStyle = 'rgba(122,86,48,0.9)';
    for (const b of world.bonds) { if (!world.alive[b.i] || !world.alive[b.j]) continue; if (world.kind[b.i] !== K.WOOD && world.kind[b.i] !== K.LEAF) continue; ctx.moveTo(sx(world.px[b.i]), sy(world.py[b.i])); ctx.lineTo(sx(world.px[b.j]), sy(world.py[b.j])); }
    ctx.stroke();
    ctx.beginPath(); ctx.strokeStyle = 'rgba(150,150,170,0.3)'; ctx.lineWidth = 1;
    for (const b of world.bonds) { if (!world.alive[b.i] || !world.alive[b.j]) continue; if (world.kind[b.i] === K.WOOD || world.kind[b.i] === K.LEAF) continue; ctx.moveTo(sx(world.px[b.i]), sy(world.py[b.i])); ctx.lineTo(sx(world.px[b.j]), sy(world.py[b.j])); }
    ctx.stroke();
    for (let i = 0; i < world.n; i++) {
      if (!world.alive[i]) continue; const k = world.kind[i], x = sx(world.px[i]), y = sy(world.py[i]);
      if (k === K.WATER) continue;
      if (k === K.FIRE) { ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = fireColor(world.T[i]); circle(x, y, 5); ctx.globalCompositeOperation = 'source-over'; continue; }
      if (k === K.CHARACTER) { const f = world.hpMax[i] > 0 ? Math.max(0, world.hp[i] / world.hpMax[i]) : 1; ctx.fillStyle = 'rgb(' + ((0.2 + (1 - f) * 0.7) * 255 | 0) + ',' + ((0.6 + f * 0.3) * 255 | 0) + ',110)'; circle(x, y, 3.4); }
      else if (k === K.CREATURE) { const f = world.hpMax[i] > 0 ? Math.max(0, world.hp[i] / world.hpMax[i]) : 1; ctx.fillStyle = 'rgb(' + (224 * Math.max(0.4, f) | 0) + ',' + (145 * Math.max(0.4, f) | 0) + ',58)'; circle(x, y, 3.3); }
      else if (COL[k]) { ctx.fillStyle = COL[k]; circle(x, y, k === K.ROCK ? 3.3 : 3.0); }
      if (world.T[i] > 0.45) { ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = fireColor(world.T[i]); circle(x, y, 4.6); ctx.globalCompositeOperation = 'source-over'; }  // 가열 글로우
    }
    let nW = 0, nC = 0, nT = 0; for (let i = 0; i < world.n; i++) { if (!world.alive[i]) continue; if (world.kind[i] === K.WATER) nW++; else if (world.kind[i] === K.CREATURE) nC++; else if (world.kind[i] === K.WOOD || world.kind[i] === K.LEAF) nT++; }
    hud.textContent = '물 ' + nW + ' · 나무 ' + nT + ' · 개체 ' + nC + ' · 결합 ' + world.bonds.length;
  }
  function loop() { if (pouring) pour(mouse.x, mouse.y); world.step(0.02); world.step(0.02); world.step(0.02); draw(); requestAnimationFrame(loop); }
  reset(); requestAnimationFrame(loop);
})();
