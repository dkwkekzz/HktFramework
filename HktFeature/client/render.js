// ============================================================================
// Render — 3D 원근 투영 시각화 (Canvas 2D 위 소프트웨어 카메라, 외부 의존 0).
// 원장 미러를 읽기만 한다 (쓰기 금지). z 는 높이(up), x·y 는 지면.
// 카메라: 플레이어를 도는 orbit(드래그=회전, 휠=줌). HUD 는 화면공간 유지.
//
// 최소 코어 뷰어 — 플레이어와 원장 총합(보존)·체크섬·tx 스트림만 전시한다.
// 노드·아이템·전투 등 게임플레이 시각화는 feature 로 얹는다.
// ============================================================================

import { WORLD_SIZE, REGION_SIZE, PLAYER_MAX_ENERGY, POOL } from '../shared/constants.js';

const CAUSE_LABEL = { spawn: '스폰', move: '이동', death: '소멸', diffuse: '확산', radiate: '복사' };

function poolLabel(state, id) {
  if (id === state.playerId) return '나';
  if (id === POOL.SOURCE) return '태양';
  if (id === POOL.SINK) return '심우주';
  if (id.startsWith(POOL.MATERIAL)) return '국소장';
  return state.entities.get(id)?.name ?? id;
}

export class Render {
  constructor(canvas, state, sim, net) {
    this.ctx = canvas.getContext('2d');
    this.w = canvas.width;
    this.h = canvas.height;
    this.state = state;
    this.sim = sim;
    this.net = net;

    // orbit 카메라 (z-up). yaw=방위각, pitch=올려본 각, dist=거리.
    this.yaw = -Math.PI * 0.75;
    this.pitch = 0.55;
    this.dist = 620;
    this.focal = this.h * 0.9;

    // 입력: 드래그 회전 · 휠 줌
    let drag = null;
    canvas.addEventListener('mousedown', (e) => { drag = { x: e.clientX, y: e.clientY }; });
    addEventListener('mouseup', () => { drag = null; });
    addEventListener('mousemove', (e) => {
      if (!drag) return;
      this.yaw -= (e.clientX - drag.x) * 0.006;
      this.pitch = Math.max(0.05, Math.min(1.45, this.pitch + (e.clientY - drag.y) * 0.005));
      drag = { x: e.clientX, y: e.clientY };
    });
    canvas.addEventListener('wheel', (e) => {
      this.dist = Math.max(150, Math.min(1600, this.dist * (1 + Math.sign(e.deltaY) * 0.12)));
      e.preventDefault();
    }, { passive: false });
  }

