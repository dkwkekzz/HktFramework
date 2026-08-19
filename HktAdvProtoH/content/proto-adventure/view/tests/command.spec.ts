// 명령 표면 결정 Layer 단독 테스트 (C009) — World 미기동, Fixture 만으로
// 04 commandCatalog · observerCommands · commandSurface 의 표현 결정을 검증한다.
//
// 검증하는 것은 "세계가 밝힌 목록이 사람이 읽고 쓸 수 있는 것이 되는가" 다.

import { describe, expect, it } from 'vitest';
import type { GameViewSnapshot } from '../../protocol/gameview';
import {
  commandEntries,
  composeCommand,
  invocationOf,
} from '../../../../engine/view-kernel/presentation/command-presentation';
import { commandActionRequest } from '../command-request';
import { codeText } from '../code-text';
import { resolvePresentation } from '../resolve';
import fixture from './fixtures/command.fixture.json';

const snapshot = fixture as GameViewSnapshot;
const OFF = { 'collider-observe': false, 'attribute-inspect': false } as const;
const entries = commandEntries(snapshot, OFF, codeText);

function compose(text: string, states = OFF) {
  return composeCommand(text, commandEntries(snapshot, states, codeText), snapshot, states, codeText);
}

describe('목록 (04 commandSurface.browse) — 외우는 것이 아니라 보이는 것이다', () => {
  it('세계가 밝힌 명령과 관찰자 쪽 명령이 한 목록에 있다', () => {
    expect(entries.map((entry) => entry.id)).toEqual([
      'set-attribute',
      'collider-observe',
      'attribute-inspect',
    ]);
  });

  it('각 항목이 세계로 가는지 여기서 끝나는지 구분된다', () => {
    expect(entries.find((e) => e.id === 'set-attribute')?.origin).toBe('world');
    expect(entries.find((e) => e.id === 'collider-observe')?.origin).toBe('observer');
    expect(entries.find((e) => e.id === 'attribute-inspect')?.origin).toBe('observer');
  });

  it('무엇을 하는지가 문구로 읽힌다 — 세계는 코드만 보냈다', () => {
    expect(entries.find((e) => e.id === 'set-attribute')?.title).toBe('존재의 속성 값을 바꾼다');
    expect(entries.find((e) => e.id === 'collider-observe')?.title).toBe(
      '몸과 휘두름의 충돌체를 보인다',
    );
  });

  it('어떻게 쓰는지가 한 줄로 보인다 — 필수와 선택이 구분된다', () => {
    expect(entries.find((e) => e.id === 'set-attribute')?.usage).toBe(
      'set-attribute [target] <attribute> <value>',
    );
  });

  it('받는 자리마다 무엇이 들어가는지와 어디까지 되는지가 함께 온다', () => {
    const slots = entries.find((e) => e.id === 'set-attribute')!.slots;

    expect(slots.map((slot) => slot.id)).toEqual(['대상', '속성', '값']);
    expect(slots[0]?.required).toBe(false);
    expect(slots[0]?.omittedMeaning).toBe('내 몸');
    expect(slots[0]?.hint).toContain('npc-1'); // 지목할 수 있는 존재가 실제로 보인다
    expect(slots[1]?.options).toEqual(['hp', 'moveSpeed', 'moveMode']);
  });

  it('관찰자 쪽 명령은 지금 켜져 있는지가 보인다', () => {
    const on = commandEntries(
      snapshot,
      { 'collider-observe': true, 'attribute-inspect': false },
      codeText,
    );
    expect(on.find((e) => e.id === 'collider-observe')?.stateText).toBe('켜짐');
    expect(on.find((e) => e.id === 'attribute-inspect')?.stateText).toBe('꺼짐');
  });

  it('세계가 권한을 닫으면 걸 수 없다고 보이되 목록에서 사라지지 않는다', () => {
    const closed = {
      ...snapshot,
      debug: { open: false },
      commands: [{ ...snapshot.commands[0]!, available: false, reason: 'debug-closed' }],
    } as GameViewSnapshot;
    const entry = commandEntries(closed, OFF, codeText).find((e) => e.id === 'set-attribute')!;

    expect(entry.available).toBe(false);
    expect(entry.unavailableText).toBe('이 세계는 속성 변경을 허용하지 않는다');
    expect(entry.slots).toHaveLength(3); // 무엇을 할 수 있는 세계인지는 여전히 읽힌다
  });

  it('세계가 밝히지 않은 명령은 목록에 없다 — View 가 지어내지 않는다', () => {
    const bare = { ...snapshot, commands: [] } as GameViewSnapshot;
    const ids = commandEntries(bare, OFF, codeText).map((e) => e.id);

    expect(ids).not.toContain('set-attribute');
    expect(ids).toEqual(['collider-observe', 'attribute-inspect']); // 관찰자 쪽 것만 남는다
  });
});

