// Observer Projection (player) — C001 이 Snapshot 에 채우는 몫.
// VIEW-STONE-MINING-001 (cycles/C001-stone-mining/04-gameview.spec.yaml) 이 계약이다.
//
// 이후 Cycle 은 이 함수를 고치지 않고 자기 모듈에서 draft 목록에 자기 항목을 더한다 —
// 그래서 "C001 까지" 실행하면 Snapshot 도 C001 시점의 모습으로 산출된다.
//
// 표시 문구(prompt · unavailableText · label)는 World 가 정한다 — View 는 사유 코드를
// 해석하지 않고 문구를 그대로 그리는 엔진이기 때문이다.

import type { GameViewDraft } from '../../../kernel/module';
import type { WorldState } from '../../../kernel/state';
import { evaluateMinePreconditions, type MineFailureReason } from '../rules/mine';
import { hasMiningTool, itemCount } from '../semantic/inventory';

const REASON_TEXT: Record<MineFailureReason, string> = {
  'no-mining-tool': '곡괭이가 없다',
  'out-of-range': '광맥이 너무 멀다 — 가까이 이동하자',
  'deposit-depleted': '광맥이 고갈되었다',
};

export function projectPlayerView(state: WorldState, draft: GameViewDraft): void {
  const deposit = state.deposits[0];
  if (!deposit) throw new Error('C001 world 는 deposit 하나를 전제한다');

  const failure = evaluateMinePreconditions(state, deposit);
  const mineAvailable = failure === null;

  draft.id = 'VIEW-STONE-MINING-001';
  draft.scene = 'mining-field';

  draft.entities = [
    ...(draft.entities ?? []),
    {
      id: 'player',
      role: 'player-character',
      state: state.actor.moveTarget ? 'moving' : 'idle',
      position: { x: state.actor.position.x, z: state.actor.position.z },
      focus: true, // 관찰자가 따라가는 존재
    },
    {
      id: deposit.id,
      role: 'resource-deposit',
      state: deposit.resourceAmount > 0 ? 'available' : 'depleted',
      position: { x: deposit.position.x, z: deposit.position.z },
      label: `돌 ${deposit.resourceAmount}`,
    },
  ];

  draft.interactions = [
    ...(draft.interactions ?? []),
    {
      id: 'move',
      role: 'move-to',
      available: true, // Bounds 밖 지점은 애초에 지목되지 않는다
      request: { type: 'move', target: { x: state.actor.position.x, z: state.actor.position.z } },
      pointField: 'target', // 지면 지시형 — View 가 지목한 지점을 여기에 채운다
    },
    {
      id: 'mine',
      role: 'mine-deposit',
      available: mineAvailable,
      request: { type: 'mine', depositId: deposit.id },
      targetEntityId: deposit.id,
      key: 'E',
      prompt: '채굴',
      ...(failure ? { unavailableReason: failure, unavailableText: REASON_TEXT[failure] } : {}),
    },
  ];

  draft.hud = {
    items: [
      ...(draft.hud?.items ?? []),
      {
        id: 'stone',
        icon: '⛏',
        label: 'Stone',
        value: itemCount(state.actor.inventory, 'stone'),
        notifyOnIncrease: '+{delta} {label} 획득!',
      },
      ...(hasMiningTool(state.actor.inventory)
        ? []
        : [{ id: 'tool', label: '곡괭이', value: '없음' }]),
    ],
    keyHints: [...(draft.hud?.keyHints ?? []), '이동: WASD / 방향키', '채굴: E'],
  };
}
