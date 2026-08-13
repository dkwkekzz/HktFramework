// Observer Projection (player) — WorldState 를 Render 지시 Snapshot 으로 투영한다.
// VIEW-STONE-MINING-001 (cycles/C001-stone-mining/04-gameview.spec.yaml) 이 의미 계약이다.
//
// "무엇을 어떻게 그릴지"는 여기(각 Cycle 의 World)가 결정한다 —
// sprite 키·variant·크기·라벨·프롬프트·불가 문구 전부 이 Projection 의 산출물이다.
// View 는 이 지시를 자신의 capability(sprite·terrain·label·HUD)로 그릴 뿐이다.

import type { EntityView, GameViewSnapshot, InteractionView } from '../../protocol/gameview';
import { evaluateMinePreconditions, type MineFailureReason } from '../rules/mine';
import { hasMiningTool, itemCount } from '../semantic/inventory';
import type { WorldState } from '../semantic/world-state';

// 불가 사유 코드 → 플레이어 표시 문구 (표현 결정 — Projection 소유)
const MINE_FAILURE_TEXT: Record<MineFailureReason, string> = {
  'no-mining-tool': '곡괭이가 없다',
  'out-of-range': '광맥이 너무 멀다 — 가까이 이동하자',
  'deposit-depleted': '광맥이 고갈되었다',
};

export function projectPlayerView(state: WorldState): GameViewSnapshot {
  const entities: EntityView[] = [
    {
      id: 'player',
      position: { x: state.actor.position.x, z: state.actor.position.z },
      representation: {
        kind: 'sprite',
        sprite: 'player-pickaxe',
        variant: state.actor.moveTarget ? 'moving' : 'idle',
        size: 2.6,
        cameraFollow: true,
        trail: true,
      },
    },
  ];

  const interactions: InteractionView[] = [
    { id: 'move', terrainTarget: true, available: true },
  ];

  for (const deposit of state.deposits) {
    entities.push({
      id: deposit.id,
      position: { x: deposit.position.x, z: deposit.position.z },
      representation: {
        kind: 'sprite',
        sprite: 'stone-deposit',
        variant: deposit.resourceAmount > 0 ? 'available' : 'depleted',
        size: 3.4,
        label: `돌 ${deposit.resourceAmount}`,
      },
    });

    const failure = evaluateMinePreconditions(state, deposit);
    interactions.push({
      id: 'mine',
      targetEntityId: deposit.id,
      available: failure === null,
      key: 'KeyE',
      keyLabel: 'E',
      prompt: '채굴',
      ...(failure ? { unavailableText: MINE_FAILURE_TEXT[failure] } : {}),
    });
  }

  return {
    specId: 'VIEW-STONE-MINING-001',
    scene: { terrain: 'field' },
    entities,
    interactions,
    hud: [
      {
        id: 'inventory.stone',
        widget: 'counter',
        label: 'Stone',
        icon: '⛏',
        value: itemCount(state.actor.inventory, 'stone'),
        celebrateGain: true,
      },
      {
        id: 'tool.hasMiningTool',
        widget: 'flag',
        label: '곡괭이',
        value: hasMiningTool(state.actor.inventory),
      },
    ],
  };
}
