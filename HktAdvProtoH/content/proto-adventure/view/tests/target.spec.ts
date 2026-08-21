// 대상 지목의 Presentation 결정 단독 테스트 (C017) — World 미기동, Fixture 만으로 검증한다.
//
// 계약 출처: cycles/C017-target-gathers-the-actions/04-gameview.spec.yaml
//   currentTarget · interactions.selectTarget · clearTarget ·
//   interactions.observe / mine (many → one)
//
// 이 Cycle 의 화면 값어치는 **고른 상대의 지금이 한자리에서 읽힌다** 이고, 그 한자리는
// 세계가 아니라 여기(결정 Layer)가 만든다. 세계가 보장한 것은 짐작 없이 모을 수 있다는
// 것뿐이다 (04 VIEW ASSEMBLY NOTE). 그래서 이 파일이 확인하는 것은 둘이다.
//   ① 모아진 자리가 계약의 값만으로 만들어지는가 (View 가 판정하지 않는가)
//   ② 고른 것이 없을 때도 그 사실이 그려지는가

import { describe, expect, it } from 'vitest';
import type { GameViewSnapshot } from '../../protocol/gameview';
import { resolvePresentation } from '../resolve';
import { interactionPresentation } from '../interaction-presentation';
import { TARGET_TINT } from '../target-presentation';
import chosenDeposit from './fixtures/mining-available.fixture.json'; // deposit-1 을 고른 화면
import chosenCharacter from './fixtures/observe.fixture.json'; // npc-2 를 고른 화면
import nothingChosen from './fixtures/combat.fixture.json'; // 아무것도 고르지 않은 화면

const plan = (fixture: unknown) => resolvePresentation(fixture as GameViewSnapshot);
const hudOf = (fixture: unknown, id: string) => plan(fixture).hud.find((h) => h.id === id);
/**
 * 이 상대에게 무엇이 되는가는 **self 패널의 줄**에 선다 (C022 에서 자리가 옮겨졌다).
 * 사유는 문장이고 가로 띠는 가로로만 자라 잘려 나갔다 — 소지품과 같은 이유, 같은 기준.
 * 사라진 것은 없다: MC-WATCH-TARGET 이 요구하는 "사유가 남는다" 는 그대로다.
 */
const detail = (fixture: unknown, label: string) =>
  (plan(fixture).self?.lines ?? []).find((l) => l.startsWith(label));

describe('currentTarget — 고른 것이 무엇인지가 늘 그려진다', () => {
  it('고른 것이 없으면 "없음" 한 줄이 남는다 — 자리를 지우지 않는다', () => {
    // "지금은 아무것도 안 골랐다" 와 "화면이 이 자리를 안 그린다" 는 다르다
    expect(hudOf(nothingChosen, 'target.none')).toMatchObject({
      label: '고른 대상',
      value: '없음',
    });
    expect(hudOf(nothingChosen, 'target.name')).toBeUndefined();
  });

  it('고른 존재의 이름이 그 자리에 온다', () => {
    expect(hudOf(chosenCharacter, 'target.name')?.value).toBe('Wanderer 2');
  });

  it('이름이 없는 존재(광맥)는 종류로 부른다', () => {
    expect(hudOf(chosenDeposit, 'target.name')?.value).toBe('돌 광맥');
  });

  it('고른 존재의 지금 행동과 생명이 함께 온다 — 사본이 아니라 계약의 지금 값이다', () => {
    const snapshot = chosenCharacter as unknown as GameViewSnapshot;
    const npc = snapshot.entities.find((e) => e.id === 'npc-2');

    expect(hudOf(chosenCharacter, 'target.state')?.value).toBe('대기');
    expect(hudOf(chosenCharacter, 'target.health')?.value).toBe(npc?.vitality?.health);
  });

  it('생명이 없는 존재에는 그 줄을 만들지 않는다 — 없는 값을 짐작하지 않는다', () => {
    expect(hudOf(chosenDeposit, 'target.health')).toBeUndefined();
  });
});

