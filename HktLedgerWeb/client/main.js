// ============================================================================
// 부트스트랩 — 네트·상태·시뮬·렌더 결선 + 행동 키 → 인텐트 변환
// ============================================================================

import { Net } from './net.js';
import { ClientState } from './state.js';
import { Sim } from './sim.js';
import { Render } from './render.js';
import { MSG, INTENT } from '../shared/protocol.js';
import {
  GATHER_RANGE, GATHER_AMOUNT, ATTACK_RANGE, PICKUP_RANGE,
  ATTACK_COST, CRYSTAL_COST, WEAPON_COST,
} from '../shared/constants.js';

const canvas = document.getElementById('game');
const net = new Net();
const state = new ClientState();
const sim = new Sim(net, state);
const render = new Render(canvas, state, sim, net);

state.onResync = (regions) => net.send(MSG.RESYNC, { regions });

const name = new URLSearchParams(location.search).get('name')
  ?? `모험가${Math.floor(Math.random() * 900) + 100}`;
net.connect(name, (msg) => state.handle(msg));

// --- 행동 키: 대상 선택은 클라가, 판정은 서버가 (사거리·잔고·순서) ---

function nearest(kinds, range) {
  let best = null, bestD = range;
  for (const e of state.entities.values()) {
    if (!kinds.includes(e.kind)) continue;
    const d = Math.hypot(e.x - sim.x, e.y - sim.y);
    if (d <= bestD) { best = e; bestD = d; }
  }
  return best;
}

function firstItem(type) {
  for (const [id, item] of state.inventory) if (item.itemType === type) return id;
  return null;
}

addEventListener('keydown', (e) => {
  if (e.repeat || state.dead || !state.playerId) return;
  switch (e.code) {
    case 'KeyE': {
      const item = nearest(['item'], PICKUP_RANGE);
      if (item) { net.intent(INTENT.PICKUP, { itemId: item.id }); return; }
      const node = nearest(['node'], GATHER_RANGE);
      if (node) state.predict(net.intent(INTENT.GATHER, { nodeId: node.id }), +GATHER_AMOUNT);
      break;
    }
    case 'Space': {
      const target = nearest(['mob', 'player'], ATTACK_RANGE);
      if (target) state.predict(net.intent(INTENT.ATTACK, { targetId: target.id }), -ATTACK_COST);
      e.preventDefault();
      break;
    }
    case 'KeyC': state.predict(net.intent(INTENT.CONDENSE), -CRYSTAL_COST); break;
    case 'KeyB': state.predict(net.intent(INTENT.CRAFT), -WEAPON_COST); break;
    case 'KeyV': {
      const id = firstItem('crystal');
      if (id) state.predict(net.intent(INTENT.USE, { itemId: id }), +state.ledger.balance(id));
      break;
    }
    case 'KeyX': {
      const id = firstItem('crystal') ?? firstItem('weapon');
      if (id) net.intent(INTENT.DROP, { itemId: id });
      break;
    }
  }
});

// --- 메인 루프 ---
let last = performance.now();
function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  sim.update(dt, now);
  render.draw();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
