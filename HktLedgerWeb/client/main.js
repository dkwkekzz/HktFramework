// ============================================================================
// 부트스트랩 — 네트·상태·시뮬·렌더 결선 + 행동 키 → 인텐트 변환
// ============================================================================

import { Net } from './net.js';
import { ClientState } from './state.js';
import { Sim } from './sim.js';
import { Render } from './render.js';
import { MSG, INTENT } from '../shared/protocol.js';
import { nodeTap } from '../shared/entropy.js';
import {
  GATHER_RANGE, NODE_TAP_NUM, NODE_TAP_DEN, ATTACK_RANGE, PICKUP_RANGE,
  ATTACK_COST, CRYSTAL_COST, WEAPON_COST, GIVE_RANGE, GROW_AMOUNT, SKILLS,
} from '../shared/constants.js';

const GIVE_CHUNK = 50; // 증여 1회 기본량 (T 키)

const canvas = document.getElementById('game');
const net = new Net();
const state = new ClientState();
const sim = new Sim(net, state);
const render = new Render(canvas, state, sim, net);
sim.getYaw = () => render.yaw; // 카메라 상대 이동 — 이동 축을 현재 카메라 방향에 맞춘다

state.onResync = (regions) => net.send(MSG.RESYNC, { regions });

const name = new URLSearchParams(location.search).get('name')
  ?? `모험가${Math.floor(Math.random() * 900) + 100}`;
net.connect(name, (msg) => state.handle(msg));

// --- 행동 키: 대상 선택은 클라가, 판정은 서버가 (사거리·잔고·순서) ---

function nearest(kinds, range) {
  let best = null, bestD = range;
  for (const e of state.entities.values()) {
    if (!kinds.includes(e.kind)) continue;
    const d = Math.hypot(e.x - sim.x, e.y - sim.y, e.z - sim.z); // 3D 거리
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
      // A9-3: 예측량도 미러 노드 잔고에서 같은 커널로 창발(서버와 동일 값) — 확정 tx 로 정정.
      if (node) state.predict(net.intent(INTENT.GATHER, { nodeId: node.id }), +nodeTap(state.ledger.balance(node.id), NODE_TAP_NUM, NODE_TAP_DEN));
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
    // A7-1 성장(구조 분화): G=발산(atk) 조직, H=대사(meta) 조직에 예치 (자유→구조)
    case 'KeyG': state.predict(net.intent(INTENT.GROW, { organ: 'atk', amount: GROW_AMOUNT }), -GROW_AMOUNT); break;
    case 'KeyH': state.predict(net.intent(INTENT.GROW, { organ: 'meta', amount: GROW_AMOUNT }), -GROW_AMOUNT); break;
    // A7-3 생명 간 이체: T=근처 플레이어에게 자유 에너지 증여
    case 'KeyT': {
      const ally = nearest(['player'], GIVE_RANGE);
      if (ally) state.predict(net.intent(INTENT.GIVE, { targetId: ally.id, amount: GIVE_CHUNK }), -GIVE_CHUNK);
      break;
    }
    // A6-4 스킬(발산 패턴): Q=강타(소각 버스트), Z=흡정(흡수 지속) — 근처 대상에게
    case 'KeyQ': {
      const t = nearest(['mob', 'player'], ATTACK_RANGE);
      if (t) state.predict(net.intent(INTENT.SKILL, { skillId: 'smash', targetId: t.id }), -SKILLS.smash.cost);
      break;
    }
    case 'KeyZ': {
      const t = nearest(['mob', 'player'], ATTACK_RANGE);
      if (t) state.predict(net.intent(INTENT.SKILL, { skillId: 'drain', targetId: t.id }), -SKILLS.drain.cost);
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
