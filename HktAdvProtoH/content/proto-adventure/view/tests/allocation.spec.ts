// C-COMBAT-001 힘의 배분 View 단독 테스트 — World 미기동, Fixture 만으로 검증한다.
//
// 04-gameview.spec.yaml 의 셋을 화면 결정으로 옮긴 것을 본다:
//   ① 모든 존재의 지금 배분 (가려지지 않는다 — 몸 위 표시와 속성 관찰)
//   ② 내 몸의 고를 수 있는 목록 넷 (못 가는 것도 사유와 함께)
//   ③ 두 걸음 조작이 순서로 짚는다 (배분 이름이 조작 코드에 없다)
//
// Fixture 의 자리
//   관찰자     hunter (몸 1 · 능력 1 · 인지 4) · 통찰 40 · 기력 45
//   자율 존재  reinforce (몸 4 · 능력 1 · 인지 1) — 다쳐서 몸에 몰았다.
//              사냥꾼의 통찰 40 이 얕은 자리 하나(문턱 30)를 열어 약점만 보인다

import { describe, expect, it } from 'vitest';
import type { GameViewSnapshot } from '../../protocol/gameview';
import {
  allocationIdOf,
  allocationLabel,
  allocationMark,
  allocationSlots,
  sharesText,
} from '../allocation-presentation';
import { KEY_BINDINGS } from '../bindings';
import { keyCode, keyLabel } from '../key-registry';
import { resolvePresentation } from '../resolve';
import fixture from './fixtures/allocation.fixture.json';

const snapshot = fixture as GameViewSnapshot;
const plan = (inspect = false) => resolvePresentation(snapshot, undefined, { inspect });
const entity = (id: string, inspect = false) =>
  plan(inspect).entities.find((e) => e.id === id);
const inspectLines = (id: string) => entity(id, true)?.inspect ?? [];
const hudRow = (id: string) => plan().hud.find((h) => h.id === id);

describe('① 지금의 배분이 몸마다 보인다', () => {
  it('몸 위 이름 앞에 어디에 몰았는지가 붙는다 — 살펴보지 않은 상대에게도', () => {
    // 자율 존재는 아직 모르는 존재다 (이름 뒤 물음표) — 그래도 배분은 보인다.
    // **이것이 "얇아진 쪽을 노린다" 가 시작되는 자리다.**
    expect(entity('npc-1')?.nameplate?.name).toContain('[몸]');
    expect(entity('npc-1')?.nameplate?.name).toContain('?');
    expect(entity('player-1')?.nameplate?.name).toContain('[인]');
  });

  it('어디에도 몰지 않은 몸에는 붙지 않는다 — 붙지 않음도 관찰이다', () => {
    expect(allocationMark({ id: 'balanced', shares: { body: 2, ability: 2, awareness: 2 } })).toBe(
      '',
    );
    expect(allocationMark(undefined)).toBe('');
    // 두 축이 같이 높으면 어느 쪽으로도 몰지 않은 것이다 — 화면이 임의로 고르지 않는다
    expect(allocationMark({ id: 'x', shares: { body: 3, ability: 3, awareness: 0 } })).toBe('');
  });

  it('속성 관찰에 그 존재의 배분이 한 줄로 온다 — 통찰 바로 위다', () => {
    const lines = inspectLines('npc-1');
    const index = lines.findIndex((l) => l.startsWith('배분 '));
    expect(lines[index]).toBe('배분 강화 (몸 4 · 능력 1 · 인지 1)');
    expect(lines[index + 1]).toBe('통찰 0');
  });

  it('내 self 패널의 맨 앞이 배분이다 — 아래 줄들이 그것에 따라 움직이기 때문이다', () => {
    expect(plan().self?.lines[0]).toBe('배분 사냥꾼 (몸 1 · 능력 1 · 인지 4)');
    // 인지에 몬 대가가 바로 아랫줄에서 읽힌다 (기본 40·50 이 32·40 으로)
    expect(plan().self?.lines[1]).toContain('물리 공격 32');
    expect(plan().self?.lines[1]).toContain('물리 방어 40');
  });
});

