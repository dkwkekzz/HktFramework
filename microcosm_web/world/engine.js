/* engine.js — microcosm 통합 기질(substrate). DOM 비의존 → Node 로 검증 가능.
 *
 * 하나의 규칙으로 캐릭터·불·벼락·물·바위·나무·개체가 모두 굴러간다:
 *
 *     ẋ_i = f(x_i) + Σ_j W_ij g(x_i, x_j) + I_i − γ x_i
 *           (자체동역학) (상호작용=장)       (흐름)  (소산)
 *
 * 6칸 보편 문법(systems.pdf):
 *   단위(unit)   = 상태 배열 (px,py,vx,vy,T,M,hp,kind...)
 *   경계(boundary) = kind 태그 + fixed + 월드 경계
 *   상호작용(field) = step() 안의 장들 (열확산·반발·응집·결합·지지)
 *   흐름(flow)    = spawn 초기 에너지/속도, 외부 입력(물 붓기·소환)
 *   피드백(feedback) = 항상성(음성) / 결합·연소(양성)
 *   창발(emergence) = Form 레시피 → 거시 행동이 떠오름
 */
(function (global) {
  'use strict';

  const KIND = {
    VOID: 0, CHARACTER: 1, FIRE: 2, LIGHTNING: 3, ARMOR: 4,
    WATER: 5, ROCK: 6, WOOD: 7, LEAF: 8, CREATURE: 9, ICE: 10,
  };

  class World {
    constructor(o = {}) {
      this.W = o.W || 240;
      this.H = o.H || 120;
      this.gravity = o.gravity != null ? o.gravity : 16;
      this.cap = o.cap || 12000;
      const c = this.cap;
      this.px = new Float64Array(c); this.py = new Float64Array(c);
      this.vx = new Float64Array(c); this.vy = new Float64Array(c);
      this.fx = new Float64Array(c); this.fy = new Float64Array(c);
      this.T = new Float64Array(c); this.dT = new Float64Array(c);
      this.M = new Float64Array(c); this.hp = new Float64Array(c); this.hpMax = new Float64Array(c);
      this.gScale = new Float64Array(c); this.homeoT = new Float64Array(c);
      this.kind = new Int32Array(c); this.fixed = new Uint8Array(c);
      this.homeo = new Uint8Array(c); this.alive = new Uint8Array(c);
      this.n = 0;
      this.bonds = [];   // {i,j,rest,k,melt}
      this.bolts = [];   // 벼락 채널 시각화 {path:[[x,y]...], life}
      this.agents = [];  // 자율 훅 {update(world,dt)}
      this.time = 0;
      this.entropyOut = 0;  // 누적 엔트로피 방출(냉각으로 빠진 열) — 소산 계측
      this.ground = (x) => 20;
    }

    groundSlope(x) { return this.ground(x + 0.5) - this.ground(x - 0.5); }

    spawn(o) {
      const i = this.n++;
      this.px[i] = o.x; this.py[i] = o.y;
      this.vx[i] = o.vx || 0; this.vy[i] = o.vy || 0;
      this.T[i] = o.T || 0; this.M[i] = o.M || 1;
      this.kind[i] = o.kind || 0; this.fixed[i] = o.fixed ? 1 : 0;
      this.gScale[i] = o.gScale != null ? o.gScale : 0;
      this.alive[i] = 1; this.hp[i] = o.hp || 0; this.hpMax[i] = o.hp || 0;
      if (o.homeoT != null) { this.homeo[i] = 1; this.homeoT[i] = o.homeoT; }
      return i;
    }

    addBond(i, j, k, rest, melt) {
      if (rest == null) rest = Math.hypot(this.px[i] - this.px[j], this.py[i] - this.py[j]);
      this.bonds.push({ i, j, rest, k, melt: melt != null ? melt : 0.85 });
    }

    killUnit(i) {
      this.alive[i] = 0; this.kind[i] = KIND.VOID;
      this.bonds = this.bonds.filter((b) => b.i !== i && b.j !== i);
    }

    // 벼락: 위에서 바닥까지 프랙탈 하향 분기 보행 → 경로 위 단위에 가열 + HP 피해.
    strikeLightning(tx) {
      const path = [];
      let x = tx + (Math.random() - 0.5) * 6, y = this.H;
      const gy = this.ground(tx);
      path.push([x, y]);
      while (y > gy + 1) {
        y -= 2 + Math.random() * 3;
        x += (Math.random() - 0.5) * 7;
        path.push([x, y]);
      }
      this.bolts.push({ path, life: 0.35 });
      // 경로 인접 단위에 작용
      for (let i = 0; i < this.n; i++) {
        if (!this.alive[i]) continue;
        for (const p of path) {
          const dx = this.px[i] - p[0], dy = this.py[i] - p[1];
          if (dx * dx + dy * dy < 36) {
            this.T[i] += 1.6;
            if (this.hpMax[i] > 0) {
              this.hp[i] -= 34;
              if (this.hp[i] <= 0) this.killUnit(i);
            }
            break;
          }
        }
      }
      return path;
    }

    step(dt) {
      const n = this.n;
      for (let i = 0; i < n; i++) { this.fx[i] = 0; this.fy[i] = 0; this.dT[i] = 0; }

      // 자율 레시피 훅(개체 방랑 등)
      for (const a of this.agents) if (a.update) a.update(this, dt);

      // --- 쌍 상호작용: 열확산 + 단거리 반발 + 물-물 응집 (W_ij g) ---
      const rTh2 = 49, diff = 0.2, rRep = 3, rRep2 = 9, repK = 120,
            rCoh = 6.5, rCoh2 = 42.25, cohK = 16, WATER = KIND.WATER;
      for (let i = 0; i < n; i++) {
        if (!this.alive[i]) continue;
        for (let j = i + 1; j < n; j++) {
          if (!this.alive[j]) continue;
          const dx = this.px[j] - this.px[i], dy = this.py[j] - this.py[i], d2 = dx * dx + dy * dy;
          const ww = this.kind[i] === WATER && this.kind[j] === WATER;
          if (d2 > rTh2 && !(ww && d2 < rCoh2)) continue;
          const d = Math.sqrt(d2) + 1e-9;
          if (d2 <= rTh2) { const t = diff * (this.T[j] - this.T[i]); this.dT[i] += t; this.dT[j] -= t; }
          if (d2 < rRep2) { const f = repK * (rRep - d) / rRep / d; this.fx[i] -= f * dx; this.fy[i] -= f * dy; this.fx[j] += f * dx; this.fy[j] += f * dy; }
          if (ww && d2 < rCoh2 && d > rRep) { const f = cohK * (rCoh - d) / rCoh / d; this.fx[i] += f * dx; this.fy[i] += f * dy; this.fx[j] -= f * dx; this.fy[j] -= f * dy; }
        }
      }

      // --- 자체동역학 + 흐름 + 소산 (f, I, -γ) ---
      const buoy = 5, buoyThr = 0.3, cool = 0.5, dragC = 0.85, homeoG = 2.5;
      for (let i = 0; i < n; i++) {
        if (!this.alive[i]) continue;
        this.fy[i] += buoy * Math.max(this.T[i] - buoyThr, 0);          // 부력
        this.fy[i] -= this.gravity * this.gScale[i] * this.M[i];        // 중력
        const coolAmt = cool * this.T[i];
        this.dT[i] -= coolAmt;                                          // 복사 냉각(엔트로피 방출)
        this.entropyOut += coolAmt * dt;
        if (this.homeo[i]) this.dT[i] += homeoG * (this.homeoT[i] - this.T[i]); // 항상성(음성피드백)
        this.fx[i] -= dragC * this.vx[i]; this.fy[i] -= dragC * this.vy[i];     // 점성
      }

      // --- 구조 결합 (스프링 + 융해/과신장 파괴) ---
      const stretch = 2.3, dampB = 1.4, keep = [];
      for (const b of this.bonds) {
        const i = b.i, j = b.j;
        const dx = this.px[j] - this.px[i], dy = this.py[j] - this.py[i],
              L = Math.hypot(dx, dy) + 1e-9, ux = dx / L, uy = dy / L;
        if (0.5 * (this.T[i] + this.T[j]) > b.melt || L > b.rest * stretch) continue; // 융해/파단
        let f = b.k * (L - b.rest);
        f += dampB * ((this.vx[j] - this.vx[i]) * ux + (this.vy[j] - this.vy[i]) * uy);
        this.fx[i] += f * ux; this.fy[i] += f * uy; this.fx[j] -= f * ux; this.fy[j] -= f * uy;
        keep.push(b);
      }
      this.bonds = keep;

      // --- 지형 지지력 + 마찰 (경계) ---
      const kSup = 360, nDamp = 13, fric = 6.0;
      for (let i = 0; i < n; i++) {
        if (!this.alive[i] || this.fixed[i]) continue;
        const h = this.ground(this.px[i]), pen = h - this.py[i];
        if (pen > 0) {
          const s = this.groundSlope(this.px[i]), nl = Math.hypot(-s, 1), nx = -s / nl, ny = 1 / nl;
          this.fx[i] += kSup * pen * nx; this.fy[i] += kSup * pen * ny;
          const vn = this.vx[i] * nx + this.vy[i] * ny;
          this.fx[i] -= nDamp * vn * nx; this.fy[i] -= nDamp * vn * ny;
          const tx = ny, ty = -nx, vt = this.vx[i] * tx + this.vy[i] * ty;
          this.fx[i] -= fric * vt * tx; this.fy[i] -= fric * vt * ty;
        }
      }

      // --- 적분(명시적 오일러) + 월드 경계 반사 ---
      for (let i = 0; i < n; i++) {
        if (!this.alive[i]) continue;
        if (this.fixed[i]) { this.vx[i] = 0; this.vy[i] = 0; }
        else {
          this.vx[i] += this.fx[i] / this.M[i] * dt; this.vy[i] += this.fy[i] / this.M[i] * dt;
          this.px[i] += this.vx[i] * dt; this.py[i] += this.vy[i] * dt;
        }
        this.T[i] = Math.max(0, this.T[i] + this.dT[i] * dt);
        if (this.px[i] < 0) { this.px[i] = 0; this.vx[i] *= -0.5; }
        if (this.px[i] > this.W) { this.px[i] = this.W; this.vx[i] *= -0.5; }
        if (this.py[i] < 0) { this.py[i] = 0; this.vy[i] *= -0.5; }
        if (this.py[i] > this.H) { this.py[i] = this.H; this.vy[i] *= -0.5; }
      }

      // --- 종류별 소멸/연소 (양성피드백·엔트로피) ---
      const burnK = 22, burnThr = 0.5;
      for (let i = 0; i < n; i++) {
        if (!this.alive[i]) continue;
        const kd = this.kind[i];
        if (kd === KIND.FIRE) { if (this.T[i] < 0.16) this.killUnit(i); continue; }
        if (kd === KIND.LIGHTNING) { if (this.T[i] < 0.2) this.killUnit(i); continue; }
        if (kd === KIND.ICE) { if (this.T[i] > 0.4) this.killUnit(i); continue; } // 얼음은 녹으면 사라짐
        if (this.hpMax[i] > 0 && this.T[i] > burnThr) {
          this.hp[i] -= burnK * (this.T[i] - burnThr) * dt;
          if (this.hp[i] <= 0) this.killUnit(i);
        }
      }

      for (const bolt of this.bolts) bolt.life -= dt;
      this.bolts = this.bolts.filter((b) => b.life > 0);
      this.time += dt;
    }

    // ---- 창발 계측: 질서변수/연결망/흐름 (systems.pdf §2.2-2.3) ----
    metrics() {
      let alive = 0, water = 0, life = 0, trees = 0, heat = 0;
      let sumVx = 0, sumVy = 0, vmag = 0, moving = 0;
      for (let i = 0; i < this.n; i++) {
        if (!this.alive[i]) continue;
        alive++;
        const k = this.kind[i];
        heat += this.T[i];
        if (k === KIND.WATER) water++;
        else if (k === KIND.CREATURE || k === KIND.CHARACTER) {
          life++;
          const sp = Math.hypot(this.vx[i], this.vy[i]);
          if (sp > 0.05) { sumVx += this.vx[i] / sp; sumVy += this.vy[i] / sp; vmag += sp; moving++; }
        } else if (k === KIND.WOOD || k === KIND.LEAF) trees++;
      }
      // 질서변수 φ = |평균 속도 방향 벡터| (집단 정렬도, Kuramoto r 의 운동학 버전)
      const order = moving > 0 ? Math.hypot(sumVx, sumVy) / moving : 0;
      return {
        alive, water, life, trees, heat,
        bonds: this.bonds.length,
        order,                       // 창발: 집단 정렬 0~1
        entropyOut: this.entropyOut, // 소산 누적
        time: this.time,
      };
    }
  }

  // ---- Form 레시피: 같은 spawn/addBond API 로 단위를 배치 → 거시 거동 창발 ----
  const Forms = {
    terrain(w) {
      w.ground = (x) => 20 + 17 * Math.sin(x * 0.017 + 1.0) + 7 * Math.sin(x * 0.058 + 0.5) + 4 * Math.sin(x * 0.11);
      return { ground: w.ground };
    },

    water(w, cx, count = 60, spreadX = 18, topY = null) {
      const y0 = topY != null ? topY : w.H - 6, units = [];
      for (let c = 0; c < count; c++)
        units.push(w.spawn({ x: cx + (Math.random() - 0.5) * spreadX, y: y0 - Math.random() * 14, vx: (Math.random() - 0.5) * 2, vy: -2, M: 0.5, kind: KIND.WATER, gScale: 1 }));
      return { units };
    },

    // 캐릭터 = 결합 + 항상성 → 응집체 '몸'
    character(w, cx, cy, opt = {}) {
      const radius = opt.radius || 4, nring = opt.nring || 10, temp = 0.12, k = 30, hp = opt.hp || 100;
      cy = Math.max(cy, w.ground(cx) + 5);
      const core = w.spawn({ x: cx, y: cy, T: temp, M: 1.4, kind: KIND.CHARACTER, homeoT: temp, hp, gScale: 1 });
      const ring = [];
      for (let a = 0; a < nring; a++) {
        const ang = 2 * Math.PI * a / nring;
        ring.push(w.spawn({ x: cx + radius * Math.cos(ang), y: cy + radius * Math.sin(ang), T: temp, M: 1, kind: KIND.CHARACTER, homeoT: temp, hp, gScale: 1 }));
      }
      for (const i of ring) w.addBond(core, i, k);
      for (let a = 0; a < nring; a++) w.addBond(ring[a], ring[(a + 1) % nring], k);
      return { core, units: [core, ...ring] };
    },

    // 바위 = 강결합·고융점 덩어리 (네트워크)
    rock(w, cx, cy, opt = {}) {
      const r = opt.r || 5, sp = 2.3, units = [];
      cy = w.ground(cx) + r + 1;
      for (let yy = -r; yy <= r; yy += sp)
        for (let xx = -r; xx <= r; xx += sp)
          if (xx * xx + yy * yy <= r * r)
            units.push(w.spawn({ x: cx + xx, y: cy + yy, M: 1.2, kind: KIND.ROCK, gScale: 1, hp: 0 }));
      for (let a = 0; a < units.length; a++)
        for (let b = a + 1; b < units.length; b++) {
          const dx = w.px[units[a]] - w.px[units[b]], dy = w.py[units[a]] - w.py[units[b]];
          if (dx * dx + dy * dy < 4.7 * 4.7) w.addBond(units[a], units[b], 430, null, 9);
        }
      return { units };
    },

    // 나무 = 뿌리 고정 분기 골격 (프랙탈). 불에 융해 → 붕괴.
    tree(w, baseX, opt = {}) {
      const baseY = w.ground(baseX), segs = opt.segs || 5, seg = opt.seg || 4, hw = 1.7, k = 130, mt = 0.6, hp = 40;
      const Lc = [], Rc = [], leaves = [];
      for (let s = 0; s <= segs; s++) {
        const y = baseY + s * seg, fx = s === 0;
        const li = w.spawn({ x: baseX - hw, y, M: 0.7, kind: KIND.WOOD, gScale: 1, fixed: fx, hp });
        const ri = w.spawn({ x: baseX + hw, y, M: 0.7, kind: KIND.WOOD, gScale: 1, fixed: fx, hp });
        Lc.push(li); Rc.push(ri); w.addBond(li, ri, k, null, mt);
        if (s > 0) {
          w.addBond(Lc[s - 1], li, k, null, mt); w.addBond(Rc[s - 1], ri, k, null, mt);
          w.addBond(Lc[s - 1], ri, k * 0.7, null, mt); w.addBond(Rc[s - 1], li, k * 0.7, null, mt);
        }
      }
      const rl = w.spawn({ x: baseX - 5, y: baseY, M: 0.8, kind: KIND.WOOD, gScale: 1, fixed: true, hp });
      const rr = w.spawn({ x: baseX + 5, y: baseY, M: 0.8, kind: KIND.WOOD, gScale: 1, fixed: true, hp });
      w.addBond(rl, Lc[0], k, null, mt); w.addBond(rl, Lc[1], k * 0.8, null, mt); w.addBond(rl, Rc[0], k * 0.6, null, mt);
      w.addBond(rr, Rc[0], k, null, mt); w.addBond(rr, Rc[1], k * 0.8, null, mt); w.addBond(rr, Lc[0], k * 0.6, null, mt);
      const leaf = (x, y, anc) => { const id = w.spawn({ x, y, M: 0.4, kind: KIND.LEAF, gScale: 1, hp: 12 }); w.addBond(anc, id, 26, null, 0.4); leaves.push(id); };
      for (let b = 3; b <= segs; b++) {
        if (Math.random() < 0.3) continue;
        for (const dir of [-1, 1]) {
          const col = dir < 0 ? Lc : Rc, bx = baseX + dir * (hw + seg * 1.2), by = baseY + b * seg;
          const bi = w.spawn({ x: bx, y: by, M: 0.45, kind: KIND.WOOD, gScale: 1, hp });
          w.addBond(col[b], bi, k * 0.8, null, mt); w.addBond(col[b - 1], bi, k * 0.55, null, mt);
          for (let l = 0; l < 4; l++) leaf(bx + (Math.random() - 0.5) * 4, by + 2 + Math.random() * 4, bi);
        }
      }
      for (let l = 0; l < 8; l++) leaf(baseX + (Math.random() - 0.5) * 7, baseY + segs * seg + 2 + Math.random() * 5, Math.random() < 0.5 ? Lc[segs] : Rc[segs]);
      return { trunk: Lc.concat(Rc), Lc, Rc, leaves };
    },

    // 개체 = 캐릭터 + 방랑 추진력 (자율 에이전트)
    creature(w, cx, cy, opt = {}) {
      const radius = 3.4, nring = 8, temp = 0.12, k = 32, hp = 80;
      cy = Math.max(cy, w.ground(cx) + 5);
      const core = w.spawn({ x: cx, y: cy, T: temp, M: 1.1, kind: KIND.CREATURE, homeoT: temp, hp, gScale: 1 });
      const units = [core];
      for (let a = 0; a < nring; a++) {
        const ang = 2 * Math.PI * a / nring;
        units.push(w.spawn({ x: cx + radius * Math.cos(ang), y: cy + radius * Math.sin(ang), T: temp, M: 0.8, kind: KIND.CREATURE, homeoT: temp, hp, gScale: 1 }));
      }
      const ring = units.slice(1);
      for (const i of ring) w.addBond(core, i, k);
      for (let a = 0; a < ring.length; a++) w.addBond(ring[a], ring[(a + 1) % ring.length], k);
      const ctrl = {
        units, core, target: cx, speed: opt.speed || 11, t: 0, hop: 1 + Math.random(),
        update(w, dt) {
          if (!w.alive[this.core]) return;
          this.t -= dt;
          if (this.t <= 0 || Math.abs(w.px[this.core] - this.target) < 8) {
            this.target = 24 + Math.random() * (w.W - 48); this.t = 2.5 + Math.random() * 3;
          }
          const dvx = Math.sign(this.target - w.px[this.core]) * this.speed;
          for (const i of this.units) if (w.alive[i]) w.fx[i] += 3.2 * (dvx - w.vx[i]);
          this.hop -= dt;
          if (this.hop <= 0) { this.hop = 1.6 + Math.random() * 1.4; for (const i of this.units) if (w.alive[i]) w.vy[i] += 5; }
        },
      };
      w.agents.push(ctrl);
      return ctrl;
    },

    // 파이어볼 = 고온 비결합 패킷 (열역학)
    fireball(w, cx, cy, opt = {}) {
      const count = opt.count || 40, temp = opt.temp || 2.0, units = [];
      const vx0 = opt.vx || 0, vy0 = opt.vy || 0;
      for (let c = 0; c < count; c++) {
        const a = Math.random() * 6.283, sp = 1 + Math.random() * 4;
        units.push(w.spawn({ x: cx + (Math.random() - 0.5) * 4, y: cy + (Math.random() - 0.5) * 4, vx: vx0 + Math.cos(a) * sp, vy: vy0 + Math.sin(a) * sp, T: temp * (0.7 + Math.random() * 0.6), M: 0.8, kind: KIND.FIRE, gScale: 0 }));
      }
      return { units };
    },

    // 얼음 = 단단한 결정(강결합, 음온 대용 0). 더우면 녹아 소멸.
    ice(w, cx, cy, opt = {}) {
      const count = opt.count || 16, units = [];
      cy = Math.max(cy, w.ground(cx) + 4);
      for (let c = 0; c < count; c++)
        units.push(w.spawn({ x: cx + (Math.random() - 0.5) * 5, y: cy + (Math.random() - 0.5) * 5, T: 0, M: 0.6, kind: KIND.ICE, gScale: 1, hp: 0 }));
      for (let a = 0; a < units.length; a++)
        for (let b = a + 1; b < units.length; b++) {
          const dx = w.px[units[a]] - w.px[units[b]], dy = w.py[units[a]] - w.py[units[b]];
          if (dx * dx + dy * dy < 16) w.addBond(units[a], units[b], 90, null, 0.35);
        }
      return { units };
    },
  };

  const MC = { KIND, World, Forms };
  global.MC = MC;
  if (typeof module !== 'undefined' && module.exports) module.exports = MC;
})(typeof window !== 'undefined' ? window : globalThis);
