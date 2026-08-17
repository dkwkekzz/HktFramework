// C009 — 세계가 밝히는 명령 목록과 요청에 대한 대답.
//
// 검증 대상
//   INTENT-COMMAND-CATALOG-001      세계가 걸 수 있는 것을 뜻·받는 것·범위와 함께 밝힌다
//   INTENT-COMMAND-INVOKE-001       목록에 있는 것만 걸린다
//   INTENT-REQUEST-REPLY-001        모든 요청이 대답을 받는다
//   INTENT-REPLY-CORRESPONDENCE-001 어느 요청의 대답인지 짚을 수 있다
//   INTENT-ENTITY-ADDRESSABLE-001   지목은 Actor.Id 로, 지목하지 않으면 자기 몸
//
// World 단독이다 — View 없이 돈다.

import { describe, expect, it } from 'vitest';
import type { CommandView } from '../../protocol/gameview';
import { driveWorld, OBSERVER, OBSERVER_2, PLAYER, PLAYER_2 } from './drive';

function dummyAt(x: number, z: number) {
  return { id: 'npc-1', position: { x, z } };
}

function setAttribute(view: { commands: CommandView[] }): CommandView | undefined {
  return view.commands.find((command) => command.id === 'set-attribute');
}

describe('INTENT-COMMAND-CATALOG-001 — 세계가 걸 수 있는 것을 밝힌다', () => {
  it('관찰 결과에 명령 목록이 늘 실린다 — 걸어 보아야 알게 되는 것이 없다', () => {
    const view = driveWorld({ npcs: [] }).observe();

    expect(view.commands.length).toBeGreaterThan(0);
    expect(view.commands.map((command) => command.id)).toContain('set-attribute');
  });

  it('각 명령이 무엇을 하는지와 무엇을 받는지가 함께 밝혀진다', () => {
    const command = setAttribute(driveWorld({ npcs: [] }).observe())!;

    expect(command.effect).toBe('set-attribute');
    expect(command.parameters.map((parameter) => parameter.id)).toEqual([
      'target',
      'attribute',
      'value',
    ]);
  });

  it('지목하지 않아도 되는 자리는 없을 때 무엇으로 치는지가 함께 온다', () => {
    const command = setAttribute(driveWorld({ npcs: [] }).observe())!;
    const target = command.parameters[0]!;

    expect(target.required).toBe(false);
    expect(target.omittedMeaning).toBe('self');
    expect(target.domain.kind).toBe('entity');
  });

  it('고른 속성이 값 자리의 허용 범위를 정한다 — 수치와 선택지가 구분된다', () => {
    const command = setAttribute(driveWorld({ npcs: [] }).observe())!;
    const options = command.parameters[1]!.domain.options!;

    const moveSpeed = options.find((option) => option.name === 'moveSpeed')!;
    expect(moveSpeed.thenDomain).toEqual({ kind: 'number', minimum: 0, maximum: 100 });

    const moveMode = options.find((option) => option.name === 'moveMode')!;
    expect(moveMode.thenDomain?.kind).toBe('choice');
    expect(moveMode.thenDomain?.options?.map((option) => option.name)).toEqual(['walk', 'run']);

    // 값 자리는 앞의 선택을 따른다 — 자기 범위를 따로 갖지 않는다.
    expect(command.parameters[2]!.domain.kind).toBe('from-previous-choice');
  });

  it('허용 목록은 세계의 단일 출처를 그대로 쓴다 — 두 곳에 적히지 않는다', () => {
    const command = setAttribute(driveWorld({ npcs: [] }).observe())!;
    const names = command.parameters[1]!.domain.options!.map((option) => option.name);

    expect(names).toEqual([
      'hp',
      'hpMax',
      'cp',
      'cpMax',
      'attack', // C010 — 세계가 목록에 더하면 여기 그대로 나타난다
      'defense',
      'moveSpeed',
      'runSpeedMultiplier',
      'actionSpeed',
      'moveMode',
    ]);
  });

  it('권한이 닫힌 세계에서도 목록은 보인다 — 다만 걸 수 없다고 밝혀진다', () => {
    const view = driveWorld({ debugAuthority: false, npcs: [] }).observe();
    const command = setAttribute(view)!;

    expect(view.debug.open).toBe(false);
    expect(command.available).toBe(false);
    expect(command.reason).toBe('debug-closed');
    // 무엇을 할 수 있는 세계인지는 허용 여부와 별개로 알 수 있어야 한다.
    expect(command.parameters).toHaveLength(3);
  });

  it('권한이 열린 세계에서는 걸 수 있다고 밝혀진다', () => {
    const command = setAttribute(driveWorld({ npcs: [] }).observe())!;

    expect(command.available).toBe(true);
    expect(command.reason).toBeUndefined();
  });
});