describe('쓰는 중 안내 (04 commandSurface.guide)', () => {
  it('아무것도 안 썼으면 전부가 후보다', () => {
    expect(compose('').candidates).toHaveLength(3);
  });

  it('이름을 쓰기 시작하면 후보가 좁혀진다', () => {
    const composition = compose('set');
    expect(composition.candidates.map((c) => c.id)).toEqual(['set-attribute']);
    expect(composition.suggestions).toEqual(['set-attribute']);
  });

  it('없는 이름을 쓰면 걸기 전에 알려 준다', () => {
    const composition = compose('teleport');
    expect(composition.candidates).toHaveLength(0);
    expect(composition.problem).toContain('그런 명령이 없다');
    expect(composition.submittable).toBe(false);
  });

  it('이름을 다 쓰면 다음 자리와 그 범위가 보인다', () => {
    const composition = compose('set-attribute ');
    expect(composition.nextSlot?.id).toBe('속성');
    expect(composition.suggestions).toEqual(['hp', 'moveSpeed', 'moveMode']);
    expect(composition.submittable).toBe(false); // 아직 다 적지 않았다
  });

  it('속성을 고르면 값 자리의 범위가 그 선택을 따른다', () => {
    expect(compose('set-attribute moveSpeed ').nextSlot?.hint).toBe('0 … 100');
    expect(compose('set-attribute hp ').nextSlot?.hint).toBe('0 … 100000');
    expect(compose('set-attribute moveMode ').suggestions).toEqual(['walk', 'run']);
  });

  it('적은 것으로 그 자리의 후보가 다시 좁혀진다', () => {
    expect(compose('set-attribute move').suggestions).toEqual(['moveSpeed', 'moveMode']);
  });

  it('아직 쓰는 중인 낱말은 탓하지 않는다 — 이어질 가망이 남아 있는 동안 (C009 결함 수정)', () => {
    // 한 글자마다 빨간 글씨가 뜨면 그것은 안내가 아니라 잔소리다.
    expect(compose('set-attribute m').problem).toBeUndefined();
    expect(compose('set-attribute move').problem).toBeUndefined();
    expect(compose('set-attribute moveS').problem).toBeUndefined();
    // 가망이 사라지면 그때 말한다.
    expect(compose('set-attribute zzz').problem).toContain('그 자리에 넣을 수 없다');
  });

  it('덜 쓴 낱말로는 걸리지 않는다 — 좁혀졌다고 골라진 것은 아니다', () => {
    expect(compose('set-attribute move 20').submittable).toBe(false);
    expect(compose('set-attribute moveSpeed 20').submittable).toBe(true);
  });

  it('범위 밖의 값은 걸기 전에 알려 준다 — 세계까지 가지 않아도 안다', () => {
    const composition = compose('set-attribute moveSpeed 9999');
    expect(composition.problem).toContain('허용된 범위를 벗어난 값이다');
    expect(composition.submittable).toBe(false);
  });

  it('범위 안의 값이면 걸 수 있다', () => {
    const composition = compose('set-attribute moveSpeed 20');
    expect(composition.problem).toBeUndefined();
    expect(composition.submittable).toBe(true);
  });

  it('없는 이름과 범위 밖의 값은 서로 다르게 알려진다', () => {
    expect(compose('set-attribute wingspan 3').problem).toContain('그 자리에 넣을 수 없다');
    expect(compose('set-attribute hp 999999').problem).toContain('허용된 범위를 벗어난');
  });

  it('받지 않는 것이 남으면 알려 준다', () => {
    expect(compose('set-attribute hp 10 그리고또').problem).toContain('받지 않는 것이 남았다');
  });

  it('관찰자 쪽 명령은 이름만으로 걸린다', () => {
    expect(compose('collider-observe').submittable).toBe(true);
    expect(compose('collider-observe 3').problem).toContain('아무것도 받지 않는다');
  });
});

