// Integration E2E Trace — Contract 사슬 전체를 실제 실행으로 검증한다 (§30·§36).
//   Client Input → CMD-* → RULE-* → World Transition → OBS-MINING-V1 → Binding → RenderState
// 실측 trace 를 tests/.artifacts/e2e_trace.json 으로 남긴다 (integration artifact 의 근거).
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { bindObservable } from '../gameview/binding';
import type { PlayerObservable } from '../gameview/observable';
import { AuthoritativeWorld, projectDesigner, projectPlayer, type WorldConfig } from '../world';

const PLAYER_ID = 'player-1';

// main.ts 의 World Configuration 과 동일한 무대
const worldConfig: WorldConfig = {
  actors: [
    {
      id: PLAYER_ID,
      position: { x: -3, z: 2 },
      inventory: { resources: {}, tools: [{ kind: 'Pickaxe', capability: 'Mining' }] },
      knowledge: ['deposit-1'],
      currentAction: 'Idle',
      actionTicksRemaining: 0,
    },
  ],
  deposits: [
    { id: 'deposit-1', position: { x: 4, z: -2 }, resourceType: 'Stone', resourceAmount: 5 },
  ],
};

describe('E2E: 곡괭이를 든 캐릭터가 광맥으로 걸어가 Stone 을 하나 캔다', () => {
  it('Client Input → Command → Rule → Transition → Observable → Binding 사슬이 이어진다', () => {
    const world = new AuthoritativeWorld(structuredClone(worldConfig));

    // ── 초기 상태: 멀리 있어 채굴 불가 (OUT_OF_RANGE) ──
    let obs = projectPlayer(world, PLAYER_ID);
    expect(obs.actor.inventoryStone).toBe(0);
    expect(obs.mineAvailability).toMatchObject({ status: 'UNAVAILABLE', reason: 'OUT_OF_RANGE' });
    const initialRender = bindObservable(obs as unknown as PlayerObservable);
    expect(initialRender.hud.stoneCount).toBe(0);
    expect(initialRender.deposits[0]!.interactionRing).toBe(false);

    // ── 이동: 광맥을 향해 CMD-MOVE-V1 을 반복 (플레이어 입력 시뮬레이션) ──
    let moveTicks = 0;
    for (; moveTicks < 3000; moveTicks++) {
      obs = projectPlayer(world, PLAYER_ID);
      if (obs.mineAvailability.status === 'AVAILABLE') break;
      const deposit = obs.visibleDeposits[0]!;
      world.applyCommand({
        id: 'CMD-MOVE-V1',
        actorId: PLAYER_ID,
        direction: {
          dx: deposit.position.x - obs.actor.position.x,
          dz: deposit.position.z - obs.actor.position.z,
        },
      });
      world.tick();
    }
    expect(obs.mineAvailability).toEqual({ status: 'AVAILABLE', target: 'deposit-1' });

    // AVAILABLE 은 GameView 에 강조 링 + [E] 힌트로 표현된다
    const approachRender = bindObservable(obs as unknown as PlayerObservable);
    expect(approachRender.deposits[0]!.interactionRing).toBe(true);
    expect(approachRender.hud.interactionHint).toBe('[E] 채굴');

    // ── 채굴: CMD-MINE-V1 한 번 ──
    const before = projectPlayer(world, PLAYER_ID);
    const record = world.applyCommand({
      id: 'CMD-MINE-V1',
      actorId: PLAYER_ID,
      depositId: 'deposit-1',
    })!;
    world.tick();
    const after = projectPlayer(world, PLAYER_ID);

    // World 층 (Authoritative Transition)
    expect(record.rule).toBe('RULE-MINE-001');
    expect(record.result).toBe('SUCCESS');
    expect(record.before['Deposit.ResourceAmount']).toBe(5);
    expect(record.after['Deposit.ResourceAmount']).toBe(4);

    // Observable 층 (OBS-MINING-V1)
    expect(after.actor.inventoryStone).toBe(1);
    expect(after.visibleDeposits[0]!.resourceAmount).toBe(4);
    expect(after.actor.currentAction).toBe('Mine');
    expect(after.resourceTransition).toMatchObject({ stoneBefore: 0, stoneAfter: 1 });

    // GameView 층 (RenderState)
    const finalRender = bindObservable(after as unknown as PlayerObservable);
    expect(finalRender.hud.stoneCount).toBe(1);
    expect(finalRender.character.mining).toBe(true);
    expect(finalRender.deposits[0]!.amountLabel).toBe('돌 4');
    expect(finalRender.hud.feedbackLine).toBe('+1 Stone 획득!');

    // Designer Observer — Before → Input → Rule → After 관측 (§23)
    const designer = projectDesigner(world);
    const mineView = designer.transitions.find((t) => t.selectedRule === 'RULE-MINE-001')!;
    expect(mineView.currentGoal).toBe('AcquireStone');
    expect(mineView.preconditions.every((p) => p.pass)).toBe(true);

    // ── 실측 Trace 를 artifact 근거로 기록 ──
    const trace = {
      scenario: 'PLAY-MINING-C002',
      chain: [
        { step: 'client_input', value: 'Move intent xN + Mine intent (E)' },
        { step: 'world_command', value: ['CMD-MOVE-V1 x' + moveTicks, 'CMD-MINE-V1 x1'] },
        { step: 'authoritative_rule', value: ['RULE-MOVE-001', 'RULE-MINE-001'] },
        {
          step: 'world_transition',
          value: {
            'Deposit.ResourceAmount': { before: 5, after: record.after['Deposit.ResourceAmount'] },
            'Actor.Inventory.Stone': { before: 0, after: record.after['Actor.Inventory.Stone'] },
          },
        },
        {
          step: 'observer_projection',
          contract: 'OBS-MINING-V1',
          value: {
            'Actor.Inventory.Stone': after.actor.inventoryStone,
            'Deposit.ResourceAmount': after.visibleDeposits[0]!.resourceAmount,
            'Actor.CurrentAction': after.actor.currentAction,
            'MineStone.Availability(before mine)': before.mineAvailability,
          },
        },
        {
          step: 'gameview_binding',
          contract: 'VIEW-MINING-001',
          value: {
            'hud.stoneCount': finalRender.hud.stoneCount,
            'character.mining': finalRender.character.mining,
            'deposit.amountLabel': finalRender.deposits[0]!.amountLabel,
            'hud.feedbackLine': finalRender.hud.feedbackLine,
          },
        },
      ],
      move_ticks_until_available: moveTicks,
    };
    const dir = join(dirname(fileURLToPath(import.meta.url)), '.artifacts');
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'e2e_trace.json'), JSON.stringify(trace, null, 2));
  });

  it('반복 채굴로 고갈까지 도달하면 DEPOSIT_EMPTY 가 관측·표현된다', () => {
    const world = new AuthoritativeWorld(structuredClone(worldConfig));
    // 광맥 옆에서 시작하도록 이동 생략을 위해 근접 배치 시나리오 사용
    const near = structuredClone(worldConfig);
    near.actors[0]!.position = { x: 3.2, z: -2 };
    const w2 = new AuthoritativeWorld(near);
    for (let i = 0; i < 5; i++) {
      const rec = w2.applyCommand({ id: 'CMD-MINE-V1', actorId: PLAYER_ID, depositId: 'deposit-1' });
      expect(rec?.result).toBe('SUCCESS');
    }
    const rec6 = w2.applyCommand({ id: 'CMD-MINE-V1', actorId: PLAYER_ID, depositId: 'deposit-1' });
    expect(rec6?.failureReason).toBe('DEPOSIT_EMPTY');

    const obs = projectPlayer(w2, PLAYER_ID);
    expect(obs.actor.inventoryStone).toBe(5);
    const rs = bindObservable(obs as unknown as PlayerObservable);
    expect(rs.deposits[0]!.depleted).toBe(true);
    expect(rs.deposits[0]!.amountLabel).toBe('고갈');
    expect(rs.hud.feedbackLine).toContain('고갈');
    void world;
  });
});
