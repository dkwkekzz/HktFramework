/* UI: 실시간 canvas 렌더 + 컨트롤. 엔진(window.MC)을 그대로 사용. */
(function () {
  const cv = document.getElementById('mc');
  const ctx = cv.getContext('2d');
  const W = 160, H = 100, scale = cv.width / W;
  let world, hero, mouse = { x: 80, y: 50 };
  const hint = '클릭/F = 파이어볼 🔥   ·   L = 벼락 ⚡   ·   C = 사슬갑옷 🛡   ·   R = 리셋';

  function reset() {
    world = new MC.World({ W, H, gravity: 9 });
    hero = MC.Forms.character(world, 26, 46);
    MC.Forms.chainmail(world, 104, 70, { cols: 12, rows: 8 });
  }
  function heroCore() { return (hero && world.alive[hero.core]) ? hero.core : null; }
  function toWorld(e) {
    const r = cv.getBoundingClientRect();
    const mx = (e.clientX - r.left) * (cv.width / r.width);
    const my = (e.clientY - r.top) * (cv.height / r.height);
    return { x: mx / scale, y: H - my / scale };
  }
  function castFire() {
    const c = heroCore(); if (c == null) return;
    MC.Forms.fireball(world, world.px[c], world.py[c], mouse.x, mouse.y, { count: 46, temp: 2.0, speed: 44 });
  }
  function castBolt() { MC.Forms.lightning(world, mouse.x, { dmg: 55 }); }
  function dropMail() { MC.Forms.chainmail(world, mouse.x, Math.min(mouse.y + 16, H - 2), { cols: 10, rows: 7 }); }
  function spawnHero() { if (heroCore() == null) hero = MC.Forms.character(world, 26, 46); }

  cv.addEventListener('mousemove', e => { mouse = toWorld(e); });
  cv.addEventListener('mousedown', e => { mouse = toWorld(e); castFire(); });
  window.addEventListener('keydown', e => {
    const k = e.key.toLowerCase();
    if (k === 'f') castFire(); else if (k === 'l') castBolt();
    else if (k === 'c') dropMail(); else if (k === 'r') reset();
  });
  const bind = (id, fn) => { const el = document.getElementById(id); if (el) el.onclick = fn; };
  bind('bHero', spawnHero); bind('bFire', castFire); bind('bBolt', castBolt);
  bind('bMail', dropMail); bind('bReset', reset);

  function fireColor(T) {
    const t = Math.max(0, Math.min(1, T / 2));
    const r = Math.min(255, 120 + t * 135) | 0;
    const g = Math.min(255, t * 235) | 0;
    const b = Math.min(255, Math.max(0, (t - 0.6) * 380)) | 0;
    return 'rgb(' + r + ',' + g + ',' + b + ')';
  }
  function charColor(i) {
    const f = world.hpMax[i] > 0 ? Math.max(0, world.hp[i] / world.hpMax[i]) : 1;
    const r = Math.round(40 + (1 - f) * 205), g = Math.round(70 + f * 90), b = 80;
    return 'rgb(' + r + ',' + g + ',' + b + ')';
  }
  function circle(x, y, r) { ctx.beginPath(); ctx.arc(x, y, r, 0, 6.2832); ctx.fill(); }

  function draw() {
    ctx.fillStyle = '#0d0d14'; ctx.fillRect(0, 0, cv.width, cv.height);
    const sx = x => x * scale, sy = y => (H - y) * scale;
    ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(120,122,140,0.35)';
    ctx.beginPath();
    for (const b of world.bonds) {
      if (!world.alive[b.i] || !world.alive[b.j]) continue;
      ctx.moveTo(sx(world.px[b.i]), sy(world.py[b.i]));
      ctx.lineTo(sx(world.px[b.j]), sy(world.py[b.j]));
    }
    ctx.stroke();
    for (let i = 0; i < world.n; i++) {
      if (!world.alive[i]) continue;
      const k = world.kind[i], x = sx(world.px[i]), y = sy(world.py[i]);
      if (k === MC.KIND.FIRE) { ctx.globalAlpha = 0.85; ctx.fillStyle = fireColor(world.T[i]); circle(x, y, 6); ctx.globalAlpha = 1; }
      else if (k === MC.KIND.CHARACTER) { ctx.fillStyle = charColor(i); circle(x, y, 4.5); }
      else if (k === MC.KIND.ARMOR) { ctx.fillStyle = world.T[i] > 0.4 ? fireColor(world.T[i]) : '#9aa0a6'; circle(x, y, 3.5); }
      else if (k === MC.KIND.LIGHTNING) { ctx.fillStyle = '#e9e6ff'; circle(x, y, 2.2); }
    }
    for (const bolt of world.bolts) {
      const a = bolt.life / bolt.maxlife;
      ctx.strokeStyle = 'rgba(190,182,245,' + a + ')'; ctx.lineWidth = 2.2;
      ctx.shadowColor = '#bcb6f5'; ctx.shadowBlur = 12; ctx.beginPath();
      for (const s of bolt.segs) { ctx.moveTo(sx(s[0]), sy(s[1])); ctx.lineTo(sx(s[2]), sy(s[3])); }
      ctx.stroke(); ctx.shadowBlur = 0;
    }
    // HUD
    let alive = 0; for (let i = 0; i < world.n; i++) if (world.alive[i]) alive++;
    ctx.fillStyle = '#cfcabf'; ctx.font = '13px sans-serif'; ctx.textAlign = 'left';
    ctx.fillText(hint, 12, cv.height - 12);
    ctx.fillText('units ' + alive + '   bonds ' + world.bonds.length, 12, 20);
    const c = heroCore();
    if (c != null) {
      const f = Math.max(0, world.hp[c] / world.hpMax[c]);
      ctx.fillStyle = '#2a2a32'; ctx.fillRect(12, 28, 160, 11);
      ctx.fillStyle = f > 0.5 ? '#1D9E75' : (f > 0.25 ? '#EF9F27' : '#E24B4A');
      ctx.fillRect(12, 28, 160 * f, 11);
      ctx.fillStyle = '#cfcabf'; ctx.fillText('HP ' + Math.max(0, world.hp[c]).toFixed(0), 180, 38);
    } else {
      ctx.fillStyle = '#E24B4A'; ctx.fillText('캐릭터 쓰러짐 — [캐릭터 소환] 또는 R', 180, 38);
    }
  }

  let last = performance.now();
  function loop(now) {
    last = now;
    world.step(0.04); world.step(0.04);
    draw();
    requestAnimationFrame(loop);
  }
  reset(); requestAnimationFrame(loop);
})();