describe('지목 (04 commandSurface.designation)', () => {
  it('지목하지 않으면 대상 자리가 비고 그대로 걸린다', () => {
    const invocation = invocationOf('set-attribute hp 50', entries, snapshot, OFF);
    expect(invocation).toEqual({
      kind: 'world',
      commandId: 'set-attribute',
      values: { attribute: 'hp', value: '50' },
    });
  });

  it('세계에 있는 Id 를 앞에 두면 그것이 대상이 된다', () => {
    const invocation = invocationOf('set-attribute npc-1 hp 5', entries, snapshot, OFF);
    expect(invocation).toEqual({
      kind: 'world',
      commandId: 'set-attribute',
      values: { target: 'npc-1', attribute: 'hp', value: '5' },
    });
  });

  it('세계에 없는 Id 는 대상으로 읽히지 않는다 — 그 자리는 비고 문제가 드러난다', () => {
    // 'ghost' 는 존재 목록에 없으므로 대상 자리를 건너뛰고 속성 자리로 밀린다.
    expect(compose('set-attribute ghost hp 5').problem).toContain('그 자리에 넣을 수 없다');
  });

  it('대상이 될 수 없는 존재는 후보에 없다 — refers 가 가리키는 것만 (C009 결함 수정)', () => {
    // 광맥은 character 가 아니다. 후보로 보여 주면 세계가 거절할 것을 권하는 셈이다.
    const withDeposit = {
      ...snapshot,
      entities: [
        ...snapshot.entities,
        { id: 'deposit-1', role: 'resource-deposit', state: 'available', position: { x: 8, z: -6 } },
      ],
    } as GameViewSnapshot;
    const slots = commandEntries(withDeposit, OFF, codeText).find((e) => e.id === 'set-attribute')!.slots;

    expect(slots[0]?.hint).toContain('npc-1');
    expect(slots[0]?.hint).not.toContain('deposit-1');
  });
});

describe('걸기 → Action Request (04 interactions.setAttribute)', () => {
  it('수치는 수치로 실린다', () => {
    expect(commandActionRequest('set-attribute', { attribute: 'hp', value: '50' })).toEqual({
      interactionId: 'set-attribute',
      attribute: { id: 'hp', value: 50 },
    });
  });

  it('낱말 값은 낱말 그대로 실린다', () => {
    expect(commandActionRequest('set-attribute', { attribute: 'moveMode', value: 'run' })).toEqual({
      interactionId: 'set-attribute',
      attribute: { id: 'moveMode', value: 'run' },
    });
  });

  it('지목한 대상이 함께 실린다', () => {
    expect(
      commandActionRequest('set-attribute', { target: 'npc-1', attribute: 'hp', value: '5' }),
    ).toEqual({
      interactionId: 'set-attribute',
      targetEntityId: 'npc-1',
      attribute: { id: 'hp', value: 5 },
    });
  });

  it('요청 형태를 모르는 명령도 이름만 실어 보낸다 — 세계가 대답한다', () => {
    expect(commandActionRequest('summon-dragon', {})).toEqual({ interactionId: 'summon-dragon' });
  });
});

describe('표면 전체 (resolvePresentation)', () => {
  it('명령 표면은 늘 만들어지되 기본은 닫혀 있다', () => {
    const scene = resolvePresentation(snapshot, undefined, {});
    expect(scene.commandSurface.open).toBe(false);
    expect(scene.commandSurface.entries).toHaveLength(3);
  });

  it('열고 쓰고 있는 것이 표면에 그대로 반영된다', () => {
    const scene = resolvePresentation(snapshot, undefined, {
      command: { open: true, text: 'set-attribute move', history: [] },
    });
    expect(scene.commandSurface.open).toBe(true);
    expect(scene.commandSurface.composition.suggestions).toEqual(['moveSpeed', 'moveMode']);
  });

  it('관찰 토글의 지금 상태가 목록에 실린다 — 같은 값이 두 곳에서 어긋나지 않는다', () => {
    const scene = resolvePresentation(snapshot, undefined, { debugObserve: true, inspect: true });
    const observer = scene.commandSurface.entries.filter((e) => e.origin === 'observer');
    expect(observer.map((e) => e.stateText)).toEqual(['켜짐', '켜짐']);
  });

  it('주고받은 기록이 그대로 실린다', () => {
    const scene = resolvePresentation(snapshot, undefined, {
      command: {
        open: true,
        text: '',
        history: [{ text: 'set-attribute hp 1', answer: '받아들여졌다', accepted: true }],
      },
    });
    expect(scene.commandSurface.history).toHaveLength(1);
    expect(scene.commandSurface.history[0]?.accepted).toBe(true);
  });

  it('C006 · C007 R2 의 관찰은 그대로다 — 이번 Cycle 이 다시 만들지 않았다', () => {
    const scene = resolvePresentation(snapshot, undefined, { debugObserve: true, inspect: true });
    expect(scene.colliderDebug?.capsules.length).toBeGreaterThan(0);
    expect(scene.entities.find((e) => e.id === 'npc-1')?.inspect).toBeDefined();
  });
});