  // --- 카메라 기저 (target=플레이어) ---
  #camera() {
    const { sim } = this;
    const cp = Math.cos(this.pitch), sp = Math.sin(this.pitch);
    const fwd = [cp * Math.cos(this.yaw), cp * Math.sin(this.yaw), -sp];
    const target = [sim.x, sim.y, sim.z + 20];
    const pos = [target[0] - fwd[0] * this.dist, target[1] - fwd[1] * this.dist, target[2] - fwd[2] * this.dist];
    const rx = fwd[1], ry = -fwd[0], rz = 0;
    const rl = Math.hypot(rx, ry, rz) || 1;
    const right = [rx / rl, ry / rl, rz / rl];
    const up = [
      right[1] * fwd[2] - right[2] * fwd[1],
      right[2] * fwd[0] - right[0] * fwd[2],
      right[0] * fwd[1] - right[1] * fwd[0],
    ];
    return { pos, right, up, fwd };
  }

  #toCam(cam, x, y, z) {
    const rx = x - cam.pos[0], ry = y - cam.pos[1], rz = z - cam.pos[2];
    return [
      rx * cam.right[0] + ry * cam.right[1] + rz * cam.right[2],
      rx * cam.up[0] + ry * cam.up[1] + rz * cam.up[2],
      rx * cam.fwd[0] + ry * cam.fwd[1] + rz * cam.fwd[2],
    ];
  }

  #project(c) {
    if (c[2] <= 1) return null;
    return { sx: this.w / 2 + (c[0] / c[2]) * this.focal, sy: this.h / 2 - (c[1] / c[2]) * this.focal, f: c[2] };
  }

  #pt(cam, x, y, z) { return this.#project(this.#toCam(cam, x, y, z)); }

  // near 평면 클립 후 선분 그리기
  #seg(cam, ax, ay, az, bx, by, bz) {
    let a = this.#toCam(cam, ax, ay, az), b = this.#toCam(cam, bx, by, bz);
    const near = 1;
    if (a[2] <= near && b[2] <= near) return;
    if (a[2] <= near || b[2] <= near) {
      const t = (near - a[2]) / (b[2] - a[2]);
      const mid = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, near];
      if (a[2] <= near) a = mid; else b = mid;
    }
    const pa = this.#project(a), pb = this.#project(b);
    if (!pa || !pb) return;
    this.ctx.beginPath(); this.ctx.moveTo(pa.sx, pa.sy); this.ctx.lineTo(pb.sx, pb.sy); this.ctx.stroke();
  }

  draw() {
    const { ctx, w, h, state } = this;
    const cam = this.#camera();

    ctx.fillStyle = '#0a0d13';
    ctx.fillRect(0, 0, w, h);

    // 국소장 히트맵 — 지면 컬럼을 농도에 따라 칠한다 (feature-0004 step2: 에너지 확산 시각화)
    this.#fieldHeatmap(cam);

    // 지면(z=0) 지역 격자
    ctx.strokeStyle = '#2a3446';
    ctx.lineWidth = 1;
    for (let g = 0; g <= WORLD_SIZE; g += REGION_SIZE) {
      this.#seg(cam, g, 0, 0, g, WORLD_SIZE, 0);
      this.#seg(cam, 0, g, 0, WORLD_SIZE, g, 0);
    }

    // 엔티티(다른 플레이어) — 자신 포함, 깊이순(먼 것 먼저)
    const draws = [];
    for (const e of state.entities.values()) {
      const c = this.#toCam(cam, e.x, e.y, e.z);
      if (c[2] > 1) draws.push({ e, cam: c });
    }
    const selfC = this.#toCam(cam, this.sim.x, this.sim.y, this.sim.z);
    if (selfC[2] > 1) draws.push({ self: true, cam: selfC });
    draws.sort((a, b) => b.cam[2] - a.cam[2]);

    for (const d of draws) {
      if (d.self) { this.#drawSelf(cam); continue; }
      this.#drawEntity(cam, d.e, d.cam[2]);
    }

    this.#hud();
  }

  // 국소장 히트맵 — 각 지역 컬럼을 농도(에너지)에 비례한 색으로 지면에 칠한다.
  //   차가움(파랑, 저농도) → 뜨거움(주황·빨강, 고농도). 확산이 진행되면 뜨거운 얼룩이
  //   이웃으로 번지고, 평형에 이르면 색이 고르게 수렴한다 — "높은 확률로 전파"를 눈으로 본다.
  #fieldHeatmap(cam) {
    const { ctx, state } = this;
    if (state.field.size === 0) return;
    let max = 1;
    for (const v of state.field.values()) if (v > max) max = v;
    // 먼 컬럼부터 그려 겹침을 자연스럽게 (지면 평면이라 깊이 정렬은 근사)
    const cells = [];
    for (const [key, bal] of state.field) {
      const [cx, cy] = key.split('_').map(Number);
      const mx = (cx + 0.5) * REGION_SIZE, my = (cy + 0.5) * REGION_SIZE;
      cells.push({ cx, cy, bal, d: this.#toCam(cam, mx, my, 0)[2] });
    }
    cells.sort((a, b) => b.d - a.d);
    for (const c of cells) {
      const t = Math.min(1, c.bal / max);
      const p0 = this.#pt(cam, c.cx * REGION_SIZE, c.cy * REGION_SIZE, 0);
      const p1 = this.#pt(cam, (c.cx + 1) * REGION_SIZE, c.cy * REGION_SIZE, 0);
      const p2 = this.#pt(cam, (c.cx + 1) * REGION_SIZE, (c.cy + 1) * REGION_SIZE, 0);
      const p3 = this.#pt(cam, c.cx * REGION_SIZE, (c.cy + 1) * REGION_SIZE, 0);
      if (!p0 || !p1 || !p2 || !p3) continue; // 카메라 뒤 컬럼은 생략(근사)
      ctx.fillStyle = `hsla(${210 - 210 * t}, 85%, ${28 + 34 * t}%, ${0.12 + 0.55 * t})`;
      ctx.beginPath();
      ctx.moveTo(p0.sx, p0.sy); ctx.lineTo(p1.sx, p1.sy);
      ctx.lineTo(p2.sx, p2.sy); ctx.lineTo(p3.sx, p3.sy); ctx.closePath();
      ctx.fill();
    }
  }

  // 높이 스틱 — 엔티티에서 지면(z=0)까지 수선 (고도 가독성)
  #stick(cam, x, y, z, color) {
    const { ctx } = this;
    ctx.strokeStyle = color; ctx.lineWidth = 1;
    ctx.setLineDash([2, 3]);
    this.#seg(cam, x, y, 0, x, y, z);
    ctx.setLineDash([]);
    const g = this.#pt(cam, x, y, 0);
    if (g) { ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.ellipse(g.sx, g.sy, 5, 2.5, 0, 0, 7); ctx.fill(); }
  }

  #drawEntity(cam, e, depth) {
    const { ctx } = this;
    const p = this.#pt(cam, e.x, e.y, e.z);
    if (!p) return;
    const scale = this.focal / depth;
    const bal = this.state.ledger.balance(e.id);
    this.#stick(cam, e.x, e.y, e.z, 'rgba(90,167,217,0.4)');
    ctx.fillStyle = '#5aa7d9';
    ctx.beginPath(); ctx.arc(p.sx, p.sy, Math.max(3, 10 * scale), 0, 7); ctx.fill();
    this.#bar(p.sx, p.sy - 12 * scale, 30 * scale, bal / PLAYER_MAX_ENERGY, '#7ec3ea');
    this.#label(p.sx, p.sy - 20 * scale, e.name ?? '', '#bcd8ea', scale);
  }

  #drawSelf(cam) {
    const { ctx, sim } = this;
    this.#stick(cam, sim.x, sim.y, sim.z, 'rgba(255,215,110,0.5)');
    const p = this.#pt(cam, sim.x, sim.y, sim.z);
    if (!p) return;
    const scale = this.focal / this.#toCam(cam, sim.x, sim.y, sim.z)[2];
    ctx.fillStyle = '#f0f4f8';
    ctx.beginPath(); ctx.arc(p.sx, p.sy, Math.max(4, 11 * scale), 0, 7); ctx.fill();
    ctx.strokeStyle = '#ffd76e'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(p.sx, p.sy, Math.max(6, 14 * scale), 0, 7); ctx.stroke();
  }

  #label(x, y, text, color, scale) {
    if (scale < 0.35 || !text) return;
    const { ctx } = this;
    ctx.fillStyle = color;
    ctx.font = `${Math.max(9, Math.round(11 * Math.min(1.4, scale)))}px monospace`;
    ctx.textAlign = 'center';
    ctx.fillText(text, x, y);
  }

  #bar(cx, y, width, ratio, color) {
    if (width < 6) return;
    const { ctx } = this;
    ctx.fillStyle = '#2a3040';
    ctx.fillRect(cx - width / 2, y, width, 4);
    ctx.fillStyle = color;
    ctx.fillRect(cx - width / 2, y, width * Math.max(0, Math.min(1, ratio)), 4);
  }

  #hud() {
    const { ctx, w, state, net, sim } = this;
    ctx.textAlign = 'left';

    // 좌상: 내 에너지 + 고도
    const energy = state.ledger.balance(state.playerId);
    ctx.fillStyle = 'rgba(10,14,20,0.8)';
    ctx.fillRect(10, 10, 270, 56);
    ctx.fillStyle = '#e8eef4';
    ctx.font = 'bold 13px sans-serif';
    ctx.fillText(`${state.myName}  에너지 ${energy} / ${PLAYER_MAX_ENERGY}  ·  고도 ${Math.round(sim.z)}`, 20, 30);
    ctx.fillStyle = '#2a3040'; ctx.fillRect(20, 40, 250, 10);
    ctx.fillStyle = energy > 200 ? '#6fd08c' : '#d97b6f';
    ctx.fillRect(20, 40, 250 * energy / PLAYER_MAX_ENERGY, 10);

    // 우상: 보존 불변식 + 에너지 세 등급(태양·국소장·심우주) 전시 + 네트워크 계측
    ctx.fillStyle = 'rgba(10,14,20,0.8)';
    ctx.fillRect(w - 265, 10, 255, 122);
    ctx.font = '12px monospace';
    ctx.fillStyle = '#8fd9a8';
    ctx.fillText(`세계 총 에너지 ${state.worldTotal.toLocaleString()}`, w - 255, 28);
    ctx.fillStyle = '#9db2c4';
    ctx.fillText(`(창세 이후 불변 = 보존 법칙)`, w - 255, 44);
    // feature-0004: 태양(고등급)→국소장(중등급, 확산)→심우주(저등급, 단조 증가) 세 등급
    ctx.fillStyle = '#e0b34e';
    ctx.fillText(`☀ 태양 ${state.worldSrc.toLocaleString()}  ·  국소장 ${state.worldMaterial.toLocaleString()}`, w - 255, 60);
    ctx.fillStyle = '#7a8aa0';
    ctx.fillText(`심우주(손실) ${state.worldSink.toLocaleString()}  ↑엔트로피`, w - 255, 76);
    ctx.fillStyle = '#6b7a8c';
    ctx.font = '10px monospace';
    ctx.fillText(`지면색 = 국소장 농도(확산 = 엔트로픽 전파)`, w - 255, 90);
    ctx.font = '12px monospace';
    ctx.fillStyle = state.checksumStatus === 'OK' ? '#8fd9a8' : '#e0b34e';
    ctx.fillText(`지역 체크섬 ${state.checksumStatus}`, w - 255, 108);
    ctx.fillStyle = '#9db2c4';
    ctx.fillText(`수신 ${net.bytesPerSec.toLocaleString()} B/s`, w - 255, 124);

    // 좌하: tx 피드 — 동기화되는 것의 전부
    ctx.font = '11px monospace';
    let ty = this.h - 14 - state.txFeed.length * 14;
    ctx.fillStyle = 'rgba(10,14,20,0.75)';
    ctx.fillRect(8, ty - 30, 260, state.txFeed.length * 14 + 34);
    ctx.fillStyle = '#5f7285';
    ctx.fillText('― 원장 tx 스트림 ―', 14, ty - 14);
    for (const tx of state.txFeed) {
      ctx.fillStyle = tx.to === state.playerId ? '#8fd9a8'
                    : tx.from === state.playerId ? '#d99a8f' : '#77879a';
      ctx.fillText(
        `[${CAUSE_LABEL[tx.cause] ?? tx.cause}] ${poolLabel(state, tx.from)} → ${poolLabel(state, tx.to)}  ${tx.amount}`,
        14, ty);
      ty += 14;
    }

    // 우하: 조작
    ctx.textAlign = 'right';
    ctx.fillStyle = '#5f7285';
    ctx.font = '11px sans-serif';
    ctx.fillText('WASD 이동 · R/F 상하 · 드래그 회전 · 휠 줌', w - 14, this.h - 12);
    ctx.textAlign = 'left';
  }
}
