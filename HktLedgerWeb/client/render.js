// ============================================================================
// Render — Canvas 2D 시각화. 원장 미러를 읽기만 한다 (쓰기 금지).
// ============================================================================

import {
  WORLD_SIZE, REGION_SIZE, PLAYER_MAX_ENERGY,
  GATHER_RANGE, ATTACK_RANGE, POOL,
} from '../shared/constants.js';

const CAUSE_LABEL = {
  'gather': '채집', 'leech': '흡수', 'burn': '피해', 'move': '이동',
  'atk-cost': '시전', 'condense': '응축', 'dissolve': '용해',
  'wear': '내구', 'regen': '재생', 'spawn': '스폰', 'death-drop': '소멸',
};

function poolLabel(state, id) {
  if (id === state.playerId) return '나';
  if (id === POOL.SOURCE) return '세계';
  if (id === POOL.SINK) return '소실';
  if (id.startsWith(POOL.NODE)) return '노드';
  if (id.startsWith(POOL.MOB)) return '몬스터';
  if (id.startsWith(POOL.ITEM)) return '아이템';
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
  }

  draw() {
    const { ctx, w, h, state, sim } = this;
    const camX = Math.max(0, Math.min(WORLD_SIZE - w, sim.x - w / 2));
    const camY = Math.max(0, Math.min(WORLD_SIZE - h, sim.y - h / 2));

    ctx.fillStyle = '#0e1116';
    ctx.fillRect(0, 0, w, h);

    // 지역(체크섬) 격자
    ctx.strokeStyle = '#1c2330';
    ctx.lineWidth = 1;
    for (let gx = 0; gx <= WORLD_SIZE; gx += REGION_SIZE) {
      ctx.beginPath(); ctx.moveTo(gx - camX, -camY); ctx.lineTo(gx - camX, WORLD_SIZE - camY); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-camX, gx - camY); ctx.lineTo(WORLD_SIZE - camX, gx - camY); ctx.stroke();
    }

    // 사거리 표시
    if (!state.dead) {
      ctx.strokeStyle = 'rgba(120,220,140,0.15)';
      ctx.beginPath(); ctx.arc(sim.x - camX, sim.y - camY, GATHER_RANGE, 0, 7); ctx.stroke();
      ctx.strokeStyle = 'rgba(240,110,110,0.12)';
      ctx.beginPath(); ctx.arc(sim.x - camX, sim.y - camY, ATTACK_RANGE, 0, 7); ctx.stroke();
    }

    for (const e of state.entities.values()) {
      const x = e.x - camX, y = e.y - camY;
      if (x < -60 || y < -60 || x > w + 60 || y > h + 60) continue;
      const bal = state.ledger.balance(e.id);

      if (e.kind === 'node') {
        const r = 7 + 15 * (bal / e.max);
        ctx.fillStyle = `rgba(90,210,120,${0.25 + 0.6 * (bal / e.max)})`;
        ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
        ctx.fillStyle = '#9fe8b0';
        ctx.font = '11px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(String(bal), x, y - r - 4);
      } else if (e.kind === 'mob') {
        ctx.fillStyle = '#d95f5f';
        ctx.fillRect(x - 10, y - 10, 20, 20);
        this.#bar(x, y - 18, 26, bal / e.max, '#e08888');
      } else if (e.kind === 'item') {
        ctx.save();
        ctx.translate(x, y); ctx.rotate(Math.PI / 4);
        ctx.fillStyle = e.itemType === 'weapon' ? '#e0b34e' : '#7ec8e8';
        ctx.fillRect(-7, -7, 14, 14);
        ctx.restore();
        ctx.fillStyle = '#cfe3ef';
        ctx.font = '10px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(`${e.itemType === 'weapon' ? '무기' : '결정'} ${bal}`, x, y - 14);
      } else if (e.kind === 'player') {
        ctx.fillStyle = '#5aa7d9';
        ctx.beginPath(); ctx.arc(x, y, 11, 0, 7); ctx.fill();
        this.#bar(x, y - 20, 30, bal / PLAYER_MAX_ENERGY, '#7ec3ea');
        ctx.fillStyle = '#bcd8ea';
        ctx.font = '11px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(e.name ?? '', x, y - 26);
      }
    }

    // 나
    const mx = sim.x - camX, my = sim.y - camY;
    ctx.fillStyle = state.dead ? '#555' : '#f0f4f8';
    ctx.beginPath(); ctx.arc(mx, my, 11, 0, 7); ctx.fill();
    ctx.strokeStyle = '#ffd76e'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(mx, my, 14, 0, 7); ctx.stroke();

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

  #bar(cx, y, width, ratio, color) {
    const { ctx } = this;
    ctx.fillStyle = '#2a3040';
    ctx.fillRect(cx - width / 2, y, width, 4);
    ctx.fillStyle = color;
    ctx.fillRect(cx - width / 2, y, width * Math.max(0, Math.min(1, ratio)), 4);
  }

  #hud() {
    const { ctx, w, state, net, sim } = this;
    ctx.textAlign = 'left';

    // 좌상: 내 에너지 + 인벤토리
    const energy = state.displayEnergy();
    ctx.fillStyle = 'rgba(10,14,20,0.8)';
    ctx.fillRect(10, 10, 250, 66 + state.inventory.size * 16);
    ctx.fillStyle = '#e8eef4';
    ctx.font = 'bold 13px sans-serif';
    ctx.fillText(`${state.myName}  에너지 ${energy} / ${PLAYER_MAX_ENERGY}  ·  고도 ${Math.round(sim.z)}`, 20, 30);
    ctx.fillStyle = '#2a3040'; ctx.fillRect(20, 38, 230, 10);
    ctx.fillStyle = energy > 200 ? '#6fd08c' : '#d97b6f';
    ctx.fillRect(20, 38, 230 * energy / PLAYER_MAX_ENERGY, 10);
    ctx.fillStyle = '#9db2c4';
    ctx.font = '12px sans-serif';
    let iy = 66;
    ctx.fillText(`인벤토리 (${state.inventory.size})`, 20, iy);
    for (const [id, item] of state.inventory) {
      iy += 16;
      const bal = state.ledger.balance(id);
      ctx.fillText(`· ${item.itemType === 'weapon' ? '무기(내구' : '결정(에너지'} ${bal})`, 26, iy);
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
    ctx.fillText('WASD 이동 · R/F 상승·하강 · E 채집/줍기 · Space 공격 · C 응축 · B 제작 · V 사용 · X 버리기', w - 14, this.h - 12);
    ctx.textAlign = 'left';
  }
}