describe('INTENT-REQUEST-REPLY-001 — 세계가 요청에 대답한다', () => {
  it('받아들여진 요청은 받아들여졌다고 돌아온다', () => {
    const world = driveWorld({ npcs: [] });

    const outcomes = world.dispatchForOutcome({
      interactionId: 'set-attribute',
      attribute: { id: 'moveSpeed', value: 12 },
    });

    expect(outcomes).toEqual([{ accepted: true, rule: 'RULE-ATTRIBUTE-SET-001' }]);
    // 그 결과 자체는 지금까지대로 관찰 결과에서 보인다 — 대답이 상태를 말하지 않는다.
    const self = world.observe().entities.find((entity) => entity.id === PLAYER);
    expect(self?.attributes?.tempoStats.moveSpeed).toBe(12);
  });

  it('거절된 요청은 그 이유와 함께 돌아온다 — 값이 그대로인 것과 구분된다', () => {
    const world = driveWorld({ debugAuthority: false, npcs: [] });
    const before = world.observe().entities.find((entity) => entity.id === PLAYER);

    const outcomes = world.dispatchForOutcome({
      interactionId: 'set-attribute',
      attribute: { id: 'moveSpeed', value: 12 },
    });

    expect(outcomes).toEqual([
      { accepted: false, rule: 'RULE-ATTRIBUTE-SET-001', reason: 'debug-closed' },
    ]);
    const after = world.observe().entities.find((entity) => entity.id === PLAYER);
    expect(after?.attributes?.tempoStats.moveSpeed).toBe(before?.attributes?.tempoStats.moveSpeed);
  });

  it('범위 밖의 값과 모르는 속성은 서로 다른 사유로 돌아온다', () => {
    const world = driveWorld({ npcs: [] });

    expect(
      world.dispatchForOutcome({
        interactionId: 'set-attribute',
        attribute: { id: 'moveSpeed', value: 9999 },
      })[0]?.reason,
    ).toBe('value-out-of-range');

    expect(
      world.dispatchForOutcome({
        interactionId: 'set-attribute',
        attribute: { id: 'wingspan', value: 3 },
      })[0]?.reason,
    ).toBe('unknown-attribute');
  });

  it('세계에 없는 존재를 지목하면 그렇다고 돌아온다', () => {
    const world = driveWorld({ npcs: [] });

    const outcomes = world.dispatchForOutcome({
      interactionId: 'set-attribute',
      targetEntityId: 'nobody',
      attribute: { id: 'hp', value: 1 },
    });

    expect(outcomes[0]).toEqual({
      accepted: false,
      rule: 'RULE-ATTRIBUTE-SET-001',
      reason: 'unknown-target',
    });
  });

  it('목록에 없는 명령도 대답을 받는다 — 조용히 사라지지 않는다', () => {
    const world = driveWorld({ npcs: [] });

    const outcomes = world.dispatchForOutcome({ interactionId: 'summon-dragon' });

    expect(outcomes).toHaveLength(1);
    expect(outcomes[0]?.accepted).toBe(false);
    expect(outcomes[0]?.reason).toBe('unknown-interaction');
  });

  it('세계가 모르는 관찰자의 요청도 대답을 받는다', () => {
    const world = driveWorld({ npcs: [] });

    const outcomes = world.dispatchForOutcome(
      { interactionId: 'set-attribute', attribute: { id: 'hp', value: 1 } },
      'stranger',
    );

    expect(outcomes[0]).toEqual({
      accepted: false,
      rule: 'DISPATCH',
      reason: 'unknown-observer',
    });
  });

  it('세계 안의 행동도 같은 길로 대답을 받는다 — 명령만의 것이 아니다', () => {
    const world = driveWorld({ npcs: [] });

    const outcomes = world.dispatchForOutcome({
      interactionId: 'mine',
      targetEntityId: 'deposit-1',
    });

    expect(outcomes).toHaveLength(1);
    expect(outcomes[0]?.rule).toBe('RULE-MINE-001');
  });

  it('세계는 대답을 쌓아 두지 않는다 — 다음 Tick 에는 남지 않는다', () => {
    const world = driveWorld({ npcs: [] });
    world.dispatchForOutcome({
      interactionId: 'set-attribute',
      attribute: { id: 'hp', value: 50 },
    });

    expect(world.world.tick(0).outcomes.size).toBe(0);
  });

  it('내 요청의 대답만 나에게 온다', () => {
    const world = driveWorld({ npcs: [] });
    world.join(OBSERVER_2);
    world.tick(0);

    world.world.request(OBSERVER_2, {
      interactionId: 'set-attribute',
      attribute: { id: 'hp', value: 7 },
    });
    const outcomes = world.world.tick(0).outcomes;

    expect(outcomes.get(OBSERVER_2)).toHaveLength(1);
    expect(outcomes.get(OBSERVER)).toBeUndefined();
  });
});

