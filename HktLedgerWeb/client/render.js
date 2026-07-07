// ============================================================================
// Render — 3D 원근 투영 시각화 (Canvas 2D 위 소프트웨어 카메라, 외부 의존 0).
// 원장 미러를 읽기만 한다 (쓰기 금지). z 는 높이(up), x·y 는 지면.
// 카메라: 플레이어를 도는 orbit(드래그=회전, 휠=줌). HUD 는 화면공간 유지.
// ============================================================================

import {
  WORLD_SIZE, WORLD_HEIGHT, REGION_SIZE, PLAYER_MAX_ENERGY,
  GATHER_RANGE, ATTACK_RANGE, POOL, ORGANS, FIELD_RICH_MAX,
} from '../shared/constants.js';

const CAUSE_LABEL = {
  'gather': '채집', 'leech': '흡수', 'burn': '피해', 'move': '이동',
  'atk-cost': '시전', 'condense': '응축', 'dissolve': '용해',
  'wear': '내구', 'regen': '재생', 'spawn': '스폰', 'death-drop': '소멸', 'diffuse': '확산',
  'upkeep': '대사', 'recycle': '순환', 'grow': '성장', 'catabolism': '이화', 'give': '증여',
  'mine': '채굴', 'forge': '합성', 'decay': '소산',
};