describe('② 고를 수 있는 배분 넷이 언제나 전부 선다', () => {
  it('넷이 세계가 준 차례로 실린다 — 화면이 정렬하지 않는다', () => {
    const ids = plan()
      .hud.map((h) => allocationIdOf(h.id))
      .filter((id): id is string => id !== undefined);
    expect(ids).toEqual(['balanced', 'reinforce', 'hatsu', 'hunter']);
  });

  it('지금 있는 자리는 거절이 아니다 — 사유 대신 "지금 여기" 다', () => {
    expect(hudRow('allocation.hunter')?.value).toBe('몸 1 · 능력 1 · 인지 4 · 지금 여기');
  });

  it('갈 수 있는 자리는 치를 기력과 손가락 자리를 함께 보인다', () => {
    expect(hudRow('allocation.reinforce')?.value).toBe(
      `몸 4 · 능력 1 · 인지 1 · 기력 15 · ${keyLabel('allocation')} → ${keyLabel('slot2')}`,
    );
  });

  it('못 가는 자리도 사라지지 않는다 — 세계가 보낸 사유를 그대로 옮긴다', () => {
    // 없어진 것과 지금 못 가는 것은 다르다. 그 구분이 없으면
    // "기력을 모으면 저것으로 갈 수 있다" 를 사람이 알 수 없다
    expect(hudRow('allocation.hatsu')?.value).toBe('몸 1 · 능력 4 · 인지 1 · 기력이 모자란다');
  });

  it('배분 이름의 문구는 표에서 오고, 표에 없으면 코드 그대로다', () => {
    expect(allocationLabel('balanced')).toBe('균형');
    expect(allocationLabel('hunter')).toBe('사냥꾼');
    // 세계가 배분을 하나 더 지어도 화면이 멈추지 않는다
    expect(allocationLabel('zetsu')).toBe('allocation.zetsu');
  });

  it('세 몫은 세계가 보낸 것을 옮길 뿐이다 — 화면이 세지 않는다', () => {
    expect(sharesText({ body: 4, ability: 1, awareness: 1 })).toBe('몸 4 · 능력 1 · 인지 1');
  });
});

describe('③ 두 걸음 조작은 순서로 짚는다 — 이름을 적어 두지 않는다', () => {
  const send = () => {
    const sent: unknown[] = [];
    return { sent, fn: (a: unknown) => sent.push(a) };
  };
  const scene = () => plan();
  const press = (code: string, out: (a: unknown) => void) => {
    const binding = KEY_BINDINGS.find((b) => b.code === code);
    expect(binding).toBeDefined();
    binding!.invoke(scene() as never, out as never);
  };

  it('배분 키를 누르고 숫자를 누르면 그 차례의 배분을 요청한다', () => {
    const { sent, fn } = send();
    press(keyCode('allocation'), fn);
    press(keyCode('slot2'), fn); // 두 번째 = reinforce
    expect(sent).toEqual([{ interactionId: 'set-allocation', allocationId: 'reinforce' }]);
  });

  it('되는지 안 되는지를 화면이 판정하지 않는다 — 못 가는 자리도 그대로 보낸다', () => {
    // 세계가 사유와 함께 거절하고 그 사유는 이미 배분 자리에 떠 있다.
    // 화면이 미리 거르면 세계가 규칙을 바꿔도 화면이 따라오지 않는다
    const { sent, fn } = send();
    press(keyCode('allocation'), fn);
    press(keyCode('slot3'), fn); // 세 번째 = hatsu (지금 기력 모자람)
    expect(sent).toEqual([{ interactionId: 'set-allocation', allocationId: 'hatsu' }]);
  });

  it('열지 않고 숫자만 누르면 배분이 나가지 않는다', () => {
    const { sent, fn } = send();
    press(keyCode('slot2'), fn);
    expect(sent.filter((a) => (a as { interactionId?: string }).interactionId === 'set-allocation'))
      .toEqual([]);
  });

  it('없는 차례를 짚으면 아무것도 보내지 않는다', () => {
    const { sent, fn } = send();
    press(keyCode('allocation'), fn);
    press(keyCode('slot9'), fn); // 아홉 번째 배분은 없다
    expect(sent).toEqual([]);
  });

  it('조작이 읽는 차례는 화면에 뜬 차례와 같다 — 갈라질 자리가 없다', () => {
    expect(allocationSlots(plan() as never)).toEqual([
      'balanced',
      'reinforce',
      'hatsu',
      'hunter',
    ]);
  });
});

describe('④ 인지에 몬 결과가 한 화면에서 읽힌다', () => {
  it('통찰이 오르고 얕은 자리 하나가 열려 약점이 보인다', () => {
    // 세계가 이미 판정해 보낸 것이다 — 화면이 문턱을 계산하지 않는다
    expect(plan().self?.lines.some((l) => l === '통찰 40')).toBe(true);
    const lines = inspectLines('npc-1');
    expect(lines.some((l) => l.includes('약점 물리에 약하다'))).toBe(true);
  });

  it('아직 열리지 않은 자리는 무엇을 모르는지로 남는다 — 줄이 사라지지 않는다', () => {
    const lines = inspectLines('npc-1');
    // 깊은 두 자리(문턱 60·90)는 아직 닫혀 있고, 그 자리에 **무엇을 모르는지**가 온다.
    // 줄이 사라지면 사람은 세계에 그 값이 없다고 배운다 (C014 가 세운 EMPTY-SLOT 태도)
    expect(lines).toContain('겨루는 힘 · 나에게 읽히는 방어 — 아직 살펴보지 않았다');
  });
});