describe('INTENT-REPLY-CORRESPONDENCE-001 — 어느 요청의 대답인지 짚는다', () => {
  it('요청에 붙인 표식이 대답에 그대로 돌아온다', () => {
    const world = driveWorld({ npcs: [] });

    const outcomes = world.dispatchForOutcome({
      interactionId: 'set-attribute',
      attribute: { id: 'hp', value: 40 },
      mark: 77,
    });

    expect(outcomes[0]?.mark).toBe(77);
  });

  it('한 Tick 에 연달아 건 요청들이 각자 자기 표식으로 구분된다', () => {
    const world = driveWorld({ npcs: [] });

    world.world.request(OBSERVER, {
      interactionId: 'set-attribute',
      attribute: { id: 'moveSpeed', value: 20 },
      mark: 1,
    });
    world.world.request(OBSERVER, {
      interactionId: 'set-attribute',
      attribute: { id: 'moveSpeed', value: 9999 },
      mark: 2,
    });
    const outcomes = world.world.tick(0).outcomes.get(OBSERVER)!;

    expect(outcomes).toHaveLength(2);
    expect(outcomes[0]).toEqual({ accepted: true, rule: 'RULE-ATTRIBUTE-SET-001', mark: 1 });
    expect(outcomes[1]).toEqual({
      accepted: false,
      rule: 'RULE-ATTRIBUTE-SET-001',
      reason: 'value-out-of-range',
      mark: 2,
    });
  });

  it('표식을 붙이지 않으면 대답에도 붙지 않는다 — 세계가 지어내지 않는다', () => {
    const world = driveWorld({ npcs: [] });

    const outcomes = world.dispatchForOutcome({
      interactionId: 'set-attribute',
      attribute: { id: 'hp', value: 30 },
    });

    expect(outcomes[0]).not.toHaveProperty('mark');
  });
});

describe('INTENT-ENTITY-ADDRESSABLE-001 — 지목', () => {
  it('지목하지 않으면 자기 몸이다', () => {
    const world = driveWorld({ npcs: [dummyAt(3, 0)] });

    world.dispatchForOutcome({
      interactionId: 'set-attribute',
      attribute: { id: 'hp', value: 33 },
    });

    const view = world.observe();
    expect(view.entities.find((entity) => entity.id === PLAYER)?.vitality?.health).toBe(33);
    expect(view.entities.find((entity) => entity.id === 'npc-1')?.vitality?.health).not.toBe(33);
  });

  it('Actor.Id 로 다른 존재를 지목한다 — 그 Id 는 관찰 결과에 이미 있다', () => {
    const world = driveWorld({ npcs: [dummyAt(3, 0)] });
    const ids = world.observe().entities.map((entity) => entity.id);
    expect(ids).toContain('npc-1');

    world.dispatchForOutcome({
      interactionId: 'set-attribute',
      targetEntityId: 'npc-1',
      attribute: { id: 'hp', value: 9 },
    });

    expect(
      world.observe().entities.find((entity) => entity.id === 'npc-1')?.vitality?.health,
    ).toBe(9);
  });

  it('다른 관찰자의 몸도 Id 로 지목된다', () => {
    const world = driveWorld({ npcs: [] });
    world.join(OBSERVER_2);
    world.tick(0);

    world.dispatchForOutcome({
      interactionId: 'set-attribute',
      targetEntityId: PLAYER_2,
      attribute: { id: 'hp', value: 11 },
    });

    expect(
      world.observe().entities.find((entity) => entity.id === PLAYER_2)?.vitality?.health,
    ).toBe(11);
  });
});

describe('C009 회귀 — 바뀐 값 위에서 세계는 지금까지대로 굴러간다', () => {
  it('이동 속도를 올리면 같은 시간에 더 멀리 간다 (INTENT-TEMPO-MOVE-001)', () => {
    const slow = driveWorld({ npcs: [] });
    slow.dispatch({ interactionId: 'move', position: { x: 15, z: 0 } });
    slow.tick(0.5);
    const slowX = slow.observe().entities.find((entity) => entity.id === PLAYER)!.position.x;

    const fast = driveWorld({ npcs: [] });
    fast.dispatch({ interactionId: 'set-attribute', attribute: { id: 'moveSpeed', value: 20 } });
    fast.dispatch({ interactionId: 'move', position: { x: 15, z: 0 } });
    fast.tick(0.5);
    const fastX = fast.observe().entities.find((entity) => entity.id === PLAYER)!.position.x;

    expect(fastX).toBeGreaterThan(slowX);
  });

  it('생명을 0 으로 만들면 쓰러지고, 되돌리면 일어난다 (RULE-DOWNED-001)', () => {
    const world = driveWorld({ npcs: [dummyAt(3, 0)] });

    world.dispatchForOutcome({
      interactionId: 'set-attribute',
      targetEntityId: 'npc-1',
      attribute: { id: 'hp', value: 0 },
    });
    expect(world.observe().entities.find((entity) => entity.id === 'npc-1')?.state).toBe('downed');

    world.dispatchForOutcome({
      interactionId: 'set-attribute',
      targetEntityId: 'npc-1',
      attribute: { id: 'hp', value: 20 },
    });
    expect(world.observe().entities.find((entity) => entity.id === 'npc-1')?.state).not.toBe(
      'downed',
    );
  });
});
