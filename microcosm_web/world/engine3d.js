/* engine3d.js — microcosm 통합 기질의 3D 포팅. 규칙은 동일, 차원만 R^3.
 *
 *     ẋ_i = f(x_i) + Σ_j W_ij g(x_i, x_j) + I_i − γ x_i,   x ∈ R^3
 *
 * 2D(engine.js)와 장·결합·상호작용 로직이 같다 — 규칙이 차원에 무관하다는 증거.
 * 지형은 높이장 h(x,z), 중력·부력은 y축. DOM 비의존 → Node 로 검증 가능.
 */
(function (global) {
  'use strict';

  const KIND = {
    VOID: 0, CHARACTER: 1, FIRE: 2, LIGHTNING: 3, ARMOR: 4,
    WATER: 5, ROCK: 6, WOOD: 7, LEAF: 8, CREATURE: 9, ICE: 10,
  };

  class World {
    constructor(o = {}) {
      this.W = o.W || 200; this.H = o.H || 130; this.D = o.D || 200;
      this.gravity = o.gravity != null ? o.gravity : 16;
      this.cap = o.cap || 9000;
      const c = this.cap;
      this.px = new Float64Array(c); this.py = new Float64Array(c); this.pz = new Float64Array(c);
      this.vx = new Float64Array(c); this.vy = new Float64Array(c); this.vz = new Float64Array(c);
      this.fx = new Float64Array(c); this.fy = new Float64Array(c); this.fz = new Float64Array(c);
      this.T = new Float64Array(c); this.dT = new Float64Array(c);
      this.M = new Float64Array(c); this.hp = new Float64Array(c); this.hpMax = new Float64Array(c);
      this.gScale = new Float64Array(c); this.homeoT = new Float64Array(c);
      this.kind = new Int32Array(c); this.fixed = new Uint8Array(c);
      this.homeo = new Uint8Array(c); this.alive = new Uint8Array(c);
      this.n = 0;
      this.bonds = []; this.bolts = []; this.agents = [];
      this.time = 0; this.entropyOut = 0;
      this.ground = (x, z) => 24;   // 높이장 h(x,z)
    }

    groundGrad(x, z) {
      return [this.ground(x + 0.5, z) - this.ground(x - 0.5, z),
              this.ground(x, z + 0.5) - this.ground(x, z - 0.5)];
    }

    spawn(o) {
      const i = this.n++;
      this.px[i] = o.x; this.py[i] = o.y; this.pz[i] = o.z || 0;
      this.vx[i] = o.vx || 0; this.vy[i] = o.vy || 0; this.vz[i] = o.vz || 0;
      this.T[i] = o.T || 0; this.M[i] = o.M || 1;
      this.kind[i] = o.kind || 0; this.fixed[i] = o.fixed ? 1 : 0;
      this.gScale[i] = o.gScale != null ? o.gScale : 0;
      this.alive[i] = 1; this.hp[i] = o.hp || 0; this.hpMax[i] = o.hp || 0;
      if (o.homeoT != null) { this.homeo[i] = 1; this.homeoT[i] = o.homeoT; }
      return i;
    }

    addBond(i, j, k, rest, melt) {
      if (rest == null) rest = Math.hypot(this.px[i] - this.px[j], this.py[i] - this.py[j], this.pz[i] - this.pz[j]);
      this.bonds.push({ i, j, rest, k, melt: melt != null ? melt : 0.85 });
    }

    killUnit(i) {
      this.alive[i] = 0; this.kind[i] = KIND.VOID;
      this.bonds = this.bonds.filter((b) => b.i !== i && b.j !== i);
    }

    // 벼락: 위에서 지면까지 3D 프랙탈 하향 분기. 경로 인접 단위에 가열 + HP 피해.
    strikeLightning(tx, tz) {
      const segs = [];
      const gy = this.ground(tx, tz);
      const stack = [[tx + (Math.random() - 0.5) * 6, this.H, tz + (Math.random() - 0.5) * 6]];
      let budget = 160, branches = 0;
      while (stack.length && budget > 0) {
        let [x, y, z] = stack.pop();
        while (y > gy + 1 && budget > 0) {
          budget--;
          const nx = x + (Math.random() - 0.5) * 8, nz = z + (Math.random() - 0.5) * 8, ny = y - (2.5 + Math.random() * 3.5);
          segs.push([x, y, z, nx, ny, nz]);
          if (Math.random() < 0.16 && branches < 5 && y > gy + 12) { stack.push([x, y, z]); branches++; }
          x = nx; y = ny; z = nz;
        }
      }
      this.bolts.push({ segs, life: 0.4 });
      const hitR2 = 49;
      for (let i = 0; i < this.n; i++) {
        if (!this.alive[i]) continue;
        for (const s of segs) {
          if (ptSeg2(this.px[i], this.py[i], this.pz[i], s) < hitR2) {
            this.T[i] += 1.6;
            if (this.hpMax[i] > 0) { this.hp[i] -= 34; if (this.hp[i] <= 0) this.killUnit(i); }
            break;
          }
        }
      }
      return segs;
    }

    step(dt) {
      const n = this.n;
      for (let i = 0; i < n; i++) { this.fx[i] = 0; this.fy[i] = 0; this.fz[i] = 0; this.dT[i] = 0; }
      for (const a of this.agents) if (a.update) a.update(this, dt);

      // 쌍 상호작용: 열확산 + 단거리 반발 + 물-물 응집
      const rTh2 = 49, diff = 0.2, rRep = 3, rRep2 = 9, repK = 120,
            rCoh = 6.5, rCoh2 = 42.25, cohK = 16, WATER = KIND.WATER;
      for (let i = 0; i < n; i++) {
        if (!this.alive[i]) continue;
        for (let j = i + 1; j < n; j++) {
          if (!this.alive[j]) continue;
          const dx = this.px[j] - this.px[i], dy = this.py[j] - this.py[i], dz = this.pz[j] - this.pz[i], d2 = dx * dx + dy * dy + dz * dz;
          const ww = this.kind[i] === WATER && this.kind[j] === WATER;
          if (d2 > rTh2 && !(ww && d2 < rCoh2)) continue;
          const d = Math.sqrt(d2) + 1e-9;
          if (d2 <= rTh2) { const t = diff * (this.T[j] - this.T[i]); this.dT[i] += t; this.dT[j] -= t; }
          if (d2 < rRep2) { const f = repK * (rRep - d) / rRep / d; this.fx[i] -= f * dx; this.fy[i] -= f * dy; this.fz[i] -= f * dz; this.fx[j] += f * dx; this.fy[j] += f * dy; this.fz[j] += f * dz; }
          if (ww && d2 < rCoh2 && d > rRep) { const f = cohK * (rCoh - d) / rCoh / d; this.fx[i] += f * dx; this.fy[i] += f * dy; this.fz[i] += f * dz; this.fx[j] -= f * dx; this.fy[j] -= f * dy; this.fz[j] -= f * dz; }
        }
      }

      // 자체동역학 + 흐름 + 소산
      const buoy = 5, buoyThr = 0.3, cool = 0.5, dragC = 0.85, homeoG = 2.5;
      for (let i = 0; i < n; i++) {
        if (!this.alive[i]) continue;
        this.fy[i] += buoy * Math.max(this.T[i] - buoyThr, 0);
        this.fy[i] -= this.gravity * this.gScale[i] * this.M[i];
        const coolAmt = cool * this.T[i];
        this.dT[i] -= coolAmt; this.entropyOut += coolAmt * dt;
        if (this.homeo[i]) this.dT[i] += homeoG * (this.homeoT[i] - this.T[i]);
        this.fx[i] -= dragC * this.vx[i]; this.fy[i] -= dragC * this.vy[i]; this.fz[i] -= dragC * this.vz[i];
      }

      // 구조 결합
      const stretch = 2.3, dampB = 1.4, keep = [];
      for (const b of this.bonds) {
        const i = b.i, j = b.j;
        const dx = this.px[j] - this.px[i], dy = this.py[j] - this.py[i], dz = this.pz[j] - this.pz[i],
              L = Math.hypot(dx, dy, dz) + 1e-9, ux = dx / L, uy = dy / L, uz = dz / L;
        if (0.5 * (this.T[i] + this.T[j]) > b.melt || L > b.rest * stretch) continue;
        let f = b.k * (L - b.rest);
        f += dampB * ((this.vx[j] - this.vx[i]) * ux + (this.vy[j] - this.vy[i]) * uy + (this.vz[j] - this.vz[i]) * uz);
        this.fx[i] += f * ux; this.fy[i] += f * uy; this.fz[i] += f * uz;
        this.fx[j] -= f * ux; this.fy[j] -= f * uy; this.fz[j] -= f * uz;
        keep.push(b);
      }
      this.bonds = keep;

      // 지형 지지력 + 마찰 (3D 법선)
      const kSup = 360, nDamp = 13, fric = 6.0;
      for (let i = 0; i < n; i++) {
        if (!this.alive[i] || this.fixed[i]) continue;
        const h = this.ground(this.px[i], this.pz[i]), pen = h - this.py[i];
        if (pen > 0) {
          const g = this.groundGrad(this.px[i], this.pz[i]);
          const nl = Math.hypot(-g[0], 1, -g[1]), nx = -g[0] / nl, ny = 1 / nl, nz = -g[1] / nl;
          this.fx[i] += kSup * pen * nx; this.fy[i] += kSup * pen * ny; this.fz[i] += kSup * pen * nz;
          const vn = this.vx[i] * nx + this.vy[i] * ny + this.vz[i] * nz;
          this.fx[i] -= nDamp * vn * nx; this.fy[i] -= nDamp * vn * ny; this.fz[i] -= nDamp * vn * nz;
          // 접선 속도 마찰
          const tvx = this.vx[i] - vn * nx, tvy = this.vy[i] - vn * ny, tvz = this.vz[i] - vn * nz;
          this.fx[i] -= fric * tvx; this.fy[i] -= fric * tvy; this.fz[i] -= fric * tvz;
        }
      }

      // 적분 + 경계 반사
      for (let i = 0; i < n; i++) {
        if (!this.alive[i]) continue;
        if (this.fixed[i]) { this.vx[i] = 0; this.vy[i] = 0; this.vz[i] = 0; }
        else {
          this.vx[i] += this.fx[i] / this.M[i] * dt; this.vy[i] += this.fy[i] / this.M[i] * dt; this.vz[i] += this.fz[i] / this.M[i] * dt;
          this.px[i] += this.vx[i] * dt; this.py[i] += this.vy[i] * dt; this.pz[i] += this.vz[i] * dt;
        }
        this.T[i] = Math.max(0, this.T[i] + this.dT[i] * dt);
        if (this.px[i] < 0) { this.px[i] = 0; this.vx[i] *= -0.5; } if (this.px[i] > this.W) { this.px[i] = this.W; this.vx[i] *= -0.5; }
        if (this.py[i] < 0) { this.py[i] = 0; this.vy[i] *= -0.5; } if (this.py[i] > this.H) { this.py[i] = this.H; this.vy[i] *= -0.5; }
        if (this.pz[i] < 0) { this.pz[i] = 0; this.vz[i] *= -0.5; } if (this.pz[i] > this.D) { this.pz[i] = this.D; this.vz[i] *= -0.5; }
      }

      // 종류별 소멸/연소
      const burnK = 22, burnThr = 0.5;
      for (let i = 0; i < n; i++) {
        if (!this.alive[i]) continue;
        const kd = this.kind[i];
        if (kd === KIND.FIRE) { if (this.T[i] < 0.16) this.killUnit(i); continue; }
        if (kd === KIND.LIGHTNING) { if (this.T[i] < 0.2) this.killUnit(i); continue; }
        if (kd === KIND.ICE) { if (this.T[i] > 0.4) this.killUnit(i); continue; }
        if (this.hpMax[i] > 0 && this.T[i] > burnThr) { this.hp[i] -= burnK * (this.T[i] - burnThr) * dt; if (this.hp[i] <= 0) this.killUnit(i); }
      }

      for (const bolt of this.bolts) bolt.life -= dt;
      this.bolts = this.bolts.filter((b) => b.life > 0);
      this.time += dt;
    }

    metrics() {
      let alive = 0, water = 0, life = 0, trees = 0, heat = 0;
      let sumX = 0, sumY = 0, sumZ = 0, moving = 0;
      for (let i = 0; i < this.n; i++) {
        if (!this.alive[i]) continue;
        alive++; const k = this.kind[i]; heat += this.T[i];
        if (k === KIND.WATER) water++;
        else if (k === KIND.CREATURE || k === KIND.CHARACTER) {
          life++;
          const sp = Math.hypot(this.vx[i], this.vy[i], this.vz[i]);
          if (sp > 0.05) { sumX += this.vx[i] / sp; sumY += this.vy[i] / sp; sumZ += this.vz[i] / sp; moving++; }
        } else if (k === KIND.WOOD || k === KIND.LEAF) trees++;
      }
      const order = moving > 0 ? Math.hypot(sumX, sumY, sumZ) / moving : 0;
      return { alive, water, life, trees, heat, bonds: this.bonds.length, order, entropyOut: this.entropyOut, time: this.time };
    }
  }

  // 점-선분 거리² (3D)
  function ptSeg2(px, py, pz, s) {
    const ax = s[0], ay = s[1], az = s[2], bx = s[3], by = s[4], bz = s[5];
    const dx = bx - ax, dy = by - ay, dz = bz - az, L2 = dx * dx + dy * dy + dz * dz;
    let t = L2 > 0 ? ((px - ax) * dx + (py - ay) * dy + (pz - az) * dz) / L2 : 0;
    t = Math.max(0, Math.min(1, t));
    const ex = px - (ax + t * dx), ey = py - (ay + t * dy), ez = pz - (az + t * dz);
    return ex * ex + ey * ey + ez * ez;
  }

  const Forms = {
    terrain(w) {
      w.ground = (x, z) =>
        24 + 9 * Math.sin(x * 0.018 + 1.0) + 7 * Math.sin(z * 0.021 + 0.4)
           + 4 * Math.sin((x + z) * 0.04) + 3 * Math.sin(x * 0.05 - z * 0.03);
      return { ground: w.ground };
    },

    water(w, cx, cz, count = 70, spread = 14, topY = null) {
      const y0 = topY != null ? topY : w.ground(cx, cz) + 30, units = [];
      for (let c = 0; c < count; c++)
        units.push(w.spawn({ x: cx + (Math.random() - 0.5) * spread, z: cz + (Math.random() - 0.5) * spread, y: y0 + Math.random() * 10, vy: -2, M: 0.5, kind: KIND.WATER, gScale: 1 }));
      return { units };
    },

    character(w, cx, cy, cz, opt = {}) {
      const ns = opt.n || 14, radius = opt.radius || 4, temp = 0.12, k = 26, hp = opt.hp || 100;
      cy = Math.max(cy, w.ground(cx, cz) + 6);
      const core = w.spawn({ x: cx, y: cy, z: cz, T: temp, M: 1.4, kind: KIND.CHARACTER, homeoT: temp, hp, gScale: 1 });
      const pts = [core];
      for (let i = 0; i < ns; i++) {
        const phi = Math.acos(1 - 2 * (i + 0.5) / ns), theta = Math.PI * (1 + Math.sqrt(5)) * i;
        pts.push(w.spawn({ x: cx + radius * Math.sin(phi) * Math.cos(theta), y: cy + radius * Math.cos(phi), z: cz + radius * Math.sin(phi) * Math.sin(theta), T: temp, M: 1, kind: KIND.CHARACTER, homeoT: temp, hp, gScale: 1 }));
      }
      shellBond(w, pts, k);
      return { core, units: pts };
    },

    creature(w, cx, cy, cz, opt = {}) {
      const ns = 12, radius = 3.4, temp = 0.12, k = 28, hp = 80;
      cy = Math.max(cy, w.ground(cx, cz) + 6);
      const core = w.spawn({ x: cx, y: cy, z: cz, T: temp, M: 1.1, kind: KIND.CREATURE, homeoT: temp, hp, gScale: 1 });
      const pts = [core];
      for (let i = 0; i < ns; i++) {
        const phi = Math.acos(1 - 2 * (i + 0.5) / ns), theta = Math.PI * (1 + Math.sqrt(5)) * i;
        pts.push(w.spawn({ x: cx + radius * Math.sin(phi) * Math.cos(theta), y: cy + radius * Math.cos(phi), z: cz + radius * Math.sin(phi) * Math.sin(theta), T: temp, M: 0.8, kind: KIND.CREATURE, homeoT: temp, hp, gScale: 1 }));
      }
      shellBond(w, pts, k);
      const ctrl = {
        units: pts, core, tx: cx, tz: cz, speed: opt.speed || 10, t: 0, hop: 1 + Math.random(),
        update(w, dt) {
          if (!w.alive[this.core]) return;
          this.t -= dt;
          const dx = this.tx - w.px[this.core], dz = this.tz - w.pz[this.core];
          if (this.t <= 0 || dx * dx + dz * dz < 64) { this.tx = 20 + Math.random() * (w.W - 40); this.tz = 20 + Math.random() * (w.D - 40); this.t = 2.5 + Math.random() * 3; }
          const L = Math.hypot(dx, dz) + 1e-9, dvx = dx / L * this.speed, dvz = dz / L * this.speed;
          for (const i of this.units) if (w.alive[i]) { w.fx[i] += 3.0 * (dvx - w.vx[i]); w.fz[i] += 3.0 * (dvz - w.vz[i]); }
          this.hop -= dt;
          if (this.hop <= 0) { this.hop = 1.6 + Math.random() * 1.4; for (const i of this.units) if (w.alive[i]) w.vy[i] += 5; }
        },
      };
      w.agents.push(ctrl);
      return ctrl;
    },

    rock(w, cx, cz, opt = {}) {
      const r = opt.r || 5, sp = 2.4, units = [], cy = w.ground(cx, cz) + r;
      for (let yy = -r; yy <= r; yy += sp) for (let xx = -r; xx <= r; xx += sp) for (let zz = -r; zz <= r; zz += sp)
        if (xx * xx + yy * yy + zz * zz <= r * r) units.push(w.spawn({ x: cx + xx, y: cy + yy, z: cz + zz, M: 1.2, kind: KIND.ROCK, gScale: 1, hp: 0 }));
      for (let a = 0; a < units.length; a++) for (let b = a + 1; b < units.length; b++) {
        const dx = w.px[units[a]] - w.px[units[b]], dy = w.py[units[a]] - w.py[units[b]], dz = w.pz[units[a]] - w.pz[units[b]];
        if (dx * dx + dy * dy + dz * dz < 4.8 * 4.8) w.addBond(units[a], units[b], 430, null, 9);
      }
      return { units };
    },

    // 나무: 3각 트러스 기둥(상호 결합) + 넓은 고정 뿌리 + 분기/잎. 불에 융해→붕괴.
    tree(w, baseX, baseZ, opt = {}) {
      const baseY = w.ground(baseX, baseZ), segs = opt.segs || 6, seg = opt.seg || 4.2, rad = 1.8, k = 150, mt = 0.6, hp = 40;
      const rings = [], leaves = [];
      for (let s = 0; s <= segs; s++) {
        const y = baseY + s * seg, fx = s === 0, ring = [];
        for (let a = 0; a < 3; a++) {
          const ang = 2 * Math.PI * a / 3;
          ring.push(w.spawn({ x: baseX + rad * Math.cos(ang), y, z: baseZ + rad * Math.sin(ang), M: 0.7, kind: KIND.WOOD, gScale: 1, fixed: fx, hp }));
        }
        for (let a = 0; a < 3; a++) w.addBond(ring[a], ring[(a + 1) % 3], k, null, mt);
        if (s > 0) {
          const p = rings[s - 1];
          for (let a = 0; a < 3; a++) { w.addBond(p[a], ring[a], k, null, mt); w.addBond(p[a], ring[(a + 1) % 3], k * 0.7, null, mt); }
        }
        rings.push(ring);
      }
      // 넓은 고정 뿌리 4방향
      for (const [dx, dz] of [[-5, 0], [5, 0], [0, -5], [0, 5]]) {
        const rt = w.spawn({ x: baseX + dx, y: baseY, z: baseZ + dz, M: 0.8, kind: KIND.WOOD, gScale: 1, fixed: true, hp });
        for (let a = 0; a < 3; a++) w.addBond(rt, rings[0][a], k * 0.8, null, mt);
        w.addBond(rt, rings[1][0], k * 0.5, null, mt);
      }
      const leaf = (x, y, z, anc) => { const id = w.spawn({ x, y, z, M: 0.4, kind: KIND.LEAF, gScale: 1, hp: 12 }); w.addBond(anc, id, 26, null, 0.4); leaves.push(id); };
      for (let s = 3; s <= segs; s++) {
        if (Math.random() < 0.3) continue;
        const ang = Math.random() * 6.283, by = baseY + s * seg;
        const bx = baseX + Math.cos(ang) * (rad + seg), bz = baseZ + Math.sin(ang) * (rad + seg);
        const anc = rings[s][0];
        const bi = w.spawn({ x: bx, y: by, z: bz, M: 0.45, kind: KIND.WOOD, gScale: 1, hp });
        w.addBond(anc, bi, k * 0.8, null, mt); w.addBond(rings[s - 1][0], bi, k * 0.5, null, mt);
        for (let l = 0; l < 4; l++) leaf(bx + (Math.random() - 0.5) * 4, by + (Math.random() - 0.5) * 4, bz + (Math.random() - 0.5) * 4, bi);
      }
      const top = rings[segs];
      for (let l = 0; l < 10; l++) leaf(baseX + (Math.random() - 0.5) * 8, baseY + segs * seg + 2 + Math.random() * 6, baseZ + (Math.random() - 0.5) * 8, top[l % 3]);
      return { rings, leaves };
    },

    fireball(w, cx, cy, cz, opt = {}) {
      const count = opt.count || 44, temp = opt.temp || 2.2, units = [];
      for (let c = 0; c < count; c++) {
        const a = Math.random() * 6.283, b = Math.acos(2 * Math.random() - 1), sp = 1 + Math.random() * 4;
        units.push(w.spawn({ x: cx + (Math.random() - 0.5) * 4, y: cy + (Math.random() - 0.5) * 4, z: cz + (Math.random() - 0.5) * 4, vx: Math.sin(b) * Math.cos(a) * sp, vy: Math.cos(b) * sp, vz: Math.sin(b) * Math.sin(a) * sp, T: temp * (0.7 + Math.random() * 0.6), M: 0.8, kind: KIND.FIRE, gScale: 0 }));
      }
      return { units };
    },

    ice(w, cx, cy, cz, opt = {}) {
      const count = opt.count || 16, units = [];
      cy = Math.max(cy, w.ground(cx, cz) + 4);
      for (let c = 0; c < count; c++)
        units.push(w.spawn({ x: cx + (Math.random() - 0.5) * 5, y: cy + (Math.random() - 0.5) * 5, z: cz + (Math.random() - 0.5) * 5, T: 0, M: 0.6, kind: KIND.ICE, gScale: 1, hp: 0 }));
      for (let a = 0; a < units.length; a++) for (let b = a + 1; b < units.length; b++) {
        const dx = w.px[units[a]] - w.px[units[b]], dy = w.py[units[a]] - w.py[units[b]], dz = w.pz[units[a]] - w.pz[units[b]];
        if (dx * dx + dy * dy + dz * dz < 16) w.addBond(units[a], units[b], 90, null, 0.35);
      }
      return { units };
    },
  };

  // 구 껍질: core(=pts[0])와 전부 결합 + 각 점이 가까운 3개와 결합 → 응집체
  function shellBond(w, pts, k) {
    const core = pts[0];
    for (let a = 1; a < pts.length; a++) w.addBond(core, pts[a], k);
    for (let a = 1; a < pts.length; a++) {
      const da = [];
      for (let b = 1; b < pts.length; b++) {
        if (a === b) continue;
        const dx = w.px[pts[a]] - w.px[pts[b]], dy = w.py[pts[a]] - w.py[pts[b]], dz = w.pz[pts[a]] - w.pz[pts[b]];
        da.push([dx * dx + dy * dy + dz * dz, b]);
      }
      da.sort((p, q) => p[0] - q[0]);
      for (let t = 0; t < 3; t++) { const b = da[t][1]; if (b > a) w.addBond(pts[a], pts[b], k); }
    }
  }

  const MC3 = { KIND, World, Forms, ptSeg2 };
  global.MC3 = MC3;
  if (typeof module !== 'undefined' && module.exports) module.exports = MC3;
})(typeof window !== 'undefined' ? window : globalThis);