function poolLabel(state, id) {
  if (id === state.playerId) return '나';
  if (id === POOL.SOURCE) return '세계';
  if (id === POOL.SINK) return '소실';
  if (id.startsWith(POOL.NODE)) return '노드';
  if (id.startsWith(POOL.MOB)) return '몬스터';
  if (id.startsWith(POOL.ITEM)) return '아이템';
  if (id.startsWith(POOL.CELL)) return '필드';
  if (id.startsWith(POOL.STRUCT)) return '구조';
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
    // 카메라→타깃 방향 (내려다봄): 수평 cp, 수직 -sp
    const fwd = [cp * Math.cos(this.yaw), cp * Math.sin(this.yaw), -sp];
    const target = [sim.x, sim.y, sim.z + 20];
    const pos = [target[0] - fwd[0] * this.dist, target[1] - fwd[1] * this.dist, target[2] - fwd[2] * this.dist];
    // right = fwd × up0, up = right × fwd  (up0 = z축)
    const rx = fwd[1] * 1 - fwd[2] * 0, ry = fwd[2] * 0 - fwd[0] * 1, rz = fwd[0] * 0 - fwd[1] * 0;
    const rl = Math.hypot(rx, ry, rz) || 1;
    const right = [rx / rl, ry / rl, rz / rl];
    const up = [
      right[1] * fwd[2] - right[2] * fwd[1],
      right[2] * fwd[0] - right[0] * fwd[2],
      right[0] * fwd[1] - right[1] * fwd[0],
    ];
    return { pos, right, up, fwd };
  }

  // 월드점 → 카메라 좌표 [right, up, forward(depth)]
  #toCam(cam, x, y, z) {
    const rx = x - cam.pos[0], ry = y - cam.pos[1], rz = z - cam.pos[2];
    return [
      rx * cam.right[0] + ry * cam.right[1] + rz * cam.right[2],
      rx * cam.up[0] + ry * cam.up[1] + rz * cam.up[2],
      rx * cam.fwd[0] + ry * cam.fwd[1] + rz * cam.fwd[2],
    ];
  }

  // 카메라 좌표 → 화면. depth ≤ near 면 null.
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

    // 지면(z=0) 지역 격자
    ctx.strokeStyle = '#1a2130';
    ctx.lineWidth = 1;
    for (let g = 0; g <= WORLD_SIZE; g += REGION_SIZE) {
      this.#seg(cam, g, 0, 0, g, WORLD_SIZE, 0);
      this.#seg(cam, 0, g, 0, WORLD_SIZE, g, 0);
    }

    // 사거리 링 (플레이어 z 평면 위 원)
    if (!state.dead) {
      this.#ring(cam, this.sim.x, this.sim.y, this.sim.z, GATHER_RANGE, 'rgba(120,220,140,0.25)');
      this.#ring(cam, this.sim.x, this.sim.y, this.sim.z, ATTACK_RANGE, 'rgba(240,110,110,0.18)');
    }

    // 엔티티 — 자신 포함, 깊이순(먼 것 먼저)
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
    if (state.dead) {
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#f2b8b8';
      ctx.font = 'bold 26px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('에너지 고갈 — 사망. 잠시 후 리스폰…', w / 2, h / 2);
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

  #ring(cam, x, y, z, r, color) {
    const { ctx } = this;
    ctx.strokeStyle = color; ctx.lineWidth = 1;
    let prev = null, first = null;
    for (let i = 0; i <= 24; i++) {
      const a = (i / 24) * Math.PI * 2;
      const p = this.#pt(cam, x + Math.cos(a) * r, y + Math.sin(a) * r, z);
      if (p && prev) { ctx.beginPath(); ctx.moveTo(prev.sx, prev.sy); ctx.lineTo(p.sx, p.sy); ctx.stroke(); }
      prev = p; if (i === 0) first = p;
    }
  }

  #drawEntity(cam, e, depth) {
    const { ctx } = this;
    const p = this.#pt(cam, e.x, e.y, e.z);
    if (!p) return;
    const scale = this.focal / depth;
    const bal = this.state.ledger.balance(e.id);

    if (e.kind === 'node') {
      // A7-2 영토 가치: 풍요도로 색을 물들인다 — 빈곤=초록, 부유=금빛(재충전 빠른 옥토).
      const rr = ((e.richness ?? 1) - 1) / Math.max(1, FIELD_RICH_MAX - 1);
      const cr = Math.round(90 + rr * 150), cg = Math.round(210 - rr * 12), cb = Math.round(120 - rr * 45);
      this.#stick(cam, e.x, e.y, e.z, `rgba(${cr},${cg},${cb},0.4)`);
      const r = (5 + 13 * (bal / e.max)) * scale;
      ctx.fillStyle = `rgba(${cr},${cg},${cb},${0.25 + 0.6 * (bal / e.max)})`;
      ctx.beginPath(); ctx.arc(p.sx, p.sy, Math.max(2, r), 0, 7); ctx.fill();
      this.#label(p.sx, p.sy - r - 4, `${bal} ×${e.richness ?? 1}`, `rgb(${cr},${cg},${cb})`, scale);
    } else if (e.kind === 'mob') {
      this.#stick(cam, e.x, e.y, e.z, 'rgba(217,95,95,0.4)');
      const s = 18 * scale;
      ctx.fillStyle = '#d95f5f';
      ctx.fillRect(p.sx - s / 2, p.sy - s / 2, s, s);
      this.#bar(p.sx, p.sy - s / 2 - 6, 26 * scale, bal / e.max, '#e08888');
    } else if (e.kind === 'item') {
      this.#stick(cam, e.x, e.y, e.z, 'rgba(200,180,120,0.4)');
      const s = 12 * scale;
      ctx.save(); ctx.translate(p.sx, p.sy); ctx.rotate(Math.PI / 4);
      ctx.fillStyle = e.itemType === 'weapon' ? '#e0b34e' : '#7ec8e8';
      ctx.fillRect(-s / 2, -s / 2, s, s);
      ctx.restore();
      this.#label(p.sx, p.sy - s - 4, `${e.itemType === 'weapon' ? '무기' : '결정'} ${bal}`, '#cfe3ef', scale);
    } else if (e.kind === 'player') {
      this.#stick(cam, e.x, e.y, e.z, 'rgba(90,167,217,0.4)');
      ctx.fillStyle = '#5aa7d9';
      ctx.beginPath(); ctx.arc(p.sx, p.sy, Math.max(3, 10 * scale), 0, 7); ctx.fill();
      this.#bar(p.sx, p.sy - 12 * scale, 30 * scale, bal / PLAYER_MAX_ENERGY, '#7ec3ea');
      this.#label(p.sx, p.sy - 20 * scale, e.name ?? '', '#bcd8ea', scale);
    }
  }

  #drawSelf(cam) {
    const { ctx, sim, state } = this;
    this.#stick(cam, sim.x, sim.y, sim.z, 'rgba(255,215,110,0.5)');
    const p = this.#pt(cam, sim.x, sim.y, sim.z);
    if (!p) return;
    const scale = this.focal / this.#toCam(cam, sim.x, sim.y, sim.z)[2];
    ctx.fillStyle = state.dead ? '#555' : '#f0f4f8';
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

    // 좌상: 내 에너지 + 고도 + 구조(조직) + 인벤토리
    const energy = state.displayEnergy();
    // A7-1: 조직별 구조 잔고 (빌드) — 시야와 무관한 내 무지역 풀, 미러 재생으로 추적
    const sAtk = state.ledger.balance(POOL.STRUCT + state.playerId + '#atk');
    const sMeta = state.ledger.balance(POOL.STRUCT + state.playerId + '#meta');
    // A8-1: 내 재료 창고(종류별 G:me#mat) — 채굴로 쌓이고, 합성으로 소진된다.
    const stashes = [];
    const sPrefix = POOL.STASH + state.playerId + '#';
    for (const [id, pool] of state.ledger.pools) {
      if (id.startsWith(sPrefix) && pool.balance > 0) stashes.push([id.slice(sPrefix.length), pool.balance]);
    }
    const rows = state.inventory.size + (stashes.length ? stashes.length + 1 : 0);
    ctx.fillStyle = 'rgba(10,14,20,0.8)';
    ctx.fillRect(10, 10, 270, 86 + rows * 16);
    ctx.fillStyle = '#e8eef4';
    ctx.font = 'bold 13px sans-serif';
    ctx.fillText(`${state.myName}  에너지 ${energy} / ${PLAYER_MAX_ENERGY}  ·  고도 ${Math.round(sim.z)}`, 20, 30);
    ctx.fillStyle = '#2a3040'; ctx.fillRect(20, 38, 250, 10);
    ctx.fillStyle = energy > 200 ? '#6fd08c' : '#d97b6f';
    ctx.fillRect(20, 38, 250 * energy / PLAYER_MAX_ENERGY, 10);
    // 구조(성장) — 조직별. 굶으면 이화로 줄고, 예치로 는다.
    ctx.font = '12px sans-serif';
    ctx.fillStyle = '#e0b34e';
    ctx.fillText(`구조 🗡발산 ${sAtk}`, 20, 62);
    ctx.fillStyle = '#7fd08c';
    ctx.fillText(`🌿대사 ${sMeta}`, 150, 62);
    ctx.fillStyle = '#9db2c4';
    let iy = 82;
    ctx.fillText(`인벤토리 (${state.inventory.size})`, 20, iy);
    for (const [id, item] of state.inventory) {
      iy += 16;
      const bal = state.ledger.balance(id); // A9-2/A9-4: 잔고는 시간이 지나며 소산(누수)한다
      const label = item.itemType === 'weapon' ? '무기(내구' : '결정(에너지';
      ctx.fillText(`· ${item.mat ? item.mat + ' ' : ''}${label} ${bal})`, 26, iy);
    }
    // A8-1: 재료 창고 (채굴로 쌓임 → 합성 재료). 종류별 라벨 = 원장 밖 정체성.
    if (stashes.length) {
      iy += 16;
      ctx.fillStyle = '#c9a86a';
      ctx.fillText(`재료 창고`, 20, iy);
      for (const [mat, bal] of stashes) { iy += 16; ctx.fillText(`· ${mat} ${bal}`, 26, iy); }
    }

    // 우상: 보존 불변식 전시 + 네트워크 계측
    ctx.fillStyle = 'rgba(10,14,20,0.8)';
    ctx.fillRect(w - 265, 10, 255, 76);
    ctx.font = '12px monospace';
    ctx.fillStyle = '#8fd9a8';
    ctx.fillText(`세계 총 에너지 ${state.worldTotal.toLocaleString()}`, w - 255, 28);
    ctx.fillStyle = '#9db2c4';
    ctx.fillText(`(창세 이후 불변 = 보존 법칙)`, w - 255, 44);
    ctx.fillStyle = state.checksumStatus === 'OK' ? '#8fd9a8' : '#e0b34e';
    ctx.fillText(`지역 체크섬 ${state.checksumStatus}`, w - 255, 60);
    ctx.fillStyle = '#9db2c4';
    ctx.fillText(`수신 ${net.bytesPerSec.toLocaleString()} B/s`, w - 255, 76);

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
    ctx.fillText('WASD 이동 · R/F 상하 · E 채집 · M 채굴/N 합성 · Space 공격 · Q/Z 스킬 · G/H 성장 · T 증여 · C 결정/B 무기/V 용해/X 드랍', w - 14, this.h - 12);
    ctx.textAlign = 'left';
  }
}