describe('대상 자리 — 무엇이 되고 무엇이 왜 안 되는가가 한자리에 모인다', () => {
  it('되는 것은 되는 대로 온다', () => {
    expect(detail(chosenDeposit, '채집')).toBe('채집 ✓');
    expect(detail(chosenCharacter, '살펴보기')).toBe('살펴보기 ✓');
  });

  it('안 되는 것은 세계가 준 사유가 사람 말로 온다 — View 가 판정하지 않는다', () => {
    // 광맥을 고른 화면에서 살펴봄은 종류가 맞지 않는다 (세계가 보낸 사유다).
    // 목록 안이라 짧은 표기가 온다 — 긴 문장의 집은 바닥 프롬프트다 (code-text.ts).
    expect(detail(chosenDeposit, '살펴보기')).toBe('살펴보기 ✗ 이 대상엔 안 됨');
    // 존재를 고른 화면에서 채집도 마찬가지다
    expect(detail(chosenCharacter, '채집')).toBe('채집 ✗ 이 대상엔 안 됨');
  });

  it('고르지 않았을 때는 두 줄이 아예 없다 — 대상 자리 자체가 없기 때문이다', () => {
    expect(detail(nothingChosen, '살펴보기')).toBeUndefined();
    expect(detail(nothingChosen, '채집')).toBeUndefined();
    expect((plan(nothingChosen).self?.lines ?? []).includes('고른 대상')).toBe(false);
  });

  it('대상 자리는 소지품보다 먼저 읽힌다 — 띠에서도 패널에서도', () => {
    const ids = plan(chosenDeposit).hud.map((h) => h.id);
    expect(ids[0]).toBe('target.name');
    const lines = plan(chosenDeposit).self?.lines ?? [];
    expect(lines.indexOf('고른 대상')).toBeLessThan(lines.indexOf('소지품'));
  });

  it('띠에 남는 것은 한눈에 읽는 것뿐이다 — 사유 문장이 띠를 밀어내지 않는다', () => {
    const ids = plan(chosenDeposit).hud.map((h) => h.id);
    expect(ids.filter((id) => id.startsWith('target.'))).toEqual(['target.name', 'target.state']);
  });
});

describe('강조 — 고른 존재를 색으로 가른다', () => {
  it('고른 존재에만 지목의 색이 곱해진다', () => {
    const entities = plan(chosenCharacter).entities;
    expect(entities.find((e) => e.id === 'npc-2')?.tint).toBe(TARGET_TINT);
    // 같은 역할의 다른 존재는 역할이 정한 색 그대로다
    expect(entities.find((e) => e.id === 'npc-1')?.tint).not.toBe(TARGET_TINT);
  });

  it('아무것도 고르지 않으면 어느 존재도 그 색을 갖지 않는다', () => {
    expect(plan(nothingChosen).entities.every((e) => e.tint !== TARGET_TINT)).toBe(true);
  });
});

describe('입력 — 지목은 눌러서, 해제와 행동은 키로', () => {
  it('고르기는 그 몸을 눌러 부른다 (키 없음) — 존재마다 실린다', () => {
    expect(interactionPresentation('select-target').key).toBeUndefined();
    const selects = plan(chosenCharacter).interactions.filter((i) => i.id === 'select-target');
    expect(selects.length).toBe(4); // npc-1 · npc-2 · player-1 · deposit-1
    expect(selects.every((i) => i.targetEntityId !== undefined)).toBe(true);
  });

  it('푸는 것은 Esc 다 — 대상이 없는 요청이므로 키로 부른다', () => {
    const clear = plan(chosenCharacter).interactions.find((i) => i.id === 'clear-target');
    expect(clear).toMatchObject({ available: true, key: 'Escape', keyLabel: 'Esc' });
  });

  it('살펴봄과 채집은 각각 하나씩이고 대상을 싣지 않는다', () => {
    const p = plan(chosenCharacter);
    expect(p.interactions.filter((i) => i.id === 'observe')).toHaveLength(1);
    expect(p.interactions.filter((i) => i.id === 'mine')).toHaveLength(1);
    expect(p.interactions.find((i) => i.id === 'observe')?.targetEntityId).toBeUndefined();
    expect(p.interactions.find((i) => i.id === 'mine')?.targetEntityId).toBeUndefined();
  });

  it('두 행동 모두 키를 지닌다 — 대상이 사라졌으므로 키로 부를 수 있다', () => {
    // C023 CHANGED — KeyT 는 엔진의 시점 조작(내려다보기)이라 눌려도 삼켜졌다.
    // 키가 있다는 것과 그 키가 닿는다는 것은 다르다 — Y 로 옮겼다.
    expect(interactionPresentation('observe-character').key).toBe('KeyY');
    expect(interactionPresentation('mine-deposit').key).toBe('KeyE');
  });
});
