/* microcosm 3D engine - 통합 기질의 3D 포팅. 규칙은 동일, 차원만 3D.
   dx/dt = f(x) + Σ W·g + I - γx,  x ∈ R^3.  Node와 브라우저 양쪽 동작. */
(function (global) {
  'use strict';
  const KIND = { VOID: 0, CHARACTER: 1, FIRE: 2, LIGHTNING: 3, ARMOR: 4 };

  function ptSeg3(px, py, pz, ax, ay, az, bx, by, bz) {
    let dx = bx - ax, dy = by - ay, dz = bz - az, L2 = dx * dx + dy * dy + dz * dz;
    let t = L2 > 0 ? ((px - ax) * dx + (py - ay) * dy + (pz - az) * dz) / L2 : 0;
    t = Math.max(0, Math.min(1, t));
    let cx = ax + t * dx, cy = ay + t * dy, cz = az + t * dz;
    let ex = px - cx, ey = py - cy, ez = pz - cz;
    return ex * ex + ey * ey + ez * ez;
  }

  class World {
    constructor(opts = {}) {
      this.W = opts.W || 160; this.H = opts.H || 100; this.D = opts.D || 160;
      this.gravity = opts.gravity != null ? opts.gravity : 9.0;
      this.cap = opts.cap || 4000; const c = this.cap;
      this.px = new Float64Array(c); this.py = new Float64Array(c); this.pz = new Float64Array(c);
      this.vx = new Float64Array(c); this.vy = new Float64Array(c); this.vz = new Float64Array(c);
      this.fx = new Float64Array(c); this.fy = new Float64Array(c); this.fz = new Float64Array(c);
      this.T = new Float64Array(c); this.dT = new Float64Array(c);
      this.M = new Float64Array(c); this.hp = new Float64Array(c); this.hpMax = new Float64Array(c);
      this.gScale = new Float64Array(c); this.homeoT = new Float64Array(c);
      this.kind = new Int32Array(c); this.fixed = new Uint8Array(c);
      this.homeo = new Uint8Array(c); this.alive = new Uint8Array(c);
      this.n = 0; this.bonds = []; this.bolts = []; this.time = 0;
    }
    spawn(o) {
      const i = this.n++;
      this.px[i] = o.x; this.py[i] = o.y; this.pz[i] = o.z || 0;
      this.vx[i] = o.vx || 0; this.vy[i] = o.vy || 0; this.vz[i] = o.vz || 0;
      this.T[i] = o.T || 0; this.M[i] = o.M || 1; this.kind[i] = o.kind || 0;
      this.fixed[i] = o.fixed ? 1 : 0; this.gScale[i] = o.gScale || 0; this.alive[i] = 1;
      this.hp[i] = o.hp || 0; this.hpMax[i] = o.hp || 0;
      if (o.homeoT != null) { this.homeo[i] = 1; this.homeoT[i] = o.homeoT; }
      return i;
    }
    addBond(i, j, k, rest) {
      if (rest == null) rest = Math.hypot(this.px[i] - this.px[j], this.py[i] - this.py[j], this.pz[i] - this.pz[j]);
      this.bonds.push({ i, j, rest, k });
    }
    killUnit(i) { this.alive[i] = 0; this.kind[i] = KIND.VOID; this.bonds = this.bonds.filter(b => b.i !== i && b.j !== i); }
    step(dt) {
      const n = this.n;
      for (let i = 0; i < n; i++) { this.fx[i] = 0; this.fy[i] = 0; this.fz[i] = 0; this.dT[i] = 0; }
      const rTh2 = 49, diff = 0.16, rRep2 = 9, repK = 90;
      for (let i = 0; i < n; i++) { if (!this.alive[i]) continue;
        for (let j = i + 1; j < n; j++) { if (!this.alive[j]) continue;
          let dx = this.px[j] - this.px[i], dy = this.py[j] - this.py[i], dz = this.pz[j] - this.pz[i];
          let d2 = dx * dx + dy * dy + dz * dz;
          if (d2 > rTh2) continue;
          let dTji = diff * (this.T[j] - this.T[i]); this.dT[i] += dTji; this.dT[j] -= dTji;
          if (d2 < rRep2) { let d = Math.sqrt(d2) + 1e-9, f = repK * (3 - d) / 3 / d;
            this.fx[i] -= f * dx; this.fy[i] -= f * dy; this.fz[i] -= f * dz;
            this.fx[j] += f * dx; this.fy[j] += f * dy; this.fz[j] += f * dz; }
        } }
      const buoy = 26, buoyThr = 0.3, cool = 0.5, dragC = 0.35, homeoG = 2.5;
      for (let i = 0; i < n; i++) { if (!this.alive[i]) continue;
        this.fy[i] += buoy * Math.max(this.T[i] - buoyThr, 0);
        this.fy[i] -= this.gravity * this.gScale[i] * this.M[i];
        this.dT[i] -= cool * this.T[i];
        if (this.homeo[i]) this.dT[i] += homeoG * (this.homeoT[i] - this.T[i]);
        this.fx[i] -= dragC * this.vx[i]; this.fy[i] -= dragC * this.vy[i]; this.fz[i] -= dragC * this.vz[i]; }
      const meltT = 0.85, stretch = 2.3, dampB = 0.5, keep = [];
      for (const b of this.bonds) { const i = b.i, j = b.j;
        let dx = this.px[j] - this.px[i], dy = this.py[j] - this.py[i], dz = this.pz[j] - this.pz[i];
        let L = Math.hypot(dx, dy, dz) + 1e-9, ux = dx / L, uy = dy / L, uz = dz / L;
        if (0.5 * (this.T[i] + this.T[j]) > meltT || L > b.rest * stretch) continue;
        let f = b.k * (L - b.rest);
        f += dampB * ((this.vx[j] - this.vx[i]) * ux + (this.vy[j] - this.vy[i]) * uy + (this.vz[j] - this.vz[i]) * uz);
        this.fx[i] += f * ux; this.fy[i] += f * uy; this.fz[i] += f * uz;
        this.fx[j] -= f * ux; this.fy[j] -= f * uy; this.fz[j] -= f * uz; keep.push(b); }
      this.bonds = keep;
      for (let i = 0; i < n; i++) { if (!this.alive[i]) continue;
        if (this.fixed[i]) { this.vx[i] = 0; this.vy[i] = 0; this.vz[i] = 0; }
        else { this.vx[i] += this.fx[i] / this.M[i] * dt; this.vy[i] += this.fy[i] / this.M[i] * dt; this.vz[i] += this.fz[i] / this.M[i] * dt;
          this.px[i] += this.vx[i] * dt; this.py[i] += this.vy[i] * dt; this.pz[i] += this.vz[i] * dt; }
        this.T[i] = Math.max(0, this.T[i] + this.dT[i] * dt);
        if (this.px[i] < 0) { this.px[i] = 0; this.vx[i] *= -0.5; } if (this.px[i] > this.W) { this.px[i] = this.W; this.vx[i] *= -0.5; }
        if (this.py[i] < 0) { this.py[i] = 0; this.vy[i] *= -0.5; } if (this.py[i] > this.H) { this.py[i] = this.H; this.vy[i] *= -0.5; }
        if (this.pz[i] < 0) { this.pz[i] = 0; this.vz[i] *= -0.5; } if (this.pz[i] > this.D) { this.pz[i] = this.D; this.vz[i] *= -0.5; } }
      const burnK = 22, burnThr = 0.5;
      for (let i = 0; i < n; i++) { if (!this.alive[i]) continue; const kd = this.kind[i];
        if (kd === KIND.FIRE) { if (this.T[i] < 0.16) this.killUnit(i); continue; }
        if (kd === KIND.LIGHTNING) { if (this.T[i] < 0.2) this.killUnit(i); continue; }
        if (this.hpMax[i] > 0 && this.T[i] > burnThr) { this.hp[i] -= burnK * (this.T[i] - burnThr) * dt; if (this.hp[i] <= 0) this.killUnit(i); } }
      for (const bolt of this.bolts) bolt.life -= dt;
      this.bolts = this.bolts.filter(b => b.life > 0); this.time += dt;
    }
  }

  const Forms = {
    character(w, cx, cy, cz, opt = {}) {
      const ns = opt.n || 16, radius = opt.radius || 5, temp = 0.12, k = 18, hp = opt.hp || 100;
      const core = w.spawn({ x: cx, y: cy, z: cz, T: temp, M: 1.6, kind: KIND.CHARACTER, homeoT: temp, hp });
      const pts = [];
      for (let i = 0; i < ns; i++) {                       // 피보나치 구 분포
        const phi = Math.acos(1 - 2 * (i + 0.5) / ns), theta = Math.PI * (1 + Math.sqrt(5)) * i;
        pts.push(w.spawn({ x: cx + radius * Math.sin(phi) * Math.cos(theta), y: cy + radius * Math.cos(phi),
          z: cz + radius * Math.sin(phi) * Math.sin(theta), T: temp, M: 1, kind: KIND.CHARACTER, homeoT: temp, hp }));
      }
      for (const i of pts) w.addBond(core, i, k);
      for (let a = 0; a < pts.length; a++) {               // 가까운 3개와 결합 -> 구 껍질
        const da = [];
        for (let b = 0; b < pts.length; b++) { if (a === b) continue;
          const dx = w.px[pts[a]] - w.px[pts[b]], dy = w.py[pts[a]] - w.py[pts[b]], dz = w.pz[pts[a]] - w.pz[pts[b]];
          da.push([dx * dx + dy * dy + dz * dz, b]); }
        da.sort((p, q) => p[0] - q[0]);
        for (let t = 0; t < 3; t++) { const b = da[t][1]; if (b > a) w.addBond(pts[a], pts[b], k); }
      }
      return { core, units: [core, ...pts] };
    },
    fireball(w, ox, oy, oz, tx, ty, tz, opt = {}) {
      const speed = opt.speed || 40, count = opt.count || 46, spread = opt.spread || 2.2, temp = opt.temp || 2.0;
      let dx = tx - ox, dy = ty - oy, dz = tz - oz, d = Math.hypot(dx, dy, dz) + 1e-9; dx /= d; dy /= d; dz /= d;
      const units = [];
      for (let c = 0; c < count; c++) units.push(w.spawn({
        x: ox + (Math.random() - 0.5) * spread * 2, y: oy + (Math.random() - 0.5) * spread * 2, z: oz + (Math.random() - 0.5) * spread * 2,
        vx: dx * speed + (Math.random() - 0.5) * 8, vy: dy * speed + (Math.random() - 0.5) * 8, vz: dz * speed + (Math.random() - 0.5) * 8,
        T: temp * (0.7 + Math.random() * 0.6), M: 0.5, kind: KIND.FIRE }));
      return { units };
    },
    lightning(w, tx, tz, opt = {}) {
      const topY = w.H - 2, groundY = opt.groundY || 4, step = opt.step || 4, branch = 0.2, temp = 2.4, maxP = opt.maxP || 150, maxB = 6;
      const segs = [], units = []; let stack = [[tx, topY, tz]], budget = maxP;
      while (stack.length && budget > 0) { let [x, y, z] = stack.pop();
        while (y > groundY && budget > 0) { budget--;
          let nx = x + (Math.random() - 0.5) * step * 1.4, nz = z + (Math.random() - 0.5) * step * 1.4, ny = y - step * (0.7 + Math.random() * 0.6);
          segs.push([x, y, z, nx, ny, nz]); units.push(w.spawn({ x, y, z, T: temp * (0.8 + Math.random() * 0.4), M: 0.3, kind: KIND.LIGHTNING, fixed: true }));
          if (Math.random() < branch && y > groundY + step * 3 && stack.length < maxB) stack.push([x, y, z]);
          x = nx; y = ny; z = nz; } }
      const boltDmg = opt.dmg || 55, hitR2 = (opt.hitR || 7) ** 2;
      for (let i = 0; i < w.n; i++) { if (!w.alive[i] || w.kind[i] === KIND.LIGHTNING) continue; let near = false;
        for (const s of segs) { if (ptSeg3(w.px[i], w.py[i], w.pz[i], s[0], s[1], s[2], s[3], s[4], s[5]) < hitR2) { near = true; break; } }
        if (near) { w.T[i] += 1.4; if (w.hpMax[i] > 0) { w.hp[i] -= boltDmg; if (w.hp[i] <= 0) w.killUnit(i); } } }
      w.bolts.push({ segs, life: 0.5, maxlife: 0.5 }); return { units, segs };
    },
    chainmail(w, cx, topY, cz, opt = {}) {        // x-y 평면 수직 시트
      const cols = opt.cols || 12, rows = opt.rows || 9, sp = opt.spacing || 4, k = 45, hp = opt.hp || 40, ox = cx - (cols - 1) * sp / 2, grid = [];
      for (let r = 0; r < rows; r++) { grid.push([]);
        for (let c = 0; c < cols; c++) { const fixed = (r === 0 && (c === 0 || c === cols - 1));
          grid[r].push(w.spawn({ x: ox + c * sp, y: topY - r * sp, z: cz, M: 0.8, kind: KIND.ARMOR, gScale: 1, fixed, hp })); } }
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
        if (c + 1 < cols) w.addBond(grid[r][c], grid[r][c + 1], k);
        if (r + 1 < rows) w.addBond(grid[r][c], grid[r + 1][c], k); }
      return { grid };
    }
  };

  global.MC3 = { KIND, World, Forms, ptSeg3 };
  if (typeof module !== 'undefined' && module.exports) module.exports = global.MC3;
})(typeof window !== 'undefined' ? window : globalThis);
